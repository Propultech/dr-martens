import { Component } from '@theme/component';
import { VariantSelectedEvent, VariantUpdateEvent } from '@theme/events';
import { morph, MORPH_OPTIONS } from '@theme/morph';
import { yieldToMainThread, getViewParameterValue, ResizeNotifier } from '@theme/utilities';

const COMBINED_LISTING_PRODUCT_CARD_UPDATE = 'combined-listing-product-card';
const YOTPO_REINIT_DEBOUNCE_MS = 150;

/**
 * @typedef {object} VariantPickerRefs
 * @property {HTMLFieldSetElement[]} fieldsets – The fieldset elements.
 */

/**
 * A custom element that manages a variant picker.
 *
 * @template {import('@theme/component').Refs} [TRefs=VariantPickerRefs]
 * @extends Component<TRefs>
 */
export default class VariantPicker extends Component {
  /** @type {string | undefined} */
  #pendingRequestUrl;

  /** @type {AbortController | undefined} */
  #abortController;

  /** @type {number} */
  #latestRequestId = 0;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #yotpoReinitTimeout;

  /** @type {number[][]} */
  #checkedIndices = [];

  /** @type {HTMLInputElement[][]} */
  #radios = [];

  #resizeObserver = new ResizeNotifier(() => this.updateVariantPickerCss());

  connectedCallback() {
    super.connectedCallback();
    const fieldsets = /** @type {HTMLFieldSetElement[]} */ (this.refs.fieldsets || []);

    fieldsets.forEach((fieldset) => {
      const radios = Array.from(fieldset?.querySelectorAll('input') ?? []);
      this.#radios.push(radios);

      const initialCheckedIndex = radios.findIndex((radio) => radio.dataset.currentChecked === 'true');
      if (initialCheckedIndex !== -1) {
        this.#checkedIndices.push([initialCheckedIndex]);
      }
    });

    this.addEventListener('change', this.variantChanged.bind(this));
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  /**
   * Handles the variant change event.
   * @param {Event} event - The variant change event.
   */
  variantChanged(event) {
    if (!(event.target instanceof HTMLElement)) return;

    const selectedOption =
      event.target instanceof HTMLSelectElement ? event.target.options[event.target.selectedIndex] : event.target;

    if (!selectedOption) return;

    this.updateSelectedOption(event.target);
    this.dispatchEvent(new VariantSelectedEvent({ id: selectedOption.dataset.optionValueId ?? '' }));

    const isOnProductPage =
      this.dataset.templateProductMatch === 'true' &&
      !event.target.closest('product-card') &&
      !event.target.closest('quick-add-dialog');

    // PDP behavior (existing Horizon behavior):
    // if a swatch points to a connected product URL, we treat it as a product switch
    // and morph the full <main> so all product-dependent sections stay in sync.
    const currentUrl = this.dataset.productUrl?.split('?')[0];
    const newUrl = selectedOption.dataset.connectedProductUrl;
    const loadsNewProduct = isOnProductPage && !!newUrl && newUrl !== currentUrl;
    const isOnFeaturedProductSection = Boolean(this.closest('featured-product-information'));

    // PLP combined-listing behavior:
    // swatches can point to child products; in this case we do a scoped card update.
    // We intentionally avoid full-card morphing to preserve merchant-configured block wrappers,
    // classes and inline styles already present in the current card DOM.
    const isInProductCard = Boolean(this.closest('product-card'));
    const isCombinedListingSwitch =
      isInProductCard && !!newUrl && newUrl !== currentUrl;

    const morphElementSelector = loadsNewProduct
      ? 'main'
      : isOnFeaturedProductSection
        ? 'featured-product-information'
        : isCombinedListingSwitch
          ? COMBINED_LISTING_PRODUCT_CARD_UPDATE
          : undefined;

    this.fetchUpdatedSection(this.buildRequestUrl(selectedOption), morphElementSelector);

    const url = new URL(window.location.href);

    const variantId = selectedOption.dataset.variantId || null;

    if (isOnProductPage) {
      if (variantId) {
        url.searchParams.set('variant', variantId);
      } else {
        url.searchParams.delete('variant');
      }
    }

    // Change the path if the option is connected to another product via combined listing.
    if (loadsNewProduct) {
      url.pathname = newUrl;
    }

    if (url.href !== window.location.href) {
      yieldToMainThread().then(() => {
        history.replaceState({}, '', url.toString());
      });
    }
  }

  /**
   * @typedef {object} FieldsetMeasurements
   * @property {HTMLFieldSetElement} fieldset
   * @property {number | undefined} currentIndex
   * @property {number | undefined} previousIndex
   * @property {number | undefined} currentWidth
   * @property {number | undefined} previousWidth
   */

  /**
   * Gets measurements for a single fieldset (read phase).
   * @param {number} fieldsetIndex
   * @returns {FieldsetMeasurements | null}
   */
  #getFieldsetMeasurements(fieldsetIndex) {
    const fieldsets = /** @type {HTMLFieldSetElement[]} */ (this.refs.fieldsets || []);
    const fieldset = fieldsets[fieldsetIndex];
    const checkedIndices = this.#checkedIndices[fieldsetIndex];
    const radios = this.#radios[fieldsetIndex];

    if (!radios || !checkedIndices || !fieldset) return null;

    const [currentIndex, previousIndex] = checkedIndices;

    return {
      fieldset,
      currentIndex,
      previousIndex,
      currentWidth: currentIndex !== undefined ? radios[currentIndex]?.parentElement?.offsetWidth : undefined,
      previousWidth: previousIndex !== undefined ? radios[previousIndex]?.parentElement?.offsetWidth : undefined,
    };
  }

  /**
   * Applies measurements to a fieldset (write phase).
   * @param {FieldsetMeasurements} measurements
   */
  #applyFieldsetMeasurements({ fieldset, currentWidth, previousWidth, currentIndex, previousIndex }) {
    if (currentWidth) {
      fieldset.style.setProperty('--pill-width-current', `${currentWidth}px`);
    } else if (currentIndex !== undefined) {
      fieldset.style.removeProperty('--pill-width-current');
    }

    if (previousWidth) {
      fieldset.style.setProperty('--pill-width-previous', `${previousWidth}px`);
    } else if (previousIndex !== undefined) {
      fieldset.style.removeProperty('--pill-width-previous');
    }
  }

  /**
   * Updates the fieldset CSS.
   * @param {number} fieldsetIndex - The fieldset index.
   */
  updateFieldsetCss(fieldsetIndex) {
    if (Number.isNaN(fieldsetIndex)) return;

    const measurements = this.#getFieldsetMeasurements(fieldsetIndex);
    if (measurements) {
      this.#applyFieldsetMeasurements(measurements);
    }
  }

  /**
   * Updates the selected option.
   * @param {string | Element} target - The target element.
   */
  updateSelectedOption(target) {
    if (typeof target === 'string') {
      const targetElement = this.querySelector(`[data-option-value-id="${target}"]`);

      if (!targetElement) throw new Error('Target element not found');

      target = targetElement;
    }

    if (target instanceof HTMLInputElement) {
      const fieldsetIndex = Number.parseInt(target.dataset.fieldsetIndex || '');
      const inputIndex = Number.parseInt(target.dataset.inputIndex || '');

      if (!Number.isNaN(fieldsetIndex) && !Number.isNaN(inputIndex)) {
        const fieldsets = /** @type {HTMLFieldSetElement[]} */ (this.refs.fieldsets || []);
        const fieldset = fieldsets[fieldsetIndex];
        const checkedIndices = this.#checkedIndices[fieldsetIndex];
        const radios = this.#radios[fieldsetIndex];

        if (radios && checkedIndices && fieldset) {
          // Clear previous checked states
          const [currentIndex, previousIndex] = checkedIndices;

          if (currentIndex !== undefined && radios[currentIndex]) {
            radios[currentIndex].dataset.previousChecked = 'false';
          }
          if (previousIndex !== undefined && radios[previousIndex]) {
            radios[previousIndex].dataset.previousChecked = 'false';
          }

          // Update checked indices array - keep only the last 2 selections
          checkedIndices.unshift(inputIndex);
          checkedIndices.length = Math.min(checkedIndices.length, 2);

          // Update the new states
          const newCurrentIndex = checkedIndices[0]; // This is always inputIndex
          const newPreviousIndex = checkedIndices[1]; // This might be undefined

          // newCurrentIndex is guaranteed to exist since we just added it
          if (newCurrentIndex !== undefined && radios[newCurrentIndex]) {
            radios[newCurrentIndex].dataset.currentChecked = 'true';
          }

          if (newPreviousIndex !== undefined && radios[newPreviousIndex]) {
            radios[newPreviousIndex].dataset.previousChecked = 'true';
            radios[newPreviousIndex].dataset.currentChecked = 'false';
          }

          this.updateFieldsetCss(fieldsetIndex);
        }
      }
      target.checked = true;
    }

    if (target instanceof HTMLSelectElement) {
      const newValue = target.value;
      const newSelectedOption = Array.from(target.options).find((option) => option.value === newValue);

      if (!newSelectedOption) throw new Error('Option not found');

      for (const option of target.options) {
        option.removeAttribute('selected');
      }

      newSelectedOption.setAttribute('selected', 'selected');
    }
  }

  /**
   * Builds the request URL.
   * @param {HTMLElement} selectedOption - The selected option.
   * @param {string | null} [source] - The source.
   * @param {string[]} [sourceSelectedOptionsValues] - The source selected options values.
   * @returns {string} The request URL.
   */
  buildRequestUrl(selectedOption, source = null, sourceSelectedOptionsValues = []) {
    // this productUrl and pendingRequestUrl will be useful for the support of combined listing. It is used when a user changes variant quickly and those products are using separate URLs (combined listing).
    // We create a new URL and abort the previous fetch request if it's still pending.
    let productUrl = selectedOption.dataset.connectedProductUrl || this.#pendingRequestUrl || this.dataset.productUrl;
    this.#pendingRequestUrl = productUrl;
    const params = [];
    const viewParamValue = getViewParameterValue();

    // preserve view parameter, if it exists, for alternative product view testing
    if (viewParamValue) params.push(`view=${viewParamValue}`);

    if (this.selectedOptionsValues.length && !source) {
      params.push(`option_values=${this.selectedOptionsValues.join(',')}`);
    } else if (source === 'product-card') {
      if (this.selectedOptionsValues.length) {
        params.push(`option_values=${sourceSelectedOptionsValues.join(',')}`);
      } else {
        params.push(`option_values=${selectedOption.dataset.optionValueId}`);
      }
    }

    // If variant-picker is a child of some specific sections, we need to append section_id=xxxx to the URL
    const SECTION_ID_MAP = {
      'quick-add-component': 'section-rendering-product-card',
      'swatches-variant-picker-component': 'section-rendering-product-card',
      'featured-product-information': this.closest('featured-product-information')?.id,
    };

    const closestSectionId = /** @type {keyof typeof SECTION_ID_MAP} | undefined */ (
      Object.keys(SECTION_ID_MAP).find((sectionId) => this.closest(sectionId))
    );

    if (closestSectionId) {
      if (productUrl?.includes('?')) {
        productUrl = productUrl.split('?')[0];
      }
      return `${productUrl}?section_id=${SECTION_ID_MAP[closestSectionId]}&${params.join('&')}`;
    }

    return `${productUrl}?${params.join('&')}`;
  }

  /**
   * Fetches the updated section.
   * @param {string} requestUrl - The request URL.
   * @param {string} [morphElementSelector] - The selector of the element to be morphed. By default, only the variant picker is morphed.
   */
  fetchUpdatedSection(requestUrl, morphElementSelector) {
    const requestId = ++this.#latestRequestId;

    // Abort previous in-flight request to reduce race conditions under rapid clicks.
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    fetch(requestUrl, { signal: this.#abortController.signal })
      .then((response) => response.text())
      .then((responseText) => {
        // Even with aborts, stale responses can occasionally resolve late in some environments.
        // Request id check guarantees we only apply the most recent user intent.
        if (requestId !== this.#latestRequestId) return;

        this.#pendingRequestUrl = undefined;
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        // Defer is only useful for the initial rendering of the page. Remove it here.
        html.querySelector('overflow-list[defer]')?.removeAttribute('defer');

        const textContent =
          html.querySelector('variant-picker script[type="application/json"]')?.textContent ??
          html.querySelector('swatches-variant-picker-component script[type="application/json"]')?.textContent;

        if (morphElementSelector === 'main') {
          this.updateMain(html);
        } else if (morphElementSelector === COMBINED_LISTING_PRODUCT_CARD_UPDATE) {
          // Combined-listing PLP update path:
          // update dynamic fragments while preserving original card structure/styling.
          this.#updateCombinedListingProductCard(html);

          // Sync card-level links/datasets used by navigation and transition components.
          this.#syncProductCardLinksAfterMorph(html);

          // Keep downstream listeners working (product-card, quick-add, etc.).
          this.#dispatchVariantUpdateEvent(textContent, html);
        } else if (morphElementSelector) {
          this.updateElement(html, morphElementSelector);
        } else {
          if (!textContent) return;

          const newProduct = this.updateVariantPicker(html);

          this.#dispatchVariantUpdateEvent(textContent, html, newProduct);
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.warn('Fetch aborted by user');
        } else {
          console.error(error);
        }
      });
  }

  /**
   * Dispatches VariantUpdateEvent when variant JSON is available.
   * @param {string | undefined} textContent
   * @param {Document} html
   * @param {NewProduct | undefined} [newProduct]
   */
  #dispatchVariantUpdateEvent(textContent, html, newProduct = undefined) {
    if (!textContent || !this.selectedOptionId) return;

    try {
      const variantPayload = JSON.parse(textContent);
      this.dispatchEvent(
        new VariantUpdateEvent(variantPayload, this.selectedOptionId, {
          html,
          productId: this.dataset.productId ?? '',
          newProduct,
        })
      );
    } catch (error) {
      console.error('Failed to parse variant JSON payload', error);
    }
  }

  /**
   * @typedef {Object} NewProduct
   * @property {string} id
   * @property {string} url
   */

  /**
   * Re-renders the variant picker.
   * @param {Document | Element} newHtml - The new HTML.
   * @returns {NewProduct | undefined} Information about the new product if it has changed, otherwise undefined.
   */
  updateVariantPicker(newHtml) {
    /** @type {NewProduct | undefined} */
    let newProduct;

    const newVariantPickerSource = newHtml.querySelector(this.tagName.toLowerCase());

    if (!newVariantPickerSource) {
      throw new Error('No new variant picker source found');
    }

    // For combined listings, the product might have changed, so update the related data attribute.
    if (newVariantPickerSource instanceof HTMLElement) {
      const newProductId = newVariantPickerSource.dataset.productId;
      const newProductUrl = newVariantPickerSource.dataset.productUrl;

      if (newProductId && newProductUrl && this.dataset.productId !== newProductId) {
        newProduct = { id: newProductId, url: newProductUrl };
      }

      this.dataset.productId = newProductId;
      this.dataset.productUrl = newProductUrl;
    }

    morph(this, newVariantPickerSource, {
      ...MORPH_OPTIONS,
      getNodeKey: (node) => {
        if (!(node instanceof HTMLElement)) return undefined;
        const key = node.dataset.key;
        return key;
      },
    });
    this.updateVariantPickerCss();

    return newProduct;
  }

  updateVariantPickerCss() {
    const fieldsets = /** @type {HTMLFieldSetElement[]} */ (this.refs.fieldsets || []);

    // Batch all reads first across all fieldsets to avoid layout thrashing
    const measurements = fieldsets.map((_, index) => this.#getFieldsetMeasurements(index)).filter((m) => m !== null);

    // Batch all writes after all reads
    for (const measurement of measurements) {
      this.#applyFieldsetMeasurements(measurement);
    }
  }

  /**
   * Syncs product card links (anchor, product-card-link) after morphing product-card__content.
   * Required for combined listings when switching to a child product.
   * @param {Document} newHtml - The HTML response from the fetch.
   */
  #syncProductCardLinksAfterMorph(newHtml) {
    const productCard = this.closest('product-card');
    const newProductCard = newHtml.querySelector('product-card');
    if (!(productCard instanceof HTMLElement) || !(newProductCard instanceof HTMLElement)) return;

    const newAnchor = newProductCard.querySelector('a.product-card__link');
    const currentAnchor = productCard.querySelector('a.product-card__link');
    if (newAnchor instanceof HTMLAnchorElement && currentAnchor instanceof HTMLAnchorElement) {
      currentAnchor.href = newAnchor.href;
    }

    // Keep card metadata in sync for future combined-listing comparisons
    // and for any consumer reading product-card datasets.
    productCard.dataset.productId = newProductCard.dataset.productId ?? '';
    productCard.dataset.productUrl = newProductCard.dataset.productUrl ?? '';

    const productCardLink = productCard.closest('product-card-link');
    const newProductCardLink = newHtml.querySelector('product-card-link');
    if (productCardLink instanceof HTMLElement && newProductCardLink instanceof HTMLElement) {
      if (newProductCardLink.dataset.featuredMediaUrl) {
        productCardLink.dataset.featuredMediaUrl = newProductCardLink.dataset.featuredMediaUrl;
      }
      if (newProductCardLink.dataset.productId) {
        productCardLink.dataset.productId = newProductCardLink.dataset.productId;
      }
    }
  }

  /**
   * Updates product card dynamic content for combined listings while preserving
   * existing block wrappers/classes/styles from the current card.
   * @param {Document} newHtml
   */
  #updateCombinedListingProductCard(newHtml) {
    const productCard = this.closest('product-card');
    const newProductCard = newHtml.querySelector('product-card');
    if (!(productCard instanceof HTMLElement) || !(newProductCard instanceof HTMLElement)) return;

    // 1) Keep gallery link pointing to current selected child product.
    const currentGalleryLink = productCard.querySelector('[ref="cardGalleryLink"]');
    const newGalleryLink = newProductCard.querySelector('[ref="cardGalleryLink"]');
    if (currentGalleryLink instanceof HTMLAnchorElement && newGalleryLink instanceof HTMLAnchorElement) {
      currentGalleryLink.href = newGalleryLink.href;
    }

    // 2) Morph slideshow media only (images/video), preserving outer card wrappers.
    const currentSlideshow = productCard.querySelector('[ref="cardGallery"] slideshow-component');
    const newSlideshow = newProductCard.querySelector('[ref="cardGallery"] slideshow-component');
    if (currentSlideshow && newSlideshow) {
      morph(currentSlideshow, newSlideshow);
    }

    // 3) Morph badges and keep a stable insertion point relative to quick-add overlay.
    const currentBadges = productCard.querySelector('[ref="cardGallery"] .product-badges');
    const newBadges = newProductCard.querySelector('[ref="cardGallery"] .product-badges');
    if (currentBadges && newBadges) {
      morph(currentBadges, newBadges);
    } else if (currentBadges && !newBadges) {
      currentBadges.remove();
    } else if (!currentBadges && newBadges) {
      const gallery = productCard.querySelector('[ref="cardGallery"]');
      if (gallery) {
        const quickAdd = gallery.querySelector('quick-add-component');
        const newBadgesNode = newBadges.cloneNode(true);
        if (quickAdd) {
          quickAdd.before(newBadgesNode);
        } else {
          gallery.append(newBadgesNode);
        }
      }
    }

    // 4) Morph swatches picker and refresh this picker datasets so URL comparison logic
    // continues to work when toggling back/forth between sibling child products.
    const currentSwatches = productCard.querySelector('swatches-variant-picker-component');
    const newSwatches = newProductCard.querySelector('swatches-variant-picker-component');
    if (currentSwatches instanceof HTMLElement && newSwatches instanceof HTMLElement) {
      morph(currentSwatches, newSwatches);

      // Keep the active picker context in sync so switching back/forth between
      // combined-listing child products compares against the correct current URL.
      this.dataset.productId = newSwatches.dataset.productId ?? this.dataset.productId ?? '';
      this.dataset.productUrl = newSwatches.dataset.productUrl ?? this.dataset.productUrl ?? '';
    }

    // 5) Morph price payload only (priceContainer) to avoid replacing merchant typography wrappers.
    const currentPriceContainer = productCard.querySelector('product-price [ref="priceContainer"]');
    const newPriceContainer = newProductCard.querySelector('product-price [ref="priceContainer"]');
    if (currentPriceContainer && newPriceContainer) {
      morph(currentPriceContainer, newPriceContainer);
    }

    // 6) Update title link and visible title text in both regular and zoom-out views.
    const currentTitleLink = productCard.querySelector('[ref="productTitleLink"]');
    const newTitleLink = newProductCard.querySelector('[ref="productTitleLink"]');
    if (currentTitleLink instanceof HTMLAnchorElement && newTitleLink instanceof HTMLAnchorElement) {
      currentTitleLink.href = newTitleLink.href;

      const currentTitle =
        currentTitleLink.querySelector('.product-title') ?? currentTitleLink.querySelector('.title-text');
      const newTitle = newTitleLink.querySelector('.product-title') ?? newTitleLink.querySelector('.title-text');
      if (currentTitle && newTitle) {
        currentTitle.textContent = newTitle.textContent ?? '';
      }
    }

    const currentZoomOutTitle = productCard.querySelector('.product-grid-view-zoom-out--details .h4');
    const newZoomOutTitle = newProductCard.querySelector('.product-grid-view-zoom-out--details .h4');
    if (currentZoomOutTitle && newZoomOutTitle) {
      currentZoomOutTitle.textContent = newZoomOutTitle.textContent ?? '';
    }

    // 7) SKU can change between child products, keep it aligned when present.
    const currentSku = productCard.querySelector('product-sku-component');
    const newSku = newProductCard.querySelector('product-sku-component');
    if (currentSku && newSku) {
      morph(currentSku, newSku);
    }

    // 8) App/widget integration: refresh Yotpo context to the currently selected child product.
    this.#syncYotpoWidgetProductId(newProductCard, productCard);
  }

  /**
   * Syncs Yotpo widget product id and re-inits widgets if available.
   * @param {Element} newProductCard
   * @param {Element} currentProductCard
   */
  #syncYotpoWidgetProductId(newProductCard, currentProductCard) {
    const currentYotpoInstance = currentProductCard.querySelector('.yotpo-widget-instance');
    const newYotpoInstance = newProductCard.querySelector('.yotpo-widget-instance');
    if (!(currentYotpoInstance instanceof HTMLElement) || !(newYotpoInstance instanceof HTMLElement)) return;

    const newProductId = newYotpoInstance.dataset.yotpoProductId;
    if (!newProductId) return;

    // Reset loaded flag so widget can be re-initialized against the new product id.
    currentYotpoInstance.dataset.yotpoProductId = newProductId;
    currentYotpoInstance.removeAttribute('data-yotpo-element-loaded');

    const windowWithYotpo = /** @type {Window & { yotpoWidgetsContainer?: { initWidgets?: () => void } }} */ (
      window
    );
    const yotpoWidgetsContainer = windowWithYotpo.yotpoWidgetsContainer;
    // Re-init safely when Yotpo global container is available.
    if (yotpoWidgetsContainer?.initWidgets) {
      if (this.#yotpoReinitTimeout) {
        clearTimeout(this.#yotpoReinitTimeout);
      }
      this.#yotpoReinitTimeout = setTimeout(() => {
        yotpoWidgetsContainer.initWidgets?.();
      }, YOTPO_REINIT_DEBOUNCE_MS);
    }
  }

  /**
   * Re-renders the desired element.
   * @param {Document} newHtml - The new HTML.
   * @param {string} elementSelector - The selector of the element to re-render.
   */
  updateElement(newHtml, elementSelector) {
    const element = this.closest(elementSelector);
    const newElement = newHtml.querySelector(elementSelector);

    if (!element || !newElement) {
      throw new Error(`No new element source found for ${elementSelector}`);
    }

    morph(element, newElement);
  }

  /**
   * Re-renders the entire main content.
   * @param {Document} newHtml - The new HTML.
   */
  updateMain(newHtml) {
    const main = document.querySelector('main');
    const newMain = newHtml.querySelector('main');

    if (!main || !newMain) {
      throw new Error('No new main source found');
    }

    morph(main, newMain);
  }

  /**
   * Gets the selected option.
   * @returns {HTMLInputElement | HTMLOptionElement | undefined} The selected option.
   */
  get selectedOption() {
    const selectedOption = this.querySelector('select option[selected], fieldset input:checked');

    if (!(selectedOption instanceof HTMLInputElement || selectedOption instanceof HTMLOptionElement)) {
      return undefined;
    }

    return selectedOption;
  }

  /**
   * Gets the selected option ID.
   * @returns {string | undefined} The selected option ID.
   */
  get selectedOptionId() {
    const { selectedOption } = this;
    if (!selectedOption) return undefined;
    const { optionValueId } = selectedOption.dataset;

    if (!optionValueId) {
      throw new Error('No option value ID found');
    }

    return optionValueId;
  }

  /**
   * Gets the selected options values.
   * @returns {string[]} The selected options values.
   */
  get selectedOptionsValues() {
    /** @type HTMLElement[] */
    const selectedOptions = Array.from(this.querySelectorAll('select option[selected], fieldset input:checked'));

    return selectedOptions.map((option) => {
      const { optionValueId } = option.dataset;

      if (!optionValueId) throw new Error('No option value ID found');

      return optionValueId;
    });
  }
}

if (!customElements.get('variant-picker')) {
  customElements.define('variant-picker', VariantPicker);
}

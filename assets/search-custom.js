import { Component } from '@theme/component';

/**
 * Custom element that manages the mobile search expand/collapse behavior
 * and desktop clear button visibility
 *
 * @extends {Component}
 */
class SearchCustomComponent extends Component {
    /** @type {string[]} */
    requiredRefs = [];

    #isOpen = false;
    #allowDesktopSearchVisibility = false;
    /** @type {((event: KeyboardEvent) => void) | null} */
    #keyDownHandler = null;
    /** @type {Array<() => void> | null} */
    __searchCustomCleanup = null;

    connectedCallback() {
        super.connectedCallback();

        // Mobile functionality
        const mobileTrigger = this.querySelector('.search-custom-mobile__trigger');
        if (mobileTrigger) {
            this.#setupMobile();
        }

        // Desktop functionality
        const desktopContainer = /** @type {HTMLElement} */ (this.querySelector('.search-custom-desktop'));
        if (desktopContainer) {
            this.#setupDesktop();
            this.#setupResultsVisibility(desktopContainer, { closeOnMouseLeave: true });
        }
    }

    /**
     * Setup mobile search functionality
     */
    #setupMobile() {
        const trigger = this.querySelector('.search-custom-mobile__trigger');
        const searchIcon = this.querySelector('.search-custom-mobile__icon--search');
        const closeIcon = this.querySelector('.search-custom-mobile__icon--close');
        const uniqueId = this.getAttribute('data-unique-id');

        // Wait for DOM to be ready
        setTimeout(() => {
            /** @type {HTMLElement | null} */
            const panel = document.querySelector(`[data-mobile-panel="true"]#search-custom-mobile-panel-${uniqueId}`);

            if (!trigger) {
                return;
            }

            if (!panel) {
                return;
            }

            /** @type {HTMLInputElement | null} */
            const input = panel.querySelector('input[type="search"]');
            /** @type {HTMLElement | null} */
            const results = panel.querySelector('[data-search-results]');

            // Toggle panel on button click
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                // Prevent sticky header state changes during toggle
                const header = /** @type {HTMLElement & { searchToggling?: boolean }} */ (document.getElementById('header-component'));
                if (header) {
                    header.searchToggling = true;
                }

                this.#isOpen = !this.#isOpen;

                // Update panel visibility
                panel.hidden = !this.#isOpen;

                // Update aria-expanded
                trigger.setAttribute('aria-expanded', this.#isOpen ? 'true' : 'false');

                // Toggle icons
                if (searchIcon && closeIcon) {
                    /** @type {HTMLElement} */ (searchIcon).hidden = this.#isOpen;
                    /** @type {HTMLElement} */ (closeIcon).hidden = !this.#isOpen;
                }

                // Auto-focus input when opening
                if (this.#isOpen && input) {
                    setTimeout(() => input.focus(), 100);
                }

                // Clear input when closing
                if (!this.#isOpen && input) {
                    input.value = '';
                    if (results) {
                        results.hidden = true;
                    }
                }

                // Re-enable sticky header state updates after animation
                setTimeout(() => {
                    if (header) {
                        header.searchToggling = false;
                    }
                }, 400);
            });

            // Close on ESC key
            /** @param {KeyboardEvent} event */
            this.#keyDownHandler = (event) => {
                if (event.key === 'Escape' && this.#isOpen) {
                    if (trigger instanceof HTMLElement) {
                        trigger.click();
                    }
                }
            };
            document.addEventListener('keydown', this.#keyDownHandler);

            if (panel) {
                this.#setupResultsVisibility(panel);
            }

            /** @param {PointerEvent} event */
            const handleOutsidePointerDown = (event) => {
                if (!(event.target instanceof Node)) return;
                if (trigger instanceof HTMLElement && trigger.contains(event.target)) return;
                if (panel.contains(event.target)) return;
                if (!this.#isOpen) return;
                if (trigger instanceof HTMLElement) {
                    trigger.click();
                }
            };

            document.addEventListener('pointerdown', handleOutsidePointerDown, true);

            const existingCleanup = this.__searchCustomCleanup || [];
            existingCleanup.push(() => document.removeEventListener('pointerdown', handleOutsidePointerDown, true));
            this.__searchCustomCleanup = existingCleanup;
        }, 100);
    }

    /**
     * Setup desktop search functionality
     */
    #setupDesktop() {
        const desktopContainer = /** @type {HTMLElement} */ (this.querySelector('.search-custom-desktop'));
        if (!desktopContainer) return;

        /** @type {HTMLInputElement | null} */
        const input = desktopContainer.querySelector('input[type="search"]');
        /** @type {HTMLElement | null} */
        const clearButton = desktopContainer.querySelector('.search-custom-clear');

        if (!input || !clearButton) return;

        // Show/hide clear button based on input value
        const updateClearButton = () => {
            clearButton.hidden = input.value.length === 0;
        };

        // Listen to input changes
        input.addEventListener('input', updateClearButton);

        // Clear input when clicking clear button
        clearButton.addEventListener('click', () => {
            input.value = '';
            updateClearButton();
            input.focus();
        });

        // Initial state
        updateClearButton();
    }

    /**
     * @typedef {{ closeOnMouseLeave?: boolean }} ResultsVisibilityOptions
     */

    /**
     * Show results container when input has value, hide when empty.
     * @param {HTMLElement} scope
     * @param {ResultsVisibilityOptions} options
     */
    #setupResultsVisibility(scope, options = { closeOnMouseLeave: false }) {
        /** @type {HTMLInputElement | null} */
        const input = scope.querySelector('input[type="search"]');
        /** @type {HTMLElement | null} */
        const results = scope.querySelector('[data-search-results]');
        if (!input || !results) return;
        const { closeOnMouseLeave } = options;
        const shouldGateVisibility = scope.classList.contains('search-custom-desktop');

        // Desktop search delays showing the dropdown until the visitor signals intent so browser autofocus cannot open it automatically.
        /** @type {Array<() => void>} */
        const cleanupHandlers = this.__searchCustomCleanup || [];
        /**
         * Register a teardown listener so all document/window handlers are removed together.
         * @param {() => void} handler
         */
        const addCleanup = (handler) => cleanupHandlers.push(handler);

        /**
         * Track whether results should be visible so the CSS guard can stay in sync.
         * @param {boolean} visible
         */
        const setSearchVisible = (visible) => {
            if (scope instanceof HTMLElement) {
                scope.dataset.searchVisible = visible ? 'true' : 'false';
            }
        };
        const hideSearchResults = () => {
            results.hidden = true;
            setSearchVisible(false);
        };

        const allowVisibility = () => {
            this.#allowDesktopSearchVisibility = true;
        };

        /** @param {boolean} [forceShow=false] */
        const updateResultsVisibility = (forceShow = false) => {
            const shouldShow =
                forceShow ||
                document.activeElement === input ||
                input.value.trim().length > 0;

            const allowed = !shouldGateVisibility || this.#allowDesktopSearchVisibility;
            const shouldDisplay = allowed && shouldShow;

            results.hidden = !shouldDisplay;
            setSearchVisible(shouldDisplay);
        };

        hideSearchResults();

        const handleInput = () => updateResultsVisibility();
        const handleFocusIntent = () => updateResultsVisibility(true);

        input.addEventListener('input', handleInput);
        input.addEventListener('focus', handleFocusIntent);
        addCleanup(() => input.removeEventListener('input', handleInput));
        addCleanup(() => input.removeEventListener('focus', handleFocusIntent));

        const closeResults = () => {
            if (document.activeElement === input) {
                input.blur();
            }
            hideSearchResults();
        };

        const blurDesktopInput = () => {
            if (document.activeElement === input) {
                input.blur();
            }
        };

        /** @param {PointerEvent} event */
        const handlePointerDown = (event) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (scope.contains(target)) return;
            closeResults();
        };

        if (shouldGateVisibility) {
            // Block the browser from focusing the desktop search until we opt in.
            /** @param {FocusEvent} event */
            const handleDesktopInputFocus = (event) => {
                if (event.target !== input) return;
                if (this.#allowDesktopSearchVisibility) return;
                event.preventDefault();
                hideSearchResults();
                input.blur();
            };
            input.addEventListener('focus', handleDesktopInputFocus, true);
            addCleanup(() => input.removeEventListener('focus', handleDesktopInputFocus, true));

            /** @param {PointerEvent} event */
            const handleInitialPointerDown = (event) => {
                const target = event.target;
                if (!(target instanceof Node)) return;
                if (!scope.contains(target)) return;
                allowVisibility();
                document.removeEventListener('pointerdown', handleInitialPointerDown, true);
            };
            document.addEventListener('pointerdown', handleInitialPointerDown, true);
            addCleanup(() => document.removeEventListener('pointerdown', handleInitialPointerDown, true));

            /** @param {KeyboardEvent} event */
            const handleInitialKeyDown = (event) => {
                const target = event.target;
                if (target === input) {
                    allowVisibility();
                    document.removeEventListener('keydown', handleInitialKeyDown, true);
                    return;
                }
                if (target instanceof Node && scope.contains(target)) {
                    allowVisibility();
                    document.removeEventListener('keydown', handleInitialKeyDown, true);
                }
            };
            document.addEventListener('keydown', handleInitialKeyDown, true);
            addCleanup(() => document.removeEventListener('keydown', handleInitialKeyDown, true));
        }

        if (shouldGateVisibility && document.activeElement === input) {
            hideSearchResults();
            blurDesktopInput();
        }

        document.addEventListener('pointerdown', handlePointerDown, true);
        addCleanup(() => document.removeEventListener('pointerdown', handlePointerDown, true));

        // Keep focus gated after navigation events so browsers cannot reopen the dropdown automatically.
        const resetSearchVisibility = () => {
            this.#allowDesktopSearchVisibility = false;
            hideSearchResults();
            blurDesktopInput();
        };

        const handlePageShow = () => {
            resetSearchVisibility();
        };

        const handlePageHide = () => {
            resetSearchVisibility();
        };

        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('pagehide', handlePageHide);
        addCleanup(() => window.removeEventListener('pageshow', handlePageShow));
        addCleanup(() => window.removeEventListener('pagehide', handlePageHide));

        /** @type {ReturnType<typeof setTimeout> | null} */
        let closeTimer = null;
        if (closeOnMouseLeave) {
            const cancelClose = () => {
                if (closeTimer) {
                    clearTimeout(closeTimer);
                    closeTimer = null;
                }
            };

            const handleMouseLeave = () => {
                cancelClose();
                closeTimer = setTimeout(() => {
                    closeResults();
                }, 1000);
            };

            const handleMouseEnter = () => {
                cancelClose();
            };

            scope.addEventListener('mouseleave', handleMouseLeave);
            addCleanup(() => scope.removeEventListener('mouseleave', handleMouseLeave));
            scope.addEventListener('mouseenter', handleMouseEnter);
            addCleanup(() => scope.removeEventListener('mouseenter', handleMouseEnter));

            const headerMenu = document.querySelector('.header-menu');
            if (headerMenu) {
                const headerMenuMouseEnter = () => {
                    cancelClose();
                    closeResults();
                };
                headerMenu.addEventListener('mouseenter', headerMenuMouseEnter);
                addCleanup(() => headerMenu.removeEventListener('mouseenter', headerMenuMouseEnter));
            }
        }

        const resetButton = scope.querySelector('.search-custom-clear, .search-custom-reset');
        if (resetButton) {
            const handleResetClick = () => updateResultsVisibility(true);
            resetButton.addEventListener('click', handleResetClick);
            addCleanup(() => resetButton.removeEventListener('click', handleResetClick));
        }

        updateResultsVisibility();

        this.__searchCustomCleanup = cleanupHandlers;
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        if (this.#keyDownHandler) {
            document.removeEventListener('keydown', this.#keyDownHandler);
        }

        if (this.__searchCustomCleanup) {
            this.__searchCustomCleanup.forEach((cleanup) => cleanup());
            this.__searchCustomCleanup = null;
        }
    }
}

customElements.define('search-custom-component', SearchCustomComponent);

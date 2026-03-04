## Combined listing en PLP – actualización dinámica de product cards

### Contexto

- En PDP, los combined listings mantienen el comportamiento existente: switch de producto hijo con morph de `main`.
- En PLP, se necesitaba actualizar la card al producto hijo seleccionado sin redirigir a PDP y sin perder clases/estilos configurados por bloques.

### Estado actual (implementado)

En PLP combined listing **ya no se hace morph completo de `.product-card__content`**.

En su lugar, `variant-picker.js` usa un flujo de actualización parcial de fragments:

- slideshow/gallery
- badges
- swatches picker
- price container
- title (link + texto)
- zoom-out title
- SKU

Esto evita drift de markup/clases al preservar wrappers existentes de la card en el DOM actual.

### Detección de combined listing

El switch de producto se detecta con:

- `currentUrl = this.dataset.productUrl?.split('?')[0]`
- `newUrl = selectedOption.dataset.connectedProductUrl`
- combined switch cuando `newUrl` existe y `newUrl !== currentUrl` dentro de `product-card`.

Fuente de `connectedProductUrl`:

- `snippets/variant-swatches.liquid` (`data-connected-product-url="{{ product_option_value.product_url }}"`).

### Flujo técnico en `assets/variant-picker.js`

1. **`fetchUpdatedSection` robusto ante clicks rápidos**
   - `AbortController` para cancelar request anterior.
   - `#latestRequestId` para ignorar respuestas stale que lleguen tarde.

2. **Rama PLP combined (`combined-listing-product-card`)**
   - `#updateCombinedListingProductCard(html)` actualiza fragments.
   - `#syncProductCardLinksAfterMorph(html)` sincroniza links/datasets.
   - `#dispatchVariantUpdateEvent(...)` mantiene compatibilidad con listeners downstream (quick-add/product-card).

3. **Hardening adicional**
   - Parse seguro de payload JSON en `#dispatchVariantUpdateEvent` (`try/catch`).
   - Debounce en reinit de Yotpo (`YOTPO_REINIT_DEBOUNCE_MS`).
   - Narrowing de tipos (`HTMLElement` / `HTMLAnchorElement`) para estabilidad de TS.

### `#syncProductCardLinksAfterMorph` (qué sincroniza)

- `a.product-card__link` (`href`)
- `product-card[data-product-id][data-product-url]`
- `product-card-link[data-featured-media-url][data-product-id]` cuando existe

### `#updateCombinedListingProductCard` (qué sincroniza)

- `cardGalleryLink.href`
- `slideshow-component`
- `.product-badges` (incluye manejo de add/remove)
- `swatches-variant-picker-component` + refresh de `this.dataset.productId/productUrl`
- `product-price [ref='priceContainer']`
- `productTitleLink.href` + texto de título
- `.product-grid-view-zoom-out--details .h4`
- `product-sku-component`
- Yotpo (`data-yotpo-product-id` + reinit)

### Cambios en `section-rendering-product-card.liquid`

La sección ahora está documentada como **fuente de fragments** para JS, no como reemplazo completo de card.

Puntos clave:

- Mantiene estructura base para sync de links/datasets.
- Mantiene estilos base de wrapper (border/layout/spacing/gap + variables quick-add/zoom-out).
- Badge stack alineado con la card real:
  - badge sale/sold out
  - badge de metafield (`drmartens.label_text`, `label_background`, `label_color`)
- Render de gallery con `product_resource` + `block_settings_source`.

### Cambios en `snippets/card-gallery.liquid`

Soporte explícito para Section Rendering API:

- `product_resource`
- `block_settings_source`

Permite reutilizar gallery en contexto sin `block`.

### Riesgos/consideraciones para futuros cambios

- No renombrar sin coordinar:
  - `.product-card__link`
  - refs usados por JS (`cardGalleryLink`, `productTitleLink`, `priceContainer`)
  - datasets (`data-product-id`, `data-product-url`)
- Si se cambia markup de apps dentro de card (ej. reviews), validar sync en combined flow.
- Si se agrega nuevo fragmento dinámico en card, incorporarlo en `#updateCombinedListingProductCard`.

### QA recomendado

- PLP combined: alternar colores A↔B↔C rápido y verificar:
  - imagen, título, precio, badges, SKU
  - hrefs y datasets
  - add-to-cart con variante correcta
- Badge custom metafield + sale/sold out
- Productos sin combined (no regresión)
- PDP combined (morph de `main` intacto)
- Cards con Yotpo (reinit correcto al cambiar hijo)

## Combined listing en PLP – actualización dinámica de product cards

### Contexto

- En PDP ya existía soporte para **combined listings**: al cambiar de producto hijo (por ejemplo, otro color) el `variant-picker` pedía la sección completa y hacía morph de `main`.
- En PLP, al cambiar de variante combinada en la **product card** solo se actualizaba la imagen principal; el resto de la información del producto (nombre, precios, badges, SKU, etc.) quedaba desfasada respecto al producto hijo seleccionado.

### Objetivo funcional

Cuando el usuario interactúa con los swatches de combined listing en una product card de la PLP:

- **No se navega a la PDP**: la tarjeta permanece en la grilla.
- Se actualiza de forma consistente la información de la card al producto hijo seleccionado:
  - **Imagen principal / gallery** (ya existía).
  - **Nombre de producto** mostrado en la card.
  - **Precio** y **compare at price** (incluyendo badges de oferta).
  - **Badges de producto** (por ejemplo, `Sold out`, `Sale`).
  - **SKU** cuando aplica.
- Se actualizan también los **links y metadatos** asociados a la card:
  - `href` del enlace principal de la card.
  - `data-product-id` y `data-product-url` del `product-card`.
  - `data-featured-media-url` y `data-product-id` del `product-card-link` padre (cuando existe).

El comportamiento en PDP se mantiene: para combined listings en PDP se sigue haciendo morph de `main`.

### Flujo funcional (PLP)

1. El usuario selecciona un swatch/variant dentro de una **product card** que usa combined listings.
2. El `variant-picker` detecta que:
   - Está dentro de un `product-card` (PLP).
   - El `connectedProductUrl` de la opción seleccionada es diferente al `productUrl` actual.
3. En ese caso:
   - Se llama a la Section Rendering API para `section-rendering-product-card`.
   - Se hace **morph de `.product-card__content`** con la respuesta del servidor.
4. Tras el morph:
   - Se sincronizan los enlaces y `data-*` del `product-card` y su `product-card-link` padre para que apunten al producto hijo actual.

### Archivos involucrados

- `assets/variant-picker.js`
  - Detecta cuándo un cambio de variante en PLP corresponde a un **switch de producto** dentro de una combined listing.
  - Decide si debe hacer morph de `main` (PDP), de `featured-product-information` o de `.product-card__content` (PLP).
  - Después del morph de `.product-card__content` llama a una rutina de sincronización de links/datos de la card.

- `sections/section-rendering-product-card.liquid`
  - Define el HTML que se usa como **origen** para el morph de `.product-card__content`.
  - Agrega atributos `data-product-id` y `data-product-url` al `product-card` para que puedan sincronizarse tras el morph.
  - Estructura la card para que:
    - Exista un anchor principal `a.product-card__link` (link clickable a PDP).
    - Todo el contenido variable (gallery, swatches, título, precio, badges, SKU) esté dentro de `.product-card__content`.
  - Incluye badges de producto (`Sold out` / `Sale`) y elementos de título/precio/SKU pensados para ser refrescados con cada producto hijo.

- `snippets/card-gallery.liquid`
  - Permite renderizar la gallery en contexto de Section Rendering API:
    - Nuevo parámetro `product_resource` (producto cuando no hay `closest.product`).
    - Nuevo parámetro `block_settings_source` (section o block “fuente” de settings cuando no se dispone de `block`).
  - Ajusta clases y atributos cuando se renderiza fuera de un bloque (por ejemplo, usa `card-gallery-section-render` y omite `block.shopify_attributes`).

### Casos a validar (QA)

- **PLP – combined listing:**
  - Cambiar de color/variante combinada actualiza imagen, título, precio, compare at price, badges y SKU en la misma card.
  - El enlace de la card lleva a la PDP del **producto hijo** seleccionado.
  - Si el producto hijo está `sold_out` o `on_sale`, los badges se actualizan correctamente.
- **PLP – productos sin combined listing:**
  - El comportamiento de selección de variantes permanece igual, sin morph de `.product-card__content`.
- **PDP – combined listing:**
  - Se mantiene la lógica existente: cambio de producto hijo hace morph de `main` según lo esperado.


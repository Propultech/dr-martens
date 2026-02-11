# Horizon

[Getting started](#getting-started) |
[Staying up to date with Horizon changes](#staying-up-to-date-with-horizon-changes) |
[Developer tools](#developer-tools) |
[Development standards and documentation](#development-standards-and-documentation) |
[Contributing](#contributing) |
[License](#license)

Horizon is the flagship of a new generation of first party Shopify themes. It incorporates the latest Liquid Storefronts features, including [theme blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/quick-start?framework=liquid).

- **Web-native in its purest form:** Themes run on the [evergreen web](https://www.w3.org/2001/tag/doc/evergreen-web/). We leverage the latest web browsers to their fullest, while maintaining support for the older ones through progressive enhancement—not polyfills.
- **Lean, fast, and reliable:** Functionality and design defaults to “no” until it meets this requirement. Code ships on quality. Themes must be built with purpose. They shouldn’t support each and every feature in Shopify.
- **Server-rendered:** HTML must be rendered by Shopify servers using Liquid. Business logic and platform primitives such as translations and money formatting don’t belong on the client. Async and on-demand rendering of parts of the page is OK, but we do it sparingly as a progressive enhancement.
- **Functional, not pixel-perfect:** The Web doesn’t require each page to be rendered pixel-perfect by each browser engine. Using semantic markup, progressive enhancement, and clever design, we ensure that themes remain functional regardless of the browser.

## Getting started

We recommend using the Skeleton Theme as a starting point for a theme development project. [Learn more on Shopify.dev](https://shopify.dev/themes/getting-started/create).

To create a new theme project based on Horizon:

```sh
git clone https://github.com/Shopify/horizon.git
```

Install the [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli) to connect your local project to a Shopify store. Learn about the [theme developer tools](https://shopify.dev/docs/storefronts/themes/tools) available, and the suggested [developer tools](#developer-tools) below.

Please note that the `main` branch may include code for features not yet released. You may encounter Liquid API properties that are not publicly documented, but will be when the feature is officially rolled out.

### Shopify Theme Store development

If you're building a theme for the Shopify Theme Store, then do not use Horizon as a starting point. Themes based on, derived from, or incorporating Horizon are not eligible for submission to to the Shopify Theme Store. Use the [Skeleton Theme](https://github.com/Shopify/skeleton-theme) instead.

## Staying up to date with Horizon changes

Say you're building a new theme off Horizon but you still want to be able to pull in the latest changes, you can add a remote `upstream` pointing to this Horizon repository.

1. Navigate to your local theme folder.
2. Verify the list of remotes and validate that you have both an `origin` and `upstream`:

```sh
git remote -v
```

3. If you don't see an `upstream`, you can add one that points to Shopify's Horizon repository:

```sh
git remote add upstream https://github.com/Shopify/horizon.git
```

4. Pull in the latest Horizon changes into your repository:

```sh
git fetch upstream
git pull upstream main
```

## Developer tools

There are a number of really useful tools that the Shopify Themes team uses during development. Horizon is already set up to work with these tools.

### Shopify CLI

[Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli) helps you build Shopify themes faster and is used to automate and enhance your local development workflow. It comes bundled with a suite of commands for developing Shopify themes—everything from working with themes on a Shopify store (e.g. creating, publishing, deleting themes) or launching a development server for local theme development.

You can follow this [quick start guide for theme developers](https://shopify.dev/docs/themes/tools/cli) to get started.

### Theme Check

We recommend using [Theme Check](https://github.com/shopify/theme-check) as a way to validate and lint your Shopify themes.

We've added Theme Check to Horizon's [list of VS Code extensions](/.vscode/extensions.json) so if you're using Visual Studio Code as your code editor of choice, you'll be prompted to install the [Theme Check VS Code](https://marketplace.visualstudio.com/items?itemName=Shopify.theme-check-vscode) extension upon opening VS Code after you've forked and cloned Horizon.

You can also run it from a terminal with the following Shopify CLI command:

```bash
shopify theme check
```

You can follow the [theme check documentation](https://shopify.dev/docs/storefronts/themes/tools/theme-check) for more details.

#### Shopify/theme-check-action

Horizon runs [Theme Check](#theme-check) on every commit via [Shopify/theme-check-action](https://github.com/Shopify/theme-check-action).

## Development standards and documentation

Todos los desarrollos nuevos en este theme deben documentarse aquí y en las Cursor rules para mantener el contexto en el tiempo.

### Documentación de cada desarrollo

- **README:** Registrar en la sección [Changelog / Desarrollos](#changelog--desarrollos) qué se implementó, en qué archivos y cualquier decisión relevante.
- **Cursor rules:** Si un desarrollo introduce patrones o convenciones que deban respetarse después, crear o actualizar reglas en `.cursor/rules/` (o en `.cursor/prompts/` / `.cursor/references/`). No esperar a que lo pida alguien; es parte de cerrar el desarrollo.

### Requisitos de calidad

Cada desarrollo debe cumplir:

1. **Buenas prácticas y mantenibilidad:** Código limpio, DRY/KISS, respeto a las reglas del theme (Liquid, sections, blocks, snippets). Sin `console.log` innecesarios ni TODOs vagos.
2. **Performance (Shopify):** Liquid eficiente, JavaScript como mejora progresiva, imágenes con `loading="lazy"` y tamaños adecuados, CSS y recursos solo donde se necesiten. Ver [Shopify – Performance best practices](https://shopify.dev/docs/storefronts/themes/best-practices/performance).
3. **Core Web Vitals:** Cuidar LCP (≤2,5 s), INP/FID (JS no bloqueante) y CLS (dimensiones de imágenes y fuentes, evitar desplazamientos de layout).
4. **Accesibilidad:** Cumplir con las reglas de accesibilidad del proyecto (headings, landmarks, contraste, imágenes/alt, formularios, foco y teclado, etc.). Ver las reglas en `.cursor/rules/*-accessibility.mdc` y `global-accessibility-standards.mdc`.

La regla detallada para el equipo y para agentes de IA es [.cursor/rules/development-standards.mdc](.cursor/rules/development-standards.mdc).

### Changelog / Desarrollos

_Registrar aquí cada desarrollo significativo: fecha, descripción breve, archivos principales y, si aplica, enlace a regla o referencia._

| Fecha       | Desarrollo | Archivos / Notas |
|------------|------------|------------------|
| 2025-02-11 | Combined Listings en PLP: al cambiar color (producto hijo) en la grilla se actualizan sin redirigir imagen, precio y precio tachado. Se amplió `section-rendering-product-card` con card-gallery y se ajusta el morph para reemplazar `product-card__content` cuando es combined listing. El filtro por color (mostrar hijo en vez de padre) no es factible desde el theme. | sections/section-rendering-product-card.liquid, snippets/card-gallery.liquid, assets/variant-picker.js |
| 2025-02-03 | Estándares de desarrollo: documentación en README, Cursor rule `development-standards.mdc` (buenas prácticas, performance Shopify, Core Web Vitals, accesibilidad). | README.md, .cursor/rules/development-standards.mdc |

## Contributing

We are not accepting contributions to Horizon at this time.

## License

Copyright (c) 2025-present Shopify Inc. See [LICENSE](/LICENSE.md) for further details.

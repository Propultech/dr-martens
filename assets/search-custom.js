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
    /** @type {((event: KeyboardEvent) => void) | null} */
    #keyDownHandler = null;

    connectedCallback() {
        super.connectedCallback();

        // Mobile functionality
        const mobileTrigger = this.querySelector('.search-custom-mobile__trigger');
        if (mobileTrigger) {
            this.#setupMobile();
        }

        // Desktop functionality
        const desktopContainer = this.querySelector('.search-custom-desktop');
        if (desktopContainer) {
            this.#setupDesktop();
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
                    /** @type {HTMLElement} */ (trigger).click(); // Trigger close
                }
            };
            document.addEventListener('keydown', this.#keyDownHandler);
        }, 100);
    }

    /**
     * Setup desktop search functionality
     */
    #setupDesktop() {
        const desktopContainer = this.querySelector('.search-custom-desktop');
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

    disconnectedCallback() {
        super.disconnectedCallback();

        if (this.#keyDownHandler) {
            document.removeEventListener('keydown', this.#keyDownHandler);
        }
    }
}

customElements.define('search-custom-component', SearchCustomComponent);

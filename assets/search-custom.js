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

        /** @param {boolean} [forceShow=false] */
        const updateResultsVisibility = (forceShow = false) => {
            if (forceShow) {
                results.hidden = false;
                return;
            }

            if (document.activeElement === input) {
                results.hidden = false;
                return;
            }

            results.hidden = input.value.trim().length === 0;
        };

        const handleInput = () => updateResultsVisibility();

        input.addEventListener('input', handleInput);
        input.addEventListener('focus', () => updateResultsVisibility(true));

        const closeResults = () => {
            results.hidden = true;
            if (document.activeElement === input) {
                input.blur();
            }
        };

        /** @param {PointerEvent} event */
        const handlePointerDown = (event) => {
            if (!(event.target instanceof Node)) return;
            if (scope.contains(event.target)) return;
            closeResults();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);

        let handleMouseLeave;
        let handleMouseEnter;
        /** @type {ReturnType<typeof setTimeout> | null} */
        let closeTimer = null;
        let headerMenu;
        let headerMenuMouseEnter;
        if (closeOnMouseLeave) {
            const cancelClose = () => {
                if (closeTimer) {
                    clearTimeout(closeTimer);
                    closeTimer = null;
                }
            };

            handleMouseLeave = () => {
                cancelClose();
                closeTimer = setTimeout(() => {
                    closeResults();
                }, 1000);
            };

            handleMouseEnter = () => {
                cancelClose();
            };

            scope.addEventListener('mouseleave', handleMouseLeave);
            scope.addEventListener('mouseenter', handleMouseEnter);

            headerMenu = document.querySelector('.header-menu');
            if (headerMenu) {
                headerMenuMouseEnter = () => {
                    cancelClose();
                    closeResults();
                };
                headerMenu.addEventListener('mouseenter', headerMenuMouseEnter);
            }
        }

        const resetButton = scope.querySelector('.search-custom-clear, .search-custom-reset');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                updateResultsVisibility(true);
            });
        }

        updateResultsVisibility();

        const existingCleanup = this.__searchCustomCleanup || [];
        existingCleanup.push(() => document.removeEventListener('pointerdown', handlePointerDown, true));
        if (handleMouseLeave) {
            existingCleanup.push(() => scope.removeEventListener('mouseleave', handleMouseLeave));
        }
        if (handleMouseEnter) {
            existingCleanup.push(() => scope.removeEventListener('mouseenter', handleMouseEnter));
        }
        if (headerMenu && headerMenuMouseEnter) {
            existingCleanup.push(() => headerMenu.removeEventListener('mouseenter', headerMenuMouseEnter));
        }
        this.__searchCustomCleanup = existingCleanup;
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

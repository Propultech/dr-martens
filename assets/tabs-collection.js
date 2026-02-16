(function () {
    /**
     * @typedef {HTMLElement & { _tcHandlers?: { onClick: (e: MouseEvent) => void, onKeydown: (e: KeyboardEvent) => void } }} TabsRoot
     */

    /**
     * @param {TabsRoot} root
     */
    function initTabs(root) {
        if (!root || root.dataset.tcInit === '1') return;

        var tablist = root.querySelector('.tc-tablist');
        var panelsContainer = root.querySelector('.tc-panels');
        if (!tablist || !panelsContainer) return;

        function buildTabsIfMissing() {
            var list = /** @type {HTMLElement} */ (tablist);
            if (list.children.length > 0) return;

            var seeds = root.querySelectorAll('.tc-tab-seed');
            if (!seeds.length) return;

            seeds.forEach(/** @param {Element} seed */ function (seed) {
                var id = seed.getAttribute('data-tab-id') || '';
                var panelId = seed.getAttribute('data-panel-id') || '';
                var label = seed.getAttribute('data-label') || 'Tab';
                var isActive = seed.getAttribute('data-active') === '1';

                var btn = document.createElement('button');
                btn.id = id;
                btn.className = 'tc-tab' + (isActive ? ' is-active' : '');
                btn.setAttribute('role', 'tab');
                btn.setAttribute('aria-controls', panelId);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                btn.setAttribute('tabindex', isActive ? '0' : '-1');
                btn.textContent = label;

                list.appendChild(btn);
            });
        }

        buildTabsIfMissing();

        /** @returns {NodeListOf<HTMLElement>} */
        function getTabs() {
            return root.querySelectorAll('.tc-tab');
        }

        /** @returns {NodeListOf<HTMLElement>} */
        function getPanels() {
            return root.querySelectorAll('.tc-panel');
        }

        /**
         * @param {string} id
         */
        function activate(id) {
            var tabs = getTabs();
            var panels = getPanels();
            if (!tabs.length || !panels.length) return;

            tabs.forEach(/** @param {HTMLElement} t */ function (t) {
                var on = t.id === id;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.setAttribute('tabindex', on ? '0' : '-1');
            });

            panels.forEach(/** @param {HTMLElement} p */ function (p) {
                var on = (p.getAttribute('aria-labelledby') || '') === id;
                p.classList.toggle('is-active', on);
            });
            window.dispatchEvent(new Event('resize'));
        }

        /**
         * @param {MouseEvent} e
         */
        function onClick(e) {
            var target = /** @type {HTMLElement} */ (e.target);
            var btn = target && target.closest ? target.closest('.tc-tab') : null;
            if (!btn) return;
            activate(btn.id);
        }

        /**
         * @param {KeyboardEvent} e
         */
        function onKeydown(e) {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            var tabs = Array.prototype.slice.call(getTabs());
            var current = document.activeElement;
            var i = tabs.indexOf(current);
            if (i === -1) return;
            e.preventDefault();
            var n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length;
            tabs[n].focus();
            activate(tabs[n].id);
        }

        tablist.addEventListener('click', onClick);
        tablist.addEventListener('keydown', onKeydown);

        (function ensureInitialActive() {
            var current = root.querySelector('.tc-tab.is-active') || getTabs()[0] || null;
            if (current) activate(current.id);
        })();

        root._tcHandlers = { onClick: onClick, onKeydown: onKeydown };
        root.dataset.tcInit = '1';
    }

    /**
     * @param {TabsRoot} root
     */
    function destroyTabs(root) {
        if (!root) return;
        var tablist = root.querySelector('.tc-tablist');
        var handlers = root._tcHandlers;
        if (tablist && handlers) {
            tablist.removeEventListener('click', handlers.onClick);
            tablist.removeEventListener('keydown', handlers.onKeydown);
        }
        root.querySelectorAll('.tc-tab.is-active').forEach(/** @param {Element} t */ function (t) { t.classList.remove('is-active'); });
        root.querySelectorAll('.tc-panel.is-active').forEach(/** @param {Element} p */ function (p) { p.classList.remove('is-active'); });
        delete root._tcHandlers;
        delete root.dataset.tcInit;
    }

    function boot() {
        document.querySelectorAll('.tabs-collections').forEach(initTabs);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    document.addEventListener('shopify:section:load', function (e) {
        var tgt = /** @type {Element} */ (e.target);
        if (!tgt) return;
        tgt.querySelectorAll('.tabs-collections').forEach(initTabs);
    });

    document.addEventListener('shopify:section:unload', function (e) {
        var tgt = /** @type {Element} */ (e.target);
        if (!tgt) return;
        tgt.querySelectorAll('.tabs-collections').forEach(destroyTabs);
    });
})();

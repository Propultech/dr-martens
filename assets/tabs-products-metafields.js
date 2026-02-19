(function () {
  /**
   * @typedef {HTMLElement & { _tpHandlers?: { onClick: (e: MouseEvent) => void, onKeydown: (e: KeyboardEvent) => void }, _tpObserver?: MutationObserver }} TabsRoot
   */

  /**
   * @param {TabsRoot} root
   */
  function initTabs(root) {
    if (!root || root.dataset.tpInit === '1') return;

    var tablist = root.querySelector('.tp-tablist');
    var panelsContainer = root.querySelector('.tp-panels');
    if (!tablist || !panelsContainer) return;

    function buildTabsIfMissing() {
      var list = /** @type {HTMLElement} */ (tablist);
      if (list.children.length > 0) return;

      var seeds = root.querySelectorAll('.tp-tab-seed');
      if (!seeds.length) return;

      seeds.forEach(/** @param {Element} seed */ function (seed) {
        var id = seed.getAttribute('data-tab-id') || '';
        var panelId = seed.getAttribute('data-panel-id') || '';
        var label = seed.getAttribute('data-label') || 'Tab';
        var isActive = seed.getAttribute('data-active') === '1';

        var btn = document.createElement('button');
        btn.id = id;
        btn.className = 'tp-tab' + (isActive ? ' is-active' : '');
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
      return root.querySelectorAll('.tp-tab');
    }

    /** @returns {NodeListOf<HTMLElement>} */
    function getPanels() {
      return root.querySelectorAll('.tp-panel');
    }

    /**
     * @param {HTMLElement} panel
     * @returns {boolean}
     */
    function isPanelEmpty(panel) {
      var recommendations = panel.querySelector('.tp-recommendations');
      if (recommendations) {
        if (recommendations.classList.contains('hidden') || recommendations.getAttribute('data-error')) {
          return true;
        }
        if (recommendations.getAttribute('data-recommendations-performed') === 'true') {
          return panel.querySelectorAll('.resource-list__item').length === 0;
        }
        return false;
      }

      return panel.querySelectorAll('.resource-list__item').length === 0;
    }

    function pruneEmptyTabs() {
      var panels = Array.prototype.slice.call(getPanels());
      panels.forEach(/** @param {HTMLElement} panel */ function (panel) {
        if (!isPanelEmpty(panel)) return;

        var tabId = panel.getAttribute('aria-labelledby');
        if (tabId) {
          var tab = root.querySelector('[id="' + tabId + '"]');
          if (tab) tab.remove();
        }
        panel.remove();
      });

      var tabs = getTabs();
      if (!tabs.length) {
        root.style.display = 'none';
        return;
      }
      root.style.removeProperty('display');

      var active = root.querySelector('.tp-tab.is-active');
      if (!active) {
        activate(tabs[0].id);
      }
    }

    /**
     * @param {string} id
     */
    function activate(id) {
      var tabs = getTabs();
      var panels = getPanels();
      if (!tabs.length || !panels.length) return;

      tabs.forEach(/** @param {HTMLElement} tab */ function (tab) {
        var on = tab.id === id;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.setAttribute('tabindex', on ? '0' : '-1');
      });

      panels.forEach(/** @param {HTMLElement} panel */ function (panel) {
        var on = (panel.getAttribute('aria-labelledby') || '') === id;
        panel.classList.toggle('is-active', on);
      });

      window.dispatchEvent(new Event('resize'));
    }

    /**
     * @param {MouseEvent} e
     */
    function onClick(e) {
      var target = /** @type {HTMLElement} */ (e.target);
      var btn = target && target.closest ? target.closest('.tp-tab') : null;
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
      pruneEmptyTabs();
      var current = root.querySelector('.tp-tab.is-active') || getTabs()[0] || null;
      if (current) activate(current.id);
    })();

    var observer = new MutationObserver(function () {
      pruneEmptyTabs();
    });
    observer.observe(panelsContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-error', 'data-recommendations-performed'],
    });

    root._tpHandlers = { onClick: onClick, onKeydown: onKeydown };
    root._tpObserver = observer;
    root.dataset.tpInit = '1';
  }

  /**
   * @param {TabsRoot} root
   */
  function destroyTabs(root) {
    if (!root) return;
    var tablist = root.querySelector('.tp-tablist');
    var handlers = root._tpHandlers;
    if (tablist && handlers) {
      tablist.removeEventListener('click', handlers.onClick);
      tablist.removeEventListener('keydown', handlers.onKeydown);
    }
    if (root._tpObserver) {
      root._tpObserver.disconnect();
    }
    delete root._tpHandlers;
    delete root._tpObserver;
    delete root.dataset.tpInit;
  }

  function boot() {
    document.querySelectorAll('.tabs-products-metafields').forEach(initTabs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var target = /** @type {Element} */ (e.target);
    if (!target) return;
    target.querySelectorAll('.tabs-products-metafields').forEach(initTabs);
  });

  document.addEventListener('shopify:section:unload', function (e) {
    var target = /** @type {Element} */ (e.target);
    if (!target) return;
    target.querySelectorAll('.tabs-products-metafields').forEach(destroyTabs);
  });
})();

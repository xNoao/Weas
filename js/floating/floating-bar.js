/* Mudae Organizer Rebuild floating bar.
   Owns the floating action bar, floating search input and bar position.
*/
(function(){
  'use strict';

  if (window.MudaeFloatingBar) return;

  const POSITION_KEY = 'mudae_rebuild_floating_bar_position_v1';
  const SEARCH_SCROLL_THRESHOLD = 340;

  let floatingScrollRaf = 0;
  let floatingLastScrollY = -1;
  let dragBound = false;
  let floatingSessionPosition = null;

  const utils = () => window.MudaeFloatingUtils || {};

  function api(){
    return window.MUDAE_REBUILD_V1 || null;
  }

  function state(){
    return api()?.app || null;
  }

  function els(){
    return api()?.els || {};
  }

  function getEl(name){
    return els()[name] || document.getElementById(name);
  }

  function isPagePassive(){
    return !!document.hidden || !!document.documentElement.classList.contains('mhp-hibernating');
  }

  function scheduleFloatingScrollUpdate(fn, options = {}){
    if (isPagePassive() && !options.force) return;
    if (floatingScrollRaf) return;

    floatingScrollRaf = requestAnimationFrame(() => {
      floatingScrollRaf = 0;
      if (isPagePassive() && !options.force) return;

      const y = utils().getScrollTop?.() ?? (window.scrollY || document.documentElement.scrollTop || 0);
      if (!options.force && Math.abs(y - floatingLastScrollY) < 8) return;
      floatingLastScrollY = y;
      fn();
    });
  }

  function isContextualActionActive(){
    const bridge = api();
    const appState = state();
    const multiEnabled = !!bridge?.getMultiSelectMode?.();
    const selectedCount = appState?.multiSelectedIds?.size || 0;
    const targetMode = !!appState?.multiMoveTargetMode;
    return multiEnabled || selectedCount > 0 || targetMode;
  }

  function getActiveSearchValue(){
    const app = state();
    const input = getEl('floatingSearchInput');
    return String(app?.filter?.q ?? input?.value ?? '').trim();
  }

  function shouldShowFloatingSearch(){
    return utils().shouldShowFloatingSearch?.({
      query: getActiveSearchValue(),
      threshold: SEARCH_SCROLL_THRESHOLD,
      mainSearch: document.getElementById('searchInput')
    }) ?? !!getActiveSearchValue();
  }

  function syncFloatingInputValue(value){
    const input = getEl('floatingSearchInput');
    if (!input) return;

    const next = String(value || '');
    const current = input.value || '';

    // Do not fight the user while they are actively editing the floating search.
    // This also prevents scroll-driven visibility updates from wiping a live query.
    if (document.activeElement === input && current.trim() && !next.trim()) return;

    if (current.trim().toLowerCase() !== next.trim().toLowerCase()) {
      input.value = next;
    }
  }

  function syncVisibility(){
    const bar = getEl('floatingBar');
    const input = getEl('floatingSearchInput');
    const clearBtn = getEl('floatingClearSearchBtn');

    if (!bar || !input) return;

    const searchBox = bar.querySelector('.mhp-floating-search, .floating-search-box');
    const value = getActiveSearchValue();
    const contextualActive = isContextualActionActive();
    const searchVisible = shouldShowFloatingSearch();
    const shouldMountSearch = searchVisible || !!value;

    syncFloatingInputValue(value);

    bar.hidden = false;
    bar.classList.add('is-floating-active');
    bar.classList.remove('is-floating-inactive', 'is-hidden-by-main-search');
    bar.classList.toggle('is-search-active', !!value);
    bar.classList.toggle('is-floating-search-visible', shouldMountSearch);
    bar.classList.toggle('is-contextual-active', contextualActive);

    if (searchBox) {
      searchBox.hidden = !shouldMountSearch;
      searchBox.classList.toggle('is-hidden', !shouldMountSearch);
      searchBox.setAttribute('aria-hidden', shouldMountSearch ? 'false' : 'true');
      if ('inert' in searchBox) searchBox.inert = !shouldMountSearch;
    }

    input.classList.toggle('is-floating-active', shouldMountSearch);
    input.classList.toggle('is-floating-inactive', !shouldMountSearch);
    input.setAttribute('aria-hidden', shouldMountSearch ? 'false' : 'true');
    input.tabIndex = shouldMountSearch ? 0 : -1;

    if (!shouldMountSearch && document.activeElement === input) {
      input.blur();
    }

    document.body.classList.toggle('floating-contextual-active', contextualActive);
    document.body.classList.toggle('floating-search-active', shouldMountSearch);

    if (clearBtn) {
      clearBtn.hidden = !value;
      clearBtn.setAttribute('aria-hidden', value ? 'false' : 'true');
      clearBtn.tabIndex = value ? 0 : -1;
    }
  }

  function queueRender(){
    const app = state();
    const bridge = api();
    if (!app || !bridge?.renderBoard) return;

    if (app.searchTimer) clearTimeout(app.searchTimer);
    app.searchTimer = setTimeout(() => {
      app.searchTimer = null;
      bridge.renderBoard();
    }, 120);
  }

  function dispatchSearchFromFloating(value, options = {}){
    if (window.__mhpFloatingSearchProgrammaticClear) return;

    const rawValue = String(value || '');
    const scrollBeforeSync = utils().getScrollTop?.() ?? (window.scrollY || document.documentElement.scrollTop || 0);
    const main = document.getElementById('searchInput');
    const floating = document.getElementById('floatingSearchInput');
    const bridge = api();
    const activeSearch = String(state()?.filter?.q || '').trim();
    const hadSearch = !!activeSearch;
    const isFocused = document.activeElement === floating;
    const inputEvent = options.event || null;

    // v2.283:
    // When scrolling, the floating search can become visible and sync while the
    // main search leaves the viewport. In Firefox/edge cases this may produce an
    // empty input event that clears an active search. Only allow an empty value to
    // clear if the floating input is actually focused by the user.
    if (!rawValue.trim() && hadSearch && !isFocused) {
      if (floating) floating.value = activeSearch;
      syncFloatingInputValue(activeSearch);
      return;
    }

    if (floating && floating.value !== rawValue) {
      floating.value = rawValue;
    }

    // Manual deletion in the floating search should use the same clear path as
    // the floating clear button, otherwise the main input handler becomes the
    // owner of the clear action and focus can jump back to the top search.
    if (!rawValue.trim() && hadSearch && typeof bridge?.clearSearchText === 'function') {
      bridge.clearSearchText({
        focus: true,
        focusTarget: floating || main
      });
      syncVisibility();
      return;
    }

    if (!main) {
      bridge?.setUnifiedSearchValue?.(rawValue, { updateFloating: false });
      queueRender();
      return;
    }

    window.__mhpFloatingSearchSyncingInput = true;

    if (main.value !== rawValue) main.value = rawValue;
    main.dispatchEvent(new Event('input', { bubbles: true }));

    requestAnimationFrame(() => {
      if (!window.__mhpFloatingSearchEnterRequested) window.scrollTo({ top: scrollBeforeSync, behavior: 'auto' });
    });
    requestAnimationFrame(() => {
      if (!window.__mhpFloatingSearchEnterRequested) window.scrollTo({ top: scrollBeforeSync, behavior: 'auto' });
    });

    setTimeout(() => { window.__mhpFloatingSearchSyncingInput = false; }, 0);
  }

  function clear(options = {}){
    const app = state();
    const bridge = api();
    const input = getEl('floatingSearchInput');
    const hadSearch = !!app?.filter?.q;

    if (options.render !== false && hadSearch && typeof bridge?.clearSearchText === 'function') {
      bridge.clearSearchText({
        focus: options.focus,
        focusTarget: input
      });
      syncVisibility();
      return;
    }

    if (typeof bridge?.setUnifiedSearchValue === 'function') {
      bridge.setUnifiedSearchValue('', { updateFloating: true });
    } else if (app?.filter) {
      app.filter.q = '';
      app.filter.floatingQ = '';
      if (input) input.value = '';
    }

    syncVisibility();

    if (options.render !== false) bridge?.renderBoard?.();
    if (options.focus !== false && input) input.focus({ preventScroll: true });
  }

  function syncActionButtons(){
    const multi = getEl('floatingMultiSelectBtn');
    const moveSelected = getEl('floatingMoveSelectedBtn');
    const createGroup = getEl('floatingCreateGroupBtn');
    const clearSelected = getEl('floatingClearMultiSelectBtn');
    const addDivider = getEl('floatingAddDividerBtn');
    const addSub = getEl('floatingAddSubDividerBtn');
    const bridge = api();
    const appState = state();
    const enabled = !!bridge?.getMultiSelectMode?.();
    const count = appState?.multiSelectedIds?.size || 0;
    const targetMode = !!appState?.multiMoveTargetMode;

    if (multi) {
      multi.classList.toggle('is-active', enabled);
      multi.textContent = enabled ? `Multi-Select ✓ / ${count} selected` : 'Multi-Select';
      multi.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      multi.hidden = typeof bridge?.toggleMultiSelectMode !== 'function';
      multi.title = enabled ? 'Exit multi-select' : 'Toggle multi-select';
    }

    if (moveSelected) {
      moveSelected.hidden = !enabled;
      moveSelected.disabled = !count;
      moveSelected.classList.toggle('is-active', targetMode);
      moveSelected.textContent = targetMode ? 'Click destination...' : 'Move selected';
    }

    if (createGroup) {
      const groupAction = bridge?.getSelectedGroupAction?.();
      createGroup.hidden = !enabled;
      createGroup.disabled = count < 2 || !!groupAction?.disabled;
      createGroup.textContent = groupAction?.label || 'Create Group';
      createGroup.classList.toggle('is-remove-group-action', !!groupAction && (groupAction.type === 'remove-group' || groupAction.type === 'remove-selected'));
      createGroup.classList.toggle('is-add-group-action', !!groupAction && groupAction.type === 'add-to-group');
      createGroup.title = groupAction?.disabled ? 'Select a full single group, or ungrouped characters only.' : 'Create, remove, or add to a group from selected cards';
    }

    if (clearSelected) {
      clearSelected.hidden = !enabled;
      clearSelected.disabled = !count && !targetMode;
    }

    if (addDivider) {
      addDivider.hidden = enabled || typeof bridge?.addBoardDivider !== 'function';
    }

    if (addSub) {
      addSub.hidden = enabled || typeof bridge?.addBoardSubDivider !== 'function';
    }
  }

  function bindOnce(element, key, handler, options){
    if (!element || element.dataset[key]) return;
    element.dataset[key] = 'true';
    element.addEventListener('click', handler, options);
  }

  function bindActionButtons(){
    bindOnce(getEl('floatingMultiSelectBtn'), 'bound', () => {
      api()?.toggleMultiSelectMode?.();
      syncActionButtons();
      syncVisibility();
    });

    bindOnce(getEl('floatingMoveSelectedBtn'), 'bound', () => {
      api()?.setMultiMoveTargetMode?.();
      syncActionButtons();
      syncVisibility();
    });

    bindOnce(getEl('floatingCreateGroupBtn'), 'bound', () => {
      api()?.createGroupFromSelection?.();
      syncActionButtons();
      syncVisibility();
    });

    bindOnce(getEl('floatingClearMultiSelectBtn'), 'bound', () => {
      api()?.clearMultiSelection?.();
      syncActionButtons();
      syncVisibility();
    });

    bindOnce(getEl('floatingAddDividerBtn'), 'bound', () => api()?.addBoardDivider?.());
    bindOnce(getEl('floatingAddSubDividerBtn'), 'bound', () => api()?.addBoardSubDivider?.());

    if (!window.__mudaeFloatingActionSyncBound) {
      window.__mudaeFloatingActionSyncBound = true;
      window.addEventListener('mudae:multi-select-change', () => {
        syncActionButtons();
        syncVisibility();
      });
    }
  }

  function focusPreferred(){
    const bar = getEl('floatingBar');
    const input = getEl('floatingSearchInput');

    if (!bar || !input) return false;

    bar.hidden = false;
    bar.classList.add('is-floating-search-visible');
    document.body.classList.add('floating-search-active');
    syncVisibility();
    input.focus({ preventScroll: true });
    input.select();
    return true;
  }

  function savePosition(left, top){
    // v2.223: keep moved position only for the current page session.
    // Old persisted positions caused the bar to load off-center with .is-moved.
    floatingSessionPosition = { left, top };
  }

  function loadPosition(){
    // v2.226: keep the floating bar centered on every fresh page load.
    // Dragging still works during the current session, but old saved positions are ignored.
    return null;
  }

  function clampPosition(left, top, width, height){
    return utils().clampPosition?.(left, top, width, height) || { left, top };
  }

  function applyPosition(pos){
    const bar = getEl('floatingBar');
    if (!bar || !pos) return;

    const rect = bar.getBoundingClientRect();
    const clamped = clampPosition(
      Number(pos.left) || rect.left,
      Number(pos.top) || rect.top,
      rect.width,
      rect.height
    );

    const leftPx = clamped.left + 'px';
    const topPx = clamped.top + 'px';
    bar.style.setProperty('--mhp-floating-left', leftPx);
    bar.style.setProperty('--mhp-floating-top', topPx);
    bar.style.left = leftPx;
    bar.style.top = topPx;
    bar.style.right = 'auto';
    bar.style.bottom = 'auto';
    bar.style.transform = 'none';
    bar.classList.add('is-moved');
  }

  function resetPosition(){
    const bar = getEl('floatingBar');
    if (!bar) return;

    floatingSessionPosition = null;
    localStorage.removeItem(POSITION_KEY);
    bar.style.removeProperty('--mhp-floating-left');
    bar.style.removeProperty('--mhp-floating-top');
    bar.style.removeProperty('--mhp-floating-bottom');
    bar.style.left = '';
    bar.style.top = '';
    bar.style.right = '';
    bar.style.bottom = '';
    bar.style.transform = '';
    bar.classList.remove('is-moved');
  }

  function setupDrag(){
    const bar = getEl('floatingBar');
    const inner = bar?.querySelector('.floating-bar-inner');
    if (!bar || !inner || dragBound) return;

    dragBound = true;

    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    inner.addEventListener('pointerdown', event => {
      const target = event.target;
      if (target?.closest?.('input, button')) return;

      const rect = bar.getBoundingClientRect();
      dragging = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      inner.setPointerCapture(pointerId);
      bar.classList.add('is-dragging');
      event.preventDefault();
    });

    inner.addEventListener('pointermove', event => {
      if (!dragging || event.pointerId !== pointerId) return;

      const rect = bar.getBoundingClientRect();
      const next = clampPosition(
        startLeft + event.clientX - startX,
        startTop + event.clientY - startY,
        rect.width,
        rect.height
      );

      const leftPx = next.left + 'px';
      const topPx = next.top + 'px';
      bar.style.setProperty('--mhp-floating-left', leftPx);
      bar.style.setProperty('--mhp-floating-top', topPx);
      bar.style.left = leftPx;
      bar.style.top = topPx;
      bar.style.right = 'auto';
      bar.style.bottom = 'auto';
      bar.style.transform = 'none';
      bar.classList.add('is-moved');
    });

    function finishDrag(event){
      if (!dragging || event.pointerId !== pointerId) return;

      dragging = false;
      pointerId = null;
      bar.classList.remove('is-dragging');

      const rect = bar.getBoundingClientRect();
      savePosition(rect.left, rect.top);
    }

    inner.addEventListener('pointerup', finishDrag);
    inner.addEventListener('pointercancel', finishDrag);

    inner.addEventListener('dblclick', event => {
      if (event.target?.closest?.('input, button')) return;
      resetPosition();
    });
  }

  function bindSearchInput(){
    const input = getEl('floatingSearchInput');
    const clearBtn = getEl('floatingClearSearchBtn');
    if (!input || input.dataset.searchEventsBound) return !!input;

    input.dataset.searchEventsBound = 'true';

    input.addEventListener('input', event => {
      if (window.__mhpFloatingSearchProgrammaticClear) return;
      window.__mhpFloatingSearchLastInputAt = Date.now();
      window.__mhpFloatingSearchEnterRequested = false;
      dispatchSearchFromFloating(event.target.value, { event });
      syncVisibility();
      api()?.showSearchSuggestions?.(input);
      requestAnimationFrame(() => input.focus?.({ preventScroll: true }));
    });

    input.addEventListener('keydown', event => {
      const suggestBox = document.getElementById('searchSuggestBox');
      const suggestionsOpen = suggestBox && !suggestBox.hidden;

      if (event.key !== 'Enter' || suggestionsOpen) {
        api()?.handleSearchKeydown?.(event);
        if (event.defaultPrevented || event.key !== 'Enter') return;
      }

      event.preventDefault();
      event.stopPropagation();

      const main = document.getElementById('searchInput');
      if (main && main.value !== input.value) {
        main.value = input.value;
        main.dispatchEvent(new Event('input', { bubbles: true }));
      }

      window.__mhpFloatingSearchEnterRequested = true;
      const jumped = api()?.jumpFloatingSearchResult?.(input.value, { allowWithoutFloatingFlag: true, focusTarget: input, fromKeyboard: true, forceFirstResult: true });
      setTimeout(() => { window.__mhpFloatingSearchEnterRequested = false; }, 0);

      if (!jumped) {
        input.focus?.({ preventScroll: true });
        return;
      }

      requestAnimationFrame(() => input.focus?.({ preventScroll: true }));
    });

    input.addEventListener('focus', () => {
      input.classList.add('is-floating-input-focused');
      api()?.showSearchSuggestions?.(input);
    });

    input.addEventListener('blur', () => {
      input.classList.remove('is-floating-input-focused');
      api()?.scheduleHideSearchSuggestions?.(420);
    });

    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = 'true';
      clearBtn.addEventListener('click', () => clear({ focus: true }));
    }

    return true;
  }

  function bindGlobalEvents(){
    if (window.__mudaeFloatingGlobalEventsBoundV193) return;
    window.__mudaeFloatingGlobalEventsBoundV193 = true;

    window.addEventListener('scroll', () => scheduleFloatingScrollUpdate(syncVisibility), { passive: true });
    window.addEventListener('resize', () => {
      syncVisibility();
      const bar = getEl('floatingBar');
      if (!bar?.classList.contains('is-moved')) return;
      const rect = bar.getBoundingClientRect();
      applyPosition({ left: rect.left, top: rect.top });
    }, { passive: true });
    window.addEventListener('load', syncVisibility, { passive: true });

    const observer = new MutationObserver(() => scheduleFloatingScrollUpdate(syncVisibility));

    // v2.502: avoid watching every class/style mutation in the whole page.
    // The floating bar only needs body-level state, its own subtree, and board
    // mount/unmount signals. This keeps Settings/Edit/Gallery DOM churn from
    // triggering floating-search work dozens of times per render.
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    const bar = getEl('floatingBar');
    if (bar) {
      observer.observe(bar, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'style', 'class']
      });
    }

    const board = document.getElementById('board');
    if (board) {
      observer.observe(board, { childList: true });
    }

    window.addEventListener('mhp-board-rendered', () => scheduleFloatingScrollUpdate(syncVisibility, { force: true }), { passive: true });
    window.addEventListener('mhp-render-complete', () => scheduleFloatingScrollUpdate(syncVisibility, { force: true }), { passive: true });
    window.addEventListener('mhp:wake', () => scheduleFloatingScrollUpdate(syncVisibility, { force: true }), { passive: true });
    window.addEventListener('mhp:hibernate', () => { if (floatingScrollRaf) cancelAnimationFrame(floatingScrollRaf); floatingScrollRaf = 0; }, { passive: true });
  }

  function bind(){
    const input = getEl('floatingSearchInput');
    const backTop = getEl('floatingBackTopBtn');
    if (!input) return false;

    bindSearchInput();

    if (backTop && !backTop.dataset.bound) {
      backTop.dataset.bound = 'true';
      backTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    bindActionButtons();
    bindGlobalEvents();
    setupDrag();
    // v2.223: always start centered at the bottom.
    // Dragging still works, but old saved positions are ignored.
    resetPosition();
    syncActionButtons();
    syncVisibility();
    return true;
  }

  function init(){
    if (bind()) return;
    setTimeout(bind, 0);
  }

  window.MudaeFloatingBar = {
    init,
    syncVisibility,
    clear,
    focusPreferred,
    resetPosition
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* Mudae Organizer Rebuild board grid controller v2.126.
   Excel-like row/grid virtualization:
   - Dividers occupy a full row.
   - Character cards are grouped into fixed calculated rows.
   - Scroll math is row-based, not free-flow DOM based.
   - Movement is data-first; no card DOM insertBefore.
*/
(function(){
  'use strict';

  const STORAGE_KEY = 'mudae.visibleCardLimit.v1';
  const COLUMN_KEY = 'mudae.boardColumns.v1';
  const LIMITS = [150, 300, 600, 900, 1200, 0];
  const COLUMN_OPTIONS = [0, 6, 7, 8, 9, 10];

  const EST = {
    minCardWidth: 190,
    gap: 14,
    cardHeight: 344,
    dividerHeight: 72,
    subDividerHeight: 64,
    viewportBufferPx: 1200
  };

  const state = {
    entries: [],
    rows: [],
    rowOffsets: [],
    entryIndexToRow: [],
    idToEntryIndex: new Map(),
    totalHeight: 0,
    boardTop: 0,
    columns: 1,
    currentRange: null,
    createNode: null,
    selectedId: null,
    raf: 0,
    bound: false,
    saveTimer: 0,
    forceUntil: 0,
    stableFocusMode: false,
    stableFocusId: null,
    measuredCardHeight: EST.cardHeight,
    measuredDividerHeight: EST.dividerHeight,
    focusRunId: 0,
    rowNodeCache: new Map(),
    rowUseTick: 0
  };

  function api(){ return window.MUDAE_REBUILD_V1 || null; }
  function app(){ return api()?.app || null; }
  function els(){ return api()?.els || {}; }

  function escapeId(value){
    if (window.CSS?.escape) return CSS.escape(String(value));
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function readColumnSetting(){
    try {
      const raw = localStorage.getItem(COLUMN_KEY);
      const value = raw == null ? 0 : Number(raw);
      return COLUMN_OPTIONS.includes(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  function applyColumnSettingToBoard(){
    const board = els().board || document.documentElement;
    const columns = readColumnSetting();

    if (columns > 0) {
      board.style.setProperty('--board-grid-columns', String(columns));
      document.documentElement.style.setProperty('--board-grid-columns', String(columns));
    } else {
      board.style.removeProperty('--board-grid-columns');
      document.documentElement.style.removeProperty('--board-grid-columns');
    }

    return columns;
  }

  function getColumnSetting(){
    return readColumnSetting();
  }

  function setColumnSetting(value){
    const columns = COLUMN_OPTIONS.includes(Number(value)) ? Number(value) : 0;

    try {
      localStorage.setItem(COLUMN_KEY, String(columns));
    } catch {}

    applyColumnSettingToBoard();

    state.boardTop = 0;
    clearRowNodeCache();
    rebuildRows();

    if (state.entries.length) {
      renderWindow(true);
    }

    window.dispatchEvent(new CustomEvent('mudae:board-columns-change', {
      detail: { columns }
    }));
  }

  function readLimit(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const value = raw == null ? 600 : Number(raw);
      return LIMITS.includes(value) ? value : 600;
    } catch {
      return 600;
    }
  }

  function getLimit(){
    const limit = readLimit();
    const a = app();
    if (a) a.visibleCardLimit = limit;
    return limit;
  }

  function setLimit(value){
    const limit = LIMITS.includes(Number(value)) ? Number(value) : 600;

    try {
      localStorage.setItem(STORAGE_KEY, String(limit));
    } catch {}

    const a = app();
    if (a) a.visibleCardLimit = limit;

    clearSelection();
    api()?.renderBoard?.();

    window.dispatchEvent(new CustomEvent('mudae:visible-card-limit-change', {
      detail: { limit }
    }));
  }

  function isDividerEntry(entry){
    return entry?.type === 'divider';
  }

  function dividerKind(entry){
    const level = Math.max(1, Number(entry?.item?.level) || 1);
    return level > 1 ? 'subdivider' : 'divider';
  }

  function getDividerHeight(entry){
    return dividerKind(entry) === 'subdivider'
      ? EST.subDividerHeight
      : (state.measuredDividerHeight || EST.dividerHeight);
  }

  function getCardHeight(){
    return state.measuredCardHeight || EST.cardHeight;
  }

  function getScrollTop(){
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function getViewportHeight(){
    return window.innerHeight || document.documentElement.clientHeight || 800;
  }

  function isGlassMode(){
    const body = document.body;
    const root = document.documentElement;

    return !!(
      body?.classList?.contains('visual-mode-glass') ||
      body?.classList?.contains('glass-panels-enabled') ||
      body?.dataset?.visualMode === 'glass' ||
      root?.classList?.contains('visual-mode-glass') ||
      root?.classList?.contains('glass-panels-enabled') ||
      root?.dataset?.visualMode === 'glass'
    );
  }

  function getVisibleAnchorId(){
    const board = els().board;
    if (!board) return null;

    const viewportHeight = getViewportHeight();
    const viewportCenter = viewportHeight / 2;
    let best = null;
    let bestScore = Infinity;

    board.querySelectorAll('.char-card[data-id], .character-card[data-id], [data-id].char-card, [data-id].character-card').forEach(node => {
      const id = node.dataset?.id;
      if (!id) return;

      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.height <= 0 || rect.width <= 0) return;
      if (rect.bottom < 0 || rect.top > viewportHeight) return;

      const center = rect.top + rect.height / 2;
      const score = Math.abs(center - viewportCenter);

      if (score < bestScore) {
        bestScore = score;
        best = id;
      }
    });

    return best;
  }

  function restoreAnchorAfterRender(anchorId){
    if (!anchorId) return;

    const run = () => {
      scrollRenderedCharacterIntoView(anchorId, {
        scroll: true,
        allowNavigation: true,
        highlight: false
      });
    };

    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
      setTimeout(run, 80);
    });
  }

  function getBoardTop(){
    if (state.boardTop) return state.boardTop;

    const rect = els().board?.getBoundingClientRect?.();
    state.boardTop = (rect?.top || 0) + getScrollTop();
    return state.boardTop;
  }

  function readBoardCssNumber(name, fallback) {
    const board = els().board || document.documentElement;

    try {
      const raw = getComputedStyle(board).getPropertyValue(name).trim();
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getGridMetrics() {

  return {
      minCardWidth: readBoardCssNumber('--board-card-min-width', EST.minCardWidth),
      gap: readBoardCssNumber('--board-grid-gap', EST.gap)
    };
  }
  function calcColumns(){
    const fixed = applyColumnSettingToBoard();

    if (fixed > 0) return fixed;

    const board = els().board;
    const width = Math.max(320, board?.clientWidth || window.innerWidth || 1200);
    const metrics = getGridMetrics();
    const columns = Math.floor((width + metrics.gap) / (metrics.minCardWidth + metrics.gap));
    return Math.max(1, columns || 1);
  }





  function makeCardRow(cards, startEntryIndex){
    return {
      type: 'cards',
      entries: cards,
      startEntryIndex,
      endEntryIndex: startEntryIndex + cards.length,
      height: getCardHeight()
    };
  }

  function makeDividerRow(entry, entryIndex){
    return {
      type: 'divider',
      entries: [entry],
      startEntryIndex: entryIndex,
      endEntryIndex: entryIndex + 1,
      height: getDividerHeight(entry)
    };
  }

  function rebuildRows(){
    const columns = calcColumns();
    const rows = [];
    const rowOffsets = [];
    const entryIndexToRow = [];
    const idToEntryIndex = new Map();

    let pendingCards = [];
    let pendingStart = 0;
    let y = 0;

    function pushRow(row){
      const rowIndex = rows.length;
      rows.push(row);
      rowOffsets.push(y);

      for (let i = row.startEntryIndex; i < row.endEntryIndex; i++) {
        entryIndexToRow[i] = rowIndex;
      }

      y += row.height + getGridMetrics().gap;
    }

    function flushCards(){
      if (!pendingCards.length) return;
      pushRow(makeCardRow(pendingCards, pendingStart));
      pendingCards = [];
    }

    state.entries.forEach((entry, entryIndex) => {
      if (entry?.item?.id) {
        idToEntryIndex.set(entry.item.id, entryIndex);
      }

      if (isDividerEntry(entry)) {
        flushCards();
        pushRow(makeDividerRow(entry, entryIndex));
        return;
      }

      if (!pendingCards.length) pendingStart = entryIndex;
      pendingCards.push(entry);

      if (pendingCards.length >= columns) {
        flushCards();
      }
    });

    flushCards();

    state.columns = columns;
    state.rows = rows;
    state.rowOffsets = rowOffsets;
    state.entryIndexToRow = entryIndexToRow;
    state.idToEntryIndex = idToEntryIndex;
    state.totalHeight = Math.max(0, y);
    state.currentRange = null;
    clearRowNodeCache();
  }

  function findRowByY(y){
    if (!state.rowOffsets.length) return 0;

    let lo = 0;
    let hi = state.rowOffsets.length - 1;
    let ans = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;

      if (state.rowOffsets[mid] <= y) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return ans;
  }

  function getVisibleRowRange(){
    const limit = getLimit();

    if (!state.rows.length || limit <= 0) {
      return {
        startRow: 0,
        endRow: state.rows.length,
        topSpacer: 0,
        bottomSpacer: 0,
        limited: false
      };
    }

    const relativeTop = Math.max(0, getScrollTop() - getBoardTop());
    const viewportHeight = getViewportHeight();
    const relativeBottom = relativeTop + viewportHeight;
    const centerY = relativeTop + viewportHeight / 2;
    const viewportCenterRow = findRowByY(centerY);

    // v2.594: live row-window virtualization.
    // Keep the current DOM only while the viewport is still safely inside the
    // mounted rows and the viewport center has not drifted too far from the
    // mounted center. This lets the visible-card limit load/unload cards while
    // scrolling instead of holding an old block for many screens.
    const current = state.currentRange;
    if (current?.limited && !current.stableFocus) {
      const mountedTop = Number(current.topSpacer || 0);
      const mountedBottom = Math.max(0, state.totalHeight - Number(current.bottomSpacer || 0));
      const mountedRows = Math.max(1, Number(current.endRow || 0) - Number(current.startRow || 0));
      const mountedCenterRow = (Number(current.startRow || 0) + Number(current.endRow || 0)) / 2;
      const edgeGuard = Math.max(260, Math.min(760, viewportHeight * 0.55));
      const rowDriftGuard = Math.max(3, Math.min(10, Math.round(mountedRows * 0.10)));
      const insideEdges = relativeTop >= mountedTop + edgeGuard && relativeBottom <= mountedBottom - edgeGuard;
      const insideCenter = Math.abs(viewportCenterRow - mountedCenterRow) <= rowDriftGuard;

      if (insideEdges && insideCenter) {
        return current;
      }
    }

    const target = Math.min(limit, state.entries.length);
    const viewportBufferPx = Math.max(520, Math.min(EST.viewportBufferPx, viewportHeight * 1.25));

    let startRow = findRowByY(Math.max(0, relativeTop - viewportBufferPx));
    let endRow = findRowByY(relativeBottom + viewportBufferPx) + 1;

    startRow = Math.max(0, startRow);
    endRow = Math.min(state.rows.length, endRow);

    let entryCount = 0;
    for (let r = startRow; r < endRow; r++) {
      entryCount += state.rows[r].entries.length;
    }

    // Expand until the configured visible-card limit is represented. Prefer the
    // scroll direction neighborhood first: rows after the viewport are more
    // likely to be needed immediately, but keep a smaller tail behind it.
    if (entryCount < target) {
      let before = startRow - 1;
      let after = endRow;

      while (entryCount < target && (before >= 0 || after < state.rows.length)) {
        if (after < state.rows.length) {
          entryCount += state.rows[after].entries.length;
          after++;
          if (entryCount >= target) break;
        }

        if (before >= 0) {
          entryCount += state.rows[before].entries.length;
          before--;
        }
      }

      startRow = before + 1;
      endRow = after;
    }

    // If the viewport buffer plus rows exceeds the user limit, trim from the
    // side farthest from the viewport center. This keeps the mounted DOM close
    // to the configured limit and actually unloads cards as you scroll.
    while (entryCount > target && endRow - startRow > 1) {
      const firstDistance = Math.abs(startRow - viewportCenterRow);
      const lastDistance = Math.abs((endRow - 1) - viewportCenterRow);

      if (lastDistance >= firstDistance && endRow - 1 > viewportCenterRow) {
        endRow--;
        entryCount -= state.rows[endRow]?.entries.length || 0;
      } else if (startRow < viewportCenterRow) {
        entryCount -= state.rows[startRow]?.entries.length || 0;
        startRow++;
      } else {
        break;
      }
    }

    const topSpacer = state.rowOffsets[startRow] || 0;
    const endOffset = endRow < state.rowOffsets.length
      ? state.rowOffsets[endRow]
      : state.totalHeight;
    const bottomSpacer = Math.max(0, state.totalHeight - endOffset);

    return {
      startRow,
      endRow,
      topSpacer,
      bottomSpacer,
      limited: true
    };
  }

  function createSpacer(height, className){
    const node = document.createElement('div');
    node.className = className;
    node.style.height = Math.max(0, Math.round(height)) + 'px';
    node.setAttribute('aria-hidden', 'true');
    return node;
  }


  // v2.599: keep recently rendered row DOM alive while virtual scrolling.
  // Without this, every window shift destroys/recreates card <img> elements and
  // cached images can visibly flash as if they were being loaded again.
  function getEntryStableKey(entry){
    const item = entry?.item || entry || {};
    return item.id || item.name || item.title || String(entry?.entryIndex || '');
  }

  function getRowCacheKey(row){
    if (!row) return '';
    const ids = (row.entries || []).map(getEntryStableKey).join('|');
    return [row.type || 'row', row.startEntryIndex ?? '', row.endEntryIndex ?? '', state.columns, ids].join('::');
  }

  function getRowCacheMax(){
    const limit = getLimit();
    if (limit <= 0) return 0;
    const cols = Math.max(1, state.columns || 1);
    return Math.max(80, Math.min(260, Math.ceil(limit / cols) * 3));
  }

  function clearRowNodeCache(){
    state.rowNodeCache?.clear?.();
  }

  function pruneRowNodeCache(keepStart = -1, keepEnd = -1){
    const max = getRowCacheMax();
    const cache = state.rowNodeCache;
    if (!cache || max <= 0 || cache.size <= max) return;

    const entries = Array.from(cache.entries())
      .filter(([rowIndex]) => rowIndex < keepStart || rowIndex >= keepEnd)
      .sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));

    while (cache.size > max && entries.length) {
      const [rowIndex] = entries.shift();
      cache.delete(rowIndex);
    }
  }

  function renderRowCached(row, rowIndex){
    const cache = state.rowNodeCache;
    const key = getRowCacheKey(row);
    const cached = cache?.get?.(rowIndex);

    if (cached && cached.key === key && cached.node) {
      cached.lastUsed = ++state.rowUseTick;
      return cached.node;
    }

    const node = renderRow(row);
    if (cache && getLimit() > 0) {
      cache.set(rowIndex, {
        key,
        node,
        lastUsed: ++state.rowUseTick
      });
    }
    return node;
  }

  function createRowsHost(){
    const node = document.createElement('div');
    node.className = 'bgc-rows';
    return node;
  }

  function createCardGrid(){
    const node = document.createElement('div');
    node.className = 'bgc-card-row';
    return node;
  }

  function createNode(entry){
    if (typeof state.createNode === 'function') {
      const node = state.createNode(entry);
      if (node) return node;
    }

    const bridgeNode = api()?.createBoardEntryNode?.(entry);
    if (bridgeNode) return bridgeNode;

    const fallback = document.createElement('div');
    fallback.className = 'bgc-fallback-entry';
    fallback.textContent = entry?.item?.name || entry?.item?.title || 'Item';
    if (entry?.item?.id) fallback.dataset.id = entry.item.id;
    return fallback;
  }

  function renderRow(row){
    if (row.type === 'divider') {
      const node = createNode(row.entries[0]);
      node.classList?.add?.('bgc-full-row');
      return node;
    }

    const grid = createCardGrid();

    row.entries.forEach(entry => {
      grid.appendChild(createNode(entry));
    });

    return grid;
  }

  function measureRendered(){
    const board = els().board;
    if (!board) return false;

    let changed = false;

    const card = board.querySelector('.char-card');
    if (card) {
      const h = Math.round(card.getBoundingClientRect().height);
      if (h > 120 && Math.abs(h - state.measuredCardHeight) > 20) {
        state.measuredCardHeight = h;
        changed = true;
      }
    }

    const divider = board.querySelector('.divider-row');
    if (divider) {
      const h = Math.round(divider.getBoundingClientRect().height);
      if (h > 30 && Math.abs(h - state.measuredDividerHeight) > 14) {
        state.measuredDividerHeight = h;
        changed = true;
      }
    }

    if (changed) {
      rebuildRows();
    }

    return changed;
  }

  function clearMode(){
    const board = els().board;
    board?.classList?.remove('bgc-window-active');

    if (board?.dataset) {
      delete board.dataset.bgcStart;
      delete board.dataset.bgcEnd;
      delete board.dataset.bgcRows;
      delete board.dataset.bgcTotal;
      delete board.dataset.bgcColumns;
      delete board.dataset.bgcStableFocus;
    }

    board?.classList?.remove('bgc-stable-focus-active');
  }

  function renderAllRows(){
    const board = els().board;
    if (!board) return false;

    const frag = document.createDocumentFragment();

    state.rows.forEach(row => {
      frag.appendChild(renderRow(row));
    });

    clearMode();
    board.replaceChildren(frag);
    restoreSelectionClass();

    window.MudaeMinimalImageLoader?.releaseVisible?.(board);
    window.MudaeGifControl?.refresh?.();

    return true;
  }

  function renderWindow(force = false){
    const board = els().board;
    if (!board) return false;

    if (isStableFocusWindowSafe()) {
      const released = maybeReleaseStableFocusForScroll(force);
      if (!released && !force) return true;
    }

    const range = getVisibleRowRange();

    const same = state.currentRange
      && state.currentRange.startRow === range.startRow
      && state.currentRange.endRow === range.endRow
      && Math.abs(state.currentRange.topSpacer - range.topSpacer) < 2
      && Math.abs(state.currentRange.bottomSpacer - range.bottomSpacer) < 2;

    if (!force && same) return true;

    state.currentRange = range;

    const frag = document.createDocumentFragment();
    const host = createRowsHost();

    frag.appendChild(createSpacer(range.topSpacer, 'bgc-spacer bgc-spacer-top'));

    for (let r = range.startRow; r < range.endRow; r++) {
      host.appendChild(renderRowCached(state.rows[r], r));
    }

    frag.appendChild(host);
    frag.appendChild(createSpacer(range.bottomSpacer, 'bgc-spacer bgc-spacer-bottom'));

    board.classList.add('bgc-window-active');
    board.dataset.bgcStart = String(range.startRow + 1);
    board.dataset.bgcEnd = String(range.endRow);
    board.dataset.bgcRows = String(state.rows.length);
    board.dataset.bgcTotal = String(state.entries.length);
    board.dataset.bgcColumns = String(state.columns);
    board.replaceChildren(frag);
    pruneRowNodeCache(range.startRow, range.endRow);
    restoreSelectionClass();

    const changed = measureRendered();

    if (changed && !force && !isStableFocusWindowSafe()) {
      schedule(true);
    }

    api()?.applyPendingJumpHighlight?.();
    window.MudaeMinimalImageLoader?.releaseVisible?.(board);
    if (isGlassMode()) {
      // Glass renders the complete board, so make every mounted image participate
      // in the existing Loading harem / image-memory pipeline.
      setTimeout(() => window.MudaeMinimalImageLoader?.forceLoadAll?.(board), 60);
    }
    window.MudaeGifControl?.refresh?.();

    return true;
  }

  function renderCompleteBoardForGlass(anchorId = null){
    clearStableFocusMode();
    state.currentRange = null;
    clearRowNodeCache();

    const rendered = renderAllRows();
    if (rendered) {
      restoreAnchorAfterRender(anchorId);
    }

    return rendered;
  }

  function renderEntries(entries, createNodeFn){
    const board = els().board;
    if (!board) return false;

    try {
      if (typeof createNodeFn === 'function') {
        state.createNode = createNodeFn;
      }

      state.entries = Array.isArray(entries) ? entries : [];
      clearStableFocusMode();
      state.boardTop = 0;
      state.currentRange = null;
      applyColumnSettingToBoard();
      rebuildRows();

      // Glass renders the complete board instead of using the live row-window
      // virtualizer. Minimalist keeps virtualization; Glass prioritizes stable
      // browsing through the full harem without an artificial scroll cutoff.
      if (isGlassMode()) {
        return renderCompleteBoardForGlass(getVisibleAnchorId());
      }

      const limit = getLimit();

      if (limit <= 0 || state.entries.length <= limit) {
        return renderAllRows();
      }

      return renderWindow(true) && board.children.length > 0;
    } catch (error) {
      console.error('MudaeBoardController grid render failed', error);
      return false;
    }
  }


  function schedule(force = false){
    if (state.raf && !force) return;

    if (state.raf && force) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }

    state.raf = requestAnimationFrame(() => {
      state.raf = 0;

      if (!state.entries.length) return;
      if (getLimit() <= 0) return;

      const now = performance.now();

      if (!force && isStableFocusWindowSafe()) {
        if (!maybeReleaseStableFocusForScroll(false)) return;
      }

      if (!force && state.forceUntil && now < state.forceUntil) return;

      if (isGlassMode()) {
        // Glass uses a full-board render. Do not rebuild the entire harem on
        // every scroll event; that was the source of the heavy lag when
        // switching to Glass with large harems. The full board is rendered on
        // visual-mode changes, data renders, and resize. Normal scrolling only
        // needs the browser to paint the already-mounted nodes.
        const board = els().board;
        const needsGlassRender = force && (!board || board.classList.contains('bgc-window-active') || !board.children.length);
        if (needsGlassRender) {
          renderCompleteBoardForGlass(getVisibleAnchorId());
        }
        return;
      }

      renderWindow(!!force);
    });
  }


  function bind(){
    if (state.bound) return;
    state.bound = true;

    let lastScrollTop = getScrollTop();
    const update = () => {
      const currentScrollTop = getScrollTop();
      const viewportHeight = getViewportHeight();
      const isLargeJump = Math.abs(currentScrollTop - lastScrollTop) > Math.max(900, viewportHeight * 1.20);
      lastScrollTop = currentScrollTop;

      // v2.597: keyboard End/Home and scrollbar thumb jumps can move several
      // virtual windows in one frame. Treat those as hard jumps so the mounted
      // row window is recalculated immediately instead of waiting until the user
      // scrolls back into a sentinel/buffer area.
      if (isLargeJump) {
        clearStableFocusMode();
        state.currentRange = null;
        schedule(true);
        setTimeout(() => schedule(true), 40);
        setTimeout(() => schedule(true), 140);
        return;
      }

      schedule(false);
    };

    // v2.311:
    // Search focus uses full stable-board mode. Scroll/wheel/touch should not
    // release it, because releasing hands control back to the broken normal
    // virtualizer and jumps from #1200/#1224 to #800.
    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('scroll', update, { passive: true, capture: true });
    // Wheel/touch events fire before scroll and were causing duplicate render
    // checks. The scroll listener is enough for normal movement; keep keyboard
    // and resize explicit below.

    window.addEventListener('resize', () => {
      if (!state.entries.length) return;
      state.boardTop = 0;
      applyColumnSettingToBoard();
      rebuildRows();
      schedule(true);
    }, { passive: true });

    window.addEventListener('mhp-visual-mode-change', () => {
      if (!state.entries.length) return;

      const anchorId = getVisibleAnchorId();
      clearStableFocusMode();
      state.boardTop = 0;
      state.currentRange = null;
      clearRowNodeCache();
      rebuildRows();

      requestAnimationFrame(() => {
        if (isGlassMode()) {
          renderCompleteBoardForGlass(anchorId);
          return;
        }

        renderWindow(true);
        restoreAnchorAfterRender(anchorId);
      });
    });

    const visualModeObserver = 'MutationObserver' in window
      ? new MutationObserver(() => {
          if (!state.entries.length) return;
          if (!isGlassMode()) return;

          // Some buttons update classes directly before/without the custom event.
          // If Glass becomes active, immediately switch to complete-board mode.
          if (els().board?.classList?.contains?.('bgc-window-active')) {
            renderCompleteBoardForGlass(getVisibleAnchorId());
          }
        })
      : null;

    try {
      if (visualModeObserver && document.body) {
        visualModeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-visual-mode'] });
      }
      if (visualModeObserver && document.documentElement) {
        visualModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-visual-mode'] });
      }
    } catch {}

    window.addEventListener('keydown', event => {
      const target = event.target;
      const isTyping = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      if (event.key === 'Escape' && !isTyping) {
        clearSelection();
      }

      if (isTyping) return;

      if (['Home','End','PageDown','PageUp','ArrowDown','ArrowUp',' '].includes(event.key)) {
        // Let the browser perform the native scroll first, then force the
        // virtual row window to match the new scroll position. This is critical
        // for End/Home right after Loading harem finishes.
        setTimeout(() => { clearStableFocusMode(); state.currentRange = null; schedule(true); }, 0);
        requestAnimationFrame(() => { clearStableFocusMode(); state.currentRange = null; schedule(true); });
        setTimeout(() => schedule(true), 60);
        setTimeout(() => schedule(true), 180);
        setTimeout(() => schedule(true), 360);
      }
    }, true);
  }

  function updateEntriesFromApp(){
    const collected = api()?.collectCurrentBoardEntries?.();
    if (!collected) return false;

    state.entries = collected.entries || [];
    state.boardTop = 0;
    clearRowNodeCache();
    rebuildRows();
    return true;
  }

  function entryIndexById(id){
    if (!id) return -1;
    return state.idToEntryIndex.has(id) ? state.idToEntryIndex.get(id) : -1;
  }

  function getForcedRowRange(centerRow) {
    const limit = getLimit();

    if (limit <= 0 || state.entries.length <= limit) {
      return {
        startRow: 0,
        endRow: state.rows.length,
        topSpacer: 0,
        bottomSpacer: 0
      };
    }

    centerRow = Math.max(0, Math.min(state.rows.length - 1, Number(centerRow) || 0));

    let startRow = centerRow;
    let endRow = centerRow + 1;
    let entryCount = state.rows[centerRow]?.entries?.length || 0;
    let before = centerRow - 1;
    let after = centerRow + 1;

    while (entryCount < limit && (before >= 0 || after < state.rows.length)) {
      if (before >= 0) {
        entryCount += state.rows[before].entries.length;
        before--;
        if (entryCount >= limit) break;
      }

      if (after < state.rows.length) {
        entryCount += state.rows[after].entries.length;
        after++;
      }
    }

    startRow = before + 1;
    endRow = after;

    const topSpacer = state.rowOffsets[startRow] || 0;
    const endOffset = endRow < state.rowOffsets.length
      ? state.rowOffsets[endRow]
      : state.totalHeight;
    const bottomSpacer = Math.max(0, state.totalHeight - endOffset);

    return {
      startRow,
      endRow,
      topSpacer,
      bottomSpacer
    };
  }

  function getStableFocusRange(centerRow) {
    const total = state.rows.length;
    if (!total) return null;

    // Full stable-board mode after Search + Enter.
    // This avoids handing scroll back to the normal virtualizer in the focused session.
    const startRow = 0;
    const endRow = total;

    return {
      startRow,
      endRow,
      topSpacer: 0,
      bottomSpacer: 0
    };
  }

  function renderStableFocusWindow(centerRow, id) {
    const board = els().board;
    if (!board) return false;

    const range = getStableFocusRange(centerRow);
    if (!range) return false;

    const frag = document.createDocumentFragment();
    const host = createRowsHost();
    host.classList.add('bgc-stable-focus-rows');

    frag.appendChild(createSpacer(range.topSpacer, 'bgc-spacer bgc-spacer-top bgc-stable-focus-spacer'));

    for (let r = range.startRow; r < range.endRow; r++) {
      host.appendChild(renderRowCached(state.rows[r], r));
    }

    frag.appendChild(host);
    frag.appendChild(createSpacer(range.bottomSpacer, 'bgc-spacer bgc-spacer-bottom bgc-stable-focus-spacer'));

    board.classList.add('bgc-window-active', 'bgc-stable-focus-active');
    board.dataset.bgcStart = String(range.startRow + 1);
    board.dataset.bgcEnd = String(range.endRow);
    board.dataset.bgcRows = String(state.rows.length);
    board.dataset.bgcTotal = String(state.entries.length);
    board.dataset.bgcColumns = String(state.columns);
    board.dataset.bgcStableFocus = 'true';
    board.replaceChildren(frag);
    pruneRowNodeCache(range.startRow, range.endRow);
    restoreSelectionClass();

    state.currentRange = {
      startRow: range.startRow,
      endRow: range.endRow,
      topSpacer: range.topSpacer,
      bottomSpacer: range.bottomSpacer,
      limited: true,
      stableFocus: true
    };

    state.stableFocusMode = true;
    state.stableFocusId = id || null;

    api()?.applyPendingJumpHighlight?.();
    window.MudaeMinimalImageLoader?.releaseVisible?.(board);
    window.MudaeGifControl?.refresh?.();

    return true;
  }

  function isStableFocusWindowSafe() {
    if (!state.stableFocusMode || !state.stableFocusId) return false;

    const host = els().board?.querySelector?.('.bgc-stable-focus-rows');
    if (!host) return false;

    // Full stable-board mode stays valid until an explicit render/update clears
    // it. Do not release it due to scroll, wheel, or viewport position.
    return true;
  }

  function clearStableFocusMode() {
    state.stableFocusMode = false;
    state.stableFocusId = null;
    els().board?.classList?.remove('bgc-stable-focus-active');
    if (els().board?.dataset) delete els().board.dataset.bgcStableFocus;
  }

  function maybeReleaseStableFocusForScroll(force = false) {
    if (!state.stableFocusMode) return false;
    if (getLimit() <= 0) return false;
    if (!force && state.forceUntil && performance.now() < state.forceUntil) return false;

    const board = els().board;
    const active = board?.querySelector?.('.bgc-stable-focus-rows');
    if (!active) {
      clearStableFocusMode();
      return true;
    }

    // v2.594: stable-focus is useful right after Search/Edit because it avoids
    // a jump while the target is being centered, but it must not permanently
    // disable the visible-card limit. Once the user scrolls normally and the
    // viewport has moved outside the focused card area, hand control back to
    // the live row window so cards mount/unmount again.
    const id = state.stableFocusId;
    const node = id ? findRenderedNodeById(id) : null;

    if (node) {
      const rect = node.getBoundingClientRect();
      const vh = getViewportHeight();
      const safeMargin = Math.max(220, Math.min(520, vh * 0.35));

      if (rect.bottom >= -safeMargin && rect.top <= vh + safeMargin) {
        return false;
      }
    }

    clearStableFocusMode();
    state.currentRange = null;
    return true;
  }

  function renderForcedRowWindow(centerRow) {
    const board = els().board;
    if (!board) return false;

    const range = getForcedRowRange(centerRow);

    const frag = document.createDocumentFragment();
    const host = createRowsHost();

    frag.appendChild(createSpacer(range.topSpacer, 'bgc-spacer bgc-spacer-top'));

    for (let r = range.startRow; r < range.endRow; r++) {
      host.appendChild(renderRowCached(state.rows[r], r));
    }

    frag.appendChild(host);
    frag.appendChild(createSpacer(range.bottomSpacer, 'bgc-spacer bgc-spacer-bottom'));

    board.classList.add('bgc-window-active');
    board.dataset.bgcStart = String(range.startRow + 1);
    board.dataset.bgcEnd = String(range.endRow);
    board.dataset.bgcRows = String(state.rows.length);
    board.dataset.bgcTotal = String(state.entries.length);
    board.dataset.bgcColumns = String(state.columns);
    board.replaceChildren(frag);
    pruneRowNodeCache(range.startRow, range.endRow);
    restoreSelectionClass();

    state.currentRange = {
      startRow: range.startRow,
      endRow: range.endRow,
      topSpacer: range.topSpacer,
      bottomSpacer: range.bottomSpacer,
      limited: true
    };

    api()?.applyPendingJumpHighlight?.();
    window.MudaeMinimalImageLoader?.releaseVisible?.(board);
    window.MudaeGifControl?.refresh?.();

    return true;
  }

  function scrollRenderedCharacterIntoView(id, options = {}) {
    const safe = escapeId(id);
    const node = els().board?.querySelector?.(`[data-id="${safe}"]`);
    if (!node) return false;

    const shouldScroll = options.scroll === true && options.allowNavigation === true;
    const shouldHighlight = options.highlight === true;

    if (shouldScroll) {
      const rect = node.getBoundingClientRect();
      const vh = getViewportHeight();
      const desiredTop = Math.max(90, (vh - rect.height) * 0.50);
      const delta = rect.top - desiredTop;

      if (Math.abs(delta) > 2) {
        window.scrollTo({
          top: getScrollTop() + delta,
          behavior: 'auto'
        });
      }
    }

    if (shouldHighlight) {
      node.classList.add('highlight-jump', 'highlight-jump-strong');
      setTimeout(() => node.classList.remove('highlight-jump', 'highlight-jump-strong'), 1400);
    }

    return true;
  }
  function renderStableAroundId(id, options = {}) {
    if (!id) return false;

    if (!state.entries.length) {
      updateEntriesFromApp();
    }

    const entryIndex = entryIndexById(id);
    if (entryIndex < 0) return false;

    const rowIndex = state.entryIndexToRow[entryIndex] || 0;

    // Same idea as Search+Enter stable mode, but without navigation:
    // keep the board mounted in the stable full-board window so the virtualizer
    // does not recalculate and jump to top/another block after edit save.
    const ok = renderStableFocusWindow(rowIndex, id);
    if (!ok) return false;

    state.stableFocusMode = true;
    state.stableFocusId = id;
    state.forceUntil = performance.now() + (Number.isFinite(options.forceMs) ? options.forceMs : 1600);

    if (options.highlight === true) {
      requestAnimationFrame(() => {
        const node = findRenderedNodeById(id);
        node?.classList?.add('highlight-jump');
        setTimeout(() => node?.classList?.remove('highlight-jump'), 1000);
      });
    }

    return true;
  }


  function renderAroundId(id, options = {}){
    if (!id) return false;

    if (!state.entries.length) {
      updateEntriesFromApp();
    }

    const entryIndex = entryIndexById(id);
    if (entryIndex < 0) return false;

    const rowIndex = state.entryIndexToRow[entryIndex] || 0;

    state.forceUntil = performance.now() + 900;

    const ok = renderForcedRowWindow(rowIndex);

    if (!ok) return false;

    const shouldScroll = options.scroll === true && options.allowNavigation === true;
    const shouldHighlight = options.highlight === true;

    if (shouldScroll || shouldHighlight) {
      requestAnimationFrame(() => {
        scrollRenderedCharacterIntoView(id, {
          ...options,
          scroll: shouldScroll,
          highlight: shouldHighlight
        });

        requestAnimationFrame(() => scrollRenderedCharacterIntoView(id, {
          ...options,
          scroll: shouldScroll,
          highlight: shouldHighlight
        }));

        setTimeout(() => scrollRenderedCharacterIntoView(id, {
          ...options,
          scroll: shouldScroll,
          highlight: shouldHighlight
        }), 120);
      });
    }

    return true;
  }



  function clearSelection(){
    if (!state.selectedId) return;

    const node = els().board?.querySelector?.(`[data-id="${escapeId(state.selectedId)}"]`);
    node?.classList?.remove('move-source-selected');
    state.selectedId = null;
    document.body.classList.remove('is-two-click-moving-character');
  }

  function restoreSelectionClass(){
    if (!state.selectedId) return;

    const node = els().board?.querySelector?.(`[data-id="${escapeId(state.selectedId)}"]`);
    node?.classList?.add('move-source-selected');
  }

  function selectMoveSource(id){
    clearSelection();
    state.selectedId = id;
    document.body.classList.add('is-two-click-moving-character');
    restoreSelectionClass();
  }

  function getSelectedMoveId(){
    return state.selectedId;
  }

  function moveSourceToTarget(targetId){
    const sourceId = state.selectedId;

    clearSelection();

    if (!sourceId || !targetId || sourceId === targetId) return false;

    return api()?.moveCharacterRelativeToTargetDataOnly?.(sourceId, targetId) || false;
  }

  function scheduleSave(){
    // v2.118: movement/order changes must survive immediate reload.
    // localStorage writes are synchronous, so save once immediately.
    try {
      api()?.saveLocal?.();
    } catch (error) {
      console.error('Immediate board save failed:', error);
    }

    // Keep a short delayed backup for any chained updates that finish right after the move.
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      try {
        api()?.saveLocal?.();
      } catch (error) {
        console.error('Delayed board save failed:', error);
      }
    }, 120);
  }


  function flushSave(){
    clearTimeout(state.saveTimer);

    try {
      api()?.saveLocal?.();
      return true;
    } catch (error) {
      console.error('Board save flush failed:', error);
      return false;
    }
  }



  function getCssSafeIdLocal(id){
    if (api()?.getCssSafeId) return api().getCssSafeId(id);

    return String(id || '').replace(/["\\]/g, '\\$&');
  }

  function findRenderedNodeById(id){
    const safeId = getCssSafeIdLocal(id);
    return document.querySelector(`[data-id="${safeId}"]`);
  }

  function highlightNode(node, options = {}){
    if (!node || options.highlight === false) return;

    node.classList.add('highlight-jump', 'highlight-jump-strong');
    setTimeout(() => node.classList.remove('highlight-jump', 'highlight-jump-strong'), options.highlightMs || 1400);
  }

  function getBoardItemIndexById(id){
    const entries = state.entries || [];
    return entries.findIndex(entry => {
      const entryId = entry?.id || entry?.item?.id;
      return String(entryId || '') === String(id || '');
    });
  }

  function getEstimatedEntryHeight(){
    const rendered = document.querySelector('.board-entry, .char-card, [data-board-entry]');
    const rect = rendered?.getBoundingClientRect?.();

    if (rect?.height && rect.height > 20) return rect.height;

    return state.estimatedRowHeight || state.rowHeight || state.entryHeight || 118;
  }

  function getBoardTopOffset(){
    const board = document.getElementById('board') || document.querySelector('.board') || document.querySelector('[data-board-root]');
    const rect = board?.getBoundingClientRect?.();
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

    if (rect) return scrollTop + rect.top;

    return 0;
  }

  function predictScrollTopForId(id, offset = 0){
    const index = getBoardItemIndexById(id);

    if (index < 0) return null;

    const rowIndex = state.entryIndexToRow?.[index];
    const safeRowIndex = Number.isFinite(rowIndex) ? rowIndex : Math.floor(index / Math.max(1, state.columns || 1));
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const estimatedHeight = getEstimatedEntryHeight();
    const boardTop = getBoardTopOffset();

    // The virtual board is row-based. Predicting with the raw character index
    // multiplies the scroll by the number of columns and creates the visible
    // overshoot/correction bounce during Enter search.
    const estimatedCenter = boardTop + (safeRowIndex * estimatedHeight) + (estimatedHeight / 2);
    const desired = estimatedCenter - (viewportHeight / 2) + offset;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);

    return Math.max(0, Math.min(maxScroll, desired));
  }

  function cancelFocus(){
    state.focusRunId++;
    clearStableFocusMode();
    document.body.classList.remove('is-board-focusing');
  }

  function focusCharacterById(id, options = {}) {
    if (!id) return false;

    const runId = ++state.focusRunId;

    const attempts = Number.isFinite(options.attempts) ? options.attempts : 12;
    const delay = Number.isFinite(options.delay) ? options.delay : 50;
    const settleFrames = Number.isFinite(options.settleFrames) ? options.settleFrames : 3;
    const offset = Number.isFinite(options.offset) ? options.offset : 0;
    const correctionThreshold = Number.isFinite(options.correctionThreshold) ? options.correctionThreshold : 140;

    document.body.classList.add('is-board-focusing');

    updateEntriesFromApp();

    // Phase 1: one predictive scroll based on the real entry index.
    // This gives the virtual board the correct neighborhood without letting
    // renderAroundId and a later center correction fight each other visibly.
    const predictedTop = predictScrollTopForId(id, offset);

    if (predictedTop !== null) {
      window.scrollTo({ top: predictedTop, behavior: 'auto' });
    }

    // Now render a stable local window around the target, after the scroll is
    // already near it. This mode avoids the normal scroll-driven virtual window
    // recalculation that was snapping from #1200/#1224 back to #800~#869.
    {
      const entryIndex = entryIndexById(id);
      const rowIndex = state.entryIndexToRow[entryIndex] || 0;
      renderStableFocusWindow(rowIndex, id);
    }

    let attempt = 0;
    let settledFrameCount = 0;
    let lastTop = null;
    let stableTopCount = 0;

    const finishFail = () => {
      if (runId !== state.focusRunId) return false;
      document.body.classList.remove('is-board-focusing');
      options.onFail?.();
      return false;
    };

    const computeTargetScrollTop = node => {
      const rect = node.getBoundingClientRect();
      const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
      const nodeCenter = currentScroll + rect.top + (rect.height / 2);
      const desired = nodeCenter - (viewportHeight / 2) + offset;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);

      return Math.max(0, Math.min(maxScroll, desired));
    };

    const finishFocus = node => {
      if (runId !== state.focusRunId) return false;
      if (!node) return finishFail();

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
      const nodeCenterInViewport = rect.top + (rect.height / 2);
      const viewportCenter = viewportHeight / 2;
      const delta = nodeCenterInViewport - viewportCenter;

      // Correction only if meaningfully off-center. This avoids the visible
      // up/down bounce caused by doing a second precise scroll after the
      // virtual board has already moved close enough.
      if (Math.abs(delta) > correctionThreshold) {
        const targetTop = computeTargetScrollTop(node);
        window.scrollTo({ top: targetTop, behavior: 'auto' });
      }

      highlightNode(node, options);
      document.body.classList.remove('is-board-focusing');

      // Keep full stable-board mode active after explicit Search + Enter.
      state.stableFocusMode = true;
      state.stableFocusId = id;

      options.onDone?.(node);

      return true;
    };

    const waitForStableNode = () => {
      if (runId !== state.focusRunId) return false;
      const node = findRenderedNodeById(id);

      if (!node) {
        if (attempt >= attempts) return finishFail();

        attempt++;
        setTimeout(waitForStableNode, delay);
        return false;
      }

      const rect = node.getBoundingClientRect();
      const roundedTop = Math.round(rect.top);

      if (lastTop === roundedTop) {
        stableTopCount++;
      } else {
        stableTopCount = 0;
        lastTop = roundedTop;
      }

      settledFrameCount++;

      if (settledFrameCount < settleFrames || stableTopCount < 1) {
        requestAnimationFrame(waitForStableNode);
        return false;
      }

      return finishFocus(node);
    };

    requestAnimationFrame(waitForStableNode);

    return true;
  }

  window.MudaeBoardController = {
    bind,
    renderEntries,
renderWindow,
    renderAroundId,
    renderStableAroundId,
    updateEntriesFromApp,
    getLimit,
    setLimit,
    getColumnSetting,
    setColumnSetting,
    schedule,
    selectMoveSource,
    getSelectedMoveId,
    moveSourceToTarget,
    clearSelection,
    scheduleSave,
    flushSave,
    cancelFocus,
    focusCharacterById
  };
})();

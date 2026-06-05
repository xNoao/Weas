(function(){
  'use strict';
  let ctx = null;
  let exportSidebarCloseTimer = null;
  let exportSidebarPinned = false;
  const DEFAULT_CHUNK_LIMIT = window.MudaeExportUtils?.DEFAULT_CHUNK_LIMIT || 1850;
  const NITRO_STORAGE_KEY = 'mudae.exportNitroEnabled.v1';
  const CHANGED_HISTORY_KEY = 'mudae.changedExportHistory.v1';
  function requireCtx(){
    if (!ctx) throw new Error('MudaeExports is not initialized.');
    return ctx;
  }
  function escapeHtml(value){
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  function renderMovedNames(names){
    const clean = cleanExplicitCommandNames(names || []);
    if (!clean.length) return '<b>Moved:</b> —';
    return `<b>Moved:</b> ${clean
      .map(name => `<span class="changed-export-name">${escapeHtml(name)}</span>`)
      .join('<span class="changed-export-plus">+</span>')}`;
  }
  function getCharacters(){
    return requireCtx().app.state.characters || [];
  }
  function isMissing(item){
    return !!(item?.missing || item?.isMissing || item?.markedMissing);
  }
  function isExportableCharacter(item){
    const c = requireCtx();
    return item && !c.isDivider(item) && !isMissing(item) && c.str(item.name).trim();
  }
  function getExportName(item){
    const c = requireCtx();
    return c.str(item.exportName || item.name || '').trim();
  }
  function buildChunksFromNames(names, prefix, limit = DEFAULT_CHUNK_LIMIT){
    return window.MudaeExportUtils.buildChunksFromNames(names, prefix, limit);
  }
  function buildChunkRecordsFromNames(names, prefix, limit = DEFAULT_CHUNK_LIMIT){
    return window.MudaeExportUtils.buildChunkRecordsFromNames(names, prefix, limit);
  }
  function formatAffectedNames(names, maxVisible = 4){
    return window.MudaeExportUtils.formatAffectedNames(names, maxVisible);
  }
  function buildMixedSmSmpChunksFromNames(names, limit = DEFAULT_CHUNK_LIMIT){
    return window.MudaeExportUtils.buildMixedSmSmpChunksFromNames(names, limit);
  }
  function getAllExportableCharacters(){
    return getCharacters().filter(isExportableCharacter);
  }
  function buildSmChunks(options = {}){
    const names = getAllExportableCharacters()
      .map(getExportName)
      .filter(Boolean);
    return buildMixedSmSmpChunksFromNames(names, options.limit || getExportLimit());
  }
  function findDividerIndex(dividerId){
    const c = requireCtx();
    return getCharacters().findIndex(item => c.isDivider(item) && item.id === dividerId);
  }
  function getDividerSectionRange(dividerId){
    const c = requireCtx();
    const items = getCharacters();
    const start = findDividerIndex(dividerId);
    if (start < 0) return null;
    const divider = items[start];
    const level = Math.max(1, c.num(divider.level) || 1);
    let end = items.length;
    for (let i = start + 1; i < items.length; i++) {
      const item = items[i];
      if (!c.isDivider(item)) continue;
      const itemLevel = Math.max(1, c.num(item.level) || 1);
      if (itemLevel <= level) {
        end = i;
        break;
      }
    }
    return { start, end, divider, level };
  }
  function getCharactersUnderDivider(dividerId){
    const c = requireCtx();
    const items = getCharacters();
    const range = getDividerSectionRange(dividerId);
    if (!range) return [];
    return items
      .slice(range.start + 1, range.end)
      .filter(item => !c.isDivider(item))
      .filter(isExportableCharacter);
  }
  function buildDividerSmpChunks(dividerId, options = {}){
    const names = getCharactersUnderDivider(dividerId)
      .map(getExportName)
      .filter(Boolean);
    return buildChunksFromNames(names, '$smp', options.limit || getExportLimit());
  }
  function getExportLimit(){
    let enabled = false;
    try {
      enabled = localStorage.getItem(NITRO_STORAGE_KEY) === 'true';
    } catch {}
    return enabled ? 4000 : 2000;
  }
  function setExportLimit(value){
    const enabled = Number(value) === 4000 || value === true || value === 'true';
    try {
      localStorage.setItem(NITRO_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {}
    syncNitroToggle();
    return enabled ? 4000 : 2000;
  }
  function isNitroExportEnabled(){
    return getExportLimit() === 4000;
  }
  function syncNitroToggle(){
    const btn = document.getElementById('exportNitroToggleBtn');
    if (!btn) return;
    const enabled = isNitroExportEnabled();
    btn.classList.toggle('is-on', enabled);
    btn.classList.toggle('is-off', !enabled);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.title = enabled
      ? 'Nitro export limit enabled (4000 chars).'
      : 'Nitro export limit disabled (2000 chars).';
    btn.innerHTML = '<img class="mhp-nitro-svg discord-nitro-icon" src="assets/icons/services/discord-nitro.svg" alt="" aria-hidden="true" decoding="async">';
  }
  function toggleNitroExport(){
    const enabled = !isNitroExportEnabled();
    setExportLimit(enabled);
    renderExportSidebar();
    return enabled;
  }
  function clearExportSidebarTimers(){
    if (exportSidebarCloseTimer) {
      clearTimeout(exportSidebarCloseTimer);
      exportSidebarCloseTimer = null;
    }
  }
  function detachHotspotFromExportSidebar(){
    const hotspot = document.getElementById('exportSidebarHotspot');
    if (!hotspot) return;
    hotspot.classList.remove('is-attached-to-export-sidebar');
    if (hotspot.parentElement !== document.body) {
      document.body.appendChild(hotspot);
    }
  }
  function attachHotspotToExportSidebar(panel){
    const hotspot = ensureExportSidebarHotspot();
    if (!panel || !hotspot) return;
    hotspot.classList.add('is-attached-to-export-sidebar');
    if (hotspot.parentElement !== panel) {
      panel.appendChild(hotspot);
    }
  }
  function pinExportSidebar(){
    clearExportSidebarTimers();
    exportSidebarPinned = true;
    document.body.classList.add('exports-sidebar-pinned');
  }
  function closeExportSidebar(){
    clearExportSidebarTimers();
    exportSidebarPinned = false;
    const panel = document.getElementById('exportSidebar');
    document.body.classList.remove('exports-sidebar-open', 'exports-sidebar-pinned');
    document.body.classList.add('exports-sidebar-closing');
    if (panel) {
      panel.hidden = false;
      panel.classList.add('is-closing');
    }
    detachHotspotFromExportSidebar();
    exportSidebarCloseTimer = setTimeout(() => {
      panel?.classList.remove('is-closing');
      document.body.classList.remove('exports-sidebar-closing');
      exportSidebarCloseTimer = null;
    }, 75);
  }
  function closeExportSidebarSoon(delay = 55){
    if (exportSidebarPinned) return;
    if (exportSidebarCloseTimer) {
      clearTimeout(exportSidebarCloseTimer);
      exportSidebarCloseTimer = null;
    }
    exportSidebarCloseTimer = setTimeout(() => {
      if (exportSidebarPinned) return;
      const panel = document.getElementById('exportSidebar');
      const hotspot = document.getElementById('exportSidebarHotspot');
      if (panel?.matches(':hover') || hotspot?.matches(':hover')) return;
      closeExportSidebar();
    }, delay);
  }
  function handleExportSidebarOutsidePointer(event){
    if (!exportSidebarPinned) return;
    const panel = document.getElementById('exportSidebar');
    const hotspot = document.getElementById('exportSidebarHotspot');
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panel?.contains(target) || hotspot?.contains(target)) return;
    closeExportSidebar();
  }
  function ensureExportSidebarHotspot(){
    let hotspot = document.getElementById('exportSidebarHotspot');
    if (hotspot) return hotspot;
    hotspot = document.createElement('div');
    hotspot.id = 'exportSidebarHotspot';
    hotspot.className = 'export-sidebar-hotspot';
    hotspot.title = 'Hover to open Commands';
    hotspot.innerHTML = '<span>Commands</span>';
    document.body.appendChild(hotspot);
    document.addEventListener('pointerdown', handleExportSidebarOutsidePointer, true);
    hotspot.addEventListener('mouseenter', () => {
      if (exportSidebarPinned) return;
      openExportSidebar();
    });
    hotspot.addEventListener('mouseleave', () => {
      closeExportSidebarSoon();
    });
    return hotspot;
  }
  function setFullExportOpen(panel, open, options = {}){
    const section = panel?.querySelector?.('#fullExportSection');
    const chunks = panel?.querySelector?.('#exportSidebarChunks');
    const button = panel?.querySelector?.('#fullExportToggleBtn');
    if (!section || !chunks || !button) return false;
    section.classList.toggle('is-collapsed', !open);
    chunks.hidden = !open;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.textContent = open ? 'Close' : 'Open';
    if (open && options.render !== false) {
      renderExportSidebar();
      section.classList.remove('is-collapsed');
      chunks.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.textContent = 'Close';
    }
    return true;
  }
  function toggleFullExportSidebar(panel){
    const section = panel?.querySelector?.('#fullExportSection');
    if (!section) return false;
    const open = section.classList.contains('is-collapsed');
    return setFullExportOpen(panel, open, { render: true });
  }
  function ensureExportSidebar(){
    let panel = document.getElementById('exportSidebar');
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.id = 'exportSidebar';
    panel.className = 'export-sidebar';
    panel.hidden = true;
    panel.innerHTML = `
      <header class="export-menu-head">
        <div>
          <h2>Export Zone</h2>
          <p>Copy changed zones or full $smp chunks.</p>
        </div>
        <button id="exportNitroToggleBtn" class="mhp-nitro-icon-btn export-nitro-toggle export-header-nitro-btn is-off" type="button" aria-pressed="false" title="Nitro export OFF" aria-label="Nitro export OFF">
            <img class="mhp-nitro-svg" src="assets/icons/services/discord-nitro.svg" alt="" aria-hidden="true" decoding="async">
          </button>
      </header>
      <div id="changedExportsMount"></div>
      <section id="fullExportSection" class="export-menu-section full-export-section is-collapsed">
        <header class="export-section-head full-export-header">
          <div class="export-section-title full-export-title">
            <strong>Full export</strong>
            <small id="exportSidebarMeta">0 exportable characters · 0 chunks</small>
          </div>
          <button id="fullExportToggleBtn" class="mhp-menu-btn export-neutral-btn full-export-open-btn" type="button" aria-expanded="false">Open</button>
        </header>
        <div id="exportSidebarChunks" class="export-sidebar-chunks" hidden></div>
      </section>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('mouseenter', () => {
      clearExportSidebarTimers();
    });
    panel.addEventListener('mouseleave', () => {
      closeExportSidebarSoon();
    });
    panel.addEventListener('pointerdown', () => {
      pinExportSidebar();
    }, true);
    panel.querySelector('#exportNitroToggleBtn')?.addEventListener('click', () => {
      toggleNitroExport();
    });
    panel.querySelector('#exportSidebarRefreshBtn')?.addEventListener('click', () => renderExportSidebar());
    panel.querySelector('#fullExportToggleBtn')?.addEventListener('click', () => {
      const section = panel.querySelector('#fullExportSection');
      const chunks = panel.querySelector('#exportSidebarChunks');
      const button = panel.querySelector('#fullExportToggleBtn');
      if (!section || !chunks || !button) return;
      const shouldOpen = section.classList.contains('is-collapsed');
      if (shouldOpen) {
        section.classList.remove('is-collapsed');
        chunks.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        button.textContent = 'Close';
        renderExportSidebar();
        const refreshedPanel = document.getElementById('exportSidebar');
        const refreshedSection = refreshedPanel?.querySelector('#fullExportSection');
        const refreshedChunks = refreshedPanel?.querySelector('#exportSidebarChunks');
        const refreshedButton = refreshedPanel?.querySelector('#fullExportToggleBtn');
        refreshedSection?.classList.remove('is-collapsed');
        if (refreshedChunks) refreshedChunks.hidden = false;
        if (refreshedButton) {
          refreshedButton.setAttribute('aria-expanded', 'true');
          refreshedButton.textContent = 'Close';
        }
      } else {
        section.classList.add('is-collapsed');
        chunks.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        button.textContent = 'Open';
      }
    });
    syncNitroToggle();
    return panel;
  }
  function setFullExportCollapsed(panel, collapsed = true){
    if (!panel) return;
    const section = panel.querySelector('#fullExportSection');
    const chunks = panel.querySelector('#exportSidebarChunks');
    const button = panel.querySelector('#fullExportToggleBtn');
    if (section) section.classList.toggle('is-collapsed', collapsed);
    if (chunks) chunks.hidden = collapsed;
    if (button) {
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
  }
  function renderExportSidebar(){
    const c = requireCtx();
    const panel = ensureExportSidebar();
    const wasFullOpen = !!panel.querySelector('#fullExportSection') && !panel.querySelector('#fullExportSection').classList.contains('is-collapsed');
    setFullExportCollapsed(panel, !wasFullOpen);
    const limit = getExportLimit();
    const chunks = buildSmChunks({ limit });
    const characters = getAllExportableCharacters();
    const meta = panel.querySelector('#exportSidebarMeta');
    const list = panel.querySelector('#exportSidebarChunks');
    panel.__chunks = chunks;
    syncNitroToggle();
    meta.textContent = `${characters.length} exportable characters · ${chunks.length} chunk${chunks.length === 1 ? '' : 's'} · ${limit} chars limit`;
    const fullSection = panel.querySelector('#fullExportSection');
    const isFullOpen = fullSection && !fullSection.classList.contains('is-collapsed');
    list.hidden = !isFullOpen;
    list.replaceChildren();
    if (!chunks.length) {
      const empty = document.createElement('div');
      empty.className = 'export-sidebar-empty';
      empty.textContent = 'No exportable characters found.';
      list.appendChild(empty);
      renderChangedExportsSection(panel);
      return panel;
    }
    chunks.forEach((chunk, index) => {
      const row = document.createElement('section');
      row.className = 'export-sidebar-chunk export-menu-chunk';
      row.innerHTML = `
        <header class="export-chunk-head export-sidebar-chunk-head">
          <strong>${index === 0 ? '$sm' : '$smp'} Chunk ${index + 1}</strong>
          <span>${chunk.length}/${limit} chars</span>
        </header>
        <div class="export-command-row">
          <input class="export-sidebar-text export-menu-command" readonly>
          <button class="mhp-menu-btn export-neutral-btn export-sidebar-copy-one" type="button">Copy</button>
        </div>
      `;
      const text = row.querySelector('.export-sidebar-text');
      text.value = chunk;
      row.querySelector('.export-sidebar-copy-one').addEventListener('click', async () => {
        const copied = await copyText(chunk);
        if (copied) {
          c.notifyAppMessage(`Copied ${index === 0 ? '$sm' : '$smp'} chunk ${index + 1}.`);
        }
      });
      list.appendChild(row);
    });
    renderChangedExportsSection(panel);
    if (wasFullOpen) {
      const fullSectionAfter = panel.querySelector('#fullExportSection');
      const chunksAfter = panel.querySelector('#exportSidebarChunks');
      const buttonAfter = panel.querySelector('#fullExportToggleBtn');
      fullSectionAfter?.classList.remove('is-collapsed');
      if (chunksAfter) chunksAfter.hidden = false;
      if (buttonAfter) {
        buttonAfter.setAttribute('aria-expanded', 'true');
        buttonAfter.textContent = 'Close';
      }
    }
    return panel;
  }
  function openExportSidebar(){
    clearExportSidebarTimers();
    const panel = renderExportSidebar();
    attachHotspotToExportSidebar(panel);
    panel.hidden = false;
    panel.classList.remove('is-closing');
    document.body.classList.remove('exports-sidebar-closing');
    document.body.classList.add('exports-sidebar-open');
    document.body.classList.toggle('exports-sidebar-pinned', exportSidebarPinned);
    return panel;
  }
  async function copyText(text){
    const c = requireCtx();
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      area.style.top = '0';
      document.body.appendChild(area);
      area.focus();
      area.select();
      try {
        document.execCommand('copy');
        area.remove();
        return true;
      } catch (fallbackError) {
        area.remove();
        console.error(fallbackError);
        await c.showAppAlert('Could not copy automatically. The export text will be shown so you can copy it manually.', {
          title: 'Copy failed',
          variant: 'danger'
        });
        return false;
      }
    }
  }
  async function showExportChunks(title, chunks){
    const c = requireCtx();
    if (!chunks.length) {
      await c.showAppAlert('No exportable characters found.', {
        title,
        variant: 'danger'
      });
      return false;
    }
    const ok = await c.showAppDialog({
      type: 'confirm',
      title,
      message: `${chunks.length} chunk${chunks.length === 1 ? '' : 's'} ready.`,
      okText: chunks.length === 1 ? 'Copy' : 'Copy all',
      cancelText: 'Close',
      renderContent(content) {
        content.innerHTML = `
          <div class="export-dialog">
            <div class="export-dialog-summary">
              <strong>${chunks.length}</strong>
              <span>chunk${chunks.length === 1 ? '' : 's'}</span>
            </div>
            <div class="export-chunk-list"></div>
          </div>
        `;
        const list = content.querySelector('.export-chunk-list');
        chunks.forEach((chunk, index) => {
          const row = document.createElement('div');
          row.className = 'export-chunk-row';
          row.innerHTML = `
            <div class="export-chunk-head">
              <strong>Chunk ${index + 1}</strong>
              <span>${chunk.length} chars</span>
            </div>
            <textarea class="export-chunk-text" readonly></textarea>
            <button class="btn btn-ghost export-copy-one" type="button">Copy chunk</button>
          `;
          const text = row.querySelector('.export-chunk-text');
          text.value = chunk;
          row.querySelector('.export-copy-one').addEventListener('click', async event => {
            event.preventDefault();
            await copyText(chunk);
            c.notifyAppMessage(`Copied chunk ${index + 1}.`);
          });
          list.appendChild(row);
        });
      }
    });
    if (!ok) return false;
    const copied = await copyText(chunks.join('\n\n'));
    if (copied) {
      c.notifyAppMessage(`${title} copied.`);
      return true;
    }
    return false;
  }
  async function copyExportChunksDirect(title, chunks){
    const c = requireCtx();
    if (!chunks.length) {
      c.notifyAppMessage(`${title}: no exportable characters.`);
      return false;
    }
    const copied = await copyText(chunks.join('\n\n'));
    if (copied) {
      c.notifyAppMessage(`${title} copied (${chunks.length} chunk${chunks.length === 1 ? '' : 's'}).`);
      return true;
    }
    await showExportChunks(title, chunks);
    return false;
  }
  function getCharacterDisplayPositionById(id){
    const c = requireCtx();
    const items = getCharacters();
    let position = 0;
    for (const item of items) {
      if (c.isDivider(item)) continue;
      position++;
      if (item.id === id) return position;
    }
    return 0;
  }
  function clampChangedRange(center, radius = 1){
    return window.MudaeExportUtils.clampDisplayRange(center, getAllExportableCharacters().length || 0, radius);
  }
  function getChangedHistory(){
    try {
      const raw = sessionStorage.getItem(CHANGED_HISTORY_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function cleanExplicitCommandNames(names){
    return window.MudaeExportUtils.cleanNameList(names);
  }
  function setChangedHistory(history){
    const clean = (history || [])
      .filter(item => item && Number(item.toPosition))
      .map(item => ({
        ...item,
        commandNames: cleanExplicitCommandNames(item.commandNames || item.explicitNames || [])
      }))
      .slice(-5);
    try {
      sessionStorage.setItem(CHANGED_HISTORY_KEY, JSON.stringify(clean));
    } catch {}
    window.dispatchEvent(new CustomEvent('mudae:changed-export-zones-change', {
      detail: { history: clean, zones: clean.map(item => ({ start: item.start, end: item.end })) }
    }));
    return clean;
  }
  function getChangedZones(){
    return getChangedHistory().map(item => ({
      start: item.start,
      end: item.end,
      center: item.center || item.toPosition,
      id: item.id,
      name: item.name,
      fromPosition: item.fromPosition,
      toPosition: item.toPosition,
      at: item.at,
      commandNames: cleanExplicitCommandNames(item.commandNames || item.explicitNames || [])
    }));
  }
  function recordChangedMove(fromPosition, toPosition, options = {}){
    const c = requireCtx();
    const radius = Number.isFinite(options.radius) ? options.radius : 1;
    const explicitStart = Number(options.startPosition || options.start || 0);
    const explicitEnd = Number(options.endPosition || options.end || 0);
    const baseRange = clampChangedRange(toPosition, radius);
    const total = getAllExportableCharacters().length || 0;
    const hasExplicitRange = explicitStart > 0 || explicitEnd > 0;
    const range = hasExplicitRange
      ? {
          start: Math.max(1, explicitStart || baseRange.start),
          end: Math.min(total || Number.MAX_SAFE_INTEGER, explicitEnd || explicitStart || baseRange.end),
          center: Math.max(1, Number(toPosition) || baseRange.center || explicitStart || 1)
        }
      : baseRange;
    if (range.end < range.start) range.end = range.start;
    const id = options.id || '';
    const name = options.name || '';
    const entry = {
      id: id || `move-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      fromPosition: Number(fromPosition) || 0,
      toPosition: Number(toPosition) || range.center,
      center: range.center,
      start: range.start,
      end: range.end,
      commandNames: cleanExplicitCommandNames(options.commandNames || options.explicitNames || []),
      at: Date.now()
    };
    const history = setChangedHistory([...getChangedHistory(), entry]);
    renderChangedExportsIfOpen();
    c.notifyAppMessage?.(`Changed export added: #${entry.start}-${entry.end}.`);
    return history;
  }
  function recordChangedRange(centerPosition, startPosition, endPosition, options = {}){
    return recordChangedMove(options.fromPosition || 0, centerPosition, {
      ...options,
      startPosition,
      endPosition
    });
  }
  function recordChangedMoveById(id, fromPosition, options = {}){
    const toPosition = getCharacterDisplayPositionById(id);
    const item = getCharacters().find(ch => ch.id === id);
    return recordChangedMove(fromPosition, toPosition, {
      ...options,
      id,
      name: item?.name || ''
    });
  }
  function clearChangedExports(){
    setChangedHistory([]);
    renderChangedExportsIfOpen();
  }
  function getExportableCharactersInDisplayRange(start, end){
    const c = requireCtx();
    let position = 0;
    const result = [];
    getCharacters().forEach(item => {
      if (c.isDivider(item)) return;
      position++;
      if (position < start || position > end) return;
      if (!isExportableCharacter(item)) return;
      result.push(item);
    });
    return result;
  }
  function getStoredChangedRange(entry, radius = 1){
    return window.MudaeExportUtils.normalizeStoredRange(entry, getAllExportableCharacters().length || 0, radius);
  }
  function getMergedChangedExportGroups(options = {}){
    const radius = Number.isFinite(options.radius) ? options.radius : 1;
    const proximity = Number.isFinite(options.proximity) ? options.proximity : 3;
    const history = getChangedHistory()
      .map((entry, index) => {
        const range = getStoredChangedRange(entry, radius);
        const commandNames = cleanExplicitCommandNames(entry.commandNames || entry.explicitNames || []);
        return {
          ...entry,
          commandNames,
          hasExplicitCommandNames: commandNames.length > 0,
          sourceIndexes: [index],
          sourceNames: entry.name ? [entry.name] : [],
          start: range.start,
          end: commandNames.length ? Math.max(range.start, range.start + commandNames.length - 1) : range.end,
          center: range.center
        };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const groups = [];
    history.forEach(entry => {
      const last = groups[groups.length - 1];
      const mustStaySeparate = !!(entry.hasExplicitCommandNames || last?.hasExplicitCommandNames);
      if (!last || mustStaySeparate || entry.start > last.end + proximity) {
        groups.push({ ...entry });
        return;
      }
      last.end = Math.max(last.end, entry.end);
      last.center = Math.round((last.start + last.end) / 2);
      last.sourceIndexes.push(...entry.sourceIndexes);
      last.sourceNames.push(...entry.sourceNames);
      last.toPosition = entry.toPosition || last.toPosition;
      last.at = Math.max(last.at || 0, entry.at || 0);
    });
    return groups
      .map(group => ({
        ...group,
        sourceNames: Array.from(new Set(group.sourceNames.filter(Boolean)))
      }))
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .map((group, index) => ({
        ...group,
        groupIndex: index
      }));
  }
  function buildChangedSmpChunks(options = {}){
    const limit = options.limit || getExportLimit();
    const groups = getMergedChangedExportGroups(options);
    const chunks = [];
    groups.forEach((group, groupIndex) => {
      const names = cleanExplicitCommandNames(group.commandNames).length
        ? cleanExplicitCommandNames(group.commandNames)
        : getExportableCharactersInDisplayRange(group.start, group.end)
          .map(getExportName)
          .filter(Boolean);
      const zoneChunks = buildChunkRecordsFromNames(names, '$smp', limit);
      zoneChunks.forEach((record, chunkIndex) => {
        const affectedNames = record.names || [];
        chunks.push({
          groupIndex,
          chunkIndex,
          sourceCount: group.sourceIndexes.length,
          start: group.start,
          end: group.end,
          center: group.center,
          names: affectedNames,
          affectedNames,
          affectedCount: affectedNames.length,
          label: formatAffectedNames(affectedNames),
          at: group.at,
          text: record.text
        });
      });
    });
    return chunks;
  }
  function renderChangedExportsIfOpen(){
    const panel = document.getElementById('exportSidebar');
    if (!panel || panel.hidden) return;
    renderChangedExportsSection(panel);
  }
  function renderChangedExportsSection(panel = ensureExportSidebar()){
    const c = requireCtx();
    let section = panel.querySelector('#changedExportsSection');
    if (!section) {
      section = document.createElement('section');
      section.id = 'changedExportsSection';
      section.className = 'changed-exports-section';
      const mount = panel.querySelector('#changedExportsMount');
      if (mount) {
        mount.appendChild(section);
      } else {
        const chunksContainer = panel.querySelector('#exportSidebarChunks');
        chunksContainer?.before(section);
      }
    }
    const history = getChangedHistory();
    const groups = getMergedChangedExportGroups();
    const chunks = buildChangedSmpChunks({ limit: getExportLimit() });
    section.className = 'export-menu-section changed-exports-section';
    section.innerHTML = `
      <header class="export-section-head changed-exports-head">
        <div class="export-section-title">
          <strong>Changed zones</strong>
          <small>${history.length} recent move zone${history.length === 1 ? '' : 's'} · ${chunks.length} chunk${chunks.length === 1 ? '' : 's'}</small>
        </div>
        <div class="changed-exports-actions">
          <button id="clearChangedExportsBtn" class="mhp-menu-btn export-neutral-btn" type="button"${history.length ? '' : ' disabled'}>Clear</button>
        </div>
      </header>
      <div class="changed-exports-list"></div>
    `;
    const list = section.querySelector('.changed-exports-list');
    if (!history.length) {
      const empty = document.createElement('div');
      empty.className = 'changed-exports-empty';
      empty.textContent = 'Move a character to generate small $smp exports like #1499-#1501.';
      list.appendChild(empty);
    } else {
      chunks.forEach((entry, index) => {
        const affectedCount = Number(entry.affectedCount || entry.affectedNames?.length || entry.names?.length || 0);
        const affectedText = `${affectedCount} character${affectedCount === 1 ? '' : 's'} · ${entry.chunkIndex + 1} chunk${entry.chunkIndex + 1 === 1 ? '' : 's'}`;
        const zoneTitle = entry.sourceNames?.[0] || entry.label || `Zone #${entry.start}-${entry.end}`;
        const row = document.createElement('article');
        row.className = entry.sourceCount > 1 ? 'changed-export-zone changed-export-row export-menu-changed-row is-merged' : 'changed-export-zone changed-export-row export-menu-changed-row';
        row.innerHTML = `
          <header class="changed-export-zone-head changed-export-row-head">
            <strong>${escapeHtml(zoneTitle)}</strong>
            <small>#${entry.start}-${entry.end} · ${affectedText}</small>
          </header>
          <div class="changed-export-row-label changed-export-placed">${renderMovedNames(entry.affectedNames || entry.names)}</div>
          <div class="export-command-row">
            <input class="export-sidebar-text changed-export-text is-click-copy export-menu-command" readonly title="Click to copy this $smp command">
            <button class="mhp-menu-btn export-neutral-btn changed-export-copy-one" type="button">Copy</button>
          </div>
        `;
        const text = row.querySelector('.changed-export-text');
        text.value = entry.text;
        const copyChanged = async () => {
          const copied = await copyText(entry.text);
          if (copied) c.notifyAppMessage(`Copied changed $smp ${index + 1}.`);
        };
        text.addEventListener('click', copyChanged);
        row.querySelector('.changed-export-copy-one')?.addEventListener('click', copyChanged);
        list.appendChild(row);
      });
    }
    section.querySelector('#clearChangedExportsBtn')?.addEventListener('click', () => {
      clearChangedExports();
      c.notifyAppMessage('Changed export history cleared.');
    });
    return section;
  }
  async function exportSm(){
    openExportSidebar();
    return true;
  }
  async function exportDividerSmp(dividerId){
    const range = getDividerSectionRange(dividerId);
    const title = range?.divider?.title || 'Divider';
    return copyExportChunksDirect(`$smp · ${title}`, buildDividerSmpChunks(dividerId, { limit: getExportLimit() }));
  }
  function init(context){
    ctx = context;
    requestAnimationFrame(() => {
      ensureExportSidebarHotspot();
    });
  }
  window.MudaeExports = {
    init,
    buildSmChunks,
    buildDividerSmpChunks,
    getDividerSectionRange,
    getCharactersUnderDivider,
    exportSm,
    exportDividerSmp,
    openExportSidebar,
    renderExportSidebar,
    getExportLimit,
    setExportLimit,
    isNitroExportEnabled,
    toggleNitroExport,
    closeExportSidebar,
    closeExportSidebarSoon,
    recordChangedMove,
    recordChangedRange,
    recordChangedMoveById,
    getChangedZones,
    getChangedHistory,
    clearChangedExports,
    buildChangedSmpChunks,
    getMergedChangedExportGroups
  };
})();

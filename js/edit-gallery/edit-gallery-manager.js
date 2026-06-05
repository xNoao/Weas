(() => {
  'use strict';
  const state = {
    version: 'v2.481-clean-stable',
    suppressUntil: 0,
    saving: false,
    openIntent: null,
    programmaticOpenUntil: 0,
    lastAction: '',
    lastBlockedOpen: null,
    debug: false
  };
  const now = () => (performance.now ? performance.now() : Date.now());
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const api = () => window.MUDAE_REBUILD_V1 || null;
  const app = () => api()?.app || window.app || null;
  const els = () => api()?.els || {};
  const internals = () => api()?.__editGalleryInternals || {};
  function log(...args) {
    if (state.debug) console.info('[MHP edit/gallery manager]', ...args);
  }
  function setSuppress(ms = 1600, reason = 'close') {
    const duration = Math.max(0, Number(ms) || 0);
    if (!duration) return getSuppressUntil();
    const until = now() + duration;
    state.suppressUntil = Math.max(state.suppressUntil, until);
    state.lastAction = reason;
    window.__mhpEditClosingUntil = Math.max(Number(window.__mhpEditClosingUntil || 0), until);
    window.__mhpSuppressEditOpenUntil = Math.max(Number(window.__mhpSuppressEditOpenUntil || 0), until);
    window.__mhpPostEditRestoreBlockedUntil = Math.max(Number(window.__mhpPostEditRestoreBlockedUntil || 0), until);
    document.documentElement.classList.add('mhp-edit-closing', 'mhp-edit-gallery-saving');
    document.body?.classList?.add('mhp-edit-closing', 'mhp-edit-gallery-saving');
    setTimeout(() => {
      if (now() >= getSuppressUntil()) {
        document.documentElement.classList.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
        document.body?.classList?.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
      }
    }, duration + 120);
    log('suppress', { reason, duration, until });
    return until;
  }
  function clearSuppress(reason = 'clear') {
    state.suppressUntil = 0;
    state.saving = false;
    state.lastAction = reason;
    window.__mhpEditClosingUntil = 0;
    window.__mhpSuppressEditOpenUntil = 0;
    window.__mhpPostEditRestoreBlockedUntil = 0;
    document.documentElement.classList.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
    document.body?.classList?.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
    return 0;
  }
  function getSuppressUntil() {
    return Math.max(
      Number(state.suppressUntil || 0),
      Number(window.__mhpEditClosingUntil || 0),
      Number(window.__mhpSuppressEditOpenUntil || 0),
      Number(window.__mhpPostEditRestoreBlockedUntil || 0)
    );
  }
  function isSuppressed() {
    if (now() >= getSuppressUntil()) return false;
    const e = els();
    const overlayOpen = !!e.editOverlay?.classList?.contains('show');
    const stillClosing = document.documentElement.classList.contains('mhp-edit-closing') ||
      document.body?.classList?.contains('mhp-edit-closing');
    return overlayOpen || stillClosing;
  }
  function blockOpen(id = '', source = 'unknown', reason = 'blocked') {
    state.lastBlockedOpen = {
      id,
      source,
      reason,
      at: Date.now(),
      remainingMs: Math.max(0, Math.ceil(getSuppressUntil() - now())),
      intent: state.openIntent ? { ...state.openIntent } : null
    };
    log('blocked openEdit', state.lastBlockedOpen);
    return true;
  }
  function getCardIdFromTarget(target) {
    const host = target?.closest?.('[data-id]');
    return host?.dataset?.id || '';
  }
  function rememberOpenIntent(event, reason = 'user') {
    const target = event?.target;
    const opener = target?.closest?.('.card-edit-btn, .edit-btn, [data-action="edit"], [data-mhp-action="edit"], [aria-label^="Edit"]');
    if (!opener) return false;
    const id = getCardIdFromTarget(opener);
    if (!id) return false;
    state.openIntent = {
      id,
      reason,
      type: event.type || '',
      trusted: event.isTrusted !== false,
      at: now(),
      until: now() + 1200
    };
    log('remember open intent', state.openIntent);
    return true;
  }
  function consumeOpenIntent(id = '') {
    const intent = state.openIntent;
    if (!intent) return false;
    if (now() > Number(intent.until || 0)) {
      state.openIntent = null;
      return false;
    }
    if (intent.trusted === false) {
      state.openIntent = null;
      return false;
    }
    if (id && intent.id && String(id) !== String(intent.id)) {
      state.openIntent = null;
      return false;
    }
    state.openIntent = null;
    return true;
  }
  function allowProgrammaticOpen(ms = 800, id = '') {
    state.programmaticOpenUntil = Math.max(state.programmaticOpenUntil, now() + Math.max(0, Number(ms) || 0));
    state.openIntent = id ? { id, reason: 'programmatic-allow', type: 'api', trusted: true, at: now(), until: state.programmaticOpenUntil } : state.openIntent;
    return state.programmaticOpenUntil;
  }
  function shouldBlockOpen(id = '', source = 'unknown') {
    if (isSuppressed()) {
      const e = els();
      const overlayOpen = !!e.editOverlay?.classList?.contains('show');
      if (source === 'openEdit' && !overlayOpen) {
        clearSuppress('real-user-open');
        return false;
      }
      return blockOpen(id, source, 'suppressed-after-close-or-save');
    }
    if (source === 'openEdit') {
      return false;
    }
    return false;
  }
  function normalizeUrl(url) {
    return String(url || '').trim().replace(/[.,;)]+$/g, '').replace(/\]+$/g, '').replace(/\}+$/g, '');
  }
  function canonicalUrl(url) {
    return normalizeUrl(url).replace(/^https?:/i, '').replace(/\?.*$/, '').toLowerCase();
  }
  function dedupeUrls(urls) {
    const seen = new Set();
    const out = [];
    (Array.isArray(urls) ? urls : []).forEach(url => {
      const clean = normalizeUrl(url);
      if (!clean) return;
      if (!/^https?:\/\//i.test(clean) && !/^file:/i.test(clean) && !/^data:image\//i.test(clean)) return;
      const key = canonicalUrl(clean);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    });
    return out;
  }
  function mergeGalleryUrlsPreserveAbsoluteOrder(existingUrls = [], incomingUrls = [], fallbackImage = '') {
    const internalsMerge = internals().mergeGalleryUrlsPreserveAbsoluteOrder;
    if (typeof internalsMerge === 'function') {
      try { return internalsMerge(existingUrls, incomingUrls, fallbackImage); } catch (_) {}
    }
    const out = [];
    const seen = new Set();
    const add = url => {
      const clean = normalizeUrl(url || '');
      if (!clean) return;
      const key = canonicalUrl(clean);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };
    (Array.isArray(existingUrls) ? existingUrls : []).forEach(add);
    (Array.isArray(incomingUrls) ? incomingUrls : []).forEach(add);
    if (!out.length) add(fallbackImage);
    return out;
  }
  function effectiveGalleryCount(ch) {
    const f = internals().getEffectiveMudaeGalleryCount;
    if (typeof f === 'function') {
      try { return Number(f(ch) || 0); } catch (_) {}
    }
    const gallery = dedupeUrls(Array.isArray(ch?.mudaeImages) ? ch.mudaeImages : []);
    const urls = gallery.length ? gallery : dedupeUrls([ch?.imageUrl, ch?.image]);
    return urls.length > 1 ? urls.length : 0;
  }
  function syncGalleryFlags(ch) {
    const sync = internals().syncMudaeGalleryFlags;
    if (typeof sync === 'function') {
      try { return Number(sync(ch) || 0); } catch (_) {}
    }
    const count = effectiveGalleryCount(ch);
    if (ch) {
      ch.hasMudaeGallery = count > 0;
      ch.mudaeGalleryCount = count;
    }
    return count;
  }
  function parseNumber(value) {
    const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  function currentId() {
    const e = els();
    return e.editIdInput?.value || app()?.activeId || $('#editIdInput')?.value || '';
  }
  function getCharacter(id = currentId()) {
    return internals().getCharacter?.(id) || app()?.state?.characters?.find(ch => ch?.id === id) || null;
  }
  function readSpheres() {
    if (typeof internals().readSpheresInputs === 'function') return internals().readSpheresInputs();
    const grid = els().spheresGrid || $('#spheresGrid');
    if (!grid) return null;
    const levels = $$('[data-sphere-index]', grid)
      .sort((a, b) => parseNumber(a.dataset.sphereIndex) - parseNumber(b.dataset.sphereIndex))
      .map((input, index) => {
        const max = index < 5 ? 6 : 1;
        return Math.max(0, Math.min(max, parseNumber(input.value)));
      });
    return levels.some(Boolean) ? { levels } : null;
  }
  function getGalleryUrlsFromDom() {
    const a = app();
    if (Array.isArray(a?.lastGalleryUrls) && a.lastGalleryUrls.length) {
      return dedupeUrls(a.lastGalleryUrls);
    }
    if (Array.isArray(a?.lastGalleryItems) && a.lastGalleryItems.length) {
      return dedupeUrls(a.lastGalleryItems.map(item => item?.url || item?.imageUrl || item?.src || item).filter(Boolean));
    }
    const grid = els().galleryGrid || $('#galleryGrid');
    const urls = [];
    if (grid) {
      $$('[data-image-url]', grid).forEach(node => urls.push(node.dataset.imageUrl));
    }
    return dedupeUrls(urls);
  }
  function snapshotForm() {
    const e = els();
    const image = normalizeUrl(e.editImageInput?.value || $('#editImageInput')?.value || '');
    return {
      id: currentId(),
      name: String(e.editNameInput?.value || $('#editNameInput')?.value || '').trim(),
      series: String(e.editSeriesInput?.value || $('#editSeriesInput')?.value || '').trim(),
      image,
      globalRank: parseNumber(e.editRankInput?.value || $('#editRankInput')?.value),
      kakera: parseNumber(e.editKakeraInput?.value || $('#editKakeraInput')?.value),
      keys: parseNumber(e.editKeysInput?.value || $('#editKeysInput')?.value),
      owner: String(e.editOwnerInput?.value || $('#editOwnerInput')?.value || '').trim(),
      roulette: String(e.editRouletteInput?.value || $('#editRouletteInput')?.value || '').trim(),
      color: internals().syncEmbedColorPreview?.('text', { commit: true }) || String($('#editColorInput')?.value || '').trim(),
      note: String(e.editNoteInput?.value || $('#editNoteInput')?.value || '').trim(),
      spheres: readSpheres(),
      galleryUrls: getGalleryUrlsFromDom()
    };
  }
  function closeGallery(clear = false) {
    const e = els();
    const int = internals();
    if (e.galleryPanel) {
      e.galleryPanel.hidden = true;
      e.galleryPanel.setAttribute('hidden', '');
      e.galleryPanel.classList.remove('show', 'is-open', 'expanded');
      e.galleryPanel.setAttribute('aria-hidden', 'true');
    }
    document.body?.classList?.remove('gallery-open');
    e.editBody?.classList?.remove('mudae-side-active');
    e.editModal?.classList?.remove('mudae-side-active');
    if (e.galleryToggleBtn) {
      e.galleryToggleBtn.textContent = '›';
      e.galleryToggleBtn.setAttribute('aria-expanded', 'false');
    }
    if (clear) int.clearGallery?.(false);
  }
  function hardClose(reason = 'close', suppressMs = 1600) {
    setSuppress(suppressMs, reason);
    const e = els();
    const a = app();
    const int = internals();
    try { int.toggleEditColorPalette?.(false); } catch (_) {}
    closeGallery(false);
    e.editOverlay?.classList?.remove('show', 'is-fast-paint');
    e.editOverlay?.setAttribute?.('aria-hidden', 'true');
    document.body?.classList?.remove('modal-open');
    document.documentElement?.classList?.remove('modal-open');
    if (a) {
      a.activeId = null;
      a.selectedGalleryIndex = null;
      a.editOpenAnchor = null;
      a.editSessionId = null;
      a.pendingJumpHighlightId = null;
      a.pendingInitialViewRestore = null;
    }
    window.__mhpEditSessionId = null;
    try { window.MHPClearTabVisibilitySnapshot?.(); } catch (_) {}
    try { int.unlockPageScrollIfAllowed?.(); } catch (_) {}
  }
  function updateCharacterData(ch, data) {
    ch.name = data.name || ch.name || 'Unnamed';
    ch.series = data.series;
    ch.stableKey = internals().makeStableKey?.(ch.name, ch.series) || `${String(ch.name).toLowerCase()}::${String(ch.series).toLowerCase()}`;
    ch.image = data.image;
    ch.imageUrl = data.image;
    ch.globalRank = data.globalRank;
    ch.kakera = data.kakera;
    ch.keys = data.keys;
    ch.owner = data.owner;
    ch.roulette = data.roulette;
    ch.color = data.color;
    ch.keyType = internals().getKeyTypeFromCount?.(ch.keys) || ch.keyType;
    ch.note = data.note;
    ch.spheres = data.spheres;
    const urls = dedupeUrls(data.galleryUrls);
    ch.mudaeImages = mergeGalleryUrlsPreserveAbsoluteOrder(
      Array.isArray(ch.mudaeImages) ? ch.mudaeImages : [],
      urls,
      data.image
    );
    try { internals().normalizeCharacterImageGalleryPreserveOrder?.(ch); } catch (_) {}
    syncGalleryFlags(ch);
  }
  const KEY_TIER_CLASSES = ['bronze', 'silver', 'gold', 'chaos'];
  const KAKERA_TIER_CLASSES = ['purple', 'blue', 'teal', 'green', 'yellow', 'orange', 'red', 'rainbow'];
  function model() {
    return window.MudaeRebuildModel || {};
  }
  function clearStatTextClasses(node) {
    if (!node) return;
    node.classList.remove('stat-text-normal', 'stat-text-long', 'stat-text-huge', 'stat-is-compacted');
  }
  function parseInteger(value) {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  function compactNumber(value, options = {}) {
    const n = parseInteger(value);
    const fullNumber = Number(n || 0).toLocaleString('en-US');
    const prefix = options.prefix || '';
    const full = prefix + fullNumber;
    const compactAt = Number(options.compactAt || 1000000);
    if (n < compactAt) return { short: full, full, compacted: false, digits: String(n).length };
    const units = [[1_000_000_000_000, 'T'], [1_000_000_000, 'B'], [1_000_000, 'M'], [1_000, 'K']];
    const [size, suffix] = units.find(([unitSize]) => n >= unitSize) || units[units.length - 1];
    const scaled = n / size;
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const mode = options.rounding || 'round';
    const factor = Math.pow(10, decimals);
    const adjusted = mode === 'floor' ? Math.floor(scaled * factor) / factor : Number(scaled.toFixed(decimals));
    return { short: prefix + adjusted.toFixed(decimals).replace(/\.0+$|(?<=\.\d)0$/g, '') + suffix, full, compacted: true, digits: String(n).length };
  }
  function applyCompactStatClass(node, info) {
    if (!node || !info) return;
    node.classList.remove('stat-text-normal', 'stat-text-long', 'stat-text-huge', 'stat-is-compacted');
    const textLen = String(info.short || '').length;
    if (info.compacted) node.classList.add('stat-is-compacted');
    if (textLen >= 8 || info.digits >= 7) node.classList.add('stat-text-huge');
    else if (textLen >= 6 || info.digits >= 5) node.classList.add('stat-text-long');
    else node.classList.add('stat-text-normal');
  }
  function updateVisibleCard(ch) {
    if (!ch?.id) return false;
    const safe = CSS.escape(ch.id);
    const card = $(`.char-card[data-id="${safe}"], .character-card[data-id="${safe}"]`);
    if (!card) return false;
    card.dataset.name = ch.name || '';
    card.dataset.series = ch.series || '';
    const setText = (sel, text) => $$(sel, card).forEach(node => { node.textContent = text; node.title = text; });
    setText('.char-name, .character-name, [data-field="name"]', ch.name || 'Unnamed');
    setText('.card-series, .char-series, .character-series, [data-field="series"]', ch.series || 'No series');
    setText('.card-owner, .character-owner, [data-field="owner"]', ch.owner || '—');
    $$('.rank-pill, [data-field="rank"]', card).forEach(node => {
      const rankInfo = ch.globalRank
        ? compactNumber(ch.globalRank, { prefix: '#', compactAt: 1000000 })
        : { short: '#—', full: 'No Mudae rank', compacted: false, digits: 0 };
      node.textContent = rankInfo.short;
      node.title = ch.globalRank ? `Mudae rank ${rankInfo.full}` : 'No Mudae rank';
      applyCompactStatClass(node, rankInfo);
    });
    const kakeraInfo = compactNumber(ch.kakera, { compactAt: 1000000 });
    const kakeraText = kakeraInfo.short;
    const kakeraFullText = `${kakeraInfo.full} kakera`;
    $$('.kakera-pill', card).forEach(node => {
      const kakeraTier = model().getKakeraIconTier?.(ch.kakera) || 'purple';
      node.classList.add('has-kakera-icon');
      node.classList.remove('missing-kakera-icon', ...KAKERA_TIER_CLASSES.map(t => 'kakera-tier-' + t));
      node.classList.add('kakera-tier-' + kakeraTier);
      node.dataset.kakeraTier = kakeraTier;
      node.title = kakeraFullText;
      applyCompactStatClass(node, kakeraInfo);
      node.innerHTML = '';
      const kakeraIcon = document.createElement('img');
      kakeraIcon.className = 'kakera-icon';
      kakeraIcon.src = model().getKakeraIconPath?.(ch.kakera) || 'assets/icons/kakera/KakeraPurple.png';
      kakeraIcon.alt = '';
      kakeraIcon.loading = 'lazy';
      kakeraIcon.decoding = 'async';
      kakeraIcon.dataset.kakeraTier = kakeraTier;
      kakeraIcon.onerror = () => {
        kakeraIcon.remove();
        node.classList.add('missing-kakera-icon');
      };
      const kakeraValue = document.createElement('span');
      kakeraValue.className = 'kakera-value';
      kakeraValue.textContent = kakeraText;
      node.append(kakeraIcon, kakeraValue);
    });
    $$('[data-field="kakera"]:not(.kakera-pill)', card).forEach(node => { node.textContent = kakeraText; node.title = kakeraFullText; });
    const keysInfo = compactNumber(ch.keys, { compactAt: 1000, rounding: 'floor' });
    const keyType = model().getDisplayKeyType?.(ch) || internals().getKeyTypeFromCount?.(ch.keys) || '';
    $$('.keys-pill', card).forEach(node => {
      clearStatTextClasses(node);
      node.classList.remove('key-pill', ...KEY_TIER_CLASSES);
      node.innerHTML = '';
      if (keyType && model().KEY_ICONS?.[keyType]) {
        node.classList.add('key-pill', keyType, 'key-tier-' + keyType);
        const keyIcon = model().createLocalIcon
          ? model().createLocalIcon(model().KEY_ICONS[keyType], `${model().getKeyLabel?.(keyType) || keyType} key`, 'key-icon')
          : document.createElement('img');
        if (!model().createLocalIcon) {
          keyIcon.className = 'key-icon';
          keyIcon.src = model().KEY_ICONS[keyType];
          keyIcon.alt = `${model().getKeyLabel?.(keyType) || keyType} key`;
          keyIcon.loading = 'lazy';
          keyIcon.decoding = 'async';
          keyIcon.onerror = () => keyIcon.remove();
        }
        const keyValue = document.createElement('span');
        keyValue.textContent = keysInfo.short;
        node.append(keyIcon, keyValue);
        node.title = `${model().getKeyLabel?.(keyType) || keyType} keys: ${keysInfo.full}`;
      } else {
        node.textContent = '0';
        node.title = 'No keys';
      }
      applyCompactStatClass(node, keyType ? keysInfo : { short: '0', full: '0', compacted: false, digits: 1 });
    });
    $$('[data-field="keys"]:not(.keys-pill)', card).forEach(node => { node.textContent = keysInfo.short; node.title = `Keys: ${keysInfo.full}`; });
    const noteText = ch.note && String(ch.note).trim() ? String(ch.note).trim() : 'no note';
    $$('.card-note, .character-note, [data-field="note"]', card).forEach(node => {
      node.hidden = false;
      node.textContent = noteText;
      node.title = noteText;
      node.classList.toggle('is-empty-note', noteText === 'no note');
    });
    const img = $('img.char-img, img.character-img, .card-image img, img', card);
    if (img && ch.image) {
      img.src = ch.image;
      if (img.dataset) img.dataset.src = ch.image;
      img.alt = ch.name || '';
    }
    const galleryCount = syncGalleryFlags(ch);
    const badge = $('.gallery-badge', card);
    if (badge) {
      badge.hidden = galleryCount <= 0;
      if (galleryCount > 0) badge.textContent = `${galleryCount} imgs`;
    }
    card.classList.toggle('has-gallery-count', galleryCount > 0);
    card.classList.toggle('no-gallery-count', galleryCount <= 0);
    card.classList.add('mhp-card-just-updated');
    setTimeout(() => card.classList.remove('mhp-card-just-updated'), 700);
    return true;
  }
  function saveEditFromManager() {
    if (state.saving) return false;
    const data = snapshotForm();
    const ch = getCharacter(data.id);
    if (!ch) {
      hardClose('save-without-character', 220);
      return false;
    }
    state.saving = true;
    setSuppress(220, 'save');
    try {
      updateCharacterData(ch, data);
      internals().assignBoardCounters?.();
      internals().recalcStats?.();
      api()?.saveLocal?.();
      updateVisibleCard(ch);
      hardClose('save-complete', 220);
      api()?.notifyAppMessage?.(`Saved ${ch.name || 'character'}.`);
      log('saved in-place', ch.id, ch.name);
      return true;
    } catch (error) {
      console.error('[MHP] Edit/gallery manager save failed:', error);
      api()?.showAppAlert?.('Save failed: ' + (error?.message || error), { title: 'Save failed', variant: 'danger' });
      return false;
    } finally {
      setTimeout(() => { state.saving = false; }, 180);
    }
  }
  function handleOpenIntentEvent(event) {
    rememberOpenIntent(event, 'trusted-card-edit-' + event.type);
  }
  function handleDocumentClick(event) {
    rememberOpenIntent(event, 'trusted-card-edit-click');
    const target = event.target;
    const saveBtn = target?.closest?.('#saveEditBtn');
    if (saveBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveEditFromManager();
      return;
    }
    const closeBtn = target?.closest?.('#editCloseBtn, #cancelEditBtn');
    if (closeBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      hardClose('button-close', 220);
      return;
    }
    if (isSuppressed()) {
      const opener = target?.closest?.('.card-edit-btn, .edit-btn, [data-action="edit"]');
      if (opener) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        shouldBlockOpen(opener.closest?.('[data-id]')?.dataset?.id || '', 'suppressed-click');
      }
    }
  }
  document.addEventListener('pointerdown', handleOpenIntentEvent, true);
  document.addEventListener('mousedown', handleOpenIntentEvent, true);
  document.addEventListener('click', handleDocumentClick, true);
  const observer = new MutationObserver(() => {
    const e = els();
    if (!e.editOverlay || !isSuppressed()) return;
    if (e.editOverlay.classList.contains('show')) {
      log('observer forced close during suppressed window');
      hardClose('observer-reclose', Math.max(1200, getSuppressUntil() - now()));
    }
  });
  function initObserver() {
    const overlay = $('#editOverlay');
    if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initObserver, { once: true });
  else initObserver();
  window.MHPEditGalleryController = {
    version: state.version,
    markClosing: setSuppress,
    clearSuppress,
    getSuppressUntil,
    shouldBlockOpen,
    closeGallery,
    hardClose,
    saveEditFromManager,
    rememberOpenIntent,
    allowProgrammaticOpen,
    debug(value = true) { state.debug = !!value; return state.debug; },
    getState() { return { ...state, remainingMs: Math.max(0, Math.ceil(getSuppressUntil() - now())) }; }
  };
  window.MHPHardCloseEditModal = () => hardClose('global-hard-close', 1800);
  window.MHPForceCloseEditModal = () => hardClose('global-force-close', 1800);
})();
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  let raf = 0;
  function numericPx(value, fallback = 0) {
    const n = Number.parseFloat(String(value || '').replace('px', ''));
    return Number.isFinite(n) ? n : fallback;
  }
  function getCols(grid, width) {
    const styles = getComputedStyle(grid);
    const cssCols = Number.parseInt(styles.getPropertyValue('--gallery-cols'), 10);
    if (Number.isFinite(cssCols) && cssCols > 0) return cssCols;
    if (width < 520) return 4;
    if (width < 720) return 5;
    if (width < 980) return 6;
    return 7;
  }
  function lockGalleryLayout(reason = 'layout') {
    raf = 0;
    const grid = $('#galleryGrid');
    const panel = $('#galleryPanel');
    if (!grid || !panel || panel.hidden) return;
    const styles = getComputedStyle(grid);
    const width = grid.clientWidth || grid.getBoundingClientRect().width || 0;
    if (!width) return;
    const cols = getCols(grid, width);
    const gap = numericPx(styles.columnGap || styles.gap, 12);
    const colWidth = Math.max(1, (width - ((cols - 1) * gap)) / cols);
    const rowHeight = Math.max(120, Math.round(colWidth * 14 / 9));
    grid.classList.add('mhp-gallery-layout-locked');
    grid.style.setProperty('--mhp-gallery-locked-row', rowHeight + 'px');
    grid.style.gridAutoRows = rowHeight + 'px';
    grid.style.alignItems = 'stretch';
    grid.style.alignContent = 'start';
    $$('.gallery-card', grid).forEach(card => {
      card.classList.add('mhp-gallery-card-locked');
      card.style.height = '100%';
      card.style.minHeight = '0';
      card.style.maxHeight = 'none';
      card.style.aspectRatio = 'auto';
      card.style.overflow = 'hidden';
      card.style.position = 'relative';
      card.style.margin = '0';
      card.style.alignSelf = 'stretch';
      card.style.justifySelf = 'stretch';
      $$('img, picture, canvas, .gif-poster', card).forEach(media => {
        media.style.position = 'absolute';
        media.style.inset = '0';
        media.style.width = '100%';
        media.style.height = '100%';
        media.style.maxWidth = 'none';
        media.style.maxHeight = 'none';
        media.style.objectFit = 'cover';
        media.style.objectPosition = 'center center';
        media.style.transform = 'none';
      });
    });
    window.__mhpLastGalleryLayoutLock = {
      reason,
      at: Date.now(),
      count: grid.querySelectorAll('.gallery-card').length,
      cols,
      rowHeight,
      width: Math.round(width)
    };
  }
  function schedule(reason = 'scheduled') {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => lockGalleryLayout(reason));
  }
  window.MHPLockGalleryLayout = schedule;
  window.addEventListener('mhp-gallery-rendered', () => schedule('gallery-rendered'));
  window.addEventListener('resize', () => schedule('resize'));
  document.addEventListener('click', event => {
    if (event.target?.closest?.('#galleryToggleBtn, #searchMudaeBtn, .card-edit-btn, .edit-btn, [data-action="edit"]')) {
      schedule('open-or-toggle-click');
      setTimeout(() => schedule('open-or-toggle-click-late'), 80);
    }
  }, true);
  document.addEventListener('DOMContentLoaded', () => schedule('dom-ready'));
})();

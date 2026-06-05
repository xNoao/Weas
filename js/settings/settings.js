(function(){
  'use strict';
  function syncSettingsVisibilityClasses(){
    const body = document.body;
    if (!body) return;
    const settingsPanel = document.getElementById('settingsPanel');
    const graphicsPanel = document.getElementById('graphicsSettingsPanel');
    body.classList.toggle('settings-panel-open', !!settingsPanel && !settingsPanel.hidden);
    body.classList.toggle('graphics-settings-open', !!graphicsPanel && !graphicsPanel.hidden);
  }
  if (window.MudaeSettingsDock) return;
  let graphicsCloseSuppressUntil = 0;
  let graphicsLastAction = 'init';
  function nowMs(){
    return (window.performance && typeof window.performance.now === 'function') ? window.performance.now() : Date.now();
  }
  function clearTabVisibilitySnapshot(){
    try { window.MHPClearTabVisibilitySnapshot?.(); } catch (_) {}
  }
  function markGraphicsClosing(reason = 'close', suppressMs = 1600){
    graphicsLastAction = reason;
    graphicsCloseSuppressUntil = Math.max(graphicsCloseSuppressUntil, nowMs() + Math.max(0, Number(suppressMs) || 0));
    window.__mhpGraphicsSettingsClosingUntil = graphicsCloseSuppressUntil;
    clearTabVisibilitySnapshot();
  }
  const ids = {
    dock: 'settingsDock',
    gear: 'settingsGearBtn',
    panel: 'settingsPanel',
    graphicsBtn: 'graphicsSettingsBtn',
    graphicsPanel: 'graphicsSettingsPanel',
    graphicsBackdrop: 'graphicsSettingsBackdrop',
    graphicsClose: 'graphicsSettingsCloseBtn',
    performance: 'performanceToggleBtn',
    virtualBoard: 'virtualBoardToggleBtn',
    visibleCardLimit: 'visibleCardLimitSelect',
    boardColumns: 'boardColumnsSelect',
    failedStatus: 'failedImagesStatus',
    retryFailedImages: 'retryFailedImagesBtn',
    clearFailedImages: 'clearFailedImagesBtn',
    forceLoadVisibleImages: 'forceLoadVisibleImagesBtn',
    forceLoadAllImages: 'forceLoadAllImagesBtn',
    forceLoadProgressPanel: 'forceLoadProgressPanel',
    forceLoadProgressText: 'forceLoadProgressText',
    forceLoadPreviewGrid: 'forceLoadPreviewGrid',
    forceLoadCancel: 'forceLoadCancelBtn',
    backgroundUrlInput: 'backgroundUrlInput',
    applyBackgroundUrl: 'applyBackgroundUrlBtn',
    backgroundFileInput: 'backgroundFileInput',
    clearBackground: 'clearBackgroundBtn',
    removeCustomBackground: 'removeCustomBackgroundBtn',
    backgroundPreview: 'backgroundPreviewThumb',
    backgroundStatusText: 'backgroundStatusText',
    backgroundStatusHint: 'backgroundStatusHint',
    backgroundOpacity: 'backgroundOpacityInput',
    backgroundOpacityNumber: 'backgroundOpacityNumberInput',
    backgroundBlur: 'backgroundBlurInput',
    backgroundBlurNumber: 'backgroundBlurNumberInput',
    glassToggle: 'glassToggleBtn',
    glassTransparency: 'glassTransparencyInput',
    glassTransparencyNumber: 'glassTransparencyNumberInput',
    cardsTransparency: 'cardsTransparencyInput',
    cardsTransparencyNumber: 'cardsTransparencyNumberInput'
  };
  function $(id){
    return document.getElementById(id);
  }
  function els(){
    return {
      dock: $(ids.dock),
      gear: $(ids.gear),
      panel: $(ids.panel),
      graphicsBtn: $(ids.graphicsBtn),
      graphicsPanel: $(ids.graphicsPanel),
      graphicsBackdrop: $(ids.graphicsBackdrop),
      graphicsClose: $(ids.graphicsClose),
      performance: $(ids.performance),
      virtualBoard: $(ids.virtualBoard),
      visibleCardLimit: $(ids.visibleCardLimit),
      boardColumns: $(ids.boardColumns),
      failedStatus: $(ids.failedStatus),
      retryFailedImages: $(ids.retryFailedImages),
      clearFailedImages: $(ids.clearFailedImages),
      forceLoadVisibleImages: $(ids.forceLoadVisibleImages),
      forceLoadAllImages: $(ids.forceLoadAllImages),
      forceLoadProgressPanel: $(ids.forceLoadProgressPanel),
      forceLoadProgressText: $(ids.forceLoadProgressText),
      forceLoadPreviewGrid: $(ids.forceLoadPreviewGrid),
      forceLoadCancel: $(ids.forceLoadCancel),
      backgroundUrlInput: $(ids.backgroundUrlInput),
      applyBackgroundUrl: $(ids.applyBackgroundUrl),
      backgroundFileInput: $(ids.backgroundFileInput),
      clearBackground: $(ids.clearBackground),
      removeCustomBackground: $(ids.removeCustomBackground),
      backgroundPreview: $(ids.backgroundPreview),
      backgroundStatusText: $(ids.backgroundStatusText),
      backgroundStatusHint: $(ids.backgroundStatusHint),
      backgroundOpacity: $(ids.backgroundOpacity),
      backgroundOpacityNumber: $(ids.backgroundOpacityNumber),
      backgroundBlur: $(ids.backgroundBlur),
      backgroundBlurNumber: $(ids.backgroundBlurNumber),
      glassToggle: $(ids.glassToggle),
      glassTransparency: $(ids.glassTransparency),
      glassTransparencyNumber: $(ids.glassTransparencyNumber),
      cardsTransparency: $(ids.cardsTransparency),
      cardsTransparencyNumber: $(ids.cardsTransparencyNumber)
    };
  }
  function mountGraphicsModalToBody(){
    const { graphicsBackdrop, graphicsPanel } = els();
    if (graphicsBackdrop && graphicsBackdrop.parentElement !== document.body) {
      document.body.appendChild(graphicsBackdrop);
    }
    if (graphicsPanel && graphicsPanel.parentElement !== document.body) {
      document.body.appendChild(graphicsPanel);
    }
  }
  function getPageScrollY(){
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  function preservePageScrollDuring(callback){
    const y = getPageScrollY();
    const active = document.activeElement;
    try {
      callback?.();
    } finally {
      const restore = () => window.scrollTo({ top: y, behavior: 'auto' });
      restore();
      requestAnimationFrame(restore);
      setTimeout(restore, 80);
      if (active && typeof active.focus === 'function') {
        requestAnimationFrame(() => active.focus({ preventScroll: true }));
      }
    }
  }
  function setOpen(open){
    preservePageScrollDuring(() => {
      const { dock, gear, panel } = els();
      if (!gear || !panel) return;
      if (!open) setGraphicsOpen(false, 'dock-close');
      syncSettingsVisibilityClasses();
      panel.hidden = !open;
      syncSettingsVisibilityClasses();
      gear.setAttribute('aria-expanded', open ? 'true' : 'false');
      dock?.classList.toggle('is-open', open);
    });
  }
  function toggleOpen(){
    const { panel } = els();
    if (!panel) return;
    setOpen(!!panel.hidden);
  }
  function closeSettingsOnOutsidePointer(event){
    const { dock, gear, panel, graphicsPanel } = els();
    if (!panel || panel.hidden) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (graphicsPanel && !graphicsPanel.hidden && graphicsPanel.contains(target)) return;
    if (dock?.contains(target) || gear?.contains(target) || panel.contains(target)) return;
    setOpen(false);
  }
  function syncPerformanceToggle(){
    const { performance } = els();
    if (!performance || !window.MUDAE_PERF) return;
    const enabled = window.MUDAE_PERF.isEnabled();
    performance.textContent = enabled ? 'ON' : 'OFF';
    performance.classList.toggle('is-on', enabled);
    performance.classList.toggle('is-off', !enabled);
    performance.title = enabled
      ? 'Performance mode is enabled. Click to disable.'
      : 'Performance mode is disabled. Click to enable.';
  }
  function renderBoardAfterSettingChange(){
    const bridge = window.MUDAE_REBUILD_V1;
    if (bridge && typeof bridge.renderBoard === 'function') {
      bridge.renderBoard();
    }
  }
  function togglePerformance(){
    if (!window.MUDAE_PERF) return;
    window.MUDAE_PERF.toggle();
    syncPerformanceToggle();
    renderBoardAfterSettingChange();
    if (window.MUDAE_REBUILD_V1?.app?.currentEditId) {
      window.MudaeGifControl?.refresh?.();
    }
  }
  const BACKGROUND_STORAGE_KEY = 'mudae.pageBackground.v1';
  const VISUAL_STORAGE_KEY = 'mudae.visualSettings.v1';
  const MAX_BACKGROUND_UPLOAD_BYTES = 2.5 * 1024 * 1024;
  const DEFAULT_BACKGROUND_OPACITY = 35;
  const DEFAULT_BACKGROUND_BLUR = 0;
  const MAX_BACKGROUND_BLUR_PX = 16;
  const DEFAULT_GLASS_TRANSPARENCY = 35;
  const DEFAULT_CARD_TRANSPARENCY = 20;
  let forceProgressVisible = false;
  let forceProgressDone = false;
  let forceProgressTicker = 0;
  let forcePreloadSummary = '';
  function showAlert(message, options){
    if (window.MUDAE_REBUILD_V1?.showAppAlert) {
      return window.MUDAE_REBUILD_V1.showAppAlert(message, options);
    }
    console.warn(message);
    return Promise.resolve(false);
  }
  function normalizeDirectImageUrl(value){
    return window.MudaeGraphicsSettings?.normalizeDirectImageUrl?.(value) || '';
  }
  function clampNumber(value, min, max, fallback){
    return window.MudaeGraphicsSettings?.clampNumber?.(value, min, max, fallback) ?? fallback;
  }
  function normalizeBackgroundConfig(config){
    return window.MudaeGraphicsSettings?.normalizeBackgroundConfig?.(config) || null;
  }
  function setGraphicsOpen(open, reason = open ? 'open' : 'close'){
    const wantsOpen = !!open;
    const t = nowMs();
    if (wantsOpen && t < graphicsCloseSuppressUntil && reason !== 'user-open') {
      graphicsLastAction = `blocked-open:${reason}`;
      return;
    }
    if (!wantsOpen) {
      markGraphicsClosing(reason || 'close');
    } else {
      graphicsLastAction = reason || 'open';
    }
    preservePageScrollDuring(() => {
      const { graphicsBtn, graphicsPanel, graphicsBackdrop, graphicsClose } = els();
      if (!graphicsBtn || !graphicsPanel) return;
      graphicsPanel.hidden = !wantsOpen;
      syncSettingsVisibilityClasses();
      if (graphicsBackdrop) graphicsBackdrop.hidden = !wantsOpen;
      graphicsBtn.classList.toggle('is-active', wantsOpen);
      graphicsBtn.setAttribute('aria-expanded', wantsOpen ? 'true' : 'false');
      document.body.classList.toggle('graphics-settings-open', wantsOpen);
      if (wantsOpen) {
        requestAnimationFrame(() => graphicsClose?.focus?.({ preventScroll: true }));
      }
    });
  }
  function toggleGraphicsOpen(){
    const { graphicsPanel } = els();
    setGraphicsOpen(!!graphicsPanel?.hidden, 'user-open');
  }
  function normalizeVisualSettings(value){
    return window.MudaeGraphicsSettings?.normalizeVisualSettings?.(value) || { glassEnabled: true, transparency: DEFAULT_GLASS_TRANSPARENCY, cardTransparency: DEFAULT_CARD_TRANSPARENCY };
  }
  function readVisualSettings(){
    return window.MudaeGraphicsSettings?.readVisualSettings?.() || normalizeVisualSettings(null);
  }
  function persistVisualSettings(config){
    try {
      window.MudaeGraphicsSettings?.persistVisualSettings?.(config);
    } catch (error) {
      console.warn('Failed to persist visual settings:', error);
    }
  }
  function applyVisualSettings(config = readVisualSettings()){
    window.MudaeGraphicsSettings?.applyVisualSettings?.(config);
  }
  function syncGlassControls(){
    const { glassToggle, glassTransparency, glassTransparencyNumber, cardsTransparency, cardsTransparencyNumber } = els();
    const config = readVisualSettings();
    applyVisualSettings(config);
    if (glassToggle) {
      glassToggle.textContent = config.glassEnabled ? 'ON' : 'OFF';
      glassToggle.classList.toggle('is-on', config.glassEnabled);
      glassToggle.classList.toggle('is-off', !config.glassEnabled);
    }
    syncRangePair(glassTransparency, glassTransparencyNumber, config.transparency);
    syncRangePair(cardsTransparency, cardsTransparencyNumber, config.cardTransparency);
    [glassTransparency, glassTransparencyNumber, cardsTransparency, cardsTransparencyNumber].forEach(control => {
      if (control) control.disabled = !config.glassEnabled;
    });
  }
  function updateGlassSettings(next){
    const current = readVisualSettings();
    const updated = normalizeVisualSettings({ ...current, ...next });
    persistVisualSettings(updated);
    syncGlassControls();
  }
  function toggleGlassTransparency(){
    const current = readVisualSettings();
    updateGlassSettings({ glassEnabled: !current.glassEnabled });
  }
  function updatePanelTransparency(){
    const { glassTransparency, glassTransparencyNumber } = els();
    updateGlassSettings({
      transparency: clampNumber(glassTransparencyNumber?.value ?? glassTransparency?.value, 0, 100, DEFAULT_GLASS_TRANSPARENCY)
    });
  }
  function updateCardTransparency(){
    const { cardsTransparency, cardsTransparencyNumber } = els();
    updateGlassSettings({
      cardTransparency: clampNumber(cardsTransparencyNumber?.value ?? cardsTransparency?.value, 0, 100, DEFAULT_CARD_TRANSPARENCY)
    });
  }
  function restoreTransparencyDefaults(){
    updateGlassSettings({
      transparency: DEFAULT_GLASS_TRANSPARENCY,
      cardTransparency: DEFAULT_CARD_TRANSPARENCY
    });
  }
  function readStoredBackground(){
    return window.MudaeGraphicsSettings?.readStoredBackground?.() || null;
  }
  function persistBackground(config){
    try {
      if (!window.MudaeGraphicsSettings?.persistBackground) return false;
      return window.MudaeGraphicsSettings.persistBackground(config);
    } catch (error) {
      console.warn('Failed to persist background setting:', error);
      showAlert('Could not save this background locally. The file may be too large for browser storage.', {
        title: 'Background not saved',
        variant: 'danger'
      });
      return false;
    }
  }
  function cssUrlValue(url){
    return window.MudaeGraphicsSettings?.cssUrlValue?.(url) || 'none';
  }
  function applyBackgroundToDocument(config){
    window.MudaeGraphicsSettings?.applyBackgroundToDocument?.(config);
  }
  function syncBackgroundControls(){
    const {
      backgroundUrlInput,
      backgroundPreview,
      backgroundStatusText,
      backgroundStatusHint,
      clearBackground,
      removeCustomBackground,
      backgroundOpacity,
      backgroundOpacityNumber,
      backgroundBlur,
      backgroundBlurNumber,
      glassToggle,
      glassTransparency,
      glassTransparencyNumber,
      cardsTransparency,
      cardsTransparencyNumber
    } = els();
    const config = readStoredBackground();
    applyBackgroundToDocument(config);
    if (backgroundPreview) {
      backgroundPreview.style.backgroundImage = config?.value ? cssUrlValue(config.value) : 'none';
      backgroundPreview.classList.toggle('is-empty', !config?.value);
    }
    if (backgroundStatusText) {
      backgroundStatusText.textContent = config?.value
        ? (config.kind === 'upload' ? 'Uploaded background' : 'Custom background URL')
        : (config?.kind === 'preset' && config.preset !== 'default' ? 'Preset background' : 'Default background');
    }
    if (backgroundStatusHint) {
      backgroundStatusHint.textContent = config?.value
        ? `${config.name || 'Saved locally for this browser.'}${config.preset && config.preset !== 'default' ? ` · Tint: ${config.preset}` : ''}`
        : (config?.kind === 'preset' && config.preset !== 'default' ? `Preset: ${config.preset}` : 'Soft built-in gradient.');
    }
    if (backgroundUrlInput && document.activeElement !== backgroundUrlInput) {
      backgroundUrlInput.value = config?.kind === 'url' ? config.value : '';
    }
    syncRangePair(backgroundOpacity, backgroundOpacityNumber, config?.opacity ?? DEFAULT_BACKGROUND_OPACITY);
    syncRangePair(backgroundBlur, backgroundBlurNumber, config?.blur ?? DEFAULT_BACKGROUND_BLUR);
    document.querySelectorAll('.settings-preset-btn[data-bg-preset]').forEach(btn => {
      const key = btn.dataset.bgPreset || 'default';
      btn.classList.toggle('is-active', (config?.preset || 'default') === key);
    });
    if (removeCustomBackground) {
      removeCustomBackground.disabled = !config?.value;
      removeCustomBackground.title = config?.value
        ? 'Remove only the custom URL/uploaded image and keep the current preset/tint.'
        : 'No custom background image is currently active.';
    }
    if (clearBackground) {
      clearBackground.disabled = !config?.value && (!config || config.preset === 'default');
      clearBackground.title = 'Reset background image, preset, opacity and blur.';
    }
  }
  function getBackgroundTuning(){
    const { backgroundOpacityNumber, backgroundOpacity, backgroundBlurNumber, backgroundBlur } = els();
    return {
      opacity: clampNumber(backgroundOpacityNumber?.value ?? backgroundOpacity?.value, 0, 100, DEFAULT_BACKGROUND_OPACITY),
      blur: clampNumber(backgroundBlurNumber?.value ?? backgroundBlur?.value, 0, 100, DEFAULT_BACKGROUND_BLUR)
    };
  }
  function syncRangePair(rangeInput, numberInput, value){
    const normalized = String(clampNumber(value, 0, 100, 0));
    if (rangeInput && document.activeElement !== rangeInput) rangeInput.value = normalized;
    if (numberInput && document.activeElement !== numberInput) numberInput.value = normalized;
  }
  function bindRangePair(rangeInput, numberInput, onApply = updateBackgroundTuning){
    const applyFrom = source => {
      const value = clampNumber(source?.value, 0, 100, 0);
      if (rangeInput && source !== rangeInput) rangeInput.value = String(value);
      if (numberInput && source !== numberInput) numberInput.value = String(value);
      onApply();
    };
    if (rangeInput) rangeInput.addEventListener('input', () => applyFrom(rangeInput));
    if (numberInput) {
      numberInput.addEventListener('input', () => applyFrom(numberInput));
      numberInput.addEventListener('change', () => applyFrom(numberInput));
    }
  }
  function setCustomBackground(config){
    const normalized = normalizeBackgroundConfig(config ? { ...getBackgroundTuning(), ...config } : null);
    if (!persistBackground(normalized)) return false;
    applyBackgroundToDocument(normalized);
    syncBackgroundControls();
    return true;
  }
  function removeCustomBackgroundImage(){
    const current = readStoredBackground();
    const preset = current?.preset || 'default';
    const opacity = current?.opacity ?? DEFAULT_BACKGROUND_OPACITY;
    const blur = current?.blur ?? DEFAULT_BACKGROUND_BLUR;
    try {
      localStorage.removeItem('mudae.pageBackground.lastCustom.v1');
      window.__mhpBackgroundBackupDisabledUntil = Date.now() + 2500;
    } catch (_) {}
    persistBackground(null);
    applyBackgroundToDocument(null);
    setCustomBackground({
      kind: 'preset',
      preset,
      value: '',
      name: preset,
      opacity,
      blur
    });
  }
  function clearCustomBackground(){
    setCustomBackground(null);
  }
  function applyBackgroundUrl(){
    const { backgroundUrlInput } = els();
    const rawValue = String(backgroundUrlInput?.value || '').trim();
    if (!rawValue) {
      clearCustomBackground();
      return;
    }
    setCustomBackground({ kind: 'url', value: rawValue });
  }
  function updateBackgroundTuning(){
    const current = readStoredBackground();
    if (!current) return;
    setCustomBackground({ ...current, ...getBackgroundTuning() });
  }
  function applyBackgroundPreset(key){
    const preset = String(key || 'default').trim() || 'default';
    const current = readStoredBackground();
    if (current?.value) {
      setCustomBackground({
        ...current,
        preset,
        ...getBackgroundTuning()
      });
      return;
    }
    setCustomBackground({
      kind: 'preset',
      preset,
      value: '',
      name: preset,
      ...getBackgroundTuning()
    });
  }
  function pickBackgroundFile(event){
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKGROUND_UPLOAD_BYTES) {
      showAlert('This image is too large to store safely in browser storage. Please use a smaller file or a direct image URL.', {
        title: 'Background too large',
        variant: 'danger'
      });
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomBackground({ kind: 'upload', value: String(reader.result || ''), name: file.name || 'Uploaded image' });
      event.target.value = '';
    };
    reader.onerror = () => {
      showAlert('Could not read the selected image file.', {
        title: 'Background upload failed',
        variant: 'danger'
      });
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  }
  function showForceLoadProgress(message = 'Preparing card image preload...'){
    const { forceLoadProgressPanel, failedStatus } = els();
    forceProgressVisible = true;
    forceProgressDone = false;
    forcePreloadSummary = String(message || 'Preparing card image preload...');
    if (forceLoadProgressPanel) {
      forceLoadProgressPanel.hidden = true;
      forceLoadProgressPanel.setAttribute('aria-hidden', 'true');
      forceLoadProgressPanel.classList.remove('is-done');
    }
    if (failedStatus) failedStatus.textContent = forcePreloadSummary;
    startForceLoadProgressTicker();
    requestAnimationFrame(() => syncForceLoadProgress());
  }
  function cancelForceLoadProgress(){
    window.MudaeMinimalImageLoader?.cancelForceLoad?.();
    hideForceLoadProgress();
    syncImageLoaderStatus();
  }
  function hideForceLoadProgress(){
    const { forceLoadProgressPanel } = els();
    forceProgressVisible = false;
    forceProgressDone = false;
    forcePreloadSummary = '';
    stopForceLoadProgressTicker();
    if (forceLoadProgressPanel) {
      forceLoadProgressPanel.hidden = true;
      forceLoadProgressPanel.setAttribute('aria-hidden', 'true');
      forceLoadProgressPanel.classList.remove('is-done');
    }
  }
  function startForceLoadProgressTicker(){
    if (forceProgressTicker) return;
    forceProgressTicker = window.setInterval(() => {
      if (!forceProgressVisible) {
        stopForceLoadProgressTicker();
        return;
      }
      syncForceLoadProgress();
    }, 250);
  }
  function stopForceLoadProgressTicker(){
    if (!forceProgressTicker) return;
    window.clearInterval(forceProgressTicker);
    forceProgressTicker = 0;
  }
  function syncForceLoadProgress(){
    const { failedStatus } = els();
    const state = window.MudaeMinimalImageLoader?.getQueueState?.();
    if (!state) return;
    const pending = state.pending || 0;
    const queued = state.queued || 0;
    const active = state.activeLoads || 0;
    const failed = state.failed || 0;
    const loaded = state.loaded || 0;
    const isComplete = pending <= 0 && queued <= 0 && active <= 0;
    if (isComplete && forceProgressVisible) {
      forceProgressDone = true;
      forcePreloadSummary = `Image preload done · Loaded memory: ${loaded} · Failed: ${failed}`;
      if (failedStatus) failedStatus.textContent = forcePreloadSummary;
      stopForceLoadProgressTicker();
      return;
    }
    forcePreloadSummary = `Preloading card images · Pending: ${pending} · Queue: ${queued} · Loading: ${active} · Loaded memory: ${loaded} · Failed: ${failed}`;
    if (failedStatus) failedStatus.textContent = forcePreloadSummary;
  }
  function syncBoardColumns(){
    const { boardColumns } = els();
    if (!boardColumns) return;
    const value = window.MUDAE_REBUILD_V1?.getBoardColumnSetting?.() ?? 0;
    boardColumns.value = String(value);
  }
  function changeBoardColumns(){
    const { boardColumns } = els();
    if (!boardColumns) return;
    window.MUDAE_REBUILD_V1?.setBoardColumnSetting?.(Number(boardColumns.value) || 0);
    syncBoardColumns();
  }
  function syncVisibleCardLimit(){
    const { visibleCardLimit } = els();
    if (!visibleCardLimit) return;
    const value = window.MUDAE_REBUILD_V1?.getVisibleCardLimit?.() ?? 0;
    visibleCardLimit.value = String(value);
  }
  function changeVisibleCardLimit(){
    const { visibleCardLimit } = els();
    if (!visibleCardLimit) return;
    window.MUDAE_REBUILD_V1?.setVisibleCardLimit?.(Number(visibleCardLimit.value) || 0);
    syncVisibleCardLimit();
  }
  function syncVirtualBoardToggle(){
    const { virtualBoard } = els();
    if (!virtualBoard) return;
    virtualBoard.textContent = 'OFF';
    virtualBoard.classList.remove('is-on');
    virtualBoard.disabled = true;
    virtualBoard.title = 'Deprecated. Use Visible cards.';
  }
  function toggleVirtualBoard(){
    window.MUDAE_REBUILD_V1?.setVirtualBoardEnabled?.(false);
    syncVirtualBoardToggle();
  }
  function syncImageLoaderStatus(){
    const { failedStatus, retryFailedImages, clearFailedImages } = els();
    const failed = window.MudaeMinimalImageLoader?.getFailedCount?.() || 0;
    const queue = window.MudaeMinimalImageLoader?.getQueueState?.();
    if (failedStatus) {
      const active = queue?.activeLoads || 0;
      const queued = queue?.queued || 0;
      const pending = queue?.pending || 0;
      if (forceProgressVisible && forcePreloadSummary) {
        failedStatus.textContent = forcePreloadSummary;
      } else {
        failedStatus.textContent = `Image helper · Failed: ${failed}${active || queued || pending ? ` · Loading ${active}/${queued} · Pending ${pending}` : ''}`;
      }
    }
    if (retryFailedImages) retryFailedImages.disabled = failed <= 0;
    if (clearFailedImages) clearFailedImages.disabled = failed <= 0;
    if (forceProgressVisible) syncForceLoadProgress();
  }
  function forceLoadVisibleImages(){
    window.MudaeMinimalImageLoader?.forceLoadVisible?.(document);
    showForceLoadProgress('Loading currently visible card images...');
    syncImageLoaderStatus();
  }
  function forceLoadAllImages(){
    const rawUrls = window.MUDAE_REBUILD_V1?.getAllBoardImageUrls?.() || [];
    const seen = new Set();
    const urls = rawUrls
      .map(url => String(url || '').trim())
      .filter(url => {
        if (!url || url.startsWith('data:')) return false;
        const key = url.replace(/^https?:/i, '').replace(/\?.*$/, '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    showForceLoadProgress(`Preparing ${urls.length} card image${urls.length === 1 ? '' : 's'}...`);
    const count = window.MudaeMinimalImageLoader?.forceLoadAll?.(urls) || 0;
    const { failedStatus } = els();
    if (failedStatus) {
      if (count > 0) {
        failedStatus.textContent = `Preloading ${count} card image${count === 1 ? '' : 's'}...`;
      } else if (urls.length > 0) {
        failedStatus.textContent = `Card images already queued or loaded · Checked ${urls.length}.`;
      } else {
        failedStatus.textContent = 'No card images found to preload.';
      }
    }
    syncImageLoaderStatus();
    syncForceLoadProgress();
    if (count <= 0) {
      window.MudaeMinimalImageLoader?.releaseVisible?.(document);
      syncForceLoadProgress();
    }
  }
  function retryFailedImages(){
    window.MudaeMinimalImageLoader?.retryFailedImages?.();
    syncImageLoaderStatus();
  }
  function clearFailedImages(){
    window.MudaeMinimalImageLoader?.clearFailedUrls?.();
    syncImageLoaderStatus();
  }
  function bind(){
    const { gear, graphicsBtn, graphicsBackdrop, graphicsClose, performance } = els();
    if (gear) {
      gear.addEventListener('click', toggleOpen);
    }
    document.addEventListener('pointerdown', closeSettingsOnOutsidePointer, true);
    if (performance) {
      performance.addEventListener('click', togglePerformance);
    }
    if (graphicsBtn) {
      graphicsBtn.addEventListener('click', toggleGraphicsOpen);
    }
    if (graphicsClose) {
      graphicsClose.addEventListener('click', () => setGraphicsOpen(false, 'close-button'));
    }
    if (graphicsBackdrop) {
      graphicsBackdrop.addEventListener('click', () => setGraphicsOpen(false, 'backdrop'));
    }
    const { virtualBoard } = els();
    if (virtualBoard) {
      virtualBoard.addEventListener('click', toggleVirtualBoard);
    }
    const { visibleCardLimit } = els();
    if (visibleCardLimit) {
      visibleCardLimit.addEventListener('change', changeVisibleCardLimit);
    }
    const { boardColumns } = els();
    if (boardColumns) {
      boardColumns.addEventListener('change', changeBoardColumns);
    }
    const {
      retryFailedImages: retryBtn,
      clearFailedImages: clearBtn,
      forceLoadVisibleImages: forceVisibleBtn,
      forceLoadAllImages: forceAllBtn,
      forceLoadCancel: forceCancelBtn,
      backgroundUrlInput,
      applyBackgroundUrl: applyBackgroundUrlBtn,
      backgroundFileInput,
      clearBackground: clearBackgroundBtn,
      removeCustomBackground: removeCustomBackgroundBtn,
      backgroundOpacity,
      backgroundOpacityNumber,
      backgroundBlur,
      backgroundBlurNumber,
      glassToggle,
      glassTransparency,
      glassTransparencyNumber,
      cardsTransparency,
      cardsTransparencyNumber
    } = els();
    if (forceVisibleBtn) {
      forceVisibleBtn.addEventListener('click', forceLoadVisibleImages);
    }
    if (forceAllBtn) {
      forceAllBtn.addEventListener('click', forceLoadAllImages);
    }
    if (forceCancelBtn) {
      forceCancelBtn.addEventListener('click', cancelForceLoadProgress);
    }
    if (retryBtn) {
      retryBtn.addEventListener('click', retryFailedImages);
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', clearFailedImages);
    }
    if (applyBackgroundUrlBtn) {
      applyBackgroundUrlBtn.addEventListener('click', applyBackgroundUrl);
    }
    if (backgroundUrlInput) {
      backgroundUrlInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyBackgroundUrl();
        }
      });
    }
    if (backgroundFileInput) {
      backgroundFileInput.addEventListener('change', pickBackgroundFile);
    }
    if (removeCustomBackgroundBtn) {
      removeCustomBackgroundBtn.addEventListener('click', removeCustomBackgroundImage);
    }
    if (clearBackgroundBtn) {
      clearBackgroundBtn.addEventListener('click', clearCustomBackground);
    }
    bindRangePair(backgroundOpacity, backgroundOpacityNumber);
    bindRangePair(backgroundBlur, backgroundBlurNumber);
    bindRangePair(glassTransparency, glassTransparencyNumber, updatePanelTransparency);
    bindRangePair(cardsTransparency, cardsTransparencyNumber, updateCardTransparency);
    if (glassToggle) {
      glassToggle.addEventListener('click', toggleGlassTransparency);
    }
    const restoreTransparencyDefaultsBtn = document.getElementById('restoreTransparencyDefaultsBtn');
    if (restoreTransparencyDefaultsBtn) {
      restoreTransparencyDefaultsBtn.addEventListener('click', restoreTransparencyDefaults);
    }
    document.querySelectorAll('.settings-preset-btn[data-bg-preset]').forEach(btn => {
      btn.addEventListener('click', () => applyBackgroundPreset(btn.dataset.bgPreset));
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const { graphicsPanel } = els();
      if (graphicsPanel && !graphicsPanel.hidden) {
        setGraphicsOpen(false, 'escape');
        syncSettingsVisibilityClasses();
        return;
      }
      setOpen(false);
    syncSettingsVisibilityClasses();
    });
    window.addEventListener('mudae:performance-change', syncPerformanceToggle);
    window.addEventListener('mudae:virtual-board-change', syncVirtualBoardToggle);
    window.addEventListener('mudae:visible-card-limit-change', syncVisibleCardLimit);
    window.addEventListener('mudae:board-columns-change', syncBoardColumns);
    window.addEventListener('mudae:image-loader-change', syncImageLoaderStatus);
    setOpen(false);
    syncSettingsVisibilityClasses();
    syncPerformanceToggle();
    syncVirtualBoardToggle();
    syncImageLoaderStatus();
    syncBackgroundControls();
    syncGlassControls();
    setGraphicsOpen(false);
    syncSettingsVisibilityClasses();
  }
  function init(){
    mountGraphicsModalToBody();
    bind();
  }
  window.MHPGraphicsSettingsController = {
    close(reason = 'api-close'){ setGraphicsOpen(false, reason); },
    open(reason = 'api-open'){ setGraphicsOpen(true, reason === 'user-open' ? 'user-open' : reason); },
    removeCustomBackground(){ removeCustomBackgroundImage(); },
    resetBackground(){ clearCustomBackground(); },
    getState(){
      const { graphicsPanel, graphicsBackdrop } = els();
      return {
        panelHidden: !!graphicsPanel?.hidden,
        backdropHidden: !!graphicsBackdrop?.hidden,
        bodyOpen: !!document.body?.classList?.contains('graphics-settings-open'),
        suppressUntil: graphicsCloseSuppressUntil,
        now: nowMs(),
        lastAction: graphicsLastAction
      };
    },
    clearSnapshots: clearTabVisibilitySnapshot
  };
  window.MudaeSettingsDock = {
    init,
    setOpen,
    toggleOpen,
    syncPerformanceToggle,
    syncBackgroundControls,
    setCustomBackground,
    clearCustomBackground,
    getCustomBackground: readStoredBackground,
    syncGlassControls,
    getVisualSettings: readVisualSettings
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
(() => {
  if (window.__mhpRealThemeClassSyncInstalled) return;
  window.__mhpRealThemeClassSyncInstalled = true;
  const normalizePreset = (value) => {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('purple')) return 'purple';
    if (raw.includes('blue')) return 'blue';
    return 'default';
  };
  const applyThemePreset = (preset) => {
    const key = normalizePreset(preset);
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;
    root.dataset.backgroundPreset = key;
    body.dataset.backgroundPreset = key;
    for (const node of [root, body]) {
      node.classList.toggle('mhp-theme-default', key === 'default');
      node.classList.toggle('mhp-theme-purple', key === 'purple');
      node.classList.toggle('mhp-theme-blue', key === 'blue');
      node.classList.toggle('bg-preset-default', key === 'default');
      node.classList.toggle('bg-preset-purple', key === 'purple');
      node.classList.toggle('bg-preset-blue', key === 'blue');
    }
  };
  document.addEventListener('click', (event) => {
    const btn = event.target?.closest?.('.settings-preset-btn, [data-bg-preset], [data-background-preset]');
    if (!btn || !btn.closest?.('.settings-background-row, #graphicsSettingsPanel')) return;
    const preset = btn.dataset.bgPreset || btn.dataset.backgroundPreset || btn.getAttribute('data-preset') || btn.textContent;
    applyThemePreset(preset);
    setTimeout(() => applyThemePreset(preset), 50);
    setTimeout(() => applyThemePreset(preset), 180);
  }, true);
  const init = () => {
    const stored = (() => {
      try {
        const raw = localStorage.getItem('mudae.pageBackground.v1');
        if (!raw) return '';
        return JSON.parse(raw)?.preset || '';
      } catch (_) {
        return '';
      }
    })();
    applyThemePreset(stored || document.body?.dataset?.backgroundPreset || document.documentElement.dataset.backgroundPreset || 'default');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('load', init, { once: true });
})();

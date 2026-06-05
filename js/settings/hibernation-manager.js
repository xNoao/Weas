(function(){
  'use strict';
  if (window.MHPHibernationManager) return;
  const STORAGE_KEY = 'mudae.hibernation.enabled.v1';
  const MIN_BACKGROUND_MS_FOR_WAKE = 900;
  const BLUR_GRACE_MS = 700;
  const WAKE_THROTTLE_MS = 900;
  const LIGHT_WAKE_DELAY_MS = 55;
  let enabled = true;
  let hibernating = false;
  let enteredAt = 0;
  let hiddenReason = '';
  let blurTimer = 0;
  let wakeTimer = 0;
  let lastWakeAt = 0;
  let lastWakeReason = '';
  let wakeCount = 0;
  function readEnabled(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === null ? true : raw !== '0' && raw !== 'false';
    } catch (_) {
      return true;
    }
  }
  function writeEnabled(value){
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch (_) {}
  }
  enabled = readEnabled();
  function now(){
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }
  function pageIsBackgrounded(){
    return document.hidden || document.visibilityState === 'hidden' || !document.hasFocus?.();
  }
  function isCriticalLoading(){
    const root = document.documentElement;
    const appOverlay = document.getElementById('appLoadingOverlay');
    const bootOverlay = document.getElementById('mhpBootLoader');
    return !!(
      root.classList.contains('mhp-booting') ||
      root.classList.contains('mhp-heavy-loading') ||
      root.classList.contains('app-is-loading') ||
      root.dataset.mhpImageGate === '1' ||
      (appOverlay && appOverlay.hidden !== true && appOverlay.getAttribute('hidden') === null) ||
      (bootOverlay && !bootOverlay.classList.contains('is-hiding') && bootOverlay.getAttribute('aria-hidden') !== 'true')
    );
  }
  function setClasses(active){
    document.documentElement.classList.toggle('mhp-hibernating', !!active);
    document.body?.classList?.toggle('mhp-hibernating', !!active);
    if (active) document.documentElement.dataset.mhpHibernation = '1';
    else {
      delete document.documentElement.dataset.mhpHibernation;
      delete document.documentElement.dataset.mhpHibernationDeferred;
    }
  }
  function flushSaves(){
    try { window.MudaeBoardController?.flushSave?.(); } catch (error) { console.warn('[MHP] hibernation save flush failed', error); }
    try { window.MUDAE_REBUILD_V1?.saveLocal?.(); } catch (error) { console.warn('[MHP] hibernation local save failed', error); }
  }
  function pauseWork(reason){
    if (!enabled || hibernating) return false;
    hibernating = true;
    enteredAt = now();
    hiddenReason = reason || 'background';
    setClasses(true);
    const criticalLoading = isCriticalLoading();
    if (criticalLoading) {
      document.documentElement.dataset.mhpHibernationDeferred = '1';
    } else {
      try { window.MudaeMinimalImageLoader?.cancelForceLoad?.(); } catch (_) {}
      try { window.MudaeMinimalImageLoader?.suspend?.(); } catch (_) {}
      try { window.MudaeGifControl?.pauseAll?.(); } catch (_) {}
      flushSaves();
    }
    window.dispatchEvent(new CustomEvent('mhp:hibernate', {
      detail: { reason: hiddenReason, enteredAt, criticalLoading }
    }));
    return true;
  }
  function lightWake(reason){
    if (!enabled) return false;
    const wasHibernating = hibernating;
    const backgroundMs = wasHibernating ? Math.max(0, now() - enteredAt) : 0;
    hibernating = false;
    setClasses(false);
    clearTimeout(wakeTimer);
    const elapsedSinceWake = Date.now() - (lastWakeAt || 0);
    if (!wasHibernating && elapsedSinceWake >= 0 && elapsedSinceWake < WAKE_THROTTLE_MS) {
      lastWakeReason = `${reason || 'foreground'}:throttled`;
      return false;
    }
    const run = () => {
      if (pageIsBackgrounded()) return;
      lastWakeAt = Date.now();
      lastWakeReason = reason || 'foreground';
      wakeCount += 1;
      const board = window.MUDAE_REBUILD_V1?.els?.board || document.getElementById('board') || document.querySelector('.board');
      const criticalLoading = isCriticalLoading();
      try { window.MudaeMinimalImageLoader?.clearStale?.(); } catch (_) {}
      try { window.MudaeMinimalImageLoader?.resume?.(board || document); } catch (_) {}
      if (!criticalLoading) {
        try { window.MudaeMinimalImageLoader?.releaseVisible?.(board || document); } catch (_) {}
        try { window.MudaeGifControl?.refresh?.(); } catch (_) {}
        try { window.MudaeBoardController?.schedule?.(false); } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('mhp:wake', {
        detail: { reason: lastWakeReason, backgroundMs, wakeCount, criticalLoading }
      }));
    };
    if (backgroundMs >= MIN_BACKGROUND_MS_FOR_WAKE) {
      wakeTimer = setTimeout(run, LIGHT_WAKE_DELAY_MS);
    } else {
      run();
    }
    return true;
  }
  function onVisibilityChange(){
    clearTimeout(blurTimer);
    if (document.hidden || document.visibilityState === 'hidden') {
      pauseWork('visibility-hidden');
      return;
    }
    if (!pageIsBackgrounded()) {
      lightWake('visibility-visible');
    }
  }
  function onBlur(){
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      if (pageIsBackgrounded()) pauseWork('window-blur');
    }, BLUR_GRACE_MS);
  }
  function onFocus(){
    clearTimeout(blurTimer);
    if (!pageIsBackgrounded()) lightWake('window-focus');
  }
  function enable(){
    enabled = true;
    writeEnabled(true);
    if (pageIsBackgrounded()) pauseWork('enabled-while-backgrounded');
    else lightWake('enabled');
    return status();
  }
  function disable(){
    enabled = false;
    writeEnabled(false);
    hibernating = false;
    clearTimeout(blurTimer);
    clearTimeout(wakeTimer);
    setClasses(false);
    try { window.MudaeMinimalImageLoader?.resume?.(document); } catch (_) {}
    try { window.MudaeGifControl?.refresh?.(); } catch (_) {}
    return status();
  }
  function status(log = true){
    const data = {
      enabled,
      hibernating,
      hiddenReason,
      backgroundMs: hibernating ? Math.round(now() - enteredAt) : 0,
      lastWakeAt,
      lastWakeReason,
      wakeCount,
      documentHidden: document.hidden,
      hasFocus: !!document.hasFocus?.(),
      criticalLoading: isCriticalLoading()
    };
    if (log) console.table(data);
    return data;
  }
  window.MHPHibernationManager = {
    enable,
    disable,
    toggle: () => enabled ? disable() : enable(),
    status,
    sleep: pauseWork,
    wake: lightWake,
    isEnabled: () => enabled,
    isHibernating: () => hibernating,
    isCriticalLoading
  };
  document.addEventListener('visibilitychange', onVisibilityChange, true);
  window.addEventListener('blur', onBlur, true);
  window.addEventListener('focus', onFocus, true);
  window.addEventListener('pagehide', () => pauseWork('pagehide'), true);
  window.addEventListener('pageshow', () => {
    if (!pageIsBackgrounded()) lightWake('pageshow');
  }, true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (pageIsBackgrounded()) pauseWork('initial-background');
    }, { once: true });
  } else if (pageIsBackgrounded()) {
    pauseWork('initial-background');
  }
})();

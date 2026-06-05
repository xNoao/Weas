/* Mudae Organizer Rebuild graphics settings helpers.
   Owns normalization, storage and CSS variable application for visual settings.
   The settings dock owns DOM controls and calls this module.
*/
(function(){
  'use strict';

  if (window.MudaeGraphicsSettings) return;

  const BACKGROUND_STORAGE_KEY = 'mudae.pageBackground.v1';
  const VISUAL_STORAGE_KEY = 'mudae.visualSettings.v1';
  const DEFAULT_BACKGROUND_OPACITY = 35;
  const DEFAULT_BACKGROUND_BLUR = 0;
  const MAX_BACKGROUND_BLUR_PX = 16;
  const DEFAULT_GLASS_TRANSPARENCY = 35;
  const DEFAULT_CARD_TRANSPARENCY = 20;

  function clampNumber(value, min, max, fallback){
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeDirectImageUrl(value){
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:image/')) return raw;

    let url = raw;
    if (/^\/\//.test(url)) url = 'https:' + url;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const path = parsed.pathname.replace(/^\/+/, '');

      if ((host === 'imgur.com' || host === 'm.imgur.com') && /^[A-Za-z0-9]+$/.test(path)) {
        return `https://i.imgur.com/${path}.jpg`;
      }

      if (host === 'imgchest.com' && !/\.(?:png|jpe?g|webp|gif)(?:$|\?)/i.test(parsed.pathname)) {
        return url;
      }
    } catch (_) {
      return url;
    }

    return url;
  }

  function normalizeBackgroundConfig(config){
    if (!config || typeof config !== 'object') return null;

    const kindRaw = String(config.kind || '').trim();
    const preset = String(config.preset || '').trim();
    const value = normalizeDirectImageUrl(config.value || config.url || '');
    const kind = kindRaw === 'upload' ? 'upload' : (kindRaw === 'preset' ? 'preset' : 'url');
    const name = String(config.name || '').trim();
    const opacity = clampNumber(config.opacity, 0, 100, DEFAULT_BACKGROUND_OPACITY);
    const blur = clampNumber(config.blur, 0, 100, DEFAULT_BACKGROUND_BLUR);

    // v2.428: presets are visual overlays only. They must not erase a custom
    // background image if one is already present in the config.
    if (kind === 'preset') {
      return {
        kind: value ? 'url' : 'preset',
        preset: preset || 'default',
        value,
        name,
        opacity,
        blur
      };
    }

    if (!value) return null;

    return {
      kind,
      preset: preset || 'default',
      value,
      name,
      opacity,
      blur
    };
  }

  function normalizeVisualSettings(value){
    const config = value && typeof value === 'object' ? value : {};
    return {
      glassEnabled: config.glassEnabled !== false,
      transparency: clampNumber(config.transparency, 0, 100, DEFAULT_GLASS_TRANSPARENCY),
      cardTransparency: clampNumber(config.cardTransparency, 0, 100, DEFAULT_CARD_TRANSPARENCY)
    };
  }

  function readJsonStorage(key, normalizer, fallback){
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return normalizer(JSON.parse(raw));
    } catch (error) {
      console.warn(`Failed to read ${key}:`, error);
      return fallback;
    }
  }

  function writeJsonStorage(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function removeStorage(key){
    localStorage.removeItem(key);
  }

  function readStoredBackground(){
    return readJsonStorage(BACKGROUND_STORAGE_KEY, normalizeBackgroundConfig, null);
  }

  function persistBackground(config){
    const normalized = normalizeBackgroundConfig(config);
    if (!normalized) {
      removeStorage(BACKGROUND_STORAGE_KEY);
      return true;
    }

    writeJsonStorage(BACKGROUND_STORAGE_KEY, normalized);
    return true;
  }

  function readVisualSettings(){
    return readJsonStorage(VISUAL_STORAGE_KEY, normalizeVisualSettings, normalizeVisualSettings(null));
  }

  function persistVisualSettings(config){
    writeJsonStorage(VISUAL_STORAGE_KEY, normalizeVisualSettings(config));
  }

  function cssUrlValue(url){
    const value = String(url || '');
    if (!value) return 'none';
    return `url(${JSON.stringify(value)})`;
  }

  function applyBackgroundToDocument(config){
    const normalized = normalizeBackgroundConfig(config);
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    // v2.428: preset is independent from custom image kind/value.
    const preset = normalized?.preset || 'default';
    body.dataset.backgroundPreset = preset;

    document.documentElement.dataset.backgroundPreset = preset;

    // v2.428: when a pure preset is applied, keep existing custom image variables.
    // A theme/preset should only change tint, not remove the background image.
    if (!normalized?.value && normalized?.kind === 'preset') {
      const hasExistingCustom = !!document.documentElement.style.getPropertyValue('--custom-page-bg-image')
        && document.documentElement.style.getPropertyValue('--custom-page-bg-image') !== 'none';
      body.classList.toggle('has-custom-page-bg', hasExistingCustom);
      document.documentElement.classList.toggle('has-custom-page-bg', hasExistingCustom);
      return;
    }

    if (normalized?.value) {
      const imageValue = cssUrlValue(normalized.value);
      const opacityValue = String((normalized.opacity ?? DEFAULT_BACKGROUND_OPACITY) / 100);
      const blurPx = ((normalized.blur ?? DEFAULT_BACKGROUND_BLUR) / 100) * MAX_BACKGROUND_BLUR_PX;
      root.style.setProperty('--custom-page-bg-image', imageValue);
      root.style.setProperty('--custom-page-bg-opacity', opacityValue);
      root.style.setProperty('--custom-page-bg-blur', `${blurPx}px`);
      root.style.setProperty('--custom-page-bg-bleed', `${Math.max(24, Math.ceil(blurPx * 2 + 18))}px`);

      root.style.setProperty('--custom-page-bg-image-direct', imageValue);
      root.style.setProperty('--custom-page-bg-opacity-direct', opacityValue);
      root.style.setProperty('--mhp-stable-custom-bg', imageValue);
      root.style.setProperty('--mhp-stable-custom-bg-opacity', opacityValue);
      root.classList.add('mhp-stable-bg-ready', 'mhp-real-bg-active');
      body.style.backgroundImage = '';

      body.classList.add('has-custom-page-bg', 'mhp-real-bg-active');
      root.classList.add('has-custom-page-bg');
      body.dataset.customBackgroundKind = normalized.kind || 'url';
    } else {
      root.style.setProperty('--custom-page-bg-image', 'none');
      root.style.setProperty('--custom-page-bg-opacity', '0');
      root.style.setProperty('--custom-page-bg-blur', '0px');
      root.style.setProperty('--custom-page-bg-bleed', '0px');
      root.style.setProperty('--custom-page-bg-image-direct', 'none');
      root.style.setProperty('--custom-page-bg-opacity-direct', '0');
      root.style.setProperty('--mhp-stable-custom-bg', 'none');
      root.style.setProperty('--mhp-stable-custom-bg-opacity', '0');
      root.classList.remove('mhp-stable-bg-ready', 'mhp-real-bg-active');
      body.classList.remove('has-custom-page-bg', 'mhp-real-bg-active');
      root.classList.remove('has-custom-page-bg');
      delete body.dataset.customBackgroundKind;
    }

    // v2.600: the real fixed background layer owns the painted image.
    // Apply it immediately after settings change so the page never waits for
    // unrelated input/change listeners and never falls back to old pseudo layers.
    if (typeof window.MHPApplyRealBackgroundLayer === 'function') {
      requestAnimationFrame(() => window.MHPApplyRealBackgroundLayer());
    }
  }

  function applyVisualSettings(config = readVisualSettings()){
    const normalized = normalizeVisualSettings(config);
    const root = document.documentElement;
    const body = document.body;
    const panelAmount = normalized.transparency / 100;
    const cardAmount = normalized.cardTransparency / 100;
    const panelAlpha = normalized.glassEnabled ? (0.96 - panelAmount * 0.58) : 1;
    const overlayAlpha = normalized.glassEnabled ? (0.62 - panelAmount * 0.34) : 0.86;
    const fieldAlpha = normalized.glassEnabled ? (0.88 - panelAmount * 0.32) : 1;
    const cardAlpha = normalized.glassEnabled ? (0.86 - cardAmount * 0.46) : 1;
    const cardInnerAlpha = normalized.glassEnabled ? (0.72 - cardAmount * 0.30) : 1;
    const dividerAlpha = normalized.glassEnabled ? (0.82 - cardAmount * 0.36) : 1;
    const topbarAlpha = normalized.glassEnabled ? (0.84 - panelAmount * 0.24) : 1;
    const blurPx = normalized.glassEnabled ? (8 + panelAmount * 22) : 0;
    const cardBlurPx = normalized.glassEnabled ? (3 + cardAmount * 10) : 0;

    root.style.setProperty('--glass-panel-alpha', Math.max(0.34, panelAlpha).toFixed(3));
    root.style.setProperty('--glass-overlay-alpha', Math.max(0.18, overlayAlpha).toFixed(3));
    root.style.setProperty('--glass-field-alpha', Math.max(0.38, fieldAlpha).toFixed(3));
    root.style.setProperty('--glass-card-alpha', Math.max(0.32, cardAlpha).toFixed(3));
    root.style.setProperty('--glass-card-inner-alpha', Math.max(0.30, cardInnerAlpha).toFixed(3));
    root.style.setProperty('--glass-divider-alpha', Math.max(0.34, dividerAlpha).toFixed(3));
    root.style.setProperty('--glass-topbar-alpha', Math.max(0.48, topbarAlpha).toFixed(3));
    root.style.setProperty('--glass-panel-blur', `${blurPx.toFixed(1)}px`);
    root.style.setProperty('--glass-card-blur', `${cardBlurPx.toFixed(1)}px`);
    body.classList.toggle('glass-panels-enabled', !!normalized.glassEnabled);
  }

  window.MudaeGraphicsSettings = {
    BACKGROUND_STORAGE_KEY,
    VISUAL_STORAGE_KEY,
    DEFAULT_BACKGROUND_OPACITY,
    DEFAULT_BACKGROUND_BLUR,
    MAX_BACKGROUND_BLUR_PX,
    DEFAULT_GLASS_TRANSPARENCY,
    DEFAULT_CARD_TRANSPARENCY,
    clampNumber,
    normalizeDirectImageUrl,
    normalizeBackgroundConfig,
    normalizeVisualSettings,
    readStoredBackground,
    persistBackground,
    readVisualSettings,
    persistVisualSettings,
    cssUrlValue,
    applyBackgroundToDocument,
    applyVisualSettings
  };
})();


// v2.402: Visual mode buttons (Minimalist / Glass)
(() => {
  if (window.__mhpVisualModeButtonsInstalled) return;
  window.__mhpVisualModeButtonsInstalled = true;

  const STORAGE_KEY = 'mudae.visualMode.v1';

  const normalizeMode = (value) => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (['glass', 'transparent', 'transparency', 'true', '1', 'yes', 'on'].includes(raw)) return 'glass';
    if (['minimalist', 'minimal', 'normal', 'flat', 'false', '0', 'no', 'off'].includes(raw)) return 'minimalist';
    return '';
  };

  const readLegacyMode = () => {
    const legacyKeys = [
      'mudae.transparentUi.v1',
      'mudae.glassPanels.v1',
      'mhpTransparentUi',
      'transparentUi',
      'glassPanels'
    ];

    for (const key of legacyKeys) {
      try {
        const mode = normalizeMode(localStorage.getItem(key));
        if (mode) return mode;
      } catch (_) {}
    }

    if (document.body.classList.contains('glass-panels-enabled')) return 'glass';
    return '';
  };

  const readMode = () => {
    try {
      const mode = normalizeMode(localStorage.getItem(STORAGE_KEY));
      if (mode) return mode;
    } catch (_) {}
    return readLegacyMode() || 'minimalist';
  };

  const writeMode = (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      localStorage.setItem('mudae.transparentUi.v1', mode === 'glass' ? 'true' : 'false');
      localStorage.setItem('mudae.glassPanels.v1', mode === 'glass' ? 'true' : 'false');
    } catch (_) {}
  };

  const syncOldGlassToggle = (isGlass) => {
    const old = document.getElementById('glassToggleBtn');
    if (!old) return;
    old.textContent = isGlass ? 'ON' : 'OFF';
    old.classList.toggle('is-active', isGlass);
    old.setAttribute('aria-pressed', isGlass ? 'true' : 'false');
  };

  const applyMode = (mode, { persist = true } = {}) => {
    const normalized = normalizeMode(mode) || 'minimalist';
    const isGlass = normalized === 'glass';

    document.documentElement.dataset.visualMode = normalized;
    document.body.dataset.visualMode = normalized;

    document.documentElement.classList.toggle('visual-mode-glass', isGlass);
    document.documentElement.classList.toggle('visual-mode-minimalist', !isGlass);
    document.body.classList.toggle('visual-mode-glass', isGlass);
    document.body.classList.toggle('visual-mode-minimalist', !isGlass);

    // Existing glass CSS switch.
    document.body.classList.toggle('glass-panels-enabled', isGlass);

    const minimal = document.getElementById('minimalistModeBtn');
    const glass = document.getElementById('glassModeBtn');

    if (minimal) {
      minimal.classList.toggle('is-active', !isGlass);
      minimal.setAttribute('aria-pressed', !isGlass ? 'true' : 'false');
    }

    if (glass) {
      glass.classList.toggle('is-active', isGlass);
      glass.setAttribute('aria-pressed', isGlass ? 'true' : 'false');
    }

    syncOldGlassToggle(isGlass);
    if (persist) writeMode(normalized);

    window.dispatchEvent(new CustomEvent('mhp-visual-mode-change', {
      detail: { mode: normalized, glass: isGlass }
    }));
  };

  const bind = () => {
    const minimal = document.getElementById('minimalistModeBtn');
    const glass = document.getElementById('glassModeBtn');
    const old = document.getElementById('glassToggleBtn');

    if (minimal && minimal.dataset.visualModeBound !== '1') {
      minimal.dataset.visualModeBound = '1';
      minimal.addEventListener('click', () => applyMode('minimalist'));
    }

    if (glass && glass.dataset.visualModeBound !== '1') {
      glass.dataset.visualModeBound = '1';
      glass.addEventListener('click', () => applyMode('glass'));
    }

    if (old && old.dataset.visualModeBound !== '1') {
      old.dataset.visualModeBound = '1';
      old.addEventListener('click', () => {
        const next = document.body.classList.contains('glass-panels-enabled') ? 'minimalist' : 'glass';
        applyMode(next);
      });
    }
  };

  window.MudaeVisualMode = {
    readMode,
    applyMode,
    setMinimalist: () => applyMode('minimalist'),
    setGlass: () => applyMode('glass')
  };

  const init = () => {
    bind();
    applyMode(readMode(), { persist: false });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('load', init, { once: true });
})();


// v2.403: enforce selected visual mode after legacy graphics code runs.
(() => {
  if (window.__mhpVisualModeEnforcerInstalled) return;
  window.__mhpVisualModeEnforcerInstalled = true;

  const STORAGE_KEY = 'mudae.visualMode.v1';

  const readSelectedMode = () => {
    try {
      const stored = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      if (stored === 'glass') return 'glass';
      if (stored === 'minimalist') return 'minimalist';
    } catch (_) {}
    return document.documentElement.dataset.visualMode || document.body.dataset.visualMode || 'minimalist';
  };

  const enforce = () => {
    const mode = readSelectedMode();
    const isGlass = mode === 'glass';

    document.documentElement.dataset.visualMode = isGlass ? 'glass' : 'minimalist';
    document.body.dataset.visualMode = isGlass ? 'glass' : 'minimalist';

    document.documentElement.classList.toggle('visual-mode-glass', isGlass);
    document.documentElement.classList.toggle('visual-mode-minimalist', !isGlass);
    document.body.classList.toggle('visual-mode-glass', isGlass);
    document.body.classList.toggle('visual-mode-minimalist', !isGlass);

    document.body.classList.toggle('glass-panels-enabled', isGlass);

    const minimal = document.getElementById('minimalistModeBtn');
    const glass = document.getElementById('glassModeBtn');

    if (minimal) {
      minimal.classList.toggle('is-active', !isGlass);
      minimal.setAttribute('aria-pressed', !isGlass ? 'true' : 'false');
    }

    if (glass) {
      glass.classList.toggle('is-active', isGlass);
      glass.setAttribute('aria-pressed', isGlass ? 'true' : 'false');
    }
  };

  let ticking = false;
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      enforce();
    });
  };

  const observer = new MutationObserver(schedule);
  if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-visual-mode'] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-visual-mode'] });

  window.addEventListener('mhp-visual-mode-change', schedule);
  window.addEventListener('load', schedule, { once: true });
  schedule();
})();


// v2.404: visual mode source-of-truth helper
(() => {
  if (window.__mhpVisualModeSourceOfTruthInstalled) return;
  window.__mhpVisualModeSourceOfTruthInstalled = true;

  const STORAGE_KEY = 'mudae.visualMode.v1';

  const getStoredMode = () => {
    try {
      const raw = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      if (raw === 'glass') return 'glass';
      if (raw === 'minimalist') return 'minimalist';
    } catch (_) {}
    return 'minimalist';
  };

  const applySource = () => {
    const mode = window.MudaeVisualMode?.readMode?.() || getStoredMode();
    const isGlass = mode === 'glass';

    document.documentElement.dataset.visualMode = isGlass ? 'glass' : 'minimalist';
    document.body.dataset.visualMode = isGlass ? 'glass' : 'minimalist';

    document.documentElement.classList.toggle('visual-mode-glass', isGlass);
    document.documentElement.classList.toggle('visual-mode-minimalist', !isGlass);
    document.body.classList.toggle('visual-mode-glass', isGlass);
    document.body.classList.toggle('visual-mode-minimalist', !isGlass);

    // Compatibility only. CSS geometry should not depend on this anymore.
    document.body.classList.toggle('glass-panels-enabled', isGlass);
  };

  window.mhpApplyVisualModeSource = applySource;

  const schedule = () => requestAnimationFrame(applySource);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }

  window.addEventListener('load', schedule, { once: true });
  window.addEventListener('mhp-visual-mode-change', schedule);
})();


// v2.405: hard Minimalist class cleanup after legacy glass code.
(() => {
  if (window.__mhpHardMinimalistCleanupInstalled) return;
  window.__mhpHardMinimalistCleanupInstalled = true;

  const STORAGE_KEY = 'mudae.visualMode.v1';

  const getMode = () => {
    try {
      const raw = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      if (raw === 'glass') return 'glass';
      if (raw === 'minimalist') return 'minimalist';
    } catch (_) {}
    return document.body?.dataset?.visualMode || 'minimalist';
  };

  const cleanup = () => {
    if (!document.body) return;

    const mode = getMode();
    const isGlass = mode === 'glass';

    document.documentElement.dataset.visualMode = isGlass ? 'glass' : 'minimalist';
    document.body.dataset.visualMode = isGlass ? 'glass' : 'minimalist';

    document.documentElement.classList.toggle('visual-mode-glass', isGlass);
    document.documentElement.classList.toggle('visual-mode-minimalist', !isGlass);
    document.body.classList.toggle('visual-mode-glass', isGlass);
    document.body.classList.toggle('visual-mode-minimalist', !isGlass);

    if (!isGlass) {
      document.body.classList.remove('glass-panels-enabled');
      document.documentElement.classList.remove('glass-panels-enabled');
    } else {
      document.body.classList.add('glass-panels-enabled');
    }

    const old = document.getElementById('glassToggleBtn');
    if (old) {
      old.textContent = isGlass ? 'ON' : 'OFF';
      old.classList.toggle('is-active', isGlass);
      old.setAttribute('aria-pressed', isGlass ? 'true' : 'false');
    }
  };

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      cleanup();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }

  window.addEventListener('load', cleanup, { once: true });
  window.addEventListener('mhp-visual-mode-change', cleanup);
  setTimeout(cleanup, 0);
  setTimeout(cleanup, 80);
  setTimeout(cleanup, 250);

  const observer = new MutationObserver(queue);
  if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-visual-mode'] });
  if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-visual-mode'] });
})();


// v2.426: safe custom background backup without repaint loops.
(() => {
  if (window.__mhpSafeCustomBackgroundBackupInstalled) return;
  window.__mhpSafeCustomBackgroundBackupInstalled = true;

  const BACKUP_KEY = 'mudae.pageBackground.lastCustom.v1';

  const readBackup = () => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  const writeBackup = (data) => {
    if (!data || !data.image || data.image === 'none') return;
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
    } catch (_) {}
  };

  const cssImageIsReal = (value) => {
    const raw = String(value || '').trim();
    return !!raw && raw !== 'none' && raw !== 'url("")' && raw !== 'initial' && raw !== 'inherit';
  };

  const backupDisabled = () => Number(window.__mhpBackgroundBackupDisabledUntil || 0) > Date.now();

  const clearBackup = () => {
    try { localStorage.removeItem(BACKUP_KEY); } catch (_) {}
  };

  const storedBackgroundHasCustomImage = () => {
    try {
      const raw = localStorage.getItem('mudae.pageBackground.v1');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!String(parsed?.value || parsed?.url || '').trim();
    } catch (_) {
      return false;
    }
  };

  const captureCurrentCustom = () => {
    if (backupDisabled()) return;
    const root = document.documentElement;
    const body = document.body;

    const image =
      root.style.getPropertyValue('--custom-page-bg-image') ||
      body?.style?.getPropertyValue('--custom-page-bg-image') ||
      root.style.getPropertyValue('--custom-page-bg-image-direct') ||
      root.style.getPropertyValue('--mhp-stable-custom-bg');

    if (!cssImageIsReal(image)) return;

    writeBackup({
      image: String(image).trim(),
      opacity: root.style.getPropertyValue('--custom-page-bg-opacity') || body?.style?.getPropertyValue('--custom-page-bg-opacity') || '.35',
      blur: root.style.getPropertyValue('--custom-page-bg-blur') || body?.style?.getPropertyValue('--custom-page-bg-blur') || '0px',
      bleed: root.style.getPropertyValue('--custom-page-bg-bleed') || body?.style?.getPropertyValue('--custom-page-bg-bleed') || '24px'
    });
  };

  const applyBackupAsVisibleBackground = () => {
    if (backupDisabled() || !storedBackgroundHasCustomImage()) return;
    const backup = readBackup();
    if (!backup || !cssImageIsReal(backup.image)) return;

    const root = document.documentElement;
    const body = document.body;
    if (!body) return;

    root.style.setProperty('--custom-page-bg-image', backup.image);
    root.style.setProperty('--custom-page-bg-image-direct', backup.image);
    root.style.setProperty('--mhp-stable-custom-bg', backup.image);
    root.style.setProperty('--custom-page-bg-opacity', backup.opacity || '.35');
    root.style.setProperty('--custom-page-bg-blur', backup.blur || '0px');
    root.style.setProperty('--custom-page-bg-bleed', backup.bleed || '24px');

    body.style.setProperty('--custom-page-bg-image', backup.image);
    body.style.setProperty('--custom-page-bg-opacity', backup.opacity || '.35');
    body.style.setProperty('--custom-page-bg-blur', backup.blur || '0px');
    body.style.setProperty('--custom-page-bg-bleed', backup.bleed || '24px');

    root.classList.add('has-custom-page-bg', 'mhp-stable-bg-ready');
    body.classList.add('has-custom-page-bg');
  };

  const isBackgroundPresetButton = (target) => {
    const btn = target?.closest?.('.settings-preset-btn, [data-bg-preset], [data-background-preset]');
    if (!btn) return false;
    return !!btn.closest?.('.settings-background-row, #graphicsSettingsPanel');
  };

  const isBackgroundCustomInput = (target) => {
    return !!target?.closest?.('.settings-background-row') &&
      (target.matches?.('input, button, label') || target.type === 'file');
  };

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('#removeCustomBackgroundBtn, #clearBackgroundBtn')) {
      window.__mhpBackgroundBackupDisabledUntil = Date.now() + 2500;
      clearBackup();
      setTimeout(clearBackup, 120);
      return;
    }

    if (isBackgroundPresetButton(event.target)) {
      captureCurrentCustom();
      setTimeout(applyBackupAsVisibleBackground, 0);
      setTimeout(applyBackupAsVisibleBackground, 120);
      return;
    }

    // Important: Load JSON is outside settings-background-row, so do nothing.
    if (event.target?.closest?.('#loadJsonBtn, #loadJSONBtn, #loadJsonLabel, #loadJSONLabel, .load-json-btn, .load-json-label')) {
      return;
    }

    if (isBackgroundCustomInput(event.target)) {
      setTimeout(captureCurrentCustom, 120);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (isBackgroundCustomInput(event.target)) {
      setTimeout(captureCurrentCustom, 120);
      setTimeout(captureCurrentCustom, 500);
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (isBackgroundCustomInput(event.target)) {
      setTimeout(captureCurrentCustom, 120);
    }
  }, true);

  // On focus/visibility, only reapply if the existing custom variable was cleared.
  const restoreIfCleared = () => {
    if (backupDisabled() || !storedBackgroundHasCustomImage()) return;
    const current = document.documentElement.style.getPropertyValue('--custom-page-bg-image');
    if (!cssImageIsReal(current)) applyBackupAsVisibleBackground();
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(restoreIfCleared, 60);
  });

  window.addEventListener('focus', () => setTimeout(restoreIfCleared, 60));
  window.addEventListener('load', () => {
    captureCurrentCustom();
    restoreIfCleared();
  }, { once: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      captureCurrentCustom();
      restoreIfCleared();
    }, { once: true });
  } else {
    captureCurrentCustom();
    restoreIfCleared();
  }
})();








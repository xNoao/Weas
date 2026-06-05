(() => {
  'use strict';
  if (window.__mhpPromotedGraphicsBridgeInstalled) return;
  window.__mhpPromotedGraphicsBridgeInstalled = true;
  const DEFAULT_PANEL_TRANSPARENCY = 35;
  const DEFAULT_MENU_TRANSPARENCY = 20;
  const VISUAL_KEY = 'mudae.visualSettings.v1';
  const MODE_KEY = 'mudae.visualMode.v1';
  const $ = (selector) => document.querySelector(selector);
  const clamp = (value, fallback = 0) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, n));
  };
  const readVisualConfig = () => {
    try {
      const fromModule = window.MudaeGraphicsSettings?.readVisualSettings?.();
      if (fromModule && typeof fromModule === 'object') return fromModule;
    } catch (_) {}
    try {
      const parsed = JSON.parse(localStorage.getItem(VISUAL_KEY) || '{}');
      return {
        glassEnabled: parsed.glassEnabled !== false,
        transparency: clamp(parsed.transparency, DEFAULT_PANEL_TRANSPARENCY),
        cardTransparency: clamp(parsed.cardTransparency, DEFAULT_MENU_TRANSPARENCY)
      };
    } catch (_) {
      return {
        glassEnabled: true,
        transparency: DEFAULT_PANEL_TRANSPARENCY,
        cardTransparency: DEFAULT_MENU_TRANSPARENCY
      };
    }
  };
  const saveVisualConfig = (config) => {
    const normalized = {
      glassEnabled: config.glassEnabled !== false,
      transparency: clamp(config.transparency, DEFAULT_PANEL_TRANSPARENCY),
      cardTransparency: clamp(config.cardTransparency, DEFAULT_MENU_TRANSPARENCY)
    };
    try {
      if (window.MudaeGraphicsSettings?.persistVisualSettings) {
        window.MudaeGraphicsSettings.persistVisualSettings(normalized);
      } else {
        localStorage.setItem(VISUAL_KEY, JSON.stringify(normalized));
      }
    } catch (_) {
      try { localStorage.setItem(VISUAL_KEY, JSON.stringify(normalized)); } catch (_) {}
    }
    return normalized;
  };
  const syncPair = (rangeId, numberId, value) => {
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);
    const safe = String(clamp(value, 0));
    if (range) range.value = safe;
    if (number) number.value = safe;
  };
  const currentMode = () => {
    try {
      const raw = String(localStorage.getItem(MODE_KEY) || '').toLowerCase();
      if (raw === 'glass' || raw === 'minimalist') return raw;
    } catch (_) {}
    const raw = String(document.body?.dataset?.visualMode || document.documentElement?.dataset?.visualMode || '').toLowerCase();
    return raw === 'glass' ? 'glass' : 'minimalist';
  };
  const setBodyMode = (mode) => {
    const normalized = mode === 'glass' ? 'glass' : 'minimalist';
    const isGlass = normalized === 'glass';
    document.documentElement.dataset.visualMode = normalized;
    document.body.dataset.visualMode = normalized;
    document.documentElement.classList.toggle('visual-mode-glass', isGlass);
    document.documentElement.classList.toggle('visual-mode-minimalist', !isGlass);
    document.body.classList.toggle('visual-mode-glass', isGlass);
    document.body.classList.toggle('visual-mode-minimalist', !isGlass);
    document.body.classList.toggle('glass-panels-enabled', isGlass);
    try { localStorage.setItem(MODE_KEY, normalized); } catch (_) {}
    document.querySelectorAll('[data-visual-mode]').forEach((button) => {
      const active = button.dataset.visualMode === normalized;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };
  const applyPromotedTransparency = (config = readVisualConfig()) => {
    const normalized = {
      glassEnabled: config.glassEnabled !== false,
      transparency: clamp(config.transparency, DEFAULT_PANEL_TRANSPARENCY),
      cardTransparency: clamp(config.cardTransparency, DEFAULT_MENU_TRANSPARENCY)
    };
    const panelAlpha = Math.max(.08, Math.min(.92, (100 - normalized.transparency) / 100));
    const menuAlpha = Math.max(.10, Math.min(.95, (100 - normalized.cardTransparency) / 100));
    const root = document.documentElement;
    const body = document.body;
    root.style.setProperty('--mhp-promoted-graphics-panel-alpha', panelAlpha.toFixed(3));
    root.style.setProperty('--mhp-promoted-graphics-menu-alpha', menuAlpha.toFixed(3));
    body.style.setProperty('--mhp-promoted-graphics-panel-alpha', panelAlpha.toFixed(3));
    body.style.setProperty('--mhp-promoted-graphics-menu-alpha', menuAlpha.toFixed(3));
    root.style.setProperty('--glass-panel-alpha', panelAlpha.toFixed(3));
    root.style.setProperty('--glass-overlay-alpha', Math.max(.18, panelAlpha * .72).toFixed(3));
    root.style.setProperty('--glass-field-alpha', Math.max(.38, menuAlpha).toFixed(3));
    root.style.setProperty('--glass-card-alpha', Math.max(.32, menuAlpha).toFixed(3));
    root.style.setProperty('--glass-card-inner-alpha', Math.max(.30, menuAlpha * .82).toFixed(3));
    root.style.setProperty('--glass-divider-alpha', Math.max(.34, menuAlpha * .86).toFixed(3));
    root.style.setProperty('--glass-topbar-alpha', Math.max(.48, panelAlpha * .90).toFixed(3));
    root.style.setProperty('--glass-panel-blur', `${(8 + (normalized.transparency / 100) * 22).toFixed(1)}px`);
    root.style.setProperty('--glass-card-blur', `${(3 + (normalized.cardTransparency / 100) * 10).toFixed(1)}px`);
    body.style.setProperty('--mhp-lab-panel-alpha', panelAlpha.toFixed(3));
    body.style.setProperty('--mhp-lab-menu-alpha', menuAlpha.toFixed(3));
    syncPair('glassTransparencyInput', 'glassTransparencyNumberInput', normalized.transparency);
    syncPair('cardsTransparencyInput', 'cardsTransparencyNumberInput', normalized.cardTransparency);
    const transparentOn = normalized.glassEnabled !== false;
    body.classList.toggle('glass-transparency-off', !transparentOn);
    const toggle = document.getElementById('glassToggleBtn');
    if (toggle) {
      toggle.textContent = transparentOn ? 'ON' : 'OFF';
      toggle.classList.toggle('is-active', transparentOn);
      toggle.classList.toggle('is-on', transparentOn);
      toggle.classList.toggle('is-off', !transparentOn);
      toggle.setAttribute('aria-pressed', transparentOn ? 'true' : 'false');
    }
    const disabled = !transparentOn;
    ['glassTransparencyInput','glassTransparencyNumberInput','cardsTransparencyInput','cardsTransparencyNumberInput'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
  };
  const updateTransparency = (patch) => {
    const current = readVisualConfig();
    const next = saveVisualConfig({ ...current, ...patch });
    applyPromotedTransparency(next);
    try { window.MudaeGraphicsSettings?.applyVisualSettings?.(next); } catch (_) {}
  };
  const bindPair = (rangeId, numberId, key, fallback) => {
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);
    if (!range && !number) return;
    const handler = (event) => {
      const source = event.currentTarget;
      const value = clamp(source?.value, fallback);
      updateTransparency({ [key]: value });
    };
    [range, number].forEach((el) => {
      if (!el || el.dataset.promotedTransparencyBound === '1') return;
      el.dataset.promotedTransparencyBound = '1';
      el.addEventListener('input', handler, { capture: true });
      el.addEventListener('change', handler, { capture: true });
    });
  };
  const bindButtons = () => {
    bindPair('glassTransparencyInput', 'glassTransparencyNumberInput', 'transparency', DEFAULT_PANEL_TRANSPARENCY);
    bindPair('cardsTransparencyInput', 'cardsTransparencyNumberInput', 'cardTransparency', DEFAULT_MENU_TRANSPARENCY);
    const restore = document.getElementById('restoreTransparencyDefaultsBtn');
    if (restore && restore.dataset.promotedTransparencyBound !== '1') {
      restore.dataset.promotedTransparencyBound = '1';
      restore.addEventListener('click', (event) => {
        event.preventDefault();
        updateTransparency({
          glassEnabled: true,
          transparency: DEFAULT_PANEL_TRANSPARENCY,
          cardTransparency: DEFAULT_MENU_TRANSPARENCY
        });
      }, { capture: true });
    }
    const toggle = document.getElementById('glassToggleBtn');
    if (toggle && toggle.dataset.promotedTransparencyBound !== '1') {
      toggle.dataset.promotedTransparencyBound = '1';
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        const current = readVisualConfig();
        updateTransparency({ glassEnabled: current.glassEnabled === false });
      }, { capture: true });
    }
    const minimal = document.getElementById('minimalistModeBtn');
    const glass = document.getElementById('glassModeBtn');
    if (minimal && minimal.dataset.promotedModeBound !== '1') {
      minimal.dataset.promotedModeBound = '1';
      minimal.addEventListener('click', () => {
        setBodyMode('minimalist');
        updateTransparency({ glassEnabled: false });
      }, { capture: true });
    }
    if (glass && glass.dataset.promotedModeBound !== '1') {
      glass.dataset.promotedModeBound = '1';
      glass.addEventListener('click', () => {
        setBodyMode('glass');
        updateTransparency({ glassEnabled: true });
      }, { capture: true });
    }
  };
  const init = () => {
    document.body.classList.add('mhp-promoted-graphics');
    setBodyMode(currentMode());
    bindButtons();
    applyPromotedTransparency(readVisualConfig());
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('load', init, { once: true });
  window.addEventListener('mhp-visual-mode-change', () => requestAnimationFrame(init));
  window.MudaePromotedGraphicsTransparency = {
    apply: applyPromotedTransparency,
    update: updateTransparency,
    reset: () => updateTransparency({ glassEnabled:true, transparency:DEFAULT_PANEL_TRANSPARENCY, cardTransparency:DEFAULT_MENU_TRANSPARENCY })
  };
})();

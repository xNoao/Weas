(function(){
  'use strict';
  if (window.MUDAE_PERF) return;
  const PERF_KEY = 'mudae_rebuild_perf_enabled_v1';
  const GIF_KEY = 'mudae_rebuild_gif_control_enabled_v1';
  function readBool(key, fallback = true){
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return value !== '0' && value !== 'false';
  }
  function writeBool(key, value){
    localStorage.setItem(key, value ? '1' : '0');
  }
  function isEnabled(){
    return readBool(PERF_KEY, false);
  }
  function isGifControlEnabled(){
    return isEnabled() && readBool(GIF_KEY, true);
  }
  function dispatchChange(){
    window.dispatchEvent(new CustomEvent('mudae:performance-change', {
      detail: status(false)
    }));
  }
  function applyClasses(){
    const enabled = isEnabled();
    const gifEnabled = isGifControlEnabled();
    document.documentElement.classList.toggle('perf-enabled', enabled);
    document.documentElement.classList.toggle('perf-disabled', !enabled);
    document.documentElement.classList.toggle('gif-control-enabled', gifEnabled);
    document.documentElement.classList.toggle('gif-control-disabled', !gifEnabled);
  }
  function enable(){
    writeBool(PERF_KEY, true);
    applyClasses();
    window.MudaeGifControl?.refresh?.();
    dispatchChange();
    return status();
  }
  function disable(){
    writeBool(PERF_KEY, false);
    applyClasses();
    window.MudaeGifControl?.releaseAll?.();
    dispatchChange();
    return status();
  }
  function toggle(){
    return isEnabled() ? disable() : enable();
  }
  function enableGifControl(){
    writeBool(GIF_KEY, true);
    applyClasses();
    window.MudaeGifControl?.refresh?.();
    dispatchChange();
    return status();
  }
  function disableGifControl(){
    writeBool(GIF_KEY, false);
    applyClasses();
    window.MudaeGifControl?.releaseAll?.();
    dispatchChange();
    return status();
  }
  function toggleGifControl(){
    return isGifControlEnabled() ? disableGifControl() : enableGifControl();
  }
  function status(log = true){
    const data = {
      performance: isEnabled() ? 'enabled' : 'disabled',
      gifControl: isGifControlEnabled() ? 'enabled' : 'disabled'
    };
    if (log) console.table(data);
    return data;
  }
  window.MUDAE_PERF = {
    isEnabled,
    isGifControlEnabled,
    enable,
    disable,
    toggle,
    enableGifControl,
    disableGifControl,
    toggleGifControl,
    status,
    applyClasses
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyClasses, { once: true });
  } else {
    applyClasses();
  }
})();

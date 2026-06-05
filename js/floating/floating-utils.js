(function(){
  'use strict';
  if (window.MudaeFloatingUtils) return;
  function getScrollTop(){
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  function isVisibleInViewport(element){
    if (!element?.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    const height = window.innerHeight || document.documentElement.clientHeight || 800;
    const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    return rect.bottom > 0 && rect.top < height && style?.display !== 'none' && style?.visibility !== 'hidden';
  }
  function shouldShowFloatingSearch(options = {}){
    const query = String(options.query || '').trim();
    const threshold = Number(options.threshold ?? 340);
    const mainSearch = options.mainSearch || document.getElementById('searchInput');
    const scrollTop = Number.isFinite(options.scrollTop) ? options.scrollTop : getScrollTop();
    return !!query || (scrollTop > threshold && !isVisibleInViewport(mainSearch));
  }
  function clampPosition(left, top, width, height, viewport = window){
    const pad = 10;
    const vw = viewport.innerWidth || document.documentElement.clientWidth || 1024;
    const vh = viewport.innerHeight || document.documentElement.clientHeight || 768;
    const maxLeft = Math.max(pad, vw - width - pad);
    const maxTop = Math.max(pad, vh - height - pad);
    return {
      left: Math.min(Math.max(pad, Number(left) || pad), maxLeft),
      top: Math.min(Math.max(pad, Number(top) || pad), maxTop)
    };
  }
  function readJsonStorage(key, fallback = null){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJsonStorage(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
  window.MudaeFloatingUtils = {
    getScrollTop,
    isVisibleInViewport,
    shouldShowFloatingSearch,
    clampPosition,
    readJsonStorage,
    writeJsonStorage
  };
})();

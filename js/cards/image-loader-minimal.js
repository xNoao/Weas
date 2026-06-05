(function(){
  'use strict';
  if (window.MudaeMinimalImageLoader) return;
  const observed = new WeakSet();
  const queued = new WeakSet();
  const queue = [];
  const activePreviewUrls = new Set();
  const forceUrlQueue = [];
  const forceUrlQueued = new Set();
  const loadedUrls = new Set();
  const requestedUrls = new Set();
  const failedUrls = new Set();
  const LOADED_URLS_KEY = 'mudae.loadedImageUrls.v1';
  const MAX_STORED_LOADED_URLS = 9000;
  let persistTimer = null;
  let changeTimer = 0;
  let observerActive = false;
  function emitImageLoaderChange(){
    if (changeTimer) return;
    changeTimer = setTimeout(() => {
      changeTimer = 0;
      try {
        window.dispatchEvent(new CustomEvent('mudae:image-loader-change'));
      } catch (_) {
        window.dispatchEvent(new Event('mudae:image-loader-change'));
      }
    }, 80);
  }
  function hydrateLoadedUrlMemory(){
    try {
      const raw = localStorage.getItem(LOADED_URLS_KEY);
      if (!raw) return;
      const urls = JSON.parse(raw);
      if (!Array.isArray(urls)) return;
      urls.forEach(url => {
        if (!url || typeof url !== 'string') return;
        loadedUrls.add(url);
        requestedUrls.add(url);
      });
    } catch (error) {
      console.warn('Could not hydrate loaded image URL memory', error);
    }
  }
  function persistLoadedUrlMemory(){
    persistTimer = null;
    try {
      const urls = Array.from(loadedUrls).slice(-MAX_STORED_LOADED_URLS);
      localStorage.setItem(LOADED_URLS_KEY, JSON.stringify(urls));
    } catch (error) {
      console.warn('Could not persist loaded image URL memory', error);
    }
  }
  function scheduleLoadedUrlPersist(){
    if (persistTimer) return;
    persistTimer = setTimeout(persistLoadedUrlMemory, 350);
  }
  function rememberSuccessfulUrl(url){
    if (!url || String(url).startsWith('data:')) return;
    const value = String(url);
    requestedUrls.add(value);
    loadedUrls.add(value);
    failedUrls.delete(value);
    scheduleLoadedUrlPersist();
  }
  hydrateLoadedUrlMemory();
  const MAX_CONCURRENT = 6;
  const LOAD_DELAY_MS = 28;
  let activeLoads = 0;
  let pumpTimer = null;
  let suspended = false;
  let forceLoadingAll = false;
  let forceCancelled = false;
  function finishLoad(img){
    const url = img?.currentSrc || img?.src || '';
    if (url) activePreviewUrls.delete(url);
    activeLoads = Math.max(0, activeLoads - 1);
    img?.classList?.remove('image-loading-minimal');
    img?.classList?.add('image-ready-minimal');
    emitImageLoaderChange();
    schedulePump();
  }
  function startLoad(img){
    if (!img?.dataset?.src) {
      schedulePump();
      return;
    }
    const src = img.dataset.src;
    requestedUrls.add(src);
    activePreviewUrls.add(src);
    activeLoads++;
    img.classList.add('image-loading-minimal');
    const done = () => finishLoad(img);
    img.addEventListener('load', () => {
      rememberSuccessfulUrl(src);
      img.classList.remove('image-load-error-minimal');
      done();
    }, { once: true });
    img.addEventListener('error', () => {
      requestedUrls.add(src);
      failedUrls.add(src);
      img.classList.add('image-load-error-minimal');
      done();
    }, { once: true });
    img.src = src;
    delete img.dataset.src;
    img.classList.remove('image-deferred-minimal');
    window.MudaeGifControl?.refresh?.();
  }
  function pruneQueue(){
    for (let i = queue.length - 1; i >= 0; i--) {
      const img = queue[i];
      if (!img?.dataset?.src || !document.documentElement.contains(img)) {
        queue.splice(i, 1);
      }
    }
  }
  function pumpQueue(){
    pumpTimer = null;
    pruneQueue();
    if (suspended) return;
    while (activeLoads < MAX_CONCURRENT && queue.length) {
      const img = queue.shift();
      if (!img?.dataset?.src || !document.documentElement.contains(img)) {
        continue;
      }
      startLoad(img);
    }
    if (queue.length && activeLoads < MAX_CONCURRENT) {
      schedulePump();
    }
  }
  function schedulePump(){
    if (suspended && !forceLoadingAll) return;
    if (pumpTimer) return;
    pumpTimer = setTimeout(pumpQueue, LOAD_DELAY_MS);
  }
  function queueImage(img){
    if (!img?.dataset?.src) return false;
    if (failedUrls.has(img.dataset.src)) return false;
    if (loadedUrls.has(img.dataset.src) || (requestedUrls.has(img.dataset.src) && !failedUrls.has(img.dataset.src))) {
      const src = img.dataset.src;
      requestedUrls.add(src);
      img.src = src;
      delete img.dataset.src;
      img.classList.remove('image-deferred-minimal', 'image-loading-minimal', 'image-load-error-minimal');
      img.classList.add('image-ready-minimal');
      return true;
    }
    if (!queued.has(img)) {
      queued.add(img);
      queue.push(img);
      return true;
    }
    return false;
  }
  function load(img){
    if (suspended) return;
    if (!img?.dataset?.src) return;
    queueImage(img);
    schedulePump();
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (suspended) continue;
          load(entry.target);
          io.unobserve(entry.target);
        }
      }, {
        root: null,
        rootMargin: '1200px 0px',
        threshold: 0.01
      })
    : null;
  function observe(img){
    if (!img || observed.has(img)) return;
    if (!img.dataset?.src) return;
    observed.add(img);
    if (io) io.observe(img);
    else load(img);
  }
  function scan(root = document){
    if (root?.nodeType === 1 && root.matches?.('img[data-src]')) {
      observe(root);
    }
    root?.querySelectorAll?.('img[data-src]').forEach(observe);
  }
  function releaseVisible(root = document, options = {}){
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const ahead = Number(options.ahead ?? 1400);
    const behind = Number(options.behind ?? 160);
    const max = Number(options.max ?? 96);
    const imgs = Array.from(root?.querySelectorAll?.('img[data-src]') || [])
      .filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top < viewportHeight + ahead && rect.bottom > -behind;
      })
      .slice(0, max);
    imgs.forEach(load);
  }
  function getPendingPreviewUrls(limit = 8){
    const urls = [];
    const seen = new Set();
    for (const url of activePreviewUrls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= limit) return urls;
    }
    for (const url of forceUrlQueue) {
      if (!url || seen.has(url) || failedUrls.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= limit) return urls;
    }
    for (const img of queue) {
      const url = img?.dataset?.src || '';
      if (!url || seen.has(url) || failedUrls.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= limit) return urls;
    }
    document.querySelectorAll('img[data-src]').forEach(img => {
      if (urls.length >= limit) return;
      const url = img.dataset?.src || '';
      if (!url || seen.has(url) || failedUrls.has(url)) return;
      seen.add(url);
      urls.push(url);
    });
    return urls;
  }
  function finishForceUrl(url, ok){
    activeLoads = Math.max(0, activeLoads - 1);
    activePreviewUrls.delete(url);
    if (ok) {
      rememberSuccessfulUrl(url);
    } else {
      requestedUrls.add(url);
      failedUrls.add(url);
    }
    emitImageLoaderChange();
    schedulePump();
    scheduleForcePump();
  }
  function startForceUrl(url){
    if (!url || forceCancelled) {
      scheduleForcePump();
      return;
    }
    if (loadedUrls.has(url) || failedUrls.has(url)) {
      scheduleForcePump();
      return;
    }
    activeLoads++;
    requestedUrls.add(url);
    activePreviewUrls.add(url);
    const probe = new Image();
    probe.decoding = 'async';
    probe.loading = 'eager';
    probe.addEventListener('load', () => finishForceUrl(url, true), { once: true });
    probe.addEventListener('error', () => finishForceUrl(url, false), { once: true });
    probe.src = url;
  }
  function pumpForceQueue(){
    if (!forceLoadingAll || forceCancelled) {
      if (forceCancelled) {
        forceUrlQueue.length = 0;
        forceUrlQueued.clear();
        activePreviewUrls.clear();
      }
      forceLoadingAll = false;
      emitImageLoaderChange();
      return;
    }
    while (activeLoads < MAX_CONCURRENT && forceUrlQueue.length) {
      const url = forceUrlQueue.shift();
      forceUrlQueued.delete(url);
      if (!url || loadedUrls.has(url) || failedUrls.has(url)) continue;
      startForceUrl(url);
    }
    if (!forceUrlQueue.length && activeLoads <= 0) {
      forceLoadingAll = false;
      emitImageLoaderChange();
      return;
    }
    if (forceUrlQueue.length) {
      scheduleForcePump();
    }
  }
  function scheduleForcePump(){
    if (pumpTimer) return;
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      pumpQueue();
      pumpForceQueue();
    }, LOAD_DELAY_MS);
  }
  function forceLoadUrls(urls = []){
    forceCancelled = false;
    forceLoadingAll = true;
    let added = 0;
    urls.forEach(raw => {
      const url = String(raw || '').trim();
      if (!url || url.startsWith('data:')) return;
      if (loadedUrls.has(url) || failedUrls.has(url) || forceUrlQueued.has(url)) return;
      forceUrlQueued.add(url);
      forceUrlQueue.push(url);
      added++;
    });
    scheduleForcePump();
    emitImageLoaderChange();
    if (!added && activeLoads <= 0 && !forceUrlQueue.length) {
      forceLoadingAll = false;
      emitImageLoaderChange();
    }
    return added;
  }
  function cancelForceLoad(){
    forceCancelled = true;
    forceLoadingAll = false;
    forceUrlQueue.length = 0;
    forceUrlQueued.clear();
    activePreviewUrls.clear();
    emitImageLoaderChange();
  }
  function forceLoadVisible(root = document){
    releaseVisible(root, { ahead: 1800, behind: 220, max: 140 });
    emitImageLoaderChange();
  }
  function forceLoadAll(rootOrUrls = document){
    if (Array.isArray(rootOrUrls)) {
      return forceLoadUrls(rootOrUrls);
    }
    const root = rootOrUrls || document;
    const imgs = Array.from(root?.querySelectorAll?.('img[data-src]') || []);
    const urls = imgs.map(img => img.dataset?.src).filter(Boolean);
    return forceLoadUrls(urls);
  }
  const mo = 'MutationObserver' in window
    ? new MutationObserver(mutations => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(node => scan(node));
        }
      })
    : null;
  function connectObserver(){
    if (!mo || !document.body || observerActive) return;
    mo.observe(document.body, {
      childList: true,
      subtree: true
    });
    observerActive = true;
  }
  function disconnectObserver(){
    if (!mo || !observerActive) return;
    mo.disconnect();
    observerActive = false;
  }
  function init(){
    scan(document);
    releaseVisible(document, { ahead: 1600, behind: 180, max: 120 });
    connectObserver();
  }
  window.MudaeMinimalImageLoader = {
    init,
    scan,
    load,
    releaseVisible,
    forceLoadVisible,
    forceLoadAll,
    cancelForceLoad,
    suspend: () => {
      suspended = true;
      disconnectObserver();
      if (pumpTimer) {
        clearTimeout(pumpTimer);
        pumpTimer = null;
      }
    },
    resume: (root = document) => {
      suspended = false;
      connectObserver();
      scan(root);
      releaseVisible(root, { ahead: 1600, behind: 180, max: 120 });
      schedulePump();
    },
    clearStale: pruneQueue,
    rememberLoadedUrl: url => {
      if (url) {
        requestedUrls.add(String(url));
        loadedUrls.add(String(url));
        failedUrls.delete(String(url));
      }
    },
    rememberImageElement: img => {
      const url = img?.currentSrc || img?.src || '';
      rememberSuccessfulUrl(url);
    },
    hasLoadedUrl: url => !!url && loadedUrls.has(String(url)),
    hasRequestedUrl: url => !!url && requestedUrls.has(String(url)) && !failedUrls.has(String(url)),
    hasFailedUrl: url => !!url && failedUrls.has(String(url)),
    getLoadedCount: () => loadedUrls.size,
    clearLoadedUrlMemory: () => {
      loadedUrls.clear();
      requestedUrls.clear();
      try {
        localStorage.removeItem(LOADED_URLS_KEY);
      } catch (error) {
        console.warn('Could not clear loaded image URL memory', error);
      }
      emitImageLoaderChange();
    },
    getFailedCount: () => failedUrls.size,
    clearFailedUrls: () => {
      failedUrls.clear();
      document.querySelectorAll('.image-load-error-minimal').forEach(img => {
        img.classList.remove('image-load-error-minimal');
      });
      emitImageLoaderChange();
    },
    retryFailedImages: () => {
      const failed = new Set(failedUrls);
      failedUrls.clear();
      document.querySelectorAll('img.char-img').forEach(img => {
        const url = img.dataset?.src || img.currentSrc || img.src || '';
        if (!url || url.startsWith('data:')) return;
        if (!failed.has(url)) return;
        img.classList.remove('image-load-error-minimal', 'image-loading-minimal');
        if (!img.dataset.src) {
          img.dataset.src = url;
        }
        if (img.dataset.pausedSrc) {
          img.src = img.dataset.pausedSrc;
        }
        load(img);
      });
      scan(document);
      releaseVisible(document);
      emitImageLoaderChange();
    },
    getPendingPreviewUrls,
    getQueueState: () => {
      pruneQueue();
      return {
        queued: queue.length + forceUrlQueue.length,
        activeLoads,
        maxConcurrent: MAX_CONCURRENT,
        pending: document.querySelectorAll('img[data-src]').length + forceUrlQueue.length,
        forceLoadingAll,
        loaded: loadedUrls.size,
        requested: requestedUrls.size,
        failed: failedUrls.size,
        previewUrls: getPendingPreviewUrls(8)
      };
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

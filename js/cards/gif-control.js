(function(){
  'use strict';
  if (window.MudaeGifControl) return;
  const tracked = new Set();
  const observed = new WeakSet();
  const PLAY_VISIBLE_RATIO = 0.90;
  const PAUSE_VISIBLE_RATIO = 0.55;
  const POSTER_PREP_MARGIN = 900;
  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  let checkQueued = false;
  function gifControlEnabled(){
    return window.MUDAE_PERF?.isGifControlEnabled?.() !== false;
  }
  function isAnimatedUrl(url){
    url = String(url || '').toLowerCase();
    return /\.gif(?:[?#].*)?$/.test(url) || url.includes('.gif?') || url.includes('.gif#');
  }
  function isGifImage(img){
    return !!(img && img.dataset && img.dataset.animatedSrc && isAnimatedUrl(img.dataset.animatedSrc));
  }
  function getPosterCanvas(img){
    if (!img || !img.parentNode) return null;
    let canvas = img.parentNode.querySelector(':scope > canvas.gif-poster');
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.className = 'gif-poster';
    canvas.hidden = true;
    img.insertAdjacentElement('afterend', canvas);
    return canvas;
  }
function showPoster(img){
    const canvas = getPosterCanvas(img);
    if (canvas && img.dataset.posterReady === '1') {
      canvas.hidden = false;
      img.classList.add('gif-has-poster');
      img.style.visibility = 'hidden';
      return true;
    }
    img.style.visibility = '';
    return false;
  }
function hidePoster(img){
    const canvas = getPosterCanvas(img);
    if (canvas) canvas.hidden = true;
    img.style.visibility = '';
  }
  function waitFrame(times = 1) {
    return new Promise(resolve => {
      const step = () => {
        times--;
        if (times <= 0) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  function isMostlyBlankCanvas(canvas) {
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return true;
      const sampleW = Math.min(64, width);
      const sampleH = Math.min(64, height);
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
      let blankish = 0;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 8 || (r > 244 && g > 244 && b > 244)) blankish++;
        total++;
      }
      return total > 0 && blankish / total > 0.92;
    } catch {
      return false;
    }
  }
  async function capturePosterFrame(temp, canvas, attempt = 0) {
    if (temp.decode) {
      try {
        await temp.decode();
      } catch {}
    }
    await waitFrame(2 + attempt);
    if (attempt > 0) {
      await waitMs(70 * attempt);
    }
    const width = temp.naturalWidth || 185;
    const height = temp.naturalHeight || 288;
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0, canvas.width, canvas.height);
    if (attempt < 3 && isMostlyBlankCanvas(canvas)) {
      return capturePosterFrame(temp, canvas, attempt + 1);
    }
    return true;
  }
  function ensurePoster(img){
    if (!isGifImage(img)) return;
    if (img.dataset.posterReady === '1' || img.dataset.posterLoading === '1') return;
    const animated = img.dataset.animatedSrc;
    const canvas = getPosterCanvas(img);
    if (!canvas || !animated) return;
    img.dataset.posterLoading = '1';
    const temp = new Image();
    temp.decoding = 'async';
    temp.loading = 'eager';
    temp.referrerPolicy = img.referrerPolicy || 'no-referrer';
    temp.onload = async () => {
      try {
        await capturePosterFrame(temp, canvas, 0);
        img.dataset.posterReady = '1';
        img.dataset.posterLoading = '0';
        if (!img.classList.contains('gif-playing')) {
          pause(img);
        }
      } catch {
        img.dataset.posterLoading = '0';
      }
    };
    temp.onerror = () => {
      img.dataset.posterLoading = '0';
    };
    temp.src = animated;
  }
function pause(img){
    if (!isGifImage(img)) return;
    ensurePoster(img);
    img.classList.add('gif-paused');
    img.classList.remove('gif-playing');
    img.dataset.playReady = '0';
    const hasPoster = showPoster(img);
    if (hasPoster && img.src !== TRANSPARENT_PIXEL) {
      img.src = TRANSPARENT_PIXEL;
    }
  }
function play(img){
    if (!isGifImage(img)) return;
    const animated = img.dataset.animatedSrc || '';
    if (!animated) return;
    img.classList.add('gif-playing');
    img.classList.remove('gif-paused');
    showPoster(img);
    const reveal = () => {
      if (!img.classList.contains('gif-playing')) return;
      img.dataset.playReady = '1';
      requestAnimationFrame(() => {
        if (!img.classList.contains('gif-playing')) return;
        hidePoster(img);
      });
    };
    if (img.src === animated && img.complete && img.naturalWidth > 0) {
      reveal();
      return;
    }
    img.dataset.playReady = '0';
    const onLoad = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      reveal();
    };
    const onError = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      showPoster(img);
    };
    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
    if (img.src !== animated) {
      img.src = animated;
    }
  }
  function visibleRatio(img){
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const visibleW = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
    const visibleH = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    return (visibleW * visibleH) / (rect.width * rect.height);
  }
  function nearViewport(img){
    const rect = img.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    return rect.bottom >= -POSTER_PREP_MARGIN && rect.top <= vh + POSTER_PREP_MARGIN;
  }
  function checkImage(img){
    if (!isGifImage(img) || !document.documentElement.contains(img)) {
      tracked.delete(img);
      return;
    }
    if (nearViewport(img)) ensurePoster(img);
    const ratio = visibleRatio(img);
    const isPlaying = img.classList.contains('gif-playing');
    if (isPlaying) {
      if (ratio <= PAUSE_VISIBLE_RATIO) pause(img);
      return;
    }
    if (ratio >= PLAY_VISIBLE_RATIO) {
      play(img);
    } else {
      pause(img);
    }
  }
  function checkAll(){
    checkQueued = false;
    tracked.forEach(checkImage);
  }
  function scheduleCheck(){
    if (checkQueued) return;
    checkQueued = true;
    requestAnimationFrame(checkAll);
  }
  function observe(img){
    if (!gifControlEnabled()) return;
    if (!isGifImage(img) || observed.has(img)) return;
    observed.add(img);
    tracked.add(img);
    pause(img);
    scheduleCheck();
  }
  function scan(root = document){
    if (!root) return;
    if (!gifControlEnabled()) {
      releaseAll();
      return;
    }
    if (root.nodeType === 1 && root.matches && root.matches('img[data-animated-src]')) {
      observe(root);
    }
    root.querySelectorAll?.('img[data-animated-src]').forEach(observe);
    scheduleCheck();
  }
  const mo = 'MutationObserver' in window
    ? new MutationObserver(mutations => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(node => scan(node));
        }
      })
    : null;
  function init(){
    scan(document);
    if (mo && document.body) {
      mo.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    document.addEventListener('scroll', scheduleCheck, { passive: true, capture: true });
    window.addEventListener('resize', scheduleCheck, { passive: true });
    window.addEventListener('orientationchange', scheduleCheck, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        tracked.forEach(pause);
      } else {
        scheduleCheck();
      }
    });
  }
  function release(img){
    if (!isGifImage(img)) return;
    const animated = img.dataset.animatedSrc;
    if (animated && img.src !== animated) img.src = animated;
    img.classList.remove('gif-paused', 'gif-playing', 'gif-has-poster');
    img.style.visibility = '';
    const canvas = img.parentNode?.querySelector?.(':scope > canvas.gif-poster');
    if (canvas) canvas.remove();
    delete img.dataset.posterReady;
    delete img.dataset.posterLoading;
    delete img.dataset.playReady;
  }
  function releaseAll(){
    tracked.forEach(release);
    tracked.clear();
    document.querySelectorAll?.('img[data-animated-src]').forEach(img => {
      release(img);
    });
  }
  function refresh(){
    if (!gifControlEnabled()) {
      releaseAll();
      return;
    }
    scan(document);
    scheduleCheck();
    setTimeout(scheduleCheck, 40);
    setTimeout(scheduleCheck, 120);
    setTimeout(scheduleCheck, 260);
  }
  function pauseAll(){
    tracked.forEach(pause);
    document.querySelectorAll?.('img[data-animated-src]').forEach(img => {
      if (!tracked.has(img)) observe(img);
      pause(img);
    });
  }
  window.MudaeGifControl = {
    init,
    refresh,
    observe,
    releaseAll,
    pauseAll,
    play,
    pause,
    isAnimatedUrl,
    getPlayVisibleRatio: () => PLAY_VISIBLE_RATIO,
    getPauseVisibleRatio: () => PAUSE_VISIBLE_RATIO
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* Mudae Organizer Rebuild gallery utilities.
   v2.338: extracted from app.js as a low-risk modularization pass. */
(() => {
  'use strict';

  if (window.MudaeGalleryUtils) return;

  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
      return new URL(raw).href;
    } catch {
      return '';
    }
  }

  function isAnimatedImageUrl(url) {
    url = String(url || '').toLowerCase();
    return /\.gif(?:[?#].*)?$/.test(url) || url.includes('.gif?') || url.includes('.gif#');
  }

  function isFirefoxRuntime() {
    return /firefox/i.test(navigator.userAgent || '');
  }

  function makeSoftDeadline(ms = 7) {
    const start = performance.now();
    return {
      timeRemaining(){
        return Math.max(0, ms - (performance.now() - start));
      },
      didTimeout: false
    };
  }

  function scheduleRenderChunk(callback) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout: 120 });
      return;
    }

    requestAnimationFrame(() => callback(makeSoftDeadline()));
  }

  function parseUrls(text) {
    const seen = new Set();
    const out = [];
    const re = /https?:\/\/[^\s<>'"`$]+/gi;
    let match;

    while ((match = re.exec(String(text || '')))) {
      let url = match[0]
        .trim()
        .replace(/[),.;\]}]+$/g, '');

      url = normalizeUrl(url);
      if (!url || seen.has(url)) continue;

      // Keep this permissive: Mudae/CDN image URLs do not always end with an
      // image extension, and query strings can hide the extension.
      if (!/^https?:\/\//i.test(url)) continue;

      seen.add(url);
      out.push(url);
    }

    return out;
  }

  function makeMudaeSearchUrl(name) {
    name = String(name || '').trim();

    const params = new URLSearchParams();
    params.set('type', 'character');
    if (name) params.set('name', name);
    params.set('sort', 'rank');
    params.set('desc', 'false');

    return 'https://mudae.net/search?' + params.toString() + '#mhp_auto=1&mhp_from=local_app';
  }

  window.MudaeGalleryUtils = {
    normalizeUrl,
    isAnimatedImageUrl,
    isFirefoxRuntime,
    makeSoftDeadline,
    scheduleRenderChunk,
    parseUrls,
    makeMudaeSearchUrl
  };
})();




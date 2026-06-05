(function(){
  'use strict';
  if (window.MudaeRebuildStorage) return;
  function saveLocal(storageKey, payload){
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }
  function loadLocal(storageKey, normalizePayload){
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof normalizePayload === 'function'
      ? normalizePayload(parsed)
      : parsed;
  }
  function clearLocal(storageKey){
    localStorage.removeItem(storageKey);
  }
  function safeDownloadName(value, fallback){
    const cleaned = String(value || fallback || 'mudae-rebuild')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return cleaned || (fallback || 'mudae-rebuild');
  }
  function ensureJsonExtension(filename){
    const name = safeDownloadName(filename, 'mudae-rebuild');
    return /\.json$/i.test(name) ? name : name + '.json';
  }
  function downloadJson(payload, filenameBase){
    const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const name = ensureJsonExtension(filenameBase);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  async function readJsonFile(file, normalizePayload){
    const text = await file.text();
    const parsed = JSON.parse(text);
    return typeof normalizePayload === 'function'
      ? normalizePayload(parsed)
      : parsed;
  }
  window.MudaeRebuildStorage = {
    saveLocal,
    loadLocal,
    clearLocal,
    downloadJson,
    readJsonFile,
    safeDownloadName,
    ensureJsonExtension
  };
})();

/* Mudae Organizer Rebuild JSON IO helpers.
   Owns user-facing JSON import/export helpers that sit above storage.js.
   Keep this module UI-light: callers provide dialog callbacks.
*/
(function(){
  'use strict';

  if (window.MudaeJsonIo) return;

  function str(value){
    return String(value ?? '').trim();
  }

  function storage(){
    return window.MudaeRebuildStorage || null;
  }

  function safeDownloadName(value, fallback){
    const api = storage();
    if (api?.safeDownloadName) return api.safeDownloadName(value, fallback);

    const cleaned = String(value || fallback || 'mudae-rebuild')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    return cleaned || (fallback || 'mudae-rebuild');
  }

  function ensureJsonExtension(filename){
    const api = storage();
    if (api?.ensureJsonExtension) return api.ensureJsonExtension(filename);

    const name = safeDownloadName(filename, 'mudae-rebuild');
    return /\.json$/i.test(name) ? name : name + '.json';
  }

  function buildDefaultJsonFilename(haremName){
    const baseName = safeDownloadName(haremName || 'mudae-harem-organizer', 'mudae-harem-organizer');
    return ensureJsonExtension(`${baseName} rebuild backup`);
  }

  async function askJsonDownloadFilename(options = {}){
    const defaultName = ensureJsonExtension(options.defaultName || buildDefaultJsonFilename(options.haremName));
    const showPrompt = options.showPrompt;

    if (typeof showPrompt !== 'function') {
      console.warn('MudaeJsonIo.askJsonDownloadFilename called without a standard prompt handler. Using default filename.');
      return defaultName;
    }

    const typed = await showPrompt('Choose the filename for this JSON backup.', defaultName, {
      title: 'Save JSON',
      inputLabel: 'Filename',
      okText: 'Save JSON',
      cancelText: 'Cancel'
    });

    if (typed === null) return null;
    return ensureJsonExtension(str(typed) || defaultName);
  }

  function downloadJsonPayload(payload, filename){
    const api = storage();
    if (!api?.downloadJson) throw new Error('JSON storage module is not available.');
    api.downloadJson(payload, ensureJsonExtension(filename));
  }

  async function readJsonFile(file, normalizePayload){
    const api = storage();
    if (!api?.readJsonFile) throw new Error('JSON storage module is not available.');
    return api.readJsonFile(file, normalizePayload);
  }

  function clearLocalState(storageKey){
    const api = storage();
    if (!api?.clearLocal) throw new Error('JSON storage module is not available.');
    api.clearLocal(storageKey);
  }

  window.MudaeJsonIo = {
    safeDownloadName,
    ensureJsonExtension,
    buildDefaultJsonFilename,
    askJsonDownloadFilename,
    downloadJsonPayload,
    readJsonFile,
    clearLocalState
  };
})();

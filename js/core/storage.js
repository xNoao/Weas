/* Mudae Organizer Rebuild storage module.
   Owns local persistence, IndexedDB, localStorage references and JSON downloads.

   v765: IndexedDB is now the primary store for the large harem state.
   localStorage is kept only as a small pointer/reference plus lightweight app settings.
*/
(function(){
  'use strict';

  if (window.MudaeRebuildStorage) return;

  const IDB_DB_NAME = 'MudaeHaremOrganizerStorage';
  const IDB_STORE_NAME = 'state';
  const IDB_REF_MARKER = '__mhpStorageRef';
  const STORAGE_PREF_KEY = 'mhp.storage.primaryMode.v1';
  const STORAGE_STATUS_IDS = {
    text: 'storageStatusText',
    hint: 'storageStatusHint',
    mode: 'storageModeValue',
    save: 'storageSaveValue',
    persistent: 'storagePersistentValue',
    usage: 'storageUsageValue',
    persistentBtn: 'enablePersistentStorageBtn',
    refreshBtn: 'refreshStorageStatusBtn'
  };

  let lastSaveInfo = { mode: 'unknown', size: 0, error: null };
  let lastStatusInfo = null;
  let lastStatusRefreshAt = 0;

  function isQuotaError(error){
    return !!error && (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014 ||
      /quota/i.test(String(error.message || error))
    );
  }

  function hasIndexedDb(){
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  function openDb(){
    return new Promise((resolve, reject) => {
      if (!hasIndexedDb()) {
        reject(new Error('IndexedDB is not available.'));
        return;
      }
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
    });
  }

  async function idbPut(key, value){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).put({
        key,
        value,
        updatedAt: new Date().toISOString(),
        size: String(value || '').length
      });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { const err = tx.error || new Error('IndexedDB save failed.'); db.close(); reject(err); };
      tx.onabort = () => { const err = tx.error || new Error('IndexedDB save aborted.'); db.close(); reject(err); };
    });
  }

  async function idbGet(key){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const request = tx.objectStore(IDB_STORE_NAME).get(key);
      request.onsuccess = () => { db.close(); resolve(request.result?.value || ''); };
      request.onerror = () => { const err = request.error || new Error('IndexedDB read failed.'); db.close(); reject(err); };
    });
  }

  async function idbDelete(key){
    try {
      const db = await openDb();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).delete(key);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
        tx.onabort = () => { db.close(); resolve(false); };
      });
    } catch (_) {
      return false;
    }
  }

  function makeIdbRef(storageKey, size){
    return JSON.stringify({
      [IDB_REF_MARKER]: 'indexeddb',
      version: 2,
      key: storageKey,
      size: Number(size || 0) || 0,
      primary: true,
      updatedAt: new Date().toISOString()
    });
  }

  function parseIdbRef(raw){
    try {
      const parsed = JSON.parse(raw || '');
      return parsed && parsed[IDB_REF_MARKER] === 'indexeddb' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function formatBytes(bytes){
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return '0 B';
    if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${Math.round(n)} B`;
  }

  function dispatchStorageChange(detail){
    window.dispatchEvent(new CustomEvent('mhp:storage-mode-change', { detail: { ...detail } }));
  }

  function writeLocalRef(storageKey, size){
    try {
      localStorage.setItem(storageKey, makeIdbRef(storageKey, size));
      try { localStorage.setItem(STORAGE_PREF_KEY, 'indexedDB'); } catch (_) {}
      return true;
    } catch (error) {
      // If even the tiny reference cannot be written, the data is still in IDB.
      console.warn('[MHP] Could not write localStorage IndexedDB reference:', error);
      return false;
    }
  }

  function saveLocal(storageKey, payload){
    const json = JSON.stringify(payload);

    // Primary path: IndexedDB. localStorage only stores a small pointer.
    if (hasIndexedDb()) {
      lastSaveInfo = { mode: 'indexedDB-pending', size: json.length, error: null };
      dispatchStorageChange(lastSaveInfo);
      idbPut(storageKey, json)
        .then(() => {
          writeLocalRef(storageKey, json.length);
          lastSaveInfo = { mode: 'indexedDB', size: json.length, error: null };
          refreshStorageStatus({ silent: true });
          dispatchStorageChange(lastSaveInfo);
        })
        .catch((idbError) => {
          console.error('[MHP] IndexedDB primary save failed:', idbError);
          try {
            localStorage.setItem(storageKey, json);
            lastSaveInfo = { mode: 'localStorage-fallback', size: json.length, error: null };
          } catch (localError) {
            lastSaveInfo = { mode: 'failed', size: json.length, error: isQuotaError(localError) ? localError : (idbError || localError) };
            console.error('[MHP] localStorage fallback save failed:', localError);
          }
          refreshStorageStatus({ silent: true });
          dispatchStorageChange(lastSaveInfo);
        });
      return true;
    }

    // Last resort for unusual browsers/environments.
    try {
      localStorage.setItem(storageKey, json);
      lastSaveInfo = { mode: 'localStorage', size: json.length, error: null };
      dispatchStorageChange(lastSaveInfo);
      return true;
    } catch (error) {
      lastSaveInfo = { mode: 'failed', size: json.length, error };
      dispatchStorageChange(lastSaveInfo);
      throw error;
    }
  }

  async function getLocalRaw(storageKey){
    const raw = localStorage.getItem(storageKey);
    const ref = parseIdbRef(raw);
    if (ref) {
      try {
        const value = await idbGet(ref.key || storageKey);
        if (value) return value;
      } catch (error) {
        console.error('[MHP] IndexedDB read failed:', error);
      }
      return '';
    }

    // Migration path: old versions stored the full JSON in localStorage.
    // Read it, then future saves will move it to IndexedDB automatically.
    return raw || '';
  }

  function getLocalRawSync(storageKey){
    const raw = localStorage.getItem(storageKey);
    return parseIdbRef(raw) ? '' : (raw || '');
  }

  function loadLocal(storageKey, normalizePayload){
    const raw = getLocalRawSync(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return typeof normalizePayload === 'function'
      ? normalizePayload(parsed)
      : parsed;
  }

  function clearLocal(storageKey){
    localStorage.removeItem(storageKey);
    idbDelete(storageKey).finally(() => refreshStorageStatus({ silent: true }));
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

  function getLastSaveInfo(){
    return { ...lastSaveInfo };
  }

  async function getStorageEstimate(){
    if (!navigator.storage?.estimate) return null;
    try { return await navigator.storage.estimate(); }
    catch (_) { return null; }
  }

  async function isPersistentStorageGranted(){
    if (!navigator.storage?.persisted) return null;
    try { return await navigator.storage.persisted(); }
    catch (_) { return null; }
  }

  async function requestPersistentStorage(){
    if (!navigator.storage?.persist) return false;
    try {
      const granted = await navigator.storage.persist();
      await refreshStorageStatus({ silent: false });
      return !!granted;
    } catch (_) {
      await refreshStorageStatus({ silent: false });
      return false;
    }
  }

  async function getStorageStatus(storageKey){
    const rawRef = (() => { try { return localStorage.getItem(storageKey) || ''; } catch (_) { return ''; } })();
    const ref = parseIdbRef(rawRef);
    const estimate = await getStorageEstimate();
    const persisted = await isPersistentStorageGranted();
    const status = {
      primary: ref ? 'indexedDB' : 'localStorage',
      hasIndexedDb: hasIndexedDb(),
      ref,
      savedSize: ref?.size || (rawRef ? rawRef.length : 0),
      estimate,
      persisted,
      lastSave: getLastSaveInfo()
    };
    lastStatusInfo = status;
    return status;
  }

  function renderStorageStatus(status){
    const text = document.getElementById(STORAGE_STATUS_IDS.text);
    const hint = document.getElementById(STORAGE_STATUS_IDS.hint);
    const modeNode = document.getElementById(STORAGE_STATUS_IDS.mode);
    const saveNode = document.getElementById(STORAGE_STATUS_IDS.save);
    const persistentNode = document.getElementById(STORAGE_STATUS_IDS.persistent);
    const usageNode = document.getElementById(STORAGE_STATUS_IDS.usage);
    const persistBtn = document.getElementById(STORAGE_STATUS_IDS.persistentBtn);
    if (!text && !hint && !modeNode && !saveNode && !persistentNode && !usageNode && !persistBtn) return;

    const primary = status?.primary === 'indexedDB' ? 'IndexedDB' : 'localStorage';
    const saved = formatBytes(status?.savedSize || 0);
    const usage = status?.estimate?.usage ? formatBytes(status.estimate.usage) : 'Unknown';
    const quota = status?.estimate?.quota ? formatBytes(status.estimate.quota) : 'Unknown';
    const persisted = status?.persisted === true ? 'Enabled' : (status?.persisted === false ? 'No' : 'Unknown');
    const last = status?.lastSave?.mode ? String(status.lastSave.mode).replace(/-/g, ' ') : 'Unknown';

    if (text) text.textContent = `${primary} · ${saved} · Persistent: ${persisted}`;
    if (modeNode) modeNode.textContent = primary;
    if (saveNode) saveNode.textContent = saved;
    if (persistentNode) persistentNode.textContent = persisted;
    if (usageNode) {
      usageNode.textContent = quota === 'Unknown' ? usage : `${usage} / ${quota}`;
      usageNode.title = quota === 'Unknown'
        ? `Browser storage estimate: ${usage}. This is not the harem save size.`
        : `Browser storage estimate: ${usage} / ${quota}. This is not the harem save size.`;
    }
    if (hint) {
      const estimateText = quota === 'Unknown' ? usage : `${usage} / ${quota}`;
      const refreshedAt = status?.refreshedAt
        ? new Date(status.refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      hint.textContent = `Main Save: ${saved}. Browser Estimate: ${estimateText}.${refreshedAt ? ` Updated: ${refreshedAt}.` : ''}`;
      hint.title = 'The browser estimate comes from navigator.storage.estimate() and can include broad browser/origin storage. The harem save size is the Save row.';
    }
    if (persistBtn) {
      persistBtn.textContent = status?.persisted === true ? 'Persistent Enabled' : 'Enable Persistent';
      persistBtn.disabled = status?.persisted === true || !navigator.storage?.persist;
      persistBtn.title = status?.persisted === true
        ? 'Persistent Storage Is Already Enabled.'
        : 'Ask The Browser To Protect Local Data From Automatic Cleanup.';
    }
  }

  async function refreshStorageStatus(options = {}){
    try {
      const now = Date.now();
      const force = options.force === true || options.silent !== true;

      // navigator.storage.estimate() can be relatively expensive and saveLocal()
      // may be called several times during rapid edits/gallery imports. Reuse a
      // fresh silent result instead of asking the browser for quota data again.
      if (!force && lastStatusInfo && now - lastStatusRefreshAt < 1500) {
        renderStorageStatus(lastStatusInfo);
        return lastStatusInfo;
      }

      const api = window.MUDAE_REBUILD_V1;
      const key = api?.STORAGE_KEY || 'mudaeRebuildState.v1';
      const status = await getStorageStatus(key);
      lastStatusRefreshAt = Date.now();
      status.refreshedAt = lastStatusRefreshAt;
      renderStorageStatus(status);
      return status;
    } catch (error) {
      if (!options.silent) console.error('[MHP] Storage status refresh failed:', error);
      return lastStatusInfo;
    }
  }

  function bindStorageStatusUi(){
    const persistBtn = document.getElementById(STORAGE_STATUS_IDS.persistentBtn);
    const refreshBtn = document.getElementById(STORAGE_STATUS_IDS.refreshBtn);
    if (persistBtn && !persistBtn.dataset.mhpBound) {
      persistBtn.dataset.mhpBound = '1';
      persistBtn.addEventListener('click', async event => {
        event.preventDefault();
        persistBtn.disabled = true;
        persistBtn.textContent = 'Requesting...';
        const granted = await requestPersistentStorage();
        persistBtn.textContent = granted ? 'Persistent Enabled' : 'Not Granted';
        setTimeout(() => refreshStorageStatus({ silent: true }), 300);
      });
    }
    if (refreshBtn && !refreshBtn.dataset.mhpBound) {
      refreshBtn.dataset.mhpBound = '1';
      refreshBtn.addEventListener('click', async event => {
        event.preventDefault();
        const originalText = refreshBtn.textContent || 'Refresh';
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing...';
        try {
          await refreshStorageStatus({ silent: false, force: true });
          refreshBtn.textContent = 'Updated';
        } finally {
          setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.textContent = originalText;
          }, 850);
        }
      });
    }
    refreshStorageStatus({ silent: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindStorageStatusUi();
    setTimeout(() => refreshStorageStatus({ silent: true }), 600);
    setTimeout(() => refreshStorageStatus({ silent: true }), 2500);
  });
  window.addEventListener('mhp:storage-mode-change', () => refreshStorageStatus({ silent: true }));

  window.MudaeRebuildStorage = {
    saveLocal,
    loadLocal,
    clearLocal,
    downloadJson,
    readJsonFile,
    safeDownloadName,
    ensureJsonExtension,
    getLocalRaw,
    getLocalRawSync,
    getLastSaveInfo,
    getStorageStatus,
    getStorageEstimate,
    requestPersistentStorage,
    isPersistentStorageGranted,
    refreshStorageStatus
  };
})();

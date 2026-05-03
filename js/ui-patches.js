(function(){
if(window.__kounoUnifiedSyncV1)return;window.__kounoUnifiedSyncV1=true;

function q(id){return document.getElementById(id);}
function getElsCheckbox(){return (window.els&&els.syncModeCheckbox)||q('syncModeCheckbox');}

function syncToolbarButtonState(){var checkbox=els.syncModeCheckbox||document.getElementById('syncModeCheckbox');var label=document.getElementById('syncModeLabel');if(!checkbox||!label)return;if(!checkbox.dataset.syncToolbarUiBound){checkbox.addEventListener('change',syncToolbarButtonState);checkbox.dataset.syncToolbarUiBound='1';}label.classList.toggle('sync-active',!!checkbox.checked);label.setAttribute('aria-pressed',checkbox.checked?'true':'false');label.setAttribute('title','');}

function setSyncModeChecked(value){var checkbox=els.syncModeCheckbox||document.getElementById('syncModeCheckbox');if(!checkbox)return;checkbox.checked=!!value;syncToolbarButtonState();checkbox.dispatchEvent(new Event('change',{bubbles:true}));}

function sanitizeIncomingMissing(list){
  (Array.isArray(list)?list:[]).forEach(function(item){if(item)item.missing=false;});
  return list;
}
function ensureAlbumRule(){
  if(typeof window.processAlbumSyncReplacementQueue!=='function')return false;
  if(window.processAlbumSyncReplacementQueue.__kounoUnifiedSyncV1Wrapped)return true;
  var original=window.processAlbumSyncReplacementQueue;
  window.processAlbumSyncReplacementQueue=async function(oldCharacters,matchedByOldIndex,unmatchedIncoming){
    var result=await original.apply(this,arguments);
    sanitizeIncomingMissing(unmatchedIncoming);
    return result;
  };
  window.processAlbumSyncReplacementQueue.__kounoUnifiedSyncV1Wrapped=true;
  return true;
}
function currentMode(){
  if(window.AppState&&AppState.syncModeType==='album')return 'album';
  var select=q('syncModeTypeSelect');
  return select&&select.value==='album'?'album':'normal';
}
function ensureStyles(){
  if(q('kouno-sync-buttons-style'))return;
  var style=document.createElement('style');
  style.id='kouno-sync-buttons-style';
  style.textContent=''
    +'#syncModeTypeWrap.sync-type-wrap{display:inline-flex!important;align-items:stretch!important;justify-content:center!important;margin-left:0!important;height:40px!important;min-height:40px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;}'
    +'#syncModeTypeWrap.sync-type-wrap.is-hidden{display:none!important;}'
    +'#syncModeTypeWrap .sync-type-select{display:none!important;}'
    +'#syncModeTypeWrap .sync-type-buttons{display:inline-flex;flex-direction:column;align-items:stretch;justify-content:stretch;gap:2px;flex-wrap:nowrap;height:40px;min-height:40px;}'
    +'#syncModeTypeWrap .sync-type-mode-btn{width:68px;min-width:68px;max-width:68px;flex:1 1 0;height:auto;min-height:0;padding:0 8px;border-radius:8px;border:1px solid rgba(167,139,250,.22);background:rgba(255,255,255,.04);color:#e5e7eb;font-weight:800;font-size:.66rem;line-height:1;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease;}'
    +'#syncModeTypeWrap .sync-type-mode-btn:hover{transform:translateY(-1px);border-color:rgba(196,181,253,.38);background:rgba(124,58,237,.12);}'
    +'#syncModeTypeWrap .sync-type-mode-btn.is-active{background:linear-gradient(180deg,rgba(109,40,217,.34),rgba(76,29,149,.34));border-color:rgba(196,181,253,.58);color:#f5f3ff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);}'
    +'body[data-theme="light"] #syncModeTypeWrap .sync-type-mode-btn{background:rgba(124,58,237,.05);border-color:rgba(124,58,237,.14);color:#1f2340;}'
    +'body[data-theme="light"] #syncModeTypeWrap .sync-type-mode-btn:hover{background:rgba(124,58,237,.10);border-color:rgba(124,58,237,.22);}'
    +'body[data-theme="light"] #syncModeTypeWrap .sync-type-mode-btn.is-active{background:linear-gradient(180deg,rgba(196,181,253,.82),rgba(167,139,250,.66));border-color:rgba(109,40,217,.38);color:#4c1d95;}';
  document.head.appendChild(style);
}
function ensureSyncModeTypeUI(){
  ensureStyles();
  var wrap=q('syncModeTypeWrap');
  var select=q('syncModeTypeSelect');
  if(!wrap&&select)wrap=select.closest('.sync-type-wrap');
  if(!wrap)return null;
  wrap.id='syncModeTypeWrap';
  wrap.classList.remove('btn','btn-ghost');
  wrap.classList.add('sync-type-wrap');
  wrap.removeAttribute('for');
  if(select){select.classList.add('sync-type-select');select.tabIndex=-1;select.setAttribute('aria-hidden','true');}
  var group=q('syncModeTypeButtons');
  if(!group){
    group=document.createElement('div');
    group.id='syncModeTypeButtons';
    group.className='sync-type-buttons';
    group.innerHTML=''
      +'<button type="button" class="sync-type-mode-btn" data-mode="normal">Normal</button>'
      +'<button type="button" class="sync-type-mode-btn" data-mode="album">Album</button>';
    wrap.appendChild(group);
  }
  return wrap;
}
function getSyncModeType(){return currentMode();}
function isAlbumSyncMode(){return currentMode()==='album';}
function refreshSyncModeTypeUI(){
  var wrap=ensureSyncModeTypeUI();
  if(!wrap)return;
  var mode=currentMode();
  var checkbox=getElsCheckbox();
  var syncOn=!!(checkbox&&checkbox.checked);
  wrap.classList.toggle('is-hidden',!syncOn);
  wrap.setAttribute('aria-hidden',syncOn?'false':'true');
  var buttons=wrap.querySelectorAll('.sync-type-mode-btn');
  Array.prototype.forEach.call(buttons,function(btn){
    var active=btn.getAttribute('data-mode')===mode;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
    btn.disabled=!syncOn;
    btn.tabIndex=syncOn?0:-1;
  });
}
function setMode(mode){
  var next=mode==='album'?'album':'normal';
  var select=q('syncModeTypeSelect');
  if(select)select.value=next;
  if(window.AppState)AppState.syncModeType=next;
  refreshSyncModeTypeUI();
  if(typeof window.saveLocal==='function'){try{saveLocal(false);}catch(e){}}
}
function bindSyncType(){
  var wrap=ensureSyncModeTypeUI();
  var checkbox=getElsCheckbox();
  var select=q('syncModeTypeSelect');
  if(wrap&&!wrap.dataset.syncButtonsBound){
    wrap.dataset.syncButtonsBound='1';
    wrap.addEventListener('click',function(event){
      var btn=event.target&&event.target.closest?event.target.closest('.sync-type-mode-btn'):null;
      if(!btn)return;
      event.preventDefault();
      if(checkbox&&!checkbox.checked)return;
      setMode(btn.getAttribute('data-mode'));
    });
  }
  if(select&&!select.dataset.syncButtonsMirrorBound){
    select.dataset.syncButtonsMirrorBound='1';
    select.addEventListener('change',function(){if(window.AppState)AppState.syncModeType=currentMode();refreshSyncModeTypeUI();});
  }
  if(checkbox&&!checkbox.dataset.syncButtonsToggleBound){
    checkbox.dataset.syncButtonsToggleBound='1';
    checkbox.addEventListener('change',function(){if(window.AppState)AppState.syncModeType=currentMode();refreshSyncModeTypeUI();});
  }
  refreshSyncModeTypeUI();
  syncToolbarButtonState();
}

function enforceSevenColumnBoard(){try{var styleId='mhp-seven-columns-style';if(!document.getElementById(styleId)){var style=document.createElement('style');style.id=styleId;style.textContent='#board{grid-template-columns:repeat(7,minmax(0,1fr)) !important;} .character-card.is-missing{opacity:.82;filter:saturate(.76);} .character-card[data-missing="true"]{position:relative;} .character-card .missing-overlay{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);z-index:4;display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;border-radius:999px;background:rgba(127,29,29,.92);color:#fff;border:1px solid rgba(255,255,255,.2);font-weight:700;font-size:13px;letter-spacing:.02em;box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none;} #hideMissingContainer{display:inline-flex;align-items:center;margin-left:8px;} #hideMissingToggle{display:none;} #hideMissingLabel{display:inline-flex;align-items:center;justify-content:center;}';document.head.appendChild(style);}}catch(error){}}var DeleteConfirmState={onConfirm:null};var deleteModalEls={overlay:document.getElementById('deleteModalOverlay'),title:document.getElementById('deleteModalTitle'),subtitle:document.getElementById('deleteModalSubtitle'),help:document.getElementById('deleteModalHelp'),cancelBtn:document.getElementById('deleteCancelBtn'),confirmBtn:document.getElementById('deleteConfirmBtn')};

/* utils moved to utils.js */

window.KounoSyncV13={sanitizeIncomingMissing:sanitizeIncomingMissing,ensureAlbumRule:ensureAlbumRule,currentMode:currentMode};
window.syncToolbarButtonState=syncToolbarButtonState;
window.setSyncModeChecked=setSyncModeChecked;
window.ensureSyncModeTypeUI=ensureSyncModeTypeUI;
window.getSyncModeType=getSyncModeType;
window.isAlbumSyncMode=isAlbumSyncMode;
window.refreshSyncModeTypeUI=refreshSyncModeTypeUI;
window.bindSyncType=bindSyncType;
window.enforceSevenColumnBoard=enforceSevenColumnBoard;

ensureAlbumRule();
})();

/* ============================================================
   Late UI patches merged from previous js/ui-patches.js
   These run after the main scripts are loaded.
   ============================================================ */
(function(){
if(window.__kounoUiPatchesLateRunnerV1)return;
window.__kounoUiPatchesLateRunnerV1=true;
function runKounoUiPatchesLate(){
/* ============================================================
   Merged from js/filters.js
   ============================================================ */
(function(){
if(window.__kounoFiltersV13)return;window.__kounoFiltersV13=true;
function realCharacters(list){
  if(typeof window.getRealCharacters==='function')return getRealCharacters(Array.isArray(list)?list:[]);
  return (Array.isArray(list)?list:[]).filter(function(item){return !(item&&item.type==='divider');});
}
function shouldHideMissing(item){return !!(window.AppState&&AppState.hideMissingCards&&item&&!item.type&&item.missing);}
function filterMissingByToggle(items){
  var list=Array.isArray(items)?items:[];
  if(!window.AppState||!AppState.hideMissingCards)return list;
  return list.filter(function(item){return item&&item.type==='divider' || !item.missing;});
}
function getSummaryCharacters(items){
  var chars=realCharacters(items);
  if(window.AppState&&AppState.hideMissingCards&&typeof window.filterOutMissingCharacters==='function')return filterOutMissingCharacters(chars);
  return chars;
}
var originalGetFilteredCharacters=typeof window.getFilteredCharacters==='function'?window.getFilteredCharacters:null;
if(originalGetFilteredCharacters&&!originalGetFilteredCharacters.__kounoFiltersV13Wrapped){
  window.getFilteredCharacters=function(){
    return filterMissingByToggle(originalGetFilteredCharacters.apply(this,arguments));
  };
  window.getFilteredCharacters.__kounoFiltersV13Wrapped=true;
}
window.KounoFiltersV13={realCharacters:realCharacters,filterMissingByToggle:filterMissingByToggle,getSummaryCharacters:getSummaryCharacters,shouldHideMissing:shouldHideMissing};
})();

/* ============================================================
   Merged from js/summary.js
   ============================================================ */
(function () {
  if (window.__kounoSummaryV14) return;
  window.__kounoSummaryV14 = true;

  function toList(value) {
    return Array.isArray(value) ? value : [];
  }

  function toNumber(value) {
    return Number(value) || 0;
  }

  function fmt(value) {
    if (typeof window.formatSummaryNumber === 'function') {
      return window.formatSummaryNumber(toNumber(value));
    }
    return String(toNumber(value));
  }

  function sumField(list, key) {
    return toList(list).reduce(function (total, item) {
      return total + toNumber(item && item[key]);
    }, 0);
  }

  function sumSphereCost(list) {
    return toList(list).reduce(function (total, item) {
      if (typeof window.getSphereCostTotal !== 'function') return total;
      return total + toNumber(window.getSphereCostTotal(item));
    }, 0);
  }

  function getCounts(list) {
    if (typeof window.computeCurrentCountsFromCharacters === 'function') {
      return window.computeCurrentCountsFromCharacters(list);
    }

    return {
      wa: 0,
      ha: 0,
      wg: 0,
      hg: 0
    };
  }

  function getSummaryScope(items) {
    var list = toList(items);

    if (
      window.KounoFiltersV13 &&
      typeof window.KounoFiltersV13.getSummaryCharacters === 'function'
    ) {
      return window.KounoFiltersV13.getSummaryCharacters(list);
    }

    if (typeof window.getRealCharacters === 'function') {
      return window.getRealCharacters(list);
    }

    return list;
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
  }

  function getGenderBucket(char) {
    if (!char) return 'unknown';

    if (typeof window.getCharacterGenderBucket === 'function') {
      return window.getCharacterGenderBucket(char);
    }

    var roulette = normalizeText(char.roulette);
    var hasWaifu = roulette.indexOf('wa') !== -1 || roulette.indexOf('wg') !== -1;
    var hasHusbando = roulette.indexOf('ha') !== -1 || roulette.indexOf('hg') !== -1;

    if (hasWaifu && hasHusbando) return 'mixed';
    if (hasWaifu) return 'female';
    if (hasHusbando) return 'male';
    return 'unknown';
  }

  function getGenderTotals(list) {
    return toList(list).reduce(
      function (acc, char) {
        var bucket = getGenderBucket(char);

        if (bucket === 'female') acc.waifus += 1;
        else if (bucket === 'male') acc.husbandos += 1;
        else if (bucket === 'mixed') acc.both += 1;
        else acc.unknown += 1;

        return acc;
      },
      {
        waifus: 0,
        husbandos: 0,
        both: 0,
        unknown: 0
      }
    );
  }

  function getVisibleBaseList() {
    if (typeof window.getFilteredCharacters === 'function') {
      return window.getFilteredCharacters() || [];
    }
    return toList(window.AppState && AppState.characters);
  }

  function buildSummary() {
    var allCharacters = getSummaryScope(window.AppState && AppState.characters);
    var visibleCharacters = getSummaryScope(getVisibleBaseList());
    var counts = getCounts(allCharacters);
    var genderTotals = getGenderTotals(allCharacters);

    return {
      totalScope: allCharacters,
      visibleScope: visibleCharacters,
      totalKakera: sumField(allCharacters, 'kakera'),
      totalKeys: sumField(allCharacters, 'keys'),
      totalSpheres: sumSphereCost(allCharacters),
      counts: counts,
      genderTotals: genderTotals
    };
  }

  function renderSummary(summary) {
    if (!window.els || !summary) return;

    if (els.totalCount) {
      els.totalCount.textContent = fmt(summary.totalScope.length);
    }

    if (els.visibleCount) {
      els.visibleCount.textContent = fmt(summary.visibleScope.length);
    }

    if (els.totalKakera) {
      els.totalKakera.textContent = fmt(summary.totalKakera);
    }

    if (els.totalKeys) {
      els.totalKeys.textContent = fmt(summary.totalKeys);
    }

    var totalSpheresEl = els.totalSpheres || document.getElementById('totalSpheres');
    if (totalSpheresEl) {
      totalSpheresEl.textContent = fmt(summary.totalSpheres);
    }

    if (els.haremName) {
      els.haremName.textContent = String(
        (window.AppState && AppState.haremName) || '-'
      ).replace(/\s+/g, ' ').trim();
    }

    if (els.haremValue) {
      els.haremValue.textContent = fmt(summary.totalKakera);
    }

    if (els.wahaCount) {
      els.wahaCount.textContent =
        fmt(summary.genderTotals.waifus) +
        ' / ' +
        fmt(summary.genderTotals.husbandos) +
        ' / ' +
        fmt(summary.genderTotals.both);
    }

    if (els.wghgCount) {
      els.wghgCount.textContent =
        fmt(summary.counts.wg || 0) +
        ' / ' +
        fmt(summary.counts.hg || 0) +
        ' / ' +
        fmt((summary.counts.wg || 0) + (summary.counts.hg || 0));
    }
  }

  function syncAppState(summary) {
    if (!window.AppState || !summary) return;
    AppState.totalValue = summary.totalKakera;
    AppState.counts = summary.counts;
  }

  function runSafe(fn) {
    if (typeof fn !== 'function') return;
    try {
      fn();
    } catch (error) {}
  }

  function update() {
    if (!window.AppState || !window.els) return;

    var summary = buildSummary();

    syncAppState(summary);
    renderSummary(summary);

    runSafe(window.fitHaremName);
    runSafe(window.updateSeriesSummary);
    runSafe(window.updateOrderOutput);
  }

  window.KounoSummaryV13 = {
    update: update,
    summaryScope: getSummaryScope,
    getGenderBucket: getGenderBucket,
    getGenderTotals: getGenderTotals,
    buildSummary: buildSummary
  };

  window.updateStats = update;

  try {
    updateStats = update;
  } catch (error) {}

  update();
})();

/* ============================================================
   Merged from js/refresh-ui.js
   ============================================================ */
(function(){
if(window.__kounoRefreshUiV13)return;window.__kounoRefreshUiV13=true;
function refreshUI(options){
  options=options||{};
  if(options.render!==false&&typeof window.renderBoard==='function')try{window.renderBoard()}catch(e){}
  if(options.summary!==false&&window.KounoSummaryV13&&typeof window.KounoSummaryV13.update==='function')try{window.KounoSummaryV13.update()}catch(e){}
  if(options.hideMissing!==false&&typeof window.ensureHideMissingButton==='function')try{window.ensureHideMissingButton()}catch(e){}
  if(options.save&&typeof window.saveLocal==='function')try{window.saveLocal(false)}catch(e){}
}
window.refreshUI=refreshUI;
if(typeof window.renderBoard==='function'&&!window.renderBoard.__kounoRefreshUiV13Wrapped){
  var originalRender=window.renderBoard;
  window.renderBoard=function(){
    var result=originalRender.apply(this,arguments);
    if(window.KounoSummaryV13&&typeof window.KounoSummaryV13.update==='function')try{window.KounoSummaryV13.update()}catch(e){}
    return result;
  };
  window.renderBoard.__kounoRefreshUiV13Wrapped=true;
}
document.addEventListener('change',function(event){
  var t=event.target;
  if(!t)return;
  if(t.id==='hideMissingToggle'||t.id==='ownerFilter'||t.id==='rouletteFilter'||t.id==='searchInput'||t.id==='floatingSearchInput'||t.id==='syncModeCheckbox'||t.id==='syncModeTypeSelect')setTimeout(function(){refreshUI({render:false,summary:true,hideMissing:true,save:false});},0);
},true);
document.addEventListener('click',function(event){
  var t=event.target&&event.target.closest?event.target.closest('#hideMissingBtn,#hideMissingLabel,[data-mode],[data-divider-toggle],[data-divider-sort],[data-divider-edit],[data-divider-delete],[data-move-id]'):null;
  if(t)setTimeout(function(){refreshUI({render:false,summary:true,hideMissing:true,save:false});},0);
},true);
})();

/* ============================================================
   Merged from js/boot.js
   ============================================================ */
(function(){
if(window.__kounoBootV13)return;window.__kounoBootV13=true;
function run(){
  if(window.KounoSyncV13&&window.KounoSyncV13.ensureAlbumRule)try{window.KounoSyncV13.ensureAlbumRule()}catch(e){}
  if(window.bindSyncType)try{window.bindSyncType()}catch(e){}
  if(window.refreshUI)try{window.refreshUI({render:false,summary:true,hideMissing:true,save:false})}catch(e){}
  else if(window.KounoSummaryV13&&window.KounoSummaryV13.update)try{window.KounoSummaryV13.update()}catch(e){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
window.addEventListener('load',run);
})();

}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',runKounoUiPatchesLate,{once:true});
}else{
  setTimeout(runKounoUiPatchesLate,0);
}
})();

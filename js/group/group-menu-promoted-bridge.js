(function(){
  'use strict';
  let overlayObserver = null;
  let syncQueued = false;
  function addScope(){
    if (!document.body) return;
    document.body.classList.add('mhp-promoted-group-menu');
  }
  function syncGroupDialogClass(){
    addScope();
    const overlay = document.getElementById('appDialogOverlay');
    if (!overlay) return;
    const hasGroup = !!overlay.querySelector('.group-menu-panel');
    overlay.classList.toggle('mhp-group-menu-overlay', hasGroup);
    overlay.classList.remove('group-menu-dialog');
    const card = overlay.querySelector('.app-dialog-card');
    if (card) {
      card.classList.toggle('mhp-group-menu-card', hasGroup);
      card.classList.toggle('group-menu-card', hasGroup);
      card.classList.remove('group-menu-dialog');
    }
  }
  function requestSync(){
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncGroupDialogClass();
    });
  }
  function boot(){
    addScope();
    const overlay = document.getElementById('appDialogOverlay');
    if (overlay && !overlayObserver) {
      overlayObserver = new MutationObserver(requestSync);
      overlayObserver.observe(overlay, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'class']
      });
    }
    requestSync();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', boot, { once:true });
  window.addEventListener('mhp-visual-mode-change', requestSync);
  window.addEventListener('mhp-theme-change', requestSync);
  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!target || !target.id) return;
    if (/Transparency|transparent/i.test(target.id)) requestSync();
  }, true);
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!target || !target.id) return;
    if (/Transparency|transparent|Mode|Preset/i.test(target.id)) requestSync();
  }, true);
})();

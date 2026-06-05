(function(){
  'use strict';
  function syncMoveDialogClass(){
    const overlay = document.getElementById('appDialogOverlay');
    if (!overlay) return;
    const card = overlay.querySelector('.app-dialog-card');
    if (!card) return;
    const isMoveDialog = !!overlay.querySelector('.mhp-move-menu, .move-character-dialog');
    card.classList.toggle('move-character-modal', isMoveDialog);
    overlay.classList.toggle('move-character-overlay', isMoveDialog);
  }
  function init(){
    document.body.classList.add('mhp-promoted-move-character');
    syncMoveDialogClass();
    const observer = new MutationObserver(syncMoveDialogClass);
    observer.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['hidden','class']
    });
    document.addEventListener('mhp:dialog-opened', syncMoveDialogClass);
    document.addEventListener('click', () => requestAnimationFrame(syncMoveDialogClass), true);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();

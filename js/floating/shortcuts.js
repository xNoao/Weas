(function(){
  'use strict';
  if (window.__MudaeRebuildShortcutsV621) return;
  window.__MudaeRebuildShortcutsV621 = true;
  function api(){
    return window.MUDAE_REBUILD_V1 || window.MUDAE_REBUILD_API || null;
  }
  function isTypingField(el){
    if (!el) return false;
    var tag = String(el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }
  function isBusyContext(active){
    var bridge = api();
    if (bridge?.isEditOpen?.() || bridge?.isGalleryOpen?.()) return true;
    if (document.querySelector('.dialog-backdrop.show, .app-dialog-backdrop.show, .modal.show')) return true;
    return isTypingField(active);
  }
  function shouldKeepModalTypingContext(active){
    var bridge = api();
    if (!bridge || !bridge.isEditOpen()) return false;
    var searchInput = document.getElementById('searchInput');
    return isTypingField(active) && active !== searchInput;
  }
  document.addEventListener('keydown', async function(event){
    var key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'f') {
      if (shouldKeepModalTypingContext(document.activeElement)) return;
      event.preventDefault();
      event.stopPropagation();
      var bridge = api();
      if (bridge) bridge.focusSearch();
      else {
        var input = document.getElementById('searchInput');
        if (input) {
          input.focus();
          input.select();
        }
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isBusyContext(document.activeElement)) return;
    var bridge = api();
    if (!bridge) return;
    if (key === 'm') {
      event.preventDefault();
      event.stopPropagation();
      bridge.toggleMultiSelectMode?.();
      return;
    }
    if (key === 'd') {
      event.preventDefault();
      event.stopPropagation();
      await bridge.addBoardDivider?.();
    }
  }, true);
})();

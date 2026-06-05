/* Mudae Organizer Rebuild API bridge.
   This file intentionally stays small.

   The main app exposes window.MUDAE_REBUILD_V1 at boot.
   External modules should use window.MUDAE_REBUILD_API instead of reaching into
   internal implementation details directly.
*/
(function(){
  'use strict';

  if (window.MUDAE_REBUILD_API) return;

  function getApp(){
    return window.MUDAE_REBUILD_V1 || null;
  }

  function getEls(){
    return getApp() && getApp().els ? getApp().els : {};
  }

  window.MUDAE_REBUILD_API = {
    get app(){
      return getApp() && getApp().app;
    },

    get els(){
      return getEls();
    },

    isReady(){
      return !!getApp();
    },

    isEditOpen(){
      var api = getApp();
      return !!(api && typeof api.isEditOpen === 'function' && api.isEditOpen());
    },

    isGalleryOpen(){
      var api = getApp();
      return !!(api && typeof api.isGalleryOpen === 'function' && api.isGalleryOpen());
    },

    focusSearch(){
      var api = getApp();
      if (api && typeof api.focusSearch === 'function') {
        api.focusSearch();
        return true;
      }

      var input = document.getElementById('searchInput');
      if (!input) return false;
      input.focus();
      input.select();
      return true;
    },

    openEdit(id){
      var api = getApp();
      return api && typeof api.openEdit === 'function' ? api.openEdit(id) : undefined;
    },

    closeEdit(){
      var api = getApp();
      return api && typeof api.closeEdit === 'function' ? api.closeEdit() : undefined;
    },

    openGallery(reason){
      var api = getApp();
      return api && typeof api.openGallery === 'function' ? api.openGallery(reason) : undefined;
    },

    closeGallery(clear){
      var api = getApp();
      return api && typeof api.closeGallery === 'function' ? api.closeGallery(clear) : undefined;
    },

    renderAll(){
      var api = getApp();
      return api && typeof api.renderAll === 'function' ? api.renderAll() : undefined;
    }
  };
})();

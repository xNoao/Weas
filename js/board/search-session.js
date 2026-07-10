/* Mudae Organizer Rebuild search/move session helper.
   Stores the temporary origin used when moving characters from filtered search.
   This is intentionally session-only and never persists across reloads.
*/
(function(){
  'use strict';

  if (window.MudaeSearchMoveSession) return;

  function create(context){
    const app = context.app;

    function remember(){
      if (app.searchMoveOriginAnchor?.id || Number.isFinite(app.searchMoveOriginScrollY)) {
        return app.searchMoveOriginAnchor || app.searchMoveOriginScrollY;
      }

      app.searchMoveOriginScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      app.searchMoveOriginAnchor = context.captureBoardVisualAnchor?.() || null;
      app.searchMoveOriginStartedAt = Date.now();
      return app.searchMoveOriginAnchor || app.searchMoveOriginScrollY;
    }

    function clear(){
      app.searchMoveOriginScrollY = null;
      app.searchMoveOriginAnchor = null;
      app.searchMoveOriginStartedAt = 0;
    }

    function has(){
      return !!app.searchMoveOriginAnchor?.id || Number.isFinite(app.searchMoveOriginScrollY);
    }

    function restoreAfterRender(){
      const anchor = app.searchMoveOriginAnchor ? { ...app.searchMoveOriginAnchor } : null;
      const targetY = Number(app.searchMoveOriginScrollY);
      clear();

      if (anchor?.id) {
        context.updateEntries?.();
        context.renderAroundId?.(anchor.id, { scroll: false, highlight: false });
        context.restoreBoardVisualAnchor?.(anchor, { attempts: 14, highlight: false });
        return true;
      }

      if (!Number.isFinite(targetY)) return false;

      const apply = () => {
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
      };

      apply();
      requestAnimationFrame(() => {
        apply();
        requestAnimationFrame(apply);
      });

      return true;
    }

    return { remember, clear, has, restoreAfterRender };
  }

  window.MudaeSearchMoveSession = { create };
})();

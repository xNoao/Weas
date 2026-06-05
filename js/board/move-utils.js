(function(){
  'use strict';
  if (window.MudaeMoveUtils) return;
  function create(context){
    const app = context.app;
    const isDivider = context.isDivider || (item => item && item.type === 'divider');
    const num = context.num || (value => Number(value) || 0);
    function getRawItemIndexById(id){
      return (app.state.characters || []).findIndex(item => item?.id === id);
    }
    function clampDisplayPosition(position){
      const total = Math.max(0, context.getCharacterCount?.() || 0);
      if (!total) return 0;
      return Math.max(1, Math.min(total, num(position) || 1));
    }
    function commitStateOnlyMove(){
      context.invalidateSearchCache?.();
      context.assignBoardCounters?.();
      context.saveLocal?.();
      window.MudaeBoardController?.flushSave?.();
    }
    function moveCharacterByIdsInRealState(sourceId, targetId, placement = 'before'){
      if (!sourceId || !targetId || sourceId === targetId) return false;
      const sourceIndex = getRawItemIndexById(sourceId);
      const targetIndex = getRawItemIndexById(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return false;
      const [item] = app.state.characters.splice(sourceIndex, 1);
      let insertIndex = getRawItemIndexById(targetId);
      if (insertIndex < 0) {
        app.state.characters.splice(sourceIndex, 0, item);
        return false;
      }
      if (placement === 'after') insertIndex += 1;
      insertIndex = Math.max(0, Math.min(app.state.characters.length, insertIndex));
      app.state.characters.splice(insertIndex, 0, item);
      commitStateOnlyMove();
      return true;
    }
    function getRawIndexForDisplayPositionAfterRemoval(target){
      let displayPosition = 0;
      let targetRawIndex = app.state.characters.length;
      for (let i = 0; i < app.state.characters.length; i++) {
        const entry = app.state.characters[i];
        if (isDivider(entry)) continue;
        displayPosition++;
        if (displayPosition === target) {
          targetRawIndex = i;
          break;
        }
      }
      return Math.max(0, Math.min(app.state.characters.length, targetRawIndex));
    }
    function moveCharacterToRealDisplayPositionById(sourceId, targetPosition){
      const sourceIndex = getRawItemIndexById(sourceId);
      if (sourceIndex < 0) return false;
      const sourcePosition = context.getCharacterListPosition?.(sourceId) || 0;
      const target = clampDisplayPosition(targetPosition);
      if (!sourcePosition || !target || target === sourcePosition) return false;
      const [item] = app.state.characters.splice(sourceIndex, 1);
      const targetRawIndex = getRawIndexForDisplayPositionAfterRemoval(target);
      app.state.characters.splice(targetRawIndex, 0, item);
      commitStateOnlyMove();
      return true;
    }
    return {
      getRawItemIndexById,
      moveCharacterByIdsInRealState,
      moveCharacterToRealDisplayPositionById
    };
  }
  window.MudaeMoveUtils = { create };
})();

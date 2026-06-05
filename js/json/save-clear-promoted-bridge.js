(function(){
  'use strict';
  const BODY_CLASS = 'mhp-promoted-save-clear';
  const DIALOG_CLASSES = ['mhp-json-small-dialog', 'mhp-save-json-dialog', 'mhp-clear-local-dialog'];
  function text(node){
    return String(node?.textContent || '').trim();
  }
  function overlay(){
    return document.getElementById('appDialogOverlay');
  }
  function clearDialogClasses(node){
    if (!node) return;
    node.classList.remove(...DIALOG_CLASSES);
    const card = node.querySelector('.app-dialog-card');
    card?.classList?.remove?.('mhp-json-small-card', 'mhp-save-json-card', 'mhp-clear-local-card');
  }
  function classify(node){
    if (!node || node.hidden) {
      clearDialogClasses(node);
      return;
    }
    const title = text(node.querySelector('#appDialogTitle')).toLowerCase();
    const message = text(node.querySelector('#appDialogMessage')).toLowerCase();
    const actionText = text(node.querySelector('#appDialogActions')).toLowerCase();
    let kind = '';
    if (title.includes('save json') || actionText.includes('save json')) {
      kind = 'save';
    } else if (
      title.includes('clear local') ||
      title.includes('clear local data') ||
      message.includes('clear local rebuild data') ||
      actionText.includes('clear data')
    ) {
      kind = 'clear';
    }
    clearDialogClasses(node);
    if (!kind) return;
    document.body.classList.add(BODY_CLASS);
    node.classList.add('mhp-json-small-dialog', kind === 'save' ? 'mhp-save-json-dialog' : 'mhp-clear-local-dialog');
    const titleNode = node.querySelector('#appDialogTitle');
    const messageNode = node.querySelector('#appDialogMessage');
    const inputLabel = node.querySelector('#appDialogInputLabel');
    if (kind === 'save') {
      if (titleNode) titleNode.textContent = 'Save JSON';
      if (messageNode) messageNode.textContent = 'Create a backup file of the current rebuild data.';
      if (inputLabel) inputLabel.textContent = '';
    } else if (kind === 'clear') {
      if (titleNode) titleNode.textContent = 'Clear local data?';
      if (messageNode) messageNode.textContent = 'This removes the local rebuild data from this browser.';
      const dangerBtn = node.querySelector('#appDialogActions .btn-danger, #appDialogActions .btn-primary, #appDialogActions .app-dialog-btn:last-child');
      if (dangerBtn) dangerBtn.textContent = 'Clear local';
    }
    const card = node.querySelector('.app-dialog-card');
    if (card) {
      card.classList.add('mhp-json-small-card', kind === 'save' ? 'mhp-save-json-card' : 'mhp-clear-local-card');
    }
  }
  function syncSoon(){
    requestAnimationFrame(() => classify(overlay()));
  }
  function init(){
    document.body.classList.add(BODY_CLASS);
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#exportJsonBtn, .save-json-btn, #clearLocalBtn')) {
        syncSoon();
        setTimeout(syncSoon, 0);
        setTimeout(syncSoon, 80);
      }
    }, true);
    const waitForOverlay = () => {
      const node = overlay();
      if (!node) {
        setTimeout(waitForOverlay, 120);
        return;
      }
      const observer = new MutationObserver(syncSoon);
      observer.observe(node, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true,
        attributeFilter:['hidden']
      });
      classify(node);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', waitForOverlay, { once:true });
    } else {
      waitForOverlay();
    }
  }
  init();
})();

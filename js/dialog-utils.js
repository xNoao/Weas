/* Mudae Organizer Rebuild dialog utilities.
   Owns standardized alert/confirm/prompt modals used by app modules.
*/
(function(){
  'use strict';

  if (window.MudaeDialogUtils) return;

  const IDS = {
    overlay: 'appDialogOverlay',
    title: 'appDialogTitle',
    message: 'appDialogMessage',
    close: 'appDialogCloseBtn',
    inputWrap: 'appDialogInputWrap',
    inputLabel: 'appDialogInputLabel',
    input: 'appDialogInput',
    actions: 'appDialogActions',
    customContent: 'appDialogCustomContent'
  };

  function get(id){
    return document.getElementById(id);
  }

  function defaultCloseValue(type){
    if (type === 'alert') return true;
    if (type === 'confirm') return false;
    return null;
  }

  function ensureElements(){
    let overlay = get(IDS.overlay);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = IDS.overlay;
    overlay.className = 'app-dialog-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="app-dialog-card" role="dialog" aria-modal="true" aria-labelledby="${IDS.title}" aria-describedby="${IDS.message}">
        <div class="app-dialog-head">
          <div>
            <strong id="${IDS.title}" class="app-dialog-title">Message</strong>
            <p id="${IDS.message}" class="app-dialog-message"></p>
          </div>
          <button id="${IDS.close}" class="app-dialog-close" type="button" aria-label="Close">×</button>
        </div>
        <label id="${IDS.inputWrap}" class="app-dialog-input-wrap" hidden>
          <span id="${IDS.inputLabel}">Text</span>
          <input id="${IDS.input}" class="app-dialog-input" autocomplete="off" spellcheck="false">
        </label>
        <div id="${IDS.actions}" class="app-dialog-actions"></div>
      </section>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function getParts(overlay){
    return {
      title: overlay.querySelector('#' + IDS.title),
      message: overlay.querySelector('#' + IDS.message),
      close: overlay.querySelector('#' + IDS.close),
      inputWrap: overlay.querySelector('#' + IDS.inputWrap),
      inputLabel: overlay.querySelector('#' + IDS.inputLabel),
      input: overlay.querySelector('#' + IDS.input),
      actions: overlay.querySelector('#' + IDS.actions)
    };
  }

  function close(result){
    const overlay = get(IDS.overlay);
    if (!overlay) return;

    const resolver = overlay.__resolver;
    overlay.__resolver = null;
    overlay.hidden = true;
    overlay.classList.remove('is-danger', 'is-prompt', 'is-confirm', 'is-alert');
    document.body.classList.remove('app-dialog-open');

    if (typeof resolver === 'function') resolver(result);
  }

  function ensureCustomContent(overlay, inputWrap){
    let customContent = overlay.querySelector('#' + IDS.customContent);
    if (!customContent) {
      customContent = document.createElement('div');
      customContent.id = IDS.customContent;
      customContent.className = 'app-dialog-custom-content';
      inputWrap.after(customContent);
    }
    return customContent;
  }

  function makeButton({ actions, label, className, value, type, input }){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      close(type === 'prompt' && value === 'ok' ? input.value : value);
    });
    actions.appendChild(btn);
    return btn;
  }

  function showDialog(options = {}){
    const overlay = ensureElements();
    const parts = getParts(overlay);
    const type = options.type || 'alert';
    const variant = options.variant || '';
    const defaultValue = options.defaultValue ?? '';
    const closeValue = defaultCloseValue(type);

    parts.title.textContent = options.title || (type === 'confirm' ? 'Confirm action' : type === 'prompt' ? 'Enter value' : 'Message');
    parts.message.textContent = options.message || '';

    overlay.classList.toggle('is-danger', variant === 'danger');
    overlay.classList.toggle('is-prompt', type === 'prompt');
    overlay.classList.toggle('is-confirm', type === 'confirm');
    overlay.classList.toggle('is-alert', type === 'alert');

    const hasCustomContent = typeof options.renderContent === 'function';
    parts.inputWrap.hidden = hasCustomContent || type !== 'prompt';
    parts.inputLabel.textContent = options.inputLabel || 'Text';
    parts.input.value = String(defaultValue);

    const customContent = ensureCustomContent(overlay, parts.inputWrap);
    customContent.replaceChildren();
    customContent.hidden = true;

    if (hasCustomContent) {
      customContent.hidden = false;
      options.renderContent(customContent, overlay);
    }

    parts.actions.replaceChildren();

    if (type === 'confirm') {
      makeButton({ actions: parts.actions, label: options.cancelText || 'Cancel', className: 'btn btn-ghost app-dialog-btn', value: false, type, input: parts.input });
      makeButton({ actions: parts.actions, label: options.okText || 'Confirm', className: variant === 'danger' ? 'btn btn-danger app-dialog-btn' : 'btn btn-primary app-dialog-btn', value: true, type, input: parts.input });
    } else if (type === 'prompt') {
      makeButton({ actions: parts.actions, label: options.cancelText || 'Cancel', className: 'btn btn-ghost app-dialog-btn', value: null, type, input: parts.input });
      makeButton({ actions: parts.actions, label: options.okText || 'OK', className: 'btn btn-primary app-dialog-btn', value: 'ok', type, input: parts.input });
    } else {
      makeButton({ actions: parts.actions, label: options.okText || 'OK', className: 'btn btn-primary app-dialog-btn', value: true, type, input: parts.input });
    }

    parts.close.onclick = () => close(closeValue);
    overlay.onmousedown = event => {
      if (event.target === overlay) close(closeValue);
    };
    overlay.onkeydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(closeValue);
      }
      if (event.key === 'Enter' && type === 'prompt') {
        event.preventDefault();
        close(parts.input.value);
      }
    };

    overlay.hidden = false;
    document.body.classList.add('app-dialog-open');

    return new Promise(resolve => {
      overlay.__resolver = resolve;
      requestAnimationFrame(() => {
        if (type === 'prompt') {
          parts.input.focus({ preventScroll: true });
          parts.input.select();
        } else {
          parts.actions.querySelector('button:last-child')?.focus?.({ preventScroll: true });
        }
      });
    });
  }

  function alert(message, options = {}){
    return showDialog({
      type: 'alert',
      title: options.title || 'Notice',
      message,
      okText: options.okText || 'OK',
      variant: options.variant || ''
    });
  }

  function confirm(message, options = {}){
    return showDialog({
      type: 'confirm',
      title: options.title || 'Confirm action',
      message,
      okText: options.okText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      variant: options.variant || ''
    });
  }

  function prompt(message, defaultValue = '', options = {}){
    return showDialog({
      type: 'prompt',
      title: options.title || 'Enter value',
      message,
      inputLabel: options.inputLabel || 'Value',
      defaultValue,
      okText: options.okText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      variant: options.variant || ''
    });
  }

  window.MudaeDialogUtils = {
    showDialog,
    alert,
    confirm,
    prompt,
    close
  };
})();

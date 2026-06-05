/* Mudae Organizer Rebuild - dividers module v2.89
   Keeps divider creation/edit/delete/render logic out of app.js.
*/
(function(){
  'use strict';

  let ctx = null;

  function requireCtx(){
    if (!ctx) {
      throw new Error('MudaeDividers is not initialized.');
    }

    return ctx;
  }

  function getState(){
    return requireCtx().app.state;
  }

  function byId(id){
    return getState().characters.find(item => ctx.isDivider(item) && item.id === id) || null;
  }

  function bindDividerAction(button, handler) {
    if (!button || typeof handler !== 'function') return;

    let handledAt = 0;

    const run = event => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      handledAt = Date.now();
      button.dataset.mhpHandledAt = String(handledAt);

      try {
        const result = handler(event);
        if (result && typeof result.catch === 'function') {
          result.catch(error => console.error('[MHP] Divider action failed:', error));
        }
      } catch (error) {
        console.error('[MHP] Divider action failed:', error);
      }
    };

    button.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      run(event);
    });

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      if (Date.now() - handledAt < 650) return;

      run(event);
    });
  }

  function getDividerIdFromActionTarget(target) {
    const button = target?.closest?.('.divider-action-btn, .compact-sticky-divider-action');
    if (!button) return '';

    const directId = button.dataset?.dividerId || '';
    if (directId) return directId;

    const row = button.closest?.('.divider-row');
    if (row?.dataset?.id) return row.dataset.id;

    const sticky = button.closest?.('.compact-sticky-divider-bar');
    const sourceId = sticky?.dataset?.sourceId || '';
    if (sourceId) return String(sourceId).split('|')[0] || '';

    return '';
  }

  function getDividerActionFromTarget(target) {
    const button = target?.closest?.('.divider-action-btn, .compact-sticky-divider-action');
    if (!button) return '';

    const explicit = button.dataset?.dividerAction || '';
    if (explicit) return explicit;

    const text = String(button.textContent || button.title || button.getAttribute?.('aria-label') || '').trim().toLowerCase();
    if (text.includes('edit')) return 'edit';
    if (text.includes('delete')) return 'delete';
    if (text.includes('sort')) return 'sort';
    if (text.includes('$smp') || text.includes('smp')) return 'smp';
    return '';
  }

  function bindDelegatedDividerActions() {
    if (window.__mhpDelegatedDividerActionsBound) return;
    window.__mhpDelegatedDividerActionsBound = true;

    const handle = event => {
      const button = event.target?.closest?.('.divider-action-btn, .compact-sticky-divider-action');
      if (!button) return;
      if (event.type === 'pointerdown' && event.button !== undefined && event.button !== 0) return;

      const lastHandled = Number(button.dataset?.mhpHandledAt || 0);
      if (lastHandled && Date.now() - lastHandled < 650) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const action = getDividerActionFromTarget(button);
      const dividerId = getDividerIdFromActionTarget(button);
      if (!action || !dividerId) return;

      event.preventDefault();
      event.stopPropagation();
      button.dataset.mhpHandledAt = String(Date.now());

      if (action === 'edit') {
        editDivider(dividerId);
      } else if (action === 'delete') {
        confirmDeleteDivider(dividerId);
      } else if (action === 'sort') {
        showDividerSortDialog(dividerId);
      } else if (action === 'smp') {
        window.MudaeExports?.exportDividerSmp?.(dividerId);
      }
    };

    document.addEventListener('pointerdown', handle, true);
    document.addEventListener('click', handle, true);
  }

  function collectDividerCharacters(dividerId) {
    const c = requireCtx();
    const list = c.app.state.characters || [];
    const startIndex = list.findIndex(item => c.isDivider(item) && item.id === dividerId);

    if (startIndex < 0) return [];

    const endIndex = getDividerSectionEndIndex(startIndex);
    const result = [];

    for (let i = startIndex + 1; i < endIndex; i++) {
      const item = list[i];
      if (!item || c.isDivider(item)) continue;
      result.push(item);
    }

    return result;
  }

  function applyDividerBulkNote(characters, mode, text) {
    const c = requireCtx();
    const action = String(mode || 'none');

    if (!Array.isArray(characters) || !characters.length || action === 'none') return 0;

    const value = c.str(text || '').trim();
    let changed = 0;

    characters.forEach(character => {
      const previous = c.str(character.note || '').trim();
      let next = previous;

      if (action === 'replace') {
        next = value;
      } else if (action === 'append') {
        next = previous ? (value ? `${previous} ${value}` : previous) : value;
      } else if (action === 'prepend') {
        next = previous ? (value ? `${value} ${previous}` : previous) : value;
      } else if (action === 'clear') {
        next = '';
      }

      if (next !== previous) {
        character.note = next;
        changed++;
      }
    });

    return changed;
  }

  function getCharacterRawIndexByDisplayNumber(position) {
    const c = requireCtx();
    c.assignBoardCounters();

    const wanted = Math.max(1, c.num(position) || 0);
    if (!wanted) return -1;

    let current = 0;

    for (let i = 0; i < c.app.state.characters.length; i++) {
      const item = c.app.state.characters[i];
      if (c.isDivider(item)) continue;

      current++;

      if (current === wanted) return i;
    }

    return -1;
  }

  function getDividerInsertIndexFromChoice(choice, exactPosition) {
    const c = requireCtx();

    if (choice === 'start') return 0;
    if (choice === 'end') return c.app.state.characters.length;

    if (choice === 'exact') {
      const index = getCharacterRawIndexByDisplayNumber(exactPosition);
      return index >= 0 ? index : -1;
    }

    return c.getFirstVisibleCharacterRawIndex();
  }


  function captureDividerVisualAnchor(dividerId) {
    const c = requireCtx();
    const node = c.els.board?.querySelector?.(`[data-id="${c.getCssSafeId(dividerId)}"]`);
    const fallbackTop = Math.max(78, Math.min((window.innerHeight || 800) * 0.28, 180));

    return {
      id: dividerId,
      top: node ? node.getBoundingClientRect().top : fallbackTop
    };
  }


  function captureCharacterAnchorByDisplayPosition(position) {
    const c = requireCtx();
    const rawIndex = getCharacterRawIndexByDisplayNumber(position);

    if (rawIndex < 0) return c.captureBoardVisualAnchor();

    const item = c.app.state.characters[rawIndex];

    if (!item || c.isDivider(item)) return c.captureBoardVisualAnchor();

    const node = c.els.board?.querySelector?.(`[data-id="${c.getCssSafeId(item.id)}"]`);
    const top = node ? node.getBoundingClientRect().top : Math.max(90, (window.innerHeight || 800) * 0.35);

    return {
      id: item.id,
      top
    };
  }

  function getDividerCreationAnchor(config) {
    const c = requireCtx();

    if (config?.position === 'exact') {
      return captureCharacterAnchorByDisplayPosition(config.exact);
    }

    return c.captureBoardVisualAnchor();
  }

  async function showDividerBuilderDialog(defaultLevel = 1) {
    const c = requireCtx();
    const total = c.getCharacterCount();
    const firstVisiblePosition = c.getFirstVisibleCharacterDisplayPosition();
    const values = {
      type: Math.max(1, c.num(defaultLevel) || 1) > 1 ? 'sub' : 'divider',
      title: Math.max(1, c.num(defaultLevel) || 1) > 1 ? 'Sub-divider' : 'Divider',
      note: '',
      position: 'exact',
      exact: String(firstVisiblePosition || 1)
    };

    const ok = await c.showAppDialog({
      type: 'confirm',
      title: 'Add divider',
      message: `Choose the divider type and where it should be inserted. Current character count: ${c.fmt(total)}.`,
      okText: 'Add',
      cancelText: 'Cancel',
      renderContent(content) {
        content.innerHTML = `
          <div class="divider-builder-grid">
            <label class="app-dialog-field">
              <span>Type</span>
              <select id="dividerBuilderType" class="app-dialog-input">
                <option value="divider">Divider normal</option>
                <option value="sub">Sub-divider</option>
              </select>
            </label>

            <label class="app-dialog-field">
              <span>Title / Name</span>
              <input id="dividerBuilderTitle" class="app-dialog-input" autocomplete="off" spellcheck="false">
            </label>

            <label class="app-dialog-field">
              <span>Note</span>
              <input id="dividerBuilderNote" class="app-dialog-input" autocomplete="off" spellcheck="false" placeholder="Optional">
            </label>

            <label class="app-dialog-field">
              <span>Insert position</span>
              <select id="dividerBuilderPosition" class="app-dialog-input">
                <option value="exact">Before character #...</option>
                <option value="visible">Before first visible character</option>
                <option value="start">Start of board</option>
                <option value="end">End of board</option>
              </select>
            </label>

            <label id="dividerBuilderExactWrap" class="app-dialog-field">
              <span>Character position # (1-${c.fmt(total)})</span>
              <input id="dividerBuilderExact" class="app-dialog-input" inputmode="numeric" placeholder="1-${c.fmt(total)}">
            </label>
          </div>
        `;

        const type = content.querySelector('#dividerBuilderType');
        const title = content.querySelector('#dividerBuilderTitle');
        const note = content.querySelector('#dividerBuilderNote');
        const position = content.querySelector('#dividerBuilderPosition');
        const exactWrap = content.querySelector('#dividerBuilderExactWrap');
        const exact = content.querySelector('#dividerBuilderExact');

        type.value = values.type;
        title.value = values.title;
        note.value = values.note;
        position.value = values.position;
        exact.value = values.exact;

        const syncExact = () => {
          exactWrap.hidden = position.value !== 'exact';
        };

        const syncTitle = () => {
          const trimmed = title.value.trim();
          const wasDefault = !trimmed || trimmed === 'Divider' || trimmed === 'Sub-divider';

          if (wasDefault) {
            title.value = type.value === 'sub' ? 'Sub-divider' : 'Divider';
          }
        };

        type.addEventListener('change', syncTitle);
        position.addEventListener('change', syncExact);
        syncExact();

        requestAnimationFrame(() => {
          title.focus({ preventScroll: true });
          title.select();
        });
      }
    });

    if (!ok) return null;

    const overlay = document.getElementById('appDialogOverlay');
    const type = overlay?.querySelector('#dividerBuilderType')?.value || values.type;
    const title = overlay?.querySelector('#dividerBuilderTitle')?.value || values.title;
    const note = overlay?.querySelector('#dividerBuilderNote')?.value || '';
    const position = overlay?.querySelector('#dividerBuilderPosition')?.value || values.position;
    const exact = overlay?.querySelector('#dividerBuilderExact')?.value || '';

    return {
      level: type === 'sub' ? 2 : 1,
      title: c.str(title).trim() || (type === 'sub' ? 'Sub-divider' : 'Divider'),
      note: c.str(note).trim(),
      position,
      exact
    };
  }

  async function insertBoardDivider(level = 1) {
    const c = requireCtx();
    const config = await showDividerBuilderDialog(level);

    if (!config) return false;

    const insertIndex = getDividerInsertIndexFromChoice(config.position, config.exact);

    if (insertIndex < 0) {
      const total = c.getCharacterCount();
      await c.showAppAlert(`Invalid character position. Use 1-${c.fmt(total)}.`, {
        title: 'Invalid position',
        variant: 'danger'
      });
      return false;
    }

    const anchor = getDividerCreationAnchor(config);

    const divider = c.normalizeItem({
      type: 'divider',
      id: c.uid(),
      title: config.title,
      level: config.level,
      color: config.level > 1 ? '#38bdf8' : '#8b5cf6',
      note: config.note
    }, c.app.state.characters.length);

    c.app.state.characters.splice(insertIndex, 0, divider);

    c.invalidateSearchCache();
    c.assignBoardCounters();
    c.renderAll();
    c.saveLocal();

    requestAnimationFrame(() => {
      window.MudaeBoardController?.updateEntriesFromApp?.();
      c.restoreBoardVisualAnchor(anchor, { attempts: 12 });
    });

    c.notifyAppMessage(`${config.level > 1 ? 'Sub-divider' : 'Divider'} added.`);
    return true;
  }

  function addBoardDivider() {
    return insertBoardDivider(1);
  }

  function addBoardSubDivider() {
    return insertBoardDivider(2);
  }

  async function showDividerEditDialog(divider) {
    const c = requireCtx();
    const currentLevel = Math.max(1, c.num(divider.level) || 1);
    const sectionCharacters = collectDividerCharacters(divider.id);
    const values = {
      type: currentLevel > 1 ? 'sub' : 'divider',
      title: divider.title || (currentLevel > 1 ? 'Sub-divider' : 'Divider'),
      note: divider.note || '',
      color: divider.color || (currentLevel > 1 ? '#38bdf8' : '#8b5cf6'),
      bulkNoteText: ''
    };

    const ok = await c.showAppDialog({
      type: 'confirm',
      title: 'Edit divider',
      message: `${c.fmt(sectionCharacters.length)} characters are inside this ${currentLevel > 1 ? 'sub-divider' : 'divider'}.`,
      okText: 'Save divider',
      cancelText: 'Cancel',
      renderContent(content) {
        const dialogCard = content.closest?.('.app-dialog-card, .app-dialog, [role="dialog"]');
        dialogCard?.classList?.add('divider-edit-dialog-card');

        content.innerHTML = `
          <div class="divider-edit-menu">
            <section class="divider-edit-section divider-edit-section-main" aria-label="Divider details">
              <div class="divider-edit-section-head">
                <strong>Divider details</strong>
                <span>Rename, recolor or change the divider level.</span>
              </div>

              <div class="divider-builder-grid divider-edit-grid divider-edit-details-grid">
                <label class="app-dialog-field divider-edit-type-field">
                  <span>Type</span>
                  <select id="dividerEditType" class="app-dialog-input">
                    <option value="divider">Divider</option>
                    <option value="sub">Sub-divider</option>
                  </select>
                </label>

                <label class="app-dialog-field divider-edit-color-field">
                  <span>Color</span>
                  <input id="dividerEditColor" class="app-dialog-input app-dialog-color-input" type="color">
                </label>

                <label class="app-dialog-field divider-edit-title-field">
                  <span>Title / Name</span>
                  <input id="dividerEditTitle" class="app-dialog-input" autocomplete="off" spellcheck="false">
                </label>

                <label class="app-dialog-field divider-edit-note-field">
                  <span>Divider note</span>
                  <input id="dividerEditNote" class="app-dialog-input" autocomplete="off" spellcheck="false" placeholder="Optional note shown under the divider">
                </label>
              </div>
            </section>

            <section class="divider-edit-section divider-edit-section-notes" aria-label="Character notes">
              <div class="divider-edit-section-head">
                <strong>Character notes</strong>
                <span>Optional: replace the note of every character contained here.</span>
              </div>

              <div class="divider-edit-note-summary">
                <span class="divider-edit-count-pill">${c.fmt(sectionCharacters.length)} characters affected</span>
                <span>Includes nested sub-dividers until the next divider at the same or higher level.</span>
              </div>

              <label class="app-dialog-field divider-note-bulk-text-wrap">
                <span>New note for contained characters</span>
                <textarea id="dividerEditBulkNoteText" class="app-dialog-input" rows="3" spellcheck="false" placeholder="Leave empty to keep character notes unchanged"></textarea>
              </label>

              <p class="divider-note-bulk-hint">Optional. Writing here replaces the note of every contained character; leaving it empty only edits the divider itself.</p>
            </section>
          </div>
        `;

        const type = content.querySelector('#dividerEditType');
        const title = content.querySelector('#dividerEditTitle');
        const note = content.querySelector('#dividerEditNote');
        const color = content.querySelector('#dividerEditColor');
        const bulkNoteText = content.querySelector('#dividerEditBulkNoteText');

        type.value = values.type;
        title.value = values.title;
        note.value = values.note;
        color.value = /^#[0-9a-f]{6}$/i.test(values.color) ? values.color : (values.type === 'sub' ? '#38bdf8' : '#8b5cf6');
        bulkNoteText.value = values.bulkNoteText;

        type.addEventListener('change', () => {
          const trimmed = title.value.trim();
          const wasDefault = !trimmed || trimmed === 'Divider' || trimmed === 'Sub-divider';

          if (wasDefault) {
            title.value = type.value === 'sub' ? 'Sub-divider' : 'Divider';
          }

          if (!color.dataset.userChanged) {
            color.value = type.value === 'sub' ? '#38bdf8' : '#8b5cf6';
          }
        });

        color.addEventListener('input', () => {
          color.dataset.userChanged = 'true';
        });

        requestAnimationFrame(() => {
          title.focus({ preventScroll: true });
          title.select();
        });
      }
    });

    if (!ok) return null;

    const overlay = document.getElementById('appDialogOverlay');
    const type = overlay?.querySelector('#dividerEditType')?.value || values.type;
    const title = overlay?.querySelector('#dividerEditTitle')?.value || values.title;
    const note = overlay?.querySelector('#dividerEditNote')?.value || '';
    const color = overlay?.querySelector('#dividerEditColor')?.value || values.color;
    const bulkNoteText = overlay?.querySelector('#dividerEditBulkNoteText')?.value || '';
    const shouldReplaceCharacterNotes = c.str(bulkNoteText).trim().length > 0;

    return {
      level: type === 'sub' ? 2 : 1,
      title: c.str(title).trim() || (type === 'sub' ? 'Sub-divider' : 'Divider'),
      note: c.str(note).trim(),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : (type === 'sub' ? '#38bdf8' : '#8b5cf6'),
      bulkNoteMode: shouldReplaceCharacterNotes ? 'replace' : 'none',
      bulkNoteText
    };
  }

  async function editDivider(dividerId) {
    const c = requireCtx();
    const divider = byId(dividerId);

    if (!divider) return false;

    const anchor = c.captureBoardVisualAnchor();
    const config = await showDividerEditDialog(divider);

    if (!config) return false;

    divider.level = config.level;
    divider.title = config.title;
    divider.note = config.note;
    divider.color = config.color;

    const noteChangedCount = applyDividerBulkNote(collectDividerCharacters(divider.id), config.bulkNoteMode, config.bulkNoteText);

    c.invalidateSearchCache();
    c.assignBoardCounters();
    c.renderAll();
    c.saveLocal();

    requestAnimationFrame(() => {
      window.MudaeBoardController?.updateEntriesFromApp?.();
      c.restoreBoardVisualAnchor(anchor, { attempts: 10 });
    });

    c.notifyAppMessage(`${config.level > 1 ? 'Sub-divider' : 'Divider'} updated${noteChangedCount ? ` · ${c.fmt(noteChangedCount)} notes changed` : ''}.`);
    return true;
  }


  function getDividerLevel(item) {
    return Math.max(1, Number(item?.level) || 1);
  }

  function getDividerSectionEndIndex(startIndex) {
    const c = requireCtx();
    const list = c.app.state.characters || [];
    const start = list[startIndex];

    if (!c.isDivider(start)) return startIndex + 1;

    const level = getDividerLevel(start);

    for (let i = startIndex + 1; i < list.length; i++) {
      const item = list[i];
      if (c.isDivider(item) && getDividerLevel(item) <= level) {
        return i;
      }
    }

    return list.length;
  }

  function getDividerHiddenSummary(dividerId) {
    const c = requireCtx();
    const list = c.app.state.characters || [];
    const startIndex = list.findIndex(item => c.isDivider(item) && item.id === dividerId);

    if (startIndex < 0) {
      return { characters: 0, dividers: 0, total: 0 };
    }

    const endIndex = getDividerSectionEndIndex(startIndex);
    let characters = 0;
    let dividers = 0;

    for (let i = startIndex + 1; i < endIndex; i++) {
      if (c.isDivider(list[i])) {
        dividers++;
      } else {
        characters++;
      }
    }

    return {
      characters,
      dividers,
      total: characters + dividers
    };
  }

  function toggleDividerCollapsed(dividerId) {
    const c = requireCtx();
    const divider = byId(dividerId);

    if (!divider) return false;

    const board = c.els?.board;
    const dividerSelector = `.divider-row[data-id="${CSS.escape(String(dividerId))}"]`;
    const dividerNodeBefore = board?.querySelector?.(dividerSelector);
    const dividerTopBefore = dividerNodeBefore?.getBoundingClientRect?.().top;
    const scrollBefore = window.scrollY || document.documentElement.scrollTop || 0;

    if (board) {
      board.classList.add('is-divider-collapse-rendering');
    }

    divider.collapsed = !divider.collapsed;

    c.invalidateSearchCache();
    c.assignBoardCounters();

    // v2.318:
    // Keep the first visual update fast. Do not lock a large min-height or call
    // BoardController.updateEntriesFromApp() before the collapse is visible.
    c.renderAll({ preserveView: false });
    c.saveLocal();

    const compensateDividerScroll = () => {
      const nextNode = c.els?.board?.querySelector?.(dividerSelector);
      const nextTop = nextNode?.getBoundingClientRect?.().top;

      if (Number.isFinite(dividerTopBefore) && Number.isFinite(nextTop)) {
        const delta = nextTop - dividerTopBefore;
        if (Math.abs(delta) > 1) {
          window.scrollTo({
            top: Math.max(0, (window.scrollY || document.documentElement.scrollTop || 0) + delta),
            behavior: 'auto'
          });
        }
      } else {
        window.scrollTo({ top: scrollBefore, behavior: 'auto' });
      }
    };

    compensateDividerScroll();
    window.__mhpUpdateCompactStickyDivider?.();

    requestAnimationFrame(() => {
      // Defer heavier sync work until after the UI has already changed.
      window.MudaeBoardController?.updateEntriesFromApp?.();
      compensateDividerScroll();
      window.__mhpUpdateCompactStickyDivider?.();

      requestAnimationFrame(() => {
        compensateDividerScroll();
        window.__mhpUpdateCompactStickyDivider?.();
        board?.classList.remove('is-divider-collapse-rendering');
      });
    });

    c.notifyAppMessage(`${divider.title || 'Divider'} ${divider.collapsed ? 'minimized' : 'restored'}.`);
    return true;
  }

  function getSortRank(item) {
    const rank = Number(item?.globalRank || item?.claimRank || item?.rank || 0);
    return Number.isFinite(rank) && rank > 0 ? rank : Number.POSITIVE_INFINITY;
  }

  function getSortSeries(item) {
    return String(item?.series || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function getSortName(item) {
    return String(item?.name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function getSortKakera(item) {
    const value = Number(item?.kakera || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function getSortRoulette(item) {
    return String(item?.roulette || item?.type || item?.gender || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  const DIVIDER_SORT_OPTIONS = {
    seriesTopRank: {
      label: 'Series Top Rank',
      description: 'Group by series. Series are ordered by their best rank, then characters by rank.'
    },
    rankAsc: {
      label: 'Rank ↑',
      description: 'Best Mudae rank first.'
    },
    rankDesc: {
      label: 'Rank ↓',
      description: 'Worst / unknown rank last-to-first.'
    },
    kakeraDesc: {
      label: 'Kakera ↓',
      description: 'Highest kakera value first.'
    },
    kakeraAsc: {
      label: 'Kakera ↑',
      description: 'Lowest kakera value first.'
    },
    nameAsc: {
      label: 'Name A-Z',
      description: 'Alphabetical by character name.'
    },
    seriesName: {
      label: 'Series A-Z',
      description: 'Alphabetical by series, then rank and name.'
    },
    rouletteType: {
      label: 'Roulette / Type',
      description: 'Group by roulette/type, then rank and name.'
    }
  };

  const DEFAULT_DIVIDER_SORT_MODE = 'seriesTopRank';

  function getDividerSortOption(mode) {
    return DIVIDER_SORT_OPTIONS[mode] || DIVIDER_SORT_OPTIONS[DEFAULT_DIVIDER_SORT_MODE];
  }

  function compareText(a, b) {
    return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true });
  }

  function compareRankAsc(a, b) {
    const diff = getSortRank(a) - getSortRank(b);
    if (diff) return diff;
    return 0;
  }

  function compareRankDesc(a, b) {
    const ar = getSortRank(a);
    const br = getSortRank(b);
    const aKnown = Number.isFinite(ar);
    const bKnown = Number.isFinite(br);

    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (aKnown && br !== ar) return br - ar;
    return 0;
  }

  function compareByMode(a, b, mode) {
    if (mode === 'rankAsc') {
      return compareRankAsc(a.item, b.item) || compareText(getSortName(a.item), getSortName(b.item)) || a.originalIndex - b.originalIndex;
    }

    if (mode === 'rankDesc') {
      return compareRankDesc(a.item, b.item) || compareText(getSortName(a.item), getSortName(b.item)) || a.originalIndex - b.originalIndex;
    }

    if (mode === 'kakeraDesc') {
      return getSortKakera(b.item) - getSortKakera(a.item) || compareRankAsc(a.item, b.item) || compareText(getSortName(a.item), getSortName(b.item)) || a.originalIndex - b.originalIndex;
    }

    if (mode === 'kakeraAsc') {
      return getSortKakera(a.item) - getSortKakera(b.item) || compareRankAsc(a.item, b.item) || compareText(getSortName(a.item), getSortName(b.item)) || a.originalIndex - b.originalIndex;
    }

    if (mode === 'nameAsc') {
      return compareText(getSortName(a.item), getSortName(b.item)) || compareText(getSortSeries(a.item), getSortSeries(b.item)) || compareRankAsc(a.item, b.item) || a.originalIndex - b.originalIndex;
    }

    if (mode === 'seriesName') {
      return compareText(getSortSeries(a.item), getSortSeries(b.item)) || compareRankAsc(a.item, b.item) || compareText(getSortName(a.item), getSortName(b.item)) || a.originalIndex - b.originalIndex;
    }

    if (mode === 'rouletteType') {
      return compareText(getSortRoulette(a.item), getSortRoulette(b.item)) || compareRankAsc(a.item, b.item) || compareText(getSortName(a.item), getSortName(b.item)) || a.originalIndex - b.originalIndex;
    }

    return compareRankAsc(a.item, b.item) || compareText(getSortName(a.item), getSortName(b.item)) || a.originalIndex - b.originalIndex;
  }

  function getSortGroupId(item) {
    return String(item?.groupId || '').trim();
  }

  function getSortGroupsState() {
    return requireCtx().app?.state?.groups || {};
  }

  function getSortGroupLeadId(groupId) {
    const groups = getSortGroupsState();
    const leadId = String(groups?.[groupId]?.leadCharacterId || '').trim();
    return leadId;
  }

  function orderGroupEntries(groupId, entries) {
    const list = (entries || []).slice();
    const groups = getSortGroupsState();
    const leadId = getSortGroupLeadId(groupId);
    const rawOrder = Array.isArray(groups?.[groupId]?.characterIds)
      ? groups[groupId].characterIds.map(value => String(value || '').trim()).filter(Boolean)
      : [];

    // The lead must always be first in the rendered/sorted group block, even if
    // older saved data still has characterIds in the previous order.
    const order = leadId
      ? [leadId, ...rawOrder.filter(id => id !== leadId)]
      : rawOrder;

    if (!order.length) {
      const fallback = list.sort((a, b) => a.originalIndex - b.originalIndex);
      if (!leadId) return fallback;
      const lead = fallback.find(entry => String(entry.item?.id || '') === leadId);
      if (!lead) return fallback;
      return [lead, ...fallback.filter(entry => entry !== lead)];
    }

    const byId = new Map(list.map(entry => [String(entry.item?.id || '').trim(), entry]));
    const used = new Set();
    const ordered = [];

    order.forEach(id => {
      const entry = byId.get(id);
      if (!entry) return;
      ordered.push(entry);
      used.add(id);
    });

    list
      .slice()
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .forEach(entry => {
        const id = String(entry.item?.id || '').trim();
        if (used.has(id)) return;
        ordered.push(entry);
      });

    return ordered;
  }

  function buildSortUnits(run) {
    const groupItems = new Map();
    const firstIndexByGroup = new Map();

    run.forEach((item, originalIndex) => {
      const groupId = getSortGroupId(item);
      if (!groupId) return;

      if (!groupItems.has(groupId)) {
        groupItems.set(groupId, []);
        firstIndexByGroup.set(groupId, originalIndex);
      }

      groupItems.get(groupId).push({ item, originalIndex });
    });

    const usedGroups = new Set();
    const units = [];

    run.forEach((item, originalIndex) => {
      const groupId = getSortGroupId(item);

      if (groupId && groupItems.has(groupId)) {
        if (usedGroups.has(groupId)) return;
        usedGroups.add(groupId);

        const entries = orderGroupEntries(groupId, groupItems.get(groupId) || []);

        units.push({
          type: 'group',
          groupId,
          originalIndex: firstIndexByGroup.get(groupId) ?? originalIndex,
          items: entries.map(entry => entry.item),
          originalEntries: entries
        });
        return;
      }

      units.push({
        type: 'single',
        originalIndex,
        items: [item],
        originalEntries: [{ item, originalIndex }]
      });
    });

    return units;
  }

  function unitPriorityRank(unit) {
    const lead = unitLeadItem(unit);
    return lead ? getSortRank(lead) : Math.min(...unit.items.map(getSortRank));
  }

  function unitBestRank(unit) {
    return unitPriorityRank(unit);
  }

  function unitWorstRank(unit) {
    return Math.max(...unit.items.map(getSortRank));
  }

  function unitBestKakera(unit) {
    return Math.max(...unit.items.map(getSortKakera));
  }

  function unitLowestKakera(unit) {
    return Math.min(...unit.items.map(getSortKakera));
  }

  function unitRepresentative(unit) {
    return unit.items[0] || {};
  }

  function unitBestRankItem(unit) {
    return (unit.items || [])
      .slice()
      .sort((a, b) => getSortRank(a) - getSortRank(b) || compareText(getSortName(a), getSortName(b)))[0] || unitRepresentative(unit);
  }

  function unitLeadItem(unit) {
    if (!unit || unit.type !== 'group') return null;
    const leadId = getSortGroupLeadId(unit.groupId);
    if (!leadId) return null;
    return (unit.items || []).find(item => String(item?.id || '') === leadId) || null;
  }

  function unitSortRepresentative(unit) {
    return unitLeadItem(unit) || unitBestRankItem(unit);
  }

  function unitSeriesKey(unit) {
    // v2.285:
    // If the group has a chosen lead, use that lead as representative for
    // Series Top Rank. Otherwise fallback to the previous best-rank logic.
    return getSortSeries(unitSortRepresentative(unit));
  }

  function compareUnitByMode(a, b, mode) {
    const ai = a.originalIndex || 0;
    const bi = b.originalIndex || 0;

    if (mode === 'rankDesc') {
      const diff = unitWorstRank(b) - unitWorstRank(a);
      if (diff) return diff;
      return compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || ai - bi;
    }

    if (mode === 'kakeraDesc') {
      return unitBestKakera(b) - unitBestKakera(a) || unitBestRank(a) - unitBestRank(b) || compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || ai - bi;
    }

    if (mode === 'kakeraAsc') {
      return unitLowestKakera(a) - unitLowestKakera(b) || unitBestRank(a) - unitBestRank(b) || compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || ai - bi;
    }

    if (mode === 'nameAsc') {
      return compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || compareText(unitSeriesKey(a), unitSeriesKey(b)) || unitBestRank(a) - unitBestRank(b) || ai - bi;
    }

    if (mode === 'seriesName') {
      return compareText(unitSeriesKey(a), unitSeriesKey(b)) || unitBestRank(a) - unitBestRank(b) || compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || ai - bi;
    }

    if (mode === 'rouletteType') {
      return compareText(getSortRoulette(unitSortRepresentative(a)), getSortRoulette(unitSortRepresentative(b))) || unitBestRank(a) - unitBestRank(b) || compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || ai - bi;
    }

    return unitBestRank(a) - unitBestRank(b) || compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || ai - bi;
  }

  function sortCharacterRunByGenericMode(run, mode) {
    return buildSortUnits(run)
      .sort((a, b) => compareUnitByMode(a, b, mode))
      .flatMap(unit => unit.items);
  }

  function sortCharacterRunBySeriesTopRank(run) {
    const seriesGroups = new Map();
    const order = [];

    buildSortUnits(run).forEach((unit, unitIndex) => {
      const key = unitSeriesKey(unit) || `~unknown:${unitIndex}`;

      if (!seriesGroups.has(key)) {
        seriesGroups.set(key, {
          key,
          firstIndex: unit.originalIndex ?? unitIndex,
          bestRank: unitBestRank(unit),
          units: []
        });
        order.push(key);
      }

      const group = seriesGroups.get(key);
      group.bestRank = Math.min(group.bestRank, unitBestRank(unit));
      group.firstIndex = Math.min(group.firstIndex, unit.originalIndex ?? unitIndex);
      group.units.push(unit);
    });

    return order
      .map(key => seriesGroups.get(key))
      .sort((a, b) => {
        if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
        const seriesCompare = a.key.localeCompare(b.key, undefined, { sensitivity: 'base', numeric: true });
        if (seriesCompare) return seriesCompare;
        return a.firstIndex - b.firstIndex;
      })
      .flatMap(group => group.units
        .sort((a, b) => unitBestRank(a) - unitBestRank(b) || compareText(getSortName(unitSortRepresentative(a)), getSortName(unitSortRepresentative(b))) || a.originalIndex - b.originalIndex)
        .flatMap(unit => unit.items));
  }

  function sortCharacterRun(run, mode = DEFAULT_DIVIDER_SORT_MODE) {
    if (mode === 'seriesTopRank') return sortCharacterRunBySeriesTopRank(run);
    return sortCharacterRunByGenericMode(run, mode);
  }

  function sortSegmentRespectingLocked(segment, mode = DEFAULT_DIVIDER_SORT_MODE) {
    const result = segment.slice();
    let runStart = -1;

    function flushRun(end) {
      if (runStart < 0) return;

      const sorted = sortCharacterRun(result.slice(runStart, end), mode);
      for (let i = 0; i < sorted.length; i++) {
        result[runStart + i] = sorted[i];
      }

      runStart = -1;
    }

    for (let i = 0; i <= result.length; i++) {
      const item = result[i];
      const isBoundary = i >= result.length || (!!item?.sortLocked && !getSortGroupId(item));

      if (isBoundary) {
        flushRun(i);
        continue;
      }

      if (runStart < 0) runStart = i;
    }

    return result;
  }

  async function showDividerSortDialog(dividerId) {
    const c = requireCtx();
    const list = c.app.state.characters || [];
    const divider = list.find(item => c.isDivider(item) && item.id === dividerId);

    if (!divider) return false;

    let selectedMode = DEFAULT_DIVIDER_SORT_MODE;

    const ok = await c.showAppDialog({
      type: 'confirm',
      title: 'Sort divider',
      message: `Choose how to sort ${divider.title || 'this divider'}. Sub-dividers and locked characters are preserved as boundaries.`,
      okText: 'Sort',
      cancelText: 'Cancel',
      renderContent(content) {
        const optionsHtml = Object.entries(DIVIDER_SORT_OPTIONS)
          .map(([value, option]) => `<option value="${value}">${option.label}</option>`)
          .join('');

        content.innerHTML = `
          <label class="app-dialog-field divider-sort-field">
            <span>Sort mode</span>
            <select id="dividerSortMode" class="app-dialog-input">
              ${optionsHtml}
            </select>
          </label>
          <p id="dividerSortDescription" class="divider-sort-description"></p>
        `;

        const select = content.querySelector('#dividerSortMode');
        const description = content.querySelector('#dividerSortDescription');

        function refreshDescription() {
          const option = getDividerSortOption(select.value);
          description.textContent = option.description;
        }

        select.value = selectedMode;
        select.addEventListener('change', () => {
          selectedMode = select.value;
          refreshDescription();
        });
        refreshDescription();
      }
    });

    if (!ok) return false;

    // v2.135: capture the divider only after the dialog closes. Opening the
    // sort menu must never render/warm the virtual board, because that caused
    // the click itself to move the page in v2.134.
    const dividerAnchor = captureDividerVisualAnchor(dividerId);
    return sortDividerSection(dividerId, selectedMode, { anchor: dividerAnchor });
  }

  function sortDividerSection(dividerId, mode = DEFAULT_DIVIDER_SORT_MODE, options = {}) {
    const c = requireCtx();
    const list = c.app.state.characters || [];
    const dividerIndex = list.findIndex(item => c.isDivider(item) && item.id === dividerId);

    if (dividerIndex < 0) return false;

    const endIndex = getDividerSectionEndIndex(dividerIndex);
    const section = list.slice(dividerIndex + 1, endIndex);

    if (!section.length) {
      c.notifyAppMessage('This divider has no content to sort.');
      return false;
    }

    let changed = false;
    let movableCount = 0;
    const sortedSection = [];
    let segment = [];

    function flushSegment() {
      if (!segment.length) return;

      const sorted = sortSegmentRespectingLocked(segment, mode);
      sortedSection.push(...sorted);
      segment = [];
    }

    section.forEach(item => {
      if (c.isDivider(item)) {
        flushSegment();
        sortedSection.push(item);
        return;
      }

      movableCount++;
      segment.push(item);
    });

    flushSegment();

    if (movableCount < 2) {
      c.notifyAppMessage('This divider needs at least 2 characters to sort.');
      return false;
    }

    for (let i = 0; i < section.length; i++) {
      if (section[i] !== sortedSection[i]) {
        changed = true;
        break;
      }
    }

    if (!changed) {
      c.notifyAppMessage('Divider already sorted.');
      return true;
    }

    const option = getDividerSortOption(mode);
    const dividerAnchor = options.anchor?.id === dividerId
      ? options.anchor
      : captureDividerVisualAnchor(dividerId);
    list.splice(dividerIndex + 1, section.length, ...sortedSection);

    c.invalidateSearchCache?.();
    c.assignBoardCounters?.();

    document.body.classList.add('is-board-focusing');

    // v2.135: do not call renderAll() here. renderAll() lets the virtual board
    // render once from the current scroll position, then renderAroundId() renders
    // again around the divider on the next frame. On the first sort after load,
    // that double render is what creates the visible jump. Update the data/cache
    // and render the divider window directly instead, then restore the captured
    // divider anchor before the browser paints the next frame.
    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderAroundId?.(dividerId, { scroll: false, highlight: false });
    c.restoreBoardVisualAnchor?.(dividerAnchor, { attempts: 1, highlight: false });
    c.saveLocal?.();

    requestAnimationFrame(() => {
      c.restoreBoardVisualAnchor?.(dividerAnchor, { attempts: 4, highlight: false });

      requestAnimationFrame(() => {
        c.restoreBoardVisualAnchor?.(dividerAnchor, { attempts: 3, highlight: false });
        setTimeout(() => document.body.classList.remove('is-board-focusing'), 160);
      });
    });

    c.notifyAppMessage(`Sorted ${c.fmt(movableCount)} characters in divider by ${option.label}.`);
    return true;
  }

  async function confirmDeleteDivider(dividerId) {
    const c = requireCtx();
    const divider = byId(dividerId);

    if (!divider) return false;

    const kind = Math.max(1, c.num(divider.level) || 1) > 1 ? 'sub-divider' : 'divider';
    const title = divider.title || 'Divider';

    const ok = await c.showAppConfirm(
      `Delete this ${kind}?\n\n"${title}"\n\nOnly the divider will be removed. Characters below it will stay in the board.`,
      {
        title: 'Delete divider?',
        okText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger'
      }
    );

    if (!ok) return false;

    const anchor = c.captureBoardVisualAnchor();
    const index = c.app.state.characters.findIndex(item => c.isDivider(item) && item.id === dividerId);

    if (index < 0) return false;

    c.app.state.characters.splice(index, 1);

    c.invalidateSearchCache();
    c.assignBoardCounters();
    c.renderAll();
    c.saveLocal();

    requestAnimationFrame(() => {
      window.MudaeBoardController?.updateEntriesFromApp?.();
      c.restoreBoardVisualAnchor(anchor);
    });

    c.notifyAppMessage(`${kind[0].toUpperCase()}${kind.slice(1)} deleted.`);
    return true;
  }

  function renderDivider(divider) {
    const c = requireCtx();
    const node = c.els.dividerTemplate.content.firstElementChild.cloneNode(true);
    const level = Math.max(1, c.num(divider.level) || 1);
    const kind = c.getDividerCounterKind(divider);
    const counter = kind === 'subdivider'
      ? divider.displaySubdividerIndex || 0
      : divider.displayDividerIndex || 0;

    node.dataset.id = divider.id;
    node.dataset.dividerKind = kind;
    node.dataset.boardIndex = divider.boardIndex || '';
    node.style.borderColor = divider.color || '#8b5cf6';

    const label = kind === 'subdivider'
      ? `SD#${c.fmt(counter)} · L${level}`
      : `D#${c.fmt(counter)} · L${level}`;

    const levelEl = node.querySelector('.divider-level');
    levelEl.textContent = label;
    levelEl.title = kind === 'subdivider'
      ? `Sub-folder #${c.fmt(counter)} · Board item #${c.fmt(divider.boardIndex || 0)}`
      : `Folder #${c.fmt(counter)} · Board item #${c.fmt(divider.boardIndex || 0)}`;

    const titleEl = node.querySelector('.divider-title');
    const noteEl = node.querySelector('.divider-note');

    titleEl.textContent = divider.title || 'Divider';
    noteEl.textContent = divider.note || '';

    let content = node.querySelector('.divider-content');

    if (!content) {
      content = document.createElement('div');
      content.className = 'divider-content';

      titleEl.before(content);
      content.appendChild(titleEl);
      content.appendChild(noteEl);
    }

    let actions = node.querySelector('.divider-actions');

    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'divider-actions';
      node.appendChild(actions);
    }

    const summary = getDividerHiddenSummary(divider.id);
    const isCollapsed = !!divider.collapsed;

    node.classList.toggle('is-collapsed', isCollapsed);
    node.dataset.collapsed = isCollapsed ? 'true' : 'false';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'divider-collapse-toggle';
    collapseBtn.textContent = isCollapsed ? '▸' : '▾';
    collapseBtn.title = isCollapsed
      ? 'Restore this divider section'
      : 'Minimize this divider section like a window';
    collapseBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    collapseBtn.setAttribute('aria-label', `${isCollapsed ? 'Restore' : 'Minimize'} divider ${divider.title || ''}`.trim());

    collapseBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleDividerCollapsed(divider.id);
    });

    if (collapseBtn.parentNode !== content) {
      content.insertBefore(collapseBtn, titleEl);
    }

    let subBadge = content.querySelector('.divider-sub-badge');

    if (kind === 'subdivider') {
      if (!subBadge) {
        subBadge = document.createElement('span');
        subBadge.className = 'divider-sub-badge';
        subBadge.textContent = 'SUB';
      }

      if (subBadge.parentNode !== content) {
        content.insertBefore(subBadge, titleEl);
      } else if (subBadge.nextElementSibling !== titleEl) {
        content.insertBefore(subBadge, titleEl);
      }
    } else if (subBadge) {
      subBadge.remove();
    }

    let hiddenEl = node.querySelector('.divider-hidden-summary');

    if (!hiddenEl) {
      hiddenEl = document.createElement('span');
      hiddenEl.className = 'divider-hidden-summary';
      content.appendChild(hiddenEl);
    }

    hiddenEl.textContent = isCollapsed
      ? `${c.fmt(summary.characters)} hidden${summary.dividers ? ` · ${c.fmt(summary.dividers)} folders` : ''}`
      : '';
    hiddenEl.hidden = !isCollapsed;

    const smpBtn = document.createElement('button');
    smpBtn.type = 'button';
    smpBtn.className = 'divider-action-btn divider-smp-btn';
    smpBtn.dataset.dividerAction = 'smp';
    smpBtn.dataset.dividerId = divider.id;
    smpBtn.textContent = '$smp';
    smpBtn.title = 'Copy $smp export for this divider';
    smpBtn.setAttribute('aria-label', `Copy $smp export for divider ${divider.title || ''}`.trim());

    bindDividerAction(smpBtn, () => {
      window.MudaeExports?.exportDividerSmp?.(divider.id);
    });

    const sortBtn = document.createElement('button');
    sortBtn.type = 'button';
    sortBtn.className = 'divider-action-btn divider-sort-btn';
    sortBtn.dataset.dividerAction = 'sort';
    sortBtn.dataset.dividerId = divider.id;
    sortBtn.textContent = 'Sort';
    sortBtn.title = 'Sort characters inside this divider';
    sortBtn.setAttribute('aria-label', `Sort divider ${divider.title || ''}`.trim());

    bindDividerAction(sortBtn, () => {
      showDividerSortDialog(divider.id);
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'divider-action-btn divider-edit-btn';
    editBtn.dataset.dividerAction = 'edit';
    editBtn.dataset.dividerId = divider.id;
    editBtn.textContent = 'Edit';
    editBtn.title = 'Edit this divider';
    editBtn.setAttribute('aria-label', `Edit divider ${divider.title || ''}`.trim());

    bindDividerAction(editBtn, () => {
      editDivider(divider.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'divider-action-btn divider-delete-btn';
    deleteBtn.dataset.dividerAction = 'delete';
    deleteBtn.dataset.dividerId = divider.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.title = 'Delete this divider';
    deleteBtn.setAttribute('aria-label', `Delete divider ${divider.title || ''}`.trim());

    bindDividerAction(deleteBtn, () => {
      confirmDeleteDivider(divider.id);
    });

    actions.appendChild(smpBtn);
    actions.appendChild(sortBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    return node;
  }

  function init(context){
    ctx = context;
    bindDelegatedDividerActions();
  }

  window.MudaeDividers = {
    init,
    renderDivider,
    insertBoardDivider,
    addBoardDivider,
    addBoardSubDivider,
    showDividerBuilderDialog,
    showDividerEditDialog,
    editDivider,
    confirmDeleteDivider,
    sortDividerSection,
    showDividerSortDialog,
    toggleDividerCollapsed,
    getDividerHiddenSummary,
    getCharacterRawIndexByDisplayNumber,
    getDividerInsertIndexFromChoice,
    getDividerCreationAnchor
  };
})();

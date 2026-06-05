(() => {
  'use strict';

  const GalleryUtils = window.MudaeGalleryUtils || {};
  const normalizeUrl = GalleryUtils.normalizeUrl;
  const isAnimatedImageUrl = GalleryUtils.isAnimatedImageUrl;
  const isFirefoxRuntime = GalleryUtils.isFirefoxRuntime;
  const makeSoftDeadline = GalleryUtils.makeSoftDeadline;
  const scheduleRenderChunk = GalleryUtils.scheduleRenderChunk;
  const parseUrls = GalleryUtils.parseUrls;
  const makeMudaeSearchUrl = GalleryUtils.makeMudaeSearchUrl;


  const STORAGE_KEY = 'mudae-rebuild-v1-state';
  const VIEW_POSITION_KEY = 'mudae-rebuild-v1-view-position';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const app = {
    originalInput: '',
    meta: {},
    state: {
      haremName: '',
      totalValue: 0,
      counts: {},
      characters: [],
      groups: {},
      exportAliasesText: '',
      persistentOrderMap: {},
      orderBaselineIds: []
    },
    activeId: null,
    editOpenAnchor: null,
    selectedGalleryIndex: null,
    galleryMatchedOnly: false,
    lastGalleryItems: [],
    loadingOverlayTimer: null,
    filter: {
      q: '',
      floatingQ: '',
      type: 'all'
    },
    searchTimer: null,
    searchCacheVersion: 0,
    searchMinChars: 2,
    searchClearAnchorId: null,
    searchClearAnchorTop: null,
    searchSessionOriginScrollY: null,
    searchSessionOriginAnchor: null,
    searchSessionOriginStartedAt: 0,
    pendingJumpHighlightId: null,
    pendingJumpHighlightUntil: 0,
    lastSearchPrimaryCharacterId: null,
    searchMoveOriginScrollY: null,
    searchMoveOriginAnchor: null,
    searchMoveOriginStartedAt: 0,
    draggedCharacterId: null,
    moveSaveTimer: null,
    moveCounterTimer: null,
    pointerMoveDrag: null,
    selectedMoveCharacterId: null,
    multiSelectMode: false,
    multiSelectedIds: new Set(),
    multiMoveTargetMode: false,
    virtualBoardEnabled: false,
    virtualBoardEntries: [],
    virtualBoardOffsets: [],
    virtualBoardTotalHeight: 0,
    virtualBoardScrollTimer: null,
    virtualBoardLastRange: null,
    virtualBoardAnchorId: null,
    virtualBoardAnchorScrollOffset: 0,
    virtualBoardTopAbsolute: 0,
    virtualScrollElement: null,
    virtualLastScrollTop: -1,
    viewPositionSaveTimer: null,
    pendingInitialViewRestore: null,
    initialViewRestoreTimers: [],
    savedViewRestoreTimers: [],
    initialViewRestoreCancelled: false,
    userInteractedSinceBoot: false,
    lastSavedViewPosition: null,
    suppressViewPositionSaveUntil: 0,
    virtualBlockStart: 0,
    virtualBlockObserver: null,
    virtualBlockSwitching: false,
    searchSuggestions: [],
    searchSuggestionIndex: 0,
    renderJob: 0,
    restoreRenderJob: 0,
    searchRenderJob: 0,
    boardRenderChunkSize: 140,
    searchRenderChunkSize: 90,
    restoreRenderChunkSize: 120,
    localLoadWasHeavy: false,
    expandedStats: {
      characters: false,
      keys: false,
      kakera: false,
      spheres: false
    }
  };
  window.app = app;


  const els = {};
  let searchMoveSession = null;

  function initEls() {
    [
      'haremTitle','appLoadingOverlay','appLoadingTitle','appLoadingDetail','jsonFileInput','exportJsonBtn','clearLocalBtn','searchInput','clearSearchBtn','floatingBar','floatingSearchInput','floatingClearSearchBtn','floatingBackTopBtn','filterTypeSelect',
      'restoreAllBtn','floatingMultiSelectBtn','floatingMoveSelectedBtn','floatingCreateGroupBtn','floatingClearMultiSelectBtn','floatingAddDividerBtn','floatingAddSubDividerBtn','parserDetails','parserInput','parseReplaceBtn','parseAppendBtn','clearParserBtn','parserStatus','parserCount','statsBar','board','editOverlay','editModal','editBody','editTitle','editSubtitle',
      'editCloseBtn','editForm','editIdInput','editNameInput','editSeriesInput','editImageInput',
      'editRankInput','editKakeraInput','editKeysInput','editOwnerInput','editRouletteInput',
      'editColorInput','editColorPalettePanel','editColorPaletteGrid','editColorPaletteCloseBtn','editColorPreviewBtn','editColorPreviewSwatch','editColorPreviewText','editNoteInput','spheresGrid','mudaeSearchBtn',
      'galleryToggleBtn','saveEditBtn','deleteEditCharacterBtn','cancelEditBtn','editPreviewImg','galleryPanel',
      'galleryStatus','galleryCloseBtn','loadPastedBtn','galleryMatchedOnlyBtn','galleryUseMatchedBtn','clearGalleryBtn',
      'galleryPasteDetails','galleryPasteInput','galleryGrid','cardTemplate','dividerTemplate'
    ].forEach(id => els[id] = document.getElementById(id));
  }

  const {
    LOCAL_ASSET_PATHS,
    KEY_ICONS,
    createLocalIcon,
    uid,
    makeStableKey,
    ensureCharacterIdentity,
    str,
    escapeHtml,
    num,
    fmt,
    isDivider,
    getKeyTypeFromCount,
    getDisplayKeyType,
    getKeyLabel,
    getKakeraIconPath,
    splitKeysByMudaeTier,
    getKeyBreakdown,
    getRouletteTags,
    getGenderType,
    getRouletteWorldType,
    getCharacterBreakdowns,
    getTopKakeraCharacter,
    getSpherePerkBreakdown,
    genderLabel,
    genderShortLabel,
    rouletteWorldLabel,
    rouletteWorldShortLabel,
    normalizeUrls,
    hasRealImage,
    placeholderSvg,
    normalizeImportedPayload,
    normalizeItem,
    inferTags,
    normalizeSpheres
  } = window.MudaeRebuildModel;


  // v2.444: tolerant import/local-load normalizer fallback.
  function normalizeAnyImportedPayloadSafe(rawPayload) {
    if (typeof normalizeAnyImportedPayload === 'function') {
      return normalizeAnyImportedPayload(rawPayload);
    }

    try {
      return normalizeImportedPayload(rawPayload);
    } catch (_) {
      const raw = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
      const chars =
        (Array.isArray(raw.state?.characters) && raw.state.characters) ||
        (Array.isArray(raw.characters) && raw.characters) ||
        (Array.isArray(raw.items) && raw.items) ||
        (Array.isArray(raw.harem) && raw.harem) ||
        (Array.isArray(raw.cards) && raw.cards) ||
        [];

      return {
        input: typeof raw.input === 'string' ? raw.input : '',
        meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
        state: {
          ...(raw.state && typeof raw.state === 'object' ? raw.state : {}),
          haremName: raw.haremName || raw.state?.haremName || raw.name || raw.title || '',
          totalValue: Number(raw.totalValue ?? raw.state?.totalValue ?? 0) || 0,
          counts: raw.counts || raw.state?.counts || {},
          groups: raw.groups || raw.state?.groups || {},
          exportAliasesText: raw.exportAliasesText || raw.state?.exportAliasesText || '',
          persistentOrderMap: raw.persistentOrderMap || raw.state?.persistentOrderMap || {},
          orderBaselineIds: raw.orderBaselineIds || raw.state?.orderBaselineIds || [],
          characters: chars.map((item, index) => {
            try {
              return normalizeItem(item, index);
            } catch {
              return item;
            }
          })
        }
      };
    }
  }

  function getCharacter(id) {
    return app.state.characters.find(item => !isDivider(item) && item.id === id) || null;
  }


  const groupUtils = window.MudaeGroupUtils?.create?.({ app, str, isDivider });
  const moveUtils = window.MudaeMoveUtils?.create?.({
    app,
    isDivider,
    num,
    invalidateSearchCache,
    assignBoardCounters,
    saveLocal,
    getCharacterCount,
    getCharacterListPosition
  });

  function ensureGroupsState() {
    return groupUtils.ensureGroupsState();
  }

  function getGroup(id) {
    return groupUtils.getGroup(id);
  }

  function getCharacterGroupId(ch) {
    return groupUtils.getCharacterGroupId(ch);
  }

  function hydrateCharacterGroupIdsFromGroups() {
    return groupUtils.hydrateCharacterGroupIdsFromGroups();
  }

  function migrateLegacyGroupFieldsFromCharacters() {
    return groupUtils.migrateLegacyGroupFieldsFromCharacters();
  }

  function getGroupLabelForCharacter(ch) {
    return groupUtils.getGroupLabelForCharacter(ch);
  }

  function syncGroupsFromCharacters() {
    return groupUtils.syncGroupsFromCharacters();
  }

  function getSeriesInitialsForGroup(items) {
    return groupUtils.getSeriesInitialsForGroup(items);
  }

  function makeNextGroupName(items) {
    return groupUtils.makeNextGroupName(items);
  }

  function clearCharacterGroupFields(item) {
    return groupUtils.clearCharacterGroupFields(item);
  }

  function getCurrentSelectedCharacterItems() {
    const selected = ensureMultiSelectedSet();
    const selectedIds = new Set(Array.from(selected || []));

    return (app.state.characters || [])
      .filter(item => item && !isDivider(item) && selectedIds.has(item.id));
  }

  function gatherCharactersAsContiguousBlock(items, options = {}) {
    const list = app.state.characters || [];
    const ids = new Set((items || []).map(item => String(item?.id || '')).filter(Boolean));
    if (ids.size < 2) return false;

    const entries = [];
    list.forEach((item, index) => {
      if (item && !isDivider(item) && ids.has(String(item.id || ''))) {
        entries.push({ item, index });
      }
    });

    if (entries.length < 2) return false;

    // Preserve the current visible/list order. This matches how multi-select has
    // historically behaved and avoids guessing click order from Set state.
    entries.sort((a, b) => a.index - b.index);

    const firstIndex = entries[0].index;
    const selectedItems = entries.map(entry => entry.item);
    const remaining = list.filter(item => !(item && !isDivider(item) && ids.has(String(item.id || ''))));

    const insertIndex = Math.max(0, firstIndex - entries.filter(entry => entry.index < firstIndex).length);
    remaining.splice(insertIndex, 0, ...selectedItems);

    app.state.characters = remaining;
    return {
      moved: entries.some((entry, offset) => entry.index !== firstIndex + offset),
      insertIndex,
      ids: selectedItems.map(item => item.id)
    };
  }

  function getGroupMemberItems(groupId) {
    return groupUtils.getGroupMemberItems(groupId);
  }

  function getGroupLeadId(groupId) {
    return groupUtils.getGroupLeadId?.(groupId) || '';
  }

  function setGroupLead(groupId, characterId, options = {}) {
    const ok = groupUtils.setGroupLead?.(groupId, characterId);
    if (!ok) return false;

    syncGroupsFromCharacters();

    const members = getGroupMemberItems(groupId);
    const gatherResult = gatherCharactersAsContiguousBlock(members);
    const group = getGroup(groupId);
    if (group && gatherResult?.ids?.length) {
      group.characterIds = [
        String(characterId),
        ...gatherResult.ids.filter(id => String(id) !== String(characterId))
      ];
      group.leadCharacterId = characterId;
    }

    const character = getCharacter(characterId);
    applyGroupOrderToBoard(groupId, { notify: false });
    saveLocal();

    if (options.syncEdit && app.activeId) {
      const active = getCharacter(app.activeId);
      if (active) syncEditGroupControls(active);
    }

    window.MudaeBoardController?.updateEntriesFromApp?.();
    renderBoard();
    notifyAppMessage(`${character?.name || 'Character'} set as lead for ${group?.name || 'group'}.`);
    return true;
  }

  function applyGroupOrderToBoard(groupId, options = {}) {
    const id = str(groupId || '').trim();
    if (!id) return false;

    const visualAnchor = options.visualAnchor || captureBoardVisualAnchor();
    const scrollBefore = Number.isFinite(options.scrollBefore)
      ? options.scrollBefore
      : (window.scrollY || document.documentElement.scrollTop || 0);

    const members = getGroupMemberItems(id);
    if (members.length < 2) return false;

    const list = app.state.characters || [];
    const memberIds = new Set(members.map(item => String(item.id || '')).filter(Boolean));
    const currentIndexes = [];

    list.forEach((item, index) => {
      if (item && !isDivider(item) && memberIds.has(String(item.id || ''))) {
        currentIndexes.push(index);
      }
    });

    if (!currentIndexes.length) return false;

    const insertIndexRaw = Math.min(...currentIndexes);
    const remaining = list.filter(item => !(item && !isDivider(item) && memberIds.has(String(item.id || ''))));
    const removedBeforeInsert = currentIndexes.filter(index => index < insertIndexRaw).length;
    const insertIndex = Math.max(0, insertIndexRaw - removedBeforeInsert);

    remaining.splice(insertIndex, 0, ...members);
    app.state.characters = remaining;

    const group = getGroup(id);
    if (group) {
      group.characterIds = members.map(item => item.id);
      const leadId = getGroupLeadId(id);
      if (leadId) group.leadCharacterId = leadId;
    }

    syncGroupsFromCharacters();
    invalidateSearchCache?.();
    assignBoardCounters?.();
    saveLocal();

    window.MudaeBoardController?.updateEntriesFromApp?.();
    const anchorId = getGroupLeadId(id) || members[0]?.id;
    if (anchorId) {
      window.MudaeBoardController?.renderAroundId?.(anchorId, { scroll: false, highlight: false });
    } else {
      renderBoard();
    }

    requestAnimationFrame(() => {
      if (visualAnchor?.id) restoreBoardVisualAnchor(visualAnchor, { attempts: 8, highlight: false });
      else if (Number.isFinite(scrollBefore)) window.scrollTo({ top: scrollBefore, behavior: 'auto' });
      scheduleViewPositionSave();
    });

    if (options.notify !== false) {
      notifyAppMessage(`Saved order for ${group?.name || 'group'}.`);
    }

    return true;
  }

  function moveGroupMember(groupId, characterId, direction, options = {}) {
    const ok = groupUtils.moveGroupMember?.(groupId, characterId, direction);
    if (!ok) return false;

    syncGroupsFromCharacters();

    if (options.applyToBoard !== false) {
      applyGroupOrderToBoard(groupId, { notify: false });
    } else {
      saveLocal();
      renderBoard();
    }

    if (options.syncEdit && app.activeId) {
      const active = getCharacter(app.activeId);
      if (active) syncEditGroupControls(active);
    }

    return true;
  }

  function moveGroupMemberToIndex(groupId, characterId, targetIndex, options = {}) {
    const ok = groupUtils.moveGroupMemberToIndex?.(groupId, characterId, targetIndex);
    if (!ok) return false;

    syncGroupsFromCharacters();

    if (options.applyToBoard !== false) {
      applyGroupOrderToBoard(groupId, { notify: false });
    } else {
      saveLocal();
      renderBoard();
    }

    if (options.syncEdit && app.activeId) {
      const active = getCharacter(app.activeId);
      if (active) syncEditGroupControls(active);
    }

    return true;
  }

  function setGroupName(groupId, nextName, options = {}) {
    const id = str(groupId).trim();
    const name = str(nextName).trim();
    if (!id || !name) return false;

    const groups = ensureGroupsState();
    const group = groups[id];
    if (!group) return false;

    const previousName = str(group.name || id).trim() || id;
    if (previousName === name) return true;

    const visualAnchor = options.visualAnchor || captureBoardVisualAnchor();
    const scrollBefore = Number.isFinite(options.scrollBefore)
      ? options.scrollBefore
      : (window.scrollY || document.documentElement.scrollTop || 0);

    group.name = name;
    group.characterIds = getGroupMemberItems(id).map(item => item.id);

    getGroupMemberItems(id).forEach(item => {
      item.groupLabel = name;
      if (item.lockGroupId === id || item.lockGroupLabel === previousName) item.lockGroupLabel = name;
      if (item.matchGroupId === id || item.matchGroupLabel === previousName) item.matchGroupLabel = name;
      if (item.bubbleId === id || item.bubbleLabel === previousName) item.bubbleLabel = name;
    });

    syncGroupsFromCharacters();
    refreshBoardAfterGroupChange(visualAnchor, scrollBefore);

    if (options.syncEdit !== false) syncEditGroupControls(getCharacter(app.activeId));
    notifyAppMessage(`Group renamed to ${name}.`);
    return true;
  }

  async function promptRenameGroup(groupId, options = {}) {
    const id = str(groupId).trim();
    const group = getGroup(id);
    if (!id || !group) return false;

    const currentName = str(group.name || id).trim() || id;
    const raw = await showAppPrompt('Rename group:', currentName, {
      title: 'Rename group',
      okText: 'Rename',
      cancelText: 'Cancel'
    });

    if (raw == null) return false;

    const nextName = str(raw).trim();
    if (!nextName) {
      showAppAlert('Group name cannot be empty.', { title: 'Invalid group name', variant: 'danger' });
      return false;
    }

    return setGroupName(id, nextName, options);
  }

  function setCardMultiSelectedVisual(id, selected) {
    if (!id) return;
    const node = els.board?.querySelector?.(`[data-id="${getCssSafeId(id)}"]`);
    node?.classList?.toggle?.('multi-selected-card', !!selected);
  }

  function syncVisibleMultiSelectionClasses() {
    const selected = ensureMultiSelectedSet();
    els.board?.querySelectorAll?.('.char-card[data-id], .character-card[data-id], [data-id].card')
      .forEach(node => {
        const id = node?.dataset?.id;
        if (!id) return;
        node.classList.toggle('multi-selected-card', selected.has(id));
      });
  }

  function dispatchMultiSelectChange() {
    const selected = ensureMultiSelectedSet();
    syncVisibleMultiSelectionClasses();
    window.dispatchEvent(new CustomEvent('mudae:multi-select-change', {
      detail: { enabled: app.multiSelectMode, count: selected.size, targetMode: app.multiMoveTargetMode }
    }));
  }

  function getSelectedGroupAction() {
    if (!app.multiSelectMode) return { type: 'create', label: 'Create Group' };

    const selected = getCurrentSelectedCharacterItems();
    if (selected.length < 2) return { type: 'create', label: 'Create Group' };

    const grouped = selected.filter(item => !!getCharacterGroupId(item));
    const ungrouped = selected.filter(item => !getCharacterGroupId(item));
    const uniqueGroups = Array.from(new Set(grouped.map(getCharacterGroupId).filter(Boolean)));

    if (!uniqueGroups.length) {
      return { type: 'create', label: 'Create Group', selected };
    }

    if (uniqueGroups.length === 1) {
      const groupId = uniqueGroups[0];
      const memberItems = getGroupMemberItems(groupId);
      const selectedSet = new Set(selected.map(item => item.id));
      const hasEveryCurrentMember = memberItems.length > 0 && memberItems.every(item => selectedSet.has(item.id));

      if (ungrouped.length > 0) {
        return {
          type: 'add-to-group',
          label: 'Add to Group',
          groupId,
          group: getGroup(groupId),
          selected,
          memberItems,
          addItems: ungrouped,
          disabled: !hasEveryCurrentMember
        };
      }

      return {
        type: hasEveryCurrentMember ? 'remove-group' : 'remove-selected',
        label: hasEveryCurrentMember ? 'Remove Group' : 'Remove from Group',
        groupId,
        group: getGroup(groupId),
        selected,
        memberItems
      };
    }

    return {
      type: 'mixed-groups',
      label: 'Mixed Groups',
      selected,
      groupIds: uniqueGroups,
      disabled: true
    };
  }

  function syncVisibleGroupBadges() {
    const board = els.board;
    if (!board) return false;

    const nodes = Array.from(board.querySelectorAll?.('.char-card[data-id]') || []);
    if (!nodes.length) return false;

    nodes.forEach(node => {
      const id = node.dataset?.id || '';
      const character = getCharacter(id);
      if (!character || isDivider(character)) return;

      node.querySelectorAll?.('.card-group-badge')?.forEach(badge => badge.remove());
      node.classList.remove('is-grouped-card', 'has-gallery-count', 'no-gallery-count');
      if (node.dataset) delete node.dataset.groupId;

      const groupLabel = getGroupLabelForCharacter(character);
      if (!groupLabel) return;

      const galleryImageCount = getUniqueGalleryImageCount(character);
      node.classList.add('is-grouped-card');
      node.classList.toggle('has-gallery-count', galleryImageCount > 0);
      node.classList.toggle('no-gallery-count', galleryImageCount <= 0);
      if (node.dataset) node.dataset.groupId = getCharacterGroupId(character) || '';

      const badge = document.createElement('button');
      badge.className = 'card-group-badge';
      badge.type = 'button';
      badge.textContent = groupLabel;
      badge.title = 'Open group menu: ' + groupLabel;
      badge.setAttribute('aria-label', 'Open group menu ' + groupLabel);
      badge.dataset.groupId = getCharacterGroupId(character) || '';

      const imageWrap = node.querySelector('.image-wrap');
      const galleryBadge = node.querySelector('.gallery-badge');
      if (imageWrap && galleryBadge) {
        imageWrap.insertBefore(badge, galleryBadge);
      } else if (imageWrap) {
        imageWrap.appendChild(badge);
      }
    });

    return true;
  }

  async function showGroupManageDialog(groupId, options = {}) {
    const id = str(groupId).trim();
    const group = getGroup(id);
    if (!id || !group) return false;

    const members = getGroupMemberItems(id);
    if (!members.length) {
      notifyAppMessage('This group has no members.');
      return false;
    }

    const leadId = getGroupLeadId(id);
    const currentName = str(group.name || id).trim() || id;

    const ok = await showAppDialog({
      type: 'confirm',
      title: 'Group menu',
      message: '',
      okText: 'Save Order',
      cancelText: 'Cancel',
      renderContent(content) {
        requestAnimationFrame(() => {
          const shell = content.closest?.('.app-dialog, [role="dialog"]');
          shell?.classList?.add('mhp-group-menu-source');

          // Footer Save Order should apply the current order and then the dialog
          // helper closes it normally.
          const saveBtn = shell?.querySelector?.('.app-dialog-actions .btn-primary, .dialog-actions .btn-primary, .dialog-footer .btn-primary');
          if (saveBtn && !saveBtn.dataset.groupSaveBound) {
            saveBtn.dataset.groupSaveBound = 'true';
            saveBtn.addEventListener('click', () => {
              applyGroupOrderToBoard(id, { notify: true });
            }, { capture: true });
          }
        });

        const rows = members.map((member, index) => {
          const isLead = String(member.id) === String(leadId);
          return `
            <div class="group-menu-member ${isLead ? 'is-lead' : ''}" data-character-id="${escapeHtml(member.id)}" data-member-index="${index}" draggable="${isLead ? 'false' : 'true'}">
              <span class="group-menu-drag-handle" title="${isLead ? 'Lead is locked' : 'Drag to reorder'}" aria-hidden="true">${isLead ? '🔒' : '⋮⋮'}</span>
              <img class="group-menu-thumb" src="${escapeHtml(member.image || '')}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
              <div class="group-menu-copy">
                <strong>${escapeHtml(member.name || 'Unnamed')}</strong>
                <span>${escapeHtml(member.series || 'No series')}</span>
                <em>${isLead ? 'Leader' : `Position ${index + 1} / ${members.length}`}</em>
              </div>
              <div class="group-menu-actions">
                <button class="btn btn-secondary group-menu-set-lead" type="button" ${isLead ? 'disabled' : ''}>Lead</button>
                <div class="group-menu-arrows">
                  <button class="btn btn-secondary group-menu-move-up" type="button" ${isLead || index <= 1 ? 'disabled' : ''} aria-label="Move earlier">↑</button>
                  <button class="btn btn-secondary group-menu-move-down" type="button" ${isLead || index >= members.length - 1 ? 'disabled' : ''} aria-label="Move later">↓</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        content.innerHTML = `
          <div class="group-menu-panel" data-group-id="${escapeHtml(id)}">
            <div class="group-menu-head">
              <div class="group-menu-head-copy">
                <span>Group</span>
                <strong>${escapeHtml(currentName)}</strong>
                <small>${members.length} member${members.length === 1 ? '' : 's'}</small>
              </div>
              <div class="group-menu-head-actions">
                <button id="groupMenuRenameBtn" class="btn btn-secondary group-menu-rename-btn" type="button">Rename Group</button>
              </div>
            </div>
            <div class="group-menu-list">
              ${rows}
            </div>
          </div>
        `;

        const reopen = () => {
          const active = document.activeElement;
          active?.blur?.();
          setTimeout(() => showGroupManageDialog(id, options), 35);
        };

        content.querySelector('#groupMenuRenameBtn')?.addEventListener('click', async event => {
          event.preventDefault();
          event.stopPropagation();
          await promptRenameGroup(id, { syncEdit: false });
          reopen();
        });

        const list = content.querySelector('.group-menu-list');
        let draggedId = '';

        content.querySelectorAll('.group-menu-member').forEach(row => {
          const characterId = row.dataset.characterId;
          const isLeadRow = row.classList.contains('is-lead');

          row.addEventListener('dragstart', event => {
            if (isLeadRow) {
              event.preventDefault();
              return;
            }

            draggedId = characterId;
            row.classList.add('is-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', characterId);
          });

          row.addEventListener('dragend', () => {
            draggedId = '';
            content.querySelectorAll('.group-menu-member').forEach(node => {
              node.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
            });
          });

          row.addEventListener('dragover', event => {
            if (!draggedId || draggedId === characterId) return;
            event.preventDefault();

            content.querySelectorAll('.group-menu-member').forEach(node => node.classList.remove('is-drop-before', 'is-drop-after'));

            const rect = row.getBoundingClientRect();
            const before = event.clientY < rect.top + rect.height / 2;
            const targetIndex = Number(row.dataset.memberIndex) || 0;

            // Never allow dropping above the locked lead.
            if (targetIndex <= 0 && before) {
              row.classList.add('is-drop-after');
            } else {
              row.classList.add(before ? 'is-drop-before' : 'is-drop-after');
            }
          });

          row.addEventListener('drop', event => {
            if (!draggedId || draggedId === characterId) return;
            event.preventDefault();

            const rect = row.getBoundingClientRect();
            const before = event.clientY < rect.top + rect.height / 2;
            const targetIndex = Number(row.dataset.memberIndex) || 0;
            const safeTarget = Math.max(1, before ? targetIndex : targetIndex + 1);

            if (moveGroupMemberToIndex(id, draggedId, safeTarget, { syncEdit: false })) {
              reopen();
            }
          });

          row.querySelector('.group-menu-move-up')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (moveGroupMember(id, characterId, -1, { syncEdit: false })) reopen();
          });

          row.querySelector('.group-menu-move-down')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (moveGroupMember(id, characterId, 1, { syncEdit: false })) reopen();
          });

          row.querySelector('.group-menu-set-lead')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (setGroupLead(id, characterId, { syncEdit: false })) reopen();
          });
        });

        list?.addEventListener('dragover', event => {
          if (!draggedId) return;
          event.preventDefault();
        });
      }
    });

    return !!ok;
  }

  function handleGroupBadgeClick(event) {
    const badge = event.target?.closest?.('.card-group-badge');
    if (!badge || !els.board?.contains?.(badge)) return;

    const groupId = str(badge.dataset?.groupId || '').trim();
    if (!groupId) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    showGroupManageDialog(groupId);
  }

  function bindGroupBadgeRenameClicks() {
    if (!els.board || app.groupBadgeRenameBound) return;
    app.groupBadgeRenameBound = true;
    els.board.addEventListener('click', handleGroupBadgeClick, true);
  }

  function refreshBoardAfterGroupChange(visualAnchor, scrollBefore) {
    invalidateSearchCache();
    assignBoardCounters();
    saveLocal();

    // Group changes do not reorder the board; they only change metadata and
    // badges. Re-rendering the virtual grid here can remount images and cause
    // visible flicker while scrolling, so keep the current DOM/window intact.
    window.MudaeBoardController?.updateEntriesFromApp?.();
    syncVisibleGroupBadges();
    syncVisibleMultiSelectionClasses();

    const restorePosition = () => {
      if (Number.isFinite(scrollBefore)) {
        window.scrollTo({ top: scrollBefore, behavior: 'auto' });
      }
      if (visualAnchor?.id) {
        restoreBoardVisualAnchor(visualAnchor, { attempts: 1, highlight: false });
      }
    };

    requestAnimationFrame(restorePosition);
  }

  function removeGroupFromSelection(action = null) {
    const selectedAction = action || getSelectedGroupAction();
    const groupId = selectedAction.groupId;
    if (!groupId) return false;

    const groups = ensureGroupsState();
    const groupName = str(selectedAction.group?.name || groups[groupId]?.name || groupId).trim() || groupId;
    const visualAnchor = captureBoardVisualAnchor();
    const scrollBefore = window.scrollY || document.documentElement.scrollTop || 0;
    const removeWholeGroup = selectedAction.type === 'remove-group';
    const targets = removeWholeGroup ? getGroupMemberItems(groupId) : (selectedAction.selected || []);

    targets.forEach(clearCharacterGroupFields);

    const remaining = getGroupMemberItems(groupId);
    if (removeWholeGroup || remaining.length < 2) {
      remaining.forEach(clearCharacterGroupFields);
      delete groups[groupId];
    } else {
      groups[groupId] = {
        ...(groups[groupId] || {}),
        id: groupId,
        name: groupName,
        characterIds: remaining.map(item => item.id),
        leadCharacterId: remaining.some(item => String(item.id) === String(groups[groupId]?.leadCharacterId || ''))
          ? groups[groupId]?.leadCharacterId
          : (remaining[0]?.id || '')
      };
    }

    clearMultiSelection();
    syncGroupsFromCharacters();
    refreshBoardAfterGroupChange(visualAnchor, scrollBefore);

    notifyAppMessage(removeWholeGroup ? `Group ${groupName} removed.` : `${targets.length} characters removed from ${groupName}.`);
    return true;
  }

  function addSelectedCharactersToExistingGroup(action = null) {
    const selectedAction = action || getSelectedGroupAction();
    const groupId = selectedAction.groupId;
    if (!groupId) return false;

    const addItems = (selectedAction.addItems || []).filter(item => item && !isDivider(item) && !getCharacterGroupId(item));
    if (!addItems.length) {
      notifyAppMessage('Select ungrouped characters to add to the group.');
      return false;
    }

    if (selectedAction.disabled) {
      notifyAppMessage('Select a full existing group before adding new characters.');
      return false;
    }

    const groups = ensureGroupsState();
    const existing = groups[groupId] || {};
    const groupName = str(existing.name || selectedAction.group?.name || groupId).trim() || groupId;
    const visualAnchor = captureBoardVisualAnchor();
    const scrollBefore = window.scrollY || document.documentElement.scrollTop || 0;

    addItems.forEach(item => {
      item.groupId = groupId;
      item.groupLabel = groupName;
    });

    const allMembers = [
      ...(selectedAction.memberItems || []),
      ...addItems
    ].filter(Boolean);
    const gatherResult = gatherCharactersAsContiguousBlock(allMembers);

    syncGroupsFromCharacters();
    if (groups[groupId]) {
      groups[groupId].name = groupName;
      if (gatherResult?.ids?.length) {
        groups[groupId].characterIds = gatherResult.ids;
        groups[groupId].leadCharacterId = groups[groupId].leadCharacterId && gatherResult.ids.includes(groups[groupId].leadCharacterId)
          ? groups[groupId].leadCharacterId
          : (gatherResult.ids[0] || '');
      }
    }

    clearMultiSelection();
    window.MudaeBoardController?.updateEntriesFromApp?.();
    refreshBoardAfterGroupChange(visualAnchor, scrollBefore);

    notifyAppMessage(`${addItems.length} character${addItems.length === 1 ? '' : 's'} added to ${groupName} and gathered together.`);
    return true;
  }

  function createGroupFromSelection() {
    if (!app.multiSelectMode) return false;

    const selected = ensureMultiSelectedSet();
    const selectedIds = Array.from(selected || []);
    if (selectedIds.length < 2) {
      notifyAppMessage('Select at least 2 characters to create a group.');
      return false;
    }

    const selectedItems = getCurrentSelectedCharacterItems();

    if (selectedItems.length < 2) {
      notifyAppMessage('Select at least 2 valid characters to create a group.');
      return false;
    }

    const selectedAction = getSelectedGroupAction();
    if (selectedAction.type === 'remove-group' || selectedAction.type === 'remove-selected') {
      return removeGroupFromSelection(selectedAction);
    }

    if (selectedAction.type === 'add-to-group') {
      return addSelectedCharactersToExistingGroup(selectedAction);
    }

    if (selectedAction.type === 'mixed-groups') {
      notifyAppMessage('Select characters from only one group at a time.');
      return false;
    }

    const groups = ensureGroupsState();
    const groupId = `grp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const name = makeNextGroupName(selectedItems);
    const createdAt = new Date().toISOString();
    const visualAnchor = captureBoardVisualAnchor();
    const scrollBefore = window.scrollY || document.documentElement.scrollTop || 0;

    groups[groupId] = {
      id: groupId,
      name,
      createdAt,
      characterIds: selectedItems.map(item => item.id),
      leadCharacterId: selectedItems[0]?.id || ''
    };

    selectedItems.forEach(item => {
      item.groupId = groupId;
      item.groupLabel = name;
    });

    const gatherResult = gatherCharactersAsContiguousBlock(selectedItems);
    if (gatherResult?.ids?.length) {
      groups[groupId].characterIds = gatherResult.ids;
      groups[groupId].leadCharacterId = gatherResult.ids[0] || groups[groupId].leadCharacterId || '';
    }

    clearMultiSelection();
    syncGroupsFromCharacters();

    // Creating a group now changes physical order, so update the virtual board
    // entries before restoring the visual anchor.
    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderAroundId?.(groups[groupId].leadCharacterId || selectedItems[0]?.id, {
      scroll: false,
      highlight: false
    });

    refreshBoardAfterGroupChange(visualAnchor, scrollBefore);

    notifyAppMessage(`Group ${name} created with ${selectedItems.length} characters and gathered together.`);
    return true;
  }


  // v2.448: cooperative first-load/import performance helpers.
  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  function idleSlice(timeout = 80) {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => resolve(), { timeout });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  async function yieldToUi(label = '') {
    // Two frames gives the browser a chance to paint the loading overlay before
    // heavy normalization/rendering starts.
    await nextFrame();
    await idleSlice(80);
  }

  function beginHeavyUiLoad(message = 'Loading harem...', detail = 'Preparing characters and images.') {
    document.documentElement.classList.add('mhp-heavy-loading', 'mhp-stabilize-bg');
    document.body?.classList?.add('mhp-heavy-loading', 'mhp-stabilize-bg');

    if (typeof showAppLoading === 'function') {
      showAppLoading(message, detail);
    }
  }

  async function endHeavyUiLoad(reason = 'heavy-load') {
    await nextFrame();

    if (typeof finishLargeLoadOverlay === 'function') {
      await finishLargeLoadOverlay(reason);
    } else {
      hardFinishLoadingState(reason);
    }

    // Belt-and-suspenders cleanup. Older CSS keeps the boot loader visible while
    // mhp-heavy-loading is present, so these classes must be removed immediately.
    document.documentElement.classList.remove('mhp-heavy-loading', 'mhp-stabilize-bg');
    document.body?.classList?.remove('mhp-heavy-loading', 'mhp-stabilize-bg');
  }

  async function normalizeCharactersInChunks(items, options = {}) {
    if (!Array.isArray(items)) return items;

    const chunkSize = Number(options.chunkSize || 250);
    const total = items.length;
    const bytes = Number(options.bytes || 0);
    const title = options.title || 'Loading harem...';
    const detail = options.detail || 'Preparing characters and images.';
    for (let i = 0; i < items.length; i += chunkSize) {
      const end = Math.min(items.length, i + chunkSize);
      for (let j = i; j < end; j++) {
        const item = items[j];
        try {
          if (!isDivider(item) && typeof normalizeCharacterImageGallery === 'function') {
            normalizeCharacterImageGallery(item);
          }
          if (typeof ensureCharacterIdentity === 'function') {
            ensureCharacterIdentity(item);
          }
        } catch (_) {}
      }

      if (options.updateLoader !== false) {
        updateSharedLoader({ title, detail, loaded: end, total, bytes, parser: options.parser === true, json: options.json === true });
      }

      if (i + chunkSize < items.length) await idleSlice(80);
    }

    return items;
  }

  async function renderAllCooperative(options = {}) {
    const before = performance.now();

    // Give loading overlay/fixed background one paint before the heavy board draw.
    if (options.beforePaint !== false) await yieldToUi('renderAll');

    renderAll();

    // Let browser paint the completed board before closing loader.
    await nextFrame();

    const elapsed = performance.now() - before;
    if (elapsed > 250) {
      console.info(`[MHP] renderAll completed in ${Math.round(elapsed)}ms`);
    }

    try {
      window.__mhpLastRenderCompleteAt = Date.now();
      window.dispatchEvent(new CustomEvent('mhp-render-complete', {
        detail: { elapsedMs: Math.round(elapsed), source: options.source || options.reason || 'renderAllCooperative' }
      }));
      window.dispatchEvent(new CustomEvent('mhp-board-rendered', {
        detail: { elapsedMs: Math.round(elapsed), source: options.source || options.reason || 'renderAllCooperative' }
      }));
    } catch (_) {}
  }

  function saveLocal() {
    window.MudaeRebuildStorage.saveLocal(STORAGE_KEY, exportPayload());
    scheduleViewPositionSave();
  }
  window.MHPSaveLocal = saveLocal;


  function saveLocalDeferred(delay = 90) {
    clearTimeout(app.deferredSaveLocalTimer);
    app.deferredSaveLocalTimer = setTimeout(() => {
      app.deferredSaveLocalTimer = 0;
      saveLocal();
    }, delay);
  }

  function getLocalStateRaw() {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function formatStorageSize(bytes) {
    const n = Number(bytes || 0);
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
  }

  function formatLoaderCount(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US') : '—';
  }

  function getActiveLoaderOverlay(preferParser = false) {
    const root = document.documentElement;
    if (!preferParser && root.classList.contains('mhp-booting')) {
      return document.getElementById('mhpBootLoader');
    }
    return els.appLoadingOverlay || document.getElementById('appLoadingOverlay') || document.getElementById('mhpBootLoader');
  }

  function updateSharedLoader(options = {}) {
    const title = options.title;
    const detail = options.detail;
    const loaded = Number(options.loaded || 0);
    const total = Number(options.total || 0);
    const bytes = Number(options.bytes || options.size || 0);
    const loaderKind = getSharedLoaderKind(title, options);
    const preferParser = loaderKind === 'parsing';
    const overlay = getActiveLoaderOverlay(preferParser);
    if (!overlay) return;
    setSharedLoaderAsset(overlay, loaderKind);

    const titleNode = overlay.querySelector('.mhp-loader-title, .mhp-boot-loader-title, #appLoadingTitle');
    const detailNode = overlay.querySelector('.mhp-loader-subtitle, .mhp-boot-loader-subtitle, #appLoadingDetail');
    const dataNode = overlay.querySelector('.mhp-loader-data');
    const bar = overlay.querySelector('.mhp-loader-bar, .app-loading-bar, .mhp-boot-loader-bar');

    if (title && titleNode) titleNode.textContent = title;
    if (detail && detailNode) detailNode.textContent = detail;

    if (dataNode) {
      const parts = [];
      if (total > 0) {
        parts.push(`Characters: ${formatLoaderCount(Math.min(loaded || total, total))} / ${formatLoaderCount(total)}`);
      } else if (loaded > 0) {
        parts.push(`Characters: ${formatLoaderCount(loaded)}`);
      } else {
        parts.push('Characters: —');
      }
      parts.push(`Size: ${bytes > 0 ? formatStorageSize(bytes) : '—'}`);
      dataNode.textContent = parts.join(' · ');
    }

    if (bar) {
      if (total > 0) {
        const pct = Math.max(1, Math.min(100, Math.round(((loaded || 0) / total) * 100)));
        overlay.classList.add('is-determinate');
        overlay.style.setProperty('--mhp-loader-progress', `${pct}%`);
        bar.setAttribute('aria-valuenow', String(pct));
      } else {
        overlay.classList.remove('is-determinate');
        overlay.style.removeProperty('--mhp-loader-progress');
        bar.removeAttribute('aria-valuenow');
      }
    }
  }

  function resetSharedLoaderProgress() {
    [document.getElementById('mhpBootLoader'), els.appLoadingOverlay || document.getElementById('appLoadingOverlay')].forEach(overlay => {
      if (!overlay) return;
      overlay.classList.remove('is-determinate');
      overlay.style.removeProperty('--mhp-loader-progress');
      const dataNode = overlay.querySelector('.mhp-loader-data');
      if (dataNode) dataNode.textContent = 'Characters: — · Size: —';
    });
  }

  async function normalizeImportedCharactersCooperative(items, options = {}) {
    const source = Array.isArray(items) ? items : [];
    const chunkSize = Math.max(60, Number(options.chunkSize || 180) || 180);
    const out = [];

    for (let i = 0; i < source.length; i += chunkSize) {
      const end = Math.min(source.length, i + chunkSize);
      for (let j = i; j < end; j += 1) {
        try {
          const normalized = normalizeLegacyImportedCharacter(source[j], j);
          if (normalized) out.push(normalized);
        } catch (_) {
          if (source[j]) out.push(source[j]);
        }
      }

      updateSharedLoader({
        title: options.title || 'Loading harem...',
        detail: 'Restoring saved characters...',
        loaded: end,
        total: source.length,
        bytes: Number(options.bytes || 0)
      });

      if (i + chunkSize < source.length) {
        await idleSlice(80);
      }
    }

    return out;
  }

  async function loadLocalCooperative() {
    const raw = getLocalStateRaw();
    if (!raw) return false;

    const isHeavy = raw.length > 180000;
    app.localLoadWasHeavy = isHeavy;

    try {
      document.documentElement.classList.add('mhp-stabilize-bg');
      document.body?.classList?.add('mhp-stabilize-bg');

      if (isHeavy) {
        beginHeavyUiLoad('Loading harem...', 'Reading saved local data.');
        updateSharedLoader({ title: 'Loading harem...', detail: 'Reading saved local data.', bytes: raw.length });
        await yieldToUi('local-storage-before-parse');
      }

      const parsed = JSON.parse(raw);
      if (isHeavy) {
        updateSharedLoader({ title: 'Loading harem...', detail: 'Preparing saved state...', bytes: raw.length });
        await idleSlice(80);
      }

      const payload = coerceImportedJsonPayload(parsed);
      if (!payload.state || typeof payload.state !== 'object') payload.state = { characters: [] };
      if (!Array.isArray(payload.state.characters)) payload.state.characters = [];

      payload.state.characters = isHeavy
        ? await normalizeImportedCharactersCooperative(payload.state.characters, { chunkSize: 180, bytes: raw.length, title: 'Loading harem...' })
        : payload.state.characters.map((item, index) => normalizeLegacyImportedCharacter(item, index)).filter(Boolean);

      app.originalInput = payload.input || '';
      app.meta = payload.meta || {};
      app.state = payload.state;
      ensureLoadedStateShape();

      if (isHeavy) {
        updateSharedLoader({ title: 'Loading harem...', detail: 'Restoring groups and saved view...', loaded: payload.state.characters.length, total: payload.state.characters.length, bytes: raw.length });
        await idleSlice(80);
      }

      migrateLegacyGroupFieldsFromCharacters();
      hydrateCharacterGroupIdsFromGroups();
      syncGroupsFromCharacters();
      app.pendingInitialViewRestore = loadSavedViewPosition();

      setTimeout(() => {
        document.documentElement.classList.remove('mhp-stabilize-bg');
        document.body?.classList?.remove('mhp-stabilize-bg');
      }, isHeavy ? 1200 : 900);

      if (isHeavy) {
        // Rewrite old/full localStorage payloads into the compact schema after boot.
        // Do it later so the first paint/loading animation is not blocked by JSON.stringify.
        setTimeout(() => {
          try { saveLocalDeferred(250); } catch (_) {}
        }, 1200);
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  function loadLocal() {
    try {
      const raw = getLocalStateRaw();
      if (!raw) return false;
      const payload = normalizeAnyImportedPayloadSafe(JSON.parse(raw));
      if (!payload) return false;

      app.originalInput = payload.input || '';
      app.meta = payload.meta || {};
      app.state = payload.state || { characters: [] };
      ensureLoadedStateShape();
      migrateLegacyGroupFieldsFromCharacters();
      hydrateCharacterGroupIdsFromGroups();
      syncGroupsFromCharacters();
      app.pendingInitialViewRestore = loadSavedViewPosition();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  function stripRuntimeFields(item) {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    delete copy.__searchCache;
    return copy;
  }

  function exportPayload() {
    return createCompactExportPayload();
  }

  async function downloadJson() {
    try {
      syncGroupsFromCharacters();

      if (!window.MudaeJsonIo?.downloadJsonPayload) {
        throw new Error('JSON IO module is not available.');
      }

      const filename = await window.MudaeJsonIo.askJsonDownloadFilename({
        haremName: app.state.haremName,
        showPrompt: showAppPrompt
      });

      if (!filename) return;

      window.MudaeJsonIo.downloadJsonPayload(exportPayload(), filename);
    } catch (error) {
      console.error(error);
      showAppAlert('Could not save JSON: ' + (error?.message || error), {
        title: 'Save JSON failed',
        variant: 'danger'
      });
    }
  }


  // v2.443: accept legacy organizer JSON, full rebuild JSON, and compact rebuild JSON.
  function coerceImportedJsonPayload(rawPayload) {
    const raw = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};

    const pickCharacters = () => {
      if (Array.isArray(raw.characters)) return raw.characters;
      if (Array.isArray(raw.items)) return raw.items;
      if (Array.isArray(raw.harem)) return raw.harem;
      if (Array.isArray(raw.cards)) return raw.cards;
      if (Array.isArray(raw.state?.characters)) return raw.state.characters;
      if (Array.isArray(raw.data?.characters)) return raw.data.characters;
      if (Array.isArray(raw.payload?.characters)) return raw.payload.characters;
      return [];
    };

    const legacyCharacters = pickCharacters();

    const baseState = raw.state && typeof raw.state === 'object'
      ? { ...raw.state }
      : {};

    const state = {
      haremName: raw.haremName || raw.title || raw.name || baseState.haremName || '',
      totalValue: Number(raw.totalValue ?? raw.totalKakera ?? baseState.totalValue ?? 0) || 0,
      counts: raw.counts || baseState.counts || {},
      groups: raw.groups || baseState.groups || {},
      exportAliases: raw.exportAliases || baseState.exportAliases || {},
      settings: raw.settings || baseState.settings || {},
      characters: legacyCharacters
    };

    const payload = {
      input: typeof raw.input === 'string' ? raw.input : '',
      meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
      state
    };

    return payload;
  }

  function normalizeLegacyImportedCharacter(item, index = 0) {
    if (!item || typeof item !== 'object') return item;

    // Divider variants from old organizer.
    const isOldDivider =
      item.type === 'divider' ||
      item.kind === 'divider' ||
      item.isDivider === true ||
      item.divider === true ||
      item.folder === true;

    if (isOldDivider) {
      return normalizeItem({
        ...item,
        type: 'divider',
        title: item.title || item.name || item.label || `Divider ${index + 1}`,
        id: item.id || item.uid || cryptoRandomId?.('divider') || `divider-${Date.now()}-${index}`
      });
    }

    const image =
      item.image ||
      item.imageUrl ||
      item.img ||
      item.url ||
      item.avatar ||
      (Array.isArray(item.images) ? item.images.find(Boolean) : '') ||
      (Array.isArray(item.mudaeImages) ? item.mudaeImages.find(Boolean) : '') ||
      '';

    // Gallery order is absolute. For saved Organizer JSON, `image` is only the
    // current main/char image and must not be prepended to the Mudae gallery.
    // Otherwise selecting #6 as main turns a saved gallery into #6,#1,#2...
    const savedGallerySource = [
      ...(Array.isArray(item.mudaeImages) ? item.mudaeImages : []),
      ...(Array.isArray(item.gallery) ? item.gallery : []),
      ...(Array.isArray(item.images) ? item.images : [])
    ].filter(Boolean);
    const gallery = savedGallerySource.length
      ? mergeGalleryUrlsPreserveAbsoluteOrder(savedGallerySource, [], image)
      : dedupeCharacterImageUrls([image]);

    const normalized = normalizeItem({
      ...item,
      id: item.id || item.uid || item.characterId || item.key || cryptoRandomId?.('char') || `char-${Date.now()}-${index}`,
      name: item.name || item.character || item.charName || '',
      series: item.series || item.anime || item.origin || '',
      type: item.type && item.type !== 'divider' ? item.type : (item.rollType || item.mudaeType || ''),
      rank: item.rank ?? item.claimRank ?? item.claim ?? 0,
      claimRank: item.claimRank ?? item.rank ?? item.claim ?? 0,
      likeRank: item.likeRank ?? item.like ?? 0,
      kakera: item.kakera ?? item.value ?? item.ka ?? 0,
      image,
      imageUrl: image,
      mudaeImages: gallery,
      hasMudaeGallery: dedupeCharacterImageUrls(gallery).length > 1,
      mudaeGalleryCount: dedupeCharacterImageUrls(gallery).length > 1 ? dedupeCharacterImageUrls(gallery).length : 0,
      owner: item.owner || item.user || '',
      note: item.note || item.notes || ''
    });

    if (typeof normalizeCharacterImageGallery === 'function') {
      normalizeCharacterImageGallery(normalized);
    }

    return normalized;
  }

  function normalizeAnyImportedPayload(rawPayload) {
    const payload = coerceImportedJsonPayload(rawPayload);

    if (!payload.state || typeof payload.state !== 'object') {
      payload.state = { characters: [] };
    }

    if (!Array.isArray(payload.state.characters)) {
      payload.state.characters = [];
    }

    payload.state.characters = payload.state.characters
      .map((item, index) => normalizeLegacyImportedCharacter(item, index))
      .filter(Boolean);

    if (typeof rehydrateCompactState === 'function') {
      if (typeof rehydrateCompactState === 'function') {
        rehydrateCompactState(payload.state);
      }
    }
    payload.state.characters.forEach(item => {
      if (!isDivider(item) && typeof normalizeCharacterImageGallery === 'function') {
        normalizeCharacterImageGallery(item);
      }
      if (typeof ensureCharacterIdentity === 'function') {
        ensureCharacterIdentity(item);
      }
    });

    return payload;
  }


  // v2.444: guarantee loaded state has required containers.
  function ensureLoadedStateShape() {
    if (!app.state || typeof app.state !== 'object') {
      app.state = {};
    }

    if (!Array.isArray(app.state.characters)) app.state.characters = [];
    if (!app.state.counts || typeof app.state.counts !== 'object') app.state.counts = {};
    if (!app.state.groups || typeof app.state.groups !== 'object') app.state.groups = {};
    if (!app.state.persistentOrderMap || typeof app.state.persistentOrderMap !== 'object') app.state.persistentOrderMap = {};
    if (!Array.isArray(app.state.orderBaselineIds)) app.state.orderBaselineIds = [];
    if (typeof app.state.haremName !== 'string') app.state.haremName = '';
    if (!Number.isFinite(Number(app.state.totalValue))) app.state.totalValue = 0;

    app.state.characters = app.state.characters.map((item, index) => {
      try {
        const normalized = normalizeItem(item, index);
        if (!isDivider(normalized) && typeof normalizeCharacterImageGallery === 'function') {
          normalizeCharacterImageGallery(normalized);
        }
        if (typeof ensureCharacterIdentity === 'function') ensureCharacterIdentity(normalized);
        return normalized;
      } catch {
        return item;
      }
    }).filter(Boolean);

    return app.state;
  }

  async function importFile(file) {
    beginHeavyUiLoad('Loading JSON...', 'Reading JSON file.');
    updateSharedLoader({ title: 'Loading JSON...', detail: 'Reading JSON file.', bytes: file?.size || 0, json: true });
    await yieldToUi('import-start');
    rememberCurrentlyLoadedImageUrls();
    window.MudaeMinimalImageLoader?.clearStale?.();
    const rawPayload = await window.MudaeJsonIo.readJsonFile(file);
    const payload = normalizeAnyImportedPayloadSafe(rawPayload);
    const importCount = Array.isArray(payload?.state?.characters) ? payload.state.characters.length : 0;
    updateSharedLoader({ title: 'Loading JSON...', detail: 'Importing characters and preparing images.', loaded: 0, total: importCount, bytes: file?.size || 0, json: true });
    app.originalInput = payload.input || '';
    app.meta = payload.meta || {};
    app.state = payload.state;
    ensureLoadedStateShape();
    await normalizeCharactersInChunks(app.state.characters, { chunkSize: 300, bytes: file?.size || 0, title: 'Loading JSON...', detail: 'Importing characters and preparing images.', json: true });
    await yieldToUi('import-normalized');
    migrateLegacyGroupFieldsFromCharacters();
    hydrateCharacterGroupIdsFromGroups();
    preserveKnownCharacterIdentity(app.state.characters);
    syncGroupsFromCharacters();
    saveLocal();
    await renderAllCooperative();
    requestAnimationFrame(() => restoreSavedViewPosition({ attempts: 14, initial: true }));
    app.initialViewRestoreTimers = [
      setTimeout(() => restoreSavedViewPosition({ attempts: 8, initial: true }), 220)
    ];
    await endHeavyUiLoad();
  }


  async function loadIncludedDemoBoard() {
    const demoPath = 'demo/Demo_Board.json';
    let raw = '';

    try {
      const response = await fetch(demoPath, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      raw = await response.text();
    } catch (error) {
      // file:// can block fetch in some browsers. Keep an embedded JSON fallback
      // so the Demo button works both locally and on GitHub Pages.
      raw = document.getElementById('demoBoardJson')?.textContent || '';
    }

    raw = String(raw || '').trim();
    if (!raw) throw new Error('Demo JSON is not available.');

    const file = new File([raw], 'Demo_Board.json', { type: 'application/json' });
    await importFile(file);
  }


  function isJsonLikeFile(file) {
    if (!file) return false;
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    return name.endsWith('.json') || type.includes('json');
  }

  function getJsonFileFromDataTransfer(dataTransfer) {
    const files = Array.from(dataTransfer?.files || []);
    return files.find(isJsonLikeFile) || null;
  }

  function bindJsonDragDrop() {
    if (app.jsonDragDropBound) return;
    app.jsonDragDropBound = true;

    const overlay = document.getElementById('jsonDropOverlay');
    let dragDepth = 0;

    const showDropOverlay = () => {
      if (!overlay) return;
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('mhp-json-drag-active');
    };

    const hideDropOverlay = () => {
      dragDepth = 0;
      if (!overlay) return;
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('mhp-json-drag-active');
    };

    const hasJsonFile = dataTransfer => {
      const items = Array.from(dataTransfer?.items || []);
      if (items.length) {
        return items.some(item => {
          if (item.kind !== 'file') return false;
          const type = String(item.type || '').toLowerCase();
          const file = typeof item.getAsFile === 'function' ? item.getAsFile() : null;
          return type.includes('json') || String(file?.name || '').toLowerCase().endsWith('.json');
        });
      }

      return !!getJsonFileFromDataTransfer(dataTransfer);
    };

    document.addEventListener('dragenter', event => {
      if (!hasJsonFile(event.dataTransfer)) return;
      dragDepth += 1;
      event.preventDefault();
      showDropOverlay();
    }, true);

    document.addEventListener('dragover', event => {
      if (!hasJsonFile(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      showDropOverlay();
    }, true);

    document.addEventListener('dragleave', event => {
      if (!hasJsonFile(event.dataTransfer)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) hideDropOverlay();
    }, true);

    document.addEventListener('drop', async event => {
      const file = getJsonFileFromDataTransfer(event.dataTransfer);
      if (!file) return;

      event.preventDefault();
      event.stopPropagation();
      hideDropOverlay();

      try {
        await importFile(file);
        notifyAppMessage?.(`Loaded JSON: ${file.name || 'dropped file'}`);
      } catch (error) {
        console.error(error);
        showAppAlert('Could not import dropped JSON: ' + (error?.message || error), {
          title: 'Import failed',
          variant: 'danger'
        });
      }
    }, true);

    window.addEventListener('blur', hideDropOverlay);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') hideDropOverlay();
    }, true);
  }


  function recalcStats() {
    const characters = app.state.characters.filter(item => !isDivider(item));
    app.state.totalValue = characters.reduce((sum, ch) => sum + num(ch.kakera), 0);

    const counts = { wa: 0, ha: 0, wg: 0, hg: 0 };
    characters.forEach(ch => {
      const tags = Array.isArray(ch.mudaeTags) ? ch.mudaeTags : inferTags(ch.roulette);
      tags.forEach(tag => {
        if (counts[tag] != null) counts[tag]++;
      });
    });
    app.state.counts = counts;
  }

  function applyStatsExpansionClasses() {
    const cards = {
      characters: els.statsBar.children[0],
      keys: els.statsBar.children[1],
      kakera: els.statsBar.children[2],
      spheres: els.statsBar.children[3]
    };

    Object.entries(cards).forEach(([key, card]) => {
      if (!card) return;
      card.classList.add('stat-expandable');
      card.dataset.statKey = key;
      card.classList.toggle('is-expanded', !!app.expandedStats[key]);
      card.title = app.expandedStats[key] ? 'Click to collapse details' : 'Click to expand details';
    });
  }
  function rememberCurrentlyLoadedImageUrls() {
    app.state.characters.forEach(item => {
      if (isDivider(item)) return;

      const image = item.image || '';
      if (image && hasRealImage(image)) {
        window.MudaeMinimalImageLoader?.rememberLoadedUrl?.(image);
      }

      normalizeUrls(item.mudaeImages).forEach(url => {
        window.MudaeMinimalImageLoader?.rememberLoadedUrl?.(url);
      });
    });

    document.querySelectorAll('img.char-img').forEach(img => {
      const url = img.currentSrc || img.src || img.dataset?.src || '';
      if (url && !url.startsWith('data:')) {
        window.MudaeMinimalImageLoader?.rememberLoadedUrl?.(url);
      }
    });
  }

  function buildExistingCharacterIdentityMap() {
    const byStable = new Map();
    const byNameSeries = new Map();

    app.state.characters.forEach(item => {
      if (isDivider(item)) return;

      const stable = item.stableKey || makeStableKey(item.name, item.series);
      const ns = makeStableKey(item.name, item.series);

      if (stable) byStable.set(stable, item);
      if (ns) byNameSeries.set(ns, item);
    });

    return { byStable, byNameSeries };
  }

  function preserveKnownCharacterIdentity(importedItems, identityMap = buildExistingCharacterIdentityMap()) {
    if (!Array.isArray(importedItems)) return importedItems;

    importedItems.forEach(item => {
      if (isDivider(item)) return;

      const stable = item.stableKey || makeStableKey(item.name, item.series);
      const ns = makeStableKey(item.name, item.series);
      const old = identityMap.byStable.get(stable) || identityMap.byNameSeries.get(ns);

      if (!old) return;

      // Preserve internal identity so matching cards/search/edit links remain stable.
      item.id = old.id || item.id;
      item.stableKey = old.stableKey || item.stableKey || stable;

      // If an old card image was already loaded and the imported URL is the same,
      // the image loader can skip queueing it.
      if (item.image && old.image && item.image === old.image) {
        window.MudaeMinimalImageLoader?.rememberLoadedUrl?.(item.image);
      }

      normalizeUrls(item.mudaeImages).forEach(url => {
        if (normalizeUrls(old.mudaeImages).includes(url)) {
          window.MudaeMinimalImageLoader?.rememberLoadedUrl?.(url);
        }
      });
    });

    return importedItems;
  }


  function getSharedLoaderKind(title = '', options = {}) {
    if (options.parser === true || /parsing/i.test(String(title || ''))) return 'parsing';
    if (options.json === true || /json/i.test(String(title || ''))) return 'json';
    return 'harem';
  }

  function getLoaderCacheBustToken() {
    window.__MHP_LOADER_CACHE_BUST = window.__MHP_LOADER_CACHE_BUST || String(Date.now());
    return window.__MHP_LOADER_CACHE_BUST;
  }

  function withLoaderCacheBust(path) {
    const clean = String(path || '').trim();
    if (!clean || /[?&]mhp_loader_v=/.test(clean)) return clean;
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}mhp_loader_v=${encodeURIComponent(getLoaderCacheBustToken())}`;
  }

  function buildLoaderAssetCandidates(baseName) {
    // v2.672: canonical GIF only. This avoids older PNG/WEBP/numbered variants
    // being shown after the user replaces assets/loaders/loading-harem.gif.
    return [withLoaderCacheBust(`assets/loaders/${baseName}.gif`)];
  }


  function getSharedLoaderAssetConfig(kind = 'harem') {
    const normalized = String(kind || 'harem').toLowerCase();
    const cacheKey = `loaderAssetChain:${normalized}`;
    window.__mhpLoaderAssetChains = window.__mhpLoaderAssetChains || {};
    if (window.__mhpLoaderAssetChains[cacheKey]) {
      const cached = window.__mhpLoaderAssetChains[cacheKey];
      return { src: cached[0], fallbacks: cached.slice(1) };
    }

    const harem = buildLoaderAssetCandidates('loading-harem');
    let chain;
    if (normalized === 'parsing') {
      chain = buildLoaderAssetCandidates('parsing-harem').concat(harem);
    } else if (normalized === 'json') {
      chain = buildLoaderAssetCandidates('loading-json').concat(harem);
    } else {
      chain = harem;
    }

    // Last-resort canonical GIF keeps the old single-file setup reliable.
    chain = Array.from(new Set(chain.concat([
      withLoaderCacheBust('assets/loaders/loading-harem.gif')
    ])));

    window.__mhpLoaderAssetChains[cacheKey] = chain;
    return { src: chain[0], fallbacks: chain.slice(1) };
  }

  function setSharedLoaderAsset(overlay, kind = 'harem') {
    if (!overlay) return;
    const img = overlay.querySelector('.mhp-loader-img');
    const slot = overlay.querySelector('.mhp-loader-asset-slot');
    if (!img) return;
    const config = getSharedLoaderAssetConfig(kind);
    const fallbackText = config.fallbacks.join('|');
    const previousKind = String(overlay.dataset.loaderKind || '');
    const previousFallbacks = String(img.dataset.fallbacks || '');
    const currentSrc = String(img.getAttribute('src') || '');
    const sameAssetChain = previousKind === kind && previousFallbacks === fallbackText && currentSrc;

    overlay.dataset.loaderKind = kind;

    // Do not restart the fallback chain on every progress update.
    // Loading JSON can update the loader many times while loading-json.gif is missing;
    // resetting here would keep it stuck on the missing primary asset forever instead
    // of allowing it to fall back to loading-harem.gif.
    if (sameAssetChain) {
      if (slot && !slot.classList.contains('is-missing')) {
        img.hidden = false;
        img.removeAttribute('hidden');
      }
      try { window.MHPWireAssetFallbacks?.(); } catch (_) {}
      return;
    }

    if (slot) slot.classList.remove('is-missing');
    img.hidden = false;
    img.removeAttribute('hidden');
    img.dataset.fallbacks = fallbackText;
    img.dataset.fallbackIndex = '0';
    try { window.MHPResetLoaderAssetFallback?.(img); } catch (_) {}
    if (img.getAttribute('src') !== config.src) {
      img.src = config.src;
    }
    try { window.MHPWireAssetFallbacks?.(); } catch (_) {}
  }

  function showAppLoading(title = 'Loading harem...', detail = 'Preparing characters and images.') {
    const root = document.documentElement;
    resetSharedLoaderProgress();

    if (app.loadingOverlayTimer) {
      clearTimeout(app.loadingOverlayTimer);
      app.loadingOverlayTimer = null;
    }

    const loaderKind = getSharedLoaderKind(title);
    const isParserLoading = loaderKind === 'parsing';
    const isJsonLoading = loaderKind === 'json';

    // During initial boot, use the boot loader itself as the loading UI.
    // This prevents the visible two-step swap: old boot card -> app overlay card.
    if (!isParserLoading && root.classList.contains('mhp-booting')) {
      const boot = document.getElementById('mhpBootLoader');
      if (boot) {
        const bootTitle = boot.querySelector('.mhp-boot-loader-title');
        const bootSubtitle = boot.querySelector('.mhp-boot-loader-subtitle');
        if (bootTitle) bootTitle.textContent = title || 'Loading harem...';
        if (bootSubtitle) bootSubtitle.textContent = detail || 'Preparing your collection';
        boot.classList.add('is-app-loading');
        boot.removeAttribute('aria-hidden');
        boot.hidden = false;
        setSharedLoaderAsset(boot, loaderKind);
      }

      if (els.appLoadingOverlay) {
        els.appLoadingOverlay.hidden = true;
        els.appLoadingOverlay.setAttribute('hidden', '');
        els.appLoadingOverlay.classList.remove('is-parser-loading', 'is-json-loading');
      }

      root.classList.add('app-is-loading');
      root.classList.remove('mhp-parser-loading-overlay');
      updateSharedLoader({ title, detail });
      return;
    }

    if (!els.appLoadingOverlay) return;

    if (els.appLoadingTitle) els.appLoadingTitle.textContent = title;
    if (els.appLoadingDetail) els.appLoadingDetail.textContent = detail;

    els.appLoadingOverlay.classList.toggle('is-parser-loading', isParserLoading);
    els.appLoadingOverlay.classList.toggle('is-json-loading', isJsonLoading);
    root.classList.toggle('mhp-parser-loading-overlay', isParserLoading);
    root.classList.toggle('mhp-json-loading-overlay', isJsonLoading);
    setSharedLoaderAsset(els.appLoadingOverlay, loaderKind);

    els.appLoadingOverlay.hidden = false;
    els.appLoadingOverlay.removeAttribute('hidden');
    root.classList.add('app-is-loading');
    updateSharedLoader({ title, detail, parser: isParserLoading });
  }

  function hideAppLoading() {
    if (!els.appLoadingOverlay) return;

    if (app.loadingOverlayTimer) {
      clearTimeout(app.loadingOverlayTimer);
      app.loadingOverlayTimer = null;
    }

    els.appLoadingOverlay.hidden = true;
    els.appLoadingOverlay.classList.remove('is-parser-loading', 'is-json-loading');
    document.documentElement.classList.remove('app-is-loading', 'mhp-parser-loading-overlay', 'mhp-json-loading-overlay');
  }

  function showAppDialog(options = {}) {
    return window.MudaeDialogUtils?.showDialog?.(options) ?? Promise.resolve(null);
  }

  function showAppAlert(message, options = {}) {
    return window.MudaeDialogUtils?.alert?.(message, options) ?? showAppDialog({ type: 'alert', message });
  }

  function showAppConfirm(message, options = {}) {
    if (window.MudaeDialogUtils?.confirm) return window.MudaeDialogUtils.confirm(message, options);
    return Promise.resolve(window.confirm(String(options.title ? options.title + '\n\n' + message : message)));
  }

  function showAppPrompt(message, defaultValue = '', options = {}) {
    if (window.MudaeDialogUtils?.prompt) return window.MudaeDialogUtils.prompt(message, defaultValue, options);
    const value = window.prompt(String(options.title ? options.title + '\n\n' + message : message), defaultValue);
    return Promise.resolve(value);
  }

  function waitFrame(count = 1) {
    return new Promise(resolve => {
      const step = () => {
        count--;
        if (count <= 0) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function collectInitialHaremImageUrls() {
    const urls = [];
    const seen = new Set();

    const addUrl = raw => {
      const url = String(raw || '').trim();
      if (!url || url.startsWith('data:')) return;
      if (!hasRealImage(url)) return;
      if (seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    };

    (app.state.characters || []).forEach(item => {
      if (!item || isDivider(item)) return;
      addUrl(item.image);
    });

    return urls;
  }

  function waitInitialHaremImageUrls(timeoutMs = 180000) {
    const urls = collectInitialHaremImageUrls();
    const loader = window.MudaeMinimalImageLoader;

    if (!urls.length || !loader) {
      return Promise.resolve({ loaded: 0, resolved: 0, total: urls.length, timedOut: false });
    }

    try {
      loader.forceLoadAll?.(urls);
    } catch (error) {
      console.warn('[MHP] Could not queue full harem image preload:', error);
    }

    let lastResolved = -1;
    let lastBucket = -1;

    const countResolved = () => {
      let loaded = 0;
      let failed = 0;

      urls.forEach(url => {
        if (loader.hasLoadedUrl?.(url)) {
          loaded++;
          return;
        }

        if (loader.hasFailedUrl?.(url)) {
          failed++;
        }
      });

      return {
        loaded,
        failed,
        resolved: loaded + failed,
        total: urls.length
      };
    };

    const publishProgress = (force = false) => {
      const stats = countResolved();
      const bucket = stats.total ? Math.floor((stats.resolved / stats.total) * 100 / 2) : 0;

      if (!force && stats.resolved === lastResolved && bucket === lastBucket) return stats;

      lastResolved = stats.resolved;
      lastBucket = bucket;

      try {
        updateSharedLoader({
          title: 'Loading harem...',
          detail: stats.failed
            ? `Preloading harem images ${stats.resolved}/${stats.total} · failed ${stats.failed}`
            : `Preloading harem images ${stats.resolved}/${stats.total}`,
          loaded: stats.resolved,
          total: stats.total
        });
      } catch (_) {}

      return stats;
    };

    return new Promise(resolve => {
      let done = false;
      let timedOut = false;

      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearInterval(interval);
        const stats = publishProgress(true);
        resolve({ ...stats, timedOut });
      };

      const check = () => {
        const stats = publishProgress(false);
        if (stats.resolved >= stats.total) finish();
      };

      const timer = setTimeout(() => {
        timedOut = true;
        finish();
      }, timeoutMs);

      const interval = setInterval(check, 180);

      publishProgress(true);
      check();
      requestAnimationFrame(check);
      setTimeout(check, 500);
    });
  }

  function waitInitialVisibleImages(timeoutMs = 60000) {
    const board = els.board;
    if (!board) return Promise.resolve({ loaded: 0, total: 0, timedOut: false });

    const candidates = Array.from(board.querySelectorAll('.char-img'))
      .filter(img => {
        const src = img.dataset?.src || img.currentSrc || img.src || '';
        if (!src || src.startsWith('data:')) return false;
        return true;
      });

    if (!candidates.length) return Promise.resolve({ loaded: 0, total: 0, timedOut: false });

    const total = candidates.length;
    let lastProgress = -1;

    const isReady = img => {
      if (!img) return true;
      if (img.classList.contains('gif-paused')) return true;
      if (img.dataset?.src) return false;
      if (!img.src && !img.currentSrc) return true;
      return img.complete === true;
    };

    const publishProgress = (loaded, force = false) => {
      const percentBucket = total ? Math.floor((loaded / total) * 100 / 5) : 0;
      if (!force && percentBucket === lastProgress) return;
      lastProgress = percentBucket;
      try {
        updateSharedLoader({
          title: 'Loading harem...',
          detail: `Loading card images ${loaded}/${total}`,
          loaded,
          total
        });
      } catch (_) {}
    };

    return new Promise(resolve => {
      let done = false;
      let timedOut = false;

      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearInterval(interval);
        const loaded = candidates.filter(isReady).length;
        publishProgress(loaded, true);
        resolve({ loaded, total, timedOut });
      };

      const check = () => {
        const loaded = candidates.filter(isReady).length;
        publishProgress(loaded);
        if (loaded >= total) finish();
      };

      const timer = setTimeout(() => {
        timedOut = true;
        finish();
      }, timeoutMs);

      const interval = setInterval(check, 160);

      candidates.forEach(img => {
        img.loading = 'eager';
        img.fetchPriority = 'high';
        img.addEventListener('load', check, { once: true });
        img.addEventListener('error', check, { once: true });
        if (img.dataset?.src) {
          window.MudaeMinimalImageLoader?.load?.(img);
        }
      });

      // During the initial harem loader, preload every currently mounted card,
      // not only the first viewport. With a visible-card limit of 300 this makes
      // the overlay wait for those 300 mounted card images before disappearing.
      window.MudaeMinimalImageLoader?.releaseVisible?.(board, { ahead: 999999, behind: 999999, max: candidates.length });
      window.MudaeGifControl?.refresh?.();

      publishProgress(0, true);
      check();
      requestAnimationFrame(check);
      setTimeout(check, 250);
      setTimeout(check, 800);
    });
  }

  function hardFinishLoadingState(reason = '') {
    try { hideAppLoading(); } catch (_) {}

    const root = document.documentElement;
    const body = document.body;

    root.classList.remove('app-is-loading', 'mhp-heavy-loading', 'mhp-stabilize-bg');
    body?.classList?.remove('mhp-heavy-loading', 'mhp-stabilize-bg');

    // The separate boot loader can be forced visible by old CSS while
    // mhp-heavy-loading is present. Make the final state explicit so it cannot
    // remain stuck after renderAll already finished.
    window.__mhpBootCanFinish = true;
    window.__mhpPendingBootFinish = false;
    root.classList.remove('mhp-booting');
    root.classList.add('mhp-ready');

    const bootLoader = document.getElementById('mhpBootLoader');
    if (bootLoader) {
      bootLoader.classList.add('is-hiding');
      bootLoader.setAttribute('aria-hidden', 'true');
      bootLoader.style.pointerEvents = 'none';
    }

    if (els.appLoadingOverlay) {
      els.appLoadingOverlay.hidden = true;
      els.appLoadingOverlay.setAttribute('hidden', '');
    }

    window.__mhpLastLoadingFinishReason = reason || 'unknown';
  }

  async function finishLargeLoadOverlay(reason = 'large-load') {
    document.documentElement.dataset.mhpImageGate = '1';
    try {
      await waitFrame(2);

      // v2.597: the boot loader must represent the real harem being ready, not
      // only the first mounted virtual window. Preload every primary character
      // image in the data model while the overlay is still up. Cards outside the
      // visible-card window stay unmounted, but their images are already in the
      // browser/cache when Home/End/PageDown jumps mount them later.
      const fullImageResult = await waitInitialHaremImageUrls(180000);
      if (fullImageResult?.timedOut) {
        console.warn(`[MHP] Full harem image preload timed out after ${fullImageResult.resolved}/${fullImageResult.total} images.`);
      }

      window.MudaeMinimalImageLoader?.releaseVisible?.(els.board, { ahead: 999999, behind: 999999, max: 10000 });
      window.MudaeGifControl?.refresh?.();

      const result = await waitInitialVisibleImages(60000);
      if (result?.timedOut) {
        console.warn(`[MHP] Loading harem image warmup timed out after ${result.loaded}/${result.total} images.`);
      }
    } catch (error) {
      console.warn('[MHP] Loading overlay finish recovered after error:', error);
    } finally {
      delete document.documentElement.dataset.mhpImageGate;
      hardFinishLoadingState(reason);
    }
  }


  function updateStatsBar() {
    const characters = app.state.characters.filter(item => !isDivider(item));
    const keyBreakdown = getKeyBreakdown(characters);
    const charBreakdown = getCharacterBreakdowns(characters);
    const totalSpheres = characters.reduce((sum, ch) => sum + getSphereTotal(ch.spheres), 0);

    const avgKakera = characters.length ? Math.round(num(app.state.totalValue) / characters.length) : 0;
    const topKakera = getTopKakeraCharacter(characters);
    const sphereBreakdownData = getSpherePerkBreakdown(characters);

    els.statsBar.children[0].querySelector('strong').textContent = fmt(characters.length);
    els.statsBar.children[0].title = `Characters: ${fmt(app.state.boardCounts?.characters || characters.length)} · Dividers: ${fmt(app.state.boardCounts?.dividers || 0)} · Sub-dividers: ${fmt(app.state.boardCounts?.subdividers || 0)}`;
    els.statsBar.children[1].querySelector('strong').textContent = fmt(keyBreakdown.total);
    els.statsBar.children[2].querySelector('strong').textContent = fmt(app.state.totalValue);
    els.statsBar.children[3].querySelector('strong').textContent = fmt(totalSpheres);

    const kakeraBreakdown = document.getElementById('kakeraBreakdown');
    if (kakeraBreakdown) {
      kakeraBreakdown.innerHTML = `
        <div class="stat-detail-row">
          <span>Avg value</span>
          <b>${fmt(avgKakera)} ka</b>
        </div>
        <button class="top-character-link" type="button" title="Filter search to this character" data-character-id="${topKakera ? topKakera.id : ''}" ${topKakera ? '' : 'disabled'}>
          <span>Top</span>
          <b>${topKakera ? escapeHtml(topKakera.name) : '—'}</b>
          <em>${topKakera ? fmt(topKakera.kakera) + ' ka' : ''}</em>
        </button>
      `;
    }

    const sphereBreakdown = document.getElementById('sphereBreakdown');
    if (sphereBreakdown) {
      const perks = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
        .filter(p => sphereBreakdownData.perks[p] > 0)
        .slice(0, 6);

      sphereBreakdown.innerHTML = `
        <div class="sphere-max-line"><span>SP MAX</span><b>${fmt(sphereBreakdownData.max)}</b></div>
        <div class="sphere-perk-grid">
          ${perks.map(p => `<span class="sphere-perk-chip"><b>P${p}</b>${fmt(sphereBreakdownData.perks[p])}</span>`).join('')}
        </div>
      `;
    }

    const boardStructureEl = document.getElementById('boardStructureBreakdown');
    if (boardStructureEl) {
      const counts = app.state.boardCounts || {};
      boardStructureEl.innerHTML = `
        <span class="breakdown-label">Board</span>
        <span class="mini-breakdown-item board-character-count" title="Real characters"><b>Chars</b>${fmt(counts.characters || characters.length)}</span>
        <span class="mini-breakdown-item board-divider-count" title="Top-level dividers"><b>Div</b>${fmt(counts.dividers || 0)}</span>
        <span class="mini-breakdown-item board-subdivider-count" title="Sub-dividers"><b>Sub</b>${fmt(counts.subdividers || 0)}</span>
      `;
    }

    const genderEl = document.getElementById('genderBreakdown');
    if (genderEl) {
      genderEl.innerHTML = `<span class="breakdown-label">Gender</span>` + ['waifu', 'husbando', 'both'].map(type => {
        const value = charBreakdown.gender[type];
        return `<span class="mini-breakdown-item gender-${type}" title="${genderLabel(type)}">
          <b>${genderShortLabel(type)}</b><span>${fmt(value)}</span>
        </span>`;
      }).join('');
    }

    const rouletteEl = document.getElementById('rouletteBreakdown');
    if (rouletteEl) {
      rouletteEl.innerHTML = `<span class="breakdown-label">Type</span>` + ['animanga', 'game', 'both'].map(type => {
        const value = charBreakdown.roulette[type];
        return `<span class="mini-breakdown-item roulette-${type}" title="${rouletteWorldLabel(type)}">
          <b>${rouletteWorldShortLabel(type)}</b><span>${fmt(value)}</span>
        </span>`;
      }).join('');
    }

    const breakdownEl = document.getElementById('keyBreakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = ['bronze', 'silver', 'gold', 'chaos'].map(type => {
        const value = keyBreakdown[type];
        return `<span class="key-breakdown-item ${type}" title="${getKeyLabel(type)} keys">
          <img src="${KEY_ICONS[type]}" alt="${getKeyLabel(type)} key" onerror="this.remove()">
          <b>${fmt(value)}</b>
        </span>`;
      }).join('');
    }

    applyStatsExpansionClasses();

    const displayHaremName = str(app.state.haremName).trim();
    els.haremTitle.textContent = displayHaremName
      ? `${displayHaremName} · ${fmt(characters.length)} characters · ${fmt(keyBreakdown.total)} keys · ${fmt(app.state.totalValue)} ka · ${fmt(totalSpheres)} SP`
      : `${fmt(characters.length)} characters · ${fmt(keyBreakdown.total)} keys · ${fmt(app.state.totalValue)} ka · ${fmt(totalSpheres)} SP`;

    document.title = displayHaremName || 'Mudae Harem Organizer Final';

  }

  function normalizeSearchText(value) {
    return str(value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseSearchTokens(query = getActiveSearchQuery()) {
    const raw = String(query || '').trim();
    if (!raw) return [];

    const tokens = [];
    let current = '';
    let quote = false;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];

      if (ch === '"') {
        quote = !quote;
        current += ch;
        continue;
      }

      if (ch === ',' && !quote) {
        if (current.trim()) tokens.push(current.trim());
        current = '';
        continue;
      }

      current += ch;
    }

    if (current.trim()) tokens.push(current.trim());
    return tokens;
  }

  function unquoteSearchValue(value) {
    const text = String(value || '').trim();
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1).trim();
    }
    return text;
  }

  function parseSearchTerm(rawTerm) {
    const raw = String(rawTerm || '').trim();
    const normalizedRaw = normalizeSearchText(raw);
    const fieldMatch = raw.match(/^([a-z]+):(.+)$/i);

    if (fieldMatch) {
      let field = fieldMatch[1].toLowerCase();
      if (field === 'dividers') field = 'divider';
      if (field === 'character' || field === 'characters' || field === 'char') field = 'name';
      const rawValue = fieldMatch[2].trim();
      const exact = rawValue.startsWith('"') && rawValue.endsWith('"');
      const value = normalizeSearchText(unquoteSearchValue(rawValue));

      return {
        raw,
        term: normalizedRaw,
        field,
        value,
        exact
      };
    }

    const exact = raw.startsWith('"') && raw.endsWith('"');
    const value = normalizeSearchText(unquoteSearchValue(raw));

    return {
      raw,
      term: normalizedRaw,
      field: exact ? 'name' : null,
      value,
      exact
    };
  }

  function getSearchTermObjects() {
    return parseSearchTokens()
      .map(parseSearchTerm)
      .filter(item => {
        if (!item.value) return false;
        if (item.field && item.field.startsWith('gender')) return true;
        return item.value.length >= app.searchMinChars;
      });
  }

  function getSearchTerms() {
    return getSearchTermObjects().map(item => item.term);
  }

  function characterSearchHaystack(item) {
    const tags = getRouletteTags(item);
    const gender = getGenderType(item);
    const world = getRouletteWorldType(item);

    return normalizeSearchText([
      item.name,
      item.series,
      item.owner,
      item.note,
      item.roulette,
      item.globalRank,
      item.kakera,
      item.keys,
      ...(Array.isArray(item.mudaeTags) ? item.mudaeTags : []),
      ...tags,
      // Gender labels intentionally not included in plain text search.
      // Use gender:waifu, gender:female, gender:husbando, gender:male or gender:both.
      // Roulette-world labels intentionally not included in text search.
      // Search "both" is reserved for gender Both.
      world === 'animanga' ? 'animanga-type' : '',
      world === 'game' ? 'game-type' : '',
      world === 'both' ? 'mixed-roulette-type' : ''
    ].join(' '));
  }

  function dividerSearchHaystack(item) {
    return normalizeSearchText([
      item.title,
      item.note,
      item.level
    ].join(' '));
  }

  function invalidateSearchCache() {
    app.searchCacheVersion++;
  }

  function setRuntimeSearchCache(item, text) {
    Object.defineProperty(item, '__searchCache', {
      value: { version: app.searchCacheVersion, text },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  function getCachedCharacterSearchHaystack(item) {
    if (!item) return '';

    const cache = item.__searchCache;
    if (cache && cache.version === app.searchCacheVersion) {
      return cache.text;
    }

    const text = characterSearchHaystack(item);
    setRuntimeSearchCache(item, text);
    return text;
  }

  function getCachedDividerSearchHaystack(item) {
    if (!item) return '';

    const cache = item.__searchCache;
    if (cache && cache.version === app.searchCacheVersion) {
      return cache.text;
    }

    const text = dividerSearchHaystack(item);
    setRuntimeSearchCache(item, text);
    return text;
  }

  function isExactNameSearch(search) {
    return search?.exact && search?.field === 'name';
  }

  function characterNameEqualsSearch(item, search) {
    return normalizeSearchText(item?.name || '') === search.value;
  }

  function getSearchPriorityNameTerms() {
    const termObjects = getSearchTermObjects();

    // Ordered search: when the query combines an exact quoted name with other
    // comma-separated filters, show the exact character match first, then the
    // rest of the filtered results in normal board order.
    // Example: "himari", series:madoka
    if (termObjects.length < 2) return [];

    return termObjects.filter(isExactNameSearch);
  }

  function getSearchPriorityRank(item, priorityTerms) {
    if (!priorityTerms.length || isDivider(item)) return Infinity;

    const index = priorityTerms.findIndex(search => characterNameEqualsSearch(item, search));
    return index >= 0 ? index : Infinity;
  }

  function itemMatchesSearch(item, terms) {
    const termObjects = getSearchTermObjects();
    if (!termObjects.length) return true;

    const hay = isDivider(item)
      ? getCachedDividerSearchHaystack(item)
      : getCachedCharacterSearchHaystack(item);

    return termObjects.some(search => {
      if (!isDivider(item)) {
        const gender = getGenderType(item);

        // Plain quoted searches like "himari" are exact character-name searches.
        // They must not fall through to the general haystack includes search.
        if (isExactNameSearch(search)) {
          return characterNameEqualsSearch(item, search);
        }

        if (search.field === 'gender') {
          if (['both'].includes(search.value)) return gender === 'both';
          if (['waifu', 'female'].includes(search.value)) return gender === 'waifu';
          if (['husbando', 'male'].includes(search.value)) return gender === 'husbando';
          return false;
        }

        if (search.field === 'name') {
          const name = normalizeSearchText(item.name || '');
          return search.exact ? name === search.value : name.includes(search.value);
        }

        if (search.field === 'series' || search.field === 'serie') {
          const series = normalizeSearchText(item.series || '');
          return search.exact ? series === search.value : series.includes(search.value);
        }

        if (search.field === 'owner') {
          const owner = normalizeSearchText(item.owner || '');
          return search.exact ? owner === search.value : owner.includes(search.value);
        }

        if (search.field === 'note') {
          const note = normalizeSearchText(item.note || '');
          return search.exact ? note === search.value : note.includes(search.value);
        }
      } else {
        if (search.field === 'divider') {
          const title = normalizeSearchText(item.title || '');
          return search.exact ? title === search.value : title.includes(search.value);
        }

        // Exact name searches are for characters only.
        if (isExactNameSearch(search)) return false;
      }

      if (search.field) return false;

      return hay.includes(search.value);
    });
  }




  function characterPassesTypeFilter(item) {
    const type = app.filter.type;

    if (type === 'all') return true;
    if (type === 'gallery') return normalizeUrls(item.mudaeImages).length > 0;
    if (type === 'noimage') return !hasRealImage(item.image);

    if (type.startsWith('gender:')) {
      return getGenderType(item) === type.slice('gender:'.length);
    }

    if (type.startsWith('world:')) {
      return getRouletteWorldType(item) === type.slice('world:'.length);
    }

    const tags = getRouletteTags(item);
    return tags.includes(type);
  }

  function passesFilter(item) {
    if (isDivider(item)) return !getSearchTerms().length;

    const terms = getSearchTerms();
    if (!itemMatchesSearch(item, terms)) return false;

    return characterPassesTypeFilter(item);
  }

  function dividerDirectlyMatchesSearch(startIndex, terms) {
    if (!terms.length) return false;

    const divider = app.state.characters[startIndex];
    return isDivider(divider) && itemMatchesSearch(divider, terms);
  }

  function getDividerLevel(item) {
    return Math.max(1, num(item?.level) || 1);
  }

  // If a divider directly matches the search, show the items inside that divider section.
  // This expands divider matches only, not character matches.
  // v2.199: support nested dividers. Example:
  //   "kanna akizono", divider:hentai
  // should show the exact character first, then every item under the Hentai divider,
  // even when those items are inside sub-dividers below it.
  function isInsideMatchedDividerSection(index, terms) {
    if (!terms.length || index <= 0) return false;

    let childLevel = isDivider(app.state.characters[index])
      ? getDividerLevel(app.state.characters[index])
      : Infinity;

    for (let i = index - 1; i >= 0; i--) {
      const item = app.state.characters[i];
      if (!isDivider(item)) continue;

      const dividerLevel = getDividerLevel(item);
      if (dividerLevel >= childLevel) continue;

      // Important:
      // Only a divider's own title/note can cause its section to show.
      // A matching character inside the section must NOT make every sibling visible.
      if (dividerDirectlyMatchesSearch(i, terms)) return true;

      childLevel = dividerLevel;
      if (childLevel <= 1) break;
    }

    return false;
  }


  function debugSearch(query = app.filter.q, type = app.filter.type) {
    const oldQ = app.filter.q;
    const oldType = app.filter.type;

    app.filter.q = normalizeSearchText(query);
    app.filter.type = type || 'all';

    const terms = getSearchTerms();
    const rows = app.state.characters.map((item, index) => {
      if (isDivider(item)) {
        return {
          index,
          kind: 'divider',
          title: item.title,
          directMatch: itemMatchesSearch(item, terms),
          rendered: !terms.length || itemMatchesSearch(item, terms)
        };
      }

      const directMatch = itemMatchesSearch(item, terms);
      const sectionMatch = isInsideMatchedDividerSection(index, terms);
      const typeMatch = characterPassesTypeFilter(item);

      return {
        index,
        kind: 'character',
        name: item.name,
        series: item.series,
        gender: getGenderType(item),
        world: getRouletteWorldType(item),
        tags: getRouletteTags(item),
        directMatch,
        sectionMatch,
        typeMatch,
        rendered: (!terms.length || directMatch || sectionMatch) && typeMatch
      };
    });

    app.filter.q = oldQ;
    app.filter.type = oldType;

    console.table(rows.filter(row => row.rendered || row.directMatch || row.sectionMatch).slice(0, 100));
    return rows;
  }


  function getActiveSearchQuery() {
    return (app.filter.q || '').trim();
  }

  function queueBoardRender() {
    if (app.searchTimer) clearTimeout(app.searchTimer);
    app.searchTimer = setTimeout(() => {
      app.searchTimer = null;
      renderBoard();
    }, 90);
  }
  function notifyAppMessage(message) {
    if (!message) return;

    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }

    if (typeof showNotification === 'function') {
      showNotification(message);
      return;
    }

    console.info(message);
  }
  function getFirstVisibleCharacterDisplayPosition() {
    assignBoardCounters();

    const visible = Array.from(els.board?.querySelectorAll?.('.char-card[data-id]') || []);
    const first = visible.find(node => node.dataset.id);

    if (!first) return Math.max(1, getCharacterCount());

    const ch = getCharacter(first.dataset.id);
    return ch?.displayIndex || getCharacterListPosition(first.dataset.id) || 1;
  }
  function captureCharacterAnchorByDisplayPosition(position) {
    return window.MudaeDividers?.getDividerCreationAnchor?.({ position: 'exact', exact: position }) ?? captureBoardVisualAnchor();
  }
  function getDividerCreationAnchor(config) {
    return window.MudaeDividers?.getDividerCreationAnchor?.(config) ?? captureBoardVisualAnchor();
  }




  function captureBoardVisualAnchor() {
    const board = els.board;

    if (!board) return null;

    const viewportTop = 0;
    const viewportBottom = window.innerHeight || document.documentElement.clientHeight || 800;
    const candidates = Array.from(board.querySelectorAll('.char-card[data-id]'));

    let best = null;
    let bestDistance = Infinity;

    for (const node of candidates) {
      const rect = node.getBoundingClientRect();

      if (rect.bottom < 0 || rect.top > viewportBottom) continue;

      const distance = Math.abs(rect.top - Math.max(80, viewportTop + 80));

      if (distance < bestDistance) {
        bestDistance = distance;
        best = {
          id: node.dataset.id,
          top: rect.top
        };
      }
    }

    if (best) return best;

    const first = candidates.find(node => node.dataset.id);

    return first ? {
      id: first.dataset.id,
      top: first.getBoundingClientRect().top
    } : null;
  }

  function getCurrentViewPositionSnapshot() {
    const anchor = captureBoardVisualAnchor();
    return {
      scrollY: Math.max(0, window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0),
      anchorId: anchor?.id || '',
      anchorTop: Number.isFinite(anchor?.top) ? anchor.top : null,
      filterQ: app.filter?.q || '',
      filterType: app.filter?.type || 'all',
      savedAt: Date.now()
    };
  }

  function saveViewPositionNow() {
    if (Date.now() < (app.suppressViewPositionSaveUntil || 0)) return false;

    try {
      const snapshot = getCurrentViewPositionSnapshot();
      app.lastSavedViewPosition = snapshot;
      localStorage.setItem(VIEW_POSITION_KEY, JSON.stringify(snapshot));
      return true;
    } catch (error) {
      console.warn('Could not save view position:', error);
      return false;
    }
  }

  function scheduleViewPositionSave() {
    if (Date.now() < (app.suppressViewPositionSaveUntil || 0)) return;
    if (app.viewPositionSaveTimer) clearTimeout(app.viewPositionSaveTimer);
    app.viewPositionSaveTimer = setTimeout(() => {
      app.viewPositionSaveTimer = null;
      saveViewPositionNow();
    }, 160);
  }

  function loadSavedViewPosition() {
    try {
      const raw = localStorage.getItem(VIEW_POSITION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (error) {
      console.warn('Could not load view position:', error);
      return null;
    }
  }

  function cancelInitialViewRestore(reason = 'interaction') {
    app.initialViewRestoreCancelled = true;
    app.pendingInitialViewRestore = null;

    if (Array.isArray(app.initialViewRestoreTimers)) {
      app.initialViewRestoreTimers.forEach(timer => clearTimeout(timer));
      app.initialViewRestoreTimers = [];
    }

    if (Array.isArray(app.savedViewRestoreTimers)) {
      app.savedViewRestoreTimers.forEach(timer => clearTimeout(timer));
      app.savedViewRestoreTimers = [];
    }

    return reason;
  }

  function markUserViewInteraction(reason = 'interaction') {
    app.userInteractedSinceBoot = true;
    cancelInitialViewRestore(reason);

    if (/search|jump/i.test(String(reason || ''))) {
      clearVirtualBoardAnchorsForSearch(reason);
    }
  }

  function clearVirtualBoardAnchorsForSearch(reason = 'search') {
    app.virtualBoardAnchorId = null;
    app.virtualBoardAnchorScrollOffset = 0;
    app.virtualBoardLastRange = null;
    app.virtualLastScrollTop = -1;
    app.searchClearAnchorId = null;
    app.searchClearAnchorTop = null;
    return reason;
  }

  function restoreSavedViewPosition(options = {}) {
    const snapshot = options.snapshot || app.pendingInitialViewRestore || loadSavedViewPosition();
    if (!snapshot) return false;

    app.pendingInitialViewRestore = null;

    // Do not force a saved full-list location after the user has already started
    // interacting, searching, or jumping. This fixes stale initial restore sending
    // the user from a search result (#1200) back to an older saved zone (#869).
    const currentQuery = getActiveSearchQuery?.() || app.filter?.q || '';
    if (options.initial && (app.initialViewRestoreCancelled || app.userInteractedSinceBoot)) return false;
    if (currentQuery && currentQuery !== (snapshot.filterQ || '')) return false;

    app.suppressViewPositionSaveUntil = Date.now() + 1200;
    app.__allowInitialRestoreScroll = true;
    setTimeout(() => { app.__allowInitialRestoreScroll = false; }, 900);

    const anchor = snapshot.anchorId
      ? { id: snapshot.anchorId, top: Number.isFinite(snapshot.anchorTop) ? snapshot.anchorTop : 90 }
      : null;

    if (anchor?.id) {
      const shouldAbortSavedRestore = () => {
        const liveQuery = getActiveSearchQuery?.() || app.filter?.q || '';
        if (options.initial && (app.initialViewRestoreCancelled || app.userInteractedSinceBoot)) return true;
        if (liveQuery && liveQuery !== (snapshot.filterQ || '')) return true;
        return false;
      };

      const runRestoreAttempt = (attempts = 4) => {
        if (shouldAbortSavedRestore()) return false;
        window.MudaeBoardController?.updateEntriesFromApp?.();
        window.MudaeBoardController?.renderAroundId?.(anchor.id, { scroll: false, highlight: false });
        return restoreBoardVisualAnchor(anchor, { attempts, highlight: false });
      };

      runRestoreAttempt(Number(options.attempts) || 12);

      requestAnimationFrame(() => runRestoreAttempt(4));

      app.savedViewRestoreTimers = [
        setTimeout(() => runRestoreAttempt(4), 160),
        setTimeout(() => runRestoreAttempt(3), 420)
      ];

      return true;
    }

    if (Number.isFinite(snapshot.scrollY)) {
      const runScrollRestore = () => {
        const liveQuery = getActiveSearchQuery?.() || app.filter?.q || '';
        if (options.initial && (app.initialViewRestoreCancelled || app.userInteractedSinceBoot)) return;
        if (liveQuery && liveQuery !== (snapshot.filterQ || '')) return;
        window.scrollTo({ top: Math.max(0, snapshot.scrollY), behavior: 'auto' });
      };

      runScrollRestore();
      requestAnimationFrame(runScrollRestore);
      app.savedViewRestoreTimers = [
        ...(app.savedViewRestoreTimers || []),
        setTimeout(runScrollRestore, 180)
      ];
      return true;
    }

    return false;
  }

  function bindViewPositionPersistence() {
    if (window.__mhpViewPositionPersistenceBound) return;
    window.__mhpViewPositionPersistenceBound = true;

    window.addEventListener('scroll', () => {
      // A real scroll after boot means the user is taking control of the view;
      // cancel any delayed initial restore from a previous session.
      if (!app.__allowInitialRestoreScroll) markUserViewInteraction('scroll');
      scheduleViewPositionSave();
    }, { passive: true });
    window.addEventListener('resize', () => {
      markUserViewInteraction('resize');
      scheduleViewPositionSave();
    }, { passive: true });

    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(type => {
      window.addEventListener(type, () => markUserViewInteraction(type), { passive: true, capture: true });
    });

    const flush = () => {
      if (app.viewPositionSaveTimer) {
        clearTimeout(app.viewPositionSaveTimer);
        app.viewPositionSaveTimer = null;
      }
      saveViewPositionNow();
    };

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  function restoreBoardVisualAnchor(anchor, options = {}) {
    if (!anchor?.id) return false;

    const attempts = Number.isFinite(options.attempts) ? options.attempts : 8;
    let remaining = attempts;

    const run = () => {
      const node = els.board?.querySelector?.(`[data-id="${getCssSafeId(anchor.id)}"]`);

      if (!node) {
        remaining--;

        if (remaining <= 0) return false;

        window.MudaeBoardController?.updateEntriesFromApp?.();
        window.MudaeBoardController?.renderAroundId?.(anchor.id, { scroll: false, highlight: false });
        requestAnimationFrame(run);
        return false;
      }

      const rect = node.getBoundingClientRect();
      const delta = rect.top - anchor.top;

      if (Math.abs(delta) > 2) {
        window.scrollTo({
          top: (window.scrollY || document.documentElement.scrollTop || 0) + delta,
          behavior: 'auto'
        });
      }

      if (options.highlight) {
        node.classList.add('highlight-jump', 'highlight-jump-strong');
        setTimeout(() => node.classList.remove('highlight-jump', 'highlight-jump-strong'), 1200);
      }

      remaining--;

      if (remaining > 0 && Math.abs(delta) > 2) {
        requestAnimationFrame(run);
      }

      return true;
    };

    requestAnimationFrame(run);
    setTimeout(run, 80);
    setTimeout(run, 180);

    return true;
  }




  function getFirstVisibleCharacterRawIndex() {
    const visible = Array.from(els.board?.querySelectorAll?.('.char-card[data-id]') || []);
    const first = visible.find(node => node.dataset.id);

    if (!first) return app.state.characters.length;

    const index = app.state.characters.findIndex(item => !isDivider(item) && item.id === first.dataset.id);
    return index >= 0 ? index : app.state.characters.length;
  }
  function getCharacterRawIndexByDisplayNumber(position) {
    return window.MudaeDividers?.getCharacterRawIndexByDisplayNumber?.(position) ?? -1;
  }
  function getDividerInsertIndexFromChoice(choice, exactPosition) {
    return window.MudaeDividers?.getDividerInsertIndexFromChoice?.(choice, exactPosition) ?? -1;
  }
  async function showDividerBuilderDialog(defaultLevel = 1) {
    return window.MudaeDividers?.showDividerBuilderDialog?.(defaultLevel) ?? null;
  }
  async function insertBoardDivider(level = 1) {
    return window.MudaeDividers?.insertBoardDivider?.(level) ?? false;
  }
  function addBoardDivider() {
    return window.MudaeDividers?.addBoardDivider?.() ?? insertBoardDivider(1);
  }
  function addBoardSubDivider() {
    return window.MudaeDividers?.addBoardSubDivider?.() ?? insertBoardDivider(2);
  }



  function ensureMultiSelectedSet() {
    if (!app.multiSelectedIds || typeof app.multiSelectedIds.add !== 'function') {
      app.multiSelectedIds = new Set(Array.isArray(app.multiSelectedIds) ? app.multiSelectedIds : []);
    }

    return app.multiSelectedIds;
  }

  function toggleMultiSelectMode(force) {
    const next = typeof force === 'boolean' ? force : !app.multiSelectMode;
    app.multiSelectMode = next;

    const selected = ensureMultiSelectedSet();

    if (!next) {
      selected.clear();
      app.multiMoveTargetMode = false;
      els.board?.querySelectorAll?.('.multi-selected-card').forEach(node => node.classList.remove('multi-selected-card'));
    }

    document.body.classList.toggle('is-multi-select-mode', next);
    document.body.classList.toggle('is-multi-move-target-mode', next && app.multiMoveTargetMode);
    dispatchMultiSelectChange();

    notifyAppMessage(next ? 'Multi-select enabled.' : 'Multi-select disabled.');
    return next;
  }

  function getMultiSelectMode() {
    return !!app.multiSelectMode;
  }

  function toggleCardMultiSelection(id) {
    if (!id) return false;

    const selected = ensureMultiSelectedSet();
    const character = getCharacter(id);
    const groupId = getCharacterGroupId(character);
    const idsToToggle = groupId
      ? getGroupMemberItems(groupId).map(item => item.id)
      : [id];

    const validIds = idsToToggle.filter(Boolean);
    if (!validIds.length) return false;

    const shouldDeselect = validIds.every(itemId => selected.has(itemId));

    validIds.forEach(itemId => {
      if (shouldDeselect) selected.delete(itemId);
      else selected.add(itemId);
      setCardMultiSelectedVisual(itemId, !shouldDeselect);
    });

    if (!selected.size && app.multiMoveTargetMode) {
      app.multiMoveTargetMode = false;
      document.body.classList.toggle('is-multi-move-target-mode', false);
    }

    dispatchMultiSelectChange();

    if (groupId && validIds.length > 1) {
      const label = getGroupLabelForCharacter(character) || groupId;
      notifyAppMessage(shouldDeselect ? `Group ${label} deselected.` : `Group ${label} selected.`);
    }

    return true;
  }




  function clearMultiSelection() {
    const selected = ensureMultiSelectedSet();
    selected.clear();
    app.multiMoveTargetMode = false;
    els.board?.querySelectorAll?.('.multi-selected-card').forEach(node => node.classList.remove('multi-selected-card'));
    document.body.classList.toggle('is-multi-move-target-mode', false);

    dispatchMultiSelectChange();

    return true;
  }

  function setMultiMoveTargetMode(force) {
    if (!app.multiSelectMode) return false;

    const selected = ensureMultiSelectedSet();
    if (!selected.size) {
      app.multiMoveTargetMode = false;
      document.body.classList.toggle('is-multi-move-target-mode', false);
      dispatchMultiSelectChange();
      notifyAppMessage('Select one or more characters first.');
      return false;
    }

    const next = typeof force === 'boolean' ? force : !app.multiMoveTargetMode;
    app.multiMoveTargetMode = next;
    document.body.classList.toggle('is-multi-move-target-mode', next);

    dispatchMultiSelectChange();

    notifyAppMessage(next ? 'Click a destination card for the selected characters.' : 'Destination selection cancelled.');
    return next;
  }

  function moveSelectedCharactersRelativeToTargetDataOnly(targetId, placement = 'before') {
    const selected = ensureMultiSelectedSet();
    const selectedIds = Array.from(selected || []);

    if (!targetId || !selectedIds.length) return false;
    if (selected.has(targetId)) {
      notifyAppMessage('Choose a destination that is not part of the selection.');
      return false;
    }

    const stateList = app.state.characters;
    const selectedSet = new Set(selectedIds);
    const targetBeforeIndex = stateList.findIndex(item => item?.id === targetId && !isDivider(item));

    if (targetBeforeIndex < 0) return false;

    const captureStableMultiMoveAnchor = () => {
      const board = els.board;
      const viewportBottom = window.innerHeight || document.documentElement.clientHeight || 800;
      const candidates = Array.from(board?.querySelectorAll?.('.char-card[data-id]') || []);
      let best = null;
      let bestDistance = Infinity;

      for (const node of candidates) {
        const id = node.dataset?.id || '';
        if (!id || selectedSet.has(id)) continue;

        const rect = node.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewportBottom) continue;

        const distance = Math.abs(rect.top - 80);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { id, top: rect.top };
        }
      }

      return best || { id: targetId, top: 120 };
    };

    const visualAnchor = captureStableMultiMoveAnchor();

    const sourcePositionById = new Map(
      selectedIds.map(id => [id, getCharacterDisplayPositionById(id) || getCharacterListPosition(id) || 0])
    );
    const targetPositionBeforeMove = getCharacterDisplayPositionById(targetId) || getCharacterListPosition(targetId) || 0;

    const getCharacterAtDisplayPosition = (position) => {
      const wanted = Number(position) || 0;
      if (wanted < 1) return null;

      let current = 1;
      for (const item of app.state.characters || []) {
        if (!item || isDivider(item)) continue;
        if (current === wanted) return item;
        current += 1;
      }

      return null;
    };

    const getChangedExportNameForItem = (item) => str(item?.exportName || item?.name || '').trim();
    const targetItemBeforeMove = getCharacterAtDisplayPosition(targetPositionBeforeMove);
    let anchorItemBeforeMove = getCharacterAtDisplayPosition(targetPositionBeforeMove - 1);

    if (anchorItemBeforeMove && selectedSet.has(anchorItemBeforeMove.id)) {
      let probe = targetPositionBeforeMove - 2;
      anchorItemBeforeMove = null;

      while (probe >= 1 && !anchorItemBeforeMove) {
        const candidate = getCharacterAtDisplayPosition(probe);
        if (candidate && !selectedSet.has(candidate.id)) anchorItemBeforeMove = candidate;
        probe -= 1;
      }
    }

    const movingItems = [];
    const remainingItems = [];

    for (const item of stateList) {
      if (item && !isDivider(item) && selectedSet.has(item.id)) {
        movingItems.push(item);
      } else {
        remainingItems.push(item);
      }
    }

    if (!movingItems.length) return false;

    let insertIndex = remainingItems.findIndex(item => item?.id === targetId && !isDivider(item));
    if (insertIndex < 0) return false;

    if (placement === 'after') insertIndex += 1;
    insertIndex = Math.max(0, Math.min(remainingItems.length, insertIndex));

    document.body.classList.add('is-board-focusing');

    app.state.characters = [
      ...remainingItems.slice(0, insertIndex),
      ...movingItems,
      ...remainingItems.slice(insertIndex)
    ];

    app.multiMoveTargetMode = false;
    selected.clear();

    invalidateSearchCache();
    assignBoardCounters();
    saveLocal();
    window.MudaeBoardController?.updateEntriesFromApp?.();

    if (!reorderExistingBoardFromState(targetId)) {
      renderBoard();
    }

    window.MudaeBoardController?.renderAroundId?.(visualAnchor?.id || targetId, { scroll: false, highlight: false });
    restoreBoardVisualAnchor(visualAnchor, { attempts: 6, highlight: false });
    setTimeout(() => document.body.classList.remove('is-board-focusing'), 280);
    window.MudaeBoardController?.flushSave?.();

    const destinationCenter = targetPositionBeforeMove || getCharacterDisplayPositionById(targetId) || 1;
    const destinationStart = Math.max(1, destinationCenter - 1);
    const changedCommandNames = [
      placement === 'before' ? getChangedExportNameForItem(anchorItemBeforeMove) : getChangedExportNameForItem(targetItemBeforeMove),
      ...movingItems.map(getChangedExportNameForItem),
      placement === 'before' ? getChangedExportNameForItem(targetItemBeforeMove) : ''
    ].filter(Boolean);
    const destinationEnd = Math.max(destinationStart, destinationStart + Math.max(1, changedCommandNames.length) - 1);
    const movedNames = movingItems
      .map(item => item?.name || '')
      .filter(Boolean);

    if (window.MudaeExports?.recordChangedRange) {
      window.MudaeExports.recordChangedRange(destinationCenter, destinationStart, destinationEnd, {
        id: `multi-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: movedNames.length
          ? `${movedNames.slice(0, 3).join(', ')}${movedNames.length > 3 ? ` +${movedNames.length - 3}` : ''}`
          : `${movingItems.length} selected`,
        commandNames: changedCommandNames,
        fromPosition: (() => {
          const sourcePositions = Array.from(sourcePositionById.values()).filter(Boolean);
          return sourcePositions.length ? Math.min(...sourcePositions) : destinationCenter;
        })()
      });
    } else {
      window.MudaeExports?.recordChangedMove?.(0, destinationCenter, {
        radius: Math.max(1, movingItems.length),
        name: `${movingItems.length} selected`
      });
    }

    document.body.classList.toggle('is-multi-move-target-mode', false);
    els.board?.querySelectorAll?.('.multi-selected-card').forEach(node => node.classList.remove('multi-selected-card'));

    dispatchMultiSelectChange();

    notifyAppMessage(`Moved ${movingItems.length} selected character${movingItems.length === 1 ? '' : 's'}.`);
    return true;
  }



function renderAll(options = {}) {
    // v2.323:
    // Preserve view only when explicitly requested. Preserving every render
    // made the page slower and caused extra scroll corrections.
    const shouldPreserve = options.preserveView === true;
    const anchor = shouldPreserve ? captureBoardVisualAnchor() : null;
    const scrollBefore = shouldPreserve ? (window.scrollY || document.documentElement.scrollTop || 0) : null;

    clearSelectedMoveCharacter();
    invalidateSearchCache();
    assignBoardCounters();
    recalcStats();
    updateStatsBar();
    renderBoard();

    if (shouldPreserve) {
      requestAnimationFrame(() => {
        if (anchor?.id) restoreBoardVisualAnchor(anchor, { attempts: 8, highlight: false });
        else if (Number.isFinite(scrollBefore)) window.scrollTo({ top: scrollBefore, behavior: 'auto' });
      });
    }
  }

  function hasTooShortSearchQuery() {
    const raw = getActiveSearchQuery().trim();
    if (!raw) return false;
    if (isIncompleteSearchCommand(raw)) return false;

    const parsed = parseSearchTokens(raw)
      .map(parseSearchTerm)
      .filter(item => item.value);

    return parsed.length > 0 && parsed.every(item => {
      if (item.field === 'gender') return false;
      return item.value.length < app.searchMinChars;
    });
  }


  function createSearchMinCharsMessage() {
    const empty = document.createElement('div');
    empty.className = 'divider-row search-minchars-message';
    empty.textContent = `Type at least ${app.searchMinChars} characters to search.`;
    return empty;
  }

  function createSearchCommandMessage() {
    const empty = document.createElement('div');
    empty.className = 'divider-row search-minchars-message';
    empty.textContent = 'Press Tab to complete a search command.';
    return empty;
  }

  function createSearchRenderLoadingMessage() {
    const row = document.createElement('div');
    row.className = 'divider-row search-render-loading';
    row.textContent = 'Searching...';
    return row;
  }

  function createBoardEntryNode(entry) {
    if (entry.type === 'divider') {
      const dividerNode = renderDivider(entry.item);
      if (entry.searchMatch) dividerNode.classList.add('divider-search-match');
      return dividerNode;
    }

    return renderCard(entry.item);
  }

  function collectFilteredBoardEntries(terms) {
    const priorityTerms = terms.length ? getSearchPriorityNameTerms() : [];
    const priorityEntries = [];
    const normalEntries = [];
    const collapsedLevels = [];
    let visibleChars = 0;

    app.state.characters.forEach((item, index) => {
      if (isDivider(item)) {
        const level = getDividerLevel(item);

        while (collapsedLevels.length && collapsedLevels[collapsedLevels.length - 1] >= level) {
          collapsedLevels.pop();
        }

        if (!terms.length && collapsedLevels.length) return;

        if (!terms.length) {
          normalEntries.push({ type: 'divider', item });

          if (item.collapsed) {
            collapsedLevels.push(level);
          }

          return;
        }

        const directDividerMatch = itemMatchesSearch(item, terms);
        const sectionDividerMatch = isInsideMatchedDividerSection(index, terms);

        if (directDividerMatch || sectionDividerMatch) {
          normalEntries.push({
            type: 'divider',
            item,
            searchMatch: directDividerMatch,
            sectionSearchMatch: sectionDividerMatch
          });
        }
        return;
      }

      if (!terms.length && collapsedLevels.length) return;

      const directMatch = itemMatchesSearch(item, terms);
      const sectionMatch = isInsideMatchedDividerSection(index, terms);

      if (terms.length && !(directMatch || sectionMatch)) return;
      if (!characterPassesTypeFilter(item)) return;

      visibleChars++;

      const priorityRank = getSearchPriorityRank(item, priorityTerms);
      const entry = { type: 'card', item, searchPriorityRank: priorityRank, originalIndex: index };

      if (Number.isFinite(priorityRank)) {
        priorityEntries.push(entry);
      } else {
        normalEntries.push(entry);
      }
    });

    if (priorityEntries.length) {
      priorityEntries.sort((a, b) => {
        if (a.searchPriorityRank !== b.searchPriorityRank) {
          return a.searchPriorityRank - b.searchPriorityRank;
        }
        return a.originalIndex - b.originalIndex;
      });
    }

    return {
      entries: priorityEntries.length ? [...priorityEntries, ...normalEntries] : normalEntries,
      visibleChars
    };
  }

  function shouldChunkSearchRender() {
    const query = getActiveSearchQuery().trim().toLowerCase();
    return query.startsWith('gender:');
  }

  function renderBoardSearchChunked(terms) {
    clearBoardControllerDomMode();
    const renderJobId = app.renderJob;
    const searchJobId = ++app.searchRenderJob;
    const { entries, visibleChars } = collectFilteredBoardEntries(terms);
    const chunkSize = Math.max(30, Number(app.searchRenderChunkSize) || 90);
    let cursor = 0;
    let firstChunk = true;

    els.board.replaceChildren(createSearchRenderLoadingMessage());

    if (!entries.length && !visibleChars) {
      clearBoardControllerDomMode();
      els.board.replaceChildren(createEmptyBoardMessage());
      return;
    }

    function appendSearchChunk(deadline) {
      if (renderJobId !== app.renderJob || searchJobId !== app.searchRenderJob) return;

      const frag = document.createDocumentFragment();
      let count = 0;

      while (cursor < entries.length && count < chunkSize) {
        frag.appendChild(createBoardEntryNode(entries[cursor++]));
        count++;

        if (deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() < 4) {
          break;
        }
      }

      if (firstChunk) {
        firstChunk = false;
        els.board.replaceChildren(frag);
      } else {
        els.board.appendChild(frag);
      }

      window.MudaeGifControl?.refresh?.();

      if (cursor < entries.length) {
        scheduleRenderChunk(appendSearchChunk);
      }
    }

    requestAnimationFrame(() => scheduleRenderChunk(appendSearchChunk));
  }
  function getAllGalleryImageUrls() {
    const urls = [];
    const seen = new Set();

    app.state.characters.forEach(item => {
      if (isDivider(item)) return;

      normalizeUrls(item.mudaeImages).forEach(url => {
        const value = String(url || '').trim();

        if (!value || value.startsWith('data:') || seen.has(value)) return;

        seen.add(value);
        urls.push(value);
      });
    });

    return urls;
  }

  function getAllBoardImageUrls() {
    const urls = [];
    const seen = new Set();

    const add = (value) => {
      const url = String(value || '').trim();
      if (!url || url.startsWith('data:')) return;
      const key = url.replace(/^https?:/i, '').replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      urls.push(url);
    };

    app.state.characters.forEach(item => {
      if (isDivider(item)) return;

      // Card preload should cover the image currently shown on the card,
      // plus common stored fallbacks. It must not reorder the gallery.
      add(item.image);
      add(item.imageUrl);
      normalizeUrls(item.mudaeImages).forEach(add);
    });

    return urls;
  }



  function rememberCurrentBoardImageUrls() {
    document.querySelectorAll('img.char-img').forEach(img => {
      const url = img.currentSrc || img.src || img.dataset?.src || '';
      if (url && !url.startsWith('data:')) {
        window.MudaeMinimalImageLoader?.rememberLoadedUrl?.(url);
      }
    });
  }

  const VISIBLE_CARD_LIMIT_KEY = 'mudae.visibleCardLimit.v1';
  const VISIBLE_CARD_LIMITS = [150, 300, 600, 900, 1200, 0];

  const VIRTUAL_BOARD_KEY = 'mudae.virtualBoard.enabled.v1';
  const VIRTUAL_CARD_HEIGHT = 344;
  const VIRTUAL_DIVIDER_HEIGHT = 72;
  const VIRTUAL_SUBDIVIDER_HEIGHT = 64;
  const VIRTUAL_OVERSCAN_PX = 900;
  const VIRTUAL_WINDOW_SIZE = 600;
  const VIRTUAL_WINDOW_BUFFER = 80;
  const VIRTUAL_WINDOW_GRID_CLASS = 'virtual-board-window-grid';
  function hydrateVisibleCardLimitSetting() {
    try {
      const raw = localStorage.getItem(VISIBLE_CARD_LIMIT_KEY);
      const value = raw == null ? 600 : Number(raw);
      app.visibleCardLimit = VISIBLE_CARD_LIMITS.includes(value) ? value : 0;
    } catch (error) {
      app.visibleCardLimit = 600;
    }
  }
  function setVisibleCardLimit(limit) {
    const value = Number(limit) || 0;
    app.visibleCardLimit = VISIBLE_CARD_LIMITS.includes(value) ? value : 0;

    if (app.visibleCardLimit > 0) {
      app.virtualBoardEnabled = false;

      try {
        localStorage.setItem(VIRTUAL_BOARD_KEY, 'false');
      } catch (error) {
        // ignore
      }

      clearVirtualBoardState();
    } else {
      clearVisibleWindowState();
      applyVisibleLimitPageHeight(false);
    }

    try {
      localStorage.setItem(VISIBLE_CARD_LIMIT_KEY, String(app.visibleCardLimit));
    } catch (error) {
      // ignore storage failures
    }

    renderBoard();

    window.dispatchEvent(new CustomEvent('mudae:visible-card-limit-change', {
      detail: { limit: app.visibleCardLimit }
    }));

    window.dispatchEvent(new CustomEvent('mudae:virtual-board-change', {
      detail: { enabled: app.virtualBoardEnabled }
    }));
  }







  function getVisibleCardLimit() {
    return Number(app.visibleCardLimit) || 0;
  }

  function isVisibleCardLimitActive(terms = []) {
    return !terms.length && getVisibleCardLimit() > 0 && !isVirtualBoardEnabled();
  }
  function clearVirtualBoardState() {
    els.board?.classList?.remove('virtual-board-active');

    if (els.board?.dataset) {
      delete els.board.dataset.virtualStart;
      delete els.board.dataset.virtualEnd;
      delete els.board.dataset.virtualTotal;
      delete els.board.dataset.virtualCenter;
      delete els.board.dataset.virtualScroll;
      delete els.board.dataset.virtualHeight;
    }

    app.virtualBoardEntries = [];
    app.virtualBoardOffsets = [];
    app.virtualBoardTotalHeight = 0;
    app.virtualBoardLastRange = null;
    app.virtualBoardTopAbsolute = 0;

    if (app.virtualBlockObserver) {
      app.virtualBlockObserver.disconnect();
      app.virtualBlockObserver = null;
    }

    if (app.virtualBoardWatchdog) {
      clearInterval(app.virtualBoardWatchdog);
      app.virtualBoardWatchdog = null;
    }

    els.board?.querySelectorAll?.('.virtual-board-spacer,.virtual-sentinel,.virtual-board-window-grid').forEach(node => {
      if (!node.classList.contains('char-card') && !node.classList.contains('divider-row')) {
        node.remove();
      }
    });

    document.body.classList.remove('virtual-board-active');
    document.documentElement.classList.remove('virtual-board-active');
  }



  function applyVisibleLimitPageHeight(isLimited) {
    document.body.classList.toggle('visible-card-limit-active', !!isLimited);
    document.documentElement.classList.toggle('visible-card-limit-active', !!isLimited);

    if (!isVirtualBoardEnabled()) {
      document.body.style.removeProperty('height');
      document.documentElement.style.removeProperty('height');
      document.body.style.removeProperty('min-height');
      document.documentElement.style.removeProperty('min-height');
    }
  }

  function getVisibleLimitStep() {
    const current = getVisibleCardLimit();
    if (current <= 0) return 0;

    if (current <= 600) return 300;
    if (current <= 900) return 300;
    return 400;
  }
  function increaseVisibleCardLimit(reason = 'scroll') {
    return false;
  }
  function shouldAutoLoadMoreVisibleCards() {
    return false;
  }


  function scheduleVisibleCardAutoLoad(reason = 'scroll') {
    window.MudaeBoardController?.schedule?.(false);
  }


  function bindVisibleCardAutoLoad() {
    window.MudaeBoardController?.bind?.();
    bindDelegatedExactPositionMove();
  }





  const VISIBLE_WINDOW_CARD_WIDTH = 190;
  const VISIBLE_WINDOW_GRID_GAP = 14;
  const VISIBLE_WINDOW_CARD_HEIGHT = 344;
  const VISIBLE_WINDOW_DIVIDER_HEIGHT = 72;
  const VISIBLE_WINDOW_SUBDIVIDER_HEIGHT = 64;
  function clearVisibleWindowState() {
    app.visibleWindowEntries = [];
    app.visibleWindowOffsets = [];
    app.visibleWindowAfterOffsets = [];
    app.visibleWindowTotalHeight = 0;
    app.visibleWindowBoardTop = 0;
    app.visibleWindowLastRange = null;
    app.visibleWindowColumns = 1;
    app.visibleWindowStartIndex = 0;
    els.board?.classList?.remove('visible-window-active');

    disconnectVisibleWindowObserver?.();

    if (app.visibleWindowWatchdog) {
      clearInterval(app.visibleWindowWatchdog);
      app.visibleWindowWatchdog = null;
    }
  }



  function getVisibleWindowColumns() {
    const width = Math.max(320, els.board?.clientWidth || window.innerWidth || 1200);
    const columns = Math.floor((width + VISIBLE_WINDOW_GRID_GAP) / (VISIBLE_WINDOW_CARD_WIDTH + VISIBLE_WINDOW_GRID_GAP));
    return Math.max(1, columns || 1);
  }

  function getVisibleWindowEntryHeight(entry) {
    if (!entry) return VISIBLE_WINDOW_CARD_HEIGHT;

    if (entry.type === 'divider') {
      return getDividerCounterKind(entry.item) === 'subdivider'
        ? VISIBLE_WINDOW_SUBDIVIDER_HEIGHT
        : VISIBLE_WINDOW_DIVIDER_HEIGHT;
    }

    return VISIBLE_WINDOW_CARD_HEIGHT;
  }

  function buildVisibleWindowOffsets(entries) {
    const columns = getVisibleWindowColumns();
    const offsets = [];
    const afterOffsets = [];

    let y = 0;
    let cardsInRow = 0;
    let rowStartY = 0;

    function closeCardRow() {
      if (!cardsInRow) return;
      y = rowStartY + VISIBLE_WINDOW_CARD_HEIGHT + VISIBLE_WINDOW_GRID_GAP;
      cardsInRow = 0;
      rowStartY = y;
    }

    entries.forEach(entry => {
      if (entry.type === 'divider') {
        closeCardRow();

        offsets.push(y);
        y += getVisibleWindowEntryHeight(entry) + VISIBLE_WINDOW_GRID_GAP;
        afterOffsets.push(y);
        rowStartY = y;
        return;
      }

      if (!cardsInRow) rowStartY = y;

      offsets.push(rowStartY);
      cardsInRow++;

      if (cardsInRow >= columns) {
        closeCardRow();
      }

      afterOffsets.push(rowStartY + VISIBLE_WINDOW_CARD_HEIGHT + VISIBLE_WINDOW_GRID_GAP);
    });

    closeCardRow();

    return {
      columns,
      offsets,
      afterOffsets,
      total: Math.max(0, y)
    };
  }

  function findVisibleWindowCenterIndex(scrollTop) {
    const offsets = app.visibleWindowOffsets || [];

    if (!offsets.length) return 0;

    let lo = 0;
    let hi = offsets.length - 1;
    let ans = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;

      if (offsets[mid] <= scrollTop) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return ans;
  }

  function snapVisibleWindowStartToRow(start) {
    const offsets = app.visibleWindowOffsets || [];

    if (start <= 0 || !offsets[start]) return Math.max(0, start);

    const y = offsets[start];

    while (start > 0 && offsets[start - 1] === y) {
      start--;
    }

    return start;
  }

  function snapVisibleWindowEndToRow(end) {
    const offsets = app.visibleWindowOffsets || [];
    const entries = app.visibleWindowEntries || [];

    if (end >= entries.length || end <= 0) return Math.min(entries.length, end);

    const y = offsets[end - 1];

    while (end < entries.length && offsets[end] === y) {
      end++;
    }

    return end;
  }
  function getVisibleWindowRange() {
    const entries = app.visibleWindowEntries || [];
    const limit = getVisibleCardLimit();

    if (!entries.length || limit <= 0) {
      return {
        start: 0,
        end: entries.length,
        topSpacer: 0,
        bottomSpacer: 0,
        centerIndex: 0
      };
    }

    const start = snapVisibleWindowStartToRow(clampVisibleWindowStart(app.visibleWindowStartIndex || 0));
    const end = snapVisibleWindowEndToRow(Math.min(entries.length, start + limit));

    const topSpacer = app.visibleWindowOffsets[start] || 0;
    const endOffset = end < app.visibleWindowOffsets.length
      ? app.visibleWindowOffsets[end]
      : app.visibleWindowTotalHeight;
    const bottomSpacer = Math.max(0, app.visibleWindowTotalHeight - endOffset);

    return {
      start,
      end,
      topSpacer,
      bottomSpacer,
      centerIndex: start + Math.floor((end - start) / 2)
    };
  }



  function createVisibleWindowSpacer(height, className) {
    const spacer = document.createElement('div');
    spacer.className = className;
    spacer.style.height = Math.max(0, Math.round(height)) + 'px';
    spacer.setAttribute('aria-hidden', 'true');
    return spacer;
  }

  function createVisibleWindowGrid() {
    const grid = document.createElement('div');
    grid.className = 'visible-window-grid';
    return grid;
  }

  function getVisibleWindowStep() {
    const limit = getVisibleCardLimit();
    if (limit <= 0) return 0;
    return Math.max(80, Math.floor(limit / 4));
  }

  function clampVisibleWindowStart(start) {
    const entries = app.visibleWindowEntries || [];
    const limit = getVisibleCardLimit();

    if (!entries.length || limit <= 0) return 0;

    const maxStart = Math.max(0, entries.length - limit);
    return Math.max(0, Math.min(maxStart, Number(start) || 0));
  }

  function setVisibleWindowStart(start, keepViewport = false) {
    if (getVisibleCardLimit() <= 0 || !app.visibleWindowEntries?.length) return false;

    const next = clampVisibleWindowStart(start);
    const previous = clampVisibleWindowStart(app.visibleWindowStartIndex || 0);

    if (next === previous && app.visibleWindowLastRange) return true;

    const oldGrid = els.board?.querySelector?.('.visible-window-grid');
    const oldTop = oldGrid?.getBoundingClientRect?.().top || 0;
    const scrollBefore = getBoardScrollTop();

    app.visibleWindowStartIndex = next;
    app.visibleWindowLastRange = null;

    renderVisibleWindowNow(true);

    if (keepViewport) {
      requestAnimationFrame(() => {
        const newGrid = els.board?.querySelector?.('.visible-window-grid');
        const newTop = newGrid?.getBoundingClientRect?.().top || 0;
        const delta = newTop - oldTop;

        if (Math.abs(delta) > 2 && getBoardScrollTop() < scrollBefore + delta + 20) {
          window.scrollTo({
            top: scrollBefore + delta,
            behavior: 'auto'
          });
        }
      });
    }

    return true;
  }

  function disconnectVisibleWindowObserver() {
    if (app.visibleWindowObserver) {
      app.visibleWindowObserver.disconnect();
      app.visibleWindowObserver = null;
    }
  }

  function createVisibleWindowSentinel(direction) {
    const node = document.createElement('div');
    node.className = `visible-window-sentinel visible-window-sentinel-${direction}`;
    node.dataset.visibleWindowSentinel = direction;
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function observeVisibleWindowSentinels() {
    disconnectVisibleWindowObserver();

    if (!('IntersectionObserver' in window)) return;

    const top = els.board?.querySelector?.('.visible-window-sentinel-top');
    const bottom = els.board?.querySelector?.('.visible-window-sentinel-bottom');

    if (!top && !bottom) return;

    app.visibleWindowObserver = new IntersectionObserver(entries => {
      if (app.visibleWindowSwitching || app.pointerMoveDrag?.active || app.selectedMoveCharacterId) return;

      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const direction = entry.target.dataset.visibleWindowSentinel;
        const step = getVisibleWindowStep();

        if (direction === 'bottom') {
          app.visibleWindowSwitching = true;
          setTimeout(() => {
            setVisibleWindowStart((app.visibleWindowStartIndex || 0) + step, false);
            app.visibleWindowSwitching = false;
          }, 0);
        }

        if (direction === 'top') {
          app.visibleWindowSwitching = true;
          setTimeout(() => {
            setVisibleWindowStart((app.visibleWindowStartIndex || 0) - step, true);
            app.visibleWindowSwitching = false;
          }, 0);
        }
      }
    }, {
      root: null,
      rootMargin: '1100px 0px',
      threshold: 0.01
    });

    if (top) app.visibleWindowObserver.observe(top);
    if (bottom) app.visibleWindowObserver.observe(bottom);
  }

  function startVisibleWindowWatchdog() {
    if (app.visibleWindowWatchdog) return;

    app.visibleWindowWatchdog = setInterval(() => {
      if (document.hidden || document.documentElement.classList.contains('mhp-hibernating')) return;
      if (getVisibleCardLimit() <= 0 || !app.visibleWindowEntries?.length) return;
      if (app.pointerMoveDrag?.active || app.selectedMoveCharacterId) return;

      const grid = els.board?.querySelector?.('.visible-window-grid');
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 800;
      const step = getVisibleWindowStep();

      if (rect.bottom < vh + 1200) {
        setVisibleWindowStart((app.visibleWindowStartIndex || 0) + step, false);
        return;
      }

      if (rect.top > -1100 && (app.visibleWindowStartIndex || 0) > 0) {
        setVisibleWindowStart((app.visibleWindowStartIndex || 0) - step, true);
      }
    }, 180);
  }
  function renderVisibleWindowNow(force = false) {
    return false;
  }
  function scheduleVisibleWindowRender(force = false) {
    window.MudaeBoardController?.schedule?.(!!force);
    return false;
  }


  function renderVisibleWindow(entries) {
    return false;
  }
  function bindVisibleWindowAutoRender() {
    window.MudaeBoardController?.bind?.();
  }


  function createVisibleLimitMessage(rendered, total) {
    const wrap = document.createElement('div');
    wrap.className = 'visible-limit-message';
    wrap.hidden = true;
    return wrap;
  }


  function hydrateVirtualBoardSetting() {
    app.virtualBoardEnabled = false;
    try {
      localStorage.setItem(VIRTUAL_BOARD_KEY, 'false');
    } catch (error) {
      // ignore
    }
  }





  function getCurrentVisibleBoardAnchor() {
    const viewportTop = 0;
    const viewportBottom = getBoardViewportHeight();
    const candidates = Array.from(els.board?.querySelectorAll?.('[data-id]') || []);

    let best = null;
    let bestDistance = Infinity;

    for (const node of candidates) {
      const rect = node.getBoundingClientRect();

      if (rect.bottom < viewportTop || rect.top > viewportBottom) continue;

      const distance = Math.abs(rect.top - 90);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = {
          id: node.dataset.id,
          offset: rect.top
        };
      }
    }

    return best;
  }
  function setVirtualBoardEnabled(enabled) {
    try {
      localStorage.setItem(VIRTUAL_BOARD_KEY, 'false');
    } catch (error) {
      // ignore
    }

    app.virtualBoardEnabled = false;
    clearBoardControllerDomMode?.();

    window.dispatchEvent(new CustomEvent('mudae:virtual-board-change', {
      detail: { enabled: false }
    }));
  }


  function isVirtualBoardEnabled() {
    return false;
  }





  function getVirtualEntryHeight(entry) {
    if (!entry) return VIRTUAL_CARD_HEIGHT;

    if (entry.type === 'divider') {
      return getDividerCounterKind(entry.item) === 'subdivider'
        ? VIRTUAL_SUBDIVIDER_HEIGHT
        : VIRTUAL_DIVIDER_HEIGHT;
    }

    return VIRTUAL_CARD_HEIGHT;
  }

  function getScrollElementCandidates() {
    return [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.querySelector('main'),
      document.querySelector('.app-shell'),
      document.querySelector('.board-wrap'),
      document.querySelector('#board')?.parentElement
    ].filter(Boolean);
  }

  function getScrollableElement() {
    if (app.virtualScrollElement) return app.virtualScrollElement;

    const candidates = getScrollElementCandidates();

    app.virtualScrollElement = candidates.find(el => {
      if (el === document.body || el === document.documentElement || el === document.scrollingElement) {
        return true;
      }

      return el.scrollHeight > el.clientHeight + 20;
    }) || document.scrollingElement || document.documentElement;

    return app.virtualScrollElement;
  }
  function getBoardScrollTop() {
    const el = getScrollableElement();

    if (!el) {
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    if (el === document.body || el === document.documentElement || el === document.scrollingElement) {
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || el.scrollTop || 0;
    }

    return el.scrollTop || 0;
  }
  function getBoardViewportHeight() {
    const el = getScrollableElement();

    if (el && el !== document.body && el !== document.documentElement && el !== document.scrollingElement) {
      return el.clientHeight || window.innerHeight || 800;
    }

    return window.innerHeight || document.documentElement.clientHeight || 800;
  }



  function buildVirtualOffsets(entries) {
    const offsets = [];
    let total = 0;

    entries.forEach(entry => {
      offsets.push(total);
      total += getVirtualEntryHeight(entry);
    });

    return { offsets, total };
  }

  function findVirtualStartIndex(offsets, scrollTop) {
    let lo = 0;
    let hi = offsets.length - 1;
    let ans = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;

      if (offsets[mid] <= scrollTop) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return ans;
  }
  function createVirtualSpacer(height, className) {
    const spacer = document.createElement('div');
    spacer.className = className;
    spacer.style.height = Math.max(0, Math.round(height)) + 'px';
    spacer.setAttribute('aria-hidden', 'true');
    return spacer;
  }
  function getVirtualBoardTopOffset() {
    if (app.virtualBoardTopAbsolute) return app.virtualBoardTopAbsolute;

    const rect = els.board?.getBoundingClientRect?.();

    if (!rect) return 0;

    app.virtualBoardTopAbsolute = rect.top + getBoardScrollTop();
    return app.virtualBoardTopAbsolute;
  }





  function getVirtualEntryIndexById(id) {
    if (!id) return -1;

    return (app.virtualBoardEntries || []).findIndex(entry => entry?.item?.id === id);
  }
  function getVirtualRenderRange() {
    const entries = app.virtualBoardEntries || [];
    const offsets = app.virtualBoardOffsets || [];

    if (!entries.length) {
      return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0, anchorIndex: -1 };
    }

    const range = getVirtualBlockRange(app.virtualBlockStart || 0);
    const start = range.start;
    const end = range.end;
    const anchorIndex = getVirtualEntryIndexById(app.virtualBoardAnchorId);

    const topSpacer = offsets[start] || 0;
    const endOffset = end < offsets.length ? offsets[end] : app.virtualBoardTotalHeight;
    const bottomSpacer = Math.max(0, app.virtualBoardTotalHeight - endOffset);

    return {
      start,
      end,
      topSpacer,
      bottomSpacer,
      anchorIndex,
      scrollTopNow: getBoardScrollTop(),
      centerIndex: start
    };
  }




  function getVirtualBlockRange(start = app.virtualBlockStart || 0) {
    const entries = app.virtualBoardEntries || [];
    const total = entries.length;

    start = Math.max(0, Math.min(start, Math.max(0, total - 1)));

    // Align to a soft page so blocks are predictable and do not drift every few pixels.
    start = Math.max(0, Math.floor(start / VIRTUAL_WINDOW_BUFFER) * VIRTUAL_WINDOW_BUFFER);

    let end = Math.min(total, start + VIRTUAL_WINDOW_SIZE);

    if (end - start < VIRTUAL_WINDOW_SIZE) {
      start = Math.max(0, end - VIRTUAL_WINDOW_SIZE);
    }

    return { start, end };
  }

  function setVirtualBlockStart(start, keepViewport = false) {
    if (!isVirtualBoardEnabled()) return false;

    const currentScroll = getBoardScrollTop();
    const beforeTop = els.board?.querySelector?.('.virtual-board-window-grid')?.getBoundingClientRect?.().top || 0;

    const range = getVirtualBlockRange(start);

    if (range.start === app.virtualBlockStart && app.virtualBoardLastRange?.start === range.start) {
      return true;
    }

    app.virtualBlockStart = range.start;
    app.virtualBoardLastRange = null;
    renderVirtualBoardWindow();

    if (keepViewport) {
      requestAnimationFrame(() => {
        const afterTop = els.board?.querySelector?.('.virtual-board-window-grid')?.getBoundingClientRect?.().top || 0;
        const delta = afterTop - beforeTop;

        if (Math.abs(delta) > 2) {
          const el = getScrollableElement();

          if (el && el !== document.body && el !== document.documentElement && el !== document.scrollingElement) {
            el.scrollTop = currentScroll + delta;
          } else {
            window.scrollTo({
              top: currentScroll + delta,
              behavior: 'auto'
            });
          }
        }
      });
    }

    return true;
  }

  function disconnectVirtualBlockObserver() {
    if (app.virtualBlockObserver) {
      app.virtualBlockObserver.disconnect();
      app.virtualBlockObserver = null;
    }
  }

  function observeVirtualSentinels() {
    disconnectVirtualBlockObserver();

    if (!isVirtualBoardEnabled() || !('IntersectionObserver' in window)) return;

    const top = els.board?.querySelector?.('.virtual-sentinel-top');
    const bottom = els.board?.querySelector?.('.virtual-sentinel-bottom');

    if (!top && !bottom) return;

    app.virtualBlockObserver = new IntersectionObserver(entries => {
      if (app.virtualBlockSwitching) return;

      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const direction = entry.target.dataset.virtualSentinel;

        if (direction === 'bottom') {
          app.virtualBlockSwitching = true;
          setTimeout(() => {
            setVirtualBlockStart((app.virtualBlockStart || 0) + VIRTUAL_WINDOW_BUFFER, false);
            app.virtualBlockSwitching = false;
          }, 0);
        }

        if (direction === 'top') {
          app.virtualBlockSwitching = true;
          setTimeout(() => {
            setVirtualBlockStart((app.virtualBlockStart || 0) - VIRTUAL_WINDOW_BUFFER, true);
            app.virtualBlockSwitching = false;
          }, 0);
        }
      });
    }, {
      root: null,
      rootMargin: '900px 0px',
      threshold: 0.01
    });

    if (top) app.virtualBlockObserver.observe(top);
    if (bottom) app.virtualBlockObserver.observe(bottom);
  }

  function createVirtualSentinel(direction) {
    const node = document.createElement('div');
    node.className = `virtual-sentinel virtual-sentinel-${direction}`;
    node.dataset.virtualSentinel = direction;
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function createVirtualWindowGrid() {
    const grid = document.createElement('div');
    grid.className = VIRTUAL_WINDOW_GRID_CLASS;
    return grid;
  }
  function renderVirtualBoardWindow() {
    if (!isVirtualBoardEnabled()) return false;

    const entries = app.virtualBoardEntries || [];

    if (!entries.length) return false;

    const range = getVirtualRenderRange();
    const sameRange = app.virtualBoardLastRange
      && app.virtualBoardLastRange.start === range.start
      && app.virtualBoardLastRange.end === range.end
      && Math.abs(app.virtualBoardLastRange.topSpacer - range.topSpacer) < 2
      && Math.abs(app.virtualBoardLastRange.bottomSpacer - range.bottomSpacer) < 2;

    if (sameRange) return true;

    app.virtualBoardLastRange = range;

    const anchorId = app.virtualBoardAnchorId;
    const anchorOffset = app.virtualBoardAnchorScrollOffset || 90;

    const frag = document.createDocumentFragment();
    const windowGrid = createVirtualWindowGrid();

    frag.appendChild(createVirtualSpacer(range.topSpacer, 'virtual-board-spacer virtual-board-spacer-top'));
    frag.appendChild(createVirtualSentinel('top'));

    for (let i = range.start; i < range.end; i++) {
      windowGrid.appendChild(createBoardEntryNode(entries[i]));
    }

    frag.appendChild(windowGrid);
    frag.appendChild(createVirtualSentinel('bottom'));
    frag.appendChild(createVirtualSpacer(range.bottomSpacer, 'virtual-board-spacer virtual-board-spacer-bottom'));

    applyVisibleLimitPageHeight(false);
    els.board.replaceChildren(frag);
    els.board.classList.add('virtual-board-active');
    els.board.dataset.virtualStart = String(range.start + 1);
    els.board.dataset.virtualEnd = String(range.end);
    els.board.dataset.virtualTotal = String(entries.length);
    els.board.dataset.virtualCenter = String(range.centerIndex || 0);
    els.board.dataset.virtualScroll = String(Math.round(range.scrollTopNow || 0));
    els.board.dataset.virtualHeight = String(Math.round(app.virtualBoardTotalHeight || 0));

    observeVirtualSentinels();

    if (anchorId) {
      requestAnimationFrame(() => {
        const node = els.board?.querySelector?.(`[data-id="${getCssSafeId(anchorId)}"]`);

        if (node) {
          const rect = node.getBoundingClientRect();
          const delta = rect.top - anchorOffset;

          if (Math.abs(delta) > 2) {
            const el = getScrollableElement();

            if (el && el !== document.body && el !== document.documentElement && el !== document.scrollingElement) {
              el.scrollTop += delta;
            } else {
              window.scrollTo({
                top: getBoardScrollTop() + delta,
                behavior: 'auto'
              });
            }
          }
        }

        app.virtualBoardAnchorId = null;
        app.virtualBoardAnchorScrollOffset = 0;
      });
    }

    window.MudaeMinimalImageLoader?.releaseVisible?.(els.board);
    window.MudaeGifControl?.refresh?.();

    return true;
  }
  function scheduleVirtualBoardWindowRender(force = false) {
    return false;
  }
  function startVirtualBoardWatchdog() {
    if (app.virtualBoardWatchdog) {
      clearInterval(app.virtualBoardWatchdog);
      app.virtualBoardWatchdog = null;
    }
  }


  function bindVirtualBoardScroll() {
    // Deprecated: v2.69 uses BoardGridController only.
  }


  function renderBoardVirtual(entries) {
    return false;
  }

  function getStickyDividerTopOffset() {
    const topbar = document.querySelector('.topbar, .app-topbar, header');
    const rect = topbar?.getBoundingClientRect?.();
    const base = rect && rect.height > 20 ? Math.round(rect.height) : 78;
    const extra = document.body.classList.contains('is-floating-active') || document.body.classList.contains('has-floating-bar') ? 6 : 0;
    return base + extra;
  }

  function ensureCompactStickyDividerBar() {
    let bar = document.getElementById('compactStickyDividerBar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'compactStickyDividerBar';
    bar.className = 'compact-sticky-divider-bar';
    bar.hidden = true;
    bar.innerHTML = `
      <div class="compact-sticky-divider-inner">
        <div class="compact-sticky-divider-main">
          <span class="compact-sticky-divider-icon">▾</span>
          <strong class="compact-sticky-divider-title"></strong>
          <span class="compact-sticky-divider-kind"></span>
        </div>
        <div class="compact-sticky-divider-actions"></div>
      </div>
    `;
    document.body.appendChild(bar);
    return bar;
  }

  function getDividerDisplayTitle(node) {
    if (!node) return '';
    const titleNode = node.querySelector?.('.divider-title, .divider-name, [data-divider-title], h2, h3, strong, .title');
    return String(titleNode?.textContent || node.dataset?.title || node.textContent || '').trim().replace(/\s+/g, ' ');
  }

  function cloneDividerActionsForSticky(dividerNode, bar) {
    const actions = bar.querySelector('.compact-sticky-divider-actions');
    if (!actions) return;

    actions.replaceChildren();

    const sourceActions = Array.from(dividerNode.querySelectorAll('button, [role="button"], .btn, a'))
      .filter(node => {
        const text = String(node.textContent || node.getAttribute?.('aria-label') || node.title || '').trim();
        if (!text) return false;
        if (node.closest?.('.compact-sticky-divider-bar')) return false;
        return /\$smp|sort|edit|delete|copy|section/i.test(text);
      })
      .slice(0, 5);

    sourceActions.forEach(source => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `compact-sticky-divider-action ${source.className || ''}`.trim();
      btn.textContent = String(source.textContent || source.getAttribute?.('aria-label') || source.title || '').trim();
      btn.title = source.title || btn.textContent;

      const sourceRow = source.closest?.('.divider-row');
      const actionText = btn.textContent.toLowerCase();
      btn.dataset.dividerId = source.dataset?.dividerId || sourceRow?.dataset?.id || '';
      btn.dataset.dividerAction = source.dataset?.dividerAction || (
        actionText.includes('edit') ? 'edit' :
        actionText.includes('delete') ? 'delete' :
        actionText.includes('sort') ? 'sort' :
        actionText.includes('smp') ? 'smp' : ''
      );

      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        source.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      });
      actions.appendChild(btn);
    });
  }

  function getCurrentDividerForSticky() {
    const board = els.board;
    if (!board) return null;

    const topOffset = getStickyDividerTopOffset() + 8;
    const dividers = Array.from(board.querySelectorAll('.divider-row'))
      .filter(node => {
        if (!node.offsetParent) return false;
        const rect = node.getBoundingClientRect();
        // Ignore rows far below viewport; keep the last divider that crossed top.
        return rect.top <= topOffset;
      });

    if (!dividers.length) return null;

    return dividers[dividers.length - 1];
  }

  function updateCompactStickyDivider() {
    const bar = ensureCompactStickyDividerBar();
    const divider = getCurrentDividerForSticky();

    if (!divider) {
      bar.hidden = true;
      bar.classList.remove('is-visible');
      bar.dataset.sourceId = '';
      return;
    }

    const title = getDividerDisplayTitle(divider);
    if (!title) {
      bar.hidden = true;
      bar.classList.remove('is-visible');
      return;
    }

    const sourceId = [
      divider.dataset?.id || divider.id || title,
      divider.dataset?.dividerKind || '',
      divider.dataset?.collapsed || '',
      title
    ].join('|');
    const top = getStickyDividerTopOffset();
    const boardRect = els.board?.getBoundingClientRect?.();
    const safeLeft = boardRect ? Math.max(12, Math.round(boardRect.left)) : 22;
    const safeWidth = boardRect ? Math.max(240, Math.round(boardRect.width)) : Math.max(240, window.innerWidth - 44);

    bar.style.setProperty('--compact-sticky-divider-top', `${top}px`);
    bar.style.setProperty('--compact-sticky-divider-left', `${safeLeft}px`);
    bar.style.setProperty('--compact-sticky-divider-width', `${safeWidth}px`);
    bar.hidden = false;
    bar.classList.add('is-visible');

    const titleNode = bar.querySelector('.compact-sticky-divider-title');
    const kindNode = bar.querySelector('.compact-sticky-divider-kind');
    const rawKind = String(divider.dataset?.dividerKind || '').toLowerCase();
    const levelText = String(divider.querySelector?.('.divider-level')?.textContent || '');
    const isSub = rawKind === 'subdivider' ||
      rawKind === 'sub-divider' ||
      divider.classList.contains('is-sub-divider') ||
      divider.classList.contains('sub-divider') ||
      divider.dataset?.dividerLevel === '2' ||
      /^SD#/i.test(levelText);

    bar.classList.toggle('is-subdivider-proxy', isSub);
    bar.classList.toggle('is-divider-proxy', !isSub);

    if (titleNode) titleNode.textContent = title;
    if (kindNode) {
      kindNode.textContent = isSub ? 'Sub-divider' : 'Divider';
      kindNode.hidden = false;
      kindNode.classList.toggle('is-subdivider', isSub);
      kindNode.classList.toggle('is-divider', !isSub);
    }

    if (bar.dataset.sourceId !== String(sourceId)) {
      bar.dataset.sourceId = String(sourceId);
      cloneDividerActionsForSticky(divider, bar);
    }
  }

  function bindCompactStickyDivider() {
    window.__mhpUpdateCompactStickyDivider = updateCompactStickyDivider;
    if (window.__mhpCompactStickyDividerBound) return;
    window.__mhpCompactStickyDividerBound = true;

    const update = () => {
      if (window.__mhpCompactStickyDividerRaf) return;
      window.__mhpCompactStickyDividerRaf = requestAnimationFrame(() => {
        window.__mhpCompactStickyDividerRaf = 0;
        updateCompactStickyDivider();
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    document.addEventListener('click', update, true);
    document.addEventListener('mudae:board-rendered', update);
    update();
  }


  function clearBoardControllerDomMode() {
    if (!els.board) return;

    els.board.classList.remove(
      'bgc-window-active',
      'bc-window-active',
      'visible-window-active',
      'virtual-board-active'
    );

    els.board.querySelectorAll?.(
      '.virtual-board-spacer,.virtual-sentinel,.virtual-board-window-grid,' +
      '.visible-window-spacer,.visible-window-sentinel,.visible-window-grid,' +
      '.bc-spacer,.bc-window-grid,' +
      '.bgc-spacer,.bgc-rows,.bgc-card-row'
    ).forEach(node => {
      // Only remove legacy/controller structural nodes when still left behind.
      if (
        node.classList.contains('virtual-board-spacer') ||
        node.classList.contains('virtual-sentinel') ||
        node.classList.contains('virtual-board-window-grid') ||
        node.classList.contains('visible-window-spacer') ||
        node.classList.contains('visible-window-sentinel') ||
        node.classList.contains('visible-window-grid') ||
        node.classList.contains('bc-spacer') ||
        node.classList.contains('bc-window-grid') ||
        node.classList.contains('bgc-spacer') ||
        node.classList.contains('bgc-rows') ||
        node.classList.contains('bgc-card-row')
      ) {
        node.remove();
      }
    });

    if (els.board.dataset) {
      [
        'bgcStart','bgcEnd','bgcRows','bgcTotal','bgcColumns',
        'bcStart','bcEnd','bcTotal','bcColumns',
        'visibleStart','visibleEnd','visibleTotal','visibleColumns','visibleCenter','visibleHeight',
        'virtualStart','virtualEnd','virtualTotal','virtualCenter','virtualScroll','virtualHeight'
      ].forEach(key => delete els.board.dataset[key]);
    }

    document.body.classList.remove('visible-card-limit-active', 'virtual-board-active');
    document.documentElement.classList.remove('visible-card-limit-active', 'virtual-board-active');
  }



  function getBoardColumnSetting() {
    return window.MudaeBoardController?.getColumnSetting?.() ?? 0;
  }

  function setBoardColumnSetting(columns) {
    window.MudaeBoardController?.setColumnSetting?.(columns);
  }

  function renderBoardNormalEntries(entries) {
    clearBoardControllerDomMode();
    const frag = document.createDocumentFragment();

    entries.forEach(entry => {
      frag.appendChild(createBoardEntryNode(entry));
    });

    els.board.classList.remove('bc-window-active');
    els.board.replaceChildren(frag);
    window.MudaeMinimalImageLoader?.releaseVisible?.(els.board);
    window.MudaeGifControl?.refresh?.();

    return true;
  }

  function renderBoard() {
    bindDelegatedExactPositionMove();
    rememberCurrentBoardImageUrls();
    assignBoardCounters();
    ++app.renderJob;
    ++app.restoreRenderJob;
    ++app.searchRenderJob;

    if (isIncompleteSearchCommand(getSearchInputValue())) {
      els.board.classList.remove('bc-window-active');
      clearBoardControllerDomMode();
      els.board.replaceChildren(createSearchCommandMessage());
      showSearchSuggestions();
      return;
    }

    if (hasTooShortSearchQuery()) {
      els.board.classList.remove('bc-window-active');
      clearBoardControllerDomMode();
      els.board.replaceChildren(createSearchMinCharsMessage());
      showSearchSuggestions();
      return;
    }

    const activeSearchInput = getActiveSearchInputElement();
    if (activeSearchInput && getSearchCommandSuggestions(activeSearchInput.value).length) {
      showSearchSuggestions(activeSearchInput);
    } else {
      hideSearchSuggestions({ force: true });
    }

    const terms = getSearchTerms();

    if (terms.length && shouldChunkSearchRender()) {
      clearVirtualBoardAnchorsForSearch('render-search');
      clearBoardControllerDomMode();
      renderBoardSearchChunked(terms);
      return;
    }

    const { entries, visibleChars } = collectFilteredBoardEntries(terms);
    app.lastBoardEntryCount = entries.length;

    if (!entries.length && !visibleChars) {
      els.board.classList.remove('bc-window-active');
      els.board.replaceChildren(createEmptyBoardMessage());
      return;
    }

    if (!terms.length) clearSearchTypingNoJumpGuard();

    if (!terms.length && window.MudaeBoardController?.renderEntries) {
      let rendered = false;

      try {
        rendered = !!window.MudaeBoardController.renderEntries(entries, createBoardEntryNode);
      } catch (error) {
        console.error('Board controller render failed; falling back to normal board render.', error);
        rendered = false;
      }

      if (rendered && els.board.children.length) {
        return;
      }

      console.debug?.('Board controller produced an empty board; falling back to normal board render.');
    }

    renderBoardNormalEntries(entries);
  }











  function createEmptyBoardMessage() {
    const empty = document.createElement('div');
    empty.className = 'divider-row';
    empty.textContent = 'No characters match the current filter.';
    return empty;
  }
  async function showDividerEditDialog(divider) {
    return window.MudaeDividers?.showDividerEditDialog?.(divider) ?? null;
  }
  async function editDivider(dividerId) {
    return window.MudaeDividers?.editDivider?.(dividerId) ?? false;
  }
  async function confirmDeleteDivider(dividerId) {
    return window.MudaeDividers?.confirmDeleteDivider?.(dividerId) ?? false;
  }
  function renderDivider(divider) {
    return window.MudaeDividers?.renderDivider?.(divider) || document.createElement('div');
  }













  function getSphereTotal(spheres) {
    if (!spheres || typeof spheres !== 'object') return 0;

    if (Number.isFinite(Number(spheres.total))) {
      return Math.max(0, Number(spheres.total) || 0);
    }

    const levels = Array.isArray(spheres.levels) ? spheres.levels : [];
    if (!levels.length) return 0;

    const costs = [200, 400, 600, 800, 1000, 2000];
    let total = 0;

    for (let i = 0; i < 10; i++) {
      const level = Math.max(0, num(levels[i]));
      if (!level) continue;

      if (i < 5) {
        for (let j = 0; j < Math.min(level, 6); j++) {
          total += costs[j] || 0;
        }
      } else {
        total += Math.min(level, 1) * 1000;
      }
    }

    return total;
  }

  function getSphereLevels(spheres) {
    if (!spheres || typeof spheres !== 'object') return [];

    if (Array.isArray(spheres.levels)) {
      const out = [];
      for (let i = 0; i < 10; i++) {
        const max = i < 5 ? 6 : 1;
        out.push(Math.max(0, Math.min(max, num(spheres.levels[i]))));
      }
      return out;
    }

    return [];
  }

  function isSphereMax(levels) {
    if (!Array.isArray(levels) || levels.length < 10) return false;
    for (let i = 0; i < 10; i++) {
      const max = i < 5 ? 6 : 1;
      if (num(levels[i]) < max) return false;
    }
    return true;
  }

  function formatSpherePerkLabel(spheres) {
    const levels = getSphereLevels(spheres);
    if (!levels.some(Boolean)) return '';

    if (isSphereMax(levels)) return 'SP MAX';

    const active = [];
    for (let i = 0; i < 10; i++) {
      if (num(levels[i]) > 0) active.push(i + 1);
    }

    if (!active.length) return '';

    return 'P' + active.join('+');
  }

  function formatSphereTooltip(spheres) {
    const levels = getSphereLevels(spheres);
    if (!levels.some(Boolean)) return '';

    const active = [];
    for (let i = 0; i < 10; i++) {
      const level = num(levels[i]);
      if (!level) continue;

      if (i < 5) active.push('P' + (i + 1) + ' Lv.' + level);
      else active.push('P' + (i + 1));
    }

    const total = getSphereTotal(spheres);
    return active.join(' · ') + (total ? ' · Total: ' + fmt(total) + ' SP' : '');
  }
  function getDividerCounterKind(item) {
    const level = Math.max(1, num(item?.level) || 1);
    return level > 1 ? 'subdivider' : 'divider';
  }
  function assignBoardCounters() {
    let boardIndex = 1;
    let characterIndex = 1;
    let dividerIndex = 1;
    let subdividerIndex = 1;

    app.state.characters.forEach(item => {
      item.boardIndex = boardIndex++;

      if (isDivider(item)) {
        if (!item.id) item.id = uid();
        item.displayCharacterIndex = 0;
        item.displayDividerIndex = 0;
        item.displaySubdividerIndex = 0;

        if (getDividerCounterKind(item) === 'subdivider') {
          item.displaySubdividerIndex = subdividerIndex++;
        } else {
          item.displayDividerIndex = dividerIndex++;
        }
        return;
      }

      ensureCharacterIdentity(item);
      item.owner = cleanParsedOwner(item.owner);
      item.displayCharacterIndex = characterIndex++;
      item.displayDividerIndex = 0;
      item.displaySubdividerIndex = 0;
    });

    app.state.boardCounts = {
      totalItems: boardIndex - 1,
      characters: characterIndex - 1,
      dividers: dividerIndex - 1,
      subdividers: subdividerIndex - 1
    };

    return app.state.boardCounts;
  }
  function getCharacterListPosition(id) {
    let n = 1;
    for (const item of app.state.characters) {
      if (isDivider(item)) continue;
      if (item.id === id) {
        item.displayCharacterIndex = n;
        return n;
      }
      n++;
    }
    return 0;
  }





  function collectFullBoardEntries() {
    const entries = [];
    const collapsedLevels = [];

    app.state.characters.forEach(item => {
      if (isDivider(item)) {
        const level = getDividerLevel(item);

        while (collapsedLevels.length && collapsedLevels[collapsedLevels.length - 1] >= level) {
          collapsedLevels.pop();
        }

        if (collapsedLevels.length) return;

        entries.push({ type: 'divider', item });

        if (item.collapsed) {
          collapsedLevels.push(level);
        }
      } else if (!collapsedLevels.length && characterPassesTypeFilter(item)) {
        entries.push({ type: 'card', item });
      }
    });

    return entries;
  }


  function createRestoringListMessage() {
    const row = document.createElement('div');
    row.className = 'divider-row search-restore-loading';
    row.textContent = 'Restoring list...';
    return row;
  }

  function renderBoardFullChunkedAndRestore(anchorBehavior = 'auto') {
    const jobId = ++app.restoreRenderJob;
    const renderJobId = ++app.renderJob;

    const entries = collectFullBoardEntries();
    const chunkSize = Math.max(40, Number(app.restoreRenderChunkSize) || 120);
    let cursor = 0;
    let firstChunk = true;

    els.board.replaceChildren(createRestoringListMessage());

    function appendRestoreChunk(deadline) {
      if (jobId !== app.restoreRenderJob || renderJobId !== app.renderJob) return;

      const frag = document.createDocumentFragment();
      let count = 0;

      while (cursor < entries.length && count < chunkSize) {
        frag.appendChild(createBoardEntryNode(entries[cursor++]));
        count++;

        if (deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() < 4) {
          break;
        }
      }

      if (firstChunk) {
        firstChunk = false;
        els.board.replaceChildren(frag);
      } else {
        els.board.appendChild(frag);
      }

      window.MudaeGifControl?.refresh?.();

      if (cursor < entries.length) {
        scheduleRenderChunk(appendRestoreChunk);
        return;
      }

      restoreSearchClearAnchor(anchorBehavior);
    }

    requestAnimationFrame(() => scheduleRenderChunk(appendRestoreChunk));
  }
  function getCharacterCount() {
    return app.state.characters.reduce((count, item) => count + (isDivider(item) ? 0 : 1), 0);
  }

  function getCharacterRawIndexByDisplayPosition(position) {
    let n = 1;

    for (let i = 0; i < app.state.characters.length; i++) {
      const item = app.state.characters[i];

      if (isDivider(item)) continue;

      if (n === position) return i;

      n++;
    }

    return -1;
  }

  function getCharacterRawIndexById(id) {
    return app.state.characters.findIndex(item => !isDivider(item) && item.id === id);
  }

  function canFastDomMoveBoard() {
    if (getActiveSearchQuery?.()) return false;
    if (app.filter?.type && app.filter.type !== 'all') return false;
    if (!els.board) return false;

    return true;
  }
  function updateExistingNodeCounters() {
    const itemById = new Map();

    app.state.characters.forEach(item => {
      if (item?.id) itemById.set(item.id, item);
    });

    for (const node of Array.from(els.board?.children || [])) {
      const item = itemById.get(node.dataset?.id);
      if (!item) continue;

      node.dataset.boardIndex = item.boardIndex || '';

      if (isDivider(item)) {
        const levelEl = node.querySelector('.divider-level');
        if (!levelEl) continue;

        const level = Math.max(1, num(item.level) || 1);
        const kind = getDividerCounterKind(item);
        const counter = kind === 'subdivider'
          ? item.displaySubdividerIndex || 0
          : item.displayDividerIndex || 0;

        node.dataset.dividerKind = kind;
        levelEl.textContent = kind === 'subdivider'
          ? `SD#${fmt(counter)} · L${level}`
          : `D#${fmt(counter)} · L${level}`;

        continue;
      }

      const posEl = node.querySelector('.card-position');
      if (posEl) {
        posEl.textContent = '#' + fmt(item.displayCharacterIndex || 0);
      }
    }
  }


  function updateVisibleCardCountersSequential() {
    let characterIndex = 1;
    let dividerIndex = 1;
    let subdividerIndex = 1;

    for (const node of Array.from(els.board?.children || [])) {
      if (node.classList.contains('char-card')) {
        const posEl = node.querySelector('.card-position');
        if (posEl) {
          posEl.textContent = '#' + fmt(characterIndex);
          posEl.title = 'Character position: #' + fmt(characterIndex);
        }
        characterIndex++;
        continue;
      }

      if (node.classList.contains('divider-row')) {
        const kind = node.dataset.dividerKind || 'divider';
        const levelEl = node.querySelector('.divider-level');
        const levelText = levelEl?.textContent?.match(/L\d+/)?.[0] || 'L1';

        if (levelEl) {
          if (kind === 'subdivider') {
            levelEl.textContent = `SD#${fmt(subdividerIndex++)} · ${levelText}`;
          } else {
            levelEl.textContent = `D#${fmt(dividerIndex++)} · ${levelText}`;
          }
        }
      }
    }
  }
  function scheduleVisibleCounterUpdate() {
    if (app.moveCounterTimer) {
      clearTimeout(app.moveCounterTimer);
      app.moveCounterTimer = null;
    }

    updateVisibleCardCountersSequential();
  }


  function getCharacterDisplayPositionById(id) {
    const item = app.state.characters.find(entry => !isDivider(entry) && entry.id === id);
    return item?.displayCharacterIndex || getCharacterListPosition(id) || 0;
  }
  function moveExistingNodeToTarget(sourceId, targetId, sourcePosition = getCharacterDisplayPositionById(sourceId), targetPosition = getCharacterDisplayPositionById(targetId)) {
    if (!canFastDomMoveBoard()) return false;

    const sourceNode = els.board?.querySelector?.(`[data-id="${getCssSafeId(sourceId)}"]`);
    const targetNode = els.board?.querySelector?.(`[data-id="${getCssSafeId(targetId)}"]`);

    if (!sourceNode || !targetNode || sourceNode === targetNode) return false;

    const targetParent = targetNode.parentNode;
    const sourceParent = sourceNode.parentNode;

    if (!targetParent || !sourceParent) return false;

    // In Visible Window mode, cards live inside .visible-window-grid, not directly under #board.
    // insertBefore must run on the parent that actually owns the target node.
    const insertParent = targetParent;

    els.board.classList.add('board-reordering');

    if (sourcePosition < targetPosition) {
      insertParent.insertBefore(sourceNode, targetNode.nextSibling);
    } else {
      insertParent.insertBefore(sourceNode, targetNode);
    }

    requestAnimationFrame(() => {
      els.board?.classList?.remove('board-reordering');
    });

    return true;
  }







  function reorderExistingBoardFromState(anchorId = null) {
    if (!canFastDomMoveBoard()) return false;

    const existing = new Map();

    Array.from(els.board.children).forEach(node => {
      if (node.dataset?.id) existing.set(node.dataset.id, node);
    });

    const frag = document.createDocumentFragment();
    let moved = 0;

    app.state.characters.forEach(item => {
      const node = existing.get(item.id);
      if (!node) return;

      frag.appendChild(node);
      moved++;
    });

    if (!moved) return false;

    els.board.replaceChildren(frag);
    updateExistingNodeCounters();

    if (anchorId) {
      const node = els.board.querySelector(`[data-id="${getCssSafeId(anchorId)}"]`);
      if (node) {
        node.classList.add('move-flash');
        setTimeout(() => node.classList.remove('move-flash'), 850);
      }
    }

    // Do not force image/GIF rescans here; the nodes are reused and images stay mounted.
    return true;
  }
  function scheduleMoveSave() {
    if (app.moveSaveTimer) {
      clearTimeout(app.moveSaveTimer);
      app.moveSaveTimer = null;
    }

    // Long debounce: movement must feel instant. Persistence can happen later.
    app.moveSaveTimer = setTimeout(() => {
      app.moveSaveTimer = null;

      const runSave = () => {
        try {
          saveLocal();
        } catch (error) {
          console.error('Deferred move save failed', error);
        }
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(runSave, { timeout: 5000 });
      } else {
        setTimeout(runSave, 1200);
      }
    }, 2500);
  }
  function commitBoardMove(anchorId = null) {
    assignBoardCounters();

    if (!reorderExistingBoardFromState(anchorId)) {
      renderBoard();
    }

    scheduleVisibleCounterUpdate();
    scheduleMoveSave();
  }
  function moveCharacterToPosition(id, targetPosition) {
    // v2.120 filtered exact move branch:
    if (isBoardFiltered()) {
      const actualSourceId =
        (typeof id !== 'undefined' && id) ||
        (typeof sourceId !== 'undefined' && sourceId) ||
        (typeof draggedId !== 'undefined' && draggedId) ||
        '';

      // Do not reference local names such as `target` here. A later `const target`
      // exists in the non-filtered branch, and `typeof target` would still hit the
      // temporal-dead-zone in this function scope. In this exact-position path the
      // requested destination is always the targetPosition argument.
      const actualTarget = Number(targetPosition) || 1;

      if (actualSourceId) {
        const sourcePositionBefore = typeof getCharacterDisplayPositionById === 'function'
          ? getCharacterDisplayPositionById(actualSourceId)
          : 0;

        const ok = moveCharacterToRealDisplayPositionById(actualSourceId, actualTarget);

        if (ok) {
          // Moving while filtered/searching should not clear the search.
          // Keep the current search session alive and only refresh the filtered
          // view in place. The saved search origin is used later when the user
          // manually clears the search.
          const keepScrollY = getPageScrollYPreservingModalLock();

          hideSearchSuggestions?.({ force: true });
          renderBoard();
          window.MudaeBoardController?.updateEntriesFromApp?.();

          requestAnimationFrame(() => {
            window.scrollTo({ top: keepScrollY, behavior: 'auto' });
          });

          window.MudaeExports?.recordChangedMoveById?.(actualSourceId, sourcePositionBefore, { radius: 1 });
        }

        return ok;
      }
    }




    assignBoardCounters();

    const sourceIndex = getCharacterRawIndexById(id);
    const sourcePosition = getCharacterListPosition(id);

    if (sourceIndex < 0 || !sourcePosition) return false;

    const total = getCharacterCount();
    const target = Math.max(1, Math.min(total, num(targetPosition)));

    if (!target || target === sourcePosition) return false;

    const [item] = app.state.characters.splice(sourceIndex, 1);

    assignBoardCounters();

    let insertIndex = getCharacterRawIndexByDisplayPosition(target);

    // If target is past the last existing character after removal, append at end.
    if (insertIndex < 0) {
      insertIndex = app.state.characters.length;
    }

    app.state.characters.splice(insertIndex, 0, item);

    assignBoardCounters();
    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderAroundId?.(id);
    window.MudaeBoardController?.scheduleSave?.();
    window.MudaeExports?.recordChangedMoveById?.(id, sourcePosition, { radius: 1 });

    return true;
  }








  function refreshVisibleWindowAfterMove() {
    if (getVisibleCardLimit() <= 0) return;
    if (!els.board?.classList?.contains('visible-window-active')) return;

    const terms = getSearchTerms();
    if (terms.length) return;

    const { entries } = collectFilteredBoardEntries(terms);
    app.visibleWindowEntries = entries;

    const built = buildVisibleWindowOffsets(entries);
    app.visibleWindowOffsets = built.offsets;
    app.visibleWindowAfterOffsets = built.afterOffsets;
    app.visibleWindowTotalHeight = built.total;
    app.visibleWindowColumns = built.columns;

    // Keep current start if possible, but clamp it after order changes.
    app.visibleWindowStartIndex = clampVisibleWindowStart(app.visibleWindowStartIndex || 0);
    app.visibleWindowLastRange = null;

    scheduleVisibleWindowRender(true);
  }

  function collectCurrentBoardEntries() {
    return collectFilteredBoardEntries(getSearchTerms());
  }

  function getBoardRenderedCharacterIds() {
    const ids = Array.from(document.querySelectorAll('.char-card[data-id]'))
      .map(node => node.dataset.id)
      .filter(Boolean);

    return Array.from(new Set(ids));
  }

  function getRealCharacterIndexById(id) {
    return app.state.characters.findIndex(item => !isDivider(item) && item.id === id);
  }

  function getRawItemIndexById(id) {
    return moveUtils?.getRawItemIndexById?.(id) ?? app.state.characters.findIndex(item => item?.id === id);
  }

  function getCurrentSearchValue() {
    return str(els.searchInput?.value || document.getElementById('floatingSearchInput')?.value || '').trim();
  }

  function isBoardFiltered() {
    return !!getCurrentSearchValue();
  }
  function moveCharacterByIdsInRealState(sourceId, targetId, placement = 'before') {
    return !!moveUtils?.moveCharacterByIdsInRealState?.(sourceId, targetId, placement);
  }




  function moveCharacterToRealDisplayPositionById(sourceId, targetPosition) {
    return !!moveUtils?.moveCharacterToRealDisplayPositionById?.(sourceId, targetPosition);
  }



  function moveCharacterRelativeToTargetDataOnly(sourceId, targetId, placement = null) {
    // v2.120 filtered move branch:
    // When filtered, move by stable card IDs in the real saved array.
    if (isBoardFiltered()) {
      const actualSourceId =
        (typeof sourceId !== 'undefined' && sourceId) ||
        (typeof draggedId !== 'undefined' && draggedId) ||
        (typeof id !== 'undefined' && id) ||
        '';

      const actualTargetId =
        (typeof targetId !== 'undefined' && targetId) ||
        (typeof overId !== 'undefined' && overId) ||
        (typeof targetCharacterId !== 'undefined' && targetCharacterId) ||
        '';

      const sourcePositionBefore = actualSourceId
        ? (typeof getCharacterDisplayPositionById === 'function'
          ? getCharacterDisplayPositionById(actualSourceId)
          : getCharacterListPosition(actualSourceId))
        : 0;

      const targetPositionBefore = actualTargetId
        ? (typeof getCharacterDisplayPositionById === 'function'
          ? getCharacterDisplayPositionById(actualTargetId)
          : getCharacterListPosition(actualTargetId))
        : 0;

      const explicitPlacement =
        placement ||
        (typeof position !== 'undefined' && position) ||
        (typeof insertMode !== 'undefined' && insertMode) ||
        '';

      const actualPlacement = explicitPlacement || (
        sourcePositionBefore && targetPositionBefore && sourcePositionBefore < targetPositionBefore
          ? 'after'
          : 'before'
      );

      if (actualSourceId && actualTargetId) {
        const ok = moveCharacterByIdsInRealState(actualSourceId, actualTargetId, actualPlacement);

        if (ok) {
          renderAll();
          window.MudaeBoardController?.updateEntriesFromApp?.();
          window.MudaeBoardController?.renderAroundId?.(actualSourceId);
          window.MudaeExports?.recordChangedMoveById?.(actualSourceId, sourcePositionBefore, { radius: 1 });
        }

        return ok;
      }
    }




    if (!sourceId || !targetId || sourceId === targetId) return false;

    assignBoardCounters();

    const sourcePosition = getCharacterListPosition(sourceId);
    const targetPosition = getCharacterListPosition(targetId);
    const sourceIndex = getCharacterRawIndexById(sourceId);

    if (sourceIndex < 0 || !sourcePosition || !targetPosition) return false;

    const movingForward = sourcePosition < targetPosition;
    const [item] = app.state.characters.splice(sourceIndex, 1);

    assignBoardCounters();

    const targetIndexAfterRemoval = getCharacterRawIndexById(targetId);

    if (targetIndexAfterRemoval < 0) {
      app.state.characters.splice(sourceIndex, 0, item);
      assignBoardCounters();
      return false;
    }

    const insertIndex = movingForward
      ? Math.min(app.state.characters.length, targetIndexAfterRemoval + 1)
      : targetIndexAfterRemoval;

    app.state.characters.splice(insertIndex, 0, item);

    assignBoardCounters();

    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderAroundId?.(sourceId);
    window.MudaeBoardController?.scheduleSave?.();
    window.MudaeExports?.recordChangedMoveById?.(sourceId, sourcePosition, { radius: 1 });

    return true;
  }


  function moveCharacterRelativeToTarget(sourceId, targetId, placement = null) {
    return moveCharacterRelativeToTargetDataOnly(sourceId, targetId, placement);
  }

  function getMoveCharacterLabel(item, fallback = '—') {
    if (!item) return fallback;
    if (isDivider(item)) {
      const kind = getDividerCounterKind(item) === 'subdivider' ? 'Sub-divider' : 'Divider';
      return `${kind}: ${item.title || 'Untitled'}`;
    }

    const pos = getCharacterListPosition(item.id);
    const series = str(item.series || '').trim();
    return `#${pos || '?'} ${item.name || 'Unnamed'}${series ? ` · ${series}` : ''}`;
  }

  function getMovePreviewCharacterAt(list, displayPosition) {
    const wanted = Number(displayPosition) || 0;
    if (wanted < 1) return null;

    let current = 1;
    for (const item of list || []) {
      if (!item || isDivider(item)) continue;
      if (current === wanted) return item;
      current += 1;
    }

    return null;
  }

  function getMoveRawIndexForDisplayPositionInList(list, displayPosition) {
    const target = Math.max(1, Number(displayPosition) || 1);
    let current = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || isDivider(item)) continue;
      current += 1;
      if (current === target) return i;
    }

    return list.length;
  }

  function findDividerBeforeRawIndex(list, rawIndex) {
    for (let i = Math.min(rawIndex - 1, list.length - 1); i >= 0; i--) {
      const item = list[i];
      if (isDivider(item)) return { item, index: i };
    }
    return null;
  }

  function findDividerAtOrAfterRawIndex(list, rawIndex) {
    for (let i = Math.max(0, rawIndex); i < list.length; i++) {
      const item = list[i];
      if (isDivider(item)) return { item, index: i };
    }
    return null;
  }

  function getMovePositionContext(sourceId, targetPosition) {
    const total = getCharacterCount();
    const target = Math.max(1, Math.min(total, num(targetPosition) || 1));
    const source = getCharacter(sourceId);
    const workingList = (app.state.characters || []).filter(item => item?.id !== sourceId);

    const rawInsertIndex = getMoveRawIndexForDisplayPositionInList(workingList, target);
    const previousCharacter = getMovePreviewCharacterAt(workingList, target - 1);
    const targetCharacter = getMovePreviewCharacterAt(workingList, target);
    const nextCharacter = getMovePreviewCharacterAt(workingList, target + 1);

    const previousRawItem = workingList[rawInsertIndex - 1] || null;
    const nextRawItem = workingList[rawInsertIndex] || null;

    const previousDivider = findDividerBeforeRawIndex(workingList, rawInsertIndex);
    const nextDivider = findDividerAtOrAfterRawIndex(workingList, rawInsertIndex);

    const choices = [
      {
        id: 'default',
        label: 'Default position',
        detail: targetCharacter
          ? `Place before ${getMoveCharacterLabel(targetCharacter)}`
          : 'Place at the end of the list',
        rawInsertIndex
      }
    ];

    if (previousDivider?.item) {
      const previousSectionInsertIndex = nextDivider?.item
        ? nextDivider.index
        : workingList.length;

      choices.push({
        id: 'previous-divider',
        label: `Keep inside previous divider`,
        detail: `${previousDivider.item.title || 'Previous divider'} · insert before the next divider/end`,
        dividerTitle: previousDivider.item.title || '',
        rawInsertIndex: previousSectionInsertIndex
      });
    }

    if (nextDivider?.item) {
      choices.push({
        id: 'next-divider',
        label: `Move into next divider`,
        detail: `${nextDivider.item.title || 'Next divider'} · insert right after that divider`,
        dividerTitle: nextDivider.item.title || '',
        rawInsertIndex: Math.min(workingList.length, nextDivider.index + 1)
      });
    }

    choices.push({
      id: 'new-divider',
      label: 'Create new divider with this character',
      detail: `Create a divider at this position and place ${source?.name || 'this character'} directly under it`,
      rawInsertIndex
    });

    const uniqueChoices = [];
    const seen = new Set();
    choices.forEach(choice => {
      const key = `${choice.id}:${choice.rawInsertIndex}`;
      if (seen.has(key)) return;
      seen.add(key);
      uniqueChoices.push(choice);
    });

    return {
      source,
      target,
      total,
      workingList,
      rawInsertIndex,
      previousCharacter,
      targetCharacter,
      nextCharacter,
      previousRawItem,
      nextRawItem,
      previousDivider,
      nextDivider,
      choices: uniqueChoices
    };
  }


  function moveCharacterWithNewDivider(sourceId, rawInsertIndex, title = '', level = 1) {
    const sourceIndex = getCharacterRawIndexById(sourceId);
    const sourcePosition = getCharacterListPosition(sourceId);

    if (sourceIndex < 0 || !sourcePosition) return false;

    const [item] = app.state.characters.splice(sourceIndex, 1);
    const insertIndex = Math.max(0, Math.min(app.state.characters.length, Number(rawInsertIndex) || 0));

    const divider = {
      id: makeId?.() || `divider-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'divider',
      title: String(title || item.series || item.name || 'New divider').trim(),
      note: '',
      level: Math.max(1, Math.min(2, Number(level) || 1)),
      color: Number(level) > 1 ? '#38bdf8' : '#8b5cf6',
      collapsed: false
    };

    app.state.characters.splice(insertIndex, 0, divider, item);

    assignBoardCounters();
    invalidateSearchCache();
    saveLocal();

    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderAroundId?.(sourceId);
    window.MudaeBoardController?.scheduleSave?.();
    window.MudaeExports?.recordChangedMoveById?.(sourceId, sourcePosition, { radius: 1 });

    return true;
  }


  function moveCharacterToRawInsertIndex(sourceId, rawInsertIndex) {
    const sourceIndex = getCharacterRawIndexById(sourceId);
    const sourcePosition = getCharacterListPosition(sourceId);

    if (sourceIndex < 0 || !sourcePosition) return false;

    const [item] = app.state.characters.splice(sourceIndex, 1);
    let insertIndex = Math.max(0, Math.min(app.state.characters.length, Number(rawInsertIndex) || 0));

    // rawInsertIndex is calculated against the list without the source item.
    app.state.characters.splice(insertIndex, 0, item);

    assignBoardCounters();
    invalidateSearchCache();
    saveLocal();

    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderAroundId?.(sourceId);
    window.MudaeBoardController?.scheduleSave?.();
    window.MudaeExports?.recordChangedMoveById?.(sourceId, sourcePosition, { radius: 1 });

    return true;
  }

  function renderMoveCharacterContext(content, state) {
    const shortLabel = (item, fallback = '—') => getMoveCharacterLabel(item, fallback);

    const update = () => {
      const target = Math.max(1, Math.min(state.total, num(state.input.value) || 1));
      state.context = getMovePositionContext(state.sourceId, target);

      const ctx = state.context;
      const valid = !!target && target >= 1 && target <= state.total;
      state.input.classList.toggle('is-invalid-move-target', !valid);

      const rows = [
        { label: `#${Math.max(1, target - 1)}`, item: ctx.previousCharacter, role: 'Before' },
        { label: `#${target}`, item: ctx.targetCharacter, role: 'Target' },
        { label: `#${Math.min(state.total, target + 1)}`, item: ctx.nextCharacter, role: 'After' }
      ];

      state.preview.innerHTML = rows.map(row => {
        const label = shortLabel(row.item, row.role === 'Target' ? 'End of list' : '—');
        return `
          <div class="move-context-row ${row.role === 'Target' ? 'is-target' : ''}">
            <span class="move-context-pos">${escapeHtml(row.label)}</span>
            <span class="move-context-role">${escapeHtml(row.role)}</span>
            <strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
          </div>
        `;
      }).join('');

      const beforeRaw = ctx.previousRawItem ? shortLabel(ctx.previousRawItem) : 'Start of list';
      const afterRaw = ctx.nextRawItem ? shortLabel(ctx.nextRawItem) : 'End of list';

      state.boundary.innerHTML = `
        <span><b>Before raw</b>${escapeHtml(beforeRaw)}</span>
        <span><b>After raw</b>${escapeHtml(afterRaw)}</span>
      `;

      state.choices.innerHTML = ctx.choices.map((choice, index) => `
        <label class="move-divider-choice ${choice.id === 'new-divider' ? 'is-new-divider' : ''} ${index === 0 ? 'is-default' : ''}">
          <input type="radio" name="moveDividerChoice" value="${escapeHtml(choice.id)}" ${state.choiceId === choice.id || (!state.choiceId && index === 0) ? 'checked' : ''}>
          <span>
            <strong>${escapeHtml(choice.label)}</strong>
            <small>${escapeHtml(choice.detail || '')}</small>
          </span>
        </label>
      `).join('');

      state.choiceId = state.choices.querySelector('input:checked')?.value || 'default';

      const syncNewDividerPanel = () => {
        const isNew = state.choiceId === 'new-divider';
        state.newDividerPanel.hidden = !isNew;
        state.newDividerPanel.classList.toggle('is-visible', isNew);

        if (isNew && !state.newDividerTitle.value.trim()) {
          const source = getCharacter(state.sourceId);
          state.newDividerTitle.value = source?.series || source?.name || 'New divider';
        }
      };

      state.choices.querySelectorAll('input[name="moveDividerChoice"]').forEach(input => {
        input.addEventListener('change', () => {
          state.choiceId = input.value;
          syncNewDividerPanel();
        });
      });

      syncNewDividerPanel();
    };

    const source = getCharacter(state.sourceId);
    const defaultDividerTitle = source?.series || source?.name || 'New divider';

    content.innerHTML = `
      <div class="move-character-dialog mhp-menu-standard mhp-move-menu">
        <label class="move-character-input-row mhp-menu-field-row">
          <span>Target position</span>
          <input id="moveCharacterTargetInput" type="number" min="1" max="${state.total}" value="${state.current || ''}" inputmode="numeric">
        </label>

        <section class="move-character-section">
          <h4>Position context</h4>
          <div class="move-character-context-preview"></div>
        </section>

        <section class="move-character-section">
          <h4>Raw boundary</h4>
          <div class="move-character-boundary"></div>
        </section>

        <section class="move-character-section">
          <h4>Placement</h4>
          <div class="move-divider-choice-list"></div>
          <div class="move-new-divider-panel" hidden>
            <label>
              <span>New divider title</span>
              <input id="moveNewDividerTitle" type="text" value="${escapeHtml(defaultDividerTitle)}">
            </label>
            <label>
              <span>Type</span>
              <select id="moveNewDividerLevel">
                <option value="1">Divider</option>
                <option value="2">Sub-divider</option>
              </select>
            </label>
          </div>
        </section>
      </div>
    `;

    state.input = content.querySelector('#moveCharacterTargetInput');
    state.preview = content.querySelector('.move-character-context-preview');
    state.boundary = content.querySelector('.move-character-boundary');
    state.choices = content.querySelector('.move-divider-choice-list');
    state.newDividerPanel = content.querySelector('.move-new-divider-panel');
    state.newDividerTitle = content.querySelector('#moveNewDividerTitle');
    state.newDividerLevel = content.querySelector('#moveNewDividerLevel');

    state.input.addEventListener('input', update);
    state.input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        content.closest('.app-dialog-overlay')?.querySelector('.app-dialog-btn.btn-primary')?.click();
      }
    });

    update();

    requestAnimationFrame(() => {
      content.closest?.('.app-dialog, [role="dialog"], .app-dialog-overlay')?.classList?.add('move-character-modal');
      state.input.focus({ preventScroll: true });
      state.input.select();
    });
  }

  async function promptMoveCharacter(id) {
    const ch = getCharacter(id);
    if (!ch || isDivider(ch)) return;

    const current = getCharacterListPosition(id);
    const total = getCharacterCount();

    const dialogState = {
      sourceId: id,
      current,
      total,
      choiceId: 'default',
      context: getMovePositionContext(id, current)
    };

    const ok = await showAppDialog({
      type: 'confirm',
      title: 'Move character',
      message: 'Choose a target position.',
      okText: 'Move',
      cancelText: 'Cancel',
      renderContent(content) {
        renderMoveCharacterContext(content, dialogState);
      }
    });

    if (!ok) return;

    const target = num(dialogState.input?.value);

    if (!target || target < 1 || target > total) {
      showAppAlert(`Invalid position. Use 1-${fmt(total)}.`, {
        title: 'Invalid position',
        variant: 'danger'
      });
      return;
    }

    const ctx = getMovePositionContext(id, target);
    const choice = ctx.choices.find(item => item.id === dialogState.choiceId) || ctx.choices[0];

    if (choice?.id === 'new-divider') {
      const title = dialogState.newDividerTitle?.value?.trim() || ch.series || ch.name || 'New divider';
      const level = num(dialogState.newDividerLevel?.value) || 1;
      moveCharacterWithNewDivider(id, choice.rawInsertIndex, title, level);
      return;
    }

    if (choice && choice.id !== 'default') {
      moveCharacterToRawInsertIndex(id, choice.rawInsertIndex);
      return;
    }

    moveCharacterToPosition(id, target);
  }


  function clearCharacterDropIndicators() {
    els.board?.querySelectorAll?.('.drag-over-target,.dragging-character,.pointer-drag-source').forEach(node => {
      node.classList.remove('drag-over-target', 'dragging-character', 'pointer-drag-source');
    });
  }
  function isMovePointerBlockedTarget(target) {
    // Movement is intentionally handle-only to avoid expensive pointer/drag work
    // on the full image-heavy card.
    return !target?.closest?.('.card-position-move');
  }



  function getPointerMoveTarget(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest?.('.char-card[data-id]');
    if (!card) return null;

    const id = card.dataset.id;
    if (!id || id === app.pointerMoveDrag?.id) return null;

    return card;
  }

  function updatePointerMoveTarget(clientX, clientY) {
    if (!app.pointerMoveDrag?.active) return;

    const target = getPointerMoveTarget(clientX, clientY);

    if (app.pointerMoveDrag.targetNode === target) return;

    if (app.pointerMoveDrag.targetNode) {
      app.pointerMoveDrag.targetNode.classList.remove('drag-over-target');
    }

    app.pointerMoveDrag.targetNode = target;

    if (target) {
      target.classList.add('drag-over-target');
    }
  }
  function cancelPointerMoveDrag() {
    if (!app.pointerMoveDrag) return;

    const { sourceNode, targetNode, moveHandler, upHandler, cancelHandler } = app.pointerMoveDrag;

    document.removeEventListener('pointermove', moveHandler, true);
    document.removeEventListener('pointerup', upHandler, true);
    document.removeEventListener('pointercancel', cancelHandler, true);

    sourceNode?.classList?.remove('pointer-drag-source', 'dragging-character');
    targetNode?.classList?.remove('drag-over-target');

    app.pointerMoveDrag = null;
    app.draggedCharacterId = null;
    document.body.classList.remove('is-pointer-moving-character');
  }
  function startPointerMoveDrag(event, ch, node) {
    if (event.button !== 0) return;
    if (isMovePointerBlockedTarget(event.target)) return;

    const startX = event.clientX;
    const startY = event.clientY;

    const moveHandler = moveEvent => {
      const state = app.pointerMoveDrag;
      if (!state || state.id !== ch.id) return;

      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);

      if (!state.active) {
        if (dx + dy < 4) return;

        state.active = true;
        app.draggedCharacterId = ch.id;

        node.classList.add('pointer-drag-source');
        document.body.classList.add('is-pointer-moving-character');
      }

      moveEvent.preventDefault();
      updatePointerMoveTarget(moveEvent.clientX, moveEvent.clientY);
    };

    const upHandler = upEvent => {
      const state = app.pointerMoveDrag;
      if (!state || state.id !== ch.id) return;

      const targetNode = state.targetNode;
      const targetId = targetNode?.dataset?.id || null;
      const wasActive = !!state.active;

      cancelPointerMoveDrag();

      if (!wasActive || !targetId || targetId === ch.id) return;

      upEvent.preventDefault();
      moveCharacterRelativeToTarget(ch.id, targetId);
    };

    const cancelHandler = () => {
      cancelPointerMoveDrag();
    };

    app.pointerMoveDrag = {
      id: ch.id,
      sourceNode: node,
      targetNode: null,
      active: false,
      moveHandler,
      upHandler,
      cancelHandler
    };

    document.addEventListener('pointermove', moveHandler, true);
    document.addEventListener('pointerup', upHandler, true);
    document.addEventListener('pointercancel', cancelHandler, true);
  }


  function clearSelectedMoveCharacter() {
    if (!app.selectedMoveCharacterId) return;

    const old = els.board?.querySelector?.(`[data-id="${getCssSafeId(app.selectedMoveCharacterId)}"]`);
    old?.classList?.remove('move-source-selected');

    app.selectedMoveCharacterId = null;
    document.body.classList.remove('is-two-click-moving-character');
  }

  function setSelectedMoveCharacter(id) {
    clearSelectedMoveCharacter();

    app.selectedMoveCharacterId = id;

    const node = els.board?.querySelector?.(`[data-id="${getCssSafeId(id)}"]`);
    node?.classList?.add('move-source-selected');

    document.body.classList.add('is-two-click-moving-character');
  }

  function handleMoveNumberClick(event, ch) {
    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      clearSelectedMoveCharacter();
      promptMoveCharacterSafe(ch.id);
      return;
    }

    if (!app.selectedMoveCharacterId) {
      setSelectedMoveCharacter(ch.id);
      showToast?.(`Selected ${ch.name}. Click another # to move it there.`);
      return;
    }

    if (app.selectedMoveCharacterId === ch.id) {
      clearSelectedMoveCharacter();
      showToast?.('Move cancelled.');
      return;
    }

    const sourceId = app.selectedMoveCharacterId;
    clearSelectedMoveCharacter();
    moveCharacterRelativeToTarget(sourceId, ch.id);
  }
  function bindMoveCancelShortcut() {
    if (app.moveCancelShortcutBound) return;
    app.moveCancelShortcutBound = true;

    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!app.selectedMoveCharacterId) return;

      clearSelectedMoveCharacter();
      showToast?.('Move cancelled.');
    });
  }
  function notifyMoveMessage(message) {
    if (!message) return;

    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }

    if (typeof showNotification === 'function') {
      showNotification(message);
      return;
    }

    console.info(message);
  }
  function findCardPositionElement(node) {
    if (!node) return null;

    return node.querySelector(MOVE_POSITION_SELECTOR);
  }


  const MOVE_POSITION_SELECTOR = [
    '.card-position',
    '.card-position-click-target',
    '.card-position-move',
    '.card-position-exact-move',
    '.char-position',
    '.character-position',
    '.rank-badge',
    '.card-rank',
    '.char-rank',
    '[data-role="position"]',
    '[data-role="rank"]',
    '[data-position]'
  ].join(',');

  function getCharacterIdFromMoveNode(node) {
    return node?.closest?.('.char-card[data-id], [data-id]')?.dataset?.id || null;
  }
  async function promptMoveCharacterSafe(characterId) {
    if (!characterId) return false;

    window.MudaeBoardController?.clearSelection?.();

    if (typeof promptMoveCharacter === 'function') {
      await promptMoveCharacter(characterId);
      return true;
    }

    assignBoardCounters?.();

    const current = getCharacterListPosition?.(characterId) || '';
    const total = getCharacterCount?.() || app.state.characters.filter(item => !isDivider(item)).length;
    const raw = await showAppPrompt(`Move character to position 1-${total}:`, current, {
      title: 'Move character',
      inputLabel: 'Target position',
      okText: 'Move'
    });

    if (raw == null) return false;

    const target = num(raw);

    if (!target || target < 1 || target > total) {
      notifyMoveMessage?.(`Invalid position. Use a number from 1 to ${total}.`);
      return false;
    }

    return moveCharacterToPosition(characterId, target);
  }



  function handleExactPositionClickFromBoard(event) {
    const hit = event.target?.closest?.(MOVE_POSITION_SELECTOR);

    if (!hit || !els.board?.contains?.(hit)) return;

    const characterId = getCharacterIdFromMoveNode(hit);

    if (!characterId) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    promptMoveCharacterSafe(characterId);
  }

  function bindDelegatedExactPositionMove() {
    if (!els.board || app.exactPositionMoveDelegatedBound) return;

    app.exactPositionMoveDelegatedBound = true;

    els.board.addEventListener('click', handleExactPositionClickFromBoard, true);
    els.board.addEventListener('pointerup', event => {
      const hit = event.target?.closest?.(MOVE_POSITION_SELECTOR);
      if (!hit || !els.board?.contains?.(hit)) return;
      event.stopPropagation();
    }, true);
  }

  function decorateMovableCharacterCard(node, ch) {
    if (!node || !ch || isDivider(ch)) return node;

    node.draggable = false;
    node.classList.add('movable-character-card');
    node.title = node.title || 'Click image to select/move. Click # to move to an exact position.';

    const openExactPositionMove = event => {
      event.preventDefault();
      event.stopPropagation();

      window.MudaeBoardController?.clearSelection?.();
      promptMoveCharacterSafe(ch.id);
    };

    const runTwoClickMove = event => {
      const positionHit = event.target?.closest?.(
        '.card-position,' +
        '.char-position,' +
        '.character-position,' +
        '.rank-badge,' +
        '.card-rank,' +
        '.char-rank,' +
        '[data-role="position"],' +
        '[data-role="rank"],' +
        '[data-position]'
      );

      if (positionHit) return;

      event.preventDefault();
      event.stopPropagation();

      if (app.multiSelectMode) {
        if (app.multiMoveTargetMode) {
          moveSelectedCharactersRelativeToTargetDataOnly(ch.id, 'before');
          return;
        }

        toggleCardMultiSelection(ch.id);
        return;
      }

      const selected = window.MudaeBoardController?.getSelectedMoveId?.();

      if (!selected) {
        window.MudaeBoardController?.selectMoveSource?.(ch.id);
        notifyMoveMessage(`Selected ${ch.name}. Click another image to move it there.`);
        return;
      }

      if (selected === ch.id) {
        window.MudaeBoardController?.clearSelection?.();
        notifyMoveMessage('Move cancelled.');
        return;
      }

      window.MudaeBoardController?.moveSourceToTarget?.(ch.id);
    };

    const img = node.querySelector('img');
    if (img) {
      img.draggable = false;
      img.classList.add('card-image-move-target');
      img.title = 'Click image to select/move this character';
      img.addEventListener('click', runTwoClickMove);
    }

    const imageArea = node.querySelector('.card-image, .char-image, .card-img-wrap, .image-wrap, .char-img-wrap, .card-media, .char-media');
    if (imageArea && imageArea !== img) {
      imageArea.classList.add('card-image-move-target');
      imageArea.title = 'Click image to select/move this character';
      imageArea.addEventListener('click', runTwoClickMove);
    }

    const positionBtn = findCardPositionElement(node);
    if (positionBtn) {
      positionBtn.classList.add('card-position-move', 'card-position-exact-move');
      positionBtn.title = 'Click to move this character to an exact position';
      positionBtn.setAttribute('role', 'button');
      positionBtn.tabIndex = 0;

      positionBtn.addEventListener('click', openExactPositionMove, true);

      positionBtn.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        openExactPositionMove(event);
      });
    }

    return node;
  }














  function renderCard(ch) {
    normalizeCharacterImageGallery(ch);
    const displayPosition = getCharacterListPosition(ch.id);

    const node = window.MudaeRebuildCards.renderCard(ch, {
      cardTemplate: els.cardTemplate,
      fmt,
      hasRealImage,
      placeholderSvg,
      getCharacterListPosition: () => displayPosition,
      displayPosition,
      getGenderType,
      getRouletteWorldType,
      genderLabel,
      rouletteWorldLabel,
      getDisplayKeyType,
      LOCAL_ASSET_PATHS,
      KEY_ICONS,
      createLocalIcon,
      getKakeraIconPath,
      getKeyLabel,
      getSphereLevels,
      isSphereMax,
      formatSpherePerkLabel,
      formatSphereTooltip,
      getSphereTotal,
      normalizeUrls,
      getUniqueGalleryImageCount,
      openEdit,
      openEditColorPalette,
      getGroupLabelForCharacter
    });

    return decorateMovableCharacterCard(node, ch);
  }





function openEdit(id) {
    if (window.MHPEditGalleryController?.shouldBlockOpen?.(id, 'openEdit')) {
      return false;
    }
    if (isEditClosingLocked()) {
      return false;
    }

    const ch = getCharacter(id);
    if (!ch) return false;

    const node = els.board?.querySelector?.(`.char-card[data-id="${getCssSafeId(id)}"]`);
    app.editOpenAnchor = {
      id,
      top: node?.getBoundingClientRect?.().top ?? 120,
      scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      savedAt: Date.now()
    };

    app.activeId = id;
    app.editSessionToken = (Number(app.editSessionToken || 0) + 1);
    app.editSessionId = id;
    window.__mhpEditSessionToken = app.editSessionToken;
    window.__mhpEditSessionId = id;
    window.__mhpEditClosingUntil = 0;
    window.__mhpSuppressEditOpenUntil = 0;
    document.documentElement.classList.remove('mhp-edit-closing');
    document.body?.classList?.remove('mhp-edit-closing');

    // Restored from the known-good functional build:
    // edit opens normally, then gallery is handled by the original app logic.
    els.editOverlay.classList.add('show', 'is-fast-paint');
    els.editOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    fillEditShellOnly(ch);

    requestAnimationFrame(() => {
      if (app.activeId !== id || !els.editOverlay.classList.contains('show')) return;

      fillEdit(ch);
      clearGallery(false);
      closeGallery(false);
      els.editOverlay.classList.remove('is-fast-paint');

      requestAnimationFrame(() => {
        if (app.activeId !== id || !els.editOverlay.classList.contains('show')) return;

        const urls = normalizeUrls(ch.mudaeImages);
        const effectiveGalleryCount = getEffectiveMudaeGalleryCount(ch);
        if (effectiveGalleryCount > 0 && urls.length > 1) {
          openGallery('saved');
          renderGallery(buildGalleryItemsFromCharacter(ch), { fastOpen: true });
          setGalleryStatus('Loaded saved gallery automatically.');
        } else if (!hasRealImage(ch.image)) {
          setTimeout(() => {
            if (app.activeId === id && els.editOverlay.classList.contains('show')) {
              autoSearchMudae();
            }
          }, 450);
        }
      });
    });
  }

  function cancelEditSession(suppressMs = 0) {
    const duration = Math.max(0, Number(suppressMs) || 0);
    const now = performance.now ? performance.now() : Date.now();
    const until = duration ? now + duration : 0;

    app.editSessionToken = (Number(app.editSessionToken || 0) + 1);
    app.editSessionId = null;
    window.__mhpEditSessionToken = app.editSessionToken;
    window.__mhpEditSessionId = null;
    window.__mhpEditClosingUntil = until;
    window.__mhpSuppressEditOpenUntil = until;

    if (duration) {
      document.documentElement.classList.add('mhp-edit-closing');
      document.body?.classList?.add('mhp-edit-closing');
      window.MHPEditGalleryController?.markClosing?.(duration, 'cancelEditSession');
      clearTimeout(app.editClosingClassTimer);
      app.editClosingClassTimer = setTimeout(() => {
        const t = performance.now ? performance.now() : Date.now();
        if (t >= Number(window.__mhpEditClosingUntil || 0)) {
          document.documentElement.classList.remove('mhp-edit-closing');
          document.body?.classList?.remove('mhp-edit-closing');
        }
      }, duration + 80);
    } else {
      document.documentElement.classList.remove('mhp-edit-closing');
      document.body?.classList?.remove('mhp-edit-closing');
    }
  }

  function isEditClosingLocked() {
    const now = performance.now ? performance.now() : Date.now();
    const until = Math.max(
      Number(window.__mhpEditClosingUntil || 0),
      Number(window.__mhpSuppressEditOpenUntil || 0),
      Number(window.MHPEditGalleryController?.getSuppressUntil?.() || 0)
    );
    if (now >= until) return false;

    // v2.635: stale post-save/post-match suppress windows should not eat
    // real user clicks when the edit modal is already fully closed.
    const overlayOpen = !!els.editOverlay?.classList?.contains('show');
    const stillClosing = document.documentElement.classList.contains('mhp-edit-closing') ||
      document.body?.classList?.contains('mhp-edit-closing');
    return overlayOpen || stillClosing;
  }

  function closeEdit(suppressMs = 650) {
    if (suppressMs) {
      const duration = Math.max(0, Number(suppressMs) || 0);
      const now = performance.now ? performance.now() : Date.now();
      const until = now + duration;
      window.__mhpEditClosingUntil = Math.max(Number(window.__mhpEditClosingUntil || 0), until);
      window.__mhpSuppressEditOpenUntil = Math.max(Number(window.__mhpSuppressEditOpenUntil || 0), until);
      window.MHPEditGalleryController?.markClosing?.(duration, 'closeEdit');
    }

    toggleEditColorPalette(false);
    closeGallery(false);
    els.editOverlay.classList.remove('show', 'is-fast-paint');
    els.editOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    unlockPageScrollIfAllowed();
    app.activeId = null;
    app.selectedGalleryIndex = null;
    app.editOpenAnchor = null;
    app.editSessionId = null;
    window.__mhpEditSessionId = null;
  }

  function hardCloseEditModal(suppressMs = 0) {
    closeEdit(suppressMs);
  }

  function forceCloseEditModal() {
    closeEdit();
  }

  window.MHPHardCloseEditModal = hardCloseEditModal;
  window.MHPForceCloseEditModal = forceCloseEditModal;
  window.MHPClearEditOpenSuppression = clearEditOpenSuppression;

  function fillEditShellOnly(ch) {
    els.editTitle.textContent = `Edit: ${ch.name || 'Unnamed'}`;
    els.editSubtitle.textContent = ch.series || 'No series';
    els.editIdInput.value = ch.id;
    if (els.deleteEditCharacterBtn) {
      els.deleteEditCharacterBtn.disabled = !ch || isDivider(ch);
      els.deleteEditCharacterBtn.title = ch ? `Delete ${ch.name || 'character'}` : 'Delete character';
    }

    // Avoid stale visible text fields from the previous character during the
    // one-frame delay before the full fill runs.
    els.editNameInput.value = ch.name || '';
    els.editSeriesInput.value = ch.series || '';
  }


  function fillEdit(ch) {
    els.editTitle.textContent = `Edit: ${ch.name || 'Unnamed'}`;
    els.editSubtitle.textContent = ch.series || 'No series';
    els.editIdInput.value = ch.id;
    els.editNameInput.value = ch.name || '';
    els.editSeriesInput.value = ch.series || '';
    els.editImageInput.value = ch.imageUrl || ch.image || normalizeUrls(ch.mudaeImages || [])[0] || '';
    els.editRankInput.value = num(ch.globalRank);
    els.editKakeraInput.value = num(ch.kakera);
    els.editKeysInput.value = num(ch.keys);
    els.editOwnerInput.value = ch.owner || '';
    els.editRouletteInput.value = ch.roulette || '';
    els.editColorInput.value = normalizeEmbedColor(ch.color || '#8B5CF6');
    els.editNoteInput.value = ch.note || '';

    syncEditGroupControls(ch);
    syncEmbedColorPreview('text', { commit: true });
    renderSpheresInputs(ch.spheres);
    syncPreview();
  }

  function syncEditGroupControls(ch) {
    // v2.290:
    // Group management now lives in the group badge menu, not inside character edit.
    // Keep this function as cleanup/compat because fillEdit and older flows call it.
    const form = els.editForm;
    if (!form) return;
    form.querySelectorAll('.edit-group-row').forEach(node => node.remove());
  }

  function renderSpheresInputs(spheres) {
    const levels = spheres && Array.isArray(spheres.levels) ? spheres.levels : [];
    const frag = document.createDocumentFragment();

    for (let i = 0; i < 10; i++) {
      const label = document.createElement('label');
      label.textContent = 'P' + (i + 1);

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = i < 5 ? '6' : '1';
      input.value = num(levels[i]);
      input.dataset.sphereIndex = String(i);

      label.appendChild(input);
      frag.appendChild(label);
    }

    els.spheresGrid.replaceChildren(frag);
  }

  function readSpheresInputs() {
    const levels = $$('[data-sphere-index]', els.spheresGrid)
      .sort((a, b) => num(a.dataset.sphereIndex) - num(b.dataset.sphereIndex))
      .map((input, index) => {
        const max = index < 5 ? 6 : 1;
        return Math.max(0, Math.min(max, num(input.value)));
      });

    return levels.some(Boolean) ? { levels } : null;
  }


  function normalizeEmbedColor(value, fallback = '#8b5cf6') {
    const raw = String(value || '').trim();
    const compact = raw.startsWith('#') ? raw.slice(1) : raw;

    if (/^[0-9a-f]{3}$/i.test(compact)) {
      return '#' + compact.split('').map(ch => ch + ch).join('').toUpperCase();
    }

    if (/^[0-9a-f]{6}$/i.test(compact)) {
      return '#' + compact.toUpperCase();
    }

    return fallback && /^#[0-9a-f]{6}$/i.test(fallback) ? fallback.toUpperCase() : '#8B5CF6';
  }

  function getValidEmbedColor(value) {
    const raw = String(value || '').trim();
    const compact = raw.startsWith('#') ? raw.slice(1) : raw;
    if (/^[0-9a-f]{3}$/i.test(compact)) return '#' + compact.split('').map(ch => ch + ch).join('').toUpperCase();
    if (/^[0-9a-f]{6}$/i.test(compact)) return '#' + compact.toUpperCase();
    return '';
  }

  function syncEmbedColorPreview(source = 'text', options = {}) {
    if (!els.editColorInput) return '#8B5CF6';

    const commit = !!options.commit;
    const current = els.editColorInput.value;
    const previous = els.editColorInput.dataset.lastValidColor || '#8B5CF6';
    const valid = getValidEmbedColor(current);
    const color = valid || (commit ? normalizeEmbedColor(current, previous) : previous);

    if (commit || valid || source === 'swatch') {
      els.editColorInput.value = color;
      els.editColorInput.dataset.lastValidColor = color;
    }
    if (els.editColorPreviewSwatch) els.editColorPreviewSwatch.style.backgroundColor = color;
    if (els.editColorPreviewText) els.editColorPreviewText.textContent = valid || commit || source === 'swatch' ? color : 'HEX';
    els.editColorInput.classList.toggle('is-invalid-hex', !!els.editColorInput.value.trim() && !valid && !commit);

    return color;
  }

  function isEditColorPaletteOpen() {
    return !!els.editColorPalettePanel && !els.editColorPalettePanel.hidden;
  }

  function toggleEditColorPalette(force) {
    if (!els.editColorPalettePanel) return false;
    const next = typeof force === 'boolean' ? force : !!els.editColorPalettePanel.hidden;
    els.editColorPalettePanel.hidden = !next;
    els.editColorPreviewBtn?.classList.toggle('is-open', next);
    els.editColorPreviewBtn?.setAttribute('aria-expanded', next ? 'true' : 'false');
    return next;
  }

  function closeEditColorPalette() {
    toggleEditColorPalette(false);
  }

  function isInsideEditColorControl(target) {
    return !!target && (
      els.editColorPalettePanel?.contains(target) ||
      els.editColorPreviewBtn?.contains(target) ||
      els.editColorInput?.contains(target)
    );
  }

  function setEditColorFromPalette(color) {
    const normalized = normalizeEmbedColor(color, '#8B5CF6');
    if (els.editColorInput) {
      els.editColorInput.value = normalized;
      els.editColorInput.dataset.lastValidColor = normalized;
    }
    syncEmbedColorPreview('swatch', { commit: true });
    closeEditColorPalette();
    els.editColorInput?.focus?.({ preventScroll: true });
  }

  const EMBED_COLOR_SWATCHES = [
    '#8B5CF6','#A78BFA','#EC4899','#F472B6','#EF4444','#F97316','#F59E0B','#EAB308',
    '#84CC16','#22C55E','#10B981','#14B8A6','#06B6D4','#0EA5E9','#3B82F6','#6366F1',
    '#FFFFFF','#E5E7EB','#CBD5E1','#94A3B8','#64748B','#475569','#1F2937','#020617',
    '#FF748C','#FFB86C','#F9F871','#79F2C0','#73D9FF','#93C5FD','#C4B5FD','#F0ABFC'
  ];

  function buildEmbedColorPalette() {
    if (!els.editColorPaletteGrid || els.editColorPaletteGrid.dataset.ready === '1') return;
    els.editColorPaletteGrid.dataset.ready = '1';
    EMBED_COLOR_SWATCHES.forEach(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'embed-color-swatch-btn';
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      btn.title = color;
      btn.setAttribute('aria-label', 'Use embed color ' + color);
      btn.addEventListener('click', () => setEditColorFromPalette(color));
      els.editColorPaletteGrid.appendChild(btn);
    });
  }

  function openEditColorPalette(id) {
    openEdit(id);
    buildEmbedColorPalette();
    syncEmbedColorPreview('text', { commit: true });
    toggleEditColorPalette(true);
    els.editColorInput?.focus?.();
    els.editColorInput?.select?.();
  }

  function syncPreview() {
    const url = els.editImageInput.value.trim();
    const name = els.editNameInput.value.trim();
    els.editPreviewImg.src = hasRealImage(url) ? url : placeholderSvg(name);
  }

  function lockPageScroll() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;

    if (!document.body.dataset.lockScrollY) {
      document.body.dataset.lockScrollY = String(y);
    }

    // v2.327:
    // Do not use body { position: fixed; top: -Ypx }. That made window.scrollY
    // become 0 while edit/gallery was open and caused saveEdit to restore to top.
    document.documentElement.classList.add('mhp-scroll-locked');
    document.body.classList.add('mhp-scroll-locked');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // Clear any old fixed-lock residue from previous builds/sessions.
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
  }

  function unlockPageScrollIfAllowed() {
    if (els.editOverlay.classList.contains('show') || !els.galleryPanel.hidden) return;

    const y = getPageScrollYPreservingModalLock();

    document.documentElement.classList.remove('mhp-scroll-locked');
    document.body.classList.remove('mhp-scroll-locked');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    delete document.body.dataset.lockScrollY;

    if (Number.isFinite(y) && y > 0) window.scrollTo({ top: y, behavior: 'auto' });
  }

  function getPageScrollYPreservingModalLock() {
    const locked = num(document.body.dataset.lockScrollY);
    if (locked) return locked;

    // Compatibility with old fixed-lock builds if any style survived.
    const top = String(document.body.style.top || '');
    if (document.body.style.position === 'fixed' && /^-\d/.test(top)) {
      return Math.abs(parseFloat(top)) || 0;
    }

    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function closeEditWithoutScrollRestore() {
    toggleEditColorPalette(false);
    closeGallery(false);
    els.editOverlay.classList.remove('show');
    els.editOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    document.documentElement.classList.remove('mhp-scroll-locked');
    document.body.classList.remove('mhp-scroll-locked');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    delete document.body.dataset.lockScrollY;

    app.activeId = null;
    app.selectedGalleryIndex = null;
  }

  function openGallery(reason = '') {
    els.galleryPanel.hidden = false;
    els.galleryPanel.removeAttribute('hidden');
    document.body.classList.add('gallery-open');
    els.editBody.classList.add('mudae-side-active');
    els.editModal.classList.add('mudae-side-active');
    els.galleryToggleBtn.textContent = '‹';
    els.galleryToggleBtn.setAttribute('aria-expanded', 'true');
    els.galleryPanel.dataset.openReason = reason;
  }

  function closeGallery(clear = false) {
    els.galleryPanel.hidden = true;
    els.galleryPanel.setAttribute('hidden', '');
    document.body.classList.remove('gallery-open');
    els.editBody.classList.remove('mudae-side-active');
    els.editModal.classList.remove('mudae-side-active');
    els.galleryToggleBtn.textContent = '›';
    els.galleryToggleBtn.setAttribute('aria-expanded', 'false');

    if (clear) clearGallery(false);
    unlockPageScrollIfAllowed();
  }

  function toggleGallery() {
    if (els.galleryPanel.hidden) openGallery('manual');
    else closeGallery(false);
  }

  function setGalleryStatus(text) {
    els.galleryStatus.textContent = text || 'Gallery ready.';
  }

  function clearActiveCharacterGalleryCache() {
    const ch = getCharacter(app.activeId);
    if (!ch) return false;

    ch.mudaeImages = [];
    ch.mudaeImageMeta = {};
    ch.hasMudaeGallery = false;
    ch.mudaeGalleryCount = 0;
    app.selectedGalleryIndex = null;

    const keepScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    saveLocal();

    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderStableAroundId?.(ch.id, { highlight: false, forceMs: 1600 });

    requestAnimationFrame(() => {
      window.scrollTo({ top: keepScrollY, behavior: 'auto' });
      requestAnimationFrame(() => window.scrollTo({ top: keepScrollY, behavior: 'auto' }));
    });

    return true;
  }

  function clearGallery(clearText = true) {
    els.galleryGrid.replaceChildren();
    app.selectedGalleryIndex = null;
    app.lastGalleryItems = [];
    app.lastGalleryUrls = [];
    app.galleryMatchedOnly = false;
    syncGalleryMatchControls?.();
    if (clearText) els.galleryPasteInput.value = '';
    if (els.galleryPasteDetails) {
      els.galleryPasteDetails.open = false;
      const summary = els.galleryPasteDetails.querySelector('summary');
      if (summary) summary.textContent = 'Show pasted links';
    }
    setGalleryStatus('Gallery ready.');
  }

  function renderPlaceholder() {
    els.galleryGrid.replaceChildren();

    const card = document.createElement('div');
    card.className = 'gallery-card gallery-placeholder mhp-gallery-ratio-card';
    card.innerHTML = '<div><strong>Searching Mudae…</strong><br><small>Paste copied image links here, then parse.</small></div>';

    els.galleryGrid.appendChild(card);
  }


  function readGalleryMetaForUrl(character, url, fallbackIndex = 0) {
    const key = canonicalImageUrlKey(url);
    const metaMap = character && typeof character.mudaeImageMeta === 'object' && character.mudaeImageMeta
      ? character.mudaeImageMeta
      : {};
    return metaMap[key] || metaMap[url] || { index: fallbackIndex + 1, matched: false };
  }

  function normalizeGalleryItem(item, fallbackIndex = 0) {
    if (item && typeof item === 'object') {
      const url = cleanImageUrlForGallery(item.url || item.image || item.imageUrl || item.src || item.href || '');
      if (!url || !hasRealImage(url)) return null;
      const rawIndex = Number(item.index ?? item.number ?? item.position ?? item.i ?? (fallbackIndex + 1));
      const matches = Array.isArray(item.matches) ? item.matches : [];
      const matched = item.matched === true || item.match === true || item.isMatched === true || item.hasMatch === true ||
        matches.length > 0 ||
        String(item.matched || item.match || item.status || item.label || '').toLowerCase().includes('match');
      return {
        url,
        index: Number.isFinite(rawIndex) && rawIndex > 0 ? rawIndex : fallbackIndex + 1,
        matched: !!matched,
        matches,
        mudaeImageId: item.mudaeImageId || item.id || item.imageId || '',
        characterName: item.characterName || item.name || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        artist: Array.isArray(item.artist) ? item.artist : [],
        rating: item.rating ?? null,
        source: item.source || 'mudae'
      };
    }

    const url = cleanImageUrlForGallery(item || '');
    if (!url || !hasRealImage(url)) return null;
    return { url, index: fallbackIndex + 1, matched: false, matches: [], source: 'mudae' };
  }

  function dedupeGalleryItems(items) {
    const seen = new Set();
    const out = [];
    flattenImageUrlInput(items).forEach(() => {}); // keep old flatten helper reachable for legacy bundles
    (Array.isArray(items) ? items : [items]).forEach((item, index) => {
      const normalized = normalizeGalleryItem(item, index);
      if (!normalized) return;
      const key = canonicalImageUrlKey(normalized.url);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(normalized);
    });
    return out;
  }

  function buildGalleryItemsFromCharacter(character) {
    const urls = dedupeCharacterImageUrls(character?.mudaeImages || []);
    return urls.map((url, index) => {
      const meta = readGalleryMetaForUrl(character, url, index);
      return normalizeGalleryItem({
        url,
        index: meta.index || index + 1,
        matched: !!meta.matched,
        matches: Array.isArray(meta.matches) ? meta.matches : [],
        mudaeImageId: meta.mudaeImageId || meta.id || '',
        characterName: meta.characterName || meta.name || character?.name || '',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        artist: Array.isArray(meta.artist) ? meta.artist : [],
        rating: meta.rating ?? null,
        source: meta.source || 'saved'
      }, index);
    }).filter(Boolean);
  }

  function extractGalleryItemsFromJsonValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) return dedupeGalleryItems(value);
    if (typeof value === 'object') {
      const candidates = value.images || value.galleryImages || value.gallery || value.mudaeImages || value.urls || value.items;
      if (Array.isArray(candidates)) return dedupeGalleryItems(candidates);
      if (value.url || value.image || value.imageUrl || value.src || value.href) return dedupeGalleryItems([value]);
    }
    return [];
  }

  function parseGalleryItemsFromText(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      const fromJson = extractGalleryItemsFromJsonValue(parsed);
      if (fromJson.length) return fromJson;
    } catch (_) {}

    const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const items = [];
    lines.forEach((line, index) => {
      const urls = parseUrls(line);
      const hasMatch = /\b(match|matched|hasMatch|isMatched)\b\s*[:=]?\s*(true|yes|1)?/i.test(line) || /\[\s*match\s*\]/i.test(line);
      urls.forEach((url, offset) => items.push({ url, index: index + offset + 1, matched: hasMatch, source: 'paste' }));
    });

    if (items.length) return dedupeGalleryItems(items);
    return dedupeGalleryItems(parseUrls(raw));
  }

  function buildGalleryMetaMap(items) {
    const meta = {};
    dedupeGalleryItems(items).forEach((item, index) => {
      const key = canonicalImageUrlKey(item.url);
      if (!key) return;
      meta[key] = {
        index: item.index || index + 1,
        matched: !!item.matched,
        matches: Array.isArray(item.matches) ? item.matches : [],
        mudaeImageId: item.mudaeImageId || item.id || '',
        characterName: item.characterName || item.name || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        artist: Array.isArray(item.artist) ? item.artist : [],
        rating: item.rating ?? null,
        source: item.source || 'mudae'
      };
    });
    return meta;
  }

  function applyGalleryMatchedOnlyFilter() {
    const active = !!app.galleryMatchedOnly;
    const grid = els.galleryGrid;
    grid?.classList?.toggle('show-matched-only', active);
    grid?.querySelectorAll?.('.gallery-card')?.forEach(card => {
      const matched = card.classList.contains('is-matched') || card.dataset.matched === '1';
      const hide = active && !matched;
      card.hidden = hide;
      card.classList.toggle('gallery-match-filter-hidden', hide);
      card.setAttribute('aria-hidden', hide ? 'true' : 'false');
      if (hide) {
        card.style.setProperty('display', 'none', 'important');
      } else {
        card.style.removeProperty('display');
      }
    });
  }

  function syncGalleryMatchControls() {
    const matchedCount = (app.lastGalleryItems || []).filter(item => item?.matched).length;
    if (els.galleryMatchedOnlyBtn) {
      els.galleryMatchedOnlyBtn.disabled = matchedCount <= 0;
      els.galleryMatchedOnlyBtn.classList.toggle('is-active', !!app.galleryMatchedOnly);
      els.galleryMatchedOnlyBtn.setAttribute('aria-pressed', app.galleryMatchedOnly ? 'true' : 'false');
      els.galleryMatchedOnlyBtn.textContent = matchedCount ? `Matched only (${matchedCount})` : 'Matched only';
    }
    if (els.galleryUseMatchedBtn) {
      els.galleryUseMatchedBtn.disabled = matchedCount <= 0;
      els.galleryUseMatchedBtn.textContent = matchedCount ? 'Use match' : 'No match';
    }
    applyGalleryMatchedOnlyFilter();
  }

  function toggleMatchedOnlyGallery() {
    const matchedCount = (app.lastGalleryItems || []).filter(item => item?.matched).length;
    if (!matchedCount) {
      app.galleryMatchedOnly = false;
      setGalleryStatus('No matched images found in this gallery.');
      syncGalleryMatchControls();
      return;
    }
    app.galleryMatchedOnly = !app.galleryMatchedOnly;
    syncGalleryMatchControls();
    setGalleryStatus(app.galleryMatchedOnly ? `Showing ${matchedCount} matched image(s).` : `${app.lastGalleryItems.length} image(s) shown.`);
  }

  function useFirstMatchedGalleryImage() {
    const item = (app.lastGalleryItems || []).find(entry => entry?.matched);
    if (!item) {
      setGalleryStatus('No matched images found in this gallery.');
      return false;
    }
    const card = els.galleryGrid?.querySelector?.(`.gallery-card[data-image-url="${CSS.escape(item.url)}"]`);
    selectGalleryImage((app.lastGalleryItems || []).findIndex(entry => entry?.url === item.url), item.url, card || null);
    setGalleryStatus(`Matched image #${item.index || 1} selected.`);
    return true;
  }

  function firstImageLikeValueFromMatch(match) {
    if (!match || typeof match !== 'object') return '';
    const directKeys = ['url', 'imageUrl', 'imageURL', 'src', 'href', 'link', 'full', 'thumbnail', 'thumb', 'preview', 'image', 'filename', 'file'];
    for (const key of directKeys) {
      const value = match[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    for (const value of Object.values(match)) {
      if (typeof value === 'string' && /(?:https?:\/\/|mudae\.net\/uploads|\.(?:png|jpe?g|webp|gif)(?:[?#]|$))/i.test(value)) {
        return value.trim();
      }
    }
    return '';
  }

  function getMatchPreviewUrl(match) {
    if (!match || typeof match !== 'object') return '';
    let raw = firstImageLikeValueFromMatch(match);
    if (!raw) return '';
    raw = String(raw).trim().replace(/&amp;/g, '&').replace(/^['"]+|['"]+$/g, '');

    if (/^https?:\/\//i.test(raw) || /^\//.test(raw)) {
      return cleanImageUrlForGallery(raw);
    }

    if (/mudae\.net\/uploads/i.test(raw)) {
      return cleanImageUrlForGallery(raw.replace(/^\/+/, 'https://'));
    }

    if (/\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i.test(raw)) {
      const ownerId = match.ownerId || match.userId || match.uploadId || match.upload || match.id || match.characterId || '';
      if (ownerId && /^\d+$/.test(String(ownerId))) {
        return cleanImageUrlForGallery(`https://mudae.net/uploads/${ownerId}/${raw.replace(/^\/+/, '')}`);
      }
      return cleanImageUrlForGallery(raw);
    }

    return '';
  }

  function describeMatchPreview(match, index = 0) {
    if (!match || typeof match !== 'object') return `Match #${index + 1}`;
    const name = match.name || match.characterName || match.charName || match.title || '';
    const number = match.number || match.index || match.position || '';
    if (name && number) return `${name} #${number}`;
    if (name) return String(name);
    if (number) return `Image #${number}`;
    return `Match #${index + 1}`;
  }

  function closeGalleryMatchPreview() {
    document.querySelectorAll('.gallery-match-preview-overlay').forEach(node => node.remove());
    document.querySelectorAll('.gallery-match-preview-host').forEach(node => node.classList.remove('gallery-match-preview-host'));
    document.removeEventListener('keydown', onGalleryMatchPreviewKeydown, true);
    clearEditOpenSuppression('match-preview-close');
  }

  function clearEditOpenSuppression(reason = 'manual-clear') {
    try {
      app.editReopenSuppressedUntil = 0;
      app.postEditRestoreBlockedUntil = 0;
      window.__mhpEditClosingUntil = 0;
      window.__mhpSuppressEditOpenUntil = 0;
      window.__mhpPostEditRestoreBlockedUntil = 0;
      window.MHPEditGalleryController?.clearSuppress?.(reason);
      document.documentElement.classList.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
      document.body?.classList?.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
    } catch {}
  }

  function onGalleryMatchPreviewKeydown(event) {
    if (event.key === 'Escape') closeGalleryMatchPreview();
  }

  function buildMatchCommand(match) {
    if (!match || typeof match !== 'object') return '';
    const name = String(match.name || match.characterName || match.charName || match.title || '').trim();
    const number = num(match.number || match.index || match.position || match.imageNumber || 0);
    if (!name || !number) return '';
    return `$c ${name}$${number}`;
  }

  async function copyTextSilent(text) {
    if (!text) return false;
    try {
      await navigator.clipboard?.writeText?.(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  function getCharacterMatchedGalleryItem(character) {
    if (!character || isDivider(character)) return null;
    const urls = dedupeCharacterImageUrls(character.mudaeImages || []);
    const meta = character.mudaeImageMeta && typeof character.mudaeImageMeta === 'object' ? character.mudaeImageMeta : {};
    for (let index = 0; index < urls.length; index++) {
      const url = urls[index];
      const key = canonicalImageUrlKey(url);
      const itemMeta = meta[key] || meta[url];
      if (itemMeta?.matched || (Array.isArray(itemMeta?.matches) && itemMeta.matches.length)) {
        return {
          url,
          index: itemMeta.index || index + 1,
          matched: true,
          matches: Array.isArray(itemMeta.matches) ? itemMeta.matches : [],
          meta: itemMeta
        };
      }
    }
    return null;
  }

  function refreshActiveGalleryMetadata() {
    const ch = getCharacter(app.activeId);
    if (!ch || !Array.isArray(app.lastGalleryItems) || !app.lastGalleryItems.length) return null;
    const items = dedupeGalleryItems(app.lastGalleryItems);
    ch.mudaeImages = dedupeCharacterImageUrls(items.map(item => item.url));
    ch.mudaeImageMeta = buildGalleryMetaMap(items);
    syncMudaeGalleryFlags(ch);
    saveLocalDeferred?.(120);
    return ch;
  }

  function normalizeMatchNameKey(value) {
    // Normalize Mudae match names for local character matching.
    // Mudae may report aliases with braces while the local board may use
    // parentheses, e.g. "Ami {KAC}" vs "Ami (KAC)". Treat common
    // wrapper punctuation as spacing so conflict choices apply to the right
    // character without touching gallery order.
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[{}()[\]<>【】「」『』]/g, ' ')
      .replace(/[‐-―]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactMatchNameKey(value) {
    return normalizeMatchNameKey(value).replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function getMatchCharacterName(match) {
    if (!match || typeof match !== 'object') return '';
    return String(match.name || match.characterName || match.charName || match.title || match.claimName || '').trim();
  }

  function getMatchTargetKey(match) {
    return normalizeMatchNameKey(getMatchCharacterName(match));
  }

  function groupMatchesByTarget(matches = []) {
    const groups = new Map();
    (Array.isArray(matches) ? matches : []).forEach((match, index) => {
      if (!match || typeof match !== 'object') return;
      const key = getMatchTargetKey(match) || `__match_${index}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(match);
    });
    return groups;
  }

  function splitMatchesByTargetAmbiguity(matches = []) {
    const direct = [];
    const ambiguous = [];
    const groups = groupMatchesByTarget(matches);
    groups.forEach(group => {
      if (group.length === 1) direct.push(group[0]);
      else ambiguous.push(group);
    });
    return { direct, ambiguous, groups };
  }

  function getMatchAmbiguityLabel(group = []) {
    const first = Array.isArray(group) ? group[0] : null;
    const name = getMatchCharacterName(first) || 'Unknown character';
    return `${name} has ${group.length} possible image matches`;
  }

  function findCharacterByMatchName(match) {
    const rawName = getMatchCharacterName(match);
    const name = normalizeMatchNameKey(rawName);
    const compactName = compactMatchNameKey(rawName);
    if (!name && !compactName) return null;
    const chars = (app.state.characters || []).filter(item => item && !isDivider(item));

    const prepared = chars.map(item => ({
      item,
      name: normalizeMatchNameKey(item.name),
      compact: compactMatchNameKey(item.name)
    }));

    return prepared.find(entry => entry.name === name)?.item ||
      prepared.find(entry => entry.compact && compactName && entry.compact === compactName)?.item ||
      prepared.find(entry => entry.name && (entry.name.includes(name) || name.includes(entry.name)))?.item ||
      prepared.find(entry => entry.compact && compactName && (entry.compact.includes(compactName) || compactName.includes(entry.compact)))?.item ||
      null;
  }

  function findGalleryUrlByImageNumber(character, number) {
    const n = num(number);
    if (!character || !n) return '';
    const urls = dedupeCharacterImageUrls(character.mudaeImages || []);
    const meta = character.mudaeImageMeta && typeof character.mudaeImageMeta === 'object' ? character.mudaeImageMeta : {};
    for (let index = 0; index < urls.length; index++) {
      const url = urls[index];
      const key = canonicalImageUrlKey(url);
      const itemMeta = meta[key] || meta[url];
      const itemNumber = num(itemMeta?.index || index + 1);
      if (itemNumber === n) return url;
    }
    return urls[n - 1] || '';
  }

  function ensureCharacterGalleryIncludesImage(character, url, metaPatch = null) {
    if (!character || !url || !hasRealImage(url)) return false;
    character.mudaeImages = dedupeCharacterImageUrls([...(character.mudaeImages || []), url]);
    if (metaPatch && typeof metaPatch === 'object') {
      const key = canonicalImageUrlKey(url);
      if (key) {
        character.mudaeImageMeta = character.mudaeImageMeta && typeof character.mudaeImageMeta === 'object' ? character.mudaeImageMeta : {};
        character.mudaeImageMeta[key] = {
          ...(character.mudaeImageMeta[key] || {}),
          ...metaPatch
        };
      }
    }
    syncMudaeGalleryFlags(character);
    return true;
  }

  function setCharacterMainImageFromMatch(character, url, metaPatch = null) {
    if (!character || !url || !hasRealImage(url)) return false;

    // v2.633: Applying a match changes the character's main image only.
    // The Mudae gallery order is absolute and must never be rebuilt with the
    // selected/matched image moved to the front. Preserve the exact gallery
    // sequence and only append the URL at the end when it was not saved yet.
    const currentKey = canonicalImageUrlKey(character.image || character.imageUrl || '');
    const nextKey = canonicalImageUrlKey(url);
    const originalGallery = dedupeCharacterImageUrls(character.mudaeImages || []);
    const hasInGallery = originalGallery.some(entry => canonicalImageUrlKey(entry) === nextKey);

    character.mudaeImages = hasInGallery
      ? originalGallery
      : dedupeCharacterImageUrls([...originalGallery, url]);

    if (metaPatch && typeof metaPatch === 'object' && nextKey) {
      character.mudaeImageMeta = character.mudaeImageMeta && typeof character.mudaeImageMeta === 'object'
        ? character.mudaeImageMeta
        : {};
      character.mudaeImageMeta[nextKey] = {
        ...(character.mudaeImageMeta[nextKey] || {}),
        ...metaPatch
      };
    }

    character.image = url;
    character.imageUrl = url;
    syncMudaeGalleryFlags(character, { skipNormalize: true });
    return currentKey !== nextKey;
  }

  function getMatchTargetImageUrl(targetCharacter, match) {
    const previewUrl = getMatchPreviewUrl(match);
    if (previewUrl && hasRealImage(previewUrl)) return previewUrl;
    const number = match?.number || match?.index || match?.position || match?.imageNumber;
    const byNumber = findGalleryUrlByImageNumber(targetCharacter, number);
    return byNumber && hasRealImage(byNumber) ? byNumber : '';
  }

  function refreshMatchedTouchedCharacters(touchedIds = []) {
    const ids = Array.from(new Set(Array.from(touchedIds || []).filter(Boolean)));
    if (!ids.length) return;

    // v2.634: Yield before refreshing the board so the match preview/confirm
    // layers close immediately and another edit can be opened without waiting.
    requestAnimationFrame(() => {
      try { window.MudaeBoardController?.updateEntriesFromApp?.(); } catch {}
      ids.forEach(id => {
        try { renderCharacterCardById?.(id); } catch {}
      });
      try { syncPreview?.(); } catch {}
      try { window.MudaeGifControl?.refresh?.(); } catch {}
    });
  }

  async function applyMatchedGalleryItemToPair(item, selectedMatch = null, options = {}) {
    refreshActiveGalleryMetadata();

    const active = getCharacter(app.activeId);
    if (!active || isDivider(active) || !item?.url || !hasRealImage(item.url)) {
      setGalleryStatus('No active matched image available to apply.');
      return false;
    }

    const matches = Array.isArray(item.matches) ? item.matches.filter(match => match && typeof match === 'object') : [];
    const { direct, ambiguous } = splitMatchesByTargetAmbiguity(matches);
    const selectedList = selectedMatch ? [selectedMatch] : direct;
    const skipConfirm = options && options.skipConfirm === true;
    const showConflictsAfter = !selectedMatch && ambiguous.length > 0;

    if (!selectedList.length && !ambiguous.length) {
      setGalleryStatus('No related match metadata found.');
      return false;
    }

    if (!skipConfirm) {
      const conflictText = ambiguous.length
        ? `\n\nAfter applying direct matches, you will choose ${ambiguous.length} conflicted character(s) manually.`
        : '';
      const ok = await showAppConfirm(
        selectedMatch
          ? `Apply this selected match option for ${getMatchCharacterName(selectedMatch) || 'the linked character'}?`
          : `Apply all direct matches for ${active.name || 'the current character'}?${conflictText}`,
        {
          title: selectedMatch ? 'Apply selected option?' : 'Apply matches?',
          okText: selectedMatch ? 'Apply option' : 'Apply matches',
          cancelText: 'Cancel'
        }
      );
      if (!ok) return false;
    }

    closeGalleryMatchPreview();

    let changed = 0;
    let paired = 0;
    const touched = new Set();
    const currentMatchesToKeep = selectedMatch ? [selectedMatch] : matches;

    if (setCharacterMainImageFromMatch(active, item.url, {
      index: item.index,
      matched: true,
      matches: currentMatchesToKeep,
      mudaeImageId: item.mudaeImageId || '',
      characterName: item.characterName || active.name || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      artist: Array.isArray(item.artist) ? item.artist : [],
      rating: item.rating ?? null,
      source: item.source || 'match-apply-current'
    })) changed++;
    touched.add(active.id);

    if (els.editOverlay?.classList?.contains('show') && app.activeId === active.id) {
      els.editImageInput.value = item.url;
      const card = els.galleryGrid?.querySelector?.(`.gallery-card[data-image-url="${CSS.escape(item.url)}"]`);
      if (card) {
        els.galleryGrid.querySelectorAll('.gallery-card.selected').forEach(node => node.classList.remove('selected'));
        card.classList.add('selected');
      }
    }

    for (const match of selectedList) {
      const target = findCharacterByMatchName(match);
      if (!target) continue;
      const targetUrl = getMatchTargetImageUrl(target, match);
      if (!targetUrl || !hasRealImage(targetUrl)) continue;
      if (setCharacterMainImageFromMatch(target, targetUrl, {
        index: num(match.number || match.index || match.position || match.imageNumber || 0) || undefined,
        matched: true,
        matches: [],
        characterName: getMatchCharacterName(match) || target.name || '',
        source: 'match-apply-target'
      })) changed++;
      touched.add(target.id);
      paired++;
    }

    if (changed || paired || touched.size) {
      assignBoardCounters();
      recalcStats();
      saveLocalDeferred?.(20);
      refreshMatchedTouchedCharacters(touched);
      clearEditOpenSuppression('match-apply-complete');
      const conflictSuffix = showConflictsAfter ? ` · ${ambiguous.length} conflicted character(s) need choice` : '';
      const msg = `Applied match to ${touched.size || 1} character(s)${paired ? ` · ${paired} direct linked target(s)` : ''}${conflictSuffix}.`;
      setGalleryStatus(msg);
      notifyAppMessage?.(msg);
    }

    if (showConflictsAfter) {
      setTimeout(() => showGalleryMatchConflictChoice(item, ambiguous), 80);
    }

    return changed > 0 || paired > 0 || touched.size > 0;
  }

  async function applyMatchedImagesToAllCharacters() {
    refreshActiveGalleryMetadata();

    const ok = await showAppConfirm(
      'This will scan every character with saved match metadata and apply unambiguous matched images. If the same linked character has multiple possible images, that target will be skipped for manual choice.',
      {
        title: 'Apply unambiguous matches?',
        okText: 'Apply matches',
        cancelText: 'Cancel'
      }
    );
    if (!ok) return false;

    let changed = 0;
    let paired = 0;
    let skippedAmbiguous = 0;
    const touched = new Set();

    for (const character of app.state.characters || []) {
      if (!character || isDivider(character)) continue;
      const matchedItem = getCharacterMatchedGalleryItem(character);
      if (!matchedItem?.url || !hasRealImage(matchedItem.url)) continue;

      const matches = Array.isArray(matchedItem.matches) ? matchedItem.matches.filter(match => match && typeof match === 'object') : [];
      const { direct, ambiguous } = splitMatchesByTargetAmbiguity(matches);
      skippedAmbiguous += ambiguous.length;

      if (setCharacterMainImageFromMatch(character, matchedItem.url, {
        index: matchedItem.index,
        matched: true,
        matches,
        source: matchedItem.meta?.source || 'match-apply'
      })) changed++;
      touched.add(character.id);

      for (const chosenMatch of direct) {
        const target = findCharacterByMatchName(chosenMatch);
        if (!target) continue;
        const targetUrl = getMatchTargetImageUrl(target, chosenMatch);
        if (!targetUrl || !hasRealImage(targetUrl)) continue;
        if (setCharacterMainImageFromMatch(target, targetUrl, {
          index: num(chosenMatch.number || chosenMatch.index || chosenMatch.position || chosenMatch.imageNumber || 0) || undefined,
          matched: true,
          matches: [],
          source: 'match-target'
        })) changed++;
        touched.add(target.id);
        paired++;
      }
    }

    if (changed || paired) {
      assignBoardCounters();
      recalcStats();
      saveLocalDeferred?.(40);
      refreshMatchedTouchedCharacters(touched);
      const suffix = skippedAmbiguous ? ` · ${skippedAmbiguous} target(s) skipped for manual choice` : '';
      setGalleryStatus(`Applied matched images to ${touched.size || changed} character(s)${paired ? ` · ${paired} linked match(es)` : ''}${suffix}.`);
      notifyAppMessage?.(`Applied matches to ${touched.size || changed} character(s)${suffix}.`);
    } else {
      const msg = skippedAmbiguous
        ? `No automatic matches applied. ${skippedAmbiguous} target(s) need manual choice.`
        : 'No unapplied matched images found.';
      setGalleryStatus(msg);
      notifyAppMessage?.(msg);
    }
    return changed > 0 || paired > 0;
  }

  function createMatchPreviewCard(match, index, options = {}) {
    const card = document.createElement('div');
    card.className = 'gallery-match-preview-card';

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'gallery-match-preview-image-btn';
    const command = buildMatchCommand(match);
    if (command) {
      previewBtn.title = `Click to copy: ${command}`;
      previewBtn.dataset.command = command;
    } else {
      previewBtn.title = 'No Discord command metadata available';
    }

    const url = getMatchPreviewUrl(match);
    if (url && hasRealImage(url)) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = describeMatchPreview(match, index);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      previewBtn.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.className = 'gallery-match-preview-empty';
      empty.textContent = 'No preview URL';
      previewBtn.appendChild(empty);
    }

    previewBtn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (!command) {
        setGalleryStatus('No Discord command available for this matched image.');
        return;
      }
      const copied = await copyTextSilent(command);
      setGalleryStatus(copied ? `Copied ${command}` : 'Could not copy command.');
    });

    const label = document.createElement('span');
    label.textContent = describeMatchPreview(match, index);

    card.append(previewBtn, label);

    if (typeof options.onChoose === 'function') {
      const chooseBtn = document.createElement('button');
      chooseBtn.type = 'button';
      chooseBtn.className = 'btn btn-secondary gallery-match-apply-one';
      chooseBtn.textContent = options.chooseText || 'Choose this image';
      chooseBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        options.onChoose(match, index);
      });
      card.appendChild(chooseBtn);
    }

    return card;
  }

  function showGalleryMatchConflictChoice(item, ambiguousGroups = []) {
    const groups = (Array.isArray(ambiguousGroups) ? ambiguousGroups : []).filter(group => Array.isArray(group) && group.length > 1);
    if (!groups.length) return false;

    closeGalleryMatchPreview();

    const overlay = document.createElement('div');
    overlay.className = 'gallery-match-preview-overlay gallery-match-conflict-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const panel = document.createElement('section');
    panel.className = 'gallery-match-preview-panel gallery-match-conflict-panel';
    panel.dataset.matchCount = String(groups.reduce((sum, group) => sum + group.length, 0));

    const header = document.createElement('header');
    header.className = 'gallery-match-preview-head';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = groups.length === 1
      ? `Choose image for ${getMatchCharacterName(groups[0][0]) || 'conflicted character'}`
      : `Choose images for ${groups.length} conflicted characters`;
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Direct matches were applied. Pick one image for each character with multiple possible matches.';
    titleWrap.append(title, subtitle);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-ghost icon-btn';
    closeBtn.setAttribute('aria-label', 'Close conflict chooser');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeGalleryMatchPreview);
    header.append(titleWrap, closeBtn);

    const body = document.createElement('div');
    body.className = 'gallery-match-conflict-body';

    groups.forEach((group, groupIndex) => {
      const section = document.createElement('section');
      section.className = 'gallery-match-conflict-group';
      const heading = document.createElement('h4');
      heading.textContent = `${getMatchCharacterName(group[0]) || `Conflict #${groupIndex + 1}`} · choose 1 of ${group.length}`;
      const grid = document.createElement('div');
      grid.className = 'gallery-match-preview-grid gallery-match-conflict-grid';

      group.forEach((match, index) => {
        grid.appendChild(createMatchPreviewCard(match, index, {
          chooseText: 'Choose this image',
          onChoose: async chosen => {
            await applyMatchedGalleryItemToPair(item, chosen, { skipConfirm: true });
          }
        }));
      });

      section.append(heading, grid);
      body.appendChild(section);
    });

    panel.append(header, body);
    overlay.appendChild(panel);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeGalleryMatchPreview();
    });

    const host = els.galleryPanel && !els.galleryPanel.hidden ? els.galleryPanel : document.body;
    host.classList?.add?.('gallery-match-preview-host');
    host.appendChild(overlay);
    document.addEventListener('keydown', onGalleryMatchPreviewKeydown, true);
    return true;
  }

  function showGalleryMatchPreview(item) {
    const matches = Array.isArray(item?.matches) ? item.matches.filter(match => match && typeof match === 'object') : [];
    if (!matches.length) {
      setGalleryStatus('This matched image has no related preview metadata.');
      return false;
    }

    closeGalleryMatchPreview();

    const overlay = document.createElement('div');
    overlay.className = 'gallery-match-preview-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const panel = document.createElement('section');
    panel.className = 'gallery-match-preview-panel';
    panel.dataset.matchCount = String(matches.length);

    const header = document.createElement('header');
    header.className = 'gallery-match-preview-head';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    const activeCharacterName = String(item.characterName || getActiveCharacter()?.name || app.state.characters?.find?.(character => character?.id === app.activeId)?.name || 'Character').trim();
    title.textContent = `${activeCharacterName} - IMG #${item.index || 1} - Matches`;
    const subtitle = document.createElement('p');
    const split = splitMatchesByTargetAmbiguity(matches);
    subtitle.textContent = split.ambiguous.length
      ? `${matches.length} match options. Apply matches will handle direct matches first, then ask only for duplicated target characters.`
      : `${matches.length} match option(s). Click a preview to copy its Discord command.`;
    titleWrap.append(title, subtitle);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-ghost icon-btn';
    closeBtn.setAttribute('aria-label', 'Close match preview');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeGalleryMatchPreview);

    header.append(titleWrap, closeBtn);

    const grid = document.createElement('div');
    grid.className = 'gallery-match-preview-grid';
    matches.forEach((match, index) => grid.appendChild(createMatchPreviewCard(match, index)));

    const footer = document.createElement('footer');
    footer.className = 'gallery-match-preview-footer';

    const hint = document.createElement('span');
    hint.className = 'gallery-match-preview-hint';
    hint.textContent = split.ambiguous.length
      ? `${split.direct.length} direct · ${split.ambiguous.length} conflicted target(s) will be asked after direct apply.`
      : `${split.direct.length} direct match(es) ready.`;
    footer.appendChild(hint);

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'btn btn-secondary';
    applyBtn.textContent = 'Apply matches';
    applyBtn.title = 'Apply direct matches first, then choose conflicted target images if needed';
    applyBtn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      await applyMatchedGalleryItemToPair(item, null);
    });
    footer.appendChild(applyBtn);

    panel.append(header, grid, footer);
    overlay.appendChild(panel);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeGalleryMatchPreview();
    });

    const host = els.galleryPanel && !els.galleryPanel.hidden ? els.galleryPanel : document.body;
    host.classList?.add?.('gallery-match-preview-host');
    host.appendChild(overlay);
    document.addEventListener('keydown', onGalleryMatchPreviewKeydown, true);
    return true;
  }

  function createGalleryCard(item, index) {
    item = normalizeGalleryItem(item, index) || { url: String(item || ''), index: index + 1, matched: false };
    const url = item.url;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card mhp-gallery-ratio-card';
    card.classList.toggle('is-matched', !!item.matched);
    card.dataset.imageUrl = url;
    card.dataset.index = String(index);
    if (item.matched) card.dataset.matched = '1';

    const badge = document.createElement('span');
    badge.className = 'gallery-number';
    badge.textContent = '#' + (item.index || index + 1);

    const matchBadge = document.createElement('span');
    matchBadge.className = 'gallery-match-badge';
    matchBadge.textContent = 'MATCH';
    matchBadge.hidden = !item.matched;
    matchBadge.title = item.matches?.length ? 'Click to preview matched images' : 'Matched image';
    matchBadge.setAttribute('role', 'button');
    if (item.matched) matchBadge.tabIndex = 0;
    const openMatchPreview = event => {
      event.preventDefault();
      event.stopPropagation();
      if (!item.matches?.length) {
        setGalleryStatus('This matched image has no related preview metadata.');
        return false;
      }
      showGalleryMatchPreview(item);
      return true;
    };
    matchBadge.addEventListener('click', openMatchPreview);
    matchBadge.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') openMatchPreview(event);
    });

    const img = document.createElement('img');
    img.alt = 'Mudae image ' + (index + 1);
    img.loading = 'eager';
    img.decoding = 'async';
    img.fetchPriority = 'high';
    img.referrerPolicy = 'no-referrer';

    if (isAnimatedImageUrl(url) && window.MUDAE_PERF?.isGifControlEnabled?.()) {
      const pausedSrc = placeholderSvg('GIF ' + (index + 1));
      img.dataset.animatedSrc = url;
      img.dataset.pausedSrc = pausedSrc;
      img.src = pausedSrc;
      img.classList.add('gif-paused');
      img.title = 'GIF paused until visible';
    } else {
      img.src = url;
    }

    img.addEventListener('error', () => {
      card.classList.add('image-error');
      img.remove();
      if (!card.querySelector('.gallery-error-text')) {
        const err = document.createElement('span');
        err.className = 'gallery-error-text';
        err.textContent = 'Preview failed';
        card.appendChild(err);
      }
    }, { once: true });

    card.append(img, badge, matchBadge);
    card.addEventListener('click', () => selectGalleryImage(index, url, card));
    return card;
  }

  function scheduleGalleryMediaRefresh() {
    if (app.galleryMediaRefreshRaf) return;
    app.galleryMediaRefreshRaf = requestAnimationFrame(() => {
      app.galleryMediaRefreshRaf = 0;
      window.MudaeGifControl?.refresh?.();
    });
  }


  function renderGallery(items, options = {}) {
    const galleryItems = dedupeGalleryItems(items);
    const urls = galleryItems.map(item => item.url);
    app.lastGalleryItems = galleryItems;
    app.lastGalleryUrls = urls;
    app.selectedGalleryIndex = null;

    const jobId = ++app.renderJob;
    const frag = document.createDocumentFragment();

    galleryItems.forEach((item, index) => {
      if (jobId !== app.renderJob) return;
      frag.appendChild(createGalleryCard(item, index));
    });

    // Atomic gallery render: one DOM swap, no chunk-by-chunk visual rebuild.
    els.galleryGrid.replaceChildren(frag);
    els.galleryGrid.classList.add('gallery-grid-rendered-atomic', 'mhp-gallery-ratio-grid');
    syncGalleryMatchControls();

    scheduleGalleryMediaRefresh();
    window.dispatchEvent(new CustomEvent('mhp-gallery-rendered', {
      detail: { count: urls.length, matched: galleryItems.filter(item => item.matched).length, atomic: true }
    }));
  }

  function selectGalleryImage(index, url, card) {
    if (isEditClosingLocked() || !els.editOverlay?.classList?.contains('show')) return false;
    app.selectedGalleryIndex = index;
    els.editImageInput.value = url;

    const previous = els.galleryGrid.querySelector('.gallery-card.selected');
    if (previous && previous !== card) previous.classList.remove('selected');
    if (card) card.classList.add('selected');

    // Keep selection instant. Preview decode/clipboard/toast can happen after
    // the click frame so gallery actions don't feel sticky.
    requestAnimationFrame(() => {
      if (app.selectedGalleryIndex === index && els.editImageInput.value === url) {
        syncPreview();
      }

      const command = buildChangeImageCommand(index);
      setTimeout(() => navigator.clipboard?.writeText(command).catch(() => {}), 0);

      const toast = document.createElement('div');
      toast.className = 'card-toast';
      toast.textContent = 'Command copied';
      if (card) {
        card.appendChild(toast);
        setTimeout(() => toast.remove(), 900);
      }
    });
  }

  function buildChangeImageCommand(index = app.selectedGalleryIndex) {
    const name = els.editNameInput.value.trim();
    return `$c ${name}$${num(index) + 1}`;
  }


  function parsePastedGallery(textOverride = null) {
    if (isEditClosingLocked() || !els.editOverlay?.classList?.contains('show')) return false;
    const sourceText = textOverride == null ? els.galleryPasteInput.value : String(textOverride || '');
    const galleryItems = parseGalleryItemsFromText(sourceText);
    const urls = galleryItems.map(item => item.url);

    if (!urls.length) {
      setGalleryStatus('No URLs found in pasted text.');
      openGallery('paste-empty');
      return false;
    }

    els.galleryPasteInput.value = urls.join('\n');
    if (els.galleryPasteDetails) {
      const summary = els.galleryPasteDetails.querySelector('summary');
      if (summary) summary.textContent = `Show pasted links (${urls.length})`;
    }
    openGallery('parse');
    renderGallery(galleryItems, { fastOpen: true });
    persistGalleryToActive({ deferred: true });
    const matchedCount = galleryItems.filter(item => item.matched).length;
    setGalleryStatus(`${urls.length} image(s) loaded${matchedCount ? ` · ${matchedCount} matched` : ''}.`);
    return true;
  }

  function getVisibleGalleryUrls() {
    if (Array.isArray(app.lastGalleryUrls) && app.lastGalleryUrls.length) {
      return app.lastGalleryUrls.slice();
    }

    return $$('.gallery-card[data-image-url]', els.galleryGrid)
      .map(card => card.dataset.imageUrl)
      .filter(Boolean);
  }

  function persistGalleryToActive(options = {}) {
    if (isEditClosingLocked() || !els.editOverlay?.classList?.contains('show')) return false;
    const ch = getCharacter(app.activeId);
    if (!ch) return;

    const items = app.lastGalleryItems?.length
      ? dedupeGalleryItems(app.lastGalleryItems)
      : dedupeGalleryItems(getVisibleGalleryUrls());
    const urls = items.map(item => item.url);
    if (!urls.length) return;

    ch.mudaeImages = urls;
    ch.mudaeImageMeta = buildGalleryMetaMap(items);
    syncMudaeGalleryFlags(ch);

    if (options.deferred) saveLocalDeferred(160);
    else saveLocal();
  }


  function ensureSearchLink(url, name) {
    let link = $('#mudaeSearchFallbackLink');
    if (link) link.remove();

    link = document.createElement('a');
    link.id = 'mudaeSearchFallbackLink';
    link.className = 'search-fallback';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open Mudae search for ' + (name || 'character');

    els.galleryStatus.insertAdjacentElement('afterend', link);
  }

  function searchMudae() {
    const name = els.editNameInput.value.trim();
    const url = makeMudaeSearchUrl(name);

    openGallery('search');
    setGalleryStatus('Opening Mudae search. Copy links there, then return here and press Ctrl+V.');
    ensureSearchLink(url, name);

    let opened = null;
    try {
      opened = window.open(url, '_blank', 'noopener,noreferrer');
    } catch {}

    if (!opened) {
      setGalleryStatus('Browser blocked auto-open. Use the link below, copy links, then press Ctrl+V here.');
    }
  }

  function autoSearchMudae() {
    if (isEditClosingLocked() || !els.editOverlay?.classList?.contains('show')) return false;
    renderPlaceholder();
    openGallery('auto-search');
    setGalleryStatus('No image found. Auto Search Mudae triggered.');
    setTimeout(searchMudae, 120);
  }



  // v2.447: robust delegated binding for Delete Character button.
  function installEditDeleteCharacterDelegatedHandler() {
    if (window.__mhpEditDeleteCharacterDelegatedHandlerInstalled) return;
    window.__mhpEditDeleteCharacterDelegatedHandlerInstalled = true;

    document.addEventListener('click', async (event) => {
      const btn = event.target?.closest?.('#deleteEditCharacterBtn');
      if (!btn) return;

      event.preventDefault();
      event.stopPropagation();

      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;

      try {
        await (window.MHPDeleteActiveCharacterFromEdit || deleteActiveCharacterFromEdit)();
      } catch (error) {
        console.error(error);
        notifyAppMessage?.('Could not delete character.', { variant: 'danger' });
      }
    }, true);
  }

  window.MHPInstallEditDeleteCharacterDelegatedHandler = installEditDeleteCharacterDelegatedHandler;


  // v2.446: delete active character directly from the edit modal.
  async function deleteActiveCharacterFromEdit() {
    const activeEditId = app.activeId || els.editIdInput?.value || document.getElementById('editIdInput')?.value || '';
    const ch = getCharacter(activeEditId);
    if (!ch || isDivider(ch)) {
      notifyAppMessage('No character selected to delete.', { variant: 'warning' });
      return false;
    }

    const name = ch.name || 'this character';
    let ok = false;

    if (typeof showAppConfirm === 'function') {
      ok = await showAppConfirm(`Delete ${name}? This cannot be undone unless you reload/import an older backup.`, {
        title: 'Delete character',
        okText: 'Delete',
        cancelText: 'Cancel',
        danger: true
      });
    } else if (typeof showAppDialog === 'function') {
      ok = await showAppDialog({
        type: 'confirm',
        title: 'Delete character',
        message: `Delete ${name}? This cannot be undone unless you reload/import an older backup.`,
        okText: 'Delete',
        cancelText: 'Cancel',
        danger: true
      });
    } else {
      ok = window.confirm(`Delete ${name}? This cannot be undone unless you reload/import an older backup.`);
    }

    // Some dialog helpers return an object, some return true.
    ok = ok === true || ok?.ok === true || ok?.confirmed === true || ok?.action === 'ok';

    if (!ok) return false;

    const index = app.state.characters.findIndex(item => !isDivider(item) && item.id === ch.id);
    if (index < 0) return false;

    app.state.characters.splice(index, 1);

    if (app.multiSelectedIds?.delete) app.multiSelectedIds.delete(ch.id);
    if (app.selectedMoveCharacterId === ch.id) app.selectedMoveCharacterId = null;
    if (app.draggedCharacterId === ch.id) app.draggedCharacterId = null;
    if (app.lastSearchPrimaryCharacterId === ch.id) app.lastSearchPrimaryCharacterId = null;
    if (app.pendingJumpHighlightId === ch.id) app.pendingJumpHighlightId = null;

    app.activeId = null;
    app.selectedGalleryIndex = null;

    closeEdit();

    assignBoardCounters();
    recalcStats();
    syncGroupsFromCharacters?.();
    saveLocal();

    renderAll();
    window.MudaeBoardController?.updateEntriesFromApp?.();

    notifyAppMessage(`Deleted ${name}.`, { variant: 'danger' });
    return true;
  }

  // v2.453: expose edit delete action for delegated/global handlers.
  window.MHPDeleteActiveCharacterFromEdit = deleteActiveCharacterFromEdit;



  // v2.461: prevent edit modal from reopening immediately after save/close.
  function suppressEditReopen(ms = 900) {
    app.editReopenSuppressedUntil = performance.now() + Math.max(200, Number(ms) || 900);
    window.__mhpSuppressEditOpenUntil = app.editReopenSuppressedUntil;
  }

  function isEditReopenSuppressed() {
    const until = Math.max(Number(app.editReopenSuppressedUntil || 0), Number(window.__mhpSuppressEditOpenUntil || 0));
    return performance.now() < until;
  }


  // v2.465: update one card after edit save, without rebuilding all images.
    // v2.468: safe single-card refresh after edit save.
  // Do not call createCharacterCard directly: that function does not exist in this rebuild.
  // If no safe card renderer is available, skip visual replacement instead of triggering
  // renderAll()/image reload loops.
  function renderCharacterCardById(id) {
    if (!id || !els.board) return false;

    const ch = getCharacter(id);
    if (!ch || isDivider(ch)) return false;

    const selector = `.char-card[data-id="${CSS.escape(id)}"], .character-card[data-id="${CSS.escape(id)}"]`;
    const oldCard = els.board.querySelector(selector);
    if (!oldCard) return false;

    try {
      const renderer =
        (typeof renderCharacterCard === 'function' && renderCharacterCard) ||
        (typeof createCard === 'function' && createCard) ||
        (typeof buildCharacterCard === 'function' && buildCharacterCard) ||
        window.MudaeCards?.renderCharacterCard ||
        window.MudaeCards?.createCharacterCard ||
        window.MudaeBoardController?.renderCharacterCard ||
        null;

      if (typeof renderer === 'function') {
        const newCard = renderer(ch);
        if (newCard instanceof Node) {
          oldCard.replaceWith(newCard);
          return true;
        }
      }

      // Minimal in-place refresh for the most visible fields only.
      const nameNode = oldCard.querySelector('.char-name, .character-name, [data-field="name"]');
      const seriesNode = oldCard.querySelector('.char-series, .character-series, [data-field="series"]');
      const imgNode = oldCard.querySelector('img.char-img, img.character-img, img');

      if (nameNode) nameNode.textContent = ch.name || '';
      if (seriesNode) seriesNode.textContent = ch.series || '';
      if (imgNode && ch.image && hasRealImage(ch.image)) {
        const current = imgNode.currentSrc || imgNode.src || imgNode.dataset?.src || '';
        if (current !== ch.image) {
          imgNode.src = ch.image;
          if (imgNode.dataset) imgNode.dataset.src = ch.image;
        }
      }

      oldCard.dataset.id = ch.id;
      oldCard.dataset.name = ch.name || '';
      oldCard.dataset.series = ch.series || '';

      return true;
    } catch (error) {
      console.warn('[MHP] Single card safe refresh skipped:', error);
      return false;
    }
  }



  
  // v2.469: block post-edit restore/anchor loops.
  function cancelPostEditRestoreLoops(ms = 5200) {
    const until = performance.now() + Math.max(1500, Number(ms) || 5200);
    app.postEditRestoreBlockedUntil = until;
    window.__mhpPostEditRestoreBlockedUntil = until;

    app.editOpenAnchor = null;
    app.pendingInitialViewRestore = null;
    app.pendingJumpHighlightId = null;

    if (Array.isArray(app.initialViewRestoreTimers)) {
      app.initialViewRestoreTimers.forEach(timer => clearTimeout(timer));
      app.initialViewRestoreTimers = [];
    }

    [
      'initialViewRestoreTimer',
      'viewRestoreTimer',
      'restoreViewTimer',
      'scrollRestoreTimer',
      'editOpenAnchorTimer',
      'galleryAutoSearchTimer',
      'galleryMediaRefreshRaf',
      'deferredSaveLocalTimer'
    ].forEach(key => {
      const value = app[key];
      if (!value) return;
      try { clearTimeout(value); } catch (_) {}
      try { cancelAnimationFrame(value); } catch (_) {}
      app[key] = 0;
    });

    document.documentElement.classList.add('mhp-post-edit-close');
    document.body?.classList?.add('mhp-post-edit-close');

    clearTimeout(app.postEditRestoreBlockTimer);
    app.postEditRestoreBlockTimer = setTimeout(() => {
      if (performance.now() >= Number(app.postEditRestoreBlockedUntil || 0)) {
        document.documentElement.classList.remove('mhp-post-edit-close');
        document.body?.classList?.remove('mhp-post-edit-close');
      }
    }, Math.max(1500, Number(ms) || 5200) + 120);
  }

  function isPostEditRestoreBlocked() {
    return performance.now() < Math.max(
      Number(app.postEditRestoreBlockedUntil || 0),
      Number(window.__mhpPostEditRestoreBlockedUntil || 0)
    );
  }

function saveEdit() {
    const id = els.editIdInput.value || app.activeId;
    const ch = getCharacter(id);

    if (!ch) {
      showAppAlert('No character selected to save.', { title: 'Nothing to save' });
      return false;
    }

    const savedName = els.editNameInput.value.trim() || ch.name || 'character';

    // Read all visible form/gallery data while the edit is still mounted.
    const nextData = {
      name: savedName,
      series: els.editSeriesInput.value.trim(),
      image: els.editImageInput.value.trim(),
      globalRank: num(els.editRankInput.value),
      kakera: num(els.editKakeraInput.value),
      keys: num(els.editKeysInput.value),
      owner: els.editOwnerInput.value.trim(),
      roulette: els.editRouletteInput.value.trim(),
      color: syncEmbedColorPreview('text', { commit: true }),
      note: els.editNoteInput.value.trim(),
      spheres: readSpheresInputs(),
      galleryUrls: getVisibleGalleryUrls(),
      galleryItems: app.lastGalleryItems?.length ? dedupeGalleryItems(app.lastGalleryItems) : []
    };

    // v2.470: close first and return control to the browser before heavy work.
    // This makes Save feel immediate even if JSON/localStorage is large.
    cancelEditSession(180);
    cancelPostEditRestoreLoops(300);
    hardCloseEditModal();

    notifyAppMessage(`Saved ${savedName}.`);

    const finishSave = () => {
      try {
        ch.name = nextData.name || ch.name;
        ch.series = nextData.series;
        ch.stableKey = makeStableKey(ch.name, ch.series);

        ch.image = nextData.image;
        ch.imageUrl = ch.image;

        if (ch.image && hasRealImage(ch.image)) {
          ch.mudaeImages = dedupeCharacterImageUrls(ch.mudaeImages || []);
          const mainKey = canonicalImageUrlKey(ch.image);
          const hasMainInGallery = ch.mudaeImages.some(url => canonicalImageUrlKey(url) === mainKey);
          if (!hasMainInGallery && ch.mudaeImages.length === 0) ch.mudaeImages.push(ch.image);
          syncMudaeGalleryFlags(ch);
        }

        normalizeCharacterImageGalleryPreserveOrder(ch);

        ch.globalRank = nextData.globalRank;
        ch.kakera = nextData.kakera;
        ch.keys = nextData.keys;
        ch.owner = nextData.owner;
        ch.roulette = nextData.roulette;
        ch.color = nextData.color;
        ch.keyType = getKeyTypeFromCount(ch.keys);
        ch.note = nextData.note;
        ch.spheres = nextData.spheres;

        if (nextData.galleryUrls.length) {
          ch.mudaeImages = mergeGalleryUrlsPreserveAbsoluteOrder(ch.mudaeImages || [], nextData.galleryUrls, ch.image);
          if (nextData.galleryItems.length) ch.mudaeImageMeta = buildGalleryMetaMap(nextData.galleryItems);
          syncMudaeGalleryFlags(ch, { skipNormalize: true });
        }

        assignBoardCounters();
        recalcStats();
        saveLocal();

        const refreshed = typeof renderCharacterCardById === 'function'
          ? renderCharacterCardById(id)
          : false;

        if (!refreshed) {
          window.MudaeBoardController?.updateEntriesFromApp?.();
        }
      } catch (error) {
        console.error('[MHP] Deferred save failed:', error);
        showAppAlert('The edit was closed, but saving failed: ' + (error?.message || error), {
          title: 'Save failed',
          variant: 'danger'
        });
      } finally {
        // Final close-only cleanup. No scroll restore, no anchor restore.
        els.editOverlay?.classList?.remove('show', 'is-fast-paint');
        els.editOverlay?.setAttribute?.('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
        app.activeId = null;
        app.selectedGalleryIndex = null;
        app.editOpenAnchor = null;
      }
    };

    // Let the close paint first, then run the heavier save work.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(finishSave, { timeout: 900 });
        } else {
          setTimeout(finishSave, 0);
        }
      });
    });

    return true;
  }

  function handleGlobalPaste(event) {
    if (!els.editOverlay.classList.contains('show')) return;

    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text || !/https?:\/\//i.test(text)) return;

    const active = document.activeElement;
    const tag = active && active.tagName ? active.tagName.toUpperCase() : '';

    // If the user is typing in normal edit fields, don't hijack paste unless
    // the gallery is open or the target is the gallery paste box.
    const galleryOpen = !els.galleryPanel.hidden;
    const isGalleryPasteBox = active === els.galleryPasteInput;

    if (!galleryOpen && !isGalleryPasteBox) return;

    event.preventDefault();
    openGallery('ctrl-v');
    parsePastedGallery(text);
  }


  function fullSphereLevels() {
    return [6, 6, 6, 6, 6, 1, 1, 1, 1, 1];
  }

  function emptySphereLevels() {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

const {
    normalizeCharacterNameKey,
    parseSphereLines,
    parseMudaeNumber,
    looksLikeSphereDump,
    isSphereEntryLine,
    stripSphereOnlyLines,
    looksLikeCharacterDump,
    hasRealCharacterEntries
  } = window.MudaeRebuildParser;

  function parseMudaeText(text) {
    return window.MudaeRebuildParser.parseMudaeText(text, {
      baseCount: app.state.characters.length
    });
  }

  function isParserCharacterHeaderLine(line) {
    const clean = str(line).trim();
    if (!clean) return false;
    if (/^[-–—_]{3,}$/.test(clean)) return false;

    // Standard Mudae ownership line, for example:
    // Aka Onda  💞 => kouno
    // #50235 - Aka Onda 💞 => kouno · ($wa) 89 ka
    if (/💞\s*=>/u.test(clean)) return true;

    // Conservative fallback for copied Mudae blocks without the heart glyph.
    // Require an owner arrow plus a likely rank/value marker to avoid matching normal prose.
    if (/=>\s*\S+/u.test(clean) && /(?:^#?\s*[\d.,]+\s*[-–—]|\bka\b|:kakera:|\(\$[wh][ag]\))/i.test(clean)) return true;

    return false;
  }

  function isParserSeparatorLine(line) {
    return /^[-–—_]{3,}$/.test(str(line).trim());
  }

  function normalizeParserCharacterBlockSpacing(rawText) {
    const input = str(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!input.trim()) return { text: input, inserted: 0, removedSeparators: 0, changed: false };

    const lines = input.split('\n');
    const out = [];
    let insideCharacterBlock = false;
    let inserted = 0;
    let removedSeparators = 0;

    const lastOutIsBlank = () => !out.length || !str(out[out.length - 1]).trim();

    for (const line of lines) {
      const trimmed = str(line).trim();

      // Treat manual separators like "------" as block separators, but don't keep
      // them inside the parser input because they can make a good character block
      // look like an unparsed mixed block.
      if (isParserSeparatorLine(line)) {
        removedSeparators += 1;
        if (!lastOutIsBlank()) out.push('');
        insideCharacterBlock = false;
        continue;
      }

      const isHeader = isParserCharacterHeaderLine(line);
      if (isHeader && insideCharacterBlock && !lastOutIsBlank()) {
        out.push('');
        inserted += 1;
      }

      out.push(line);

      if (!trimmed) insideCharacterBlock = false;
      else if (isHeader) insideCharacterBlock = true;
      else if (insideCharacterBlock) insideCharacterBlock = true;
    }

    const normalized = out.join('\n').replace(/\n{3,}/g, '\n\n');
    return {
      text: normalized,
      inserted,
      removedSeparators,
      changed: normalized !== input
    };
  }

  function normalizeParserInputValue({ updateField = true } = {}) {
    if (!els.parserInput) return { text: '', inserted: 0, removedSeparators: 0, changed: false };
    const before = els.parserInput.value || '';
    const result = normalizeParserCharacterBlockSpacing(before);
    if (updateField && result.changed) {
      const oldEnd = els.parserInput.selectionEnd;
      els.parserInput.value = result.text;
      if (typeof oldEnd === 'number') {
        const pos = Math.min(result.text.length, Math.max(0, oldEnd + (result.text.length - before.length)));
        els.parserInput.setSelectionRange?.(pos, pos);
      }
      scheduleParserCounterUpdate();
    }
    return result;
  }

  function insertNormalizedParserPaste(event) {
    if (!els.parserInput || event.target !== els.parserInput) return;
    const clip = event.clipboardData?.getData?.('text/plain');
    if (!clip) return;

    const normalizedPaste = normalizeParserCharacterBlockSpacing(clip);
    const sourceValue = els.parserInput.value || '';
    const start = els.parserInput.selectionStart ?? sourceValue.length;
    const end = els.parserInput.selectionEnd ?? sourceValue.length;
    const before = sourceValue.slice(0, start);
    const after = sourceValue.slice(end);

    let pasteText = normalizedPaste.text;

    // If the existing text already ends inside a character block and the pasted
    // text starts with another Mudae character, add the missing blank line at the boundary.
    const beforeLines = before.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const lastNonBlankBefore = [...beforeLines].reverse().find(line => str(line).trim()) || '';
    const firstNonBlankPaste = pasteText.split('\n').find(line => str(line).trim()) || '';
    const addedBoundaryBreak = !!(lastNonBlankBefore && firstNonBlankPaste && isParserCharacterHeaderLine(firstNonBlankPaste) && !/\n\s*\n$/.test(before));
    if (addedBoundaryBreak) {
      pasteText = '\n\n' + pasteText.replace(/^\n+/, '');
    }

    const nextValue = before + pasteText + after;
    const cursor = before.length + pasteText.length;
    event.preventDefault();
    els.parserInput.value = nextValue;
    els.parserInput.setSelectionRange?.(cursor, cursor);
    scheduleParserCounterUpdate();

    const totalInserted = normalizedPaste.inserted + (addedBoundaryBreak ? 1 : 0);
    if (totalInserted || normalizedPaste.removedSeparators) {
      setParserStatus(
        `Paste normalized: ${totalInserted} block break(s) added` +
        `${normalizedPaste.removedSeparators ? `, ${normalizedPaste.removedSeparators} separator line(s) cleaned` : ''}.`
      );
    }
  }

  function findCharacterByName(name) {
    const key = normalizeCharacterNameKey(name);
    if (!key) return null;

    let exact = null;
    let loose = null;

    for (const item of app.state.characters) {
      if (isDivider(item)) continue;

      const itemKey = normalizeCharacterNameKey(item.name);
      if (itemKey === key) {
        exact = item;
        break;
      }

      if (!loose && (itemKey.includes(key) || key.includes(itemKey))) {
        loose = item;
      }
    }

    return exact || loose;
  }

  function parseSpherePerkText(perkText, investedValue = 0) {
    perkText = str(perkText).trim();

    if (/full|max|all/i.test(perkText)) {
      return { levels: fullSphereLevels() };
    }

    const levels = emptySphereLevels();

    // Examples:
    // 9, 10
    // P9+10
    // P1, P2, P8
    // 1 2 8
    const nums = [...perkText.matchAll(/(?:P\s*)?([1-9]|10)\b/gi)]
      .map(m => num(m[1]))
      .filter(n => n >= 1 && n <= 10);

    nums.forEach(p => {
      levels[p - 1] = p <= 5 ? 1 : 1;
    });

    // If only invested amount is present and it matches full cost, mark full.
    if (!nums.length && investedValue >= 40000) {
      return { levels: fullSphereLevels() };
    }

    return levels.some(Boolean) ? { levels } : null;
  }

function applySphereParse(text) {
    const result = parseSphereLines(text);

    if (!result.entries.length) {
      setParserStatus('No sphere entries detected.');
      return { updated: 0, missing: 0, totalInvested: result.totalInvested };
    }

    let updated = 0;
    let missing = 0;
    const missingNames = [];

    result.entries.forEach(entry => {
      const ch = findCharacterByName(entry.name);
      if (!ch) {
        missing++;
        missingNames.push(entry.name);
        return;
      }

      ch.spheres = entry.spheres;
      ch.sphereInvested = entry.invested;
      updated++;
    });

    saveLocal();
    renderAll();

    const totalText = result.totalInvested ? ` · Dump total: ${fmt(result.totalInvested)} SP` : '';
    const missingText = missing ? ` · Missing: ${missing} (${missingNames.slice(0, 5).join(', ')}${missing > 5 ? '…' : ''})` : '';
    setParserStatus(`Updated spheres for ${updated} character(s).${totalText}${missingText}`);

    return { updated, missing, totalInvested: result.totalInvested };
  }

  function isSeriesSectionHeader(line) {
    line = str(line).trim();
    return /^(.+?)\s*-\s*\d+\s*\/\s*\d+\s*$/.test(line);
  }


  // v2.434: image URL extraction for inline Mudae parse lines.
  const INLINE_IMAGE_URL_RE = /https?:\/\/[^\s<>"')]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>"')]+)?/ig;

  function extractInlineImageUrl(text) {
    const raw = str(text || '');
    const matches = raw.match(INLINE_IMAGE_URL_RE) || [];
    if (!matches.length) return '';

    const clean = matches
      .map(url => String(url || '').trim().replace(/[.,;)\]}]+$/g, ''))
      .filter(Boolean);

    return clean.find(url => /mudae\.net\/uploads\//i.test(url)) || clean[0] || '';
  }

  function stripInlineImageUrls(text) {
    return str(text || '').replace(INLINE_IMAGE_URL_RE, '').replace(/\s{2,}/g, ' ').trim();
  }


  // v2.435: canonical character image helpers.
  function getCharacterImageUrl(character) {
    if (!character) return '';
    return str(
      character.imageUrl ||
      character.image ||
      (Array.isArray(character.mudaeImages) ? character.mudaeImages.find(Boolean) : '') ||
      ''
    ).trim();
  }

  function syncCharacterImageFields(character, imageUrl) {
    if (!character) return character;
    const image = str(imageUrl || getCharacterImageUrl(character)).trim();

    character.image = image;
    character.image = image;
    character.imageUrl = image;

    const gallery = Array.isArray(character.mudaeImages)
      ? character.mudaeImages.filter(Boolean)
      : [];

    if (image && !gallery.includes(image) && gallery.length === 0) gallery.push(image);

    character.mudaeImages = gallery;
    syncMudaeGalleryFlags(character);

    return character;
  }

  function parseSeriesSectionHeader(line) {
    const m = str(line).trim().match(/^(.+?)\s*-\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!m) return null;

    return {
      series: m[1].trim(),
      owned: num(m[2]),
      total: num(m[3])
    };
  }

  function isRankedCharacterLine(line) {
    return /^#?[\d.,]+\s*[-–]\s*/.test(str(line).trim());
  }

  function parseRankedCharacterLine(line, seriesInfo) {
    line = str(line).trim();
    const inlineImage = extractInlineImageUrl(line);
    const rankMatch = line.match(/^#?([\d.,]+)\s*[-–]\s*(.+)$/);
    if (!rankMatch || !seriesInfo) return null;

    const globalRank = parseMudaeNumber(rankMatch[1]);
    let rest = stripInlineImageUrls(rankMatch[2].trim());

    const kakeraMatch = rest.match(/([\d.,]+)\s*(?::kakera:|ka\b|kakera\b)/i);
    const kakera = kakeraMatch ? parseMudaeNumber(kakeraMatch[1]) : 0;

    const rouletteMatch = rest.match(/\((\$w[ag]|\$h[ag])\)|(?<![A-Za-z])(\$wa|\$ha|\$wg|\$hg)(?![A-Za-z])/i);
    const roulette = rouletteMatch ? (rouletteMatch[1] || rouletteMatch[2] || '').toLowerCase() : '';

    const keysMatch = rest.match(/:(bronze|silver|gold|chaos)key:\s*(?:\(|\s| )*(\d+)\)?/i) ||
      rest.match(/keys?\s*[:x]?\s*(\d+)/i);
    const keyTypeMatch = rest.match(/:(bronze|silver|gold|chaos)key:/i);

    const keys = keysMatch ? num(keysMatch[2] || keysMatch[1]) : 0;
    const keyType = keyTypeMatch ? keyTypeMatch[1].toLowerCase() : '';

    const ownerMatch = rest.match(/=>\s*([^·|\n]+)/u);
    const owner = ownerMatch ? ownerMatch[1].trim() : '';

    // Name is everything before love/owner markers, trade markers, roulette, keys, kakera, etc.
    let name = rest
      .replace(/\s*💞.*$/u, '')
      .replace(/\s*=>.*$/u, '')
      .replace(/\s*\|\s*Tradeable.*$/iu, '')
      .replace(/\s*·.*$/u, '')
      .trim();

    if (!name) return null;

    return {
      id: uid(),
      stableKey: makeStableKey(name, seriesInfo.series),
      currentRank: app.state.characters.length + parsedOffset(),
      name,
      series: seriesInfo.series,
      image: inlineImage,
      imageUrl: inlineImage,
      editNumber: 0,
      globalRank,
      likeRank: 0,
      owner: cleanParsedOwner(owner),
      note: '',
      roulette,
      keyType,
      keys,
      kakera,
      color: '#8B5CF6',
      mudaeTags: inferTags(roulette),
      seriesOwned: seriesInfo.owned || 0,
      seriesTotal: seriesInfo.total || 0,
      spheres: null,
      mudaeImages: inlineImage ? [inlineImage] : [],
      hasMudaeGallery: false,
      mudaeGalleryCount: 0,
      sortLocked: false,
      rawText: line
    };
  }

  function parseSeriesSectionText(text) {
    const lines = str(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const parsed = [];
    const skipped = [];
    let currentSeries = null;
    let sawSeriesSection = false;

    for (const line of lines) {
      const header = parseSeriesSectionHeader(line);
      if (header) {
        currentSeries = header;
        sawSeriesSection = true;
        continue;
      }

      if (currentSeries && isRankedCharacterLine(line)) {
        const item = parseRankedCharacterLine(line, currentSeries);
        if (item) parsed.push(item);
        else skipped.push(line);
        continue;
      }

      if (sawSeriesSection) skipped.push(line);
    }

    return sawSeriesSection ? { parsed, skipped } : null;
  }

function isCharacterMetadataLine(line) {
    line = str(line).trim();
    if (!line) return false;

    return /^Ruleta\s+de\s+/i.test(line) ||
      /^Claim\s+rank\s*:/i.test(line) ||
      /^Like\s+rank\s*:/i.test(line) ||
      /^Total\s+invested\s*:/i.test(line) ||
      /(?:^|\s)(?:\d+)\s*(?::kakera:|ka\b|kakera\b)/i.test(line) ||
      /\((\$w[ag]|\$h[ag])\)|(?<![A-Za-z])(\$wa|\$ha|\$wg|\$hg)(?![A-Za-z])/i.test(line);
  }

  function cleanSeriesLine(line) {
    return str(line)
      .replace(/\s*:female:/gi, '')
      .replace(/\s*:male:/gi, '')
      .trim();
  }

  function collectSeriesFromBlockLines(lines) {
    const parts = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (isCharacterMetadataLine(line)) break;
      if (isSphereEntryLine(line)) break;
      if (isRankedCharacterLine(line)) break;

      const cleaned = cleanSeriesLine(line);
      if (cleaned) parts.push(cleaned);
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function parseMudaeBlock(block) {
    const sectionResult = parseSeriesSectionText(block);
    if (sectionResult && sectionResult.parsed.length) return sectionResult.parsed[0];

    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length >= 2 && isSeriesSectionHeader(lines[0]) && isRankedCharacterLine(lines[1])) {
      return null;
    }
    if (lines.length < 2) return parseCompactLine(block);

    const first = lines[0];
    const seriesFromLines = collectSeriesFromBlockLines(lines);

    // Name line examples:
    // Shisei Houjou  💞 => kouno
    // Happa Tsubomioka  💞 => kouno
    // #987 - Pepe  💞 => .noao. · ($ha) 520 ka
    let name = first
      .replace(/^#?[\d.,]+\s*[-–]\s*/, '')
      .replace(/\s*💞.*$/u, '')
      .replace(/\s*=>.*$/u, '')
      .trim();

    if (!name) return null;

    const ownerMatch = first.match(/=>\s*([^·\n]+)/u);
    const owner = ownerMatch ? ownerMatch[1].trim() : '';

    const typeMatch = block.match(/\((\$w[ag]|\$h[ag])\)|(?<![A-Za-z])(\$wa|\$ha|\$wg|\$hg)(?![A-Za-z])/i);
    const roulette = typeMatch ? (typeMatch[1] || typeMatch[2] || '').toLowerCase() : inferRouletteFromText(block);

    const kakeraMatch = block.match(/([\d.,]+)\s*(?::kakera:|ka\b|kakera\b)/i);
    const kakera = kakeraMatch ? parseMudaeNumber(kakeraMatch[1]) : 0;

    const claimMatch = block.match(/Claim\s*rank\s*:\s*#?\s*([\d.,]+)/i) ||
      block.match(/#\s*([\d.,]+)/);
    const globalRank = claimMatch ? parseMudaeNumber(claimMatch[1]) : 0;

    const likeMatch = block.match(/Like\s*rank\s*:\s*#?\s*([\d.,]+)/i);
    const likeRank = likeMatch ? parseMudaeNumber(likeMatch[1]) : 0;

    const keysMatch = block.match(/(?:bronzekey|silverkey|goldkey|chaoskey)[^()\d]*(?:\(|\s)(\d+)\)?/i) ||
      block.match(/keys?\s*[:x]?\s*(\d+)/i);
    const keys = keysMatch ? num(keysMatch[1]) : 0;

    const keyTypeMatch = block.match(/:(bronze|silver|gold|chaos)key:/i);
    const keyType = keyTypeMatch ? keyTypeMatch[1].toLowerCase() : '';

    const genderType = /:male:|\(\$ha\)|\$ha|\$hg/i.test(block)
      ? 'ha'
      : /:female:|\(\$wa\)|\$wa|\$wg/i.test(block)
        ? 'wa'
        : '';

    const image = extractInlineImageUrl(block);

    return {
      id: uid(),
      stableKey: makeStableKey(name, seriesFromLines || 'No series'),
      currentRank: app.state.characters.length + parsedOffset(),
      name,
      series: seriesFromLines || 'No series',
      image,
      editNumber: 0,
      globalRank,
      likeRank,
      owner: cleanParsedOwner(owner),
      note: '',
      roulette: roulette || (genderType ? '$' + genderType : ''),
      keyType,
      keys,
      kakera,
      color: '#8B5CF6',
      mudaeTags: inferTags(roulette || genderType),
      seriesOwned: 0,
      seriesTotal: 0,
      spheres: null,
      mudaeImages: image ? [image] : [],
      hasMudaeGallery: false,
      mudaeGalleryCount: 0,
      sortLocked: false,
      rawText: block
    };
  }

  function parseCompactLine(line) {
    line = str(line).trim();
    if (!line) return null;

    const inlineImage = extractInlineImageUrl(line);
    const parseLine = stripInlineImageUrls(line);

    // Series - count #rank - Character - value ka
    const m = parseLine.match(/^(.*?)\s*-\s*(?:\d+\s*\/\s*\d+\s*)?#?([\d.,]+)?\s*-\s*(.*?)\s*-\s*([\d.,]+)\s*ka/i);
    if (!m) return null;

    const series = m[1].trim();
    const rank = m[2] ? parseMudaeNumber(m[2]) : 0;
    const name = m[3].trim();
    const kakera = parseMudaeNumber(m[4]);

    if (!series || !name) return null;

    return {
      id: uid(),
      stableKey: makeStableKey(name, series),
      currentRank: app.state.characters.length + parsedOffset(),
      name,
      series,
      image: inlineImage,
      imageUrl: inlineImage,
      editNumber: 0,
      globalRank: rank,
      owner: '',
      note: '',
      roulette: '',
      keyType: '',
      keys: 0,
      kakera,
      color: '#8B5CF6',
      mudaeTags: [],
      seriesOwned: 0,
      seriesTotal: 0,
      spheres: null,
      mudaeImages: inlineImage ? [inlineImage] : [],
      hasMudaeGallery: false,
      mudaeGalleryCount: 0,
      sortLocked: false,
      rawText: line
    };
  }

  function cleanParsedOwner(value) {
    value = str(value)
      .replace(/[\u00a0\u1680\u180e\u2000-\u200d\u202f\u205f\u3000\ufeff]+/g, ' ')
      .replace(/[🚫✅❌✔️✖️]/gu, ' ')
      .trim();

    value = value.split(/\s+/)[0] || '';
    value = value.replace(/[^\p{L}\p{N}_.-]+/gu, '').trim();

    return value;
  }

function inferRouletteFromText(text) {
    text = str(text).toLowerCase();
    if (text.includes(':female:')) return '$wa';
    if (text.includes(':male:')) return '$ha';
    return '';
  }

  function parsedOffset() {
    return 1;
  }
  function renumberCharacters() {
    assignBoardCounters();

    app.state.characters.forEach(item => {
      if (isDivider(item)) return;
      const pos = item.displayCharacterIndex || getCharacterListPosition(item.id);
      item.currentRank = pos;
      item.editNumber = pos;
    });
  }





  function getExistingCharacterMapByStableKey() {
    const map = new Map();

    app.state.characters.forEach(item => {
      if (isDivider(item)) return;
      ensureCharacterIdentity(item);
      map.set(item.stableKey || makeStableKey(item.name, item.series), item);
    });

    return map;
  }

  function mergeParsedCharacterIntoExisting(existing, incoming) {
    if (!existing || !incoming) return false;

    const preserve = {
      id: existing.id,
      currentRank: existing.currentRank,
      editNumber: existing.editNumber,
      note: existing.note,
      color: normalizeEmbedColor(existing.color || '#8B5CF6'),
      spheres: existing.spheres,
      sphereInvested: existing.sphereInvested,
      mudaeImages: Array.isArray(existing.mudaeImages) ? existing.mudaeImages : [],
      hasMudaeGallery: existing.hasMudaeGallery,
      mudaeGalleryCount: existing.mudaeGalleryCount,
      mudaeImageMeta: existing.mudaeImageMeta && typeof existing.mudaeImageMeta === 'object' ? existing.mudaeImageMeta : {},
      image: existing.image,
      imageUrl: existing.imageUrl
    };

    existing.name = incoming.name || existing.name;
    existing.series = incoming.series || existing.series;
    existing.stableKey = makeStableKey(existing.name, existing.series);

    if (num(incoming.globalRank)) existing.globalRank = num(incoming.globalRank);
    if (num(incoming.likeRank)) existing.likeRank = num(incoming.likeRank);
    if (num(incoming.kakera)) existing.kakera = num(incoming.kakera);
    if (num(incoming.keys)) existing.keys = num(incoming.keys);

    if (incoming.owner) existing.owner = cleanParsedOwner(incoming.owner);
    if (incoming.roulette) existing.roulette = incoming.roulette;
    if (incoming.keyType) existing.keyType = incoming.keyType;

    if (Array.isArray(incoming.mudaeTags) && incoming.mudaeTags.length) {
      existing.mudaeTags = incoming.mudaeTags;
    } else if (incoming.roulette) {
      existing.mudaeTags = inferTags(incoming.roulette);
    }

    if (num(incoming.seriesOwned)) existing.seriesOwned = num(incoming.seriesOwned);
    if (num(incoming.seriesTotal)) existing.seriesTotal = num(incoming.seriesTotal);

    // Keep local/user data unless the incoming parse actually has replacement data.
    existing.id = preserve.id;
    existing.currentRank = preserve.currentRank || existing.currentRank;
    existing.editNumber = preserve.editNumber || existing.editNumber;
    existing.note = preserve.note || existing.note || '';
    existing.color = normalizeEmbedColor(preserve.color || existing.color || '#8B5CF6');
    existing.spheres = preserve.spheres || existing.spheres || null;
    existing.sphereInvested = preserve.sphereInvested || existing.sphereInvested || 0;

    forceParsedImageAsMain(incoming);
    const incomingMainImage = incoming.imageUrl || incoming.image || normalizeUrls(incoming.mudaeImages || [])[0] || '';

    if (incomingMainImage && hasRealImage(incomingMainImage)) {
      existing.image = incomingMainImage;
      existing.imageUrl = incomingMainImage;
    } else {
      existing.image = preserve.image || existing.image || '';
      existing.imageUrl = preserve.imageUrl || existing.imageUrl || existing.image || '';
    }

    // Preserve gallery cache unless the old one was empty and incoming has images.
    const incomingImages = normalizeUrls([
      incoming.imageUrl,
      incoming.image,
      ...normalizeUrls(incoming.mudaeImages)
    ]);
    if (preserve.mudaeImages.length) {
      existing.mudaeImages = dedupeCharacterImageUrls([...preserve.mudaeImages, ...incomingImages]);
      existing.mudaeImageMeta = preserve.mudaeImageMeta || existing.mudaeImageMeta || {};
      syncMudaeGalleryFlags(existing);
    } else if (incomingImages.length) {
      existing.mudaeImages = incomingImages;
      syncMudaeGalleryFlags(existing);
    } else {
      existing.mudaeImages = [];
      existing.hasMudaeGallery = false;
      existing.mudaeGalleryCount = 0;
    }

    existing.rawText = incoming.rawText || existing.rawText || '';
    return true;
  }



  // v2.437: dedupe image/gallery URLs by normalized URL key.
  function flattenImageUrlInput(input, output = []) {
    if (Array.isArray(input)) {
      input.forEach(item => flattenImageUrlInput(item, output));
      return output;
    }

    if (input && typeof input === 'object') {
      if (input.url) output.push(input.url);
      if (input.image) output.push(input.image);
      if (input.imageUrl) output.push(input.imageUrl);
      return output;
    }

    if (input != null) output.push(input);
    return output;
  }

  function canonicalImageUrlKey(url) {
    const clean = str(url || '').trim().replace(/[.,;)\]}]+$/g, '');
    if (!clean) return '';

    try {
      const parsed = new URL(clean, window.location.href);
      parsed.protocol = parsed.protocol.replace(/^http:$/i, 'https:');
      parsed.hash = '';
      parsed.search = '';
      return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/,'')}`.toLowerCase();
    } catch (_) {
      return clean
        .replace(/^https?:/i, '')
        .replace(/\?.*$/, '')
        .replace(/#.*$/, '')
        .replace(/\/+$/, '')
        .toLowerCase();
    }
  }

  function dedupeCharacterImageUrls(urls) {
    const seen = new Set();
    const result = [];

    flattenImageUrlInput(urls).forEach(url => {
      const clean = str(url || '').trim().replace(/[.,;)\]}]+$/g, '');
      if (!clean || !hasRealImage(clean)) return;

      const key = canonicalImageUrlKey(clean);
      if (!key || seen.has(key)) return;

      seen.add(key);
      result.push(clean);
    });

    return result;
  }



  // v2.638: Gallery order is absolute. Saving/selecting a main image must not
  // rebuild the gallery with the selected image first. Keep the existing saved
  // order as the authority and append only truly new URLs at the end.
  function mergeGalleryUrlsPreserveAbsoluteOrder(existingUrls = [], incomingUrls = [], fallbackImage = '') {
    const out = [];
    const seen = new Set();
    const add = url => {
      const clean = cleanImageUrlForGallery(url || '');
      if (!clean || !hasRealImage(clean)) return;
      const key = canonicalImageUrlKey(clean);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };

    (Array.isArray(existingUrls) ? existingUrls : []).forEach(add);
    (Array.isArray(incomingUrls) ? incomingUrls : []).forEach(add);
    if (!out.length) add(fallbackImage);
    return out;
  }

  // v2.461: main image must not reorder the Mudae gallery.
  function cleanImageUrlForGallery(url) {
    return str(url || '')
      .trim()
      .replace(/[.,;)]+$/g, '')
      .replace(/\]+$/g, '')
      .replace(/\}+$/g, '');
  }

  function normalizeCharacterImageGalleryPreserveOrder(character, options = {}) {
    if (!character || isDivider(character)) return character;

    const main = cleanImageUrlForGallery(character.imageUrl || character.image || '');
    const gallery = Array.isArray(character.mudaeImages) ? character.mudaeImages : [];
    let uniqueGallery = dedupeCharacterImageUrls(gallery);

    const finalMain = main && hasRealImage(main) ? main : (uniqueGallery[0] || '');

    const shouldAppendMain =
      finalMain &&
      hasRealImage(finalMain) &&
      (options.appendMissingMain === true || uniqueGallery.length === 0);

    if (shouldAppendMain) {
      const mainKey = canonicalImageUrlKey(finalMain);
      const hasMain = uniqueGallery.some(url => canonicalImageUrlKey(url) === mainKey);
      if (!hasMain) uniqueGallery = dedupeCharacterImageUrls([...uniqueGallery, finalMain]);
    }

    character.image = finalMain;
    character.imageUrl = finalMain;
    character.mudaeImages = uniqueGallery;
    syncMudaeGalleryFlags(character, { skipNormalize: true });

    return character;
  }

  function normalizeCharacterImageGallery(character) {
    return normalizeCharacterImageGalleryPreserveOrder(character);
  }


  // v2.485: a single image is the character's default image, not a gallery.
  function getEffectiveMudaeGalleryUrls(character, options = {}) {
    if (!character || isDivider(character)) return [];
    if (!options.skipNormalize) normalizeCharacterImageGallery(character);

    // Gallery order is independent from the selected main image. Do not
    // synthesize `[main, ...gallery]` here or the edit gallery will appear
    // reordered after reload/save. If there is a saved gallery, it is the
    // source of truth. Only fall back to the main image when no gallery exists.
    const gallery = dedupeCharacterImageUrls(Array.isArray(character.mudaeImages) ? character.mudaeImages : [])
      .filter(url => hasRealImage(url));
    if (gallery.length) return gallery;

    const main = cleanImageUrlForGallery(character.imageUrl || character.image || '');
    return main && hasRealImage(main) ? [main] : [];
  }

  function getEffectiveMudaeGalleryCount(character, options = {}) {
    const urls = getEffectiveMudaeGalleryUrls(character, options);
    return urls.length > 1 ? urls.length : 0;
  }

  function syncMudaeGalleryFlags(character, options = {}) {
    if (!character || isDivider(character)) return 0;
    const count = getEffectiveMudaeGalleryCount(character, options);
    character.hasMudaeGallery = count > 0;
    character.mudaeGalleryCount = count;
    return count;
  }

  // Gallery badge must use the unique real gallery count, not stale mudaeGalleryCount.
  function getUniqueGalleryImageCount(character) {
    return getEffectiveMudaeGalleryCount(character);
  }


  // v2.442: compact exported JSON using the app's real schema.
  function isEmptyExportValue(value) {
    return value === undefined || value === null || value === '' || value === false ||
      (Array.isArray(value) && value.length === 0) ||
      (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
  }

  function cleanExportObject(obj) {
    Object.keys(obj).forEach(key => {
      if (isEmptyExportValue(obj[key])) delete obj[key];
    });
    return obj;
  }

  function compactSpheresForExport(spheres) {
    if (!spheres || typeof spheres !== 'object') return undefined;
    const out = {};
    Object.entries(spheres).forEach(([key, value]) => {
      if (!isEmptyExportValue(value) && value !== 0) out[key] = value;
    });
    return Object.keys(out).length ? out : undefined;
  }

  function compactCharacterForExport(item) {
    if (!item || typeof item !== 'object') return item;

    if (isDivider(item)) {
      const divider = {
        type: 'divider',
        id: item.id,
        title: item.title || item.name || '',
        level: Number(item.level || 1) || 1,
        color: item.color || undefined,
        note: item.note || undefined,
        collapsed: item.collapsed === true || undefined
      };
      return cleanExportObject(divider);
    }

    normalizeCharacterImageGallery?.(item);

    const mainImage = str(item.imageUrl || item.image || '').trim();
    // Keep gallery order absolute. The selected main image is independent from the
    // Mudae gallery order, so exports must not remove/reinsert the main URL.
    const gallery = dedupeCharacterImageUrls?.(item.mudaeImages || []) || normalizeUrls(item.mudaeImages || []);

    const out = {
      id: item.id,
      color: item.color || undefined,
      currentRank: Number(item.currentRank || 0) || undefined,
      name: item.name || '',
      series: item.series || '',
      image: mainImage || undefined,
      globalRank: Number(item.globalRank || 0) || undefined,
      owner: item.owner || undefined,
      roulette: item.roulette || undefined,
      kakera: Number(item.kakera || 0) || undefined,
      mudaeTags: item.mudaeTags || undefined,
      seriesOwned: Number(item.seriesOwned || 0) || undefined,
      seriesTotal: Number(item.seriesTotal || 0) || undefined,
      keyType: item.keyType || undefined,
      keys: Number(item.keys || 0) || undefined,
      sortLocked: item.sortLocked === true || undefined,
      note: item.note || undefined,
      lockGroupId: item.lockGroupId || undefined,
      lockGroupLabel: item.lockGroupLabel || undefined,
      groupId: item.groupId || undefined,
      groupLabel: item.groupLabel || undefined,
      likeRank: Number(item.likeRank || 0) || undefined,
      spheres: compactSpheresForExport(item.spheres),
      sphereInvested: Number(item.sphereInvested || 0) || undefined
    };

    if (gallery.length) out.mudaeImages = gallery;

    const galleryMeta = item.mudaeImageMeta && typeof item.mudaeImageMeta === 'object' ? item.mudaeImageMeta : null;
    if (galleryMeta && Object.keys(galleryMeta).length) out.mudaeImageMeta = galleryMeta;

    // Runtime/derived fields intentionally omitted:
    // imageUrl, hasMudaeGallery, mudaeGalleryCount, rawText, stableKey,
    // editNumber, boardIndex, display*Index and empty/default fields.
    if (out.currentRank && out.globalRank && out.currentRank === out.globalRank) delete out.currentRank;
    return cleanExportObject(out);
  }

  function compactStateForExport() {
    normalizeAllCharacterImageGalleries?.();
    syncGroupsFromCharacters?.();
    recalcStats?.();

    const state = app.state || {};
    const compact = {
      haremName: state.haremName || undefined,
      totalValue: Number(state.totalValue || 0) || undefined,
      counts: state.counts && Object.keys(state.counts).length ? state.counts : undefined,
      characters: Array.isArray(state.characters) ? state.characters.map(compactCharacterForExport) : [],
      groups: state.groups && Object.keys(state.groups).length ? state.groups : undefined,
      exportAliasesText: state.exportAliasesText || undefined
    };

    // Omit heavy/derived order maps from JSON export; they are rebuilt from characters.
    return cleanExportObject(compact);
  }

  function createCompactExportPayload() {
    return cleanExportObject({
      input: '',
      state: compactStateForExport(),
      meta: cleanExportObject({
        ...app.meta,
        rebuildVersion: 'v1',
        compactExport: true,
        exportedAt: new Date().toISOString()
      })
    });
  }

  function stringifyExportState(state) {
    return JSON.stringify(state);
  }

  function normalizeAllCharacterImageGalleries() {
    app.state.characters.forEach(normalizeCharacterImageGallery);
  }

  // v2.436: when a parsed character has an image URL, it is the main image.
  function forceParsedImageAsMain(character) {
    if (!character) return character;

    const image = str(
      character.imageUrl ||
      character.image ||
      (Array.isArray(character.mudaeImages) ? character.mudaeImages.find(Boolean) : '') ||
      ''
    ).trim();

    if (!image || !hasRealImage(image)) return character;

    character.image = image;
    character.imageUrl = image;
    character.mudaeImages = dedupeCharacterImageUrls([...(character.mudaeImages || []), image]);
    syncMudaeGalleryFlags(character);

    return normalizeCharacterImageGalleryPreserveOrder(character, { appendMissingMain: true });
  }


  // v2.440: one-shot scroll/highlight to a newly added character.
  function scrollToNewCharacterOnce(id, options = {}) {
    if (!id || window.MHPAutoScrollGuard?.isCancelled?.()) return false;

    window.MHPAutoScrollGuard?.mark?.(900);

    requestAnimationFrame(() => {
      if (window.MHPAutoScrollGuard?.isCancelled?.()) return;

      const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : String(id).replace(/"/g, '\\"');
      const node = els.board?.querySelector?.(`[data-id="${safeId}"]`);
      if (!node) return;

      node.scrollIntoView({
        behavior: options.behavior || 'smooth',
        block: options.block || 'center',
        inline: 'nearest'
      });

      node.classList.add('mhp-new-character-scroll-target');
      setTimeout(() => node.classList.remove('mhp-new-character-scroll-target'), 1200);

      // Release auto-follow shortly after the first movement. Late restore calls
      // after this point are blocked if the user starts scrolling manually.
      setTimeout(() => {
        if (window.MHPAutoScrollGuard?.isActive?.()) {
          window.MHPAutoScrollGuard.cancel();
        }
      }, 950);
    });

    return true;
  }

  function addOrUpdateParsedCharacters(parsed) {
    const existingMap = getExistingCharacterMapByStableKey();
    const batchSeen = new Set();

    const added = [];
    const updated = [];
    const duplicates = [];

    parsed.forEach(ch => {
      forceParsedImageAsMain(ch);
      normalizeCharacterImageGallery(ch);
      ensureCharacterIdentity(ch);
      const key = ch.stableKey || makeStableKey(ch.name, ch.series);

      if (batchSeen.has(key)) {
        duplicates.push(ch);
        return;
      }
      batchSeen.add(key);

      const existing = existingMap.get(key);
      if (existing) {
        mergeParsedCharacterIntoExisting(existing, ch);
        updated.push(existing);
        return;
      }

      added.push(ch);
      existingMap.set(key, ch);
    });

    return { added, updated, duplicates };
  }

  function getExistingCharacterKeySet() {
    const keys = new Set();

    app.state.characters.forEach(item => {
      if (isDivider(item)) return;
      ensureCharacterIdentity(item);
      keys.add(item.stableKey || makeStableKey(item.name, item.series));
    });

    return keys;
  }

  function dedupeParsedCharacters(parsed) {
    const existing = getExistingCharacterKeySet();
    const seenInBatch = new Set();

    const added = [];
    const duplicates = [];

    parsed.forEach(ch => {
      ensureCharacterIdentity(ch);
      const key = ch.stableKey || makeStableKey(ch.name, ch.series);

      if (existing.has(key) || seenInBatch.has(key)) {
        duplicates.push(ch);
        return;
      }

      seenInBatch.add(key);
      added.push(ch);
    });

    return { added, duplicates };
  }
  function getParserApplyFocusTarget(items) {
    const list = Array.isArray(items) ? items.filter(item => item?.id) : [];
    if (!list.length) return null;

    // Prefer the first real character in the pasted block, but keep the first
    // divider as a safe fallback. Small test lists often contain dividers first;
    // focusing a missing/filtered target made the final jump silently do nothing.
    const firstCharacter = list.find(item => !isDivider(item));
    const firstAny = list[0];
    const target = firstCharacter || firstAny;

    return target?.id ? {
      id: target.id,
      name: target.name || target.title || 'new entry',
      count: list.filter(item => !isDivider(item)).length || list.length,
      createdAt: Date.now(),
      focused: false
    } : null;
  }

  function prepareParserApplyFocus(items) {
    const target = getParserApplyFocusTarget(items);
    if (!target?.id) return false;

    // The parser focus target is prepared for both append and replace.
    // The actual movement happens behind the Parsing overlay.
    app.parserApplyFinalFocus = target;

    // Parsing appends/replaces the real state. If a search/type filter is active,
    // the new entries may not be visible, so reset visual filters before focus.
    // This is intentionally not the normal clear-search path because that path
    // may restore a previous search origin.
    if (typeof setUnifiedSearchValue === 'function') {
      setUnifiedSearchValue('', { captureMoveOrigin: false });
    }

    clearSearchMoveOrigin?.();
    clearSearchTypingNoJumpGuard?.();

    app.filter.type = 'all';
    if (els.filterTypeSelect) els.filterTypeSelect.value = 'all';

    return true;
  }

  function jumpToFirstParsedAddedCharacter(addedCharacters) {
    return prepareParserApplyFocus(addedCharacters);
  }
  function createParserNewsDivider(count = 0) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    return normalizeItem({
      id: `divider-news-${Date.now()}-${Math.random().toString(16).slice(2)}`, // safe local id; do not call missing makeId()
      type: 'divider',
      title: 'News',
      level: 1,
      color: '#f59e0b',
      note: count > 0 ? `Added by parser · ${count} new · ${hh}:${mm}` : `Added by parser · ${hh}:${mm}`,
      collapsed: false,
      parserNews: true,
      temporary: true
    }, app.state.characters.length);
  }

  function hasDividerAfterIndex(startIndex) {
    if (startIndex < 0) return true;
    for (let i = startIndex + 1; i < app.state.characters.length; i++) {
      if (isDivider(app.state.characters[i])) return true;
    }
    return false;
  }

  function findReusableParserNewsDividerIndex() {
    let lastNewsIndex = -1;

    for (let i = app.state.characters.length - 1; i >= 0; i--) {
      const item = app.state.characters[i];
      if (!isDivider(item)) continue;

      const title = String(item.title || item.name || '').trim().toLowerCase();
      if (item.parserNews === true || title === 'news') {
        lastNewsIndex = i;
        break;
      }
    }

    if (lastNewsIndex < 0) return -1;

    // Reuse an existing News divider only if it is already the last section.
    // If the user placed another divider after it, create a fresh News section
    // instead of moving unrelated sections around.
    return hasDividerAfterIndex(lastNewsIndex) ? -1 : lastNewsIndex;
  }

  function appendAddedCharactersToNewsSection(addedCharacters) {
    const characters = Array.isArray(addedCharacters)
      ? addedCharacters.filter(item => item && !isDivider(item))
      : [];

    if (!characters.length) return { entries: [], divider: null, inserted: false };

    let newsIndex = findReusableParserNewsDividerIndex();
    let divider = newsIndex >= 0 ? app.state.characters[newsIndex] : null;
    let inserted = false;

    if (!divider) {
      divider = createParserNewsDivider(characters.length);
      app.state.characters.push(divider);
      newsIndex = app.state.characters.length - 1;
      inserted = true;
    } else {
      divider.parserNews = true;
      divider.temporary = divider.temporary !== false;
      divider.title = divider.title || 'News';
      divider.color = divider.color || '#f59e0b';
      const previous = Number(divider.parserNewsTotal || 0) || 0;
      divider.parserNewsTotal = previous + characters.length;
      divider.note = `Added by parser · ${divider.parserNewsTotal} total`;
    }

    app.state.characters.push(...characters);

    // Focusing the News divider is more reliable than trying to focus a specific
    // newly-added card before the virtual board has mounted that local window.
    return { entries: [divider, ...characters], divider, inserted };
  }

  function prepareParserNewsSectionFocus(newsSection) {
    const divider = newsSection?.divider;
    const entries = Array.isArray(newsSection?.entries) ? newsSection.entries : [];
    const firstCharacter = entries.find(item => item && !isDivider(item));
    const count = Math.max(0, entries.filter(item => item && !isDivider(item)).length);

    if (!divider?.id && !firstCharacter?.id) return false;

    // After adding new parser entries, the expected destination is the News
    // divider itself, not the first new card. Focusing the divider keeps the
    // user at the beginning of the new section and avoids landing mid-section
    // when the board is virtualized or when Glass renders the full board.
    const focusTarget = divider?.id ? divider : firstCharacter;

    app.parserApplyFinalFocus = {
      id: focusTarget?.id,
      name: divider?.title || divider?.name || 'News',
      count: count || entries.length || 1,
      createdAt: Date.now(),
      focused: false,
      parserNews: true,
      newsDividerId: divider?.id || null,
      highlightId: divider?.id || firstCharacter?.id || focusTarget?.id
    };

    if (typeof setUnifiedSearchValue === 'function') {
      setUnifiedSearchValue('', { captureMoveOrigin: false });
    }

    clearSearchMoveOrigin?.();
    clearSearchTypingNoJumpGuard?.();

    app.filter.type = 'all';
    if (els.filterTypeSelect) els.filterTypeSelect.value = 'all';
    return true;
  }



  function collapseParserPanelForApply(reason = 'parser-apply') {
    const details = els.parserDetails || document.getElementById('parserDetails');
    if (!details || !details.open) return false;

    try {
      details.open = false;
      details.setAttribute('data-collapsed-by-parser', reason);
      // Give layout a short optimization pulse, but keep the real jump hidden by
      // the Parsing overlay.
      if (typeof pulseParserToggleOptimization === 'function') {
        pulseParserToggleOptimization('close');
      }
    } catch (_) {}

    return true;
  }

  function beginParserApplyOptimization(mode = 'append') {
    app.parserApplying = true;
    app.parserApplyOverlayActive = true;
    document.documentElement.classList.add('mhp-parser-applying');
    document.body?.classList?.add?.('mhp-parser-applying');

    // Parser apply starts from a real click/pointerdown. Allow the covered,
    // programmatic parser jump through the anti-scroll guard.
    try { window.MHPAutoScrollGuard?.mark?.(3200, { force: true }); } catch (_) {}

    // Show a short, explicit overlay so the unavoidable board rebuild + jump to
    // the inserted characters happens behind a stable "Parsing harem..." screen
    // instead of as a visible, abrupt scroll.
    showAppLoading?.('Parsing harem...', mode === 'replace'
      ? 'Replacing characters and stabilizing the board.'
      : 'Adding characters and stabilizing the board.');
    try { updateSharedLoader({ title: 'Parsing harem...', detail: mode === 'replace' ? 'Replacing characters and stabilizing the board.' : 'Adding characters and stabilizing the board.', bytes: (els.parserInput?.value || '').length, parser: true }); } catch (_) {}

    try {
      window.MudaeMinimalImageLoader?.cancelForceLoad?.();
      window.MudaeMinimalImageLoader?.suspend?.();
      window.MudaeGifControl?.pauseAll?.();
      window.MudaeFloatingBar?.syncVisibility?.({ reason: `parser-apply-${mode}-start` });
    } catch (_) {}
  }

  function getDocumentMaxScrollTop() {
    const root = document.documentElement;
    const body = document.body;
    const viewportHeight = window.innerHeight || root?.clientHeight || 800;
    return Math.max(
      0,
      (root?.scrollHeight || 0) - viewportHeight,
      (body?.scrollHeight || 0) - viewportHeight
    );
  }

  function focusParserApplyTargetDirect(target, options = {}) {
    if (!target?.id) return false;

    const highlight = options.highlight !== false;
    const safeId = getCssSafeId(target.id);
    const selector = `[data-id="${safeId}"]`;

    const getParserFocusTopOffset = () => {
      const fixedCandidates = [
        document.querySelector('.topbar'),
        document.querySelector('.app-topbar'),
        document.querySelector('header'),
        document.getElementById('floatingBar')
      ];

      let top = 18;
      fixedCandidates.forEach(node => {
        if (!node) return;
        const style = getComputedStyle(node);
        if (style.position !== 'fixed' && style.position !== 'sticky') return;
        const rect = node.getBoundingClientRect();
        if (rect.height > 0 && rect.top <= 120) top = Math.max(top, Math.round(rect.bottom) + 12);
      });

      return Math.min(180, Math.max(72, top));
    };

    const scrollNode = (node, block = 'start') => {
      if (!node) return false;

      try { window.MHPAutoScrollGuard?.mark?.(2200, { force: true }); } catch (_) {}

      try {
        const rect = node.getBoundingClientRect();
        const current = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const viewport = window.innerHeight || document.documentElement.clientHeight || 800;
        const offset = block === 'center'
          ? Math.max(0, (viewport - rect.height) / 2)
          : getParserFocusTopOffset();
        const rawDesired = Math.max(0, current + rect.top - offset);


        const maxScroll = getDocumentMaxScrollTop();
        const desired = Math.max(0, Math.min(maxScroll, rawDesired));

        window.scrollTo({ top: desired, behavior: 'auto' });
      } catch (_) {
        try { node.scrollIntoView?.({ behavior: 'auto', block, inline: 'nearest' }); } catch (_) {
          try { node.scrollIntoView?.(); } catch (_) {}
        }
      }

      if (highlight) {
        node.classList?.add?.('highlight-jump', 'highlight-jump-strong');
        setTimeout(() => node.classList?.remove?.('highlight-jump', 'highlight-jump-strong'), 1800);
      }

      return true;
    };

    try {
      window.MudaeBoardController?.updateEntriesFromApp?.();

      // Render the target row first. This is cheap and makes small parser
      // batches reliable when the target row was not part of the current virtual
      // board window yet.
      try {
        window.MudaeBoardController?.renderAroundId?.(target.id, {
          scroll: false,
          allowNavigation: false,
          highlight: false,
          source: `${options.reason || 'parser-apply-focus'}-prewarm`
        });
      } catch (_) {}

      // Parser jumps should be deterministic and covered by the overlay.
      // After prewarming the row, use the real DOM node directly and place it
      // near the top of the viewport.
      const directCard = document.querySelector(selector);
      if (directCard && scrollNode(directCard, 'start')) {
        target.focused = true;
        return true;
      }

      const focused = window.MudaeBoardController?.focusCharacterById?.(target.id, {
        behavior: 'auto',
        block: 'start',
        attempts: options.attempts ?? 10,
        delay: options.delay ?? 35,
        settleFrames: options.settleFrames ?? 2,
        correctionThreshold: options.correctionThreshold ?? 96,
        highlight,
        source: options.reason || 'parser-apply-focus'
      });

      if (!focused) {
        const card = document.querySelector(selector);
        if (card && scrollNode(card, 'start')) {
          target.focused = true;
          return true;
        }
      }

      target.focused = true;
      return !!focused;
    } catch (_) {
      return false;
    }
  }

  function settleParserApplyFocus(reason = 'parser-apply-settle', options = {}) {
    const target = app.parserApplyFinalFocus;
    if (!target?.id) return false;

    // Ignore stale targets from a previous parser run.
    if (target.createdAt && Date.now() - target.createdAt > 8000) {
      app.parserApplyFinalFocus = null;
      return false;
    }

    return focusParserApplyTargetDirect(target, { ...options, reason });
  }

  function clearParserApplyFocusTimers() {
    if (!app.parserApplyFocusTimers) return;
    app.parserApplyFocusTimers.forEach(timer => clearTimeout(timer));
    app.parserApplyFocusTimers = [];
  }

  function highlightParserAppliedCharacter(id) {
    if (!id) return false;
    try {
      const selector = `[data-id="${getCssSafeId(id)}"]`;
      const node = document.querySelector(selector);
      if (!node) return false;

      node.classList.remove('highlight-jump', 'highlight-jump-strong', 'parser-apply-highlight');
      // Force a style flush so repeated parses on the same card restart the animation.
      void node.offsetWidth;
      node.classList.add('highlight-jump', 'highlight-jump-strong', 'parser-apply-highlight');
      setTimeout(() => node.classList.remove('highlight-jump', 'highlight-jump-strong', 'parser-apply-highlight'), 2200);
      return true;
    } catch (_) {
      return false;
    }
  }

  function finishParserApplyOptimization(reason = 'done') {
    app.parserApplying = false;

    if (app.parserApplyFinishTimer) clearTimeout(app.parserApplyFinishTimer);
    clearParserApplyFocusTimers();

    // Keep the overlay visible while the board/image loader/GIF refresh settle.
    // The only scroll correction happens behind the overlay, then we release it.
    app.parserApplyFinishTimer = setTimeout(() => {
      app.parserApplyFinishTimer = 0;

      try {
        window.MudaeMinimalImageLoader?.clearStale?.();
        window.MudaeMinimalImageLoader?.resume?.(els.board || document);
        window.MudaeMinimalImageLoader?.forceLoadVisible?.(els.board || document);
        window.MudaeGifControl?.refresh?.();
        window.MudaeBoardController?.schedule?.(true);
      } catch (_) {}

      const target = app.parserApplyFinalFocus;
      const more = target?.parserNews
        ? (target?.count ? ` · ${target.count} new` : '')
        : (target?.count > 1 ? ` + ${target.count - 1} more new` : '');

      app.parserApplyFocusTimers = [
        // Position the board while the overlay is still visible. Do not mark the
        // card yet; otherwise the highlight expires behind the overlay and the
        // user cannot tell when parsing finished.
        setTimeout(() => settleParserApplyFocus(`parser-apply-${reason}-covered-focus`, {
          highlight: false,
          attempts: 10,
          delay: 35,
          correctionThreshold: 120
        }), 140),
        setTimeout(() => settleParserApplyFocus(`parser-apply-${reason}-covered-final`, {
          highlight: false,
          attempts: 5,
          delay: 30,
          correctionThreshold: 90
        }), 420),
        setTimeout(() => {
          clearParserApplyFocusTimers();
          document.documentElement.classList.remove('mhp-parser-applying');
          document.body?.classList?.remove?.('mhp-parser-applying');
          app.parserApplyOverlayActive = false;

          const finalTarget = app.parserApplyFinalFocus;
          // Important: clear the target before the overlay disappears so no late
          // timer can keep snapping the viewport and block the user's scroll.
          app.parserApplyFinalFocus = null;

          hideAppLoading?.();
          window.MudaeFloatingBar?.syncVisibility?.({ reason: `parser-apply-${reason}-end` });

          if (finalTarget?.id) {
            requestAnimationFrame(() => {
              highlightParserAppliedCharacter(finalTarget.highlightId || finalTarget.id);
              notifyAppMessage?.(`Jumped to ${finalTarget.name || 'new character'}${more}.`);
            });
          }
        }, 820)
      ];
    }, 90);
  }

  function clearParserInputAfterSuccessfulParse() {
    if (!els.parserInput) return;
    els.parserInput.value = '';
    updateParserCounter();
  }

  async function renderAfterParserApply(source = 'parser-apply') {
    if (typeof renderAllCooperative === 'function') {
      await renderAllCooperative({ beforePaint: false, source });
    } else {
      renderAll();
      await nextFrame?.();
    }
  }

  async function applyParsedCharacters(mode) {
    if (app.parserApplying) {
      setParserStatus('Parser is already applying changes.');
      return;
    }

    const normalizedInput = normalizeParserInputValue({ updateField: true });
    const text = normalizedInput.text.trim();
    if (!text) {
      setParserStatus('Nothing to parse.');
      return;
    }

    beginParserApplyOptimization(mode);

    try {
      const sphereLike = looksLikeSphereDump(text);
      const characterLike = hasRealCharacterEntries(text);

      let sphereSummary = '';
      let sphereResult = null;

      // Unified parse:
      // - If the input contains sphere data, always apply it.
      // - If the input is sphere-only, stop after spheres.
      if (sphereLike) {
        sphereResult = applySphereParse(text);
        sphereSummary = sphereResult
          ? ` Spheres updated: ${sphereResult.updated || 0}. Missing sphere names: ${sphereResult.missing || 0}.`
          : '';

        if (!characterLike) {
          clearParserInputAfterSuccessfulParse();
          return;
        }
      }

      const textForCharacters = sphereLike ? stripSphereOnlyLines(text) : text;
      const result = parseMudaeText(textForCharacters);

      // Defensive filter: sphere lines should never become character cards.
      result.parsed = result.parsed.filter(ch => {
        const raw = str(ch.rawText || '');
        if (isSphereEntryLine(raw)) return false;
        return !(looksLikeSphereDump(raw) && !looksLikeCharacterDump(raw));
      });

      updateSharedLoader({ title: 'Parsing harem...', detail: 'Parsing pasted characters...', loaded: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, total: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, bytes: text.length, parser: true });

      if (!result.parsed.length) {
        if (sphereLike) {
          // applySphereParse already set a useful status.
          return;
        }
        setParserStatus('No characters detected.');
        return;
      }

      result.parsed.forEach(ch => {
        forceParsedImageAsMain(ch);
        normalizeCharacterImageGallery(ch);
        ensureCharacterIdentity(ch);
      });

      if (mode === 'replace') {
        const ok = await showAppConfirm(
          'Replace the entire board with parsed characters?\n\nThis is destructive. Use "Parse" for the safe default.',
          {
            title: 'Replace board?',
            okText: 'Replace board',
            cancelText: 'Cancel',
            variant: 'danger'
          }
        );

        if (!ok) {
          setParserStatus('Replace cancelled. Nothing changed.');
          return;
        }

        app.originalInput = '';
        app.state.characters = result.parsed;
        prepareParserApplyFocus(result.parsed);
        collapseParserPanelForApply('replace-success');
        renumberCharacters();
        saveLocal();
        updateSharedLoader({ title: 'Parsing harem...', detail: 'Rendering replaced board...', loaded: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, total: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, bytes: text.length, parser: true });
        await renderAfterParserApply('parser-replace');
        clearParserInputAfterSuccessfulParse();

        // If replacing with a mixed dump, re-apply spheres after the new list exists.
        if (sphereLike) {
          sphereResult = applySphereParse(text);
          sphereSummary = sphereResult
            ? ` Spheres updated: ${sphereResult.updated || 0}. Missing sphere names: ${sphereResult.missing || 0}.`
            : '';
        }

        setParserStatus(`Replaced board with ${result.parsed.filter(item => !isDivider(item)).length || result.parsed.length} character(s). Skipped ${result.skipped.length}.${sphereSummary}`);
        return;
      }

      // Safe default: add new characters and update existing ones.
      const changes = addOrUpdateParsedCharacters(result.parsed);

      if (!changes.added.length && !changes.updated.length) {
        setParserStatus(
          `No changes. Duplicates in pasted text: ${changes.duplicates.length}.` +
          sphereSummary
        );
        return;
      }

      // v2.505: do not keep accumulating pasted dumps in memory. The compact
      // export/localStorage schema is state-driven, and retaining parser text
      // made the expanded textarea/layout progressively slower until F5.
      app.originalInput = '';

      const addedCharacters = changes.added.filter(item => !isDivider(item));
      let newsSection = { entries: [], divider: null, inserted: false };

      if (addedCharacters.length) {
        newsSection = appendAddedCharactersToNewsSection(addedCharacters);
      }

      if (newsSection.entries.length) {
        prepareParserNewsSectionFocus(newsSection);
      }

      collapseParserPanelForApply('append-success');
      renumberCharacters();
      saveLocal();
      updateSharedLoader({ title: 'Parsing harem...', detail: 'Rendering new characters...', loaded: addedCharacters.length || result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, total: addedCharacters.length || result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, bytes: text.length, parser: true });
      await renderAfterParserApply('parser-append');
      clearParserInputAfterSuccessfulParse();

      setParserStatus(
        `Added ${addedCharacters.length} new character(s) under News. ` +
        `Updated ${changes.updated.length} existing character(s). ` +
        `Duplicates in paste skipped: ${changes.duplicates.length}. ` +
        `Unparsed blocks: ${result.skipped.length}.` +
        sphereSummary
      );
    } finally {
      finishParserApplyOptimization(mode || 'apply');
    }
  }

  function setParserStatus(text) {
    if (els.parserStatus) els.parserStatus.textContent = text || 'Ready.';
  }


  function countParserCharacterBlocks(rawText) {
    const text = str(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!text.trim()) return 0;

    const lines = text.split('\n');
    let count = 0;
    let inBlock = false;

    for (const line of lines) {
      const trimmed = str(line).trim();
      if (!trimmed || isParserSeparatorLine(line)) {
        inBlock = false;
        continue;
      }

      if (isParserCharacterHeaderLine(line)) {
        count += 1;
        inBlock = true;
        continue;
      }

      // Fallback for rank-first exports that may not include the owner arrow.
      // Keep it conservative so normal series/info lines are not counted.
      if (!inBlock && /^#?[\d.,]+\s*[-–—]\s*\S/.test(trimmed) && /(?:\bka\b|:kakera:|\(\$[wh][ag]\))/i.test(trimmed)) {
        count += 1;
        inBlock = true;
      }
    }

    return count;
  }

  function formatParserCounter(count) {
    return count === 1 ? '1 character' : `${count} characters`;
  }

  function updateParserCounter() {
    if (!els.parserCount || !els.parserInput) return 0;
    const count = countParserCharacterBlocks(els.parserInput.value || '');
    els.parserCount.textContent = formatParserCounter(count);
    els.parserCount.dataset.count = String(count);
    els.parserCount.classList.toggle('has-count', count > 0);
    return count;
  }

  function scheduleParserCounterUpdate() {
    if (app.parserCounterRaf) cancelAnimationFrame(app.parserCounterRaf);
    app.parserCounterRaf = requestAnimationFrame(() => {
      app.parserCounterRaf = 0;
      updateParserCounter();
    });
  }

  function pulseParserToggleOptimization(reason = 'toggle') {
    const root = document.documentElement;
    root.classList.add('mhp-parser-transitioning');
    window.MudaeFloatingBar?.syncVisibility?.({ reason: `parser-${reason}-start` });

    if (app.parserTransitionTimer) clearTimeout(app.parserTransitionTimer);
    app.parserTransitionTimer = setTimeout(() => {
      root.classList.remove('mhp-parser-transitioning');
      window.MudaeFloatingBar?.syncVisibility?.({ reason: `parser-${reason}-end` });
      app.parserTransitionTimer = null;
    }, 360);
  }


  const SEARCH_COMMANDS = [
    { value: 'gender:waifu', label: '♀ gender:waifu', hint: 'Waifu / female characters' },
    { value: 'gender:female', label: '♀ gender:female', hint: 'Alias for waifu' },
    { value: 'gender:husbando', label: '♂ gender:husbando', hint: 'Husbando / male characters' },
    { value: 'gender:male', label: '♂ gender:male', hint: 'Alias for husbando' },
    { value: 'gender:both', label: '⚧ gender:both', hint: 'Both gender characters' }
  ];

  function getSearchInputValue() {
    return els.searchInput?.value || els.floatingSearchInput?.value || app.filter.q || '';
  }

  function getActiveSearchSuggestionToken(value = '') {
    const text = String(value || '');
    const cursor = text.length;
    let quote = false;
    let start = 0;

    for (let i = 0; i < cursor; i++) {
      const ch = text[i];

      if (ch === '"') {
        quote = !quote;
        continue;
      }

      if (ch === ',' && !quote) {
        start = i + 1;
      }
    }

    const rawToken = text.slice(start, cursor);
    const leading = rawToken.match(/^\s*/)?.[0] || '';
    const tokenStart = start + leading.length;
    const token = text.slice(tokenStart, cursor);

    return {
      text,
      start: tokenStart,
      end: cursor,
      token,
      rawToken,
      leading
    };
  }

  function buildSearchSuggestionReplacement(context, replacement) {
    return context.text.slice(0, context.start) + replacement + context.text.slice(context.end);
  }

  function quoteSearchSuggestionValue(value = '') {
    const text = String(value || '').trim().replace(/"/g, '\\"');
    return `"${text}"`;
  }

  function getUniqueSearchSuggestionValues({ source = [], getValue, getHint, query = '', limit = 7 }) {
    const normalizedQuery = normalizeSearchText(query);
    const seen = new Set();
    const matches = [];

    for (const item of source || []) {
      const value = String(getValue?.(item) || '').trim();
      if (!value) continue;

      const normalizedValue = normalizeSearchText(value);
      if (!normalizedValue || seen.has(normalizedValue)) continue;
      if (normalizedQuery && !normalizedValue.includes(normalizedQuery)) continue;

      seen.add(normalizedValue);
      matches.push({
        value,
        hint: String(getHint?.(item) || '').trim(),
        startsWith: normalizedValue.startsWith(normalizedQuery),
        item
      });
    }

    matches.sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      return a.value.localeCompare(b.value, undefined, { sensitivity: 'base' });
    });

    return matches.slice(0, limit);
  }

  function getFieldValueSearchSuggestions(value = '') {
    const context = getActiveSearchSuggestionToken(value);
    const token = String(context.token || '').trim();
    if (!token) return [];

    const fieldMatch = token.match(/^([a-z]+):(.*)$/i);
    if (!fieldMatch) return [];

    let field = fieldMatch[1].toLowerCase();
    if (field === 'dividers') field = 'divider';
    if (field === 'character' || field === 'characters' || field === 'char') field = 'name';
    let rawValue = String(fieldMatch[2] || '').trimStart();
    const isQuoted = rawValue.startsWith('"');
    if (isQuoted) rawValue = rawValue.slice(1);
    if (rawValue.endsWith('"')) rawValue = rawValue.slice(0, -1);

    const query = normalizeSearchText(rawValue);
    const minLength = query.length >= 1 || ['gender'].includes(field);
    if (!minLength) return [];

    if (field === 'name') {
      const typedPrefix = (fieldMatch[1] || '').toLowerCase();
      const preferredPrefix = ['character', 'characters', 'char'].includes(typedPrefix)
        ? 'character'
        : 'character';
      return buildCharacterNameSuggestions(context, query, preferredPrefix);
    }

    if (field === 'series' || field === 'serie') {
      return getUniqueSearchSuggestionValues({
        source: app.state.characters || [],
        query,
        getValue: item => item?.type === 'divider' ? '' : item?.series,
        getHint: () => 'Series filter'
      }).map(match => {
        const replacementToken = `${field}:${quoteSearchSuggestionValue(match.value)}`;
        return {
          value: buildSearchSuggestionReplacement(context, replacementToken),
          label: replacementToken,
          hint: 'Series',
          kind: 'series'
        };
      });
    }

    if (field === 'divider') {
      return getUniqueSearchSuggestionValues({
        source: app.state.characters || [],
        query,
        getValue: item => item?.type === 'divider' ? item?.title : '',
        getHint: item => getDividerCounterKind(item) === 'subdivider' ? 'Sub-divider' : 'Divider'
      }).map(match => {
        const replacementToken = `divider:${quoteSearchSuggestionValue(match.value)}`;
        return {
          value: buildSearchSuggestionReplacement(context, replacementToken),
          label: replacementToken,
          hint: match.hint || 'Divider',
          kind: 'divider'
        };
      });
    }

    if (field === 'owner') {
      return getUniqueSearchSuggestionValues({
        source: app.state.characters || [],
        query,
        getValue: item => item?.type === 'divider' ? '' : item?.owner,
        getHint: () => 'Owner filter'
      }).map(match => {
        const replacementToken = `owner:${quoteSearchSuggestionValue(match.value)}`;
        return {
          value: buildSearchSuggestionReplacement(context, replacementToken),
          label: replacementToken,
          hint: 'Owner',
          kind: 'owner'
        };
      });
    }

    return [];
  }

  function buildCharacterNameSuggestions(context, query, mode = 'quote') {
    const matches = getUniqueSearchSuggestionValues({
      source: app.state.characters || [],
      query,
      getValue: item => item?.type === 'divider' ? '' : item?.name,
      getHint: item => item?.series || 'Character name'
    });

    return matches.map(match => {
      const quotedName = quoteSearchSuggestionValue(match.value);
      const replacementToken = mode === 'name'
        ? `name:${quotedName}`
        : mode === 'character'
          ? `character:${quotedName}`
          : quotedName;

      const image = hasRealImage(match.item?.image) ? String(match.item.image) : '';

      return {
        value: buildSearchSuggestionReplacement(context, replacementToken),
        label: match.value,
        hint: match.hint || 'Character name',
        kind: 'character',
        image
      };
    });
  }

  function getCharacterNameSearchSuggestions(value = '') {
    const context = getActiveSearchSuggestionToken(value);
    const token = String(context.token || '').trim();
    if (!token) return [];

    // Rule: plain quoted search is reserved for character names.
    // Example: "catu -> "Catulus"
    if (!token.startsWith('"')) return [];

    let rawValue = token.slice(1);
    if (rawValue.endsWith('"')) rawValue = rawValue.slice(0, -1);

    const query = normalizeSearchText(rawValue);
    if (!query) return [];

    return buildCharacterNameSuggestions(context, query, 'character');
  }

  function getSearchCommandSuggestions(value = '') {
    const context = getActiveSearchSuggestionToken(value);
    const token = String(context.token || '').trim();
    const raw = normalizeSearchText(token);
    if (!raw) return [];

    const commandPrefixes = [
      { value: 'character:"', label: 'character:""', hint: 'Jump/filter by character name' },
      { value: 'characters:"', label: 'characters:""', hint: 'Alias of character:' },
      { value: 'series:', label: 'series:', hint: 'Filter by series' },
      { value: 'divider:', label: 'divider:', hint: 'Filter by divider/sub-divider' },
      { value: 'dividers:', label: 'dividers:', hint: 'Alias of divider:' },
      { value: 'gender:', label: 'gender:', hint: 'Filter by gender' },
      { value: 'owner:', label: 'owner:', hint: 'Filter by owner' },
      { value: 'name:', label: 'name:', hint: 'Alias of character:' },
      { value: 'note:', label: 'note:', hint: 'Filter by notes' }
    ];

    const genderValues = [
      { value: 'gender:waifu', label: 'gender:waifu', hint: 'Waifu / female characters' },
      { value: 'gender:female', label: 'gender:female', hint: 'Alias of waifu' },
      { value: 'gender:husbando', label: 'gender:husbando', hint: 'Husbando / male characters' },
      { value: 'gender:male', label: 'gender:male', hint: 'Alias of husbando' },
      { value: 'gender:both', label: 'gender:both', hint: 'Both gender type' }
    ];

    if (raw.startsWith('gender:')) {
      if (raw === 'gender:') {
        return genderValues.map(item => ({
          ...item,
          value: buildSearchSuggestionReplacement(context, item.value)
        }));
      }

      return genderValues
        .filter(command => command.value.startsWith(raw))
        .map(item => ({
          ...item,
          value: buildSearchSuggestionReplacement(context, item.value)
        }));
    }

    const fieldSuggestions = getFieldValueSearchSuggestions(value);
    if (fieldSuggestions.length) return fieldSuggestions;

    if (raw === '"') {
      return [{
        value: buildSearchSuggestionReplacement(context, 'character:"'),
        label: 'character:""',
        hint: 'Character exact search',
        kind: 'command'
      }];
    }

    const characterSuggestions = getCharacterNameSearchSuggestions(value);
    if (characterSuggestions.length) return characterSuggestions;

    // Only suggest command prefixes for unfielded tokens. Normal text search should
    // stay free-form; character suggestions are intentionally tied to quotes/name:.
    if (!token.includes(':') && !token.startsWith('"')) {
      return commandPrefixes
        .filter(command => normalizeSearchText(command.value).startsWith(raw) || normalizeSearchText(command.label).includes(raw))
        .slice(0, 7)
        .map(command => ({
          ...command,
          value: buildSearchSuggestionReplacement(context, command.value)
        }));
    }

    return [];
  }

  function isIncompleteSearchCommand(value = '') {
    const context = getActiveSearchSuggestionToken(value);
    const raw = normalizeSearchText(context.token || '');

    return raw === '"' ||
      raw === 's' ||
      raw === 'se' ||
      raw === 'ser' ||
      raw === 'seri' ||
      raw === 'serie' ||
      raw === 'series' ||
      raw === 'series:' ||
      raw === 'd' ||
      raw === 'di' ||
      raw === 'div' ||
      raw === 'divi' ||
      raw === 'divid' ||
      raw === 'divide' ||
      raw === 'divider' ||
      raw === 'divider:' ||
      raw === 'dividers' ||
      raw === 'dividers:' ||
      raw === 'g' ||
      raw === 'ge' ||
      raw === 'gen' ||
      raw === 'gend' ||
      raw === 'gende' ||
      raw === 'gender' ||
      raw === 'gender:' ||
      raw === 'n' ||
      raw === 'na' ||
      raw === 'nam' ||
      raw === 'name' ||
      raw === 'name:' ||
      raw === 'c' ||
      raw === 'ch' ||
      raw === 'cha' ||
      raw === 'char' ||
      raw === 'chara' ||
      raw === 'charac' ||
      raw === 'charact' ||
      raw === 'characte' ||
      raw === 'character' ||
      raw === 'character:' ||
      raw === 'characters' ||
      raw === 'characters:' ||
      raw === 'o' ||
      raw === 'ow' ||
      raw === 'own' ||
      raw === 'owne' ||
      raw === 'owner' ||
      raw === 'owner:' ||
      raw === 'note' ||
      raw === 'note:';
  }



  function ensureSearchSuggestBox() {
    let box = document.getElementById('searchSuggestBox');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'searchSuggestBox';
    box.className = 'search-suggest-box';
    box.hidden = true;
    document.body.appendChild(box);
    return box;
  }

  function getActiveSearchInputElement() {
    const active = document.activeElement;
    if (active === els.searchInput || active === els.floatingSearchInput) return active;
    return els.searchInput;
  }

  function isElementVisibleForSearchFocus(el) {
    if (!el || el.disabled || el.hidden) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;

    const rect = el.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8
      && rect.bottom > 0
      && rect.top < window.innerHeight;
  }

  function getShortcutSearchTarget() {
    const main = els.searchInput || document.getElementById('searchInput');
    const floating = els.floatingSearchInput || document.getElementById('floatingSearchInput');

    // v2.615:
    // Do not hijack the real top search when it is already visible. The floating
    // search is a convenience for deep scroll positions, not the owner of every
    // search focus/suggestion action.
    if (isElementVisibleForSearchFocus(main)) {
      return { input: main, shouldScrollToTopSearch: false };
    }

    if (isElementVisibleForSearchFocus(floating)) {
      return { input: floating, shouldScrollToTopSearch: false };
    }

    if (main) return { input: main, shouldScrollToTopSearch: true };

    return { input: floating, shouldScrollToTopSearch: false };
  }

  function openAndFocusSearchFromShortcut() {
    const target = getShortcutSearchTarget();
    const input = target.input;
    if (!input) return false;

    const keepY = window.scrollY || document.documentElement.scrollTop || 0;

    try {
      clearVirtualBoardAnchorsForSearch('ctrl-f-shortcut');
    } catch {}

    hideSearchSuggestions({ force: true });
    document.body.classList.add('search-shortcut-active');

    const focusInput = () => {
      input.focus({ preventScroll: true });
      input.select?.();
      showSearchSuggestions(input);
    };

    if (target.shouldScrollToTopSearch) {
      // If floating/multibar search is not visible, the intended search is the
      // top one. Bring it into view on purpose, then focus it.
      window.scrollTo({ top: 0, behavior: 'auto' });
      requestAnimationFrame(focusInput);
    } else {
      // Floating search is visible: do not move the board.
      focusInput();
      requestAnimationFrame(() => window.scrollTo({ top: keepY, behavior: 'auto' }));
    }

    setTimeout(() => {
      document.body.classList.remove('search-shortcut-active');
    }, 1200);

    return true;
  }

  function installSearchShortcutCapture() {
    if (app.searchShortcutCaptureInstalled) return;
    app.searchShortcutCaptureInstalled = true;

    document.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') return;

      const ok = openAndFocusSearchFromShortcut();
      if (!ok) return;

      event.preventDefault();
      event.stopPropagation();
    }, true);
  }


  function positionSearchSuggestBox(input) {
    const box = ensureSearchSuggestBox();
    if (!input || box.hidden) return;

    const floatingInput = els.floatingSearchInput || document.getElementById('floatingSearchInput');
    const active = document.activeElement;

    // v2.615:
    // Anchor suggestions to the input that explicitly requested them. The only
    // time the floating input may take ownership is while it is the focused input
    // or while its own mirrored dispatch is being processed. A top-search focus
    // must never be redirected to the floating bar.
    if (floatingInput
      && input !== els.searchInput
      && isElementVisibleForSearchFocus(floatingInput)
      && (active === floatingInput || window.__mhpFloatingSearchSyncingInput)) {
      input = floatingInput;
    }

    const rect = input.getBoundingClientRect();
    const margin = 10;
    const gap = 8;
    const isFloatingSearch = !!(floatingInput && input === floatingInput);
    const availableBelow = Math.max(0, window.innerHeight - rect.bottom - gap - margin);
    const availableAbove = Math.max(0, rect.top - gap - margin);
    const cap = isFloatingSearch ? 220 : 360;
    const rawNaturalHeight = box.scrollHeight || box.offsetHeight || 0;
    const naturalHeight = Math.max(isFloatingSearch ? 44 : 96, Math.min(rawNaturalHeight || cap, cap));

    let width = Math.max(isFloatingSearch ? 260 : 280, Math.min(rect.width, window.innerWidth - margin * 2));
    if (isFloatingSearch) width = Math.min(width, 560);

    let left = isFloatingSearch ? rect.left + (rect.width - width) / 2 : rect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    let top;
    let maxHeight;
    let opensAbove = false;

    if (isFloatingSearch) {
      // Floating search should open upward by default so it does not cover the
      // text being typed. If there is not enough space above, it opens below;
      // it must never be clamped over the input.
      const canOpenAbove = availableAbove >= 44;
      if (canOpenAbove) {
        opensAbove = true;
        maxHeight = Math.max(44, Math.min(cap, naturalHeight, availableAbove));
        top = rect.top - gap - maxHeight;
      } else {
        opensAbove = false;
        maxHeight = Math.max(44, Math.min(cap, naturalHeight, availableBelow || cap));
        top = rect.bottom + gap;
      }
    } else if (availableBelow >= Math.min(120, naturalHeight) || availableBelow >= availableAbove) {
      maxHeight = Math.max(96, Math.min(cap, naturalHeight, availableBelow || cap));
      top = rect.bottom + gap;
    } else {
      opensAbove = true;
      maxHeight = Math.max(96, Math.min(cap, naturalHeight, availableAbove || cap));
      top = rect.top - gap - maxHeight;
    }

    if (opensAbove) {
      // Keep the bottom edge above the input. Shrink instead of overlapping.
      const highestAllowedTop = rect.top - gap - Math.max(44, maxHeight);
      if (top > highestAllowedTop) top = highestAllowedTop;
      if (top < margin) {
        maxHeight = Math.max(44, rect.top - gap - margin);
        top = Math.max(margin, rect.top - gap - maxHeight);
        if (maxHeight < 44 && availableBelow >= 44) {
          opensAbove = false;
          maxHeight = Math.max(44, Math.min(cap, naturalHeight, availableBelow));
          top = rect.bottom + gap;
        }
      }
    } else {
      // Keep the top edge below the input. Shrink instead of overlapping.
      top = Math.max(rect.bottom + gap, top);
      maxHeight = Math.max(44, Math.min(maxHeight, window.innerHeight - top - margin));
    }

    box.classList.toggle('is-floating-anchor', !!isFloatingSearch);
    box.classList.toggle('is-floating-above', !!isFloatingSearch && opensAbove);
    box.classList.toggle('is-floating-below', !!isFloatingSearch && !opensAbove);
    box.dataset.anchor = isFloatingSearch ? 'floating' : 'top';
    box.style.bottom = 'auto';
    box.style.transform = 'none';
    box.style.width = `${Math.round(width)}px`;
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
    box.style.maxHeight = `${Math.round(maxHeight)}px`;
  }

  function updateSearchSuggestionActive(index = app.searchSuggestionIndex) {
    const box = document.getElementById('searchSuggestBox');
    if (!box || box.hidden || !app.searchSuggestions.length) return;

    const total = app.searchSuggestions.length;
    app.searchSuggestionIndex = ((index % total) + total) % total;

    box.querySelectorAll('.search-suggest-item').forEach((item, itemIndex) => {
      item.classList.toggle('is-active', itemIndex === app.searchSuggestionIndex);
      item.setAttribute('aria-selected', itemIndex === app.searchSuggestionIndex ? 'true' : 'false');
    });

    const active = box.querySelector('.search-suggest-item.is-active');
    active?.scrollIntoView?.({ block: 'nearest' });
  }

  function moveSearchSuggestion(delta) {
    if (!app.searchSuggestions.length) return false;

    updateSearchSuggestionActive(app.searchSuggestionIndex + delta);
    return true;
  }

  function isSearchSuggestBoxHovered() {
    return !!document.getElementById('searchSuggestBox')?.matches?.(':hover');
  }

  function hideSearchSuggestions(options = {}) {
    const box = document.getElementById('searchSuggestBox');
    const active = document.activeElement;
    const keepWhileFocused = options.force !== true && (active === els.searchInput || active === els.floatingSearchInput || isSearchSuggestBoxHovered());
    if (keepWhileFocused) return;

    if (app.searchSuggestFadeTimer) {
      clearTimeout(app.searchSuggestFadeTimer);
      app.searchSuggestFadeTimer = null;
    }

    app.searchSuggestions = [];
    app.searchSuggestionIndex = 0;

    if (!box || box.hidden) return;

    box.classList.add('is-fading-out');
    box.setAttribute('aria-hidden', 'true');

    if (options.immediate === true) {
      box.hidden = true;
      box.classList.remove('is-fading-out');
      return;
    }

    app.searchSuggestFadeTimer = setTimeout(() => {
      box.hidden = true;
      box.classList.remove('is-fading-out');
      app.searchSuggestFadeTimer = null;
    }, 120);
  }

  function scheduleHideSearchSuggestions(delay = 360) {
    if (app.searchSuggestHideTimer) clearTimeout(app.searchSuggestHideTimer);
    app.searchSuggestHideTimer = setTimeout(() => {
      app.searchSuggestHideTimer = null;
      hideSearchSuggestions();
    }, delay);
  }

  function showSearchSuggestions(input = getActiveSearchInputElement()) {
    const floatingInput = els.floatingSearchInput || document.getElementById('floatingSearchInput');
    if (input === els.searchInput && window.__mhpFloatingSearchSyncingInput && document.activeElement === floatingInput) {
      input = floatingInput;
    }

    if (app.searchSuggestionsSuppressUntilInput) {
      hideSearchSuggestions({ force: true });
      return;
    }

    if (app.searchSuggestHideTimer) {
      clearTimeout(app.searchSuggestHideTimer);
      app.searchSuggestHideTimer = null;
    }

    const suggestions = getSearchCommandSuggestions(input?.value || '');
    const box = ensureSearchSuggestBox();
    if (app.searchSuggestFadeTimer) {
      clearTimeout(app.searchSuggestFadeTimer);
      app.searchSuggestFadeTimer = null;
    }
    box.classList.remove('is-fading-out');
    box.removeAttribute('aria-hidden');

    app.searchSuggestions = suggestions.slice(0, 7);
    app.searchSuggestionIndex = Math.min(app.searchSuggestionIndex || 0, Math.max(0, app.searchSuggestions.length - 1));

    if (!app.searchSuggestions.length || !input) {
      box.hidden = true;
      box.classList.remove('is-fading-out');
      return;
    }

    box.setAttribute('role', 'listbox');
    box.innerHTML = app.searchSuggestions.map((item, index) => {
      const hasThumb = item.kind === 'character' && item.image;
      const thumb = hasThumb
        ? `<img class="search-suggest-thumb" src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
        : `<span class="search-suggest-thumb search-suggest-thumb-empty" aria-hidden="true">${item.kind === 'character' ? '👤' : '⌕'}</span>`;

      return `
        <button class="search-suggest-item ${index === app.searchSuggestionIndex ? 'is-active' : ''} ${hasThumb ? 'has-thumb' : ''}" type="button" role="option" aria-selected="${index === app.searchSuggestionIndex ? 'true' : 'false'}" data-value="${escapeHtml(item.value)}">
          ${thumb}
          <span class="search-suggest-main">
            <span class="search-suggest-label">${escapeHtml(item.label)}</span>
            <em class="search-suggest-hint">${escapeHtml(item.hint)}</em>
          </span>
        </button>
      `;
    }).join('');

    box.hidden = false;
    positionSearchSuggestBox(input);
    updateSearchSuggestionActive(app.searchSuggestionIndex);
  }
  function acceptSearchSuggestion(value = app.searchSuggestions[app.searchSuggestionIndex]?.value || app.searchSuggestions[0]?.value) {
    if (!value) return false;

    // v2.275: accepting with Tab/click should close suggestions and keep them
    // closed until the next real input/focus action. Previously Firefox could
    // leave the suggestion box visible after Tab.
    app.searchSuggestionsSuppressUntilInput = true;

    setUnifiedSearchValue(value);

    if (app.searchTimer) {
      clearTimeout(app.searchTimer);
      app.searchTimer = null;
    }

    hideSearchSuggestions({ force: true });

    const input = getActiveSearchInputElement();
    input?.focus({ preventScroll: true });
    input?.setSelectionRange?.(value.length, value.length);

    if (value === 'gender:') {
      els.board.replaceChildren(createSearchCommandMessage());
      app.searchSuggestionsSuppressUntilInput = false;
      showSearchSuggestions(input);
      return true;
    }

    clearVirtualBoardAnchorsForSearch('accept-search-suggestion');
    els.board.replaceChildren(createSearchRenderLoadingMessage());
    requestAnimationFrame(() => {
      hideSearchSuggestions({ force: true });
      renderBoard();
    });

    return true;
  }
  function isSearchNavigationQuery(query = getActiveSearchQuery()) {
    const parsed = parseSearchTokens(query)
      .map(parseSearchTerm)
      .filter(item => item.value);

    if (!parsed.length) return false;

    if (parsed.length !== 1) return false;

    const only = parsed[0];

    // Exact character searches are navigable.
    if (only.field === 'name' && only.exact) return true;

    // Series/divider exact field searches should jump to the first matching result.
    if (['series', 'serie', 'divider'].includes(only.field) && only.value) return true;

    // Other field filters are persistent filters, not a jump-to-first-result query.
    if (only.field) return false;

    return true;
  }



  function handleSearchKeydown(event) {
    markUserViewInteraction('search-keydown');
    if (!['Tab', 'Enter', 'ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) {
      app.searchSuggestionsSuppressUntilInput = false;
    }

    if (event.key === ' ') {
      event.stopPropagation();
    }

    const input = event.currentTarget;
    const suggestions = getSearchCommandSuggestions(input.value);

    if (suggestions.length && !app.searchSuggestions.length) {
      app.searchSuggestions = suggestions.slice(0, 7);
    }

    if (event.key === 'ArrowDown') {
      if (suggestions.length) {
        event.preventDefault();
        if (document.getElementById('searchSuggestBox')?.hidden) {
          showSearchSuggestions(input);
        } else {
          moveSearchSuggestion(1);
        }
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      if (suggestions.length) {
        event.preventDefault();
        if (document.getElementById('searchSuggestBox')?.hidden) {
          showSearchSuggestions(input);
        } else {
          moveSearchSuggestion(-1);
        }
      }
      return;
    }

    if (event.key === 'Tab') {
      if (suggestions.length) {
        event.preventDefault();
        acceptSearchSuggestion();
      }
      return;
    }

    if (event.key === 'Enter') {
      if (suggestions.length && (isIncompleteSearchCommand(input.value) || !document.getElementById('searchSuggestBox')?.hidden)) {
        event.preventDefault();
        acceptSearchSuggestion();
        return;
      }

      if ((app.filter.q || input.value.trim()) && !isIncompleteSearchCommand(input.value)) {
        event.preventDefault();

        if (!isSearchNavigationQuery(input.value)) {
          renderBoard();
          return;
        }

        clearVirtualBoardAnchorsForSearch('enter-search-jump');
        window.__mhpExplicitSearchEnterNavigation = true;
        try {
          jumpFloatingSearchResult(input.value, { allowWithoutFloatingFlag: true, focusTarget: input, fromKeyboard: true, forceFirstResult: true });
        } finally {
          setTimeout(() => { window.__mhpExplicitSearchEnterNavigation = false; }, 800);
        }
      }

      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();

      if (app.filter.q || input.value.trim()) {
        clearSearchText({ focusTarget: input });
      } else {
        hideSearchSuggestions({ force: true });
      }
    }
  }




  function bindSearchSuggestionBox() {
    const box = ensureSearchSuggestBox();

    box.addEventListener('mousedown', event => {
      event.preventDefault();

      const item = event.target.closest('.search-suggest-item[data-value]');
      if (!item) return;

      const all = Array.from(box.querySelectorAll('.search-suggest-item'));
      const index = all.indexOf(item);
      if (index >= 0) app.searchSuggestionIndex = index;

      acceptSearchSuggestion(item.dataset.value);
    });

    box.addEventListener('mousemove', event => {
      const item = event.target.closest('.search-suggest-item[data-value]');
      if (!item) return;

      const all = Array.from(box.querySelectorAll('.search-suggest-item'));
      const index = all.indexOf(item);
      if (index >= 0) updateSearchSuggestionActive(index);
    });

    box.addEventListener('mouseenter', () => {
      if (app.searchSuggestHideTimer) {
        clearTimeout(app.searchSuggestHideTimer);
        app.searchSuggestHideTimer = null;
      }
    });

    box.addEventListener('mouseleave', () => scheduleHideSearchSuggestions(420));

    window.addEventListener('resize', () => positionSearchSuggestBox(getActiveSearchInputElement()));
    window.addEventListener('scroll', () => positionSearchSuggestBox(getActiveSearchInputElement()), { passive: true });
  }

  function syncSearchClearButton() {
    if (!els.clearSearchBtn || !els.searchInput) return;
    els.clearSearchBtn.hidden = !els.searchInput.value.trim();
  }

  function cancelSearchNavigationSideEffects() {
    window.__mhpFloatingSearchEnterRequested = false;
    window.MudaeBoardController?.cancelFocus?.();
    document.body.classList.remove('is-board-focusing');
  }

  function applySearchTypingNoJumpGuard() {
    if (!els.board) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const boardRect = els.board.getBoundingClientRect();
    const boardTop = scrollTop + boardRect.top;
    const neededHeight = Math.max(0, (scrollTop - boardTop) + viewportHeight + 220);
    const currentHeight = Math.max(0, els.board.offsetHeight || boardRect.height || 0);
    const lockedHeight = Math.ceil(Math.max(currentHeight, neededHeight));

    if (lockedHeight > 0) {
      els.board.style.minHeight = lockedHeight + 'px';
      els.board.classList.add('search-typing-scroll-guard');
    }
  }

  function clearSearchTypingNoJumpGuard() {
    if (!els.board) return;
    els.board.style.minHeight = '';
    els.board.classList.remove('search-typing-scroll-guard');
  }
  function rememberSearchSessionOrigin() {
    if (app.searchSessionOriginAnchor?.id || Number.isFinite(app.searchSessionOriginScrollY)) {
      return app.searchSessionOriginAnchor || app.searchSessionOriginScrollY;
    }

    app.searchSessionOriginScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    app.searchSessionOriginAnchor = captureBoardVisualAnchor?.() || null;
    app.searchSessionOriginStartedAt = Date.now();
    return app.searchSessionOriginAnchor || app.searchSessionOriginScrollY;
  }

  function clearSearchSessionOrigin() {
    app.searchSessionOriginScrollY = null;
    app.searchSessionOriginAnchor = null;
    app.searchSessionOriginStartedAt = 0;
  }

  function hasSearchSessionOrigin() {
    return !!app.searchSessionOriginAnchor?.id || Number.isFinite(app.searchSessionOriginScrollY);
  }

  function restoreSearchSessionOriginAfterRender() {
    const anchor = app.searchSessionOriginAnchor ? { ...app.searchSessionOriginAnchor } : null;
    const targetY = Number(app.searchSessionOriginScrollY);

    // v2.484:
    // Keep a stable copy of the pre-search origin and restore it aggressively.
    // When the user scrolls inside a filtered board, the filtered scroll position
    // can force the full-board virtualizer to mount the wrong window first. If
    // we only try the anchor once, clearing search can land at the top.
    clearSearchSessionOrigin();

    const hasTargetY = Number.isFinite(targetY);
    const safeY = hasTargetY ? Math.max(0, targetY) : 0;
    const startedAt = Date.now();
    app.suppressViewPositionSaveUntil = Date.now() + 1600;
    app.__mhpRestoringSearchOriginUntil = Date.now() + 1600;

    const restoreByScrollY = () => {
      if (!hasTargetY) return false;
      window.scrollTo({ top: safeY, behavior: 'auto' });
      return true;
    };

    const ensureFullEntries = () => {
      try { window.MudaeBoardController?.updateEntriesFromApp?.(); } catch {}
    };

    const restoreByAnchor = () => {
      if (!anchor?.id) return false;
      ensureFullEntries();
      window.MudaeBoardController?.renderAroundId?.(anchor.id, { scroll: false, highlight: false, forceMs: 1600 });
      return !!restoreBoardVisualAnchor?.(anchor, { attempts: 10, highlight: false });
    };

    const restoreOnce = () => {
      ensureFullEntries();

      // First put the document near the original absolute position. This wakes
      // the board controller with the correct full-board scroll range even if
      // the previous filtered range was much shorter or much farther down.
      restoreByScrollY();

      // Then correct by visual anchor so responsive grids/columns do not leave
      // the user a few rows above or below the exact pre-search spot.
      restoreByAnchor();

      window.MudaeMinimalImageLoader?.releaseVisible?.(els.board);
      window.MudaeGifControl?.refresh?.();
      return true;
    };

    if (!anchor?.id && !hasTargetY) return false;

    restoreOnce();
    requestAnimationFrame(() => {
      restoreOnce();
      requestAnimationFrame(restoreOnce);
    });

    // A few delayed passes are intentional: virtual-window rendering may happen
    // after the full board is rebuilt, especially when clearing after scrolling
    // through a filtered Series:/Name: result.
    [90, 220, 480, 900].forEach(delay => {
      setTimeout(() => {
        if (Date.now() - startedAt > 1800) return;
        restoreOnce();
      }, delay);
    });

    return true;
  }

  function getSearchMoveSession() {
    if (!searchMoveSession) {
      searchMoveSession = window.MudaeSearchMoveSession?.create?.({
        app,
        captureBoardVisualAnchor,
        restoreBoardVisualAnchor,
        updateEntries: () => window.MudaeBoardController?.updateEntriesFromApp?.(),
        renderAroundId: (id, options) => window.MudaeBoardController?.renderAroundId?.(id, options)
      });
    }
    return searchMoveSession;
  }

  function rememberSearchMoveOrigin() {
    return getSearchMoveSession()?.remember?.();
  }

  function clearSearchMoveOrigin() {
    return getSearchMoveSession()?.clear?.();
  }

  function hasSearchMoveOrigin() {
    return !!getSearchMoveSession()?.has?.();
  }

  function restoreSearchMoveOriginAfterRender() {
    return !!getSearchMoveSession()?.restoreAfterRender?.();
  }

  function setUnifiedSearchValue(value, options = {}) {
    const raw = String(value || '');
    const normalized = raw.trim().toLowerCase();

    // v2.483:
    // Normal searching and movement while filtered are separate sessions.
    // Normal typing captures where the user was before the first non-empty
    // query so clearing search can return there. Movement code can still opt
    // into the move-origin path explicitly without hijacking normal clear.
    if (normalized && !app.filter.q && options.captureSearchOrigin !== false) {
      rememberSearchSessionOrigin();
    }

    if (normalized && !app.filter.q && options.captureMoveOrigin === true) {
      rememberSearchMoveOrigin();
    }

    if (!normalized && !options.keepSearchOrigin) {
      // Clearing through the dedicated clearSearchText path restores then clears
      // the origin itself. Direct programmatic clears should not leave stale
      // search origins behind.
      clearSearchSessionOrigin();
    }

    app.filter.q = normalized;
    app.filter.floatingQ = '';

    if (els.searchInput && options.updateTop !== false) {
      els.searchInput.value = raw;
    }

    if (els.floatingSearchInput && options.updateFloating !== false) {
      els.floatingSearchInput.value = raw;
    }

    syncSearchClearButton();
    window.MudaeFloatingBar?.syncVisibility?.();
  }
  function rememberPrimarySearchResult() {
    const first = els.board?.querySelector?.('.char-card[data-id]');
    app.lastSearchPrimaryCharacterId = first?.dataset?.id || null;
    return app.lastSearchPrimaryCharacterId;
  }

  function getSearchClearTargetId() {
    const current = els.board?.querySelector?.('.char-card[data-id]')?.dataset?.id;
    return current || app.lastSearchPrimaryCharacterId || app.searchClearAnchorId || null;
  }
  function applyPendingJumpHighlight() {
    const id = app.pendingJumpHighlightId;
    const until = app.pendingJumpHighlightUntil || 0;

    if (!id || performance.now() > until) {
      app.pendingJumpHighlightId = null;
      app.pendingJumpHighlightUntil = 0;
      return false;
    }

    const safeId = getCssSafeId(id);
    const node = els.board?.querySelector?.(`[data-id="${safeId}"]`);

    if (!node) return false;

    node.classList.remove('highlight-jump', 'highlight-jump-strong');
    void node.offsetWidth;
    node.classList.add('highlight-jump', 'highlight-jump-strong');
    node.dataset.jumpHighlighted = 'true';

    return true;
  }
  function scrollToCharacterIdFirefoxSafe(characterId, behavior = 'auto') {
    markUserViewInteraction('jump-to-character-firefox');
    if (!characterId) return false;

    const safeId = getCssSafeId(characterId);

    app.pendingJumpHighlightId = characterId;
    app.pendingJumpHighlightUntil = performance.now() + 2200;

    const getNode = () => els.board?.querySelector?.(`[data-id="${safeId}"]`) || null;

    const markNode = node => {
      if (!node) return;

      app.pendingJumpHighlightId = characterId;
      app.pendingJumpHighlightUntil = performance.now() + 2200;

      node.classList.remove('highlight-jump', 'highlight-jump-strong');
      void node.offsetWidth;
      node.classList.add('highlight-jump', 'highlight-jump-strong');
      node.dataset.jumpHighlighted = 'true';
      setTimeout(() => {
        node.classList.remove('highlight-jump', 'highlight-jump-strong');
        delete node.dataset.jumpHighlighted;
      }, 1900);
    };

    const manualCenterScroll = () => {
      const node = getNode();
      if (!node) return false;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;

      // Firefox was leaving the target slightly too high with exact center.
      // Use a lower visual anchor so the card lands a bit below center.
      const desiredTop = Math.max(110, (viewportHeight - rect.height) * 0.58);
      const delta = rect.top - desiredTop;

      if (Math.abs(delta) > 2) {
        window.scrollTo({
          top: (window.scrollY || document.documentElement.scrollTop || 0) + delta,
          behavior: 'auto'
        });
      }

      markNode(node);
      return true;
    };

    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderAroundId?.(characterId);

    if (manualCenterScroll()) {
      requestAnimationFrame(() => {
        manualCenterScroll();
        applyPendingJumpHighlight();
      });
      setTimeout(() => {
        manualCenterScroll();
        applyPendingJumpHighlight();
      }, 140);
      setTimeout(() => {
        manualCenterScroll();
        applyPendingJumpHighlight();
      }, 320);
      return true;
    }

    let attempts = 14;

    const retry = () => {
      if (manualCenterScroll()) {
        requestAnimationFrame(() => {
          manualCenterScroll();
          applyPendingJumpHighlight();
        });
        setTimeout(() => {
          manualCenterScroll();
          applyPendingJumpHighlight();
        }, 140);
        setTimeout(() => {
          manualCenterScroll();
          applyPendingJumpHighlight();
        }, 320);
        return;
      }

      attempts--;

      if (attempts <= 0) return;

      window.MudaeBoardController?.renderAroundId?.(characterId);
      requestAnimationFrame(retry);
    };

    requestAnimationFrame(retry);
    setTimeout(retry, 80);
    setTimeout(retry, 180);

    return false;
  }







  function scrollToRenderedCharacterAfterFullRestore(characterId, behavior = 'auto') {
    const finish = () => {
      window.MudaeMinimalImageLoader?.resume?.(els.board);
      window.MudaeMinimalImageLoader?.releaseVisible?.(els.board);
      window.MudaeGifControl?.refresh?.();
    };

    if (!characterId) {
      finish();
      return false;
    }

    const ok = scrollToCharacterIdFirefoxSafe(characterId, behavior);

    finish();
    return ok;
  }
  function renderFullBoardTargetFirst(targetId, anchorBehavior = 'auto') {
    restoreFullBoardAfterSearchClear(anchorBehavior, targetId);
  }


  function restoreFullBoardAfterSearchClear(anchorBehavior = 'auto', targetId = getSearchClearTargetId()) {
    ++app.restoreRenderJob;

    // Clearing a search is not a navigation action. Older versions tried to
    // restore/focus the first search result after clearing, which made deleting
    // text or pressing the clear button jump to a character. Only Enter search
    // is allowed to call focusCharacterById().
    app.searchClearAnchorId = null;
    app.searchClearAnchorTop = null;

    const keepScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    window.MudaeMinimalImageLoader?.suspend?.();
    renderBoard();

    requestAnimationFrame(() => {
      window.scrollTo({ top: keepScrollY, behavior: 'auto' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: keepScrollY, behavior: 'auto' });
        clearSearchTypingNoJumpGuard();
        window.MudaeMinimalImageLoader?.resume?.(els.board);
        window.MudaeMinimalImageLoader?.releaseVisible?.(els.board);
        window.MudaeGifControl?.refresh?.();
      });
    });
  }




  function clearSearchText(options = {}) {
    const hadSearch = !!String(app.filter.q || '').trim();
    const targetId = hadSearch ? (options.targetId || getSearchClearTargetId()) : null;

    if (hadSearch) {
      app.searchClearAnchorId = targetId;
      app.searchClearAnchorTop = null;
    }

    if (app.searchTimer) {
      clearTimeout(app.searchTimer);
      app.searchTimer = null;
    }

    // v2.483:
    // Clear must always rebuild the complete board, but it should restore the
    // user's pre-search visual origin when available. This is intentionally
    // separate from the special search-move origin used by drag/move flows.
    const shouldRestoreSessionOrigin = hadSearch && options.restoreSearchOrigin !== false && hasSearchSessionOrigin();
    const shouldRestoreMoveOrigin = hadSearch && !shouldRestoreSessionOrigin && options.restoreMoveOrigin === true && hasSearchMoveOrigin();

    // Keep the no-jump min-height guard active until after the full board is
    // restored. Clearing it before render lets the filtered board shrink and
    // the browser can clamp the page to the bottom.
    setUnifiedSearchValue('', { captureMoveOrigin: false, keepSearchOrigin: true });

    if (els.searchInput) els.searchInput.value = '';
    if (els.floatingSearchInput) els.floatingSearchInput.value = '';
    app.filter.q = '';
    app.filter.floatingQ = '';

    hideSearchSuggestions?.({ force: true });
    cancelSearchNavigationSideEffects();

    const focusTarget = options.focusTarget || els.searchInput;

    if (options.focus !== false && focusTarget) {
      focusTarget.focus({ preventScroll: true });
    }

    if (hadSearch) {
      // Let the input/UI clear visually before doing the full-board rebuild.
      requestAnimationFrame(() => {
        if (shouldRestoreSessionOrigin) {
          clearSearchMoveOrigin();
          renderBoard();
          window.MudaeBoardController?.updateEntriesFromApp?.();
          restoreSearchSessionOriginAfterRender();
          requestAnimationFrame(() => {
            requestAnimationFrame(clearSearchTypingNoJumpGuard);
          });
        } else if (shouldRestoreMoveOrigin) {
          renderBoard();
          window.MudaeBoardController?.updateEntriesFromApp?.();
          restoreSearchMoveOriginAfterRender();
          requestAnimationFrame(() => {
            requestAnimationFrame(clearSearchTypingNoJumpGuard);
          });
        } else {
          clearSearchMoveOrigin();
          clearSearchSessionOrigin();
          restoreFullBoardAfterSearchClear('auto', targetId);
        }
      });
    } else {
      clearSearchMoveOrigin();
      clearSearchSessionOrigin();
      clearSearchTypingNoJumpGuard();
      if (options.render !== false) renderBoard();
    }
  }






  function clearTransientFieldsOnly() {
    app.filter.q = '';
    clearSearchMoveOrigin();
    clearSearchSessionOrigin();

    if (app.searchTimer) {
      clearTimeout(app.searchTimer);
      app.searchTimer = null;
    }

    if (els.searchInput) els.searchInput.value = '';
    window.MudaeFloatingBar?.clear?.({ render: false, focus: false });
    if (els.parserInput) els.parserInput.value = '';
    if (els.parserStatus) els.parserStatus.textContent = 'Ready.';
    updateParserCounter();
    if (typeof syncSearchClearButton === 'function') syncSearchClearButton();
    if (typeof window.MudaeFloatingBar?.syncVisibility === 'function') window.MudaeFloatingBar?.syncVisibility?.();
  }
  function filterToCharacter(characterId) {
    const ch = getCharacter(characterId);
    if (!ch) return;

    const query = ch.name || '';
    setUnifiedSearchValue(query);
    renderBoard();

    requestAnimationFrame(() => {
      scrollToCharacterId(characterId, {
        behavior: 'auto',
        block: 'center',
        highlight: true
      });
    });
  }
  function getCssSafeId(id) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(id);
    }

    return String(id || '').replace(/["\\]/g, '\\$&');
  }

  function getTopVisibleCharacterAnchor() {
    const cards = Array.from(els.board.querySelectorAll('.char-card[data-id]'));
    if (!cards.length) return null;

    const viewportTop = 0;
    const viewportBottom = window.innerHeight || document.documentElement.clientHeight || 0;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom <= viewportTop || rect.top >= viewportBottom) return;

      const visibleTop = Math.max(rect.top, viewportTop);
      const visibleBottom = Math.min(rect.bottom, viewportBottom);
      const visible = Math.max(0, visibleBottom - visibleTop);
      const ratio = rect.height ? visible / rect.height : 0;
      const score = Math.abs(rect.top - 96) - ratio * 60;

      if (score < bestScore) {
        bestScore = score;
        best = {
          id: card.dataset.id,
          top: rect.top
        };
      }
    });

    if (best) return best;

    const fallback = cards[0];
    return fallback ? {
      id: fallback.dataset.id,
      top: fallback.getBoundingClientRect().top
    } : null;
  }


  function scrollToCharacterId(characterId, options = {}) {
    markUserViewInteraction('jump-to-character');
    if (!characterId) return false;

    if (window.MudaeBoardController?.focusCharacterById) {
      return window.MudaeBoardController.focusCharacterById(characterId, {
        attempts: options.attempts ?? 12,
        delay: options.delay ?? 50,
        settleFrames: options.settleFrames ?? 3,
        correctionThreshold: options.correctionThreshold ?? 140,
        highlight: options.highlight !== false,
        onDone: options.onDone,
        onFail: options.onFail
      });
    }

    const safeId = getCssSafeId(characterId);
    const node = els.board.querySelector(`[data-id="${safeId}"]`);
    if (!node) return false;

    const rect = node.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const targetTop = (window.scrollY || document.documentElement.scrollTop || 0) + rect.top - ((viewportHeight - rect.height) / 2);

    window.scrollTo({ top: Math.max(0, targetTop), behavior: options.behavior || 'auto' });

    if (options.highlight !== false) {
      node.classList.add('highlight-jump');
      setTimeout(() => node.classList.remove('highlight-jump'), 1200);
    }

    return true;
  }

  function rememberSearchClearAnchor() {
    const anchor = getTopVisibleCharacterAnchor();

    app.searchClearAnchorId = anchor?.id || null;
    app.searchClearAnchorTop = Number.isFinite(anchor?.top) ? anchor.top : null;

    return app.searchClearAnchorId;
  }


  function restoreSearchClearAnchor(behavior = 'auto') {
    const id = app.searchClearAnchorId;
    const oldTop = app.searchClearAnchorTop;

    app.searchClearAnchorId = null;
    app.searchClearAnchorTop = null;

    if (!id) return;

    const restore = () => {
      const safeId = getCssSafeId(id);
      const node = els.board.querySelector(`[data-id="${safeId}"]`);
      if (!node) return;

      if (Number.isFinite(oldTop)) {
        const rect = node.getBoundingClientRect();
        const delta = rect.top - oldTop;
        window.scrollTo({
          top: window.scrollY + delta,
          behavior
        });
      } else {
        const rect = node.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
        const targetTop = (window.scrollY || document.documentElement.scrollTop || 0) + rect.top - ((viewportHeight - rect.height) / 2);
        window.scrollTo({ top: Math.max(0, targetTop), behavior });
      }

      node.classList.add('highlight-jump');
      setTimeout(() => node.classList.remove('highlight-jump'), 1200);
    };

    // Wait for board replacement + layout paint. One frame was not reliable enough.
    requestAnimationFrame(() => {
      requestAnimationFrame(restore);
    });
  }
  function rememberLoadedImagesFromDom() {
    if (app.rememberLoadedImagesBound) return;
    app.rememberLoadedImagesBound = true;

    document.addEventListener('load', event => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;

      if (img.closest?.('#editPanel') || img.closest?.('#galleryPanel') || img.classList.contains('char-img')) {
        window.MudaeMinimalImageLoader?.rememberImageElement?.(img);
      }
    }, true);
  }



function bindEvents() {
    els.jsonFileInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await importFile(file);
      } catch (error) {
        console.error(error);
        showAppAlert('Could not import JSON: ' + error.message, { title: 'Import failed', variant: 'danger' });
      } finally {
        event.target.value = '';
      }
    });

    if (els.exportJsonBtn) els.exportJsonBtn.addEventListener('click', event => {
      event.preventDefault();
      downloadJson();
    });

    if (els.parserInput) {
      els.parserInput.addEventListener('paste', insertNormalizedParserPaste);
      els.parserInput.addEventListener('input', scheduleParserCounterUpdate);
      updateParserCounter();
    }

    if (els.parserDetails) {
      els.parserDetails.addEventListener('toggle', () => pulseParserToggleOptimization(els.parserDetails.open ? 'open' : 'close'));
    }

    els.parseReplaceBtn.addEventListener('click', () => { normalizeParserInputValue({ updateField: true }); updateParserCounter(); applyParsedCharacters('replace'); });
    els.parseAppendBtn.addEventListener('click', () => { normalizeParserInputValue({ updateField: true }); updateParserCounter(); applyParsedCharacters('append'); });
    els.clearParserBtn.addEventListener('click', () => {
      els.parserInput.value = '';
      setParserStatus('Ready.');
      updateParserCounter();
    });


    const loadDemoBoardBtn = document.getElementById('loadDemoBoardBtn');
    if (loadDemoBoardBtn) {
      loadDemoBoardBtn.addEventListener('click', async event => {
        event.preventDefault();

        try {
          await loadIncludedDemoBoard();
          notifyAppMessage?.('Loaded demo board.');
          setParserStatus('Demo board loaded.');
        } catch (error) {
          console.error(error);
          showAppAlert('Could not load demo board: ' + (error?.message || error), {
            title: 'Demo load failed',
            variant: 'danger'
          });
        }
      });
    }

    if (els.clearLocalBtn) els.clearLocalBtn.addEventListener('click', async event => {
      event.preventDefault();

      try {
        const ok = await showAppConfirm('Clear local rebuild data?', {
          title: 'Clear local data?',
          okText: 'Clear data',
          cancelText: 'Cancel',
          variant: 'danger'
        });

        if (!ok) return;

        if (!window.MudaeJsonIo?.clearLocalState) {
          throw new Error('JSON IO module is not available.');
        }

        window.MudaeJsonIo.clearLocalState(STORAGE_KEY);
        window.MudaeSettingsDock?.clearCustomBackground?.();
        app.meta = {};
        app.state.characters = [];
        app.originalInput = '';
        saveLocal();
        renderAll();
        notifyAppMessage('Local rebuild data cleared.');
      } catch (error) {
        console.error(error);
        showAppAlert('Could not clear local data: ' + (error?.message || error), {
          title: 'Clear local failed',
          variant: 'danger'
        });
      }
    });

    els.searchInput.addEventListener('input', () => {
      app.searchSuggestionsSuppressUntilInput = false;
      cancelSearchNavigationSideEffects();
      const rawValue = els.searchInput.value;
      const nextQuery = rawValue.trim().toLowerCase();
      const wasSearching = !!app.filter.q;
      const isClearingSearch = wasSearching && !nextQuery;

      if (isClearingSearch) {
        clearSearchText({ focusTarget: els.searchInput });
        return;
      }

      setUnifiedSearchValue(rawValue, { updateTop: false });
      if (nextQuery) applySearchTypingNoJumpGuard();
      const floatingInput = els.floatingSearchInput || document.getElementById('floatingSearchInput');
      const suggestionInput = (window.__mhpFloatingSearchSyncingInput && document.activeElement === floatingInput)
        ? floatingInput
        : els.searchInput;
      showSearchSuggestions(suggestionInput);

      if (app.searchTimer) clearTimeout(app.searchTimer);
      app.searchTimer = setTimeout(() => {
        app.searchTimer = null;
        renderBoard();
      }, 120);
    });
    els.searchInput.addEventListener('keydown', handleSearchKeydown);
    els.searchInput.addEventListener('focus', () => showSearchSuggestions(els.searchInput));
    els.searchInput.addEventListener('blur', () => scheduleHideSearchSuggestions(420));

    els.clearSearchBtn.addEventListener('click', clearSearchText);
els.filterTypeSelect.addEventListener('change', () => {
      app.filter.type = els.filterTypeSelect.value;
      renderBoard();
    });

    els.restoreAllBtn.addEventListener('click', () => {
      const hadSearch = !!app.filter.q;
      if (hadSearch) rememberSearchClearAnchor();

      if (app.searchTimer) {
        clearTimeout(app.searchTimer);
        app.searchTimer = null;
      }

      setUnifiedSearchValue('');
      els.filterTypeSelect.value = 'all';
      app.filter.type = 'all';

      if (hadSearch) {
        renderBoardFullChunkedAndRestore('auto');
      } else {
        renderBoard();
      }
    });

    bindGroupBadgeRenameClicks();

    els.editCloseBtn.addEventListener('click', forceCloseEditModal);
    els.cancelEditBtn.addEventListener('click', forceCloseEditModal);
    els.saveEditBtn.addEventListener('click', saveEdit);
    els.editImageInput.addEventListener('input', syncPreview);
    els.editNameInput.addEventListener('input', syncPreview);
    buildEmbedColorPalette();
    els.editColorInput?.addEventListener('input', () => syncEmbedColorPreview('text'));
    els.editColorInput?.addEventListener('blur', () => syncEmbedColorPreview('text', { commit: true }));
    els.editColorInput?.addEventListener('focus', () => toggleEditColorPalette(true));
    els.editColorPreviewBtn?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      syncEmbedColorPreview('text', { commit: true });
      const opened = toggleEditColorPalette();
      if (opened) els.editColorInput?.focus?.({ preventScroll: true });
    });
    els.editColorPaletteCloseBtn?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      closeEditColorPalette();
      els.editColorPreviewBtn?.focus?.({ preventScroll: true });
    });

    els.galleryToggleBtn.addEventListener('click', toggleGallery);
    els.galleryCloseBtn.addEventListener('click', () => closeGallery(false));
    els.mudaeSearchBtn.addEventListener('click', searchMudae);
    els.loadPastedBtn.addEventListener('click', parsePastedGallery);
    els.galleryMatchedOnlyBtn?.addEventListener('click', toggleMatchedOnlyGallery);
    els.galleryUseMatchedBtn?.addEventListener('click', useFirstMatchedGalleryImage);
    els.clearGalleryBtn.addEventListener('click', () => {
      const cleared = clearActiveCharacterGalleryCache();
      clearGallery(true);
      openGallery('clear-cache');
      setGalleryStatus(cleared ? 'Gallery cache cleared. Search Mudae will run again next time.' : 'Gallery cleared.');

      const ch = getCharacter(app.activeId);
      if (ch && !hasRealImage(ch.image)) {
        setTimeout(autoSearchMudae, 80);
      }
    });
    document.addEventListener('paste', handleGlobalPaste);

    els.galleryPasteInput.addEventListener('paste', event => {
      const text = event.clipboardData?.getData('text/plain') || '';
      if (!text || !/https?:\/\//i.test(text)) return;

      event.preventDefault();
      parsePastedGallery(text);
    });

    els.statsBar.addEventListener('click', event => {
      const link = event.target.closest('.top-character-link[data-character-id]');
      if (link && link.dataset.characterId) {
        event.stopPropagation();
        filterToCharacter(link.dataset.characterId);
        return;
      }

      const card = event.target.closest('.stat-expandable[data-stat-key]');
      if (!card) return;

      const key = card.dataset.statKey;
      app.expandedStats[key] = !app.expandedStats[key];
      updateStatsBar();
    });

    els.galleryGrid.addEventListener('wheel', event => {
      const el = els.galleryGrid;
      const delta = event.deltaY;
      const atTop = el.scrollTop <= 0;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        event.preventDefault();
      }

      event.stopPropagation();
    }, { passive: false });

    els.galleryPanel.addEventListener('wheel', event => {
      event.stopPropagation();
    }, { passive: false });

    document.addEventListener('pointerdown', event => {
      if (!els.editOverlay.classList.contains('show')) return;
      if (!isEditColorPaletteOpen()) return;
      if (isInsideEditColorControl(event.target)) return;
      closeEditColorPalette();
    }, { capture: true });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && els.editOverlay.classList.contains('show')) {
        if (isEditColorPaletteOpen()) {
          event.preventDefault();
          event.stopPropagation();
          closeEditColorPalette();
          els.editColorPreviewBtn?.focus?.({ preventScroll: true });
          return;
        }
        closeEdit();
      }
    });
  }
  function initDividersModule() {
    if (!window.MudaeDividers?.init) return false;

    window.MudaeDividers.init({
      app,
      els,
      uid,
      str,
      num,
      fmt,
      isDivider,
      normalizeItem,
      getCssSafeId,
      getDividerCounterKind,
      getCharacterCount,
      getCharacter,
      assignBoardCounters,
      invalidateSearchCache,
      renderAll,
      saveLocal,
      showAppDialog,
      showAppAlert,
      showAppConfirm,
      notifyAppMessage,
      getFirstVisibleCharacterRawIndex,
      getFirstVisibleCharacterDisplayPosition,
      captureBoardVisualAnchor,
      restoreBoardVisualAnchor
    });

    return true;
  }
  function exportSm() {
    return window.MudaeExports?.exportSm?.() ?? false;
  }

  function exportDividerSmp(dividerId) {
    return window.MudaeExports?.exportDividerSmp?.(dividerId) ?? false;
  }
  function clearSearchForFocusJump() {
    if (app.searchTimer) {
      clearTimeout(app.searchTimer);
      app.searchTimer = null;
    }

    clearSearchTypingNoJumpGuard();
    clearSearchMoveOrigin();
    clearSearchSessionOrigin();

    // Enter search is a navigation action, not a search/move session.
    // Any origin captured while typing the query must be discarded so the next
    // normal search starts from the post-jump location instead of restoring to
    // an old/stale place.

    // Cancel any pending full-list restore created by the normal clear-search path.
    ++app.restoreRenderJob;
    app.searchClearAnchorId = null;
    app.searchClearAnchorTop = null;

    app.filter.q = '';
    app.filter.floatingQ = '';

    if (els.searchInput) els.searchInput.value = '';

    const floatingInput = document.getElementById('floatingSearchInput');
    if (floatingInput) {
      window.__mhpFloatingSearchProgrammaticClear = true;
      floatingInput.value = '';
      setTimeout(() => {
        window.__mhpFloatingSearchProgrammaticClear = false;
        floatingInput.focus?.({ preventScroll: true });
      }, 0);
    }

    hideSearchSuggestions?.({ force: true });
    syncSearchClearButton?.();
    window.MudaeFloatingBar?.syncVisibility?.();
  }

  function jumpFloatingSearchResult(query = '', options = {}) {
    if (!options.allowWithoutFloatingFlag && !window.__mhpFloatingSearchEnterRequested) return false;

    const rawValue = str(query || els.searchInput?.value || '').trim();

    if (!rawValue) return false;

    const normalizeForJump = value => {
      if (typeof normalizeSearchText === 'function') return normalizeSearchText(value || '');
      return str(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };

    const parsedTerms = parseSearchTokens(rawValue)
      .map(parseSearchTerm)
      .filter(item => item.value);
    const primaryTerm = parsedTerms.length === 1 ? parsedTerms[0] : null;

    const wanted = normalizeForJump(rawValue);
    const exactOnly = /^".*"$/.test(rawValue);
    const wantedExact = normalizeForJump(rawValue.replace(/^"|"$/g, ''));

    const matchesCharacter = item => {
      if (!item || isDivider(item)) return false;

      const name = normalizeForJump(item.name || '');
      const series = normalizeForJump(item.series || '');
      const owner = normalizeForJump(item.owner || '');
      const note = normalizeForJump(item.note || '');

      if (primaryTerm?.field === 'series' || primaryTerm?.field === 'serie') {
        return primaryTerm.exact
          ? series === primaryTerm.value
          : series.includes(primaryTerm.value);
      }

      if (primaryTerm?.field === 'name') {
        return primaryTerm.exact
          ? name === primaryTerm.value
          : name.includes(primaryTerm.value);
      }

      if (primaryTerm?.field === 'owner') {
        return primaryTerm.exact
          ? owner === primaryTerm.value
          : owner.includes(primaryTerm.value);
      }

      if (primaryTerm?.field === 'note') {
        return primaryTerm.exact
          ? note === primaryTerm.value
          : note.includes(primaryTerm.value);
      }

      if (primaryTerm?.field === 'divider') {
        return false;
      }

      if (exactOnly) return name === wantedExact;

      return (
        name === wanted ||
        name.includes(wanted) ||
        series.includes(wanted) ||
        owner.includes(wanted) ||
        note.includes(wanted)
      );
    };

    const matchesDivider = item => {
      if (!item || !isDivider(item)) return false;
      if (primaryTerm?.field !== 'divider') return false;
      const title = normalizeForJump(item.title || '');
      return primaryTerm.exact
        ? title === primaryTerm.value
        : title.includes(primaryTerm.value);
    };

    const matched = (app.state.characters || []).find(item => matchesDivider(item) || matchesCharacter(item));

    if (!matched?.id) return false;

    // Clear the filter without dispatching the normal input/change handlers.
    // Those handlers run the normal clear-search path, which rebuilds the board.
    // Enter search should have exactly one scroll owner: board-controller focus.
    clearSearchForFocusJump();

    if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
    if (typeof assignBoardCounters === 'function') assignBoardCounters();

    // v2.163: avoid rendering the full board once from the current scroll
    // position before focusing. That intermediate render can clamp/reposition
    // the page and create the visible up/down jump. The board-controller is the
    // only scroll owner: it updates entries, mounts the target window and then
    // performs one controlled focus correction.
    const focusTarget = options.focusTarget || document.getElementById('floatingSearchInput') || els.searchInput;
    const focusWithController = () => {
      const ok = window.MudaeBoardController?.focusCharacterById?.(matched.id, {
        behavior: 'auto',
        block: 'center',
        attempts: 18,
        delay: 50,
        settleFrames: 2,
        correctionThreshold: 170,
        highlight: true,
        onDone: () => {
          focusTarget?.focus?.({ preventScroll: true });
        },
        onFail: () => {
          renderBoard();
          requestAnimationFrame(() => focusTarget?.focus?.({ preventScroll: true }));
        }
      });

      if (!ok) {
        renderBoard();
        requestAnimationFrame(() => focusTarget?.focus?.({ preventScroll: true }));
      }
    };

    requestAnimationFrame(focusWithController);

    return true;
  }
  function initExportsModule() {
    if (!window.MudaeExports?.init) return false;

    window.MudaeExports.init({
      app,
      els,
      str,
      num,
      fmt,
      isDivider,
      showAppDialog,
      showAppAlert,
      notifyAppMessage
    });

    return true;
  }






  function bindSaveFlushGuards() {
    if (window.__mhpSaveFlushGuardsBound) return;

    window.__mhpSaveFlushGuardsBound = true;

    const flush = () => {
      try {
        window.MudaeBoardController?.flushSave?.();
      } catch (error) {
        console.error('Save flush guard failed:', error);
      }
    };

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }


  function isElementVisibleInViewport(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect?.();
    if (!rect) return false;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const style = window.getComputedStyle ? window.getComputedStyle(element) : null;

    return (
      rect.bottom > 0 &&
      rect.top < viewportHeight &&
      style?.visibility !== 'hidden' &&
      style?.display !== 'none'
    );
  }

  function focusSearch() {
    const mainSearch = els.searchInput || document.getElementById('searchInput');

    // Ctrl+F should use the top search while it is visible.
    // The floating search is only preferred once the top search is out of view.
    if (isElementVisibleInViewport(mainSearch)) {
      mainSearch.focus({ preventScroll: true });
      mainSearch.select();
      window.MudaeFloatingBar?.syncVisibility?.();
      return;
    }

    if (window.MudaeFloatingBar?.focusPreferred?.()) return;

    if (mainSearch) {
      mainSearch.focus({ preventScroll: true });
      mainSearch.select();
    }
  }

  function debugGenderCounts() {
    const rows = app.state.characters
      .filter(item => !isDivider(item))
      .map(item => ({
        name: item.name,
        series: item.series,
        roulette: item.roulette,
        tags: getRouletteTags(item),
        gender: getGenderType(item),
        rawText: item.rawText
      }));
    console.table(rows);
    return rows;
  }

  function buildPublicApi() {
    return {
      app,
      els,

      // Modal / panel bridges
      openEdit,
      closeEdit,
      openGallery,
      closeGallery,
      isEditOpen: () => els.editOverlay.classList.contains('show'),
      isGalleryOpen: () => !els.galleryPanel.hidden,

      // Rendering / board bridges
      renderAll,
      renderBoard,
      renderVirtualBoardWindow,
      createBoardEntryNode,
      collectCurrentBoardEntries,
      applyPendingJumpHighlight,

      // Search bridges
      searchMudae,
      showSearchSuggestions,
      scheduleHideSearchSuggestions,
      handleSearchKeydown,
      clearSearchText,
      setUnifiedSearchValue,
      normalizeSearchText,
      getSearchMinChars: () => app.searchMinChars,
      restoreFullBoardAfterSearchClear,
      renderBoardFullChunkedAndRestore,
      getSearchClearTargetId,
      getSearchDebugState: () => ({
        q: app.filter.q,
        floatingQ: app.filter.floatingQ,
        topInput: els.searchInput?.value || '',
        floatingInput: els.floatingSearchInput?.value || '',
        hasMoveOrigin: hasSearchMoveOrigin(),
        hasSearchOrigin: hasSearchSessionOrigin(),
        searchOriginAnchor: app.searchSessionOriginAnchor?.id || null,
        searchOriginAgeMs: app.searchSessionOriginStartedAt ? Date.now() - app.searchSessionOriginStartedAt : 0,
        boardChildren: els.board?.children?.length || 0,
        characterCount: getCharacterCount()
      }),
      rememberSearchClearAnchor,
      restoreSearchClearAnchor,
      rememberSearchSessionOrigin,
      clearSearchSessionOrigin,
      jumpFloatingSearchResult,
      focusSearch,

      // Character / movement bridges
      moveCharacterToPosition,
      moveCharacterRelativeToTarget,
      moveCharacterRelativeToTargetDataOnly,
      moveSelectedCharactersRelativeToTargetDataOnly,
      getCharacterCount,

      // Settings bridges
      setVisibleCardLimit,
      getVisibleCardLimit,
      setVirtualBoardEnabled,
      isVirtualBoardEnabled,
      getBoardColumnSetting,
      setBoardColumnSetting,

      // Dividers / groups
      addBoardDivider,
      addBoardSubDivider,
      editDivider,
      confirmDeleteDivider,
      toggleMultiSelectMode,
      getMultiSelectMode,
      clearMultiSelection,
      setMultiMoveTargetMode,
      createGroupFromSelection,
      addSelectedCharactersToExistingGroup,
      getSelectedGroupAction,
      syncGroupsFromCharacters,
      getGroupLabelForCharacter,
      getGroupLeadId,
      setGroupLead,
      moveGroupMember,
      showGroupManageDialog,
      applyGroupOrderToBoard,
      moveGroupMemberToIndex,
      setGroupName,
      promptRenameGroup,

      // Exports / storage
      exportSm,
      exportDividerSmp,
      exportPayload,
      saveLocal,
      getAllGalleryImageUrls,
      getAllBoardImageUrls,

      // Edit/gallery controller internals. These are intentionally grouped so
      // js/edit-gallery-manager.js can own the modal/panel lifecycle without
      // reaching into unrelated modules.
      __editGalleryInternals: {
        getCharacter,
        fillEditShellOnly,
        fillEdit,
        toggleEditColorPalette,
        clearGallery,
        renderGallery,
        setGalleryStatus,
        autoSearchMudae,
        hasRealImage,
        normalizeUrls,
        closeEditWithoutScrollRestore,
        unlockPageScrollIfAllowed,
        cancelEditSession,
        isEditClosingLocked,
        readSpheresInputs,
        syncEmbedColorPreview,
        getKeyTypeFromCount,
        makeStableKey,
        normalizeCharacterImageGalleryPreserveOrder,
        mergeGalleryUrlsPreserveAbsoluteOrder,
        getEffectiveMudaeGalleryCount,
        getEffectiveMudaeGalleryUrls,
        syncMudaeGalleryFlags,
        dedupeCharacterImageUrls,
        hasRealImage,
        canonicalImageUrlKey,
        recalcStats,
        assignBoardCounters,
        renderCharacterCardById
      },

      // Dialogs / diagnostics
      showAppAlert,
      showAppConfirm,
      showAppPrompt,
      notifyAppMessage,
      debugSearch,
      debugGenderCounts
    };
  }


  function installDirectEditOpenCapture() {
    if (window.__mhpDirectEditOpenCaptureInstalled) return;
    window.__mhpDirectEditOpenCaptureInstalled = true;

    const getEditButton = target => {
      const button = target?.closest?.('.card-edit-btn, .edit-btn, [data-action="edit"], [data-mhp-action="edit"], [aria-label^="Edit"]');
      if (!button) return null;

      // Divider actions also use labels like "Edit divider". The direct card-edit
      // capture runs before delegated divider handlers, so it must ignore divider
      // buttons instead of swallowing their first click and trying to open a
      // character edit modal with a divider id.
      if (button.closest?.('.divider-row, .compact-sticky-divider-bar')) return null;
      if (button.classList?.contains('divider-action-btn') || button.classList?.contains('compact-sticky-divider-action')) return null;
      if (button.dataset?.dividerAction || button.dataset?.dividerId) return null;

      return button;
    };
    const getCardId = node => node?.closest?.('[data-id]')?.dataset?.id || '';
    const clearOpenLocks = () => {
      window.__mhpEditClosingUntil = 0;
      window.__mhpSuppressEditOpenUntil = 0;
      window.MHPEditGalleryController?.clearSuppress?.('direct-edit-open');
      document.documentElement.classList.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
      document.body?.classList?.remove('mhp-edit-closing', 'mhp-edit-gallery-saving');
    };

    const openFromEditButtonEvent = (event, phase) => {
      const button = getEditButton(event.target);
      if (!button) return false;
      const id = getCardId(button);
      if (!id || els.editOverlay?.classList?.contains('show')) return false;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      clearOpenLocks();
      window.__mhpLastDirectEditOpenAt = Date.now();
      window.__mhpLastDirectEditOpenId = id;
      openEdit(id);
      return true;
    };

    // Open on pointerdown instead of waiting for click. The board has image/move
    // click handlers and lazy hover layers; opening on pointerdown prevents the
    // first user action from being consumed before the edit button receives click.
    document.addEventListener('pointerdown', event => {
      openFromEditButtonEvent(event, 'pointerdown');
    }, true);

    document.addEventListener('click', event => {
      const button = getEditButton(event.target);
      if (!button) return;

      const lastAt = Number(window.__mhpLastDirectEditOpenAt || 0);
      if (lastAt && Date.now() - lastAt < 700) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }

      openFromEditButtonEvent(event, 'click');
    }, true);

    // v2.643: use the same direct pointerdown strategy for the actions that live
    // on top of the card image. Image move handlers can consume the later click,
    // so Move Character and Group Menu must open before the card image receives it.
    const stopBoardAction = event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const runDirectBoardAction = (event, phase = 'pointerdown') => {
      if (els.editOverlay?.classList?.contains('show')) return false;
      if (getEditButton(event.target)) return false;
      if (event.target?.closest?.('.divider-action-btn, .compact-sticky-divider-action, .divider-row, .compact-sticky-divider-bar')) return false;

      const groupBadge = event.target?.closest?.('.card-group-badge');
      if (groupBadge && els.board?.contains?.(groupBadge)) {
        const groupId = str(groupBadge.dataset?.groupId || '').trim();
        if (!groupId) return false;
        stopBoardAction(event);
        window.__mhpLastDirectBoardActionAt = Date.now();
        window.__mhpLastDirectBoardActionKind = 'group';
        showGroupManageDialog(groupId);
        return true;
      }

      const moveHit = event.target?.closest?.(MOVE_POSITION_SELECTOR);
      if (moveHit && els.board?.contains?.(moveHit)) {
        const characterId = getCharacterIdFromMoveNode(moveHit);
        if (!characterId) return false;
        stopBoardAction(event);
        window.__mhpLastDirectBoardActionAt = Date.now();
        window.__mhpLastDirectBoardActionKind = 'move';
        promptMoveCharacterSafe(characterId);
        return true;
      }

      return false;
    };

    document.addEventListener('pointerdown', event => {
      runDirectBoardAction(event, 'pointerdown');
    }, true);

    document.addEventListener('click', event => {
      const lastAt = Number(window.__mhpLastDirectBoardActionAt || 0);
      if (lastAt && Date.now() - lastAt < 700) {
        const kindHit = event.target?.closest?.('.card-group-badge, ' + MOVE_POSITION_SELECTOR);
        if (kindHit) stopBoardAction(event);
      }
    }, true);
  }


  async function boot() {
    installEditDeleteCharacterDelegatedHandler();
    installDirectEditOpenCapture();
    
    hydrateVisibleCardLimitSetting();
    hydrateVirtualBoardSetting();
    rememberLoadedImagesFromDom();
    initEls();
    initDividersModule();
    initExportsModule();
    bindSaveFlushGuards();
    bindEvents();
    bindJsonDragDrop();
    bindVirtualBoardScroll();
    bindCompactStickyDivider();
    bindMoveCancelShortcut();
    bindSearchSuggestionBox();
    installSearchShortcutCapture();
    bindViewPositionPersistence();

    // v2.479: publish the bridge API before the initial render.
    // BoardController depends on window.MUDAE_REBUILD_V1 to find els.board,
    // collect entries and create nodes. Previously this bridge was assigned
    // only after the first render, so F5/localStorage boot always made the
    // controller return false/empty and app.js fell back to the slow full DOM
    // render. JSON imports happened after boot, so they did not hit this bug.
    window.MUDAE_REBUILD_V1 = buildPublicApi();

    await loadLocalCooperative();
    const hadLargeLoadOverlay = app.localLoadWasHeavy || app.state.characters.length > 600;
    try {
      if (hadLargeLoadOverlay) {
        if (!app.localLoadWasHeavy) showAppLoading('Loading harem...', 'Preparing saved characters and images.');
        window.MudaeMinimalImageLoader?.clearStale?.();
      }

      await renderAllCooperative({ beforePaint: hadLargeLoadOverlay });
    } catch (error) {
      console.error('Initial render failed', error);
      app.virtualBoardEnabled = false;

      try {
        renderAll();
      } catch (fallbackError) {
        console.error('Fallback render failed', fallbackError);
        if (els.board && !els.board.children.length) {
          els.board.replaceChildren(createEmptyBoardMessage());
        }
      }
    } finally {
      if (hadLargeLoadOverlay) {
        await endHeavyUiLoad('initial-local-render');
      } else {
        hardFinishLoadingState('initial-render-no-heavy');
      }
    }

    clearTransientFieldsOnly();
    window.MudaeFloatingBar?.syncVisibility?.();

    window.MUDAE_REBUILD_V1 = buildPublicApi();

    window.MudaeBoardController?.bind?.();

  }

  boot();
})();


// v2.387: keep custom page background stable after tab visibility changes.
(() => {
  if (window.__mhpBackgroundRepaintFixInstalled) return;
  window.__mhpBackgroundRepaintFixInstalled = true;

  const refreshBackgroundComposite = () => {
    const root = document.documentElement;
    if (!root.classList.contains('has-custom-page-bg')) return;
    root.classList.add('mhp-bg-repaint');
    requestAnimationFrame(() => root.classList.remove('mhp-bg-repaint'));
  };

  // v2.449: do not repaint custom background on tab focus/visibility.
  // document.addEventListener('visibilitychange', refreshBackgroundComposite, { passive: true });
  // window.addEventListener('focus', refreshBackgroundComposite, { passive: true });
})();


// v2.388: finish visual boot after initial app/layout pass.
(() => {
  if (window.__mhpBootFinishInstalled) return;
  window.__mhpBootFinishInstalled = true;

  const finish = () => {
    if (typeof window.mhpFinishBootVisual === 'function') {
      window.mhpFinishBootVisual();
      return;
    }
    document.documentElement.classList.remove('mhp-booting');
    document.documentElement.classList.add('mhp-ready');
  };

  if (document.readyState === 'complete') {
    setTimeout(finish, 80);
  } else {
    window.addEventListener('load', () => setTimeout(finish, 80), { once: true });
  }
})();


// v2.390: restore custom background from real app settings/storage.
(() => {
  if (window.__mhpCustomBgRealSettingsFixInstalled) return;
  window.__mhpCustomBgRealSettingsFixInstalled = true;

  const root = document.documentElement;

  const looksLikeImage = (value) => {
    if (!value || value === 'none') return false;
    return /url\(|linear-gradient|radial-gradient|image-set\(/i.test(String(value));
  };

  const urlify = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw || raw === 'none') return '';
    if (looksLikeImage(raw)) return raw;
    if (/^(data:image\/|blob:|https?:|file:)/i.test(raw)) return `url("${raw.replace(/"/g, '\\"')}")`;
    return '';
  };

  const scanObject = (obj, depth = 0) => {
    if (!obj || depth > 3) return '';
    if (typeof obj === 'string') return urlify(obj);
    if (typeof obj !== 'object') return '';

    const preferredKeys = [
      'pageBackgroundImage',
      'pageBackground',
      'backgroundImage',
      'backgroundUrl',
      'customBackground',
      'customBackgroundImage',
      'customBg',
      'customBgImage',
      'wallpaper',
      'wallpaperUrl'
    ];

    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const found = scanObject(obj[key], depth + 1);
        if (found) return found;
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      if (/background|wallpaper|pagebg|custombg/i.test(key)) {
        const found = scanObject(value, depth + 1);
        if (found) return found;
      }
    }

    return '';
  };

  const scanLocalStorage = () => {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (!value) continue;

        if (/background|wallpaper|pagebg|custombg|graphics|settings|mhp/i.test(key)) {
          // v2.476: never JSON.parse huge app state while looking for a background.
          // This made reloads from localStorage much slower than importing the same JSON.
          if (value.length > 250000 && !/background|wallpaper|pagebg|custombg/i.test(key)) continue;
          const direct = urlify(value);
          if (direct) return direct;

          try {
            const parsed = JSON.parse(value);
            const found = scanObject(parsed);
            if (found) return found;
          } catch (_) {}
        }
      }
    } catch (_) {}
    return '';
  };

  const scanGlobals = () => {
    const candidates = [
      window.app,
      window.state,
      window.settings,
      window.graphicsSettings,
      window.mhpSettings,
      window.mhpState,
      window.MHP_SETTINGS,
      window.MHP_STATE
    ];

    for (const obj of candidates) {
      const found = scanObject(obj);
      if (found) return found;
    }

    return '';
  };

  const scanDomStyles = () => {
    const inlineCandidates = [
      root.style.getPropertyValue('--mhp-page-bg-image'),
      root.style.getPropertyValue('--page-bg-image'),
      root.style.getPropertyValue('--custom-page-bg'),
      root.style.getPropertyValue('--mhp-stable-custom-bg'),
      document.body.style.getPropertyValue('--mhp-page-bg-image'),
      document.body.style.getPropertyValue('--page-bg-image'),
      document.body.style.getPropertyValue('--custom-page-bg'),
      document.body.style.backgroundImage,
      root.style.backgroundImage
    ].filter(Boolean);

    for (const value of inlineCandidates) {
      const found = urlify(value);
      if (found) return found;
    }

    return '';
  };

  const applyBg = (bg) => {
    if (!bg) return false;

    root.style.setProperty('--mhp-stable-custom-bg', bg);
    root.style.setProperty('--mhp-page-bg-image', bg);
    root.classList.add('has-custom-page-bg', 'mhp-stable-bg-ready');
    document.body.classList.add('has-custom-page-bg');

    return true;
  };

  const sync = () => {
    const bg =
      scanDomStyles() ||
      scanGlobals() ||
      scanLocalStorage();

    if (bg) applyBg(bg);
    return !!bg;
  };

  const syncMany = () => {
    sync();
    requestAnimationFrame(sync);
    setTimeout(sync, 50);
    setTimeout(sync, 150);
    setTimeout(sync, 350);
    setTimeout(sync, 800);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncMany, { once: true });
  } else {
    syncMany();
  }

  window.addEventListener('load', syncMany, { once: true });
  window.addEventListener('focus', syncMany, { passive: true });
  document.addEventListener('visibilitychange', syncMany, { passive: true });

  window.mhpSyncCustomBackground = syncMany;
})();


// v2.391: force real Graphics Settings background apply after boot/settings load.
(() => {
  if (window.__mhpRealBackgroundApplyHookInstalled) return;
  window.__mhpRealBackgroundApplyHookInstalled = true;

  const applyRealBackground = () => {
    const api = window.MudaeGraphicsSettings;
    if (!api?.readStoredBackground || !api?.applyBackgroundToDocument) return false;

    const config = api.readStoredBackground();
    api.applyBackgroundToDocument(config || null);

    return !!config?.value;
  };

  const applyMany = () => {
    applyRealBackground();
    requestAnimationFrame(applyRealBackground);
    setTimeout(applyRealBackground, 80);
    setTimeout(applyRealBackground, 250);
    setTimeout(applyRealBackground, 650);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMany, { once: true });
  } else {
    applyMany();
  }

  window.addEventListener('load', applyMany, { once: true });
  window.addEventListener('focus', applyMany, { passive: true });
  document.addEventListener('visibilitychange', applyMany, { passive: true });
})();




// v2.393: single-layer background recomposite on tab return.
(() => {
  if (window.__mhpSingleBgRepaintInstalled) return;
  window.__mhpSingleBgRepaintInstalled = true;

  const repaint = () => {
    const root = document.documentElement;
    if (!root.classList.contains('has-custom-page-bg') && !root.classList.contains('mhp-stable-bg-ready')) return;
    root.classList.add('mhp-bg-repaint');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('mhp-bg-repaint'));
    });
  };

  document.addEventListener('visibilitychange', repaint, { passive: true });
  window.addEventListener('focus', repaint, { passive: true });
})();


// v2.399: simple styled boot loader timing, no image dependency.
(() => {
  if (window.__mhpSimpleBootTimingInstalled) return;
  window.__mhpSimpleBootTimingInstalled = true;

  const bootStartedAt = performance.now();
  const MIN_VISIBLE_MS = 650;

  const patchBootFinish = () => {
    if (window.__mhpSimpleBootFinishPatched) return;
    if (typeof window.mhpFinishBootVisual !== 'function') return;

    window.__mhpSimpleBootFinishPatched = true;
    const originalFinish = window.mhpFinishBootVisual;

    window.mhpFinishBootVisual = function mhpFinishBootVisualStyledOnly(){
      const elapsed = performance.now() - bootStartedAt;
      if (elapsed >= MIN_VISIBLE_MS) {
        originalFinish();
        return;
      }

      setTimeout(() => window.mhpFinishBootVisual(), Math.max(40, MIN_VISIBLE_MS - elapsed));
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchBootFinish, { once: true });
  } else {
    patchBootFinish();
  }

  window.addEventListener('load', patchBootFinish, { once: true });
})();


// v2.408: keep Floating Multi-Select button visible while multi-select mode is active.
(() => {
  if (window.__mhpFloatingMultiSelectVisibilityFixInstalled) return;
  window.__mhpFloatingMultiSelectVisibilityFixInstalled = true;

  const isMultiSelectActive = () => {
    const body = document.body;
    return !!(
      body?.classList.contains('multi-select-active') ||
      body?.classList.contains('is-multi-select') ||
      body?.classList.contains('multi-select-mode') ||
      document.documentElement.classList.contains('multi-select-active') ||
      document.querySelector('.multi-select-bar:not([hidden])') ||
      document.querySelector('.multi-select-toolbar:not([hidden])') ||
      document.querySelector('[data-multi-select-active="true"]')
    );
  };

  const ensure = () => {
    const btn = document.getElementById('floatingMultiSelectBtn');
    if (!btn) return;

    const active =
      isMultiSelectActive() ||
      btn.classList.contains('is-active') ||
      btn.getAttribute('aria-pressed') === 'true';

    if (active) {
      btn.hidden = false;
      btn.removeAttribute('hidden');
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
    }
  };

  const schedule = () => requestAnimationFrame(ensure);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure, { once: true });
  } else {
    ensure();
  }

  document.addEventListener('click', schedule, true);
  document.addEventListener('keydown', schedule, true);
  window.addEventListener('mhp-render-complete', schedule);
  window.addEventListener('mhp-board-rendered', schedule);
  window.addEventListener('mhp-floating-bar-updated', schedule);

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { attributes: true, childList: false, subtree: false });
  if (document.body) observer.observe(document.body, { attributes: true, childList: true, subtree: true });
})();


// v2.418: prevent legacy/alternate boot loader flash after Loading harem ends.
(() => {
  if (window.__mhpBootVariantCleanupInstalled) return;
  window.__mhpBootVariantCleanupInstalled = true;

  const cleanupBootVariants = () => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.add('mhp-boot-cleaned');
    body?.classList?.add('mhp-boot-cleaned');

    document.querySelectorAll('.app-loading, .loading-screen, .loader-screen, .legacy-loader, .mhp-loading-legacy').forEach((node) => {
      if (node.id === 'mhpBootLoader') return;
      node.setAttribute('hidden', '');
      node.classList.add('mhp-boot-legacy-hidden');
    });
  };

  const patchFinish = () => {
    if (window.__mhpBootVariantFinishPatched) return;
    if (typeof window.mhpFinishBootVisual !== 'function') return;

    window.__mhpBootVariantFinishPatched = true;
    const originalFinish = window.mhpFinishBootVisual;

    window.mhpFinishBootVisual = function mhpFinishBootVisualSingleVariant(){
      cleanupBootVariants();
      const result = originalFinish.apply(this, arguments);
      requestAnimationFrame(cleanupBootVariants);
      setTimeout(cleanupBootVariants, 80);
      setTimeout(cleanupBootVariants, 220);
      return result;
    };
  };

  const init = () => {
    patchFinish();
    cleanupBootVariants();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('load', init, { once: true });
})();


// v2.420: fast visual refresh after edit save.
(() => {
  // v2.474: disabled legacy visual card patch on Save.
  // The dedicated edit-gallery manager now owns saving and in-place card updates.
  window.__mhpLegacySaveVisualPatchDisabled = true;
})();


// v2.421: boot waits for initial visible images before revealing the app.
(() => {
  if (window.__mhpBootInitialImageGateInstalled) return;
  window.__mhpBootInitialImageGateInstalled = true;

  const MAX_WAIT_MS = 2600;
  const MIN_VISIBLE_MS = 700;
  const MAX_IMAGES = 90;
  const startedAt = performance.now();

  const isImageReady = (img) => img.complete && img.naturalWidth > 0;

  const getInitialImages = () => {
    const selectors = [
      '.character-card img',
      '.char-card img',
      '.card-image',
      '.char-img',
      '#galleryGrid img'
    ];

    const imgs = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        const rect = img.getBoundingClientRect();
        const visibleEnough = rect.width > 8 && rect.height > 8 && rect.top < window.innerHeight + 600;
        if (visibleEnough) imgs.push(img);
      });
    }

    return [...new Set(imgs)].slice(0, MAX_IMAGES);
  };

  const waitImages = () => new Promise((resolve) => {
    const imgs = getInitialImages();

    if (!imgs.length || imgs.every(isImageReady)) {
      resolve();
      return;
    }

    let pending = imgs.filter((img) => !isImageReady(img)).length;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const oneDone = () => {
      pending -= 1;
      if (pending <= 0) finish();
    };

    imgs.forEach((img) => {
      if (isImageReady(img)) return;
      img.loading = 'eager';
      img.decoding = img.decoding || 'async';
      img.addEventListener('load', oneDone, { once: true, passive: true });
      img.addEventListener('error', oneDone, { once: true, passive: true });
    });

    setTimeout(finish, MAX_WAIT_MS);
  });

  const patchFinish = () => {
    if (window.__mhpBootInitialImageGatePatched) return;
    if (typeof window.mhpFinishBootVisual !== 'function') return;

    window.__mhpBootInitialImageGatePatched = true;
    const originalFinish = window.mhpFinishBootVisual;

    window.mhpFinishBootVisual = async function mhpFinishBootVisualWaitInitialImages(){
      const elapsed = performance.now() - startedAt;
      const minDelay = Math.max(0, MIN_VISIBLE_MS - elapsed);

      if (minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay));
      }

      await waitImages();

      document.documentElement.classList.add('mhp-initial-images-ready');
      document.body?.classList?.add('mhp-initial-images-ready');

      return originalFinish.apply(this, arguments);
    };
  };

  const init = () => {
    patchFinish();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('load', init, { once: true });
})();


// v2.474: disabled legacy post-save full refresh.
// The old block listened to #saveEditBtn in capture phase and fired
// updateEntriesFromApp()/renderBoard() several times after Save. That re-rendered
// the card while the edit lifecycle was closing and could reopen the modal.
(() => {
  window.__mhpRealEditSaveRefreshInstalled = true;
})();

// v2.435: safety sync for Edit modal Image URL field.
(() => {
  if (window.__mhpEditImageUrlFieldSyncInstalled) return;
  window.__mhpEditImageUrlFieldSyncInstalled = true;

  const getOpenEditCharacterId = () => {
    const modal = document.querySelector('.edit-modal, #editModal, .character-edit-modal');
    return modal?.dataset?.characterId || modal?.dataset?.charId || modal?.dataset?.id || window.MUDAE_REBUILD_V1?.activeId || '';
  };

  const getImageInput = () => {
    return document.querySelector('#editImageInput, #editImageUrlInput, input[name="image"], input[name="imageUrl"], .edit-image-input');
  };

  const findCharacter = () => {
    const id = getOpenEditCharacterId();
    const api = window.MUDAE_REBUILD_V1;
    const list = api?.state?.characters || window.mudaeApp?.state?.characters || [];
    return list.find(item => item?.id === id) || list.find(item => item?.id === api?.activeId) || null;
  };

  const sync = () => {
    const input = getImageInput();
    if (!input) return;

    const character = findCharacter();
    const image = character
      ? (character.imageUrl || character.image || (Array.isArray(character.mudaeImages) ? character.mudaeImages.find(Boolean) : '') || '')
      : '';

    if (image && !input.value.trim()) {
      input.value = image;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('.edit-btn, .card-edit-btn, [data-action="edit"], .char-card, .character-card')) {
      setTimeout(sync, 50);
      setTimeout(sync, 180);
    }
  }, true);

  window.addEventListener('mhp-edit-opened', sync);
  window.addEventListener('mhp-board-rendered', () => setTimeout(sync, 60));
})();


// v2.440: prevent newest-character auto-scroll from soft-locking the viewport.
(() => {
  if (window.__mhpAutoScrollSoftLockFixInstalled) return;
  window.__mhpAutoScrollSoftLockFixInstalled = true;

  let activeUntil = 0;
  let cancelledUntil = 0;
  let userCancelled = false;

  const originalWindowScrollTo = window.scrollTo.bind(window);
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  const now = () => performance.now();

  const cancelAutoFollow = () => {
    userCancelled = true;
    cancelledUntil = now() + 1600;
    activeUntil = 0;
    document.documentElement.classList.remove('mhp-auto-follow-active');
    document.body?.classList?.remove('mhp-auto-follow-active');
  };

  const isProgrammaticFollowActive = () => {
    return !userCancelled && now() < activeUntil;
  };

  const markAutoFollow = (duration = 900, options = {}) => {
    const force = options === true || options?.force === true;
    if (!force && now() < cancelledUntil) return false;
    userCancelled = false;
    if (force) cancelledUntil = 0;
    activeUntil = now() + Math.max(250, Number(duration) || 900);
    document.documentElement.classList.add('mhp-auto-follow-active');
    document.body?.classList?.add('mhp-auto-follow-active');

    setTimeout(() => {
      if (now() >= activeUntil) {
        document.documentElement.classList.remove('mhp-auto-follow-active');
        document.body?.classList?.remove('mhp-auto-follow-active');
      }
    }, Math.max(300, Number(duration) || 900) + 60);

    return true;
  };

  // Patch scrollTo: if user cancelled auto-follow, block late restore-scroll calls
  // for a short window. Normal user scrolling is unaffected.
  window.scrollTo = function mhpGuardedScrollTo(...args) {
    if (now() < cancelledUntil && !isProgrammaticFollowActive()) return;
    return originalWindowScrollTo(...args);
  };

  // Patch scrollIntoView similarly. This stops delayed highlight/follow loops.
  Element.prototype.scrollIntoView = function mhpGuardedScrollIntoView(...args) {
    if (now() < cancelledUntil && !isProgrammaticFollowActive()) return;
    return originalScrollIntoView.apply(this, args);
  };

  ['wheel', 'touchstart', 'pointerdown', 'mousedown'].forEach(type => {
    window.addEventListener(type, cancelAutoFollow, { passive: true, capture: true });
  });

  window.addEventListener('keydown', (event) => {
    const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
    if (keys.includes(event.key)) cancelAutoFollow();
  }, true);

  window.MHPAutoScrollGuard = {
    mark: markAutoFollow,
    cancel: cancelAutoFollow,
    isActive: isProgrammaticFollowActive,
    isCancelled: () => now() < cancelledUntil
  };
})();


  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('deleteEditCharacterBtn')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.MHPDeleteActiveCharacterFromEdit?.();
    });
  });


// v2.449: tab visibility/focus stability guard.
// Switching browser tabs must not close settings/dialogs or repaint the background.
(() => {
  if (window.__mhpTabVisibilityStabilityFixInstalled) return;
  window.__mhpTabVisibilityStabilityFixInstalled = true;

  let lastSnapshot = null;
  let restoring = false;

  // v2.476: never snapshot/restore editOverlay or galleryPanel here.
  // Search Mudae opens another tab/window while Edit is visible; the old
  // visibility guard saved that open Edit state and then restored it on focus,
  // even after Save/Cancel had correctly closed it. That was the root cause
  // of the post-save reopen loop. Edit + gallery lifecycle now belongs only
  // to js/edit-gallery-manager.js and app.js openEdit/closeEdit.
  const panelIds = [
    // v2.488: do not snapshot/restore Graphics Settings here.
    // Applying a URL background may trigger focus/visibility callbacks; restoring
    // an old visible Graphics snapshot after the user closes it causes a reopen loop.
    // Graphics modal lifecycle belongs to js/settings.js only.
    'exportSidebar',
    'exportSidebarHotspot'
  ];

  const snapshotUi = () => {
    const snapshot = {
      bodyClasses: {},
      panels: {}
    };

    panelIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      snapshot.panels[id] = {
        hidden: el.hidden,
        ariaHidden: el.getAttribute('aria-hidden'),
        classes: Array.from(el.classList || [])
      };
    });

    return snapshot;
  };

  const restoreUi = (snapshot) => {
    if (!snapshot || restoring) return;
    restoring = true;

    try {
      Object.entries(snapshot.panels || {}).forEach(([id, data]) => {
        const el = document.getElementById(id);
        if (!el || !data) return;

        // Only restore panels that were open/visible before the tab switch.
        const wasVisible = data.hidden === false || data.classes.includes('show') || data.classes.includes('is-open');
        if (!wasVisible) return;

        el.hidden = false;
        if (data.ariaHidden === 'false') el.setAttribute('aria-hidden', 'false');

        ['show', 'is-open', 'active'].forEach(cls => {
          if (data.classes.includes(cls)) el.classList.add(cls);
        });
      });

      // v2.476: do not restore body.modal-open from focus/page visibility.
      // Only openEdit/closeEdit may own modal-open.

      // Keep boot classes stable; returning to a tab is not a new boot.
      document.documentElement.classList.remove('mhp-booting', 'mhp-bg-repaint');
      document.documentElement.classList.add('mhp-ready');
      document.body?.classList?.remove('mhp-bg-repaint');

      // Heavy loading flags should not remain after a normal tab switch.
      if (!document.querySelector('.app-loading-overlay:not([hidden])')) {
        document.documentElement.classList.remove('mhp-heavy-loading');
        document.body?.classList?.remove('mhp-heavy-loading');
      }
    } finally {
      requestAnimationFrame(() => {
        restoring = false;
      });
    }
  };

  const beforeLeave = () => {
    lastSnapshot = snapshotUi();
    document.documentElement.classList.add('mhp-tab-switch-stable');
    document.body?.classList?.add('mhp-tab-switch-stable');
  };

  const afterReturn = () => {
    // Do not force repaint. Just restore non-edit UI visibility state after any
    // queued focus/visibility handlers have run.
    document.documentElement.classList.add('mhp-tab-switch-stable');
    document.body?.classList?.add('mhp-tab-switch-stable');

    const safeRestore = () => {
      // During/after edit Save or Cancel, restoring old focus snapshots is unsafe.
      const t = performance.now ? performance.now() : Date.now();
      const blockedUntil = Math.max(
        Number(window.__mhpEditClosingUntil || 0),
        Number(window.__mhpSuppressEditOpenUntil || 0),
        Number(window.__mhpPostEditRestoreBlockedUntil || 0),
        Number(window.__mhpGraphicsSettingsClosingUntil || 0),
        Number(window.MHPEditGalleryController?.getSuppressUntil?.() || 0)
      );
      if (t < blockedUntil) return;
      restoreUi(lastSnapshot);
    };

    setTimeout(safeRestore, 0);
    setTimeout(safeRestore, 80);
    setTimeout(() => {
      safeRestore();
      document.documentElement.classList.remove('mhp-tab-switch-stable', 'mhp-stabilize-bg');
      document.body?.classList?.remove('mhp-tab-switch-stable', 'mhp-stabilize-bg');
    }, 260);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) beforeLeave();
    else afterReturn();
  }, true);

  window.addEventListener('pagehide', beforeLeave, true);
  window.addEventListener('pageshow', afterReturn, true);

  // Use focusin/focus, but only as a restore point, never as a repaint trigger.
  window.addEventListener('focus', afterReturn, true);

  // Let the edit/gallery manager erase stale focus snapshots immediately
  // after Save/Cancel/hard close.
  window.MHPClearTabVisibilitySnapshot = () => {
    lastSnapshot = null;
  };
})();


// v2.451: removed dynamic scroll background toggler; background is static now.


// v2.494: legacy robust Force Load All removed.
// Image preload is now owned by js/settings.js + js/image-loader-minimal.js.
// It only queues main card images via MUDAE_REBUILD_V1.getAllBoardImageUrls(),
// and it no longer forces full board renders or intercepts clicks globally.


// v2.451: cleanup stale dynamic background classes from previous versions.
(() => {
  if (window.__mhpStaticBackgroundCleanupInstalled) return;
  window.__mhpStaticBackgroundCleanupInstalled = true;

  const cleanup = () => {
    document.documentElement.classList.remove('mhp-is-scrolling', 'mhp-bg-repaint');
    document.body?.classList?.remove('mhp-is-scrolling', 'mhp-bg-repaint');
  };

  cleanup();
  window.addEventListener('load', cleanup, { once: true });
  document.addEventListener('visibilitychange', cleanup, true);
})();


// v2.452: real fixed background layer. No pseudo-element repaint hacks.
(() => {
  if (window.__mhpRealBackgroundLayerInstalled) return;
  window.__mhpRealBackgroundLayerInstalled = true;

  const STORAGE_KEY = 'mudae.pageBackground.v1';

  const looksReal = (value) => {
    const raw = String(value || '').trim();
    return !!raw && raw !== 'none' && raw !== 'url("")' && raw !== 'initial' && raw !== 'inherit';
  };

  const cssUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw === 'none') return '';
    if (/^(url\(|linear-gradient|radial-gradient|image-set\()/i.test(raw)) return raw;
    if (/^(data:image\/|blob:|https?:|file:)/i.test(raw)) return `url("${raw.replace(/"/g, '\\"')}")`;
    return '';
  };

  const readStoredBackground = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  };

  const findImageValue = () => {
    const root = document.documentElement;
    const body = document.body;
    const stored = readStoredBackground();

    const values = [
      stored.value,
      stored.url,
      stored.image,
      root.style.getPropertyValue('--custom-page-bg-image'),
      root.style.getPropertyValue('--custom-page-bg-image-direct'),
      root.style.getPropertyValue('--mhp-stable-custom-bg'),
      body?.style?.getPropertyValue('--custom-page-bg-image')
    ];

    for (const value of values) {
      const converted = cssUrl(value);
      if (looksReal(converted)) return converted;
    }

    return '';
  };

  const currentPreset = () => {
    const stored = readStoredBackground();
    const raw =
      stored.preset ||
      document.body?.dataset?.backgroundPreset ||
      document.documentElement.dataset.backgroundPreset ||
      'default';

    const text = String(raw || 'default').toLowerCase();
    if (text.includes('purple')) return 'purple';
    if (text.includes('blue')) return 'blue';
    return 'default';
  };

  const extractSingleUrl = (cssImage) => {
    const raw = String(cssImage || '').trim();
    const match = raw.match(/^url\((.*)\)$/i);
    if (!match) return '';
    let value = String(match[1] || '').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value.replace(/\\"/g, '"');
  };

  const decodedBackgrounds = new Set();
  const pendingBackgrounds = new Map();

  const preloadBackgroundImage = (cssImage) => {
    const src = extractSingleUrl(cssImage);
    if (!src || src.startsWith('blob:')) return Promise.resolve(true);
    if (decodedBackgrounds.has(src)) return Promise.resolve(true);
    if (pendingBackgrounds.has(src)) return pendingBackgrounds.get(src);

    const promise = new Promise(resolve => {
      const img = new Image();
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingBackgrounds.delete(src);
        if (ok) decodedBackgrounds.add(src);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 12000);
      img.onload = async () => {
        try {
          if (typeof img.decode === 'function') await img.decode();
        } catch (_) {}
        finish(true);
      };
      img.onerror = () => finish(false);
      img.src = src;
    });

    pendingBackgrounds.set(src, promise);
    return promise;
  };

  let lastAppliedImage = '';
  let backgroundSwapToken = 0;

  const applyBackgroundLayer = () => {
    const root = document.documentElement;
    const body = document.body;
    const layer = document.getElementById('mhpPageBackground');
    const imageLayer = layer?.querySelector?.('.mhp-page-background-image');
    if (!layer || !imageLayer || !body) return;

    const stored = readStoredBackground();
    const image = findImageValue();
    const opacity = stored.opacity ?? root.style.getPropertyValue('--custom-page-bg-opacity') ?? '.35';
    const blur = stored.blur ?? root.style.getPropertyValue('--custom-page-bg-blur') ?? '0px';
    const bleed = stored.bleed ?? root.style.getPropertyValue('--custom-page-bg-bleed') ?? '24px';
    const preset = currentPreset();

    root.dataset.backgroundPreset = preset;
    body.dataset.backgroundPreset = preset;
    layer.dataset.backgroundPreset = preset;

    layer.style.setProperty('--mhp-real-bg-opacity', String(opacity).includes('.') ? String(opacity) : String(Number(opacity) / 100 || .35));
    layer.style.setProperty('--mhp-real-bg-blur', String(blur).match(/px|rem|em|%$/) ? String(blur) : `${Number(blur) || 0}px`);
    layer.style.setProperty('--mhp-real-bg-bleed', String(bleed).match(/px|rem|em|%$/) ? String(bleed) : `${Number(bleed) || 24}px`);

    if (looksReal(image)) {
      root.classList.add('has-custom-page-bg', 'mhp-real-bg-active', 'mhp-stable-bg-ready');
      body.classList.add('has-custom-page-bg', 'mhp-real-bg-active');
      layer.classList.add('has-image');

      root.style.setProperty('--custom-page-bg-image', image);
      root.style.setProperty('--custom-page-bg-image-direct', image);
      root.style.setProperty('--mhp-stable-custom-bg', image);

      if (image === lastAppliedImage || imageLayer.style.backgroundImage === image) {
        lastAppliedImage = image;
        layer.classList.remove('is-swapping-image');
        return;
      }

      const token = ++backgroundSwapToken;
      layer.classList.add('is-swapping-image');
      preloadBackgroundImage(image).then(() => {
        if (token !== backgroundSwapToken) return;
        imageLayer.style.backgroundImage = image;
        lastAppliedImage = image;
        layer.classList.remove('is-swapping-image');
      });
      return;
    }

    backgroundSwapToken += 1;
    lastAppliedImage = '';
    imageLayer.style.backgroundImage = 'none';
    root.style.setProperty('--custom-page-bg-image', 'none');
    root.style.setProperty('--custom-page-bg-image-direct', 'none');
    root.style.setProperty('--mhp-stable-custom-bg', 'none');
    root.classList.remove('has-custom-page-bg', 'mhp-real-bg-active', 'mhp-stable-bg-ready');
    body.classList.remove('has-custom-page-bg', 'mhp-real-bg-active');
    layer.classList.remove('has-image', 'is-swapping-image');
  };

  const schedule = () => requestAnimationFrame(applyBackgroundLayer);

  window.MHPApplyRealBackgroundLayer = applyBackgroundLayer;

  // Do not repaint on scroll/focus. Only react to actual settings changes.
  document.addEventListener('change', (event) => {
    if (event.target?.closest?.('#graphicsSettingsPanel, .settings-background-row')) schedule();
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target?.closest?.('#graphicsSettingsPanel, .settings-background-row')) schedule();
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('.settings-preset-btn, [data-bg-preset], [data-background-preset], #backgroundClearBtn, #backgroundRemoveBtn')) {
      setTimeout(applyBackgroundLayer, 0);
      setTimeout(applyBackgroundLayer, 120);
    }
  }, true);

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) schedule();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBackgroundLayer, { once: true });
  } else {
    applyBackgroundLayer();
  }

  window.addEventListener('load', applyBackgroundLayer, { once: true });
})();


// v2.453: external-safe fallback for edit delete button.
// This block never references the internal IIFE function directly.
(() => {
  if (window.__mhpEditDeleteExternalSafeFallbackInstalled) return;
  window.__mhpEditDeleteExternalSafeFallbackInstalled = true;

  document.addEventListener('click', (event) => {
    const btn = event.target?.closest?.('#deleteEditCharacterBtn');
    if (!btn) return;
    if (typeof window.MHPDeleteActiveCharacterFromEdit !== 'function') return;

    event.preventDefault();
    event.stopPropagation();
    window.MHPDeleteActiveCharacterFromEdit();
  }, true);
})();


// v2.466 stopper removed: restored known-good edit/gallery close flow.








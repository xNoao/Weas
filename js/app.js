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
    galleryIgnoreGlobalTagSearch: false,
    lastGalleryItems: [],
    loadingOverlayTimer: null,
    filter: {
      q: '',
      floatingQ: '',
      type: 'all'
    },
    searchTimer: null,
    searchCacheVersion: 0,
    searchTermCache: null,
    lastBoardFilterCache: null,
    renderScheduler: { boardTimer: 0, allTimer: 0, lastReason: '', lastBoardAt: 0, lastAllAt: 0 },
    searchMinChars: 2,
    searchClearAnchorId: null,
    searchClearAnchorTop: null,
    searchSessionOriginScrollY: null,
    searchSessionOriginAnchor: null,
    searchSessionOriginStartedAt: 0,
    ctrlFSearchOriginScrollY: null,
    ctrlFSearchOriginAnchor: null,
    ctrlFSearchOriginStartedAt: 0,
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
    },
    statsRenderSignature: ''
  };
  window.app = app;


  const els = {};
  let searchMoveSession = null;

  function initEls() {
    [
      'haremTitle','appLoadingOverlay','appLoadingTitle','appLoadingDetail','jsonFileInput','exportJsonBtn','clearLocalBtn','searchInput','clearSearchBtn','floatingBar','floatingSearchInput','floatingClearSearchBtn','floatingBackTopBtn','filterTypeSelect',
      'restoreAllBtn','globalGalleryCheckBtn','galleryTagsIndexBtn','floatingMultiSelectBtn','floatingMoveSelectedBtn','floatingCreateGroupBtn','floatingClearMultiSelectBtn','floatingAddDividerBtn','floatingAddSubDividerBtn','parserDetails','parserInput','parseReplaceBtn','parseAppendBtn','clearParserBtn','parserStatus','parserCount','statsBar','board','editOverlay','editModal','editBody','editTitle','editSubtitle',
      'editCloseBtn','editForm','editIdInput','editNameInput','editSeriesInput','editImageInput',
      'editRankInput','editKakeraInput','editKeysInput','editOwnerInput','editRouletteInput',
      'editColorInput','editColorPalettePanel','editColorPaletteGrid','editColorPaletteCloseBtn','editColorPreviewBtn','editColorPreviewSwatch','editColorPreviewText','editNoteInput','spheresGrid','mudaeSearchBtn',
      'galleryToggleBtn','saveEditBtn','deleteEditCharacterBtn','cancelEditBtn','editPreviewImg','editPreviewIndexBadge','galleryPanel',
      'galleryStatus','galleryCloseBtn','galleryTagSearchInput','galleryTagClearBtn','galleryTagFilterInfo','loadPastedBtn','addCustomGalleryBtn','galleryMatchedOnlyBtn','galleryUseMatchedBtn','clearGalleryBtn','clearOfficialGalleryBtn','clearCustomGalleryBtn',
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

  function getStateLookupCache() {
    const items = app.state.characters || [];
    const firstId = items[0]?.id || '';
    const lastId = items[items.length - 1]?.id || '';
    const version = `${items.length}|${firstId}|${lastId}|${app.searchCacheVersion || 0}`;

    if (app.stateLookupCache?.version === version) return app.stateLookupCache;

    const byId = new Map();
    const rawIndexById = new Map();
    const charById = new Map();
    const charRawIndexById = new Map();

    items.forEach((item, index) => {
      if (!item?.id) return;
      byId.set(item.id, item);
      rawIndexById.set(item.id, index);
      if (!isDivider(item)) {
        charById.set(item.id, item);
        charRawIndexById.set(item.id, index);
      }
    });

    app.stateLookupCache = { version, byId, rawIndexById, charById, charRawIndexById };
    return app.stateLookupCache;
  }

  function invalidateStateLookupCache() {
    app.stateLookupCache = null;
  }

  function getCharacter(id) {
    if (!id) return null;

    const cached = getStateLookupCache().charById.get(id);
    if (cached && !isDivider(cached) && cached.id === id) return cached;

    // Safety fallback for very recent direct mutations before a cache invalidation.
    invalidateStateLookupCache();
    return (app.state.characters || []).find(item => !isDivider(item) && item.id === id) || null;
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

  const GROUP_NAMING_MODE_KEY = 'mudae.groupNamingMode.v1';

  function getGroupNamingMode() {
    try {
      return localStorage.getItem(GROUP_NAMING_MODE_KEY) === 'manual' ? 'manual' : 'automatic';
    } catch (error) {
      return 'automatic';
    }
  }

  function setGroupNamingMode(mode) {
    const nextMode = String(mode || '').toLowerCase() === 'manual' ? 'manual' : 'automatic';
    try {
      localStorage.setItem(GROUP_NAMING_MODE_KEY, nextMode);
    } catch (error) {
      // ignore storage failures
    }
    window.dispatchEvent(new CustomEvent('mudae:group-naming-mode-change', {
      detail: { mode: nextMode }
    }));
    return nextMode;
  }

  function isManualGroupNamingEnabled() {
    return getGroupNamingMode() === 'manual';
  }

  function maybePromptNewGroupName(groupId) {
    if (!groupId || !isManualGroupNamingEnabled()) return;
    setTimeout(() => {
      promptRenameGroup(groupId, { syncEdit: false });
    }, 80);
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
    notifyAppMessage(`${character?.name || 'Character'} Set As Lead For ${group?.name || 'Group'}.`);
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
      notifyAppMessage(`Saved Order For ${group?.name || 'Group'}.`);
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
    const raw = await showAppPrompt('Rename Group:', currentName, {
      title: 'Rename Group',
      okText: 'Rename',
      cancelText: 'Cancel'
    });

    if (raw == null) return false;

    const nextName = str(raw).trim();
    if (!nextName) {
      showAppAlert('Group Name Cannot Be Empty.', { title: 'Invalid Group Name', variant: 'danger' });
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

    notifyAppMessage(removeWholeGroup ? `Group ${groupName} removed.` : `${targets.length} Characters Removed From ${groupName}.`);
    return true;
  }

  function addSelectedCharactersToExistingGroup(action = null) {
    const selectedAction = action || getSelectedGroupAction();
    const groupId = selectedAction.groupId;
    if (!groupId) return false;

    const addItems = (selectedAction.addItems || []).filter(item => item && !isDivider(item) && !getCharacterGroupId(item));
    if (!addItems.length) {
      notifyAppMessage('Select Ungrouped Characters To Add To The Group.');
      return false;
    }

    if (selectedAction.disabled) {
      notifyAppMessage('Select A Full Existing Group Before Adding New Characters.');
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
      notifyAppMessage('Select At Least 2 Characters To Create A Group.');
      return false;
    }

    const selectedItems = getCurrentSelectedCharacterItems();

    if (selectedItems.length < 2) {
      notifyAppMessage('Select At Least 2 Valid Characters To Create A Group.');
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
      notifyAppMessage('Select Characters From Only One Group At A Time.');
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

    notifyAppMessage(`Group ${name} created with ${selectedItems.length} Characters And Gathered Together.`);
    maybePromptNewGroupName(groupId);
    return true;
  }


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

  function beginHeavyUiLoad(message = 'Loading Harem...', detail = 'Preparing Characters And Images.') {
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
  function clearStaleHeavyLoadingState(reason = 'stale-heavy-loading') {
    const root = document.documentElement;
    const body = document.body;
    const overlay = document.getElementById('appLoadingOverlay') || document.querySelector('.app-loading-overlay');
    const overlayVisible = !!(overlay && !overlay.hidden && overlay.getAttribute('aria-hidden') !== 'true');
    if (overlayVisible) return false;

    if (root?.classList?.contains('mhp-heavy-loading') || body?.classList?.contains('mhp-heavy-loading')) {
      root.classList.remove('mhp-heavy-loading', 'mhp-stabilize-bg');
      body?.classList?.remove('mhp-heavy-loading', 'mhp-stabilize-bg');
      return true;
    }

    return false;
  }

  function installHeavyLoadingSafetyGuard() {
    if (window.__mhpHeavyLoadingSafetyGuardInstalled) return;
    window.__mhpHeavyLoadingSafetyGuardInstalled = true;

    const scheduleCleanup = (reason) => {
      requestAnimationFrame(() => clearStaleHeavyLoadingState(reason));
      setTimeout(() => clearStaleHeavyLoadingState(reason), 250);
      setTimeout(() => clearStaleHeavyLoadingState(reason), 1200);
    };

    window.addEventListener('focus', () => scheduleCleanup('window-focus'), true);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleCleanup('visibility-return');
    }, true);
    window.addEventListener('pageshow', () => scheduleCleanup('pageshow'), true);

  }

  installHeavyLoadingSafetyGuard();


  async function normalizeCharactersInChunks(items, options = {}) {
    if (!Array.isArray(items)) return items;

    const chunkSize = Number(options.chunkSize || 250);
    const total = items.length;
    const bytes = Number(options.bytes || 0);
    const title = options.title || 'Loading Harem...';
    const detail = options.detail || 'Preparing Characters And Images.';
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

  function scheduleBoardRender(reason = 'board', options = {}) {
    const delay = Math.max(0, Number(options.delay ?? 32) || 0);
    const scheduler = app.renderScheduler || (app.renderScheduler = {});

    scheduler.lastReason = reason;
    if (scheduler.boardTimer) clearTimeout(scheduler.boardTimer);

    scheduler.boardTimer = setTimeout(() => {
      scheduler.boardTimer = 0;
      scheduler.lastBoardAt = Date.now();

      const queryBefore = String(app.filter?.q || '').trim();
      const reasonText = String(reason || '');
      const preserveActiveSearchScroll = options.preserveSearchScroll !== false
        && !!queryBefore
        && /search/i.test(reasonText)
        && !/clear|enter|jump|restore-full/i.test(reasonText);
      const anchorBefore = preserveActiveSearchScroll ? captureBoardVisualAnchor?.() : null;
      const scrollBefore = preserveActiveSearchScroll
        ? Math.max(0, window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0)
        : null;

      renderBoard();

      if (preserveActiveSearchScroll) {
        const restoreIfStillSameSearch = () => {
          const queryAfter = String(app.filter?.q || '').trim();
          if (!queryAfter || queryAfter !== queryBefore) return;

          if (anchorBefore?.id) {
            restoreBoardVisualAnchor(anchorBefore, { attempts: 4, highlight: false });
            return;
          }

          if (Number.isFinite(scrollBefore)) {
            window.scrollTo({ top: scrollBefore, behavior: 'auto' });
          }
        };

        requestAnimationFrame(restoreIfStillSameSearch);
        setTimeout(restoreIfStillSameSearch, 90);
      }
    }, delay);
  }

  function scheduleRenderAll(reason = 'render-all', options = {}) {
    const delay = Math.max(0, Number(options.delay ?? 32) || 0);
    const scheduler = app.renderScheduler || (app.renderScheduler = {});

    scheduler.lastReason = reason;
    if (scheduler.allTimer) clearTimeout(scheduler.allTimer);

    scheduler.allTimer = setTimeout(() => {
      scheduler.allTimer = 0;
      scheduler.lastAllAt = Date.now();
      renderAll(options.renderOptions || {});
    }, delay);
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
      if (window.MudaeRebuildStorage?.getLocalRawSync) {
        return window.MudaeRebuildStorage.getLocalRawSync(STORAGE_KEY) || '';
      }
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  async function getLocalStateRawAsync() {
    try {
      if (window.MudaeRebuildStorage?.getLocalRaw) {
        return await window.MudaeRebuildStorage.getLocalRaw(STORAGE_KEY);
      }
      return getLocalStateRaw();
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

    if (!options.galleryCheck) {
      detailNode?.classList?.remove('is-gallery-check-detail');
      dataNode?.classList?.remove('is-gallery-check-data');
    }

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
        title: options.title || 'Loading Harem...',
        detail: 'Restoring Saved Characters...',
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
    const raw = await getLocalStateRawAsync();
    if (!raw) return false;

    const isHeavy = raw.length > 180000;
    app.localLoadWasHeavy = isHeavy;

    try {
      document.documentElement.classList.add('mhp-stabilize-bg');
      document.body?.classList?.add('mhp-stabilize-bg');

      if (isHeavy) {
        beginHeavyUiLoad('Loading Harem...', 'Reading Saved Local Data.');
        updateSharedLoader({ title: 'Loading Harem...', detail: 'Reading Saved Local Data.', bytes: raw.length });
        await yieldToUi('local-storage-before-parse');
      }

      const parsed = JSON.parse(raw);
      if (isHeavy) {
        updateSharedLoader({ title: 'Loading Harem...', detail: 'Preparing Saved State...', bytes: raw.length });
        await idleSlice(80);
      }

      const payload = coerceImportedJsonPayload(parsed);
      if (!payload.state || typeof payload.state !== 'object') payload.state = { characters: [] };
      if (!Array.isArray(payload.state.characters)) payload.state.characters = [];

      payload.state.characters = isHeavy
        ? await normalizeImportedCharactersCooperative(payload.state.characters, { chunkSize: 180, bytes: raw.length, title: 'Loading Harem...' })
        : payload.state.characters.map((item, index) => normalizeLegacyImportedCharacter(item, index)).filter(Boolean);

      app.originalInput = payload.input || '';
      app.meta = payload.meta || {};
      app.state = payload.state;
      ensureLoadedStateShape();

      if (isHeavy) {
        updateSharedLoader({ title: 'Loading Harem...', detail: 'Restoring Groups And Saved View...', loaded: payload.state.characters.length, total: payload.state.characters.length, bytes: raw.length });
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
      showAppAlert('Could Not Save JSON: ' + (error?.message || error), {
        title: 'Save JSON Failed',
        variant: 'danger'
      });
    }
  }


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

  function createImportFallbackId(prefix = 'item', index = 0) {
    const safePrefix = String(prefix || 'item').replace(/[^a-z0-9_-]/gi, '') || 'item';

    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${safePrefix}-${window.crypto.randomUUID()}`;
      }
    } catch {}

    return `${safePrefix}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
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
        id: item.id || item.uid || createImportFallbackId('divider', index)
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
      id: item.id || item.uid || item.characterId || item.key || createImportFallbackId('char', index),
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
      customImages: dedupeCustomImageUrls([...(Array.isArray(item.customImages) ? item.customImages : []), ...(Array.isArray(item.customGallery) ? item.customGallery : [])]),
      customImageMeta: item.customImageMeta && typeof item.customImageMeta === 'object' ? item.customImageMeta : {},
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

    // Legacy compact rehydration hook removed: current imports are normalized
    // directly through normalizeLegacyImportedCharacter/ensureLoadedStateShape.
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
    updateSharedLoader({ title: 'Loading JSON...', detail: 'Importing Characters And Preparing Images.', loaded: 0, total: importCount, bytes: file?.size || 0, json: true });
    app.originalInput = payload.input || '';
    app.meta = payload.meta || {};
    app.state = payload.state;
    ensureLoadedStateShape();
    await normalizeCharactersInChunks(app.state.characters, { chunkSize: 300, bytes: file?.size || 0, title: 'Loading JSON...', detail: 'Importing Characters And Preparing Images.', json: true });
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
        notifyAppMessage?.(`Loaded JSON: ${file.name || 'Dropped File'}`);
      } catch (error) {
        console.error(error);
        showAppAlert('Could not import dropped JSON: ' + (error?.message || error), {
          title: 'Import Failed',
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
      card.title = app.expandedStats[key] ? 'Click To Collapse Details' : 'Click To Expand Details';
    });
  }

  function hasExpandedStatsBreakdown() {
    return !!Object.values(app.expandedStats || {}).some(Boolean);
  }

  function closeExpandedStatsBreakdowns() {
    if (!hasExpandedStatsBreakdown()) return false;
    Object.keys(app.expandedStats).forEach(key => {
      app.expandedStats[key] = false;
    });
    updateStatsBar();
    return true;
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

      const oldGalleryUrlSet = new Set(normalizeUrls(old.mudaeImages));
      normalizeUrls(item.mudaeImages).forEach(url => {
        if (oldGalleryUrlSet.has(url)) {
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

  function showAppLoading(title = 'Loading Harem...', detail = 'Preparing Characters And Images.') {
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
        if (bootTitle) bootTitle.textContent = title || 'Loading Harem...';
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
          title: 'Loading Harem...',
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
          title: 'Loading Harem...',
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


  function setNodeTextIfChanged(node, value) {
    if (!node) return;
    const text = String(value == null ? '' : value);
    if (node.textContent !== text) node.textContent = text;
  }

  function setNodeHtmlIfChanged(node, value) {
    if (!node) return;
    const html = String(value == null ? '' : value);
    if (node.innerHTML !== html) node.innerHTML = html;
  }

  function setTitleIfChanged(node, value) {
    if (!node) return;
    const title = String(value == null ? '' : value);
    if (node.title !== title) node.title = title;
  }

  function updateStatsBar() {
    const characters = app.state.characters.filter(item => !isDivider(item));
    const keyBreakdown = getKeyBreakdown(characters);
    const charBreakdown = getCharacterBreakdowns(characters);
    const totalSpheres = characters.reduce((sum, ch) => sum + getSphereTotal(ch.spheres), 0);

    const avgKakera = characters.length ? Math.round(num(app.state.totalValue) / characters.length) : 0;
    const topKakera = getTopKakeraCharacter(characters);
    const sphereBreakdownData = getSpherePerkBreakdown(characters);

    const boardCounts = app.state.boardCounts || {};
    const topKakeraId = topKakera ? topKakera.id : '';
    const statsSignature = [
      characters.length,
      boardCounts.characters || characters.length,
      boardCounts.dividers || 0,
      boardCounts.subdividers || 0,
      keyBreakdown.total,
      keyBreakdown.bronze,
      keyBreakdown.silver,
      keyBreakdown.gold,
      keyBreakdown.chaos,
      app.state.totalValue,
      totalSpheres,
      avgKakera,
      topKakeraId,
      topKakera ? topKakera.name : '',
      topKakera ? topKakera.kakera : 0,
      sphereBreakdownData.max,
      [10,9,8,7,6,5,4,3,2,1].map(p => sphereBreakdownData.perks[p] || 0).join(','),
      charBreakdown.gender.waifu,
      charBreakdown.gender.husbando,
      charBreakdown.gender.both,
      charBreakdown.roulette.animanga,
      charBreakdown.roulette.game,
      charBreakdown.roulette.both,
      str(app.state.haremName).trim(),
      ['characters','keys','kakera','spheres'].map(key => app.expandedStats?.[key] ? 1 : 0).join(',')
    ].join('|');

    if (app.statsRenderSignature === statsSignature) {
      return;
    }
    app.statsRenderSignature = statsSignature;

    setNodeTextIfChanged(els.statsBar.children[0].querySelector('strong'), fmt(characters.length));
    setTitleIfChanged(els.statsBar.children[0], `Characters: ${fmt(boardCounts.characters || characters.length)} · Dividers: ${fmt(boardCounts.dividers || 0)} · Sub-Dividers: ${fmt(boardCounts.subdividers || 0)}`);
    setNodeTextIfChanged(els.statsBar.children[1].querySelector('strong'), fmt(keyBreakdown.total));
    setNodeTextIfChanged(els.statsBar.children[2].querySelector('strong'), fmt(app.state.totalValue));
    setNodeTextIfChanged(els.statsBar.children[3].querySelector('strong'), fmt(totalSpheres));

    const kakeraBreakdown = document.getElementById('kakeraBreakdown');
    if (kakeraBreakdown) {
      setNodeHtmlIfChanged(kakeraBreakdown, `
        <div class="stat-detail-row">
          <span>Avg Value</span>
          <b>${fmt(avgKakera)} ka</b>
        </div>
        <button class="top-character-link" type="button" title="Filter Search To This Character" data-character-id="${topKakera ? topKakera.id : ''}" ${topKakera ? '' : 'disabled'}>
          <span>Top</span>
          <b>${topKakera ? escapeHtml(topKakera.name) : '—'}</b>
          <em>${topKakera ? fmt(topKakera.kakera) + ' ka' : ''}</em>
        </button>
      `);
    }

    const sphereBreakdown = document.getElementById('sphereBreakdown');
    if (sphereBreakdown) {
      const perks = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
        .filter(p => sphereBreakdownData.perks[p] > 0)
        .slice(0, 6);

      setNodeHtmlIfChanged(sphereBreakdown, `
        <div class="sphere-max-line"><span>SP MAX</span><b>${fmt(sphereBreakdownData.max)}</b></div>
        <div class="sphere-perk-grid">
          ${perks.map(p => `<span class="sphere-perk-chip"><b>P${p}</b>${fmt(sphereBreakdownData.perks[p])}</span>`).join('')}
        </div>
      `);
    }

    const boardStructureEl = document.getElementById('boardStructureBreakdown');
    if (boardStructureEl) {
      const counts = app.state.boardCounts || {};
      setNodeHtmlIfChanged(boardStructureEl, `
        <span class="breakdown-label">Board</span>
        <span class="mini-breakdown-item board-character-count" title="Real Characters"><b>Chars</b>${fmt(counts.characters || characters.length)}</span>
        <span class="mini-breakdown-item board-divider-count" title="Top-Level Dividers"><b>Div</b>${fmt(counts.dividers || 0)}</span>
        <span class="mini-breakdown-item board-subdivider-count" title="Sub-Dividers"><b>Sub</b>${fmt(counts.subdividers || 0)}</span>
      `);
    }

    const genderEl = document.getElementById('genderBreakdown');
    if (genderEl) {
      setNodeHtmlIfChanged(genderEl, `<span class="breakdown-label">Gender</span>` + ['waifu', 'husbando', 'both'].map(type => {
        const value = charBreakdown.gender[type];
        return `<span class="mini-breakdown-item gender-${type}" title="${genderLabel(type)}">
          <b>${genderShortLabel(type)}</b><span>${fmt(value)}</span>
        </span>`;
      }).join(''));
    }

    const rouletteEl = document.getElementById('rouletteBreakdown');
    if (rouletteEl) {
      setNodeHtmlIfChanged(rouletteEl, `<span class="breakdown-label">Type</span>` + ['animanga', 'game', 'both'].map(type => {
        const value = charBreakdown.roulette[type];
        return `<span class="mini-breakdown-item roulette-${type}" title="${rouletteWorldLabel(type)}">
          <b>${rouletteWorldShortLabel(type)}</b><span>${fmt(value)}</span>
        </span>`;
      }).join(''));
    }

    const breakdownEl = document.getElementById('keyBreakdown');
    if (breakdownEl) {
      setNodeHtmlIfChanged(breakdownEl, ['bronze', 'silver', 'gold', 'chaos'].map(type => {
        const value = keyBreakdown[type];
        return `<span class="key-breakdown-item ${type}" title="${getKeyLabel(type)} Keys">
          <img src="${KEY_ICONS[type]}" alt="${getKeyLabel(type)} Key" onerror="this.remove()">
          <b>${fmt(value)}</b>
        </span>`;
      }).join(''));
    }

    applyStatsExpansionClasses();

    const displayHaremName = str(app.state.haremName).trim();
    setNodeTextIfChanged(els.haremTitle, displayHaremName
      ? `${displayHaremName} · ${fmt(characters.length)} Characters · ${fmt(keyBreakdown.total)} Keys · ${fmt(app.state.totalValue)} ka · ${fmt(totalSpheres)} SP`
      : `${fmt(characters.length)} Characters · ${fmt(keyBreakdown.total)} Keys · ${fmt(app.state.totalValue)} ka · ${fmt(totalSpheres)} SP`);

    const nextTitle = displayHaremName || 'Mudae Harem Organizer Final';
    if (document.title !== nextTitle) document.title = nextTitle;

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
      if (field === 'tags' || field === 'imagetag' || field === 'imagetags' || field === 'gallerytag' || field === 'gallerytags') field = 'tag';
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

  function getSearchTermObjects(query = getActiveSearchQuery()) {
    const rawQuery = String(query || '');
    const cacheKey = `${rawQuery}::${app.searchMinChars}`;

    if (app.searchTermCache?.key === cacheKey) {
      return app.searchTermCache.objects;
    }

    const objects = parseSearchTokens(rawQuery)
      .map(parseSearchTerm)
      .filter(item => {
        if (!item.value) return false;
        if (item.field && item.field.startsWith('gender')) return true;
        return item.value.length >= app.searchMinChars;
      });

    app.searchTermCache = {
      key: cacheKey,
      objects,
      terms: objects.map(item => item.term)
    };

    return objects;
  }

  function getSearchTerms(query = getActiveSearchQuery()) {
    const rawQuery = String(query || '');
    const cacheKey = `${rawQuery}::${app.searchMinChars}`;
    if (app.searchTermCache?.key === cacheKey) return app.searchTermCache.terms;
    return getSearchTermObjects(rawQuery).map(item => item.term);
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

  function cleanGalleryTagFragment(value) {
    return String(value || '')
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .trim()
      // Saved data from older copier builds could contain JSON-array fragments
      // such as ["Animal Headwear" or "Bowtie"]. Strip only wrapper syntax
      // so the visual tag chip and the search key both collapse to one label.
      .replace(/^[\s\[\]"']+/g, '')
      .replace(/[\s\[\]"']+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getGalleryTagKey(value) {
    return normalizeSearchText(cleanGalleryTagFragment(value));
  }

  function normalizeGalleryTagLabel(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value || '').trim();
      if (!text) return '';
      // Older bridge builds could save a whole JSON array as one text tag,
      // e.g. ["Transformation Sequence"]. For single-label callers, unwrap
      // the first valid label so search suggestions do not show the raw array.
      if (/^\s*\[/.test(text)) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            const first = parsed.map(normalizeGalleryTagLabel).find(Boolean);
            if (first) return first;
          }
        } catch (_) {}
      }
      return cleanGalleryTagFragment(text);
    }
    if (typeof value === 'object') {
      return cleanGalleryTagFragment(
        value.label || value.name || value.tag || value.title || value.value || value.text || ''
      );
    }
    return '';
  }

  function expandGalleryTagLabels(value) {
    const out = [];
    const push = label => {
      const normalized = normalizeGalleryTagLabel(label);
      if (normalized) out.push(normalized);
    };

    if (value === null || value === undefined) return out;

    if (Array.isArray(value)) {
      value.forEach(entry => expandGalleryTagLabels(entry).forEach(push));
      return out;
    }

    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return out;
      if (/^\s*\[/.test(text)) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            parsed.forEach(entry => expandGalleryTagLabels(entry).forEach(push));
            return out;
          }
        } catch (_) {}
      }
      // If the string is a malformed/partial JSON-like array, remove wrapper
      // brackets before splitting. This prevents chips like ["Tag" and "Tag"].
      text.replace(/^[\s\[]+|[\s\]]+$/g, '').split(/[,;|]/g).forEach(push);
      return out;
    }

    push(value);
    return out;
  }

  function normalizeGalleryTagList(value) {
    const seen = new Set();
    const out = [];
    expandGalleryTagLabels(value).forEach(tag => {
      const key = getGalleryTagKey(tag);
      if (!key || seen.has(key)) return;
      const label = normalizeGalleryTagLabel(tag);
      if (!label) return;
      seen.add(key);
      out.push(label);
    });
    return out;
  }

  function collectGalleryTagsFromMetaMap(metaMap) {
    const tags = [];
    if (!metaMap || typeof metaMap !== 'object') return tags;

    Object.values(metaMap).forEach(meta => {
      if (!meta || typeof meta !== 'object') return;
      normalizeGalleryTagList(meta.tags).forEach(tag => tags.push(tag));
    });

    return tags;
  }

  function getCharacterGalleryTags(item) {
    if (!item || isDivider(item)) return [];
    const seen = new Set();
    const out = [];

    [
      ...collectGalleryTagsFromMetaMap(item.mudaeImageMeta),
      ...collectGalleryTagsFromMetaMap(item.customImageMeta)
    ].forEach(tag => {
      normalizeGalleryTagList(tag).forEach(label => {
        const key = getGalleryTagKey(label);
        if (!key || seen.has(key)) return;
        const cleanLabel = normalizeGalleryTagLabel(label);
        if (!cleanLabel) return;
        seen.add(key);
        out.push(cleanLabel);
      });
    });

    return out;
  }

  function getCharacterGalleryTagIndex(item) {
    const tags = getCharacterGalleryTags(item);
    return {
      raw: tags,
      normalized: tags.map(tag => normalizeSearchText(tag)).filter(Boolean),
      haystack: normalizeSearchText(tags.join(' '))
    };
  }

  function itemMatchesGalleryTagSearch(item, search) {
    if (!item || isDivider(item)) return false;
    const tagIndex = getCachedSearchIndex(item).galleryTags || getCharacterGalleryTagIndex(item);
    if (search.exact) return tagIndex.normalized.includes(search.value);
    return tagIndex.haystack.includes(search.value);
  }

  function getGalleryItemTagLabels(item) {
    const seen = new Set();
    const out = [];
    normalizeGalleryTagList(item?.tags).forEach(label => {
      const key = getGalleryTagKey(label);
      if (!key || seen.has(key)) return;
      const cleanLabel = normalizeGalleryTagLabel(label);
      if (!cleanLabel) return;
      seen.add(key);
      out.push(cleanLabel);
    });
    return out;
  }

  function getGalleryItemTagIndex(item) {
    const tags = getGalleryItemTagLabels(item);
    return {
      raw: tags,
      normalized: tags.map(tag => normalizeSearchText(tag)).filter(Boolean),
      haystack: normalizeSearchText(tags.join(' '))
    };
  }

  function galleryItemMatchesTagSearch(item, search) {
    if (!item || !search?.value) return false;
    const tagIndex = getGalleryItemTagIndex(item);
    if (search.exact) return tagIndex.normalized.includes(search.value);
    return tagIndex.haystack.includes(search.value);
  }


  function collectGalleryTagIndexRows() {
    const stats = new Map();
    const addTag = (tag, character, source, imageKey) => {
      const label = normalizeGalleryTagLabel(tag);
      const key = getGalleryTagKey(label);
      if (!key || !label) return;

      let row = stats.get(key);
      if (!row) {
        row = { key, label, images: 0, imageKeys: new Set() };
        stats.set(key, row);
      }

      const uniqueImageKey = `${character?.id || character?.name || 'unknown'}::${source || 'gallery'}::${imageKey || row.imageKeys.size}`;
      if (row.imageKeys.has(uniqueImageKey)) return;
      row.imageKeys.add(uniqueImageKey);
      row.images += 1;
    };

    const scanMetaMap = (character, metaMap, source) => {
      if (!metaMap || typeof metaMap !== 'object') return;
      Object.entries(metaMap).forEach(([imageKey, meta]) => {
        if (!meta || typeof meta !== 'object') return;
        normalizeGalleryTagList(meta.tags).forEach(tag => addTag(tag, character, source, imageKey));
      });
    };

    (app.state.characters || []).forEach(character => {
      if (!character || isDivider(character)) return;
      scanMetaMap(character, character.mudaeImageMeta, 'official');
      scanMetaMap(character, character.customImageMeta, 'custom');
    });

    return Array.from(stats.values())
      .map(row => ({ key: row.key, label: row.label, images: row.images }))
      .sort((a, b) => (b.images - a.images) || a.label.localeCompare(b.label));
  }

  function applyGalleryTagIndexSearch(tag) {
    const clean = String(tag || '').trim();
    if (!clean) return;

    // Applying a tag from the index is a completed action, not a typing session.
    // Keep autocomplete closed so the command suggestion does not remain pinned
    // under the search bar after the modal closes. It will reopen normally on
    // the next real key/input event.
    app.searchSuggestionsSuppressUntilInput = true;
    hideSearchSuggestions({ force: true, immediate: true });

    setUnifiedSearchValue(`tag:"${clean.replace(/"/g, '\\"')}"`);
    scheduleBoardRender?.('gallery-tag-index-search', { delay: 0 });
    window.MudaeDialogUtils?.close?.(true);

    requestAnimationFrame(() => {
      hideSearchSuggestions({ force: true, immediate: true });
      const target = els.searchInput || els.floatingSearchInput;
      target?.focus?.({ preventScroll: true });
      target?.setSelectionRange?.(target.value.length, target.value.length);
      requestAnimationFrame(() => hideSearchSuggestions({ force: true, immediate: true }));
    });
  }

  function showGalleryTagsIndexDialog() {
    const rows = collectGalleryTagIndexRows();
    const totalImages = rows.reduce((sum, row) => sum + (row.images || 0), 0);

    return showAppDialog({
      type: 'alert',
      title: 'Gallery Tags',
      dialogClass: 'mhp-gallery-tags-index-dialog',
      message: rows.length
        ? `${fmt(rows.length)} tag(s) · ${fmt(totalImages)} tagged image reference(s).`
        : 'No gallery tags saved yet.',
      okText: 'Close',
      renderContent(content) {
        const wrap = document.createElement('div');
        wrap.className = 'gallery-tags-index-panel';

        const tools = document.createElement('div');
        tools.className = 'gallery-tags-index-tools';

        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'gallery-tags-index-search';
        input.placeholder = 'Filter Tags...';
        input.autocomplete = 'off';
        input.spellcheck = false;

        const controls = document.createElement('div');
        controls.className = 'gallery-tags-index-controls';

        const sortLabel = document.createElement('span');
        sortLabel.className = 'gallery-tags-index-sort-label';
        sortLabel.textContent = 'Sort';

        const countSortBtn = document.createElement('button');
        countSortBtn.type = 'button';
        countSortBtn.className = 'gallery-tags-index-sort is-active';
        countSortBtn.textContent = 'Count';

        const nameSortBtn = document.createElement('button');
        nameSortBtn.type = 'button';
        nameSortBtn.className = 'gallery-tags-index-sort';
        nameSortBtn.textContent = 'Name';

        controls.append(sortLabel, countSortBtn, nameSortBtn);

        const count = document.createElement('span');
        count.className = 'gallery-tags-index-count';

        tools.append(input, controls, count);

        const list = document.createElement('div');
        list.className = 'gallery-tags-index-list';

        let sortMode = 'count';
        const setSortMode = mode => {
          sortMode = mode === 'name' ? 'name' : 'count';
          countSortBtn.classList.toggle('is-active', sortMode === 'count');
          nameSortBtn.classList.toggle('is-active', sortMode === 'name');
          renderRows();
        };

        const getSortedRows = inputRows => {
          const copy = inputRows.slice();
          if (sortMode === 'name') {
            return copy.sort((a, b) => a.label.localeCompare(b.label) || (b.images - a.images));
          }
          return copy.sort((a, b) => (b.images - a.images) || a.label.localeCompare(b.label));
        };

        const renderRows = () => {
          const filter = normalizeSearchText(input.value || '');
          const filtered = filter ? rows.filter(row => normalizeSearchText(row.label).includes(filter)) : rows;
          const visible = getSortedRows(filtered);
          count.textContent = `${fmt(visible.length)} / ${fmt(rows.length)}`;
          list.replaceChildren();

          if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'gallery-tags-index-empty';
            empty.textContent = rows.length ? 'No tags match this filter.' : 'No tags saved yet. Re-run Search Mudae on characters with tagged images.';
            list.appendChild(empty);
            return;
          }

          const fragment = document.createDocumentFragment();
          visible.forEach(row => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'gallery-tags-index-chip';
            item.title = `Search tag: ${row.label}`;
            item.innerHTML = `
              <span class="gallery-tags-index-chip-name">${escapeHtml(row.label)}</span>
              <span class="gallery-tags-index-chip-count">${escapeHtml(fmt(row.images))}</span>
            `;
            item.addEventListener('click', event => {
              event.preventDefault();
              applyGalleryTagIndexSearch(row.label);
            });
            fragment.appendChild(item);
          });
          list.appendChild(fragment);
        };

        input.addEventListener('input', renderRows);
        countSortBtn.addEventListener('click', () => setSortMode('count'));
        nameSortBtn.addEventListener('click', () => setSortMode('name'));
        wrap.append(tools, list);
        content.appendChild(wrap);
        renderRows();
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
      }
    });
  }

  function getActiveGalleryTagSearches(query = getActiveSearchQuery()) {
    return getSearchTermObjects(query).filter(search => search?.field === 'tag' && search.value);
  }

  function buildPlainGalleryTagSearch(value) {
    const raw = String(value || '').trim()
      .replace(/^tag:\s*/i, '')
      .replace(/^tags:\s*/i, '')
      .replace(/^imageTag:\s*/i, '')
      .replace(/^galleryTag:\s*/i, '');
    const clean = raw.replace(/^['"]+|['"]+$/g, '').trim();
    const normalized = normalizeSearchText(clean);
    if (!normalized) return null;
    return { field: 'tag', raw: clean, value: normalized, exact: false, source: 'gallery-local' };
  }

  function getGalleryLocalTagSearches() {
    const input = els.galleryTagSearchInput;
    const raw = String(input?.value || '').trim();
    if (!raw) return [];
    const explicit = getActiveGalleryTagSearches(raw);
    if (explicit.length) return explicit.map(search => ({ ...search, source: 'gallery-local' }));
    const plain = buildPlainGalleryTagSearch(raw);
    return plain ? [plain] : [];
  }

  function getGalleryTagSearchesForOpenGallery(query = getActiveSearchQuery()) {
    const local = getGalleryLocalTagSearches();
    if (local.length) return local;
    if (app.galleryIgnoreGlobalTagSearch) return [];
    return getActiveGalleryTagSearches(query).map(search => ({ ...search, source: 'global' }));
  }

  function hasActiveGalleryTagSearch(query = getActiveSearchQuery()) {
    return getGalleryTagSearchesForOpenGallery(query).length > 0;
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
    app.searchTermCache = null;
    app.lastBoardFilterCache = null;
    invalidateStateLookupCache?.();
  }

  function setRuntimeSearchCache(item, data) {
    Object.defineProperty(item, '__searchCache', {
      value: { version: app.searchCacheVersion, ...data },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  function getCachedSearchIndex(item) {
    if (!item) {
      return { haystack: '', name: '', series: '', owner: '', note: '', divider: '', galleryTags: { raw: [], normalized: [], haystack: '' } };
    }

    const cache = item.__searchCache;
    if (cache && cache.version === app.searchCacheVersion && cache.index) {
      return cache.index;
    }

    const index = isDivider(item)
      ? {
          haystack: dividerSearchHaystack(item),
          name: '',
          series: '',
          owner: '',
          note: normalizeSearchText(item.note || ''),
          divider: normalizeSearchText(item.title || '')
        }
      : {
          haystack: characterSearchHaystack(item),
          name: normalizeSearchText(item.name || ''),
          series: normalizeSearchText(item.series || ''),
          owner: normalizeSearchText(item.owner || ''),
          note: normalizeSearchText(item.note || ''),
          divider: '',
          galleryTags: getCharacterGalleryTagIndex(item)
        };

    setRuntimeSearchCache(item, { index });
    return index;
  }


  function clearSearchRuntimeCaches() {
    invalidateSearchCache();
  }

  function isExactNameSearch(search) {
    return search?.exact && search?.field === 'name';
  }

  function characterNameEqualsSearch(item, search) {
    return normalizeSearchText(item?.name || '') === search.value;
  }

  function getSearchPriorityNameTerms(termObjects = getSearchTermObjects()) {
    // Ordered search: when the query combines an exact quoted name with other
    // comma-separated filters, show the exact character match first, then the
    // rest of the filtered results in normal board order.
    // Example: "himari", series:madoka
    if (!Array.isArray(termObjects) || termObjects.length < 2) return [];

    return termObjects.filter(isExactNameSearch);
  }

  function getSearchPriorityRank(item, priorityTerms) {
    if (!priorityTerms.length || isDivider(item)) return Infinity;

    const index = priorityTerms.findIndex(search => characterNameEqualsSearch(item, search));
    return index >= 0 ? index : Infinity;
  }

  function getSearchObjectsFromTerms(terms) {
    if (Array.isArray(terms) && terms.length && typeof terms[0] === 'object' && 'value' in terms[0]) {
      return terms;
    }
    return getSearchTermObjects();
  }

  function itemMatchesSearch(item, terms) {
    const termObjects = getSearchObjectsFromTerms(terms);
    if (!termObjects.length) return true;

    const divider = isDivider(item);
    const index = getCachedSearchIndex(item);

    return termObjects.some(search => {
      if (!divider) {
        const gender = getGenderType(item);

        // Plain quoted searches like "himari" are exact character-name searches.
        // They must not fall through to the general haystack includes search.
        if (isExactNameSearch(search)) {
          return index.name === search.value;
        }

        if (search.field === 'gender') {
          if (['both'].includes(search.value)) return gender === 'both';
          if (['waifu', 'female'].includes(search.value)) return gender === 'waifu';
          if (['husbando', 'male'].includes(search.value)) return gender === 'husbando';
          return false;
        }

        if (search.field === 'tag') {
          return itemMatchesGalleryTagSearch(item, search);
        }

        if (search.field === 'name') {
          return search.exact ? index.name === search.value : index.name.includes(search.value);
        }

        if (search.field === 'series' || search.field === 'serie') {
          return search.exact ? index.series === search.value : index.series.includes(search.value);
        }

        if (search.field === 'owner') {
          return search.exact ? index.owner === search.value : index.owner.includes(search.value);
        }

        if (search.field === 'note') {
          return search.exact ? index.note === search.value : index.note.includes(search.value);
        }
      } else {
        if (search.field === 'divider') {
          return search.exact ? index.divider === search.value : index.divider.includes(search.value);
        }

        // Exact name searches are for characters only.
        if (isExactNameSearch(search)) return false;
      }

      if (search.field) return false;

      return index.haystack.includes(search.value);
    });
  }


  function characterPassesTypeFilter(item) {
    const type = app.filter.type;

    if (type === 'all') return true;
    if (type === 'gallery') {
      // Fast path for the gallery filter: the saved gallery is already
      // normalized on import/save. Avoid rebuilding a normalized URL array for
      // every card during search/filter passes.
      const gallery = Array.isArray(item.mudaeImages) ? item.mudaeImages : [];
      return gallery.some(url => hasRealImage(url));
    }
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

    const terms = getSearchTermObjects();
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

  function notifyAppMessage(message) {
    if (!message) return;

    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }

    if (typeof window.showNotification === 'function') {
      window.showNotification(message);
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

    const anchorSelector = '.char-card[data-id], .divider-row[data-id]';
    const makeAnchor = node => {
      if (!node?.dataset?.id) return null;
      const rect = node.getBoundingClientRect();
      return {
        id: node.dataset.id,
        top: rect.top,
        type: node.classList.contains('divider-row') ? 'divider' : 'character'
      };
    };

    // Fast path: use hit-testing around the normal reading position instead of
    // scanning every mounted node. Include divider headers so Ctrl+F started
    // from a collapsed/minimized divider can restore to that divider instead of
    // falling back to the first card/top.
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1200;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 800;
    const probeY = Math.min(Math.max(96, viewportH * 0.18), viewportH - 24);
    const probeXs = [
      Math.min(Math.max(220, viewportW * 0.28), viewportW - 32),
      Math.min(Math.max(360, viewportW * 0.50), viewportW - 32),
      Math.min(Math.max(120, viewportW * 0.12), viewportW - 32)
    ];

    for (const x of probeXs) {
      const hit = document.elementFromPoint?.(x, probeY);
      const node = hit?.closest?.(anchorSelector);
      if (node && board.contains(node)) {
        const anchor = makeAnchor(node);
        if (anchor) return anchor;
      }
    }

    // Fallback: inspect mounted cards and divider rows. This is essential when
    // every divider is minimized, because there may be no visible cards near
    // the viewport to use as an origin anchor.
    const viewportBottom = viewportH;
    const candidates = Array.from(board.querySelectorAll(anchorSelector));

    let best = null;
    let bestDistance = Infinity;

    for (const node of candidates) {
      const rect = node.getBoundingClientRect();

      if (rect.bottom < 0 || rect.top > viewportBottom) continue;

      const distance = Math.abs(rect.top - 90);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = makeAnchor(node);
      }
    }

    if (best) return best;

    const first = candidates.find(node => node.dataset.id);
    return first ? makeAnchor(first) : null;
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

    // Previously this scheduled 3 independent entry points (immediate rAF,
    // setTimeout 80ms, setTimeout 180ms), each of which could itself spawn its
    // own recursive rAF retry chain via `run`. Since all 3 shared the same
    // `remaining` counter they never broke correctness, but they could overlap
    // in time and run redundant duplicate correction passes toward the same
    // target. `rafScheduled` collapses that into a single coordinated chain:
    // only one rAF retry is ever in flight at a time.
    let rafScheduled = false;

    const scheduleNext = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        run();
      });
    };

    const run = () => {
      const node = els.board?.querySelector?.(`[data-id="${getCssSafeId(anchor.id)}"]`);

      if (!node) {
        remaining--;

        if (remaining <= 0) return false;

        window.MudaeBoardController?.updateEntriesFromApp?.();
        window.MudaeBoardController?.renderAroundId?.(anchor.id, { scroll: false, highlight: false });
        scheduleNext();
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
        scheduleNext();
      }

      return true;
    };

    scheduleNext();

    // One delayed fallback pass covers renders that finish late (images/GIFs
    // still loading, or a virtual-board window that hasn't mounted the target
    // node yet by the time the rAF chain above has used up its attempts).
    // Kept unconditional (like the original code) so low `attempts` callers
    // (e.g. attempts: 1) still get this one extra safety check.
    setTimeout(run, 150);

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
      notifyAppMessage('Select One Or More Characters First.');
      return false;
    }

    const next = typeof force === 'boolean' ? force : !app.multiMoveTargetMode;
    app.multiMoveTargetMode = next;
    document.body.classList.toggle('is-multi-move-target-mode', next);

    dispatchMultiSelectChange();

    notifyAppMessage(next ? 'Click A Destination Card For The Selected Characters.' : 'Destination Selection Cancelled.');
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


  function getCharacterAtDisplayPositionInList(list, displayPosition) {
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

  function getDisplayPositionForSelectedBlock(defaultToFirst = true) {
    const selected = ensureMultiSelectedSet();
    const positions = Array.from(selected || [])
      .map(id => getCharacterDisplayPositionById(id) || getCharacterListPosition(id) || 0)
      .filter(Boolean)
      .sort((a, b) => a - b);

    if (!positions.length) return 1;
    return defaultToFirst ? positions[0] : positions[positions.length - 1];
  }

  function moveSelectedCharactersToPosition(targetPosition) {
    const selected = ensureMultiSelectedSet();
    const selectedIds = Array.from(selected || []);

    if (!selectedIds.length) {
      notifyAppMessage('Select One Or More Characters First.');
      return false;
    }

    assignBoardCounters?.();

    const total = getCharacterCount?.() || (app.state.characters || []).filter(item => item && !isDivider(item)).length;
    const target = Math.max(1, Math.min(total, num(targetPosition) || 1));
    const selectedSet = new Set(selectedIds);
    const stateList = app.state.characters || [];

    const sourcePositionById = new Map(
      selectedIds.map(id => [id, getCharacterDisplayPositionById(id) || getCharacterListPosition(id) || 0])
    );

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

    const originalPositions = movingItems
      .map(item => sourcePositionById.get(item.id) || 0)
      .filter(Boolean)
      .sort((a, b) => a - b);

    const alreadyAtTarget = originalPositions.length && originalPositions[0] === target && originalPositions.every((pos, index) => pos === originalPositions[0] + index);
    if (alreadyAtTarget) {
      notifyAppMessage('Selected Characters Are Already At That Position.');
      return false;
    }

    const visualAnchor = (() => {
      const before = getCharacterAtDisplayPositionInList(remainingItems, Math.max(1, target - 1));
      const at = getCharacterAtDisplayPositionInList(remainingItems, target);
      return { id: (before || at || movingItems[0])?.id || '', top: 120 };
    })();

    let insertIndex = getMoveRawIndexForDisplayPositionInList(remainingItems, target);
    insertIndex = Math.max(0, Math.min(remainingItems.length, insertIndex));

    app.state.characters = [
      ...remainingItems.slice(0, insertIndex),
      ...movingItems,
      ...remainingItems.slice(insertIndex)
    ];

    app.multiMoveTargetMode = false;
    selected.clear();

    invalidateSearchCache?.();
    assignBoardCounters?.();
    saveLocal?.();
    window.MudaeBoardController?.updateEntriesFromApp?.();

    document.body.classList.add('is-board-focusing');
    if (!reorderExistingBoardFromState(movingItems[0]?.id || visualAnchor.id)) {
      renderBoard();
    }

    window.MudaeBoardController?.renderAroundId?.(movingItems[0]?.id || visualAnchor.id, { scroll: true, highlight: true });
    setTimeout(() => document.body.classList.remove('is-board-focusing'), 280);
    window.MudaeBoardController?.flushSave?.();

    const getChangedExportNameForItem = (item) => str(item?.exportName || item?.name || '').trim();
    const previousItem = getCharacterAtDisplayPositionInList(app.state.characters, Math.max(1, target - 1));
    const nextItem = getCharacterAtDisplayPositionInList(app.state.characters, target + movingItems.length);
    const changedCommandNames = [
      previousItem && !selectedSet.has(previousItem.id) ? getChangedExportNameForItem(previousItem) : '',
      ...movingItems.map(getChangedExportNameForItem),
      nextItem && !selectedSet.has(nextItem.id) ? getChangedExportNameForItem(nextItem) : ''
    ].filter(Boolean);

    if (window.MudaeExports?.recordChangedRange) {
      const sourcePositions = Array.from(sourcePositionById.values()).filter(Boolean);
      const movedNames = movingItems.map(item => item?.name || '').filter(Boolean);
      window.MudaeExports.recordChangedRange(target, target, Math.min(total, target + Math.max(1, changedCommandNames.length) - 1), {
        id: `multi-exact-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: movedNames.length
          ? `${movedNames.slice(0, 3).join(', ')}${movedNames.length > 3 ? ` +${movedNames.length - 3}` : ''}`
          : `${movingItems.length} selected`,
        commandNames: changedCommandNames,
        fromPosition: sourcePositions.length ? Math.min(...sourcePositions) : target
      });
    } else {
      window.MudaeExports?.recordChangedMove?.(0, target, {
        radius: Math.max(1, movingItems.length),
        name: `${movingItems.length} selected`
      });
    }

    document.body.classList.toggle('is-multi-move-target-mode', false);
    els.board?.querySelectorAll?.('.multi-selected-card').forEach(node => node.classList.remove('multi-selected-card'));
    dispatchMultiSelectChange?.();

    notifyAppMessage(`Moved ${movingItems.length} selected character${movingItems.length === 1 ? '' : 's'} to #${target}.`);
    return true;
  }

  async function promptMoveSelectedCharactersSafe() {
    if (!app.multiSelectMode) return false;

    const selected = ensureMultiSelectedSet();
    const count = selected?.size || 0;
    if (!count) {
      notifyAppMessage('Select One Or More Characters First.');
      return false;
    }

    assignBoardCounters?.();

    const { selectedIds, movingItems } = getSelectedMoveItemsAndIds();
    if (!movingItems.length) {
      notifyAppMessage('Select One Or More Characters First.');
      return false;
    }

    const total = getCharacterCount?.() || (app.state.characters || []).filter(item => item && !isDivider(item)).length;
    const current = getDisplayPositionForSelectedBlock(true);
    const initialMoveContext = getMoveSelectedPositionContext(selectedIds, current);
    const dialogState = {
      selectedIds,
      movingItems,
      count: movingItems.length,
      current,
      total,
      choiceId: 'default',
      scopeActive: true,
      scopeDividerId: initialMoveContext.previousDivider?.item?.id || initialMoveContext.dividerTargets?.[0]?.id || '',
      context: initialMoveContext
    };

    const ok = await showAppDialog({
      type: 'confirm',
      title: 'Move Selected',
      message: 'Choose a divider destination or open advanced exact position.',
      okText: 'Move',
      cancelText: 'Cancel',
      renderContent(content) {
        renderMoveSelectedContext(content, dialogState);
      }
    });

    if (!ok) return false;

    const target = num(dialogState.input?.value);
    if (!target || target < 1 || target > total) {
      showAppAlert(`Invalid position. Use 1-${fmt(total)}.`, {
        title: 'Invalid Position',
        variant: 'danger'
      });
      return false;
    }

    const ctx = getMoveSelectedPositionContext(selectedIds, target);
    const choice = ctx.choices.find(item => item.id === dialogState.choiceId) || ctx.choices[0];

    if (choice?.id === 'new-divider') {
      const first = movingItems[0];
      const title = dialogState.newDividerTitle?.value?.trim() || first?.series || first?.name || 'New Divider';
      const level = num(dialogState.newDividerLevel?.value) || 1;
      const workingList = dialogState.context?.workingList || ctx.workingList || app.state.characters || [];
      const anchorRawInsertIndex = getMoveNewDividerRawInsertIndex(workingList, dialogState.newDividerAnchorSelect?.value || dialogState.newDividerAnchorId || '', dialogState.newDividerPlacementSelect?.value || 'after');
      const rawDestination = Number.isFinite(anchorRawInsertIndex)
        ? anchorRawInsertIndex
        : Number.isFinite(dialogState.scopedRawInsertIndex)
          ? dialogState.scopedRawInsertIndex
          : choice.rawInsertIndex;
      return moveSelectedCharactersWithNewDivider(rawDestination, title, level, target);
    }

    if (dialogState.scopeActive && Number.isFinite(dialogState.scopedRawInsertIndex)) {
      const scopeTitle = dialogState.scopeDividerSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Selected Divider';
      return moveSelectedCharactersToRawInsertIndex(dialogState.scopedRawInsertIndex, target, {
        message: `Moved ${movingItems.length} selected character${movingItems.length === 1 ? '' : 's'} using ${scopeTitle}.`
      });
    }

    if (choice?.id === 'direct-divider') {
      const dividerId = dialogState.directDividerSelect?.value || dialogState.directDividerId || choice.dividerTargetId || '';
      const placement = dialogState.directDividerPlacement?.value || 'end';
      const dividerTarget = getMoveDividerTargetById(ctx.workingList, dividerId);
      if (!dividerTarget) {
        showAppAlert('Choose a valid divider.', {
          title: 'Invalid Divider',
          variant: 'danger'
        });
        return false;
      }

      const rawInsertIndex = placement === 'top' ? dividerTarget.rawTopIndex : dividerTarget.rawEndIndex;
      return moveSelectedCharactersToRawInsertIndex(rawInsertIndex, target, {
        message: `Moved ${movingItems.length} selected character${movingItems.length === 1 ? '' : 's'} to divider ${dividerTarget.title}.`
      });
    }

    return moveSelectedCharactersToRawInsertIndex(choice?.rawInsertIndex ?? ctx.rawInsertIndex, target);
  }


function renderAll(options = {}) {
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

  function isSearchQueryReadyForRender(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (isIncompleteSearchCommand(raw)) return false;

    const parsed = parseSearchTokens(raw)
      .map(parseSearchTerm)
      .filter(item => item.value);

    if (!parsed.length) return false;

    return parsed.some(item => {
      if (item.field === 'gender' || String(item.field || '').startsWith('gender')) return true;
      return String(item.value || '').length >= app.searchMinChars;
    });
  }

  function hasTooShortSearchQuery() {
    const raw = getSearchInputValue().trim();
    if (!raw) return false;
    if (isIncompleteSearchCommand(raw)) return false;
    return !isSearchQueryReadyForRender(raw);
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

  function makeBoardFilterCacheKey(termObjects) {
    const type = app.filter.type || 'all';
    const query = String(getActiveSearchQuery() || '');
    const total = app.state.characters.length;
    return [
      app.searchCacheVersion,
      total,
      type,
      query,
      Array.isArray(termObjects) ? termObjects.map(term => `${term.field || ''}:${term.exact ? 1 : 0}:${term.value}`).join('|') : ''
    ].join('::');
  }

  function collectFilteredBoardEntries(terms) {
    const termObjects = getSearchObjectsFromTerms(terms);
    const cacheKey = makeBoardFilterCacheKey(termObjects);

    if (app.lastBoardFilterCache?.key === cacheKey) {
      return app.lastBoardFilterCache.result;
    }

    const priorityTerms = termObjects.length ? getSearchPriorityNameTerms(termObjects) : [];
    const priorityEntries = [];
    const normalEntries = [];
    const collapsedLevels = [];
    const searchDividerStack = [];
    let visibleChars = 0;

    const hasSearch = termObjects.length > 0;
    const hasMatchedDividerAncestor = () => searchDividerStack.some(entry => entry.directMatch);

    app.state.characters.forEach((item, index) => {
      if (isDivider(item)) {
        const level = getDividerLevel(item);

        while (collapsedLevels.length && collapsedLevels[collapsedLevels.length - 1] >= level) {
          collapsedLevels.pop();
        }
        while (searchDividerStack.length && searchDividerStack[searchDividerStack.length - 1].level >= level) {
          searchDividerStack.pop();
        }

        if (!hasSearch && collapsedLevels.length) return;

        if (!hasSearch) {
          normalEntries.push({ type: 'divider', item });

          if (item.collapsed) {
            collapsedLevels.push(level);
          }

          return;
        }

        const sectionDividerMatch = hasMatchedDividerAncestor();
        const directDividerMatch = itemMatchesSearch(item, termObjects);

        if (directDividerMatch || sectionDividerMatch) {
          normalEntries.push({
            type: 'divider',
            item,
            searchMatch: directDividerMatch,
            sectionSearchMatch: sectionDividerMatch
          });
        }

        searchDividerStack.push({ level, directMatch: directDividerMatch });
        return;
      }

      if (!hasSearch && collapsedLevels.length) return;

      // Apply the persistent type filter before the heavier search match.
      // This avoids building/searching haystacks for cards that could never be
      // shown in the current type view.
      if (!characterPassesTypeFilter(item)) return;

      const sectionMatch = hasSearch && hasMatchedDividerAncestor();
      const directMatch = hasSearch ? itemMatchesSearch(item, termObjects) : true;

      if (hasSearch && !(directMatch || sectionMatch)) return;

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

    const result = {
      entries: priorityEntries.length ? [...priorityEntries, ...normalEntries] : normalEntries,
      visibleChars
    };

    app.lastBoardFilterCache = { key: cacheKey, result };
    return result;
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
      scheduleBoardRenderedEvent('empty-board-message');
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
        return;
      }

      scheduleBoardRenderedEvent('search-chunked');
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


  function rememberCurrentBoardImageUrls(options = {}) {
    const loader = window.MudaeMinimalImageLoader;
    if (!loader?.rememberLoadedUrl) return;

    const now = performance.now ? performance.now() : Date.now();
    const force = options.force === true;
    const minInterval = Number.isFinite(options.minInterval) ? options.minInterval : 850;

    // This function runs before board swaps so the lazy image loader can keep
    // already-loaded images warm. Querying every visible image on every search
    // keypress / small render was measurable on large harems, so keep it as a
    // light sampled cache instead of a mandatory full DOM scan.
    if (!force && app.lastBoardImageRememberAt && now - app.lastBoardImageRememberAt < minInterval) {
      return;
    }

    app.lastBoardImageRememberAt = now;

    const root = els.board || document;
    root.querySelectorAll?.('img.char-img').forEach(img => {
      const url = img.currentSrc || img.src || img.dataset?.src || '';
      if (url && !url.startsWith('data:')) {
        loader.rememberLoadedUrl(url);
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

    // BoardController caches the visible-card limit for performance. Route
    // settings changes through it when available so the cache is updated before
    // the board re-renders; otherwise the select can appear to do nothing until
    // a reload.
    if (window.MudaeBoardController?.setLimit) {
      window.MudaeBoardController.setLimit(app.visibleCardLimit);

      window.dispatchEvent(new CustomEvent('mudae:virtual-board-change', {
        detail: { enabled: app.virtualBoardEnabled }
      }));
      return;
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


  function renderVisibleWindowNow(force = false) {
    return false;
  }
  function scheduleVisibleWindowRender(force = false) {
    window.MudaeBoardController?.schedule?.(!!force);
    return false;
  }


  function hydrateVirtualBoardSetting() {
    app.virtualBoardEnabled = false;
    try {
      localStorage.setItem(VIRTUAL_BOARD_KEY, 'false');
    } catch (error) {
      // ignore
    }
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


  function createVirtualSpacer(height, className) {
    const spacer = document.createElement('div');
    spacer.className = className;
    spacer.style.height = Math.max(0, Math.round(height)) + 'px';
    spacer.setAttribute('aria-hidden', 'true');
    return spacer;
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
    scheduleBoardRenderedEvent('renderBoardNormalEntries');

    return true;
  }


  function bindVirtualBoardScroll() {
    // Deprecated: v2.69 uses BoardGridController only.
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
        <button class="compact-sticky-divider-main" type="button" title="Minimize or restore this divider" aria-label="Minimize or restore current divider">
          <span class="compact-sticky-divider-icon">▾</span>
          <strong class="compact-sticky-divider-title"></strong>
          <span class="compact-sticky-divider-kind"></span>
        </button>
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

  function invalidateCompactStickyDividerCache() {
    // Kept as a public hook for board renders/toggles. The sticky resolver now
    // reads the current divider rows directly so it cannot get stuck on stale
    // nodes while scrolling through filtered or collapsed sections.
    app.compactStickyDividerRowsCache = null;
    app.compactStickyDividerRowsCacheBoard = null;
  }

  function getCompactStickyDividerRows() {
    const board = els.board;
    if (!board) return [];

    return Array.from(board.querySelectorAll('.divider-row'))
      .filter(node => node.offsetParent && !node.hidden);
  }

  function isStickyDividerRowCollapsed(node) {
    if (!node) return true;
    return String(node.dataset?.collapsed || '').toLowerCase() === 'true' ||
      node.classList.contains('is-collapsed') ||
      node.getAttribute('aria-expanded') === 'false';
  }

  function areAllDividersCollapsedForSticky(rows = getCompactStickyDividerRows()) {
    return rows.length > 0 && rows.every(isStickyDividerRowCollapsed);
  }

  function getCurrentDividerForSticky() {
    const board = els.board;
    if (!board) return null;

    const topOffset = getStickyDividerTopOffset() + 8;
    const boardRect = board.getBoundingClientRect?.();

    // At the top of the board the real divider header is already visible, so
    // the compact sticky proxy should stay hidden. This also clears stale sticky
    // state when returning to the top after a long scroll.
    if (boardRect && boardRect.top >= topOffset - 2) return null;

    const dividerRows = getCompactStickyDividerRows();
    if (!dividerRows.length || areAllDividersCollapsedForSticky(dividerRows)) return null;

    let current = null;
    for (let i = 0; i < dividerRows.length; i++) {
      const node = dividerRows[i];
      const rect = node.getBoundingClientRect();

      if (rect.top <= topOffset) {
        current = node;
        continue;
      }

      // Rows are in DOM order, so once the next divider is below the sticky
      // threshold the previous row is the active section.
      break;
    }

    if (!current || isStickyDividerRowCollapsed(current)) return null;

    return current;
  }

  function updateCompactStickyDivider() {
    const bar = ensureCompactStickyDividerBar();
    const divider = getCurrentDividerForSticky();

    if (!divider || areAllDividersCollapsedForSticky()) {
      bar.hidden = true;
      bar.classList.remove('is-visible');
      bar.dataset.sourceId = '';
      bar.dataset.dividerId = '';
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
    bar.dataset.dividerId = divider.dataset?.id || '';

    const titleNode = bar.querySelector('.compact-sticky-divider-title');
    const kindNode = bar.querySelector('.compact-sticky-divider-kind');
    const mainButton = bar.querySelector('.compact-sticky-divider-main');
    const iconNode = bar.querySelector('.compact-sticky-divider-icon');
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

    const isCollapsed = String(divider.dataset?.collapsed || '').toLowerCase() === 'true';

    if (titleNode) titleNode.textContent = title;
    if (iconNode) iconNode.textContent = isCollapsed ? '▸' : '▾';
    if (mainButton) {
      mainButton.title = isCollapsed ? 'Restore This Divider' : 'Minimize This Divider';
      mainButton.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      mainButton.setAttribute('aria-label', `${isCollapsed ? 'Restore' : 'Minimize'} ${isSub ? 'sub-divider' : 'divider'} ${title}`.trim());
    }
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

    document.addEventListener('click', event => {
      const button = event.target?.closest?.('.compact-sticky-divider-main');
      if (!button) return;

      const bar = button.closest?.('.compact-sticky-divider-bar');
      const dividerId = bar?.dataset?.dividerId || '';
      if (!dividerId) return;

      event.preventDefault();
      event.stopPropagation();
      window.MudaeDividers?.toggleDividerCollapsed?.(dividerId);
      invalidateCompactStickyDividerCache();
      update();
    }, true);

    window.addEventListener('scroll', update, { passive: true });
    const stickyScrollElement = getScrollableElement?.();
    if (stickyScrollElement && stickyScrollElement !== window && stickyScrollElement !== document && stickyScrollElement !== document.body && stickyScrollElement !== document.documentElement && stickyScrollElement !== document.scrollingElement) {
      stickyScrollElement.addEventListener('scroll', update, { passive: true });
    }
    window.addEventListener('resize', update, { passive: true });
    document.addEventListener('click', update, true);
    const onBoardRendered = () => {
      invalidateCompactStickyDividerCache();
      update();
    };

    document.addEventListener('mhp-board-rendered', onBoardRendered);
    document.addEventListener('mudae:board-rendered', onBoardRendered);
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

  function scheduleBoardRenderedEvent(source = 'renderBoard') {
    if (app.boardRenderedEventRaf) {
      cancelAnimationFrame(app.boardRenderedEventRaf);
      app.boardRenderedEventRaf = 0;
    }

    app.boardRenderedEventRaf = requestAnimationFrame(() => {
      app.boardRenderedEventRaf = 0;
      const detail = {
        source,
        count: els.board?.children?.length || 0,
        timestamp: Date.now()
      };

      try {
        window.dispatchEvent(new CustomEvent('mhp-board-rendered', { detail }));
        document.dispatchEvent(new CustomEvent('mhp-board-rendered', { detail }));
        // Legacy alias used by the compact sticky divider and older modules.
        window.dispatchEvent(new CustomEvent('mudae:board-rendered', { detail }));
        document.dispatchEvent(new CustomEvent('mudae:board-rendered', { detail }));
      } catch (_) {}
    });
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
      scheduleBoardRenderedEvent('search-command-message');
      return;
    }

    if (hasTooShortSearchQuery()) {
      els.board.classList.remove('bc-window-active');
      clearBoardControllerDomMode();
      els.board.replaceChildren(createSearchMinCharsMessage());
      showSearchSuggestions();
      scheduleBoardRenderedEvent('search-minchars-message');
      return;
    }

    const activeSearchInput = getActiveSearchInputElement();
    if (activeSearchInput && getSearchCommandSuggestions(activeSearchInput.value).length) {
      showSearchSuggestions(activeSearchInput);
    } else {
      hideSearchSuggestions({ force: true });
    }

    const terms = getSearchTermObjects();

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
        scheduleBoardRenderedEvent('board-controller');
        return;
      }

      console.debug?.('Board controller produced an empty board; falling back to normal board render.');
    }

    renderBoardNormalEntries(entries);
  }


  function createEmptyBoardMessage() {
    const empty = document.createElement('div');
    empty.className = 'divider-row';
    empty.textContent = 'No Characters Match The Current Filter.';
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
  function getBoardCounterCacheKey() {
    const items = app.state.characters || [];
    // Keep this order-sensitive without allocating one huge joined signature on
    // every render. A compact rolling hash still catches moves/reorders while
    // avoiding a large temporary string for 1k+ character boards.
    let hash = 2166136261;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const kindCode = isDivider(item)
        ? (getDividerCounterKind(item) === 'subdivider' ? 50 : 49)
        : 67;
      hash ^= kindCode + i;
      hash = Math.imul(hash, 16777619) >>> 0;

      const id = String(item?.id || '');
      for (let j = 0; j < id.length; j++) {
        hash ^= id.charCodeAt(j);
        hash = Math.imul(hash, 16777619) >>> 0;
      }
    }

    return `${items.length}|${hash.toString(36)}`;
  }

  function assignBoardCounters(options = {}) {
    const cacheKey = getBoardCounterCacheKey();

    if (options.force !== true && app.boardCounterCacheKey === cacheKey && app.state.boardCounts) {
      return app.state.boardCounts;
    }

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
    // Reuse the key calculated at the start of the pass. Recomputing the same
    // order hash here costs a second full walk on every counter refresh.
    app.boardCounterCacheKey = cacheKey;

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

      scheduleBoardRenderedEvent('restore-full-chunked');
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
    if (!id) return -1;
    const cached = getStateLookupCache().charRawIndexById.get(id);
    if (Number.isInteger(cached)) {
      const item = app.state.characters?.[cached];
      if (item && item.id === id && !isDivider(item)) return cached;
      invalidateStateLookupCache?.();
    }
    return app.state.characters.findIndex(item => !isDivider(item) && item.id === id);
  }

  function canFastDomMoveBoard() {
    if (getActiveSearchQuery?.()) return false;
    if (app.filter?.type && app.filter.type !== 'all') return false;
    if (!els.board) return false;

    // children of #board. The BoardController/Glass renderer wraps cards inside
    // row hosts (.bgc-rows/.bgc-card-row), so the old direct-child reorder could
    // update the saved array while leaving the visible board unchanged until a
    // reload. In that mode, force a normal render so the controller rebuilds the
    // mounted rows from the new state immediately.
    if (
      els.board.classList?.contains('bgc-window-active') ||
      els.board.classList?.contains('bc-window-active') ||
      els.board.classList?.contains('visible-window-active') ||
      els.board.classList?.contains('virtual-board-active') ||
      els.board.querySelector?.('.bgc-rows,.bgc-card-row,.bc-window-grid,.visible-window-grid,.virtual-board-window-grid')
    ) {
      return false;
    }

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


  function scheduleVisibleCounterUpdate() {
    if (app.moveCounterTimer) {
      clearTimeout(app.moveCounterTimer);
      app.moveCounterTimer = null;
    }

    // Keep counters tied to the real global character positions. The old
    // visible-only refresh briefly showed 1, 2, 3... after moves until the
    // full board counters caught up, which looked like a broken reorder.
    updateExistingNodeCounters();
  }


  function getCharacterDisplayPositionById(id) {
    const item = app.state.characters.find(entry => !isDivider(entry) && entry.id === id);
    return item?.displayCharacterIndex || getCharacterListPosition(id) || 0;
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

  function finalizeCharacterMoveRender(anchorId = null) {
    invalidateSearchCache?.();
    assignBoardCounters();
    window.MudaeBoardController?.updateEntriesFromApp?.();

    if (els.board?.classList?.contains('visible-window-active')) {
      refreshVisibleWindowAfterMove?.();
    } else if (!reorderExistingBoardFromState(anchorId)) {
      renderBoard();
    }

    scheduleVisibleCounterUpdate?.();
    scheduleMoveSave?.();
  }

  function captureFilteredMoveViewSnapshot() {
    if (!isBoardFiltered?.()) return null;

    return {
      query: String(app.filter?.q || '').trim(),
      scrollY: Math.max(0, window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0),
      anchor: captureBoardVisualAnchor?.() || null,
      capturedAt: Date.now()
    };
  }

  function restoreFilteredMoveViewSnapshot(snapshot) {
    if (!snapshot?.query) return false;

    const isSameSearch = () => String(app.filter?.q || '').trim() === snapshot.query;
    if (!isSameSearch()) return false;

    const restoreOnce = () => {
      if (!isSameSearch()) return false;

      const anchor = snapshot.anchor;
      if (anchor?.id) {
        const node = els.board?.querySelector?.(`[data-id="${getCssSafeId(anchor.id)}"]`);
        if (node) {
          restoreBoardVisualAnchor?.(anchor, { attempts: 4, highlight: false });
          return true;
        }
      }

      if (Number.isFinite(snapshot.scrollY)) {
        window.scrollTo({ top: Math.max(0, snapshot.scrollY), behavior: 'auto' });
        return true;
      }

      return false;
    };

    restoreOnce();
    requestAnimationFrame(() => {
      restoreOnce();
      requestAnimationFrame(restoreOnce);
    });
    setTimeout(restoreOnce, 90);
    setTimeout(restoreOnce, 220);
    return true;
  }

  function finalizeFilteredMoveRender(sourceId = null, snapshot = null) {
    invalidateSearchCache?.();
    assignBoardCounters?.();
    window.MudaeBoardController?.updateEntriesFromApp?.();

    // Keep the active filtered/search view in place. Do not focus the moved
    // character here: when moving from divider:News to another divider the
    // source can disappear from the filtered result, and renderAroundId(source)
    // falls back near the top of the board.
    renderBoard();
    restoreFilteredMoveViewSnapshot(snapshot);

    scheduleVisibleCounterUpdate?.();
    scheduleMoveSave?.();
    return true;
  }
  function moveCharacterToPosition(id, targetPosition) {
    if (isBoardFiltered()) {
      const actualSourceId = id || '';

      // Do not reference local names such as `target` here. A later `const target`
      // exists in the non-filtered branch, and `typeof target` would still hit the
      // temporal-dead-zone in this function scope. In this exact-position path the
      // requested destination is always the targetPosition argument.
      const actualTarget = Number(targetPosition) || 1;

      if (actualSourceId) {
        const sourcePositionBefore = typeof getCharacterDisplayPositionById === 'function'
          ? getCharacterDisplayPositionById(actualSourceId)
          : 0;

        const filteredMoveSnapshot = captureFilteredMoveViewSnapshot?.();
        const ok = moveCharacterToRealDisplayPositionById(actualSourceId, actualTarget);

        if (ok) {
          // Moving while filtered/searching should not clear the search or jump
          // to the source. Preserve the current filtered viewport instead.
          hideSearchSuggestions?.({ force: true });
          finalizeFilteredMoveRender?.(actualSourceId, filteredMoveSnapshot);

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
    invalidateStateLookupCache?.();

    assignBoardCounters();

    let insertIndex = getCharacterRawIndexByDisplayPosition(target);

    // If target is past the last existing character after removal, append at end.
    if (insertIndex < 0) {
      insertIndex = app.state.characters.length;
    }

    app.state.characters.splice(insertIndex, 0, item);
    finalizeCharacterMoveRender(id);
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
    // When filtered, move by stable card IDs in the real saved array.
    if (isBoardFiltered()) {
      const actualSourceId = sourceId || '';
      const actualTargetId = targetId || '';

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

      const explicitPlacement = placement || '';

      const actualPlacement = explicitPlacement || (
        sourcePositionBefore && targetPositionBefore && sourcePositionBefore < targetPositionBefore
          ? 'after'
          : 'before'
      );

      if (actualSourceId && actualTargetId) {
        const filteredMoveSnapshot = captureFilteredMoveViewSnapshot?.();
        const ok = moveCharacterByIdsInRealState(actualSourceId, actualTargetId, actualPlacement);

        if (ok) {
          finalizeFilteredMoveRender?.(actualSourceId, filteredMoveSnapshot);
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
    const explicitPlacement = placement === 'after' || placement === 'before' ? placement : null;
    const actualPlacement = explicitPlacement || (movingForward ? 'after' : 'before');
    const [item] = app.state.characters.splice(sourceIndex, 1);
    invalidateStateLookupCache?.();

    assignBoardCounters();

    const targetIndexAfterRemoval = getCharacterRawIndexById(targetId);

    if (targetIndexAfterRemoval < 0) {
      app.state.characters.splice(sourceIndex, 0, item);
      invalidateStateLookupCache?.();
      assignBoardCounters();
      return false;
    }

    const insertIndex = actualPlacement === 'after'
      ? Math.min(app.state.characters.length, targetIndexAfterRemoval + 1)
      : targetIndexAfterRemoval;

    app.state.characters.splice(insertIndex, 0, item);
    finalizeCharacterMoveRender(sourceId);
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

  function getMoveCharacterPlainLabel(item, fallback = 'Unnamed') {
    if (!item) return fallback;
    if (isDivider(item)) return item.title || fallback;
    const series = str(item.series || '').trim();
    return `${item.name || fallback}${series ? ` · ${series}` : ''}`;
  }

  function getMoveBlockPreviewLabel(state, fallback = 'Moving') {
    if (state?.sourceId) {
      return getMoveCharacterLabel(getCharacter(state.sourceId), fallback);
    }
    if (Array.isArray(state?.movingItems) && state.movingItems.length) {
      if (state.movingItems.length === 1) return getMoveCharacterLabel(state.movingItems[0], fallback);
      const first = getMoveCharacterPlainLabel(state.movingItems[0], 'First');
      const last = getMoveCharacterPlainLabel(state.movingItems[state.movingItems.length - 1], 'Last');
      return `${state.movingItems.length} selected · ${first} → ${last}`;
    }
    return fallback;
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
    const previousCharacter = getCharacterAtDisplayPositionInList(workingList, target - 1);
    const targetCharacter = getCharacterAtDisplayPositionInList(workingList, target);
    const nextCharacter = getCharacterAtDisplayPositionInList(workingList, target + 1);

    const previousRawItem = workingList[rawInsertIndex - 1] || null;
    const nextRawItem = workingList[rawInsertIndex] || null;

    const previousDivider = findDividerBeforeRawIndex(workingList, rawInsertIndex);
    const nextDivider = findDividerAtOrAfterRawIndex(workingList, rawInsertIndex);

    const choices = [
      {
        id: 'default',
        label: 'Exact',
        detail: targetCharacter
          ? `Place before ${getMoveCharacterLabel(targetCharacter)}.`
          : 'Place at the end of the list.',
        rawInsertIndex
      }
    ];

    if (previousDivider?.item) {
      const previousSectionInsertIndex = nextDivider?.item
        ? nextDivider.index
        : workingList.length;

      choices.push({
        id: 'previous-divider',
        label: 'Keep In',
        detail: `Keep inside ${previousDivider.item.title || 'Previous Divider'} and place before the next divider/end.`,
        dividerTitle: previousDivider.item.title || '',
        rawInsertIndex: previousSectionInsertIndex
      });
    }

    if (nextDivider?.item) {
      choices.push({
        id: 'next-divider',
        label: 'Next In',
        detail: `Move into ${nextDivider.item.title || 'Next Divider'} and place right after its header.`,
        dividerTitle: nextDivider.item.title || '',
        rawInsertIndex: Math.min(workingList.length, nextDivider.index + 1)
      });
    }

    const dividerTargets = getMoveDividerTargetsForList(workingList);
    if (dividerTargets.length) {
      const firstTarget = dividerTargets[0];
      choices.push({
        id: 'direct-divider',
        label: 'Inside',
        detail: `Choose an existing divider/sub-divider and place ${source?.name || 'this character'} at its top or end.`,
        dividerTitle: firstTarget.title || '',
        dividerTargetId: firstTarget.id,
        rawInsertIndex: firstTarget.rawEndIndex
      });
    }

    choices.push({
      id: 'new-divider',
      label: 'New',
      detail: `Create a new divider/sub-divider at a safe section boundary and place ${source?.name || 'this character'} under it.`,
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
      dividerTargets,
      choices: uniqueChoices
    };
  }


  function getSelectedMoveItemsAndIds() {
    const selected = ensureMultiSelectedSet();
    const selectedIds = new Set(Array.from(selected || []).map(id => String(id || '')).filter(Boolean));
    const movingItems = [];

    (app.state.characters || []).forEach(item => {
      if (item && !isDivider(item) && selectedIds.has(String(item.id || ''))) {
        movingItems.push(item);
      }
    });

    return { selected, selectedIds, movingItems };
  }

  function getMoveDividerLevel(item) {
    return Math.max(1, Math.min(2, Number(item?.level) || 1));
  }

  function getMoveDividerEndInsertIndex(list, dividerIndex) {
    const divider = list?.[dividerIndex];
    if (!isDivider(divider)) return Math.max(0, Number(dividerIndex) || 0);

    const level = getMoveDividerLevel(divider);
    for (let i = dividerIndex + 1; i < (list || []).length; i++) {
      const item = list[i];
      if (isDivider(item) && getMoveDividerLevel(item) <= level) return i;
    }

    return (list || []).length;
  }

  function getMoveDividerTargetsForList(list) {
    return (list || [])
      .map((item, index) => {
        if (!isDivider(item)) return null;
        const level = getMoveDividerLevel(item);
        return {
          id: String(item.id || ''),
          title: String(item.title || 'Untitled Divider'),
          level,
          index,
          rawTopIndex: Math.min((list || []).length, index + 1),
          rawEndIndex: getMoveDividerEndInsertIndex(list, index)
        };
      })
      .filter(target => target && target.id);
  }

  function getMoveDividerTargetById(list, dividerId) {
    const id = String(dividerId || '');
    if (!id) return null;
    return getMoveDividerTargetsForList(list).find(target => target.id === id) || null;
  }

  function getMoveNewDividerRawInsertIndex(list, dividerId, placement = 'after') {
    const target = getMoveDividerTargetById(list, dividerId);
    if (!target) return null;
    return String(placement || 'after') === 'before' ? target.index : target.rawEndIndex;
  }

  function getMoveDisplayPositionBeforeRawIndex(list, rawIndex) {
    const items = Array.isArray(list) ? list : [];
    const raw = Math.max(0, Math.min(items.length, Number(rawIndex) || 0));
    let count = 0;

    for (let i = 0; i < raw; i++) {
      const item = items[i];
      if (item && !isDivider(item)) count += 1;
    }

    return Math.max(1, Math.min(getCharacterCount?.() || count || 1, count + 1));
  }

  function getMoveScopedDividerRows(list, dividerId) {
    const items = Array.isArray(list) ? list : [];
    const target = getMoveDividerTargetById(items, dividerId);
    if (!target) return { target: null, rows: [] };

    let displayPosition = 0;
    const rows = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || isDivider(item)) continue;
      displayPosition += 1;
      if (i < target.rawTopIndex || i >= target.rawEndIndex) continue;
      rows.push({
        id: String(item.id || ''),
        label: getMoveCharacterLabel(item, 'Unnamed'),
        item,
        rawIndex: i,
        displayPosition
      });
    }

    return { target, rows };
  }

  function getMoveScopedRawInsertIndex(list, dividerId, characterId, placement = 'before') {
    const { target, rows } = getMoveScopedDividerRows(list, dividerId);
    if (!target) return null;

    const mode = String(placement || 'before');
    if (mode === 'top') return target.rawTopIndex;
    if (mode === 'end' || !characterId) return target.rawEndIndex;

    const row = rows.find(item => item.id === String(characterId || '')) || null;
    if (!row) return target.rawEndIndex;
    return mode === 'after' ? Math.min(target.rawEndIndex, row.rawIndex + 1) : row.rawIndex;
  }

  function renderMoveScopedDividerPanel(state, options = {}) {
    const ctx = state.context || {};
    const targets = ctx.dividerTargets || [];
    const scopeSelect = state.scopeDividerSelect;
    const targetSelect = state.scopeCharacterSelect;
    const placementSelect = state.scopePlacementSelect;
    const note = state.scopeNote;

    if (!scopeSelect || !targetSelect || !placementSelect || !note) return;

    const previousDivider = scopeSelect.value || state.scopeDividerId || '';
    scopeSelect.innerHTML = targets.map(target => `
      <option value="${escapeHtml(target.id)}" ${previousDivider === target.id ? 'selected' : ''}>
        ${escapeHtml(`${target.level > 1 ? '↳ ' : ''}${target.title}`)}
      </option>
    `).join('');

    if (previousDivider && targets.some(target => target.id === previousDivider)) {
      scopeSelect.value = previousDivider;
    }

    state.scopeDividerId = scopeSelect.value || targets[0]?.id || '';

    const { target, rows } = getMoveScopedDividerRows(ctx.workingList || [], state.scopeDividerId);
    const previousTargetId = targetSelect.value || state.scopeCharacterId || '';
    const rowOptions = rows.map(row => `
      <option value="${escapeHtml(row.id)}" ${previousTargetId === row.id ? 'selected' : ''}>
        ${escapeHtml(`#${row.displayPosition} · ${getMoveCharacterPlainLabel(row.item, 'Unnamed')}`)}
      </option>
    `).join('');

    targetSelect.innerHTML = `<option value="">End Of Divider</option>${rowOptions}`;
    if (previousTargetId && rows.some(row => row.id === previousTargetId)) {
      targetSelect.value = previousTargetId;
    }
    state.scopeCharacterId = targetSelect.value || '';

    if (!state.scopeCharacterId && placementSelect.value !== 'top') {
      placementSelect.value = 'end';
    }

    const placement = placementSelect.value || 'before';
    const rawInsertIndex = getMoveScopedRawInsertIndex(ctx.workingList || [], state.scopeDividerId, state.scopeCharacterId, placement);
    state.scopedRawInsertIndex = Number.isFinite(rawInsertIndex) ? rawInsertIndex : null;

    if (Number.isFinite(state.scopedRawInsertIndex)) {
      const nextPosition = getMoveDisplayPositionBeforeRawIndex(ctx.workingList || [], state.scopedRawInsertIndex);
      if (state.scopeActive && state.input) {
        state.input.value = String(nextPosition);
      }
      const before = ctx.workingList?.[state.scopedRawInsertIndex - 1] || null;
      const after = ctx.workingList?.[state.scopedRawInsertIndex] || null;
      const selectedRow = rows.find(row => row.id === state.scopeCharacterId) || null;
      const targetLabel = placement === 'top'
        ? 'Top Of Divider'
        : placement === 'end' || !selectedRow
          ? 'End Of Divider'
          : `${placement === 'after' ? 'After' : 'Before'} ${selectedRow.label}`;
      const fullNote = `${target?.title || 'Divider'} · ${targetLabel} · between ${getMoveCharacterLabel(before, 'Start')} and ${getMoveCharacterLabel(after, 'End')}`;
      note.textContent = `${target?.title || 'Divider'} · ${targetLabel}`;
      note.title = fullNote;
    } else {
      note.textContent = target ? `${target.title}: no valid target found.` : 'No divider available.';
    }
  }


  function setMoveNewDividerPriorityState(state, isNew) {
    const disabled = !!isNew;
    const toggle = node => {
      if (!node) return;
      node.disabled = disabled;
      node.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    };

    [
      state.scopeDividerSelect,
      state.scopeCharacterSelect,
      state.scopePlacementSelect,
      state.input
    ].forEach(toggle);

    [state.scopePanel, state.advancedDetails].forEach(node => {
      if (!node) return;
      node.classList.toggle('is-disabled-by-new-divider', disabled);
    });

    state.container?.classList?.toggle('is-new-divider-priority', disabled);
    if (state.scopeNote) {
      state.scopeNote.textContent = disabled
        ? 'New divider mode is active. Destination is controlled below by Anchor + Place.'
        : state.scopeNote.textContent;
    }
  }

  function findTopLevelDividerBeforeRawIndex(list, rawIndex) {
    for (let i = Math.min(rawIndex - 1, (list || []).length - 1); i >= 0; i--) {
      const item = list[i];
      if (isDivider(item) && getMoveDividerLevel(item) === 1) return { item, index: i };
    }
    return null;
  }


  function getMoveSelectedPositionContext(selectedIds, targetPosition) {
    const ids = selectedIds instanceof Set
      ? selectedIds
      : new Set(Array.from(selectedIds || []).map(id => String(id || '')).filter(Boolean));
    const selectedCount = ids.size;
    const total = getCharacterCount();
    const target = Math.max(1, Math.min(total, num(targetPosition) || 1));
    const workingList = (app.state.characters || []).filter(item => !(item && !isDivider(item) && ids.has(String(item.id || ''))));

    const rawInsertIndex = getMoveRawIndexForDisplayPositionInList(workingList, target);
    const previousCharacter = getCharacterAtDisplayPositionInList(workingList, target - 1);
    const targetCharacter = getCharacterAtDisplayPositionInList(workingList, target);
    const nextCharacter = getCharacterAtDisplayPositionInList(workingList, target + 1);
    const previousRawItem = workingList[rawInsertIndex - 1] || null;
    const nextRawItem = workingList[rawInsertIndex] || null;
    const previousDivider = findDividerBeforeRawIndex(workingList, rawInsertIndex);
    const nextDivider = findDividerAtOrAfterRawIndex(workingList, rawInsertIndex);
    const blockLabel = `${selectedCount} selected character${selectedCount === 1 ? '' : 's'}`;

    const choices = [
      {
        id: 'default',
        label: 'Exact',
        detail: targetCharacter
          ? `Place ${blockLabel} before ${getMoveCharacterLabel(targetCharacter)}.`
          : `Place ${blockLabel} at the end of the list.`,
        rawInsertIndex
      }
    ];

    if (previousDivider?.item) {
      const previousSectionInsertIndex = nextDivider?.item
        ? nextDivider.index
        : workingList.length;

      choices.push({
        id: 'previous-divider',
        label: 'Keep In',
        detail: `Keep inside ${previousDivider.item.title || 'Previous Divider'} and place before the next divider/end.`,
        dividerTitle: previousDivider.item.title || '',
        rawInsertIndex: previousSectionInsertIndex
      });
    }

    if (nextDivider?.item) {
      choices.push({
        id: 'next-divider',
        label: 'Next In',
        detail: `Move into ${nextDivider.item.title || 'Next Divider'} and place right after its header.`,
        dividerTitle: nextDivider.item.title || '',
        rawInsertIndex: Math.min(workingList.length, nextDivider.index + 1)
      });
    }

    const dividerTargets = getMoveDividerTargetsForList(workingList);
    if (dividerTargets.length) {
      const firstTarget = dividerTargets[0];
      choices.push({
        id: 'direct-divider',
        label: 'Inside',
        detail: `Choose an existing divider/sub-divider and place ${blockLabel} at its top or end.`,
        dividerTitle: firstTarget.title || '',
        dividerTargetId: firstTarget.id,
        rawInsertIndex: firstTarget.rawEndIndex
      });
    }

    choices.push({
      id: 'new-divider',
      label: 'New',
      detail: `Create a new divider/sub-divider at a safe section boundary and place ${blockLabel} under it.`,
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
      dividerTargets,
      choices: uniqueChoices
    };
  }

  function finalizeSelectedMoveFromItems(movingItems, selectedSet, target, sourcePositionById, options = {}) {
    invalidateSearchCache?.();
    assignBoardCounters?.();
    saveLocal?.();
    window.MudaeBoardController?.updateEntriesFromApp?.();

    document.body.classList.add('is-board-focusing');
    if (!reorderExistingBoardFromState(movingItems[0]?.id || '')) {
      renderBoard();
    }

    window.MudaeBoardController?.renderAroundId?.(movingItems[0]?.id || '', { scroll: true, highlight: true });
    setTimeout(() => document.body.classList.remove('is-board-focusing'), 280);
    window.MudaeBoardController?.flushSave?.();

    const getChangedExportNameForItem = (item) => str(item?.exportName || item?.name || '').trim();
    const total = getCharacterCount?.() || (app.state.characters || []).filter(item => item && !isDivider(item)).length;
    const resolvedTarget = getCharacterListPosition?.(movingItems[0]?.id) || target;
    const previousItem = getCharacterAtDisplayPositionInList(app.state.characters, Math.max(1, resolvedTarget - 1));
    const nextItem = getCharacterAtDisplayPositionInList(app.state.characters, resolvedTarget + movingItems.length);
    const changedCommandNames = [
      previousItem && !selectedSet.has(previousItem.id) ? getChangedExportNameForItem(previousItem) : '',
      ...movingItems.map(getChangedExportNameForItem),
      nextItem && !selectedSet.has(nextItem.id) ? getChangedExportNameForItem(nextItem) : ''
    ].filter(Boolean);

    if (window.MudaeExports?.recordChangedRange) {
      const sourcePositions = Array.from(sourcePositionById?.values?.() || []).filter(Boolean);
      const movedNames = movingItems.map(item => item?.name || '').filter(Boolean);
      window.MudaeExports.recordChangedRange(resolvedTarget, resolvedTarget, Math.min(total, resolvedTarget + Math.max(1, changedCommandNames.length) - 1), {
        id: `multi-menu-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: movedNames.length
          ? `${movedNames.slice(0, 3).join(', ')}${movedNames.length > 3 ? ` +${movedNames.length - 3}` : ''}`
          : `${movingItems.length} selected`,
        commandNames: changedCommandNames,
        fromPosition: sourcePositions.length ? Math.min(...sourcePositions) : target
      });
    } else {
      window.MudaeExports?.recordChangedMove?.(0, target, {
        radius: Math.max(1, movingItems.length),
        name: `${movingItems.length} selected`
      });
    }

    app.multiMoveTargetMode = false;
    ensureMultiSelectedSet().clear();
    document.body.classList.toggle('is-multi-move-target-mode', false);
    els.board?.querySelectorAll?.('.multi-selected-card').forEach(node => node.classList.remove('multi-selected-card'));
    dispatchMultiSelectChange?.();

    notifyAppMessage(options.message || `Moved ${movingItems.length} selected character${movingItems.length === 1 ? '' : 's'} to #${resolvedTarget}.`);
    return true;
  }

  function moveSelectedCharactersToRawInsertIndex(rawInsertIndex, targetPosition = null, options = {}) {
    const { selectedIds, movingItems } = getSelectedMoveItemsAndIds();
    if (!movingItems.length) {
      notifyAppMessage('Select One Or More Characters First.');
      return false;
    }

    const sourcePositionById = new Map(
      movingItems.map(item => [item.id, getCharacterDisplayPositionById(item.id) || getCharacterListPosition(item.id) || 0])
    );

    const remainingItems = (app.state.characters || []).filter(item => !(item && !isDivider(item) && selectedIds.has(String(item.id || ''))));
    const insertIndex = Math.max(0, Math.min(remainingItems.length, Number(rawInsertIndex) || 0));

    app.state.characters = [
      ...remainingItems.slice(0, insertIndex),
      ...movingItems,
      ...remainingItems.slice(insertIndex)
    ];

    const resolvedTarget = Math.max(1, Math.min(getCharacterCount?.() || 1, num(targetPosition) || getDisplayPositionForSelectedBlock(true) || 1));
    return finalizeSelectedMoveFromItems(movingItems, selectedIds, resolvedTarget, sourcePositionById, options);
  }

  function createLocalDividerId(prefix = 'divider') {
    return createImportFallbackId(prefix, Math.floor(Math.random() * 100000));
  }

  function moveSelectedCharactersWithNewDivider(rawInsertIndex, title = '', level = 1, targetPosition = null) {
    const { selectedIds, movingItems } = getSelectedMoveItemsAndIds();
    if (!movingItems.length) {
      notifyAppMessage('Select One Or More Characters First.');
      return false;
    }

    const sourcePositionById = new Map(
      movingItems.map(item => [item.id, getCharacterDisplayPositionById(item.id) || getCharacterListPosition(item.id) || 0])
    );
    const remainingItems = (app.state.characters || []).filter(item => !(item && !isDivider(item) && selectedIds.has(String(item.id || ''))));
    const insertIndex = Math.max(0, Math.min(remainingItems.length, Number(rawInsertIndex) || 0));
    const first = movingItems[0];
    const divider = {
      id: createLocalDividerId('divider'),
      type: 'divider',
      title: String(title || first?.series || first?.name || 'New Divider').trim(),
      note: '',
      level: Math.max(1, Math.min(2, Number(level) || 1)),
      color: Number(level) > 1 ? '#38bdf8' : '#8b5cf6',
      collapsed: false
    };

    app.state.characters = [
      ...remainingItems.slice(0, insertIndex),
      divider,
      ...movingItems,
      ...remainingItems.slice(insertIndex)
    ];

    const resolvedTarget = Math.max(1, Math.min(getCharacterCount?.() || 1, num(targetPosition) || getDisplayPositionForSelectedBlock(true) || 1));
    return finalizeSelectedMoveFromItems(movingItems, selectedIds, resolvedTarget, sourcePositionById, {
      message: `Moved ${movingItems.length} selected character${movingItems.length === 1 ? '' : 's'} into a new divider.`
    });
  }

  function renderMoveSelectedContext(content, state) {
    const shortLabel = (item, fallback = '—') => getMoveCharacterLabel(item, fallback);

    const update = () => {
      const target = Math.max(1, Math.min(state.total, num(state.input.value) || 1));
      state.context = getMoveSelectedPositionContext(state.selectedIds, target);

      const ctx = state.context;
      const valid = !!target && target >= 1 && target <= state.total;
      state.input.classList.toggle('is-invalid-move-target', !valid);

      const rows = [
        { label: `#${Math.max(1, target - 1)}`, item: ctx.previousCharacter, role: 'Before' },
        { label: `#${target}`, customLabel: getMoveBlockPreviewLabel(state, 'Selected Characters'), role: 'Target' },
        { label: `#${Math.min(state.total, target + state.count)}`, item: ctx.targetCharacter || ctx.nextCharacter, role: 'After' }
      ];

      state.preview.innerHTML = rows.map(row => {
        const label = row.customLabel || shortLabel(row.item, row.role === 'Target' ? 'Selected Characters' : '—');
        return `
          <div class="move-context-row ${row.role === 'Target' ? 'is-target' : ''}">
            <span class="move-context-pos">${escapeHtml(row.label)}</span>
            <span class="move-context-role">${escapeHtml(row.role)}</span>
            <strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
          </div>
        `;
      }).join('');

      const beforeRaw = ctx.previousRawItem ? shortLabel(ctx.previousRawItem) : 'Start Of List';
      const afterRaw = ctx.nextRawItem ? shortLabel(ctx.nextRawItem) : 'End Of List';
      const dividerTitle = ctx.previousDivider?.item?.title || '';
      const nextDividerTitle = ctx.nextDivider?.item?.title || '';

      state.boundary.innerHTML = `
        <span><b>Before Raw</b>${escapeHtml(beforeRaw)}</span>
        <span><b>After Raw</b>${escapeHtml(afterRaw)}</span>
        <span><b>Divider</b>${escapeHtml(dividerTitle ? `Inside ${dividerTitle}` : 'No Previous Divider')}</span>
        <span><b>Next Divider</b>${escapeHtml(nextDividerTitle || 'End Of Section')}</span>
      `;

      const visibleChoices = ctx.choices.filter(choice => choice.id !== 'direct-divider');
      state.choices.innerHTML = visibleChoices.map((choice, index) => `
        <label class="move-divider-choice ${choice.id === 'new-divider' ? 'is-new-divider' : ''} ${choice.id === 'direct-divider' ? 'is-direct-divider' : ''} ${index === 0 ? 'is-default' : ''}" title="${escapeHtml(choice.detail || choice.label || '')}">
          <input type="radio" name="moveSelectedDividerChoice" value="${escapeHtml(choice.id)}" ${state.choiceId === choice.id || (!state.choiceId && index === 0) ? 'checked' : ''}>
          <span>
            <strong>${escapeHtml(choice.label)}</strong>
            <small>${escapeHtml(choice.detail || '')}</small>
          </span>
        </label>
      `).join('');

      state.choiceId = state.choices.querySelector('input:checked')?.value || 'default';

      const syncNewDividerPanel = () => {
        const isDirect = state.choiceId === 'direct-divider';
        const isNew = state.choiceId === 'new-divider';

        if (state.directDividerPanel) {
          const targets = ctx.dividerTargets || [];
          const hasTargets = targets.length > 0;
          state.directDividerPanel.hidden = !hasTargets;
          state.directDividerPanel.classList.toggle('is-visible', hasTargets);
          state.directDividerPanel.classList.toggle('is-active', isDirect);

          const previousValue = state.directDividerSelect?.value || state.directDividerId || '';
          if (state.directDividerSelect) {
            state.directDividerSelect.innerHTML = targets.map(target => `
              <option value="${escapeHtml(target.id)}" ${previousValue === target.id ? 'selected' : ''}>
                ${escapeHtml(`${target.level > 1 ? '↳ ' : ''}${target.title}`)}
              </option>
            `).join('');
            if (previousValue && targets.some(target => target.id === previousValue)) {
              state.directDividerSelect.value = previousValue;
            }
            state.directDividerId = state.directDividerSelect.value || targets[0]?.id || '';
          }

          const selectedTarget = targets.find(target => target.id === state.directDividerId) || targets[0] || null;
          const placement = state.directDividerPlacement?.value || 'end';
          if (selectedTarget && state.directDividerNote) {
            const rawIndex = placement === 'top' ? selectedTarget.rawTopIndex : selectedTarget.rawEndIndex;
            const before = ctx.workingList?.[rawIndex - 1] || null;
            const after = ctx.workingList?.[rawIndex] || null;
            const actionHint = isDirect ? 'Selected destination' : 'Choose a divider here to move directly into it';
            state.directDividerNote.textContent = `${actionHint}: ${placement === 'top' ? 'Top' : 'End'} inside ${selectedTarget.title} · between ${getMoveCharacterLabel(before, 'Start')} and ${getMoveCharacterLabel(after, 'End')}`;
          } else if (state.directDividerNote) {
            state.directDividerNote.textContent = 'No divider available.';
          }
        }

        state.newDividerPanel.hidden = !isNew;
        state.newDividerPanel.classList.toggle('is-visible', isNew);
        setMoveNewDividerPriorityState(state, isNew);

        if (isNew && !state.newDividerTitle.value.trim()) {
          const first = state.movingItems[0];
          state.newDividerTitle.value = first?.series || first?.name || 'New Divider';
        }

        if (state.newDividerAnchorSelect) {
          const targets = ctx.dividerTargets || [];
          const previousAnchor = state.newDividerAnchorSelect.value || state.newDividerAnchorId || state.scopeDividerId || '';
          state.newDividerAnchorSelect.innerHTML = targets.map(target => `
            <option value="${escapeHtml(target.id)}" ${previousAnchor === target.id ? 'selected' : ''}>
              ${escapeHtml(`${target.level > 1 ? '↳ ' : ''}${target.title}`)}
            </option>
          `).join('');
          if (previousAnchor && targets.some(target => target.id === previousAnchor)) {
            state.newDividerAnchorSelect.value = previousAnchor;
          }
          state.newDividerAnchorId = state.newDividerAnchorSelect.value || targets[0]?.id || '';
        }

        if (state.newDividerNote) {
          const anchor = getMoveDividerTargetById(ctx.workingList || [], state.newDividerAnchorId);
          const placement = state.newDividerPlacementSelect?.value || 'after';
          state.newDividerNote.textContent = anchor
            ? `New divider will be created ${placement === 'before' ? 'before' : 'after'} ${anchor.title}.`
            : 'No divider available for the new divider anchor.';
        }
      };

      const selectDirectDividerChoice = () => {
        const directRadio = state.choices.querySelector('input[name="moveSelectedDividerChoice"][value="direct-divider"]');
        if (directRadio && !directRadio.checked) {
          directRadio.checked = true;
          state.choiceId = 'direct-divider';
        }
      };

      state.choices.querySelectorAll('input[name="moveSelectedDividerChoice"]').forEach(input => {
        input.addEventListener('change', () => {
          state.choiceId = input.value;
          syncNewDividerPanel();
        });
      });

      state.directDividerSelect?.addEventListener('focus', () => {
        selectDirectDividerChoice();
        syncNewDividerPanel();
      });

      state.directDividerSelect?.addEventListener('change', () => {
        state.directDividerId = state.directDividerSelect.value;
        selectDirectDividerChoice();
        syncNewDividerPanel();
      });

      state.directDividerPlacement?.addEventListener('change', () => {
        selectDirectDividerChoice();
        syncNewDividerPanel();
      });

      state.newDividerAnchorSelect?.addEventListener('change', () => {
        state.newDividerAnchorId = state.newDividerAnchorSelect.value;
        state.choiceId = 'new-divider';
        syncNewDividerPanel();
      });

      state.newDividerPlacementSelect?.addEventListener('change', () => {
        state.choiceId = 'new-divider';
        syncNewDividerPanel();
      });

      syncNewDividerPanel();
      renderMoveScopedDividerPanel(state);
      setMoveNewDividerPriorityState(state, state.choiceId === 'new-divider');
    };

    const first = state.movingItems[0];
    const last = state.movingItems[state.movingItems.length - 1];
    const defaultDividerTitle = first?.series || first?.name || 'New Divider';

    content.innerHTML = `
      <div class="move-character-dialog move-selected-dialog mhp-menu-standard mhp-move-menu">
        <div class="move-selected-summary">
          <strong>${escapeHtml(state.count)} Selected</strong>
          <span>${escapeHtml(first?.name || 'First selected')} → ${escapeHtml(last?.name || 'Last selected')}</span>
        </div>
        <section class="move-character-section move-main-destination-section">
          <h4>Destination</h4>
          <div class="move-divider-scope-panel">
            <label>
              <span>View From</span>
              <select id="moveSelectedScopeDivider"></select>
            </label>
            <label>
              <span>Character</span>
              <select id="moveSelectedScopeCharacter"></select>
            </label>
            <label>
              <span>Place</span>
              <select id="moveSelectedScopePlacement">
                <option value="before">Before</option>
                <option value="after">After</option>
                <option value="top">Top</option>
                <option value="end">End</option>
              </select>
            </label>
            <small class="move-divider-scope-note"></small>
          </div>
        </section>

        <details class="move-advanced-details">
          <summary>Advanced: exact number / raw details</summary>
          <label class="move-character-input-row mhp-menu-field-row">
            <span>Position</span>
            <input id="moveSelectedTargetInput" type="number" min="1" max="${state.total}" value="${state.current || ''}" inputmode="numeric">
          </label>
          <div class="move-character-context-preview"></div>
          <div class="move-character-boundary"></div>
        </details>

        <section class="move-character-section move-extra-placement-section">
          <h4>Placement</h4>
          <div class="move-divider-choice-list"></div>
          <div class="move-new-divider-panel" hidden>
            <label>
              <span>Name</span>
              <input id="moveSelectedNewDividerTitle" type="text" value="${escapeHtml(defaultDividerTitle)}">
            </label>
            <label>
              <span>Type</span>
              <select id="moveSelectedNewDividerLevel">
                <option value="1">Divider</option>
                <option value="2">Sub-Divider</option>
              </select>
            </label>
            <label>
              <span>Anchor</span>
              <select id="moveSelectedNewDividerAnchor"></select>
            </label>
            <label>
              <span>Place</span>
              <select id="moveSelectedNewDividerPlacement">
                <option value="before">Before Anchor</option>
                <option value="after" selected>After Anchor</option>
              </select>
            </label>
            <small class="move-new-divider-note">Choose the divider/sub-divider where the new section will be inserted.</small>
          </div>
        </section>
      </div>
    `;

    state.input = content.querySelector('#moveSelectedTargetInput');
    state.preview = content.querySelector('.move-character-context-preview');
    state.boundary = content.querySelector('.move-character-boundary');
    state.choices = content.querySelector('.move-divider-choice-list');
    state.container = content.querySelector('.mhp-move-menu');
    state.scopePanel = content.querySelector('.move-divider-scope-panel');
    state.advancedDetails = content.querySelector('.move-advanced-details');
    state.directDividerPanel = content.querySelector('.move-direct-divider-panel');
    state.directDividerSelect = content.querySelector('#moveSelectedDirectDivider');
    state.directDividerPlacement = content.querySelector('#moveSelectedDirectDividerPlacement');
    state.directDividerNote = content.querySelector('.move-direct-divider-note');
    state.scopeDividerSelect = content.querySelector('#moveSelectedScopeDivider');
    state.scopeCharacterSelect = content.querySelector('#moveSelectedScopeCharacter');
    state.scopePlacementSelect = content.querySelector('#moveSelectedScopePlacement');
    state.scopeNote = content.querySelector('.move-divider-scope-note');
    state.newDividerPanel = content.querySelector('.move-new-divider-panel');
    state.newDividerTitle = content.querySelector('#moveSelectedNewDividerTitle');
    state.newDividerLevel = content.querySelector('#moveSelectedNewDividerLevel');
    state.newDividerAnchorSelect = content.querySelector('#moveSelectedNewDividerAnchor');
    state.newDividerPlacementSelect = content.querySelector('#moveSelectedNewDividerPlacement');
    state.newDividerNote = content.querySelector('.move-new-divider-note');

    const activateManualPosition = () => {
      state.scopeActive = false;
      setMoveNewDividerPriorityState(state, state.choiceId === 'new-divider');
    };
    state.input.addEventListener('focus', activateManualPosition);
    state.input.addEventListener('click', activateManualPosition);
    state.input.addEventListener('input', () => {
      activateManualPosition();
      update();
    });
    state.input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        content.closest('.app-dialog-overlay')?.querySelector('.app-dialog-btn.btn-primary')?.click();
      }
    });

    const activateScope = () => {
      state.scopeActive = true;
      renderMoveScopedDividerPanel(state);
      update();
    };
    state.scopeDividerSelect?.addEventListener('change', () => {
      state.scopeDividerId = state.scopeDividerSelect.value;
      state.scopeCharacterId = '';
      activateScope();
    });
    state.scopeCharacterSelect?.addEventListener('change', () => {
      state.scopeCharacterId = state.scopeCharacterSelect.value;
      activateScope();
    });
    state.scopePlacementSelect?.addEventListener('change', activateScope);

    update();

    requestAnimationFrame(() => {
      content.closest?.('.app-dialog, [role="dialog"], .app-dialog-overlay')?.classList?.add('move-character-modal', 'move-selected-modal');
      (state.scopeDividerSelect || state.input)?.focus({ preventScroll: true });
    });
  }

  function moveCharacterWithNewDivider(sourceId, rawInsertIndex, title = '', level = 1) {
    const sourceIndex = getCharacterRawIndexById(sourceId);
    const sourcePosition = getCharacterListPosition(sourceId);

    if (sourceIndex < 0 || !sourcePosition) return false;

    const item = app.state.characters[sourceIndex];
    if (!item || isDivider(item)) return false;

    const divider = {
      id: createLocalDividerId('divider'),
      type: 'divider',
      title: String(title || item.series || item.name || 'New Divider').trim(),
      note: '',
      level: Math.max(1, Math.min(2, Number(level) || 1)),
      color: Number(level) > 1 ? '#38bdf8' : '#8b5cf6',
      collapsed: false
    };

    const filteredMoveSnapshot = captureFilteredMoveViewSnapshot?.();
    const [removedItem] = app.state.characters.splice(sourceIndex, 1);
    const insertIndex = Math.max(0, Math.min(app.state.characters.length, Number(rawInsertIndex) || 0));
    app.state.characters.splice(insertIndex, 0, divider, removedItem);

    if (isBoardFiltered?.()) {
      finalizeFilteredMoveRender?.(sourceId, filteredMoveSnapshot);
    } else {
      finalizeCharacterMoveRender(sourceId);
    }
    window.MudaeExports?.recordChangedMoveById?.(sourceId, sourcePosition, { radius: 1 });

    return true;
  }


  function moveCharacterToRawInsertIndex(sourceId, rawInsertIndex) {
    const sourceIndex = getCharacterRawIndexById(sourceId);
    const sourcePosition = getCharacterListPosition(sourceId);

    if (sourceIndex < 0 || !sourcePosition) return false;

    const filteredMoveSnapshot = captureFilteredMoveViewSnapshot?.();
    const [item] = app.state.characters.splice(sourceIndex, 1);
    let insertIndex = Math.max(0, Math.min(app.state.characters.length, Number(rawInsertIndex) || 0));

    // rawInsertIndex is calculated against the list without the source item.
    app.state.characters.splice(insertIndex, 0, item);

    if (isBoardFiltered?.()) {
      finalizeFilteredMoveRender?.(sourceId, filteredMoveSnapshot);
    } else {
      finalizeCharacterMoveRender(sourceId);
    }
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
        { label: `#${target}`, customLabel: getMoveBlockPreviewLabel(state, 'Moving Character'), role: 'Target' },
        { label: `#${Math.min(state.total, target + 1)}`, item: ctx.targetCharacter || ctx.nextCharacter, role: 'After' }
      ];

      state.preview.innerHTML = rows.map(row => {
        const label = row.customLabel || shortLabel(row.item, row.role === 'Target' ? 'Moving Character' : '—');
        return `
          <div class="move-context-row ${row.role === 'Target' ? 'is-target' : ''}">
            <span class="move-context-pos">${escapeHtml(row.label)}</span>
            <span class="move-context-role">${escapeHtml(row.role)}</span>
            <strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
          </div>
        `;
      }).join('');

      const beforeRaw = ctx.previousRawItem ? shortLabel(ctx.previousRawItem) : 'Start Of List';
      const afterRaw = ctx.nextRawItem ? shortLabel(ctx.nextRawItem) : 'End Of List';

      state.boundary.innerHTML = `
        <span><b>Before Raw</b>${escapeHtml(beforeRaw)}</span>
        <span><b>After Raw</b>${escapeHtml(afterRaw)}</span>
      `;

      const visibleChoices = ctx.choices.filter(choice => choice.id !== 'direct-divider');
      state.choices.innerHTML = visibleChoices.map((choice, index) => `
        <label class="move-divider-choice ${choice.id === 'new-divider' ? 'is-new-divider' : ''} ${choice.id === 'direct-divider' ? 'is-direct-divider' : ''} ${index === 0 ? 'is-default' : ''}" title="${escapeHtml(choice.detail || choice.label || '')}">
          <input type="radio" name="moveDividerChoice" value="${escapeHtml(choice.id)}" ${state.choiceId === choice.id || (!state.choiceId && index === 0) ? 'checked' : ''}>
          <span>
            <strong>${escapeHtml(choice.label)}</strong>
            <small>${escapeHtml(choice.detail || '')}</small>
          </span>
        </label>
      `).join('');

      state.choiceId = state.choices.querySelector('input:checked')?.value || 'default';

      const syncPanels = () => {
        const isDirect = state.choiceId === 'direct-divider';
        const isNew = state.choiceId === 'new-divider';

        if (state.directDividerPanel) {
          const targets = ctx.dividerTargets || [];
          const hasTargets = targets.length > 0;
          state.directDividerPanel.hidden = !hasTargets;
          state.directDividerPanel.classList.toggle('is-visible', hasTargets);
          state.directDividerPanel.classList.toggle('is-active', isDirect);

          const previousValue = state.directDividerSelect?.value || state.directDividerId || '';
          if (state.directDividerSelect) {
            state.directDividerSelect.innerHTML = targets.map(target => `
              <option value="${escapeHtml(target.id)}" ${previousValue === target.id ? 'selected' : ''}>
                ${escapeHtml(`${target.level > 1 ? '↳ ' : ''}${target.title}`)}
              </option>
            `).join('');
            if (previousValue && targets.some(target => target.id === previousValue)) {
              state.directDividerSelect.value = previousValue;
            }
            state.directDividerId = state.directDividerSelect.value || targets[0]?.id || '';
          }

          const selectedTarget = targets.find(target => target.id === state.directDividerId) || targets[0] || null;
          const placement = state.directDividerPlacement?.value || 'end';
          if (selectedTarget && state.directDividerNote) {
            const rawIndex = placement === 'top' ? selectedTarget.rawTopIndex : selectedTarget.rawEndIndex;
            const before = ctx.workingList?.[rawIndex - 1] || null;
            const after = ctx.workingList?.[rawIndex] || null;
            const actionHint = isDirect ? 'Selected Destination' : 'Choose A Divider Here To Move Directly Into It';
            state.directDividerNote.textContent = `${actionHint}: ${placement === 'top' ? 'Top' : 'End'} inside ${selectedTarget.title} · between ${getMoveCharacterLabel(before, 'Start')} and ${getMoveCharacterLabel(after, 'End')}`;
          } else if (state.directDividerNote) {
            state.directDividerNote.textContent = 'No Divider Available.';
          }
        }

        state.newDividerPanel.hidden = !isNew;
        state.newDividerPanel.classList.toggle('is-visible', isNew);
        setMoveNewDividerPriorityState(state, isNew);

        if (isNew && !state.newDividerTitle.value.trim()) {
          const source = getCharacter(state.sourceId);
          state.newDividerTitle.value = source?.series || source?.name || 'New Divider';
        }

        if (state.newDividerAnchorSelect) {
          const targets = ctx.dividerTargets || [];
          const previousAnchor = state.newDividerAnchorSelect.value || state.newDividerAnchorId || state.scopeDividerId || '';
          state.newDividerAnchorSelect.innerHTML = targets.map(target => `
            <option value="${escapeHtml(target.id)}" ${previousAnchor === target.id ? 'selected' : ''}>
              ${escapeHtml(`${target.level > 1 ? '↳ ' : ''}${target.title}`)}
            </option>
          `).join('');
          if (previousAnchor && targets.some(target => target.id === previousAnchor)) {
            state.newDividerAnchorSelect.value = previousAnchor;
          }
          state.newDividerAnchorId = state.newDividerAnchorSelect.value || targets[0]?.id || '';
        }

        if (state.newDividerNote) {
          const anchor = getMoveDividerTargetById(ctx.workingList || [], state.newDividerAnchorId);
          const placement = state.newDividerPlacementSelect?.value || 'after';
          state.newDividerNote.textContent = anchor
            ? `New divider will be created ${placement === 'before' ? 'before' : 'after'} ${anchor.title}.`
            : 'No divider available for the new divider anchor.';
        }
      };

      const selectDirectDividerChoice = () => {
        const directRadio = state.choices.querySelector('input[name="moveDividerChoice"][value="direct-divider"]');
        if (directRadio && !directRadio.checked) {
          directRadio.checked = true;
          state.choiceId = 'direct-divider';
        }
      };

      state.choices.querySelectorAll('input[name="moveDividerChoice"]').forEach(input => {
        input.addEventListener('change', () => {
          state.choiceId = input.value;
          syncPanels();
        });
      });

      state.directDividerSelect?.addEventListener('focus', () => {
        selectDirectDividerChoice();
        syncPanels();
      });

      state.directDividerSelect?.addEventListener('change', () => {
        state.directDividerId = state.directDividerSelect.value;
        selectDirectDividerChoice();
        syncPanels();
      });

      state.directDividerPlacement?.addEventListener('change', () => {
        selectDirectDividerChoice();
        syncPanels();
      });

      state.newDividerAnchorSelect?.addEventListener('change', () => {
        state.newDividerAnchorId = state.newDividerAnchorSelect.value;
        state.choiceId = 'new-divider';
        syncPanels();
      });

      state.newDividerPlacementSelect?.addEventListener('change', () => {
        state.choiceId = 'new-divider';
        syncPanels();
      });

      syncPanels();
      renderMoveScopedDividerPanel(state);
      setMoveNewDividerPriorityState(state, state.choiceId === 'new-divider');
    };

    const source = getCharacter(state.sourceId);
    const defaultDividerTitle = source?.series || source?.name || 'New Divider';

    content.innerHTML = `
      <div class="move-character-dialog mhp-menu-standard mhp-move-menu">
        <section class="move-character-section move-main-destination-section">
          <h4>Destination</h4>
          <div class="move-divider-scope-panel">
            <label>
              <span>View From</span>
              <select id="moveCharacterScopeDivider"></select>
            </label>
            <label>
              <span>Character</span>
              <select id="moveCharacterScopeCharacter"></select>
            </label>
            <label>
              <span>Place</span>
              <select id="moveCharacterScopePlacement">
                <option value="before">Before</option>
                <option value="after">After</option>
                <option value="top">Top</option>
                <option value="end">End</option>
              </select>
            </label>
            <small class="move-divider-scope-note"></small>
          </div>
        </section>

        <details class="move-advanced-details">
          <summary>Advanced: exact number / raw details</summary>
          <label class="move-character-input-row mhp-menu-field-row">
            <span>Position</span>
            <input id="moveCharacterTargetInput" type="number" min="1" max="${state.total}" value="${state.current || ''}" inputmode="numeric">
          </label>
          <div class="move-character-context-preview"></div>
          <div class="move-character-boundary"></div>
        </details>

        <section class="move-character-section move-extra-placement-section">
          <h4>Placement</h4>
          <div class="move-divider-choice-list"></div>
          <div class="move-new-divider-panel" hidden>
            <label>
              <span>Name</span>
              <input id="moveNewDividerTitle" type="text" value="${escapeHtml(defaultDividerTitle)}">
            </label>
            <label>
              <span>Type</span>
              <select id="moveNewDividerLevel">
                <option value="1">Divider</option>
                <option value="2">Sub-Divider</option>
              </select>
            </label>
            <label>
              <span>Anchor</span>
              <select id="moveNewDividerAnchor"></select>
            </label>
            <label>
              <span>Place</span>
              <select id="moveNewDividerPlacement">
                <option value="before">Before Anchor</option>
                <option value="after" selected>After Anchor</option>
              </select>
            </label>
            <small class="move-new-divider-note">Choose the divider/sub-divider where the new section will be inserted.</small>
          </div>
        </section>
      </div>
    `;

    state.input = content.querySelector('#moveCharacterTargetInput');
    state.preview = content.querySelector('.move-character-context-preview');
    state.boundary = content.querySelector('.move-character-boundary');
    state.choices = content.querySelector('.move-divider-choice-list');
    state.container = content.querySelector('.mhp-move-menu');
    state.scopePanel = content.querySelector('.move-divider-scope-panel');
    state.advancedDetails = content.querySelector('.move-advanced-details');
    state.directDividerPanel = content.querySelector('.move-direct-divider-panel');
    state.directDividerSelect = content.querySelector('#moveCharacterDirectDivider');
    state.directDividerPlacement = content.querySelector('#moveCharacterDirectDividerPlacement');
    state.directDividerNote = content.querySelector('.move-direct-divider-note');
    state.scopeDividerSelect = content.querySelector('#moveCharacterScopeDivider');
    state.scopeCharacterSelect = content.querySelector('#moveCharacterScopeCharacter');
    state.scopePlacementSelect = content.querySelector('#moveCharacterScopePlacement');
    state.scopeNote = content.querySelector('.move-divider-scope-note');
    state.newDividerPanel = content.querySelector('.move-new-divider-panel');
    state.newDividerTitle = content.querySelector('#moveNewDividerTitle');
    state.newDividerLevel = content.querySelector('#moveNewDividerLevel');
    state.newDividerAnchorSelect = content.querySelector('#moveNewDividerAnchor');
    state.newDividerPlacementSelect = content.querySelector('#moveNewDividerPlacement');
    state.newDividerNote = content.querySelector('.move-new-divider-note');

    const activateManualPosition = () => {
      state.scopeActive = false;
      setMoveNewDividerPriorityState(state, state.choiceId === 'new-divider');
    };
    state.input.addEventListener('focus', activateManualPosition);
    state.input.addEventListener('click', activateManualPosition);
    state.input.addEventListener('input', () => {
      activateManualPosition();
      update();
    });
    state.input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        content.closest('.app-dialog-overlay')?.querySelector('.app-dialog-btn.btn-primary')?.click();
      }
    });

    const activateScope = () => {
      state.scopeActive = true;
      renderMoveScopedDividerPanel(state);
      update();
    };
    state.scopeDividerSelect?.addEventListener('change', () => {
      state.scopeDividerId = state.scopeDividerSelect.value;
      state.scopeCharacterId = '';
      activateScope();
    });
    state.scopeCharacterSelect?.addEventListener('change', () => {
      state.scopeCharacterId = state.scopeCharacterSelect.value;
      activateScope();
    });
    state.scopePlacementSelect?.addEventListener('change', activateScope);

    update();

    requestAnimationFrame(() => {
      content.closest?.('.app-dialog, [role="dialog"], .app-dialog-overlay')?.classList?.add('move-character-modal');
      (state.scopeDividerSelect || state.input)?.focus({ preventScroll: true });
    });
  }

  async function promptMoveCharacter(id) {
    const ch = getCharacter(id);
    if (!ch || isDivider(ch)) return;

    const current = getCharacterListPosition(id);
    const total = getCharacterCount();
    const initialMoveContext = getMovePositionContext(id, current);

    const dialogState = {
      sourceId: id,
      current,
      total,
      choiceId: 'default',
      scopeActive: true,
      scopeDividerId: initialMoveContext.previousDivider?.item?.id || initialMoveContext.dividerTargets?.[0]?.id || '',
      context: initialMoveContext
    };

    const ok = await showAppDialog({
      type: 'confirm',
      title: 'Move Character',
      message: 'Choose a divider destination or open advanced exact position.',
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
        title: 'Invalid Position',
        variant: 'danger'
      });
      return;
    }

    const ctx = getMovePositionContext(id, target);
    const choice = ctx.choices.find(item => item.id === dialogState.choiceId) || ctx.choices[0];

    if (choice?.id === 'new-divider') {
      const title = dialogState.newDividerTitle?.value?.trim() || ch.series || ch.name || 'New Divider';
      const level = num(dialogState.newDividerLevel?.value) || 1;
      const workingList = ctx.workingList || app.state.characters || [];
      const anchorRawInsertIndex = getMoveNewDividerRawInsertIndex(workingList, dialogState.newDividerAnchorSelect?.value || dialogState.newDividerAnchorId || '', dialogState.newDividerPlacementSelect?.value || 'after');
      const rawDestination = Number.isFinite(anchorRawInsertIndex)
        ? anchorRawInsertIndex
        : Number.isFinite(dialogState.scopedRawInsertIndex)
          ? dialogState.scopedRawInsertIndex
          : choice.rawInsertIndex;
      moveCharacterWithNewDivider(id, rawDestination, title, level);
      return;
    }

    if (dialogState.scopeActive && Number.isFinite(dialogState.scopedRawInsertIndex)) {
      moveCharacterToRawInsertIndex(id, dialogState.scopedRawInsertIndex);
      return;
    }

    if (choice?.id === 'direct-divider') {
      const dividerId = dialogState.directDividerSelect?.value || dialogState.directDividerId || choice.dividerTargetId || '';
      const placement = dialogState.directDividerPlacement?.value || 'end';
      const dividerTarget = getMoveDividerTargetById(ctx.workingList, dividerId);
      const rawInsertIndex = placement === 'top'
        ? dividerTarget?.rawTopIndex
        : dividerTarget?.rawEndIndex;
      if (dividerTarget && Number.isFinite(rawInsertIndex)) {
        moveCharacterToRawInsertIndex(id, rawInsertIndex);
        return;
      }
    }

    if (choice && choice.id !== 'default') {
      moveCharacterToRawInsertIndex(id, choice.rawInsertIndex);
      return;
    }

    moveCharacterToPosition(id, target);
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

  function bindMoveCancelShortcut() {
    if (app.moveCancelShortcutBound) return;
    app.moveCancelShortcutBound = true;

    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!app.selectedMoveCharacterId) return;

      clearSelectedMoveCharacter();
      notifyMoveMessage('Move cancelled.');
    });
  }
  const notifyMoveMessage = notifyAppMessage;
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
    node.title = node.title || 'Click image to select/move. Click left/right side of the target image to place before/after. Click # for exact position.';

    const getTwoClickTargetPlacement = event => {
      const targetCard = event?.target?.closest?.('.char-card[data-id]') || node;
      const rect = targetCard?.getBoundingClientRect?.();

      if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.width) || rect.width <= 0) {
        return null;
      }

      const clickX = Number(event?.clientX);
      if (!Number.isFinite(clickX)) return null;

      return clickX < rect.left + rect.width / 2 ? 'before' : 'after';
    };

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
        notifyMoveMessage(`Selected ${ch.name}. Click the left side of another image to place before it, or the right side to place after it.`);
        return;
      }

      if (selected === ch.id) {
        window.MudaeBoardController?.clearSelection?.();
        notifyMoveMessage('Move cancelled.');
        return;
      }

      window.MudaeBoardController?.moveSourceToTarget?.(ch.id, getTwoClickTargetPlacement(event));
    };

    const img = node.querySelector('img');
    if (img) {
      img.draggable = false;
      img.classList.add('card-image-move-target');
      img.title = 'Click image to select/move. As target: left side = before, right side = after.';
      img.addEventListener('click', runTwoClickMove);
    }

    const imageArea = node.querySelector('.card-image, .char-image, .card-img-wrap, .image-wrap, .char-img-wrap, .card-media, .char-media');
    if (imageArea && imageArea !== img) {
      imageArea.classList.add('card-image-move-target');
      imageArea.title = 'Click image to select/move. As target: left side = before, right side = after.';
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
    document.documentElement.classList.add('modal-open');
    lockPageScroll();

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
        const totalGalleryCount = getUniqueGalleryImageCount(ch);
        if (totalGalleryCount > 0 && (urls.length > 1 || dedupeCustomImageUrls(ch.customImages || []).length > 0)) {
          openGallery('saved');
          renderGallery(getCombinedGalleryItemsForActive(buildGalleryItemsFromCharacter(ch), buildCustomGalleryItemsFromCharacter(ch)), { fastOpen: true });
          const customCount = dedupeCustomImageUrls(ch.customImages || []).length;
          setGalleryStatus(`Loaded saved gallery automatically${customCount ? ` · ${customCount} custom` : ''}.`);
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
    closeGalleryTagPopup?.();
    suspendPerformanceGifControlForModalClose(1100, 'edit-close');
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
      btn.style.setProperty('--mhp-swatch-color', color);
      btn.style.setProperty('background-color', color, 'important');
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
    syncEditPreviewGalleryIndex(url);
    syncMainGalleryIndicators(url);
  }

  function lockPageScroll() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;

    if (!document.body.dataset.lockScrollY) {
      document.body.dataset.lockScrollY = String(y);
    }

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
    suspendPerformanceGifControlForModalClose(1100, 'edit-close-no-restore');
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
    els.galleryPanel.classList.remove('mhp-gallery-media-closing', 'mhp-gallery-panel-instant-hidden');
    els.galleryPanel.style.removeProperty('display');
    els.galleryPanel.hidden = false;
    els.galleryPanel.removeAttribute('hidden');
    document.body.classList.add('gallery-open');
    els.editBody.classList.add('mudae-side-active');
    els.editModal.classList.add('mudae-side-active');
    els.galleryToggleBtn.textContent = '‹';
    els.galleryToggleBtn.setAttribute('aria-expanded', 'true');
    els.galleryPanel.dataset.openReason = reason;
    refreshGalleryFallbackSearchLink();
  }

  function suspendPerformanceGifControlForModalClose(ms = 900, reason = 'modal-close') {
    try {
      window.MudaeGifControl?.suspend?.(ms, reason);
    } catch (_) {}
  }

  function prepareGalleryMediaForClose() {
    if (!els.galleryPanel) return;

    // Performance Mode can run a GIF refresh while the modal is closing. Suspend
    // it briefly before hiding the gallery so paused GIF posters do not flash
    // behind/inside the edit transition.
    suspendPerformanceGifControlForModalClose(900, 'gallery-close');

    // Hide the whole gallery panel before any GIF/poster cleanup happens.
    // Hiding only media still allowed a one-frame static poster flash on close.
    els.galleryPanel.classList.add('mhp-gallery-media-closing', 'mhp-gallery-panel-instant-hidden');
    els.galleryPanel.style.setProperty('display', 'none', 'important');
  }

  function closeGallery(clear = false) {
    closeGalleryTagPopup?.();
    prepareGalleryMediaForClose();
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

  function refreshBoardAfterGalleryCacheChange(character) {
    if (!character) return;
    const keepScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    saveLocal();

    window.MudaeBoardController?.updateEntriesFromApp?.();
    window.MudaeBoardController?.renderStableAroundId?.(character.id, { highlight: false, forceMs: 1600 });

    requestAnimationFrame(() => {
      window.scrollTo({ top: keepScrollY, behavior: 'auto' });
      requestAnimationFrame(() => window.scrollTo({ top: keepScrollY, behavior: 'auto' }));
    });
  }

  function clearActiveCharacterGalleryCache() {
    const ch = getCharacter(app.activeId);
    if (!ch) return false;

    ch.mudaeImages = [];
    ch.mudaeImageMeta = {};
    ch.customImages = [];
    ch.customImageMeta = {};
    ch.hasMudaeGallery = false;
    ch.mudaeGalleryCount = 0;
    ch.hasCustomGallery = false;
    ch.customGalleryCount = 0;
    app.selectedGalleryIndex = null;
    invalidateSearchCache();

    refreshBoardAfterGalleryCacheChange(ch);

    return true;
  }

  function clearActiveOfficialGalleryCache() {
    const ch = getCharacter(app.activeId);
    if (!ch) return false;

    ch.mudaeImages = [];
    ch.mudaeImageMeta = {};
    ch.hasMudaeGallery = false;
    ch.mudaeGalleryCount = 0;
    app.selectedGalleryIndex = null;
    invalidateSearchCache();

    refreshBoardAfterGalleryCacheChange(ch);
    return true;
  }

  function clearActiveCustomGalleryCache() {
    const ch = getCharacter(app.activeId);
    if (!ch) return false;

    ch.customImages = [];
    ch.customImageMeta = {};
    ch.hasCustomGallery = false;
    ch.customGalleryCount = 0;
    app.selectedGalleryIndex = null;
    invalidateSearchCache();

    refreshBoardAfterGalleryCacheChange(ch);
    return true;
  }

  function clearGallery(clearText = true) {
    closeGalleryTagPopup?.();
    els.galleryGrid.replaceChildren();
    app.selectedGalleryIndex = null;
    app.lastGalleryItems = [];
    app.lastGalleryUrls = [];
    app.galleryMatchedOnly = false;
    app.galleryIgnoreGlobalTagSearch = false;
    if (els.galleryTagSearchInput) els.galleryTagSearchInput.value = '';
    if (els.galleryTagFilterInfo) { els.galleryTagFilterInfo.textContent = ''; els.galleryTagFilterInfo.title = ''; }
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
      const source = item.source === 'custom' ? 'custom' : (item.source || 'mudae');
      return {
        url,
        index: Number.isFinite(rawIndex) && rawIndex > 0 ? rawIndex : fallbackIndex + 1,
        matched: source === 'custom' ? false : !!matched,
        matches: source === 'custom' ? [] : matches,
        mudaeImageId: item.mudaeImageId || item.id || item.imageId || '',
        characterName: item.characterName || item.name || '',
        tags: normalizeGalleryTagList(item.tags),
        artist: Array.isArray(item.artist) ? item.artist : [],
        rating: item.rating ?? null,
        source
      };
    }

    const url = cleanImageUrlForGallery(item || '');
    if (!url || !hasRealImage(url)) return null;
    return { url, index: fallbackIndex + 1, matched: false, matches: [], source: 'mudae' };
  }

  function dedupeGalleryItems(items) {
    const seen = new Set();
    const out = [];
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


  function isAllowedCustomImageHost(url) {
    try {
      const parsed = new URL(String(url || '').trim(), window.location.href);
      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      return host === 'imgur.com' || host === 'i.imgur.com' || host.endsWith('.imgur.com') ||
        host === 'imgchest.com' || host === 'cdn.imgchest.com' || host.endsWith('.imgchest.com');
    } catch {
      return false;
    }
  }

  function normalizeCustomImageUrl(url) {
    const clean = cleanImageUrlForGallery(url || '');
    if (!clean || !hasRealImage(clean) || !isAllowedCustomImageHost(clean)) return '';
    return clean;
  }

  function dedupeCustomImageUrls(urls) {
    const seen = new Set();
    const out = [];
    flattenImageUrlInput(urls).forEach(url => {
      const clean = normalizeCustomImageUrl(url);
      if (!clean) return;
      const key = canonicalImageUrlKey(clean);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    });
    return out;
  }

  function readCustomMetaForUrl(character, url, fallbackIndex = 0) {
    const key = canonicalImageUrlKey(url);
    const metaMap = character && typeof character.customImageMeta === 'object' && character.customImageMeta
      ? character.customImageMeta
      : {};
    return metaMap[key] || metaMap[url] || { index: fallbackIndex + 1, source: 'custom' };
  }

  function buildCustomGalleryItemsFromCharacter(character) {
    const urls = dedupeCustomImageUrls(character?.customImages || []);
    return urls.map((url, index) => {
      const meta = readCustomMetaForUrl(character, url, index);
      return normalizeGalleryItem({
        url,
        index: meta.index || index + 1,
        matched: false,
        matches: [],
        characterName: character?.name || '',
        tags: normalizeGalleryTagList(meta.tags),
        artist: Array.isArray(meta.artist) ? meta.artist : [],
        rating: meta.rating ?? null,
        source: 'custom'
      }, index);
    }).filter(Boolean);
  }

  function splitGalleryItemsBySource(items = []) {
    const official = [];
    const custom = [];
    dedupeGalleryItems(items).forEach(item => {
      if (item?.source === 'custom' || isAllowedCustomImageHost(item?.url)) {
        const url = normalizeCustomImageUrl(item.url);
        if (url) custom.push({ ...item, url, source: 'custom', matched: false, matches: [] });
      } else {
        official.push({ ...item, source: item.source || 'mudae' });
      }
    });
    return { official: dedupeGalleryItems(official), custom: dedupeGalleryItems(custom) };
  }

  function buildCustomImageMetaMap(items) {
    const meta = {};
    dedupeGalleryItems(items).forEach((item, index) => {
      const url = normalizeCustomImageUrl(item.url);
      const key = canonicalImageUrlKey(url);
      if (!url || !key) return;
      meta[key] = {
        index: item.index || index + 1,
        matched: false,
        matches: [],
        characterName: item.characterName || item.name || '',
        tags: normalizeGalleryTagList(item.tags),
        artist: Array.isArray(item.artist) ? item.artist : [],
        rating: item.rating ?? null,
        source: 'custom'
      };
    });
    return meta;
  }

  function getCombinedGalleryItemsForActive(officialItems = null, customItems = null) {
    const ch = getCharacter(app.activeId);
    const official = Array.isArray(officialItems) ? dedupeGalleryItems(officialItems) : buildGalleryItemsFromCharacter(ch);
    const custom = Array.isArray(customItems) ? dedupeGalleryItems(customItems) : buildCustomGalleryItemsFromCharacter(ch);
    return dedupeGalleryItems([...official, ...custom]);
  }


  function getGalleryBadgeLabel(item, renderIndex = 0) {
    const source = item?.source === 'custom' ? 'custom' : 'mudae';
    const displayIndex = Number(renderIndex) + 1;
    if (source === 'custom') return 'C#' + displayIndex;
    const officialIndex = Number(item?.index || 0);
    return '#' + (officialIndex > 0 ? officialIndex : displayIndex);
  }

  function getGalleryBadgeLabelForUrl(url, items = app.lastGalleryItems || []) {
    const key = canonicalImageUrlKey(url);
    if (!key) return '';
    const list = Array.isArray(items) ? items : [];
    for (let index = 0; index < list.length; index++) {
      const item = normalizeGalleryItem(list[index], index);
      if (item && canonicalImageUrlKey(item.url) === key) {
        return getGalleryBadgeLabel(item, index);
      }
    }
    return '';
  }

  function syncEditPreviewGalleryIndex(url = null) {
    if (!els.editPreviewIndexBadge) return;
    const value = url == null ? els.editImageInput?.value?.trim?.() : String(url || '').trim();
    const label = getGalleryBadgeLabelForUrl(value);
    els.editPreviewIndexBadge.textContent = label;
    els.editPreviewIndexBadge.hidden = !label;
    els.editPreviewIndexBadge.title = label ? `Current gallery image ${label}` : '';
  }

  function syncMainGalleryIndicators(url = null) {
    const grid = els.galleryGrid;
    if (!grid) return;
    const value = url == null ? els.editImageInput?.value?.trim?.() : String(url || '').trim();
    const mainKey = canonicalImageUrlKey(value);
    grid.querySelectorAll('.gallery-card').forEach(card => {
      const isMain = !!mainKey && canonicalImageUrlKey(card.dataset.imageUrl || '') === mainKey;
      card.classList.toggle('is-main-gallery-image', isMain);
      card.setAttribute('aria-current', isMain ? 'true' : 'false');

      // Create the MAIN marker only on the active main image.
      card.querySelectorAll('.gallery-main-marker').forEach(marker => marker.remove());
      if (isMain) {
        const marker = document.createElement('span');
        marker.className = 'gallery-main-marker';
        marker.textContent = 'MAIN';
        marker.setAttribute('aria-hidden', 'true');
        card.appendChild(marker);
      }
    });
  }

  function parseCustomGalleryItemsFromText(text) {
    const sourceItems = parseGalleryItemsFromText(text);
    return sourceItems
      .map((item, index) => {
        const url = normalizeCustomImageUrl(item.url);
        if (!url) return null;
        return normalizeGalleryItem({
          ...item,
          url,
          index: item.index || index + 1,
          matched: false,
          matches: [],
          source: 'custom'
        }, index);
      })
      .filter(Boolean);
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
        tags: normalizeGalleryTagList(meta.tags),
        artist: Array.isArray(meta.artist) ? meta.artist : [],
        rating: meta.rating ?? null,
        source: meta.source || 'mudae'
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
        tags: normalizeGalleryTagList(item.tags),
        artist: Array.isArray(item.artist) ? item.artist : [],
        rating: item.rating ?? null,
        source: item.source || 'mudae'
      };
    });
    return meta;
  }

  function applyGalleryVisibilityFilters(options = {}) {
    const grid = els.galleryGrid;
    if (!grid) return { visible: 0, total: 0, tagActive: false };

    const matchedActive = !!app.galleryMatchedOnly;
    const tagSearches = getGalleryTagSearchesForOpenGallery();
    const tagActive = tagSearches.length > 0;
    const items = Array.isArray(app.lastGalleryItems) ? app.lastGalleryItems : [];
    const itemByKey = new Map();

    items.forEach(item => {
      const key = canonicalImageUrlKey(item?.url || '');
      if (key && !itemByKey.has(key)) itemByKey.set(key, item);
    });

    grid.classList.toggle('show-matched-only', matchedActive);
    grid.classList.toggle('show-gallery-tag-filter', tagActive);

    let visible = 0;
    let total = 0;

    grid.querySelectorAll('.gallery-card').forEach(card => {
      total++;
      const matched = card.classList.contains('is-matched') || card.dataset.matched === '1';
      const key = canonicalImageUrlKey(card.dataset.imageUrl || '');
      const item = itemByKey.get(key) || items[Number(card.dataset.index || -1)] || null;
      const tagMatch = !tagActive || tagSearches.some(search => galleryItemMatchesTagSearch(item, search));
      const hide = (matchedActive && !matched) || (tagActive && !tagMatch);

      card.hidden = hide;
      card.classList.toggle('gallery-match-filter-hidden', matchedActive && !matched);
      card.classList.toggle('gallery-tag-filter-hidden', tagActive && !tagMatch);
      card.setAttribute('aria-hidden', hide ? 'true' : 'false');
      if (hide) {
        card.style.setProperty('display', 'none', 'important');
      } else {
        card.style.removeProperty('display');
        visible++;
      }
    });

    if (els.galleryTagFilterInfo) {
      if (tagActive) {
        const labels = tagSearches.map(search => search.raw || `tag:${search.value}`).join(', ');
        els.galleryTagFilterInfo.textContent = `${visible}/${total} image(s)`;
        els.galleryTagFilterInfo.title = `Tag Filter: ${labels}`;
      } else {
        els.galleryTagFilterInfo.textContent = total ? `All ${total}` : '';
        els.galleryTagFilterInfo.title = '';
      }
    }

    if (tagActive && options.updateStatus !== false && els.galleryStatus && els.galleryPanel && !els.galleryPanel.hidden) {
      const labels = tagSearches.map(search => search.raw || `tag:${search.value}`).join(', ');
      const suffix = matchedActive ? ' · Match Filter Active' : '';
      setGalleryStatus(`Showing ${visible} image(s) for ${labels}${suffix}.`);
    } else if (!tagActive && options.updateStatus && els.galleryStatus && els.galleryPanel && !els.galleryPanel.hidden) {
      const suffix = matchedActive ? ' · Match Filter Active' : '';
      setGalleryStatus(`${visible} image(s) shown${suffix}.`);
    }

    return { visible, total, tagActive };
  }

  function applyGalleryMatchedOnlyFilter() {
    return applyGalleryVisibilityFilters({ updateStatus: false });
  }

  function applyGalleryTagSearchFilter(options = {}) {
    return applyGalleryVisibilityFilters(options);
  }

  function scheduleGalleryTagSearchFilter(options = {}) {
    if (app.galleryTagFilterRaf) cancelAnimationFrame(app.galleryTagFilterRaf);
    app.galleryTagFilterRaf = requestAnimationFrame(() => {
      app.galleryTagFilterRaf = 0;
      if (!els.galleryPanel || els.galleryPanel.hidden) return;
      applyGalleryTagSearchFilter(options);
    });
  }

  function syncGalleryMatchControls() {
    const matchedCount = (app.lastGalleryItems || []).filter(item => item?.matched).length;
    if (els.galleryMatchedOnlyBtn) {
      els.galleryMatchedOnlyBtn.disabled = matchedCount <= 0;
      els.galleryMatchedOnlyBtn.classList.toggle('is-active', !!app.galleryMatchedOnly);
      els.galleryMatchedOnlyBtn.setAttribute('aria-pressed', app.galleryMatchedOnly ? 'true' : 'false');
      els.galleryMatchedOnlyBtn.textContent = `Match (${matchedCount})`;
      els.galleryMatchedOnlyBtn.title = matchedCount
        ? (app.galleryMatchedOnly ? 'Show all gallery images' : `Show ${matchedCount} matched image(s) only`)
        : 'No matched images found';
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
    const rawName = String(match.name || match.characterName || match.charName || match.title || '').trim();
    const number = num(match.number || match.index || match.position || match.imageNumber || 0);
    if (!rawName || !number) return '';

    // "Maple {NP}", while Discord commands should keep the local board
    // character name exactly as the user saved it, e.g. "Maple (NP)".
    // Reuse the strict match resolver from v2.693 so this only swaps the
    // display/command name when the local character exists.
    const localCharacter = findCharacterByMatchName(match);
    const commandName = String(localCharacter?.name || rawName).trim();
    if (!commandName) return '';
    return `$c ${commandName}$${number}`;
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
    const split = splitGalleryItemsBySource(items);
    ch.mudaeImages = dedupeCharacterImageUrls(split.official.map(item => item.url));
    ch.mudaeImageMeta = buildGalleryMetaMap(split.official);
    ch.customImages = dedupeCustomImageUrls(split.custom.map(item => item.url));
    ch.customImageMeta = buildCustomImageMetaMap(split.custom);
    syncCustomGalleryFlags(ch);
    syncMudaeGalleryFlags(ch);
    invalidateSearchCache();
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

    // Missing characters from the user's harem should be ignored instead of
    // falling back to substring matches. A partial fallback could map
    // "Moeko Tokita" to "Toki", replacing the wrong character's image.
    // Braces/parentheses and punctuation are still normalized above, but the
    // final target must be an exact normalized name or exact compact name.
    return prepared.find(entry => entry.name === name)?.item ||
      prepared.find(entry => entry.compact && compactName && entry.compact === compactName)?.item ||
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


  function setCharacterMainImageFromMatch(character, url, metaPatch = null) {
    if (!character || !url || !hasRealImage(url)) return false;

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
      tags: normalizeGalleryTagList(item.tags),
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
    const activeCharacterName = String(item.characterName || app.state.characters?.find?.(character => character?.id === app.activeId)?.name || 'Character').trim();
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

  function closeGalleryTagPopup() {
    document.querySelectorAll('.gallery-tag-popup,.gallery-tag-preview-overlay').forEach(node => node.remove());
    document.querySelectorAll('.gallery-card.is-tag-focused').forEach(node => node.classList.remove('is-tag-focused'));
    document.removeEventListener('keydown', onGalleryTagPopupKeydown, true);
  }

  function onGalleryTagPopupKeydown(event) {
    if (event.key === 'Escape') closeGalleryTagPopup();
  }

  function setGalleryTagSearch(tag) {
    const clean = String(tag || '').trim();
    if (!clean) return;
    const query = `tag:"${clean.replace(/"/g, '\\"')}"`;
    app.galleryIgnoreGlobalTagSearch = false;
    if (els.galleryTagSearchInput) els.galleryTagSearchInput.value = clean;
    setUnifiedSearchValue(query);
    scheduleBoardRender?.('gallery-tag-chip-search', { delay: 0 });
    applyGalleryTagSearchFilter({ updateStatus: true });
    els.galleryTagSearchInput?.focus?.({ preventScroll: true });
  }

  function showGalleryTagPopup(item, event, sourceCard = null) {
    closeGalleryTagPopup();

    const tags = getGalleryItemTagLabels(item);
    const overlay = document.createElement('div');
    overlay.className = 'gallery-tag-preview-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Image tags');

    const panel = document.createElement('section');
    panel.className = 'gallery-tag-preview-panel';

    const header = document.createElement('header');
    header.className = 'gallery-tag-preview-head';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `${getGalleryBadgeLabel(item, Number(item?.__renderIndex || 0))} Tags`;
    const subtitle = document.createElement('p');
    subtitle.textContent = tags.length
      ? 'Click a tag to filter this gallery and find images with the same tag.'
      : 'No tags were saved for this image.';
    titleWrap.append(title, subtitle);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-ghost icon-btn';
    closeBtn.setAttribute('aria-label', 'Close image tags');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeGalleryTagPopup);

    header.append(titleWrap, closeBtn);

    const body = document.createElement('div');
    body.className = 'gallery-tag-preview-body';

    const preview = document.createElement('div');
    preview.className = 'gallery-tag-preview-image-wrap';
    const img = document.createElement('img');
    img.alt = 'Selected gallery image';
    img.loading = 'eager';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = item?.url || '';
    preview.appendChild(img);

    const tagBox = document.createElement('div');
    tagBox.className = 'gallery-tag-preview-tags';

    if (tags.length) {
      tags.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'gallery-tag-chip';
        chip.textContent = tag;
        chip.title = `Search tag: ${tag}`;
        chip.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          setGalleryTagSearch(tag);
          closeGalleryTagPopup();
        });
        tagBox.appendChild(chip);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'gallery-tag-empty';
      empty.textContent = 'No tags saved for this image.';
      tagBox.appendChild(empty);
    }

    body.append(preview, tagBox);

    const footer = document.createElement('footer');
    footer.className = 'gallery-tag-preview-footer';
    footer.textContent = tags.length
      ? 'Tags are imported from Mudae metadata. Search uses exact tag matching when quotes are closed.'
      : 'Re-run Search Mudae after updating the userscript if tags exist on Mudae but are missing here.';

    panel.append(header, body, footer);
    overlay.appendChild(panel);
    overlay.addEventListener('click', ev => {
      if (ev.target === overlay) closeGalleryTagPopup();
    });

    const host = els.galleryPanel && !els.galleryPanel.hidden ? els.galleryPanel : document.body;
    host.appendChild(overlay);
    sourceCard?.classList?.add?.('is-tag-focused');
    document.addEventListener('keydown', onGalleryTagPopupKeydown, true);
    return overlay;
  }

  function createGalleryCard(item, index) {
    item = normalizeGalleryItem(item, index) || { url: String(item || ''), index: index + 1, matched: false };
    item.__renderIndex = index;
    const url = item.url;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card mhp-gallery-ratio-card';
    const isCustom = item.source === 'custom';
    card.classList.toggle('is-matched', !!item.matched);
    card.classList.toggle('is-custom-gallery-image', isCustom);
    card.dataset.imageUrl = url;
    card.dataset.index = String(index);
    card.dataset.source = isCustom ? 'custom' : 'mudae';
    if (item.matched) card.dataset.matched = '1';

    const displayIndex = index + 1;

    const badge = document.createElement('span');
    badge.className = 'gallery-number';
    // Custom images are stored separately, but they still occupy a real gallery
    // slot after the official Mudae images. Keep the C marker while showing the
    // continuous Discord command index, e.g. #1..#8 then C#9.
    badge.textContent = getGalleryBadgeLabel(item, index);
    badge.title = isCustom ? `Custom image · Discord slot #${displayIndex}` : 'Official Mudae image';

    const matchBadge = document.createElement('span');
    matchBadge.className = isCustom ? 'gallery-match-badge gallery-custom-badge' : 'gallery-match-badge';
    matchBadge.textContent = isCustom ? 'CUSTOM' : 'MATCH';
    matchBadge.hidden = isCustom ? false : !item.matched;
    matchBadge.title = isCustom ? 'Custom image stored separately from official Mudae images' : (item.matches?.length ? 'Click to preview matched images' : 'Matched image');
    matchBadge.setAttribute('role', 'button');
    if (item.matched && !isCustom) matchBadge.tabIndex = 0;
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
    img.alt = (isCustom ? 'Custom image ' : 'Mudae image ') + (index + 1);
    img.loading = 'eager';
    img.decoding = 'async';
    img.fetchPriority = 'high';
    img.referrerPolicy = 'no-referrer';

    if (isAnimatedImageUrl(url)) {
      // Gallery previews should play directly and smoothly. The global GIF
      // controller is useful for board cards, but in the gallery it can swap
      // GIFs through poster/placeholder states and make previews feel choppy.
      img.src = url;
      img.classList.add('gallery-gif-live');
      img.title = 'Animated GIF preview';
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

    const tagLabels = getGalleryItemTagLabels(item);
    card.classList.toggle('has-gallery-tags', tagLabels.length > 0);
    if (tagLabels.length) {
      card.dataset.tags = tagLabels.map(tag => normalizeSearchText(tag)).join('|');
    }

    const tagBadge = document.createElement('span');
    tagBadge.className = 'gallery-tag-badge';
    tagBadge.textContent = tagLabels.length > 1 ? `TAGS ${tagLabels.length}` : 'TAG';
    tagBadge.hidden = !tagLabels.length;
    tagBadge.title = tagLabels.length ? `View tags: ${tagLabels.join(', ')}` : 'No tags saved for this image';
    tagBadge.setAttribute('role', 'button');
    if (tagLabels.length) tagBadge.tabIndex = 0;
    const openTagPanel = event => {
      event.preventDefault();
      event.stopPropagation();
      showGalleryTagPopup(item, event, card);
      return true;
    };
    tagBadge.addEventListener('click', openTagPanel);
    tagBadge.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') openTagPanel(event);
    });

    const badgeRow = document.createElement('span');
    badgeRow.className = 'gallery-badge-row';
    badgeRow.append(matchBadge, tagBadge);

    card.append(img, badge, badgeRow);
    card.addEventListener('click', () => selectGalleryImage(index, url, card));
    card.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      showGalleryTagPopup(item, event, card);
    });
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
    syncEditPreviewGalleryIndex();
    syncMainGalleryIndicators();
    applyGalleryTagSearchFilter({ updateStatus: hasActiveGalleryTagSearch() });

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
    syncEditPreviewGalleryIndex(url);
    syncMainGalleryIndicators(url);

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


  const MUDAE_GALLERY_BRIDGE_EVENT = 'mhp:mudae-gallery-bridge-result';
  const MUDAE_GALLERY_BRIDGE_READY_EVENT = 'mhp:mudae-gallery-bridge-ready';

  function parseMudaeGalleryBridgeDetail(detail) {
    let wrapper = detail;

    if (typeof wrapper === 'string') {
      try { wrapper = JSON.parse(wrapper); } catch { return null; }
    }

    if (!wrapper || typeof wrapper !== 'object') return null;

    let payload = wrapper.payload || wrapper.gallery || wrapper.data || wrapper;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch {}
    }

    const payloadText = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    if (!payloadText || !/https?:\/\//i.test(payloadText)) return null;

    return {
      id: String(wrapper.id || wrapper.bridgePayloadId || wrapper.copiedAt || Date.now()),
      queueId: String(wrapper.queueId || wrapper.mhp_queue_id || ''),
      characterId: String(wrapper.characterId || wrapper.mhp_character_id || ''),
      copiedAt: wrapper.copiedAt || '',
      payloadText
    };
  }

  function handleMudaeGalleryBridgeResult(event) {
    const bridge = parseMudaeGalleryBridgeDetail(event?.detail);
    if (!bridge) return false;

    if (app.lastMudaeGalleryBridgePayloadId === bridge.id) return false;

    const queue = getDividerGalleryCheckQueue();
    if (queue?.active) {
      if (bridge.queueId && bridge.queueId !== queue.id) return false;
      if (bridge.characterId && queue.waitingForId && bridge.characterId !== queue.waitingForId) return false;

      if (queue.waitingForId && app.activeId !== queue.waitingForId) {
        openEdit(queue.waitingForId);
      }
    } else {
      if (!els.editOverlay?.classList?.contains('show')) return false;
      if (bridge.characterId && app.activeId && bridge.characterId !== app.activeId) return false;
    }

    app.lastMudaeGalleryBridgePayloadId = bridge.id;
    openGallery('tampermonkey-bridge');
    setGalleryStatus('Auto Bridge Received Gallery Data. Processing...');

    const parsed = parsePastedGallery(bridge.payloadText);
    if (parsed) {
      notifyAppMessage('Auto Bridge Processed Gallery Data.');
    } else {
      setGalleryStatus('Auto Bridge Received Data, But It Could Not Be Processed. Open Search Mudae Again Or Paste Manually If Clipboard Fallback Was Used.');
    }

    return parsed;
  }

  function installMudaeGalleryBridgeHandler() {
    if (window.__mhpMudaeGalleryBridgeHandlerInstalled) return;
    window.__mhpMudaeGalleryBridgeHandlerInstalled = true;

    const markBridgeReady = () => {
      app.mudaeGalleryBridgeReady = true;
      window.__mhpMudaeGalleryBridgeReady = true;
    };

    window.addEventListener(MUDAE_GALLERY_BRIDGE_EVENT, handleMudaeGalleryBridgeResult);
    window.addEventListener(MUDAE_GALLERY_BRIDGE_READY_EVENT, markBridgeReady);

    if (window.__mhpMudaeGalleryBridgeReady) markBridgeReady();
    setTimeout(() => {
      if (window.__mhpMudaeGalleryBridgeReady) markBridgeReady();
    }, 250);
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
    const galleryCheckStep = prepareDividerGalleryCheckPasteStep(galleryItems);

    openGallery('parse');
    renderGallery(getCombinedGalleryItemsForActive(galleryItems, null), { fastOpen: true });
    persistGalleryToActive({ deferred: true });
    const matchedCount = galleryItems.filter(item => item.matched).length;
    const queueHandled = completeDividerGalleryCheckPasteStep(galleryCheckStep, {
      total: urls.length,
      matched: matchedCount
    });

    if (!queueHandled) {
      setGalleryStatus(`${urls.length} image(s) loaded${matchedCount ? ` · ${matchedCount} matched` : ''}.`);
    }

    return true;
  }


  function saveCustomGalleryFromPaste(textOverride = null, options = {}) {
    if (isEditClosingLocked() || !els.editOverlay?.classList?.contains('show')) return false;
    const sourceText = textOverride == null ? els.galleryPasteInput.value : String(textOverride || '');
    const customItems = parseCustomGalleryItemsFromText(sourceText);
    if (!customItems.length) {
      setGalleryStatus('No valid Imgur or ImgChest custom image URLs found.');
      openGallery('custom-empty');
      return false;
    }

    const replace = options.replace === true;
    const ch = getCharacter(app.activeId);
    const existingCustom = replace ? [] : buildCustomGalleryItemsFromCharacter(ch);
    const mergedCustom = dedupeGalleryItems([...existingCustom, ...customItems].map((item, index) => ({
      ...item,
      index: index + 1,
      source: 'custom',
      matched: false,
      matches: []
    })));

    const official = buildGalleryItemsFromCharacter(ch);
    openGallery(replace ? 'custom-replace' : 'custom');
    renderGallery(getCombinedGalleryItemsForActive(official, mergedCustom), { fastOpen: true });
    persistGalleryToActive({ deferred: true });

    const urls = mergedCustom.map(item => item.url);
    els.galleryPasteInput.value = urls.join('\n');
    if (els.galleryPasteDetails) {
      const summary = els.galleryPasteDetails.querySelector('summary');
      if (summary) summary.textContent = `Show pasted links (${urls.length} custom)`;
    }

    const action = replace ? 'replaced' : 'added';
    setGalleryStatus(`${customItems.length} custom image(s) ${action} · ${mergedCustom.length} custom saved.`);
    return true;
  }

  function addCustomGalleryFromPaste(textOverride = null) {
    return saveCustomGalleryFromPaste(textOverride, { replace: false });
  }

  function replaceCustomGalleryFromPaste(textOverride = null) {
    return saveCustomGalleryFromPaste(textOverride, { replace: true });
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
    if (!ch) return false;

    const items = app.lastGalleryItems?.length
      ? dedupeGalleryItems(app.lastGalleryItems)
      : dedupeGalleryItems(getVisibleGalleryUrls());
    const urls = items.map(item => item.url);
    if (!urls.length) return false;

    const split = splitGalleryItemsBySource(items);
    ch.mudaeImages = split.official.map(item => item.url);
    ch.mudaeImageMeta = buildGalleryMetaMap(split.official);
    ch.customImages = dedupeCustomImageUrls(split.custom.map(item => item.url));
    ch.customImageMeta = buildCustomImageMetaMap(split.custom);
    syncCustomGalleryFlags(ch);
    syncMudaeGalleryFlags(ch);
    invalidateSearchCache();
    updateBoardCardGalleryBadge(ch);
    window.MudaeBoardController?.updateEntriesFromApp?.();

    if (options.deferred) saveLocalDeferred(160);
    else saveLocal();
    return true;
  }


  function hasActiveSearchFilter() {
    return !!String(app.filter?.q || els.searchInput?.value || els.floatingSearchInput?.value || '').trim();
  }

  function ensureFilteredBoardMatchesSearch(reason = 'search-restore') {
    const raw = String(els.searchInput?.value || els.floatingSearchInput?.value || app.filter?.q || '').trim();
    const normalized = normalizeSearchText(raw);

    if (!normalized) return false;

    // Search Mudae opens a new tab and may trigger focus/visibility handlers.
    // Some of those handlers can refresh the board while keeping the input text,
    // leaving the visible board unfiltered. Reassert the query and rebuild the
    // filtered entries without clearing the user's search text.
    app.filter.q = normalized;
    app.filter.floatingQ = '';

    if (els.searchInput && els.searchInput.value !== raw) els.searchInput.value = raw;
    if (els.floatingSearchInput && els.floatingSearchInput.value !== raw) els.floatingSearchInput.value = raw;

    const terms = getSearchTerms();
    if (!terms.length) return false;

    const firstCard = els.board?.querySelector?.('.char-card[data-id]');
    const boardLooksUnfiltered = !!firstCard && !firstCard.classList.contains('search-match') && !firstCard.classList.contains('section-search-match');
    const shouldRender = reason === 'mudae-search-return' || boardLooksUnfiltered || document.visibilityState === 'visible';

    if (!shouldRender) return false;

    clearBoardControllerDomMode();
    renderBoard();
    window.MudaeBoardController?.updateEntriesFromApp?.();
    syncSearchClearButton?.();
    window.MudaeFloatingBar?.syncVisibility?.();
    return true;
  }

  function scheduleSearchFilterRestore(reason = 'search-restore') {
    if (!hasActiveSearchFilter()) return;
    const run = () => ensureFilteredBoardMatchesSearch(reason);
    requestAnimationFrame(run);
    setTimeout(run, 80);
    setTimeout(run, 240);
  }

  function getActiveGallerySearchName() {
    const activeCharacter = getCharacter(app.activeId || els.editIdInput?.value || '');
    const name = activeCharacter?.name || els.editNameInput?.value || '';
    return String(name || '').trim();
  }

  function ensureSearchLink(url, name) {
    let link = $('#mudaeSearchFallbackLink');
    if (!els.galleryStatus) return null;

    if (!link) {
      link = document.createElement('a');
      link.id = 'mudaeSearchFallbackLink';
      link.className = 'search-fallback';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      els.galleryStatus.insertAdjacentElement('afterend', link);
    }

    link.href = url;
    link.textContent = 'Open Mudae Search For ' + (name || 'Character');
    return link;
  }

  function refreshGalleryFallbackSearchLink() {
    const name = getActiveGallerySearchName();
    if (!name) {
      $('#mudaeSearchFallbackLink')?.remove();
      return null;
    }

    // Manual fallback links must stay view-only. Do not include the auto-close
    // hash used by the Search Mudae helper tab.
    return ensureSearchLink(makeMudaeSearchUrl(name, { auto: false }), name);
  }

  function searchMudae() {
    const name = els.editNameInput.value.trim();
    const queue = getDividerGalleryCheckQueue();
    const bridgeReady = !!(app.mudaeGalleryBridgeReady || window.__mhpMudaeGalleryBridgeReady);
    const activeCharacterId = app.activeId || els.editIdInput?.value || '';
    const bridgeOptions = { auto: true };

    if (bridgeReady && activeCharacterId) {
      bridgeOptions.bridge = true;
      bridgeOptions.characterId = activeCharacterId;
    }

    if (bridgeReady && queue?.active && queue.waitingForId && queue.waitingForId === app.activeId) {
      bridgeOptions.queueId = queue.id;
      bridgeOptions.characterId = queue.waitingForId;
    }

    const autoUrl = makeMudaeSearchUrl(name, bridgeOptions);
    const fallbackUrl = makeMudaeSearchUrl(name, { auto: false });

    app.mudaeSearchFilterSnapshot = {
      q: app.filter?.q || els.searchInput?.value || '',
      type: app.filter?.type || 'all',
      at: Date.now()
    };

    openGallery('search');
    setGalleryStatus(bridgeOptions.bridge
      ? 'Opening Mudae Search. Auto Bridge Active — Clipboard Free. The Gallery Will Return Automatically.'
      : 'Opening Mudae Search. Copy Links There, Then Return Here And Press Ctrl+V.');
    ensureSearchLink(fallbackUrl, name);

    // Opening Mudae can fire focus/visibility handlers. Keep the active search
    // query rendered before and after the tab change.
    scheduleSearchFilterRestore('mudae-search-open');

    let opened = null;
    try {
      opened = window.open(autoUrl, '_blank', 'noopener,noreferrer');
    } catch {}

    if (!opened) {
      setGalleryStatus('Browser blocked auto-open. Use the link below, copy links, then press Ctrl+V here.');
    }

    setTimeout(() => scheduleSearchFilterRestore('mudae-search-after-open'), 120);
  }

  function autoSearchMudae() {
    if (isEditClosingLocked() || !els.editOverlay?.classList?.contains('show')) return false;
    renderPlaceholder();
    openGallery('auto-search');
    setGalleryStatus('No image found. Auto Search Mudae triggered.');
    setTimeout(searchMudae, 120);
  }


  function getDividerGalleryCheckQueue() {
    return app.dividerGalleryCheckQueue && typeof app.dividerGalleryCheckQueue === 'object'
      ? app.dividerGalleryCheckQueue
      : null;
  }

  function getOfficialGalleryKeySet(character) {
    return new Set(dedupeCharacterImageUrls(character?.mudaeImages || []).map(canonicalImageUrlKey).filter(Boolean));
  }

  function getDividerGalleryModeLabel(mode) {
    if (mode === 'without-gallery') return 'Characters Without Gallery';
    if (mode === 'with-gallery') return 'Characters With Gallery';
    return 'Both';
  }

  function getGalleryCheckModeLabel(mode) {
    return getDividerGalleryModeLabel(mode);
  }

  const GALLERY_CHECK_HISTORY_WINDOWS = [
    { value: '0', label: 'Off', ms: 0 },
    { value: '1d', label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
    { value: '7d', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
    { value: '14d', label: '14 Days', ms: 14 * 24 * 60 * 60 * 1000 },
    { value: '30d', label: '30 Days', ms: 30 * 24 * 60 * 60 * 1000 }
  ];

  function getGalleryCheckHistoryWindow(value) {
    return GALLERY_CHECK_HISTORY_WINDOWS.find(item => item.value === value) || GALLERY_CHECK_HISTORY_WINDOWS[0];
  }

  function getGalleryCheckHistory(character) {
    return character?.galleryCheckHistory && typeof character.galleryCheckHistory === 'object'
      ? character.galleryCheckHistory
      : null;
  }

  function getGalleryCheckLastCheckedTime(character) {
    const history = getGalleryCheckHistory(character);
    const raw = history?.lastCheckedAt || history?.checkedAt || '';
    const time = raw ? Date.parse(raw) : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function isRecentlyGalleryChecked(character, maxAgeMs = 0) {
    if (!maxAgeMs) return false;
    const lastChecked = getGalleryCheckLastCheckedTime(character);
    if (!lastChecked) return false;
    return Date.now() - lastChecked < maxAgeMs;
  }

  function updateGalleryCheckHistory(character, details = {}) {
    if (!character || isDivider(character)) return false;

    const now = new Date().toISOString();
    const previous = getGalleryCheckHistory(character) || {};
    const added = Math.max(0, Number(details.added || 0) || 0);
    const total = Math.max(0, Number(details.total || 0) || 0);
    const failed = details.status === 'failed';

    character.galleryCheckHistory = cleanExportObject({
      ...previous,
      lastCheckedAt: failed ? previous.lastCheckedAt : now,
      lastUpdatedAt: added > 0 ? now : previous.lastUpdatedAt,
      lastFailedAt: failed ? now : previous.lastFailedAt,
      lastStatus: failed ? 'failed' : (added > 0 ? 'updated' : 'unchanged'),
      lastMode: details.mode || previous.lastMode || undefined,
      lastScope: details.scope || previous.lastScope || undefined,
      lastImageCount: total || previous.lastImageCount || undefined,
      lastNewImages: added || 0,
      checkedCount: Math.max(0, Number(previous.checkedCount || 0) || 0) + (failed ? 0 : 1),
      failedCount: Math.max(0, Number(previous.failedCount || 0) || 0) + (failed ? 1 : 0)
    });

    return true;
  }

  function filterGalleryCharactersByRecentHistory(characters, skipRecentMs = 0) {
    if (!skipRecentMs) return { characters: characters || [], skipped: 0 };
    const kept = [];
    let skipped = 0;

    (characters || []).forEach(character => {
      if (isRecentlyGalleryChecked(character, skipRecentMs)) {
        skipped++;
      } else {
        kept.push(character);
      }
    });

    return { characters: kept, skipped };
  }

  function filterDividerGalleryCharactersByMode(characters, mode) {
    const selectedMode = mode === 'without-gallery' || mode === 'with-gallery' ? mode : 'both';
    return (characters || []).filter(character => {
      if (!character || isDivider(character) || !str(character.name).trim()) return false;
      if (selectedMode === 'both') return true;
      const hasGallery = getUniqueGalleryImageCount(character) > 0;
      return selectedMode === 'with-gallery' ? hasGallery : !hasGallery;
    });
  }

  function getGalleryCheckScopeLabel(queue) {
    if (!queue) return 'Gallery';
    if (queue.kind === 'global') return 'Global';
    if (queue.kind === 'sub-divider') return 'Sub-Divider';
    return 'Divider';
  }

  function getGalleryCheckScopeLine(queue) {
    const label = getGalleryCheckScopeLabel(queue);
    if (queue?.kind === 'global') return 'Scope: Global Gallery';
    return `${label}: ${queue?.title || 'Untitled'}`;
  }

  function getGalleryCheckBridgeText() {
    return (app.mudaeGalleryBridgeReady || window.__mhpMudaeGalleryBridgeReady)
      ? 'Auto Bridge Active — Clipboard Free'
      : 'Manual Fallback — Return And Press Ctrl+V';
  }

  function formatGalleryCheckDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
    if (!totalSeconds) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function getGalleryCheckTiming(queue) {
    const stats = queue?.stats || {};
    const total = Math.max(0, queue?.ids?.length || 0);
    const startedAt = Number(queue?.startedAt || 0) || 0;
    const elapsedMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
    const processed = Math.max(0, Number(stats.checked || 0) || 0) + Math.max(0, Number(stats.failed || 0) || 0);
    const remaining = Math.max(0, total - processed);
    const averageMs = processed > 0 ? elapsedMs / processed : 0;
    const estimatedMs = averageMs > 0 ? remaining * averageMs : 0;
    return {
      elapsedMs,
      processed,
      remaining,
      averageMs,
      estimatedMs,
      elapsedText: formatGalleryCheckDuration(elapsedMs),
      averageText: averageMs > 0 ? formatGalleryCheckDuration(averageMs) : 'Calculating...',
      estimatedText: averageMs > 0 ? formatGalleryCheckDuration(estimatedMs) : 'Calculating...'
    };
  }

  function showGalleryCheckSummaryDialog({ queue, reason = 'finished' } = {}) {
    if (!queue) return Promise.resolve(false);

    const stats = queue.stats || {};
    const timing = getGalleryCheckTiming(queue);
    const title = reason === 'cancelled' ? 'Gallery Check Cancelled' : 'Gallery Check Summary';
    const statusText = reason === 'cancelled' ? 'Gallery Check Cancelled.' : 'Gallery Check Finished.';
    const summaryRows = [
      ['Checked', fmt(stats.checked || 0)],
      ['Updated', fmt(stats.updated || 0)],
      ['New', fmt(stats.newImages || 0)],
      ['No Changes', fmt(stats.unchanged || 0)],
      ['Skipped', fmt(stats.skipped || 0)],
      ['Recent Skipped', fmt(stats.recentSkipped || 0)],
      ['Failed', fmt(stats.failed || 0)],
      ['Elapsed', timing.elapsedText],
      ['Average', timing.averageText]
    ];

    return showAppDialog({
      type: 'alert',
      title,
      message: statusText,
      okText: 'OK',
      renderContent(content) {
        const wrap = document.createElement('div');
        wrap.className = 'gallery-check-summary-panel';
        wrap.innerHTML = `
          <div class="gallery-check-summary-meta">
            <div><span>Scope</span><strong>${escapeHtml(getGalleryCheckScopeLine(queue).replace(/^Scope:\s*/i, ''))}</strong></div>
            <div><span>Mode</span><strong>${escapeHtml(getGalleryCheckModeLabel(queue.mode))}</strong></div>
            <div><span>History</span><strong>${escapeHtml(queue.skipRecentMs ? `Skipped Recently Checked (${queue.skipRecentLabel || 'On'})` : 'Off')}</strong></div>
          </div>
          <ul class="gallery-check-summary-list">
            ${summaryRows.map(([label, value]) => `
              <li>
                <span>• ${escapeHtml(label)}:</span>
                <strong>${escapeHtml(value)}</strong>
              </li>
            `).join('')}
          </ul>
        `;
        content.appendChild(wrap);
      }
    });
  }

  function updateGalleryCheckLoadingOverlay(character = null, phase = '') {
    const queue = getDividerGalleryCheckQueue();
    if (!queue?.active) return false;

    const total = Math.max(0, queue.ids?.length || 0);
    const checked = Math.max(0, queue.stats?.checked || 0);
    const currentIndex = Math.max(0, Math.min(total, (queue.index || 0) + 1));
    const title = queue.kind === 'global' ? 'Checking Global Galleries...' : 'Checking Divider Galleries...';
    const currentName = character?.name || getCharacter(queue.waitingForId)?.name || 'Preparing Next Character';
    const timing = getGalleryCheckTiming(queue);
    const scopeText = getGalleryCheckScopeLine(queue).replace(/^Scope:\s*/i, '');
    const modeText = getGalleryCheckModeLabel(queue.mode);
    const bridgeText = getGalleryCheckBridgeText();
    const phaseText = phase === 'finished'
      ? 'Finishing Queue'
      : phase === 'cancelled'
        ? 'Cancelling Queue'
        : phase === 'timeout'
          ? 'Timed Out Waiting For Bridge'
          : 'Checking Current Character';
    const loaderDetail = `${phaseText} · Press ESC To Cancel`;

    if (!els.appLoadingOverlay || els.appLoadingOverlay.hidden) {
      showAppLoading(title, loaderDetail);
    }

    updateSharedLoader({
      title,
      detail: loaderDetail,
      loaded: checked,
      total,
      galleryCheck: true
    });

    const overlay = els.appLoadingOverlay || document.getElementById('appLoadingOverlay');
    const detailNode = overlay?.querySelector?.('.mhp-loader-subtitle, #appLoadingDetail');
    const dataNode = overlay?.querySelector?.('.mhp-loader-data');
    if (detailNode) {
      detailNode.classList.add('is-gallery-check-detail');
      detailNode.innerHTML = `
        <span class="gallery-check-loader-current">Current: ${escapeHtml(currentName)}</span>
        <span class="gallery-check-loader-context">${escapeHtml(scopeText)} · ${escapeHtml(modeText)} · ${escapeHtml(bridgeText)}</span>
        <span class="gallery-check-loader-cancel">Press <strong>ESC</strong> To <em>Cancel</em></span>
      `;
    }
    if (dataNode) {
      const stats = queue.stats || {};
      const rows = [
        ['Estimated', timing.estimatedText],
        ['Elapsed', timing.elapsedText],
        ['Average', timing.averageText],
        ['Checked', fmt(stats.checked || 0)],
        ['Updated', fmt(stats.updated || 0)],
        ['New', fmt(stats.newImages || 0)],
        ['No Changes', fmt(stats.unchanged || 0)],
        ['Skipped', fmt(stats.skipped || 0)],
        ['Failed', fmt(stats.failed || 0)]
      ];
      dataNode.classList.add('is-gallery-check-data');
      dataNode.innerHTML = `
        <div class="gallery-check-loader-panel">
          <div class="gallery-check-loader-progress">
            <span>Progress</span>
            <strong>${escapeHtml(fmt(currentIndex))} / ${escapeHtml(fmt(total))}</strong>
          </div>
          <div class="gallery-check-loader-grid">
            ${rows.map(([label, value]) => `
              <div class="gallery-check-loader-stat">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return true;
  }

  function showGalleryCheckLoadingOverlay() {
    const queue = getDividerGalleryCheckQueue();
    if (!queue?.active) return false;
    showAppLoading(queue.kind === 'global' ? 'Checking Global Galleries...' : 'Checking Divider Galleries...', 'Preparing Gallery Check Queue...');
    updateGalleryCheckLoadingOverlay(null, 'start');
    return true;
  }

  function hideGalleryCheckLoadingOverlay() {
    const overlay = els.appLoadingOverlay || document.getElementById('appLoadingOverlay');
    if (overlay?.classList?.contains('app-loading-overlay')) {
      hideAppLoading();
    }
  }

  function installDividerGalleryCheckEscHandler() {
    if (window.__mhpDividerGalleryCheckEscHandlerInstalled) return;
    window.__mhpDividerGalleryCheckEscHandlerInstalled = true;
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const queue = getDividerGalleryCheckQueue();
      if (!queue?.active) return;
      event.preventDefault();
      event.stopPropagation();
      cancelDividerGalleryCheckQueue();
    }, true);
  }

  function prepareDividerGalleryCheckPasteStep(galleryItems) {
    const queue = getDividerGalleryCheckQueue();
    if (!queue?.active || !queue.waitingForId || queue.waitingForId !== app.activeId) return null;

    const character = getCharacter(queue.waitingForId);
    if (!character) return null;

    const officialItems = splitGalleryItemsBySource(dedupeGalleryItems(galleryItems || [])).official;
    const oldKeys = queue.currentOldKeys instanceof Set
      ? queue.currentOldKeys
      : getOfficialGalleryKeySet(character);

    const freshKeys = new Set();
    let added = 0;

    officialItems.forEach(item => {
      const key = canonicalImageUrlKey(item?.url || item);
      if (!key || freshKeys.has(key)) return;
      freshKeys.add(key);
      if (!oldKeys.has(key)) added++;
    });

    return {
      queueId: queue.id,
      characterId: character.id,
      name: character.name || 'Character',
      added,
      officialCount: freshKeys.size
    };
  }

  function completeDividerGalleryCheckPasteStep(step, pasteInfo = {}) {
    if (!step) return false;

    const queue = getDividerGalleryCheckQueue();
    if (!queue?.active || queue.id !== step.queueId || queue.waitingForId !== step.characterId) return false;

    queue.stats.checked++;
    queue.stats.newImages += step.added;
    if (step.added > 0) queue.stats.updated++;
    else queue.stats.unchanged++;

    updateGalleryCheckHistory(getCharacter(step.characterId), {
      status: 'checked',
      added: step.added,
      total: step.officialCount || pasteInfo.total || 0,
      matched: pasteInfo.matched || 0,
      scope: queue.kind,
      mode: queue.mode
    });
    saveLocalDeferred(220);

    queue.results.push({
      name: step.name,
      added: step.added,
      total: step.officialCount || pasteInfo.total || 0,
      matched: pasteInfo.matched || 0
    });

    const progress = `${queue.index + 1}/${queue.ids.length}`;
    const isLastItem = queue.index + 1 >= queue.ids.length;
    const changeText = step.added > 0 ? `+${step.added} New Image(s)` : 'No New Images';
    setGalleryStatus(`${step.name}: ${changeText}. Checked ${progress}. ${isLastItem ? 'Finishing Queue...' : 'Opening Next Character...'}`);
    notifyAppMessage(`${step.name}: ${changeText}.`);
    updateGalleryCheckLoadingOverlay(getCharacter(step.characterId), isLastItem ? 'finished' : 'next');

    queue.waitingForId = '';
    queue.waitingSince = 0;
    queue.currentOldKeys = null;

    clearTimeout(queue.timer);
    clearTimeout(queue.watchdogTimer);
    queue.timer = setTimeout(() => runNextDividerGalleryCheckItem('paste-complete'), isLastItem ? 250 : (queue.delayMs || 1500));
    return true;
  }

  function finishDividerGalleryCheckQueue(reason = 'finished') {
    const queue = getDividerGalleryCheckQueue();
    if (!queue) return false;

    clearTimeout(queue.timer);
    clearTimeout(queue.watchdogTimer);
    queue.active = false;
    queue.waitingForId = '';
    queue.currentOldKeys = null;

    updateGalleryCheckLoadingOverlay(null, reason === 'cancelled' ? 'cancelled' : 'finished');
    hideGalleryCheckLoadingOverlay();

    const stats = queue.stats || {};
    const timing = getGalleryCheckTiming(queue);
    const statusMessage = [
      `${reason === 'cancelled' ? 'Gallery Check Cancelled' : 'Gallery Check Finished'}.`,
      getGalleryCheckScopeLine(queue),
      `Mode: ${getGalleryCheckModeLabel(queue.mode)}`,
      `Checked: ${fmt(stats.checked || 0)}`,
      `Updated: ${fmt(stats.updated || 0)}`,
      `New: ${fmt(stats.newImages || 0)}`,
      `Failed: ${fmt(stats.failed || 0)}`,
      `Elapsed: ${timing.elapsedText}`
    ].join(' · ');

    app.dividerGalleryCheckQueue = null;
    setGalleryStatus(statusMessage);

    if (reason !== 'cancelled' && els.editOverlay?.classList?.contains('show')) {
      setTimeout(() => closeEdit(250), 80);
    }

    showGalleryCheckSummaryDialog({ queue, reason });
    return true;
  }

  function cancelDividerGalleryCheckQueue() {
    return finishDividerGalleryCheckQueue('cancelled');
  }

  function handleDividerGalleryCheckTimeout(characterId) {
    const queue = getDividerGalleryCheckQueue();
    if (!queue?.active || !queue.waitingForId || queue.waitingForId !== characterId) return false;

    const character = getCharacter(characterId);
    queue.stats.failed++;
    queue.results.push({
      name: character?.name || characterId || 'Unknown',
      added: 0,
      total: 0,
      failed: true,
      reason: 'timeout'
    });

    updateGalleryCheckHistory(character, {
      status: 'failed',
      added: 0,
      total: getUniqueGalleryImageCount(character),
      scope: queue.kind,
      mode: queue.mode
    });
    saveLocalDeferred(220);

    setGalleryStatus(`${character?.name || 'Character'}: Timed Out Waiting For Auto Bridge. Opening Next Character...`);
    notifyAppMessage(`${character?.name || 'Character'}: Gallery Check Timed Out.`, { variant: 'warning' });
    updateGalleryCheckLoadingOverlay(character, 'timeout');

    queue.waitingForId = '';
    queue.waitingSince = 0;
    queue.currentOldKeys = null;

    clearTimeout(queue.watchdogTimer);
    clearTimeout(queue.timer);
    queue.timer = setTimeout(() => runNextDividerGalleryCheckItem('timeout'), queue.delayMs || 1500);
    return true;
  }

  function runNextDividerGalleryCheckItem(reason = 'next') {
    const queue = getDividerGalleryCheckQueue();
    if (!queue?.active) return false;

    clearTimeout(queue.timer);
    queue.index++;

    while (queue.index < queue.ids.length) {
      const id = queue.ids[queue.index];
      const character = getCharacter(id);

      if (!character || isDivider(character) || !str(character.name).trim()) {
        queue.stats.skipped++;
        queue.results.push({ name: character?.name || id || 'Unknown', added: 0, total: 0, skipped: true });
        queue.index++;
        continue;
      }

      queue.waitingForId = character.id;
      queue.waitingSince = Date.now();
      clearTimeout(queue.watchdogTimer);
      queue.currentOldKeys = getOfficialGalleryKeySet(character);
      openEdit(character.id);
      openGallery('gallery-check');
      const bridgeReady = !!(app.mudaeGalleryBridgeReady || window.__mhpMudaeGalleryBridgeReady);
      setGalleryStatus(bridgeReady
        ? `Checking ${character.name} (${queue.index + 1}/${queue.ids.length}). Auto Bridge Active — Clipboard Free. Press ESC To Cancel.`
        : `Checking ${character.name} (${queue.index + 1}/${queue.ids.length}). Wait For Mudae To Copy, Then Return And Press Ctrl+V. Press ESC To Cancel.`);
      updateGalleryCheckLoadingOverlay(character, 'current');

      setTimeout(() => {
        const active = getCharacter(queue.waitingForId);
        if (!getDividerGalleryCheckQueue()?.active || !active) return;
        if (app.activeId !== active.id) openEdit(active.id);
        updateGalleryCheckLoadingOverlay(active, 'opening-mudae');
        searchMudae();

        clearTimeout(queue.watchdogTimer);
        queue.watchdogTimer = setTimeout(() => {
          handleDividerGalleryCheckTimeout(active.id);
        }, queue.responseTimeoutMs || 10000);
      }, reason === 'start' ? 220 : Math.max(220, queue.delayMs || 1500));

      return true;
    }

    return finishDividerGalleryCheckQueue('finished');
  }

  async function chooseDividerGalleryCheckMode({ title, kind, total, withGallery, withoutGallery, characters }) {
    let selectedMode = 'without-gallery';
    const isGlobal = kind === 'global';
    const sourceCharacters = Array.isArray(characters) ? characters : [];
    let selectedRecentWindow = isGlobal ? '7d' : '0';

    const getPreviewForMode = (mode, recentWindowValue = selectedRecentWindow) => {
      const historyWindow = getGalleryCheckHistoryWindow(recentWindowValue);
      const filteredByMode = filterDividerGalleryCharactersByMode(sourceCharacters, mode);
      const historyFiltered = filterGalleryCharactersByRecentHistory(filteredByMode, historyWindow.ms);
      return {
        mode,
        historyWindow,
        modeCount: filteredByMode.length,
        checkCount: historyFiltered.characters.length,
        recentSkipped: historyFiltered.skipped || 0,
        modeSkipped: Math.max(0, sourceCharacters.length - filteredByMode.length)
      };
    };

    const ok = await showAppDialog({
      type: 'confirm',
      title: isGlobal ? 'Global Gallery Check' : 'Check Galleries',
      message: isGlobal ? 'All Characters' : `${kind === 'sub-divider' ? 'Sub-Divider' : 'Divider'}: ${title}`,
      okText: 'Start',
      cancelText: 'Cancel',
      renderContent(content) {
        const wrap = document.createElement('div');
        wrap.className = 'divider-gallery-mode-picker divider-gallery-mode-picker-compact';
        wrap.innerHTML = `
          <div class="divider-gallery-mode-picker-topline">
            <span>Will Check: <strong id="dividerGalleryPreviewCount">${fmt(getPreviewForMode(selectedMode).checkCount)}</strong> / ${fmt(total)}</span>
            <small id="dividerGalleryPreviewDetail">One Mudae Tab At A Time · Auto Bridge If Available · ESC To Cancel</small>
          </div>
          ${isGlobal ? `<p class="divider-gallery-mode-picker-summary"><strong>Warning:</strong> This can take a long time and will automatically open many Mudae pages. Do not close the Organizer while it is running.</p>` : ''}
          <div class="divider-gallery-mode-row" role="radiogroup" aria-label="Gallery check mode">
            <label class="divider-gallery-mode-option is-selected">
              <input type="radio" name="dividerGalleryCheckMode" value="without-gallery" checked>
              <span>Without <em data-gallery-preview-mode-count="without-gallery">${fmt(withoutGallery)}</em></span>
            </label>
            <label class="divider-gallery-mode-option">
              <input type="radio" name="dividerGalleryCheckMode" value="with-gallery">
              <span>With <em data-gallery-preview-mode-count="with-gallery">${fmt(withGallery)}</em></span>
            </label>
            <label class="divider-gallery-mode-option">
              <input type="radio" name="dividerGalleryCheckMode" value="both">
              <span>Both <em data-gallery-preview-mode-count="both">${fmt(total)}</em></span>
            </label>
          </div>
          <label class="divider-gallery-history-row">
            <span>Skip Recently Checked</span>
            <select id="dividerGalleryRecentWindowSelect">
              ${GALLERY_CHECK_HISTORY_WINDOWS.map(item => `<option value="${item.value}"${item.value === selectedRecentWindow ? ' selected' : ''}>${item.label}</option>`).join('')}
            </select>
          </label>
          <p class="divider-gallery-mode-picker-summary divider-gallery-history-note" id="dividerGalleryHistoryPreviewNote">Gallery History skips characters checked within the selected window. Failed checks are not counted as recently checked.</p>
        `;
        const syncSelected = () => {
          wrap.querySelectorAll('.divider-gallery-mode-option').forEach(label => {
            const input = label.querySelector('input[name="dividerGalleryCheckMode"]');
            label.classList.toggle('is-selected', !!input?.checked);
          });
        };
        const updatePreview = () => {
          ['without-gallery', 'with-gallery', 'both'].forEach(mode => {
            const modePreview = getPreviewForMode(mode, selectedRecentWindow);
            const node = wrap.querySelector(`[data-gallery-preview-mode-count="${mode}"]`);
            if (node) node.textContent = fmt(modePreview.checkCount);
          });

          const preview = getPreviewForMode(selectedMode, selectedRecentWindow);
          const countNode = wrap.querySelector('#dividerGalleryPreviewCount');
          const detailNode = wrap.querySelector('#dividerGalleryPreviewDetail');
          const noteNode = wrap.querySelector('#dividerGalleryHistoryPreviewNote');
          if (countNode) countNode.textContent = fmt(preview.checkCount);
          if (detailNode) {
            const historyText = preview.historyWindow.ms
              ? `History: ${preview.historyWindow.label} · Recent Skipped: ${fmt(preview.recentSkipped)}`
              : 'History: Off';
            detailNode.textContent = `${historyText} · ESC To Cancel`;
          }
          if (noteNode) {
            noteNode.textContent = `Mode Excluded: ${fmt(preview.modeSkipped)} · Recent Skipped: ${fmt(preview.recentSkipped)} · Failed checks are not counted as recently checked.`;
          }
        };
        wrap.addEventListener('change', event => {
          const input = event.target?.closest?.('input[name="dividerGalleryCheckMode"]');
          if (input?.value) selectedMode = input.value;

          const select = event.target?.closest?.('#dividerGalleryRecentWindowSelect');
          if (select?.value) selectedRecentWindow = select.value;

          syncSelected();
          updatePreview();
        });
        syncSelected();
        updatePreview();
        content.appendChild(wrap);
      }
    });

    const historyWindow = getGalleryCheckHistoryWindow(selectedRecentWindow);
    return ok ? { mode: selectedMode, skipRecentMs: historyWindow.ms, skipRecentLabel: historyWindow.label } : null;
  }

  function buildGalleryCheckQueue({ ids, title, kind, mode, skipped = 0, delayMs = 1500, dividerId = '' }) {
    return {
      id: uid(),
      active: true,
      startedAt: Date.now(),
      dividerId,
      title,
      kind,
      mode,
      ids,
      index: -1,
      delayMs,
      timer: 0,
      watchdogTimer: 0,
      responseTimeoutMs: 10000,
      waitingForId: '',
      waitingSince: 0,
      currentOldKeys: null,
      skipRecentMs: Number(arguments[0]?.skipRecentMs || 0) || 0,
      skipRecentLabel: arguments[0]?.skipRecentLabel || 'Off',
      stats: { checked: 0, updated: 0, newImages: 0, unchanged: 0, skipped, recentSkipped: Math.max(0, Number(arguments[0]?.recentSkipped || 0) || 0), failed: 0 },
      results: []
    };
  }

  async function startDividerGalleryCheck(payload = {}) {
    installDividerGalleryCheckEscHandler();

    const rawCharacters = Array.isArray(payload.characters) ? payload.characters : [];
    const validCharacters = [];
    const seen = new Set();

    rawCharacters.forEach(character => {
      const id = character?.id || '';
      if (!id || seen.has(id) || isDivider(character) || !str(character.name).trim()) return;
      seen.add(id);
      validCharacters.push(character);
    });

    if (!validCharacters.length) {
      showAppAlert('This Divider Does Not Contain Valid Characters To Check.', { title: 'Gallery Check' });
      return false;
    }

    const title = str(payload.title || 'Divider').trim() || 'Divider';
    const kind = payload.kind === 'subdivider' ? 'sub-divider' : 'divider';
    const withGallery = validCharacters.filter(character => getUniqueGalleryImageCount(character) > 0).length;
    const withoutGallery = validCharacters.length - withGallery;
    const choice = await chooseDividerGalleryCheckMode({
      title,
      kind,
      total: validCharacters.length,
      withGallery,
      withoutGallery,
      characters: validCharacters
    });

    if (!choice) return false;

    const mode = choice.mode;
    const filteredByMode = filterDividerGalleryCharactersByMode(validCharacters, mode);
    const historyFiltered = filterGalleryCharactersByRecentHistory(filteredByMode, choice.skipRecentMs);
    const filteredCharacters = historyFiltered.characters;
    const ids = filteredCharacters.map(character => character.id);
    const filteredOut = Math.max(0, validCharacters.length - filteredByMode.length);
    const recentSkipped = Math.max(0, historyFiltered.skipped || 0);

    if (!ids.length) {
      showAppAlert(`No Characters Match Mode: ${getDividerGalleryModeLabel(mode)}${recentSkipped ? ` After Gallery History Skipped ${fmt(recentSkipped)} Recently Checked Character${recentSkipped === 1 ? '' : 's'}` : ''}.`, { title: 'Gallery Check' });
      return false;
    }

    cancelDividerGalleryCheckQueue();

    app.dividerGalleryCheckQueue = buildGalleryCheckQueue({
      ids,
      title,
      kind,
      mode,
      skipped: filteredOut,
      recentSkipped,
      skipRecentMs: choice.skipRecentMs,
      skipRecentLabel: choice.skipRecentLabel,
      dividerId: payload.dividerId || ''
    });

    showGalleryCheckLoadingOverlay();
    notifyAppMessage(`Gallery Check Started: ${getDividerGalleryModeLabel(mode)} · ${fmt(ids.length)} Character${ids.length === 1 ? '' : 's'}.`);
    runNextDividerGalleryCheckItem('start');
    return true;
  }

  async function startGlobalGalleryCheck() {
    installDividerGalleryCheckEscHandler();

    const validCharacters = (app.state.characters || [])
      .filter(character => character && !isDivider(character) && str(character.name).trim());

    if (!validCharacters.length) {
      showAppAlert('There Are No Valid Characters To Check.', { title: 'Global Gallery Check' });
      return false;
    }

    const withGallery = validCharacters.filter(character => getUniqueGalleryImageCount(character) > 0).length;
    const withoutGallery = validCharacters.length - withGallery;
    const choice = await chooseDividerGalleryCheckMode({
      title: 'Global Gallery',
      kind: 'global',
      total: validCharacters.length,
      withGallery,
      withoutGallery,
      characters: validCharacters
    });

    if (!choice) return false;

    const mode = choice.mode;
    const filteredByMode = filterDividerGalleryCharactersByMode(validCharacters, mode);
    const historyFiltered = filterGalleryCharactersByRecentHistory(filteredByMode, choice.skipRecentMs);
    const filteredCharacters = historyFiltered.characters;
    const ids = filteredCharacters.map(character => character.id);
    const filteredOut = Math.max(0, validCharacters.length - filteredByMode.length);
    const recentSkipped = Math.max(0, historyFiltered.skipped || 0);

    if (!ids.length) {
      showAppAlert(`No Characters Match Mode: ${getDividerGalleryModeLabel(mode)}${recentSkipped ? ` After Gallery History Skipped ${fmt(recentSkipped)} Recently Checked Character${recentSkipped === 1 ? '' : 's'}` : ''}.`, { title: 'Global Gallery Check' });
      return false;
    }

    if (ids.length >= 100) {
      const ok = await showAppConfirm(`You Are About To Check ${fmt(ids.length)} Characters. This May Take A Long Time And Will Open Many Mudae Pages Automatically. Continue?`, {
        title: 'Start Global Gallery Check?',
        okText: 'Start Global Check',
        cancelText: 'Cancel',
        variant: 'warning'
      });
      if (!ok) return false;
    }

    cancelDividerGalleryCheckQueue();

    app.dividerGalleryCheckQueue = buildGalleryCheckQueue({
      ids,
      title: 'Global Gallery',
      kind: 'global',
      mode,
      skipped: filteredOut,
      recentSkipped,
      skipRecentMs: choice.skipRecentMs,
      skipRecentLabel: choice.skipRecentLabel,
      delayMs: 1500
    });

    showGalleryCheckLoadingOverlay();
    notifyAppMessage(`Global Gallery Check Started: ${getDividerGalleryModeLabel(mode)} · ${fmt(ids.length)} Character${ids.length === 1 ? '' : 's'}.`);
    runNextDividerGalleryCheckItem('start');
    return true;
  }

  window.MudaeGalleryUpdate = {
    startDividerGalleryCheck,
    startGlobalGalleryCheck,
    cancelDividerGalleryCheck: cancelDividerGalleryCheckQueue,
    getActiveDividerGalleryCheck: () => getDividerGalleryCheckQueue()
  };


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
        notifyAppMessage?.('Could Not Delete Character.', { variant: 'danger' });
      }
    }, true);
  }

  window.MHPInstallEditDeleteCharacterDelegatedHandler = installEditDeleteCharacterDelegatedHandler;


  async function deleteActiveCharacterFromEdit() {
    const activeEditId = app.activeId || els.editIdInput?.value || document.getElementById('editIdInput')?.value || '';
    const ch = getCharacter(activeEditId);
    if (!ch || isDivider(ch)) {
      notifyAppMessage('No Character Selected To Delete.', { variant: 'warning' });
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

  window.MHPDeleteActiveCharacterFromEdit = deleteActiveCharacterFromEdit;


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
        (typeof renderCard === 'function' && renderCard) ||
        window.MudaeRebuildCards?.renderCard ||
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


  function captureSearchStateForEditSave() {
    const topValue = String(els.searchInput?.value || '');
    const floatingValue = String(els.floatingSearchInput?.value || '');
    const qValue = String(app.filter?.q || '');
    const effective = topValue || floatingValue || qValue;
    return {
      q: qValue,
      top: topValue,
      floating: floatingValue,
      effective,
      active: !!effective.trim()
    };
  }

  function restoreSearchStateAfterEditSave(state) {
    if (!state?.active) return false;
    const raw = state.top || state.floating || state.q || state.effective || '';
    const normalized = String(raw || '').trim().toLowerCase();
    if (!normalized) return false;

    app.filter.q = normalized;
    app.filter.floatingQ = '';
    if (els.searchInput && els.searchInput.value !== raw) els.searchInput.value = raw;
    if (els.floatingSearchInput && els.floatingSearchInput.value !== raw) els.floatingSearchInput.value = raw;
    syncSearchClearButton?.();
    window.MudaeFloatingBar?.syncVisibility?.();
    return true;
  }

function saveEdit() {
    const id = els.editIdInput.value || app.activeId;
    const ch = getCharacter(id);

    if (!ch) {
      showAppAlert('No character selected to save.', { title: 'Nothing to save' });
      return false;
    }

    const savedName = els.editNameInput.value.trim() || ch.name || 'character';
    const searchStateBeforeSave = captureSearchStateForEditSave();

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
    nextData.gallerySplit = splitGalleryItemsBySource(nextData.galleryItems.length ? nextData.galleryItems : nextData.galleryUrls);


    // This makes Save feel immediate even if JSON/localStorage is large.
    cancelEditSession(180);
    cancelPostEditRestoreLoops(300);
    hardCloseEditModal();

    notifyAppMessage(`Saved ${savedName}.`);
    restoreSearchStateAfterEditSave(searchStateBeforeSave);
    requestAnimationFrame(() => restoreSearchStateAfterEditSave(searchStateBeforeSave));

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
          const isCustomMain = isAllowedCustomImageHost(ch.image);
          const hasMainInGallery = ch.mudaeImages.some(url => canonicalImageUrlKey(url) === mainKey);
          if (!isCustomMain && !hasMainInGallery && ch.mudaeImages.length === 0) ch.mudaeImages.push(ch.image);
          if (isCustomMain) {
            ch.customImages = dedupeCustomImageUrls([...(ch.customImages || []), ch.image]);
            syncCustomGalleryFlags(ch);
          }
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
          const split = nextData.gallerySplit || splitGalleryItemsBySource(nextData.galleryItems.length ? nextData.galleryItems : nextData.galleryUrls);
          if (split.official.length) {
            ch.mudaeImages = mergeGalleryUrlsPreserveAbsoluteOrder(ch.mudaeImages || [], split.official.map(item => item.url), ch.image);
            ch.mudaeImageMeta = buildGalleryMetaMap(split.official);
          }
          ch.customImages = dedupeCustomImageUrls(split.custom.map(item => item.url));
          ch.customImageMeta = buildCustomImageMetaMap(split.custom);
          syncCustomGalleryFlags(ch);
          syncMudaeGalleryFlags(ch, { skipNormalize: true });
          invalidateSearchCache();
        }

        assignBoardCounters();
        recalcStats();
        saveLocal();
        restoreSearchStateAfterEditSave(searchStateBeforeSave);
        setTimeout(() => restoreSearchStateAfterEditSave(searchStateBeforeSave), 80);

        const refreshed = typeof renderCharacterCardById === 'function'
          ? renderCharacterCardById(id)
          : false;

        if (!refreshed) {
          window.MudaeBoardController?.updateEntriesFromApp?.();
        }
      } catch (error) {
        console.error('[MHP] Deferred save failed:', error);
        showAppAlert('The edit was closed, but saving failed: ' + (error?.message || error), {
          title: 'Save Failed',
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
    if (parseCustomGalleryItemsFromText(text).length) {
      replaceCustomGalleryFromPaste(text);
    } else {
      parsePastedGallery(text);
    }
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


  function getCharacterImageUrl(character) {
    if (!character) return '';
    return str(
      character.imageUrl ||
      character.image ||
      (Array.isArray(character.mudaeImages) ? character.mudaeImages.find(Boolean) : '') ||
      ''
    ).trim();
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
      customImages: Array.isArray(existing.customImages) ? existing.customImages : [],
      customImageMeta: existing.customImageMeta && typeof existing.customImageMeta === 'object' ? existing.customImageMeta : {},
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

    existing.customImages = dedupeCustomImageUrls([...(preserve.customImages || []), ...(Array.isArray(incoming.customImages) ? incoming.customImages : [])]);
    existing.customImageMeta = preserve.customImageMeta || existing.customImageMeta || {};
    syncCustomGalleryFlags(existing);

    existing.rawText = incoming.rawText || existing.rawText || '';
    return true;
  }


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

  function cleanImageUrlForGallery(url) {
    return str(url || '')
      .trim()
      .replace(/[.,;)]+$/g, '')
      .replace(/\]+$/g, '')
      .replace(/\}+$/g, '');
  }

  function getCharacterGalleryNormalizeCacheKey(character, options = {}) {
    const gallery = Array.isArray(character?.mudaeImages) ? character.mudaeImages : [];
    return [
      options.appendMissingMain === true ? 'append' : 'normal',
      String(character?.image || ''),
      String(character?.imageUrl || ''),
      gallery.length,
      String(gallery[0] || ''),
      String(gallery[gallery.length - 1] || '')
    ].join('\u0001');
  }

  function setCharacterGalleryNormalizeCache(character, key, galleryRef) {
    if (!character || isDivider(character)) return;
    Object.defineProperty(character, '__mhpGalleryNormalizeCache', {
      value: { key, galleryRef },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  function normalizeCharacterImageGalleryPreserveOrder(character, options = {}) {
    if (!character || isDivider(character)) return character;

    const cacheKey = getCharacterGalleryNormalizeCacheKey(character, options);
    const cache = character.__mhpGalleryNormalizeCache;
    if (cache && cache.key === cacheKey && cache.galleryRef === character.mudaeImages) {
      return character;
    }

    const main = cleanImageUrlForGallery(character.imageUrl || character.image || '');
    const gallery = Array.isArray(character.mudaeImages) ? character.mudaeImages : [];
    let uniqueGallery = dedupeCharacterImageUrls(gallery);

    const finalMain = main && hasRealImage(main) ? main : (uniqueGallery[0] || '');

    const shouldAppendMain =
      finalMain &&
      hasRealImage(finalMain) &&
      !isAllowedCustomImageHost(finalMain) &&
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
    setCharacterGalleryNormalizeCache(character, getCharacterGalleryNormalizeCacheKey(character, options), character.mudaeImages);

    return character;
  }

  function normalizeCharacterImageGallery(character) {
    return normalizeCharacterImageGalleryPreserveOrder(character);
  }


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

  function syncCustomGalleryFlags(character) {
    if (!character || isDivider(character)) return 0;
    const custom = dedupeCustomImageUrls(character.customImages || []);
    character.customImages = custom;
    character.hasCustomGallery = custom.length > 0;
    character.customGalleryCount = custom.length;
    return custom.length;
  }

  function syncMudaeGalleryFlags(character, options = {}) {
    if (!character || isDivider(character)) return 0;
    const count = getEffectiveMudaeGalleryCount(character, options);
    character.hasMudaeGallery = count > 0;
    character.mudaeGalleryCount = count;
    syncCustomGalleryFlags(character);
    return count;
  }

  // Gallery badge uses official gallery count plus separately stored custom images.
  function getUniqueGalleryImageCount(character) {
    if (!character || isDivider(character)) return 0;

    // Card rendering calls this for every visible card. Prefer the synced counters
    // that are maintained whenever galleries/custom galleries are imported, saved,
    // or normalized, and only fall back to dedupe work for legacy/unsynced data.
    const official = Number.isFinite(Number(character.mudaeGalleryCount))
      ? Math.max(0, Number(character.mudaeGalleryCount) || 0)
      : getEffectiveMudaeGalleryCount(character);
    const custom = Number.isFinite(Number(character.customGalleryCount))
      ? Math.max(0, Number(character.customGalleryCount) || 0)
      : dedupeCustomImageUrls(character.customImages || []).length;
    return official + custom;
  }

  function updateBoardCardGalleryBadge(character) {
    if (!character || isDivider(character) || !els.board) return false;
    const id = String(character.id || '');
    if (!id) return false;

    const selector = `.char-card[data-id="${getCssSafeId(id)}"]`;
    const cards = Array.from(els.board.querySelectorAll(selector));
    if (!cards.length) return false;

    const galleryImageCount = getUniqueGalleryImageCount(character);
    cards.forEach(node => {
      node.classList.toggle('has-gallery-count', galleryImageCount > 0);
      node.classList.toggle('no-gallery-count', galleryImageCount <= 0);
      const badge = node.querySelector('.gallery-badge');
      if (badge) {
        badge.hidden = galleryImageCount <= 0;
        badge.textContent = galleryImageCount > 0 ? `${galleryImageCount} imgs` : '';
      }
    });

    return true;
  }


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

  function arraysEqualForExport(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index++) {
      if (String(a[index] ?? '') !== String(b[index] ?? '')) return false;
    }
    return true;
  }

  function normalizeDefaultColorForExport(value) {
    const raw = String(value || '').trim().toUpperCase();
    return raw === '#8B5CF6' ? undefined : (value || undefined);
  }

  function compactMudaeTagsForExport(item) {
    const tags = Array.isArray(item?.mudaeTags)
      ? item.mudaeTags.map(tag => String(tag || '').trim()).filter(Boolean)
      : [];
    if (!tags.length) return undefined;

    const inferred = typeof inferTags === 'function' ? inferTags(item?.roulette || '') : [];
    return arraysEqualForExport(tags, inferred) ? undefined : tags;
  }

  function compactGalleryMetaForExport(metaMap, urls) {
    if (!metaMap || typeof metaMap !== 'object') return undefined;

    const urlKeys = Array.isArray(urls)
      ? urls.map(url => canonicalImageUrlKey?.(url) || String(url || '').trim()).filter(Boolean)
      : [];
    const allowed = new Set(urlKeys);
    const out = {};

    Object.entries(metaMap).forEach(([rawKey, rawMeta]) => {
      if (!rawMeta || typeof rawMeta !== 'object') return;

      const canonicalKey = canonicalImageUrlKey?.(rawKey) || rawKey;
      const key = allowed.has(canonicalKey) ? canonicalKey : (allowed.has(rawKey) ? rawKey : '');
      if (!key) return;

      const compact = {};
      const matched = rawMeta.matched === true;
      const matches = Array.isArray(rawMeta.matches) ? rawMeta.matches.filter(Boolean) : [];
      const tags = typeof normalizeGalleryTagList === 'function'
        ? normalizeGalleryTagList(rawMeta.tags)
        : (Array.isArray(rawMeta.tags) ? rawMeta.tags.filter(Boolean) : []);
      const artist = Array.isArray(rawMeta.artist) ? rawMeta.artist.filter(Boolean) : [];
      const imageId = String(rawMeta.mudaeImageId || rawMeta.id || '').trim();
      const characterName = String(rawMeta.characterName || rawMeta.name || '').trim();
      const rating = rawMeta.rating ?? null;
      const source = String(rawMeta.source || '').trim();

      if (matched) compact.matched = true;
      if (matches.length) compact.matches = matches;
      if (imageId) compact.mudaeImageId = imageId;
      if (characterName) compact.characterName = characterName;
      if (tags.length) compact.tags = tags;
      if (artist.length) compact.artist = artist;
      if (rating !== null && rating !== undefined && rating !== '') compact.rating = rating;
      if (source && source !== 'mudae' && source !== 'paste') compact.source = source;

      // `index`, empty arrays, default source and false matched are derivable from
      // the gallery URL order, so exporting them only bloats large backups.
      if (Object.keys(compact).length) out[key] = compact;
    });

    return Object.keys(out).length ? out : undefined;
  }

  function compactCustomImageMetaForExport(metaMap, urls) {
    if (!metaMap || typeof metaMap !== 'object') return undefined;

    const keys = new Set((Array.isArray(urls) ? urls : [])
      .map(url => canonicalImageUrlKey?.(url) || String(url || '').trim())
      .filter(Boolean));
    const out = {};

    Object.entries(metaMap).forEach(([rawKey, rawMeta]) => {
      if (!rawMeta || typeof rawMeta !== 'object') return;
      const key = canonicalImageUrlKey?.(rawKey) || rawKey;
      if (!keys.has(key) && !keys.has(rawKey)) return;

      const compact = { ...rawMeta };
      if (typeof normalizeGalleryTagList === 'function' && compact.tags) {
        compact.tags = normalizeGalleryTagList(compact.tags);
      }
      delete compact.index;
      if (compact.source === 'custom') delete compact.source;
      cleanExportObject(compact);
      if (Object.keys(compact).length) out[key] = compact;
    });

    return Object.keys(out).length ? out : undefined;
  }

  function compactSpheresForExport(spheres) {
    if (!spheres || typeof spheres !== 'object') return undefined;
    const out = {};
    Object.entries(spheres).forEach(([key, value]) => {
      if (!isEmptyExportValue(value) && value !== 0) out[key] = value;
    });
    return Object.keys(out).length ? out : undefined;
  }

  function compactGalleryCheckHistoryForExport(history) {
    if (!history || typeof history !== 'object') return undefined;

    const out = {
      lastCheckedAt: history.lastCheckedAt || undefined,
      lastUpdatedAt: history.lastUpdatedAt || undefined,
      lastFailedAt: history.lastFailedAt || undefined,
      lastStatus: history.lastStatus || undefined,
      lastMode: history.lastMode || undefined,
      lastScope: history.lastScope || undefined,
      lastImageCount: Number(history.lastImageCount || 0) || undefined,
      lastNewImages: Number(history.lastNewImages || 0) || undefined,
      checkedCount: Number(history.checkedCount || 0) || undefined,
      failedCount: Number(history.failedCount || 0) || undefined
    };

    return cleanExportObject(out);
  }

  function compactCharacterForExport(item, index = 0) {
    if (!item || typeof item !== 'object') return item;

    if (isDivider(item)) {
      const divider = {
        type: 'divider',
        id: item.id,
        title: item.title || item.name || '',
        level: Number(item.level || 1) > 1 ? (Number(item.level || 1) || 1) : undefined,
        color: normalizeDefaultColorForExport(item.color),
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
    const currentRank = Number(item.currentRank || 0) || 0;
    const globalRank = Number(item.globalRank || 0) || 0;

    const out = {
      id: item.id,
      color: normalizeDefaultColorForExport(item.color),
      currentRank: currentRank && currentRank !== index + 1 ? currentRank : undefined,
      name: item.name || '',
      series: item.series || '',
      image: mainImage || undefined,
      globalRank: globalRank || undefined,
      owner: item.owner || undefined,
      roulette: item.roulette || undefined,
      kakera: Number(item.kakera || 0) || undefined,
      mudaeTags: compactMudaeTagsForExport(item),
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

    const customGallery = dedupeCustomImageUrls(item.customImages || []);
    if (customGallery.length) out.customImages = customGallery;
    const customMeta = compactCustomImageMetaForExport(item.customImageMeta, customGallery);
    if (customMeta) out.customImageMeta = customMeta;

    const galleryMeta = compactGalleryMetaForExport(item.mudaeImageMeta, gallery);
    if (galleryMeta) out.mudaeImageMeta = galleryMeta;

    const galleryCheckHistory = compactGalleryCheckHistoryForExport(item.galleryCheckHistory);
    if (galleryCheckHistory) out.galleryCheckHistory = galleryCheckHistory;

    // Runtime/derived fields intentionally omitted:
    // imageUrl, hasMudaeGallery, mudaeGalleryCount, rawText, stableKey,
    // editNumber, boardIndex, display*Index, default colors, default tags,
    // default gallery metadata and empty/default fields.
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


  function normalizeAllCharacterImageGalleries() {
    app.state.characters.forEach(normalizeCharacterImageGallery);
  }

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

    // Parser-created News must always be reachable immediately after apply.
    // If the previous News divider was minimized, expand it before the render so
    // the post-parse jump lands on the section header instead of silently doing
    // nothing or staying near the parser panel.
    if (divider?.id) {
      divider.collapsed = false;
      divider.parserNews = true;
      divider.title = divider.title || 'News';
    }

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
    showAppLoading?.('Parsing Harem...', mode === 'replace'
      ? 'Replacing Characters And Stabilizing The Board.'
      : 'Adding Characters And Stabilizing The Board.');
    try { updateSharedLoader({ title: 'Parsing Harem...', detail: mode === 'replace' ? 'Replacing Characters And Stabilizing The Board.' : 'Adding Characters And Stabilizing The Board.', bytes: (els.parserInput?.value || '').length, parser: true }); } catch (_) {}

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
    const isParserNewsFocus = target.parserNews === true || !!target.newsDividerId;
    const focusId = isParserNewsFocus ? (target.newsDividerId || target.id) : target.id;
    const highlightId = target.highlightId || focusId;
    const safeId = getCssSafeId(focusId);
    const selector = `[data-id="${safeId}"]`;

    if (isParserNewsFocus) {
      const divider = app.state.characters.find(item => String(item?.id || '') === String(focusId || ''));
      if (divider && isDivider(divider)) {
        divider.collapsed = false;
        divider.parserNews = true;
        divider.title = divider.title || 'News';
      }
    }

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
      // board window yet. Parser News focuses the divider header itself, which
      // must be treated as a board entry, not as a normal character card.
      try {
        window.MudaeBoardController?.renderAroundId?.(focusId, {
          scroll: false,
          allowNavigation: false,
          highlight: false,
          source: `${options.reason || 'parser-apply-focus'}-prewarm`
        });
      } catch (_) {}

      const tryDirectScroll = () => {
        const directCard = document.querySelector(selector);
        if (!directCard) return false;
        if (scrollNode(directCard, 'start')) {
          target.focused = true;
          return true;
        }
        return false;
      };

      // Parser jumps should be deterministic and covered by the overlay.
      // After prewarming the row, use the real DOM node directly and place it
      // near the top of the viewport.
      if (tryDirectScroll()) return true;

      if (isParserNewsFocus) {
        // Virtual renders can mount the divider one frame after renderAroundId().
        // Schedule a short direct retry instead of falling back to the normal
        // character-centered focus path, which can land below the News header.
        requestAnimationFrame(() => {
          if (tryDirectScroll()) return;
          setTimeout(tryDirectScroll, 45);
        });
        target.focused = true;
        return true;
      }

      const focused = window.MudaeBoardController?.focusCharacterById?.(focusId, {
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
              notifyAppMessage?.(`Jumped to ${finalTarget.name || 'New Character'}${more}.`);
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

      updateSharedLoader({ title: 'Parsing Harem...', detail: 'Parsing Pasted Characters...', loaded: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, total: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, bytes: text.length, parser: true });

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
        updateSharedLoader({ title: 'Parsing Harem...', detail: 'Rendering Replaced Board...', loaded: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, total: result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, bytes: text.length, parser: true });
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
      updateSharedLoader({ title: 'Parsing Harem...', detail: 'Rendering New Characters...', loaded: addedCharacters.length || result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, total: addedCharacters.length || result.parsed.filter(item => !isDivider(item)).length || result.parsed.length, bytes: text.length, parser: true });
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

    if (field === 'tag') {
      const tagItems = [];
      (app.state.characters || []).forEach(item => {
        if (!item || item.type === 'divider') return;
        getCharacterGalleryTags(item).forEach(tag => tagItems.push({ tag, character: item }));
      });

      return getUniqueSearchSuggestionValues({
        source: tagItems,
        query,
        getValue: item => item?.tag,
        getHint: item => item?.character?.name ? `Gallery tag · ${item.character.name}` : 'Gallery tag'
      }).map(match => {
        const replacementToken = `tag:${quoteSearchSuggestionValue(match.value)}`;
        return {
          value: buildSearchSuggestionReplacement(context, replacementToken),
          label: replacementToken,
          hint: 'Gallery tag',
          kind: 'tag'
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
      { value: 'tag:"', label: 'tag:""', hint: 'Filter by Mudae image tags' },
      { value: 'tags:"', label: 'tags:""', hint: 'Alias of tag:' },
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
      raw === 't' ||
      raw === 'ta' ||
      raw === 'tag' ||
      raw === 'tag:' ||
      raw === 'tags' ||
      raw === 'tags:' ||
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


  function getPageScrollTopForShortcut() {
    const scrolling = document.scrollingElement;
    return Math.max(
      0,
      Number(window.scrollY || 0),
      Number(window.pageYOffset || 0),
      Number(document.documentElement?.scrollTop || 0),
      Number(document.body?.scrollTop || 0),
      Number(scrolling?.scrollTop || 0)
    );
  }

  function getShortcutSearchTarget() {
    const main = els.searchInput || document.getElementById('searchInput');
    const floating = els.floatingSearchInput || document.getElementById('floatingSearchInput');
    const pageTop = getPageScrollTopForShortcut();

    // Near the top, Ctrl+F should be deterministic: go to the real page top and
    // focus the main search. Trying to decide whether the top input is
    // "comfortable enough" caused cases where it stayed tucked under the topbar.
    if (main && pageTop < 1100) {
      return { input: main, shouldScrollToTopSearch: true };
    }

    if (isElementVisibleForSearchFocus(floating)) {
      return { input: floating, shouldScrollToTopSearch: false };
    }

    if (main) return { input: main, shouldScrollToTopSearch: true };

    return { input: floating, shouldScrollToTopSearch: false };
  }

  function forceScrollToRealPageTopForSearch() {
    // Ctrl+F near the top means "take me to the actual top search", not just a
    // calculated offset near the toolbar. Force all common scroll roots to 0 so
    // browser differences and file:// quirks cannot leave the toolbar half hidden.
    try { window.MHPAutoScrollGuard?.mark?.(1200, { force: true }); } catch {}

    const roots = [
      document.scrollingElement,
      document.documentElement,
      document.body
    ].filter(Boolean);

    for (const root of roots) {
      try { root.scrollTop = 0; } catch {}
    }

    try { window.scrollTo(0, 0); } catch {}
    try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch {}
  }

  function openAndFocusSearchFromShortcut() {
    const target = getShortcutSearchTarget();
    const input = target.input;
    if (!input) return false;

    const keepY = window.scrollY || document.documentElement.scrollTop || 0;

    // Capture the full-board origin immediately, before Ctrl+F scrolls to the
    // top search input. This makes clearing the next search return to the place
    // where Ctrl+F was started, including a minimized divider header such as
    // News. Force is intentional: repeated Ctrl+F with no active search should
    // use the latest visual origin, not a stale one from a previous shortcut.
    if (!String(app.filter?.q || '').trim()) {
      rememberSearchSessionOrigin({ force: true, fromCtrlF: true });
    }

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
      // Near the top, always go to the literal page top before focusing the main
      // search. Repeat across frames to beat delayed layout/floating-bar updates.
      forceScrollToRealPageTopForSearch();
      requestAnimationFrame(() => {
        forceScrollToRealPageTopForSearch();
        focusInput();
      });
      setTimeout(() => {
        forceScrollToRealPageTopForSearch();
        focusInput();
      }, 80);
      setTimeout(() => {
        forceScrollToRealPageTopForSearch();
      }, 180);
    } else {
      // Floating search is visible: do not move the board.
      focusInput();
      requestAnimationFrame(() => {
        try { window.MHPAutoScrollGuard?.mark?.(400, { force: true }); } catch {}
        window.scrollTo({ top: keepY, behavior: 'auto' });
      });
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

    // closed until the next real input/focus action. Previously Firefox could
    // leave the suggestion box visible after Tab.
    app.searchSuggestionsSuppressUntilInput = true;

    setUnifiedSearchValue(value);

    if (app.searchTimer) {
      clearTimeout(app.searchTimer);
      app.searchTimer = null;
    }

    hideSearchSuggestions({ force: true });

    const focusAcceptedSearchValue = () => {
      const input = getActiveSearchInputElement();
      if (!input) return null;
      input.focus({ preventScroll: true });
      input.setSelectionRange?.(value.length, value.length);
      return input;
    };

    const input = focusAcceptedSearchValue();

    const isPrefixOnlySuggestion = isIncompleteSearchCommand(value)
      || /^(character|characters|name):\"?$/i.test(String(value || '').trim())
      || /^(series|serie|divider|dividers|owner|note|gender):$/i.test(String(value || '').trim());

    if (isPrefixOnlySuggestion) {
      // Prefix completions like `character:"` are only text insertion helpers.
      // Keep the suggestion popup closed until the next real keystroke. This
      // avoids stale recommendations staying visible after accepting with Tab,
      // while still letting the user continue typing immediately.
      hideSearchSuggestions({ force: true, immediate: true });
      requestAnimationFrame(() => focusAcceptedSearchValue());

      if (value === 'gender:') {
        // gender: is the only prefix where the helper is useful immediately.
        app.searchSuggestionsSuppressUntilInput = false;
        els.board.replaceChildren(createSearchCommandMessage());
        requestAnimationFrame(() => showSearchSuggestions(focusAcceptedSearchValue() || input));
      }

      return true;
    }

    clearVirtualBoardAnchorsForSearch('accept-search-suggestion');
    els.board.replaceChildren(createSearchRenderLoadingMessage());
    requestAnimationFrame(() => {
      hideSearchSuggestions({ force: true, immediate: true });
      renderBoard();
      requestAnimationFrame(() => focusAcceptedSearchValue());
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

        hideSearchSuggestions({ force: true, immediate: true });

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
        hideSearchSuggestions({ force: true, immediate: true });
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

    document.addEventListener('pointerdown', event => {
      const target = event.target;
      if (!target) return;

      const isSearchUi = target === els.searchInput
        || target === els.floatingSearchInput
        || !!target.closest?.('#searchSuggestBox, #searchInput, #floatingSearchInput');

      if (!isSearchUi) {
        hideSearchSuggestions({ force: true, immediate: true });
      }
    }, true);

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
  function createSearchOriginSnapshot() {
    return {
      scrollY: Math.max(0, window.scrollY || document.documentElement.scrollTop || 0),
      anchor: captureBoardVisualAnchor?.() || null,
      startedAt: Date.now()
    };
  }

  function cloneSearchOriginSnapshot(snapshot) {
    if (!snapshot) return null;

    return {
      scrollY: Number.isFinite(snapshot.scrollY) ? snapshot.scrollY : null,
      anchor: snapshot.anchor ? { ...snapshot.anchor } : null,
      startedAt: snapshot.startedAt || Date.now()
    };
  }

  function hasSearchOriginSnapshot(snapshot) {
    return !!snapshot?.anchor?.id || Number.isFinite(snapshot?.scrollY);
  }

  function readSearchSessionOriginSnapshot() {
    return {
      scrollY: Number.isFinite(app.searchSessionOriginScrollY) ? app.searchSessionOriginScrollY : null,
      anchor: app.searchSessionOriginAnchor ? { ...app.searchSessionOriginAnchor } : null,
      startedAt: app.searchSessionOriginStartedAt || 0
    };
  }

  function writeSearchSessionOriginSnapshot(snapshot) {
    const clean = cloneSearchOriginSnapshot(snapshot);

    app.searchSessionOriginScrollY = Number.isFinite(clean?.scrollY) ? clean.scrollY : null;
    app.searchSessionOriginAnchor = clean?.anchor || null;
    app.searchSessionOriginStartedAt = clean?.startedAt || 0;

    return hasSearchOriginSnapshot(clean);
  }

  function readCtrlFSearchOriginSnapshot() {
    return {
      scrollY: Number.isFinite(app.ctrlFSearchOriginScrollY) ? app.ctrlFSearchOriginScrollY : null,
      anchor: app.ctrlFSearchOriginAnchor ? { ...app.ctrlFSearchOriginAnchor } : null,
      startedAt: app.ctrlFSearchOriginStartedAt || 0
    };
  }

  function writeCtrlFSearchOriginSnapshot(snapshot) {
    const clean = cloneSearchOriginSnapshot(snapshot);

    app.ctrlFSearchOriginScrollY = Number.isFinite(clean?.scrollY) ? clean.scrollY : null;
    app.ctrlFSearchOriginAnchor = clean?.anchor || null;
    app.ctrlFSearchOriginStartedAt = clean?.startedAt || 0;

    return hasSearchOriginSnapshot(clean);
  }

  function rememberSearchSessionOrigin(options = {}) {
    const force = options.force === true;

    if (!force && hasSearchSessionOrigin()) {
      return app.searchSessionOriginAnchor || app.searchSessionOriginScrollY;
    }

    const snapshot = createSearchOriginSnapshot();
    writeSearchSessionOriginSnapshot(snapshot);

    // Ctrl+F can focus/scroll the top search before the first rendered query.
    // Keep one durable shortcut snapshot so advanced filters can still restore.
    if (options.fromCtrlF === true) {
      writeCtrlFSearchOriginSnapshot(snapshot);
    }

    return app.searchSessionOriginAnchor || app.searchSessionOriginScrollY;
  }

  function hasCtrlFSearchOrigin() {
    return hasSearchOriginSnapshot(readCtrlFSearchOriginSnapshot());
  }

  function hydrateSearchSessionOriginFromCtrlF() {
    const snapshot = readCtrlFSearchOriginSnapshot();
    if (!hasSearchOriginSnapshot(snapshot)) return false;
    return writeSearchSessionOriginSnapshot(snapshot);
  }

  function clearCtrlFSearchOrigin() {
    writeCtrlFSearchOriginSnapshot(null);
  }

  function clearSearchSessionOrigin(options = {}) {
    writeSearchSessionOriginSnapshot(null);

    if (options.clearCtrlF !== false) {
      clearCtrlFSearchOrigin();
    }
  }

  function hasSearchSessionOrigin() {
    return hasSearchOriginSnapshot(readSearchSessionOriginSnapshot());
  }

  function restoreSearchSessionOriginAfterRender() {
    const anchor = app.searchSessionOriginAnchor ? { ...app.searchSessionOriginAnchor } : null;
    const targetY = Number(app.searchSessionOriginScrollY);

    // Keep a stable copy of the pre-search origin and restore it aggressively.
    // When the user scrolls inside a filtered board, the filtered scroll position
    // can force the full-board virtualizer to mount the wrong window first. If
    // we only try the anchor once, clearing search can land at the top.
    clearSearchSessionOrigin({ clearCtrlF: false });

    const hasTargetY = Number.isFinite(targetY);
    const safeY = hasTargetY ? Math.max(0, targetY) : 0;
    const startedAt = Date.now();
    app.suppressViewPositionSaveUntil = Date.now() + 1600;
    app.__mhpRestoringSearchOriginUntil = Date.now() + 1600;

    // Guard against overlapping restore cycles: if the user clears/starts another
    // search before this one finishes, older scheduled passes must no-op instead
    // of fighting the newer restore with their own scrollTo calls.
    const myToken = (app.__searchOriginRestoreToken = (app.__searchOriginRestoreToken || 0) + 1);
    const isStale = () => app.__searchOriginRestoreToken !== myToken;

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

    // isFirst only: snap to the remembered absolute pixel position once, so the
    // board controller/virtualizer wakes up in the right region even if the
    // filtered board was much shorter or much farther down. Doing this snap on
    // every later pass too was the cause of the repeated visible jumping — each
    // pass re-jumped to the old rough position before correcting again.
    const restoreOnce = (isFirst) => {
      if (isStale()) return false;

      ensureFullEntries();

      if (isFirst) {
        restoreByScrollY();
      }

      // Correct by visual anchor so responsive grids/columns do not leave the
      // user a few rows above or below the exact pre-search spot. This is a
      // gentle small-delta correction (see restoreBoardVisualAnchor), not a
      // hard jump, so repeating it on later passes is not visually disruptive.
      restoreByAnchor();

      window.MudaeMinimalImageLoader?.releaseVisible?.(els.board);
      window.MudaeGifControl?.refresh?.();
      return true;
    };

    if (!anchor?.id && !hasTargetY) return false;

    restoreOnce(true);
    requestAnimationFrame(() => {
      if (isStale()) return;
      restoreOnce(false);
    });

    // One delayed anchor-only pass is kept as a safety net for boards where
    // images/GIFs finish loading and shift layout slightly after the initial
    // render (e.g. clearing after scrolling through a filtered Series:/Name:
    // result). It only nudges by the remaining delta, so it will not jump.
    setTimeout(() => {
      if (isStale() || Date.now() - startedAt > 1800) return;
      restoreOnce(false);
    }, 250);

    setTimeout(clearCtrlFSearchOrigin, 1900);

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
    const typedNormalized = raw.trim().toLowerCase();
    const normalized = typedNormalized && isSearchQueryReadyForRender(raw) ? typedNormalized : '';

    // Normal searching and movement while filtered are separate sessions.
    // Normal typing captures where the user was before the first non-empty
    // query so clearing search can return there. Movement code can still opt
    // into the move-origin path explicitly without hijacking normal clear.
    if (normalized && !app.filter.q && options.captureSearchOrigin !== false) {
      if (!hasSearchSessionOrigin() && hasCtrlFSearchOrigin()) {
        hydrateSearchSessionOriginFromCtrlF();
      }
      rememberSearchSessionOrigin();
    }

    if (normalized && !app.filter.q && options.captureMoveOrigin === true) {
      rememberSearchMoveOrigin();
    }

    if (!typedNormalized && !options.keepSearchOrigin) {
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
    scheduleGalleryTagSearchFilter({ updateStatus: hasActiveGalleryTagSearch(raw) });
    window.MudaeFloatingBar?.syncVisibility?.();
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

    // Clear must always rebuild the complete board, but it should restore the
    // user's pre-search visual origin when available. This is intentionally
    // separate from the special search-move origin used by drag/move flows.
    if (hadSearch && !hasSearchSessionOrigin() && hasCtrlFSearchOrigin()) {
      hydrateSearchSessionOriginFromCtrlF();
    }

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
        showAppAlert('Could Not Import JSON: ' + error.message, { title: 'Import Failed', variant: 'danger' });
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
      if (rawValue.trim() && app.multiSelectMode) {
        toggleMultiSelectMode(false);
      }
      const nextQuery = rawValue.trim().toLowerCase();
      const wasSearching = !!app.filter.q;
      const isClearingSearch = wasSearching && !nextQuery;

      if (isClearingSearch) {
        clearSearchText({ focusTarget: els.searchInput });
        return;
      }

      const queryReady = isSearchQueryReadyForRender(rawValue);

      setUnifiedSearchValue(rawValue, { updateTop: false });
      const floatingInput = els.floatingSearchInput || document.getElementById('floatingSearchInput');
      const suggestionInput = (window.__mhpFloatingSearchSyncingInput && document.activeElement === floatingInput)
        ? floatingInput
        : els.searchInput;
      showSearchSuggestions(suggestionInput);

      if (!queryReady) {
        if (app.searchTimer) clearTimeout(app.searchTimer);
        app.searchTimer = null;
        if (els.floatingSearchInput && els.floatingSearchInput.value !== rawValue) els.floatingSearchInput.value = rawValue;
        syncSearchClearButton();
        window.MudaeFloatingBar?.syncVisibility?.();
        if (wasSearching) scheduleBoardRender('top-search-below-minchars-clear', { delay: 0 });
        return;
      }

      if (nextQuery) applySearchTypingNoJumpGuard();

      if (app.searchTimer) clearTimeout(app.searchTimer);
      app.searchTimer = setTimeout(() => {
        app.searchTimer = null;
        scheduleBoardRender('top-search-input', { delay: 0 });
      }, 120);
    });
    els.searchInput.addEventListener('keydown', handleSearchKeydown);
    els.searchInput.addEventListener('focus', () => showSearchSuggestions(els.searchInput));
    els.searchInput.addEventListener('blur', () => scheduleHideSearchSuggestions(160));

    els.clearSearchBtn.addEventListener('click', clearSearchText);
els.filterTypeSelect.addEventListener('change', () => {
      app.filter.type = els.filterTypeSelect.value;
      renderBoard();
    });

    els.globalGalleryCheckBtn?.addEventListener('click', event => {
      event.preventDefault();
      startGlobalGalleryCheck();
    });


    els.galleryTagsIndexBtn?.addEventListener('click', event => {
      event.preventDefault();
      showGalleryTagsIndexDialog();
    });

    els.restoreAllBtn.addEventListener('click', () => {
      const hadSearch = !!app.filter.q;
      if (hadSearch) rememberSearchClearAnchor();

      if (app.searchTimer) {
        clearTimeout(app.searchTimer);
        app.searchTimer = null;
      }

      els.filterTypeSelect.value = 'all';
      app.filter.type = 'all';

      if (hadSearch) {
        clearSearchText({ focus: false, focusTarget: els.searchInput });
      } else {
        setUnifiedSearchValue('');
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
    els.loadPastedBtn?.addEventListener('click', parsePastedGallery);
    els.addCustomGalleryBtn?.addEventListener('click', addCustomGalleryFromPaste);
    els.galleryMatchedOnlyBtn?.addEventListener('click', toggleMatchedOnlyGallery);
    els.galleryTagSearchInput?.addEventListener('input', () => {
      app.galleryIgnoreGlobalTagSearch = false;
      applyGalleryTagSearchFilter({ updateStatus: true });
    });
    els.galleryTagSearchInput?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        els.galleryTagSearchInput.value = '';
        app.galleryIgnoreGlobalTagSearch = true;
        applyGalleryTagSearchFilter({ updateStatus: true });
      }
    });
    els.galleryTagClearBtn?.addEventListener('click', event => {
      event.preventDefault();
      if (els.galleryTagSearchInput) els.galleryTagSearchInput.value = '';
      app.galleryIgnoreGlobalTagSearch = true;
      applyGalleryTagSearchFilter({ updateStatus: true });
      setGalleryStatus(`${app.lastGalleryItems?.length || 0} image(s) shown.`);
    });
    els.galleryUseMatchedBtn?.addEventListener('click', useFirstMatchedGalleryImage);
    const clearOfficialGallery = () => {
      const ch = getCharacter(app.activeId);
      const cleared = clearActiveOfficialGalleryCache();
      clearGallery(false);
      openGallery('clear-official-cache');
      const refreshed = getCharacter(app.activeId);
      const customItems = buildCustomGalleryItemsFromCharacter(refreshed);
      if (customItems.length) renderGallery(customItems, { fastOpen: true });
      setGalleryStatus(cleared
        ? `Official gallery cleared${customItems.length ? ` · ${customItems.length} custom kept` : ''}.`
        : 'No active character gallery to clear.');

      if (ch && !hasRealImage(ch.image)) {
        setTimeout(autoSearchMudae, 80);
      }
    };

    const clearCustomGallery = () => {
      const cleared = clearActiveCustomGalleryCache();
      clearGallery(false);
      openGallery('clear-custom-cache');
      const ch = getCharacter(app.activeId);
      const officialItems = buildGalleryItemsFromCharacter(ch);
      if (officialItems.length) renderGallery(officialItems, { fastOpen: true });
      setGalleryStatus(cleared
        ? `Custom gallery cleared${officialItems.length ? ` · ${officialItems.length} official kept` : ''}.`
        : 'No active character gallery to clear.');
    };

    els.clearGalleryBtn?.addEventListener('click', () => {
      const cleared = clearActiveCharacterGalleryCache();
      clearGallery(true);
      openGallery('clear-cache');
      setGalleryStatus(cleared ? 'Gallery cache cleared. Search Mudae will run again next time.' : 'Gallery cleared.');

      const ch = getCharacter(app.activeId);
      if (ch && !hasRealImage(ch.image)) {
        setTimeout(autoSearchMudae, 80);
      }
    });
    els.clearOfficialGalleryBtn?.addEventListener('click', clearOfficialGallery);
    els.clearCustomGalleryBtn?.addEventListener('click', clearCustomGallery);
    document.addEventListener('paste', handleGlobalPaste);

    els.galleryPasteInput.addEventListener('paste', event => {
      const text = event.clipboardData?.getData('text/plain') || '';
      if (!text || !/https?:\/\//i.test(text)) return;

      event.preventDefault();
      if (parseCustomGalleryItemsFromText(text).length) {
        replaceCustomGalleryFromPaste(text);
      } else {
        parsePastedGallery(text);
      }
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

    document.addEventListener('pointerdown', event => {
      if (!hasExpandedStatsBreakdown()) return;
      if (event.target.closest('#statsBar')) return;
      closeExpandedStatsBreakdowns();
    }, { capture: true });

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

  function expandCollapsedDividerPathForSearchResult(targetId) {
    if (!targetId || !Array.isArray(app.state?.characters)) return false;

    const list = app.state.characters;
    const targetIndex = list.findIndex(item => item?.id === targetId);
    if (targetIndex < 0) return false;

    const target = list[targetIndex];
    let changed = false;

    // If Enter lands on a divider result, make sure the matched divider itself is open.
    if (isDivider(target) && target.collapsed) {
      target.collapsed = false;
      changed = true;
    }

    // For character results, open every collapsed parent divider/sub-divider.
    // Search results can show cards even while their section is minimized, but once
    // the filter is cleared the full board hides those cards again. Expanding the
    // ancestor path before focusing gives the board-controller a visible target.
    let childLevel = isDivider(target) ? getDividerLevel(target) : Number.POSITIVE_INFINITY;

    for (let i = targetIndex - 1; i >= 0; i--) {
      const item = list[i];
      if (!isDivider(item)) continue;

      const level = getDividerLevel(item);
      if (level >= childLevel) continue;

      if (item.collapsed) {
        item.collapsed = false;
        changed = true;
      }

      childLevel = level;
      if (level <= 1) break;
    }

    if (changed) {
      try { saveLocal?.(); } catch {}
      try { window.MudaeDividers?.sync?.(); } catch {}
    }

    return changed;
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

    const expandedCollapsedSearchPath = expandCollapsedDividerPathForSearchResult(matched.id);

    // Clear the filter without dispatching the normal input/change handlers.
    // Those handlers run the normal clear-search path, which rebuilds the board.
    // Enter search should have exactly one scroll owner: board-controller focus.
    clearSearchForFocusJump();

    if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
    if (expandedCollapsedSearchPath && window.MudaeBoardController?.updateEntriesFromApp) {
      try { window.MudaeBoardController.updateEntriesFromApp(); } catch {}
    }
    if (typeof assignBoardCounters === 'function') assignBoardCounters();

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
    // This API is also called by js/floating/shortcuts.js before the app-level
    // Ctrl+F capture handler can run. Route it through the same shortcut path so
    // near-top Ctrl+F always jumps to the real top search instead of focusing a
    // partially hidden input under the topbar.
    if (!app.focusSearchShortcutRouting) {
      try {
        app.focusSearchShortcutRouting = true;
        if (typeof openAndFocusSearchFromShortcut === 'function' && openAndFocusSearchFromShortcut()) return;
      } finally {
        app.focusSearchShortcutRouting = false;
      }
    }

    const mainSearch = els.searchInput || document.getElementById('searchInput');

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

  function getMhpDebugSnapshot() {
    const board = els.board || document.getElementById('board');
    const mountedCards = board?.querySelectorAll?.('.char-card[data-id]').length || 0;
    const mountedDividers = board?.querySelectorAll?.('.divider-row').length || 0;
    const totalCharacters = (app.state.characters || []).filter(item => !isDivider(item)).length;
    const query = getActiveSearchQuery();

    return {
      time: new Date().toISOString(),
      visualMode: document.body?.dataset?.visualMode || '',
      theme: document.body?.dataset?.theme || '',
      query,
      filterType: app.filter.type,
      totalCharacters,
      mountedCards,
      mountedDividers,
      boardChildren: board?.children?.length || 0,
      multiSelect: !!app.multiSelectMode,
      selected: app.multiSelectedIds?.size || 0,
      searchCacheVersion: app.searchCacheVersion,
      searchTerms: getSearchTermObjects(query).length,
      renderScheduler: { ...(app.renderScheduler || {}) },
      imageLoader: window.MudaeMinimalImageLoader?.getState?.() || null,
      boardController: window.MudaeBoardController?.getDebugState?.() || null
    };
  }

  function installMhpDebugTools() {
    if (window.MHPDebug?.snapshot) return;

    window.MHPDebug = {
      snapshot: getMhpDebugSnapshot,
      log() {
        const snapshot = getMhpDebugSnapshot();
        console.table(snapshot);
        return snapshot;
      },
      enablePanel() {
        document.body.classList.add('mhp-debug-panel-enabled');
        let panel = document.getElementById('mhpDebugPanel');
        if (!panel) {
          panel = document.createElement('pre');
          panel.id = 'mhpDebugPanel';
          panel.className = 'mhp-debug-panel';
          document.body.appendChild(panel);
        }

        const tick = () => {
          if (!document.body.classList.contains('mhp-debug-panel-enabled')) return;
          const snap = getMhpDebugSnapshot();
          panel.textContent = [
            `mode: ${snap.visualMode || 'default'} · theme: ${snap.theme || 'default'}`,
            `query: ${snap.query || '—'} · filter: ${snap.filterType}`,
            `mounted: ${snap.mountedCards}/${snap.totalCharacters} cards · dividers: ${snap.mountedDividers}`,
            `render: ${snap.renderScheduler.lastReason || '—'}`
          ].join('\n');
          requestAnimationFrame(() => setTimeout(tick, 250));
        };
        tick();
      },
      disablePanel() {
        document.body.classList.remove('mhp-debug-panel-enabled');
        document.getElementById('mhpDebugPanel')?.remove();
      }
    };
  }

  function buildPublicApi() {
    return {
      app,
      els,
      STORAGE_KEY,

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
      scheduleBoardRender,
      scheduleRenderAll,
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
      ensureFilteredBoardMatchesSearch,
      scheduleSearchFilterRestore,
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
      moveSelectedCharactersToPosition,
      promptMoveSelectedCharactersSafe,
      getCharacterCount,

      // Settings bridges
      setVisibleCardLimit,
      getVisibleCardLimit,
      setVirtualBoardEnabled,
      isVirtualBoardEnabled,
      getBoardColumnSetting,
      setBoardColumnSetting,
      getGroupNamingMode,
      setGroupNamingMode,

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
        syncCustomGalleryFlags,
        dedupeCharacterImageUrls,
        dedupeCustomImageUrls,
        buildGalleryMetaMap,
        buildCustomImageMetaMap,
        splitGalleryItemsBySource,
        isAllowedCustomImageHost,
        hasRealImage,
        canonicalImageUrlKey,
        recalcStats,
        assignBoardCounters,
        renderCharacterCardById,
        syncSearchClearButton
      },

      // Dialogs / diagnostics
      showAppAlert,
      showAppConfirm,
      showAppPrompt,
      notifyAppMessage,
      debugSearch,
      debugGenderCounts,
      getMhpDebugSnapshot,
      clearSearchRuntimeCaches
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
    installMudaeGalleryBridgeHandler();
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
    installMhpDebugTools();

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
        if (!app.localLoadWasHeavy) showAppLoading('Loading Harem...', 'Preparing Saved Characters And Images.');
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


(() => {
  if (window.__mhpBackgroundRepaintFixInstalled) return;
  window.__mhpBackgroundRepaintFixInstalled = true;

  const refreshBackgroundComposite = () => {
    const root = document.documentElement;
    if (!root.classList.contains('has-custom-page-bg')) return;
    root.classList.add('mhp-bg-repaint');
    requestAnimationFrame(() => root.classList.remove('mhp-bg-repaint'));
  };

  // document.addEventListener('visibilitychange', refreshBackgroundComposite, { passive: true });
  // window.addEventListener('focus', refreshBackgroundComposite, { passive: true });
})();


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

  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchBootFinish, { once: true });
  } else {
    patchBootFinish();
  }

  window.addEventListener('load', patchBootFinish, { once: true });
})();


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


// Safety sync for Edit modal Image URL field.
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


// Prevent newest-character auto-scroll from soft-locking the viewport.
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

  // Patch scrollIntoView similarly. This stops delayed highlight/follow loops.

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


// Keep active search filters rendered after external Mudae tab focus changes.
(() => {
  if (window.__mhpExternalSearchFilterRestoreInstalled) return;
  window.__mhpExternalSearchFilterRestoreInstalled = true;

  const restore = () => {
    const api = window.MUDAE_REBUILD_V1;
    if (!api?.app || !api?.renderBoard) return;

    const q = String(api.app.filter?.q || api.els?.searchInput?.value || api.els?.floatingSearchInput?.value || '').trim();
    if (!q) return;

    if (typeof api.ensureFilteredBoardMatchesSearch === 'function') {
      api.ensureFilteredBoardMatchesSearch('mudae-search-return');
      return;
    }

    api.app.filter.q = api.normalizeSearchText ? api.normalizeSearchText(q) : q.toLowerCase();
    api.renderBoard();
    window.MudaeBoardController?.updateEntriesFromApp?.();
  };

  window.addEventListener('focus', () => setTimeout(restore, 80), true);
  window.addEventListener('pageshow', () => setTimeout(restore, 80), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(restore, 80);
  }, true);
})();

// Tab visibility/focus stability guard.
// Switching browser tabs must not close settings/dialogs or repaint the background.
(() => {
  if (window.__mhpTabVisibilityStabilityFixInstalled) return;
  window.__mhpTabVisibilityStabilityFixInstalled = true;

  let lastSnapshot = null;
  let restoring = false;

  // Search Mudae opens another tab/window while Edit is visible; the old
  // visibility guard saved that open Edit state and then restored it on focus,
  // even after Save/Cancel had correctly closed it. That was the root cause
  // of the post-save reopen loop. Edit + gallery lifecycle now belongs only
  // to js/edit-gallery-manager.js and app.js openEdit/closeEdit.
  const panelIds = [
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


// Cleanup stale dynamic background classes from previous versions.
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


// Real fixed background layer. No pseudo-element repaint hacks.
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


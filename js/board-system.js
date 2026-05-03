(function() {
  if (window.__dividersModuleLoaded) return;
  window.__dividersModuleLoaded = true;

  /* Refs y utilidades */

  function syncDividerModalRefs() {
    els.dividerModalOverlay = document.getElementById('dividerModalOverlay');
    els.dividerModalTitle = document.getElementById('dividerModalTitle');
    els.dividerModalSubtitle = document.getElementById('dividerModalSubtitle');
    els.dividerLevelSelect = document.getElementById('dividerLevelSelect');
    els.dividerNameInput = document.getElementById('dividerNameInput');
    els.dividerPositionControl = document.getElementById('dividerPositionControl');
    els.dividerInsertAfterInput = document.getElementById('dividerInsertAfterInput');
    els.dividerModalCancelBtn = document.getElementById('dividerModalCancelBtn');
    els.dividerModalConfirmBtn = document.getElementById('dividerModalConfirmBtn');
    els.dividerNotesPanel = document.getElementById('dividerNotesPanel');
    els.dividerNotesList = document.getElementById('dividerNotesList');
    els.dividerCharacterNotesControl = document.getElementById('dividerCharacterNotesControl');
    els.dividerCharacterNotesList = document.getElementById('dividerCharacterNotesList');
  }

  function syncSortSectionModalRefs() {
    els.sortSectionModalOverlay = document.getElementById('sortSectionModalOverlay');
    els.sortSectionModalTitle = document.getElementById('sortSectionModalTitle');
    els.sortSectionModalSubtitle = document.getElementById('sortSectionModalSubtitle');
    els.sortSectionFieldSelect = document.getElementById('sortSectionFieldSelect');
    els.sortSectionDirectionSelect = document.getElementById('sortSectionDirectionSelect');
    els.sortSectionFieldSelect2 = document.getElementById('sortSectionFieldSelect2');
    els.sortSectionDirectionSelect2 = document.getElementById('sortSectionDirectionSelect2');
    els.sortSectionCancelBtn = document.getElementById('sortSectionCancelBtn');
    els.sortSectionConfirmBtn = document.getElementById('sortSectionConfirmBtn');
  }

  function isDividerItem(item) {
    return !!(item && item.type === 'divider');
  }

  function getDividerLevel(item) {
    var level = parseInt(item && item.level ? item.level : 1, 10);
    return level === 2 ? 2 : 1;
  }

  function isDividerCollapsed(item) {
    return !!(item && item.collapsed);
  }

  function createDividerItem(title, level) {
    var label = String(title || '').trim() || 'Divider';
    var normalizedLevel = parseInt(level, 10) === 2 ? 2 : 1;
    return {
      id: uid(),
      type: 'divider',
      level: normalizedLevel,
      title: label,
      name: label,
      currentRank: 0,
      globalRank: 0,
      owner: '',
      note: '',
      roulette: '',
      mudaeTags: [],
      keyType: '',
      keys: 0,
      color: normalizedLevel === 2 ? '#a78bfa' : '#8b5cf6',
      kakera: 0,
      series: '',
      seriesOwned: 0,
      seriesTotal: 0,
      image: '',
      collapsed: false
    };
  }

  function findDividerById(dividerId) {
    return window.AppState && Array.isArray(AppState.characters)
      ? AppState.characters.find(function(item) {
          return item && item.id === dividerId && isDividerItem(item);
        })
      : null;
  }

  function isDivider(item) {
    return isDividerItem(item);
  }

  function isDividerSafe(item) {
    return isDividerItem(item);
  }

  /* Rangos y orden */

  function getDividerSectionRange(dividerId) {
    var dividerIndex = AppState.characters.findIndex(function(item) {
      return item.id === dividerId && isDividerItem(item);
    });
    if (dividerIndex === -1) return null;

    var start = dividerIndex + 1;
    var end = AppState.characters.length;

    for (var i = start; i < AppState.characters.length; i++) {
      if (isDividerItem(AppState.characters[i])) {
        end = i;
        break;
      }
    }

    return {
      dividerIndex: dividerIndex,
      start: start,
      end: end
    };
  }

  function getDividerContentRangeInList(items, dividerId) {
    var list = Array.isArray(items) ? items : [];
    var dividerIndex = list.findIndex(function(item) {
      return item && item.id === dividerId && isDividerItem(item);
    });
    if (dividerIndex === -1) return null;

    var divider = list[dividerIndex];
    var level = getDividerLevel(divider);
    var start = dividerIndex + 1;
    var end = list.length;

    for (var i = start; i < list.length; i++) {
      if (isDividerItem(list[i]) && getDividerLevel(list[i]) <= level) {
        end = i;
        break;
      }
    }

    return {
      dividerIndex: dividerIndex,
      start: start,
      end: end,
      level: level,
      divider: divider
    };
  }

  function getSectionRangeById(dividerId) {
    if (typeof window.getDividerSectionRange === 'function') {
      return window.getDividerSectionRange(dividerId);
    }

    var list = getList();
    var start = -1;

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (isDivider(item) && item.id === dividerId) {
        start = i + 1;
        break;
      }
    }

    if (start < 0) return null;

    var level = window.getDividerLevel ? window.getDividerLevel(list[start - 1]) : 1;
    var end = list.length;

    for (var j = start; j < list.length; j++) {
      var cur = list[j];
      if (isDivider(cur) && window.getDividerLevel && window.getDividerLevel(cur) <= level) {
        end = j;
        break;
      }
    }

    return {
      start: start,
      end: end
    };
  }

  function sectionRanges(list) {
    var ranges = [];
    var start = 0;

    for (var i = 0; i <= list.length; i++) {
      if (i === list.length || isDivider(list[i])) {
        ranges.push([start, i]);
        start = i + 1;
      }
    }

    return ranges;
  }

  function getDividerCharacterCountInList(items, dividerId) {
    var range = getDividerContentRangeInList(items, dividerId);
    if (!range) return 0;
    return countVisibleCharactersInRange(items, range.start, range.end);
  }

  function getInsertIndexWithinDividerByVisiblePositionInList(items, dividerId, targetPosition) {
    var range = getDividerContentRangeInList(items, dividerId);
    if (!range) return -1;

    var maxCount = countVisibleCharactersInRange(items, range.start, range.end);
    var position = parseInt(String(targetPosition || '').trim(), 10);

    if (!position || isNaN(position)) position = 1;
    if (position < 1) position = 1;
    if (position > maxCount + 1) position = maxCount + 1;
    if (maxCount === 0) return range.end;

    var visible = 0;
    for (var i = range.start; i < range.end; i++) {
      if (isDividerItem(items[i])) continue;
      visible += 1;
      if (visible === position) return i;
    }

    return range.end;
  }

  function getSectionRankValue(item) {
    var rank = Number((item && item.globalRank) || 0);
    return rank > 0 ? rank : Number.MAX_SAFE_INTEGER;
  }

  function getSectionSortValue(item, field) {
    if (field === 'name') return normalizeStableText(item.name || '');
    if (field === 'rank') return Number(item.globalRank || 0);
    if (field === 'kakera') return Number(item.kakera || 0);
    if (field === 'keys') return Number(item.keys || 0);
    if (field === 'series') return normalizeStableText(item.series || '');
    return '';
  }

  function compareSectionValues(valA, valB, direction) {
    var dir = direction === 'desc' ? -1 : 1;
    var isString = typeof valA === 'string' || typeof valB === 'string';

    if (isString) {
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    }

    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  }

  function compareSectionItems(a, b, criteria) {
    var list = (Array.isArray(criteria) ? criteria : []).filter(function(item) {
      return item && item.field && item.field !== 'seriesTopRank';
    });

    if (!list.length) {
      list = [{
        field: 'name',
        direction: 'asc'
      }];
    }

    for (var i = 0; i < list.length; i++) {
      var criterion = list[i] || {};
      var field = String(criterion.field || 'name');
      var direction = String(criterion.direction || 'asc');
      var valA = getSectionSortValue(a, field);
      var valB = getSectionSortValue(b, field);
      var result = compareSectionValues(valA, valB, direction);

      if (result !== 0) return result;

      if (field === 'series') {
        var seriesNameA = normalizeStableText(a.name || '');
        var seriesNameB = normalizeStableText(b.name || '');
        if (seriesNameA < seriesNameB) return -1;
        if (seriesNameA > seriesNameB) return 1;
      }
    }

    var nameA = normalizeStableText(a.name || '');
    var nameB = normalizeStableText(b.name || '');
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  }

  function sortSectionBySeriesTopRank(section, criteria) {
    var list = Array.isArray(section) ? section.slice() : [];
    if (!list.length) return list;

    var map = {};
    var order = [];

    list.forEach(function(item) {
      var key = normalizeStableText(item.series || '');
      if (!map[key]) {
        map[key] = {
          key: key,
          label: String(item.series || '').trim() || 'No series',
          topRank: getSectionRankValue(item),
          items: []
        };
        order.push(key);
      }

      map[key].items.push(item);

      var nextRank = getSectionRankValue(item);
      if (nextRank < map[key].topRank) map[key].topRank = nextRank;
    });

    var innerCriteria = (Array.isArray(criteria) ? criteria : []).filter(function(item) {
      return item && item.field && item.field !== 'seriesTopRank';
    });

    if (!innerCriteria.length) {
      innerCriteria = [{
        field: 'rank',
        direction: 'asc'
      }, {
        field: 'name',
        direction: 'asc'
      }];
    }

    var groups = order.map(function(key) {
      return map[key];
    });

    groups.forEach(function(group) {
      group.items.sort(function(a, b) {
        return compareSectionItems(a, b, innerCriteria);
      });
    });

    groups.sort(function(a, b) {
      if (a.topRank !== b.topRank) return a.topRank - b.topRank;

      var labelA = normalizeStableText(a.label || '');
      var labelB = normalizeStableText(b.label || '');
      if (labelA < labelB) return -1;
      if (labelA > labelB) return 1;
      return 0;
    });

    return groups.reduce(function(acc, group) {
      return acc.concat(group.items);
    }, []);
  }

  function sortDividerSection(dividerId, criteria) {
    var range = getDividerSectionRange(dividerId);
    if (!range) return;

    var section = AppState.characters.slice(range.start, range.end).filter(function(item) {
      return !isDividerItem(item);
    });

    if (!section.length) {
      showMessage('There are no characters under this divider.', 'error');
      return;
    }

    var normalizedCriteria = (Array.isArray(criteria) ? criteria : []).filter(function(item) {
      return item && item.field;
    });

    if (!normalizedCriteria.length) {
      normalizedCriteria = [{
        field: 'name',
        direction: 'asc'
      }];
    }

    pushPositionUndoSnapshot('section sort');

    var sortedSection = normalizedCriteria[0] && normalizedCriteria[0].field === 'seriesTopRank'
      ? sortSectionBySeriesTopRank(section, normalizedCriteria)
      : section.slice().sort(function(a, b) {
          return compareSectionItems(a, b, normalizedCriteria);
        });

    AppState.characters.splice(range.start, range.end - range.start, ...sortedSection);
    renumberAllItems();
    rebuildPersistentOrderMap();
    refreshChangedZone();
    renderBoard();
    ensureHideMissingButton();
    saveLocal(false);
    showMessage('Section sorted by ' + buildSortCriteriaDescription(normalizedCriteria) + '.');
  }

  /* Render y CRUD */

  function createDividerCardHTML(item) {
    var title = String(item.title || item.name || 'Divider').trim() || 'Divider';
    var level = getDividerLevel(item);
    var levelLabel = level === 2 ? 'Sub-divider' : 'Divider';
    var isSelected = AppState.selectedMoveIds.indexOf(item.id) !== -1;
    var isCollapsed = isDividerCollapsed(item);

    var cardClasses = 'character-card divider-card divider-level-' + level;
    if (AppState.multiSelectMode) cardClasses += ' multi-select-on';
    if (isSelected) cardClasses += ' is-selected';
    if (isCollapsed) cardClasses += ' is-collapsed';

    var toggleLabel = isCollapsed ? '▸' : '▾';
    var toggleTitle = isCollapsed ? 'Expand divider' : 'Collapse divider';

    return '' +
      '<article class="' + cardClasses + '" draggable="true" data-id="' + escapeHtml(item.id) + '">' +
      '  <div class="divider-head">' +
      '    <div class="divider-title-wrap">' +
      '      <button class="divider-btn divider-toggle-btn" data-divider-toggle="' + escapeHtml(item.id) + '" aria-pressed="' + (isCollapsed ? 'true' : 'false') + '" title="' + escapeHtml(toggleTitle) + '">' + toggleLabel + '</button>' +
      '      <span class="divider-level-badge">' + escapeHtml(levelLabel) + '</span>' +
      '      <div class="divider-title">' + escapeHtml(title) + '</div>' +
      '      <div class="divider-line"></div>' +
      '    </div>' +
      '    <div class="divider-actions">' +
      '      <button class="divider-btn divider-block-toggle-btn' + (item.moveWithChildren ? ' is-active' : '') + '" data-divider-block-toggle="' + escapeHtml(item.id) + '" title="' + escapeHtml(item.moveWithChildren ? 'Move with section enabled' : 'Move with section disabled') + '">Section</button>' +
      '      <button class="divider-btn" data-divider-copy-smp="' + escapeHtml(item.id) + '">Copy $smp</button>' +
      '      <button class="divider-btn" data-divider-sort="' + escapeHtml(item.id) + '">Sort</button>' +
      '      <button class="divider-btn" data-move-id="' + escapeHtml(item.id) + '" title="Change order">Move</button>' +
      '      <button class="divider-btn" data-divider-edit="' + escapeHtml(item.id) + '">Edit</button>' +
      '      <button class="divider-btn danger" data-divider-delete="' + escapeHtml(item.id) + '">Delete</button>' +
      '    </div>' +
      '  </div>' +
      '</article>';
  }

  function toggleDividerCollapse(id, applyToAll) {
    var item = AppState.characters.find(function(entry) {
      return entry.id === id && isDividerItem(entry);
    });
    if (!item) return;

    var nextState = !isDividerCollapsed(item);

    if (applyToAll) {
      AppState.characters.forEach(function(entry) {
        if (isDividerItem(entry)) entry.collapsed = nextState;
      });
    } else {
      item.collapsed = nextState;
    }

    renderBoard();
    ensureHideMissingButton();
    saveLocal(false);
  }

  function openDividerModal(mode, id) {
    syncDividerModalRefs();

    DividerModalState.mode = mode || 'add';
    DividerModalState.itemId = id || null;

    var item = id ? AppState.characters.find(function(entry) {
      return entry.id === id && isDividerItem(entry);
    }) : null;

    var visibleCount = getVisibleCharacterCount(AppState.characters);
    var level = item ? getDividerLevel(item) : 1;

    if (els.dividerModalTitle) {
      els.dividerModalTitle.textContent = mode === 'edit' ? 'Edit divider' : 'Add divider';
    }

    if (els.dividerModalSubtitle) {
      els.dividerModalSubtitle.textContent = mode === 'edit'
        ? 'Update the divider name and type shown in the board.'
        : 'Choose the divider type, name and where it should be inserted.';
    }

    if (els.dividerLevelSelect) {
      els.dividerLevelSelect.value = String(level);
    }

    if (els.dividerNameInput) {
      els.dividerNameInput.value = item ? String(item.title || item.name) : '';
    }

    if (els.dividerPositionControl) {
      els.dividerPositionControl.style.display = mode === 'edit' ? 'none' : '';
    }

    if (els.dividerInsertAfterInput) {
      els.dividerInsertAfterInput.min = '0';
      els.dividerInsertAfterInput.max = String(visibleCount);
      els.dividerInsertAfterInput.value = mode === 'edit' ? String(visibleCount) : '';
    }

    configureDividerCharacterNotesUI(mode, id);

    if (els.dividerModalOverlay) {
      els.dividerModalOverlay.classList.add('show');
      els.dividerModalOverlay.setAttribute('aria-hidden', 'false');
    }

    document.body.classList.add('modal-open');

    setTimeout(function() {
      if (els.dividerNameInput) {
        els.dividerNameInput.focus();
        els.dividerNameInput.select();
      }
    }, 10);
  }

  function closeDividerModal() {
    syncDividerModalRefs();

    DividerModalState.mode = 'add';
    DividerModalState.itemId = null;

    if (els.dividerNotesPanel) {
      els.dividerNotesPanel.style.display = 'none';
    }

    if (els.dividerNotesList) {
      els.dividerNotesList.innerHTML = '';
    }

    resetDividerCharacterNotesUI();

    if (els.dividerModalOverlay) {
      els.dividerModalOverlay.classList.remove('show');
      els.dividerModalOverlay.setAttribute('aria-hidden', 'true');
    }

    document.body.classList.remove('modal-open');
  }

  function submitDividerModal() {
    syncDividerModalRefs();

    var title = String(els.dividerNameInput ? els.dividerNameInput.value : '').trim();
    var level = els.dividerLevelSelect && String(els.dividerLevelSelect.value) === '2' ? 2 : 1;

    if (!title) {
      showMessage('Divider name cannot be empty.', 'error');
      return;
    }

    var changedNotes = 0;

    if (DividerModalState.mode === 'edit' && DividerModalState.itemId) {
      var item = AppState.characters.find(function(entry) {
        return entry.id === DividerModalState.itemId && isDividerItem(entry);
      });

      if (!item) {
        closeDividerModal();
        return;
      }

      item.title = title;
      item.name = title;
      item.level = level;
      item.color = level === 2 ? '#a78bfa' : '#8b5cf6';
      changedNotes = applyDividerCharacterNotes();

      showMessage(
        changedNotes > 0
          ? ((level === 2 ? 'Sub-divider updated. ' : 'Divider updated. ') +
            changedNotes +
            ' character note' +
            (changedNotes === 1 ? '' : 's') +
            ' saved.')
          : (level === 2 ? 'Sub-divider updated.' : 'Divider updated.')
      );
    } else {
      var visibleCount = getVisibleCharacterCount(AppState.characters);
      var afterRank = parseInt(String(els.dividerInsertAfterInput ? els.dividerInsertAfterInput.value : visibleCount).trim(), 10);

      if (isNaN(afterRank)) afterRank = 0;
      if (afterRank < 0) afterRank = 0;
      if (afterRank > visibleCount) afterRank = visibleCount;

      var insertIndex = getInsertIndexAfterVisibleRank(afterRank);
      AppState.characters.splice(insertIndex, 0, createDividerItem(title, level));

      showMessage(
        level === 2
          ? (afterRank === 0 ? 'Sub-divider added before #1.' : 'Sub-divider added after #' + afterRank + '.')
          : (afterRank === 0 ? 'Divider added before #1.' : 'Divider added after #' + afterRank + '.')
      );
    }

    closeDividerModal();

    try {
      renumberAllItems();
      rebuildPersistentOrderMap();
      refreshChangedZone(true);
      renderBoard();
      ensureHideMissingButton();
      saveLocal(false);
    } catch (error) {
      console.error('Error after divider save:', error);
      showMessage('Divider created, but an error occurred while refreshing the board.', 'error');
    }
  }

  function addDivider() {
    openDividerModal('add');
  }

  function renameDivider(id) {
    openDividerModal('edit', id);
  }

  function deleteDivider(id) {
    var item = AppState.characters.find(function(entry) {
      return entry.id === id && isDividerItem(entry);
    });
    if (!item) return;

    var isSubDivider = getDividerLevel(item) === 2;
    var label = String(item.title || item.name || 'Divider').trim() || 'Divider';

    openDeleteConfirmModal({
      title: isSubDivider ? 'Delete sub-divider' : 'Delete divider',
      subtitle: 'This action cannot be undone.',
      help: 'You are about to delete "' + label + '". This will remove only the divider, not the characters under it.',
      confirmLabel: 'Delete',
      onConfirm: function() {
        AppState.characters = AppState.characters.filter(function(entry) {
          return entry.id !== id;
        });
        AppState.selectedMoveIds = AppState.selectedMoveIds.filter(function(entryId) {
          return entryId !== id;
        });
        renumberAllItems();
        rebuildPersistentOrderMap();
        refreshChangedZone();
        renderBoard();
        ensureHideMissingButton();
        saveLocal(false);
        showMessage((isSubDivider ? 'Sub-divider' : 'Divider') + ' deleted.');
      }
    });
  }

  /* Modal de movimiento */

  function ensureMoveDestinationUI() {
    if (!window.els || !els.moveModalOverlay) return;

    var body = els.moveModalOverlay.querySelector('.move-modal-body');
    if (!body) return;

    var row = document.getElementById('moveDestinationControl');
    if (!row) {
      row = document.createElement('div');
      row.id = 'moveDestinationControl';
      row.className = 'control';
      row.style.marginBottom = '14px';
      row.innerHTML = '' +
        '<label class="move-modal-label" for="moveDestinationSelect">Target divider / sub-divider</label>' +
        '<select id="moveDestinationSelect" class="move-modal-input">' +
        '  <option value="">Whole harem</option>' +
        '</select>';

      var rankLabel = body.querySelector('label[for="moveRankInput"]');
      if (rankLabel) body.insertBefore(row, rankLabel);
      else body.insertBefore(row, body.firstChild);
    }

    els.moveDestinationControl = row;
    els.moveDestinationSelect = document.getElementById('moveDestinationSelect');
  }

  function getDividerOptions() {
    var level1Title = '';

    return (AppState.characters || []).filter(function(item) {
      return isDividerItem(item);
    }).map(function(item) {
      var level = getDividerLevel(item);
      var title = String(item.title || item.name || 'Divider').trim() || 'Divider';

      if (level === 1) {
        level1Title = title;
        return {
          value: item.id,
          label: title
        };
      }

      return {
        value: item.id,
        label: level1Title ? (level1Title + ' / ' + title) : ('↳ ' + title)
      };
    });
  }

  function setMoveDestinationOptions(selectedValue) {
    ensureMoveDestinationUI();
    if (!els.moveDestinationSelect) return;

    var html = '<option value="">Whole harem</option>';
    getDividerOptions().forEach(function(option) {
      html += '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>';
    });

    els.moveDestinationSelect.innerHTML = html;
    els.moveDestinationSelect.value = selectedValue || '';
  }

  function moveCharacterToDividerPosition(charId, dividerId, targetPositionInput) {
    var sourceIndex = AppState.characters.findIndex(function(c) {
      return c.id === charId;
    });
    if (sourceIndex === -1) return;

    var moved = AppState.characters[sourceIndex];
    if (isDividerItem(moved)) {
      showMessage('Dividers can only be moved by global position.', 'error');
      return;
    }

    var remaining = AppState.characters.filter(function(item) {
      return item.id !== charId;
    });

    var range = getDividerContentRangeInList(remaining, dividerId);
    if (!range) {
      showMessage('The selected divider no longer exists.', 'error');
      return;
    }

    var targetPosition = parseInt(String(targetPositionInput).trim(), 10);
    if (!targetPosition || isNaN(targetPosition)) {
      showMessage('Enter a valid order number.', 'error');
      return;
    }

    var insertIndex = getInsertIndexWithinDividerByVisiblePositionInList(remaining, dividerId, targetPosition);
    if (insertIndex < 0) {
      showMessage('Unable to calculate the target divider position.', 'error');
      return;
    }

    pushPositionUndoSnapshot('move');
    remaining.splice(insertIndex, 0, moved);
    AppState.characters = remaining;

    AppState.characters.forEach(function(item, index) {
      item.currentRank = index + 1;
    });

    rebuildPersistentOrderMap();
    refreshChangedZone(true);
    addChangedZoneAroundIds([charId], 1, 1);
    renderBoard();
    closeMoveModal();
    saveLocal(false);

    var divider = AppState.characters.find(function(item) {
      return item.id === dividerId;
    });
    var dividerTitle = divider ? String(divider.title || divider.name || 'divider').trim() : 'divider';

    showMessage('Character moved to ' + dividerTitle + ' at position ' + targetPosition + '.');
  }

  function moveSelectedToDividerPosition(dividerId, targetPositionInput) {
    var ids = Array.isArray(AppState.selectedMoveIds) ? AppState.selectedMoveIds.slice() : [];
    if (!ids.length) {
      showMessage('Select one or more characters first.', 'error');
      return;
    }

    var selectedMap = {};
    ids.forEach(function(id) {
      selectedMap[id] = true;
    });

    var selectedChars = AppState.characters.filter(function(item) {
      return !!selectedMap[item.id];
    });

    if (selectedChars.some(function(item) {
      return isDividerItem(item);
    })) {
      showMessage('Dividers can only be moved by global position.', 'error');
      return;
    }

    var remaining = AppState.characters.filter(function(item) {
      return !selectedMap[item.id];
    });

    var range = getDividerContentRangeInList(remaining, dividerId);
    if (!range) {
      showMessage('The selected divider no longer exists.', 'error');
      return;
    }

    var targetPosition = parseInt(String(targetPositionInput).trim(), 10);
    if (!targetPosition || isNaN(targetPosition)) {
      showMessage('Enter a valid order number.', 'error');
      return;
    }

    var insertIndex = getInsertIndexWithinDividerByVisiblePositionInList(remaining, dividerId, targetPosition);
    if (insertIndex < 0) {
      showMessage('Unable to calculate the target divider position.', 'error');
      return;
    }

    pushPositionUndoSnapshot('multi-move');
    remaining.splice(insertIndex, 0, ...selectedChars);
    AppState.characters = remaining;

    AppState.characters.forEach(function(item, index) {
      item.currentRank = index + 1;
    });

    rebuildPersistentOrderMap();
    refreshChangedZone(true);
    addChangedZoneAroundIds(ids, 1, 1);
    renderBoard();
    closeMoveModal();
    saveLocal(false);
    clearMoveSelection(false);

    var divider = AppState.characters.find(function(item) {
      return item.id === dividerId;
    });
    var dividerTitle = divider ? String(divider.title || divider.name || 'divider').trim() : 'divider';

    showMessage(selectedChars.length + ' characters moved to ' + dividerTitle + ' at position ' + targetPosition + '.');
  }


  function rebindMoveControls() {
    if (window.__dividerMoveControlsRebound) return;
    window.__dividerMoveControlsRebound = true;

    var originalOpenMoveModal = window.openMoveModal;
    var originalOpenMoveSelectedModal = window.openMoveSelectedModal;

    window.openMoveModal = function(charId) {
      if (typeof originalOpenMoveModal === 'function') {
        originalOpenMoveModal(charId);
      }
      setMoveDestinationOptions('');
    };

    window.openMoveSelectedModal = function() {
      if (typeof originalOpenMoveSelectedModal === 'function') {
        originalOpenMoveSelectedModal();
      }
      setMoveDestinationOptions('');
    };

    window.submitMoveModal = function() {
      var dividerId = els.moveDestinationSelect ? els.moveDestinationSelect.value : '';
      var target = els.moveRankInput ? els.moveRankInput.value : '';

      if (dividerId) {
        if (MoveModalState.mode === 'multi' || MoveModalState.mode === 'multiple') {
          moveSelectedToDividerPosition(dividerId, target);
        } else if (MoveModalState.charId) {
          moveCharacterToDividerPosition(MoveModalState.charId, dividerId, target);
        }
        return;
      }

      if (MoveModalState.mode === 'multi' || MoveModalState.mode === 'multiple') {
        if (typeof window.moveSelectedToRank === 'function') window.moveSelectedToRank(target);
        return;
      }

      if (MoveModalState.charId && typeof window.moveCharacterToRank === 'function') {
        window.moveCharacterToRank(MoveModalState.charId, target);
      }
    };
  }

  function initMoveDestinationPatch() {
    if (!window.els || !window.MoveModalState) return;
    ensureMoveDestinationUI();
    rebindMoveControls();
    bindSaveFileModalControls();
  }

  /* Exportacion SMP */

  function getCharactersUnderDivider(dividerId) {
    if (!window.AppState || !window.getDividerContentRangeInList || !Array.isArray(AppState.characters)) return [];

    var range = getDividerContentRangeInList(AppState.characters, dividerId);
    if (!range) return [];

    return AppState.characters.slice(range.start, range.end).filter(function(item) {
      return !isDividerItem(item) && !shouldExcludeMissingFromOutputs(item);
    });
  }

  function getVisibleCharactersUnderDivider(dividerId, buttonEl) {
    if (!window.els || !els.board || !window.AppState || !Array.isArray(AppState.characters)) return [];

    var divider = findDividerById(dividerId);
    if (!divider) return [];

    var dividerLevel = getDividerLevel(divider);
    var dividerCard = buttonEl && buttonEl.closest ? buttonEl.closest('.divider-card') : null;

    if (!dividerCard) {
      dividerCard = els.board.querySelector('.divider-card[data-id="' + String(dividerId).replace(/"/g, '\\\\"') + '"]');
    }
    if (!dividerCard) return [];

    var ids = [];
    var node = dividerCard.nextElementSibling;

    while (node) {
      if (node.classList && node.classList.contains('divider-card')) {
        var nextId = node.getAttribute('data-id');
        var nextDivider = findDividerById(nextId);
        var nextLevel = nextDivider ? getDividerLevel(nextDivider) : 1;
        if (nextLevel <= dividerLevel) break;
        node = node.nextElementSibling;
        continue;
      }

      if (node.classList && node.classList.contains('character-card')) {
        var charId = node.getAttribute('data-id');
        if (charId) ids.push(charId);
      }

      node = node.nextElementSibling;
    }

    if (!ids.length) return [];

    var map = {};
    AppState.characters.forEach(function(item) {
      if (item && !isDividerItem(item)) map[item.id] = item;
    });

    return ids.map(function(id) {
      return map[id];
    }).filter(function(item) {
      return !!item && !shouldExcludeMissingFromOutputs(item);
    });
  }

  function buildDividerSmpChunks(dividerId) {
    if (!window.buildChunksFromCharacters) return [];
    var chars = getCharactersUnderDivider(dividerId);
    if (!chars.length) return [];
    return buildChunksFromCharacters(chars, '$smp ');
  }

  function copyDividerSmp(dividerId) {
    if (!window.AppState) return;

    var divider = (AppState.characters || []).find(function(item) {
      return item && item.id === dividerId && isDividerItem(item);
    });

    if (!divider) {
      if (window.showMessage) showMessage('No se encontró el divisor.', 'error');
      return;
    }

    var chunks = buildDividerSmpChunks(dividerId);
    if (!chunks.length) {
      if (window.showMessage) showMessage('No hay personajes dentro de este divisor.', 'error');
      return;
    }

    var text = chunks.map(function(chunk) {
      return chunk.text;
    }).join('\n');

    copyTextToClipboard(text).then(function() {
      var title = String(divider.title || divider.name || 'Divider').trim() || 'Divider';
      if (window.showMessage) showMessage('Divider "' + title + '" was copied');
    }).catch(function() {
      if (window.showMessage) showMessage('Failed to copy the divider.', 'error');
    });
  }

  /* Bloques y secciones */

  function getDividerMoveBlockRange(dividerId) {
    if (!window.AppState || !Array.isArray(AppState.characters) || !window.isDividerItem || !window.getDividerLevel) {
      return null;
    }

    var list = AppState.characters;
    var dividerIndex = list.findIndex(function(item) {
      return item && item.id === dividerId && isDividerItem(item);
    });
    if (dividerIndex === -1) return null;

    var divider = list[dividerIndex];
    var level = getDividerLevel(divider);
    var end = list.length;

    for (var i = dividerIndex + 1; i < list.length; i++) {
      var item = list[i];
      if (!isDividerItem(item)) continue;

      var nextLevel = getDividerLevel(item);
      if (level === 1) {
        if (nextLevel === 1) {
          end = i;
          break;
        }
      } else {
        if (nextLevel <= 2) {
          end = i;
          break;
        }
      }
    }

    var block = list.slice(dividerIndex, end);

    return {
      dividerIndex: dividerIndex,
      start: dividerIndex,
      end: end,
      level: level,
      block: block,
      characterCount: countRealCharacters(block)
    };
  }

  function getSectionAwareInsertIndex(list, targetId, placeAfter) {
    var targetIndex = list.findIndex(function(item) {
      return item && item.id === targetId;
    });
    if (targetIndex === -1) return -1;
    if (!placeAfter) return targetIndex;

    var targetItem = list[targetIndex];
    if (!(window.isDividerItem && isDividerItem(targetItem) && window.getDividerLevel)) {
      return targetIndex + 1;
    }

    var level = getDividerLevel(targetItem);
    var insertIndex = list.length;

    for (var i = targetIndex + 1; i < list.length; i++) {
      var item = list[i];
      if (!(window.isDividerItem && isDividerItem(item))) continue;

      var nextLevel = getDividerLevel(item);
      if (level === 1) {
        if (nextLevel === 1) {
          insertIndex = i;
          break;
        }
      } else {
        if (nextLevel <= 2) {
          insertIndex = i;
          break;
        }
      }
    }

    return insertIndex;
  }

  function moveDividerBlockToVisibleRank(dividerId, afterRank) {
    if (!window.AppState || !Array.isArray(AppState.characters)) return false;

    var range = getDividerMoveBlockRange(dividerId);
    if (!range) return false;

    var list = AppState.characters.slice();
    var block = list.slice(range.start, range.end);
    var remaining = list.slice(0, range.start).concat(list.slice(range.end));
    var maxAfter = countRealCharacters(remaining);

    var target = parseInt(String(afterRank || 0).trim(), 10);
    if (isNaN(target) || target < 0) target = 0;
    if (target > maxAfter) target = maxAfter;

    var insertIndex = typeof getInsertIndexAfterVisibleRankInList === 'function'
      ? getInsertIndexAfterVisibleRankInList(remaining, target)
      : remaining.length;

    if (typeof pushPositionUndoSnapshot === 'function') {
      pushPositionUndoSnapshot('move-divider-block');
    }

    remaining.splice(insertIndex, 0, ...block);
    AppState.characters = remaining;

    AppState.characters.forEach(function(char, index) {
      char.currentRank = index + 1;
    });

    if (typeof rebuildPersistentOrderMap === 'function') rebuildPersistentOrderMap();
    if (typeof refreshChangedZone === 'function') refreshChangedZone();
    if (typeof renderBoard === 'function') renderBoard();
    if (typeof closeMoveModal === 'function') closeMoveModal();
    if (typeof saveLocal === 'function') saveLocal(false);
    if (typeof showMessage === 'function') {
      showMessage('Moved divider with ' + range.characterCount + ' character' + (range.characterCount === 1 ? '' : 's') + '.');
    }

    return true;
  }

  function bindDividerBlockToggle() {
    var board = document.getElementById('board');
    if (!board || board.__rebaseV30toggleBound) return;

    board.__rebaseV30toggleBound = true;
    board.addEventListener('click', function(event) {
      var btn = event.target && event.target.closest ? event.target.closest('[data-divider-block-toggle]') : null;
      if (!btn) return;

      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();

      var id = btn.getAttribute('data-divider-block-toggle');
      var item = getItemById(id);
      if (!item || !isDividerItem(item)) return;

      item.moveWithChildren = !item.moveWithChildren;

      if (typeof renderBoard === 'function') renderBoard();
      if (typeof saveLocal === 'function') saveLocal(false);
      if (typeof showMessage === 'function') {
        showMessage(item.moveWithChildren ? 'Section move enabled.' : 'Section move disabled.');
      }
    }, true);
  }

  function openSortSectionModal(dividerId) {
    syncSortSectionModalRefs();

    var divider = AppState.characters.find(function(item) {
      return item.id === dividerId && isDividerItem(item);
    });
    if (!divider) return;

    SortSectionModalState.dividerId = dividerId;

    if (els.sortSectionModalTitle) els.sortSectionModalTitle.textContent = 'Sort section';
    if (els.sortSectionModalSubtitle) {
      els.sortSectionModalSubtitle.textContent = 'Sort characters under "' + (divider.title || divider.name || 'Divider') + '".';
    }
    if (els.sortSectionFieldSelect) els.sortSectionFieldSelect.value = 'name';
    if (els.sortSectionDirectionSelect) els.sortSectionDirectionSelect.value = 'asc';
    if (els.sortSectionFieldSelect2) els.sortSectionFieldSelect2.value = '';
    if (els.sortSectionDirectionSelect2) els.sortSectionDirectionSelect2.value = 'asc';

    if (els.sortSectionModalOverlay) {
      els.sortSectionModalOverlay.classList.add('show');
      els.sortSectionModalOverlay.setAttribute('aria-hidden', 'false');
    }

    document.body.classList.add('modal-open');

    setTimeout(function() {
      if (els.sortSectionFieldSelect) els.sortSectionFieldSelect.focus();
    }, 10);
  }

  function closeSortSectionModal() {
    syncSortSectionModalRefs();
    SortSectionModalState.dividerId = null;

    if (els.sortSectionModalOverlay) {
      els.sortSectionModalOverlay.classList.remove('show');
      els.sortSectionModalOverlay.setAttribute('aria-hidden', 'true');
    }

    document.body.classList.remove('modal-open');
  }

  function submitSortSectionModal() {
    syncSortSectionModalRefs();

    if (!SortSectionModalState.dividerId) {
      closeSortSectionModal();
      return;
    }

    var criteria = [];
    var field = String((els.sortSectionFieldSelect && els.sortSectionFieldSelect.value) || 'name');
    var direction = String((els.sortSectionDirectionSelect && els.sortSectionDirectionSelect.value) || 'asc');

    criteria.push({
      field: field,
      direction: direction
    });

    var field2 = String((els.sortSectionFieldSelect2 && els.sortSectionFieldSelect2.value) || '').trim();
    var direction2 = String((els.sortSectionDirectionSelect2 && els.sortSectionDirectionSelect2.value) || 'asc');

    if (field2 && field2 !== field) {
      criteria.push({
        field: field2,
        direction: direction2
      });
    }

    var dividerId = SortSectionModalState.dividerId;
    closeSortSectionModal();
    sortDividerSection(dividerId, criteria);
  }

  function initRebasedDividerSectionPatchV30() {
  if (typeof patchMoveCharacterToRank === 'function') patchMoveCharacterToRank();
  if (typeof patchAttachDragEvents === 'function') patchAttachDragEvents();
  if (typeof patchUpdateMultiSelectUI === 'function') patchUpdateMultiSelectUI();
  if (typeof bindDividerBlockToggle === 'function') bindDividerBlockToggle();
  if (typeof updateMultiSelectUI === 'function') updateMultiSelectUI();
  if (typeof renderBoard === 'function') {
    try {
      renderBoard();
    } catch (e) {}
  }
}

/* Compatibilidad */

  function syncHelpSectionState() {
    AppState.helpHidden = false;
    if (els.leftToolsSection) els.leftToolsSection.classList.remove('help-is-collapsed');
    if (els.helpSection) els.helpSection.classList.remove('is-collapsed');
    if (els.helpContent) {
      els.helpContent.classList.remove('is-hidden');
      els.helpContent.style.display = '';
    }
    if (els.helpToggleBtn) els.helpToggleBtn.setAttribute('aria-expanded', 'true');
    if (els.helpToggleIndicator) els.helpToggleIndicator.textContent = '';
    syncLeftPanelState();
  }

  function toggleHelpSection() {
    AppState.helpHidden = false;
    syncHelpSectionState();
    return false;
  }

  /* Editor de notas por divider */

  function ensureDividerCharacterNotesUI() {
    syncDividerModalRefs();
    if (!els.dividerModalOverlay) return null;

    var modal = els.dividerModalOverlay.querySelector('.divider-modal');
    if (!modal) return null;

    var actions = modal.querySelector('.divider-modal-actions');
    if (!actions || !actions.parentNode) return null;

    var wrap = document.getElementById('dividerCharacterNotesControl');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'dividerCharacterNotesControl';
      wrap.className = 'control';
      wrap.style.marginTop = '14px';
      actions.parentNode.insertBefore(wrap, actions);
    }

    wrap.innerHTML = '' +
      '<label>Bulk note</label>' +
      '<div id="dividerCharacterNotesList" style="display:grid;gap:8px;max-height:220px;overflow:auto;padding-right:4px"></div>';

    els.dividerCharacterNotesControl = wrap;
    els.dividerCharacterNotesList = document.getElementById('dividerCharacterNotesList');

    return wrap;
  }

  function getCharactersInsideDivider(dividerId) {
    if (!window.AppState || !Array.isArray(AppState.characters) || typeof getDividerContentRangeInList !== 'function') {
      return [];
    }

    var range = getDividerContentRangeInList(AppState.characters, dividerId);
    if (!range) return [];

    return AppState.characters.slice(range.start, range.end).filter(function(item) {
      return item && !isDividerItem(item);
    });
  }

  function resetDividerCharacterNotesUI() {
    ensureDividerCharacterNotesUI();
    if (els.dividerCharacterNotesControl) els.dividerCharacterNotesControl.style.display = 'none';
    if (els.dividerCharacterNotesList) els.dividerCharacterNotesList.innerHTML = '';
  }

  function configureDividerCharacterNotesUI(mode, dividerId) {
    ensureDividerCharacterNotesUI();
    if (!els.dividerCharacterNotesControl || !els.dividerCharacterNotesList) return;

    var isEdit = mode === 'edit' && !!dividerId;
    els.dividerCharacterNotesControl.style.display = isEdit ? 'block' : 'none';

    if (!isEdit) {
      els.dividerCharacterNotesList.innerHTML = '';
      return;
    }

    var chars = getCharactersInsideDivider(dividerId);
    if (!chars.length) {
      els.dividerCharacterNotesList.innerHTML = '<div class="small-note">There are no characters inside this divider.</div>';
      return;
    }

    els.dividerCharacterNotesList.innerHTML = chars.map(function(char) {
      var note = String(char && char.note != null ? char.note : '');
      return '' +
        '<div class="chunk-card">' +
          '<div class="chunk-header"><span>' + escapeHtml(String(char.name || 'Character')) + '</span></div>' +
          '<textarea class="move-modal-input" data-divider-note-id="' + escapeHtml(String(char.id)) + '" rows="3" style="min-height:88px;resize:vertical;font-weight:600">' + escapeHtml(note) + '</textarea>' +
        '</div>';
    }).join('');
  }

  function applyDividerCharacterNotes() {
    ensureDividerCharacterNotesUI();

    if (!DividerModalState || DividerModalState.mode !== 'edit' || !DividerModalState.itemId || !els.dividerCharacterNotesList) {
      return 0;
    }

    var changed = 0;

    Array.prototype.slice.call(
      els.dividerCharacterNotesList.querySelectorAll('[data-divider-note-id]')
    ).forEach(function(field) {
      var charId = field.getAttribute('data-divider-note-id');
      var char = AppState && Array.isArray(AppState.characters)
        ? AppState.characters.find(function(item) {
            return item && item.id === charId && !isDividerItem(item);
          })
        : null;

      if (!char) return;

      var nextValue = String(field.value == null ? '' : field.value).trim();
      var prevValue = String(char.note == null ? '' : char.note).trim();

      if (nextValue === prevValue) return;

      char.note = nextValue;
      changed += 1;
    });

    return changed;
  }

  /* Compatibilidad con nombres anteriores */

  function ensureDividerNotesUI() {
    return ensureDividerCharacterNotesUI();
  }

  function getEditableCharactersUnderDivider(dividerId) {
    return getCharactersInsideDivider(dividerId);
  }

  function renderDividerNotesEditor(dividerId) {
    configureDividerCharacterNotesUI(dividerId ? 'edit' : 'add', dividerId || null);
    return els.dividerCharacterNotesControl || null;
  }

  /* Exports */

  window.syncDividerModalRefs = syncDividerModalRefs;
  window.syncSortSectionModalRefs = syncSortSectionModalRefs;
  window.isDividerItem = isDividerItem;
  window.getDividerLevel = getDividerLevel;
  window.isDividerCollapsed = isDividerCollapsed;
  window.getDividerSectionRange = getDividerSectionRange;
  window.getSectionRankValue = getSectionRankValue;
  window.getSectionSortValue = getSectionSortValue;
  window.compareSectionValues = compareSectionValues;
  window.compareSectionItems = compareSectionItems;
  window.sortSectionBySeriesTopRank = sortSectionBySeriesTopRank;
  window.sortDividerSection = sortDividerSection;
  window.openSortSectionModal = openSortSectionModal;
  window.closeSortSectionModal = closeSortSectionModal;
  window.submitSortSectionModal = submitSortSectionModal;
  window.createDividerItem = createDividerItem;
  window.ensureDividerNotesUI = ensureDividerNotesUI;
  window.getEditableCharactersUnderDivider = getEditableCharactersUnderDivider;
  window.renderDividerNotesEditor = renderDividerNotesEditor;
  window.applyDividerCharacterNotes = applyDividerCharacterNotes;
  window.syncHelpSectionState = syncHelpSectionState;
  window.toggleHelpSection = toggleHelpSection;
  window.createDividerCardHTML = createDividerCardHTML;
  window.toggleDividerCollapse = toggleDividerCollapse;
  window.openDividerModal = openDividerModal;
  window.closeDividerModal = closeDividerModal;
  window.submitDividerModal = submitDividerModal;
  window.addDivider = addDivider;
  window.renameDivider = renameDivider;
  window.deleteDivider = deleteDivider;
  window.ensureMoveDestinationUI = ensureMoveDestinationUI;
  window.getDividerContentRangeInList = getDividerContentRangeInList;
  window.getDividerCharacterCountInList = getDividerCharacterCountInList;
  window.getInsertIndexWithinDividerByVisiblePositionInList = getInsertIndexWithinDividerByVisiblePositionInList;
  window.getDividerOptions = getDividerOptions;
  window.setMoveDestinationOptions = setMoveDestinationOptions;
  window.moveCharacterToDividerPosition = moveCharacterToDividerPosition;
  window.moveSelectedToDividerPosition = moveSelectedToDividerPosition;
  window.initMoveDestinationPatch = initMoveDestinationPatch;
  window.getCharactersUnderDivider = getCharactersUnderDivider;
  window.buildDividerSmpChunks = buildDividerSmpChunks;
  window.copyDividerSmp = copyDividerSmp;
  window.findDividerById = findDividerById;
  window.getVisibleCharactersUnderDivider = getVisibleCharactersUnderDivider;
  window.getDividerMoveBlockRange = getDividerMoveBlockRange;
  window.getSectionAwareInsertIndex = getSectionAwareInsertIndex;
  window.moveDividerBlockToVisibleRank = moveDividerBlockToVisibleRank;
  window.bindDividerBlockToggle = bindDividerBlockToggle;
  window.initRebasedDividerSectionPatchV30 = initRebasedDividerSectionPatchV30;
  window.isDivider = isDivider;
  window.sectionRanges = sectionRanges;
  window.getSectionRangeById = getSectionRangeById;
  window.isDividerSafe = isDividerSafe;

  if (typeof window.initMoveDestinationPatch === 'function') {
    window.initMoveDestinationPatch();
  }

  if (typeof window.initRebasedDividerSectionPatchV30 === 'function') {
    window.initRebasedDividerSectionPatchV30();
  }
})();


/* ============================================================
   SOURCE: app.js (merged after dividers.js to preserve load order)
   ============================================================ */

/* inline-script-1 */
var STORAGE_KEY='mudaeHaremOrdererProCompatV1';var AppState={haremName:'',totalValue:0,counts:{wa:0,ha:0,wg:0,hg:0},characters:[],filter:'',ownerFilter:'',rouletteFilter:'',selectedSeries:[],seriesPanelHidden:false,helpHidden:false,multiSelectMode:false,selectedMoveIds:[],exportAliasesText:'tundra3=tundra_3',persistentOrderMap:{},orderBaselineIds:[],changedVisibleRange:null,changedZones:[],useLocalChangedZones:false,positionUndoStack:[],undoStackLimit:100,syncModeType:'normal',hideMissingCards:false};var MoveModalState={charId:null,mode:'single'};var DividerModalState={mode:'add',itemId:null};var SortSectionModalState={dividerId:null};var EditCharState={active:false,charId:null};var SyncReplaceModalState={resolver:null,oldChar:null,candidates:[],selectedIndex:-1,filter:'',canGoBack:false,progressText:''};var SelectionBoxState={active:false,started:false,additive:false,startX:0,startY:0,originTarget:null,boxEl:null,suppressClickUntil:0};var DragState={suppressClickUntil:0};var els={input:document.getElementById('input'),parseBtn:document.getElementById('parseBtn'),demoBtn:document.getElementById('demoBtn'),clearBtn:document.getElementById('clearBtn'),addDividerBtn:document.getElementById('addDividerBtn'),exportAliasToggle:document.getElementById('exportAliasToggle'),exportAliasPanel:document.getElementById('exportAliasPanel'),exportAliasInput:document.getElementById('exportAliasInput'),multiSelectToggleBtn:document.getElementById('multiSelectToggleBtn'),moveSelectedBtn:document.getElementById('moveSelectedBtn'),clearSelectedBtn:document.getElementById('clearSelectedBtn'),saveBtn:document.getElementById('saveBtn'),loadBtn:document.getElementById('loadBtn'),loadJsonInput:document.getElementById('loadJsonInput'),nitroMode:document.getElementById('nitroMode'),searchInput:document.getElementById('searchInput'),ownerFilter:document.getElementById('ownerFilter'),rouletteFilter:document.getElementById('rouletteFilter'),jumpPageTopBtn:document.getElementById('jumpPageTopBtn'),syncModeCheckbox:document.getElementById('syncModeCheckbox'),helpContent:document.getElementById('helpContent'),helpSection:document.getElementById('helpSection'),helpToggleBtn:document.getElementById('helpToggleBtn'),helpToggleIndicator:document.getElementById('helpToggleIndicator'),leftToolsSection:document.getElementById('leftToolsSection'),layout:document.querySelector('.layout'),board:document.getElementById('board'),message:document.getElementById('message'),orderOutput:document.getElementById('orderOutput'),moveModalOverlay:document.getElementById('moveModalOverlay'),moveModalTitle:document.getElementById('moveModalTitle'),moveModalSubtitle:document.getElementById('moveModalSubtitle'),moveModalHelp:document.getElementById('moveModalHelp'),moveRankInput:document.getElementById('moveRankInput'),moveCancelBtn:document.getElementById('moveCancelBtn'),moveConfirmBtn:document.getElementById('moveConfirmBtn'),dividerModalOverlay:document.getElementById('dividerModalOverlay'),dividerModalTitle:document.getElementById('dividerModalTitle'),dividerModalSubtitle:document.getElementById('dividerModalSubtitle'),dividerNameInput:document.getElementById('dividerNameInput'),dividerPositionControl:document.getElementById('dividerPositionControl'),dividerInsertAfterInput:document.getElementById('dividerInsertAfterInput'),dividerModalCancelBtn:document.getElementById('dividerModalCancelBtn'),dividerModalConfirmBtn:document.getElementById('dividerModalConfirmBtn'),sortSectionModalOverlay:document.getElementById('sortSectionModalOverlay'),sortSectionModalTitle:document.getElementById('sortSectionModalTitle'),sortSectionModalSubtitle:document.getElementById('sortSectionModalSubtitle'),sortSectionFieldSelect:document.getElementById('sortSectionFieldSelect'),sortSectionDirectionSelect:document.getElementById('sortSectionDirectionSelect'),sortSectionFieldSelect2:document.getElementById('sortSectionFieldSelect2'),sortSectionDirectionSelect2:document.getElementById('sortSectionDirectionSelect2'),sortSectionCancelBtn:document.getElementById('sortSectionCancelBtn'),sortSectionConfirmBtn:document.getElementById('sortSectionConfirmBtn'),themeToggleBtn:document.getElementById('themeToggleBtn'),floatingSearchInput:document.getElementById('floatingSearchInput'),editCharBtn:document.getElementById('editCharBtn'),editCharModalOverlay:document.getElementById('editCharModalOverlay'),editCharNameInput:document.getElementById('editCharNameInput'),editCharSeriesInput:document.getElementById('editCharSeriesInput'),editCharImageInput:document.getElementById('editCharImageInput'),editCharKakeraInput:document.getElementById('editCharKakeraInput'),editCharKeysInput:document.getElementById('editCharKeysInput'),editCharOwnerInput:document.getElementById('editCharOwnerInput'),editCharNoteInput:document.getElementById('editCharNoteInput'),editCharRouletteInput:document.getElementById('editCharRouletteInput'),editCharColorInput:document.getElementById('editCharColorInput'),editCharGlobalRankInput:document.getElementById('editCharGlobalRankInput'),editCharImagePreview:document.getElementById('editCharImagePreview'),editCharPreviewEmpty:document.getElementById('editCharPreviewEmpty'),syncReplaceModalOverlay:document.getElementById('syncReplaceModalOverlay'),syncReplaceModalTitle:document.getElementById('syncReplaceModalTitle'),syncReplaceModalSubtitle:document.getElementById('syncReplaceModalSubtitle'),syncReplaceSearchInput:document.getElementById('syncReplaceSearchInput'),syncReplaceResults:document.getElementById('syncReplaceResults'),syncReplaceOldName:document.getElementById('syncReplaceOldName'),syncReplaceOldSeries:document.getElementById('syncReplaceOldSeries'),syncReplaceOldImage:document.getElementById('syncReplaceOldImage'),syncReplaceOldEmpty:document.getElementById('syncReplaceOldEmpty'),syncReplaceNewName:document.getElementById('syncReplaceNewName'),syncReplaceNewSeries:document.getElementById('syncReplaceNewSeries'),syncReplaceNewImage:document.getElementById('syncReplaceNewImage'),syncReplaceNewEmpty:document.getElementById('syncReplaceNewEmpty'),syncReplaceKeepImage:document.getElementById('syncReplaceKeepImage'),syncReplaceUseNewImage:document.getElementById('syncReplaceUseNewImage'),syncReplaceBackBtn:document.getElementById('syncReplaceBackBtn'),syncReplaceSkipSeriesBtn:document.getElementById('syncReplaceSkipSeriesBtn'),syncReplaceCancelBtn:document.getElementById('syncReplaceCancelBtn'),syncReplaceConfirmBtn:document.getElementById('syncReplaceConfirmBtn'),editCharCancelBtn:document.getElementById('editCharCancelBtn'),editCharConfirmBtn:document.getElementById('editCharConfirmBtn'),totalCount:document.getElementById('totalCount'),visibleCount:document.getElementById('visibleCount'),totalKakera:document.getElementById('totalKakera'),totalKeys:document.getElementById('totalKeys'),totalSpheres:document.getElementById('totalSpheres'),haremName:document.getElementById('haremName'),haremValue:document.getElementById('haremValue'),wahaCount:document.getElementById('wahaCount'),wghgCount:document.getElementById('wghgCount'),seriesSummary:document.getElementById('seriesSummary'),saveFileModalOverlay:document.getElementById('saveFileModalOverlay'),saveFileNameInput:document.getElementById('saveFileNameInput'),saveFileCancelBtn:document.getElementById('saveFileCancelBtn'),saveFileConfirmBtn:document.getElementById('saveFileConfirmBtn')};

/* sync-toolbar moved to sync-toolbar.js */

function showMessage(text,type){type=type||'success';if(!els||!els.message)return;clearTimeout(showMessage._timer);els.message.className='message';els.message.textContent='';void els.message.offsetWidth;els.message.textContent=String(text==null?'':text);els.message.className='message show '+type;showMessage._timer=setTimeout(function(){if(!els||!els.message)return;els.message.className='message';els.message.textContent='';},1700);}

/* parser moved to parser.js */

/* updateOrderOutput moved to export.js */

/* stats moved to stats.js */

/* cards moved to cards.js */

/* base divider CRUD moved to external dividers.js */

/* move-selection moved to move-selection.js */

function syncSeriesTooltipData(root) {
  var scope = root || document;
  Array.prototype.forEach.call(
    scope.querySelectorAll('.series-pill, .series-line-name'),
    function (el) {
      var full = String(el.getAttribute('data-full-name') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!full) {
        el.removeAttribute('data-full-name');
        return;
      }
      el.setAttribute('data-full-name', full);
      el.removeAttribute('title');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    }
  );
}

function ensureSeriesHoverTooltip() {
  var tip = document.getElementById('seriesHoverTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'seriesHoverTooltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
  }
  var style = document.getElementById('seriesHoverTooltipStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'seriesHoverTooltipStyle';
    style.textContent = [
      '#seriesHoverTooltip{position:fixed;left:0;top:0;max-width:min(320px,calc(100vw - 24px));min-width:220px;padding:9px 11px;border-radius:10px;background:rgba(18,18,28,.98);border:1px solid rgba(167,139,250,.22);box-shadow:0 14px 26px rgba(0,0,0,.28);color:#d4d4d8;font-size:.82rem;font-weight:600;line-height:1.35;text-align:center;white-space:normal;pointer-events:none;opacity:0;visibility:hidden;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease,visibility .12s ease;z-index:20000;}',
      '#seriesHoverTooltip.is-visible{opacity:1;visibility:visible;transform:translateY(0);}',
      'body[data-theme="light"] #seriesHoverTooltip{background:#ffffff;border-color:rgba(124,58,237,.18);box-shadow:0 10px 24px rgba(15,23,42,.12);color:#475569;}'
    ].join('');
    document.head.appendChild(style);
  }
  return tip;
}

function positionSeriesHoverTooltip(target) {
  var tip = ensureSeriesHoverTooltip();
  if (!target || !tip.classList.contains('is-visible')) return;
  var rect = target.getBoundingClientRect();
  var tipRect = tip.getBoundingClientRect();
  var gap = 10;
  var left = rect.left + (rect.width / 2) - (tipRect.width / 2);
  var maxLeft = window.innerWidth - tipRect.width - 12;
  if (left < 12) left = 12;
  if (left > maxLeft) left = Math.max(12, maxLeft);
  var top = rect.bottom + gap;
  if (top + tipRect.height > window.innerHeight - 12) {
    top = rect.top - tipRect.height - gap;
  }
  if (top < 12) top = 12;
  tip.style.left = Math.round(left) + 'px';
  tip.style.top = Math.round(top) + 'px';
}

function showSeriesHoverTooltip(target) {
  if (!target) return;
  var text = String(target.getAttribute('data-full-name') || target.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return;
  var tip = ensureSeriesHoverTooltip();
  tip.textContent = text;
  tip.dataset.anchorId = target.getAttribute('data-id') || '';
  tip._anchor = target;
  tip.setAttribute('aria-hidden', 'false');
  tip.classList.add('is-visible');
  positionSeriesHoverTooltip(target);
}

function hideSeriesHoverTooltip() {
  var tip = document.getElementById('seriesHoverTooltip');
  if (!tip) return;
  tip.classList.remove('is-visible');
  tip.setAttribute('aria-hidden', 'true');
  tip._anchor = null;
}

function initSeriesHoverTooltip() {
  if (document.body.dataset.seriesHoverTooltipBound === '1') return;
  document.body.dataset.seriesHoverTooltipBound = '1';
  ensureSeriesHoverTooltip();

  document.addEventListener('mouseover', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('.series-pill, .series-line-name') : null;
    if (!target) return;
    var related = event.relatedTarget;
    if (related && target.contains && target.contains(related)) return;
    showSeriesHoverTooltip(target);
  });

  document.addEventListener('mouseout', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('.series-pill, .series-line-name') : null;
    if (!target) return;
    var related = event.relatedTarget;
    if (related && target.contains && target.contains(related)) return;
    hideSeriesHoverTooltip();
  });

  document.addEventListener('focusin', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('.series-pill, .series-line-name') : null;
    if (!target) return;
    showSeriesHoverTooltip(target);
  });

  document.addEventListener('focusout', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('.series-pill, .series-line-name') : null;
    if (!target) return;
    hideSeriesHoverTooltip();
  });

  window.addEventListener('scroll', function () {
    var tip = document.getElementById('seriesHoverTooltip');
    if (!tip || !tip._anchor || !tip.classList.contains('is-visible')) return;
    positionSeriesHoverTooltip(tip._anchor);
  }, true);

  window.addEventListener('resize', function () {
    var tip = document.getElementById('seriesHoverTooltip');
    if (!tip || !tip._anchor || !tip.classList.contains('is-visible')) return;
    positionSeriesHoverTooltip(tip._anchor);
  });
}


function ensureBoardDelegatedHandlers(){
  if(!els || !els.board || els.board.dataset.boardDelegatedClick === '1') return;
  els.board.dataset.boardDelegatedClick = '1';
  els.board.addEventListener('click', function(event){
    var target = event.target;
    if(!target || !target.closest) return;

    var moveBtn = target.closest('[data-move-id]');
    if(moveBtn && els.board.contains(moveBtn)){
      event.preventDefault();
      event.stopPropagation();
      if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      openMoveModal(moveBtn.getAttribute('data-move-id'));
      return false;
    }

    var dividerToggle = target.closest('[data-divider-toggle]');
    if(dividerToggle && els.board.contains(dividerToggle)){
      event.preventDefault();
      event.stopPropagation();
      toggleDividerCollapse(dividerToggle.getAttribute('data-divider-toggle'), !!event.shiftKey);
      return false;
    }

    var dividerSort = target.closest('[data-divider-sort]');
    if(dividerSort && els.board.contains(dividerSort)){
      event.preventDefault();
      event.stopPropagation();
      openSortSectionModal(dividerSort.getAttribute('data-divider-sort'));
      return false;
    }

    var dividerEdit = target.closest('[data-divider-edit]');
    if(dividerEdit && els.board.contains(dividerEdit)){
      event.preventDefault();
      event.stopPropagation();
      renameDivider(dividerEdit.getAttribute('data-divider-edit'));
      return false;
    }

    var dividerDelete = target.closest('[data-divider-delete]');
    if(dividerDelete && els.board.contains(dividerDelete)){
      event.preventDefault();
      event.stopPropagation();
      deleteDivider(dividerDelete.getAttribute('data-divider-delete'));
      return false;
    }

    var card = target.closest('.character-card');
    if(!card || !els.board.contains(card)) return;

    if(EditCharState.active){
      if(Date.now() < DragState.suppressClickUntil) return;
      var editId = card.getAttribute('data-id');
      var editItem = AppState.characters.find(function(c){ return c.id === editId; });
      if(editItem && isDividerItem(editItem)){
        showMessage('Usa el botón Edit en el divider para renombrarlo.', 'error');
        return;
      }
      document.querySelectorAll('.character-card.edit-selected').forEach(function(node){ node.classList.remove('edit-selected'); });
      card.classList.add('edit-selected');
      openEditCharModal(editId);
      return;
    }

    if(!AppState.multiSelectMode) return;
    if(Date.now() < SelectionBoxState.suppressClickUntil) return;
    if(Date.now() < DragState.suppressClickUntil) return;
    toggleCharacterSelection(card.getAttribute('data-id'));
  }, true);
}

function renderBoard(){var filtered=getFilteredCharacters();els.board.classList.toggle('is-multi-select',!!AppState.multiSelectMode);updateMultiSelectUI();if(!AppState.characters.length){els.board.innerHTML='';updateStats();
  syncSeriesTooltipData(document);
  initSeriesHoverTooltip();return;}
if(!filtered.length){els.board.innerHTML='<div class="empty-board">No items match the current filters.</div>';updateMultiSelectUI();updateStats();
  syncSeriesTooltipData(document);
  initSeriesHoverTooltip();return;}
els.board.style.display='none';

els.board.innerHTML=filtered.map(function(item){
  return isDividerItem(item)?createDividerCardHTML(item):createCharacterCardHTML(item);
}).join('');

els.board.style.display='';ensureBoardDelegatedHandlers();attachDragEvents();updateMultiSelectUI();updateStats();
  syncSeriesTooltipData(document);
  initSeriesHoverTooltip();}

/* dialogs moved to dialogs.js */

/* parse-flow moved to parse-flow.js */

/* save modal moved to actions.js */

/* storage moved to storage.js */

els.parseBtn.addEventListener('click',parseInput);els.demoBtn.addEventListener('click',function(){fetch('demo.json').then(function(response){if(!response.ok)throw new Error('demo-not-found');return response.json();}).then(function(parsed){loadJsonFromParsed(parsed,true);}).catch(function(error){console.error(error);showMessage('The demo JSON could not be loaded.','error');});});els.clearBtn.addEventListener('click',clearAll);if(els.addDividerBtn)els.addDividerBtn.addEventListener('click',addDivider);if(els.exportJsonBtn)els.exportJsonBtn.addEventListener('click',exportJson);if(els.copyOrderBtn)els.copyOrderBtn.addEventListener('click',copyOrder);if(els.multiSelectToggleBtn)els.multiSelectToggleBtn.addEventListener('click',toggleMultiSelectMode);if(els.moveSelectedBtn)els.moveSelectedBtn.addEventListener('click',openMoveSelectedModal);if(els.clearSelectedBtn)els.clearSelectedBtn.addEventListener('click',function(){if(AppState.multiSelectMode)deleteSelectedCharacters();else{clearMoveSelection();saveLocal(false);}});els.saveBtn.addEventListener('click',exportJson);els.nitroMode.addEventListener('change',updateOrderOutput);if(els.exportAliasInput){els.exportAliasInput.value=AppState.exportAliasesText||'tundra3=tundra_3';els.exportAliasInput.addEventListener('input',function(event){AppState.exportAliasesText=event.target.value;updateOrderOutput();saveLocal(false);});}
if(els.exportAliasToggle){els.exportAliasToggle.addEventListener('change',function(){syncExportAliasPanel();});}if(els.helpToggleBtn)els.helpToggleBtn.addEventListener('click',toggleHelpSection);els.loadBtn.addEventListener('click',function(){if(els.loadJsonInput)els.loadJsonInput.click();});if(els.loadJsonInput)els.loadJsonInput.addEventListener('change',function(event){var file=event.target.files&&event.target.files[0];loadJsonFile(file);event.target.value='';});document.addEventListener('keydown',function(event){var key=String(event.key||'').toLowerCase();if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&key==='s'){event.preventDefault();if(document.body&&document.body.classList.contains('modal-open'))return;if(els.saveBtn)els.saveBtn.click();}});syncDividerModalRefs();if(els.dividerModalCancelBtn)els.dividerModalCancelBtn.addEventListener('click',closeDividerModal);if(els.dividerModalConfirmBtn)els.dividerModalConfirmBtn.addEventListener('click',submitDividerModal);if(els.dividerNameInput)els.dividerNameInput.addEventListener('keydown',function(event){if(event.key==='Enter')submitDividerModal();if(event.key==='Escape')closeDividerModal();});if(els.dividerInsertAfterInput)els.dividerInsertAfterInput.addEventListener('keydown',function(event){if(event.key==='Enter')submitDividerModal();if(event.key==='Escape')closeDividerModal();});if(els.dividerModalOverlay)els.dividerModalOverlay.addEventListener('click',function(event){if(event.target===els.dividerModalOverlay)closeDividerModal();});syncSortSectionModalRefs();loadThemePreference();if(els.themeToggleBtn)els.themeToggleBtn.addEventListener('click',toggleTheme);if(els.sortSectionCancelBtn)els.sortSectionCancelBtn.addEventListener('click',closeSortSectionModal);if(els.sortSectionConfirmBtn)els.sortSectionConfirmBtn.addEventListener('click',submitSortSectionModal);if(els.sortSectionFieldSelect)els.sortSectionFieldSelect.addEventListener('keydown',function(event){if(event.key==='Enter')submitSortSectionModal();if(event.key==='Escape')closeSortSectionModal();});if(els.sortSectionDirectionSelect)els.sortSectionDirectionSelect.addEventListener('keydown',function(event){if(event.key==='Enter')submitSortSectionModal();if(event.key==='Escape')closeSortSectionModal();});if(els.sortSectionModalOverlay)els.sortSectionModalOverlay.addEventListener('click',function(event){if(event.target===els.sortSectionModalOverlay)closeSortSectionModal();});els.moveCancelBtn.addEventListener('click',closeMoveModal);els.moveConfirmBtn.addEventListener('click',confirmMoveModal);els.moveRankInput.addEventListener('keydown',function(event){if(event.key==='Enter')confirmMoveModal();if(event.key==='Escape')closeMoveModal();});els.moveModalOverlay.addEventListener('click',function(event){if(event.target===els.moveModalOverlay)closeMoveModal();});if(deleteModalEls.cancelBtn)deleteModalEls.cancelBtn.addEventListener('click',closeDeleteConfirmModal);if(deleteModalEls.confirmBtn)deleteModalEls.confirmBtn.addEventListener('click',confirmDeleteSelectedCharacters);if(deleteModalEls.overlay)deleteModalEls.overlay.addEventListener('click',function(event){if(event.target===deleteModalEls.overlay)closeDeleteConfirmModal();});document.addEventListener('keydown',function(event){if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&String(event.key||'').toLowerCase()==='z'&&!isEditableTarget(event.target)){event.preventDefault();undoLastPositionChange();return;}
if(event.key!=='Escape')return;if(deleteModalEls.overlay&&deleteModalEls.overlay.classList.contains('show')){closeDeleteConfirmModal();return;}
if(els.sortSectionModalOverlay&&els.sortSectionModalOverlay.classList.contains('show')){closeSortSectionModal();return;}
if(els.dividerModalOverlay&&els.dividerModalOverlay.classList.contains('show')){closeDividerModal();return;}
if(els.moveModalOverlay.classList.contains('show'))closeMoveModal();});window.addEventListener('resize',fitHaremName);

/* search-ui moved to search-ui.js */

if(els.seriesPanelToggleBtn)els.seriesPanelToggleBtn.addEventListener('click',handleSeriesPanelToggle);if(els.seriesPanelToggleBtnMain)els.seriesPanelToggleBtnMain.addEventListener('click',handleSeriesPanelToggle);if(els.jumpPageTopBtn){els.jumpPageTopBtn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});}
initBoardMarqueeSelection();syncSeriesPanelState();syncHelpSectionState();syncExportAliasPanel();updateMultiSelectUI();ensureSyncModeTypeUI();bindSyncType();enforceSevenColumnBoard();ensureHideMissingButton();try{if(localStorage.getItem(STORAGE_KEY))loadLocal(false);else{updateStats();renderBoard();}}catch(error){console.error(error);updateStats();renderBoard();}

/* inline-script-2 */


/* advanced divider logic moved to external dividers.js */

/* search-ui inline block moved to search-ui.js */

/* inline-script-8 */
(function(){function ensureHistory(){if(!window.AppState)return[];if(!Array.isArray(window.AppState.changedZoneHistory))window.AppState.changedZoneHistory=[];return window.AppState.changedZoneHistory;}
function setHistory(ranges){if(!window.AppState)return[];window.AppState.changedZoneHistory=(Array.isArray(ranges)?ranges:[]).map(function(range){return{start:range.start,end:range.end};});return window.AppState.changedZoneHistory;}
function syncLocalZonesFromHistory(){if(!window.AppState)return[];var history=ensureHistory();window.AppState.changedZones=history.map(function(range){return{start:range.start,end:range.end};});window.AppState.useLocalChangedZones=!!history.length;if(history.length){var minStart=history[0].start;var maxEnd=history[0].end;history.forEach(function(range){if(range.start<minStart)minStart=range.start;if(range.end>maxEnd)maxEnd=range.end;});window.AppState.changedVisibleRange={start:minStart,end:maxEnd};}else{window.AppState.changedVisibleRange=null;}return window.AppState.changedZones;}
function pushHistoryRange(start,end){if(!window.AppState)return[];start=parseInt(start,10);end=parseInt(end,10);if(isNaN(start)||isNaN(end))return ensureHistory();if(start>end){var tmp=start;start=end;end=tmp;}var total=typeof window.getVisibleCharacterCount==='function'?window.getVisibleCharacterCount(window.AppState.characters):0;if(total>0){start=Math.max(1,Math.min(start,total));end=Math.max(1,Math.min(end,total));}var history=ensureHistory().slice();var last=history.length?history[history.length-1]:null;var next={start:start,end:end};if(!last||last.start!==next.start||last.end!==next.end)history.push(next);if(history.length>3)history=history.slice(history.length-3);setHistory(history);return syncLocalZonesFromHistory();}
function buildChronoChangedExports(){if(!window.AppState||typeof window.getRealCharacters!=='function'||typeof window.buildChunksFromCharacters!=='function')return null;var history=ensureHistory();if(!history.length)return null;var realChars=window.getRealCharacters(window.AppState.characters);if(!realChars.length)return[];return history.map(function(range){var start=Math.max(1,Math.min(range.start,realChars.length));var end=Math.max(start,Math.min(range.end,realChars.length));var changedChars=realChars.slice(start-1,end);if(!changedChars.length)return null;var carryName=typeof window.getExportName==='function'?window.getExportName(changedChars[0]):changedChars[0].name;return{start:start,end:end,rawEnd:end,changedCount:changedChars.length,carryName:carryName,chunks:window.buildChunksFromCharacters(changedChars.slice(),'$smp ')};}).filter(Boolean);}
if(typeof window.clearChangedZones==='function'&&!window.clearChangedZones.__fastSmpChronoLocalWrapped){var originalClearChangedZones=window.clearChangedZones;window.clearChangedZones=function(){var result=originalClearChangedZones.apply(this,arguments);setHistory([]);syncLocalZonesFromHistory();return result;};window.clearChangedZones.__fastSmpChronoLocalWrapped=true;}
if(typeof window.pushPositionUndoSnapshot==='function'&&!window.pushPositionUndoSnapshot.__fastSmpChronoLocalWrapped){var originalPushPositionUndoSnapshot=window.pushPositionUndoSnapshot;window.pushPositionUndoSnapshot=function(label){var ok=originalPushPositionUndoSnapshot.apply(this,arguments);var stack=window.AppState&&Array.isArray(window.AppState.positionUndoStack)?window.AppState.positionUndoStack:null;if(ok&&stack&&stack.length){stack[stack.length-1].changedZoneHistory=ensureHistory().map(function(range){return{start:range.start,end:range.end};});}return ok;};window.pushPositionUndoSnapshot.__fastSmpChronoLocalWrapped=true;}
if(typeof window.undoLastPositionChange==='function'&&!window.undoLastPositionChange.__fastSmpChronoLocalWrapped){var originalUndoLastPositionChange=window.undoLastPositionChange;window.undoLastPositionChange=function(){var stack=window.AppState&&Array.isArray(window.AppState.positionUndoStack)?window.AppState.positionUndoStack:[];var nextHistory=stack.length&&Array.isArray(stack[stack.length-1].changedZoneHistory)?stack[stack.length-1].changedZoneHistory.map(function(range){return{start:range.start,end:range.end};}):[];var result=originalUndoLastPositionChange.apply(this,arguments);if(result){setHistory(nextHistory);syncLocalZonesFromHistory();}return result;};window.undoLastPositionChange.__fastSmpChronoLocalWrapped=true;}
if(typeof window.addChangedZone==='function'&&!window.addChangedZone.__fastSmpChronoLocalWrapped){var originalAddChangedZone=window.addChangedZone;window.addChangedZone=function(start,end){originalAddChangedZone.apply(this,arguments);return pushHistoryRange(start,end);};window.addChangedZone.__fastSmpChronoLocalWrapped=true;}
if(typeof window.buildChangedZoneExports==='function'&&!window.buildChangedZoneExports.__fastSmpChronoLocalWrapped){var originalBuildChangedZoneExports=window.buildChangedZoneExports;window.buildChangedZoneExports=function(){var chrono=buildChronoChangedExports();if(chrono)return chrono;return originalBuildChangedZoneExports.apply(this,arguments);};window.buildChangedZoneExports.__fastSmpChronoLocalWrapped=true;}
syncLocalZonesFromHistory();if(typeof window.updateOrderOutput==='function'){try{window.updateOrderOutput();}catch(e){}}})();

/* inline-script-9 */
(function(){const STORE='mhp-floating-toolbar-pos-v3';const BAR_ID='multiSelectBar';const HANDLE_ID='multiSelectDragHandle';const DOCK_TOLERANCE=20;const EDGE_TOLERANCE=8;let dragging=false,sx=0,sy=0,bl=0,bt=0;let bar,handle;function getBar(){return document.getElementById(BAR_ID);}
function getHandle(){return document.getElementById(HANDLE_ID);}
function savePos(left,top,docked=null){try{localStorage.setItem(STORE,JSON.stringify({mode:docked||'free',left:left,top:top}));}catch(e){}}
function loadPos(){try{return JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){return{};}}
function place(left,top,docked=null){bar=getBar();if(!bar)return;const w=bar.offsetWidth||320;const h=bar.offsetHeight||52;left=Math.max(EDGE_TOLERANCE,Math.min(left,window.innerWidth-w-EDGE_TOLERANCE));top=Math.max(EDGE_TOLERANCE,Math.min(top,window.innerHeight-h-EDGE_TOLERANCE));bar.style.cssText+=';position:fixed!important;z-index:9999!important;';bar.style.left=left+'px';bar.style.top=top+'px';bar.style.bottom='auto';bar.style.right='auto';bar.style.transform='none';if(docked){bar.classList.remove('is-docked-bottom','is-docked-top','is-docked-left','is-docked-right');bar.classList.add('is-docked-'+docked);bar.style.boxShadow=docked==='bottom'?'0 10px 26px rgba(0,0,0,.24), 0 -1px 0 rgba(255,255,255,.03) inset, 0 0 0 1px rgba(167,139,250,.16) inset !important':'0 10px 26px rgba(0,0,0,.24), 0 1px 0 rgba(255,255,255,.03) inset, 0 0 0 1px rgba(167,139,250,.16) inset !important';bar.style.borderRadius=docked==='bottom'?'18px 18px 12px 12px !important':'12px 12px 18px 18px !important';}else{bar.classList.remove('is-docked-bottom','is-docked-top','is-docked-left','is-docked-right');bar.style.boxShadow='0 18px 44px rgba(0,0,0,.34), 0 0 0 1px rgba(255,255,255,.03) inset !important';bar.style.borderRadius='18px !important';}
if(!dragging)savePos(left,top,docked);}
function placeDocked(mode){bar=getBar();if(!bar)return;const w=bar.offsetWidth||320;const h=bar.offsetHeight||52;const vw=window.innerWidth,vh=window.innerHeight;if(mode==='top')return place((vw-w)/2,EDGE_TOLERANCE,'top');if(mode==='left')return place(EDGE_TOLERANCE,(vh-h)/2,'left');if(mode==='right')return place(vw-w-EDGE_TOLERANCE,(vh-h)/2,'right');return place((vw-w)/2,vh-h-12,'bottom');}
function dockToEdge(x,y,w,h){const vw=window.innerWidth,vh=window.innerHeight;if(Math.abs(y+h-vh)<DOCK_TOLERANCE){place((vw-w)/2,vh-h-12,'bottom');return true;}
if(Math.abs(y-EDGE_TOLERANCE)<DOCK_TOLERANCE){place((vw-w)/2,EDGE_TOLERANCE,'top');return true;}
if(Math.abs(x-EDGE_TOLERANCE)<DOCK_TOLERANCE){place(EDGE_TOLERANCE,(vh-h)/2,'left');return true;}
if(Math.abs(x+w-vw)<DOCK_TOLERANCE){place(vw-w-EDGE_TOLERANCE,(vh-h)/2,'right');return true;}
return false;}
function init(){bar=getBar();handle=getHandle();if(!bar||!handle)return;const newHandle=handle.cloneNode(true);handle.parentNode.replaceChild(newHandle,handle);handle=newHandle;const saved=loadPos();if(saved.mode&&saved.mode!=='free'){placeDocked(saved.mode);}else if(saved.mode==='free'&&saved.left!==undefined&&saved.top!==undefined){place(saved.left,saved.top,null);}else{placeDocked('bottom');}
handle.style.cursor='grab';handle.title='Drag to move (drop near edges to dock)';handle.addEventListener('pointerdown',(e)=>{handle.setPointerCapture(e.pointerId);dragging=true;const rect=bar.getBoundingClientRect();sx=e.clientX;sy=e.clientY;bl=rect.left;bt=rect.top;bar.classList.add('dragging');handle.style.cursor='grabbing';e.preventDefault();});handle.addEventListener('pointermove',(e)=>{if(!dragging)return;let nx=bl+e.clientX-sx;let ny=bt+e.clientY-sy;place(nx,ny);e.preventDefault();});function stopDrag(e){if(!dragging)return;dragging=false;bar.classList.remove('dragging');handle.style.cursor='grab';const rect=bar.getBoundingClientRect();const w=bar.offsetWidth,h=bar.offsetHeight;if(!dockToEdge(rect.left,rect.top,w,h)){savePos(rect.left,rect.top,null);}}
handle.addEventListener('pointerup',stopDrag);handle.addEventListener('pointercancel',stopDrag);window.addEventListener('pointerup',stopDrag);window.addEventListener('resize',()=>{if(!bar||dragging)return;const saved=loadPos();if(!saved.mode||saved.mode==='bottom'){placeDocked('bottom');return;}if(saved.mode==='top'||saved.mode==='left'||saved.mode==='right'){placeDocked(saved.mode);return;}const rect=bar.getBoundingClientRect();place(rect.left,rect.top,null);});}
if(document.readyState==='complete')setTimeout(init,0);else window.addEventListener('load',()=>setTimeout(init,0));})();

/* inline-script-10 */
(function(){if(typeof AppState!=='object')return;if(typeof AppState.genderFilter!=='string')AppState.genderFilter='';function hasGenderRouletteToken(value,token){return new RegExp('(^|[^a-z])\\$?'+token+'(?=[^a-z]|$)','i').test(String(value||''));}
window.getCharacterGenderBucket=function(item){var roulette=String(item&&item.roulette||'');var female=hasGenderRouletteToken(roulette,'wa')||hasGenderRouletteToken(roulette,'wg');var male=hasGenderRouletteToken(roulette,'ha')||hasGenderRouletteToken(roulette,'hg');if(female&&male)return'mixed';if(female)return'female';if(male)return'male';return'unknown';};window.getCharacterGenderSearchText=function(item){var bucket=window.getCharacterGenderBucket(item);if(bucket==='female')return'female waifu';if(bucket==='male')return'male husbando';if(bucket==='mixed')return'mixed female male waifu husbando';return'unknown gender';};function ensureGenderFilterUI(){var grid=document.querySelector('.filters-grid');if(!grid||document.getElementById('genderFilter'))return null;var control=document.createElement('div');control.className='control';var label=document.createElement('label');label.setAttribute('for','genderFilter');label.textContent='Gender';var select=document.createElement('select');select.id='genderFilter';select.innerHTML=''
+'<option value="">All</option>'
+'<option value="female">Female / Waifu</option>'
+'<option value="male">Male / Husbando</option>'
+'<option value="mixed">Mixed</option>'
+'<option value="unknown">Unknown</option>';control.appendChild(label);control.appendChild(select);grid.appendChild(control);var searchInput=document.getElementById('searchInput');if(searchInput&&!/gender/i.test(searchInput.placeholder||'')){searchInput.placeholder='Name, series, owner, note, or gender...';}
return select;}
function syncGenderFilterState(){var el=document.getElementById('genderFilter');if(el)el.value=String(AppState.genderFilter||'');if(typeof els==='object'&&els)els.genderFilter=el;}
window.getFilteredCharacters=function(){var searchTerms=String(AppState.filter||'').trim().toLowerCase().split(',').map(function(term){return term.trim();}).filter(Boolean);var filterClean=normalizeOwnerName(AppState.ownerFilter);var hasOwnerFilter=!!filterClean;var hasRouletteFilter=!!AppState.rouletteFilter;var hasGenderFilter=!!AppState.genderFilter;var hasSeriesFilter=!!AppState.selectedSeries.length;var hasSearch=!!searchTerms.length;var hasAnyFilter=hasSearch||hasOwnerFilter||hasRouletteFilter||hasGenderFilter||hasSeriesFilter;if(!hasAnyFilter)return getCollapsedVisibleItems(AppState.characters);var includeMap={};var currentLevel1Id=null;var currentLevel2Id=null;var currentLevel1Text='';var currentLevel2Text='';AppState.characters.forEach(function(item){if(isDividerItem(item)){var dividerLevel=getDividerLevel(item);var dividerText=String(item.title||item.name||'').toLowerCase();if(dividerLevel===1){currentLevel1Id=item.id;currentLevel1Text=dividerText;currentLevel2Id=null;currentLevel2Text='';}else{currentLevel2Id=item.id;currentLevel2Text=dividerText;}
var matchesDividerSearch=hasSearch&&searchTerms.some(function(term){return dividerText.indexOf(term)!==-1;});if(matchesDividerSearch){includeMap[item.id]=true;if(dividerLevel===2&&currentLevel1Id)includeMap[currentLevel1Id]=true;}
return;}
var genderText=window.getCharacterGenderSearchText(item);var haystack=[item.name,item.series,item.owner,item.note,item.roulette,genderText,currentLevel1Text,currentLevel2Text];var matchesSearch=!hasSearch||searchTerms.some(function(term){return haystack.some(function(value){return String(value||'').toLowerCase().indexOf(term)!==-1;});});var charClean=normalizeOwnerName(item.owner);var matchesOwner=!hasOwnerFilter||charClean===filterClean;var matchesRoulette=!hasRouletteFilter||hasRouletteToken(item.roulette,AppState.rouletteFilter);var matchesGender=!hasGenderFilter||window.getCharacterGenderBucket(item)===AppState.genderFilter;var matchesSeries=!hasSeriesFilter||AppState.selectedSeries.indexOf(item.series||'No series')!==-1;if(matchesSearch&&matchesOwner&&matchesRoulette&&matchesGender&&matchesSeries){includeMap[item.id]=true;if(currentLevel1Id)includeMap[currentLevel1Id]=true;if(currentLevel2Id)includeMap[currentLevel2Id]=true;}});return AppState.characters.filter(function(item){return!!includeMap[item.id];});};var originalRenderBoard=(typeof renderBoard==='function')?renderBoard:null;if(originalRenderBoard){window.renderBoard=function(){syncGenderFilterState();return originalRenderBoard.apply(this,arguments);};}
var originalParseFullMmis=(typeof parseFullMmis==='function')?parseFullMmis:null;if(originalParseFullMmis){window.parseFullMmis=async function(raw){var result=await originalParseFullMmis.apply(this,arguments);if(result){AppState.genderFilter='';syncGenderFilterState();}
return result;};}
var genderEl=ensureGenderFilterUI();syncGenderFilterState();genderEl=document.getElementById('genderFilter')||genderEl;if(genderEl&&!genderEl.dataset.genderBound){genderEl.dataset.genderBound='1';genderEl.addEventListener('change',function(){AppState.genderFilter=this.value||'';if(typeof renderBoard==='function')renderBoard();if(typeof updateStats==='function')updateStats();if(typeof updateSeriesSummary==='function')updateSeriesSummary();if(typeof saveLocal==='function')saveLocal(false);});}})();

/* inline-script-11 */
(function(){if(window.__fastSmpSmartPatchApplied)return;window.__fastSmpSmartPatchApplied=true;function safeCopyText(text){var value=String(text==null?'':text);if(!value)return Promise.reject(new Error('empty'));if(window.copyTextToClipboard)return window.copyTextToClipboard(value);if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(value);return Promise.reject(new Error('clipboard'));}
function bindDirectChunkCopy(){if(window.__fastSmpDirectChunkCopyBound)return;window.__fastSmpDirectChunkCopyBound=true;document.addEventListener('click',function(event){var btn=event.target&&event.target.closest?event.target.closest('.chunk-copy-btn'):null;var output=document.getElementById('orderOutput');if(!btn||!output||!output.contains(btn))return;var card=btn.closest?btn.closest('.chunk-card'):null;var textEl=card?card.querySelector('.chunk-text'):null;var text=textEl?textEl.textContent:'';if(!text)return;event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();var header=card?card.querySelector('.chunk-header span'):null;var label=header?header.textContent.replace(/\s+/g,' ').trim():'Block';safeCopyText(text).then(function(){if(window.showMessage)showMessage(label+' copied.');}).catch(function(){if(window.showMessage)showMessage('Could not copy the $smp.','error');});return false;},true);}
function rebuildGroupFromRange(start,end){if(!window.AppState||!Array.isArray(AppState.characters))return null;if(typeof window.getRealCharacters!=='function'||typeof window.buildChunksFromCharacters!=='function')return null;var realChars=window.getRealCharacters(AppState.characters);if(!realChars.length)return null;start=parseInt(start,10)||1;end=parseInt(end,10)||start;var safeStart=Math.max(1,Math.min(start,realChars.length));var safeEnd=Math.max(safeStart,Math.min(end,realChars.length));var changedChars=realChars.slice(safeStart-1,safeEnd);if(!changedChars.length)return null;var carryName=typeof window.getExportName==='function'?window.getExportName(changedChars[0]):changedChars[0].name;return{start:safeStart,end:safeEnd,rawEnd:safeEnd,changedCount:changedChars.length,carryName:carryName,chunks:window.buildChunksFromCharacters(changedChars.slice(),'$smp ')};}
function mergeNearbyChangedGroups(groups){if(!Array.isArray(groups)||!groups.length)return groups||[];var sorted=groups.filter(Boolean).map(function(group){return{start:parseInt(group.start,10)||1,end:parseInt(group.end,10)||parseInt(group.rawEnd,10)||1};}).sort(function(a,b){return a.start-b.start;});if(!sorted.length)return[];var merged=[sorted[0]];for(var i=1;i<sorted.length;i+=1){var current=merged[merged.length-1];var next=sorted[i];if(next.start-current.end<=3){current.end=Math.max(current.end,next.end);}else{merged.push(next);}}
return merged.map(function(range){return rebuildGroupFromRange(range.start,range.end);}).filter(Boolean);}
function wrapChangedExports(){if(typeof window.buildChangedZoneExports!=='function'||window.buildChangedZoneExports.__smartFastSmpWrapped)return;var original=window.buildChangedZoneExports;window.buildChangedZoneExports=function(){var groups=original.apply(this,arguments);return mergeNearbyChangedGroups(groups);};window.buildChangedZoneExports.__smartFastSmpWrapped=true;}
function boot(){bindDirectChunkCopy();wrapChangedExports();if(typeof window.updateOrderOutput==='function'){try{window.updateOrderOutput();}catch(e){}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();})();

/* inline-script-12 */
(function(){if(window.__rebasedDividerSectionPatchV30)return;window.__rebasedDividerSectionPatchV30=true;function getItemById(id){if(!window.AppState||!Array.isArray(AppState.characters))return null;for(var i=0;i<AppState.characters.length;i++){if(AppState.characters[i]&&AppState.characters[i].id===id)return AppState.characters[i];}return null;}
function countRealCharacters(items){return(items||[]).filter(function(item){return!(window.isDividerItem&&isDividerItem(item));}).length;}
function getDividerMoveBlockRange(dividerId){if(!window.AppState||!Array.isArray(AppState.characters)||!window.isDividerItem||!window.getDividerLevel)return null;var list=AppState.characters;var dividerIndex=list.findIndex(function(item){return item&&item.id===dividerId&&isDividerItem(item);});if(dividerIndex===-1)return null;var divider=list[dividerIndex];var level=getDividerLevel(divider);var end=list.length;for(var i=dividerIndex+1;i<list.length;i++){var item=list[i];if(!isDividerItem(item))continue;var nextLevel=getDividerLevel(item);if(level===1){if(nextLevel===1){end=i;break;}}else{if(nextLevel<=2){end=i;break;}}}var block=list.slice(dividerIndex,end);return{dividerIndex:dividerIndex,start:dividerIndex,end:end,level:level,block:block,characterCount:countRealCharacters(block)};}
window.getDividerMoveBlockRange=getDividerMoveBlockRange;function getSectionAwareInsertIndex(list,targetId,placeAfter){var targetIndex=list.findIndex(function(item){return item&&item.id===targetId;});if(targetIndex===-1)return-1;if(!placeAfter)return targetIndex;var targetItem=list[targetIndex];if(!(window.isDividerItem&&isDividerItem(targetItem)&&window.getDividerLevel))return targetIndex+1;var level=getDividerLevel(targetItem);var insertIndex=list.length;for(var i=targetIndex+1;i<list.length;i++){var item=list[i];if(!(window.isDividerItem&&isDividerItem(item)))continue;var nextLevel=getDividerLevel(item);if(level===1){if(nextLevel===1){insertIndex=i;break;}}else{if(nextLevel<=2){insertIndex=i;break;}}}return insertIndex;}
function clearDropGuides(){Array.prototype.slice.call(document.querySelectorAll('.character-card.drop-before,.character-card.drop-after')).forEach(function(node){node.classList.remove('drop-before');node.classList.remove('drop-after');});}
function getDropPlacement(card,event){if(!card)return'before';var line=card.classList.contains('divider-card')?card.querySelector('.divider-line'):null;if(line){var lineRect=line.getBoundingClientRect();var lineCenter=lineRect.top+(lineRect.height/2);return event.clientY>=lineCenter?'after':'before';}var rect=card.getBoundingClientRect();var mid=rect.top+(rect.height/2);return event.clientY>=mid?'after':'before';}
function moveDividerBlockToVisibleRank(dividerId,afterRank){if(!window.AppState||!Array.isArray(AppState.characters))return false;var range=getDividerMoveBlockRange(dividerId);if(!range)return false;var list=AppState.characters.slice();var block=list.slice(range.start,range.end);var remaining=list.slice(0,range.start).concat(list.slice(range.end));var maxAfter=countRealCharacters(remaining);var target=parseInt(String(afterRank||0).trim(),10);if(isNaN(target)||target<0)target=0;if(target>maxAfter)target=maxAfter;var insertIndex=(typeof getInsertIndexAfterVisibleRankInList==='function')?getInsertIndexAfterVisibleRankInList(remaining,target):remaining.length;if(typeof pushPositionUndoSnapshot==='function')pushPositionUndoSnapshot('move-divider-block');remaining.splice(insertIndex,0,...block);AppState.characters=remaining;AppState.characters.forEach(function(char,index){char.currentRank=index+1;});if(typeof rebuildPersistentOrderMap==='function')rebuildPersistentOrderMap();if(typeof refreshChangedZone==='function')refreshChangedZone();if(typeof renderBoard==='function')renderBoard();if(typeof closeMoveModal==='function')closeMoveModal();if(typeof saveLocal==='function')saveLocal(false);if(typeof showMessage==='function')showMessage('Moved divider with '+range.characterCount+' character'+(range.characterCount===1?'':'s')+'.');return true;}
function moveCharacterRelativeToTarget(draggedId,targetId,placeAfter){var sourceIndex=AppState.characters.findIndex(function(c){return c.id===draggedId;});var targetIndex=AppState.characters.findIndex(function(c){return c.id===targetId;});if(sourceIndex===-1||targetIndex===-1)return;var movedItem=AppState.characters[sourceIndex];var targetItem=AppState.characters[targetIndex];var shouldTrackLocalZone=!isDividerItem(movedItem)&&!isDividerItem(targetItem);if(typeof pushPositionUndoSnapshot==='function')pushPositionUndoSnapshot('drag move');var moved=AppState.characters.splice(sourceIndex,1)[0];var insertIndex=getSectionAwareInsertIndex(AppState.characters,targetId,placeAfter);if(insertIndex===-1)AppState.characters.push(moved);else AppState.characters.splice(insertIndex,0,moved);AppState.characters.forEach(function(char,index){char.currentRank=index+1;});if(typeof rebuildPersistentOrderMap==='function')rebuildPersistentOrderMap();if(typeof refreshChangedZone==='function')refreshChangedZone(shouldTrackLocalZone);if(shouldTrackLocalZone&&typeof addChangedZoneAroundIds==='function')addChangedZoneAroundIds([draggedId],1,1);if(typeof renderBoard==='function')renderBoard();if(typeof saveLocal==='function')saveLocal(false);}
function moveCharacterBlockRelativeToTarget(draggedIds,targetId,placeAfter){var ids=Array.isArray(draggedIds)?draggedIds.slice():[draggedIds];ids=ids.filter(Boolean);if(!ids.length||!targetId)return;var selectedMap={};ids.forEach(function(id){selectedMap[id]=true;});if(selectedMap[targetId])return;var block=AppState.characters.filter(function(char){return!!selectedMap[char.id];});if(!block.length)return;var remaining=AppState.characters.filter(function(char){return!selectedMap[char.id];});var targetIndex=remaining.findIndex(function(char){return char.id===targetId;});if(targetIndex===-1)return;var targetItem=remaining[targetIndex];var shouldTrackLocalZone=!block.some(function(item){return isDividerItem(item);})&&!isDividerItem(targetItem);if(typeof pushPositionUndoSnapshot==='function')pushPositionUndoSnapshot('block move');var insertIndex=getSectionAwareInsertIndex(remaining,targetId,placeAfter);if(insertIndex===-1)return;remaining.splice(insertIndex,0,...block);AppState.characters=remaining;AppState.characters.forEach(function(char,index){char.currentRank=index+1;});if(typeof rebuildPersistentOrderMap==='function')rebuildPersistentOrderMap();if(typeof refreshChangedZone==='function')refreshChangedZone(shouldTrackLocalZone);if(shouldTrackLocalZone&&typeof addChangedZoneAroundIds==='function')addChangedZoneAroundIds(ids,1,1);if(typeof renderBoard==='function')renderBoard();if(typeof saveLocal==='function')saveLocal(false);if(block.length>1&&typeof showMessage==='function')showMessage(block.length+' characters moved as a block.');}
function patchMoveCharacterToRank(){if(typeof moveCharacterToRank!=='function'||moveCharacterToRank.__rebaseV30)return;var original=moveCharacterToRank;moveCharacterToRank=window.moveCharacterToRank=function(charId,targetRankInput){var item=getItemById(charId);if(item&&window.isDividerItem&&isDividerItem(item)&&item.moveWithChildren){return moveDividerBlockToVisibleRank(charId,targetRankInput);}return original.apply(this,arguments);};moveCharacterToRank.__rebaseV30=true;}
function patchAttachDragEvents(){if(typeof attachDragEvents!=='function'||attachDragEvents.__rebaseV30)return;attachDragEvents=window.attachDragEvents=function(){var cards=Array.prototype.slice.call(els.board.querySelectorAll('.character-card'));var draggedIds=[];cards.forEach(function(card){card.addEventListener('dragstart',function(event){DragState.suppressClickUntil=Date.now()+300;clearDropGuides();var cardId=card.getAttribute('data-id');var item=getItemById(cardId);if(AppState.multiSelectMode&&AppState.selectedMoveIds.length>1){if(AppState.selectedMoveIds.indexOf(cardId)===-1){draggedIds=[cardId];}else{draggedIds=AppState.selectedMoveIds.slice();}}else if(item&&window.isDividerItem&&isDividerItem(item)&&item.moveWithChildren){var range=getDividerMoveBlockRange(cardId);var ids=range&&Array.isArray(range.block)?range.block.map(function(entry){return entry.id;}):[];draggedIds=ids.length?ids:[cardId];}else{draggedIds=[cardId];}if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',draggedIds.join(','));}cards.forEach(function(node){if(draggedIds.indexOf(node.getAttribute('data-id'))!==-1)node.classList.add('dragging');});});card.addEventListener('dragend',function(){DragState.suppressClickUntil=Date.now()+300;cards.forEach(function(node){node.classList.remove('dragging');});draggedIds=[];clearDropGuides();});card.addEventListener('dragover',function(event){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';if(!draggedIds.length)return;clearDropGuides();var placement=getDropPlacement(card,event);card.classList.add(placement==='after'?'drop-after':'drop-before');});card.addEventListener('dragleave',function(){card.classList.remove('drop-before');card.classList.remove('drop-after');});card.addEventListener('drop',function(event){event.preventDefault();var targetId=card.getAttribute('data-id');var placement=getDropPlacement(card,event);clearDropGuides();if(!draggedIds.length||!targetId)return;if(draggedIds.indexOf(targetId)!==-1)return;if(draggedIds.length>1){moveCharacterBlockRelativeToTarget(draggedIds,targetId,placement==='after');return;}if(draggedIds[0]===targetId)return;moveCharacterRelativeToTarget(draggedIds[0],targetId,placement==='after');});});};attachDragEvents.__rebaseV30=true;}
function patchUpdateMultiSelectUI(){if(typeof updateMultiSelectUI!=='function'||updateMultiSelectUI.__rebaseV30)return;var original=updateMultiSelectUI;updateMultiSelectUI=window.updateMultiSelectUI=function(){var result=original.apply(this,arguments);var btn=document.getElementById('multiSelectToggleBtn');if(btn){btn.textContent='Multi-select';btn.title=window.AppState&&AppState.multiSelectMode?'Multi-select enabled':'Multi-select disabled';btn.classList.add('mode-toggle-btn');btn.classList.toggle('is-active',!!(window.AppState&&AppState.multiSelectMode));btn.setAttribute('aria-pressed',window.AppState&&AppState.multiSelectMode?'true':'false');btn.classList.remove('btn-primary');btn.classList.add('btn-ghost');}return result;};updateMultiSelectUI.__rebaseV30=true;}
function bindDividerBlockToggle(){var board=document.getElementById('board');if(!board||board.__rebaseV30toggleBound)return;board.__rebaseV30toggleBound=true;board.addEventListener('click',function(event){var btn=event.target&&event.target.closest?event.target.closest('[data-divider-block-toggle]'):null;if(!btn)return;event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();var id=btn.getAttribute('data-divider-block-toggle');var item=getItemById(id);if(!item||!window.isDividerItem||!isDividerItem(item))return;item.moveWithChildren=!item.moveWithChildren;if(typeof renderBoard==='function')renderBoard();if(typeof saveLocal==='function')saveLocal(false);if(typeof showMessage==='function')showMessage(item.moveWithChildren?'Section move enabled.':'Section move disabled.');},true);}
function initRebasedDividerSectionPatchV30(){patchMoveCharacterToRank();patchAttachDragEvents();patchUpdateMultiSelectUI();bindDividerBlockToggle();if(typeof updateMultiSelectUI==='function')updateMultiSelectUI();if(typeof renderBoard==='function'){try{renderBoard();}catch(e){}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initRebasedDividerSectionPatchV30,{once:true});else initRebasedDividerSectionPatchV30();})();

/* removed duplicate edit/quick-actions inline script; handled by js/character-edit.js */

/* removed legacy lock-group experiment v91; handled by js/lock-group.js */

/* removed legacy lock-group core v92; handled by js/lock-group.js */

/* stability-and-delete-v97 */
(function(){
if(window.__stabilityAndDeleteV97)return;window.__stabilityAndDeleteV97=true;
function q(id){return document.getElementById(id)}
function getList(){return window.AppState&&Array.isArray(window.AppState.characters)?window.AppState.characters:[]}
function isDivider(item){return !!(window.isDividerItem&&window.isDividerItem(item))}
function getChar(id){var list=getList();for(var i=0;i<list.length;i++){var item=list[i];if(item&&item.id===id&&!isDivider(item))return item}return null}
function closeDirectEditNow(){var overlay=q('editCharModalOverlay');if(overlay){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true')}if(document.body&&!((q('moveModalOverlay')&&q('moveModalOverlay').classList.contains('show'))||(q('deleteModalOverlay')&&q('deleteModalOverlay').classList.contains('show'))))document.body.classList.remove('modal-open');window.__directEditCardMode=null;if(window.EditCharState){window.EditCharState.active=false;window.EditCharState.charId=null}}
function deleteCurrentEditCharacter(){var charId=window.__directEditCardMode&&window.__directEditCardMode.charId?window.__directEditCardMode.charId:(window.EditCharState&&window.EditCharState.charId?window.EditCharState.charId:null);var char=getChar(charId);if(!char){if(typeof window.showMessage==='function')showMessage('No character selected.','error');return;}var run=function(){window.AppState.characters=getList().filter(function(entry){return !(entry&&entry.id===charId)});if(window.AppState&&Array.isArray(window.AppState.selectedMoveIds))window.AppState.selectedMoveIds=window.AppState.selectedMoveIds.filter(function(id){return id!==charId});if(typeof window.renumberAllItems==='function')renumberAllItems();if(typeof window.rebuildPersistentOrderMap==='function')rebuildPersistentOrderMap();if(typeof window.updateOwnerFilterOptions==='function')updateOwnerFilterOptions();if(typeof window.refreshChangedZone==='function')refreshChangedZone();closeDirectEditNow();if(typeof window.renderBoard==='function')window.renderBoard();if(typeof window.saveLocal==='function')window.saveLocal(false);if(typeof window.showMessage==='function')showMessage('Character deleted.');};if(typeof window.openDeleteConfirmModal==='function'){openDeleteConfirmModal({title:'Delete character',subtitle:String(char.name||'').trim()||'Selected character',help:'You are about to remove this character from the harem. This action cannot be undone.',confirmLabel:'Delete',onConfirm:run});}else{run()}}
function bindEditDelete(){var btn=q('editCharDeleteBtn');if(!btn||btn.dataset.bound==='1')return;btn.dataset.bound='1';btn.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();deleteCurrentEditCharacter()},true)}
function refreshGroupVisibility(){var btn=q('lockGroupSelectedBtn');if(!btn)return;var multi=!!(window.AppState&&window.AppState.multiSelectMode);btn.hidden=!multi;btn.style.display=multi?'inline-flex':'none';if(!multi)btn.setAttribute('aria-hidden','true');else btn.removeAttribute('aria-hidden')}
function install(){bindEditDelete();refreshGroupVisibility();if(typeof window.updateMultiSelectUI==='function'&&!window.updateMultiSelectUI.__v97Wrapped){var original=window.updateMultiSelectUI;window.updateMultiSelectUI=function(){var result=original.apply(this,arguments);refreshGroupVisibility();return result};window.updateMultiSelectUI.__v97Wrapped=true;}if(typeof window.renderBoard==='function'&&!window.renderBoard.__v97Wrapped){var originalRender=window.renderBoard;window.renderBoard=function(){var result=originalRender.apply(this,arguments);setTimeout(function(){bindEditDelete();refreshGroupVisibility();},0);return result};window.renderBoard.__v97Wrapped=true;}setTimeout(function(){bindEditDelete();refreshGroupVisibility();},0)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


/* demo-fallback-and-edit-layout-v98 */
(function(){
if(window.__demoFallbackAndEditLayoutV98)return;window.__demoFallbackAndEditLayoutV98=true;
function q(id){return document.getElementById(id)}
function loadEmbeddedDemo(){var node=q('embeddedDemoJson');if(!node)return null;try{return JSON.parse(node.textContent||node.innerText||'null')}catch(e){return null}}
function bindDemoFallback(){var btn=q('demoBtn');if(!btn||btn.dataset.v98Bound==='1')return;var clone=btn.cloneNode(true);btn.parentNode.replaceChild(clone,btn);clone.dataset.v98Bound='1';clone.addEventListener('click',function(){function useEmbedded(){var embedded=loadEmbeddedDemo();if(embedded&&typeof window.loadJsonFromParsed==='function'){loadJsonFromParsed(embedded,true);if(typeof window.showMessage==='function')showMessage('Embedded demo loaded.');return true;}return false;}if(window.location&&window.location.protocol==='file:'){if(!useEmbedded()&&typeof window.showMessage==='function')showMessage('The demo JSON could not be loaded.','error');return;}fetch('demo.json').then(function(response){if(!response.ok)throw new Error('demo-not-found');return response.json();}).then(function(parsed){if(typeof window.loadJsonFromParsed==='function')loadJsonFromParsed(parsed,true);else throw new Error('demo-loader-missing');}).catch(function(){if(useEmbedded())return;if(typeof window.showMessage==='function')showMessage('The demo JSON could not be loaded.','error');});});}
function install(){bindDemoFallback();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


/* json-drag-load-v99 */
(function(){
if(window.__jsonDragLoadV99)return;window.__jsonDragLoadV99=true;
function q(id){return document.getElementById(id)}
function showOverlay(){var el=q('jsonDropOverlay');if(!el)return;el.classList.add('show');el.setAttribute('aria-hidden','false');}
function hideOverlay(){var el=q('jsonDropOverlay');if(!el)return;el.classList.remove('show');el.setAttribute('aria-hidden','true');}
function looksLikeJsonFile(file){return !!(file&&(/\.json$/i.test(String(file.name||''))||String(file.type||'').toLowerCase().indexOf('json')!==-1));}
function loadDroppedFile(file){if(!file)return;if(!looksLikeJsonFile(file)){if(typeof window.showMessage==='function')showMessage('Please drop a JSON file.','error');return;}var reader=new FileReader();reader.onload=function(){try{var parsed=JSON.parse(String(reader.result||''));if(typeof window.loadJsonFromParsed==='function'){loadJsonFromParsed(parsed,true);if(typeof window.showMessage==='function')showMessage('JSON loaded from drop.');}else if(typeof window.loadJsonFile==='function'){loadJsonFile(file);}else{throw new Error('json-loader-missing');}}catch(error){console.error(error);if(typeof window.showMessage==='function')showMessage('The dropped JSON could not be loaded.','error');}};reader.onerror=function(){if(typeof window.showMessage==='function')showMessage('The dropped file could not be read.','error');};reader.readAsText(file,'utf-8');}
function bind(){if(document.documentElement.dataset.jsonDropBound==='1')return;document.documentElement.dataset.jsonDropBound='1';var depth=0;window.addEventListener('dragenter',function(event){if(!event.dataTransfer)return;var files=event.dataTransfer.types&&Array.prototype.indexOf.call(event.dataTransfer.types,'Files')!==-1;if(!files)return;depth++;showOverlay();},true);window.addEventListener('dragover',function(event){if(!event.dataTransfer)return;var files=event.dataTransfer.types&&Array.prototype.indexOf.call(event.dataTransfer.types,'Files')!==-1;if(!files)return;event.preventDefault();event.dataTransfer.dropEffect='copy';showOverlay();},true);window.addEventListener('dragleave',function(event){if(!event.dataTransfer)return;depth=Math.max(0,depth-1);if(depth===0)hideOverlay();},true);window.addEventListener('drop',function(event){if(!event.dataTransfer)return;event.preventDefault();depth=0;hideOverlay();var files=event.dataTransfer.files;if(!files||!files.length)return;loadDroppedFile(files[0]);},true);window.addEventListener('blur',function(){depth=0;hideOverlay();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();


/* delete-confirm-on-top-v101 */
(function(){
if(window.__deleteConfirmOnTopV101)return;window.__deleteConfirmOnTopV101=true;
function q(id){return document.getElementById(id)}
function syncModalLayers(){var del=q('deleteModalOverlay'),edit=q('editCharModalOverlay');if(edit){edit.style.zIndex='12000';edit.style.position='fixed';}
if(del){del.style.zIndex='12050';del.style.position='fixed';}}
function elevateDeleteModalIfOpen(){syncModalLayers();var del=q('deleteModalOverlay');if(!del)return;if(del.classList.contains('show')||del.getAttribute('aria-hidden')==='false'){del.style.zIndex='12050';}}
function wrapOpenDelete(){if(typeof window.openDeleteConfirmModal!=='function'||window.openDeleteConfirmModal.__v101Wrapped)return;var original=window.openDeleteConfirmModal;window.openDeleteConfirmModal=function(){var result=original.apply(this,arguments);setTimeout(elevateDeleteModalIfOpen,0);return result};window.openDeleteConfirmModal.__v101Wrapped=true;}
function install(){syncModalLayers();wrapOpenDelete();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

;(function(){
  if(window.enterEditConfirmPatchV1) return;
  window.enterEditConfirmPatchV1 = true;
  document.addEventListener('keydown', function(e){
    if(!e || e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    var overlay = document.getElementById('editCharModalOverlay');
    if(!overlay || !overlay.classList.contains('show')) return;
    var active = document.activeElement;
    var tag = active && active.tagName ? String(active.tagName).toUpperCase() : '';
    if(tag === 'TEXTAREA') return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    try {
      if(window.directEditCardMode && typeof window.applyDirectEdit === 'function') {
        window.applyDirectEdit();
        return;
      }
      if(window.EC && typeof window.EC.submit === 'function') {
        window.EC.submit();
        return;
      }
      var confirmBtn = document.getElementById('editCharConfirmBtn');
      if(confirmBtn && typeof confirmBtn.click === 'function') confirmBtn.click();
    } catch(err) {
      console.error(err);
    }
  }, true);
})();



/* final-hide-missing-fix-v6 */
(function(){
if(window.__finalHideMissingFixV6)return;window.__finalHideMissingFixV6=true;
function isDividerSafe(item){return !!(window.isDividerItem&&window.isDividerItem(item));}
function isMissingChar(item){return !!(item&&!isDividerSafe(item)&&item.missing);}
function filterRenderable(items){var list=Array.isArray(items)?items:[];if(!window.AppState||!AppState.hideMissingCards)return list;return list.filter(function(item){return isDividerSafe(item)||!isMissingChar(item);});}
function filterReal(items){var list=Array.isArray(items)?items:[];return list.filter(function(item){return !isMissingChar(item);});}
window.shouldExcludeMissingFromOutputs=isMissingChar;
window.filterOutMissingCharacters=filterReal;
window.getRenderableCharactersWithMissingFilter=filterRenderable;
function ensureStyles(){var id='mhp-missing-v6-style';if(document.getElementById(id))return;var style=document.createElement('style');style.id=id;style.textContent=''
+'.character-card.is-missing{opacity:.9;filter:saturate(.58) contrast(.92);}'
+'.character-card.is-missing img{filter:grayscale(.42) brightness(.42) contrast(1.08) sepia(.18);}'
+'.character-card.is-missing .character-info{background:linear-gradient(180deg,rgba(22,22,26,.90),rgba(12,12,15,.96));}'
+'.character-card.is-missing::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(60,16,16,.24));pointer-events:none;z-index:1;}'
+'.character-card .missing-overlay{z-index:5;background:rgba(88,18,18,.94);letter-spacing:.12em;text-transform:uppercase;box-shadow:0 10px 24px rgba(0,0,0,.34);}'
+'#hideMissingLabel.is-active{filter:brightness(1.08);}';document.head.appendChild(style);}
function ensureToggle(){if(typeof window.ensureHideMissingButton==='function')return window.ensureHideMissingButton();return null;}
function applyHideMissingState(){ensureStyles();ensureToggle();var label=document.getElementById('hideMissingLabel');var toggle=document.getElementById('hideMissingToggle');if(toggle)toggle.checked=!!(window.AppState&&AppState.hideMissingCards);if(label){label.textContent=(window.AppState&&AppState.hideMissingCards)?'Hide Missing: On':'Hide Missing: Off';label.classList.toggle('is-active',!!(window.AppState&&AppState.hideMissingCards));}}
if(typeof window.getFilteredCharacters==='function'&&!window.getFilteredCharacters.__hideMissingFinalWrapped){var originalGetFiltered=window.getFilteredCharacters;window.getFilteredCharacters=function(){return filterRenderable(originalGetFiltered.apply(this,arguments));};window.getFilteredCharacters.__hideMissingFinalWrapped=true;}
if(typeof window.renderBoard==='function'&&!window.renderBoard.__hideMissingFinalWrapped){var originalRender=window.renderBoard;window.renderBoard=function(){applyHideMissingState();return originalRender.apply(this,arguments);};window.renderBoard.__hideMissingFinalWrapped=true;}
function bindToggle(){var toggle=document.getElementById('hideMissingToggle');var label=document.getElementById('hideMissingLabel');if(toggle&&!toggle.dataset.hideMissingFinalBound){toggle.dataset.hideMissingFinalBound='1';toggle.addEventListener('change',function(){if(!window.AppState)return;AppState.hideMissingCards=!!toggle.checked;applyHideMissingState();if(typeof window.renderBoard==='function')window.renderBoard();if(typeof window.updateStats==='function')window.updateStats();if(typeof window.saveLocal==='function')window.saveLocal(false);});}
if(label&&!label.dataset.hideMissingFinalBound){label.dataset.hideMissingFinalBound='1';label.addEventListener('click',function(event){event.preventDefault();if(!toggle)return;toggle.checked=!toggle.checked;toggle.dispatchEvent(new Event('change',{bubbles:true}));});}}
function boot(){ensureStyles();ensureToggle();applyHideMissingState();bindToggle();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


/* hide-missing-dom-button-v7 */
(function(){
if(window.__hideMissingDomButtonV7)return;window.__hideMissingDomButtonV7=true;
function q(id){return document.getElementById(id)}
function ensureStyles(){var id='mhp-hide-missing-v7-style';if(q(id))return;var style=document.createElement('style');style.id=id;style.textContent=''
+'#hideMissingContainer{display:inline-flex;align-items:center;margin-left:8px;}'
+'#hideMissingBtn{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:8px 12px;border-radius:12px;cursor:pointer;}'
+'#hideMissingBtn.is-active{box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 8px 22px rgba(60,16,16,.26);}'
+'.character-card.is-missing{opacity:.88;filter:saturate(.52) contrast(.9) brightness(.84);}'
+'.character-card.is-missing img{filter:grayscale(.55) brightness(.34) contrast(1.12) sepia(.22);}'
+'.character-card.is-missing .character-info{background:linear-gradient(180deg,rgba(18,18,22,.94),rgba(8,8,10,.98));}'
+'.character-card.is-missing::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(76,18,18,.30));pointer-events:none;z-index:1;}';document.head.appendChild(style);}
function ensureButton(){var bar=q('multiSelectBar');if(!bar)return null;var container=q('hideMissingContainer');if(!container){container=document.createElement('div');container.id='hideMissingContainer';container.className='multi-select-group';var ref=q('clearSelectedBtn');if(ref&&ref.parentNode)ref.parentNode.insertBefore(container,ref.nextSibling);else bar.appendChild(container);}container.innerHTML='';var btn=document.createElement('button');btn.type='button';btn.id='hideMissingBtn';btn.className='btn btn-ghost multi-select-btn';container.appendChild(btn);return btn;}
function syncButton(){var btn=q('hideMissingBtn')||ensureButton();if(!btn)return null;var on=!!(window.AppState&&AppState.hideMissingCards);btn.textContent=on?'Hide Missing: On':'Hide Missing: Off';btn.title='Show or hide characters marked as missing';btn.setAttribute('aria-pressed',on?'true':'false');btn.classList.toggle('is-active',on);return btn;}
function applyMissingVisibility(){var hide=!!(window.AppState&&AppState.hideMissingCards);var cards=document.querySelectorAll('#board .character-card[data-missing="true"]');Array.prototype.forEach.call(cards,function(card){if(card.classList&&card.classList.contains('divider-card'))return;card.style.display=hide?'none':'';});}
function bindButton(){var old=q('hideMissingBtn')||ensureButton();if(!old)return;var btn=old.cloneNode(true);old.parentNode.replaceChild(btn,old);syncButton();btn.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(!window.AppState)return false;AppState.hideMissingCards=!AppState.hideMissingCards;syncButton();applyMissingVisibility();if(typeof window.updateStats==='function')try{window.updateStats()}catch(e){}if(typeof window.updateOrderOutput==='function')try{window.updateOrderOutput()}catch(e){}if(typeof window.saveLocal==='function')try{window.saveLocal(false)}catch(e){}return false;},true);}
if(typeof window.renderBoard==='function'&&!window.renderBoard.__hideMissingDomV7Wrapped){var originalRender=window.renderBoard;window.renderBoard=function(){var result=originalRender.apply(this,arguments);ensureStyles();ensureButton();bindButton();syncButton();applyMissingVisibility();return result;};window.renderBoard.__hideMissingDomV7Wrapped=true;}
function boot(){ensureStyles();ensureButton();bindButton();syncButton();applyMissingVisibility();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();




;(() => {
  if (window.__editCharEnterSaveV16) return;
  window.__editCharEnterSaveV16 = true;
  document.addEventListener('keydown', function (event) {
    if (!event || event.defaultPrevented || event.key !== 'Enter') return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    var overlay = document.getElementById('editCharModalOverlay');
    if (!overlay || !overlay.classList.contains('show')) return;
    var active = document.activeElement;
    if (!active || !overlay.contains(active)) return;
    var tag = String(active.tagName || '').toUpperCase();
    if (tag !== 'INPUT' && tag !== 'SELECT') return;
    var confirmBtn = document.getElementById('editCharConfirmBtn');
    if (!confirmBtn) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    confirmBtn.click();
  }, true);
})();














/* removed legacy group hotkeys; handled by js/lock-group.js */




(function(){
  if(window.__dividerBulkCleanPatchV3)return;
  window.__dividerBulkCleanPatchV3=true;

  function syncRefs(){
    if(!window.els)window.els={};
    els.dividerModalOverlay=document.getElementById('dividerModalOverlay');
    els.dividerCharacterNotesControl=document.getElementById('dividerCharacterNotesControl');
    els.dividerCharacterNotesList=document.getElementById('dividerCharacterNotesList');
  }

  function getDividerChars(dividerId){
    if(!window.AppState||!Array.isArray(AppState.characters)||!window.isDividerItem||!window.getDividerLevel)return[];
    var list=AppState.characters;
    var dividerIndex=list.findIndex(function(item){return item&&item.id===dividerId&&isDividerItem(item);});
    if(dividerIndex===-1)return[];
    var divider=list[dividerIndex];
    var level=getDividerLevel(divider);
    var chars=[];
    for(var i=dividerIndex+1;i<list.length;i++){
      var item=list[i];
      if(isDividerItem(item)&&getDividerLevel(item)<=level)break;
      if(!isDividerItem(item))chars.push(item);
    }
    return chars;
  }

  function sharedNote(chars){
    if(!chars.length)return '';
    var first=String(chars[0]&&chars[0].note!=null?chars[0].note:'').trim();
    for(var i=1;i<chars.length;i++){
      var next=String(chars[i]&&chars[i].note!=null?chars[i].note:'').trim();
      if(next!==first)return '';
    }
    return first;
  }

  function renderBulkEditor(){
    syncRefs();
    if(!els.dividerCharacterNotesControl||!els.dividerCharacterNotesList)return;
    var state=window.DividerModalState||{};
    var isOpen=!!(els.dividerModalOverlay&&els.dividerModalOverlay.classList.contains('show'));
    var dividerId=state.mode==='edit'?state.itemId:null;
    if(!isOpen||!dividerId){
      els.dividerCharacterNotesControl.style.display='none';
      els.dividerCharacterNotesList.innerHTML='';
      return;
    }
    var chars=getDividerChars(dividerId);
    els.dividerCharacterNotesControl.style.display='block';
    if(!chars.length){
      els.dividerCharacterNotesList.innerHTML='<div class="small-note">There are no characters inside this divider.</div>';
      return;
    }
    var value=sharedNote(chars);
    var mixed=value==='' && chars.some(function(c){return String(c&&c.note!=null?c.note:'').trim()!=='';});
    els.dividerCharacterNotesList.innerHTML=''
      + '<div class="small-note" style="margin-bottom:6px">Applies to '+chars.length+' character'+(chars.length===1?'':'s')+'.'+(mixed?' Mixed notes detected.':'')+'</div>'
      + '<textarea id="dividerBulkNoteInput" class="move-modal-input" rows="2" style="min-height:58px;max-height:96px;resize:vertical;font-weight:600" placeholder="Shared note">'+escapeHtml(value)+'</textarea>';
  }

  function applyBulkNote(){
    var state=window.DividerModalState||{};
    var dividerId=state.mode==='edit'?state.itemId:null;
    var input=document.getElementById('dividerBulkNoteInput');
    if(!dividerId||!input)return 0;
    var chars=getDividerChars(dividerId);
    var nextValue=String(input.value==null?'':input.value).trim();
    var changed=0;
    chars.forEach(function(char){
      var prevValue=String(char&&char.note!=null?char.note:'').trim();
      if(prevValue===nextValue)return;
      char.note=nextValue;
      changed+=1;
    });
    return changed;
  }

  function persist(changed){
    if(!changed)return changed;
    try{if(typeof rebuildPersistentOrderMap==='function')rebuildPersistentOrderMap();}catch(e){}
    try{if(typeof renderBoard==='function')renderBoard();}catch(e){}
    try{if(typeof ensureHideMissingButton==='function')ensureHideMissingButton();}catch(e){}
    try{if(typeof saveLocal==='function')saveLocal(false);}catch(e){}
    return changed;
  }

  document.addEventListener('click',function(event){
    var editBtn=event.target&&event.target.closest?event.target.closest('[data-divider-edit]'):null;
    if(editBtn){
      setTimeout(renderBulkEditor,0);
      setTimeout(renderBulkEditor,60);
      return;
    }
    var saveBtn=event.target&&event.target.closest?event.target.closest('#dividerModalConfirmBtn'):null;
    if(saveBtn){
      var changed=applyBulkNote();
      setTimeout(function(){persist(changed);},0);
    }
  },true);

  document.addEventListener('keydown',function(event){
    if(event.key!=='Enter')return;
    var active=document.activeElement;
    if(active&&(active.id==='dividerNameInput'||active.id==='dividerInsertAfterInput')){
      var changed=applyBulkNote();
      setTimeout(function(){persist(changed);},0);
    }
  },true);

  syncRefs();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){syncRefs();renderBulkEditor();},{once:true});
  else requestAnimationFrame(renderBulkEditor);
})();





(function(){
  if(window.__multiSelectBarDockFixV2)return;
  window.__multiSelectBarDockFixV2=true;

  var STORE='mhp-floating-toolbar-pos-v3';
  var BAR_ID='multiSelectBar';
  var READY_CLASS='toolbar-boot-ready';
  var STYLE_ID='multiSelectBarBootStyle';

  function getBar(){ return document.getElementById(BAR_ID); }

  function ensureBootStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=''
      + '#'+BAR_ID+':not(.'+READY_CLASS+'){opacity:0 !important;visibility:hidden !important;}'
      + '#'+BAR_ID+'.'+READY_CLASS+'{opacity:1 !important;visibility:visible !important;}';
    document.head.appendChild(style);
  }

  function storeBottomCenter(){
    var bar=getBar();
    var w=bar?(bar.offsetWidth||320):320;
    var h=bar?(bar.offsetHeight||52):52;
    var left=Math.max(8,Math.round((window.innerWidth-w)/2));
    var top=Math.max(8,window.innerHeight-h-12);
    try{ localStorage.setItem(STORE, JSON.stringify({mode:'bottom', left:left, top:top})); }catch(e){}
  }

  function placeBottomCenterNow(){
    var bar=getBar();
    if(!bar) return;
    var w=bar.offsetWidth||320;
    var h=bar.offsetHeight||52;
    var left=Math.max(8,Math.round((window.innerWidth-w)/2));
    var top=Math.max(8,window.innerHeight-h-12);
    bar.style.left=left+'px';
    bar.style.top=top+'px';
    bar.style.right='auto';
    bar.style.bottom='auto';
  }

  function revealReady(){
    var bar=getBar();
    if(!bar) return;
    bar.classList.add(READY_CLASS);
  }

  function boot(){
    ensureBootStyle();
    storeBottomCenter();
    setTimeout(placeBottomCenterNow,0);
    setTimeout(placeBottomCenterNow,60);
    setTimeout(revealReady,90);
    setTimeout(revealReady,180);
  }

  ensureBootStyle();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
  window.addEventListener('load', boot);
})();

(function() {
  if (window.__lockGroupBundleRefactoredV1) return;
  window.__lockGroupBundleRefactoredV1 = true;

  function q(id) {
    return document.getElementById(id);
  }

  function norm(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function isDivider(item) {
    return !!(window.isDividerItem && window.isDividerItem(item));
  }

  function getList() {
    return window.AppState && Array.isArray(window.AppState.characters)
      ? window.AppState.characters
      : [];
  }

  function getChar(id) {
    var list = getList();
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && item.id === id && !isDivider(item)) return item;
    }
    return null;
  }

  function createGroupId() {
    return 'lg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function saveQuiet() {
    if (typeof window.saveLocal === 'function') {
      try {
        window.saveLocal(false);
      } catch (error) {}
    }
  }

  function refreshMeta() {
    if (typeof window.updateOwnerFilterOptions === 'function') window.updateOwnerFilterOptions();
    if (typeof window.rebuildPersistentOrderMap === 'function') window.rebuildPersistentOrderMap();
    if (typeof window.updateStats === 'function') window.updateStats();
    if (typeof window.updateSeriesSummary === 'function') window.updateSeriesSummary();
  }

  function normalizeLockFlags(list) {
    var source = Array.isArray(list) ? list : getList();
    source.forEach(function(item) {
      if (!item || isDivider(item)) return;
      item.sortLocked = !!item.sortLocked;
      if (!item.sortLocked) {
        delete item.lockGroupId;
        delete item.lockGroupLabel;
      } else if (item.lockGroupId) {
        item.lockGroupId = String(item.lockGroupId);
      }
    });
  }

  function normalizeGroups(list) {
    var source = Array.isArray(list) ? list : getList();

    for (var i = 0; i < source.length; i++) {
      var item = source[i];
      if (!item || isDivider(item)) continue;

      item.sortLocked = !!item.sortLocked;
      if (!item.sortLocked) {
        delete item.lockGroupId;
        delete item.lockGroupLabel;
        continue;
      }

      if (item.lockGroupId) item.lockGroupId = String(item.lockGroupId);
    }

    var counts = {};
    for (var j = 0; j < source.length; j++) {
      var current = source[j];
      if (current && !isDivider(current) && current.sortLocked && current.lockGroupId) {
        counts[current.lockGroupId] = (counts[current.lockGroupId] || 0) + 1;
      }
    }

    for (var k = 0; k < source.length; k++) {
      var node = source[k];
      if (node && !isDivider(node) && node.lockGroupId && (counts[node.lockGroupId] || 0) < 2) {
        delete node.lockGroupId;
        delete node.lockGroupLabel;
      }
    }

    assignGroupLabelsToCharacters();
  }

  function buildPriorMap(section) {
    var map = {};
    (Array.isArray(section) ? section : []).forEach(function(item, index) {
      if (item && item.id) map[item.id] = index;
    });
    return map;
  }

  function getRange(dividerId) {
    if (typeof window.getDividerSectionRange === 'function') {
      return window.getDividerSectionRange(dividerId);
    }

    var list = getList();
    var start = -1;
    var level = 1;

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (isDivider(item) && item.id === dividerId) {
        start = i + 1;
        level = window.getDividerLevel ? window.getDividerLevel(item) : 1;
        break;
      }
    }

    if (start < 0) return null;

    var end = list.length;
    for (var j = start; j < list.length; j++) {
      var current = list[j];
      if (isDivider(current) && (window.getDividerLevel ? window.getDividerLevel(current) : 1) <= level) {
        end = j;
        break;
      }
    }

    return { start: start, end: end };
  }

  function normalizeSeriesKey(value) {
    return String(value || '')
      .normalize ? String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : String(value || '').toLowerCase().trim();
  }

  function getSeriesAbbreviation(series) {
    var raw = String(series || '').trim();
    if (!raw) return 'MIX';

    var key = normalizeSeriesKey(raw).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    var known = {
      'jujutsu kaisen': 'JJK',
      'blue archive': 'BA',
      'one piece': 'OP',
      'genshin impact': 'GI',
      'wuthering waves': 'WW',
      'chainsaw man': 'CSM',
      'kimetsu no yaiba': 'KNY',
      'boku no hero academia': 'BNHA',
      'my hero academia': 'MHA',
      're zero': 'RZ',
      're zero kara hajimeru isekai seikatsu': 'RZ',
      'sousou no frieren': 'SNF',
      'frieren beyond journeys end': 'FBE',
      'honkai star rail': 'HSR',
      'zenless zone zero': 'ZZZ',
      'fate grand order': 'FGO',
      'fate stay night': 'FSN',
      'neon genesis evangelion': 'NGE',
      'attack on titan': 'AOT',
      'shingeki no kyojin': 'SNK',
      'demon slayer': 'DS'
    };

    if (known[key]) return known[key];

    var words = key.split(' ').filter(Boolean);
    var stop = {
      'the': true,
      'a': true,
      'an': true,
      'and': true,
      'of': true,
      'in': true,
      'on': true,
      'for': true,
      'with': true,
      'de': true,
      'del': true,
      'la': true,
      'el': true,
      'los': true,
      'las': true
    };
    var important = words.filter(function(word) { return !stop[word]; });
    if (!important.length) important = words;

    if (important.length === 1) {
      return important[0].slice(0, 3).toUpperCase() || 'MIX';
    }

    var code = important.slice(0, 4).map(function(word) { return word.charAt(0); }).join('').toUpperCase();
    if (code.length < 2 && key) code = key.slice(0, 3).toUpperCase();
    return code || 'MIX';
  }

  function getDominantGroupSeries(items) {
    var counts = {};
    var firstSeen = {};
    var order = [];
    var total = 0;

    (Array.isArray(items) ? items : []).forEach(function(item) {
      var series = String(item && item.series || '').trim();
      if (!series) return;
      var key = normalizeSeriesKey(series);
      if (!counts[key]) {
        counts[key] = 0;
        firstSeen[key] = series;
        order.push(key);
      }
      counts[key] += 1;
      total += 1;
    });

    if (!order.length) return '';

    var bestKey = order[0];
    for (var i = 1; i < order.length; i++) {
      var key = order[i];
      if (counts[key] > counts[bestKey]) bestKey = key;
    }

    if (order.length > 1 && counts[bestKey] <= total / 2) return '';
    return firstSeen[bestKey] || '';
  }

  function getGroupLabelMap() {
    var list = getList();
    var groups = {};
    var order = [];

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || isDivider(item) || !item.sortLocked || !item.lockGroupId) continue;

      var groupId = String(item.lockGroupId);
      if (!groups[groupId]) {
        groups[groupId] = [];
        order.push(groupId);
      }
      groups[groupId].push(item);
    }

    var map = {};
    var counters = {};

    order.forEach(function(groupId) {
      var members = groups[groupId] || [];
      var series = getDominantGroupSeries(members);
      var prefix = series ? getSeriesAbbreviation(series) : 'MIX';
      counters[prefix] = (counters[prefix] || 0) + 1;

      map[groupId] = {
        label: prefix + '-' + counters[prefix],
        prefix: prefix,
        series: series || 'Mixed series'
      };
    });

    return map;
  }

  function assignGroupLabelsToCharacters() {
    var labelMap = getGroupLabelMap();
    var list = getList();

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || isDivider(item)) continue;

      if (item.sortLocked && item.lockGroupId && labelMap[String(item.lockGroupId)]) {
        item.lockGroupLabel = labelMap[String(item.lockGroupId)].label;
      } else {
        delete item.lockGroupLabel;
      }
    }

    return labelMap;
  }

  function getGroupEdgeState(character, list, index) {
    if (!character || !character.sortLocked || !character.lockGroupId) return 'single';

    var groupId = String(character.lockGroupId);
    var prev = null;
    var next = null;

    for (var i = index - 1; i >= 0; i--) {
      if (list[i] && !isDivider(list[i])) {
        prev = list[i];
        break;
      }
    }

    for (var j = index + 1; j < list.length; j++) {
      if (list[j] && !isDivider(list[j])) {
        next = list[j];
        break;
      }
    }

    var prevSame = !!(prev && prev.sortLocked && String(prev.lockGroupId || '') === groupId);
    var nextSame = !!(next && next.sortLocked && String(next.lockGroupId || '') === groupId);

    if (prevSame && nextSame) return 'middle';
    if (prevSame) return 'end';
    if (nextSame) return 'start';
    return 'single';
  }

  function getNeighborGroupBreaks(character, list, index) {
    if (!character || !character.sortLocked || !character.lockGroupId) {
      return { breakLeft: false, breakRight: false };
    }

    var groupId = String(character.lockGroupId);
    var prev = null;
    var next = null;

    for (var i = index - 1; i >= 0; i--) {
      if (list[i] && !isDivider(list[i])) {
        prev = list[i];
        break;
      }
    }

    for (var j = index + 1; j < list.length; j++) {
      if (list[j] && !isDivider(list[j])) {
        next = list[j];
        break;
      }
    }

    return {
      breakLeft: !!(prev && prev.sortLocked && prev.lockGroupId && String(prev.lockGroupId) !== groupId),
      breakRight: !!(next && next.sortLocked && next.lockGroupId && String(next.lockGroupId) !== groupId)
    };
  }

  function refreshLockIcons() {
    document.querySelectorAll('.sort-lock-btn').forEach(function(btn) {
      var card = btn.closest('.character-card[data-id]');
      var id = card && card.getAttribute ? card.getAttribute('data-id') : null;
      var item = id && window.AppState && Array.isArray(AppState.characters)
        ? AppState.characters.find(function(entry) { return entry && entry.id === id; })
        : null;
      var locked = !!(item && item.sortLocked);

      btn.textContent = locked ? '🔒' : '🔓';
      btn.setAttribute('aria-label', locked ? 'Remove group lock' : 'Toggle group lock');
      btn.title = locked ? 'Remove group lock' : 'Toggle group lock';
      btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
    });
  }

  window.refreshLockIcons = refreshLockIcons;

  function originalSeriesTopRank(section, criteria) {
    var list = Array.isArray(section) ? section.slice() : [];
    if (!list.length) return list;

    var groupsMap = {};
    var order = [];

    list.forEach(function(item) {
      var key = window.normalizeStableText
        ? normalizeStableText(item.series || '')
        : String(item.series || '').trim().toLowerCase();

      if (!groupsMap[key]) {
        groupsMap[key] = {
          key: key,
          label: String(item.series || '').trim() || 'No series',
          topRank: window.getSectionRankValue ? getSectionRankValue(item) : Number(item.globalRank || 0),
          items: []
        };
        order.push(key);
      }

      groupsMap[key].items.push(item);

      var nextRank = window.getSectionRankValue ? getSectionRankValue(item) : Number(item.globalRank || 0);
      if (nextRank < groupsMap[key].topRank) groupsMap[key].topRank = nextRank;
    });

    var innerCriteria = (Array.isArray(criteria) ? criteria : []).filter(function(item) {
      return item && item.field && item.field !== 'seriesTopRank';
    });

    if (!innerCriteria.length) {
      innerCriteria = [
        { field: 'rank', direction: 'asc' },
        { field: 'name', direction: 'asc' }
      ];
    }

    var groups = order.map(function(key) {
      return groupsMap[key];
    });

    groups.forEach(function(group) {
      group.items.sort(function(a, b) {
        return window.compareSectionItems ? compareSectionItems(a, b, innerCriteria) : 0;
      });
    });

    groups.sort(function(a, b) {
      if (a.topRank !== b.topRank) return a.topRank - b.topRank;

      var labelA = window.normalizeStableText
        ? normalizeStableText(a.label || '')
        : String(a.label || '').trim().toLowerCase();
      var labelB = window.normalizeStableText
        ? normalizeStableText(b.label || '')
        : String(b.label || '').trim().toLowerCase();

      if (labelA < labelB) return -1;
      if (labelA > labelB) return 1;
      return 0;
    });

    return groups.reduce(function(acc, group) {
      return acc.concat(group.items);
    }, []);
  }

  function compressGroups(sorted, priorMap) {
    var list = Array.isArray(sorted) ? sorted.slice() : [];
    var counts = {};

    list.forEach(function(item) {
      if (item && item.sortLocked && item.lockGroupId) {
        counts[item.lockGroupId] = (counts[item.lockGroupId] || 0) + 1;
      }
    });

    var orderedIds = [];
    list.forEach(function(item) {
      if (item && item.sortLocked && item.lockGroupId && (counts[item.lockGroupId] || 0) > 1 && orderedIds.indexOf(item.lockGroupId) === -1) {
        orderedIds.push(item.lockGroupId);
      }
    });

    orderedIds.forEach(function(groupId) {
      var firstIndex = -1;
      var before = 0;

      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (item && item.sortLocked && item.lockGroupId === groupId) {
          if (firstIndex === -1) firstIndex = i;
        } else if (firstIndex === -1) {
          before += 1;
        }
      }

      if (firstIndex === -1) return;

      var members = list.filter(function(item) {
        return item && item.sortLocked && item.lockGroupId === groupId;
      });

      members.sort(function(a, b) {
        var pa = priorMap && priorMap[a.id] !== undefined ? priorMap[a.id] : 1e9;
        var pb = priorMap && priorMap[b.id] !== undefined ? priorMap[b.id] : 1e9;
        if (pa !== pb) return pa - pb;
        return 0;
      });

      var filtered = list.filter(function(item) {
        return !(item && item.sortLocked && item.lockGroupId === groupId);
      });

      list = filtered.slice(0, before).concat(members, filtered.slice(before));
    });

    return list;
  }

  function sortSectionWithGroups(section, criteria, priorMap) {
    var normalized = (Array.isArray(criteria) ? criteria : []).filter(function(item) {
      return item && item.field;
    });

    if (!normalized.length) normalized = [{ field: 'name', direction: 'asc' }];

    var sorted = normalized[0] && normalized[0].field === 'seriesTopRank'
      ? originalSeriesTopRank(section, normalized)
      : section.slice().sort(function(a, b) {
          return window.compareSectionItems ? compareSectionItems(a, b, normalized) : 0;
        });

    return compressGroups(sorted, priorMap || buildPriorMap(section));
  }


  window.getLockGroupLabelMap = getGroupLabelMap;
  window.getSeriesAbbreviationForLockGroup = getSeriesAbbreviation;

  function installLockGroupCore() {
    if (window.__lockGroupCoreRefactoredV1) return;
    window.__lockGroupCoreRefactoredV1 = true;

    normalizeGroups(getList());

    window.sortSectionBySeriesTopRank = function(section, criteria) {
      normalizeGroups(Array.isArray(section) ? section : getList());
      var prior = window.__lockGroupPriorMapV93 || buildPriorMap(section);
      return sortSectionWithGroups(section, criteria, prior);
    };

    window.sortDividerSection = function(dividerId, criteria) {
      var range = getRange(dividerId);
      if (!range) return;

      var list = getList();
      normalizeGroups(list);

      var section = list.slice(range.start, range.end).filter(function(item) {
        return !isDivider(item);
      });

      if (!section.length) {
        if (typeof window.showMessage === 'function') {
          showMessage('There are no characters under this divider.', 'error');
        }
        return;
      }

      var normalized = (Array.isArray(criteria) ? criteria : []).filter(function(item) {
        return item && item.field;
      });
      if (!normalized.length) normalized = [{ field: 'name', direction: 'asc' }];

      var prior = buildPriorMap(section);
      if (typeof window.pushPositionUndoSnapshot === 'function') {
        pushPositionUndoSnapshot('section sort');
      }

      window.__lockGroupPriorMapV93 = prior;

      try {
        var sorted = sortSectionWithGroups(section, normalized, prior);
        window.AppState.characters.splice(range.start, range.end - range.start, ...sorted);

        if (typeof window.renumberAllItems === 'function') renumberAllItems();
        if (typeof window.rebuildPersistentOrderMap === 'function') rebuildPersistentOrderMap();
        if (typeof window.refreshChangedZone === 'function') refreshChangedZone();
        if (typeof window.renderBoard === 'function') renderBoard();
        if (typeof window.saveLocal === 'function') saveLocal(false);
        if (typeof window.showMessage === 'function' && typeof window.buildSortCriteriaDescription === 'function') {
          showMessage('Section sorted by ' + buildSortCriteriaDescription(normalized) + '.');
        }

        refreshLockIcons();
        return sorted;
      } finally {
        window.__lockGroupPriorMapV93 = null;
      }
    };

    if (typeof window.renderBoard === 'function' && !window.renderBoard.__lockGroupCoreRefactoredWrapped) {
      var originalRender = window.renderBoard;
      var wrappedRender = function() {
        normalizeGroups(getList());
        var result = originalRender.apply(this, arguments);
        setTimeout(refreshLockIcons, 0);
        return result;
      };
      wrappedRender.__lockGroupCoreRefactoredWrapped = true;
      window.renderBoard = wrappedRender;
    }

    setTimeout(refreshLockIcons, 0);
  }

  function syncCardState(card) {
    if (!card) return;

    var id = card.getAttribute('data-id');
    var list = getList();
    var character = getChar(id);
    var locked = !!(character && character.sortLocked);
    var groupMap = assignGroupLabelsToCharacters();
    var groupInfo = character && character.lockGroupId ? groupMap[String(character.lockGroupId)] || null : null;
    var groupLabel = groupInfo && groupInfo.label ? String(groupInfo.label) : '';
    var index = -1;

    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) {
        index = i;
        break;
      }
    }

    var edge = locked ? getGroupEdgeState(character, list, index) : '';
    var breaks = locked ? getNeighborGroupBreaks(character, list, index) : { breakLeft: false, breakRight: false };

    card.classList.toggle('has-sort-lock', locked);
    card.classList.toggle('group-start', edge === 'start' || edge === 'single');
    card.classList.toggle('group-middle', edge === 'middle');
    card.classList.toggle('group-end', edge === 'end' || edge === 'single');
    card.classList.toggle('group-break-left', breaks.breakLeft);
    card.classList.toggle('group-break-right', breaks.breakRight);

    if (locked && groupLabel) {
      card.setAttribute('data-lock-group', groupLabel);
      card.style.setProperty('--lock-group-label', '"' + groupLabel.replace(/\"/g, '') + '"');
    } else {
      card.removeAttribute('data-lock-group');
      card.style.removeProperty('--lock-group-label');
    }

    var imageWrap = card.querySelector('.image-wrapper');
    var badge = card.querySelector('.lock-group-badge');
    if (!badge && locked) {
      badge = document.createElement('div');
      badge.className = 'lock-group-badge';
      (imageWrap || card).appendChild(badge);
    } else if (badge && imageWrap && badge.parentNode !== imageWrap) {
      imageWrap.appendChild(badge);
    }

    if (badge) {
      if (locked && groupLabel) {
        badge.textContent = groupLabel;
        badge.title = groupInfo && groupInfo.series ? groupInfo.series : groupLabel;
        badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '';
        badge.removeAttribute('title');
        badge.style.display = 'none';
      }
    }

    var btn = card.querySelector('.sort-lock-btn');
    if (btn) btn.remove();
  }

  function ensureCardActions() {
    normalizeLockFlags();

    document.querySelectorAll('#board .divider-card .char-hover-actions').forEach(function(node) {
      node.remove();
    });

    var cards = document.querySelectorAll('#board .character-card[data-id]');
    cards.forEach(function(card) {
      if (card.classList.contains('divider-card')) return;

      if (!card.querySelector('.char-hover-actions')) {
        var wrap = document.createElement('div');
        wrap.className = 'char-hover-actions';
        wrap.innerHTML = '<button type="button" class="char-hover-btn char-edit-btn" aria-label="Edit character" title="Edit character">✎</button>';
        card.appendChild(wrap);
      }

      syncCardState(card);
    });
  }


  function normalizeSphereLevelForEdit(index, value) {
    var max = index < 5 ? 6 : 1;
    var n = parseInt(value, 10);
    if (isNaN(n)) n = 0;
    return Math.max(0, Math.min(max, n));
  }

  function getSphereLevelsForEdit(character) {
    if (window.normalizeSpheres) {
      try { return window.normalizeSpheres(character && character.spheres).levels; } catch (e) {}
    }
    var raw = character && character.spheres;
    var levels = raw && Array.isArray(raw.levels) ? raw.levels.slice(0, 10) : [];
    for (var i = 0; i < 10; i++) levels[i] = normalizeSphereLevelForEdit(i, levels[i]);
    return levels;
  }

  function writeSphereFieldsForEdit(character) {
    var levels = getSphereLevelsForEdit(character);
    for (var i = 1; i <= 10; i++) {
      var sel = q('editCharSphereP' + i);
      if (sel) sel.value = String(levels[i - 1] || 0);
    }
    var cost = q('editCharSpheresCost');
    if (cost) {
      var total = 0;
      if (typeof window.getSphereCostTotal === 'function') {
        total = window.getSphereCostTotal({ spheres: { levels: levels } });
      }
      cost.textContent = 'Total: ' + (typeof window.formatSummaryNumber === 'function' ? window.formatSummaryNumber(total) : String(total || 0)) + ' spheres';
    }
  }

  function readSphereFieldsForEdit() {
    var levels = [];
    var has = false;
    for (var i = 1; i <= 10; i++) {
      var sel = q('editCharSphereP' + i);
      var value = normalizeSphereLevelForEdit(i - 1, sel ? sel.value : 0);
      if (value > 0) has = true;
      levels.push(value);
    }
    return has ? { levels: levels } : null;
  }

  function setPreview(url) {
    var img = q('editCharImagePreview');
    var empty = q('editCharPreviewEmpty');
    if (!img || !empty) return;

    var src = String(url || '').trim();
    if (!src) {
      img.style.display = 'none';
      img.removeAttribute('src');
      empty.style.display = 'flex';
      return;
    }

    img.src = src;
    img.style.display = 'block';
    empty.style.display = 'none';
  }

  function openDirectEdit(id) {
    var character = getChar(id);
    var overlay = q('editCharModalOverlay');
    if (!character || !overlay) return;

    window.__directEditCardMode = { charId: id };
    window.directEditCardMode = window.__directEditCardMode;

    if (window.EditCharState) {
      window.EditCharState.active = true;
      window.EditCharState.charId = id;
    }

    if (q('editCharModalTitle')) q('editCharModalTitle').textContent = 'Edit character';
    if (q('editCharModalSubtitle')) q('editCharModalSubtitle').textContent = 'Edit this character directly from the card.';
    if (q('editCharNameInput')) q('editCharNameInput').value = String(character.name || '');
    if (q('editCharSeriesInput')) q('editCharSeriesInput').value = String(character.series || '');
    if (q('editCharImageInput')) q('editCharImageInput').value = String(character.image || '');
    if (q('editCharKakeraInput')) q('editCharKakeraInput').value = Number(character.kakera) || 0;
    if (q('editCharKeysInput')) q('editCharKeysInput').value = Number(character.keys) || 0;
    if (q('editCharOwnerInput')) q('editCharOwnerInput').value = String(character.owner || '');
    if (q('editCharRouletteInput')) q('editCharRouletteInput').value = String(character.roulette || '');
    if (q('editCharGlobalRankInput')) q('editCharGlobalRankInput').value = Number(character.globalRank) || 0;
    if (q('editCharColorInput')) q('editCharColorInput').value = String(character.color || '#7c3aed') || '#7c3aed';
    if (q('editCharNoteInput')) q('editCharNoteInput').value = String(character.note || '');
    writeSphereFieldsForEdit(character);

    setPreview(character.image || '');
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // v33: avoid forced focus on large boards; it can trigger expensive layout while opening edit.
  }

  function closeDirectEdit() {
    var overlay = q('editCharModalOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden', 'true');
    }

    document.body.classList.remove('modal-open');

    if (window.EditCharState) {
      window.EditCharState.active = false;
      window.EditCharState.charId = null;
    }

    window.__directEditCardMode = null;
    window.directEditCardMode = null;
  }

  function applyDirectEdit() {
    var state = window.__directEditCardMode;
    if (!state) return false;

    var character = getChar(state.charId);
    if (!character) {
      closeDirectEdit();
      return false;
    }

    character.name = String(q('editCharNameInput') && q('editCharNameInput').value || '').trim() || character.name;
    character.series = String(q('editCharSeriesInput') && q('editCharSeriesInput').value || '').trim();
    character.image = String(q('editCharImageInput') && q('editCharImageInput').value || '').trim();
    character.kakera = Math.max(0, parseInt(q('editCharKakeraInput') && q('editCharKakeraInput').value || 0, 10) || 0);
    character.keys = Math.max(0, parseInt(q('editCharKeysInput') && q('editCharKeysInput').value || 0, 10) || 0);
    character.owner = typeof window.normalizeOwnerName === 'function'
      ? window.normalizeOwnerName(q('editCharOwnerInput') && q('editCharOwnerInput').value || 'Unknown')
      : String(q('editCharOwnerInput') && q('editCharOwnerInput').value || 'Unknown').trim() || 'Unknown';
    character.roulette = String(q('editCharRouletteInput') && q('editCharRouletteInput').value || '').trim();
    character.globalRank = Math.max(0, parseInt(q('editCharGlobalRankInput') && q('editCharGlobalRankInput').value || 0, 10) || 0);
    character.color = String(q('editCharColorInput') && q('editCharColorInput').value || '#7c3aed').trim() || '#7c3aed';
    character.note = String(q('editCharNoteInput') && q('editCharNoteInput').value || '').trim();
    var editedSpheres = readSphereFieldsForEdit();
    if (editedSpheres) character.spheres = editedSpheres;
    else delete character.spheres;

    closeDirectEdit();
    refreshMeta();
    if (typeof window.renderBoard === 'function') window.renderBoard();
    saveQuiet();
    if (typeof window.showMessage === 'function') window.showMessage('Character updated.');
    return true;
  }

  window.openDirectEdit = openDirectEdit;
  window.closeDirectEdit = closeDirectEdit;
  window.applyDirectEdit = applyDirectEdit;

  function installHoverLockEditPatch() {
    if (window.__hoverLockEditPatchRefactoredV1) return;
    window.__hoverLockEditPatchRefactoredV1 = true;

    if (typeof window.renderBoard === 'function' && !window.renderBoard.__hoverLockWrapped) {
      var originalRender = window.renderBoard;
      var wrappedRender = function() {
        var result = originalRender.apply(this, arguments);
        setTimeout(ensureCardActions, 0);
        return result;
      };
      wrappedRender.__hoverLockWrapped = true;
      window.renderBoard = wrappedRender;
    }

    ['loadJsonFromParsed', 'loadLocal'].forEach(function(name) {
      if (typeof window[name] !== 'function' || window[name].__hoverLockWrapped) return;

      var original = window[name];
      var wrapped = function() {
        var result = original.apply(this, arguments);
        normalizeLockFlags();
        setTimeout(ensureCardActions, 0);
        return result;
      };
      wrapped.__hoverLockWrapped = true;
      window[name] = wrapped;
    });

    if (typeof window.getSavableState === 'function' && !window.getSavableState.__hoverLockWrapped) {
      var originalGetState = window.getSavableState;
      var wrappedGetState = function() {
        var state = originalGetState.apply(this, arguments);
        var source = {};
        var chars = getList();

        for (var i = 0; i < chars.length; i++) {
          if (chars[i] && chars[i].id) source[chars[i].id] = chars[i];
        }

        if (state && Array.isArray(state.characters)) {
          state.characters = state.characters.map(function(item) {
            if (!item || item.type === 'divider') return item;
            var current = source[item.id];
            if (!current) return item;

            item.sortLocked = !!current.sortLocked;
            if (current.sortLocked && current.lockGroupId) {
              item.lockGroupId = String(current.lockGroupId);
              if (current.lockGroupLabel) item.lockGroupLabel = String(current.lockGroupLabel);
            } else {
              delete item.lockGroupId;
              delete item.lockGroupLabel;
            }
            return item;
          });
        }

        return state;
      };

      wrappedGetState.__hoverLockWrapped = true;
      window.getSavableState = wrappedGetState;
    }

    if (typeof window.compareSectionItems === 'function' && !window.compareSectionItems.__hoverLockWrapped) {
      var originalCompare = window.compareSectionItems;
      var wrappedCompare = function(a, b, criteria) {
        var result = originalCompare.apply(this, arguments);
        var map = window.__sortLockOrderMap;

        if (!map || !a || !b || !a.id || !b.id || !a.sortLocked || !b.sortLocked) return result;

        var previousOrder = (map[a.id] ?? 0) - (map[b.id] ?? 0);
        if (!previousOrder) return result;

        var primary = Array.isArray(criteria) && criteria[0] && criteria[0].field ? String(criteria[0].field) : '';
        var sameSeries = norm(a.series) === norm(b.series);

        if (primary === 'seriesTopRank' && sameSeries) return previousOrder;
        if (result === 0) return previousOrder;
        return result;
      };

      wrappedCompare.__hoverLockWrapped = true;
      window.compareSectionItems = wrappedCompare;
    }

    if (typeof window.sortSectionBySeriesTopRank === 'function' && !window.sortSectionBySeriesTopRank.__hoverLockWrapped) {
      var originalSeries = window.sortSectionBySeriesTopRank;
      var wrappedSeries = function(section, criteria) {
        var list = Array.isArray(section) ? section.slice() : [];
        var map = window.__sortLockOrderMap || {};
        var locked = list.filter(function(item) {
          return item && item.sortLocked && !isDivider(item);
        });

        if (!locked.length) return originalSeries.apply(this, arguments);

        var lockedIds = {};
        locked.forEach(function(item) {
          lockedIds[item.id] = true;
        });

        var sorted = originalSeries.apply(this, arguments) || [];
        var lockedSorted = sorted.filter(function(item) {
          return item && lockedIds[item.id];
        });

        lockedSorted.sort(function(a, b) {
          return (map[a.id] ?? 0) - (map[b.id] ?? 0);
        });

        var cursor = 0;
        return sorted.map(function(item) {
          if (item && lockedIds[item.id]) return lockedSorted[cursor++];
          return item;
        });
      };

      wrappedSeries.__hoverLockWrapped = true;
      window.sortSectionBySeriesTopRank = wrappedSeries;
    }

    if (typeof window.sortDividerSection === 'function' && !window.sortDividerSection.__hoverLockWrapped) {
      var originalSort = window.sortDividerSection;
      var wrappedSort = function(dividerId, criteria) {
        window.__sortLockOrderMap = null;

        try {
          if (typeof window.getDividerSectionRange === 'function' && window.AppState && Array.isArray(window.AppState.characters)) {
            var range = window.getDividerSectionRange(dividerId);
            if (range) {
              var section = window.AppState.characters.slice(range.start, range.end).filter(function(item) {
                return !isDivider(item);
              });
              var map = {};
              for (var i = 0; i < section.length; i++) {
                if (section[i] && section[i].id) map[section[i].id] = i;
              }
              window.__sortLockOrderMap = map;
            }
          }

          return originalSort.apply(this, arguments);
        } finally {
          window.__sortLockOrderMap = null;
          setTimeout(ensureCardActions, 0);
        }
      };

      wrappedSort.__hoverLockWrapped = true;
      window.sortDividerSection = wrappedSort;
    }

    document.addEventListener('pointerdown', function(event) {
      if (event.target && event.target.closest && event.target.closest('.char-hover-actions')) {
        event.stopPropagation();
      }
    }, true);

    document.addEventListener('click', function(event) {
      var editBtn = event.target && event.target.closest ? event.target.closest('.char-edit-btn') : null;
      if (!editBtn) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      var editCard = editBtn.closest('.character-card');
      if (editCard) openDirectEdit(editCard.getAttribute('data-id'));
    }, true);

    var confirmBtn = q('editCharConfirmBtn');
    if (confirmBtn && !confirmBtn.__directEditBound) {
      confirmBtn.__directEditBound = true;
      confirmBtn.addEventListener('click', function(event) {
        if (!window.__directEditCardMode) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        applyDirectEdit();
      }, true);
    }

    var cancelBtn = q('editCharCancelBtn');
    if (cancelBtn && !cancelBtn.__directEditBound) {
      cancelBtn.__directEditBound = true;
      cancelBtn.addEventListener('click', function(event) {
        if (!window.__directEditCardMode) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDirectEdit();
      }, true);
    }

    var overlay = q('editCharModalOverlay');
    if (overlay && !overlay.__directEditBound) {
      overlay.__directEditBound = true;
      overlay.addEventListener('click', function(event) {
        if (!window.__directEditCardMode) return;
        if (event.target === overlay) {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeDirectEdit();
        }
      }, true);
    }

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && window.__directEditCardMode) {
        event.preventDefault();
        closeDirectEdit();
      }
    }, true);

    var imageInput = q('editCharImageInput');
    if (imageInput && !imageInput.__directEditBound) {
      imageInput.__directEditBound = true;
      imageInput.addEventListener('input', function() {
        if (window.__directEditCardMode) setPreview(imageInput.value);
      });
    }

    normalizeLockFlags();
    setTimeout(ensureCardActions, 0);
    window.addEventListener('load', function() {
      normalizeLockFlags();
      setTimeout(ensureCardActions, 0);
    });

    if (typeof window.renderBoard === 'function' && !window.renderBoard.__lockCardActionsWrapped) {
      var originalRenderForActions = window.renderBoard;
      window.renderBoard = function() {
        var result = originalRenderForActions.apply(this, arguments);
        requestAnimationFrame(ensureCardActions);
        return result;
      };
      window.renderBoard.__lockCardActionsWrapped = true;
    }
  }

  function installMultiSelectLockGroup() {
    if (window.__multiSelectLockGroupRefactoredV1) return;
    window.__multiSelectLockGroupRefactoredV1 = true;

    function getSelectedIds() {
      return window.AppState && Array.isArray(window.AppState.selectedMoveIds)
        ? window.AppState.selectedMoveIds.slice()
        : [];
    }

    function getSelectedChars() {
      var ids = getSelectedIds();
      var set = {};
      var list = getList();
      var out = [];

      ids.forEach(function(id) {
        set[id] = true;
      });

      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (item && !isDivider(item) && set[item.id]) out.push(item);
      }

      return out;
    }

    function ensureBtn() {
      var bar = q('multiSelectBar');
      if (!bar) return null;

      var btn = q('lockGroupSelectedBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'lockGroupSelectedBtn';
        btn.type = 'button';
        btn.className = 'btn btn-ghost multi-select-btn';
        btn.hidden = true;
        btn.disabled = true;
        btn.title = 'Lock selected group';
        btn.textContent = '🔓 Group (0)';

        var ref = q('moveSelectedBtn');
        if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref.nextSibling);
        else bar.appendChild(btn);
      }

      if (!btn.dataset.groupBound) {
        btn.dataset.groupBound = '1';
        btn.addEventListener('click', function() {
          applyToggle();
        });
      }

      return btn;
    }

    function sameGroup(chars) {
      if (!chars.length) return '';
      var first = chars[0] && chars[0].lockGroupId ? String(chars[0].lockGroupId) : '';
      if (!first) return '';

      for (var i = 1; i < chars.length; i++) {
        if (String(chars[i].lockGroupId || '') !== first) return '';
      }

      return first;
    }

    function isUnlockMode(chars) {
      if (chars.length < 2) return false;
      var groupId = sameGroup(chars);
      if (!groupId) return false;

      for (var i = 0; i < chars.length; i++) {
        if (!chars[i].sortLocked) return false;
      }

      return true;
    }

    function refreshBtn() {
      var btn = ensureBtn();
      if (!btn) return;

      var multi = !!(window.AppState && window.AppState.multiSelectMode);
      var chars = getSelectedChars();
      var count = chars.length;
      var unlock = isUnlockMode(chars);

      btn.hidden = !multi;
      btn.disabled = count < 2;
      btn.textContent = (unlock ? '🔒' : '🔓') + ' Group (' + count + ')';
      btn.title = unlock ? 'Unlock selected group' : 'Lock selected as group';
      btn.setAttribute('aria-label', unlock ? 'Unlock selected group' : 'Lock selected as group');
      btn.classList.toggle('is-active', unlock);
    }

    function applyToggle() {
      var chars = getSelectedChars();
      if (chars.length < 2) return;

      var unlock = isUnlockMode(chars);
      if (unlock) {
        chars.forEach(function(item) {
          item.sortLocked = false;
          delete item.lockGroupId;
          delete item.lockGroupLabel;
        });
        if (typeof window.showMessage === 'function') showMessage('Selected group unlocked.');
      } else {
        var unlockedChars = chars.filter(function(item) {
          return !(item && item.sortLocked && item.lockGroupId);
        });
        var ignoredLockedCount = chars.length - unlockedChars.length;

        if (unlockedChars.length < 2) {
          if (typeof window.showMessage === 'function') {
            showMessage('Select at least 2 unlocked characters to create a new group.', 'error');
          }
          return;
        }

        var groupId = createGroupId();
        unlockedChars.forEach(function(item) {
          item.sortLocked = true;
          item.lockGroupId = groupId;
          delete item.lockGroupLabel;
        });
        assignGroupLabelsToCharacters();
        var labelMap = getGroupLabelMap();
        var createdLabel = labelMap[groupId] && labelMap[groupId].label ? labelMap[groupId].label : 'group';
        if (typeof window.showMessage === 'function') {
          var suffix = ignoredLockedCount ? ' Existing locked cards were ignored.' : '';
          showMessage('Selected characters grouped as ' + createdLabel + '.' + suffix);
        }
      }

      if (window.AppState && Array.isArray(window.AppState.selectedMoveIds)) {
        window.AppState.selectedMoveIds = [];
      }

      if (typeof window.renumberAllItems === 'function') try { window.renumberAllItems(); } catch (error) {}
      if (typeof window.rebuildPersistentOrderMap === 'function') try { window.rebuildPersistentOrderMap(); } catch (error) {}
      if (typeof window.refreshChangedZone === 'function') try { window.refreshChangedZone(); } catch (error) {}
      if (typeof window.renderBoard === 'function') try { window.renderBoard(); } catch (error) {}
      if (typeof window.saveLocal === 'function') try { window.saveLocal(false); } catch (error) {}
      if (typeof window.updateStats === 'function') try { window.updateStats(); } catch (error) {}
      if (typeof window.updateSeriesSummary === 'function') try { window.updateSeriesSummary(); } catch (error) {}

      refreshBtn();
      if (typeof window.refreshLockIcons === 'function') {
        try { window.refreshLockIcons(); } catch (error) {}
      }
    }

    if (typeof window.renderBoard === 'function' && !window.renderBoard.__multiSelectLockGroupWrapped) {
      var originalRender = window.renderBoard;
      var wrappedRender = function() {
        var result = originalRender.apply(this, arguments);
        setTimeout(refreshBtn, 0);
        return result;
      };
      wrappedRender.__multiSelectLockGroupWrapped = true;
      window.renderBoard = wrappedRender;
    }

    ensureBtn();
    refreshBtn();

    function scheduleRefreshBtn() {
      if (scheduleRefreshBtn._raf) cancelAnimationFrame(scheduleRefreshBtn._raf);
      scheduleRefreshBtn._raf = requestAnimationFrame(function() {
        scheduleRefreshBtn._raf = 0;
        refreshBtn();
      });
    }

    if (!window.__lockGroupRefreshEventBoundV32) {
      window.__lockGroupRefreshEventBoundV32 = true;
      document.addEventListener('click', scheduleRefreshBtn, true);
      document.addEventListener('change', scheduleRefreshBtn, true);
    }
  }

  function installLockGroupOverlayPatch() {
    if (window.__lockGroupOverlayPatchRefactoredV1) return;
    window.__lockGroupOverlayPatchRefactoredV1 = true;

    function clearOutlines(board) {
      if (!board) return;
      Array.prototype.slice.call(board.querySelectorAll('.lock-group-outline')).forEach(function(node) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
    }

    function buildRows(cards) {
      var rows = [];
      cards.forEach(function(entry) {
        var top = entry.rect.top;
        var row = null;

        for (var i = 0; i < rows.length; i++) {
          if (Math.abs(rows[i].top - top) < 12) {
            row = rows[i];
            break;
          }
        }

        if (!row) {
          row = { top: top, items: [] };
          rows.push(row);
        }

        row.items.push(entry);
      });

      rows.sort(function(a, b) {
        return a.top - b.top;
      });
      return rows;
    }

    function renderOutlines() {
      var board = q('board');
      if (!board) return;

      board.classList.add('lock-group-outline-mode');
      if (window.getComputedStyle(board).position === 'static') {
        board.style.position = 'relative';
      }

      clearOutlines(board);

      var cards = Array.prototype.slice.call(board.querySelectorAll('.character-card[data-id]')).filter(function(card) {
        return !card.classList.contains('divider-card');
      });
      if (!cards.length) return;

      var sampleCard = cards[0];
      var sampleStyle = sampleCard ? window.getComputedStyle(sampleCard) : null;
      var cardRadius = sampleStyle ? parseFloat(sampleStyle.borderTopLeftRadius) || 16 : 16;
      var cardBorder = sampleStyle ? parseFloat(sampleStyle.borderTopWidth) || 4 : 4;
      var pad = Math.max(2, Math.round(cardBorder * 0.75));
      var map = {};

      cards.forEach(function(card) {
        var id = card.getAttribute('data-id');
        var character = getChar(id);
        if (!character || !character.sortLocked || !character.lockGroupId) return;

        var groupId = String(character.lockGroupId);
        if (!map[groupId]) map[groupId] = [];

        var localLeft = card.offsetLeft;
        var localTop = card.offsetTop;
        var localRight = localLeft + card.offsetWidth;
        var localBottom = localTop + card.offsetHeight;

        map[groupId].push({
          card: card,
          rect: {
            left: localLeft,
            right: localRight,
            top: localTop,
            bottom: localBottom
          }
        });
      });

      Object.keys(map).forEach(function(groupId) {
        var rows = buildRows(map[groupId]);

        rows.forEach(function(row, rowIndex) {
          var left = row.items[0].rect.left;
          var right = row.items[0].rect.right;
          var top = row.items[0].rect.top;
          var bottom = row.items[0].rect.bottom;

          row.items.forEach(function(entry) {
            if (entry.rect.left < left) left = entry.rect.left;
            if (entry.rect.right > right) right = entry.rect.right;
            if (entry.rect.top < top) top = entry.rect.top;
            if (entry.rect.bottom > bottom) bottom = entry.rect.bottom;
          });

          var outline = document.createElement('div');
          var isSingle = rows.length === 1;
          var isFirst = rowIndex === 0;
          var isLast = rowIndex === rows.length - 1;
          var leftPx = Math.floor(left - pad);
          var topPx = Math.floor(top - pad);
          var rightPx = Math.ceil(right + pad);
          var bottomPx = Math.ceil(bottom + pad);

          outline.className = 'lock-group-outline' + (
            isSingle ? ' is-single' : isFirst ? ' is-start' : isLast ? ' is-end' : ' is-middle'
          );
          outline.setAttribute('data-lock-group-id', groupId);
          outline.style.left = leftPx + 'px';
          outline.style.top = topPx + 'px';
          outline.style.width = (rightPx - leftPx) + 'px';
          outline.style.height = (bottomPx - topPx) + 'px';
          outline.style.setProperty('--outline-radius', Math.max(10, Math.round(cardRadius + cardBorder / 2)) + 'px');
          outline.style.setProperty('--outline-radius-tight', Math.max(8, Math.round(cardRadius - 2)) + 'px');
          board.appendChild(outline);
        });
      });
    }

    function schedule() {
      clearTimeout(window.__lockGroupOutlineTimer);
      window.__lockGroupOutlineTimer = setTimeout(renderOutlines, 0);
    }

    if (typeof window.renderBoard === 'function' && !window.renderBoard.__lockGroupOverlayPatched) {
      var originalRender = window.renderBoard;
      var wrappedRender = function() {
        var result = originalRender.apply(this, arguments);
        schedule();
        return result;
      };
      wrappedRender.__lockGroupOverlayPatched = true;
      window.renderBoard = wrappedRender;
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
    else schedule();
  }

  installLockGroupCore();
  installHoverLockEditPatch();
  installMultiSelectLockGroup();
  installLockGroupOverlayPatch();
})();

/* stable-summary-v30: one final source for Waifus/Husbandos/Both */
(function(){
  if(window.__stableSummaryV30) return;
  window.__stableSummaryV30 = true;

  function isDivider(item){ return !!(item && item.type === 'divider'); }
  function realUnique(list){
    var out = [];
    var seen = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(item, index){
      if(!item || isDivider(item)) return;
      var id = item.id ? String(item.id) : ('idx-' + index + '-' + String(item.name || ''));
      if(seen[id]) return;
      seen[id] = true;
      out.push(item);
    });
    return out;
  }
  function tokens(char){
    return String(char && char.roulette || '').toLowerCase().match(/\$(?:wa|ha|wg|hg)\b/g) || [];
  }
  function has(list, token){ return list.indexOf(token) !== -1; }
  function sphereCost(char){
    if(typeof window.getSphereCostTotal !== 'function') return 0;
    return Number(window.getSphereCostTotal(char)) || 0;
  }
  function fmt(value){
    if(typeof window.formatSummaryNumber === 'function') return window.formatSummaryNumber(Number(value) || 0);
    return String(Number(value) || 0);
  }
  function buildSummary(){
    var all = realUnique(window.AppState && AppState.characters);
    var visibleBase = [];
    try { visibleBase = typeof window.getFilteredCharacters === 'function' ? window.getFilteredCharacters() : all; } catch(e) { visibleBase = all; }
    var visible = realUnique(visibleBase);

    if(window.AppState && AppState.hideMissingCards && typeof window.filterOutMissingCharacters === 'function'){
      all = realUnique(window.filterOutMissingCharacters(all));
      visible = realUnique(window.filterOutMissingCharacters(visible));
    }

    var totalKakera = 0;
    var totalKeys = 0;
    var visibleKakera = 0;
    var visibleKeys = 0;
    var totalSpheres = 0;
    var counts = {wa:0, ha:0, wg:0, hg:0};
    var gender = {waifus:0, husbandos:0, both:0, unknown:0};
    var gameBoth = 0;

    all.forEach(function(char){
      totalKakera += Number(char && char.kakera) || 0;
      totalKeys += Number(char && char.keys) || 0;
      totalSpheres += sphereCost(char);
      var t = tokens(char);
      var hasWa = has(t, '$wa');
      var hasHa = has(t, '$ha');
      var hasWg = has(t, '$wg');
      var hasHg = has(t, '$hg');
      var female = hasWa || hasWg;
      var male = hasHa || hasHg;
      if(hasWa) counts.wa += 1;
      if(hasHa) counts.ha += 1;
      if(hasWg) counts.wg += 1;
      if(hasHg) counts.hg += 1;
      if(hasWg && hasHg) gameBoth += 1;
      if(female && male) gender.both += 1;
      else if(female) gender.waifus += 1;
      else if(male) gender.husbandos += 1;
      else gender.unknown += 1;
    });

    visible.forEach(function(char){
      visibleKakera += Number(char && char.kakera) || 0;
      visibleKeys += Number(char && char.keys) || 0;
    });

    return {
      all: all,
      visible: visible,
      totalKakera: totalKakera,
      totalKeys: totalKeys,
      visibleKakera: visibleKakera,
      visibleKeys: visibleKeys,
      totalSpheres: totalSpheres,
      counts: counts,
      gender: gender,
      gameBoth: gameBoth
    };
  }
  function renderSummary(summary){
    if(!window.els) return;
    if(els.totalCount) els.totalCount.textContent = fmt(summary.all.length);
    if(els.visibleCount) els.visibleCount.textContent = fmt(summary.visible.length);
    if(els.totalKakera) els.totalKakera.textContent = fmt(summary.totalKakera);
    if(els.totalKeys) els.totalKeys.textContent = fmt(summary.totalKeys);
    var totalSpheresEl = els.totalSpheres || document.getElementById('totalSpheres');
    if(totalSpheresEl) totalSpheresEl.textContent = fmt(summary.totalSpheres);
    if(els.haremName) els.haremName.textContent = String((window.AppState && AppState.haremName) || '-').replace(/\s+/g, ' ').trim();
    if(els.haremValue) els.haremValue.textContent = fmt(summary.totalKakera);
    if(els.wahaCount) els.wahaCount.textContent = fmt(summary.gender.waifus) + ' / ' + fmt(summary.gender.husbandos) + ' / ' + fmt(summary.gender.both);
    if(els.wghgCount) els.wghgCount.textContent = fmt(summary.counts.wg) + ' / ' + fmt(summary.counts.hg) + ' / ' + fmt(summary.gameBoth);
  }
  function stableUpdateStats(){
    if(!window.AppState) return;
    var summary = buildSummary();
    AppState.totalValue = summary.totalKakera;
    AppState.counts = summary.counts;
    renderSummary(summary);
    try { if(typeof window.fitHaremName === 'function') window.fitHaremName(); } catch(e) {}
    try { if(typeof window.updateSeriesSummary === 'function') window.updateSeriesSummary(); } catch(e) {}
    try { if(typeof window.updateOrderOutput === 'function') window.updateOrderOutput(); } catch(e) {}
  }
  function install(){
    window.updateStats = stableUpdateStats;
    try { updateStats = stableUpdateStats; } catch(e) {}
    window.KounoSummaryV13 = window.KounoSummaryV13 || {};
    window.KounoSummaryV13.update = stableUpdateStats;
    window.KounoSummaryV13.buildSummary = buildSummary;
    window.KounoSummaryV13.getGenderTotals = function(list){ return buildSummary().gender; };
    try { stableUpdateStats(); } catch(e) {}
  }
  install();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 0); }, {once:true});
  else setTimeout(install, 0);
  window.addEventListener('load', function(){ setTimeout(install, 0); }, {once:true});
})();

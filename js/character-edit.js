(function() {
  if (window.__characterEditModuleLoaded) return;
  window.__characterEditModuleLoaded = true;

  /* Estado */

  window.EditCharState = window.EditCharState || { active: false, charId: null };
  var EditCharState = window.EditCharState;

  /* Modal y bindings */

  (function initEditCharBindings() {
    if (window.__editCharBindingsRestoredV53) return;
    window.__editCharBindingsRestoredV53 = true;

    function $(id) {
      return document.getElementById(id);
    }

    function safeText(value) {
      return String(value == null ? '' : value);
    }

    function safeNum(value) {
      var parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    }

    function normalizeSphereLevels(value) {
      if (typeof window.normalizeSpheres === 'function') {
        return window.normalizeSpheres(value).levels;
      }
      var levels = value && Array.isArray(value.levels) ? value.levels.slice(0, 10) : [];
      for (var i = 0; i < 10; i++) {
        var max = i < 5 ? 6 : 1;
        var num = parseInt(levels[i], 10);
        if (isNaN(num)) num = 0;
        levels[i] = Math.max(0, Math.min(max, num));
      }
      return levels;
    }

    function setSphereFields(character) {
      var levels = normalizeSphereLevels(character && character.spheres);
      for (var i = 1; i <= 10; i++) {
        var input = $('editCharSphereP' + i);
        if (input) input.value = String(levels[i - 1] || 0);
      }
      updateSphereCost();
    }

    function readSphereFields() {
      var levels = [];
      var has = false;
      for (var i = 1; i <= 10; i++) {
        var input = $('editCharSphereP' + i);
        var max = i <= 5 ? 6 : 1;
        var value = input ? parseInt(input.value, 10) : 0;
        if (isNaN(value)) value = 0;
        value = Math.max(0, Math.min(max, value));
        if (value > 0) has = true;
        levels.push(value);
      }
      return has ? { levels: levels } : null;
    }

    function updateSphereCost() {
      var el = $('editCharSpheresCost');
      if (!el) return;
      var spheres = readSphereFields();
      var total = 0;
      if (spheres && typeof window.getSphereCostTotal === 'function') {
        total = window.getSphereCostTotal({ spheres: spheres });
      }
      var formatted = typeof window.formatSummaryNumber === 'function' ? window.formatSummaryNumber(total) : String(total || 0);
      el.textContent = 'Total: ' + formatted + ' spheres';
    }

    function bindSphereInputs() {
      for (var i = 1; i <= 10; i++) {
        var input = $('editCharSphereP' + i);
        if (!input || input.dataset.sphereCostBound === '1') continue;
        input.dataset.sphereCostBound = '1';
        input.addEventListener('change', updateSphereCost);
      }
      updateSphereCost();
    }

    function bindSphereClear() {
      var btn = $('editCharSpheresClearBtn');
      if (!btn || btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function(event) {
        event.preventDefault();
        for (var i = 1; i <= 10; i++) {
          var input = $('editCharSphereP' + i);
          if (input) input.value = '0';
        }
        updateSphereCost();
      });
    }

    function updatePreview(url) {
      var img = $('editCharImagePreview');
      var empty = $('editCharPreviewEmpty');
      if (!img || !empty) return;

      var normalized = safeText(url).trim();
      if (normalized) {
        img.src = normalized;
        img.style.display = '';
        empty.style.display = 'none';
        return;
      }

      img.src = 'about:blank';
      img.style.display = 'none';
      empty.style.display = '';
    }

    function clearSelection() {
      document.querySelectorAll('.character-card.edit-selected').forEach(function(node) {
        node.classList.remove('edit-selected');
      });
    }

    function refreshButton() {
      var btn = $('editCharBtn');
      if (!btn || !window.EditCharState) return;

      btn.classList.toggle('btn-primary', !!EditCharState.active);
      btn.classList.toggle('btn-ghost', !EditCharState.active);
      btn.textContent = EditCharState.active ? '✎ Editing…' : '✎ Edit';
    }

    function closeModal() {
      var overlay = $('editCharModalOverlay');
      var board = $('board');

      if (overlay) {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
      }

      if (board) board.classList.remove('edit-char-mode');
      clearSelection();

      EditCharState.active = false;
      EditCharState.charId = null;
      refreshButton();
    }

    function findCharacter(charId) {
      var list = window.AppState && Array.isArray(AppState.characters) ? AppState.characters : [];
      return list.find(function(item) {
        return item && item.id === charId;
      }) || null;
    }

    function markCardSelected(charId) {
      clearSelection();

      var selector = '.character-card[data-id="' + String(charId)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"') + '"]';
      var card = document.querySelector(selector);
      if (card) card.classList.add('edit-selected');
    }

    function fillFallbackFields(character) {
      if (!character) return;

      var fieldMap = {
        editCharNameInput: 'name',
        editCharSeriesInput: 'series',
        editCharImageInput: 'image',
        editCharKakeraInput: 'kakera',
        editCharKeysInput: 'keys',
        editCharOwnerInput: 'owner',
        editCharRouletteInput: 'roulette',
        editCharGlobalRankInput: 'globalRank',
        editCharColorInput: 'color',
        editCharNoteInput: 'note'
      };

      Object.keys(fieldMap).forEach(function(id) {
        var input = $(id);
        if (!input) return;
        var key = fieldMap[id];
        input.value = character[key] == null ? '' : character[key];
      });

      updatePreview(character.image || '');
      setSphereFields(character);
      bindSphereInputs();
      bindSphereClear();

      var overlay = $('editCharModalOverlay');
      if (overlay) {
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
      }
    }

    function openForCard(charId) {
      if (!charId) return;

      EditCharState.active = true;
      EditCharState.charId = charId;
      refreshButton();

      var board = $('board');
      if (board) board.classList.add('edit-char-mode');

      markCardSelected(charId);

      if (typeof window.openEditCharModal === 'function') {
        try {
          window.openEditCharModal(charId);
          updatePreview($('editCharImageInput') && $('editCharImageInput').value);
          setSphereFields(findCharacter(charId));
          bindSphereInputs();
          bindSphereClear();
          return;
        } catch (error) {}
      }

      fillFallbackFields(findCharacter(charId));
    }

    function submitManual() {
      if (window.EC && typeof window.EC.submit === 'function') {
        window.EC.submit();
        return;
      }

      if (!EditCharState || !EditCharState.charId) return;

      var character = findCharacter(EditCharState.charId);
      if (!character) return;

      character.name = safeText($('editCharNameInput') && $('editCharNameInput').value).trim();
      character.series = safeText($('editCharSeriesInput') && $('editCharSeriesInput').value).trim();
      character.image = safeText($('editCharImageInput') && $('editCharImageInput').value).trim();
      character.kakera = safeNum($('editCharKakeraInput') && $('editCharKakeraInput').value);
      character.keys = safeNum($('editCharKeysInput') && $('editCharKeysInput').value);
      character.owner = safeText($('editCharOwnerInput') && $('editCharOwnerInput').value).trim();
      character.roulette = safeText($('editCharRouletteInput') && $('editCharRouletteInput').value).trim();
      character.globalRank = safeNum($('editCharGlobalRankInput') && $('editCharGlobalRankInput').value);
      character.color = safeText($('editCharColorInput') && $('editCharColorInput').value).trim() || character.color || '#7c3aed';
      character.note = safeText($('editCharNoteInput') && $('editCharNoteInput').value).trim();
      var spheres = readSphereFields();
      if (spheres) character.spheres = spheres;
      else delete character.spheres;

      if (typeof window.renderBoard === 'function') {
        try {
          window.renderBoard();
        } catch (error) {}
      }

      if (typeof window.updateOrderOutput === 'function') {
        try {
          window.updateOrderOutput();
        } catch (error) {}
      }

      if (typeof window.showMessage === 'function') {
        try {
          window.showMessage('Character updated.');
        } catch (error) {}
      }

      closeModal();
    }

    function bind() {
      var btn = $('editCharBtn');
      var cancel = $('editCharCancelBtn');
      var confirm = $('editCharConfirmBtn');
      var image = $('editCharImageInput');
      var overlay = $('editCharModalOverlay');
      var board = $('board');

      if (btn && !btn.dataset.editRestoreBound) {
        btn.dataset.editRestoreBound = '1';
        btn.addEventListener('click', function() {
          if (EditCharState.active) {
            closeModal();
            return;
          }

          EditCharState.active = true;
          if (board) board.classList.add('edit-char-mode');
          refreshButton();

          if (typeof window.showMessage === 'function') {
            try {
              window.showMessage('Click a character to edit it.');
            } catch (error) {}
          }
        });
      }

      if (cancel && !cancel.dataset.editRestoreBound) {
        cancel.dataset.editRestoreBound = '1';
        cancel.addEventListener('click', function() {
          if (window.EC && typeof window.EC.close === 'function') {
            window.EC.close();
          } else {
            closeModal();
          }
        });
      }

      if (confirm && !confirm.dataset.editRestoreBound) {
        confirm.dataset.editRestoreBound = '1';
        confirm.addEventListener('click', function() {
          submitManual();
        });
      }

      if (image && !image.dataset.editRestoreBound) {
        image.dataset.editRestoreBound = '1';
        image.addEventListener('input', function() {
          updatePreview(image.value);
        });
      }

      if (overlay && !overlay.dataset.editRestoreBound) {
        overlay.dataset.editRestoreBound = '1';
        overlay.addEventListener('click', function(event) {
          if (event.target === overlay) closeModal();
        });
      }

      if (!document.body.dataset.editRestoreKeyBound) {
        document.body.dataset.editRestoreKeyBound = '1';
        document.addEventListener('keydown', function(event) {
          if (event.key === 'Escape' && EditCharState.active) {
            closeModal();
          }
        });
      }

      if (board && !board.dataset.editRestoreBound) {
        board.dataset.editRestoreBound = '1';
        board.addEventListener('click', function(event) {
          if (!EditCharState.active) return;

          var card = event.target && event.target.closest
            ? event.target.closest('.character-card[data-id]')
            : null;

          if (!card || card.classList.contains('divider-card')) return;

          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();

          openForCard(card.getAttribute('data-id'));
        }, true);
      }

      refreshButton();
      bindSphereInputs();
      updatePreview(image && image.value);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bind);
    } else {
      bind();
    }
  })();

  (function initQaConsolidatedPass() {
    if (window.__qaConsolidatedPassV60) return;
    window.__qaConsolidatedPassV60 = true;

    var STORE = 'mhp-floating-toolbar-pos-v3';
    var BAR_ID = 'multiSelectBar';
    var BTN_ID = 'multiSelectToggleBtn';
    var EDGE = 8;
    var BOTTOM_GAP = 12;
    var rafId = 0;
    var ro = null;

    function q(id) {
      return document.getElementById(id);
    }

    function loadPos() {
      try {
        return JSON.parse(localStorage.getItem(STORE) || '{}') || {};
      } catch (error) {
        return {};
      }
    }

    function savePos(left, top, mode) {
      try {
        localStorage.setItem(STORE, JSON.stringify({
          mode: mode || 'free',
          left: left,
          top: top
        }));
      } catch (error) {}
    }

    function clampLeft(left, width) {
      return Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));
    }

    function bar() {
      return q(BAR_ID);
    }

    function autoMode(saved, node) {
      return !!(node && !node.classList.contains('dragging') && saved && (saved.mode === 'bottom' || saved.mode === 'top'));
    }

    function recenter(force) {
      var node = bar();
      if (!node) return;

      var saved = loadPos();
      if (!force && !autoMode(saved, node)) return;

      var width = node.offsetWidth || 320;
      var height = node.offsetHeight || 52;
      var mode = saved && saved.mode === 'top' ? 'top' : 'bottom';
      var left = clampLeft((window.innerWidth - width) / 2, width);
      var top = mode === 'top' ? EDGE : Math.max(EDGE, window.innerHeight - height - BOTTOM_GAP);

      node.style.left = left + 'px';
      node.style.top = top + 'px';
      node.style.right = 'auto';
      node.style.bottom = 'auto';
      node.style.transform = 'none';

      savePos(left, top, mode);
    }

    function schedule(force) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(function() {
        recenter(!!force);
      });
    }

    function scrollBottom() {
      return Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement ? document.documentElement.scrollHeight : 0,
        document.body ? document.body.offsetHeight : 0,
        document.documentElement ? document.documentElement.offsetHeight : 0,
        document.body ? document.body.clientHeight : 0,
        document.documentElement ? document.documentElement.clientHeight : 0
      );
    }

    function syncToolbarStates() {
      var multi = q('multiSelectToggleBtn');
      var edit = q('editCharBtn');
      var multiActive = !!(window.AppState && window.AppState.multiSelectMode);
      var editActive = !!(window.EditCharState && window.EditCharState.active);

      if (multi) {
        multi.classList.toggle('qa-multi-active', multiActive);
        multi.setAttribute('aria-pressed', multiActive ? 'true' : 'false');
      }

      if (edit) {
        edit.classList.toggle('qa-edit-active', editActive);
        edit.setAttribute('aria-pressed', editActive ? 'true' : 'false');
      }
    }

    function bindNav(btn, key, handler) {
      if (!btn || btn.dataset[key]) return;

      btn.dataset[key] = '1';
      btn.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        handler();
      }, true);

      btn.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopImmediatePropagation();
          handler();
        }
      }, true);
    }

    function ensurePerf() {
      if (!window.__qaRenderPerfState) {
        window.__qaRenderPerfState = {
          filtered: null,
          rank: null,
          aggregate: null
        };
      }
      return window.__qaRenderPerfState;
    }

    function orderVersion() {
      var list = Array.isArray(AppState && AppState.characters) ? AppState.characters : [];
      var parts = new Array(list.length);

      for (var i = 0; i < list.length; i++) {
        var item = list[i] || {};
        parts[i] = [
          item.id || '',
          isDividerItem(item) ? 'd' : 'c',
          item.currentRank || 0,
          item.globalRank || 0,
          item.collapsed ? 1 : 0
        ].join(':');
      }

      return parts.join('|');
    }

    function filterVersion() {
      var list = Array.isArray(AppState && AppState.characters) ? AppState.characters : [];
      var parts = new Array(list.length);

      for (var i = 0; i < list.length; i++) {
        var item = list[i] || {};
        parts[i] = [
          item.id || '',
          isDividerItem(item) ? 'd' : 'c',
          item.title || '',
          item.name || '',
          item.series || '',
          item.owner || '',
          item.note || '',
          item.roulette || '',
          item.collapsed ? 1 : 0
        ].join('\u0001');
      }

      return parts.join('\u0002');
    }

    function aggregateVersion() {
      var list = Array.isArray(AppState && AppState.characters) ? AppState.characters : [];
      var parts = new Array(list.length);

      for (var i = 0; i < list.length; i++) {
        var item = list[i] || {};
        parts[i] = [
          item.id || '',
          isDividerItem(item) ? 'd' : 'c',
          item.kakera || 0,
          item.keys || 0,
          item.roulette || '',
          JSON.stringify(item.spheres || null)
        ].join(':');
      }

      return parts.join('|');
    }

    function installPerf() {
      if (typeof window.getFilteredCharacters === 'function' && !window.getFilteredCharacters.__qaWrapped) {
        var originalFiltered = window.getFilteredCharacters;
        var wrappedFiltered = function() {
          var perf = ensurePerf();
          var key = [
            String(AppState && AppState.filter || ''),
            String(AppState && AppState.ownerFilter || ''),
            String(AppState && AppState.rouletteFilter || ''),
            String(AppState && AppState.genderFilter || ''),
            Array.isArray(AppState && AppState.selectedSeries) ? AppState.selectedSeries.join('\u0003') : ''
          ].join('\u0004');
          var version = filterVersion();

          if (perf.filtered && perf.filtered.version === version && perf.filtered.key === key) {
            return perf.filtered.result.slice();
          }

          var result = originalFiltered.apply(this, arguments) || [];
          perf.filtered = {
            version: version,
            key: key,
            result: result.slice()
          };
          return result;
        };

        wrappedFiltered.__qaWrapped = true;
        window.getFilteredCharacters = wrappedFiltered;
      }

      if (typeof window.getVisibleCharacterRankById === 'function' && !window.getVisibleCharacterRankById.__qaWrapped) {
        var originalRank = window.getVisibleCharacterRankById;
        var wrappedRank = function(id) {
          var perf = ensurePerf();
          var version = orderVersion();

          if (!perf.rank || perf.rank.version !== version) {
            var map = {};
            var rank = 0;
            var list = Array.isArray(AppState && AppState.characters) ? AppState.characters : [];

            for (var i = 0; i < list.length; i++) {
              var item = list[i];
              if (!isDividerItem(item)) rank += 1;
              if (item && item.id) map[item.id] = rank;
            }

            perf.rank = {
              version: version,
              map: map
            };
          }

          return perf.rank.map[id] || 0;
        };

        wrappedRank.__qaWrapped = true;
        wrappedRank.__qaOriginal = originalRank;
        window.getVisibleCharacterRankById = wrappedRank;
      }
    }

    function install() {
      bindNav(q('jumpPageTopBtn'), 'qaNavTopBound', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      bindNav(q('jumpPageBottomBtn'), 'qaNavBottomBound', function() {
        window.scrollTo({ top: scrollBottom(), behavior: 'smooth' });
      });

      syncToolbarStates();
      installPerf();
      schedule(false);
      setTimeout(function() { schedule(false); }, 0);

      var btn = q(BTN_ID);
      var node = bar();

      if (btn && !btn.dataset.qaAutocenterBound) {
        btn.dataset.qaAutocenterBound = '1';
        btn.addEventListener('click', function() {
          schedule(false);
          setTimeout(function() { schedule(false); }, 0);
        });
      }

      if (node && typeof ResizeObserver === 'function' && !ro) {
        ro = new ResizeObserver(function() {
          schedule(false);
        });
        ro.observe(node);
      }

      if (!window.__qaConsolidatedResizeBound) {
        window.__qaConsolidatedResizeBound = true;
        window.addEventListener('resize', function() {
          schedule(false);
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install);
      window.addEventListener('load', function() {
        setTimeout(install, 0);
      });
    } else {
      setTimeout(install, 0);
    }

    function scheduleToolbarSync() {
      if (scheduleToolbarSync._raf) cancelAnimationFrame(scheduleToolbarSync._raf);
      scheduleToolbarSync._raf = requestAnimationFrame(function() {
        scheduleToolbarSync._raf = 0;
        syncToolbarStates();
      });
    }

    if (!window.__qaToolbarEventSyncBoundV32) {
      window.__qaToolbarEventSyncBoundV32 = true;
      document.addEventListener('click', scheduleToolbarSync, true);
      document.addEventListener('change', scheduleToolbarSync, true);
      document.addEventListener('keydown', function(event) {
        if (event && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) scheduleToolbarSync();
      }, true);
    }
  })();

  /* Edicion directa */

  (function initStabilityAndDeletePatch() {
    if (window.__stabilityAndDeleteV97) return;
    window.__stabilityAndDeleteV97 = true;

    function q(id) {
      return document.getElementById(id);
    }

    function getList() {
      return window.AppState && Array.isArray(window.AppState.characters)
        ? window.AppState.characters
        : [];
    }

    function isDivider(item) {
      return !!(window.isDividerItem && window.isDividerItem(item));
    }

    function getChar(id) {
      var list = getList();
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (item && item.id === id && !isDivider(item)) return item;
      }
      return null;
    }

    function closeDirectEditNow() {
      var overlay = q('editCharModalOverlay');
      if (overlay) {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
      }

      var moveOpen = q('moveModalOverlay') && q('moveModalOverlay').classList.contains('show');
      var deleteOpen = q('deleteModalOverlay') && q('deleteModalOverlay').classList.contains('show');
      if (document.body && !moveOpen && !deleteOpen) {
        document.body.classList.remove('modal-open');
      }

      window.__directEditCardMode = null;
      window.directEditCardMode = null;

      if (window.EditCharState) {
        window.EditCharState.active = false;
        window.EditCharState.charId = null;
      }
    }

    function deleteCurrentEditCharacter() {
      var charId = window.__directEditCardMode && window.__directEditCardMode.charId
        ? window.__directEditCardMode.charId
        : (window.EditCharState && window.EditCharState.charId ? window.EditCharState.charId : null);

      var character = getChar(charId);
      if (!character) {
        if (typeof window.showMessage === 'function') {
          showMessage('No character selected.', 'error');
        }
        return;
      }

      var run = function() {
        window.AppState.characters = getList().filter(function(entry) {
          return !(entry && entry.id === charId);
        });

        if (window.AppState && Array.isArray(window.AppState.selectedMoveIds)) {
          window.AppState.selectedMoveIds = window.AppState.selectedMoveIds.filter(function(id) {
            return id !== charId;
          });
        }

        if (typeof window.renumberAllItems === 'function') renumberAllItems();
        if (typeof window.rebuildPersistentOrderMap === 'function') rebuildPersistentOrderMap();
        if (typeof window.updateOwnerFilterOptions === 'function') updateOwnerFilterOptions();
        if (typeof window.refreshChangedZone === 'function') refreshChangedZone();

        closeDirectEditNow();

        if (typeof window.renderBoard === 'function') window.renderBoard();
        if (typeof window.saveLocal === 'function') window.saveLocal(false);
        if (typeof window.showMessage === 'function') showMessage('Character deleted.');
      };

      if (typeof window.openDeleteConfirmModal === 'function') {
        openDeleteConfirmModal({
          title: 'Delete character',
          subtitle: String(character.name || '').trim() || 'Selected character',
          help: 'You are about to remove this character from the harem. This action cannot be undone.',
          confirmLabel: 'Delete',
          onConfirm: run
        });
      } else {
        run();
      }
    }

    function bindEditDelete() {
      var btn = q('editCharDeleteBtn');
      if (!btn || btn.dataset.bound === '1') return;

      btn.dataset.bound = '1';
      btn.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteCurrentEditCharacter();
      }, true);
    }

    function refreshGroupVisibility() {
      var btn = q('lockGroupSelectedBtn');
      if (!btn) return;

      var multi = !!(window.AppState && window.AppState.multiSelectMode);
      btn.hidden = !multi;
      btn.style.display = multi ? 'inline-flex' : 'none';

      if (!multi) btn.setAttribute('aria-hidden', 'true');
      else btn.removeAttribute('aria-hidden');
    }

    function install() {
      bindEditDelete();
      refreshGroupVisibility();

      if (typeof window.updateMultiSelectUI === 'function' && !window.updateMultiSelectUI.__v97Wrapped) {
        var originalMulti = window.updateMultiSelectUI;
        window.updateMultiSelectUI = function() {
          var result = originalMulti.apply(this, arguments);
          refreshGroupVisibility();
          return result;
        };
        window.updateMultiSelectUI.__v97Wrapped = true;
      }

      if (typeof window.renderBoard === 'function' && !window.renderBoard.__v97Wrapped) {
        var originalRender = window.renderBoard;
        window.renderBoard = function() {
          var result = originalRender.apply(this, arguments);
          setTimeout(function() {
            bindEditDelete();
            refreshGroupVisibility();
          }, 0);
          return result;
        };
        window.renderBoard.__v97Wrapped = true;
      }

      setTimeout(function() {
        bindEditDelete();
        refreshGroupVisibility();
      }, 0);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install);
    } else {
      install();
    }
  })();

  /* Parches edit */

  (function initEnterEditConfirmPatch() {
    if (window.enterEditConfirmPatchV1) return;
    window.enterEditConfirmPatchV1 = true;

    document.addEventListener('keydown', function(event) {
      if (!event || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      var overlay = document.getElementById('editCharModalOverlay');
      if (!overlay || !overlay.classList.contains('show')) return;

      var active = document.activeElement;
      var tag = active && active.tagName ? String(active.tagName).toUpperCase() : '';
      if (tag === 'TEXTAREA') return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      try {
        if (window.directEditCardMode && typeof window.applyDirectEdit === 'function') {
          window.applyDirectEdit();
          return;
        }

        if (window.EC && typeof window.EC.submit === 'function') {
          window.EC.submit();
          return;
        }

        var confirmBtn = document.getElementById('editCharConfirmBtn');
        if (confirmBtn && typeof confirmBtn.click === 'function') {
          confirmBtn.click();
        }
      } catch (error) {
        console.error(error);
      }
    }, true);
  })();
})();

/* v25: compact sphere controls, all button, and summary refresh */
(function(){
  if(window.__sphereControlsV25)return;
  window.__sphereControlsV25=true;
  function $(id){return document.getElementById(id);}
  function setOptions(select, options){
    if(!select)return;
    var current=select.value || '0';
    select.innerHTML='';
    options.forEach(function(pair){
      var opt=document.createElement('option');
      opt.value=String(pair[0]);
      opt.textContent=String(pair[1]);
      select.appendChild(opt);
    });
    select.value=current;
    if(select.value!==current)select.value='0';
  }
  function updateLabels(){
    var costs=['0','200','400','600','800','1000','2000'];
    for(var i=1;i<=10;i++){
      var sel=$('editCharSphereP'+i);
      if(!sel)continue;
      if(i<=5)setOptions(sel,costs.map(function(label,idx){return [idx,label];}));
      else setOptions(sel,[[0,'0'],[1,'1000']]);
    }
    var help=document.querySelector('.spheres-help');
    if(help&&help.parentNode)help.parentNode.removeChild(help);
  }
  function triggerSphereChange(){
    for(var i=1;i<=10;i++){
      var sel=$('editCharSphereP'+i);
      if(sel)sel.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  function setAllSpheres(){
    for(var i=1;i<=10;i++){
      var sel=$('editCharSphereP'+i);
      if(sel)sel.value=i<=5?'6':'1';
    }
    triggerSphereChange();
  }
  function setNoSpheres(){
    for(var i=1;i<=10;i++){
      var sel=$('editCharSphereP'+i);
      if(sel)sel.value='0';
    }
    triggerSphereChange();
  }
  function ensureButtons(){
    var clear=$('editCharSpheresClearBtn');
    if(!clear)return;
    var all=$('editCharSpheresAllBtn');
    var wrap=clear.closest&&clear.closest('.spheres-actions');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='spheres-actions';
      clear.parentNode.insertBefore(wrap,clear);
      wrap.appendChild(clear);
    }
    if(!all){
      all=document.createElement('button');
      all.id='editCharSpheresAllBtn';
      all.type='button';
      all.className='btn btn-secondary spheres-all-btn';
      all.textContent='All spheres';
      wrap.insertBefore(all,clear);
    }
    if(!all.dataset.sphereAllV25){
      all.dataset.sphereAllV25='1';
      all.addEventListener('click',function(e){e.preventDefault();setAllSpheres();},true);
    }
    if(!clear.dataset.sphereClearV25){
      clear.dataset.sphereClearV25='1';
      clear.addEventListener('click',function(e){e.preventDefault();setNoSpheres();},true);
    }
  }
  function refreshAfterEdit(){
    setTimeout(function(){
      if(typeof window.updateStats==='function')try{window.updateStats();}catch(e){}
      if(typeof window.saveLocal==='function')try{window.saveLocal(false);}catch(e){}
    },0);
  }
  function install(){
    updateLabels();
    ensureButtons();
    var confirm=$('editCharConfirmBtn');
    if(confirm&&!confirm.dataset.sphereSummaryV25){
      confirm.dataset.sphereSummaryV25='1';
      confirm.addEventListener('click',refreshAfterEdit,true);
    }
    document.addEventListener('click',function(e){
      if(e&&e.target&&e.target.closest&&e.target.closest('#editCharBtn,.character-card[data-id]'))setTimeout(function(){updateLabels();ensureButtons();},0);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


/* v26: robust sphere defaults, save, and summary sync */
(function(){
  if (window.__sphereRobustV26) return;
  window.__sphereRobustV26 = true;

  var LEVEL_COSTS = [200, 400, 600, 800, 1000, 2000];
  var SINGLE_COST = 1000;

  function $(id){ return document.getElementById(id); }
  function getChars(){ return window.AppState && Array.isArray(window.AppState.characters) ? window.AppState.characters : []; }
  function getActiveId(){ return window.EditCharState && window.EditCharState.charId ? window.EditCharState.charId : null; }
  function findChar(id){
    var list = getChars();
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function clampLevel(index, value){
    var max = index < 5 ? 6 : 1;
    var n = parseInt(value, 10);
    if (isNaN(n)) n = 0;
    return Math.max(0, Math.min(max, n));
  }
  function normalize(value){
    var source = value;
    var levels = [];
    if (Array.isArray(source)) levels = source.slice(0, 10);
    else if (source && typeof source === 'object') {
      if (Array.isArray(source.levels)) levels = source.levels.slice(0, 10);
      else {
        for (var i = 1; i <= 10; i++) levels.push(source['p' + i] || source[i] || 0);
      }
    }
    for (var j = 0; j < 10; j++) levels[j] = clampLevel(j, levels[j]);
    return { levels: levels };
  }
  function hasAny(spheres){
    var levels = normalize(spheres).levels;
    for (var i = 0; i < levels.length; i++) if (levels[i] > 0) return true;
    return false;
  }
  function compact(spheres){
    var normalized = normalize(spheres);
    return hasAny(normalized) ? normalized : null;
  }
  function perkCost(index, level){
    var lv = clampLevel(index, level);
    if (lv <= 0) return 0;
    if (index < 5) {
      var total = 0;
      for (var i = 0; i < lv; i++) total += LEVEL_COSTS[i] || 0;
      return total;
    }
    return SINGLE_COST;
  }
  function totalCost(item){
    var levels = normalize(item && item.spheres).levels;
    var total = 0;
    for (var i = 0; i < levels.length; i++) total += perkCost(i, levels[i]);
    return total;
  }
  function activeCount(item){
    var levels = normalize(item && item.spheres).levels;
    var total = 0;
    for (var i = 0; i < levels.length; i++) if (levels[i] > 0) total++;
    return total;
  }
  function fmt(value){
    return typeof window.formatSummaryNumber === 'function' ? window.formatSummaryNumber(value) : String(value || 0);
  }
  function summary(item){
    var levels = normalize(item && item.spheres).levels;
    var parts = [];
    for (var i = 0; i < levels.length; i++) {
      if (levels[i] <= 0) continue;
      parts.push('P' + (i + 1) + (i < 5 ? ': ' + levels[i] : '') + ' (' + fmt(perkCost(i, levels[i])) + ')');
    }
    return parts.join(' · ');
  }

  window.normalizeSpheres = normalize;
  window.compactSpheres = compact;
  window.getSpherePerkCost = perkCost;
  window.getSphereCostTotal = totalCost;
  window.getSphereActiveCount = activeCount;
  window.getSphereTotal = function(item){ return activeCount(item); };
  window.hasSpheres = function(item){ return activeCount(item) > 0; };
  window.getSphereSummary = summary;
  window.getSphereBadgeText = function(item){ var n = activeCount(item); return n ? ('SP ' + n + '/10') : ''; };

  function ensureSelectLabels(){
    for (var i = 1; i <= 10; i++) {
      var sel = $('editCharSphereP' + i);
      if (!sel) continue;
      var current = String(sel.value || '0');
      var html = '';
      if (i <= 5) {
        var labels = ['0','200','400','600','800','1000','2000'];
        for (var a = 0; a < labels.length; a++) html += '<option value="' + a + '">' + labels[a] + '</option>';
      } else {
        html = '<option value="0">0</option><option value="1">1000</option>';
      }
      if (sel.innerHTML !== html) sel.innerHTML = html;
      sel.value = current;
      if (sel.value !== current) sel.value = '0';
    }
  }
  function readFields(){
    var levels = [];
    for (var i = 1; i <= 10; i++) {
      var sel = $('editCharSphereP' + i);
      levels.push(clampLevel(i - 1, sel ? sel.value : 0));
    }
    return compact({ levels: levels });
  }
  function writeFields(character){
    ensureSelectLabels();
    var levels = normalize(character && character.spheres).levels;
    for (var i = 1; i <= 10; i++) {
      var sel = $('editCharSphereP' + i);
      if (sel) sel.value = String(levels[i - 1] || 0);
    }
    updateEditTotal();
  }
  function updateEditTotal(){
    var el = $('editCharSpheresCost');
    if (!el) return;
    var spheres = readFields();
    el.textContent = 'Total: ' + fmt(spheres ? totalCost({ spheres: spheres }) : 0) + ' spheres';
  }
  function saveCurrentSpheres(){
    var ch = findChar(getActiveId());
    if (!ch) return;
    var spheres = readFields();
    if (spheres) ch.spheres = spheres;
    else delete ch.spheres;
  }
  function refreshSummary(){
    if (typeof window.updateStats === 'function') try { window.updateStats(); } catch(e) {}
    if (typeof window.saveLocal === 'function') try { window.saveLocal(false); } catch(e) {}
  }
  function cleanEmptySpheres(){
    getChars().forEach(function(ch){
      if (!ch || !ch.spheres) return;
      var normalized = compact(ch.spheres);
      if (normalized) ch.spheres = normalized;
      else delete ch.spheres;
    });
  }
  function setAll(){
    ensureSelectLabels();
    for (var i = 1; i <= 10; i++) {
      var sel = $('editCharSphereP' + i);
      if (sel) sel.value = i <= 5 ? '6' : '1';
    }
    updateEditTotal();
  }
  function clearAll(){
    ensureSelectLabels();
    for (var i = 1; i <= 10; i++) {
      var sel = $('editCharSphereP' + i);
      if (sel) sel.value = '0';
    }
    updateEditTotal();
  }
  function bind(){
    ensureSelectLabels();
    cleanEmptySpheres();
    for (var i = 1; i <= 10; i++) {
      var sel = $('editCharSphereP' + i);
      if (sel && !sel.dataset.sphereV26Bound) {
        sel.dataset.sphereV26Bound = '1';
        sel.addEventListener('change', updateEditTotal);
      }
    }
    var all = $('editCharSpheresAllBtn');
    if (all && !all.dataset.sphereV26Bound) {
      all.dataset.sphereV26Bound = '1';
      all.addEventListener('click', function(e){ e.preventDefault(); e.stopImmediatePropagation(); setAll(); }, true);
    }
    var clear = $('editCharSpheresClearBtn');
    if (clear && !clear.dataset.sphereV26Bound) {
      clear.dataset.sphereV26Bound = '1';
      clear.addEventListener('click', function(e){ e.preventDefault(); e.stopImmediatePropagation(); clearAll(); }, true);
    }
    var confirm = $('editCharConfirmBtn');
    if (confirm && !confirm.dataset.sphereV26Bound) {
      confirm.dataset.sphereV26Bound = '1';
      confirm.addEventListener('click', function(){ saveCurrentSpheres(); setTimeout(refreshSummary, 0); }, true);
    }
    document.addEventListener('click', function(e){
      var card = e.target && e.target.closest ? e.target.closest('.character-card[data-id]') : null;
      if (!card) return;
      setTimeout(function(){ writeFields(findChar(card.getAttribute('data-id'))); }, 0);
    }, true);
    setTimeout(function(){ cleanEmptySpheres(); refreshSummary(); }, 0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();


/* v28: robust sphere persistence and restore patch */
(function(){
  if (window.__spherePersistenceV28) return;
  window.__spherePersistenceV28 = true;

  function q(id){ return document.getElementById(id); }
  function getList(){ return window.AppState && Array.isArray(AppState.characters) ? AppState.characters : []; }
  function isDivider(item){ return typeof window.isDividerItem === 'function' ? window.isDividerItem(item) : !!(item && item.type === 'divider'); }
  function getChar(id){
    if (!id) return null;
    var list = getList();
    for (var i=0;i<list.length;i++) if (list[i] && list[i].id === id && !isDivider(list[i])) return list[i];
    return null;
  }
  function activeCharId(){
    if (window.__directEditCardMode && window.__directEditCardMode.charId) return window.__directEditCardMode.charId;
    if (window.directEditCardMode && window.directEditCardMode.charId) return window.directEditCardMode.charId;
    if (window.EditCharState && window.EditCharState.charId) return window.EditCharState.charId;
    var selected = document.querySelector('.character-card.edit-selected[data-id]');
    if (selected) return selected.getAttribute('data-id');
    return null;
  }
  function normalize(value){
    if (typeof window.normalizeSpheres === 'function') return window.normalizeSpheres(value).levels;
    var levels = value && Array.isArray(value.levels) ? value.levels.slice(0,10) : [];
    for (var i=0;i<10;i++){
      var max = i < 5 ? 6 : 1;
      var n = parseInt(levels[i],10);
      if (isNaN(n)) n = 0;
      levels[i] = Math.max(0, Math.min(max, n));
    }
    return levels;
  }
  function compact(levels){
    levels = normalize({levels:levels});
    for (var i=0;i<levels.length;i++) if (levels[i] > 0) return {levels:levels};
    return null;
  }
  function readFields(){
    var levels=[];
    var found=false;
    for (var i=1;i<=10;i++){
      var el=q('editCharSphereP'+i);
      if (!el) { levels.push(0); continue; }
      found=true;
      var max = i <= 5 ? 6 : 1;
      var n = parseInt(el.value,10);
      if (isNaN(n)) n = 0;
      levels.push(Math.max(0, Math.min(max, n)));
    }
    return found ? compact(levels) : null;
  }
  function writeFields(character){
    var levels = normalize(character && character.spheres);
    for (var i=1;i<=10;i++){
      var el=q('editCharSphereP'+i);
      if (el) el.value = String(levels[i-1] || 0);
    }
    var cost=q('editCharSpheresCost');
    if (cost) {
      var spheres = compact(levels);
      var total = spheres && typeof window.getSphereCostTotal === 'function' ? window.getSphereCostTotal({spheres:spheres}) : 0;
      var fmt = typeof window.formatSummaryNumber === 'function' ? window.formatSummaryNumber(total) : String(total || 0);
      cost.textContent = 'Total: ' + fmt + ' spheres';
    }
  }
  function persistSpheresForCharId(charId, spheres){
    var char = getChar(charId);
    if (!char) return false;
    if (spheres) char.spheres = spheres;
    else delete char.spheres;
    return true;
  }
  function persistFromModal(){
    return persistSpheresForCharId(activeCharId(), readFields());
  }
  function refreshAndSave(){
    try { if (typeof window.updateStats === 'function') window.updateStats(); } catch(e) {}
    try { if (typeof window.renderBoard === 'function') window.renderBoard(); } catch(e) {}
    try { if (typeof window.saveLocal === 'function') window.saveLocal(false); } catch(e) {}
  }

  // Capture the values before any older submit handler closes the modal.
  // Important: keep the original character id/value snapshot. Without this,
  // editing another character very quickly can apply the previous character's
  // spheres to the next one after the old zero-delay timeout runs.
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('#editCharConfirmBtn') : null;
    if (!btn) return;
    var capturedCharId = activeCharId();
    var capturedSpheres = readFields();
    persistSpheresForCharId(capturedCharId, capturedSpheres);
    setTimeout(function(){
      persistSpheresForCharId(capturedCharId, capturedSpheres);
      refreshAndSave();
    }, 0);
  }, true);

  // Restore values whenever the edit modal is opened from a card.
  document.addEventListener('click', function(e){
    var editBtn = e.target && e.target.closest ? e.target.closest('.char-edit-btn') : null;
    if (!editBtn) return;
    var card = editBtn.closest('.character-card[data-id]');
    if (!card) return;
    setTimeout(function(){ writeFields(getChar(card.getAttribute('data-id'))); }, 0);
  }, true);

  // Wrap direct edit submit if available.
  function wrapApply(){
    if (typeof window.applyDirectEdit === 'function' && !window.applyDirectEdit.__spherePersistenceV28) {
      var original = window.applyDirectEdit;
      window.applyDirectEdit = function(){
        persistFromModal();
        var result = original.apply(this, arguments);
        setTimeout(refreshAndSave, 0);
        return result;
      };
      window.applyDirectEdit.__spherePersistenceV28 = true;
    }
  }
  wrapApply();
  setTimeout(wrapApply, 0);
  setTimeout(wrapApply, 250);
})();

/* v31/v33: use lightweight toggle buttons for sphere perks P6-P10 */
(function(){
  if (window.__sphereToggleButtonsV33) return;
  window.__sphereToggleButtonsV33 = true;

  function q(id){ return document.getElementById(id); }
  function getSelect(perk){ return q('editCharSphereP' + perk); }
  function normalizeValue(value){ return String(parseInt(value, 10) === 1 ? 1 : 0); }
  function fireChange(select){
    if (!select) return;
    try { select.dispatchEvent(new Event('change', { bubbles: true })); }
    catch(e){ var evt=document.createEvent('Event'); evt.initEvent('change', true, true); select.dispatchEvent(evt); }
  }
  function updateButton(perk){
    var select=getSelect(perk), btn=q('editCharSphereToggleP'+perk);
    if(!select||!btn) return;
    var active=normalizeValue(select.value)==='1';
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active?'true':'false');
    btn.textContent=active?'1000':'0';
    btn.title=active?('P'+perk+' active'):('P'+perk+' inactive');
  }
  function updateAllButtons(){ for(var p=6;p<=10;p++) updateButton(p); }
  function ensureToggleButtons(){
    for(var perk=6;perk<=10;perk++){
      var select=getSelect(perk); if(!select) continue;
      var control=select.closest?select.closest('.sphere-control'):null;
      if(control) control.classList.add('sphere-toggle-control');
      select.classList.add('sphere-hidden-select');
      select.setAttribute('aria-hidden','true');
      select.tabIndex=-1;
      var btn=q('editCharSphereToggleP'+perk);
      if(!btn){
        btn=document.createElement('button');
        btn.id='editCharSphereToggleP'+perk;
        btn.type='button';
        btn.className='sphere-toggle-btn';
        btn.dataset.sphereTogglePerk=String(perk);
        if(select.parentNode) select.parentNode.insertBefore(btn, select.nextSibling);
      }
      if(!btn.dataset.sphereToggleBound){
        btn.dataset.sphereToggleBound='1';
        btn.addEventListener('click', function(event){
          event.preventDefault();
          var p=parseInt(this.dataset.sphereTogglePerk,10);
          var sel=getSelect(p); if(!sel) return;
          sel.value=normalizeValue(sel.value)==='1'?'0':'1';
          updateButton(p);
          fireChange(sel);
        });
      }
      if(!select.dataset.sphereToggleSelectBound){
        select.dataset.sphereToggleSelectBound='1';
        select.addEventListener('change', function(){
          var p=parseInt((this.id||'').replace('editCharSphereP',''),10);
          if(!isNaN(p)) updateButton(p);
        });
      }
    }
    updateAllButtons();
  }
  function scheduleEnsure(){
    if(scheduleEnsure._raf) return;
    scheduleEnsure._raf=requestAnimationFrame(function(){ scheduleEnsure._raf=0; ensureToggleButtons(); });
  }
  function install(){
    ensureToggleButtons();
    document.addEventListener('click', function(event){
      var target=event.target;
      if(!target||!target.closest) return;
      if(target.closest('#editCharBtn,.char-edit-btn,#editCharSpheresAllBtn,#editCharSpheresClearBtn')) scheduleEnsure();
    }, true);
    document.addEventListener('change', function(event){
      var target=event.target;
      if(target&&target.id&&/^editCharSphereP(6|7|8|9|10)$/.test(target.id)) scheduleEnsure();
    }, true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

/* v43: Mudae image helper in Edit character
   Partial automation: opens the exact Mudae search and copies the character name,
   then lets you paste image URLs into the side panel for preview/apply. */
(function(){
  if (window.__mudaeImageSidePanelV43) return;
  window.__mudaeImageSidePanelV43 = true;

  function q(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? '' : value); }

  function getCharacterName(){
    var input = q('editCharNameInput');
    return input ? text(input.value).trim() : '';
  }

  function getImageInput(){ return q('editCharImageInput'); }

  function getMudaeSearchUrl(){
    var name = getCharacterName();
    if (!name) return '';
    return 'https://mudae.net/search?type=character&name=' + encodeURIComponent(name) + '&sort=rank&desc=false';
  }

  function fireInput(input){
    if (!input) return;
    try { input.dispatchEvent(new Event('input', { bubbles: true })); }
    catch(e){ var evt = document.createEvent('Event'); evt.initEvent('input', true, true); input.dispatchEvent(evt); }
    try { input.dispatchEvent(new Event('change', { bubbles: true })); }
    catch(e2){ var evt2 = document.createEvent('Event'); evt2.initEvent('change', true, true); input.dispatchEvent(evt2); }
  }

  function setStatus(message, tone){
    var el = q('mudaeImageHelperStatus');
    if (!el) return;
    el.textContent = message || '';
    el.dataset.tone = tone || '';
  }

  function copyTextToClipboard(value, callback){
    value = text(value);
    function done(ok){ if (typeof callback === 'function') callback(!!ok); }
    if (!value) return done(false);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function(){ done(true); }).catch(function(){ fallback(); });
    } else {
      fallback();
    }

    function fallback(){
      var ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
  }

  function cleanUrl(url){
    return text(url)
      .trim()
      .replace(/&amp;/g, '&')
      .replace(/[),.;\]}]+$/g, '')
      .replace(/^<|>$/g, '');
  }

  function normalizeUrl(url, base){
    url = cleanUrl(url);
    if (!url) return '';
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (/^https?:\/\//i.test(url)) return url;
    try { return new URL(url, base || 'https://mudae.net/').href; }
    catch(e){ return ''; }
  }

  function isLikelyImageUrl(url){
    var lower = text(url).toLowerCase();
    if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(lower)) return true;
    if (/\/attachments\//i.test(lower) && /discord(app)?\.(com|net)|media\.discordapp\.net|cdn\.discordapp\.com/i.test(lower)) return true;
    if (/mudae\.net/i.test(lower) && /(uploads|image|img|cdn)/i.test(lower)) return true;
    return false;
  }

  function pushUnique(list, seen, url){
    url = normalizeUrl(url, 'https://mudae.net/');
    if (!url || !isLikelyImageUrl(url)) return;
    if (seen[url]) return;
    seen[url] = true;
    list.push(url);
  }

  function extractImageUrls(raw, base){
    var found = [];
    var seen = Object.create(null);
    var textValue = text(raw);
    var match;

    var attrRegex = /(?:src|data-src|data-original|href)\s*=\s*["']([^"']+)["']/gi;
    while ((match = attrRegex.exec(textValue))) pushUnique(found, seen, normalizeUrl(match[1], base));

    var cssRegex = /url\(([^)]+)\)/gi;
    while ((match = cssRegex.exec(textValue))) pushUnique(found, seen, normalizeUrl(match[1].replace(/["']/g, ''), base));

    var urlRegex = /https?:\/\/[^\s<>'"`]+/gi;
    while ((match = urlRegex.exec(textValue))) pushUnique(found, seen, match[0]);

    return found;
  }

  function applyImageUrl(url){
    var input = getImageInput();
    if (!input || !url) return;
    input.value = url;
    fireInput(input);
    setStatus('Image applied. Press Save changes to keep it.', 'ok');
  }

  function renderGallery(urls, sourceLabel){
    var gallery = q('mudaeImageGallery');
    if (!gallery) return;
    gallery.innerHTML = '';

    if (!urls || !urls.length) {
      gallery.classList.remove('has-results');
      if (sourceLabel) setStatus('No direct image links found from ' + sourceLabel + '.', 'warn');
      return;
    }

    gallery.classList.add('has-results');
    var frag = document.createDocumentFragment();

    urls.forEach(function(url, index){
      var card = document.createElement('div');
      card.className = 'mudae-image-card';

      var number = document.createElement('div');
      number.className = 'mudae-image-number';
      number.textContent = '#' + (index + 1);

      var img = document.createElement('img');
      img.alt = 'Mudae image option ' + (index + 1);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = url;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mudae-image-use-btn';
      btn.title = 'Use image #' + (index + 1);
      btn.dataset.imageUrl = url;
      btn.textContent = 'Use';

      card.appendChild(number);
      card.appendChild(img);
      card.appendChild(btn);
      frag.appendChild(card);
    });

    gallery.appendChild(frag);
    setStatus(urls.length + ' numbered image' + (urls.length === 1 ? '' : 's') + ' loaded' + (sourceLabel ? ' from ' + sourceLabel : '') + '.', 'ok');
  }

  function setPanelOpen(open){
    var panel = q('mudaeImageSidePanel');
    var modal = q('editCharModalOverlay');
    var body = modal ? modal.querySelector('.edit-char-modal-body') : null;
    if (!panel || !body) return;
    panel.hidden = !open;
    body.classList.toggle('mudae-side-active', !!open);
    var dialog = modal ? modal.querySelector('.edit-char-modal') : null;
    if (dialog) dialog.classList.toggle('mudae-side-active', !!open);
    var arrow = q('mudaeImageExpandBtn');
    if (arrow) {
      arrow.textContent = open ? '‹' : '›';
      arrow.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function resetSidePanel(){
    var textarea = q('mudaeImagePasteInput');
    var gallery = q('mudaeImageGallery');
    if (textarea) textarea.value = '';
    if (gallery) { gallery.innerHTML = ''; gallery.classList.remove('has-results'); }
    setStatus('', '');
  }

  function updateOpenLink(){
    var url = getMudaeSearchUrl();
    var link = q('mudaeImageOpenLink');
    if (link) {
      link.href = url || 'https://mudae.net/search?type=character&sort=rank&desc=false';
      link.toggleAttribute('aria-disabled', !url);
    }
    return url;
  }

  function openMudaeSearch(){
    var name = getCharacterName();
    var url = updateOpenLink();
    if (!name || !url) {
      setPanelOpen(true);
      setStatus('Add a character name before searching.', 'warn');
      return;
    }

    setPanelOpen(true);
    copyTextToClipboard(name, function(copied){
      var msg = copied
        ? 'Opened Mudae and copied the character name. Copy image address there, then paste it here.'
        : 'Opened Mudae. Copy an image address there, then paste it here.';
      setStatus(msg, copied ? 'ok' : 'warn');
    });
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch(e) {}
  }

  function parsePastedImages(){
    setPanelOpen(true);
    var textarea = q('mudaeImagePasteInput');
    var urls = extractImageUrls(textarea ? textarea.value : '', 'https://mudae.net/');
    renderGallery(urls, 'pasted text');
    if (!urls.length) setStatus('No direct image links detected. Paste image URLs from Discord/Mudae results.', 'warn');
  }

  function focusPaste(){
    setPanelOpen(true);
    updateOpenLink();
    var textarea = q('mudaeImagePasteInput');
    if (textarea) textarea.focus({ preventScroll: true });
  }

  function ensureImageHelper(){
    var imageInput = getImageInput();
    if (!imageInput) return;
    var control = imageInput.closest ? imageInput.closest('.control') : imageInput.parentNode;
    if (!control || !control.parentNode) return;

    if (!q('mudaeImageHelper')) {
      var wrap = document.createElement('div');
      wrap.id = 'mudaeImageHelper';
      wrap.className = 'mudae-image-helper';
      wrap.innerHTML = [
        '<div class="mudae-image-helper-actions">',
          '<button class="btn btn-secondary mudae-search-btn" id="mudaeImageSearchBtn" type="button">Search Mudae</button>',
          '<button class="btn btn-ghost mudae-expand-btn" id="mudaeImageExpandBtn" type="button" title="Toggle Mudae images panel" aria-label="Toggle Mudae images panel">›</button>',
        '</div>'
      ].join('');
      control.parentNode.insertBefore(wrap, control.nextSibling);
    }

    var modal = q('editCharModalOverlay');
    var body = modal ? modal.querySelector('.edit-char-modal-body') : null;
    if (body && !q('mudaeImageSidePanel')) {
      var side = document.createElement('div');
      side.id = 'mudaeImageSidePanel';
      side.className = 'mudae-image-side-panel';
      side.hidden = true;
      side.innerHTML = [
        '<div class="mudae-image-side-head">',
          '<div>',
            '<div class="mudae-image-side-title">Mudae images</div>',
            '<div class="mudae-image-side-subtitle">Paste image URLs and select one.</div>',
          '</div>',
          '<button class="btn btn-ghost mudae-image-side-close" id="mudaeImageSideCloseBtn" type="button" aria-label="Close Mudae image panel">×</button>',
        '</div>',
        '<div class="mudae-image-helper-status" id="mudaeImageHelperStatus"></div>',
        '<div class="mudae-image-gallery" id="mudaeImageGallery"></div>',
        '<div class="mudae-image-paste-box">',
          '<label for="mudaeImagePasteInput">Paste image links</label>',
          '<textarea id="mudaeImagePasteInput" placeholder="Paste one or more image URLs here..."></textarea>',
          '<div class="mudae-image-helper-panel-actions">',
            '<button class="btn btn-secondary" id="mudaeImageParseBtn" type="button">Parse pasted images</button>',
            '<button class="btn btn-ghost" id="mudaeImageClearBtn" type="button">Clear</button>',
          '</div>',
        '</div>'
      ].join('');
      body.appendChild(side);
    }

    updateOpenLink();
  }

  function bindOnce(){
    if (window.__mudaeImageSidePanelBoundV43) return;
    window.__mudaeImageSidePanelBoundV43 = true;

    document.addEventListener('click', function(e){
      var target = e.target;
      if (!target || !target.closest) return;

      if (target.closest('#mudaeImageSearchBtn')) {
        e.preventDefault();
        ensureImageHelper();
        openMudaeSearch();
        return;
      }
      if (target.closest('#mudaeImageExpandBtn')) {
        e.preventDefault();
        ensureImageHelper();
        var panel = q('mudaeImageSidePanel');
        var willOpen = !(panel && !panel.hidden);
        setPanelOpen(willOpen);
        updateOpenLink();
        var arrow = q('mudaeImageExpandBtn');
        if (arrow) arrow.textContent = willOpen ? '‹' : '›';
        return;
      }
      if (target.closest('#mudaeImageSideCloseBtn')) {
        e.preventDefault();
        setPanelOpen(false);
        return;
      }
      if (target.closest('#mudaeImageParseBtn')) {
        e.preventDefault();
        parsePastedImages();
        return;
      }
      if (target.closest('#mudaeImageClearBtn')) {
        e.preventDefault();
        resetSidePanel();
        return;
      }

      var choice = target.closest('.mudae-image-choice,.mudae-image-use-btn');
      if (choice) {
        e.preventDefault();
        applyImageUrl(choice.dataset.imageUrl || '');
        return;
      }

      if (target.closest('#editCharBtn,.char-edit-btn,.character-card[data-id]')) {
        requestAnimationFrame(function(){ ensureImageHelper(); updateOpenLink(); });
      }
      if (target.closest('#editCharCancelBtn,#editCharConfirmBtn,#editCharDeleteBtn')) {
        requestAnimationFrame(function(){ setPanelOpen(false); });
      }
    }, true);

    document.addEventListener('input', function(e){
      var target = e.target;
      if (!target) return;
      if (target.id === 'editCharNameInput') updateOpenLink();
      if (target.id === 'mudaeImagePasteInput' && target.value && target.value.indexOf('http') !== -1) {
        window.clearTimeout(target.__mudaePasteTimer);
        target.__mudaePasteTimer = window.setTimeout(parsePastedImages, 250);
      }
    }, true);
  }

  function install(){
    ensureImageHelper();
    bindOnce();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();


/* v47: relocate Mudae search helper under the preview column */
(function(){
  if (window.__mudaeHelperRelocateV47) return;
  window.__mudaeHelperRelocateV47 = true;

  function moveHelperUnderPreview(){
    var helper = document.getElementById('mudaeImageHelper');
    if (!helper) return;

    var previewImg = document.getElementById('editCharImagePreview');
    if (!previewImg) return;

    var previewHost =
      previewImg.closest('.edit-char-preview-wrap') ||
      previewImg.closest('.edit-char-preview') ||
      previewImg.closest('.image-preview-wrap') ||
      previewImg.parentElement;

    if (!previewHost || helper.parentElement === previewHost) return;
    previewHost.appendChild(helper);
  }

  document.addEventListener('click', function(event){
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('#editCharBtn,.char-edit-btn,.character-card[data-id],#mudaeImageSearchBtn')) {
      requestAnimationFrame(moveHelperUnderPreview);
      setTimeout(moveHelperUnderPreview, 80);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    requestAnimationFrame(moveHelperUnderPreview);
  });
})();


/* v52: robustly sync P6-P10 sphere toggle buttons after parsed sphere imports */
(function(){
  if (window.__sphereHighPerkSyncV52) return;
  window.__sphereHighPerkSyncV52 = true;

  function q(id){ return document.getElementById(id); }

  function normalize(value){
    return String(parseInt(value, 10) === 1 ? 1 : 0);
  }

  function updateButton(perk){
    var select = q('editCharSphereP' + perk);
    var btn = q('editCharSphereToggleP' + perk);
    if (!select || !btn) return;

    var active = normalize(select.value) === '1';
    btn.classList.toggle('is-active', active);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.textContent = active ? '1000' : '0';
    btn.title = active ? ('P' + perk + ' active') : ('P' + perk + ' inactive');
  }

  function syncHighPerkButtons(){
    for (var p = 6; p <= 10; p++) updateButton(p);
  }

  window.syncSphereToggleButtons = syncHighPerkButtons;

  function scheduleSync(){
    requestAnimationFrame(syncHighPerkButtons);
    setTimeout(syncHighPerkButtons, 40);
    setTimeout(syncHighPerkButtons, 160);
  }

  document.addEventListener('click', function(event){
    var target = event.target;
    if (!target || !target.closest) return;

    if (target.closest('.char-edit-btn,#editCharBtn,.character-card[data-id],#editCharSpheresAllBtn,#editCharSpheresClearBtn')) {
      scheduleSync();
    }
  }, true);

  document.addEventListener('change', function(event){
    var target = event.target;
    if (target && target.id && /^editCharSphereP(6|7|8|9|10)$/.test(target.id)) {
      scheduleSync();
    }
  }, true);

  document.addEventListener('input', function(event){
    var target = event.target;
    if (target && target.id && /^editCharSphereP(6|7|8|9|10)$/.test(target.id)) {
      scheduleSync();
    }
  }, true);

  var observer = null;
  function installObserver(){
    var overlay = q('editCharModalOverlay');
    if (!overlay || observer) return;
    observer = new MutationObserver(function(){
      if (overlay.classList.contains('show') || overlay.getAttribute('aria-hidden') === 'false') scheduleSync();
    });
    observer.observe(overlay, { attributes:true, attributeFilter:['class','aria-hidden'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installObserver);
  else installObserver();

  scheduleSync();
})();

(function(){
  'use strict';
  if (window.MudaeGroupUtils) return;
  function create(context){
    const app = context.app;
    const str = context.str || (value => String(value || ''));
    const isDivider = context.isDivider || (item => item && item.type === 'divider');
    function ensureGroupsState(){
      if (!app.state || typeof app.state !== 'object') return {};
      if (!app.state.groups || typeof app.state.groups !== 'object' || Array.isArray(app.state.groups)) {
        app.state.groups = {};
      }
      return app.state.groups;
    }
    function getGroup(id){
      if (!id) return null;
      return ensureGroupsState()[id] || null;
    }
    function getCharacterGroupId(ch){
      return str(ch?.groupId || '').trim();
    }
    function hydrateCharacterGroupIdsFromGroups(){
      const groups = ensureGroupsState();
      const characters = Array.isArray(app.state.characters) ? app.state.characters : [];
      const byId = new Map();
      characters.forEach(item => {
        if (!item || isDivider(item) || !item.id) return;
        byId.set(String(item.id), item);
      });
      Object.entries(groups).forEach(([groupId, group]) => {
        const ids = Array.isArray(group?.characterIds) ? group.characterIds : [];
        ids.forEach(id => {
          const item = byId.get(String(id));
          if (!item) return;
          if (!getCharacterGroupId(item)) item.groupId = groupId;
        });
      });
    }
    function migrateLegacyGroupFieldsFromCharacters(){
      for (const item of app.state.characters || []) {
        if (!item || isDivider(item)) continue;
        const legacyId = str(item.lockGroupId || item.matchGroupId || item.matchGroup || item.bubbleId || item.group || item.groupName || '').trim();
        const legacyLabel = str(item.lockGroupLabel || item.matchGroupLabel || item.bubbleLabel || '').trim();
        if (!getCharacterGroupId(item) && legacyId) item.groupId = legacyId;
        if (!str(item.groupLabel || '').trim() && legacyLabel) item.groupLabel = legacyLabel;
      }
    }
    function getGroupLabelForCharacter(ch){
      const groupId = getCharacterGroupId(ch);
      if (!groupId) return '';
      const group = getGroup(groupId);
      return str(group?.name || groupId).trim();
    }
    function syncGroupsFromCharacters(){
      const groups = ensureGroupsState();
      const charsByGroup = new Map();
      for (const item of app.state.characters || []) {
        if (!item || isDivider(item)) continue;
        const groupId = getCharacterGroupId(item);
        if (!groupId) continue;
        if (!charsByGroup.has(groupId)) charsByGroup.set(groupId, []);
        charsByGroup.get(groupId).push(item.id);
      }
      for (const id of Object.keys(groups)) {
        if (!charsByGroup.has(id)) delete groups[id];
      }
      for (const [id, ids] of charsByGroup.entries()) {
        const existing = groups[id] && typeof groups[id] === 'object' ? groups[id] : {};
        const firstItem = (app.state.characters || []).find(item => item && !isDivider(item) && getCharacterGroupId(item) === id);
        const legacyLabel = str(firstItem?.groupLabel || firstItem?.lockGroupLabel || firstItem?.matchGroupLabel || firstItem?.bubbleLabel || '').trim();
        const existingLeadId = str(existing.leadCharacterId || '').trim();
        const existingOrder = Array.isArray(existing.characterIds) ? existing.characterIds.map(value => str(value).trim()).filter(Boolean) : [];
        const idSet = new Set(ids.map(value => str(value).trim()).filter(Boolean));
        const orderedIds = [
          ...existingOrder.filter(value => idSet.has(value)),
          ...ids.filter(value => !existingOrder.includes(value))
        ];
        groups[id] = {
          id,
          name: str(existing.name || legacyLabel || id).trim() || id,
          createdAt: existing.createdAt || new Date().toISOString(),
          characterIds: orderedIds,
          leadCharacterId: existingLeadId && idSet.has(existingLeadId) ? existingLeadId : (orderedIds[0] || '')
        };
      }
      return groups;
    }
    function getSeriesInitialsForGroup(items){
      const series = str(items?.[0]?.series || 'Group').trim() || 'Group';
      const words = series
        .replace(/[()\[\]{}:;,.!?/\\|_+~=*-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      let initials = words
        .filter(word => !/^(the|a|an|of|and|to|no|ni|de|la|el|los|las)$/i.test(word))
        .slice(0, 3)
        .map(word => word[0])
        .join('')
        .toUpperCase();
      if (!initials && series) initials = series.slice(0, 3).replace(/\s+/g, '').toUpperCase();
      return initials || 'GRP';
    }
    function makeNextGroupName(items){
      const groups = ensureGroupsState();
      const prefix = getSeriesInitialsForGroup(items);
      let max = 0;
      Object.values(groups).forEach(group => {
        const name = str(group?.name || group?.id || '');
        const match = name.match(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$', 'i'));
        if (match) max = Math.max(max, Number(match[1]) || 0);
      });
      return `${prefix}-${max + 1}`;
    }
    function clearCharacterGroupFields(item){
      if (!item || isDivider(item)) return;
      delete item.groupId;
      delete item.groupLabel;
      delete item.lockGroupId;
      delete item.lockGroupLabel;
      delete item.matchGroupId;
      delete item.matchGroupLabel;
      delete item.matchGroup;
      delete item.bubbleId;
      delete item.bubbleLabel;
      delete item.group;
      delete item.groupName;
    }
    function getGroupMemberItems(groupId){
      const id = str(groupId || '').trim();
      if (!id) return [];
      const allMembers = (app.state.characters || [])
        .filter(item => item && !isDivider(item) && getCharacterGroupId(item) === id);
      const byId = new Map(allMembers.map(item => [str(item.id || '').trim(), item]));
      const group = getGroup(id);
      const order = Array.isArray(group?.characterIds)
        ? group.characterIds.map(value => str(value).trim()).filter(Boolean)
        : [];
      const ordered = [];
      const used = new Set();
      order.forEach(charId => {
        const item = byId.get(charId);
        if (!item) return;
        ordered.push(item);
        used.add(charId);
      });
      allMembers.forEach(item => {
        const charId = str(item.id || '').trim();
        if (used.has(charId)) return;
        ordered.push(item);
      });
      return ordered;
    }
    function getGroupLeadId(groupId){
      const id = str(groupId || '').trim();
      if (!id) return '';
      const group = getGroup(id);
      const leadId = str(group?.leadCharacterId || '').trim();
      if (!leadId) return '';
      return getGroupMemberItems(id).some(item => String(item.id) === leadId) ? leadId : '';
    }
    function setGroupLead(groupId, characterId){
      const id = str(groupId || '').trim();
      const charId = str(characterId || '').trim();
      if (!id || !charId) return false;
      const groups = ensureGroupsState();
      const group = groups[id];
      if (!group) return false;
      const memberIds = getGroupMemberItems(id).map(item => String(item.id));
      if (!memberIds.includes(charId)) return false;
      group.leadCharacterId = charId;
      group.characterIds = [
        charId,
        ...memberIds.filter(memberId => memberId !== charId)
      ];
      return true;
    }
    function moveGroupMember(groupId, characterId, direction){
      const id = str(groupId || '').trim();
      const charId = str(characterId || '').trim();
      const delta = Number(direction) || 0;
      if (!id || !charId || !delta) return false;
      const groups = ensureGroupsState();
      const group = groups[id];
      if (!group) return false;
      const memberIds = getGroupMemberItems(id).map(item => str(item.id || '').trim()).filter(Boolean);
      const leadId = str(group.leadCharacterId || '').trim() || memberIds[0] || '';
      if (leadId && charId === leadId) return false;
      const index = memberIds.indexOf(charId);
      if (index < 0) return false;
      const minIndex = leadId && memberIds.includes(leadId) ? 1 : 0;
      const nextIndex = Math.max(minIndex, Math.min(memberIds.length - 1, index + delta));
      if (nextIndex === index) return false;
      const [moved] = memberIds.splice(index, 1);
      memberIds.splice(nextIndex, 0, moved);
      if (leadId && memberIds.includes(leadId)) {
        const withoutLead = memberIds.filter(memberId => memberId !== leadId);
        group.characterIds = [leadId, ...withoutLead];
        group.leadCharacterId = leadId;
      } else {
        group.characterIds = memberIds;
        group.leadCharacterId = memberIds[0] || '';
      }
      return true;
    }
    function moveGroupMemberToIndex(groupId, characterId, targetIndex){
      const id = str(groupId || '').trim();
      const charId = str(characterId || '').trim();
      if (!id || !charId) return false;
      const groups = ensureGroupsState();
      const group = groups[id];
      if (!group) return false;
      const memberIds = getGroupMemberItems(id).map(item => str(item.id || '').trim()).filter(Boolean);
      const leadId = str(group.leadCharacterId || '').trim() || memberIds[0] || '';
      if (leadId && charId === leadId) return false;
      const index = memberIds.indexOf(charId);
      if (index < 0) return false;
      const minIndex = leadId && memberIds.includes(leadId) ? 1 : 0;
      const safeTargetIndex = Math.max(minIndex, Math.min(memberIds.length - 1, Number(targetIndex) || 0));
      if (safeTargetIndex === index) return false;
      const [moved] = memberIds.splice(index, 1);
      memberIds.splice(safeTargetIndex, 0, moved);
      if (leadId && memberIds.includes(leadId)) {
        group.characterIds = [leadId, ...memberIds.filter(memberId => memberId !== leadId)];
        group.leadCharacterId = leadId;
      } else {
        group.characterIds = memberIds;
        group.leadCharacterId = memberIds[0] || '';
      }
      return true;
    }
    return {
      ensureGroupsState,
      getGroup,
      getCharacterGroupId,
      hydrateCharacterGroupIdsFromGroups,
      migrateLegacyGroupFieldsFromCharacters,
      getGroupLabelForCharacter,
      syncGroupsFromCharacters,
      getSeriesInitialsForGroup,
      makeNextGroupName,
      clearCharacterGroupFields,
      getGroupMemberItems,
      getGroupLeadId,
      setGroupLead,
      moveGroupMember,
      moveGroupMemberToIndex
    };
  }
  window.MudaeGroupUtils = { create };
})();

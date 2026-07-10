/* Mudae Organizer Rebuild model/helpers module. */
(function(){
  'use strict';

  if (window.MudaeRebuildModel) return;

  function uid() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  function makeStableKey(name, series) {
    return [
      str(name).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(),
      str(series).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
    ].join('||');
  }

  function ensureCharacterIdentity(ch) {
    if (!ch || isDivider(ch)) return ch;
    if (!ch.id) ch.id = uid();
    ch.stableKey = makeStableKey(ch.name, ch.series);
    return ch;
  }

  function str(value) {
    return String(value == null ? '' : value);
  }

  function escapeHtml(value) {
    return str(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function num(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(n) {
    try { return num(n).toLocaleString(); }
    catch { return String(num(n)); }
  }

  const LOCAL_ASSET_PATHS = {
    kakeraPurple: 'assets/icons/kakera/KakeraPurple.png',
    kakeraBlue: 'assets/icons/kakera/KakeraBlue.png',
    kakeraTeal: 'assets/icons/kakera/KakeraTeal.png',
    kakeraGreen: 'assets/icons/kakera/KakeraGreen.png',
    kakeraYellow: 'assets/icons/kakera/KakeraYellow.png',
    kakeraOrange: 'assets/icons/kakera/KakeraOrange.png',
    kakeraRed: 'assets/icons/kakera/KakeraRed.png',
    kakeraRainbow: 'assets/icons/kakera/KakeraRainbow.png',
    bronzeKey: 'assets/icons/keys/bronze-key.png',
    silverKey: 'assets/icons/keys/silver-key.png',
    goldKey: 'assets/icons/keys/gold-key.png',
    chaosKey: 'assets/icons/keys/chaos-key.png'
  };

  function getKakeraIconTier(value) {
    const amount = num(value);
    if (amount <= 100) return 'purple';
    if (amount <= 170) return 'blue';
    if (amount <= 250) return 'teal';
    if (amount <= 300) return 'green';
    if (amount <= 700) return 'yellow';
    if (amount <= 1400) return 'orange';
    if (amount <= 3000) return 'red';
    return 'rainbow';
  }

  function getKakeraIconPath(value) {
    const tier = getKakeraIconTier(value);
    const key = 'kakera' + tier.charAt(0).toUpperCase() + tier.slice(1);
    return LOCAL_ASSET_PATHS[key] || LOCAL_ASSET_PATHS.kakeraPurple;
  }

  const KEY_ICONS = {
    bronze: LOCAL_ASSET_PATHS.bronzeKey,
    silver: LOCAL_ASSET_PATHS.silverKey,
    gold: LOCAL_ASSET_PATHS.goldKey,
    chaos: LOCAL_ASSET_PATHS.chaosKey
  };

  function createLocalIcon(src, alt, className) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    if (className) img.className = className;
    img.onerror = () => {
      img.remove();
    };
    return img;
  }

  function getKeyTypeFromCount(keys) {
    keys = num(keys);
    if (keys >= 10) return 'chaos';
    if (keys >= 6) return 'gold';
    if (keys >= 3) return 'silver';
    if (keys >= 1) return 'bronze';
    return '';
  }

  function getDisplayKeyType(ch) {
    return getKeyTypeFromCount(ch && ch.keys);
  }

  function getKeyLabel(type) {
    return type ? type[0].toUpperCase() + type.slice(1) : 'No keys';
  }

  function splitKeysByMudaeTier(keys) {
    keys = Math.max(0, num(keys));

    return {
      // Mudae key colors are progressive:
      // 1-2 bronze, 3-5 silver, 6-9 gold, 10+ chaos.
      bronze: Math.min(keys, 2),
      silver: Math.min(Math.max(keys - 2, 0), 3),
      gold: Math.min(Math.max(keys - 5, 0), 4),
      chaos: Math.max(keys - 9, 0),
      total: keys
    };
  }

  function getKeyBreakdown(characters) {
    const out = {
      bronze: 0,
      silver: 0,
      gold: 0,
      chaos: 0,
      total: 0
    };

    characters.forEach(ch => {
      const parts = splitKeysByMudaeTier(ch.keys);
      out.bronze += parts.bronze;
      out.silver += parts.silver;
      out.gold += parts.gold;
      out.chaos += parts.chaos;
      out.total += parts.total;
    });

    return out;
  }

  function getRouletteTags(ch) {
  const tags = Array.isArray(ch && ch.mudaeTags)
    ? ch.mudaeTags.map(t => str(t).toLowerCase().replace(/^\$/, '').trim())
    : [];

  const text = [
    ch && ch.roulette,
    ch && ch.rawText,
    ch && ch.gender,
    ch && ch.type
  ].map(str).join(' ').toLowerCase();

  ['wa', 'ha', 'wg', 'hg'].forEach(tag => {
    const explicit = text.includes('$' + tag);
    const loose = new RegExp('(^|[^a-z])' + tag + '([^a-z]|$)').test(text);

    if (!tags.includes(tag) && (explicit || loose)) {
      tags.push(tag);
    }
  });

  return [...new Set(tags)].filter(tag => ['wa', 'ha', 'wg', 'hg'].includes(tag));
}

  function getGenderType(ch) {
  const tags = getRouletteTags(ch);
  const text = [
    ch && ch.roulette,
    ch && ch.rawText,
    ch && ch.gender,
    ch && ch.type
  ].map(str).join(' ').toLowerCase();

  let hasWaifu = tags.includes('wa') || tags.includes('wg');
  let hasHusbando = tags.includes('ha') || tags.includes('hg');

  // Imported and parsed entries can lose one roulette tag if only a single
  // "roulette" string was preserved, so inspect raw text and common labels too.
  if (/\$wa|\$wg|:female:|\bfemale\b|\bwaifu\b|♀/.test(text)) hasWaifu = true;
  if (/\$ha|\$hg|:male:|\bmale\b|\bhusbando\b|♂/.test(text)) hasHusbando = true;

  if (/\bboth\b|⚧|gender:both/.test(text)) {
    hasWaifu = true;
    hasHusbando = true;
  }

  if (hasWaifu && hasHusbando) return 'both';
  if (hasHusbando) return 'husbando';
  if (hasWaifu) return 'waifu';
  return 'unknown';
}

  function getRouletteWorldType(ch) {
    const tags = getRouletteTags(ch);
    const hasAnimanga = tags.includes('wa') || tags.includes('ha');
    const hasGame = tags.includes('wg') || tags.includes('hg');

    if (hasAnimanga && hasGame) return 'both';
    if (hasGame) return 'game';
    if (hasAnimanga) return 'animanga';
    return 'unknown';
  }

  function getCharacterBreakdowns(characters) {
    const gender = { waifu: 0, husbando: 0, both: 0, unknown: 0 };
    const roulette = { animanga: 0, game: 0, both: 0, unknown: 0 };

    characters.forEach(ch => {
      gender[getGenderType(ch)]++;
      roulette[getRouletteWorldType(ch)]++;
    });

    return { gender, roulette };
  }

  function getTopKakeraCharacter(characters) {
    return characters.reduce((best, ch) => {
      if (!best || num(ch.kakera) > num(best.kakera)) return ch;
      return best;
    }, null);
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

function getSpherePerkBreakdown(characters) {
    const out = {
      max: 0,
      perks: { 10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    characters.forEach(ch => {
      const levels = getSphereLevels(ch.spheres);
      if (!levels.some(Boolean)) return;

      if (isSphereMax(levels)) out.max++;

      for (let i = 0; i < 10; i++) {
        if (num(levels[i]) > 0) out.perks[i + 1]++;
      }
    });

    return out;
  }

  function genderLabel(type) {
    return ({
      waifu: '♀️ Waifu',
      husbando: '♂️ Husbando',
      both: '⚧️ Both',
      unknown: '❔ Unknown'
    })[type] || '❔ Unknown';
  }

  function genderShortLabel(type) {
    return ({
      waifu: '♀️ W',
      husbando: '♂️ H',
      both: '⚧️ B',
      unknown: '❔ ?'
    })[type] || '❔ ?';
  }

  function rouletteWorldLabel(type) {
    return ({
      animanga: '🎴 Animanga',
      game: '🎮 Game',
      both: '🔀 Both',
      unknown: '❔ Unknown'
    })[type] || '❔ Unknown';
  }

  function rouletteWorldShortLabel(type) {
    return ({
      animanga: '🎴 A',
      game: '🎮 G',
      both: '🔀 B',
      unknown: '❔ ?'
    })[type] || '❔ ?';
  }

  function isDivider(item) {
    return item && item.type === 'divider';
  }

  function normalizeUrls(value) {
    let arr = [];
    if (Array.isArray(value)) arr = value;
    else if (value && Array.isArray(value.urls)) arr = value.urls;

    return arr
      .map(url => str(url).trim())
      .filter(Boolean);
  }

  function hasRealImage(value) {
    value = str(value).trim();
    if (!value) return false;
    if (/^(about:blank|#)$/i.test(value)) return false;
    if (/^data:image\/svg\+xml/i.test(value)) return false;
    if (/placeholder|missing|no[-_ ]?image/i.test(value)) return false;
    return true;
  }

  function safeSvgText(value) {
  return str(value)
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function placeholderSvg(name = '?') {
  const cleanName = str(name).replace(/[\uD800-\uDFFF]/g, '').trim();
  const initials = Array.from(cleanName)
    .filter(ch => /\S/u.test(ch))
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const safeInitials = safeSvgText(initials);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="185" height="288" viewBox="0 0 185 288">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="#1b1b2a"/>
          <stop offset="1" stop-color="#2b1852"/>
        </linearGradient>
      </defs>
      <rect width="185" height="288" rx="18" fill="url(#g)"/>
      <circle cx="92.5" cy="104" r="44" fill="rgba(255,255,255,0.08)"/>
      <text x="92.5" y="119" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="#e9d5ff">${safeInitials}</text>
      <text x="92.5" y="230" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#c4b5fd">No image</text>
    </svg>`;

  try {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  } catch (error) {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="185" height="288" viewBox="0 0 185 288"><rect width="185" height="288" rx="18" fill="#111827"/><text x="92.5" y="144" text-anchor="middle" font-family="Segoe UI,Arial" font-size="18" fill="#c4b5fd">No image</text></svg>'
    );
  }
}


  function normalizeHexColor(value, fallback = '#8B5CF6') {
    const raw = str(value).trim();
    const compact = raw.startsWith('#') ? raw.slice(1) : raw;
    if (/^[0-9a-f]{3}$/i.test(compact)) return '#' + compact.split('').map(ch => ch + ch).join('').toUpperCase();
    if (/^[0-9a-f]{6}$/i.test(compact)) return '#' + compact.toUpperCase();
    return fallback;
  }

  function normalizeImportedPayload(payload) {
    const state = payload && payload.state ? payload.state : payload;

    if (!state || !Array.isArray(state.characters)) {
      throw new Error('JSON does not contain state.characters or characters.');
    }

    const normalized = {
      haremName: str(state.haremName || payload.haremName || ''),
      totalValue: num(state.totalValue),
      counts: state.counts && typeof state.counts === 'object' ? state.counts : {},
      characters: state.characters.map((item, index) => normalizeItem(item, index)),
      groups: state.groups ? normalizeGroups(state.groups) : {},
      exportAliasesText: str(state.exportAliasesText || ''),
      persistentOrderMap: state.persistentOrderMap && typeof state.persistentOrderMap === 'object' ? state.persistentOrderMap : {},
      orderBaselineIds: Array.isArray(state.orderBaselineIds) ? state.orderBaselineIds : []
    };

    return {
      input: str(payload.input || ''),
      meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
      state: normalized
    };
  }

  function normalizeItem(item, index) {
    item = item && typeof item === 'object' ? { ...item } : {};

    if (item.type === 'divider') {
      return {
        ...item,
        type: 'divider',
        id: str(item.id || uid()),
        title: str(item.title || 'Divider'),
        level: Math.max(1, num(item.level || 1)),
        collapsed: !!item.collapsed,
        color: normalizeHexColor(item.color || '#8B5CF6'),
        note: str(item.note || '')
      };
    }

    const gallery = normalizeUrls(item.mudaeImages);

    return {
      ...item,
      id: str(item.id || uid()),
      stableKey: makeStableKey(item.name || 'Unnamed', item.series || 'No series'),
      currentRank: num(item.currentRank || index + 1),
      name: str(item.name || 'Unnamed'),
      series: str(item.series || 'No series'),
      image: str(item.image || ''),
      editNumber: num(item.editNumber || index + 1),
      globalRank: num(item.globalRank),
      owner: str(item.owner || ''),
      note: str(item.note || ''),
      roulette: str(item.roulette || ''),
      keyType: str(item.keyType || ''),
      keys: num(item.keys),
      kakera: num(item.kakera),
      color: normalizeHexColor(item.color || '#8B5CF6'),
      mudaeTags: Array.isArray(item.mudaeTags) ? item.mudaeTags : inferTags(item.roulette),
      spheres: normalizeSpheres(item.spheres),
      mudaeImages: gallery,
      hasMudaeGallery: gallery.length > 1,
      mudaeGalleryCount: gallery.length > 1 ? gallery.length : 0,
      sortLocked: !!item.sortLocked,
      groupId: str(item.groupId || item.lockGroupId || item.group || item.groupName || item.matchGroupId || item.matchGroup || item.bubbleId || ''),
      groupLabel: str(item.groupLabel || item.lockGroupLabel || item.matchGroupLabel || item.bubbleLabel || '')
    };
  }

  function normalizeGroups(groups) {
    const out = {};
    const entries = Array.isArray(groups)
      ? groups.map((group, index) => [group?.id || group?.name || `group-${index + 1}`, group])
      : Object.entries(groups || {});

    entries.forEach(([id, group]) => {
      if (!group || typeof group !== 'object') return;

      const safeId = str(group.id || id).trim();
      if (!safeId) return;

      const rawIds = Array.isArray(group.characterIds) ? group.characterIds
        : Array.isArray(group.members) ? group.members
        : Array.isArray(group.ids) ? group.ids
        : Array.isArray(group.characters) ? group.characters
        : [];

      out[safeId] = {
        id: safeId,
        name: str(group.name || group.label || group.title || safeId).trim() || safeId,
        createdAt: str(group.createdAt || group.created || ''),
        characterIds: rawIds.map(item => str(item?.id || item)).filter(Boolean)
      };
    });

    return out;
  }

  function inferTags(roulette) {
    roulette = str(roulette).toLowerCase();
    const out = [];
    ['wa','ha','wg','hg'].forEach(tag => {
      if (roulette.includes('$' + tag) || roulette.includes(tag)) out.push(tag);
    });
    return out;
  }

  function normalizeSpheres(spheres) {
    if (!spheres || typeof spheres !== 'object') return null;

    if (Array.isArray(spheres.levels)) {
      const levels = [];
      for (let i = 0; i < 10; i++) {
        const max = i < 5 ? 6 : 1;
        levels.push(Math.max(0, Math.min(max, num(spheres.levels[i]))));
      }
      return { ...spheres, levels };
    }

    return { ...spheres };
  }

  window.MudaeRebuildModel = {
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
    getKakeraIconTier,
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
    normalizeSpheres,
    normalizeGroups,
    getSphereTotal,
    getSphereLevels,
    isSphereMax
  };
})();

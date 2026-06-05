(function(){
  'use strict';
  if (window.MudaeRebuildCards) return;
  function isAnimatedImageUrl(url) {
    url = String(url || '').toLowerCase();
    return /\.gif(?:[?#].*)?$/.test(url) || url.includes('.gif?') || url.includes('.gif#');
  }
  function normalizeEmbedColor(value, fallback = '#8B5CF6') {
    const raw = String(value || '').trim();
    const compact = raw.startsWith('#') ? raw.slice(1) : raw;
    if (/^[0-9a-f]{3}$/i.test(compact)) return '#' + compact.split('').map(ch => ch + ch).join('').toUpperCase();
    if (/^[0-9a-f]{6}$/i.test(compact)) return '#' + compact.toUpperCase();
    return fallback;
  }
  function parseInteger(value) {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  function compactNumber(value, options = {}) {
    const n = parseInteger(value);
    const fmt = options.fmt || ((v) => Number(v || 0).toLocaleString('en-US'));
    const prefix = options.prefix || '';
    const full = prefix + fmt(n);
    const compactAt = Number(options.compactAt || 1000000);
    if (n < compactAt) return { short: full, full, compacted: false, digits: String(n).length };
    const units = [[1_000_000_000_000, 'T'], [1_000_000_000, 'B'], [1_000_000, 'M'], [1_000, 'K']];
    const [size, suffix] = units.find(([unitSize]) => n >= unitSize) || units[units.length - 1];
    const scaled = n / size;
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const mode = options.rounding || 'round';
    const factor = Math.pow(10, decimals);
    const adjusted = mode === 'floor' ? Math.floor(scaled * factor) / factor : Number(scaled.toFixed(decimals));
    const short = prefix + adjusted.toFixed(decimals).replace(/\.0+$|(?<=\.\d)0$/g, '') + suffix;
    return { short, full, compacted: true, digits: String(n).length };
  }
  function applyCompactStatClass(node, info) {
    if (!node || !info) return;
    node.classList.remove('stat-text-normal', 'stat-text-long', 'stat-text-huge', 'stat-is-compacted');
    const textLen = String(info.short || '').length;
    if (info.compacted) node.classList.add('stat-is-compacted');
    if (textLen >= 8 || info.digits >= 7) node.classList.add('stat-text-huge');
    else if (textLen >= 6 || info.digits >= 5) node.classList.add('stat-text-long');
    else node.classList.add('stat-text-normal');
  }
  function getSphereStatusIconPath(isMaxed) {
    return isMaxed ? 'assets/icons/spheres/SpW.png' : 'assets/icons/spheres/SpR.png';
  }
  function renderSphereBadgeContent(badge, label, isMaxed, title) {
    if (!badge) return;
    badge.hidden = false;
    badge.classList.toggle('is-max', !!isMaxed);
    badge.classList.toggle('is-full', !!isMaxed);
    badge.classList.toggle('is-partial', !isMaxed);
    badge.classList.remove('missing-sphere-icon');
    badge.dataset.sphereMode = isMaxed ? 'full' : 'partial';
    badge.title = title || label || '';
    badge.innerHTML = '';
    const icon = document.createElement('img');
    icon.className = 'sphere-status-icon spheres-status-icon';
    icon.src = getSphereStatusIconPath(isMaxed);
    icon.alt = isMaxed ? 'Full spheres' : 'Partial spheres';
    icon.loading = 'lazy';
    icon.decoding = 'async';
    icon.dataset.sphereMode = badge.dataset.sphereMode;
    icon.onerror = () => {
      icon.remove();
      badge.classList.add('missing-sphere-icon');
    };
    const text = document.createElement('span');
    text.className = 'sphere-badge-label';
    text.textContent = label || '';
    badge.append(icon, text);
  }
  function renderCard(ch, ctx) {
    const {
      cardTemplate,
      fmt,
      hasRealImage,
      placeholderSvg,
      getCharacterListPosition,
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
      getGroupLabelForCharacter
    } = ctx;
    const node = cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = ch.id;
    const embedColor = normalizeEmbedColor(ch.color || '#8B5CF6');
    node.style.setProperty('--embed-color', embedColor);
    node.dataset.embedColor = embedColor;
    node.classList.add('has-embed-color');
    const img = node.querySelector('.char-img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.fetchPriority = 'low';
    const imageUrl = hasRealImage(ch.image) ? ch.image : '';
    const pausedSrc = placeholderSvg(ch.name);
    if (imageUrl && isAnimatedImageUrl(imageUrl) && window.MUDAE_PERF?.isGifControlEnabled?.()) {
      img.dataset.animatedSrc = imageUrl;
      img.dataset.pausedSrc = pausedSrc;
      img.src = pausedSrc;
      img.classList.add('gif-paused');
      img.title = 'GIF paused until visible';
    } else if (imageUrl && (
      window.MudaeMinimalImageLoader?.hasLoadedUrl?.(imageUrl) ||
      window.MudaeMinimalImageLoader?.hasRequestedUrl?.(imageUrl)
    )) {
      img.loading = 'eager';
      img.fetchPriority = 'auto';
      img.src = imageUrl;
      img.classList.add('image-ready-minimal');
    } else if (imageUrl) {
      img.dataset.src = imageUrl;
      img.src = pausedSrc;
      img.classList.add('image-deferred-minimal');
    } else {
      img.src = pausedSrc;
    }
    img.alt = ch.name || '';
    const position = ctx.displayPosition || ch.displayCharacterIndex || getCharacterListPosition(ch.id) || 0;
    node.querySelector('.card-position').textContent = '#' + fmt(position);
    node.querySelector('.card-position').title = 'Character position: #' + fmt(position);
    node.querySelector('.card-series').textContent = ch.series || 'No series';
    node.querySelector('.card-series').title = ch.series || 'No series';
    node.querySelector('.card-owner').textContent = ch.owner || '—';
    node.querySelector('.card-owner').title = ch.owner ? 'Owner: ' + ch.owner : 'No owner';
    node.querySelector('.char-name').textContent = ch.name || 'Unnamed';
    node.querySelector('.char-name').title = ch.name || '';
    const genderType = getGenderType(ch);
    const rouletteWorldType = getRouletteWorldType(ch);
    const genderBadge = node.querySelector('.gender-badge');
    const rouletteBadge = node.querySelector('.roulette-badge');
    genderBadge.textContent = genderLabel(genderType);
    genderBadge.classList.add('gender-' + genderType);
    genderBadge.title = 'Gender: ' + genderLabel(genderType);
    rouletteBadge.textContent = rouletteWorldLabel(rouletteWorldType);
    rouletteBadge.classList.add('roulette-' + rouletteWorldType);
    rouletteBadge.title = 'Roulette type: ' + rouletteWorldLabel(rouletteWorldType);
    const rankPill = node.querySelector('.rank-pill');
    if (rankPill) {
      const rankInfo = ch.globalRank
        ? compactNumber(ch.globalRank, { fmt, prefix: '#', compactAt: 1000000 })
        : { short: '#—', full: 'No Mudae rank', compacted: false, digits: 0 };
      rankPill.textContent = rankInfo.short;
      rankPill.title = ch.globalRank ? `Mudae rank ${rankInfo.full}` : 'No Mudae rank';
      applyCompactStatClass(rankPill, rankInfo);
    }
    const kakeraPill = node.querySelector('.kakera-pill');
    if (kakeraPill) {
      const kakeraInfo = compactNumber(ch.kakera, { fmt, compactAt: 1000000 });
      const kakeraText = kakeraInfo.short;
      const kakeraFullText = `${kakeraInfo.full} kakera`;
      kakeraPill.classList.add('has-kakera-icon');
      kakeraPill.classList.remove('missing-kakera-icon');
      kakeraPill.title = kakeraFullText;
      applyCompactStatClass(kakeraPill, kakeraInfo);
      kakeraPill.innerHTML = '';
      const kakeraTier = window.MudaeRebuildModel?.getKakeraIconTier?.(ch.kakera) || 'purple';
      kakeraPill.classList.remove('kakera-tier-purple', 'kakera-tier-blue', 'kakera-tier-teal', 'kakera-tier-green', 'kakera-tier-yellow', 'kakera-tier-orange', 'kakera-tier-red', 'kakera-tier-rainbow');
      kakeraPill.classList.add('kakera-tier-' + kakeraTier);
      kakeraPill.dataset.kakeraTier = kakeraTier;
      const kakeraIconSrc = typeof getKakeraIconPath === 'function'
        ? getKakeraIconPath(ch.kakera)
        : 'assets/icons/kakera/KakeraPurple.png';
      const kakeraIcon = createLocalIcon
        ? createLocalIcon(kakeraIconSrc, '', 'kakera-icon')
        : document.createElement('img');
      if (!createLocalIcon) {
        kakeraIcon.className = 'kakera-icon';
        kakeraIcon.src = kakeraIconSrc;
        kakeraIcon.alt = '';
        kakeraIcon.loading = 'lazy';
        kakeraIcon.decoding = 'async';
        kakeraIcon.onerror = () => { kakeraIcon.remove(); kakeraPill.classList.add('missing-kakera-icon'); };
      } else {
        kakeraIcon.onerror = () => { kakeraIcon.remove(); kakeraPill.classList.add('missing-kakera-icon'); };
      }
      kakeraIcon.dataset.kakeraTier = kakeraTier;
      const kakeraValue = document.createElement('span');
      kakeraValue.className = 'kakera-value';
      kakeraValue.textContent = kakeraText;
      kakeraPill.append(kakeraIcon, kakeraValue);
    }
    const keyType = getDisplayKeyType(ch);
    const keysPill = node.querySelector('.keys-pill');
    if (keysPill) {
      keysPill.classList.remove('key-pill', 'bronze', 'silver', 'gold', 'chaos', 'key-tier-bronze', 'key-tier-silver', 'key-tier-gold', 'key-tier-chaos', 'stat-text-normal', 'stat-text-long', 'stat-text-huge', 'stat-is-compacted');
    }
    if (keyType && KEY_ICONS[keyType]) {
      keysPill.classList.add('key-pill', keyType, 'key-tier-' + keyType);
      keysPill.innerHTML = '';
      const keyIcon = createLocalIcon
        ? createLocalIcon(KEY_ICONS[keyType], `${getKeyLabel(keyType)} key`, 'key-icon')
        : document.createElement('img');
      if (!createLocalIcon) {
        keyIcon.className = 'key-icon';
        keyIcon.src = KEY_ICONS[keyType];
        keyIcon.alt = `${getKeyLabel(keyType)} key`;
        keyIcon.loading = 'lazy';
        keyIcon.decoding = 'async';
        keyIcon.onerror = () => keyIcon.remove();
      }
      const keyValue = document.createElement('span');
      const keysInfo = compactNumber(ch.keys, { fmt, compactAt: 1000, rounding: 'floor' });
      keyValue.textContent = keysInfo.short;
      keysPill.append(keyIcon, keyValue);
      keysPill.title = `${getKeyLabel(keyType)} keys: ${keysInfo.full}`;
      applyCompactStatClass(keysPill, keysInfo);
    } else {
      keysPill.textContent = '0';
      keysPill.title = 'No keys';
      applyCompactStatClass(keysPill, { short: '0', full: '0', compacted: false, digits: 1 });
    }
    const note = node.querySelector('.card-note');
    const noteText = ch.note && String(ch.note).trim() ? String(ch.note).trim() : 'no note';
    note.hidden = false;
    note.textContent = noteText;
    note.title = noteText;
    note.classList.toggle('is-empty-note', noteText === 'no note');
    const galleryImageCount = typeof getUniqueGalleryImageCount === 'function'
      ? getUniqueGalleryImageCount(ch)
      : (normalizeUrls(ch.mudaeImages).length > 1 ? normalizeUrls(ch.mudaeImages).length : 0);
    const groupLabel = typeof getGroupLabelForCharacter === 'function' ? getGroupLabelForCharacter(ch) : '';
    if (groupLabel) {
      node.classList.add('is-grouped-card');
      node.classList.toggle('has-gallery-count', galleryImageCount > 0);
      node.classList.toggle('no-gallery-count', galleryImageCount <= 0);
      node.dataset.groupId = ch.groupId || '';
      const groupBadge = document.createElement('button');
      groupBadge.className = 'card-group-badge';
      groupBadge.type = 'button';
      groupBadge.textContent = groupLabel;
      groupBadge.title = 'Rename group: ' + groupLabel;
      groupBadge.setAttribute('aria-label', 'Rename group ' + groupLabel);
      groupBadge.dataset.groupId = ch.groupId || '';
      const imageWrap = node.querySelector('.image-wrap');
      const galleryBadge = node.querySelector('.gallery-badge');
      if (imageWrap && galleryBadge) {
        imageWrap.insertBefore(groupBadge, galleryBadge);
      } else if (imageWrap) {
        imageWrap.appendChild(groupBadge);
      }
    }
    const colorStrip = document.createElement('div');
    colorStrip.className = 'card-embed-color-strip';
    colorStrip.style.setProperty('--embed-color', embedColor);
    colorStrip.title = 'Embed color: ' + embedColor;
    colorStrip.setAttribute('aria-label', 'Embed color ' + embedColor);
    colorStrip.innerHTML = '<span class="card-embed-color-strip-fill"></span>';
    note.insertAdjacentElement('afterend', colorStrip);
    const sphereLabel = formatSpherePerkLabel(ch.spheres);
    const sphereBadge = node.querySelector('.sphere-badge');
    if (sphereLabel) {
      const sphereMaxed = sphereLabel === 'SP MAX' || (typeof isSphereMax === 'function' && isSphereMax(ch.spheres));
      renderSphereBadgeContent(sphereBadge, sphereLabel, sphereMaxed, formatSphereTooltip(ch.spheres));
    }
    const badge = node.querySelector('.gallery-badge');
    if (badge) {
      badge.hidden = galleryImageCount <= 0;
      if (galleryImageCount > 0) badge.textContent = galleryImageCount + ' imgs';
    }
    node.querySelector('.card-edit-btn').addEventListener('click', (event) => {
      event.stopPropagation();
      openEdit(ch.id);
    });
    return node;
  }
  window.MudaeRebuildCards = {
    renderCard
  };
})();

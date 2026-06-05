/* Mudae Organizer Rebuild parser module.
   Parser-only module. It must not mutate app.state or touch DOM.
*/
(function(){
  'use strict';

  if (window.MudaeRebuildParser) return;

  const {
    uid,
    str,
    num,
    makeStableKey,
    inferTags
  } = window.MudaeRebuildModel;

  const parserContext = { baseCount: 0 };

  function fullSphereLevels() {
    return [6, 6, 6, 6, 6, 1, 1, 1, 1, 1];
  }

  function emptySphereLevels() {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  function normalizeCharacterNameKey(name) {
    return str(name)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[|:：]+$/g, '')
      .trim();
  }

  function parseMudaeNumber(value) {
    return num(str(value).replace(/[.,](?=\d{3}\b)/g, '').replace(/[^\d]/g, ''));
  }

  function parseSpherePerkText(perkText, investedValue = 0) {
    perkText = str(perkText).trim();

    if (/full|max|all/i.test(perkText)) {
      return { levels: fullSphereLevels() };
    }

    const levels = emptySphereLevels();

    const nums = [...perkText.matchAll(/(?:P\s*)?([1-9]|10)\b/gi)]
      .map(m => num(m[1]))
      .filter(n => n >= 1 && n <= 10);

    nums.forEach(p => {
      levels[p - 1] = p <= 5 ? 1 : 1;
    });

    if (!nums.length && investedValue >= 40000) {
      return { levels: fullSphereLevels() };
    }

    return levels.some(Boolean) ? { levels } : null;
  }

  function parseSphereLines(text) {
    text = str(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const entries = [];
    let totalInvested = 0;

    for (const line of lines) {
      const totalMatch = line.match(/Total\s+invested\s*:\s*([\d.,]+)/i);
      if (totalMatch) {
        totalInvested = parseMudaeNumber(totalMatch[1]);
        continue;
      }

      const m = line.match(/^(.+?)(?:\s*\|\s*.*?)?\s+([\d.,]+)\s*(?::sp:|sp|spheres?)\s*(?:[-–—]\s*(.*))?$/i);
      if (!m) continue;

      let name = str(m[1])
        .replace(/\s*\|\s*.*$/g, '')
        .replace(/:[^:\s]+:/g, '')
        .trim();

      const invested = parseMudaeNumber(m[2]);
      const perkText = str(m[3] || '').trim();
      const spheres = parseSpherePerkText(perkText, invested);

      if (!name || !spheres) continue;

      entries.push({ name, invested, perkText, spheres, rawText: line });
    }

    return { totalInvested, entries };
  }

  function isSeriesSectionHeader(line) {
    line = str(line).trim();
    return /^(.+?)\s*-\s*\d+\s*\/\s*\d+\s*$/.test(line);
  }


  // v2.436: inline character image extraction used by the real parser.
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

  function dedupeImageUrls(urls) {
    const seen = new Set();
    const result = [];

    function flatten(input) {
      if (Array.isArray(input)) {
        input.forEach(flatten);
        return;
      }
      if (input != null) result.push(input);
    }

    const flat = [];
    result.splice(0, result.length);
    (function collect(input) {
      if (Array.isArray(input)) input.forEach(collect);
      else if (input != null) flat.push(input);
    })(urls);

    flat.forEach(url => {
      const clean = str(url || '').trim().replace(/[.,;)\]}]+$/g, '');
      if (!clean) return;
      const key = clean.replace(/^https?:/i, '').replace(/\?.*$/, '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(clean);
    });

    return result;
  }

  function withMainImage(character, imageUrl) {
    const image = str(imageUrl || '').trim().replace(/[.,;)\]}]+$/g, '');
    if (!character || !image) return character;

    character.image = image;
    character.imageUrl = image;
    character.mudaeImages = dedupeImageUrls([image, ...(Array.isArray(character.mudaeImages) ? character.mudaeImages : [])]);
    character.hasMudaeGallery = character.mudaeImages.length > 1;
    character.mudaeGalleryCount = character.mudaeImages.length > 1 ? character.mudaeImages.length : 0;
    return character;
  }

  function parseSeriesSectionHeader(line) {
    const m = str(line).trim().match(/^(.+?)\s*-\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!m) return null;
    return { series: m[1].trim(), owned: num(m[2]), total: num(m[3]) };
  }

  function isRankedCharacterLine(line) {
    return /^#?[\d.,]+\s*[-–]\s*/.test(str(line).trim());
  }

  function parsedOffset() {
    return 1;
  }

  function extractRouletteTagsFromText(text) {
    text = str(text).toLowerCase();
    const tags = [];

    ['wa', 'ha', 'wg', 'hg'].forEach(tag => {
      if (text.includes('$' + tag) || new RegExp('(^|[^a-z])' + tag + '([^a-z]|$)').test(text)) {
        tags.push(tag);
      }
    });

    if (/:female:|\bfemale\b|♀/.test(text) && !tags.includes('wa') && !tags.includes('wg')) {
      tags.push('wa');
    }

    if (/:male:|\bmale\b|♂/.test(text) && !tags.includes('ha') && !tags.includes('hg')) {
      tags.push('ha');
    }

    return [...new Set(tags)];
  }

  function firstRouletteTag(tags) {
    return tags && tags.length ? '$' + tags[0] : '';
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

    const rouletteTags = extractRouletteTagsFromText(rest);
    const roulette = firstRouletteTag(rouletteTags);

    const keysMatch = rest.match(/:(bronze|silver|gold|chaos)key:\s*(?:\(|\s| )*(\d+)\)?/i) ||
      rest.match(/keys?\s*[:x]?\s*(\d+)/i);
    const keyTypeMatch = rest.match(/:(bronze|silver|gold|chaos)key:/i);

    const keys = keysMatch ? num(keysMatch[2] || keysMatch[1]) : 0;
    const keyType = keyTypeMatch ? keyTypeMatch[1].toLowerCase() : '';

    const ownerMatch = rest.match(/=>\s*([^·|\n]+)/u);
    const owner = ownerMatch ? ownerMatch[1].trim() : '';

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
      currentRank: parserContext.baseCount + parsedOffset(),
      name,
      series: seriesInfo.series,
      image: inlineImage,
      imageUrl: inlineImage,
      editNumber: 0,
      globalRank,
      likeRank: 0,
      owner,
      note: '',
      roulette,
      keyType,
      keys,
      kakera,
      color: '#8B5CF6',
      mudaeTags: rouletteTags.length ? rouletteTags : inferTags(roulette),
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
    const lines = str(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .split('\n').map(line => line.trim()).filter(Boolean);

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
    return str(line).replace(/\s*:female:/gi, '').replace(/\s*:male:/gi, '').trim();
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

  function parseMudaeText(text, options = {}) {
    parserContext.baseCount = Number(options.baseCount || 0);
    text = str(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const sectionResult = parseSeriesSectionText(text);
    if (sectionResult && sectionResult.parsed.length) return sectionResult;

    const blocks = text.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
    const parsed = [];
    const skipped = [];

    blocks.forEach(block => {
      const item = parseMudaeBlock(block);
      if (item) parsed.push(item);
      else skipped.push(block);
    });

    if (!parsed.length) {
      text.split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
        const item = parseCompactLine(line);
        if (item) parsed.push(item);
      });
    }

    return { parsed, skipped };
  }

  function parseMudaeBlock(block) {
    const sectionResult = parseSeriesSectionText(block);
    if (sectionResult && sectionResult.parsed.length) return sectionResult.parsed[0];

    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length >= 2 && isSeriesSectionHeader(lines[0]) && isRankedCharacterLine(lines[1])) return null;
    if (lines.length < 2) return parseCompactLine(block);

    const first = lines[0];
    const seriesFromLines = collectSeriesFromBlockLines(lines);

    let name = first
      .replace(/^#?[\d.,]+\s*[-–]\s*/, '')
      .replace(/\s*💞.*$/u, '')
      .replace(/\s*=>.*$/u, '')
      .trim();

    if (!name) return null;

    const ownerMatch = first.match(/=>\s*([^·\n]+)/u);
    const owner = ownerMatch ? ownerMatch[1].trim() : '';

    const rouletteTags = extractRouletteTagsFromText(block);
    const roulette = firstRouletteTag(rouletteTags) || inferRouletteFromText(block);

    const kakeraMatch = block.match(/([\d.,]+)\s*(?::kakera:|ka\b|kakera\b)/i);
    const kakera = kakeraMatch ? parseMudaeNumber(kakeraMatch[1]) : 0;

    const claimMatch = block.match(/Claim\s*rank\s*:\s*#?\s*([\d.,]+)/i) || block.match(/#\s*([\d.,]+)/);
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
      currentRank: parserContext.baseCount + parsedOffset(),
      name,
      series: seriesFromLines || 'No series',
      image,
      editNumber: 0,
      globalRank,
      likeRank,
      owner,
      note: '',
      roulette: roulette || (genderType ? '$' + genderType : ''),
      keyType,
      keys,
      kakera,
      color: '#8B5CF6',
      mudaeTags: rouletteTags.length ? rouletteTags : inferTags(roulette || genderType),
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
      currentRank: parserContext.baseCount + parsedOffset(),
      name,
      series,
      image: '',
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
      mudaeImages: [],
      hasMudaeGallery: false,
      mudaeGalleryCount: 0,
      sortLocked: false,
      rawText: line
    };
  }

  function inferRouletteFromText(text) {
    text = str(text).toLowerCase();
    if (text.includes(':female:')) return '$wa';
    if (text.includes(':male:')) return '$ha';
    return '';
  }

  function looksLikeSphereDump(text) {
    text = str(text);
    if (/Total\s+invested\s*:/i.test(text)) return true;
    if (/(?:^|\n).+?\s+[\d.,]+\s*(?::sp:|sp|spheres?)\s*(?:[-–—]\s*(?:full|max|all|[0-9Pp,+\s]+))?/i.test(text)) return true;
    return false;
  }

  function isSphereEntryLine(line) {
    line = str(line).trim();
    if (!line) return false;
    if (/^Total\s+invested\s*:/i.test(line)) return true;
    return /^.+?(?:\s*\|\s*.*?)?\s+[\d.,]+\s*(?::sp:|sp|spheres?)\s*(?:[-–—]\s*(?:full|max|all|[0-9Pp,+\s]+))?$/i.test(line);
  }

  function stripSphereOnlyLines(text) {
    return str(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (isSphereEntryLine(trimmed)) return false;
        if (/^[^\w\d]*White haired supremacy/i.test(trimmed)) return false;
        return true;
      })
      .join('\n')
      .trim();
  }

  function looksLikeCharacterDump(text) {
    text = str(text);
    return /Claim\s*rank\s*:/i.test(text) ||
      /Like\s*rank\s*:/i.test(text) ||
      /:kakera:|kakera\b|ka\b/i.test(text) ||
      /\$w[ag]|\$h[ag]/i.test(text) ||
      /:female:|:male:/i.test(text);
  }

  function hasRealCharacterEntries(text) {
    const stripped = stripSphereOnlyLines(text);
    if (!stripped) return false;
    return looksLikeCharacterDump(stripped);
  }

  window.MudaeRebuildParser = {
    normalizeCharacterNameKey,
    parseSphereLines,
    parseMudaeNumber,
    looksLikeSphereDump,
    isSphereEntryLine,
    stripSphereOnlyLines,
    looksLikeCharacterDump,
    hasRealCharacterEntries,
    parseMudaeText
  };
})();

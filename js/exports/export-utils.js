/* Mudae Organizer Rebuild export utilities.
   Pure helpers for $sm/$smp chunk building and changed-export labels.
   Kept dependency-free so exports.js can focus on UI/state wiring.
*/
(function(){
  'use strict';

  if (window.MudaeExportUtils) return;

  const DEFAULT_CHUNK_LIMIT = 1850;

  function cleanName(value){
    return String(value || '').trim();
  }

  function cleanNameList(names){
    return Array.from(names || [])
      .map(cleanName)
      .filter(Boolean);
  }

  function uniqueNameList(names){
    return Array.from(new Set(cleanNameList(names)));
  }

  function buildChunksFromNames(names, prefix, limit = DEFAULT_CHUNK_LIMIT){
    const chunks = [];
    const command = `${prefix} `;
    let current = command;

    cleanNameList(names).forEach(name => {
      const piece = current === command ? name : `$${name}`;
      const candidate = current + piece;

      if (current !== command && candidate.length > limit) {
        chunks.push(current);
        current = command + name;
        return;
      }

      current = candidate;
    });

    if (current !== command) chunks.push(current);
    return chunks;
  }

  function buildChunkRecordsFromNames(names, prefix, limit = DEFAULT_CHUNK_LIMIT){
    const records = [];
    const command = `${prefix} `;
    let current = command;
    let currentNames = [];

    cleanNameList(names).forEach(name => {
      const piece = current === command ? name : `$${name}`;
      const candidate = current + piece;

      if (current !== command && candidate.length > limit) {
        records.push({ text: current, names: currentNames });
        current = command + name;
        currentNames = [name];
        return;
      }

      current = candidate;
      currentNames.push(name);
    });

    if (current !== command) records.push({ text: current, names: currentNames });
    return records;
  }

  function buildMixedSmSmpChunksFromNames(names, limit = DEFAULT_CHUNK_LIMIT){
    const chunks = [];
    let command = '$sm ';
    let current = command;

    cleanNameList(names).forEach(name => {
      const piece = current === command ? name : `$${name}`;
      const candidate = current + piece;

      if (current !== command && candidate.length > limit) {
        chunks.push(current);
        command = '$smp ';
        current = command + name;
        return;
      }

      current = candidate;
    });

    if (current !== command) chunks.push(current);
    return chunks;
  }

  function formatAffectedNames(names, maxVisible = 4){
    const clean = uniqueNameList(names);
    if (!clean.length) return 'Changed characters';

    const visible = clean.slice(0, maxVisible);
    const hidden = clean.length - visible.length;
    return hidden > 0
      ? `${visible.join(' + ')} + ${hidden} more`
      : visible.join(' + ');
  }

  function clampDisplayRange(center, total, radius = 1){
    const mid = Math.max(1, Number(center) || 1);
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeRadius = Math.max(0, Number(radius) || 0);

    return {
      start: Math.max(1, mid - safeRadius),
      end: Math.min(safeTotal || Number.MAX_SAFE_INTEGER, mid + safeRadius),
      center: mid
    };
  }

  function normalizeStoredRange(entry, total, radius = 1){
    const storedStart = Number(entry?.start || 0);
    const storedEnd = Number(entry?.end || 0);
    const safeTotal = Math.max(0, Number(total) || 0);

    if (storedStart > 0 || storedEnd > 0) {
      const fallbackCenter = Number(entry?.toPosition || entry?.center || storedStart || storedEnd || 1) || 1;
      const start = Math.max(1, storedStart || storedEnd || fallbackCenter);
      const unclampedEnd = Math.max(start, storedEnd || storedStart || fallbackCenter);
      const end = Math.min(safeTotal || Number.MAX_SAFE_INTEGER, unclampedEnd);
      const center = Math.max(start, Math.min(end, Number(entry?.center || entry?.toPosition || Math.round((start + end) / 2)) || start));

      return { start, end, center };
    }

    return clampDisplayRange(entry?.toPosition || entry?.center || 1, safeTotal, radius);
  }

  window.MudaeExportUtils = {
    DEFAULT_CHUNK_LIMIT,
    cleanName,
    cleanNameList,
    uniqueNameList,
    buildChunksFromNames,
    buildChunkRecordsFromNames,
    buildMixedSmSmpChunksFromNames,
    formatAffectedNames,
    clampDisplayRange,
    normalizeStoredRange
  };
})();

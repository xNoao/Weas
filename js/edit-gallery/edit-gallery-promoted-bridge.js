(function(){
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function syncOpenClasses(){
    const overlay = $('#editOverlay');
    const gallery = $('#galleryPanel');
    const editOpen = !!overlay?.classList?.contains('show');
    const galleryOpen = !!gallery && !gallery.hidden && gallery.getAttribute('hidden') === null;
    document.body?.classList?.toggle('edit-open', editOpen);
    document.body?.classList?.toggle('gallery-open', galleryOpen);
    document.body?.classList?.toggle('edit-gallery-open', editOpen && galleryOpen);
  }
  function updateSpheresSummary(){
    const grid = $('#spheresGrid');
    const summary = $('#spheresSummary');
    if (!grid || !summary) return;
    const inputs = $$('[data-sphere-index]', grid)
      .sort((a,b) => Number(a.dataset.sphereIndex || 0) - Number(b.dataset.sphereIndex || 0));
    if (!inputs.length) {
      summary.textContent = 'No spheres';
      return;
    }
    const values = inputs.map(input => Number(input.value || 0));
    const active = values.filter(v => v > 0).length;
    const total = values.reduce((sum, value, index) => {
      if (index < 5) return sum + Math.max(0, Math.min(6, value));
      return sum + (value > 0 ? 1 : 0);
    }, 0);
    summary.textContent = active ? `Partial · ${active}/10 perks · ${total} levels` : 'No spheres';
  }
  function setAllSpheres(){
    const grid = $('#spheresGrid');
    if (!grid) return;
    $$('[data-sphere-index]', grid).forEach(input => {
      const index = Number(input.dataset.sphereIndex || 0);
      input.value = index < 5 ? '6' : '1';
      input.dispatchEvent(new Event('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
    });
    updateSpheresSummary();
  }
  function clearSpheres(){
    const grid = $('#spheresGrid');
    if (!grid) return;
    $$('[data-sphere-index]', grid).forEach(input => {
      input.value = '0';
      input.dispatchEvent(new Event('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
    });
    updateSpheresSummary();
  }
  function bindSpheresButtons(){
    const all = $('#spheresAllBtn');
    const clear = $('#spheresClearBtn');
    if (all && all.dataset.promotedBound !== '1') {
      all.dataset.promotedBound = '1';
      all.addEventListener('click', event => {
        event.preventDefault();
        setAllSpheres();
      });
    }
    if (clear && clear.dataset.promotedBound !== '1') {
      clear.dataset.promotedBound = '1';
      clear.addEventListener('click', event => {
        event.preventDefault();
        clearSpheres();
      });
    }
  }
  function bindGalleryGlow(){
    const grid = $('#galleryGrid');
    if (!grid || grid.dataset.promotedGlowBound === '1') return;
    grid.dataset.promotedGlowBound = '1';
    grid.addEventListener('click', event => {
      const card = event.target.closest?.('.gallery-card');
      if (!card || !grid.contains(card)) return;
      card.classList.remove('mhp-selection-glow');
      void card.offsetWidth;
      card.classList.add('mhp-selection-glow');
      window.setTimeout(() => card.classList.remove('mhp-selection-glow'), 1300);
    }, true);
  }
  function init(){
    bindSpheresButtons();
    bindGalleryGlow();
    syncOpenClasses();
    updateSpheresSummary();
    const overlay = $('#editOverlay');
    const gallery = $('#galleryPanel');
    const grid = $('#spheresGrid');
    if (overlay && overlay.dataset.promotedObserved !== '1') {
      overlay.dataset.promotedObserved = '1';
      new MutationObserver(syncOpenClasses).observe(overlay, { attributes:true, attributeFilter:['class','hidden','aria-hidden'] });
    }
    if (gallery && gallery.dataset.promotedObserved !== '1') {
      gallery.dataset.promotedObserved = '1';
      new MutationObserver(syncOpenClasses).observe(gallery, { attributes:true, attributeFilter:['hidden','class','aria-hidden'] });
    }
    if (grid && grid.dataset.promotedObserved !== '1') {
      grid.dataset.promotedObserved = '1';
      new MutationObserver(updateSpheresSummary).observe(grid, { childList:true, subtree:true, attributes:true, attributeFilter:['value'] });
      grid.addEventListener('input', updateSpheresSummary);
      grid.addEventListener('change', updateSpheresSummary);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
  window.addEventListener('mhp-gallery-rendered', () => {
    bindGalleryGlow();
    syncOpenClasses();
  });
  window.addEventListener('mhp-visual-mode-change', syncOpenClasses);
  window.MudaePromotedEditGallery = {
    syncOpenClasses,
    updateSpheresSummary,
    setAllSpheres,
    clearSpheres
  };
})();

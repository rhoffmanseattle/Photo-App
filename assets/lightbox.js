// Fullscreen photo viewer using PhotoSwipe v5.
//
// Activates two surfaces:
//   1. Photo grid tiles (.photo-grid[data-pswp-gallery] a) — open the
//      viewer at the clicked tile, swipe through the rest of the grid.
//   2. Photo detail page hero (.photo-stage[data-pswp-gallery] a) —
//      open the viewer at the current photo, swipe through the album.
//
// Each clickable element carries data-pswp-src/width/height attrs that
// describe the full-resolution image. The thumbnail (link's <img>) is
// used as the placeholder for an instant transition.
//
// PhotoSwipe + Lightbox UMD bundles must be loaded before this script.

(function () {
  "use strict";

  function init() {
    if (typeof PhotoSwipeLightbox === "undefined" || typeof PhotoSwipe === "undefined") return;

    initGalleries();
    initDetailHero();
  }

  // Wire any element with [data-pswp-gallery] containing <a> children.
  function initGalleries() {
    document.querySelectorAll("[data-pswp-gallery]").forEach(function (gallery) {
      // Skip the detail page hero — it has its own init below
      if (gallery.classList.contains("photo-stage")) return;

      var anchors = Array.from(gallery.querySelectorAll("a[data-pswp-src]"));
      if (!anchors.length) return;

      var dataSource = anchors.map(makeItem);

      anchors.forEach(function (anchor, index) {
        anchor.addEventListener("click", function (e) {
          // Allow open-in-new-tab modifiers
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          openLightbox(dataSource, index, anchor);
        });
      });
    });
  }

  // Detail page hero: dataSource is the full album sequence (embedded
  // as JSON), index is the current photo's position within it.
  function initDetailHero() {
    var heroGallery = document.querySelector(".photo-stage[data-pswp-gallery]");
    if (!heroGallery) return;

    var dataNode = document.getElementById("photo-page-gallery");
    if (!dataNode) return;

    var dataSource;
    try {
      dataSource = JSON.parse(dataNode.textContent);
    } catch (err) {
      return;
    }
    if (!Array.isArray(dataSource) || !dataSource.length) return;

    var currentId = window.PHOTO_PAGE_ID;
    var currentIndex = dataSource.findIndex(function (item) { return item.id === currentId; });
    if (currentIndex < 0) currentIndex = 0;

    var trigger = heroGallery.querySelector("a[data-pswp-src]");
    if (!trigger) return;

    trigger.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openLightbox(dataSource, currentIndex, trigger);
    });
  }

  // Build a PhotoSwipe item from an anchor with data-pswp-* attrs.
  function makeItem(anchor) {
    var img = anchor.querySelector("img");
    return {
      src: anchor.dataset.pswpSrc,
      width: parseInt(anchor.dataset.pswpWidth, 10) || 0,
      height: parseInt(anchor.dataset.pswpHeight, 10) || 0,
      msrc: img ? img.src : "",
      alt: img ? img.alt : "",
    };
  }

  function openLightbox(dataSource, index, _trigger) {
    var pswp = new PhotoSwipe({
      dataSource: dataSource,
      index: index,
      bgOpacity: 0.95,
      showHideAnimationType: "fade",
      pswpModule: PhotoSwipe,
    });
    pswp.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

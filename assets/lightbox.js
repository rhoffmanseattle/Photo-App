// Fullscreen photo viewer using PhotoSwipe v5.
//
// Per-page gallery is embedded as a JSON script tag (#pswp-gallery-data)
// containing the full per-photo metadata. Each clickable element is
// either a tile <a> inside .photo-grid[data-pswp-gallery] or the hero
// <a> inside .photo-stage[data-pswp-gallery]. We compute the click
// index from the anchor's position in the gallery (or by photo id for
// the detail page hero) and open PhotoSwipe with the full dataSource.
//
// PhotoSwipe ships a custom 'caption' UI element below the photo
// showing title + EXIF + permalink for the current slide. The element
// inherits PhotoSwipe's tap-toggle chrome behavior so on mobile a tap
// hides the panel for clean viewing; on desktop the tap-toggle still
// works but it's also fine to leave the panel up.

(function () {
  "use strict";

  function init() {
    if (typeof PhotoSwipe === "undefined") return;

    var dataSource = readGalleryData();
    if (!dataSource || !dataSource.length) return;

    initGalleryClicks(dataSource);
    initDetailHeroClick(dataSource);
  }

  function readGalleryData() {
    var node = document.getElementById("pswp-gallery-data");
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (err) {
      return null;
    }
  }

  // Photo grid pages: each tile <a> opens the viewer at its position.
  function initGalleryClicks(dataSource) {
    var grid = document.querySelector(
      ".photo-grid[data-pswp-gallery], .photo-grid--dense[data-pswp-gallery]",
    );
    if (!grid) return;

    var anchors = Array.from(grid.querySelectorAll(":scope > li > a"));
    anchors.forEach(function (anchor, index) {
      anchor.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openLightbox(dataSource, index);
      });
    });
  }

  // Photo detail page: hero <a> opens viewer at the current photo's
  // position within its album sequence (matched by id).
  function initDetailHeroClick(dataSource) {
    var heroGallery = document.querySelector(".photo-stage[data-pswp-gallery]");
    if (!heroGallery) return;
    var trigger = heroGallery.querySelector("a");
    if (!trigger) return;

    var currentId = window.PHOTO_PAGE_ID;
    var currentIndex = dataSource.findIndex(function (item) {
      return item.id === currentId;
    });
    if (currentIndex < 0) currentIndex = 0;

    trigger.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openLightbox(dataSource, currentIndex);
    });
  }

  function openLightbox(dataSource, index) {
    var pswp = new PhotoSwipe({
      dataSource: dataSource,
      index: index,
      bgOpacity: 0.95,
      showHideAnimationType: "fade",
    });

    pswp.on("uiRegister", function () {
      pswp.ui.registerElement({
        name: "photo-meta",
        order: 9,
        isButton: false,
        appendTo: "root",
        html: "",
        onInit: function (el, pswpInstance) {
          el.classList.add("pswp-meta");
          var update = function () {
            var item = pswpInstance.currSlide && pswpInstance.currSlide.data;
            el.innerHTML = renderCaption(item);
          };
          pswpInstance.on("change", update);
          pswpInstance.on("afterInit", update);
        },
      });
    });

    pswp.init();
  }

  function renderCaption(item) {
    if (!item) return "";

    var titleHtml = item.title
      ? '<div class="pswp-meta__title">' + escapeHtml(item.title) + "</div>"
      : "";

    var captionHtml = item.caption
      ? '<div class="pswp-meta__caption">' + escapeHtml(item.caption) + "</div>"
      : "";

    var primary = [];
    if (item.camera) primary.push(item.camera);
    if (item.exposure) primary.push(item.exposure);
    if (item.date) primary.push(item.date);
    if (item.location) primary.push(item.location);
    if (item.album) primary.push(item.album);

    var primaryHtml = primary.length
      ? '<div class="pswp-meta__row">' +
        primary.map(function (s) { return "<span>" + escapeHtml(s) + "</span>"; }).join("") +
        "</div>"
      : "";

    var permalinkHtml = item.href
      ? '<a class="pswp-meta__permalink" href="' + escapeAttr(item.href) + '">view detail page →</a>'
      : "";

    return (
      '<div class="pswp-meta__inner">' +
      titleHtml +
      captionHtml +
      primaryHtml +
      permalinkHtml +
      "</div>"
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

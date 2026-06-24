// Live home grid — no redeploy needed for photo changes.
//
// The page ships server-rendered tiles (fast first paint, SEO, works with
// JS off). This script then asks the Netlify function for the CURRENT photo
// list from Flickr and, if it succeeds, refreshes the grid head with live
// data — so photos added / removed / reordered on Flickr show up on a plain
// refresh, without a rebuild. It also drives infinite scroll from that same
// live payload.
//
// Graceful degradation: if the live function is unavailable (local dev, a
// Flickr blip, an old browser), we fall back to exactly the previous
// behavior — the static server-rendered head plus infinite scroll fed by
// the build-time /data/home-recent.json. Nothing regresses.
//
// Index integrity with the lightbox: we rebuild the head from fresh tile
// HTML (new anchors, no stale listeners), reset the lightbox dataSource to
// the live order, then append each subsequent batch and extend the
// dataSource in lockstep. anchors[i] always maps to dataSource[i].

(function () {
  "use strict";

  var LIVE_URL = "/.netlify/functions/home-recent";
  var STATIC_URL = "/data/home-recent.json";

  var grid = document.querySelector("[data-home-grid]");
  if (!grid) return;
  var sentinel = grid.querySelector("[data-home-sentinel]");

  var initialCount = intAttr(grid, "data-initial-count", 60);
  var batchSize = intAttr(grid, "data-batch-size", 30);

  var tiles = [];        // tile HTML strings for the *tail* (after the head)
  var lightbox = [];     // aligned lightbox metadata for the tail
  var nextOffset = 0;    // index into tiles/lightbox for the next batch
  var observer = null;
  var pumping = false;

  start();

  function start() {
    fetchJson(LIVE_URL)
      .then(function (json) {
        applyLive(json);
      })
      .catch(function () {
        // Live path unavailable — fall back to the static, build-time data.
        fallbackStatic();
      });
  }

  // -- Live path -----------------------------------------------------------

  function applyLive(json) {
    if (!validShape(json)) throw new Error("live payload shape unexpected");

    var headTiles = json.tiles.slice(0, initialCount);
    var headLightbox = json.lightbox.slice(0, initialCount);

    // Rebuild the head with fresh nodes, then hand the lightbox the live
    // order so click indices line up with what's now on screen.
    var headAnchors = replaceHead(headTiles);
    if (window.PhotoGallery && typeof window.PhotoGallery.reset === "function") {
      window.PhotoGallery.reset(headLightbox, headAnchors);
    }

    // Tail (everything past the head) feeds infinite scroll.
    tiles = json.tiles.slice(initialCount);
    lightbox = json.lightbox.slice(initialCount);
    nextOffset = 0;
    grid.setAttribute("data-remaining", String(tiles.length));

    armInfiniteScroll();
  }

  // Replace the grid's current tiles (everything except the sentinel) with
  // freshly parsed live tiles. Returns the new anchors in order.
  function replaceHead(tileHtml) {
    var liEls = Array.prototype.slice.call(grid.querySelectorAll(":scope > li"));
    for (var i = 0; i < liEls.length; i++) {
      if (liEls[i] !== sentinel) grid.removeChild(liEls[i]);
    }

    var parsed = parseTiles(tileHtml);
    var anchors = [];
    var frag = document.createDocumentFragment();
    for (var j = 0; j < parsed.nodes.length; j++) {
      if (parsed.anchors[j]) anchors.push(parsed.anchors[j]);
      frag.appendChild(parsed.nodes[j]);
    }
    if (sentinel) grid.insertBefore(frag, sentinel);
    else grid.appendChild(frag);
    return anchors;
  }

  // -- Static fallback (previous behavior) ---------------------------------

  function fallbackStatic() {
    if (!sentinel) return; // nothing to append into
    fetchJson(STATIC_URL)
      .then(function (json) {
        if (!validShape(json)) throw new Error("static payload shape unexpected");
        // Static file holds only the tail (after the server-rendered head).
        tiles = json.tiles;
        lightbox = json.lightbox;
        nextOffset = 0;
        grid.setAttribute("data-remaining", String(tiles.length));
        armInfiniteScroll();
      })
      .catch(function (err) {
        warn(err);
      });
  }

  // -- Infinite scroll (shared by both paths) ------------------------------

  function armInfiniteScroll() {
    if (!sentinel) return;
    if (!tiles.length) {
      teardown();
      return;
    }
    if (typeof IntersectionObserver !== "function") return;

    if (observer) observer.disconnect();
    observer = new IntersectionObserver(onIntersect, {
      root: null,
      rootMargin: "800px 0px",
      threshold: 0,
    });
    observer.observe(sentinel);
  }

  function onIntersect(entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        pump();
        break;
      }
    }
  }

  function pump() {
    if (pumping) return;
    pumping = true;
    try {
      appendBatch();
    } finally {
      pumping = false;
    }
  }

  function appendBatch() {
    var sliceTiles = tiles.slice(nextOffset, nextOffset + batchSize);
    var sliceLightbox = lightbox.slice(nextOffset, nextOffset + batchSize);
    if (!sliceTiles.length) {
      teardown();
      return;
    }

    var parsed = parseTiles(sliceTiles);
    var frag = document.createDocumentFragment();
    var anchors = [];
    for (var i = 0; i < parsed.nodes.length; i++) {
      if (parsed.anchors[i]) anchors.push(parsed.anchors[i]);
      frag.appendChild(parsed.nodes[i]);
    }
    grid.insertBefore(frag, sentinel);

    if (window.PhotoGallery && typeof window.PhotoGallery.extend === "function") {
      window.PhotoGallery.extend(sliceLightbox, anchors);
    }

    nextOffset += sliceTiles.length;
    var remaining = Math.max(0, tiles.length - nextOffset);
    grid.setAttribute("data-remaining", String(remaining));
    if (remaining === 0) teardown();
  }

  function teardown() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (sentinel && sentinel.parentNode) {
      sentinel.parentNode.removeChild(sentinel);
      sentinel = null;
    }
  }

  // -- helpers -------------------------------------------------------------

  function parseTiles(htmlArr) {
    var scratch = document.createElement("ul");
    scratch.innerHTML = htmlArr.join("\n");
    var nodes = Array.prototype.slice.call(scratch.children);
    var anchors = nodes.map(function (n) { return n.querySelector("a"); });
    return { nodes: nodes, anchors: anchors };
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error(url + " HTTP " + res.status);
      return res.json();
    });
  }

  function validShape(json) {
    return json &&
      Array.isArray(json.tiles) &&
      Array.isArray(json.lightbox) &&
      json.tiles.length === json.lightbox.length;
  }

  function intAttr(el, name, def) {
    var v = parseInt(el.getAttribute(name) || "", 10);
    return v && v > 0 ? v : def;
  }

  function warn(err) {
    if (window.console && console.warn) console.warn("[home-live]", err);
  }
})();

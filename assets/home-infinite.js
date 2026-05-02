// Infinite scroll for the home grid.
//
// On page load the home grid contains the first HOME_INITIAL_COUNT
// tiles (server-rendered). This script fetches /data/home-recent.json
// on idle, then appends additional tiles in batches of HOME_BATCH_SIZE
// each time the sentinel <li> approaches the viewport.
//
// Design notes:
// - Pre-rendered tile HTML strings ship in the JSON so the client never
//   has to mirror the server's tile template. Drift-proof.
// - dataSource for PhotoSwipe lives in lightbox.js at module scope;
//   we extend it via window.PhotoGallery.extend() after each append
//   so newly-loaded tiles open the lightbox at the correct index.
// - The sentinel lives inside the grid (so CSS multi-column masonry
//   keeps flowing items naturally). It's invisible (aria-hidden) and
//   takes zero space in the column flow.
// - rootMargin biases the observer to fire before the user actually
//   reaches the bottom — gives the next batch a head start.
// - Once the data file is exhausted we disconnect the observer and
//   remove the sentinel from the DOM.
//
// Failure modes: if the fetch fails (network, 404, parse error) we
// log to console and stop trying. The grid stays at its initial size,
// no error UI shown — the page is still usable.

(function () {
  "use strict";

  var grid = document.querySelector("[data-home-grid]");
  if (!grid) return;
  var sentinel = grid.querySelector("[data-home-sentinel]");
  if (!sentinel) return;

  var batchSize = parseInt(grid.getAttribute("data-batch-size") || "30", 10);
  if (!batchSize || batchSize < 1) batchSize = 30;

  var data = null;        // { initialCount, batchSize, total, tiles[], lightbox[] }
  var dataPromise = null; // single-flight fetch
  var nextOffset = 0;     // index into data.tiles / data.lightbox for next batch
  var observer = null;
  var pumping = false;    // re-entry guard while we're appending a batch

  // Kick off the prefetch on idle — by the time the user scrolls past
  // the first HOME_INITIAL_COUNT tiles, the data is usually already
  // here. requestIdleCallback isn't in Safari yet, so fall back to
  // a setTimeout shim.
  var schedulePrefetch = window.requestIdleCallback || function (cb) {
    return setTimeout(cb, 200);
  };
  schedulePrefetch(function () {
    ensureData().catch(function () {
      // Already logged in ensureData; nothing further to do.
    });
  });

  // Observer fires as the sentinel approaches the viewport. rootMargin
  // 800px gives us a head start before the user actually sees the
  // bottom of the grid.
  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver(onIntersect, {
      root: null,
      rootMargin: "800px 0px",
      threshold: 0,
    });
    observer.observe(sentinel);
  } else {
    // Very old browsers: leave the initial 60 in place. No fallback
    // scroll handler — the cost/benefit doesn't pencil out.
    return;
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
    ensureData()
      .then(function () {
        appendBatch();
      })
      .catch(function () {
        // Ensure-failure already disconnected the observer.
      })
      .then(function () {
        pumping = false;
      });
  }

  // Single-flight fetch of /data/home-recent.json. Resolves once the
  // payload is parsed and assigned to `data`. On failure rejects and
  // disconnects the observer so we stop trying.
  function ensureData() {
    if (data) return Promise.resolve(data);
    if (dataPromise) return dataPromise;

    dataPromise = fetch("/data/home-recent.json", { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("home-recent.json HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json || !Array.isArray(json.tiles) || !Array.isArray(json.lightbox)) {
          throw new Error("home-recent.json shape unexpected");
        }
        if (json.tiles.length !== json.lightbox.length) {
          throw new Error("home-recent.json arrays out of sync");
        }
        data = json;
        return data;
      })
      .catch(function (err) {
        if (window.console && console.warn) {
          console.warn("[home-infinite]", err);
        }
        teardown();
        throw err;
      });

    return dataPromise;
  }

  // Pull the next batchSize items from `data`, append their tile HTML
  // to the grid (right before the sentinel so it stays at the bottom),
  // then register the new anchors with the lightbox.
  function appendBatch() {
    if (!data) return;
    var slice = data.tiles.slice(nextOffset, nextOffset + batchSize);
    var lightboxSlice = data.lightbox.slice(nextOffset, nextOffset + batchSize);
    if (!slice.length) {
      teardown();
      return;
    }

    // Compose into a fragment via a throwaway parent so we can grab
    // the resulting <li>s and their anchors after parse.
    var scratch = document.createElement("ul");
    scratch.innerHTML = slice.join("\n");
    var newItems = Array.from(scratch.children);
    var fragment = document.createDocumentFragment();
    var newAnchors = [];
    for (var i = 0; i < newItems.length; i++) {
      var anchor = newItems[i].querySelector("a");
      if (anchor) newAnchors.push(anchor);
      fragment.appendChild(newItems[i]);
    }

    grid.insertBefore(fragment, sentinel);

    if (window.PhotoGallery && typeof window.PhotoGallery.extend === "function") {
      window.PhotoGallery.extend(lightboxSlice, newAnchors);
    }

    nextOffset += slice.length;
    var remaining = Math.max(0, data.tiles.length - nextOffset);
    grid.setAttribute("data-remaining", String(remaining));

    if (remaining === 0) {
      teardown();
    }
  }

  function teardown() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (sentinel && sentinel.parentNode) {
      sentinel.parentNode.removeChild(sentinel);
    }
  }
})();

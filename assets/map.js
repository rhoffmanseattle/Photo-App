// /map/ page: initialize the Leaflet map after Leaflet's UMD bundle loads.

(function () {
  "use strict";

  function init() {
    if (typeof L === "undefined") return;
    var points = window.PHOTO_MAP_POINTS || [];
    var el = document.getElementById("photo-map");
    if (!el || !points.length) return;

    var lats = points.map(function (p) { return p.lat; });
    var lngs = points.map(function (p) { return p.lng; });
    var south = Math.min.apply(null, lats);
    var north = Math.max.apply(null, lats);
    var west = Math.min.apply(null, lngs);
    var east = Math.max.apply(null, lngs);

    var map = L.map(el, {
      scrollWheelZoom: false, // require ctrl/cmd, avoids hijacking page scroll
      worldCopyJump: true,
    });

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 10);
    } else {
      map.fitBounds([[south, west], [north, east]], { padding: [40, 40] });
    }

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    points.forEach(function (p) {
      var marker = L.marker([p.lat, p.lng]).addTo(map);
      var popupHtml =
        '<a class="map-popup" href="' + escapeAttr(p.href) + '">' +
        (p.thumb ? '<img src="' + escapeAttr(p.thumb) + '" alt="" />' : "") +
        '<div class="map-popup__meta">' +
        (p.title ? '<div class="map-popup__title">' + escapeHtml(p.title) + "</div>" : "") +
        (p.location ? '<div class="map-popup__location">' + escapeHtml(p.location) + "</div>" : "") +
        "</div>" +
        "</a>";
      marker.bindPopup(popupHtml, { maxWidth: 240, minWidth: 200 });
    });
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

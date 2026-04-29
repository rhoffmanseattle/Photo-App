import { head, header, footer, escapeHtml, SITE_URL } from "./_partials.js";

// Renders /map/index.html: a Leaflet map showing every geotagged photo.
//
// Uses CartoDB Positron tiles for a clean, light, monochrome basemap that
// doesn't fight the photo pin colors. No API key required for low-volume
// personal use; attribution is kept in the map footer.
export function renderMap({ geotaggedPhotos, totalPhotos, buildTime }) {
  const points = geotaggedPhotos.map((p) => ({
    id: p.id,
    lat: p.geo.lat,
    lng: p.geo.lng,
    title: p.title || "",
    location: p.location || "",
    thumb: p.urls.small || p.urls.medium || p.urls.thumb || "",
    href: `/p/${p.id}/`,
  }));

  const empty = points.length === 0;

  const body = `<div class="shell shell--map-head">
  ${header()}
  <p class="section-label">map</p>
  <h2 class="display">Where the work was made.</h2>
  <p class="lede">${points.length} of ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"} are geotagged. The rest aren't on the map yet — geotagging happens automatically for new phone shots, or by hand on Flickr.</p>
</div>
${empty ? renderEmptyState() : `<div id="photo-map" class="photo-map" aria-label="Map of photo locations"></div>`}
<div class="shell">
  ${footer({ buildTime })}
</div>
${empty ? "" : `
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" integrity="sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" integrity="sha512-BB3hKbKWOc9Ez/TAwyWxNXeoV9c1v6FIeYiBieIWkpLjauysF18NzgR1MBNBXf8/KABdlkX68nAhlwcDFLGPCQ==" crossorigin="anonymous" referrerpolicy="no-referrer" defer></script>
<script>
  window.PHOTO_MAP_POINTS = ${JSON.stringify(points)};
</script>
<script src="/assets/map.js" defer></script>
`}`;

  return `${head({
    title: "Map",
    description: "Map of geotagged photos by Ryan Hoffman.",
    ogUrl: SITE_URL + "/map/",
  })}
<body>
${body}
</body>
</html>`;
}

function renderEmptyState() {
  return `<div class="shell">
  <p class="empty">No geotagged photos yet. Geotag a photo on Flickr (or upload one with GPS EXIF) and it'll appear here on the next build.</p>
</div>`;
}

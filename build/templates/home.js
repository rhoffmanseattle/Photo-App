import { head, header, footer, escapeHtml, imgDims, lightboxAssets, lightboxItem, SITE_URL } from "./_partials.js";

// Initial server-rendered tile count and subsequent infinite-scroll
// batch size. Both are echoed into the rendered page as data
// attributes so the client can read them without duplication.
export const HOME_INITIAL_COUNT = 60;
export const HOME_BATCH_SIZE = 30;

// Recent grid: most recent N photos across all collections. The first
// HOME_INITIAL_COUNT are rendered server-side; anything beyond is
// loaded by /assets/home-infinite.js as the user scrolls.
//
// `photos` is the *full* sorted-recent list; we slice here so the
// build script can pass a single array and reuse it for the data
// file emitted to /data/home-recent.json.
export function renderHome({ photos, buildTime }) {
  const initialPhotos = photos.slice(0, HOME_INITIAL_COUNT);
  const remainingCount = Math.max(0, photos.length - HOME_INITIAL_COUNT);

  const tiles = initialPhotos.length
    ? initialPhotos.map(renderHomeTile).join("\n")
    : `<li class="empty">No public photos yet.</li>`;
  const galleryItems = initialPhotos.map((p) => lightboxItem(p));

  // Sentinel sits inside the grid as a final <li> so CSS multi-column
  // masonry doesn't have to special-case anything outside the grid.
  // home-live.js observes this element and triggers the next batch when
  // it intersects the viewport. We emit it whenever any photos render
  // (not just when the static build has a tail) because the live feed
  // may surface more photos than were baked in at build time.
  const sentinel = initialPhotos.length
    ? `    <li class="photo-grid__sentinel" data-home-sentinel aria-hidden="true"></li>`
    : "";

  const body = `<div class="shell">
  ${header()}
  <p class="section-label">recent</p>
  <ul class="photo-grid photo-grid--dense"
      data-pswp-gallery
      data-home-grid
      data-initial-count="${HOME_INITIAL_COUNT}"
      data-batch-size="${HOME_BATCH_SIZE}"
      data-remaining="${remainingCount}">
${tiles}
${sentinel}
  </ul>
  ${footer({ buildTime })}
</div>
<script id="pswp-gallery-data" type="application/json">${JSON.stringify(galleryItems)}</script>
${lightboxAssets()}
${initialPhotos.length ? `<script src="/assets/home-live.js" defer></script>` : ""}`;

  return `${head({
    title: "",
    description: "Recent photographs by Ryan Hoffman.",
    ogUrl: SITE_URL + "/",
  })}
<body>
${body}
</body>
</html>`;
}

// Exported so the build script can render tiles into the JSON shipped
// to the client for infinite scroll. Keep this in lockstep with the
// markup the renderer emits above, since both feed the same grid.
export function renderHomeTile(p) {
  const href = `/p/${p.id}/`;
  const src = p.urls.small || p.urls.medium || p.urls.thumb || "";
  const srcset = buildSrcset(p.urls);
  const alt = p.title || "Photograph";

  return `    <li class="photo-tile">
      <a href="${href}" aria-label="${escapeHtml(alt)}">
        <img
          src="${src}"
          ${srcset ? `srcset="${srcset}"` : ""}
          sizes="(max-width: 500px) 100vw, (max-width: 1024px) 50vw, 240px"
          ${imgDims(p)}
          alt="${escapeHtml(alt)}"
          loading="lazy"
          decoding="async"
        />
        ${p.title ? `<span class="photo-tile__caption">${escapeHtml(p.title)}</span>` : ""}
      </a>
    </li>`;
}

function buildSrcset(urls) {
  const parts = [];
  if (urls.small) parts.push(`${urls.small} 320w`);
  if (urls.medium) parts.push(`${urls.medium} 640w`);
  if (urls.large) parts.push(`${urls.large} 1024w`);
  return parts.join(", ");
}

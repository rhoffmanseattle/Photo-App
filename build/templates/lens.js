import { head, header, footer, escapeHtml, imgDims, lightboxAssets, lightboxItem, SITE_URL } from "./_partials.js";

export function renderLens({ lens, photos, buildTime }) {
  const photoList = lens.photoIds
    .map((id) => photos[id])
    .filter(Boolean);
  const tiles = photoList.length
    ? photoList.map(renderTile).join("\n")
    : `<li class="empty">No photos for this lens.</li>`;
  const galleryItems = photoList.map((p) => lightboxItem(p));

  const body = `<div class="shell">
  ${header()}
  <p class="section-label"><a href="/g/">gear</a> / ${escapeHtml(lens.title)}</p>
  <h2 class="display">${escapeHtml(lens.title)}</h2>
  <p class="lede">${lens.photoIds.length} photo${lens.photoIds.length === 1 ? "" : "s"} from this lens.</p>
  <ul class="photo-grid" data-pswp-gallery>
${tiles}
  </ul>
  ${footer({ buildTime })}
</div>
<script id="pswp-gallery-data" type="application/json">${JSON.stringify(galleryItems)}</script>
${lightboxAssets()}`;

  const cover = lens.photoIds
    .map((id) => photos[id])
    .find((p) => p && (p.urls.large || p.urls.medium));
  const ogImage = cover ? cover.urls.large || cover.urls.medium : "";

  return `${head({
    title: lens.title,
    description: `Photographs taken with ${lens.title}.`,
    ogUrl: SITE_URL + `/l/${lens.slug}/`,
    ogImage,
  })}
<body>
${body}
</body>
</html>`;
}

function renderTile(p) {
  const href = `/p/${p.id}/`;
  const src = p.urls.medium || p.urls.small || p.urls.thumb || "";
  const srcset = buildSrcset(p.urls);
  const alt = p.title || "Photograph";

  return `    <li class="photo-tile">
      <a href="${href}" aria-label="${escapeHtml(alt)}">
        <img
          src="${src}"
          ${srcset ? `srcset="${srcset}"` : ""}
          sizes="(max-width: 500px) 100vw, (max-width: 1024px) 50vw, 320px"
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

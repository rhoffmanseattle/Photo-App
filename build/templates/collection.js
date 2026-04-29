import { head, header, footer, escapeHtml, imgDims, SITE_URL } from "./_partials.js";

export function renderCollection({ collection, photos, buildTime }) {
  const tiles = collection.photoIds.length
    ? collection.photoIds
        .map((id) => photos[id])
        .filter(Boolean)
        .map(renderTile)
        .join("\n")
    : `<li class="empty">This collection is empty.</li>`;

  const body = `<div class="shell">
  ${header()}
  <p class="section-label"><a href="/c/">collections</a> / ${escapeHtml(collection.title)}</p>
  <h2 class="display">${escapeHtml(collection.title)}</h2>
  ${collection.description ? `<p class="lede">${escapeHtml(collection.description)}</p>` : ""}
  <ul class="photo-grid">
${tiles}
  </ul>
  ${footer({ buildTime })}
</div>`;

  const cover = collection.photoIds
    .map((id) => photos[id])
    .find((p) => p && (p.urls.large || p.urls.medium));
  const ogImage = cover ? cover.urls.large || cover.urls.medium : "";

  return `${head({
    title: collection.title,
    description: collection.description || `Photographs in ${collection.title}.`,
    ogUrl: SITE_URL + `/c/${collection.slug}/`,
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

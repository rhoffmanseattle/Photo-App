import { head, header, footer, escapeHtml, SITE_URL } from "./_partials.js";

export function renderCamera({ camera, photos, buildTime }) {
  const tiles = camera.photoIds.length
    ? camera.photoIds
        .map((id) => photos[id])
        .filter(Boolean)
        .map(renderTile)
        .join("\n")
    : `<li class="empty">No photos for this camera.</li>`;

  const body = `<div class="shell">
  ${header()}
  <p class="section-label"><a href="/g/">cameras</a> / ${escapeHtml(camera.title)}</p>
  <h2 class="display">${escapeHtml(camera.title)}</h2>
  <p class="lede">${camera.photoIds.length} photo${camera.photoIds.length === 1 ? "" : "s"} from this camera.</p>
  <ul class="photo-grid">
${tiles}
  </ul>
  ${footer({ buildTime })}
</div>`;

  const cover = camera.photoIds
    .map((id) => photos[id])
    .find((p) => p && (p.urls.large || p.urls.medium));
  const ogImage = cover ? cover.urls.large || cover.urls.medium : "";

  return `${head({
    title: camera.title,
    description: `Photographs taken with ${camera.title}.`,
    ogUrl: SITE_URL + `/g/${camera.slug}/`,
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
          sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"
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

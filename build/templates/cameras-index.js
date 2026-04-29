import { head, header, footer, escapeHtml, imgDims, SITE_URL } from "./_partials.js";

export function renderCamerasIndex({ cameras, photos, buildTime }) {
  const cards = cameras.length
    ? cameras.map((c) => renderCard(c, photos)).join("\n")
    : `<li class="empty">No camera EXIF found in your photos yet.</li>`;

  const body = `<div class="shell">
  ${header()}
  <p class="section-label">cameras</p>
  <h2 class="display">By the gear that made them.</h2>
  <p class="lede">Auto-grouped from EXIF. Photos without camera metadata aren't included.</p>
  <ul class="collection-list">
${cards}
  </ul>
  ${footer({ buildTime })}
</div>`;

  return `${head({
    title: "Cameras",
    description: "Photos grouped by the camera that made them.",
    ogUrl: SITE_URL + "/g/",
  })}
<body>
${body}
</body>
</html>`;
}

function renderCard(c, allPhotos) {
  const cover = c.photoIds
    .map((id) => allPhotos[id])
    .find((p) => p && (p.urls.medium || p.urls.large || p.urls.small));
  const coverUrl = cover ? cover.urls.medium || cover.urls.large || cover.urls.small : "";
  const count = c.photoIds.length;

  return `    <li class="collection-card">
      <a href="/g/${c.slug}/">
        <div class="collection-card__cover">
          ${coverUrl ? `<img src="${coverUrl}" ${imgDims(cover)} alt="" loading="lazy" decoding="async" />` : ""}
        </div>
        <h3 class="collection-card__title">${escapeHtml(c.title)}</h3>
        <p class="collection-card__meta">${count} photo${count === 1 ? "" : "s"}</p>
      </a>
    </li>`;
}

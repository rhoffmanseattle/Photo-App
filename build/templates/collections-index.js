import { head, header, footer, escapeHtml, imgDims, SITE_URL } from "./_partials.js";

export function renderCollectionsIndex({ collections, photos, buildTime }) {
  const cards = collections.length
    ? collections.map((c) => renderCard(c, photos)).join("\n")
    : `<li class="empty">No collections yet.</li>`;

  const body = `<div class="shell">
  ${header()}
  <p class="section-label">collections</p>
  <h2 class="display">An archive of moments, grouped.</h2>
  <p class="lede">Each collection is an album on Flickr. Updated automatically.</p>
  <ul class="collection-list">
${cards}
  </ul>
  ${footer({ buildTime })}
</div>`;

  return `${head({
    title: "Collections",
    description: "Photo collections by Ryan Hoffman.",
    ogUrl: SITE_URL + "/c/",
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
      <a href="/c/${c.slug}/">
        <div class="collection-card__cover">
          ${coverUrl ? `<img src="${coverUrl}" ${imgDims(cover)} alt="" loading="lazy" decoding="async" />` : ""}
        </div>
        <h3 class="collection-card__title">${escapeHtml(c.title)}</h3>
        <p class="collection-card__meta">${count} photo${count === 1 ? "" : "s"}</p>
        ${c.description ? `<p class="collection-card__desc">${escapeHtml(c.description)}</p>` : ""}
      </a>
    </li>`;
}

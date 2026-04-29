import { head, header, footer, escapeHtml, imgDims, SITE_URL } from "./_partials.js";

// Recent grid: most recent N photos across all collections.
export function renderHome({ photos, buildTime }) {
  const tiles = photos.length
    ? photos.map(renderTile).join("\n")
    : `<li class="empty">No public photos yet.</li>`;

  const body = `<div class="shell">
  ${header()}
  <p class="section-label">recent</p>
  <ul class="photo-grid photo-grid--dense">
${tiles}
  </ul>
  ${footer({ buildTime })}
</div>`;

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

function renderTile(p) {
  const href = `/p/${p.id}/`;
  const src = p.urls.small || p.urls.medium || p.urls.thumb || "";
  const srcset = buildSrcset(p.urls);
  const alt = p.title || "Photograph";

  return `    <li class="photo-tile">
      <a href="${href}" aria-label="${escapeHtml(alt)}">
        <img
          src="${src}"
          ${srcset ? `srcset="${srcset}"` : ""}
          sizes="(max-width: 720px) 50vw, (max-width: 1200px) 33vw, 280px"
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

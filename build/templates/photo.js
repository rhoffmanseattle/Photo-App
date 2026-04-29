import { head, escapeHtml, imgDims, SITE_URL } from "./_partials.js";

export function renderPhoto({ photo, collection, prev, next }) {
  const exifRows = renderExifRows(photo);
  const ogImage = photo.urls.large || photo.urls.medium || "";
  const heroSrc = photo.urls.large || photo.urls.medium || photo.urls.small || "";
  const heroSrcset = buildSrcset(photo.urls);
  const collectionHref = collection ? `/c/${collection.slug}/` : "/";
  const collectionTitle = collection ? collection.title : "All photos";

  const description = photo.caption
    ? truncate(photo.caption, 160)
    : exifSummary(photo) || `Photograph by Ryan Hoffman.`;

  const navPrev = prev
    ? `<a href="/p/${prev.id}/" rel="prev">← previous</a>`
    : `<span class="photo-nav__placeholder">← previous</span>`;
  const navNext = next
    ? `<a href="/p/${next.id}/" rel="next">next →</a>`
    : `<span class="photo-nav__placeholder">next →</span>`;

  const body = `<main
  class="photo-page"
  data-photo-page
  data-prev="${prev ? `/p/${prev.id}/` : ""}"
  data-next="${next ? `/p/${next.id}/` : ""}"
  data-collection="${collectionHref}"
>
  <div class="photo-stage">
    <img
      src="${heroSrc}"
      ${heroSrcset ? `srcset="${heroSrcset}"` : ""}
      sizes="(max-width: 900px) 100vw, calc(100vw - 380px)"
      ${imgDims(photo)}
      alt="${escapeHtml(photo.title || "Photograph")}"
      decoding="async"
      fetchpriority="high"
    />
  </div>
  <aside class="photo-meta">
    <div>
      <a class="photo-back" href="${collectionHref}">← ${escapeHtml(collectionTitle)}</a>
      <h1 class="photo-meta__title">${escapeHtml(photo.title || "Untitled")}</h1>
    </div>
    ${photo.caption ? `<p class="photo-meta__caption">${escapeHtml(photo.caption)}</p>` : ""}
    ${exifRows ? `<dl class="exif">\n${exifRows}\n    </dl>` : ""}
    <nav class="photo-nav">
      ${navPrev}
      ${navNext}
    </nav>
  </aside>
</main>
<script src="/assets/app.js" defer></script>`;

  return `${head({
    title: photo.title || `Photo ${photo.id}`,
    description,
    ogUrl: SITE_URL + `/p/${photo.id}/`,
    ogImage,
  })}
<body>
${body}
</body>
</html>`;
}

function renderExifRows(photo) {
  const rows = [];
  const e = photo.exif || {};
  if (e.camera) rows.push(["Camera", e.camera]);
  if (e.lens) rows.push(["Lens", e.lens]);
  if (e.focal) rows.push(["Focal", e.focal]);
  if (e.exposure) rows.push(["Exposure", e.exposure]);
  if (photo.dateTaken) rows.push(["Date", formatDate(photo.dateTaken)]);
  if (photo.location) rows.push(["Location", photo.location]);
  if (photo.collectionTitle) rows.push(["Album", photo.collectionTitle]);

  return rows
    .map(
      ([k, v]) =>
        `      <dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`,
    )
    .join("\n");
}

function exifSummary(photo) {
  const e = photo.exif || {};
  const bits = [e.camera, e.exposure].filter(Boolean);
  return bits.join(" · ");
}

function formatDate(iso) {
  // Flickr date_taken format: "YYYY-MM-DD HH:MM:SS"
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = months[parseInt(mo, 10) - 1] || mo;
  return `${monthName} ${parseInt(d, 10)}, ${y}`;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function buildSrcset(urls) {
  const parts = [];
  if (urls.medium) parts.push(`${urls.medium} 640w`);
  if (urls.large) parts.push(`${urls.large} 1024w`);
  if (urls.original) parts.push(`${urls.original} 2048w`);
  return parts.join(", ");
}

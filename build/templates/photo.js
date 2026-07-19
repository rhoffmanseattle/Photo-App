import { head, header, escapeHtml, lightboxAssets, lightboxItem, lightboxSource, SITE_URL } from "./_partials.js";

export function renderPhoto({ photo, collection, prev, next, albumPhotos }) {
  const exifRows = renderExifRows(photo);
  const ogImage = photo.urls.large || photo.urls.medium || "";
  const heroSrc = photo.urls.large || photo.urls.medium || photo.urls.small || "";
  const heroSrcset = buildSrcset(photo.urls);
  const collectionHref = collection ? `/c/${collection.slug}/` : "/";
  const collectionTitle = collection ? collection.title : "All photos";

  // Album sequence for the lightbox: every photo in this collection,
  // in order, with the lightbox source URL, natural dims, and full
  // metadata for the in-viewer caption panel.
  const galleryItems = (albumPhotos || [photo]).map((p) =>
    lightboxItem(p, { albumTitle: collection ? collection.title : "" }),
  );

  const heroLs = lightboxSource(photo);

  const description = photo.caption
    ? truncate(photo.caption, 160)
    : exifSummary(photo) || `Photograph by Ryan Hoffman.`;

  const navPrev = prev
    ? `<a href="/p/${prev.id}/" rel="prev">← previous</a>`
    : `<span class="photo-nav__placeholder">← previous</span>`;
  const navNext = next
    ? `<a href="/p/${next.id}/" rel="next">next →</a>`
    : `<span class="photo-nav__placeholder">next →</span>`;

  const body = `<div class="photo-shell">
  ${header()}
</div>
<main
  class="photo-page"
  data-photo-page
  data-prev="${prev ? `/p/${prev.id}/` : ""}"
  data-next="${next ? `/p/${next.id}/` : ""}"
  data-collection="${collectionHref}"
>
  <div class="photo-stage" data-pswp-gallery>
    <a href="${heroLs.src}"
       data-pswp-src="${heroLs.src}"
       data-pswp-width="${heroLs.width}"
       data-pswp-height="${heroLs.height}"
       aria-label="Open ${escapeHtml(photo.title || "photo")} in fullscreen viewer">
      <img
        src="${heroSrc}"
        ${heroSrcset ? `srcset="${heroSrcset}"` : ""}
        sizes="(max-width: 900px) 100vw, calc(100vw - 380px)"
        alt="${escapeHtml(photo.title || "Photograph")}"
        decoding="async"
        fetchpriority="high"
      />
    </a>
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
<script>window.PHOTO_PAGE_ID = ${JSON.stringify(photo.id)};</script>
<script id="pswp-gallery-data" type="application/json">${JSON.stringify(galleryItems)}</script>
<script src="/assets/app.js" defer></script>
${lightboxAssets()}`;

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
  if (urls.h) parts.push(`${urls.h} 1600w`);
  if (urls.k) parts.push(`${urls.k} 2048w`);
  return parts.join(", ");
}

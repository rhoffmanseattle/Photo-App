// Shared HTML fragments used by the build script's renderer.
// Keeping these as JS so we can compose with template literals easily,
// and so a single source of truth defines the head/header/footer chrome.

export const SITE_TITLE = "photo.longwalkhome.net";
export const SITE_DESC = "Photographs by Ryan Hoffman.";
export const SITE_URL = "https://photo.longwalkhome.net";

export function head({ title, description, ogImage, ogUrl, extra = "" }) {
  const fullTitle = title ? `${title} — ${SITE_TITLE}` : SITE_TITLE;
  const desc = description || SITE_DESC;
  const url = ogUrl || SITE_URL;
  const image = ogImage || "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeAttr(desc)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://live.staticflickr.com" crossorigin />
  <link rel="dns-prefetch" href="https://live.staticflickr.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inconsolata:wght@400;500&family=Inter:wght@400;500&display=swap" />
  <link rel="stylesheet" href="/assets/style.css" />
  <link rel="alternate" type="application/rss+xml" title="${escapeAttr(SITE_TITLE)}" href="/feed.xml" />
  <meta property="og:type" content="${image ? "article" : "website"}" />
  <meta property="og:title" content="${escapeAttr(fullTitle)}" />
  <meta property="og:description" content="${escapeAttr(desc)}" />
  <meta property="og:url" content="${escapeAttr(url)}" />
  ${image ? `<meta property="og:image" content="${escapeAttr(image)}" />` : ""}
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
  ${extra}
</head>`;
}

export function header() {
  return `<header class="site-header">
  <h1 class="site-title"><a href="/">photo.longwalkhome.net</a></h1>
  <nav class="site-nav">
    <a href="/">recent</a>
    <a href="/c/">collections</a>
    <a href="/g/">cameras</a>
    <a href="/map/">map</a>
    <a href="/about/">about</a>
  </nav>
</header>`;
}

export function footer({ buildTime } = {}) {
  const stamp = buildTime
    ? new Date(buildTime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `<footer class="site-footer">
  <span>© ${new Date().getFullYear()} Ryan Hoffman</span>
  <span>built ${escapeHtml(stamp)} · <a href="https://www.flickr.com/photos/76894493@N00/">flickr</a> · <a href="/feed.xml">rss</a></span>
</footer>`;
}

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(s) {
  return escapeHtml(s);
}

// PhotoSwipe v5 (UMD bundles via jsdelivr) + the local lightbox.js init.
// Include on any page that has photo grids or the photo detail hero.
export function lightboxAssets() {
  return `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.css" />
<script src="https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/umd/photoswipe.umd.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/umd/photoswipe-lightbox.umd.min.js" defer></script>
<script src="/assets/lightbox.js" defer></script>`;
}

// Pick the largest reasonably-sized URL for the lightbox view. Prefer
// 2K/3K variants when available (good detail without huge downloads),
// fall back through the chain. Returns the URL, plus the dims of that
// variant so PhotoSwipe knows what to expect.
//
// Note: dims for the smaller resized variants are computed proportionally
// from the original dims since Flickr's API only returns dims for the
// variants we explicitly requested. We have dims.large and dims.original.
export function lightboxSource(photo) {
  var u = photo.urls || {};
  var d = photo.dims || {};
  // Prefer the largest publicly-served variant
  var src = u["3k"] || u.k || u.h || u.large || u.medium || u.small || "";

  // Use the original dims (true natural size) if available, else large dims
  var w = (d.original && d.original.w) || (d.large && d.large.w) || 1024;
  var h = (d.original && d.original.h) || (d.large && d.large.h) || 768;

  return { src: src, width: w, height: h };
}

// Format a Flickr date_taken value ("YYYY-MM-DD HH:MM:SS") as a human
// readable date for the caption. Returns empty string for missing input.
export function formatDate(iso) {
  if (!iso) return "";
  var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  var months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[parseInt(m[2], 10) - 1] + " " + parseInt(m[3], 10) + ", " + m[1];
}

// Build a complete PhotoSwipe data item with metadata for the in-viewer
// caption panel. opts.albumTitle is used when the photo is being rendered
// in the context of a specific album sequence (the photo detail page).
export function lightboxItem(photo, opts) {
  opts = opts || {};
  var ls = lightboxSource(photo);
  var e = photo.exif || {};
  return {
    id: photo.id,
    src: ls.src,
    width: ls.width,
    height: ls.height,
    msrc: photo.urls.medium || photo.urls.small || "",
    alt: photo.title || "",
    href: "/p/" + photo.id + "/",
    title: photo.title || "",
    caption: photo.caption || "",
    camera: e.camera || "",
    lens: e.lens || "",
    focal: e.focal || "",
    exposure: e.exposure || "",
    date: formatDate(photo.dateTaken || ""),
    location: photo.location || "",
    album: opts.albumTitle || photo.collectionTitle || "",
  };
}

// Format a byte count as a human-readable string. 1.23 GB style.
export function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${rounded} ${units[i]}`;
}

// Return width/height attributes for an img tag based on a photo's
// known dimensions, so the browser reserves space and avoids layout
// shift before the image loads. Returns "" if no dims are known.
// The actual rendered size is governed by CSS; these values just lock
// the aspect ratio.
export function imgDims(photo) {
  const d =
    (photo && photo.dims && photo.dims.original) ||
    (photo && photo.dims && photo.dims.large) ||
    (photo && photo.dims && photo.dims.medium);
  if (!d || !d.w || !d.h) return "";
  return `width="${d.w}" height="${d.h}"`;
}

// Slugify album titles into URL-safe collection slugs.
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

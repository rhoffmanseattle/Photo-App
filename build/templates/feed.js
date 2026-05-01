// build/templates/feed.js
//
// Renders an RSS 2.0 + Media RSS feed of the most recent photos.
// Output lives at /feed.xml. One item per photo, ordered by Flickr
// upload timestamp (newest first), matching the home page logic.
//
// Spec choices:
// - RSS 2.0 with Media RSS extension. Most photo-friendly feed
//   readers (NetNewsWire, Reeder, Feedly) inline images via
//   <enclosure> and <media:content>. Atom would also work but adds
//   no value here.
// - Description body is small HTML: image plus an EXIF block. Keeps
//   readers that show full content visually consistent with the site
//   without dragging in the full lightbox markup.
// - <enclosure> uses the "large" Flickr variant (~1024px). Plenty of
//   detail without forcing readers to download multi-megabyte
//   originals on every fetch.
// - <pubDate> is RFC 822 from dateUpload (when the photo appeared on
//   the site), mirroring how the home grid sorts.
//
// Length of `enclosure` is required by the RSS 2.0 spec; we pass the
// measured byte count from the build script. If a photo's bytes
// weren't successfully measured we fall back to 0, which most
// readers tolerate.

import { SITE_TITLE, SITE_DESC, SITE_URL, escapeHtml, formatDate } from "./_partials.js";

const FEED_LIMIT = 50;
const FEED_PATH = "/feed.xml";
const AUTHOR = "Ryan Hoffman";

export const FEED_URL = SITE_URL + FEED_PATH;

export function renderFeed({ photos, buildTime }) {
  const items = [...photos]
    .filter((p) => p.urls.medium || p.urls.large || p.urls.small)
    .sort((a, b) => {
      const da = parseInt(a.dateUpload || "0", 10);
      const db = parseInt(b.dateUpload || "0", 10);
      if (db !== da) return db - da;
      return (b.dateTaken || "").localeCompare(a.dateTaken || "");
    })
    .slice(0, FEED_LIMIT);

  const lastBuild = rfc822(buildTime || new Date().toISOString());
  const channelDate = items[0] ? rfc822FromUpload(items[0].dateUpload) : lastBuild;

  const itemXml = items.map(renderItem).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL + "/")}</link>
    <description>${escapeXml(SITE_DESC)}</description>
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} ${escapeXml(AUTHOR)}</copyright>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <pubDate>${channelDate}</pubDate>
    <generator>photo.longwalkhome.net build</generator>
    <atom:link href="${escapeXml(FEED_URL)}" rel="self" type="application/rss+xml" />
${itemXml}
  </channel>
</rss>
`;
}

function renderItem(p) {
  const permalink = SITE_URL + `/p/${p.id}/`;
  const title = p.title || p.rawTitle || `Photo ${p.id}`;
  const enclosureUrl = pickEnclosureUrl(p.urls);
  const enclosureDims = pickEnclosureDims(p);
  const thumbUrl = p.urls.medium || p.urls.small || enclosureUrl;
  const pubDate = rfc822FromUpload(p.dateUpload);
  const itemHtml = renderItemHtml(p, enclosureUrl);
  const bytes = p.bytes && p.bytes > 0 ? p.bytes : 0;
  const exifSummary = buildExifSummary(p);

  return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(permalink)}</link>
      <guid isPermaLink="true">${escapeXml(permalink)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(AUTHOR)}</dc:creator>
      ${p.collectionTitle ? `<category>${escapeXml(p.collectionTitle)}</category>` : ""}
      <description><![CDATA[${itemHtml}]]></description>
      <content:encoded><![CDATA[${itemHtml}]]></content:encoded>
      <enclosure url="${escapeXml(enclosureUrl)}" length="${bytes}" type="image/jpeg" />
      <media:content url="${escapeXml(enclosureUrl)}" medium="image" type="image/jpeg"${enclosureDims}>
        <media:title type="plain">${escapeXml(title)}</media:title>
        ${exifSummary ? `<media:description type="plain">${escapeXml(exifSummary)}</media:description>` : ""}
      </media:content>
      <media:thumbnail url="${escapeXml(thumbUrl)}" />
    </item>`;
}

// HTML body shown inside feed readers. Keep this lean: a single
// image (linked to the permalink) and a small EXIF summary block.
function renderItemHtml(p, enclosureUrl) {
  const exifLines = exifLines_(p);
  const captionLine = p.caption ? `<p>${escapeHtml(p.caption)}</p>` : "";
  const exifBlock = exifLines.length
    ? `<pre style="font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 1.5;">${exifLines.map(escapeHtml).join("\n")}</pre>`
    : "";
  return `<p><a href="${escapeAttr(SITE_URL + "/p/" + p.id + "/")}"><img src="${escapeAttr(enclosureUrl)}" alt="${escapeAttr(p.title || "Photograph")}" style="max-width: 100%; height: auto;" /></a></p>${captionLine}${exifBlock}`;
}

// Produce the same EXIF block the photo detail page shows, but as
// plain lines suitable for a <pre> tag in feed readers. Skip empty
// fields so the block stays tight.
function exifLines_(p) {
  const e = p.exif || {};
  const lines = [];
  const push = (label, value) => {
    if (!value) return;
    lines.push(`${label.padEnd(12)} ${value}`);
  };
  push("CAMERA", e.camera);
  push("LENS", e.lens);
  push("FOCAL", e.focal);
  push("EXPOSURE", e.exposure);
  push("DATE", formatDate(p.dateTaken));
  push("LOCATION", p.location);
  push("ALBUM", p.collectionTitle);
  return lines;
}

// One-line EXIF summary used inside <media:description>. Plain text,
// no line breaks: "Olympus E-M5 II · 85mm · 1/500 f/5.6 ISO 200".
function buildExifSummary(p) {
  const e = p.exif || {};
  const parts = [];
  if (e.camera) parts.push(e.camera);
  if (e.focal) parts.push(e.focal);
  if (e.exposure) parts.push(e.exposure);
  return parts.join(" · ");
}

// Pick the URL we hand to feed readers as the canonical image. Large
// (~1024px) is the sweet spot: readable on a phone, not enormous.
function pickEnclosureUrl(urls) {
  return urls.large || urls.medium || urls.h || urls.small || "";
}

// Width/height attributes for media:content, when we know them. Use
// dims.large if available, otherwise leave them off.
function pickEnclosureDims(p) {
  const d = p.dims && p.dims.large;
  if (!d || !d.w || !d.h) return "";
  return ` width="${d.w}" height="${d.h}"`;
}

// --- Date formatting ---------------------------------------------

// Convert an ISO-ish string (build time, "2026-04-30T12:00:00Z") to
// the RFC 822 format RSS 2.0 requires.
function rfc822(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

// Flickr's dateUpload is a Unix timestamp in seconds (string).
function rfc822FromUpload(uploadStr) {
  const n = parseInt(uploadStr || "0", 10);
  if (!n) return new Date().toUTCString();
  return new Date(n * 1000).toUTCString();
}

// --- Escaping ----------------------------------------------------

// XML escaping for element text and attributes. Stricter than the
// HTML escapers in _partials.js — for example, ' must be encoded
// inside attribute values for XML strict parsers.
function escapeXml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Inside CDATA we can use HTML-style escaping; keep using the
// _partials helpers via re-export-ish locals to avoid a circular
// dependency surprise later.
function escapeAttr(s) {
  return escapeXml(s);
}

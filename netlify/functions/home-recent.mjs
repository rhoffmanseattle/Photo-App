// netlify/functions/home-recent.mjs
//
// Live counterpart to the build-time /data/home-recent.json. Fetches the
// most recent public photos straight from Flickr on request, normalizes
// them, and renders the SAME { tiles, lightbox } shape the home grid and
// PhotoSwipe already consume — reusing the build's template functions so
// the markup can never drift from the static build.
//
// Why this exists: the static site bakes photos in at build time, so new
// Flickr uploads only appear after a redeploy. The client (assets/home-live.js)
// calls this endpoint on load and swaps fresh photos into the grid, so
// adding / removing / reordering photos on Flickr shows up on a refresh —
// no redeploy.
//
// Response is cached on Netlify's CDN for ~5 minutes (s-maxage=300) so we
// don't hit Flickr on every visit. New photos surface within that window.
//
// EXIF note: tiles need no EXIF, and the lightbox degrades gracefully —
// for live photos we ship title/date/caption/permalink but leave the
// per-shot camera/lens/exposure fields empty (they require an extra Flickr
// call per photo). The static build still carries full EXIF; live-appended
// photos pick it up on the next rebuild.

import { renderHomeTile, HOME_INITIAL_COUNT, HOME_BATCH_SIZE } from "../../build/templates/home.js";
import { lightboxItem, proxyImageUrls } from "../../build/templates/_partials.js";

const API_KEY = process.env.FLICKR_API_KEY;
const USER_ID = process.env.FLICKR_USER_ID;

// Recent photostream cap. A personal portfolio comfortably fits in one page.
const PER_PAGE = 500;

const REST = "https://api.flickr.com/services/rest/";

export async function handler() {
  if (!API_KEY || !USER_ID) {
    return json(500, { error: "Missing FLICKR_API_KEY or FLICKR_USER_ID env var." });
  }

  try {
    const photos = await fetchRecentPhotos();
    const sorted = photos
      .filter((p) => p.urls.medium || p.urls.small)
      .sort((a, b) => {
        const da = parseInt(a.dateUpload || "0", 10);
        const db = parseInt(b.dateUpload || "0", 10);
        if (db !== da) return db - da;
        return (b.dateTaken || "").localeCompare(a.dateTaken || "");
      });

    const payload = {
      initialCount: HOME_INITIAL_COUNT,
      batchSize: HOME_BATCH_SIZE,
      total: sorted.length,
      generatedAt: new Date().toISOString(),
      // Full list (head + tail), so the client can refresh the grid head
      // AND drive infinite scroll from a single response.
      tiles: sorted.map(renderHomeTile),
      lightbox: sorted.map((p) => lightboxItem(p)),
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Browser keeps it briefly; the CDN holds it for ~5 min and serves
        // a stale copy for up to 10 more while it revalidates in the back.
        "Cache-Control": "public, max-age=60",
        "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
      body: JSON.stringify(payload),
    };
  } catch (err) {
    return json(502, { error: "Flickr fetch failed", detail: String(err && err.message || err) });
  }
}

// One call to the public photostream with all the extras the tile + lightbox
// templates need. getPublicPhotos returns the user's full public stream,
// which is the natural "recent" universe for the home page.
async function fetchRecentPhotos() {
  const params = new URLSearchParams({
    method: "flickr.people.getPublicPhotos",
    api_key: API_KEY,
    user_id: USER_ID,
    extras: "description,date_upload,date_taken,url_t,url_s,url_m,url_l,url_o",
    per_page: String(PER_PAGE),
    page: "1",
    format: "json",
    nojsoncallback: "1",
  });

  const res = await fetch(`${REST}?${params.toString()}`);
  if (!res.ok) throw new Error(`Flickr HTTP ${res.status}`);
  const data = await res.json();
  if (data.stat !== "ok") throw new Error(`Flickr stat ${data.stat}: ${data.message || ""}`);

  const list = (data.photos && data.photos.photo) || [];
  return list.map(normalize);
}

// Shape a raw Flickr photo into the subset of the build's normalized photo
// object that renderHomeTile + lightboxItem actually read.
function normalize(p) {
  const dim = (w, h) => (w && h ? { w: parseInt(w, 10), h: parseInt(h, 10) } : null);
  return {
    id: p.id,
    secret: p.secret,
    server: p.server,
    title: p.title || "",
    caption: (p.description && p.description._content) || "",
    dateUpload: p.dateupload || "",
    dateTaken: p.datetaken || "",
    tags: [],
    // Same-origin proxied paths (/img/...) — see proxyImageUrls in
    // build/templates/_partials.js and the /img/* redirect in netlify.toml.
    urls: proxyImageUrls({
      thumb: p.url_t || "",
      small: p.url_s || "",
      medium: p.url_m || "",
      large: p.url_l || "",
      original: p.url_o || "",
    }),
    dims: {
      medium: dim(p.width_m, p.height_m),
      large: dim(p.width_l, p.height_l),
      original: dim(p.width_o, p.height_o),
    },
    // Live photos carry no per-shot EXIF (would cost one extra call each);
    // the lightbox handles empty fields gracefully.
    exif: { camera: "", cameraRaw: "", lens: "", lensRaw: "", focal: "", exposure: "", raw: {} },
    location: "",
    collectionTitle: "",
  };
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj),
  };
}

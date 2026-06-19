// build/fetch-flickr.js
//
// Fetches public photos from Flickr, normalizes into JSON, renders the
// static site into dist/. Single-shot, idempotent, no state outside Flickr.
//
// Reads FLICKR_API_KEY and FLICKR_USER_ID from env (or .env locally).
// On Netlify these are set in Site settings -> Environment variables.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { slugify, formatBytes } from "./templates/_partials.js";
import { renderHome, renderHomeTile, HOME_INITIAL_COUNT, HOME_BATCH_SIZE } from "./templates/home.js";
import { lightboxItem } from "./templates/_partials.js";
import { renderCollectionsIndex } from "./templates/collections-index.js";
import { renderCollection } from "./templates/collection.js";
import { renderPhoto } from "./templates/photo.js";
import { renderAbout } from "./templates/about.js";
import { renderCamerasIndex } from "./templates/cameras-index.js";
import { renderCamera } from "./templates/camera.js";
import { renderMap } from "./templates/map.js";
import { renderFeed } from "./templates/feed.js";
import { displayCamera, isCameraHidden } from "./camera-aliases.js";
import { displayLens } from "./lens-aliases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DATA = path.join(ROOT, "data");
const ASSETS_SRC = path.join(ROOT, "assets");

const API_KEY = process.env.FLICKR_API_KEY;
const USER_ID = process.env.FLICKR_USER_ID;
// Initial server-rendered count is owned by the home template; we
// import it so the build stays in lockstep with what the page knows.
const EXIF_CONCURRENCY = 5;
const SIZE_CONCURRENCY = 10;

if (!API_KEY || !USER_ID) {
  console.error("Missing FLICKR_API_KEY or FLICKR_USER_ID. Set them in .env locally or in Netlify env vars.");
  process.exit(1);
}

const buildTime = new Date().toISOString();

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});

async function main() {
  console.log(`[build] starting at ${buildTime}`);
  console.log(`[build] user ${USER_ID}`);

  await ensureDir(DIST);
  await ensureDir(DATA);

  // 1. Fetch all albums
  console.log(`[fetch] photosets.getList`);
  const photosets = await flickr("flickr.photosets.getList", {
    user_id: USER_ID,
    primary_photo_extras: "url_l,url_m,url_s",
  });
  const albums = photosets.photosets.photoset || [];
  console.log(`[fetch] ${albums.length} albums`);

  // 2. Fetch photos per album
  const photoMap = new Map(); // id -> normalized photo
  const collections = [];

  for (const album of albums) {
    const photos = await fetchAllAlbumPhotos(album.id);
    console.log(`[fetch]   "${album.title._content}" — ${photos.length} photos`);

    const photoIds = [];
    for (const ph of photos) {
      const normalized = normalizePhoto(ph, album);
      // Keep first-seen album as the primary collection for nav
      if (!photoMap.has(normalized.id)) {
        photoMap.set(normalized.id, normalized);
      } else {
        // Track additional album memberships
        const existing = photoMap.get(normalized.id);
        if (!existing.allCollectionIds.includes(album.id)) {
          existing.allCollectionIds.push(album.id);
        }
      }
      photoIds.push(normalized.id);
    }

    collections.push({
      id: album.id,
      slug: slugify(album.title._content),
      title: album.title._content,
      description: (album.description && album.description._content) || "",
      photoIds,
      photoCount: photos.length,
    });
  }

  // Disambiguate slug collisions (rare but possible)
  dedupeSlugs(collections);

  // 3. Fetch EXIF for each unique photo, with concurrency limit
  const allPhotos = Array.from(photoMap.values());
  console.log(`[fetch] EXIF for ${allPhotos.length} unique photos (concurrency ${EXIF_CONCURRENCY})`);
  await runWithConcurrency(allPhotos, EXIF_CONCURRENCY, async (p) => {
    try {
      const exif = await flickr("flickr.photos.getExif", { photo_id: p.id, secret: p.secret });
      p.exif = extractExif(exif);
      // Use Flickr-provided location string if present
      if (exif.photo && exif.photo.location && exif.photo.location._content) {
        p.location = exif.photo.location._content;
      }
    } catch (err) {
      // Many old uploads have no EXIF; skip silently
      p.exif = {};
    }
  });

  // 4. Build photoIndex (id -> photo) for renderers
  const photoIndex = Object.fromEntries(allPhotos.map((p) => [p.id, p]));

  // 5. Decorate photos with their primary collection title for the EXIF panel
  for (const c of collections) {
    for (const id of c.photoIds) {
      const p = photoIndex[id];
      if (p && !p.collectionTitle) p.collectionTitle = c.title;
    }
  }

  // 5b. For geotagged photos, fetch the place hierarchy and format a clean
  //     LOCATION string ("Seattle, Washington, United States" / "Bagan,
  //     Mandalay, Myanmar"). Skip silently for photos without geo.
  const geotagged = allPhotos.filter((p) => p.geo.lat !== 0 || p.geo.lng !== 0);
  console.log(`[fetch] geo.getLocation for ${geotagged.length} geotagged photos`);
  await runWithConcurrency(geotagged, EXIF_CONCURRENCY, async (p) => {
    try {
      const r = await flickr("flickr.photos.geo.getLocation", { photo_id: p.id });
      const formatted = formatPlace(r.photo && r.photo.location);
      if (formatted) p.location = formatted;
    } catch (err) {
      // Photo not geotagged on Flickr's side, or other API issue. Skip.
    }
  });

  // 6. Measure file sizes by HEAD'ing the largest available variant per photo,
  //    streaming if HEAD does not return Content-Length (Flickr's CDN often
  //    omits it for the on-demand-generated larger sizes).
  console.log(`[fetch] sizes for ${allPhotos.length} photos (concurrency ${SIZE_CONCURRENCY})`);
  await runWithConcurrency(allPhotos, SIZE_CONCURRENCY, async (p) => {
    const url = pickLargestUrl(p.urls);
    if (!url) return;
    p.bytes = await measureUrlBytes(url);
  });

  // 7. Compute camera groups from EXIF
  const cameras = computeCameraGroups(allPhotos);
  console.log(`[group] ${cameras.length} cameras (${allPhotos.filter(p => p.exif && p.exif.camera).length} of ${allPhotos.length} photos have camera EXIF)`);

  // 7c. Write JSON artifacts (handy for debugging / future tooling)
  await fs.writeFile(path.join(DATA, "photos.json"), JSON.stringify(photoIndex, null, 2));
  await fs.writeFile(path.join(DATA, "collections.json"), JSON.stringify(collections, null, 2));
  await fs.writeFile(path.join(DATA, "cameras.json"), JSON.stringify(cameras, null, 2));
  console.log(`[write] data/photos.json (${allPhotos.length}), data/collections.json (${collections.length}), data/cameras.json (${cameras.length})`);

  // 8. Compute stats for the about page
  const stats = computeStats({ allPhotos, cameras });
  console.log(`[stats] ${stats.totalPhotos} photos, ${formatBytes(stats.totalBytes)}, ${stats.cameraCounts.length} cameras`);

  // 9. Render pages
  await renderSite({ photoIndex, allPhotos, collections, cameras, stats });

  // 10. Copy assets
  await copyDir(ASSETS_SRC, path.join(DIST, "assets"));
  console.log(`[copy]  assets/ -> dist/assets/`);

  console.log(`[done]  built ${allPhotos.length} photos / ${collections.length} collections / ${cameras.length} cameras`);
}

// --- Place formatting ---------------------------------------------

// Turn Flickr's geo.getLocation response into a clean display string.
// Format: "Locality, Region, Country", trimming empties and dedup'd
// when locality and region match (e.g. for city-states).
function formatPlace(loc) {
  if (!loc) return "";
  const get = (k) => (loc[k] && loc[k]._content) || "";
  const locality = get("locality");
  const region = get("region");
  const country = get("country");

  const parts = [];
  if (locality) parts.push(locality);
  if (region && region !== locality) parts.push(region);
  if (country) parts.push(country);
  return parts.join(", ");
}

// --- Size measurement --------------------------------------------

// Pick the URL of the largest publicly-served variant.
// Falls back through k tiers down to medium / small if larger ones aren't
// available (which depends on the original upload size).
function pickLargestUrl(urls) {
  return (
    urls.original ||
    urls["6k"] ||
    urls["5k"] ||
    urls["4k"] ||
    urls["3k"] ||
    urls.k ||
    urls.h ||
    urls.large ||
    urls.medium ||
    urls.small ||
    ""
  );
}

// Get the byte size of a URL. Tries HEAD first (cheap, one round trip),
// falls back to a streaming GET that counts bytes on the fly when the
// CDN does not return Content-Length (which Flickr does for the on-demand
// larger variants like _4k.jpg, _6k.jpg).
async function measureUrlBytes(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    const len = head.headers.get("content-length");
    if (len && parseInt(len, 10) > 0) return parseInt(len, 10);
  } catch (err) {
    // fall through to streaming
  }

  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return 0;
    const reader = res.body.getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
    }
    return total;
  } catch (err) {
    return 0;
  }
}

// --- Stats --------------------------------------------------------

function computeStats({ allPhotos, cameras }) {
  const totalPhotos = allPhotos.length;
  const totalBytes = allPhotos.reduce((sum, p) => sum + (p.bytes || 0), 0);
  const sizedPhotos = allPhotos.filter((p) => (p.bytes || 0) > 0).length;

  const cameraCounts = cameras.map((c) => ({
    title: c.title,
    slug: c.slug,
    count: c.photoIds.length,
  }));

  const photosWithoutExif = allPhotos.filter(
    (p) => !p.exif || !p.exif.camera,
  ).length;

  // Focal-length / aperture scatter — every photo whose EXIF carries
  // both numbers gets one point on the About page chart. Pulled from
  // the raw EXIF tags so we have proper numeric values, not the
  // pre-formatted strings ("47.0 mm", "f/5.6") used elsewhere.
  //
  // We also carry the photo id + title so the template can wrap each
  // dot in a link to /p/{id}/ and surface a hover tooltip.
  const scatterPoints = [];
  for (const p of allPhotos) {
    const raw = (p.exif && p.exif.raw) || {};
    const focalMm = parseFocalMm(raw.FocalLength);
    const fNumber = parseFNumber(raw.FNumber);
    if (focalMm > 0 && fNumber > 0) {
      scatterPoints.push({
        id: p.id,
        title: p.title || p.rawTitle || "",
        focalMm,
        fNumber,
      });
    }
  }

  return {
    totalPhotos,
    totalBytes,
    sizedPhotos,
    cameraCounts,
    photosWithoutExif,
    scatterPoints,
  };
}

// Pull a numeric mm value out of a Flickr FocalLength tag like "47.0 mm"
// or "10.2 mm". Returns 0 when no usable number is present.
function parseFocalMm(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// FNumber comes through as a bare number ("5.6") or occasionally with a
// leading "f/". Either way we just want the float.
function parseFNumber(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}


// --- Camera grouping ----------------------------------------------

function computeCameraGroups(allPhotos) {
  const groups = new Map(); // displayName -> { title, photoIds, dateTaken[] }

  for (const p of allPhotos) {
    const cameraDisplay = p.exif && p.exif.camera;
    const cameraRaw = (p.exif && p.exif.cameraRaw) || cameraDisplay;
    if (!cameraDisplay) continue; // skip photos with no EXIF
    if (cameraRaw && isCameraHidden(cameraRaw)) continue;

    if (!groups.has(cameraDisplay)) {
      groups.set(cameraDisplay, {
        title: cameraDisplay,
        slug: slugify(cameraDisplay),
        photoIds: [],
        latestDate: "",
      });
    }
    const g = groups.get(cameraDisplay);
    g.photoIds.push(p.id);
    const d = p.dateTaken || p.dateUpload || "";
    if (d > g.latestDate) g.latestDate = d;
  }

  // Sort photos within each group by date desc
  for (const g of groups.values()) {
    g.photoIds.sort((a, b) => {
      const pa = allPhotos.find((p) => p.id === a);
      const pb = allPhotos.find((p) => p.id === b);
      const da = (pa && (pa.dateTaken || pa.dateUpload)) || "";
      const db = (pb && (pb.dateTaken || pb.dateUpload)) || "";
      return db.localeCompare(da);
    });
  }

  // Sort groups by latest activity, newest first
  const list = Array.from(groups.values()).sort((a, b) =>
    b.latestDate.localeCompare(a.latestDate),
  );

  // Disambiguate slug collisions
  dedupeSlugs(list);

  return list;
}

// --- Flickr API ----------------------------------------------------

const FLICKR_REST = "https://api.flickr.com/services/rest/";

async function flickr(method, params = {}) {
  const url = new URL(FLICKR_REST);
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("nojsoncallback", "1");
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }

  const res = await fetch(url, { headers: { "User-Agent": "photo.longwalkhome.net build" } });
  if (!res.ok) throw new Error(`Flickr HTTP ${res.status} for ${method}`);
  const data = await res.json();
  if (data.stat !== "ok") {
    throw new Error(`Flickr API error for ${method}: ${data.code || ""} ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function fetchAllAlbumPhotos(photosetId) {
  const out = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await flickr("flickr.photosets.getPhotos", {
      photoset_id: photosetId,
      user_id: USER_ID,
      page,
      per_page: 500,
      privacy_filter: 1, // public only
      extras:
        "description,date_taken,date_upload,owner_name,tags,geo,o_dims," +
        "url_t,url_s,url_m,url_l,url_h,url_k,url_3k,url_4k,url_5k,url_6k,url_o",
    });
    const photoset = r.photoset || {};
    const photos = photoset.photo || [];
    out.push(...photos);
    if (page >= photoset.pages) break;
    page += 1;
  }
  return out;
}

function normalizePhoto(p, album) {
  const title = p.title || "";
  const desc = (p.description && p.description._content) || "";
  // First line of description = title body, rest = caption (per site plan)
  const firstNewline = desc.indexOf("\n");
  const captionTitle = firstNewline >= 0 ? desc.slice(0, firstNewline).trim() : desc.trim();
  const captionBody = firstNewline >= 0 ? desc.slice(firstNewline + 1).trim() : "";

  return {
    id: String(p.id),
    secret: p.secret,
    server: p.server,
    title: captionTitle || title || "",
    caption: captionBody || "",
    rawTitle: title,
    rawDescription: desc,
    dateTaken: p.datetaken || "",
    dateUpload: p.dateupload || "",
    tags: (p.tags || "").split(/\s+/).filter(Boolean),
    urls: {
      thumb: p.url_t || "",
      small: p.url_s || "",
      medium: p.url_m || "",
      large: p.url_l || "",
      h: p.url_h || "",
      k: p.url_k || "",
      "3k": p.url_3k || "",
      "4k": p.url_4k || "",
      "5k": p.url_5k || "",
      "6k": p.url_6k || "",
      original: p.url_o || "",
    },
    dims: {
      large: p.height_l && p.width_l ? { w: +p.width_l, h: +p.height_l } : null,
      medium: p.height_m && p.width_m ? { w: +p.width_m, h: +p.height_m } : null,
      original: p.height_o && p.width_o ? { w: +p.width_o, h: +p.height_o } : null,
    },
    primaryCollectionId: album.id,
    allCollectionIds: [album.id],
    exif: {},
    location: "",
    collectionTitle: "",
    bytes: 0,
    geo: {
      lat: parseFloat(p.latitude) || 0,
      lng: parseFloat(p.longitude) || 0,
      accuracy: parseInt(p.accuracy, 10) || 0,
    },
  };
}

function extractExif(exifResp) {
  const exifList = (exifResp.photo && exifResp.photo.exif) || [];
  const byTag = {};
  for (const e of exifList) {
    byTag[e.tag] = e.raw && e.raw._content;
  }

  const make = (byTag.Make || "").trim();
  const model = (byTag.Model || "").trim();
  // Some manufacturers (notably Canon) repeat the make in the model field.
  // Collapse "Canon Canon EOS Rebel XTi" -> "Canon EOS Rebel XTi".
  let cameraRaw;
  if (model && make && model.toLowerCase().startsWith(make.toLowerCase())) {
    cameraRaw = model;
  } else {
    cameraRaw = [make, model].filter(Boolean).join(" ").trim();
  }
  // Apply alias map for display.
  const camera = displayCamera(cameraRaw);

  const lensRaw = (byTag.LensModel || byTag.Lens || "").trim();
  const lens = displayLens(lensRaw);

  let focal = "";
  if (byTag.FocalLength) focal = byTag.FocalLength;
  if (byTag.FocalLengthIn35mmFormat) {
    focal = focal
      ? `${focal} (${byTag.FocalLengthIn35mmFormat} eq)`
      : byTag.FocalLengthIn35mmFormat;
  }

  const exposureBits = [];
  if (byTag.ExposureTime) exposureBits.push(byTag.ExposureTime);
  if (byTag.FNumber) exposureBits.push(`f/${byTag.FNumber.replace(/^f\//i, "")}`);
  if (byTag.ISO) exposureBits.push(`ISO ${byTag.ISO}`);
  const exposure = exposureBits.join(" · ");

  return { camera, cameraRaw, lens, lensRaw, focal, exposure, raw: byTag };
}

// --- Renderer ------------------------------------------------------

async function renderSite({ photoIndex, allPhotos, collections, cameras, stats }) {
  // Sort photos by Flickr upload timestamp (newest first) for the homepage.
  // This is what readers experience as "recent" — when something appeared on
  // the site — not when the shutter clicked. Archive uploads (a 2018 photo
  // posted today) correctly surface on top.
  const sortedRecent = [...allPhotos]
    .filter((p) => p.urls.medium || p.urls.small)
    .sort((a, b) => {
      const da = parseInt(a.dateUpload || "0", 10);
      const db = parseInt(b.dateUpload || "0", 10);
      if (db !== da) return db - da;
      // Fall back to dateTaken if upload timestamps tie (very unlikely)
      return (b.dateTaken || "").localeCompare(a.dateTaken || "");
    });

  // The home template slices internally: first HOME_INITIAL_COUNT
  // tiles render server-side, anything beyond comes from the JSON
  // below via /assets/home-infinite.js as the user scrolls.
  await writeFile(
    path.join(DIST, "index.html"),
    renderHome({ photos: sortedRecent, buildTime }),
  );
  const initialOnHome = Math.min(sortedRecent.length, HOME_INITIAL_COUNT);
  console.log(`[render] / (${initialOnHome} of ${sortedRecent.length} photos initial)`);

  // Data file feeding the home-infinite.js client. Holds only the
  // photos beyond HOME_INITIAL_COUNT; aligned arrays of pre-rendered
  // tile HTML and lightbox metadata so the client renders by string
  // append (no client-side templating drift) and registers each new
  // tile with PhotoSwipe in one shot.
  const remaining = sortedRecent.slice(HOME_INITIAL_COUNT);
  const homeRecent = {
    initialCount: HOME_INITIAL_COUNT,
    batchSize: HOME_BATCH_SIZE,
    total: sortedRecent.length,
    tiles: remaining.map(renderHomeTile),
    lightbox: remaining.map((p) => lightboxItem(p)),
  };
  await ensureDir(path.join(DIST, "data"));
  await writeFile(
    path.join(DIST, "data", "home-recent.json"),
    JSON.stringify(homeRecent),
  );
  console.log(`[render] /data/home-recent.json (${remaining.length} additional)`);

  // RSS feed of recent photos (mirrors home page sort, separate cap).
  await writeFile(
    path.join(DIST, "feed.xml"),
    renderFeed({ photos: allPhotos, buildTime }),
  );
  console.log(`[render] /feed.xml`);

  await ensureDir(path.join(DIST, "c"));
  await writeFile(
    path.join(DIST, "c", "index.html"),
    renderCollectionsIndex({ collections, photos: photoIndex, buildTime }),
  );
  console.log(`[render] /c/ (${collections.length} collections)`);

  for (const c of collections) {
    const dir = path.join(DIST, "c", c.slug);
    await ensureDir(dir);
    await writeFile(
      path.join(dir, "index.html"),
      renderCollection({ collection: c, photos: photoIndex, buildTime }),
    );
  }

  // Photo permalink pages
  await ensureDir(path.join(DIST, "p"));
  let photoCount = 0;
  for (const c of collections) {
    for (let i = 0; i < c.photoIds.length; i++) {
      const id = c.photoIds[i];
      const p = photoIndex[id];
      if (!p) continue;
      // Render the photo page only the first time we see it (in its primary collection)
      if (p.primaryCollectionId !== c.id) continue;

      const prevId = c.photoIds[i - 1];
      const nextId = c.photoIds[i + 1];
      const prev = prevId ? photoIndex[prevId] : null;
      const next = nextId ? photoIndex[nextId] : null;

      // Build the album sequence for the lightbox: every photo in this
      // collection in order, used as the swipe gallery on the detail page.
      const albumPhotos = c.photoIds
        .map((pid) => photoIndex[pid])
        .filter(Boolean);

      const dir = path.join(DIST, "p", p.id);
      await ensureDir(dir);
      await writeFile(
        path.join(dir, "index.html"),
        renderPhoto({ photo: p, collection: c, prev, next, albumPhotos }),
      );
      photoCount++;
    }
  }
  console.log(`[render] /p/{id}/ (${photoCount} pages)`);

  // Camera group pages
  await ensureDir(path.join(DIST, "g"));
  await writeFile(
    path.join(DIST, "g", "index.html"),
    renderCamerasIndex({ cameras, photos: photoIndex, buildTime }),
  );
  console.log(`[render] /g/ (${cameras.length} cameras)`);

  for (const cam of cameras) {
    const dir = path.join(DIST, "g", cam.slug);
    await ensureDir(dir);
    await writeFile(
      path.join(dir, "index.html"),
      renderCamera({ camera: cam, photos: photoIndex, buildTime }),
    );
  }

  // Map page (geotagged photos plotted on a Leaflet map)
  const geotagged = allPhotos.filter((p) => p.geo && (p.geo.lat !== 0 || p.geo.lng !== 0));
  await ensureDir(path.join(DIST, "map"));
  await writeFile(
    path.join(DIST, "map", "index.html"),
    renderMap({ geotaggedPhotos: geotagged, totalPhotos: allPhotos.length, buildTime }),
  );
  console.log(`[render] /map/ (${geotagged.length} pins)`);

  await ensureDir(path.join(DIST, "about"));
  await writeFile(path.join(DIST, "about", "index.html"), renderAbout({ buildTime, stats }));
  console.log(`[render] /about/`);
}

// --- File helpers --------------------------------------------------

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(p, contents) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, contents);
}

async function copyDir(src, dst) {
  await ensureDir(dst);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // skip .gitkeep etc.
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

// --- Concurrency helper -------------------------------------------

async function runWithConcurrency(items, limit, worker) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

// --- Slug dedupe --------------------------------------------------

function dedupeSlugs(collections) {
  const seen = new Map();
  for (const c of collections) {
    let slug = c.slug;
    let n = 2;
    while (seen.has(slug)) {
      slug = `${c.slug}-${n++}`;
    }
    seen.set(slug, true);
    c.slug = slug;
  }
}

import { head, header, footer, escapeHtml, formatBytes, SITE_URL } from "./_partials.js";

export function renderAbout({ buildTime, stats } = {}) {
  const body = `<div class="shell">
  ${header()}
  <article class="prose">
    <h2 class="display">About</h2>
    <p>Photographs by Ryan Hoffman. The archive lives on Flickr; this site is a quieter view of it.</p>
    <p>Built with vanilla HTML, CSS, and a little Node. Updates roll through automatically a few times a day. If something is missing, it likely just hasn't rebuilt yet.</p>
    <p>Find the full library at <a href="https://www.flickr.com/photos/76894493@N00/">flickr.com/photos/76894493@N00</a>.</p>
  </article>
  ${stats ? renderStats(stats) : ""}
  ${footer({ buildTime })}
</div>`;

  return `${head({
    title: "About",
    description: "About this photo archive.",
    ogUrl: SITE_URL + "/about/",
  })}
<body>
${body}
</body>
</html>`;
}

function renderStats(stats) {
  const totalBytesHuman = formatBytes(stats.totalBytes);
  const cameraRows = stats.cameraCounts
    .slice()
    .sort((a, b) => b.count - a.count)
    .map(
      (c) =>
        `      <dt><a href="/g/${c.slug}/">${escapeHtml(c.title)}</a></dt><dd>${c.count}</dd>`,
    )
    .join("\n");

  const noExifRow = stats.photosWithoutExif
    ? `      <dt class="stats-faint">no camera EXIF</dt><dd class="stats-faint">${stats.photosWithoutExif}</dd>`
    : "";

  const lensCounts = stats.lensCounts || [];
  const lensRows = lensCounts
    .slice()
    .sort((a, b) => b.count - a.count)
    .map(
      (l) =>
        `      <dt><a href="/l/${l.slug}/">${escapeHtml(l.title)}</a></dt><dd>${l.count}</dd>`,
    )
    .join("\n");

  const noLensRow = stats.photosWithoutLensExif
    ? `      <dt class="stats-faint">no lens EXIF</dt><dd class="stats-faint">${stats.photosWithoutLensExif}</dd>`
    : "";

  const lensSection = lensCounts.length
    ? `    <h4 class="section-label section-label--sub">photos per lens</h4>
    <dl class="stats-cameras">
${lensRows}
${noLensRow}
    </dl>`
    : "";

  const scatterSection = renderFocalApertureScatter(stats.scatterPoints || []);

  return `  <section class="stats">
    <h3 class="section-label">archive stats</h3>
    <dl class="stats-summary">
      <dt>total photos</dt><dd>${stats.totalPhotos}</dd>
      <dt>total size</dt><dd>${escapeHtml(totalBytesHuman)}</dd>
    </dl>
    <h4 class="section-label section-label--sub">photos per camera</h4>
    <dl class="stats-cameras">
${cameraRows}
${noExifRow}
    </dl>
${lensSection}
${scatterSection}
  </section>`;
}

// Inline SVG scatter of focal length (X, log) vs aperture (Y, log).
// Purely informational: one dot per photo whose EXIF carries both
// numbers. Log-scaled because both quantities are perceptually
// multiplicative (each stop doubles light, each focal-length doubling
// halves the field of view).
function renderFocalApertureScatter(points) {
  if (!points || !points.length) return "";

  // Plot dimensions. The SVG is responsive (width: 100%) but the
  // viewBox locks the coordinate space we draw into.
  const W = 800;
  const H = 360;
  const pad = { top: 16, right: 16, bottom: 40, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  // Axis ranges. We anchor on common photographic values and only
  // expand if the data falls outside them, so the chart looks the
  // same shape session to session.
  const focalTicks = [10, 14, 24, 35, 50, 85, 135, 200, 300, 500];
  const fTicks = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

  let focalMin = 10, focalMax = 500;
  let fMin = 1.4, fMax = 22;
  for (const p of points) {
    if (p.focalMm < focalMin) focalMin = p.focalMm;
    if (p.focalMm > focalMax) focalMax = p.focalMm;
    if (p.fNumber < fMin) fMin = p.fNumber;
    if (p.fNumber > fMax) fMax = p.fNumber;
  }
  // Round outward in log space so the data has a small breathing margin.
  focalMin = Math.max(1, Math.pow(2, Math.floor(Math.log2(focalMin))));
  focalMax = Math.pow(2, Math.ceil(Math.log2(focalMax)));
  fMin = Math.max(0.7, Math.pow(2, Math.floor(Math.log2(fMin) * 2) / 2));
  fMax = Math.pow(2, Math.ceil(Math.log2(fMax) * 2) / 2);

  const logFocalMin = Math.log(focalMin);
  const logFocalMax = Math.log(focalMax);
  const logFMin = Math.log(fMin);
  const logFMax = Math.log(fMax);

  const xFor = (mm) =>
    pad.left + ((Math.log(mm) - logFocalMin) / (logFocalMax - logFocalMin)) * innerW;
  // Aperture grows downward visually: smaller f-number (more light) at top.
  const yFor = (f) =>
    pad.top + ((Math.log(f) - logFMin) / (logFMax - logFMin)) * innerH;

  // Frame + gridlines.
  const frame =
    `<rect x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" ` +
    `fill="none" stroke="var(--rule)" stroke-width="1"/>`;

  const xGrid = focalTicks
    .filter((t) => t >= focalMin && t <= focalMax)
    .map((t) => {
      const x = xFor(t);
      return (
        `<line x1="${x.toFixed(1)}" y1="${pad.top}" x2="${x.toFixed(1)}" y2="${pad.top + innerH}" ` +
        `stroke="var(--rule)" stroke-width="1" stroke-dasharray="2 4"/>` +
        `<text x="${x.toFixed(1)}" y="${pad.top + innerH + 18}" ` +
        `text-anchor="middle" font-family="var(--font-mono)" font-size="11" ` +
        `fill="var(--ink-faint)">${t}</text>`
      );
    })
    .join("");

  const yGrid = fTicks
    .filter((t) => t >= fMin && t <= fMax)
    .map((t) => {
      const y = yFor(t);
      return (
        `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${pad.left + innerW}" y2="${y.toFixed(1)}" ` +
        `stroke="var(--rule)" stroke-width="1" stroke-dasharray="2 4"/>` +
        `<text x="${pad.left - 8}" y="${(y + 4).toFixed(1)}" ` +
        `text-anchor="end" font-family="var(--font-mono)" font-size="11" ` +
        `fill="var(--ink-faint)">f/${t}</text>`
      );
    })
    .join("");

  // Axis titles.
  const xTitle =
    `<text x="${pad.left + innerW / 2}" y="${H - 6}" ` +
    `text-anchor="middle" font-family="var(--font-mono)" font-size="11" ` +
    `fill="var(--ink-soft)">focal length (mm)</text>`;
  const yTitle =
    `<text transform="translate(14 ${pad.top + innerH / 2}) rotate(-90)" ` +
    `text-anchor="middle" font-family="var(--font-mono)" font-size="11" ` +
    `fill="var(--ink-soft)">aperture</text>`;

  // Points. Low opacity + small radius so density reads as cloud.
  // Each dot is wrapped in a link to /p/{id}/ so clicking through
  // takes you to the source photo, with a <title> tooltip on hover.
  //
  // When several photos sit on the exact same (focal, f-number) pair —
  // e.g. four shots all at 50mm f/1.4 — they would render as a single
  // pixel and only the topmost would be reachable. We fan stacked
  // points out in a tiny spiral so every dot is individually clickable
  // without significantly distorting the visual position.
  const groups = new Map();
  for (const p of points) {
    const key = `${p.focalMm.toFixed(2)}|${p.fNumber.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const dotR = 3.5;
  const spiralStep = 4.5;
  const placed = [];
  for (const list of groups.values()) {
    const baseX = xFor(list[0].focalMm);
    const baseY = yFor(list[0].fNumber);
    for (let i = 0; i < list.length; i++) {
      let dx = 0, dy = 0;
      if (i > 0) {
        // Simple radial fan: place each extra point on a ring, with
        // ~6 points per ring, stepping outward as the ring fills up.
        const ring = Math.ceil(i / 6);
        const slot = i - (ring - 1) * 6 - 1;
        const angle = (slot / 6) * Math.PI * 2 + ring * 0.6;
        dx = Math.cos(angle) * spiralStep * ring;
        dy = Math.sin(angle) * spiralStep * ring;
      }
      placed.push({ ...list[i], x: baseX + dx, y: baseY + dy });
    }
  }

  const dots = placed
    .map((p) => {
      const x = p.x.toFixed(1);
      const y = p.y.toFixed(1);
      const tip = `${p.focalMm} mm · f/${p.fNumber}${p.title ? ` — ${p.title}` : ""}`;
      return (
        `<a href="/p/${escapeHtml(p.id)}/" class="stats-scatter-dot">` +
        `<title>${escapeHtml(tip)}</title>` +
        `<circle cx="${x}" cy="${y}" r="${dotR}"/>` +
        `</a>`
      );
    })
    .join("");

  return `    <h4 class="section-label section-label--sub">focal length × aperture</h4>
    <p class="stats-note">${points.length} photo${points.length === 1 ? "" : "s"} with both values in EXIF. Log scales on both axes.</p>
    <figure class="stats-scatter">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scatter of focal length versus aperture across the archive.">
        ${frame}
        ${xGrid}
        ${yGrid}
        ${xTitle}
        ${yTitle}
        ${dots}
      </svg>
    </figure>`;
}

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
  </section>`;
}

import { head, header, footer, SITE_URL } from "./_partials.js";

export function renderAbout({ buildTime } = {}) {
  const body = `<div class="shell">
  ${header()}
  <article class="prose">
    <h2 class="display">About</h2>
    <p>Photographs by Ryan Hoffman. The archive lives on Flickr; this site is a quieter view of it.</p>
    <p>Built with vanilla HTML, CSS, and a little Node. Updates roll through automatically a few times a day. If something is missing, it likely just hasn't rebuilt yet.</p>
    <p>Find the full library at <a href="https://www.flickr.com/photos/76894493@N00/">flickr.com/photos/76894493@N00</a>.</p>
  </article>
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

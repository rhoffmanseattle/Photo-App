# Photo App

A static photo portfolio for [photo.longwalkhome.net](https://photo.longwalkhome.net), backed by Flickr and hosted on Netlify.

## What it is

Frustrated with using Insta for photos but wanting a streamlined front-end, I used Flickr's excellent service to host my photos.

A vanilla HTML/CSS/JS site. A Node build script pulls public photos and albums from Flickr, normalizes them into JSON, and generates per-photo and per-collection permalink pages.

The home page also updates **live, without a redeploy**: a Netlify Function (`netlify/functions/home-recent.mjs`) fetches the current photo list from Flickr on request, and `assets/home-live.js` swaps it into the grid on load. Add, remove, or reorder photos on Flickr and they appear on a refresh (within the function's ~5 minute CDN cache). The static pages remain the instant-paint baseline and the source of permalinks/SEO; new photos get their own static `/p/{id}/` pages on the next rebuild.

## Repo layout

```
.
├── assets/              app static assets (css, js)
├── build/               Flickr fetch + page generator (templates in build/templates/)
├── netlify/functions/   serverless functions (live Flickr fetch for the home grid)
├── data/                generated JSON artifacts (gitignored)
├── docs/internal/       planning docs, todos, drafts (gitignored)
├── dist/                Netlify publish dir (gitignored, generated)
├── netlify.toml         build + redirect config
├── LICENSE              GPL v3
└── README.md
```

The `docs/internal/` folder is deliberately excluded from version control. It is the working scratchpad for non-app documents (the site plan, todos, drafts, anything not meant to ship publicly).

## Deploy pipeline

1. Push to `main` on GitHub.
2. Netlify is connected to the repo and runs the build defined in `netlify.toml`.
3. Built site publishes to `photo.longwalkhome.net`.
4. The home grid refreshes from Flickr live via the `home-recent` function — no redeploy needed for everyday photo changes.
5. Manual deploys available from the Netlify dashboard. A rebuild is only needed to regenerate static permalink/collection/camera pages (and full EXIF) for brand-new photos.

> Note: an earlier version of this README claimed a "scheduled rebuild every six hours," but nothing in this repo configures one. If you want periodic rebuilds (to refresh the static permalink pages), set up a [scheduled build](https://docs.netlify.com/configure-builds/build-hooks/) in the Netlify UI or via a build hook + cron. Day-to-day photo updates no longer depend on it.

## Required Netlify environment variables

Set these in the Netlify UI (Site settings → Environment variables). Never commit them.

- `FLICKR_API_KEY` — from https://www.flickr.com/services/apps/create/apply/
- `FLICKR_USER_ID` — your NSID, format `12345678@N00`. Look it up at https://www.webfx.com/tools/idgettr/

## Local development

Copy `.env.example` to `.env` and fill in `FLICKR_API_KEY` and `FLICKR_USER_ID`, then:

```
npm install
npm run build      # runs the Flickr fetch + page generator
npm run dev        # serves dist/ at http://localhost:3000
```

`npm run clean` removes the generated `dist/` and `data/` folders.

## License

GPL v3. See `LICENSE`.

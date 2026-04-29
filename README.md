# Photo App

A static photo portfolio for [photo.longwalkhome.net](https://photo.longwalkhome.net), backed by Flickr and hosted on Netlify.

## What it is

A vanilla HTML/CSS/JS site. A Node build script pulls public photos and albums from Flickr, normalizes them into JSON, and generates per-photo and per-collection permalink pages. Netlify rebuilds every six hours, or on demand from the dashboard.

## Repo layout

```
.
├── assets/              app static assets (css, js, fonts)
├── build/               Flickr fetch + page generator (added in build session)
├── data/                generated JSON artifacts (gitignored)
├── docs/internal/       planning docs, todos, drafts (gitignored)
├── static/              source HTML templates (added in build session)
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
4. Scheduled rebuild every six hours pulls fresh photos from Flickr.
5. Manual deploys available from the Netlify dashboard.

## Required Netlify environment variables

Set these in the Netlify UI (Site settings → Environment variables). Never commit them.

- `FLICKR_API_KEY` — from https://www.flickr.com/services/apps/create/apply/
- `FLICKR_USER_ID` — your NSID, format `12345678@N00`. Look it up at https://www.webfx.com/tools/idgettr/

## Local development

Build script and templates land in the next session. Once they exist:

```
npm install
npm run build      # runs the Flickr fetch + page generator
```

Then open `dist/index.html` or serve `dist/` with any static server.

## License

GPL v3. See `LICENSE`.

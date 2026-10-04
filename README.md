# Tana website

Astro site for **tana.gg**, with an asset library, Studio download page, blog,
and protected asset administration. Repository: `tana3d/website`.

The site starts from the source of `samifouad/website` at `f0cf406`:
the existing grid CSS, shuffle helper, shared page layout, fonts, and blog
templates are retained and adapted. Repository fetching, GitHub counters,
language bars, changelog, watchers, metrics, and rebuild cron jobs are removed.
The download page uses the layout/CSS from the user's `cqxai/website`.

## Run locally

Node 24 or newer is recommended (minimum 22.12).

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Open `http://127.0.0.1:4321` and `/admin`. Astro runs D1 and R2 locally via
Cloudflare's runtime. This is isolated local storage; it never writes to the
production bucket. The local admin exception requires both a development build
and a loopback hostname. It is disabled in production builds.

To populate the local demonstration catalog:

```sh
node scripts/prepare-starter-assets.mjs
npm run seed:local
```

This downloads 11 CC0 Poly Haven models and Quaternius's CC0 RobotExpressive,
converts the models to self-contained GLBs, creates our own still/GIF previews,
then publishes them through the actual admin API. Model files are stored in
local R2; metadata is stored in local D1. No binary model files are checked into
Git. This script deliberately seeds localhost only.

## Cloudflare setup

Use **Workers → Import a repository** and connect `tana3d/website`, production
branch `main`. The current Astro Cloudflare adapter targets Workers rather than
Pages. Workers Git builds can rebuild/deploy on pushes to `main`.

1. Create the R2 bucket and D1 database in your account.
2. Replace the placeholder `database_id`, database name, and bucket name in
   `wrangler.jsonc`. Keep binding names **DB** and **LIBRARY**.
3. Apply the D1 migration: `npm run db:remote`.
4. Set build command `npm run build`, deploy command `npx wrangler deploy`,
   root directory `/`, and Node version `24`.
5. Create a Cloudflare Access self-hosted application covering both
   `tana.gg/admin*` and `tana.gg/api/admin*`. Permit only your admin identity.
   Protect the equivalent paths on the Workers preview hostname too, or disable
   that hostname. Set `ACCESS_TEAM_DOMAIN` (e.g. `yourteam.cloudflareaccess.com`)
   and `ACCESS_AUD` (application audience) in Wrangler vars or Worker settings.
6. Do **not** set `LOCAL_ADMIN` in production. Do not make the R2 bucket public;
   published files are streamed through the site and drafts require admin auth.

The backend independently verifies Access JWT signature, expiry, issuer, and
audience, so forgetting an Access routing rule does not expose admin routes.
Writes also require a same-origin request. No credentials are stored in Git.
Deployment has not been performed; it requires your real bindings and Access
configuration. The initial production library will be empty until you upload
assets to its R2 bucket through `/admin`.

## Library management

Upload one GLB (up to 32 MB), a PNG/JPEG/WebP/GIF preview (up to 8 MB), and a still
thumbnail for animated previews. The complete request is limited to 48 MB.
Add a name, description, category, comma-separated tags, license/credits, tile
colour, and tile size. The server reads skeleton and animation names from the
GLB rather than trusting a checkbox. Save a draft or publish immediately.
Existing listings can be edited, files replaced, and unpublished without
deleting files. Old immutable file revisions remain in R2 for later cleanup.

The public grid and `/api/assets` read D1 on demand, with search, category/tag
filtering, and pagination. Clicking a model opens a 3D preview with orbit/zoom,
animation selection, attribution, and a GLB download. Listing edits do not need
a website rebuild. `/api/assets` is the catalog contract for a future Studio
“Tana library” browser; desktop installation is not implemented in this repo.

Camera and ukulele previews use a slow, seamless 12-second turntable.
Animated previews have separate stills and respect reduced-motion preferences.
The large first Studio tile is never shuffled; the remaining tile order follows
the original site's shuffle on each visit. Its sticky behavior is disabled on
small screens to avoid obscuring the gallery. Astro view transitions match
each tile to its model preview and animate shared tiles across navigation.
The grid-paper background and saved light/dark preference apply site-wide.
Header search queries the asset library; navigation and theme controls live in
the fixed footer copied from zega.dev (persisted across view transitions), with Sami's profile photo and Studio source link.

## Desktop downloads

`src/data/releases.json` contains a version and an array of real artifacts:

```json
{
  "version": "0.1.0",
  "files": [{
    "platform": "macos-arm64",
    "label": "macOS Apple Silicon",
    "url": "https://your-download-domain/studio.dmg",
    "size": "42 MB"
  }]
}
```

No Studio installers are currently published. The page shows that explicitly
and does not link to nonexistent binaries. Add verified download URLs when
installers are available. The screenshot is from the Studio development UI
with test conversation data, not a real user's account.

## Blog

The original Markdown blog functionality is retained. Add posts under
`src/content/blog` with title, description, pubDate, and optional tags/heroImage.
Posts and tag pages are prerendered during the build. The original hello-world
placeholder remains until you write a Tana post.

## Verify

```sh
npm run check
npm test
npm run build
TANA_TEST_URL=http://127.0.0.1:4321 npm test
npm run test:ui
```

The opt-in integration test uses the actual local D1/R2 bindings and leaves an
unpublished test record. It checks uploads, metadata, publication, downloads,
range requests, replacement, duplicate slugs, origin checks, and draft privacy.

## Credits

Source layouts: Sami Fouad's personal site, cqx website, and Zega footer.
The footer uses IBM Plex Mono under its bundled OFL license and Sami's public
profile photo from zega.dev. Inconsolata and
Atkinson fonts are carried over from the personal site. Starter models:
[Poly Haven](https://polyhaven.com/license) and
[RobotExpressive / Quaternius](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive).
Every model listing preserves creator, source, license, and conversion credits.
Poly Haven's live API terms require a source credit and unique User-Agent; the
preparation script supplies both. Poly Haven's own preview renders are not
redistributed. The Studio screenshot includes Cesium Man, © 2017 Cesium,
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with display-scale and
animation-label changes in Studio; Cesium's logo has separate trademark rights.

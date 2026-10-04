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

Open `http://127.0.0.1:4321` and `/admin` (local development only). Astro runs D1 and R2 locally via
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

For initial hosted catalog provisioning, use Node 24+ and
`npm run seed:cloudflare -- --publish` with CLOUDFLARE_API_TOKEN set in the
environment. It validates models/previews, uploads to R2, then commits metadata
to D1 through Cloudflare's API. Existing slugs are skipped to preserve admin edits.
It does not bypass the app's authentication. Never put the token in the repo.

## Cloudflare setup

Cloudflare Workers is connected to `tana3d/website`, production branch `main`.
The current Astro Cloudflare adapter targets Workers rather than Pages.
Workers Git builds rebuild/deploy on pushes to `main`.

1. The R2 bucket **tana-assets** and D1 database **tana-library** have been
   provisioned in Sami's Cloudflare account. Binding names are **DB** and **LIBRARY**.
   The initial migration and 12 starter assets have been uploaded remotely.
2. Account/database IDs and existing tana.gg/www.tana.gg Worker routes are in
   `wrangler.jsonc`. Other Tana services and mail DNS records are untouched.
3. Future database changes use `npm run db:remote`.
4. Set build command `npm run build`, deploy command `npx wrangler deploy`,
   root directory `/`, and Node version `24`.
5. Register a GitHub OAuth app (owner tana3d) with homepage
   `https://admin.tana.gg` and callback
   `https://admin.tana.gg/api/auth/github/callback`. Put `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, and a random 32-byte `ADMIN_SESSION_SECRET` into
   Worker secrets. No credentials belong in Git.
6. The only allowed account is **samifouad**, permanent GitHub ID **6378290**
   (`GITHUB_ADMIN_ID` in Wrangler). Sign-in validates the real GitHub `/user`
   response, signed state, and PKCE before issuing a 12-hour signed session.
   The cookie is Secure, HttpOnly, SameSite=Lax, and restricted to admin.tana.gg.
   GitHub tokens are used for identity lookup and are not stored. No repository
   permissions are requested.

The public site is deployed at https://tana.gg with 12 starter assets. The admin
area is **only** at https://admin.tana.gg and is not linked from the public site.
Public-host `/admin`, `/api/admin`, `/login`, and OAuth routes return 404.
Unauthenticated admin API requests return 401, while the admin UI opens the
GitHub sign-in page. OAuth credentials and the session secret are configured
as Worker secrets. Cloudflare Access is not used.
Workers.dev and preview URLs are disabled. Existing Tana services and mail DNS
are preserved; website routes intercept only tana.gg, www.tana.gg, and admin.tana.gg.
Writes require a same-origin request, and unpublished media requires an owner
session. The R2 bucket remains private.

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
Header search opens /search, which has filters and excludes the Studio tile;
the homepage is an unfiltered gallery. navigation and theme controls live in
the fixed footer copied from zega.dev (persisted across view transitions), with Sami's profile photo and Studio source link.

## Brand assets

The approved Tana mark is a black extruded T, tilted slightly, with green,
yellow, and red bands wrapping around its sides. It is used in the header and
favicon. `public/brand/tana-master.png` is the transparent source; PNG sizes
16–1024, macOS `tana.icns`, and Windows `tana.ico` are ready for app packaging.
Use `tana-512.png` for GitHub and other square profile images. The original
yellow concept is retained separately. `node scripts/build-brand-icons.mjs`
rebuilds derivatives; ICNS export requires macOS.

The mark was generated with the built-in image generation tool. The original
prompt requested a centered, transparent, bold black 3D T with a slight tilt
and yellow side shading. The approved edit preserved that shape and replaced
the sides with equal green, yellow, and red bands along the depth, following
the entire T perimeter, with no flag emblem or additional text.

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

The Studio card uses the OpenAI blossom icon from Simple Icons v13 beside
ChatGPT; the icon represents its respective owner.

# neon1-site

The neon1.tech website. It's a static page in `src/app/public/`, served from a private S3 bucket through CloudFront. The hosting itself lives in [neon1-aws-infrastructure](https://github.com/neon1llc/neon1-aws-infrastructure) under `site/`.

`src/app/public/shared/` holds the design that [1NEON](https://github.com/neon1llc/neon1-1NEON) loads from this site at runtime: fonts, brand colors, the rain and its controls, and the chat window (`chat.js` and `chat.css`). Changes there show up in both, so check the 1NEON sign-in screen too.

## Check and preview

You need Python 3 and Node.js. Gitleaks is used if it's installed, otherwise the secret scan runs it in Docker.

```bash
make content && make check   # HTML validation, JS syntax, anchors and asset paths, the white rabbit's lifetime, corpus blocks, release versions, asset manifest, baked models, size budget, secret scan
make content    # write the case studies, questions, Knowledge Center, and blog from the newest neon1-corpus release
make serve      # http://localhost:8000
make behavior   # the page driven in headless Chromium; needs Node's playwright package and its browser
make perf       # the white rabbit's draw calls, triangles, and resources against their budget; same needs
```

Run `make help` to list every target.

A release is named in four places: the version meta in `index.html` and `tour.html`, the footer's link text, and the top `## vX.Y.Z` entry in `CHANGELOG.md`. `make release` (part of `make check`) fails if they disagree. The white rabbit's media loader reads the meta, so it has no copy of its own.

The asset check follows each page into its stylesheets and scripts, so a missing texture or module fails it. A path a script builds at run time, like `` `/media/white-rabbit/tex/${name}.webp` ``, must be listed in `scripts/assets.json` with where its names come from, and every name it expands to must be a file. Add a new one there when you write one.

## Words from neon1-corpus

The case studies and the questions are written in [neon1-corpus](https://github.com/neon1llc/neon1-corpus), the one place neon1's public words live, and copied into `index.html` between `<!-- corpus:NAME -->` comments. Edit them there, not here. The Knowledge Center (`/knowledge/`) and the blog (`/blog/`, with an RSS feed at `/blog/feed.xml`) are generated from the same corpus, one folder of `index.html` pages per document or post, sharing the page shell in `scripts/page-shell.mjs`. Shelves and posts come from the corpus manifest, so a new document or post, or a whole new shelf, needs no change here. Each post ends with share links: plain links to each service's share page, plus Copy link and the device share sheet from `js/blog-share.js`, with no outside scripts.

Every build reads the newest corpus release (the highest `vX.Y.Z` tag; `make corpus-tag` prints it). `make content` writes all of it: the blocks in `index.html`, `/knowledge/`, `/blog/`, the sitemap's blocks, and `/llms.txt`. The `/knowledge/` and `/blog/` folders are built, never committed; the committed `index.html` blocks are only the last sync. Run `make content` after a fresh checkout and before `make check`. To pin a release, pass `CORPUS_TAG=vX.Y.Z`; to try unreleased corpus edits, pass `CORPUS_DIR=../neon1-corpus`. Checks need network access once, to fetch the release into `.corpus/`.

### Publishing a corpus release

A corpus release reaches neon1.tech without a site change. The deploy workflow's watch runs every 15 minutes (and on demand from the Actions tab): it compares the newest corpus release with `/knowledge/corpus.json` on the live site, and when they differ it runs the same checks, browser tests, PDF printing, and release switch as a site deploy, built from `main` and that corpus release. The site's version and tags don't move, since the site's own code didn't change; `/knowledge/corpus.json` names the corpus release that's live. `make rollback` switches back like any other release.

Everything stays static HTML written at build time, so search engines, link previews, and readers without JavaScript get whole pages, and the CSP needs no new origin. Nothing on a page fetches corpus content at run time; `make static` (part of `make check`) fails if a page script references the corpus or GitHub.

## Content Security Policy

CloudFront serves the page with a strict policy: scripts, styles, fonts, and connections only from neon1.tech, and images from neon1.tech or `data:` URLs. Keep scripts and styles in their own files, since inline `<script>`, `<style>`, `style=""` attributes, and `on…` handlers are blocked. Setting styles from JavaScript (`el.style.x = …`) is fine. A new outside origin needs a change to the policy in neon1-aws-infrastructure first.

`robots.txt`, `sitemap.xml`, and `.well-known/security.txt` are published with the page, and so are the square icons at fixed URLs: `/favicon.ico`, `/favicon-48.png`, and `/apple-touch-icon.png`. The structured data names `/media/neon1-logo-512.png` as the logo and keeps the wide link-preview card for `og:image`. `make icons` redraws all four from the bar's mark. Update the security contact's `Expires` date before it passes.

## The white rabbit

Now and then a white rabbit drops into the rain on the landing. Catching it stops the rain, and scrolling down pulls back out of an old TV into a sunlit room that ends on "go touch grass". Scrolling up plays it back. The controller is `js/white-rabbit.js`. The 3D scene in `js/white-rabbit-scene.js` and the three.js bundle in `js/vendor/` load only after a catch. Reduced motion, or a browser without WebGL, gets a still card instead, and turning on reduced motion mid-scene switches to the card.

From the keyboard, "follow the white rabbit" sits after the bar's links, off screen until it has focus, like the skip link. While a rabbit is caught, nothing on screen explains it: focus moves to a line only screen readers read (how to move, and that Esc leaves), Tab stays there, and focus goes back where it was when it ends. Each catch is its own entry: the scene is built at most once per entry, and its loop stops on every way out.

Two query flags help with testing, and in production they only add rabbits:

- `?rabbit=now` keeps a rabbit on the landing and writes its position to `#whiteRabbit` as `data-spot`.
- `?rabbit=p0.5` catches a rabbit and jumps to that point in the scene, from `p0` to `p1`.

`make perf` enters the scene in headless Chromium on a desktop viewport and an emulated phone, records three.js's draw calls, triangles, geometries, textures, and shader programs at six fixed points of the walk, and fails if any goes past `scripts/perf-budget.json`. `docs/perf-report.md` has the last numbers and how the budget was set; `PERF_REPORT=docs/perf-report.md make perf` rewrites it. Headless WebGL is software-rendered, so its frame times are only for comparing runs on one machine.

`make three` rebuilds the bundle from `scripts/three/entry.js` with `npm ci` from `scripts/three/package-lock.json`, so every package version is locked, and says whether the result matches the hash in the asset manifest.

The scene's models and images are in `media/white-rabbit/`, with their credits in `media/white-rabbit/CREDITS.txt`. `src/app/asset-manifest.json` records every shipped third-party or baked asset, fonts and vendored bundles included: its sha256, its source and license, how it was made, and which files load it. Where only a creator's profile or a library's home page is known, it says so, and its `unresolved` list tracks each piece of provenance still owed (the far trees' origin, the font releases, exact model pages), which `make manifest` keeps from going untracked. The Blender files, recipes, and photos behind the scene stay in the owner's private planning folder. `make models` builds the room in Node and fails if `room.glb`, its baked maps in `lm/`, or the car's material names no longer match the code, so a geometry change that would misplace the baked light fails loudly. The car model is based on "2019 Chevrolet Camaro" by IsaacOldton (CC BY 4.0), modified: unbranded, recolored, and optimized. The trees and photographed textures come from Poly Haven (CC0).

## Dev: dev.neon1.tech

dev.neon1.tech is a private copy of the site for looking at changes before they ship. Its hosting is `site-dev/` in neon1-aws-infrastructure, which also explains how its sign-in works.

- **Any branch but main** deploys there on push, in about 30 seconds, as a preview at `dev.neon1.tech/__preview?b=<branch>`. `/__preview` alone goes back to the dev release.
- **The `dev` branch** is the dev release. `dev-sync` merges main into it after every push to main and rebuilds it. Work branches can be merged into `dev` to be seen together, but each one goes to main on its own.
- **Corpus drafts:** run the dev workflow by hand with `corpus_ref` set to a neon1-corpus branch, and that branch's documents, drafts included, are built into dev.
- **Never a release.** Dev runs only the quick checks (`make dev-check`), is never tagged, and changelog entries wait under `## Unreleased` until the batch goes to main.

```bash
make dev-push                 # build this branch and put it on dev (dev: the dev release; others: a preview)
make dev-drop BRANCH=<name>   # forget a preview
make dev-rollback             # previous dev release
make dev-gate                 # new sign-in link (printed once; signed-in devices stay in)
make dev-signout              # sign every device out
make dev-allow EMAIL=<who>    # let a neon1 person sign in (dev-deny removes them)
```

Releasing is unchanged: merge the finished branches to main, with the version set, and the deploy below tags it.

## Deploy

Pushing to `main` runs the checks and then deploys from GitHub Actions. The `check` job runs `make check`, then `make behavior` and `scripts/chat_check.cjs` in headless Chromium with every API stubbed, and the deploy job starts only after all three pass. The workflow assumes an AWS role through OIDC, so the repo holds no AWS keys. The role ARN is the repository variable `AWS_DEPLOY_ROLE_ARN`.

To deploy by hand:

```bash
export AWS_PROFILE=neon1
make deploy verify
```

`make deploy` ships the site as one release, so nobody ever gets a new page with an old script. Pages, scripts, and styles go up whole to `releases/<id>/` in the bucket, where the id is a hash of their content. Then one write to the `neon1-site-release` key value store makes it the live release, and neon1.tech's router serves every visitor from that folder (see neon1-aws-infrastructure's `site/`). The same content gives the same id, so a deploy with nothing new changes nothing. Fonts, media, and `.well-known` are shared at the bucket's top. Fonts and media are cached for a year, and everything else revalidates on each visit. A new folder means new cache keys, so no invalidation is needed. The last 5 releases are kept.

`make rollback` switches back to the release before the live one, in seconds, without uploading anything. `RELEASE=<id>` picks a specific one. `make invalidate` clears CloudFront, which is needed only if a shared file was changed in place. `make verify` checks that neon1.tech and www.neon1.tech return the version in the local `index.html`.

`BUCKET`, `DISTRIBUTION`, `RELEASE_STORE`, and `VERIFY_URLS` can be overridden on the command line.

### Fonts and media never change in place

Everything under `fonts/` and `media/` is served as `immutable` for a year, so a browser that has a file never asks for it again, and CloudFront invalidation can't reach it. The 3D scene also loads after the page, so a tab left open from an older release can still ask for that release's files. One rule covers every font, image, model, recording, and the link-preview card, however it's loaded (CSS, `<meta>`, a fetch, or the three.js loaders):

- A path always means the same bytes. To change a file, give it a new name (`og-card-2.png`, `white-rabbit-v9.m4a`), and point its users at the new name. Files that change together, like `room.glb` and its baked maps in `lm/`, move to a new name or folder together.
- Keep the old file. The deploy syncs fonts and media first and without `--delete`, so files this release renamed or dropped stay in the bucket for older pages. Remove one from the bucket by hand only once no release still in use points at it.
- `src/app/asset-manifest.json` lists every font and media file with its sha256. After adding or renaming one, run `make rehash` and commit the result. `make manifest` (part of `make check`) fails if a file is missing from it, or if a path that exists on `origin/main` (on a push, the commit before it; `IMMUTABLE_BASE` overrides) now holds different bytes.

The scene's loaders still add `?v=` with the release to media URLs, which only makes browsers fetch again on each release. It stays because some of those paths changed bytes before this rule existed.

## License

neon1-site is source-available. You can read, run and change it, and every release becomes fully open two years after it's published.

| What | License | File |
|---|---|---|
| Code: HTML structure, CSS, JavaScript, scripts, build files | Functional Source License 1.1, ALv2 Future License. Use it for anything except a competing product or service. Each release becomes Apache-2.0 after two years. | `LICENSE-CODE` |
| Written copy and case studies | CC BY-ND 4.0. Share word for word with credit, no altered versions. | `LICENSE` |
| Photos and photo-based textures of the white rabbit's room and yard | Not licensed for reuse | |
| The neon1, 1NEON, N1 Supply and Ready, Secure, Go names, logos and brand marks | Not licensed for reuse | `TRADEMARK.md` |
| Third-party models, textures, fonts and libraries | Their own licenses | `src/app/asset-manifest.json`, `src/app/public/media/white-rabbit/CREDITS.txt` |

Required credit on every copy: "© neon1 LLC (neon1.tech)". Keep the `NOTICE` file with every copy.

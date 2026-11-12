# Makefile - Check, serve and deploy the neon1.tech static site.
# Usage: make help
#
# The same targets run locally and in CI. Deploy targets use whatever AWS
# credentials are in the environment, such as AWS_PROFILE=neon1 locally.


# Settings that the command line or environment can override
SITE_DIR     ?= src/app/public
BUCKET       ?= neon1-public-website
DISTRIBUTION ?= EKL1R4AOR1VRG
VERIFY_URLS  ?= https://neon1.tech/ https://www.neon1.tech/
AWS_REGION   ?= us-east-1
PORT         ?= 8000
BUDGET_KB    ?= 8192
# The key value store whose "release" key names the live release folder (neon1-aws-infrastructure site/)
RELEASE_STORE ?= neon1-site-release
# neon1-corpus holds the case studies and questions. A tag pins it; CORPUS_DIR can point at a local checkout instead
CORPUS_TAG   ?= v0.34.1
CORPUS_REPO  ?= https://github.com/neon1llc/neon1-corpus
CORPUS_DIR   ?= .corpus/$(CORPUS_TAG)

# The AWS CLI reads the region from the environment
export AWS_REGION

# Pinned tools: Node runs html-validate, and Docker stands in for a missing gitleaks
HTML_VALIDATE  := html-validate@11.17.0
GITLEAKS_IMAGE := ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f


# Plain make shows the help
.DEFAULT_GOAL := help
.PHONY: help corpus corpus-check corpus-export knowledge knowledge-check knowledge-export knowledge-pdf blog blog-check blog-export check html js links logic frame frame-check release rollback manifest rehash models budget secrets behavior perf serve three icons deploy invalidate verify indexnow


##@ Checks

check: html js links logic frame-check corpus-check knowledge-check blog-check release manifest models budget secrets ## Run every static check

# Every page served as HTML, so each check covers the tour as well as the home page
PAGES := $(SITE_DIR)/index.html $(SITE_DIR)/tour.html
# The knowledge center's generated pages, checked like the others
KNOWLEDGE_PAGES = $(shell find $(SITE_DIR)/knowledge -name index.html 2>/dev/null | sort)
# The blog's generated pages, checked the same way
BLOG_PAGES = $(shell find $(SITE_DIR)/blog -name index.html 2>/dev/null | sort)

html: ## Validate every page against the HTML standard
	@command -v npx >/dev/null 2>&1 || { echo "html: install Node.js to get npx"; exit 1; }
	npx --yes $(HTML_VALIDATE) $(PAGES) $(KNOWLEDGE_PAGES) $(BLOG_PAGES)

js: ## Syntax-check the JavaScript files, vendored modules, shared modules, and inline scripts
	@command -v node >/dev/null 2>&1 || { echo "js: install Node.js"; exit 1; }
	@for f in $(SITE_DIR)/js/*.js $(SITE_DIR)/js/vendor/*.js $(SITE_DIR)/shared/*.js; do node --check "$$f" || exit 1; done
	@for f in $(PAGES); do python3 scripts/check_page.py scripts "$$f" || exit 1; done

links: ## Check in-page anchors and root-relative asset paths
	@for f in $(PAGES) $(KNOWLEDGE_PAGES) $(BLOG_PAGES); do python3 scripts/check_page.py links "$$f" || exit 1; done

# No browser: replays the white rabbit's lifetime faults against the real controller, then breaks a fixture
# site one way at a time to prove the links check catches each break
logic: ## Check the white rabbit's scene lifetime, and that the links check fails on broken fixtures
	@command -v node >/dev/null 2>&1 || { echo "logic: install Node.js"; exit 1; }
	@node scripts/rabbit_lifecycle.cjs $(SITE_DIR)
	@python3 scripts/test_check_page.py
	@node --test scripts/knowledge.test.mjs

# The bar and footer markup lives once, in index.html; other pages get copies
frame: ## Copy the shared bar and footer blocks from index.html into the other pages
	@python3 scripts/frame.py sync $(SITE_DIR)

frame-check: ## Fail if any page's bar or footer differs from index.html
	@python3 scripts/frame.py check $(SITE_DIR)

# The case studies and questions are written once, in neon1-corpus, and copied into index.html from the pinned tag
corpus-export:
	@command -v node >/dev/null 2>&1 || { echo "corpus: install Node.js"; exit 1; }
	@test -d $(CORPUS_DIR)/tools || { git init -q $(CORPUS_DIR) && git -C $(CORPUS_DIR) fetch -q --depth 1 $(CORPUS_REPO) $(CORPUS_TAG) && git -C $(CORPUS_DIR) checkout -q FETCH_HEAD; }
	@node $(CORPUS_DIR)/tools/export.mjs --target site --out "$(abspath .corpus/export)" >/dev/null

corpus: corpus-export ## Rewrite the case studies and questions in index.html from the pinned neon1-corpus tag
	@node scripts/corpus.mjs sync $(SITE_DIR) .corpus/export/site

corpus-check: corpus-export ## Fail if the case studies or questions differ from the pinned neon1-corpus tag
	@node scripts/corpus.mjs check $(SITE_DIR) .corpus/export/site

# The knowledge center: every corpus document the knowledge bundle holds, as a page under /knowledge/
knowledge-export: corpus-export
	@node $(CORPUS_DIR)/tools/export.mjs --target knowledge --out "$(abspath .corpus/export)" >/dev/null

# llms.txt, written whole by scripts/knowledge.mjs, lists the blog's posts too, so the knowledge targets read both bundles
knowledge: knowledge-export blog-export ## Rewrite the knowledge center under /knowledge/ from the pinned neon1-corpus tag
	@node scripts/knowledge.mjs sync $(SITE_DIR) .corpus/export/knowledge .corpus/export/blog

knowledge-check: knowledge-export blog-export ## Fail if the knowledge center differs from the pinned neon1-corpus tag
	@node scripts/knowledge.mjs check $(SITE_DIR) .corpus/export/knowledge .corpus/export/blog

# The blog: every post the blog bundle holds, as a page under /blog/, with an RSS feed. Links to other corpus
# documents open their knowledge center pages, so it reads the knowledge bundle too
blog-export: corpus-export
	@node $(CORPUS_DIR)/tools/export.mjs --target blog --out "$(abspath .corpus/export)" >/dev/null

blog: blog-export knowledge-export ## Rewrite the blog under /blog/ from the pinned neon1-corpus tag
	@node scripts/blog.mjs sync $(SITE_DIR) .corpus/export/blog .corpus/export/knowledge

blog-check: blog-export knowledge-export ## Fail if the blog differs from the pinned neon1-corpus tag
	@node scripts/blog.mjs check $(SITE_DIR) .corpus/export/blog .corpus/export/knowledge

# Chromium through Playwright prints each document with knowledge/print.css. The deploy job runs it; PDFs aren't committed
# Chromium draws the running footer in a frame that only sees installed fonts, so Figtree is installed for this user first
knowledge-pdf: knowledge-export ## Print the knowledge center's PDFs next to their pages (needs Playwright)
	@mkdir -p $(HOME)/.local/share/fonts && cp knowledge/fonts/*.ttf $(HOME)/.local/share/fonts/ && (fc-cache -f >/dev/null 2>&1 || true)
	@node scripts/knowledge-pdf.mjs $(SITE_DIR) .corpus/export/knowledge

# The version meta on every page, the footer link, the CHANGELOG's top entry, and any literal ?v=
release: ## Fail if the places that name the release disagree
	@python3 scripts/release.py $(SITE_DIR) CHANGELOG.md

# Fonts and media are immutable once deployed: a path keeps its bytes for good (see README, Deploy)
MANIFEST := src/app/asset-manifest.json
manifest: ## Fail if a shipped asset is unlisted, differs from its hash, lacks its source, or changed bytes at an old path
	@python3 scripts/manifest.py check $(SITE_DIR) $(MANIFEST)

rehash: ## Refresh the hashes in the asset manifest after adding or renaming a file
	@python3 scripts/manifest.py update $(SITE_DIR) $(MANIFEST)

# Builds the room with three.js in Node and compares it with room.glb and its baked maps, then the car's materials
models: ## Fail if the baked room or the car models no longer match the code that names their parts
	@command -v node >/dev/null 2>&1 || { echo "models: install Node.js"; exit 1; }
	@node scripts/models.cjs $(SITE_DIR)

# The knowledge center grows with the corpus, one small page per document, so it's left out here and
# scripts/knowledge.mjs caps each of its pages instead. Its PDFs are downloads printed at deploy
budget: ## Fail if the deployed files outside the knowledge center exceed BUDGET_KB
	@kb=$$(find $(SITE_DIR) -type f ! -name '.*' ! -path '*/knowledge/*' -exec cat {} + | wc -c | awk '{print int($$1 / 1024)}'); \
	echo "site size: $${kb} KB of $(BUDGET_KB) KB"; \
	test "$$kb" -le "$(BUDGET_KB)"

# Drives headless Chromium against a loopback copy of the site, so it needs Playwright and its browser.
# It stays out of check, which needs neither; CI's check job installs them and runs it, with
# scripts/chat_check.cjs, before the deploy job may start
behavior: ## Check the contact form, case studies, case links, and white rabbit in a real browser
	@command -v node >/dev/null 2>&1 || { echo "behavior: install Node.js"; exit 1; }
	node scripts/behavior.cjs $(SITE_DIR)

# Also headless Chromium, and a few minutes of software rendering, so it stays out of check too
perf: ## Measure the white rabbit's draw calls, triangles, and resources, and fail past scripts/perf-budget.json
	@command -v node >/dev/null 2>&1 || { echo "perf: install Node.js"; exit 1; }
	node scripts/perf.cjs $(SITE_DIR)

secrets: ## Scan the git history for secrets with gitleaks
	@if command -v gitleaks >/dev/null 2>&1; then \
		gitleaks git --redact --no-banner .; \
	else \
		docker run --rm -u "$$(id -u):$$(id -g)" -v "$(CURDIR):/repo" \
			$(GITLEAKS_IMAGE) git --redact --no-banner /repo; \
	fi


##@ Local

serve: ## Serve the site at http://localhost:PORT
	python3 -m http.server $(PORT) --bind 127.0.0.1 --directory $(SITE_DIR)

# The white rabbit's three.js bundle is generated, so it is rebuilt rather than edited
three: ## Rebuild the vendored three.js bundle for the white rabbit
	scripts/three/build.sh


# The favicons, touch icon, and square logo are drawn from the bar's mark; a redrawn logo needs a new media name
icons: ## Redraw the square brand icons from the mark (needs Playwright), then run make rehash
	@command -v node >/dev/null 2>&1 || { echo "icons: install Node.js"; exit 1; }
	node scripts/icons.cjs $(SITE_DIR)


##@ Deploy

# Each release goes up whole under releases/<id>/, then one write to the release store switches every
# visitor to it (scripts/deploy.py). Fonts and media are shared and never deleted, so a page left
# open from an older release can still load them. New folders mean new cache keys: no invalidation
deploy: ## Upload the site as one release, switch to it, and keep the last 5
	@test -n "$(BUCKET)" || { echo "deploy: BUCKET is empty"; exit 1; }
	@test -f "$(SITE_DIR)/index.html" || { echo "deploy: no $(SITE_DIR)/index.html, refusing to sync"; exit 1; }
	python3 scripts/deploy.py deploy $(SITE_DIR) $(BUCKET) $(RELEASE_STORE)

# After verify: pings IndexNow (Bing, and through it Copilot and ChatGPT search) with the pages that just changed
indexnow: ## Tell IndexNow search engines which pages changed (DRY_RUN=1 to print only)
	python3 scripts/indexnow.py $(SITE_DIR) $(if $(DRY_RUN),--dry-run)

rollback: ## Switch back to the release before the live one (RELEASE=<id> for a specific one)
	python3 scripts/deploy.py rollback $(BUCKET) $(RELEASE_STORE) $(RELEASE)

# Releases never need it; kept for a file changed in place at the bucket's top (fonts, media, .well-known)
invalidate: ## Invalidate the whole CloudFront cache
	@set -e; \
	id=$$(aws cloudfront create-invalidation --distribution-id "$(DISTRIBUTION)" \
		--paths "/*" --query Invalidation.Id --output text); \
	echo "Waiting for invalidation $$id"; \
	aws cloudfront wait invalidation-completed --distribution-id "$(DISTRIBUTION)" --id "$$id"

# Retries for about a minute while the CDN picks up the new version. curl's own exit status is
# checked before the version (a cut-off transfer fails), and the page must arrive whole
verify: ## Check that each live URL returns 200 and serves the local version
	@version=$$(sed -n 's/.*<meta name="version" content="\([^"]*\)".*/\1/p' $(SITE_DIR)/index.html); \
	test -n "$$version" || { echo "verify: no version meta in index.html"; exit 1; }; \
	for url in $(VERIFY_URLS); do \
		ok=; \
		for try in 1 2 3 4 5 6; do \
			body=$$(curl -fsSL --max-time 15 "$$url") && \
			printf '%s' "$$body" | grep -qF "name=\"version\" content=\"$$version\"" && \
			printf '%s' "$$body" | grep -qi "</html>" && { ok=1; break; }; \
			sleep 10; \
		done; \
		test -n "$$ok" || { echo "verify: $$url is not serving version $$version"; exit 1; }; \
		echo "$$url serves version $$version"; \
	done


##@ Help

help: ## Show targets
	@awk 'BEGIN {FS = ":.*## "} \
		/^##@/ {printf "\n%s\n", substr($$0, 5)} \
		/^[a-z-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

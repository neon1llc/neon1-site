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
CHANGES      ?= .deploy-changes

# The AWS CLI reads the region from the environment
export AWS_REGION

# Pinned tools: Node runs html-validate, and Docker stands in for a missing gitleaks
HTML_VALIDATE  := html-validate@11.17.0
GITLEAKS_IMAGE := ghcr.io/gitleaks/gitleaks:v8.30.1

# Fonts and media keep their names, so a changed file needs a new name to reach
# browsers that already cached it. Everything else revalidates on each visit.
LONG_CACHE  := public, max-age=31536000, immutable
SHORT_CACHE := no-cache
DOTFILES    := --exclude ".*" --exclude "*/.*"

# Plain make shows the help
.DEFAULT_GOAL := help
.PHONY: help check html js links budget secrets serve deploy invalidate verify


##@ Checks

check: html js links budget secrets ## Run every static check

html: ## Validate index.html against the HTML standard
	@command -v npx >/dev/null 2>&1 || { echo "html: install Node.js to get npx"; exit 1; }
	npx --yes $(HTML_VALIDATE) $(SITE_DIR)/index.html

js: ## Syntax-check the JavaScript files and inline scripts
	@command -v node >/dev/null 2>&1 || { echo "js: install Node.js"; exit 1; }
	@for f in $(SITE_DIR)/js/*.js; do node --check "$$f" || exit 1; done
	@python3 scripts/check_page.py scripts $(SITE_DIR)/index.html

links: ## Check in-page anchors and root-relative asset paths
	@python3 scripts/check_page.py links $(SITE_DIR)/index.html

budget: ## Fail if the deployed files exceed BUDGET_KB
	@kb=$$(find $(SITE_DIR) -type f ! -name '.*' -exec cat {} + | wc -c | awk '{print int($$1 / 1024)}'); \
	echo "site size: $${kb} KB of $(BUDGET_KB) KB"; \
	test "$$kb" -le "$(BUDGET_KB)"

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


##@ Deploy

# Two passes set the cache headers: long for fonts and media, short for the rest
deploy: ## Sync the site to the bucket when its content differs
	@test -n "$(BUCKET)" || { echo "deploy: BUCKET is empty"; exit 1; }
	@test -f "$(SITE_DIR)/index.html" || { echo "deploy: no $(SITE_DIR)/index.html, refusing to sync"; exit 1; }
	@aws s3api list-objects-v2 --bucket "$(BUCKET)" --query 'Contents[].[Key,ETag]' --output json \
		| python3 scripts/changes.py $(SITE_DIR) > $(CHANGES)
	@if [ ! -s $(CHANGES) ]; then echo "s3://$(BUCKET) already matches $(SITE_DIR)"; exit 0; fi; \
	cat $(CHANGES); \
	set -e; \
	aws s3 sync $(SITE_DIR) "s3://$(BUCKET)" --delete --no-progress \
		--exclude "*" --include "fonts/*" --include "media/*" $(DOTFILES) \
		--cache-control "$(LONG_CACHE)"; \
	aws s3 sync $(SITE_DIR) "s3://$(BUCKET)" --delete --no-progress \
		--exclude "fonts/*" --exclude "media/*" $(DOTFILES) \
		--cache-control "$(SHORT_CACHE)"

# One wildcard path is billed as a single path, and HTML and JS revalidate anyway,
# so purging everything after a real change is simpler than listing paths
invalidate: ## Invalidate CloudFront after a deploy that changed files (FORCE=1 always)
	@case "$(FORCE)" in \
		1|true) ;; \
		*) if [ ! -s $(CHANGES) ]; then echo "No deployed changes, skipping invalidation"; exit 0; fi ;; \
	esac; \
	set -e; \
	id=$$(aws cloudfront create-invalidation --distribution-id "$(DISTRIBUTION)" \
		--paths "/*" --query Invalidation.Id --output text); \
	echo "Waiting for invalidation $$id"; \
	aws cloudfront wait invalidation-completed --distribution-id "$(DISTRIBUTION)" --id "$$id"; \
	rm -f $(CHANGES)

# Retries for about a minute while the CDN picks up the new version
verify: ## Check that each live URL returns 200 and serves the local version
	@version=$$(sed -n 's/.*<meta name="version" content="\([^"]*\)".*/\1/p' $(SITE_DIR)/index.html); \
	test -n "$$version" || { echo "verify: no version meta in index.html"; exit 1; }; \
	for url in $(VERIFY_URLS); do \
		ok=; \
		for try in 1 2 3 4 5 6; do \
			if curl -fsSL --max-time 15 "$$url" | grep -F "name=\"version\" content=\"$$version\"" >/dev/null; then \
				ok=1; break; \
			fi; \
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

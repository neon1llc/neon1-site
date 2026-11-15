#!/usr/bin/env bash
# scripts/releases.sh - Gathers what the Knowledge Center's releases page is written from (make releases-export).
# Usage: scripts/releases.sh OUT_DIR
#
# For every public neon1 repository it writes OUT_DIR/<repo>.tags (each tag and the day it was made) and
# OUT_DIR/<repo>.md (CHANGELOG.md at the newest vX.Y.Z tag, so only released work shows). neon1-site's own
# changelog is this checkout's, since the release being built isn't tagged until it's live. OUT_DIR/pin.txt names
# the tag read from each other repository; RELEASES_PIN (the same repo@tag list, comma separated) fixes the set,
# which the deploy job does so its checks and its deploy read the same releases. Only commits and tags are
# cloned; git fetches the one changelog it shows.
set -euo pipefail
out=${1:?usage: scripts/releases.sh OUT_DIR}
REPOS="neon1-1NEON neon1-chat neon1-corpus neon1-aws-infrastructure refmark deploy-ops aws-clip ready-secure-go soc-2-readiness compliance-basics incident-response-for-small-teams phishing-awareness-kit household-tech-handbook"
rm -rf "$out"
mkdir -p "$out/git"

pin=()
for repo in neon1-site $REPOS; do
  g="$out/git/$repo.git"
  git clone -q --bare --filter=tree:0 "https://github.com/neon1llc/$repo.git" "$g"
  git -C "$g" for-each-ref --format='%(refname:short) %(creatordate:short)' 'refs/tags/v*' > "$out/$repo.tags"
  [ "$repo" = neon1-site ] && continue
  # The pinned tag when the deploy job gave one, else the newest release (pre-releases left out)
  tag=$(tr ',' '\n' <<< "${RELEASES_PIN:-}" | sed -n "s|^$repo@||p")
  [ -n "$tag" ] || tag=$(git -C "$g" tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
  [ -n "$tag" ] || { echo "releases: $repo has no release tag" >&2; exit 1; }
  git -C "$g" show "$tag:CHANGELOG.md" > "$out/$repo.md"
  pin+=("$repo@$tag")
done
cp CHANGELOG.md "$out/neon1-site.md"
(IFS=,; echo "${pin[*]}") > "$out/pin.txt"
rm -rf "$out/git"
echo "releases: $(tr ',' ' ' < "$out/pin.txt")"

#!/bin/sh

# scripts/three/build.sh - Rebuild the vendored three.js bundle that the white rabbit loads.
# Usage: scripts/three/build.sh
#
# Installs pinned three.js and esbuild in a temporary folder, bundles only what
# entry.js exports, and writes the bundle and the three.js license to js/vendor/.

set -eu

# Pinned versions and paths; a new three.js version gets a new file name
THREE=0.187.0
ESBUILD=0.25.12
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../../src/app/public/js/vendor"
NAME="three-$THREE.rabbit.min.js"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Install into the temporary folder, away from the repository
cp "$HERE/entry.js" "$TMP/entry.js"
cd "$TMP"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund "three@$THREE" "esbuild@$ESBUILD"

# One minified ES module; the license comments move to the end of the file
npx esbuild entry.js --bundle --format=esm --minify --legal-comments=eof \
  --banner:js="/* js/vendor/$NAME - three.js r$(echo "$THREE" | cut -d. -f2) (MIT, see three-LICENSE.md), bundled by scripts/three/build.sh. */" \
  --outfile="$OUT/$NAME"
cp node_modules/three/LICENSE "$OUT/three-LICENSE.md"
ls -l "$OUT/$NAME"

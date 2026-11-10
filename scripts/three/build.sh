#!/bin/sh

# scripts/three/build.sh - Rebuild the vendored three.js bundle that the white rabbit loads.
# Usage: scripts/three/build.sh
#
# Installs three.js and esbuild in a temporary folder from package-lock.json (npm ci, so every
# transitive version is the locked one), bundles only what entry.js exports, writes the bundle and the
# three.js license to js/vendor/, and says whether the bundle matches the hash in the asset manifest.
# To move to new versions: change package.json and THREE below together, run npm install
# --package-lock-only in scripts/three, rebuild, then make rehash.

set -eu

# The three.js version names the file; package.json must pin the same one (checked below)
THREE=0.187.0
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../../src/app/public/js/vendor"
NAME="three-$THREE.rabbit.min.js"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# The file name and the locked version must agree, or the bundle would be misnamed
grep -q "\"three\": \"$THREE\"" "$HERE/package.json" || { echo "three: package.json does not pin three $THREE"; exit 1; }

# Install the locked tree into the temporary folder, away from the repository
cp "$HERE/entry.js" "$HERE/package.json" "$HERE/package-lock.json" "$TMP/"
cd "$TMP"
npm ci --silent --no-audit --no-fund

# One minified ES module; the license comments move to the end of the file
npx esbuild entry.js --bundle --format=esm --minify --legal-comments=eof \
  --banner:js="/* js/vendor/$NAME - three.js r$(echo "$THREE" | cut -d. -f2) (MIT, see three-LICENSE.md), bundled by scripts/three/build.sh. */" \
  --outfile="$OUT/$NAME"
cp node_modules/three/LICENSE "$OUT/three-LICENSE.md"
ls -l "$OUT/$NAME"

# Reproducible means the same bytes as the shipped bundle; a difference is reported, not hidden
MANIFEST="$HERE/../../src/app/asset-manifest.json"
want=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['files'].get(sys.argv[2], {}).get('sha256', ''))" "$MANIFEST" "js/vendor/$NAME")
got=$(sha256sum "$OUT/$NAME" | cut -d' ' -f1)
if [ "$want" = "$got" ]; then echo "three: $NAME matches the asset manifest ($got)"
else echo "three: $NAME differs from the asset manifest (manifest ${want:-none}, built $got); check git diff, then make rehash if intended"; fi

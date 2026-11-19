#!/usr/bin/env node
// scripts/versions.mjs - Writes the release shown on each code-and-resources row of index.html, or checks the rows match.
// Usage: node scripts/versions.mjs sync|check SITE_DIR RELEASES_DIR   (make knowledge, and make knowledge-check in make check)
//
// RELEASES_DIR is what scripts/releases.sh gathered. Its pin.txt names the release read from each other repository
// (the newest tag, or the deploy job's pin), so a row never shows a version older than the one the Knowledge Center's
// releases page lists. neon1-site's own row is the release being built; scripts/release.py checks it.

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [mode, siteDir, releasesDir] = process.argv.slice(2)
if (!["sync", "check"].includes(mode) || !siteDir || !releasesDir) {
  console.error("usage: node scripts/versions.mjs sync|check SITE_DIR RELEASES_DIR")
  process.exit(2)
}

const file = join(siteDir, "index.html")
const html = readFileSync(file, "utf8")
const pins = readFileSync(join(releasesDir, "pin.txt"), "utf8").trim().split(",").map((p) => p.split("@"))

let next = html
const stale = []
for (const [repo, tag] of pins) {
  // A row is one line: its link to the repository, then "vX.Y.Z · license" in the state paragraph
  const row = new RegExp(`(github\\.com/neon1llc/${repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^\\n]*?<p class="state">)(v\\d+\\.\\d+\\.\\d+)`)
  const found = next.match(row)
  if (!found) continue
  if (found[2] !== tag) { stale.push(`${repo}: row shows ${found[2]}, release is ${tag}`); next = next.replace(row, `$1${tag}`) }
}

if (mode === "check") {
  if (stale.length) { console.error(`versions: index.html rows are stale; run make knowledge\n  ${stale.join("\n  ")}`); process.exit(1) }
  console.log("versions: rows match the releases")
} else {
  if (next !== html) writeFileSync(file, next)
  console.log(stale.length ? `versions: updated ${stale.length} rows (${stale.join("; ")})` : "versions: already match")
}

// scripts/releases.test.mjs - Behavior tests for the releases page: which changelog entries count, their dates,
// their order across products, and the small Markdown they're written in. Run: node --test scripts/
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { parseChangelog, compareVersions, entryHtml, gather, releasesBody } from "./releases-lib.mjs"

// Unreleased work and the intro never show; pre-releases under "Before v0.1.0" do, without their commit notes
test("only released entries are read", () => {
  const e = parseChangelog(`# Changelog\n\nIntro.\n\n## Unreleased\n\n- Not yet.\n\n## v0.2.0 - 2026-11-15\n\n### Added\n- Two.\n\n## v0.1.0\n\n- One.\n\n## Before v0.1.0\n\nWords.\n\n### v0.1.0-alpha.1 - 2026-11-01\n<!-- commit: abc1234 -->\n- Early.\n`)
  assert.deepEqual(e.map((x) => [x.version, x.date]), [["v0.2.0", "2026-11-15"], ["v0.1.0", ""], ["v0.1.0-alpha.1", "2026-11-01"]])
  assert.equal(e[2].md, "- Early.")
  assert.ok(!e.some((x) => x.md.includes("Not yet")))
})

test("versions sort newest first, a pre-release below its release", () => {
  assert.deepEqual(["v0.1.0-alpha.2", "v0.10.0", "v0.1.0", "v0.9.1"].sort(compareVersions), ["v0.10.0", "v0.9.1", "v0.1.0", "v0.1.0-alpha.2"])
})

test("entries render escaped, with labels, nested bullets, and repository links at the tag", () => {
  const html = entryHtml("### Fixed\n- **Bold** `a<b>` and [the standard](docs/x.md)\n  wrapped on.\n  - nested\n", "neon1-chat", "v0.2.2")
  assert.match(html, /<p class="kc-rel-kind">Fixed<\/p>/)
  assert.match(html, /<strong>Bold<\/strong> <code>a&lt;b&gt;<\/code>/)
  assert.match(html, /href="https:\/\/github.com\/neon1llc\/neon1-chat\/blob\/v0.2.2\/docs\/x.md"/)
  assert.match(html, /wrapped on\.<ul><li>nested<\/li><\/ul>/)
})

// Dates come from the changelog, else the tag, else the next newer entry; products interleave by date
test("gather dates and orders releases across products", () => {
  const dir = mkdtempSync(join(tmpdir(), "rel-test-"))
  writeFileSync(join(dir, "neon1-site.md"), "## v0.2.0\n\n- Site two.\n\n## v0.1.1\n\n- Untagged.\n")
  writeFileSync(join(dir, "neon1-site.tags"), "v0.2.0 2026-11-14\n")
  writeFileSync(join(dir, "neon1-1NEON.md"), "## v0.3.0 - 2026-11-15\n\n- Portal.\n")
  const r = gather(dir)
  assert.deepEqual(r.all.map((x) => [x.repo, x.version, x.date, x.tagged]), [
    ["neon1-1NEON", "v0.3.0", "2026-11-15", false], ["neon1-site", "v0.2.0", "2026-11-14", true], ["neon1-site", "v0.1.1", "2026-11-14", false]])
  assert.deepEqual(r.current.map((c) => c.version), ["v0.2.0", "v0.3.0"])
  const body = releasesBody(r)
  // Version links carry no outbound arrow; an untagged version points at the changelog instead of a release
  assert.match(body, /class="kc-plain" href="https:\/\/github.com\/neon1llc\/neon1-site\/releases\/tag\/v0.2.0"/)
  assert.match(body, /neon1-site\/blob\/main\/CHANGELOG.md/)
})

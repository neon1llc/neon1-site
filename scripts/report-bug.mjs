#!/usr/bin/env node
// scripts/report-bug.mjs - Writes the report-a-bug page (/report-bug/) from the shared page shell, or checks it matches.
// Usage: node scripts/report-bug.mjs sync|check SITE_DIR   (make report-bug, and make report-bug-check)
//
// A page of its own, not part of the corpus: one form (js/report-bug.js) that posts to 1NEON's bug route, which
// mails hello@ and keeps screenshots in a private, malware-scanned bucket. The bar, menu, and footer come from
// index.html through the page shell, so the page follows the home page. Like the Knowledge Center and the blog, the
// folder is built by make content and never committed. It is left out of the sitemap and asks search engines to skip it.
//
// The ?from= values the page understands (the "Where?" options) are the keys in WHERE below; other pages link
// here with one of them, such as /report-bug/?from=neo, and js/report-bug.js has the same list for its prefill.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { homeFrame, page as page_, band, syncFolder } from "./page-shell.mjs"

const [mode, siteDir] = process.argv.slice(2)
if (!["sync", "check"].includes(mode) || !siteDir) {
  console.error("usage: node scripts/report-bug.mjs sync|check SITE_DIR")
  process.exit(2)
}

const frame = homeFrame(readFileSync(join(siteDir, "index.html"), "utf8"))

// Where the bug is: the value the API takes (1NEON's routes/bug.ts WHERE), and the words shown
const WHERE = [
  ["site", "Main site"],
  ["1neon", "1NEON"],
  ["demo", "1NEON demo"],
  ["neo", "Neo chat"],
  ["kc", "Knowledge Center"],
  ["blog", "Blog"],
  ["other", "Other"],
]

const main = `${band({
  id: "rb-h",
  eyebrow: "neon1",
  title: "Report a bug",
  lead: "Something broken? Tell me where and what happened.",
})}
    <section class="rb" aria-label="Report a bug form">
      <div class="rb-inner">
        <!-- Shown until js/report-bug.js runs; without it the form can't send, so the email link does the job -->
        <p class="rb-nojs" id="rb-nojs">This form needs JavaScript. Email <a class="ext" href="mailto:hello@neon1.tech?subject=Bug%20report"><span class="ext-end">hello@neon1.tech</span></a> instead.</p>
        <form class="rb-form" id="rb-form" novalidate hidden>
          <label><span>Where?<span class="req" aria-hidden="true">*</span></span><select name="where" required>
            <option value="">Pick one</option>
${WHERE.map(([v, t]) => `            <option value="${v}">${t}</option>`).join("\n")}
          </select></label>
          <label><span>What happened?<span class="req" aria-hidden="true">*</span></span><textarea name="what" rows="6" maxlength="3000" required placeholder="What did you do? What did you expect? What happened instead?"></textarea></label>
          <div class="rb-shots">
            <span class="rb-label" id="rb-shots-l">Screenshots <span class="opt">optional</span></span>
            <input class="rb-file" id="rb-file" name="shots" type="file" accept="image/png,image/jpeg" multiple aria-labelledby="rb-shots-l" aria-describedby="rb-shots-h" />
            <label class="btn btn-ghost rb-add" for="rb-file">Add screenshots</label>
            <p class="rb-help" id="rb-shots-h">PNG or JPEG, up to 3, 3 MB each. Hide anything private.</p>
            <ul class="rb-list" id="rb-list" aria-label="Screenshots to send"></ul>
          </div>
          <label><span>Email <span class="opt">optional</span></span><input name="email" type="email" autocomplete="email" maxlength="200" /><span class="rb-help">Only if you want a reply.</span></label>
          <!-- Hidden from people and screen readers; a bot that fills every field fills this one -->
          <div class="rb-hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off" /></label></div>
          <p class="rb-help" id="rb-sent">Sent with it: the page you came from, your theme, browser, and window size.</p>
          <div class="rb-actions"><button class="btn btn-primary" type="submit">Send report</button><p class="rb-status" id="rb-status" role="status"></p></div>
        </form>
        <div class="rb-done" id="rb-done" hidden tabindex="-1">
          <p><strong>Thanks.</strong> Your reference is <span class="rb-ref" id="rb-ref"></span>.</p>
          <p class="rb-help" id="rb-done-note">Quote it if you write to <a href="mailto:hello@neon1.tech">hello@neon1.tech</a>.</p>
          <button class="btn btn-ghost" type="button" id="rb-again">Report another</button>
        </div>
        <p class="rb-help rb-security">Found a security issue? <a class="ext" href="mailto:security@neon1.tech"><span class="ext-end">Email security@neon1.tech</span></a> instead.</p>
      </div>
    </section>`

const html = page_(frame, {
  title: "Report a bug · neon1",
  description: "Report a bug on neon1.tech, 1NEON, or Neo.",
  path: "/report-bug/",
  main,
  kind: "page",
  current: "",
  generator: "scripts/report-bug.mjs. Edit it, then run make report-bug",
  head: `\n  <meta name="robots" content="noindex" />`,
  styles: ["/css/knowledge.css", "/css/report-bug.css"],
  scripts: ["/js/report-bug.js"],
})

syncFolder({
  name: "report-bug", mode, siteDir, folder: "report-bug",
  want: new Map([["report-bug/index.html", html]]),
  hint: "run make report-bug to rewrite the report-a-bug page",
})

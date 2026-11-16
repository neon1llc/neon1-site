#!/usr/bin/env node
// scripts/feedback.mjs - Writes the feedback page (/feedback/) from the shared page shell, or checks it matches.
// Usage: node scripts/feedback.mjs sync|check SITE_DIR   (make feedback, and make feedback-check)
//
// The report-a-bug page's sibling, for comments, complaints, concerns, and suggestions: one form (js/feedback.js)
// that posts to 1NEON's feedback route, which mails neon1 with a reference. It has no screenshots. Its look is
// css/report-bug.css, the same fields and messages. Like the report page, the folder is built by make content and never
// committed, is left out of the sitemap, and asks search engines to skip it.
//
// The ?from= values (the "About?" options) are the keys in WHERE below, the same as the report page's.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { homeFrame, page as page_, band, syncFolder } from "./page-shell.mjs"

const [mode, siteDir] = process.argv.slice(2)
if (!["sync", "check"].includes(mode) || !siteDir) {
  console.error("usage: node scripts/feedback.mjs sync|check SITE_DIR")
  process.exit(2)
}

const frame = homeFrame(readFileSync(join(siteDir, "index.html"), "utf8"))

// What it is: the value the API takes (1NEON's routes/feedback.ts KIND), and the words shown
const KIND = [
  ["comment", "Comment"],
  ["complaint", "Complaint"],
  ["concern", "Concern"],
  ["suggestion", "Suggestion"],
]

// What it is about: the same places as the report page (1NEON's routes/bug.ts WHERE)
const WHERE = [
  ["site", "Main site"],
  ["1neon", "1NEON"],
  ["demo", "1NEON demo"],
  ["walkthrough", "1NEON live walkthrough"],
  ["neo", "Neo chat"],
  ["kc", "Knowledge Center"],
  ["blog", "Blog"],
  ["other", "Other"],
]

const main = `${band({
  id: "rb-h",
  eyebrow: "neon1",
  title: "Feedback",
  lead: "A comment, a complaint, or a concern? Tell me what's on your mind.",
})}
    <section class="rb" aria-label="Feedback form">
      <div class="rb-inner">
        <!-- Shown until js/feedback.js runs; without it the form can't send, so the email link does the job -->
        <p class="rb-nojs" id="rb-nojs">This form needs JavaScript. Email <a class="ext" href="mailto:hello@neon1.tech?subject=Feedback"><span class="ext-end">hello@neon1.tech</span></a> instead.</p>
        <form class="rb-form" id="rb-form" novalidate hidden>
          <label><span>What kind?<span class="req" aria-hidden="true">*</span></span><select name="kind" required>
            <option value="">Pick one</option>
${KIND.map(([v, t]) => `            <option value="${v}">${t}</option>`).join("\n")}
          </select></label>
          <label><span>About?<span class="req" aria-hidden="true">*</span></span><select name="where" required>
            <option value="">Pick one</option>
${WHERE.map(([v, t]) => `            <option value="${v}">${t}</option>`).join("\n")}
          </select></label>
          <label><span>What's on your mind?<span class="req" aria-hidden="true">*</span></span><textarea name="what" rows="6" maxlength="3000" required placeholder="What did you notice? What would you change, or what worries you?"></textarea></label>
          <label><span>Email <span class="opt">optional</span></span><input name="email" type="email" autocomplete="email" maxlength="200" /><span class="rb-help">Only if you want a reply.</span></label>
          <!-- Hidden from people and screen readers; a bot that fills every field fills this one -->
          <div class="rb-hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off" /></label></div>
          <p class="rb-help" id="rb-sent">Sent with it: the page you came from, your theme, browser, and window size.</p>
          <div class="rb-actions"><button class="btn btn-primary" type="submit">Send feedback</button><p class="rb-status" id="rb-status" role="status"></p></div>
        </form>
        <div class="rb-done" id="rb-done" hidden tabindex="-1">
          <p><strong>Thanks.</strong> Your reference is <span class="rb-ref" id="rb-ref"></span>.</p>
          <p class="rb-help" id="rb-done-note">Quote it if you write to <a href="mailto:hello@neon1.tech">hello@neon1.tech</a>.</p>
          <button class="btn btn-ghost" type="button" id="rb-again">Send more feedback</button>
        </div>
        <p class="rb-help rb-security">Something broken? <a class="ext" href="/report-bug/" target="_blank" rel="noopener"><span class="ext-end">Report a bug</span></a> instead.</p>
      </div>
    </section>`

const html = page_(frame, {
  title: "Feedback · neon1",
  description: "Send feedback on neon1.tech, 1NEON, or Neo.",
  path: "/feedback/",
  main,
  kind: "page",
  current: "",
  generator: "scripts/feedback.mjs. Edit it, then run make feedback",
  head: `\n  <meta name="robots" content="noindex" />`,
  styles: ["/css/knowledge.css", "/css/report-bug.css"],
  scripts: ["/js/feedback.js"],
})

syncFolder({
  name: "feedback", mode, siteDir, folder: "feedback",
  want: new Map([["feedback/index.html", html]]),
  hint: "run make feedback to rewrite the feedback page",
})

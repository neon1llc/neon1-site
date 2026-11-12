#!/usr/bin/env node
// scripts/blog.mjs - Writes the blog (/blog/) from neon1-corpus, or checks it matches.
// Usage: node scripts/blog.mjs sync|check SITE_DIR BLOG_EXPORT KNOWLEDGE_EXPORT   (make blog, and make blog-check)
//
// BLOG_EXPORT is the corpus's blog bundle (tools/export.mjs --target blog) from CORPUS_TAG, the newest corpus
// release unless the Makefile is told otherwise; KNOWLEDGE_EXPORT is its knowledge bundle, so a post's links to
// other corpus documents open their Knowledge Center pages. Every post becomes /blog/<slug>/index.html, newest
// first on /blog/index.html, with an RSS feed at /blog/feed.xml. Like the Knowledge Center, the folder is built by
// make content and never committed: sync rewrites it and the sitemap's blog block; check fails if anything differs.

import { readFileSync } from "node:fs"
import { join, posix } from "node:path"
import { load, slugOf, singleH1, classifyLinks, bindExtArrows, staticChecks, esc, longDate, SITE, CORPUS_BLOB } from "./knowledge-lib.mjs"
import { homeFrame, page as page_, ORG, WEBSITE, AUTHOR, LICENSE, OG_IMAGE, crumbs, band, card as cardOf, CORPUS_LINK, rights, dateFacts, docMain, shortBox, sitemapWith, syncFolder } from "./page-shell.mjs"


const [mode, siteDir, blogExport, knowledgeExport] = process.argv.slice(2)
if (!["sync", "check"].includes(mode) || !siteDir || !blogExport || !knowledgeExport) {
  console.error("usage: node scripts/blog.mjs sync|check SITE_DIR BLOG_EXPORT KNOWLEDGE_EXPORT")
  process.exit(2)
}

const BLOG = "/blog/"
const FEED = `${BLOG}feed.xml`
const frame = homeFrame(readFileSync(join(siteDir, "index.html"), "utf8"))


// ---- The posts ----

// The three kinds of post (neon1-corpus schema, post.topic), as a reader would name them
const TOPICS = {
  questions: "Local questions",
  "whats-and-whys": "Whats and whys",
  lessons: "From the repos",
}

// Posts newest first, each with its address; ties keep the corpus's order
const manifest = JSON.parse(readFileSync(join(blogExport, "manifest.json"), "utf8"))
const posts = manifest.files
  .map((entry) => JSON.parse(readFileSync(join(blogExport, entry.json), "utf8")))
  .filter((d) => d.type === "post")
  .map((d) => ({ ...d, slug: slugOf(d.id, "blog"), url: `${BLOG}${slugOf(d.id, "blog")}/` }))
  .sort((a, b) => b.data.created.localeCompare(a.data.created))
for (const p of posts) if (!TOPICS[p.data.topic]) {
  console.error(`blog: ${p.id} has topic "${p.data.topic}", which the blog doesn't label`)
  process.exit(1)
}

// Every page a post can link to: other posts, and the Knowledge Center's documents
const knowledge = load(knowledgeExport)
const bySource = new Map([...knowledge.docs.map((d) => [d.source, d]), ...posts.map((p) => [p.source, p])])
const byId = new Map([...knowledge.docs.map((d) => [d.id, d]), ...posts.map((p) => [p.id, p])])

// A post's relative links (../products/x.md) open that document's page here, or its source on GitHub
function relink(html, doc, { absolute = false } = {}) {
  const from = posix.dirname(doc.source)
  return html.replace(/href="([^"]+)"/g, (whole, href) => {
    if (/^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return whole
    const [path, hash] = href.split("#")
    const target = posix.normalize(posix.join(from, path))
    const found = bySource.get(target)
    const url = found ? (absolute ? SITE : "") + found.url : CORPUS_BLOB + target
    return `href="${url}${hash ? `#${hash}` : ""}"`
  })
}
const bodyOf = (p) => bindExtArrows(staticChecks(classifyLinks(relink(singleH1(p.html, p.title), p))))
// The short version's sentences, linked the same way as the text
const shortOf = (p) => (p.shortHtml ?? []).map((h) => bindExtArrows(classifyLinks(relink(h, p))))
// The same sentences as plain text, for structured data (a jump to one of the post's own sections is left out)
const plainText = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim()

// Minutes to read the text, Sources left out, at 230 words a minute, never under one
const WPM = 230
const minutesOf = (p) => {
  const words = p.sections.filter((s) => s.heading !== "Sources").map((s) => plainText(s.html)).join(" ").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WPM))
}


// ---- Structured data ----

// ORG, WEBSITE, AUTHOR, and crumbs come from page-shell.mjs, shared with the Knowledge Center
const BLOG_ID = { "@id": `${SITE}${BLOG}#blog` }
const posting = (p) => ({
  "@type": "BlogPosting",
  "@id": `${SITE}${p.url}#post`,
  url: `${SITE}${p.url}`,
  headline: p.title,
  description: p.summary,
  datePublished: p.data.created,
  dateModified: p.data.updated,
  author: AUTHOR,
  ...(p.shortHtml?.length ? { abstract: p.shortHtml.map((h) => plainText(h.replace(/\s*<a href="#[^"]*">[^<]*<\/a>\.?/g, ""))).join(" ") } : {}),
  timeRequired: `PT${minutesOf(p)}M`,
})


// ---- Pages ----

const feedLink = `\n  <link rel="alternate" type="application/rss+xml" title="neon1 blog" href="${FEED}" />`
const page = (opts) => page_(frame, {
  ...opts,
  current: "blog",
  generator: "scripts/blog.mjs from neon1-corpus. Edit the corpus, then run make blog",
  styles: ["/css/knowledge.css"],
  scripts: ["/js/knowledge-toc.js", "/js/blog-share.js"],
  head: feedLink,
})

// The facts under a post's title: who wrote it, when, how long it takes, what kind, and who it's for. Updated
// shows only once it has changed
const factsOf = (p) => [
  ["By", '<a href="/knowledge/company/about/">Pradeep Tathineni</a>', true],
  ...dateFacts(p.data.created, p.data.updated),
  ["Read", `${minutesOf(p)} min`],
  ["Topic", TOPICS[p.data.topic]],
  p.data.audience ? ["For", p.data.audience] : null,
].filter(Boolean)

// A post as a card on the index: its date and kind, title, and summary
const card = (p) => cardOf({
  url: p.url, title: p.title, summary: p.summary,
  kicker: `<time datetime="${p.data.created}">${longDate(p.data.created)}</time> · ${esc(TOPICS[p.data.topic])}`,
})

function indexPage() {
  const list = posts.length
    ? `      <ul class="kc-cards">
${posts.map(card).join("\n")}
      </ul>`
    : "      <p>The first post is on its way.</p>"
  const main = `${band({ id: "blog-title", eyebrow: "neon1 · blog", title: "Blog", lead: "Questions from local businesses answered in plain words, the whats and whys of how neon1 works, and lessons from building its open repositories. A new post about once a week." })}

    <div class="kc-body">
      <section class="kc-shelf" aria-labelledby="blog-posts-h">
        <div class="kc-shelf-head">
          <h2 id="blog-posts-h">Posts</h2>
          <p>Newest first. <a href="${FEED}">Follow with RSS</a>.</p>
        </div>
${list}
      </section>

      <p class="kc-colophon">Posts come from ${CORPUS_LINK} and are shared under CC BY-ND 4.0. They explain things in general terms and aren't legal advice.</p>
    </div>`
  return page({
    title: "Blog · neon1",
    description: "Posts from neon1: questions from local businesses answered in plain words, the whats and whys of neon1, and lessons from its open repositories.",
    path: BLOG,
    main,
    kind: "index",
    ld: [
      { "@type": "Blog", ...BLOG_ID, url: `${SITE}${BLOG}`, name: "neon1 blog", inLanguage: "en-US", isPartOf: WEBSITE, publisher: ORG, author: AUTHOR, blogPost: posts.map(posting) },
      crumbs([["Blog"]]),
    ],
  })
}

// Share: plain links to each service's own share page, so no outside script ever runs on neon1.tech (the CSP
// allows none) and nothing tracks the reader. Copy link and the device's own share sheet are buttons that
// js/blog-share.js reveals only where the browser supports them
const SHARES = [
  ["LinkedIn", (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
  ["X", (u, t) => `https://x.com/intent/post?text=${t}&url=${u}`],
  ["Facebook", (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`],
  ["Bluesky", (u, t) => `https://bsky.app/intent/compose?text=${t}%20${u}`],
  ["Threads", (u, t) => `https://www.threads.com/intent/post?text=${t}%20${u}`],
  ["Reddit", (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}`],
  ["WhatsApp", (u, t) => `https://wa.me/?text=${t}%20${u}`],
]
function shareOf(p) {
  const url = `${SITE}${p.url}`
  const [u, t] = [encodeURIComponent(url), encodeURIComponent(p.title)]
  const mail = `mailto:?subject=${t}&body=${encodeURIComponent(`${p.summary}\n\n${url}`)}`
  const links = SHARES.map(([name, href]) => `          <li><a href="${esc(href(u, t))}" target="_blank" rel="noopener">${name}</a></li>`)
  return `
      <aside class="kc-share" aria-labelledby="kc-share-h" data-url="${esc(url)}" data-title="${esc(p.title)}" data-text="${esc(p.summary)}">
        <h2 id="kc-share-h">Share this post</h2>
        <ul>
          <li hidden><button type="button" class="kc-share-copy">Copy link</button></li>
          <li hidden><button type="button" class="kc-share-native">Share&hellip;</button></li>
${links.join("\n")}
          <li><a href="${esc(mail)}">Email</a></li>
        </ul>
        <p class="kc-share-status" role="status"></p>
      </aside>`
}

function postPage(p) {
  const body = bodyOf(p)
  // Read next: the post's related documents, then the two newest other posts not already listed
  const related = (p.data.related ?? []).map((id) => byId.get(id)).filter(Boolean)
  const more = posts.filter((x) => x.id !== p.id && !related.some((r) => r.id === x.id)).slice(0, 2)
  const kicker = (d) => (d.type === "post" ? "Blog" : knowledge.manifest.shelves[d.section]?.label ?? "Knowledge center")
  const next = [...related, ...more].map((d) => ({ url: d.url, kicker: kicker(d), title: d.title }))
  const main = docMain({
    crumbs: [["Blog", BLOG], [TOPICS[p.data.topic]]],
    title: p.title, summary: p.summary, facts: factsOf(p), short: shortOf(p), sections: p.sections, body, after: shareOf(p), next,
    colophon: `${rights(p.source)} <a href="${FEED}">Follow with RSS</a>.`,
  })
  const ld = [
    {
      ...posting(p),
      mainEntityOfPage: `${SITE}${p.url}`,
      inLanguage: "en-US",
      publisher: ORG,
      isPartOf: BLOG_ID,
      license: LICENSE,
      image: OG_IMAGE,
      articleSection: TOPICS[p.data.topic],
      ...(p.data.audience ? { audience: { "@type": "Audience", audienceType: p.data.audience } } : {}),
    },
    crumbs([["Blog", `${SITE}${BLOG}`], [p.title]]),
  ]
  return page({ title: `${p.title} · neon1 blog`, description: p.summary, path: p.url, main, kind: "doc", ld })
}


// ---- The feed ----

// RSS 2.0, newest first, each item with its summary and the whole post. Dates are noon New York time on the day
// published, so readers in any US time zone see the same day
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const rfc822 = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`)
  return `${DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()} 12:00:00 -0500`
}
// The whole post with absolute links, since a feed reader shows it away from neon1.tech, led by its short
// version. A link to the post's own section points at the post on neon1.tech
const feedShort = (p) => shortBox((p.shortHtml ?? []).map((h) => classifyLinks(relink(h, p, { absolute: true })).replace(/href="#/g, `href="${SITE}${p.url}#`)))
const feedBody = (p) => (feedShort(p) + classifyLinks(relink(singleH1(p.html, p.title), p, { absolute: true }))).replace(/\]\]>/g, "]]&gt;")
function feed() {
  const latest = posts[0]?.data.created
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${FEED} - Generated by scripts/blog.mjs from neon1-corpus. Edit the corpus, then run make blog. -->
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>neon1 blog</title>
    <link>${SITE}${BLOG}</link>
    <atom:link href="${SITE}${FEED}" rel="self" type="application/rss+xml" />
    <description>Questions from local businesses answered in plain words, the whats and whys of neon1, and lessons from its open repositories.</description>
    <language>en-us</language>
    <copyright>© neon1 LLC. CC BY-ND 4.0.</copyright>${latest ? `
    <lastBuildDate>${rfc822(latest)}</lastBuildDate>` : ""}
${posts.map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${SITE}${p.url}</link>
      <guid isPermaLink="true">${SITE}${p.url}</guid>
      <pubDate>${rfc822(p.data.created)}</pubDate>
      <category>${xml(TOPICS[p.data.topic])}</category>
      <description>${xml(p.summary)}</description>
      <content:encoded><![CDATA[${feedBody(p)}]]></content:encoded>
    </item>`).join("\n")}
  </channel>
</rss>
`
}


// ---- Writing or checking ----

const want = new Map([["blog/index.html", indexPage()], ["blog/feed.xml", feed()]])
for (const p of posts) want.set(`${p.url.slice(1)}index.html`, postPage(p))

// The sitemap lists the blog between its <!-- blog --> markers, each post with its updated date
const sitemapFile = join(siteDir, "sitemap.xml")
const sitemapNow = readFileSync(sitemapFile, "utf8")
const lastmod = posts.map((p) => p.data.updated).sort().at(-1)
const sitemapWant = sitemapWith(sitemapNow, "blog", [[`${SITE}${BLOG}`, lastmod], ...posts.map((p) => [`${SITE}${p.url}`, p.data.updated])])

syncFolder({
  name: "blog", mode, siteDir, folder: "blog", want,
  extras: [{ file: sitemapFile, now: sitemapNow, want: sitemapWant, label: "sitemap.xml blog block" }],
  limit: (path) => (path.endsWith(".xml") ? Infinity : 120 * 1024),
  hint: "run make blog to rewrite the blog from the corpus",
})

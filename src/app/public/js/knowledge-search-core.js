// src/app/public/js/knowledge-search-core.js - The knowledge center's matching rules, with no page code, so the
// browser and the tests run the same thing. It reads search-index.json (built by scripts/knowledge.mjs).

// Words that mean the same thing to a reader. Each line is written the way normalize() leaves text, so
// "Wi-Fi" is "wi fi". A query that contains any variant matches a document that contains any other.
export const SYNONYMS = [
  ["passkey", "passkeys", "webauthn", "web authn"],
  ["authenticator", "authenticator app", "totp"],
  ["mfa", "2fa", "two factor", "multi factor", "multifactor", "two step"],
  ["wifi", "wi fi", "wireless"],
  ["phishing", "phish"],
  ["ransomware"],
  ["invoice", "invoices", "billing"],
  // Added 2026-11-15 from how the documents are worded (and how a reader would ask). Each variant is written the
  // way normalize() leaves text and is matched from a word start, so keep them specific: "fee" would also find
  // "feedback", and "phi" would find "phishing". A word may sit in only one group (a test checks)
  ["cost", "costs", "price", "prices", "pricing", "how much", "expensive", "affordable"],
  ["proposal", "proposals", "quote", "quotes", "estimate", "estimates", "statement of work"],
  ["backup", "backups", "back up", "back ups", "restore", "restores", "recover", "recovery"],
  ["hipaa", "baa", "business associate", "health information"],
  ["consultation", "book a call", "first call", "discovery call", "fit call", "free call"],
  ["privacy", "personal information", "personal data", "data policy"],
  ["cookie", "cookies", "tracker", "trackers", "tracking"],
  ["accessibility", "accessible", "wcag", "a11y", "screen reader"],
  ["incident", "incidents", "outage", "outages", "downtime", "breach"],
  ["handover", "hand over", "handoff", "hand off"],
  ["contract", "contracts", "agreement", "agreements"],
  ["network", "networks", "networking", "router", "routers"],
  ["aws", "amazon web services", "cloud"],
  ["1neon", "client portal", "portal"],
  ["vulnerability", "vulnerabilities", "security disclosure", "security issue", "report a problem"],
  ["training", "seminar", "seminars", "workshop", "workshops", "awareness session"],
  ["household", "family", "families"],
  ["open source", "foss"],
  ["pdf", "download", "printable"],
  ["hours", "availability", "available"],
  ["remote", "on site", "onsite", "in person"],
  ["soc 2", "soc2"],
]

// Words too common to narrow anything, unless the query holds nothing else (see parseQuery)
const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "is", "it", "my", "i", "do", "how", "what", "with"])

// Where a match counts most: the title, then a heading, then the summary, then the body. These are the BM25F
// field weights: a word in the title is worth as much as twenty in the body, before rarity and length are counted
export const WEIGHTS = { title: 20, heading: 6, summary: 4, body: 1 }
// BM25's two knobs: k1 says how fast repeats stop adding (a word 3 times is not 3 times as relevant), and b how
// much a long field is discounted against the average (a short title should not lose to a long page)
export const K1 = 1.2
export const LENGTH_B = { title: 0.3, heading: 0.3, summary: 0.5, body: 0.75 }
// Above the catalog's size, so every document a search counts is also listed (AS-10)
// The most repeats of a word one field can earn credit for, so a long page repeating a word doesn't outrank a
// title that says it once
export const TF_CAP = { title: 3, heading: 2, summary: 2, body: 5 }
export const MAX_RESULTS = 200

// Lowercase, drop apostrophes, and turn every other run of punctuation into one space
export function normalize(text) {
  return String(text ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

// A query word cut back to its root, so "pricing" finds "price" and "prices" (matching starts at a word start, so
// the root also finds longer forms). Only a plain ending of -ing, -ed, -es, or -s comes off, and never down to
// fewer than three letters or off a double s ("business", "access")
export function stem(word) {
  for (const end of ["ing", "ed", "es", "s"]) {
    if (word.endsWith(end) && word.length - end.length >= 3 && !(end === "s" && word.endsWith("ss"))) return word.slice(0, -end.length)
  }
  return word
}

// The query as clauses. Each clause is the set of normalized phrases that satisfy it: a synonym group, or one word
export function parseQuery(query) {
  let rest = ` ${normalize(query)} `
  const clauses = []
  for (const group of SYNONYMS) {
    // Longest variant first, so "two factor" is taken whole
    const hit = [...group].sort((a, b) => b.length - a.length).find((v) => rest.includes(` ${v} `))
    if (hit) {
      clauses.push({ phrases: group, label: hit })
      rest = rest.replace(` ${hit} `, " ")
    }
  }
  const words = rest.split(" ").filter(Boolean)
  for (const w of words.filter((w) => !STOP.has(w))) clauses.push({ phrases: [stem(w)], label: w })
  // A query made only of common words ("how", "what is") would otherwise match nothing, though titles such as
  // "How neon1 works" start with exactly those. Then the common words are the query
  if (!clauses.length) for (const w of words) clauses.push({ phrases: [stem(w)], label: w })
  return clauses
}

// A phrase starts at a word start, so "backup" finds "backups" and "wi fi" finds "Wi-Fi". Fields are kept
// padded with a space on each side so the first word counts too
const has = (haystack, phrase) => haystack.includes(` ${phrase}`)
const count = (haystack, phrase) => {
  let n = 0
  for (let at = haystack.indexOf(` ${phrase}`); at !== -1; at = haystack.indexOf(` ${phrase}`, at + 1)) n++
  return n
}
const words = (haystack) => haystack.trim().split(" ").filter(Boolean).length

// Normalizes each field once so a search is only string scans, and measures the catalog for BM25: how many
// documents there are and the average length of each field
export function prepare(index) {
  const entries = index.docs.map((d) => {
    const sections = d.k.map(([id, heading, text]) => ({ id, heading, h: ` ${normalize(heading)} `, b: ` ${normalize(text)} `, text }))
    const fields = {
      title: ` ${normalize(d.t)} `,
      heading: ` ${sections.map((s) => s.h.trim()).join(" ")} `,
      summary: ` ${normalize(`${d.s} ${d.sh} ${d.ty}`)} `,
      body: ` ${sections.map((s) => s.b.trim()).join(" ")} `,
    }
    const length = Object.fromEntries(Object.entries(fields).map(([f, text]) => [f, words(text)]))
    return { doc: d, fields, length, sections }
  })
  const avg = Object.fromEntries(Object.keys(WEIGHTS).map((f) => [f, Math.max(1, entries.reduce((n, e) => n + e.length[f], 0) / Math.max(1, entries.length))]))
  return { entries, avg, n: entries.length }
}

// The weighted, length-normalized count of a clause in one document (BM25F's pseudo term frequency): each
// field's count of the clause's phrases, discounted by how long that field is, times the field's weight
function weightedCount(entry, avg, clause) {
  let total = 0
  for (const f of Object.keys(WEIGHTS)) {
    let tf = 0
    for (const p of clause.phrases) tf += count(entry.fields[f], p)
    if (!tf) continue
    tf = Math.min(tf, TF_CAP[f])
    const norm = 1 - LENGTH_B[f] + LENGTH_B[f] * (entry.length[f] / avg[f])
    total += (WEIGHTS[f] * tf) / norm
  }
  return total
}

// The section where a clause counts most, for the link's anchor and the snippet
function bestSection(entry, clause) {
  let best = { id: "", weight: 0, text: "", heading: "" }
  for (const s of entry.sections) {
    let w = 0
    for (const p of clause.phrases) {
      if (s.heading && has(s.h, p)) w = Math.max(w, WEIGHTS.heading)
      const n = Math.min(count(s.b, p), 3)
      if (n) w += n * WEIGHTS.body
    }
    if (w > best.weight) best = { id: s.id, weight: w, text: s.text, heading: s.heading }
  }
  return best
}

// Documents for a query, best first, each with a similarity from 0 to 1. A clause's score is
// idf * tf / (k1 + tf): idf makes a rare word count for more than a common one, and tf / (k1 + tf) climbs
// toward 1 as the word's weighted count grows. The similarity is the document's clause scores over the most
// they could total (the sum of the idfs), so a query word found once in a title reads about .9 and in a body
// once about .45, and a document holding every word strongly approaches 1. The same query over the same
// documents always gives the same numbers. Every word must match; when nothing does, documents matching
// any word are returned and `relaxed` says so
export function search(prepared, query) {
  const clauses = parseQuery(query)
  if (!clauses.length) return { clauses, results: [], relaxed: false }
  const { entries, avg, n } = prepared
  // Counts per clause per document, then how many documents hold each clause (its rarity)
  const counts = entries.map((entry) => clauses.map((c) => weightedCount(entry, avg, c)))
  const idf = clauses.map((_, i) => {
    const df = counts.filter((row) => row[i] > 0).length
    return Math.log(1 + (n - df + 0.5) / (df + 0.5))
  })
  const ceiling = idf.reduce((a, b) => a + b, 0) || 1
  const scored = entries.map((entry, e) => {
    const per = counts[e].map((tf, i) => (tf > 0 ? (idf[i] * tf) / (K1 + tf) : 0))
    const total = per.reduce((a, b) => a + b, 0)
    return { entry, per, all: per.every((p) => p > 0), any: per.some((p) => p > 0), total, similarity: total / ceiling }
  })
  let hits = scored.filter((s) => s.all)
  let relaxed = false
  if (!hits.length) { hits = scored.filter((s) => s.any); relaxed = hits.length > 0 }
  hits.sort((a, b) => b.total - a.total || a.entry.doc.t.localeCompare(b.entry.doc.t))
  const results = hits.slice(0, MAX_RESULTS).map((h) => {
    // Link to the section where the most weight landed, with its anchor when it has a heading
    const top = clauses.map((c) => bestSection(h.entry, c)).reduce((a, b) => (b.weight > a.weight ? b : a))
    return {
      url: h.entry.doc.u + (top.id && top.weight ? `#${top.id}` : ""),
      title: h.entry.doc.t,
      shelf: h.entry.doc.sh,
      type: h.entry.doc.ty,
      score: h.total,
      similarity: Math.min(1, h.similarity),
      section: top.weight ? top.heading : "",
      snippet: snippet(top.weight ? top.text : h.entry.doc.s, clauses),
    }
  })
  return { clauses, results, relaxed, total: hits.length }
}

// Regex source for a phrase against raw text: "wi fi" finds "Wi-Fi", "WiFi", and "wi fi"
const rawPattern = (phrase) => `(?<![a-z0-9])${phrase.split(" ").join("[^a-z0-9]*")}`

// About 160 characters around the first match, as parts: { text, hit } so the page can mark hits without HTML
export function snippet(text, clauses, size = 160) {
  const re = new RegExp(clauses.flatMap((c) => c.phrases).map(rawPattern).join("|"), "gi")
  const first = re.exec(text)
  const start = first ? Math.max(0, first.index - 50) : 0
  let from = start
  // Begin at a word boundary so the snippet doesn't open mid-word
  if (from > 0) { const sp = text.indexOf(" ", from); if (sp !== -1 && sp < first.index) from = sp + 1 }
  const piece = text.slice(from, from + size)
  const parts = []
  let last = 0
  const again = new RegExp(re.source, "gi")
  for (let m = again.exec(piece); m; m = again.exec(piece)) {
    if (!m[0]) { again.lastIndex++; continue }
    // Hit extends over the rest of the word, so "backup" marks "backups"
    const end = m.index + m[0].length + (/^[a-z0-9]*/i.exec(piece.slice(m.index + m[0].length))?.[0].length ?? 0)
    if (m.index > last) parts.push({ text: piece.slice(last, m.index), hit: false })
    parts.push({ text: piece.slice(m.index, end), hit: true })
    last = end
    again.lastIndex = end
  }
  if (last < piece.length) parts.push({ text: piece.slice(last), hit: false })
  if (from > 0) parts.unshift({ text: "… ", hit: false })
  if (from + size < text.length) parts.push({ text: " …", hit: false })
  return parts
}

// src/app/public/js/knowledge.js - The knowledge center's search. It fetches one local index file on first use and
// lists matching documents with a snippet and a link to the section. Nothing leaves the browser. Without JavaScript
// the box stays hidden and the page lists every document.
import { prepare, search } from "./knowledge-search-core.js";

const box = document.querySelector(".kc-search");
const input = document.getElementById("kc-q");
const status = document.getElementById("kc-results");
const found = document.getElementById("kc-found");
const list = document.getElementById("kc-found-list");
const none = document.getElementById("kc-none");
const browse = document.getElementById("kc-browse");

if (box && input && status && found && list && none && browse) {
  box.hidden = false;
  // The index is fetched once, on the first focus or keystroke
  let prepared = null;
  let loading = null;
  const load = () => {
    loading ??= fetch("/knowledge/search-index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((index) => { prepared = prepare(index); })
      // A failed fetch (offline for a moment) isn't kept: the next keystroke or Enter tries again (AS-10)
      .catch((err) => { loading = null; throw err; });
    return loading;
  };

  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  // Marks come from text nodes, so nothing from the index is ever parsed as HTML
  function resultItem(r) {
    const item = make("li", "kc-hit");
    const link = make("a");
    link.href = r.url;
    link.append(make("span", "kc-card-title", r.title));
    link.append(make("span", "kc-hit-where", r.section ? `${r.shelf} · ${r.section}` : `${r.shelf} · ${r.type}`));
    const p = make("span", "kc-card-summary");
    for (const part of r.snippet) {
      if (part.hit) p.append(make("mark", "", part.text));
      else p.append(document.createTextNode(part.text));
    }
    link.append(p);
    item.append(link);
    return item;
  }

  let token = 0;
  async function run() {
    const q = input.value.trim();
    const mine = ++token;
    if (!q) return clearUrl(), show(null); // Backspace to empty, the native clear, and Escape all end the same
    try { await load(); } catch {
      status.textContent = "Search couldn't load. The full list below still works.";
      return show(null, true);
    }
    if (mine !== token) return;
    show(search(prepared, q), false, q);
  }

  // Swaps the catalog for results while there is a query; the count is announced through the status region
  function show(res, failed = false, q = "") {
    const active = Boolean(res);
    browse.hidden = active;
    found.hidden = !active || !res.results.length;
    none.hidden = !active || res.results.length > 0;
    list.replaceChildren(...(active ? res.results.map(resultItem) : []));
    if (!active) { if (!failed) status.textContent = ""; return; }
    const n = res.results.length;
    status.textContent = n
      ? `${res.total} ${res.total === 1 ? "document" : "documents"}${res.relaxed ? ` match some of your words` : ""}`
      : `No documents match "${q}"`;
    try {
      const url = new URL(location.href);
      url.searchParams.set("q", q);
      history.replaceState(null, "", url);
    } catch { /* the address bar is a convenience only */ }
  }

  input.addEventListener("input", run);
  input.addEventListener("focus", () => { load().catch(() => {}); }, { once: true });
  // The form has no other job, so Enter just searches
  box.addEventListener("submit", (e) => { e.preventDefault(); run(); });

  // Suggested terms in the empty state run a search in place
  for (const a of none.querySelectorAll("[data-term]")) {
    a.addEventListener("click", (e) => { e.preventDefault(); input.value = a.dataset.term; input.focus(); run(); });
  }

  function clearUrl() {
    try { const url = new URL(location.href); url.searchParams.delete("q"); history.replaceState(null, "", url); } catch { /* as above */ }
  }
  function clear() {
    input.value = "";
    run();
  }

  // From the box, the arrow keys step through the results, and Escape clears the search
  addEventListener("keydown", (e) => {
    // Ctrl+K (Cmd+K on a Mac) jumps to the search box. A bare "/" did, but a single-character shortcut
    // catches speech input and other character keys (WCAG 2.1.4, AS-05); Tab still reaches the box
    if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) { e.preventDefault(); input.focus(); input.select(); return; }
    if (e.key === "Escape" && document.activeElement === input && input.value) { clear(); return; }
    const links = [...list.querySelectorAll("a")];
    const at = links.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && links.length && (document.activeElement === input || at !== -1)) {
      e.preventDefault();
      links[Math.min(at + 1, links.length - 1)].focus();
    } else if (e.key === "ArrowUp" && at !== -1) {
      e.preventDefault();
      (at === 0 ? input : links[at - 1]).focus();
    }
  });

  // A ?q= link opens with the search filled in
  const q = new URLSearchParams(location.search).get("q");
  if (q) { input.value = q; run(); }
}

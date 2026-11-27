// src/app/public/js/knowledge-groups.js - The Knowledge Center's "On this page" bar. It names the section being read, with its group
// ("2 of 11 · FOR YOU / Alternatives"), and once it reaches the site's bar it eases out from its inset rounded box to a square bar edge to
// edge, as the document pages' index does. The bar's link for the shelf in view takes aria-current, and the list scrolls to keep that link
// in sight. Everything reads the page's own layout, so a search that hides groups or cards needs nothing here.

import { rings, segments, trackSections } from "/shared/page-index.js";

const bar = document.querySelector(".kc-shelves");

if (bar) {
  const fold = bar.querySelector("details");
  const label = fold && fold.querySelector("summary span");
  const resting = label ? label.textContent : "";
  const links = [...bar.querySelectorAll("a[href^='#']:not([data-group])")];
  const groupLinks = [...bar.querySelectorAll("a[data-group]")].map((a) => ({ a, el: document.getElementById(a.getAttribute("href").slice(1)) })).filter((g) => g.el);
  const shelves = links.map((a) => ({ a, el: document.getElementById(a.getAttribute("href").slice(1)) })).filter((s) => s.el);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let queued = false;

  // Where the bar's foot sits once it is stuck under the site's bar (its own top, plus its height)
  const stickAt = () => (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight;
  const groupOf = (el) => {
    const h = el.closest(".kc-group")?.querySelector(".kc-group-head h2");
    return h && h.firstChild ? h.firstChild.textContent.trim() : "";
  };

  const update = () => {
    queued = false;
    // Stuck once it has reached its place under the site's bar
    const top = parseFloat(getComputedStyle(bar).top) || 0;
    bar.classList.toggle("is-stuck", bar.getBoundingClientRect().top <= top + 1);
    // The shelf in view: the last whose top is above the line just under the bar
    const line = stickAt() + 80;
    let current = null;
    for (const s of shelves) if (!s.el.hidden && s.el.getBoundingClientRect().top <= line) current = s;
    for (const s of shelves) {
      const on = s === current;
      if (on) s.a.setAttribute("aria-current", "true"); else s.a.removeAttribute("aria-current");
    }
    // The bar names the shelf in view and its group, as the document pages' index names its section
    if (label) {
      if (!current) label.textContent = resting;
      else {
        const g = groupOf(current.el);
        const name = current.a.firstChild.textContent.trim();
        label.replaceChildren(`${shelves.indexOf(current) + 1} of ${shelves.length} · `, ...(g ? [Object.assign(document.createElement("b"), { textContent: g }), " / "] : []), name);
      }
    }
    // The open list at the side of a wide screen marks the same shelf
    const side = document.querySelector(".kc-index-side");
    if (side) for (const a of side.querySelectorAll("a[href^='#']")) {
      const on = current && a.getAttribute("href") === current.a.getAttribute("href");
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    }
    // Keep the marked link in sight inside the open list
    const active = bar.querySelector("a[aria-current]");
    const list = bar.querySelector("ul");
    if (active && fold.open && list.scrollHeight > list.clientHeight) {
      const r = active.getBoundingClientRect(), l = list.getBoundingClientRect();
      if (r.top < l.top || r.bottom > l.bottom) list.scrollTop += r.top - l.top - l.height / 2;
    }
  };
  // A shelf link lands the shelf's title a title-to-description gap under the bar
  const land = (el, smooth) => {
    // A group lands its band, a shelf its title
    const title = el.querySelector(".kc-group-head") || el.querySelector(".kc-shelf-head h3");
    if (!title) return false;
    const t = title.getBoundingClientRect();
    const gap = el.classList.contains("kc-group") ? 0 : 14;
    scrollTo({ top: Math.max(0, Math.round(t.top + scrollY - stickAt() - gap)), behavior: smooth && !reduce.matches ? "smooth" : "auto" });
    return true;
  };
  const go = (el) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (fold) fold.open = false;
    if (land(el, true)) { e.preventDefault(); history.pushState(null, "", `#${el.id}`); }
  };
  for (const s of [...shelves, ...groupLinks]) s.a.addEventListener("click", go(s.el));
  // The open list at the side of a wide screen lands the same way
  for (const a of document.querySelectorAll(".kc-index-side a[href^='#']")) {
    const el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) a.addEventListener("click", go(el));
  }
  // How far each shelf is read, drawn as on the document pages (shared/page-index.js): under the stuck bar, and beside the side list
  const sideList = document.querySelector(".kc-index-side");
  const line = fold && segments(shelves.length, "kc-toc-line"), mini = rings();
  fold?.querySelector("summary").append(line.el);
  sideList?.append(mini.el);
  const sideItems = shelves.map((s) => sideList?.querySelector(`a[href="${s.a.getAttribute("href")}"]`));
  sideItems.forEach((a) => a?.classList.add("kc-part"));
  if (shelves.length > 2) trackSections(shelves.map((s) => s.el), ({ parts, current, done }) => {
    line?.fill(parts);
    sideItems.forEach((a, i) => a?.style.setProperty("--p", parts[i].toFixed(3)));
    mini.light(done, current >= 0);
  }, { end: document.querySelector(".kc-body") ?? shelves.at(-1).el, top: stickAt, line: (edge) => edge + 80 });
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  // Outside a tap, or Escape, shuts the list
  // (the theme switch is the exception, so the list stays open as the page changes theme, as on the document pages)
  document.addEventListener("click", (e) => { if (fold && fold.open && !bar.contains(e.target) && !e.target.closest(".theme-sw")) fold.open = false; });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && fold && fold.open) { fold.open = false; fold.querySelector("summary").focus(); } });
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  if (document.fonts) document.fonts.ready.then(queue);
  update();
  // Arriving on a shelf's address lands it the same way
  const hash = location.hash.slice(1), arrived = hash && shelves.find((s) => s.el.id === hash);
  if (arrived) requestAnimationFrame(() => land(arrived.el, false));
}


// A long shelf on a phone opens to all its cards from its "All" button (scripts/knowledge.mjs, css/knowledge.css)
const alls = [...document.querySelectorAll(".kc-all")];
if (alls.length) {
  document.documentElement.classList.add("kc-js");
  for (const b of alls) {
    b.hidden = false;
    b.addEventListener("click", () => {
      const shelf = b.closest(".kc-shelf");
      const open = !shelf.classList.contains("open");
      shelf.classList.toggle("open", open);
      b.setAttribute("aria-expanded", String(open));
      b.textContent = open ? "Fewer" : b.dataset.label || b.textContent;
    });
    b.dataset.label = b.textContent;
  }
}

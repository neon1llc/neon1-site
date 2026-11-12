// src/app/public/js/knowledge-toc.js - "On this page" for a Knowledge Center document. It marks the section being
// read in both indexes, and on narrower screens docks the folded index under the top bar once the reader scrolls
// past it, widening it into a bar of its own. Without JavaScript both indexes are plain lists of links.

const side = document.querySelector(".kc-toc-side");
const fold = document.querySelector(".kc-toc-fold");
const bar = document.querySelector(".n1-bar");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");

// ---- Which section is being read ----
const links = [...document.querySelectorAll(".kc-toc a[href^='#']")];
const ids = [...new Set(links.map((a) => decodeURIComponent(a.hash.slice(1))))];
const heads = ids.map((id) => document.getElementById(id)).filter(Boolean);
const label = fold?.querySelector("summary span");
const count = label?.textContent ?? "";

// The bottom edge everything is measured from: the top bar, plus the docked index when it's showing
const topEdge = () => (bar?.getBoundingClientRect().bottom ?? 0) + (fold?.classList.contains("docked") ? fold.offsetHeight : 0);

let current = "";
function mark() {
  if (!heads.length) return;
  const line = topEdge() + Math.min(180, innerHeight * 0.3);
  // The last heading above the reading line; none before the first section, and the last one at the very bottom
  let id = "";
  for (const h of heads) if (h.getBoundingClientRect().top <= line) id = h.id;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) id = heads[heads.length - 1].id;
  if (id === current) return;
  current = id;
  for (const a of links) {
    const on = decodeURIComponent(a.hash.slice(1)) === id;
    a.classList.toggle("is-current", on);
    if (on) a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
  }
  // The docked bar names the section; the resting fold keeps its count
  if (label) {
    const head = heads.find((h) => h.id === id);
    label.textContent = fold.classList.contains("docked") && head ? `${heads.indexOf(head) + 1} of ${heads.length} · ${head.textContent.trim()}` : count;
  }
  // Keep the marked entry visible inside a side index taller than the screen
  const active = side?.querySelector("a.is-current");
  if (active && side.scrollHeight > side.clientHeight) {
    const r = active.getBoundingClientRect(), s = side.getBoundingClientRect();
    if (r.top < s.top || r.bottom > s.bottom) side.scrollTop += r.top - s.top - s.height / 2;
  }
}

// ---- Docking the folded index (narrow screens, where it's shown) ----
// One spacer holds the fold's place while it's docked, so the text doesn't jump when it leaves the flow. Docking
// starts the bar at the fold's own size and position, then eases it out to the full width. Undocking puts it back
// in the page the moment its place comes back under the top bar, still full width, and eases it to its resting
// size there, so scrolling on up never shows a gap where the bar was. A scroll back down mid-ease docks it again.
const spacer = document.createElement("div");
spacer.className = "kc-toc-spacer";
let docked = false;
let settling = 0; // the timer that ends an undock's easing back

function stopSettling() {
  clearTimeout(settling);
  settling = 0;
  fold.classList.remove("settling", "bleed");
}

function dock() {
  stopSettling();
  const r = fold.getBoundingClientRect();
  spacer.style.height = `${fold.offsetHeight}px`;
  fold.before(spacer);
  fold.classList.add("docked");
  fold.style.setProperty("--dock-top", `${bar?.getBoundingClientRect().bottom ?? 0}px`);
  fold.style.setProperty("--from-left", `${r.left}px`);
  fold.style.setProperty("--from-right", `${innerWidth - r.right}px`);
  current = ""; // the docked bar names the section, so mark() rewrites its label
  if (reduce.matches) return fold.classList.add("wide");
  fold.getBoundingClientRect(); // start from the resting size before easing out
  requestAnimationFrame(() => fold.classList.add("wide"));
}

function undock() {
  fold.open = false;
  // Rejoin the page at once, in the spacer's place
  const r = spacer.getBoundingClientRect();
  fold.classList.remove("docked", "wide");
  spacer.remove();
  current = "";
  mark();
  if (reduce.matches) return;
  // Then ease from the bar's full width to the resting size, in place: negative margins reach the screen's edges
  fold.style.setProperty("--bleed-l", `${-r.left}px`);
  fold.style.setProperty("--bleed-r", `${r.right - document.documentElement.clientWidth}px`);
  fold.classList.add("settling", "bleed");
  fold.getBoundingClientRect(); // start from full width before easing back
  requestAnimationFrame(() => fold.classList.remove("bleed"));
  settling = setTimeout(stopSettling, 400);
}

function place() {
  if (!fold) return;
  const shown = getComputedStyle(fold).display !== "none";
  const edge = bar?.getBoundingClientRect().bottom ?? 0;
  // While the fold is docked, its place in the page is the spacer's
  const top = (spacer.isConnected ? spacer : fold).getBoundingClientRect().top;
  if (!docked) {
    if (shown && top <= edge) { docked = true; dock(); }
  } else if (!shown || top > edge) {
    docked = false;
    undock();
  }
}

// ---- Wiring ----
if (heads.length) {
  let queued = false;
  const update = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; place(); mark(); });
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  // Choosing a section from the docked bar closes it
  fold?.addEventListener("click", (e) => { if (e.target.closest("a") && fold.classList.contains("docked")) fold.open = false; });
  update();
}

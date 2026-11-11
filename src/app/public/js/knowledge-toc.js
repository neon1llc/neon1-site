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
// A spacer holds the fold's place so the text doesn't jump when it leaves the flow. Docking starts the bar at the
// fold's own size and position, then eases it out to the full width; undocking eases it back before it rejoins.
let spacer = null;
let docked = false;
let settle = 0;

function dock() {
  const r = fold.getBoundingClientRect();
  spacer = document.createElement("div");
  spacer.className = "kc-toc-spacer";
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
  const done = () => {
    clearTimeout(settle);
    fold.classList.remove("docked", "wide", "leaving");
    spacer?.remove();
    spacer = null;
    current = "";
    mark();
  };
  fold.open = false;
  if (reduce.matches) return done();
  // Ease back to the resting size over the spot it came from, then rejoin the page
  const r = spacer.getBoundingClientRect();
  fold.style.setProperty("--from-left", `${r.left}px`);
  fold.style.setProperty("--from-right", `${innerWidth - r.right}px`);
  fold.classList.add("leaving");
  fold.classList.remove("wide");
  fold.addEventListener("transitionend", done, { once: true });
  settle = setTimeout(done, 400);
}

function place() {
  if (!fold) return;
  const shown = getComputedStyle(fold).display !== "none";
  const edge = bar?.getBoundingClientRect().bottom ?? 0;
  if (!docked) {
    if (shown && fold.getBoundingClientRect().top <= edge) { docked = true; dock(); }
  } else if (!shown || (spacer && spacer.getBoundingClientRect().top > edge)) {
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

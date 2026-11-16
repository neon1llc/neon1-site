// src/app/public/js/knowledge-groups.js - The Knowledge Center's "On this page" bar. It names the section being read, with its group
// ("2 of 11 · FOR YOU / Alternatives"), and once it reaches the site's bar it eases out from its inset rounded box to a square bar edge to
// edge, as the document pages' index does. The bar's link for the shelf in view takes aria-current, and the list scrolls to keep that link
// in sight. Everything reads the page's own layout, so a search that hides groups or cards needs nothing here.

const bar = document.querySelector(".kc-shelves");

if (bar) {
  const fold = bar.querySelector("details");
  const label = fold && fold.querySelector("summary span");
  const resting = label ? label.textContent : "";
  const links = [...bar.querySelectorAll("a[href^='#']")];
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
    const title = el.querySelector(".kc-shelf-head h3");
    if (!title) return false;
    const t = title.getBoundingClientRect();
    const gap = 14;
    scrollTo({ top: Math.max(0, Math.round(t.top + scrollY - stickAt() - gap)), behavior: smooth && !reduce.matches ? "smooth" : "auto" });
    return true;
  };
  for (const s of shelves) s.a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (fold) fold.open = false;
    if (land(s.el, true)) { e.preventDefault(); history.pushState(null, "", `#${s.el.id}`); }
  });
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  // Outside a tap, or Escape, shuts the list
  document.addEventListener("click", (e) => { if (fold && fold.open && !bar.contains(e.target)) fold.open = false; });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && fold && fold.open) { fold.open = false; fold.querySelector("summary").focus(); } });
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  if (document.fonts) document.fonts.ready.then(queue);
  update();
  // Arriving on a shelf's address lands it the same way
  const hash = location.hash.slice(1), arrived = hash && shelves.find((s) => s.el.id === hash);
  if (arrived) requestAnimationFrame(() => land(arrived.el, false));
}

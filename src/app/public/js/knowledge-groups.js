// src/app/public/js/knowledge-groups.js - The Knowledge Center's two groups ("For you", "About neon1") keep their heading in sight
// while you read through them, and the shelf bar says which shelf you are in.
//
// A group's heading sticks under the shelf bar. Once it sticks, its description eases away from the bottom up, leaving
// only the title and count, so it costs little of a small screen. Near the group's end it fades: it starts when the
// heading's bottom edge reaches the top of the group's last card, and is gone when it reaches that card's bottom, so the next group's
// heading arrives on a clean page. The shelf bar's link for the shelf in view takes aria-current, and the bar scrolls to keep
// that link in sight. Everything reads the page's own layout, so a search that hides groups or cards needs nothing here.

const heads = [...document.querySelectorAll(".kc-group")].map((group) => ({
  group,
  head: group.querySelector(".kc-group-head"),
  desc: group.querySelector(".kc-group-desc"),
})).filter((g) => g.head && g.desc);
const subs = [...document.querySelectorAll(".kc-shelf")].map((shelf) => ({
  shelf,
  head: shelf.querySelector(".kc-shelf-head"),
  desc: shelf.querySelector(".kc-shelf-desc"),
})).filter((s) => s.head && s.desc);
const bar = document.querySelector(".kc-shelves");

if (heads.length && bar) {
  const root = document.documentElement;
  const fold = bar.querySelector("details");
  const label = fold && fold.querySelector("summary span");
  const resting = label ? label.textContent : "";
  const links = [...bar.querySelectorAll("a[href^='#']")];
  const shelves = links.map((a) => ({ a, el: document.getElementById(a.getAttribute("href").slice(1)) })).filter((s) => s.el);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let queued = false;

  // Where the shelf bar's foot sits once it is stuck under the site's bar (its own top, plus its height)
  const stickAt = () => (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight;
  // The sticky headings sit just under it, wherever the shelf bar's height ends up
  const measure = () => {
    root.style.setProperty("--kc-stick", `${Math.round(stickAt())}px`);
    // The room a heading gives up when it shrinks (its description, its gap, and the padding it tightens), handed to the shelf below
    // as top padding, so the page under it never moves
    for (const g of heads) g.group.style.setProperty("--kc-give", `${Math.round(g.desc.scrollHeight) + 6 + 14}px`);
    // A shelf heading sticks right under a stuck group heading, whose stuck height is its title plus its tightened padding and borders
    const first = heads[0], h2 = first.head.querySelector("h2");
    root.style.setProperty("--kc-stick2", `${Math.round(stickAt() + h2.offsetHeight + 24)}px`);
    for (const sh of subs) sh.shelf.style.setProperty("--kc-give2", `${Math.round(sh.desc.firstElementChild.scrollHeight) + 14}px`);
  };

  const update = () => {
    queued = false;
    const stick = stickAt();
    // Stuck heading and the fade at the end of its block (last visible card top to bottom); a group's heading and a shelf's work alike
    const fadeHead = (block, head, at) => {
      if (block.hidden) return;
      head.classList.toggle("is-stuck", head.getBoundingClientRect().top <= at + 1);
      const cards = [...block.querySelectorAll(".kc-card:not([hidden])")].filter((c) => c.offsetParent);
      const last = cards[cards.length - 1];
      let fade = 0;
      if (last) {
        const r = last.getBoundingClientRect(), bottom = head.getBoundingClientRect().bottom;
        fade = Math.min(1, Math.max(0, (bottom - r.top) / Math.max(1, r.height)));
      }
      head.style.opacity = fade ? String(1 - fade) : "";
      head.style.pointerEvents = fade > 0.9 ? "none" : "";
    };
    for (const { group, head } of heads) fadeHead(group, head, stick);
    const stick2 = parseFloat(getComputedStyle(root).getPropertyValue("--kc-stick2")) || stick;
    for (const { shelf, head } of subs) fadeHead(shelf, head, stick2);
    // The shelf in view: the last whose top is above the line just under the stuck heading
    const line = stick + 80;
    let current = null;
    for (const s of shelves) if (!s.el.hidden && s.el.getBoundingClientRect().top <= line) current = s;
    for (const s of shelves) {
      const on = s === current;
      if (on) s.a.setAttribute("aria-current", "true"); else s.a.removeAttribute("aria-current");
    }
    // The stuck bar names the shelf in view, as the document pages' index names its section
    if (label) label.textContent = current ? `${shelves.indexOf(current) + 1} of ${shelves.length} \u00b7 ${current.a.firstChild.textContent.trim()}` : resting;
  };
  // A shelf link lands the shelf's title so the gap under the stuck group heading equals the gap between the title and its description
  const land = (el, smooth) => {
    const title = el.querySelector(".kc-shelf-head h3");
    if (!title) return false;
    const t = title.getBoundingClientRect();
    // The title's gap to its description (its bottom margin), kept above it too
    const gap = 14;
    const stick2 = parseFloat(getComputedStyle(root).getPropertyValue("--kc-stick2")) || stickAt();
    scrollTo({ top: Math.max(0, Math.round(t.top + scrollY - stick2 - gap)), behavior: smooth && !reduce.matches ? "smooth" : "auto" });
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
  addEventListener("resize", () => { measure(); queue(); });
  if (window.ResizeObserver) new ResizeObserver(() => { measure(); queue(); }).observe(bar);
  if (document.fonts) document.fonts.ready.then(() => { measure(); queue(); });
  measure();
  update();
  // Arriving on a shelf's address lands it the same way
  const hash = location.hash.slice(1), arrived = hash && shelves.find((s) => s.el.id === hash);
  if (arrived) requestAnimationFrame(() => land(arrived.el, false));
}

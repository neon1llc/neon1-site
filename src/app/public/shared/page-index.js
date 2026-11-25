// shared/page-index.js - The section index of a long page, the visual form of "On this page": where you are, how far through
// each section, and a way to any other. neon1.tech's landing, Knowledge Center, and blog use it, and so do 1NEON's long documents.
//
// pageIndex() adds a rail at the right edge (one stroke per section over 1NEON's four rings), which css in shared/neon1.css turns
// into one thin segmented line under the bar on narrow and touch screens. A page that already lists its sections keeps its own list
// and takes only the parts: trackSections() for the numbers, and rings() and segments() to draw them.
// Positions come from the page as drawn, so it works whether the window, the body, or a panel is what scrolls.

const make = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.append(n); return n; };
const clamp = (n) => Math.max(0, Math.min(1, n));


/** 1NEON's four rings; light(done, started) lights them from the center out as the page goes by */
export function rings() {
  const box = make("template");
  box.innerHTML = '<svg class="pi-rings" viewBox="0 0 64 64" aria-hidden="true">' + [2, 10, 19, 28].map((r) => `<circle cx="32" cy="32" r="${r}"/>`).join("") + "</svg>";
  const svg = box.content.firstChild, all = [...svg.children];
  return { el: svg, light: (done, started) => all.forEach((c, i) => c.classList.toggle("lit", started && (i === 0 || done >= i / 3.2))) };
}


/** One thin line in as many parts as there are sections; fill(parts) sets how far each is read */
export function segments(count, cls = "") {
  // Divs, so a page's own styles for the spans beside the line don't reach into it
  const line = make("div", `pi-line ${cls}`.trim());
  line.setAttribute("aria-hidden", "true");
  const fills = Array.from({ length: count }, () => make("i", "", make("div", "", line)));
  return { el: line, fill: (parts) => fills.forEach((f, i) => f.style.setProperty("--p", (parts[i] ?? 0).toFixed(3))) };
}


/**
 * Calls draw({ parts, current, done }) now and as the page moves. A section is read as it passes a line a third of the way down
 * what the bar leaves; at the very end of the scroll everything counts as read. end is the element whose bottom closes the last section
 */
export function trackSections(heads, draw, { end = heads.at(-1), top = () => 64, line: at } = {}) {
  let queued = false, gone = false;
  const atEnd = () => [document.scrollingElement, document.body].some((s) => s && s.scrollTop > 0 && s.scrollTop + s.clientHeight >= s.scrollHeight - 2);
  const measure = () => {
    queued = false;
    if (gone) return;
    const edge = top(), line = at ? at(edge) : edge + (innerHeight - edge) / 3;
    const tops = heads.map((h) => h.getBoundingClientRect().top);
    const last = end.getBoundingClientRect().bottom, bottom = atEnd();
    const parts = tops.map((t, i) => (bottom ? 1 : clamp((line - t) / Math.max(1, (tops[i + 1] ?? last) - t))));
    let current = -1;
    tops.forEach((t, i) => { if (t <= line) current = i; });
    if (bottom) current = heads.length - 1;
    draw({ parts, current, done: current < 0 ? 0 : clamp((current + parts[current]) / heads.length) });
  };
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(measure); } };
  // Capture hears the body or a panel scrolling too, since their scroll events don't bubble
  document.addEventListener("scroll", ask, { capture: true, passive: true });
  addEventListener("resize", ask);
  addEventListener("load", ask);
  const watch = window.ResizeObserver && new ResizeObserver(ask);
  watch?.observe(document.body);
  measure();
  return () => {
    gone = true;
    document.removeEventListener("scroll", ask, { capture: true });
    removeEventListener("resize", ask);
    removeEventListener("load", ask);
    watch?.disconnect();
  };
}


/**
 * The rail. items are { el, name, href }: with an href each entry is an ordinary link; without one it is a button that brings its
 * section into view. min is the fewest sections worth an index, and screens the shortest page, in screen heights.
 * Returns a function that removes it
 */
export function pageIndex(items, { end, top, label = "On this page", min = 3, screens = 0, parent = document.body } = {}) {
  if (items.length < min) return () => {};
  const nav = make("nav", "pi-rail");
  nav.setAttribute("aria-label", label);
  const list = make("ol", "", nav);
  const marks = items.map(({ el, name, href }) => {
    const a = make(href ? "a" : "button", "pi-link", make("li", "", list));
    if (href) a.href = href;
    else {
      a.type = "button";
      a.addEventListener("click", () => el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    }
    make("span", "pi-name", a).textContent = name;
    return { a, fill: make("i", "", make("span", "pi-stroke", a)) };
  });
  const mark = rings();
  nav.append(mark.el);
  parent.append(nav);
  const heads = items.map((i) => i.el), foot = end ?? heads.at(-1);
  const stop = trackSections(heads, ({ parts, current, done }) => {
    marks.forEach(({ a, fill }, i) => {
      fill.style.setProperty("--p", parts[i].toFixed(3));
      if (i === current) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    mark.light(done, current >= 0);
    // The bar's foot, where the narrow screen's line sits
    if (top) nav.style.setProperty("--pi-top", `${Math.round(top())}px`);
    const long = foot.getBoundingClientRect().bottom - heads[0].getBoundingClientRect().top >= innerHeight * screens;
    nav.classList.toggle("on", current >= 0 && long);
  }, { end: foot, top });
  return () => { stop(); nav.remove(); };
}

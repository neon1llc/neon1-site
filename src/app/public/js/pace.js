// src/app/public/js/pace.js - The landing's section index: where you are, how far through it, and a way to any other section.
//
// Wide screens get a rail at the right edge, one stroke per section, with 1NEON's four rings lighting from the center as the
// page goes by. Narrow screens get the same strokes as one thin segmented line under the bar. Its links are ordinary #section
// links, so js/views.js glides to them and Back returns. Without this script the page is whole.

(() => {
  "use strict";
  const views = [...document.querySelectorAll("main .view")];
  if (!views.length) return;
  const NAMES = { services: "services", projects: "client work", why: "about", process: "process", work: "code", faq: "questions", contact: "contact" };
  const el = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.append(n); return n; };

  const nav = el("nav", "pace-rail");
  nav.setAttribute("aria-label", "On this page");
  const list = el("ol", "", nav);
  const items = views.map((v) => {
    const a = el("a", "", el("li", "", list));
    a.href = "#" + v.id;
    el("span", "pace-name", a).textContent = NAMES[v.id] || v.id;
    return { v, a, fill: el("i", "", el("span", "pace-stroke", a)) };
  });
  nav.insertAdjacentHTML("beforeend", '<svg class="pace-rings" viewBox="0 0 64 64" aria-hidden="true">' +
    [2, 10, 19, 28].map((r) => `<circle cx="32" cy="32" r="${r}"/>`).join("") + "</svg>");
  const rings = [...nav.querySelectorAll("circle")];
  document.body.append(nav);

  let queued = false;
  function draw() {
    queued = false;
    // A section is read as its top passes a line a third of the way down; the last one fills as the page reaches its end
    const line = scrollY + innerHeight / 3, max = document.documentElement.scrollHeight - innerHeight;
    const tops = views.map((v) => v.getBoundingClientRect().top + scrollY);
    let current = -1;
    items.forEach((it, i) => {
      const end = i + 1 < views.length ? tops[i + 1] : tops[i] + it.v.offsetHeight;
      let p = Math.max(0, Math.min(1, (line - tops[i]) / Math.max(1, end - tops[i])));
      if (i === items.length - 1 && scrollY >= max - 2) p = 1;
      it.fill.style.setProperty("--p", p.toFixed(3));
      if (line >= tops[i]) current = i;
    });
    items.forEach((it, i) => (i === current ? it.a.setAttribute("aria-current", "location") : it.a.removeAttribute("aria-current")));
    const done = Math.max(0, Math.min(1, scrollY / Math.max(1, max)));
    rings.forEach((c, i) => c.classList.toggle("lit", current >= 0 && (i === 0 || done >= i / 3.2)));
    nav.classList.toggle("on", current >= 0);
  }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
  addEventListener("scroll", ask, { passive: true });
  addEventListener("resize", ask);
  addEventListener("load", ask);
  if (window.ResizeObserver) new ResizeObserver(ask).observe(document.body);
  draw();
})();

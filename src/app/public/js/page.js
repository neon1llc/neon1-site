// src/app/public/js/page.js - The landing's assistant and the style-specific effects.

const header = document.querySelector("header");
// Sentinel's first screen is everything above the second section (the first view): the style switch shows through all of it
const onFirstScreen = () => {
  const next = document.querySelector(".view");
  return next ? scrollY < next.getBoundingClientRect().top + scrollY - 64 - 2 : scrollY < innerHeight * 0.6;
};
window.n1FirstScreen = onFirstScreen;
const rabbitIn = document.getElementById("whiteRabbitIn");
let matrixStart, matrixReady = false;

// Sentinel stays still; choosing Matrix loads its effects once, without navigating away
function showStyle() {
  if (document.documentElement.dataset.siteStyle === "sentinel") {
    if (rabbitIn) rabbitIn.hidden = true;
    document.body.classList.add("woke");
    header.classList.add("light");
    header.toggleAttribute("data-top", onFirstScreen());
    return;
  }
  // The keyboard way in appears once the rabbit is wired (white-rabbit.js shows it), so Enter on it always catches one;
  // coming back to Matrix after a stay in Sentinel, the rabbit is already wired and the way in returns at once
  if (rabbitIn && matrixReady) rabbitIn.hidden = false;
  matrixStart ||= import("/js/matrix-effects.js").then(({ start }) => start()).then(() => { matrixReady = true; }).catch(() => {
    matrixStart = null;
    if (rabbitIn) rabbitIn.hidden = true;
  });
}

addEventListener("scroll", () => {
  if (document.documentElement.dataset.siteStyle === "sentinel") header.toggleAttribute("data-top", onFirstScreen());
}, { passive: true });
document.addEventListener("n1:theme", showStyle);
showStyle();

// The assistant remains available in both families and follows the current mode
const lightPage = () => header?.classList.contains("light") && document.documentElement.dataset.siteTheme !== "matrix";
import("/shared/chat.js").then(({ chat }) => {
  chat({ light: lightPage, watch: [header] });
  document.addEventListener("n1:theme", () => dispatchEvent(new Event("scroll")));
}).catch(() => { /* chat unavailable; contact links remain */ });

// The section in view is marked in the bar and the menu: the view crossing the screen's middle line. The first screen marks none
const sectionLinks = [...document.querySelectorAll('.links a[href^="#"], .menu a[href^="#"]')];
const sections = [...new Set(sectionLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean))];
if (sections.length && "IntersectionObserver" in window) {
  const inView = new Set();
  const mark = () => {
    const current = sections.find((s) => inView.has(s));
    for (const a of sectionLinks) {
      if (current && a.getAttribute("href") === "#" + current.id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
  };
  const watch = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? inView.add(e.target) : inView.delete(e.target);
    mark();
  }, { rootMargin: "-50% 0px -50% 0px" });
  sections.forEach((s) => watch.observe(s));
}

// ---- The address follows the section the page rests on ----
// Once the page stops moving, #section is written into the address (the first screen clears it), so the view can be copied or reloaded
// as it is. It replaces the current history entry and never adds one, so Back and Forward still step between the places the visitor
// went on purpose (a link, a case card), each entry keeping its own remembered spot. Nothing is written while the page is still landing
// on a linked section or a remembered spot, over a case card or the chat, or while the hash already names the section in view
{
  const started = performance.now();
  let hands = false, timer = 0;
  for (const ev of ["pointerdown", "wheel", "touchstart", "keydown"]) addEventListener(ev, () => { hands = true; }, { capture: true, passive: true, once: true });
  const views = () => [document.querySelector(".hero"), ...document.querySelectorAll(".view")].filter(Boolean);
  const inView = () => {
    const list = views(), max = document.documentElement.scrollHeight - innerHeight;
    let current = list[0];
    for (const v of list.slice(1)) if (Math.min(Math.round(v.getBoundingClientRect().top + scrollY - 64), max) <= scrollY + 2) current = v;
    return current;
  };
  const write = () => {
    if (!hands && performance.now() - started < 4000) return;
    if (history.state?.card || document.body.classList.contains("case-open") || document.body.classList.contains("n1chat-open") || document.body.classList.contains("white-rabbit-on")) return;
    const v = inView(), want = v.classList.contains("hero") ? "" : v.id;
    if (!v.classList.contains("hero") && !want) return;
    const named = decodeURIComponent(location.hash.slice(1)).split("?")[0], el = named && document.getElementById(named);
    const at = el && el.closest ? (el.closest(".view") || el.closest(".hero")) : null;
    if (at === v || (!want && !named)) return;
    history.replaceState(history.state, "", location.pathname + location.search + (want ? "#" + want : ""));
  };
  addEventListener("scroll", () => { clearTimeout(timer); timer = setTimeout(write, 250); }, { passive: true });
}

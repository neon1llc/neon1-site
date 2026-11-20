// src/app/public/js/page.js - The landing's assistant and the style-specific effects.

const header = document.querySelector("header");
const rabbitIn = document.getElementById("whiteRabbitIn");
let matrixStart, matrixReady = false;

// Sentinel stays still; choosing Matrix loads its effects once, without navigating away
function showStyle() {
  if (document.documentElement.dataset.siteStyle === "sentinel") {
    if (rabbitIn) rabbitIn.hidden = true;
    document.body.classList.add("woke");
    header.classList.add("light");
    header.toggleAttribute("data-top", scrollY < innerHeight * 0.6);
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
  if (document.documentElement.dataset.siteStyle === "sentinel") header.toggleAttribute("data-top", scrollY < innerHeight * 0.6);
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

// src/app/public/js/page.js - The landing's assistant and the style-specific effects.

const header = document.querySelector("header");
let matrixStart;

// Sentinel stays still; choosing Matrix loads its effects once, without navigating away
function showStyle() {
  if (document.documentElement.dataset.siteStyle === "sentinel") {
    document.body.classList.add("woke");
    header.classList.add("light");
    header.toggleAttribute("data-top", scrollY < innerHeight * 0.6);
    return;
  }
  matrixStart ||= import("/js/matrix-effects.js").then(({ start }) => start()).catch(() => { matrixStart = null; });
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

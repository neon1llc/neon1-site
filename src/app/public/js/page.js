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

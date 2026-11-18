// src/app/public/js/page.js - The landing's assistant and the style-specific effects.

const header = document.querySelector("header");
const rabbitIn = document.getElementById("whiteRabbitIn");
let matrixStart;

// Sentinel stays still; choosing Matrix loads its effects once, without navigating away
function showStyle() {
  if (document.documentElement.dataset.siteStyle === "sentinel") {
    if (rabbitIn) rabbitIn.hidden = true;
    document.body.classList.add("woke");
    header.classList.add("light");
    header.toggleAttribute("data-top", scrollY < innerHeight * 0.6);
    return;
  }
  // Expose keyboard entry before the lazily loaded Matrix module is ready
  if (rabbitIn) rabbitIn.hidden = false;
  matrixStart ||= import("/js/matrix-effects.js").then(({ start }) => start()).catch(() => {
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

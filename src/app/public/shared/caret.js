// shared/caret.js - Draws the Matrix look's green caret in text fields that do not have focus.
//
// A focused field uses the browser's own caret, colored by shared/neon1.css (caret-color). An unfocused one gets a drawn caret
// after its text (or at its start when empty), on one layer of the page (it scrolls with the document, so scrolling never lags) so a framework's markup is never touched. Only one blinks:
// the focused field's real caret, or else the first empty required field in view; the rest hold steady and dim. Sentinel draws nothing.

(() => {
  const root = document.documentElement;
  const NOT_TEXT = new Set(["checkbox", "radio", "file", "range", "color", "submit", "button", "reset", "image", "hidden"]);
  const carets = new Map(); // field -> its drawn caret
  const marks = new WeakMap(); // field -> what its caret was last placed from
  let layer = null, mirror = null, queued = 0;

  // Text fields only: inputs that take typed text, and textareas
  const isText = (el) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !NOT_TEXT.has(el.type));
  const matrix = () => root.dataset.siteStyle !== "sentinel" && root.dataset.style !== "sentinel";

  // The layer holding every drawn caret; created once, and kept out of the page's own structure
  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement("div");
    layer.className = "n1-carets";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    return layer;
  }

  // A hidden copy of the field's text box, so the end of its text can be measured the way the field itself lays it out
  const MIRRORED = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "letterSpacing", "wordSpacing", "textTransform", "textAlign",
    "tabSize", "lineHeight", "direction", "wordBreak", "overflowWrap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];
  function measure(field, cs) {
    if (!mirror || !mirror.isConnected) {
      mirror = document.createElement("div");
      mirror.setAttribute("aria-hidden", "true");
      mirror.className = "n1-caret-mirror";
      document.body.appendChild(mirror);
    }
    const multi = field instanceof HTMLTextAreaElement;
    for (const key of MIRRORED) mirror.style[key] = cs[key];
    // An empty field shows its placeholder, with the caret just before it: the mirror holds the placeholder with the field's own indent,
    // and the caret goes at the line's start (the marker, less the indent), wherever the text is aligned. A field with text puts the
    // caret at the end of it, and the mirror leaves the indent out, since typed text is not shifted
    const holder = !field.value && field.placeholder;
    const indent = holder ? parseFloat(cs.textIndent) || 0 : 0;
    mirror.style.textIndent = indent + "px";
    mirror.style.boxSizing = "border-box";
    mirror.style.width = boxWidth(field, cs) + "px";
    mirror.style.whiteSpace = multi ? "pre-wrap" : "pre";
    mirror.textContent = "";
    const mark = document.createElement("span");
    mark.textContent = "\u200b";
    if (holder) { mirror.appendChild(mark); mirror.appendChild(document.createTextNode(field.placeholder)); }
    else { mirror.appendChild(document.createTextNode(field.value)); mirror.appendChild(mark); }
    return { x: mark.offsetLeft - indent, y: mark.offsetTop, h: mark.offsetHeight };
  }

  // The padding box's width, left of the scrollbar. An input's clientWidth leaves its padding out, so this is worked from the box instead
  function boxWidth(field, cs) {
    if (field instanceof HTMLTextAreaElement) return field.clientWidth;
    return field.getBoundingClientRect().width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  }

  // Whether a field can show a caret at all: in the page, shown, enabled, and editable
  function usable(field) {
    if (!field.isConnected || field.disabled || field.readOnly) return false;
    if (typeof field.checkVisibility === "function") return field.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const r = field.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // Place one caret, or hide it. The caret sits in the layer's own space, so the page's scroll carries it. Returns true when it shows.
  // A field whose box, text, and scroll are unchanged since the last pass is not measured again
  function place(field, el, focused, origin, full) {
    const hide = () => { el.hidden = true; marks.delete(field); return false; };
    if (!usable(field) || field === focused) return hide();
    const r = field.getBoundingClientRect();
    const sig = [r.left - origin.left, r.top - origin.top, r.width, r.height, field.value, field.scrollTop, field.placeholder].join("|");
    if (!full && marks.get(field) === sig && !el.hidden) return true;
    const cs = getComputedStyle(field);
    const m = measure(field, cs);
    const multi = field instanceof HTMLTextAreaElement;
    const edgeL = r.left + parseFloat(cs.borderLeftWidth), edgeT = r.top + parseFloat(cs.borderTopWidth);
    const left = edgeL + m.x;
    const room = edgeL + boxWidth(field, cs) - parseFloat(cs.paddingRight);
    // A line of text longer than the field is shown scrolled to its start, so the end of it is out of sight
    if (!multi && left > room) return hide();
    const padTop = parseFloat(cs.paddingTop), padBottom = parseFloat(cs.paddingBottom);
    const inner = r.height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
    const top = multi ? edgeT + m.y - field.scrollTop : edgeT + padTop + (inner - padTop - padBottom - m.h) / 2;
    if (multi && (top < edgeT || top + m.h > edgeT + field.clientHeight + 1)) return hide();
    // Something laid over the field's text (a panel, a dialog) covers the caret too; the sticky bar sits above the layer already
    if (full && r.top >= 0 && r.bottom <= innerHeight) {
      const hit = document.elementFromPoint(left + 1, top + m.h / 2);
      if (hit !== field && !(hit && field.contains(hit))) return hide();
    }
    el.hidden = false;
    el.style.setProperty("--x", left - origin.left + "px");
    el.style.setProperty("--y", top - origin.top + "px");
    el.style.setProperty("--h", m.h + "px");
    marks.set(field, sig);
    return true;
  }

  // The blink goes to the first empty required field in view, only while nothing has focus
  function pick() {
    let blinker = null;
    if (!isText(document.activeElement)) for (const [field, el] of carets) {
      if (blinker || el.hidden || field.value || !(field.required || field.getAttribute("aria-required") === "true")) continue;
      const r = field.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) blinker = el;
    }
    for (const el of carets.values()) el.classList.toggle("live", el === blinker);
  }

  // One pass: track every text field, draw the carets, and give the blink to a single one
  function update(full = true) {
    queued = 0;
    if (!document.body) return;
    if (!matrix()) { if (layer) layer.hidden = true; return; }
    ensureLayer().hidden = false;
    const fields = [...document.querySelectorAll("input, textarea")].filter(isText);
    for (const [field, el] of carets) if (!fields.includes(field)) { el.remove(); carets.delete(field); marks.delete(field); }
    for (const field of fields) if (!carets.has(field)) {
      const el = document.createElement("i");
      el.className = "n1-caret";
      layer.appendChild(el);
      carets.set(field, el);
    }
    const origin = layer.getBoundingClientRect();
    const active = document.activeElement;
    const focused = isText(active) ? active : null;
    for (const field of fields) place(field, carets.get(field), focused, origin, full);
    pick();
  }

  // Passes are coalesced to one per frame, however many events ask. The page's own scroll needs none, since the layer scrolls with it:
  // only the blink's pick is redone once scrolling pauses, and a scrolling box inside the page gets a pass that skips what has not moved
  let settle = 0, calm = 0;
  function refresh() { if (!queued) queued = requestAnimationFrame(() => update(true)); }
  function light() { if (!queued) queued = requestAnimationFrame(() => update(false)); }
  function scrolled(e) {
    if (e.target === document || e.target === root || e.target === document.body) { clearTimeout(settle); settle = setTimeout(pick, 120); }
    else light();
  }
  // A keyboard opening or the address bar moving resizes the window in bursts; one pass follows the last
  function resized() { clearTimeout(calm); calm = setTimeout(refresh, 150); }

  document.addEventListener("input", light, true);
  document.addEventListener("focusin", refresh, true);
  document.addEventListener("focusout", () => setTimeout(refresh), true);
  document.addEventListener("transitionend", light, true);
  document.addEventListener("animationend", light, true);
  document.addEventListener("scroll", scrolled, { capture: true, passive: true });
  document.addEventListener("reset", () => setTimeout(refresh), true);
  document.addEventListener("n1:theme", refresh);
  document.addEventListener("visibilitychange", refresh);
  addEventListener("resize", resized);
  addEventListener("pageshow", refresh);

  // Fields that appear, go, or change their look (a framework renders after load), and moves nothing announces
  function watch() {
    // The layer and the measuring copy change on every pass, so changes inside them never ask for another
    const own = (node) => (layer && layer.contains(node)) || (mirror && mirror.contains(node));
    new MutationObserver((records) => { if (records.some((r) => !own(r.target))) refresh(); }).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ["data-site-style", "data-style", "data-site-theme", "data-theme", "class"] });
    setInterval(light, 1000);
    refresh();
  }
  if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
})();

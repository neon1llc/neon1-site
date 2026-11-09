// scripts/chat_check.cjs - Browser checks for the shared chat window (src/app/public/shared/chat.js).
// Usage: node scripts/chat_check.cjs   (set CHAT_REPO=/path/to/neon1-chat to check every request
//        against the API's own contract module instead of the copy below)
//
// Runs headless Chromium against a local static server. The chat API is a stub inside the test:
// replies are held, released, failed, or left to time out on cue. Nothing reaches neon1.tech or
// any live API. Covers both pages that load the window: the site's home page, and a stand-in
// for 1NEON that mounts it the way the portal does (bottom right, light look).

const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../src/app/public");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ico": "image/x-icon" };

// ---- The conversation contract (neon1-chat app/src/contract.mjs), or the API's own copy ----

const LIMITS = { turns: 11, chars: 1200, total: 6000 };
function mirror(body) {
  const m = body?.messages;
  if (!Array.isArray(m) || !m.length || m.length % 2 === 0 || m.length > LIMITS.turns) return false;
  let total = 0;
  for (const [i, t] of m.entries()) {
    if (t?.role !== (i % 2 ? "assistant" : "user") || typeof t.content !== "string") return false;
    const c = t.content.trim();
    if (!c || c.length > LIMITS.chars) return false;
    total += c.length;
  }
  return total <= LIMITS.total;
}
let valid = mirror;

// ---- A static server for the site's files; /chat/api/* is answered by the stub in each page ----

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end("not found");
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// The portal's way of mounting the window, on a bare page with the shared styles
const PORTAL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>portal stand-in</title>
<link rel="stylesheet" href="/shared/neon1.css"><link rel="stylesheet" href="/shared/chat.css">
<style>:root{--glass-r:10px}body{margin:0;min-height:100vh;background:#f2f4f2}</style></head>
<body><div id="root"><main><h1>Projects</h1></main></div>
<script type="module">
import { chat } from "/shared/chat.js";
window.widget = chat({ className: "n1chat-portal n1chat-right", light: () => !document.querySelector(".signin"), watch: [document.getElementById("root")] });
window.ready = true;
</script></body></html>`;

// ---- The stub API: every request waits until the test answers it ----

function stub(page) {
  const requests = [];
  page.route("**/chat/api/chat", (route) => {
    const body = JSON.parse(route.request().postData() ?? "null");
    requests.push({ body, route, valid: valid(body) });
  });
  const reply = (r, data, status = 200, headers = {}) => r.route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) }).catch(() => {});
  const next = async (n) => {
    for (let i = 0; i < 400 && requests.length < n; i++) await page.waitForTimeout(10);
    assert.ok(requests.length >= n, `expected request ${n}`);
    return requests[n - 1];
  };
  return { requests, reply, next };
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`FAIL ${name}\n     ${err.message.split("\n")[0]}`);
  }
}

// ---- Helpers that drive the window like a visitor ----

const sel = { launch: ".n1chat-launch", panel: ".n1chat", input: ".n1chat-input", send: ".n1chat-send", log: ".n1chat-log", fresh: "button[aria-label='Start a new conversation']", close: "button[aria-label='Close']" };
async function ask(page, text) {
  await page.fill(sel.input, text);
  await page.click(sel.send);
}
// Set the box past its maxlength, as a paste through script could
async function force(page, text) {
  await page.$eval(sel.input, (el, t) => (el.value = t), text);
  await page.$eval(".n1chat-form", (f) => f.requestSubmit());
}
const logText = (page) => page.textContent(sel.log);
const sendDisabled = (page) => page.$eval(sel.send, (b) => b.disabled);
const state = (page) =>
  page.evaluate(() => {
    const p = document.querySelector(".n1chat"), l = document.querySelector(".n1chat-launch");
    return { panelHidden: p.hidden, launcherHidden: l.classList.contains("n1chat-hidden"), expanded: l.getAttribute("aria-expanded"), fold: p.classList.contains("n1chat-fold"), focusLauncher: document.activeElement === l };
  });
const usableClosed = (s) => s.panelHidden && !s.launcherHidden && s.expanded === "false" && !s.fold;

async function portal(browser, opts = {}) {
  const ctx = await browser.newContext({ reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (opts.clock) await page.clock.install();
  await page.route("**/portal.html", (r) => r.fulfill({ contentType: "text/html", body: PORTAL }));
  const api = stub(page);
  await page.goto(`${base}/portal.html`);
  await page.waitForFunction(() => window.ready);
  return { ctx, page, api, errors };
}
const open = async (page) => {
  await page.click(sel.launch);
  await page.waitForSelector(`${sel.panel}:not([hidden])`);
};

let base;
(async () => {
  if (process.env.CHAT_REPO) {
    const { check: contract } = await import(path.resolve(process.env.CHAT_REPO, "app/src/contract.mjs"));
    valid = (body) => !!contract(body).messages;
    console.log("checking requests against the API's contract module");
  }
  const server = await serve();
  base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  // ---- SITE-02: one request owner; "new" cancels it, and nothing stale lands afterwards ----

  for (const late of ["answer", "error", "network failure"]) {
    await check(`a ${late} for a cancelled question never reaches the new conversation`, async () => {
      const { ctx, page, api } = await portal(browser);
      await open(page);
      await ask(page, "First synthetic question");
      const first = await api.next(1);
      await page.click(sel.fresh);
      assert.equal(await sendDisabled(page), false, "send is usable right after new");
      if (late === "answer") await api.reply(first, { reply: "Late synthetic answer" });
      if (late === "error") await api.reply(first, { error: "Late synthetic error", code: "unavailable" }, 502);
      if (late === "network failure") await first.route.abort().catch(() => {});
      await page.waitForTimeout(50);
      await ask(page, "Second synthetic question");
      const second = await api.next(2);
      assert.deepEqual(second.body.messages, [{ role: "user", content: "Second synthetic question" }]);
      assert.ok(second.valid);
      await api.reply(second, { reply: "Second synthetic answer" });
      await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("Second synthetic answer"));
      const text = await logText(page);
      assert.ok(!/Late synthetic|First synthetic|No connection/.test(text), text);
      await ctx.close();
    });
  }

  await check("a question that never gets an answer times out with Send usable and the question back in the box", async () => {
    const { ctx, page, api } = await portal(browser, { clock: true });
    await open(page);
    await ask(page, "Hanging synthetic question");
    await api.next(1);
    assert.equal(await sendDisabled(page), true);
    await page.clock.runFor(25000);
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("taking too long"));
    assert.equal(await sendDisabled(page), false);
    assert.equal(await page.inputValue(sel.input), "Hanging synthetic question");
    // The retry is a valid first turn
    await page.click(sel.send);
    const retry = await api.next(2);
    assert.deepEqual(retry.body.messages, [{ role: "user", content: "Hanging synthetic question" }]);
    await ctx.close();
  });

  await check("an old question's deadline can't cancel or drop a newer one after new", async () => {
    const { ctx, page, api } = await portal(browser, { clock: true });
    await open(page);
    await ask(page, "Old synthetic question");
    const old = await api.next(1);
    await page.clock.runFor(20000);
    await page.click(sel.fresh);
    await ask(page, "Newer synthetic question");
    const newer = await api.next(2);
    // Past the old question's 25 seconds, inside the newer one's
    await page.clock.runFor(6000);
    assert.equal(await sendDisabled(page), true, "the newer question still owns Send");
    assert.ok(!(await logText(page)).includes("taking too long"));
    await api.reply(old, { reply: "Old synthetic answer" });
    await api.reply(newer, { reply: "Newer synthetic answer" });
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("Newer synthetic answer"));
    assert.ok(!(await logText(page)).includes("Old synthetic answer"));
    assert.equal(await sendDisabled(page), false);
    await ask(page, "Follow-up");
    const follow = await api.next(3);
    assert.deepEqual(follow.body.messages.map((m) => m.role), ["user", "assistant", "user"]);
    assert.equal(follow.body.messages[0].content, "Newer synthetic question");
    await ctx.close();
  });

  // ---- SITE-03: the history always fits the contract, and refusals are told apart ----

  await check("a 1,300-character reply doesn't make the next question invalid", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    await ask(page, "Question");
    await api.reply(await api.next(1), { reply: `${"This is a sentence. ".repeat(65)}`.trim() });
    await page.waitForTimeout(50);
    await ask(page, "Next");
    const second = await api.next(2);
    assert.ok(second.valid, JSON.stringify(second.body.messages.map((m) => m.content.length)));
    assert.ok(second.body.messages[1].content.length <= 1200);
    assert.equal(second.body.messages.at(-1).content, "Next");
    await ctx.close();
  });

  await check("seven turns of 1,000 characters are trimmed by whole pairs, keeping the newest question", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    for (let i = 0; i < 4; i++) {
      await ask(page, `${i}`.repeat(1000));
      const r = await api.next(i + 1);
      assert.ok(r.valid, `request ${i + 1}`);
      if (i < 3) {
        await api.reply(r, { reply: `${String.fromCharCode(65 + i)}`.repeat(1000) });
        await page.waitForFunction((n) => document.querySelectorAll(".n1chat-bot").length >= n, i + 2);
      }
    }
    const last = api.requests[3].body.messages;
    assert.equal(last.length, 5);
    assert.equal(last.reduce((n, m) => n + m.content.length, 0), 5000);
    assert.equal(last[0].content, "1".repeat(1000), "the oldest pair went first");
    assert.equal(last.at(-1).content, "3".repeat(1000));
    await ctx.close();
  });

  await check("6,000 characters exactly go up whole; one more drops the oldest pair", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    // Two answered pairs of 1,200 + 1,200, then a 1,200-character question: exactly 6,000
    for (let i = 0; i < 2; i++) {
      await ask(page, `q${i}`.padEnd(1200, "x"));
      await api.reply(await api.next(i + 1), { reply: `a${i}`.padEnd(1200, "y") });
      await page.waitForFunction((n) => document.querySelectorAll(".n1chat-bot").length >= n, i + 2);
    }
    await ask(page, "q2".padEnd(1200, "x"));
    const exact = await api.next(3);
    assert.equal(exact.body.messages.length, 5);
    assert.equal(exact.body.messages.reduce((n, m) => n + m.content.length, 0), 6000);
    await api.reply(exact, { reply: "Short." });
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("Short."));
    // A further question makes 7,206 in seven turns: the oldest pair goes, leaving 4,806
    await ask(page, "q3".padEnd(1200, "x"));
    const over = await api.next(4);
    assert.ok(over.valid);
    assert.equal(over.body.messages[0].content.slice(0, 2), "q1");
    assert.equal(over.body.messages.reduce((n, m) => n + m.content.length, 0), 1200 + 1200 + 1200 + 6 + 1200);
    await ctx.close();
  });

  await check("1,200 characters go up, 1,201 are refused before sending, emoji count two", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    assert.equal(await page.getAttribute(sel.input, "maxlength"), "1200");
    await force(page, "z".repeat(1201));
    await page.waitForTimeout(50);
    assert.equal(api.requests.length, 0, "nothing sent");
    assert.match(await logText(page), /keep your question under 1,200 characters/);
    assert.equal(await page.inputValue(sel.input), "z".repeat(1201), "the text stays to be shortened");
    await force(page, "\u{1F600}".repeat(600));
    const emoji = await api.next(1);
    assert.ok(emoji.valid);
    assert.equal(emoji.body.messages[0].content.length, 1200);
    await api.reply(emoji, { reply: "Synthetic." });
    await page.waitForTimeout(50);
    await force(page, `${"\u{1F600}".repeat(600)}x`);
    await page.waitForTimeout(50);
    assert.equal(api.requests.length, 1, "601 emoji are 1,201 characters, refused locally");
    await ctx.close();
  });

  await check("the API's two refusals read differently, and a refused history is dropped", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    await ask(page, "First");
    await api.reply(await api.next(1), { reply: "Synthetic one." });
    await page.waitForTimeout(50);
    await ask(page, "Second");
    await api.reply(await api.next(2), { error: "This conversation has grown longer than Neo can follow.", code: "conversation_too_long" }, 400);
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("start fresh"));
    assert.equal(await page.inputValue(sel.input), "Second");
    await page.click(sel.send);
    const retry = await api.next(3);
    assert.deepEqual(retry.body.messages, [{ role: "user", content: "Second" }]);
    await api.reply(retry, { error: "Please keep your question under 1,200 characters.", code: "question_too_long" }, 400);
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("keep your question under"));
    const text = await logText(page);
    assert.ok(text.indexOf("start fresh") < text.indexOf("keep your question under"));
    await ctx.close();
  });

  await check("a cooldown rests the send button for as long as the API says, and nothing is sent meanwhile", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    await ask(page, "First");
    await api.reply(await api.next(1), { error: "You're sending messages faster than Neo can answer well. Please wait for about 2 minutes, then try again.", code: "cooldown" }, 429, { "retry-after": "2" });
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("faster than Neo"));
    assert.equal(await sendDisabled(page), true);
    // Enter still submits the form, but while resting the question stays put and nothing goes up
    await page.fill(sel.input, "Second");
    await page.press(sel.input, "Enter");
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("still resting"));
    assert.equal(await page.inputValue(sel.input), "Second");
    assert.equal(api.requests.length, 1);
    // Once the wait is over, Send works again
    await page.waitForFunction(() => !document.querySelector(".n1chat-send").disabled, null, { timeout: 4000 });
    await page.click(sel.send);
    await api.reply(await api.next(2), { reply: "Synthetic two." });
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("Synthetic two."));
    await ctx.close();
  });

  await check("a failed question leaves the earlier answered turns intact and valid", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    await ask(page, "One");
    await api.reply(await api.next(1), { reply: "Synthetic one." });
    await page.waitForTimeout(50);
    await ask(page, "Two");
    await api.reply(await api.next(2), { error: "busy", code: "busy" }, 503);
    await page.waitForTimeout(50);
    await page.fill(sel.input, "Three");
    await page.click(sel.send);
    const third = await api.next(3);
    assert.deepEqual(third.body.messages.map((m) => m.content), ["One", "Synthetic one.", "Three"]);
    await ctx.close();
  });

  // ---- SITE-04: closing always settles into a usable launcher ----

  const closes = {
    "a normal fold": async () => {},
    "no CSS animation": async (page) => page.addStyleTag({ content: ".n1chat-fold, .n1chat-grow { animation: none !important; }" }),
    "an animation that never ends": async (page) => page.addStyleTag({ content: ".n1chat-fold { animation-duration: 60s !important; }" }),
  };
  for (const [name, setup] of Object.entries(closes)) {
    await check(`closing with ${name} leaves a usable launcher`, async () => {
      const { ctx, page } = await portal(browser);
      await open(page);
      await page.waitForTimeout(700);
      await setup(page);
      await page.click(sel.close);
      await page.waitForTimeout(600);
      const s = await state(page);
      assert.ok(usableClosed(s), JSON.stringify(s));
      assert.ok(s.focusLauncher, "focus returns to the launcher");
      await open(page);
      assert.equal((await state(page)).expanded, "true");
      await ctx.close();
    });
  }

  const interruptions = {
    "the animation cancelled": (page) => page.$eval(".n1chat", (p) => (p.style.animation = "none")),
    "reduced motion switched on": (page) => page.emulateMedia({ reducedMotion: "reduce" }),
    "the menu opening over it": (page) => page.evaluate(() => document.body.classList.add("menu-open")),
    "a case study opening over it": (page) => page.evaluate(() => document.body.classList.add("case-open")),
  };
  for (const [name, interrupt] of Object.entries(interruptions)) {
    await check(`closing with ${name} midway settles closed and reopens`, async () => {
      const { ctx, page } = await portal(browser);
      await open(page);
      await page.waitForTimeout(700);
      // Slow the fold, so the interruption surely lands midway
      await page.addStyleTag({ content: ".n1chat-fold { animation-duration: 2s !important; }" });
      await page.click(sel.close);
      await page.waitForTimeout(60);
      await interrupt(page);
      await page.waitForTimeout(150);
      const s = await state(page);
      assert.ok(usableClosed(s), JSON.stringify(s));
      await page.evaluate(() => document.body.classList.remove("menu-open", "case-open"));
      await open(page);
      assert.equal((await state(page)).expanded, "true");
      await ctx.close();
    });
  }

  await check("rapid close and open input settles into one consistent state", async () => {
    const { ctx, page } = await portal(browser);
    await open(page);
    await page.addStyleTag({ content: ".n1chat-fold, .n1chat-grow { animation-duration: 3s !important; }" });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.evaluate(() => { widget.open(); widget.close(); widget.close(); widget.open(); });
    let s = await state(page);
    assert.ok(!s.panelHidden && s.launcherHidden && s.expanded === "true" && !s.fold, JSON.stringify(s));
    await page.evaluate(() => widget.close());
    await page.waitForTimeout(3200);
    s = await state(page);
    assert.ok(usableClosed(s), JSON.stringify(s));
    await ctx.close();
  });

  await check("with reduced motion from the start, close and open are immediate", async () => {
    const { ctx, page } = await portal(browser, { reduced: true });
    await open(page);
    await page.click(sel.close);
    assert.ok(usableClosed(await state(page)));
    await ctx.close();
  });

  // ---- CHAT-03 and rendering ----

  await check("the box carries a privacy reminder with a link to the policy", async () => {
    const { ctx, page } = await portal(browser);
    await open(page);
    const note = await page.$eval("#n1chat-note", (n) => ({ text: n.textContent, href: n.querySelector("a")?.getAttribute("href"), target: n.querySelector("a")?.target }));
    assert.match(note.text, /don't share passwords, health details, or anything private/);
    assert.equal(note.href, "/1NEON/privacy");
    assert.equal(note.target, "_blank");
    assert.equal(await page.getAttribute(sel.input, "aria-describedby"), "n1chat-note");
    await ctx.close();
  });

  await check("replies render as text, and only http(s), mailto, and tel links become links", async () => {
    const { ctx, page, api } = await portal(browser);
    await open(page);
    await ask(page, "Synthetic renderer test");
    await api.reply(await api.next(1), { reply: "<img src=x onerror=alert(1)> [bad](javascript:alert(1)) [safe](https://example.invalid/path)" });
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("safe"));
    const hrefs = await page.$$eval(".n1chat-log a[href]", (as) => as.map((a) => a.getAttribute("href")));
    assert.deepEqual(hrefs, ["https://example.invalid/path"]);
    assert.equal(await page.$$eval(".n1chat-log img", (i) => i.length), 0);
    await ctx.close();
  });

  // ---- The site's own page: the window mounts there and works the same way ----

  await check("on the site's home page, the window asks, resets, and closes cleanly", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const api = stub(page);
    await page.goto(`${base}/`);
    await page.waitForSelector(sel.launch, { timeout: 15000 });
    await open(page);
    await ask(page, "What does neon1 do?");
    const first = await api.next(1);
    await page.click(sel.fresh);
    await api.reply(first, { reply: "Late synthetic answer" });
    await ask(page, "When are you available?");
    const second = await api.next(2);
    assert.deepEqual(second.body.messages, [{ role: "user", content: "When are you available?" }]);
    await api.reply(second, { reply: "Synthetic hours answer." });
    await page.waitForFunction(() => document.querySelector(".n1chat-log").textContent.includes("Synthetic hours answer."));
    assert.ok(!(await logText(page)).includes("Late synthetic answer"));
    await page.click(sel.close);
    await page.waitForTimeout(600);
    assert.ok(usableClosed(await state(page)));
    assert.deepEqual(errors.filter((e) => /chat/i.test(e)), []);
    await ctx.close();
  });

  await browser.close();
  server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

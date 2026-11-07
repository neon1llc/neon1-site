// src/app/public/js/white-rabbit-sound.js - The white rabbit's sounds, synthesized live with the Web Audio API.
// Usage: const sound = createSound(new AudioContext()); sound.start("scene"); sound.update(p, tv); sound.close()
//
// Imported by white-rabbit.js after a catch, with an AudioContext made in that same click
// or tap, and silent until the scroll out of the TV begins. The tube's low mains hum and
// faint whine, static while the screen shows snow, the room's quiet air, the
// outdoors (a breeze, leaves rustling in gusts, birds now and then, a faint creek), and the
// glitch as the rain stops are built from oscillators, noise, and filters. The car's
// ignition is a real V8 recording, fetched only after the car is first clicked, played
// slower and deeper, then held on a looped stretch of its idle; until it loads, or if it
// can't, the starter and idle are synthesized too. Everything is kept quiet.


// Overall level, and the time constant for smooth level changes (seconds)
const LEVEL = 0.55, GLIDE = 0.08;

// The V8 recording: played slower (which also lowers it), the crank, catch, and first revs up
// to CUT seconds into it, then a clean idle stretch looped (seconds into the recording)
export const V8 = { url: "/media/white-rabbit-v8.m4a", rate: 0.85, cut: 10, idle: [12.5, 14.5], caught: 2.25 };

// Piecewise linear through [progress, value] pairs, flat outside them
function ramp(p, pts) {
  if (p <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (p <= pts[i][0]) { const [p0, a] = pts[i - 1], [p1, b] = pts[i]; return a + ((b - a) * (p - p0)) / (p1 - p0); }
  }
  return pts[pts.length - 1][1];
}


/** Builds the sound graph on ctx; start("scene") readies the beds, which update(p, tv) then brings in */
export function createSound(ctx) {
  const now = () => ctx.currentTime;
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -18; out.ratio.value = 4;
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(out).connect(ctx.destination);

  // Two seconds of white noise, shared by everything that hisses
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // Small builders: a gain into a destination, a looping noise source, an oscillator, and a filter
  const gain = (v = 0, to = master) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
  const hiss = (to) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.loopStart = Math.random(); s.connect(to); s.start(); return s; };
  const tone = (type, f, to) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(to); o.start(); return o; };
  const filter = (type, f, q, to) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(to); return b; };
  const sources = [];

  // ---- Beds ----
  // The CRT: mains hum with its harmonics, softened, and the faint whine of the flyback transformer
  const hum = gain();
  const humTone = filter("lowpass", 380, 0.7, hum);
  sources.push(tone("sawtooth", 60, gain(0.5, humTone)), tone("sine", 120, gain(0.6, humTone)), tone("sine", 180, gain(0.15, humTone)));
  sources.push(tone("sine", 15734, gain(0.004, hum)));
  // An electrical buzz on top: noise chopped at twice the mains rate, kept thin and quiet
  const buzz = gain(0, hum);
  const buzzTone = filter("bandpass", 1800, 1.5, buzz);
  sources.push(hiss(buzzTone));
  const chop = gain(0.006, buzz.gain);
  sources.push(tone("square", 120, chop));

  // Static on the screen: band-limited noise, muffled by a lowpass once the glass is between us
  const fizz = gain();
  const muffle = filter("lowpass", 6000, 0.5, fizz);
  sources.push(hiss(filter("bandpass", 2600, 0.6, muffle)));

  // The room: low, still air
  const air = gain();
  sources.push(hiss(filter("lowpass", 240, 0.4, air)));

  // ---- Outside, through the window: a soft breeze, leaves in gusts, birds, and a faint creek ----
  // Everything outside runs through one level and one lowpass, so it is muffled while the window is
  // behind the camera and opens up as the camera turns to it
  const outside = gain();
  const through = filter("lowpass", 900, 0.5, outside);
  // A small, soft room for the birds: two damped echoes that feed back a little
  const echo = ctx.createDelay(1); echo.delayTime.value = 0.13;
  const echo2 = ctx.createDelay(1); echo2.delayTime.value = 0.21;
  const damp = filter("lowpass", 2400, 0.5, through);
  const feed = gain(0.28, echo);
  echo.connect(damp); echo2.connect(damp); damp.connect(feed); feed.connect(echo2);
  const birdsSend = gain(0.22, echo);
  // The breeze bed: a low, slow-moving whisper that never quite stops
  const bed = gain(0.012, through);
  const bedTone = filter("lowpass", 420, 0.4, bed);
  sources.push(hiss(bedTone));
  // A faint creek far off: babbling noise whose band wanders
  const creek = gain(0.0035, through);
  const creekTone = filter("bandpass", 900, 0.8, creek);
  sources.push(hiss(creekTone));

  // A one-shot noise grain: a leaf ticking against others, short, bright, and placed left or right
  function grain(level) {
    const t = now(), len = 0.012 + Math.random() * 0.045;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 2000 + Math.random() * 4000; band.Q.value = 1.2 + Math.random() * 2;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.8 - 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(band).connect(g).connect(pan).connect(through);
    src.start(t, Math.random() * 1.8, len + 0.01);
    src.onended = () => pan.disconnect();
  }

  // A bird: a pure tone through a gain envelope, gliding between pitches; notes are [start, length,
  // from Hz, to Hz, level]; far birds are quieter and duller, and every bird sits left or right
  function bird(notes, far) {
    const t = now() + 0.02, pan = ctx.createStereoPanner(), dull = ctx.createBiquadFilter();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    dull.type = "lowpass"; dull.frequency.value = 9000 - far * 6500;
    const out = ctx.createGain(); out.gain.value = 0.05 * (1 - far * 0.7);
    out.connect(dull).connect(pan); pan.connect(through); pan.connect(birdsSend);
    let end = 0;
    for (const [at, len, f0, f1, level] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + len);
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(level, t + at + Math.min(0.012, len / 3));
      g.gain.setTargetAtTime(0, t + at + len * 0.7, len * 0.12);
      o.connect(g).connect(out); o.start(t + at); o.stop(t + at + len + 0.1);
      end = Math.max(end, at + len + 0.2);
    }
    setTimeout(() => pan.disconnect(), (end + 0.5) * 1000);
  }

  // Four kinds of bird, each a little different every time
  const songs = [
    // A quick chirping trill
    () => { const n = 3 + (Math.random() * 4 | 0), f = 2600 + Math.random() * 1400; return Array.from({ length: n }, (_, i) => [i * 0.075, 0.045, f, f * 1.8, 1]); },
    // A two-note "fee-bee" whistle
    () => { const f = 3300 + Math.random() * 500; return [[0, 0.32, f, f * 0.98, 0.9], [0.4, 0.38, f * 0.83, f * 0.8, 0.8]]; },
    // A warbling phrase
    () => { let at = 0; return Array.from({ length: 7 + (Math.random() * 6 | 0) }, () => { const f = 2200 + Math.random() * 2600, len = 0.05 + Math.random() * 0.05, n = [at, len, f, f * (0.8 + Math.random() * 0.5), 0.7 + Math.random() * 0.3]; at += len + 0.02; return n; }); },
    // A dove cooing far off: low and soft, "hoo-HOO-hoo-hoo"
    () => { const f = 470 + Math.random() * 60; return [[0, 0.32, f * 0.95, f, 0.6], [0.45, 0.5, f * 1.08, f, 1], [1.05, 0.3, f, f * 0.94, 0.6], [1.45, 0.3, f, f * 0.94, 0.55]]; },
  ];

  // The clock outside: when the next gust and bird come, and how the current gust is shaped
  let gust = { start: 4 + Math.random() * 6, rise: 2, hold: 1, fall: 2.5 }, nextBird = 2 + Math.random() * 5;
  const gustLevel = (t) => {
    const g = gust, x = t - g.start;
    if (x < 0) return 0;
    if (x < g.rise) return Math.sin((x / g.rise) * Math.PI / 2) ** 2;
    if (x < g.rise + g.hold) return 1;
    return Math.max(0, 1 - (x - g.rise - g.hold) / g.fall) ** 2;
  };

  // Outside, each frame: gusts come and go with grains of rustle thickest at their peak, birds sing now
  // and then, and the window's openness sets how much of it reaches the room
  let last = 0;
  function outdoors(level, openness) {
    const t = now(), dt = last ? Math.min(0.1, t - last) : 0;
    last = t;
    glide(outside.gain, level, 0.4);
    glide(through.frequency, 700 + 8000 * openness * openness, 0.3);
    if (level < 0.01) return;
    const g = gustLevel(t);
    if (t > gust.start + gust.rise + gust.hold + gust.fall) gust = { start: t + 6 + Math.random() * 14, rise: 1 + Math.random() * 2, hold: Math.random() * 1.5, fall: 1.5 + Math.random() * 2 };
    glide(bed.gain, 0.01 + 0.012 * g, 0.5);
    glide(bedTone.frequency, 380 + 260 * g, 0.5);
    for (let n = dt * (6 + 140 * g); n > 0; n--) if (Math.random() < n) grain(0.02 + 0.05 * g * Math.random());
    if (t > nextBird) { bird(songs[Math.random() * songs.length | 0](), Math.random()); nextBird = t + 4 + Math.random() * 11; }
    glide(creekTone.frequency, 800 + 250 * Math.sin(t * 0.7) + 120 * Math.sin(t * 2.3), 0.1);
  }

  let mode = null, heard = false;

  // Sets a level smoothly
  const glide = (param, v, t = GLIDE) => param.setTargetAtTime(v, now(), t);

  // Readies the beds; nothing is heard until the scroll out of the TV begins (see update)
  function start(m) { mode = m; }

  // Follows the scene: the tube's low hum fades as the camera turns from the set, static comes with the
  // snow on the screen, and the outdoors comes in with the room and opens up toward the window
  function update(p, tv) {
    if (mode !== "scene") return;
    // Silent at the landing; the sound fades in as the scroll out of the TV begins, and out on the way back
    heard = p >= 0.002;
    glide(master.gain, heard ? LEVEL : 0, heard ? 0.35 : 0.15);
    glide(hum.gain, 0.045 * (0.06 + 0.94 * tv));
    // Static only while the screen itself shows snow, following it in and out
    glide(fizz.gain, 0.06 * ramp(p, [[0.36, 0], [0.4, 1], [0.46, 0]]));
    glide(muffle.frequency, ramp(p, [[0, 7000], [0.28, 4000], [0.45, 1400], [0.7, 900]]));
    glide(air.gain, ramp(p, [[0.3, 0.01], [0.5, 0.04], [0.9, 0.05]]));
    outdoors(ramp(p, [[0.38, 0], [0.55, 0.45], [0.85, 1]]), ramp(p, [[0.6, 0], [0.88, 1]]));
  }

  // ---- The glitch as the rain stops ----
  // A short envelope on a new gain: up fast, then down over len seconds
  function burst(len, peak) {
    const g = gain(0), t = now();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    setTimeout(() => g.disconnect(), (len + 0.2) * 1000);
    return g;
  }
  // A one-shot noise or tone into g, stopped after len seconds
  const shotNoise = (to, len) => { const s = ctx.createBufferSource(); s.buffer = noise; s.connect(to); s.start(now(), Math.random(), len); };
  const shotTone = (type, f, to, len) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(to); o.start(); o.stop(now() + len); return o; };

  // Each move of the rain's glitch gets its own sound; a freeze is silence
  function glitch(kind, ms) {
    const len = Math.max(0.03, ms / 1000);
    if (kind === "tear") {
      shotNoise(filter("highpass", 1800, 0.7, burst(len, 0.16)), len);
      shotTone("square", 140 + Math.random() * 80, filter("lowpass", 1200, 1, burst(len, 0.05)), len);
    } else if (kind === "jump") {
      const o = shotTone("square", 1400, burst(0.06, 0.06), 0.06);
      o.frequency.exponentialRampToValueAtTime(180, now() + 0.06);
    } else if (kind === "flash") {
      shotNoise(burst(len + 0.04, 0.2), len + 0.04);
      shotTone("sine", 55, burst(0.18, 0.25), 0.18);
    } else if (kind === "shift") {
      const g = filter("bandpass", 420, 2, burst(len, 0.12));
      shotTone("sawtooth", 88, g, len); shotTone("sawtooth", 93, g, len);
    } else if (kind === "run") {
      shotNoise(filter("bandpass", 3200, 3, burst(0.025, 0.08)), 0.03);
    }
  }

  // ---- The model car ----
  // Exhaust pulses for a cross-plane V8 at idle: eight firings every two turns, the two banks
  // landing unevenly, which is where the burble comes from. Twelve cycles loop seamlessly
  function exhaust() {
    const sr = ctx.sampleRate, cycle = 0.16, n = Math.round(cycle * 12 * sr), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const banks = [1, 0, 0, 1, 0, 1, 1, 0];
    for (let c = 0; c < 12; c++) for (let k = 0; k < 8; k++) {
      const t0 = Math.round((c * cycle + k * cycle / 8 + (Math.random() - 0.5) * 0.0016) * sr);
      const amp = (banks[k] ? 1 : 0.68) * (0.85 + Math.random() * 0.3), f = 62 + Math.random() * 18;
      for (let i = 0; i < 0.06 * sr; i++) {
        const t = i / sr, v = amp * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.022) + (Math.random() * 2 - 1) * 0.5 * Math.exp(-t / 0.005));
        d[(t0 + i) % n] += v;
      }
    }
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < n; i++) d[i] /= peak;
    return buf;
  }
  let engine = null, starter = null, v8 = null, v8Load = null;

  // Fetches and decodes the recording once; a failure leaves the synthesized engine in its place
  function loadV8() {
    v8Load = v8Load || fetch(V8.url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((b) => ctx.decodeAudioData(b)).then((buf) => { v8 = buf; }).catch(() => {});
  }

  // The recording through a low shelf for weight, into its own gain
  function recorded(offset, len, loop) {
    const g = gain(0), shelf = filter("lowshelf", 160, 0.7, g), src = ctx.createBufferSource();
    shelf.gain.value = 5;
    src.buffer = v8; src.playbackRate.value = V8.rate; src.connect(shelf);
    if (loop) { src.loop = true; src.loopStart = V8.idle[0]; src.loopEnd = V8.idle[1]; }
    return { g, src, go: (at) => (loop ? src.start(at, offset) : src.start(at, offset, len)) };
  }

  // The ignition from the recording: crank, catch, and revs, then a crossfade into the looping idle
  function ignition() {
    const t = now(), end = t + V8.cut / V8.rate, fade = 0.7;
    const rec = recorded(0, V8.cut + 0.2, false), idle = recorded(V8.idle[0], 0, true);
    rec.g.gain.setValueAtTime(0, t); rec.g.gain.linearRampToValueAtTime(0.5, t + 0.08);
    rec.g.gain.setValueAtTime(0.5, end - fade); rec.g.gain.linearRampToValueAtTime(0, end);
    idle.g.gain.setValueAtTime(0, end - fade); idle.g.gain.linearRampToValueAtTime(0.42, end);
    rec.go(t); idle.go(end - fade);
    engine = { parts: [rec, idle] };
  }

  // The starter: a geared whine that labors at each compression; the engine: a blip, then idle
  function car(kind) {
    const t = now();
    if (kind === "click") { loadV8(); return; }
    if (kind === "crank" && v8) { ignition(); return; }
    if (kind === "fire" && engine) return; // the recording already caught
    if (kind === "crank") {
      const g = gain(0), body = filter("lowpass", 900, 1, g), wob = ctx.createGain();
      wob.gain.value = 0.5; wob.connect(body);
      const whine = tone("sawtooth", 170, wob), grind = hiss(filter("bandpass", 600, 1.2, wob));
      const lfo = tone("sine", 11, gain(0.5, wob.gain));
      whine.frequency.linearRampToValueAtTime(200, t + 0.8);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05);
      starter = { g, nodes: [whine, grind, lfo] };
    } else if (kind === "fire") {
      stopStarter();
      const g = gain(0), src = ctx.createBufferSource();
      src.buffer = exhaust(); src.loop = true;
      src.connect(filter("lowpass", 520, 0.8, g)); src.start();
      src.playbackRate.setValueAtTime(1, t); src.playbackRate.linearRampToValueAtTime(2.1, t + 0.25); src.playbackRate.setTargetAtTime(1, t + 0.3, 0.35);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.06); g.gain.setTargetAtTime(0.16, t + 0.4, 0.4);
      engine = { parts: [{ g, src }] };
    } else if (kind === "stop") {
      stopStarter();
      if (engine) {
        for (const { g, src } of engine.parts) {
          src.playbackRate.setTargetAtTime(0.6, t, 0.25); g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.18);
          src.stop(t + 1); setTimeout(() => g.disconnect(), 1200);
        }
        engine = null;
      }
    }
  }
  function stopStarter() {
    if (!starter) return;
    const t = now();
    starter.g.gain.setTargetAtTime(0, t, 0.03);
    starter.nodes.forEach((n) => n.stop(t + 0.3));
    starter = null;
  }

  // ---- Close ----
  // Fades everything out and closes the context, freeing the audio device and the recording
  function close() {
    glide(master.gain, 0, 0.08);
    v8 = null; engine = null;
    setTimeout(() => { sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); ctx.close().catch(() => {}); }, 300);
  }

  return { start, update, glitch, car, close };
}

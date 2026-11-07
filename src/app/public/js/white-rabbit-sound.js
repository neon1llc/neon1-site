// src/app/public/js/white-rabbit-sound.js - The white rabbit's sounds, synthesized live with the Web Audio API.
// Usage: const sound = createSound(new AudioContext()); sound.start("scene"); sound.update(p, tv); sound.close()
//
// Imported by white-rabbit.js after a catch, with an AudioContext made in that same click
// or tap. The CRT's hum and whine, the static on the screen, the room's quiet air, and
// the glitch as the rain stops are built from oscillators, noise, and filters. The car's
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


/** Builds the sound graph on ctx; start(mode) brings in the beds for "scene" or "card" */
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
  sources.push(tone("sine", 15734, gain(0.012, hum)));

  // Static on the screen: band-limited noise, muffled by a lowpass once the glass is between us
  const fizz = gain();
  const muffle = filter("lowpass", 6000, 0.5, fizz);
  sources.push(hiss(filter("bandpass", 2600, 0.6, muffle)));

  // The room: low, still air, and a breath of wind and leaves near the open window
  const air = gain();
  sources.push(hiss(filter("lowpass", 240, 0.4, air)));
  const breeze = gain();
  const leaves = filter("bandpass", 1100, 0.4, breeze);
  sources.push(hiss(leaves));

  let mode = null, muted = false;

  // Sets a level smoothly
  const glide = (param, v, t = GLIDE) => param.setTargetAtTime(v, now(), t);

  // Brings the beds in: the scene gets everything, the card only the room's air
  function start(m) {
    mode = m;
    glide(master.gain, muted ? 0 : LEVEL, 0.4);
    if (m === "card") { glide(hum.gain, 0); glide(fizz.gain, 0); glide(air.gain, 0.05, 0.5); glide(breeze.gain, 0.012, 0.5); }
  }

  // Follows the scene: the hum fades as the camera turns from the set, static sits under the screen beats
  function update(p, tv) {
    if (mode !== "scene") return;
    glide(hum.gain, 0.04 * (0.06 + 0.94 * tv));
    glide(fizz.gain, ramp(p, [[0, 0.004], [0.06, 0.02], [0.3, 0.035], [0.38, 0.06], [0.46, 0.025], [0.6, 0.008], [0.8, 0.002]]) * (0.3 + 0.7 * tv));
    glide(muffle.frequency, ramp(p, [[0, 7000], [0.28, 4000], [0.45, 1400], [0.7, 900]]));
    glide(air.gain, ramp(p, [[0.3, 0.01], [0.5, 0.04], [0.9, 0.05]]));
    glide(breeze.gain, ramp(p, [[0.6, 0], [0.85, 0.014], [1, 0.02]]));
    glide(leaves.frequency, 900 + 300 * Math.sin(now() * 0.3));
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

  // ---- Mute and close ----
  // Muting fades out and suspends the context, so it costs nothing while silent
  function setMuted(m) {
    muted = m;
    if (m) { glide(master.gain, 0, 0.05); setTimeout(() => muted && ctx.state === "running" && ctx.suspend(), 250); }
    else { ctx.resume(); glide(master.gain, LEVEL, 0.2); }
  }

  // Fades everything out and closes the context, freeing the audio device and the recording
  function close() {
    glide(master.gain, 0, 0.08);
    v8 = null; engine = null;
    setTimeout(() => { sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); ctx.close().catch(() => {}); }, 300);
  }

  return { start, update, glitch, car, setMuted, close };
}

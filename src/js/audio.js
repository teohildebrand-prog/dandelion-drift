'use strict';
/* ===================== AUDIO: procedural SFX + layered sequenced music ===================== */
const Audio = (() => {
  let ctx = null, master, sfxG, musG, echoIn, noiseBuf, windG, windF, buzzG, struggleG;
  let sfxOn = true, musOn = true, muted = false;
  try { const s = JSON.parse(localStorage.getItem('dd-audio') || '{}'); sfxOn = s.sfx !== false; musOn = s.mus !== false; muted = !!s.muted; } catch (e) {}
  const save = () => { try { localStorage.setItem('dd-audio', JSON.stringify({ sfx: sfxOn, mus: musOn, muted })); } catch (e) {} };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const L = {};   // music layer gains

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : .8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; master.connect(comp); comp.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = sfxOn ? 1 : 0; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = musOn ? .55 : 0; musG.connect(master);
    // echo: the sequenced-cartridge "room"
    echoIn = ctx.createGain(); const dl = ctx.createDelay(1); dl.delayTime.value = .31; const fb = ctx.createGain(); fb.gain.value = .32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musG);
    ['pad', 'bass', 'mel', 'arp', 'perc', 'tens'].forEach(k => { L[k] = ctx.createGain(); L[k].gain.value = 0; L[k].connect(musG); });
    L.mel.connect(echoIn); L.arp.connect(echoIn);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // wind bed
    const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
    windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.Q.value = .6; windF.frequency.value = 400;
    windG = ctx.createGain(); windG.gain.value = 0; ws.connect(windF); windF.connect(windG); windG.connect(sfxG); ws.start();
    // wasp buzz
    const bo = ctx.createOscillator(); bo.type = 'sawtooth'; bo.frequency.value = 220;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 29; lg.gain.value = 20; lfo.connect(lg); lg.connect(bo.frequency);
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1200; bf.Q.value = 1.4;
    buzzG = ctx.createGain(); buzzG.gain.value = 0; bo.connect(bf); bf.connect(buzzG); buzzG.connect(sfxG); bo.start(); lfo.start();
    startMusic();
  }
  const ok = () => ctx && sfxOn && !muted;
  function tone(f, dur, type = 'sine', vol = .2, slide = 0, delay = 0, dest) {
    if (!ok()) return; const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, type, f0, f1, vol, q = 1, delay = 0) {
    if (!ok()) return; const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.03, dur * .3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxG); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
  }

  /* ---------- music ---------- */
  const BPM = 96, SPB = 60 / BPM / 4;   // seconds per sixteenth
  // 16 bars: chord roots + qualities (semitones above D)
  const CH = [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M'], [0, 'M'], [4, 'm'], [5, 'M'], [7, 'M'], [5, 'M'], [7, 'M'], [4, 'm'], [9, 'm'], [5, 'M'], [7, 'M'], [0, 'M'], [0, 'M']];
  const triad = (r, q) => [r, r + (q === 'M' ? 4 : 3), r + 7];
  // melody: [midi or 0 for rest, beats] per bar
  const MEL = [
    [[69, 1], [66, .5], [69, .5], [74, 1.5], [0, .5]], [[71, 1.5], [69, .5], [66, 1], [62, 1]], [[67, 1], [71, 1], [74, 1], [71, 1]], [[73, 1.5], [71, .5], [69, 2]],
    [[69, 1], [74, .5], [76, .5], [78, 1.5], [76, .5]], [[73, 1], [69, 1], [66, 1], [69, 1]], [[71, 1.5], [74, .5], [79, 1], [78, .5], [76, .5]], [[76, 2], [73, 1], [0, 1]],
    [[74, 1], [71, .5], [67, .5], [71, 1], [74, 1]], [[76, 1], [73, .5], [69, .5], [73, 1], [76, 1]], [[78, 1.5], [76, .5], [73, 1], [69, 1]], [[74, 1], [71, 1], [66, 1], [71, 1]],
    [[79, 1], [78, .5], [76, .5], [74, 1], [71, 1]], [[73, 1], [76, 1], [81, 1.5], [79, .5]], [[78, 2], [76, .5], [74, .5], [69, 1]], [[74, 3], [0, 1]],
  ];
  const melSteps = new Map();
  MEL.forEach((bar, b) => { let s = b * 16; bar.forEach(([m, beats]) => { if (m) melSteps.set(s, [m, beats * 4]); s += beats * 4; }); });
  let step = 0, nextT = 0, timer = null, tier = 1, threat = 0;
  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + rel); };
  function voice(dest, type, f, t, dur, vol, a = .01, rel = .15, detune = 0, vib = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    if (vib) { const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * vib, t + .25); v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + dur + rel + .1); }
    env(g, t, a, vol, Math.max(0, dur - a), rel); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + rel + .1);
  }
  function schedule(s, t) {
    const bar = Math.floor(s / 16) % 16, inBar = s % 16, [root, q] = CH[bar], tri = triad(root, q);
    if (inBar === 0) tri.forEach(n => { voice(L.pad, 'triangle', mtof(62 + n), t, SPB * 15, .035, .25, .5, -5); voice(L.pad, 'triangle', mtof(62 + n), t, SPB * 15, .03, .25, .5, 6); });
    if (inBar === 0 || inBar === 8) voice(L.bass, 'triangle', mtof(38 + (inBar === 0 ? root : root + 7)), t, SPB * 5, .16, .005, .12);
    if (inBar === 6 || inBar === 14) voice(L.bass, 'sine', mtof(50 + root), t, SPB * 1.5, .08, .005, .08);
    const m = melSteps.get(s % 256);
    if (m) { voice(L.mel, 'square', mtof(m[0]), t, SPB * m[1] * .92, .028, .015, .12, 0, .006); voice(L.mel, 'triangle', mtof(m[0]), t, SPB * m[1] * .92, .05, .015, .14); }
    if (inBar % 2 === 0) { const n = tri[(inBar / 2) % 3] + 74 + (inBar >= 8 ? 0 : 0); voice(L.arp, 'square', mtof(n), t, SPB * .9, .014, .004, .06); }
    if (inBar % 4 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .16); env(g, t, .004, .22, 0, .16); o.connect(g); g.connect(L.perc); o.start(t); o.stop(t + .25); }
    if (inBar % 4 === 2) { const sN = ctx.createBufferSource(); sN.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); env(g, t, .002, .05, 0, .04); sN.connect(f); f.connect(g); g.connect(L.perc); sN.start(t, Math.random()); sN.stop(t + .08); }
    if (inBar % 2 === 0) voice(L.tens, 'sawtooth', mtof(38 + (bar % 2 ? 1 : 0)), t, SPB * 1.2, .05, .01, .05);
  }
  function startMusic() {
    nextT = ctx.currentTime + .1; step = 0;
    timer = setInterval(() => {
      if (!ctx) return;
      while (nextT < ctx.currentTime + .2) { schedule(step, nextT); step = (step + 1) % 256; nextT += SPB; }
    }, 40);
  }
  let lastMix = 0;
  function mix(force) {
    if (!ctx) return; const t = ctx.currentTime; if (!force && t - lastMix < .1) return; lastMix = t;
    const set = (k, v) => L[k].gain.setTargetAtTime(v, t, .8);
    set('pad', 1); set('bass', 1); set('mel', tier >= 2 ? 1 : 0); set('arp', tier >= 3 ? 1 : 0); set('perc', tier >= 2 ? .8 : 0); set('tens', threat ? 1 : 0);
  }

  return {
    init,
    get ready() { return !!ctx; },
    get sfxOn() { return sfxOn; }, get musOn() { return musOn; }, get muted() { return muted; },
    setSfx(v) { sfxOn = v; save(); if (ctx) sfxG.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, .05); },
    setMus(v) { musOn = v; save(); if (ctx) musG.gain.setTargetAtTime(v ? .55 : 0, ctx.currentTime, .1); },
    setMuted(v) { muted = v; save(); if (ctx) master.gain.setTargetAtTime(v ? 0 : .8, ctx.currentTime, .05); },
    music(tr, th) { tier = tr; threat = th; mix(); },
    update(mode, speed, buzz, glide) {
      if (!ctx) return; const t = ctx.currentTime;
      const w = clamp((speed - 3) / 12, 0, 1), on = mode === 'play';
      windG.gain.setTargetAtTime(on ? .03 + w * .16 + (glide ? .03 : 0) : .02, t, .25);
      windF.frequency.setTargetAtTime(280 + w * 1500, t, .3);
      buzzG.gain.setTargetAtTime(on ? buzz * .07 : 0, t, .08);
    },
    // ---- effects ----
    jump() { tone(330, .14, 'square', .07, 660); },
    open() { noise(.3, 'bandpass', 500, 1600, .14, 1); tone(880, .12, 'triangle', .06, 0, .03); tone(1320, .14, 'triangle', .05, 0, .08); },
    close() { noise(.12, 'bandpass', 1400, 500, .1); tone(660, .08, 'triangle', .04, 440); },
    dive() { noise(.5, 'bandpass', 400, 2400, .16, .9); },
    flare() { noise(.4, 'bandpass', 2000, 600, .12); tone(440, .35, 'triangle', .07, 880); },
    land() { noise(.1, 'lowpass', 600, 150, .18); },
    step() { noise(.04, 'lowpass', 900, 300, .05); },
    grab() { tone(260, .07, 'square', .06, 200); noise(.06, 'lowpass', 1200, 400, .1); },
    climb() { tone(330, .1, 'square', .05, 520); },
    pollen(c) { const P = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31]; const f = 880 * Math.pow(2, P[Math.min(c, P.length - 1)] / 12); tone(f, .1, 'square', .035); tone(f * 1.5, .16, 'triangle', .05, 0, .05); },
    pod() { tone(523, .1, 'triangle', .1); tone(784, .16, 'triangle', .1, 0, .07); },
    plant() { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, .18, 'triangle', .08, 0, i * .08)); noise(.5, 'lowpass', 300, 1200, .08); },
    grow() { tone(196, .6, 'sine', .1, 392); },
    golden() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? .9 : .22, 'square', .045, 0, i * .11)); [262, 330, 392].forEach(f => tone(f, 1.4, 'triangle', .07, 0, .66)); },
    letter() { [659, 784, 988].forEach((f, i) => tone(f, .25, 'triangle', .08, 0, i * .1)); },
    feather() { [988, 1175, 1319, 1568].forEach((f, i) => tone(f, .3, 'sine', .07, 0, i * .09)); },
    tuft() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'square', .04, 0, i * .07)); },
    hurt() { tone(400, .3, 'square', .08, 120); noise(.2, 'lowpass', 1800, 200, .2); },
    pulse() { noise(.6, 'bandpass', 3000, 300, .22, .8); tone(220, .4, 'sine', .14, 110); },
    boing() { tone(160, .35, 'square', .07, 640); tone(320, .3, 'sine', .1, 1000); },
    burst() { noise(.5, 'lowpass', 1600, 200, .3); tone(90, .3, 'sine', .14, 50); },
    squelch() { tone(140, .2, 'sawtooth', .05, 70); noise(.18, 'lowpass', 500, 150, .14); },
    web() { tone(1200, .12, 'sine', .05, 600); noise(.2, 'highpass', 3000, 1500, .06); },
    tear() { noise(.25, 'highpass', 2500, 800, .14); },
    struggle() { tone(500 + Math.random() * 200, .06, 'square', .04); },
    cry() {
      if (!ok()) return; const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) { const t0 = t + i * .18, dur = .22;
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(3000, t0); o.frequency.exponentialRampToValueAtTime(1900, t0 + dur);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 3;
        const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.16, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
        o.connect(f); f.connect(g); g.connect(sfxG); o.start(t0); o.stop(t0 + dur + .05); }
    },
    swoosh() { noise(.45, 'bandpass', 600, 3000, .2, 1.2); },
    gust() { noise(.9, 'bandpass', 300, 900, .12, .7); },
    snap() { noise(.08, 'highpass', 2500, 2500, .25); },
    checkpoint() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, .2, 'triangle', .08, 0, i * .08)); },
    blip() { tone(1200, .03, 'square', .02); },
    select() { tone(880, .06, 'square', .05); },
    unlock() { [523, 784, 1047, 1568].forEach((f, i) => tone(f, .3, 'triangle', .08, 0, i * .12)); },
    clear() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .4, 'square', .045, 0, i * .12)); [262, 330, 392, 523].forEach(f => tone(f, 2, 'triangle', .06, 0, .8)); },
    fall() { tone(600, .5, 'triangle', .06, 150); },
  };
})();


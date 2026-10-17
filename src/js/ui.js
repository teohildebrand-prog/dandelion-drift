'use strict';
if (!R) throw new Error('WebGL unavailable');
/* ===================== HUD, MENUS, INPUT, LOOP ===================== */
R.far = 700;
const TUFT_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><g stroke="#3a2a10" stroke-width="2.4" stroke-linecap="round"><path d="M16 30V14"/></g><g fill="#fff" stroke="#3a2a10" stroke-width="2"><circle cx="16" cy="11" r="9"/></g><g stroke="#c9d6e0" stroke-width="1.4" stroke-linecap="round"><path d="M16 11l-5-5M16 11l5-5M16 11l-7 1M16 11l7 1M16 11l-3 6M16 11l3 6M16 11V3"/></g></svg>';
const POD_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="13" rx="6" ry="8.5" fill="#9a7a3a" stroke="#3a2a10" stroke-width="2"/><path d="M12 5v-3" stroke="#3a2a10" stroke-width="2" stroke-linecap="round"/><ellipse cx="10" cy="10" rx="1.6" ry="3" fill="#d8bc78"/></svg>';
const hud = { last: '' };
function buildHearts() { $('tufts').innerHTML = TUFT_SVG.repeat(5); }
buildHearts();
function renderHUD() {
  const tot = STATS.pollen[0] + STATS.pollen[1] + STATS.pollen[2];
  const ctx = mode === 'play' ? context() : null;
  const key = [P.tufts, P.maxTufts, tot, STATS.golden, P.pods, Math.ceil(Math.max(0, P.pulseCd)), ctx ? ctx.k + ctx.t : '', mode].join('|');
  if (key === hud.last) return; hud.last = key;
  [...$('tufts').children].forEach((el, i) => { el.style.display = i < P.maxTufts ? '' : 'none'; el.classList.toggle('off', i >= P.tufts); });
  $('pollenN').textContent = String(tot).padStart(3, '0');
  $('goldN').textContent = STATS.golden;
  $('pods').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < P.pods ? 'on' : '') + '">' + POD_SVG + '</i>').join('');
  const cd = Math.max(0, P.pulseCd); $('pulse').classList.toggle('ready', cd <= 0); $('pulseN').textContent = cd > 0 ? Math.ceil(cd) : 'Q';
  const pr = $('prompt'); if (ctx) { pr.innerHTML = '<kbd>' + (gpActive ? ({ Space: 'A', E: 'X' }[ctx.k] || ctx.k) : ctx.k) + '</kbd>' + ctx.t; pr.classList.add('on'); } else pr.classList.remove('on');
  $('hud').hidden = !(mode === 'play' || mode === 'talk' || mode === 'dying' || mode === 'pause');
}
/* radial plant picker */
function showRadial(on) {
  $('radial').hidden = !on; if (!on) return;
  $('radial').innerHTML = '<div class="rcenter"><b id="rname"></b><span id="rnote"></span><small>' + (P.pods || (radial.patch && radial.patch.plant) ? (radial.patch && radial.patch.plant ? 'Swapping keeps your pod count' : P.pods + ' pod' + (P.pods === 1 ? '' : 's') + ' left') : 'No pods left') + '</small></div>' +
    PLANTS.map((pl, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; return '<div class="rslot' + (unlocked.has(pl.id) ? '' : ' locked') + '" data-i="' + i + '" style="left:' + (50 + Math.cos(a) * 36) + '%;top:' + (50 + Math.sin(a) * 36) + '%"><i class="pi pi-' + pl.id + '"></i><b>' + (unlocked.has(pl.id) ? pl.name : '?') + '</b><kbd>' + (i + 1) + '</kbd></div>'; }).join('');
  $('radial').querySelectorAll('.rslot').forEach(el => el.addEventListener('pointerenter', () => { radial.sel = +el.dataset.i; renderRadial(); }));
  renderRadial();
}
function renderRadial() {
  $('radial').querySelectorAll('.rslot').forEach((el, i) => el.classList.toggle('sel', i === radial.sel));
  const pl = PLANTS[radial.sel], u = unlocked.has(pl.id);
  $('rname').textContent = u ? pl.name : 'Locked'; $('rnote').textContent = u ? pl.note : 'Found higher in the gorge';
}
/* pause menu */
function openPause() {
  if (mode !== 'play') return; mode = 'pause'; Audio.select(); exitLock();
  const rows = [1, 2, 3].map(t => {
    const gs = goldens.filter(g => g.tier === t), ls = letters.filter(l => l.tier === t);
    return '<tr><th>' + TIERS[t][0] + '</th><td>' + STATS.pollen[t - 1] + ' / ' + TOT.pollen[t - 1] + '</td><td>' + (gs.map(g => g.taken ? '<span class="gs got" title="' + g.name + '"></span>' : g.seen ? '<span class="gs seen" title="' + g.name + ' (seen)"></span>' : '<span class="gs"></span>').join('') || '–') + '</td><td>' + ls.filter(l => l.taken).length + ' / ' + ls.length + '</td></tr>';
  }).join('');
  $('mapTable').innerHTML = '<tr><th></th><th>Pollen</th><th>Golden seeds</th><th>Letters</th></tr>' + rows;
  $('mapExtra').textContent = (P.feather ? 'Feather charm found. ' : 'Feather charm: make the kestrel miss three stoops in a row. ') + 'Time ' + fmtTime(STATS.t) + '.';
  syncOpts(); $('pauseOv').hidden = false; setTimeout(() => $('resumeBtn').focus(), 30);
}
function closePause() { $('pauseOv').hidden = true; mode = 'play'; Audio.select(); }
function syncOpts() {
  $('optAssist').setAttribute('aria-pressed', OPT.assist); $('optAssist').querySelector('em').textContent = OPT.assist ? '2.5 s' : '1.5 s';
  $('optTilt').setAttribute('aria-pressed', OPT.tilt); $('optTilt').querySelector('em').textContent = OPT.tilt ? 'On' : 'Off';
  $('optSharp').setAttribute('aria-pressed', OPT.sharp); $('optSharp').querySelector('em').textContent = OPT.sharp ? 'Sharp' : '240p';
  $('optDither').setAttribute('aria-pressed', OPT.dither); $('optDither').querySelector('em').textContent = OPT.dither ? 'On' : 'Off';
  $('optMus').setAttribute('aria-pressed', Audio.musOn); $('optMus').querySelector('em').textContent = Audio.musOn ? 'On' : 'Off';
  $('optSfx').setAttribute('aria-pressed', Audio.sfxOn); $('optSfx').querySelector('em').textContent = Audio.sfxOn ? 'On' : 'Off';
}
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function showClear() {
  mode = 'clear'; exitLock();
  const tot = STATS.pollen[0] + STATS.pollen[1] + STATS.pollen[2], all = TOT.pollen[0] + TOT.pollen[1] + TOT.pollen[2];
  let best = 0; try { best = +localStorage.getItem('dd-best') || 0; if (!best || STATS.t < best) localStorage.setItem('dd-best', STATS.t); } catch (e) {}
  $('clearStats').innerHTML = [['Time', fmtTime(STATS.t) + (best && STATS.t < best ? ' · new best' : best ? ' · best ' + fmtTime(best) : '')], ['Pollen motes', tot + ' / ' + all], ['Golden seeds', STATS.golden + ' / ' + goldens.length], ['Lost letters', STATS.letters + ' / ' + letters.length], ['Feather charm', P.feather ? 'Found' : 'Not yet'], ['Hits taken', STATS.hits]].map(r => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join('');
  $('clearOv').hidden = false; setTimeout(() => $('againBtn').focus(), 30);
}
function resetGame() {
  P.pos.set(START.x, START.y, START.z); P.prev.copy(P.pos); P.vel.set(0, 0, 0); P.yaw = START.yaw; P.prevYaw = P.yaw;
  Object.assign(P, { state: 'ground', open: false, dive: false, flareT: 0, tufts: 3, maxTufts: 3, pods: 0, inv: 0, web: null, hang: null, feather: false, noLift: 0, sporeT: 0, pulseCd: 0, goldenT: 0 });
  STATS.t = 0; STATS.pollen = [0, 0, 0]; STATS.golden = 0; STATS.letters = 0; STATS.hits = 0;
  motes.forEach(m => m.taken = false); goldens.forEach(g => { g.taken = false; g.seen = false; }); letters.forEach(l => l.taken = false);
  cps.forEach(c => { c.on = false; c.t = 0; }); checkpointCP = null; cpPods = 0; clearPlants(); heads.forEach(h => { h.ready = true; h.t = 0; });
  unlocked.clear(); unlocked.add('fern'); unlocked.add('puffcap'); lastPlant = 'fern';
  tiersSeen = new Set([1]); tierNow = 1; chimneyIntro = false; K.dropped = false; K.state = 'climb'; K.seq = 0; K.miss = 0; featherItem = null; SW.state = 'loop';
  activateCPSilent(cps[0]);
  cam.yaw = 0; cam.pitch = .34; cam.cut = null; snapCam();
}
function activateCPSilent(c) { c.on = true; c.t = 1; checkpointCP = c; cpPods = 0; }
function startGame() {
  Audio.init(); resetGame(); $('title').hidden = true; $('clearOv').hidden = true;
  mode = 'play'; iris(true); setTimeout(() => { iris(false); card('Thistledown Gorge', 'Dandelion Drift · Tier 1 · Mossy Floor'); setTimeout(() => { if (mode === 'play') say(['Welcome to Thistledown Gorge.', 'Read the signposts with E. Climb to the Old Oak crown at the rim and release your seed.'], 'Pip'); }, 1600); }, 60);
  stage.focus({ preventScroll: true });
}

/* ---------- keyboard ---------- */
let gpActive = false;
const MOVEK = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] };
function recalcKeys() { let x = 0, z = 0; for (const k in MOVEK) if (keys[k]) { x += MOVEK[k][0]; z += MOVEK[k][1]; } IN.kx = x; IN.kz = z; IN.camX = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0) + gcx; IN.camY = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0) + gcy; IN.kDive = !!keys.KeyC; IN.dive = IN.kDive || IN.mDive || IN.gDive || IN.tDive; IN.jump = !!keys.Space || gJump || tJump; IN.plant = !!keys.KeyE || gPlant || tPlant; }
let gcx = 0, gcy = 0, gJump = false, gPlant = false, tJump = false, tPlant = false;
addEventListener('keydown', e => {
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c) && (mode !== 'title' || document.activeElement === stage || document.activeElement === document.body)) { if (document.activeElement && document.activeElement.tagName === 'BUTTON' && (c === 'Space')) return; e.preventDefault(); }
  if (e.repeat) { keys[c] = true; return; }
  gpActive = false; Audio.init();
  if (mode === 'title') { if (c === 'Enter' || c === 'Space') { e.preventDefault(); startGame(); } return; }
  if (mode === 'talk') { if (c === 'Space' || c === 'KeyE' || c === 'Enter') { e.preventDefault(); advanceText(); } keys[c] = true; return; }
  if (mode === 'pause') { if (c === 'Escape' || c === 'KeyP') closePause(); return; }
  if (mode === 'clear') return;
  keys[c] = true;
  if (c === 'Space') IN.jumpP++;
  if (c === 'ShiftLeft' || c === 'ShiftRight') IN.closeP++;
  if (c === 'KeyE') IN.plantP++;
  if (c === 'KeyQ') IN.pulseP++;
  if (c === 'KeyR') IN.recenter = 1;
  if (c.startsWith('Digit')) { const n = +c.slice(5); if (n >= 1 && n <= 5) IN.num = n; }
  if (c === 'KeyM') { Audio.setMuted(!Audio.muted); renderSnd(); }
  if (c === 'KeyP' || c === 'Escape') openPause();
  recalcKeys();
});
addEventListener('keyup', e => { keys[e.code] = false; recalcKeys(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; IN.mDive = false; recalcKeys(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') openPause(); });

/* ---------- mouse: pointer lock look, right button dives ---------- */
let locked = false, dragging = false, lastMX = 0, lastMY = 0;
function exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} }
canvas.addEventListener('mousedown', e => {
  Audio.init();
  if (e.button === 2) { IN.mDive = true; recalcKeys(); e.preventDefault(); return; }
  if (mode !== 'play') return;
  if (!locked) { try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} }
  dragging = true; lastMX = e.clientX; lastMY = e.clientY;
});
addEventListener('mouseup', e => { if (e.button === 2) { IN.mDive = false; recalcKeys(); } else dragging = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
addEventListener('mousemove', e => {
  if (mode !== 'play') return;
  if (locked) { IN.mdx += e.movementX; IN.mdy += e.movementY; }
  else if (dragging) { IN.mdx += (e.clientX - lastMX) * 1.4; IN.mdy += (e.clientY - lastMY) * 1.4; lastMX = e.clientX; lastMY = e.clientY; }
});

/* ---------- gamepad ---------- */
let gpPrev = [];
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null;
  for (const g of pads) if (g && g.connected) { gp = g; break; }
  if (!gp) { if (IN.gx || IN.gz || gcx || gcy || IN.gDive || gJump || gPlant) { IN.gx = IN.gz = gcx = gcy = 0; IN.gDive = gJump = gPlant = false; recalcKeys(); } return; }
  const dz = v => Math.abs(v) < .18 ? 0 : (v - Math.sign(v) * .18) / .82;
  const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .3));
  const pressed = i => b(i) && !gpPrev[i];
  IN.gx = dz(gp.axes[0] || 0); IN.gz = -dz(gp.axes[1] || 0); gcx = dz(gp.axes[2] || 0); gcy = -dz(gp.axes[3] || 0);
  if (IN.gx || IN.gz || gcx || gcy || gp.buttons.some(x => x.pressed)) { if (!gpActive) { gpActive = true; hud.last = ''; } }
  if (mode === 'title') { if (pressed(0) || pressed(9)) startGame(); }
  else if (mode === 'talk') { if (pressed(0) || pressed(2)) advanceText(); }
  else if (mode === 'pause' || mode === 'clear') {
    const ov = mode === 'pause' ? $('pauseOv') : $('clearOv'), btns = [...ov.querySelectorAll('button')], i = btns.indexOf(document.activeElement);
    if (pressed(13) || (gp.axes[1] > .6 && !gpPrev.down)) (btns[(i + 1) % btns.length] || btns[0]).focus();
    if (pressed(12) || (gp.axes[1] < -.6 && !gpPrev.up)) (btns[(i - 1 + btns.length) % btns.length] || btns[0]).focus();
    if (pressed(0) && document.activeElement && btns.includes(document.activeElement)) document.activeElement.click();
    if (pressed(9) && mode === 'pause') closePause();
  } else if (mode === 'play' || mode === 'cut') {
    if (pressed(0)) IN.jumpP++;
    if (pressed(1)) IN.closeP++;
    if (pressed(2)) IN.plantP++;
    if (pressed(3)) IN.pulseP++;
    if (pressed(4) || pressed(5)) IN.recenter = 1;
    if (pressed(9)) openPause();
    if (pressed(14)) IN.num = 0;
  }
  gJump = b(0); gPlant = b(2); IN.gDive = b(7) || b(6);
  gpPrev = gp.buttons.map((x, i) => b(i)); gpPrev.down = gp.axes[1] > .6; gpPrev.up = gp.axes[1] < -.6;
  recalcKeys();
}

/* ---------- touch ---------- */
const touchOn = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const tptrs = new Map();
const tc = $('touch');
if (touchOn) tc.hidden = false;
tc.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  Audio.init(); e.preventDefault();
  const btn = e.target.closest('[data-t]');
  if (mode === 'title') { startGame(); return; }
  if (mode === 'talk') { advanceText(); return; }
  if (btn) {
    const k = btn.dataset.t; tptrs.set(e.pointerId, { kind: 'btn', k, el: btn }); btn.classList.add('down');
    if (k === 'a') { IN.jumpP++; tJump = true; } if (k === 'b') IN.closeP++; if (k === 'e') { IN.plantP++; tPlant = true; } if (k === 'q') IN.pulseP++; if (k === 'dive') IN.tDive = true; if (k === 'pause') openPause(); if (k === 'cam') IN.recenter = 1;
    recalcKeys(); return;
  }
  const r = tc.getBoundingClientRect();
  if (e.clientX - r.left < r.width * .45 && ![...tptrs.values()].some(p => p.kind === 'stick')) { tptrs.set(e.pointerId, { kind: 'stick', ox: e.clientX, oy: e.clientY }); const base = $('stickBase'); base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px'; base.hidden = false; }
  else tptrs.set(e.pointerId, { kind: 'cam', x: e.clientX, y: e.clientY });
});
addEventListener('pointermove', e => {
  const p = tptrs.get(e.pointerId); if (!p) return;
  if (p.kind === 'stick') { let dx = (e.clientX - p.ox) / 48, dy = (e.clientY - p.oy) / 48; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } IN.tx = dx; IN.tz = -dy; $('stickKnob').style.transform = 'translate(' + dx * 34 + 'px,' + dy * 34 + 'px)'; }
  else if (p.kind === 'cam') { IN.mdx += (e.clientX - p.x) * 2.2; IN.mdy += (e.clientY - p.y) * 2; p.x = e.clientX; p.y = e.clientY; }
}, { passive: true });
const tEnd = e => {
  const p = tptrs.get(e.pointerId); if (!p) return; tptrs.delete(e.pointerId);
  if (p.kind === 'stick') { IN.tx = IN.tz = 0; $('stickBase').hidden = true; $('stickKnob').style.transform = ''; }
  if (p.kind === 'btn') { p.el.classList.remove('down'); if (p.k === 'a') tJump = false; if (p.k === 'e') tPlant = false; if (p.k === 'dive') IN.tDive = false; recalcKeys(); }
};
addEventListener('pointerup', tEnd); addEventListener('pointercancel', tEnd);

/* ---------- buttons ---------- */
function renderSnd() { $('sndBtn').textContent = Audio.muted ? 'Sound off' : 'Sound on'; $('sndBtn').setAttribute('aria-pressed', String(!Audio.muted)); }
renderSnd();
$('sndBtn').onclick = () => { Audio.init(); Audio.setMuted(!Audio.muted); renderSnd(); };
$('fsBtn').onclick = () => { try { const r = stage.requestFullscreen ? stage.requestFullscreen() : null; if (r && r.catch) r.catch(() => {}); } catch (e) {} };
$('startBtn').onclick = startGame;
$('resumeBtn').onclick = closePause;
$('cpBtn').onclick = () => { closePause(); iris(true, () => { respawnCP(); iris(false); }); };
$('quitBtn').onclick = () => { $('pauseOv').hidden = true; mode = 'title'; $('title').hidden = false; $('hud').hidden = true; setTimeout(() => $('startBtn').focus(), 30); };
$('againBtn').onclick = () => { $('clearOv').hidden = true; startGame(); };
$('roamBtn').onclick = () => { $('clearOv').hidden = true; mode = 'play'; P.state = 'ground'; cam.cut = null; snapCam(); };
const toggle = (k) => { OPT[k] = !OPT[k]; saveOpt(); syncOpts(); if (k === 'sharp') resize(); };
$('optAssist').onclick = () => toggle('assist'); $('optTilt').onclick = () => toggle('tilt'); $('optSharp').onclick = () => toggle('sharp'); $('optDither').onclick = () => toggle('dither');
$('optMus').onclick = () => { Audio.init(); Audio.setMus(!Audio.musOn); syncOpts(); }; $('optSfx').onclick = () => { Audio.init(); Audio.setSfx(!Audio.sfxOn); syncOpts(); };
$('pauseTouch').onclick = openPause;

/* ---------- resolution: 240-line output scaled up, like the console ---------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  let sc = OPT.sharp ? Math.min(2, devicePixelRatio || 1) : clamp(240 / h, .2, 1);
  R.resize(Math.max(64, Math.round(w * sc)), Math.max(48, Math.round(h * sc)));
  canvas.classList.toggle('lowres', !OPT.sharp);
}
new ResizeObserver(resize).observe(stage); resize();

/* ---------- main loop ---------- */
let last = performance.now(), acc = 0, typeAcc = 0;
function frame(now) {
  const raw = clamp((now - last) / 1000, 0, .25); last = now; const dt = Math.min(raw, .05);
  pollPad();
  if (mode === 'talk') {
    typeAcc += dt * 55; const line = TB.lines[TB.i] || '';
    while (typeAcc >= 1 && TB.shown < line.length) { TB.shown++; typeAcc -= 1; if (TB.shown % 3 === 0) Audio.blip(); }
    if (TB.shown >= line.length) typeAcc = 0;
    $('tbText').textContent = line.slice(0, TB.shown); $('tbMore').classList.toggle('on', TB.shown >= line.length);
  }
  if (mode !== 'pause' && mode !== 'clear') {
    acc += raw; let n = 0;
    while (acc >= STEP && n < 10) { step(STEP); acc -= STEP; n++; }
    if (n >= 10) acc = 0;
  }
  render(clamp(acc / STEP, 0, 1), dt);
  renderHUD();
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on'); }
  if (flashT > 0) { flashT -= dt; $('flash').classList.add('on'); } else $('flash').classList.remove('on');
  $('spores').classList.toggle('on', P.sporeT > 0 && mode === 'play');
  $('kwarn').classList.toggle('on', K.state === 'warn' && mode === 'play');
  if (touchOn) { const show = mode === 'play' || mode === 'talk' || mode === 'cut'; if (tc.hidden === show) tc.hidden = !show; }
  let buzz = 0; for (const m of SW.members) { const d = m.pos.dist(P.pos); buzz = Math.max(buzz, clamp(1 - d / (SW.state === 'chase' ? 22 : 14), 0, 1) * (SW.state === 'chase' ? 1 : .4)); }
  Audio.update(mode === 'play' ? 'play' : 'menu', P.vel.len(), buzz, P.open);
  Audio.music(mode === 'title' ? 1 : tierNow, (K.state === 'warn' || K.state === 'stoop' || SW.state === 'chase') && mode === 'play');
  requestAnimationFrame(frame);
}
resetGame(); mode = 'title';
$('moteCount').textContent = motes.length + ' pollen';
setTimeout(() => $('startBtn').focus({ preventScroll: true }), 50);
requestAnimationFrame(frame);



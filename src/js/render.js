'use strict';
if (!R) throw new Error('WebGL unavailable');
/* ===================== CAMERA + RENDER ===================== */
const FOCUS = new V3(), WANT = new V3(), LOOK = new V3(), TV = new V3();
function snapCam() {
  RP.copy(P.pos); RYaw = P.yaw;
  FOCUS.set(RP.x, RP.y + 1, RP.z);
  cam.pos.set(FOCUS.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, FOCUS.y + Math.sin(cam.pitch) * cam.dist, FOCUS.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
  const t = rayClear(FOCUS, cam.pos); if (t < 1) cam.pos.sub(FOCUS).scale(Math.max(.1, t - .02)).add(FOCUS);
  cam.look.copy(FOCUS);
}
const CUTS = {
  chimney: { dur: 6.5, keys: [[0, [1, 27, 10], [0, 32, -20]], [2.2, [2, 46, 9], [-2, 55, -22]], [4.2, [0, 70, 10], [-5, 70, -18]], [6.5, [2, 30, 4], [0, 26, -14]]] },
};
function cutCamera(dt) {
  const c = cam.cut; c.t += dt;
  if (c.kind === 'finale') {
    const a = c.t * .35 + 1, r = 11 - Math.min(c.t, 4) * .6;
    cam.pos.set(GOAL.x + Math.cos(a) * r, GOAL.y + 4 + c.t * .7, GOAL.z + Math.sin(a) * r);
    cam.look.set(GOAL.x, GOAL.y + 1.5 + c.t * 1.4, GOAL.z);
  } else {
    const cut = CUTS[c.kind], ks = cut.keys; let i = 0; while (i < ks.length - 2 && c.t > ks[i + 1][0]) i++;
    const a = ks[i], b = ks[i + 1], t = smooth(0, 1, (c.t - a[0]) / (b[0] - a[0]));
    cam.pos.set(lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t));
    cam.look.set(lerp(a[2][0], b[2][0], t), lerp(a[2][1], b[2][1], t), lerp(a[2][2], b[2][2], t));
    if (c.t >= cut.dur || IN.jumpP || IN.plantP) { IN.jumpP = 0; IN.plantP = 0; cam.cut = null; mode = 'play'; cam.yaw = wrapA(P.yaw + Math.PI); snapCam(); if (c.kind === 'chimney') say(['Steam on the right, gusts from the crack on the left, wasps on their loop.', 'The pollen trail curves left. Follow it.'], 'The Wasp Chimney'); }
  }
  M4.lookAt(R.view, cam.pos, cam.look);
}
let titleA = 0;
function updateCamera(dt) {
  if (mode === 'title') {
    titleA += dt * .05; const a = titleA;
    cam.pos.set(-8 + Math.sin(a) * 22, 58 + Math.sin(a * 1.3) * 10, 62 + Math.cos(a) * 10); cam.look.set(6 + Math.sin(a * .7) * 8, 72, -22);
    M4.lookAt(R.view, cam.pos, cam.look); R.setFov(1.05); return;
  }
  if (cam.cut) { cutCamera(dt); return; }
  const radialOpen = radial.open;
  const mx = IN.camX * 2.3 * dt + (radialOpen ? 0 : IN.mdx * .0045), my = IN.camY * 1.5 * dt + (radialOpen ? 0 : IN.mdy * .0035);
  if (!radialOpen) { IN.mdx = 0; IN.mdy = 0; }
  if (Math.abs(mx) > 1e-5) { cam.yaw -= mx; cam.manualT = 0; } else cam.manualT += dt;
  if (Math.abs(my) > 1e-5) { cam.pitch = clamp(cam.pitch + my, -.3, 1.25); cam.pitchManualT = 0; } else cam.pitchManualT += dt;
  if (IN.recenter) { IN.recenter = 0; cam.recenterT = .35; }
  const behind = RYaw + Math.PI;
  if (cam.recenterT > 0) { cam.recenterT -= dt; cam.yaw = turnToward(cam.yaw, behind, 10 * dt); }
  else if (cam.manualT > 1.1 && (mode === 'play') && P.state !== 'hang') {
    const sp = Math.hypot(P.vel.x, P.vel.z), air = P.state === 'air';
    const towardCam = Math.sin(RYaw) * Math.sin(cam.yaw) + Math.cos(RYaw) * Math.cos(cam.yaw);   // >0 means running at the camera
    if (towardCam < .35) cam.yaw = turnToward(cam.yaw, behind, (air ? 1.1 : .7) * clamp(sp / 6, 0, 1.4) * dt);
  }
  if (P.state === 'hang' && cam.manualT > .4) cam.yaw = turnToward(cam.yaw, behind, 2.5 * dt);
  const lift = OPT.tilt ? P.inLift : 0;
  const pT = P.dive ? .5 : P.state === 'air' && P.open ? .26 : .34;
  if (cam.pitchManualT > 1.5) cam.pitch += ((pT - lift * .32) - cam.pitch) * Math.min(1, 1.6 * dt);
  const dist = (P.state === 'air' ? 9 : 7.4) + lift * 2.2 + (P.dive ? 1.5 : 0);
  cam.dist += (dist - cam.dist) * Math.min(1, 2 * dt);
  FOCUS.set(RP.x, RP.y + 1, RP.z);
  WANT.set(FOCUS.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, FOCUS.y + Math.sin(cam.pitch) * cam.dist + .3, FOCUS.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
  let t = rayClear(FOCUS, WANT); if (t < 1) WANT.sub(FOCUS).scale(Math.max(.1, t - .02)).add(FOCUS);
  cam.pos.lerp(WANT, 1 - Math.exp(-9 * dt));
  t = rayClear(FOCUS, cam.pos); if (t < 1) cam.pos.sub(FOCUS).scale(Math.max(.1, t - .02)).add(FOCUS);
  LOOK.set(FOCUS.x, FOCUS.y + .25 + lift * 3.5, FOCUS.z);
  cam.look.lerp(LOOK, 1 - Math.exp(-12 * dt));
  TV.copy(cam.pos);
  if (cam.shake > 0) { cam.shake -= dt; const s = Math.min(cam.shake, .5) * .35; TV.x += rf(-1, 1) * s; TV.y += rf(-1, 1) * s; }
  M4.lookAt(R.view, TV, cam.look);
  const f = P.dive ? 1.2 : 1.05; cam.fov += (f - cam.fov) * Math.min(1, 3 * dt); R.setFov(cam.fov);
}

const S = new MStack();
const EASE = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const FEATHER_TINT = [1, .9, .76];
function drawPip(t) {
  const p = P, st = p.state, air = st === 'air', open = air && (p.open || p.flareT > 0), hang = st === 'hang', ground = st === 'ground' || st === 'goal';
  if (st === 'caught') return;
  if (p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0 && mode === 'play') return;
  const sp = Math.hypot(p.vel.x, p.vel.z), run = ground ? clamp(sp / 6, 0, 1) : 0, ph = p.anim * 2.2;
  const bob = ground ? Math.abs(Math.sin(ph)) * .07 * run : 0;
  const sq = p.landSq > 0 ? p.landSq : 0;
  S.reset().t(RP.x, RP.y, RP.z).rY(RYaw);
  if (p.dive) { S.t(0, .6, 0).rX(1.15).t(0, -.6, 0); }
  if (st === 'web') S.rZ(Math.sin(t * 20) * p.struggle * .3);
  S.s3(1 + sq * .4, 1 - sq, 1 + sq * .4);
  S.push().t(0, .62 + bob, 0).rX(ground ? run * .25 : open ? -.05 : .12);
  R.draw(M.pipBody, S.top);
  S.push().t(0, .36, .12).rX(hang ? -.5 : open ? -.25 : -.05).rZ(ground ? Math.sin(ph) * .05 * run : 0); R.draw(M.pipHead, S.top); S.pop();
  for (const s of [-1, 1]) {
    S.push().t(s * .21, .12, .06);
    if (open || hang || st === 'web') S.rX(-2.85).rZ(-s * .18);
    else if (p.dive) S.rX(.4).rZ(s * .3);
    else if (ground && st !== 'goal') S.rX(Math.sin(ph + (s > 0 ? 0 : Math.PI)) * .9 * run);
    else if (st === 'goal') S.rX(-2.6 - Math.sin(t * 6) * .2).rZ(-s * .4);
    else S.rX(-.7 - Math.sin(t * 18) * .3).rZ(s * .6);
    R.draw(M.pipArm, S.top); S.pop();
    S.push().t(s * .12, -.2, -.12);
    if (ground) S.rX(Math.sin(ph + (s > 0 ? Math.PI : 0)) * 1.0 * run);
    else if (open || hang) S.rX(.2 + Math.sin(t * 3 + s) * .15);
    else S.rX(-.6);
    R.draw(M.pipLeg, S.top); S.pop();
  }
  const tint = p.feather ? FEATHER_TINT : null;
  if (st !== 'goal') {
    if (open || st === 'web') { S.push().t(0, .45, .1); R.draw(M.stem, S.top); S.t(0, 1.55, 0); const k = p.flareT > 0 ? .8 : 1; S.s3(k, k, k); R.draw(M.puffOpen, S.top, tint, 1, .15); S.pop(); }
    else if (hang) { S.push().t(0, .25, -.33).rX(-.2).s3(.7, .7, .7); R.draw(M.stem, S.top); S.t(0, 1.55, 0); R.draw(M.puffClosed, S.top, tint); S.pop(); }
    else if (p.dive) { S.push().t(0, .2, -.25).rX(-2.3).s3(.8, .8, .8); R.draw(M.stem, S.top); S.t(0, 1.55, 0); R.draw(M.puffClosed, S.top, tint); S.pop(); }
    else if (air) { S.push().t(0, .45, .1).s3(.75, .75, .75); R.draw(M.stem, S.top); S.t(0, 1.55, 0); R.draw(M.puffClosed, S.top, tint); S.pop(); }
    else { S.push().t(.05, .25, -.33).rX(-.35).s3(.72, .72, .72); R.draw(M.stem, S.top); S.t(0, 1.55, 0); R.draw(M.puffClosed, S.top, tint); S.pop(); }
  }
  S.pop();
}

function render(alpha, dt) {
  RP.lerpV(P.prev, P.pos, alpha); RYaw = P.prevYaw + wrapA(P.yaw - P.prevYaw) * alpha;
  if (P.landSq > 0) P.landSq -= dt;
  updateCamera(dt);
  const t = worldT;
  R.dither = OPT.dither ? 1 : 0; R.cloudOn = 1; R.cloud = [cloudX, -18, 15, .45];
  R.begin(R.fogC);
  // sky
  gl.depthMask(false); R.cull(false); S.reset().t(cam.pos.x, cam.pos.y - 40, cam.pos.z).s3(380, 300, 380); R.draw(M.sky, S.top, null, 1, 0, 1); R.cull(true); gl.depthMask(true);
  R.draw(WORLD);
  // clouds
  for (const [x, y, z, s] of [[-120, 170, -160, 5], [90, 190, -190, 6], [-60, 210, 120, 4], [150, 160, 40, 5], [10, 230, -260, 7]]) { S.reset().t(x, y, z).s3(s, s * .8, s); R.draw(M.cloud, S.top, null, 1, .35); }
  S.reset().t(cloudX, 128, -18).s3(2.4, 1.6, 2.2); R.draw(M.cloud, S.top, null, 1, .3);
  // checkpoints
  for (const c of cps) { S.reset().t(c.x, c.y, c.z); if (c.on) { c.t = Math.min(1, c.t + dt * 2); const k = EASE(c.t); S.s3(1, k, 1).rY(t * .5); R.draw(M.cpBloom, S.top, null, 1, .15); } else { S.rZ(Math.sin(t * 2 + c.x) * .06); R.draw(M.cpBud, S.top); } }
  // seed heads
  for (const hd of heads) { S.reset().t(hd.x, hd.y, hd.z); const k = hd.ready ? 1 : 1 - clamp(hd.t / 10, 0, 1) * .6; S.rZ(Math.sin(t * 1.5 + hd.x) * .05); R.draw(hd.ready ? M.seedHead : M.seedBare, S.top, null, 1, hd.ready ? .1 : 0); if (!hd.ready && hd.t < 2) { S.s3(k, k, k); } }
  // plants on patches
  for (const pt of patches) {
    const pl = pt.plant; if (!pl) continue;
    const g = EASE(clamp(pl.grow, 0, 1)); S.reset().t(pt.x, pt.y, pt.z);
    if (pl.type === 'fern') { S.s3(g * 1.25, g * 1.25, g * 1.25).rY(t * .8); S.rZ(Math.sin(t * 7) * .04); R.draw(M.fern, S.top); }
    else if (pl.type === 'sunpod') { S.s3(g, g, g); R.draw(M.sunpod, S.top); R.draw(M.sunGlow, S.top, null, 1, pl.sun ? .9 + Math.sin(t * 6) * .2 : 0); }
    else if (pl.type === 'puffcap') { const s = pl.sq > 0 ? 1 - Math.sin(pl.sq / .35 * Math.PI) * .35 : 1; S.s3(g / Math.sqrt(s), g * s, g / Math.sqrt(s)); R.draw(M.puffcap, S.top, pl.cd > 0 ? [.75, .75, .8] : null); }
    else if (pl.type === 'windbell') { S.s3(g * 1.3, g * 1.3, g * 1.3).rZ(pl.wind ? Math.sin(t * 9) * .12 - .15 : Math.sin(t * 2) * .05); R.draw(M.windbell, S.top, null, 1, pl.wind ? .25 : 0); }
    else if (pl.type === 'bramble') { S.s3(g, g, g); R.draw(M.bramble, S.top); }
  }
  for (const c of natCaps) { const s = c.sq > 0 ? 1 - Math.sin(c.sq / .35 * Math.PI) * .35 : 1; S.reset().t(c.x, c.y, c.z).s3(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); R.draw(M.natcap, S.top, c.cd > 0 ? [.8, .75, .75] : null); }
  for (const b of puffballs) { if (b.gone > 1) continue; const k = b.gone > 0 ? 1 - b.gone : 1 + Math.sin(b.t * 2.4) * .07; S.reset().t(b.x, b.y, b.z).s3(b.r * k, b.r * k * (1 + Math.sin(b.t * 2.4 + 1) * .05), b.r * k); R.draw(M.puffball, S.top); }
  for (const pc of pitchers) { if (pc.caught > 0) { /* gulp */ } }
  // wasp nest + wasps
  S.reset().t(-3.5, 58.3, -22).rZ(Math.sin(t * 1.3) * .03); R.draw(M.nest, S.top, SW.state === 'chase' ? [1.25, .8, .45] : null, 1, SW.state === 'chase' ? .5 + Math.sin(t * 12) * .2 : 0);
  for (const m of SW.members) { TV.lerpV(m.prev, m.pos, alpha); S.reset().t(TV.x, TV.y + Math.sin(t * 9 + m.ph) * .08, TV.z).rY(Math.atan2(m.vel.x, m.vel.z)).rX(-Math.atan2(m.vel.y, Math.hypot(m.vel.x, m.vel.z) + .01) * .6).s3(1.15); R.draw(M.wasp, S.top); m.mt = new Float32Array(S.top); }
  // dragonfly
  TV.lerpV(DF.prev, DF.pos, alpha); S.reset().t(TV.x, TV.y + Math.sin(t * 3) * .1, TV.z).rY(DF.yaw).s3(1.3); R.draw(M.dragon, S.top, null, 1, DF.state === 'flash' ? .8 : 0); const dfM = new Float32Array(S.top);
  // kestrel
  TV.lerpV(K.prev, K.pos, alpha); S.reset().t(TV.x, TV.y, TV.z).rY(K.yaw).rX(-K.pitch * .8); R.draw(M.kestrel, S.top); const kM = new Float32Array(S.top);
  // spiders on webs
  for (const w of webs) { if (w.broken > 0) continue; const sp = P.web === w && w.spPos ? w.spPos : [w.x + Math.cos(w.yaw) * (w.w / 2 - .5), w.y + w.h / 2 - .4, w.z - Math.sin(w.yaw) * (w.w / 2 - .5)]; S.reset().t(sp[0], sp[1], sp[2]).rY(w.yaw).rX(.4); R.draw(M.spider, S.top); }
  // collectables
  for (const g of goldens) { if (g.taken) continue; S.reset().t(g.x, g.y + Math.sin(t * 2) * .2, g.z).rY(t * 1.6); R.draw(M.golden, S.top, null, 1, .45); }
  for (const l of letters) { if (l.taken) continue; S.reset().t(l.x, l.y + Math.sin(t * 2.2) * .12, l.z).rY(t * 1.2).rZ(.2); R.draw(M.letter, S.top, null, 1, .25); }
  if (featherItem) { S.reset().t(featherItem.x, featherItem.y, featherItem.z).rZ(Math.sin(featherItem.t * 2) * .6).rY(featherItem.t); R.draw(M.feather, S.top, null, 1, .3); }
  // Pip
  if (mode !== 'title') drawPip(t);
  if (P.state === 'goal' && cam.cut) { const k = cam.cut.t; S.reset().t(GOAL.x + Math.sin(k * 1.3) * k * .4, GOAL.y + 2 + k * 2.2, GOAL.z + Math.cos(k) * .4).rZ(Math.sin(k * 2) * .2); R.draw(M.stem, S.top); S.t(0, 1.55, 0); R.draw(M.puffOpen, S.top, P.feather ? FEATHER_TINT : null, 1, .3); }

  /* ---- translucent pass ---- */
  R.blend(true);
  R.draw(WORLDX, undefined, null, .72, .15);
  // blob shadow
  if (mode !== 'title' && P.state !== 'caught') {
    const g = groundUnder(RP.x, RP.z, RP.y + .3), gy = g ? g.top : 0, hgt = RP.y - gy;
    S.reset().t(RP.x, gy + .04, RP.z).s3(.55 + Math.min(hgt * .02, .5)); R.draw(M.shadow, S.top, null, clamp(.45 - hgt * .01, .12, .45));
    if (K.state === 'warn') { const k = 1 - clamp(K.t / (OPT.assist ? TUNE.kWarnAssist : TUNE.kWarn), 0, 1); S.reset().t(RP.x + 1.2 - k * 1.2, gy + .06, RP.z + 1.5 - k * 1.5).s3(1 + k * 3.5, 1, .6 + k * 2.2); R.draw(M.shadow, S.top, null, .2 + k * .4); }
  }
  // lift columns (very faint)
  const colTint = { steam: [1, 1, 1], rock: [1, .8, .5], branch: [.85, 1, .8], fern: [.75, 1, .7], sun: [1, .85, .45], bell: [.7, .85, 1] };
  for (const arr of [lifts, plantLifts]) for (const l of arr) { if (!l.on) continue; if (Math.hypot(l.x - cam.pos.x, l.z - cam.pos.z) > 160) continue; S.reset().t(l.x, l.y0, l.z).s3(l.r, l.y1 - l.y0 + 1, l.r); R.cull(false); R.draw(M.column, S.top, colTint[l.kind] || [1, 1, 1], .05, 1, 1); R.cull(true); }
  // webs
  R.cull(false);
  for (const w of webs) { if (w.broken > 0) continue; S.reset().t(w.x, w.y, w.z).rY(w.yaw); R.draw(w.mesh, S.top, null, .6, .6); }
  // wings
  for (const m of SW.members) { if (!m.mt) continue; for (const s of [-1, 1]) { S.reset(); S.top.set(m.mt); S.t(s * .12, .2, .3).rZ(s * (.4 + Math.sin(t * 70 + m.ph) * .5)).s3(s, 1, 1); R.draw(M.wing, S.top, null, .55, .5); } }
  for (const s of [-1, 1]) for (const z of [.55, .25]) { S.reset(); S.top.set(dfM); S.t(s * .15, .15, z).rZ(s * Math.sin(t * 50 + z * 9) * .35).s3(s, 1, 1); R.draw(M.dWing, S.top, null, DF.state === 'flash' ? .95 : .5, DF.state === 'flash' ? 1 : .4); }
  for (const s of [-1, 1]) { const fl = K.state === 'stoop' ? .25 : K.state === 'warn' ? Math.sin(K.flap * 14) * .5 : Math.sin(K.flap * 3) * .35 + .05; S.reset(); S.top.set(kM); S.t(s * .7, .3, .3).s3(s, 1, 1).rZ(fl * (K.state === 'stoop' ? 1 : 1) + (K.state === 'stoop' ? .9 : 0)); R.draw(M.kWing, S.top, null, 1, 0); }
  R.cull(true);
  // pulse ring
  if (P.pulseT > 0) { const k = 1 - P.pulseT / .5; S.reset().t(RP.x, RP.y + .6, RP.z).s3(1 + k * 8, 1 + k * 3, 1 + k * 8); R.cull(false); R.draw(M.ring, S.top, [.85, .95, 1], (1 - k) * .7, 1, 1); R.cull(true); }
  R.blend(false);

  /* ---- points ---- */
  PB.clear();
  const cx = cam.pos.x, cz = cam.pos.z, cy = cam.pos.y;
  for (const m of motes) { if (m.taken) continue; const dx = m.x - cx, dz = m.z - cz, dy = m.y - cy; if (dx * dx + dz * dz + dy * dy > 120 * 120) continue; PB.add(m.x, m.y + Math.sin(t * 3 + m.x + m.z) * .12, m.z, 1, .82, .2, 1, .62); }
  for (const arr of [lifts, plantLifts]) for (const l of arr) {
    if (!l.on || Math.hypot(l.x - cx, l.z - cz) > 140) continue;
    const H = l.y1 - l.y0, n = Math.min(46, H * 1.5 | 0), sp = l.kind === 'steam' ? 4.5 : l.kind === 'sun' ? 5.5 : 4;
    for (let i = 0; i < n; i++) {
      const f = ((i * .6180339 + t * sp / H) % 1), a = i * 2.399 + t * 1.3, rad = l.r * (.2 + .75 * ((i * .37) % 1));
      const x = l.x + Math.cos(a) * rad, y = l.y0 + f * H, z = l.z + Math.sin(a) * rad, fade = Math.sin(f * Math.PI);
      if (l.kind === 'steam') PB.add(x, y, z, 1, 1, 1, .32 * fade, 1.5);
      else if (l.kind === 'rock') PB.add(x, y, z, 1, .78, .5, .4 * fade, .55);
      else if (l.kind === 'sun') PB.add(x, y, z, 1, .85, .35, .55 * fade, .6);
      else if (l.kind === 'bell') PB.add(x, y, z, .7, .85, 1, .55 * fade, .5);
      else PB.add(x, y, z, .85, 1, .7, .5 * fade, .45);
    }
  }
  for (const w of winds) {
    if (!(w.active || w.tele)) continue; const n = w.active ? 36 : 8, lx = w.x1 - w.x0, lz = w.z1 - w.z0, len = Math.abs(w.dx) ? lx : lz;
    for (let i = 0; i < n; i++) {
      const f = (i * .618 + t * w.speed / len * 1.5) % 1, u = (i * .754) % 1, v = (i * .371) % 1;
      const x = w.dx ? (w.dx > 0 ? w.x0 + f * lx : w.x1 - f * lx) : w.x0 + u * lx, z = w.dz ? (w.dz > 0 ? w.z0 + f * lz : w.z1 - f * lz) : w.z0 + u * lz, y = w.y0 + v * (w.y1 - w.y0);
      for (let k = 0; k < 3; k++) PB.add(x - w.dx * k * .5, y, z - w.dz * k * .5, 1, 1, 1, (w.active ? .4 : .2) * (1 - k * .3), .3);
    }
  }
  for (const tb of turbs) for (let i = 0; i < 80; i++) { const a = t * (2 + (i % 5) * .4) + i * 1.7, r = tb.R * (.3 + (i * .13) % .7), yy = tb.y0 + ((i * .618 + Math.sin(t * .7 + i) * .05) % 1) * (tb.y1 - tb.y0); PB.add(tb.x + Math.cos(a) * r, yy + Math.sin(t * 3 + i) * .6, tb.z + Math.sin(a) * r, i % 3 ? .95 : .6, i % 3 ? .9 : .85, i % 3 ? .55 : .3, .6, i % 3 ? .3 : .45); }
  for (const d of downs) for (let i = 0; i < 30; i++) { const f = 1 - ((i * .618 + t * .25) % 1), a = i * 2.4; PB.add(d.x + Math.cos(a) * d.r * ((i * .37) % 1), d.y0 + f * (d.y1 - d.y0), d.z + Math.sin(a) * d.r * ((i * .37) % 1), .55, .52, .5, .45, .35); }
  for (const s of sundews) for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, dd = s.r * (.3 + (i * .37) % .5); PB.add(s.x + Math.cos(a) * dd, s.y + 1.15, s.z + Math.sin(a) * dd, 1, .7 + .3 * Math.sin(t * 4 + i), .8, .9, .22); }
  for (const g of goldens) { if (g.taken) continue; for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.26; PB.add(g.x + Math.cos(a) * 1.4, g.y + .6 + Math.sin(t * 3 + i) * .6, g.z + Math.sin(a) * 1.4, 1, .95, .5, .9, .3); } }
  const ctx = mode === 'play' ? context() : null;
  if (ctx && ctx.act === 'patch') { const pt = ctx.pt; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + t; PB.add(pt.x + Math.cos(a) * 1.8, pt.y + .3 + Math.sin(t * 4 + i) * .1, pt.z + Math.sin(a) * 1.8, .6, 1, .5, .8, .25); } }
  for (const pc of pitchers) for (let i = 0; i < 14; i++) { const f = (i * .618 + t * .6) % 1, a = i * 2.4; PB.add(pc.x + Math.cos(a) * pc.r * (1 - f), pc.my + Math.sin(i) * .8 * (1 - f), pc.z + Math.sin(a) * pc.r * (1 - f), 1, .75, .8, .35 * f, .2); }
  if (SHORTCUT.on) { const l = SHORTCUT; for (let i = 0; i < 30; i++) { const f = (i * .618 + t * .1) % 1; PB.add(l.x + Math.cos(i * 2.4) * l.r * .7, l.y0 + f * (l.y1 - l.y0), l.z + Math.sin(i * 2.4) * l.r * .7, 1, 1, 1, .3, 1.4); } }
  for (const pt of parts) PB.add(pt.x, pt.y, pt.z, pt.col[0], pt.col[1], pt.col[2], pt.col[3] * clamp(pt.life / pt.max * 1.5, 0, 1), pt.size);
  if (P.sporeT > 0) for (let i = 0; i < 20; i++) { const a = i * 2.4 + t, r = 1 + (i % 4) * .4; PB.add(RP.x + Math.cos(a) * r, RP.y + .6 + Math.sin(t * 2 + i) * .8, RP.z + Math.sin(a) * r, .7, .85, .4, .6, .5); }
  R.points(PB.d, PB.n, false);
}


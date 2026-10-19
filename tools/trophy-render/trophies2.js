// Second pass: an abstract armillary for Pick'em, a crystal spade with the team chip for Survivor, and a unique engraved base for each trophy.
import { THREE, RoundedBoxGeometry, profile, revolveMod, mesh, beadRing, engravingBand, marbleTexture, leafGeometry, laurel, fbm } from "/lib.js";
import { chipTexture } from "/trophies.js";

/** Re-tone every gold part of a trophy as platinum: bright by default, dark smoky platinum on meshes tagged userData.smoky. */
function toPlatinum(group) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (mat) => {
      if (!(mat.metalness === 1 && mat.color && mat.color.r - mat.color.b > 0.25)) return mat;
      const p = mat.clone();
      if (o.userData.smoky) { p.color = new THREE.Color(0x55585f); p.roughness = 0.3; p.clearcoat = 0.4; p.clearcoatRoughness = 0.15; }
      else { p.color = new THREE.Color(0xe4e4e8); p.roughness = Math.max(0.14, mat.roughness); }
      return p;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}
const smoky = (o) => { o.userData.smoky = true; o.traverse?.((c) => { c.userData.smoky = true; }); return o; };
/** Subtle topographic contour lines, used as a bump map so polished stone carries faint, irregular waves. */
let topoCache = null;
function topoTexture(ru = 1, rv = 1) {
  if (topoCache) { const c2 = topoCache.clone(); c2.repeat.set(ru, rv); c2.needsUpdate = true; return c2; }
  const size = 1024, c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = fbm(x / size * 2.6 + 7, y / size * 2.6 + 3, 5) * 9;
    const f = v - Math.floor(v), line = Math.exp(-Math.pow((f - 0.5) / 0.06, 2));
    const shade = 120 + 60 * Math.sin(v * 0.7) + 70 * line;
    const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = shade; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  topoCache = new THREE.CanvasTexture(c); topoCache.wrapS = topoCache.wrapT = THREE.RepeatWrapping; return topoTexture(ru, rv);
}
/** The champions to engrave, newest first, per pool: window.__champions (set by the renderer from its champions file) or last year's three. */
const DEFAULT_CHAMPIONS = { pickem: [{ year: "2025", name: "STEVE" }], bowl: [{ year: "2025", name: "AL" }], survivor: [{ year: "2025", name: "JOHN" }] };
const championsFor = (pool) => (typeof window !== "undefined" && window.__champions?.[pool]) || DEFAULT_CHAMPIONS[pool];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- the inscription plate: a title and ruled lines left blank for the winners' names
/**
 * A champion's plaque: a small gold cartouche (concave corners, a rounded boss at each end), edged with a rope moulding, rivetted
 * at the corners, with the year and name engraved in dark brass inside a double keyline and corner flourishes.
 * Only champions get a plaque; the next winner's plaque is added beside the last.
 */
function cartoucheShape(w, h) {
  const hw = w / 2, hh = h / 2, c = Math.min(h * 0.26, w * 0.1), bump = h * 0.2, s = new THREE.Shape();
  s.moveTo(-hw + c, -hh); s.lineTo(hw - c, -hh);
  s.absarc(hw, -hh, c, Math.PI, Math.PI / 2, true);
  s.lineTo(hw, -bump); s.absarc(hw, 0, bump, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(hw, hh - c); s.absarc(hw, hh, c, -Math.PI / 2, -Math.PI, true);
  s.lineTo(-hw + c, hh); s.absarc(-hw, hh, c, 0, -Math.PI / 2, true);
  s.lineTo(-hw, bump); s.absarc(-hw, 0, bump, Math.PI / 2, Math.PI * 1.5, false);
  s.lineTo(-hw, -hh + c); s.absarc(-hw, -hh, c, Math.PI / 2, 0, true);
  return s;
}
function plaqueTexture(year, name, aspect, tall = 640) {
  const height = tall, width = Math.round(tall * aspect);
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, width, height);
  g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineCap = "round";
  const m1 = height * 0.14, m2 = height * 0.2, r = height * 0.1;
  g.lineWidth = height * 0.028; g.beginPath(); g.roundRect(m1, m1, width - 2 * m1, height - 2 * m1, r); g.stroke();
  g.lineWidth = height * 0.011; g.beginPath(); g.roundRect(m2, m2, width - 2 * m2, height - 2 * m2, r * 0.6); g.stroke();
  // corner flourishes: a small scroll curling into each corner of the inner keyline
  g.lineWidth = height * 0.014;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const cx = width / 2 + sx * (width / 2 - m2 - height * 0.075), cy = height / 2 + sy * (height / 2 - m2 - height * 0.075);
    g.beginPath(); g.arc(cx, cy, height * 0.04, 0, Math.PI * 1.6); g.stroke();
    g.beginPath(); g.arc(cx, cy, height * 0.009, 0, Math.PI * 2); g.fill();
  }
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 ${Math.round(height * 0.21)}px Cinzel, Georgia, serif`; g.letterSpacing = `${Math.round(height * 0.035)}px`; g.fillText(year, width / 2, height * 0.28);
  const size = Math.min(height * 0.36, (width * 0.74) / Math.max(4, name.length * 0.8));
  g.font = `700 ${Math.round(size)}px Cinzel, Georgia, serif`; g.letterSpacing = `${Math.round(size * 0.08)}px`; g.fillText(name, width / 2, height * 0.7);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; return tex;
}
const BRASS = new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.22, clearcoat: 0.3, clearcoatRoughness: 0.18, envMapIntensity: 1.4 });
const ENGRAVED = new THREE.MeshPhysicalMaterial({ color: 0x2a1b08, metalness: 0.4, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
function plaque(year, name, w = 4.6, h = 2.1, order = null) {
  const group = new THREE.Group();
  group.userData.slot = { w, h, order };
  if (!name || (typeof window !== "undefined" && window.__plaques === false)) return group;
  const depth = 0.14;
  const body = mesh(new THREE.ExtrudeGeometry(cartoucheShape(w, h), { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 20 }), BRASS);
  group.add(body);
  // the engraving: dark lettering and keylines on the face
  const tex = plaqueTexture(year, name, w / h);
  const engraving = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ ...ENGRAVED, alphaMap: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x2a1b08, metalness: 0.4, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  engraving.position.z = depth + 0.056; group.add(engraving);
  // a rope moulding round the edge
  const edge = []; const shape = cartoucheShape(w, h); for (const p of shape.getPoints(24)) edge.push(new THREE.Vector3(p.x, p.y, depth + 0.045));
  const rope = new THREE.CatmullRomCurve3(edge, true);
  group.add(mesh(new THREE.TubeGeometry(rope, 360, 0.045, 8, true), BRASS));
  // rivets at the four notched corners and a domed boss in each end
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const rivet = mesh(new THREE.SphereGeometry(0.085, 14, 10), BRASS); rivet.position.set(sx * (w / 2 - h * 0.1), sy * (h / 2 - h * 0.1), depth + 0.07); rivet.scale.z = 0.6; group.add(rivet); }
  for (const sx of [1, -1]) { const boss = mesh(new THREE.SphereGeometry(h * 0.1, 18, 12), BRASS); boss.position.set(sx * (w / 2), 0, depth + 0.05); boss.scale.z = 0.5; group.add(boss); }
  return group;
}
function flatPlate(year, w, h, z, y, x = 0, name = "", order = null) {
  const group = plaque(year, name, w, h, order);
  group.position.set(x, y, z); return group;
}

// ---------- Bowl Pool base: a walnut drum with gadrooned gold mouldings and a curved brass plate
export function bowlBase(m) {
  const g = new THREE.Group();
  const R = 9.2;
  const lobes = (n, a, lo, hi) => (theta, t, y, r) => r * (1 + a * Math.cos(n * theta) * smooth(lo, lo + 0.2, y) * (1 - smooth(hi - 0.2, hi, y)));
  g.add(mesh(revolveMod(profile([[10.0, 0], [10.15, 0.08], [10.1, 0.35], [9.7, 0.8], [9.3, 1.05]], 40), 160, lobes(24, 0.012, 0.1, 0.8)), m.gold));
  { const drum = mesh(new THREE.CylinderGeometry(R, R, 2.6, 120), m.walnut); drum.position.y = 2.3; g.add(drum); }
  for (const y of [1.05, 3.6]) { const rib = mesh(new THREE.TorusGeometry(R + 0.04, 0.17, 14, 140), m.gold); rib.rotation.x = Math.PI / 2; rib.position.y = y; g.add(rib); }
  g.add(beadRing(R + 0.18, 100, 0.13, 3.85, m.gold));
  g.add(mesh(revolveMod(profile([[9.5, 3.9], [9.3, 4.15], [8.6, 4.35], [8.3, 4.7]], 30), 160, null), m.gold));
  { const step = mesh(new THREE.CylinderGeometry(8.1, 8.1, 0.5, 120), m.walnut); step.position.y = 4.65; g.add(step); }
  const cap = mesh(revolveMod(profile([[8.55, 4.85], [8.5, 5.0], [8.0, 5.15]], 20), 160, lobes(36, 0.008, 4.85, 5.15)), m.gold); g.add(cap);
  // the reigning champion's plaque faces front on the drum; each new winner's plaque is added in the next place round
  championsFor("bowl").slice(0, 10).forEach((c, k) => {
    const a = (k / 10) * Math.PI * 2, p = plaque(c.year, c.name, 5.2, 2.3, k);
    p.position.set(Math.sin(a) * (R - 0.08), 2.3, Math.cos(a) * (R - 0.08)); p.rotation.y = a; g.add(p);
  });
  g.userData.height = 5.15;
  return g;
}

// ---------- Pick'em base: a black onyx octagon with gold inlay and a flat brass plate
export function onyxBase(m) {
  const g = new THREE.Group();
  const onyx = new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.0 });
  const oct = (r, h, y, mat) => { const o = mesh(new THREE.CylinderGeometry(r, r, h, 8), mat); o.rotation.y = Math.PI / 8; o.position.y = y; g.add(o); return o; };
  oct(10.3, 0.55, 0.275, m.gold);
  oct(9.2, 3.0, 2.05, onyx);
  oct(9.55, 0.28, 3.64, m.gold);
  oct(9.3, 0.18, 3.86, onyx);
  oct(8.0, 1.5, 4.7, onyx);
  oct(8.35, 0.34, 5.54, m.gold);
  oct(7.2, 0.3, 5.86, onyx);
  const apothem = 9.2 * Math.cos(Math.PI / 8);
  g.add(flatPlate("PICK’EM CHAMPIONS", 6.6, 2.15, apothem + 0.12, 2.05));
  g.userData.height = 6.0;
  return g;
}

// ---------- Survivor base: emerald marble steps with gold mouldings and a brass plate
export function emeraldBase(m) {
  const g = new THREE.Group();
  const emerald = m.marble.clone(); emerald.map = marbleTexture(1024, 9); emerald.color = new THREE.Color(0x1f6e4e); emerald.envMapIntensity = 0.75; emerald.roughness = 0.12;
  const box = (w, h, d, y, mat, r = 0.25) => { const b = mesh(new RoundedBoxGeometry(w, h, d, 6, r), mat); b.position.y = y; g.add(b); return b; };
  const t2 = 2.7;
  box(20.6, 0.5, 12.2, 0.25, m.gold, 0.15);
  box(19.6, 2.5, 11.2, 1.75, emerald);
  box(20.0, 0.34, 11.6, 3.17, m.gold, 0.12);
  box(16.2, t2, 8.8, 3.34 + t2 / 2, emerald);
  box(16.5, 0.3, 9.1, 3.34 + t2 + 0.15, m.gold, 0.1);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 16, 12), m.gold, 240);
  { const mat = new THREE.Matrix4(); let k = 0; const row = (w, d, y) => { const nx = Math.round(w / 0.55), nz = Math.round(d / 0.55); for (let i = 0; i <= nx; i++) { const x = -w / 2 + (i / nx) * w; for (const z of [-d / 2, d / 2]) { mat.makeTranslation(x, y, z); beads.setMatrixAt(k++, mat); } } for (let i = 1; i < nz; i++) { const z = -d / 2 + (i / nz) * d; for (const x of [-w / 2, w / 2]) { mat.makeTranslation(x, y, z); beads.setMatrixAt(k++, mat); } } }; row(19.9, 11.5, 3.17); row(16.4, 9.0, 3.34 + t2 + 0.15); beads.count = k; beads.castShadow = true; g.add(beads); }
  // five plates on the front: the newest champion goes bottom left, moves one place right each year, then up to the top row, then round the back
  const sv = championsFor("survivor");
  for (const [x, i] of [[-6.1, 0], [0, 1], [6.1, 2]]) g.add(flatPlate(sv[i] ? sv[i].year : "", 5.4, 2.3, 11.2 / 2 - 0.03, 1.75, x, sv[i] ? sv[i].name : "", i));
  [-3.6, 3.6].forEach((x, j) => g.add(flatPlate(sv[3 + j] ? sv[3 + j].year : "", 4.8, 2.3, 8.8 / 2 - 0.03, 3.34 + t2 / 2, x, sv[3 + j] ? sv[3 + j].name : "", 3 + j)));
  g.userData.height = 3.34 + t2 + 0.3;
  return g;
}

// ---------- Pick'em base: a two-tier black onyx hexagon, gold cove mouldings and corner fillets, twelve plates (six per tier)
export function hexBase(m) {
  const g = new THREE.Group();
  const onyx = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.3, clearcoat: 0.2, clearcoatRoughness: 0.15, specularIntensity: 0.3, envMapIntensity: 0.15, bumpMap: topoTexture(6, 0.25), bumpScale: 0.05 });
  const hex = (rb, rt, h, y, mat) => { const o = mesh(new THREE.CylinderGeometry(rt, rb, h, 6), mat); o.rotation.y = Math.PI / 6; o.position.y = y; g.add(o); return o; };
  const A = (r) => r * Math.cos(Math.PI / 6);
  hex(12.5, 12.5, 0.45, 0.225, m.gold);
  hex(12.3, 11.9, 0.3, 0.6, m.gold);
  const r1 = 11.7, h1 = 2.7, y1 = 0.75;
  hex(r1, r1, h1, y1 + h1 / 2, onyx);
  hex(r1 + 0.25, r1 - 1.1, 0.7, y1 + h1 + 0.35, m.gold);           // cove moulding up to the second tier
  const r2 = 10.2, h2 = 3.2, y2 = y1 + h1 + 0.7;
  hex(r2, r2, h2, y2 + h2 / 2, onyx);
  hex(r2 + 0.3, r2 + 0.3, 0.3, y2 + h2 + 0.15, m.gold);
  hex(8.5, 8.8, 0.6, y2 + h2 + 0.6, onyx);
  hex(8.8, 8.8, 0.22, y2 + h2 + 1.0, m.gold);
  // gold fillets on every corner of both tiers
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6;
    for (const [r, y, h] of [[r1, y1, h1], [r2, y2, h2]]) {
      const rod = mesh(new THREE.CylinderGeometry(0.17, 0.17, h, 12), m.gold); rod.position.set(Math.sin(a) * (r + 0.02), y + h / 2, Math.cos(a) * (r + 0.02)); g.add(rod);
    }
  }
  // twelve plates, one on each face of both tiers (two per side, one above the other); the reigning champion is front and centre on the upper tier
  for (let k = 0; k < 6; k++) {
    const phi = k * Math.PI / 3;
    const champs = championsFor("pickem");
    for (const [r, y, w, h, tier] of [[r2, y2 + h2 / 2, 7.0, 3.0, 0], [r1, y1 + h1 / 2, 7.4, 2.5, 1]]) {
      const order = k * 2 + tier, c = champs[order], year = c ? c.year : "", name = c ? c.name : "";
      const p = flatPlate(year, w, h, 0, y, 0, name, order); p.position.set(Math.sin(phi) * (A(r) - 0.03), y, Math.cos(phi) * (A(r) - 0.03)); p.rotation.y = phi; g.add(p);
    }
  }
  g.userData.height = y2 + h2 + 1.1;
  g.scale.set(0.95, 1, 0.95);
  return g;
}

// ---------- filigree: an openwork scroll pattern, used as an alpha cut-out and bump so gold reads as hand-pierced lace
let filigreeCache = null;
function filigreeTexture(ru = 1, rv = 1) {
  if (!filigreeCache) {
    const size = 512, c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, size, size);
    g.strokeStyle = "#fff"; g.lineCap = "round"; g.lineJoin = "round";
    const cell = size / 2;
    const spiral = (cx, cy, r0, turns, dir, start) => { g.beginPath(); for (let i = 0; i <= 120; i++) { const t = i / 120, a = start + dir * t * turns * Math.PI * 2, r = r0 * (1 - 0.82 * t); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    for (let gx = 0; gx < 2; gx++) for (let gy = 0; gy < 2; gy++) {
      const x0 = gx * cell, y0 = gy * cell, flip = (gx + gy) % 2 ? -1 : 1;
      g.lineWidth = 9;
      // a pair of opposed C-scrolls with curled ends, joined by an S-stem
      spiral(x0 + cell * 0.3, y0 + cell * 0.35, cell * 0.24, 1.6, flip, 0);
      spiral(x0 + cell * 0.7, y0 + cell * 0.65, cell * 0.24, 1.6, flip, Math.PI);
      g.beginPath(); g.moveTo(x0 + cell * 0.3, y0 + cell * 0.11); g.bezierCurveTo(x0 + cell * 0.75, y0 + cell * 0.05, x0 + cell * 0.25, y0 + cell * 0.95, x0 + cell * 0.7, y0 + cell * 0.89); g.stroke();
      // a small quatrefoil of dots
      g.lineWidth = 6;
      for (const [dx, dy] of [[0.78, 0.2], [0.22, 0.8]]) { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.beginPath(); g.arc(x0 + cell * dx + Math.cos(a) * 9, y0 + cell * dy + Math.sin(a) * 9, 5, 0, Math.PI * 2); g.stroke(); } }
    }
    // a frame line on every tile edge so the lace joins up into a continuous mesh
    g.lineWidth = 10; g.strokeRect(0, 0, size, size); g.beginPath(); g.moveTo(size / 2, 0); g.lineTo(size / 2, size); g.moveTo(0, size / 2); g.lineTo(size, size / 2); g.stroke();
    filigreeCache = new THREE.CanvasTexture(c); filigreeCache.wrapS = filigreeCache.wrapT = THREE.RepeatWrapping; filigreeCache.anisotropy = 8;
  }
  const tex = filigreeCache.clone(); tex.repeat.set(ru, rv); tex.needsUpdate = true; return tex;
}
function filigreeGold(ru, rv) {
  const tex = filigreeTexture(ru, rv);
  return new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.22, clearcoat: 0.25, clearcoatRoughness: 0.15, envMapIntensity: 1.35, alphaMap: tex, alphaTest: 0.5, bumpMap: tex, bumpScale: 1.2, side: THREE.DoubleSide });
}

let guillocheCache = null, ropeCache = null;
function guillocheTexture(ru) {
  if (!guillocheCache) {
    const w = 1024, h = 128, c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#fff"; g.lineWidth = 3;
    // interlaced waves, the engine-turned pattern of a fine watch case
    for (let k = 0; k < 7; k++) { g.beginPath(); for (let x = 0; x <= w; x += 2) { const y = h / 2 + Math.sin((x / w) * Math.PI * 2 * 8 + k * 0.9) * h * 0.3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, 6); g.lineTo(w, 6); g.moveTo(0, h - 6); g.lineTo(w, h - 6); g.stroke();
    guillocheCache = new THREE.CanvasTexture(c); guillocheCache.wrapS = THREE.RepeatWrapping; guillocheCache.anisotropy = 8;
  }
  const tex = guillocheCache.clone(); tex.repeat.set(ru, 1); tex.needsUpdate = true; return tex;
}
function ropeTexture(ru) {
  if (!ropeCache) {
    const s = 128, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d"); const grad = g.createLinearGradient(0, 0, s, s);
    for (let i = 0; i <= 4; i++) { grad.addColorStop(i / 4, i % 2 ? "#000" : "#fff"); }
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    ropeCache = new THREE.CanvasTexture(c); ropeCache.wrapS = ropeCache.wrapT = THREE.RepeatWrapping;
  }
  const tex = ropeCache.clone(); tex.repeat.set(ru, 1); tex.needsUpdate = true; return tex;
}
const engravedGold = (bumpMap, scale = 1.4) => new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.22, clearcoat: 0.25, clearcoatRoughness: 0.15, envMapIntensity: 1.35, bumpMap, bumpScale: scale });

// ---------- Pick'em trophy: the ivory spire. Four silver blades edged in rope-twisted gold twist up a fluted ivory column to a small imperial crown.
/** A cabochon ruby in a fine gold bezel, set flush on a surface at p, facing outwards along n. */
function rubyStud(parent, m, p, n, r = 0.22) {
  const grp = new THREE.Group(); grp.position.copy(p); grp.lookAt(p.clone().add(n));
  const bezel = mesh(new THREE.TorusGeometry(r * 1.12, r * 0.28, 10, 28), m.gold); grp.add(bezel);
  const gem = mesh(new THREE.SphereGeometry(r, 28, 18), RUBY); gem.scale.z = 0.55; gem.position.z = r * 0.12; grp.add(gem);
  parent.add(grp);
}
const RUBY = new THREE.MeshPhysicalMaterial({ color: 0x6c0719, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: new THREE.Color(0x4a0310), emissiveIntensity: 0.55, envMapIntensity: 2.0 });
let blackMarbleCache = null;
function blackMarbleTexture() {
  if (blackMarbleCache) return blackMarbleCache;
  const size = 1024, c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    const warp = fbm(nx * 3.2 + 4, ny * 2.2 + 9, 5) * 2.6;
    const vein = Math.pow(1 - Math.abs(Math.sin((nx * 1.2 + ny * 2.1 + warp) * 4.6)), 16);
    const fine = Math.pow(1 - Math.abs(Math.sin((nx * 2.2 - ny * 1.1 + warp * 1.4) * 7.5)), 26);
    const cloud = fbm(nx * 5 + 2, ny * 5 + 7, 4);
    const base = 14 + cloud * 20;
    const v = Math.min(1, vein * 0.85 + fine * 0.5);
    const val = base * (1 - v) + (118 + cloud * 60) * v;
    const i = (y * size + x) * 4; img.data[i] = val; img.data[i + 1] = val; img.data[i + 2] = val * 1.04; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  blackMarbleCache = new THREE.CanvasTexture(c); blackMarbleCache.colorSpace = THREE.SRGBColorSpace; blackMarbleCache.wrapS = blackMarbleCache.wrapT = THREE.RepeatWrapping; blackMarbleCache.anisotropy = 8;
  blackMarbleCache.repeat.set(3, 2);
  return blackMarbleCache;
}
let whiteMarbleCache = null;
export const SPIRE_MATERIALS = {
  white: () => { if (!whiteMarbleCache) { whiteMarbleCache = marbleTexture(1024, 5); whiteMarbleCache.repeat.set(3, 2); } return new THREE.MeshPhysicalMaterial({ map: whiteMarbleCache, color: 0xfaf8f2, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.75 }); },
  marble: () => new THREE.MeshPhysicalMaterial({ map: blackMarbleTexture(), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.7 }),
  silver: () => null,
  ivory: () => new THREE.MeshPhysicalMaterial({ color: 0xe8dcc2, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color(0xfff2d6), envMapIntensity: 1.1 }),
  pearl: () => new THREE.MeshPhysicalMaterial({ color: 0xf1ebe6, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.45, iridescenceThicknessRange: [250, 600], sheen: 0.5, sheenColor: new THREE.Color(0xe9d7ff), envMapIntensity: 1.3 }),
  smoke: () => new THREE.MeshPhysicalMaterial({ color: 0x4c4f58, metalness: 1, roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 1.4 }),
  champagne: () => new THREE.MeshPhysicalMaterial({ color: 0xe6d3b0, metalness: 1, roughness: 0.2, clearcoat: 0.4, envMapIntensity: 1.3 }),
};
export const SPIRE_FINS = {
  leaf: { wMax: 3.7, twist: Math.PI * 0.85, scallop: 0, double: false, name: "scooped leaf" },
  wing: { wMax: 3.2, twist: Math.PI * 0.7, scallop: 0.28, double: false, name: "scalloped wing" },
  ribbon: { wMax: 2.1, twist: Math.PI * 1.5, scallop: 0, double: true, name: "twin ribbons" },
  crest: { wMax: 1.5, twist: Math.PI * 1.0, scallop: 0, double: false, studs: true, name: "low crest with rubies" },
  rocket: { wMax: 3.6, twist: 0, scallop: 0, double: false, name: "straight swept fins", profile: (t) => Math.pow(1 - t, 0.85) * (0.35 + 0.65 * Math.min(1, t * 8)) },
  lotus: { wMax: 2.6, twist: Math.PI * 0.3, scallop: 0, double: false, count: 8, tEnd: 0.62, name: "lotus petals", profile: (t) => Math.pow(Math.sin(Math.PI * t), 0.6) },
  ribs: { kind: "ribs", name: "spiral rope ribs" },
  cage: { kind: "cage", name: "open gold cage" },
  laurel: { kind: "laurel", name: "laurel branches" },
  coil: { kind: "coil", name: "metal helix" },
  helix: { kind: "helix", name: "double helix" },
};
export function ivorySpire(m, opts = {}) {
  const colMat = (SPIRE_MATERIALS[opts.material ?? "white"]() ?? m.silver);
  const fin = SPIRE_FINS[opts.fin ?? "leaf"];
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const cage = ["cage", "coil"].includes(opts.fin ?? "leaf");
  const lobes = (n, a, lo, hi) => (theta, t, y, r) => r * (1 + a * Math.cos(n * theta) * smooth(lo, lo + 0.4, y) * (1 - smooth(hi - 0.4, hi, y)));
  if (!cage) {
  const foot = profile([[6.2, 0], [6.4, 0.3], [5.8, 0.85], [4.6, 1.5], [3.9, 2.3], [4.0, 2.9], [3.5, 3.4], [3.3, 3.7]], 80);
  g.add(mesh(revolveMod(foot, 180, lobes(24, 0.05, 0.8, 2.3)), m.gold));
  g.add(beadRing(6.3, 64, 0.18, 0.55, m.gold)); g.add(beadRing(4.05, 44, 0.15, 2.9, m.gold));
  const leaf = leafGeometry(2.6, 0.8);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const l = mesh(leaf, m.gold); l.position.set(Math.cos(a) * 3.0, 3.4, Math.sin(a) * 3.0); l.rotation.order = "YXZ"; l.rotation.y = -a + Math.PI / 2; l.rotation.x = -0.45; g.add(l); }

  }
  const y0 = 3.6, y1 = 29.5;
  const ybase = cage ? y0 - 3.45 : y0;
  const flareAt = (y) => (cage ? 1.35 : 0.9) * Math.pow(Math.max(0, 1 - (y - ybase) / (cage ? 9 : 6)), 2);   // the pillar widens gracefully toward its foot
  const rc = (y) => { const t = Math.max(0, (y - y0) / (y1 - y0)); return 2.9 - 1.9 * t + 0.25 * Math.sin(Math.PI * t) + flareAt(y); };
  // scalloped flutes: rounded ridges between sharp-bottomed grooves, deeper than before
  const scallop = (lo, hi) => (theta, tt, y, r) => r * (1 + 0.19 * (Math.pow(Math.abs(Math.cos(10 * theta)), 0.7) - 0.62) * smooth(lo, lo + 0.6, y) * (1 - smooth(hi - 0.6, hi, y)));
  if (cage) {
    const R0 = rc(ybase);
    const plinth = mesh(new THREE.CylinderGeometry(R0 + 0.25, R0 + 0.4, 0.7, 96, 1, true), engravedGold(guillocheTexture(4), 1.5)); plinth.position.y = ybase + 0.35; g.add(plinth);
    for (const [r, y] of [[R0 + 0.42, ybase], [R0 + 0.3, ybase + 0.72]]) { const e = mesh(new THREE.TorusGeometry(r, 0.13, 12, 96), engravedGold(ropeTexture(80), 1.1)); e.rotation.x = Math.PI / 2; e.position.y = y; g.add(e); }
    g.add(beadRing(R0 + 0.55, 72, 0.07, ybase + 0.35, m.gold));
  }
  const core = profile(Array.from({ length: cage ? 26 : 14 }, (_, i) => { const y = ybase + (i / (cage ? 25 : 13)) * (y1 - ybase); return [rc(y), y]; }), 220);
  g.add(mesh(revolveMod(core, 240, scallop(ybase + 0.8, y1 - 1)), colMat));
  // engraved gold collars on the column: engine-turned centre, rope-twist edges, a row of fine beads
  for (const y of fin.kind === "coil" ? [12.1, 19.5] : [9.5, 17.5, 25.0]) {
    const r = rc(y) + 0.34, circ = 2 * Math.PI * r;
    const rAt = (yy) => rc(yy) + 0.34;   // the pillar tapers, so every part of the collar is cut to the radius of the stone at its own height
    const band = mesh(new THREE.CylinderGeometry(rAt(y + 0.55), rAt(y - 0.55), 1.1, 120, 1, true), engravedGold(guillocheTexture(Math.max(1, Math.round(circ / 6))), 1.6)); band.position.y = y; g.add(band);
    for (let q = 0; q < 4; q++) { const th = q * Math.PI / 2 + Math.PI / 4, dir = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)); rubyStud(g, m, dir.clone().multiplyScalar(rAt(y) + 0.04).setY(y), dir, 0.3); }
    for (const s of [-1, 1]) { const ey = y + s * 0.6, er = rAt(ey), edge = mesh(new THREE.TorusGeometry(er, 0.13, 12, 90), engravedGold(ropeTexture(Math.round(circ * 3)), 1.2)); edge.rotation.x = Math.PI / 2; edge.position.y = ey; g.add(edge); g.add(beadRing(rAt(y + s * 0.8) + 0.16, Math.round(circ * 3.2), 0.07, y + s * 0.8, m.gold)); }
  }

  // four silver blades twisting up the column like scooped leaves: each tapers to nothing at both ends, with a gold rope edge, a gold root line and a fine inlaid centre rib
  const blade = (a0, wScale = 1) => {
    const nt = 260, nu = 24, twist = fin.twist, pos = [], idx = [], edge = [], root = [], rib = [];
    const yb0 = y0 + 0.9, yb1 = yb0 + (y1 - 0.3 - yb0) * (fin.tEnd ?? 1);
    const at = (t, u) => {
      const y = yb0 + t * (yb1 - yb0), th = a0 + twist * t;
      const w = (fin.wMax * wScale * (fin.profile ? fin.profile(t) : Math.pow(Math.sin(Math.PI * t), 0.8))) * (1 - fin.scallop * (0.5 + 0.5 * Math.cos(t * Math.PI * 22))) + 0.02;
      const r = rc(y) * 0.95 + w * u, scoop = 0.16 * u * u * Math.min(1, w);       // the leaf curls over in the direction of travel
      const ang = th + scoop;
      return new THREE.Vector3(Math.cos(ang) * r, y + 0.7 * u * u * Math.sin(Math.PI * t) * Math.min(1, w), -Math.sin(ang) * r);
    };
    for (let i = 0; i <= nt; i++) { const t = i / nt; for (let j = 0; j <= nu; j++) { const p = at(t, j / nu); pos.push(p.x, p.y, p.z); } edge.push(at(t, 1)); root.push(at(t, 0)); rib.push(at(t, 0.5)); }
    const SETS = Array.from({ length: 7 }, (_, i) => 0.17 + (i / 6) * 0.66), LEN = 27;
    const radius = (tk) => 0.3 + 0.1 * Math.sin(Math.PI * tk);
    const widthAt = (t) => fin.wMax * wScale * Math.pow(Math.sin(Math.PI * t), 0.8);
    const inHole = (t, u) => SETS.some((tk) => { const R = radius(tk) + 0.1, w = widthAt(tk); return (((t - tk) * LEN) / R) ** 2 + (((u - 0.5) * w) / R) ** 2 < 1; });
    for (let i = 0; i < nt; i++) for (let j = 0; j < nu; j++) {
      const a = i * (nu + 1) + j, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const silver = m.silver.clone(); silver.side = THREE.DoubleSide; g.add(mesh(geo, silver));
    const rope = (pts, rad) => { const c = new THREE.CatmullRomCurve3(pts); g.add(mesh(new THREE.TubeGeometry(c, 420, rad, 12), engravedGold(ropeTexture(Math.round(c.getLength() * 3)), 1.3))); };
    rope(edge, 0.22); rope(root, 0.14); if (!fin.double) rope(rib.slice(6, -6), 0.08);   // the gold midrib, like the vein of a leaf
    if (fin.studs) for (const tt of [0.3, 0.45, 0.6, 0.75]) { const p = at(tt, 0.7), p2 = at(tt, 0.7 + 0.05); rubyStud(g, m, p, new THREE.Vector3(p.x, 0, p.z).normalize(), 0.2); }
    else for (const tk of SETS) {
      // a ruby inlaid on the midrib: a gold collet lying flat on the fin, a rope-edged bezel and an oval cabochon, its long axis following the vein
      const e = 0.004, p = at(tk, 0.5), tangent = at(tk + e, 0.5).sub(at(tk - e, 0.5)).normalize();
      const nrm = new THREE.Vector3().crossVectors(tangent, at(tk, 0.5 + e).sub(at(tk, 0.5 - e))).normalize();
      for (const side of [1, -1]) {      // a stone on each face of the fin, so it reads from either side
      const n = nrm.clone().multiplyScalar(side);
      const yAxis = new THREE.Vector3().crossVectors(n, tangent).normalize(), xAxis = new THREE.Vector3().crossVectors(yAxis, n).normalize();
      const r = radius(tk), set = new THREE.Group();
      set.position.copy(p).addScaledVector(n, 0.12);
      set.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(yAxis, xAxis, n));   // local x = across, local y = along the vein, local z = out of the fin
      const collet = mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.4, 0.2, 40), m.gold); collet.rotation.x = Math.PI / 2; collet.scale.set(1, 1, 1.35); collet.position.z = 0.02; set.add(collet);
      const gem = mesh(new THREE.SphereGeometry(r, 40, 28), RUBY); gem.scale.set(1, 1.35, 0.5); gem.position.z = 0.05; set.add(gem);
      const bezel = mesh(new THREE.TorusGeometry(r * 1.12, 0.055, 12, 48), engravedGold(ropeTexture(18), 1.0)); bezel.scale.set(1, 1.35, 1); bezel.position.z = 0.07; set.add(bezel);
      g.add(set);
      }
    }
  };
  const nFin = fin.count ?? 4;
  if (!fin.kind) for (let k = 0; k < nFin; k++) { const a0 = (k / nFin) * Math.PI * 2 + Math.PI / 4; if (fin.double) { blade(a0 - 0.2, 1); blade(a0 + 0.2, 1); } else blade(a0); }

  if (fin.kind) {
    const yA = y0 + 0.9, yB = y1 - 0.3, Y = (t) => yA + t * (yB - yA);
    const ropeAlong = (pts, rad) => { const c = new THREE.CatmullRomCurve3(pts); g.add(mesh(new THREE.TubeGeometry(c, 360, rad, 12), engravedGold(ropeTexture(Math.round(c.getLength() * 3)), 1.3))); };
    const stud = (p, r = 0.26) => rubyStud(g, m, p, new THREE.Vector3(p.x, 0, p.z).normalize(), r);
    const helixPts = (a0, twist, off, t0 = 0.04, t1 = 0.96, n = 160) => Array.from({ length: n + 1 }, (_, i) => { const t = t0 + (i / n) * (t1 - t0), y = Y(t), th = a0 + twist * t, r = rc(y) + off(t); return new THREE.Vector3(Math.cos(th) * r, y, -Math.sin(th) * r); });
    if (fin.kind === "ribs") {
      for (let k = 0; k < 4; k++) { const a0 = (k / 4) * Math.PI * 2 + Math.PI / 4, off = () => 0.55; ropeAlong(helixPts(a0, Math.PI * 1.0, off), 0.2); ropeAlong(helixPts(a0, Math.PI * 1.0, () => 0.3), 0.1); for (let j = 1; j <= 7; j++) { const t = 0.08 + j * 0.11, y = Y(t), th = a0 + Math.PI * t, r = rc(y) + 0.6; stud(new THREE.Vector3(Math.cos(th) * r, y, -Math.sin(th) * r), 0.24); } }
    } else if (fin.kind === "cage") {
      // An Eiffel-style exoskeleton that could actually be built:
      //  - four lattice-truss legs, each bolted to the base through a cast shoe and plate, curving in and terminating in the top collar
      //  - two ring beams that pass through all four legs at the heights of the pillar's own collars, tied back to the pillar by radial struts
      //  - four arches between the legs carrying the first ring beam; no member ever passes through the pillar
      const pr = (y) => rc(y);
      const yS = 1.15, yT = y1 - 0.3, rTop = pr(yT) + 0.5, R0 = 5.0, P = 2.2, TWIST = 0.55;
      const legR = (y) => pr(y) + 0.5 + (R0 - pr(yS) - 0.5) * Math.pow(Math.max(0, (yT - y) / (yT - yS)), P);   // follows the pillar at a steady clearance, flaring out naturally toward the feet
      const uu = (y) => Math.min(1, Math.max(0, (y - yS) / (yT - yS)));
      const width = (y) => 0.3 + 0.6 * Math.pow(Math.sin(Math.PI * Math.min(0.999, uu(y) * 0.98 + 0.01)), 0.9);   // each leg opens into a slender lens and closes again
      const ang = (k, y = yS) => (k / 4) * Math.PI * 2 + Math.PI / 4 + TWIST * uu(y);
      const C = (k, y, extra = 0) => { const th = ang(k, y), r = legR(y) + extra; return new THREE.Vector3(Math.cos(th) * r, y, -Math.sin(th) * r); };
      const side = (k, y = yS) => { const th = ang(k, y); return new THREE.Vector3(Math.sin(th), 0, Math.cos(th)); };
      const rail = (k, y, s) => C(k, y).addScaledVector(side(k, y), s * width(y));
      const rod = (p, q, r) => { const d = q.clone().sub(p), len = d.length(); const c = mesh(new THREE.CylinderGeometry(r, r, len, 10), m.gold); c.position.copy(p).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(c); };
      const tube = (pts, r) => g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(40, pts.length * 3), r, 12), m.gold));
      const ringYs = [9.5, 17.5];
      for (let k = 0; k < 4; k++) {
        // the truss: two curved rails with a continuous zig-zag web between them
        const n = 46, ys = Array.from({ length: n + 1 }, (_, i) => yS + (yT - yS) * (1 - Math.pow(1 - i / n, 1.25)));
        for (const s of [-1, 1]) tube(ys.map((y) => rail(k, y, s)), 0.12);
        for (let i = 2; i < n - 1; i += 4) {
          const y = ys[i], o = new THREE.Vector3(Math.cos(ang(k, y)), 0, -Math.sin(ang(k, y))), rr = Math.max(0.12, width(y) * 0.9);
          const ring = mesh(new THREE.TorusGeometry(rr, 0.04, 8, 28), m.gold); ring.position.copy(C(k, y)); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), o); g.add(ring);
          rod(rail(k, y, -1), C(k, y).addScaledVector(side(k, y), -rr), 0.035); rod(rail(k, y, 1), C(k, y).addScaledVector(side(k, y), rr), 0.035);
        }
        // the shoe: a cast block flaring onto a plate bolted to the base
        const th = ang(k, yS), foot = C(k, yS);
        const shoe = mesh(new THREE.CylinderGeometry(width(yS) * 1.05, width(yS) * 1.7, 0.9, 4), m.gold); shoe.position.set(foot.x, yS - 0.45, foot.z); shoe.rotation.y = th + Math.PI / 4; g.add(shoe);
        const plate = mesh(new RoundedBoxGeometry(2.0, 0.18, 1.6, 3, 0.05), m.gold); plate.position.set(foot.x, 0.1, foot.z); plate.rotation.y = th; g.add(plate);
        for (const [dx, dz] of [[-0.75, -0.58], [0.75, -0.58], [-0.75, 0.58], [0.75, 0.58]]) { const bolt = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6), m.silver); const o = new THREE.Vector3(dx, 0, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), th); bolt.position.set(foot.x + o.x, 0.23, foot.z + o.z); g.add(bolt); }
      }
      // ring beams through the legs, at the pillar's collar heights, each tied back to the pillar
      for (const [y, h, main] of ringYs.map((y, i) => [y, i === 0 ? 0.75 : 0.5, i === 0])) {
        const r = legR(y);
        const band = mesh(new THREE.CylinderGeometry(r, r, h, 160, 1, true), engravedGold(guillocheTexture(Math.max(2, Math.round(r * 1.4))), 1.5)); band.material.side = THREE.DoubleSide; band.position.y = y; g.add(band);
        for (const s of [-1, 1]) { const e = mesh(new THREE.TorusGeometry(r, 0.11, 12, 160), engravedGold(ropeTexture(Math.round(r * 20)), 1.2)); e.rotation.x = Math.PI / 2; e.position.y = y + s * h / 2; g.add(e); }
        g.add(beadRing(r + 0.13, Math.round(r * 15), 0.06, y + h / 2 + 0.14, m.gold));
        for (let q = 0; q < 4; q++) { const th = ang(0, y) + Math.PI / 4 + q * Math.PI / 2, dir = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)); rubyStud(g, m, dir.clone().multiplyScalar(r + 0.02).setY(y), dir, main ? 0.3 : 0.25); }
        const inner = pr(y) + 0.16;
        for (let k = 0; k < 8; k++) {
          const th = (k / 8) * Math.PI * 2 + Math.PI / 4, dir = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
          rod(dir.clone().multiplyScalar(inner).setY(y), dir.clone().multiplyScalar(r).setY(y), main ? 0.09 : 0.07);
          const shoeIn = mesh(new THREE.SphereGeometry(main ? 0.17 : 0.13, 14, 10), m.gold); shoeIn.position.copy(dir.clone().multiplyScalar(inner + 0.05).setY(y)); g.add(shoeIn);
        }
      }
      // arches between the legs: a pointed double rib, springing from just above the shoes and carrying the first ring beam at its crown
      for (let k = 0; k < 4; k++) {
        const y0a = yS + 0.6, crownY = ringYs[0] - 0.38, rCrown = legR(ringYs[0]), r0 = legR(y0a);
        const lift = (s) => 1 - Math.pow(Math.abs(2 * s - 1), 1.7);
        const arch = (drop) => Array.from({ length: 61 }, (_, i) => { const s = i / 60, l = lift(s), y = y0a + l * (crownY - drop - y0a), th = ang(k, y) + s * Math.PI / 2, r = r0 + (rCrown - r0) * l; return new THREE.Vector3(Math.cos(th) * r, y, -Math.sin(th) * r); });
        const outer = arch(0), inner = arch(0.55);
        g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outer), 120, 0.12, 12), engravedGold(ropeTexture(70), 1.2)));
        tube(inner, 0.07);
        for (let i = 4; i < 57; i += 4) rod(outer[i], inner[i], 0.035);
      }
      // the legs finish inside the top collar
      { const y = yT, r = rTop; for (let q = 0; q < 4; q++) { const th = ang(0, y) + Math.PI / 4 + q * Math.PI / 2, dir = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)); rubyStud(g, m, dir.clone().multiplyScalar(r + 0.02).setY(y), dir, 0.22); } const band = mesh(new THREE.CylinderGeometry(r, r, 0.9, 80, 1, true), engravedGold(guillocheTexture(2), 1.5)); band.position.y = y; g.add(band); for (const s of [-1, 1]) { const e = mesh(new THREE.TorusGeometry(r, 0.12, 12, 80), engravedGold(ropeTexture(Math.round(r * 16)), 1.1)); e.rotation.x = Math.PI / 2; e.position.y = y + s * 0.45; g.add(e); g.add(beadRing(r + 0.14, Math.round(r * 13), 0.06, y + s * 0.6, m.gold)); } }
    } else if (fin.kind === "coil") {
      // A metal helix in the same gold lattice as the old exoskeleton, kept gentle: two truss strands (two rope-twisted rails with a zig-zag web
      // between them) climb the pillar in about one turn. Each is anchored in an engraved ring at the foot, bows out in the middle, and is anchored
      // in a second ring at the neck, with small struts tying it back to the pillar, so every piece is held by something.
      const yA = y0 + 1.1, yB = y1 - 2.6, turns = 1.0, V = THREE.Vector3;
      const rod = (p, q, r) => { const d = q.clone().sub(p), len = d.length(); const c = mesh(new THREE.CylinderGeometry(r, r, len, 10), m.gold); c.position.copy(p).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new V(0, 1, 0), d.normalize()); g.add(c); };
      const rope = (pts, rad) => { const c = new THREE.CatmullRomCurve3(pts); g.add(mesh(new THREE.TubeGeometry(c, Math.max(80, pts.length * 3), rad, 12), engravedGold(ropeTexture(Math.round(c.getLength() * 3)), 1.3))); };
      const at = (a0, t, s) => {
        const y = yA + t * (yB - yA), th = a0 + turns * Math.PI * 2 * t;
        const k = Math.pow(Math.sin(Math.PI * t), 0.85);
        const off = 0.45 + 1.15 * k, sep = 0.08 + 0.6 * k, r = rc(y) + off;
        return new V(Math.cos(th) * r, y + s * sep, -Math.sin(th) * r);
      };
      // the anchoring rings: engraved gold bands round the pillar where the strands begin and end
      for (const y of [yA, yB]) {
        const r = rc(y) + 0.36, circ = 2 * Math.PI * r;
        for (let q = 0; q < 4; q++) { const th = q * Math.PI / 2 + Math.PI / 4, dir = new V(Math.cos(th), 0, -Math.sin(th)); rubyStud(g, m, dir.clone().multiplyScalar(r + 0.04).setY(y), dir, 0.28); }
        const rAt = (yy) => rc(yy) + 0.36;
        const band = mesh(new THREE.CylinderGeometry(rAt(y + 0.45), rAt(y - 0.45), 0.9, 120, 1, true), engravedGold(guillocheTexture(Math.max(1, Math.round(circ / 6))), 1.6)); band.position.y = y; g.add(band);
        for (const s of [-1, 1]) { const ey = y + s * 0.48, e = mesh(new THREE.TorusGeometry(rAt(ey), 0.12, 12, 90), engravedGold(ropeTexture(Math.round(circ * 3)), 1.2)); e.rotation.x = Math.PI / 2; e.position.y = ey; g.add(e); g.add(beadRing(rAt(y + s * 0.62) + 0.14, Math.round(circ * 3), 0.055, y + s * 0.62, m.gold)); }
      }
      for (const a0 of [Math.PI / 4, Math.PI / 4 + Math.PI]) {
        const n = 160;
        for (const s of [-1, 1]) rope(Array.from({ length: n + 1 }, (_, i) => at(a0, i / n, s)), 0.115);
        for (let i = 0; i < n; i += 2) { const s = (i / 2) % 2 ? 1 : -1; rod(at(a0, i / n, s), at(a0, (i + 2) / n, -s), 0.04); }
        for (let i = 8; i < n - 6; i += 9) {
          const t = i / n, y = yA + t * (yB - yA), th = a0 + turns * Math.PI * 2 * t, base = new V(Math.cos(th) * (rc(y) * 0.99), y, -Math.sin(th) * (rc(y) * 0.99));
          rod(base, at(a0, t, 0), 0.07);
          const stud = mesh(new THREE.SphereGeometry(0.15, 14, 10), m.gold); stud.position.copy(base); g.add(stud);
        }
        // each end of the strand lands on its ring in a small cast socket
        for (const t of [0, 1]) { const p = at(a0, t, 0), th = a0 + turns * Math.PI * 2 * t; const sock = mesh(new THREE.SphereGeometry(0.26, 16, 12), m.gold); sock.position.copy(p).addScaledVector(new V(Math.cos(th), 0, -Math.sin(th)), -0.05); sock.scale.set(1, 1.3, 1); g.add(sock); }
      }
    } else if (fin.kind === "laurel") {
      const berry = RUBY;
      for (const s of [1, -1]) { const pts = helixPts(s > 0 ? 0 : Math.PI, s * Math.PI * 1.5, () => 0.42, 0.04, 0.96, 80); g.add(laurel(new THREE.CatmullRomCurve3(pts), 26, m.gold, berry, 1.5)); }
    } else if (fin.kind === "helix") {
      for (const s of [1, -1]) { const a0 = s > 0 ? 0 : Math.PI; ropeAlong(helixPts(a0, s * Math.PI * 1.7, () => 0.9), 0.3); for (let j = 1; j <= 8; j++) { const t = 0.06 + j * 0.105, y = Y(t), th = a0 + s * Math.PI * 1.7 * t, r = rc(y) + 0.9; stud(new THREE.Vector3(Math.cos(th) * r, y, -Math.sin(th) * r), 0.3); } }
      for (let j = 1; j <= 12; j++) { const t = 0.04 + j * 0.073, y = Y(t), th = Math.PI * 1.7 * t, r = rc(y) + 0.9; const a = new THREE.Vector3(Math.cos(th) * r, y, -Math.sin(th) * r), b = new THREE.Vector3(Math.cos(-th + Math.PI) * r, y, -Math.sin(-th + Math.PI) * r); const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, a.distanceTo(b), 8), m.silver); rung.position.copy(a).lerp(b, 0.5); rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(rung); }
    }
  }

  // the cap: a gold cup holding a sculpted flame
  { const neck = mesh(new THREE.CylinderGeometry(1.25, 1.5, 1.2, 48), m.gold); neck.position.y = y1 - 0.75; g.add(neck); g.add(beadRing(1.52, 28, 0.1, y1 - 1.3, m.gold)); const nr = mesh(new THREE.TorusGeometry(1.3, 0.12, 10, 48), m.gold); nr.rotation.x = Math.PI / 2; nr.position.y = y1 - 0.15; g.add(nr); }
  const cup = profile([[1.1, y1 - 0.4], [1.5, y1 + 0.3], [2.3, y1 + 0.9], [2.6, y1 + 1.25], [2.4, y1 + 1.4]], 40);
  g.add(mesh(revolveMod(cup, 96, lobes(12, 0.06, y1, y1 + 1.1)), m.gold)); g.add(beadRing(2.6, 36, 0.13, y1 + 1.25, m.gold));
  // a sculpted gold flame rises from the cup, its four lobes carrying on the twist of the blades below and closing to a soft rounded tip
  const fy = y1 + 1.2, fh = 6.2, ftw = Math.PI * 0.9;
  const fr = (u) => 0.18 + 2.1 * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * u)), 0.85) * (1 - 0.35 * u);
  const flame = profile([...Array.from({ length: 24 }, (_, i) => { const u = i / 23 * 0.97; return [fr(u), fy + u * fh]; }), [0.01, fy + fh]], 160);
  g.add(mesh(revolveMod(flame, 200, (theta, t2, y, r) => { const u = (y - fy) / fh; return r * (1 + 0.16 * Math.cos(4 * theta - ftw * u) * smooth(0.05, 0.25, u)); }), m.gold));
  { const cy = y1 + 1.25, cr = 1.5; const col = mesh(new THREE.CylinderGeometry(cr, cr + 0.1, 0.7, 64, 1, true), engravedGold(guillocheTexture(2), 1.5)); col.position.y = cy + 0.5; g.add(col); for (const s of [0, 1]) { const e = mesh(new THREE.TorusGeometry(cr + 0.04 * s, 0.1, 10, 64), engravedGold(ropeTexture(30), 1.1)); e.rotation.x = Math.PI / 2; e.position.y = cy + 0.15 + 0.7 * s; g.add(e); } }
  g.scale.set(1.1, 1, 1.1);   // a shade wider overall
  if (cage) g.position.y = -0.1;
  return root;
}

// ---------- Pick'em trophy: a grand silver spire of four twisting blades rising to a gold football
export function lockSpire(m) {
  const g = new THREE.Group();
  const lobes = (n, a, lo, hi) => (theta, t, y, r) => r * (1 + a * Math.cos(n * theta) * smooth(lo, lo + 0.4, y) * (1 - smooth(hi - 0.4, hi, y)));
  // a smooth polished onyx pedestal, matching the base, with two fine gold lines
  const stone = new THREE.MeshPhysicalMaterial({ color: 0x0d0d11, roughness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.08, specularIntensity: 0.4, envMapIntensity: 0.35, bumpMap: topoTexture(1.6, 0.7), bumpScale: 0.12 });
  const foot = profile([[6.9, 0], [7.0, 0.25], [6.5, 0.7], [4.8, 1.5], [3.8, 2.5], [3.3, 3.3], [3.2, 3.7]], 80);
  g.add(mesh(revolveMod(foot, 160, null), stone));
  for (const [r, y] of [[7.02, 0.25], [3.26, 3.45]]) { const line = mesh(new THREE.TorusGeometry(r, 0.07, 10, 120), m.gold); line.rotation.x = Math.PI / 2; line.position.y = y; g.add(line); }



  const y0 = 3.6, ys = 11.0;
  // the base column: a fluted silver post that ends in a gold receiving cup
  // the stone post runs on through a few platinum rings, carved with fine flutes and a knop in the middle
  const post = profile([[3.25, y0], [2.9, y0 + 0.7], [2.75, y0 + 1.6], [2.8, y0 + 2.7], [3.2, y0 + 3.4], [3.4, y0 + 3.85], [3.2, y0 + 4.3], [2.8, y0 + 5.0], [2.7, ys - 1.2], [2.8, ys - 0.4], [2.85, ys]], 120);
  g.add(mesh(revolveMod(post, 160, (theta, t2, y, r) => r * (1 + 0.035 * Math.cos(22 * theta) * (1 - smooth(y0 + 3.0, y0 + 3.4, y) + smooth(y0 + 4.3, y0 + 4.7, y)) * smooth(y0 + 0.9, y0 + 1.4, y) * (1 - smooth(ys - 0.9, ys - 0.5, y)))), stone));
  for (const [r, y] of [[2.86, y0 + 1.15], [3.02, y0 + 2.95], [3.0, y0 + 4.75], [2.86, ys - 0.7]]) { const ring = mesh(new THREE.TorusGeometry(r, 0.15, 12, 90), m.gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
  g.add(beadRing(3.45, 52, 0.1, y0 + 3.85, m.gold));
  // the lifting piece: a fluted silver flame, rounded like the tip of a football at the bottom, seated deep in the cup
  const yb = ys + 0.6, y1 = 32.5, yr = ys + 5.6;   // seat, apex, rim of the cup
  const rc = (y) => { const t = (y - yb) / (y1 - yb); return 0.1 + 5.0 * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.9 + 0.25 * (1 - smooth(0, 0.3, t))) * (1 - 0.12 * t); };
  const twist = Math.PI * 1.1;
  const tTop = 0.87, yTop = yb + tTop * (y1 - yb);
  const core = profile([...Array.from({ length: 28 }, (_, i) => { const y = yb + (i / 27) * tTop * (y1 - yb); return [rc(y), y]; }), [0.01, yTop]], 220);
  g.add(mesh(revolveMod(core, 220, (theta, t2, y, r) => { const t = (y - yb) / (y1 - yb); return r * (1 + 0.14 * Math.cos(4 * theta + twist * t) * smooth(0.04, 0.2, t)); }), m.silver));

  // the cup: wide and deep, its wall hugging the lower flame, with a slot in the lip for every fin so the piece seats the same way every time
  const tr = (yr - yb) / (y1 - yb), rimR = rc(yr) * 1.14 + 0.75;
  // the cup's inner wall follows the flame exactly; the outside tapers quickly into the post
  const cupPts = [[2.7, ys - 0.1], [3.0, ys + 0.35], ...Array.from({ length: 12 }, (_, i) => { const y = yb + 0.15 + (i / 11) * (yr - yb - 0.4); return [Math.max(rc(y) * 1.14 + 0.45, 3.0 + 0.75 * (y - ys)), y]; }), [rimR, yr - 0.08], [rimR - 0.12, yr], [0.01, yr]];
  const cupMat = new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.2, clearcoat: 0.25, envMapIntensity: 1.35 });
  g.add(smoky(mesh(revolveMod(cupPts, 200, (theta, t2, y, r) => r * (1 + 0.035 * Math.cos(16 * theta) * smooth(ys + 0.6, ys + 2.4, y) * (1 - smooth(yr - 1.2, yr - 0.6, y)))), cupMat)));
  g.add(beadRing(2.78, 36, 0.13, ys + 0.05, m.gold));
  const finAngle = (k, t) => (-twist * t + k * Math.PI * 2) / 4;       // angle of fin k's crest at height t (revolve convention)
  const gap = 0.34, dark = new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 0.7, metalness: 0.4 });
  for (let k = 0; k < 4; k++) {
    const th = finAngle(k, tr), a0 = -th;                              // torus angle matching the fin
    // a raised lip in four arcs, broken at each fin
    const arc = new THREE.Group(); arc.rotation.x = Math.PI / 2; arc.position.y = yr + 0.05;
    const lip = mesh(new THREE.TorusGeometry(rimR - 0.02, 0.11, 12, 60, Math.PI / 2 - gap), m.gold); lip.rotation.z = a0 + gap / 2; arc.add(lip); g.add(arc);
    // the slot: a dark recess between two gold guide blocks
    const slot = mesh(new THREE.BoxGeometry(0.3, 0.55, 1.1), dark); slot.position.set(Math.cos(th) * (rimR - 0.35), yr - 0.22, -Math.sin(th) * (rimR - 0.35)); slot.rotation.y = th; g.add(slot);
    for (const s of [-1, 1]) { const a = th + s * (gap / 2 + 0.05); const guide = mesh(new RoundedBoxGeometry(0.16, 0.45, 0.8, 2, 0.05), m.gold); guide.position.set(Math.cos(a) * (rimR - 0.1), yr + 0.08, -Math.sin(a) * (rimR - 0.1)); guide.rotation.y = a; g.add(guide); }
  }

  // reverse drips: between the slots, the cup's own metal creeps up onto the ball in thin tongues that thin to nothing,
  // a quiet nod to the people who reach up to hold the game
  const flameR = (theta, y) => { const t = (y - yb) / (y1 - yb); return rc(y) * (1 + 0.14 * Math.cos(4 * theta + twist * t) * smooth(0.04, 0.2, t)); };
  const dripMat = new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.2, clearcoat: 0.3, envMapIntensity: 1.35, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const th0 = finAngle(k, tr);
    for (let j = 1; j <= 3; j++) {
      const ac = th0 + gap / 2 + j * (Math.PI / 2 - gap) / 4, height = 1.5 + 0.45 * Math.sin(j * 2.1 + k * 1.3), w0 = 0.13;
      const ns = 40, nu = 10, pos = [], idx = [];
      for (let i = 0; i <= ns; i++) {
        const s = i / ns, y = yr + s * height;
        const halfW = w0 * Math.pow(1 - s, 0.85) * (1 + 0.6 * (1 - smooth(0, 0.25, s)));   // flares where it leaves the lip, thins to a point
        const thick = 0.13 * Math.pow(1 - s, 0.8);
        for (let jj = 0; jj <= nu; jj++) {
          const u = jj / nu * 2 - 1, th = ac + u * halfW;
          const onBall = flameR(th, y) + 0.02 + thick * (1 - u * u);
          const r = (rimR - 0.08) + (onBall - (rimR - 0.08)) * smooth(0, 0.3, s);
          pos.push(Math.cos(th) * r, y - 0.06 * (1 - smooth(0, 0.3, s)), -Math.sin(th) * r);
        }
      }
      for (let i = 0; i < ns; i++) for (let jj = 0; jj < nu; jj++) { const a2 = i * (nu + 1) + jj, b2 = a2 + 1, c = a2 + nu + 1, d = c + 1; idx.push(a2, c, b2, b2, c, d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(smoky(mesh(geo, dripMat)));
    }
  }

  // fins: thin silver blades standing out from each lobe crest, edged in gold; they run down through the slots into the cup
  for (let k = 0; k < 4; k++) {
    const nt = 180, nu = 6, t0 = tr - 0.05, t1 = 0.91, pos = [], idx = [], edge = [];
    for (let i = 0; i <= nt; i++) {
      const t = t0 + (i / nt) * (t1 - t0), y = yb + t * (y1 - yb), th = finAngle(k, t), base = rc(y) * 1.1;
      const w = (0.85 + 0.55 * Math.pow(Math.max(0, Math.sin(Math.PI * (t - t0) / (t1 - t0))), 0.6)) * (1 - smooth(0.8, t1, t)) + 0.05;
      for (let j = 0; j <= nu; j++) { const r = base + w * (j / nu); pos.push(Math.cos(th) * r, y, -Math.sin(th) * r); }
      edge.push(new THREE.Vector3(Math.cos(th) * (base + w), y, -Math.sin(th) * (base + w)));
    }
    for (let i = 0; i < nt; i++) for (let j = 0; j < nu; j++) { const a2 = i * (nu + 1) + j, b2 = a2 + 1, c = a2 + nu + 1, d = c + 1; idx.push(a2, c, b2, b2, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const finMat = new THREE.MeshPhysicalMaterial({ color: 0x55585f, metalness: 1, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 1.3, side: THREE.DoubleSide }); g.add(mesh(geo, finMat));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 220, 0.22, 12), m.gold));
  }
  // a flat ruby inlaid in a platinum bezel on the crown of the flame
  { const rTop = rc(yTop - 0.05) * 1.05 + 0.15;
    const bezel = mesh(new THREE.CylinderGeometry(rTop + 0.1, rTop + 0.2, 0.45, 48), m.gold); bezel.position.y = yTop + 0.1; g.add(bezel);
    // a flat, table-cut ruby inlaid flush in the bezel
    const gem = mesh(new THREE.CylinderGeometry(rTop * 0.62, rTop * 0.8, 0.32, 8), new THREE.MeshPhysicalMaterial({ color: 0x7c0a1e, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: new THREE.Color(0x4a0312), emissiveIntensity: 0.6, envMapIntensity: 2.2, flatShading: true }));
    gem.rotation.y = Math.PI / 8; gem.position.y = yTop + 0.42; g.add(gem); }
  toPlatinum(g);
  return g;
}

// ---------- Pick'em trophy: an abstract armillary sphere. Nested gold bands engraved with numerals around a faceted lead jewel.
export function armillary(m) {
  const g = new THREE.Group();
  const lobes = (n, a, lo, hi) => (theta, t, y, r) => r * (1 + a * Math.cos(n * theta) * smooth(lo, lo + 0.5, y) * (1 - smooth(hi - 0.5, hi, y)));
  const stem = profile([[5.6, 0], [5.85, 0.25], [5.2, 0.75], [3.5, 1.5], [1.7, 2.6], [1.15, 3.6], [1.25, 4.4], [2.1, 5.0], [2.8, 5.9], [2.3, 6.8], [1.35, 7.4], [1.05, 8.3], [1.5, 9.3], [2.7, 10.4], [4.3, 11.5], [4.7, 12.1], [4.3, 12.3]], 160);
  g.add(mesh(revolveMod(stem, 180, lobes(16, 0.06, 1.0, 4.0)), m.gold));
  g.add(beadRing(5.7, 60, 0.18, 0.55, m.gold)); g.add(beadRing(2.8, 30, 0.15, 5.9, m.gold)); g.add(beadRing(4.4, 40, 0.15, 11.9, m.gold));

  const cy = 25;
  const rod = mesh(new THREE.CylinderGeometry(0.34, 0.34, 2 * 13.4, 20), m.gold); rod.position.y = cy + 1.0; g.add(rod);

  // the lead jewel: a faceted polished sphere
  const jewelMaterial = new THREE.MeshPhysicalMaterial({ color: 0x6f7682, metalness: 1, roughness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 1.5, flatShading: true });
  const jewel = mesh(new THREE.IcosahedronGeometry(5.6, 2), jewelMaterial); jewel.position.y = cy; g.add(jewel);
  for (const o of [-1, 1]) { const collar = mesh(new THREE.TorusGeometry(0.6, 0.2, 12, 24), m.gold); collar.rotation.x = Math.PI / 2; collar.position.y = cy + o * 5.7; g.add(collar); }

  // engraved numeral bands
  const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const bandTexture = (lead = 0) => engravingBand(numerals.flatMap((n, i) => [[n, (i + 0.25) / 12 + lead], ["✦", (i + 0.75) / 12 + lead]]), 4096, 128, "700 66px Cinzel, Georgia, serif");
  const band = (R, h, tilt, spin, lead = 0) => {
    const ring = new THREE.Group();
    const outer = mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.25, h, 200, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.26, bumpMap: bandTexture(lead), bumpScale: -2.2, envMapIntensity: 1.35, side: THREE.DoubleSide })); ring.add(outer);
    const inner = mesh(new THREE.CylinderGeometry(R - 0.25, R - 0.25, h, 200, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xb98a3a, metalness: 1, roughness: 0.4, side: THREE.DoubleSide })); ring.add(inner);
    for (const s of [-1, 1]) { const bead = mesh(new THREE.TorusGeometry(R, 0.3, 16, 200), m.gold); bead.rotation.x = Math.PI / 2; bead.position.y = s * h / 2; ring.add(bead); const fine = mesh(new THREE.TorusGeometry(R, 0.12, 10, 200), m.gold); fine.rotation.x = Math.PI / 2; fine.position.y = s * (h / 2 - 0.5); ring.add(fine); }
    ring.add(beadRing(R + 0.3, 90, 0.1, 0, m.gold));
    ring.rotation.set(...tilt); ring.rotation.order = "YXZ"; ring.rotation.y = spin; ring.position.y = cy; g.add(ring); return ring;
  };
  band(11.4, 2.0, [0, 0, 0], 0);                        // horizon
  band(10.5, 1.8, [Math.PI / 2, 0, 0], Math.PI / 4);   // meridian, turned to show its engraved face
  band(9.6, 1.8, [Math.PI / 2, 0, 0], -Math.PI / 4, 0.04); // the second meridian, perpendicular to the first
  band(8.7, 1.5, [0.41, 0, 0], 0, 0.08);                // ecliptic, tilted
  // little gold planets riding the bands
  for (const [a, R, y] of [[0.5, 11.4, 0], [2.4, 11.4, 0], [4.3, 11.4, 0]]) { const p = mesh(new THREE.SphereGeometry(0.85, 28, 20), m.gold); p.position.set(Math.cos(a) * R, cy + y, Math.sin(a) * R); g.add(p); const halo = mesh(new THREE.TorusGeometry(1.2, 0.1, 10, 40), m.gold); halo.position.copy(p.position); halo.lookAt(0, cy, 0); g.add(halo); }
  // finial
  const finial = profile([[1.5, 0], [1.9, 0.35], [1.3, 1.0], [0.8, 1.9], [1.0, 2.6], [0.6, 3.2], [0.15, 4.2]], 60);
  const fin = mesh(revolveMod(finial, 80, lobes(10, 0.07, 0.2, 1.2)), m.gold); fin.position.y = cy + 11.5; g.add(fin);
  const ball = mesh(new THREE.IcosahedronGeometry(0.95, 1), jewelMaterial); ball.position.y = cy + 11.5 + 4.6; g.add(ball);
  g.add(beadRing(1.7, 28, 0.1, cy + 11.7, m.gold));
  return g;
}

// ---------- Survivor trophy: a bevelled crystal spade around a ruby core, the winning team's chip set in the centre
export function crystalSpade(m, chip = {}) {
  const g = new THREE.Group();
  const lobes = (n, a, lo, hi) => (theta, t, y, r) => r * (1 + a * Math.cos(n * theta) * smooth(lo, lo + 0.4, y) * (1 - smooth(hi - 0.4, hi, y)));
  const socket = profile([[4.8, 0], [5.0, 0.3], [4.3, 0.9], [2.8, 1.6], [2.0, 2.4], [1.8, 3.1], [2.5, 3.5], [2.55, 4.1]], 90);
  g.add(mesh(revolveMod(socket, 160, lobes(16, 0.06, 0.8, 2.6)), m.gold));
  g.add(beadRing(4.95, 50, 0.16, 0.5, m.gold)); g.add(beadRing(2.65, 30, 0.13, 3.55, m.gold));

  // outline of a spade, sampled as points
  const s = new THREE.Shape();
  s.moveTo(0, 3.6); s.bezierCurveTo(1.6, 2.2, 3.3, 0.9, 3.3, -0.6); s.bezierCurveTo(3.3, -1.9, 2.3, -2.4, 1.5, -2.4); s.bezierCurveTo(0.9, -2.4, 0.5, -2.1, 0.35, -1.7); s.bezierCurveTo(0.4, -2.6, 0.8, -3.4, 1.3, -3.9); s.lineTo(-1.3, -3.9); s.bezierCurveTo(-0.8, -3.4, -0.4, -2.6, -0.35, -1.7); s.bezierCurveTo(-0.5, -2.1, -0.9, -2.4, -1.5, -2.4); s.bezierCurveTo(-2.3, -2.4, -3.3, -1.9, -3.3, -0.6); s.bezierCurveTo(-3.3, 0.9, -1.6, 2.2, 0, 3.6);
  const pts = s.getPoints(48).map((p) => new THREE.Vector2(p.x, p.y));
  const S = 2.55, cx = 0, cyShape = 0.15;
  const outer = pts.map((p) => new THREE.Vector2(p.x * S, p.y * S));
  const inset = (k) => pts.map((p) => new THREE.Vector2((p.x - cx) * S * k + cx, (p.y - cyShape) * S * k + cyShape * S));
  const h = new THREE.Shape();
  h.moveTo(0, 3.6); h.bezierCurveTo(1.6, 2.2, 3.3, 0.9, 3.3, -0.6); h.bezierCurveTo(3.3, -1.9, 2.3, -2.4, 1.5, -2.4); h.bezierCurveTo(0.8, -2.4, 0.25, -2.0, 0, -1.55);
  h.bezierCurveTo(-0.25, -2.0, -0.8, -2.4, -1.5, -2.4); h.bezierCurveTo(-2.3, -2.4, -3.3, -1.9, -3.3, -0.6); h.bezierCurveTo(-3.3, 0.9, -1.6, 2.2, 0, 3.6);
  const heart = (k) => h.getPoints(48).map((p) => new THREE.Vector2(p.x * S * k, (p.y - cyShape) * S * k + cyShape * S));
  const frameShape = new THREE.Shape(outer); frameShape.holes.push(new THREE.Path(heart(0.7)));
  const coreShape = new THREE.Shape(heart(0.7));
  const glass = m.crystal.clone(); glass.envMapIntensity = 2.4; glass.specularIntensity = 1; glass.clearcoat = 1; glass.clearcoatRoughness = 0.02; glass.attenuationColor = new THREE.Color(0xcfe6ff); glass.attenuationDistance = 6; glass.dispersion = 0; glass.thickness = 0.5; glass.ior = 1.25;
  const frame = mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 2.2, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 0.9, bevelSegments: 3, curveSegments: 12 }), glass);
  const ruby = new THREE.MeshPhysicalMaterial({ color: 0x6e0a1f, metalness: 0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.6, sheenColor: new THREE.Color(0xff4a62), emissive: new THREE.Color(0x58061a), emissiveIntensity: 0.6, envMapIntensity: 1.6 });
  const core = mesh(new THREE.ExtrudeGeometry(coreShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.3, bevelSegments: 4, curveSegments: 12 }), ruby);
  const baseY = 3.6 + 3.9 * S; // the stem sits in the socket
  for (const o of [frame, core]) { o.position.set(0, baseY, o === frame ? -1.1 : -0.8); g.add(o); }
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(heart(0.71).map((p) => new THREE.Vector3(p.x, p.y + baseY, 1.25)), true), 220, 0.14, 8, true), m.gold); rim.castShadow = true; g.add(rim);

  // the winning team's chip in a gold bezel, centred on the ruby heart
  const chipGroup = new THREE.Group();
  const tex = chipTexture(chip);
  const chipSide = new THREE.MeshPhysicalMaterial({ color: 0xf6f2e6, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const chipFace = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const chipMesh = mesh(new THREE.CylinderGeometry(3.75, 3.75, 0.8, 120), [chipSide, chipFace, chipFace]); chipMesh.rotation.x = Math.PI / 2; chipGroup.add(chipMesh);
  const bezel = mesh(new THREE.TorusGeometry(3.95, 0.3, 22, 120), m.gold); chipGroup.add(bezel);
  const bezel2 = mesh(new THREE.TorusGeometry(3.5, 0.1, 14, 120), m.gold); bezel2.position.z = 0.42; chipGroup.add(bezel2);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; const bead = mesh(new THREE.SphereGeometry(0.1, 14, 10), m.gold); bead.position.set(Math.cos(a) * 3.95, Math.sin(a) * 3.95, 0.12); chipGroup.add(bead); }   // beads sit on the bezel itself, nothing floats free
  chipGroup.position.set(0, baseY + 0.45 * S, 1.75); g.add(chipGroup);
  g.userData.height = baseY + 7.5 * S;
  return g;
}

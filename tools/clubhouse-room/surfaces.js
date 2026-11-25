// What the room is made of: the surfaces that have to convince (planks, shiplap, fieldstone, thatch, woven cane, the sky) and the
// one shape that has to be modelled rather than painted, the palm-leaf fan blade. Every surface is drawn here on a canvas, most
// with a matching relief so the light catches its joints and fibres.
import { THREE } from "/lib.js";

export function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
export function texture(c, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
export const rand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

// Lays a texture over a box in metres (one tile every su by sv metres on every face), so stone, planks and boards keep their true
// size whatever the shape of the thing they cover. Give the box's place in the room and the pattern runs unbroken from one box to the next.
export function tile(geometry, su, sv = su, [ox, oy, oz] = [0, 0, 0]) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax > ay && ax > az) uv.setXY(i, (p.getZ(i) + oz) / su, (p.getY(i) + oy) / sv);
    else if (ay > az) uv.setXY(i, (p.getX(i) + ox) / su, (p.getZ(i) + oz) / sv);
    else uv.setXY(i, (p.getX(i) + ox) / su, (p.getY(i) + oy) / sv);
  }
  return geometry;
}

// Lays stone round a box the way a mason would: the faces that turn a corner share one strip of stone, so a stone cut by a corner
// carries on round it (the same stone seen from its other side), never a fresh pattern starting at the edge. The strip runs along the
// front (the -x face, by its z), turns both corners onto the sides, and meets itself only on the +x face, the one set into the wall.
export function wrapTile(geometry, su, sv = su, [ox, oy, oz] = [0, 0, 0]) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox, x0 = min.x + ox, z0 = min.z + oz, z1 = max.z + oz;
  const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = (p.getY(i) + oy) / sv, z = p.getZ(i) + oz;
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    let t;
    if (Math.abs(ny) > 0.5) { uv.setXY(i, x / su, z / su); continue; }
    if (nx < -0.5) t = z;                                   // the front
    else if (nz < -0.5) t = z0 - (x - x0);                  // round the near corner onto that side
    else if (nz > 0.5) t = z1 + (x - x0);                   // round the far corner onto the other side
    else t = z;                                             // the face in the wall: never seen
    uv.setXY(i, t / su, y);
  }
  return geometry;
}
// A colour picture and its matching relief (white is high), drawn together.
function pair(w, h, draw, repeat = [1, 1]) {
  const c = canvas(w, h), b = canvas(w, h); draw(c.getContext("2d"), b.getContext("2d"));
  const map = texture(c, repeat), bumpMap = new THREE.CanvasTexture(b); bumpMap.anisotropy = 8;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping; bumpMap.repeat.set(...repeat);
  return { map, bumpMap };
}

// Honey oak planks running down the room: each board its own tone, grain along its length, a dark joint all round.
export function oakFloor() {
  return pair(1024, 2048, (g, b) => {
    b.fillStyle = "#909090"; b.fillRect(0, 0, 1024, 2048);
    const cols = 8, w = 1024 / cols;
    for (let c = 0; c < cols; c++) {
      let y = -Math.floor(rand() * 600);
      while (y < 2048) {
        const len = 560 + Math.floor(rand() * 560), t = rand();
        g.fillStyle = `rgb(${Math.round(170 + t * 36)}, ${Math.round(120 + t * 32)}, ${Math.round(70 + t * 26)})`; g.fillRect(c * w, y, w, len);
        for (let k = 0; k < 18; k++) {
          const x = c * w + 4 + rand() * (w - 8);
          g.strokeStyle = `rgba(96, 58, 24, ${0.05 + rand() * 0.1})`; g.lineWidth = 1 + rand() * 2.2;
          g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 8 * (rand() - 0.5), y + len * 0.3, x + 8 * (rand() - 0.5), y + len * 0.7, x + 5 * (rand() - 0.5), y + len); g.stroke();
        }
        if (rand() < 0.22) { const kx = c * w + 24 + rand() * (w - 48), ky = y + 60 + rand() * (len - 120); for (let r = 14; r > 2; r -= 3) { g.strokeStyle = `rgba(80, 46, 18, ${0.16 + (14 - r) * 0.02})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, r * 0.6, r * 1.5, 0, 0, Math.PI * 2); g.stroke(); } }
        b.fillStyle = `rgba(255, 255, 255, ${rand() * 0.1})`; b.fillRect(c * w, y, w, len);
        g.fillStyle = "rgba(56, 32, 14, .6)"; g.fillRect(c * w, y, w, 2); b.fillStyle = "#2c2c2c"; b.fillRect(c * w, y - 1, w, 4);
        y += len;
      }
      g.fillStyle = "rgba(56, 32, 14, .65)"; g.fillRect(c * w - 1, 0, 3, 2048); b.fillStyle = "#262626"; b.fillRect(c * w - 2, 0, 5, 2048);
    }
  });
}

// White-painted boards laid flat, a shadowed groove between each and the faintest brush of the paint.
export function shiplap(repeat) {
  return pair(512, 1024, (g, b) => {
    g.fillStyle = "#f3eee2"; g.fillRect(0, 0, 512, 1024); b.fillStyle = "#b0b0b0"; b.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 8; i++) {
      const y = i * 128;
      g.fillStyle = `rgba(150, 135, 110, ${0.03 + rand() * 0.05})`; g.fillRect(0, y, 512, 128);
      for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(140, 125, 100, ${0.02 + rand() * 0.03})`; g.fillRect(0, y + 8 + rand() * 112, 512, 1); }
      g.fillStyle = "rgba(84, 72, 56, .55)"; g.fillRect(0, y, 512, 4); g.fillStyle = "rgba(255, 255, 255, .6)"; g.fillRect(0, y + 4, 512, 2);
      b.fillStyle = "#202020"; b.fillRect(0, y, 512, 5); b.fillStyle = "#d8d8d8"; b.fillRect(0, y + 5, 512, 3);
    }
  }, repeat);
}

// Fieldstone: flat-lying stones of many greys and tans, each one mottled and rounded up out of a raked mortar joint. The pattern is
// worked out stone by stone (the nearest and second-nearest stone to every point), so no two are alike and the picture still repeats.
/** Knobs for test renders (scene query `stonelift`): how strongly stones stand out from or sit back in the wall. */
export const STONE = { lift: 1 };
export function fieldstone() {
  const W = 1024, H = 1024, GX = 8, GY = 13, seeds = [];
  const palette = [[176, 168, 156], [152, 146, 136], [188, 176, 156], [136, 132, 128], [172, 152, 130], [120, 115, 110], [200, 192, 178], [160, 146, 128], [146, 150, 152]];
  // Each stone's own relief comes from a stream of its own, so the rest of the room's surfaces keep their looks.
  const relief = (() => { let r = 4242; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; })();
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const t = (rand() - 0.5) * 22, p = palette[Math.floor(rand() * palette.length)];
    // lift: how far the stone stands out (-1 set back, +1 proud); dome: how rounded its face is (low = a flat slab, high = a cobble).
    seeds.push({ x: (i + 0.5 + (rand() - 0.5) * 0.8 + (j % 2) * 0.5) / GX, y: (j + 0.5 + (rand() - 0.5) * 0.7) / GY, c: p.map((v) => v + t), tilt: (rand() - 0.5) * 0.5, lift: relief() * 2 - 1, dome: 0.3 + relief() * 0.6 });
  }
  const N = 48, lattice = Array.from({ length: N * N }, () => rand()), at = (i, j) => lattice[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const mottle = (u, v) => { const x = u * N, y = v * N, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; };
  const c = canvas(W, H), b = canvas(W, H), cg = c.getContext("2d"), bg = b.getContext("2d");
  const ci = cg.createImageData(W, H), bi = bg.createImageData(W, H), d = canvas(W, H), dg = d.getContext("2d"), di = dg.createImageData(W, H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = px / W, v = py / H, gi = Math.floor(u * GX), gj = Math.floor(v * GY);
    let d1 = 9, d2 = 9, s1 = seeds[0], ox = 0, oy = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const s = seeds[(((gj + dj) % GY) + GY) % GY * GX + (((gi + di) % GX) + GX) % GX];
      let dx = u - s.x, dy = v - s.y; dx -= Math.round(dx); dy -= Math.round(dy);
      const d = Math.hypot(dx * GX, dy * GY);
      if (d < d1) { d2 = d1; d1 = d; s1 = s; ox = dx * GX; oy = dy * GY; } else if (d < d2) d2 = d;
    }
    const blot = mottle(u, v) - 0.5 + (mottle(u * 4, v * 4) - 0.5) * 0.5, joint = 0.03 + 0.035 * mottle(u * 3 + 0.3, v * 3 + 0.7);
    const edge = d2 - d1, face = Math.min(1, Math.max(0, (edge - joint) / (0.16 + 0.1 * s1.dome))), round = Math.pow(face, s1.dome), lift = Number(STONE.lift);
    const grit = (rand() - 0.5) * 20, o = (py * W + px) * 4, mortar = edge < joint;
    // Depth: each stone is a rounded lump set back from deep, dark joints (the shade closes in toward every joint, a soft light from the
    // top left catches the upper-left of each stone), with pitting and a fine grain on the faces so no stone is flat.
    const cavity = mortar ? 1 : 0.5 + 0.5 * Math.min(1, face * 2.4);
    const pit = mottle(u * 14 + 0.31, v * 14 + 0.17) - 0.5, fine = mottle(u * 40 + 0.5, v * 40 + 0.9) - 0.5;
    // A proud stone catches more light and a set-back one sits in shade; both deepen toward the joint.
    const proud = 1 + s1.lift * 0.1 * lift;
    // A proud stone throws a little shade down and to the right into its joint; a set-back one is shaded along its own top and left edge.
    const rim = mortar ? 0 : (1 - Math.min(1, face * 3)) * lift * (s1.lift > 0 ? 0 : -s1.lift * 0.35);
    const shade = (mortar ? 0.8 + blot * 0.1 : (0.82 + 0.18 * round + (ox * s1.tilt - oy * 0.12) * 0.34 + blot * 0.26 + pit * 0.16 + fine * 0.1) * cavity * proud - rim) * (mortar ? 1 : 1 + (-ox * 0.05 - oy * 0.07));
    const col = mortar ? [118, 108, 94] : s1.c;
    for (let k = 0; k < 3; k++) ci.data[o + k] = Math.max(0, Math.min(255, col[k] * shade + grit * 1.1));
    // The stone's shape (its dome and how far it stands out) and, much fainter, its pitting: smooth faces that still feel worn.
    const form = mortar ? 30 : 60 + (110 + 40 * s1.dome) * round + s1.lift * 48 * lift * round;
    const hgt = mortar ? 30 + grit * 0.3 : form + blot * 24 + pit * 16 + fine * 6 + grit * 0.25;
    bi.data[o] = bi.data[o + 1] = bi.data[o + 2] = Math.max(0, Math.min(255, hgt)); ci.data[o + 3] = bi.data[o + 3] = 255;
    di.data[o] = di.data[o + 1] = di.data[o + 2] = Math.max(0, Math.min(255, form)); di.data[o + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); bg.putImageData(bi, 0, 0); dg.putImageData(di, 0, 0);
  // The relief the wall is shaped by: only each stone's form, softened a little so faces and edges come out smooth, never jagged.
  const soft = canvas(W, H), sg = soft.getContext("2d"); sg.filter = "blur(3px)";
  for (const [x, y] of [[0, 0], [-W, 0], [W, 0], [0, -H], [0, H]]) sg.drawImage(d, x, y);   // wrapped, so the blur meets itself at the tile's edges
  const map = texture(c, [1, 1]), bumpMap = new THREE.CanvasTexture(b), displacementMap = new THREE.CanvasTexture(soft);
  for (const t of [bumpMap, displacementMap]) { t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return { map, bumpMap, displacementMap };
}

// The thatch behind the courses: deep, dark straw, only glimpsed between them.
export function thatchBack() {
  const c = canvas(512, 512), g = c.getContext("2d");
  g.fillStyle = "#4e391c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) { const x = rand() * 512, y = rand() * 512, t = 90 + rand() * 60; g.strokeStyle = `rgba(${t + 30}, ${t}, ${t - 50}, ${0.3 + rand() * 0.4})`; g.lineWidth = 1 + rand() * 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 50 + rand() * 40, y + (rand() - 0.5) * 8); g.stroke(); }
  return texture(c, [3, 8]);
}
// One course of thatch: bundles of straw hanging down the slope, dark where the course above overhangs them, bright and ragged at
// the tips (the ragged edge is cut out, so each course really does hang over the next).
export function thatchCourse() {
  const W = 2048, H = 256, c = canvas(W, H), g = c.getContext("2d");
  g.fillStyle = "#a47c40"; g.fillRect(0, 0, W, 150);
  for (let i = 0; i < 9000; i++) {
    const x = rand() * W, y1 = 128 + rand() * 126, y0 = Math.max(0, y1 - 110 - rand() * 170), t = rand();
    g.strokeStyle = `rgb(${Math.round(178 + t * 66)}, ${Math.round(138 + t * 62)}, ${Math.round(70 + t * 50)})`; g.lineWidth = 1.2 + rand() * 2.6;
    g.beginPath(); g.moveTo(x + (rand() - 0.5) * 14, y0); g.lineTo(x, y1); g.stroke();
  }
  for (let i = 0; i < 260; i++) { const x = rand() * W; g.strokeStyle = `rgba(52, 32, 12, ${0.25 + rand() * 0.3})`; g.lineWidth = 2 + rand() * 3; g.beginPath(); g.moveTo(x + (rand() - 0.5) * 10, 20 + rand() * 60); g.lineTo(x, 190 + rand() * 60); g.stroke(); }
  g.globalCompositeOperation = "source-atop";
  const under = g.createLinearGradient(0, 0, 0, 150); under.addColorStop(0, "rgba(40, 24, 8, .62)"); under.addColorStop(0.5, "rgba(40, 24, 8, .26)"); under.addColorStop(1, "rgba(30, 17, 5, 0)");
  g.fillStyle = under; g.fillRect(0, 0, W, 150);
  const tips = g.createLinearGradient(0, 170, 0, 256); tips.addColorStop(0, "rgba(255, 226, 160, 0)"); tips.addColorStop(1, "rgba(255, 226, 160, .3)");
  g.fillStyle = tips; g.fillRect(0, 170, W, 86);
  const t = texture(c, [5, 1]); t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// Woven cane for the rattan pieces: a basket weave, over and under.
export function cane(repeat = [3, 3]) {
  return pair(128, 128, (g, b) => {
    g.fillStyle = "#8c6636"; g.fillRect(0, 0, 128, 128); b.fillStyle = "#303030"; b.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const across = (x + y) % 2 === 0, t = rand();
      g.fillStyle = `rgb(${Math.round(196 + t * 26)}, ${Math.round(154 + t * 22)}, ${Math.round(98 + t * 18)})`; b.fillStyle = "#d8d8d8";
      if (across) { g.fillRect(x * 16 - 2, y * 16 + 3, 20, 10); b.fillRect(x * 16 - 2, y * 16 + 3, 20, 10); } else { g.fillRect(x * 16 + 3, y * 16 - 2, 10, 20); b.fillRect(x * 16 + 3, y * 16 - 2, 10, 20); }
    }
  }, repeat);
}

// The wood of a fan blade: a warm, hand-rubbed brown, its fibres sweeping out from the rib toward the tip as a palm leaf's do.
export function bladeWood() {
  return pair(1024, 512, (g, b) => {
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#6a3d1b"); gr.addColorStop(0.5, "#8c582b"); gr.addColorStop(1, "#6a3d1b");
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); b.fillStyle = "#808080"; b.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 1500; i++) {
      const x = rand() * 1340 - 300, side = rand() < 0.5 ? -1 : 1, light = rand() < 0.5, a = 0.08 + rand() * 0.16;
      g.strokeStyle = light ? `rgba(206, 152, 92, ${a})` : `rgba(44, 22, 8, ${a})`; g.lineWidth = 1 + rand() * 1.6;
      g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 256, 256 + side * 256); g.stroke();
      b.strokeStyle = light ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.25)"; b.lineWidth = 1.5; b.beginPath(); b.moveTo(x, 256); b.lineTo(x + 256, 256 + side * 256); b.stroke();
    }
  });
}

// A leaf, modelled: root at the origin, tip along +x. It is pleated like a real frond (ridges sweeping from the rib out toward the
// tip, so the light breaks across it), scalloped along its edge where each pleat ends, keeled along its rib and drooping to a point.
// The fan blades and every plant in the room are grown from this one shape.
export function frond({ L = 1.6, HW = 0.47, pleats = 17, droop = 0.11, keel = 0.3, depth = 0.0075, scallop = 0.028, shape = 0.72, NU = 170, NV = 72 } = {}) {
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, outline = Math.pow(Math.sin(Math.PI * Math.pow(u, shape)), 0.8);
    const half = HW * (0.035 + 0.965 * outline) * (1 + scallop * outline * Math.cos((u - 0.25) * pleats * Math.PI * 2));
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * 2 - 1, a = Math.abs(v), phase = (u - a * 0.25) * pleats * Math.PI * 2;
      const pleat = depth * Math.cos(phase) * Math.min(1, a * 2.5) * Math.sqrt(outline);
      pos.push(u * L, -droop * u * u + keel * half * Math.pow(a, 1.6) + pleat, v * half); uvs.push(u, (v + 1) / 2);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, c = a + NV + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); leaf.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); leaf.setIndex(idx); leaf.computeVertexNormals();
  return leaf;
}
// One palm-leaf fan blade and the rib along its underside (stout at the root, drawn out to nothing at the tip). Its pleats follow
// the fibres drawn in bladeWood.
export function palmBlade(L = 1.6, droop = 0.11) {
  const leaf = frond({ L, droop });
  const SEG = 40, RAD = 8, curve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, k) => { const u = (k / 11) * 0.97; return new THREE.Vector3(u * L, -droop * u * u - 0.008, 0); }));
  const rib = new THREE.TubeGeometry(curve, SEG, 0.02, RAD), rp = rib.attributes.position;
  for (let i = 0; i <= SEG; i++) { const centre = curve.getPointAt(i / SEG), k = 1 - 0.82 * (i / SEG); for (let j = 0; j <= RAD; j++) { const n = i * (RAD + 1) + j; rp.setXYZ(n, centre.x + (rp.getX(n) - centre.x) * k, centre.y + (rp.getY(n) - centre.y) * k, centre.z + (rp.getZ(n) - centre.z) * k); } }
  rib.computeVertexNormals();
  return { leaf, rib };
}

// A tongue of fire: white-hot at the heart, gold, then orange thinning to nothing at the tip.
export function flame() {
  const c = canvas(128, 256), g = c.getContext("2d");
  const tongue = (cx, w, top, stops) => {
    const gr = g.createLinearGradient(0, 256, 0, top); stops.forEach((colour, i) => gr.addColorStop(i / (stops.length - 1), colour)); g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx - w, 256); g.bezierCurveTo(cx - w * 1.35, 180, cx - w * 0.2, 140, cx + w * 0.15, top); g.bezierCurveTo(cx + w * 0.5, 150, cx + w * 1.3, 190, cx + w, 256); g.closePath(); g.fill();
  };
  g.filter = "blur(4px)";
  tongue(64, 46, 12, ["rgba(255, 110, 20, .95)", "rgba(255, 80, 10, .7)", "rgba(200, 30, 0, 0)"]);
  tongue(60, 30, 74, ["rgba(255, 190, 60, 1)", "rgba(255, 150, 30, .85)", "rgba(255, 90, 10, 0)"]);
  tongue(66, 15, 132, ["rgba(255, 248, 210, 1)", "rgba(255, 220, 120, .9)", "rgba(255, 170, 40, 0)"]);
  return texture(c);
}

// The sky seen through the glass: a deep blue falling to a pale horizon with a few fair-weather clouds, or stars over a dusk glow.
export function sky(night) {
  const c = canvas(1024, 512), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
  if (night) { gr.addColorStop(0, "#03060f"); gr.addColorStop(0.72, "#101e44"); gr.addColorStop(0.9, "#2b3566"); gr.addColorStop(1, "#5a4a6a"); }
  else { gr.addColorStop(0, "#2f8ae0"); gr.addColorStop(0.55, "#7cc4f2"); gr.addColorStop(0.86, "#cdeefa"); gr.addColorStop(1, "#f6f7ea"); }
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  if (!night) { const sun = g.createRadialGradient(790, 150, 0, 790, 150, 170); sun.addColorStop(0, "rgba(255, 252, 230, 1)"); sun.addColorStop(0.12, "rgba(255, 246, 210, .95)"); sun.addColorStop(0.35, "rgba(255, 240, 200, .35)"); sun.addColorStop(1, "rgba(255, 240, 200, 0)"); g.fillStyle = sun; g.fillRect(0, 0, 1024, 512); }   // a bright sun high on one side
  if (night) {
    // The stars have a counter of their own, and the shared one is stepped on by exactly the 270 draws the day's nine clouds take, so every
    // surface made after the sky (the fieldstone chimney, the plants) comes out the same at night as by day.
    let s = 11; const star = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255, 255, 255, ${0.3 + star() * 0.7})`; g.fillRect(star() * 1024, star() * 420, 1 + star(), 1 + star()); }
    for (let i = 0; i < 270; i++) rand();
  } else for (let k = 0; k < 9; k++) {
    const cx = rand() * 1024, cy = 330 + rand() * 110, s = 30 + rand() * 40;
    for (let p = 0; p < 9; p++) { const x = cx + (rand() - 0.5) * s * 3.4, y = cy + (rand() - 0.5) * s * 0.5, r = s * (0.5 + rand() * 0.6), cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, "rgba(255, 255, 255, .8)"); cg.addColorStop(1, "rgba(255, 255, 255, 0)"); g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }
  return texture(c);
}

// Walnut veneer as a bar is panelled: boards standing on end about a hand's width apart, each with its own tone, close straight grain
// running up it, here and there a cathedral (the arches a crown-cut board shows), open pores in dashes along the grain, and a fine dark
// joint between boards. One tile is a metre square, laid with `tile` so the boards keep their true size on every face.
export function walnutVeneer(repeat) {
  return pair(1024, 1024, (g, b) => {
    const cols = 6, w = 1024 / cols;
    b.fillStyle = "#8a8a8a"; b.fillRect(0, 0, 1024, 1024);
    for (let c = 0; c < cols; c++) {
      const x0 = c * w, t = rand();
      g.fillStyle = `rgb(${Math.round(84 + t * 30)}, ${Math.round(50 + t * 18)}, ${Math.round(28 + t * 10)})`; g.fillRect(x0, 0, w, 1024);
      // the board's own slow wash, darker toward one edge
      const wash = g.createLinearGradient(x0, 0, x0 + w, 0); wash.addColorStop(0, `rgba(30, 14, 4, ${0.1 + rand() * 0.15})`); wash.addColorStop(0.5, "rgba(30, 14, 4, 0)"); wash.addColorStop(1, `rgba(30, 14, 4, ${0.1 + rand() * 0.15})`); g.fillStyle = wash; g.fillRect(x0, 0, w, 1024);
      // close grain: long wavering lines up the board, dark and light
      for (let k = 0; k < 46; k++) {
        const x = x0 + 3 + rand() * (w - 6), sway = 3 + rand() * 7, dark = rand() < 0.7;
        g.strokeStyle = dark ? `rgba(36, 16, 6, ${0.12 + rand() * 0.22})` : `rgba(190, 130, 80, ${0.06 + rand() * 0.1})`; g.lineWidth = 0.6 + rand() * 1.8;
        g.beginPath(); g.moveTo(x, -10);
        for (let y = 0; y <= 1034; y += 64) g.lineTo(x + Math.sin(y / (90 + k * 3) + k) * sway, y);
        g.stroke();
        if (dark) { b.strokeStyle = "rgba(40, 40, 40, .35)"; b.lineWidth = 1; b.stroke(); }
      }
      // a cathedral now and then: nested arches pointing up the board
      if (rand() < 0.55) {
        const cx = x0 + w / 2 + (rand() - 0.5) * w * 0.3, cy = 200 + rand() * 600;
        for (let r = 0; r < 9; r++) {
          const half = 14 + r * 7, tall = 60 + r * 34;
          g.strokeStyle = `rgba(34, 14, 4, ${0.28 - r * 0.022})`; g.lineWidth = 1.4 + rand() * 1.2;
          g.beginPath(); g.moveTo(cx - half, cy + tall); g.quadraticCurveTo(cx - half * 0.2, cy - tall * 0.15, cx, cy - r * 6); g.quadraticCurveTo(cx + half * 0.2, cy - tall * 0.15, cx + half, cy + tall); g.stroke();
        }
      }
      // pores: short dark dashes along the grain
      for (let k = 0; k < 520; k++) { const x = x0 + rand() * w, y = rand() * 1024; g.fillStyle = `rgba(24, 10, 2, ${0.15 + rand() * 0.25})`; g.fillRect(x, y, 1, 3 + rand() * 6); b.fillStyle = "rgba(30, 30, 30, .5)"; b.fillRect(x, y, 1, 4); }
      g.fillStyle = "rgba(20, 8, 2, .7)"; g.fillRect(x0, 0, 2, 1024); b.fillStyle = "#1c1c1c"; b.fillRect(x0 - 1, 0, 3, 1024);
    }
  }, repeat);
}

// Bottle labels, one design to a cell of a 4 x 2 sheet: cream, black, white and kraft papers, each with a band, a crest and lines of
// small type as a real bottle wears them. Read from a distance they say "a label", which is all a bottle across the bar needs.
export function bottleLabels() {
  const c = canvas(1024, 512), g = c.getContext("2d");
  const designs = [["#efe4c6", "#5a1a14", "#1a1a1a"], ["#151515", "#c9a24a", "#e8dcc0"], ["#f6f3ec", "#1d3557", "#333333"], ["#c8a676", "#2a1a0c", "#2a1a0c"], ["#e9d9a8", "#14402c", "#1a1a1a"], ["#7a1620", "#e8cf8a", "#f2e6c8"], ["#f2ede2", "#0f0f0f", "#444444"], ["#1d3557", "#e9d9a8", "#e9d9a8"]];
  designs.forEach(([paper, ink, type], i) => {
    const x = (i % 4) * 256, y = Math.floor(i / 4) * 256;
    g.fillStyle = paper; g.fillRect(x, y, 256, 256);
    g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(x + 14, y + 14, 228, 228); g.lineWidth = 2; g.strokeRect(x + 24, y + 24, 208, 208);
    g.fillStyle = ink; g.fillRect(x + 24, y + 96, 208, 40);
    g.beginPath(); g.arc(x + 128, y + 62, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = type; for (let k = 0; k < 5; k++) g.fillRect(x + 50 + (k % 2) * 16, y + 152 + k * 16, 156 - (k % 2) * 32, 6);
    g.fillStyle = paper; g.fillRect(x + 44, y + 110, 168, 10);
  });
  return texture(c);
}

// A random stream of its own for the surfaces added later, so adding one never reshuffles the rest of the room.
const stream = (seed) => { let r = seed; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; };

// Solid timber for the beams, the trusses and the mantel: one piece of wood, not boards. Long grain along its length (the width of the
// picture) that wavers and gathers round the odd knot, a few seasoning checks, a slow wash of tone; its relief follows the grain.
// `tone` is the wood's middle colour as [r, g, b].
export function timberGrain(tone, repeat = [1, 1]) {
  const rnd = stream(tone[0] * 7 + tone[1]);
  return pair(1024, 512, (g, b) => {
    const [r0, g0, b0] = tone;
    g.fillStyle = `rgb(${r0}, ${g0}, ${b0})`; g.fillRect(0, 0, 1024, 512);
    b.fillStyle = "#808080"; b.fillRect(0, 0, 1024, 512);
    const wash = g.createLinearGradient(0, 0, 0, 512); wash.addColorStop(0, "rgba(0, 0, 0, .08)"); wash.addColorStop(0.5, "rgba(255, 220, 170, .05)"); wash.addColorStop(1, "rgba(0, 0, 0, .1)");
    g.fillStyle = wash; g.fillRect(0, 0, 1024, 512);
    const knots = Array.from({ length: 3 }, () => ({ x: rnd() * 1024, y: 60 + rnd() * 392, r: 8 + rnd() * 10 }));
    for (let k = 0; k < 140; k++) {
      const y0 = rnd() * 512, dark = rnd() < 0.65, amp = 2 + rnd() * 6, len = 120 + rnd() * 300;
      g.strokeStyle = dark ? `rgba(${r0 * 0.45}, ${g0 * 0.4}, ${b0 * 0.35}, ${0.12 + rnd() * 0.22})` : `rgba(255, 225, 180, ${0.04 + rnd() * 0.07})`;
      g.lineWidth = 0.6 + rnd() * 1.6; g.beginPath();
      for (let x = -20; x <= 1044; x += 16) {
        let y = y0 + Math.sin(x / len + k) * amp;
        for (const kn of knots) { const dx = x - kn.x, dy = y - kn.y, d = Math.hypot(dx, dy); if (d < kn.r * 5) y += (dy >= 0 ? 1 : -1) * (kn.r * 5 - d) * 0.35; }
        if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      if (dark) { b.strokeStyle = "rgba(50, 50, 50, .3)"; b.lineWidth = 1; b.stroke(); }
    }
    for (const kn of knots) {
      for (let i = 4; i >= 0; i--) { g.fillStyle = `rgba(${r0 * 0.35}, ${g0 * 0.3}, ${b0 * 0.25}, ${0.16 + (4 - i) * 0.1})`; g.beginPath(); g.ellipse(kn.x, kn.y, kn.r * (1 + i * 0.45), kn.r * 0.6 * (1 + i * 0.3), 0, 0, Math.PI * 2); g.fill(); }
      b.fillStyle = "#5a5a5a"; b.beginPath(); b.ellipse(kn.x, kn.y, kn.r, kn.r * 0.6, 0, 0, Math.PI * 2); b.fill();
    }
    for (let k = 0; k < 5; k++) {
      const x = rnd() * 900, y = 40 + rnd() * 432, l = 80 + rnd() * 160;
      g.strokeStyle = `rgba(20, 10, 4, ${0.35 + rnd() * 0.25})`; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (rnd() - 0.5) * 6); g.stroke();
      b.strokeStyle = "#202020"; b.lineWidth = 2; b.beginPath(); b.moveTo(x, y); b.lineTo(x + l, y + (rnd() - 0.5) * 6); b.stroke();
    }
  }, repeat);
}

// Leather's grain for its relief only: a fine pebble of tiny raised cells with creases between them, so a leather seat or the table's
// padded rail catches the light like hide instead of plastic.
export function leatherGrain(repeat = [4, 4]) {
  const rnd = stream(99);
  const c = canvas(512, 512), g = c.getContext("2d");
  g.fillStyle = "#909090"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 1.5 + rnd() * 3, t = 140 + rnd() * 60;
    g.fillStyle = `rgba(${t}, ${t}, ${t}, .55)`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 512, y = rnd() * 512, a = rnd() * Math.PI;
    g.strokeStyle = "rgba(60, 60, 60, .35)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (6 + rnd() * 14), y + Math.sin(a) * (6 + rnd() * 14)); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}

// A leaf's skin, laid along a frond's own UVs (u from stem to tip, v across with the midrib at the middle): the green lighter toward the
// stem and the midrib and deeper toward the edges, a pale midrib, fine side veins sweeping out toward the tip, and a faint stipple, with
// the veins pressed in for the relief. `torn` cuts the splits a banana or bird of paradise leaf gets: slits from the edge toward the
// midrib along the veins (see-through, alphaTest), so the leaf reads as a real one, not a cut-out.
export function leafSkin(tone, { veins = 26, torn = 0, seed = 5 } = {}) {
  const rnd = stream(seed), W = 512, H = 256;
  return pair(W, H, (g, b) => {
    const [r, gg, bl] = tone;
    const across = g.createLinearGradient(0, 0, 0, H);
    const edge = `rgb(${r * 0.72}, ${gg * 0.74}, ${bl * 0.7})`, mid = `rgb(${Math.min(255, r * 1.12)}, ${Math.min(255, gg * 1.1)}, ${Math.min(255, bl * 1.05)})`;
    across.addColorStop(0, edge); across.addColorStop(0.42, `rgb(${r}, ${gg}, ${bl})`); across.addColorStop(0.5, mid); across.addColorStop(0.58, `rgb(${r}, ${gg}, ${bl})`); across.addColorStop(1, edge);
    g.fillStyle = across; g.fillRect(0, 0, W, H);
    const along = g.createLinearGradient(0, 0, W, 0); along.addColorStop(0, "rgba(220, 240, 170, .18)"); along.addColorStop(0.35, "rgba(220, 240, 170, 0)"); along.addColorStop(1, "rgba(10, 30, 10, .12)");
    g.fillStyle = along; g.fillRect(0, 0, W, H);
    b.fillStyle = "#808080"; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? "255, 255, 220" : "0, 30, 0"}, ${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    // side veins: from the midrib out and forward to the edge, both halves
    for (let k = 1; k < veins; k++) {
      const x = (k / veins) * W * 0.96, sweep = 40 + rnd() * 20;
      for (const side of [-1, 1]) {
        g.strokeStyle = `rgba(230, 245, 190, ${0.12 + rnd() * 0.08})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, H / 2); g.quadraticCurveTo(x + sweep * 0.5, H / 2 + side * H * 0.22, x + sweep, H / 2 + side * H * 0.5); g.stroke();
        b.strokeStyle = "rgba(60, 60, 60, .6)"; b.lineWidth = 1.2; b.stroke();
      }
    }
    // the midrib: a pale raised line down the middle, broad at the stem, fine at the tip
    for (let x = 0; x < W; x += 2) { const w = 5 * (1 - x / W) + 1; g.fillStyle = "rgba(225, 240, 185, .55)"; g.fillRect(x, H / 2 - w / 2, 2, w); b.fillStyle = "#d0d0d0"; b.fillRect(x, H / 2 - w / 2, 2, w); }
    if (torn) {
      g.globalCompositeOperation = "destination-out";
      for (let k = 0; k < torn; k++) {
        const x = W * (0.2 + rnd() * 0.7), side = rnd() < 0.5 ? -1 : 1, depth = H * (0.18 + rnd() * 0.26);
        g.lineWidth = 2.2; g.strokeStyle = "black"; g.beginPath(); g.moveTo(x + 30, side > 0 ? H : 0); g.quadraticCurveTo(x + 12, H / 2 + side * (H / 2 - depth * 0.5), x, H / 2 + side * (H / 2 - depth)); g.stroke();
      }
      g.globalCompositeOperation = "source-over";
    }
  });
}

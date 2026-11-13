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
export function fieldstone() {
  const W = 1024, H = 1024, GX = 8, GY = 13, seeds = [];
  const palette = [[176, 168, 156], [152, 146, 136], [188, 176, 156], [136, 132, 128], [172, 152, 130], [120, 115, 110], [200, 192, 178], [160, 146, 128], [146, 150, 152]];
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const t = (rand() - 0.5) * 22, p = palette[Math.floor(rand() * palette.length)];
    seeds.push({ x: (i + 0.5 + (rand() - 0.5) * 0.8 + (j % 2) * 0.5) / GX, y: (j + 0.5 + (rand() - 0.5) * 0.7) / GY, c: p.map((v) => v + t), tilt: (rand() - 0.5) * 0.5 });
  }
  const N = 48, lattice = Array.from({ length: N * N }, () => rand()), at = (i, j) => lattice[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const mottle = (u, v) => { const x = u * N, y = v * N, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; };
  const c = canvas(W, H), b = canvas(W, H), cg = c.getContext("2d"), bg = b.getContext("2d");
  const ci = cg.createImageData(W, H), bi = bg.createImageData(W, H);
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
    const edge = d2 - d1, face = Math.min(1, Math.max(0, (edge - joint) / 0.2)), round = Math.pow(face, 0.5);
    const grit = (rand() - 0.5) * 20, o = (py * W + px) * 4, mortar = edge < joint;
    const shade = mortar ? 1 + blot * 0.1 : 0.82 + 0.18 * round + (ox * s1.tilt - oy * 0.12) * 0.22 + blot * 0.24;
    const col = mortar ? [130, 121, 106] : s1.c;
    for (let k = 0; k < 3; k++) ci.data[o + k] = Math.max(0, Math.min(255, col[k] * shade + grit));
    const hgt = mortar ? 52 + grit : 92 + 128 * round + blot * 56 + grit * 0.8;
    bi.data[o] = bi.data[o + 1] = bi.data[o + 2] = Math.max(0, Math.min(255, hgt)); ci.data[o + 3] = bi.data[o + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); bg.putImageData(bi, 0, 0);
  const map = texture(c, [1, 1]), bumpMap = new THREE.CanvasTexture(b); bumpMap.anisotropy = 8; bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
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
  else { gr.addColorStop(0, "#3f95dc"); gr.addColorStop(0.6, "#8cc8f0"); gr.addColorStop(0.88, "#d3ecf8"); gr.addColorStop(1, "#f4f6ec"); }
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  if (night) { for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255, 255, 255, ${0.3 + rand() * 0.7})`; g.fillRect(rand() * 1024, rand() * 420, 1 + rand(), 1 + rand()); } }
  else for (let k = 0; k < 9; k++) {
    const cx = rand() * 1024, cy = 330 + rand() * 110, s = 30 + rand() * 40;
    for (let p = 0; p < 9; p++) { const x = cx + (rand() - 0.5) * s * 3.4, y = cy + (rand() - 0.5) * s * 0.5, r = s * (0.5 + rand() * 0.6), cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, "rgba(255, 255, 255, .8)"); cg.addColorStop(1, "rgba(255, 255, 255, 0)"); g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }
  return texture(c);
}

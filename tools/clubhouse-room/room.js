// The clubhouse: a grand beach bungalow and the ultimate man cave, seen from just inside the front. A natural thatched beach-hut
// ceiling (no beams) with wooden leaf cabana fans; white shiplap walls; pale oak floors; the whole back wall glass onto the pool
// patio, palms, tiki torches and the sea. The real trophies stand in the middle, each on its own pedestal, under a chandelier. The
// left wall is the sportsbook with the Big Board above it, both on brackets turned towards the room; the bar runs along the back
// left under a neon sign, the champions' banners hanging over it; on the right a grand floor-to-ceiling stone chimney with a TV
// over the mantel and the constitution framed on it, the lounge in front with the race on the coffee table; the Survivor poker
// table in the foreground. Units are metres: x left to right, z from the front wall (0) to the back (-RD).
import { THREE, RoundedBoxGeometry, materials } from "/lib.js";
import { pennantCup } from "/trophies.js";
import { hexBase, ivorySpire, crystalSpade, bowlBase, emeraldBase } from "/trophies2.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const RW = 8.4, RD = 15, WH = 4.2, RIDGE = 7.2;
const X0 = -RW / 2, X1 = RW / 2, ZB = -RD;

// ---------- helpers
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function texture(c, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
function add(parent, geometry, material, [x, y, z], { cast = true, receive = true, rot } = {}) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r);
const cyl = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);
const rand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

// ---------- textures
function oakFloor() {
  const c = canvas(1024, 1024), g = c.getContext("2d"), rows = 6, h = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -((r * 397) % 700);
    while (x < 1024) {
      const len = 520 + Math.floor(rand() * 380), t = 178 + Math.floor(rand() * 24);
      g.fillStyle = `rgb(${t + 14}, ${t - 14}, ${t - 52})`; g.fillRect(x, r * h, len, h);
      for (let k = 0; k < 10; k++) { g.strokeStyle = `rgba(150, 110, 70, ${0.05 + rand() * 0.06})`; g.lineWidth = 1 + rand() * 2; g.beginPath(); const y = r * h + 8 + k * (h / 11); g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y + 4 * rand(), x + len * 0.7, y - 4 * rand(), x + len, y); g.stroke(); }
      g.fillStyle = "rgba(120, 90, 60, .35)"; g.fillRect(x, r * h, 2, h); x += len;
    }
    g.fillStyle = "rgba(120, 90, 60, .4)"; g.fillRect(0, r * h, 1024, 2);
  }
  return texture(c, [2, 5]);
}
function shiplap(lines = 16, base = "#f7f4ec") {
  const c = canvas(256, 1024), g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < lines; i++) { const y = (i * 1024) / lines; g.fillStyle = "rgba(120, 110, 95, .22)"; g.fillRect(0, y, 256, 3); g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(0, y + 3, 256, 2); }
  return c;
}
function fieldstone() {
  const c = canvas(1024, 1024), g = c.getContext("2d");
  g.fillStyle = "#b9b1a3"; g.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 14; row++) {
    let x = -40 * rand();
    while (x < 1024) {
      const w = 90 + rand() * 120, h = 58 + rand() * 26, y = row * 74 + rand() * 6;
      const t = 150 + Math.floor(rand() * 70), warm = Math.floor(rand() * 18);
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, `rgb(${t + warm + 18}, ${t + 12}, ${t - 2})`); gr.addColorStop(1, `rgb(${t + warm - 22}, ${t - 28}, ${t - 40})`);
      g.fillStyle = gr; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 4, h / 2 - 4, (rand() - 0.5) * 0.15, 0, Math.PI * 2); g.fill();
      x += w + 4;
    }
  }
  return texture(c, [0.9, 1.7]);
}
function thatch() {
  const c = canvas(1024, 1024), g = c.getContext("2d");
  g.fillStyle = "#8f6f3c"; g.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 12; row++) {
    const y0 = row * 86 - 10;
    for (let i = 0; i < 2600; i++) {
      const x = rand() * 1024, len = 70 + rand() * 60, t = 150 + Math.floor(rand() * 70);
      g.strokeStyle = `rgba(${t + 46}, ${t + 14}, ${t - 52}, ${0.5 + rand() * 0.45})`; g.lineWidth = 1 + rand() * 2.2;
      g.beginPath(); g.moveTo(x, y0 + rand() * 10); g.lineTo(x + (rand() - 0.5) * 14, y0 + len); g.stroke();
    }
    const shade = g.createLinearGradient(0, y0 + 70, 0, y0 + 96); shade.addColorStop(0, "rgba(50, 32, 12, 0)"); shade.addColorStop(1, "rgba(50, 32, 12, .45)");
    g.fillStyle = shade; g.fillRect(0, y0 + 70, 1024, 26);
  }
  return texture(c, [2, 4]);
}
function gameOnTv() {
  const c = canvas(640, 360), g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, "#2f7d3a"); gr.addColorStop(1, "#1f5e2a"); g.fillStyle = gr; g.fillRect(0, 0, 640, 360);
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) { const x = 40 + i * 70; g.beginPath(); g.moveTo(x, 70); g.lineTo(x - 30 + i * 4, 360); g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? "#e6e6e6" : "#c8102e"; g.beginPath(); g.arc(120 + (i % 7) * 60 + (i > 6 ? 30 : 0), 200 + (i > 6 ? 40 : 0), 9, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(10,14,20,.88)"; g.fillRect(20, 300, 600, 44);
  g.font = "700 26px Arial"; g.fillStyle = "#fff"; g.fillText("PIT 17", 40, 331); g.fillText("CLE 14", 170, 331); g.fillStyle = "#f0b429"; g.fillText("4TH  2:41", 470, 331);
  return texture(c);
}
function neon(text) {
  const c = canvas(1024, 200), g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 1024, 200);
  g.font = "italic 700 104px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "#ff5fa2"; g.shadowBlur = 30; g.strokeStyle = "#ffd1e6"; g.lineWidth = 7; g.strokeText(text, 512, 104);
  g.shadowBlur = 12; g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeText(text, 512, 104);
  return texture(c);
}
function linenTex(color = "#eee8da") { const c = canvas(128, 128), g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 128; i += 2) { g.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.03})`; g.fillRect(0, i, 128, 1); g.fillRect(i, 0, 1, 128); } return texture(c, [4, 4]); }
function jute() { const c = canvas(256, 256), g = c.getContext("2d"); g.fillStyle = "#c9b48a"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 6) for (let x = 0; x < 256; x += 6) { g.fillStyle = `rgba(110, 85, 50, ${0.15 + rand() * 0.2})`; g.fillRect(x + ((y / 6) % 2) * 3, y, 4, 3); } g.strokeStyle = "#8a6a3e"; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236); return texture(c, [1, 1]); }
function oddsBoard(seed) {
  const c = canvas(512, 384), g = c.getContext("2d");
  g.fillStyle = "#070706"; g.fillRect(0, 0, 512, 384);
  const teams = [["PIT", "CLE"], ["IND", "WAS"], ["LAR", "PHI"], ["SF", "DEN"], ["KC", "BUF"], ["DAL", "NYG"], ["GB", "CHI"], ["MIA", "NE"]];
  g.font = "700 30px 'Courier New', monospace"; g.textBaseline = "middle";
  g.fillStyle = "#f0b429"; g.fillText(["THURSDAY", "SUNDAY 1:00", "SUNDAY 4:25"][seed % 3], 24, 30);
  g.fillStyle = "rgba(240,180,41,.35)"; g.fillRect(20, 52, 472, 2);
  for (let i = 0; i < 4; i++) {
    const [a, b] = teams[(i + seed * 3) % teams.length], y = 92 + i * 76, line = [2.5, 3.5, 3, 1.5, 6.5, 4][(i + seed) % 6];
    g.fillStyle = "#f4efe3"; g.fillText(a, 28, y); g.fillText(b, 28, y + 30);
    g.fillStyle = "#ffb02e"; g.shadowColor = "#ff9a20"; g.shadowBlur = 10; g.fillText(`-${line}`, 360, y); g.fillText(`+${line}`, 360, y + 30); g.shadowBlur = 0;
  }
  return texture(c);
}
function bigBoardFace() {
  const c = canvas(1024, 520), g = c.getContext("2d");
  g.fillStyle = "#080a09"; g.fillRect(0, 0, 1024, 520);
  g.font = "700 46px Georgia, serif"; g.fillStyle = "#f0ece2"; g.textBaseline = "middle";
  g.fillText("P I C K ’ E M", 36, 48); g.font = "700 24px Arial"; g.fillStyle = "rgba(240,236,226,.7)"; g.fillText("WEEK 10 · OFFICIAL", 740, 48);
  [["15", "EARL"], ["14", "WALT"], ["13", "DOTTIE"], ["12", "JUNE"], ["11", "ROSIE"], ["10", "LOU"]].forEach(([w, n], i) => {
    const y = 116 + i * 66;
    g.fillStyle = "#121a15"; g.fillRect(28, y - 28, 968, 56);
    g.font = "900 36px 'Courier New', monospace"; g.fillStyle = "#ffb02e"; g.shadowColor = "#ff9a20"; g.shadowBlur = 12; g.fillText(w, 46, y); g.shadowBlur = 0;
    g.font = "800 32px Arial"; g.fillStyle = "#f0ece2"; g.fillText(n, 130, y);
    for (let k = 0; k < 2; k++) { g.font = "700 28px 'Courier New', monospace"; g.fillStyle = "#bef0c8"; g.fillText(["PIT -2.5", "IND -3.5", "LAR +3", "SF -3"][(i + k) % 4], 470 + k * 250, y); }
  });
  return texture(c);
}
function sign(text, { w = 1024, h = 160, bg = "#1f4a36", ink = "#e6cf98", font = "700 96px Georgia, serif" } = {}) {
  const c = canvas(w, h), g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
  g.font = font; g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 4);
  return texture(c);
}
function parchment() {
  const c = canvas(512, 640), g = c.getContext("2d");
  const gr = g.createRadialGradient(256, 300, 40, 256, 320, 420); gr.addColorStop(0, "#f7efd8"); gr.addColorStop(1, "#e3d1a6");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
  g.fillStyle = "#3b2a18"; g.textAlign = "center"; g.font = "700 50px Georgia, serif"; g.fillText("Constitution", 256, 92);
  g.font = "italic 26px Georgia, serif"; g.fillText("Lead Pipe Locks", 256, 132);
  g.fillStyle = "rgba(59,42,24,.55)"; for (let i = 0; i < 15; i++) { const w = 330 - ((i * 53) % 90); g.fillRect(256 - w / 2, 184 + i * 26, w, 5); }
  g.fillStyle = "#8c1e24"; g.beginPath(); g.arc(400, 580, 26, 0, Math.PI * 2); g.fill();
  return texture(c);
}
function screenTex() { const c = canvas(256, 160), g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, "#2d4f6e"); gr.addColorStop(1, "#1a3047"); g.fillStyle = gr; g.fillRect(0, 0, 256, 160); g.fillStyle = "rgba(255,255,255,.2)"; for (let i = 0; i < 5; i++) g.fillRect(24, 24 + i * 24, 120 + (i % 2) * 60, 10); return texture(c); }
function bookPages() { const c = canvas(512, 320), g = c.getContext("2d"); g.fillStyle = "#f3ead3"; g.fillRect(0, 0, 512, 320); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(254, 0, 4, 320); g.fillStyle = "rgba(40,30,20,.5)"; for (let s = 0; s < 2; s++) for (let i = 0; i < 12; i++) g.fillRect(24 + s * 256, 30 + i * 23, 200 - ((i * 37) % 60), 4); return texture(c); }
function sky(night) {
  const c = canvas(64, 512), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
  if (night) { gr.addColorStop(0, "#040814"); gr.addColorStop(0.7, "#14244a"); gr.addColorStop(1, "#2a3a64"); } else { gr.addColorStop(0, "#5aa9e6"); gr.addColorStop(0.7, "#bfe2f6"); gr.addColorStop(1, "#eef8fd"); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512); return texture(c);
}
function pavers() { const c = canvas(512, 512), g = c.getContext("2d"); g.fillStyle = "#e8dcc4"; g.fillRect(0, 0, 512, 512); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const t = 222 + Math.floor(rand() * 18); g.fillStyle = `rgb(${t + 10}, ${t}, ${t - 22})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122); } return texture(c, [8, 5]); }

export async function buildRoom(q) {
  const night = q.get("night") === "1";
  const bowl = q.get("bowl") === "1";
  const W = Number(q.get("w") ?? 390), H = Number(q.get("h") ?? 760), scale = Number(q.get("scale") ?? 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = night ? 1.0 : 0.9;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(scale); renderer.setSize(W, H, false);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x0b1220 : 0xdfeef7);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = night ? 0.3 : 0.75;

  const m = materials();
  const white = std(0xf7f4ec, { roughness: 0.85 });
  const timber = std(0x7a5634, { roughness: 0.7 });
  const timberDark = std(0x8a6440, { roughness: 0.65 });
  const brass = m.brass;
  const linen = new THREE.MeshStandardMaterial({ map: linenTex(), roughness: 0.95 });
  const navy = new THREE.MeshStandardMaterial({ map: linenTex("#2f4f6e"), roughness: 0.95 });
  const rattan = std(0xc49a62, { roughness: 0.8 });
  const green = std(0x234d3a, { roughness: 0.6 });
  const glow = (color, intensity) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
  const spots = {};
  const group = (name) => { const g = new THREE.Group(); scene.add(g); if (name) spots[name] = g; return g; };
  const room = group(null);

  // ----- floor, shiplap walls, the vaulted ceiling on timber trusses
  add(room, box(RW, 0.1, RD), new THREE.MeshStandardMaterial({ map: oakFloor(), roughness: 0.45, envMapIntensity: 0.6 }), [0, -0.05, -RD / 2], { cast: false });
  const wallTex = (u, v) => { const t = texture(shiplap()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(u, v); return t; };
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex(4, 1), roughness: 0.85 });
  for (const side of [-1, 1]) {
    add(room, box(0.2, WH, RD), wallMat, [side * (RW / 2 + 0.1), WH / 2, -RD / 2]);
    add(room, box(0.06, 0.18, RD), white, [side * (RW / 2 - 0.02), 0.09, -RD / 2]);                 // skirting
    add(room, box(0.12, 0.14, RD), timber, [side * (RW / 2 - 0.04), WH - 0.07, -RD / 2]);             // wall plate
  }
  const slope = Math.atan2(RIDGE - WH, RW / 2), len = Math.hypot(RW / 2, RIDGE - WH);
  const ceilTex = new THREE.MeshStandardMaterial({ map: thatch(), roughness: 1, side: THREE.DoubleSide });
  for (const side of [-1, 1]) add(room, box(len, 0.08, RD), ceilTex, [side * RW / 4, (WH + RIDGE) / 2 + 0.05, -RD / 2], { rot: [0, 0, side * -slope] });
  // a natural beach hut ceiling: nothing but thatch, no beams; a thatch fringe hangs along the top of each wall
  for (const side of [-1, 1]) add(room, box(0.1, 0.3, RD), ceilTex, [side * (RW / 2 - 0.08), WH + 0.02, -RD / 2], { cast: false });
  // cabana fans: a dark wooden hub and five carved wooden leaf blades, hung from the thatch
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.bezierCurveTo(0.12, 0.12, 0.2, 0.55, 0, 0.95); leaf.bezierCurveTo(-0.2, 0.55, -0.12, 0.12, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leaf, 16);
  const bladeWood = std(0x6b4628, { roughness: 0.55, side: THREE.DoubleSide });
  for (const [fx, fz] of [[-2.1, -7.6], [1.5, -12.2]]) {
    const top = WH + (RIDGE - WH) * (1 - Math.abs(fx) / (RW / 2)), drop = top - 3.55;
    add(room, cyl(0.025, 0.025, drop, 8), timberDark, [fx, top - drop / 2, fz]);
    add(room, cyl(0.16, 0.12, 0.22, 20), timberDark, [fx, 3.5, fz]);
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2 + 0.3, arm = new THREE.Group(); arm.position.set(fx, 3.46, fz); arm.rotation.y = a; room.add(arm);
      const blade = new THREE.Mesh(leafGeo, bladeWood); blade.rotation.set(-Math.PI / 2 + 0.12, 0, -Math.PI / 2); blade.position.set(0.1, 0, 0); blade.castShadow = true; arm.add(blade);
    }
  }

  // ----- the back wall: all glass. Doors below, a glazed gable above, slim black frames.
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, roughness: 0.03, thickness: 0.02, ior: 1.3, transparent: true, opacity: 0.25 });
  const frameMat = std(0x2a2a27, { roughness: 0.4, metalness: 0.4 });
  const gable = new THREE.Shape(); gable.moveTo(X0, 0); gable.lineTo(X1, 0); gable.lineTo(X1, WH); gable.lineTo(0, RIDGE); gable.lineTo(X0, WH); gable.closePath();
  add(room, new THREE.ShapeGeometry(gable), glass, [0, 0, ZB], { cast: false });
  for (let i = 0; i <= 9; i++) { const x = X0 + (i * RW) / 9, h = WH + (RIDGE - WH) * (1 - Math.abs(x) / (RW / 2)); add(room, box(0.06, h, 0.1), frameMat, [x, h / 2, ZB]); }
  add(room, box(RW, 0.08, 0.12), frameMat, [0, 2.9, ZB]); add(room, box(RW, 0.06, 0.12), frameMat, [0, 0.03, ZB]);
  for (const side of [-1, 1]) add(room, box(len, 0.08, 0.12), frameMat, [side * RW / 4, (WH + RIDGE) / 2, ZB], { rot: [0, 0, side * -slope] });

  // ----- outside: the pool patio, loungers, palms, the sea and the sky
  const out = group(null);
  add(out, box(40, 0.1, 22), new THREE.MeshStandardMaterial({ map: pavers(), roughness: 0.85 }), [0, -0.06, ZB - 11], { cast: false });
  add(out, box(10.6, 0.12, 4.6), std(0xf4efe4), [0.6, 0.0, ZB - 6.2], { cast: false });
  const water = new THREE.MeshPhysicalMaterial({ color: night ? 0x18a6cf : 0x2fc0e0, roughness: 0.06, clearcoat: 1, emissive: night ? 0x0a7aa0 : 0x0a4a5a, emissiveIntensity: night ? 1.5 : 0.35 });
  add(out, box(10, 0.06, 4.0), water, [0.6, 0.04, ZB - 6.2], { cast: false });
  for (const x of [-3.4, -2.2, 2.6, 3.8]) {
    add(out, rbox(0.75, 0.12, 1.9, 0.04), white, [x, 0.3, ZB - 2.4]);
    add(out, rbox(0.75, 0.1, 0.7, 0.04), white, [x, 0.55, ZB - 1.65], { rot: [0.6, 0, 0] });
    add(out, rbox(0.66, 0.06, 1.8, 0.03), std(0x3f8fb0), [x, 0.38, ZB - 2.4]);
  }
  const palm = (x, z, h) => {
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.3, h * 0.5, z), new THREE.Vector3(x + 0.1, h, z)]);
    add(out, new THREE.TubeGeometry(trunk, 20, 0.16, 10), std(0x9a8064, { roughness: 1 }), [0, 0, 0]);
    for (let f = 0; f < 9; f++) {
      const a = (f / 9) * Math.PI * 2, frond = add(out, new THREE.ConeGeometry(0.34, 2.6, 4, 1), std(0x3f8a48, { roughness: 0.9 }), [x + 0.1 + Math.cos(a) * 1.1, h - 0.25, z + Math.sin(a) * 1.1]);
      frond.scale.set(1, 1, 0.2); frond.rotation.set(Math.sin(a) * 1.25, -a, -Math.cos(a) * 1.25 + Math.PI);
    }
  };
  palm(-6.2, ZB - 3.6, 6.2); palm(6.6, ZB - 4.5, 7.2); palm(-3.4, ZB - 10, 5.5); palm(5.0, ZB - 11, 6.4);
  add(out, box(60, 0.05, 40), std(night ? 0x0e2a46 : 0x2a8fbf, { roughness: 0.2 }), [0, -0.3, ZB - 40], { cast: false });   // the sea
  add(out, box(60, 0.4, 2), std(0xe9dcb8), [0, -0.2, ZB - 19.8], { cast: false });                                         // the beach
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 60), new THREE.MeshBasicMaterial({ map: sky(night) }));
  skyPlane.position.set(0, 26, ZB - 58); scene.add(skyPlane);

  // ----- the left wall: the sportsbook (odds boards, a SPORTSBOOK sign, a ticket counter) with the Big Board above it. The boards
  // stand out from the wall on brackets, turned towards the room so they read from where you stand.
  const book = group("sportsbook");
  const SZ = -8.5, TURN = 0.62;
  const angled = (parent, w, h, y, z, faceMap, glowLevel, housing = 0x111110) => {
    const g = new THREE.Group(); g.position.set(X0 + 0.14 + (w / 2) * Math.cos(TURN), y, z); g.rotation.y = TURN; parent.add(g);
    add(g, rbox(w + 0.14, h + 0.14, 0.1, 0.02), std(housing, { roughness: 0.5 }), [0, 0, -0.05]);
    add(g, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: faceMap, emissive: 0xffffff, emissiveMap: faceMap, emissiveIntensity: glowLevel }), [0, 0, 0.005], { cast: false });
    add(parent, box(0.5, 0.05, 0.05), timberDark, [X0 + 0.25, y + h / 2 - 0.1, z]);
    return g;
  };
  add(book, new THREE.PlaneGeometry(4.4, 0.36), new THREE.MeshStandardMaterial({ map: sign("SPORTSBOOK", { w: 1536, h: 130, font: "700 88px Georgia, serif" }), roughness: 0.5 }), [X0 + 0.03, 2.62, SZ], { cast: false, rot: [0, Math.PI / 2, 0] });
  [-1, 0, 1].forEach((k) => angled(book, 1.2, 0.84, 1.9, SZ + k * 1.45, oddsBoard(k + 1), night ? 1.0 : 0.7));
  add(book, rbox(0.8, 1.05, 4.6, 0.03), m.walnut, [X0 + 0.5, 0.525, SZ]);
  add(book, box(0.9, 0.05, 4.7), brass, [X0 + 0.52, 1.07, SZ]);
  const board = group("board");
  angled(board, 2.5, 1.22, 3.5, SZ, bigBoardFace(), night ? 1.0 : 0.62, 0x12281e);

  // ----- the bar along the back wall, left of the doors: counter, back bar, stools; banners hang from the rafters above it
  const bar = group("bar");
  const BX = -2.7, BZ = ZB + 1.4, BL = 3.4;
  add(bar, rbox(BL, 1.1, 0.75, 0.03), m.walnut, [BX, 0.55, BZ]);
  add(bar, rbox(BL + 0.12, 0.07, 0.95, 0.02), std(0xe8e2d4, { roughness: 0.25 }), [BX, 1.13, BZ]);           // pale stone top
  add(bar, cyl(0.025, 0.025, BL, 12), brass, [BX, 0.22, BZ + 0.45], { rot: [0, 0, Math.PI / 2] });
  const plaques = group("plaques");
  for (let i = 0; i < 4; i++) { add(plaques, box(0.42, 0.3, 0.03), timberDark, [BX - 1.2 + i * 0.8, 0.62, BZ + 0.39]); add(plaques, box(0.34, 0.22, 0.02), brass, [BX - 1.2 + i * 0.8, 0.62, BZ + 0.41]); }
  for (let i = 0; i < 4; i++) {
    const x = BX - 1.2 + i * 0.8;
    add(bar, cyl(0.21, 0.21, 0.07, 24), rattan, [x, 0.78, BZ + 0.8]);
    add(bar, cyl(0.03, 0.05, 0.75, 10), brass, [x, 0.38, BZ + 0.8]);
    add(bar, new THREE.TorusGeometry(0.15, 0.012, 6, 24), brass, [x, 0.3, BZ + 0.8], { rot: [Math.PI / 2, 0, 0] });
  }
  for (let s = 0; s < 3; s++) add(bar, box(BL, 0.04, 0.3), timber, [BX, 1.5 + s * 0.42, ZB + 0.22]);
  const bottleColors = [0x2f6a4c, 0x7a3a12, 0xd8d0b8, 0x3a1d0c, 0x9a7a2a, 0x24435e];
  for (let s = 0; s < 3; s++) for (let i = 0; i < 11; i++) add(bar, cyl(0.035, 0.04, 0.27 - (i % 3) * 0.03, 10), new THREE.MeshPhysicalMaterial({ color: bottleColors[(i + s) % 6], roughness: 0.1, transmission: 0.3, thickness: 0.1 }), [BX - BL / 2 + 0.2 + i * 0.3, 1.66 + s * 0.42, ZB + 0.22], { cast: false });
  const sign2 = add(bar, new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: neon("Lead Pipe Locks"), transparent: true, toneMapped: false }), [BX, 2.5, ZB + 0.5], { cast: false });
  sign2.renderOrder = 2;
  add(bar, box(0.5, 0.08, 0.08), brass, [BX + 0.3, 1.55, BZ - 0.1]);
  for (let i = 0; i < 4; i++) { add(bar, cyl(0.03, 0.03, 0.4, 10), brass, [BX + 0.12 + i * 0.12, 1.36, BZ - 0.1]); add(bar, rbox(0.04, 0.16, 0.04, 0.01), std([0x1f4a36, 0x8c1e24, 0xc9a45f, 0x1d3557][i]), [BX + 0.12 + i * 0.12, 1.68, BZ - 0.1]); }
  const record = group("record");
  add(record, rbox(0.56, 0.05, 0.42, 0.01), std(0x6b1f1a, { roughness: 0.5 }), [BX - 1.2, 1.19, BZ]);
  add(record, new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshStandardMaterial({ map: bookPages(), roughness: 0.9 }), [BX - 1.2, 1.22, BZ], { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const chat = group("chat");
  add(chat, rbox(0.38, 0.02, 0.27, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [BX + 1.25, 1.18, BZ + 0.05]);
  const lid = new THREE.Group(); lid.position.set(BX + 1.25, 1.19, BZ - 0.08); lid.rotation.x = -0.3; chat.add(lid);
  add(lid, rbox(0.38, 0.26, 0.02, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [0, 0.13, 0]);
  add(lid, new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ map: screenTex(), emissive: 0xffffff, emissiveMap: screenTex(), emissiveIntensity: 0.85 }), [0, 0.13, 0.012], { cast: false });
  // banners, hung from the rafters over the bar like a stadium's
  const banners = group("banners");
  ["#8c1e24", "#1f4a36", "#1d3557", "#8c1e24", "#1f4a36"].forEach((color, i) => {
    const c = canvas(128, 300), g = c.getContext("2d");
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 0); g.lineTo(128, 240); g.lineTo(64, 300); g.lineTo(0, 240); g.closePath(); g.fill();
    g.strokeStyle = "#e6cf98"; g.lineWidth = 6; g.stroke(); g.fillStyle = "#e6cf98"; g.font = "700 28px Georgia"; g.textAlign = "center";
    g.fillText("CHAMP", 64, 110); g.font = "700 34px Georgia"; g.fillText(String(2022 + i), 64, 160);
    const x = BX - 1.7 + i * 0.85;
    add(banners, new THREE.PlaneGeometry(0.62, 1.45), new THREE.MeshStandardMaterial({ map: texture(c), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), [x, WH - 0.95, ZB + 1.6], { cast: false });
    add(banners, cyl(0.012, 0.012, 0.72, 6), brass, [x, WH - 0.2, ZB + 1.6], { rot: [0, 0, Math.PI / 2] });
  });
  for (const x of [BX - 1.0, BX + 1.0]) {                                                                  // lantern pendants over the bar
    add(bar, cyl(0.01, 0.01, 1.1, 6), frameMat, [x, WH - 0.1, BZ]);
    add(bar, rbox(0.3, 0.42, 0.3, 0.04), rattan, [x, WH - 0.85, BZ]);
    add(bar, cyl(0.07, 0.07, 0.14, 12), glow(0xffd28a, night ? 3 : 1.2), [x, WH - 0.9, BZ], { cast: false });
  }

  // ----- the right wall: a grand fieldstone fireplace, floor to ceiling, the constitution on the chimney; the lounge in front
  const fire = group("fireplace");
  const FZ = -9.6, CD = 1.7, stone = new THREE.MeshStandardMaterial({ map: fieldstone(), roughness: 0.95 });
  add(fire, box(CD, RIDGE, 3.8), stone, [X1 - CD / 2, RIDGE / 2, FZ]);
  add(fire, box(0.6, 0.5, 4.8), stone, [X1 - CD - 0.3, 0.25, FZ]);                                                  // raised hearth
  add(fire, box(0.2, 1.4, 1.9), std(0x15110e, { roughness: 1 }), [X1 - CD - 0.02, 1.2, FZ], { cast: false });
  add(fire, box(0.08, 0.55, 1.4), glow(0xff6a1a, night ? 2.6 : 1.4), [X1 - CD - 0.08, 0.8, FZ], { cast: false });
  for (let i = 0; i < 3; i++) add(fire, cyl(0.07, 0.07, 1.0, 8), std(0x3a2414), [X1 - CD - 0.12, 0.6 + i * 0.05, FZ - 0.15 + i * 0.15], { rot: [Math.PI / 2, 0, 0.3 * i] });
  add(fire, rbox(0.42, 0.26, 4.0, 0.02), timberDark, [X1 - CD - 0.1, 2.25, FZ]);                                     // timber mantel beam
  const flame = new THREE.PointLight(0xff8a3a, night ? 9 : 3.5, 7, 1.5); flame.position.set(X1 - CD - 0.7, 0.9, FZ); fire.add(flame);
  const tv = group("tv");
  const tvMount = new THREE.Group(); tvMount.position.set(X1 - CD - 0.25, 3.25, FZ + 0.1); tvMount.rotation.y = -Math.PI / 2 + 0.55; tv.add(tvMount);
  add(tvMount, rbox(2.0, 1.16, 0.06, 0.02), std(0x0c0c0d, { roughness: 0.3, metalness: 0.3 }), [0, 0, 0]);
  add(tvMount, new THREE.PlaneGeometry(1.9, 1.07), new THREE.MeshStandardMaterial({ map: gameOnTv(), emissive: 0xffffff, emissiveMap: gameOnTv(), emissiveIntensity: night ? 1.0 : 0.8 }), [0, 0, 0.032], { cast: false });
  add(tv, box(0.28, 0.06, 0.06), frameMat, [X1 - CD - 0.12, 3.25, FZ]);
  const charter = group("constitution");
  add(charter, box(1.2, 1.5, 0.06), std(0xa8823a, { metalness: 0.6, roughness: 0.35 }), [X1 - CD / 2, 2.5, FZ + 1.92]);
  add(charter, new THREE.PlaneGeometry(1.02, 1.3), new THREE.MeshStandardMaterial({ map: parchment(), roughness: 0.9 }), [X1 - CD / 2, 2.5, FZ + 1.96], { cast: false });
  add(charter, box(1.3, 0.05, 0.12), brass, [X1 - CD / 2, 3.32, FZ + 1.94]);
    // the lounge: a jute rug, two linen sofas facing each other across the coffee table, a rattan armchair facing the fire
  add(room, box(4.2, 0.012, 4.0), new THREE.MeshStandardMaterial({ map: jute(), roughness: 1 }), [0.6, 0.006, FZ], { cast: false });
  const sofa = (x, z, facing) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = facing; scene.add(s);
    add(s, rbox(2.3, 0.42, 0.95, 0.08), linen, [0, 0.26, 0]);
    add(s, rbox(2.3, 0.75, 0.24, 0.08), linen, [0, 0.55, -0.42]);
    for (const dx of [-1.15, 1.15]) add(s, rbox(0.22, 0.6, 0.95, 0.08), linen, [dx, 0.4, 0]);
    for (const dx of [-0.75, 0.75]) add(s, rbox(0.5, 0.42, 0.14, 0.06), navy, [dx, 0.68, -0.26], { rot: [-0.25, 0, 0] });
  };
  sofa(0.75, FZ - 1.7, 0); sofa(0.75, FZ + 1.7, Math.PI);
  const chair = new THREE.Group(); chair.position.set(-1.05, 0, FZ); chair.rotation.y = Math.PI / 2; scene.add(chair);
  add(chair, rbox(0.85, 0.4, 0.8, 0.1), rattan, [0, 0.22, 0]); add(chair, rbox(0.85, 0.7, 0.14, 0.07), rattan, [0, 0.55, -0.36]); add(chair, rbox(0.7, 0.12, 0.65, 0.05), linen, [0, 0.46, 0.04]);
  const race = group("race");
  add(race, rbox(1.7, 0.4, 0.85, 0.03), m.walnut, [0.75, 0.2, FZ]);
  add(race, box(1.56, 0.02, 0.7), std(0x2f6a46, { roughness: 1 }), [0.75, 0.41, FZ]);
  add(race, box(1.52, 0.022, 0.36), std(0xbf9a6c, { roughness: 1 }), [0.75, 0.412, FZ]);
  for (const dz of [-0.19, 0.19]) add(race, box(1.52, 0.03, 0.012), white, [0.75, 0.43, FZ + dz]);
  for (let k = 0; k < 9; k++) add(race, box(0.01, 0.07, 0.01), white, [0.75 - 0.68 + k * 0.17, 0.46, FZ + 0.2]);
  add(race, box(0.012, 0.1, 0.012), std(0xd4342c), [0.75 + 0.7, 0.47, FZ + 0.2]);
  [0xd4342c, 0x1d3557, 0xf0b429, 0x2f6a46, 0xffffff, 0x7a3a8c].forEach((c, i) => {
    const x = 0.75 + 0.35 - i * 0.12, z = FZ - 0.13 + (i % 4) * 0.08;
    add(race, rbox(0.09, 0.045, 0.035, 0.012), std(0x5a3216), [x, 0.46, z]); add(race, rbox(0.03, 0.03, 0.026, 0.008), std(c), [x + 0.01, 0.495, z]);
  });

  // ----- the trophies: the real three, each on its own pedestal with room to breathe, the Pick'em highest in the middle, on a low
  // round stone dais under a brass chandelier
  const trophies = group("trophies");
  const TX = -0.35, TZ = -6.0;
  add(room, cyl(1.75, 1.8, 0.16, 64), std(0xece6d8, { roughness: 0.4 }), [TX, 0.08, TZ]);
  const pedestals = [[0, -0.25, 1.15], [-1.15, 0.35, 0.8], [1.15, 0.35, 0.8]];
  for (const [dx, dz, h] of pedestals) {
    add(trophies, rbox(0.72, h, 0.72, 0.03), std(0x1f3b2f, { roughness: 0.45 }), [TX + dx, 0.16 + h / 2, TZ + dz]);
    add(trophies, rbox(0.8, 0.05, 0.8, 0.015), brass, [TX + dx, 0.16 + h + 0.025, TZ + dz]);
  }
  const pieces = [[ivorySpire, hexBase, { fin: "coil", material: "white" }, 0], [pennantCup, bowlBase, { material: "white" }, 1], [crystalSpade, emeraldBase, { material: "white" }, 2]].map(([build, base, opts, k]) => {
    const piece = new THREE.Group(); const b = base(m); piece.add(b); const t = build(m, opts); t.position.y = b.userData.height; piece.add(t); return { piece, k };
  });
  const tallest = Math.max(...pieces.map(({ piece }) => new THREE.Box3().setFromObject(piece).getSize(new THREE.Vector3()).y));
  const ts = 1.45 / tallest;
  for (const { piece, k } of pieces) {
    const [dx, dz, h] = pedestals[k];
    piece.scale.setScalar(ts);
    const pb = new THREE.Box3().setFromObject(piece);
    piece.position.set(TX + dx, 0.16 + h + 0.05 - pb.min.y, TZ + dz);
    piece.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    trophies.add(piece);
  }
  add(room, cyl(0.012, 0.012, 2.0, 6), brass, [TX, WH + 0.2, TZ]);
  add(room, new THREE.TorusGeometry(0.75, 0.03, 10, 48), brass, [TX, WH - 0.85, TZ], { rot: [Math.PI / 2, 0, 0], cast: false });
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; add(room, new THREE.SphereGeometry(0.05, 12, 8), glow(0xffe0a8, night ? 4 : 2), [TX + Math.cos(a) * 0.75, WH - 0.78, TZ + Math.sin(a) * 0.75], { cast: false }); }
  const trophySpot = new THREE.SpotLight(0xfff4de, night ? 80 : 55, 10, 0.5, 0.6, 1.3);
  trophySpot.position.set(TX, WH + 1.6, TZ + 2.4); trophySpot.target.position.set(TX, 1.5, TZ); trophySpot.castShadow = true; trophySpot.shadow.mapSize.set(2048, 2048);
  scene.add(trophySpot, trophySpot.target);

  add(room, box(6.2, 0.012, 6.4), new THREE.MeshStandardMaterial({ map: (() => { const c = canvas(512, 512), g = c.getContext('2d'); g.fillStyle = '#d6c6a2'; g.fillRect(0, 0, 512, 512); for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? 'rgba(47,79,110,.18)' : 'rgba(255,255,255,.12)'; g.fillRect(60 + k * 44, 60, 22, 392); } g.strokeStyle = '#2f4f6e'; g.lineWidth = 14; g.strokeRect(18, 18, 476, 476); g.strokeStyle = '#c9a45f'; g.lineWidth = 5; g.strokeRect(44, 44, 424, 424); for (let i = 0; i < 512; i += 4) { g.fillStyle = `rgba(120,100,70,${0.03 + rand() * 0.04})`; g.fillRect(0, i, 512, 2); } return texture(c); })(), roughness: 1 }), [-0.6, 0.007, -5.0], { cast: false });
  // ----- Survivor: the poker table in the foreground, left of centre
  const poker = group("survivor");
  const PX = 1.5, PZ = -3.5;
  const oval = (rx, rz, h, mat, y) => { const mesh = add(poker, cyl(1, 1, h, 64), mat, [PX, y, PZ]); mesh.scale.set(rx, 1, rz); return mesh; };
  oval(1.1, 0.75, 0.08, m.felt, 0.78);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 14, 80), std(0x2a1a12, { roughness: 0.45 }));
  rail.rotation.x = Math.PI / 2; rail.scale.set(1.13, 0.78, 1); rail.position.set(PX, 0.82, PZ); rail.castShadow = true; poker.add(rail);
  add(poker, cyl(0.28, 0.45, 0.74, 24), timberDark, [PX, 0.37, PZ]);
  const chipColors = [0xd4342c, 0x1d3557, 0xf4efe3, 0x2f6a46, 0x111111];
  [[-0.5, 0.15], [-0.15, -0.35], [0.3, 0.3], [0.55, -0.2], [0.05, 0.42]].forEach(([dx, dz], s) => {
    for (let k = 0; k < 3 + (s % 3); k++) add(poker, cyl(0.045, 0.045, 0.018, 20), std(chipColors[(s + k) % 5], { roughness: 0.4 }), [PX + dx, 0.83 + k * 0.019, PZ + dz], { cast: false });
  });
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2 + Math.PI / 6, cx = PX + Math.cos(t) * 1.45, cz = PZ + Math.sin(t) * 1.05;
    const c = new THREE.Group(); c.position.set(cx, 0, cz); c.rotation.y = Math.PI / 2 - t; poker.add(c);
    add(c, rbox(0.44, 0.08, 0.44, 0.03), linen, [0, 0.46, 0]); add(c, rbox(0.44, 0.48, 0.06, 0.03), rattan, [0, 0.74, 0.2]);
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) add(c, cyl(0.02, 0.02, 0.44, 8), timberDark, [lx, 0.22, lz]);
  }

  // ----- palms in woven baskets, and from Dec 7 the Bowl Pool's bulletin board on wheels by the doors
  const plant = (x, z, s = 1) => {
    add(room, cyl(0.3 * s, 0.24 * s, 0.5 * s, 20), rattan, [x, 0.25 * s, z]);
    for (let f = 0; f < 8; f++) { const a = (f / 8) * Math.PI * 2, fr = add(room, new THREE.ConeGeometry(0.16 * s, 1.3 * s, 4, 1), std(0x3f8a48, { roughness: 0.9 }), [x + Math.cos(a) * 0.4 * s, 1.0 * s, z + Math.sin(a) * 0.4 * s]); fr.scale.set(1, 1, 0.25); fr.rotation.set(Math.sin(a) * 0.9, -a, -Math.cos(a) * 0.9); }
  };
  const monstera = (x, z, s = 1) => {
    add(room, cyl(0.28 * s, 0.22 * s, 0.46 * s, 20), std(0xf1ece2, { roughness: 0.6 }), [x, 0.23 * s, z]);
    for (let f = 0; f < 9; f++) { const a = (f / 9) * Math.PI * 2 + rand(), r = 0.25 + rand() * 0.25, lf = add(room, new THREE.CircleGeometry(0.26 * s, 10), std(0x2f6f3a, { roughness: 0.8, side: THREE.DoubleSide }), [x + Math.cos(a) * r * s, (0.75 + rand() * 0.6) * s, z + Math.sin(a) * r * s], { cast: true }); lf.scale.set(1, 1.4, 1); lf.rotation.set(-0.9 - rand() * 0.4, a, 0); }
  };
  plant(X1 - 0.6, ZB + 0.8, 1.4); plant(X1 - 0.6, -5.6, 1.2); plant(X0 + 0.55, -6.5, 1.2);
  monstera(-4.0, ZB + 0.7, 1.1); monstera(2.1, -7.2, 0.9); monstera(-1.0, -12.4, 0.9);
  add(room, rbox(0.55, 2.4, 0.08, 0.04), std(0x3f8fb0, { roughness: 0.35 }), [X1 - 0.35, 1.22, ZB + 2.2], { rot: [0, -0.4, -0.12] });
  for (const [x, z] of [[-4.6, ZB - 1.2], [-1.6, ZB - 1.4], [1.6, ZB - 1.4], [4.6, ZB - 1.2]]) {
    add(out, cyl(0.03, 0.04, 1.8, 8), std(0x6b4a2a), [x, 0.9, z]);
    add(out, cyl(0.07, 0.05, 0.18, 10), std(0x2a2a2a), [x, 1.85, z]);
    add(out, new THREE.ConeGeometry(0.06, 0.22, 10), glow(0xff8a2a, night ? 3 : 1.2), [x, 2.04, z], { cast: false });
    if (night) { const l = new THREE.PointLight(0xff9a40, 2.5, 4, 1.6); l.position.set(x, 2.1, z); out.add(l); }
  }
  if (bowl) {
    const b2 = group("bowl");
    const BBX = 1.5, BBZ = ZB + 1.3;
    add(b2, box(1.4, 1.0, 0.05), std(0xb98a5a, { roughness: 1 }), [BBX, 1.45, BBZ]);
    add(b2, box(1.5, 0.06, 0.08), timberDark, [BBX, 1.98, BBZ]); add(b2, box(1.5, 0.06, 0.08), timberDark, [BBX, 0.92, BBZ]);
    for (const dx of [-0.72, 0.72]) { add(b2, box(0.05, 1.9, 0.05), timberDark, [BBX + dx, 0.95, BBZ]); add(b2, box(0.05, 0.05, 0.55), timberDark, [BBX + dx, 0.12, BBZ]); for (const dz of [-0.24, 0.24]) add(b2, cyl(0.05, 0.05, 0.04, 16), std(0x222222), [BBX + dx, 0.05, BBZ + dz], { rot: [0, 0, Math.PI / 2] }); }
    [[-0.38, 0.16, 0xf6f1e3], [0.2, 0.2, 0xf6f1e3], [0.36, -0.2, 0x1b2a4a], [-0.26, -0.22, 0xf6f1e3]].forEach(([dx, dy, c]) => add(b2, box(0.38, 0.32, 0.01), std(c), [BBX + dx, 1.45 + dy, BBZ + 0.035], { cast: false }));
    const pc = canvas(256, 128), pg = pc.getContext("2d"); pg.fillStyle = "#1b2a4a"; pg.beginPath(); pg.moveTo(0, 0); pg.lineTo(256, 64); pg.lineTo(0, 128); pg.fill(); pg.fillStyle = "#e6cf98"; pg.font = "700 34px Georgia"; pg.fillText("BOWLS", 24, 76);
    add(b2, new THREE.PlaneGeometry(0.55, 0.27), new THREE.MeshStandardMaterial({ map: texture(pc), transparent: true, alphaTest: 0.5 }), [BBX, 2.12, BBZ + 0.04], { cast: false });
  }

  // ----- light: a bright sea-light day pouring through the glass wall, or a warm evening with the pool and lanterns lit
  scene.add(new THREE.HemisphereLight(night ? 0x8090b8 : 0xffffff, night ? 0x2a1e16 : 0xc9b08a, night ? 0.3 : 0.85));
  const sun = new THREE.DirectionalLight(night ? 0x9ab6ff : 0xfff0d4, night ? 0.2 : 3.0);
  sun.position.set(6, 14, ZB - 14); sun.target.position.set(-1, 0, -7);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 1, far: 70 });
  scene.add(sun, sun.target);
  const bounce = new THREE.DirectionalLight(0xfff6e8, night ? 0.05 : 0.35); bounce.position.set(-2, 6, 4); scene.add(bounce);
  for (const [x, y, z, i] of [[0, 5.2, -3.5, 1], [0, 5.2, -9.5, 1], [-3, 3.6, -12.5, 1]]) { const l = new THREE.PointLight(0xffe6c4, (night ? 6 : 2.5) * i, 10, 1.4); l.position.set(x, y, z); scene.add(l); }
  if (night) {
    const poolGlow = new THREE.PointLight(0x3ad0ff, 14, 12, 1.4); poolGlow.position.set(0.6, 0.6, ZB - 6.2); scene.add(poolGlow);
    for (let i = 0; i < 12; i++) add(out, new THREE.SphereGeometry(0.05, 8, 6), glow(0xffd28a, 3), [-5 + i * 0.9, 3.1 - Math.sin((i / 11) * Math.PI) * 0.5, ZB - 3.2], { cast: false });
  }

  // ----- camera: standing on the landing just inside the front door, looking down the room to the glass wall and the sea
  const camera = new THREE.PerspectiveCamera(Number(q.get("fov") ?? 86), W / H, 0.1, 200);
  camera.position.set(...(q.get("cam") ?? "0.3,3.0,-0.3").split(",").map(Number));
  camera.lookAt(...(q.get("look") ?? "-0.4,1.45,-9").split(",").map(Number));
  camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);

  const outSpots = {};
  for (const [name, g] of Object.entries(spots)) {
    const b = new THREE.Box3().setFromObject(g); if (b.isEmpty()) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera); const px = (p.x + 1) / 2, py = (1 - p.y) / 2;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const r = (v) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
    const x0c = r(x0), y0c = r(y0);
    outSpots[name] = { x: x0c, y: y0c, w: r(r(x1) - x0c), h: r(r(y1) - y0c) };
  }
  window.__spots = { width: W, height: H, spots: outSpots };
  renderer.render(scene, camera);
  window.__webp = renderer.domElement.toDataURL("image/webp", 0.82);
  window.__png = renderer.domElement.toDataURL("image/png");
  window.__done = true;
}

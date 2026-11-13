// The clubhouse: a grand beach bungalow and the ultimate man cave, seen from just inside the front, looking down the room. Nothing
// in it is turned to the camera by a trick: what has to be read hangs on the wall that faces you, and the side walls carry the
// things that look right in perspective.
//  - Ceiling: natural beach-hut thatch, no beams, two big wide-leaf cabana fans down the middle.
//  - Back wall, left: the sportsbook, face on: the Big Board, the SPORTSBOOK sign, the odds boards and the ticket counter.
//  - Back wall, right: glass onto the pool patio, palms, tiki torches and the sea.
//  - Left wall: the bar running down the room, stools along it, the back bar and a neon sign on the wall, the champions' banners
//    hanging over it one behind another, the plaques along its front, the record book and the laptop on top.
//  - Right wall: a grand floor-to-ceiling stone chimney, a TV over the mantel, the constitution framed on it; the lounge in front
//    with the race on the coffee table.
//  - Middle: the real trophies, each on its own pedestal. Foreground: the Survivor poker table.
// Units are metres: x left to right, z from the front wall (0) to the back (-RD).
import { THREE, RoundedBoxGeometry, materials } from "/lib.js";
import { pennantCup } from "/trophies.js";
import { hexBase, ivorySpire, crystalSpade, bowlBase, emeraldBase } from "/trophies2.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const RW = 8.4, RD = 13.6, WH = 4.2, RIDGE = 7.2;
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
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? "#2c7a3a" : "#348a43"; g.fillRect(i * 64, 0, 64, 360); }
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3;
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * 64, 44); g.lineTo(i * 64, 360); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,.8)"; g.font = "700 30px Arial"; g.textAlign = "center";
  ["2 0", "3 0", "4 0", "5 0", "4 0"].forEach((n, i) => g.fillText(n, 128 + i * 128, 330));
  g.fillStyle = "#1f6fe0"; g.fillRect(316, 44, 5, 316); g.fillStyle = "#ffd60a"; g.fillRect(444, 44, 5, 316);
  for (let i = 0; i < 11; i++) { const y = 80 + i * 22; g.fillStyle = "#101418"; g.beginPath(); g.arc(300 - (i % 3) * 22, y, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = "#f4f4f4"; g.beginPath(); g.arc(338 + (i % 4) * 20, y + 6, 8, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(10,14,20,.92)"; g.fillRect(0, 0, 640, 44);
  g.font = "700 24px Arial"; g.textAlign = "left"; g.fillStyle = "#fff"; g.fillText("PIT  17", 20, 30); g.fillText("CLE  14", 170, 30);
  g.fillStyle = "#f0b429"; g.fillText("4TH  2:41", 340, 30); g.fillStyle = "#fff"; g.fillText("3RD & 4", 500, 30);
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
function leafBlade() {
  const c = canvas(256, 512), g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "#5a3418"); gr.addColorStop(0.5, "#8a5a2e"); gr.addColorStop(1, "#5a3418");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "rgba(40, 22, 8, .55)"; g.lineWidth = 3;
  for (let i = 0; i < 16; i++) { const y = 500 - i * 30; for (const side of [-1, 1]) { g.beginPath(); g.moveTo(128, y); g.quadraticCurveTo(128 + side * 60, y - 34, 128 + side * 124, y - 86); g.stroke(); } }
  g.strokeStyle = "#c79a5c"; g.lineWidth = 7; g.beginPath(); g.moveTo(128, 512); g.lineTo(128, 0); g.stroke();
  const t = texture(c); t.repeat.set(1 / 0.7, 1); t.offset.set(0.5, 0); return t;
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
  const W = Number(q.get("w") ?? 390), H = Number(q.get("h") ?? 700), scale = Number(q.get("scale") ?? 2);

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
  scene.environmentIntensity = night ? 0.2 : 0.75;

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
  // cabana fans: two big ones down the middle of the room, wide carved-leaf blades, brass fittings, a frosted light under each
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.bezierCurveTo(0.36, 0.1, 0.44, 0.62, 0, 1.0); leaf.bezierCurveTo(-0.44, 0.62, -0.36, 0.1, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leaf, 24);
  const bladeWood = new THREE.MeshStandardMaterial({ map: leafBlade(), roughness: 0.5, side: THREE.DoubleSide });
  for (const [fx, fz, spin] of [[-0.1, -6.0, 0.3], [0.1, -10.2, 0.9]]) {
    const top = WH + (RIDGE - WH) * (1 - Math.abs(fx) / (RW / 2)), hub = 5.05, drop = top - hub;
    add(room, cyl(0.03, 0.03, drop, 8), brass, [fx, top - drop / 2, fz]);
    add(room, cyl(0.1, 0.16, 0.16, 20), brass, [fx, hub + 0.2, fz]);
    add(room, cyl(0.2, 0.17, 0.24, 24), timberDark, [fx, hub, fz]);
    add(room, new THREE.TorusGeometry(0.2, 0.02, 8, 32), brass, [fx, hub - 0.1, fz], { rot: [Math.PI / 2, 0, 0], cast: false });
    const bowl2 = add(room, new THREE.SphereGeometry(0.19, 20, 14), glow(0xffe9c4, night ? 3.2 : 1.5), [fx, hub - 0.2, fz], { cast: false }); bowl2.scale.set(1, 0.6, 1);
    for (let b = 0; b < 5; b++) {
      const arm = new THREE.Group(); arm.position.set(fx, hub - 0.04, fz); arm.rotation.set(0, (b / 5) * Math.PI * 2 + spin, -0.1); room.add(arm);
      add(arm, box(0.3, 0.025, 0.07), brass, [0.3, 0, 0]);
      const blade = new THREE.Mesh(leafGeo, bladeWood); blade.scale.setScalar(1.6); blade.rotation.set(-Math.PI / 2 + 0.16, 0, -Math.PI / 2); blade.position.set(0.32, 0, 0); blade.castShadow = true; arm.add(blade);
    }
    if (night) { const l = new THREE.PointLight(0xffd9a0, 5, 7, 1.5); l.position.set(fx, hub - 0.4, fz); scene.add(l); }
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

  // ----- the back wall, left: the sportsbook, face on. A white shiplap wall from the floor to the thatch; on it the Big Board, the
  // SPORTSBOOK sign and a row of odds boards; the ticket counter in front.
  const book = group("sportsbook");
  const SX1 = -0.5, SX = (X0 + SX1) / 2, SWALL = ZB + 0.12, roofAt = (x) => WH + (RIDGE - WH) * (1 - Math.abs(x) / (RW / 2));
  const wallShape = new THREE.Shape(); wallShape.moveTo(X0, 0); wallShape.lineTo(SX1, 0); wallShape.lineTo(SX1, roofAt(SX1)); wallShape.lineTo(X0, WH); wallShape.closePath();
  add(room, new THREE.ShapeGeometry(wallShape), new THREE.MeshStandardMaterial({ map: wallTex(0.25, 1 / 4.2), roughness: 0.85 }), [0, 0, SWALL], { cast: false });
  add(room, box(0.14, roofAt(SX1), 0.2), timberDark, [SX1, roofAt(SX1) / 2, SWALL]);
  const lit = (parent, w, h, x, y, faceMap, level, housing = 0x111110) => {
    add(parent, rbox(w + 0.14, h + 0.14, 0.1, 0.02), std(housing, { roughness: 0.5 }), [x, y, SWALL + 0.05]);
    add(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: faceMap, emissive: 0xffffff, emissiveMap: faceMap, emissiveIntensity: level }), [x, y, SWALL + 0.105], { cast: false });
  };
  add(book, rbox(3.3, 0.34, 0.06, 0.015), std(0x1f4a36, { roughness: 0.5 }), [SX + 0.1, 2.36, SWALL + 0.03]);
  add(book, new THREE.PlaneGeometry(3.22, 0.28), new THREE.MeshStandardMaterial({ map: sign("SPORTSBOOK", { w: 2048, h: 178, font: "700 112px Georgia, serif" }), roughness: 0.5 }), [SX + 0.1, 2.36, SWALL + 0.065], { cast: false });
  [-1, 0, 1].forEach((k) => lit(book, 0.96, 0.66, SX + 0.1 + k * 1.1, 1.72, oddsBoard(k + 1), night ? 1.0 : 0.7));
  add(book, rbox(3.4, 1.05, 0.7, 0.03), m.walnut, [SX + 0.1, 0.525, ZB + 0.75]);
  add(book, box(3.5, 0.05, 0.8), brass, [SX + 0.1, 1.075, ZB + 0.75]);
  for (const dx of [-1.0, 0.2, 1.2]) add(book, box(0.2, 0.03, 0.12), white, [SX + dx, 1.115, ZB + 0.8], { cast: false });       // ticket pads
  add(book, cyl(0.05, 0.04, 0.1, 12), brass, [SX + 1.5, 1.15, ZB + 0.8]);
  const board = group("board");
  lit(board, 3.1, 1.57, SX + 0.1, 3.45, bigBoardFace(), night ? 1.0 : 0.62, 0x12281e);
  add(board, box(3.3, 0.04, 0.05), brass, [SX + 0.1, 4.33, SWALL + 0.1]);

  // ----- the left wall: the bar, running down the room. Counter and stools, the back bar and a neon sign on the wall, lanterns
  // over it, the plaques along its front; the champions' banners hang over it one behind another, each facing the door.
  const bar = group("bar");
  const BXc = X0 + 0.95, BZ = -8.5, BL = 5.6;
  add(bar, rbox(0.75, 1.1, BL, 0.03), m.walnut, [BXc, 0.55, BZ]);
  add(bar, rbox(0.95, 0.07, BL + 0.12, 0.02), std(0xe8e2d4, { roughness: 0.25 }), [BXc, 1.13, BZ]);          // pale stone top
  add(bar, cyl(0.025, 0.025, BL, 12), brass, [BXc + 0.45, 0.22, BZ], { rot: [Math.PI / 2, 0, 0] });
  const plaques = group("plaques");
  for (let i = 0; i < 5; i++) { const z = BZ + 2.2 - i * 1.1; add(plaques, box(0.03, 0.32, 0.46), timberDark, [BXc + 0.39, 0.62, z]); add(plaques, box(0.02, 0.24, 0.38), brass, [BXc + 0.41, 0.62, z]); }
  for (let i = 0; i < 5; i++) {
    const z = BZ + 2.2 - i * 1.1;
    add(bar, cyl(0.21, 0.21, 0.07, 24), rattan, [BXc + 0.9, 0.78, z]);
    add(bar, cyl(0.03, 0.05, 0.75, 10), brass, [BXc + 0.9, 0.38, z]);
    add(bar, new THREE.TorusGeometry(0.15, 0.012, 6, 24), brass, [BXc + 0.9, 0.3, z], { rot: [Math.PI / 2, 0, 0] });
  }
  add(bar, box(0.06, 1.9, BL), std(0x1f3b2f, { roughness: 0.6 }), [X0 + 0.04, 2.15, BZ]);                    // the back bar's panel
  add(bar, box(0.1, 0.08, BL + 0.1), timberDark, [X0 + 0.06, 3.12, BZ]);
  for (let s = 0; s < 2; s++) add(bar, box(0.28, 0.04, BL - 0.2), timber, [X0 + 0.2, 1.5 + s * 0.42, BZ]);
  const bottleColors = [0x2f6a4c, 0x7a3a12, 0xd8d0b8, 0x3a1d0c, 0x9a7a2a, 0x24435e];
  for (let s = 0; s < 2; s++) for (let i = 0; i < 17; i++) add(bar, cyl(0.035, 0.04, 0.27 - (i % 3) * 0.03, 10), new THREE.MeshPhysicalMaterial({ color: bottleColors[(i + s) % 6], roughness: 0.1, transmission: 0.3, thickness: 0.1 }), [X0 + 0.2, 1.66 + s * 0.42, BZ - BL / 2 + 0.3 + i * 0.31], { cast: false });
  add(bar, new THREE.PlaneGeometry(2.8, 0.55), new THREE.MeshBasicMaterial({ map: neon("Lead Pipe Locks"), transparent: true, toneMapped: false }), [X0 + 0.085, 2.56, -10.0], { cast: false, rot: [0, Math.PI / 2, 0] }).renderOrder = 2;
  add(bar, box(0.08, 0.08, 0.5), brass, [BXc - 0.1, 1.55, BZ - 1.0]);
  for (let i = 0; i < 4; i++) { add(bar, cyl(0.03, 0.03, 0.4, 10), brass, [BXc - 0.1, 1.36, BZ - 1.18 + i * 0.12]); add(bar, rbox(0.04, 0.16, 0.04, 0.01), std([0x1f4a36, 0x8c1e24, 0xc9a45f, 0x1d3557][i]), [BXc - 0.1, 1.68, BZ - 1.18 + i * 0.12]); }
  for (const z of [BZ + 2.55, BZ - 0.45, BZ - 2.5]) {                                                        // rattan lamps standing on the bar
    add(bar, cyl(0.07, 0.09, 0.03, 16), brass, [BXc - 0.12, 1.18, z]);
    add(bar, cyl(0.012, 0.012, 0.34, 8), brass, [BXc - 0.12, 1.35, z]);
    add(bar, cyl(0.1, 0.16, 0.24, 20), rattan, [BXc - 0.12, 1.6, z]);
    add(bar, cyl(0.05, 0.05, 0.1, 12), glow(0xffd28a, night ? 3 : 1.2), [BXc - 0.12, 1.56, z], { cast: false });
    if (night) { const l = new THREE.PointLight(0xffc27a, 1.6, 3, 1.6); l.position.set(BXc + 0.1, 1.7, z); bar.add(l); }
  }
  const record = group("record");
  add(record, rbox(0.42, 0.05, 0.56, 0.01), std(0x6b1f1a, { roughness: 0.5 }), [BXc, 1.19, BZ + 1.65]);
  add(record, new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshStandardMaterial({ map: bookPages(), roughness: 0.9 }), [BXc, 1.22, BZ + 1.65], { cast: false, rot: [-Math.PI / 2, 0, Math.PI / 2] });
  const chat = group("chat");
  add(chat, rbox(0.27, 0.02, 0.38, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [BXc + 0.05, 1.18, BZ + 0.1]);
  const lid = new THREE.Group(); lid.position.set(BXc - 0.08, 1.19, BZ + 0.1); lid.rotation.set(0, Math.PI / 2, 0); chat.add(lid);
  const lidTilt = new THREE.Group(); lidTilt.rotation.x = -0.3; lid.add(lidTilt);
  add(lidTilt, rbox(0.38, 0.26, 0.02, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [0, 0.13, 0]);
  add(lidTilt, new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ map: screenTex(), emissive: 0xffffff, emissiveMap: screenTex(), emissiveIntensity: 0.85 }), [0, 0.13, 0.012], { cast: false });
  const banners = group("banners");
  ["#8c1e24", "#1f4a36", "#1d3557", "#8c1e24"].forEach((color, i) => {
    const c = canvas(256, 600), g = c.getContext("2d");
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 480); g.lineTo(128, 600); g.lineTo(0, 480); g.closePath(); g.fill();
    g.strokeStyle = "#e6cf98"; g.lineWidth = 12; g.stroke(); g.fillStyle = "#e6cf98"; g.textAlign = "center";
    g.font = "700 52px Georgia"; g.fillText("CHAMPS", 128, 200); g.font = "700 72px Georgia"; g.fillText(String(2026 - i), 128, 300);
    const x = X0 + 0.72, z = -7.6 - i * 1.15, top = 4.5;
    add(banners, new THREE.PlaneGeometry(0.68, 1.6), new THREE.MeshStandardMaterial({ map: texture(c), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), [x, top - 0.82, z], { cast: false });
    add(banners, cyl(0.014, 0.014, 0.78, 6), brass, [x, top, z], { rot: [0, 0, Math.PI / 2] });
    for (const dx of [-0.3, 0.3]) add(room, cyl(0.005, 0.005, roofAt(x + dx) - top, 4), brass, [x + dx, (roofAt(x + dx) + top) / 2, z], { cast: false });
  });

  // ----- the right wall: a grand fieldstone fireplace, floor to ceiling, the constitution on the chimney; the lounge in front
  const fire = group("fireplace");
  const FZ = -9.6, CD = 1.7, stone = new THREE.MeshStandardMaterial({ map: fieldstone(), roughness: 0.95 });
  add(fire, box(CD, RIDGE, 3.8), stone, [X1 - CD / 2, RIDGE / 2, FZ]);
  add(fire, box(0.6, 0.5, 4.8), stone, [X1 - CD - 0.3, 0.25, FZ]);                                                  // raised hearth
  add(fire, box(0.2, 1.4, 1.9), std(0x15110e, { roughness: 1 }), [X1 - CD - 0.02, 1.2, FZ], { cast: false });
  add(fire, box(0.04, 0.7, 1.5), glow(0xb8380a, night ? 1.2 : 0.7), [X1 - CD + 0.06, 0.9, FZ], { cast: false });                    // the glow at the back of the firebox
  [[-0.42, 0.42], [-0.2, 0.66], [0.02, 0.8], [0.24, 0.6], [0.44, 0.38]].forEach(([dz, h], i) => {
    add(fire, new THREE.ConeGeometry(0.13, h, 10), glow(i % 2 ? 0xff7a1a : 0xff5a10, night ? 3.2 : 2.0), [X1 - CD - 0.12, 0.72 + h / 2, FZ + dz], { cast: false });
    add(fire, new THREE.ConeGeometry(0.06, h * 0.6, 8), glow(0xffd24a, night ? 3.6 : 2.4), [X1 - CD - 0.14, 0.72 + h * 0.3, FZ + dz], { cast: false });
  });
  for (let i = 0; i < 3; i++) add(fire, cyl(0.07, 0.07, 1.0, 8), std(0x3a2414), [X1 - CD - 0.12, 0.6 + i * 0.05, FZ - 0.15 + i * 0.15], { rot: [Math.PI / 2, 0, 0.3 * i] });
  add(fire, rbox(0.42, 0.26, 4.0, 0.02), timberDark, [X1 - CD - 0.1, 2.25, FZ]);                                     // timber mantel beam
  const ball = add(fire, new THREE.SphereGeometry(0.1, 20, 14), std(0x6b3a1e, { roughness: 0.6 }), [X1 - CD - 0.1, 2.47, FZ + 1.35]); ball.scale.set(1, 0.95, 1.6);
  add(fire, box(0.012, 0.012, 0.2), white, [X1 - CD - 0.1, 2.57, FZ + 1.35], { cast: false });
  add(fire, rbox(0.03, 0.3, 0.38, 0.008), timberDark, [X1 - CD - 0.02, 2.54, FZ - 1.3], { rot: [0, 0, 0.12] });
  add(fire, box(0.005, 0.22, 0.3), std(0x9fc4dd), [X1 - CD - 0.04, 2.54, FZ - 1.3], { cast: false, rot: [0, 0, 0.12] });
  const flame = new THREE.PointLight(0xff8a3a, night ? 9 : 3.5, 7, 1.5); flame.position.set(X1 - CD - 0.7, 0.9, FZ); fire.add(flame);
  const tv = group("tv");
  const tvMount = new THREE.Group(); tvMount.position.set(X1 - CD - 0.25, 3.25, FZ + 0.1); tvMount.rotation.y = -Math.PI / 2 + 0.55; tv.add(tvMount);
  add(tvMount, rbox(2.0, 1.16, 0.06, 0.02), std(0x0c0c0d, { roughness: 0.3, metalness: 0.3 }), [0, 0, 0]);
  add(tvMount, new THREE.PlaneGeometry(1.9, 1.07), new THREE.MeshStandardMaterial({ map: gameOnTv(), emissive: 0xffffff, emissiveMap: gameOnTv(), emissiveIntensity: night ? 1.0 : 0.8 }), [0, 0, 0.032], { cast: false });
  add(tv, box(0.28, 0.06, 0.06), frameMat, [X1 - CD - 0.12, 3.25, FZ]);
  const charter = group("constitution");
  add(charter, box(0.74, 0.94, 0.06), std(0xa8823a, { metalness: 0.6, roughness: 0.35 }), [X1 - CD + 0.46, 2.6, FZ + 1.92]);
  add(charter, new THREE.PlaneGeometry(0.62, 0.79), new THREE.MeshStandardMaterial({ map: parchment(), roughness: 0.9 }), [X1 - CD + 0.46, 2.6, FZ + 1.96], { cast: false });
  add(charter, box(0.5, 0.04, 0.12), brass, [X1 - CD + 0.46, 3.14, FZ + 1.96]);
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
  // round stone dais under the first fan
  const trophies = group("trophies");
  const TX = -0.1, TZ = -6.0;
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
  const trophySpot = new THREE.SpotLight(0xfff4de, night ? 80 : 55, 10, 0.5, 0.6, 1.3);
  trophySpot.position.set(TX, WH + 1.6, TZ + 2.4); trophySpot.target.position.set(TX, 1.5, TZ); trophySpot.castShadow = true; trophySpot.shadow.mapSize.set(2048, 2048);
  scene.add(trophySpot, trophySpot.target);

  add(room, box(6.2, 0.012, 6.4), new THREE.MeshStandardMaterial({ map: (() => {
    const c = canvas(1024, 1024), g = c.getContext("2d");
    g.fillStyle = "#dccdaa"; g.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? "rgba(47,79,110,.2)" : "rgba(255,255,255,.16)"; g.fillRect(120 + k * 62, 120, 28, 784); }
    for (let i = 0; i < 1024; i += 5) { g.fillStyle = `rgba(110,90,60,${0.04 + rand() * 0.05})`; g.fillRect(0, i, 1024, 2); }
    g.strokeStyle = "#2f4f6e"; g.lineWidth = 26; g.strokeRect(34, 34, 956, 956);
    g.strokeStyle = "#c9a45f"; g.lineWidth = 8; g.strokeRect(84, 84, 856, 856);
    return texture(c);
  })(), roughness: 1 }), [-0.6, 0.007, -5.0], { cast: false });
  // ----- Survivor: the poker table in the foreground, left of centre
  const poker = group("survivor");
  const PX = 1.5, PZ = -3.5;
  const oval = (rx, rz, h, mat, y) => { const mesh = add(poker, cyl(1, 1, h, 64), mat, [PX, y, PZ]); mesh.scale.set(rx, 1, rz); return mesh; };
  oval(1.1, 0.75, 0.08, m.felt, 0.78);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 14, 80), std(0x2a1a12, { roughness: 0.45 }));
  rail.rotation.x = Math.PI / 2; rail.scale.set(1.13, 0.78, 1); rail.position.set(PX, 0.82, PZ); rail.castShadow = true; poker.add(rail);
  add(poker, cyl(0.28, 0.45, 0.74, 24), std(0x2a1a12, { roughness: 0.45 }), [PX, 0.37, PZ]);
  const chipColors = [0xd4342c, 0x1d3557, 0xf4efe3, 0x2f6a46, 0x111111];
  [[-0.12, 0.2], [0.02, 0.24], [0.14, 0.18]].forEach(([dx, dz], s) => {                                     // the pot
    for (let k = 0; k < 5 + s * 2; k++) add(poker, cyl(0.04, 0.04, 0.016, 18), std(chipColors[(s * 2 + (k % 2)) % 5], { roughness: 0.4 }), [PX + dx, 0.83 + k * 0.017, PZ + dz], { cast: false });
  });
  const cardMat = std(0xfbf9f2, { roughness: 0.5 }), cardBack = std(0x8c1e24, { roughness: 0.5 });
  for (let k = 0; k < 5; k++) add(poker, box(0.085, 0.004, 0.12), cardMat, [PX - 0.22 + k * 0.11, 0.824, PZ - 0.02], { cast: false });   // the board
  add(poker, cyl(0.04, 0.04, 0.012, 20), std(0xfbf9f2, { roughness: 0.3 }), [PX + 0.42, 0.828, PZ + 0.02], { cast: false });              // dealer button
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2 + Math.PI / 6;
    for (const off of [-0.05, 0.05]) add(poker, box(0.085, 0.004, 0.12), cardBack, [PX + Math.cos(t) * 0.78 + Math.sin(t) * off, 0.824 + (off > 0 ? 0.004 : 0), PZ + Math.sin(t) * 0.5 - Math.cos(t) * off], { cast: false, rot: [0, -t + Math.PI / 2 + off * 3, 0] });
    for (let k = 0; k < 4 + (a % 3) * 2; k++) add(poker, cyl(0.04, 0.04, 0.016, 18), std(chipColors[(a + (k > 3 ? 1 : 0)) % 5], { roughness: 0.4 }), [PX + Math.cos(t) * 0.62 + Math.cos(t + 1.5) * 0.12, 0.83 + k * 0.017, PZ + Math.sin(t) * 0.4 + Math.sin(t + 1.5) * 0.09], { cast: false });
  }
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
  plant(X1 - 0.6, ZB + 0.8, 1.4); plant(X1 - 0.6, -5.6, 1.2);
  monstera(2.1, -7.2, 0.9); monstera(-0.05, ZB + 0.8, 1.0);
  add(room, rbox(0.55, 2.4, 0.08, 0.04), std(0x3f8fb0, { roughness: 0.35 }), [X1 - 0.35, 1.22, ZB + 1.2], { rot: [0, -0.4, -0.12] });
  for (const [x, z] of [[-4.6, ZB - 1.2], [-1.6, ZB - 1.4], [1.6, ZB - 1.4], [4.6, ZB - 1.2]]) {
    add(out, cyl(0.03, 0.04, 1.8, 8), std(0x6b4a2a), [x, 0.9, z]);
    add(out, cyl(0.07, 0.05, 0.18, 10), std(0x2a2a2a), [x, 1.85, z]);
    add(out, new THREE.ConeGeometry(0.06, 0.22, 10), glow(0xff8a2a, night ? 3 : 1.2), [x, 2.04, z], { cast: false });
    if (night) { const l = new THREE.PointLight(0xff9a40, 2.5, 4, 1.6); l.position.set(x, 2.1, z); out.add(l); }
  }
  if (bowl) {
    const b2 = group("bowl");
    const BBX = 1.5, BBZ = ZB + 0.9;
    add(b2, box(1.4, 1.0, 0.05), std(0xb98a5a, { roughness: 1 }), [BBX, 1.45, BBZ]);
    add(b2, box(1.5, 0.06, 0.08), timberDark, [BBX, 1.98, BBZ]); add(b2, box(1.5, 0.06, 0.08), timberDark, [BBX, 0.92, BBZ]);
    for (const dx of [-0.72, 0.72]) { add(b2, box(0.05, 1.9, 0.05), timberDark, [BBX + dx, 0.95, BBZ]); add(b2, box(0.05, 0.05, 0.55), timberDark, [BBX + dx, 0.12, BBZ]); for (const dz of [-0.24, 0.24]) add(b2, cyl(0.05, 0.05, 0.04, 16), std(0x222222), [BBX + dx, 0.05, BBZ + dz], { rot: [0, 0, Math.PI / 2] }); }
    [[-0.38, 0.16, 0xf6f1e3], [0.2, 0.2, 0xf6f1e3], [0.36, -0.2, 0x1b2a4a], [-0.26, -0.22, 0xf6f1e3]].forEach(([dx, dy, c]) => add(b2, box(0.38, 0.32, 0.01), std(c), [BBX + dx, 1.45 + dy, BBZ + 0.035], { cast: false }));
    const pc = canvas(256, 128), pg = pc.getContext("2d"); pg.fillStyle = "#1b2a4a"; pg.beginPath(); pg.moveTo(0, 0); pg.lineTo(256, 64); pg.lineTo(0, 128); pg.fill(); pg.fillStyle = "#e6cf98"; pg.font = "700 34px Georgia"; pg.fillText("BOWLS", 24, 76);
    add(b2, new THREE.PlaneGeometry(0.55, 0.27), new THREE.MeshStandardMaterial({ map: texture(pc), transparent: true, alphaTest: 0.5 }), [BBX, 2.12, BBZ + 0.04], { cast: false });
  }

  // ----- light: a bright sea-light day pouring through the glass wall, or a warm evening with the pool and lanterns lit
  scene.add(new THREE.HemisphereLight(night ? 0x8090b8 : 0xffffff, night ? 0x2a1e16 : 0xc9b08a, night ? 0.22 : 0.85));
  const sun = new THREE.DirectionalLight(night ? 0x9ab6ff : 0xfff0d4, night ? 0.2 : 3.0);
  sun.position.set(6, 14, ZB - 14); sun.target.position.set(-1, 0, -7);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 1, far: 70 });
  scene.add(sun, sun.target);
  const bounce = new THREE.DirectionalLight(0xfff6e8, night ? 0.05 : 0.35); bounce.position.set(-2, 6, 4); scene.add(bounce);
  for (const [x, y, z] of [[0, 5.2, -3.5], [0, 5.2, -9.5], [-3, 3.6, -12.5]]) { const l = new THREE.PointLight(night ? 0xffc98a : 0xffe6c4, night ? 3.2 : 2.5, 10, 1.4); l.position.set(x, night ? Math.min(y, 3.3) : y, z); scene.add(l); }
  if (night) {
    const poolGlow = new THREE.PointLight(0x3ad0ff, 14, 12, 1.4); poolGlow.position.set(0.6, 0.6, ZB - 6.2); scene.add(poolGlow);
    for (let i = 0; i < 12; i++) add(out, new THREE.SphereGeometry(0.05, 8, 6), glow(0xffd28a, 3), [-5 + i * 0.9, 3.1 - Math.sin((i / 11) * Math.PI) * 0.5, ZB - 3.2], { cast: false });
  }

  // ----- camera: standing on the landing just inside the front door, looking down the room to the glass wall and the sea
  const camera = new THREE.PerspectiveCamera(Number(q.get("fov") ?? 82), W / H, 0.1, 200);
  camera.position.set(...(q.get("cam") ?? "0.3,3.0,-0.3").split(",").map(Number));
  camera.lookAt(...(q.get("look") ?? "-0.25,1.45,-9").split(",").map(Number));
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

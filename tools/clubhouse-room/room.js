// The clubhouse room: one bright lounge seen from above the cut-away front wall, framed as one tall phone picture. The sliding glass
// doors at the back open onto a pool patio; the Big Board hangs over the doors; the sportsbook runs down the left wall; the bar and
// the fireplace lounge are on the right; the real trophies stand in the middle on their mahogany table; the Survivor poker table is
// at the front. Units are metres: x runs left to right, z from the front edge (0) to the back wall (-13).
import { THREE, RoundedBoxGeometry, materials } from "/lib.js";
import { pennantCup } from "/trophies.js";
import { hexBase, ivorySpire, crystalSpade, bowlBase, emeraldBase } from "/trophies2.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const RW = 7, RD = 13, RH = 4.4, DOOR_W = 4.0, DOOR_H = 3.0;
const X0 = -RW / 2, X1 = RW / 2;

// ---------- small helpers
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

// ---------- textures drawn on canvases
function plankFloor() {
  const c = canvas(1024, 1024), g = c.getContext("2d");
  const rows = 8, h = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -((r * 337) % 600);
    while (x < 1024) {
      const len = 380 + ((r * 7919 + x) % 260);
      const tone = 150 + ((r * 31 + Math.floor(x)) % 34);
      g.fillStyle = `rgb(${tone + 10}, ${tone - 34}, ${tone - 82})`;
      g.fillRect(x, r * h, len, h);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(90, 55, 25, ${0.05 + (k % 3) * 0.02})`; g.beginPath(); const y = r * h + 6 + k * (h / 15); g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y + 3, x + len * 0.6, y - 3, x + len, y + 1); g.stroke(); }
      g.fillStyle = "rgba(60, 36, 18, 0.55)"; g.fillRect(x, r * h, 2, h);
      x += len;
    }
    g.fillStyle = "rgba(60, 36, 18, 0.6)"; g.fillRect(0, r * h, 1024, 2);
  }
  return texture(c, [3, 6]);
}

function pavers() {
  const c = canvas(512, 512), g = c.getContext("2d");
  g.fillStyle = "#d9cdb4"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = 205 + ((x * 13 + y * 29) % 20);
    g.fillStyle = `rgb(${t + 14}, ${t + 2}, ${t - 22})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
  }
  return texture(c, [6, 4]);
}

/** A sportsbook odds board: amber rows of teams and lines on black. */
function oddsBoard(seed) {
  const c = canvas(512, 384), g = c.getContext("2d");
  g.fillStyle = "#070706"; g.fillRect(0, 0, 512, 384);
  const teams = [["PIT", "CLE"], ["IND", "WAS"], ["LAR", "PHI"], ["SF", "DEN"], ["KC", "BUF"], ["DAL", "NYG"], ["GB", "CHI"], ["MIA", "NE"]];
  g.font = "700 30px 'Courier New', monospace"; g.textBaseline = "middle";
  g.fillStyle = "#f0b429"; g.fillText(seed === 0 ? "THU · SUN" : seed === 1 ? "SUN 1:00" : "SUN · MON", 24, 30);
  g.fillStyle = "rgba(240,180,41,.35)"; g.fillRect(20, 52, 472, 2);
  for (let i = 0; i < 4; i++) {
    const [a, b] = teams[(i + seed * 3) % teams.length], y = 92 + i * 76, line = [2.5, 3.5, 3, 1.5, 6.5, 4][(i + seed) % 6];
    g.fillStyle = "#f4efe3"; g.fillText(a, 28, y); g.fillText(b, 28, y + 30);
    g.fillStyle = "#ffb02e"; g.shadowColor = "#ff9a20"; g.shadowBlur = 10; g.fillText(`-${line}`, 360, y); g.fillText(`+${line}`, 360, y + 30); g.shadowBlur = 0;
  }
  return texture(c);
}

/** The Big Board: the tote board's green housing, amber wins and names. */
function bigBoardFace() {
  const c = canvas(1024, 400), g = c.getContext("2d");
  g.fillStyle = "#080a09"; g.fillRect(0, 0, 1024, 400);
  g.font = "700 40px Georgia, serif"; g.fillStyle = "#f0ece2"; g.textBaseline = "middle";
  g.fillText("P I C K ’ E M", 36, 44); g.font = "700 22px Arial"; g.fillStyle = "rgba(240,236,226,.7)"; g.fillText("WEEK 10 · OFFICIAL", 760, 44);
  const rows = [["15", "EARL"], ["14", "WALT"], ["13", "DOTTIE"], ["12", "JUNE"], ["11", "ROSIE"]];
  rows.forEach(([w, n], i) => {
    const y = 104 + i * 62;
    g.fillStyle = "#121a15"; g.fillRect(28, y - 26, 968, 52);
    g.font = "900 34px 'Courier New', monospace"; g.fillStyle = "#ffb02e"; g.shadowColor = "#ff9a20"; g.shadowBlur = 12; g.fillText(w, 46, y); g.shadowBlur = 0;
    g.font = "800 30px Arial"; g.fillStyle = "#f0ece2"; g.fillText(n, 130, y);
    for (let k = 0; k < 2; k++) { g.font = "700 26px 'Courier New', monospace"; g.fillStyle = "#bef0c8"; g.fillText(["PIT -2.5", "IND -3.5", "LAR +3", "SF -3"][(i + k) % 4], 470 + k * 250, y); }
  });
  return texture(c);
}

function sign(text, { w = 1024, h = 160, bg = "#1f4a36", ink = "#e6cf98", font = "700 96px Georgia, serif" } = {}) {
  const c = canvas(w, h), g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
  g.font = font; g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 4);
  return texture(c);
}

/** The pool's constitution, framed: a parchment page with a title and ruled lines of text. */
function parchment() {
  const c = canvas(512, 640), g = c.getContext("2d");
  const gr = g.createRadialGradient(256, 300, 40, 256, 320, 420); gr.addColorStop(0, "#f7efd8"); gr.addColorStop(1, "#e3d1a6");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
  g.fillStyle = "#3b2a18"; g.textAlign = "center"; g.font = "700 46px Georgia, serif"; g.fillText("Constitution", 256, 90);
  g.font = "italic 24px Georgia, serif"; g.fillText("Lead Pipe Locks", 256, 128);
  g.fillStyle = "rgba(59,42,24,.55)";
  for (let i = 0; i < 15; i++) { const w = 330 - ((i * 53) % 90); g.fillRect(256 - w / 2, 180 + i * 26, w, 5); }
  g.fillStyle = "#8c1e24"; g.beginPath(); g.arc(400, 580, 26, 0, Math.PI * 2); g.fill();
  return texture(c);
}

function mailScreen() {
  const c = canvas(256, 160), g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, "#2d4f6e"); gr.addColorStop(1, "#1a3047");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "rgba(255,255,255,.18)"; for (let i = 0; i < 5; i++) g.fillRect(24, 24 + i * 24, 120 + (i % 2) * 60, 10);
  return texture(c);
}

function bookPages() {
  const c = canvas(512, 320), g = c.getContext("2d");
  g.fillStyle = "#f3ead3"; g.fillRect(0, 0, 512, 320);
  g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(254, 0, 4, 320);
  g.fillStyle = "rgba(40,30,20,.5)";
  for (let side = 0; side < 2; side++) for (let i = 0; i < 12; i++) g.fillRect(24 + side * 256, 30 + i * 23, 200 - ((i * 37) % 60), 4);
  return texture(c);
}

function rugPattern() {
  const c = canvas(512, 512), g = c.getContext("2d");
  g.fillStyle = "#7a2f2a"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#d9b36a"; g.lineWidth = 10; g.strokeRect(24, 24, 464, 464);
  g.strokeStyle = "#1f3b2f"; g.lineWidth = 18; g.strokeRect(50, 50, 412, 412);
  g.fillStyle = "rgba(217,179,106,.35)"; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(96 + i * 64, 96 + j * 64, 9, 0, Math.PI * 2); g.fill(); }
  return texture(c);
}

function stripes(a, b, n = 8) {
  const c = canvas(256, 64), g = c.getContext("2d");
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * 256) / n, 0, 256 / n, 64); }
  return texture(c);
}

function skyTexture(night) {
  const c = canvas(64, 256), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  if (night) { gr.addColorStop(0, "#050914"); gr.addColorStop(1, "#1c2b4a"); } else { gr.addColorStop(0, "#6fb6e8"); gr.addColorStop(1, "#d8eef9"); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256); return texture(c);
}

// ---------- the room
export async function buildRoom(q) {
  const night = q.get("night") === "1";
  const bowl = q.get("bowl") === "1";
  const W = Number(q.get("w") ?? 390), H = Number(q.get("h") ?? 844), scale = Number(q.get("scale") ?? 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = night ? 0.95 : 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x0b1220 : 0xeae4d6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = night ? 0.35 : 0.8;

  const m = materials();
  const wallPaint = std(night ? 0xd9ccb0 : 0xe9dfc8, { roughness: 0.9 });
  const green = std(0x234d3a, { roughness: 0.6 });
  const whiteTrim = std(0xfbf8f0, { roughness: 0.5 });
  const walnut = m.walnut;
  const darkWood = std(0x3a2416, { roughness: 0.45 });
  const brass = m.brass;
  const leather = std(0x6b2b1f, { roughness: 0.55 });
  const fabric = std(0x2f4f6a, { roughness: 0.95 });
  const fabricCream = std(0xe9e0cc, { roughness: 0.95 });
  const glow = (color, intensity) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
  const spots = {};
  const group = (name) => { const g = new THREE.Group(); g.name = name; scene.add(g); if (name) spots[name] = g; return g; };

  // ----- shell: floor, walls with Saratoga-green wainscot and white trim
  const room = group(null);
  const floorTex = plankFloor();
  add(room, box(RW, 0.1, RD), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, envMapIntensity: 0.5 }), [0, -0.05, -RD / 2], { cast: false });
  for (const side of [-1, 1]) {
    const x = side * (RW / 2 + 0.1);
    add(room, box(0.2, RH, RD), wallPaint, [x, RH / 2, -RD / 2]);
    add(room, box(0.06, 1.0, RD), green, [x - side * 0.12, 0.5, -RD / 2]);
    add(room, box(0.08, 0.06, RD), whiteTrim, [x - side * 0.14, 1.02, -RD / 2]);
    add(room, box(0.08, 0.14, RD), whiteTrim, [x - side * 0.14, 0.07, -RD / 2]);
    add(room, box(0.08, 0.1, RD), whiteTrim, [x - side * 0.14, RH - 0.05, -RD / 2]);
  }
  const sideW = (RW - DOOR_W) / 2;
  for (const side of [-1, 1]) {
    add(room, box(sideW, RH, 0.2), wallPaint, [side * (DOOR_W / 2 + sideW / 2), RH / 2, -RD]);
    add(room, box(sideW, 1.0, 0.06), green, [side * (DOOR_W / 2 + sideW / 2), 0.5, -RD + 0.12]);
    add(room, box(sideW, 0.06, 0.08), whiteTrim, [side * (DOOR_W / 2 + sideW / 2), 1.02, -RD + 0.14]);
  }
  add(room, box(DOOR_W, RH - DOOR_H, 0.2), wallPaint, [0, DOOR_H + (RH - DOOR_H) / 2, -RD]);
  add(room, box(RW, 0.1, 0.08), whiteTrim, [0, RH - 0.05, -RD + 0.14]);

  // ----- the sliding glass doors and the pool patio beyond
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.92, roughness: 0.04, thickness: 0.02, ior: 1.3, transparent: true, opacity: 0.35 });
  const frameMat = std(0x2b2b28, { roughness: 0.4, metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const x = -DOOR_W / 2 + DOOR_W / 8 + (i * DOOR_W) / 4;
    add(room, box(DOOR_W / 4 - 0.05, DOOR_H - 0.06, 0.02), glass, [x, DOOR_H / 2, -RD + (i % 2 ? 0.04 : -0.04)], { cast: false });
  }
  for (let i = 0; i <= 4; i++) add(room, box(0.05, DOOR_H, 0.1), frameMat, [-DOOR_W / 2 + (i * DOOR_W) / 4, DOOR_H / 2, -RD]);
  add(room, box(DOOR_W, 0.06, 0.14), frameMat, [0, DOOR_H, -RD]);
  add(room, box(DOOR_W, 0.03, 0.18), frameMat, [0, 0.015, -RD]);

  const patio = group(null);
  add(patio, box(26, 0.1, 16), new THREE.MeshStandardMaterial({ map: pavers(), roughness: 0.85 }), [0, -0.06, -RD - 8.1], { cast: false });
  add(patio, box(6.6, 0.12, 3.6), std(0xf2ece0), [0.4, 0.0, -RD - 4.6], { cast: false });   // coping
  const water = new THREE.MeshPhysicalMaterial({ color: night ? 0x1aa8cf : 0x2fb4dc, roughness: 0.08, metalness: 0, clearcoat: 1, emissive: night ? 0x0a7aa0 : 0x062a35, emissiveIntensity: night ? 1.4 : 0.35 });
  add(patio, box(6.0, 0.06, 3.0), water, [0.4, 0.04, -RD - 4.6], { cast: false });
  for (const x of [-3.1, -2.1]) {                                                            // two loungers
    add(patio, rbox(0.7, 0.12, 1.9, 0.04), whiteTrim, [x, 0.32, -RD - 1.9]);
    add(patio, rbox(0.7, 0.1, 0.7, 0.04), whiteTrim, [x, 0.55, -RD - 1.15], { rot: [0.6, 0, 0] });
    add(patio, rbox(0.62, 0.06, 1.8, 0.03), std(0x2f6a4c), [x, 0.4, -RD - 1.9]);
  }
  add(patio, cyl(0.03, 0.03, 2.3), std(0xdddddd, { metalness: 0.6 }), [3.2, 1.15, -RD - 2.2]);
  add(patio, new THREE.ConeGeometry(1.3, 0.55, 16, 1, true), new THREE.MeshStandardMaterial({ map: stripes("#1f5a40", "#f6f2e6", 16), side: THREE.DoubleSide, roughness: 0.8 }), [3.2, 2.25, -RD - 2.2]);
  add(patio, box(26, 1.1, 0.6), std(0x3f6f3c, { roughness: 1 }), [0, 0.55, -RD - 9.0]);         // hedge
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshBasicMaterial({ map: skyTexture(night), fog: false }));
  sky.position.set(0, 7.5, -RD - 10); scene.add(sky);

  // ----- the Big Board, over the doors
  const board = group("board");
  add(board, rbox(2.9, 1.18, 0.12, 0.03), std(0x12281e, { roughness: 0.5 }), [0, 3.72, -RD + 0.16]);
  add(board, box(2.7, 1.0, 0.02), new THREE.MeshStandardMaterial({ map: bigBoardFace(), emissive: 0xffffff, emissiveMap: bigBoardFace(), emissiveIntensity: night ? 0.9 : 0.45 }), [0, 3.72, -RD + 0.23], { cast: false });
  add(board, box(2.9, 0.03, 0.03), brass, [0, 4.32, -RD + 0.2]);

  // ----- the sportsbook down the left wall: a header sign, three odds boards and the ticket counter
  const book = group("sportsbook");
  add(book, new THREE.PlaneGeometry(4.6, 0.42), new THREE.MeshStandardMaterial({ map: sign("SPORTSBOOK", { w: 1536, h: 140, font: "700 92px Georgia, serif" }), roughness: 0.5 }), [X0 + 0.04, 3.9, -6.0], { cast: false, rot: [0, Math.PI / 2, 0] });
  [0, 1, 2].forEach((k) => {
    const z = -4.45 - k * 1.55;
    add(book, rbox(0.1, 1.15, 1.45, 0.02), std(0x111110, { roughness: 0.5 }), [X0 + 0.07, 2.75, z]);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.0), new THREE.MeshStandardMaterial({ map: oddsBoard(k), emissive: 0xffffff, emissiveMap: oddsBoard(k), emissiveIntensity: night ? 1.0 : 0.6 }));
    face.rotation.y = Math.PI / 2; face.position.set(X0 + 0.125, 2.75, z); book.add(face);
  });
  add(book, rbox(0.85, 1.05, 4.7, 0.03), walnut, [X0 + 0.5, 0.525, -6.0]);
  add(book, box(0.95, 0.05, 4.8), brass, [X0 + 0.52, 1.07, -6.0]);
  for (let i = 0; i < 9; i++) add(book, cyl(0.012, 0.012, 0.55, 8), brass, [X0 + 0.92, 1.36, -3.85 - i * 0.53]);
  add(book, box(0.04, 0.04, 4.6), brass, [X0 + 0.92, 1.64, -6.0]);
  add(book, new THREE.PlaneGeometry(0.5, 0.24), new THREE.MeshStandardMaterial({ map: sign("TICKETS", { w: 512, h: 240, font: "700 92px Georgia, serif" }), side: THREE.DoubleSide }), [X0 + 0.95, 1.8, -6.0], { cast: false, rot: [0, Math.PI / 2, 0] });
  if (night) { const l = new THREE.PointLight(0xffa634, 3.2, 4, 1.6); l.position.set(X0 + 1.2, 2.7, -6); book.add(l); }

  // ----- the bar along the back of the right wall: counter, back bar with bottles, stools, banners above, plaques on its front
  const bar = group("bar");
  const BZ = -10.3, BL = 4.2;
  add(bar, rbox(0.75, 1.08, BL, 0.03), walnut, [X1 - 1.15, 0.54, BZ]);
  add(bar, rbox(0.9, 0.06, BL + 0.1, 0.02), darkWood, [X1 - 1.15, 1.1, BZ]);
  add(bar, cyl(0.025, 0.025, BL, 12), brass, [X1 - 1.6, 0.22, BZ], { rot: [Math.PI / 2, 0, 0] });
  add(bar, box(0.45, 2.1, BL), darkWood, [X1 - 0.24, 1.05, BZ]);
  for (let s = 0; s < 2; s++) add(bar, box(0.3, 0.03, BL - 0.2), darkWood, [X1 - 0.2, 1.55 + s * 0.4, BZ]);
  const bottleColors = [0x2f6a4c, 0x7a3a12, 0xd8d0b8, 0x3a1d0c, 0x9a7a2a, 0x24435e];
  for (let s = 0; s < 2; s++) for (let i = 0; i < 12; i++) add(bar, cyl(0.035, 0.04, 0.26 - (i % 3) * 0.03, 10), new THREE.MeshPhysicalMaterial({ color: bottleColors[(i + s) % 6], roughness: 0.1, transmission: 0.3, thickness: 0.1 }), [X1 - 0.24, 1.7 + s * 0.4, BZ - BL / 2 + 0.25 + i * 0.33], { cast: false });
  for (let i = 0; i < 4; i++) {
    const z = BZ - 1.5 + i * 1.0;
    add(bar, cyl(0.2, 0.2, 0.07, 24), leather, [X1 - 1.85, 0.76, z]);
    add(bar, cyl(0.03, 0.05, 0.72, 10), brass, [X1 - 1.85, 0.37, z]);
    add(bar, new THREE.TorusGeometry(0.14, 0.012, 6, 24), brass, [X1 - 1.85, 0.3, z], { rot: [Math.PI / 2, 0, 0] });
  }
  const plaques = group("plaques");
  for (let i = 0; i < 4; i++) {
    const z = BZ - 1.05 + i * 0.7;
    add(plaques, box(0.03, 0.3, 0.4), darkWood, [X1 - 1.54, 0.62, z]);
    add(plaques, box(0.02, 0.22, 0.32), brass, [X1 - 1.56, 0.62, z]);
  }
  const banners = group("banners");
  const bannerColors = ["#8c1e24", "#1f4a36", "#1d3557", "#8c1e24", "#1f4a36"];
  bannerColors.forEach((color, i) => {
    const c = canvas(128, 256), g = c.getContext("2d");
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 0); g.lineTo(128, 200); g.lineTo(64, 256); g.lineTo(0, 200); g.closePath(); g.fill();
    g.strokeStyle = "#e6cf98"; g.lineWidth = 6; g.stroke();
    g.fillStyle = "#e6cf98"; g.font = "700 30px Georgia"; g.textAlign = "center"; g.fillText(String(2022 + i), 64, 130);
    const t = texture(c);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
    p.rotation.y = -Math.PI / 2; p.position.set(X1 - 0.03, 3.45, BZ - 1.9 + i * 0.95); p.castShadow = true; banners.add(p);
    add(banners, cyl(0.01, 0.01, 0.58, 6), brass, [X1 - 0.05, 3.96, BZ - 1.9 + i * 0.95], { rot: [Math.PI / 2, 0, 0] });
  });
  // the record book and the laptop on the near end of the bar
  const record = group("record");
  add(record, rbox(0.42, 0.04, 0.56, 0.01), std(0x6b1f1a, { roughness: 0.5 }), [X1 - 1.15, 1.15, BZ - 1.85]);
  const pages = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.52), new THREE.MeshStandardMaterial({ map: bookPages(), roughness: 0.9 }));
  pages.rotation.set(-Math.PI / 2, 0, Math.PI / 2); pages.position.set(X1 - 1.15, 1.175, BZ - 1.85); record.add(pages);
  const laptop = group("chat");
  add(laptop, rbox(0.34, 0.02, 0.24, 0.008), std(0x9ea3a8, { metalness: 0.7, roughness: 0.3 }), [X1 - 1.1, 1.14, BZ + 1.85]);
  const lid = new THREE.Group(); lid.position.set(X1 - 0.98, 1.15, BZ + 1.85); lid.rotation.z = 0.28; laptop.add(lid);
  add(lid, rbox(0.02, 0.24, 0.34, 0.008), std(0x9ea3a8, { metalness: 0.7, roughness: 0.3 }), [0, 0.12, 0]);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshStandardMaterial({ map: mailScreen(), emissive: 0xffffff, emissiveMap: mailScreen(), emissiveIntensity: 0.8 }));
  screen.rotation.y = -Math.PI / 2; screen.position.set(-0.012, 0.12, 0); lid.add(screen);

  // ----- the fireplace lounge on the right wall: stone surround, fire, mantel, the constitution framed above
  const FZ = -5.4;
  const fire = group("fireplace");
  add(fire, rbox(0.5, 1.45, 2.1, 0.02), std(0xd8d0bf, { roughness: 0.9 }), [X1 - 0.25, 0.725, FZ]);
  add(fire, box(0.1, 0.72, 1.1), std(0x141010, { roughness: 1 }), [X1 - 0.49, 0.48, FZ], { cast: false });
  add(fire, box(0.06, 0.34, 0.8), glow(0xff6a1a, night ? 2.4 : 1.3), [X1 - 0.5, 0.3, FZ], { cast: false });
  for (let i = 0; i < 3; i++) add(fire, cyl(0.05, 0.05, 0.7, 8), std(0x3a2414), [X1 - 0.55, 0.2 + i * 0.04, FZ - 0.1 + i * 0.1], { rot: [Math.PI / 2, 0, 0.3 * i] });
  add(fire, rbox(0.62, 0.08, 2.4, 0.02), darkWood, [X1 - 0.31, 1.49, FZ]);
  const flame = new THREE.PointLight(0xff8a3a, night ? 6 : 2.5, 5, 1.6); flame.position.set(X1 - 0.9, 0.5, FZ); fire.add(flame);
  const charter = group("constitution");
  add(charter, box(0.05, 1.05, 0.85), std(0xa8823a, { metalness: 0.6, roughness: 0.35 }), [X1 - 0.04, 2.4, FZ]);
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshStandardMaterial({ map: parchment(), roughness: 0.9 }));
  page.rotation.y = -Math.PI / 2; page.position.set(X1 - 0.07, 2.4, FZ); charter.add(page);
  if (night) { const l = new THREE.SpotLight(0xffd9a0, 6, 3, 0.5, 0.6); l.position.set(X1 - 0.6, 3.4, FZ); l.target.position.set(X1, 2.4, FZ); charter.add(l, l.target); }

  // the rug, sofa, armchair and the coffee table with the race on it
  add(room, box(3.0, 0.01, 3.0), new THREE.MeshStandardMaterial({ map: rugPattern(), roughness: 1 }), [1.55, 0.006, FZ], { cast: false });
  const lounge = group(null);
  add(lounge, rbox(0.9, 0.42, 2.2, 0.08), fabric, [0.25, 0.25, FZ]);                   // sofa seat, facing the fire
  add(lounge, rbox(0.25, 0.85, 2.2, 0.08), fabric, [-0.12, 0.47, FZ]);                 // back
  for (const z of [FZ - 1.12, FZ + 1.12]) add(lounge, rbox(0.9, 0.62, 0.22, 0.06), fabric, [0.25, 0.33, z]);
  for (const z of [FZ - 0.5, FZ + 0.5]) add(lounge, rbox(0.62, 0.12, 0.95, 0.06), fabricCream, [0.32, 0.52, z]);
  add(lounge, rbox(0.85, 0.42, 0.85, 0.08), leather, [1.75, 0.25, FZ + 1.75]);         // armchair facing the fire, near the front
  add(lounge, rbox(0.85, 0.75, 0.2, 0.06), leather, [1.75, 0.5, FZ + 2.12]);
  const race = group("race");
  add(race, rbox(0.75, 0.38, 1.6, 0.03), walnut, [1.65, 0.19, FZ]);
  add(race, box(0.62, 0.02, 1.46), std(0x2f6a46, { roughness: 1 }), [1.65, 0.39, FZ]);
  add(race, box(0.36, 0.022, 1.42), std(0xbf9a6c, { roughness: 1 }), [1.65, 0.392, FZ]);
  for (const dx of [-0.19, 0.19]) add(race, box(0.012, 0.03, 1.42), whiteTrim, [1.65 + dx, 0.41, FZ]);
  for (let k = 0; k < 9; k++) add(race, box(0.01, 0.06, 0.01), whiteTrim, [1.65 - 0.2, 0.43, FZ + 0.66 - k * 0.15]);
  add(race, box(0.012, 0.09, 0.012), std(0xd4342c), [1.65 - 0.2, 0.44, FZ - 0.68]);
  const silks = [0xd4342c, 0x1d3557, 0xf0b429, 0x2f6a46, 0xffffff, 0x7a3a8c];
  silks.forEach((c, i) => {
    const x = 1.65 - 0.14 + (i % 4) * 0.08, z = FZ + 0.25 - i * 0.11;
    add(race, rbox(0.03, 0.04, 0.08, 0.012), std(0x5a3216), [x, 0.43, z]);
    add(race, rbox(0.022, 0.028, 0.03, 0.008), std(c), [x, 0.465, z + 0.01]);
  });

  // ----- the trophies: the real three on their mahogany table, on a round plinth in the middle of the room, under a spotlight
  const trophies = group("trophies");
  const TZ = -8.35, TX = -0.35;
  add(trophies, cyl(1.2, 1.28, 0.42, 64), std(0x1f3b2f, { roughness: 0.5 }), [TX, 0.21, TZ]);
  add(trophies, cyl(1.23, 1.23, 0.03, 64), brass, [TX, 0.435, TZ]);
  // each trophy on its own base, all at one scale, the tallest (Pick'em) at the back, the Bowl Pool and Survivor in front of it
  const pieces = [[ivorySpire, hexBase, { fin: "coil", material: "white" }, [0, -0.38]], [pennantCup, bowlBase, { material: "white" }, [-0.55, 0.28]], [crystalSpade, emeraldBase, { material: "white" }, [0.55, 0.28]]].map(([build, base, opts, at]) => {
    const piece = new THREE.Group(); const b = base(m); piece.add(b);
    const t = build(m, opts); t.position.y = b.userData.height; piece.add(t);
    return { piece, at };
  });
  const tallest = Math.max(...pieces.map(({ piece }) => new THREE.Box3().setFromObject(piece).getSize(new THREE.Vector3()).y));
  const ts = 1.15 / tallest;
  for (const { piece, at: [dx, dz] } of pieces) {
    piece.scale.setScalar(ts);
    const pb = new THREE.Box3().setFromObject(piece);
    piece.position.set(TX + dx, 0.45 - pb.min.y, TZ + dz);
    piece.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    trophies.add(piece);
  }
  const trophySpot = new THREE.SpotLight(0xfff2da, night ? 40 : 22, 7, 0.42, 0.65, 1.4);
  trophySpot.position.set(TX, 4.6, TZ + 0.6); trophySpot.target.position.set(TX, 0.9, TZ); trophySpot.castShadow = true; trophySpot.shadow.mapSize.set(2048, 2048);
  scene.add(trophySpot, trophySpot.target);

  // ----- Survivor: the poker table at the front left, chips on the felt, six chairs
  const poker = group("survivor");
  const PX = -1.55, PZ = -2.6;
  const oval = (rx, rz, h, mat, y) => { const mesh = add(poker, cyl(1, 1, h, 64), mat, [PX, y, PZ]); mesh.scale.set(rx, 1, rz); return mesh; };
  oval(1.12, 0.78, 0.08, m.felt, 0.78);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 14, 80), std(0x2a1a12, { roughness: 0.45 }));
  rail.rotation.x = Math.PI / 2; rail.scale.set(1.15, 0.8, 1); rail.position.set(PX, 0.82, PZ); rail.castShadow = true; poker.add(rail);
  add(poker, cyl(0.28, 0.45, 0.74, 24), darkWood, [PX, 0.37, PZ]);
  const chipColors = [0xd4342c, 0x1d3557, 0xf4efe3, 0x2f6a46, 0x111111];
  [[-0.5, 0.15], [-0.15, -0.35], [0.3, 0.3], [0.55, -0.2], [0.05, 0.42]].forEach(([dx, dz], s) => {
    for (let k = 0; k < 3 + (s % 3); k++) add(poker, cyl(0.045, 0.045, 0.018, 20), std(chipColors[(s + k) % 5], { roughness: 0.4 }), [PX + dx, 0.83 + k * 0.019, PZ + dz], { cast: false });
  });
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2 + Math.PI / 6, cx = PX + Math.cos(t) * 1.5, cz = PZ + Math.sin(t) * 1.08;
    const chair = new THREE.Group(); chair.position.set(cx, 0, cz); chair.rotation.y = -t - Math.PI / 2; poker.add(chair);
    add(chair, rbox(0.42, 0.08, 0.42, 0.03), leather, [0, 0.46, 0]);
    add(chair, rbox(0.42, 0.42, 0.06, 0.03), darkWood, [0, 0.72, 0.2]);
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) add(chair, cyl(0.02, 0.02, 0.44, 8), darkWood, [lx, 0.22, lz]);
  }

  // ----- plants, and the Bowl Pool bulletin board on wheels (wheeled in from Dec 7)
  const plant = (x, z, s = 1) => {
    add(room, cyl(0.22 * s, 0.17 * s, 0.4 * s, 20), std(0xe9e3d6), [x, 0.2 * s, z]);
    for (let i = 0; i < 6; i++) add(room, new THREE.IcosahedronGeometry(0.22 * s, 1), std(0x3d7a45, { roughness: 0.9 }), [x + Math.cos(i) * 0.14 * s, 0.6 * s + (i % 3) * 0.16 * s, z + Math.sin(i * 1.7) * 0.14 * s]);
  };
  plant(X0 + 0.45, -12.4, 1.2); plant(X1 - 0.5, -2.2, 1.1);
  if (bowl) {
    const board2 = group("bowl");
    const BX = -1.55, BZ2 = -11.6;
    add(board2, box(1.3, 0.95, 0.05), std(0xb98a5a, { roughness: 1 }), [BX, 1.35, BZ2]);
    add(board2, box(1.4, 0.06, 0.08), darkWood, [BX, 1.85, BZ2]); add(board2, box(1.4, 0.06, 0.08), darkWood, [BX, 0.85, BZ2]);
    for (const dx of [-0.66, 0.66]) { add(board2, box(0.05, 1.5, 0.05), darkWood, [BX + dx, 0.85, BZ2]); add(board2, box(0.05, 0.05, 0.5), darkWood, [BX + dx, 0.12, BZ2]); for (const dz of [-0.22, 0.22]) add(board2, cyl(0.05, 0.05, 0.04, 16), std(0x222222), [BX + dx, 0.05, BZ2 + dz], { rot: [0, 0, Math.PI / 2] }); }
    [[-0.35, 0.15, 0xf6f1e3], [0.2, 0.2, 0xf6f1e3], [0.35, -0.2, 0x1b2a4a], [-0.25, -0.22, 0xf6f1e3]].forEach(([dx, dy, c]) => add(board2, box(0.36, 0.3, 0.01), std(c), [BX + dx, 1.35 + dy, BZ2 + 0.035], { cast: false }));
    const pennantC = canvas(256, 128), pg = pennantC.getContext("2d");
    pg.fillStyle = "#1b2a4a"; pg.beginPath(); pg.moveTo(0, 0); pg.lineTo(256, 64); pg.lineTo(0, 128); pg.fill(); pg.fillStyle = "#e6cf98"; pg.font = "700 34px Georgia"; pg.fillText("BOWLS", 24, 76);
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: texture(pennantC), transparent: true, alphaTest: 0.5 }));
    pennant.position.set(BX, 1.95, BZ2 + 0.04); board2.add(pennant);
  }

  // ----- light: daylight through the doors, sky fill, and at night warm lamps, the fire and the lit pool
  scene.add(new THREE.HemisphereLight(night ? 0x8090b8 : 0xfdfbf4, night ? 0x2a1e16 : 0xb59a7a, night ? 0.25 : 0.75));
  const sun = new THREE.DirectionalLight(night ? 0x9ab6ff : 0xfff0d4, night ? 0.25 : 2.6);
  sun.position.set(-4, 10, -24); sun.target.position.set(0, 0, -5);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14, near: 1, far: 50 });
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, night ? 0.08 : 0.55); fill.position.set(3, 9, 8); scene.add(fill);
  if (night) {
    for (const [x, z] of [[-2.2, -2.5], [1.5, -4.2], [2.0, -9.8], [-2.2, -6.5], [0.5, -11.5]]) { const lamp = new THREE.PointLight(0xffc27a, 4.5, 6, 1.6); lamp.position.set(x, 3.2, z); scene.add(lamp); }
    const poolGlow = new THREE.PointLight(0x3ad0ff, 10, 9, 1.4); poolGlow.position.set(0.4, 0.6, -RD - 4.6); scene.add(poolGlow);
  }

  // ----- camera: the whole room in one tall picture, cropped to the room so no empty sky is left over
  const camera = new THREE.PerspectiveCamera(72, W / H, 0.1, 120);
  camera.position.set(0.3, 7.4, 2.6); camera.lookAt(-0.2, 0.3, -7.2);
  camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
  const toPx = (v) => { const p = v.clone().project(camera); return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H]; };
  const top = Math.max(0, Math.floor(Math.min(...[[X0, RH, -RD], [X1, RH, -RD], [0, RH, -RD]].map(([x, y, z]) => toPx(new THREE.Vector3(x, y, z))[1])) - 14));
  const bottom = Math.min(H, Math.ceil(Math.max(...[[X0, 0, -1.4], [X1, 0, -1.4], [0, 0, -1.4]].map(([x, y, z]) => toPx(new THREE.Vector3(x, y, z))[1])) + 4));
  const cropH = bottom - top;
  camera.setViewOffset(W, H, 0, top, W, cropH);
  camera.aspect = W / cropH; camera.updateProjectionMatrix();
  renderer.setPixelRatio(scale);
  renderer.setSize(W, cropH, false);

  // where each thing in the room sits in the picture (fractions of the picture), so the page can lay tap spots over it
  const out = {};
  for (const [name, g] of Object.entries(spots)) {
    const b = new THREE.Box3().setFromObject(g); if (b.isEmpty()) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera); const px = (p.x + 1) / 2, py = (1 - p.y) / 2;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const r = (v) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
    out[name] = { x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0) };
  }
  window.__spots = { width: W, height: cropH, spots: out };

  renderer.render(scene, camera);
  window.__webp = renderer.domElement.toDataURL("image/webp", 0.82);
  window.__png = renderer.domElement.toDataURL("image/png");
  window.__done = true;
}

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
import { canvas, texture, rand, tile, oakFloor, shiplap, fieldstone, thatchBack, thatchCourse, cane, bladeWood, palmBlade, frond, flame as fireTongue, sky } from "/surfaces.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const RW = 8.4, RD = 13.6, WH = 4.2, RIDGE = 7.2;
const X0 = -RW / 2, X1 = RW / 2, ZB = -RD;

// ---------- helpers
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
function add(parent, geometry, material, [x, y, z], { cast = true, receive = true, rot } = {}) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r);
const cyl = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);

// ---------- textures
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
function linenTex(color = "#eee8da") { const c = canvas(128, 128), g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 128; i += 2) { g.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.03})`; g.fillRect(0, i, 128, 1); g.fillRect(i, 0, 1, 128); } return texture(c, [4, 4]); }
function jute() { const c = canvas(256, 256), g = c.getContext("2d"); g.fillStyle = "#c9b48a"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 6) for (let x = 0; x < 256; x += 6) { g.fillStyle = `rgba(110, 85, 50, ${0.15 + rand() * 0.2})`; g.fillRect(x + ((y / 6) % 2) * 3, y, 4, 3); } g.strokeStyle = "#8a6a3e"; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236); return texture(c, [1, 1]); }
function spreadsFace() {
  const c = canvas(640, 560), g = c.getContext("2d");
  g.fillStyle = "#070706"; g.fillRect(0, 0, 640, 560);
  g.font = "700 34px 'Courier New', monospace"; g.textBaseline = "middle";
  g.fillStyle = "#f0b429"; g.fillText("THIS WEEK", 28, 36); g.textAlign = "right"; g.fillText("SPREAD", 612, 36); g.textAlign = "left";
  g.fillStyle = "rgba(240,180,41,.35)"; g.fillRect(24, 62, 592, 2);
  [["PIT", "CLE", 2.5], ["IND", "WAS", 3.5], ["LAR", "PHI", 3], ["SF", "DEN", 1.5], ["KC", "BUF", 6.5], ["DAL", "NYG", 4]].forEach(([a, b, line], i) => {
    const y = 104 + i * 78;
    g.font = "700 30px 'Courier New', monospace"; g.fillStyle = "#f4efe3"; g.fillText(a, 32, y); g.fillText(b, 32, y + 32);
    g.textAlign = "right"; g.fillStyle = "#ffb02e"; g.shadowColor = "#ff9a20"; g.shadowBlur = 10; g.fillText(`-${line}`, 608, y); g.fillText(`+${line}`, 608, y + 32); g.shadowBlur = 0; g.textAlign = "left";
    g.fillStyle = "rgba(244,239,227,.12)"; g.fillRect(24, y + 54, 592, 1);
  });
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
function pavers() { const c = canvas(512, 512), g = c.getContext("2d"); g.fillStyle = "#e8dcc4"; g.fillRect(0, 0, 512, 512); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const t = 222 + Math.floor(rand() * 18); g.fillStyle = `rgb(${t + 10}, ${t}, ${t - 22})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122); } return texture(c, [8, 5]); }

export async function buildRoom(q) {
  const night = q.get("night") === "1";
  const bowl = q.get("bowl") === "1";
  const W = Number(q.get("w") ?? 390), H = Number(q.get("h") ?? 700), scale = Number(q.get("scale") ?? 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = Number(q.get("exp") ?? (night ? 1.0 : 1.0));
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
  const rattan = new THREE.MeshStandardMaterial({ ...cane(), bumpScale: 2.5, roughness: 0.8 });
  const green = std(0x234d3a, { roughness: 0.6 });
  const caneOpen = rattan.clone(); caneOpen.side = THREE.DoubleSide;
  const chairWood = std(0x4a2c16, { roughness: 0.45 });
  const glow = (color, intensity) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
  const spots = {};
  const group = (name) => { const g = new THREE.Group(); scene.add(g); if (name) spots[name] = g; return g; };
  const room = group(null);
  const veil = [];      // things with no surface of their own (flames), left out when the contact shadows are worked out
  // every leaf in and around the room is grown from the one modelled frond
  const leafGreen = new THREE.MeshStandardMaterial({ color: 0x3f8a48, roughness: 0.55, side: THREE.DoubleSide }), leafDeep = new THREE.MeshStandardMaterial({ color: 0x2a6a36, roughness: 0.38, side: THREE.DoubleSide });
  const palmLeaf = frond({ L: 1.3, HW: 0.21, pleats: 30, droop: 0.55, keel: 0.5, depth: 0.01, scallop: 0.1, shape: 0.6, NU: 240, NV: 64 });
  const broadLeaf = frond({ L: 0.46, HW: 0.21, pleats: 7, droop: 0.07, keel: 0.22, depth: 0.004, scallop: 0.2, shape: 0.5, NU: 90, NV: 40 });
  const spray = (parent, geometry, material, [x, y, z], count, size, lift) => {
    for (let f = 0; f < count; f++) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, (f / count) * Math.PI * 2 + rand() * 0.5, lift[0] + rand() * (lift[1] - lift[0])); g.scale.setScalar(size * (0.78 + rand() * 0.34)); parent.add(g);
      add(g, geometry, material, [0, 0, 0]);
    }
  };

  // ----- floor, shiplap walls and the thatch overhead
  add(room, tile(box(RW, 0.1, RD), 1.44, 5.76), new THREE.MeshStandardMaterial({ ...oakFloor(), bumpScale: 1.6, roughness: 0.3, envMapIntensity: 1.0 }), [0, -0.05, -RD / 2], { cast: false });
  const wallMat = new THREE.MeshStandardMaterial({ ...shiplap(), bumpScale: 1.6, roughness: 0.85 });
  for (const side of [-1, 1]) {
    add(room, tile(box(0.2, WH, RD), 1.04, 2.08), wallMat, [side * (RW / 2 + 0.1), WH / 2, -RD / 2]);
    add(room, box(0.06, 0.18, RD), white, [side * (RW / 2 - 0.02), 0.09, -RD / 2]);                 // skirting
    add(room, box(0.12, 0.14, RD), timber, [side * (RW / 2 - 0.04), WH - 0.07, -RD / 2]);             // wall plate
  }
  // A natural beach hut ceiling: nothing but thatch, no beams. It is laid as real thatch is, in courses up the slope, each one
  // hanging a hand's breadth over the one below with a ragged edge, so the roof has depth and shadow of its own.
  const slope = Math.atan2(RIDGE - WH, RW / 2), len = Math.hypot(RW / 2, RIDGE - WH);
  const thatchDeep = new THREE.MeshStandardMaterial({ map: thatchBack(), roughness: 1, side: THREE.DoubleSide });
  for (const side of [-1, 1]) add(room, box(len, 0.08, RD), thatchDeep, [side * RW / 4, (WH + RIDGE) / 2 + 0.05, -RD / 2], { rot: [0, 0, side * -slope] });
  const courseMat = new THREE.MeshStandardMaterial({ map: thatchCourse(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
  const COURSES = 13, step = len / COURSES, tall = step * 1.8, lean = 0.12, along = new THREE.Vector3(0, 0, 1);
  for (const side of [-1, 1]) for (let k = 0; k < COURSES; k++) {
    const up = new THREE.Vector3(-side * Math.cos(slope), Math.sin(slope), 0), inward = new THREE.Vector3(-side * Math.sin(slope), -Math.cos(slope), 0);
    const rise = up.clone().addScaledVector(inward, -Math.tan(lean)).normalize();
    const foot = new THREE.Vector3(side * RW / 2, WH, -RD / 2).addScaledVector(up, k * step - 0.22).addScaledVector(inward, 0.03 + tall * Math.sin(lean));
    const geometry = new THREE.PlaneGeometry(RD, tall), uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + k * 0.37 + (side > 0 ? 0.5 : 0));
    const course = new THREE.Mesh(geometry, courseMat); course.receiveShadow = true;
    course.position.copy(foot).addScaledVector(rise, tall / 2);
    course.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, rise, new THREE.Vector3().crossVectors(along, rise)));
    room.add(course);
  }
  // Cabana fans: two big ones down the middle of the room. Each blade is a modelled palm leaf (pleated, scalloped at the edge,
  // keeled along its rib) carried on a cast brass iron; a turned timber housing banded in brass, a frosted light under it.
  const { leaf, rib } = palmBlade();
  const bladeMat = new THREE.MeshStandardMaterial({ ...bladeWood(), bumpScale: 0.5, roughness: 0.46, side: THREE.DoubleSide, envMapIntensity: 0.85 });
  const ribMat = std(0x4a2a12, { roughness: 0.5 });
  const housing = new THREE.LatheGeometry([[0, 0.2], [0.06, 0.2], [0.075, 0.15], [0.13, 0.12], [0.21, 0.07], [0.235, 0], [0.22, -0.07], [0.16, -0.11], [0, -0.11]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  for (const [fx, fz, spin] of [[-0.1, -6.0, 0.3], [0.1, -10.2, 0.9]]) {
    const top = WH + (RIDGE - WH) * (1 - Math.abs(fx) / (RW / 2)), hub = 5.05, drop = top - hub;
    add(room, cyl(0.022, 0.022, drop, 10), brass, [fx, top - drop / 2, fz]);
    add(room, cyl(0.05, 0.13, 0.12, 24), brass, [fx, top - 0.16, fz]);
    add(room, housing, m.walnut, [fx, hub + 0.02, fz]);
    for (const [r, y] of [[0.238, 0.02], [0.2, -0.07], [0.1, 0.16]]) add(room, new THREE.TorusGeometry(r, 0.012, 8, 40), brass, [fx, hub + y, fz], { rot: [Math.PI / 2, 0, 0], cast: false });
    const shade = add(room, new THREE.SphereGeometry(0.17, 24, 16), glow(0xffe9c4, night ? 3.2 : 1.6), [fx, hub - 0.15, fz], { cast: false }); shade.scale.set(1, 0.62, 1);
    add(room, cyl(0.02, 0.012, 0.04, 12), brass, [fx, hub - 0.27, fz], { cast: false });
    for (let b = 0; b < 5; b++) {
      const arm = new THREE.Group(); arm.position.set(fx, hub - 0.02, fz); arm.rotation.set(0, (b / 5) * Math.PI * 2 + spin, -0.1); room.add(arm);
      add(arm, rbox(0.34, 0.03, 0.06, 0.012), brass, [0.33, -0.02, 0]);
      add(arm, rbox(0.22, 0.016, 0.14, 0.007), brass, [0.57, -0.035, 0]);
      for (const [sx, sz] of [[0.5, -0.04], [0.5, 0.04], [0.64, 0]]) add(arm, new THREE.SphereGeometry(0.011, 8, 6), brass, [sx, -0.046, sz], { cast: false });
      const blade = new THREE.Group(); blade.position.set(0.44, 0, 0); blade.rotation.x = 0.2; arm.add(blade);
      add(blade, leaf, bladeMat, [0, 0, 0]); add(blade, rib, ribMat, [0, 0, 0], { cast: false });
    }
    const l = new THREE.PointLight(0xffd9a0, night ? 5 : 1.4, 7, 1.5); l.position.set(fx, hub - 0.45, fz); scene.add(l);
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
    spray(out, palmLeaf, leafGreen, [x + 0.1, h - 0.1, z], 13, 2.3, [-0.1, 0.9]);
  };
  palm(-6.2, ZB - 3.6, 6.2); palm(6.6, ZB - 4.5, 7.2); palm(-3.4, ZB - 10, 5.5); palm(5.0, ZB - 11, 6.4);
  add(out, box(60, 0.05, 40), std(night ? 0x0e2a46 : 0x2a8fbf, { roughness: 0.2 }), [0, -0.3, ZB - 40], { cast: false });   // the sea
  add(out, box(60, 0.4, 2), std(0xe9dcb8), [0, -0.2, ZB - 19.8], { cast: false });                                         // the beach
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 60), new THREE.MeshBasicMaterial({ map: sky(night), fog: false }));
  skyPlane.position.set(0, 26, ZB - 58); scene.add(skyPlane);

  // ----- the back wall, left: the sportsbook, face on. A white shiplap wall from the floor to the thatch; on it the Big Board, the
  // one screen of this week's spreads to one side, and the betting windows behind their brass grilles over the counter. No sign says
  // what it is: the board, the windows and the counter say it.
  const book = group("sportsbook");
  const SX1 = -0.5, SX = (X0 + SX1) / 2, SWALL = ZB + 0.12, roofAt = (x) => WH + (RIDGE - WH) * (1 - Math.abs(x) / (RW / 2));
  const wallShape = new THREE.Shape(); wallShape.moveTo(X0, 0); wallShape.lineTo(SX1, 0); wallShape.lineTo(SX1, roofAt(SX1)); wallShape.lineTo(X0, WH); wallShape.closePath();
  add(room, new THREE.ShapeGeometry(wallShape), new THREE.MeshStandardMaterial({ ...shiplap([1 / 1.04, 1 / 2.08]), bumpScale: 1.6, roughness: 0.85 }), [0, 0, SWALL], { cast: false });
  add(room, box(0.14, roofAt(SX1), 0.2), timberDark, [SX1, roofAt(SX1) / 2, SWALL]);
  const lit = (parent, w, h, x, y, faceMap, level, housing = 0x111110) => {
    add(parent, rbox(w + 0.14, h + 0.14, 0.1, 0.02), std(housing, { roughness: 0.5 }), [x, y, SWALL + 0.05]);
    add(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: faceMap, emissive: 0xffffff, emissiveMap: faceMap, emissiveIntensity: level }), [x, y, SWALL + 0.105], { cast: false });
  };
  lit(book, 1.08, 0.94, SX - 1.06, 1.8, spreadsFace(), night ? 1.0 : 0.7);
  for (const wx of [SX + 0.22, SX + 1.24]) {
    add(book, rbox(0.92, 1.2, 0.09, 0.02), m.walnut, [wx, 1.72, SWALL + 0.045]);
    add(book, new THREE.PlaneGeometry(0.78, 1.06), new THREE.MeshStandardMaterial({ color: 0x120c08, emissive: 0x4a2a0c, emissiveIntensity: night ? 0.7 : 0.35, roughness: 1 }), [wx, 1.72, SWALL + 0.092], { cast: false });         // lamplight in the cage behind
    for (let k = 0; k < 9; k++) add(book, cyl(0.007, 0.007, 0.8, 6), brass, [wx - 0.32 + k * 0.08, 1.84, SWALL + 0.1], { cast: false });
    for (const y of [1.44, 2.24]) add(book, box(0.78, 0.022, 0.022), brass, [wx, y, SWALL + 0.1], { cast: false });
    add(book, new THREE.TorusGeometry(0.39, 0.012, 6, 24, Math.PI), brass, [wx, 1.84, SWALL + 0.1], { cast: false });
  }
  add(book, cyl(0.06, 0.075, 0.02, 16), brass, [SX + 0.73, 1.11, ZB + 0.72]);                                                          // a banker's lamp between the windows
  add(book, cyl(0.008, 0.008, 0.24, 8), brass, [SX + 0.73, 1.23, ZB + 0.72]);
  add(book, cyl(0.05, 0.05, 0.24, 14, 1), new THREE.MeshStandardMaterial({ color: 0x1f6a46, emissive: 0x2f9a5c, emissiveIntensity: night ? 1.2 : 0.5, roughness: 0.3 }), [SX + 0.73, 1.37, ZB + 0.72], { rot: [0, 0, Math.PI / 2], cast: false });
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
  add(bar, new THREE.PlaneGeometry(2.2, 0.43), new THREE.MeshBasicMaterial({ map: neon("Lead Pipe Locks"), transparent: true, toneMapped: false }), [X0 + 0.085, 2.5, -10.3], { cast: false, rot: [0, Math.PI / 2, 0] }).renderOrder = 2;
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
  add(record, rbox(0.42, 0.05, 0.56, 0.01), std(0x6b1f1a, { roughness: 0.5 }), [BXc, 1.19, BZ + 0.75]);
  add(record, new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshStandardMaterial({ map: bookPages(), roughness: 0.9 }), [BXc, 1.22, BZ + 0.75], { cast: false, rot: [-Math.PI / 2, 0, Math.PI / 2] });
  const chat = group("chat");
  add(chat, rbox(0.27, 0.02, 0.38, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [BXc + 0.05, 1.18, BZ - 1.75]);
  const lid = new THREE.Group(); lid.position.set(BXc - 0.08, 1.19, BZ - 1.75); lid.rotation.set(0, Math.PI / 2, 0); chat.add(lid);
  const lidTilt = new THREE.Group(); lidTilt.rotation.x = -0.3; lid.add(lidTilt);
  add(lidTilt, rbox(0.38, 0.26, 0.02, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [0, 0.13, 0]);
  add(lidTilt, new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ map: screenTex(), emissive: 0xffffff, emissiveMap: screenTex(), emissiveIntensity: 0.85 }), [0, 0.13, 0.012], { cast: false });
  const banners = group("banners");
  ["#8c1e24", "#1f4a36", "#1d3557", "#8c1e24"].forEach((color, i) => {
    const c = canvas(256, 600), g = c.getContext("2d");
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 480); g.lineTo(128, 600); g.lineTo(0, 480); g.closePath(); g.fill();
    g.strokeStyle = "#e6cf98"; g.lineWidth = 12; g.stroke(); g.fillStyle = "#e6cf98"; g.textAlign = "center";
    g.font = "700 52px Georgia"; g.fillText("CHAMPS", 128, 200); g.font = "700 72px Georgia"; g.fillText(String(2026 - i), 128, 300);
    const x = X0 + 0.65, z = -8.6 - i * 0.9, top = 4.5;
    add(banners, new THREE.PlaneGeometry(0.68, 1.6), new THREE.MeshStandardMaterial({ map: texture(c), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), [x, top - 0.82, z], { cast: false });
    add(banners, cyl(0.014, 0.014, 0.78, 6), brass, [x, top, z], { rot: [0, 0, Math.PI / 2] });
    for (const dx of [-0.3, 0.3]) add(room, cyl(0.005, 0.005, roofAt(x + dx) - top, 4), brass, [x + dx, (roofAt(x + dx) + top) / 2, z], { cast: false });
  });

  // ----- the right wall: a grand fieldstone fireplace, floor to ceiling, the constitution on the chimney; the lounge in front
  const fire = group("fireplace");
  const FZ = -9.6, CD = 1.7, stone = new THREE.MeshStandardMaterial({ ...fieldstone(), bumpScale: 6, roughness: 0.92 });
  const stoneBlock = (w, h, d, at) => add(fire, tile(box(w, h, d), 1.9, 2.0, at), stone, at);
  // The chimney is one stone mass, floor to thatch. Its near end is cut through by a doorway under a timber lintel: the Trophy Room.
  const DOOR = { x0: 2.74, x1: 3.64, top: 2.5, deep: 0.9 }, NEAR = FZ + 1.9;
  stoneBlock(CD, RIDGE, 3.8 - DOOR.deep, [X1 - CD / 2, RIDGE / 2, FZ - DOOR.deep / 2]);
  stoneBlock(DOOR.x0 - (X1 - CD), DOOR.top, DOOR.deep, [(DOOR.x0 + X1 - CD) / 2, DOOR.top / 2, NEAR - DOOR.deep / 2]);
  stoneBlock(X1 - DOOR.x1, DOOR.top, DOOR.deep, [(DOOR.x1 + X1) / 2, DOOR.top / 2, NEAR - DOOR.deep / 2]);
  stoneBlock(CD, RIDGE - DOOR.top, DOOR.deep, [X1 - CD / 2, (RIDGE + DOOR.top) / 2, NEAR - DOOR.deep / 2]);
  stoneBlock(0.6, 0.5, 4.8, [X1 - CD - 0.3, 0.25, FZ]);                                                  // raised hearth
  // the fireplace proper: a stone surround standing proud of the chimney, the firebox set back between its jambs
  for (const side of [-1, 1]) stoneBlock(0.28, 1.5, 0.44, [X1 - CD - 0.14, 1.25, FZ + side * 1.17]);
  stoneBlock(0.28, 0.3, 2.78, [X1 - CD - 0.14, 1.97, FZ]);
  add(fire, box(0.04, 1.34, 1.92), std(0x120e0b, { roughness: 1 }), [X1 - CD - 0.01, 1.16, FZ], { cast: false });
  add(fire, box(0.02, 0.5, 1.5), glow(0xb8380a, night ? 1.4 : 0.9), [X1 - CD - 0.035, 0.78, FZ], { cast: false });                  // embers glowing on the back of the firebox
  const fireMat = new THREE.MeshBasicMaterial({ map: fireTongue(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  fireMat.color.setScalar(night ? 3.2 : 2.4);
  [[-0.46, 0.5], [-0.24, 0.78], [0.0, 0.95], [0.22, 0.72], [0.44, 0.48], [-0.12, 0.6], [0.12, 0.66]].forEach(([dz, h], i) => {
    for (const turn of [-0.45, 0.5]) veil.push(add(fire, new THREE.PlaneGeometry(h * 0.52, h), fireMat, [X1 - CD - 0.11 - (i % 3) * 0.035, 0.58 + h / 2, FZ + dz], { cast: false, receive: false, rot: [0, -Math.PI / 2 + turn, 0] }));
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
  const CX = (DOOR.x0 + DOOR.x1) / 2;
  add(charter, box(0.74, 0.94, 0.06), std(0xa8823a, { metalness: 0.6, roughness: 0.35 }), [CX, 3.72, NEAR + 0.03]);
  add(charter, new THREE.PlaneGeometry(0.62, 0.79), new THREE.MeshStandardMaterial({ map: parchment(), roughness: 0.9 }), [CX, 3.72, NEAR + 0.065], { cast: false });
  add(charter, box(0.5, 0.04, 0.12), brass, [CX, 4.26, NEAR + 0.07]);
  // The lounge, open toward the door so you can walk straight in: a jute rug, a linen sofa facing you from the far side, two cane
  // armchairs facing the fire, and between them the race.
  add(room, box(4.0, 0.012, 3.5), new THREE.MeshStandardMaterial({ map: jute(), roughness: 1 }), [0.3, 0.006, -9.5], { cast: false });
  const sofa = (x, z, facing) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = facing; scene.add(s);
    // a deep slip-covered sofa on a cane plinth: three loose seat cushions, three back cushions, rolled arms, two navy pillows
    add(s, rbox(2.4, 0.2, 0.98, 0.03), rattan, [0, 0.16, 0]);
    for (const dx of [-1.12, 1.12]) for (const dz of [-0.4, 0.4]) add(s, cyl(0.03, 0.022, 0.08, 10), chairWood, [dx, 0.04, dz]);
    add(s, rbox(2.4, 0.66, 0.2, 0.08), linen, [0, 0.56, -0.4]);
    for (const dx of [-0.7, 0, 0.7]) { add(s, rbox(0.69, 0.22, 0.74, 0.09), linen, [dx, 0.36, 0.08]); add(s, rbox(0.68, 0.46, 0.2, 0.09), linen, [dx, 0.68, -0.26], { rot: [-0.16, 0, 0] }); }
    for (const dx of [-1.16, 1.16]) add(s, rbox(0.24, 0.5, 0.98, 0.11), linen, [dx, 0.45, 0]);
    for (const dx of [-0.82, 0.82]) add(s, rbox(0.44, 0.4, 0.16, 0.075), navy, [dx, 0.66, -0.1], { rot: [-0.3, dx > 0 ? -0.25 : 0.25, 0] });
  };
  sofa(0.45, -10.85, 0);
  for (const z of [-8.75, -9.85]) {
    const chair = new THREE.Group(); chair.position.set(-1.4, 0, z); chair.rotation.y = Math.PI / 2; scene.add(chair);
    add(chair, rbox(0.85, 0.3, 0.8, 0.1), rattan, [0, 0.24, 0]); add(chair, rbox(0.85, 0.62, 0.14, 0.07), rattan, [0, 0.58, -0.36]); add(chair, rbox(0.7, 0.14, 0.64, 0.06), linen, [0, 0.45, 0.04]);
    for (const dx of [-0.42, 0.42]) add(chair, rbox(0.1, 0.24, 0.76, 0.045), rattan, [dx, 0.52, 0.0]);
    for (const dx of [-0.36, 0.36]) for (const dz of [-0.32, 0.32]) add(chair, cyl(0.025, 0.02, 0.1, 8), chairWood, [dx, 0.05, dz]);
  }
  // The race: an old mechanical racing game, long and low on its own walnut table. A dirt straight between white rails on green
  // baize, furlong poles along the far rail, the red and white finish pole at the fireplace end, and six thoroughbreds (each under
  // a jockey in his own silks, each riding a brass rod in its slot) strung out down the stretch.
  const race = group("race");
  const RX = 0.45, RZ = -9.3, RL = 2.2, RDp = 0.95, RH = 0.5, T0 = RX - RL / 2 + 0.2, T1 = RX + RL / 2 - 0.24, TY = RH + 0.016;
  add(race, rbox(RL, 0.09, RDp, 0.03), m.walnut, [RX, RH - 0.045, RZ]);
  add(race, rbox(RL - 0.2, 0.1, RDp - 0.2, 0.02), m.walnut, [RX, RH - 0.14, RZ]);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) add(race, cyl(0.045, 0.03, RH - 0.09, 12), m.walnut, [RX + dx * (RL / 2 - 0.12), (RH - 0.09) / 2, RZ + dz * (RDp / 2 - 0.12)]);
  add(race, box(RL - 0.1, 0.012, RDp - 0.1), m.felt, [RX, RH + 0.006, RZ]);
  add(race, box(RL - 0.2, 0.012, 0.56), std(0xb88a58, { roughness: 1 }), [RX, RH + 0.01, RZ]);
  for (let lane = 0; lane < 6; lane++) add(race, box(T1 - T0 + 0.1, 0.004, 0.006), std(0x2a1a10), [(T0 + T1) / 2, TY, RZ - 0.2 + lane * 0.08], { cast: false });
  for (const dz of [-0.29, 0.29]) {
    add(race, box(RL - 0.2, 0.012, 0.012), white, [RX, RH + 0.085, RZ + dz]);
    for (let k = 0; k <= 16; k++) add(race, box(0.009, 0.075, 0.009), white, [RX - RL / 2 + 0.1 + k * ((RL - 0.2) / 16), RH + 0.05, RZ + dz], { cast: false });
  }
  for (let k = 1; k < 8; k++) {
    const x = T0 + (k / 8) * (T1 - T0);
    add(race, cyl(0.007, 0.007, 0.2, 8), white, [x, RH + 0.11, RZ - 0.33]); add(race, new THREE.SphereGeometry(0.016, 10, 8), std(k % 2 ? 0x1f4a36 : 0xd4342c, { roughness: 0.4 }), [x, RH + 0.22, RZ - 0.33]);
  }
  for (let k = 0; k < 8; k++) add(race, cyl(0.014, 0.014, 0.045, 12), std(k % 2 ? 0xf7f4ec : 0xd4342c, { roughness: 0.4 }), [T1, RH + 0.035 + k * 0.045, RZ - 0.33]);
  add(race, new THREE.SphereGeometry(0.026, 14, 10), m.gold, [T1, RH + 0.41, RZ - 0.33]);
  add(race, box(0.012, 0.004, 0.56), white, [T1, TY + 0.002, RZ], { cast: false });
  add(race, box(0.03, 0.14, 0.6), white, [T0 - 0.08, RH + 0.08, RZ]);                                                                     // the starting gate
  const horse = (coat, silks, cap) => {
    const h = new THREE.Group(), hide = std(coat, { roughness: 0.45 }), ball = (rx, ry, rz, mat, at, rot) => { const b = add(h, new THREE.SphereGeometry(1, 16, 12), mat, at, { rot }); b.scale.set(rx, ry, rz); return b; };
    ball(0.1, 0.046, 0.036, hide, [0, 0.125, 0]);
    add(h, cyl(0.02, 0.03, 0.11, 10), hide, [0.1, 0.175, 0], { rot: [0, 0, -0.95] });
    ball(0.046, 0.022, 0.02, hide, [0.165, 0.2, 0], [0, 0, -0.45]);
    for (const dz of [-0.012, 0.012]) add(h, new THREE.ConeGeometry(0.008, 0.024, 6), hide, [0.135, 0.232, dz]);
    add(h, cyl(0.006, 0.014, 0.1, 6), std(0x1a120c), [-0.125, 0.125, 0], { rot: [0, 0, 1.15] });                                           // the tail, streaming
    for (const [x, lean, dz] of [[0.075, 0.75, 0.017], [0.06, 1.0, -0.017], [-0.07, -0.8, 0.017], [-0.055, -1.05, -0.017]]) add(h, cyl(0.011, 0.007, 0.115, 6), hide, [x + Math.sin(lean) * 0.045, 0.085, dz], { rot: [0, 0, lean] });
    add(h, box(0.07, 0.005, 0.076), white, [0, 0.168, 0]);
    ball(0.032, 0.03, 0.026, std(silks, { roughness: 0.5 }), [0.012, 0.2, 0], [0, 0, -0.5]);
    add(h, new THREE.SphereGeometry(0.017, 12, 10), std(cap, { roughness: 0.4 }), [0.048, 0.236, 0]);
    add(h, cyl(0.004, 0.004, 0.09, 6), brass, [0, 0.045, 0], { cast: false });
    return h;
  };
  [[0x5a3216, 0xd4342c, 0xf7f4ec, 0.86], [0x2e1a0e, 0x1d3557, 0xf0b429, 0.79], [0x7a3f1c, 0xf0b429, 0x1f4a36, 0.74], [0x8a8a88, 0x2f6a46, 0xf7f4ec, 0.6], [0x16110d, 0xf7f4ec, 0xd4342c, 0.51], [0x6a3a1a, 0x7a3a8c, 0xf0b429, 0.36]].forEach(([coat, silks, cap, at], lane) => {
    const h = horse(coat, silks, cap); h.position.set(T0 + at * (T1 - T0) - 0.17, TY, RZ - 0.2 + lane * 0.08); race.add(h);
  });

  // ----- the Trophy Room: through the doorway in the chimney's near end. The real three trophies stand just inside under their own
  // lamp, the gold cup in front, so the doorway says what is through it; the floor of the room is left clear to walk.
  const trophies = group("trophies");
  add(trophies, rbox(DOOR.x1 - DOOR.x0 + 0.34, 0.26, 0.2, 0.02), timberDark, [CX, DOOR.top + 0.1, NEAR + 0.06]);
  add(fire, box(DOOR.x1 - DOOR.x0, DOOR.top, 0.04), std(0x16291f, { roughness: 0.6 }), [CX, DOOR.top / 2, NEAR - DOOR.deep + 0.03], { cast: false });
  add(fire, box(DOOR.x1 - DOOR.x0, 0.02, DOOR.deep), new THREE.MeshStandardMaterial({ map: jute(), roughness: 1 }), [CX, 0.011, NEAR - DOOR.deep / 2], { cast: false });
  const stands = [[pennantCup, bowlBase, { material: "white" }, 0, -0.36, 0.92, 0.44, 0.8], [ivorySpire, hexBase, { fin: "coil", material: "white" }, -0.29, -0.68, 1.2, 0.32, 0.66], [crystalSpade, emeraldBase, { material: "white" }, 0.29, -0.68, 1.2, 0.32, 0.6]];
  for (const [build, base, opts, dx, dz, h, wide, tall] of stands) {
    add(trophies, rbox(wide, h, wide, 0.02), std(0x1f3b2f, { roughness: 0.45 }), [CX + dx, h / 2, NEAR + dz]);
    add(trophies, rbox(wide + 0.06, 0.04, wide + 0.06, 0.012), brass, [CX + dx, h + 0.02, NEAR + dz]);
    const piece = new THREE.Group(), foot = base(m), top = build(m, opts); top.position.y = foot.userData.height; piece.add(foot, top);
    piece.scale.setScalar(tall / new THREE.Box3().setFromObject(piece).getSize(new THREE.Vector3()).y);
    piece.position.set(CX + dx, h + 0.04 - new THREE.Box3().setFromObject(piece).min.y, NEAR + dz);
    piece.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    trophies.add(piece);
  }
  const trophyLamp = new THREE.SpotLight(0xffe2b4, night ? 26 : 20, 5, 0.85, 0.7, 1.2);
  trophyLamp.position.set(CX, DOOR.top - 0.08, NEAR - 0.1); trophyLamp.target.position.set(CX, 1.1, NEAR - 0.6); scene.add(trophyLamp, trophyLamp.target);
  add(fire, box(0.5, 0.03, 0.08), glow(0xffe2b4, night ? 3 : 2), [CX, DOOR.top - 0.02, NEAR - 0.12], { cast: false });

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
    // a barrel-back club chair: woven cane wrapped round the back between two rails, a loose linen cushion, turned legs
    add(c, rbox(0.46, 0.05, 0.46, 0.02), chairWood, [0, 0.45, 0]); add(c, rbox(0.42, 0.09, 0.4, 0.04), linen, [0, 0.51, -0.02]);
    add(c, new THREE.CylinderGeometry(0.27, 0.27, 0.36, 24, 1, true, -0.95, 1.9), caneOpen, [0, 0.82, -0.04]);
    for (const y of [0.63, 1.01]) add(c, new THREE.TorusGeometry(0.27, 0.02, 8, 24, 1.9), chairWood, [0, y, -0.04], { rot: [Math.PI / 2, 0, Math.PI / 2 - 0.95] });
    for (const sx of [-1, 1]) { add(c, cyl(0.02, 0.016, 1.01, 10), chairWood, [sx * 0.22, 0.505, 0.117]); add(c, cyl(0.02, 0.015, 0.45, 10), chairWood, [sx * 0.19, 0.225, -0.18]); }
  }

  // ----- palms in woven baskets, and from Dec 7 the Bowl Pool's bulletin board on wheels by the doors
  const plant = (x, z, s = 1) => {
    add(room, cyl(0.3 * s, 0.24 * s, 0.5 * s, 24), rattan, [x, 0.25 * s, z]);
    add(room, cyl(0.27 * s, 0.27 * s, 0.02, 20), std(0x3a2a1c, { roughness: 1 }), [x, 0.49 * s, z], { cast: false });
    spray(room, palmLeaf, leafGreen, [x, 0.5 * s, z], 7, s * 0.95, [0.7, 1.0]); spray(room, palmLeaf, leafGreen, [x, 0.5 * s, z], 6, s * 1.1, [1.05, 1.4]);
  };
  const monstera = (x, z, s = 1) => {
    add(room, cyl(0.28 * s, 0.22 * s, 0.46 * s, 24), std(0xf1ece2, { roughness: 0.5 }), [x, 0.23 * s, z]);
    add(room, cyl(0.25 * s, 0.25 * s, 0.02, 20), std(0x3a2a1c, { roughness: 1 }), [x, 0.45 * s, z], { cast: false });
    for (let f = 0; f < 11; f++) {
      const a = (f / 11) * Math.PI * 2 + rand(), reach = (0.16 + rand() * 0.3) * s, high = (0.7 + rand() * 0.75) * s;
      const tip = new THREE.Vector3(x + Math.cos(a) * reach, high, z - Math.sin(a) * reach), foot = new THREE.Vector3(x, 0.45 * s, z);
      const stem = add(room, cyl(0.008 * s, 0.012 * s, tip.distanceTo(foot), 6), leafDeep, [(tip.x + foot.x) / 2, (tip.y + foot.y) / 2, (tip.z + foot.z) / 2]);
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(foot).normalize());
      const g = new THREE.Group(); g.position.copy(tip); g.rotation.set(rand() * 0.5 - 0.25, a, -0.15 - rand() * 0.45); g.scale.setScalar(s * (0.85 + rand() * 0.4)); room.add(g);
      add(g, broadLeaf, leafDeep, [0, 0, 0]);
    }
  };
  plant(X1 - 0.6, ZB + 0.8, 1.4);
  monstera(2.2, -6.9, 0.9); monstera(-0.05, ZB + 0.8, 1.0);
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

  // ----- light: late-afternoon sun raking in through the glass and across the floor, or a warm evening with the pool and the
  // lanterns lit. The fill is kept low so the sun's shadows stay deep; the room's own glow is added below from a picture of itself.
  scene.add(new THREE.HemisphereLight(night ? 0x8090b8 : 0xfff2dc, night ? 0x2a1e16 : 0xc9a06c, night ? 0.16 : 0.42));
  const sun = new THREE.DirectionalLight(night ? 0x9ab6ff : 0xffe2b4, night ? 0.25 : 4.4);
  sun.position.set(6, 14, ZB - 14); sun.target.position.set(-1, 0, -7);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 1, far: 70 });
  scene.add(sun, sun.target);
  for (const [x, y, z] of [[0, 4.6, -3.2], [-2.6, 3.4, -12.2]]) { const l = new THREE.PointLight(night ? 0xffc98a : 0xffe6c4, night ? 3.0 : 1.3, 10, 1.4); l.position.set(x, night ? Math.min(y, 3.3) : y, z); scene.add(l); }
  if (night) {
    const poolGlow = new THREE.PointLight(0x3ad0ff, 14, 12, 1.4); poolGlow.position.set(0.6, 0.6, ZB - 6.2); scene.add(poolGlow);
    for (let i = 0; i < 12; i++) add(out, new THREE.SphereGeometry(0.05, 8, 6), glow(0xffd28a, 3), [-5 + i * 0.9, 3.1 - Math.sin((i / 11) * Math.PI) * 0.5, ZB - 3.2], { cast: false });
  }
  scene.fog = new THREE.Fog(night ? 0x0b1424 : 0xe8f1f2, 6, night ? 170 : 120);           // a little air between you and the far wall, more over the sea

  // ----- camera: standing on the landing just inside the front door, looking down the room to the glass wall and the sea
  const camera = new THREE.PerspectiveCamera(Number(q.get("fov") ?? 82), W / H, 0.1, 200);
  camera.position.set(...(q.get("cam") ?? "0.3,3.0,-0.3").split(",").map(Number));
  camera.lookAt(...(q.get("look") ?? "0.1,1.45,-9").split(",").map(Number));
  camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
  // design work only: zoom=k,x,y renders the part of the picture centred at x,y (as fractions of it) k times larger
  if (q.get("zoom")) { const [k, cx, cy] = q.get("zoom").split(",").map(Number); camera.setViewOffset(W, H, (cx - 0.5 / k) * W, (cy - 0.5 / k) * H, W / k, H / k); }

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
  // The room lights itself: a picture of the whole room taken from its middle (the sky bright, as the eye would find it) becomes the
  // soft light and the reflections on everything in it, so the brass, the floor and the trophies show the room they stand in.
  if (q.get("ibl") !== "0") {
    const around = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const eye = new THREE.CubeCamera(0.1, 200, around); eye.position.set(0.4, 2.4, -7.6); scene.add(eye);
    trophies.visible = false; skyPlane.material.color.setScalar(night ? 1.2 : 4);
    eye.update(renderer, scene);
    trophies.visible = true; skyPlane.material.color.setScalar(1);
    scene.environment = pmrem.fromCubemap(around.texture).texture; scene.environmentIntensity = Number(q.get("env") ?? (night ? 1.0 : 0.9));
  }
  // Finishing: soft shadow wherever two things meet (under the furniture, in the thatch, between the stones), a glow around
  // whatever is truly bright, then the edges of the picture drawn down a little so the eye rests in the middle of the room.
  const PW = W * scale, PH = H * scale;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(PW, PH, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  if (q.get("ao") !== "0") {
    const contact = new GTAOPass(scene, camera, PW, PH);
    contact.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.3, thickness: 1.0, scale: 1.25, samples: 16 });
    contact.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    const hide = contact.overrideVisibility.bind(contact);
    contact.overrideVisibility = () => { hide(); for (const o of veil) o.visible = false; };
    composer.addPass(contact);
  }
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(PW, PH), night ? 0.32 : 0.16, 0.6, night ? 0.9 : 1.1));
  composer.addPass(new OutputPass());
  composer.render();
  const picture = canvas(PW, PH), pg = picture.getContext("2d");
  pg.drawImage(renderer.domElement, 0, 0);
  const edge = pg.createRadialGradient(PW / 2, PH * 0.46, PH * 0.3, PW / 2, PH * 0.5, PH * 0.78); edge.addColorStop(0, "rgba(24, 12, 2, 0)"); edge.addColorStop(1, `rgba(24, 12, 2, ${night ? 0.42 : 0.3})`);
  pg.fillStyle = edge; pg.fillRect(0, 0, PW, PH);
  window.__webp = picture.toDataURL("image/webp", 0.82);
  window.__png = picture.toDataURL("image/png");
  window.__done = true;
}

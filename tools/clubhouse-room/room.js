// The clubhouse: a grand beach bungalow and the ultimate man cave, seen at eye level from just inside the front, looking down the room. Nothing
// in it is turned to the camera by a trick: what has to be read hangs on the wall that faces you, and the side walls carry the
// things that look right in perspective. The room is BUILT the first way round (described below: bar on the left, chimney on the
// right) and then DRAWN as its mirror image (see MIRROR), so in the pictures the bar runs down the right and the chimney stands on the
// left; every left and right in the comments below is the room as built.
//  - Ceiling: natural beach-hut thatch laid in courses, three dark timber trusses and a ridge beam up high, two big palm-leaf fans.
//  - Back wall, left: where picks are made, face on: the Big Board, one wide board of spreads under it, the counter. No sign.
//  - Back wall, right: glass to the thatch, the sliding doors standing open onto the pool patio, palms, tiki torches and the sea.
//  - Side walls: full of windows (four tall on the right, three tall at the front left and a clerestory strip over the bar); the
//    sun comes in through them across the floor.
//  - Left wall: the bar running down the room (fluted walnut, marble, brass), leather stools, a mirrored back bar of bottles and
//    glassware under the neon, the plaques along its front, the laptop on top (the record book is on the lounge table); at night a
//    blue neon line under its lip and along its foot.
//  - Right wall: a grand floor-to-thatch stone chimney (the fire lit at night), the Trophy Room shelf on its near face with the
//    constitution framed under it, and the lounge in front (white slipcovers, white cane, blue cushions, a striped rug).
//  - Middle, forward: a long oval Survivor poker table (cup holders sunk in its padded rail) with a swivel card-room chair for every player.
//    The floor in front of it is the way in. From Dec 7 the Bowl Pool's board stands at the front left.
// Units are metres: x left to right, z from the front wall (0) to the back (-RD).
import { THREE, RoundedBoxGeometry, materials } from "/lib.js";
import { canvas, texture, rand, tile, oakFloor, shiplap, fieldstone, thatchBack, thatchCourse, cane, bladeWood, palmBlade, frond, flame as fireTongue, sky, walnutVeneer, bottleLabels, wrapTile, STONE } from "/surfaces.js";
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
function add(parent, geometry, material, [x, y, z], { cast = true, receive = true, rot, scale } = {}) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.setScalar(scale);
  parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r);
const cyl = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);

// ---------- textures
function neon(text) {
  const c = canvas(1024, 200), g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 1024, 200);
  g.font = "italic 700 104px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "#ff5fa2"; g.shadowBlur = 30; g.strokeStyle = "#ffd1e6"; g.lineWidth = 7; g.strokeText(text, 512, 104);
  g.shadowBlur = 12; g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeText(text, 512, 104);
  return texture(c);
}
function linenTex(color = "#eee8da") { const c = canvas(128, 128), g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 128; i += 2) { g.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.03})`; g.fillRect(0, i, 128, 1); g.fillRect(i, 0, 1, 128); } return texture(c, [4, 4]); }
// a flat-woven cotton rug in the room's white and blue: wide blue bands, a thin one either side, a white field
function stripeRug() { const c = canvas(256, 256), g = c.getContext("2d"); g.fillStyle = "#f4f1e8"; g.fillRect(0, 0, 256, 256); for (const [y, h, col] of [[18, 10, "#2f5f8a"], [34, 3, "#2f5f8a"], [118, 20, "#3f7fb0"], [218, 3, "#2f5f8a"], [228, 10, "#2f5f8a"]]) { g.fillStyle = col; g.fillRect(0, y, 256, h); } for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.03})`; g.fillRect(0, y, 256, 1); } return texture(c, [1, 1]); }
function ticking() { const c = canvas(128, 128), g = c.getContext("2d"); g.fillStyle = "#f4f1e8"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#3f6f9f"; for (let x = 4; x < 128; x += 16) g.fillRect(x, 0, 5, 128); return texture(c, [2, 2]); }
function jute() { const c = canvas(256, 256), g = c.getContext("2d"); g.fillStyle = "#c9b48a"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 6) for (let x = 0; x < 256; x += 6) { g.fillStyle = `rgba(110, 85, 50, ${0.15 + rand() * 0.2})`; g.fillRect(x + ((y / 6) % 2) * 3, y, 4, 3); } g.strokeStyle = "#8a6a3e"; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236); return texture(c, [1, 1]); }
function spreadsFace() {
  const c = canvas(1860, 552), g = c.getContext("2d");
  g.fillStyle = "#070706"; g.fillRect(0, 0, 1860, 552);
  g.textBaseline = "middle"; g.font = "700 40px 'Courier New', monospace"; g.fillStyle = "#f0b429"; g.fillText("THIS WEEK’S SPREADS", 36, 36);
  g.fillStyle = "rgba(240,180,41,.35)"; g.fillRect(28, 66, 1804, 3);
  [["PIT", 2.5, "at CLE · THU"], ["IND", 3.5, "vs WAS · SUN"], ["LAR", 3, "at PHI · SUN"], ["SF", 1.5, "vs DEN · SUN"], ["KC", 6.5, "vs BUF · SUN"], ["DAL", 4, "at NYG · MON"]].forEach(([team, line, rest], i) => {
    const x = 40 + (i % 3) * 610, y = 150 + Math.floor(i / 3) * 236;
    g.font = "700 124px 'Courier New', monospace"; g.fillStyle = "#f4efe3"; g.fillText(team, x, y);
    g.textAlign = "right"; g.fillStyle = "#ffb02e"; g.shadowColor = "#ff9a20"; g.shadowBlur = 16; g.fillText(`-${line}`, x + 560, y); g.shadowBlur = 0; g.textAlign = "left";
    g.font = "700 46px 'Courier New', monospace"; g.fillStyle = "rgba(244,239,227,.62)"; g.fillText(rest, x + 4, y + 98);
    if (i % 3) { g.fillStyle = "rgba(244,239,227,.14)"; g.fillRect(x - 26, y - 70, 2, 200); }
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

// A small oil seascape for the mantel, in quiet colours so it sits back: a soft grey-blue sky, a low dune line, a muted sea and one
// far-off sail, with brushy streaks so it reads as paint rather than a photo.
function seascape() {
  const c = canvas(640, 400), g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 230); sky.addColorStop(0, "#9fb1b8"); sky.addColorStop(1, "#e6dcc6");
  g.fillStyle = sky; g.fillRect(0, 0, 640, 240);
  const sea = g.createLinearGradient(0, 220, 0, 320); sea.addColorStop(0, "#5f7f86"); sea.addColorStop(1, "#7e9a96");
  g.fillStyle = sea; g.fillRect(0, 220, 640, 100);
  g.fillStyle = "#cdbb94"; g.beginPath(); g.moveTo(0, 300); g.bezierCurveTo(160, 282, 330, 318, 640, 296); g.lineTo(640, 400); g.lineTo(0, 400); g.fill();
  g.fillStyle = "#8f8a5e"; g.beginPath(); g.moveTo(0, 318); g.bezierCurveTo(120, 300, 220, 330, 360, 322); g.lineTo(360, 400); g.lineTo(0, 400); g.fill();
  // brush streaks
  for (let i = 0; i < 260; i++) {
    const y = (i * 137) % 400, x = (i * 251) % 640, w = 30 + ((i * 17) % 60);
    g.fillStyle = `rgba(${y < 230 ? "255,250,240" : "40,60,60"},${0.04 + ((i * 7) % 5) / 100})`; g.fillRect(x, y, w, 3);
  }
  g.fillStyle = "#f3ecdc"; g.beginPath(); g.moveTo(452, 214); g.lineTo(466, 176); g.lineTo(468, 214); g.closePath(); g.fill();   // a far-off sail
  g.fillStyle = "#4a4136"; g.fillRect(448, 214, 24, 3);
  return texture(c);
}

export async function buildRoom(q) {
  const night = q.get("night") === "1";
  // The room is built as it was first drawn (the bar on the left, the chimney on the right) and then turned round as a mirror image,
  // so the bar runs down the right and the chimney stands on the left. Everything that carries words (the neon, the constitution, the
  // Bowl Pool's cards and pennant, the live boards) has its picture turned back, so it still reads the right way round. flip=0 draws
  // the room the old way round, for comparison.
  const MIRROR = q.get("flip") === "0" ? 1 : -1;
  const readable = (t) => { if (MIRROR < 0) { t.repeat.x = -1; t.offset.x = 1; } return t; };
  const W = Number(q.get("w") ?? 390), H = Number(q.get("h") ?? 560), scale = Number(q.get("scale") ?? 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = Number(q.get("exp") ?? (night ? 1.0 : 1.25));
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
  // The bar's walnut: veneer boards on end with real grain (see walnutVeneer), laid on by the metre; the flutes take the same wood at
  // their own scale, the grain running up each one.
  const veneer = walnutVeneer();
  const barWood = new THREE.MeshPhysicalMaterial({ ...veneer, bumpScale: 0.6, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.8 });
  const fluteWood = barWood.clone(); fluteWood.map = veneer.map.clone(); fluteWood.bumpMap = veneer.bumpMap.clone();
  for (const t of [fluteWood.map, fluteWood.bumpMap]) { t.repeat.set(0.17, 0.8); t.needsUpdate = true; }
  const linen = new THREE.MeshStandardMaterial({ map: linenTex(), roughness: 0.95 });
  const navy = new THREE.MeshStandardMaterial({ map: linenTex("#2f4f6e"), roughness: 0.95 });
  // the lounge's own: white slipcovers, cornflower and navy cushions, a blue-and-white ticking stripe, white-painted cane
  const slipcover = new THREE.MeshStandardMaterial({ map: linenTex("#f7f5ee"), roughness: 0.95 });
  const cornflower = new THREE.MeshStandardMaterial({ map: linenTex("#4f86b8"), roughness: 0.95 });
  const stripe = new THREE.MeshStandardMaterial({ map: ticking(), roughness: 0.95 });
  const whiteCane = new THREE.MeshStandardMaterial({ bumpMap: cane().bumpMap, color: 0xf3efe6, bumpScale: 2.5, roughness: 0.8 });   // the weave painted white: its relief, not its brown
  const whiteWood = std(0xf1ede4, { roughness: 0.55 });
  const rattan = new THREE.MeshStandardMaterial({ ...cane(), bumpScale: 2.5, roughness: 0.8 });
  const green = std(0x234d3a, { roughness: 0.6 });
  const caneOpen = rattan.clone(); caneOpen.side = THREE.DoubleSide;
  const chairWood = std(0x4a2c16, { roughness: 0.45 });
  const glow = (color, intensity) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
  const spots = {}, screens = {};
  const group = (name) => { const g = new THREE.Group(); scene.add(g); if (name) spots[name] = g; return g; };
  const room = group(null);
  const veil = [];      // things with no surface of their own (flames), left out when the contact shadows are worked out
  // What moves in the room, gently: each fan's blade arms (they turn) and each indoor plant's leaves (they sway). The page plays a
  // short loop of small pictures over these places; see the end of this file.
  const movers = [];
  // every leaf in and around the room is grown from the one modelled frond
  const leafGreen = new THREE.MeshStandardMaterial({ color: 0x3f8a48, roughness: 0.55, side: THREE.DoubleSide }), leafDeep = new THREE.MeshStandardMaterial({ color: 0x2a6a36, roughness: 0.38, side: THREE.DoubleSide }), leafFresh = new THREE.MeshStandardMaterial({ color: 0x5aa052, roughness: 0.5, side: THREE.DoubleSide });
  const palmLeaf = frond({ L: 1.3, HW: 0.21, pleats: 30, droop: 0.55, keel: 0.5, depth: 0.01, scallop: 0.1, shape: 0.6, NU: 240, NV: 64 });
  const pottedLeaf = frond({ L: 1.3, HW: 0.17, pleats: 16, droop: 0.6, keel: 0.35, depth: 0.004, scallop: 0.04, shape: 0.6, NU: 200, NV: 48 });   // softer pleats: read as leaflets, not blocks
  const broadLeaf = frond({ L: 0.46, HW: 0.21, pleats: 7, droop: 0.07, keel: 0.22, depth: 0.004, scallop: 0.2, shape: 0.5, NU: 90, NV: 40 });
  const spray = (parent, geometry, material, [x, y, z], count, size, lift, into) => {
    for (let f = 0; f < count; f++) {
      const g = new THREE.Group(); into?.push(g); g.position.set(x, y, z); g.rotation.set(0, (f / count) * Math.PI * 2 + rand() * 0.5, lift[0] + rand() * (lift[1] - lift[0])); g.scale.setScalar(size * (0.78 + rand() * 0.34)); parent.add(g);
      add(g, geometry, material, [0, 0, 0]);
    }
  };

  // ----- floor, shiplap walls and the thatch overhead
  add(room, tile(box(RW, 0.1, RD), 1.44, 5.76), new THREE.MeshStandardMaterial({ ...oakFloor(), bumpScale: 1.6, roughness: night ? 0.42 : 0.3, envMapIntensity: 1.0 }), [0, -0.05, -RD / 2], { cast: false });   // a little softer at night, so the fire's glare spreads instead of streaking
  const wallMat = new THREE.MeshStandardMaterial({ ...shiplap(), bumpScale: 1.6, roughness: 0.85 });
  // The side walls are full of windows, so the room is bright and the breeze comes through: on the right, four tall windows from the
  // door to the chimney; on the left, three tall windows at the front and a long strip of clerestory windows high over the bar. Each
  // wall is cut from one piece (its boards counted from the floor, so they meet the back wall's at the corner).
  const WINDOWS = {
    [-1]: [[0.6, 2.0, 0.55, 3.55], [2.2, 3.6, 0.55, 3.55], [3.8, 5.2, 0.55, 3.55], [5.9, 8.5, 3.42, 4.0], [8.6, 11.2, 3.42, 4.0]],
    [1]: [[0.6, 2.1, 0.55, 3.55], [2.3, 3.8, 0.55, 3.55], [4.0, 5.5, 0.55, 3.55], [5.7, 7.2, 0.55, 3.55]],
  };
  const paneGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, roughness: 0.03, thickness: 0.02, ior: 1.3, transparent: true, opacity: 0.18 });
  const sash = std(0xf7f4ec, { roughness: 0.55 });
  const sideWall = (side) => {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(RD, 0); shape.lineTo(RD, WH); shape.lineTo(0, WH); shape.closePath();
    for (const [a0, a1, y0, y1] of WINDOWS[side]) { const hole = new THREE.Path(); hole.moveTo(a0, y0); hole.lineTo(a0, y1); hole.lineTo(a1, y1); hole.lineTo(a1, y0); hole.closePath(); shape.holes.push(hole); }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }), uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.04, uv.getY(i) / 2.08);
    add(room, geometry, wallMat, [side > 0 ? RW / 2 : -RW / 2 - 0.2, 0, 0], { rot: [0, Math.PI / 2, 0] });
    const x = side * (RW / 2 + 0.06);
    for (const [a0, a1, y0, y1] of WINDOWS[side]) {
      const zc = -(a0 + a1) / 2, w = a1 - a0, h = y1 - y0, yc = (y0 + y1) / 2;
      add(room, new THREE.PlaneGeometry(w, h), paneGlass, [x, yc, zc], { cast: false, rot: [0, Math.PI / 2, 0] });
      for (const z of [-a0, -a1]) add(room, box(0.1, h + 0.08, 0.06), sash, [x - side * 0.04, yc, z]);
      for (const y of [y0, y1]) add(room, box(0.1, 0.06, w + 0.08), sash, [x - side * 0.04, y, zc]);
      if (h > 1) {
        add(room, box(0.06, 0.04, w), sash, [x - side * 0.04, y0 + h * 0.72, zc], { cast: true });                                 // transom bar
        add(room, box(0.06, h, 0.035), sash, [x - side * 0.04, yc, zc], { cast: true });                                           // centre mullion
        add(room, box(0.22, 0.04, w + 0.12), sash, [x - side * 0.1, y0 - 0.03, zc]);                                               // sill
      } else for (let k = 1; k < 4; k++) add(room, box(0.06, h, 0.035), sash, [x - side * 0.04, yc, -a0 - (k * w) / 4], { cast: true });
    }
  };
  for (const side of [-1, 1]) {
    sideWall(side);
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
  // Up high, three timber trusses span the room under the thatch, with a ridge beam along the top: dark-stained, eased edges, black
  // iron straps at the joints. Each is a tie beam across the room at the top of the walls, rafters following the roof, a king post up
  // the middle and two braces. They stand clear of the fans and above the boards.
  const beamWood = new THREE.MeshStandardMaterial({ map: (() => { const c = canvas(256, 64), g = c.getContext("2d"); g.fillStyle = "#4a2f1c"; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${rand() < 0.5 ? "30,18,10" : "110,74,44"},${0.15 + rand() * 0.2})`; g.lineWidth = 1 + rand() * 2; const y = rand() * 64; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + (rand() - 0.5) * 6, 170, y + (rand() - 0.5) * 6, 256, y); g.stroke(); } return texture(c); })(), roughness: 0.62 });
  const strap = std(0x1a1714, { roughness: 0.5, metalness: 0.5 });
  const beam = (from, to, w, h) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
    const mesh = add(room, rbox(len, h, w, 0.025), beamWood, [mid.x, mid.y, mid.z]);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
    return mesh;
  };
  const TIE = WH + 0.18, under = 0.16;                                                                                                  // rafters sit just under the thatch
  for (const z of [-2.6, -7.3, -11.6]) {
    const right = z < -8 && z > -11.8 ? X1 - 1.8 : X1;                                                                                 // the tie beam meets the chimney where it stands
    beam([X0, TIE, z], [right, TIE, z], 0.2, 0.26);
    const peak = RIDGE - under - 0.12;
    for (const side of [-1, 1]) beam([side * (RW / 2), WH + 0.05, z], [0, peak, z], 0.18, 0.22);
    beam([0, TIE + 0.13, z], [0, peak, z], 0.18, 0.2);                                                                                  // king post
    for (const side of [-1, 1]) beam([0, TIE + 0.5, z], [side * 1.55, TIE + 0.13 + (RIDGE - WH) * (1 - 1.55 / (RW / 2)) - 0.25, z], 0.14, 0.16);
    for (const x of [X0 + 0.3, X1 - 0.3, 0]) if (x <= right - 0.2) add(room, box(0.3, 0.36, 0.22), strap, [x, TIE, z], { cast: false });
    add(room, box(0.24, 0.24, 0.2), strap, [0, peak - 0.05, z], { cast: false });
  }
  beam([0, RIDGE - under - 0.12, -0.1], [0, RIDGE - under - 0.12, ZB + 0.1], 0.22, 0.28);                                          // ridge beam

  // Cabana fans: two big ones down the middle of the room. Each blade is a modelled palm leaf (pleated, scalloped at the edge,
  // keeled along its rib) carried on a cast brass iron; a turned timber housing banded in brass, a frosted light under it.
  const { leaf, rib } = palmBlade(1.05, 0.08);                                                                                         // a real big-room fan: about 2.9 m tip to tip
  const bladeMat = new THREE.MeshStandardMaterial({ ...bladeWood(), bumpScale: 0.5, roughness: 0.46, side: THREE.DoubleSide, envMapIntensity: 0.85 });
  const ribMat = std(0x4a2a12, { roughness: 0.5 });
  const housing = new THREE.LatheGeometry([[0, 0.2], [0.06, 0.2], [0.075, 0.15], [0.13, 0.12], [0.21, 0.07], [0.235, 0], [0.22, -0.07], [0.16, -0.11], [0, -0.11]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  // Each hangs on a downrod from the ridge beam, half-way between two trusses, so the blades turn clear of every timber.
  for (const [fx, fz, spin] of [[0, -4.95, 0.3], [0, -9.45, 0.9]]) {
    const arms = [];
    const top = RIDGE - under - 0.12 - 0.14, hub = 5.05, drop = top - hub;
    add(room, cyl(0.022, 0.022, drop, 10), brass, [fx, top - drop / 2, fz]);
    add(room, cyl(0.05, 0.13, 0.12, 24), brass, [fx, top - 0.06, fz]);                                                                 // canopy under the ridge beam
    add(room, housing, m.walnut, [fx, hub + 0.02, fz]);
    for (const [r, y] of [[0.238, 0.02], [0.2, -0.07], [0.1, 0.16]]) add(room, new THREE.TorusGeometry(r, 0.012, 8, 40), brass, [fx, hub + y, fz], { rot: [Math.PI / 2, 0, 0], cast: false });
    const shade = add(room, new THREE.SphereGeometry(0.17, 24, 16), glow(0xffe9c4, night ? 3.2 : 1.6), [fx, hub - 0.15, fz], { cast: false }); shade.scale.set(1, 0.62, 1);
    add(room, cyl(0.02, 0.012, 0.04, 12), brass, [fx, hub - 0.27, fz], { cast: false });
    for (let b = 0; b < 5; b++) {
      const arm = new THREE.Group(); arm.position.set(fx, hub - 0.02, fz); arm.rotation.set(0, (b / 5) * Math.PI * 2 + spin, -0.1); room.add(arm); arms.push(arm);
      add(arm, rbox(0.34, 0.03, 0.06, 0.012), brass, [0.33, -0.02, 0]);
      add(arm, rbox(0.22, 0.016, 0.14, 0.007), brass, [0.57, -0.035, 0]);
      for (const [sx, sz] of [[0.5, -0.04], [0.5, 0.04], [0.64, 0]]) add(arm, new THREE.SphereGeometry(0.011, 8, 6), brass, [sx, -0.046, sz], { cast: false });
      const blade = new THREE.Group(); blade.position.set(0.44, 0, 0); blade.rotation.x = 0.2; arm.add(blade);
      add(blade, leaf, bladeMat, [0, 0, 0]); add(blade, rib, ribMat, [0, 0, 0], { cast: false });
    }
    movers.push({ name: `fan${movers.length}`, kind: "spin", parts: arms });
    const l = new THREE.PointLight(0xffd9a0, night ? 5 : 1.4, 7, 1.5); l.position.set(fx, hub - 0.45, fz); scene.add(l);
  }

  // ----- the back wall, right: glass from the floor to the thatch, and the doors stand open. Four tall sliding doors, pushed back in
  // pairs to either side, leave the middle of the wall open to the patio; a linen sheer hangs at each side; the gable above is glazed.
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, roughness: 0.03, thickness: 0.02, ior: 1.3, transparent: true, opacity: 0.25 });
  const frameMat = std(0x2a2a27, { roughness: 0.4, metalness: 0.4 });
  const TRANSOM = 2.9, GX0 = -0.43, GX1 = 2.52, LEAF = (GX1 - GX0) / 4;
  const gable = new THREE.Shape(); gable.moveTo(X0, TRANSOM); gable.lineTo(X1, TRANSOM); gable.lineTo(X1, WH); gable.lineTo(0, RIDGE); gable.lineTo(X0, WH); gable.closePath();
  add(room, new THREE.ShapeGeometry(gable), glass, [0, 0, ZB], { cast: false });
  for (let i = 0; i <= 9; i++) { const x = X0 + (i * RW) / 9, h = WH + (RIDGE - WH) * (1 - Math.abs(x) / (RW / 2)) - TRANSOM; add(room, box(0.06, h, 0.1), frameMat, [x, TRANSOM + h / 2, ZB]); }
  add(room, box(RW, 0.08, 0.12), frameMat, [0, TRANSOM, ZB]); add(room, box(GX1 - GX0, 0.03, 0.2), frameMat, [(GX0 + GX1) / 2, 0.015, ZB + 0.03]);
  for (const side of [-1, 1]) add(room, box(len, 0.08, 0.12), frameMat, [side * RW / 4, (WH + RIDGE) / 2, ZB], { rot: [0, 0, side * -slope] });
  const door = (x0, z) => {
    for (const x of [x0 + 0.025, x0 + LEAF - 0.025]) add(room, box(0.05, TRANSOM - 0.08, 0.04), frameMat, [x, (TRANSOM - 0.04) / 2, z]);
    for (const y of [0.06, TRANSOM - 0.08]) add(room, box(LEAF, 0.06, 0.04), frameMat, [x0 + LEAF / 2, y, z]);
    add(room, new THREE.PlaneGeometry(LEAF - 0.1, TRANSOM - 0.2), glass, [x0 + LEAF / 2, TRANSOM / 2, z], { cast: false });
  };
  door(GX0, ZB); door(GX0 + 0.07, ZB + 0.06); door(GX1 - LEAF, ZB); door(GX1 - LEAF - 0.07, ZB + 0.06);
  const sheer = new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  for (const [x, lean] of [[GX0 + LEAF + 0.02, 1], [GX1 - LEAF - 0.02, -1]]) {
    const cloth = new THREE.PlaneGeometry(0.5, TRANSOM - 0.1, 30, 10), cp = cloth.attributes.position;
    for (let i = 0; i < cp.count; i++) { const u = cp.getX(i) / 0.5 + 0.5, down = 0.5 - cp.getY(i) / (TRANSOM - 0.1); cp.setZ(i, 0.035 * Math.sin(u * Math.PI * 9) + 0.22 * down * down * (lean > 0 ? u : 1 - u)); }   // gathered, and lifting a little on the breeze
    cloth.computeVertexNormals();
    add(room, cloth, sheer, [x, (TRANSOM - 0.1) / 2, ZB + 0.16], { cast: false });
  }
  add(room, cyl(0.012, 0.012, GX1 - GX0, 8), brass, [(GX0 + GX1) / 2, TRANSOM - 0.08, ZB + 0.16], { rot: [0, 0, Math.PI / 2], cast: false });

  // ----- outside: the pool patio, loungers, palms, the sea and the sky
  const out = group(null);
  add(out, box(29, 0.1, 22), new THREE.MeshStandardMaterial({ map: pavers(), roughness: 0.85 }), [-5.5, -0.06, ZB - 11], { cast: false });   // the patio stops at the beach on the sea side
  add(out, box(10.6, 0.12, 4.6), std(0xf4efe4), [0.6, 0.0, ZB - 6.2], { cast: false });
  const water = new THREE.MeshPhysicalMaterial({ color: night ? 0x18a6cf : 0x2fc0e0, roughness: 0.06, clearcoat: 1, emissive: night ? 0x0a7aa0 : 0x0a4a5a, emissiveIntensity: night ? 1.5 : 0.35 });
  add(out, box(10, 0.06, 4.0), water, [0.6, 0.04, ZB - 6.2], { cast: false });
  for (const x of [-3.4, -2.2, 2.6, 3.8]) {
    add(out, rbox(0.75, 0.12, 1.9, 0.04), white, [x, 0.3, ZB - 2.4]);
    add(out, rbox(0.75, 0.1, 0.7, 0.04), white, [x, 0.55, ZB - 1.65], { rot: [0.6, 0, 0] });
    add(out, rbox(0.66, 0.06, 1.8, 0.03), std(0x3f8fb0), [x, 0.38, ZB - 2.4]);
  }
  // A sunny jungle beach: coconut palms leaning every way (the crown heavy with nuts), banana plants and big-leafed undergrowth banked
  // thick along both sides of the patio and past the side windows, jungle-green headlands either side of the bay, white sand, and the
  // water turquoise over the shallows and deepening to blue.
  const trunkBark = std(0x9a8064, { roughness: 1 }), nut = std(0x5a3a1a, { roughness: 0.8 }), frondDark = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.55, side: THREE.DoubleSide });
  const palm = (x, z, h, lean = 0.3, turn = 0) => {
    const dx = Math.cos(turn) * lean * h * 0.25, dz = -Math.sin(turn) * lean * h * 0.25;
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0, z), new THREE.Vector3(x + dx * 0.9, h * 0.5, z + dz * 0.9), new THREE.Vector3(x + dx * 1.4, h, z + dz * 1.4)]);
    add(out, new THREE.TubeGeometry(trunk, 20, 0.16, 10), trunkBark, [0, 0, 0]);
    const top = [x + dx * 1.4, h - 0.1, z + dz * 1.4];
    spray(out, palmLeaf, leafGreen, top, 13, 2.3, [-0.1, 0.9]); spray(out, palmLeaf, frondDark, [top[0], top[1] + 0.1, top[2]], 6, 2.0, [0.5, 1.1]);
    for (let k = 0; k < 5; k++) { const a = k * 1.3; add(out, new THREE.SphereGeometry(0.13, 12, 10), nut, [top[0] + Math.cos(a) * 0.17, top[1] - 0.12 - (k % 2) * 0.08, top[2] + Math.sin(a) * 0.17]); }
  };
  palm(-6.2, ZB - 3.6, 6.2, 0.4, 2.6); palm(6.6, ZB - 4.5, 7.2, 0.5, 0.3); palm(-3.4, ZB - 10, 5.5, 0.35, 1.9); palm(5.0, ZB - 11, 6.4, 0.6, 0.6);
  palm(-1.2, ZB - 15.5, 6.8, 0.7, 1.4); palm(2.4, ZB - 16.5, 5.8, 0.8, 0.2); palm(-8.5, ZB - 9, 7.8, 0.4, 2.2);
  palm(-7.4, -2.6, 6.4, 0.3, 3.0); palm(-8.6, -7.2, 7.4, 0.4, 2.8); palm(-10.5, -4.8, 8.2, 0.3, 3.1); palm(-11.2, -10.4, 6.8, 0.5, 2.6);   // past the jungle-side windows
  // banana plants: a soft green stem and a crown of long torn leaves, arching
  const bananaLeaf = frond({ L: 1.7, HW: 0.32, pleats: 9, droop: 0.65, keel: 0.15, depth: 0.004, scallop: 0.18, shape: 0.5, NU: 80, NV: 20 });
  const banana = (x, z, h) => {
    add(out, cyl(0.09, 0.14, h, 10), std(0x7f9a4a, { roughness: 0.8 }), [x, h / 2, z]);
    spray(out, bananaLeaf, k3(x + z), [x, h - 0.05, z], 7, 1.2 + h * 0.15, [0.35, 1.05]);
  };
  const greens = [leafGreen, leafDeep, leafFresh, frondDark], k3 = (v) => greens[Math.abs(Math.round(v * 7)) % greens.length];
  // undergrowth: big round leaves heaped in mounds
  const bush = (x, z, r) => { spray(out, pottedLeaf, leafDeep, [x, 0.05, z], 11, r * 1.5, [0.15, 0.7]); spray(out, palmLeaf, greens[Math.abs(Math.round(x * 3 + z)) % 4], [x + 0.2, 0.1, z - 0.2], 7, r * 1.1, [0.5, 1.1]); };
  for (const side of [-1, 1]) {
    for (const [ox, oz, h] of [[5.6, -2.0, 2.4], [6.4, -4.2, 3.0], [5.4, -6.6, 2.2], [7.0, -8.0, 2.8], [6.0, -10.5, 2.5]]) banana(side * ox, ZB + oz, h);
    for (const [ox, oz, r] of [[5.0, -1.0, 0.9], [6.0, -3.0, 1.1], [7.2, -5.6, 1.2], [6.8, -8.8, 1.0], [8.4, -11, 1.4], [4.8, -12.5, 0.9]]) bush(side * ox, ZB + oz, r);
    if (side > 0) continue;                                                                                                           // the other side is the sea
    for (const [ox, z, h] of [[6.0, -1.5, 2.6], [6.8, -5.4, 3.2], [6.2, -9.4, 2.4], [7.6, -11.8, 3.0]]) banana(side * ox, z, h);   // past the side windows
    for (const [ox, z, r] of [[5.4, -0.6, 1.0], [6.2, -3.6, 1.2], [5.6, -7.6, 1.1], [6.6, -12.4, 1.3]]) bush(side * ox, z, r);
  }
  // headlands: hills under jungle, left and right of the bay, a little haze on the far ones
  const hillGreen = (far) => std(night ? 0x0c1e14 : far ? 0x7aa58c : 0x4a8a5a, { roughness: 1 });
  for (const [x, z, sx, sy, sz, far] of [[-22, ZB - 34, 16, 9, 10, false], [-34, ZB - 44, 18, 13, 10, true]]) {
    const hill = add(out, new THREE.SphereGeometry(1, 40, 20), hillGreen(far), [x, -0.4, z], { cast: false }); hill.scale.set(sx, sy, sz);
    for (let k = 0; k < 0; k++) {                                                                                                 // (no separate tree crowns: at this distance they read as blobs)
      const a = rand() * Math.PI, e = 0.15 + rand() * 0.8, px = x + Math.cos(a) * sx * Math.cos(e) * 0.95, py = -0.4 + sy * Math.sin(e) * 0.97, pz = z + Math.sin(a) * sz * Math.cos(e) * 0.95;
      add(out, new THREE.SphereGeometry(0.9 + rand() * 1.4, 10, 8), hillGreen(far), [px, py, pz], { cast: false });
    }
  }
  // On the sea side the sand runs only a few metres past the wall; past it the sea comes right round the house, turquoise over the
  // shallows, and curves away along the coast to a far headland: a sheer cliff of pale rock with jungle on its top.
  add(out, box(49, 0.1, 50), std(0xe8d9b4, { roughness: 1 }), [-15.5, -0.09, -12], { cast: false });                                   // white sand, the jungle side and under the house
  add(out, box(320, 0.05, 320), std(night ? 0x0e2a46 : 0x1f7fb8, { roughness: 0.15 }), [169, -0.32, -60], { cast: false });              // the sea, deep blue, on the sea side
  add(out, box(5, 0.05, 50), std(night ? 0x123a56 : 0x36c9c6, { roughness: 0.12 }), [11.5, -0.28, -12], { cast: false });            // the shallows along the shore
  add(out, box(1.2, 0.3, 50), std(0xece0be), [9.4, -0.2, -12], { cast: false });                                                    // the wet edge of the beach
  const rock = std(night ? 0x2a2a30 : 0x9c8a72, { roughness: 1 }), rockDark = std(night ? 0x1e1e24 : 0x75664f, { roughness: 1 }), cliffTop = std(night ? 0x0c1e14 : 0x3f7a4a, { roughness: 1 });
  for (const [x, z, w, h, d, turn] of [[130, -98, 30, 13, 14, 0.5], [146, -68, 24, 11, 12, 0.3], [114, -126, 28, 15, 12, 0.8], [158, -42, 20, 9, 10, 0.1]]) {   // far along the coast, low on the horizon
    // a sloping headland, not a wall: narrow at the top, spreading wide to the sea, with a long low shoulder running down into the water
    const shoulder = add(out, new THREE.SphereGeometry(1, 24, 12), cliffTop, [x - w * 0.35, -0.6, z + w * 0.3], { cast: false }); shoulder.scale.set(w * 0.75, h * 0.35, w * 0.6);
    const face = add(out, new THREE.CylinderGeometry(w * 0.26, w * 0.62, h, 9, 4), rock, [x, h / 2 - 0.5, z], { cast: false, rot: [0, turn, 0] });
    const p = face.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (rand() - 0.5) * 0.18; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } face.geometry.computeVertexNormals();   // a rough, ledged face
    for (let k = 0; k < 6; k++) add(out, new THREE.BoxGeometry(w * 0.3, 0.6, d * 0.3), rockDark, [x + (rand() - 0.5) * w * 0.4, h * (0.2 + k * 0.13), z + (rand() - 0.5) * d * 0.4], { cast: false, rot: [0, rand(), 0] });   // strata
    const top = add(out, new THREE.SphereGeometry(1, 20, 10), cliffTop, [x, h - 0.6, z], { cast: false }); top.scale.set(w * 0.3, 2.2, w * 0.3);
    for (let k = 0; k < 12; k++) add(out, new THREE.SphereGeometry(1 + rand() * 1.2, 10, 8), cliffTop, [x + (rand() - 0.5) * w * 0.45, h + 0.6 + rand(), z + (rand() - 0.5) * w * 0.45], { cast: false });
  }
  add(out, box(49, 0.05, 40), std(night ? 0x0e2a46 : 0x1f7fb8, { roughness: 0.15 }), [-15.5, -0.321, ZB - 46], { cast: false });   // the sea, deep blue
  add(out, box(49, 0.05, 8), std(night ? 0x123a56 : 0x36c9c6, { roughness: 0.12 }), [-15.5, -0.28, ZB - 24], { cast: false });    // the shallows, turquoise
  add(out, box(49, 0.4, 2), std(0xece0be), [-15.5, -0.2, ZB - 19.8], { cast: false });                                         // the beach
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 60), new THREE.MeshBasicMaterial({ map: sky(night), fog: false }));
  skyPlane.position.set(0, 26, ZB - 58); scene.add(skyPlane);
  // the same sky round both sides, so every side window looks out at open air (the sea and its far cliff on one side, the jungle on the other)
  const wingSky = skyPlane.material.clone(); wingSky.color.setScalar(night ? 1 : 0.9);
  for (const side of [-1, 1]) { const wing = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), wingSky); wing.position.set(side * (side > 0 ? 215 : 78), side > 0 ? 50 : 26, -40); if (side > 0) wing.scale.set(2.6, 2, 1); wing.rotation.y = -side * Math.PI / 2; scene.add(wing); }

  // ----- the back wall, left: the sportsbook, face on. A white shiplap wall from the floor to the thatch; on it the Big Board, the
  // under it one board of this week's spreads as wide as the wall allows, in type big enough to read, and the counter in front. No
  // sign says what it is: the boards and the counter say it.
  const book = group("sportsbook");
  const SX1 = -0.5, SX = (X0 + SX1) / 2, SWALL = ZB + 0.12, roofAt = (x) => WH + (RIDGE - WH) * (1 - Math.abs(x) / (RW / 2));
  const wallShape = new THREE.Shape(); wallShape.moveTo(X0, 0); wallShape.lineTo(SX1, 0); wallShape.lineTo(SX1, roofAt(SX1)); wallShape.lineTo(X0, WH); wallShape.closePath();
  add(room, new THREE.ShapeGeometry(wallShape), new THREE.MeshStandardMaterial({ ...shiplap([1 / 1.04, 1 / 2.08]), bumpScale: 1.6, roughness: 0.85 }), [0, 0, SWALL], { cast: false });
  add(room, box(0.14, roofAt(SX1), 0.2), timberDark, [SX1, roofAt(SX1) / 2, SWALL]);
  const lit = (parent, w, h, x, y, faceMap, level, housing = 0x111110) => {
    add(parent, rbox(w + 0.14, h + 0.14, 0.1, 0.02), std(housing, { roughness: 0.5 }), [x, y, SWALL + 0.05]);
    add(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: faceMap, emissive: 0xffffff, emissiveMap: faceMap, emissiveIntensity: level }), [x, y, SWALL + 0.105], { cast: false });
  };
  // The two screens are live: the picture leaves them dark and the page draws today's news on them (the standings on the Big Board,
  // this week's lines with your picks lit on the spreads board), so each is recorded as the four corners it fills in the picture.
  const screen = (parent, name, w, h, x, y, housing = 0x111110) => {
    add(parent, rbox(w + 0.14, h + 0.14, 0.1, 0.02), std(housing, { roughness: 0.5 }), [x, y, SWALL + 0.05]);
    add(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x050807, emissive: 0x0b1410, emissiveIntensity: 1, roughness: 0.4 }), [x, y, SWALL + 0.105], { cast: false });
    screens[name] = [[x - w / 2, y + h / 2], [x + w / 2, y + h / 2], [x + w / 2, y - h / 2], [x - w / 2, y - h / 2]].map(([cx, cy]) => new THREE.Vector3(cx, cy, SWALL + 0.106));
  };
  screen(book, "spreads", 3.5, 1.0, SX, 1.93);
  add(book, tile(rbox(2.9, 1.05, 0.7, 0.03), 1), barWood, [SX - 0.15, 0.525, ZB + 0.75]);
  add(book, box(3.0, 0.05, 0.8), brass, [SX - 0.15, 1.075, ZB + 0.75]);
  if (night) {                                                                                                                          // the same blue under the counter's lip
    add(book, box(2.9, 0.012, 0.012), glow(0x3aa8ff, 6), [SX - 0.15, 1.04, ZB + 1.15], { cast: false });
    const l = new THREE.PointLight(0x3a9cff, 0.45, 3, 2); l.position.set(SX - 0.15, 0.22, ZB + 1.8); book.add(l);   // low, wide and soft: a wash on the floor, no bright spot
  }
  for (const dx of [-1.2, -0.15, 0.9]) add(book, box(0.2, 0.03, 0.12), white, [SX + dx, 1.115, ZB + 0.8], { cast: false });       // ticket pads
  const board = group("board");
  screen(board, "board", 2.8, 2.0, SX + 0.35, 3.6, 0x12281e);   // narrower and taller (the leader and five more), its right edge over the spreads board's

  // ----- the left wall: the bar, running down the room. Counter and stools, the back bar and a neon sign on the wall, lanterns
  // over it, the plaques along its front; the champions' banners hang over it one behind another, each facing the door.
  // The bar: a fluted walnut front on a brass kick plate, a thick marble top with a brass foot rail below, green leather stools on
  // brass. Behind it a back bar of walnut and antique mirror: three glass shelves of real bottles lit from beneath, glassware in rows
  // on the back counter, and the neon over the mirror.
  const bar = group("bar");
  const BXc = X0 + 0.95, BZ = -8.5, BL = 5.6, FRONT = BXc + 0.375, CHAT_Z = Number(q.get("chatz") ?? BZ + 1.1);   // the chat laptop sits by the second stool, clear of the chalkboard
  add(bar, tile(rbox(0.75, 1.02, BL, 0.02), 1), barWood, [BXc, 0.53, BZ]);
  for (let k = 0; k < Math.floor(BL / 0.075); k++) add(bar, cyl(0.026, 0.026, 0.78, 10, 1), fluteWood, [FRONT, 0.55, BZ - BL / 2 + 0.06 + k * 0.075], { cast: false });   // flutes
  add(bar, box(0.03, 0.12, BL), brass, [FRONT + 0.02, 0.06, BZ]);                                                                      // kick plate
  add(bar, tile(rbox(0.06, 0.07, BL + 0.04, 0.015), 1), barWood, [FRONT + 0.02, 1.0, BZ]);                                                    // moulding under the top
  add(bar, rbox(0.98, 0.09, BL + 0.14, 0.035), m.marble, [BXc + 0.02, 1.1, BZ]);                                                     // the marble top
  add(bar, cyl(0.028, 0.028, BL, 16), brass, [FRONT + 0.16, 0.22, BZ], { rot: [Math.PI / 2, 0, 0] });                                  // foot rail
  // At night a blue neon line runs under the lip of the marble and another along the foot of the bar, washing the fluted front
  // and the floor in front of it: the room's one cool light, where people gather.
  if (night) {
    add(bar, box(0.012, 0.012, BL + 0.08), glow(0x3aa8ff, 6), [FRONT + 0.1, 1.045, BZ], { cast: false });
    add(bar, box(0.012, 0.012, BL - 0.1), glow(0x3aa8ff, 4), [FRONT + 0.05, 0.125, BZ], { cast: false });
    // five soft lights low and well out from the front, so the blue spreads evenly along the bar instead of pooling on a plaque
    for (const dz of [-2.2, -1.1, 0, 1.1, 2.2]) { const l = new THREE.PointLight(0x3a9cff, 0.5, 3.2, 2); l.position.set(FRONT + 0.7, 0.2, BZ + dz); bar.add(l); }
  }
  for (let k = 0; k < 5; k++) add(bar, cyl(0.012, 0.016, 0.2, 10), brass, [FRONT + 0.08, 0.2, BZ - BL / 2 + 0.4 + k * (BL - 0.8) / 4], { rot: [0, 0, Math.PI / 2] });
  const plaques = group("plaques");
  for (let i = 0; i < 5; i++) { const z = BZ + 2.2 - i * 1.1; add(plaques, rbox(0.03, 0.32, 0.46, 0.008), timberDark, [FRONT + 0.035, 0.62, z]); add(plaques, box(0.02, 0.24, 0.38), brass, [FRONT + 0.055, 0.62, z]); }
  const stoolLeather = new THREE.MeshPhysicalMaterial({ color: 0x1f4a36, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0x4f8a6a) });
  for (let i = 0; i < 5; i++) {
    const z = BZ + 2.2 - i * 1.1, sx = BXc + 0.92;
    add(bar, rbox(0.4, 0.09, 0.38, 0.04), stoolLeather, [sx, 0.79, z]);                                                               // the seat
    add(bar, rbox(0.06, 0.26, 0.34, 0.03), stoolLeather, [sx + 0.18, 0.97, z], { rot: [0, 0, -0.12] });                               // a low back
    add(bar, cyl(0.15, 0.15, 0.02, 24), brass, [sx, 0.73, z]);
    add(bar, cyl(0.025, 0.035, 0.66, 12), brass, [sx, 0.38, z]);
    add(bar, cyl(0.2, 0.22, 0.03, 28), brass, [sx, 0.015, z]);
    add(bar, new THREE.TorusGeometry(0.15, 0.011, 8, 28), brass, [sx, 0.3, z], { rot: [Math.PI / 2, 0, 0] });
  }
  // the back bar
  const WALL = X0 + 0.02;
  add(bar, tile(rbox(0.46, 0.92, BL, 0.02), 1), barWood, [WALL + 0.23, 0.46, BZ]);                                                           // back counter
  add(bar, rbox(0.5, 0.04, BL + 0.04, 0.01), m.marble, [WALL + 0.25, 0.94, BZ]);
  add(bar, box(0.03, 1.36, BL - 0.3), new THREE.MeshStandardMaterial({ color: 0xb8a888, metalness: 1, roughness: 0.12, envMapIntensity: 1.1 }), [WALL + 0.02, 1.66, BZ], { cast: false });   // antique mirror
  for (const z of [BZ - BL / 2 + 0.08, BZ + BL / 2 - 0.08, BZ - BL / 6, BZ + BL / 6]) add(bar, tile(box(0.06, 1.42, 0.1), 1), barWood, [WALL + 0.04, 1.66, z]);   // pilasters
  const panelWood = barWood.clone(); panelWood.clearcoat = 0; panelWood.roughness = 0.62;                                          // matte: no stray glare over the sign
  add(bar, tile(box(0.08, 0.86, BL + 0.1), 1), panelWood, [WALL + 0.04, 2.8, BZ]);
  // a brass picture lamp just past the neon (toward the front), its light washing the walnut beside the sign
  add(bar, cyl(0.016, 0.016, 0.16, 10), brass, [WALL + 0.14, 3.16, -8.25], { rot: [0, 0, Math.PI / 2] });
  add(bar, cyl(0.03, 0.03, 0.26, 16), brass, [WALL + 0.21, 3.18, -8.25], { rot: [Math.PI / 2, 0, 0] });
  { const lamp = new THREE.SpotLight(0xffd9a0, night ? 2.4 : 1.6, 1.6, 0.9, 0.7, 1.5); lamp.position.set(WALL + 0.24, 3.12, -8.25); lamp.target.position.set(WALL + 0.04, 2.6, -8.25); bar.add(lamp); bar.add(lamp.target); }                                                              // the panel above, where the neon hangs
  add(bar, tile(rbox(0.14, 0.1, BL + 0.2, 0.02), 1), barWood, [WALL + 0.07, 3.27, BZ]);                                                       // cornice
  add(bar, box(0.03, 0.03, BL), brass, [WALL + 0.1, 2.38, BZ]);
  // The bottles: clear or tinted glass with the spirit inside it (whiskey and bourbon amber, rum dark, tequila pale gold, gin and vodka
  // water-clear, a green liqueur, a red aperitivo, a blue curacao), each filled to its own level, wearing a printed label and a cap, a
  // cork or a pourer. Lit from the strip under each shelf, the liquor glows the way a back bar does.
  const glassOf = (tint) => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.03, metalness: 0, transmission: 0.94, thickness: 0.012, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 });
  const spiritOf = (color, clear) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, transmission: clear ? 0.9 : 0.12, thickness: 0.07, ior: 1.36, clearcoat: 0.6, emissive: color, emissiveIntensity: clear ? 0.05 : night ? 0.75 : 0.5 });   // the spirit holds its colour and glows a little, as liquor does lit from below
  const glasses = { clear: glassOf(0xffffff), green: glassOf(0xb7d6bc), brown: glassOf(0xd9b38a), blue: glassOf(0xa8c4e6) };
  // profiles, [radius, height] from the foot up; `fill` is how far up the spirit comes
  const shapes = {
    bourbon: { pts: [[0, 0], [0.038, 0], [0.04, 0.01], [0.04, 0.17], [0.034, 0.2], [0.014, 0.225], [0.013, 0.27], [0, 0.27]], fill: 0.17 },
    vodka: { pts: [[0, 0], [0.033, 0], [0.035, 0.01], [0.035, 0.2], [0.03, 0.235], [0.012, 0.26], [0.011, 0.32], [0, 0.32]], fill: 0.2 },
    gin: { pts: [[0, 0], [0.044, 0], [0.046, 0.01], [0.046, 0.15], [0.03, 0.18], [0.013, 0.19], [0.013, 0.23], [0, 0.23]], fill: 0.14 },
    liqueur: { pts: [[0, 0], [0.04, 0], [0.042, 0.02], [0.034, 0.1], [0.04, 0.17], [0.02, 0.2], [0.011, 0.22], [0.011, 0.25], [0, 0.25]], fill: 0.15 },
    cognac: { pts: [[0, 0], [0.03, 0], [0.05, 0.03], [0.054, 0.08], [0.045, 0.13], [0.016, 0.17], [0.013, 0.22], [0, 0.22]], fill: 0.11 },
    tequila: { pts: [[0, 0], [0.045, 0], [0.047, 0.01], [0.047, 0.13], [0.04, 0.15], [0.016, 0.16], [0.016, 0.18], [0, 0.18]], fill: 0.12 },
  };
  const lathe = Object.fromEntries(Object.entries(shapes).map(([k, { pts }]) => [k, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 22)]));
  // the spirit: the bottle's own profile, a little inside the glass, cut off flat at its fill line
  const inner = Object.fromEntries(Object.entries(shapes).map(([k, { pts, fill }]) => {
    const under = pts.filter(([, y]) => y <= fill), at = pts.findIndex(([, y]) => y > fill), [r0, y0] = pts[at - 1], [r1, y1] = pts[at];
    const rFill = r0 + (r1 - r0) * ((fill - y0) / (y1 - y0));
    return [k, new THREE.LatheGeometry([...under.map(([r, y]) => [r * 0.86, Math.max(0.004, y)]), [rFill * 0.86, fill], [0, fill]].map(([r, y]) => new THREE.Vector2(r, y)), 22)];
  }));
  // a square whiskey bottle: glass box, shoulder and neck, its spirit a box inside
  const squareGlass = new THREE.BoxGeometry(0.075, 0.17, 0.06), squareSpirit = new THREE.BoxGeometry(0.064, 0.13, 0.05);
  const spirits = { whiskey: [0xb8661c, false], bourbon: [0x9a4a12, false], rum: [0x5a2208, false], tequila: [0xe8c66a, false], clear: [0xeef4f2, true], green: [0x4c8a24, false], red: [0xb3121e, false], blue: [0x1f7ac0, false], cognac: [0x8a3a10, false] };
  const spiritMat = Object.fromEntries(Object.entries(spirits).map(([k, [c, clear]]) => [k, spiritOf(c, clear)]));
  const kinds = [["square", "clear", "whiskey"], ["vodka", "clear", "clear"], ["bourbon", "clear", "bourbon"], ["gin", "blue", "clear"], ["cognac", "clear", "cognac"], ["liqueur", "green", "green"], ["tequila", "clear", "tequila"], ["bourbon", "brown", "rum"], ["vodka", "clear", "red"], ["square", "clear", "bourbon"], ["gin", "clear", "clear"], ["liqueur", "clear", "blue"], ["bourbon", "clear", "whiskey"]];
  const labelSheet = bottleLabels();
  const labels = Array.from({ length: 8 }, (_, i) => { const t = labelSheet.clone(); t.repeat.set(0.25, 0.5); t.offset.set((i % 4) * 0.25, i < 4 ? 0.5 : 0); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }); });
  const caps = [brass, std(0x111111, { roughness: 0.4 }), std(0x8c1e24, { roughness: 0.4 }), std(0x9a7650, { roughness: 0.9 })];   // gold foil, black, red wax, cork
  const SHELVES = [1.16, 1.58, 2.0];
  SHELVES.forEach((y, sIndex) => {
    add(bar, box(0.24, 0.016, BL - 0.4), glass, [WALL + 0.14, y, BZ], { cast: false });
    add(bar, box(0.01, 0.012, BL - 0.4), glow(0xffd9a0, night ? 2.2 : 1.1), [WALL + 0.24, y - 0.014, BZ], { cast: false });              // a lamp strip under the shelf's front edge
    // Bottles fill the far two bays only (the near bay is the espresso station), and no two runs look alike: each bottle its own
    // size, a little forward or back, set close or with a gap, now and then a pair of the same.
    let z = BZ - BL / 2 + 0.3, last = null;
    for (let i = 0; z < BZ + BL / 6 - 0.12; i++) {
      const pick = rand() < 0.18 && last ? last : kinds[Math.floor(rand() * kinds.length)];
      last = pick;
      const [shape, glassKind, spirit] = pick, scale = (sIndex === 2 ? 0.9 : 1) * (0.84 + rand() * 0.32);
      if (Math.abs(z - (BZ - BL / 6)) < 0.08) { z += 0.12; continue; }                                                                  // leave the pilaster clear
      const x = WALL + 0.12 + rand() * 0.05, foot = y + 0.008;
      let h, labelX, labelY;
      if (shape === "square") {
        add(bar, squareGlass, glasses[glassKind], [x, foot + 0.085 * scale, z], { cast: false, scale });
        add(bar, squareSpirit, spiritMat[spirit], [x, foot + (0.005 + 0.065) * scale, z], { cast: false, scale });
        add(bar, cyl(0.014, 0.03, 0.03, 12), glasses[glassKind], [x, foot + 0.185 * scale, z], { cast: false, scale });
        add(bar, cyl(0.012, 0.012, 0.05, 10), glasses[glassKind], [x, foot + 0.225 * scale, z], { cast: false, scale });
        h = 0.25; labelX = x + 0.0385 * scale; labelY = foot + 0.08 * scale;
      } else {
        add(bar, lathe[shape], glasses[glassKind], [x, foot, z], { cast: false, scale });
        add(bar, inner[shape], spiritMat[spirit], [x, foot, z], { cast: false, scale });
        h = shapes[shape].pts.at(-1)[1]; labelX = x + (shapes[shape].pts[2][0] + 0.002) * scale; labelY = foot + shapes[shape].fill * 0.5 * scale;
      }
      add(bar, cyl(0.0145, 0.0145, 0.03, 10), caps[(i + sIndex) % caps.length], [x, foot + (h + 0.012) * scale, z], { cast: false });
      add(bar, new THREE.PlaneGeometry(0.052, 0.06 + (i % 3) * 0.012), labels[(i * 3 + sIndex) % labels.length], [labelX, labelY, z], { cast: false, rot: [0, Math.PI / 2, 0] });
      z += (0.074 + rand() * 0.03) * scale + (rand() < 0.12 ? 0.06 + rand() * 0.06 : 0);
    }
    { const l = new THREE.PointLight(0xffc98a, night ? 0.9 : 0.7, 2.2, 1.6); l.position.set(WALL + 0.4, y + 0.2, BZ); bar.add(l); }   // the shelf lamps are on by day too: the back bar is in shade
  });
  // glassware on the back counter: rocks glasses and coupes in neat rows, upturned on a bar mat
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transmission: 1, thickness: 0.02, ior: 1.5, clearcoat: 1, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const rocks = new THREE.LatheGeometry([[0, 0], [0.036, 0], [0.04, 0.004], [0.042, 0.085], [0.038, 0.085], [0.034, 0.012], [0, 0.012]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const coupe = new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.032, 0.006], [0.005, 0.012], [0.004, 0.09], [0.03, 0.1], [0.055, 0.13], [0.052, 0.132], [0.028, 0.104], [0, 0.098]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
  add(bar, box(0.3, 0.008, 1.4), std(0x111111, { roughness: 0.9 }), [WALL + 0.3, 0.965, BZ - 0.2], { cast: false });
  for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) add(bar, k % 3 === 2 ? coupe : rocks, crystal, [WALL + 0.22 + r * 0.12, 0.97, BZ - 0.8 + k * 0.14 + r * 0.07], { cast: false });
  // ----- the espresso station, in the near third of the back bar: a polished two-group machine on the counter with cups warming on
  // top, a grinder with its hopper of beans beside it, a knock box and a milk pitcher; on the shelves above, white cups and saucers in
  // stacks, mugs on hooks and glass jars of beans, all under the same shelf lamps as the bottles.
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.16, envMapIntensity: 1.2 });
    const black = std(0x16120f, { roughness: 0.45 }), china = std(0xf4f1ea, { roughness: 0.35 }), copper = new THREE.MeshStandardMaterial({ color: 0xc27a4a, metalness: 1, roughness: 0.25 });
    const beans = std(0x3b2216, { roughness: 0.8 }), jarGlass = glassOf(0xffffff);
    const EZ = BZ + 1.42, TOP = 0.96, FRONT_X = WALL + 0.44;
    // the machine: a steel body with a copper band, the two group heads at the front, their black-handled portafilters, a drip tray,
    // a steam wand at each side and a gauge on the face
    add(bar, rbox(0.34, 0.36, 0.66, 0.03), steel, [WALL + 0.25, TOP + 0.2, EZ]);
    add(bar, box(0.345, 0.03, 0.665), copper, [WALL + 0.25, TOP + 0.3, EZ], { cast: false });
    add(bar, box(0.3, 0.025, 0.6), std(0x2a2a2a, { metalness: 0.6, roughness: 0.4 }), [WALL + 0.32, TOP + 0.02, EZ], { cast: false });   // drip tray
    for (const dz of [-0.15, 0.15]) {
      add(bar, cyl(0.045, 0.05, 0.06, 20), steel, [FRONT_X - 0.02, TOP + 0.15, EZ + dz]);                                            // group head
      add(bar, cyl(0.04, 0.04, 0.03, 20), steel, [FRONT_X - 0.01, TOP + 0.105, EZ + dz]);                                            // portafilter basket
      add(bar, cyl(0.012, 0.016, 0.16, 10), black, [FRONT_X + 0.08, TOP + 0.1, EZ + dz], { rot: [0, 0, Math.PI / 2 - 0.15] });        // its handle
      add(bar, cyl(0.03, 0.026, 0.06, 16), china, [FRONT_X - 0.02, TOP + 0.06, EZ + dz], { cast: false });                            // a cup waiting under it
    }
    for (const dz of [-0.36, 0.36]) add(bar, cyl(0.006, 0.006, 0.2, 8), steel, [FRONT_X - 0.04, TOP + 0.2, EZ + dz], { rot: [0.25 * Math.sign(dz), 0, 0.2] });   // steam wands
    add(bar, cyl(0.035, 0.035, 0.012, 20), china, [FRONT_X - 0.07, TOP + 0.28, EZ], { rot: [0, 0, Math.PI / 2], cast: false });     // the gauge
    for (let k = 0; k < 8; k++) add(bar, cyl(0.03, 0.025, 0.055, 14), china, [WALL + 0.2 + (k % 2) * 0.08, TOP + 0.41, EZ - 0.24 + Math.floor(k / 2) * 0.16], { cast: false });   // cups warming on top
    // the grinder: a black body, a glass hopper of beans
    const GZ = EZ + 0.55;   // beside it, toward the near end (the pilaster is on its other side)
    add(bar, rbox(0.18, 0.3, 0.16, 0.02), black, [WALL + 0.26, TOP + 0.15, GZ]);
    add(bar, cyl(0.075, 0.035, 0.16, 20), jarGlass, [WALL + 0.26, TOP + 0.38, GZ], { cast: false });
    add(bar, cyl(0.065, 0.034, 0.1, 20), beans, [WALL + 0.26, TOP + 0.35, GZ], { cast: false });
    add(bar, cyl(0.078, 0.078, 0.015, 20), black, [WALL + 0.26, TOP + 0.465, GZ]);
    add(bar, rbox(0.1, 0.08, 0.1, 0.01), black, [WALL + 0.36, TOP + 0.04, EZ + 0.8]);                                                // knock box
    add(bar, cyl(0.03, 0.038, 0.1, 16), steel, [WALL + 0.36, TOP + 0.05, EZ + 0.92]);                                                // milk pitcher
    // the shelves above: cups and saucers in stacks, jars of beans, mugs
    SHELVES.forEach((y, sIndex) => {
      let z = BZ + BL / 6 + 0.2;
      for (let k = 0; z < BZ + BL / 2 - 0.25; k++) {
        const kind = (k + sIndex) % 4;
        if (kind === 0) for (let n = 0; n < 4; n++) add(bar, cyl(0.032, 0.026, 0.05, 14), china, [WALL + 0.13, y + 0.035 + n * 0.048, z], { cast: false });   // a stack of cups
        else if (kind === 1) for (let n = 0; n < 6; n++) add(bar, cyl(0.06, 0.05, 0.012, 18), china, [WALL + 0.13, y + 0.014 + n * 0.014, z], { cast: false });   // saucers
        else if (kind === 2) { add(bar, cyl(0.05, 0.05, 0.16, 18), jarGlass, [WALL + 0.13, y + 0.088, z], { cast: false }); add(bar, cyl(0.045, 0.045, 0.11 + (k % 3) * 0.015, 16), beans, [WALL + 0.13, y + 0.065, z], { cast: false }); add(bar, cyl(0.053, 0.053, 0.02, 18), copper, [WALL + 0.13, y + 0.175, z]); }   // a jar of beans
        else for (let n = 0; n < 2; n++) add(bar, cyl(0.036, 0.034, 0.08, 14), [china, std(0x2f5d4a, { roughness: 0.35 })][n], [WALL + 0.13, y + 0.048, z + n * 0.085], { cast: false });   // mugs
        z += kind === 3 ? 0.27 : 0.17;
      }
    });
  }
  add(bar, new THREE.PlaneGeometry(2.6, 0.51), new THREE.MeshBasicMaterial({ map: readable(neon("Lead Pipe Locks")), transparent: true, toneMapped: false }), [WALL + 0.085, 2.8, -10.0], { cast: false, rot: [0, Math.PI / 2, 0] }).renderOrder = 2;
  // on the bar top: the tap tower, a cocktail shaker, a pair of glasses
  add(bar, box(0.08, 0.08, 0.5), brass, [BXc - 0.1, 1.55, BZ - 1.0]);
  for (let i = 0; i < 4; i++) { add(bar, cyl(0.03, 0.03, 0.4, 10), brass, [BXc - 0.1, 1.36, BZ - 1.18 + i * 0.12]); add(bar, rbox(0.04, 0.16, 0.04, 0.01), std([0x1f4a36, 0x8c1e24, 0xc9a45f, 0x1d3557][i]), [BXc - 0.1, 1.68, BZ - 1.18 + i * 0.12]); }
  add(bar, new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.045, 0.14], [0.03, 0.17], [0.03, 0.2], [0.012, 0.22], [0, 0.23]].map(([r, y]) => new THREE.Vector2(r, y)), 20), new THREE.MeshStandardMaterial({ color: 0xd8dbe0, metalness: 1, roughness: 0.18 }), [BXc + 0.1, 1.145, BZ - 2.1]);
  for (const dz of [0, 0.12]) add(bar, coupe, crystal, [BXc + 0.18, 1.145, BZ - 1.8 + dz], { cast: false });
  for (const z of [BZ + 2.55]) {                                                                                                       // a brass lamp with a pleated shade (none at the far end: it stood in front of the spreads board)
    add(bar, cyl(0.07, 0.09, 0.03, 20), brass, [BXc - 0.12, 1.16, z]);
    add(bar, cyl(0.012, 0.012, 0.36, 8), brass, [BXc - 0.12, 1.34, z]);
    add(bar, cyl(0.07, 0.14, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3ead3, emissive: 0xffd9a0, emissiveIntensity: night ? 0.9 : 0.3, roughness: 0.9, side: THREE.DoubleSide }), [BXc - 0.12, 1.58, z], { cast: false });
    if (night) { const l = new THREE.PointLight(0xffc27a, 1.6, 3, 1.6); l.position.set(BXc + 0.1, 1.6, z); bar.add(l); }
  }
  const chat = group("chat");
  add(chat, rbox(0.27, 0.02, 0.38, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [BXc + 0.05, 1.18, CHAT_Z]);
  const lid = new THREE.Group(); lid.position.set(BXc - 0.08, 1.19, CHAT_Z); lid.rotation.set(0, Math.PI / 2, 0); chat.add(lid);
  const lidTilt = new THREE.Group(); lidTilt.rotation.x = -0.3; lid.add(lidTilt);
  add(lidTilt, rbox(0.38, 0.26, 0.02, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [0, 0.13, 0]);
  add(lidTilt, new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ map: screenTex(), emissive: 0xffffff, emissiveMap: screenTex(), emissiveIntensity: 0.85 }), [0, 0.13, 0.012], { cast: false });
  const pennant = (color, year) => {
    const c = canvas(256, 600), g = c.getContext("2d");
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 480); g.lineTo(128, 600); g.lineTo(0, 480); g.closePath(); g.fill();
    g.strokeStyle = "#e6cf98"; g.lineWidth = 12; g.stroke(); g.fillStyle = "#e6cf98"; g.textAlign = "center";
    g.font = "700 52px Georgia"; g.fillText("CHAMPS", 128, 200); g.font = "700 72px Georgia"; g.fillText(String(year), 128, 300);
    return new THREE.MeshStandardMaterial({ map: texture(c), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  };

  // ----- the right wall: a grand fieldstone chimney from the floor to the thatch, the constitution framed on its near face, and the
  // lounge in front of it.
  const fire = group("fireplace");
  STONE.lift = Number(q.get("stonelift") ?? 1);
  // The stone is real relief, not only shading: the wall's surface is moved out by each stone's height (displacement), so stones stand
  // proud of one another, throw shade into their joints and break the chimney's outline. stonedisp=0 goes back to a flat shaded wall.
  const DISP = Number(q.get("stonedisp") ?? 0.04), stoneTex = fieldstone();
  const FZ = -9.9, CD = 1.8, stone = new THREE.MeshStandardMaterial({ ...stoneTex, bumpScale: Number(q.get("stonebump") ?? 14), roughness: 0.92, ...(DISP ? { displacementMap: stoneTex.bumpMap, displacementScale: DISP, displacementBias: -DISP * 0.15 } : {}) });
  // Every stone box is laid with wrapTile, so the stones carry round the corners of the chimney and the fireplace surround; with relief on,
  // it is cut fine enough (about 2.5 cm) for the surface to follow each stone.
  const seg = (size) => (DISP ? Math.max(1, Math.ceil(size / 0.025)) : 1);
  // Behind the relief, a plain core of mortar a little inside each box: where two faces lift apart at a corner, the gap shows mortar,
  // a joint running up the corner, never daylight.
  const mortar = std(0x5e554a, { roughness: 1 });
  const stoneBlock = (w, h, d, at) => {
    if (DISP) add(fire, box(w - 0.004, h - 0.004, d - 0.004), mortar, at, { cast: false });
    const g = wrapTile(new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)), 1.9, 2.0, at);
    if (DISP) {
      // On every edge the two faces' points sit together and carry the same height (wrapTile); pointing both out along the corner's
      // diagonal moves them to the same place, so a stone lifted at a corner stays one stone round it, with no seam.
      const p = g.attributes.position, n = g.attributes.normal, e = 1e-4;
      for (let i = 0; i < p.count; i++) {
        const x = Math.abs(Math.abs(p.getX(i)) - w / 2) < e, y = Math.abs(Math.abs(p.getY(i)) - h / 2) < e, z = Math.abs(Math.abs(p.getZ(i)) - d / 2) < e;
        if (x + y + z < 2) continue;
        const v = new THREE.Vector3(x ? Math.sign(p.getX(i)) : 0, y ? Math.sign(p.getY(i)) : 0, z ? Math.sign(p.getZ(i)) : 0).normalize();
        n.setXYZ(i, v.x, v.y, v.z);
      }
    }
    return add(fire, g, stone, at);
  };
  stoneBlock(CD, RIDGE, 3.6, [X1 - CD / 2, RIDGE / 2, FZ]);
  stoneBlock(0.6, 0.5, 4.2, [X1 - CD - 0.3, 0.25, FZ]);                                                  // raised hearth
  // the fireplace proper: a stone surround standing proud of the chimney, the firebox set back between its jambs
  for (const side of [-1, 1]) stoneBlock(0.28, 1.5, 0.44, [X1 - CD - 0.14, 1.25, FZ + side * 1.17]);
  stoneBlock(0.28, 0.3, 2.78, [X1 - CD - 0.14, 1.97, FZ]);
  add(fire, box(0.1, 1.34, 1.92), std(0x120e0b, { roughness: 1 }), [X1 - CD - 0.04, 1.16, FZ], { cast: false });   // in front of the stones' relief
  // The fire is lit at night. By day it is laid but cold: logs on the grate, a little pale ash.
  add(fire, box(0.5, 0.04, 1.3), std(0x1c1814, { roughness: 1 }), [X1 - CD - 0.14, 0.52, FZ], { cast: false });                      // the grate
  if (night) {
    add(fire, box(0.02, 0.5, 1.5), glow(0xb8380a, 1.4), [X1 - CD - 0.035, 0.78, FZ], { cast: false });                                // embers glowing on the back of the firebox
    const fireMat = new THREE.MeshBasicMaterial({ map: fireTongue(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    fireMat.color.setScalar(3.2);
    [[-0.46, 0.5], [-0.24, 0.78], [0.0, 0.95], [0.22, 0.72], [0.44, 0.48], [-0.12, 0.6], [0.12, 0.66]].forEach(([dz, h], i) => {
      for (const turn of [-0.45, 0.5]) veil.push(add(fire, new THREE.PlaneGeometry(h * 0.52, h), fireMat, [X1 - CD - 0.11 - (i % 3) * 0.035, 0.58 + h / 2, FZ + dz], { cast: false, receive: false, rot: [0, -Math.PI / 2 + turn, 0] }));
    });
    const flame = new THREE.PointLight(0xff8a3a, Number(q.get("flame") ?? 5.5), 7, 1.5); flame.position.set(X1 - CD - 0.7, 0.9, FZ); fire.add(flame);
  } else add(fire, box(0.3, 0.02, 1.0), std(0xb8b2a8, { roughness: 1 }), [X1 - CD - 0.14, 0.55, FZ], { cast: false });              // cold ash
  for (let i = 0; i < 3; i++) add(fire, cyl(0.07, 0.07, 1.0, 8), std(0x3a2414), [X1 - CD - 0.12, 0.6 + i * 0.05, FZ - 0.15 + i * 0.15], { rot: [Math.PI / 2, 0, 0.3 * i] });
  const MD = Number(q.get("mantel") ?? 0.6);   // the mantel's depth out from the stone
  add(fire, rbox(MD, 0.26, 3.8, 0.02), timberDark, [X1 - CD + 0.11 - MD / 2, 2.25, FZ]);                            // timber mantel beam
  // The mantel's art: a small framed seascape leaning back against the stone in the middle of the mantel, in a plain dark wood frame
  // with a thin gilt slip, quiet enough to fill the spot without pulling the eye (art=0 leaves the mantel bare).
  const arts = (q.get("art") ?? "boat").split(",");   // the owner chose the sailboat (2026-11-22); vase and painting stay as options
  if (arts.includes("boat")) {
    // A model sailing yacht on a little walnut stand, side-on to the room, sails in old canvas: it reads as a quiet silhouette.
    const boat = new THREE.Group(); boat.position.set(X1 - CD + 0.11 - MD / 2, 2.38, FZ + Number(q.get("boatz") ?? 0.6)); fire.add(boat);
    boat.rotation.y = Number(q.get("boatturn") ?? 0.5); boat.scale.setScalar(Number(q.get("boatscale") ?? 1.0));
    const L = 0.5;
    add(boat, rbox(0.2, 0.025, 0.07, 0.006), std(0x3a2416, { roughness: 0.55 }), [0, 0.012, 0]);
    for (const dx of [-0.07, 0.07]) add(boat, box(0.012, 0.07, 0.03), std(0x3a2416, { roughness: 0.55 }), [dx, 0.05, 0]);
    const hull = add(boat, new THREE.SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std(0x24324a, { roughness: 0.5 }), [0, 0.1, 0], { rot: [Math.PI, 0, 0] });
    hull.scale.set(L, 0.16, 0.13);
    add(boat, box(L * 0.98, 0.012, 0.12), std(0xc9a46a, { roughness: 0.6 }), [0, 0.1, 0]);     // the deck
    add(boat, cyl(0.006, 0.006, 0.5, 8), std(0x6b4a2c), [0.02, 0.35, 0]);                       // the mast
    const sail = (pts) => { const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); return new THREE.ShapeGeometry(shape); };
    const canvasSail = new THREE.MeshStandardMaterial({ color: 0xeee4cf, roughness: 0.95, side: THREE.DoubleSide });
    add(boat, sail([[0.03, 0.13], [0.03, 0.58], [0.21, 0.14]]), canvasSail, [0, 0, 0.001], { cast: false });
    add(boat, sail([[0.0, 0.16], [0.0, 0.52], [-0.2, 0.13]]), canvasSail, [0, 0, 0.002], { cast: false });
  }
  if (arts.includes("vase")) {
    // A tall stoneware vase with a celadon glaze.
    const vase = new THREE.Group(); vase.position.set(X1 - CD + 0.11 - MD / 2, 2.38, FZ + Number(q.get("vasez") ?? -0.8)); vase.scale.setScalar(Number(q.get("vasescale") ?? 1.5)); fire.add(vase);
    const profile = [[0, 0], [0.07, 0], [0.09, 0.03], [0.13, 0.14], [0.14, 0.22], [0.11, 0.32], [0.06, 0.4], [0.05, 0.46], [0.065, 0.5], [0.06, 0.505]].map(([r, y]) => new THREE.Vector2(r, y));
    add(vase, new THREE.LatheGeometry(profile, 32), std(0x9fb39a, { roughness: 0.35 }), [0, 0, 0]);
  }
  if (arts.includes("painting")) {
    const [AW, AH] = (q.get("artsize") ?? "1.0,0.62").split(",").map(Number);
    const art = new THREE.Group(); art.position.set(X1 - CD - 0.16, 2.38, FZ + Number(q.get("artz") ?? 0)); art.rotation.z = -0.1; fire.add(art);
    add(art, rbox(0.045, AH, AW, 0.01), std(0x3a2416, { roughness: 0.55 }), [0, AH / 2, 0]);
    add(art, box(0.05, AH - 0.1, AW - 0.1), std(0xb89452, { metalness: 0.55, roughness: 0.4 }), [-0.002, AH / 2, 0], { cast: false });
    add(art, new THREE.PlaneGeometry(AW - 0.13, AH - 0.13), new THREE.MeshStandardMaterial({ map: readable(seascape()), roughness: 0.85 }), [-0.028, AH / 2, 0], { cast: false, rot: [0, -Math.PI / 2, 0] });
  }
  const ball = add(fire, new THREE.SphereGeometry(0.1, 20, 14), std(0x6b3a1e, { roughness: 0.6 }), [X1 - CD - 0.1, 2.47, FZ + 1.35]); ball.scale.set(1, 0.95, 1.6);
  add(fire, box(0.012, 0.012, 0.2), white, [X1 - CD - 0.1, 2.57, FZ + 1.35], { cast: false });
  add(fire, rbox(0.03, 0.3, 0.38, 0.008), timberDark, [X1 - CD - 0.02, 2.54, FZ - 1.3], { rot: [0, 0, 0.12] });
  add(fire, box(0.005, 0.22, 0.3), std(0x9fc4dd), [X1 - CD - 0.04, 2.54, FZ - 1.3], { cast: false, rot: [0, 0, 0.12] });
  const charter = group("constitution");
  const CX = X1 - CD / 2, CZ = FZ + 1.8;
  add(charter, box(0.74, 0.94, 0.06), std(0xa8823a, { metalness: 0.6, roughness: 0.35 }), [CX, 2.45, CZ + 0.03]);
  add(charter, new THREE.PlaneGeometry(0.62, 0.79), new THREE.MeshStandardMaterial({ map: readable(parchment()), roughness: 0.9 }), [CX, 2.45, CZ + 0.065], { cast: false });
  add(charter, box(0.5, 0.04, 0.12), brass, [CX, 2.99, CZ + 0.07]);
  // The lounge by the fire, kept clear of the way through: a linen sofa facing you from the far side, two cane armchairs facing the
  // fire, a low table between; a clear aisle runs past it along the bar and on to the open doors.
  add(room, box(3.3, 0.012, 3.3), new THREE.MeshStandardMaterial({ map: stripeRug(), roughness: 1 }), [0.5, 0.006, FZ - 0.1], { cast: false });
  const sofa = (x, z, facing) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = facing; scene.add(s);
    // a deep white slip-covered sofa on a white cane plinth: three loose seat cushions, three back cushions, rolled arms, and
    // pillows in navy, cornflower and a blue ticking stripe
    add(s, rbox(2.4, 0.2, 0.98, 0.03), whiteCane, [0, 0.16, 0]);
    for (const dx of [-1.12, 1.12]) for (const dz of [-0.4, 0.4]) add(s, cyl(0.03, 0.022, 0.08, 10), whiteWood, [dx, 0.04, dz]);
    add(s, rbox(2.4, 0.66, 0.2, 0.08), slipcover, [0, 0.56, -0.4]);
    for (const dx of [-0.7, 0, 0.7]) { add(s, rbox(0.69, 0.22, 0.74, 0.09), slipcover, [dx, 0.36, 0.08]); add(s, rbox(0.68, 0.46, 0.2, 0.09), slipcover, [dx, 0.68, -0.26], { rot: [-0.16, 0, 0] }); }
    for (const dx of [-1.16, 1.16]) add(s, rbox(0.24, 0.5, 0.98, 0.11), slipcover, [dx, 0.45, 0]);
    for (const dx of [-0.82, 0.82]) add(s, rbox(0.44, 0.4, 0.16, 0.075), navy, [dx, 0.66, -0.1], { rot: [-0.3, dx > 0 ? -0.25 : 0.25, 0] });
    for (const dx of [-0.42, 0.42]) add(s, rbox(0.38, 0.34, 0.14, 0.065), dx > 0 ? stripe : cornflower, [dx, 0.62, -0.02], { rot: [-0.26, dx > 0 ? -0.12 : 0.12, 0] });
  };
  sofa(0.55, FZ - 1.45, 0);
  for (const z of [FZ + 0.55, FZ - 0.55]) {
    const chair = new THREE.Group(); chair.position.set(-0.55, 0, z); chair.rotation.y = Math.PI / 2; scene.add(chair);
    // white-painted cane armchairs with a cornflower seat cushion and a striped one at the back
    add(chair, rbox(0.85, 0.3, 0.8, 0.1), whiteCane, [0, 0.24, 0]); add(chair, rbox(0.85, 0.62, 0.14, 0.07), whiteCane, [0, 0.58, -0.36]); add(chair, rbox(0.7, 0.14, 0.64, 0.06), cornflower, [0, 0.45, 0.04]);
    add(chair, rbox(0.6, 0.36, 0.13, 0.06), stripe, [0, 0.66, -0.25], { rot: [-0.2, 0, 0] });
    for (const dx of [-0.42, 0.42]) add(chair, rbox(0.1, 0.24, 0.76, 0.045), whiteCane, [dx, 0.52, 0.0]);
    for (const dx of [-0.36, 0.36]) for (const dz of [-0.32, 0.32]) add(chair, cyl(0.025, 0.02, 0.1, 8), whiteWood, [dx, 0.05, dz]);
  }
  add(room, rbox(0.75, 0.06, 1.3, 0.02), whiteWood, [0.65, 0.4, FZ]);                                                                 // the low table, painted white
  add(room, rbox(0.66, 0.02, 1.2, 0.01), whiteWood, [0.65, 0.12, FZ]);                                                                  // its lower shelf
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.56, 0.56]) add(room, cyl(0.03, 0.022, 0.37, 10), whiteWood, [0.65 + dx, 0.185, FZ + dz]);
  // the record book (the pool's stats) lies open on the low table, where anyone in the lounge can leaf through it
  const record = group("record");
  add(record, rbox(0.42, 0.05, 0.56, 0.01), std(0x6b1f1a, { roughness: 0.5 }), [0.62, 0.455, FZ + 0.25], { rot: [0, 0.15, 0] });
  add(record, new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshStandardMaterial({ map: bookPages(), roughness: 0.9 }), [0.62, 0.484, FZ + 0.25], { cast: false, rot: [-Math.PI / 2, 0, Math.PI / 2 + 0.15] });

  // ----- the Trophy Room: a walnut shelf on the chimney above the constitution with one gilt cup standing on it. (It was a painted
  // sign with an arrow, which promised a hallway the room does not have.) It opens the Trophy Room as it is today.
  const trophies = group("trophies");
  const SGX = X1 - CD / 2, SGY = 3.2, SGZ = FZ + 1.8 + 0.03;
  add(trophies, rbox(0.95, 0.05, 0.3, 0.015), m.walnut, [SGX, SGY, SGZ + 0.15]);
  for (const dx of [-0.34, 0.34]) add(trophies, rbox(0.05, 0.2, 0.22, 0.015), m.walnut, [SGX + dx, SGY - 0.12, SGZ + 0.11]);
  const gilt = new THREE.MeshStandardMaterial({ color: 0xe8bc58, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.6, emissive: 0x4a3208, emissiveIntensity: 0.6 });
  const cup = new THREE.Group(); cup.position.set(SGX, SGY + 0.025, SGZ + 0.16); cup.scale.setScalar(1.7); trophies.add(cup);
  add(cup, rbox(0.2, 0.07, 0.2, 0.01), m.walnut, [0, 0.035, 0]);
  add(cup, new THREE.LatheGeometry([[0, 0], [0.075, 0], [0.07, 0.02], [0.03, 0.04], [0.018, 0.1], [0.03, 0.16], [0.1, 0.24], [0.125, 0.34], [0.13, 0.44], [0.122, 0.44], [0.115, 0.34], [0.09, 0.25], [0, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 40), gilt, [0, 0.07, 0]);
  for (const side of [-1, 1]) add(cup, new THREE.TorusGeometry(0.06, 0.011, 10, 24, Math.PI * 1.2), gilt, [side * 0.135, 0.41, 0], { rot: [0, 0, side > 0 ? -Math.PI * 0.6 : Math.PI * 0.4] });

  // ----- Survivor: a long oval poker table, forward in the room and well clear of the fire, with a seat for every player (ten) and
  // the dealer's place at the far side. Built as a real one is: a padded leather armrest round a walnut racetrack, felt with a gilt
  // betting line, a walnut apron, and two heavy pedestals; a hand dealt to each seat, the board and the pot in the middle, the
  // dealer's chip tray.
  const poker = group("survivor");
  const PX = 1.2, PZ = -4.85, PRX = 1.45, PRZ = 0.84, SEATS = 10;
  const oval = (geometry, mat, y, sx, sz, opts) => { const mesh = add(poker, geometry, mat, [PX, y, PZ], opts); mesh.scale.set(sx, 1, sz); return mesh; };
  const saddle = new THREE.MeshPhysicalMaterial({ color: 0x7a4422, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color(0xc08a5a) });
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x17110d, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color(0x6a4a34) });
  oval(cyl(1, 1, 0.12, 96), m.walnut, 0.72, PRX + 0.06, PRZ + 0.06);                                                                   // apron
  oval(cyl(1, 1, 0.06, 96), m.felt, 0.79, PRX - 0.2, PRZ - 0.2);                                                                       // the felt
  oval(new THREE.RingGeometry(0.86, 1.0, 120, 1), m.walnut, 0.822, PRX - 0.08, PRZ - 0.08, { rot: [-Math.PI / 2, 0, 0], cast: false });  // the racetrack
  oval(new THREE.RingGeometry(0.585, 0.6, 120, 1), new THREE.MeshStandardMaterial({ color: 0xc9a45f, metalness: 0.6, roughness: 0.4 }), 0.8215, PRX - 0.2, PRZ - 0.2, { rot: [-Math.PI / 2, 0, 0], cast: false });   // the betting line
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 18, 120), leather);
  rail.rotation.x = Math.PI / 2; rail.scale.set(PRX + 0.02, PRZ + 0.02, 1); rail.position.set(PX, 0.84, PZ); rail.castShadow = true; poker.add(rail);
  for (const dx of [-0.72, 0.72]) {
    add(poker, cyl(0.15, 0.12, 0.66, 24), leather, [PX + dx, 0.39, PZ]);
    add(poker, rbox(0.7, 0.06, 0.5, 0.025), leather, [PX + dx, 0.03, PZ]);
  }
  const chipColors = [0xd4342c, 0x1d3557, 0xf4efe3, 0x2f6a46, 0x111111];
  // Real casino chips: 4.8 cm across and 4 mm thick (a touch over life size so they read from the door), stacked in one colour, each
  // chip with white inserts round its edge that never line up with the next chip's, and a few splashed loose into the pot.
  const CR = 0.024, CT = 0.004, css = (c) => `#${c.toString(16).padStart(6, "0")}`;
  const chipMats = (color, n) => {
    const side = canvas(192, n * 8), g = side.getContext("2d");
    for (let k = 0; k < n; k++) {
      g.fillStyle = css(color); g.fillRect(0, k * 8, 192, 8);
      g.fillStyle = color === 0xf4efe3 ? "#1d3557" : "#f4efe3"; const off = rand() * 32; for (let i = 0; i < 6; i++) g.fillRect((off + i * 32) % 192, k * 8 + 1, 13, 6);
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, k * 8, 192, 1);
    }
    const top = canvas(96, 96), t = top.getContext("2d"); t.fillStyle = css(color); t.fillRect(0, 0, 96, 96);
    t.strokeStyle = color === 0xf4efe3 ? "#1d3557" : "#f4efe3"; t.lineWidth = 9; t.setLineDash([12.5, 12.5]); t.beginPath(); t.arc(48, 48, 43, 0, Math.PI * 2); t.stroke();
    t.setLineDash([]); t.lineWidth = 2; t.beginPath(); t.arc(48, 48, 27, 0, Math.PI * 2); t.stroke();
    const cap = new THREE.MeshStandardMaterial({ map: texture(top), roughness: 0.45 });
    return [new THREE.MeshStandardMaterial({ map: texture(side), roughness: 0.45 }), cap, cap];
  };
  const chips = (color, n, x, z, y = 0.83, rot) => add(poker, cyl(CR, CR, n * CT, 28), chipMats(color, n), [x, y + (n * CT) / 2, z], { rot, cast: true });
  [[0xd4342c, 20, -0.16, 0.2], [0xd4342c, 14, -0.108, 0.2], [0x1d3557, 20, -0.03, 0.24], [0x2f6a46, 16, 0.022, 0.24], [0x111111, 20, 0.12, 0.19], [0xf4efe3, 11, 0.172, 0.19], [0x2f6a46, 8, 0.146, 0.235]]
    .forEach(([color, n, dx, dz]) => chips(color, n, PX + dx, PZ + dz));
  for (let k = 0; k < 9; k++) chips(chipColors[k % 5], 1 + (k % 3 === 0 ? 1 : 0), PX - 0.1 + rand() * 0.3, PZ + 0.04 + rand() * 0.1, 0.83, [0, rand() * 6, 0]);   // the pot
  const cardMat = std(0xfbf9f2, { roughness: 0.5 }), cardBack = std(0x8c1e24, { roughness: 0.5 });
  for (let k = 0; k < 5; k++) add(poker, box(0.085, 0.004, 0.12), cardMat, [PX - 0.22 + k * 0.11, 0.824, PZ - 0.06], { cast: false });   // the board
  add(poker, rbox(0.62, 0.05, 0.16, 0.01), std(0x0c0c0c, { roughness: 0.4 }), [PX, 0.835, PZ - PRZ + 0.3]);                            // the dealer's chip tray
  for (let k = 0; k < 5; k++) for (let r = 0; r < 2; r++) add(poker, cyl(CR, CR, 0.1, 24), chipMats(chipColors[(k + r * 2) % 5], 25), [PX - 0.24 + k * 0.12, 0.862, PZ - PRZ + 0.265 + r * 0.06], { rot: [0, 0, Math.PI / 2], cast: false });   // racks of chips on their edge
  add(poker, cyl(0.04, 0.04, 0.012, 20), std(0xfbf9f2, { roughness: 0.3 }), [PX + 0.48, 0.828, PZ - 0.2], { cast: false });              // dealer button
  const crystalGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transmission: 1, thickness: 0.02, ior: 1.5, clearcoat: 1, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const whiskey = new THREE.MeshPhysicalMaterial({ color: 0x9a5414, roughness: 0.1, transmission: 0.5, thickness: 0.05, emissive: 0x3a1a04, emissiveIntensity: 0.3 });
  const tumbler = new THREE.LatheGeometry([[0, 0], [0.034, 0], [0.038, 0.004], [0.04, 0.08], [0.036, 0.08], [0.032, 0.012], [0, 0.012]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const blazer = std(0x1d2c44, { roughness: 0.9 });
  const cupSteel = new THREE.MeshStandardMaterial({ color: 0xd8dbe0, metalness: 1, roughness: 0.22 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.18 });
  // A card-room chair's padded back: a curved band that wraps round the sitter (a slice of a ring, its edges rounded over), the
  // same for every seat.
  const tubBack = (() => {
    const shape = new THREE.Shape(), r0 = 0.205, r1 = 0.24, a0 = Math.PI * 0.1, a1 = Math.PI * 0.9;
    shape.absarc(0, 0, r1, a0, a1, false); shape.absarc(0, 0, r0, a1, a0, true); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4, curveSegments: 40 });
    g.rotateX(Math.PI / 2); g.translate(0, 0.2, 0); return g;      // stands up, its open side to the front (-z)
  })();
  const tubRoll = new THREE.TorusGeometry(0.222, 0.034, 12, 48, Math.PI * 0.8);
  for (let a = 0; a < SEATS; a++) {
    const t = Math.PI / 2 + ((a + 1) / (SEATS + 1)) * Math.PI * 2, cos = Math.cos(t), sin = Math.sin(t);                              // the dealer sits at the far side (t = -pi/2)
    // a steel cup holder sunk into the padded leather rail at each seat's right hand, and a drink in some of them
    const along = Math.atan2(sin, cos) - 0.2, RAIL_TOP = 0.84 + 0.085, hx = PX + Math.cos(along) * (PRX + 0.02), hz = PZ + Math.sin(along) * (PRZ + 0.02);
    add(poker, new THREE.TorusGeometry(0.046, 0.008, 8, 28), cupSteel, [hx, RAIL_TOP - 0.004, hz], { rot: [Math.PI / 2, 0, 0], cast: false });
    add(poker, cyl(0.043, 0.043, 0.004, 24), std(0x050505, { roughness: 0.7 }), [hx, RAIL_TOP - 0.003, hz], { cast: false });
    if ([0, 3, 5, 8].includes(a)) { add(poker, tumbler, crystalGlass, [hx, RAIL_TOP - 0.04, hz], { cast: false }); add(poker, cyl(0.03, 0.03, 0.035, 16), whiskey, [hx, RAIL_TOP - 0.018, hz], { cast: false }); }
    const c = new THREE.Group(); c.position.set(PX + cos * (PRX + 0.36), 0, PZ + sin * (PRZ + 0.36)); c.rotation.y = Math.PI / 2 - Math.atan2(sin * PRX, cos * PRZ); poker.add(c);
    // A card-room chair as a real poker room has them: a swivel seat on a five-star base with casters, a deep round seat cushion and
    // a padded back that wraps round to the arms, all in the table rail's black leather with a stitched welt.
    for (let k = 0; k < 5; k++) {
      const a5 = (k / 5) * Math.PI * 2 + 0.3, leg = add(c, rbox(0.3, 0.035, 0.05, 0.012), chrome, [Math.cos(a5) * 0.14, 0.06, Math.sin(a5) * 0.14], { rot: [0, -a5, 0] });
      void leg; add(c, new THREE.SphereGeometry(0.026, 12, 8), std(0x111111, { roughness: 0.5 }), [Math.cos(a5) * 0.28, 0.026, Math.sin(a5) * 0.28], { cast: false });
    }
    add(c, cyl(0.03, 0.03, 0.34, 16), chrome, [0, 0.24, 0]);
    add(c, cyl(0.1, 0.07, 0.04, 24), chrome, [0, 0.41, 0]);
    add(c, cyl(0.24, 0.23, 0.09, 40), saddle, [0, 0.475, 0]);
    add(c, new THREE.TorusGeometry(0.236, 0.011, 8, 48), leather, [0, 0.52, 0], { rot: [Math.PI / 2, 0, 0], cast: false });           // a black welt round the seat
    add(c, tubBack, saddle, [0, 0.5, 0.02]);
    add(c, tubRoll, leather, [0, 0.73, 0.02], { rot: [Math.PI / 2, 0, Math.PI * 0.1] });                                                // the padded black roll along the top
    for (const side of [-1, 1]) add(c, cyl(0.014, 0.014, 0.2, 8), chrome, [side * 0.2, 0.42, 0.1], { rot: [0.5, 0, 0], cast: false });   // the back's chrome stays to the seat
    if (a === 6) {                                                                                                                      // someone's blazer over the back of their chair
      add(c, rbox(0.4, 0.34, 0.05, 0.03), blazer, [0, 0.6, 0.29], { rot: [0.06, 0, 0] });
      add(c, rbox(0.42, 0.07, 0.14, 0.035), blazer, [0, 0.77, 0.24], { rot: [0.06, 0, 0] });
      for (const lx of [-0.22, 0.22]) add(c, rbox(0.08, 0.3, 0.06, 0.03), blazer, [lx, 0.6, 0.27], { rot: [0.06, 0, lx > 0 ? -0.05 : 0.05] });
    }
  }

  // ----- plants in baskets and pots, a surfboard against the wall
  const plant = (x, z, s = 1) => {
    add(room, cyl(0.3 * s, 0.24 * s, 0.5 * s, 24), rattan, [x, 0.25 * s, z]);
    add(room, cyl(0.27 * s, 0.27 * s, 0.02, 20), std(0x3a2a1c, { roughness: 1 }), [x, 0.49 * s, z], { cast: false });
    // A kentia palm as one grows: a ring of older fronds arching wide and low, younger ones standing taller inside them, two greens
    // (new growth is lighter), each on its own thin stem rising from the soil.
    const leaves = [];
    spray(room, pottedLeaf, leafDeep, [x, 0.5 * s, z], 8, s * 0.98, [0.4, 0.72], leaves); spray(room, pottedLeaf, leafGreen, [x, 0.5 * s, z], 6, s * 1.08, [0.8, 1.1], leaves);
    spray(room, pottedLeaf, leafFresh, [x, 0.52 * s, z], 3, s * 0.8, [1.2, 1.4], leaves);
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + rand(), lean = 0.12 + rand() * 0.2; const stem = add(room, cyl(0.007 * s, 0.012 * s, 0.5 * s, 6), leafDeep, [x + Math.cos(a) * lean * 0.25 * s, 0.72 * s, z - Math.sin(a) * lean * 0.25 * s]); stem.rotation.set(Math.sin(a) * lean, 0, Math.cos(a) * lean); }
    movers.push({ name: `plant${movers.length}`, kind: "sway", parts: leaves });
  };
  const monstera = (x, z, s = 1) => {
    add(room, cyl(0.28 * s, 0.22 * s, 0.46 * s, 24), std(0xf1ece2, { roughness: 0.5 }), [x, 0.23 * s, z]);
    add(room, cyl(0.25 * s, 0.25 * s, 0.02, 20), std(0x3a2a1c, { roughness: 1 }), [x, 0.45 * s, z], { cast: false });
    const leaves = [];
    for (let f = 0; f < 11; f++) {
      const a = (f / 11) * Math.PI * 2 + rand(), reach = (0.16 + rand() * 0.3) * s, high = (0.7 + rand() * 0.75) * s;
      const tip = new THREE.Vector3(x + Math.cos(a) * reach, high, z - Math.sin(a) * reach), foot = new THREE.Vector3(x, 0.45 * s, z);
      const stem = add(room, cyl(0.008 * s, 0.012 * s, tip.distanceTo(foot), 6), leafDeep, [(tip.x + foot.x) / 2, (tip.y + foot.y) / 2, (tip.z + foot.z) / 2]);
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(foot).normalize());
      const g = new THREE.Group(); g.position.copy(tip); g.rotation.set(rand() * 0.5 - 0.25, a, -0.15 - rand() * 0.45); g.scale.setScalar(s * (0.85 + rand() * 0.4)); room.add(g);
      add(g, broadLeaf, f % 4 === 0 ? leafGreen : leafDeep, [0, 0, 0]); leaves.push(g);
    }
    movers.push({ name: `plant${movers.length}`, kind: "sway", parts: leaves });
  };
  // A bird of paradise, tall and slim: a tall glossy black cylinder pot, a dozen paddle leaves on long upright stems fanning out a
  // little as they climb past two metres, and three of its flowers (a blue-green beak, orange crest, a blue tongue) held up among them.
  const paddle = frond({ L: 0.66, HW: 0.085, pleats: 0, droop: 0.12, keel: 0.45, depth: 0, scallop: 0, shape: 0.6, NU: 60, NV: 16 });
  const birdOfParadise = (x, z) => {
    const POT = 0.62;
    add(room, cyl(0.17, 0.15, POT, 32), new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }), [x, POT / 2, z]);
    add(room, cyl(0.155, 0.155, 0.02, 24), std(0x3a2a1c, { roughness: 1 }), [x, POT - 0.01, z], { cast: false });
    const leaves = [], stemTip = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + rand() * 0.4, lean = 0.05 + rand() * 0.16, tall = 1.15 + rand() * 0.75;
      const foot = new THREE.Vector3(x + Math.cos(a) * 0.04, POT, z - Math.sin(a) * 0.04), tip = new THREE.Vector3(x + Math.cos(a) * (0.05 + lean * tall), POT + tall, z - Math.sin(a) * (0.05 + lean * tall));
      const stem = add(room, cyl(0.007, 0.013, foot.distanceTo(tip), 6), leafDeep, [(foot.x + tip.x) / 2, (foot.y + tip.y) / 2, (foot.z + tip.z) / 2]);
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(foot).normalize());
      // the paddle carries on up from its stem, tipped out a little, its face turned to the light
      const g = new THREE.Group(); g.position.copy(tip); g.rotation.set(0, a + (rand() - 0.5) * 0.6, Math.PI / 2 - 0.45 - lean * 2.2 - rand() * 0.35); g.scale.setScalar(0.85 + rand() * 0.35); room.add(g);
      add(g, paddle, k % 3 ? leafDeep : leafGreen, [0, 0, 0]); leaves.push(g); stemTip.push(tip);
    }
    const orange = std(0xff8a1c, { roughness: 0.5, side: THREE.DoubleSide, emissive: 0x3a1400 }), beak = std(0x2f5a52, { roughness: 0.5 }), tongue = std(0x2b4fd0, { roughness: 0.45 });
    for (const [k, h] of [[1, 1.35], [5, 1.15], [8, 1.5]]) {
      const a = (k / 12) * Math.PI * 2, fx = x + Math.cos(a) * 0.12, fz = z - Math.sin(a) * 0.12, fy = POT + h;
      add(room, cyl(0.006, 0.009, h - 0.05, 6), leafDeep, [x + Math.cos(a) * 0.06, POT + (h - 0.05) / 2, z - Math.sin(a) * 0.06], { rot: [Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08] });
      const head = new THREE.Group(); head.position.set(fx, fy, fz); head.rotation.y = a; room.add(head);
      add(head, new THREE.ConeGeometry(0.022, 0.2, 8), beak, [0.09, 0, 0], { rot: [0, 0, -Math.PI / 2 + 0.2] });                         // the beak, held out level
      for (let p = 0; p < 4; p++) add(head, new THREE.ConeGeometry(0.012, 0.14, 5), orange, [0.03 + p * 0.018, 0.06 + p * 0.004, (p - 1.5) * 0.012], { rot: [(p - 1.5) * 0.25, 0, -0.35 - p * 0.12], cast: false });   // the orange crest
      add(head, new THREE.ConeGeometry(0.009, 0.11, 5), tongue, [0.07, 0.035, 0], { rot: [0, 0, -0.9], cast: false });
    }
    movers.push({ name: `plant${movers.length}`, kind: "sway", parts: leaves });
  };
  plant(2.0, ZB + 0.75, 1.3);
  monstera(2.15, -7.95, 0.9);
  // More green, kept out of the way: a monstera at the near end of the bar, so the long dark front of it has a soft end (clear of the
  // aisle and of the Bowl board), and, along the ledge of the clerestory windows over the bar back, a row of small plants of every
  // sort (nothing stands on the floor to block the way through).
  birdOfParadise(-3.3, -5.0);
  const LEDGE_Y = 3.45, LEDGE_X = -4.09;
  add(room, box(0.22, 0.04, 5.45), white, [LEDGE_X - 0.0, LEDGE_Y - 0.02, -8.55], { cast: false });                                    // the ledge the windows' bottom rail makes
  const terracotta = std(0xb4633a, { roughness: 0.8 }), chalk = std(0xf1ece2, { roughness: 0.5 }), slate = std(0x34302c, { roughness: 0.6 }), soil = std(0x2e2218, { roughness: 1 });
  const succulent = std(0x6f9f80, { roughness: 0.5, side: THREE.DoubleSide }), sage = std(0x93b385, { roughness: 0.55, side: THREE.DoubleSide }), cactusGreen = std(0x4d8a55, { roughness: 0.6 });
  // a small pot on the ledge: its mouth's height is returned, so the plant can be set into it
  const smallPot = (z, r, h, material, dx = 0) => {
    add(room, cyl(r, r * 0.74, h, 20), material, [LEDGE_X + dx, LEDGE_Y + h / 2, z]);
    add(room, cyl(r * 0.92, r * 0.92, 0.01, 16), soil, [LEDGE_X + dx, LEDGE_Y + h - 0.004, z], { cast: false });
    return LEDGE_Y + h;
  };
  // a little leaf on a stem: the broad leaf of a monstera or pothos at a small size, tilted out and over
  const tinyLeaf = (x, y, z, size, turn, material) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rand() * 0.5 - 0.25, turn, -0.2 - rand() * 0.5); g.scale.setScalar(size * (0.85 + rand() * 0.3)); room.add(g);
    add(g, broadLeaf, material, [0, 0, 0], { cast: false });
  };
  const ledgePlants = {
    // a trailing pothos: vines spilling over the front of the ledge and hanging down the wall
    pothos(z, material, long = 1) {
      const top = smallPot(z, 0.075, 0.13, material);
      for (let k = 0; k < 8; k++) {
        const turn = (k / 8) * Math.PI * 2, reach = 0.1 + rand() * 0.1, hang = (0.25 + rand() * 0.45) * long, zz = z + Math.sin(turn) * 0.07;
        // each vine leaves the pot, runs over the ledge's front edge and only then hangs, clear of the ledge (the ledge's lip is at
        // LEDGE_X + 0.11): nothing passes through it
        const LIP = LEDGE_X + 0.14, from = new THREE.Vector3(LEDGE_X + 0.05, top - 0.01, zz), over = new THREE.Vector3(LIP, LEDGE_Y + 0.012, zz);
        const run = add(room, cyl(0.004, 0.004, from.distanceTo(over), 5), leafDeep, [(from.x + over.x) / 2, (from.y + over.y) / 2, zz], { cast: false });
        run.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), over.clone().sub(from).normalize());
        add(room, cyl(0.004, 0.004, hang, 5), leafDeep, [LIP, LEDGE_Y + 0.012 - hang / 2, zz], { cast: false });
        const leaves = Math.round(5 + hang * 8);
        for (let i = 1; i <= leaves; i++) {
          const t = i / leaves, drop = LEDGE_Y - t * hang * 0.95;
          tinyLeaf(LIP + 0.012 + (i % 2 ? 0.01 : 0), drop, zz + (rand() - 0.5) * 0.05, 0.1, Math.PI / 2 + (rand() - 0.5) * 1.2, i % 2 ? leafFresh : leafGreen);
        }
        void reach;
      }
      spray(room, pottedLeaf, leafGreen, [LEDGE_X, top, z], 5, 0.11, [0.9, 1.2]);
    },
    // a small kentia or fern: a fan of fronds
    fern(z, material, size = 0.2) { spray(room, pottedLeaf, leafGreen, [LEDGE_X, smallPot(z, 0.085, 0.14, material), z], 7, size, [0.5, 1.0]); spray(room, pottedLeaf, leafFresh, [LEDGE_X, LEDGE_Y + 0.14, z], 3, size * 0.8, [1.1, 1.3]); },
    // an aloe: stiff pointed leaves rising and leaning out in a rosette
    aloe(z, material) {
      const top = smallPot(z, 0.08, 0.12, material);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + rand() * 0.4, lean = 0.25 + (k % 3) * 0.28, len = 0.2 + (k % 3 === 0 ? 0.08 : 0);
        const blade = add(room, new THREE.ConeGeometry(0.02, len, 5), k % 2 ? succulent : sage, [LEDGE_X + Math.cos(a) * lean * len * 0.5, top + len * 0.5 * Math.cos(lean * 0.9), z + Math.sin(a) * lean * len * 0.5], { cast: false });
        blade.rotation.set(Math.sin(a) * lean * 0.9, 0, -Math.cos(a) * lean * 0.9);
      }
    },
    // a snake plant: tall flat blades, a little askew
    snake(z, material) {
      const top = smallPot(z, 0.075, 0.13, material);
      for (let k = 0; k < 7; k++) {
        const h = 0.28 + (k % 3) * 0.1, a = rand() * Math.PI * 2, lean = 0.06 + rand() * 0.1;
        const blade = add(room, box(0.034, h, 0.009), k % 2 ? leafDeep : leafGreen, [LEDGE_X + Math.cos(a) * 0.03, top + h / 2, z + Math.sin(a) * 0.03], { cast: false });
        blade.rotation.set(Math.sin(a) * lean, a, Math.cos(a) * lean);
      }
    },
    // a cactus with an arm and a pink flower
    cactus(z, material) {
      const top = smallPot(z, 0.065, 0.1, material);
      add(room, cyl(0.036, 0.04, 0.2, 14), cactusGreen, [LEDGE_X, top + 0.1, z]);
      add(room, new THREE.SphereGeometry(0.036, 14, 10), cactusGreen, [LEDGE_X, top + 0.2, z]);
      add(room, cyl(0.022, 0.022, 0.07, 10), cactusGreen, [LEDGE_X, top + 0.1, z + 0.055], { rot: [Math.PI / 2, 0, 0] });
      add(room, cyl(0.022, 0.022, 0.09, 10), cactusGreen, [LEDGE_X, top + 0.15, z + 0.09]);
      add(room, new THREE.SphereGeometry(0.02, 10, 8), std(0xe05a8c, { roughness: 0.6 }), [LEDGE_X, top + 0.21, z], { cast: false });
    },
    // a baby monstera: three or four split leaves on slim stems
    monstera(z, material, size = 1) {
      const top = smallPot(z, 0.085, 0.2, material);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + rand(), reach = (0.08 + rand() * 0.08) * size, high = (0.22 + rand() * 0.2) * size;
        add(room, cyl(0.004, 0.006, high, 5), leafDeep, [LEDGE_X + Math.cos(a) * reach * 0.5, top + high / 2, z - Math.sin(a) * reach * 0.5], { cast: false });
        tinyLeaf(LEDGE_X + Math.cos(a) * reach, top + high, z - Math.sin(a) * reach, 0.34 * size, a, k % 2 ? leafGreen : leafDeep);
      }
    },
    // a string of pearls: strands of little green beads spilling over the ledge
    pearls(z, material) {
      const top = smallPot(z, 0.07, 0.1, material);
      const bead = new THREE.SphereGeometry(0.011, 8, 6);
      for (let k = 0; k < 9; k++) {
        const zz = z + (rand() - 0.5) * 0.12, LIP = LEDGE_X + 0.14, hang = 0.1 + rand() * 0.2;   // short strands: they stop above the neon sign
        for (let b = 0; b < 4; b++) add(room, bead, succulent, [LEDGE_X + 0.03 + b * 0.028, top - 0.005 - b * 0.012, zz], { cast: false });
        for (let b = 0; b * 0.024 < hang; b++) add(room, bead, b % 4 ? succulent : sage, [LIP + 0.01 + Math.sin(b * 0.7 + k) * 0.008, LEDGE_Y - b * 0.024, zz + Math.sin(b * 0.4 + k) * 0.01], { cast: false });
      }
    },
    // a bird's-nest fern: broad, wavy, upright leaves from a tight crown
    nest(z, material) {
      const top = smallPot(z, 0.09, 0.16, material);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + rand() * 0.3;
        tinyLeaf(LEDGE_X + Math.cos(a) * 0.03, top + 0.02, z - Math.sin(a) * 0.03, 0.42 + rand() * 0.12, a, k % 3 ? leafFresh : leafGreen);
      }
    },
    // a few things that live on a ledge: two stacked books and a small brass lantern
    keepsakes(z) {
      add(room, box(0.15, 0.03, 0.2), std(0x6e2a22, { roughness: 0.7 }), [LEDGE_X, LEDGE_Y + 0.015, z]);
      add(room, box(0.14, 0.025, 0.18), std(0x23423a, { roughness: 0.7 }), [LEDGE_X, LEDGE_Y + 0.043, z + 0.01], { rot: [0, 0.15, 0] });
      add(room, rbox(0.07, 0.1, 0.07, 0.01), brass, [LEDGE_X, LEDGE_Y + 0.105, z]);
      add(room, cyl(0.022, 0.022, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc070, emissiveIntensity: night ? 1.2 : 0.2 }), [LEDGE_X, LEDGE_Y + 0.105, z], { cast: false });
    },
    // a pot of herbs: a soft mound of small leaves
    herbs(z, material) {
      const top = smallPot(z, 0.09, 0.11, material);
      for (let k = 0; k < 16; k++) add(room, new THREE.SphereGeometry(0.03 + rand() * 0.015, 8, 6), k % 3 ? leafFresh : sage, [LEDGE_X + (rand() - 0.5) * 0.11, top + 0.03 + rand() * 0.07, z + (rand() - 0.5) * 0.11], { cast: false });
    },
  };
  // set in loose groups, not a row of soldiers: pots of every sort and height, trailing vines and beads, a tall leafy one now and then
  const glazed = std(0x2f6f6a, { roughness: 0.25, metalness: 0.05 }), basket = std(0xb08a55, { roughness: 0.95 });
  ledgePlants.fern(-5.95, glazed, 0.28); ledgePlants.pothos(-6.4, basket, 1.3);
  ledgePlants.aloe(-6.95, terracotta); ledgePlants.herbs(-7.2, slate);
  ledgePlants.monstera(-7.75, chalk, 1.3); ledgePlants.keepsakes(-8.15);
  ledgePlants.pearls(-8.5, terracotta); ledgePlants.snake(-8.85, slate);
  ledgePlants.nest(-9.4, glazed); ledgePlants.cactus(-9.85, chalk);
  ledgePlants.pothos(-10.3, terracotta, 0.45);   // kept short: it hangs over the neon sign ledgePlants.fern(-10.85, basket, 0.24);
  add(room, rbox(0.08, 2.4, 0.55, 0.04), std(0x3f8fb0, { roughness: 0.35 }), [X1 - 0.2, 1.2, ZB + 1.9], { rot: [0, 0, 0.13] });
  for (const [x, z] of [[-4.6, ZB - 1.2], [-1.6, ZB - 1.4], [1.6, ZB - 1.4], [4.6, ZB - 1.2]]) {
    add(out, cyl(0.03, 0.04, 1.8, 8), std(0x6b4a2a), [x, 0.9, z]);
    add(out, cyl(0.07, 0.05, 0.18, 10), std(0x2a2a2a), [x, 1.85, z]);
    add(out, new THREE.ConeGeometry(0.06, 0.22, 10), glow(0xff8a2a, night ? 3 : 1.2), [x, 2.04, z], { cast: false });
    if (night) { const l = new THREE.PointLight(0xff9a40, 2.5, 4, 1.6); l.position.set(x, 2.1, z); out.add(l); }
  }
  {
    // The chalkboard: a slate in a walnut frame on a wheeled walnut stand, standing in the room all season at the front right, before the poker table,
    // turned toward the room. Its slate is live (like the two screens): the picture leaves it clean but for old chalk dust, and
    // the page draws the Season Snapshot on it in chalk, so its four corners are recorded. A tray along its foot holds chalk and a felt
    // eraser. (It took the place of the Bowl Pool's bulletin board, which was only wheeled in for bowl season.)
    const chalkboard = group("chalkboard");
    const [CX, CZ, CR, CS] = (q.get("chalk") ?? "-0.55,-2.7,0.6,0.8").split(",").map(Number);
    const stand = new THREE.Group(); stand.position.set(CX, 0, CZ); stand.rotation.y = CR; stand.scale.setScalar(CS);
    chalkboard.add(stand);
    const SW = 1.45, SH = 0.92, SY = 1.0;                                                                                            // the slate, and the height of its middle
    const slate = (() => {
      const c = canvas(768, 512), g = c.getContext("2d");
      g.fillStyle = "#1f2a26"; g.fillRect(0, 0, 768, 512);
      for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? "10,16,14" : "70,86,80"},${0.05 + rand() * 0.1})`; g.fillRect(rand() * 768, rand() * 512, 1 + rand() * 2, 1 + rand() * 2); }
      // old chalk wiped with a felt: broad faint arcs, heavier toward the edges where the eraser never quite reaches
      for (let i = 0; i < 26; i++) { const x = rand() * 768, y = rand() * 512, r = 60 + rand() * 160; g.strokeStyle = `rgba(220,226,218,${0.025 + rand() * 0.035})`; g.lineWidth = 18 + rand() * 40; g.beginPath(); g.arc(x, y, r, rand() * 6, rand() * 6 + 1.6); g.stroke(); }
      const edge = g.createRadialGradient(384, 256, 150, 384, 256, 470); edge.addColorStop(0, "rgba(220,226,218,0)"); edge.addColorStop(1, "rgba(220,226,218,0.07)"); g.fillStyle = edge; g.fillRect(0, 0, 768, 512);
      return texture(c);
    })();
    add(stand, box(SW, SH, 0.03), new THREE.MeshStandardMaterial({ map: slate, roughness: 0.95 }), [0, SY, 0]);
    for (const y of [SY - SH / 2 - 0.035, SY + SH / 2 + 0.035]) add(stand, rbox(SW + 0.14, 0.07, 0.07, 0.015), m.walnut, [0, y, 0]);
    for (const x of [-(SW / 2 + 0.035), SW / 2 + 0.035]) add(stand, rbox(0.07, SH + 0.14, 0.07, 0.015), m.walnut, [x, SY, 0]);
    // the stand: two posts on wheeled feet, a stretcher low between them
    const top = SY + SH / 2 + 0.07;
    for (const x of [-(SW / 2 + 0.12), SW / 2 + 0.12]) {
      add(stand, rbox(0.07, top, 0.08, 0.015), m.walnut, [x, top / 2, -0.02]);
      add(stand, rbox(0.08, 0.06, 0.62, 0.015), m.walnut, [x, 0.08, -0.02]);
      for (const dz of [-0.28, 0.24]) add(stand, cyl(0.045, 0.045, 0.035, 16), std(0x1a1a1a, { roughness: 0.6 }), [x, 0.045, dz], { rot: [0, 0, Math.PI / 2] });
      add(stand, cyl(0.03, 0.03, 0.02, 16), brass, [x, top + 0.01, -0.02]);                                                     // brass caps
    }
    add(stand, rbox(SW + 0.24, 0.05, 0.05, 0.01), m.walnut, [0, 0.24, -0.02]);
    for (const x of [-(SW / 2 + 0.085), SW / 2 + 0.085]) add(stand, cyl(0.022, 0.022, 0.06, 12), brass, [x, SY, -0.02], { rot: [0, 0, Math.PI / 2] });   // the pivots
    // the chalk tray, a few sticks and a felt eraser on it
    const trayY = SY - SH / 2 - 0.07;
    add(stand, rbox(SW + 0.04, 0.025, 0.1, 0.008), m.walnut, [0, trayY - 0.01, 0.05]);
    add(stand, box(SW + 0.04, 0.03, 0.012), m.walnut, [0, trayY + 0.005, 0.1]);
    const chalkStick = std(0xf3f1ea, { roughness: 1 });
    for (const [x, len, turn] of [[-0.42, 0.075, 0.2], [-0.33, 0.05, -0.4], [0.18, 0.065, 0.1]]) add(stand, cyl(0.011, 0.011, len, 10), chalkStick, [x, trayY + 0.014, 0.055], { rot: [0, turn, Math.PI / 2], cast: false });
    add(stand, rbox(0.16, 0.035, 0.06, 0.01), std(0x6b4a2a, { roughness: 0.8 }), [0.48, trayY + 0.02, 0.055]);
    add(stand, box(0.16, 0.012, 0.06), std(0x3a3a3a, { roughness: 1 }), [0.48, trayY + 0.0, 0.055], { cast: false });
    // the slate is live: its corners (top left, top right, bottom right, bottom left), just off its face
    stand.updateMatrixWorld(true);
    screens.chalkboard = [[-SW / 2, SH / 2], [SW / 2, SH / 2], [SW / 2, -SH / 2], [-SW / 2, -SH / 2]].map(([x, y]) => stand.localToWorld(new THREE.Vector3(x, SY + y, 0.016)));
  }

  // ----- light: a bright mid-afternoon, the sun high enough that its patches on the floor are short and its shadows soft-edged and
  // light (plenty of fill from the sky and the pale walls), or a warm evening with the pool and the lanterns lit. The room's own
  // glow is added below from a picture of itself.
  scene.add(new THREE.HemisphereLight(night ? 0x8090b8 : 0xfffaf0, night ? 0x2a1e16 : 0xe0c49a, night ? 0.16 : Number(q.get("hemi") ?? 1.6)));
  const sun = new THREE.DirectionalLight(night ? 0x9ab6ff : 0xfff0d8, night ? 0.25 : Number(q.get("sunk") ?? 3.5));
  sun.position.set(night ? 6 : 15, night ? 14 : 14, night ? ZB - 14 : -4.5); sun.target.position.set(-1, 0, -5.5);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = night ? 1 : 5;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 1, far: 70 });
  scene.add(sun, sun.target);
  for (const [x, y, z] of [[0, 4.6, -3.2], [-2.6, 3.4, -12.2]]) { const l = new THREE.PointLight(night ? 0xffc98a : 0xffe6c4, night ? 3.0 : 1.3, 10, 1.4); l.position.set(x, night ? Math.min(y, 3.3) : y, z); scene.add(l); }
  if (night) {
    const poolGlow = new THREE.PointLight(0x3ad0ff, 14, 7.5, 1.4); poolGlow.position.set(0.6, 0.6, ZB - 6.2); scene.add(poolGlow);
    for (let i = 0; i < 12; i++) add(out, new THREE.SphereGeometry(0.05, 8, 6), glow(0xffd28a, 3), [-5 + i * 0.9, 3.1 - Math.sin((i / 11) * Math.PI) * 0.5, ZB - 3.2], { cast: false });
  }
  scene.fog = new THREE.Fog(night ? 0x0b1424 : 0xe8f1f2, 6, night ? 220 : 330);           // a little air between you and the far wall, more over the sea

  // ----- camera: standing just inside the front door at eye level, looking down the room to the boards, the glass wall and the sea
  const camera = new THREE.PerspectiveCamera(Number(q.get("fov") ?? 63), W / H, 0.1, 200);
  // Turn the whole room round (see MIRROR above): every thing and every light goes into one group drawn as its mirror image, and the
  // camera stands at the mirrored spot. Positions given here are in the room as it was first drawn.
  const world = new THREE.Group(); world.scale.x = MIRROR;
  for (const child of [...scene.children]) world.add(child);
  scene.add(world);
  const mirrored = ([x, y, z]) => [x * MIRROR, y, z];
  camera.position.set(...mirrored((q.get("cam") ?? "0.45,1.72,0.4").split(",").map(Number)));
  camera.lookAt(...mirrored((q.get("look") ?? "-0.08,1.8,-9").split(",").map(Number)));
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
  if (MIRROR < 0) for (const [name, [tl, tr, br, bl]] of Object.entries(screens)) screens[name] = [tr, tl, bl, br].map((v) => new THREE.Vector3(-v.x, v.y, v.z));
  const at = (v) => { const p = v.clone().project(camera); return [Math.round(((p.x + 1) / 2) * 10000) / 10000, Math.round(((1 - p.y) / 2) * 10000) / 10000]; };
  window.__spots = { width: W, height: H, spots: outSpots, screens: Object.fromEntries(Object.entries(screens).map(([k, corners]) => [k, corners.map(at)])) };
  // The room lights itself: a picture of the whole room taken from its middle (the sky bright, as the eye would find it) becomes the
  // soft light and the reflections on everything in it, so the brass, the floor and the trophies show the room they stand in.
  if (q.get("ibl") !== "0") {
    const around = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const eye = new THREE.CubeCamera(0.1, 200, around); eye.position.set(0.4 * MIRROR, 2.4, -7.6); scene.add(eye);
    trophies.visible = false; skyPlane.material.color.setScalar(night ? 1.2 : 4);
    eye.update(renderer, scene);
    trophies.visible = true; skyPlane.material.color.setScalar(night ? 1 : Number(q.get("skyk") ?? 0.55));
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
  const edge = pg.createRadialGradient(PW / 2, PH * 0.46, PH * 0.3, PW / 2, PH * 0.5, PH * 0.78); edge.addColorStop(0, "rgba(24, 12, 2, 0)"); edge.addColorStop(1, `rgba(24, 12, 2, ${night ? 0.42 : 0.16})`);
  pg.fillStyle = edge; pg.fillRect(0, 0, PW, PH);
  window.__webp = picture.toDataURL("image/webp", 0.82);
  window.__png = picture.toDataURL("image/png");
  // ----- motion: frames=N also takes a short loop of N pictures in which the fans turn one blade's worth (so the loop joins up) and
  // the indoor plants' leaves sway and come back. Only the patch of the picture around each moving thing is kept, as one strip of N
  // frames; the page plays the strips over the still picture. Frame 0 is the still picture itself.
  const N = Number(q.get("frames") ?? 0);
  if (N > 1) {
    // The loop is drawn at the picture's own size (half the still's sharpness): a quarter of the work and the bytes, and plenty for
    // things that are moving.
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    const loop = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
    loop.addPass(new RenderPass(scene, camera));
    if (q.get("ao") !== "0") {
      const contact = new GTAOPass(scene, camera, W, H);
      contact.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.3, thickness: 1.0, scale: 1.25, samples: 16 });
      contact.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      const hide = contact.overrideVisibility.bind(contact);
      contact.overrideVisibility = () => { hide(); for (const o of veil) o.visible = false; };
      loop.addPass(contact);
    }
    loop.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), night ? 0.32 : 0.16, 0.6, night ? 0.9 : 1.1));
    loop.addPass(new OutputPass());
    const small = canvas(W, H), sg = small.getContext("2d");
    const base = movers.map((mover) => mover.parts.map((part) => part.rotation.clone()));
    const sway = movers.map((mover) => mover.parts.map(() => ({ phase: rand() * Math.PI * 2, turns: 1 + Math.floor(rand() * 2), reach: 0.012 + rand() * 0.02 })));
    const patches = movers.map((mover) => {
      const box = new THREE.Box3(); for (const part of mover.parts) box.expandByObject(part);
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) { const [px, py] = at(new THREE.Vector3(x, y, z)); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      const px0 = Math.max(0, Math.floor(x0 * W) - 3), py0 = Math.max(0, Math.floor(y0 * H) - 3), px1 = Math.min(W, Math.ceil(x1 * W) + 3), py1 = Math.min(H, Math.ceil(y1 * H) + 3);
      const strip = canvas((px1 - px0) * N, py1 - py0);
      return { name: mover.name, px0, py0, w: px1 - px0, h: py1 - py0, strip, g: strip.getContext("2d") };
    }).filter((patch) => patch.w > 4 && patch.h > 4);
    for (let f = 0; f < N; f++) {
      movers.forEach((mover, m) => mover.parts.forEach((part, k) => {
        part.rotation.copy(base[m][k]);
        if (mover.kind === "spin") part.rotation.y += (f / N) * ((Math.PI * 2) / 5);
        else { const { phase, turns, reach } = sway[m][k]; const wave = Math.sin((f / N) * Math.PI * 2 * turns + phase) - Math.sin(phase); part.rotation.z += wave * reach; part.rotation.x += wave * reach * 0.5; }
      }));
      loop.render();
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.drawImage(renderer.domElement, 0, 0, W, H);
      sg.setTransform(1 / scale, 0, 0, 1 / scale, 0, 0); sg.fillStyle = edge; sg.fillRect(0, 0, PW, PH);
      for (const patch of patches) patch.g.drawImage(small, patch.px0, patch.py0, patch.w, patch.h, f * patch.w, 0, patch.w, patch.h);
    }
    window.__motion = { frames: N, patches: patches.map((patch) => ({ name: patch.name, x: patch.px0 / W, y: patch.py0 / H, w: patch.w / W, h: patch.h / H, strip: patch.strip.toDataURL("image/webp", 0.7) })) };
  }
  window.__done = true;
}

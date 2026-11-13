// The clubhouse: a grand beach bungalow and the ultimate man cave, seen from just inside the front, looking down the room. Nothing
// in it is turned to the camera by a trick: what has to be read hangs on the wall that faces you, and the side walls carry the
// things that look right in perspective.
//  - Ceiling: natural beach-hut thatch laid in courses, no beams, two big palm-leaf fans down the middle.
//  - Back wall, left: where picks are made, face on: the Big Board, one wide board of spreads under it, the counter. No sign.
//  - Back wall, right: glass to the thatch, the sliding doors standing open onto the pool patio, palms, tiki torches and the sea.
//  - Left wall: the bar running down the room (fluted walnut, marble, brass), leather stools, a mirrored back bar of bottles and
//    glassware under the neon, the plaques along its front, the laptop on top (the record book is on the lounge table).
//  - Right wall: a grand floor-to-thatch stone chimney (the fire lit at night), the constitution framed on its near face, a painted
//    Trophy Room sign on a brass post by it, and the lounge in front, set clear of the aisle.
//  - Middle, forward: a long oval Survivor poker table with a chair for every player. The floor in front of it is the way in.
//    From Dec 7 the Bowl Pool's board stands at the front left.
// Units are metres: x left to right, z from the front wall (0) to the back (-RD).
import { THREE, RoundedBoxGeometry, materials } from "/lib.js";
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

export async function buildRoom(q) {
  const night = q.get("night") === "1";
  const bowl = q.get("bowl") === "1";
  const W = Number(q.get("w") ?? 390), H = Number(q.get("h") ?? 630), scale = Number(q.get("scale") ?? 2);

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
    add(room, tile(box(0.2, WH, RD), 1.04, 2.08, [side * (RW / 2 + 0.1), WH / 2, -RD / 2]), wallMat, [side * (RW / 2 + 0.1), WH / 2, -RD / 2]);
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
  lit(book, 3.1, 0.92, SX + 0.1, 1.98, spreadsFace(), night ? 1.0 : 0.7);
  add(book, rbox(2.9, 1.05, 0.7, 0.03), m.walnut, [SX - 0.15, 0.525, ZB + 0.75]);
  add(book, box(3.0, 0.05, 0.8), brass, [SX - 0.15, 1.075, ZB + 0.75]);
  for (const dx of [-1.2, -0.15, 0.9]) add(book, box(0.2, 0.03, 0.12), white, [SX + dx, 1.115, ZB + 0.8], { cast: false });       // ticket pads
  for (const dx of [-0.7, 0.4]) {                                                                                                    // banker's lamps
    add(book, cyl(0.06, 0.075, 0.02, 16), brass, [SX + dx, 1.11, ZB + 0.72]); add(book, cyl(0.008, 0.008, 0.22, 8), brass, [SX + dx, 1.22, ZB + 0.72]);
    add(book, cyl(0.05, 0.05, 0.24, 14, 1), new THREE.MeshStandardMaterial({ color: 0x1f6a46, emissive: 0x2f9a5c, emissiveIntensity: night ? 1.2 : 0.5, roughness: 0.3 }), [SX + dx, 1.35, ZB + 0.72], { rot: [0, 0, Math.PI / 2], cast: false });
  }
  const board = group("board");
  lit(board, 3.1, 1.57, SX + 0.1, 3.45, bigBoardFace(), night ? 1.0 : 0.62, 0x12281e);
  add(board, box(3.3, 0.04, 0.05), brass, [SX + 0.1, 4.33, SWALL + 0.1]);

  // ----- the left wall: the bar, running down the room. Counter and stools, the back bar and a neon sign on the wall, lanterns
  // over it, the plaques along its front; the champions' banners hang over it one behind another, each facing the door.
  // The bar: a fluted walnut front on a brass kick plate, a thick marble top with a brass foot rail below, green leather stools on
  // brass. Behind it a back bar of walnut and antique mirror: three glass shelves of real bottles lit from beneath, glassware in rows
  // on the back counter, and the neon over the mirror.
  const bar = group("bar");
  const BXc = X0 + 0.95, BZ = -8.5, BL = 5.6, FRONT = BXc + 0.375;
  add(bar, rbox(0.75, 1.02, BL, 0.02), m.walnut, [BXc, 0.53, BZ]);
  for (let k = 0; k < Math.floor(BL / 0.075); k++) add(bar, cyl(0.026, 0.026, 0.78, 10, 1), m.walnut, [FRONT, 0.55, BZ - BL / 2 + 0.06 + k * 0.075], { cast: false });   // flutes
  add(bar, box(0.03, 0.12, BL), brass, [FRONT + 0.02, 0.06, BZ]);                                                                      // kick plate
  add(bar, rbox(0.06, 0.07, BL + 0.04, 0.015), m.walnut, [FRONT + 0.02, 1.0, BZ]);                                                    // moulding under the top
  add(bar, rbox(0.98, 0.09, BL + 0.14, 0.035), m.marble, [BXc + 0.02, 1.1, BZ]);                                                     // the marble top
  add(bar, cyl(0.028, 0.028, BL, 16), brass, [FRONT + 0.16, 0.22, BZ], { rot: [Math.PI / 2, 0, 0] });                                  // foot rail
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
  add(bar, rbox(0.46, 0.92, BL, 0.02), m.walnut, [WALL + 0.23, 0.46, BZ]);                                                           // back counter
  add(bar, rbox(0.5, 0.04, BL + 0.04, 0.01), m.marble, [WALL + 0.25, 0.94, BZ]);
  add(bar, box(0.03, 1.36, BL - 0.3), new THREE.MeshStandardMaterial({ color: 0xb8a888, metalness: 1, roughness: 0.12, envMapIntensity: 1.1 }), [WALL + 0.02, 1.66, BZ], { cast: false });   // antique mirror
  for (const z of [BZ - BL / 2 + 0.08, BZ + BL / 2 - 0.08, BZ - BL / 6, BZ + BL / 6]) add(bar, box(0.06, 1.42, 0.1), m.walnut, [WALL + 0.04, 1.66, z]);   // pilasters
  add(bar, box(0.08, 0.86, BL + 0.1), m.walnut, [WALL + 0.04, 2.8, BZ]);                                                              // the panel above, where the neon hangs
  add(bar, rbox(0.14, 0.1, BL + 0.2, 0.02), m.walnut, [WALL + 0.07, 3.27, BZ]);                                                       // cornice
  add(bar, box(0.03, 0.03, BL), brass, [WALL + 0.1, 2.38, BZ]);
  const bottleGlass = (color, clear) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, metalness: 0, transmission: clear ? 0.85 : 0.45, thickness: 0.06, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const shapes = {
    whiskey: [[0, 0], [0.038, 0], [0.04, 0.01], [0.04, 0.17], [0.034, 0.2], [0.014, 0.225], [0.013, 0.27], [0, 0.27]],
    wine: [[0, 0], [0.034, 0], [0.036, 0.01], [0.036, 0.17], [0.03, 0.21], [0.013, 0.245], [0.012, 0.31], [0, 0.31]],
    gin: [[0, 0], [0.044, 0], [0.046, 0.01], [0.046, 0.15], [0.03, 0.18], [0.013, 0.19], [0.013, 0.23], [0, 0.23]],
    liqueur: [[0, 0], [0.04, 0], [0.042, 0.02], [0.034, 0.1], [0.04, 0.17], [0.02, 0.2], [0.011, 0.22], [0.011, 0.25], [0, 0.25]],
  };
  const lathe = Object.fromEntries(Object.entries(shapes).map(([k, pts]) => [k, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20)]));
  const bottleKinds = [["whiskey", 0x8a4a14, false], ["wine", 0x2f5a3c, false], ["gin", 0xdfeee6, true], ["whiskey", 0xa8641c, false], ["liqueur", 0x6a1a14, false], ["gin", 0x9fc8d8, true], ["wine", 0x3a1d0c, false], ["whiskey", 0xc0802a, false], ["liqueur", 0x1d3557, false]];
  const labelInks = [0xf3ead3, 0x111111, 0xe6cf98, 0xf7f4ec, 0x1f4a36];
  const SHELVES = [1.16, 1.58, 2.0];
  SHELVES.forEach((y, sIndex) => {
    add(bar, box(0.24, 0.016, BL - 0.4), glass, [WALL + 0.14, y, BZ], { cast: false });
    add(bar, box(0.01, 0.012, BL - 0.4), glow(0xffd9a0, night ? 2.2 : 1.1), [WALL + 0.24, y - 0.014, BZ], { cast: false });              // a lamp strip under the shelf's front edge
    let z = BZ - BL / 2 + 0.3;
    for (let i = 0; z < BZ + BL / 2 - 0.3; i++) {
      const [kind, color, clear] = bottleKinds[(i * 4 + sIndex * 3) % bottleKinds.length], h = shapes[kind].at(-1)[1];
      if (Math.abs(z - (BZ - BL / 6)) < 0.08 || Math.abs(z - (BZ + BL / 6)) < 0.08) { z += 0.12; continue; }                        // leave the pilasters clear
      const bottle = add(bar, lathe[kind], bottleGlass(color, clear), [WALL + 0.13 + (i % 2) * 0.03, y + 0.008, z], { cast: false });
      bottle.scale.setScalar(sIndex === 2 ? 0.9 : 1);
      add(bar, cyl(0.014, 0.014, 0.03, 10), [brass, std(0x111111, { roughness: 0.4 }), std(0x8c1e24, { roughness: 0.4 })][i % 3], [WALL + 0.13 + (i % 2) * 0.03, y + 0.008 + h * bottle.scale.y + 0.012, z], { cast: false });
      add(bar, new THREE.PlaneGeometry(0.05, 0.05 + (i % 2) * 0.02), std(labelInks[(i + sIndex) % labelInks.length], { roughness: 0.7 }), [WALL + 0.13 + (i % 2) * 0.03 + (kind === "gin" ? 0.047 : 0.041), y + 0.09, z], { cast: false, rot: [0, Math.PI / 2, 0] });
      z += 0.085 + (i % 3) * 0.012;
    }
    if (night) { const l = new THREE.PointLight(0xffc98a, 0.9, 2.2, 1.6); l.position.set(WALL + 0.4, y + 0.2, BZ); bar.add(l); }
  });
  // glassware on the back counter: rocks glasses and coupes in neat rows, upturned on a bar mat
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transmission: 1, thickness: 0.02, ior: 1.5, clearcoat: 1, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const rocks = new THREE.LatheGeometry([[0, 0], [0.036, 0], [0.04, 0.004], [0.042, 0.085], [0.038, 0.085], [0.034, 0.012], [0, 0.012]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const coupe = new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.032, 0.006], [0.005, 0.012], [0.004, 0.09], [0.03, 0.1], [0.055, 0.13], [0.052, 0.132], [0.028, 0.104], [0, 0.098]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
  add(bar, box(0.3, 0.008, 1.4), std(0x111111, { roughness: 0.9 }), [WALL + 0.3, 0.965, BZ + 1.6], { cast: false });
  for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) add(bar, k % 3 === 2 ? coupe : rocks, crystal, [WALL + 0.22 + r * 0.12, 0.97, BZ + 1.0 + k * 0.14 + r * 0.07], { cast: false });
  add(bar, new THREE.PlaneGeometry(2.2, 0.43), new THREE.MeshBasicMaterial({ map: neon("Lead Pipe Locks"), transparent: true, toneMapped: false }), [WALL + 0.085, 2.8, -9.6], { cast: false, rot: [0, Math.PI / 2, 0] }).renderOrder = 2;
  // on the bar top: the tap tower, a cocktail shaker, a pair of glasses
  add(bar, box(0.08, 0.08, 0.5), brass, [BXc - 0.1, 1.55, BZ - 1.0]);
  for (let i = 0; i < 4; i++) { add(bar, cyl(0.03, 0.03, 0.4, 10), brass, [BXc - 0.1, 1.36, BZ - 1.18 + i * 0.12]); add(bar, rbox(0.04, 0.16, 0.04, 0.01), std([0x1f4a36, 0x8c1e24, 0xc9a45f, 0x1d3557][i]), [BXc - 0.1, 1.68, BZ - 1.18 + i * 0.12]); }
  add(bar, new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.045, 0.14], [0.03, 0.17], [0.03, 0.2], [0.012, 0.22], [0, 0.23]].map(([r, y]) => new THREE.Vector2(r, y)), 20), new THREE.MeshStandardMaterial({ color: 0xd8dbe0, metalness: 1, roughness: 0.18 }), [BXc + 0.1, 1.145, BZ - 2.1]);
  for (const dz of [0, 0.12]) add(bar, coupe, crystal, [BXc + 0.18, 1.145, BZ - 1.8 + dz], { cast: false });
  for (const z of [BZ + 2.55, BZ - 2.5]) {                                                                                             // brass lamps with pleated shades
    add(bar, cyl(0.07, 0.09, 0.03, 20), brass, [BXc - 0.12, 1.16, z]);
    add(bar, cyl(0.012, 0.012, 0.36, 8), brass, [BXc - 0.12, 1.34, z]);
    add(bar, cyl(0.07, 0.14, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3ead3, emissive: 0xffd9a0, emissiveIntensity: night ? 0.9 : 0.3, roughness: 0.9, side: THREE.DoubleSide }), [BXc - 0.12, 1.58, z], { cast: false });
    if (night) { const l = new THREE.PointLight(0xffc27a, 1.6, 3, 1.6); l.position.set(BXc + 0.1, 1.6, z); bar.add(l); }
  }
  const chat = group("chat");
  add(chat, rbox(0.27, 0.02, 0.38, 0.008), std(0xa8adb2, { metalness: 0.7, roughness: 0.3 }), [BXc + 0.05, 1.18, BZ - 0.1]);
  const lid = new THREE.Group(); lid.position.set(BXc - 0.08, 1.19, BZ - 0.1); lid.rotation.set(0, Math.PI / 2, 0); chat.add(lid);
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
  const FZ = -9.9, CD = 1.8, stone = new THREE.MeshStandardMaterial({ ...fieldstone(), bumpScale: 6, roughness: 0.92 });
  const stoneBlock = (w, h, d, at) => add(fire, tile(box(w, h, d), 1.9, 2.0, at), stone, at);
  stoneBlock(CD, RIDGE, 3.6, [X1 - CD / 2, RIDGE / 2, FZ]);
  stoneBlock(0.6, 0.5, 4.2, [X1 - CD - 0.3, 0.25, FZ]);                                                  // raised hearth
  // the fireplace proper: a stone surround standing proud of the chimney, the firebox set back between its jambs
  for (const side of [-1, 1]) stoneBlock(0.28, 1.5, 0.44, [X1 - CD - 0.14, 1.25, FZ + side * 1.17]);
  stoneBlock(0.28, 0.3, 2.78, [X1 - CD - 0.14, 1.97, FZ]);
  add(fire, box(0.04, 1.34, 1.92), std(0x120e0b, { roughness: 1 }), [X1 - CD - 0.01, 1.16, FZ], { cast: false });
  // The fire is lit at night. By day it is laid but cold: logs on the grate, a little pale ash.
  add(fire, box(0.5, 0.04, 1.3), std(0x1c1814, { roughness: 1 }), [X1 - CD - 0.14, 0.52, FZ], { cast: false });                      // the grate
  if (night) {
    add(fire, box(0.02, 0.5, 1.5), glow(0xb8380a, 1.4), [X1 - CD - 0.035, 0.78, FZ], { cast: false });                                // embers glowing on the back of the firebox
    const fireMat = new THREE.MeshBasicMaterial({ map: fireTongue(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    fireMat.color.setScalar(3.2);
    [[-0.46, 0.5], [-0.24, 0.78], [0.0, 0.95], [0.22, 0.72], [0.44, 0.48], [-0.12, 0.6], [0.12, 0.66]].forEach(([dz, h], i) => {
      for (const turn of [-0.45, 0.5]) veil.push(add(fire, new THREE.PlaneGeometry(h * 0.52, h), fireMat, [X1 - CD - 0.11 - (i % 3) * 0.035, 0.58 + h / 2, FZ + dz], { cast: false, receive: false, rot: [0, -Math.PI / 2 + turn, 0] }));
    });
    const flame = new THREE.PointLight(0xff8a3a, 9, 7, 1.5); flame.position.set(X1 - CD - 0.7, 0.9, FZ); fire.add(flame);
  } else add(fire, box(0.3, 0.02, 1.0), std(0xb8b2a8, { roughness: 1 }), [X1 - CD - 0.14, 0.55, FZ], { cast: false });              // cold ash
  for (let i = 0; i < 3; i++) add(fire, cyl(0.07, 0.07, 1.0, 8), std(0x3a2414), [X1 - CD - 0.12, 0.6 + i * 0.05, FZ - 0.15 + i * 0.15], { rot: [Math.PI / 2, 0, 0.3 * i] });
  add(fire, rbox(0.42, 0.26, 3.8, 0.02), timberDark, [X1 - CD - 0.1, 2.25, FZ]);                                     // timber mantel beam
  const ball = add(fire, new THREE.SphereGeometry(0.1, 20, 14), std(0x6b3a1e, { roughness: 0.6 }), [X1 - CD - 0.1, 2.47, FZ + 1.35]); ball.scale.set(1, 0.95, 1.6);
  add(fire, box(0.012, 0.012, 0.2), white, [X1 - CD - 0.1, 2.57, FZ + 1.35], { cast: false });
  add(fire, rbox(0.03, 0.3, 0.38, 0.008), timberDark, [X1 - CD - 0.02, 2.54, FZ - 1.3], { rot: [0, 0, 0.12] });
  add(fire, box(0.005, 0.22, 0.3), std(0x9fc4dd), [X1 - CD - 0.04, 2.54, FZ - 1.3], { cast: false, rot: [0, 0, 0.12] });
  const charter = group("constitution");
  const CX = X1 - CD / 2, CZ = FZ + 1.8;
  add(charter, box(0.74, 0.94, 0.06), std(0xa8823a, { metalness: 0.6, roughness: 0.35 }), [CX, 2.7, CZ + 0.03]);
  add(charter, new THREE.PlaneGeometry(0.62, 0.79), new THREE.MeshStandardMaterial({ map: parchment(), roughness: 0.9 }), [CX, 2.7, CZ + 0.065], { cast: false });
  add(charter, box(0.5, 0.04, 0.12), brass, [CX, 3.24, CZ + 0.07]);
  // The lounge by the fire, kept clear of the way through: a linen sofa facing you from the far side, two cane armchairs facing the
  // fire, a low table between; a clear aisle runs past it along the bar and on to the open doors.
  add(room, box(3.3, 0.012, 3.3), new THREE.MeshStandardMaterial({ map: jute(), roughness: 1 }), [0.5, 0.006, FZ - 0.1], { cast: false });
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
  sofa(0.55, FZ - 1.45, 0);
  for (const z of [FZ + 0.55, FZ - 0.55]) {
    const chair = new THREE.Group(); chair.position.set(-0.55, 0, z); chair.rotation.y = Math.PI / 2; scene.add(chair);
    add(chair, rbox(0.85, 0.3, 0.8, 0.1), rattan, [0, 0.24, 0]); add(chair, rbox(0.85, 0.62, 0.14, 0.07), rattan, [0, 0.58, -0.36]); add(chair, rbox(0.7, 0.14, 0.64, 0.06), linen, [0, 0.45, 0.04]);
    for (const dx of [-0.42, 0.42]) add(chair, rbox(0.1, 0.24, 0.76, 0.045), rattan, [dx, 0.52, 0.0]);
    for (const dx of [-0.36, 0.36]) for (const dz of [-0.32, 0.32]) add(chair, cyl(0.025, 0.02, 0.1, 8), chairWood, [dx, 0.05, dz]);
  }
  add(room, rbox(0.75, 0.06, 1.3, 0.02), m.walnut, [0.65, 0.4, FZ]);                                                                   // the low table
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.56, 0.56]) add(room, cyl(0.03, 0.022, 0.37, 10), m.walnut, [0.65 + dx, 0.185, FZ + dz]);
  // the record book (the pool's stats) lies open on the low table, where anyone in the lounge can leaf through it
  const record = group("record");
  add(record, rbox(0.42, 0.05, 0.56, 0.01), std(0x6b1f1a, { roughness: 0.5 }), [0.62, 0.455, FZ + 0.25], { rot: [0, 0.15, 0] });
  add(record, new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshStandardMaterial({ map: bookPages(), roughness: 0.9 }), [0.62, 0.484, FZ + 0.25], { cast: false, rot: [-Math.PI / 2, 0, Math.PI / 2 + 0.15] });
  const tableBall = add(room, new THREE.SphereGeometry(0.1, 20, 14), std(0x6b3a1e, { roughness: 0.6 }), [0.68, 0.52, FZ - 0.3]); tableBall.scale.set(1.5, 0.92, 0.92);

  // ----- the way to the Trophy Room: a painted wooden sign on a brass post by the chimney, an arrow pointing on past the fire. It
  // opens the Trophy Room as it is today (less the stats).
  const trophies = group("trophies");
  const signFace = (() => {
    const c = canvas(640, 220), g = c.getContext("2d");
    g.fillStyle = "#1f3b2f"; g.fillRect(0, 0, 640, 220); g.strokeStyle = "#c9a45f"; g.lineWidth = 8; g.strokeRect(14, 14, 612, 192);
    g.fillStyle = "#e6cf98"; g.textAlign = "left"; g.textBaseline = "middle"; let size = 76; do { g.font = `700 ${size}px Georgia, serif`; size -= 2; } while (g.measureText("Trophy Room").width > 400); g.fillText("Trophy Room", 44, 114);
    g.beginPath(); g.moveTo(520, 72); g.lineTo(596, 110); g.lineTo(520, 148); g.lineTo(520, 126); g.lineTo(478, 126); g.lineTo(478, 94); g.lineTo(520, 94); g.closePath(); g.fill();
    return texture(c);
  })();
  const SGX = 1.75, SGZ = -7.2;
  add(trophies, rbox(1.1, 0.4, 0.05, 0.02), m.walnut, [SGX, 1.95, SGZ]);
  add(trophies, new THREE.PlaneGeometry(1.02, 0.35), new THREE.MeshStandardMaterial({ map: signFace, roughness: 0.6 }), [SGX, 1.95, SGZ + 0.026], { cast: false });
  add(trophies, cyl(0.025, 0.025, 1.75, 12), brass, [SGX - 0.62, 0.9, SGZ]);
  add(trophies, cyl(0.16, 0.18, 0.04, 24), brass, [SGX - 0.62, 0.02, SGZ]);
  add(trophies, new THREE.SphereGeometry(0.04, 12, 10), brass, [SGX - 0.62, 1.8, SGZ]);
  for (const dx of [-0.42, 0.42]) add(trophies, cyl(0.006, 0.006, 0.12, 6), brass, [SGX + dx, 2.2, SGZ], { cast: false });
  add(trophies, box(0.95, 0.02, 0.02), brass, [SGX, 2.26, SGZ], { cast: false });
  add(trophies, box(0.02, 0.02, 0.02), brass, [SGX - 0.53, 2.26, SGZ], { cast: false });

  // ----- Survivor: a long oval poker table, forward in the room and well clear of the fire, with a seat for every player (ten) and
  // the dealer's place at the far side. Built as a real one is: a padded leather armrest round a walnut racetrack, felt with a gilt
  // betting line, a walnut apron, and two heavy pedestals; a hand dealt to each seat, the board and the pot in the middle, the
  // dealer's chip tray.
  const poker = group("survivor");
  const PX = 0.95, PZ = -4.85, PRX = 1.45, PRZ = 0.84, SEATS = 10;
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
  const chip = (color, at) => add(poker, cyl(0.04, 0.04, 0.016, 20), std(color, { roughness: 0.4 }), at, { cast: false });
  [[-0.14, 0.18], [0.02, 0.23], [0.16, 0.17]].forEach(([dx, dz], st) => { for (let k = 0; k < 5 + st * 2; k++) chip(chipColors[(st * 2 + (k % 2)) % 5], [PX + dx, 0.83 + k * 0.017, PZ + dz]); });   // the pot
  const cardMat = std(0xfbf9f2, { roughness: 0.5 }), cardBack = std(0x8c1e24, { roughness: 0.5 });
  for (let k = 0; k < 5; k++) add(poker, box(0.085, 0.004, 0.12), cardMat, [PX - 0.22 + k * 0.11, 0.824, PZ - 0.06], { cast: false });   // the board
  add(poker, rbox(0.62, 0.05, 0.16, 0.01), std(0x0c0c0c, { roughness: 0.4 }), [PX, 0.835, PZ - PRZ + 0.3]);                            // the dealer's chip tray
  for (let k = 0; k < 7; k++) for (let r = 0; r < 2; r++) add(poker, cyl(0.036, 0.036, 0.11, 16), std(chipColors[k % 5], { roughness: 0.4 }), [PX - 0.27 + k * 0.09, 0.85, PZ - PRZ + 0.26 + r * 0.075], { rot: [0, 0, Math.PI / 2], cast: false });
  add(poker, cyl(0.04, 0.04, 0.012, 20), std(0xfbf9f2, { roughness: 0.3 }), [PX + 0.48, 0.828, PZ - 0.2], { cast: false });              // dealer button
  for (let a = 0; a < SEATS; a++) {
    const t = Math.PI / 2 + ((a + 1) / (SEATS + 1)) * Math.PI * 2, cos = Math.cos(t), sin = Math.sin(t);                              // the dealer sits at the far side (t = -pi/2)
    for (const off of [-0.05, 0.05]) add(poker, box(0.085, 0.004, 0.12), cardBack, [PX + cos * (PRX - 0.42) + sin * off, 0.824 + (off > 0 ? 0.004 : 0), PZ + sin * (PRZ - 0.32) - cos * off], { cast: false, rot: [0, -t + Math.PI / 2 + off * 3, 0] });
    for (let k = 0; k < 4 + (a % 3) * 2; k++) chip(chipColors[(a + (k > 3 ? 1 : 0)) % 5], [PX + cos * (PRX - 0.62) + Math.cos(t + 1.5) * 0.1, 0.83 + k * 0.017, PZ + sin * (PRZ - 0.5) + Math.sin(t + 1.5) * 0.07]);
    const c = new THREE.Group(); c.position.set(PX + cos * (PRX + 0.36), 0, PZ + sin * (PRZ + 0.36)); c.rotation.y = Math.PI / 2 - Math.atan2(sin * PRX, cos * PRZ); poker.add(c);
    // a proper poker chair: four turned legs, a padded leather seat, an upright padded back on two posts leaning back a little,
    // and wooden arms on front supports
    for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) add(c, cyl(0.024, 0.018, 0.44, 12), chairWood, [lx, 0.22, lz]);
    for (const lx of [-0.2, 0.2]) add(c, cyl(0.012, 0.012, 0.38, 8), chairWood, [lx, 0.12, 0], { rot: [Math.PI / 2, 0, 0], cast: false });   // stretchers
    add(c, rbox(0.5, 0.06, 0.48, 0.02), chairWood, [0, 0.47, 0]);
    add(c, rbox(0.46, 0.09, 0.44, 0.04), saddle, [0, 0.54, -0.01]);
    for (const lx of [-0.2, 0.2]) add(c, cyl(0.022, 0.022, 0.52, 10), chairWood, [lx, 0.74, 0.22], { rot: [0.12, 0, 0] });
    add(c, rbox(0.44, 0.26, 0.07, 0.03), saddle, [0, 0.8, 0.245], { rot: [0.12, 0, 0] });
    add(c, rbox(0.48, 0.05, 0.06, 0.02), chairWood, [0, 0.98, 0.265], { rot: [0.12, 0, 0] });
    for (const lx of [-0.25, 0.25]) {
      add(c, rbox(0.06, 0.04, 0.42, 0.015), chairWood, [lx, 0.72, 0.02]);
      add(c, cyl(0.016, 0.016, 0.2, 8), chairWood, [lx, 0.61, -0.16]);
    }
  }

  // ----- plants in baskets and pots, a surfboard against the wall, and from Dec 7 the Bowl Pool's bulletin board on wheels, wheeled in
  // beside the open doors
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
  plant(2.0, ZB + 0.75, 1.3);
  monstera(2.15, -7.95, 0.9);
  add(room, rbox(0.08, 2.4, 0.55, 0.04), std(0x3f8fb0, { roughness: 0.35 }), [X1 - 0.2, 1.2, ZB + 1.9], { rot: [0, 0, 0.13] });
  for (const [x, z] of [[-4.6, ZB - 1.2], [-1.6, ZB - 1.4], [1.6, ZB - 1.4], [4.6, ZB - 1.2]]) {
    add(out, cyl(0.03, 0.04, 1.8, 8), std(0x6b4a2a), [x, 0.9, z]);
    add(out, cyl(0.07, 0.05, 0.18, 10), std(0x2a2a2a), [x, 1.85, z]);
    add(out, new THREE.ConeGeometry(0.06, 0.22, 10), glow(0xff8a2a, night ? 3 : 1.2), [x, 2.04, z], { cast: false });
    if (night) { const l = new THREE.PointLight(0xff9a40, 2.5, 4, 1.6); l.position.set(x, 2.1, z); out.add(l); }
  }
  if (bowl) {
    // From Dec 7 the Bowl Pool's board is wheeled in and stands at the front left of the room, turned a little toward the middle
    // of the room: a cork board in a walnut frame on a wheeled stand, the BOWL POOL pennant on top and the bowl games pinned up as cards.
    const b2 = group("bowl");
    const stand = new THREE.Group(); stand.position.set(-2.05, 0, -4.4); stand.rotation.y = 0.45; stand.scale.setScalar(0.85); b2.add(stand);
    const cork = (() => { const c = canvas(512, 384), g = c.getContext("2d"); g.fillStyle = "#b98a5a"; g.fillRect(0, 0, 512, 384); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? "90,60,30" : "230,190,140"},${0.08 + rand() * 0.14})`; g.fillRect(rand() * 512, rand() * 384, 1 + rand() * 2, 1 + rand() * 2); } return texture(c); })();
    add(stand, box(1.5, 1.05, 0.04), new THREE.MeshStandardMaterial({ map: cork, roughness: 1 }), [0, 1.42, 0]);
    for (const y of [0.87, 1.97]) add(stand, rbox(1.62, 0.07, 0.08, 0.015), m.walnut, [0, y, 0]);
    for (const x of [-0.78, 0.78]) { add(stand, rbox(0.07, 1.98, 0.08, 0.015), m.walnut, [x, 1.0, 0]); add(stand, rbox(0.08, 0.06, 0.6, 0.015), m.walnut, [x, 0.08, 0]); for (const dz of [-0.26, 0.26]) add(stand, cyl(0.045, 0.045, 0.035, 16), std(0x1a1a1a, { roughness: 0.6 }), [x, 0.045, dz], { rot: [0, 0, Math.PI / 2] }); }
    const card = (lines) => { const c = canvas(256, 200), g = c.getContext("2d"); g.fillStyle = "#f6f1e3"; g.fillRect(0, 0, 256, 200); g.fillStyle = "#1b2a4a"; g.fillRect(0, 0, 256, 44); g.fillStyle = "#e6cf98"; g.font = "700 26px Georgia"; g.textAlign = "center"; g.fillText(lines[0], 128, 31); g.fillStyle = "#1b2a4a"; g.font = "700 30px Arial"; lines.slice(1).forEach((line, i) => g.fillText(line, 128, 92 + i * 46)); return texture(c); };
    [["ROSE BOWL", "OSU -3.5", "ORE +3.5"], ["SUGAR BOWL", "UGA -6", "TEX +6"], ["ORANGE BOWL", "PSU -2.5", "FSU +2.5"], ["COTTON BOWL", "ND -1", "TCU +1"], ["FIESTA BOWL", "MICH -4", "UTAH +4"], ["PEACH BOWL", "LSU -7", "UCF +7"]].forEach((lines, i) => {
      const x = -0.48 + (i % 3) * 0.48, y = 1.66 - Math.floor(i / 3) * 0.47, tilt = [0.04, -0.03, 0.02, -0.04, 0.03, -0.02][i];
      add(stand, new THREE.PlaneGeometry(0.42, 0.33), new THREE.MeshStandardMaterial({ map: card(lines), roughness: 0.85 }), [x, y, 0.024], { cast: false, rot: [0, 0, tilt] });
      add(stand, new THREE.SphereGeometry(0.012, 10, 8), std([0xd4342c, 0x1d3557, 0xf0b429][i % 3], { roughness: 0.3 }), [x, y + 0.14, 0.03], { cast: false });
    });
    const pc = canvas(512, 160), pg = pc.getContext("2d"); pg.fillStyle = "#1b2a4a"; pg.beginPath(); pg.moveTo(0, 0); pg.lineTo(512, 80); pg.lineTo(0, 160); pg.fill(); pg.fillStyle = "#e6cf98"; pg.font = "700 52px Georgia"; pg.fillText("BOWL POOL", 26, 98);
    add(stand, new THREE.PlaneGeometry(0.8, 0.25), new THREE.MeshStandardMaterial({ map: texture(pc), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), [-0.32, 2.14, 0.0], { cast: false });
    add(stand, cyl(0.01, 0.01, 0.3, 8), brass, [-0.72, 2.12, 0]);
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
  const camera = new THREE.PerspectiveCamera(Number(q.get("fov") ?? 76), W / H, 0.1, 200);
  camera.position.set(...(q.get("cam") ?? "0.15,3.0,1.6").split(",").map(Number));
  camera.lookAt(...(q.get("look") ?? "0.0,1.55,-9").split(",").map(Number));
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

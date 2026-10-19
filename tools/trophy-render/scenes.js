import { THREE, makeStage, materials, mantleTop, lightBeam, mesh, profile, revolveMod } from "/lib.js";
import { pennantCup } from "/trophies.js";
import { mahoganyTable, RADIUS, PAD_TOP } from "/table.js";
import { hexBase, ivorySpire, lockSpire, armillary, crystalSpade, bowlBase, onyxBase, emeraldBase } from "/trophies2.js";

const shots = {
  survivor: { cushion: [1.35, 1.2], build: crystalSpade, base: emeraldBase, cam: [0, 38, 160], look: [0, 18, 0] },
  pickem: { cushion: [1.55, 1.95], build: ivorySpire, base: hexBase, cam: [0, 46, 200], look: [0, 25, 0] },
  bowl: { cushion: [1.35, 1.85], build: pennantCup, base: bowlBase, cam: [0, 42, 172], look: [0, 21, 0] },
  pickemcup: { cushion: [1.55, 1.95], build: lockSpire, base: hexBase, cam: [0, 36, 62], look: [0, 28.5, 0] },
  pickemtop: { cushion: [1.6, 1.55], build: ivorySpire, base: hexBase, cam: [0, 46, 80], look: [0, 31, 0] },
  bowltop: { cushion: [1.35, 1.85], build: pennantCup, base: bowlBase, cam: [0, 40, 85], look: [0, 31, 0] },
  pickemfoot: { cushion: [1.6, 1.55], build: ivorySpire, base: hexBase, cam: [0, 22, 80], look: [0, 6, 0] },
  survivorfoot: { cushion: [1.35, 1.2], build: crystalSpade, base: emeraldBase, cam: [0, 22, 80], look: [0, 6, 0] },
  bowlfoot2: { cushion: [1.35, 1.85], build: pennantCup, base: bowlBase, cam: [0, 22, 80], look: [0, 6, 0] },
  chipclose: { cushion: [1.35, 1.2], build: crystalSpade, base: emeraldBase, cam: [0, 36, 70], look: [0, 21, 0] },
  pickemmid: { cushion: [1.6, 1.55], build: ivorySpire, base: hexBase, cam: [0, 42, 118], look: [0, 25, 0] },
  wingclose: { cushion: [1.6, 1.55], build: ivorySpire, base: hexBase, cam: [0, 36, 60], look: [0, 24, 0] },
  flameclose: { cushion: [1.6, 1.55], build: ivorySpire, base: hexBase, cam: [0, 48, 66], look: [0, 38, 0] },
  cagefull: { cushion: [1.55, 1.95], build: ivorySpire, base: hexBase, cam: [0, 44, 90], look: [0, 25, 0] },
  cageanchor: { cushion: [1.55, 1.95], build: ivorySpire, base: hexBase, cam: [0, 20, 48], look: [0, 17, 0] },
  cagetop: { cushion: [1.55, 1.95], build: ivorySpire, base: hexBase, cam: [0, 40, 52], look: [0, 31, 0] },
  plaqueclose: { cushion: [1.35, 1.85], build: pennantCup, base: bowlBase, cam: [0, 8, 34], look: [0, 4.6, 0] },
  survivorzoom: { cushion: [1.35, 1.2], build: crystalSpade, base: emeraldBase, cam: [0, 26, 82], look: [0, 10.5, 0] },
  bowlturn: { cushion: [1.35, 1.85], turn: 2.1, build: pennantCup, base: bowlBase, cam: [0, 42, 172], look: [0, 21, 0] },
  test: { build: null, cam: [0, 24, 96], look: [0, 12, 0] },
};

/** Three trophies on the mahogany table, one on each landing pad, 120 degrees apart and facing outward; the table turns by `degrees`
 *  so the next one comes to the front. The camera frames the front trophy; the other two sit back at the edges of the picture. */
function buildTurntable(width, height, degrees) {
  const stage = makeStage({ width, height, fov: 22 });
  const m = materials();
  // the footprint of each trophy's base, so its velvet is cut to fit: the Pick'em hexagon, the Bowl Pool drum, the Survivor steps
  const table = mahoganyTable(m, [{ type: "hex", r: 11.875, turn: Math.PI / 6 }, { type: "circle", r: 10.15 }, { type: "rect", w: 20.6, d: 12.2 }]);
  const order = [[ivorySpire, hexBase, { fin: "coil" }], [pennantCup, bowlBase, {}], [crystalSpade, emeraldBase, {}]];
  order.forEach(([build, base, opts], k) => {
    const phi = k * 2 * Math.PI / 3, place = new THREE.Group();
    place.position.set(Math.sin(phi) * RADIUS, PAD_TOP, Math.cos(phi) * RADIUS); place.rotation.y = phi;
    const baseGroup = base(m); place.add(baseGroup);
    const trophy = build(m, { material: "white", ...opts }); trophy.position.y = baseGroup.userData.height; place.add(trophy);
    table.add(place);
  });
  table.rotation.y = -degrees * Math.PI / 180;
  stage.scene.add(table);
  stage.renderer.transmissionResolutionScale = 1;
  stage.camera.position.set(0, 44, RADIUS + 128); stage.camera.lookAt(0, 21, RADIUS - 2);
  // a wide, soft key from above the front pad, so the front trophy is lit best and the two behind fall off into the dark
  stage.key.position.set(-26, 120, RADIUS + 60); stage.key.target.position.set(0, 10, RADIUS); stage.key.angle = 0.42; stage.key.penumbra = 0.8; stage.key.intensity = 5200; stage.key.distance = 320;
  stage.key.shadow.mapSize.set(4096, 4096); stage.key.shadow.camera.near = 50; stage.key.shadow.camera.far = 260; stage.key.shadow.radius = 6; stage.key.shadow.bias = -0.0002;
  return stage;
}

export async function build(fullName, width, height) {
  { const q = new URLSearchParams(location.search); window.__champions = q.get("champions") ? JSON.parse(q.get("champions")) : undefined; }
  if (fullName.startsWith("turntable")) {
    const q = new URLSearchParams(location.search);
    return buildTurntable(width, height, Number(q.get("rot") ?? 0));
  }
  const [name, material, fin] = fullName.split("_");
  const stage = makeStage({ width, height, fov: 20 });
  const m = materials();
  const [kx, kz] = shots[name]?.cushion ?? [1, 1];
  stage.scene.add(mantleTop(m, kx, kz));
  const shot = shots[name] ?? shots.test;
  if (shot.build) {
    const top = 2.85; let rise = 0;
    if (shot.base) { const b = shot.base(m); b.position.y = top; b.rotation.y = shot.turn ?? 0; stage.scene.add(b); rise = b.userData.height; }
    const t = shot.build(m, { material, fin }); t.rotation.y = shot.turn ?? 0; t.position.y = top + rise; stage.scene.add(t);
  }
  stage.camera.position.set(...shot.cam); stage.camera.lookAt(...shot.look);
  stage.key.target.position.set(0, 12, 0);
  // where each plaque slot sits in the picture (fractions of the image), so the page can lay real plaques over a picture that has none
  stage.scene.updateMatrixWorld(true); stage.camera.updateMatrixWorld(true);
  const slots = [];
  stage.scene.traverse((o) => {
    if (!o.userData.slot) return;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), n = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld);
    if (n.dot(stage.camera.position.clone().sub(p).normalize()) < 0.9) return;
    const { w, h, order } = o.userData.slot;
    const pt = (x, y) => { const v = new THREE.Vector3(x, y, 0).applyMatrix4(o.matrixWorld).project(stage.camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
    const [lx, ty] = pt(-w / 2, h / 2), [rx, by] = pt(w / 2, -h / 2), [cx, cy] = pt(0, 0);
    slots.push({ order, cx, cy, w: Math.abs(rx - lx), h: Math.abs(by - ty) });
  });
  window.__slots = slots.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return stage;
}

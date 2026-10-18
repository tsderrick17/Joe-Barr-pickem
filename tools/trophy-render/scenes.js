import { THREE, makeStage, materials, mantleTop, lightBeam, mesh, profile, revolveMod } from "/lib.js";
import { pennantCup } from "/trophies.js";
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
  test: { build: null, cam: [0, 24, 96], look: [0, 12, 0] },
};

/** Three trophies on a triangular marble table, 120 degrees apart, each facing outward; the table turns by `degrees` so the next one comes to the front. */
function buildTurntable(width, height, degrees) {
  const stage = makeStage({ width, height, fov: 20 });
  const m = materials();
  const table = new THREE.Group();
  // the top: an equilateral triangle with softly rounded corners, thick and bevelled, edged with a gold bead line
  const R = 54, corner = 9, tangent = corner * Math.sqrt(3), pts = [0, 1, 2].map((i) => new THREE.Vector2(Math.sin(i * 2 * Math.PI / 3) * R, Math.cos(i * 2 * Math.PI / 3) * R));
  const shape = new THREE.Shape();
  pts.forEach((v, i) => {
    const prev = pts[(i + 2) % 3], next = pts[(i + 1) % 3], toPrev = prev.clone().sub(v).normalize(), toNext = next.clone().sub(v).normalize();
    const a = v.clone().addScaledVector(toPrev, tangent), b = v.clone().addScaledVector(toNext, tangent);
    if (i === 0) shape.moveTo(a.x, a.y); else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(v.x, v.y, b.x, b.y);
  });
  shape.closePath();
  const slab = new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 4, curveSegments: 18 });
  slab.rotateX(Math.PI / 2);
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0xe9e1d2, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.7 });
  const topMat = m.marble.clone(); topMat.map = m.marble.map.clone(); topMat.map.repeat.set(0.019, 0.019); topMat.map.needsUpdate = true;   // the extruded shape is in table units, so the texture is stretched across the whole top
  const top = mesh(slab, [topMat, edgeMat]); table.add(top);
  const outline = new THREE.CatmullRomCurve3(shape.getPoints(30).map((p) => new THREE.Vector3(p.x, 0.08, p.y)), true);
  table.add(mesh(new THREE.TubeGeometry(outline, 400, 0.28, 8, true), m.gold));
  // a stout central column and a round foot, in the same marble and gold
  table.add(mesh(revolveMod(profile([[10, -3.4], [8.2, -6], [6, -16], [6.4, -30], [8, -32]], 40), 80, null), m.marble));
  for (const y of [-6.4, -29]) { const ring = mesh(new THREE.TorusGeometry(y === -6.4 ? 8.4 : 7.2, 0.5, 14, 80), m.gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; table.add(ring); }
  table.add(mesh(revolveMod(profile([[24, -36], [24.6, -35], [22, -33], [10, -31.6], [7, -31.5]], 40), 100, null), m.gold));
  // each trophy on its own round velvet cushion, set at a corner of the table
  const order = [[ivorySpire, hexBase, { fin: "coil" }], [pennantCup, bowlBase, {}], [crystalSpade, emeraldBase, {}]];
  order.forEach(([build, base, opts], k) => {
    const phi = k * 2 * Math.PI / 3, place = new THREE.Group(), r = 26;
    place.position.set(Math.sin(phi) * r, 0, Math.cos(phi) * r); place.rotation.y = phi;
    place.add(mesh(revolveMod(profile([[0.01, 0], [13.2, 0], [13.9, 0.5], [13.9, 1.5], [12.9, 2.5], [0.01, 2.7]], 30), 100, null), m.velvet));
    const piping = mesh(new THREE.TorusGeometry(13.6, 0.2, 10, 100), m.gold); piping.rotation.x = Math.PI / 2; piping.position.y = 1.0; place.add(piping);
    const baseGroup = base(m); baseGroup.position.y = 2.65; place.add(baseGroup);
    const trophy = build(m, { material: "white", ...opts }); trophy.position.y = 2.65 + baseGroup.userData.height; place.add(trophy);
    table.add(place);
  });
  table.rotation.y = -degrees * Math.PI / 180;
  stage.scene.add(table);
  stage.renderer.transmissionResolutionScale = 1;
  stage.camera.position.set(0, 52, 206); stage.camera.lookAt(0, 21, 0);
  // a wide, soft key from above-left so every corner of the table is lit and the front trophy casts a gentle shadow
  stage.key.position.set(-34, 130, 90); stage.key.target.position.set(0, 8, 0); stage.key.angle = 0.62; stage.key.penumbra = 0.7; stage.key.intensity = 5200; stage.key.distance = 330;
  stage.key.shadow.mapSize.set(4096, 4096); stage.key.shadow.camera.near = 60; stage.key.shadow.camera.far = 260; stage.key.shadow.radius = 6; stage.key.shadow.bias = -0.0002;
  return stage;
}

export async function build(fullName, width, height) {
  if (fullName.startsWith("turntable")) {
    const q = new URLSearchParams(location.search);
    window.__champions = q.get("champions") ? JSON.parse(q.get("champions")) : undefined;
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

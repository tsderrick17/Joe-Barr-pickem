// The three trophies, modelled and lit for baked renders. Each builder returns a group standing on y = 0 (the top of the velvet cushion).
import { THREE, RoundedBoxGeometry, profile, revolveMod, mesh, beadRing, leafGeometry, laurel, chain, engravingTexture, engravingBand } from "/lib.js";

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tri = (x) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);

function tube(points, radius, material, closed = false, segments = 140) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, "catmullrom", 0.5);
  return mesh(new THREE.TubeGeometry(curve, segments, radius, 20, closed), material);
}

/** A cast scroll handle (an open volute ending in a curl) with an acanthus boss where it meets the cup. */
function scrollHandle(m, side) {
  const g = new THREE.Group();
  const s = side;
  // two parallel ribbons sweep out from the band and return to the bowl in one long, unbroken curve
  const path = [[7.7, 20.6], [9.0, 22.2], [11.1, 22.3], [12.3, 20.6], [12.2, 18.0], [11.0, 15.7], [9.2, 14.3], [7.6, 13.9]];
  for (const z of [-0.42, 0.42]) g.add(tube(path.map(([x, y]) => [s * x, y, z]), 0.3, m.gold, false, 160));
  // fine beads spaced along the ribbon gap
  const curve = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(s * x, y, 0)), false, "catmullrom", 0.5);
  for (let i = 1; i < 12; i++) { const p = curve.getPoint(i / 12); const b = mesh(new THREE.SphereGeometry(0.26, 18, 12), m.gold); b.position.copy(p); g.add(b); }
  // acanthus leaves where the handle meets the cup, top and bottom
  const leaf = leafGeometry(2.4, 0.85);
  for (const [y, dir] of [[20.7, 1], [14.0, -1]]) {
    for (let i = 0; i < 5; i++) { const l = mesh(leaf, m.gold); l.position.set(s * 7.85, y, (i - 2) * 0.32); l.rotation.set(0, (i - 2) * 0.3, s * -1.25 * dir + (i - 2) * 0.1 + (dir < 0 ? Math.PI : 0)); l.scale.setScalar(0.8); g.add(l); }
    const boss = mesh(new THREE.SphereGeometry(0.62, 24, 16), m.gold); boss.position.set(s * 7.75, y, 0); boss.scale.set(0.8, 1, 1.4); g.add(boss);
  }
  return g;
}

/** A fluttering swallow-less pennant: a finely divided plane tapering to a point, waved along its length. */
function pennantGeometry(length, half, phase, amount, waveLength = length) {
  const geo = new THREE.PlaneGeometry(length, half * 2, 60, 10); geo.translate(length / 2, 0, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), k = x / length, kw = x / waveLength;
    p.setY(i, y * (1 - k));
    p.setZ(i, Math.sin(x * 1.25 + phase) * amount * kw + Math.sin(x * 0.55 + phase * 1.7) * amount * 0.4 * kw);
  }
  geo.computeVertexNormals(); return geo;
}

export function pennantCup(m) {
  const g = new THREE.Group();
  const lobes = (n, a, lo, hi, soft = 0.5) => (theta, t, y, r) => r * (1 + a * Math.cos(n * theta) * smooth(lo, lo + soft, y) * (1 - smooth(hi - soft, hi, y)));

  const foot = profile([[6.4, 0], [6.5, 0.05], [6.7, 0.28], [6.35, 0.7], [5.7, 1.1], [4.4, 1.8], [2.7, 2.8], [1.45, 3.7], [1.15, 4.3]], 90);
  g.add(mesh(revolveMod(foot, 180, lobes(18, 0.075, 0.9, 3.4)), m.gold));
  g.add(beadRing(6.55, 56, 0.2, 0.62, m.gold));

  const stem = profile([[1.15, 4.2], [1.0, 5.2], [1.0, 6.0], [1.7, 6.6], [2.35, 7.5], [2.4, 8.2], [1.85, 9.0], [1.05, 9.5], [0.95, 10.4], [1.0, 11.0], [1.6, 11.45], [3.1, 11.9]], 140);
  g.add(mesh(revolveMod(stem, 160, (theta, t, y, r) => r * (1 + 0.05 * Math.cos(12 * theta) * smooth(6.1, 6.8, y) * (1 - smooth(8.6, 9.2, y)))), m.gold));
  g.add(beadRing(1.7, 28, 0.16, 6.55, m.gold)); g.add(beadRing(1.9, 30, 0.16, 8.95, m.gold)); g.add(beadRing(2.4, 36, 0.18, 7.75, m.gold));

  const bowl = profile([[3.1, 11.85], [4.7, 12.5], [6.3, 13.7], [7.3, 15.3], [7.75, 17.1], [7.85, 18.6], [7.85, 21.2], [7.6, 21.5], [7.4, 21.85]], 160);
  g.add(mesh(revolveMod(bowl, 200, lobes(22, 0.065, 12.2, 18.4, 0.7)), m.gold));
  g.add(beadRing(7.86, 72, 0.19, 18.55, m.gold)); g.add(beadRing(7.86, 72, 0.19, 21.25, m.gold));

  // engraved band
  const band = mesh(new THREE.CylinderGeometry(7.9, 7.9, 1.95, 220, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.3, bumpMap: engravingBand([["BOWL POOL CHAMPIONS", 0], ["✦", 0.25], ["JOE BARR MEMORIAL", 0.5], ["✦", 0.75]], 4096, 128, "700 50px Cinzel, Georgia, serif"), bumpScale: -2.4, envMapIntensity: 1.3 }));
  band.position.y = 19.9; g.add(band);

  // laurel garland around the foot of the bowl
  const ring = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 5.5, 12.6, Math.sin(a) * 5.5); }), true);

  g.add(scrollHandle(m, 1)); g.add(scrollHandle(m, -1));

  const lid = profile([[7.4, 21.8], [7.1, 22.2], [6.4, 22.9], [5.2, 23.6], [3.7, 24.3], [2.2, 24.9], [1.3, 25.3], [1.05, 25.8]], 110);
  g.add(mesh(revolveMod(lid, 200, lobes(22, 0.085, 22.3, 24.8, 0.5)), m.gold));
  g.add(beadRing(7.45, 70, 0.18, 21.95, m.gold));
  { const neck = mesh(new THREE.CylinderGeometry(1.05, 0.55, 2.0, 40), m.gold); neck.position.y = 26.6; g.add(neck); }

  // football finial
  const ball = new THREE.Group();
  const ballProfile = Array.from({ length: 41 }, (_, i) => { const t = (i / 40) * 2 - 1; return [Math.max(0.0001, 1.8 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.12 * t * t)), 3.2 * t]; });
  ball.add(mesh(revolveMod(ballProfile, 96, (theta, t, y, r) => r * (1 + 0.025 * Math.cos(2 * theta))), m.gold));
  for (const y of [-1.35, 1.35]) { const band2 = mesh(new THREE.TorusGeometry(1.52 * Math.sqrt(1 - (y / 3.2) ** 2) + 0.02, 0.08, 10, 60), m.goldSoft); band2.rotation.x = Math.PI / 2; band2.position.y = y; ball.add(band2); }
  const lace = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), m.goldSoft); lace.position.set(0, 0, 1.68); ball.add(lace);
  for (let i = 0; i < 6; i++) { const c = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8), m.goldSoft); c.position.set(0, -0.95 + i * 0.38, 1.76); c.rotation.z = Math.PI / 2; ball.add(c); }
  ball.position.y = 30.55; ball.rotation.z = -0.22; g.add(ball);
  const tee = profile([[1.05, 27.5], [0.75, 27.9], [0.85, 28.3], [1.35, 28.55], [1.7, 28.75], [1.62, 28.95]], 40);
  g.add(mesh(revolveMod(tee, 64, (theta, t, y, r) => r * (1 + 0.06 * Math.cos(10 * theta) * smooth(28.3, 28.6, y))), m.gold));
  g.add(beadRing(1.7, 22, 0.12, 28.8, m.gold));

  // a gold seating ring on the lid: a broad rolled collar with a beaded edge, one socket boss per flag
  { const ringProfile = profile([[4.55, 23.7], [4.7, 24.1], [4.55, 24.6], [4.1, 24.95], [3.4, 25.05], [2.7, 24.95], [2.25, 24.6], [2.1, 24.2], [2.25, 23.9]], 80);
    g.add(mesh(revolveMod(ringProfile, 200, (theta, t2, y, r) => r * (1 + 0.025 * Math.cos(20 * theta))), m.gold));
    g.add(beadRing(4.6, 60, 0.12, 24.15, m.gold)); g.add(beadRing(2.2, 36, 0.1, 24.25, m.gold));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const boss = mesh(new THREE.SphereGeometry(0.62, 24, 16), m.gold); boss.scale.y = 0.55; boss.position.set(Math.cos(a) * 3.4, 24.95, Math.sin(a) * 3.4); g.add(boss); } }
  // crown of pennants on slender staffs
  const colors = [0x14224a, 0xb3142a, 0x1a6b43, 0xe0a928, 0xf2eee2, 0x5a2478, 0xcf4a17, 0x0f5f8c, 0x7a1230, 0x1d7a8a];
  const enamel = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.05 });
  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2, tall = i % 2 === 0;
    const base = new THREE.Group();
    const staffLength = tall ? 10.8 : 8.0;
    const staff = mesh(new THREE.CylinderGeometry(0.09, 0.13, staffLength, 12), m.gold); staff.position.y = staffLength / 2; base.add(staff);
    const tip = mesh(new THREE.SphereGeometry(0.22, 16, 12), m.gold); tip.position.y = staffLength + 0.1; base.add(tip);
    const trimGeo = pennantGeometry(6.9, 1.9, i * 0.9, 0.7, 6.9), plateGeo = pennantGeometry(6.2, 1.42, i * 0.9, 0.7, 6.9);
    const goldSide = new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.25, side: THREE.DoubleSide, envMapIntensity: 1.3 });
    const enamelSide = enamel(colors[i]); enamelSide.side = THREE.DoubleSide;
    const t = mesh(trimGeo, goldSide); t.position.set(0.03, staffLength - 2.1, -0.09); base.add(t);
    const p = mesh(plateGeo, enamelSide); p.position.set(0.14, staffLength - 2.1, 0.03); base.add(p);
    const back = mesh(plateGeo, enamelSide); back.position.set(0.14, staffLength - 2.1, -0.21); base.add(back);
    const sleeve = mesh(new THREE.CylinderGeometry(0.27, 0.36, 1.3, 20), m.gold); sleeve.position.y = 0.45; base.add(sleeve);
    const collar = mesh(new THREE.TorusGeometry(0.34, 0.09, 10, 24), m.gold); collar.rotation.x = Math.PI / 2; collar.position.y = 1.1; base.add(collar);
    base.position.set(Math.cos(a) * 3.4, 24.35, Math.sin(a) * 3.4);
    base.rotation.y = -a; base.rotation.z = -0.3;
    g.add(base);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The Lead Pipe (Pick'em): a polished lead pipe lying in two gilt cradles, locked with an engraved gold padlock, on a walnut plinth.
export function leadPipe(m) {
  const g = new THREE.Group();
  // plinth: walnut tiers, gold moulding, a beaded border and an engraved brass plate
  const tier1 = mesh(new RoundedBoxGeometry(17, 1.4, 10.4, 6, 0.28), m.walnut); tier1.position.y = 0.7; g.add(tier1);
  const mould = mesh(new RoundedBoxGeometry(17.3, 0.3, 10.7, 4, 0.12), m.gold); mould.position.y = 1.55; g.add(mould);
  const tier2 = mesh(new RoundedBoxGeometry(14.6, 1.2, 8.4, 6, 0.26), m.walnut); tier2.position.y = 2.3; g.add(tier2);
  const cap = mesh(new RoundedBoxGeometry(14.9, 0.28, 8.7, 4, 0.1), m.gold); cap.position.y = 3.0; g.add(cap);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 16, 12), m.gold, 120);
  { const mat = new THREE.Matrix4(); let k = 0; for (let i = 0; i < 40; i++) { const x = -8.25 + (i / 39) * 16.5; for (const z of [-5.1, 5.1]) { mat.makeTranslation(x, 1.83, z); beads.setMatrixAt(k++, mat); } } for (let i = 0; i < 20; i++) { const z = -4.8 + (i / 19) * 9.6; for (const x of [-8.5, 8.5]) { mat.makeTranslation(x, 1.83, z); beads.setMatrixAt(k++, mat); } } beads.count = k; beads.castShadow = true; g.add(beads); }
  const plate = mesh(new THREE.BoxGeometry(8.2, 0.85, 0.14), new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.3, bumpMap: engravingBand([["THE LEAD PIPE  ·  PICK’EM", 0.5]], 1024, 128, "700 46px Cinzel, Georgia, serif"), bumpScale: -2.0, envMapIntensity: 1.3 })); plate.position.set(0, 0.72, 5.26); g.add(plate);
  const topSlab = mesh(new RoundedBoxGeometry(12.6, 0.3, 6.6, 4, 0.1), m.marble); topSlab.position.y = 3.3; g.add(topSlab);
  const deck = 3.45;

  // the pipe: tilted about the Z axis
  const tilt = 0.42, center = new THREE.Vector3(0, 12.2, 0), dir = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0);
  const along = (s) => center.clone().addScaledVector(dir, s);
  const pipe = new THREE.Group();
  const radius = 2.9, length = 26;
  pipe.add(mesh(new THREE.CylinderGeometry(radius, radius, length, 96, 1, false), m.lead));
  // gold collars, hex nuts and the engraved centre band
  for (const s of [-1, 1]) {
    const collar = mesh(new THREE.CylinderGeometry(radius + 0.3, radius + 0.3, 1.1, 64), m.gold); collar.position.y = s * (length / 2 - 2.6); pipe.add(collar);
    for (const o of [-0.9, 0.9]) { const rib = mesh(new THREE.TorusGeometry(radius + 0.32, 0.17, 12, 72), m.gold); rib.rotation.x = Math.PI / 2; rib.position.y = s * (length / 2 - 2.6) + o; pipe.add(rib); }
    const nut = mesh(new THREE.CylinderGeometry(radius + 0.55, radius + 0.55, 1.25, 6), m.gold); nut.position.y = s * (length / 2 + 0.2); pipe.add(nut);
    const boss = mesh(new THREE.CylinderGeometry(radius - 0.8, radius - 0.4, 0.5, 48), m.goldSoft); boss.position.y = s * (length / 2 + 1.0); pipe.add(boss);
  }
  const banded = mesh(new THREE.CylinderGeometry(radius + 0.16, radius + 0.16, 4.4, 120, 1, true), m.gold);
  pipe.add(banded);
  for (const o of [-2.2, 2.2]) { const rib = mesh(new THREE.TorusGeometry(radius + 0.18, 0.14, 12, 72), m.gold); rib.rotation.x = Math.PI / 2; rib.position.y = o; pipe.add(rib); }
  pipe.position.copy(center); pipe.rotation.z = tilt - Math.PI / 2; g.add(pipe);
  // an engraved gold nameplate riding on the front of the pipe, reading along its length
  const nameplate = mesh(new RoundedBoxGeometry(6.4, 1.9, 0.34, 4, 0.1), new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.3, bumpMap: engravingBand([["PICK’EM CHAMPION", 0.5]], 2048, 256, "700 120px Cinzel, Georgia, serif"), bumpScale: -2.4, envMapIntensity: 1.3 }));
  nameplate.position.copy(along(-5.3)).add(new THREE.Vector3(0, 0, radius + 0.1)); nameplate.rotation.z = tilt; g.add(nameplate);

  // two gilt cradles (balusters carrying gold saddle rings)
  const perp = new THREE.Vector3(Math.sin(tilt), -Math.cos(tilt), 0);
  for (const s of [-9.2, 9.0]) {
    const c = along(s), ringR = radius + 0.7;
    const ring = mesh(new THREE.TorusGeometry(ringR, 0.34, 18, 90), m.gold); ring.position.copy(c); ring.rotation.y = Math.PI / 2; ring.rotation.x = 0; ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); g.add(ring);
    const bottom = c.clone().addScaledVector(perp, ringR);
    const top = bottom.y + 1.1, height = top - deck;
    const prof = profile([[3.0, 0], [3.1, 0.25], [2.5, 0.7], [1.5, 1.5], [1.15, 2.4], [1.15, height * 0.36], [1.9, height * 0.42], [2.0, height * 0.5], [1.5, height * 0.58], [1.05, height * 0.66], [1.1, height * 0.86], [1.7, height * 0.94], [1.9, height]], 140);
    const baluster = mesh(revolveMod(prof, 140, (theta, t, y, r) => r * (1 + 0.05 * Math.cos(10 * theta) * (y > height * 0.38 && y < height * 0.62 ? 1 : 0) + 0.06 * Math.cos(14 * theta) * (y < 1.4 ? 1 : 0))), m.gold);
    baluster.position.set(bottom.x, deck, 0); g.add(baluster);
    { const rb = beadRing(2.0, 30, 0.14, deck + height * 0.5, m.gold); rb.position.set(bottom.x, 0, 0); g.add(rb); }
  }

  // the padlock hangs from a gold ring around the middle of the pipe
  {
    const c = along(0.5), ringR = radius + 0.55;
    const ring = mesh(new THREE.TorusGeometry(ringR, 0.3, 18, 90), m.gold); ring.position.copy(c); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); g.add(ring);
    const hook = c.clone().addScaledVector(perp, ringR);
    const lock = new THREE.Group(); lock.position.set(hook.x, hook.y, 0);
    const shackle = mesh(new THREE.TorusGeometry(1.1, 0.34, 16, 48, Math.PI), m.silver); shackle.position.y = -0.9; shackle.rotation.z = 0; lock.add(shackle);
    for (const x of [-1.1, 1.1]) { const leg = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.4, 20), m.silver); leg.position.set(x, -1.55, 0); lock.add(leg); }
    const body = mesh(new RoundedBoxGeometry(5.4, 4.6, 1.9, 8, 0.55), m.gold); body.position.y = -4.4; lock.add(body);
    const shieldShape = new THREE.Shape(); shieldShape.moveTo(0, 1.9); shieldShape.bezierCurveTo(1.9, 1.9, 2.0, 0.6, 1.8, -0.3); shieldShape.bezierCurveTo(1.5, -1.5, 0.5, -2.0, 0, -2.2); shieldShape.bezierCurveTo(-0.5, -2.0, -1.5, -1.5, -1.8, -0.3); shieldShape.bezierCurveTo(-2.0, 0.6, -1.9, 1.9, 0, 1.9);
    const shield = mesh(new THREE.ExtrudeGeometry(shieldShape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 4, curveSegments: 24 }), m.goldSoft); shield.position.set(0, -4.35, 0.95); lock.add(shield);
    const hole = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0x120c06, roughness: 0.9 })); hole.rotation.x = Math.PI / 2; hole.position.set(0, -4.05, 1.3); lock.add(hole);
    const slot = mesh(new THREE.BoxGeometry(0.3, 0.95, 0.3), new THREE.MeshStandardMaterial({ color: 0x120c06, roughness: 0.9 })); slot.position.set(0, -4.75, 1.3); lock.add(slot);
    for (const [x, y] of [[-2.2, -2.5], [2.2, -2.5], [-2.2, -6.2], [2.2, -6.2]]) { const rivet = mesh(new THREE.SphereGeometry(0.2, 16, 12), m.gold); rivet.position.set(x, y, 0.98); lock.add(rivet); }
    g.add(lock);
  }
  g.scale.setScalar(1.12);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The Last Hand (Survivor): a cut-crystal decanter of cognac with a gold spade stopper, and the winning team's poker chip in a gold bezel.
export function chipTexture({ primary = "#0e2a5c", secondary = "#c4162a", ring = "#f6f2e6" } = {}) {
  const size = 1024, c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), mid = size / 2;
  g.fillStyle = primary; g.fillRect(0, 0, size, size);
  // edge blocks: alternating ivory and red around the rim, kept narrow so the face can be large
  for (let i = 0; i < 12; i++) { g.save(); g.translate(mid, mid); g.rotate((i / 12) * Math.PI * 2); g.fillStyle = i % 2 ? ring : secondary; g.beginPath(); g.arc(0, 0, 500, -Math.PI / 24 - 0.06, Math.PI / 24 + 0.06); g.arc(0, 0, 430, Math.PI / 24 + 0.06, -Math.PI / 24 - 0.06, true); g.closePath(); g.fill(); g.restore(); }
  g.strokeStyle = ring; g.lineWidth = 8; g.beginPath(); g.arc(mid, mid, 420, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "#d9a93f"; g.lineWidth = 6; g.beginPath(); g.arc(mid, mid, 404, 0, Math.PI * 2); g.stroke();
  g.fillStyle = ring; g.beginPath(); g.arc(mid, mid, 392, 0, Math.PI * 2); g.fill();
  g.strokeStyle = primary; g.lineWidth = 10; g.beginPath(); g.arc(mid, mid, 372, 0, Math.PI * 2); g.stroke();
  // one large, plain face: all four suits, the word, a gold rule and the motto, dark on ivory so it reads at a glance
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "700 176px Georgia, serif"; g.letterSpacing = "0px";
  [["♠", primary, -262], ["♥", secondary, -88], ["♣", primary, 88], ["♦", secondary, 262]].forEach(([glyph, colour, dx]) => { g.fillStyle = colour; g.fillText(glyph, mid + dx, mid - 160); });
  g.fillStyle = primary; g.font = "900 110px Cinzel, Georgia, serif"; g.letterSpacing = "4px"; g.fillText("SURVIVOR", mid, mid + 28);
  g.strokeStyle = "#b8872a"; g.lineWidth = 7; g.beginPath(); g.moveTo(mid - 240, mid + 108); g.lineTo(mid + 240, mid + 108); g.stroke();
  g.fillStyle = primary; g.font = "700 72px Cinzel, Georgia, serif"; g.letterSpacing = "3px"; g.fillText("LAST MAN", mid, mid + 172); g.fillText("STANDING", mid, mid + 248);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; return t;
}

export function lastHand(m, chip = {}) {
  const g = new THREE.Group();
  // round tray: walnut disc in a gadrooned gold rim, with a bead border
  const tray = profile([[0.01, 0], [9.5, 0], [9.8, 0.25], [9.8, 0.9], [9.4, 1.15], [8.9, 1.1], [8.7, 1.0], [0.01, 1.0]], 80);
  g.add(mesh(revolveMod(tray, 200, (theta, t, y, r) => r * (1 + (r > 9.0 ? 0.006 * Math.cos(36 * theta) : 0))), m.gold));
  const inlay = mesh(new THREE.CylinderGeometry(8.8, 8.8, 0.2, 160), m.felt); inlay.position.y = 1.0; g.add(inlay);
  g.add(beadRing(9.45, 90, 0.17, 1.18, m.gold)); g.add(beadRing(8.9, 80, 0.14, 1.12, m.gold));
  const deckY = 1.12;

  const decanter = new THREE.Group(); decanter.position.z = -2.0; g.add(decanter);
  // the decanter: heavy cut-crystal body (diamond cuts), neck and lip
  const body = profile([[5.0, 0], [5.55, 0.3], [5.7, 1.8], [6.7, 3.0], [7.7, 5.2], [8.1, 7.7], [7.8, 10.2], [6.7, 12.5], [4.7, 14.5], [2.9, 15.8], [1.95, 16.9], [1.75, 18.4], [1.85, 19.5], [2.45, 20.0], [2.2, 20.5]], 220);
  const cuts = (theta, t, y, r) => {
    const zone = smooth(1.9, 3.4, y) * (1 - smooth(12.6, 14.4, y));
    const lobe = tri((theta * 22) / (Math.PI * 2)), row = tri(y / 2.3);
    return r * (1 + 0.05 * zone * lobe * row) + (y < 1.9 ? 0.0 : 0);
  };
  const glass = mesh(revolveMod(body, 220, cuts, { flat: true }), m.crystal); glass.position.y = deckY; glass.castShadow = true; decanter.add(glass);
  const base = mesh(new THREE.CylinderGeometry(5.1, 5.1, 1.0, 80), m.crystal); base.position.y = deckY + 0.5; decanter.add(base);
  // the cognac inside
  const liquid = profile([[0.01, 1.2], [4.6, 1.3], [5.4, 2.4], [6.5, 3.4], [7.3, 5.4], [7.7, 7.7], [7.35, 9.9], [6.7, 10.9], [0.01, 10.9]], 120);
  const cognacMesh = mesh(revolveMod(liquid, 120, null), m.cognac); cognacMesh.position.y = deckY + 0.2; cognacMesh.castShadow = false; decanter.add(cognacMesh);

  // gold collar, chain and tag on the neck, and the spade stopper
  const collar = mesh(new THREE.TorusGeometry(2.0, 0.28, 16, 64), m.gold); collar.rotation.x = Math.PI / 2; collar.position.y = deckY + 18.3; decanter.add(collar);
  decanter.add(beadRing(2.3, 36, 0.13, deckY + 18.3, m.gold));
  const sleeve = mesh(new THREE.CylinderGeometry(2.05, 2.15, 1.6, 64, 1, true), m.gold); sleeve.position.y = deckY + 20.0; decanter.add(sleeve);
  const stopperStem = mesh(new THREE.CylinderGeometry(1.2, 1.5, 3.2, 40), m.crystal); stopperStem.position.y = deckY + 20.2; decanter.add(stopperStem);
  const spade = new THREE.Shape();
  spade.moveTo(0, 3.6); spade.bezierCurveTo(1.6, 2.2, 3.3, 0.9, 3.3, -0.6); spade.bezierCurveTo(3.3, -1.9, 2.3, -2.4, 1.5, -2.4); spade.bezierCurveTo(0.9, -2.4, 0.5, -2.1, 0.35, -1.7); spade.bezierCurveTo(0.4, -2.6, 0.8, -3.4, 1.3, -3.9); spade.lineTo(-1.3, -3.9); spade.bezierCurveTo(-0.8, -3.4, -0.4, -2.6, -0.35, -1.7); spade.bezierCurveTo(-0.5, -2.1, -0.9, -2.4, -1.5, -2.4); spade.bezierCurveTo(-2.3, -2.4, -3.3, -1.9, -3.3, -0.6); spade.bezierCurveTo(-3.3, 0.9, -1.6, 2.2, 0, 3.6);
  const spadeMesh = mesh(new THREE.ExtrudeGeometry(spade, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 8, curveSegments: 48 }), m.gold);
  spadeMesh.position.set(0, deckY + 24.9, -0.55); decanter.add(spadeMesh);
  const chainCurve = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 2.25, deckY + 17.4 - 0.2 * Math.max(0, Math.cos(a - Math.PI / 2)), Math.sin(a) * 2.25); }), true);
  decanter.add(chain(chainCurve, 34, 0.17, 0.045, m.gold));
  const tag = mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.22, 48), m.gold); tag.rotation.x = Math.PI / 2; tag.position.set(0, deckY + 16.0, 2.55); decanter.add(tag);
  const tagRim = mesh(new THREE.TorusGeometry(1.05, 0.09, 12, 48), m.gold); tagRim.position.set(0, deckY + 16.0, 2.6); decanter.add(tagRim);

  // the winning team's chip, upright in a gold bezel on a little stand, leaning on the decanter
  const chipGroup = new THREE.Group();
  const tex = chipTexture(chip);
  const chipSide = new THREE.MeshPhysicalMaterial({ color: 0xf6f2e6, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const chipFace = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const chipMesh = mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.8, 120), [chipSide, chipFace, chipFace]); chipMesh.rotation.x = Math.PI / 2; chipGroup.add(chipMesh);
  const bezel = mesh(new THREE.TorusGeometry(4.5, 0.36, 22, 120), m.gold); chipGroup.add(bezel);
  const bezel2 = mesh(new THREE.TorusGeometry(4.0, 0.12, 14, 120), m.gold); bezel2.position.z = 0.42; chipGroup.add(bezel2);
  chipGroup.position.set(0, deckY + 5.4, 7.2); chipGroup.rotation.x = -0.12; g.add(chipGroup);
  const stand = mesh(new RoundedBoxGeometry(5.6, 0.5, 2.6, 4, 0.18), m.gold); stand.position.set(0, deckY + 0.25, 7.3); g.add(stand);
  for (const x of [-1.4, 1.4]) { const prong = mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.5, 16), m.gold); prong.position.set(x, deckY + 1.15, 7.3); g.add(prong); }
  const cradle = mesh(new THREE.TorusGeometry(1.5, 0.22, 12, 40, Math.PI), m.gold); cradle.position.set(0, deckY + 1.55, 7.3); cradle.rotation.z = Math.PI; g.add(cradle);
  return g;
}

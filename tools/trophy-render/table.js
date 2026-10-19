// The display table: a hand-made mahogany table whose top is cut tight around three landing pads, one per trophy. Each pad is the
// outline of its trophy's base (a raised moulded step with a velvet inset), and the top flows round them in smooth curves, with
// satinwood stringing, a marquetry compass star in the middle, a carved apron, a carved urn pedestal and three cabriole legs ending
// in brass claw-and-ball feet. Table units: the top surface is y = 0.
import { THREE, mesh, profile, revolveMod, fbm } from "/lib.js";

export const RADIUS = 48;        // distance from the centre to each landing pad
export const PAD_TOP = 1.8;      // height of a pad's velvet above the table top
const STEP_H = 1.45;             // height of the pad's raised moulded step

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

/** Mahogany: deep red-brown with a ribbon figure (light and dark stripes that shimmer), fine pores, and a slight warp. */
function mahoganyTexture(size = 1024) {
  const c = canvas(size, size), g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    const warp = fbm(nx * 2, ny * 3, 4) * 0.9;
    const ribbon = 0.5 + 0.5 * Math.sin((nx * 18 + warp * 3) * Math.PI);
    const grain = fbm(nx * 60, ny * 3 + warp, 4);
    const pore = Math.pow(fbm(nx * 220, ny * 9, 2), 6);
    const t = 0.45 * ribbon + 0.45 * grain - pore * 0.6;
    const r = 70 + t * 62, gg = 24 + t * 24, b = 14 + t * 14;
    const i = (y * size + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

/** A tube whose radius changes along its length (rFn(t) for t in 0..1). */
function taperedTube(curve, rFn, segments = 120, radial = 18) {
  const frames = curve.computeFrenetFrames(segments, false), pos = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPointAt(t), n = frames.normals[i], b = frames.binormals[i], r = rFn(t);
    for (let j = 0; j <= radial; j++) { const a = (j / radial) * Math.PI * 2, cx = Math.cos(a) * r, cy = Math.sin(a) * r; pos.push(p.x + cx * n.x + cy * b.x, p.y + cx * n.y + cy * b.y, p.z + cx * n.z + cy * b.z); }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b2 = a + radial + 1; idx.push(a, b2, a + 1, b2, b2 + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}

/** footprints: one per pad, the shape of the trophy base that stands on it ({ type: "hex", r } | { type: "circle", r } | { type: "rect", w, d }). */
/** The outline of a trophy base grown by `offset` (rounded at the corners), as points in the pad's own flat plane (x, y). */
function footprintPoints(fp, offset, perCorner = 14) {
  const pts = [];
  const arc = (cx, cy, r, a0, a1) => { for (let i = 0; i <= perCorner; i++) { const a = a0 + (a1 - a0) * (i / perCorner); pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } };
  if (fp.type === "circle") { for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector2(Math.cos(a) * (fp.r + offset), Math.sin(a) * (fp.r + offset))); } return pts; }
  if (fp.type === "hex") {
    for (let k = 0; k < 6; k++) {   // each corner of the hexagon becomes an arc of radius `offset` between its two neighbouring edge normals
      const a = (fp.turn ?? 0) - (k / 6) * Math.PI * 2, vx = Math.sin(a) * fp.r, vy = Math.cos(a) * fp.r, dir = Math.PI / 2 - a;
      arc(vx, vy, offset, dir - Math.PI / 6, dir + Math.PI / 6);
    }
    return pts;
  }
  const w = fp.w / 2, d = fp.d / 2;       // a rectangle
  arc(w, d, offset, 0, Math.PI / 2); arc(-w, d, offset, Math.PI / 2, Math.PI); arc(-w, -d, offset, Math.PI, Math.PI * 1.5); arc(w, -d, offset, Math.PI * 1.5, Math.PI * 2);
  return pts;
}

/** Signed distance from point (x, y) to a closed polygon (negative inside). */
function polygonSdf(poly, x, y) {
  let d2 = Infinity, inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], ex = b.x - a.x, ey = b.y - a.y, px = x - a.x, py = y - a.y;
    const u = Math.max(0, Math.min(1, (px * ex + py * ey) / (ex * ex + ey * ey || 1))), dx = px - ex * u, dy = py - ey * u;
    d2 = Math.min(d2, dx * dx + dy * dy);
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  const d = Math.sqrt(d2); return inside ? -d : d;
}

/** Smooth minimum: a union whose joins are rounded over a distance k. */
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

/** footprints: one per pad, the outline of the trophy base standing on it: { type: "hex", r, turn } | { type: "circle", r } | { type: "rect", w, d }. */
export function mahoganyTable(m, footprints = []) {
  const table = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ map: mahoganyTexture(), roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.22, specularIntensity: 0.5, envMapIntensity: 0.28 });
  const woodTop = wood.clone(); woodTop.map = wood.map.clone(); woodTop.map.repeat.set(0.02, 0.02); woodTop.map.needsUpdate = true;
  const satin = new THREE.MeshPhysicalMaterial({ color: 0xc9a466, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.3 });
  const ebony = new THREE.MeshPhysicalMaterial({ color: 0x1b0e08, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.3 });

  // world-plane outline of each pad's table-top edge: the trophy base grown by 6.5
  const pads = [0, 1, 2].map((k) => {
    const phi = (k / 3) * Math.PI * 2, cx = Math.sin(phi) * RADIUS, cz = Math.cos(phi) * RADIUS, fp = footprints[k] ?? { type: "circle", r: 11 };
    const toWorld = (p) => new THREE.Vector2(cx + p.x * Math.cos(phi) + p.y * Math.sin(phi), cz - p.x * Math.sin(phi) + p.y * Math.cos(phi));
    return { phi, cx, cz, fp, world: (offset) => footprintPoints(fp, offset).map(toWorld) };
  });
  const topPolys = pads.map((p) => p.world(6.5));
  // the table top is the smooth union of a central disc and the three pad outlines; a blend distance of 16 gives deep, flowing curves between them
  const field = (x, y) => topPolys.reduce((d, poly) => smin(d, polygonSdf(poly, x, y), 16), Math.hypot(x, y) - 24);
  const outline = (inset = 0) => Array.from({ length: 1440 }, (_, i) => {
    const a = (i / 1440) * Math.PI * 2, sx = Math.sin(a), sy = Math.cos(a);
    let r = 110; while (r > 0 && field(sx * r, sy * r) > -inset) r -= 0.7;   // walk in from outside until the edge (offset by `inset`) is crossed
    let lo = r, hi = r + 0.7; for (let s = 0; s < 8; s++) { const mid = (lo + hi) / 2; if (field(sx * mid, sy * mid) > -inset) hi = mid; else lo = mid; }
    return new THREE.Vector2(sx * lo, sy * lo);
  });

  const slab = new THREE.ExtrudeGeometry(new THREE.Shape(outline()), { depth: 2.6, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.7, bevelSegments: 10, curveSegments: 4 });
  slab.rotateX(Math.PI / 2); slab.translate(0, -0.7, 0);
  table.add(mesh(slab, [woodTop, wood]));
  // satinwood stringing a little in from the edge, and a fine ebony line inside it
  for (const [inset, r, mat] of [[2.4, 0.16, satin], [3.2, 0.08, ebony]]) {
    const curve = new THREE.CatmullRomCurve3(outline(inset).map((p) => new THREE.Vector3(p.x, 0.02, p.y)), true);
    table.add(mesh(new THREE.TubeGeometry(curve, 1440, r, 8, true), mat, { cast: false }));
  }
  // marquetry in the middle: a twelve-point compass star of satinwood and ebony inside a satinwood ring
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, long = k % 2 === 0, len = long ? 13 : 7.5, w = long ? 1.7 : 1.2;
    const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-w, len * 0.22), new THREE.Vector2(0, len), new THREE.Vector2(w, len * 0.22)]);
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
    const piece = new THREE.Mesh(g, long ? (k % 4 === 0 ? satin : ebony) : satin); piece.rotation.y = a; piece.position.y = 0.03; piece.receiveShadow = true; table.add(piece);
  }
  for (const [r, w] of [[15, 0.5], [16.2, 0.18]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + w, 160), satin); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; table.add(ring); }

  // a carved apron under the edge, following the outline
  const apron = new THREE.ExtrudeGeometry(new THREE.Shape(outline(4)), { depth: 3.2, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 3, curveSegments: 4 });
  apron.rotateX(Math.PI / 2); apron.translate(0, -3.6, 0); table.add(mesh(apron, wood));
  { const curve = new THREE.CatmullRomCurve3(outline(3.7).map((p) => new THREE.Vector3(p.x, -5.4, p.y)), true); table.add(mesh(new THREE.TubeGeometry(curve, 1440, 0.35, 10, true), m.gold)); }

  // the landing pads: a moulded step in the shape of the base, with satinwood stringing, a gold bead edge and a velvet inset
  const beadGeo = new THREE.SphereGeometry(0.17, 12, 8);
  for (const pad of pads) {
    const g = new THREE.Group(); g.position.set(pad.cx, 0, pad.cz); g.rotation.y = pad.phi;
    const flat = (pts, y) => pts.map((p) => new THREE.Vector3(p.x, y, -p.y));   // the pad's flat plane (x, y) to the group's ground plane (x, -z)
    const stepGeo = new THREE.ExtrudeGeometry(new THREE.Shape(footprintPoints(pad.fp, 2.5)), { depth: STEP_H - 0.2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 4, curveSegments: 4 });
    stepGeo.rotateX(-Math.PI / 2); g.add(mesh(stepGeo, wood));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flat(footprintPoints(pad.fp, 1.9), STEP_H + 0.02), true, "centripetal"), 800, 0.07, 6, true), satin, { cast: false }));
    { const pts = flat(footprintPoints(pad.fp, 2.75, 20), 0.5), beads = []; let carry = 0;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], len = a.distanceTo(b); let d = carry; while (d < len) { beads.push(a.clone().lerp(b, d / len)); d += 0.5; } carry = d - len; }
      const inst = new THREE.InstancedMesh(beadGeo, m.gold, beads.length), mat4 = new THREE.Matrix4(); beads.forEach((p, i) => { mat4.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, mat4); }); inst.castShadow = true; g.add(inst); }
    const velvetGeo = new THREE.ExtrudeGeometry(new THREE.Shape(footprintPoints(pad.fp, 0.9)), { depth: PAD_TOP - STEP_H - 0.06, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4 });
    velvetGeo.rotateX(-Math.PI / 2); velvetGeo.translate(0, STEP_H - 0.04, 0); g.add(mesh(velvetGeo, m.velvet));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flat(footprintPoints(pad.fp, 0.9), PAD_TOP - 0.02), true, "centripetal"), 800, 0.1, 8, true), m.gold));
    table.add(g);
  }

  // the pedestal: a carved urn column under the centre, and three cabriole legs sweeping out under the lobes to claw-and-ball feet
  table.add(mesh(revolveMod(profile([[9, -3.6], [7.5, -5], [5, -7], [4.2, -10], [6.5, -14], [7.2, -17], [6, -20], [3.6, -24], [3.4, -27], [5.6, -29], [6.2, -31]], 80), 120, (theta, t, y, r) => r * (1 + 0.06 * Math.cos(16 * theta) * (y < -13 && y > -21 ? 1 : 0))), wood));
  for (const y of [-7.2, -20.2, -28.6]) { const ring = mesh(new THREE.TorusGeometry(y === -7.2 ? 5 : y === -20.2 ? 6 : 5.4, 0.28, 10, 80), m.gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; table.add(ring); }
  for (let k = 0; k < 3; k++) {
    const phi = (k / 3) * Math.PI * 2, dir = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const P = (r, y) => dir.clone().multiplyScalar(r).setY(y);
    const curve = new THREE.CatmullRomCurve3([P(4.5, -27), P(9, -29.5), P(16, -30.5), P(22, -33), P(25.5, -38.5), P(26.5, -42)]);
    table.add(mesh(taperedTube(curve, (t) => 2.7 - 1.3 * t + 0.6 * Math.exp(-Math.pow((t - 0.35) / 0.12, 2))), wood));
    const ball = mesh(new THREE.SphereGeometry(1.7, 28, 20), m.gold); ball.position.copy(P(26.7, -43.5)); table.add(ball);
    for (let toe = -1; toe <= 1; toe++) {
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      const tc = new THREE.CatmullRomCurve3([P(26.3, -42).addScaledVector(side, toe * 0.5), P(27.6, -42.6).addScaledVector(side, toe * 1.2), P(28.2, -44.2).addScaledVector(side, toe * 1.3)]);
      table.add(mesh(taperedTube(tc, (t) => 0.55 - 0.3 * t, 24, 10), m.gold));
    }
  }
  return table;
}

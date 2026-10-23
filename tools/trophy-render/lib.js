// Shared pieces for the baked trophy renders: renderer, studio lighting, procedural textures (marble, walnut, velvet, engraving),
// metal and crystal materials, and the ornamental geometry (gadrooned lathes, beaded rings, laurel leaves, chains, scrolls).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export { THREE, RoundedBoxGeometry };

// ---------- noise
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}
export function fbm(x, y, octaves = 5) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < octaves; i++) { v += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return v; }

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

// ---------- textures
// Periodic value noise: the lattice wraps, so a texture built from it tiles seamlessly in both directions.
const wrap = (i, p) => ((i % p) + p) % p;
function pnoise(x, y, px, py, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
  const h = (i, j) => hash(wrap(i, px) + seed * 131, wrap(j, py) + seed * 17);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}
function fbmP(x, y, period, octaves, seed) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < octaves; i++) { v += a * pnoise(x * f, y * f, period * f, period * f, seed + i); f *= 2; a *= 0.5; } return v; }

/** Carrara-style marble: soft cloudy white with grey veins that branch and fade, a few hairline cracks and a fine grain. Tiles in both directions. */
export function marbleTexture(size = 1024, seed = 3) {
  const c = canvas(size, size), g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    // domain warp: coordinates swirled by low-frequency noise so veins wander instead of running straight
    const wa = fbmP(nx * 2, ny * 2, 2, 4, seed + 1) - 0.5, wb = fbmP(nx * 2, ny * 2, 2, 4, seed + 7) - 0.5;
    const wx = nx * 3 + wa * 2.4, wy = ny * 3 + wb * 2.4;
    const major = Math.pow(1 - Math.abs(2 * fbmP(wx, wy, 3, 4, seed + 11) - 1), 11);       // the main veins
    const minor = Math.pow(1 - Math.abs(2 * fbmP(wx * 2.2 + 3, wy * 2.2, 6, 4, seed + 17) - 1), 16);  // finer, fainter veins
    const hair = Math.pow(1 - Math.abs(2 * fbmP(wx * 5, wy * 5 + 2, 15, 3, seed + 23) - 1), 30);      // hairline cracks
    const haze = Math.pow(1 - Math.abs(2 * fbmP(wx, wy, 3, 4, seed + 11) - 1), 3);          // a soft shadow either side of a vein
    const cloud = fbmP(nx * 4, ny * 4, 4, 5, seed + 29);
    const warm = fbmP(nx * 3, ny * 3, 3, 3, seed + 31);
    const grain = (hash(x + seed * 3, y * 7) - 0.5) * 5;
    let r = 238, gg = 235, b = 229;
    const shade = 0.92 + cloud * 0.14; r *= shade; gg *= shade; b *= shade;
    r += (warm - 0.5) * 8; b -= (warm - 0.5) * 7;
    const hz = haze * 0.1; r *= 1 - hz; gg *= 1 - hz; b *= 1 - hz;
    const v = Math.min(1, major * 0.8 + minor * 0.38 + hair * 0.3);
    r = r * (1 - v) + 98 * v + grain; gg = gg * (1 - v) + 100 * v + grain; b = b * (1 - v) + 108 * v + grain;
    const i = (y * size + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// ---------- marble that belongs to the stone: veins are a function of position in space, not a tiled picture
const h3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi, s = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const sx = s(xf), sy = s(yf), sz = s(zf);
  const l = (a, b, k) => a + (b - a) * k;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), sx), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), sx), sy),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), sx), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), sx), sy), sz);
}
function fbm3(x, y, z, octaves = 5) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < octaves; i++) { v += a * vnoise3(x * f + i * 17.3, y * f + i * 5.1, z * f + i * 9.7); f *= 2.02; a *= 0.5; } return v; }

/**
 * Statuario-style marble painted onto a turned stone. `points` is the stone's profile ([radius, y] from the bottom up, exactly as it is revolved): every texel is
 * mapped back to its true place on the stone and coloured from 3D noise there, so the veins run on continuously round the stone and up it, never repeat, never
 * pinch where the column narrows and never show a seam. Soft grey veins run diagonally and branch; a few finer ones follow; the body is a warm, cloudy white.
 */
export function marbleOnProfile(points, size = 2048, seed = 1) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = cumulative[cumulative.length - 1];
  const at = (s) => { let i = 1; while (i < points.length - 1 && cumulative[i] < s) i++; const k = (s - cumulative[i - 1]) / ((cumulative[i] - cumulative[i - 1]) || 1); return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k]; };
  const c = canvas(size, size), g = c.getContext("2d"), img = g.createImageData(size, size);
  const S = seed * 11.7;
  for (let ry = 0; ry < size; ry++) {
    const [radius, y] = at((1 - ry / size) * total);
    for (let rx = 0; rx < size; rx++) {
      const theta = (rx / size) * Math.PI * 2, px = Math.cos(theta) * radius, pz = -Math.sin(theta) * radius;
      const q = [px * 0.3 + S, y * 0.3 + S * 0.5, pz * 0.3];
      // wander: the coordinates are pushed about by low-frequency noise, and the veins lean diagonally up the stone
      const wx = (fbm3(q[0] + 3.1, q[1] + 1.7, q[2] + 8.3, 4) - 0.5) * 2.4, wy = (fbm3(q[0] + 9.2, q[1] + 4.4, q[2] + 2.8, 4) - 0.5) * 2.4, wz = (fbm3(q[0] + 5.5, q[1] + 7.9, q[2] + 6.1, 4) - 0.5) * 2.4;
      const lean = (px * 0.55 + pz * 0.25) * 0.3;
      const d1 = fbm3(q[0] + wx, q[1] * 0.8 + wy + lean, q[2] + wz, 5);
      const d2 = fbm3(q[0] * 2.1 + wx * 1.4 + 11, q[1] * 1.7 + wy * 1.4 + lean * 1.5, q[2] * 2.1 + wz * 1.4 + 3, 4);
      const d3 = fbm3(q[0] * 4.6 + wx * 1.8 + 5, q[1] * 3.8 + wy * 1.8, q[2] * 4.6 + wz * 1.8 + 13, 3);
      const major = Math.pow(1 - Math.abs(2 * d1 - 1), 13);
      const minor = Math.pow(1 - Math.abs(2 * d2 - 1), 24) * 0.55;
      const hair = Math.pow(1 - Math.abs(2 * d3 - 1), 44) * 0.3;
      const halo = Math.pow(1 - Math.abs(2 * d1 - 1), 4) * 0.07;        // a faint cloudiness either side of a vein
      const cloud = fbm3(q[0] * 0.8 + 21, q[1] * 0.7, q[2] * 0.8 + 6, 4);
      const warm = fbm3(q[0] * 0.5 + 40, q[1] * 0.5, q[2] * 0.5, 3);
      const shade = 0.955 + cloud * 0.07;
      let r = 241 * shade + (warm - 0.5) * 6, gg = 237 * shade + (warm - 0.5) * 3, b = 229 * shade - (warm - 0.5) * 6;
      const k = Math.min(1, major * 0.62 + minor * 0.5 + hair * 0.4);
      const pale = 1 - halo;
      r = r * pale * (1 - k) + 120 * k; gg = gg * pale * (1 - k) + 116 * k; b = b * pale * (1 - k) + 122 * k;
      const i = (ry * size + rx) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 16; return t;
}

export function walnutTexture(size = 1024) {
  const c = canvas(size, size), g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    const grain = fbm(nx * 2.2, ny * 40, 5);
    const ring = Math.sin((ny * 26 + fbm(nx * 3, ny * 4, 3) * 5) * Math.PI);
    const t = 0.55 * grain + 0.45 * (ring * 0.5 + 0.5);
    const r = 62 + t * 66, gg = 36 + t * 40, b = 20 + t * 22;
    const i = (y * size + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function velvetBump(size = 512) {
  const c = canvas(size, size), g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = 0.5 + (fbm(x / 6, y / 6, 3) - 0.5) * 0.9 + (hash(x, y) - 0.5) * 0.35;
    const i = (y * size + x) * 4; const k = Math.max(0, Math.min(255, v * 255)); img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); return t;
}

/** White engraved lettering on black, used as a bump map so the text reads as cut into the metal. */
export function engravingTexture(lines, width = 2048, height = 256, font = "700 76px Cinzel, Georgia, serif") {
  const c = canvas(width, height), g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, width, height);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = font; g.letterSpacing = "10px";
  const lh = height / lines.length;
  // The text is centred on the texture's seam, which faces the camera on a cylinder: drawn at both edges, it joins up across the wrap.
  lines.forEach((line, i) => { g.fillText(line, 0, lh * (i + 0.5)); g.fillText(line, width, lh * (i + 0.5)); });
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// ---------- materials
export function materials() {
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd9a93f, metalness: 1, roughness: 0.2, clearcoat: 0.25, clearcoatRoughness: 0.15, envMapIntensity: 1.35 });
  const goldSoft = new THREE.MeshPhysicalMaterial({ color: 0xc89a38, metalness: 1, roughness: 0.38, envMapIntensity: 1.2 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd8dbe0, metalness: 1, roughness: 0.16, clearcoat: 0.2, envMapIntensity: 1.3 });
  const pewter = new THREE.MeshPhysicalMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
  const lead = new THREE.MeshPhysicalMaterial({ color: 0xaeb3bb, metalness: 1, roughness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.1, envMapIntensity: 1.35 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xb98a3a, metalness: 1, roughness: 0.34, envMapIntensity: 1.1 });
  const walnut = new THREE.MeshPhysicalMaterial({ map: walnutTexture(), roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });
  const marble = new THREE.MeshPhysicalMaterial({ color: 0xc4bcb0, map: marbleTexture(), roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.55 });
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x52071a, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xd9283f), sheenRoughness: 0.45, bumpMap: velvetBump(), bumpScale: 1.2 });
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 1.8, ior: 1.52, attenuationColor: new THREE.Color(0xe8f4ff), attenuationDistance: 12, envMapIntensity: 0.45, specularIntensity: 0.6, clearcoat: 0 });
  const cognac = new THREE.MeshPhysicalMaterial({ color: 0x3a1402, roughness: 0.25, metalness: 0, emissive: new THREE.Color(0x9a3d04), emissiveIntensity: 0.55, envMapIntensity: 0.05 });
  const felt = new THREE.MeshPhysicalMaterial({ color: 0x0b3a29, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0x4fb283), sheenRoughness: 0.5, bumpMap: velvetBump(), bumpScale: 0.8 });
  const ivory = new THREE.MeshPhysicalMaterial({ color: 0xf4efe3, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  return { gold, goldSoft, silver, pewter, lead, brass, walnut, marble, velvet, crystal, cognac, ivory, felt };
}

// ---------- renderer, camera and studio light
export function makeStage({ width, height, fov = 20 }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0a0709, 1);
  const scene = new THREE.Scene();
  scene.background = stageBackground(width, height);
  const camera = new THREE.PerspectiveCamera(fov, width / height, 1, 400);

  // A studio for the reflections: a dark room with a big soft top box, two warm and cool strips and a dim floor bounce.
  const room = new THREE.Scene();
  // A warm gradient room: dim floor, bright horizon band, softer ceiling. Gold reflecting a black room turns brown, so the room is never black.
  const skyGeometry = new THREE.SphereGeometry(80, 48, 24);
  const colors = []; const pos = skyGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 80; const horizon = Math.exp(-Math.pow((y - 0.05) / 0.28, 2));
    const warm = new THREE.Color(1.0, 0.8, 0.56), cool = new THREE.Color(0.62, 0.64, 0.72), floor = new THREE.Color(0.8, 0.62, 0.48);
    const c = (y < -0.05 ? floor.clone().lerp(warm.clone().multiplyScalar(0.7), Math.max(0, 1 + y * 8)) : cool.clone().lerp(warm, horizon)).multiplyScalar(0.95 * (0.62 + horizon * 1.0));
    colors.push(c.r, c.g, c.b);
  }
  skyGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  room.add(new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, color, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); room.add(m); };
  panel(34, 24, new THREE.Color(11, 10.2, 9.2), [0, 40, 6], [0, 0, 0]);          // top softbox
  panel(4.5, 36, new THREE.Color(9, 8.2, 7), [-30, 8, 14], [0, 6, 0]);            // left strip, warm
  panel(4.5, 36, new THREE.Color(5.5, 6.4, 8), [32, 8, 12], [0, 6, 0]);           // right strip, cool
  panel(30, 5, new THREE.Color(4.5, 4.2, 3.8), [0, 6, 34], [0, 6, 0]);            // front fill
  panel(24, 4, new THREE.Color(6, 5.4, 4.4), [0, 10, -34], [0, 6, 0]);            // back rim
  panel(60, 60, new THREE.Color(1.5, 1.15, 0.9), [0, -14, 0], [0, 0, 0]);         // floor bounce
  panel(10, 26, new THREE.Color(5.5, 4.6, 3.4), [-22, 14, -26], [0, 8, 0]);       // back-left warm strip
  panel(10, 26, new THREE.Color(4.2, 4.4, 5.2), [24, 14, -24], [0, 8, 0]);        // back-right cool strip
  panel(14, 14, new THREE.Color(3.2, 2.8, 2.2), [-18, 34, 24], [0, 8, 0]);        // front-left key kicker
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, 0.012, 0.1, 500).texture;
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xfff0d2, 2300, 160, 0.34, 0.55, 2);
  key.position.set(-6, 46, 16); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.00015; key.shadow.radius = 5; key.shadow.camera.near = 20; key.shadow.camera.far = 90;
  const rim = new THREE.DirectionalLight(0xbfd2ff, 0.7); rim.position.set(14, 12, -16);
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.35); fill.position.set(-16, 6, 20);
  scene.add(key, key.target, rim, fill);
  return { renderer, scene, camera, key };
}

/** The display room behind the trophy: a deep wine-black wall that falls away to a vignette, with a warm pool where the spotlight lands. */
function stageBackground(width, height) {
  const c = canvas(width, height), g = c.getContext("2d");
  const vertical = g.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, "#120b0f"); vertical.addColorStop(0.6, "#0e090c"); vertical.addColorStop(1, "#070508");
  g.fillStyle = vertical; g.fillRect(0, 0, width, height);
  // the spotlight: a soft-edged shaft from above that brightens as it falls, ending in a warm pool on the wall
  g.save(); g.filter = `blur(${Math.round(width * 0.035)}px)`;
  const shaft = g.createLinearGradient(0, 0, 0, height * 0.8);
  shaft.addColorStop(0, "rgba(255,226,180,0.05)"); shaft.addColorStop(0.5, "rgba(255,222,176,0.13)"); shaft.addColorStop(1, "rgba(255,214,160,0.24)");
  g.fillStyle = shaft; g.beginPath();
  g.moveTo(width * 0.44, -40); g.lineTo(width * 0.56, -40); g.lineTo(width * 0.9, height * 0.8); g.lineTo(width * 0.1, height * 0.8); g.closePath(); g.fill();
  g.restore();
  const pool = g.createRadialGradient(width / 2, height * 0.62, 0, width / 2, height * 0.62, width * 0.55);
  pool.addColorStop(0, "rgba(140,98,62,0.30)"); pool.addColorStop(0.55, "rgba(80,50,36,0.12)"); pool.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = pool; g.fillRect(0, 0, width, height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function lightBeam(topY = 70, bottomY = 2, topRadius = 2.4, bottomRadius = 26, z = -1) {
  const c = canvas(4, 256), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#000"); gr.addColorStop(0.45, "#3a3a3a"); gr.addColorStop(1, "#d0d0d0"); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const alpha = new THREE.CanvasTexture(c);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, topY - bottomY, 96, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9c2, transparent: true, opacity: 0.17, alphaMap: alpha, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(0, (topY + bottomY) / 2, z); cone.renderOrder = -1; return cone;
}

export async function finish({ renderer, scene, camera }) {
  await document.fonts.ready;
  renderer.render(scene, camera);
  window.__png = renderer.domElement.toDataURL("image/png");
  window.__webp = renderer.domElement.toDataURL("image/webp", 0.76);
  window.__webpHd = renderer.domElement.toDataURL("image/webp", 0.92);   // the sharp resting views
  window.__done = true;
}

// ---------- geometry helpers
/** Samples a smooth profile through [radius, height] control points. */
export function profile(points, divisions = 160) {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints(divisions).map((p) => [Math.max(0.0001, p.x), p.y]);
}

/**
 * A surface of revolution whose radius can be modulated around the axis: mod(theta, t, y, radius) returns a radius multiplier or offset.
 * Used for gadrooned (fluted) cups, faceted crystal and carved knops.
 */
export function revolveMod(points, segments, mod, { flat = false } = {}) {
  const rows = points.length;
  const positions = [], uvs = [], indices = [];
  let length = 0; const cumulative = [0];
  for (let i = 1; i < rows; i++) { length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); cumulative.push(length); }
  for (let i = 0; i < rows; i++) {
    const [radius, y] = points[i]; const t = i / (rows - 1);
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const r = mod ? mod(theta, t, y, radius) : radius;
      positions.push(Math.cos(theta) * r, y, -Math.sin(theta) * r);
      uvs.push(j / segments, cumulative[i] / length);
    }
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < segments; j++) {
    const a = i * (segments + 1) + j, b = a + 1, c = a + segments + 1, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  if (flat) geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();
  window.__revolveStats = window.__revolveStats ?? [];
  { const n = geometry.attributes.normal, q = geometry.attributes.position; let dot = 0; for (let i = 0; i < n.count; i++) { const x = q.getX(i), z = q.getZ(i), len = Math.hypot(x, z) || 1; dot += (n.getX(i) * x + n.getZ(i) * z) / len; } window.__revolveStats.push(Math.round(dot / n.count * 100) / 100); }
  return geometry;
}

export function mesh(geometry, material, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geometry, material); m.castShadow = cast; m.receiveShadow = receive; return m; }

/** A ring of beads (a pearl border) around the Y axis. */
export function beadRing(radius, count, beadRadius, y, material) {
  const group = new THREE.Group();
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(beadRadius, 24, 16), material, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) { const a = (i / count) * Math.PI * 2; m.makeTranslation(Math.cos(a) * radius, y, Math.sin(a) * radius); beads.setMatrixAt(i, m); }
  beads.castShadow = true; beads.receiveShadow = true; group.add(beads); return group;
}

/** A lens-shaped laurel leaf lying in the XY plane, pointing along +Y, curved and ridged. */
export function leafGeometry(length = 1.6, width = 0.55) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.bezierCurveTo(width, length * 0.25, width * 0.9, length * 0.7, 0, length); shape.bezierCurveTo(-width * 0.9, length * 0.7, -width, length * 0.25, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 14);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.abs(x) * 0.55 + (y / length) * (y / length) * 0.35); }
  geometry.computeVertexNormals();
  return geometry;
}

/** A laurel branch curving along a path: leaves in opposed pairs, with tiny berries. */
export function laurel(curve, count, leafMaterial, berryMaterial, scale = 1) {
  const group = new THREE.Group();
  const leaf = leafGeometry(1.7 * scale, 0.55 * scale);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.05 * scale, 8), leafMaterial); stem.castShadow = true; group.add(stem);
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), point = curve.getPoint(t), tangent = curve.getTangent(t);
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(leaf, leafMaterial); l.castShadow = true; l.receiveShadow = true;
      l.position.copy(point);
      // point the leaf along the branch, splayed outward to one side
      const q = new THREE.Quaternion().setFromUnitVectors(up, tmp.copy(tangent).add(new THREE.Vector3(side * 0.9, 0.15, 0.25 * side)).normalize());
      l.quaternion.copy(q);
      l.scale.setScalar(1 - t * 0.25);
      group.add(l);
    }
    if (i % 3 === 1 && berryMaterial) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 16, 12), berryMaterial); b.position.copy(point).add(new THREE.Vector3(0, 0.05, 0.16)); b.castShadow = true; group.add(b); }
  }
  return group;
}

/** A chain of links along a curve. */
export function chain(curve, links, linkRadius, tube, material) {
  const group = new THREE.Group();
  const geometry = new THREE.TorusGeometry(linkRadius, tube, 12, 28); geometry.scale(1, 1.55, 1);
  for (let i = 0; i < links; i++) {
    const t = i / (links - 1), p = curve.getPoint(t), tangent = curve.getTangent(t);
    const link = new THREE.Mesh(geometry, material); link.castShadow = true; link.position.copy(p);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    if (i % 2) link.rotateY(Math.PI / 2);
    group.add(link);
  }
  return group;
}

/** The marble slab with its red velvet cushion (gold piping and tassels): where every trophy stands. */
export function mantleTop(m, k = 1, kz = k) {
  const group = new THREE.Group();
  const slab = mesh(new RoundedBoxGeometry(34, 3.2, Math.max(17, 11.5 * kz + 5.5), 8, 0.35), m.marble); slab.position.y = -1.6; group.add(slab);
  const lip = mesh(new RoundedBoxGeometry(35.2, 0.9, Math.max(17, 11.5 * kz + 5.5) + 1.2, 6, 0.3), m.marble); lip.position.y = -3.4; group.add(lip);
  // cushion: a plump rounded box, softly crowned
  const cushionGeometry = new RoundedBoxGeometry(17 * k, 2.6, 11.5 * kz, 16, 1.2);
  const p = cushionGeometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); if (y > 0) p.setY(i, y + 0.45 * Math.max(0, 1 - (x * x) / (72 * k * k) - (z * z) / (34 * kz * kz))); }
  cushionGeometry.computeVertexNormals();
  const cushion = mesh(cushionGeometry, m.velvet); cushion.position.y = 1.35; group.add(cushion);
  return group;
}

/** Engraved lettering placed around a cylinder: [text, fraction] pairs, where fraction 0 is the front (the texture's seam) and 0.5 the back. */
export function engravingBand(items, width = 2048, height = 128, font = "700 46px Cinzel, Georgia, serif") {
  const c = canvas(width, height), g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, width, height);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = font; g.letterSpacing = "8px";
  for (const [text, fraction] of items) { g.fillText(text, fraction * width, height / 2); if (fraction === 0) g.fillText(text, width, height / 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

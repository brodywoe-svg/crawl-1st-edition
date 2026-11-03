/* 3D dice roller: a prototype (see dev/testing/3d-dice.md). Not linked from the site.
   Three.js draws the dice and cannon-es throws them. When everything has stopped, each die is read from the face
   pointing up (for a d4, the face pointing down, because a d4 is read at its top point). Dice pass through each other,
   and any die still moving after 8 s is laid flat on its nearest face, so a roll always finishes. */
import * as THREE from "three";
import * as CANNON from "cannon-es";

type Sides = 4 | 6 | 8 | 10 | 12 | 20;
const SIDES: Sides[] = [4, 6, 8, 10, 12, 20];
const MAX_DICE = 12;
const SIZE = 0.8; // die radius in world units

// ---------------------------------------------------------------- dice shapes
/** A face of a die: its value, its outward normal, centre and corners (in the die's own space). */
interface Face { value: number; normal: THREE.Vector3; center: THREE.Vector3; corners: THREE.Vector3[] }
interface DieShape { geometry: THREE.BufferGeometry; faces: Face[]; physics: CANNON.Shape }

/** A d10: a pentagonal trapezohedron, with the top and bottom points placed so every kite face is flat. */
function d10Geometry(r: number): THREE.BufferGeometry {
  const a = 0.105, ring = Array.from({ length: 10 }, (_, k) => new THREE.Vector3(Math.cos(k * Math.PI / 5), k % 2 ? -a : a, Math.sin(k * Math.PI / 5)));
  // top point: where the plane through three neighbouring ring corners meets the axis
  const [p0, p1, p2] = ring, n = new THREE.Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0));
  const h = p0.y + (n.x * p0.x + n.z * p0.z) / n.y, top = new THREE.Vector3(0, Math.abs(h), 0), bottom = new THREE.Vector3(0, -Math.abs(h), 0);
  const tris: THREE.Vector3[] = [], v = (i: number) => ring[(i + 10) % 10];
  for (let k = 0; k < 10; k += 2) { tris.push(top, v(k), v(k + 1), top, v(k + 1), v(k + 2)) } // upper kites
  for (let k = 1; k < 10; k += 2) { tris.push(bottom, v(k), v(k + 1), bottom, v(k + 1), v(k + 2)) } // lower kites
  // wind every triangle outwards
  for (let i = 0; i < tris.length; i += 3) {
    const [x, y, z] = [tris[i], tris[i + 1], tris[i + 2]], nn = new THREE.Vector3().crossVectors(y.clone().sub(x), z.clone().sub(x));
    if (nn.dot(x.clone().add(y).add(z)) < 0) { tris[i + 1] = z; tris[i + 2] = y }
  }
  const g = new THREE.BufferGeometry().setFromPoints(tris.map(p => p.clone().multiplyScalar(r * 0.92)));
  g.computeVertexNormals();
  return g;
}

function baseGeometry(sides: Sides, r: number): THREE.BufferGeometry {
  switch (sides) {
    case 4: return new THREE.TetrahedronGeometry(r * 1.15);
    case 6: return new THREE.BoxGeometry(r * 1.15, r * 1.15, r * 1.15).toNonIndexed();
    case 8: return new THREE.OctahedronGeometry(r);
    case 10: return d10Geometry(r);
    case 12: return new THREE.DodecahedronGeometry(r * 0.95);
    case 20: return new THREE.IcosahedronGeometry(r);
  }
}

/** Group the triangles into flat faces, number them (opposite faces add up to sides + 1), and build the physics shape. */
function makeShape(sides: Sides): DieShape {
  const geometry = baseGeometry(sides, SIZE), pos = geometry.getAttribute("position");
  const pts: THREE.Vector3[] = [], key = (p: THREE.Vector3) => p.toArray().map(x => x.toFixed(4)).join(",");
  const index = new Map<string, number>(), tri: number[][] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const t = [0, 1, 2].map(j => {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i + j), k = key(p);
      if (!index.has(k)) { index.set(k, pts.length); pts.push(p) }
      return index.get(k)!;
    });
    tri.push(t);
  }
  // group triangles that face the same way
  const groups: { normal: THREE.Vector3; idx: Set<number> }[] = [];
  for (const [a, b, c] of tri) {
    const n = new THREE.Vector3().crossVectors(pts[b].clone().sub(pts[a]), pts[c].clone().sub(pts[a])).normalize();
    let g = groups.find(x => x.normal.dot(n) > 0.999);
    if (!g) groups.push(g = { normal: n, idx: new Set() });
    [a, b, c].forEach(i => g!.idx.add(i));
  }
  if (groups.length !== sides) throw new Error(`d${sides}: found ${groups.length} faces`);
  const faces: Face[] = groups.map(g => {
    const corners = [...g.idx].map(i => pts[i]);
    return { value: 0, normal: g.normal, corners, center: corners.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(corners.length) };
  });
  // number the faces: each face and its opposite get k and sides + 1 - k (a d4 has no opposite faces)
  let next = 1;
  for (const f of faces) {
    if (f.value) continue;
    f.value = next;
    const opp = faces.find(o => !o.value && o.normal.dot(f.normal) < -0.999);
    if (opp) opp.value = sides + 1 - next;
    next++;
    while (faces.some(o => o.value === next)) next++;
  }
  const physics = sides === 6 ? new CANNON.Box(new CANNON.Vec3(SIZE * 0.575, SIZE * 0.575, SIZE * 0.575))
    : new CANNON.ConvexPolyhedron({ vertices: pts.map(p => new CANNON.Vec3(p.x, p.y, p.z)), faces: tri });
  return { geometry, faces, physics };
}

// ---------------------------------------------------------------- numbers on the faces
const labelCache = new Map<string, THREE.Texture>();
function labelTexture(text: string): THREE.Texture {
  if (labelCache.has(text)) return labelCache.get(text)!;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8e171c"; g.font = "800 84px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 64, 68);
  if (text === "6" || text === "9") g.fillRect(40, 112, 48, 7); // tell 6 from 9
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(text, t); return t;
}
/** A flat number lying on a face, at `at`, readable with its top towards `up`. */
function label(text: string, at: THREE.Vector3, normal: THREE.Vector3, up: THREE.Vector3, size: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: labelTexture(text), transparent: true, depthWrite: false }));
  const y = up.clone().sub(normal.clone().multiplyScalar(up.dot(normal))).normalize(), x = new THREE.Vector3().crossVectors(y, normal);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, normal));
  m.position.copy(at).addScaledVector(normal, 0.004);
  return m;
}
function addLabels(mesh: THREE.Mesh, shape: DieShape, sides: Sides): void {
  const size = { 4: 0.42, 6: 0.55, 8: 0.5, 10: 0.42, 12: 0.42, 20: 0.36 }[sides] * SIZE * 1.6;
  for (const f of shape.faces) {
    if (sides === 4) {
      // a d4 shows, near each corner, the value you'd read if that corner were on top: the face opposite it
      for (const p of f.corners) {
        const opposite = shape.faces.find(o => !o.corners.some(q => q.distanceTo(p) < 1e-4))!;
        mesh.add(label(String(opposite.value), f.center.clone().lerp(p, 0.52), f.normal, p.clone().sub(f.center), size * 0.7));
      }
    } else {
      mesh.add(label(String(f.value), f.center, f.normal, f.corners[0].clone().sub(f.center), size));
    }
  }
}

// ---------------------------------------------------------------- the scene
const view = document.getElementById("view")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b1b1b");
// The view is a square (see dice.html), and so is the tray, seen from above at a slight angle.
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 13.5, 5.5); camera.lookAt(0, 0, 0.3);
scene.add(new THREE.HemisphereLight("#ffffff", "#444444", 1.6));
const sun = new THREE.DirectionalLight("#ffffff", 2.2);
sun.position.set(4, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
scene.add(sun);

const TRAY = { w: 8.5, d: 8.5 };
const floor = new THREE.Mesh(new THREE.PlaneGeometry(TRAY.w + 8, TRAY.d + 8), new THREE.MeshStandardMaterial({ color: "#2a3b2e", roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TRAY.w, 0.01, TRAY.d)), new THREE.LineBasicMaterial({ color: "#8e171c" }));
scene.add(rim);

// Physics. Dice only collide with the floor and walls, never with each other: dice knocking into each other kept
// some rolls from ever settling. Collision groups: the tray is group 1, dice are group 2 and only collide with group 1.
const TRAY_GROUP = 1, DICE_GROUP = 2;
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
world.allowSleep = true;
const feltMat = new CANNON.Material("felt"), diceMat = new CANNON.Material("dice");
world.addContactMaterial(new CANNON.ContactMaterial(feltMat, diceMat, { friction: 0.25, restitution: 0.35 }));
const trayBody = (shape: CANNON.Shape) => new CANNON.Body({ mass: 0, material: feltMat, shape, collisionFilterGroup: TRAY_GROUP, collisionFilterMask: DICE_GROUP });
const ground = trayBody(new CANNON.Plane());
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
// invisible walls round the tray
for (const [x, z, ry] of [[TRAY.w / 2, 0, -Math.PI / 2], [-TRAY.w / 2, 0, Math.PI / 2], [0, TRAY.d / 2, Math.PI], [0, -TRAY.d / 2, 0]]) {
  const wall = trayBody(new CANNON.Plane());
  wall.position.set(x, 0, z); wall.quaternion.setFromEuler(0, ry, 0); world.addBody(wall);
}

function resize(): void {
  const size = Math.round(Math.min(view.clientWidth, view.clientHeight)) || 1;
  renderer.setSize(size, size, false); camera.aspect = 1; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view); resize();

// ---------------------------------------------------------------- rolling
const shapes = new Map<Sides, DieShape>();
const shapeOf = (s: Sides) => { if (!shapes.has(s)) shapes.set(s, makeShape(s)); return shapes.get(s)! };
const SETTLE_MS = 8000; // after this, any die still moving is laid flat on its nearest face
interface Die { sides: Sides; mesh: THREE.Mesh; body: CANNON.Body }
let dice: Die[] = [], rolling = false, rollStart = 0, still = 0, pending: ((r: { values: number[]; forced: boolean }) => void) | null = null;

function clearDice(): void {
  for (const d of dice) { scene.remove(d.mesh); world.removeBody(d.body) }
  dice = [];
}
function throwDie(sides: Sides, i: number, n: number): Die {
  const shape = shapeOf(sides);
  const mesh = new THREE.Mesh(shape.geometry, new THREE.MeshStandardMaterial({ color: "#f3ead7", roughness: 0.45, metalness: 0.05, flatShading: true }));
  mesh.castShadow = true; addLabels(mesh, shape, sides); scene.add(mesh);
  const body = new CANNON.Body({
    mass: 1, material: diceMat, shape: shape.physics, collisionFilterGroup: DICE_GROUP, collisionFilterMask: TRAY_GROUP,
    sleepSpeedLimit: 0.12, sleepTimeLimit: 0.25, angularDamping: 0.08, linearDamping: 0.05,
  });
  // thrown from the left edge, spread across the tray so they rarely land on top of each other, with a random spin
  const lane = n > 1 ? (i / (n - 1) - 0.5) * (TRAY.d - 2.5) : 0;
  body.position.set(-TRAY.w / 2 + 1.2 + Math.random(), 2.5 + Math.random() * 1.5, lane + (Math.random() - 0.5) * 0.4);
  body.quaternion.setFromEuler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
  body.velocity.set(7 + Math.random() * 5, -2, (Math.random() - 0.5) * 4);
  body.angularVelocity.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
  world.addBody(body);
  return { sides, mesh, body };
}
/** The face being read: the one pointing most nearly up (for a d4, down, because a d4 is read at its top point). */
function readFace(d: Die): { face: Face; dot: number } {
  const q = d.mesh.quaternion, sign = d.sides === 4 ? -1 : 1, faces = shapeOf(d.sides).faces;
  let face = faces[0], dot = -Infinity;
  for (const f of faces) {
    const v = f.normal.clone().applyQuaternion(q).y * sign;
    if (v > dot) { dot = v; face = f }
  }
  return { face, dot };
}
/** Lay a die flat on the floor with its read face exactly up (for a d4, exactly down), and stop it. */
function layFlat(d: Die): void {
  const { face } = readFace(d), target = new THREE.Vector3(0, d.sides === 4 ? -1 : 1, 0);
  const turn = new THREE.Quaternion().setFromUnitVectors(face.normal.clone().applyQuaternion(d.mesh.quaternion).normalize(), target);
  const q = turn.multiply(d.mesh.quaternion.clone());
  // resting height: the centre sits as far above the floor as the face it rests on is from the centre
  const restFace = d.sides === 4 ? face : shapeOf(d.sides).faces.find(o => o.normal.dot(face.normal) < -0.999) || face;
  const clamp = (v: number, half: number) => Math.max(-half + 0.8, Math.min(half - 0.8, v));
  const x = clamp(d.body.position.x, TRAY.w / 2), z = clamp(d.body.position.z, TRAY.d / 2), y = restFace.center.dot(restFace.normal);
  d.body.position.set(x, y, z);
  d.body.quaternion.set(q.x, q.y, q.z, q.w);
  d.body.velocity.setZero(); d.body.angularVelocity.setZero(); d.body.sleep();
  d.mesh.position.set(x, y, z); d.mesh.quaternion.copy(q);
}
function roll(list: Sides[]): Promise<{ values: number[]; forced: boolean }> {
  clearDice();
  dice = list.map((s, i) => throwDie(s, i, list.length));
  rolling = true; rollStart = performance.now(); still = 0;
  return new Promise(res => { pending = res });
}

// ---------------------------------------------------------------- the loop, and settling
let last = performance.now(), frames = 0, fpsAt = last;
const fpsEl = document.getElementById("fps")!;
renderer.setAnimationLoop(now => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (rolling) {
    world.step(1 / 120, dt, 8);
    for (const d of dice) { d.mesh.position.copy(d.body.position as unknown as THREE.Vector3); d.mesh.quaternion.copy(d.body.quaternion as unknown as THREE.Quaternion) }
    const calm = dice.every(d => d.body.sleepState === CANNON.Body.SLEEPING || (d.body.velocity.length() < 0.05 && d.body.angularVelocity.length() < 0.05));
    still = calm ? still + 1 : 0;
    const flat = (d: Die) => readFace(d).dot > 0.98;
    // done when every die has stopped flat, or after SETTLE_MS: then any die still moving or tipped is laid flat
    if ((still > 8 && dice.every(flat)) || now - rollStart > SETTLE_MS) {
      const forced = dice.filter(d => !(calm && flat(d)));
      forced.forEach(layFlat);
      rolling = false;
      const res = pending; pending = null; res?.({ values: dice.map(d => readFace(d).face.value), forced: forced.length > 0 });
    }
  }
  renderer.render(scene, camera);
  frames++;
  if (now - fpsAt > 500) { fpsEl.textContent = `${Math.round(frames * 1000 / (now - fpsAt))} fps`; frames = 0; fpsAt = now }
});

// ---------------------------------------------------------------- the form
/** "2d6 + d20 - 1" -> the dice to throw and the number to add. Only NdM and plain numbers, joined by + or -. */
function parse(expr: string): { dice: Sides[]; terms: { sign: number; n: number; sides?: Sides }[]; mod: number } {
  const src = expr.replace(/\s+/g, "").toLowerCase();
  if (!src) throw new Error("Type a roll, such as 2d6 + 3.");
  const terms: { sign: number; n: number; sides?: Sides }[] = [], list: Sides[] = [];
  let mod = 0;
  const re = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gy;
  let m: RegExpExecArray | null, at = 0;
  while ((m = re.exec(src))) {
    if (!m[0]) break;
    at = re.lastIndex;
    const sign = m[1] === "-" ? -1 : 1;
    if (m[4]) { mod += sign * +m[4]; terms.push({ sign, n: +m[4] }); continue }
    const n = m[2] === "" ? 1 : +m[2], sides = +m[3] as Sides;
    if (!SIDES.includes(sides)) throw new Error(`There's no 3D d${m[3]} yet. Use d4, d6, d8, d10, d12 or d20.`);
    if (n < 1) throw new Error("Roll at least one die.");
    terms.push({ sign, n, sides });
    for (let i = 0; i < n; i++) list.push(sides);
  }
  if (at !== src.length) throw new Error(`I can't read "${src.slice(at)}". Keep and exploding dice aren't in this test yet.`);
  if (!list.length) throw new Error("There are no dice in that roll.");
  if (list.length > MAX_DICE) throw new Error(`Up to ${MAX_DICE} dice at once in this test.`);
  return { dice: list, terms, mod };
}

const form = document.getElementById("rollForm") as HTMLFormElement, input = document.getElementById("expr") as HTMLInputElement;
const out = document.getElementById("result")!, go = document.getElementById("go") as HTMLButtonElement;
document.getElementById("quick")!.addEventListener("click", e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-d]"); if (!b) return;
  input.value = `1${b.dataset.d}`; form.requestSubmit();
});
form.addEventListener("submit", async e => {
  e.preventDefault();
  let p; try { p = parse(input.value) } catch (x) { out.textContent = (x as Error).message; out.classList.add("bad"); return }
  out.classList.remove("bad"); out.textContent = "Rolling…"; go.disabled = true;
  const t0 = performance.now(), { values, forced } = await roll(p.dice), secs = ((performance.now() - t0) / 1000).toFixed(1);
  go.disabled = false;
  // put the values back into the terms they came from, keeping their order
  let i = 0;
  const parts = p.terms.map(t => {
    if (!t.sides) return `${t.sign < 0 ? "− " : "+ "}${t.n}`;
    const v = values.slice(i, i += t.n), sum = v.reduce((a, b) => a + b, 0);
    return `${t.sign < 0 ? "− " : "+ "}${t.n}d${t.sides} [${v.join(", ")}]${t.n > 1 ? " = " + sum : ""}`;
  });
  const total = p.terms.reduce((acc, t, k) => {
    if (!t.sides) return acc + t.sign * t.n;
    const before = p.terms.slice(0, k).reduce((c, x) => c + (x.sides ? x.n : 0), 0);
    return acc + t.sign * values.slice(before, before + t.n).reduce((a, b) => a + b, 0);
  }, 0);
  out.innerHTML = `<b>${total}</b><span>${parts.join(" ").replace(/^\+ /, "")}</span><small>${forced ? `Settled by the ${SETTLE_MS / 1000} s limit` : `Settled in ${secs} s`}</small>`;
});

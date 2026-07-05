/*
  The Living Blueprint — data structures drafted in 3D, with the algorithms
  that operate on them running live:
    HOME     → AVL tree: inserts + animated rotations, periodic BST search
               (the lookup path pulses from root to target)
    ABOUT    → circular linked list: a traversal pulse walks the ring
    PROJECTS → graph: BFS waves ripple out from random source nodes
    SKILLS   → array: a live bubble sort — compares, swaps, resorts forever
    RESUME   → queue: FIFO dequeue → re-enqueue cycle
    CONTACT  → spiral: a pulse travels outward along the chain
  The structure is physical: clicking anywhere sends a shockwave through it,
  and scrolling tugs it elastically. Nodes carry their real values as labels
  (visible on the tree and array sheets, where ordering means something).
  Built with Three.js (ES module via importmap), same setup as Petal Lounge.
*/
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const canvas = document.getElementById("bg3d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!canvas || reducedMotion) {
  canvas?.remove();
} else if (window.innerWidth >= 768) {
  init();
} else {
  // Hidden/pre-rendered windows report tiny widths at load; phones can also
  // rotate. Wait for the first real desktop-sized viewport before starting.
  const onResize = () => {
    if (window.innerWidth >= 768) {
      window.removeEventListener("resize", onResize);
      init();
    }
  };
  window.addEventListener("resize", onResize);
}

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  // ---- custom post-processing: the "drafting lens" ----
  // chromatic aberration boosted by scroll velocity, hologram scanlines,
  // film grain, and a screen-space ripple synced with the click shockwave
  const DraftingShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uVel: { value: 0 },
      uRipple: { value: 0 },
      uRippleC: { value: new THREE.Vector2(0.5, 0.5) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uVel;
      uniform float uRipple;
      uniform vec2 uRippleC;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        // click ripple: a ring of refraction expanding from the click point
        float d = distance(uv, uRippleC);
        float wave = sin(d * 42.0 - uTime * 16.0) * exp(-d * 6.0) * uRipple * 0.014;
        uv += normalize(uv - uRippleC + 1e-4) * wave;
        // chromatic aberration, radial + velocity boosted
        vec2 dir = uv - 0.5;
        float ca = 0.0014 + uVel * 0.006 + uRipple * 0.004;
        vec4 cc = texture2D(tDiffuse, uv);
        vec4 cr = texture2D(tDiffuse, uv - dir * ca);
        vec4 cb = texture2D(tDiffuse, uv + dir * ca);
        vec3 col = vec3(cr.r, cc.g, cb.b);
        // hologram scanlines
        col *= 1.0 - 0.045 * sin(uv.y * 850.0 + uTime * 2.0);
        // film grain, only where the structure is
        float g = fract(sin(dot(uv, vec2(12.9898, 78.233)) + uTime * 61.7) * 43758.5453);
        col += (g - 0.5) * 0.06 * cc.a;
        float a = max(cc.a, max(cr.a, cb.a));
        gl_FragColor = vec4(col, a);
      }`,
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d2440, 24, 46);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(4, 1.5, 44); // fly-in start; eases to (0,0,30)
  let introStart = null;

  const treeGroup = new THREE.Group();
  treeGroup.rotation.y = 0.55;      // settles via the ambient-drift lerp
  scene.add(treeGroup);

  // multimeter probe: an amber wire from the cursor to the nearest node
  const probeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const probeMat = new THREE.LineBasicMaterial({ color: 0xffc24b, transparent: true, opacity: 0 });
  scene.add(new THREE.Line(probeGeo, probeMat));
  let pointerActive = false;

  // composer chain: scene render → drafting lens
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const lensPass = new ShaderPass(DraftingShader);
  composer.addPass(lensPass);
  const lensU = lensPass.uniforms;
  let velBoost = 0;

  // ---- palette ----
  const LINE_BLUE = new THREE.Color(0x8fb9e8);
  const AMBER = new THREE.Color(0xffc24b);

  const nodeGeo = new THREE.OctahedronGeometry(0.34);

  // ---- AVL tree (pure data structure) ----
  const H = (n) => (n ? n.h : 0);
  const bal = (n) => H(n.l) - H(n.r);
  const upd = (n) => { n.h = 1 + Math.max(H(n.l), H(n.r)); return n; };
  const rotR = (y) => { const x = y.l; y.l = x.r; x.r = y; upd(y); return upd(x); };
  const rotL = (x) => { const y = x.r; x.r = y.l; y.l = x; upd(x); return upd(y); };

  function insert(n, v) {
    if (!n) return { v, l: null, r: null, h: 1 };
    if (v < n.v) n.l = insert(n.l, v);
    else n.r = insert(n.r, v);
    upd(n);
    const b = bal(n);
    if (b > 1 && v < n.l.v) return rotR(n);
    if (b < -1 && v > n.r.v) return rotL(n);
    if (b > 1) { n.l = rotL(n.l); return rotR(n); }
    if (b < -1) { n.r = rotR(n.r); return rotL(n); }
    return n;
  }

  // ---- visual state ----
  const MAX_NODES = 31;       // tree scatters + regrows at this size
  const FILL_NODES = 24;      // formations fast-fill to this size
  const TREE_EVERY = 2.2;     // seconds between inserts on the home sheet
  const FILL_EVERY = 0.3;     // fast-fill cadence while off the home sheet
  const Y_TOP = 6.5;
  const ROW_H = 2.3;

  let root = null;
  let values = [];
  let nextIdx = 0;
  const nodes = new Map();  // value -> { mesh, mat, pos, disp, dvel, pulse, label, labelMat, target, born, vel }
  const edges = new Map();  // "pv>cv" -> { line, geo, mat, born, parent, child }
  let state = "grow";       // grow | scatter | pause
  let stateT = 0;
  let scatterFade = 1;
  let clockAcc = TREE_EVERY; // insert first node immediately
  let last = 0;

  // formation morphing, driven by main.js sheetchange events
  const FORMATIONS = { home: "tree", about: "ring", projects: "graph", skills: "array", resume: "queue", contact: "spiral" };
  let formation = "tree";
  let edgeSig = "";          // formation + node count → rebuild edges when it changes
  let graphPairs = [];       // cached nearest-neighbour pairs for the graph formation
  let algo = null;           // per-formation algorithm animation state
  let arrayOrder = [];       // element order for the bubble-sort formation
  let queueOrder = [];       // FIFO order for the queue formation
  document.addEventListener("sheetchange", (e) => {
    const next = FORMATIONS[e.detail.id] || "tree";
    if (next === formation) return;
    formation = next;
    algo = null;
    if (formation === "array") arrayOrder = shuffled([...nodes.keys()]);
    if (formation === "queue") queueOrder = [...nodes.keys()];
    edgeSig = "";
  });

  const jitterZ = (v) => (((v * 37) % 17) - 8) / 10; // deterministic depth wobble
  const hash = (v, s) => {
    const x = Math.sin(v * 12.9898 + s * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const shuffled = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function shuffleValues() {
    values = shuffled(Array.from({ length: 95 }, (_, i) => i + 5));
    nextIdx = 0;
  }
  shuffleValues();

  // ---- value labels (canvas-texture sprites) ----
  function makeLabel(v) {
    const c = document.createElement("canvas");
    c.width = 96; c.height = 48;
    const g = c.getContext("2d");
    g.font = "500 26px 'IBM Plex Mono', monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#cfe3f7";
    g.fillText(String(v), 48, 26);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.75, 1);
    return { sprite, mat };
  }
  let labelVis = 1; // labels matter where ordering matters: tree + array

  // ---- tree layout (AVL positions) ----
  function layoutTree() {
    const list = [];
    let ix = 0;
    (function walk(n, d) {
      if (!n) return;
      walk(n.l, d + 1);
      list.push([n, d, ix++]);
      walk(n.r, d + 1);
    })(root, 0);

    const count = list.length;
    const spacing = Math.min(1.15, 26 / Math.max(count, 1));
    for (const [n, d, i] of list) {
      const obj = nodes.get(n.v);
      if (!obj) continue;
      obj.target.set((i - (count - 1) / 2) * spacing, Y_TOP - d * ROW_H, jitterZ(n.v));
    }
  }

  function treePairs() {
    const pairs = [];
    (function walk(n) {
      if (!n) return;
      if (n.l) pairs.push([n.v, n.l.v]);
      if (n.r) pairs.push([n.v, n.r.v]);
      walk(n.l); walk(n.r);
    })(root);
    return pairs;
  }

  // ---- formation layouts (targets recomputed every frame; cheap at ≤31 nodes) ----
  function layoutFormation(t) {
    const list = [...nodes.entries()];                       // insertion order
    const byValue = list.slice().sort((a, b) => a[0] - b[0]); // sorted order
    const n = list.length;
    if (!n) return [];

    if (formation === "ring") {
      const r = 8.5;
      byValue.forEach(([v, o], i) => {
        const a = (i / n) * Math.PI * 2 + t * 0.15;
        o.target.set(Math.cos(a) * r, Math.sin(a) * r * 0.8, jitterZ(v));
      });
      return byValue.map(([v], i) => [v, byValue[(i + 1) % n][0]]);
    }

    if (formation === "array") {
      // order comes from the live bubble sort, height encodes value
      for (const v of nodes.keys()) if (!arrayOrder.includes(v)) arrayOrder.push(v);
      arrayOrder = arrayOrder.filter((v) => nodes.has(v));
      const m = arrayOrder.length;
      const spacing = Math.min(1.3, 30 / m);
      arrayOrder.forEach((v, i) => {
        const o = nodes.get(v);
        const x = (i - (m - 1) / 2) * spacing;
        const y = ((v - 5) / 94) * 9 - 4.5;
        o.target.set(x, y, jitterZ(v));
      });
      return [];                                             // bars, no edges
    }

    if (formation === "graph") {
      list.forEach(([v, o]) => {
        o.target.set((hash(v, 1) - 0.5) * 24, (hash(v, 2) - 0.5) * 13, (hash(v, 3) - 0.5) * 6);
      });
      // nearest-2 edges, cached until node count changes (positions are static)
      if (graphPairs.sig !== n) {
        const pts = list.map(([v, o]) => [v, o.target]);
        const set = new Set();
        for (const [v, p] of pts) {
          const near = pts
            .filter(([w]) => w !== v)
            .sort((a, b) => a[1].distanceToSquared(p) - b[1].distanceToSquared(p))
            .slice(0, 2);
          for (const [w] of near) set.add(v < w ? `${v}>${w}` : `${w}>${v}`);
        }
        graphPairs = [...set].map((k) => k.split(">").map(Number));
        graphPairs.sig = n;
      }
      return graphPairs;
    }

    if (formation === "queue") {
      for (const v of nodes.keys()) if (!queueOrder.includes(v)) queueOrder.push(v);
      queueOrder = queueOrder.filter((v) => nodes.has(v));
      const m = queueOrder.length;
      const spacing = Math.min(1.4, 30 / m);
      queueOrder.forEach((v, i) => {
        const o = nodes.get(v);
        const x = (i - (m - 1) / 2) * spacing;
        o.target.set(x, Math.sin(t * 1.2 + i * 0.55) * 1.6, jitterZ(v));
      });
      return queueOrder.slice(0, -1).map((v, i) => [v, queueOrder[i + 1]]);
    }

    if (formation === "spiral") {
      list.forEach(([v, o], i) => {
        const a = i * 0.55 + t * 0.25;
        const r = 1.2 + i * 0.34;
        o.target.set(Math.cos(a) * r, Math.sin(a) * r * 0.85, (i - n / 2) * 0.12);
      });
      return list.slice(0, -1).map(([v], i) => [v, list[i + 1][0]]);
    }

    return null; // tree — handled by layoutTree/treePairs
  }

  // ---- the algorithms, animated ----
  const firePulse = (v, strength = 1) => {
    const o = nodes.get(v);
    if (o) o.pulse = Math.max(o.pulse, strength);
  };

  function runAlgorithms(t) {
    if (state !== "grow" || nodes.size < 3) return;

    if (formation === "tree") {
      // periodic BST search: the lookup path pulses root → target
      if (!algo) algo = { kind: "search", path: [], i: 0, nextAt: t + 4 };
      if (algo.i >= algo.path.length && t >= algo.nextAt) {
        const keys = [...nodes.keys()];
        const target = keys[Math.floor(Math.random() * keys.length)];
        const path = [];
        let n = root;
        while (n) {
          path.push(n.v);
          if (target === n.v) break;
          n = target < n.v ? n.l : n.r;
        }
        algo = { kind: "search", path, i: 0, nextAt: t + 0.01 };
      }
      if (algo.i < algo.path.length && t >= algo.nextAt) {
        firePulse(algo.path[algo.i], algo.i === algo.path.length - 1 ? 1 : 0.7);
        algo.i++;
        algo.nextAt = t + 0.35;
        if (algo.i >= algo.path.length) algo.nextAt = t + 6; // rest, then new search
      }
      return;
    }

    if (formation === "ring" || formation === "spiral") {
      // traversal: a pulse walks the chain node by node
      if (!algo) algo = { kind: "walk", i: 0, nextAt: t };
      if (t >= algo.nextAt) {
        const order = formation === "ring"
          ? [...nodes.keys()].sort((a, b) => a - b)
          : [...nodes.keys()];
        firePulse(order[algo.i % order.length], 0.8);
        algo.i++;
        algo.nextAt = t + 0.26;
      }
      return;
    }

    if (formation === "graph") {
      // BFS: waves of pulses ripple outward from a random source
      if (!algo) algo = { kind: "bfs", waves: [], nextAt: t + 1 };
      if (!algo.waves.length && t >= algo.nextAt) {
        const adj = new Map();
        for (const [a, b] of graphPairs) {
          if (!adj.has(a)) adj.set(a, []);
          if (!adj.has(b)) adj.set(b, []);
          adj.get(a).push(b);
          adj.get(b).push(a);
        }
        const keys = [...nodes.keys()];
        const src = keys[Math.floor(Math.random() * keys.length)];
        const level = new Map([[src, 0]]);
        const q = [src];
        while (q.length) {
          const u = q.shift();
          for (const w of adj.get(u) || []) {
            if (!level.has(w)) { level.set(w, level.get(u) + 1); q.push(w); }
          }
        }
        algo.waves = [...level.entries()].map(([v, l]) => ({ v, at: t + l * 0.3 }));
      }
      algo.waves = algo.waves.filter((w) => {
        if (t >= w.at) { firePulse(w.v, 1); return false; }
        return true;
      });
      if (!algo.waves.length && algo.nextAt < t) algo.nextAt = t + 3.5;
      return;
    }

    if (formation === "array") {
      // live bubble sort: compare, swap, repeat; reshuffle when sorted
      if (!algo) algo = { kind: "sort", i: 0, swapped: false, nextAt: t + 0.8, restUntil: 0 };
      if (t < algo.restUntil || t < algo.nextAt || arrayOrder.length < 2) return;
      if (algo.i >= arrayOrder.length - 1) {
        if (!algo.swapped) {                     // sorted — admire, then reshuffle
          algo.restUntil = t + 3;
          arrayOrder = shuffled(arrayOrder);
          algo.i = 0;
          algo.swapped = false;
          algo.nextAt = t + 3.6;
          return;
        }
        algo.i = 0;
        algo.swapped = false;
      }
      const a = arrayOrder[algo.i], b = arrayOrder[algo.i + 1];
      firePulse(a, 0.45); firePulse(b, 0.45);    // comparison flash
      if (a > b) {
        [arrayOrder[algo.i], arrayOrder[algo.i + 1]] = [b, a];
        firePulse(a, 1); firePulse(b, 1);        // swap flash
        algo.swapped = true;
      }
      algo.i++;
      algo.nextAt = t + 0.16;
      return;
    }

    if (formation === "queue") {
      // FIFO: the front node dequeues, hops, and re-enqueues at the back
      if (!algo) algo = { kind: "fifo", nextAt: t + 2 };
      if (t >= algo.nextAt && queueOrder.length > 2) {
        const front = queueOrder.shift();
        queueOrder.push(front);
        firePulse(front, 1);
        const o = nodes.get(front);
        if (o) o.dvel.y += 5;                    // celebratory hop
        edgeSig = "";                            // chain edges changed
        algo.nextAt = t + 2.6;
      }
    }
  }

  function syncEdges(pairs, now) {
    const wanted = new Set();
    for (const [pv, cv] of pairs) {
      const key = `${pv}>${cv}`;
      wanted.add(key);
      if (!edges.has(key)) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const mat = new THREE.LineBasicMaterial({ color: LINE_BLUE, transparent: true, opacity: 0 });
        const line = new THREE.Line(geo, mat);
        treeGroup.add(line);
        edges.set(key, { line, geo, mat, born: now, parent: pv, child: cv });
      }
    }
    for (const [key, e] of edges) {
      if (!wanted.has(key)) {
        treeGroup.remove(e.line);
        e.geo.dispose();
        e.mat.dispose();
        edges.delete(key);
      }
    }
  }

  function insertNext(now) {
    if (nextIdx >= values.length) shuffleValues();
    const v = values[nextIdx++];
    root = insert(root, v);

    const mat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0, color: AMBER });
    const mesh = new THREE.Mesh(nodeGeo, mat);
    const { sprite, mat: labelMat } = makeLabel(v);
    const obj = {
      mesh, mat, target: new THREE.Vector3(), born: now, vel: null,
      pos: new THREE.Vector3(), disp: new THREE.Vector3(), dvel: new THREE.Vector3(),
      pulse: 0, probeGlow: 0, label: sprite, labelMat,
    };
    nodes.set(v, obj);
    treeGroup.add(mesh);
    treeGroup.add(sprite);

    layoutTree();
    // new node drops in from above its final slot
    obj.pos.set(obj.target.x, Y_TOP + 4, obj.target.z);
    mesh.position.copy(obj.pos);
    if (formation === "tree") syncEdges(treePairs(), now);
    if (formation === "array" && !arrayOrder.includes(v)) arrayOrder.push(v);
    if (formation === "queue" && !queueOrder.includes(v)) queueOrder.push(v);
    edgeSig = ""; // force formation edge rebuild on next frame
  }

  function resetTree() {
    for (const obj of nodes.values()) {
      treeGroup.remove(obj.mesh);
      treeGroup.remove(obj.label);
      obj.mat.dispose();
      obj.labelMat.map.dispose();
      obj.labelMat.dispose();
    }
    nodes.clear();
    syncEdges([], 0);
    root = null;
    scatterFade = 1;
    algo = null;
    arrayOrder = [];
    queueOrder = [];
  }

  // ---- interaction inputs ----
  let mx = 0, my = 0;                 // mouse parallax (-0.5..0.5)
  window.addEventListener("pointermove", (e) => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
    pointerActive = true;
  }, { passive: true });

  // clicks send a physical shockwave through the structure
  const clickWorld = new THREE.Vector3();
  const localClick = new THREE.Vector3();
  const pushDir = new THREE.Vector3();
  window.addEventListener("pointerdown", (e) => {
    // screen-space ripple in the drafting lens, synced with the 3D shockwave
    lensU.uRipple.value = 1;
    lensU.uRippleC.value.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    clickWorld.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    const dist = -camera.position.z / clickWorld.z;
    if (!isFinite(dist) || dist <= 0) return;
    clickWorld.multiplyScalar(dist).add(camera.position);   // point on z=0 plane
    localClick.copy(clickWorld);
    treeGroup.worldToLocal(localClick);
    for (const obj of nodes.values()) {
      pushDir.copy(obj.pos).sub(localClick);
      const d = pushDir.length();
      const strength = Math.max(0, 1 - d / 14) * 7;
      if (strength <= 0) continue;
      pushDir.normalize().multiplyScalar(strength);
      obj.dvel.add(pushDir);
    }
  }, { passive: true });

  let scrollP = 0;                    // 0 at hero top → 1 past hero
  let lastScrollY = window.scrollY;
  const onScroll = () => {
    scrollP = Math.min(1, window.scrollY / Math.max(window.innerHeight, 1));
    // elastic tug: fast scrolling drags the structure with it
    const dy = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    const tug = Math.max(-2.5, Math.min(2.5, dy * 0.01));
    for (const obj of nodes.values()) obj.dvel.y += tug;
    velBoost = Math.min(1, Math.abs(dy) / 90);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  const NODE_BASE = 0.9;
  const EDGE_BASE = 0.5;
  const LABEL_BASE = 0.8;
  const tmpV = new THREE.Vector3();
  const probeWp = new THREE.Vector3();
  const bestBuf = new THREE.Vector3();
  let dimCur = 1;
  let posYCur = -0.5;

  function tick(timeMs) {
    const t = timeMs / 1000;
    const dt = Math.min(Math.max(t - last, 0), 0.05);
    last = t;

    // cinematic fly-in: dive into the drawing over the first ~2.2s;
    // scroll.js sets __camPush (0..1) while the hero unpins, pushing the
    // camera THROUGH the structure as the visitor scrolls out of the hero
    if (introStart === null) introStart = t;
    const ip = Math.min(1, (t - introStart) / 2.2);
    const ease = 1 - Math.pow(1 - ip, 3);
    const push = window.__camPush || 0;
    camera.position.set(
      4 * (1 - ease),
      1.5 * (1 - ease) - push * 2,
      44 - 14 * ease - push * 13
    );
    camera.lookAt(0, 0, 0);

    // state machine: tree grows slowly at home, fast-fills off-home,
    // scatters + regrows only on the home sheet
    if (state === "grow") {
      const cadence = formation === "tree" ? TREE_EVERY : FILL_EVERY;
      const capacity = formation === "tree" ? MAX_NODES : FILL_NODES;
      if (nodes.size < capacity) {
        clockAcc += dt;
        if (clockAcc >= cadence) {
          clockAcc = 0;
          insertNext(t);
        }
      }
      if (formation === "tree" && nodes.size >= MAX_NODES) { state = "scatter"; stateT = 0; }
    } else if (state === "scatter") {
      stateT += dt;
      scatterFade = Math.max(0, 1 - stateT / 1.4);
      for (const obj of nodes.values()) {
        if (!obj.vel) {
          obj.vel = new THREE.Vector3(
            (Math.random() - 0.5) * 7,
            (Math.random() - 0.3) * 7,
            (Math.random() - 0.5) * 5
          );
        }
        obj.pos.addScaledVector(obj.vel, dt);
        obj.mesh.rotation.x += dt * 2;
        obj.mesh.rotation.z += dt * 1.4;
      }
      if (scatterFade <= 0) { resetTree(); state = "pause"; stateT = 0; }
    } else if (state === "pause") {
      stateT += dt;
      if (stateT > 1) { state = "grow"; clockAcc = TREE_EVERY; }
    }

    // layout + edges for the active formation
    if (state !== "scatter") {
      if (formation === "tree") {
        layoutTree();
        const sig = `tree:${nodes.size}`;
        if (edgeSig !== sig) { syncEdges(treePairs(), t); edgeSig = sig; }
      } else {
        const pairs = layoutFormation(t);
        const sig = `${formation}:${nodes.size}`;
        if (pairs && edgeSig !== sig) { syncEdges(pairs, t); edgeSig = sig; }
      }
    }

    // run the formation's algorithm animation
    runAlgorithms(t);

    // visibility: full at hero, ambient (but present) behind other sheets
    const dimTarget = formation === "tree" ? 1 - 0.8 * scrollP : 0.5;
    dimCur += (dimTarget - dimCur) * 0.04;
    const posYTarget = formation === "tree" ? scrollP * 5 - 0.5 : 0;
    posYCur += (posYTarget - posYCur) * 0.04;
    // labels show where ordering means something: the tree and the sort
    const labelTarget = (formation === "tree" || formation === "array") ? 1 : 0;
    labelVis += (labelTarget - labelVis) * 0.05;

    // nodes: glide to target + shockwave physics, pulse, cool amber → blue
    const glide = 1 - Math.pow(0.002, dt);
    const dampV = Math.pow(0.02, dt);
    const dampD = Math.pow(0.05, dt);
    for (const obj of nodes.values()) {
      if (state !== "scatter") obj.pos.lerp(obj.target, glide);
      obj.disp.addScaledVector(obj.dvel, dt);
      obj.dvel.multiplyScalar(dampV);
      obj.disp.multiplyScalar(dampD);
      obj.mesh.position.copy(obj.pos).add(obj.disp);

      obj.pulse *= Math.pow(0.05, dt);
      if (obj.pulse < 0.01) obj.pulse = 0;
      obj.probeGlow *= Math.pow(0.02, dt);
      if (obj.probeGlow < 0.01) obj.probeGlow = 0;
      const age = t - obj.born;
      const bornMix = Math.max(0, 1 - age / 2);
      obj.mat.color.lerpColors(LINE_BLUE, AMBER, Math.max(bornMix, obj.pulse, obj.probeGlow * 0.9));
      obj.mesh.scale.setScalar(1 + obj.pulse * 0.8 + obj.probeGlow * 0.3);

      const bornFade = Math.min(1, age / 0.5);
      obj.mat.opacity = Math.min(1, NODE_BASE * bornFade * dimCur * scatterFade * (1 + obj.pulse * 0.4 + obj.probeGlow * 0.5));
      obj.mesh.rotation.y = t * 0.4 + obj.target.x * 0.15;

      obj.label.position.set(obj.mesh.position.x + 0.55, obj.mesh.position.y + 0.62, obj.mesh.position.z + 0.1);
      // the probe reveals a node's value even where labels are normally hidden
      obj.labelMat.opacity = LABEL_BASE * bornFade * dimCur * scatterFade * Math.max(labelVis, obj.probeGlow);
    }

    // edges: draw in from parent toward child, endpoints track moving nodes
    for (const e of edges.values()) {
      const p = nodes.get(e.parent);
      const c = nodes.get(e.child);
      if (!p || !c) continue;
      const drawn = Math.min(1, (t - e.born) / 0.6);
      tmpV.copy(p.mesh.position).lerp(c.mesh.position, drawn);
      const pos = e.geo.attributes.position;
      pos.setXYZ(0, p.mesh.position.x, p.mesh.position.y, p.mesh.position.z);
      pos.setXYZ(1, tmpV.x, tmpV.y, tmpV.z);
      pos.needsUpdate = true;
      const pulseGlow = Math.max(p.pulse, c.pulse) * 0.4;
      e.mat.opacity = Math.min(1, (EDGE_BASE + pulseGlow) * drawn * dimCur * scatterFade);
    }

    // ambient drift + parallax + scroll response
    treeGroup.rotation.y += ((Math.sin(t * 0.12) * 0.12 + mx * 0.3) - treeGroup.rotation.y) * 0.04;
    treeGroup.rotation.x += ((my * 0.15) - treeGroup.rotation.x) * 0.04;
    treeGroup.position.y = posYCur;

    // multimeter probe: connect the cursor to the nearest node
    let probeTarget = 0;
    if (pointerActive && state !== "scatter") {
      tmpV.set(mx * 2, -(my * 2), 0.5).unproject(camera).sub(camera.position).normalize();
      const pDist = -camera.position.z / tmpV.z;
      if (isFinite(pDist) && pDist > 0) {
        tmpV.multiplyScalar(pDist).add(camera.position); // cursor on z=0 plane
        let best = null;
        let bestD = 4.5;                                  // reach in world units
        for (const obj of nodes.values()) {
          probeWp.copy(obj.mesh.position);
          treeGroup.localToWorld(probeWp);
          const d = probeWp.distanceTo(tmpV);
          if (d < bestD) { bestD = d; best = obj; bestBuf.copy(probeWp); }
        }
        if (best) {
          best.probeGlow = 1;
          const pp = probeGeo.attributes.position;
          pp.setXYZ(0, bestBuf.x, bestBuf.y, bestBuf.z);
          pp.setXYZ(1, tmpV.x, tmpV.y, tmpV.z);
          pp.needsUpdate = true;
          probeTarget = 0.75 * scatterFade;
        }
      }
    }
    probeMat.opacity += (probeTarget - probeMat.opacity) * 0.25;

    // drafting-lens uniforms: time, decaying scroll velocity, ripple
    lensU.uTime.value = t;
    lensU.uVel.value += (velBoost - lensU.uVel.value) * 0.12;
    velBoost *= Math.pow(0.02, dt);
    lensU.uRipple.value = Math.max(0, lensU.uRipple.value - dt * 1.1);

    composer.render();
  }

  renderer.setAnimationLoop(tick);
  document.addEventListener("visibilitychange", () => {
    renderer.setAnimationLoop(document.hidden ? null : tick);
  });
}

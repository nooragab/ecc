// Global state
let currentPrivateKey = null
let currentPublicKey = null
let currentCiphertext = null
let bgAnimationEnabled = true

// 3D Scene Managers
const scenes = {
  hero: null,
  keygen: null,
  encrypt: null,
  decrypt: null
};

// UI Helpers
function clearSteps(containerId) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = "";
}

function addLiveStep(containerId, stepNum, title, desc) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const card = document.createElement("div");
  card.className = "live-step-card";
  card.innerHTML = `
    <div class="live-step-header">
      <div class="live-step-num">${stepNum}</div>
      <div class="live-step-title">${title}</div>
    </div>
    <div class="live-step-desc">${desc}</div>
  `;
  container.appendChild(card);
  // Scroll within the steps panel, not the whole page
  container.scrollTop = container.scrollHeight;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============ PAGE NAVIGATION ============
function showPage(pageName) {
  const pages = document.querySelectorAll(".page")
  const navLinks = document.querySelectorAll(".nav-link")
  pages.forEach((page) => page.classList.remove("active"))
  navLinks.forEach((link) => link.classList.remove("active"))
  document.getElementById(pageName).classList.add("active")
  const activeLink = Array.from(navLinks).find(link => link.getAttribute('onclick') && link.getAttribute('onclick').includes(pageName));
  if (activeLink) activeLink.classList.add("active");
  setTimeout(() => {
    if (pageName === "home") initHeroScene();
    if (pageName === "keygen") initKeyGenScene();
    if (pageName === "encrypt") initEncryptScene();
    if (pageName === "decrypt") initDecryptScene();
    if (pageName === "resources") initSourcesScene();
  }, 100);
}

// ============ BACKGROUND TOGGLE ============
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById("bg-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      bgAnimationEnabled = !bgAnimationEnabled;
      toggleBtn.style.opacity = bgAnimationEnabled ? "1" : "0.5";
    });
  }
  initHeroScene();
  initBgCanvas();
});

// Background canvas — subtle dot grid
function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const spacing = 32;
    ctx.fillStyle = 'rgba(45,58,30,0.25)';
    for (let x = 0; x < canvas.width; x += spacing) {
      for (let y = 0; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  drawGrid();
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawGrid();
  });
}

// ============ 3D SCENE CLASS ============
class ECCScene3D {
  constructor(containerId, colorTheme = 0x2d3a1e) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.theme = colorTheme;
    this.labels = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f2eb);

    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.1, 1000);
    this.camera.position.z = 12;
    this.camera.position.y = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Lighting — warm ambient
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xfff8e8, 1.5);
    dirLight.position.set(10, 10, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
    const fillLight = new THREE.PointLight(this.theme, 1, 40);
    fillLight.position.set(-5, 5, 8);
    this.scene.add(fillLight);

    this.curveGroup = new THREE.Group();
    this.scene.add(this.curveGroup);
    this.elementsGroup = new THREE.Group();
    this.scene.add(this.elementsGroup);

    this.mouseX = 0;
    this.mouseY = 0;

    window.addEventListener('resize', () => this.onResize());
    this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));

    this.initCurve();
    this.animate = this.animate.bind(this);
    this.animate();
  }

  onResize() {
    if (!this.container) return;
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  onMouseMove(event) {
    const rect = this.container.getBoundingClientRect();
    this.mouseX = ((event.clientX - rect.left) / this.width) * 2 - 1;
    this.mouseY = -((event.clientY - rect.top) / this.height) * 2 + 1;
  }

  initCurve() {
    // ECC curve y^2 = x^3 + 7 in olive/dark green
    const topPoints = [];
    const botPoints = [];
    const scale = 1.5;
    for (let x = -1.9; x <= 4; x += 0.04) {
      const y2 = Math.pow(x, 3) + 7;
      if (y2 >= 0) {
        const y = Math.sqrt(y2);
        topPoints.push(new THREE.Vector3(x * scale, y * scale, 0));
        botPoints.push(new THREE.Vector3(x * scale, -y * scale, 0));
      }
    }

    const curveMat = new THREE.LineBasicMaterial({ color: this.theme, transparent: true, opacity: 0.8, linewidth: 3 });
    this.curveGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(topPoints), curveMat));
    this.curveGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(botPoints), curveMat));

    // Axes
    const axisMat = new THREE.LineBasicMaterial({ color: 0xc8b87a, transparent: true, opacity: 0.4 });
    const xAxis = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0)]);
    const yAxis = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -10, 0), new THREE.Vector3(0, 10, 0)]);
    this.scene.add(new THREE.Line(xAxis, axisMat));
    this.scene.add(new THREE.Line(yAxis, axisMat));

    // Light grid
    const gridHelper = new THREE.GridHelper(30, 30, 0xddd9ce, 0xe8e4dc);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1;
    this.scene.add(gridHelper);
  }

  addPoint(x, y, color = 0x2d3a1e, scale = 1) {
    const geometry = new THREE.SphereGeometry(0.28 * scale, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.2,
      shininess: 80,
      specular: 0xffffff
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, 0);
    sphere.castShadow = true;
    this.elementsGroup.add(sphere);
    sphere.userData = { initialScale: scale, time: Math.random() * 100 };
    return sphere;
  }

  addLabel(text, position, color = '#2d3a1e') {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'scene-label';
    labelDiv.textContent = text;
    labelDiv.style.color = color;
    labelDiv.style.position = 'absolute';
    this.container.appendChild(labelDiv);
    this.labels.push({ div: labelDiv, position: position });
    return labelDiv;
  }

  updateLabels() {
    this.labels.forEach(label => {
      const pos = label.position.clone();
      pos.project(this.camera);
      const x = (pos.x * .5 + .5) * this.width;
      const y = (pos.y * -.5 + .5) * this.height;
      label.div.style.left = `${x}px`;
      label.div.style.top = `${y}px`;
      label.div.style.opacity = pos.z > 1 ? 0 : 1;
    });
  }

  clearElements() {
    while (this.elementsGroup.children.length > 0) {
      const child = this.elementsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.elementsGroup.remove(child);
    }
    this.labels.forEach(l => l.div.remove());
    this.labels = [];
  }

  async tracePath(start, end, color = 0x2d3a1e) {
    // Arc through a midpoint lifted above the straight line
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2 + 1.8,
      (start.z + end.z) / 2
    );
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geometry = new THREE.TubeGeometry(curve, 40, 0.05, 8, false);
    const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    this.elementsGroup.add(mesh);
    // Animate a travelling dot along the arc
    const dotGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const dotMat = new THREE.MeshPhongMaterial({ color: color, emissive: color, emissiveIntensity: 0.6 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    this.elementsGroup.add(dot);
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      material.opacity = (i / steps) * 0.85;
      const pt = curve.getPoint(i / steps);
      dot.position.set(pt.x, pt.y, pt.z);
      await sleep(18);
    }
    this.elementsGroup.remove(dot);
    dotGeo.dispose(); dotMat.dispose();
    return mesh;
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.camera.position.x += (this.mouseX * 4 - this.camera.position.x) * 0.05;
    this.camera.position.y += (this.mouseY * 2 - this.camera.position.y) * 0.05;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    this.elementsGroup.children.forEach(mesh => {
      if (mesh.userData && mesh.userData.time !== undefined) {
        mesh.userData.time += 0.04;
        const s = mesh.userData.initialScale + Math.sin(mesh.userData.time) * 0.08;
        mesh.scale.set(s, s, s);
      }
    });
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  }
}

// ============ HERO SCENE — ECC curve + orbiting spheres, no bounding box ============
function initHeroScene() {
  const container = document.getElementById("hero-3d-container");
  if (!container) return;

  // If already built, just resize to current container dimensions and return
  if (scenes.hero) {
    const { renderer, camera } = scenes.hero;
    requestAnimationFrame(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    return;
  }

  // Transparent renderer — no background, blends into page
  const scene = new THREE.Scene();
  // no scene.background → transparent

  const initAspect = (container.clientWidth || window.innerWidth * 0.5) / (container.clientHeight || window.innerHeight * 0.85);
  const camera = new THREE.PerspectiveCamera(55, initAspect, 0.1, 1000);
  camera.position.set(-1, 0, 16);   // shifted left so curve feels closer to text

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);   // fully transparent

  // Use a safe fallback size in case container is still 0 at this moment
  const initW = container.clientWidth  || window.innerWidth  * 0.5;
  const initH = container.clientHeight || window.innerHeight * 0.85;
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Correct the size after the browser has painted the layout
  requestAnimationFrame(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  });

  // ---- Lighting ----
  scene.add(new THREE.AmbientLight(0xfff8e8, 1.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(8, 12, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const rimLight = new THREE.PointLight(0x8fa86a, 2.5, 80);
  rimLight.position.set(-8, -4, 6);
  scene.add(rimLight);
  const accentLight = new THREE.PointLight(0xb8a055, 1.8, 60);
  accentLight.position.set(6, 6, 4);
  scene.add(accentLight);

  // ---- ECC Curve y² = x³ + 7 — large, centred in view ----
  const cScale = 2.4;   // bigger than before
  const topPts = [], botPts = [];
  for (let x = -1.9; x <= 4; x += 0.025) {
    const y2 = x * x * x + 7;
    if (y2 >= 0) {
      const y = Math.sqrt(y2);
      topPts.push(new THREE.Vector3(x * cScale - 1, y * cScale, 0));
      botPts.push(new THREE.Vector3(x * cScale - 1, -y * cScale, 0));
    }
  }
  const curveMat = new THREE.LineBasicMaterial({ color: 0x2d3a1e, transparent: true, opacity: 0.85, linewidth: 2 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(topPts), curveMat));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(botPts), curveMat));

  // ---- Named points on the curve with glowing spheres ----
  const namedPts = [
    { x: -1.3, sign:  1, color: 0x2d3a1e, label: 'G', r: 0.28 },
    { x:  0.5, sign:  1, color: 0x4a5e30, label: 'P', r: 0.22 },
    { x:  2.0, sign: -1, color: 0xb8a055, label: 'Q', r: 0.22 },
    { x:  3.2, sign:  1, color: 0x8fa86a, label: 'R', r: 0.20 },
    { x: -0.5, sign: -1, color: 0xc8b87a, label: '',  r: 0.16 },
    { x:  1.2, sign:  1, color: 0x4a5e30, label: '',  r: 0.16 },
  ];
  const dotMeshes = namedPts.map(({ x, sign, color, r }) => {
    const y2 = x * x * x + 7;
    if (y2 < 0) return null;
    const y = Math.sqrt(y2) * sign;
    const geo = new THREE.SphereGeometry(r, 28, 28);
    const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.35, shininess: 120, specular: 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x * cScale - 1, y * cScale, 0);
    mesh.castShadow = true;
    scene.add(mesh);
    return { mesh, baseZ: 0, phase: Math.random() * Math.PI * 2 };
  }).filter(Boolean);

  // ---- Animated arc between G and P (point addition) ----
  const arcGroup = new THREE.Group();
  scene.add(arcGroup);
  function buildArc(from, to, color, opacity) {
    const mid = new THREE.Vector3((from.x + to.x) / 2, Math.max(from.y, to.y) + 2.5, 0);
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const geo = new THREE.TubeGeometry(curve, 40, 0.05, 8, false);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Mesh(geo, mat);
  }
  const gPos = new THREE.Vector3(-1.3 * cScale - 1, Math.sqrt(Math.pow(-1.3,3)+7) * cScale, 0);
  const pPos = new THREE.Vector3(0.5  * cScale - 1, Math.sqrt(Math.pow(0.5, 3)+7) * cScale, 0);
  const qPos = new THREE.Vector3(2.0  * cScale - 1, -Math.sqrt(Math.pow(2.0,3)+7) * cScale, 0);
  arcGroup.add(buildArc(gPos, pPos, 0x4a5e30, 0.35));
  arcGroup.add(buildArc(pPos, qPos, 0xb8a055, 0.30));

  // ---- Orbiting sphere cluster — bigger radius, no background ----
  const orbitGroup = new THREE.Group();
  orbitGroup.position.set(3.5, 0, -4);   // pushed right so it hugs the right edge
  scene.add(orbitGroup);

  const colors = [0xddd9ce, 0x8fa86a, 0x4a5e30, 0x2d3a1e, 0xb8a055, 0xe8e4dc, 0xc8b87a];
  const spheres = [];
  for (let i = 0; i < 90; i++) {
    const r = 3.5 + Math.random() * 3.5;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const geo = new THREE.SphereGeometry(0.25 + Math.random() * 0.55, 20, 20);
    const mat = new THREE.MeshPhongMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      shininess: 70 + Math.random() * 80,
      specular: 0xffffff
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    mesh.castShadow = true;
    orbitGroup.add(mesh);
    spheres.push({ mesh, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.7 });
  }

  // ---- Mouse tracking ----
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth)  * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // ---- Travelling dot along the curve ----
  const travGeo = new THREE.SphereGeometry(0.18, 20, 20);
  const travMat = new THREE.MeshPhongMaterial({ color: 0xb8a055, emissive: 0xb8a055, emissiveIntensity: 0.7, shininess: 140 });
  const travDot = new THREE.Mesh(travGeo, travMat);
  scene.add(travDot);

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.012;   // faster overall

    // Orbit cluster — faster spin, mouse tilt
    orbitGroup.rotation.y = t * 0.55 + mouseX * 0.45;
    orbitGroup.rotation.x = mouseY * 0.28;

    // Curve subtle breathe toward camera
    curveMat.opacity = 0.7 + 0.15 * Math.sin(t * 0.6);

    // Sphere pulsing — more energetic
    spheres.forEach(({ mesh, phase, speed }) => {
      mesh.scale.setScalar(1 + 0.12 * Math.sin(t * speed + phase));
    });

    // Named dots — float up/down + z wobble
    dotMeshes.forEach(({ mesh, phase }, i) => {
      mesh.position.z = 0.4 * Math.sin(t * 1.1 + phase);
      mesh.scale.setScalar(1 + 0.18 * Math.sin(t * 0.9 + phase));
    });

    // Travelling dot walks along top half of curve
    const tParam = (t * 0.18) % 1;
    const txRaw = -1.9 + tParam * 5.9;   // -1.9 → 4.0
    const ty2 = txRaw * txRaw * txRaw + 7;
    if (ty2 >= 0) {
      travDot.position.set(txRaw * cScale - 1, Math.sqrt(ty2) * cScale, 0.3);
      travDot.visible = true;
    } else {
      travDot.visible = false;
    }

    // Gentle arc flicker
    arcGroup.children.forEach((m, i) => {
      m.material.opacity = 0.2 + 0.18 * Math.sin(t * 0.7 + i * 1.2);
    });

    // Camera slight drift — more alive
    camera.position.x = -1 + Math.sin(t * 0.15) * 0.6 + mouseX * 0.8;
    camera.position.y =      Math.cos(t * 0.12) * 0.4 + mouseY * 0.5;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();
  scenes.hero = { scene, renderer, camera };

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

function initKeyGenScene() {
  const container = document.getElementById("keygen-canvas-container");
  if (container && container.children.length === 0) {
    scenes.keygen = new ECCScene3D("keygen-canvas-container", 0x2d7a3a);
    scenes.keygen.camera.position.z = 10;
  }
}

function initEncryptScene() {
  const container = document.getElementById("encrypt-canvas-container");
  if (container && container.children.length === 0) {
    scenes.encrypt = new ECCScene3D("encrypt-canvas-container", 0x4a5e30);
    scenes.encrypt.camera.position.z = 10;
  }
}

function initDecryptScene() {
  const container = document.getElementById("decrypt-canvas-container");
  if (container && container.children.length === 0) {
    scenes.decrypt = new ECCScene3D("decrypt-canvas-container", 0xb8a055);
    scenes.decrypt.camera.position.z = 10;
  }
}

function initSourcesScene() {
  if (scenes.sources) return;
  const container = document.getElementById("sources-3d-container");
  if (!container) return;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f2eb);
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 30;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const geometry = new THREE.IcosahedronGeometry(10, 2);
  const wireframe = new THREE.WireframeGeometry(geometry);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4a5e30, transparent: true, opacity: 0.12 });
  const lines = new THREE.LineSegments(wireframe, lineMaterial);
  scene.add(lines);

  function animate() {
    requestAnimationFrame(animate);
    lines.rotation.y += 0.002;
    lines.rotation.x += 0.001;
    renderer.render(scene, camera);
  }
  animate();
  scenes.sources = { scene, renderer };
}

// ============ KEY GENERATION FLOW ============
// Helper: real point on y^2 = x^3 + 7 (with scale 1.5 for 3D scene)
// Returns {x, y} on y^2 = x^3 + 7 scaled for the 3D scene (scale 1.5)
function curvePoint(x, sign = 1) {
  const y2 = x * x * x + 7;
  if (y2 < 0) return { x: 0, y: 0 };
  return { x: x * 1.5, y: Math.sqrt(y2) * 1.5 * sign };
}

// Fixed meaningful points on the curve — plain {x,y}, convert to Vector3 inline
const CP = {
  G:  curvePoint(-1.3, 1),   // Generator
  P1: curvePoint( 0.5, 1),
  P2: curvePoint( 1.5,-1),
  P3: curvePoint( 2.2, 1),
  P4: curvePoint( 3.0,-1),
  P5: curvePoint(-0.5, 1),
  P6: curvePoint( 1.0, 1),
  M:  curvePoint( 0.0, 1),   // Message point
  PK: curvePoint( 2.5, 1),   // Public key destination
  C1: curvePoint(-0.8,-1),   // Ciphertext C1
  C2: curvePoint( 1.8, 1),   // Ciphertext C2
  S:  curvePoint( 0.8,-1),   // Shared secret
};
// Shorthand: convert CP entry to THREE.Vector3
function v3(p) { return new THREE.Vector3(p.x, p.y, 0); }

async function generateKeys() {
  const scene = scenes.keygen;
  if (!scene) return;
  scene.clearElements();
  clearSteps("keygen-steps");

  try {
    // Step 1 — Show Generator Point G on the curve
    addLiveStep("keygen-steps", 1, "Generator Point G", "G is a fixed base point on the secp256k1 curve y² = x³ + 7.");
    const Gpt = scene.addPoint(CP.G.x, CP.G.y, 0x2d3a1e, 1.2);
    scene.addLabel("G (Generator)", new THREE.Vector3(CP.G.x, CP.G.y + 0.7, 0), "#2d3a1e");
    await sleep(1800);

    const response = await fetch("/generate_keys", { method: "POST" });
    const data = await response.json();
    currentPrivateKey = data.private_key;
    currentPublicKey = data.public_key;

    addLiveStep("keygen-steps", 2, "Private Key k", `Random k = ${currentPrivateKey.substring(0, 10)}… chosen secretly.`);
    await sleep(1600);

    addLiveStep("keygen-steps", 3, "Scalar Multiplication", "P = k × G — repeatedly doubling & adding G along the curve.");

    const hops = [CP.G, CP.P1, CP.P2, CP.P3, CP.P5, CP.P6, CP.PK];
    for (let i = 1; i < hops.length; i++) {
      await scene.tracePath(v3(hops[i-1]), v3(hops[i]), 0x8fa86a);
      const isLast = i === hops.length - 1;
      const pt = scene.addPoint(hops[i].x, hops[i].y, isLast ? 0x2d3a1e : 0x8fa86a, isLast ? 1.6 : 0.45);
      if (!isLast) {
        await sleep(220);
        scene.elementsGroup.remove(pt);
      }
    }

    addLiveStep("keygen-steps", 4, "Public Key P", "P is your public key — the endpoint after k doublings of G.");
    scene.addLabel("Public Key P", new THREE.Vector3(CP.PK.x, CP.PK.y + 0.7, 0), "#2d3a1e");

    document.getElementById("priv-key").textContent = currentPrivateKey.substring(0, 30) + "...";
    document.getElementById("pub-key").textContent  = currentPublicKey.substring(0, 30) + "...";
    document.getElementById("keygen-display").style.display = "block";

  } catch (e) {
    console.error(e);
    alert("Key Generation Failed");
  }
}

// ============ ENCRYPTION FLOW ============
async function startEncryption() {
  const plaintext = document.getElementById("plaintext").value.trim();
  if (!plaintext || !currentPublicKey) {
    alert("Please enter a message and generate keys first.");
    return;
  }
  showPage('encrypt');
  const scene = scenes.encrypt;
  if (!scene) return;
  scene.clearElements();
  clearSteps("encrypt-steps");

  // Step 1 — Message point M on the curve
  addLiveStep("encrypt-steps", 1, "Map Message → M", "The message is mapped to a point M on the elliptic curve.");
  const M = scene.addPoint(CP.M.x, CP.M.y, 0x4a5e30, 1.2);
  scene.addLabel("M (Message)", new THREE.Vector3(CP.M.x, CP.M.y + 0.7, 0), "#4a5e30");
  await sleep(1800);

  // Step 2 — Public key P (already on curve from keygen)
  addLiveStep("encrypt-steps", 2, "Public Key P", "Sender uses recipient's public key P on the curve.");
  const P = scene.addPoint(CP.PK.x, CP.PK.y, 0x2d3a1e, 1.1);
  scene.addLabel("P (Public Key)", new THREE.Vector3(CP.PK.x, CP.PK.y + 0.7, 0), "#2d3a1e");
  await sleep(1800);

  // Step 3 — Ephemeral key: show G then hop to C1 along the curve
  addLiveStep("encrypt-steps", 3, "C₁ = k × G", "Random k chosen. C₁ is computed by scalar mult of G.");
  const G = scene.addPoint(CP.G.x, CP.G.y, 0xb8a055, 0.85);
  scene.addLabel("G", new THREE.Vector3(CP.G.x, CP.G.y + 0.7, 0), "#b8a055");
  await sleep(800);
  // Hop G → P1 → C1 (all on curve)
  await scene.tracePath(v3(CP.G), v3(CP.P1), 0xb8a055);
  const midHop = scene.addPoint(CP.P1.x, CP.P1.y, 0xb8a055, 0.4);
  await scene.tracePath(v3(CP.P1), v3(CP.C1), 0xb8a055);
  scene.elementsGroup.remove(midHop);
  const C1 = scene.addPoint(CP.C1.x, CP.C1.y, 0xb8a055, 1.1);
  scene.addLabel("C₁", new THREE.Vector3(CP.C1.x, CP.C1.y - 0.7, 0), "#b8a055");
  await sleep(1800);

  // Step 4 — Shared secret S = k × P
  addLiveStep("encrypt-steps", 4, "S = k × P", "Shared secret S computed from public key P via scalar mult.");
  await scene.tracePath(v3(CP.PK), v3(CP.P2), 0x8fa86a);
  const sHop = scene.addPoint(CP.P2.x, CP.P2.y, 0x8fa86a, 0.4);
  await scene.tracePath(v3(CP.P2), v3(CP.S), 0x8fa86a);
  scene.elementsGroup.remove(sHop);
  const S = scene.addPoint(CP.S.x, CP.S.y, 0x8fa86a, 1.0);
  scene.addLabel("S (Secret)", new THREE.Vector3(CP.S.x, CP.S.y - 0.7, 0), "#8fa86a");
  await sleep(1800);

  // Step 5 — C2 = M + S (point addition on the curve)
  addLiveStep("encrypt-steps", 5, "C₂ = M + S", "Ciphertext C₂ is M masked with the shared secret S.");
  await Promise.all([
    scene.tracePath(v3(CP.M), v3(CP.C2), 0x4a5e30),
    scene.tracePath(v3(CP.S), v3(CP.C2), 0x8fa86a)
  ]);
  scene.elementsGroup.remove(M);
  scene.elementsGroup.remove(S);
  const C2 = scene.addPoint(CP.C2.x, CP.C2.y, 0x2d3a1e, 1.5);
  scene.addLabel("C₂ (Cipher)", new THREE.Vector3(CP.C2.x, CP.C2.y + 0.7, 0), "#2d3a1e");
  await sleep(1400);

  try {
    const response = await fetch("/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plaintext, public_key: currentPublicKey }),
    });
    const data = await response.json();
    currentCiphertext = data.ciphertext;
    document.getElementById("ciphertext").value = currentCiphertext;
    document.getElementById("ciphertext").classList.add("result-shown");
  } catch (e) {
    alert("Encryption Error");
  }
}

// ============ DECRYPTION FLOW ============
async function startDecryption() {
  if (!currentCiphertext || !currentPrivateKey) {
    alert("No ciphertext or private key found. Please encrypt a message first.");
    return;
  }
  const scene = scenes.decrypt;
  if (!scene) return;
  scene.clearElements();
  clearSteps("decrypt-steps");

  // Step 1 — Show received ciphertext pair (C1, C2) — same curve points as encryption
  addLiveStep("decrypt-steps", 1, "Receive (C₁, C₂)", "Bob receives the ciphertext pair — both points on the curve.");
  const C1 = scene.addPoint(CP.C1.x, CP.C1.y, 0xb8a055, 1.1);
  scene.addLabel("C₁", new THREE.Vector3(CP.C1.x, CP.C1.y - 0.7, 0), "#b8a055");
  const C2 = scene.addPoint(CP.C2.x, CP.C2.y, 0x4a5e30, 1.3);
  scene.addLabel("C₂", new THREE.Vector3(CP.C2.x, CP.C2.y + 0.7, 0), "#4a5e30");
  await sleep(1800);

  // Step 2 — Recover shared secret: S = d × C1 (scalar mult using private key d)
  addLiveStep("decrypt-steps", 2, "S = d × C₁", "Bob uses private key d to scalar-multiply C₁ and recover S.");
  await scene.tracePath(v3(CP.C1), v3(CP.P3), 0x8fa86a);
  const sHop = scene.addPoint(CP.P3.x, CP.P3.y, 0x8fa86a, 0.4);
  await scene.tracePath(v3(CP.P3), v3(CP.S), 0x8fa86a);
  scene.elementsGroup.remove(sHop);
  const S = scene.addPoint(CP.S.x, CP.S.y, 0x8fa86a, 1.1);
  scene.addLabel("S (Secret)", new THREE.Vector3(CP.S.x, CP.S.y - 0.7, 0), "#8fa86a");
  await sleep(1800);

  // Step 3 — Recover M = C2 − S (point subtraction on the curve)
  addLiveStep("decrypt-steps", 3, "M = C₂ − S", "Bob subtracts S from C₂ to recover the original message point M.");
  await scene.tracePath(v3(CP.C2), v3(CP.M), 0x4a5e30);
  await scene.tracePath(v3(CP.S), v3(CP.M), 0x8fa86a);
  scene.elementsGroup.remove(C2);
  scene.elementsGroup.remove(S);
  const Mpt = scene.addPoint(CP.M.x, CP.M.y, 0x2d3a1e, 1.6);
  scene.addLabel("M (Message ✓)", new THREE.Vector3(CP.M.x, CP.M.y + 0.7, 0), "#2d3a1e");
  await sleep(1500);

  try {
    const response = await fetch("/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: currentCiphertext, private_key: currentPrivateKey }),
    });
    const data = await response.json();
    document.getElementById("decrypted").value = data.plaintext;
    document.getElementById("decrypted").classList.add("result-shown");
  } catch (e) {
    alert("Decryption failed");
  }
}

// ============ SIMULATION PAGE (kept for compatibility) ============
function simStepBack() {}
function simTogglePlay() {}
function simStepForward() {}
function simReset() {}
function simChangeOperation(val) {}
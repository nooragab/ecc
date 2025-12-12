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

// Helper: Sleep function for animations
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============ PAGE NAVIGATION ============
function showPage(pageName) {
  const pages = document.querySelectorAll(".page")
  const navLinks = document.querySelectorAll(".nav-link")

  pages.forEach((page) => page.classList.remove("active"))
  navLinks.forEach((link) => link.classList.remove("active"))

  document.getElementById(pageName).classList.add("active")

  // Find the link that corresponds to this page
  const activeLink = Array.from(navLinks).find(link => link.getAttribute('onclick').includes(pageName));
  if (activeLink) activeLink.classList.add("active");

  // Initialize specific 3D scenes when entering pages
  setTimeout(() => {
    if (pageName === "home") initHeroScene();
    if (pageName === "keygen") initKeyGenScene();
    if (pageName === "encrypt") initEncryptScene();
    if (pageName === "decrypt") initDecryptScene();
  }, 100);
}

// ============ BACKGROUND TOGGLE ============
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById("bg-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      bgAnimationEnabled = !bgAnimationEnabled;
      toggleBtn.classList.toggle("disabled");
      toggleBtn.style.opacity = bgAnimationEnabled ? "1" : "0.5";
    });
  }
  // Start Hero initially
  initHeroScene();
});

// ============ 3D SCENE CLASS ============
class ECCScene3D {
  constructor(containerId, colorTheme = 0x00d9ff) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.theme = colorTheme;
    this.labels = [];

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0f1e, 0.02);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
    this.camera.position.z = 12;
    this.camera.position.y = 0;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.innerHTML = ''; // Clear previous
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const pointLight = new THREE.PointLight(this.theme, 2, 50);
    pointLight.position.set(5, 5, 10);
    this.scene.add(pointLight);

    // Groups
    this.curveGroup = new THREE.Group();
    this.scene.add(this.curveGroup);
    this.elementsGroup = new THREE.Group();
    this.scene.add(this.elementsGroup);

    // Interaction vars
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetRotationX = 0;
    this.targetRotationY = 0;

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
    // Draw ECC curve y^2 = x^3 + 7
    const points = [];
    const scale = 1.5;
    // We draw two segments: y > 0 and y < 0
    const topPoints = [];
    const botPoints = [];
    for (let x = -1.9; x <= 4; x += 0.05) {
      const y2 = Math.pow(x, 3) + 7;
      if (y2 >= 0) {
        const y = Math.sqrt(y2);
        topPoints.push(new THREE.Vector3(x * scale, y * scale, 0));
        botPoints.push(new THREE.Vector3(x * scale, -y * scale, 0));
      }
    }

    const material = new THREE.LineBasicMaterial({ color: this.theme, transparent: true, opacity: 0.6, linewidth: 2 });

    const topGeo = new THREE.BufferGeometry().setFromPoints(topPoints);
    const botGeo = new THREE.BufferGeometry().setFromPoints(botPoints);

    this.curveGroup.add(new THREE.Line(topGeo, material));
    this.curveGroup.add(new THREE.Line(botGeo, material));

    // Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x333333, 0x111111);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1;
    this.scene.add(gridHelper);
  }

  addPoint(x, y, color = 0xffffff, scale = 1) {
    const geometry = new THREE.SphereGeometry(0.3 * scale, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: color, emissive: color, emissiveIntensity: 0.6 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, 0);
    this.elementsGroup.add(sphere);

    // Pulse animation data
    sphere.userData = { initialScale: scale, time: Math.random() * 100 };
    return sphere;
  }

  // Create a floating HTML label
  addLabel(text, position, color = '#ffffff') {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'scene-label';
    labelDiv.textContent = text;
    labelDiv.style.color = color;
    labelDiv.style.position = 'absolute';
    labelDiv.style.padding = '4px 8px';
    labelDiv.style.background = 'rgba(0,0,0,0.7)';
    labelDiv.style.borderRadius = '4px';
    labelDiv.style.fontSize = '12px';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.border = `1px solid ${color}`;


    this.container.appendChild(labelDiv);
    this.labels.push({ div: labelDiv, position: position });
    return labelDiv;
  }

  updateLabels() {
    this.labels.forEach(label => {
      const pos = label.position.clone();
      // Project 3D position to 2D screen
      pos.project(this.camera);
      // Convert to CSS coordinates
      const x = (pos.x * .5 + .5) * this.width;
      const y = (pos.y * -.5 + .5) * this.height;

      label.div.style.left = `${x}px`;
      label.div.style.top = `${y}px`;


      // Fade out if behind camera or far
      if (pos.z > 1) label.div.style.opacity = 0;
      else label.div.style.opacity = 1;
    });
  }

  clearElements() {
    // Remove all children from elements group
    while (this.elementsGroup.children.length > 0) {
      const child = this.elementsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.elementsGroup.remove(child);
    }
    // Remove labels
    this.labels.forEach(l => l.div.remove());
    this.labels = [];
  }

  // New Animation: Trace a path between two points
  async tracePath(start, end, color = 0xffffff) {
    const points = [];
    points.push(start);
    // Create detailed cubic bezier or simple line
    // Simple lerp for now
    const curve = new THREE.LineCurve3(start, end);
    const geometry = new THREE.TubeGeometry(curve, 20, 0.05, 8, false);
    const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    this.elementsGroup.add(mesh);

    // Animate opacity
    for (let i = 0; i <= 20; i++) {
      material.opacity = i / 20;
      await sleep(20);
    }
    return mesh;
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Camera slight movement
    this.targetRotationX = this.mouseX * 0.3;
    this.targetRotationY = this.mouseY * 0.3;

    this.camera.position.x += (this.mouseX * 5 - this.camera.position.x) * 0.05;
    this.camera.position.y += (this.mouseY * 2 - this.camera.position.y) * 0.05;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    this.elementsGroup.children.forEach(mesh => {
      if (mesh.userData && mesh.userData.time !== undefined) {
        mesh.userData.time += 0.05;
        const s = mesh.userData.initialScale + Math.sin(mesh.userData.time) * 0.1;
        mesh.scale.set(s, s, s);
      }
    });

    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  }
}

// ============ SPECIFIC SCENE INIT ============

function initHeroScene() {
  if (scenes.hero) return;
  const container = document.getElementById("hero-3d-container");
  if (!container) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 25;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Particles
  const particlesGeometry = new THREE.BufferGeometry();
  const count = 3000;
  const posArray = new Float32Array(count * 3);
  const colorsArray = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i += 3) {
    const r = Math.random() * 25;
    const theta = Math.random() * 2 * Math.PI;
    posArray[i] = r * Math.cos(theta);
    posArray[i + 1] = (Math.random() - 0.5) * 5 + Math.sin(r * 0.5) * 2;
    posArray[i + 2] = r * Math.sin(theta);

    colorsArray[i] = 0.0;
    colorsArray[i + 1] = 0.5 + Math.random() * 0.5;
    colorsArray[i + 2] = 1.0;
  }

  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const particlesMesh = new THREE.Points(particlesGeometry, material);
  scene.add(particlesMesh);

  // Interaction
  let mouseX = 0;
  let mouseY = 0;
  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  function animate() {
    if (!bgAnimationEnabled) return;
    requestAnimationFrame(animate);
    particlesMesh.rotation.y += 0.001 + mouseX * 0.002;
    particlesMesh.rotation.x += mouseY * 0.002;
    renderer.render(scene, camera);
  }
  animate();
  scenes.hero = { scene, renderer };
}

function initKeyGenScene() {
  // Only init if empty
  const container = document.getElementById("keygen-canvas-container");
  if (container && container.children.length === 0) {
    scenes.keygen = new ECCScene3D("keygen-canvas-container", 0x00ff88);
    scenes.keygen.camera.position.z = 10;
    // Draw initial static Curve if needed or just wait for generation
  }
}

function initEncryptScene() {
  const container = document.getElementById("encrypt-canvas-container");
  if (container && container.children.length === 0) {
    scenes.encrypt = new ECCScene3D("encrypt-canvas-container", 0xff00ff);
    scenes.encrypt.camera.position.z = 10;
  }
}

function initDecryptScene() {
  const container = document.getElementById("decrypt-canvas-container");
  if (container && container.children.length === 0) {
    scenes.decrypt = new ECCScene3D("decrypt-canvas-container", 0xffaa00);
    scenes.decrypt.camera.position.z = 10;
  }
}

// ============ LOGIC AND ANIMATION FLOWS ============

// --- KEY GENERATION FLOW ---
async function generateKeys() {
  const scene = scenes.keygen;
  if (!scene) return;
  scene.clearElements();

  try {
    // Step 1: Visual - Key Generation Start
    scene.addLabel("Step 1: Selecting Generator Point G", new THREE.Vector3(0, 4, 0), "#00d9ff");
    const G = scene.addPoint(-2, -1.5, 0x00d9ff, 1); // Generator
    scene.addLabel("G", new THREE.Vector3(-2, -2.2, 0), "#00d9ff");
    await sleep(1500);

    // Step 2: Call Backend
    const response = await fetch("/generate_keys", { method: "POST" });
    const data = await response.json();
    currentPrivateKey = data.private_key;
    currentPublicKey = data.public_key;

    // Visual - Private Key Selection
    scene.clearElements();
    scene.addPoint(-2, -1.5, 0x00d9ff, 1); // Redraw sum
    scene.addLabel("G", new THREE.Vector3(-2, -2.2, 0), "#00d9ff");

    scene.addLabel("Step 2: Private Key (k) selected", new THREE.Vector3(0, 4, 0), "#ffffff");
    await sleep(1500);

    // Step 3: Animation of Scalar Multiplication
    scene.addLabel("Step 3: Computing P = k * G", new THREE.Vector3(0, 3, 0), "#00ff88");

    let currentPos = new THREE.Vector3(-2, -1.5, 0);
    for (let i = 0; i < 8; i++) {
      // Random "hop" on the curve
      const nextX = (Math.random() * 5) - 2.5;
      const nextY = (Math.random() > 0.5 ? 1 : -1) * Math.sqrt(Math.pow(nextX, 3) + 7) * 1.5; // Scale match
      const nextPos = new THREE.Vector3(nextX, nextY, 0);

      // Trace line
      await scene.tracePath(currentPos, nextPos, 0x00ff88);
      const p = scene.addPoint(nextPos.x, nextPos.y, 0x00ff88, 0.5);
      currentPos = nextPos;
      await sleep(300);
      if (i < 7) scene.elementsGroup.remove(p); // Remove intermediate points, keep path
    }

    // Final Point
    scene.addLabel("Step 4: Public Key Generated!", new THREE.Vector3(0, 5, 0), "#00ff88");
    const pubKeyPoint = scene.addPoint(currentPos.x, currentPos.y, 0xffffff, 1.5);
    scene.addLabel("Public Key (P)", new THREE.Vector3(currentPos.x, currentPos.y - 0.8, 0), "#ffffff");

    // Update UI
    document.getElementById("priv-key").textContent = currentPrivateKey.substring(0, 30) + "...";
    document.getElementById("pub-key").textContent = currentPublicKey.substring(0, 30) + "...";
    document.getElementById("keygen-display").style.display = "block";

  } catch (e) {
    console.error(e);
    alert("Key Generation Failed");
  }
}

// --- ENCRYPTION FLOW ---
async function startEncryption() {
  const plaintext = document.getElementById("plaintext").value.trim()
  if (!plaintext || !currentPublicKey) {
    alert("Please enter message and generate keys.");
    return;
  }
  showPage('encrypt');

  const scene = scenes.encrypt;
  if (!scene) return;
  scene.clearElements();

  // Step 1: Map Message to Point
  scene.addLabel("Step 1: Mapping Message to Curve Point (M)", new THREE.Vector3(0, 4, 0), "#ff00ff");
  const M = scene.addPoint(-1, 2, 0xff00ff, 1.2);
  scene.addLabel("Message (M)", new THREE.Vector3(-1, 1.3, 0), "#ff00ff");
  await sleep(2000);

  // Step 2: Receiver's Public Key
  scene.addLabel("Step 2: Retrieve Public Key (P)", new THREE.Vector3(0, 4, 0), "#00d9ff");
  const P = scene.addPoint(3, -2, 0x00d9ff, 1);
  scene.addLabel("Public Key (P)", new THREE.Vector3(3, -2.8, 0), "#00d9ff");
  await sleep(2000);

  // Step 3: Generate Ephemeral Key k and C1
  scene.addLabel("Step 3: Generate Random k & Calculate C1 = k*G", new THREE.Vector3(0, 4, 0), "#ffffff");
  const G = scene.addPoint(-2, -1.5, 0xaaaaaa, 0.8); // G reference
  scene.addLabel("G", new THREE.Vector3(-2, -2.2, 0), "#aaaaaa");

  // Animate path G -> C1
  const C1_pos = new THREE.Vector3(-3, 1, 0);
  await scene.tracePath(G.position, C1_pos, 0xffffff);
  const C1 = scene.addPoint(C1_pos.x, C1_pos.y, 0xffffff, 1);
  scene.addLabel("C1", new THREE.Vector3(C1_pos.x, C1_pos.y + 0.5, 0), "#ffffff");
  await sleep(2000);

  // Step 4: Calculate Shared Secret S
  scene.addLabel("Step 4: Calculate Shared Secret S = k*P", new THREE.Vector3(0, 4, 0), "#ffff00");
  const S_pos = new THREE.Vector3(1, -1, 0); // Hypothetical S
  await scene.tracePath(P.position, S_pos, 0xffff00);
  const S = scene.addPoint(S_pos.x, S_pos.y, 0xffff00, 0.8);
  scene.addLabel("Secret S", new THREE.Vector3(1, -1.6, 0), "#ffff00");
  await sleep(2000);

  // Step 5: Encrypt M -> C2
  scene.addLabel("Step 5: Encrypt M: C2 = M + S", new THREE.Vector3(0, 4, 0), "#ff00ff");
  // Move S and M towards each other to form C2
  const C2_pos = new THREE.Vector3(2, 2, 0);

  await Promise.all([
    scene.tracePath(M.position, C2_pos, 0xff00ff),
    scene.tracePath(S.position, C2_pos, 0xffff00)
  ]);

  scene.elementsGroup.remove(M);
  scene.elementsGroup.remove(S);
  const C2 = scene.addPoint(C2_pos.x, C2_pos.y, 0xff00ff, 1.5); // Cipher point
  scene.addLabel("C2 (Encrypted)", new THREE.Vector3(C2_pos.x, C2_pos.y + 0.6, 0), "#ff00ff");
  await sleep(1500);

  // Do actual API call
  try {
    const response = await fetch("/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plaintext, public_key: currentPublicKey }),
    });
    const data = await response.json();
    currentCiphertext = data.ciphertext;
    document.getElementById("ciphertext").value = currentCiphertext;
    document.getElementById("ciphertext").parentElement.style.opacity = "1";

    scene.addLabel("Encryption Complete! (C1, C2) sent.", new THREE.Vector3(0, 5, 0), "#00ff88");

  } catch (e) {
    alert("Encryption Error");
  }
}

// --- DECRYPTION FLOW ---
async function startDecryption() {
  if (!currentCiphertext || !currentPrivateKey) {
    alert("No ciphertext or private key found.");
    return;
  }

  const scene = scenes.decrypt;
  if (!scene) return;
  scene.clearElements();

  // Show C1 and C2
  scene.addLabel("Step 1: Received Ciphertext (C1, C2)", new THREE.Vector3(0, 4, 0), "#ffffff");
  const C1_pos = new THREE.Vector3(-3, 1, 0);
  const C2_pos = new THREE.Vector3(2, 2, 0);

  const C1 = scene.addPoint(C1_pos.x, C1_pos.y, 0xffffff, 1);
  scene.addLabel("C1", new THREE.Vector3(C1_pos.x, C1_pos.y + 0.6, 0), "#ffffff");

  const C2 = scene.addPoint(C2_pos.x, C2_pos.y, 0xff00ff, 1.3);
  scene.addLabel("C2", new THREE.Vector3(C2_pos.x, C2_pos.y + 0.6, 0), "#ff00ff");
  await sleep(2000);

  // Compute S from C1
  scene.addLabel("Step 2: Compute Secret S = d * C1", new THREE.Vector3(0, 4, 0), "#ffff00");
  const S_pos = new THREE.Vector3(1, -1, 0);
  await scene.tracePath(C1_pos, S_pos, 0xffff00);
  const S = scene.addPoint(S_pos.x, S_pos.y, 0xffff00, 1);
  scene.addLabel("Secret S", new THREE.Vector3(S_pos.x, S_pos.y - 0.6, 0), "#ffff00");
  await sleep(2000);

  // Decrypt C2 -> M
  scene.addLabel("Step 3: Decrypt M = C2 - S", new THREE.Vector3(0, 4, 0), "#00ff88");
  const M_pos = new THREE.Vector3(-1, 2, 0); // Original Message pos

  await scene.tracePath(C2_pos, M_pos, 0xff00ff);
  await scene.tracePath(S_pos, M_pos, 0xffff00); // Inverse addition visual

  scene.elementsGroup.remove(C2);
  scene.elementsGroup.remove(S);

  const M = scene.addPoint(M_pos.x, M_pos.y, 0x00ff88, 1.5);
  scene.addLabel("Decrypted Message (M)", new THREE.Vector3(M_pos.x, M_pos.y + 0.6, 0), "#00ff88");
  await sleep(1500);

  // API Call
  try {
    const response = await fetch("/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: currentCiphertext, private_key: currentPrivateKey }),
    });
    const data = await response.json();
    document.getElementById("decrypted").value = data.plaintext;

    scene.addLabel("Decryption Successful!", new THREE.Vector3(0, 5, 0), "#00ff88");

  } catch (e) {
    alert("Decryption failed");
  }
}
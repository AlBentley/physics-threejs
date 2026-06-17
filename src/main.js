import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const CLOTH_WIDTH = 5.6;
const CLOTH_HEIGHT = 3.2;
const SEGMENTS_X = 38;
const SEGMENTS_Y = 22;
const MASS = 0.08;
const MARGIN = 0.05;
const WIND_BASE = 18;
const WIND_GUST = 13;
const TMP_COLOR = new THREE.Color();

let Ammo;
let physicsWorld;
let softBodyHelpers;
let cloth;
let clothGeometry;
let clothMesh;
let renderer;
let scene;
let camera;
let controls;
let clock;
let windArrow;
let windVector = new THREE.Vector3();
let elapsed = 0;

init();

async function init() {
  createHud();
  setStatus('Loading Ammo.js physics engine…');
  if (!window.Ammo) {
    setStatus('Ammo.js failed to load. Check your network connection and refresh.');
    return;
  }

  Ammo = await window.Ammo();
  setStatus('Building soft-body flag simulation…');

  setupGraphics();
  setupPhysics();
  createFlagPole();
  createCloth();
  createWindArrow();
  addEventListeners();

  setStatus('Drag to orbit • Scroll to zoom • Soft-body cloth pinned to the pole');
  renderer.setAnimationLoop(animate);
}

function createHud() {
  const panel = document.createElement('section');
  panel.className = 'hud';
  panel.innerHTML = `
    <h1>Ammo.js Wind Flag</h1>
    <p>A soft-body cloth flag is anchored to the pole and pushed by animated gusts.</p>
    <p id="status">Starting…</p>
  `;
  document.body.appendChild(panel);
}

function setStatus(message) {
  const el = document.querySelector('#status');
  if (el) el.textContent = message;
}

function setupGraphics() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x86bdec);
  scene.fog = new THREE.Fog(0x86bdec, 15, 42);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(3.7, 2.2, 8.3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.querySelector('#app').appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.9, 1.3, 0);
  controls.enableDamping = true;

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x42617a, 2.1);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(-4, 8, 5);
  sun.castShadow = true;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x4f8f54, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.85;
  ground.receiveShadow = true;
  scene.add(ground);
}

function setupPhysics() {
  const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const softBodySolver = new Ammo.btDefaultSoftBodySolver();
  physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver);
  physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0));
  physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, -9.8, 0));
  softBodyHelpers = new Ammo.btSoftBodyHelpers();
}

function createFlagPole() {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 5.2, 32),
    new THREE.MeshStandardMaterial({ color: 0xb7c1c9, metalness: 0.8, roughness: 0.32 })
  );
  pole.position.set(-CLOTH_WIDTH / 2, 0.35, 0);
  pole.castShadow = true;
  scene.add(pole);

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd66b, metalness: 0.7, roughness: 0.24 })
  );
  finial.position.set(-CLOTH_WIDTH / 2, 3, 0);
  finial.castShadow = true;
  scene.add(finial);
}

function createCloth() {
  const corner00 = new Ammo.btVector3(-CLOTH_WIDTH / 2, CLOTH_HEIGHT / 2, 0);
  const corner10 = new Ammo.btVector3(CLOTH_WIDTH / 2, CLOTH_HEIGHT / 2, 0);
  const corner01 = new Ammo.btVector3(-CLOTH_WIDTH / 2, -CLOTH_HEIGHT / 2, 0);
  const corner11 = new Ammo.btVector3(CLOTH_WIDTH / 2, -CLOTH_HEIGHT / 2, 0);

  cloth = softBodyHelpers.CreatePatch(
    physicsWorld.getWorldInfo(),
    corner00,
    corner10,
    corner01,
    corner11,
    SEGMENTS_X + 1,
    SEGMENTS_Y + 1,
    1 + 4,
    true
  );

  const config = cloth.get_m_cfg();
  config.set_viterations(12);
  config.set_piterations(12);
  config.set_kDF(0.45);
  config.set_kDP(0.018);
  config.set_kPR(1600);
  cloth.get_m_materials().at(0).set_m_kLST(0.72);
  cloth.get_m_materials().at(0).set_m_kAST(0.72);
  cloth.setTotalMass(MASS, false);
  Ammo.castObject(cloth, Ammo.btCollisionObject).getCollisionShape().setMargin(MARGIN);
  physicsWorld.addSoftBody(cloth, 1, -1);

  clothGeometry = new THREE.PlaneGeometry(CLOTH_WIDTH, CLOTH_HEIGHT, SEGMENTS_X, SEGMENTS_Y);
  clothGeometry.rotateY(Math.PI);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd82232,
    side: THREE.DoubleSide,
    roughness: 0.52,
    metalness: 0.02,
    vertexColors: true
  });
  paintFlagColors(clothGeometry);

  clothMesh = new THREE.Mesh(clothGeometry, material);
  clothMesh.castShadow = true;
  clothMesh.receiveShadow = true;
  scene.add(clothMesh);
}

function paintFlagColors(geometry) {
  const position = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) + CLOTH_HEIGHT / 2;
    const stripe = Math.floor((y / CLOTH_HEIGHT) * 7);
    TMP_COLOR.set(stripe % 2 === 0 ? 0xf7f3e7 : 0xc82032);
    colors.push(TMP_COLOR.r, TMP_COLOR.g, TMP_COLOR.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function createWindArrow() {
  windArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-4.2, 2.7, -1.2), 2, 0xefff6a, 0.35, 0.2);
  scene.add(windArrow);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 1 / 30);
  elapsed += delta;
  updateWind(elapsed);
  physicsWorld.stepSimulation(delta, 10);
  updateClothMesh();
  controls.update();
  renderer.render(scene, camera);
}

function updateWind(time) {
  const strength = WIND_BASE + Math.sin(time * 1.7) * WIND_GUST + Math.sin(time * 5.1) * 4;
  windVector.set(strength, Math.sin(time * 2.1) * 2.2, Math.cos(time * 1.3) * 6.4);

  const nodes = cloth.get_m_nodes();
  for (let i = 0; i < nodes.size(); i++) {
    const node = nodes.at(i);
    const row = Math.floor(i / (SEGMENTS_X + 1));
    const flutter = Math.sin(time * 7 + row * 0.43) * 2.4;
    node.get_m_f().op_add(new Ammo.btVector3(windVector.x, windVector.y + flutter, windVector.z));
  }

  windArrow.setDirection(windVector.clone().normalize());
  windArrow.setLength(1.45 + Math.abs(strength) * 0.035, 0.35, 0.2);
}

function updateClothMesh() {
  const nodes = cloth.get_m_nodes();
  const position = clothGeometry.attributes.position;
  const normal = clothGeometry.attributes.normal;

  for (let i = 0; i < nodes.size(); i++) {
    const node = nodes.at(i);
    const nodePosition = node.get_m_x();
    position.setXYZ(i, nodePosition.x(), nodePosition.y(), nodePosition.z());
    const nodeNormal = node.get_m_n();
    normal.setXYZ(i, nodeNormal.x(), nodeNormal.y(), nodeNormal.z());
  }

  position.needsUpdate = true;
  normal.needsUpdate = true;
  clothGeometry.computeVertexNormals();
}

function addEventListeners() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

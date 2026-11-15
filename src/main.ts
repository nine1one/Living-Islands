import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// ============================================================================
// 1. GAME STATE & DATA CONSTANTS
// ============================================================================
interface SettlementData {
  id: string;
  name: string;
  population: number;
  happiness: number;
  production: number;
  food: number;
  status: string;
  color: number;
  hexColor: string;
  position: THREE.Vector3;
}

const SETTLEMENTS: Record<string, SettlementData> = {
  northstone: {
    id: 'northstone',
    name: 'Northstone',
    population: 1200,
    happiness: 90,
    production: 320,
    food: 280,
    status: 'Growing',
    color: 0x3b82f6,
    hexColor: '#3b82f6',
    position: new THREE.Vector3(-10, 12, -45)
  },
  westhaven: {
    id: 'westhaven',
    name: 'Westhaven',
    population: 1050,
    happiness: 86,
    production: 210,
    food: 340,
    status: 'Prosperous',
    color: 0x22c55e,
    hexColor: '#22c55e',
    position: new THREE.Vector3(-55, 6, 5)
  },
  eastwood: {
    id: 'eastwood',
    name: 'Eastwood',
    population: 1450,
    happiness: 84,
    production: 410,
    food: 230,
    status: 'Expanding',
    color: 0xef4444,
    hexColor: '#ef4444',
    position: new THREE.Vector3(48, 8, -12)
  },
  southridge: {
    id: 'southridge',
    name: 'Southridge',
    population: 1100,
    happiness: 88,
    production: 260,
    food: 380,
    status: 'Stable',
    color: 0xa855f7,
    hexColor: '#a855f7',
    position: new THREE.Vector3(2, 4, 38)
  }
};

// ============================================================================
// 2. SCENE INITIALIZATION & CAMERA
// ============================================================================
const container = document.getElementById('canvas-container')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x081326);
scene.fog = new THREE.FogExp2(0x0b1a30, 0.0035);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  1,
  1000
);
// High isometric angle looking across the island towards the mountains and volcano
camera.position.set(0, 110, 130);
camera.lookAt(0, 0, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// ============================================================================
// 3. LIGHTING (Tropical Daylight)
// ============================================================================
const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.7);
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(0xfffaed, 0x1e293b, 0.6);
scene.add(hemisphereLight);

const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
sunLight.position.set(80, 120, 60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 350;
sunLight.shadow.camera.left = -110;
sunLight.shadow.camera.right = 110;
sunLight.shadow.camera.top = 110;
sunLight.shadow.camera.bottom = -110;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// ============================================================================
// 4. PROCEDURAL ISLAND TERRAIN & BIOMES
// ============================================================================
const noise2D = createNoise2D();

const TERRAIN_SIZE = 200;
const SEGMENTS = 160;
const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
terrainGeometry.rotateX(-Math.PI / 2);

const posAttr = terrainGeometry.attributes.position;
const colors = new Float32Array(posAttr.count * 3);

// Helper colors
const colSnow = new THREE.Color(0xf8fafc);
const colMountainRock = new THREE.Color(0x64748b);
const colBasalt = new THREE.Color(0x27272a);
const colLavaCrater = new THREE.Color(0xdc2626);
const colForestGrass = new THREE.Color(0x22c55e);
const colLushGrass = new THREE.Color(0x4ade80);
const colPlains = new THREE.Color(0xa3e635);
const colSand = new THREE.Color(0xfef08a);

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);

  // Radial distance from center (0,0)
  const dist = Math.sqrt(x * x + z * z);
  const maxRadius = 78;

  // Base island radial falloff
  let height = 0;
  if (dist < maxRadius) {
    const falloff = Math.cos((dist / maxRadius) * (Math.PI / 2));
    const n1 = noise2D(x * 0.02, z * 0.02);
    const n2 = noise2D(x * 0.06, z * 0.06) * 0.4;
    height = Math.max(0, (n1 + n2 + 0.5) * 8 * falloff);

    // 1. NORTHERN MOUNTAIN RANGE (High jagged peaks, snow)
    if (z < -15 && x > -50 && x < 35) {
      const mtnDist = Math.hypot(x - (-5), z - (-48));
      if (mtnDist < 35) {
        const mtnFactor = (1 - mtnDist / 35);
        const jagged = Math.abs(noise2D(x * 0.09, z * 0.09));
        height += mtnFactor * mtnFactor * (28 + jagged * 10);
      }
    }

    // 2. EASTERN VOLCANO (Conical volcano with crater)
    const volcX = 48;
    const volcZ = -30;
    const volcDist = Math.hypot(x - volcX, z - volcZ);
    if (volcDist < 26) {
      const vFactor = 1 - (volcDist / 26);
      if (volcDist < 3.5) {
        // Crater dip
        height += 16 - (3.5 - volcDist) * 3;
      } else {
        height += Math.pow(vFactor, 1.4) * 26;
      }
    }
  } else {
    height = -2.5; // underwater shelf
  }

  posAttr.setY(i, height);

  // Vertex Color Assignment based on biome & altitude
  const vertexColor = new THREE.Color();
  if (height <= 0.6) {
    vertexColor.copy(colSand);
  } else if (height > 22) {
    // Check if it's the volcano or snowy peaks
    if (x > 30 && z < -10) {
      vertexColor.copy(height > 24 ? colLavaCrater : colBasalt);
    } else {
      vertexColor.copy(colSnow);
    }
  } else if (height > 14) {
    if (x > 30 && z < -10) {
      vertexColor.copy(colBasalt);
    } else {
      vertexColor.copy(colMountainRock);
    }
  } else if (height > 6) {
    vertexColor.copy(colForestGrass);
  } else if (height > 2) {
    vertexColor.copy(colLushGrass);
  } else {
    vertexColor.copy(colPlains);
  }

  colors[i * 3] = vertexColor.r;
  colors[i * 3 + 1] = vertexColor.g;
  colors[i * 3 + 2] = vertexColor.b;
}

terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
terrainGeometry.computeVertexNormals();

const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.05,
  flatShading: true
});
const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrainMesh.receiveShadow = true;
terrainMesh.castShadow = true;
scene.add(terrainMesh);

// ============================================================================
// 5. OCEAN WATER PLANE
// ============================================================================
const waterGeometry = new THREE.PlaneGeometry(350, 350, 64, 64);
waterGeometry.rotateX(-Math.PI / 2);
const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x0284c7,
  roughness: 0.1,
  metalness: 0.2,
  transparent: true,
  opacity: 0.85
});
const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
waterMesh.position.y = 0.2;
scene.add(waterMesh);

// ============================================================================
// 6. VOLCANIC SMOKE & ASH PARTICLES
// ============================================================================
const smokeCount = 120;
const smokeGeo = new THREE.BufferGeometry();
const smokePos = new Float32Array(smokeCount * 3);
const smokeSpeeds = new Float32Array(smokeCount);

for (let i = 0; i < smokeCount; i++) {
  smokePos[i * 3] = 48 + (Math.random() - 0.5) * 3;
  smokePos[i * 3 + 1] = 25 + Math.random() * 20;
  smokePos[i * 3 + 2] = -30 + (Math.random() - 0.5) * 3;
  smokeSpeeds[i] = 0.05 + Math.random() * 0.08;
}
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
const smokeMat = new THREE.PointsMaterial({
  color: 0x94a3b8,
  size: 3.5,
  transparent: true,
  opacity: 0.5,
  depthWrite: false
});
const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
scene.add(smokeParticles);

// ============================================================================
// 7. SETTLEMENT ARCHITECTURE & KEEPS
// ============================================================================
const settlementGroup = new THREE.Group();
scene.add(settlementGroup);

function createCastleKeep(color: number, style: string): THREE.Group {
  const g = new THREE.Group();

  // Central Keep Tower
  const keepGeo = new THREE.BoxGeometry(4, style === 'fortress' ? 7 : 5, 4);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, flatShading: true });
  const keep = new THREE.Mesh(keepGeo, wallMat);
  keep.position.y = (style === 'fortress' ? 7 : 5) / 2;
  keep.castShadow = true;
  keep.receiveShadow = true;
  g.add(keep);

  // Roof
  const roofGeo = new THREE.ConeGeometry(3.2, 3, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, flatShading: true });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = keep.position.y + (style === 'fortress' ? 3.5 : 2.5) + 1.5;
  roof.castShadow = true;
  g.add(roof);

  // Outer Turrets & Wall
  const turretOffsets = [
    [-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]
  ];
  turretOffsets.forEach(([tx, tz]) => {
    const turretGeo = new THREE.CylinderGeometry(0.9, 1.1, 4.5, 6);
    const turret = new THREE.Mesh(turretGeo, wallMat);
    turret.position.set(tx, 2.25, tz);
    turret.castShadow = true;
    g.add(turret);

    const turretRoofGeo = new THREE.ConeGeometry(1.2, 1.8, 6);
    const turretRoof = new THREE.Mesh(turretRoofGeo, roofMat);
    turretRoof.position.set(tx, 4.5 + 0.9, tz);
    turretRoof.castShadow = true;
    g.add(turretRoof);
  });

  // Surrounding small houses
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 7 + Math.random() * 2;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;

    const houseGeo = new THREE.BoxGeometry(1.8, 1.4, 1.8);
    const house = new THREE.Mesh(houseGeo, wallMat);
    house.position.set(hx, 0.7, hz);
    house.castShadow = true;
    g.add(house);

    const houseRoofGeo = new THREE.ConeGeometry(1.4, 1.2, 4);
    houseRoofGeo.rotateY(Math.PI / 4);
    const houseRoof = new THREE.Mesh(houseRoofGeo, roofMat);
    houseRoof.position.set(hx, 1.4 + 0.6, hz);
    houseRoof.castShadow = true;
    g.add(houseRoof);
  }

  // Floating Banner / Crest Pin above settlement
  const pinGeo = new THREE.ConeGeometry(0.7, 1.6, 4);
  pinGeo.rotateX(Math.PI);
  const pinMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.3 });
  const pin = new THREE.Mesh(pinGeo, pinMat);
  pin.position.y = 14;
  g.add(pin);

  return g;
}

// Build each settlement
Object.values(SETTLEMENTS).forEach((data) => {
  const castle = createCastleKeep(data.color, data.id === 'northstone' || data.id === 'eastwood' ? 'fortress' : 'town');
  castle.position.copy(data.position);
  castle.userData = { settlementId: data.id };
  settlementGroup.add(castle);
});

// ============================================================================
// 8. TERRITORY BORDERS & ROADS
// ============================================================================
const borderGroup = new THREE.Group();
scene.add(borderGroup);

function createTerritoryBorderRing(center: THREE.Vector3, radiusX: number, radiusZ: number, colorHex: number): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const jitter = Math.sin(theta * 6) * 1.5;
    const x = center.x + Math.cos(theta) * (radiusX + jitter);
    const z = center.z + Math.sin(theta) * (radiusZ + jitter);
    points.push(new THREE.Vector3(x, center.y + 0.35, z));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3, transparent: true, opacity: 0.85 });
  return new THREE.Line(geo, mat);
}

borderGroup.add(createTerritoryBorderRing(SETTLEMENTS.northstone.position, 28, 22, SETTLEMENTS.northstone.color));
borderGroup.add(createTerritoryBorderRing(SETTLEMENTS.westhaven.position, 24, 25, SETTLEMENTS.westhaven.color));
borderGroup.add(createTerritoryBorderRing(SETTLEMENTS.eastwood.position, 26, 24, SETTLEMENTS.eastwood.color));
borderGroup.add(createTerritoryBorderRing(SETTLEMENTS.southridge.position, 28, 24, SETTLEMENTS.southridge.color));

// Roads connecting settlements
const roadGroup = new THREE.Group();
scene.add(roadGroup);

function createRoad(p1: THREE.Vector3, p2: THREE.Vector3): THREE.Line {
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  mid.y = Math.min(p1.y, p2.y) + 0.5; // slight curve
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(p1.x, p1.y + 0.2, p1.z),
    mid,
    new THREE.Vector3(p2.x, p2.y + 0.2, p2.z)
  );
  const pts = curve.getPoints(24);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 2, transparent: true, opacity: 0.7 });
  return new THREE.Line(geo, mat);
}

roadGroup.add(createRoad(SETTLEMENTS.northstone.position, SETTLEMENTS.westhaven.position));
roadGroup.add(createRoad(SETTLEMENTS.northstone.position, SETTLEMENTS.eastwood.position));
roadGroup.add(createRoad(SETTLEMENTS.westhaven.position, SETTLEMENTS.southridge.position));
roadGroup.add(createRoad(SETTLEMENTS.eastwood.position, SETTLEMENTS.southridge.position));

// ============================================================================
// 9. VEGETATION, TREES & FARMLANDS
// ============================================================================
const foliageGroup = new THREE.Group();
scene.add(foliageGroup);

// Instanced Pine & Oak Trees
const treeCount = 450;
const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.5, 5);
const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
const trunkMesh = new THREE.InstancedMesh(treeTrunkGeo, treeTrunkMat, treeCount);

const treeTopGeo = new THREE.ConeGeometry(1.2, 2.5, 5);
const treeTopMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8, flatShading: true });
const leavesMesh = new THREE.InstancedMesh(treeTopGeo, treeTopMat, treeCount);

const dummy = new THREE.Object3D();
let treeIdx = 0;

for (let i = 0; i < treeCount; i++) {
  const angle = Math.random() * Math.PI * 2;
  const rad = 15 + Math.random() * 55;
  const tx = Math.cos(angle) * rad;
  const tz = Math.sin(angle) * rad;

  // Don't place on volcano
  if (tx > 35 && tz < -15) continue;

  const ty = Math.max(1, 4 + noise2D(tx * 0.04, tz * 0.04) * 5);

  dummy.position.set(tx, ty + 0.75, tz);
  const scale = 0.7 + Math.random() * 0.6;
  dummy.scale.set(scale, scale, scale);
  dummy.rotation.y = Math.random() * Math.PI;
  dummy.updateMatrix();

  trunkMesh.setMatrixAt(treeIdx, dummy.matrix);

  dummy.position.set(tx, ty + 0.75 + 1.25 * scale, tz);
  dummy.updateMatrix();
  leavesMesh.setMatrixAt(treeIdx, dummy.matrix);

  treeIdx++;
}
trunkMesh.instanceMatrix.needsUpdate = true;
leavesMesh.instanceMatrix.needsUpdate = true;
trunkMesh.castShadow = true;
leavesMesh.castShadow = true;
foliageGroup.add(trunkMesh);
foliageGroup.add(leavesMesh);

// Farmland Wheat Patches (Golden fields)
function createFarmPatch(x: number, z: number, y: number, w: number, d: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.9, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + 0.05, z);
  mesh.receiveShadow = true;
  return mesh;
}
foliageGroup.add(createFarmPatch(10, 25, 4.2, 14, 10));
foliageGroup.add(createFarmPatch(-15, 30, 3.8, 12, 8));
foliageGroup.add(createFarmPatch(-40, 0, 5.5, 10, 10));
foliageGroup.add(createFarmPatch(38, -2, 7.5, 12, 8));

// ============================================================================
// 10. MOVING CITIZEN UNITS (Populace)
// ============================================================================
const citizenCount = 60;
const citizenGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 4);
const citizenMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 });
const citizenGroup = new THREE.Group();
scene.add(citizenGroup);

interface CitizenUnit {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
}
const citizens: CitizenUnit[] = [];

const waypoints = [
  SETTLEMENTS.northstone.position,
  SETTLEMENTS.westhaven.position,
  SETTLEMENTS.eastwood.position,
  SETTLEMENTS.southridge.position
];

for (let i = 0; i < citizenCount; i++) {
  const cMesh = new THREE.Mesh(citizenGeo, citizenMat);
  const w1 = waypoints[i % waypoints.length];
  const w2 = waypoints[(i + 1) % waypoints.length];
  cMesh.position.copy(w1);
  citizenGroup.add(cMesh);

  citizens.push({
    mesh: cMesh,
    start: w1,
    end: w2,
    progress: Math.random(),
    speed: 0.002 + Math.random() * 0.003
  });
}

// ============================================================================
// 11. INTERACTIVE MINIMAP RENDERING
// ============================================================================
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
const mmCtx = minimapCanvas?.getContext('2d');

function updateMinimap(): void {
  if (!mmCtx) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;

  mmCtx.fillStyle = '#06101e';
  mmCtx.fillRect(0, 0, w, h);

  // Island base shape
  mmCtx.fillStyle = '#166534';
  mmCtx.beginPath();
  mmCtx.ellipse(w / 2, h / 2, w * 0.4, h * 0.42, 0, 0, Math.PI * 2);
  mmCtx.fill();

  // Mountain & Volcano regions
  mmCtx.fillStyle = '#94a3b8';
  mmCtx.beginPath();
  mmCtx.ellipse(w / 2 - 10, h * 0.28, 22, 12, 0, 0, Math.PI * 2);
  mmCtx.fill();

  mmCtx.fillStyle = '#dc2626';
  mmCtx.beginPath();
  mmCtx.arc(w * 0.72, h * 0.32, 8, 0, Math.PI * 2);
  mmCtx.fill();

  // Settlement Pins
  Object.values(SETTLEMENTS).forEach((s) => {
    const mx = (s.position.x / TERRAIN_SIZE + 0.5) * w;
    const my = (s.position.z / TERRAIN_SIZE + 0.5) * h;

    mmCtx.fillStyle = s.hexColor;
    mmCtx.beginPath();
    mmCtx.arc(mx, my, 4, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.strokeStyle = '#ffffff';
    mmCtx.lineWidth = 1;
    mmCtx.stroke();
  });

  // Camera Frustum
  const camX = (camera.position.x / TERRAIN_SIZE + 0.5) * w;
  const camY = (camera.position.z / TERRAIN_SIZE + 0.5) * h;
  mmCtx.strokeStyle = '#38bdf8';
  mmCtx.lineWidth = 1.5;
  mmCtx.strokeRect(camX - 10, camY - 8, 20, 16);
}

// ============================================================================
// 12. UI CONTROLS & EVENT LISTENERS
// ============================================================================
function setupUIListeners(): void {
  // Overlays Toggles
  const toggleBorders = document.getElementById('toggle-borders') as HTMLInputElement;
  toggleBorders?.addEventListener('change', (e) => {
    borderGroup.visible = (e.target as HTMLInputElement).checked;
  });

  const toggleRoads = document.getElementById('toggle-roads') as HTMLInputElement;
  toggleRoads?.addEventListener('change', (e) => {
    roadGroup.visible = (e.target as HTMLInputElement).checked;
  });

  const toggleCitizens = document.getElementById('toggle-citizens') as HTMLInputElement;
  toggleCitizens?.addEventListener('change', (e) => {
    citizenGroup.visible = (e.target as HTMLInputElement).checked;
  });

  // Dock items active switch
  const dockButtons = document.querySelectorAll('.dock-item');
  dockButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      dockButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Speed controls
  const speedButtons = document.querySelectorAll('.speed-btn:not(.icon-btn)');
  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      speedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
setupUIListeners();

// ============================================================================
// 13. MOUSE ORBIT & INTERACTIVITY
// ============================================================================
let isDragging = false;
let prevMousePos = { x: 0, y: 0 };
let camRadius = 170;
let camTheta = Math.PI / 2;
let camPhi = 0.85;

window.addEventListener('mousedown', (e) => {
  if (e.target === renderer.domElement) {
    isDragging = true;
    prevMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const dx = e.clientX - prevMousePos.x;
    const dy = e.clientY - prevMousePos.y;

    camTheta -= dx * 0.005;
    camPhi = Math.max(0.3, Math.min(Math.PI / 2 - 0.1, camPhi - dy * 0.005));

    camera.position.x = Math.sin(camTheta) * Math.sin(camPhi) * camRadius;
    camera.position.y = Math.cos(camPhi) * camRadius;
    camera.position.z = Math.cos(camTheta) * Math.sin(camPhi) * camRadius;
    camera.lookAt(0, 0, -5);

    prevMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

window.addEventListener('wheel', (e) => {
  camRadius = Math.max(60, Math.min(260, camRadius + e.deltaY * 0.1));
  camera.position.x = Math.sin(camTheta) * Math.sin(camPhi) * camRadius;
  camera.position.y = Math.cos(camPhi) * camRadius;
  camera.position.z = Math.cos(camTheta) * Math.sin(camPhi) * camRadius;
  camera.lookAt(0, 0, -5);
});

// Raycasting settlement selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(settlementGroup.children, true);

  if (intersects.length > 0) {
    let curr: THREE.Object3D | null = intersects[0].object;
    while (curr && !curr.userData.settlementId && curr.parent) {
      curr = curr.parent;
    }
    if (curr && curr.userData.settlementId) {
      const s = SETTLEMENTS[curr.userData.settlementId];
      if (s) {
        (document.getElementById('inspector-name') as HTMLElement).textContent = s.name;
        (document.getElementById('inspect-pop') as HTMLElement).textContent = s.population.toLocaleString();
        (document.getElementById('inspect-hap') as HTMLElement).textContent = `${s.happiness}%`;
        (document.getElementById('inspect-prod') as HTMLElement).textContent = `${s.production}/h`;
        (document.getElementById('inspect-food') as HTMLElement).textContent = `${s.food}/h`;
        (document.getElementById('inspect-status') as HTMLElement).textContent = s.status;
      }
    }
  }
});

// Responsive Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// 14. ANIMATION & RENDER LOOP
// ============================================================================
let clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Subtle water surface motion
  waterMesh.position.y = 0.2 + Math.sin(time * 1.5) * 0.1;

  // Volcanic smoke plume rising
  const posArr = smokeParticles.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < smokeCount; i++) {
    posArr[i * 3 + 1] += smokeSpeeds[i] * (delta * 60);
    posArr[i * 3] += (Math.sin(time + i) * 0.04);
    if (posArr[i * 3 + 1] > 50) {
      posArr[i * 3 + 1] = 25;
      posArr[i * 3] = 48 + (Math.random() - 0.5) * 3;
    }
  }
  smokeParticles.geometry.attributes.position.needsUpdate = true;

  // Citizens moving along routes
  citizens.forEach((c) => {
    c.progress = (c.progress + c.speed) % 1;
    c.mesh.position.lerpVectors(c.start, c.end, c.progress);
    c.mesh.position.y = 0.5 + Math.abs(Math.sin(c.progress * Math.PI * 8)) * 0.15;
  });

  // Slow autonomous camera glide when user is idle
  if (!isDragging) {
    camTheta += 0.0003;
    camera.position.x = Math.sin(camTheta) * Math.sin(camPhi) * camRadius;
    camera.position.z = Math.cos(camTheta) * Math.sin(camPhi) * camRadius;
    camera.lookAt(0, 0, -5);
  }

  updateMinimap();
  renderer.render(scene, camera);
}

animate();

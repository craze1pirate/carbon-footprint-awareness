/**
 * visualization.js
 * CarbonMirror — Dynamic Planet Visualization
 * Uses Three.js (CDN) with graceful CSS/Canvas 2D fallback.
 * Exports: initPlanet(canvasEl), updatePlanet(kg), destroyPlanet()
 */

// ─── THREE.JS IMPORT ────────────────────────────────────────────────────────
let THREE = null;

/**
 * Attempt to load Three.js from CDN.
 * Returns the THREE namespace or null on failure.
 */
async function loadThree() {
  try {
    const mod = await import('https://esm.sh/three@0.165.0');
    return mod;
  } catch (e) {
    console.warn('[CarbonMirror] Three.js failed to load, using Canvas 2D fallback.', e);
    return null;
  }
}

// ─── TIER DEFINITIONS ───────────────────────────────────────────────────────
const TIER_STATES = {
  green: {
    landColor: [0x27, 0xAE, 0x60],
    oceanColor: [0x21, 0x80, 0xB9],
    cloudOpacity: 0.75,
    smogOpacity: 0.0,
    smogColor: [0.4, 0.5, 0.4],
    atmosphereColor: [0x52, 0xBE, 0x80],
    particleDensity: 0,
    degradation: 0.0,
    label: 'Carbon Champion — Pristine Earth',
  },
  yellow: {
    landColor: [0x6E, 0x9C, 0x50],
    oceanColor: [0x1F, 0x72, 0xAB],
    cloudOpacity: 0.6,
    smogOpacity: 0.18,
    smogColor: [0.7, 0.7, 0.4],
    atmosphereColor: [0xF3, 0x9C, 0x12],
    particleDensity: 0.3,
    degradation: 0.3,
    label: 'Average Citizen — Mild Environmental Stress',
  },
  orange: {
    landColor: [0x8B, 0x7D, 0x3A],
    oceanColor: [0x1A, 0x60, 0x90],
    cloudOpacity: 0.4,
    smogOpacity: 0.45,
    smogColor: [0.85, 0.55, 0.2],
    atmosphereColor: [0xE6, 0x7E, 0x22],
    particleDensity: 0.7,
    degradation: 0.65,
    label: 'Heavy Footprint — Significant Degradation',
  },
  red: {
    landColor: [0x6B, 0x50, 0x2A],
    oceanColor: [0x15, 0x45, 0x65],
    cloudOpacity: 0.2,
    smogOpacity: 0.72,
    smogColor: [0.75, 0.25, 0.15],
    atmosphereColor: [0xC0, 0x39, 0x2B],
    particleDensity: 1.0,
    degradation: 1.0,
    label: 'Climate Emergency — Critical Earth State',
  },
};

// ─── STATE ──────────────────────────────────────────────────────────────────
let state = {
  mode: 'none',
  scene: null,
  camera: null,
  renderer: null,
  planet: null,
  atmosphere: null,
  clouds: null,
  smogSphere: null,
  particles: null,
  animFrame: null,
  autoRotate: true,
  currentTier: 'green',
  targetTier: 'green',
  lerpProgress: 1.0,
  canvas: null,
  ctx: null,
  canvasAngle: 0,
  pageVisible: true,
};

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Initialize the planet visualization.
 * @param {HTMLCanvasElement} canvasEl - Target canvas element.
 */
export async function initPlanet(canvasEl) {
  state.canvas = canvasEl;

  if (isWebGLAvailable(canvasEl)) {
    THREE = await loadThree();
  }

  if (THREE) {
    await initThreePlanet(canvasEl);
    state.mode = 'three';
  } else {
    initCanvas2DPlanet(canvasEl);
    state.mode = 'canvas2d';
  }

  document.addEventListener('visibilitychange', () => {
    state.pageVisible = !document.hidden;
    if (!document.hidden && state.animFrame === null) {
      startAnimLoop();
    }
  });
}

/**
 * Update the planet to reflect new CO₂ emissions.
 * @param {number} kg - Annual CO₂ in kg.
 */
export function updatePlanet(kg) {
  const tier = getTierFromKg(kg);
  if (tier === state.currentTier && state.lerpProgress >= 1.0) return;

  state.targetTier = tier;
  state.lerpProgress = 0;

  if (state.canvas) {
    const wrapper = state.canvas.closest('[role="img"]') || state.canvas.parentElement;
    if (wrapper) {
      wrapper.setAttribute('aria-label', TIER_STATES[tier].label + ` — ${Math.round(kg).toLocaleString('en-IN')} kg CO₂/year`);
    }
  }

  updateSmogOverlay(tier);

  if (state.mode === 'canvas2d') {
    state.currentTier = tier;
    drawCanvas2D();
  }
}

/**
 * Toggle auto-rotation of the planet.
 * @returns {boolean} Current autoRotate state.
 */
export function toggleRotation() {
  state.autoRotate = !state.autoRotate;
  return state.autoRotate;
}

/**
 * Reset camera/view to default.
 */
export function resetView() {
  if (state.mode === 'three' && state.camera) {
    state.camera.position.set(0, 0, 3);
    state.camera.lookAt(0, 0, 0);
  }
  if (state.mode === 'canvas2d') {
    state.canvasAngle = 0;
    drawCanvas2D();
  }
}

/**
 * Destroy and clean up the visualization.
 */
export function destroyPlanet() {
  cancelAnimationFrame(state.animFrame);
  state.animFrame = null;
  if (state.renderer) {
    state.renderer.dispose();
    state.renderer = null;
  }
  state.scene = state.camera = state.planet = state.atmosphere = state.clouds = state.smogSphere = null;
  state.mode = 'none';
}

// ─── THREE.JS IMPLEMENTATION ─────────────────────────────────────────────────

/**
 * Configures the Three.js camera, directional lighting, materials, and stars.
 * @param {HTMLCanvasElement} canvasEl - Target canvas.
 */
async function initThreePlanet(canvasEl) {
  const { Scene, PerspectiveCamera, WebGLRenderer,
    SphereGeometry, MeshPhongMaterial, Mesh,
    AmbientLight, DirectionalLight, Color,
    AdditiveBlending, FogExp2,
    Points, PointsMaterial, BufferGeometry,
    Float32BufferAttribute, BackSide, MeshBasicMaterial } = THREE;

  const scene = new Scene();
  scene.background = new Color(0x030812);
  scene.fog = new FogExp2(0x030812, 0.025);

  const w = canvasEl.clientWidth || canvasEl.offsetWidth || 400;
  const h = canvasEl.clientHeight || canvasEl.offsetHeight || 400;
  const camera = new PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 0, 3);

  const renderer = new WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);

  const ambientLight = new AmbientLight(0x404060, 1.2);
  scene.add(ambientLight);

  const sunLight = new DirectionalLight(0xFFF4E0, 2.5);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  const rimLight = new DirectionalLight(0x2040A0, 0.4);
  rimLight.position.set(-5, -2, -3);
  scene.add(rimLight);

  const planetGeo = new SphereGeometry(1, 64, 64);
  const planetMat = new MeshPhongMaterial({
    color: rgbToHex(TIER_STATES.green.landColor),
    shininess: 30,
    specular: new Color(0x224422),
  });
  const planet = new Mesh(planetGeo, planetMat);
  scene.add(planet);

  const atmGeo = new SphereGeometry(1.08, 32, 32);
  const atmMat = new MeshBasicMaterial({
    color: rgbToHex(TIER_STATES.green.atmosphereColor),
    transparent: true,
    opacity: 0.12,
    side: BackSide,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const atmosphere = new Mesh(atmGeo, atmMat);
  scene.add(atmosphere);

  const cloudGeo = new SphereGeometry(1.03, 32, 32);
  const cloudMat = new MeshPhongMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: TIER_STATES.green.cloudOpacity,
    depthWrite: false,
  });
  const clouds = new Mesh(cloudGeo, cloudMat);
  scene.add(clouds);

  const smogGeo = new SphereGeometry(1.12, 24, 24);
  const smogMat = new MeshBasicMaterial({
    color: 0x886644,
    transparent: true,
    opacity: 0,
    side: BackSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const smogSphere = new Mesh(smogGeo, smogMat);
  scene.add(smogSphere);

  const starCount = 1500;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPositions[i] = (Math.random() - 0.5) * 200;
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
  const starMat = new PointsMaterial({ color: 0xFFFFFF, size: 0.15, sizeAttenuation: true });
  const stars = new Points(starGeo, starMat);
  scene.add(stars);

  const particleCount = 300;
  const pPositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const r = 1.15 + Math.random() * 0.3;
    pPositions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
    pPositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
    pPositions[i * 3 + 2] = r * Math.cos(theta);
  }
  const pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new Float32BufferAttribute(pPositions, 3));
  const pMat = new PointsMaterial({
    color: 0xAA8844,
    size: 0.03,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new Points(pGeo, pMat);
  scene.add(particles);

  addMouseDrag(canvasEl, planet, clouds);

  Object.assign(state, { scene, camera, renderer, planet, atmosphere, clouds, smogSphere, particles });

  const resizeObs = new ResizeObserver(() => {
    const w2 = canvasEl.clientWidth || 400;
    const h2 = canvasEl.clientHeight || 400;
    camera.aspect = w2 / h2;
    camera.updateProjectionMatrix();
    renderer.setSize(w2, h2);
  });
  resizeObs.observe(canvasEl.parentElement || canvasEl);

  startAnimLoop();
}

/**
 * Initiates the main requestAnimationFrame loop for continuous rendering and rotation.
 */
function startAnimLoop() {
  if (state.animFrame) cancelAnimationFrame(state.animFrame);

  const tick = () => {
    if (!state.pageVisible) { state.animFrame = null; return; }
    state.animFrame = requestAnimationFrame(tick);

    if (state.lerpProgress < 1.0) {
      state.lerpProgress = Math.min(1.0, state.lerpProgress + 0.008);
      applyThreeLerp(state.lerpProgress);
    }

    if (state.mode === 'three') {
      if (state.autoRotate) {
        if (state.planet) state.planet.rotation.y += 0.002;
        if (state.clouds) state.clouds.rotation.y += 0.0025;
        if (state.smogSphere) state.smogSphere.rotation.y -= 0.001;
      }
      state.renderer.render(state.scene, state.camera);

    } else if (state.mode === 'canvas2d') {
      if (state.autoRotate) state.canvasAngle += 0.005;
      drawCanvas2D();
    }
  };

  state.animFrame = requestAnimationFrame(tick);
}

/**
 * Performs intermediate frame interpolation (lerping) between two footprint tiers.
 * @param {number} t - Lerp factor between 0 and 1.
 */
function applyThreeLerp(t) {
  if (!state.planet) return;
  const from = TIER_STATES[state.currentTier];
  const to = TIER_STATES[state.targetTier];

  const landColor = lerpColor(from.landColor, to.landColor, t);
  const atmColor = lerpColor(from.atmosphereColor, to.atmosphereColor, t);
  const smogCol = lerpColor(
    [Math.round(from.smogColor[0] * 255), Math.round(from.smogColor[1] * 255), Math.round(from.smogColor[2] * 255)],
    [Math.round(to.smogColor[0] * 255), Math.round(to.smogColor[1] * 255), Math.round(to.smogColor[2] * 255)],
    t
  );

  if (state.planet.material) {
    state.planet.material.color.setHex(rgbToHex(landColor));
  }
  if (state.atmosphere?.material) {
    state.atmosphere.material.color.setHex(rgbToHex(atmColor));
  }

  const smogOpacity = lerp(from.smogOpacity, to.smogOpacity, t);
  const cloudOpacity = lerp(from.cloudOpacity, to.cloudOpacity, t);
  const partDensity = lerp(from.particleDensity, to.particleDensity, t);

  if (state.smogSphere?.material) {
    state.smogSphere.material.opacity = smogOpacity;
    state.smogSphere.material.color.setHex(rgbToHex(smogCol));
  }
  if (state.clouds?.material) {
    state.clouds.material.opacity = cloudOpacity;
  }
  if (state.particles?.material) {
    state.particles.material.opacity = partDensity * 0.6;
  }

  if (t >= 1.0) {
    state.currentTier = state.targetTier;
  }
}

// ─── CANVAS 2D FALLBACK ──────────────────────────────────────────────────────

/**
 * Standard initialization fallback for Canvas 2D when WebGL is unavailable.
 * @param {HTMLCanvasElement} canvasEl - Target canvas.
 */
function initCanvas2DPlanet(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  state.ctx = ctx;

  const parent = canvasEl.parentElement;
  const size = Math.min(parent?.clientWidth || 400, parent?.clientHeight || 400, 400);
  canvasEl.width = size;
  canvasEl.height = size;

  drawCanvas2D();
  startAnimLoop();
}

/**
 * Draws the 2D alternative planet view with stars, ocean, continents, and smog layers.
 */
function drawCanvas2D() {
  const canvas = state.canvas;
  const ctx = state.ctx;
  if (!ctx || !canvas) return;

  const w = canvas.width || 400;
  const h = canvas.height || 400;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.42;

  const tier = state.currentTier;
  const ts = TIER_STATES[tier];
  const landHex = rgbToHex(ts.landColor);
  const atmHex = rgbToHex(ts.atmosphereColor);

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#030812';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  for (let i = 0; i < 120; i++) {
    const sx = pseudoRandom(i * 17) * w;
    const sy = pseudoRandom(i * 31) * h;
    const ss = pseudoRandom(i * 7) * 1.5 + 0.3;
    ctx.beginPath();
    ctx.arc(sx, sy, ss, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.3 + pseudoRandom(i * 13) * 0.7})`;
    ctx.fill();
  }
  ctx.restore();

  const atmGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.2);
  atmGrad.addColorStop(0, `${hexToRgba(atmHex, 0.3)}`);
  atmGrad.addColorStop(1, `${hexToRgba(atmHex, 0)}`);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
  ctx.fillStyle = atmGrad;
  ctx.fill();

  const planetGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
  planetGrad.addColorStop(0, '#4FC3F7');
  planetGrad.addColorStop(0.5, '#1976D2');
  planetGrad.addColorStop(1, '#0D47A1');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = planetGrad;
  ctx.fill();

  drawLandMasses(ctx, cx, cy, r, landHex, ts.degradation, state.canvasAngle);

  if (ts.smogOpacity > 0.01) {
    const smogGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    const sc = ts.smogColor;
    smogGrad.addColorStop(0, `rgba(${Math.round(sc[0] * 255)},${Math.round(sc[1] * 255)},${Math.round(sc[2] * 255)},0)`);
    smogGrad.addColorStop(1, `rgba(${Math.round(sc[0] * 255)},${Math.round(sc[1] * 255)},${Math.round(sc[2] * 255)},${ts.smogOpacity})`);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = smogGrad;
    ctx.fill();
  }

  const shadeGrad = ctx.createRadialGradient(cx + r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  shadeGrad.addColorStop(0, 'rgba(255,255,200,0.12)');
  shadeGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = shadeGrad;
  ctx.fill();

  if (ts.cloudOpacity > 0.1) {
    ctx.save();
    ctx.globalAlpha = ts.cloudOpacity * 0.6;
    ctx.fillStyle = 'white';
    drawClouds(ctx, cx, cy, r, state.canvasAngle);
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.restore();
}

/**
 * Draws simplified 2D land continent ellipsis paths on the canvas.
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {number} cx - Center coordinate X.
 * @param {number} cy - Center coordinate Y.
 * @param {number} r - Planet radius.
 * @param {string} color - Current hex land color.
 * @param {number} degradation - Active degradation percentage.
 * @param {number} angle - Rotate angle.
 */
function drawLandMasses(ctx, cx, cy, r, color, degradation, angle) {
  const continents = [
    { x: 0.15, y: -0.25, rx: 0.22, ry: 0.35 },
    { x: -0.3, y: 0.1, rx: 0.18, ry: 0.28 },
    { x: 0.2, y: 0.3, rx: 0.14, ry: 0.20 },
    { x: 0.4, y: 0.15, rx: 0.12, ry: 0.15 },
    { x: -0.05, y: 0.55, rx: 0.09, ry: 0.07 },
  ];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  for (const c of continents) {
    const lx = c.x * r;
    const ly = c.y * r;
    const lrx = c.rx * r;
    const lry = c.ry * r;

    ctx.beginPath();
    ctx.ellipse(lx, ly, lrx, lry, angle * 0.5, 0, Math.PI * 2);

    const r1 = parseInt(color.slice(1, 3), 16);
    const g1 = parseInt(color.slice(3, 5), 16);
    const b1 = parseInt(color.slice(5, 7), 16);

    const r2 = 0x6B, g2 = 0x50, b2 = 0x2A;
    const dr = Math.round(lerp(r1, r2, degradation));
    const dg = Math.round(lerp(g1, g2, degradation));
    const db = Math.round(lerp(b1, b2, degradation));

    ctx.fillStyle = `rgb(${dr},${dg},${db})`;
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws 2D moving clouds above ocean/continents.
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {number} cx - Center coordinate X.
 * @param {number} cy - Center coordinate Y.
 * @param {number} r - Planet radius.
 * @param {number} angle - Cloud rotate angle.
 */
function drawClouds(ctx, cx, cy, r, angle) {
  const clouds = [
    { x: -0.1, y: -0.15, w: 0.4, h: 0.06 },
    { x: 0.2, y: 0.25, w: 0.3, h: 0.05 },
    { x: -0.35, y: 0.05, w: 0.25, h: 0.04 },
    { x: 0.05, y: 0.45, w: 0.2, h: 0.04 },
  ];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle * 1.2);
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x * r, c.y * r, c.w * r * 0.5, c.h * r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Updates CSS opacity overlay based on active tier smog density values.
 * @param {string} tier - Active tier.
 */
function updateSmogOverlay(tier) {
  const smogEl = document.getElementById('smog-overlay');
  if (!smogEl) return;
  const ts = TIER_STATES[tier];
  smogEl.style.opacity = String(ts.smogOpacity);
  smogEl.style.transition = 'opacity 1.5s ease';
}

/**
 * Binds mouse and touch events to enable dynamic, physical rotation.
 * @param {HTMLCanvasElement} canvas - Target canvas.
 * @param {Object} planet - Three.js Planet mesh.
 * @param {Object} clouds - Three.js Cloud mesh.
 */
function addMouseDrag(canvas, planet, clouds) {
  let isDragging = false;
  let prevX = 0, prevY = 0;

  const onDown = (e) => {
    isDragging = true;
    state.autoRotate = false;
    const point = e.touches ? e.touches[0] : e;
    prevX = point.clientX;
    prevY = point.clientY;
  };
  const onMove = (e) => {
    if (!isDragging) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = (point.clientX - prevX) * 0.005;
    const dy = (point.clientY - prevY) * 0.005;
    if (planet) { planet.rotation.y += dx; planet.rotation.x += dy; }
    if (clouds) { clouds.rotation.y += dx; clouds.rotation.x += dy; }
    prevX = point.clientX;
    prevY = point.clientY;
  };
  const onUp = () => { isDragging = false; };

  canvas.addEventListener('mousedown', onDown, { passive: true });
  canvas.addEventListener('mousemove', onMove, { passive: true });
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('touchend', onUp);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Validates WebGL rendering context on current canvas element.
 * @param {HTMLCanvasElement} canvas - Target canvas.
 * @returns {boolean} WebGL availability status.
 */
function isWebGLAvailable(canvas) {
  try {
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!ctx;
  } catch (e) {
    return false;
  }
}

/**
 * Returns active tier based on total CO2 in kg.
 * @param {number} kg - Annual CO2 in kg.
 * @returns {string} Assigned tier string.
 */
function getTierFromKg(kg) {
  if (kg < 1500) return 'green';
  if (kg < 3000) return 'yellow';
  if (kg < 6000) return 'orange';
  return 'red';
}

/**
 * Simple linear interpolation (lerping) calculation.
 * @param {number} a - First value.
 * @param {number} b - Second value.
 * @param {number} t - Lerp factor (0 to 1).
 * @returns {number} Interpolated value.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Interpolates color channels smoothly between two RGB arrays.
 * @param {Array<number>} fromRgb - Starting RGB color array.
 * @param {Array<number>} toRgb - Target RGB color array.
 * @param {number} t - Lerp factor (0 to 1).
 * @returns {Array<number>} Interpolated RGB color channel array.
 */
function lerpColor(fromRgb, toRgb, t) {
  return [
    Math.round(lerp(fromRgb[0], toRgb[0], t)),
    Math.round(lerp(fromRgb[1], toRgb[1], t)),
    Math.round(lerp(fromRgb[2], toRgb[2], t)),
  ];
}

/**
 * Bit-shifts an RGB channel array into a single hex-ready representation.
 * @param {Array<number>} arr - Target RGB color array.
 * @returns {number} Hex number value.
 */
function rgbToHex(arr) {
  return (arr[0] << 16) | (arr[1] << 8) | arr[2];
}

/**
 * Parses a hex color string to its corresponding rgba representation.
 * @param {string} hex - Hex color string.
 * @param {number} alpha - Target opacity (0 to 1).
 * @returns {string} Formatted RGBA string.
 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Deterministic pseudo-random seed generator.
 * @param {number} seed - Target seed value.
 * @returns {number} Pseudo-random number between 0 and 1.
 */
function pseudoRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}
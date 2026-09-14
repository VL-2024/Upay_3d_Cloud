// Сцена: камера сверху под углом, свет, игровое поле, невидимые физические границы.
import {
  Scene,
  Color3,
  Color4,
  Vector3,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Viewport,
} from '@babylonjs/core';
import { CONFIG } from './config.js';
import { createStaticBoxBody } from './physics.js';

/** Создаёт сцену, камеру и свет. Поле и границы требуют включённой физики
 * (см. createEnvironment) — их создают отдельным вызовом после initPhysics(). */
export function createScene(engine, canvas) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.045, 0.06, 1);

  const camera = createCamera(scene, canvas);
  const lights = createLights(scene);

  return { scene, camera, lights };
}

/** Создаёт игровое поле и невидимые физические границы. Вызывать после initPhysics(scene). */
export function createEnvironment(scene) {
  const ground = createGround(scene);
  const boundaries = createBoundaries(scene);
  return { ground, boundaries };
}

function createCamera(scene, canvas) {
  // Вертикальная (mobile-first) ориентация: смотрим на поле сверху под небольшим углом.
  const camera = new ArcRotateCamera(
    'mainCamera',
    -Math.PI / 2, // alpha: смотрим вдоль -Z
    0.38, // beta: небольшой наклон от вертикали (0 = строго сверху)
    7.6, // radius
    new Vector3(0, 0, 0.15),
    scene
  );
  // Камера зафиксирована: указатель целиком отдан игровому вводу (tap/swipe по чүкө),
  // а не орбите камеры.
  camera.inputs.clear();

  // Рабочая зона физики не пересекается с нижним UI: рендерим камеру только
  // в верхней части канваса, нижняя полоса остаётся для HTML-интерфейса.
  const bottom = CONFIG.ui.bottomReservedFraction;
  camera.viewport = new Viewport(0, bottom, 1, 1 - bottom);
  scene.activeCamera = camera;

  return camera;
}

function createLights(scene) {
  const hemi = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.75;
  hemi.groundColor = new Color3(0.15, 0.1, 0.08);

  const dir = new DirectionalLight('dirLight', new Vector3(-0.35, -1, -0.25), scene);
  dir.position = new Vector3(2, 4, 2);
  dir.intensity = 0.65;

  return { hemi, dir };
}

function createGround(scene) {
  const { width, depth } = CONFIG.workArea;
  const ground = MeshBuilder.CreateGround('ground', { width, height: depth }, scene);

  const mat = new StandardMaterial('groundMat', scene);
  mat.diffuseColor = new Color3(0.52, 0.16, 0.13); // шырдак/ковёр — тёплый терракотовый
  mat.specularColor = Color3.Black();
  ground.material = mat;
  ground.receiveShadows = true;

  // Плоскость ground имеет нулевую высоту AABB — задаём коллайдеру явную
  // толщину и смещаем его вниз, чтобы верхняя грань совпадала с видимым
  // ковром (иначе быстрые объекты туннелируют сквозь бумажно-тонкий пол).
  const groundThickness = 0.2;
  createStaticBoxBody(ground, {
    friction: CONFIG.physics.groundFriction,
    restitution: CONFIG.physics.groundRestitution,
    extents: new Vector3(width, groundThickness, depth),
    center: new Vector3(0, -groundThickness / 2, 0),
  });

  return ground;
}

function createBoundaries(scene) {
  const { width, depth, wallHeight, wallThickness } = CONFIG.workArea;
  const mats = new StandardMaterial('wallMat', scene);
  mats.alpha = 0; // невидимые ограничители

  const walls = [];
  const defs = [
    { name: 'wallNorth', w: width + wallThickness * 2, d: wallThickness, x: 0, z: depth / 2 },
    { name: 'wallSouth', w: width + wallThickness * 2, d: wallThickness, x: 0, z: -depth / 2 },
    { name: 'wallEast', w: wallThickness, d: depth, x: width / 2, z: 0 },
    { name: 'wallWest', w: wallThickness, d: depth, x: -width / 2, z: 0 },
  ];

  for (const def of defs) {
    const wall = MeshBuilder.CreateBox(
      def.name,
      { width: def.w, height: wallHeight, depth: def.d },
      scene
    );
    wall.position.set(def.x, wallHeight / 2, def.z);
    wall.isVisible = false;
    wall.material = mats;
    createStaticBoxBody(wall, {
      friction: CONFIG.physics.wallFriction,
      restitution: CONFIG.physics.wallRestitution,
    });
    walls.push(wall);
  }

  return walls;
}

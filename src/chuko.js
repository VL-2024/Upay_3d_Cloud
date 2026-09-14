// Создание обычного чүкө: процедурная 3D-модель (временная, не финальная),
// metadata, состояние и физика.
//
// Форма: вытянутая по локальной оси X "капсула с квадратным сечением" —
// прямоугольный блок со скруглёнными торцами. У такой формы ровно 4 плоские
// устойчивые грани (±Y, ±Z), а скруглённые торцы не дают устойчиво стоять
// "на попа" — это приближённо повторяет поведение настоящей астрагала (чүкө),
// у которой тоже 4 устойчивых положения.
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  CSG,
  Quaternion,
  Vector3,
} from '@babylonjs/core';

let hitProxyMaterial = null;
function getHitProxyMaterial(scene) {
  if (!hitProxyMaterial || hitProxyMaterial.getScene() !== scene) {
    hitProxyMaterial = new StandardMaterial('hitProxyMat', scene);
    hitProxyMaterial.alpha = 0; // визуально прозрачен
  }
  return hitProxyMaterial;
}
import { CONFIG } from './config.js';
import { createDynamicBody } from './physics.js';

let chukoIdCounter = 0;

function buildChukoGeometry(scene, isKhan) {
  const size = CONFIG.chukoSize;
  const scale = isKhan ? CONFIG.khanScale : CONFIG.chukoScale;
  const len = size.length * scale;
  const w = size.width * scale;
  const h = size.height * scale;
  const capDiameter = Math.max(w, h);
  const bodyLength = Math.max(len - capDiameter, capDiameter * 0.4);

  const box = MeshBuilder.CreateBox('tmp_box', { width: bodyLength, height: h, depth: w }, scene);
  const capA = MeshBuilder.CreateSphere('tmp_capA', { diameter: capDiameter, segments: 10 }, scene);
  capA.scaling.set(1, h / capDiameter, w / capDiameter);
  capA.position.x = bodyLength / 2;
  const capB = capA.clone('tmp_capB');
  capB.position.x = -bodyLength / 2;

  const result = CSG.FromMesh(box).union(CSG.FromMesh(capA)).union(CSG.FromMesh(capB));
  const name = isKhan ? 'khan' : `chuko_${chukoIdCounter++}`;
  const mesh = result.toMesh(name, null, scene);

  box.dispose();
  capA.dispose();
  capB.dispose();

  return mesh;
}

/**
 * Реальная геометрия чүкө на экране мала (особенно на телефоне), и точный
 * pointer-пик по видимому мешу часто промахивается. Невидимая сфера-прокси
 * большего диаметра, дочерняя мешу, даёт удобную область попадания и
 * наследует позицию/поворот родителя автоматически (в т.ч. когда физика
 * двигает mesh).
 */
function createHitProxy(mesh, scene) {
  const proxy = MeshBuilder.CreateSphere(
    `${mesh.name}_hitProxy`,
    { diameter: CONFIG.chukoSize.hitProxyDiameter, segments: 6 },
    scene
  );
  proxy.parent = mesh;
  proxy.position = Vector3.Zero();
  // Scene.pick по умолчанию пропускает isVisible=false, поэтому делаем
  // меш видимым, но полностью прозрачным (alpha=0) — так он остаётся
  // "пикающимся", не будучи заметным.
  proxy.isVisible = true;
  proxy.isPickable = true;
  proxy.material = getHitProxyMaterial(scene);
  proxy.metadata = { proxyFor: mesh };
  return proxy;
}

function applyMaterial(mesh, scene, isKhan) {
  const mat = new StandardMaterial(`${mesh.name}_mat`, scene);
  mat.diffuseColor = isKhan
    ? new Color3(0.86, 0.68, 0.14)
    : new Color3(0.86, 0.81, 0.69);
  mat.specularColor = new Color3(0.18, 0.18, 0.18);
  mat.emissiveColor = Color3.Black();
  mesh.material = mat;
}

/** Создаёт меш + физику + metadata для обычного чүкө или Хана (isKhan=true). */
export function createChuko(scene, isKhan = false) {
  const mesh = buildChukoGeometry(scene, isKhan);
  applyMaterial(mesh, scene, isKhan);
  mesh.rotationQuaternion = Quaternion.Identity();
  mesh.isPickable = false; // пикается только увеличенный hitProxy, см. ниже

  const massProps = isKhan
    ? { mass: CONFIG.physics.khanMass }
    : { mass: CONFIG.physics.chukoMass };
  const body = createDynamicBody(mesh, massProps);
  const hitProxy = createHitProxy(mesh, scene);

  mesh.metadata = {
    id: mesh.name,
    isKhan,
    orientation: null,
    orientationConfidence: 0,
    state: 'idle', // idle | source | target | flicking | collected | disabled
    khanUnlocked: false,
    body,
    hitProxy,
  };

  return mesh;
}

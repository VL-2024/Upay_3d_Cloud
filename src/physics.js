// Havok: инициализация плагина, создание rigid body, проверка стабильности.
import {
  Vector3,
  Quaternion,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeConvexHull,
  PhysicsShapeBox,
  HavokPlugin,
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { CONFIG } from './config.js';

let hkPlugin = null;

/** Загружает Havok wasm и включает физику на сцене. */
export async function initPhysics(scene) {
  const havokInstance = await HavokPhysics();
  // useDeltaForWorldStep=false: физика всегда шагает фиксированным тиком
  // (1/60с), а не реальной (возможно большой) длительностью кадра. Иначе
  // при просадках FPS один большой физический шаг может "пробить" тонкий
  // статический коллайдер (туннелирование быстро падающих объектов).
  hkPlugin = new HavokPlugin(false, havokInstance);
  scene.enablePhysics(new Vector3(0, CONFIG.physics.gravity, 0), hkPlugin);
  return hkPlugin;
}

export function getHavokPlugin() {
  return hkPlugin;
}

/**
 * Создаёт динамическое rigid body для меша чүкө/Хана на основе выпуклой оболочки.
 * massProps: { mass, friction, restitution, linearDamping, angularDamping }
 */
export function createDynamicBody(mesh, massProps = {}) {
  const scene = mesh.getScene();
  const body = new PhysicsBody(mesh, PhysicsMotionType.DYNAMIC, false, scene);
  const shape = new PhysicsShapeConvexHull(mesh, scene);
  shape.material = {
    friction: massProps.friction ?? CONFIG.physics.friction,
    restitution: massProps.restitution ?? CONFIG.physics.restitution,
  };
  body.shape = shape;
  body.setMassProperties({ mass: massProps.mass ?? CONFIG.physics.chukoMass });
  body.setLinearDamping(massProps.linearDamping ?? CONFIG.physics.linearDamping);
  body.setAngularDamping(massProps.angularDamping ?? CONFIG.physics.angularDamping);
  return body;
}

/**
 * Создаёт статическое тело (поле, стены) на основе явного размера бокса.
 * Размер AABB меша НЕ используется напрямую: у плоскости (ground) высота
 * равна нулю, а бумажно-тонкий коллайдер даёт туннелирование быстрых
 * объектов сквозь пол. Передавайте extents (Vector3) явно, либо задайте
 * minThickness, чтобы подстраховаться от вырожденного AABB.
 */
export function createStaticBoxBody(mesh, options = {}) {
  const scene = mesh.getScene();
  const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
  const aabb = mesh.getBoundingInfo().boundingBox.extendSize.scale(2);
  const minThickness = options.minThickness ?? 0.2;
  const extents =
    options.extents ??
    new Vector3(Math.max(aabb.x, minThickness), Math.max(aabb.y, minThickness), Math.max(aabb.z, minThickness));
  const center = options.center ?? Vector3.Zero();
  const shape = new PhysicsShapeBox(center, Quaternion.Identity(), extents, scene);
  shape.material = {
    friction: options.friction ?? CONFIG.physics.groundFriction,
    restitution: options.restitution ?? CONFIG.physics.groundRestitution,
  };
  body.shape = shape;
  body.setMassProperties({ mass: 0 });
  return body;
}

/** true, если тело почти неподвижно (линейная и угловая скорости ниже порога). */
export function isBodySlow(body, thresholds = CONFIG.stability) {
  const lv = body.getLinearVelocity();
  const av = body.getAngularVelocity();
  return (
    lv.length() < thresholds.linearVelocityThreshold &&
    av.length() < thresholds.angularVelocityThreshold
  );
}

/** Мгновенно останавливает тело (используется перед рассыпанием). */
export function resetBodyMotion(body) {
  body.setLinearVelocity(Vector3.Zero());
  body.setAngularVelocity(Vector3.Zero());
}

// collector.js: зоны накопления УПАЙ 1/2 (§11 ТЗ).
//
// После успешного хода целевой (и исходный) чүкө исключаются из дальнейшего
// выбора и переносятся в зону накопления короткой дуговой анимацией,
// сохраняя сам 3D-объект (не заменяется иконкой). УПАЙ 1 заполняет первые
// 3 слота, УПАЙ 2 — следующие три (после первого полного Упай).
import {
  Vector3,
  Animation,
  EasingFunction,
  CubicEase,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PhysicsMotionType,
} from '@babylonjs/core';
import { CONFIG } from './config.js';

function slotPosition(zoneCenter, slotIndex, spacing) {
  const offset = (slotIndex - 1) * spacing; // 3 слота, центрированные вокруг zoneCenter
  return new Vector3(zoneCenter.x + offset, 0.006, zoneCenter.z);
}

function buildZoneSlots(scene, zoneCenter, material, config) {
  const slots = [];
  for (let i = 0; i < config.scenario.pairsPerUpay; i++) {
    const disk = MeshBuilder.CreateCylinder(
      `collectorSlot_${zoneCenter.x}_${i}`,
      { diameter: config.collector.slotDiameter, height: 0.006 },
      scene
    );
    disk.position = slotPosition(zoneCenter, i, config.collector.slotSpacing);
    disk.material = material;
    disk.isPickable = false;
    disk.metadata = { filled: false };
    slots.push(disk);
  }
  return slots;
}

/** Строит визуальные слоты УПАЙ 1 и УПАЙ 2. Вызывать один раз при инициализации сцены. */
export function createCollector(scene, config = CONFIG) {
  const mat = new StandardMaterial('collectorSlotMat', scene);
  mat.diffuseColor = new Color3(0.32, 0.25, 0.14);
  mat.alpha = 0.6;

  const z = config.collector.zones;
  const upay1Slots = buildZoneSlots(scene, new Vector3(z.upay1.x, 0, z.upay1.z), mat, config);
  const upay2Slots = buildZoneSlots(scene, new Vector3(z.upay2.x, 0, z.upay2.z), mat, config);

  return { upay1Slots, upay2Slots };
}

/** Сбрасывает слоты к пустому виду (новый билет). */
export function resetCollector(collector) {
  for (const slot of [...collector.upay1Slots, ...collector.upay2Slots]) {
    slot.metadata.filled = false;
  }
}

/**
 * Переносит собранный чүкө в слот (upayIndex 0|1, slotIndex 0..pairsPerUpay-1)
 * короткой дуговой анимацией и замораживает его там. onComplete вызывается
 * по завершении переноса.
 */
export function collectPiece(mesh, collector, upayIndex, slotIndex, config = CONFIG, onComplete) {
  const slots = upayIndex === 0 ? collector.upay1Slots : collector.upay2Slots;
  const slot = slots[slotIndex];
  slot.metadata.filled = true;

  const body = mesh.metadata.body;
  body.setLinearVelocity(Vector3.Zero());
  body.setAngularVelocity(Vector3.Zero());
  // ANIMATED: физика больше не двигает объект сама, но мы вольны анимировать
  // его transform напрямую (в отличие от STATIC, предназначенного для
  // неподвижной геометрии сцены).
  body.setMotionType(PhysicsMotionType.ANIMATED);

  const from = mesh.position.clone();
  const to = slot.position.clone();
  to.y = from.y;

  const fps = 30;
  const durationFrames = Math.max(1, Math.round((config.collector.arcDurationMs / 1000) * fps));
  const mid = Vector3.Lerp(from, to, 0.5);
  mid.y = Math.max(from.y, to.y) + config.collector.arcHeight;

  const posAnim = new Animation(
    `${mesh.name}_collectArc`,
    'position',
    fps,
    Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  posAnim.setKeys([
    { frame: 0, value: from },
    { frame: durationFrames / 2, value: mid },
    { frame: durationFrames, value: to },
  ]);
  const easing = new CubicEase();
  easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
  posAnim.setEasingFunction(easing);

  mesh.animations = [posAnim];
  mesh.getScene().beginAnimation(mesh, 0, durationFrames, false, 1, () => {
    mesh.position.copyFrom(to);
    onComplete?.();
  });
}

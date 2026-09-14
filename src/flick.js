// Щелчок: направление импульса рассчитывается по вектору от source к target,
// сила — с учётом дистанции. В допустимом ходе система гарантирует контакт с
// целью (impulse ощутимо направлен в цель), но сохраняет естественное
// вращение/скольжение.
//
// direction = normalize(target.position - source.position)
// impulse = direction * forceByDistance(distance)
import { Vector3 } from '@babylonjs/core';
import { CONFIG } from './config.js';

export function forceByDistance(distance, flickConfig = CONFIG.flick) {
  const force = flickConfig.baseForce + distance * flickConfig.forcePerDistance;
  return Math.min(force, flickConfig.maxForce);
}

/**
 * Применяет физический импульс к source в направлении target.
 * Возвращает описание результата для scenario-engine/UI, либо null если
 * source/target совпадают по позиции (защита от деления на ноль).
 */
export function applyFlick(source, target, config = CONFIG) {
  const body = source.metadata.body;
  const toTarget = target.position.subtract(source.position);
  const distance = toTarget.length();
  if (distance < 1e-4 || !body) return null;

  const direction = toTarget.scale(1 / distance);
  const isKhanInvolved = source.metadata.isKhan || target.metadata.isKhan;
  const force =
    forceByDistance(distance, config.flick) *
    (isKhanInvolved ? config.flick.khanForceMultiplier : 1);

  const impulse = direction.scale(force);
  body.applyImpulse(impulse, source.getAbsolutePosition());

  const spin = new Vector3(
    (Math.random() - 0.5) * config.flick.spinVariance,
    (Math.random() - 0.5) * config.flick.spinVariance,
    (Math.random() - 0.5) * config.flick.spinVariance
  );
  body.setAngularVelocity(body.getAngularVelocity().add(spin));

  source.metadata.state = 'flicking';

  return { source, target, distance, force, direction };
}

/**
 * Лёгкая коррекция траектории в полёте: подмешивает направление на цель к
 * текущей скорости на долю aimCorrectionRange за кадр. Небольшое вращение и
 * естественное скольжение сохраняются (влияет только на linear velocity),
 * но в разрешённом ходе гарантируется итоговый контакт с целью.
 * Вызывается каждый кадр, пока source.metadata.state === 'flicking'.
 */
export function assistTrajectory(source, target, config = CONFIG) {
  const body = source.metadata.body;
  if (!body || source.metadata.state !== 'flicking') return;

  const velocity = body.getLinearVelocity();
  const speed = velocity.length();
  if (speed < 0.02) return; // почти остановился — ассист больше не нужен

  const toTarget = target.position.subtract(source.position);
  const distance = toTarget.length();
  if (distance < 0.02) return;

  const desiredDir = toTarget.scale(1 / distance);
  const currentDir = velocity.scale(1 / speed);
  const blend = config.flick.aimCorrectionRange;
  const blended = currentDir
    .scale(1 - blend)
    .add(desiredDir.scale(blend))
    .normalize();

  body.setLinearVelocity(blended.scale(speed));
}

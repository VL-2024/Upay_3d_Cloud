// Ввод: tap-to-target и swipe, обе схемы используют одну физическую механику
// щелчка (flick.js). Тап по недопустимой цели не создаёт штрафа.
import { PointerEventTypes, Vector2, Vector3, Matrix } from '@babylonjs/core';
import { CONFIG } from './config.js';
import { selectSource, clearSelection, getSource, getTargets, isValidTarget } from './pair-selector.js';
import { applyFlick } from './flick.js';

function resolveGameMesh(pickedMesh, chukoMeshes, khanMesh) {
  if (!pickedMesh) return null;
  // Видимый меш не пикается (mesh.isPickable=false) — реально попадает
  // увеличенный hitProxy, привязанный к чүкө/Хану (см. chuko.js).
  const resolved = pickedMesh.metadata?.proxyFor ?? pickedMesh;
  if (resolved === khanMesh) return khanMesh;
  return chukoMeshes.includes(resolved) ? resolved : null;
}

function isSelectable(mesh) {
  return !!mesh && !mesh.metadata.isKhan && mesh.metadata.state === 'idle';
}

/**
 * Подключает обработку указателя. isInteractive() должна возвращать true,
 * только когда игра готова принимать выбор (см. GameStates.READY/AIMING).
 * onFlick(result) вызывается после успешного щелчка.
 */
export function setupInput(scene, camera, chukoMeshes, khanMesh, isInteractive, onFlick) {
  let pointerDown = null;

  const observer = scene.onPointerObservable.add((pointerInfo) => {
    if (!isInteractive()) return;

    if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
      const pick = pointerInfo.pickInfo;
      const mesh = pick && pick.hit ? resolveGameMesh(pick.pickedMesh, chukoMeshes, khanMesh) : null;
      pointerDown = { x: scene.pointerX, y: scene.pointerY, time: performance.now(), mesh };
      return;
    }

    if (pointerInfo.type === PointerEventTypes.POINTERUP) {
      if (!pointerDown) return;
      const dx = scene.pointerX - pointerDown.x;
      const dy = scene.pointerY - pointerDown.y;
      const dist = Math.hypot(dx, dy);
      const dt = performance.now() - pointerDown.time;

      const pick = pointerInfo.pickInfo;
      const upMesh = pick && pick.hit ? resolveGameMesh(pick.pickedMesh, chukoMeshes, khanMesh) : null;

      const isSwipe =
        dist >= CONFIG.input.swipeMinDistancePx &&
        dt <= CONFIG.input.swipeMaxTimeMs &&
        pointerDown.mesh &&
        isSelectable(pointerDown.mesh);

      if (isSwipe) {
        handleSwipe(pointerDown.mesh, dx, dy, scene, camera, chukoMeshes, khanMesh, onFlick);
      } else {
        handleTap(upMesh, chukoMeshes, khanMesh, onFlick);
      }

      pointerDown = null;
    }
  });

  return () => scene.onPointerObservable.remove(observer);
}

function handleTap(mesh, chukoMeshes, khanMesh, onFlick) {
  const source = getSource();

  if (source && mesh && isValidTarget(mesh)) {
    const result = applyFlick(source, mesh);
    clearSelection();
    if (result) onFlick(result);
    return;
  }

  if (isSelectable(mesh)) {
    selectSource(mesh, chukoMeshes, khanMesh);
    return;
  }

  // Тап по недопустимой цели/пустому месту: просто снимаем выбор, без штрафа.
  clearSelection();
}

function handleSwipe(sourceMesh, dx, dy, scene, camera, chukoMeshes, khanMesh, onFlick) {
  selectSource(sourceMesh, chukoMeshes, khanMesh);
  const targets = getTargets();
  if (targets.length === 0) {
    clearSelection();
    return;
  }

  const engine = scene.getEngine();
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const transformMatrix = scene.getTransformMatrix();

  const sourceScreen = projectToScreen(sourceMesh.position, transformMatrix, viewport);
  const swipeDir = new Vector2(dx, dy);
  if (swipeDir.lengthSquared() < 1e-6) {
    clearSelection();
    return;
  }
  swipeDir.normalize();

  let best = null;
  let bestScore = -Infinity;
  for (const target of targets) {
    const targetScreen = projectToScreen(target.position, transformMatrix, viewport);
    const toTarget = new Vector2(targetScreen.x - sourceScreen.x, targetScreen.y - sourceScreen.y);
    if (toTarget.lengthSquared() < 1e-6) continue;
    toTarget.normalize();
    const score = Vector2.Dot(swipeDir, toTarget);
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }

  if (best && bestScore >= CONFIG.input.swipeDirectionThreshold) {
    const result = applyFlick(sourceMesh, best);
    clearSelection();
    if (result) onFlick(result);
  }
  // Иначе оставляем source выбранным — игрок может завершить ход тапом по цели.
}

function projectToScreen(position, transformMatrix, viewport) {
  return Vector3.Project(position, Matrix.Identity(), transformMatrix, viewport);
}

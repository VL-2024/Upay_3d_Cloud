// Валидатор раскладки: чистая физика не гарантирует удобную игровую позицию.
// После остановки проверяем границы, стопки, видимость, доступность Хана,
// количество пар и минимальную дистанцию для щелчка.
import { Vector3, Frustum } from '@babylonjs/core';
import { CONFIG } from './config.js';
import { classifyAll } from './orientation.js';

function checkBounds(all, workArea, reasons) {
  const halfW = workArea.width / 2;
  const halfD = workArea.depth / 2;
  for (const m of all) {
    const p = m.position;
    if (Math.abs(p.x) > halfW || Math.abs(p.z) > halfD || p.y < -0.25) {
      reasons.push(`out_of_bounds:${m.name}`);
    }
  }
}

function checkStacking(all, v, reasons) {
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i].position;
      const b = all[j].position;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dy = Math.abs(a.y - b.y);
      const planarDist = Math.hypot(dx, dz);
      if (planarDist < v.stackXZThreshold && dy > v.maxStackHeightDelta) {
        reasons.push(`stack:${all[i].name}+${all[j].name}`);
      }
    }
  }
}

function checkVisibility(chukoMeshes, khanMesh, camera, reasons) {
  const planes = Frustum.GetPlanes(camera.getTransformationMatrix());
  for (const m of chukoMeshes) {
    if (!m.isInFrustum(planes)) reasons.push(`not_visible:${m.name}`);
  }
  if (!khanMesh.isInFrustum(planes)) reasons.push('khan_not_visible');
}

function checkKhanClearance(chukoMeshes, khanMesh, v, reasons) {
  let neighbors = 0;
  for (const m of chukoMeshes) {
    if (Vector3.Distance(m.position, khanMesh.position) < v.khanClearanceRadius) {
      neighbors += 1;
    }
  }
  if (neighbors > v.khanClearanceMaxNeighbors) {
    reasons.push('khan_blocked');
  }
}

function checkPairsAndDistance(chukoMeshes, v, requiredPairs, reasons) {
  classifyAll(chukoMeshes);

  const byOrientation = {};
  for (const m of chukoMeshes) {
    const code = m.metadata.orientation;
    (byOrientation[code] = byOrientation[code] || []).push(m);
  }

  let availablePairs = 0;
  let hasFlickableDistance = false;

  for (const code in byOrientation) {
    const group = byOrientation[code];
    availablePairs += Math.floor(group.length / 2);
    for (let i = 0; i < group.length && !hasFlickableDistance; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (Vector3.Distance(group[i].position, group[j].position) >= v.minDistanceForFlick) {
          hasFlickableDistance = true;
          break;
        }
      }
    }
  }

  if (availablePairs < requiredPairs) reasons.push('not_enough_pairs');
  if (availablePairs > 0 && !hasFlickableDistance) reasons.push('no_flickable_pair_distance');

  return { byOrientation, availablePairs };
}

/**
 * Полная проверка раскладки. Требует, чтобы объекты уже физически остановились.
 * requiredPairs — минимум пар, нужных текущему сценарию (см. scenario-engine.js).
 */
export function validateLayout(chukoMeshes, khanMesh, camera, requiredPairs = 1, config = CONFIG) {
  const reasons = [];
  const all = [...chukoMeshes, khanMesh];

  checkBounds(all, config.workArea, reasons);
  checkStacking(all, config.layoutValidator, reasons);
  checkVisibility(chukoMeshes, khanMesh, camera, reasons);
  checkKhanClearance(chukoMeshes, khanMesh, config.layoutValidator, reasons);
  const { byOrientation, availablePairs } = checkPairsAndDistance(
    chukoMeshes,
    config.layoutValidator,
    requiredPairs,
    reasons
  );

  return {
    valid: reasons.length === 0,
    reasons,
    orientationGroups: byOrientation,
    availablePairs,
  };
}

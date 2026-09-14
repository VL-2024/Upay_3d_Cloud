// Валидатор раскладки: чистая физика не гарантирует удобную игровую позицию.
// После остановки проверяем границы, стопки, видимость, доступность Хана,
// количество пар и минимальную дистанцию для щелчка.
import { Vector3, Frustum } from '@babylonjs/core';
import { CONFIG } from './config.js';
import { classifyAll, classifyOrientation } from './orientation.js';

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

function findKhanReserveCandidate(chukoMeshes, khanMesh) {
  return chukoMeshes.find((m) => m.metadata.orientation === khanMesh.metadata.orientation) ?? null;
}

function checkPairsAndDistance(pool, v, requiredPairs, reasons) {
  const byOrientation = {};
  for (const m of pool) {
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
 *
 * scenarioNeeds.requiredPairs — сколько 'pair'-шагов должен пройти сценарий.
 * scenarioNeeds.needsKhanStep — есть ли в сценарии ход на Хана: тогда среди
 * обычных чүкө должен найтись хотя бы один с тем же положением, что и у Хана
 * (§7 — раскладка должна гарантированно позволять пройти сценарий). Такой
 * чүкө возвращается как khanReserveCandidate и исключается из подсчёта пар:
 * до Хан-шага он резервируется и не предлагается игроку (см. main.js).
 */
export function validateLayout(chukoMeshes, khanMesh, camera, scenarioNeeds = {}, config = CONFIG) {
  const { requiredPairs = 1, needsKhanStep = false } = scenarioNeeds;
  const reasons = [];
  const all = [...chukoMeshes, khanMesh];

  classifyAll(chukoMeshes);
  classifyOrientation(khanMesh);

  checkBounds(all, config.workArea, reasons);
  checkStacking(all, config.layoutValidator, reasons);
  checkVisibility(chukoMeshes, khanMesh, camera, reasons);
  checkKhanClearance(chukoMeshes, khanMesh, config.layoutValidator, reasons);

  let khanReserveCandidate = null;
  let pool = chukoMeshes;
  if (needsKhanStep) {
    khanReserveCandidate = findKhanReserveCandidate(chukoMeshes, khanMesh);
    if (!khanReserveCandidate) {
      reasons.push('no_khan_partner');
    } else {
      pool = chukoMeshes.filter((m) => m !== khanReserveCandidate);
    }
  }

  const { byOrientation, availablePairs } = checkPairsAndDistance(
    pool,
    config.layoutValidator,
    requiredPairs,
    reasons
  );

  return {
    valid: reasons.length === 0,
    reasons,
    orientationGroups: byOrientation,
    availablePairs,
    khanReserveCandidate,
  };
}

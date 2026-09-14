// Классификация положения чүкө: AYKUR / TAA / CHIK / BOK.
//
// Геометрия чүкө (см. chuko.js) имеет ровно 4 плоские устойчивые грани по
// локальным осям ±Y и ±Z. После остановки определяем, какая из четырёх
// локальных нормалей ближе всего к мировой оси Y (т.е. "смотрит вверх") —
// это и есть текущее положение.
import { Vector3 } from '@babylonjs/core';

const FACE_AXES = [
  ['TAA', new Vector3(0, 1, 0)],
  ['BOK', new Vector3(0, -1, 0)],
  ['AYKUR', new Vector3(0, 0, 1)],
  ['CHIK', new Vector3(0, 0, -1)],
];

export const ORIENTATION_LABELS = {
  AYKUR: 'айкүр',
  TAA: 'таа',
  CHIK: 'чик',
  BOK: 'бөк',
};

/** Классифицирует один меш, записывает результат в metadata и возвращает код. */
export function classifyOrientation(mesh) {
  const worldMatrix = mesh.getWorldMatrix();
  let bestCode = null;
  let bestDot = -Infinity;

  for (const [code, localAxis] of FACE_AXES) {
    const worldAxis = Vector3.TransformNormal(localAxis, worldMatrix).normalize();
    const dot = Vector3.Dot(worldAxis, Vector3.Up());
    if (dot > bestDot) {
      bestDot = dot;
      bestCode = code;
    }
  }

  mesh.metadata.orientation = bestCode;
  mesh.metadata.orientationConfidence = bestDot;
  return bestCode;
}

/** Классифицирует список мешей (обычно все обычные чүкө, без Хана). */
export function classifyAll(meshes) {
  return meshes.map((m) => classifyOrientation(m));
}

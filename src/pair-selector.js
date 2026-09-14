// Выбор пары: тап по исходному чүкө делает его source, ищутся допустимые
// target с тем же положением, подсвечиваются мягкой подсветкой.
import { Color3 } from '@babylonjs/core';
import { CONFIG } from './config.js';

let currentSource = null;
let currentTargets = [];

/**
 * Делает mesh источником (source), ищет допустимые цели среди chukoMeshes
 * (и khanMesh, если он разблокирован и совпадает по положению).
 * Возвращает список допустимых целей.
 */
export function selectSource(mesh, chukoMeshes, khanMesh) {
  clearSelection();

  if (!mesh || mesh.metadata.isKhan) return [];
  if (mesh.metadata.state !== 'idle') return [];

  currentSource = mesh;
  mesh.metadata.state = 'source';
  applyHighlight(mesh, 'source');

  const candidates = chukoMeshes.filter(
    (m) => m !== mesh && m.metadata.state === 'idle' && m.metadata.orientation === mesh.metadata.orientation
  );

  if (khanMesh && khanMesh.metadata.khanUnlocked && khanMesh.metadata.state === 'idle') {
    if (khanMesh.metadata.orientation === mesh.metadata.orientation) {
      candidates.push(khanMesh);
    }
  }

  currentTargets = candidates;
  currentTargets.forEach((t) => {
    t.metadata.state = 'target';
    applyHighlight(t, 'target');
  });

  return currentTargets;
}

export function clearSelection() {
  if (currentSource) {
    removeHighlight(currentSource);
    if (currentSource.metadata.state === 'source') currentSource.metadata.state = 'idle';
  }
  currentTargets.forEach((t) => {
    removeHighlight(t);
    if (t.metadata.state === 'target') t.metadata.state = 'idle';
  });
  currentSource = null;
  currentTargets = [];
}

export function getSource() {
  return currentSource;
}

export function getTargets() {
  return currentTargets;
}

export function isValidTarget(mesh) {
  return currentTargets.includes(mesh);
}

function applyHighlight(mesh, kind) {
  if (!mesh.material) return;
  const c = CONFIG.highlight;
  const [r, g, b] = kind === 'source' ? c.sourceColor : c.targetColor;
  mesh.material.emissiveColor = new Color3(r, g, b).scale(c.intensity);
}

function removeHighlight(mesh) {
  if (mesh.material) mesh.material.emissiveColor = Color3.Black();
}

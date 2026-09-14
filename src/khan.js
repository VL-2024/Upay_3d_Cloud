// Хан: отдельная сущность с isKhan=true. Физика и 4 положения идентичны
// обычному чүкө, но Хан становится допустимой целью только по сценарию.
import { createChuko } from './chuko.js';

export function createKhan(scene) {
  const khan = createChuko(scene, true);
  khan.metadata.khanUnlocked = false;
  return khan;
}

export function setKhanUnlocked(khanMesh, unlocked) {
  khanMesh.metadata.khanUnlocked = unlocked;
}

export function isKhanUnlocked(khanMesh) {
  return !!khanMesh.metadata.khanUnlocked;
}

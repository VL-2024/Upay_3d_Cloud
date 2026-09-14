// Рассыпание: 16 объектов (15 чүкө + Хан) стартуют над центром поля со
// случайным разбросом позиции/высоты/ориентации и слабым боковым импульсом.
import { Vector3, Quaternion } from '@babylonjs/core';
import { CONFIG } from './config.js';
import { resetBodyMotion } from './physics.js';

/** Рассыпает все переданные объекты (чүкө + Хан). Возвращает список тел. */
export function scatterAll(chukoMeshes, khanMesh, config = CONFIG) {
  const all = [...chukoMeshes, khanMesh];
  const s = config.scatter;

  all.forEach((mesh, i) => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * s.radius;
    const jitterX = (Math.random() - 0.5) * s.positionJitterXZ * 0.3;
    const jitterZ = (Math.random() - 0.5) * s.positionJitterXZ * 0.3;

    const x = Math.cos(angle) * r + jitterX;
    const z = Math.sin(angle) * r + jitterZ;
    const y = s.heightMin + Math.random() * (s.heightMax - s.heightMin) + i * s.heightJitterPerObject;

    mesh.position.set(x, y, z);
    mesh.rotationQuaternion = Quaternion.FromEulerAngles(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    const body = mesh.metadata.body;
    resetBodyMotion(body);

    if (s.sideImpulseMax > 0) {
      const dir = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5);
      if (dir.length() > 1e-3) {
        dir.normalize().scaleInPlace(Math.random() * s.sideImpulseMax);
        body.applyImpulse(dir, mesh.getAbsolutePosition());
      }
    }

    mesh.metadata.state = 'idle';
    mesh.metadata.orientation = null;
    mesh.metadata.orientationConfidence = 0;
    if (mesh.material) mesh.material.emissiveColor.set(0, 0, 0);
  });

  return all;
}

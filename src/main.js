// Bootstrap: запуск Babylon.js, инициализация сцены, физики и игрового цикла.
import { Engine } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';

import { CONFIG } from './config.js';
import { createScene, createEnvironment } from './scene.js';
import { initPhysics, isBodySlow } from './physics.js';
import { createChuko } from './chuko.js';
import { createKhan } from './khan.js';
import { scatterAll } from './scatter.js';
import { validateLayout } from './layout-validator.js';
import { classifyAll, ORIENTATION_LABELS } from './orientation.js';
import { setupInput } from './input.js';
import { assistTrajectory } from './flick.js';
import { getSource, clearSelection } from './pair-selector.js';
import { GameStateMachine, GameStates } from './game-state.js';
import { ScenarioEngine, Scenarios } from './scenario-engine.js';

async function bootstrap() {
  const canvas = document.getElementById('renderCanvas');
  const engine = new Engine(canvas, true, { stencil: true }, true);

  const { scene, camera } = createScene(engine, canvas);
  await initPhysics(scene);
  createEnvironment(scene);

  const chukoMeshes = Array.from({ length: CONFIG.chukoCount }, () => createChuko(scene, false));
  const khanMesh = createKhan(scene);

  const gameState = new GameStateMachine(GameStates.IDLE);
  const scenarioEngine = new ScenarioEngine(CONFIG.scenario.default, CONFIG);

  const ui = buildUI(gameState, scenarioEngine);
  const debugLayer = buildDebugLabels(scene, chukoMeshes, khanMesh);

  let rerollAttempts = 0;
  let stableFrames = 0;
  let stabilizeFrames = 0;
  let activeFlick = null;
  let pendingScenarioComplete = null;

  function beginDeal() {
    if (!gameState.is(GameStates.IDLE, GameStates.READY, GameStates.RESULT)) return;

    clearSelection();
    scenarioEngine.reset(ui.getSelectedScenario());
    activeFlick = null;
    pendingScenarioComplete = null;
    rerollAttempts = 0;
    stableFrames = 0;
    stabilizeFrames = 0;

    khanMesh.metadata.khanUnlocked = false;
    scatterAll(chukoMeshes, khanMesh);
    gameState.set(GameStates.SCATTERING);
    gameState.set(GameStates.STABILIZING);
  }

  function stepStabilization() {
    const all = [...chukoMeshes, khanMesh];
    stabilizeFrames += 1;

    const allSlow = all.every((m) => isBodySlow(m.metadata.body));
    stableFrames = allSlow ? stableFrames + 1 : 0;

    const settled = stableFrames >= CONFIG.stability.minStableFrames;
    const timedOut = stabilizeFrames >= CONFIG.stability.maxWaitFrames;

    if (settled || timedOut) {
      gameState.set(GameStates.VALIDATING);
    }
  }

  function stepValidation() {
    classifyAll(chukoMeshes);
    classifyAll([khanMesh]);

    const requiredPairs = scenarioEngine.requiredPairsInLayout();
    const result = validateLayout(chukoMeshes, khanMesh, camera, requiredPairs);

    if (result.valid || rerollAttempts >= CONFIG.layoutValidator.maxRerollAttempts) {
      if (!result.valid) {
        console.warn('[layout-validator] Раскладка принята после исчерпания попыток reroll:', result.reasons);
      }
      gameState.set(GameStates.READY);
      return;
    }

    rerollAttempts += 1;
    stableFrames = 0;
    stabilizeFrames = 0;
    scatterAll(chukoMeshes, khanMesh);
    gameState.set(GameStates.STABILIZING);
  }

  function handleFlick(result) {
    activeFlick = result;
    gameState.set(GameStates.FLICKING);

    // В разрешённом ходе финансовый/сценарный исход не зависит от точной
    // физической траектории — фиксируем сбор пары сразу (см. ТЗ §11/§13).
    result.source.metadata.state = 'collected';
    result.target.metadata.state = 'collected';
    scenarioEngine.recordSuccessfulFlick(result, khanMesh);
  }

  scenarioEngine.on('scenario-complete', (payload) => {
    pendingScenarioComplete = payload;
  });
  scenarioEngine.on('pair-collected', ({ count }) => ui.setStatus(`Собрано пар: ${count}`));
  scenarioEngine.on('upay-formed', ({ upayCount }) => ui.setStatus(`Упай собран! Всего: ${upayCount}`));
  scenarioEngine.on('khan-unlocked', () => ui.setStatus('Хан разблокирован!'));
  scenarioEngine.on('khan-hit', () => ui.setStatus('Удар по Хану выполнен!'));

  function stepFlicking() {
    if (!activeFlick) {
      gameState.set(GameStates.READY);
      return;
    }
    assistTrajectory(activeFlick.source, activeFlick.target);

    const sourceSlow = isBodySlow(activeFlick.source.metadata.body);
    const targetSlow = isBodySlow(activeFlick.target.metadata.body);
    if (sourceSlow && targetSlow) {
      activeFlick = null;
      if (pendingScenarioComplete) {
        gameState.set(GameStates.RESULT);
      } else {
        gameState.set(GameStates.READY);
      }
    }
  }

  setupInput(
    scene,
    camera,
    chukoMeshes,
    khanMesh,
    () => gameState.is(GameStates.READY, GameStates.AIMING),
    handleFlick
  );

  ui.onScatter(beginDeal);

  gameState.onChange((next) => ui.setState(next));
  ui.setState(gameState.state);

  scene.onBeforeRenderObservable.add(() => {
    if (gameState.is(GameStates.STABILIZING)) stepStabilization();
    else if (gameState.is(GameStates.VALIDATING)) stepValidation();
    else if (gameState.is(GameStates.FLICKING)) stepFlicking();
    else if (gameState.is(GameStates.READY) && getSource()) gameState.set(GameStates.AIMING);
    else if (gameState.is(GameStates.AIMING) && !getSource()) gameState.set(GameStates.READY);

    debugLayer.update();
    ui.updateFps(engine.getFps());
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());

  document.getElementById('loadingOverlay')?.remove();
}

function buildUI(gameState, scenarioEngine) {
  const scatterBtn = document.getElementById('scatterBtn');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const statusText = document.getElementById('statusText');
  const stateText = document.getElementById('stateText');
  const fpsText = document.getElementById('fpsText');

  const debugFpsCb = document.getElementById('dbgFps');
  const debugBodiesCb = document.getElementById('dbgBodies');
  const debugLabelsCb = document.getElementById('dbgLabels');

  debugFpsCb.checked = CONFIG.debug.showFps;
  debugBodiesCb.checked = CONFIG.debug.showPhysicsBodies;
  debugLabelsCb.checked = CONFIG.debug.showOrientationLabels;

  debugFpsCb.addEventListener('change', () => {
    CONFIG.debug.showFps = debugFpsCb.checked;
    fpsText.style.display = CONFIG.debug.showFps ? 'block' : 'none';
  });
  debugLabelsCb.addEventListener('change', () => {
    CONFIG.debug.showOrientationLabels = debugLabelsCb.checked;
  });
  debugBodiesCb.addEventListener('change', () => {
    CONFIG.debug.showPhysicsBodies = debugBodiesCb.checked;
  });

  return {
    onScatter(cb) {
      scatterBtn.addEventListener('click', cb);
    },
    getSelectedScenario() {
      return scenarioSelect.value || Scenarios.ONE;
    },
    setStatus(text) {
      statusText.textContent = text;
    },
    setState(state) {
      stateText.textContent = state;
      scatterBtn.disabled = ![
        GameStates.IDLE,
        GameStates.READY,
        GameStates.RESULT,
        GameStates.AIMING,
      ].includes(state);
    },
    updateFps(fps) {
      if (!CONFIG.debug.showFps) return;
      fpsText.textContent = `${Math.round(fps)} FPS`;
    },
  };
}

function buildDebugLabels(scene, chukoMeshes, khanMesh) {
  const texture = AdvancedDynamicTexture.CreateFullscreenUI('debugUI', true, scene);
  const labels = [...chukoMeshes, khanMesh].map((mesh) => {
    const label = new TextBlock();
    label.text = '';
    label.color = '#fff700';
    label.fontSize = 14;
    label.outlineWidth = 3;
    label.outlineColor = '#000000';
    label.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    label.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    texture.addControl(label);
    label.linkWithMesh(mesh);
    label.linkOffsetY = -28;
    return { mesh, label };
  });

  return {
    update() {
      const visible = CONFIG.debug.showOrientationLabels;
      for (const { mesh, label } of labels) {
        label.isVisible = visible;
        if (!visible) continue;
        const code = mesh.metadata.orientation;
        label.text = mesh.metadata.isKhan
          ? `ХАН${code ? ` (${ORIENTATION_LABELS[code] ?? code})` : ''}`
          : code
            ? `${code} / ${ORIENTATION_LABELS[code]}`
            : '';
      }

      const wireframe = CONFIG.debug.showPhysicsBodies;
      for (const { mesh } of labels) {
        if (mesh.material) mesh.material.wireframe = wireframe;
      }
    },
  };
}

bootstrap().catch((err) => {
  console.error(err);
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.textContent = `Ошибка запуска: ${err.message}`;
});

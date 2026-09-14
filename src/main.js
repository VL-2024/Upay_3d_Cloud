// Bootstrap: запуск Babylon.js, инициализация сцены, физики и игрового цикла.
// Билетный цикл целиком следует §5/§17 ТЗ: REQUESTING_TICKET → SCATTERING →
// SETTLING → READY ⇄ AIMING → FLICKING → COLLECTING → READY/KHAN_READY →
// RESULT → FINISHED.
import { Engine } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';

import { CONFIG } from './config.js';
import { createScene, createEnvironment } from './scene.js';
import { initPhysics, isBodySlow } from './physics.js';
import { createChuko } from './chuko.js';
import { createKhan } from './khan.js';
import { scatterAll } from './scatter.js';
import { validateLayout } from './layout-validator.js';
import { classifyAll, classifyOrientation, ORIENTATION_LABELS } from './orientation.js';
import { setupInput } from './input.js';
import { assistTrajectory } from './flick.js';
import { getSource, clearSelection } from './pair-selector.js';
import { createCollector, resetCollector, collectPiece } from './collector.js';
import { requestDemoTicket, finishDemoTicket } from './lms-adapter.js';
import { GameStateMachine, GameStates } from './game-state.js';
import { ScenarioEngine, SCENARIO_CODES } from './scenario-engine.js';

async function bootstrap() {
  const canvas = document.getElementById('renderCanvas');
  const engine = new Engine(canvas, true, { stencil: true }, true);

  const { scene, camera } = createScene(engine, canvas);
  await initPhysics(scene);
  createEnvironment(scene);

  const chukoMeshes = Array.from({ length: CONFIG.chukoCount }, () => createChuko(scene, false));
  const khanMesh = createKhan(scene);
  const collector = createCollector(scene);

  const gameState = new GameStateMachine(GameStates.INIT);
  const scenarioEngine = new ScenarioEngine(CONFIG);
  const ui = buildUI(gameState);
  const debugLayer = buildDebugLabels(scene, chukoMeshes, khanMesh);

  let rerollAttempts = 0;
  let stableFrames = 0;
  let stabilizeFrames = 0;
  let activeFlick = null;
  let currentTicket = null;
  let reservedForKhan = null;

  function beginTicket() {
    if (!gameState.is(GameStates.INIT, GameStates.FINISHED, GameStates.RESULT)) return;

    gameState.set(GameStates.REQUESTING_TICKET);
    currentTicket = requestDemoTicket(ui.getForcedScenarioCode());
    scenarioEngine.start(currentTicket.scenarioCode);

    clearSelection();
    resetCollector(collector);
    reservedForKhan = null;
    activeFlick = null;
    rerollAttempts = 0;
    stableFrames = 0;
    stabilizeFrames = 0;

    khanMesh.metadata.khanUnlocked = false;
    khanMesh.metadata.state = 'idle';
    for (const m of chukoMeshes) m.metadata.state = 'idle';

    ui.setTicket(currentTicket);
    ui.setHint('Рассыпаем чүкө…');

    scatterAll(chukoMeshes, khanMesh);
    gameState.set(GameStates.SCATTERING);
    gameState.set(GameStates.SETTLING);
  }

  function stepStabilization() {
    const all = [...chukoMeshes, khanMesh];
    stabilizeFrames += 1;

    const allSlow = all.every((m) => isBodySlow(m.metadata.body));
    stableFrames = allSlow ? stableFrames + 1 : 0;

    const settled = stableFrames >= CONFIG.stability.minStableFrames;
    const timedOut = stabilizeFrames >= CONFIG.stability.maxWaitFrames;

    if (settled || timedOut) validateAndProceed();
  }

  function validateAndProceed() {
    const needsKhanStep = scenarioEngine.needsKhanStep();
    const result = validateLayout(chukoMeshes, khanMesh, camera, {
      requiredPairs: scenarioEngine.requiredPairsInLayout(),
      needsKhanStep,
    });

    if (result.valid || rerollAttempts >= CONFIG.layoutValidator.maxRerollAttempts) {
      if (!result.valid) {
        console.warn('[layout-validator] Раскладка принята после исчерпания попыток reroll:', result.reasons);
      }
      if (needsKhanStep && result.khanReserveCandidate) {
        reservedForKhan = result.khanReserveCandidate;
        reservedForKhan.metadata.state = 'reserved';
      }
      ui.setHint('Выберите чүкө');
      gameState.set(GameStates.READY);
      return;
    }

    rerollAttempts += 1;
    stableFrames = 0;
    stabilizeFrames = 0;
    scatterAll(chukoMeshes, khanMesh);
    // Остаёмся в SETTLING — reroll незаметен для игрока (§9 ТЗ).
  }

  function handleFlick(result) {
    activeFlick = result;
    gameState.set(GameStates.FLICKING);
    result.source.metadata.state = 'flicking';
    result.target.metadata.state = 'flicking';
    ui.setHint('');
  }

  scenarioEngine.on('khan-unlocked', () => {
    khanMesh.metadata.khanUnlocked = true;
    if (reservedForKhan) {
      reservedForKhan.metadata.state = 'idle';
      reservedForKhan = null;
    }
  });
  scenarioEngine.on('khan-message', ({ text }) => ui.setHint(text));
  scenarioEngine.on('pair-collected', ({ inCurrentUpay, upaySlot }) =>
    ui.setStatus(`УПАЙ ${upaySlot}: ${inCurrentUpay}/${CONFIG.scenario.pairsPerUpay}`)
  );
  scenarioEngine.on('upay-formed', ({ upayCount }) => ui.setStatus(`${upayCount} УПАЙ собран`));

  function onFlickSettled(result) {
    const isKhanFlick = result.source.metadata.isKhan || result.target.metadata.isKhan;

    if (isKhanFlick) {
      result.target.metadata.state = 'collected';
      result.source.metadata.state = 'collected';
      const payload = scenarioEngine.recordSuccessfulFlick(result);
      finishOrContinue(payload);
      return;
    }

    // Целевой чүкө собран и уходит в зону УПАЙ; источник возвращается в игру
    // на новом (физически осевшем) положении (§10/§11 ТЗ).
    classifyOrientation(result.source);
    result.source.metadata.state = 'idle';
    result.target.metadata.state = 'collected';

    const upayIndex = scenarioEngine.upayCount;
    const slotIndex = scenarioEngine.collectedInCurrentUpay;
    const payload = scenarioEngine.recordSuccessfulFlick(result);

    gameState.set(GameStates.COLLECTING);
    collectPiece(result.target, collector, upayIndex, slotIndex, CONFIG, () => {
      finishOrContinue(payload);
    });
  }

  function finishOrContinue(payload) {
    if (payload) {
      gameState.set(GameStates.RESULT);
      ui.showResult(currentTicket, payload);
      return;
    }
    if (scenarioEngine.khanUnlocked) {
      ui.setHint('ХАН!');
      gameState.set(GameStates.KHAN_READY);
    } else {
      ui.setHint('Выберите чүкө');
      gameState.set(GameStates.READY);
    }
  }

  function stepFlicking() {
    if (!activeFlick) {
      gameState.set(GameStates.READY);
      return;
    }
    assistTrajectory(activeFlick.source, activeFlick.target);

    const sourceSlow = isBodySlow(activeFlick.source.metadata.body);
    const targetSlow = isBodySlow(activeFlick.target.metadata.body);
    if (sourceSlow && targetSlow) {
      const result = activeFlick;
      activeFlick = null;
      onFlickSettled(result);
    }
  }

  setupInput(
    scene,
    camera,
    chukoMeshes,
    khanMesh,
    () => gameState.isInputAllowed(),
    handleFlick
  );

  ui.onNewTicket(beginTicket);

  gameState.onChange((next) => ui.setState(next));
  ui.setState(gameState.state);

  scene.onBeforeRenderObservable.add(() => {
    if (gameState.is(GameStates.SETTLING)) stepStabilization();
    else if (gameState.is(GameStates.FLICKING)) stepFlicking();
    else if (gameState.is(GameStates.READY, GameStates.KHAN_READY) && getSource()) {
      gameState.set(GameStates.AIMING);
      ui.setHint('Выберите такой же');
    } else if (gameState.is(GameStates.AIMING) && !getSource()) {
      const back = scenarioEngine.khanUnlocked ? GameStates.KHAN_READY : GameStates.READY;
      ui.setHint(back === GameStates.KHAN_READY ? 'ХАН!' : 'Выберите чүкө');
      gameState.set(back);
    }

    debugLayer.update();
    ui.updateFps(engine.getFps());
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());

  gameState.set(GameStates.FINISHED);
  ui.onFinishTicket(() => {
    if (!gameState.is(GameStates.RESULT)) return;
    if (currentTicket) finishDemoTicket(currentTicket);
    gameState.set(GameStates.FINISHED);
    ui.setHint('Нажмите «НОВЫЙ БИЛЕТ»');
  });

  document.getElementById('loadingOverlay')?.remove();
}

function buildUI(gameState) {
  const newTicketBtn = document.getElementById('newTicketBtn');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const statusText = document.getElementById('statusText');
  const stateText = document.getElementById('stateText');
  const hintText = document.getElementById('hintText');
  const ticketText = document.getElementById('ticketText');
  const fpsText = document.getElementById('fpsText');
  const resultPanel = document.getElementById('resultPanel');
  const resultTitle = document.getElementById('resultTitle');
  const resultAmount = document.getElementById('resultAmount');
  const resultCloseBtn = document.getElementById('resultCloseBtn');

  const debugFpsCb = document.getElementById('dbgFps');
  const debugBodiesCb = document.getElementById('dbgBodies');
  const debugLabelsCb = document.getElementById('dbgLabels');

  for (const code of SCENARIO_CODES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code;
    scenarioSelect.appendChild(opt);
  }

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

  let finishCb = null;

  resultCloseBtn.addEventListener('click', () => {
    resultPanel.hidden = true;
    finishCb?.();
  });

  return {
    onNewTicket(cb) {
      newTicketBtn.addEventListener('click', cb);
    },
    onFinishTicket(cb) {
      finishCb = cb;
    },
    getForcedScenarioCode() {
      return scenarioSelect.value === 'AUTO' ? null : scenarioSelect.value;
    },
    setTicket(ticket) {
      ticketText.textContent = `Билет: ${ticket.ticketId} · ${ticket.scenarioCode}`;
    },
    setStatus(text) {
      statusText.textContent = text;
    },
    setHint(text) {
      hintText.textContent = text;
    },
    setState(state) {
      stateText.textContent = state;
      newTicketBtn.disabled = ![GameStates.INIT, GameStates.FINISHED, GameStates.RESULT].includes(state);
    },
    showResult(ticket, payload) {
      resultPanel.hidden = false;
      resultTitle.textContent = payload.resultLabel ?? 'Без УПАЙ';
      resultAmount.textContent =
        ticket.winAmount > 0 ? `Выигрыш (DEMO): ${ticket.winAmount}` : 'В этот раз без выигрыша';
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
  const spinner = document.getElementById('loadingSpinnerText');
  if (spinner) spinner.textContent = `Ошибка запуска: ${err.message}`;
  document.getElementById('loadingHint')?.removeAttribute('hidden');
});

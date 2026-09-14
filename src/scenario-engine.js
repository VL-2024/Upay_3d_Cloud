// Сценарный движок: полный набор кодов билета ZERO_A…ALTYN (§6 ТЗ).
//
// Сценарий — заранее фиксированная последовательность шагов ('pair' | 'khan').
// Какую именно пару выбрать/в каком порядке — решает игрок, но количество и
// тип шагов не меняются: клиент лишь визуализирует уже определённый исход
// (§7). PairSelector получает только цели, совместимые с текущим этапом —
// khan разблокируется движком в нужный момент, а не раньше.
import { CONFIG } from './config.js';

export const Scenarios = Object.freeze({
  ZERO_A: 'ZERO_A',
  ZERO_B: 'ZERO_B',
  ONE: 'ONE',
  ONE_PLUS: 'ONE_PLUS',
  TWO: 'TWO',
  KHAN: 'KHAN',
  TWO_KHAN: 'TWO_KHAN',
  ALTYN: 'ALTYN',
});

const STEP_DEFS = {
  ZERO_A: ['pair', 'pair'], // 2/3 первого Упай, дальше разрешённого шага нет
  ZERO_B: ['pair'], // 1/3, сбор прекращается
  ONE: ['pair', 'pair', 'pair'],
  ONE_PLUS: ['pair', 'pair', 'pair', 'pair', 'pair'], // 1 Упай + 2/3 второго
  TWO: ['pair', 'pair', 'pair', 'pair', 'pair', 'pair'],
  KHAN: ['pair', 'pair', 'pair', 'khan'],
  TWO_KHAN: ['pair', 'pair', 'pair', 'pair', 'pair', 'pair', 'khan'],
  ALTYN: ['pair', 'pair', 'pair', 'pair', 'pair', 'pair', 'khan'],
};

// Перед Хан-шагом отдельное сообщение показывается только для TWO_KHAN (§12).
const PRE_KHAN_MESSAGE = {
  TWO_KHAN: 'ЕЩЁ ОДИН ХОД',
};

const RESULT_LABEL = {
  ZERO_A: null,
  ZERO_B: null,
  ONE: '1 УПАЙ',
  ONE_PLUS: '1 УПАЙ',
  TWO: '2 УПАЙ',
  KHAN: 'ХАН',
  TWO_KHAN: 'ХАН',
  ALTYN: 'АЛТЫН УПАЙ',
};

export const SCENARIO_CODES = Object.keys(STEP_DEFS);

export class ScenarioEngine {
  constructor(config = CONFIG) {
    this.config = config;
    this.code = null;
    this.steps = [];
    this.stepIndex = 0;
    this.collectedInCurrentUpay = 0; // 0..pairsPerUpay, для прогресса УПАЙ 1/2
    this.upayCount = 0;
    this.khanUnlocked = false;
    this.finished = false;
    this._listeners = {};
  }

  /** Запускает шаги нового билета по коду сценария (из lms-adapter). */
  start(code) {
    if (!STEP_DEFS[code]) throw new Error(`Unknown scenario code: ${code}`);
    this.code = code;
    this.steps = STEP_DEFS[code];
    this.stepIndex = 0;
    this.collectedInCurrentUpay = 0;
    this.upayCount = 0;
    this.khanUnlocked = false;
    this.finished = false;
  }

  /** Тип текущего обязательного шага: 'pair' | 'khan' | null (уже завершён). */
  currentStepType() {
    return this.stepIndex < this.steps.length ? this.steps[this.stepIndex] : null;
  }

  /** true, если в текущем сценарии вообще есть ход на Хана. */
  needsKhanStep() {
    return this.steps.includes('khan');
  }

  /** Сколько пар должна гарантировать раскладка (используется layout-validator). */
  requiredPairsInLayout() {
    return this.steps.filter((s) => s === 'pair').length;
  }

  /** Вызывается после каждого успешного (разрешённого) щелчка. */
  recordSuccessfulFlick(flickResult) {
    if (this.finished) return null;

    const stepType = this.currentStepType();
    const isKhanFlick = flickResult.source.metadata.isKhan || flickResult.target.metadata.isKhan;

    if (stepType === 'khan' && isKhanFlick) {
      this.stepIndex += 1;
      this._emit('khan-hit', flickResult);
      return this._maybeFinish();
    }

    if (stepType === 'pair' && !isKhanFlick) {
      this.stepIndex += 1;
      this.collectedInCurrentUpay += 1;
      this._emit('pair-collected', {
        totalCollected: this.stepIndex,
        inCurrentUpay: this.collectedInCurrentUpay,
        upaySlot: this.upayCount + 1,
      });

      if (this.collectedInCurrentUpay >= this.config.scenario.pairsPerUpay) {
        this.upayCount += 1;
        this.collectedInCurrentUpay = 0;
        this._emit('upay-formed', { upayCount: this.upayCount });
      }

      if (this.currentStepType() === 'khan') {
        this.khanUnlocked = true;
        const message = PRE_KHAN_MESSAGE[this.code];
        if (message) this._emit('khan-message', { text: message });
        this._emit('khan-unlocked', {});
      }

      return this._maybeFinish();
    }

    // Ход не совпадает с ожидаемым типом шага — при корректной работе
    // pair-selector и резервирования чүкө под Хан (см. main.js) такого не
    // случается, но защищаемся от отсутствия эффекта на счёт сценария.
    return null;
  }

  _maybeFinish() {
    if (this.currentStepType() !== null) return null;
    this.finished = true;
    const payload = {
      code: this.code,
      upayCount: this.upayCount,
      resultLabel: RESULT_LABEL[this.code],
    };
    this._emit('scenario-complete', payload);
    return payload;
  }

  on(event, cb) {
    (this._listeners[event] = this._listeners[event] || []).push(cb);
  }

  _emit(event, payload) {
    (this._listeners[event] || []).forEach((cb) => cb(payload));
  }
}

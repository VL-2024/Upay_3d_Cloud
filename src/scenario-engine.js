// Сценарный движок: первая реализация — ZERO / ONE / KHAN.
// ZERO — расклад позволяет собрать только часть тройки, дальнейшей пары нет.
// ONE  — три успешных сбора формируют 1 Упай.
// KHAN — после базовой последовательности открывается удар по Хану.
import { CONFIG } from './config.js';

export const Scenarios = Object.freeze({
  ZERO: 'ZERO',
  ONE: 'ONE',
  KHAN: 'KHAN',
});

export class ScenarioEngine {
  constructor(scenario = CONFIG.scenario.default, config = CONFIG) {
    this.scenario = scenario;
    this.config = config;
    this.collectedPairs = 0;
    this.upayCount = 0;
    this.khanUnlocked = false;
    this._listeners = {};
  }

  reset(scenario = this.scenario) {
    this.scenario = scenario;
    this.collectedPairs = 0;
    this.upayCount = 0;
    this.khanUnlocked = false;
  }

  /** Сколько пар должна гарантировать раскладка, чтобы сценарий был выполним. */
  requiredPairsInLayout() {
    switch (this.scenario) {
      case Scenarios.ZERO:
        return 1;
      case Scenarios.ONE:
      case Scenarios.KHAN:
        return this.config.scenario.pairsPerUpay;
      default:
        return 1;
    }
  }

  /** Вызывается после каждого успешного (разрешённого) щелчка. */
  recordSuccessfulFlick(flickResult, khanMesh) {
    const khanHit = flickResult.source.metadata.isKhan || flickResult.target.metadata.isKhan;

    if (khanHit) {
      this._emit('khan-hit', flickResult);
      this._emit('scenario-complete', { scenario: this.scenario, reason: 'khan_hit' });
      return;
    }

    this.collectedPairs += 1;
    this._emit('pair-collected', { count: this.collectedPairs });

    if (this.scenario === Scenarios.ZERO) {
      // ZERO: после первой собранной пары дальнейшей допустимой пары нет —
      // раскладка сама это обеспечивает (requiredPairsInLayout === 1, но
      // валидатор не гарантирует вторую пару того же положения).
      this._emit('scenario-complete', { scenario: this.scenario, reason: 'no_further_pair' });
      return;
    }

    if (this.collectedPairs >= this.config.scenario.pairsPerUpay) {
      this.upayCount += 1;
      this.collectedPairs = 0;
      this._emit('upay-formed', { upayCount: this.upayCount });

      if (this.scenario === Scenarios.KHAN) {
        this.khanUnlocked = true;
        if (khanMesh) khanMesh.metadata.khanUnlocked = true;
        this._emit('khan-unlocked', {});
      } else if (this.scenario === Scenarios.ONE) {
        this._emit('scenario-complete', { scenario: this.scenario, reason: 'upay_formed' });
      }
    }
  }

  on(event, cb) {
    (this._listeners[event] = this._listeners[event] || []).push(cb);
  }

  _emit(event, payload) {
    (this._listeners[event] || []).forEach((cb) => cb(payload));
  }
}

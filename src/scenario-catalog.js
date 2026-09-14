/* УПАЙ — authoritative scenario catalogue for the LMS adapter.
 *
 * Financial result is LMS-authoritative. This catalogue only maps the
 * scenario ID/key the LMS returns to a demoMultiplier for local DEMO play
 * (win = denomination * demoMultiplier) — real payouts always come from
 * PayTicket's own `win` field, never from this table (§7/§21 ТЗ).
 *
 * Same interface as X2ChukoScenarioConfig in ЧҮКӨ Modern 3D / ALTYN KHAN
 * (get/has/getOrDefault/demoMultiplier/demoAt) so lms-adapter.js is a
 * drop-in, unmodified file across games — only this catalogue and the
 * gameplay code (scenario-engine.js) differ per game.
 *
 * Keys match scenario-engine.js's Scenarios exactly (ZERO_A..ALTYN, §6 ТЗ)
 * — the ticket's scenarioKey can be passed straight into
 * ScenarioEngine.start() with no translation layer.
 */
(function (global) {
  'use strict';

  const scenarios = Object.freeze({
    1: Object.freeze({ id: 1, key: 'ZERO_A', khan: false, demoMultiplier: 0 }),
    2: Object.freeze({ id: 2, key: 'ZERO_B', khan: false, demoMultiplier: 0 }),
    3: Object.freeze({ id: 3, key: 'ONE', khan: false, demoMultiplier: 2 }),
    4: Object.freeze({ id: 4, key: 'ONE_PLUS', khan: false, demoMultiplier: 3.2 }),
    5: Object.freeze({ id: 5, key: 'TWO', khan: false, demoMultiplier: 6 }),
    6: Object.freeze({ id: 6, key: 'KHAN', khan: true, demoMultiplier: 12 }),
    7: Object.freeze({ id: 7, key: 'TWO_KHAN', khan: true, demoMultiplier: 24 }),
    8: Object.freeze({ id: 8, key: 'ALTYN', khan: true, demoMultiplier: 40 })
  });

  const ids = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
  const byKey = Object.freeze(Object.fromEntries(Object.values(scenarios).map((item) => [item.key, item])));
  const demoOrder = ids; // простой циклический перебор всех кодов (§18 ТЗ — QA)

  function get(value) {
    if (typeof value === 'string') {
      const key = value.trim().toUpperCase();
      if (byKey[key]) return byKey[key];
    }
    const n = Number(value);
    return Number.isFinite(n) && scenarios[n] ? scenarios[n] : null;
  }

  function has(value) {
    return !!get(value);
  }
  function getOrDefault(value) {
    return get(value) || scenarios[1];
  }
  function demoMultiplier(value) {
    return Number(getOrDefault(value).demoMultiplier || 0);
  }
  function demoAt(index) {
    const id = demoOrder[((Number(index) || 0) % demoOrder.length + demoOrder.length) % demoOrder.length];
    return scenarios[id];
  }

  const api = Object.freeze({
    scenarios,
    ids,
    byKey,
    demoOrder,
    get,
    has,
    getOrDefault,
    demoMultiplier,
    demoAt,
    scenarioSetVersion: 'upay-3d-2026-09-14-v1'
  });

  global.X2_UPAY_SCENARIOS = scenarios;
  global.X2UpayScenarioConfig = api;
  // Общее имя, которое читает lms-adapter.js (см. LMS_API.md) — сохраняем
  // тот же global, что и в ЧҮКӨ/ALTYN KHAN, чтобы адаптер был идентичен.
  global.X2ChukoScenarioConfig = api;
})(window);

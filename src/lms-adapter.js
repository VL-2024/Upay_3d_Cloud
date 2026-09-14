// LMS-адаптер (§18 ТЗ): изолированный контракт запуска билета. 3D-логика
// не должна напрямую обращаться к API — только через этот модуль.
//
// Сейчас реализован только demo-adapter: сценарии выбираются локально/по
// кругу для QA, без денежных операций (§18, §21 — никакой Math.random() для
// финансового исхода в Real-режиме; здесь режим всегда DEMO, поэтому это
// разрешено). Реальный адаптер должен отдавать контракт той же формы
// (ticketId/scenarioCode/variant/winAmount/balance), но получать его от LMS.
import { CONFIG } from './config.js';
import { SCENARIO_CODES } from './scenario-engine.js';

let ticketCounter = 0;
let cycleIndex = 0;

function generateTicketId() {
  ticketCounter += 1;
  return `DEMO-${Date.now().toString(36).toUpperCase()}-${ticketCounter}`;
}

/**
 * Запрашивает новый демо-билет.
 * forcedCode — для QA: принудительно запустить конкретный код сценария.
 * Без него коды циклически перебираются по порядку (§18).
 */
export function requestDemoTicket(forcedCode = null) {
  const code = forcedCode ?? SCENARIO_CODES[cycleIndex % SCENARIO_CODES.length];
  if (!forcedCode) cycleIndex += 1;

  return {
    ticketId: generateTicketId(),
    scenarioCode: code,
    variant: Math.floor(Math.random() * 1000), // seed визуальной раскладки, не финансового исхода
    winAmount: CONFIG.scenario.demoPayouts[code] ?? 0,
    balance: null, // demo-режим без баланса; заполняется реальным адаптером
    mode: 'DEMO',
  };
}

/** Фиксация завершения билета (задел под аналитику §22). */
export function finishDemoTicket(ticket) {
  return { ticketId: ticket.ticketId, finishedAt: Date.now() };
}

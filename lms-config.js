/* УПАЙ — runtime / LMS settings. Тот же контракт, что и ЧҮКӨ Modern 3D /
 * ALTYN KHAN (см. lms-adapter.js, docs/LMS_API.md) — игры отличаются только
 * правилами/сценариями/визуалом, не форматом интеграции с LMS. */
window.X2_GAME_CONFIG = {
  gameId: 'UPAY',
  denomination: 25,
  denominations: [25, 50, 100],
  language: 'RU',
  currency: 'KGS',
  currencyDisplay: 'сом',
  mode: 'demo',
  demoAllowed: true,
  demoBalance: 10000,

  localTicketHistoryLimit: 5,

  // Standalone QA only. Production LMS must set mock=false.
  mock: true,

  apiBase: '',
  endpoints: {
    balance: '/api/lms/player/balance',
    newGame: '/api/lms/game/new'
  },

  initMode: 'postMessage',
  sessionMode: 'postMessage',
  sessionQueryParam: 'session',
  sessionHeader: 'X-Session-ID',
  parentOrigin: '*',
  allowedParentOrigins: ['*'],
  requestTimeoutMs: 10000
};

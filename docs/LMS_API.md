# УПАЙ — LMS API / integration contract

Этот контракт **идентичен** остальным играм семейства (ЧҮКӨ Modern 3D /
ALTYN KHAN, см. `VL-2024/Altyn-Khan-KG@modern-3d`): один и тот же
`lms-adapter.js` (файл скопирован без изменений — см. `public/lms-adapter.js`)
и один и тот же postMessage/PayTicket контракт. Игры отличаются только
`src/scenario-catalog.js` (маппинг кодов сценария) и самой игровой логикой.

Файлы контракта в этом репозитории:

```
public/lms-config.js        window.X2_GAME_CONFIG — runtime-настройки
public/src/scenario-catalog.js  window.X2ChukoScenarioConfig — коды сценария УПАЙ
public/lms-adapter.js       window.X2LMS — сам адаптер (тот же файл, что и в других играх)
```

Это classic-скрипты (не ES-модули) — загружаются в `index.html` до
`src/main.js` и доступны как глобалы, а не через `import`, именно чтобы
файл адаптера можно было переносить между играми без изменений.

## 1. Источник истины

В REAL режиме LMS определяет `ticketId`, `scenario`, `win`, `balance`.
Игра не рассчитывает REAL payout — см. §7/§21 основного ТЗ игры.

## 2–12. Инициализация, session, PayTicket, ошибки, CORS, mock

Полностью соответствуют `LMS_API.md` и `INTEGRATION_INSTRUCTION.md` из
`VL-2024/Altyn-Khan-KG@modern-3d` — postMessage `X2_GAME_READY` /
`X2_LMS_INIT` / `X2_LMS_SESSION`, `GET <newGame>?Method=PayTicket&gameId=&amount=`,
алиасы полей ответа (`ticketId`/`ticket_id`/…, `scenario`/`scenarioId`/…,
`win`/`prize`/…, `balance`/`newBalance`/…), коды ошибок
(`INIT_TIMEOUT`, `SESSION_EXPIRED`, `INSUFFICIENT_FUNDS`, `LMS_TIMEOUT`,
`LMS_HTTP_<status>`, `BAD_TICKET_RESPONSE`, `BAD_SCENARIO_RESPONSE`,
`BAD_WIN_RESPONSE`, `BAD_BALANCE_RESPONSE`) — без изменений. Не дублируем
здесь текст, чтобы не разойтись с оригиналом; см. тот репозиторий.

## 13. Scenario mapping (единственное, что отличается между играми)

| ID | key | Что визуализирует УПАЙ | Шаги (`scenario-engine.js`) |
|---:|---|---|---|
| 1 | `ZERO_A` | 2/3 первого Упай, дальше нет разрешённого шага | pair × 2 |
| 2 | `ZERO_B` | 1/3, сбор прекращается | pair × 1 |
| 3 | `ONE` | 1 УПАЙ | pair × 3 |
| 4 | `ONE_PLUS` | 1 УПАЙ + 2/3 второго | pair × 5 |
| 5 | `TWO` | 2 УПАЙ | pair × 6 |
| 6 | `KHAN` | 1 УПАЙ, затем удар по Хану | pair × 3, khan |
| 7 | `TWO_KHAN` | 2 УПАЙ, «ЕЩЁ ОДИН ХОД», удар по Хану | pair × 6, khan |
| 8 | `ALTYN` | 2 УПАЙ + успешный Хан — АЛТЫН УПАЙ | pair × 6, khan |

`scenarioKey` из ответа LMS передаётся напрямую в
`ScenarioEngine.start(ticket.scenarioKey)` — трансляции не требуется,
ключи выбраны совпадающими с `Scenarios` из `scenario-engine.js`.

DEMO `win = denomination × demoMultiplier` (значения — в
`src/scenario-catalog.js`, локально, вне денежной математики Real-режима).

QA: `?scenario=ZERO_A` … `?scenario=ALTYN` форсирует код (тот же
механизм, что и в Altyn Khan, — параметр читается адаптером один раз при
загрузке, поэтому смена в выпадающем списке игры перезагружает страницу
с новым `?scenario=`).

## 14. Production checklist

Тот же, что в §6/§19 `INTEGRATION_INSTRUCTION.md` Altyn Khan:
`gameId` → реальный ID игры в LMS, `mock:false`, `parentOrigin`/
`allowedParentOrigins` → точный origin сайта X2, `endpoints.newGame` →
реальный LMS host, продакшн-очистка debug-панели.

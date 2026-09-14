// Машина состояний партии (§17 ТЗ):
// INIT → REQUESTING_TICKET → SCATTERING → SETTLING → READY → FLICKING →
// COLLECTING → READY / KHAN_READY → RESULT → FINISHED.
// Ввод игрока разрешён только в READY / AIMING / KHAN_READY.
export const GameStates = Object.freeze({
  INIT: 'INIT',
  REQUESTING_TICKET: 'REQUESTING_TICKET', // запрос билета у lms-adapter
  SCATTERING: 'SCATTERING',
  SETTLING: 'SETTLING', // стабилизация физики + классификация + валидатор раскладки
  READY: 'READY', // можно выбрать source
  AIMING: 'AIMING', // source выбран, ждём target (уточнение READY для UX/ввода)
  FLICKING: 'FLICKING', // импульс применён, объекты летят
  COLLECTING: 'COLLECTING', // дуговая анимация переноса в зону УПАЙ
  KHAN_READY: 'KHAN_READY', // Хан разблокирован, ждём разрешённого хода на него
  RESULT: 'RESULT', // сценарий завершён, показан итог билета
  FINISHED: 'FINISHED', // билет закрыт, ждём следующего
});

const INPUT_ALLOWED_STATES = new Set([GameStates.READY, GameStates.AIMING, GameStates.KHAN_READY]);

export class GameStateMachine {
  constructor(initial = GameStates.INIT) {
    this.state = initial;
    this._listeners = [];
  }

  set(next) {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this._listeners.forEach((cb) => cb(next, prev));
  }

  is(...states) {
    return states.includes(this.state);
  }

  isInputAllowed() {
    return INPUT_ALLOWED_STATES.has(this.state);
  }

  onChange(cb) {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== cb);
    };
  }
}

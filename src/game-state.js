// Машина состояний партии: загрузка → рассыпание → стабилизация → валидация
// раскладки → готовность к выбору → прицеливание → щелчок → результат.
export const GameStates = Object.freeze({
  LOADING: 'LOADING',
  IDLE: 'IDLE', // сцена готова, ждём нажатия «РАССЫПАТЬ»
  SCATTERING: 'SCATTERING',
  STABILIZING: 'STABILIZING',
  VALIDATING: 'VALIDATING',
  READY: 'READY', // раскладка валидна, доступен выбор source
  AIMING: 'AIMING', // source выбран, ждём target
  FLICKING: 'FLICKING', // импульс применён, объекты летят
  RESULT: 'RESULT', // сценарий завершён
});

export class GameStateMachine {
  constructor(initial = GameStates.LOADING) {
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

  onChange(cb) {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== cb);
    };
  }
}

// Все настраиваемые параметры прототипа УПАЙ собраны здесь.
// Ничего из логики модулей менять не нужно, чтобы подстроить баланс/физику —
// правьте только эти значения.
export const CONFIG = {
  // --- Количество и размеры объектов ---
  chukoCount: 15, // обычных чүкө (+ 1 Хан)
  // Подняты с 1/1.18: на экране (особенно на телефоне) чүкө читались очень
  // мелко. Все геометрически завязанные пороги ниже (hitProxyDiameter,
  // layoutValidator.*) подняты пропорционально этому же множителю ~1.35x.
  chukoScale: 1.35,
  khanScale: 1.6,
  chukoSize: {
    // чүкө моделируется как вытянутая по X "капсула с квадратным сечением":
    // цилиндрическая часть даёт 4 плоские устойчивые грани (X±, вернее Y±/Z±),
    // скруглённые торцы не дают устойчиво стоять на конце.
    length: 0.095, // общая длина вдоль локальной оси X, м
    width: 0.034, // сечение по Z, м
    height: 0.034, // сечение по Y, м
    // Реальная модель мала на экране (особенно на телефоне) — тап мимо
    // видимой геометрии не должен промахиваться. Невидимая сфера этого
    // диаметра (м) служит увеличенной областью попадания для pointer-пика.
    hitProxyDiameter: 0.15,
  },

  // --- Физика (Havok) ---
  physics: {
    gravity: -9.81,
    chukoMass: 0.045,
    khanMass: 0.085,
    friction: 0.85, // высокое трение — поверхность войлочная (шырдак)
    restitution: 0.04, // низкий отскок
    linearDamping: 0.35,
    angularDamping: 0.6, // гасит бесконечное вращение
    groundFriction: 0.9,
    groundRestitution: 0.05,
    wallFriction: 0.4,
    wallRestitution: 0.15,
  },

  // --- Игровая зона и границы ---
  workArea: {
    width: 3.2, // по X, м
    depth: 4.6, // по Z, м
    wallHeight: 1.4,
    wallThickness: 0.05,
  },

  // --- Разметка экрана (mobile-first, вертикальная ориентация) ---
  ui: {
    // доля высоты канваса снизу, зарезервированная под UI и НЕ используемая камерой
    // для отображения рабочей зоны физики (кнопка «РАССЫПАТЬ», статус, счёт).
    bottomReservedFraction: 0.24,
  },

  // --- Рассыпание ---
  scatter: {
    radius: 0.55, // радиус зоны над центром поля
    heightMin: 0.9,
    heightMax: 1.25,
    heightJitterPerObject: 0.035,
    positionJitterXZ: 0.3,
    sideImpulseMax: 0.35,
  },

  // --- Порог остановки / стабилизации ---
  stability: {
    linearVelocityThreshold: 0.035, // м/с
    angularVelocityThreshold: 0.06, // рад/с
    minStableFrames: 30, // сколько кадров подряд ниже порога, чтобы считать «уснувшим»
    maxWaitFrames: 900, // аварийный потолок ожидания (~15с при 60 FPS)
  },

  // --- Валидатор раскладки ---
  layoutValidator: {
    minDistanceForFlick: 0.15, // минимальная дистанция между парой для комфортного щелчка
    maxStackHeightDelta: 0.05, // допустимая разница по Y при близких X/Z, иначе считается стопкой
    stackXZThreshold: 0.024,
    khanClearanceRadius: 0.2,
    khanClearanceMaxNeighbors: 2,
    maxRerollAttempts: 12,
  },

  // --- Щелчок ---
  flick: {
    baseForce: 0.55,
    forcePerDistance: 1.35,
    maxForce: 2.6,
    khanForceMultiplier: 1.15,
    aimCorrectionRange: 0.22, // насколько сильно система «подтягивает» траекторию к цели
    spinVariance: 1.1,
  },

  // --- Подсветка допустимых целей ---
  highlight: {
    sourceColor: [0.95, 0.72, 0.15],
    targetColor: [0.22, 0.9, 0.42],
    intensity: 0.55,
  },

  // --- Ввод ---
  input: {
    swipeMinDistancePx: 22,
    swipeMaxTimeMs: 550,
    swipeDirectionThreshold: 0.25, // мин. совпадение направления свайпа с целью (dot product)
  },

  // --- Сценарии ---
  // Число пар на один Упай — единственный игровой параметр здесь.
  // Сам сценарный контракт (коды, demoMultiplier для DEMO-выигрыша) живёт
  // в src/scenario-catalog.js — том же общем формате, что и в остальных
  // играх этого семейства (см. docs/LMS_API.md), не здесь.
  scenario: {
    pairsPerUpay: 3,
  },

  // --- Зоны накопления УПАЙ 1/2 (collector.js) ---
  collector: {
    zones: {
      upay1: { x: -0.85, z: 1.85 },
      upay2: { x: 0.85, z: 1.85 },
    },
    slotSpacing: 0.14, // расстояние между тремя слотами внутри зоны, м
    slotDiameter: 0.1, // диаметр опорного диска-слота
    arcHeight: 0.35, // высота дуги переноса, м
    arcDurationMs: 550,
  },

  // --- Debug-флаги ---
  debug: {
    showFps: true,
    showPhysicsBodies: false,
    showOrientationLabels: true,
    showTrajectory: false,
  },
};

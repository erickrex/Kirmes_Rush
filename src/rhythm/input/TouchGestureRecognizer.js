/**
 * @fileoverview TouchGestureRecognizer - attaches raw pointer listeners to the
 * game canvas and classifies each pointer interaction into a normalized
 * {@link Gesture} (`tap` / `holdStart` / `holdTick` / `release` / `flick`).
 *
 * It is the boundary between the browser's pointer events and the rest of the
 * Rhythm_Framework. Downstream, the RhythmInputManager performs the single
 * Input_Time -> Song_Position mapping and the CueJudger scores the result; this
 * recognizer only turns "the player physically did X" into a typed Gesture.
 *
 * Design references: `.kiro/specs/rhythm-minigame-prototype/design.md`
 * (TouchGestureRecognizer section) and the pointer-wiring conventions in
 * `src/input/TouchInputController.js`. Satisfies Requirements 2.2, 2.3, 3.2,
 * 4.2, 7.1, 14.1, 15.1-15.5, 17.1.
 *
 * ## The judged moment (R7.1)
 * Every emitted Gesture carries `startTime`, the clock value captured at
 * `pointerdown`. That is the moment used for judging - never the confirmation
 * (`pointerup`) time - so recognition latency never corrupts the score. By
 * default the clock is `performance.now()`; tests inject their own `now()`.
 *
 * ## Testability & holdTick timing (R17.1 / R17.2)
 * The DOM handlers (`_onDown` / `_onMove` / `_onUp`) accept any pointer-event-
 * like object (`{ pointerId, clientX, clientY }`) and read the current time from
 * the injected `now()`. They contain no real pointer physics, so a test can feed
 * a scripted sequence and assert the emitted Gestures.
 *
 * Because holds have no natural DOM event between press and release, holdTick is
 * NOT driven by `setInterval`/`setTimeout` (which would be untestable here).
 * Instead hold progression is a polled model: {@link poll} advances every active
 * hold to the supplied `now`, emitting `holdStart` once the hold threshold is
 * crossed and one `holdTick` per elapsed `holdTickIntervalMs` after that. The
 * scene calls `poll()` each frame; a test calls `poll(now)` (or lets `_onMove`
 * advance holds implicitly) to drive ticks deterministically.
 */

/**
 * @typedef {import('../../types.js').Gesture} Gesture
 * @typedef {import('../../types.js').GestureThresholds} GestureThresholds
 */

/**
 * A pointer-event-like object accepted by the internal handlers. Real DOM
 * `PointerEvent`s satisfy this shape; tests supply plain objects.
 * @typedef {Object} PointerLike
 * @property {number} [pointerId] - Identifier used to track multi-touch pointers.
 * @property {number} clientX - Pointer X position.
 * @property {number} clientY - Pointer Y position.
 */

/**
 * In-flight state tracked for a single active pointer between down and up.
 * @typedef {Object} ActivePointer
 * @property {number} startTime - Clock value at pointerdown (the judged moment).
 * @property {{ x: number, y: number }} startPosition - Position at pointerdown.
 * @property {{ x: number, y: number }} lastPosition - Most recent observed position.
 * @property {boolean} holdStarted - Whether `holdStart` has already been emitted.
 * @property {number} nextTickTime - Clock value at which the next `holdTick` is due.
 */

/**
 * Sensible default thresholds. Callers override any subset via `cfg.thresholds`.
 * @type {Readonly<GestureThresholds>}
 */
const DEFAULT_THRESHOLDS = Object.freeze({
  maxTapDurationMs: 200,
  maxTapMovePx: 16,
  holdThresholdMs: 250,
  holdTickIntervalMs: 50,
  flickDistancePx: 40,
  flickVelocityPxPerMs: 0.5
});

/**
 * Recognizes touch/pointer gestures on a canvas and reports them via a callback.
 */
class TouchGestureRecognizer {
  /**
   * @param {{
   *   canvas: HTMLCanvasElement,
   *   now?: () => number,
   *   thresholds?: Partial<GestureThresholds>,
   *   onGesture: (g: Gesture) => void
   * }} cfg
   *   - `canvas`: the element to listen on.
   *   - `now`: injectable clock; defaults to `() => performance.now()`.
   *   - `thresholds`: partial overrides merged over {@link DEFAULT_THRESHOLDS}.
   *   - `onGesture`: receives every emitted Gesture.
   */
  constructor(cfg) {
    const { canvas, now, thresholds, onGesture } = cfg ?? {};

    /** @type {HTMLCanvasElement} @private */
    this._canvas = canvas;

    /** @type {() => number} @private */
    this._now = typeof now === 'function' ? now : () => performance.now();

    /** @type {GestureThresholds} @private */
    this._thresholds = { ...DEFAULT_THRESHOLDS, ...(thresholds ?? {}) };

    /** @type {(g: Gesture) => void} @private */
    this._onGesture = typeof onGesture === 'function' ? onGesture : () => {};

    /**
     * Active pointers keyed by pointerId. A Map keeps multi-touch interactions
     * independent so two fingers do not clobber each other's hold state.
     * @type {Map<number, ActivePointer>}
     * @private
     */
    this._active = new Map();

    /**
     * Bound handler references kept so `detach()` can remove exactly what
     * `attach()` added (Property 7 - listener conservation).
     * @type {?{ down: (e: PointerEvent) => void, move: (e: PointerEvent) => void, up: (e: PointerEvent) => void }}
     * @private
     */
    this._boundHandlers = null;
  }

  /**
   * Register `pointerdown` / `pointermove` / `pointerup` listeners on the canvas
   * (R14.1). Idempotent: calling `attach()` twice does not double-register.
   */
  attach() {
    if (
      this._boundHandlers ||
      !this._canvas ||
      typeof this._canvas.addEventListener !== 'function'
    ) {
      return;
    }

    this._boundHandlers = {
      down: (event) => this._onDown(event),
      move: (event) => this._onMove(event),
      up: (event) => this._onUp(event)
    };

    this._canvas.addEventListener('pointerdown', this._boundHandlers.down);
    this._canvas.addEventListener('pointermove', this._boundHandlers.move);
    this._canvas.addEventListener('pointerup', this._boundHandlers.up);
  }

  /**
   * Remove every listener registered by {@link attach} (R16.1, Property 7) and
   * drop any in-flight pointer state. Safe to call when not attached.
   */
  detach() {
    if (
      this._boundHandlers &&
      this._canvas &&
      typeof this._canvas.removeEventListener === 'function'
    ) {
      this._canvas.removeEventListener('pointerdown', this._boundHandlers.down);
      this._canvas.removeEventListener('pointermove', this._boundHandlers.move);
      this._canvas.removeEventListener('pointerup', this._boundHandlers.up);
    }
    this._boundHandlers = null;
    this._active.clear();
  }

  /**
   * Advance every active hold to `nowValue`, emitting `holdStart` once the hold
   * threshold is crossed and one `holdTick` per elapsed `holdTickIntervalMs`
   * thereafter (R2.2 / R2.3). This is the polled hold model described in the
   * file header; the scene calls it each frame and tests call it to drive ticks
   * deterministically.
   * @param {number} [nowValue] - Clock value to advance to; defaults to `now()`.
   */
  poll(nowValue) {
    const now = typeof nowValue === 'number' ? nowValue : this._now();
    for (const pointer of this._active.values()) {
      this._advanceHold(pointer, now);
    }
  }

  /**
   * Handle a pointerdown: begin tracking the pointer and capture the judged
   * moment. Emits nothing itself - classification happens on move/up/poll.
   * @param {PointerLike} event - Pointer-event-like object.
   */
  _onDown(event) {
    const pointerId = TouchGestureRecognizer._pointerId(event);
    const startTime = this._now();
    const position = { x: event.clientX, y: event.clientY };

    this._active.set(pointerId, {
      startTime,
      startPosition: { ...position },
      lastPosition: { ...position },
      holdStarted: false,
      nextTickTime: startTime + this._thresholds.holdThresholdMs
    });
  }

  /**
   * Handle a pointermove: record the latest position and advance the hold, so
   * `holdTick`s can be emitted between press and release (R2.3).
   * @param {PointerLike} event - Pointer-event-like object.
   */
  _onMove(event) {
    const pointerId = TouchGestureRecognizer._pointerId(event);
    const pointer = this._active.get(pointerId);
    if (!pointer) {
      return;
    }
    pointer.lastPosition = { x: event.clientX, y: event.clientY };
    this._advanceHold(pointer, this._now());
  }

  /**
   * Handle a pointerup: classify the completed interaction and emit at most one
   * terminal Gesture.
   *
   * Priority: an interaction that already became a hold emits `release` carrying
   * the hold duration (R3.2); otherwise movement past the flick thresholds wins
   * over a tap (R15.3) and emits `flick` with its direction (R4.2 / R15.4); a
   * short, still press is a `tap` (R15.1); anything else emits nothing (R15.5).
   * @param {PointerLike} event - Pointer-event-like object.
   */
  _onUp(event) {
    const pointerId = TouchGestureRecognizer._pointerId(event);
    const pointer = this._active.get(pointerId);
    if (!pointer) {
      return;
    }
    this._active.delete(pointerId);

    const now = this._now();
    const position = { x: event.clientX, y: event.clientY };
    const durationMs = now - pointer.startTime;
    const distancePx = TouchGestureRecognizer._distance(pointer.startPosition, position);
    const velocityPxPerMs = durationMs > 0 ? distancePx / durationMs : 0;
    const t = this._thresholds;

    if (pointer.holdStarted) {
      // A hold in progress ends with a release carrying the hold duration (R3.2).
      this._emit('release', pointer, now, position, durationMs, distancePx, velocityPxPerMs, null);
      return;
    }

    if (distancePx > t.flickDistancePx && velocityPxPerMs > t.flickVelocityPxPerMs) {
      // Fast, long movement is a flick rather than a tap (R15.3), directed by the
      // start->release vector (R4.2 / R15.4).
      const direction = TouchGestureRecognizer._direction(pointer.startPosition, position);
      this._emit(
        'flick',
        pointer,
        now,
        position,
        durationMs,
        distancePx,
        velocityPxPerMs,
        direction
      );
      return;
    }

    if (durationMs < t.maxTapDurationMs && distancePx < t.maxTapMovePx) {
      // Short, still press is a tap (R15.1).
      this._emit('tap', pointer, now, position, durationMs, distancePx, velocityPxPerMs, null);
      return;
    }

    // Satisfies none of the classifications: emit nothing (R15.5).
  }

  /**
   * Advance a single active pointer's hold state to `now`, emitting `holdStart`
   * on threshold crossing and catch-up `holdTick`s at the tick interval.
   * @param {ActivePointer} pointer - Its tracked state (mutated in place).
   * @param {number} now - Clock value to advance to.
   * @private
   */
  _advanceHold(pointer, now) {
    const t = this._thresholds;
    const heldMs = now - pointer.startTime;

    if (!pointer.holdStarted) {
      if (heldMs < t.holdThresholdMs) {
        return;
      }
      // Threshold crossed: the interaction is a hold, not a tap (R15.2 / R2.2).
      pointer.holdStarted = true;
      const holdStartTime = pointer.startTime + t.holdThresholdMs;
      this._emit(
        'holdStart',
        pointer,
        holdStartTime,
        pointer.lastPosition,
        holdStartTime - pointer.startTime,
        TouchGestureRecognizer._distance(pointer.startPosition, pointer.lastPosition),
        0,
        null
      );
      pointer.nextTickTime = holdStartTime + t.holdTickIntervalMs;
    }

    // Emit one holdTick per elapsed interval, each carrying the elapsed hold
    // duration at that tick instant (R2.3).
    const interval = t.holdTickIntervalMs > 0 ? t.holdTickIntervalMs : Number.POSITIVE_INFINITY;
    while (now >= pointer.nextTickTime) {
      const tickTime = pointer.nextTickTime;
      this._emit(
        'holdTick',
        pointer,
        tickTime,
        pointer.lastPosition,
        tickTime - pointer.startTime,
        TouchGestureRecognizer._distance(pointer.startPosition, pointer.lastPosition),
        0,
        null
      );
      pointer.nextTickTime += interval;
    }
  }

  /**
   * Build a {@link Gesture} from the pointer state and hand it to `onGesture`.
   * @param {Gesture['type']} type - Gesture type.
   * @param {ActivePointer} pointer - The source pointer state.
   * @param {number} timestamp - Clock value of the producing event.
   * @param {{ x: number, y: number }} position - Position at that event.
   * @param {number} durationMs - Elapsed time since gesture-start.
   * @param {number} distancePx - Distance from start position.
   * @param {number} velocityPxPerMs - Movement velocity.
   * @param {Gesture['direction']} direction - Flick direction or null.
   * @private
   */
  _emit(type, pointer, timestamp, position, durationMs, distancePx, velocityPxPerMs, direction) {
    /** @type {Gesture} */
    const gesture = {
      type,
      startTime: pointer.startTime,
      timestamp,
      position: { x: position.x, y: position.y },
      startPosition: { x: pointer.startPosition.x, y: pointer.startPosition.y },
      durationMs,
      distancePx,
      velocityPxPerMs,
      direction
    };
    this._onGesture(gesture);
  }

  /**
   * Resolve a stable pointer key from a pointer-event-like object. Falls back to
   * `0` when no id is present (e.g. minimal synthetic events or mouse input).
   * @param {PointerLike} event - Pointer-event-like object.
   * @returns {number}
   * @private
   */
  static _pointerId(event) {
    return typeof event.pointerId === 'number' ? event.pointerId : 0;
  }

  /**
   * Euclidean distance between two points.
   * @param {{ x: number, y: number }} a
   * @param {{ x: number, y: number }} b
   * @returns {number}
   * @private
   */
  static _distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Compute a flick direction from the start->end vector. The dominant axis
   * wins; on the vertical axis positive Y is `down` (screen coordinates).
   * @param {{ x: number, y: number }} start
   * @param {{ x: number, y: number }} end
   * @returns {'up' | 'down' | 'left' | 'right'}
   * @private
   */
  static _direction(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'down' : 'up';
  }
}

export default TouchGestureRecognizer;

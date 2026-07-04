/**
 * @fileoverview RhythmScene - the Phaser scene that runs one data-driven rhythm
 * minigame. It is the composition root of the Rhythm_Framework: it instantiates
 * the RhythmClock, CueTimeline, CueScheduler, CueJudger, RhythmScoring,
 * TouchGestureRecognizer, RhythmInputManager, and the resolved Minigame
 * controller, wires them together, and drives the per-frame loop.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (RhythmScene section)
 * for the interface contract.
 *
 * ## Per-frame loop (R9)
 * Each frame {@link RhythmScene#update} derives Song_Position from
 * `AudioManager.currentTime` and feeds it to the clock, input manager, and
 * scheduler. Because Song_Position always comes from the audio clock, pause /
 * resume and `resync`/`forceResync` corrections are respected automatically
 * (R9.1-R9.3) — the scheduler never integrates its own clock.
 *
 * ```
 * clock.update(AM.currentTime)
 *   -> inputManager.syncClock(songPos, performance.now())
 *   -> scheduler.update(songPos)        // fires cues / opens+closes windows
 *   -> judge each buffered gesture       // dispatch feedback to the controller
 *   -> controller.update(...)
 *   -> detect run end -> ResultState     // R12.5
 * ```
 *
 * ## Cue / judgement dispatch
 * The scheduler surfaces due presentation cues and window-close misses through a
 * per-run emitter; the scene routes each to the controller via
 * Cue_Action_Dispatch ({@link dispatchCueAction}), falling back to the base
 * `onCue`/`onJudgement`/`onMiss` handlers when a timeline entry names no
 * specific method. Window-close misses are recorded into RhythmScoring here (the
 * CueJudger only records resolving judgements), so the end-of-run accuracy is
 * complete (R12.5).
 *
 * ## Mobile canvas + audio (R14)
 * On run begin the scene sets the game canvas `touch-action: none`, storing the
 * prior value so {@link RhythmScene#shutdown} (task 13.2) can restore it (R14.2 /
 * R14.3), and reuses the AudioManager unlock handling to resume a suspended Web
 * Audio context on the first user gesture (R14.5). The game runs in the portrait
 * 720x1280 canvas configured in `src/main.js` (R14.4).
 *
 * Satisfies Requirements 9.1, 9.2, 9.3, 12.5, 14.2, 14.4, 14.5. The full teardown
 * contract (R14.3, R16) is implemented in {@link RhythmScene#shutdown}.
 */

import Phaser from '../../phaser.js';
import AudioManager from '../../audio/AudioManager.js';
import SaveManager from '../../data/SaveManager.js';
import RhythmClock from '../core/RhythmClock.js';
import CueTimeline from '../core/CueTimeline.js';
import CueScheduler, { CueSchedulerEvents } from '../core/CueScheduler.js';
import CueJudger from '../core/CueJudger.js';
import RhythmScoring from '../core/RhythmScoring.js';
import TouchGestureRecognizer from '../input/TouchGestureRecognizer.js';
import RhythmInputManager from '../input/RhythmInputManager.js';
import { dispatchCueAction } from '../minigames/MinigameRegistry.js';

/**
 * @typedef {import('../core/RhythmSession.js').default} RhythmSession
 * @typedef {import('../../types.js').ResolvedCue} ResolvedCue
 * @typedef {import('../../types.js').Expectation} Expectation
 * @typedef {import('../../types.js').JudgementResult} JudgementResult
 * @typedef {import('../../types.js').RhythmResultSummary} RhythmResultSummary
 * @typedef {import('../../types.js').BufferedGesture} BufferedGesture
 */

/**
 * @typedef {Object} RhythmSceneInitData
 * @property {RhythmSession} [session] - The per-run value object built by LoadingState.
 */

/**
 * The scene key RhythmScene registers under (registered in `src/main.js` by task 14).
 * @type {string}
 */
const RHYTHM_SCENE_KEY = 'RhythmScene';

/**
 * The default scene to return to from ResultState after a rhythm run. The
 * intended flow returns to the minigame select screen (task 14); until that is
 * registered the session may override this via `session.returnScene`.
 * @type {string}
 */
const DEFAULT_RETURN_SCENE = 'MainMenuState';

/**
 * Phaser scene that runs a single data-driven rhythm minigame.
 * @extends Phaser.Scene
 */
export default class RhythmScene extends Phaser.Scene {
  constructor() {
    super({ key: RHYTHM_SCENE_KEY });

    /** @type {RhythmSession | null} */
    this.session = null;

    /** @type {RhythmClock | null} */
    this.clock = null;

    /** @type {CueTimeline | null} */
    this.timeline = null;

    /** @type {CueScheduler | null} */
    this.scheduler = null;

    /** @type {CueJudger | null} */
    this.judger = null;

    /** @type {RhythmScoring | null} */
    this.scoring = null;

    /** @type {TouchGestureRecognizer | null} */
    this.recognizer = null;

    /** @type {RhythmInputManager | null} */
    this.inputManager = null;

    /** @type {import('../minigames/RhythmMinigame.js').default | null} */
    this.controller = null;

    /** @type {AudioManager | null} */
    this.audioManager = null;

    /**
     * Per-run emitter the scheduler fires cues/misses on. A dedicated emitter
     * (rather than the global EventBus) keeps this run's subscriptions isolated
     * and trivially removable on teardown.
     * @type {Phaser.Events.EventEmitter | null}
     */
    this.bus = null;

    /**
     * Lookup from Expectation id to the resolved Expectation, so a judgement or
     * miss can find the controller method a timeline entry named for it.
     * @type {Map<string, Expectation>}
     * @private
     */
    this._expectationsById = new Map();

    /**
     * Ids of Expectations that have reached a terminal outcome (resolved or
     * missed). Used to record misses once and to detect run completion.
     * @type {Set<string>}
     * @private
     */
    this._terminalExpectationIds = new Set();

    /** @type {number} @private */
    this._cueCount = 0;

    /** @type {number} @private */
    this._expectationCount = 0;

    /** @type {number} @private */
    this._firedCueCount = 0;

    /**
     * The last Song_Position (ms) any timeline event occupies (latest cue time
     * or Expectation window close). Used to gate run-end detection.
     * @type {number}
     * @private
     */
    this._lastEventMs = -1;

    /** @type {boolean} @private */
    this._active = false;

    /** @type {boolean} @private */
    this._ended = false;

    /** @type {boolean} @private */
    this._audioComplete = false;

    /**
     * The canvas `touch-action` value present before the run, captured so
     * shutdown (task 13.2) can restore it (R14.2 / R14.3).
     * @type {string | null}
     * @private
     */
    this._priorTouchAction = null;

    /**
     * Raw DOM listener used to unlock a suspended Web Audio context on the first
     * user gesture (R14.5). Stored so task 13.2 can remove it on teardown.
     * @type {{ target: HTMLCanvasElement, handler: EventListener } | null}
     * @private
     */
    this._audioUnlockListener = null;
  }

  /**
   * Receive the per-run session from `scene.start('RhythmScene', { session })`.
   * @param {RhythmSceneInitData} [data] - Scene data.
   */
  init(data) {
    this.session = data?.session ?? null;
  }

  /**
   * Compose the framework for this run: instantiate every component, wire the
   * scheduler emitter, attach input, configure the mobile canvas, and start
   * audio (R14.2, R14.4, R14.5).
   */
  create() {
    const session = this.session;
    if (!session) {
      console.warn('[RhythmScene] create() called without a session; nothing to run.');
      return;
    }

    // Clock + baked timeline (beats -> Song_Position ms).
    this.clock = new RhythmClock();
    this.clock.start(session.clockConfig ?? { bpm: 120 });
    this.timeline = CueTimeline.build(session.timeline ?? [], this.clock);

    this._indexTimeline(this.timeline);

    // Scoring + scheduler (fed by an isolated per-run emitter) + judger.
    this.scoring = new RhythmScoring(session.scoring);
    this.bus = new Phaser.Events.EventEmitter();
    this.scheduler = new CueScheduler(this.timeline, this.bus);
    this.bus.on(CueSchedulerEvents.CUE, this._onCue, this);
    this.bus.on(CueSchedulerEvents.EXPECTATION_MISS, this._onExpectationMiss, this);
    this.judger = new CueJudger({ scheduler: this.scheduler, scoring: this.scoring });

    // Input: recognizer on the game canvas + the single-mapping input manager.
    const saveManager = SaveManager.getInstance();
    this.recognizer = new TouchGestureRecognizer({
      canvas: /** @type {HTMLCanvasElement} */ (this._canvas()),
      onGesture: () => {}
    });
    this.inputManager = new RhythmInputManager({ recognizer: this.recognizer, saveManager });
    this.recognizer.attach();

    // Mobile canvas handling: disable browser touch gestures, remembering the
    // prior value so shutdown can restore it (R14.2 / R14.3).
    this._applyCanvasTouchAction();

    // Controller: presentation + gesture meaning for this minigame.
    this._createController(session);

    // Audio: reuse the AudioManager unlock handling and start the run (R14.5).
    this._setupAudio(session);

    this._active = true;

    // Register shutdown into Phaser's scene lifecycle so teardown runs when the
    // scene stops (R16).
    this.events?.on('shutdown', this.shutdown, this);
  }

  /**
   * Per-frame loop. Derives Song_Position from `AudioManager.currentTime`, feeds
   * it to the clock/input-manager/scheduler, judges buffered gestures, updates
   * the controller, and checks for run end (R9, R12.5).
   * @param {number} time - Current time (ms).
   * @param {number} delta - Elapsed time since the last frame (ms).
   */
  update(time, delta) {
    if (!this._active) {
      return;
    }

    const songPositionMs = this.audioManager ? this.audioManager.currentTime : 0;
    const frameInputTime = RhythmScene._nowMs();

    this.clock?.update(songPositionMs);
    this.inputManager?.syncClock(songPositionMs, frameInputTime);

    // Advance the gesture recognizer's polled hold model to this frame so
    // holdStart/holdTick emit deterministically alongside the audio clock.
    this.recognizer?.poll(frameInputTime);

    this.scheduler?.update(songPositionMs);

    // Judge every gesture buffered since the last frame. Each is judged on its
    // gesture-start-derived Song_Position (Property 4); resolving judgements are
    // recorded into scoring by the judger, so the scene only dispatches feedback.
    const buffered = this.inputManager ? this.inputManager.consume() : [];
    for (const entry of buffered) {
      this._judgeBufferedGesture(entry);
    }

    if (this.controller && typeof this.controller.update === 'function') {
      this.controller.update(time, delta, {
        songPositionMs,
        songBeat: this.clock ? this.clock.songBeat : 0
      });
    }

    this._checkRunEnd(songPositionMs);
  }

  /**
   * Judge one buffered gesture and route feedback to the controller.
   * @param {BufferedGesture} entry - The buffered gesture (original + mapped time).
   * @private
   */
  _judgeBufferedGesture(entry) {
    if (!this.judger) {
      return;
    }
    const result = this.judger.judge(entry.gesture, entry.songPositionMs);
    if (result.resolved && result.expectationId) {
      this._terminalExpectationIds.add(result.expectationId);
    }

    const expectation = result.expectationId
      ? this._expectationsById.get(result.expectationId)
      : undefined;
    const actionName = expectation?.actions ? expectation.actions[result.judgement] : undefined;
    this._dispatch(actionName, result, () => this._defaultJudgement(result));
  }

  /**
   * Handle a due presentation cue: dispatch its named action, or fall back to
   * the controller's `onCue`.
   * @param {ResolvedCue} cue - The resolved presentation cue.
   * @private
   */
  _onCue(cue) {
    this._firedCueCount += 1;
    this._dispatch(cue.action, cue, () => {
      if (this.controller && typeof this.controller.onCue === 'function') {
        this.controller.onCue(cue);
      }
    });
  }

  /**
   * Handle a window-close miss: record it into scoring exactly once (the judger
   * only records resolving judgements) and route the miss to the controller.
   * @param {{ expectation: Expectation, judgement: string }} payload - Miss payload.
   * @private
   */
  _onExpectationMiss(payload) {
    const expectation = payload?.expectation;
    if (!expectation || this._terminalExpectationIds.has(expectation.id)) {
      return;
    }
    this._terminalExpectationIds.add(expectation.id);
    this.scoring?.record('miss');

    const actionName = expectation.actions ? expectation.actions.miss : undefined;
    this._dispatch(actionName, expectation, () => {
      if (this.controller && typeof this.controller.onMiss === 'function') {
        this.controller.onMiss(expectation);
      }
    });
  }

  /**
   * Route a judgement result to the controller's default judgement handler.
   * @param {JudgementResult} result - The judged outcome.
   * @private
   */
  _defaultJudgement(result) {
    if (this.controller && typeof this.controller.onJudgement === 'function') {
      this.controller.onJudgement(result);
    }
  }

  /**
   * Dispatch a named controller action via Cue_Action_Dispatch, falling back to
   * `fallback` when no action is named or when the named method is missing. A
   * missing named method is surfaced as a warning (R11.6) rather than crashing
   * the run loop.
   * @param {string | undefined} actionName - The controller method to invoke, if any.
   * @param {*} payload - The payload forwarded to the method.
   * @param {() => void} fallback - Invoked when no named action runs.
   * @private
   */
  _dispatch(actionName, payload, fallback) {
    if (typeof actionName === 'string' && actionName.length > 0 && this.controller) {
      try {
        dispatchCueAction(this.controller, actionName, payload);
        return;
      } catch (err) {
        console.warn(`[RhythmScene] ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (typeof fallback === 'function') {
      fallback();
    }
  }

  /**
   * Detect the end of the run and transition to ResultState (R12.5). The run
   * ends when the backing audio completes, or when every timeline event has been
   * consumed (all cues fired, all Expectations resolved/missed) and the clock has
   * passed the last event.
   * @param {number} songPositionMs - The current Song_Position.
   * @private
   */
  _checkRunEnd(songPositionMs) {
    if (this._ended) {
      return;
    }

    const hasTimeline = this._cueCount + this._expectationCount > 0;
    const timelineDone =
      hasTimeline &&
      this._firedCueCount >= this._cueCount &&
      this._terminalExpectationIds.size >= this._expectationCount &&
      songPositionMs >= this._lastEventMs;

    if (this._audioComplete || timelineDone) {
      this._endRun();
    }
  }

  /**
   * Finalize the run once: stop the loop and transition to ResultState with the
   * RhythmScoring result summary (R12.5). Idempotent.
   * @private
   */
  _endRun() {
    if (this._ended) {
      return;
    }
    this._ended = true;
    this._active = false;

    const summary = this.scoring ? this.scoring.summary() : null;
    this._startResult(summary);
  }

  /**
   * Start ResultState with the run's result summary payload (R12.5).
   * @param {RhythmResultSummary | null} summary - The end-of-run summary.
   * @private
   */
  _startResult(summary) {
    const definition = this.session?.definition;
    const payload = {
      score: summary?.score ?? 0,
      accuracy: summary ? Math.round(summary.accuracy * 10000) / 100 : 0,
      resultBand: summary?.resultBand ?? 'Try Again',
      counts: summary?.counts ?? null,
      rhythmSummary: summary,
      songData: {
        songName: definition?.name ?? 'Rhythm Minigame',
        returnScene: /** @type {any} */ (this.session)?.returnScene ?? DEFAULT_RETURN_SCENE
      }
    };

    if (this.scene && typeof this.scene.start === 'function') {
      this.scene.start('ResultState', payload);
    }
  }

  /**
   * Index the timeline for fast Expectation lookup and run-end accounting.
   * @param {CueTimeline} timeline - The baked timeline.
   * @private
   */
  _indexTimeline(timeline) {
    this._expectationsById = new Map();
    this._terminalExpectationIds = new Set();
    this._firedCueCount = 0;

    const cues = timeline.cues ?? [];
    const expectations = timeline.expectations ?? [];
    this._cueCount = cues.length;
    this._expectationCount = expectations.length;

    let last = -1;
    for (const cue of cues) {
      last = Math.max(last, cue.atMs);
    }
    for (const expectation of expectations) {
      this._expectationsById.set(expectation.id, expectation);
      last = Math.max(last, expectation.windowCloseMs);
    }
    this._lastEventMs = last;
  }

  /**
   * Instantiate the resolved Minigame controller and run its create() hook.
   * @param {RhythmSession} session - The per-run session.
   * @private
   */
  _createController(session) {
    const ControllerClass = /** @type {any} */ (session.controllerClass);
    if (typeof ControllerClass !== 'function') {
      console.warn('[RhythmScene] session has no controllerClass; running without a controller.');
      return;
    }
    this.controller = new ControllerClass(this, session);
    if (this.controller && typeof this.controller.create === 'function') {
      this.controller.create();
    }
  }

  /**
   * Create the AudioManager, apply saved volume options, load the backing
   * instrumental, register the unlock handling, and start playback from 0
   * (R14.5). When the track completes it flags the run as ended.
   * @param {RhythmSession} session - The per-run session.
   * @private
   */
  _setupAudio(session) {
    this.audioManager = new AudioManager(this);
    this.audioManager.applyOptionsFromSave();

    const instrumentalKey = session.audio?.instrumentalKey;
    if (typeof instrumentalKey === 'string' && instrumentalKey.length > 0) {
      this.audioManager.loadInstrumental(instrumentalKey);
    }

    this.audioManager.onComplete = () => this._onAudioComplete();

    // Reuse the AudioManager unlock handling to resume a suspended context on
    // the first user gesture, then start playback (R14.5).
    this._unlockAudioOnTouch();
    this.audioManager.play(0);
  }

  /**
   * Flag the backing audio as complete so the next update ends the run.
   * @private
   */
  _onAudioComplete() {
    this._audioComplete = true;
  }

  /**
   * Set the game canvas `touch-action: none` for the run, remembering the prior
   * value so shutdown (task 13.2) can restore it (R14.2 / R14.3).
   * @private
   */
  _applyCanvasTouchAction() {
    const canvas = this._canvas();
    if (canvas && canvas.style) {
      this._priorTouchAction = canvas.style.touchAction ?? '';
      canvas.style.touchAction = 'none';
    }
  }

  /**
   * Restore the game canvas `touch-action` to the value captured on
   * {@link RhythmScene#_applyCanvasTouchAction} (R14.3). Idempotent: once the
   * prior value has been restored it is cleared so a second shutdown is a no-op.
   * @private
   */
  _restoreCanvasTouchAction() {
    if (this._priorTouchAction === null) {
      return;
    }
    const canvas = this._canvas();
    if (canvas && canvas.style) {
      canvas.style.touchAction = this._priorTouchAction;
    }
    this._priorTouchAction = null;
  }

  /**
   * Register a one-time raw DOM listener that resumes a suspended Web Audio
   * context on the first user gesture, mirroring PlayScene's unlock handling
   * (R14.5). The listener removes itself once the context is running; task 13.2
   * also removes any pending listener on teardown.
   * @private
   */
  _unlockAudioOnTouch() {
    const canvas = this._canvas();
    if (!canvas || typeof canvas.addEventListener !== 'function') {
      return;
    }

    this._removeAudioUnlockListeners();

    const handler = () => {
      const ctx = /** @type {{ state: string, resume: () => Promise<void> } | undefined} */ (
        /** @type {any} */ (this.sound)?.context
      );
      if (ctx && ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            if (this.audioManager && !this.audioManager.isPlaying && this._active) {
              this.audioManager.play(this.audioManager.currentTime);
            }
            this._removeAudioUnlockListeners();
          })
          .catch(() => {});
      } else if (ctx && ctx.state === 'running') {
        this._removeAudioUnlockListeners();
      }
    };

    this._audioUnlockListener = { target: canvas, handler };
    canvas.addEventListener('touchstart', handler, { passive: true });
    canvas.addEventListener('touchend', handler, { passive: true });
    canvas.addEventListener('mousedown', handler);
    canvas.addEventListener('click', handler);
  }

  /**
   * Remove any pending raw DOM audio-unlock listeners.
   * @private
   */
  _removeAudioUnlockListeners() {
    if (!this._audioUnlockListener) {
      return;
    }
    const { target, handler } = this._audioUnlockListener;
    if (target && typeof target.removeEventListener === 'function') {
      target.removeEventListener('touchstart', handler);
      target.removeEventListener('touchend', handler);
      target.removeEventListener('mousedown', handler);
      target.removeEventListener('click', handler);
    }
    this._audioUnlockListener = null;
  }

  /**
   * The game canvas, when available.
   * @returns {HTMLCanvasElement | null}
   * @private
   */
  _canvas() {
    return /** @type {any} */ (this.game)?.canvas ?? null;
  }

  /**
   * Read the current high-resolution time in milliseconds for input anchoring.
   * @returns {number}
   * @private
   */
  static _nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /**
   * Tear down the run completely and idempotently (R14.3, R16). Called by
   * Phaser's `shutdown` scene event and safe to call again afterwards: every
   * owned reference is nulled, so a second invocation short-circuits on the
   * `?.`/null guards below.
   *
   * Teardown order:
   * - halt the per-frame loop and stop listening for `shutdown` (R16.3);
   * - detach the recognizer so zero pointer listeners remain (R16.1, Property 7);
   * - remove this run's emitter subscriptions (R16.2);
   * - cancel any pending timers/tweens owned by the scene (R16.2);
   * - restore the canvas `touch-action` captured on create() (R14.3);
   * - remove any pending raw DOM audio-unlock listeners (R14.5 teardown);
   * - release the controller's game objects (R16.4) and the clock's Conductor;
   * - stop and destroy audio;
   * - null every owned reference created in create() (R16.2).
   */
  shutdown() {
    // Halt the loop first so no queued frame processes mid-teardown.
    this._active = false;

    // R16.3: stop listening for the scene shutdown event.
    this.events?.off('shutdown', this.shutdown, this);

    // R16.1 / Property 7: remove every pointer listener the recognizer added.
    this.recognizer?.detach?.();

    // R16.2: drop this run's isolated emitter subscriptions.
    if (this.bus) {
      this.bus.off(CueSchedulerEvents.CUE, this._onCue, this);
      this.bus.off(CueSchedulerEvents.EXPECTATION_MISS, this._onExpectationMiss, this);
      this.bus.removeAllListeners?.();
    }

    // R16.2: cancel any pending timers/tweens owned by this scene.
    this.time?.removeAllEvents?.();
    this.tweens?.killAll?.();

    // R14.3: restore the canvas touch-action captured on create().
    this._restoreCanvasTouchAction();

    // Remove any pending raw DOM audio-unlock listeners (R14.5 teardown).
    this._removeAudioUnlockListeners();

    // R16.4: the controller releases every game object it created.
    if (this.controller && typeof this.controller.destroy === 'function') {
      this.controller.destroy();
    }

    // Release the clock's wrapped Conductor.
    if (this.clock && typeof this.clock.destroy === 'function') {
      this.clock.destroy();
    }

    // Stop and release the backing audio.
    if (this.audioManager) {
      if (typeof this.audioManager.stop === 'function') {
        this.audioManager.stop();
      }
      if (typeof this.audioManager.destroy === 'function') {
        this.audioManager.destroy();
      }
      this.audioManager.onComplete = null;
    }

    // R16.2: null every owned reference created in create().
    this.clock = null;
    this.timeline = null;
    this.scheduler = null;
    this.judger = null;
    this.scoring = null;
    this.recognizer = null;
    this.inputManager = null;
    this.controller = null;
    this.audioManager = null;
    this.bus = null;
  }
}

export { RhythmScene, RHYTHM_SCENE_KEY };

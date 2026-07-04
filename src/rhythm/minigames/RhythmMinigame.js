/**
 * @fileoverview RhythmMinigame - the base class/interface for a data-driven
 * minigame controller. A concrete Minigame_Controller (TapClapGame, FillBotGame,
 * ReleaseGame, FlickRallyGame) subclasses this and declares only presentation +
 * gesture meaning; the framework (RhythmClock/CueScheduler/CueJudger/RhythmScoring)
 * owns timing and judgement.
 *
 * The base owns scene layout/sprite conventions and the lifecycle contract; each
 * concrete presentation lives in a subclass (see task 12). It provides sensible
 * no-op / overridable defaults for every lifecycle method so that a controller
 * only overrides what it needs, and any unimplemented Cue_Action_Dispatch target
 * surfaces through {@link import('./MinigameRegistry.js').dispatchCueAction} as a
 * descriptive error rather than a silent failure (R11.6).
 *
 * Ownership + teardown: every game object a controller creates must be tracked
 * via {@link RhythmMinigame#own} so that {@link RhythmMinigame#destroy} can
 * release all of them when RhythmScene shuts down (R16.4). This mirrors the
 * scene teardown contract in ARCHITECTURE.md: `create()` produces owned objects,
 * `destroy()` releases and nulls them.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md`
 * (RhythmMinigame base + controllers section). Satisfies Requirements 11.4, 16.4.
 */

/**
 * @typedef {import('../core/RhythmSession.js').default} RhythmSession
 * @typedef {import('../../types.js').ResolvedCue} ResolvedCue
 * @typedef {import('../../types.js').Expectation} Expectation
 * @typedef {import('../../types.js').JudgementResult} JudgementResult
 */

/**
 * Base lifecycle for a Rhythm_Framework minigame controller. All methods are
 * safe no-op defaults intended to be overridden by concrete controllers.
 */
class RhythmMinigame {
  /**
   * @param {Object} scene - The owning RhythmScene (or a mock in tests). Used to
   *   create/add game objects; never re-initializes boot services.
   * @param {RhythmSession} session - The per-run value object describing the
   *   loaded minigame (definition, timeline, audio, scoring, controller class).
   */
  constructor(scene, session) {
    /**
     * The owning scene. Nulled on {@link RhythmMinigame#destroy}.
     * @type {Object|null}
     */
    this.scene = scene ?? null;

    /**
     * The per-run session value object. Nulled on {@link RhythmMinigame#destroy}.
     * @type {RhythmSession|null}
     */
    this.session = session ?? null;

    /**
     * Game objects created by this controller, tracked so {@link RhythmMinigame#destroy}
     * can release every one of them (R16.4).
     * @type {Array<{ destroy?: () => void }>}
     * @protected
     */
    this._owned = [];

    /**
     * Whether {@link RhythmMinigame#destroy} has already run. Guards against a
     * double teardown (e.g. explicit destroy + scene shutdown).
     * @type {boolean}
     * @protected
     */
    this._destroyed = false;
  }

  /**
   * Track a game object as owned by this controller so it is released on
   * teardown. Returns the object for convenient inline use, e.g.
   * `this.sprite = this.own(scene.add.sprite(...))`.
   * @template {{ destroy?: () => void }} T
   * @param {T} object - The game object to take ownership of.
   * @returns {T} The same object.
   */
  own(object) {
    if (object !== null && object !== undefined) {
      this._owned.push(object);
    }
    return object;
  }

  /**
   * Build/lay out the controller's scene objects. Default is a no-op; concrete
   * controllers override to create sprites/animations and register them via
   * {@link RhythmMinigame#own}.
   * @returns {void}
   */
  create() {}

  /**
   * Per-frame update hook driven by RhythmScene.
   * @param {number} _time - Current time (ms).
   * @param {number} _delta - Elapsed time since the last frame (ms).
   * @param {Object} [_ctx] - Optional per-frame context (e.g. song position, active state).
   * @returns {void}
   */
  update(_time, _delta, _ctx) {}

  /**
   * Presentation cue dispatch target. RhythmScene routes a due presentation cue
   * here when the cue's `action` is not a more specific controller method.
   * Default is a no-op; concrete controllers override to present the cue.
   * @param {ResolvedCue|Object} _event - The resolved presentation cue.
   * @returns {void}
   */
  onCue(_event) {}

  /**
   * Default Judgement handler. Specific feedback (onPerfect/onGood/onBarely/onMiss)
   * is dispatched via Cue_Action_Dispatch when a timeline entry names those
   * methods; this default catches Judgements that name no specific handler.
   * Default is a no-op; concrete controllers override to present feedback.
   * @param {JudgementResult|Object} _result - The judged outcome.
   * @returns {void}
   */
  onJudgement(_result) {}

  /**
   * Called when an Expectation is marked `miss` at window close without a
   * specific `onMiss` handler. Default is a no-op; controllers override to
   * present the missed-input feedback.
   * @param {Expectation|Object} _expectation - The missed Expectation.
   * @returns {void}
   */
  onMiss(_expectation) {}

  /**
   * Release every owned game object and null shared references (R16.4). Each
   * tracked object with a `destroy` function is destroyed; the owned list, the
   * scene, and the session references are then cleared. Idempotent.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;

    for (const object of this._owned) {
      if (object && typeof object.destroy === 'function') {
        object.destroy();
      }
    }
    this._owned = [];
    this.scene = null;
    this.session = null;
  }
}

export default RhythmMinigame;
export { RhythmMinigame };

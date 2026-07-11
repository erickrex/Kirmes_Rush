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

    /**
     * Persistent on-screen instruction line describing what the player must do.
     * Created by {@link RhythmMinigame#initHud}; owned, so teardown releases it.
     * @type {Object|null}
     */
    this.instructionBanner = null;

    /**
     * Pulsing tempo indicator driven each frame from `songBeat` so the player
     * can feel the beat. Created by {@link RhythmMinigame#initHud}.
     * @type {Object|null}
     */
    this.beatIndicator = null;

    /**
     * The transient "act now" cue prompt (e.g. "TAP!"), replaced on each cue.
     * Not owned: {@link RhythmMinigame#destroy} releases it explicitly.
     * @type {Object|null}
     */
    this.cuePrompt = null;

    /**
     * The last integer beat the {@link RhythmMinigame#beatIndicator} pulsed on,
     * so the pulse fires once per beat rather than every frame.
     * @type {number}
     * @private
     */
    this._lastPulsedBeat = -1;
  }

  /**
   * The instruction line shown for this minigame. Override in a concrete
   * controller to describe the mechanic in one short sentence; the default
   * shows nothing.
   * @returns {string|null} The instruction text, or null for no banner.
   */
  getInstruction() {
    return null;
  }

  /**
   * Build the shared player-facing HUD: the instruction banner and the tempo
   * beat indicator. Concrete controllers call this at the end of their own
   * {@link RhythmMinigame#create} so every minigame reads consistently. Every
   * object is created through a guarded factory, so this is a safe no-op in a
   * headless scene (the mock scenes used in tests expose no text/arc factory).
   * @returns {void}
   */
  initHud() {
    this.showInstruction(this.getInstruction());
    this._createBeatIndicator();
  }

  /**
   * Scale a sprite so its rendered height is approximately `fraction` of the
   * scene height, keeping large source art (e.g. the committed FNF character
   * atlases) from overflowing or clipping the portrait canvas. No-op when the
   * sprite is null, cannot scale, or has no measurable frame height
   * (headless/test-safe).
   * @param {Object|null} sprite - The target sprite.
   * @param {number} fraction - Desired rendered height as a fraction of the scene height.
   * @returns {void}
   */
  fitSpriteToHeight(sprite, fraction) {
    const target = /** @type {any} */ (sprite);
    if (!target || typeof target.setScale !== 'function') {
      return;
    }
    const frameHeight = typeof target.height === 'number' ? target.height : 0;
    if (!(frameHeight > 0) || !(fraction > 0)) {
      return;
    }
    const scale = (this._sceneHeight() * fraction) / frameHeight;
    target.setScale(scale);
  }

  /**
   * Show (or replace) the persistent instruction banner near the top of the
   * screen. Owned so it is released on teardown. No-op when `text` is empty or
   * the scene exposes no text factory.
   * @param {string|null} [text] - The instruction text.
   * @returns {Object|null} The created text object, or null.
   */
  showInstruction(text) {
    if (typeof text !== 'string' || text.length === 0) {
      return null;
    }
    const banner = /** @type {any} */ (
      this._addText(this._sceneWidth() * 0.5, this._sceneHeight() * 0.09, text, {
        fontFamily: 'Arial',
        fontSize: '30px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: this._sceneWidth() * 0.86 }
      })
    );
    if (banner) {
      if (typeof banner.setOrigin === 'function') {
        banner.setOrigin(0.5, 0.5);
      }
      if (typeof banner.setDepth === 'function') {
        banner.setDepth(1000);
      }
      this.instructionBanner = banner;
    }
    return banner;
  }

  /**
   * Flash a large, transient "act now" prompt (e.g. "TAP!") near the top-centre,
   * replacing any previous prompt. Fades out and destroys itself when the scene
   * exposes a tween factory. No-op when `text` is empty or no text factory is
   * available.
   * @param {string} text - The prompt text.
   * @returns {Object|null} The created prompt object, or null.
   */
  flashCue(text) {
    if (typeof text !== 'string' || text.length === 0) {
      return null;
    }

    const previous = /** @type {any} */ (this.cuePrompt);
    if (previous && typeof previous.destroy === 'function') {
      previous.destroy();
    }
    this.cuePrompt = null;

    const prompt = /** @type {any} */ (
      this._addText(this._sceneWidth() * 0.5, this._sceneHeight() * 0.2, text, {
        fontFamily: 'Arial Black',
        fontSize: '64px',
        color: '#ffe066',
        align: 'center'
      })
    );
    if (!prompt) {
      return null;
    }
    if (typeof prompt.setOrigin === 'function') {
      prompt.setOrigin(0.5, 0.5);
    }
    if (typeof prompt.setDepth === 'function') {
      prompt.setDepth(1001);
    }
    this.cuePrompt = prompt;

    const tweens = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).tweens;
    if (tweens && typeof tweens.add === 'function') {
      tweens.add({
        targets: prompt,
        alpha: { from: 1, to: 0 },
        scale: { from: 1.15, to: 0.9 },
        duration: 420,
        onComplete: () => {
          if (typeof prompt.destroy === 'function') {
            prompt.destroy();
          }
          if (this.cuePrompt === prompt) {
            this.cuePrompt = null;
          }
        }
      });
    }
    return prompt;
  }

  /**
   * Advance the tempo beat indicator, pulsing it once each time the integer beat
   * advances so the player can feel the tempo. Safe to call every frame; no-op
   * when there is no indicator. Concrete controllers that override
   * {@link RhythmMinigame#update} should call this (or `super.update`) so the
   * pulse keeps running.
   * @param {Object} [ctx] - Per-frame context carrying `songBeat`.
   * @returns {void}
   */
  updateBeatIndicator(ctx) {
    const dot = /** @type {any} */ (this.beatIndicator);
    if (!dot) {
      return;
    }
    const anyCtx = /** @type {any} */ (ctx);
    const beat = anyCtx && typeof anyCtx.songBeat === 'number' ? anyCtx.songBeat : 0;
    const currentBeat = Math.floor(beat);
    if (currentBeat === this._lastPulsedBeat) {
      return;
    }
    this._lastPulsedBeat = currentBeat;

    if (typeof dot.setScale === 'function') {
      dot.setScale(1.7);
    }
    const tweens = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).tweens;
    if (tweens && typeof tweens.add === 'function') {
      tweens.add({ targets: dot, scaleX: 1, scaleY: 1, duration: 160 });
    }
  }

  /**
   * Create the tempo beat indicator dot. Owned, guarded, headless-safe.
   * @returns {void}
   * @private
   */
  _createBeatIndicator() {
    const radius = Math.max(8, this._sceneWidth() * 0.02);
    const dot = /** @type {any} */ (
      this._addCircle(this._sceneWidth() * 0.5, this._sceneHeight() * 0.15, radius, 0xffe066)
    );
    if (dot) {
      if (typeof dot.setDepth === 'function') {
        dot.setDepth(1000);
      }
      this.beatIndicator = dot;
      this._lastPulsedBeat = -1;
    }
  }

  /**
   * Create + own a text object when the scene exposes a text factory.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {string} text - The text content.
   * @param {Object} [style] - Phaser text style.
   * @returns {Object|null} The created text, or null when unavailable.
   * @private
   */
  _addText(x, y, text, style) {
    const add = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).add;
    if (!add || typeof add.text !== 'function') {
      return null;
    }
    return this.own(add.text(x, y, text, style));
  }

  /**
   * Create + own a circle (arc) when the scene exposes a circle factory.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} radius - Circle radius.
   * @param {number} color - Fill color (0xRRGGBB).
   * @returns {Object|null} The created circle, or null when unavailable.
   * @private
   */
  _addCircle(x, y, radius, color) {
    const add = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).add;
    if (!add || typeof add.circle !== 'function') {
      return null;
    }
    return this.own(add.circle(x, y, radius, color));
  }

  /**
   * Best-effort scene width, defaulting to a portrait canvas width. Concrete
   * controllers may override; this is the shared fallback.
   * @returns {number} Width in pixels.
   * @protected
   */
  _sceneWidth() {
    const scale = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).scale;
    const w = scale && typeof scale.width === 'number' ? scale.width : undefined;
    return typeof w === 'number' ? w : 720;
  }

  /**
   * Best-effort scene height, defaulting to a portrait canvas height. Concrete
   * controllers may override; this is the shared fallback.
   * @returns {number} Height in pixels.
   * @protected
   */
  _sceneHeight() {
    const scale = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).scale;
    const h = scale && typeof scale.height === 'number' ? scale.height : undefined;
    return typeof h === 'number' ? h : 1280;
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
   * Per-frame update hook driven by RhythmScene. The base implementation
   * advances the shared tempo beat indicator; concrete controllers that
   * override this should call `super.update(...)` (or
   * {@link RhythmMinigame#updateBeatIndicator}) to keep the pulse running.
   * @param {number} _time - Current time (ms).
   * @param {number} _delta - Elapsed time since the last frame (ms).
   * @param {Object} [ctx] - Optional per-frame context (e.g. song position, song beat).
   * @returns {void}
   */
  update(_time, _delta, ctx) {
    this.updateBeatIndicator(ctx);
  }

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

    // The transient cue prompt is not owned; release it explicitly.
    const prompt = /** @type {any} */ (this.cuePrompt);
    if (prompt && typeof prompt.destroy === 'function') {
      prompt.destroy();
    }
    this.cuePrompt = null;

    for (const object of this._owned) {
      if (object && typeof object.destroy === 'function') {
        object.destroy();
      }
    }
    this._owned = [];
    this.instructionBanner = null;
    this.beatIndicator = null;
    this.scene = null;
    this.session = null;
  }
}

export default RhythmMinigame;
export { RhythmMinigame };

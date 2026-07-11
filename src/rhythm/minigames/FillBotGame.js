/**
 * @fileoverview FillBotGame - the Hold (hold-for-duration) Minigame_Controller.
 *
 * A concrete {@link RhythmMinigame} for the `fill-bot` Minigame_Definition
 * (`assets/data/rhythm/minigames/fill-bot.json`). Like every controller it owns
 * only *presentation* and *gesture meaning*: the framework
 * (RhythmClock/CueScheduler/CueJudger/RhythmScoring) owns timing and judgement
 * and routes due cues/judgements here through Cue_Action_Dispatch (see
 * {@link import('./MinigameRegistry.js').dispatchCueAction}).
 *
 * Presentation: a continuous **fill meter**. While a hold is in progress the
 * Touch_Gesture_Recognizer emits `holdTick` Gestures carrying the elapsed hold
 * `durationMs` (R2.3); the controller maps that elapsed duration against the
 * active Expectation's `targetSpanMs` to a fill fraction in `[0, 1]` and drives
 * the fill bar accordingly (R2.4). Because the reported hold duration only ever
 * increases, the fill fraction is monotonic across a single hold.
 *
 * Cue_Action_Dispatch targets required by fill-bot.json:
 *  - cue action `fillCue` — prime the meter for the upcoming hold (reset to 0);
 *  - feedback `fillPerfect` / `fillGood` / `fillBarely` / `fillMiss` — the bot
 *    reacts and a judgement popup is shown when the hold Expectation resolves
 *    (R2.5).
 *
 * All objects created in {@link FillBotGame#create} are tracked via
 * {@link RhythmMinigame#own} so {@link RhythmMinigame#destroy} releases them on
 * scene teardown (R16.4). Uses only committed assets declared by the definition
 * (BF/daddyDearest Sparrow atlases and the rhythm judgement popup images).
 * Requirements 2.1, 2.4, 2.5.
 */

import RhythmMinigame from './RhythmMinigame.js';
import { registerRhythmCharacterAnims, rhythmAnimKey } from './RhythmCharacterAnimations.js';

/**
 * @typedef {import('../core/RhythmSession.js').default} RhythmSession
 * @typedef {import('../../types.js').ResolvedCue} ResolvedCue
 * @typedef {import('../../types.js').JudgementResult} JudgementResult
 * @typedef {import('../../types.js').Expectation} Expectation
 * @typedef {import('../../types.js').Gesture} Gesture
 */

/**
 * Default cache keys for the committed assets the fill-bot definition declares.
 * Kept in sync with `assets/data/rhythm/minigames/fill-bot.json`.
 * @type {{ botAtlas: string, playerAtlas: string, popups: Record<string, string> }}
 */
const FILL_BOT_ASSETS = {
  botAtlas: 'dad',
  playerAtlas: 'bf',
  popups: {
    perfect: 'popup-sick',
    good: 'popup-good',
    barely: 'popup-bad',
    miss: 'popup-shit'
  }
};

/**
 * Atlas frame prefixes for the poses this controller drives. Missing poses
 * degrade gracefully to a no-op (headless/test-safe).
 * @type {{ botCheer: string, playerHold: string, idle: string }}
 */
const POSES = {
  botCheer: 'cheer',
  playerHold: 'hey',
  idle: 'idle'
};

/**
 * Fallback target hold span (ms) used to map elapsed hold duration to a fill
 * fraction when no active Expectation has supplied its `targetSpanMs` yet. The
 * framework normally reports the real span via {@link FillBotGame#onHoldTick};
 * this keeps the visual sensible in isolation.
 * @type {number}
 */
const DEFAULT_TARGET_SPAN_MS = 2000;

/**
 * Clamp a number to the inclusive `[min, max]` range.
 * @param {number} value - The value to clamp.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @returns {number} The clamped value.
 */
function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/**
 * The Hold Minigame_Controller: a continuous fill meter driven by holdTick
 * duration, plus committed BF/daddyDearest atlases and a judgement popup.
 * Declares presentation + gesture meaning only.
 */
class FillBotGame extends RhythmMinigame {
  /**
   * @param {Object} scene - The owning RhythmScene (or a mock in tests).
   * @param {RhythmSession} [session] - The per-run session value object.
   */
  constructor(scene, session) {
    super(scene, /** @type {any} */ (session));

    /**
     * The "fill bot" sprite (daddyDearest) that reacts to the hold outcome.
     * @type {Object|null}
     */
    this.bot = null;

    /**
     * The player's sprite (BOYFRIEND) that reacts while holding.
     * @type {Object|null}
     */
    this.player = null;

    /**
     * The meter background frame.
     * @type {Object|null}
     */
    this.meter = null;

    /**
     * The meter's fill bar whose extent tracks {@link FillBotGame#fillFraction}.
     * @type {Object|null}
     */
    this.fillBar = null;

    /**
     * The currently displayed judgement popup image, if any.
     * @type {Object|null}
     */
    this.popup = null;

    /**
     * Continuous fill state in `[0, 1]` derived from the reported hold duration.
     * @type {number}
     */
    this.fillFraction = 0;

    /**
     * Target hold span (ms) used to map elapsed hold duration to the fill
     * fraction. Updated whenever an Expectation reports its `targetSpanMs`.
     * @type {number}
     */
    this.targetSpanMs = DEFAULT_TARGET_SPAN_MS;

    /**
     * Full pixel width of the fill bar at fraction `1`, captured at create()
     * so the fill can be applied via width when the object supports it.
     * @type {number}
     * @private
     */
    this._meterWidth = 0;
  }

  /**
   * Build the controller's scene objects and register them for teardown.
   * Safe to call in a headless test: when the scene has no game-object factory
   * the objects are left null and every method becomes a no-op.
   * @returns {void}
   */
  create() {
    const width = this._sceneWidth();
    const height = this._sceneHeight();

    this.bot = this._addSprite(width * 0.5, height * 0.38, FILL_BOT_ASSETS.botAtlas);
    this.player = this._addSprite(width * 0.5, height * 0.62, FILL_BOT_ASSETS.playerAtlas);
    this.fitSpriteToHeight(this.bot, 0.22);
    this.fitSpriteToHeight(this.player, 0.24);
    this._play(this.bot, POSES.idle);
    this._play(this.player, POSES.idle);

    // Continuous fill meter: a background frame plus a fill bar anchored to its
    // left edge so scaling/width reflects the fill fraction left-to-right.
    this._meterWidth = width * 0.7;
    const meterX = width * 0.5;
    const meterY = height * 0.82;
    const meterHeight = height * 0.04;

    this.meter = this._addRect(meterX, meterY, this._meterWidth, meterHeight, 0x222222);

    const fillX = meterX - this._meterWidth / 2;
    this.fillBar = this._addRect(fillX, meterY, this._meterWidth, meterHeight, 0x33cc66);
    this._setOriginLeft(this.fillBar);

    this.fillFraction = 0;
    this._applyFill(0);

    this.initHud();
  }

  /**
   * @override
   * @returns {string} The fill-bot instruction line.
   */
  getInstruction() {
    return 'Press and HOLD to fill the meter, then let go when it is full!';
  }

  // ==========================================================================
  // Gesture meaning — continuous hold progress (R2.4)
  // ==========================================================================

  /**
   * Receive holdTick progress and drive the fill bar. Maps the Gesture's elapsed
   * hold `durationMs` against the active Expectation's `targetSpanMs` to a fill
   * fraction in `[0, 1]`, then updates the continuous visual state (R2.4). The
   * reported duration only increases across a hold, so the fill is monotonic.
   * @param {Gesture|Object} gesture - The holdTick Gesture carrying `durationMs`.
   * @param {Expectation|Object} [expectation] - The active hold Expectation;
   *   when it supplies `targetSpanMs` that becomes the new mapping span.
   * @returns {number} The resulting fill fraction in `[0, 1]`.
   */
  onHoldTick(gesture, expectation) {
    if (
      expectation &&
      typeof expectation === 'object' &&
      typeof (/** @type {any} */ (expectation).targetSpanMs) === 'number' &&
      /** @type {any} */ (expectation).targetSpanMs > 0
    ) {
      this.targetSpanMs = /** @type {any} */ (expectation).targetSpanMs;
    }

    const durationMs =
      gesture &&
      typeof gesture === 'object' &&
      typeof (/** @type {any} */ (gesture).durationMs) === 'number'
        ? /** @type {any} */ (gesture).durationMs
        : 0;
    const span = this.targetSpanMs > 0 ? this.targetSpanMs : DEFAULT_TARGET_SPAN_MS;
    const fraction = clamp(durationMs / span, 0, 1);

    this._applyFill(fraction);
    this._play(this.player, POSES.playerHold);
    return fraction;
  }

  /**
   * Per-frame update hook. The fill meter is event-driven via
   * {@link FillBotGame#onHoldTick}; this keeps the shared tempo beat indicator
   * pulsing (R2.4).
   * @param {number} _time - Current time (ms).
   * @param {number} _delta - Elapsed time since the last frame (ms).
   * @param {Object} [ctx] - Optional per-frame context carrying `songBeat`.
   * @returns {void}
   */
  update(_time, _delta, ctx) {
    this.updateBeatIndicator(ctx);
  }

  // ==========================================================================
  // Cue_Action_Dispatch targets (named by fill-bot.json)
  // ==========================================================================

  /**
   * Cue action `fillCue`: prime the meter for the upcoming hold by resetting the
   * fill to empty so the player sees a fresh bar to fill (R2.4).
   * @param {ResolvedCue|Object} [_cue] - The resolved presentation cue.
   * @returns {void}
   */
  fillCue(_cue) {
    this.targetSpanMs = DEFAULT_TARGET_SPAN_MS;
    this._applyFill(0);
    this._play(this.bot, POSES.botCheer);
    this.flashCue('HOLD!');
  }

  /**
   * Feedback `fillPerfect`: the hold matched its target span exactly (R2.5).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  fillPerfect(_result) {
    this._applyFill(1);
    this._play(this.bot, POSES.botCheer);
    this._showPopup('perfect');
  }

  /**
   * Feedback `fillGood`: the hold landed a `good` span (R2.5).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  fillGood(_result) {
    this._play(this.bot, POSES.botCheer);
    this._showPopup('good');
  }

  /**
   * Feedback `fillBarely`: the hold landed a `barely` span (R2.5).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  fillBarely(_result) {
    this._play(this.bot, POSES.botCheer);
    this._showPopup('barely');
  }

  /**
   * Feedback `fillMiss`: the hold Expectation resolved as a miss (R2.5).
   * @param {Expectation|JudgementResult|Object} [_info] - The missed outcome.
   * @returns {void}
   */
  fillMiss(_info) {
    this._applyFill(0);
    this._play(this.player, POSES.idle);
    this._showPopup('miss');
  }

  // ==========================================================================
  // Base overrides — sensible defaults routed to the named handlers above
  // ==========================================================================

  /**
   * Presentation cue fallback: any cue that does not name a more specific
   * controller method primes the meter.
   * @param {ResolvedCue|Object} event - The resolved presentation cue.
   * @returns {void}
   */
  onCue(event) {
    this.fillCue(event);
  }

  /**
   * Default judgement fallback for judgements that name no specific handler:
   * route by the judgement category to the matching feedback method.
   * @param {JudgementResult|Object} result - The judged outcome.
   * @returns {void}
   */
  onJudgement(result) {
    const judgement =
      result && typeof result === 'object' ? /** @type {any} */ (result).judgement : undefined;
    switch (judgement) {
      case 'perfect':
        this.fillPerfect(result);
        break;
      case 'good':
        this.fillGood(result);
        break;
      case 'barely':
        this.fillBarely(result);
        break;
      case 'miss':
      case 'wrong':
        this.fillMiss(result);
        break;
      default:
        break;
    }
  }

  /**
   * A hold expectation closed unmatched.
   * @param {Expectation|Object} expectation - The missed Expectation.
   * @returns {void}
   */
  onMiss(expectation) {
    this.fillMiss(expectation);
  }

  // ==========================================================================
  // Presentation helpers (all null/headless safe)
  // ==========================================================================

  /**
   * Set the continuous fill state and reflect it on the fill bar. Clamped to
   * `[0, 1]`; applied via displayWidth/width or scaleX when the object exposes
   * them, so the same code drives real Phaser objects and headless stubs.
   * @param {number} fraction - Target fill fraction.
   * @returns {void}
   * @private
   */
  _applyFill(fraction) {
    this.fillFraction = clamp(fraction, 0, 1);

    const bar = /** @type {any} */ (this.fillBar);
    if (!bar) {
      return;
    }

    const targetWidth = this._meterWidth * this.fillFraction;
    if (typeof bar.setDisplaySize === 'function' && typeof bar.height === 'number') {
      bar.setDisplaySize(targetWidth, bar.height);
    } else if (this._meterWidth > 0 && typeof bar.setScale === 'function') {
      bar.setScale(this.fillFraction, 1);
    }
    // Mirror the value onto plain properties for inspection/headless stubs.
    if (this._meterWidth > 0) {
      bar.displayWidth = targetWidth;
    }
    bar.scaleX = this.fillFraction;
  }

  /**
   * Show the judgement popup for a category, replacing any previous popup.
   * @param {'perfect'|'good'|'barely'|'miss'} category - Judgement category.
   * @returns {void}
   * @private
   */
  _showPopup(category) {
    const key = FILL_BOT_ASSETS.popups[category];
    if (!key) {
      return;
    }

    const previous = /** @type {any} */ (this.popup);
    if (previous && typeof previous.destroy === 'function') {
      previous.destroy();
    }
    this.popup = null;

    const image = this._addImage(this._sceneWidth() * 0.5, this._sceneHeight() * 0.3, key);
    if (!image) {
      return;
    }
    this.popup = image;
    this._fadeOutAndDestroy(image);
  }

  /**
   * Create + own a sprite when the scene exposes a sprite factory.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {string} texture - Atlas/texture cache key.
   * @returns {Object|null} The created sprite, or null when headless.
   * @private
   */
  _addSprite(x, y, texture) {
    const add = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).add;
    if (!add || typeof add.sprite !== 'function') {
      return null;
    }
    // Register this atlas's rhythm poses (idle/cheer/hey) once, so _play can
    // drive real animations; stamp the atlas key for pose resolution.
    registerRhythmCharacterAnims(this.scene, texture);
    const sprite = /** @type {any} */ (this.own(add.sprite(x, y, texture)));
    if (sprite && typeof sprite === 'object') {
      sprite.__rhythmAtlas = texture;
    }
    return sprite;
  }

  /**
   * Create + own an image when the scene exposes an image factory.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {string} texture - Texture cache key.
   * @returns {Object|null} The created image, or null when headless.
   * @private
   */
  _addImage(x, y, texture) {
    const add = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).add;
    if (!add || typeof add.image !== 'function') {
      return null;
    }
    return this.own(add.image(x, y, texture));
  }

  /**
   * Create + own a rectangle when the scene exposes a rectangle factory.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} width - Rectangle width.
   * @param {number} height - Rectangle height.
   * @param {number} color - Fill color (0xRRGGBB).
   * @returns {Object|null} The created rectangle, or null when headless.
   * @private
   */
  _addRect(x, y, width, height, color) {
    const add = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).add;
    if (!add || typeof add.rectangle !== 'function') {
      return null;
    }
    return this.own(add.rectangle(x, y, width, height, color));
  }

  /**
   * Anchor a game object to its left edge (origin x = 0) when it supports it, so
   * width/scale changes grow rightward. No-op when unsupported.
   * @param {Object|null} object - The target object.
   * @returns {void}
   * @private
   */
  _setOriginLeft(object) {
    const target = /** @type {any} */ (object);
    if (target && typeof target.setOrigin === 'function') {
      target.setOrigin(0, 0.5);
    }
  }

  /**
   * Play a named rhythm pose (`idle`/`cheer`/`hey`) on a sprite. Resolves the
   * atlas-namespaced animation registered by {@link registerRhythmCharacterAnims}
   * from the sprite's stamped atlas key, and settles momentary poses back to
   * `idle` when they finish. No-op when the sprite is null, cannot play, or the
   * resolved animation is not registered (headless/test-safe).
   * @param {Object|null} sprite - The target sprite.
   * @param {string} pose - The logical pose name (`idle`/`cheer`/`hey`).
   * @returns {void}
   * @private
   */
  _play(sprite, pose) {
    const target = /** @type {any} */ (sprite);
    if (!target || typeof target.play !== 'function') {
      return;
    }
    const anims = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).anims;
    const atlasKey = target.__rhythmAtlas;
    const key = atlasKey ? rhythmAnimKey(atlasKey, pose) : pose;
    if (anims && typeof anims.exists === 'function' && !anims.exists(key)) {
      return;
    }
    target.play(key, true);

    // Momentary reaction poses (anything but idle) settle back to idle when the
    // one-shot animation finishes, so characters don't freeze on a react frame.
    if (atlasKey && pose !== 'idle' && typeof target.once === 'function') {
      const idleKey = rhythmAnimKey(atlasKey, 'idle');
      if (!anims || typeof anims.exists !== 'function' || anims.exists(idleKey)) {
        target.once('animationcomplete', () => {
          if (typeof target.play === 'function') {
            target.play(idleKey, true);
          }
        });
      }
    }
  }

  /**
   * Tween a popup image to fade out then destroy it, releasing our reference.
   * Falls back to leaving the image in place when no tween factory is available.
   * @param {Object} image - The popup image.
   * @returns {void}
   * @private
   */
  _fadeOutAndDestroy(image) {
    const tweens = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).tweens;
    if (!tweens || typeof tweens.add !== 'function') {
      return;
    }
    const target = /** @type {any} */ (image);
    tweens.add({
      targets: target,
      alpha: 0,
      duration: 350,
      onComplete: () => {
        if (target && typeof target.destroy === 'function') {
          target.destroy();
        }
        if (this.popup === image) {
          this.popup = null;
        }
      }
    });
  }

  /**
   * Release owned objects and null the character/meter/popup references (R16.4).
   * @returns {void}
   */
  destroy() {
    super.destroy();
    this.bot = null;
    this.player = null;
    this.meter = null;
    this.fillBar = null;
    this.popup = null;
  }
}

export default FillBotGame;
export { FillBotGame, FILL_BOT_ASSETS, POSES, DEFAULT_TARGET_SPAN_MS };

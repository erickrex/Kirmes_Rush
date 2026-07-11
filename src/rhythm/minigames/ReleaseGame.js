/**
 * @fileoverview ReleaseGame - the Release (release-on-beat) Minigame_Controller.
 *
 * A concrete {@link RhythmMinigame} for the `release-cue` Minigame_Definition
 * (`assets/data/rhythm/minigames/release-cue.json`). Like every controller it
 * owns only *presentation* and *gesture meaning*: the framework
 * (RhythmClock/CueScheduler/CueJudger/RhythmScoring) owns timing and judgement
 * and routes due cues/judgements here through Cue_Action_Dispatch (see
 * {@link import('./MinigameRegistry.js').dispatchCueAction}).
 *
 * Presentation: **hold-then-release-on-beat**. While the pointer is held the
 * Touch_Gesture_Recognizer emits `holdStart` then a stream of `holdTick`
 * Gestures carrying the elapsed hold `durationMs`; the controller builds a
 * continuous **charge** state from that duration so the player sees the charge
 * grow while holding. A `chargeCue` presentation cue highlights the
 * release-on-beat moment the player should aim for. When the player lifts the
 * pointer the framework judges the release Song_Position against the target beat
 * and routes the result to one of the feedback methods below (R3.5).
 *
 * Cue_Action_Dispatch targets required by release-cue.json:
 *  - cue action `chargeCue` — present the upcoming release-on-beat moment and
 *    prime the charge state for a fresh hold;
 *  - feedback `releasePerfect` / `releaseGood` / `releaseBarely` / `releaseMiss`
 *    — the player reacts and a judgement popup is shown when the release
 *    Expectation resolves (R3.5).
 *
 * All objects created in {@link ReleaseGame#create} are tracked via
 * {@link RhythmMinigame#own} so {@link RhythmMinigame#destroy} releases them on
 * scene teardown (R16.4). Uses only committed assets declared by the definition
 * (BF/daddyDearest Sparrow atlases and the rhythm judgement popup images).
 * Requirements 3.1, 3.5.
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
 * Default cache keys for the committed assets the release-cue definition
 * declares. Kept in sync with `assets/data/rhythm/minigames/release-cue.json`.
 * @type {{ coachAtlas: string, playerAtlas: string, popups: Record<string, string> }}
 */
const RELEASE_ASSETS = {
  coachAtlas: 'dad',
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
 * @type {{ coachCue: string, playerHold: string, playerRelease: string, idle: string }}
 */
const POSES = {
  coachCue: 'cheer',
  playerHold: 'hey',
  playerRelease: 'hey',
  idle: 'idle'
};

/**
 * Fallback charge span (ms) used to map the elapsed hold duration to a charge
 * fraction when no active Expectation has supplied its `targetSpanMs`. The
 * framework normally reports the span via {@link ReleaseGame#onHoldTick}; this
 * keeps the charge visual sensible in isolation.
 * @type {number}
 */
const DEFAULT_CHARGE_SPAN_MS = 2000;

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
 * The Release Minigame_Controller: a charge bar that builds while the player
 * holds, plus a release-on-beat cue marker, committed BF/daddyDearest atlases
 * and a judgement popup. Declares presentation + gesture meaning only.
 */
class ReleaseGame extends RhythmMinigame {
  /**
   * @param {Object} scene - The owning RhythmScene (or a mock in tests).
   * @param {RhythmSession} [session] - The per-run session value object.
   */
  constructor(scene, session) {
    super(scene, /** @type {any} */ (session));

    /**
     * The "coach" sprite (daddyDearest) that cues the release-on-beat moment.
     * @type {Object|null}
     */
    this.coach = null;

    /**
     * The player's sprite (BOYFRIEND) that reacts while charging and on release.
     * @type {Object|null}
     */
    this.player = null;

    /**
     * The charge meter background frame.
     * @type {Object|null}
     */
    this.meter = null;

    /**
     * The charge bar whose extent tracks {@link ReleaseGame#chargeFraction}.
     * @type {Object|null}
     */
    this.chargeBar = null;

    /**
     * The release-on-beat cue marker, pulsed by {@link ReleaseGame#chargeCue}.
     * @type {Object|null}
     */
    this.releaseMarker = null;

    /**
     * The currently displayed judgement popup image, if any.
     * @type {Object|null}
     */
    this.popup = null;

    /**
     * Continuous charge state in `[0, 1]` derived from the reported hold
     * duration. Grows while a hold is in progress; reset on a fresh cue/release.
     * @type {number}
     */
    this.chargeFraction = 0;

    /**
     * Whether a hold (charge) is currently in progress.
     * @type {boolean}
     */
    this.charging = false;

    /**
     * Target charge span (ms) used to map elapsed hold duration to the charge
     * fraction. Updated whenever an Expectation reports its `targetSpanMs`.
     * @type {number}
     */
    this.targetSpanMs = DEFAULT_CHARGE_SPAN_MS;

    /**
     * Full pixel width of the charge bar at fraction `1`, captured at create()
     * so the charge can be applied via width when the object supports it.
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

    this.coach = this._addSprite(width * 0.5, height * 0.36, RELEASE_ASSETS.coachAtlas);
    this.player = this._addSprite(width * 0.5, height * 0.6, RELEASE_ASSETS.playerAtlas);
    this.fitSpriteToHeight(this.coach, 0.22);
    this.fitSpriteToHeight(this.player, 0.24);
    this._play(this.coach, POSES.idle);
    this._play(this.player, POSES.idle);

    // Charge meter: a background frame plus a charge bar anchored to its left
    // edge so scaling/width reflects the charge fraction left-to-right.
    this._meterWidth = width * 0.7;
    const meterX = width * 0.5;
    const meterY = height * 0.82;
    const meterHeight = height * 0.04;

    this.meter = this._addRect(meterX, meterY, this._meterWidth, meterHeight, 0x222222);

    const fillX = meterX - this._meterWidth / 2;
    this.chargeBar = this._addRect(fillX, meterY, this._meterWidth, meterHeight, 0xffaa33);
    this._setOriginLeft(this.chargeBar);

    // Release-on-beat marker sits at the top of the charge bar's travel.
    this.releaseMarker = this._addRect(
      meterX + this._meterWidth / 2,
      meterY,
      Math.max(4, width * 0.01),
      meterHeight * 1.6,
      0xffffff
    );

    this.charging = false;
    this.chargeFraction = 0;
    this._applyCharge(0);

    this.initHud();
  }

  /**
   * @override
   * @returns {string} The release-cue instruction line.
   */
  getInstruction() {
    return 'Hold to charge, then RELEASE right on the beat!';
  }

  // ==========================================================================
  // Gesture meaning — charge while holding, then release on beat (R3.1)
  // ==========================================================================

  /**
   * Begin charging when the player starts a hold. Resets the charge to empty and
   * marks the hold in progress so the charge visual grows from zero.
   * @param {Gesture|Object} [_gesture] - The holdStart Gesture.
   * @returns {void}
   */
  onHoldStart(_gesture) {
    this.charging = true;
    this._applyCharge(0);
    this._play(this.player, POSES.playerHold);
  }

  /**
   * Receive holdTick progress and build the charge bar. Maps the Gesture's
   * elapsed hold `durationMs` against the active Expectation's `targetSpanMs`
   * to a charge fraction in `[0, 1]`, then updates the continuous visual state.
   * The reported duration only increases across a hold, so the charge is
   * monotonic.
   * @param {Gesture|Object} gesture - The holdTick Gesture carrying `durationMs`.
   * @param {Expectation|Object} [expectation] - The active release Expectation;
   *   when it supplies `targetSpanMs` that becomes the new mapping span.
   * @returns {number} The resulting charge fraction in `[0, 1]`.
   */
  onHoldTick(gesture, expectation) {
    this.charging = true;

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
    const span = this.targetSpanMs > 0 ? this.targetSpanMs : DEFAULT_CHARGE_SPAN_MS;
    const fraction = clamp(durationMs / span, 0, 1);

    this._applyCharge(fraction);
    this._play(this.player, POSES.playerHold);
    return fraction;
  }

  /**
   * Per-frame update hook. The charge is event-driven via
   * {@link ReleaseGame#onHoldTick}; this keeps the shared tempo beat indicator
   * pulsing.
   * @param {number} _time - Current time (ms).
   * @param {number} _delta - Elapsed time since the last frame (ms).
   * @param {Object} [ctx] - Optional per-frame context carrying `songBeat`.
   * @returns {void}
   */
  update(_time, _delta, ctx) {
    this.updateBeatIndicator(ctx);
  }

  // ==========================================================================
  // Cue_Action_Dispatch targets (named by release-cue.json)
  // ==========================================================================

  /**
   * Cue action `chargeCue`: present the upcoming release-on-beat moment by
   * pulsing the release marker and priming the charge state for a fresh hold
   * (reset to empty) so the player has a clean bar to charge (R3.1).
   * @param {ResolvedCue|Object} [_cue] - The resolved presentation cue.
   * @returns {void}
   */
  chargeCue(_cue) {
    this.targetSpanMs = DEFAULT_CHARGE_SPAN_MS;
    this.charging = false;
    this._applyCharge(0);
    this._pulseMarker();
    this._play(this.coach, POSES.coachCue);
    this.flashCue('HOLD, THEN RELEASE!');
  }

  /**
   * Feedback `releasePerfect`: the release landed on the target beat (R3.5).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  releasePerfect(_result) {
    this.charging = false;
    this._applyCharge(1);
    this._play(this.player, POSES.playerRelease);
    this._showPopup('perfect');
  }

  /**
   * Feedback `releaseGood`: the release landed a `good` offset (R3.5).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  releaseGood(_result) {
    this.charging = false;
    this._play(this.player, POSES.playerRelease);
    this._showPopup('good');
  }

  /**
   * Feedback `releaseBarely`: the release landed a `barely` offset (R3.5).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  releaseBarely(_result) {
    this.charging = false;
    this._play(this.player, POSES.playerRelease);
    this._showPopup('barely');
  }

  /**
   * Feedback `releaseMiss`: the release Expectation resolved as a miss (R3.5).
   * @param {Expectation|JudgementResult|Object} [_info] - The missed outcome.
   * @returns {void}
   */
  releaseMiss(_info) {
    this.charging = false;
    this._applyCharge(0);
    this._play(this.player, POSES.idle);
    this._showPopup('miss');
  }

  // ==========================================================================
  // Base overrides — sensible defaults routed to the named handlers above
  // ==========================================================================

  /**
   * Presentation cue fallback: any cue that does not name a more specific
   * controller method presents the release-on-beat moment.
   * @param {ResolvedCue|Object} event - The resolved presentation cue.
   * @returns {void}
   */
  onCue(event) {
    this.chargeCue(event);
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
        this.releasePerfect(result);
        break;
      case 'good':
        this.releaseGood(result);
        break;
      case 'barely':
        this.releaseBarely(result);
        break;
      case 'miss':
      case 'wrong':
        this.releaseMiss(result);
        break;
      default:
        break;
    }
  }

  /**
   * A release expectation closed unmatched.
   * @param {Expectation|Object} expectation - The missed Expectation.
   * @returns {void}
   */
  onMiss(expectation) {
    this.releaseMiss(expectation);
  }

  // ==========================================================================
  // Presentation helpers (all null/headless safe)
  // ==========================================================================

  /**
   * Set the continuous charge state and reflect it on the charge bar. Clamped to
   * `[0, 1]`; applied via displayWidth/setDisplaySize or scaleX when the object
   * exposes them, so the same code drives real Phaser objects and headless stubs.
   * @param {number} fraction - Target charge fraction.
   * @returns {void}
   * @private
   */
  _applyCharge(fraction) {
    this.chargeFraction = clamp(fraction, 0, 1);

    const bar = /** @type {any} */ (this.chargeBar);
    if (!bar) {
      return;
    }

    const targetWidth = this._meterWidth * this.chargeFraction;
    if (typeof bar.setDisplaySize === 'function' && typeof bar.height === 'number') {
      bar.setDisplaySize(targetWidth, bar.height);
    } else if (this._meterWidth > 0 && typeof bar.setScale === 'function') {
      bar.setScale(this.chargeFraction, 1);
    }
    // Mirror the value onto plain properties for inspection/headless stubs.
    if (this._meterWidth > 0) {
      bar.displayWidth = targetWidth;
    }
    bar.scaleX = this.chargeFraction;
  }

  /**
   * Pulse the release-on-beat marker to draw attention to the moment the player
   * should release. Falls back to a no-op when no tween factory is available.
   * @returns {void}
   * @private
   */
  _pulseMarker() {
    const marker = /** @type {any} */ (this.releaseMarker);
    if (!marker) {
      return;
    }
    const tweens = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).tweens;
    if (!tweens || typeof tweens.add !== 'function') {
      return;
    }
    tweens.add({
      targets: marker,
      alpha: { from: 1, to: 0.3 },
      yoyo: true,
      duration: 150
    });
  }

  /**
   * Show the judgement popup for a category, replacing any previous popup.
   * @param {'perfect'|'good'|'barely'|'miss'} category - Judgement category.
   * @returns {void}
   * @private
   */
  _showPopup(category) {
    const key = RELEASE_ASSETS.popups[category];
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
   * Release owned objects and null the character/meter/marker/popup references
   * (R16.4).
   * @returns {void}
   */
  destroy() {
    super.destroy();
    this.coach = null;
    this.player = null;
    this.meter = null;
    this.chargeBar = null;
    this.releaseMarker = null;
    this.popup = null;
  }
}

export default ReleaseGame;
export { ReleaseGame, RELEASE_ASSETS, POSES, DEFAULT_CHARGE_SPAN_MS };

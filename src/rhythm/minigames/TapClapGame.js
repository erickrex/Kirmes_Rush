/**
 * @fileoverview TapClapGame - the Tap (tap-on-beat) Minigame_Controller.
 *
 * A concrete {@link RhythmMinigame} for the `tap-clap` Minigame_Definition
 * (`assets/data/rhythm/minigames/tap-clap.json`). It owns only *presentation*
 * and *gesture meaning*: the framework (RhythmClock/CueScheduler/CueJudger/
 * RhythmScoring) owns timing and judgement, and routes due cues/judgements here
 * through Cue_Action_Dispatch (see {@link import('./MinigameRegistry.js').dispatchCueAction}).
 *
 * Presentation: two committed Sparrow-atlas characters — a "leader" (GF_assets)
 * that claps to cue the player, and the player's "clapper" (BOYFRIEND) that
 * reacts to each Judgement — plus a judgement popup image. All objects created
 * in {@link TapClapGame#create} are tracked via {@link RhythmMinigame#own} so
 * {@link RhythmMinigame#destroy} releases them on scene teardown (R16.4).
 *
 * Cue_Action_Dispatch targets required by tap-clap.json:
 *  - cue action `leaderClap` — the leader claps to cue the upcoming beat;
 *  - feedback `clapPerfect` / `clapGood` / `clapBarely` / `clapMiss` — the player
 *    reacts and a judgement popup is shown.
 *
 * Uses only committed assets (R13.3): BF/GF Sparrow atlases and the rhythm
 * judgement popup images declared by the definition. Requirements 1.1, 1.2,
 * 1.4, 13.3.
 */

import RhythmMinigame from './RhythmMinigame.js';
import { registerRhythmCharacterAnims, rhythmAnimKey } from './RhythmCharacterAnimations.js';

/**
 * @typedef {import('../core/RhythmSession.js').default} RhythmSession
 * @typedef {import('../../types.js').ResolvedCue} ResolvedCue
 * @typedef {import('../../types.js').JudgementResult} JudgementResult
 * @typedef {import('../../types.js').Expectation} Expectation
 */

/**
 * Default cache keys for the committed assets the tap-clap definition declares.
 * Kept in sync with `assets/data/rhythm/minigames/tap-clap.json`.
 * @type {{ leaderAtlas: string, clapperAtlas: string, popups: Record<string, string> }}
 */
const TAP_CLAP_ASSETS = {
  leaderAtlas: 'gf',
  clapperAtlas: 'bf',
  popups: {
    perfect: 'popup-sick',
    good: 'popup-good',
    barely: 'popup-bad',
    miss: 'popup-shit'
  }
};

/**
 * Atlas frame prefixes for the poses this controller drives. Sparrow atlas
 * animations are registered by name elsewhere; the controller only requests
 * them, so a missing pose degrades gracefully to a no-op (headless/test-safe).
 * @type {{ leaderClap: string, clapperClap: string, idle: string }}
 */
const POSES = {
  leaderClap: 'cheer',
  clapperClap: 'hey',
  idle: 'idle'
};

/**
 * The Tap Minigame_Controller: clap poses via committed BF/GF atlases plus a
 * judgement popup. Declares presentation + gesture meaning only.
 */
class TapClapGame extends RhythmMinigame {
  /**
   * @param {Object} scene - The owning RhythmScene (or a mock in tests).
   * @param {RhythmSession} [session] - The per-run session value object.
   */
  constructor(scene, session) {
    super(scene, /** @type {any} */ (session));

    /**
     * The leader sprite (GF_assets) that claps to cue the player.
     * @type {Object|null}
     */
    this.leader = null;

    /**
     * The player's clapper sprite (BOYFRIEND) that reacts to judgements.
     * @type {Object|null}
     */
    this.clapper = null;

    /**
     * The currently displayed judgement popup image, if any.
     * @type {Object|null}
     */
    this.popup = null;
  }

  /**
   * Build the controller's scene objects and register them for teardown.
   * Safe to call in a headless test: when the scene has no game-object factory
   * the sprites are simply left null and every method becomes a no-op.
   * @returns {void}
   */
  create() {
    const width = this._sceneWidth();
    const height = this._sceneHeight();

    this.leader = this._addSprite(width * 0.35, height * 0.6, TAP_CLAP_ASSETS.leaderAtlas);
    this.clapper = this._addSprite(width * 0.65, height * 0.6, TAP_CLAP_ASSETS.clapperAtlas);

    this._play(this.leader, POSES.idle);
    this._play(this.clapper, POSES.idle);
  }

  // ==========================================================================
  // Cue_Action_Dispatch targets (named by tap-clap.json)
  // ==========================================================================

  /**
   * Cue action `leaderClap`: the leader claps to cue the upcoming beat so the
   * player knows when to tap. Dispatched from a `cue` timeline entry (R1.2).
   * @param {ResolvedCue|Object} [_cue] - The resolved presentation cue.
   * @returns {void}
   */
  leaderClap(_cue) {
    this._play(this.leader, POSES.leaderClap);
  }

  /**
   * Feedback `clapPerfect`: player landed a `perfect` tap. Player claps and the
   * "perfect" popup is shown (R1.4).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  clapPerfect(_result) {
    this._play(this.clapper, POSES.clapperClap);
    this._showPopup('perfect');
  }

  /**
   * Feedback `clapGood`: player landed a `good` tap (R1.4).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  clapGood(_result) {
    this._play(this.clapper, POSES.clapperClap);
    this._showPopup('good');
  }

  /**
   * Feedback `clapBarely`: player landed a `barely` tap (R1.4).
   * @param {JudgementResult|Object} [_result] - The judged outcome.
   * @returns {void}
   */
  clapBarely(_result) {
    this._play(this.clapper, POSES.clapperClap);
    this._showPopup('barely');
  }

  /**
   * Feedback `clapMiss`: player missed the tap expectation (R1.4).
   * @param {Expectation|JudgementResult|Object} [_info] - The missed expectation/outcome.
   * @returns {void}
   */
  clapMiss(_info) {
    this._play(this.clapper, POSES.idle);
    this._showPopup('miss');
  }

  // ==========================================================================
  // Base overrides — sensible defaults routed to the named handlers above
  // ==========================================================================

  /**
   * Presentation cue fallback: any cue that does not name a more specific
   * controller method is treated as a leader clap.
   * @param {ResolvedCue|Object} event - The resolved presentation cue.
   * @returns {void}
   */
  onCue(event) {
    this.leaderClap(event);
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
        this.clapPerfect(result);
        break;
      case 'good':
        this.clapGood(result);
        break;
      case 'barely':
        this.clapBarely(result);
        break;
      case 'miss':
      case 'wrong':
        this.clapMiss(result);
        break;
      default:
        break;
    }
  }

  /**
   * A tap expectation closed unmatched.
   * @param {Expectation|Object} expectation - The missed Expectation.
   * @returns {void}
   */
  onMiss(expectation) {
    this.clapMiss(expectation);
  }

  // ==========================================================================
  // Presentation helpers (all null/headless safe)
  // ==========================================================================

  /**
   * Show the judgement popup for a category, replacing any previous popup.
   * @param {'perfect'|'good'|'barely'|'miss'} category - Judgement category.
   * @returns {void}
   * @private
   */
  _showPopup(category) {
    const key = TAP_CLAP_ASSETS.popups[category];
    if (!key) {
      return;
    }

    // Release the previous popup before showing a new one.
    const previous = /** @type {any} */ (this.popup);
    if (previous && typeof previous.destroy === 'function') {
      previous.destroy();
    }
    this.popup = null;

    const image = this._addImage(this._sceneWidth() * 0.5, this._sceneHeight() * 0.35, key);
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
   * Falls back to an immediate destroy when no tween factory is available.
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
   * Best-effort scene width, defaulting to a portrait canvas width.
   * @returns {number} Width in pixels.
   * @private
   */
  _sceneWidth() {
    const scale = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).scale;
    const w = scale && typeof scale.width === 'number' ? scale.width : undefined;
    return typeof w === 'number' ? w : 720;
  }

  /**
   * Best-effort scene height, defaulting to a portrait canvas height.
   * @returns {number} Height in pixels.
   * @private
   */
  _sceneHeight() {
    const scale = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).scale;
    const h = scale && typeof scale.height === 'number' ? scale.height : undefined;
    return typeof h === 'number' ? h : 1280;
  }

  /**
   * Release owned objects and null the character/popup references (R16.4).
   * @returns {void}
   */
  destroy() {
    super.destroy();
    this.leader = null;
    this.clapper = null;
    this.popup = null;
  }
}

export default TapClapGame;
export { TapClapGame, TAP_CLAP_ASSETS, POSES };

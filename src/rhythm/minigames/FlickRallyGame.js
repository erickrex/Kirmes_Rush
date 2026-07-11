/**
 * @fileoverview FlickRallyGame - the Flick (directional-flick) Minigame_Controller.
 *
 * A concrete {@link RhythmMinigame} for the `flick-rally` Minigame_Definition
 * (`assets/data/rhythm/minigames/flick-rally.json`). Like every controller it
 * owns only *presentation* and *gesture meaning*: the framework
 * (RhythmClock/CueScheduler/CueJudger/RhythmScoring) owns timing and judgement
 * and routes due cues/judgements here through Cue_Action_Dispatch (see
 * {@link import('./MinigameRegistry.js').dispatchCueAction}).
 *
 * Presentation: a **rally**. A moving object (the ball) travels toward the
 * player; a well-timed directional flick returns it by sending the ball off in
 * the flick direction (R4.1). The definition's `input.flickDirections` names the
 * accepted directions (`["up"]` for flick-rally); the framework judges the flick
 * timing + direction and routes the outcome to one of the feedback methods
 * below, which move the ball in the resolved flick direction (R4.5).
 *
 * Cue_Action_Dispatch targets required by flick-rally.json:
 *  - cue action `serveCue` — serve the ball toward the player (present the
 *    incoming moving object the player must return);
 *  - feedback `flickPerfect` / `flickGood` / `flickBarely` / `flickMiss` — the
 *    player reacts and, on a successful flick, the ball is returned in the flick
 *    direction; on a miss the ball is not returned and the miss popup is shown
 *    (R4.5).
 *
 * All objects created in {@link FlickRallyGame#create} are tracked via
 * {@link RhythmMinigame#own} so {@link RhythmMinigame#destroy} releases them on
 * scene teardown (R16.4). Uses only committed assets declared by the definition
 * (BF/GF Sparrow atlases and the rhythm judgement popup images).
 * Requirements 4.1, 4.5.
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
 * Default cache keys for the committed assets the flick-rally definition
 * declares. Kept in sync with `assets/data/rhythm/minigames/flick-rally.json`.
 * @type {{ serverAtlas: string, playerAtlas: string, popups: Record<string, string> }}
 */
const FLICK_RALLY_ASSETS = {
  serverAtlas: 'gf',
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
 * @type {{ serverServe: string, playerFlick: string, idle: string }}
 */
const POSES = {
  serverServe: 'cheer',
  playerFlick: 'hey',
  idle: 'idle'
};

/**
 * The default flick direction the ball is returned in when a feedback event
 * carries no explicit direction. Matches flick-rally.json `flickDirections`.
 * @type {string}
 */
const DEFAULT_FLICK_DIRECTION = 'up';

/**
 * Unit vectors for each supported flick direction, in screen space (y grows
 * downward). Used to send the returned ball off in the flick direction.
 * @type {Record<string, { x: number, y: number }>}
 */
const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

/**
 * The Flick Minigame_Controller: a served ball travels toward the player and a
 * directional flick returns it. Declares presentation + gesture meaning only.
 */
class FlickRallyGame extends RhythmMinigame {
  /**
   * @param {Object} scene - The owning RhythmScene (or a mock in tests).
   * @param {RhythmSession} [session] - The per-run session value object.
   */
  constructor(scene, session) {
    super(scene, /** @type {any} */ (session));

    /**
     * The "server" sprite (GF_assets) that serves the ball to the player.
     * @type {Object|null}
     */
    this.server = null;

    /**
     * The player's sprite (BOYFRIEND) that flicks the ball back.
     * @type {Object|null}
     */
    this.player = null;

    /**
     * The moving object (ball) that travels between server and player.
     * @type {Object|null}
     */
    this.ball = null;

    /**
     * The currently displayed judgement popup image, if any.
     * @type {Object|null}
     */
    this.popup = null;

    /**
     * Whether the ball has been served (is in play, travelling toward player).
     * @type {boolean}
     */
    this.ballServed = false;

    /**
     * Whether the current serve has been returned by a successful flick.
     * @type {boolean}
     */
    this.ballReturned = false;

    /**
     * The direction the ball was last returned in, or null when not returned.
     * @type {string|null}
     */
    this.ballDirection = null;

    /**
     * Logical ball X position, mirrored onto the ball object when present so the
     * state is inspectable headlessly.
     * @type {number}
     */
    this.ballX = 0;

    /**
     * Logical ball Y position, mirrored onto the ball object when present.
     * @type {number}
     */
    this.ballY = 0;

    /**
     * The default direction the ball is returned in when a feedback event
     * carries no explicit direction. Derived from the session definition's
     * `input.flickDirections` when available.
     * @type {string}
     */
    this.defaultDirection = DEFAULT_FLICK_DIRECTION;

    /**
     * The ball's rest/serve position (near the server), captured at create().
     * @type {{ x: number, y: number }}
     * @private
     */
    this._serveOrigin = { x: 0, y: 0 };

    /**
     * The ball's incoming target position (near the player), captured at create().
     * @type {{ x: number, y: number }}
     * @private
     */
    this._playerTarget = { x: 0, y: 0 };

    /**
     * Distance (px) the returned ball travels off in the flick direction.
     * @type {number}
     * @private
     */
    this._returnDistance = 0;
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

    this.defaultDirection = this._resolveDefaultDirection();

    this.server = this._addSprite(width * 0.5, height * 0.26, FLICK_RALLY_ASSETS.serverAtlas);
    this.player = this._addSprite(width * 0.5, height * 0.74, FLICK_RALLY_ASSETS.playerAtlas);
    this.fitSpriteToHeight(this.server, 0.2);
    this.fitSpriteToHeight(this.player, 0.22);
    this._play(this.server, POSES.idle);
    this._play(this.player, POSES.idle);

    this._serveOrigin = { x: width * 0.5, y: height * 0.36 };
    this._playerTarget = { x: width * 0.5, y: height * 0.64 };
    this._returnDistance = height * 0.5;

    const ballSize = Math.max(16, width * 0.06);
    this.ball = this._addRect(
      this._serveOrigin.x,
      this._serveOrigin.y,
      ballSize,
      ballSize,
      0xffee66
    );

    this.ballServed = false;
    this.ballReturned = false;
    this.ballDirection = null;
    this._moveBall(this._serveOrigin.x, this._serveOrigin.y);

    this.initHud();
  }

  /**
   * @override
   * @returns {string} The flick-rally instruction line.
   */
  getInstruction() {
    return 'Flick UP to smash the ball back on the beat!';
  }

  // ==========================================================================
  // Cue_Action_Dispatch targets (named by flick-rally.json)
  // ==========================================================================

  /**
   * Cue action `serveCue`: serve the ball toward the player. Presents the
   * incoming moving object the player must return with a flick, resetting the
   * rally state so the current serve is unreturned (R4.1).
   * @param {ResolvedCue|Object} [_cue] - The resolved presentation cue.
   * @returns {void}
   */
  serveCue(_cue) {
    this.ballServed = true;
    this.ballReturned = false;
    this.ballDirection = null;
    this._play(this.server, POSES.serverServe);
    this._travelBall(this._playerTarget.x, this._playerTarget.y);
    this.flashCue('FLICK UP!');
  }

  /**
   * Feedback `flickPerfect`: a `perfect`-timed flick returned the ball (R4.5).
   * @param {JudgementResult|Object} [result] - The judged outcome (may carry a
   *   `direction` or `gesture.direction`).
   * @returns {void}
   */
  flickPerfect(result) {
    this._returnBall(this._flickDirection(result));
    this._showPopup('perfect');
  }

  /**
   * Feedback `flickGood`: a `good`-timed flick returned the ball (R4.5).
   * @param {JudgementResult|Object} [result] - The judged outcome.
   * @returns {void}
   */
  flickGood(result) {
    this._returnBall(this._flickDirection(result));
    this._showPopup('good');
  }

  /**
   * Feedback `flickBarely`: a `barely`-timed flick returned the ball (R4.5).
   * @param {JudgementResult|Object} [result] - The judged outcome.
   * @returns {void}
   */
  flickBarely(result) {
    this._returnBall(this._flickDirection(result));
    this._showPopup('barely');
  }

  /**
   * Feedback `flickMiss`: the flick Expectation resolved as a miss — the ball is
   * not returned and the miss popup is shown (R4.5).
   * @param {Expectation|JudgementResult|Object} [_info] - The missed outcome.
   * @returns {void}
   */
  flickMiss(_info) {
    this.ballReturned = false;
    this.ballDirection = null;
    this._play(this.player, POSES.idle);
    this._showPopup('miss');
  }

  // ==========================================================================
  // Base overrides — sensible defaults routed to the named handlers above
  // ==========================================================================

  /**
   * Presentation cue fallback: any cue that does not name a more specific
   * controller method serves the ball.
   * @param {ResolvedCue|Object} event - The resolved presentation cue.
   * @returns {void}
   */
  onCue(event) {
    this.serveCue(event);
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
        this.flickPerfect(result);
        break;
      case 'good':
        this.flickGood(result);
        break;
      case 'barely':
        this.flickBarely(result);
        break;
      case 'miss':
      case 'wrong':
        this.flickMiss(result);
        break;
      default:
        break;
    }
  }

  /**
   * A flick expectation closed unmatched.
   * @param {Expectation|Object} expectation - The missed Expectation.
   * @returns {void}
   */
  onMiss(expectation) {
    this.flickMiss(expectation);
  }

  // ==========================================================================
  // Gesture meaning + presentation helpers (all null/headless safe)
  // ==========================================================================

  /**
   * Return the served ball by sending it off in the given flick direction and
   * playing the player's flick pose. Records the rally state so it is
   * inspectable headlessly (R4.1).
   * @param {string} direction - The resolved flick direction.
   * @returns {void}
   * @private
   */
  _returnBall(direction) {
    const vector = DIRECTION_VECTORS[direction] || DIRECTION_VECTORS[this.defaultDirection];
    this.ballReturned = true;
    this.ballDirection = direction;
    this._play(this.player, POSES.playerFlick);

    const targetX = this.ballX + vector.x * this._returnDistance;
    const targetY = this.ballY + vector.y * this._returnDistance;
    this._travelBall(targetX, targetY);
  }

  /**
   * Resolve the flick direction carried by a feedback event, falling back to the
   * controller's default direction.
   * @param {JudgementResult|Object} [info] - The event, possibly carrying a
   *   `direction` or nested `gesture.direction`.
   * @returns {string} The resolved direction.
   * @private
   */
  _flickDirection(info) {
    if (info && typeof info === 'object') {
      const direct = /** @type {any} */ (info).direction;
      if (typeof direct === 'string') {
        return direct;
      }
      const gesture = /** @type {any} */ (info).gesture;
      if (gesture && typeof gesture === 'object' && typeof gesture.direction === 'string') {
        return gesture.direction;
      }
    }
    return this.defaultDirection;
  }

  /**
   * Resolve the default flick direction from the session definition's
   * `input.flickDirections`, defaulting to {@link DEFAULT_FLICK_DIRECTION}.
   * @returns {string} The default direction.
   * @private
   */
  _resolveDefaultDirection() {
    const definition =
      /** @type {any} */ (this.session) && /** @type {any} */ (this.session).definition;
    const input = definition && definition.input;
    const directions = input && input.flickDirections;
    if (Array.isArray(directions) && directions.length > 0 && typeof directions[0] === 'string') {
      return directions[0];
    }
    return DEFAULT_FLICK_DIRECTION;
  }

  /**
   * Move the ball to a target position, animating with a tween when the scene
   * exposes one, and always mirroring the logical position immediately so the
   * state is inspectable headlessly.
   * @param {number} x - Target X.
   * @param {number} y - Target Y.
   * @returns {void}
   * @private
   */
  _travelBall(x, y) {
    const ball = /** @type {any} */ (this.ball);
    const tweens = /** @type {any} */ (this.scene) && /** @type {any} */ (this.scene).tweens;
    if (ball && tweens && typeof tweens.add === 'function') {
      tweens.add({ targets: ball, x, y, duration: 250 });
    }
    this._moveBall(x, y);
  }

  /**
   * Set the ball's logical position and mirror it onto the ball object.
   * @param {number} x - Target X.
   * @param {number} y - Target Y.
   * @returns {void}
   * @private
   */
  _moveBall(x, y) {
    this.ballX = x;
    this.ballY = y;
    const ball = /** @type {any} */ (this.ball);
    if (!ball) {
      return;
    }
    if (typeof ball.setPosition === 'function') {
      ball.setPosition(x, y);
    }
    ball.x = x;
    ball.y = y;
  }

  /**
   * Show the judgement popup for a category, replacing any previous popup.
   * @param {'perfect'|'good'|'barely'|'miss'} category - Judgement category.
   * @returns {void}
   * @private
   */
  _showPopup(category) {
    const key = FLICK_RALLY_ASSETS.popups[category];
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
   * Release owned objects and null the character/ball/popup references (R16.4).
   * @returns {void}
   */
  destroy() {
    super.destroy();
    this.server = null;
    this.player = null;
    this.ball = null;
    this.popup = null;
  }
}

export default FlickRallyGame;
export { FlickRallyGame, FLICK_RALLY_ASSETS, POSES, DEFAULT_FLICK_DIRECTION, DIRECTION_VECTORS };

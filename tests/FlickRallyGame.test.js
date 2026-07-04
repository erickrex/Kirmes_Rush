/**
 * @fileoverview Unit tests for FlickRallyGame — the Flick Minigame_Controller.
 *
 * Feature: rhythm-minigame-prototype (Task 12.4)
 *
 * Deterministic + headless: a stub scene provides `add.sprite`/`add.image`/
 * `add.rectangle`/`tweens.add`/`anims.exists` so no real Phaser is required.
 * The tests assert that create() builds owned objects (server, player, ball),
 * that serveCue serves the ball toward the player (R4.1), that each successful
 * flick feedback returns/moves the ball in the flick direction while flickMiss
 * leaves it unreturned (R4.5), that every Cue_Action_Dispatch target required by
 * flick-rally.json (serveCue / flickPerfect / flickGood / flickBarely /
 * flickMiss) is reachable via dispatchCueAction, and that destroy() releases
 * every owned object (R16.4).
 *
 * Requirements 4.1, 4.5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import FlickRallyGame, {
  FLICK_RALLY_ASSETS,
  DEFAULT_FLICK_DIRECTION
} from '../src/rhythm/minigames/FlickRallyGame.js';
import RhythmMinigame from '../src/rhythm/minigames/RhythmMinigame.js';
import { dispatchCueAction } from '../src/rhythm/minigames/MinigameRegistry.js';

/**
 * Create a deterministic stub game object that records destroy() calls.
 * @param {string} kind - 'sprite' | 'image' | 'rectangle'.
 * @param {Object} props - Initial props.
 * @returns {Object} The stub object.
 */
function createStubObject(kind, props) {
  return {
    kind,
    ...props,
    alpha: 1,
    destroyed: false,
    play: vi.fn(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn(function setPosition(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }),
    destroy: vi.fn(function destroy() {
      this.destroyed = true;
    })
  };
}

/**
 * Build a stub scene exposing the minimal factories FlickRallyGame uses. All
 * created objects are recorded so tests can assert ownership + teardown.
 * @param {{ animsExist?: boolean, runTweens?: boolean }} [opts] - Behavior flags.
 * @returns {Object} The stub scene plus a `created` array of produced objects.
 */
function createMockScene(opts = {}) {
  const { animsExist = true, runTweens = false } = opts;
  const created = [];
  const tweenCalls = [];

  return {
    created,
    tweenCalls,
    scale: { width: 720, height: 1280 },
    anims: {
      exists: vi.fn(() => animsExist)
    },
    add: {
      sprite: vi.fn((x, y, texture) => {
        const obj = createStubObject('sprite', { x, y, texture });
        created.push(obj);
        return obj;
      }),
      image: vi.fn((x, y, texture) => {
        const obj = createStubObject('image', { x, y, texture });
        created.push(obj);
        return obj;
      }),
      rectangle: vi.fn((x, y, width, height, color) => {
        const obj = createStubObject('rectangle', { x, y, width, height, color });
        created.push(obj);
        return obj;
      })
    },
    tweens: {
      add: vi.fn((config) => {
        tweenCalls.push(config);
        if (runTweens && typeof config.onComplete === 'function') {
          config.onComplete();
        }
        return { stop: vi.fn() };
      })
    }
  };
}

describe('FlickRallyGame', () => {
  let scene;
  let game;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = createMockScene();
    game = new FlickRallyGame(
      scene,
      /** @type {any} */ ({
        id: 'flick-rally',
        definition: { input: { flickDirections: ['up'] } }
      })
    );
  });

  it('is a RhythmMinigame subclass', () => {
    expect(game).toBeInstanceOf(RhythmMinigame);
  });

  describe('create()', () => {
    it('builds server/player sprites and the ball', () => {
      game.create();

      expect(scene.add.sprite).toHaveBeenCalledTimes(2);
      expect(scene.add.rectangle).toHaveBeenCalledTimes(1);
      expect(game.server).not.toBeNull();
      expect(game.player).not.toBeNull();
      expect(game.ball).not.toBeNull();
      expect(game.server.texture).toBe(FLICK_RALLY_ASSETS.serverAtlas);
      expect(game.player.texture).toBe(FLICK_RALLY_ASSETS.playerAtlas);
    });

    it('starts with the ball unserved and unreturned', () => {
      game.create();
      expect(game.ballServed).toBe(false);
      expect(game.ballReturned).toBe(false);
      expect(game.ballDirection).toBeNull();
    });

    it('resolves the default flick direction from the definition', () => {
      game.create();
      expect(game.defaultDirection).toBe('up');
    });

    it('owns every object it creates so they are released on teardown (R16.4)', () => {
      game.create();

      game.destroy();

      expect(scene.created).toHaveLength(3);
      for (const obj of scene.created) {
        expect(obj.destroy).toHaveBeenCalled();
        expect(obj.destroyed).toBe(true);
      }
    });

    it('does not throw and creates nothing when the scene is headless', () => {
      const headless = new FlickRallyGame({}, undefined);

      expect(() => headless.create()).not.toThrow();
      expect(headless.server).toBeNull();
      expect(headless.player).toBeNull();
      expect(headless.ball).toBeNull();
      expect(headless.defaultDirection).toBe(DEFAULT_FLICK_DIRECTION);
    });
  });

  describe('serveCue (R4.1)', () => {
    beforeEach(() => {
      game.create();
    });

    it('serves the ball toward the player and marks it in play', () => {
      const serveOriginY = game.ballY;
      game.serveCue({ id: 'serve-cue-1', action: 'serveCue' });

      expect(game.ballServed).toBe(true);
      expect(game.ballReturned).toBe(false);
      // The served ball travels toward the player (downward, y increases).
      expect(game.ballY).toBeGreaterThan(serveOriginY);
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('Cue_Action_Dispatch feedback targets (R4.5)', () => {
    beforeEach(() => {
      game.create();
      game.serveCue({ id: 'serve-cue-1' });
    });

    it('flickPerfect returns the ball upward and shows the sick popup', () => {
      const incomingY = game.ballY;
      game.flickPerfect({ judgement: 'perfect', direction: 'up' });

      expect(game.ballReturned).toBe(true);
      expect(game.ballDirection).toBe('up');
      // Returned in the "up" flick direction: y decreases.
      expect(game.ballY).toBeLessThan(incomingY);
      expect(game.popup.texture).toBe(FLICK_RALLY_ASSETS.popups.perfect);
    });

    it('flickGood returns the ball and shows the good popup', () => {
      game.flickGood({ judgement: 'good' });
      expect(game.ballReturned).toBe(true);
      expect(game.popup.texture).toBe(FLICK_RALLY_ASSETS.popups.good);
    });

    it('flickBarely returns the ball and shows the bad popup', () => {
      game.flickBarely({ judgement: 'barely' });
      expect(game.ballReturned).toBe(true);
      expect(game.popup.texture).toBe(FLICK_RALLY_ASSETS.popups.barely);
    });

    it('falls back to the default direction when none is supplied', () => {
      game.flickPerfect({ judgement: 'perfect' });
      expect(game.ballDirection).toBe(DEFAULT_FLICK_DIRECTION);
    });

    it('reads a nested gesture.direction when present', () => {
      game.flickGood({ judgement: 'good', gesture: { direction: 'up' } });
      expect(game.ballDirection).toBe('up');
    });

    it('flickMiss leaves the ball unreturned and shows the shit popup', () => {
      game.flickMiss({ id: 'flick-1' });
      expect(game.ballReturned).toBe(false);
      expect(game.ballDirection).toBeNull();
      expect(game.popup.texture).toBe(FLICK_RALLY_ASSETS.popups.miss);
    });

    it('every required target is reachable via dispatchCueAction', () => {
      for (const action of [
        'serveCue',
        'flickPerfect',
        'flickGood',
        'flickBarely',
        'flickMiss'
      ]) {
        expect(() => dispatchCueAction(game, action, { id: `${action}-evt` })).not.toThrow();
      }
    });

    it('dispatchCueAction throws a descriptive error for an unknown action', () => {
      expect(() => dispatchCueAction(game, 'noSuchAction', { id: 'x' })).toThrow(/noSuchAction/);
    });
  });

  describe('base overrides', () => {
    beforeEach(() => {
      game.create();
    });

    it('onCue routes to serveCue', () => {
      game.onCue({ id: 'serve-cue-2', action: 'serveCue' });
      expect(game.ballServed).toBe(true);
    });

    it('onJudgement routes each category to the matching popup', () => {
      game.serveCue({ id: 'serve-cue-1' });
      game.onJudgement({ judgement: 'perfect', direction: 'up' });
      expect(game.popup.texture).toBe(FLICK_RALLY_ASSETS.popups.perfect);

      game.onJudgement({ judgement: 'wrong' });
      expect(game.popup.texture).toBe(FLICK_RALLY_ASSETS.popups.miss);
      expect(game.ballReturned).toBe(false);
    });

    it('onMiss shows the miss popup', () => {
      game.onMiss({ id: 'flick-2' });
      expect(game.popup.texture).toBe(FLICK_RALLY_ASSETS.popups.miss);
    });
  });

  describe('destroy()', () => {
    it('is idempotent and nulls references (R16.4)', () => {
      game.create();

      game.destroy();
      expect(() => game.destroy()).not.toThrow();

      expect(game.server).toBeNull();
      expect(game.player).toBeNull();
      expect(game.ball).toBeNull();
      expect(game.popup).toBeNull();
    });
  });
});

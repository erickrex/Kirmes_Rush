/**
 * @fileoverview Unit tests for FillBotGame — the Hold Minigame_Controller.
 *
 * Feature: rhythm-minigame-prototype (Task 12.2)
 *
 * Deterministic + headless: a stub scene provides `add.sprite`/`add.image`/
 * `add.rectangle`/`tweens.add`/`anims.exists` so no real Phaser is required.
 * The tests assert that create() builds owned objects (bot, player, meter frame,
 * fill bar), that feeding holdTick progress drives the fill fraction
 * monotonically/proportionally against the Expectation's targetSpanMs (R2.4),
 * that each Cue_Action_Dispatch target required by fill-bot.json (fillCue /
 * fillPerfect / fillGood / fillBarely / fillMiss) works and is reachable via
 * dispatchCueAction (R2.5), and that destroy() releases every owned object
 * (R16.4).
 *
 * Requirements 2.1, 2.4, 2.5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import FillBotGame, {
  FILL_BOT_ASSETS,
  DEFAULT_TARGET_SPAN_MS
} from '../src/rhythm/minigames/FillBotGame.js';
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
    scaleX: 1,
    destroyed: false,
    play: vi.fn(),
    setScale: vi.fn(function setScale(sx) {
      this.scaleX = sx;
      return this;
    }),
    setDisplaySize: vi.fn(function setDisplaySize(w, h) {
      this.displayWidth = w;
      this.displayHeight = h;
      return this;
    }),
    setOrigin: vi.fn().mockReturnThis(),
    destroy: vi.fn(function destroy() {
      this.destroyed = true;
    })
  };
}

/**
 * Build a stub scene exposing the minimal factories FillBotGame uses. All
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

describe('FillBotGame', () => {
  let scene;
  let game;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = createMockScene();
    game = new FillBotGame(scene, /** @type {any} */ ({ id: 'fill-bot' }));
  });

  it('is a RhythmMinigame subclass', () => {
    expect(game).toBeInstanceOf(RhythmMinigame);
  });

  describe('create()', () => {
    it('builds bot/player sprites and the meter frame + fill bar', () => {
      game.create();

      expect(scene.add.sprite).toHaveBeenCalledTimes(2);
      expect(scene.add.rectangle).toHaveBeenCalledTimes(2);
      expect(game.bot).not.toBeNull();
      expect(game.player).not.toBeNull();
      expect(game.meter).not.toBeNull();
      expect(game.fillBar).not.toBeNull();
      expect(game.bot.texture).toBe(FILL_BOT_ASSETS.botAtlas);
      expect(game.player.texture).toBe(FILL_BOT_ASSETS.playerAtlas);
    });

    it('starts with an empty fill (fraction 0)', () => {
      game.create();
      expect(game.fillFraction).toBe(0);
    });

    it('owns every object it creates so they are released on teardown (R16.4)', () => {
      game.create();

      game.destroy();

      expect(scene.created).toHaveLength(4);
      for (const obj of scene.created) {
        expect(obj.destroy).toHaveBeenCalled();
        expect(obj.destroyed).toBe(true);
      }
    });

    it('does not throw and creates nothing when the scene is headless', () => {
      const headless = new FillBotGame({}, undefined);

      expect(() => headless.create()).not.toThrow();
      expect(headless.bot).toBeNull();
      expect(headless.player).toBeNull();
      expect(headless.fillBar).toBeNull();
    });
  });

  describe('onHoldTick() — continuous fill (R2.4)', () => {
    beforeEach(() => {
      game.create();
    });

    it('maps elapsed hold duration against the Expectation targetSpanMs', () => {
      const expectation = { targetSpanMs: 2000 };
      expect(game.onHoldTick({ durationMs: 0 }, expectation)).toBe(0);
      expect(game.onHoldTick({ durationMs: 500 }, expectation)).toBeCloseTo(0.25, 5);
      expect(game.onHoldTick({ durationMs: 1000 }, expectation)).toBeCloseTo(0.5, 5);
      expect(game.onHoldTick({ durationMs: 2000 }, expectation)).toBe(1);
    });

    it('drives the fill fraction monotonically as the reported duration grows', () => {
      const expectation = { targetSpanMs: 1000 };
      const durations = [0, 100, 250, 400, 750, 1000];
      let previous = -1;
      for (const durationMs of durations) {
        game.onHoldTick({ durationMs }, expectation);
        expect(game.fillFraction).toBeGreaterThanOrEqual(previous);
        previous = game.fillFraction;
      }
      expect(game.fillFraction).toBe(1);
    });

    it('clamps the fill fraction to [0, 1] when the hold overshoots its span', () => {
      const fraction = game.onHoldTick({ durationMs: 5000 }, { targetSpanMs: 1000 });
      expect(fraction).toBe(1);
      expect(game.fillFraction).toBe(1);
    });

    it('reflects the fill fraction onto the fill bar visual', () => {
      game.onHoldTick({ durationMs: 500 }, { targetSpanMs: 1000 });
      expect(game.fillBar.scaleX).toBeCloseTo(0.5, 5);
    });

    it('falls back to the default span when no Expectation span is supplied', () => {
      const fraction = game.onHoldTick({ durationMs: DEFAULT_TARGET_SPAN_MS / 2 });
      expect(fraction).toBeCloseTo(0.5, 5);
    });
  });

  describe('Cue_Action_Dispatch targets (R2.5)', () => {
    beforeEach(() => {
      game.create();
    });

    it('fillCue resets the fill to empty', () => {
      game.onHoldTick({ durationMs: 1000 }, { targetSpanMs: 1000 });
      expect(game.fillFraction).toBe(1);

      game.fillCue({ id: 'fill-cue-1', action: 'fillCue' });
      expect(game.fillFraction).toBe(0);
    });

    it('fillPerfect fills the meter and shows the sick popup', () => {
      game.fillPerfect({ judgement: 'perfect' });
      expect(game.fillFraction).toBe(1);
      expect(game.popup).not.toBeNull();
      expect(game.popup.texture).toBe(FILL_BOT_ASSETS.popups.perfect);
    });

    it('fillGood shows the good popup', () => {
      game.fillGood({ judgement: 'good' });
      expect(game.popup.texture).toBe(FILL_BOT_ASSETS.popups.good);
    });

    it('fillBarely shows the bad popup', () => {
      game.fillBarely({ judgement: 'barely' });
      expect(game.popup.texture).toBe(FILL_BOT_ASSETS.popups.barely);
    });

    it('fillMiss empties the meter and shows the shit popup', () => {
      game.onHoldTick({ durationMs: 500 }, { targetSpanMs: 1000 });
      game.fillMiss({ id: 'fill-1' });
      expect(game.fillFraction).toBe(0);
      expect(game.popup.texture).toBe(FILL_BOT_ASSETS.popups.miss);
    });

    it('every required target is reachable via dispatchCueAction (R11.5)', () => {
      for (const action of ['fillCue', 'fillPerfect', 'fillGood', 'fillBarely', 'fillMiss']) {
        expect(() => dispatchCueAction(game, action, { id: `${action}-evt` })).not.toThrow();
      }
    });

    it('dispatchCueAction throws a descriptive error for an unknown action (R11.6)', () => {
      expect(() => dispatchCueAction(game, 'noSuchAction', { id: 'x' })).toThrow(/noSuchAction/);
    });
  });

  describe('base overrides', () => {
    beforeEach(() => {
      game.create();
    });

    it('onCue routes to fillCue', () => {
      game.onHoldTick({ durationMs: 1000 }, { targetSpanMs: 1000 });
      game.onCue({ id: 'fill-cue-2', action: 'fillCue' });
      expect(game.fillFraction).toBe(0);
    });

    it('onJudgement routes each category to the matching popup', () => {
      game.onJudgement({ judgement: 'perfect' });
      expect(game.popup.texture).toBe(FILL_BOT_ASSETS.popups.perfect);

      game.onJudgement({ judgement: 'miss' });
      expect(game.popup.texture).toBe(FILL_BOT_ASSETS.popups.miss);
    });

    it('onMiss shows the miss popup', () => {
      game.onMiss({ id: 'fill-2' });
      expect(game.popup.texture).toBe(FILL_BOT_ASSETS.popups.miss);
    });
  });

  describe('destroy()', () => {
    it('is idempotent and nulls references (R16.4)', () => {
      game.create();

      game.destroy();
      expect(() => game.destroy()).not.toThrow();

      expect(game.bot).toBeNull();
      expect(game.player).toBeNull();
      expect(game.meter).toBeNull();
      expect(game.fillBar).toBeNull();
      expect(game.popup).toBeNull();
    });
  });
});

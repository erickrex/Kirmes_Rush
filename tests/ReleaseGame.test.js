/**
 * @fileoverview Unit tests for ReleaseGame — the Release Minigame_Controller.
 *
 * Feature: rhythm-minigame-prototype (Task 12.3)
 *
 * Deterministic + headless: a stub scene provides `add.sprite`/`add.image`/
 * `add.rectangle`/`tweens.add`/`anims.exists` so no real Phaser is required.
 * The tests assert that create() builds owned objects (coach, player, meter
 * frame, charge bar, release marker), that feeding holdStart/holdTick progress
 * drives the charge fraction monotonically/proportionally against the
 * Expectation's targetSpanMs (R3.1), that each Cue_Action_Dispatch target
 * required by release-cue.json (chargeCue / releasePerfect / releaseGood /
 * releaseBarely / releaseMiss) works and is reachable via dispatchCueAction
 * (R3.5), and that destroy() releases every owned object (R16.4).
 *
 * Requirements 3.1, 3.5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReleaseGame, {
  RELEASE_ASSETS,
  DEFAULT_CHARGE_SPAN_MS
} from '../src/rhythm/minigames/ReleaseGame.js';
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
 * Build a stub scene exposing the minimal factories ReleaseGame uses. All
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

describe('ReleaseGame', () => {
  let scene;
  let game;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = createMockScene();
    game = new ReleaseGame(scene, /** @type {any} */ ({ id: 'release-cue' }));
  });

  it('is a RhythmMinigame subclass', () => {
    expect(game).toBeInstanceOf(RhythmMinigame);
  });

  describe('create()', () => {
    it('builds coach/player sprites and the meter frame + charge bar + marker', () => {
      game.create();

      expect(scene.add.sprite).toHaveBeenCalledTimes(2);
      expect(scene.add.rectangle).toHaveBeenCalledTimes(3);
      expect(game.coach).not.toBeNull();
      expect(game.player).not.toBeNull();
      expect(game.meter).not.toBeNull();
      expect(game.chargeBar).not.toBeNull();
      expect(game.releaseMarker).not.toBeNull();
      expect(game.coach.texture).toBe(RELEASE_ASSETS.coachAtlas);
      expect(game.player.texture).toBe(RELEASE_ASSETS.playerAtlas);
    });

    it('starts with an empty charge (fraction 0) and not charging', () => {
      game.create();
      expect(game.chargeFraction).toBe(0);
      expect(game.charging).toBe(false);
    });

    it('owns every object it creates so they are released on teardown (R16.4)', () => {
      game.create();

      game.destroy();

      expect(scene.created).toHaveLength(5);
      for (const obj of scene.created) {
        expect(obj.destroy).toHaveBeenCalled();
        expect(obj.destroyed).toBe(true);
      }
    });

    it('does not throw and creates nothing when the scene is headless', () => {
      const headless = new ReleaseGame({}, undefined);

      expect(() => headless.create()).not.toThrow();
      expect(headless.coach).toBeNull();
      expect(headless.player).toBeNull();
      expect(headless.chargeBar).toBeNull();
      expect(headless.releaseMarker).toBeNull();
    });
  });

  describe('charging visual (R3.1)', () => {
    beforeEach(() => {
      game.create();
    });

    it('onHoldStart marks charging and resets the charge to empty', () => {
      game.onHoldTick({ durationMs: 500 }, { targetSpanMs: 1000 });
      expect(game.chargeFraction).toBeGreaterThan(0);

      game.onHoldStart({});
      expect(game.charging).toBe(true);
      expect(game.chargeFraction).toBe(0);
    });

    it('maps elapsed hold duration against the Expectation targetSpanMs', () => {
      const expectation = { targetSpanMs: 2000 };
      expect(game.onHoldTick({ durationMs: 0 }, expectation)).toBe(0);
      expect(game.onHoldTick({ durationMs: 500 }, expectation)).toBeCloseTo(0.25, 5);
      expect(game.onHoldTick({ durationMs: 1000 }, expectation)).toBeCloseTo(0.5, 5);
      expect(game.onHoldTick({ durationMs: 2000 }, expectation)).toBe(1);
    });

    it('drives the charge fraction monotonically as the reported duration grows', () => {
      const expectation = { targetSpanMs: 1000 };
      const durations = [0, 100, 250, 400, 750, 1000];
      let previous = -1;
      for (const durationMs of durations) {
        game.onHoldTick({ durationMs }, expectation);
        expect(game.chargeFraction).toBeGreaterThanOrEqual(previous);
        previous = game.chargeFraction;
      }
      expect(game.chargeFraction).toBe(1);
    });

    it('clamps the charge fraction to [0, 1] when the hold overshoots its span', () => {
      const fraction = game.onHoldTick({ durationMs: 5000 }, { targetSpanMs: 1000 });
      expect(fraction).toBe(1);
      expect(game.chargeFraction).toBe(1);
    });

    it('reflects the charge fraction onto the charge bar visual', () => {
      game.onHoldTick({ durationMs: 500 }, { targetSpanMs: 1000 });
      expect(game.chargeBar.scaleX).toBeCloseTo(0.5, 5);
    });

    it('falls back to the default span when no Expectation span is supplied', () => {
      const fraction = game.onHoldTick({ durationMs: DEFAULT_CHARGE_SPAN_MS / 2 });
      expect(fraction).toBeCloseTo(0.5, 5);
    });
  });

  describe('Cue_Action_Dispatch targets (R3.5)', () => {
    beforeEach(() => {
      game.create();
    });

    it('chargeCue resets the charge to empty and pulses the marker', () => {
      game.onHoldTick({ durationMs: 1000 }, { targetSpanMs: 1000 });
      expect(game.chargeFraction).toBe(1);

      game.chargeCue({ id: 'charge-cue-1', action: 'chargeCue' });
      expect(game.chargeFraction).toBe(0);
      expect(game.charging).toBe(false);
      expect(scene.tweens.add).toHaveBeenCalled();
    });

    it('releasePerfect completes the charge and shows the sick popup', () => {
      game.releasePerfect({ judgement: 'perfect' });
      expect(game.chargeFraction).toBe(1);
      expect(game.popup).not.toBeNull();
      expect(game.popup.texture).toBe(RELEASE_ASSETS.popups.perfect);
    });

    it('releaseGood shows the good popup', () => {
      game.releaseGood({ judgement: 'good' });
      expect(game.popup.texture).toBe(RELEASE_ASSETS.popups.good);
    });

    it('releaseBarely shows the bad popup', () => {
      game.releaseBarely({ judgement: 'barely' });
      expect(game.popup.texture).toBe(RELEASE_ASSETS.popups.barely);
    });

    it('releaseMiss empties the charge and shows the shit popup', () => {
      game.onHoldTick({ durationMs: 500 }, { targetSpanMs: 1000 });
      game.releaseMiss({ id: 'release-1' });
      expect(game.chargeFraction).toBe(0);
      expect(game.popup.texture).toBe(RELEASE_ASSETS.popups.miss);
    });

    it('every required target is reachable via dispatchCueAction (R11.5)', () => {
      for (const action of [
        'chargeCue',
        'releasePerfect',
        'releaseGood',
        'releaseBarely',
        'releaseMiss'
      ]) {
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

    it('onCue routes to chargeCue', () => {
      game.onHoldTick({ durationMs: 1000 }, { targetSpanMs: 1000 });
      game.onCue({ id: 'charge-cue-2', action: 'chargeCue' });
      expect(game.chargeFraction).toBe(0);
    });

    it('onJudgement routes each category to the matching popup', () => {
      game.onJudgement({ judgement: 'perfect' });
      expect(game.popup.texture).toBe(RELEASE_ASSETS.popups.perfect);

      game.onJudgement({ judgement: 'wrong' });
      expect(game.popup.texture).toBe(RELEASE_ASSETS.popups.miss);
    });

    it('onMiss shows the miss popup', () => {
      game.onMiss({ id: 'release-2' });
      expect(game.popup.texture).toBe(RELEASE_ASSETS.popups.miss);
    });
  });

  describe('destroy()', () => {
    it('is idempotent and nulls references (R16.4)', () => {
      game.create();

      game.destroy();
      expect(() => game.destroy()).not.toThrow();

      expect(game.coach).toBeNull();
      expect(game.player).toBeNull();
      expect(game.meter).toBeNull();
      expect(game.chargeBar).toBeNull();
      expect(game.releaseMarker).toBeNull();
      expect(game.popup).toBeNull();
    });
  });
});

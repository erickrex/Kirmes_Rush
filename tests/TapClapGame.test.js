/**
 * @fileoverview Unit tests for TapClapGame — the Tap Minigame_Controller.
 *
 * Feature: rhythm-minigame-prototype (Task 12.1)
 *
 * Deterministic + headless: a stub scene provides `add.sprite`/`add.image`/
 * `tweens.add`/`anims.exists` so no real Phaser is required. The tests assert
 * that create() builds owned sprites, the Cue_Action_Dispatch targets required
 * by tap-clap.json (leaderClap / clapPerfect / clapGood / clapBarely / clapMiss)
 * drive presentation, dispatchCueAction resolves them, and destroy() releases
 * every owned object.
 *
 * Requirements 1.1, 1.2, 1.4, 13.3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import TapClapGame, { TAP_CLAP_ASSETS } from '../src/rhythm/minigames/TapClapGame.js';
import RhythmMinigame from '../src/rhythm/minigames/RhythmMinigame.js';
import { dispatchCueAction } from '../src/rhythm/minigames/MinigameRegistry.js';

/**
 * Create a deterministic stub game object that records destroy() calls.
 * @param {string} kind - 'sprite' or 'image'.
 * @param {Object} props - Initial props (x, y, texture).
 * @returns {Object} The stub object.
 */
function createStubObject(kind, props) {
  return {
    kind,
    ...props,
    alpha: 1,
    destroyed: false,
    play: vi.fn(),
    setScale: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    destroy: vi.fn(function destroy() {
      this.destroyed = true;
    })
  };
}

/**
 * Build a stub scene exposing the minimal factories TapClapGame uses. All
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

describe('TapClapGame', () => {
  let scene;
  let game;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = createMockScene();
    game = new TapClapGame(scene, /** @type {any} */ ({ id: 'tap-clap' }));
  });

  it('is a RhythmMinigame subclass', () => {
    expect(game).toBeInstanceOf(RhythmMinigame);
  });

  describe('create()', () => {
    it('builds leader (GF) and clapper (BF) sprites from committed atlases (R13.3)', () => {
      game.create();

      expect(scene.add.sprite).toHaveBeenCalledTimes(2);
      expect(game.leader).not.toBeNull();
      expect(game.clapper).not.toBeNull();
      expect(game.leader.texture).toBe(TAP_CLAP_ASSETS.leaderAtlas);
      expect(game.clapper.texture).toBe(TAP_CLAP_ASSETS.clapperAtlas);
    });

    it('owns the sprites it creates so they are released on teardown (R16.4)', () => {
      game.create();

      game.destroy();

      expect(scene.created).toHaveLength(2);
      for (const obj of scene.created) {
        expect(obj.destroy).toHaveBeenCalled();
        expect(obj.destroyed).toBe(true);
      }
    });

    it('does not throw and creates nothing when the scene is headless (no add factory)', () => {
      const headless = new TapClapGame({}, undefined);

      expect(() => headless.create()).not.toThrow();
      expect(headless.leader).toBeNull();
      expect(headless.clapper).toBeNull();
    });
  });

  describe('Cue_Action_Dispatch targets', () => {
    beforeEach(() => {
      game.create();
    });

    it('leaderClap plays a pose on the leader (R1.2)', () => {
      game.leaderClap({ id: 'clap-cue-1', action: 'leaderClap' });

      expect(game.leader.play).toHaveBeenCalled();
    });

    it('clapPerfect reacts and shows the perfect popup (R1.4)', () => {
      game.clapPerfect({ judgement: 'perfect' });

      expect(game.clapper.play).toHaveBeenCalled();
      expect(scene.add.image).toHaveBeenCalled();
      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.perfect);
    });

    it('clapGood shows the good popup (R1.4)', () => {
      game.clapGood({ judgement: 'good' });

      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.good);
    });

    it('clapBarely shows the barely popup (R1.4)', () => {
      game.clapBarely({ judgement: 'barely' });

      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.barely);
    });

    it('clapMiss shows the miss popup (R1.4)', () => {
      game.clapMiss({ id: 'clap-1' });

      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.miss);
    });

    it('replaces the previous popup when a new judgement arrives', () => {
      game.clapPerfect({ judgement: 'perfect' });
      const first = game.popup;

      game.clapGood({ judgement: 'good' });

      expect(first.destroy).toHaveBeenCalled();
      expect(game.popup).not.toBe(first);
      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.good);
    });

    it('is reachable via dispatchCueAction for every target named in tap-clap.json', () => {
      const targets = ['leaderClap', 'clapPerfect', 'clapGood', 'clapBarely', 'clapMiss'];

      for (const name of targets) {
        expect(() =>
          dispatchCueAction(game, name, { id: `payload-${name}`, judgement: 'good' })
        ).not.toThrow();
      }
    });

    it('surfaces a descriptive error for an unknown action (R11.6)', () => {
      expect(() => dispatchCueAction(game, 'noSuchMethod', { id: 'x' })).toThrow(
        /TapClapGame has no method "noSuchMethod"/
      );
    });
  });

  describe('popup fade lifecycle', () => {
    it('destroys the popup and clears the reference when its tween completes', () => {
      const runningScene = createMockScene({ runTweens: true });
      const g = new TapClapGame(runningScene, undefined);
      g.create();

      g.clapPerfect({ judgement: 'perfect' });

      expect(runningScene.tweens.add).toHaveBeenCalled();
      expect(g.popup).toBeNull();
    });
  });

  describe('base overrides', () => {
    beforeEach(() => {
      game.create();
    });

    it('onCue routes to a leader clap', () => {
      game.onCue({ id: 'clap-cue-2', action: 'leaderClap' });
      expect(game.leader.play).toHaveBeenCalled();
    });

    it('onJudgement routes each category to the matching popup', () => {
      game.onJudgement({ judgement: 'perfect' });
      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.perfect);

      game.onJudgement({ judgement: 'miss' });
      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.miss);
    });

    it('onMiss shows the miss popup', () => {
      game.onMiss({ id: 'clap-3' });
      expect(game.popup.texture).toBe(TAP_CLAP_ASSETS.popups.miss);
    });
  });

  describe('destroy()', () => {
    it('is idempotent and nulls references (R16.4)', () => {
      game.create();

      game.destroy();
      expect(() => game.destroy()).not.toThrow();

      expect(game.leader).toBeNull();
      expect(game.clapper).toBeNull();
      expect(game.popup).toBeNull();
      expect(game.scene).toBeNull();
      expect(game.session).toBeNull();
    });
  });

  it('does not play absent animations (guards on anims.exists)', () => {
    const noAnimScene = createMockScene({ animsExist: false });
    const g = new TapClapGame(noAnimScene, undefined);
    g.create();

    g.leaderClap({});

    // idle in create() + leaderClap all skipped because anims.exists() is false
    expect(g.leader.play).not.toHaveBeenCalled();
  });
});

/**
 * @fileoverview Unit tests for the RhythmMinigame base controller and the
 * RhythmSession per-run value object (task 10).
 *
 * RhythmMinigame: verifies the sensible no-op defaults for the lifecycle
 * dispatch targets (onCue/onJudgement/onMiss/update/create) and that destroy()
 * releases every owned game object and nulls shared references (R16.4). A
 * minimal mock scene is provided; owned objects are plain stubs exposing a
 * `destroy` spy so we can assert release behavior without Phaser.
 *
 * RhythmSession: verifies the value object holds/exposes the resolved fields
 * (definition, timeline, clock config, audio, scoring, controller class) and its
 * `id`/`movementType` convenience getters (R11).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import RhythmMinigame from '../src/rhythm/minigames/RhythmMinigame.js';
import RhythmSession from '../src/rhythm/core/RhythmSession.js';
import { dispatchCueAction } from '../src/rhythm/minigames/MinigameRegistry.js';

/**
 * Build a minimal mock scene exposing just the surfaces a controller might
 * touch. The base class never calls these, but downstream controllers do.
 * @returns {Object} A mock scene.
 */
function makeMockScene() {
  return {
    add: {
      sprite: vi.fn(() => ({ destroy: vi.fn() })),
      image: vi.fn(() => ({ destroy: vi.fn() })),
      existing: vi.fn()
    },
    tweens: {
      add: vi.fn(() => ({ stop: vi.fn() })),
      killTweensOf: vi.fn()
    },
    time: {
      addEvent: vi.fn(() => ({ remove: vi.fn() }))
    }
  };
}

/**
 * Build a tracked game-object stub exposing a `destroy` spy.
 * @returns {{ destroy: import('vitest').Mock }} The stub.
 */
function makeOwnedStub() {
  return { destroy: vi.fn() };
}

describe('RhythmMinigame (base controller)', () => {
  let scene;
  let session;
  let minigame;

  beforeEach(() => {
    scene = makeMockScene();
    session = { id: 'tap-clap' };
    minigame = new RhythmMinigame(scene, session);
  });

  describe('construction', () => {
    it('stores the scene and session references', () => {
      expect(minigame.scene).toBe(scene);
      expect(minigame.session).toBe(session);
    });

    it('tolerates missing scene/session (defaults to null)', () => {
      const bare = new RhythmMinigame();
      expect(bare.scene).toBeNull();
      expect(bare.session).toBeNull();
    });
  });

  describe('default lifecycle dispatch targets', () => {
    it('create/update are no-ops that do not throw', () => {
      expect(() => minigame.create()).not.toThrow();
      expect(() => minigame.update(1000, 16, { songPositionMs: 1000 })).not.toThrow();
    });

    it('onCue/onJudgement/onMiss are no-ops returning undefined', () => {
      expect(minigame.onCue({ id: 'cue-1', action: 'leaderClap', atMs: 1000 })).toBeUndefined();
      expect(
        minigame.onJudgement({ judgement: 'perfect', expectationId: 'e1', resolved: true })
      ).toBeUndefined();
      expect(minigame.onMiss({ id: 'e1', gesture: 'tap' })).toBeUndefined();
    });

    it('is a valid Cue_Action_Dispatch target for its default handlers', () => {
      // dispatchCueAction resolves a named method on the controller; the base
      // class exposes onCue/onJudgement/onMiss so dispatch never throws for them.
      expect(() => dispatchCueAction(minigame, 'onCue', { id: 'cue-1' })).not.toThrow();
      expect(() => dispatchCueAction(minigame, 'onJudgement', { judgement: 'good' })).not.toThrow();
    });

    it('reports a descriptive error when dispatching an unimplemented action (R11.6)', () => {
      expect(() => dispatchCueAction(minigame, 'clapPerfect', { id: 'clap-1' })).toThrow(
        /clapPerfect/
      );
    });
  });

  describe('ownership + destroy() release (R16.4)', () => {
    it('own() tracks and returns the object', () => {
      const obj = makeOwnedStub();
      const returned = minigame.own(obj);
      expect(returned).toBe(obj);
    });

    it('destroy() releases every owned object and nulls references', () => {
      const a = makeOwnedStub();
      const b = makeOwnedStub();
      minigame.own(a);
      minigame.own(b);

      minigame.destroy();

      expect(a.destroy).toHaveBeenCalledTimes(1);
      expect(b.destroy).toHaveBeenCalledTimes(1);
      expect(minigame.scene).toBeNull();
      expect(minigame.session).toBeNull();
    });

    it('destroy() ignores tracked objects without a destroy function', () => {
      const withDestroy = makeOwnedStub();
      minigame.own(withDestroy);
      minigame.own({ notAGameObject: true });

      expect(() => minigame.destroy()).not.toThrow();
      expect(withDestroy.destroy).toHaveBeenCalledTimes(1);
    });

    it('own() ignores null/undefined', () => {
      minigame.own(null);
      minigame.own(undefined);
      const real = makeOwnedStub();
      minigame.own(real);

      minigame.destroy();
      expect(real.destroy).toHaveBeenCalledTimes(1);
    });

    it('destroy() is idempotent (does not double-release)', () => {
      const obj = makeOwnedStub();
      minigame.own(obj);

      minigame.destroy();
      minigame.destroy();

      expect(obj.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('subclass overrides', () => {
    it('subclasses may override handlers while inheriting own/destroy', () => {
      const onPerfect = vi.fn();
      class TapClapStub extends RhythmMinigame {
        create() {
          this.sprite = this.own(makeOwnedStub());
        }

        clapPerfect(payload) {
          onPerfect(payload);
        }
      }

      const controller = new TapClapStub(scene, session);
      controller.create();
      dispatchCueAction(controller, 'clapPerfect', { id: 'clap-1' });
      expect(onPerfect).toHaveBeenCalledWith({ id: 'clap-1' });

      const sprite = controller.sprite;
      controller.destroy();
      expect(sprite.destroy).toHaveBeenCalledTimes(1);
      expect(controller.scene).toBeNull();
    });
  });
});

describe('RhythmSession (per-run value object)', () => {
  /** @returns {Object} A representative resolved session config. */
  function makeConfig() {
    return {
      definition: {
        id: 'tap-clap',
        name: 'Tap Clap',
        movementType: 'tap',
        song: { id: 'tutorial' },
        input: { allowedGestures: ['tap'] },
        scoring: { bands: { superb: 0.9, ok: 0.6 } },
        timeline: [{ id: 'clap-1', type: 'expect', beat: 5, gesture: 'tap' }]
      },
      timeline: [{ id: 'clap-1', type: 'expect', beat: 5, gesture: 'tap' }],
      clockConfig: { bpm: 120, offsetMs: 0, timeChanges: [] },
      audio: { instrumentalKey: 'tutorial-inst', instrumentalPath: 'songs/tutorial/Inst.ogg' },
      scoring: { windowMs: { perfect: 45, good: 90, barely: 140 }, bands: { superb: 0.9, ok: 0.6 } },
      controllerClass: class TapClapGame {}
    };
  }

  it('holds and exposes all resolved fields', () => {
    const config = makeConfig();
    const session = new RhythmSession(config);

    expect(session.definition).toBe(config.definition);
    expect(session.timeline).toBe(config.timeline);
    expect(session.clockConfig).toEqual({ bpm: 120, offsetMs: 0, timeChanges: [] });
    expect(session.audio).toBe(config.audio);
    expect(session.scoring).toBe(config.scoring);
    expect(session.controllerClass).toBe(config.controllerClass);
  });

  it('exposes id and movementType convenience getters from the definition', () => {
    const session = new RhythmSession(makeConfig());
    expect(session.id).toBe('tap-clap');
    expect(session.movementType).toBe('tap');
  });

  it('falls back to definition.timeline when no explicit timeline is provided', () => {
    const config = makeConfig();
    delete config.timeline;
    const session = new RhythmSession(config);
    expect(session.timeline).toBe(config.definition.timeline);
  });

  it('falls back to definition.scoring when no explicit scoring is provided', () => {
    const config = makeConfig();
    delete config.scoring;
    const session = new RhythmSession(config);
    expect(session.scoring).toBe(config.definition.scoring);
  });

  it('the resolved controller class can be instantiated as new controllerClass(scene, session)', () => {
    const scene = makeMockScene();
    const config = {
      ...makeConfig(),
      controllerClass: RhythmMinigame
    };
    const session = new RhythmSession(config);
    const controller = new session.controllerClass(scene, session);
    expect(controller).toBeInstanceOf(RhythmMinigame);
    expect(controller.session).toBe(session);
  });
});

/**
 * @fileoverview Teardown-safety tests for scene transitions.
 *
 * Validates design Property 8 (Teardown safety) for the Transitions feature:
 * tearing down a transition while an animation/overlay is in flight must not
 * throw, must stop in-flight tweens, and must destroy any overlay/stickers.
 * It also validates the scene-level navigation guard: a scene that shuts down
 * mid-transition destroys its Transitions instance and skips the pending
 * `scene.start`.
 *
 * Validates: Requirements 5.4, 5.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Controllable Phaser mock. Unlike the auto-resolving mock used elsewhere,
// camera fades and tweens here do NOT complete on their own — the test drives
// completion explicitly so it can interrupt a genuinely in-flight transition.
vi.mock('phaser', () => {
  const makeGraphics = () => ({
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillGradientStyle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    fillPoints: vi.fn().mockReturnThis(),
    strokePoints: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    bezierCurveTo: vi.fn().mockReturnThis(),
    fillPath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0,
    rotation: 0
  });

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.scene = { key: config?.key, start: vi.fn() };

          // Captured camera fade-complete callbacks, keyed by event name, so
          // tests can resolve a transitionOut/In promise on demand.
          this._fadeCallbacks = {};
          // Tweens created during a transition (so tests can inspect them).
          this._tweens = [];

          this.add = {
            graphics: vi.fn(() => makeGraphics())
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              zoom: 1,
              setZoom: vi.fn(),
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn((event, cb) => {
                this._fadeCallbacks[event] = cb;
              })
            }
          };
          this.tweens = {
            add: vi.fn((cfg) => {
              const tween = { stop: vi.fn(), _config: cfg };
              this._tweens.push(tween);
              return tween;
            })
          };
          this.time = {
            delayedCall: vi.fn(() => ({ remove: vi.fn() }))
          };
          this.input = { keyboard: { on: vi.fn(), off: vi.fn() } };
          this.cache = { audio: { exists: vi.fn(() => false) } };
          this.events = { on: vi.fn(), off: vi.fn() };
          this.game = { canvas: null };
          this.sound = { play: vi.fn() };
          this.textures = { exists: vi.fn(() => false) };
        }
      },
      Math: {
        Between: vi.fn((min, max) => Math.floor((min + max) / 2)),
        FloatBetween: vi.fn((min, max) => (min + max) / 2),
        DegToRad: vi.fn((deg) => (deg * Math.PI) / 180),
        Vector2: class {
          constructor(x, y) {
            this.x = x;
            this.y = y;
          }
        }
      },
      Utils: { Array: { GetRandom: vi.fn((arr) => arr[0]) } }
    }
  };
});

import Phaser from '../src/phaser.js';
import Transitions, { TransitionType } from '../src/graphics/Transitions.js';
import BaseMenuState from '../src/ui/BaseMenuState.js';

/** Build a fresh mock scene instance via the mocked Phaser.Scene. */
const createMockScene = () => new Phaser.Scene({ key: 'MockScene' });

describe('Transition teardown safety (Property 8)', () => {
  describe('Transitions instance teardown mid-flight', () => {
    let scene;
    let transitions;

    beforeEach(() => {
      vi.clearAllMocks();
      scene = createMockScene();
      transitions = new Transitions(scene);
    });

    it('destroy() stops an in-flight tween and destroys the overlay without throwing', () => {
      // Start a slide transition: this creates an overlay AND a currentTween
      // that is left in flight (the mock tween never auto-completes).
      transitions.slideTransition({ type: TransitionType.SLIDE_LEFT, direction: 'out' });

      const tween = transitions.currentTween;
      const overlay = transitions.overlay;
      expect(tween).not.toBeNull();
      expect(overlay).not.toBeNull();

      expect(() => transitions.destroy()).not.toThrow();

      expect(tween.stop).toHaveBeenCalled();
      expect(overlay.destroy).toHaveBeenCalled();
      expect(transitions.currentTween).toBeNull();
      expect(transitions.overlay).toBeNull();
      expect(transitions.scene).toBeNull();
    });

    it('cancel() stops an in-flight tween and destroys the overlay without throwing', () => {
      transitions.wipeTransition({ direction: 'out' });

      const tween = transitions.currentTween;
      const overlay = transitions.overlay;
      expect(tween).not.toBeNull();
      expect(overlay).not.toBeNull();

      expect(() => transitions.cancel()).not.toThrow();

      expect(tween.stop).toHaveBeenCalled();
      expect(overlay.destroy).toHaveBeenCalled();
      expect(transitions.currentTween).toBeNull();
      expect(transitions.overlay).toBeNull();
      // cancel() (unlike destroy()) keeps the scene reference intact.
      expect(transitions.scene).toBe(scene);
      expect(transitions.transitioning).toBe(false);
    });

    it('destroy() during an in-flight sticker transition destroys all stickers without throwing', async () => {
      // Kick off a sticker transition so the stickers array is populated with
      // real (mock) game objects.
      const pending = transitions.transitionOut({ type: TransitionType.STICKER, duration: 100 });
      expect(transitions.stickers.length).toBeGreaterThan(0);

      const stickers = [...transitions.stickers];

      expect(() => transitions.destroy()).not.toThrow();

      stickers.forEach((s) => expect(s.destroy).toHaveBeenCalled());
      expect(transitions.stickers).toEqual([]);
      expect(transitions.scene).toBeNull();

      // The pending promise must not reject; it simply never resolves because
      // the transition was torn down. Confirm no unhandled rejection occurs.
      await Promise.race([pending, Promise.resolve()]);
    });

    it('repeated teardown calls are idempotent and never throw', () => {
      transitions.slideTransition({ type: TransitionType.SLIDE_LEFT, direction: 'out' });
      expect(() => {
        transitions.cancel();
        transitions.cancel();
        transitions.destroy();
        transitions.destroy();
      }).not.toThrow();
    });
  });

  describe('Scene shutdown mid-transition (navigation guard)', () => {
    /** Tiny concrete BaseMenuState subclass for exercising the guard. */
    class TestMenuState extends BaseMenuState {
      constructor() {
        super({ key: 'TestMenuState' });
      }
      getItemCount() {
        return 1;
      }
    }

    let scene;

    beforeEach(() => {
      vi.clearAllMocks();
      scene = new TestMenuState();
    });

    it('skips scene.start when shutdown destroys the Transitions instance mid-transition', async () => {
      // Begin navigating; transitionOut awaits the camera fade-out completion,
      // which our mock does NOT auto-fire — so the transition is in flight.
      const navPromise = scene.transitionToScene('NextScene', { payload: 42 });

      // The fade-out has started and registered a completion callback.
      expect(scene.cameras.main.fadeOut).toHaveBeenCalled();
      expect(typeof scene._fadeCallbacks.camerafadeoutcomplete).toBe('function');
      expect(scene.transitions).not.toBeNull();

      // Scene tears down mid-transition: this must destroy + clear Transitions
      // without throwing.
      expect(() => scene.shutdown()).not.toThrow();
      expect(scene.transitions).toBeNull();

      // Now let the (already torn-down) fade resolve its promise.
      scene._fadeCallbacks.camerafadeoutcomplete();

      // The navigation promise resolves without throwing, and because the
      // Transitions instance was cleared, navigation is skipped (Req 5.4/5.6).
      await expect(navPromise).resolves.toBeUndefined();
      expect(scene.scene.start).not.toHaveBeenCalled();
    });

    it('completes navigation normally when no shutdown interrupts the transition', async () => {
      const navPromise = scene.transitionToScene('NextScene', { payload: 7 });

      // Resolve the fade without tearing the scene down.
      scene._fadeCallbacks.camerafadeoutcomplete();

      await navPromise;
      expect(scene.scene.start).toHaveBeenCalledWith('NextScene', { payload: 7 });
    });

    it('shutdown is safe to call when no transition is in flight', () => {
      expect(() => scene.shutdown()).not.toThrow();
      expect(scene.transitions).toBeNull();
    });

    it('shutdown removes pending menu Web Audio unlock listeners', () => {
      const canvas = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
      scene.game.canvas = canvas;
      scene.sound.context = {
        state: 'suspended',
        resume: vi.fn()
      };

      scene.setupInput();
      const touchHandler = canvas.addEventListener.mock.calls.find(
        (call) => call[0] === 'touchstart'
      )[1];

      scene.shutdown();

      expect(canvas.removeEventListener).toHaveBeenCalledWith('touchstart', touchHandler);
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousedown', touchHandler);
      expect(scene.audioUnlockListener).toBeNull();
    });
  });
});

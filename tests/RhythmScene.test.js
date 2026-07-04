/**
 * @fileoverview Unit tests for RhythmScene (task 13.1): create() composition +
 * canvas/audio handling, the per-frame loop (cue dispatch, gesture judging,
 * controller update), miss recording, and the run-end -> ResultState transition.
 *
 * The real Rhythm_Framework components are exercised end to end; only Phaser,
 * AudioManager, and SaveManager are mocked so the scene runs headless.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A working EventEmitter (with context) + a bare Scene base, behind the phaser
// default export the src/phaser.js proxy re-exposes.
vi.mock('phaser', () => {
  class MockEventEmitter {
    constructor() {
      this.listeners = new Map();
    }
    on(event, callback, context) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push({ callback, context });
      return this;
    }
    emit(event, ...args) {
      const entries = this.listeners.get(event) || [];
      entries.slice().forEach(({ callback, context }) => callback.apply(context, args));
      return this;
    }
    off(event, callback, context) {
      const entries = this.listeners.get(event);
      if (!entries) {
        return this;
      }
      this.listeners.set(
        event,
        entries.filter((e) => e.callback !== callback || (context && e.context !== context))
      );
      return this;
    }
    removeAllListeners() {
      this.listeners.clear();
      return this;
    }
  }

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.sys = { settings: config };
        }
      },
      Events: { EventEmitter: MockEventEmitter }
    }
  };
});

const audioState = vi.hoisted(() => ({ managers: [] }));

vi.mock('../src/audio/AudioManager.js', () => ({
  default: class MockAudioManager {
    constructor() {
      this.currentTime = 0;
      this.isPlaying = false;
      this.onComplete = null;
      this.applyOptionsFromSave = vi.fn();
      this.loadInstrumental = vi.fn();
      this.play = vi.fn(() => {
        this.isPlaying = true;
      });
      this.stop = vi.fn();
      this.destroy = vi.fn();
      audioState.managers.push(this);
    }
  }
}));

vi.mock('../src/data/SaveManager.js', () => ({
  default: {
    getInstance: () => ({ getInputDelayCompensation: () => 0 })
  }
}));

import RhythmScene from '../src/rhythm/scene/RhythmScene.js';

/**
 * A minimal spy controller matching the RhythmMinigame surface the scene calls.
 */
function createControllerClass() {
  return class SpyController {
    constructor(scene, session) {
      this.scene = scene;
      this.session = session;
      SpyController.instances.push(this);
      this.create = vi.fn();
      this.update = vi.fn();
      this.onCue = vi.fn();
      this.onJudgement = vi.fn();
      this.onMiss = vi.fn();
      this.leaderClap = vi.fn();
      this.clapMiss = vi.fn();
      this.destroy = vi.fn();
    }
    static instances = [];
  };
}

/**
 * Build a session with one cue (beat 1) and one tap expectation (beat 2).
 * At 120 BPM one beat is 500ms, so cue fires at 500ms and the expectation
 * window closes at 1000 + 140 = 1140ms.
 * @param {Function} controllerClass
 */
function createSession(controllerClass) {
  return {
    definition: { id: 'tap-clap', name: 'Tap Clap' },
    clockConfig: { bpm: 120 },
    scoring: { windowMs: { perfect: 45, good: 90, barely: 140 } },
    audio: { instrumentalKey: 'song-tap-clap' },
    controllerClass,
    timeline: [
      { id: 'cue-1', type: 'cue', beat: 1, action: 'leaderClap' },
      {
        id: 'exp-1',
        type: 'expect',
        beat: 2,
        gesture: 'tap',
        windowMs: { perfect: 45, good: 90, barely: 140 },
        onPerfect: 'clapPerfect',
        onMiss: 'clapMiss'
      }
    ]
  };
}

/**
 * Instantiate a RhythmScene wired with headless stand-ins for Phaser services.
 * @param {ReturnType<typeof createSession>} session
 * @param {*} [canvasOverride] - Optional canvas stand-in (e.g. a listener-counting canvas).
 */
function bootScene(session, canvasOverride) {
  const scene = new RhythmScene();

  const canvas = canvasOverride ?? {
    style: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  scene.game = { canvas };
  scene.sound = { context: { state: 'running', resume: vi.fn() } };
  scene.scene = { start: vi.fn() };
  scene.events = { on: vi.fn(), off: vi.fn() };

  scene.init({ session });
  scene.create();
  return { scene, canvas };
}

/**
 * A canvas stand-in that records every listener registration by (type, handler)
 * so a test can assert exactly how many remain after teardown (Property 7).
 * `removeEventListener` only drops an entry when both the type and the handler
 * reference match, mirroring the DOM contract the recognizer and audio-unlock
 * handling rely on.
 */
function createCountingCanvas() {
  /** @type {{ type: string, handler: EventListener }[]} */
  const entries = [];
  return {
    style: {},
    addEventListener(type, handler) {
      entries.push({ type, handler });
    },
    removeEventListener(type, handler) {
      const i = entries.findIndex((e) => e.type === type && e.handler === handler);
      if (i >= 0) {
        entries.splice(i, 1);
      }
    },
    listenerCount() {
      return entries.length;
    }
  };
}

describe('RhythmScene', () => {
  beforeEach(() => {
    audioState.managers.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create()', () => {
    it('composes the framework and configures canvas + audio', () => {
      const ControllerClass = createControllerClass();
      const { scene, canvas } = bootScene(createSession(ControllerClass));

      expect(scene.clock).toBeTruthy();
      expect(scene.timeline).toBeTruthy();
      expect(scene.scheduler).toBeTruthy();
      expect(scene.judger).toBeTruthy();
      expect(scene.scoring).toBeTruthy();
      expect(scene.recognizer).toBeTruthy();
      expect(scene.inputManager).toBeTruthy();
      expect(scene.controller).toBeTruthy();
      expect(scene.audioManager).toBeTruthy();

      // Controller instantiated + created.
      expect(ControllerClass.instances).toHaveLength(1);
      expect(ControllerClass.instances[0].create).toHaveBeenCalledTimes(1);

      // R14.2: canvas touch-action set to none, prior value stored for 13.2.
      expect(canvas.style.touchAction).toBe('none');
      expect(scene._priorTouchAction).toBe('');

      // Recognizer attached its pointer listeners on the canvas.
      expect(canvas.addEventListener).toHaveBeenCalled();

      // R14.5: audio started from 0.
      expect(scene.audioManager.play).toHaveBeenCalledWith(0);

      // Shutdown hook registered for 13.2.
      expect(scene.events.on).toHaveBeenCalledWith('shutdown', scene.shutdown, scene);
    });

    it('no-ops without a session', () => {
      const scene = new RhythmScene();
      scene.scene = { start: vi.fn() };
      scene.init({});
      expect(() => scene.create()).not.toThrow();
      expect(scene.scheduler).toBeNull();
    });
  });

  describe('update() per-frame loop', () => {
    it('dispatches a due cue to the controller and updates it', () => {
      const ControllerClass = createControllerClass();
      const { scene } = bootScene(createSession(ControllerClass));
      const controller = ControllerClass.instances[0];

      const cueMs = scene.timeline.cues[0].atMs;
      scene.audioManager.currentTime = cueMs; // cue-1 is due
      scene.update(0, 16);

      // Cue action 'leaderClap' dispatched via Cue_Action_Dispatch.
      expect(controller.leaderClap).toHaveBeenCalledTimes(1);
      // Controller.update driven each frame with song context.
      expect(controller.update).toHaveBeenCalledTimes(1);
      const ctx = controller.update.mock.calls[0][2];
      expect(ctx.songPositionMs).toBe(cueMs);
    });

    it('records a window-close miss and transitions to ResultState', () => {
      const ControllerClass = createControllerClass();
      const { scene } = bootScene(createSession(ControllerClass));
      const controller = ControllerClass.instances[0];

      const cueMs = scene.timeline.cues[0].atMs;
      const closeMs = scene.timeline.expectations[0].windowCloseMs;

      // First frame fires the cue.
      scene.audioManager.currentTime = cueMs;
      scene.update(0, 16);

      // Advance past the expectation window close so it misses.
      scene.audioManager.currentTime = closeMs + 10;
      scene.update(16, 16);

      // Miss routed to the named onMiss handler and recorded into scoring.
      expect(controller.clapMiss).toHaveBeenCalledTimes(1);
      expect(scene.scoring.summary().counts.miss).toBe(1);

      // R12.5: run ended -> ResultState with the scoring summary.
      expect(scene.scene.start).toHaveBeenCalledTimes(1);
      const [key, payload] = scene.scene.start.mock.calls[0];
      expect(key).toBe('ResultState');
      expect(payload.resultBand).toBe('Try Again');
      expect(payload.score).toBe(0);
      expect(payload.rhythmSummary.counts.miss).toBe(1);
      expect(payload.songData.songName).toBe('Tap Clap');
    });

    it('judges a buffered tap gesture against the active expectation', () => {
      const ControllerClass = createControllerClass();
      const { scene } = bootScene(createSession(ControllerClass));
      const controller = ControllerClass.instances[0];

      // Anchor the input clock so a gesture at startTime=0 maps to the
      // expectation target, then buffer a tap.
      const targetMs = scene.timeline.expectations[0].targetMs;
      scene.inputManager.syncClock(targetMs, 0);
      scene.inputManager.onGesture({
        type: 'tap',
        startTime: 0,
        timestamp: 0,
        position: { x: 0, y: 0 },
        startPosition: { x: 0, y: 0 },
        durationMs: 10,
        distancePx: 0,
        velocityPxPerMs: 0,
        direction: null
      });

      // Open the expectation window and judge on this frame.
      scene.audioManager.currentTime = targetMs;
      scene.update(0, 16);

      // A perfect tap resolves the expectation and is recorded by the judger.
      expect(scene.scoring.summary().counts.perfect).toBe(1);
      // Named onPerfect handler is absent on the spy, so it falls back to
      // onJudgement with the resolving result.
      expect(controller.onJudgement).toHaveBeenCalledTimes(1);
      expect(controller.onJudgement.mock.calls[0][0].judgement).toBe('perfect');
    });
  });

  describe('shutdown() teardown (R14.3, R16)', () => {
    it('detaches the recognizer so zero pointer/unlock listeners remain (Property 7)', () => {
      const ControllerClass = createControllerClass();
      const canvas = createCountingCanvas();
      const { scene } = bootScene(createSession(ControllerClass), canvas);

      // create() attaches the recognizer's 3 pointer listeners plus the 4
      // raw audio-unlock listeners.
      expect(canvas.listenerCount()).toBeGreaterThan(0);
      const detachSpy = vi.spyOn(scene.recognizer, 'detach');

      scene.shutdown();

      expect(detachSpy).toHaveBeenCalledTimes(1);
      // R16.1 / Property 7: every listener the scene registered is removed.
      expect(canvas.listenerCount()).toBe(0);
    });

    it('removes this run\'s emitter subscriptions and halts the loop', () => {
      const ControllerClass = createControllerClass();
      const { scene } = bootScene(createSession(ControllerClass));
      const bus = scene.bus;

      // Sanity: the scheduler emitter has cue + miss subscriptions before teardown.
      expect(bus.listeners.size).toBeGreaterThan(0);

      scene.shutdown();

      // R16.2: subscriptions removed and the emitter reference nulled.
      let remaining = 0;
      for (const entries of bus.listeners.values()) {
        remaining += entries.length;
      }
      expect(remaining).toBe(0);
      expect(scene.bus).toBeNull();
      expect(scene._active).toBe(false);
    });

    it('restores the canvas touch-action to its prior value (R14.3)', () => {
      const ControllerClass = createControllerClass();
      const canvas = createCountingCanvas();
      canvas.style.touchAction = 'auto'; // a non-empty prior value

      const { scene } = bootScene(createSession(ControllerClass), canvas);
      // create() forced 'none' and captured the prior value.
      expect(canvas.style.touchAction).toBe('none');
      expect(scene._priorTouchAction).toBe('auto');

      scene.shutdown();

      expect(canvas.style.touchAction).toBe('auto');
    });

    it('destroys the controller, clock, and audio, and removes the shutdown listener', () => {
      const ControllerClass = createControllerClass();
      const { scene } = bootScene(createSession(ControllerClass));
      const controller = ControllerClass.instances[0];
      const audioManager = scene.audioManager;
      const clockDestroy = vi.spyOn(scene.clock, 'destroy');

      scene.shutdown();

      // R16.4: controller releases its game objects.
      expect(controller.destroy).toHaveBeenCalledTimes(1);
      // Clock's wrapped Conductor released.
      expect(clockDestroy).toHaveBeenCalledTimes(1);
      // Audio stopped and destroyed.
      expect(audioManager.stop).toHaveBeenCalledTimes(1);
      expect(audioManager.destroy).toHaveBeenCalledTimes(1);
      // R16.3: shutdown subscription removed.
      expect(scene.events.off).toHaveBeenCalledWith('shutdown', scene.shutdown, scene);

      // R16.2: every owned reference nulled.
      expect(scene.clock).toBeNull();
      expect(scene.timeline).toBeNull();
      expect(scene.scheduler).toBeNull();
      expect(scene.judger).toBeNull();
      expect(scene.scoring).toBeNull();
      expect(scene.recognizer).toBeNull();
      expect(scene.inputManager).toBeNull();
      expect(scene.controller).toBeNull();
      expect(scene.audioManager).toBeNull();
    });

    it('is idempotent - a second shutdown is a harmless no-op', () => {
      const ControllerClass = createControllerClass();
      const canvas = createCountingCanvas();
      const { scene } = bootScene(createSession(ControllerClass), canvas);
      const controller = ControllerClass.instances[0];

      scene.shutdown();
      expect(() => scene.shutdown()).not.toThrow();

      // No double teardown: controller.destroy only ran once, and no listeners
      // linger after the repeated teardown.
      expect(controller.destroy).toHaveBeenCalledTimes(1);
      expect(canvas.listenerCount()).toBe(0);
    });
  });
});

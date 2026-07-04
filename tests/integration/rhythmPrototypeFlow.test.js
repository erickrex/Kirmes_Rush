/**
 * @fileoverview Rhythm prototype end-to-end flow integration test (task 15).
 *
 * Exercises the full runtime contract of the rhythm minigame prototype against
 * a committed Minigame_Definition (`tap-clap`):
 *
 *  - R12.3 LoadingState's prepareCallback builds the RhythmSession + asset manifest;
 *  - R12.4 LoadingState transitions to RhythmScene with the built session;
 *  - R12.5 a completed run reaches ResultState with the RhythmScoring summary;
 *  - R16.1 RhythmScene shutdown removes every pointer listener the recognizer added.
 *
 * The real Rhythm_Framework components (RhythmClock, CueTimeline, CueScheduler,
 * CueJudger, RhythmScoring, TouchGestureRecognizer, RhythmInputManager, the
 * MinigameRegistry, RhythmSessionBuilder, and the TapClapGame controller) are
 * driven end to end. Only Phaser, AudioManager, SaveManager, and EventBus are
 * mocked so both scenes run headless, and the definition is loaded from the real
 * committed JSON via a file-backed fetch (mirroring `releaseDataFlow.test.js`).
 *
 * Scripted gestures are fed through the recognizer's synthetic pointer API
 * (`_onDown`/`_onUp`) with injected timestamps, and the per-frame loop is driven
 * by a mocked `AudioManager.currentTime`, keeping the test fully deterministic.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// A minimal, working Phaser stand-in: a bare Scene base (services are attached
// per-scene by the harnesses below) plus a real EventEmitter with context
// support, behind the default export shape the src/phaser.js proxy re-exposes.
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

vi.mock('../../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn()
  },
  Events: {
    LOADING_COMPLETE: 'loadingComplete'
  }
}));

const audioState = vi.hoisted(() => ({ managers: [] }));

vi.mock('../../src/audio/AudioManager.js', () => ({
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

vi.mock('../../src/data/SaveManager.js', () => ({
  default: {
    getInstance: () => ({ getInputDelayCompensation: () => 0 })
  }
}));

import LoadingState from '../../src/ui/LoadingState.js';
import RhythmScene from '../../src/rhythm/scene/RhythmScene.js';
import createDefaultMinigameRegistry from '../../src/rhythm/minigames/defaultMinigameRegistry.js';
import TapClapGame from '../../src/rhythm/minigames/TapClapGame.js';
import { buildRhythmPrepareCallback, buildRhythmSession } from '../../src/rhythm/data/RhythmSessionBuilder.js';
import RhythmSession from '../../src/rhythm/core/RhythmSession.js';

const MINIGAME_ID = 'tap-clap';

/**
 * A fetch implementation backed by the real workspace files, resolving a request
 * path relative to the project root (the definition URL already includes the
 * `assets/` prefix).
 * @returns {(requestPath: string) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>}
 */
function createFileBackedFetch() {
  return async (requestPath) => {
    const filePath = path.resolve(process.cwd(), String(requestPath));
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return {
        ok: true,
        status: 200,
        async json() {
          return JSON.parse(raw);
        }
      };
    } catch {
      return {
        ok: false,
        status: 404,
        async json() {
          throw new Error(`Missing fixture for ${requestPath}`);
        }
      };
    }
  };
}

/** Flush pending microtasks + the async prepare chain. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * A chainable Phaser GameObject stand-in for the LoadingState UI factories.
 * @returns {Object}
 */
function chainable() {
  /** @type {any} */
  const obj = {
    rotation: 0,
    setOrigin: vi.fn(() => obj),
    setColor: vi.fn(() => obj),
    setText: vi.fn(() => obj),
    setVisible: vi.fn(() => obj),
    setInteractive: vi.fn(() => obj),
    on: vi.fn(() => obj),
    destroy: vi.fn(() => obj)
  };
  return obj;
}

/**
 * A chainable Graphics stand-in supporting the calls LoadingState makes.
 * @returns {Object}
 */
function graphics() {
  /** @type {any} */
  const g = {
    fillStyle: vi.fn(() => g),
    fillRoundedRect: vi.fn(() => g),
    lineStyle: vi.fn(() => g),
    arc: vi.fn(() => g),
    strokePath: vi.fn(() => g),
    generateTexture: vi.fn(() => g),
    clear: vi.fn(() => g),
    destroy: vi.fn(() => g)
  };
  return g;
}

/**
 * Instantiate a real LoadingState wired with headless stand-ins for the Phaser
 * scene services it touches during prepare -> load -> transition. The loader is
 * mocked so `load.start()` completes synchronously and the camera fade completes
 * immediately, making the transition deterministic.
 * @param {Function} prepareCallback - The rhythm prepareCallback under test.
 * @returns {{ scene: LoadingState }}
 */
function createLoadingHarness(prepareCallback) {
  const scene = new LoadingState();

  /** @type {Record<string, Function>} */
  const loadHandlers = {};

  scene.cameras = {
    main: {
      width: 720,
      height: 1280,
      setBackgroundColor: vi.fn(),
      fadeOut: vi.fn(),
      once: vi.fn((event, cb) => {
        if (event === 'camerafadeoutcomplete') {
          cb();
        }
      })
    }
  };
  scene.add = {
    graphics: vi.fn(() => graphics()),
    text: vi.fn(() => chainable()),
    sprite: vi.fn(() => chainable())
  };
  scene.load = {
    on: vi.fn((event, cb) => {
      loadHandlers[event] = cb;
    }),
    off: vi.fn(),
    image: vi.fn(),
    audio: vi.fn(),
    atlas: vi.fn(),
    atlasXML: vi.fn(),
    spritesheet: vi.fn(),
    json: vi.fn(),
    xml: vi.fn(),
    totalToLoad: 0,
    start: vi.fn(() => {
      loadHandlers.complete?.();
    })
  };
  scene.textures = { exists: vi.fn(() => false) };
  scene.cache = {
    audio: { exists: () => false },
    json: { exists: () => false },
    xml: { exists: () => false }
  };
  scene.scene = { start: vi.fn() };
  scene.events = { on: vi.fn(), off: vi.fn() };

  scene.init({ prepareCallback, nextScene: 'RhythmScene', minDuration: 0 });
  return { scene };
}

/**
 * A canvas stand-in that records every listener registration by (type, handler)
 * so a test can assert exactly how many remain after teardown (R16.1).
 * `removeEventListener` only drops an entry when both the type and the handler
 * reference match, mirroring the DOM contract.
 * @returns {Object}
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

/**
 * Boot a real RhythmScene with headless Phaser stand-ins and a controllable
 * clock shared by the scene's frame-input sampling and the recognizer, so a
 * gesture at `startTime` maps exactly onto the injected Song_Position.
 * @param {RhythmSession} session - The per-run session under test.
 * @param {{ value: number }} clockNow - Shared controllable clock holder.
 * @returns {{ scene: RhythmScene, canvas: ReturnType<typeof createCountingCanvas> }}
 */
function bootRhythmScene(session, clockNow) {
  vi.spyOn(RhythmScene, '_nowMs').mockImplementation(() => clockNow.value);

  const scene = new RhythmScene();
  const canvas = createCountingCanvas();
  scene.game = { canvas };
  scene.sound = { context: { state: 'running', resume: vi.fn() } };
  scene.scene = { start: vi.fn() };
  scene.events = { on: vi.fn(), off: vi.fn() };

  scene.init({ session });
  scene.create();

  // Drive the recognizer's judged-moment clock from the same shared holder so a
  // gesture's startTime equals the frame's sampled input time (mapped == target).
  scene.recognizer._now = () => clockNow.value;

  return { scene, canvas };
}

/**
 * Resolve a single tap expectation as a `perfect` hit: anchor the clock at the
 * expectation target, open its window, feed a scripted tap via the synthetic
 * pointer API, then judge it on the next frame.
 * @param {RhythmScene} scene - The booted scene.
 * @param {{ targetMs: number }} expectation - The resolved expectation.
 * @param {{ value: number }} clockNow - Shared clock holder.
 * @param {number} clockValue - The clock value to hold across this resolution.
 */
function resolvePerfectTap(scene, expectation, clockNow, clockValue) {
  clockNow.value = clockValue;
  scene.audioManager.currentTime = expectation.targetMs;

  // Frame 1: sync the input anchor + open the expectation window.
  scene.update(clockValue, 16);

  // Feed a scripted tap (down + up at the same point => zero movement/duration).
  scene.recognizer._onDown({ pointerId: 1, clientX: 360, clientY: 640 });
  scene.recognizer._onUp({ pointerId: 1, clientX: 360, clientY: 640 });

  // Frame 2: consume + judge the buffered gesture against the open window.
  scene.update(clockValue, 16);
}

describe('Rhythm prototype flow (load -> play -> result)', () => {
  /** @type {import('../../src/rhythm/minigames/MinigameRegistry.js').default} */
  let registry;
  /** @type {import('../../src/types.js').MinigameDefinition} */
  let definition;

  beforeAll(async () => {
    registry = createDefaultMinigameRegistry();
    definition = await registry.loadDefinition(MINIGAME_ID, createFileBackedFetch());
  });

  beforeEach(() => {
    audioState.managers.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the RhythmSession + asset manifest and transitions to RhythmScene (R12.3, R12.4)', async () => {
    const controllerClass = registry.getControllerClass(MINIGAME_ID);
    expect(controllerClass).toBe(TapClapGame);

    const prepareCallback = buildRhythmPrepareCallback(definition, controllerClass);
    const { scene } = createLoadingHarness(prepareCallback);

    scene.preload();
    scene.create();
    await flush();
    scene.update(0, 16);

    // R12.4: LoadingState started RhythmScene with the built session.
    expect(scene.scene.start).toHaveBeenCalledTimes(1);
    const [nextScene, data] = scene.scene.start.mock.calls[0];
    expect(nextScene).toBe('RhythmScene');
    expect(data.session).toBeInstanceOf(RhythmSession);

    // R12.3: the session carries the loaded definition + resolved controller.
    expect(data.session.definition.id).toBe(MINIGAME_ID);
    expect(data.session.controllerClass).toBe(TapClapGame);

    // R12.3: the asset manifest was built from the definition assets + backing
    // instrumental (all reused committed assets).
    const manifest = scene.assets;
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.some((entry) => entry.type === 'atlas' && entry.key === 'bf')).toBe(true);
    expect(manifest.some((entry) => entry.type === 'image' && entry.key === 'popup-sick')).toBe(true);
    expect(manifest.some((entry) => entry.type === 'audio' && entry.key === 'rhythm-inst-tutorial')).toBe(
      true
    );
  });

  it('plays a full run to ResultState with the scoring summary and tears down listeners (R12.5, R16.1)', () => {
    const controllerClass = registry.getControllerClass(MINIGAME_ID);
    const session = buildRhythmSession(definition, controllerClass);

    const clockNow = { value: 0 };
    const { scene, canvas } = bootRhythmScene(session, clockNow);

    // create() attached the recognizer's pointer listeners plus the raw
    // audio-unlock listeners on the canvas.
    expect(canvas.listenerCount()).toBeGreaterThan(0);
    expect(scene.controller).toBeInstanceOf(TapClapGame);

    // The tap-clap timeline resolves to four tap expectations in target order.
    const expectations = scene.timeline.expectations;
    expect(expectations).toHaveLength(4);

    // Feed a scripted perfect tap for each expectation via the synthetic API.
    expectations.forEach((expectation, index) => {
      resolvePerfectTap(scene, expectation, clockNow, 100000 + index * 1000);
    });

    // R12.5: every tap was judged and recorded by the framework.
    const counts = scene.scoring.summary().counts;
    expect(counts.perfect).toBe(4);
    expect(counts.miss).toBe(0);
    expect(counts.wrong).toBe(0);

    // Advance past the last timeline event so the run completes.
    const lastCloseMs = Math.max(...expectations.map((expectation) => expectation.windowCloseMs));
    clockNow.value = 900000;
    scene.audioManager.currentTime = lastCloseMs + 100;
    scene.update(clockNow.value, 16);

    // R12.5: the run reached ResultState with the RhythmScoring summary.
    expect(scene.scene.start).toHaveBeenCalledTimes(1);
    const [resultScene, payload] = scene.scene.start.mock.calls[0];
    expect(resultScene).toBe('ResultState');
    expect(payload.resultBand).toBe('Superb');
    expect(payload.accuracy).toBe(100);
    expect(payload.score).toBeGreaterThan(0);
    expect(payload.rhythmSummary.counts.perfect).toBe(4);
    expect(payload.songData.songName).toBe(definition.name);

    // R16.1 / Property 7: shutdown detaches the recognizer so zero pointer (and
    // audio-unlock) listeners remain on the canvas.
    const detachSpy = vi.spyOn(scene.recognizer, 'detach');
    scene.shutdown();

    expect(detachSpy).toHaveBeenCalledTimes(1);
    expect(canvas.listenerCount()).toBe(0);
    expect(scene.recognizer).toBeNull();
  });
});

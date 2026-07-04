/**
 * @fileoverview Unit tests for MinigameSelectState (task 14).
 *
 * Covers R12.1 (lists the four loaded definitions), R12.2 (select transitions to
 * LoadingState via the Transitions helper), and R12.3/R12.4 (the prepareCallback
 * builds a valid RhythmSession and targets RhythmScene).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RhythmSession from '../src/rhythm/core/RhythmSession.js';

vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setInteractive: vi.fn(function () {
      this.input = { hitArea: { width: 200, height: 40 } };
      return this;
    }),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    input: null
  };

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.scene = { key: config.key, start: vi.fn() };
          this.add = {
            text: vi.fn(() => ({ ...mockText })),
            sprite: vi.fn(() => ({ setDisplaySize: vi.fn().mockReturnThis() })),
            graphics: vi.fn(() => ({
              fillStyle: vi.fn().mockReturnThis(),
              fillRect: vi.fn().mockReturnThis(),
              fillGradientStyle: vi.fn().mockReturnThis()
            }))
          };
          this.cameras = {
            main: {
              width: 720,
              height: 1280,
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn((event, cb) => cb())
            }
          };
          this.input = { keyboard: { on: vi.fn(), off: vi.fn() } };
          this.sound = {
            play: vi.fn(),
            context: { state: 'suspended', resume: vi.fn(() => Promise.resolve()) }
          };
          this.cache = { audio: { exists: vi.fn(() => false) } };
          this.textures = { exists: vi.fn(() => false) };
          this.load = { image: vi.fn(), audio: vi.fn() };
          this.game = { canvas: null };
        }
      }
    }
  };
});

import MinigameSelectState, { MINIGAME_IDS } from '../src/rhythm/ui/MinigameSelectState.js';

/** Build a stub definition for a given id. */
function stubDefinition(id) {
  return {
    version: '1.0.0',
    id,
    name: `Game ${id}`,
    movementType: 'tap',
    song: { id: `${id}-song` },
    bpm: 120,
    assets: [],
    input: { allowedGestures: ['tap'] },
    scoring: { windowMs: { perfect: 45, good: 90, barely: 140 } },
    timeline: [{ id: `${id}-e1`, type: 'expect', beat: 4, gesture: 'tap', targetBeat: 4 }]
  };
}

class StubController {}

describe('MinigameSelectState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    scene = new MinigameSelectState();

    // Substitute the registry so definitions load without fetch/network.
    scene.minigameRegistry = {
      loadDefinition: vi.fn(async (id) => stubDefinition(id)),
      getControllerClass: vi.fn(() => StubController)
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the scene with the correct key', () => {
    expect(scene.scene.key).toBe('MinigameSelectState');
  });

  it('offers the four movement-type minigames', () => {
    expect([...scene.minigameIds]).toEqual(['tap-clap', 'fill-bot', 'release-cue', 'flick-rally']);
    expect([...MINIGAME_IDS]).toHaveLength(4);
  });

  it('lists the four loaded definitions (R12.1)', async () => {
    scene.create();
    await scene.loadingPromise;

    expect(scene.minigameRegistry.loadDefinition).toHaveBeenCalledTimes(4);
    expect(scene.definitions).toHaveLength(4);
    expect(scene.minigameTexts).toHaveLength(4);
    expect(scene.getItemCount()).toBe(4);
  });

  it('skips definitions that fail to load but lists the rest', async () => {
    scene.minigameRegistry.loadDefinition = vi.fn(async (id) => {
      if (id === 'fill-bot') {
        throw new Error('boom');
      }
      return stubDefinition(id);
    });

    scene.create();
    await scene.loadingPromise;

    expect(scene.definitions.map((d) => d.id)).toEqual(['tap-clap', 'release-cue', 'flick-rally']);
  });

  it('transitions to LoadingState with a prepareCallback targeting RhythmScene (R12.2)', async () => {
    scene.create();
    await scene.loadingPromise;

    scene.selectedIndex = 1;
    const transitionSpy = vi.spyOn(scene, 'transitionToScene').mockResolvedValue(undefined);

    scene.executeSelection();

    expect(transitionSpy).toHaveBeenCalledWith(
      'LoadingState',
      expect.objectContaining({
        nextScene: 'RhythmScene',
        minigameId: 'fill-bot',
        prepareCallback: expect.any(Function)
      })
    );
    // R12.2: unlocking audio on the user gesture.
    expect(scene.sound.context.resume).toHaveBeenCalled();
  });

  it('prepareCallback builds a valid RhythmSession for the selected minigame (R12.3/R12.4)', async () => {
    scene.create();
    await scene.loadingPromise;

    scene.selectedIndex = 0;
    const transitionSpy = vi.spyOn(scene, 'transitionToScene').mockResolvedValue(undefined);
    scene.executeSelection();

    const loadingConfig = transitionSpy.mock.calls[0][1];
    const prepared = await loadingConfig.prepareCallback();

    expect(prepared.nextScene).toBe('RhythmScene');
    expect(prepared.nextSceneData.session).toBeInstanceOf(RhythmSession);
    expect(prepared.nextSceneData.session.id).toBe('tap-clap');
    expect(prepared.nextSceneData.session.controllerClass).toBe(StubController);
    expect(prepared.assets.map((a) => a.key)).toContain('rhythm-inst-tap-clap-song');
  });

  it('executeBack returns to the main menu', () => {
    const transitionSpy = vi.spyOn(scene, 'transitionToScene').mockResolvedValue(undefined);
    scene.executeBack();
    expect(transitionSpy).toHaveBeenCalledWith('MainMenuState');
  });

  it('cleans up list texts on shutdown', async () => {
    scene.create();
    await scene.loadingPromise;
    scene.shutdown();
    expect(scene.minigameTexts).toHaveLength(0);
  });
});

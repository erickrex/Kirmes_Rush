/**
 * @fileoverview Unit tests for LevelSelectState.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockedLevels = vi.hoisted(() => ([
  {
    id: 'level-1-basics', name: 'Level 1: Basics', description: 'Basics',
    songId: 'tutorial', difficulty: 'normal',
    features: {
      holdNotes: false, healthBar: false, characters: false, stage: false, cameraEffects: false,
      noteSplashes: false, comboPopups: false, expandedStats: false, replayRecording: false, inputBuffer: false
    },
    ui: { showScore: true, showCombo: true, showAccuracy: false, showMisses: false }
  },
  {
    id: 'level-2-rhythm', name: 'Level 2: Rhythm', description: 'Rhythm',
    songId: 'bopeebo', difficulty: 'normal',
    features: {
      holdNotes: true, healthBar: true, characters: false, stage: false, cameraEffects: false,
      noteSplashes: false, comboPopups: false, expandedStats: false, replayRecording: false, inputBuffer: false
    },
    ui: { showScore: true, showCombo: true, showAccuracy: false, showMisses: false }
  },
  {
    id: 'level-3-performance', name: 'Level 3: Performance', description: 'Performance',
    songId: 'fresh', difficulty: 'normal',
    features: {
      holdNotes: true, healthBar: true, characters: true, stage: true, cameraEffects: true,
      noteSplashes: false, comboPopups: false, expandedStats: false, replayRecording: false, inputBuffer: false
    },
    ui: { showScore: true, showCombo: true, showAccuracy: false, showMisses: false }
  },
  {
    id: 'level-4-challenge', name: 'Level 4: Challenge', description: 'Challenge',
    songId: 'blammed', difficulty: 'normal',
    features: {
      holdNotes: true, healthBar: true, characters: true, stage: true, cameraEffects: true,
      noteSplashes: true, comboPopups: true, expandedStats: true, replayRecording: false, inputBuffer: false
    },
    ui: { showScore: true, showCombo: true, showAccuracy: true, showMisses: true }
  },
  {
    id: 'level-5-mastery', name: 'Level 5: Mastery', description: 'Mastery',
    songId: 'stress', difficulty: 'hard',
    features: {
      holdNotes: true, healthBar: true, characters: true, stage: true, cameraEffects: true,
      noteSplashes: true, comboPopups: true, expandedStats: true, replayRecording: true, inputBuffer: true
    },
    ui: { showScore: true, showCombo: true, showAccuracy: true, showMisses: true }
  }
]));

vi.mock('../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    reset: vi.fn()
  },
  Events: {
    LEVEL_LOADED: 'levelLoaded'
  }
}));

vi.mock('../src/levels/LevelSystem.js', () => ({
  default: class MockLevelSystem {
    constructor() {
      this.levels = [...mockedLevels];
    }

    async loadManifests() {
      return true;
    }

    getAllLevels() {
      return [...this.levels];
    }
  }
}));

vi.mock('../src/levels/LevelSessionBuilder.js', () => ({
  default: class MockLevelSessionBuilder {
    async build(level) {
      return {
        level,
        assets: [],
        chart: { notes: { player: [], opponent: [] }, scrollSpeed: 1, events: [], timeChanges: [] },
        songData: { songName: level.songId, difficulty: level.difficulty }
      };
    }
  }
}));

vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    destroy: vi.fn()
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
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn((event, cb) => cb())
            }
          };
          this.input = {
            keyboard: { on: vi.fn(), off: vi.fn() }
          };
          this.sound = {
            play: vi.fn(),
            context: {
              state: 'suspended',
              resume: vi.fn(() => Promise.resolve())
            }
          };
          this.cache = {
            audio: { exists: vi.fn(() => false) }
          };
          this.textures = {
            exists: vi.fn(() => false)
          };
          this.load = {
            setPath: vi.fn(),
            image: vi.fn(),
            audio: vi.fn()
          };
        }
      }
    }
  };
});

import LevelSelectState from '../src/ui/LevelSelectState.js';

describe('LevelSelectState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new LevelSelectState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads exactly 5 levels and makes them selectable immediately', async () => {
    scene.create();
    await Promise.resolve();

    expect(scene.levels).toHaveLength(5);
    expect(scene.levelTexts).toHaveLength(5);
    expect(scene.getItemCount()).toBe(5);
  });

  it('displays the manifest difficulty for the selected level', async () => {
    scene.create();
    await Promise.resolve();
    scene.selectedIndex = 4;
    scene.updateSelection();

    expect(scene.difficultyText.setText).toHaveBeenCalledWith('Difficulty: HARD');
  });

  it('starts LoadingState with the selected level id', async () => {
    scene.create();
    await Promise.resolve();
    scene.selectedIndex = 2;
    const transitionSpy = vi.spyOn(scene, 'transitionToScene');

    await scene.executeSelection();

    expect(transitionSpy).toHaveBeenCalledWith(
      'LoadingState',
      expect.objectContaining({
        nextScene: 'PlayState',
        prepareCallback: expect.any(Function)
      })
    );

    const loadingConfig = transitionSpy.mock.calls[0][1];
    const prepared = await loadingConfig.prepareCallback();
    expect(prepared.nextSceneData).toEqual({
      levelId: 'level-3-performance',
      session: expect.objectContaining({
        level: expect.objectContaining({ id: 'level-3-performance' })
      })
    });
    expect(scene.sound.context.resume).toHaveBeenCalledTimes(1);
  });
});

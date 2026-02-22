/**
 * @fileoverview Unit tests for ResultState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Scoring
vi.mock('../src/play/Scoring.js', () => ({
  default: {
    calculateRank: vi.fn(() => 'GREAT')
  }
}));

// Mock Phaser
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    alpha: 0,
    destroy: vi.fn()
  };

  const mockSprite = {
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    y: 0,
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
            sprite: vi.fn(() => ({ ...mockSprite })),
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
            add: vi.fn(() => ({
              play: vi.fn(),
              stop: vi.fn(),
              isPlaying: false
            }))
          };
          this.cache = {
            audio: { exists: vi.fn(() => false) }
          };
          this.textures = {
            exists: vi.fn(() => false)
          };
          this.time = {
            delayedCall: vi.fn((delay, cb) => { cb(); return { remove: vi.fn() }; })
          };
          this.tweens = {
            add: vi.fn(() => ({ stop: vi.fn() })),
            addCounter: vi.fn((config) => {
              if (config.onComplete) config.onComplete();
              return { stop: vi.fn() };
            }),
            killAll: vi.fn()
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

import ResultState from '../src/ui/ResultState.js';

describe('ResultState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new ResultState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('ResultState');
    });

    it('should initialize with score at 0', () => {
      expect(scene.score).toBe(0);
    });

    it('should initialize with displayedScore at 0', () => {
      expect(scene.displayedScore).toBe(0);
    });

    it('should initialize with transitioning as false', () => {
      expect(scene.transitioning).toBe(false);
    });

    it('should initialize with scoreAnimationComplete as false', () => {
      expect(scene.scoreAnimationComplete).toBe(false);
    });
  });

  describe('Init Method', () => {
    it('should accept score', () => {
      scene.init({ score: 12345 });
      expect(scene.score).toBe(12345);
    });

    it('should accept tallies', () => {
      const tallies = { sick: 100, good: 50, bad: 10, shit: 5, missed: 2 };
      scene.init({ tallies });
      expect(scene.tallies.sick).toBe(100);
      expect(scene.tallies.good).toBe(50);
    });

    it('should accept rank', () => {
      scene.init({ rank: 'PERFECT' });
      expect(scene.rank).toBe('PERFECT');
    });

    it('should accept song data', () => {
      const songData = { songName: 'Test Song', difficulty: 'hard' };
      scene.init({ songData });
      expect(scene.songData).toEqual(songData);
    });

    it('should reset displayedScore on init', () => {
      scene.displayedScore = 1000;
      scene.init({ score: 5000 });
      expect(scene.displayedScore).toBe(0);
    });
  });

  describe('Tallies', () => {
    it('should have default tally structure', () => {
      expect(scene.tallies).toHaveProperty('sick');
      expect(scene.tallies).toHaveProperty('good');
      expect(scene.tallies).toHaveProperty('bad');
      expect(scene.tallies).toHaveProperty('shit');
      expect(scene.tallies).toHaveProperty('missed');
      expect(scene.tallies).toHaveProperty('maxCombo');
    });
  });

  describe('Accuracy Calculation', () => {
    beforeEach(() => {
      scene.init({});
    });

    it('should calculate 100% accuracy for perfect score', () => {
      scene.tallies.totalNotesHit = 100;
      scene.tallies.totalNotes = 100;
      expect(scene.calculateAccuracy()).toBe(100);
    });

    it('should calculate 50% accuracy correctly', () => {
      scene.tallies.totalNotesHit = 50;
      scene.tallies.totalNotes = 100;
      expect(scene.calculateAccuracy()).toBe(50);
    });

    it('should return 0 for no notes', () => {
      scene.tallies.totalNotesHit = 0;
      scene.tallies.totalNotes = 0;
      expect(scene.calculateAccuracy()).toBe(0);
    });
  });

  describe('Rank Colors', () => {
    beforeEach(() => {
      scene.init({});
    });

    it('should return gold colors for PERFECT rank', () => {
      scene.rank = 'PERFECT';
      const colors = scene.getRankColors();
      expect(colors.top).toBe(0xffd700);
    });

    it('should return green colors for EXCELLENT rank', () => {
      scene.rank = 'EXCELLENT';
      const colors = scene.getRankColors();
      expect(colors.top).toBe(0x00ff00);
    });

    it('should return blue colors for GREAT rank', () => {
      scene.rank = 'GREAT';
      const colors = scene.getRankColors();
      expect(colors.top).toBe(0x00bfff);
    });

    it('should return purple colors for GOOD rank', () => {
      scene.rank = 'GOOD';
      const colors = scene.getRankColors();
      expect(colors.top).toBe(0x9370db);
    });

    it('should return gray colors for other ranks', () => {
      scene.rank = 'LOSS';
      const colors = scene.getRankColors();
      expect(colors.top).toBe(0x2f2f2f);
    });
  });

  describe('Rank Text Colors', () => {
    beforeEach(() => {
      scene.init({});
    });

    it('should return correct color for PERFECT', () => {
      scene.rank = 'PERFECT';
      expect(scene.getRankTextColor()).toBe('#ffd700');
    });

    it('should return correct color for EXCELLENT', () => {
      scene.rank = 'EXCELLENT';
      expect(scene.getRankTextColor()).toBe('#00ff00');
    });

    it('should return gray for unknown rank', () => {
      scene.rank = 'UNKNOWN';
      expect(scene.getRankTextColor()).toBe('#888888');
    });
  });

  describe('Continue Handling', () => {
    beforeEach(() => {
      scene.init({ score: 1000 });
      scene.create();
    });

    it('should skip animation if not complete', () => {
      scene.scoreAnimationComplete = false;
      const spy = vi.spyOn(scene, 'onScoreAnimationComplete');
      scene.onContinue();
      expect(spy).toHaveBeenCalled();
    });

    it('should set transitioning when animation complete', () => {
      scene.scoreAnimationComplete = true;
      scene.onContinue();
      expect(scene.transitioning).toBe(true);
    });

    it('should not continue if already transitioning', () => {
      scene.transitioning = true;
      scene.scoreAnimationComplete = true;
      const spy = vi.spyOn(scene.cameras.main, 'fadeOut');
      scene.onContinue();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('UI Elements', () => {
    beforeEach(() => {
      scene.init({ score: 5000, tallies: { maxCombo: 50 } });
      scene.create();
    });

    it('should create score text', () => {
      expect(scene.scoreText).toBeDefined();
    });

    it('should create accuracy text', () => {
      expect(scene.accuracyText).toBeDefined();
    });

    it('should create continue text', () => {
      expect(scene.continueText).toBeDefined();
    });

    it('should create tally texts', () => {
      expect(scene.tallyTexts).toBeDefined();
      expect(scene.tallyTexts.length).toBeGreaterThan(0);
    });
  });

  describe('Return Scene', () => {
    it('should default to FreeplayState', () => {
      scene.init({});
      expect(scene.songData?.returnScene).toBeUndefined();
    });

    it('should use provided return scene', () => {
      scene.init({ songData: { returnScene: 'StoryMenuState' } });
      expect(scene.songData.returnScene).toBe('StoryMenuState');
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.init({ score: 1000 });
      scene.create();
      scene.shutdown();

      expect(scene.scoreText).toBeNull();
      expect(scene.rankText).toBeNull();
      expect(scene.accuracyText).toBeNull();
      expect(scene.continueText).toBeNull();
      expect(scene.tallyTexts.length).toBe(0);
      expect(scene.songData).toBeNull();
    });
  });
});

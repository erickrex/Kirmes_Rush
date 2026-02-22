/**
 * @fileoverview Unit tests for StoryMenuState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser
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
              fillRoundedRect: vi.fn().mockReturnThis(),
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
            play: vi.fn()
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

import StoryMenuState from '../src/ui/StoryMenuState.js';

describe('StoryMenuState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new StoryMenuState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('StoryMenuState');
    });

    it('should have weeks defined', () => {
      expect(scene.weeks).toBeDefined();
      expect(scene.weeks.length).toBeGreaterThan(0);
    });

    it('should have tutorial as first week', () => {
      expect(scene.weeks[0].id).toBe('tutorial');
    });

    it('should initialize with selectedWeekIndex at 0', () => {
      expect(scene.selectedWeekIndex).toBe(0);
    });

    it('should initialize with selectedDifficultyIndex at 1 (normal)', () => {
      expect(scene.selectedDifficultyIndex).toBe(1);
    });
  });

  describe('Week Data', () => {
    it('should have tracks for each week', () => {
      scene.weeks.forEach(week => {
        expect(week.tracks).toBeDefined();
        expect(week.tracks.length).toBeGreaterThan(0);
      });
    });

    it('should have difficulties for each week', () => {
      scene.weeks.forEach(week => {
        expect(week.difficulties).toBeDefined();
        expect(week.difficulties.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Week Navigation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should navigate down through weeks', () => {
      scene.onNavigateDown();
      expect(scene.selectedWeekIndex).toBe(1);
    });

    it('should wrap around when navigating down past last week', () => {
      scene.selectedWeekIndex = scene.weeks.length - 1;
      scene.onNavigateDown();
      expect(scene.selectedWeekIndex).toBe(0);
    });

    it('should navigate up through weeks', () => {
      scene.selectedWeekIndex = 1;
      scene.onNavigateUp();
      expect(scene.selectedWeekIndex).toBe(0);
    });

    it('should not navigate when transitioning', () => {
      scene.transitioning = true;
      const initialIndex = scene.selectedWeekIndex;
      scene.onNavigateDown();
      expect(scene.selectedWeekIndex).toBe(initialIndex);
    });
  });

  describe('Difficulty Navigation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should change difficulty right', () => {
      scene.selectedDifficultyIndex = 0;
      scene.onDifficultyRight();
      expect(scene.selectedDifficultyIndex).toBe(1);
    });

    it('should change difficulty left', () => {
      scene.selectedDifficultyIndex = 1;
      scene.onDifficultyLeft();
      expect(scene.selectedDifficultyIndex).toBe(0);
    });
  });

  describe('Week Selection', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should set transitioning on select', () => {
      scene.onSelect();
      expect(scene.transitioning).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.create();
      scene.shutdown();
      expect(scene.weekTexts.length).toBe(0);
      expect(scene.trackListText).toBeNull();
    });
  });
});

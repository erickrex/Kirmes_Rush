/**
 * @fileoverview Unit tests for PauseSubState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock EventBus
vi.mock('../src/core/EventBus.js', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    reset: vi.fn()
  },
  Events: {
    PAUSE: 'pause',
    RESUME: 'resume'
  }
}));

// Mock Phaser
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    visible: true,
    destroy: vi.fn()
  };

  const mockContainer = {
    setVisible: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis(),
    visible: false,
    destroy: vi.fn()
  };

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.scene = {
            key: config.key,
            start: vi.fn(),
            stop: vi.fn(),
            resume: vi.fn()
          };
          this.add = {
            text: vi.fn(() => ({ ...mockText })),
            graphics: vi.fn(() => ({
              fillStyle: vi.fn().mockReturnThis(),
              fillRect: vi.fn().mockReturnThis(),
              fillRoundedRect: vi.fn().mockReturnThis()
            })),
            container: vi.fn(() => ({ ...mockContainer }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
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
          this.load = {
            setPath: vi.fn(),
            audio: vi.fn()
          };
        }
      }
    }
  };
});

import PauseSubState from '../src/ui/PauseSubState.js';
import EventBus, { Events } from '../src/core/EventBus.js';

describe('PauseSubState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new PauseSubState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('PauseSubState');
    });

    it('should have options defined', () => {
      expect(scene.options).toBeDefined();
      expect(scene.options.length).toBeGreaterThan(0);
    });

    it('should have Resume, Restart, Change Difficulty, Exit options', () => {
      const names = scene.options.map(opt => opt.name);
      expect(names).toContain('Resume');
      expect(names).toContain('Restart Song');
      expect(names).toContain('Change Difficulty');
      expect(names).toContain('Exit to Menu');
    });

    it('should initialize with selectedIndex at 0', () => {
      expect(scene.selectedIndex).toBe(0);
    });

    it('should initialize with difficultyMode as false', () => {
      expect(scene.difficultyMode).toBe(false);
    });
  });

  describe('Init Method', () => {
    it('should accept parent scene key', () => {
      scene.init({ parentScene: 'TestPlayState' });
      expect(scene.parentSceneKey).toBe('TestPlayState');
    });

    it('should accept song data', () => {
      const songData = { songId: 'test', difficulty: 'hard' };
      scene.init({ songData });
      expect(scene.songData).toEqual(songData);
    });

    it('should default parent scene to PlayState', () => {
      scene.init({});
      expect(scene.parentSceneKey).toBe('PlayState');
    });
  });

  describe('Menu Navigation', () => {
    beforeEach(() => {
      scene.init({});
      scene.create();
    });

    it('should navigate down through options', () => {
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(1);
    });

    it('should wrap around when navigating down past last option', () => {
      scene.selectedIndex = scene.options.length - 1;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(0);
    });

    it('should not navigate when transitioning', () => {
      scene.transitioning = true;
      const initialIndex = scene.selectedIndex;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(initialIndex);
    });
  });

  describe('Menu Actions', () => {
    beforeEach(() => {
      scene.init({ parentScene: 'PlayState' });
      scene.create();
    });

    it('should execute resume action', () => {
      const spy = vi.spyOn(scene, 'resumeGame');
      scene.executeAction('resume');
      expect(spy).toHaveBeenCalled();
    });

    it('should execute restart action', () => {
      const spy = vi.spyOn(scene, 'restartSong');
      scene.executeAction('restart');
      expect(spy).toHaveBeenCalled();
    });

    it('should show difficulty selector', () => {
      scene.executeAction('difficulty');
      expect(scene.difficultyMode).toBe(true);
    });
  });

  describe('Resume Game', () => {
    beforeEach(() => {
      scene.init({ parentScene: 'PlayState' });
      scene.create();
    });

    it('should set transitioning to true', () => {
      scene.resumeGame();
      expect(scene.transitioning).toBe(true);
    });

    it('should emit RESUME event', () => {
      scene.resumeGame();
      expect(EventBus.emit).toHaveBeenCalledWith(Events.RESUME);
    });
  });

  describe('Difficulty Selector', () => {
    beforeEach(() => {
      scene.init({});
      scene.create();
    });

    it('should show difficulty selector', () => {
      scene.showDifficultySelector();
      expect(scene.difficultyMode).toBe(true);
    });

    it('should hide difficulty selector', () => {
      scene.showDifficultySelector();
      scene.hideDifficultySelector();
      expect(scene.difficultyMode).toBe(false);
    });

    it('should hide selector on back when in difficulty mode', () => {
      scene.showDifficultySelector();
      scene.onBack();
      expect(scene.difficultyMode).toBe(false);
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      scene.init({});
    });

    it('should emit PAUSE event on create', () => {
      scene.create();
      expect(EventBus.emit).toHaveBeenCalledWith(Events.PAUSE);
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.init({});
      scene.create();
      scene.shutdown();
      expect(scene.optionTexts.length).toBe(0);
      expect(scene.overlay).toBeNull();
      expect(scene.songData).toBeNull();
    });
  });
});

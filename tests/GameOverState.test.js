/**
 * @fileoverview Unit tests for GameOverState
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
    RETRY: 'retry'
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
    play: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
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
              fillRect: vi.fn().mockReturnThis()
            }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              setBackgroundColor: vi.fn(),
              fadeOut: vi.fn(),
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
            })),
            play: vi.fn()
          };
          this.cache = {
            audio: { exists: vi.fn(() => false) }
          };
          this.textures = {
            exists: vi.fn(() => false)
          };
          this.anims = {
            exists: vi.fn(() => false),
            create: vi.fn(),
            generateFrameNumbers: vi.fn(() => [])
          };
          this.time = {
            delayedCall: vi.fn((delay, cb) => { cb(); return { remove: vi.fn() }; })
          };
          this.tweens = {
            add: vi.fn(() => ({ stop: vi.fn() }))
          };
          this.load = {
            setPath: vi.fn(),
            spritesheet: vi.fn(),
            audio: vi.fn()
          };
        }
      }
    }
  };
});

import GameOverState from '../src/ui/GameOverState.js';
import EventBus, { Events } from '../src/core/EventBus.js';

describe('GameOverState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new GameOverState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('GameOverState');
    });

    it('should initialize with confirmed as false', () => {
      expect(scene.confirmed).toBe(false);
    });

    it('should initialize with transitioning as false', () => {
      expect(scene.transitioning).toBe(false);
    });

    it('should initialize with phase as initial', () => {
      expect(scene.phase).toBe('initial');
    });
  });

  describe('Init Method', () => {
    it('should accept song data', () => {
      const songData = { songId: 'test', difficulty: 'hard' };
      scene.init({ songData });
      expect(scene.songData).toEqual(songData);
    });

    it('should accept character position', () => {
      const position = { x: 100, y: 200 };
      scene.init({ position });
      expect(scene.characterPosition).toEqual(position);
    });

    it('should default position to center', () => {
      scene.init({});
      expect(scene.characterPosition).toEqual({ x: 640, y: 360 });
    });

    it('should reset state on init', () => {
      scene.confirmed = true;
      scene.transitioning = true;
      scene.phase = 'loop';

      scene.init({});

      expect(scene.confirmed).toBe(false);
      expect(scene.transitioning).toBe(false);
      expect(scene.phase).toBe('initial');
    });
  });

  describe('Death Sequence', () => {
    beforeEach(() => {
      scene.init({});
      scene.create();
    });

    it('should create death sprite', () => {
      expect(scene.bfDead).toBeDefined();
    });

    it('should transition to loop phase after initial animation', () => {
      scene.onInitialAnimationComplete();
      expect(scene.phase).toBe('loop');
    });
  });

  describe('Retry Handling', () => {
    beforeEach(() => {
      scene.init({ songData: { songId: 'test' } });
      scene.create();
      scene.phase = 'loop';
    });

    it('should not retry during initial phase', () => {
      scene.phase = 'initial';
      scene.onRetry();
      expect(scene.confirmed).toBe(false);
    });

    it('should set confirmed to true on retry', () => {
      scene.onRetry();
      expect(scene.confirmed).toBe(true);
    });

    it('should set phase to confirm on retry', () => {
      scene.onRetry();
      expect(scene.phase).toBe('confirm');
    });

    it('should emit RETRY event', () => {
      scene.onRetry();
      expect(EventBus.emit).toHaveBeenCalledWith(Events.RETRY);
    });

    it('should not retry if already confirmed', () => {
      scene.confirmed = true;
      const initialPhase = scene.phase;
      scene.onRetry();
      expect(scene.phase).toBe(initialPhase);
    });
  });

  describe('Exit Handling', () => {
    beforeEach(() => {
      scene.init({});
      scene.create();
      scene.phase = 'loop';
    });

    it('should not exit during initial phase', () => {
      scene.phase = 'initial';
      scene.onExit();
      expect(scene.transitioning).toBe(false);
    });

    it('should set transitioning to true on exit', () => {
      scene.onExit();
      expect(scene.transitioning).toBe(true);
    });
  });

  describe('UI Elements', () => {
    beforeEach(() => {
      scene.init({});
      scene.create();
    });

    it('should create retry text', () => {
      expect(scene.retryText).toBeDefined();
    });

    it('should create exit text', () => {
      expect(scene.exitText).toBeDefined();
    });

    it('should create game over text', () => {
      expect(scene.gameOverText).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.init({});
      scene.create();
      scene.shutdown();

      expect(scene.bfDead).toBeNull();
      expect(scene.retryText).toBeNull();
      expect(scene.exitText).toBeNull();
      expect(scene.songData).toBeNull();
    });
  });
});

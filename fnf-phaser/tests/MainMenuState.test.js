/**
 * @fileoverview Unit tests for MainMenuState
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
  Events: {}
}));

// Mock Phaser before importing MainMenuState
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    visible: true,
    alpha: 1,
    destroy: vi.fn()
  };

  const mockSprite = {
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
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
              fillGradientStyle: vi.fn().mockReturnThis(),
              destroy: vi.fn()
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
            keyboard: {
              on: vi.fn(),
              off: vi.fn(),
              emit: vi.fn()
            }
          };
          this.sound = {
            add: vi.fn(() => ({
              play: vi.fn(),
              stop: vi.fn(),
              isPlaying: false
            })),
            get: vi.fn(),
            play: vi.fn()
          };
          this.cache = {
            audio: {
              exists: vi.fn(() => false)
            }
          };
          this.textures = {
            exists: vi.fn(() => false)
          };
          this.tweens = {
            add: vi.fn(() => ({ stop: vi.fn() }))
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

import MainMenuState from '../src/ui/MainMenuState.js';

describe('MainMenuState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new MainMenuState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('MainMenuState');
    });

    it('should have menu items defined', () => {
      expect(scene.menuItems).toBeDefined();
      expect(scene.menuItems.length).toBeGreaterThan(0);
    });

    it('should expose only Levels and Options', () => {
      const names = scene.menuItems.map(item => item.name);
      expect(names).toContain('Levels');
      expect(names).toContain('Options');
      expect(names).toHaveLength(2);
    });

    it('should initialize with selectedIndex at 0', () => {
      expect(scene.selectedIndex).toBe(0);
    });

    it('should initialize with transitioning as false', () => {
      expect(scene.transitioning).toBe(false);
    });
  });

  describe('Menu Navigation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should navigate down correctly', () => {
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(1);
    });

    it('should wrap around when navigating down past last item', () => {
      scene.selectedIndex = scene.menuItems.length - 1;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(0);
    });

    it('should navigate up correctly', () => {
      scene.selectedIndex = 1;
      scene.onNavigateUp();
      expect(scene.selectedIndex).toBe(0);
    });

    it('should wrap around when navigating up past first item', () => {
      scene.selectedIndex = 0;
      scene.onNavigateUp();
      expect(scene.selectedIndex).toBe(scene.menuItems.length - 1);
    });

    it('should not navigate when transitioning', () => {
      scene.transitioning = true;
      const initialIndex = scene.selectedIndex;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(initialIndex);
    });
  });

  describe('Menu Selection', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should set transitioning to true on select', () => {
      scene.onSelect();
      expect(scene.transitioning).toBe(true);
    });

    it('should not select when already transitioning', () => {
      scene.transitioning = true;
      const initialTransitioning = scene.transitioning;
      scene.onSelect();
      expect(scene.transitioning).toBe(initialTransitioning);
    });
  });

  describe('Back Navigation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should set transitioning to true on back', () => {
      scene.onBack();
      expect(scene.transitioning).toBe(true);
    });

    it('should not go back when already transitioning', () => {
      scene.transitioning = true;
      const spy = vi.spyOn(scene, 'transitionToScene');
      scene.onBack();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Visual Updates', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should create menu text objects', () => {
      expect(scene.menuTexts).toBeDefined();
      expect(scene.menuTexts.length).toBe(scene.menuItems.length);
    });

    it('should update selection visual on navigate', () => {
      const spy = vi.spyOn(scene, 'updateSelection');
      scene.onNavigateDown();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Input Setup', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should setup UP key listener', () => {
      expect(scene.input.keyboard.on).toHaveBeenCalledWith(
        'keydown-UP',
        expect.any(Function),
        scene
      );
    });

    it('should setup DOWN key listener', () => {
      expect(scene.input.keyboard.on).toHaveBeenCalledWith(
        'keydown-DOWN',
        expect.any(Function),
        scene
      );
    });

    it('should setup ENTER key listener', () => {
      expect(scene.input.keyboard.on).toHaveBeenCalledWith(
        'keydown-ENTER',
        expect.any(Function),
        scene
      );
    });

    it('should setup ESC key listener', () => {
      expect(scene.input.keyboard.on).toHaveBeenCalledWith(
        'keydown-ESC',
        expect.any(Function),
        scene
      );
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.create();
      scene.shutdown();
      expect(scene.menuTexts.length).toBe(0);
    });
  });
});

/**
 * @fileoverview Unit tests for TitleState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser before importing TitleState
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
    x: 0,
    y: 0,
    originX: 0.5,
    originY: 0.5,
    text: 'Tap or Press Enter to start',
    destroy: vi.fn(),
    setInteractive: vi.fn(function() { this.input = { hitArea: { width: 200, height: 30 } }; return this; }),
    on: vi.fn().mockReturnThis(),
    input: null
  };

  const mockSprite = {
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    play: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
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
              setBackgroundColor: vi.fn(),
              flash: vi.fn(),
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              setAlpha: vi.fn(),
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
          this.anims = {
            exists: vi.fn(() => false),
            create: vi.fn(),
            generateFrameNumbers: vi.fn(() => [])
          };
          this.time = {
            delayedCall: vi.fn(() => ({ remove: vi.fn() }))
          };
          this.tweens = {
            add: vi.fn(() => ({ stop: vi.fn() })),
            killTweensOf: vi.fn()
          };
          this.load = {
            setPath: vi.fn(),
            image: vi.fn(),
            spritesheet: vi.fn(),
            audio: vi.fn()
          };
        }
      },
      Events: {
        EventEmitter: class MockEventEmitter {
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
          off(event, callback, context) {
            return this;
          }
          emit(event, ...args) {
            const eventListeners = this.listeners.get(event) || [];
            eventListeners.forEach((listener) => {
              listener.callback.apply(listener.context, args);
            });
            return this;
          }
          removeAllListeners() {
            this.listeners.clear();
            return this;
          }
          listenerCount(event) {
            return (this.listeners.get(event) || []).length;
          }
        }
      }
    }
  };
});

// Mock EventBus
vi.mock('../src/core/EventBus.js', () => {
  const listeners = new Map();
  return {
    default: {
      on: vi.fn((event, callback, context) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event).push({ callback, context });
      }),
      off: vi.fn((event, callback, context) => {
        listeners.delete(event);
      }),
      emit: vi.fn((event, ...args) => {
        const eventListeners = listeners.get(event) || [];
        eventListeners.forEach((listener) => {
          listener.callback.apply(listener.context, args);
        });
      }),
      listenerCount: vi.fn((event) => (listeners.get(event) || []).length),
      reset: vi.fn(() => listeners.clear())
    },
    Events: {
      BEAT_HIT: 'beatHit'
    }
  };
});

// Mock TouchDeviceDetector
vi.mock('../src/input/TouchDeviceDetector.js', () => ({
  default: {
    isTouch: vi.fn(() => false),
    detect: vi.fn(),
    reset: vi.fn()
  }
}));

import TitleState from '../src/ui/TitleState.js';
import EventBus, { Events } from '../src/core/EventBus.js';

describe('TitleState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    EventBus.reset();
    scene = new TitleState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('TitleState');
    });

    it('should initialize with correct default values', () => {
      expect(scene.pressEnterText).toBeNull();
      expect(scene.blinkTimer).toBe(0);
      expect(scene.promptVisible).toBe(true);
      expect(scene.blinkInterval).toBe(500);
    });

    it('should initialize with logo as null', () => {
      expect(scene.logo).toBeNull();
    });

    it('should initialize with transitioning as false', () => {
      expect(scene.transitioning).toBe(false);
    });

    it('should initialize with attractModeActive as false', () => {
      expect(scene.attractModeActive).toBe(false);
    });
  });

  describe('Create Method', () => {
    it('should create logo on create', () => {
      scene.create();
      expect(scene.logo).not.toBeNull();
    });

    it('should create press enter text on create', () => {
      scene.create();
      expect(scene.pressEnterText).not.toBeNull();
    });

    it('should setup input on create', () => {
      scene.create();
      expect(scene.input.keyboard.on).toHaveBeenCalledWith(
        'keydown-ENTER',
        expect.any(Function),
        scene
      );
    });

    it('should setup SPACE key listener', () => {
      scene.create();
      expect(scene.input.keyboard.on).toHaveBeenCalledWith(
        'keydown-SPACE',
        expect.any(Function),
        scene
      );
    });

    it('should start attract timer', () => {
      scene.create();
      expect(scene.attractTimer).toBeDefined();
    });

    it('should listen for beat events', () => {
      scene.create();
      expect(EventBus.on).toHaveBeenCalledWith(
        Events.BEAT_HIT,
        expect.any(Function),
        scene
      );
    });
  });

  describe('Blinking Animation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should toggle visibility after blink interval', () => {
      const initialVisible = scene.promptVisible;
      scene.update(0, 600);
      expect(scene.promptVisible).toBe(!initialVisible);
    });

    it('should reset blink timer after toggling', () => {
      scene.update(0, 600);
      expect(scene.blinkTimer).toBeLessThan(scene.blinkInterval);
    });

    it('should accumulate blink timer over multiple updates', () => {
      scene.update(0, 200);
      expect(scene.blinkTimer).toBe(200);

      scene.update(0, 200);
      expect(scene.blinkTimer).toBe(400);
    });

    it('should not toggle visibility if time is less than interval', () => {
      const initialVisible = scene.promptVisible;
      scene.update(0, 400);
      expect(scene.promptVisible).toBe(initialVisible);
    });
  });

  describe('Input Handling', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should set transitioning to true on enter', () => {
      scene.onEnterPressed();
      expect(scene.transitioning).toBe(true);
    });

    it('should not respond to enter when already transitioning', () => {
      scene.transitioning = true;
      const flashSpy = scene.cameras.main.flash;
      scene.onEnterPressed();
      expect(flashSpy).not.toHaveBeenCalled();
    });

    it('should flash camera on enter', () => {
      scene.onEnterPressed();
      expect(scene.cameras.main.flash).toHaveBeenCalled();
    });
  });

  describe('Attract Mode', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should enter attract mode', () => {
      scene.enterAttractMode();
      expect(scene.attractModeActive).toBe(true);
    });

    it('should exit attract mode', () => {
      scene.enterAttractMode();
      scene.exitAttractMode();
      expect(scene.attractModeActive).toBe(false);
    });

    it('should reset attract timer on input', () => {
      scene.enterAttractMode();
      scene.resetAttractTimer();
      expect(scene.attractModeActive).toBe(false);
    });
  });

  describe('Beat Hit Handler', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should handle beat hit for logo bump', () => {
      scene.onBeatHit({ beat: 1 });
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('Transition', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should transition to main menu', () => {
      scene.transitionToMainMenu();
      expect(scene.cameras.main.fadeOut).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should remove input listeners on shutdown', () => {
      scene.create();
      scene.shutdown();
      expect(scene.input.keyboard.off).toHaveBeenCalledWith(
        'keydown-ENTER',
        expect.any(Function),
        scene
      );
    });

    it('should remove beat hit listener on shutdown', () => {
      scene.create();
      scene.shutdown();
      expect(EventBus.off).toHaveBeenCalledWith(
        Events.BEAT_HIT,
        expect.any(Function),
        scene
      );
    });

    it('should clean up references on shutdown', () => {
      scene.create();
      scene.shutdown();
      expect(scene.logo).toBeNull();
      expect(scene.pressEnterText).toBeNull();
      expect(scene.attractTimer).toBeNull();
    });
  });
});

/**
 * @fileoverview Unit tests for Transitions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => {
  const mockGraphics = {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    fillPoints: vi.fn().mockReturnThis(),
    strokePoints: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    fillPath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setPosition: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    rotation: 0
  };

  return {
    default: {
      Scene: class MockScene {
        constructor() {
          this.add = {
            graphics: vi.fn(() => ({ ...mockGraphics }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn((event, callback) => callback()),
              zoom: 1,
              setZoom: vi.fn()
            }
          };
          this.tweens = {
            add: vi.fn((config) => {
              // Immediately call onComplete if provided
              if (config.onComplete) {
                setTimeout(() => config.onComplete(), 0);
              }
              return { stop: vi.fn() };
            })
          };
          this.time = {
            delayedCall: vi.fn((delay, callback) => {
              setTimeout(callback, 0);
            })
          };
        }
      },
      Math: {
        Between: vi.fn((min, max) => Math.floor((min + max) / 2)),
        FloatBetween: vi.fn((min, max) => (min + max) / 2),
        DegToRad: vi.fn((deg) => deg * Math.PI / 180)
      },
      Utils: {
        Array: {
          GetRandom: vi.fn((arr) => arr[0])
        }
      }
    }
  };
});

import Transitions, { TransitionType } from '../src/graphics/Transitions.js';

// Create mock scene factory
const createMockScene = () => {
  const mockGraphics = {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    fillPoints: vi.fn().mockReturnThis(),
    strokePoints: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    fillPath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setPosition: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    rotation: 0
  };

  return {
    add: {
      graphics: vi.fn(() => ({ ...mockGraphics }))
    },
    cameras: {
      main: {
        width: 1280,
        height: 720,
        fadeOut: vi.fn(),
        fadeIn: vi.fn(),
        once: vi.fn((event, callback) => callback()),
        zoom: 1,
        setZoom: vi.fn()
      }
    },
    tweens: {
      add: vi.fn((config) => {
        if (config.onComplete) {
          setTimeout(() => config.onComplete(), 0);
        }
        return { stop: vi.fn() };
      })
    },
    time: {
      delayedCall: vi.fn((delay, callback) => {
        setTimeout(callback, 0);
      })
    }
  };
};

describe('Transitions', () => {
  let scene;
  let transitions;

  beforeEach(() => {
    scene = createMockScene();
    transitions = new Transitions(scene);
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should store scene reference', () => {
      expect(transitions.scene).toBe(scene);
    });

    it('should initialize with default values', () => {
      expect(transitions.overlay).toBeNull();
      expect(transitions.transitioning).toBe(false);
      expect(transitions.currentTween).toBeNull();
      expect(transitions.stickers).toEqual([]);
    });
  });

  describe('TransitionType', () => {
    it('should have all transition types', () => {
      expect(TransitionType.FADE).toBe('fade');
      expect(TransitionType.FADE_WHITE).toBe('fadeWhite');
      expect(TransitionType.SLIDE_LEFT).toBe('slideLeft');
      expect(TransitionType.SLIDE_RIGHT).toBe('slideRight');
      expect(TransitionType.SLIDE_UP).toBe('slideUp');
      expect(TransitionType.SLIDE_DOWN).toBe('slideDown');
      expect(TransitionType.ZOOM_IN).toBe('zoomIn');
      expect(TransitionType.ZOOM_OUT).toBe('zoomOut');
      expect(TransitionType.STICKER).toBe('sticker');
      expect(TransitionType.PIXELATE).toBe('pixelate');
      expect(TransitionType.WIPE).toBe('wipe');
    });
  });

  describe('transitionOut', () => {
    it('should return a promise', () => {
      const result = transitions.transitionOut();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should use fade by default', async () => {
      await transitions.transitionOut();
      expect(scene.cameras.main.fadeOut).toHaveBeenCalled();
    });

    it('should use specified transition type', async () => {
      await transitions.transitionOut({ type: TransitionType.SLIDE_LEFT });
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('transitionIn', () => {
    it('should return a promise', () => {
      const result = transitions.transitionIn();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should use fade by default', async () => {
      await transitions.transitionIn();
      expect(scene.cameras.main.fadeIn).toHaveBeenCalled();
    });
  });

  describe('fadeTransition', () => {
    it('should fade out camera', () => {
      transitions.fadeTransition({ direction: 'out', duration: 500 });
      expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(500, 0, 0, 0);
    });

    it('should fade in camera', () => {
      transitions.fadeTransition({ direction: 'in', duration: 500 });
      expect(scene.cameras.main.fadeIn).toHaveBeenCalledWith(500, 0, 0, 0);
    });

    it('should use custom color', () => {
      transitions.fadeTransition({ direction: 'out', color: 0xffffff });
      expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(500, 255, 255, 255);
    });

    it('should call onComplete callback', () => {
      const onComplete = vi.fn();
      transitions.fadeTransition({ direction: 'out', onComplete });
      expect(scene.cameras.main.once).toHaveBeenCalled();
    });
  });

  describe('slideTransition', () => {
    it('should create overlay', () => {
      transitions.slideTransition({ type: TransitionType.SLIDE_LEFT, direction: 'out' });
      expect(scene.add.graphics).toHaveBeenCalled();
      expect(transitions.overlay).not.toBeNull();
    });

    it('should create tween for slide animation', () => {
      transitions.slideTransition({ type: TransitionType.SLIDE_LEFT, direction: 'out' });
      expect(scene.tweens.add).toHaveBeenCalled();
    });

    it('should handle slide right', () => {
      transitions.slideTransition({ type: TransitionType.SLIDE_RIGHT, direction: 'out' });
      expect(scene.tweens.add).toHaveBeenCalled();
    });

    it('should handle slide up', () => {
      transitions.slideTransition({ type: TransitionType.SLIDE_UP, direction: 'out' });
      expect(scene.tweens.add).toHaveBeenCalled();
    });

    it('should handle slide down', () => {
      transitions.slideTransition({ type: TransitionType.SLIDE_DOWN, direction: 'out' });
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('zoomTransition', () => {
    it('should create zoom tween', () => {
      transitions.zoomTransition({ type: TransitionType.ZOOM_IN, direction: 'out' });
      expect(scene.tweens.add).toHaveBeenCalled();
    });

    it('should also fade during zoom', () => {
      transitions.zoomTransition({ type: TransitionType.ZOOM_IN, direction: 'out' });
      expect(scene.cameras.main.fadeOut).toHaveBeenCalled();
    });

    it('should handle zoom out', () => {
      transitions.zoomTransition({ type: TransitionType.ZOOM_OUT, direction: 'out' });
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('stickerTransition', () => {
    it('should create stickers', async () => {
      await transitions.transitionOut({ type: TransitionType.STICKER, duration: 100 });
      expect(transitions.stickers.length).toBeGreaterThan(0);
    });

    it('should animate stickers', async () => {
      await transitions.transitionOut({ type: TransitionType.STICKER, duration: 100 });
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('stickerTransitionIn', () => {
    it('should animate stickers away', async () => {
      // First create stickers
      transitions.stickers = [
        { x: 100, y: 100, rotation: 0, destroy: vi.fn() },
        { x: 200, y: 200, rotation: 0, destroy: vi.fn() }
      ];

      transitions.stickerTransitionIn({ duration: 100, onComplete: vi.fn() });
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('wipeTransition', () => {
    it('should create overlay for wipe', () => {
      transitions.wipeTransition({ direction: 'out' });
      expect(scene.add.graphics).toHaveBeenCalled();
    });

    it('should animate scale for wipe out', () => {
      transitions.wipeTransition({ direction: 'out' });
      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          scaleX: 1
        })
      );
    });

    it('should animate scale for wipe in', () => {
      transitions.wipeTransition({ direction: 'in' });
      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          scaleX: 0
        })
      );
    });
  });

  describe('pixelateTransition', () => {
    it('should fallback to fade', () => {
      transitions.pixelateTransition({ direction: 'out' });
      expect(scene.cameras.main.fadeOut).toHaveBeenCalled();
    });
  });

  describe('createOverlay', () => {
    it('should create graphics overlay', () => {
      transitions.createOverlay(0x000000);
      expect(scene.add.graphics).toHaveBeenCalled();
      expect(transitions.overlay).not.toBeNull();
    });

    it('should destroy existing overlay', () => {
      transitions.createOverlay(0x000000);
      const firstOverlay = transitions.overlay;

      transitions.createOverlay(0xffffff);
      expect(firstOverlay.destroy).toHaveBeenCalled();
    });

    it('should set depth to 999', () => {
      transitions.createOverlay(0x000000);
      expect(transitions.overlay.setDepth).toHaveBeenCalledWith(999);
    });
  });

  describe('destroyOverlay', () => {
    it('should destroy overlay if exists', () => {
      transitions.createOverlay(0x000000);
      const overlay = transitions.overlay;

      transitions.destroyOverlay();
      expect(overlay.destroy).toHaveBeenCalled();
      expect(transitions.overlay).toBeNull();
    });

    it('should handle no overlay', () => {
      expect(() => transitions.destroyOverlay()).not.toThrow();
    });
  });

  describe('createStickerGraphic', () => {
    it('should create graphics at position', () => {
      const sticker = transitions.createStickerGraphic(100, 200);
      expect(scene.add.graphics).toHaveBeenCalled();
      expect(sticker.setPosition).toHaveBeenCalledWith(100, 200);
    });

    it('should set high depth', () => {
      const sticker = transitions.createStickerGraphic(0, 0);
      expect(sticker.setDepth).toHaveBeenCalledWith(1000);
    });
  });

  describe('drawStar', () => {
    it('should draw star shape', () => {
      const graphics = scene.add.graphics();
      transitions.drawStar(graphics, 0, 0, 5, 30, 15);
      expect(graphics.fillPoints).toHaveBeenCalled();
      expect(graphics.strokePoints).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should stop current tween', () => {
      const mockTween = { stop: vi.fn() };
      transitions.currentTween = mockTween;

      transitions.cancel();
      expect(mockTween.stop).toHaveBeenCalled();
      expect(transitions.currentTween).toBeNull();
    });

    it('should destroy overlay', () => {
      transitions.createOverlay(0x000000);
      const overlay = transitions.overlay;

      transitions.cancel();
      expect(overlay.destroy).toHaveBeenCalled();
    });

    it('should destroy stickers', () => {
      const sticker1 = { destroy: vi.fn() };
      const sticker2 = { destroy: vi.fn() };
      transitions.stickers = [sticker1, sticker2];

      transitions.cancel();
      expect(sticker1.destroy).toHaveBeenCalled();
      expect(sticker2.destroy).toHaveBeenCalled();
      expect(transitions.stickers).toEqual([]);
    });

    it('should reset transitioning flag', () => {
      transitions.transitioning = true;
      transitions.cancel();
      expect(transitions.transitioning).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should call cancel', () => {
      const cancelSpy = vi.spyOn(transitions, 'cancel');
      transitions.destroy();
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('should clear scene reference', () => {
      transitions.destroy();
      expect(transitions.scene).toBeNull();
    });
  });
});

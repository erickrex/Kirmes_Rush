/**
 * @fileoverview Tests for NoteSplash - Visual splash effects
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import after mocks (no Phaser dependency for this class)
const { default: NoteSplash } = await import('../src/play/NoteSplash.js');
const Constants = await import('../src/core/Constants.js');

// Mock scene
const createMockScene = () => ({});

describe('NoteSplash', () => {
  let noteSplash;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    noteSplash = new NoteSplash(mockScene);
  });

  afterEach(() => {
    noteSplash.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(noteSplash.scene).toBe(mockScene);
      expect(noteSplash.scale).toBe(1.0);
      expect(noteSplash.alpha).toBe(0.6);
      expect(noteSplash.lifetime).toBe(300);
      expect(noteSplash.randomRotation).toBe(true);
      expect(noteSplash.randomVariation).toBe(true);
      expect(noteSplash.enabled).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customSplash = new NoteSplash(mockScene, {
        scale: 1.5,
        alpha: 0.8,
        lifetime: 500,
        randomRotation: false,
        randomVariation: false
      });

      expect(customSplash.scale).toBe(1.5);
      expect(customSplash.alpha).toBe(0.8);
      expect(customSplash.lifetime).toBe(500);
      expect(customSplash.randomRotation).toBe(false);
      expect(customSplash.randomVariation).toBe(false);

      customSplash.destroy();
    });

    it('should initialize empty arrays', () => {
      expect(noteSplash.activeSplashes).toEqual([]);
      expect(noteSplash.splashPool).toEqual([]);
    });

    it('should use direction colors from Constants', () => {
      expect(noteSplash.directionColors).toBe(Constants.COLOR_NOTES);
    });
  });

  describe('spawn', () => {
    it('should create splash at position', () => {
      const splash = noteSplash.spawn(100, 200, 0);

      expect(splash).not.toBeNull();
      expect(splash.x).toBe(100);
      expect(splash.y).toBe(200);
      expect(splash.direction).toBe(0);
    });

    it('should add splash to active list', () => {
      noteSplash.spawn(0, 0, 0);

      expect(noteSplash.activeSplashes.length).toBe(1);
    });

    it('should set alpha from config', () => {
      noteSplash.alpha = 0.5;
      const splash = noteSplash.spawn(0, 0, 0);

      expect(splash.alpha).toBe(0.5);
    });

    it('should set scale from config', () => {
      noteSplash.scale = 2.0;
      const splash = noteSplash.spawn(0, 0, 0);

      expect(splash.scale).toBe(2.0);
    });

    it('should set color based on direction', () => {
      const splash = noteSplash.spawn(0, 0, 2); // up direction

      expect(splash.color).toBe(Constants.COLOR_NOTES[2]);
    });

    it('should randomize rotation when enabled', () => {
      noteSplash.randomRotation = true;
      const splash1 = noteSplash.spawn(0, 0, 0);
      const splash2 = noteSplash.spawn(0, 0, 0);

      // Rotations should likely be different (not guaranteed but very likely)
      // Just check that rotation is set
      expect(typeof splash1.rotation).toBe('number');
      expect(typeof splash2.rotation).toBe('number');
    });

    it('should not randomize rotation when disabled', () => {
      noteSplash.randomRotation = false;
      const splash = noteSplash.spawn(0, 0, 0);

      expect(splash.rotation).toBe(0);
    });

    it('should return null when disabled', () => {
      noteSplash.enabled = false;
      const splash = noteSplash.spawn(0, 0, 0);

      expect(splash).toBeNull();
      expect(noteSplash.activeSplashes.length).toBe(0);
    });

    it('should reuse splashes from pool', () => {
      const pooledSplash = noteSplash.createSplash();
      noteSplash.splashPool.push(pooledSplash);

      const splash = noteSplash.spawn(0, 0, 0);

      expect(splash).toBe(pooledSplash);
      expect(noteSplash.splashPool.length).toBe(0);
    });
  });

  describe('spawnAtReceptor', () => {
    it('should spawn at receptor position', () => {
      const receptor = { x: 150, y: 250 };
      const splash = noteSplash.spawnAtReceptor(receptor, 1);

      expect(splash.x).toBe(150);
      expect(splash.y).toBe(250);
      expect(splash.direction).toBe(1);
    });

    it('should return null for null receptor', () => {
      const splash = noteSplash.spawnAtReceptor(null, 0);

      expect(splash).toBeNull();
    });
  });

  describe('createSplash', () => {
    it('should create splash with default values', () => {
      const splash = noteSplash.createSplash();

      expect(splash.x).toBe(0);
      expect(splash.y).toBe(0);
      expect(splash.direction).toBe(0);
      expect(splash.alpha).toBe(1);
      expect(splash.visible).toBe(true);
      expect(splash.lifetime).toBe(0);
      expect(splash.scale).toBe(1);
      expect(splash.rotation).toBe(0);
      expect(splash.variation).toBe(0);
      expect(splash.color).toBe(0xffffff);
      expect(splash.frame).toBe(0);
    });
  });

  describe('update', () => {
    it('should update splash lifetime', () => {
      noteSplash.spawn(0, 0, 0);
      const splash = noteSplash.activeSplashes[0];
      const initialLifetime = splash.lifetime;

      noteSplash.update(16.67);

      expect(splash.lifetime).toBeGreaterThan(initialLifetime);
    });

    it('should update animation frame', () => {
      noteSplash.spawn(0, 0, 0);
      const splash = noteSplash.activeSplashes[0];

      // Set lifetime to 50%
      splash.lifetime = splash.maxLifetime * 0.5;

      noteSplash.update(0);

      expect(splash.frame).toBe(4); // 50% of 8 frames
    });

    it('should fade out over lifetime', () => {
      noteSplash.spawn(0, 0, 0);
      const splash = noteSplash.activeSplashes[0];
      const initialAlpha = splash.alpha;

      // Set lifetime to 50%
      splash.lifetime = splash.maxLifetime * 0.5;

      noteSplash.update(0);

      expect(splash.alpha).toBeLessThan(initialAlpha);
    });

    it('should remove splash when lifetime exceeded', () => {
      noteSplash.spawn(0, 0, 0);
      const splash = noteSplash.activeSplashes[0];

      // Set lifetime past max
      splash.lifetime = splash.maxLifetime + 100;

      noteSplash.update(0);

      expect(noteSplash.activeSplashes.length).toBe(0);
      expect(noteSplash.splashPool.length).toBe(1);
    });
  });

  describe('cleanupOldSplashes', () => {
    it('should remove excess splashes', () => {
      noteSplash.maxActive = 2;

      // Add 5 splashes
      for (let i = 0; i < 5; i++) {
        noteSplash.spawn(0, 0, 0);
      }

      expect(noteSplash.activeSplashes.length).toBe(2);
      expect(noteSplash.splashPool.length).toBeGreaterThan(0);
    });
  });

  describe('setEnabled', () => {
    it('should set enabled state', () => {
      noteSplash.setEnabled(false);
      expect(noteSplash.enabled).toBe(false);

      noteSplash.setEnabled(true);
      expect(noteSplash.enabled).toBe(true);
    });

    it('should return this for chaining', () => {
      const result = noteSplash.setEnabled(true);
      expect(result).toBe(noteSplash);
    });
  });

  describe('setScale', () => {
    it('should set scale', () => {
      noteSplash.setScale(2.0);
      expect(noteSplash.scale).toBe(2.0);
    });

    it('should return this for chaining', () => {
      const result = noteSplash.setScale(1.5);
      expect(result).toBe(noteSplash);
    });
  });

  describe('setAlpha', () => {
    it('should set alpha', () => {
      noteSplash.setAlpha(0.8);
      expect(noteSplash.alpha).toBe(0.8);
    });

    it('should clamp to 0-1', () => {
      noteSplash.setAlpha(-0.5);
      expect(noteSplash.alpha).toBe(0);

      noteSplash.setAlpha(1.5);
      expect(noteSplash.alpha).toBe(1);
    });

    it('should return this for chaining', () => {
      const result = noteSplash.setAlpha(0.5);
      expect(result).toBe(noteSplash);
    });
  });

  describe('setLifetime', () => {
    it('should set lifetime', () => {
      noteSplash.setLifetime(500);
      expect(noteSplash.lifetime).toBe(500);
    });

    it('should return this for chaining', () => {
      const result = noteSplash.setLifetime(400);
      expect(result).toBe(noteSplash);
    });
  });

  describe('setVariationCount', () => {
    it('should set variation count', () => {
      noteSplash.setVariationCount(4);
      expect(noteSplash.variationCount).toBe(4);
    });

    it('should enforce minimum of 1', () => {
      noteSplash.setVariationCount(0);
      expect(noteSplash.variationCount).toBe(1);

      noteSplash.setVariationCount(-5);
      expect(noteSplash.variationCount).toBe(1);
    });

    it('should return this for chaining', () => {
      const result = noteSplash.setVariationCount(3);
      expect(result).toBe(noteSplash);
    });
  });

  describe('setDirectionColors', () => {
    it('should set direction colors', () => {
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
      noteSplash.setDirectionColors(colors);

      expect(noteSplash.directionColors).toBe(colors);
    });

    it('should return this for chaining', () => {
      const result = noteSplash.setDirectionColors([]);
      expect(result).toBe(noteSplash);
    });
  });

  describe('getActiveCount', () => {
    it('should return count of active splashes', () => {
      noteSplash.spawn(0, 0, 0);
      noteSplash.spawn(0, 0, 1);
      noteSplash.spawn(0, 0, 2);

      expect(noteSplash.getActiveCount()).toBe(3);
    });
  });

  describe('getActiveSplashes', () => {
    it('should return active splashes array', () => {
      noteSplash.spawn(0, 0, 0);
      noteSplash.spawn(0, 0, 1);

      const splashes = noteSplash.getActiveSplashes();

      expect(splashes).toBe(noteSplash.activeSplashes);
      expect(splashes.length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all active splashes', () => {
      noteSplash.spawn(0, 0, 0);
      noteSplash.spawn(0, 0, 1);
      noteSplash.spawn(0, 0, 2);

      noteSplash.clear();

      expect(noteSplash.activeSplashes.length).toBe(0);
    });

    it('should return splashes to pool', () => {
      noteSplash.spawn(0, 0, 0);
      noteSplash.spawn(0, 0, 1);

      noteSplash.clear();

      expect(noteSplash.splashPool.length).toBe(2);
    });
  });

  describe('getDirectionName', () => {
    it('should return correct direction names', () => {
      expect(NoteSplash.getDirectionName(0)).toBe('left');
      expect(NoteSplash.getDirectionName(1)).toBe('down');
      expect(NoteSplash.getDirectionName(2)).toBe('up');
      expect(NoteSplash.getDirectionName(3)).toBe('right');
    });

    it('should return unknown for invalid direction', () => {
      expect(NoteSplash.getDirectionName(4)).toBe('unknown');
      expect(NoteSplash.getDirectionName(-1)).toBe('unknown');
    });
  });

  describe('destroy', () => {
    it('should clear all splashes and pools', () => {
      noteSplash.spawn(0, 0, 0);
      noteSplash.spawn(0, 0, 1);

      noteSplash.destroy();

      expect(noteSplash.activeSplashes.length).toBe(0);
      expect(noteSplash.splashPool.length).toBe(0);
      expect(noteSplash.scene).toBeNull();
    });
  });
});

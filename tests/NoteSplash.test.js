/**
 * @fileoverview Tests for NoteSplash - Visual splash effects
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import after mocks (no Phaser dependency for this class)
const { default: NoteSplash } = await import('../src/play/NoteSplash.js');
const Constants = await import('../src/core/Constants.js');

// Mock scene (headless: no `add`, so no game objects are created)
const createMockScene = () => ({});

/**
 * Create a mock Phaser game object exposing every method NoteSplash touches.
 * All setters are chainable and `destroy` is tracked so teardown can be asserted.
 */
const createMockGameObject = (kind, props = {}) => ({
  kind,
  ...props,
  destroyed: false,
  setOrigin: vi.fn().mockReturnThis(),
  setDepth: vi.fn().mockReturnThis(),
  setTint: vi.fn().mockReturnThis(),
  setPosition: vi.fn().mockReturnThis(),
  setAlpha: vi.fn().mockReturnThis(),
  setScale: vi.fn().mockReturnThis(),
  setRotation: vi.fn().mockReturnThis(),
  setVisible: vi.fn().mockReturnThis(),
  destroy: vi.fn(function destroy() {
    this.destroyed = true;
  })
});

/**
 * Create a mock scene that backs splashes with real (mock) game objects.
 * Tracks every created object and supports both the loaded-asset path
 * (a pre-existing splash texture key) and the generated-burst fallback
 * (add.graphics().generateTexture()).
 * @param {{ splashTextureKey?: string | null }} [opts]
 */
const createRenderingScene = ({ splashTextureKey = null } = {}) => {
  const created = [];
  const textureKeys = new Set();
  if (splashTextureKey) {
    textureKeys.add(splashTextureKey);
  }
  return {
    created,
    textureKeys,
    textures: {
      exists: vi.fn((key) => textureKeys.has(key))
    },
    add: {
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillPoints: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        generateTexture: vi.fn((key) => {
          textureKeys.add(key);
        }),
        destroy: vi.fn()
      })),
      image: vi.fn((x, y, texture) => {
        const obj = createMockGameObject('image', { x, y, texture });
        created.push(obj);
        return obj;
      }),
      sprite: vi.fn((x, y, texture) => {
        const obj = createMockGameObject('sprite', { x, y, texture });
        created.push(obj);
        return obj;
      })
    }
  };
};

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

  // Validates: Requirements 3.3, 3.4, 3.6
  describe('rendering with a scene (Requirements 3.3, 3.4, 3.6)', () => {
    it('should create a real game object on spawn using a generated burst texture', () => {
      const scene = createRenderingScene();
      const splashes = new NoteSplash(scene);

      const splash = splashes.spawn(100, 200, 0);

      expect(splash).not.toBeNull();
      // Generated-burst fallback path: graphics created then a texture generated
      expect(scene.add.graphics).toHaveBeenCalled();
      expect(scene.textureKeys.has(splashes.generatedTextureKey)).toBe(true);
      // A real game object is attached and configured
      expect(splash.gameObject).toBeTruthy();
      expect(scene.add.image).toHaveBeenCalledTimes(1);
      expect(splash.gameObject.setOrigin).toHaveBeenCalled();
      expect(splash.gameObject.setDepth).toHaveBeenCalledWith(splashes.depth);
      expect(splash.gameObject.setTint).toHaveBeenCalledWith(splash.color);

      splashes.destroy();
    });

    it('should create a game object via spawnAtReceptor', () => {
      const scene = createRenderingScene();
      const splashes = new NoteSplash(scene);

      const splash = splashes.spawnAtReceptor({ x: 150, y: 250 }, 1);

      expect(splash).not.toBeNull();
      expect(splash.gameObject).toBeTruthy();
      expect(scene.created.length).toBe(1);
      expect(scene.created[0].x).toBe(150);
      expect(scene.created[0].y).toBe(250);

      splashes.destroy();
    });

    it('should prefer a loaded note-style splash texture when available', () => {
      const scene = createRenderingScene({ splashTextureKey: 'noteSplashes' });
      const splashes = new NoteSplash(scene, { splashTextureKey: 'noteSplashes' });

      splashes.spawn(0, 0, 0);

      // Loaded asset path: no generated burst created
      expect(scene.add.graphics).not.toHaveBeenCalled();
      expect(scene.add.image).toHaveBeenCalledTimes(1);
      expect(scene.add.image).toHaveBeenCalledWith(0, 0, 'noteSplashes');

      splashes.destroy();
    });

    it('should NOT create any game object when disabled via setEnabled(false) (Requirement 3.4)', () => {
      const scene = createRenderingScene();
      const splashes = new NoteSplash(scene);

      splashes.setEnabled(false);
      const splash = splashes.spawn(100, 200, 0);

      expect(splash).toBeNull();
      expect(splashes.activeSplashes.length).toBe(0);
      expect(scene.add.image).not.toHaveBeenCalled();
      expect(scene.add.sprite).not.toHaveBeenCalled();
      expect(scene.created.length).toBe(0);

      splashes.destroy();
    });

    it('should NOT create a game object via spawnAtReceptor when disabled (Requirement 3.4)', () => {
      const scene = createRenderingScene();
      const splashes = new NoteSplash(scene);

      splashes.setEnabled(false);
      const splash = splashes.spawnAtReceptor({ x: 10, y: 20 }, 2);

      expect(splash).toBeNull();
      expect(scene.created.length).toBe(0);

      splashes.destroy();
    });

    it('should apply tracked state to the game object every update (Requirement 3.3)', () => {
      const scene = createRenderingScene();
      const splashes = new NoteSplash(scene);

      const splash = splashes.spawn(50, 60, 3);
      const gameObject = splash.gameObject;

      gameObject.setPosition.mockClear();
      gameObject.setAlpha.mockClear();
      gameObject.setScale.mockClear();
      gameObject.setRotation.mockClear();
      gameObject.setVisible.mockClear();

      splashes.update(16.67);

      expect(gameObject.setPosition).toHaveBeenCalledWith(splash.x, splash.y);
      expect(gameObject.setAlpha).toHaveBeenCalledWith(splash.alpha);
      expect(gameObject.setScale).toHaveBeenCalledWith(splash.scale);
      expect(gameObject.setRotation).toHaveBeenCalledWith(splash.rotation);
      expect(gameObject.setVisible).toHaveBeenCalledWith(splash.visible);

      splashes.destroy();
    });

    it('should hide (not destroy) the game object when a splash is recycled to the pool', () => {
      const scene = createRenderingScene();
      const splashes = new NoteSplash(scene);

      const splash = splashes.spawn(0, 0, 0);
      const gameObject = splash.gameObject;

      // Force lifetime past max so the record is recycled
      splash.lifetime = splash.maxLifetime + 100;
      gameObject.setVisible.mockClear();

      splashes.update(16.67);

      expect(splashes.activeSplashes.length).toBe(0);
      expect(splashes.splashPool.length).toBe(1);
      expect(gameObject.setVisible).toHaveBeenCalledWith(false);
      expect(gameObject.destroyed).toBe(false);

      splashes.destroy();
    });

    it('should destroy all active and pooled game objects on destroy (Requirement 3.6)', () => {
      const scene = createRenderingScene();
      const splashes = new NoteSplash(scene);

      // One active splash...
      splashes.spawn(0, 0, 0);
      // ...and one recycled into the pool so destroy must cover pooled objects too
      const recycled = splashes.spawn(10, 10, 1);
      recycled.lifetime = recycled.maxLifetime + 100;
      splashes.update(16.67);
      expect(splashes.splashPool.length).toBeGreaterThan(0);

      const allCreated = [...scene.created];
      expect(allCreated.length).toBe(2);

      splashes.destroy();

      for (const obj of allCreated) {
        expect(obj.destroy).toHaveBeenCalled();
        expect(obj.destroyed).toBe(true);
      }
    });
  });

  // Validates: Requirements 3.3, 3.6
  describe('headless data path without a scene', () => {
    it('should not create game objects and not throw when scene lacks add', () => {
      const splashes = new NoteSplash(createMockScene());

      let splash;
      expect(() => {
        splash = splashes.spawn(100, 200, 0);
      }).not.toThrow();

      // Data path still tracks the record...
      expect(splashes.getActiveCount()).toBe(1);
      // ...but no game object was attached
      expect(splash.gameObject).toBeFalsy();

      splashes.destroy();
    });

    it('should keep pooling and lifetime logic intact headless', () => {
      const splashes = new NoteSplash(createMockScene());

      const splash = splashes.spawn(0, 0, 0);
      splash.lifetime = splash.maxLifetime + 100;

      expect(() => splashes.update(16.67)).not.toThrow();

      expect(splashes.activeSplashes.length).toBe(0);
      expect(splashes.splashPool.length).toBe(1);

      splashes.destroy();
    });

    it('should not throw on destroy with no scene', () => {
      const splashes = new NoteSplash(null);
      splashes.spawn(0, 0, 0);

      expect(() => splashes.destroy()).not.toThrow();
      expect(splashes.scene).toBeNull();
    });
  });
});

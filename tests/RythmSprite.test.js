/**
 * @fileoverview Unit tests for RythmSprite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser's Sprite class - MUST be set up before importing RythmSprite
class MockAnimation {
  constructor() {
    this.currentAnim = null;
    this.isPlaying = false;
    this.animationManager = {
      exists: vi.fn().mockReturnValue(false),
      get: vi.fn().mockReturnValue(null)
    };
  }

  exists(key) {
    return false;
  }

  play() {}
}

class MockSprite {
  constructor(scene, x, y, texture, frame) {
    this.scene = scene;
    this.x = x || 0;
    this.y = y || 0;
    this.texture = { key: texture, source: [{ scaleMode: 0 }] };
    this.frame = { name: frame };
    this.scaleX = 1;
    this.scaleY = 1;
    this.originX = 0.5;
    this.originY = 0.5;
    this.depth = 0;
    this.alpha = 1;
    this.angle = 0;
    this.flipX = false;
    this.flipY = false;
    this.anims = new MockAnimation();
    this._eventListeners = new Map();
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  setScale(x, y) {
    this.scaleX = x;
    this.scaleY = y !== undefined ? y : x;
    return this;
  }

  setOrigin(x, y) {
    this.originX = x;
    this.originY = y !== undefined ? y : x;
    return this;
  }

  setDepth(depth) {
    this.depth = depth;
    return this;
  }

  setAlpha(alpha) {
    this.alpha = alpha;
    return this;
  }

  setAngle(angle) {
    this.angle = angle;
    return this;
  }

  setFlip(x, y) {
    this.flipX = x;
    this.flipY = y;
    return this;
  }

  setTexture(key) {
    this.texture = { key, source: [{ scaleMode: 0 }] };
    return this;
  }

  on(event, callback, context) {
    this._eventListeners.set(event, { callback, context });
    return this;
  }

  off(event, callback, context) {
    this._eventListeners.delete(event);
    return this;
  }

  emit(event, ...args) {
    const listener = this._eventListeners.get(event);
    if (listener) {
      listener.callback.apply(listener.context, args);
    }
  }

  play(config, ignoreIfPlaying) {
    if (typeof config === 'object') {
      this.anims.currentAnim = { key: config.key };
    }
    this.anims.isPlaying = true;
    return this;
  }

  destroy(fromScene) {}
}

// Mock Phaser globals - MUST be set up before importing RythmSprite
global.Phaser = {
  GameObjects: {
    Sprite: MockSprite
  },
  ScaleModes: {
    NEAREST: 1,
    LINEAR: 0
  }
};

vi.mock('phaser', () => ({
  default: globalThis.Phaser
}));

// Dynamic import AFTER Phaser mock is set up
const { default: RythmSprite } = await import('../src/graphics/RythmSprite.js');

describe('RythmSprite', () => {
  let scene;
  let sprite;

  beforeEach(() => {
    scene = {
      add: {
        existing: vi.fn(),
        graphics: vi.fn().mockReturnValue({
          fillStyle: vi.fn(),
          fillRect: vi.fn(),
          generateTexture: vi.fn(),
          destroy: vi.fn()
        })
      },
      textures: {
        exists: vi.fn().mockReturnValue(false)
      },
      tweens: {
        killTweensOf: vi.fn()
      }
    };
    sprite = new RythmSprite(scene, 100, 200, 'testTexture', 'frame1');
  });

  describe('Constructor', () => {
    it('should initialize with correct position', () => {
      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);
    });

    it('should store original position', () => {
      expect(sprite.originalPosition).toEqual({ x: 100, y: 200 });
    });

    it('should initialize with default values', () => {
      expect(sprite.isPixel).toBe(false);
      expect(sprite.danceEvery).toBe(0);
      expect(sprite.shouldAlternate).toBeNull();
      expect(sprite.idleSuffix).toBe('');
      expect(sprite.shouldBop).toBe(true);
      expect(sprite.canPlayOtherAnims).toBe(true);
    });

    it('should initialize empty animation offsets', () => {
      expect(sprite.animationOffsets.size).toBe(0);
    });

    it('should initialize global offsets to zero', () => {
      expect(sprite.globalOffsets).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Static Factory Methods', () => {
    it('should create sprite with RythmSprite.create', () => {
      const created = RythmSprite.create(scene, 50, 75, 'myTexture');

      expect(created).toBeInstanceOf(RythmSprite);
      expect(created.x).toBe(50);
      expect(created.y).toBe(75);
      expect(scene.add.existing).toHaveBeenCalledWith(created);
    });

    it('should create pixel sprite with RythmSprite.createPixel', () => {
      const created = RythmSprite.createPixel(scene, 10, 20, 'pixelTexture', 6);

      expect(created).toBeInstanceOf(RythmSprite);
      expect(created.isPixel).toBe(true);
      expect(created.scaleX).toBe(6);
      expect(created.scaleY).toBe(6);
    });
  });

  describe('Pixel Art Support', () => {
    it('should set pixel art mode', () => {
      sprite.setPixelArt(true);

      expect(sprite.isPixel).toBe(true);
      expect(sprite.texture.source[0].scaleMode).toBe(Phaser.ScaleModes.NEAREST);
    });

    it('should set pixel art with scale', () => {
      sprite.setPixelArt(true, 4);

      expect(sprite.isPixel).toBe(true);
      expect(sprite.scaleX).toBe(4);
      expect(sprite.scaleY).toBe(4);
    });

    it('should return this for chaining', () => {
      const result = sprite.setPixelArt(true);
      expect(result).toBe(sprite);
    });
  });

  describe('Animation Offsets', () => {
    it('should set animation offsets', () => {
      sprite.setAnimationOffsets('idle', 10, 20);

      const offsets = sprite.getAnimationOffsets('idle');
      expect(offsets).toEqual({ x: 10, y: 20 });
    });

    it('should set animation offsets from array', () => {
      sprite.setAnimationOffsetsArray('walk', [5, 15]);

      const offsets = sprite.getAnimationOffsets('walk');
      expect(offsets).toEqual({ x: 5, y: 15 });
    });

    it('should return zero offsets for unknown animation', () => {
      const offsets = sprite.getAnimationOffsets('nonexistent');
      expect(offsets).toEqual({ x: 0, y: 0 });
    });

    it('should set global offsets', () => {
      sprite.setGlobalOffsets(30, 40);

      expect(sprite.globalOffsets).toEqual({ x: 30, y: 40 });
    });

    it('should return this for chaining', () => {
      expect(sprite.setAnimationOffsets('test', 1, 2)).toBe(sprite);
      expect(sprite.setAnimationOffsetsArray('test2', [3, 4])).toBe(sprite);
      expect(sprite.setGlobalOffsets(5, 6)).toBe(sprite);
    });
  });

  describe('Effective Position', () => {
    it('should calculate effective X with offsets', () => {
      sprite.setAnimationOffsets('idle', 10, 0);
      sprite._applyAnimationOffsets('idle');

      // x - (animOffset.x - globalOffset.x) * scaleX
      // 100 - (10 - 0) * 1 = 90
      expect(sprite.getEffectiveX()).toBe(90);
    });

    it('should calculate effective Y with offsets', () => {
      sprite.setAnimationOffsets('idle', 0, 20);
      sprite._applyAnimationOffsets('idle');

      // y - (animOffset.y - globalOffset.y) * scaleY
      // 200 - (20 - 0) * 1 = 180
      expect(sprite.getEffectiveY()).toBe(180);
    });

    it('should account for global offsets', () => {
      sprite.setAnimationOffsets('idle', 10, 20);
      sprite.setGlobalOffsets(5, 10);
      sprite._applyAnimationOffsets('idle');

      // x - (10 - 5) * 1 = 100 - 5 = 95
      expect(sprite.getEffectiveX()).toBe(95);
      // y - (20 - 10) * 1 = 200 - 10 = 190
      expect(sprite.getEffectiveY()).toBe(190);
    });

    it('should account for scale', () => {
      sprite.setScale(2);
      sprite.setAnimationOffsets('idle', 10, 20);
      sprite._applyAnimationOffsets('idle');

      // x - (10 - 0) * 2 = 100 - 20 = 80
      expect(sprite.getEffectiveX()).toBe(80);
      // y - (20 - 0) * 2 = 200 - 40 = 160
      expect(sprite.getEffectiveY()).toBe(160);
    });
  });


  describe('Animation Playback', () => {
    beforeEach(() => {
      // Setup mock animation manager
      sprite.anims.animationManager.exists = vi.fn().mockReturnValue(true);
      sprite.anims.exists = vi.fn().mockReturnValue(true);
    });

    it('should play animation', () => {
      sprite.playAnimation('idle');

      expect(sprite.anims.currentAnim.key).toBe('idle');
    });

    it('should apply animation offsets when playing', () => {
      sprite.setAnimationOffsets('idle', 15, 25);
      sprite.playAnimation('idle');

      expect(sprite._currentAnimOffsets).toEqual({ x: 15, y: 25 });
    });

    it('should block animations when canPlayOtherAnims is false', () => {
      sprite.canPlayOtherAnims = false;
      sprite.playAnimation('walk');

      // Should not change animation
      expect(sprite.anims.currentAnim).toBeNull();
    });

    it('should allow animations in ignoreExclusionPref', () => {
      sprite.canPlayOtherAnims = false;
      sprite.ignoreExclusionPref = ['sing'];
      sprite.playAnimation('singLEFT');

      expect(sprite.anims.currentAnim.key).toBe('singLEFT');
    });

    it('should set canPlayOtherAnims to false when ignoreOther is true', () => {
      sprite.playAnimation('special', false, true);

      expect(sprite.canPlayOtherAnims).toBe(false);
    });

    it('should return this for chaining', () => {
      const result = sprite.playAnimation('idle');
      expect(result).toBe(sprite);
    });

    it('should prefer texture-scoped animation keys when present', () => {
      sprite._textureKey = 'stage-mainStage-stagecurtains';
      sprite.anims.exists = vi.fn((key) => key === 'stage-mainStage-stagecurtains-idle');
      sprite.anims.animationManager.exists = vi.fn(
        (key) => key === 'stage-mainStage-stagecurtains-idle'
      );

      sprite.playAnimation('idle');

      expect(sprite.anims.currentAnim.key).toBe('stage-mainStage-stagecurtains-idle');
    });
  });

  describe('Animation Queries', () => {
    it('should check if animation exists', () => {
      sprite.anims.exists = vi.fn().mockReturnValue(true);

      expect(sprite.hasAnimation('idle')).toBe(true);
    });

    it('should return false for non-existent animation', () => {
      sprite.anims.exists = vi.fn().mockReturnValue(false);
      sprite.anims.animationManager.exists = vi.fn().mockReturnValue(false);

      expect(sprite.hasAnimation('nonexistent')).toBe(false);
    });

    it('should resolve texture-scoped animations from the plain animation name', () => {
      sprite._textureKey = 'stage-mainStage-stagecurtains';
      sprite.anims.exists = vi.fn((key) => key === 'stage-mainStage-stagecurtains-idle');
      sprite.anims.animationManager.exists = vi.fn(
        (key) => key === 'stage-mainStage-stagecurtains-idle'
      );

      expect(sprite.hasAnimation('idle')).toBe(true);
    });

    it('should get current animation name', () => {
      sprite.anims.currentAnim = { key: 'walk' };

      expect(sprite.getCurrentAnimation()).toBe('walk');
    });

    it('should return empty string when no animation playing', () => {
      sprite.anims.currentAnim = null;

      expect(sprite.getCurrentAnimation()).toBe('');
    });

    it('should check if animation is finished', () => {
      sprite.anims.isPlaying = false;

      expect(sprite.isAnimationFinished()).toBe(true);
    });

    it('should return false when animation is playing', () => {
      sprite.anims.isPlaying = true;

      expect(sprite.isAnimationFinished()).toBe(false);
    });
  });

  describe('Animation Complete Callback', () => {
    it('should reset canPlayOtherAnims on animation complete', () => {
      sprite.canPlayOtherAnims = false;

      sprite._onAnimationComplete({ key: 'test' });

      expect(sprite.canPlayOtherAnims).toBe(true);
    });
  });

  describe('Dance System', () => {
    beforeEach(() => {
      sprite.anims.exists = vi.fn().mockReturnValue(true);
      sprite.anims.animationManager.exists = vi.fn().mockReturnValue(true);
    });

    it('should play idle animation when shouldAlternate is false', () => {
      sprite.shouldAlternate = false;
      sprite.dance();

      expect(sprite.anims.currentAnim.key).toBe('idle');
    });

    it('should alternate between danceLeft and danceRight', () => {
      sprite.shouldAlternate = true;

      sprite.dance();
      expect(sprite.anims.currentAnim.key).toBe('danceLeft');

      sprite.dance();
      expect(sprite.anims.currentAnim.key).toBe('danceRight');

      sprite.dance();
      expect(sprite.anims.currentAnim.key).toBe('danceLeft');
    });

    it('should apply idleSuffix to dance animations', () => {
      sprite.shouldAlternate = false;
      sprite.idleSuffix = '-alt';
      sprite.dance();

      expect(sprite.anims.currentAnim.key).toBe('idle-alt');
    });

    it('should handle onStepHit with danceEvery', () => {
      sprite.danceEvery = 2;
      sprite.shouldAlternate = false;

      // Step 0 should trigger dance (0 % (2 * 4) === 0)
      sprite.onStepHit(0, 4);
      expect(sprite.anims.currentAnim.key).toBe('idle');

      // Step 4 should not trigger (4 % 8 !== 0)
      sprite.anims.currentAnim = null;
      sprite.onStepHit(4, 4);
      expect(sprite.anims.currentAnim).toBeNull();

      // Step 8 should trigger (8 % 8 === 0)
      sprite.onStepHit(8, 4);
      expect(sprite.anims.currentAnim.key).toBe('idle');
    });

    it('should not dance when danceEvery is 0', () => {
      sprite.danceEvery = 0;

      sprite.onStepHit(0, 4);
      expect(sprite.anims.currentAnim).toBeNull();
    });
  });

  describe('Position Utilities', () => {
    it('should reset to original position', () => {
      sprite.x = 500;
      sprite.y = 600;

      sprite.resetPosition();

      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);
    });

    it('should set position and update original', () => {
      sprite.setPositionWithOrigin(300, 400);

      expect(sprite.x).toBe(300);
      expect(sprite.y).toBe(400);
      expect(sprite.originalPosition).toEqual({ x: 300, y: 400 });
    });
  });

  describe('Z-Index Support', () => {
    it('should set z-index', () => {
      sprite.setZIndex(100);

      expect(sprite.depth).toBe(100);
    });

    it('should get z-index', () => {
      sprite.depth = 50;

      expect(sprite.getZIndex()).toBe(50);
    });

    it('should return this for chaining', () => {
      const result = sprite.setZIndex(10);
      expect(result).toBe(sprite);
    });
  });

  describe('Texture Loading', () => {
    it('should load texture', () => {
      sprite.loadTexture('newTexture');

      expect(sprite.texture.key).toBe('newTexture');
    });

    it('should return this for chaining', () => {
      const result = sprite.loadTexture('test');
      expect(result).toBe(sprite);
    });

    it('should create solid color sprite', () => {
      sprite.makeSolidColor(100, 50, 0xff0000);

      expect(sprite.scaleX).toBe(50); // 100 / 2
      expect(sprite.scaleY).toBe(25); // 50 / 2
    });
  });

  describe('Clone', () => {
    it('should create a clone with same properties', () => {
      sprite.setScale(2, 3);
      sprite.setDepth(50);
      sprite.setAlpha(0.5);
      sprite.isPixel = true;
      sprite.danceEvery = 2;
      sprite.setAnimationOffsets('idle', 10, 20);
      sprite.setGlobalOffsets(5, 5);

      const cloned = sprite.clone();

      expect(cloned).toBeInstanceOf(RythmSprite);
      expect(cloned.x).toBe(sprite.x);
      expect(cloned.y).toBe(sprite.y);
      expect(cloned.scaleX).toBe(2);
      expect(cloned.scaleY).toBe(3);
      expect(cloned.depth).toBe(50);
      expect(cloned.alpha).toBe(0.5);
      expect(cloned.isPixel).toBe(true);
      expect(cloned.danceEvery).toBe(2);
      expect(cloned.getAnimationOffsets('idle')).toEqual({ x: 10, y: 20 });
      expect(cloned.globalOffsets).toEqual({ x: 5, y: 5 });
    });

    it('should create independent animation offsets', () => {
      sprite.setAnimationOffsets('idle', 10, 20);
      const cloned = sprite.clone();

      cloned.setAnimationOffsets('idle', 30, 40);

      expect(sprite.getAnimationOffsets('idle')).toEqual({ x: 10, y: 20 });
      expect(cloned.getAnimationOffsets('idle')).toEqual({ x: 30, y: 40 });
    });
  });

  describe('Cleanup', () => {
    it('should clear animation offsets on destroy', () => {
      sprite.setAnimationOffsets('idle', 10, 20);

      sprite.destroy();

      expect(sprite.animationOffsets.size).toBe(0);
    });

    it('should kill tweens on destroy', () => {
      sprite.destroy();

      expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(sprite);
    });
  });
});

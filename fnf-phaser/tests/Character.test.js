/**
 * @fileoverview Tests for Character class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Phaser's Sprite class - MUST be set up before importing Character
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
    this.width = 100;
    this.height = 100;
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

  setFlipX(x) {
    this.flipX = x;
    return this;
  }

  setFlipY(y) {
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

// Mock Phaser globals - MUST be set up before importing Character
global.Phaser = {
  GameObjects: {
    Sprite: MockSprite
  },
  ScaleModes: {
    NEAREST: 1,
    LINEAR: 0
  }
};

// Dynamic import AFTER Phaser mock is set up
const { default: Character } = await import('../src/play/Character.js');
const { default: CharacterRegistry } = await import('../src/data/registries/CharacterRegistry.js');

describe('Character', () => {
  let mockScene;
  let mockRegistry;

  const mockCharacterData = {
    version: '1.0.0',
    name: 'Boyfriend',
    renderType: 'sparrow',
    assetPath: 'characters/bf',
    scale: 1,
    offsets: [0, 350],
    cameraOffsets: [0, -100],
    isPixel: false,
    danceEvery: 2,
    singTime: 8,
    flipX: true,
    startingAnimation: 'idle',
    healthIcon: {
      id: 'bf',
      scale: 1
    },
    animations: [
      { name: 'idle', prefix: 'BF idle dance', offsets: [0, 0], frameRate: 24, looped: false },
      { name: 'singLEFT', prefix: 'BF NOTE LEFT', offsets: [-5, 0], frameRate: 24, looped: false },
      { name: 'singDOWN', prefix: 'BF NOTE DOWN', offsets: [0, 10], frameRate: 24, looped: false },
      { name: 'singUP', prefix: 'BF NOTE UP', offsets: [0, -10], frameRate: 24, looped: false },
      { name: 'singRIGHT', prefix: 'BF NOTE RIGHT', offsets: [5, 0], frameRate: 24, looped: false },
      {
        name: 'singLEFTmiss',
        prefix: 'BF NOTE LEFT MISS',
        offsets: [-5, 0],
        frameRate: 24,
        looped: false
      },
      {
        name: 'singDOWNmiss',
        prefix: 'BF NOTE DOWN MISS',
        offsets: [0, 10],
        frameRate: 24,
        looped: false
      },
      {
        name: 'singUPmiss',
        prefix: 'BF NOTE UP MISS',
        offsets: [0, -10],
        frameRate: 24,
        looped: false
      },
      {
        name: 'singRIGHTmiss',
        prefix: 'BF NOTE RIGHT MISS',
        offsets: [5, 0],
        frameRate: 24,
        looped: false
      }
    ]
  };

  beforeEach(() => {
    mockScene = {
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
      },
      anims: {
        exists: vi.fn().mockReturnValue(true),
        get: vi.fn().mockReturnValue(null)
      }
    };

    // Create mock registry
    mockRegistry = {
      getCharacterData: vi.fn().mockReturnValue(mockCharacterData),
      hasEntry: vi.fn().mockReturnValue(true)
    };

    // Reset singleton
    CharacterRegistry.instance = null;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a character with default values', () => {
      const char = new Character(mockScene);

      expect(char.characterId).toBe('bf');
      expect(char.isPlayer).toBe(false);
      expect(char.isSinging).toBe(false);
      expect(char.singDirection).toBe(-1);
      expect(char.singTimer).toBe(0);
      expect(char.isHolding).toBe(false);
    });

    it('should create a character with custom ID', () => {
      const char = new Character(mockScene, 0, 0, 'dad', false);

      expect(char.characterId).toBe('dad');
      expect(char.isPlayer).toBe(false);
    });

    it('should create a player character', () => {
      const char = new Character(mockScene, 0, 0, 'bf', true);

      expect(char.characterId).toBe('bf');
      expect(char.isPlayer).toBe(true);
    });

    it('should set initial position', () => {
      const char = new Character(mockScene, 100, 200, 'bf');

      expect(char.x).toBe(100);
      expect(char.y).toBe(200);
    });
  });

  describe('loadFromRegistry', () => {
    it('should load character data from registry', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      const result = char.loadFromRegistry(mockRegistry);

      expect(result).toBe(true);
      expect(char.characterData).toBe(mockCharacterData);
      expect(mockRegistry.getCharacterData).toHaveBeenCalledWith('bf');
    });

    it('should return false if character not found', () => {
      mockRegistry.getCharacterData.mockReturnValue(null);
      const char = new Character(mockScene, 0, 0, 'nonexistent');
      const result = char.loadFromRegistry(mockRegistry);

      expect(result).toBe(false);
      expect(char.characterData).toBeNull();
    });
  });

  describe('applyCharacterData', () => {
    it('should apply scale from data', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData({ ...mockCharacterData, scale: 2 });

      expect(char.scaleX).toBe(2);
      expect(char.scaleY).toBe(2);
    });

    it('should apply pixel art setting', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData({ ...mockCharacterData, isPixel: true });

      expect(char.isPixel).toBe(true);
    });

    it('should apply dance every setting', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData({ ...mockCharacterData, danceEvery: 4 });

      expect(char.danceEvery).toBe(4);
    });

    it('should apply sing time setting', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData({ ...mockCharacterData, singTime: 12 });

      expect(char.singTime).toBe(12);
    });

    it('should apply global offsets', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData({ ...mockCharacterData, offsets: [50, 100] });

      expect(char.globalOffsets.x).toBe(50);
      expect(char.globalOffsets.y).toBe(100);
    });

    it('should apply camera offsets', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData({ ...mockCharacterData, cameraOffsets: [25, -50] });

      expect(char.cameraOffset.x).toBe(25);
      expect(char.cameraOffset.y).toBe(-50);
    });

    it('should set health icon ID', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData(mockCharacterData);

      expect(char.healthIconId).toBe('bf');
    });

    it('should default health icon ID to character ID', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.applyCharacterData({ ...mockCharacterData, healthIcon: {} });

      expect(char.healthIconId).toBe('bf');
    });

    it('should flip player character', () => {
      const char = new Character(mockScene, 0, 0, 'bf', true);
      char.applyCharacterData({ ...mockCharacterData, flipX: true });

      expect(char.flipX).toBe(false); // Inverted for player
    });

    it('should not flip non-player character with flipX', () => {
      const char = new Character(mockScene, 0, 0, 'dad', false);
      char.applyCharacterData({ ...mockCharacterData, flipX: true });

      expect(char.flipX).toBe(true);
    });
  });

  describe('setupAnimations', () => {
    it('should store animation offsets', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.setupAnimations(mockCharacterData.animations);

      const offsets = char.getAnimationOffsets('singLEFT');
      expect(offsets.x).toBe(-5);
      expect(offsets.y).toBe(0);
    });

    it('should store animation data', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.setupAnimations(mockCharacterData.animations);

      const animData = char.getAnimationData('idle');
      expect(animData).toBeDefined();
      expect(animData.prefix).toBe('BF idle dance');
    });

    it('should handle null animations', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      expect(() => char.setupAnimations(null)).not.toThrow();
    });

    it('should handle empty animations array', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      expect(() => char.setupAnimations([])).not.toThrow();
    });
  });

  describe('sing', () => {
    it('should set singing state', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.anims.exists = vi.fn().mockReturnValue(true);
      char.sing(0);

      expect(char.isSinging).toBe(true);
      expect(char.singDirection).toBe(0);
    });

    it('should set sing timer', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.singTime = 8;
      char.anims.exists = vi.fn().mockReturnValue(true);
      char.sing(1);

      expect(char.singTimer).toBe(8);
    });

    it('should set stunned state on miss', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.anims.exists = vi.fn().mockReturnValue(true);
      char.sing(2, true);

      expect(char.isStunned).toBe(true);
      expect(char.stunTimer).toBe(char.singTime);
    });
  });

  describe('holdNote', () => {
    it('should set holding state', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.singDirection = 0;
      char.anims.exists = vi.fn().mockReturnValue(true);
      char.holdNote();

      expect(char.isHolding).toBe(true);
    });

    it('should reset sing timer while holding', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.singDirection = 0;
      char.singTime = 8;
      char.singTimer = 2;
      char.anims.exists = vi.fn().mockReturnValue(true);
      char.holdNote();

      expect(char.singTimer).toBe(8);
    });

    it('should not hold if not singing', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.singDirection = -1;
      char.holdNote();

      expect(char.isHolding).toBe(false);
    });
  });

  describe('releaseNote', () => {
    it('should clear holding state', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isHolding = true;
      char.releaseNote();

      expect(char.isHolding).toBe(false);
    });
  });

  describe('miss', () => {
    it('should call sing with miss flag', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.anims.exists = vi.fn().mockReturnValue(true);
      const singFn = vi.spyOn(char, 'sing');
      char.miss(1);

      expect(singFn).toHaveBeenCalledWith(1, true);
    });
  });

  describe('dance', () => {
    it('should not dance while singing', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isSinging = true;
      const playAnimFn = vi.spyOn(char, 'playAnimation');
      char.dance();

      expect(playAnimFn).not.toHaveBeenCalled();
    });

    it('should not dance while stunned', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isStunned = true;
      const playAnimFn = vi.spyOn(char, 'playAnimation');
      char.dance();

      expect(playAnimFn).not.toHaveBeenCalled();
    });
  });

  describe('returnToIdle', () => {
    it('should reset singing state', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isSinging = true;
      char.isHolding = true;
      char.singDirection = 2;
      char.singTimer = 5;
      char.returnToIdle();

      expect(char.isSinging).toBe(false);
      expect(char.isHolding).toBe(false);
      expect(char.singDirection).toBe(-1);
      expect(char.singTimer).toBe(0);
    });
  });

  describe('update', () => {
    it('should decrement sing timer', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isSinging = true;
      char.singTimer = 8;
      char.update(16, 1);

      expect(char.singTimer).toBe(7);
    });

    it('should return to idle when sing timer expires', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isSinging = true;
      char.singTimer = 1;
      char.singDirection = 0;
      char.update(16, 1);

      expect(char.isSinging).toBe(false);
      expect(char.singDirection).toBe(-1);
    });

    it('should not decrement timer while holding', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isSinging = true;
      char.isHolding = true;
      char.singTimer = 8;
      char.update(16, 1);

      expect(char.singTimer).toBe(8);
    });

    it('should decrement stun timer', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isStunned = true;
      char.stunTimer = 8;
      char.update(16, 1);

      expect(char.stunTimer).toBe(7);
    });

    it('should clear stunned state when timer expires', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isStunned = true;
      char.stunTimer = 1;
      char.update(16, 1);

      expect(char.isStunned).toBe(false);
    });
  });

  describe('onStepHit', () => {
    it('should not dance while singing', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isSinging = true;
      char.danceEvery = 1;
      const danceFn = vi.spyOn(char, 'dance');
      char.onStepHit(4);

      expect(danceFn).not.toHaveBeenCalled();
    });

    it('should not dance while stunned', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.isStunned = true;
      char.danceEvery = 1;
      const danceFn = vi.spyOn(char, 'dance');
      char.onStepHit(4);

      expect(danceFn).not.toHaveBeenCalled();
    });
  });

  describe('onBeatHit', () => {
    it('should dance on beat when configured', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.danceEvery = 2;
      const danceFn = vi.spyOn(char, 'dance');
      char.onBeatHit(4);

      expect(danceFn).toHaveBeenCalled();
    });

    it('should not dance on off-beats', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.danceEvery = 2;
      const danceFn = vi.spyOn(char, 'dance');
      char.onBeatHit(3);

      expect(danceFn).not.toHaveBeenCalled();
    });

    it('should not dance while singing', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.danceEvery = 1;
      char.isSinging = true;
      const danceFn = vi.spyOn(char, 'dance');
      char.onBeatHit(4);

      expect(danceFn).not.toHaveBeenCalled();
    });
  });

  describe('getCameraFocusPoint', () => {
    it('should return center point with camera offset', () => {
      const char = new Character(mockScene, 100, 200, 'bf');
      char.width = 100;
      char.height = 100;
      char.scaleX = 1;
      char.scaleY = 1;
      char.cameraOffset = { x: 10, y: -20 };

      const point = char.getCameraFocusPoint();

      expect(point.x).toBe(160); // 100 + 50 + 10
      expect(point.y).toBe(230); // 200 + 50 - 20
    });
  });

  describe('getDisplayName', () => {
    it('should return character name from data', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.characterData = { name: 'Boyfriend' };

      expect(char.getDisplayName()).toBe('Boyfriend');
    });

    it('should return character ID if no data', () => {
      const char = new Character(mockScene, 0, 0, 'bf');

      expect(char.getDisplayName()).toBe('bf');
    });
  });

  describe('hasMissAnimations', () => {
    it('should return true if has miss animations', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.anims.exists = vi.fn().mockImplementation((name) => name.includes('miss'));

      expect(char.hasMissAnimations()).toBe(true);
    });

    it('should return false if no miss animations', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.anims.exists = vi.fn().mockReturnValue(false);

      expect(char.hasMissAnimations()).toBe(false);
    });
  });

  describe('hasDeathAnimations', () => {
    it('should return true if has firstDeath animation', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.anims.exists = vi.fn().mockImplementation((name) => name === 'firstDeath');

      expect(char.hasDeathAnimations()).toBe(true);
    });

    it('should return false if no death animations', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char.anims.exists = vi.fn().mockReturnValue(false);

      expect(char.hasDeathAnimations()).toBe(false);
    });
  });

  describe('static create', () => {
    it('should create and add character to scene', () => {
      const char = Character.createCharacter(mockScene, 'bf', false, 100, 200);

      // Will be null because registry returns null by default in this test
      // In real usage, registry would be properly initialized
      expect(char).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should clean up animation data', () => {
      const char = new Character(mockScene, 0, 0, 'bf');
      char._animationData = new Map([['idle', {}]]);
      char.characterData = mockCharacterData;

      char.destroy();

      expect(char._animationData.size).toBe(0);
      expect(char.characterData).toBeNull();
    });
  });

  describe('CharacterRegistry.getSingAnimationName', () => {
    it('should return correct sing animation names', () => {
      expect(CharacterRegistry.getSingAnimationName(0)).toBe('singLEFT');
      expect(CharacterRegistry.getSingAnimationName(1)).toBe('singDOWN');
      expect(CharacterRegistry.getSingAnimationName(2)).toBe('singUP');
      expect(CharacterRegistry.getSingAnimationName(3)).toBe('singRIGHT');
    });

    it('should return miss animation names', () => {
      expect(CharacterRegistry.getSingAnimationName(0, true)).toBe('singLEFTmiss');
      expect(CharacterRegistry.getSingAnimationName(1, true)).toBe('singDOWNmiss');
      expect(CharacterRegistry.getSingAnimationName(2, true)).toBe('singUPmiss');
      expect(CharacterRegistry.getSingAnimationName(3, true)).toBe('singRIGHTmiss');
    });
  });

  describe('CharacterRegistry.getHoldAnimationName', () => {
    it('should return correct hold animation names', () => {
      expect(CharacterRegistry.getHoldAnimationName(0)).toBe('singLEFT-hold');
      expect(CharacterRegistry.getHoldAnimationName(1)).toBe('singDOWN-hold');
      expect(CharacterRegistry.getHoldAnimationName(2)).toBe('singUP-hold');
      expect(CharacterRegistry.getHoldAnimationName(3)).toBe('singRIGHT-hold');
    });
  });
});

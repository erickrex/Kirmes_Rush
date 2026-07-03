/**
 * @fileoverview Tests for ComboPopup - Judgement and combo display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import after mocks (no Phaser dependency for this class)
const { default: ComboPopup, JudgementType } = await import('../src/play/ComboPopup.js');

// Mock scene (headless: no `add`, so no game objects are created)
const createMockScene = () => ({});

/**
 * Create a mock Phaser game object exposing every method ComboPopup touches.
 * All setters are chainable and `destroy` is tracked so teardown can be asserted.
 */
const createMockGameObject = (kind, props = {}) => ({
  kind,
  ...props,
  destroyed: false,
  setOrigin: vi.fn().mockReturnThis(),
  setDepth: vi.fn().mockReturnThis(),
  setPosition: vi.fn().mockReturnThis(),
  setAlpha: vi.fn().mockReturnThis(),
  setScale: vi.fn().mockReturnThis(),
  setVisible: vi.fn().mockReturnThis(),
  setText: vi.fn().mockReturnThis(),
  setColor: vi.fn().mockReturnThis(),
  destroy: vi.fn(function destroy() {
    this.destroyed = true;
  })
});

/**
 * Create a mock scene that backs popups with real (mock) game objects.
 * Tracks every created object so creation and destruction can be asserted.
 * @param {{ texturesExist?: boolean }} [opts]
 */
const createRenderingScene = ({ texturesExist = false } = {}) => {
  const created = [];
  return {
    created,
    textures: {
      exists: vi.fn(() => texturesExist)
    },
    add: {
      text: vi.fn((x, y, text) => {
        const obj = createMockGameObject('text', { x, y, text });
        created.push(obj);
        return obj;
      }),
      image: vi.fn((x, y, texture) => {
        const obj = createMockGameObject('image', { x, y, texture });
        created.push(obj);
        return obj;
      })
    }
  };
};

describe('ComboPopup', () => {
  let comboPopup;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    comboPopup = new ComboPopup(mockScene);
  });

  afterEach(() => {
    comboPopup.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(comboPopup.scene).toBe(mockScene);
      expect(comboPopup.x).toBe(0);
      expect(comboPopup.y).toBe(0);
      expect(comboPopup.scale).toBe(0.7);
      expect(comboPopup.fadeTime).toBe(200);
      expect(comboPopup.showComboNumbers).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customPopup = new ComboPopup(mockScene, {
        x: 100,
        y: 200,
        scale: 1.0,
        fadeTime: 300,
        riseSpeed: 1.0,
        gravity: 0.05,
        showComboNumbers: false
      });

      expect(customPopup.x).toBe(100);
      expect(customPopup.y).toBe(200);
      expect(customPopup.scale).toBe(1.0);
      expect(customPopup.fadeTime).toBe(300);
      expect(customPopup.riseSpeed).toBe(1.0);
      expect(customPopup.gravity).toBe(0.05);
      expect(customPopup.showComboNumbers).toBe(false);

      customPopup.destroy();
    });

    it('should initialize empty arrays', () => {
      expect(comboPopup.activeJudgements).toEqual([]);
      expect(comboPopup.activeNumbers).toEqual([]);
      expect(comboPopup.judgementPool).toEqual([]);
      expect(comboPopup.numberPool).toEqual([]);
    });
  });

  describe('JudgementType', () => {
    it('should have all judgement types', () => {
      expect(JudgementType.KILLER).toBe('killer');
      expect(JudgementType.SICK).toBe('sick');
      expect(JudgementType.GOOD).toBe('good');
      expect(JudgementType.BAD).toBe('bad');
      expect(JudgementType.SHIT).toBe('shit');
    });
  });

  describe('showJudgement', () => {
    it('should create judgement sprite', () => {
      comboPopup.showJudgement(JudgementType.SICK);

      expect(comboPopup.activeJudgements.length).toBe(1);
      expect(comboPopup.activeJudgements[0].judgement).toBe(JudgementType.SICK);
    });

    it('should use default position', () => {
      comboPopup.x = 100;
      comboPopup.y = 200;
      comboPopup.showJudgement(JudgementType.GOOD);

      expect(comboPopup.activeJudgements[0].x).toBe(100);
      expect(comboPopup.activeJudgements[0].y).toBe(200);
    });

    it('should use custom position when provided', () => {
      comboPopup.showJudgement(JudgementType.GOOD, 0, 300, 400);

      expect(comboPopup.activeJudgements[0].x).toBe(300);
      expect(comboPopup.activeJudgements[0].y).toBe(400);
    });

    it('should show combo numbers when enabled and combo > 0', () => {
      comboPopup.showComboNumbers = true;
      comboPopup.showJudgement(JudgementType.SICK, 25);

      expect(comboPopup.activeNumbers.length).toBe(2); // "2" and "5"
    });

    it('should not show combo numbers when combo is 0', () => {
      comboPopup.showComboNumbers = true;
      comboPopup.showJudgement(JudgementType.SICK, 0);

      expect(comboPopup.activeNumbers.length).toBe(0);
    });

    it('should not show combo numbers when disabled', () => {
      comboPopup.showComboNumbers = false;
      comboPopup.showJudgement(JudgementType.SICK, 25);

      expect(comboPopup.activeNumbers.length).toBe(0);
    });
  });

  describe('createJudgementSprite', () => {
    it('should create sprite with correct properties', () => {
      const sprite = comboPopup.createJudgementSprite(JudgementType.SICK, 100, 200);

      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);
      expect(sprite.alpha).toBe(1);
      expect(sprite.judgement).toBe(JudgementType.SICK);
      expect(sprite.visible).toBe(true);
      expect(sprite.scale).toBe(comboPopup.scale);
    });

    it('should set negative velocity for rising', () => {
      const sprite = comboPopup.createJudgementSprite(JudgementType.SICK, 0, 0);

      expect(sprite.velocityY).toBeLessThan(0);
    });

    it('should reuse sprites from pool', () => {
      const pooledSprite = comboPopup.createSprite();
      comboPopup.judgementPool.push(pooledSprite);

      const sprite = comboPopup.createJudgementSprite(JudgementType.GOOD, 0, 0);

      expect(sprite).toBe(pooledSprite);
      expect(comboPopup.judgementPool.length).toBe(0);
    });
  });

  describe('showComboNumber', () => {
    it('should create sprites for each digit', () => {
      comboPopup.showComboNumber(123, 0, 0);

      expect(comboPopup.activeNumbers.length).toBe(3);
    });

    it('should set correct digit values', () => {
      comboPopup.showComboNumber(42, 0, 0);

      expect(comboPopup.activeNumbers[0].digit).toBe(4);
      expect(comboPopup.activeNumbers[1].digit).toBe(2);
    });

    it('should space digits correctly', () => {
      comboPopup.digitSpacing = 40;
      comboPopup.showComboNumber(12, 100, 0);

      const x1 = comboPopup.activeNumbers[0].x;
      const x2 = comboPopup.activeNumbers[1].x;

      expect(x2 - x1).toBe(40);
    });
  });

  describe('createNumberSprite', () => {
    it('should create sprite with correct properties', () => {
      const sprite = comboPopup.createNumberSprite(5, 100, 200);

      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);
      expect(sprite.digit).toBe(5);
      expect(sprite.visible).toBe(true);
    });

    it('should reuse sprites from pool', () => {
      const pooledSprite = comboPopup.createSprite();
      comboPopup.numberPool.push(pooledSprite);

      const sprite = comboPopup.createNumberSprite(0, 0, 0);

      expect(sprite).toBe(pooledSprite);
      expect(comboPopup.numberPool.length).toBe(0);
    });
  });

  describe('createSprite', () => {
    it('should create sprite with default values', () => {
      const sprite = comboPopup.createSprite();

      expect(sprite.x).toBe(0);
      expect(sprite.y).toBe(0);
      expect(sprite.alpha).toBe(1);
      expect(sprite.velocityY).toBe(0);
      expect(sprite.lifetime).toBe(0);
      expect(sprite.visible).toBe(true);
      expect(sprite.judgement).toBeUndefined();
      expect(sprite.digit).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update sprite lifetime', () => {
      comboPopup.showJudgement(JudgementType.SICK);
      const sprite = comboPopup.activeJudgements[0];
      const initialLifetime = sprite.lifetime;

      comboPopup.update(16.67);

      expect(sprite.lifetime).toBeGreaterThan(initialLifetime);
    });

    it('should apply velocity to position', () => {
      comboPopup.showJudgement(JudgementType.SICK);
      const sprite = comboPopup.activeJudgements[0];
      const initialY = sprite.y;

      comboPopup.update(16.67);

      // Sprite should have moved (velocity is negative, so y decreases initially)
      expect(sprite.y).not.toBe(initialY);
    });

    it('should apply gravity to velocity', () => {
      comboPopup.showJudgement(JudgementType.SICK);
      const sprite = comboPopup.activeJudgements[0];
      const initialVelocity = sprite.velocityY;

      comboPopup.update(16.67);

      // Gravity should increase velocity (make it less negative / more positive)
      expect(sprite.velocityY).toBeGreaterThan(initialVelocity);
    });

    it('should fade out near end of lifetime', () => {
      comboPopup.showJudgement(JudgementType.SICK);
      const sprite = comboPopup.activeJudgements[0];

      // Set lifetime near end
      sprite.lifetime = sprite.maxLifetime - comboPopup.fadeTime / 2;

      comboPopup.update(16.67);

      expect(sprite.alpha).toBeLessThan(1);
    });

    it('should remove sprites when lifetime exceeded', () => {
      comboPopup.showJudgement(JudgementType.SICK);
      const sprite = comboPopup.activeJudgements[0];

      // Set lifetime past max
      sprite.lifetime = sprite.maxLifetime + 100;

      comboPopup.update(16.67);

      expect(comboPopup.activeJudgements.length).toBe(0);
      expect(comboPopup.judgementPool.length).toBe(1);
    });
  });

  describe('cleanupOldPopups', () => {
    it('should remove excess judgement sprites', () => {
      comboPopup.maxActive = 2;

      // Add 5 judgements - cleanup happens after each one
      for (let i = 0; i < 5; i++) {
        comboPopup.showJudgement(JudgementType.SICK);
      }

      // After cleanup, should have maxActive (2) active
      expect(comboPopup.activeJudgements.length).toBe(2);
      // Pool should have the removed ones
      expect(comboPopup.judgementPool.length).toBeGreaterThan(0);
    });

    it('should remove excess number sprites', () => {
      comboPopup.maxActive = 2;
      comboPopup.showComboNumbers = true;

      // Add many numbers - cleanup happens after each showJudgement
      for (let i = 0; i < 20; i++) {
        comboPopup.showJudgement(JudgementType.SICK, 999);
      }

      // After cleanup, should be limited
      expect(comboPopup.activeNumbers.length).toBeLessThanOrEqual(comboPopup.maxActive * 4);
    });
  });

  describe('setPosition', () => {
    it('should set position', () => {
      comboPopup.setPosition(100, 200);

      expect(comboPopup.x).toBe(100);
      expect(comboPopup.y).toBe(200);
    });

    it('should return this for chaining', () => {
      const result = comboPopup.setPosition(100, 200);
      expect(result).toBe(comboPopup);
    });
  });

  describe('setScale', () => {
    it('should set scale', () => {
      comboPopup.setScale(1.5);
      expect(comboPopup.scale).toBe(1.5);
    });

    it('should return this for chaining', () => {
      const result = comboPopup.setScale(1.5);
      expect(result).toBe(comboPopup);
    });
  });

  describe('setShowComboNumbers', () => {
    it('should set showComboNumbers', () => {
      comboPopup.setShowComboNumbers(false);
      expect(comboPopup.showComboNumbers).toBe(false);
    });

    it('should return this for chaining', () => {
      const result = comboPopup.setShowComboNumbers(true);
      expect(result).toBe(comboPopup);
    });
  });

  describe('getActiveJudgementCount', () => {
    it('should return count of active judgements', () => {
      comboPopup.showJudgement(JudgementType.SICK);
      comboPopup.showJudgement(JudgementType.GOOD);

      expect(comboPopup.getActiveJudgementCount()).toBe(2);
    });
  });

  describe('getActiveNumberCount', () => {
    it('should return count of active numbers', () => {
      comboPopup.showComboNumber(123, 0, 0);

      expect(comboPopup.getActiveNumberCount()).toBe(3);
    });
  });

  describe('getActiveSprites', () => {
    it('should return all active sprites', () => {
      comboPopup.showJudgement(JudgementType.SICK, 25);

      const sprites = comboPopup.getActiveSprites();

      expect(sprites.length).toBe(3); // 1 judgement + 2 digits
    });
  });

  describe('clear', () => {
    it('should clear all active sprites', () => {
      comboPopup.showJudgement(JudgementType.SICK, 25);

      comboPopup.clear();

      expect(comboPopup.activeJudgements.length).toBe(0);
      expect(comboPopup.activeNumbers.length).toBe(0);
    });

    it('should return sprites to pools', () => {
      comboPopup.showJudgement(JudgementType.SICK, 25);

      comboPopup.clear();

      expect(comboPopup.judgementPool.length).toBe(1);
      expect(comboPopup.numberPool.length).toBe(2);
    });
  });

  describe('getJudgementColor', () => {
    it('should return correct colors', () => {
      expect(ComboPopup.getJudgementColor(JudgementType.KILLER)).toBe(0xffffff);
      expect(ComboPopup.getJudgementColor(JudgementType.SICK)).toBe(0x00ffff);
      expect(ComboPopup.getJudgementColor(JudgementType.GOOD)).toBe(0x00ff00);
      expect(ComboPopup.getJudgementColor(JudgementType.BAD)).toBe(0xffff00);
      expect(ComboPopup.getJudgementColor(JudgementType.SHIT)).toBe(0xff0000);
    });

    it('should return white for unknown judgement', () => {
      expect(ComboPopup.getJudgementColor('unknown')).toBe(0xffffff);
    });
  });

  describe('getJudgementName', () => {
    it('should return correct names', () => {
      expect(ComboPopup.getJudgementName(JudgementType.KILLER)).toBe('KILLER');
      expect(ComboPopup.getJudgementName(JudgementType.SICK)).toBe('SICK!!');
      expect(ComboPopup.getJudgementName(JudgementType.GOOD)).toBe('GOOD!');
      expect(ComboPopup.getJudgementName(JudgementType.BAD)).toBe('BAD');
      expect(ComboPopup.getJudgementName(JudgementType.SHIT)).toBe('SHIT');
    });

    it('should uppercase unknown judgement', () => {
      expect(ComboPopup.getJudgementName('test')).toBe('TEST');
    });
  });

  describe('destroy', () => {
    it('should clear all sprites and pools', () => {
      comboPopup.showJudgement(JudgementType.SICK, 25);

      comboPopup.destroy();

      expect(comboPopup.activeJudgements.length).toBe(0);
      expect(comboPopup.activeNumbers.length).toBe(0);
      expect(comboPopup.judgementPool.length).toBe(0);
      expect(comboPopup.numberPool.length).toBe(0);
      expect(comboPopup.scene).toBeNull();
    });
  });

  // Validates: Requirements 2.3, 2.4, 2.7
  describe('rendering with a scene (Requirements 2.3, 2.4, 2.7)', () => {
    it('should create real game objects on showJudgement for judgement and combo numbers', () => {
      const scene = createRenderingScene();
      const popup = new ComboPopup(scene, { showComboNumbers: true });

      popup.showJudgement(JudgementType.SICK, 25);

      // 1 judgement label + 2 combo digits = 3 game objects
      expect(scene.created.length).toBe(3);
      expect(scene.add.text).toHaveBeenCalledTimes(3);

      // Each active record is backed by a real game object
      const sprites = popup.getActiveSprites();
      expect(sprites.length).toBe(3);
      for (const sprite of sprites) {
        expect(sprite.gameObject).toBeTruthy();
        expect(sprite.gameObject.setOrigin).toHaveBeenCalled();
        expect(sprite.gameObject.setDepth).toHaveBeenCalledWith(popup.depth);
      }

      popup.destroy();
    });

    it('should use loaded combo-number textures via add.image when available', () => {
      const scene = createRenderingScene({ texturesExist: true });
      const popup = new ComboPopup(scene, { showComboNumbers: true });

      popup.showJudgement(JudgementType.GOOD, 5);

      // Judgement still uses text; the single digit uses an image texture
      expect(scene.add.text).toHaveBeenCalledTimes(1);
      expect(scene.add.image).toHaveBeenCalledTimes(1);

      popup.destroy();
    });

    it('should apply tracked state to game objects every update (Requirement 2.3)', () => {
      const scene = createRenderingScene();
      const popup = new ComboPopup(scene);

      popup.showJudgement(JudgementType.SICK);
      const record = popup.activeJudgements[0];
      const gameObject = record.gameObject;

      gameObject.setPosition.mockClear();
      gameObject.setAlpha.mockClear();
      gameObject.setScale.mockClear();
      gameObject.setVisible.mockClear();

      popup.update(16.67);

      expect(gameObject.setPosition).toHaveBeenCalledWith(record.x, record.y);
      expect(gameObject.setAlpha).toHaveBeenCalledWith(record.alpha);
      expect(gameObject.setScale).toHaveBeenCalledWith(record.scale);
      expect(gameObject.setVisible).toHaveBeenCalledWith(record.visible);

      popup.destroy();
    });

    it('should hide the game object when a popup is recycled to the pool (Requirement 2.4)', () => {
      const scene = createRenderingScene();
      const popup = new ComboPopup(scene);

      popup.showJudgement(JudgementType.SICK);
      const record = popup.activeJudgements[0];
      const gameObject = record.gameObject;

      // Force lifetime past max so the record is recycled
      record.lifetime = record.maxLifetime + 100;
      gameObject.setVisible.mockClear();

      popup.update(16.67);

      expect(popup.activeJudgements.length).toBe(0);
      expect(popup.judgementPool.length).toBe(1);
      // Recycled record was hidden, not destroyed
      expect(gameObject.setVisible).toHaveBeenCalledWith(false);
      expect(gameObject.destroyed).toBe(false);

      popup.destroy();
    });

    it('should destroy all active and pooled game objects on destroy (Requirement 2.7)', () => {
      const scene = createRenderingScene();
      const popup = new ComboPopup(scene);

      // Active judgement + combo numbers
      popup.showJudgement(JudgementType.SICK, 12);
      // Recycle one sprite into the pool so destroy must cover pooled objects too
      popup.showJudgement(JudgementType.GOOD);
      const recycled = popup.activeJudgements[popup.activeJudgements.length - 1];
      recycled.lifetime = recycled.maxLifetime + 100;
      popup.update(16.67);
      expect(popup.judgementPool.length).toBeGreaterThan(0);

      const allCreated = [...scene.created];
      expect(allCreated.length).toBeGreaterThan(0);

      popup.destroy();

      // Every game object ever created is destroyed
      for (const obj of allCreated) {
        expect(obj.destroy).toHaveBeenCalled();
        expect(obj.destroyed).toBe(true);
      }
    });
  });

  // Validates: Requirements 2.3, 2.4, 2.7
  describe('headless data path without a scene', () => {
    it('should not create game objects and not throw when scene lacks add', () => {
      const popup = new ComboPopup(createMockScene(), { showComboNumbers: true });

      expect(() => popup.showJudgement(JudgementType.SICK, 25)).not.toThrow();

      // Data path still tracks records...
      expect(popup.getActiveJudgementCount()).toBe(1);
      expect(popup.getActiveNumberCount()).toBe(2);
      // ...but no game objects were attached
      for (const sprite of popup.getActiveSprites()) {
        expect(sprite.gameObject).toBeFalsy();
      }

      popup.destroy();
    });

    it('should keep pooling and lifetime logic intact headless', () => {
      const popup = new ComboPopup(createMockScene());

      popup.showJudgement(JudgementType.SICK);
      const sprite = popup.activeJudgements[0];
      sprite.lifetime = sprite.maxLifetime + 100;

      expect(() => popup.update(16.67)).not.toThrow();

      expect(popup.activeJudgements.length).toBe(0);
      expect(popup.judgementPool.length).toBe(1);

      popup.destroy();
    });

    it('should not throw on destroy with no scene', () => {
      const popup = new ComboPopup(null);
      popup.showJudgement(JudgementType.GOOD, 3);

      expect(() => popup.destroy()).not.toThrow();
      expect(popup.scene).toBeNull();
    });
  });
});

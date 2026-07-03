/**
 * @fileoverview Tests for HealthIconTextures - texture acquisition helper.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as Constants from '../src/core/Constants.js';
import {
  acquireHealthIconTexture,
  ensurePlaceholderTexture,
  getIconTextureKey,
  getPlaceholderColor,
  getPlaceholderTextureKey,
  ICON_TEXTURE_PREFIX,
  PLACEHOLDER_TEXTURE_PREFIX
} from '../src/play/HealthIconTextures.js';

/**
 * Create a mock scene that can both report existing textures and generate new
 * ones via add.graphics().generateTexture() (the Generated_Texture_Pattern).
 * @param {{ existingKeys?: string[] }} [opts]
 */
const createRenderingScene = ({ existingKeys = [] } = {}) => {
  const textureKeys = new Set(existingKeys);
  const graphicsObjects = [];
  return {
    textureKeys,
    graphicsObjects,
    textures: {
      exists: vi.fn((key) => textureKeys.has(key))
    },
    add: {
      graphics: vi.fn(() => {
        const g = {
          clear: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          fillCircle: vi.fn().mockReturnThis(),
          strokeCircle: vi.fn().mockReturnThis(),
          generateTexture: vi.fn((key) => {
            textureKeys.add(key);
          }),
          destroy: vi.fn()
        };
        graphicsObjects.push(g);
        return g;
      })
    }
  };
};

/** A minimal icon stub that records the assigned texture. */
const createIconStub = (characterId = 'bf', playerId = 0) => ({
  characterId,
  playerId,
  texture: null,
  setTexture: vi.fn(function setTexture(key) {
    this.texture = key;
    return this;
  })
});

describe('HealthIconTextures', () => {
  describe('key/color helpers', () => {
    it('builds icon texture keys with the icon prefix', () => {
      expect(getIconTextureKey('bf')).toBe(`${ICON_TEXTURE_PREFIX}-bf`);
    });

    it('falls back to the default health icon id', () => {
      expect(getIconTextureKey()).toBe(`${ICON_TEXTURE_PREFIX}-${Constants.DEFAULT_HEALTH_ICON}`);
    });

    it('builds placeholder keys per side', () => {
      expect(getPlaceholderTextureKey(0)).toBe(`${PLACEHOLDER_TEXTURE_PREFIX}-player`);
      expect(getPlaceholderTextureKey(1)).toBe(`${PLACEHOLDER_TEXTURE_PREFIX}-opponent`);
    });

    it('uses green for the player and red for the opponent', () => {
      expect(getPlaceholderColor(0)).toBe(Constants.COLOR_HEALTH_BAR_GREEN);
      expect(getPlaceholderColor(1)).toBe(Constants.COLOR_HEALTH_BAR_RED);
    });
  });

  describe('ensurePlaceholderTexture', () => {
    it('generates a placeholder texture when missing', () => {
      const scene = createRenderingScene();
      const key = ensurePlaceholderTexture(scene, 0);

      expect(key).toBe(getPlaceholderTextureKey(0));
      expect(scene.textures.exists(key)).toBe(true);
      expect(scene.add.graphics).toHaveBeenCalledTimes(1);
      const g = scene.graphicsObjects[0];
      expect(g.generateTexture).toHaveBeenCalledWith(key, expect.any(Number), expect.any(Number));
      expect(g.destroy).toHaveBeenCalled();
    });

    it('reuses an existing placeholder texture', () => {
      const scene = createRenderingScene({ existingKeys: [getPlaceholderTextureKey(1)] });
      const key = ensurePlaceholderTexture(scene, 1);

      expect(key).toBe(getPlaceholderTextureKey(1));
      expect(scene.add.graphics).not.toHaveBeenCalled();
    });

    it('no-ops in a headless scene', () => {
      expect(ensurePlaceholderTexture(null, 0)).toBeNull();
      expect(ensurePlaceholderTexture({}, 0)).toBeNull();
      expect(ensurePlaceholderTexture({ textures: { exists: () => false } }, 0)).toBeNull();
    });
  });

  describe('acquireHealthIconTexture', () => {
    it('assigns a real icon texture when present', () => {
      const realKey = getIconTextureKey('bf');
      const scene = createRenderingScene({ existingKeys: [realKey] });
      const icon = createIconStub('bf', 0);

      const result = acquireHealthIconTexture(scene, icon);

      expect(result).toEqual({ key: realKey, isPlaceholder: false });
      expect(icon.setTexture).toHaveBeenCalledWith(realKey);
      expect(icon.texture).toBe(realKey);
      expect(scene.add.graphics).not.toHaveBeenCalled();
    });

    it('generates a color-coded placeholder when no real texture exists', () => {
      const scene = createRenderingScene();
      const icon = createIconStub('dad', 1);

      const result = acquireHealthIconTexture(scene, icon);

      expect(result.isPlaceholder).toBe(true);
      expect(result.key).toBe(getPlaceholderTextureKey(1));
      expect(icon.texture).toBe(getPlaceholderTextureKey(1));
    });

    it('honors an explicit textureKey override', () => {
      const realKey = 'custom-icon-key';
      const scene = createRenderingScene({ existingKeys: [realKey] });
      const icon = createIconStub('bf', 0);

      const result = acquireHealthIconTexture(scene, icon, { textureKey: realKey });

      expect(result).toEqual({ key: realKey, isPlaceholder: false });
      expect(icon.texture).toBe(realKey);
    });

    it('derives character/player from options over the icon', () => {
      const scene = createRenderingScene();
      const icon = createIconStub('bf', 0);

      const result = acquireHealthIconTexture(scene, icon, { playerId: 1 });

      expect(result.key).toBe(getPlaceholderTextureKey(1));
    });

    it('returns a null assignment in a headless scene without throwing', () => {
      const icon = createIconStub('bf', 0);

      const result = acquireHealthIconTexture(null, icon);

      expect(result).toEqual({ key: null, isPlaceholder: false });
      expect(icon.setTexture).not.toHaveBeenCalled();
    });
  });
});

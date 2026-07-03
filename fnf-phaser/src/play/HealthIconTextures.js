/**
 * @fileoverview HealthIconTextures - texture acquisition helper for HealthIcon.
 *
 * Guarantees that a health icon always has a visible texture: it assigns a real
 * character icon texture when one is already loaded in `scene.textures`, and
 * otherwise generates a color-coded circular placeholder using the same
 * Generated_Texture_Pattern as {@link module:play/GeneratedGameplaySkin}.
 *
 * All rendering/generation is guarded so headless test environments (scenes
 * without `textures`/`add.graphics`) and teardown races never throw.
 */

import * as Constants from '../core/Constants.js';

/** Prefix used for real (loaded) character icon textures. */
export const ICON_TEXTURE_PREFIX = 'healthicon';

/** Prefix used for generated placeholder icon textures. */
export const PLACEHOLDER_TEXTURE_PREFIX = 'generated-healthicon';

/** Side length (px) of generated placeholder textures. */
export const PLACEHOLDER_TEXTURE_SIZE = 150;

/**
 * Build the conventional texture key for a real character icon.
 * @param {string} [characterId] - Character/icon id (defaults to DEFAULT_HEALTH_ICON)
 * @returns {string}
 */
export function getIconTextureKey(characterId) {
  return `${ICON_TEXTURE_PREFIX}-${characterId ?? Constants.DEFAULT_HEALTH_ICON}`;
}

/**
 * Pick a placeholder fill color based on whether the icon is the player or
 * the opponent. Player icons are green; opponent icons are red.
 * @param {number} [playerId=0] - 0 = player, 1 = opponent
 * @returns {number}
 */
export function getPlaceholderColor(playerId = 0) {
  return playerId === 0 ? Constants.COLOR_HEALTH_BAR_GREEN : Constants.COLOR_HEALTH_BAR_RED;
}

/**
 * Build the texture key for a generated placeholder icon.
 * @param {number} [playerId=0] - 0 = player, 1 = opponent
 * @returns {string}
 */
export function getPlaceholderTextureKey(playerId = 0) {
  return `${PLACEHOLDER_TEXTURE_PREFIX}-${playerId === 0 ? 'player' : 'opponent'}`;
}

/**
 * Ensure a color-coded circular placeholder texture exists for the given side,
 * generating it via the Generated_Texture_Pattern if needed.
 *
 * No-ops (returning `null`) when the scene cannot render textures, so headless
 * environments are safe.
 *
 * @param {Phaser.Scene | null | undefined} scene - The Phaser scene
 * @param {number} [playerId=0] - 0 = player, 1 = opponent
 * @returns {string | null} The placeholder texture key, or null if unavailable
 */
export function ensurePlaceholderTexture(scene, playerId = 0) {
  if (!scene?.textures || typeof scene.add?.graphics !== 'function') {
    return null;
  }

  const key = getPlaceholderTextureKey(playerId);
  if (scene.textures.exists?.(key)) {
    return key;
  }

  const size = PLACEHOLDER_TEXTURE_SIZE;
  const radius = size / 2 - 6;
  const color = getPlaceholderColor(playerId);

  const graphics = scene.add.graphics();
  graphics.clear();
  graphics.fillStyle(color, 1);
  graphics.lineStyle(6, 0xffffff, 1);
  graphics.fillCircle(size / 2, size / 2, radius);
  graphics.strokeCircle(size / 2, size / 2, radius);
  graphics.generateTexture(key, size, size);
  graphics.destroy();

  return key;
}

/**
 * Acquire and assign a texture for a health icon so that it is always visible.
 *
 * Prefers a real loaded icon texture when present in `scene.textures`; otherwise
 * generates (or reuses) a color-coded circular placeholder and assigns that.
 *
 * @param {Phaser.Scene | null | undefined} scene - The Phaser scene
 * @param {{ setTexture?: Function, characterId?: string, playerId?: number } | null} icon
 *   - The HealthIcon (or compatible sprite) to assign the texture to
 * @param {{ characterId?: string, playerId?: number, textureKey?: string }} [options]
 *   - Optional overrides; `textureKey` forces a specific real-texture key
 * @returns {{ key: string | null, isPlaceholder: boolean }}
 *   The assigned texture key and whether it is a generated placeholder
 */
export function acquireHealthIconTexture(scene, icon, options = {}) {
  const characterId = options.characterId ?? icon?.characterId ?? Constants.DEFAULT_HEALTH_ICON;
  const playerId = options.playerId ?? icon?.playerId ?? 0;
  const realKey = options.textureKey ?? getIconTextureKey(characterId);

  // Prefer a real, already-loaded icon texture.
  if (scene?.textures?.exists?.(realKey)) {
    icon?.setTexture?.(realKey);
    return { key: realKey, isPlaceholder: false };
  }

  // Fall back to a generated color-coded placeholder.
  const placeholderKey = ensurePlaceholderTexture(scene, playerId);
  if (placeholderKey) {
    icon?.setTexture?.(placeholderKey);
    return { key: placeholderKey, isPlaceholder: true };
  }

  // Headless / unavailable scene: nothing to assign.
  return { key: null, isPlaceholder: false };
}

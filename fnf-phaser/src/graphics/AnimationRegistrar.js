/**
 * @fileoverview AnimationRegistrar - Registers Phaser animations from registry data.
 * Bridges CharacterRegistry/StageRegistry animation definitions to Phaser's animation system.
 */

/**
 * Register Phaser animations for a character from CharacterRegistry animation data.
 * @param {Phaser.Scene} scene - The Phaser scene to register animations on
 * @param {string} textureKey - The loaded atlas texture key
 * @param {Record<string, any>[]} animations - Animation data array from CharacterRegistry
 * @returns {Object[]} Array of created animation configs
 */
export function registerCharacterAnimations(scene, textureKey, animations) {
  const results = [];

  for (const anim of animations) {
    /** @type {{ prefix: any, frames?: number[] }} */
    const frameConfig = { prefix: anim.prefix };
    if (anim.frameIndices) {
      frameConfig.frames = anim.frameIndices;
    }

    const frames = scene.anims.generateFrameNames(textureKey, frameConfig);

    // Skip animations with no valid frames in the atlas
    if (!frames || frames.length === 0) {
      continue;
    }

    // Namespace animation key by texture to avoid collisions between characters
    const animKey = `${textureKey}-${anim.name}`;

    // Don't re-create if already registered
    if (scene.anims.exists(animKey)) {
      results.push(scene.anims.get(animKey));
      continue;
    }

    const config = {
      key: animKey,
      frames,
      frameRate: anim.frameRate,
      repeat: anim.looped ? -1 : 0
    };

    const created = scene.anims.create(config);
    results.push(created);
  }

  return results;
}

/**
 * Register Phaser animations for a stage prop from StagePropData animation data.
 * @param {Phaser.Scene} scene - The Phaser scene to register animations on
 * @param {string} textureKey - The loaded atlas texture key
 * @param {Record<string, any>[]} animations - Animation data array from StagePropData
 * @returns {Object[]} Array of created animation configs
 */
export function registerPropAnimations(scene, textureKey, animations) {
  if (!animations || animations.length === 0) {
    return [];
  }

  const results = [];

  for (const anim of animations) {
    const frames = scene.anims.generateFrameNames(textureKey, { prefix: anim.prefix });
    if (!frames || frames.length === 0) {
      continue;
    }

    const animKey = `${textureKey}-${anim.name}`;
    if (scene.anims.exists(animKey)) {
      results.push(scene.anims.get(animKey));
      continue;
    }

    const config = {
      key: animKey,
      frames,
      frameRate: anim.frameRate,
      repeat: anim.looped ? -1 : 0
    };

    const created = scene.anims.create(config);
    results.push(created);
  }

  return results;
}

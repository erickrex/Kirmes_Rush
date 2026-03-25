/**
 * @fileoverview AnimationRegistrar - Registers Phaser animations from registry data.
 * Bridges CharacterRegistry/StageRegistry animation definitions to Phaser's animation system.
 */

/**
 * Register Phaser animations for a character from CharacterRegistry animation data.
 * @param {Phaser.Scene} scene - The Phaser scene to register animations on
 * @param {string} textureKey - The loaded atlas texture key
 * @param {Object[]} animations - Animation data array from CharacterRegistry
 * @returns {Object[]} Array of created animation configs
 */
export function registerCharacterAnimations(scene, textureKey, animations) {
  const results = [];

  for (const anim of animations) {
    const frameConfig = { prefix: anim.prefix };
    if (anim.frameIndices) {
      frameConfig.frames = anim.frameIndices;
    }

    const config = {
      key: anim.name,
      frames: scene.anims.generateFrameNames(textureKey, frameConfig),
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
 * @param {Object[]} animations - Animation data array from StagePropData
 * @returns {Object[]} Array of created animation configs
 */
export function registerPropAnimations(scene, textureKey, animations) {
  if (!animations || animations.length === 0) {
    return [];
  }

  const results = [];

  for (const anim of animations) {
    const config = {
      key: anim.name,
      frames: scene.anims.generateFrameNames(textureKey, { prefix: anim.prefix }),
      frameRate: anim.frameRate,
      repeat: anim.looped ? -1 : 0
    };

    const created = scene.anims.create(config);
    results.push(created);
  }

  return results;
}

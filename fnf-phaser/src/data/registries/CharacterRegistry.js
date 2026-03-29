/**
 * @fileoverview CharacterRegistry - Config-driven registry for character data
 * Manages loading and caching of character definitions for Friday Night Funkin'.
 */

import { createRegistry } from '../../core/Registry.js';
import { getSharedRegistryPath } from '../../utils/GameDataPaths.js';

// Types are defined locally in this file (CharacterCleanedData, CharacterEntry, etc.)

/**
 * @typedef {Object} HealthIconData
 * @property {string | null} [id] - Icon ID (defaults to character ID)
 * @property {number} [scale=1] - Icon scale
 * @property {boolean} [flipX=false] - Flip icon horizontally
 * @property {boolean} [isPixel=false] - Use pixel rendering
 * @property {number[]} [offsets=[0,25]] - Icon offsets
 */

/**
 * @typedef {Object} DeathData
 * @property {number[]} [cameraOffsets=[0,0]] - Camera offset during death
 * @property {number} [cameraZoom=1.0] - Camera zoom during death
 * @property {number} [preTransitionDelay=0] - Delay before death animation
 */

/**
 * Raw character animation data from JSON before cleaning.
 * @typedef {Object} RawCharacterAnimationData
 * @property {string} name - Animation name
 * @property {string} [prefix] - Frame prefix in atlas
 * @property {number[]} [offsets] - X, Y offset
 * @property {number} [frameRate] - Frames per second
 * @property {boolean} [looped] - Whether animation loops
 * @property {boolean} [flipX] - Flip horizontally
 * @property {boolean} [flipY] - Flip vertically
 * @property {number[] | null} [frameIndices] - Specific frame indices
 * @property {string | null} [assetPath] - Asset path override
 */

/**
 * Raw character data as read from JSON before cleaning/validation.
 * @typedef {Object} RawCharacterData
 * @property {string} [version] - Data format version
 * @property {string} [name] - Display name
 * @property {string} [renderType] - Render type (sparrow, packer, etc.)
 * @property {string} [assetPath] - Path to sprite assets
 * @property {number} [scale] - Scale multiplier
 * @property {Object} [healthIcon] - Health icon configuration
 * @property {Object} [death] - Death animation configuration
 * @property {number[]} [offsets] - Position offsets
 * @property {number[]} [cameraOffsets] - Camera offsets
 * @property {boolean} [isPixel] - Whether this is pixel art
 * @property {number} [danceEvery] - Dance frequency in beats
 * @property {number} [singTime] - Sing hold time in steps
 * @property {RawCharacterAnimationData[]} [animations] - Animation definitions
 * @property {string} [startingAnimation] - Starting animation name
 * @property {boolean} [flipX] - Flip sprite horizontally
 */

/**
 * Cleaned/normalized animation data after processing.
 * @typedef {Object} CleanedAnimationData
 * @property {string} name - Animation name
 * @property {string} prefix - Frame prefix in atlas
 * @property {number[]} offsets - X, Y offset
 * @property {number} frameRate - Frames per second
 * @property {boolean} looped - Whether animation loops
 * @property {boolean} flipX - Flip horizontally
 * @property {boolean} flipY - Flip vertically
 * @property {number[] | null} frameIndices - Specific frame indices
 * @property {string | null} assetPath - Asset path override
 */

/**
 * Cleaned/normalized character data after processing raw JSON.
 * @typedef {Object} CharacterCleanedData
 * @property {string} version - Data format version
 * @property {string} name - Display name
 * @property {string} renderType - Render type
 * @property {string} assetPath - Path to sprite assets
 * @property {number} scale - Scale multiplier
 * @property {HealthIconData} healthIcon - Health icon configuration
 * @property {DeathData} death - Death animation configuration
 * @property {number[]} offsets - Position offsets
 * @property {number[]} cameraOffsets - Camera offsets
 * @property {boolean} isPixel - Whether this is pixel art
 * @property {number} danceEvery - Dance frequency in beats
 * @property {number} singTime - Sing hold time in steps
 * @property {CleanedAnimationData[]} animations - Animation definitions
 * @property {string} startingAnimation - Starting animation name
 * @property {boolean} flipX - Flip sprite horizontally
 */

/**
 * A character registry entry with ID, cleaned data, and derived fields.
 * @typedef {Object} CharacterEntry
 * @property {string} id - Character ID
 * @property {CharacterCleanedData} data - Cleaned character data
 * @property {string} name - Display name
 * @property {string} renderType - Render type
 * @property {string[]} animationNames - List of animation names
 * @property {function(): void} destroy - Cleanup function
 */

/**
 * Character display info returned by getCharacterDisplayInfo.
 * @typedef {Object} CharacterDisplayInfo
 * @property {string} id - Character ID
 * @property {string} name - Display name
 * @property {string} renderType - Render type
 * @property {boolean} isPixel - Whether this is pixel art
 * @property {number} scale - Scale multiplier
 * @property {number} animationCount - Number of animations
 * @property {boolean} hasDeathAnimation - Whether character has death animation
 * @property {string} healthIconId - Health icon ID
 */

const RenderType = {
  SPARROW: 'sparrow',
  PACKER: 'packer',
  MULTI_SPARROW: 'multisparrow',
  ANIMATE_ATLAS: 'animateatlas',
  CUSTOM: 'custom'
};

const DEFAULTS = {
  VERSION: '1.0.0',
  VERSION_RULE: '1.0.x',
  SING_TIME: 8.0,
  DANCE_EVERY: 1.0,
  FLIP_X: false,
  FLIP_Y: false,
  FRAME_RATE: 24,
  IS_PIXEL: false,
  LOOP: false,
  NAME: 'Untitled Character',
  OFFSETS: [0, 0],
  HEALTH_ICON_OFFSETS: [0, 25],
  RENDER_TYPE: RenderType.SPARROW,
  SCALE: 1,
  STARTING_ANIM: 'idle'
};

// ========================================
// CLEANING HELPERS
// ========================================

/**
 * Clean raw animation data into normalized form.
 * @param {RawCharacterAnimationData} anim - Raw animation data
 * @returns {CleanedAnimationData}
 */
function cleanAnimationData(anim) {
  return {
    name: anim.name,
    prefix: anim.prefix || anim.name,
    offsets: anim.offsets || [...DEFAULTS.OFFSETS],
    frameRate: anim.frameRate ?? DEFAULTS.FRAME_RATE,
    looped: anim.looped ?? DEFAULTS.LOOP,
    flipX: anim.flipX ?? DEFAULTS.FLIP_X,
    flipY: anim.flipY ?? DEFAULTS.FLIP_Y,
    frameIndices: anim.frameIndices || null,
    assetPath: anim.assetPath || null
  };
}

/**
 * Clean raw health icon data into normalized form.
 * @param {Record<string, any> | undefined} iconData - Raw health icon data
 * @param {RawCharacterData} charData - Parent character data for fallback values
 * @returns {HealthIconData}
 */
function cleanHealthIconData(iconData, charData) {
  const icon = iconData || {};
  return {
    id: icon.id || null,
    scale: icon.scale ?? DEFAULTS.SCALE,
    flipX: icon.flipX ?? DEFAULTS.FLIP_X,
    isPixel: icon.isPixel ?? charData.isPixel ?? DEFAULTS.IS_PIXEL,
    offsets: icon.offsets || [...DEFAULTS.HEALTH_ICON_OFFSETS]
  };
}

/**
 * Clean raw death data into normalized form.
 * @param {Record<string, any> | undefined} deathData - Raw death data
 * @returns {DeathData}
 */
function cleanDeathData(deathData) {
  const death = deathData || {};
  return {
    cameraOffsets: death.cameraOffsets || [...DEFAULTS.OFFSETS],
    cameraZoom: death.cameraZoom ?? 1.0,
    preTransitionDelay: death.preTransitionDelay ?? 0
  };
}

// ========================================
// CONFIG-DRIVEN REGISTRY
// ========================================

const CharacterRegistry = createRegistry(
  {
    registryId: 'CHARACTER',
    dataFilePath: getSharedRegistryPath('characters'),
    versionRule: DEFAULTS.VERSION_RULE,
    entityName: 'Character',

    /**
     * @param {RawCharacterData} data
     * @param {string} [fileName]
     * @returns {boolean}
     */
    validateData(data, fileName) {
      if (!data.version) {
        console.warn(
          `[${this.registryId}] No version for: ${fileName}, assuming ${DEFAULTS.VERSION}`
        );
      }
      if (!data.assetPath) {
        console.error(`[${this.registryId}] Missing assetPath for: ${fileName}`);
        return false;
      }
      if (!data.animations || !Array.isArray(data.animations) || data.animations.length === 0) {
        console.error(`[${this.registryId}] Missing or empty animations for: ${fileName}`);
        return false;
      }
      for (const anim of data.animations) {
        if (!anim.name) {
          console.error(`[${this.registryId}] Animation missing name in: ${fileName}`);
          return false;
        }
      }
      return true;
    },

    /**
     * @param {RawCharacterData} data
     * @returns {CharacterCleanedData}
     */
    cleanData(data) {
      return {
        version: data.version || DEFAULTS.VERSION,
        name: data.name || DEFAULTS.NAME,
        renderType: data.renderType || DEFAULTS.RENDER_TYPE,
        assetPath: /** @type {string} */ (data.assetPath),
        scale: data.scale ?? DEFAULTS.SCALE,
        healthIcon: cleanHealthIconData(data.healthIcon, data),
        death: cleanDeathData(data.death),
        offsets: data.offsets || [...DEFAULTS.OFFSETS],
        cameraOffsets: data.cameraOffsets || [...DEFAULTS.OFFSETS],
        isPixel: data.isPixel ?? DEFAULTS.IS_PIXEL,
        danceEvery: data.danceEvery ?? DEFAULTS.DANCE_EVERY,
        singTime: data.singTime ?? DEFAULTS.SING_TIME,
        animations: /** @type {RawCharacterAnimationData[]} */ (data.animations).map(
          cleanAnimationData
        ),
        startingAnimation: data.startingAnimation || DEFAULTS.STARTING_ANIM,
        flipX: data.flipX ?? DEFAULTS.FLIP_X
      };
    },

    /**
     * @param {string} id
     * @param {CharacterCleanedData} data
     * @returns {CharacterEntry}
     */
    createEntry(id, data) {
      return {
        id,
        data,
        name: data.name,
        renderType: data.renderType,
        animationNames: data.animations.map((/** @type {CleanedAnimationData} */ a) => a.name),
        destroy: () => {}
      };
    }
  },
  {
    statics: { RenderType, DEFAULTS },
    methods: {
      // ========================================
      // CHARACTER ACCESS METHODS
      // ========================================

      /**
       * Get the render type for a character.
       * @param {string} charId - Character ID
       * @returns {string}
       */
      getCharacterRenderType(charId) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.renderType : DEFAULTS.RENDER_TYPE;
      },

      /**
       * Get all animations for a character.
       * @param {string} charId - Character ID
       * @returns {CleanedAnimationData[]}
       */
      getCharacterAnimations(charId) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.data.animations : [];
      },

      /**
       * Get a specific animation by name.
       * @param {string} charId - Character ID
       * @param {string} animName - Animation name
       * @returns {CleanedAnimationData | null}
       */
      getAnimation(charId, animName) {
        const animations = this.getCharacterAnimations(charId);
        return (
          animations.find((/** @type {CleanedAnimationData} */ a) => a.name === animName) || null
        );
      },

      /**
       * Check if a character has a specific animation.
       * @param {string} charId - Character ID
       * @param {string} animName - Animation name
       * @returns {boolean}
       */
      hasAnimation(charId, animName) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.animationNames.includes(animName) : false;
      },

      /**
       * Get the asset path for a character.
       * @param {string} charId - Character ID
       * @returns {string | null}
       */
      getAssetPath(charId) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.data.assetPath : null;
      },

      /**
       * Get health icon data for a character.
       * @param {string} charId - Character ID
       * @returns {HealthIconData | null}
       */
      getHealthIconData(charId) {
        const entry = this.fetchEntry(charId);
        if (!entry) {
          return null;
        }

        const iconData = { ...entry.data.healthIcon };
        if (!iconData.id) {
          iconData.id = charId;
        }
        return iconData;
      },

      // ========================================
      // LISTING METHODS
      // ========================================

      /**
       * Get all characters with a specific render type.
       * @param {string} renderType - Render type to filter by
       * @returns {CharacterEntry[]}
       */
      getCharactersByRenderType(renderType) {
        return this.getAllEntries().filter(
          (/** @type {CharacterEntry} */ entry) => entry.renderType === renderType
        );
      },

      /**
       * Get all playable characters (those with miss animations).
       * @returns {CharacterEntry[]}
       */
      getPlayableCharacters() {
        return this.getAllEntries().filter((/** @type {CharacterEntry} */ entry) => {
          return entry.animationNames.some((/** @type {string} */ name) => name.includes('miss'));
        });
      },

      /**
       * Get display info for a character.
       * @param {string} charId - Character ID
       * @returns {CharacterDisplayInfo | null}
       */
      getCharacterDisplayInfo(charId) {
        const entry = this.fetchEntry(charId);
        if (!entry) {
          return null;
        }

        return {
          id: entry.id,
          name: entry.name,
          renderType: entry.renderType,
          isPixel: entry.data.isPixel,
          scale: entry.data.scale,
          animationCount: entry.animationNames.length,
          hasDeathAnimation: entry.animationNames.includes('firstDeath'),
          healthIconId: entry.data.healthIcon.id || entry.id
        };
      },

      // ========================================
      // UTILITY METHODS
      // ========================================

      /**
       * Get the full sprite asset path for a character.
       * @param {string} charId - Character ID
       * @returns {string | null}
       */
      getSpriteAssetPath(charId) {
        const entry = this.fetchEntry(charId);
        if (!entry) {
          return null;
        }
        return `images/${entry.data.assetPath}`;
      },

      /**
       * Get the XML asset path for sparrow/multisparrow characters.
       * @param {string} charId - Character ID
       * @returns {string | null}
       */
      getXmlAssetPath(charId) {
        const entry = this.fetchEntry(charId);
        if (!entry) {
          return null;
        }

        if (
          entry.renderType !== RenderType.SPARROW &&
          entry.renderType !== RenderType.MULTI_SPARROW
        ) {
          return null;
        }

        return `images/${entry.data.assetPath}.xml`;
      },

      /** @returns {string} */
      toString() {
        return `CharacterRegistry(${this.countEntries()} characters)`;
      }
    }
  }
);

// Static helper methods (not instance methods)
const /** @type {Record<string, any>} */ charRegistryStatic = /** @type {any} */ (
    CharacterRegistry
  );

/**
 * Get the sing animation name for a direction.
 * @param {number} direction - Note direction (0-3)
 * @param {boolean} [miss=false] - Whether this is a miss animation
 * @returns {string}
 */
charRegistryStatic.getSingAnimationName = function (direction, miss = false) {
  const directions = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
  const dirName = directions[direction] || 'LEFT';
  return miss ? `sing${dirName}miss` : `sing${dirName}`;
};

/**
 * Get the hold animation name for a direction.
 * @param {number} direction - Note direction (0-3)
 * @returns {string}
 */
charRegistryStatic.getHoldAnimationName = function (direction) {
  const directions = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
  const dirName = directions[direction] || 'LEFT';
  return `sing${dirName}-hold`;
};

export default CharacterRegistry;

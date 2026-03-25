/**
 * @fileoverview CharacterRegistry - Config-driven registry for character data
 * Manages loading and caching of character definitions for Friday Night Funkin'.
 */

import { createRegistry } from '../../core/Registry.js';
import { getSharedRegistryPath } from '../../utils/GameDataPaths.js';

/**
 * @typedef {Object} AnimationData
 * @property {string} name - Animation name
 * @property {string} prefix - Animation prefix in the spritesheet
 * @property {number[]} [offsets=[0,0]] - X, Y offsets
 * @property {number} [frameRate=24] - Frames per second
 * @property {boolean} [looped=false] - Whether animation loops
 * @property {boolean} [flipX=false] - Flip horizontally
 * @property {boolean} [flipY=false] - Flip vertically
 * @property {number[]} [frameIndices] - Specific frame indices
 * @property {string} [assetPath] - Override asset path
 */

/**
 * @typedef {Object} HealthIconData
 * @property {string} [id] - Icon ID (defaults to character ID)
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
 * @typedef {Object} CharacterData
 * @property {string} version - Data format version
 * @property {string} name - Display name
 * @property {string} renderType - Render type
 * @property {string} assetPath - Path to sprite assets
 * @property {number} [scale=1] - Character scale
 * @property {HealthIconData} [healthIcon] - Health icon configuration
 * @property {DeathData} [death] - Death animation configuration
 * @property {number[]} [offsets=[0,0]] - Global position offsets
 * @property {number[]} [cameraOffsets=[0,0]] - Camera focus offsets
 * @property {boolean} [isPixel=false] - Use pixel rendering
 * @property {number} [danceEvery=1] - Beats between idle animations
 * @property {number} [singTime=8] - Steps to hold sing animation
 * @property {AnimationData[]} animations - Character animations
 * @property {string} [startingAnimation='idle'] - Initial animation
 * @property {boolean} [flipX=false] - Flip entire sprite horizontally
 */

/**
 * @typedef {Object} CharacterEntry
 * @property {string} id - Character ID
 * @property {CharacterData} data - Character data
 * @property {string} name - Display name
 * @property {string} renderType - Render type
 * @property {string[]} animationNames - List of animation names
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

    cleanData(data) {
      return {
        version: data.version || DEFAULTS.VERSION,
        name: data.name || DEFAULTS.NAME,
        renderType: data.renderType || DEFAULTS.RENDER_TYPE,
        assetPath: data.assetPath,
        scale: data.scale ?? DEFAULTS.SCALE,
        healthIcon: cleanHealthIconData(data.healthIcon, data),
        death: cleanDeathData(data.death),
        offsets: data.offsets || [...DEFAULTS.OFFSETS],
        cameraOffsets: data.cameraOffsets || [...DEFAULTS.OFFSETS],
        isPixel: data.isPixel ?? DEFAULTS.IS_PIXEL,
        danceEvery: data.danceEvery ?? DEFAULTS.DANCE_EVERY,
        singTime: data.singTime ?? DEFAULTS.SING_TIME,
        animations: data.animations.map(cleanAnimationData),
        startingAnimation: data.startingAnimation || DEFAULTS.STARTING_ANIM,
        flipX: data.flipX ?? DEFAULTS.FLIP_X
      };
    },

    createEntry(id, data) {
      return {
        id,
        data,
        name: data.name,
        renderType: data.renderType,
        animationNames: data.animations.map((a) => a.name),
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

      getCharacterRenderType(charId) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.renderType : DEFAULTS.RENDER_TYPE;
      },

      getCharacterAnimations(charId) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.data.animations : [];
      },

      getAnimation(charId, animName) {
        const animations = this.getCharacterAnimations(charId);
        return animations.find((a) => a.name === animName) || null;
      },

      hasAnimation(charId, animName) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.animationNames.includes(animName) : false;
      },

      getAssetPath(charId) {
        const entry = this.fetchEntry(charId);
        return entry ? entry.data.assetPath : null;
      },

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

      getCharactersByRenderType(renderType) {
        return this.getAllEntries().filter((entry) => entry.renderType === renderType);
      },

      getPlayableCharacters() {
        return this.getAllEntries().filter((entry) => {
          return entry.animationNames.some((name) => name.includes('miss'));
        });
      },

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

      getSpriteAssetPath(charId) {
        const entry = this.fetchEntry(charId);
        if (!entry) {
          return null;
        }
        return `images/${entry.data.assetPath}`;
      },

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

      toString() {
        return `CharacterRegistry(${this.countEntries()} characters)`;
      }
    }
  }
);

// Static helper methods (not instance methods)
CharacterRegistry.getSingAnimationName = function (direction, miss = false) {
  const directions = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
  const dirName = directions[direction] || 'LEFT';
  return miss ? `sing${dirName}miss` : `sing${dirName}`;
};

CharacterRegistry.getHoldAnimationName = function (direction) {
  const directions = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
  const dirName = directions[direction] || 'LEFT';
  return `sing${dirName}-hold`;
};

export default CharacterRegistry;

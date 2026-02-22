/**
 * @fileoverview CharacterRegistry - Registry for character data
 * Manages loading and caching of character definitions for Friday Night Funkin'.
 *
 * Ported from source/funkin/data/character/CharacterData.hx
 */

import Registry from '../../core/Registry.js';

/**
 * @typedef {Object} AnimationData
 * @property {string} name - Animation name (e.g., 'idle', 'singLEFT')
 * @property {string} prefix - Animation prefix in the spritesheet
 * @property {number[]} [offsets=[0,0]] - X, Y offsets for this animation
 * @property {number} [frameRate=24] - Frames per second
 * @property {boolean} [looped=false] - Whether animation loops
 * @property {boolean} [flipX=false] - Flip horizontally
 * @property {boolean} [flipY=false] - Flip vertically
 * @property {number[]} [frameIndices] - Specific frame indices to use
 * @property {string} [assetPath] - Override asset path for this animation
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
 * @property {string} renderType - Render type (sparrow, packer, multisparrow, animateatlas, custom)
 * @property {string} assetPath - Path to sprite assets
 * @property {number} [scale=1] - Character scale
 * @property {HealthIconData} [healthIcon] - Health icon configuration
 * @property {DeathData} [death] - Death animation configuration
 * @property {number[]} [offsets=[0,0]] - Global position offsets
 * @property {number[]} [cameraOffsets=[0,0]] - Camera focus offsets
 * @property {boolean} [isPixel=false] - Use pixel rendering (no antialiasing)
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

// Render type constants
const RenderType = {
  SPARROW: 'sparrow',
  PACKER: 'packer',
  MULTI_SPARROW: 'multisparrow',
  ANIMATE_ATLAS: 'animateatlas',
  CUSTOM: 'custom'
};

// Default values
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

/**
 * Registry for character data.
 * Handles loading character definitions from JSON files.
 */
class CharacterRegistry extends Registry {
  /**
   * Singleton instance
   * @type {CharacterRegistry | null}
   */
  static instance = null;

  /**
   * Render type constants
   */
  static RenderType = RenderType;

  /**
   * Default values
   */
  static DEFAULTS = DEFAULTS;

  /**
   * Get the singleton instance
   * @returns {CharacterRegistry}
   */
  static getInstance() {
    if (!CharacterRegistry.instance) {
      CharacterRegistry.instance = new CharacterRegistry();
    }
    return CharacterRegistry.instance;
  }

  /**
   * Create a new CharacterRegistry
   */
  constructor() {
    super('CHARACTER', 'data/characters', DEFAULTS.VERSION_RULE);
  }


  // ========================================
  // PARSING METHODS
  // ========================================

  /**
   * Parse entry data from a pre-loaded JSON object.
   * @param {string} id - The character ID
   * @returns {CharacterData | null}
   */
  parseEntryData(id) {
    console.warn(`[${this.registryId}] parseEntryData called without data for: ${id}`);
    return null;
  }

  /**
   * Parse and validate raw JSON data for character.
   * @param {Object} data - The parsed JSON object
   * @param {string} [fileName] - Optional file name for error reporting
   * @returns {CharacterData | null}
   */
  parseEntryDataRaw(data, fileName) {
    if (!data || typeof data !== 'object') {
      console.error(`[${this.registryId}] Invalid character data for: ${fileName}`);
      return null;
    }

    // Validate version
    const version = data.version;
    if (!version) {
      console.warn(`[${this.registryId}] No version for: ${fileName}, assuming ${DEFAULTS.VERSION}`);
    } else if (!this.validateVersion(version)) {
      console.error(`[${this.registryId}] Incompatible version ${version} for: ${fileName}`);
      return null;
    }

    // Validate required fields
    if (!data.assetPath) {
      console.error(`[${this.registryId}] Missing assetPath for: ${fileName}`);
      return null;
    }

    if (!data.animations || !Array.isArray(data.animations) || data.animations.length === 0) {
      console.error(`[${this.registryId}] Missing or empty animations for: ${fileName}`);
      return null;
    }

    // Validate animations
    for (const anim of data.animations) {
      if (!anim.name) {
        console.error(`[${this.registryId}] Animation missing name in: ${fileName}`);
        return null;
      }
    }

    // Clean and return data
    return this.cleanCharacterData(data);
  }

  /**
   * Clean and normalize character data.
   * @param {Object} data - Raw character data
   * @returns {CharacterData}
   */
  cleanCharacterData(data) {
    const cleaned = {
      version: data.version || DEFAULTS.VERSION,
      name: data.name || DEFAULTS.NAME,
      renderType: data.renderType || DEFAULTS.RENDER_TYPE,
      assetPath: data.assetPath,
      scale: data.scale ?? DEFAULTS.SCALE,
      healthIcon: this.cleanHealthIconData(data.healthIcon, data),
      death: this.cleanDeathData(data.death),
      offsets: data.offsets || [...DEFAULTS.OFFSETS],
      cameraOffsets: data.cameraOffsets || [...DEFAULTS.OFFSETS],
      isPixel: data.isPixel ?? DEFAULTS.IS_PIXEL,
      danceEvery: data.danceEvery ?? DEFAULTS.DANCE_EVERY,
      singTime: data.singTime ?? DEFAULTS.SING_TIME,
      animations: data.animations.map((anim) => this.cleanAnimationData(anim)),
      startingAnimation: data.startingAnimation || DEFAULTS.STARTING_ANIM,
      flipX: data.flipX ?? DEFAULTS.FLIP_X
    };

    return cleaned;
  }

  /**
   * Clean health icon data.
   * @param {Object} iconData - Raw icon data
   * @param {Object} charData - Parent character data
   * @returns {HealthIconData}
   */
  cleanHealthIconData(iconData, charData) {
    const icon = iconData || {};
    return {
      id: icon.id || null, // Will default to character ID when used
      scale: icon.scale ?? DEFAULTS.SCALE,
      flipX: icon.flipX ?? DEFAULTS.FLIP_X,
      isPixel: icon.isPixel ?? (charData.isPixel ?? DEFAULTS.IS_PIXEL),
      offsets: icon.offsets || [...DEFAULTS.HEALTH_ICON_OFFSETS]
    };
  }

  /**
   * Clean death data.
   * @param {Object} deathData - Raw death data
   * @returns {DeathData}
   */
  cleanDeathData(deathData) {
    const death = deathData || {};
    return {
      cameraOffsets: death.cameraOffsets || [...DEFAULTS.OFFSETS],
      cameraZoom: death.cameraZoom ?? 1.0,
      preTransitionDelay: death.preTransitionDelay ?? 0
    };
  }

  /**
   * Clean animation data.
   * @param {Object} anim - Raw animation data
   * @returns {AnimationData}
   */
  cleanAnimationData(anim) {
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
   * Create a character entry from parsed data.
   * @param {string} id - Character ID
   * @param {CharacterData} data - Parsed character data
   * @returns {CharacterEntry | null}
   */
  createEntry(id, data) {
    if (!data) return null;

    return {
      id,
      data,
      name: data.name,
      renderType: data.renderType,
      animationNames: data.animations.map((a) => a.name),
      destroy: () => {
        // Cleanup if needed
      }
    };
  }


  // ========================================
  // CHARACTER ACCESS METHODS
  // ========================================

  /**
   * Get character data by ID.
   * @param {string} charId - Character ID
   * @returns {CharacterData | null}
   */
  getCharacterData(charId) {
    const entry = this.fetchEntry(charId);
    return entry ? entry.data : null;
  }

  /**
   * Get character display name.
   * @param {string} charId - Character ID
   * @returns {string}
   */
  getCharacterName(charId) {
    const entry = this.fetchEntry(charId);
    return entry ? entry.name : charId;
  }

  /**
   * Get character render type.
   * @param {string} charId - Character ID
   * @returns {string}
   */
  getCharacterRenderType(charId) {
    const entry = this.fetchEntry(charId);
    return entry ? entry.renderType : DEFAULTS.RENDER_TYPE;
  }

  /**
   * Get character animations.
   * @param {string} charId - Character ID
   * @returns {AnimationData[]}
   */
  getCharacterAnimations(charId) {
    const entry = this.fetchEntry(charId);
    return entry ? entry.data.animations : [];
  }

  /**
   * Get a specific animation for a character.
   * @param {string} charId - Character ID
   * @param {string} animName - Animation name
   * @returns {AnimationData | null}
   */
  getAnimation(charId, animName) {
    const animations = this.getCharacterAnimations(charId);
    return animations.find((a) => a.name === animName) || null;
  }

  /**
   * Check if character has a specific animation.
   * @param {string} charId - Character ID
   * @param {string} animName - Animation name
   * @returns {boolean}
   */
  hasAnimation(charId, animName) {
    const entry = this.fetchEntry(charId);
    return entry ? entry.animationNames.includes(animName) : false;
  }

  /**
   * Get character asset path.
   * @param {string} charId - Character ID
   * @returns {string | null}
   */
  getAssetPath(charId) {
    const entry = this.fetchEntry(charId);
    return entry ? entry.data.assetPath : null;
  }

  /**
   * Get health icon data for a character.
   * @param {string} charId - Character ID
   * @returns {HealthIconData | null}
   */
  getHealthIconData(charId) {
    const entry = this.fetchEntry(charId);
    if (!entry) return null;

    const iconData = { ...entry.data.healthIcon };
    // Default icon ID to character ID if not specified
    if (!iconData.id) {
      iconData.id = charId;
    }
    return iconData;
  }

  // ========================================
  // LISTING METHODS
  // ========================================

  /**
   * List all character IDs.
   * @returns {string[]}
   */
  listCharacterIds() {
    return this.listEntryIds();
  }

  /**
   * Get characters by render type.
   * @param {string} renderType - Render type to filter by
   * @returns {CharacterEntry[]}
   */
  getCharactersByRenderType(renderType) {
    return this.getAllEntries().filter((entry) => entry.renderType === renderType);
  }

  /**
   * Get all playable characters (those with player-related animations).
   * @returns {CharacterEntry[]}
   */
  getPlayableCharacters() {
    return this.getAllEntries().filter((entry) => {
      // Check for miss animations which indicate a playable character
      return entry.animationNames.some((name) => name.includes('miss'));
    });
  }

  /**
   * Get character display info for UI.
   * @param {string} charId - Character ID
   * @returns {Object | null}
   */
  getCharacterDisplayInfo(charId) {
    const entry = this.fetchEntry(charId);
    if (!entry) return null;

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
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the file path for character data.
   * @param {string} charId - Character ID
   * @returns {string}
   */
  getCharacterPath(charId) {
    return `${this.dataFilePath}/${charId}.json`;
  }

  /**
   * Get the sprite asset path for a character.
   * @param {string} charId - Character ID
   * @returns {string | null}
   */
  getSpriteAssetPath(charId) {
    const entry = this.fetchEntry(charId);
    if (!entry) return null;

    // Asset path is relative to images folder
    return `images/${entry.data.assetPath}`;
  }

  /**
   * Get the XML asset path for a Sparrow character.
   * @param {string} charId - Character ID
   * @returns {string | null}
   */
  getXmlAssetPath(charId) {
    const entry = this.fetchEntry(charId);
    if (!entry) return null;

    if (entry.renderType !== RenderType.SPARROW && entry.renderType !== RenderType.MULTI_SPARROW) {
      return null;
    }

    return `images/${entry.data.assetPath}.xml`;
  }

  /**
   * Get sing animation name for a direction.
   * @param {number} direction - Direction (0=left, 1=down, 2=up, 3=right)
   * @param {boolean} [miss=false] - Whether this is a miss animation
   * @returns {string}
   */
  static getSingAnimationName(direction, miss = false) {
    const directions = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
    const dirName = directions[direction] || 'LEFT';
    return miss ? `sing${dirName}miss` : `sing${dirName}`;
  }

  /**
   * Get hold animation name for a direction.
   * @param {number} direction - Direction (0=left, 1=down, 2=up, 3=right)
   * @returns {string}
   */
  static getHoldAnimationName(direction) {
    const directions = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
    const dirName = directions[direction] || 'LEFT';
    return `sing${dirName}-hold`;
  }

  /**
   * Get string representation.
   * @returns {string}
   */
  toString() {
    return `CharacterRegistry(${this.countEntries()} characters)`;
  }
}

export default CharacterRegistry;

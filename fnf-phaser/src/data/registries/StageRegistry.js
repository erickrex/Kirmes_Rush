/**
 * @fileoverview StageRegistry - Registry for stage/background data
 * Manages loading and caching of stage definitions for Friday Night Funkin'.
 *
 * Stages define the visual background, props, and character positions for gameplay.
 */

import Registry from '../../core/Registry.js';

/**
 * @typedef {Object} StageAnimationData
 * @property {string} name - Animation name
 * @property {string} prefix - Animation prefix in spritesheet
 * @property {number} [frameRate=24] - Frames per second
 * @property {boolean} [looped=true] - Whether animation loops
 * @property {number[]} [offsets=[0,0]] - Animation offsets
 */

/**
 * @typedef {Object} StagePropData
 * @property {string} name - Prop identifier
 * @property {string} assetPath - Path to sprite asset
 * @property {string} [animType='sparrow'] - Animation type (sparrow, packer, etc.)
 * @property {number[]} [position=[0,0]] - X, Y position
 * @property {number[]} [scale=[1,1]] - X, Y scale
 * @property {number[]} [scroll=[1,1]] - Parallax scroll factor
 * @property {number} [zIndex=0] - Render order (higher = in front)
 * @property {boolean} [isPixel=false] - Use pixel rendering
 * @property {number} [danceEvery=0] - Beats between dance animations (0 = no dancing)
 * @property {number} [alpha=1] - Opacity
 * @property {string} [blend] - Blend mode
 * @property {StageAnimationData[]} [animations=[]] - Prop animations
 * @property {string} [startingAnimation] - Initial animation to play
 */

/**
 * @typedef {Object} StageCharacterPosition
 * @property {number[]} position - X, Y position
 * @property {number} [zIndex=0] - Render order
 * @property {number[]} [cameraOffsets=[0,0]] - Camera offset when focused
 * @property {number} [scale=1] - Character scale override
 */

/**
 * @typedef {Object} StageCharacters
 * @property {StageCharacterPosition} [bf] - Player position
 * @property {StageCharacterPosition} [dad] - Opponent position
 * @property {StageCharacterPosition} [gf] - Girlfriend position
 */

/**
 * @typedef {Object} StageData
 * @property {string} version - Data format version
 * @property {string} name - Display name
 * @property {string} [directory] - Asset directory (week folder)
 * @property {number} [cameraZoom=1] - Default camera zoom
 * @property {StagePropData[]} props - Background props
 * @property {StageCharacters} characters - Character positions
 */

/**
 * @typedef {Object} StageEntry
 * @property {string} id - Stage ID
 * @property {StageData} data - Stage data
 * @property {string} name - Display name
 * @property {string[]} propNames - List of prop names
 */

// Default values
const DEFAULTS = {
  VERSION: '1.0.0',
  VERSION_RULE: '1.0.x',
  CAMERA_ZOOM: 1.0,
  POSITION: [0, 0],
  SCALE: [1, 1],
  SCROLL: [1, 1],
  Z_INDEX: 0,
  DANCE_EVERY: 0,
  ALPHA: 1,
  ANIM_TYPE: 'sparrow',
  FRAME_RATE: 24
};

/**
 * Registry for stage data.
 * Handles loading stage definitions from JSON files.
 */
class StageRegistry extends Registry {
  /**
   * Singleton instance
   * @type {StageRegistry | null}
   */
  static instance = null;

  /**
   * Default values
   */
  static DEFAULTS = DEFAULTS;

  /**
   * Get the singleton instance
   * @returns {StageRegistry}
   */
  static getInstance() {
    if (!StageRegistry.instance) {
      StageRegistry.instance = new StageRegistry();
    }
    return StageRegistry.instance;
  }

  /**
   * Create a new StageRegistry
   */
  constructor() {
    super('STAGE', 'data/stages', DEFAULTS.VERSION_RULE);
  }


  // ========================================
  // PARSING METHODS
  // ========================================

  /**
   * Parse entry data from a pre-loaded JSON object.
   * @param {string} id - The stage ID
   * @returns {StageData | null}
   */
  parseEntryData(id) {
    console.warn(`[${this.registryId}] parseEntryData called without data for: ${id}`);
    return null;
  }

  /**
   * Parse and validate raw JSON data for stage.
   * @param {Object} data - The parsed JSON object
   * @param {string} [fileName] - Optional file name for error reporting
   * @returns {StageData | null}
   */
  parseEntryDataRaw(data, fileName) {
    if (!data || typeof data !== 'object') {
      console.error(`[${this.registryId}] Invalid stage data for: ${fileName}`);
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

    // Props are optional but should be an array if present
    if (data.props && !Array.isArray(data.props)) {
      console.error(`[${this.registryId}] Invalid props format for: ${fileName}`);
      return null;
    }

    // Clean and return data
    return this.cleanStageData(data);
  }

  /**
   * Clean and normalize stage data.
   * @param {Object} data - Raw stage data
   * @returns {StageData}
   */
  cleanStageData(data) {
    return {
      version: data.version || DEFAULTS.VERSION,
      name: data.name || 'Unnamed Stage',
      directory: data.directory || null,
      cameraZoom: data.cameraZoom ?? DEFAULTS.CAMERA_ZOOM,
      props: (data.props || []).map((prop) => this.cleanPropData(prop)),
      characters: this.cleanCharacterPositions(data.characters)
    };
  }

  /**
   * Clean prop data.
   * @param {Object} prop - Raw prop data
   * @returns {StagePropData}
   */
  cleanPropData(prop) {
    return {
      name: prop.name || 'unnamed',
      assetPath: prop.assetPath || '',
      animType: prop.animType || DEFAULTS.ANIM_TYPE,
      position: prop.position || [...DEFAULTS.POSITION],
      scale: prop.scale || [...DEFAULTS.SCALE],
      scroll: prop.scroll || [...DEFAULTS.SCROLL],
      zIndex: prop.zIndex ?? DEFAULTS.Z_INDEX,
      isPixel: prop.isPixel ?? false,
      danceEvery: prop.danceEvery ?? DEFAULTS.DANCE_EVERY,
      alpha: prop.alpha ?? DEFAULTS.ALPHA,
      blend: prop.blend || null,
      animations: (prop.animations || []).map((anim) => this.cleanAnimationData(anim)),
      startingAnimation: prop.startingAnimation || null
    };
  }

  /**
   * Clean animation data.
   * @param {Object} anim - Raw animation data
   * @returns {StageAnimationData}
   */
  cleanAnimationData(anim) {
    return {
      name: anim.name || '',
      prefix: anim.prefix || anim.name || '',
      frameRate: anim.frameRate ?? DEFAULTS.FRAME_RATE,
      looped: anim.looped ?? true,
      offsets: anim.offsets || [...DEFAULTS.POSITION]
    };
  }

  /**
   * Clean character position data.
   * @param {Object} characters - Raw character positions
   * @returns {StageCharacters}
   */
  cleanCharacterPositions(characters) {
    const cleaned = {};
    const charTypes = ['bf', 'dad', 'gf'];

    for (const charType of charTypes) {
      if (characters && characters[charType]) {
        cleaned[charType] = {
          position: characters[charType].position || [...DEFAULTS.POSITION],
          zIndex: characters[charType].zIndex ?? DEFAULTS.Z_INDEX,
          cameraOffsets: characters[charType].cameraOffsets || [...DEFAULTS.POSITION],
          scale: characters[charType].scale ?? 1
        };
      } else {
        // Provide default positions
        cleaned[charType] = {
          position: [...DEFAULTS.POSITION],
          zIndex: DEFAULTS.Z_INDEX,
          cameraOffsets: [...DEFAULTS.POSITION],
          scale: 1
        };
      }
    }

    return cleaned;
  }

  /**
   * Create a stage entry from parsed data.
   * @param {string} id - Stage ID
   * @param {StageData} data - Parsed stage data
   * @returns {StageEntry | null}
   */
  createEntry(id, data) {
    if (!data) return null;

    return {
      id,
      data,
      name: data.name,
      propNames: data.props.map((p) => p.name),
      destroy: () => {
        // Cleanup if needed
      }
    };
  }


  // ========================================
  // STAGE ACCESS METHODS
  // ========================================

  /**
   * Get stage data by ID.
   * @param {string} stageId - Stage ID
   * @returns {StageData | null}
   */
  getStageData(stageId) {
    const entry = this.fetchEntry(stageId);
    return entry ? entry.data : null;
  }

  /**
   * Get stage display name.
   * @param {string} stageId - Stage ID
   * @returns {string}
   */
  getStageName(stageId) {
    const entry = this.fetchEntry(stageId);
    return entry ? entry.name : stageId;
  }

  /**
   * Get stage props.
   * @param {string} stageId - Stage ID
   * @returns {StagePropData[]}
   */
  getStageProps(stageId) {
    const entry = this.fetchEntry(stageId);
    return entry ? entry.data.props : [];
  }

  /**
   * Get props sorted by z-index (for rendering order).
   * @param {string} stageId - Stage ID
   * @returns {StagePropData[]}
   */
  getPropsSortedByZIndex(stageId) {
    const props = this.getStageProps(stageId);
    return [...props].sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Get a specific prop by name.
   * @param {string} stageId - Stage ID
   * @param {string} propName - Prop name
   * @returns {StagePropData | null}
   */
  getProp(stageId, propName) {
    const props = this.getStageProps(stageId);
    return props.find((p) => p.name === propName) || null;
  }

  /**
   * Get character positions for a stage.
   * @param {string} stageId - Stage ID
   * @returns {StageCharacters | null}
   */
  getCharacterPositions(stageId) {
    const entry = this.fetchEntry(stageId);
    return entry ? entry.data.characters : null;
  }

  /**
   * Get position for a specific character type.
   * @param {string} stageId - Stage ID
   * @param {string} charType - Character type ('bf', 'dad', 'gf')
   * @returns {StageCharacterPosition | null}
   */
  getCharacterPosition(stageId, charType) {
    const positions = this.getCharacterPositions(stageId);
    return positions ? positions[charType] || null : null;
  }

  /**
   * Get camera zoom for a stage.
   * @param {string} stageId - Stage ID
   * @returns {number}
   */
  getCameraZoom(stageId) {
    const entry = this.fetchEntry(stageId);
    return entry ? entry.data.cameraZoom : DEFAULTS.CAMERA_ZOOM;
  }

  /**
   * Get asset directory for a stage.
   * @param {string} stageId - Stage ID
   * @returns {string | null}
   */
  getDirectory(stageId) {
    const entry = this.fetchEntry(stageId);
    return entry ? entry.data.directory : null;
  }

  // ========================================
  // LISTING METHODS
  // ========================================

  /**
   * List all stage IDs.
   * @returns {string[]}
   */
  listStageIds() {
    return this.listEntryIds();
  }

  /**
   * Get stages by directory (week).
   * @param {string} directory - Directory name (e.g., 'week1')
   * @returns {StageEntry[]}
   */
  getStagesByDirectory(directory) {
    return this.getAllEntries().filter((entry) => entry.data.directory === directory);
  }

  /**
   * Get stage display info for UI.
   * @param {string} stageId - Stage ID
   * @returns {Object | null}
   */
  getStageDisplayInfo(stageId) {
    const entry = this.fetchEntry(stageId);
    if (!entry) return null;

    return {
      id: entry.id,
      name: entry.name,
      directory: entry.data.directory,
      cameraZoom: entry.data.cameraZoom,
      propCount: entry.data.props.length,
      hasAnimatedProps: entry.data.props.some((p) => p.animations.length > 0 || p.danceEvery > 0)
    };
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the file path for stage data.
   * @param {string} stageId - Stage ID
   * @returns {string}
   */
  getStagePath(stageId) {
    return `${this.dataFilePath}/${stageId}.json`;
  }

  /**
   * Get the asset path for a prop.
   * @param {string} stageId - Stage ID
   * @param {string} propName - Prop name
   * @returns {string | null}
   */
  getPropAssetPath(stageId, propName) {
    const prop = this.getProp(stageId, propName);
    if (!prop) return null;

    const directory = this.getDirectory(stageId);
    if (directory) {
      return `images/${directory}/${prop.assetPath}`;
    }
    return `images/${prop.assetPath}`;
  }

  /**
   * Get all unique asset paths for a stage.
   * @param {string} stageId - Stage ID
   * @returns {string[]}
   */
  getAllAssetPaths(stageId) {
    const props = this.getStageProps(stageId);
    const directory = this.getDirectory(stageId);
    const paths = new Set();

    for (const prop of props) {
      if (prop.assetPath) {
        const path = directory ? `images/${directory}/${prop.assetPath}` : `images/${prop.assetPath}`;
        paths.add(path);
      }
    }

    return Array.from(paths);
  }

  /**
   * Get string representation.
   * @returns {string}
   */
  toString() {
    return `StageRegistry(${this.countEntries()} stages)`;
  }
}

export default StageRegistry;

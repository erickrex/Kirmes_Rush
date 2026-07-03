/**
 * @fileoverview StageRegistry - Config-driven registry for stage/background data
 * Manages loading and caching of stage definitions for Rythm Foundation.
 */

import { createRegistry } from '../../core/Registry.js';
import { getSharedRegistryPath } from '../../utils/GameDataPaths.js';

// ========================================
// TYPE DEFINITIONS
// ========================================

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
 * @property {string} [animType='sparrow'] - Animation type
 * @property {number[]} [position=[0,0]] - X, Y position
 * @property {number[]} [scale=[1,1]] - X, Y scale
 * @property {number[]} [scroll=[1,1]] - Parallax scroll factor
 * @property {number} [zIndex=0] - Render order
 * @property {boolean} [isPixel=false] - Use pixel rendering
 * @property {number} [danceEvery=0] - Beats between dance animations
 * @property {number} [alpha=1] - Opacity
 * @property {string} [blend] - Blend mode
 * @property {StageAnimationData[]} [animations=[]] - Prop animations
 * @property {string} [startingAnimation] - Initial animation
 */

/**
 * @typedef {Object} StageCharacterPosition
 * @property {number[]} position - X, Y position
 * @property {number} [zIndex=0] - Render order
 * @property {number[]} [cameraOffsets=[0,0]] - Camera offset when focused
 * @property {number} [scale=1] - Character scale override
 */

/**
 * Raw stage data as read from JSON before cleaning/validation.
 * @typedef {Object} RawStageData
 * @property {string} [version] - Data format version
 * @property {string} [name] - Display name
 * @property {string} [directory] - Asset directory
 * @property {number} [cameraZoom] - Default camera zoom
 * @property {Array<Record<string, any>>} [props] - Stage props/layers
 * @property {Record<string, Record<string, any>>} [characters] - Character positions by role
 */

/**
 * Cleaned/normalized stage data after processing raw JSON.
 * @typedef {Object} StageCleanedData
 * @property {string} version - Data format version
 * @property {string} name - Display name
 * @property {string | null} directory - Asset directory
 * @property {number} cameraZoom - Default camera zoom
 * @property {StagePropData[]} props - Cleaned stage props
 * @property {Record<string, StageCharacterPosition>} characters - Character positions
 */

/**
 * A stage registry entry with ID, cleaned data, and derived fields.
 * @typedef {Object} StageEntry
 * @property {string} id - Stage ID
 * @property {StageCleanedData} data - Cleaned stage data
 * @property {string} name - Display name
 * @property {string[]} propNames - List of prop names
 * @property {function(): void} destroy - Cleanup function
 */

/**
 * Stage display info returned by getStageDisplayInfo.
 * @typedef {Object} StageDisplayInfo
 * @property {string} id - Stage ID
 * @property {string} name - Display name
 * @property {string | null} directory - Asset directory
 * @property {number} cameraZoom - Camera zoom
 * @property {number} propCount - Number of props
 * @property {boolean} hasAnimatedProps - Whether any props are animated
 */

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

// ========================================
// CLEANING HELPERS
// ========================================

/**
 * Clean raw animation data into normalized form.
 * @param {Record<string, any>} anim - Raw animation data
 * @returns {StageAnimationData}
 */
function cleanAnimationData(anim) {
  return {
    name: anim.name || '',
    prefix: anim.prefix || anim.name || '',
    frameRate: anim.frameRate ?? DEFAULTS.FRAME_RATE,
    looped: anim.looped ?? true,
    offsets: anim.offsets || [...DEFAULTS.POSITION]
  };
}

/**
 * Clean raw prop data into normalized form.
 * @param {Record<string, any>} prop - Raw prop data
 * @returns {StagePropData}
 */
function cleanPropData(prop) {
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
    animations: (prop.animations || []).map(cleanAnimationData),
    startingAnimation: prop.startingAnimation || null
  };
}

/**
 * Clean raw character position data into normalized form.
 * @param {Record<string, Record<string, any>> | undefined} characters - Raw character positions
 * @returns {Record<string, StageCharacterPosition>}
 */
function cleanCharacterPositions(characters) {
  /** @type {Record<string, StageCharacterPosition>} */
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

// ========================================
// CONFIG-DRIVEN REGISTRY
// ========================================

const StageRegistry = createRegistry(
  {
    registryId: 'STAGE',
    dataFilePath: getSharedRegistryPath('stages'),
    versionRule: DEFAULTS.VERSION_RULE,
    entityName: 'Stage',

    /**
     * @param {RawStageData} data
     * @param {string} [fileName]
     * @returns {boolean}
     */
    validateData(data, fileName) {
      if (!data.version) {
        console.warn(
          `[${this.registryId}] No version for: ${fileName}, assuming ${DEFAULTS.VERSION}`
        );
      }
      if (data.props && !Array.isArray(data.props)) {
        console.error(`[${this.registryId}] Invalid props format for: ${fileName}`);
        return false;
      }
      return true;
    },

    /**
     * @param {RawStageData} data
     * @returns {StageCleanedData}
     */
    cleanData(data) {
      return {
        version: data.version || DEFAULTS.VERSION,
        name: data.name || 'Unnamed Stage',
        directory: data.directory || null,
        cameraZoom: data.cameraZoom ?? DEFAULTS.CAMERA_ZOOM,
        props: (data.props || []).map(cleanPropData),
        characters: cleanCharacterPositions(data.characters)
      };
    },

    /**
     * @param {string} id
     * @param {StageCleanedData} data
     * @returns {StageEntry}
     */
    createEntry(id, data) {
      return {
        id,
        data,
        name: data.name,
        propNames: data.props.map((/** @type {StagePropData} */ p) => p.name),
        destroy: () => {}
      };
    }
  },
  {
    statics: { DEFAULTS },
    methods: {
      // ========================================
      // STAGE ACCESS METHODS
      // ========================================

      /**
       * Get all props for a stage.
       * @param {string} stageId - Stage ID
       * @returns {StagePropData[]}
       */
      getStageProps(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.props : [];
      },

      /**
       * Get props sorted by z-index.
       * @param {string} stageId - Stage ID
       * @returns {StagePropData[]}
       */
      getPropsSortedByZIndex(stageId) {
        const props = this.getStageProps(stageId);
        return [...props].sort(
          (/** @type {StagePropData} */ a, /** @type {StagePropData} */ b) =>
            (a.zIndex ?? 0) - (b.zIndex ?? 0)
        );
      },

      /**
       * Get a specific prop by name.
       * @param {string} stageId - Stage ID
       * @param {string} propName - Prop name
       * @returns {StagePropData | null}
       */
      getProp(stageId, propName) {
        const props = this.getStageProps(stageId);
        return props.find((/** @type {StagePropData} */ p) => p.name === propName) || null;
      },

      /**
       * Get character positions for a stage.
       * @param {string} stageId - Stage ID
       * @returns {Record<string, StageCharacterPosition> | null}
       */
      getCharacterPositions(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.characters : null;
      },

      /**
       * Get a specific character position.
       * @param {string} stageId - Stage ID
       * @param {string} charType - Character type (bf, dad, gf)
       * @returns {StageCharacterPosition | null}
       */
      getCharacterPosition(stageId, charType) {
        const positions = this.getCharacterPositions(stageId);
        return positions ? positions[charType] || null : null;
      },

      /**
       * Get camera zoom for a stage.
       * @param {string} stageId - Stage ID
       * @returns {number}
       */
      getCameraZoom(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.cameraZoom : DEFAULTS.CAMERA_ZOOM;
      },

      /**
       * Get asset directory for a stage.
       * @param {string} stageId - Stage ID
       * @returns {string | null}
       */
      getDirectory(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.directory : null;
      },

      // ========================================
      // LISTING METHODS
      // ========================================

      /**
       * Get all stages in a specific directory.
       * @param {string} directory - Directory to filter by
       * @returns {StageEntry[]}
       */
      getStagesByDirectory(directory) {
        return this.getAllEntries().filter(
          (/** @type {StageEntry} */ entry) => entry.data.directory === directory
        );
      },

      /**
       * Get display info for a stage.
       * @param {string} stageId - Stage ID
       * @returns {StageDisplayInfo | null}
       */
      getStageDisplayInfo(stageId) {
        const entry = this.fetchEntry(stageId);
        if (!entry) {
          return null;
        }

        return {
          id: entry.id,
          name: entry.name,
          directory: entry.data.directory,
          cameraZoom: entry.data.cameraZoom,
          propCount: entry.data.props.length,
          hasAnimatedProps: entry.data.props.some(
            (/** @type {StagePropData} */ p) =>
              (p.animations || []).length > 0 || (p.danceEvery ?? 0) > 0
          )
        };
      },

      // ========================================
      // UTILITY METHODS
      // ========================================

      /**
       * Get the full asset path for a prop.
       * @param {string} stageId - Stage ID
       * @param {string} propName - Prop name
       * @returns {string | null}
       */
      getPropAssetPath(stageId, propName) {
        const prop = this.getProp(stageId, propName);
        if (!prop) {
          return null;
        }

        const directory = this.getDirectory(stageId);
        if (directory) {
          return `images/${directory}/${prop.assetPath}`;
        }
        return `images/${prop.assetPath}`;
      },

      /**
       * Get all asset paths for a stage.
       * @param {string} stageId - Stage ID
       * @returns {string[]}
       */
      getAllAssetPaths(stageId) {
        const props = this.getStageProps(stageId);
        const directory = this.getDirectory(stageId);
        /** @type {Set<string>} */
        const paths = new Set();

        for (const prop of props) {
          if (prop.assetPath) {
            const path = directory
              ? `images/${directory}/${prop.assetPath}`
              : `images/${prop.assetPath}`;
            paths.add(path);
          }
        }

        return Array.from(paths);
      },

      /** @returns {string} */
      toString() {
        return `StageRegistry(${this.countEntries()} stages)`;
      }
    }
  }
);

export default StageRegistry;

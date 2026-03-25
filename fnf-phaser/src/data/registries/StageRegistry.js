/**
 * @fileoverview StageRegistry - Config-driven registry for stage/background data
 * Manages loading and caching of stage definitions for Friday Night Funkin'.
 */

import { createRegistry } from '../../core/Registry.js';

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
 * @typedef {Object} StageData
 * @property {string} version - Data format version
 * @property {string} name - Display name
 * @property {string} [directory] - Asset directory
 * @property {number} [cameraZoom=1] - Default camera zoom
 * @property {StagePropData[]} props - Background props
 * @property {Object} characters - Character positions
 */

/**
 * @typedef {Object} StageEntry
 * @property {string} id - Stage ID
 * @property {StageData} data - Stage data
 * @property {string} name - Display name
 * @property {string[]} propNames - List of prop names
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

function cleanAnimationData(anim) {
  return {
    name: anim.name || '',
    prefix: anim.prefix || anim.name || '',
    frameRate: anim.frameRate ?? DEFAULTS.FRAME_RATE,
    looped: anim.looped ?? true,
    offsets: anim.offsets || [...DEFAULTS.POSITION]
  };
}

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

function cleanCharacterPositions(characters) {
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
    dataFilePath: 'data/stages',
    versionRule: DEFAULTS.VERSION_RULE,
    entityName: 'Stage',

    validateData(data, fileName) {
      if (!data.version) {
        console.warn(`[${this.registryId}] No version for: ${fileName}, assuming ${DEFAULTS.VERSION}`);
      }
      if (data.props && !Array.isArray(data.props)) {
        console.error(`[${this.registryId}] Invalid props format for: ${fileName}`);
        return false;
      }
      return true;
    },

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

    createEntry(id, data) {
      return {
        id,
        data,
        name: data.name,
        propNames: data.props.map((p) => p.name),
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

      getStageProps(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.props : [];
      },

      getPropsSortedByZIndex(stageId) {
        const props = this.getStageProps(stageId);
        return [...props].sort((a, b) => a.zIndex - b.zIndex);
      },

      getProp(stageId, propName) {
        const props = this.getStageProps(stageId);
        return props.find((p) => p.name === propName) || null;
      },

      getCharacterPositions(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.characters : null;
      },

      getCharacterPosition(stageId, charType) {
        const positions = this.getCharacterPositions(stageId);
        return positions ? positions[charType] || null : null;
      },

      getCameraZoom(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.cameraZoom : DEFAULTS.CAMERA_ZOOM;
      },

      getDirectory(stageId) {
        const entry = this.fetchEntry(stageId);
        return entry ? entry.data.directory : null;
      },

      // ========================================
      // LISTING METHODS
      // ========================================

      getStagesByDirectory(directory) {
        return this.getAllEntries().filter((entry) => entry.data.directory === directory);
      },

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
      },

      // ========================================
      // UTILITY METHODS
      // ========================================

      getPropAssetPath(stageId, propName) {
        const prop = this.getProp(stageId, propName);
        if (!prop) return null;

        const directory = this.getDirectory(stageId);
        if (directory) {
          return `images/${directory}/${prop.assetPath}`;
        }
        return `images/${prop.assetPath}`;
      },

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
      },

      toString() {
        return `StageRegistry(${this.countEntries()} stages)`;
      }
    }
  }
);

export default StageRegistry;

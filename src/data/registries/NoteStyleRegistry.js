/**
 * @fileoverview NoteStyleRegistry - Config-driven registry for note style/skin data
 * Manages loading and caching of note style definitions for Rythm Foundation.
 */

import { createRegistry } from '../../core/Registry.js';
import { resolveAssetPath } from '../../utils/AssetPathResolver.js';
import { getSharedRegistryPath } from '../../utils/GameDataPaths.js';

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * Raw asset data from note style JSON before cleaning.
 * @typedef {Object} RawNoteStyleAssetData
 * @property {string} [assetPath] - Path to the asset
 * @property {number} [scale] - Scale multiplier
 * @property {boolean} [isPixel] - Whether this is pixel art
 * @property {number[]} [offsets] - X, Y offsets
 * @property {number} [alpha] - Alpha transparency
 * @property {Record<string, any>} [data] - Additional asset-specific data
 */

/**
 * Raw note style data as read from JSON before cleaning/validation.
 * @typedef {Object} RawNoteStyleData
 * @property {string} [version] - Data format version
 * @property {string} [name] - Display name
 * @property {string} [author] - Author name
 * @property {string | null} [fallback] - Fallback style ID
 * @property {Record<string, RawNoteStyleAssetData>} [assets] - Asset definitions
 */

/**
 * Cleaned/normalized asset data after processing.
 * @typedef {Object} NoteStyleCleanedAssetData
 * @property {string | null} assetPath - Path to the asset
 * @property {number} scale - Scale multiplier
 * @property {boolean} isPixel - Whether this is pixel art
 * @property {number[]} offsets - X, Y offsets
 * @property {number} alpha - Alpha transparency
 * @property {Record<string, any>} data - Additional asset-specific data
 */

/**
 * Cleaned/normalized note style data after processing raw JSON.
 * @typedef {Object} NoteStyleCleanedData
 * @property {string} version - Data format version
 * @property {string} name - Display name
 * @property {string | null} author - Author name
 * @property {string | null} fallback - Fallback style ID
 * @property {Record<string, NoteStyleCleanedAssetData>} assets - Cleaned asset definitions
 */

/**
 * A note style registry entry with ID, cleaned data, and derived fields.
 * @typedef {Object} NoteStyleEntry
 * @property {string} id - Style ID
 * @property {NoteStyleCleanedData} data - Cleaned style data
 * @property {string} name - Display name
 * @property {string | null} fallback - Fallback style ID
 * @property {string[]} assetKeys - List of asset keys
 * @property {function(): void} destroy - Cleanup function
 */

/**
 * Display info returned by getStyleDisplayInfo.
 * @typedef {Object} NoteStyleDisplayInfo
 * @property {string} id - Style ID
 * @property {string} name - Display name
 * @property {string | null} author - Author name
 * @property {string | null} fallback - Fallback style ID
 * @property {boolean} isPixel - Whether the note asset is pixel art
 * @property {number} assetCount - Number of asset keys
 * @property {boolean} hasSplashes - Whether splashes are enabled
 */

const DEFAULTS = {
  VERSION: '1.1.0',
  VERSION_RULE: '1.1.x',
  SCALE: 1,
  ALPHA: 1,
  OFFSETS: [0, 0]
};

const ASSET_KEYS = {
  NOTE: 'note',
  STRUMLINE: 'noteStrumline',
  HOLD_NOTE: 'holdNote',
  SPLASH: 'noteSplash',
  HOLD_COVER: 'holdNoteCover',
  COUNTDOWN_THREE: 'countdownThree',
  COUNTDOWN_TWO: 'countdownTwo',
  COUNTDOWN_ONE: 'countdownOne',
  COUNTDOWN_GO: 'countdownGo',
  JUDGEMENT_SICK: 'judgementSick',
  JUDGEMENT_GOOD: 'judgementGood',
  JUDGEMENT_BAD: 'judgementBad',
  JUDGEMENT_SHIT: 'judgementShit'
};

const DIRECTIONS = ['left', 'down', 'up', 'right'];

/**
 * Clean raw asset data into normalized form.
 * @param {RawNoteStyleAssetData} asset - Raw asset data
 * @returns {NoteStyleCleanedAssetData}
 */
function cleanAssetData(asset) {
  return {
    assetPath: asset.assetPath || null,
    scale: asset.scale ?? DEFAULTS.SCALE,
    isPixel: asset.isPixel ?? false,
    offsets: asset.offsets || [...DEFAULTS.OFFSETS],
    alpha: asset.alpha ?? DEFAULTS.ALPHA,
    data: asset.data || {}
  };
}

const NoteStyleRegistry = createRegistry(
  {
    registryId: 'NOTESTYLE',
    dataFilePath: getSharedRegistryPath('notestyles'),
    versionRule: DEFAULTS.VERSION_RULE,
    entityName: 'Style',

    /**
     * @param {RawNoteStyleData} data
     * @param {string} [fileName]
     * @returns {boolean}
     */
    validateData(data, fileName) {
      if (!data.version) {
        console.warn(
          `[${this.registryId}] No version for: ${fileName}, assuming ${DEFAULTS.VERSION}`
        );
      }
      if (!data.assets || typeof data.assets !== 'object') {
        console.error(`[${this.registryId}] Missing or invalid assets for: ${fileName}`);
        return false;
      }
      return true;
    },

    /**
     * @param {RawNoteStyleData} data
     * @returns {NoteStyleCleanedData}
     */
    cleanData(data) {
      /** @type {Record<string, NoteStyleCleanedAssetData>} */
      const cleanedAssets = {};
      for (const [key, assetData] of Object.entries(
        /** @type {Record<string, RawNoteStyleAssetData>} */ (data.assets)
      )) {
        if (assetData) {
          cleanedAssets[key] = cleanAssetData(assetData);
        }
      }
      return {
        version: data.version || DEFAULTS.VERSION,
        name: data.name || 'Unnamed Style',
        author: data.author || null,
        fallback: data.fallback || null,
        assets: cleanedAssets
      };
    },

    /**
     * @param {string} id
     * @param {NoteStyleCleanedData} data
     * @returns {NoteStyleEntry}
     */
    createEntry(id, data) {
      return {
        id,
        data,
        name: data.name,
        fallback: data.fallback,
        assetKeys: Object.keys(data.assets),
        destroy: () => {}
      };
    }
  },
  {
    statics: { DEFAULTS, ASSET_KEYS, DIRECTIONS },
    methods: {
      /**
       * Get the fallback style ID for a style.
       * @param {string} styleId - Style ID
       * @returns {string | null}
       */
      getFallback(styleId) {
        const entry = this.fetchEntry(styleId);
        return entry ? entry.fallback : null;
      },
      /**
       * Get an asset from a style, falling back to the fallback style if needed.
       * @param {string} styleId - Style ID
       * @param {string} assetKey - Asset key
       * @returns {NoteStyleCleanedAssetData | null}
       */
      getAsset(styleId, assetKey) {
        const entry = this.fetchEntry(styleId);
        if (!entry) {
          return null;
        }
        if (entry.data.assets[assetKey]) {
          return entry.data.assets[assetKey];
        }
        if (entry.fallback) {
          return this.getAsset(entry.fallback, assetKey);
        }
        return null;
      },
      /**
       * Get an asset with its resolved path.
       * @param {string} styleId - Style ID
       * @param {string} assetKey - Asset key
       * @returns {(NoteStyleCleanedAssetData & { resolvedPath: string | null }) | null}
       */
      getResolvedAsset(styleId, assetKey) {
        const asset = this.getAsset(styleId, assetKey);
        if (!asset) {
          return null;
        }
        return { ...asset, resolvedPath: this.resolveAssetPath(asset.assetPath) };
      },
      /**
       * Resolve an asset path using the shared resolver.
       * @param {string | null} assetPath - Asset path to resolve
       * @returns {string | null}
       */
      resolveAssetPath(assetPath) {
        return resolveAssetPath(assetPath);
      },
      /**
       * Check if a style has a specific asset.
       * @param {string} styleId - Style ID
       * @param {string} assetKey - Asset key
       * @returns {boolean}
       */
      hasAsset(styleId, assetKey) {
        return this.getAsset(styleId, assetKey) !== null;
      },
      /**
       * Get note data for a specific direction.
       * @param {string} styleId - Style ID
       * @param {number} direction - Direction index (0-3)
       * @returns {Record<string, any> | null}
       */
      getNoteData(styleId, direction) {
        const asset = this.getAsset(styleId, ASSET_KEYS.NOTE);
        if (!asset || !asset.data) {
          return null;
        }
        return asset.data[DIRECTIONS[direction]] || null;
      },
      /**
       * Get strumline data for a direction and state.
       * @param {string} styleId - Style ID
       * @param {number} direction - Direction index (0-3)
       * @param {string} state - State name (e.g. 'Static', 'Press', 'Confirm')
       * @returns {Record<string, any> | null}
       */
      getStrumlineData(styleId, direction, state) {
        const asset = this.getAsset(styleId, ASSET_KEYS.STRUMLINE);
        if (!asset || !asset.data) {
          return null;
        }
        return asset.data[`${DIRECTIONS[direction]}${state}`] || null;
      },
      /**
       * Get splash data for a direction.
       * @param {string} styleId - Style ID
       * @param {number} direction - Direction index (0-3)
       * @returns {Array<Record<string, any>> | null}
       */
      getSplashData(styleId, direction) {
        const asset = this.getAsset(styleId, ASSET_KEYS.SPLASH);
        if (!asset || !asset.data) {
          return null;
        }
        return asset.data[`${DIRECTIONS[direction]}Splashes`] || null;
      },
      /**
       * Check if splashes are enabled for a style.
       * @param {string} styleId - Style ID
       * @returns {boolean}
       */
      areSplashesEnabled(styleId) {
        const asset = this.getAsset(styleId, ASSET_KEYS.SPLASH);
        return asset?.data?.enabled ?? true;
      },
      /**
       * Get a judgement asset by judgement name.
       * @param {string} styleId - Style ID
       * @param {string} judgement - Judgement name (e.g. 'sick', 'good')
       * @returns {NoteStyleCleanedAssetData | null}
       */
      getJudgementAsset(styleId, judgement) {
        const key = `judgement${judgement.charAt(0).toUpperCase() + judgement.slice(1)}`;
        return this.getAsset(styleId, key);
      },
      /**
       * Get a combo number asset by digit.
       * @param {string} styleId - Style ID
       * @param {number} digit - Digit (0-9)
       * @returns {NoteStyleCleanedAssetData | null}
       */
      getComboNumberAsset(styleId, digit) {
        return this.getAsset(styleId, `comboNumber${digit}`);
      },
      /**
       * Get a countdown asset by step name.
       * @param {string} styleId - Style ID
       * @param {string} step - Countdown step (e.g. 'Three', 'Two', 'One', 'Go')
       * @returns {NoteStyleCleanedAssetData | null}
       */
      getCountdownAsset(styleId, step) {
        return this.getAsset(styleId, `countdown${step}`);
      },
      /**
       * Get all pixel art styles.
       * @returns {NoteStyleEntry[]}
       */
      getPixelStyles() {
        return this.getAllEntries().filter(
          (/** @type {NoteStyleEntry} */ entry) => entry.data.assets.note?.isPixel === true
        );
      },
      /**
       * Get display info for a style.
       * @param {string} styleId - Style ID
       * @returns {NoteStyleDisplayInfo | null}
       */
      getStyleDisplayInfo(styleId) {
        const entry = this.fetchEntry(styleId);
        if (!entry) {
          return null;
        }
        const noteAsset = entry.data.assets.note;
        return {
          id: entry.id,
          name: entry.name,
          author: entry.data.author,
          fallback: entry.fallback,
          isPixel: noteAsset?.isPixel ?? false,
          assetCount: entry.assetKeys.length,
          hasSplashes: this.areSplashesEnabled(styleId)
        };
      },
      /**
       * Get all resolved asset paths for a style (including fallback).
       * @param {string} styleId - Style ID
       * @returns {string[]}
       */
      getAllAssetPaths(styleId) {
        const paths = new Set();
        const entry = this.fetchEntry(styleId);
        if (!entry) {
          return [];
        }
        for (const asset of Object.values(entry.data.assets)) {
          if (asset.assetPath) {
            const resolved = resolveAssetPath(asset.assetPath);
            if (resolved) {
              paths.add(resolved);
            }
          }
          if (asset.data) {
            this._collectNestedPaths(asset.data, paths);
          }
        }
        if (entry.fallback) {
          for (const path of this.getAllAssetPaths(entry.fallback)) {
            paths.add(path);
          }
        }
        return Array.from(paths);
      },
      /**
       * Recursively collect asset and audio paths from nested data.
       * @param {Record<string, any>} data - Nested data object
       * @param {Set<string>} paths - Set to collect paths into
       */
      _collectNestedPaths(data, paths) {
        if (!data || typeof data !== 'object') {
          return;
        }
        for (const value of Object.values(data)) {
          if (typeof value === 'object' && value !== null) {
            if (value.assetPath) {
              const r = resolveAssetPath(value.assetPath);
              if (r) {
                paths.add(r);
              }
            }
            if (value.audioPath) {
              const r = resolveAssetPath(value.audioPath);
              if (r) {
                paths.add(r);
              }
            }
            this._collectNestedPaths(value, paths);
          }
        }
      },
      /** @returns {string} */
      toString() {
        return `NoteStyleRegistry(${this.countEntries()} styles)`;
      }
    }
  }
);

export default NoteStyleRegistry;

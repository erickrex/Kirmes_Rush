/**
 * @fileoverview NoteStyleRegistry - Registry for note style/skin data
 * Manages loading and caching of note style definitions for Friday Night Funkin'.
 *
 * Note styles define the visual appearance of notes, strumline, splashes, and UI elements.
 */

import Registry from '../../core/Registry.js';

/**
 * @typedef {Object} NoteAssetData
 * @property {string} assetPath - Path to sprite asset
 * @property {number} [scale=1] - Asset scale
 * @property {boolean} [isPixel=false] - Use pixel rendering
 * @property {number[]} [offsets=[0,0]] - Position offsets
 * @property {number} [alpha=1] - Opacity
 * @property {Object} [data] - Additional asset-specific data
 */

/**
 * @typedef {Object} NoteStyleAssets
 * @property {NoteAssetData} [note] - Note arrow assets
 * @property {NoteAssetData} [noteStrumline] - Strumline receptor assets
 * @property {NoteAssetData} [holdNote] - Hold note body/tail assets
 * @property {NoteAssetData} [noteSplash] - Note splash effect assets
 * @property {NoteAssetData} [holdNoteCover] - Hold note cover effect assets
 * @property {NoteAssetData} [countdownThree] - Countdown "3" assets
 * @property {NoteAssetData} [countdownTwo] - Countdown "2" / "Ready" assets
 * @property {NoteAssetData} [countdownOne] - Countdown "1" / "Set" assets
 * @property {NoteAssetData} [countdownGo] - Countdown "Go" assets
 * @property {NoteAssetData} [judgementSick] - "Sick" judgement popup
 * @property {NoteAssetData} [judgementGood] - "Good" judgement popup
 * @property {NoteAssetData} [judgementBad] - "Bad" judgement popup
 * @property {NoteAssetData} [judgementShit] - "Shit" judgement popup
 * @property {NoteAssetData} [comboNumber0] - Combo digit 0
 * @property {NoteAssetData} [comboNumber1] - Combo digit 1
 * @property {NoteAssetData} [comboNumber2] - Combo digit 2
 * @property {NoteAssetData} [comboNumber3] - Combo digit 3
 * @property {NoteAssetData} [comboNumber4] - Combo digit 4
 * @property {NoteAssetData} [comboNumber5] - Combo digit 5
 * @property {NoteAssetData} [comboNumber6] - Combo digit 6
 * @property {NoteAssetData} [comboNumber7] - Combo digit 7
 * @property {NoteAssetData} [comboNumber8] - Combo digit 8
 * @property {NoteAssetData} [comboNumber9] - Combo digit 9
 */

/**
 * @typedef {Object} NoteStyleData
 * @property {string} version - Data format version
 * @property {string} name - Display name
 * @property {string} [author] - Style author
 * @property {string | null} [fallback] - Fallback style ID for missing assets
 * @property {NoteStyleAssets} assets - Style assets
 */

/**
 * @typedef {Object} NoteStyleEntry
 * @property {string} id - Style ID
 * @property {NoteStyleData} data - Style data
 * @property {string} name - Display name
 * @property {string | null} fallback - Fallback style ID
 * @property {string[]} assetKeys - List of defined asset keys
 */

// Default values
const DEFAULTS = {
  VERSION: '1.1.0',
  VERSION_RULE: '1.1.x',
  SCALE: 1,
  ALPHA: 1,
  OFFSETS: [0, 0]
};

// Asset key constants
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

// Direction names
const DIRECTIONS = ['left', 'down', 'up', 'right'];

/**
 * Registry for note style data.
 * Handles loading note style definitions from JSON files.
 */
class NoteStyleRegistry extends Registry {
  /**
   * Singleton instance
   * @type {NoteStyleRegistry | null}
   */
  static instance = null;

  /**
   * Default values
   */
  static DEFAULTS = DEFAULTS;

  /**
   * Asset key constants
   */
  static ASSET_KEYS = ASSET_KEYS;

  /**
   * Direction names
   */
  static DIRECTIONS = DIRECTIONS;

  /**
   * Get the singleton instance
   * @returns {NoteStyleRegistry}
   */
  static getInstance() {
    if (!NoteStyleRegistry.instance) {
      NoteStyleRegistry.instance = new NoteStyleRegistry();
    }
    return NoteStyleRegistry.instance;
  }

  /**
   * Create a new NoteStyleRegistry
   */
  constructor() {
    super('NOTESTYLE', 'data/notestyles', DEFAULTS.VERSION_RULE);
  }


  // ========================================
  // PARSING METHODS
  // ========================================

  /**
   * Parse entry data from a pre-loaded JSON object.
   * @param {string} id - The style ID
   * @returns {NoteStyleData | null}
   */
  parseEntryData(id) {
    console.warn(`[${this.registryId}] parseEntryData called without data for: ${id}`);
    return null;
  }

  /**
   * Parse and validate raw JSON data for note style.
   * @param {Object} data - The parsed JSON object
   * @param {string} [fileName] - Optional file name for error reporting
   * @returns {NoteStyleData | null}
   */
  parseEntryDataRaw(data, fileName) {
    if (!data || typeof data !== 'object') {
      console.error(`[${this.registryId}] Invalid note style data for: ${fileName}`);
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

    // Assets are required
    if (!data.assets || typeof data.assets !== 'object') {
      console.error(`[${this.registryId}] Missing or invalid assets for: ${fileName}`);
      return null;
    }

    // Clean and return data
    return this.cleanNoteStyleData(data);
  }

  /**
   * Clean and normalize note style data.
   * @param {Object} data - Raw note style data
   * @returns {NoteStyleData}
   */
  cleanNoteStyleData(data) {
    const cleanedAssets = {};

    // Clean each asset
    for (const [key, assetData] of Object.entries(data.assets)) {
      if (assetData) {
        cleanedAssets[key] = this.cleanAssetData(assetData);
      }
    }

    return {
      version: data.version || DEFAULTS.VERSION,
      name: data.name || 'Unnamed Style',
      author: data.author || null,
      fallback: data.fallback || null,
      assets: cleanedAssets
    };
  }

  /**
   * Clean asset data.
   * @param {Object} asset - Raw asset data
   * @returns {NoteAssetData}
   */
  cleanAssetData(asset) {
    return {
      assetPath: asset.assetPath || null,
      scale: asset.scale ?? DEFAULTS.SCALE,
      isPixel: asset.isPixel ?? false,
      offsets: asset.offsets || [...DEFAULTS.OFFSETS],
      alpha: asset.alpha ?? DEFAULTS.ALPHA,
      data: asset.data || {}
    };
  }

  /**
   * Create a note style entry from parsed data.
   * @param {string} id - Style ID
   * @param {NoteStyleData} data - Parsed style data
   * @returns {NoteStyleEntry | null}
   */
  createEntry(id, data) {
    if (!data) return null;

    return {
      id,
      data,
      name: data.name,
      fallback: data.fallback,
      assetKeys: Object.keys(data.assets),
      destroy: () => {
        // Cleanup if needed
      }
    };
  }


  // ========================================
  // STYLE ACCESS METHODS
  // ========================================

  /**
   * Get note style data by ID.
   * @param {string} styleId - Style ID
   * @returns {NoteStyleData | null}
   */
  getStyleData(styleId) {
    const entry = this.fetchEntry(styleId);
    return entry ? entry.data : null;
  }

  /**
   * Get style display name.
   * @param {string} styleId - Style ID
   * @returns {string}
   */
  getStyleName(styleId) {
    const entry = this.fetchEntry(styleId);
    return entry ? entry.name : styleId;
  }

  /**
   * Get fallback style ID.
   * @param {string} styleId - Style ID
   * @returns {string | null}
   */
  getFallback(styleId) {
    const entry = this.fetchEntry(styleId);
    return entry ? entry.fallback : null;
  }

  /**
   * Get a specific asset from a style.
   * Falls back to fallback style if asset not found.
   * @param {string} styleId - Style ID
   * @param {string} assetKey - Asset key (e.g., 'note', 'noteSplash')
   * @returns {NoteAssetData | null}
   */
  getAsset(styleId, assetKey) {
    const entry = this.fetchEntry(styleId);
    if (!entry) return null;

    // Check if asset exists in this style
    if (entry.data.assets[assetKey]) {
      return entry.data.assets[assetKey];
    }

    // Try fallback style
    if (entry.fallback) {
      return this.getAsset(entry.fallback, assetKey);
    }

    return null;
  }

  /**
   * Get asset with resolved path (handles shared: and week: prefixes).
   * @param {string} styleId - Style ID
   * @param {string} assetKey - Asset key
   * @returns {NoteAssetData | null}
   */
  getResolvedAsset(styleId, assetKey) {
    const asset = this.getAsset(styleId, assetKey);
    if (!asset) return null;

    // Return a copy with resolved path
    return {
      ...asset,
      resolvedPath: this.resolveAssetPath(asset.assetPath)
    };
  }

  /**
   * Resolve asset path prefixes.
   * @param {string | null} assetPath - Raw asset path
   * @returns {string | null}
   */
  resolveAssetPath(assetPath) {
    if (!assetPath) return null;

    // Handle prefixed paths
    if (assetPath.startsWith('shared:')) {
      return `images/shared/${assetPath.slice(7)}`;
    }
    if (assetPath.startsWith('default:')) {
      return `images/preload/${assetPath.slice(8)}`;
    }
    if (assetPath.includes(':')) {
      const [prefix, path] = assetPath.split(':');
      return `images/${prefix}/${path}`;
    }

    return `images/${assetPath}`;
  }

  /**
   * Check if style has a specific asset.
   * @param {string} styleId - Style ID
   * @param {string} assetKey - Asset key
   * @returns {boolean}
   */
  hasAsset(styleId, assetKey) {
    return this.getAsset(styleId, assetKey) !== null;
  }

  /**
   * Get note asset data for a direction.
   * @param {string} styleId - Style ID
   * @param {number} direction - Direction (0-3)
   * @returns {Object | null}
   */
  getNoteData(styleId, direction) {
    const asset = this.getAsset(styleId, ASSET_KEYS.NOTE);
    if (!asset || !asset.data) return null;

    const dirName = DIRECTIONS[direction];
    return asset.data[dirName] || null;
  }

  /**
   * Get strumline asset data for a direction and state.
   * @param {string} styleId - Style ID
   * @param {number} direction - Direction (0-3)
   * @param {string} state - State ('Static', 'Press', 'Confirm', 'ConfirmHold')
   * @returns {Object | null}
   */
  getStrumlineData(styleId, direction, state) {
    const asset = this.getAsset(styleId, ASSET_KEYS.STRUMLINE);
    if (!asset || !asset.data) return null;

    const dirName = DIRECTIONS[direction];
    const key = `${dirName}${state}`;
    return asset.data[key] || null;
  }

  /**
   * Get splash data for a direction.
   * @param {string} styleId - Style ID
   * @param {number} direction - Direction (0-3)
   * @returns {Object[] | null}
   */
  getSplashData(styleId, direction) {
    const asset = this.getAsset(styleId, ASSET_KEYS.SPLASH);
    if (!asset || !asset.data) return null;

    const dirName = DIRECTIONS[direction];
    const key = `${dirName}Splashes`;
    return asset.data[key] || null;
  }

  /**
   * Check if splashes are enabled for a style.
   * @param {string} styleId - Style ID
   * @returns {boolean}
   */
  areSplashesEnabled(styleId) {
    const asset = this.getAsset(styleId, ASSET_KEYS.SPLASH);
    return asset?.data?.enabled ?? true;
  }

  /**
   * Get judgement asset for a judgement type.
   * @param {string} styleId - Style ID
   * @param {string} judgement - Judgement type ('sick', 'good', 'bad', 'shit')
   * @returns {NoteAssetData | null}
   */
  getJudgementAsset(styleId, judgement) {
    const key = `judgement${judgement.charAt(0).toUpperCase() + judgement.slice(1)}`;
    return this.getAsset(styleId, key);
  }

  /**
   * Get combo number asset.
   * @param {string} styleId - Style ID
   * @param {number} digit - Digit (0-9)
   * @returns {NoteAssetData | null}
   */
  getComboNumberAsset(styleId, digit) {
    const key = `comboNumber${digit}`;
    return this.getAsset(styleId, key);
  }

  /**
   * Get countdown asset.
   * @param {string} styleId - Style ID
   * @param {string} step - Countdown step ('Three', 'Two', 'One', 'Go')
   * @returns {NoteAssetData | null}
   */
  getCountdownAsset(styleId, step) {
    const key = `countdown${step}`;
    return this.getAsset(styleId, key);
  }

  // ========================================
  // LISTING METHODS
  // ========================================

  /**
   * List all style IDs.
   * @returns {string[]}
   */
  listStyleIds() {
    return this.listEntryIds();
  }

  /**
   * Get styles that are pixel-based.
   * @returns {NoteStyleEntry[]}
   */
  getPixelStyles() {
    return this.getAllEntries().filter((entry) => {
      const noteAsset = entry.data.assets.note;
      return noteAsset?.isPixel === true;
    });
  }

  /**
   * Get style display info for UI.
   * @param {string} styleId - Style ID
   * @returns {Object | null}
   */
  getStyleDisplayInfo(styleId) {
    const entry = this.fetchEntry(styleId);
    if (!entry) return null;

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
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the file path for style data.
   * @param {string} styleId - Style ID
   * @returns {string}
   */
  getStylePath(styleId) {
    return `${this.dataFilePath}/${styleId}.json`;
  }

  /**
   * Get all unique asset paths for a style (including fallback).
   * @param {string} styleId - Style ID
   * @returns {string[]}
   */
  getAllAssetPaths(styleId) {
    const paths = new Set();
    const entry = this.fetchEntry(styleId);
    if (!entry) return [];

    // Collect paths from this style
    for (const asset of Object.values(entry.data.assets)) {
      if (asset.assetPath) {
        const resolved = this.resolveAssetPath(asset.assetPath);
        if (resolved) paths.add(resolved);
      }

      // Check for nested asset paths in data
      if (asset.data) {
        this.collectNestedPaths(asset.data, paths);
      }
    }

    // Also collect from fallback
    if (entry.fallback) {
      const fallbackPaths = this.getAllAssetPaths(entry.fallback);
      for (const path of fallbackPaths) {
        paths.add(path);
      }
    }

    return Array.from(paths);
  }

  /**
   * Collect nested asset paths from data object.
   * @param {Object} data - Data object to search
   * @param {Set<string>} paths - Set to add paths to
   * @private
   */
  collectNestedPaths(data, paths) {
    if (!data || typeof data !== 'object') return;

    for (const value of Object.values(data)) {
      if (typeof value === 'object' && value !== null) {
        if (value.assetPath) {
          const resolved = this.resolveAssetPath(value.assetPath);
          if (resolved) paths.add(resolved);
        }
        if (value.audioPath) {
          const resolved = this.resolveAssetPath(value.audioPath);
          if (resolved) paths.add(resolved);
        }
        this.collectNestedPaths(value, paths);
      }
    }
  }

  /**
   * Get string representation.
   * @returns {string}
   */
  toString() {
    return `NoteStyleRegistry(${this.countEntries()} styles)`;
  }
}

export default NoteStyleRegistry;

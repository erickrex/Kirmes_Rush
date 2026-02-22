/**
 * @fileoverview LevelSystem - Manages progressive level loading and feature toggles.
 * Handles loading level manifests, setting current level, and checking feature flags.
 */

import LevelManifest from './LevelManifest.js';
import FeatureToggles from './FeatureToggles.js';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * @typedef {import('./LevelManifest.js').LevelConfig} LevelConfig
 */

/**
 * Manages progressive level loading and feature toggles.
 * Supports 5 progressive showcase levels that introduce features incrementally.
 */
class LevelSystem {
  /**
   * Path to level manifest files
   * @type {string}
   * @static
   */
  static MANIFEST_PATH = 'data/levels/';

  /**
   * List of level IDs to load
   * @type {string[]}
   * @static
   */
  static LEVEL_IDS = [
    'level-1-basics',
    'level-2-rhythm',
    'level-3-performance',
    'level-4-challenge',
    'level-5-mastery'
  ];

  /**
   * Loaded level configurations
   * @type {LevelConfig[]}
   */
  levels = [];

  /**
   * Currently active level
   * @type {LevelConfig | null}
   */
  currentLevel = null;

  /**
   * Feature toggles manager
   * @type {FeatureToggles}
   */
  featureToggles = null;

  /**
   * Whether manifests have been loaded
   * @type {boolean}
   */
  loaded = false;

  /**
   * Create a new LevelSystem
   */
  constructor() {
    this.featureToggles = new FeatureToggles();
  }

  // ========================================
  // MANIFEST LOADING
  // ========================================

  /**
   * Load level manifests from JSON files
   * @returns {Promise<boolean>} Whether loading was successful
   */
  async loadManifests() {
    this.levels = [];
    this.loaded = false;

    try {
      for (const levelId of LevelSystem.LEVEL_IDS) {
        const manifest = await this.loadManifest(levelId);
        if (manifest) {
          this.levels.push(manifest);
        }
      }

      this.loaded = true;
      return this.levels.length > 0;
    } catch (error) {
      console.error('LevelSystem: Failed to load manifests', error);
      return false;
    }
  }

  /**
   * Load a single level manifest
   * @param {string} levelId - Level ID to load
   * @returns {Promise<LevelConfig | null>}
   * @private
   */
  async loadManifest(levelId) {
    try {
      const url = `${LevelSystem.MANIFEST_PATH}${levelId}.json`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`LevelSystem: Failed to fetch manifest for ${levelId}`);
        return null;
      }

      const data = await response.json();
      const config = LevelManifest.parse(data);

      if (!config) {
        console.warn(`LevelSystem: Failed to parse manifest for ${levelId}`);
        return null;
      }

      const validation = LevelManifest.validate(config);
      if (!validation.valid) {
        console.warn(`LevelSystem: Invalid manifest for ${levelId}:`, validation.errors);
        return null;
      }

      return config;
    } catch (error) {
      console.error(`LevelSystem: Error loading manifest for ${levelId}`, error);
      return null;
    }
  }

  // ========================================
  // LEVEL ACCESS
  // ========================================

  /**
   * Get level by ID
   * @param {string} levelId - Level ID
   * @returns {LevelConfig | null}
   */
  getLevel(levelId) {
    return this.levels.find((level) => level.id === levelId) || null;
  }

  /**
   * Get all levels
   * @returns {LevelConfig[]}
   */
  getAllLevels() {
    return [...this.levels];
  }

  /**
   * Get level by index (0-based)
   * @param {number} index - Level index
   * @returns {LevelConfig | null}
   */
  getLevelByIndex(index) {
    return this.levels[index] || null;
  }

  /**
   * Get the number of loaded levels
   * @returns {number}
   */
  getLevelCount() {
    return this.levels.length;
  }

  // ========================================
  // CURRENT LEVEL MANAGEMENT
  // ========================================

  /**
   * Set current level
   * @param {string} levelId - Level ID
   * @returns {boolean} Whether the level was set successfully
   */
  setCurrentLevel(levelId) {
    const level = this.getLevel(levelId);
    if (!level) {
      console.warn(`LevelSystem: Level not found: ${levelId}`);
      return false;
    }

    this.currentLevel = level;
    this.featureToggles.setFeatures(level.features);

    // Emit level loaded event
    EventBus.emit(Events.LEVEL_LOADED, {
      levelId: level.id,
      features: this.featureToggles.getAll()
    });

    return true;
  }

  /**
   * Clear current level
   */
  clearCurrentLevel() {
    this.currentLevel = null;
    this.featureToggles.reset();
  }

  /**
   * Get current level
   * @returns {LevelConfig | null}
   */
  getCurrentLevel() {
    return this.currentLevel;
  }

  // ========================================
  // FEATURE TOGGLE ACCESS
  // ========================================

  /**
   * Check if a feature is enabled for current level
   * @param {string} featureName - Feature name
   * @returns {boolean}
   */
  isFeatureEnabled(featureName) {
    return this.featureToggles.isEnabled(featureName);
  }

  /**
   * Get all feature flags for current level
   * @returns {Object<string, boolean>}
   */
  getFeatureFlags() {
    return this.featureToggles.getAll();
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Check if manifests have been loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Reset the level system
   */
  reset() {
    this.levels = [];
    this.currentLevel = null;
    this.featureToggles.reset();
    this.loaded = false;
  }
}

export default LevelSystem;

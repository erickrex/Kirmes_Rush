/**
 * @fileoverview LevelManifest - Parses and validates level manifest files.
 * Handles conversion between JSON and LevelConfig objects.
 */

import FeatureToggles from './FeatureToggles.js';

/**
 * @typedef {Object} LevelUIConfig
 * @property {boolean} showScore - Whether to show score
 * @property {boolean} showCombo - Whether to show combo
 * @property {boolean} showAccuracy - Whether to show accuracy
 * @property {boolean} showMisses - Whether to show misses
 */

/**
 * @typedef {Object} LevelConfig
 * @property {string} id - Level ID
 * @property {string} name - Display name
 * @property {string} [description] - Level description
 * @property {string} songId - Song to use
 * @property {string} difficulty - Difficulty level
 * @property {Object<string, boolean>} features - Enabled features
 * @property {LevelUIConfig} [ui] - UI configuration
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - List of validation errors
 */

/**
 * Parses and validates level manifest files.
 * Provides static methods for working with level configurations.
 */
class LevelManifest {
  /**
   * Current manifest format version
   * @type {string}
   * @static
   */
  static VERSION = '1.0.0';

  /**
   * Required fields for a valid manifest
   * @type {string[]}
   * @static
   */
  static REQUIRED_FIELDS = ['id', 'name', 'songId', 'difficulty', 'features'];

  // ========================================
  // PARSING
  // ========================================

  /**
   * Parse a level manifest from JSON
   * @param {Object} data - Raw JSON data
   * @returns {LevelConfig | null}
   */
  static parse(data) {
    if (!data || typeof data !== 'object') {
      console.error('LevelManifest: Invalid data - expected object');
      return null;
    }

    try {
      /** @type {LevelConfig} */
      const config = {
        id: String(data.id || ''),
        name: String(data.name || ''),
        description: data.description ? String(data.description) : undefined,
        songId: String(data.songId || ''),
        difficulty: String(data.difficulty || 'normal'),
        features: LevelManifest.parseFeatures(data.features),
        ui: LevelManifest.parseUI(data.ui)
      };

      return config;
    } catch (error) {
      console.error('LevelManifest: Failed to parse manifest', error);
      return null;
    }
  }

  /**
   * Parse feature flags from data
   * @param {Object} [data] - Raw features data
   * @returns {Object<string, boolean>}
   * @private
   */
  static parseFeatures(data) {
    const defaults = FeatureToggles.getDefaultFeatures();

    if (!data || typeof data !== 'object') {
      return defaults;
    }

    return {
      holdNotes: typeof data.holdNotes === 'boolean' ? data.holdNotes : defaults.holdNotes,
      healthBar: typeof data.healthBar === 'boolean' ? data.healthBar : defaults.healthBar,
      characters: typeof data.characters === 'boolean' ? data.characters : defaults.characters,
      stage: typeof data.stage === 'boolean' ? data.stage : defaults.stage,
      cameraEffects: typeof data.cameraEffects === 'boolean' ? data.cameraEffects : defaults.cameraEffects,
      noteSplashes: typeof data.noteSplashes === 'boolean' ? data.noteSplashes : defaults.noteSplashes,
      comboPopups: typeof data.comboPopups === 'boolean' ? data.comboPopups : defaults.comboPopups,
      expandedStats: typeof data.expandedStats === 'boolean' ? data.expandedStats : defaults.expandedStats,
      replayRecording: typeof data.replayRecording === 'boolean' ? data.replayRecording : defaults.replayRecording,
      inputBuffer: typeof data.inputBuffer === 'boolean' ? data.inputBuffer : defaults.inputBuffer
    };
  }

  /**
   * Parse UI configuration from data
   * @param {Object} [data] - Raw UI data
   * @returns {LevelUIConfig}
   * @private
   */
  static parseUI(data) {
    const defaults = LevelManifest.getDefaultUI();

    if (!data || typeof data !== 'object') {
      return defaults;
    }

    return {
      showScore: typeof data.showScore === 'boolean' ? data.showScore : defaults.showScore,
      showCombo: typeof data.showCombo === 'boolean' ? data.showCombo : defaults.showCombo,
      showAccuracy: typeof data.showAccuracy === 'boolean' ? data.showAccuracy : defaults.showAccuracy,
      showMisses: typeof data.showMisses === 'boolean' ? data.showMisses : defaults.showMisses
    };
  }

  // ========================================
  // VALIDATION
  // ========================================

  /**
   * Validate a level config
   * @param {LevelConfig} config - Config to validate
   * @returns {ValidationResult}
   */
  static validate(config) {
    /** @type {string[]} */
    const errors = [];

    if (!config || typeof config !== 'object') {
      return { valid: false, errors: ['Config must be an object'] };
    }

    // Check required fields
    for (const field of LevelManifest.REQUIRED_FIELDS) {
      if (field === 'features') {
        if (!config.features || typeof config.features !== 'object') {
          errors.push(`Missing or invalid required field: ${field}`);
        }
      } else if (!config[field] || typeof config[field] !== 'string' || config[field].trim() === '') {
        errors.push(`Missing or invalid required field: ${field}`);
      }
    }

    // Validate features object has all required flags
    if (config.features && typeof config.features === 'object') {
      const requiredFlags = [
        'holdNotes',
        'healthBar',
        'characters',
        'stage',
        'cameraEffects',
        'noteSplashes',
        'comboPopups',
        'expandedStats',
        'replayRecording',
        'inputBuffer'
      ];

      for (const flag of requiredFlags) {
        if (typeof config.features[flag] !== 'boolean') {
          errors.push(`Missing or invalid feature flag: ${flag}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ========================================
  // SERIALIZATION
  // ========================================

  /**
   * Serialize a level config to JSON
   * @param {LevelConfig} config - Config to serialize
   * @returns {Object}
   */
  static serialize(config) {
    return {
      version: LevelManifest.VERSION,
      id: config.id,
      name: config.name,
      description: config.description,
      songId: config.songId,
      difficulty: config.difficulty,
      features: { ...config.features },
      ui: config.ui ? { ...config.ui } : undefined
    };
  }

  // ========================================
  // DEFAULTS
  // ========================================

  /**
   * Get default feature flags
   * @returns {Object<string, boolean>}
   */
  static getDefaultFeatures() {
    return FeatureToggles.getDefaultFeatures();
  }

  /**
   * Get default UI configuration
   * @returns {LevelUIConfig}
   */
  static getDefaultUI() {
    return {
      showScore: true,
      showCombo: true,
      showAccuracy: false,
      showMisses: false
    };
  }

  /**
   * Create a default level config
   * @param {string} id - Level ID
   * @param {string} name - Level name
   * @param {string} songId - Song ID
   * @returns {LevelConfig}
   */
  static createDefault(id, name, songId) {
    return {
      id,
      name,
      songId,
      difficulty: 'normal',
      features: LevelManifest.getDefaultFeatures(),
      ui: LevelManifest.getDefaultUI()
    };
  }
}

export default LevelManifest;

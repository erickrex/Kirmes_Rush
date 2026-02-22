/**
 * @fileoverview LevelSystem - Manages progressive level loading, feature toggles,
 * and manifest parsing. Consolidated from LevelSystem + FeatureToggles + LevelManifest.
 */

import EventBus, { Events } from '../core/EventBus.js';

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * @typedef {Object} FeatureFlags
 * @property {boolean} holdNotes - Enable hold notes
 * @property {boolean} healthBar - Enable health bar
 * @property {boolean} characters - Enable character animations
 * @property {boolean} stage - Enable stage background
 * @property {boolean} cameraEffects - Enable camera zoom/movement
 * @property {boolean} noteSplashes - Enable note splashes
 * @property {boolean} comboPopups - Enable combo popups
 * @property {boolean} expandedStats - Enable NPS, grade, etc.
 * @property {boolean} replayRecording - Enable replay recording
 * @property {boolean} inputBuffer - Enable input buffer
 */

/**
 * @typedef {Object} LevelUIConfig
 * @property {boolean} showScore
 * @property {boolean} showCombo
 * @property {boolean} showAccuracy
 * @property {boolean} showMisses
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
 * @property {boolean} valid
 * @property {string[]} errors
 */

// ========================================
// FEATURE NAMES CONSTANT
// ========================================

/** All supported feature names */
const FEATURE_NAMES = [
  'holdNotes', 'healthBar', 'characters', 'stage', 'cameraEffects',
  'noteSplashes', 'comboPopups', 'expandedStats', 'replayRecording', 'inputBuffer'
];

/** Required fields for a valid manifest */
const REQUIRED_FIELDS = ['id', 'name', 'songId', 'difficulty', 'features'];

/** Current manifest format version */
const MANIFEST_VERSION = '1.0.0';

// ========================================
// FEATURE TOGGLES (inlined)
// ========================================

/**
 * Manages feature flag state for progressive levels.
 */
class FeatureToggles {
  /** @type {string[]} */
  static FEATURE_NAMES = FEATURE_NAMES;

  /** @type {Object<string, boolean>} */
  features = {};

  constructor() {
    this.features = FeatureToggles.getDefaultFeatures();
  }

  /** @returns {Object<string, boolean>} */
  static getDefaultFeatures() {
    const defaults = {};
    for (const name of FEATURE_NAMES) defaults[name] = false;
    return defaults;
  }

  /** @returns {Object<string, boolean>} */
  static getAllEnabled() {
    const all = {};
    for (const name of FEATURE_NAMES) all[name] = true;
    return all;
  }

  /** @param {string} name @returns {boolean} */
  static isValidFeature(name) {
    return FEATURE_NAMES.includes(name);
  }

  /** @param {Object<string, boolean>} features */
  setFeatures(features) {
    if (!features || typeof features !== 'object') {
      this.features = FeatureToggles.getDefaultFeatures();
      return;
    }
    const defaults = FeatureToggles.getDefaultFeatures();
    for (const name of FEATURE_NAMES) {
      this.features[name] = typeof features[name] === 'boolean' ? features[name] : defaults[name];
    }
  }

  /** @param {string} name @returns {boolean} */
  isEnabled(name) {
    if (!FeatureToggles.isValidFeature(name)) return false;
    return this.features[name] === true;
  }

  /** @param {string} name @returns {boolean} */
  enable(name) {
    if (!FeatureToggles.isValidFeature(name)) return false;
    this.features[name] = true;
    return true;
  }

  /** @param {string} name @returns {boolean} */
  disable(name) {
    if (!FeatureToggles.isValidFeature(name)) return false;
    this.features[name] = false;
    return true;
  }

  /** @param {string} name @returns {boolean} */
  toggle(name) {
    if (!FeatureToggles.isValidFeature(name)) return false;
    this.features[name] = !this.features[name];
    return this.features[name];
  }

  /** @returns {Object<string, boolean>} */
  getAll() { return { ...this.features }; }

  /** @returns {string[]} */
  getEnabled() { return FEATURE_NAMES.filter(n => this.features[n] === true); }

  /** @returns {string[]} */
  getDisabled() { return FEATURE_NAMES.filter(n => this.features[n] === false); }

  /** @returns {number} */
  getEnabledCount() { return this.getEnabled().length; }

  reset() { this.features = FeatureToggles.getDefaultFeatures(); }

  enableAll() { this.features = FeatureToggles.getAllEnabled(); }

  disableAll() { this.features = FeatureToggles.getDefaultFeatures(); }

  /** @param {FeatureToggles} other */
  copyFrom(other) {
    if (other && other.features) this.setFeatures(other.features);
  }

  /** @param {Object<string, boolean>} other @returns {boolean} */
  equals(other) {
    if (!other || typeof other !== 'object') return false;
    for (const name of FEATURE_NAMES) {
      if (this.features[name] !== other[name]) return false;
    }
    return true;
  }
}

// ========================================
// MANIFEST PARSING (inlined)
// ========================================

/**
 * Static helpers for parsing and validating level manifests.
 */
class LevelManifest {
  static VERSION = MANIFEST_VERSION;
  static REQUIRED_FIELDS = REQUIRED_FIELDS;

  /** @param {Object} data @returns {LevelConfig | null} */
  static parse(data) {
    if (!data || typeof data !== 'object') return null;
    try {
      return {
        id: String(data.id || ''),
        name: String(data.name || ''),
        description: data.description ? String(data.description) : undefined,
        songId: String(data.songId || ''),
        difficulty: String(data.difficulty || 'normal'),
        features: LevelManifest.parseFeatures(data.features),
        ui: LevelManifest.parseUI(data.ui)
      };
    } catch (error) {
      console.error('LevelManifest: Failed to parse manifest', error);
      return null;
    }
  }

  /** @param {Object} [data] @returns {Object<string, boolean>} */
  static parseFeatures(data) {
    const defaults = FeatureToggles.getDefaultFeatures();
    if (!data || typeof data !== 'object') return defaults;
    for (const name of FEATURE_NAMES) {
      defaults[name] = typeof data[name] === 'boolean' ? data[name] : defaults[name];
    }
    return defaults;
  }

  /** @param {Object} [data] @returns {LevelUIConfig} */
  static parseUI(data) {
    const defaults = LevelManifest.getDefaultUI();
    if (!data || typeof data !== 'object') return defaults;
    return {
      showScore: typeof data.showScore === 'boolean' ? data.showScore : defaults.showScore,
      showCombo: typeof data.showCombo === 'boolean' ? data.showCombo : defaults.showCombo,
      showAccuracy: typeof data.showAccuracy === 'boolean' ? data.showAccuracy : defaults.showAccuracy,
      showMisses: typeof data.showMisses === 'boolean' ? data.showMisses : defaults.showMisses
    };
  }

  /** @param {LevelConfig} config @returns {ValidationResult} */
  static validate(config) {
    const errors = [];
    if (!config || typeof config !== 'object') return { valid: false, errors: ['Config must be an object'] };

    for (const field of REQUIRED_FIELDS) {
      if (field === 'features') {
        if (!config.features || typeof config.features !== 'object') errors.push(`Missing or invalid required field: ${field}`);
      } else if (!config[field] || typeof config[field] !== 'string' || config[field].trim() === '') {
        errors.push(`Missing or invalid required field: ${field}`);
      }
    }

    if (config.features && typeof config.features === 'object') {
      for (const flag of FEATURE_NAMES) {
        if (typeof config.features[flag] !== 'boolean') errors.push(`Missing or invalid feature flag: ${flag}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** @param {LevelConfig} config @returns {Object} */
  static serialize(config) {
    return {
      version: MANIFEST_VERSION,
      id: config.id, name: config.name, description: config.description,
      songId: config.songId, difficulty: config.difficulty,
      features: { ...config.features },
      ui: config.ui ? { ...config.ui } : undefined
    };
  }

  /** @returns {Object<string, boolean>} */
  static getDefaultFeatures() { return FeatureToggles.getDefaultFeatures(); }

  /** @returns {LevelUIConfig} */
  static getDefaultUI() {
    return { showScore: true, showCombo: true, showAccuracy: false, showMisses: false };
  }

  /** @param {string} id @param {string} name @param {string} songId @returns {LevelConfig} */
  static createDefault(id, name, songId) {
    return { id, name, songId, difficulty: 'normal', features: LevelManifest.getDefaultFeatures(), ui: LevelManifest.getDefaultUI() };
  }
}

// ========================================
// LEVEL SYSTEM
// ========================================

/**
 * Manages progressive level loading and feature toggles.
 */
class LevelSystem {
  static MANIFEST_PATH = 'data/levels/';

  static LEVEL_IDS = [
    'level-1-basics', 'level-2-rhythm', 'level-3-performance',
    'level-4-challenge', 'level-5-mastery'
  ];

  /** @type {LevelConfig[]} */
  levels = [];
  /** @type {LevelConfig | null} */
  currentLevel = null;
  /** @type {FeatureToggles} */
  featureToggles = null;
  /** @type {boolean} */
  loaded = false;

  constructor() {
    this.featureToggles = new FeatureToggles();
  }

  /** @returns {Promise<boolean>} */
  async loadManifests() {
    this.levels = [];
    this.loaded = false;
    try {
      for (const levelId of LevelSystem.LEVEL_IDS) {
        const manifest = await this.loadManifest(levelId);
        if (manifest) this.levels.push(manifest);
      }
      this.loaded = true;
      return this.levels.length > 0;
    } catch (error) {
      console.error('LevelSystem: Failed to load manifests', error);
      return false;
    }
  }

  /** @param {string} levelId @returns {Promise<LevelConfig | null>} @private */
  async loadManifest(levelId) {
    try {
      const response = await fetch(`${LevelSystem.MANIFEST_PATH}${levelId}.json`);
      if (!response.ok) return null;
      const data = await response.json();
      const config = LevelManifest.parse(data);
      if (!config) return null;
      const validation = LevelManifest.validate(config);
      if (!validation.valid) return null;
      return config;
    } catch (error) {
      console.error(`LevelSystem: Error loading manifest for ${levelId}`, error);
      return null;
    }
  }

  /** @param {string} levelId @returns {LevelConfig | null} */
  getLevel(levelId) { return this.levels.find(l => l.id === levelId) || null; }

  /** @returns {LevelConfig[]} */
  getAllLevels() { return [...this.levels]; }

  /** @param {number} index @returns {LevelConfig | null} */
  getLevelByIndex(index) { return this.levels[index] || null; }

  /** @returns {number} */
  getLevelCount() { return this.levels.length; }

  /** @param {string} levelId @returns {boolean} */
  setCurrentLevel(levelId) {
    const level = this.getLevel(levelId);
    if (!level) return false;
    this.currentLevel = level;
    this.featureToggles.setFeatures(level.features);
    EventBus.emit(Events.LEVEL_LOADED, { levelId: level.id, features: this.featureToggles.getAll() });
    return true;
  }

  clearCurrentLevel() {
    this.currentLevel = null;
    this.featureToggles.reset();
  }

  /** @returns {LevelConfig | null} */
  getCurrentLevel() { return this.currentLevel; }

  /** @param {string} featureName @returns {boolean} */
  isFeatureEnabled(featureName) { return this.featureToggles.isEnabled(featureName); }

  /** @returns {Object<string, boolean>} */
  getFeatureFlags() { return this.featureToggles.getAll(); }

  /** @returns {boolean} */
  isLoaded() { return this.loaded; }

  reset() {
    this.levels = [];
    this.currentLevel = null;
    this.featureToggles.reset();
    this.loaded = false;
  }
}

export default LevelSystem;
export { FeatureToggles, LevelManifest };

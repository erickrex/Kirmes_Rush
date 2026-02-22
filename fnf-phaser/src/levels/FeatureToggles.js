/**
 * @fileoverview FeatureToggles - Manages feature flag state for levels.
 * Handles enabling/disabling gameplay features based on level configuration.
 */

/**
 * Feature flags configuration object
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
 * Manages feature flag state for progressive levels.
 * Allows checking which features are enabled for the current level.
 */
class FeatureToggles {
  /**
   * List of all supported feature names
   * @type {string[]}
   * @static
   */
  static FEATURE_NAMES = [
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

  /**
   * Current feature flags
   * @type {Object<string, boolean>}
   */
  features = {};

  /**
   * Create a new FeatureToggles instance
   */
  constructor() {
    this.features = FeatureToggles.getDefaultFeatures();
  }

  // ========================================
  // STATIC METHODS
  // ========================================

  /**
   * Get default feature flags (all disabled for minimal level)
   * @returns {Object<string, boolean>}
   */
  static getDefaultFeatures() {
    return {
      holdNotes: false,
      healthBar: false,
      characters: false,
      stage: false,
      cameraEffects: false,
      noteSplashes: false,
      comboPopups: false,
      expandedStats: false,
      replayRecording: false,
      inputBuffer: false
    };
  }

  /**
   * Get feature flags with all features enabled
   * @returns {Object<string, boolean>}
   */
  static getAllEnabled() {
    return {
      holdNotes: true,
      healthBar: true,
      characters: true,
      stage: true,
      cameraEffects: true,
      noteSplashes: true,
      comboPopups: true,
      expandedStats: true,
      replayRecording: true,
      inputBuffer: true
    };
  }

  /**
   * Check if a feature name is valid
   * @param {string} featureName - Feature name to check
   * @returns {boolean}
   */
  static isValidFeature(featureName) {
    return FeatureToggles.FEATURE_NAMES.includes(featureName);
  }

  // ========================================
  // INSTANCE METHODS
  // ========================================

  /**
   * Set all feature flags from a configuration object
   * @param {Object<string, boolean>} features - Feature flags to set
   */
  setFeatures(features) {
    if (!features || typeof features !== 'object') {
      console.warn('FeatureToggles: Invalid features object, using defaults');
      this.features = FeatureToggles.getDefaultFeatures();
      return;
    }

    // Copy features, using defaults for missing values
    const defaults = FeatureToggles.getDefaultFeatures();
    this.features = {
      holdNotes: typeof features.holdNotes === 'boolean' ? features.holdNotes : defaults.holdNotes,
      healthBar: typeof features.healthBar === 'boolean' ? features.healthBar : defaults.healthBar,
      characters: typeof features.characters === 'boolean' ? features.characters : defaults.characters,
      stage: typeof features.stage === 'boolean' ? features.stage : defaults.stage,
      cameraEffects: typeof features.cameraEffects === 'boolean' ? features.cameraEffects : defaults.cameraEffects,
      noteSplashes: typeof features.noteSplashes === 'boolean' ? features.noteSplashes : defaults.noteSplashes,
      comboPopups: typeof features.comboPopups === 'boolean' ? features.comboPopups : defaults.comboPopups,
      expandedStats: typeof features.expandedStats === 'boolean' ? features.expandedStats : defaults.expandedStats,
      replayRecording:
        typeof features.replayRecording === 'boolean' ? features.replayRecording : defaults.replayRecording,
      inputBuffer: typeof features.inputBuffer === 'boolean' ? features.inputBuffer : defaults.inputBuffer
    };
  }

  /**
   * Check if a feature is enabled
   * @param {string} featureName - Feature name to check
   * @returns {boolean}
   */
  isEnabled(featureName) {
    if (!FeatureToggles.isValidFeature(featureName)) {
      console.warn(`FeatureToggles: Unknown feature: ${featureName}`);
      return false;
    }

    return this.features[featureName] === true;
  }

  /**
   * Enable a specific feature
   * @param {string} featureName - Feature name to enable
   * @returns {boolean} Whether the feature was enabled successfully
   */
  enable(featureName) {
    if (!FeatureToggles.isValidFeature(featureName)) {
      console.warn(`FeatureToggles: Cannot enable unknown feature: ${featureName}`);
      return false;
    }

    this.features[featureName] = true;
    return true;
  }

  /**
   * Disable a specific feature
   * @param {string} featureName - Feature name to disable
   * @returns {boolean} Whether the feature was disabled successfully
   */
  disable(featureName) {
    if (!FeatureToggles.isValidFeature(featureName)) {
      console.warn(`FeatureToggles: Cannot disable unknown feature: ${featureName}`);
      return false;
    }

    this.features[featureName] = false;
    return true;
  }

  /**
   * Toggle a specific feature
   * @param {string} featureName - Feature name to toggle
   * @returns {boolean} The new state of the feature
   */
  toggle(featureName) {
    if (!FeatureToggles.isValidFeature(featureName)) {
      console.warn(`FeatureToggles: Cannot toggle unknown feature: ${featureName}`);
      return false;
    }

    this.features[featureName] = !this.features[featureName];
    return this.features[featureName];
  }

  /**
   * Get all feature flags
   * @returns {Object<string, boolean>}
   */
  getAll() {
    return { ...this.features };
  }

  /**
   * Get list of enabled features
   * @returns {string[]}
   */
  getEnabled() {
    return FeatureToggles.FEATURE_NAMES.filter((name) => this.features[name] === true);
  }

  /**
   * Get list of disabled features
   * @returns {string[]}
   */
  getDisabled() {
    return FeatureToggles.FEATURE_NAMES.filter((name) => this.features[name] === false);
  }

  /**
   * Get count of enabled features
   * @returns {number}
   */
  getEnabledCount() {
    return this.getEnabled().length;
  }

  /**
   * Reset to default features (all disabled)
   */
  reset() {
    this.features = FeatureToggles.getDefaultFeatures();
  }

  /**
   * Enable all features
   */
  enableAll() {
    this.features = FeatureToggles.getAllEnabled();
  }

  /**
   * Disable all features
   */
  disableAll() {
    this.features = FeatureToggles.getDefaultFeatures();
  }

  /**
   * Copy features from another FeatureToggles instance
   * @param {FeatureToggles} other - Instance to copy from
   */
  copyFrom(other) {
    if (other && other.features) {
      this.setFeatures(other.features);
    }
  }

  /**
   * Check if features match another set
   * @param {Object<string, boolean>} other - Features to compare
   * @returns {boolean}
   */
  equals(other) {
    if (!other || typeof other !== 'object') {
      return false;
    }

    for (const name of FeatureToggles.FEATURE_NAMES) {
      if (this.features[name] !== other[name]) {
        return false;
      }
    }

    return true;
  }
}

export default FeatureToggles;

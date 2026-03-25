/**
 * @fileoverview NoteSplash - Visual splash effect on perfect note hits
 * Displays animated splash effects at receptor positions.
 *
 * Ported from source/funkin/play/components/NoteSplash.hx
 */

import * as Constants from '../core/Constants.js';

/**
 * @typedef {Object} NoteSplashConfig
 * @property {number} [scale=1.0] - Splash scale
 * @property {number} [alpha=0.6] - Splash alpha
 * @property {number} [lifetime=300] - Splash lifetime in ms
 * @property {boolean} [randomRotation=true] - Whether to randomize rotation
 * @property {boolean} [randomVariation=true] - Whether to randomize variation
 */

/**
 * Note splash effect manager.
 * Handles pooling and display of splash effects on perfect hits.
 */
class NoteSplash {
  /**
   * The Phaser scene
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * Splash scale
   * @type {number}
   */
  scale = 1.0;

  /**
   * Splash alpha
   * @type {number}
   */
  alpha = 0.6;

  /**
   * Splash lifetime in ms
   * @type {number}
   */
  lifetime = 300;

  /**
   * Whether to randomize rotation
   * @type {boolean}
   */
  randomRotation = true;

  /**
   * Whether to randomize variation
   * @type {boolean}
   */
  randomVariation = true;

  /**
   * Number of splash variations
   * @type {number}
   */
  variationCount = 2;

  /**
   * Active splash sprites
   * @type {Array<Object>}
   */
  activeSplashes = [];

  /**
   * Splash sprite pool
   * @type {Array<Object>}
   */
  splashPool = [];

  /**
   * Maximum active splashes
   * @type {number}
   */
  maxActive = 16;

  /**
   * Whether splashes are enabled
   * @type {boolean}
   */
  enabled = true;

  /**
   * Direction colors for tinting
   * @type {Array<number>}
   */
  directionColors = Constants.COLOR_NOTES;

  /**
   * Create a new NoteSplash manager
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {NoteSplashConfig} [config={}] - Configuration options
   */
  constructor(scene, config = {}) {
    this.scene = scene;

    // Apply configuration
    this.scale = config.scale ?? 1.0;
    this.alpha = config.alpha ?? 0.6;
    this.lifetime = config.lifetime ?? 300;
    this.randomRotation = config.randomRotation ?? true;
    this.randomVariation = config.randomVariation ?? true;
  }

  /**
   * Spawn a splash at the given position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} direction - Note direction (0-3)
   * @returns {Object | null} The splash sprite
   */
  spawn(x, y, direction) {
    if (!this.enabled) {
      return null;
    }

    // Get from pool or create new
    let splash = this.splashPool.pop();

    if (!splash) {
      splash = this.createSplash();
    }

    if (!splash) {
      return null;
    }

    // Configure splash
    splash.x = x;
    splash.y = y;
    splash.direction = direction;
    splash.alpha = this.alpha;
    splash.visible = true;
    splash.lifetime = 0;
    splash.maxLifetime = this.lifetime;
    splash.scale = this.scale;

    // Random rotation
    if (this.randomRotation) {
      splash.rotation = Math.random() * Math.PI * 2;
    } else {
      splash.rotation = 0;
    }

    // Random variation
    if (this.randomVariation) {
      splash.variation = Math.floor(Math.random() * this.variationCount);
    } else {
      splash.variation = 0;
    }

    // Set color based on direction
    splash.color = this.directionColors[direction] ?? 0xffffff;

    // Add to active list
    this.activeSplashes.push(splash);

    // Cleanup if too many
    this.cleanupOldSplashes();

    return splash;
  }

  /**
   * Spawn a splash at a receptor
   * @param {Object} receptor - Receptor object with x, y properties
   * @param {number} direction - Note direction
   * @returns {Object | null}
   */
  spawnAtReceptor(receptor, direction) {
    if (!receptor) {
      return null;
    }
    return this.spawn(receptor.x, receptor.y, direction);
  }

  /**
   * Create a new splash object
   * @returns {Object}
   */
  createSplash() {
    return {
      x: 0,
      y: 0,
      direction: 0,
      alpha: 1,
      visible: true,
      lifetime: 0,
      maxLifetime: 300,
      scale: 1,
      rotation: 0,
      variation: 0,
      color: 0xffffff,
      frame: 0
    };
  }

  /**
   * Update all active splashes
   * @param {number} delta - Delta time in ms
   */
  update(delta) {
    for (let i = this.activeSplashes.length - 1; i >= 0; i--) {
      const splash = this.activeSplashes[i];

      // Update lifetime
      splash.lifetime += delta;

      // Update animation frame
      const progress = splash.lifetime / splash.maxLifetime;
      splash.frame = Math.floor(progress * 8); // Assume 8 frames

      // Fade out
      splash.alpha = this.alpha * (1 - progress);

      // Remove if lifetime exceeded
      if (splash.lifetime >= splash.maxLifetime) {
        splash.visible = false;
        this.activeSplashes.splice(i, 1);
        this.splashPool.push(splash);
      }
    }
  }

  /**
   * Clean up old splashes if too many active
   */
  cleanupOldSplashes() {
    while (this.activeSplashes.length > this.maxActive) {
      const splash = this.activeSplashes.shift();
      if (splash) {
        splash.visible = false;
        this.splashPool.push(splash);
      }
    }
  }

  /**
   * Set whether splashes are enabled
   * @param {boolean} enabled - Whether enabled
   * @returns {this}
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    return this;
  }

  /**
   * Set the splash scale
   * @param {number} scale - Scale value
   * @returns {this}
   */
  setScale(scale) {
    this.scale = scale;
    return this;
  }

  /**
   * Set the splash alpha
   * @param {number} alpha - Alpha value (0-1)
   * @returns {this}
   */
  setAlpha(alpha) {
    this.alpha = Math.max(0, Math.min(1, alpha));
    return this;
  }

  /**
   * Set the splash lifetime
   * @param {number} lifetime - Lifetime in ms
   * @returns {this}
   */
  setLifetime(lifetime) {
    this.lifetime = lifetime;
    return this;
  }

  /**
   * Set the number of variations
   * @param {number} count - Number of variations
   * @returns {this}
   */
  setVariationCount(count) {
    this.variationCount = Math.max(1, count);
    return this;
  }

  /**
   * Set direction colors
   * @param {Array<number>} colors - Array of colors for each direction
   * @returns {this}
   */
  setDirectionColors(colors) {
    this.directionColors = colors;
    return this;
  }

  /**
   * Get the number of active splashes
   * @returns {number}
   */
  getActiveCount() {
    return this.activeSplashes.length;
  }

  /**
   * Get all active splashes for rendering
   * @returns {Array<Object>}
   */
  getActiveSplashes() {
    return this.activeSplashes;
  }

  /**
   * Clear all active splashes
   */
  clear() {
    while (this.activeSplashes.length > 0) {
      const splash = this.activeSplashes.pop();
      if (splash) {
        splash.visible = false;
        this.splashPool.push(splash);
      }
    }
  }

  /**
   * Get direction name
   * @param {number} direction - Direction index
   * @returns {string}
   */
  static getDirectionName(direction) {
    const names = ['left', 'down', 'up', 'right'];
    return names[direction] ?? 'unknown';
  }

  /**
   * Destroy the splash manager
   */
  destroy() {
    this.clear();
    this.splashPool = [];
    this.scene = null;
  }
}

export default NoteSplash;

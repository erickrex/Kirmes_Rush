/**
 * @fileoverview NoteSplash - Visual splash effect on perfect note hits
 * Displays animated splash effects at receptor positions.
 *
 * Ported from source/rythm/play/components/NoteSplash.hx
 */

import * as Constants from '../core/Constants.js';

/**
 * @typedef {Object} NoteSplashConfig
 * @property {number} [scale=1.0] - Splash scale
 * @property {number} [alpha=0.6] - Splash alpha
 * @property {number} [lifetime=300] - Splash lifetime in ms
 * @property {boolean} [randomRotation=true] - Whether to randomize rotation
 * @property {boolean} [randomVariation=true] - Whether to randomize variation
 * @property {string} [splashTextureKey] - Texture key of a loaded note-style splash asset.
 *   When this texture exists in the scene it is used instead of the generated burst.
 * @property {number} [depth=90] - Depth assigned to splash game objects
 * @property {((gameObject: any) => void) | null} [registerObject] - Optional hook invoked with each
 *   newly created Phaser game object so the owner can assign it to a camera layer (e.g. the HUD camera)
 */

/**
 * @typedef {Object} SplashSprite
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} direction - Note direction
 * @property {number} alpha - Alpha transparency
 * @property {boolean} visible - Whether visible
 * @property {number} lifetime - Current lifetime
 * @property {number} maxLifetime - Maximum lifetime
 * @property {number} scale - Scale
 * @property {number} rotation - Rotation
 * @property {number} variation - Variation index
 * @property {number} color - Color tint
 * @property {number} [frame] - Current frame
 * @property {Phaser.GameObjects.Sprite | null} [gameObject] - Phaser game object
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
   * @type {Array<SplashSprite>}
   */
  activeSplashes = [];

  /**
   * Splash sprite pool
   * @type {Array<SplashSprite>}
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
   * Texture key of a loaded note-style splash asset. When this texture exists
   * in the scene it is preferred over the generated burst placeholder.
   * @type {string | null}
   */
  splashTextureKey = null;

  /**
   * Texture key for the generated burst placeholder created via the
   * Generated_Texture_Pattern when no loaded splash asset is available.
   * @type {string}
   */
  generatedTextureKey = 'generated-note-splash';

  /**
   * Depth assigned to splash game objects so they render above receptors.
   * @type {number}
   */
  depth = 90;

  /**
   * Optional hook invoked with each newly created Phaser game object. Lets the
   * owner (e.g. PlayState) register splashes on the HUD/receptor camera layer.
   * Null in headless mode.
   * @type {((gameObject: any) => void) | null}
   */
  registerObject = null;

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
    this.splashTextureKey = config.splashTextureKey ?? null;
    if (config.depth !== undefined) {
      this.depth = config.depth;
    }
    this.registerObject = config.registerObject ?? null;
  }

  /**
   * Spawn a splash at the given position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} direction - Note direction (0-3)
   * @returns {SplashSprite | null} The splash sprite
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

    // Attach/refresh the real game object (no-op in headless mode)
    this.ensureGameObject(splash);
    this.syncGameObject(splash);

    // Cleanup if too many
    this.cleanupOldSplashes();

    return splash;
  }

  /**
   * Spawn a splash at a receptor
   * @param {{x: number, y: number}} receptor - Receptor object with x, y properties
   * @param {number} direction - Note direction
   * @returns {SplashSprite | null}
   */
  spawnAtReceptor(receptor, direction) {
    if (!receptor) {
      return null;
    }
    return this.spawn(receptor.x, receptor.y, direction);
  }

  /**
   * Create a new splash object
   * @returns {SplashSprite}
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
      frame: 0,
      gameObject: null
    };
  }

  /**
   * Resolve the texture key to use for splash game objects. Prefers a loaded
   * note-style splash asset when present in the scene; otherwise lazily
   * generates a burst placeholder via the Generated_Texture_Pattern and returns
   * its key. Returns null when no scene/texture manager is available.
   * @returns {string | null}
   */
  acquireSplashTexture() {
    if (!this.scene?.textures) {
      return null;
    }

    // Prefer a real loaded splash asset when one exists.
    if (this.splashTextureKey && this.scene.textures.exists?.(this.splashTextureKey)) {
      return this.splashTextureKey;
    }

    // Otherwise fall back to a generated burst placeholder.
    this.ensureGeneratedTexture();
    if (this.scene.textures.exists?.(this.generatedTextureKey)) {
      return this.generatedTextureKey;
    }
    return null;
  }

  /**
   * Generate a white burst placeholder texture (radiating star) once, following
   * the Generated_Texture_Pattern used by GeneratedGameplaySkin. White fill so
   * per-direction tinting via `setTint` produces the correct color. No-op when
   * the scene cannot create graphics or the texture already exists.
   */
  ensureGeneratedTexture() {
    if (!this.scene?.add?.graphics || !this.scene.textures) {
      return;
    }
    if (this.scene.textures.exists?.(this.generatedTextureKey)) {
      return;
    }

    const size = 96;
    const center = size / 2;
    const outer = 44;
    const inner = 18;
    const points = 8;

    const graphics = this.scene.add.graphics();
    graphics.clear();
    graphics.fillStyle(0xffffff, 1);

    /** @type {Array<{x: number, y: number}>} */
    const star = [];
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      star.push({ x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius });
    }

    if (typeof graphics.fillPoints === 'function') {
      graphics.fillPoints(/** @type {any} */ (star), true);
    } else {
      // Fallback for environments without polygon fill support.
      graphics.fillCircle(center, center, inner);
    }
    graphics.fillCircle(center, center, inner);
    graphics.generateTexture(this.generatedTextureKey, size, size);
    graphics.destroy();
  }

  /**
   * Lazily create the real Phaser game object backing a splash record. Creation
   * is guarded behind `this.scene?.add` so headless environments (and teardown
   * races) never throw. Reuses an already-attached game object.
   * @param {SplashSprite} splash - The splash record to back with a game object
   * @returns {Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null}
   */
  ensureGameObject(splash) {
    if (!splash) {
      return null;
    }
    if (splash.gameObject) {
      return splash.gameObject;
    }
    if (!this.scene?.add) {
      return null;
    }

    const textureKey = this.acquireSplashTexture();
    /** @type {any} */
    let gameObject = null;
    if (textureKey && typeof this.scene.add.image === 'function') {
      gameObject = this.scene.add.image(splash.x, splash.y, textureKey);
    } else if (textureKey && typeof this.scene.add.sprite === 'function') {
      gameObject = this.scene.add.sprite(splash.x, splash.y, textureKey);
    }

    if (!gameObject) {
      return null;
    }

    if (typeof gameObject.setOrigin === 'function') {
      gameObject.setOrigin(0.5, 0.5);
    }
    if (typeof gameObject.setDepth === 'function') {
      gameObject.setDepth(this.depth);
    }
    if (typeof gameObject.setTint === 'function') {
      gameObject.setTint(splash.color);
    }

    splash.gameObject = gameObject;
    if (typeof this.registerObject === 'function') {
      this.registerObject(gameObject);
    }
    this.syncGameObject(splash);
    return gameObject;
  }

  /**
   * Apply the tracked render state (`x`, `y`, `alpha`, `scale`, `rotation`,
   * `visible`) of a splash record onto its backing game object. No-op when there
   * is no game object (headless mode).
   * @param {SplashSprite} splash - The splash record to sync
   */
  syncGameObject(splash) {
    const gameObject = splash?.gameObject;
    if (!gameObject) {
      return;
    }
    if (typeof gameObject.setPosition === 'function') {
      gameObject.setPosition(splash.x, splash.y);
    }
    if (typeof gameObject.setAlpha === 'function') {
      gameObject.setAlpha(splash.alpha);
    }
    if (typeof gameObject.setScale === 'function') {
      gameObject.setScale(splash.scale);
    }
    if (typeof gameObject.setRotation === 'function') {
      gameObject.setRotation(splash.rotation);
    }
    if (typeof gameObject.setVisible === 'function') {
      gameObject.setVisible(splash.visible);
    }
    if (typeof gameObject.setTint === 'function') {
      gameObject.setTint(splash.color);
    }
  }

  /**
   * Destroy the backing game object of a splash record (if any) and clear the
   * link so it can be lazily recreated on reuse.
   * @param {SplashSprite} splash - The splash record whose game object to destroy
   */
  destroyGameObject(splash) {
    if (!splash) {
      return;
    }
    if (splash.gameObject && typeof splash.gameObject.destroy === 'function') {
      splash.gameObject.destroy();
    }
    splash.gameObject = null;
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
        this.syncGameObject(splash);
        this.activeSplashes.splice(i, 1);
        this.splashPool.push(splash);
      } else {
        this.syncGameObject(splash);
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
        this.syncGameObject(splash);
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
   * @returns {Array<SplashSprite>}
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
        this.syncGameObject(splash);
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
    // Destroy every backing game object across active and pooled records.
    for (const splash of [...this.activeSplashes, ...this.splashPool]) {
      this.destroyGameObject(splash);
    }

    this.clear();
    this.splashPool = [];
    this.scene = null;
  }
}

export default NoteSplash;

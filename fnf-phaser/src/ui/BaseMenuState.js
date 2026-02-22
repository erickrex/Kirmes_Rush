/**
 * @fileoverview BaseMenuState - Common base class for menu scenes.
 * Extracts shared patterns: input setup/teardown, sound effects,
 * background creation, fade transitions, and navigation guards.
 */

import Phaser from 'phaser';

/**
 * Base class for menu scenes. Handles common input binding,
 * sound effects, background rendering, and scene transitions.
 *
 * Subclasses should override:
 * - `getInputBindings()` to declare their key→handler mappings
 * - `onNavigateUp/Down()`, `onSelect()`, `onBack()` for menu logic
 *
 * @extends Phaser.Scene
 */
export default class BaseMenuState extends Phaser.Scene {
  constructor(config) {
    super(config);

    /** @type {boolean} */
    this.transitioning = false;
  }

  // ========================================
  // SOUND HELPERS
  // ========================================

  /** Play the menu scroll sound */
  playScrollSound() {
    if (this.cache.audio.exists('scroll-sound')) {
      this.sound.play('scroll-sound', { volume: 0.5 });
    }
  }

  /** Play the menu confirm sound */
  playConfirmSound() {
    if (this.cache.audio.exists('confirm-sound')) {
      this.sound.play('confirm-sound');
    }
  }

  /** Play the menu cancel sound */
  playCancelSound() {
    if (this.cache.audio.exists('cancel-sound')) {
      this.sound.play('cancel-sound');
    }
  }

  // ========================================
  // BACKGROUND
  // ========================================

  /**
   * Create a background from a texture key, with a gradient fallback.
   * @param {string} textureKey - Texture to use
   * @param {number} [color1=0x1a1a2e] - Top gradient color
   * @param {number} [color2=0x16213e] - Bottom gradient color
   */
  createBackground(textureKey, color1 = 0x1a1a2e, color2 = 0x16213e) {
    const { width, height } = this.cameras.main;

    if (textureKey && this.textures.exists(textureKey)) {
      const bg = this.add.sprite(width / 2, height / 2, textureKey);
      bg.setDisplaySize(width, height);
      return bg;
    }

    const graphics = this.add.graphics();
    graphics.fillGradientStyle(color1, color1, color2, color2, 1);
    graphics.fillRect(0, 0, width, height);
    return graphics;
  }

  // ========================================
  // TRANSITIONS
  // ========================================

  /**
   * Fade out and transition to another scene.
   * @param {string} sceneKey - Target scene key
   * @param {Object} [data] - Optional data to pass
   */
  transitionToScene(sceneKey, data) {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  /** Fade the camera in (call in `create()`). */
  fadeIn() {
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ========================================
  // INPUT BINDING
  // ========================================

  /**
   * Return an array of `{ key, handler }` objects describing all
   * keyboard bindings for this menu. Override in subclasses.
   *
   * Example:
   * ```js
   * getInputBindings() {
   *   return [
   *     { key: 'keydown-UP', handler: this.onNavigateUp },
   *     { key: 'keydown-ENTER', handler: this.onSelect },
   *   ];
   * }
   * ```
   * @returns {{ key: string, handler: Function }[]}
   */
  getInputBindings() {
    return [];
  }

  /**
   * Bind all inputs returned by `getInputBindings()`.
   * Call this in your `create()` method.
   */
  setupInput() {
    for (const { key, handler } of this.getInputBindings()) {
      this.input.keyboard.on(key, handler, this);
    }
  }

  /**
   * Unbind all inputs. Call this in your `shutdown()` method
   * (or let `shutdown()` on this base class handle it).
   */
  teardownInput() {
    for (const { key, handler } of this.getInputBindings()) {
      this.input.keyboard.off(key, handler, this);
    }
  }

  /**
   * Default shutdown cleans up input bindings.
   * Subclasses should call `super.shutdown()` if they override.
   */
  shutdown() {
    this.teardownInput();
  }

  // ========================================
  // COMMON UI SOUNDS PRELOAD
  // ========================================

  /**
   * Preload common menu sounds (scroll, confirm, cancel).
   * Call from your `preload()` method.
   */
  preloadMenuSounds() {
    if (!this.cache.audio.exists('scroll-sound')) {
      this.load.audio('scroll-sound', 'audio/scrollMenu.mp3');
    }
    if (!this.cache.audio.exists('confirm-sound')) {
      this.load.audio('confirm-sound', 'audio/confirmMenu.mp3');
    }
    if (!this.cache.audio.exists('cancel-sound')) {
      this.load.audio('cancel-sound', 'audio/cancelMenu.mp3');
    }
  }
}

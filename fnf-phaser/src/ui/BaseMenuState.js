/**
 * @fileoverview BaseMenuState - Common base class for menu scenes.
 * Extracts shared patterns: input setup/teardown, sound effects,
 * background creation, fade transitions, and navigation guards.
 */

import Phaser from 'phaser';
/**
 * Base class for menu scenes. Handles common input binding,
 * sound effects, background rendering, scene transitions,
 * and list-based navigation (index wrapping, transition guards,
 * scroll/confirm/cancel sounds).
 *
 * Subclasses should override:
 * - `getItemCount()` to return the number of navigable items
 * - `updateSelection()` to re-render the selection highlight
 * - `executeSelection()` to perform the selected action
 * - `executeBack()` to perform the back/cancel action
 * - Optionally extend `getInputBindings()` via `super.getInputBindings()`
 *
 * @extends Phaser.Scene
 */
export default class BaseMenuState extends Phaser.Scene {
  constructor(config) {
    super(config);

    /** @type {boolean} */
    this.transitioning = false;

    /** @type {number} */
    this.selectedIndex = 0;
  }

  // ========================================
  // NAVIGATION — SUBCLASS OVERRIDES
  // ========================================

  /**
   * Return the number of navigable items. Subclasses must override.
   * @returns {number}
   */
  getItemCount() {
    return 0;
  }

  /**
   * Re-render the selection highlight. Override in subclasses.
   */
  updateSelection() {
    // no-op — subclasses provide visual update
  }

  /**
   * Perform the action for the currently selected item. Override in subclasses.
   */
  executeSelection() {
    // no-op — subclasses provide selection logic
  }

  /**
   * Perform the back/cancel action. Override in subclasses.
   */
  executeBack() {
    // no-op — subclasses provide back logic
  }

  // ========================================
  // NAVIGATION — PROVIDED BY BASE
  // ========================================

  /** Navigate up through the menu list with wrapping. */
  onNavigateUp() {
    const itemCount = this.getItemCount();
    if (this.transitioning || itemCount === 0) {
      return;
    }
    this.selectedIndex = (this.selectedIndex - 1 + itemCount) % itemCount;
    this.playScrollSound();
    this.updateSelection();
  }

  /** Navigate down through the menu list with wrapping. */
  onNavigateDown() {
    const itemCount = this.getItemCount();
    if (this.transitioning || itemCount === 0) {
      return;
    }
    this.selectedIndex = (this.selectedIndex + 1) % itemCount;
    this.playScrollSound();
    this.updateSelection();
  }

  /** Confirm the current selection with transition guard. */
  onSelect() {
    if (this.transitioning || this.getItemCount() === 0) {
      return;
    }
    this.transitioning = true;
    this.playConfirmSound();
    this.executeSelection();
  }

  /** Go back / cancel with transition guard. */
  onBack() {
    if (this.transitioning) {
      return;
    }
    this.transitioning = true;
    this.playCancelSound();
    this.executeBack();
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
   * keyboard bindings for this menu. Provides default UP/W, DOWN/S,
   * ENTER/SPACE, ESC/BACKSPACE bindings. Subclasses can extend via
   * `[...super.getInputBindings(), ...extraBindings]`.
   *
   * @returns {{ key: string, handler: Function }[]}
   */
  getInputBindings() {
    return [
      { key: 'keydown-UP', handler: this.onNavigateUp },
      { key: 'keydown-W', handler: this.onNavigateUp },
      { key: 'keydown-DOWN', handler: this.onNavigateDown },
      { key: 'keydown-S', handler: this.onNavigateDown },
      { key: 'keydown-ENTER', handler: this.onSelect },
      { key: 'keydown-SPACE', handler: this.onSelect },
      { key: 'keydown-ESC', handler: this.onBack },
      { key: 'keydown-BACKSPACE', handler: this.onBack }
    ];
  }

  /**
   * Bind all inputs returned by `getInputBindings()`.
   * Call this in your `create()` method.
   */
  setupInput() {
    for (const { key, handler } of this.getInputBindings()) {
      this.input.keyboard.on(key, handler, this);
    }

    // Wire shutdown into Phaser's scene lifecycle so cleanup is deterministic
    this.events?.on('shutdown', this.shutdown, this);
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

  // ========================================
  // TOUCH INTERACTIVITY
  // ========================================

  /** Minimum touch target size in pixels (Requirement 10.2) */
  static MIN_TOUCH_TARGET = 48;

  /**
   * Make an array of text/game objects tappable with minimum 48×48px hit areas.
   * Each item gets `setInteractive()` and a `pointerdown` handler that sets
   * `selectedIndex` to the item's index and calls `onSelect()`.
   *
   * @param {Phaser.GameObjects.Text[]} items - The text objects to make interactive
   */
  enableTouchOnItems(items) {
    const minSize = BaseMenuState.MIN_TOUCH_TARGET;
    items.forEach((item, index) => {
      item.setInteractive({ useHandCursor: true });
      // Ensure minimum 48×48 hit area
      if (item.input && item.input.hitArea) {
        item.input.hitArea.width = Math.max(item.input.hitArea.width, minSize);
        item.input.hitArea.height = Math.max(item.input.hitArea.height, minSize);
      }
      item.on('pointerdown', () => {
        if (this.transitioning) {
          return;
        }
        this.selectedIndex = index;
        this.updateSelection();
        this.onSelect();
      });
    });
  }

  /**
   * Default shutdown cleans up input bindings.
   * Subclasses should call `super.shutdown()` if they override.
   */
  shutdown() {
    this.events?.off('shutdown', this.shutdown, this);
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
      this.load.audio('scroll-sound', 'assets/funkin.assets/preload/sounds/scrollMenu.mp3');
    }
    if (!this.cache.audio.exists('confirm-sound')) {
      this.load.audio('confirm-sound', 'assets/funkin.assets/preload/sounds/confirmMenu.mp3');
    }
    if (!this.cache.audio.exists('cancel-sound')) {
      this.load.audio('cancel-sound', 'assets/funkin.assets/preload/sounds/cancelMenu.mp3');
    }
  }
}

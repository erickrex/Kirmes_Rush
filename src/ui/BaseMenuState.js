/**
 * @fileoverview BaseMenuState - Common base class for menu scenes.
 * Extracts shared patterns: input setup/teardown, sound effects,
 * background creation, fade transitions, and navigation guards.
 */

import Phaser from '../phaser.js';
import Transitions, { TransitionType } from '../graphics/Transitions.js';
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
  /**
   * @param {Phaser.Types.Scenes.SettingsConfig} config
   */
  constructor(config) {
    super(config);

    /** @type {boolean} */
    this.transitioning = false;

    /** @type {number} */
    this.selectedIndex = 0;

    /**
     * Shared scene-transition helper. Constructed lazily on first use
     * (see `getTransitions`) and destroyed in `shutdown`.
     * @type {Transitions | null}
     */
    this.transitions = null;

    /** @type {{ target: HTMLCanvasElement, handler: EventListener } | null} */
    this.audioUnlockListener = null;
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
   * @param {string} [textureKey] - Texture to use
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
   * Lazily construct and return this scene's shared {@link Transitions}
   * instance. Centralizing the instance here means every menu scene routes
   * its scene changes through a single transition mechanism.
   * @returns {Transitions}
   */
  getTransitions() {
    if (!this.transitions) {
      this.transitions = new Transitions(this);
    }
    return this.transitions;
  }

  /**
   * Transition to another scene. Plays a Transitions "out" animation
   * (default: a 500ms fade, visually equivalent to the previous
   * `cameras.main.fadeOut(500)`) and starts the target scene only after the
   * animation completes. The target `sceneKey` and `data` payload are passed
   * through unchanged, preserving the navigation contract.
   *
   * Safe against interruption: if the scene shuts down mid-transition (which
   * destroys the Transitions instance), the target scene is not started and
   * no error is thrown.
   *
   * @param {string} sceneKey - Target scene key
   * @param {Object} [data] - Optional data to pass
   * @returns {Promise<void>}
   */
  async transitionToScene(sceneKey, data) {
    const transitions = this.getTransitions();
    try {
      await transitions.transitionOut({ type: TransitionType.FADE, duration: 500 });
    } catch {
      // An interrupted transition (e.g. scene shutdown) must not throw.
      return;
    }
    // If the scene was torn down while the transition was in flight,
    // `shutdown` will have destroyed and cleared the Transitions instance.
    // Skip navigation in that case.
    if (!this.transitions) {
      return;
    }
    this.scene.start(sceneKey, data);
  }

  /** Fade the camera in (call in `create()`). */
  fadeIn() {
    this.getTransitions().transitionIn({ type: TransitionType.FADE, duration: 500 });
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
    const kb = this.input.keyboard;
    if (kb) {
      for (const { key, handler } of this.getInputBindings()) {
        kb.on(key, handler, this);
      }
    }

    // Unlock the Web Audio context on the first touch/click in any menu.
    // Mobile browsers suspend audio until a user gesture; tapping through
    // menus counts as a gesture and unlocks it before gameplay starts.
    const canvas = this.game?.canvas;
    if (canvas) {
      this.teardownAudioUnlock();
      const unlock = () => {
        try {
          const mgr = /** @type {any} */ (this.sound);
          const ctx = mgr?.context;
          if (ctx && ctx.state === 'suspended') {
            ctx.resume();
          }
        } catch {
          /* swallow */
        }
        this.teardownAudioUnlock();
      };
      this.audioUnlockListener = { target: canvas, handler: unlock };
      canvas.addEventListener('touchstart', unlock, { once: true, passive: true });
      canvas.addEventListener('mousedown', unlock, { once: true });
    }

    // Wire shutdown into Phaser's scene lifecycle so cleanup is deterministic
    this.events?.on('shutdown', this.shutdown, this);
  }

  /**
   * Unbind all inputs. Call this in your `shutdown()` method
   * (or let `shutdown()` on this base class handle it).
   */
  teardownInput() {
    const kb = this.input.keyboard;
    if (kb) {
      for (const { key, handler } of this.getInputBindings()) {
        kb.off(key, handler, this);
      }
    }
    this.teardownAudioUnlock();
  }

  /** Remove pending raw DOM Web Audio unlock listeners. */
  teardownAudioUnlock() {
    if (!this.audioUnlockListener) {
      return;
    }

    const { target, handler } = this.audioUnlockListener;
    target.removeEventListener('touchstart', handler);
    target.removeEventListener('mousedown', handler);
    this.audioUnlockListener = null;
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
   * Default shutdown cleans up input bindings and tears down the shared
   * Transitions instance. Destroying Transitions cancels any in-flight tween
   * and removes its overlay without throwing, even mid-transition.
   * Subclasses should call `super.shutdown()` if they override.
   */
  shutdown() {
    this.events?.off('shutdown', this.shutdown, this);
    this.teardownInput();
    if (this.transitions) {
      this.transitions.destroy();
      this.transitions = null;
    }
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
      this.load.audio(
        'scroll-sound',
        'assets/rythm-foundation.assets/preload/sounds/scrollMenu.mp3'
      );
    }
    if (!this.cache.audio.exists('confirm-sound')) {
      this.load.audio(
        'confirm-sound',
        'assets/rythm-foundation.assets/preload/sounds/confirmMenu.mp3'
      );
    }
    if (!this.cache.audio.exists('cancel-sound')) {
      this.load.audio(
        'cancel-sound',
        'assets/rythm-foundation.assets/preload/sounds/cancelMenu.mp3'
      );
    }
  }
}

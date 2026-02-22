/**
 * @fileoverview PreciseInput - Timestamped input queue for rhythm game accuracy
 * Captures keyboard events with precise timestamps for accurate hit detection.
 *
 * Based on source/funkin/input/Controls.hx input handling
 *
 * Supports optional InputBuffer integration for competitive play, allowing
 * slightly early inputs to still register as hits when notes enter the hit window.
 */

import Controls from './Controls.js';
import InputBuffer from './InputBuffer.js';

/**
 * @typedef {Object} InputEvent
 * @property {number} direction - Note direction (0-3)
 * @property {number} timestamp - High-precision timestamp (performance.now())
 * @property {string} keyCode - The key code that triggered this event
 */

/**
 * Precise input handler with timestamped event queue.
 * Uses raw DOM events for most accurate timing.
 *
 * Supports optional InputBuffer integration for competitive play.
 */
class PreciseInput {
  /**
   * The scene this input handler belongs to
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * Controls instance for keybind management
   * @type {Controls}
   */
  controls = null;

  /**
   * Queue of press events
   * @type {InputEvent[]}
   */
  pressQueue = [];

  /**
   * Queue of release events
   * @type {InputEvent[]}
   */
  releaseQueue = [];

  /**
   * Currently held keys (by key code)
   * @type {Set<string>}
   */
  heldKeys = new Set();

  /**
   * Currently held directions
   * @type {boolean[]}
   */
  heldDirections = [false, false, false, false];

  /**
   * Whether input is enabled
   * @type {boolean}
   */
  enabled = true;

  /**
   * Optional InputBuffer for buffering early inputs
   * @type {InputBuffer | null}
   */
  inputBuffer = null;

  /**
   * Whether buffer integration is enabled
   * @type {boolean}
   */
  bufferEnabled = false;

  /**
   * Bound event handlers (for cleanup)
   * @type {Object}
   * @private
   */
  _boundHandlers = null;

  /**
   * Create a new PreciseInput handler
   * @param {Phaser.Scene} [scene] - The scene (optional)
   * @param {Controls} [controls] - Controls instance (optional, creates new if not provided)
   */
  constructor(scene = null, controls = null) {
    this.scene = scene;
    this.controls = controls ?? new Controls();

    this._boundHandlers = {
      keydown: this._onKeyDown.bind(this),
      keyup: this._onKeyUp.bind(this),
      blur: this._onBlur.bind(this)
    };

    this.setupListeners();
  }

  // ========================================
  // SETUP
  // ========================================

  /**
   * Setup DOM event listeners
   */
  setupListeners() {
    document.addEventListener('keydown', this._boundHandlers.keydown);
    document.addEventListener('keyup', this._boundHandlers.keyup);
    window.addEventListener('blur', this._boundHandlers.blur);
  }

  /**
   * Remove DOM event listeners
   */
  removeListeners() {
    document.removeEventListener('keydown', this._boundHandlers.keydown);
    document.removeEventListener('keyup', this._boundHandlers.keyup);
    window.removeEventListener('blur', this._boundHandlers.blur);
  }

  // ========================================
  // EVENT HANDLERS
  // ========================================

  /**
   * Handle keydown event
   * @param {KeyboardEvent} event
   * @private
   */
  _onKeyDown(event) {
    if (!this.enabled) return;

    // Prevent key repeat
    if (event.repeat) return;

    const keyCode = event.code;

    // Check if this is a note key
    const direction = this.controls.getDirectionForKey(keyCode);
    if (direction !== -1 && !this.heldKeys.has(keyCode)) {
      this.heldKeys.add(keyCode);
      this.heldDirections[direction] = true;

      this.pressQueue.push({
        direction,
        timestamp: performance.now(),
        keyCode
      });
    }
  }

  /**
   * Handle keyup event
   * @param {KeyboardEvent} event
   * @private
   */
  _onKeyUp(event) {
    if (!this.enabled) return;

    const keyCode = event.code;

    // Check if this is a note key
    const direction = this.controls.getDirectionForKey(keyCode);
    if (direction !== -1) {
      this.heldKeys.delete(keyCode);

      // Only mark direction as released if no other keys for that direction are held
      const keysForDirection = this.controls.getNoteKeybinds(direction);
      const stillHeld = keysForDirection.some((k) => this.heldKeys.has(k));
      if (!stillHeld) {
        this.heldDirections[direction] = false;
      }

      this.releaseQueue.push({
        direction,
        timestamp: performance.now(),
        keyCode
      });
    }
  }

  /**
   * Handle window blur (release all keys)
   * @private
   */
  _onBlur() {
    this.releaseAllKeys();
  }

  // ========================================
  // QUEUE MANAGEMENT
  // ========================================

  /**
   * Consume all press events from the queue
   * @returns {InputEvent[]}
   */
  consumePresses() {
    const presses = [...this.pressQueue];
    this.pressQueue = [];
    return presses;
  }

  /**
   * Consume all release events from the queue
   * @returns {InputEvent[]}
   */
  consumeReleases() {
    const releases = [...this.releaseQueue];
    this.releaseQueue = [];
    return releases;
  }

  /**
   * Clear all queued events
   */
  clearQueues() {
    this.pressQueue = [];
    this.releaseQueue = [];
  }

  /**
   * Get the number of pending press events
   * @returns {number}
   */
  get pendingPresses() {
    return this.pressQueue.length;
  }

  /**
   * Get the number of pending release events
   * @returns {number}
   */
  get pendingReleases() {
    return this.releaseQueue.length;
  }

  // ========================================
  // KEY STATE
  // ========================================

  /**
   * Check if a direction is currently held
   * @param {number} direction - Direction (0-3)
   * @returns {boolean}
   */
  isHeld(direction) {
    return this.heldDirections[direction] ?? false;
  }

  /**
   * Check if any direction is held
   * @returns {boolean}
   */
  isAnyHeld() {
    return this.heldDirections.some((held) => held);
  }

  /**
   * Get all currently held directions
   * @returns {number[]}
   */
  getHeldDirections() {
    const held = [];
    for (let i = 0; i < 4; i++) {
      if (this.heldDirections[i]) {
        held.push(i);
      }
    }
    return held;
  }

  /**
   * Release all keys (e.g., on window blur)
   */
  releaseAllKeys() {
    const timestamp = performance.now();

    for (let i = 0; i < 4; i++) {
      if (this.heldDirections[i]) {
        this.releaseQueue.push({
          direction: i,
          timestamp,
          keyCode: 'blur'
        });
        this.heldDirections[i] = false;
      }
    }

    this.heldKeys.clear();
  }

  // ========================================
  // ENABLE/DISABLE
  // ========================================

  /**
   * Enable input handling
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable input handling
   */
  disable() {
    this.enabled = false;
    this.clearQueues();
  }

  /**
   * Set enabled state
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  // ========================================
  // INPUT BUFFER INTEGRATION
  // ========================================

  /**
   * Enable input buffer integration
   * @param {number} [bufferWindowMs=50] - Buffer window in ms (0-100)
   */
  enableBuffer(bufferWindowMs = 50) {
    if (!this.inputBuffer) {
      this.inputBuffer = new InputBuffer(bufferWindowMs);
    } else {
      this.inputBuffer.setBufferWindow(bufferWindowMs);
    }
    this.bufferEnabled = true;
  }

  /**
   * Disable input buffer integration
   */
  disableBuffer() {
    this.bufferEnabled = false;
    if (this.inputBuffer) {
      this.inputBuffer.clear();
    }
  }

  /**
   * Check if buffer integration is enabled
   * @returns {boolean}
   */
  isBufferEnabled() {
    return this.bufferEnabled && this.inputBuffer !== null;
  }

  /**
   * Set the buffer window size
   * @param {number} windowMs - Buffer window in ms (0-100)
   */
  setBufferWindow(windowMs) {
    if (this.inputBuffer) {
      this.inputBuffer.setBufferWindow(windowMs);
    }
  }

  /**
   * Get the current buffer window size
   * @returns {number} Buffer window in ms, or 0 if buffer not enabled
   */
  getBufferWindow() {
    return this.inputBuffer ? this.inputBuffer.bufferWindowMs : 0;
  }

  /**
   * Add an input to the buffer (called when processing inputs)
   * @param {number} direction - Direction (0-3)
   * @param {number} timestamp - Input timestamp
   * @param {string} keyCode - Key code
   * @param {number} songPosition - Current song position in ms
   */
  bufferInput(direction, timestamp, keyCode, songPosition) {
    if (this.bufferEnabled && this.inputBuffer) {
      this.inputBuffer.addInput(direction, timestamp, keyCode, songPosition);
    }
  }

  /**
   * Check for a buffered input matching a note direction
   * Returns and removes the first matching input (FIFO order)
   * @param {number} direction - Note direction to match
   * @param {number} songPosition - Current song position in ms
   * @returns {import('./InputBuffer.js').BufferedInput | null} Matching input or null
   */
  getBufferedInput(direction, songPosition) {
    if (this.bufferEnabled && this.inputBuffer) {
      return this.inputBuffer.getBufferedInput(direction, songPosition);
    }
    return null;
  }

  /**
   * Clear expired inputs from the buffer
   * @param {number} songPosition - Current song position in ms
   */
  clearExpiredBufferedInputs(songPosition) {
    if (this.inputBuffer) {
      this.inputBuffer.clearExpired(songPosition);
    }
  }

  /**
   * Clear all buffered inputs
   */
  clearBuffer() {
    if (this.inputBuffer) {
      this.inputBuffer.clear();
    }
  }

  /**
   * Get the InputBuffer instance (for advanced usage)
   * @returns {InputBuffer | null}
   */
  getInputBuffer() {
    return this.inputBuffer;
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the input handler
   */
  destroy() {
    this.removeListeners();
    this.clearQueues();
    this.heldKeys.clear();
    this.heldDirections = [false, false, false, false];
    this.scene = null;
    this.controls = null;

    // Clean up buffer
    if (this.inputBuffer) {
      this.inputBuffer.clear();
      this.inputBuffer = null;
    }
    this.bufferEnabled = false;
  }
}

export default PreciseInput;

/**
 * @fileoverview InputSystem - Unified input layer for Friday Night Funkin'
 * Combines keybind management (Controls), precise timestamped input (PreciseInput),
 * and input buffering (InputBuffer) into a single cohesive module.
 *
 * Ported from source/funkin/input/Controls.hx
 */

import SaveManager from '../data/SaveManager.js';
import { ARROW_STORED_KEYS, codeToStoredKey, storedKeyToCode } from './KeybindStorage.js';

// ========================================
// CONSTANTS
// ========================================

/** @enum {number} */
export const NoteDirection = {
  LEFT: 0,
  DOWN: 1,
  UP: 2,
  RIGHT: 3
};

const DEFAULT_NOTE_KEYBINDS = {
  left: ['KeyA', 'ArrowLeft'],
  down: ['KeyS', 'ArrowDown'],
  up: ['KeyW', 'ArrowUp'],
  right: ['KeyD', 'ArrowRight']
};

const DEFAULT_UI_KEYBINDS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  accept: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  pause: ['Enter', 'Escape']
};

const DIRECTION_NAMES = ['left', 'down', 'up', 'right'];

function uniqueKeys(keys) {
  return [...new Set(keys.filter(Boolean))];
}

function selectStoredPair(keys, primaryFallback, alternateFallback) {
  const storedKeys = uniqueKeys(keys.map((key) => codeToStoredKey(key)));
  const primary =
    storedKeys.find((key) => !ARROW_STORED_KEYS.has(key)) ?? storedKeys[0] ?? primaryFallback;
  const alternate = storedKeys.find((key) => key !== primary) ?? alternateFallback;

  return { primary, alternate };
}

// ========================================
// INPUT EVENT TYPES
// ========================================

/**
 * @typedef {Object} InputEvent
 * @property {number} direction - Note direction (0-3)
 * @property {number} timestamp - High-precision timestamp (performance.now())
 * @property {string} keyCode - The key code that triggered this event
 */

/**
 * @typedef {Object} BufferedInput
 * @property {number} direction - Direction (0-3)
 * @property {number} timestamp - Original input timestamp
 * @property {number} expiresAt - When this buffer expires (song position)
 * @property {string} keyCode - Key code
 */

// ========================================
// CONTROLS - Keybind Management
// ========================================

/**
 * Manages keybinds for gameplay and UI.
 */
export class Controls {
  /** @type {Object<string, string[]>} */
  noteKeybinds = { ...DEFAULT_NOTE_KEYBINDS };

  /** @type {Object<string, string[]>} */
  uiKeybinds = { ...DEFAULT_UI_KEYBINDS };

  constructor() {
    this.loadFromStorage();
  }

  getNoteKeybinds(direction) {
    const name = DIRECTION_NAMES[direction];
    return this.noteKeybinds[name] ?? [];
  }

  setNoteKeybinds(direction, keys) {
    const name = DIRECTION_NAMES[direction];
    if (name) {
      this.noteKeybinds[name] = [...keys];
    }
  }

  getUIKeybinds(action) {
    return this.uiKeybinds[action] ?? [];
  }

  setUIKeybinds(action, keys) {
    this.uiKeybinds[action] = [...keys];
  }

  isNoteKey(keyCode, direction) {
    return this.getNoteKeybinds(direction).includes(keyCode);
  }

  isUIKey(keyCode, action) {
    return this.getUIKeybinds(action).includes(keyCode);
  }

  getDirectionForKey(keyCode) {
    for (let i = 0; i < 4; i++) {
      if (this.isNoteKey(keyCode, i)) {
        return i;
      }
    }
    return -1;
  }

  getUIActionForKey(keyCode) {
    for (const action of Object.keys(this.uiKeybinds)) {
      if (this.isUIKey(keyCode, action)) {
        return action;
      }
    }
    return null;
  }

  saveToStorage() {
    try {
      const saveManager = SaveManager.getInstance();
      if (!saveManager.loaded) {
        saveManager.init();
      }

      const left = selectStoredPair(this.noteKeybinds.left, 'A', 'LEFT');
      const down = selectStoredPair(this.noteKeybinds.down, 'S', 'DOWN');
      const up = selectStoredPair(this.noteKeybinds.up, 'W', 'UP');
      const right = selectStoredPair(this.noteKeybinds.right, 'D', 'RIGHT');

      saveManager.setOptions({
        keyLeft: left.primary,
        keyLeftAlt: left.alternate,
        keyDown: down.primary,
        keyDownAlt: down.alternate,
        keyUp: up.primary,
        keyUpAlt: up.alternate,
        keyRight: right.primary,
        keyRightAlt: right.alternate
      });
    } catch (e) {
      console.warn('[Controls] Failed to save keybinds:', e);
    }
  }

  loadFromStorage() {
    try {
      const saveManager = SaveManager.getInstance();
      if (!saveManager.loaded) {
        saveManager.init();
      }

      this.noteKeybinds = {
        left: uniqueKeys([
          storedKeyToCode(saveManager.getOption('keyLeft')),
          storedKeyToCode(saveManager.getOption('keyLeftAlt'))
        ]),
        down: uniqueKeys([
          storedKeyToCode(saveManager.getOption('keyDown')),
          storedKeyToCode(saveManager.getOption('keyDownAlt'))
        ]),
        up: uniqueKeys([
          storedKeyToCode(saveManager.getOption('keyUp')),
          storedKeyToCode(saveManager.getOption('keyUpAlt'))
        ]),
        right: uniqueKeys([
          storedKeyToCode(saveManager.getOption('keyRight')),
          storedKeyToCode(saveManager.getOption('keyRightAlt'))
        ])
      };

      for (const direction of Object.keys(DEFAULT_NOTE_KEYBINDS)) {
        if (this.noteKeybinds[direction].length === 0) {
          this.noteKeybinds[direction] = [...DEFAULT_NOTE_KEYBINDS[direction]];
        }
      }

      this.uiKeybinds = {
        ...DEFAULT_UI_KEYBINDS,
        left: [...this.noteKeybinds.left],
        down: [...this.noteKeybinds.down],
        up: [...this.noteKeybinds.up],
        right: [...this.noteKeybinds.right]
      };
    } catch (e) {
      console.warn('[Controls] Failed to load keybinds:', e);
    }
  }

  resetToDefaults() {
    this.noteKeybinds = { ...DEFAULT_NOTE_KEYBINDS };
    this.uiKeybinds = { ...DEFAULT_UI_KEYBINDS };
    this.saveToStorage();
  }

  static getDefaultNoteKeybinds() {
    return { ...DEFAULT_NOTE_KEYBINDS };
  }
  static getDefaultUIKeybinds() {
    return { ...DEFAULT_UI_KEYBINDS };
  }
  static getDirectionName(direction) {
    return DIRECTION_NAMES[direction] ?? 'left';
  }
  static getStoredKeyForCode(code) {
    return codeToStoredKey(code);
  }
}

// ========================================
// INPUT BUFFER - Buffering for early inputs
// ========================================

/**
 * Input buffer that holds inputs for a configurable window.
 * Allows slightly early inputs to still register as hits.
 */
export class InputBuffer {
  /** @type {number} */
  bufferWindowMs = 50;

  /** @type {BufferedInput[]} */
  buffer = [];

  constructor(bufferWindowMs = 50) {
    this.bufferWindowMs = Math.max(0, Math.min(100, bufferWindowMs));
  }

  addInput(direction, timestamp, keyCode, songPosition) {
    this.buffer.push({
      direction,
      timestamp,
      keyCode,
      expiresAt: songPosition + this.bufferWindowMs
    });
  }

  getBufferedInput(direction, songPosition) {
    for (let i = 0; i < this.buffer.length; i++) {
      const input = this.buffer[i];
      if (input.expiresAt < songPosition) {
        continue;
      }
      if (input.direction === direction) {
        this.buffer.splice(i, 1);
        return input;
      }
    }
    return null;
  }

  clearExpired(songPosition) {
    this.buffer = this.buffer.filter((input) => input.expiresAt >= songPosition);
  }

  clear() {
    this.buffer = [];
  }

  get size() {
    return this.buffer.length;
  }

  setBufferWindow(windowMs) {
    this.bufferWindowMs = Math.max(0, Math.min(100, windowMs));
  }
}

// ========================================
// PRECISE INPUT - Timestamped input queue
// ========================================

/**
 * Precise input handler with timestamped event queue.
 * Uses raw DOM events for most accurate timing.
 * Supports optional InputBuffer integration for competitive play.
 */
export class PreciseInput {
  /** @type {Phaser.Scene | null} */
  scene = null;

  /** @type {Controls} */
  controls = null;

  /** @type {InputEvent[]} */
  pressQueue = [];

  /** @type {InputEvent[]} */
  releaseQueue = [];

  /** @type {Set<string>} */
  heldKeys = new Set();

  /** @type {boolean[]} */
  heldDirections = [false, false, false, false];

  /** @type {boolean} */
  enabled = true;

  /** @type {InputBuffer | null} */
  inputBuffer = null;

  /** @type {boolean} */
  bufferEnabled = false;

  /** @private */
  _boundHandlers = null;

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

  setupListeners() {
    document.addEventListener('keydown', this._boundHandlers.keydown);
    document.addEventListener('keyup', this._boundHandlers.keyup);
    window.addEventListener('blur', this._boundHandlers.blur);
  }

  removeListeners() {
    document.removeEventListener('keydown', this._boundHandlers.keydown);
    document.removeEventListener('keyup', this._boundHandlers.keyup);
    window.removeEventListener('blur', this._boundHandlers.blur);
  }

  _onKeyDown(event) {
    if (!this.enabled || event.repeat) {
      return;
    }
    const keyCode = event.code;
    const direction = this.controls.getDirectionForKey(keyCode);
    if (direction !== -1 && !this.heldKeys.has(keyCode)) {
      this.heldKeys.add(keyCode);
      this.heldDirections[direction] = true;
      this.pressQueue.push({ direction, timestamp: performance.now(), keyCode });
    }
  }

  _onKeyUp(event) {
    if (!this.enabled) {
      return;
    }
    const keyCode = event.code;
    const direction = this.controls.getDirectionForKey(keyCode);
    if (direction !== -1) {
      this.heldKeys.delete(keyCode);
      const keysForDirection = this.controls.getNoteKeybinds(direction);
      const stillHeld = keysForDirection.some((k) => this.heldKeys.has(k));
      if (!stillHeld) {
        this.heldDirections[direction] = false;
      }
      this.releaseQueue.push({ direction, timestamp: performance.now(), keyCode });
    }
  }

  _onBlur() {
    this.releaseAllKeys();
  }

  consumePresses() {
    const presses = [...this.pressQueue];
    this.pressQueue = [];
    return presses;
  }

  consumeReleases() {
    const releases = [...this.releaseQueue];
    this.releaseQueue = [];
    return releases;
  }

  clearQueues() {
    this.pressQueue = [];
    this.releaseQueue = [];
  }

  get pendingPresses() {
    return this.pressQueue.length;
  }
  get pendingReleases() {
    return this.releaseQueue.length;
  }

  isHeld(direction) {
    return this.heldDirections[direction] ?? false;
  }
  isAnyHeld() {
    return this.heldDirections.some((held) => held);
  }

  getHeldDirections() {
    const held = [];
    for (let i = 0; i < 4; i++) {
      if (this.heldDirections[i]) {
        held.push(i);
      }
    }
    return held;
  }

  releaseAllKeys() {
    const timestamp = performance.now();
    for (let i = 0; i < 4; i++) {
      if (this.heldDirections[i]) {
        this.releaseQueue.push({ direction: i, timestamp, keyCode: 'blur' });
        this.heldDirections[i] = false;
      }
    }
    this.heldKeys.clear();
  }

  enable() {
    this.enabled = true;
  }
  disable() {
    this.enabled = false;
    this.clearQueues();
  }
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

  enableBuffer(bufferWindowMs = 50) {
    if (!this.inputBuffer) {
      this.inputBuffer = new InputBuffer(bufferWindowMs);
    } else {
      this.inputBuffer.setBufferWindow(bufferWindowMs);
    }
    this.bufferEnabled = true;
  }

  disableBuffer() {
    this.bufferEnabled = false;
    if (this.inputBuffer) {
      this.inputBuffer.clear();
    }
  }

  isBufferEnabled() {
    return this.bufferEnabled && this.inputBuffer !== null;
  }

  setBufferWindow(windowMs) {
    if (this.inputBuffer) {
      this.inputBuffer.setBufferWindow(windowMs);
    }
  }

  getBufferWindow() {
    return this.inputBuffer ? this.inputBuffer.bufferWindowMs : 0;
  }

  bufferInput(direction, timestamp, keyCode, songPosition) {
    if (this.bufferEnabled && this.inputBuffer) {
      this.inputBuffer.addInput(direction, timestamp, keyCode, songPosition);
    }
  }

  getBufferedInput(direction, songPosition) {
    if (this.bufferEnabled && this.inputBuffer) {
      return this.inputBuffer.getBufferedInput(direction, songPosition);
    }
    return null;
  }

  clearExpiredBufferedInputs(songPosition) {
    if (this.inputBuffer) {
      this.inputBuffer.clearExpired(songPosition);
    }
  }

  clearBuffer() {
    if (this.inputBuffer) {
      this.inputBuffer.clear();
    }
  }

  getInputBuffer() {
    return this.inputBuffer;
  }

  destroy() {
    this.removeListeners();
    this.clearQueues();
    this.heldKeys.clear();
    this.heldDirections = [false, false, false, false];
    this.scene = null;
    this.controls = null;
    if (this.inputBuffer) {
      this.inputBuffer.clear();
      this.inputBuffer = null;
    }
    this.bufferEnabled = false;
  }
}

// Default export for convenience
export default PreciseInput;

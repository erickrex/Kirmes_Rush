/**
 * @fileoverview Controls - Keybind management for gameplay
 * Handles configurable keybinds for note input and UI navigation.
 *
 * Ported from source/funkin/input/Controls.hx
 */

/**
 * Note directions
 * @enum {number}
 */
export const NoteDirection = {
  LEFT: 0,
  DOWN: 1,
  UP: 2,
  RIGHT: 3
};

/**
 * Default keybinds for note input
 * @type {Object<string, string[]>}
 */
const DEFAULT_NOTE_KEYBINDS = {
  left: ['ArrowLeft', 'KeyA', 'KeyD'],
  down: ['ArrowDown', 'KeyS', 'KeyF'],
  up: ['ArrowUp', 'KeyW', 'KeyJ'],
  right: ['ArrowRight', 'KeyE', 'KeyK']
};

/**
 * Default keybinds for UI navigation
 * @type {Object<string, string[]>}
 */
const DEFAULT_UI_KEYBINDS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  accept: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  pause: ['Enter', 'Escape']
};

/**
 * Direction names in order
 * @type {string[]}
 */
const DIRECTION_NAMES = ['left', 'down', 'up', 'right'];

/**
 * Manages keybinds for gameplay and UI.
 */
class Controls {
  /**
   * Note keybinds (for gameplay)
   * @type {Object<string, string[]>}
   */
  noteKeybinds = { ...DEFAULT_NOTE_KEYBINDS };

  /**
   * UI keybinds (for menus)
   * @type {Object<string, string[]>}
   */
  uiKeybinds = { ...DEFAULT_UI_KEYBINDS };

  /**
   * Create a new Controls instance
   */
  constructor() {
    this.loadFromStorage();
  }

  // ========================================
  // KEYBIND MANAGEMENT
  // ========================================

  /**
   * Get the keybinds for a note direction
   * @param {number} direction - Direction (0-3)
   * @returns {string[]}
   */
  getNoteKeybinds(direction) {
    const name = DIRECTION_NAMES[direction];
    return this.noteKeybinds[name] ?? [];
  }

  /**
   * Set the keybinds for a note direction
   * @param {number} direction - Direction (0-3)
   * @param {string[]} keys - Array of key codes
   */
  setNoteKeybinds(direction, keys) {
    const name = DIRECTION_NAMES[direction];
    if (name) {
      this.noteKeybinds[name] = [...keys];
    }
  }

  /**
   * Get the keybinds for a UI action
   * @param {string} action - Action name (up, down, left, right, accept, back, pause)
   * @returns {string[]}
   */
  getUIKeybinds(action) {
    return this.uiKeybinds[action] ?? [];
  }

  /**
   * Set the keybinds for a UI action
   * @param {string} action - Action name
   * @param {string[]} keys - Array of key codes
   */
  setUIKeybinds(action, keys) {
    this.uiKeybinds[action] = [...keys];
  }

  /**
   * Check if a key code matches a note direction
   * @param {string} keyCode - The key code to check
   * @param {number} direction - Direction (0-3)
   * @returns {boolean}
   */
  isNoteKey(keyCode, direction) {
    const keys = this.getNoteKeybinds(direction);
    return keys.includes(keyCode);
  }

  /**
   * Check if a key code matches a UI action
   * @param {string} keyCode - The key code to check
   * @param {string} action - Action name
   * @returns {boolean}
   */
  isUIKey(keyCode, action) {
    const keys = this.getUIKeybinds(action);
    return keys.includes(keyCode);
  }

  /**
   * Get the direction for a key code
   * @param {string} keyCode - The key code
   * @returns {number} Direction (0-3) or -1 if not found
   */
  getDirectionForKey(keyCode) {
    for (let i = 0; i < 4; i++) {
      if (this.isNoteKey(keyCode, i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get the UI action for a key code
   * @param {string} keyCode - The key code
   * @returns {string | null} Action name or null if not found
   */
  getUIActionForKey(keyCode) {
    for (const action of Object.keys(this.uiKeybinds)) {
      if (this.isUIKey(keyCode, action)) {
        return action;
      }
    }
    return null;
  }

  // ========================================
  // PERSISTENCE
  // ========================================

  /**
   * Save keybinds to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        noteKeybinds: this.noteKeybinds,
        uiKeybinds: this.uiKeybinds
      };
      localStorage.setItem('fnf_controls', JSON.stringify(data));
    } catch (e) {
      console.warn('[Controls] Failed to save keybinds:', e);
    }
  }

  /**
   * Load keybinds from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('fnf_controls');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.noteKeybinds) {
          this.noteKeybinds = { ...DEFAULT_NOTE_KEYBINDS, ...data.noteKeybinds };
        }
        if (data.uiKeybinds) {
          this.uiKeybinds = { ...DEFAULT_UI_KEYBINDS, ...data.uiKeybinds };
        }
      }
    } catch (e) {
      console.warn('[Controls] Failed to load keybinds:', e);
    }
  }

  /**
   * Reset keybinds to defaults
   */
  resetToDefaults() {
    this.noteKeybinds = { ...DEFAULT_NOTE_KEYBINDS };
    this.uiKeybinds = { ...DEFAULT_UI_KEYBINDS };
    this.saveToStorage();
  }

  // ========================================
  // STATIC HELPERS
  // ========================================

  /**
   * Get the default note keybinds
   * @returns {Object<string, string[]>}
   */
  static getDefaultNoteKeybinds() {
    return { ...DEFAULT_NOTE_KEYBINDS };
  }

  /**
   * Get the default UI keybinds
   * @returns {Object<string, string[]>}
   */
  static getDefaultUIKeybinds() {
    return { ...DEFAULT_UI_KEYBINDS };
  }

  /**
   * Get direction name
   * @param {number} direction - Direction (0-3)
   * @returns {string}
   */
  static getDirectionName(direction) {
    return DIRECTION_NAMES[direction] ?? 'left';
  }
}

export default Controls;

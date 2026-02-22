/**
 * @fileoverview NoteSprite - Individual note rendering for gameplay
 * Handles note display, hit/miss states, and visual feedback.
 *
 * Ported from source/funkin/play/notes/NoteSprite.hx
 */

import FunkinSprite from '../graphics/FunkinSprite.js';

/**
 * Direction colors for notes (left, down, up, right)
 * @type {string[]}
 */
const DIRECTION_COLORS = ['purple', 'blue', 'green', 'red'];

/**
 * Direction names for notes
 * @type {string[]}
 */
const DIRECTION_NAMES = ['left', 'down', 'up', 'right'];

/**
 * @typedef {Object} NoteData
 * @property {number} time - The strum time in milliseconds
 * @property {number} direction - Note direction (0-3: left, down, up, right)
 * @property {number} [length=0] - Hold note length in milliseconds
 * @property {string} [kind=''] - Note kind (normal, mine, etc.)
 * @property {Array<{name: string, value: any}>} [params=[]] - Custom parameters
 */

/**
 * Individual note sprite for gameplay.
 * Extends FunkinSprite with note-specific functionality.
 */
class NoteSprite extends FunkinSprite {
  /**
   * The note data associated with this sprite
   * @type {NoteData | null}
   */
  noteData = null;

  /**
   * The direction of this note (0-3)
   * @type {number}
   */
  _direction = 0;

  /**
   * Reference to the sustain trail for hold notes
   * @type {Object | null}
   */
  sustainTrail = null;

  /**
   * Whether this note is scoreable (counts towards score/accuracy)
   * @type {boolean}
   */
  scoreable = true;

  /**
   * Y offset for positioning
   * @type {number}
   */
  yOffset = 0;

  /**
   * Whether this note has been hit
   * @type {boolean}
   */
  hasBeenHit = false;

  /**
   * Whether this note should be hit after other notes (low priority)
   * @type {boolean}
   */
  lowPriority = false;

  /**
   * Whether this note has been missed (past hit window)
   * @type {boolean}
   */
  hasMissed = false;

  /**
   * Whether this note is too early to hit
   * @type {boolean}
   */
  tooEarly = false;

  /**
   * Whether this note is within the hit window
   * @type {boolean}
   */
  mayHit = false;

  /**
   * Whether the miss logic has been handled for this note
   * @type {boolean}
   */
  handledMiss = false;

  /**
   * The strumline this note belongs to
   * @type {Object | null}
   */
  strumline = null;

  /**
   * HSV shader values for color manipulation
   * @type {{hue: number, saturation: number, value: number}}
   */
  hsvValues = { hue: 1.0, saturation: 1.0, value: 1.0 };

  /**
   * Create a new NoteSprite
   * @param {Phaser.Scene} scene - The scene this sprite belongs to
   * @param {number} [direction=0] - Initial direction (0-3)
   */
  constructor(scene, direction = 0) {
    super(scene, 0, -9999);
    this._direction = direction;
  }

  // ========================================
  // GETTERS AND SETTERS
  // ========================================

  /**
   * Get the strum time for this note
   * @returns {number}
   */
  get strumTime() {
    return this.noteData?.time ?? 0;
  }

  /**
   * Set the strum time for this note
   * @param {number} value
   */
  set strumTime(value) {
    if (this.noteData) {
      this.noteData.time = value;
    }
  }

  /**
   * Get the hold length for this note
   * @returns {number}
   */
  get length() {
    return this.noteData?.length ?? 0;
  }

  /**
   * Set the hold length for this note
   * @param {number} value
   */
  set length(value) {
    if (this.noteData) {
      this.noteData.length = value;
    }
  }

  /**
   * Get the note kind
   * @returns {string | null}
   */
  get kind() {
    return this.noteData?.kind ?? null;
  }

  /**
   * Set the note kind
   * @param {string | null} value
   */
  set kind(value) {
    if (this.noteData) {
      this.noteData.kind = value;
    }
  }

  /**
   * Get custom parameters for this note
   * @returns {Array<{name: string, value: any}>}
   */
  get params() {
    return this.noteData?.params ?? [];
  }

  /**
   * Set custom parameters for this note
   * @param {Array<{name: string, value: any}>} value
   */
  set params(value) {
    if (this.noteData) {
      this.noteData.params = value;
    }
  }

  /**
   * Get the direction of this note
   * @returns {number}
   */
  get direction() {
    return this._direction;
  }

  /**
   * Set the direction and update animation
   * @param {number} value
   */
  set direction(value) {
    this._direction = value;
    this.playNoteAnimation(value);
  }

  /**
   * Check if this is a hold note
   * @returns {boolean}
   */
  get isHoldNote() {
    return (this.noteData?.length ?? 0) > 0;
  }

  /**
   * Get the direction color name
   * @returns {string}
   */
  get colorName() {
    return DIRECTION_COLORS[this._direction] ?? 'purple';
  }

  /**
   * Get the direction name
   * @returns {string}
   */
  get directionName() {
    return DIRECTION_NAMES[this._direction] ?? 'left';
  }

  // ========================================
  // STATIC HELPERS
  // ========================================

  /**
   * Get the color name for a direction
   * @param {number} direction - Direction index (0-3)
   * @returns {string}
   */
  static getColorName(direction) {
    return DIRECTION_COLORS[direction] ?? 'purple';
  }

  /**
   * Get the direction name
   * @param {number} direction - Direction index (0-3)
   * @returns {string}
   */
  static getDirectionName(direction) {
    return DIRECTION_NAMES[direction] ?? 'left';
  }

  /**
   * Get all direction colors
   * @returns {string[]}
   */
  static get DIRECTION_COLORS() {
    return DIRECTION_COLORS;
  }

  /**
   * Get all direction names
   * @returns {string[]}
   */
  static get DIRECTION_NAMES() {
    return DIRECTION_NAMES;
  }

  // ========================================
  // SETUP AND CONFIGURATION
  // ========================================

  /**
   * Setup the note with data and style
   * @param {NoteData} noteData - The note data
   * @param {Object} [noteStyle] - The note style to use
   * @returns {this}
   */
  setup(noteData, noteStyle = null) {
    this.noteData = noteData;
    this._direction = noteData.direction;

    if (noteStyle) {
      this.setupNoteGraphic(noteStyle);
    }

    return this;
  }

  /**
   * Setup the note graphic from a note style
   * @param {Object} noteStyle - The note style configuration
   */
  setupNoteGraphic(noteStyle) {
    // This will be called by the note style to configure the sprite
    // The note style handles loading the texture and setting up animations
    if (noteStyle && typeof noteStyle.buildNoteSprite === 'function') {
      noteStyle.buildNoteSprite(this);
    }

    // Play the initial animation
    this.playNoteAnimation(this._direction);
  }

  // ========================================
  // ANIMATION
  // ========================================

  /**
   * Play the note animation for a direction
   * @param {number} direction - Direction index (0-3)
   */
  playNoteAnimation(direction) {
    const color = DIRECTION_COLORS[direction] ?? 'purple';
    const animName = `${color}Scroll`;

    if (this.hasAnimation(animName)) {
      this.playAnimation(animName);
    }
  }

  /**
   * Play the confirm/hit animation
   */
  playConfirmAnimation() {
    const color = DIRECTION_COLORS[this._direction] ?? 'purple';
    const animName = `${color}Confirm`;

    if (this.hasAnimation(animName)) {
      this.playAnimation(animName);
    }
  }

  // ========================================
  // PARAMETERS
  // ========================================

  /**
   * Get a custom parameter value by name
   * @param {string} name - Parameter name
   * @returns {any | null}
   */
  getParam(name) {
    for (const param of this.params) {
      if (param.name === name) {
        return param.value;
      }
    }
    return null;
  }

  /**
   * Set a custom parameter value
   * @param {string} name - Parameter name
   * @param {any} value - Parameter value
   * @returns {this}
   */
  setParam(name, value) {
    if (!this.noteData) return this;

    if (!this.noteData.params) {
      this.noteData.params = [];
    }

    const existing = this.noteData.params.find((p) => p.name === name);
    if (existing) {
      existing.value = value;
    } else {
      this.noteData.params.push({ name, value });
    }

    return this;
  }

  // ========================================
  // VISUAL EFFECTS
  // ========================================

  /**
   * Desaturate the note (for missed notes)
   */
  desaturate() {
    this.hsvValues.saturation = 0.2;
    this._applyHSV();
  }

  /**
   * Set the hue shift for the note
   * @param {number} hue - Hue value (1.0 = normal)
   */
  setHue(hue) {
    this.hsvValues.hue = hue;
    if (hue !== 1.0) {
      this._applyHSV();
    }
  }

  /**
   * Apply HSV values (placeholder for shader implementation)
   * @private
   */
  _applyHSV() {
    // In Phaser, this would apply a shader or tint
    // For now, we can use tint as a simple approximation
    if (this.hsvValues.saturation < 1.0) {
      // Desaturate by blending towards gray
      this.setTint(0x888888);
    }
  }

  /**
   * Clear any HSV effects
   */
  clearHSV() {
    this.hsvValues = { hue: 1.0, saturation: 1.0, value: 1.0 };
    this.clearTint();
  }

  // ========================================
  // HIT/MISS HANDLING
  // ========================================

  /**
   * Mark this note as hit
   * @returns {this}
   */
  hit() {
    this.hasBeenHit = true;
    this.visible = false;
    this.active = false;
    return this;
  }

  /**
   * Mark this note as missed
   * @returns {this}
   */
  miss() {
    this.hasMissed = true;
    this.desaturate();
    return this;
  }

  // ========================================
  // POOLING SUPPORT
  // ========================================

  /**
   * Revive this note for reuse from a pool
   * @returns {this}
   */
  revive() {
    if (super.revive) {
      super.revive();
    }

    this.visible = true;
    this.alpha = 1.0;
    this.active = false; // Will be set by note style if animated

    // Reset state
    this.tooEarly = false;
    this.hasBeenHit = false;
    this.mayHit = false;
    this.hasMissed = false;
    this.handledMiss = false;
    this.sustainTrail = null;
    this.lowPriority = false;
    this.scoreable = true;
    this.yOffset = 0;

    // Reset HSV
    this.clearHSV();

    return this;
  }

  /**
   * Kill this note (return to pool)
   * @returns {this}
   */
  kill() {
    if (super.kill) {
      super.kill();
    }

    this.visible = false;
    this.active = false;

    return this;
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy this note sprite
   * @param {boolean} [fromScene] - Whether being destroyed from scene
   */
  destroy(fromScene) {
    this.noteData = null;
    this.sustainTrail = null;
    this.strumline = null;

    super.destroy(fromScene);
  }
}

export default NoteSprite;

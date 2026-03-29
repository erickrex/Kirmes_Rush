/**
 * @fileoverview Strumline - Note lane management for gameplay
 * Handles receptor arrows, note sprite pooling, and note scrolling.
 *
 * Ported from source/funkin/play/notes/Strumline.hx
 */

import * as Constants from '../core/Constants.js';
import NoteSprite from './NoteSprite.js';
import SustainTrail from './SustainTrail.js';

/** @import { NoteData } from '../types.js' */

/**
 * Note directions in order
 * @type {number[]}
 */
const DIRECTIONS = [0, 1, 2, 3]; // LEFT, DOWN, UP, RIGHT

/**
 * Size of the strumline in pixels
 * @type {number}
 */
const STRUMLINE_SIZE = 104;

/**
 * Spacing between notes on the strumline
 * @type {number}
 */
const NOTE_SPACING = STRUMLINE_SIZE + 8;

/**
 * Initial offset for positioning
 * @type {number}
 */
const INITIAL_OFFSET = -0.275 * STRUMLINE_SIZE;

/**
 * Number of keys/directions
 * @type {number}
 */
const KEY_COUNT = 4;

/**
 * @typedef {Object} StrumlineConfig
 * @property {boolean} isPlayer - Whether this is the player's strumline
 * @property {number} [x=0] - X position
 * @property {number} [y=0] - Y position
 * @property {number} [scrollSpeed=1.0] - Scroll speed multiplier
 * @property {boolean} [downscroll=false] - Whether to use downscroll
 */

/**
 * @typedef {Object} ReceptorData
 * @property {number} direction - Direction index (0-3)
 * @property {number} x - X position offset
 * @property {number} y - Y position offset
 * @property {'static' | 'press' | 'confirm'} state - Current animation state
 * @property {string | null} animation - Current animation name
 */

/**
 * Manages the receptor arrows, notes, and hold notes for a player.
 */
class Strumline {
  /**
   * The scene this strumline belongs to
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * Whether this is the player's strumline
   * @type {boolean}
   */
  isPlayer = false;

  /**
   * X position of the strumline
   * @type {number}
   */
  x = 0;

  /**
   * Y position of the strumline
   * @type {number}
   */
  y = 0;

  /**
   * Current scroll speed
   * @type {number}
   */
  scrollSpeed = 1.0;

  /**
   * Whether downscroll is enabled
   * @type {boolean}
   */
  isDownscroll = false;

  /**
   * The note style being used
   * @type {Record<string, any> | null}
   */
  noteStyle = null;

  /**
   * Active note sprites
   * @type {NoteSprite[]}
   */
  notes = [];

  /**
   * Active hold note trails
   * @type {SustainTrail[]}
   */
  holdNotes = [];

  /**
   * Receptor/strumline note sprites
   * @type {ReceptorData[]}
   */
  receptors = [];

  /**
   * Note data from the chart
   * @type {NoteData[]}
   */
  noteData = [];

  /**
   * Index of the next note to spawn
   * @type {number}
   */
  nextNoteIndex = 0;

  /**
   * Keys currently held down
   * @type {boolean[]}
   */
  heldKeys = [false, false, false, false];

  /**
   * Whether to show note splashes
   * @type {boolean}
   */
  showNoteSplash = true;

  /**
   * Conductor reference for timing
   * @type {Record<string, any> | null}
   */
  conductor = null;

  /**
   * Callback when a note is spawned
   * @type {Function | null}
   */
  onNoteSpawn = null;

  /**
   * Whether to render note sprites visually. When false, notes are still
   * tracked for timing/scoring but their sprites are hidden.
   * @type {boolean}
   */
  renderNotes = true;

  /**
   * Create a new Strumline
   * @param {Phaser.Scene} scene - The scene this strumline belongs to
   * @param {boolean} isPlayer - Whether this is the player's strumline
   * @param {Record<string, any> | null} [noteStyle=null] - The note style to use
   * @param {number} [scrollSpeed=1.0] - Initial scroll speed
   */
  constructor(scene, isPlayer, noteStyle = null, scrollSpeed = 1.0) {
    this.scene = scene;
    this.isPlayer = isPlayer;
    this.noteStyle = noteStyle;
    this.scrollSpeed = scrollSpeed;

    // Initialize receptors
    this.createReceptors();
  }

  // ========================================
  // STATIC CONSTANTS
  // ========================================

  /**
   * Get the directions array
   * @returns {number[]}
   */
  static get DIRECTIONS() {
    return DIRECTIONS;
  }

  /**
   * Get the strumline size
   * @returns {number}
   */
  static get STRUMLINE_SIZE() {
    return STRUMLINE_SIZE;
  }

  /**
   * Get the note spacing
   * @returns {number}
   */
  static get NOTE_SPACING() {
    return NOTE_SPACING;
  }

  /**
   * Get the key count
   * @returns {number}
   */
  static get KEY_COUNT() {
    return KEY_COUNT;
  }

  // ========================================
  // SETUP
  // ========================================

  /**
   * Create the receptor sprites
   */
  createReceptors() {
    this.receptors = [];

    for (let i = 0; i < KEY_COUNT; i++) {
      /** @type {ReceptorData} */
      const receptor = {
        direction: i,
        x: this.getXPos(i),
        y: 0,
        state: 'static', // static, press, confirm
        animation: null
      };
      this.receptors.push(receptor);
    }
  }

  /**
   * Set the position of the strumline
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {this}
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Set the scroll speed
   * @param {number} speed - Scroll speed multiplier
   * @returns {this}
   */
  setScrollSpeed(speed) {
    this.scrollSpeed = speed;
    return this;
  }

  /**
   * Reset scroll speed to default
   * @param {number} [defaultSpeed=1.0] - Default speed
   */
  resetScrollSpeed(defaultSpeed = 1.0) {
    this.scrollSpeed = defaultSpeed;
  }

  // ========================================
  // NOTE DATA
  // ========================================

  /**
   * Apply note data from a chart
   * @param {NoteData[]} data - Array of note data objects
   */
  applyNoteData(data) {
    this.notes = [];
    this.holdNotes = [];
    this.noteData = [...data];
    this.nextNoteIndex = 0;

    // Sort by time
    this.noteData.sort((a, b) => a.time - b.time);
  }

  /**
   * Add a single note to the data
   * @param {NoteData} note - Note data object
   * @param {boolean} [sort=true] - Whether to re-sort after adding
   */
  addNoteData(note, sort = true) {
    if (!note) {
      return;
    }

    this.noteData.push(note);
    if (sort) {
      this.noteData.sort((a, b) => a.time - b.time);
    }
  }

  // ========================================
  // UPDATE
  // ========================================

  /**
   * Update the strumline
   * @param {number} songPosition - Current song position in milliseconds
   */
  update(songPosition) {
    this.updateNoteSpawning(songPosition);
    this.updateNotes(songPosition);
    this.updateHoldNotes(songPosition);
    this.updateReceptors();
  }

  /**
   * Spawn notes that are within render distance
   * @param {number} songPosition - Current song position
   */
  updateNoteSpawning(songPosition) {
    if (this.noteData.length === 0) {
      return;
    }

    const renderDistance = this.getRenderDistanceMs();
    const hitWindowStart = songPosition - Constants.HIT_WINDOW_MS;
    const renderWindowEnd = songPosition + renderDistance;

    for (let i = this.nextNoteIndex; i < this.noteData.length; i++) {
      const noteData = this.noteData[i];
      if (!noteData) {
        continue;
      }

      // Skip notes in the past
      if (noteData.time < hitWindowStart) {
        this.nextNoteIndex = i + 1;
        continue;
      }

      // Stop if note is too far ahead
      if (noteData.time > renderWindowEnd) {
        break;
      }

      // Spawn the note
      const noteSprite = this.buildNoteSprite(noteData);

      // Spawn hold note if needed
      if (noteData.length > 0) {
        const holdNote = this.buildHoldNoteSprite(noteData);
        noteSprite.sustainTrail = holdNote;
      }

      this.nextNoteIndex = i + 1;

      // Callback
      if (this.onNoteSpawn) {
        this.onNoteSpawn(noteSprite);
      }
    }
  }

  /**
   * Update note positions
   * @param {number} songPosition - Current song position
   */
  updateNotes(songPosition) {
    for (const note of this.notes) {
      if (!note || !note.alive) {
        continue;
      }

      // Calculate Y position
      note.y = this.y - INITIAL_OFFSET + this.getNoteY(note.strumTime, songPosition) + note.yOffset;

      // Check if offscreen after miss
      const isOffscreen = this.isDownscroll
        ? note.y > this.getScreenHeight()
        : note.y < -note.height;

      if (note.handledMiss && isOffscreen) {
        this.killNote(note);
      }
    }
  }

  /**
   * Update hold note positions and states
   * @param {number} songPosition - Current song position
   */
  updateHoldNotes(songPosition) {
    for (const holdNote of this.holdNotes) {
      if (!holdNote || !holdNote.alive) {
        continue;
      }

      // Check if player released while holding
      if (songPosition > holdNote.strumTime && holdNote.hitNote && !holdNote.missedNote) {
        if (this.isPlayer && !this.isKeyHeld(holdNote.noteDirection)) {
          this.playStatic(holdNote.noteDirection);
          holdNote.missedNote = true;
          holdNote.alpha = 0.3;
        }
      }

      // Check if hold note should be killed
      const renderWindowEnd =
        holdNote.strumTime +
        holdNote.fullSustainLength +
        Constants.HIT_WINDOW_MS +
        this.getRenderDistanceMs() / 8;

      if (holdNote.missedNote && songPosition >= renderWindowEnd) {
        holdNote.visible = false;
        holdNote.kill();
      } else if (holdNote.hitNote && holdNote.sustainLength <= 0) {
        // Hold completed
        if (this.isKeyHeld(holdNote.noteDirection)) {
          this.playPress(holdNote.noteDirection);
        } else {
          this.playStatic(holdNote.noteDirection);
        }
        holdNote.visible = false;
        holdNote.kill();
      } else if (holdNote.hitNote && !holdNote.missedNote) {
        // Currently being held - clip it
        this.holdConfirm(holdNote.noteDirection);
        holdNote.sustainLength = holdNote.strumTime + holdNote.fullSustainLength - songPosition;

        if (holdNote.sustainLength <= 10) {
          holdNote.visible = false;
        }

        // Position at strumline
        holdNote.y = this.isDownscroll
          ? this.y - INITIAL_OFFSET - holdNote.height + STRUMLINE_SIZE / 2
          : this.y - INITIAL_OFFSET + STRUMLINE_SIZE / 2;
      } else {
        // Not yet hit - render normally
        holdNote.visible = this.renderNotes;
        const yPos = this.getNoteY(holdNote.strumTime, songPosition);

        holdNote.y = this.isDownscroll
          ? this.y - INITIAL_OFFSET + yPos - holdNote.height + STRUMLINE_SIZE / 2 + holdNote.yOffset
          : this.y - INITIAL_OFFSET + yPos + STRUMLINE_SIZE / 2 + holdNote.yOffset;
      }

      // Update the hold note
      holdNote.update(songPosition);
    }
  }

  /**
   * Update receptor states
   */
  updateReceptors() {
    for (const dir of DIRECTIONS) {
      if (this.isKeyHeld(dir) && this.getReceptorState(dir) === 'static') {
        this.playPress(dir);
      }
    }
  }

  // ========================================
  // NOTE BUILDING
  // ========================================

  /**
   * Build a note sprite from note data
   * @param {NoteData} noteData - The note data
   * @returns {NoteSprite}
   */
  buildNoteSprite(noteData) {
    // Try to recycle an existing note
    let noteSprite = this.notes.find((n) => n && !n.alive);

    if (noteSprite) {
      noteSprite.revive();
    } else {
      noteSprite = new NoteSprite(/** @type {Phaser.Scene} */ (this.scene), noteData.direction);
      if (this.scene?.add?.existing) {
        this.scene.add.existing(noteSprite);
      }
      this.notes.push(noteSprite);
    }

    // Configure the note
    noteSprite.setup(noteData, this.noteStyle ?? undefined);
    noteSprite.strumline = this;
    noteSprite.setDepth?.(30);

    // Hide sprite when this strumline doesn't render notes (e.g. opponent)
    if (!this.renderNotes && noteSprite.setVisible) {
      noteSprite.setVisible(false);
    }

    // Position
    noteSprite.x = this.x + this.getXPos(noteData.direction);
    noteSprite.y = -9999;

    return noteSprite;
  }

  /**
   * Build a hold note sprite from note data
   * @param {NoteData} noteData - The note data
   * @returns {SustainTrail}
   */
  buildHoldNoteSprite(noteData) {
    // Try to recycle an existing hold note
    let holdNote = this.holdNotes.find((h) => h && !h.alive);

    if (holdNote) {
      holdNote.revive();
    } else {
      holdNote = new SustainTrail(
        /** @type {Phaser.Scene} */ (this.scene),
        noteData.direction,
        noteData.length,
        this.noteStyle ?? undefined
      );
      this.holdNotes.push(holdNote);
    }

    // Configure
    holdNote.setup(noteData, this.noteStyle ?? undefined);
    holdNote.parentStrumline = this;
    holdNote.flipY = this.isDownscroll;

    // Hide sprite when this strumline doesn't render notes (e.g. opponent)
    if (!this.renderNotes) {
      holdNote.visible = false;
    }

    // Position
    holdNote.x =
      this.x + this.getXPos(noteData.direction) + STRUMLINE_SIZE / 2 - holdNote.width / 2;
    holdNote.y = -9999;

    return holdNote;
  }

  // ========================================
  // NOTE QUERIES
  // ========================================

  /**
   * Get notes that may be hit (within hit window)
   * @returns {NoteSprite[]}
   */
  getNotesMayHit() {
    return this.notes.filter((note) => note && note.alive && !note.hasBeenHit && note.mayHit);
  }

  /**
   * Get hold notes that are being held or were missed
   * @returns {SustainTrail[]}
   */
  getHoldNotesHitOrMissed() {
    return this.holdNotes.filter((hold) => hold && hold.alive && (hold.hitNote || hold.missedNote));
  }

  /**
   * Get all notes currently on screen
   * @returns {NoteSprite[]}
   */
  getNotesOnScreen() {
    return this.notes.filter((note) => note && note.alive && !note.hasBeenHit);
  }

  /**
   * Get the closest note in a direction
   * @param {number} direction - Direction to check (0-3)
   * @param {number} songPosition - Current song position
   * @returns {NoteSprite | null}
   */
  getClosestNote(direction, songPosition) {
    let closest = null;
    let closestDist = Infinity;

    for (const note of this.notes) {
      if (!note || !note.alive) {
        continue;
      }
      if (note.direction !== direction) {
        continue;
      }
      if (note.hasBeenHit || note.hasMissed) {
        continue;
      }

      const dist = Math.abs(note.strumTime - songPosition);
      if (dist < closestDist) {
        closest = note;
        closestDist = dist;
      }
    }

    return closest;
  }

  /**
   * Get a note sprite by its note data
   * @param {NoteData | null} target - The note data to find
   * @returns {NoteSprite | null}
   */
  getNoteSprite(target) {
    if (!target) {
      return null;
    }

    for (const note of this.notes) {
      if (!note) {
        continue;
      }
      if (note.noteData === target) {
        return note;
      }
    }

    return null;
  }

  /**
   * Get a hold note sprite by its note data
   * @param {NoteData | null} target - The note data to find
   * @returns {SustainTrail | null}
   */
  getHoldNoteSprite(target) {
    if (!target || (target.length ?? 0) <= 0) {
      return null;
    }

    for (const holdNote of this.holdNotes) {
      if (!holdNote) {
        continue;
      }
      if (holdNote.noteData === target) {
        return holdNote;
      }
    }

    return null;
  }

  // ========================================
  // NOTE ACTIONS
  // ========================================

  /**
   * Hit a note
   * @param {NoteSprite} note - The note to hit
   * @param {boolean} [removeNote=true] - Whether to remove the note immediately
   */
  hitNote(note, removeNote = true) {
    this.playConfirm(note.direction);
    note.hasBeenHit = true;

    if (removeNote) {
      this.killNote(note);
    } else {
      note.alpha = 0.5;
      note.desaturate();
    }

    // Handle hold note
    if (note.sustainTrail) {
      note.sustainTrail.hitNote = true;
      note.sustainTrail.missedNote = false;
    }
  }

  /**
   * Kill a note (return to pool)
   * @param {NoteSprite} note - The note to kill
   */
  killNote(note) {
    if (!note) {
      return;
    }

    note.visible = false;
    note.kill();

    // Also kill the hold note
    if (note.sustainTrail) {
      note.sustainTrail.missedNote = true;
      note.sustainTrail.visible = false;
    }
  }

  // ========================================
  // RECEPTOR CONTROLS
  // ========================================

  /**
   * Get a receptor by direction
   * @param {number} direction - Direction (0-3)
   * @returns {ReceptorData}
   */
  getByDirection(direction) {
    return this.receptors[direction];
  }

  /**
   * Get receptor state
   * @param {number} direction - Direction (0-3)
   * @returns {string}
   */
  getReceptorState(direction) {
    return this.receptors[direction]?.state ?? 'static';
  }

  /**
   * Play static animation for a receptor
   * @param {number} direction - Direction (0-3)
   */
  playStatic(direction) {
    if (this.receptors[direction]) {
      this.receptors[direction].state = 'static';
    }
  }

  /**
   * Play press animation for a receptor
   * @param {number} direction - Direction (0-3)
   */
  playPress(direction) {
    if (this.receptors[direction]) {
      this.receptors[direction].state = 'press';
    }
  }

  /**
   * Play confirm animation for a receptor
   * @param {number} direction - Direction (0-3)
   */
  playConfirm(direction) {
    if (this.receptors[direction]) {
      this.receptors[direction].state = 'confirm';
    }
  }

  /**
   * Play hold confirm animation for a receptor
   * @param {number} direction - Direction (0-3)
   */
  holdConfirm(direction) {
    if (this.receptors[direction]) {
      this.receptors[direction].state = 'confirm';
    }
  }

  /**
   * Check if a receptor is in confirm state
   * @param {number} direction - Direction (0-3)
   * @returns {boolean}
   */
  isConfirm(direction) {
    return this.receptors[direction]?.state === 'confirm';
  }

  // ========================================
  // KEY INPUT
  // ========================================

  /**
   * Press a key
   * @param {number} direction - Direction (0-3)
   */
  pressKey(direction) {
    this.heldKeys[direction] = true;
  }

  /**
   * Release a key
   * @param {number} direction - Direction (0-3)
   */
  releaseKey(direction) {
    this.heldKeys[direction] = false;
  }

  /**
   * Check if a key is held
   * @param {number} direction - Direction (0-3)
   * @returns {boolean}
   */
  isKeyHeld(direction) {
    return this.heldKeys[direction] ?? false;
  }

  // ========================================
  // POSITION HELPERS
  // ========================================

  /**
   * Get the X position for a direction
   * @param {number} direction - Direction (0-3)
   * @returns {number}
   */
  getXPos(direction) {
    return direction * NOTE_SPACING;
  }

  /**
   * Get the Y position for a note at a given time
   * @param {number} strumTime - Note strum time
   * @param {number} songPosition - Current song position
   * @returns {number}
   */
  getNoteY(strumTime, songPosition) {
    const offset = (strumTime - songPosition) * Constants.PIXELS_PER_MS * this.scrollSpeed;
    return this.isDownscroll ? -offset : offset;
  }

  /**
   * Get the render distance in milliseconds
   * @returns {number}
   */
  getRenderDistanceMs() {
    const screenHeight = this.getScreenHeight();
    const effectiveScrollSpeed = this.scrollSpeed < 1 ? this.scrollSpeed : 1;
    return screenHeight / Constants.PIXELS_PER_MS / effectiveScrollSpeed;
  }

  /**
   * Get the screen height (for render distance calculation)
   * @returns {number}
   */
  getScreenHeight() {
    return this.scene?.scale?.height ?? 720;
  }

  /**
   * Get the width of the strumline
   * @returns {number}
   */
  get width() {
    return KEY_COUNT * NOTE_SPACING;
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Clean up all notes and reset state
   */
  clean() {
    for (const note of this.notes) {
      if (note) {
        this.killNote(note);
      }
    }

    for (const holdNote of this.holdNotes) {
      if (holdNote) {
        holdNote.kill();
      }
    }

    this.heldKeys = [false, false, false, false];

    for (const dir of DIRECTIONS) {
      this.playStatic(dir);
    }
  }

  /**
   * Handle skipped notes (when seeking)
   */
  handleSkippedNotes() {
    this.clean();
    this.nextNoteIndex = 0;
  }

  /**
   * Called on beat hit
   * @param {number} _beat - Current beat number
   */
  onBeatHit(_beat) {
    // Sort notes by time for efficiency
    if (this.notes.length > 1) {
      this.notes.sort((a, b) => (a?.strumTime ?? 0) - (b?.strumTime ?? 0));
    }

    if (this.holdNotes.length > 1) {
      this.holdNotes.sort((a, b) => (a?.strumTime ?? 0) - (b?.strumTime ?? 0));
    }
  }

  /**
   * Destroy the strumline
   */
  destroy() {
    for (const note of this.notes) {
      if (note) {
        note.destroy();
      }
    }

    for (const holdNote of this.holdNotes) {
      if (holdNote) {
        holdNote.destroy();
      }
    }

    this.notes = [];
    this.holdNotes = [];
    this.receptors = [];
    this.noteData = [];
    this.scene = null;
    this.noteStyle = null;
    this.conductor = null;
  }
}

export default Strumline;

/**
 * @fileoverview SustainTrail - Hold note trail rendering
 * Renders the body and tail of hold notes using triangle-based clipping.
 *
 * Ported from source/rythm/play/notes/SustainTrail.hx
 */

import * as Constants from '../core/Constants.js';

/**
 * Direction names for hold notes
 * @type {string[]}
 */
const DIRECTION_NAMES = ['left', 'down', 'up', 'right'];

/**
 * Triangle vertex indices for hold note rendering
 * Top left, top right, bottom left; top left, bottom left, bottom right
 * Then the same for the end cap
 * @type {number[]}
 */
const TRIANGLE_VERTEX_INDICES = [0, 1, 2, 1, 2, 3, 4, 5, 6, 5, 6, 7];

/**
 * @typedef {Object} SustainTrailConfig
 * @property {number} direction - Note direction (0-3)
 * @property {number} sustainLength - Length in milliseconds
 * @property {Object} [noteStyle] - Note style configuration
 */

/**
 * Hold note trail sprite.
 * Uses triangle-based rendering to clip the trail at the current song position.
 */
class SustainTrail {
  /**
   * The scene this trail belongs to
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * The strum time at which the hold note starts
   * @type {number}
   */
  strumTime = 0;

  /**
   * The direction of this hold note (0-3)
   * @type {number}
   */
  noteDirection = 0;

  /**
   * Current remaining sustain length in milliseconds
   * @type {number}
   */
  sustainLength = 0;

  /**
   * Original full sustain length in milliseconds
   * @type {number}
   */
  fullSustainLength = 0;

  /**
   * The note data associated with this hold note
   * @type {Record<string, any> | null}
   */
  noteData = null;

  /**
   * Reference to the parent strumline
   * @type {Record<string, any> | null}
   */
  parentStrumline = null;

  /**
   * Reference to the hold note cover effect
   * @type {Record<string, any> | null}
   */
  cover = null;

  /**
   * Y offset for positioning
   * @type {number}
   */
  yOffset = 0;

  /**
   * Whether the user hit the note and is holding
   * @type {boolean}
   */
  hitNote = false;

  /**
   * Whether the user missed or released early
   * @type {boolean}
   */
  missedNote = false;

  /**
   * Whether miss logic has been handled
   * @type {boolean}
   */
  handledMiss = false;

  /**
   * X position
   * @type {number}
   */
  x = 0;

  /**
   * Y position
   * @type {number}
   */
  y = 0;

  /**
   * Width of the trail
   * @type {number}
   */
  width = 0;

  /**
   * Height of the trail
   * @type {number}
   */
  height = 0;

  /**
   * Whether the trail is visible
   * @type {boolean}
   */
  visible = true;

  /**
   * Whether the trail is active
   * @type {boolean}
   */
  active = true;

  /**
   * Whether the trail is alive (for pooling)
   * @type {boolean}
   */
  alive = true;

  /**
   * Alpha/opacity of the trail
   * @type {number}
   */
  alpha = 1.0;

  /**
   * Whether to flip Y (for downscroll)
   * @type {boolean}
   */
  flipY = false;

  /**
   * Whether this is a pixel art style
   * @type {boolean}
   */
  isPixel = false;

  /**
   * Zoom/scale factor
   * @type {number}
   */
  zoom = 1.0;

  /**
   * End offset for the trail graphic
   * @type {number}
   */
  endOffset = 0.5;

  /**
   * Bottom clip point for the trail
   * @type {number}
   */
  bottomClip = 0.9;

  /**
   * Graphic width after scaling
   * @type {number}
   */
  graphicWidth = 0;

  /**
   * Graphic height after scaling
   * @type {number}
   */
  graphicHeight = 0;

  /**
   * Texture key for the hold note graphic
   * @type {string}
   */
  textureKey = '';

  /**
   * Note style offsets
   * @type {number[]}
   */
  noteStyleOffsets = [0, 0];

  /**
   * Vertex data for triangle rendering
   * @type {number[]}
   */
  vertices = [];

  /**
   * Index data for triangle rendering
   * @type {number[]}
   */
  indices = [...TRIANGLE_VERTEX_INDICES];

  /**
   * UV texture coordinate data
   * @type {number[]}
   */
  uvtData = [];

  /**
   * Whether custom vertex data is being used
   * @type {boolean}
   */
  customVertexData = false;

  /**
   * The Phaser graphics object for rendering
   * @type {Phaser.GameObjects.Graphics | null}
   */
  graphics = null;

  /**
   * The Phaser image for the hold note texture
   * @type {Phaser.GameObjects.Image | null}
   */
  image = null;

  /**
   * Create a new SustainTrail
   * @param {Phaser.Scene} scene - The scene this trail belongs to
   * @param {number} [direction=0] - Note direction (0-3)
   * @param {number} [sustainLength=0] - Length in milliseconds
   * @param {Record<string, any> | null} [noteStyle=null] - Note style configuration
   */
  constructor(scene, direction = 0, sustainLength = 0, noteStyle = null) {
    this.scene = scene;
    this.noteDirection = direction;
    this.sustainLength = sustainLength;
    this.fullSustainLength = sustainLength;

    // Initialize vertex arrays (8 vertices * 2 coordinates each)
    this.vertices = new Array(16).fill(0);
    this.uvtData = new Array(16).fill(0);

    if (noteStyle) {
      this.setupHoldNoteGraphic(noteStyle);
    }

    this.active = true;
  }

  // ========================================
  // STATIC HELPERS
  // ========================================

  /**
   * Calculate the height of a sustain note for a given length and scroll speed
   * @param {number} sustainLength - Length in milliseconds
   * @param {number} scrollSpeed - Current scroll speed
   * @returns {number} Height in pixels
   */
  static sustainHeight(sustainLength, scrollSpeed) {
    return sustainLength * Constants.PIXELS_PER_MS * scrollSpeed;
  }

  /**
   * Get the direction name
   * @param {number} direction - Direction index (0-3)
   * @returns {string}
   */
  static getDirectionName(direction) {
    return DIRECTION_NAMES[direction] ?? 'left';
  }

  // ========================================
  // SETUP
  // ========================================

  /**
   * Setup the hold note graphic from a note style
   * @param {Record<string, any>} noteStyle - The note style configuration
   */
  setupHoldNoteGraphic(noteStyle) {
    if (!noteStyle) {
      return;
    }

    // Get the hold note asset path
    if (typeof noteStyle.getHoldNoteAssetPath === 'function') {
      this.textureKey = noteStyle.getHoldNoteAssetPath();
    }

    // Check if pixel style
    if (typeof noteStyle.isHoldNotePixel === 'function') {
      this.isPixel = noteStyle.isHoldNotePixel();
    }

    if (this.isPixel) {
      this.endOffset = 1;
      this.bottomClip = 1;
    } else {
      this.endOffset = 0.5;
      this.bottomClip = 0.9;
    }

    // Get scale
    if (typeof noteStyle.fetchHoldNoteScale === 'function') {
      this.zoom = noteStyle.fetchHoldNoteScale();
    }

    // Get offsets
    if (typeof noteStyle.getHoldNoteOffsets === 'function') {
      this.noteStyleOffsets = noteStyle.getHoldNoteOffsets();
    }

    this.updateDimensions();
  }

  /**
   * Setup with note data
   * @param {Record<string, any>} noteData - The note data
   * @param {Record<string, any> | null} [noteStyle] - The note style
   * @returns {this}
   */
  setup(noteData, noteStyle = null) {
    this.noteData = noteData;
    this.strumTime = noteData.time;
    this.noteDirection = noteData.direction;
    this.sustainLength = noteData.length;
    this.fullSustainLength = noteData.length;

    if (noteStyle) {
      this.setupHoldNoteGraphic(noteStyle);
    }

    this.updateDimensions();
    return this;
  }

  // ========================================
  // DIMENSIONS AND CLIPPING
  // ========================================

  /**
   * Update dimensions based on current sustain length
   */
  updateDimensions() {
    const scrollSpeed = this.parentStrumline?.scrollSpeed ?? 1.0;

    // Calculate graphic dimensions
    // Assuming texture is 8 segments wide (4 directions * 2 for body + cap)
    this.graphicWidth = 52 * this.zoom; // Approximate width per note
    this.graphicHeight = SustainTrail.sustainHeight(this.sustainLength, scrollSpeed);

    this.width = this.graphicWidth;
    this.height = this.graphicHeight;
  }

  /**
   * Set the sustain length and trigger redraw
   * @param {number} length - New length in milliseconds
   */
  setSustainLength(length) {
    if (length < 0) {
      length = 0;
    }
    if (this.sustainLength === length) {
      return;
    }

    this.sustainLength = length;
    this.updateDimensions();
    this.updateClipping();
  }

  /**
   * Update clipping based on current song position
   * @param {number} [songTime=0] - Current song time in milliseconds
   */
  updateClipping(songTime = 0) {
    if (this.customVertexData) {
      return;
    }

    const scrollSpeed = this.parentStrumline?.scrollSpeed ?? 1.0;
    let clipHeight = SustainTrail.sustainHeight(
      this.sustainLength - (songTime - this.strumTime),
      scrollSpeed
    );
    clipHeight = Math.max(0, Math.min(clipHeight, this.graphicHeight));

    if (clipHeight <= 0.1) {
      this.visible = false;
      return;
    }

    // Respect the parent strumline's renderNotes flag — keep hidden if rendering is suppressed
    if (this.parentStrumline && !this.parentStrumline.renderNotes) {
      this.visible = false;
    } else {
      this.visible = true;
    }

    // Calculate vertex positions for the hold body and end cap
    const bottomHeight = this.graphicHeight * this.zoom * this.endOffset;
    const partHeight = clipHeight - bottomHeight;

    // === HOLD VERTICES ===
    // Top left
    this.vertices[0] = 0;
    this.vertices[1] = this.flipY ? clipHeight : this.graphicHeight - clipHeight;

    // Top right
    this.vertices[2] = this.graphicWidth;
    this.vertices[3] = this.vertices[1];

    // Bottom left
    this.vertices[4] = 0;
    this.vertices[5] =
      partHeight > 0
        ? this.flipY
          ? bottomHeight
          : this.vertices[1] + partHeight
        : this.vertices[1];

    // Bottom right
    this.vertices[6] = this.graphicWidth;
    this.vertices[7] = this.vertices[5];

    // === HOLD UVs ===
    const uvLeft = (1 / 4) * (this.noteDirection % 4);
    const uvRight = uvLeft + 1 / 8;

    this.uvtData[0] = uvLeft;
    this.uvtData[1] = -partHeight / this.graphicHeight / this.zoom;
    this.uvtData[2] = uvRight;
    this.uvtData[3] = this.uvtData[1];
    this.uvtData[4] = uvLeft;
    this.uvtData[5] = 0;
    this.uvtData[6] = uvRight;
    this.uvtData[7] = 0;

    // === END CAP VERTICES ===
    this.vertices[8] = this.vertices[4];
    this.vertices[9] = this.vertices[5];
    this.vertices[10] = this.vertices[6];
    this.vertices[11] = this.vertices[7];
    this.vertices[12] = this.vertices[4];
    this.vertices[13] = this.flipY
      ? this.graphicHeight * (-this.bottomClip + this.endOffset) * this.zoom
      : this.graphicHeight + this.graphicHeight * (this.bottomClip - this.endOffset) * this.zoom;
    this.vertices[14] = this.vertices[6];
    this.vertices[15] = this.vertices[13];

    // === END CAP UVs ===
    const capUvLeft = uvLeft + 1 / 8;
    const capUvRight = capUvLeft + 1 / 8;

    this.uvtData[8] = capUvLeft;
    this.uvtData[9] =
      partHeight > 0 ? 0 : (bottomHeight - clipHeight) / this.zoom / this.graphicHeight;
    this.uvtData[10] = capUvRight;
    this.uvtData[11] = this.uvtData[9];
    this.uvtData[12] = capUvLeft;
    this.uvtData[13] = this.bottomClip;
    this.uvtData[14] = capUvRight;
    this.uvtData[15] = this.bottomClip;
  }

  // ========================================
  // UPDATE
  // ========================================

  /**
   * Update the sustain trail
   * @param {number} songPosition - Current song position in milliseconds
   */
  update(songPosition) {
    if (!this.alive || !this.active) {
      return;
    }

    // Update clipping if being held
    if (this.hitNote && !this.missedNote) {
      const remaining = this.strumTime + this.fullSustainLength - songPosition;
      this.sustainLength = Math.max(0, remaining);
      this.updateDimensions();
    }

    this.updateClipping(songPosition);
  }

  // ========================================
  // STATE MANAGEMENT
  // ========================================

  /**
   * Mark this hold note as hit
   * @returns {this}
   */
  hit() {
    this.hitNote = true;
    this.missedNote = false;
    return this;
  }

  /**
   * Mark this hold note as missed/dropped
   * @returns {this}
   */
  miss() {
    this.missedNote = true;
    this.alpha = 0.3; // Make it transparent
    return this;
  }

  // ========================================
  // POOLING SUPPORT
  // ========================================

  /**
   * Revive this trail for reuse from a pool
   * @returns {this}
   */
  revive() {
    this.alive = true;
    this.active = true;
    this.visible = true;
    this.alpha = 1.0;

    // Reset state
    this.strumTime = 0;
    this.noteDirection = 0;
    this.sustainLength = 0;
    this.fullSustainLength = 0;
    this.noteData = null;
    this.hitNote = false;
    this.missedNote = false;
    this.handledMiss = false;
    this.yOffset = 0;
    this.cover = null;

    return this;
  }

  /**
   * Kill this trail (return to pool)
   * @returns {this}
   */
  kill() {
    this.alive = false;
    this.active = false;
    this.visible = false;

    // Reset state
    this.strumTime = 0;
    this.noteDirection = 0;
    this.sustainLength = 0;
    this.fullSustainLength = 0;
    this.noteData = null;
    this.hitNote = false;
    this.missedNote = false;

    return this;
  }

  // ========================================
  // RENDERING
  // ========================================

  /**
   * Get the calculated Y position for rendering
   * @param {number} songPosition - Current song position
   * @param {number} scrollSpeed - Current scroll speed
   * @param {boolean} isDownscroll - Whether downscroll is enabled
   * @returns {number}
   */
  getYPosition(songPosition, scrollSpeed, isDownscroll) {
    const offset = (this.strumTime - songPosition) * Constants.PIXELS_PER_MS * scrollSpeed;
    return isDownscroll ? -offset - this.height : offset;
  }

  /**
   * Draw the sustain trail (called by renderer)
   * In Phaser, this would use Graphics.fillTriangle or similar
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object to draw to
   * @param {number} offsetX - X offset for drawing
   * @param {number} offsetY - Y offset for drawing
   */
  draw(graphics, offsetX = 0, offsetY = 0) {
    if (!this.visible || this.alpha <= 0) {
      return;
    }

    // In a full implementation, this would draw triangles using the vertex data
    // For now, we'll draw a simple rectangle as a placeholder
    const x = this.x + offsetX;
    const y = this.y + offsetY;

    graphics.fillStyle(this.getDirectionColor(), this.alpha);
    graphics.fillRect(x, y, this.width, this.height);
  }

  /**
   * Get the color for this direction
   * @returns {number}
   */
  getDirectionColor() {
    const colors = [0xc24b99, 0x00ffff, 0x12fa05, 0xf9393f]; // purple, cyan, green, red
    return colors[this.noteDirection] ?? colors[0];
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy this sustain trail
   */
  destroy() {
    this.vertices = [];
    this.indices = [];
    this.uvtData = [];
    this.noteData = null;
    this.parentStrumline = null;
    this.cover = null;
    this.scene = null;

    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }

    if (this.image) {
      this.image.destroy();
      this.image = null;
    }
  }
}

export default SustainTrail;

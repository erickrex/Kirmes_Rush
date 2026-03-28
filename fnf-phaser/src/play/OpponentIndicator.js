/**
 * @fileoverview OpponentIndicator - Compact arrow indicator for opponent note hits
 * Displays four small arrow icons in the top-left corner of the portrait canvas.
 * When the opponent hits a note, the corresponding arrow flashes briefly.
 *
 * Replaces the full opponent strumline in portrait mode.
 */

import {
  OPPONENT_INDICATOR_X,
  OPPONENT_INDICATOR_Y,
  OPPONENT_ARROW_SIZE,
  OPPONENT_FLASH_DURATION
} from '../layout/LayoutManager.js';
import { COLOR_NOTES } from '../core/Constants.js';

/**
 * Arrow rotation angles in radians for each direction.
 * Points the triangle in the correct direction.
 * @type {number[]}
 */
const DIRECTION_ANGLES = [
  Math.PI, // left  — points left
  Math.PI / 2, // down  — points down
  -Math.PI / 2, // up    — points up
  0 // right — points right (default)
];

/**
 * Idle alpha for arrows when not flashing.
 * @type {number}
 */
const IDLE_ALPHA = 0.35;

/**
 * Flash alpha for arrows when highlighted.
 * @type {number}
 */
const FLASH_ALPHA = 1.0;

/**
 * @typedef {Object} OpponentIndicatorConfig
 * @property {number} [x=OPPONENT_INDICATOR_X] - X position of the indicator group
 * @property {number} [y=OPPONENT_INDICATOR_Y] - Y position of the indicator group
 * @property {number} [arrowSize=OPPONENT_ARROW_SIZE] - Size of each arrow icon in pixels
 * @property {number} [flashDuration=OPPONENT_FLASH_DURATION] - Flash highlight duration in ms
 */

/**
 * @typedef {Object} ArrowState
 * @property {number} direction - Direction index (0=left, 1=down, 2=up, 3=right)
 * @property {number} flashTimer - Countdown from flashDuration to 0
 * @property {boolean} isFlashing - Whether the arrow is currently highlighted
 * @property {Object|null} graphic - The Phaser Graphics object (null in headless/test mode)
 */

/**
 * Compact opponent note indicator widget.
 * Shows four small arrow icons that flash when the opponent hits notes.
 */
class OpponentIndicator {
  /**
   * The Phaser scene
   * @type {Object|null}
   */
  scene = null;

  /**
   * X position of the indicator group
   * @type {number}
   */
  x = OPPONENT_INDICATOR_X;

  /**
   * Y position of the indicator group
   * @type {number}
   */
  y = OPPONENT_INDICATOR_Y;

  /**
   * Size of each arrow icon in pixels
   * @type {number}
   */
  arrowSize = OPPONENT_ARROW_SIZE;

  /**
   * Flash highlight duration in ms
   * @type {number}
   */
  flashDuration = OPPONENT_FLASH_DURATION;

  /**
   * Arrow states for each direction
   * @type {ArrowState[]}
   */
  arrows = [];

  /**
   * @param {Object} scene - The Phaser scene
   * @param {OpponentIndicatorConfig} [config={}] - Configuration options
   */
  constructor(scene, config = {}) {
    this.scene = scene;
    this.x = config.x ?? OPPONENT_INDICATOR_X;
    this.y = config.y ?? OPPONENT_INDICATOR_Y;
    this.arrowSize = config.arrowSize ?? OPPONENT_ARROW_SIZE;
    this.flashDuration = config.flashDuration ?? OPPONENT_FLASH_DURATION;
    this.arrows = [];
  }

  /**
   * Create the four arrow icon graphics.
   * Each arrow is a small triangle rendered via Phaser.GameObjects.Graphics,
   * positioned side by side with a small gap.
   */
  create() {
    const gap = 4;

    for (let i = 0; i < 4; i++) {
      const arrowX = this.x + i * (this.arrowSize + gap);
      const arrowY = this.y;

      let graphic = null;

      // Only create Phaser graphics if scene has the add factory
      if (this.scene && this.scene.add && typeof this.scene.add.graphics === 'function') {
        graphic = this.scene.add.graphics();
        this._drawArrow(graphic, arrowX, arrowY, i);
        graphic.setAlpha(IDLE_ALPHA);
      }

      this.arrows.push({
        direction: i,
        flashTimer: 0,
        isFlashing: false,
        graphic
      });
    }
  }

  /**
   * Draw an arrow triangle on a Graphics object.
   * @param {Object} graphic - Phaser.GameObjects.Graphics
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} direction - Direction index (0-3)
   * @private
   */
  _drawArrow(graphic, x, y, direction) {
    const size = this.arrowSize;
    const half = size / 2;
    const color = COLOR_NOTES[direction] ?? 0xffffff;
    const angle = DIRECTION_ANGLES[direction];

    // Triangle points (pointing right by default, then rotated)
    const points = [
      { x: half, y: 0 },
      { x: -half, y: -half },
      { x: -half, y: half }
    ];

    // Rotate points
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotated = points.map((p) => ({
      x: x + half + p.x * cos - p.y * sin,
      y: y + half + p.x * sin + p.y * cos
    }));

    graphic.fillStyle(color, 1);
    graphic.fillTriangle(
      rotated[0].x,
      rotated[0].y,
      rotated[1].x,
      rotated[1].y,
      rotated[2].x,
      rotated[2].y
    );
  }

  /**
   * Flash the arrow for a given direction.
   * Highlights the arrow at full alpha for the configured flash duration.
   *
   * @param {number} direction - Direction index (0=left, 1=down, 2=up, 3=right)
   */
  flash(direction) {
    if (direction < 0 || direction > 3) {
      return;
    }

    const arrow = this.arrows[direction];
    if (!arrow) {
      return;
    }

    arrow.flashTimer = this.flashDuration;
    arrow.isFlashing = true;

    if (arrow.graphic && typeof arrow.graphic.setAlpha === 'function') {
      arrow.graphic.setAlpha(FLASH_ALPHA);
    }
  }

  /**
   * Update arrow flash timers and fade back to idle state.
   *
   * @param {number} delta - Time elapsed since last frame in ms
   */
  update(delta) {
    for (const arrow of this.arrows) {
      if (!arrow.isFlashing) {
        continue;
      }

      arrow.flashTimer -= delta;

      if (arrow.flashTimer <= 0) {
        arrow.flashTimer = 0;
        arrow.isFlashing = false;

        if (arrow.graphic && typeof arrow.graphic.setAlpha === 'function') {
          arrow.graphic.setAlpha(IDLE_ALPHA);
        }
      }
    }
  }

  /**
   * Set the position of the entire indicator group.
   * Repositions all arrow graphics relative to the new origin.
   *
   * @param {number} x - New X position
   * @param {number} y - New Y position
   */
  setPosition(x, y) {
    const gap = 4;
    this.x = x;
    this.y = y;

    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i];
      if (arrow.graphic && typeof arrow.graphic.clear === 'function') {
        arrow.graphic.clear();
        const arrowX = x + i * (this.arrowSize + gap);
        this._drawArrow(arrow.graphic, arrowX, y, arrow.direction);
        arrow.graphic.setAlpha(arrow.isFlashing ? FLASH_ALPHA : IDLE_ALPHA);
      }
    }
  }

  /**
   * Destroy all graphics and clean up references.
   */
  destroy() {
    for (const arrow of this.arrows) {
      if (arrow.graphic && typeof arrow.graphic.destroy === 'function') {
        arrow.graphic.destroy();
      }
      arrow.graphic = null;
    }
    this.arrows = [];
    this.scene = null;
  }
}

export default OpponentIndicator;

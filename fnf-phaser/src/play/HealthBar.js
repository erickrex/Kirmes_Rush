/**
 * @fileoverview HealthBar - Visual health bar display
 * Displays player health with smooth lerping and color-coded fill.
 *
 * Ported from source/funkin/play/PlayState.hx (healthBar/healthBarBG)
 */

import * as Constants from '../core/Constants.js';

/**
 * @typedef {Object} HealthBarConfig
 * @property {number} [x=0] - X position
 * @property {number} [y=0] - Y position
 * @property {number} [width=600] - Bar width
 * @property {number} [height=20] - Bar height
 * @property {number} [borderSize=4] - Border/background padding
 * @property {number} [playerColor] - Player (right) side color
 * @property {number} [opponentColor] - Opponent (left) side color
 * @property {number} [backgroundColor=0x000000] - Background color
 * @property {boolean} [showBackground=true] - Whether to show background
 */

/**
 * Health bar display for gameplay HUD.
 * Shows player health as a bar that fills from right to left.
 */
class HealthBar {
  /**
   * The Phaser scene
   * @type {Phaser.Scene | null}
   */
  scene = null;

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
   * Bar width (inner)
   * @type {number}
   */
  width = 600;

  /**
   * Bar height (inner)
   * @type {number}
   */
  height = 20;

  /**
   * Border/padding size
   * @type {number}
   */
  borderSize = 4;

  /**
   * Current health value (0-2)
   * @type {number}
   */
  value = Constants.HEALTH_STARTING;

  /**
   * Target health value for lerping
   * @type {number}
   */
  targetValue = Constants.HEALTH_STARTING;

  /**
   * Lerp speed (0-1, higher = faster)
   * @type {number}
   */
  lerpSpeed = 0.2;

  /**
   * Player (right side) color
   * @type {number}
   */
  playerColor = Constants.COLOR_HEALTH_BAR_GREEN;

  /**
   * Opponent (left side) color
   * @type {number}
   */
  opponentColor = Constants.COLOR_HEALTH_BAR_RED;

  /**
   * Background color
   * @type {number}
   */
  backgroundColor = 0x000000;

  /**
   * Whether to show background
   * @type {boolean}
   */
  showBackground = true;

  /**
   * Background graphics object
   * @type {Phaser.GameObjects.Graphics | null}
   */
  backgroundGraphics = null;

  /**
   * Bar graphics object
   * @type {Phaser.GameObjects.Graphics | null}
   */
  barGraphics = null;

  /**
   * Whether the bar needs to be redrawn
   * @type {boolean}
   */
  dirty = true;

  /**
   * Minimum health value
   * @type {number}
   */
  minValue = Constants.HEALTH_MIN;

  /**
   * Maximum health value
   * @type {number}
   */
  maxValue = Constants.HEALTH_MAX;

  /**
   * Create a new HealthBar
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {HealthBarConfig} [config={}] - Configuration options
   */
  constructor(scene, config = {}) {
    this.scene = scene;

    // Apply configuration
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.width = config.width ?? 600;
    this.height = config.height ?? 20;
    this.borderSize = config.borderSize ?? 4;
    this.playerColor = config.playerColor ?? Constants.COLOR_HEALTH_BAR_GREEN;
    this.opponentColor = config.opponentColor ?? Constants.COLOR_HEALTH_BAR_RED;
    this.backgroundColor = config.backgroundColor ?? 0x000000;
    this.showBackground = config.showBackground ?? true;

    // Create graphics objects
    this.createGraphics();
  }

  /**
   * Create the graphics objects for rendering
   */
  createGraphics() {
    if (!this.scene) {
      return;
    }

    // Background graphics (border)
    if (this.showBackground) {
      this.backgroundGraphics = this.scene.add?.graphics();
      if (this.backgroundGraphics) {
        this.backgroundGraphics.setScrollFactor(0);
      }
    }

    // Bar graphics (fill)
    this.barGraphics = this.scene.add?.graphics();
    if (this.barGraphics) {
      this.barGraphics.setScrollFactor(0);
    }

    this.dirty = true;
  }

  /**
   * Set the health value (with lerping)
   * @param {number} health - Health value (0-2)
   */
  setHealth(health) {
    this.targetValue = Math.max(this.minValue, Math.min(this.maxValue, health));
    this.dirty = true;
  }

  /**
   * Set the health value immediately (no lerping)
   * @param {number} health - Health value (0-2)
   */
  setHealthImmediate(health) {
    this.value = Math.max(this.minValue, Math.min(this.maxValue, health));
    this.targetValue = this.value;
    this.dirty = true;
  }

  /**
   * Set the position of the health bar
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {this}
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.dirty = true;
    return this;
  }

  /**
   * Center the health bar horizontally on screen
   * @param {number} [screenWidth=1280] - Screen width
   * @returns {this}
   */
  centerX(screenWidth = 1280) {
    const totalWidth = this.width + this.borderSize * 2;
    this.x = (screenWidth - totalWidth) / 2;
    this.dirty = true;
    return this;
  }

  /**
   * Set the colors for the health bar
   * @param {number} playerColor - Player (right) side color
   * @param {number} opponentColor - Opponent (left) side color
   * @returns {this}
   */
  setColors(playerColor, opponentColor) {
    this.playerColor = playerColor;
    this.opponentColor = opponentColor;
    this.dirty = true;
    return this;
  }

  /**
   * Set the lerp speed
   * @param {number} speed - Lerp speed (0-1)
   * @returns {this}
   */
  setLerpSpeed(speed) {
    this.lerpSpeed = Math.max(0, Math.min(1, speed));
    return this;
  }

  /**
   * Get the current fill percentage (0-1)
   * @returns {number}
   */
  getPercent() {
    return (this.value - this.minValue) / (this.maxValue - this.minValue);
  }

  /**
   * Get the X position of the center divider (where icons should be placed)
   * @returns {number}
   */
  getCenterX() {
    const percent = this.getPercent();
    // Health bar fills from right to left, so 100% health = divider at left
    // 0% health = divider at right
    const fillWidth = this.width * (1 - percent);
    return this.x + this.borderSize + fillWidth;
  }

  /**
   * Get the center Y position
   * @returns {number}
   */
  getCenterY() {
    return this.y + (this.height + this.borderSize * 2) / 2;
  }

  /**
   * Update the health bar
   * @param {number} [delta=16.67] - Delta time in ms
   */
  update(delta = 16.67) {
    // Lerp health value
    if (this.value !== this.targetValue) {
      const lerpFactor = 1 - Math.pow(1 - this.lerpSpeed, delta / 16.67);
      this.value = this.lerp(this.value, this.targetValue, lerpFactor);

      // Snap if close enough
      if (Math.abs(this.value - this.targetValue) < 0.001) {
        this.value = this.targetValue;
      }

      this.dirty = true;
    }

    // Redraw if needed
    if (this.dirty) {
      this.draw();
      this.dirty = false;
    }
  }

  /**
   * Linear interpolation
   * @param {number} a - Start value
   * @param {number} b - End value
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number}
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Draw the health bar
   */
  draw() {
    this.drawBackground();
    this.drawBar();
  }

  /**
   * Draw the background/border
   */
  drawBackground() {
    if (!this.backgroundGraphics || !this.showBackground) {
      return;
    }

    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(this.backgroundColor, 1);
    this.backgroundGraphics.fillRect(
      this.x,
      this.y,
      this.width + this.borderSize * 2,
      this.height + this.borderSize * 2
    );
  }

  /**
   * Draw the bar fill
   */
  drawBar() {
    if (!this.barGraphics) {
      return;
    }

    this.barGraphics.clear();

    const innerX = this.x + this.borderSize;
    const innerY = this.y + this.borderSize;
    const percent = this.getPercent();

    // Calculate fill widths
    // Player health fills from right, opponent from left
    const playerWidth = this.width * percent;
    const opponentWidth = this.width - playerWidth;

    // Draw opponent side (left, red)
    if (opponentWidth > 0) {
      this.barGraphics.fillStyle(this.opponentColor, 1);
      this.barGraphics.fillRect(innerX, innerY, opponentWidth, this.height);
    }

    // Draw player side (right, green)
    if (playerWidth > 0) {
      this.barGraphics.fillStyle(this.playerColor, 1);
      this.barGraphics.fillRect(innerX + opponentWidth, innerY, playerWidth, this.height);
    }
  }

  /**
   * Set the camera for the health bar (for HUD camera)
   * @param {Phaser.Cameras.Scene2D.Camera} camera - The camera
   * @returns {this}
   */
  setCamera(camera) {
    if (this.backgroundGraphics) {
      this.backgroundGraphics.setScrollFactor(0);
      if (camera && this.backgroundGraphics.cameras) {
        // In Phaser, we'd set cameras array
      }
    }
    if (this.barGraphics) {
      this.barGraphics.setScrollFactor(0);
    }
    return this;
  }

  /**
   * Set the depth/z-index
   * @param {number} depth - Depth value
   * @returns {this}
   */
  setDepth(depth) {
    if (this.backgroundGraphics) {
      this.backgroundGraphics.setDepth(depth);
    }
    if (this.barGraphics) {
      this.barGraphics.setDepth(depth + 1);
    }
    return this;
  }

  /**
   * Set visibility
   * @param {boolean} visible - Whether visible
   * @returns {this}
   */
  setVisible(visible) {
    if (this.backgroundGraphics) {
      this.backgroundGraphics.setVisible(visible);
    }
    if (this.barGraphics) {
      this.barGraphics.setVisible(visible);
    }
    return this;
  }

  /**
   * Set alpha/opacity
   * @param {number} alpha - Alpha value (0-1)
   * @returns {this}
   */
  setAlpha(alpha) {
    if (this.backgroundGraphics) {
      this.backgroundGraphics.setAlpha(alpha);
    }
    if (this.barGraphics) {
      this.barGraphics.setAlpha(alpha);
    }
    return this;
  }

  /**
   * Get total width including border
   * @returns {number}
   */
  getTotalWidth() {
    return this.width + this.borderSize * 2;
  }

  /**
   * Get total height including border
   * @returns {number}
   */
  getTotalHeight() {
    return this.height + this.borderSize * 2;
  }

  /**
   * Destroy the health bar
   */
  destroy() {
    if (this.backgroundGraphics) {
      this.backgroundGraphics.destroy();
      this.backgroundGraphics = null;
    }

    if (this.barGraphics) {
      this.barGraphics.destroy();
      this.barGraphics = null;
    }

    this.scene = null;
  }
}

export default HealthBar;

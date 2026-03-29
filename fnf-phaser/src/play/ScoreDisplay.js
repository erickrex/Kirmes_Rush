/**
 * @fileoverview ScoreDisplay - Score and stats display for HUD
 * Shows current score, combo, accuracy, and other gameplay stats.
 *
 * Ported from source/funkin/play/PlayState.hx (scoreText)
 */

/**
 * @typedef {Object} ScoreDisplayConfig
 * @property {number} [x=0] - X position
 * @property {number} [y=0] - Y position
 * @property {string} [fontFamily='vcr'] - Font family
 * @property {number} [fontSize=20] - Font size
 * @property {number} [color=0xffffff] - Text color
 * @property {boolean} [showCombo=true] - Whether to show combo
 * @property {boolean} [showAccuracy=true] - Whether to show accuracy
 * @property {boolean} [showMisses=false] - Whether to show miss count
 * @property {string} [align='right'] - Text alignment
 */

/**
 * Score display for gameplay HUD.
 * Shows score, combo, accuracy, and other stats.
 */
class ScoreDisplay {
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
   * Current score
   * @type {number}
   */
  score = 0;

  /**
   * Target score for lerping
   * @type {number}
   */
  targetScore = 0;

  /**
   * Current combo
   * @type {number}
   */
  combo = 0;

  /**
   * Current accuracy (0-100)
   * @type {number}
   */
  accuracy = 0;

  /**
   * Miss count
   * @type {number}
   */
  misses = 0;

  /**
   * Font family
   * @type {string}
   */
  fontFamily = 'vcr';

  /**
   * Font size
   * @type {number}
   */
  fontSize = 20;

  /**
   * Text color
   * @type {number}
   */
  color = 0xffffff;

  /**
   * Whether to show combo
   * @type {boolean}
   */
  showCombo = true;

  /**
   * Whether to show accuracy
   * @type {boolean}
   */
  showAccuracy = true;

  /**
   * Whether to show miss count
   * @type {boolean}
   */
  showMisses = false;

  /**
   * Text alignment
   * @type {string}
   */
  align = 'right';

  /**
   * Score lerp speed
   * @type {number}
   */
  lerpSpeed = 0.25;

  /**
   * Text object
   * @type {Phaser.GameObjects.Text | null}
   */
  text = null;

  /**
   * Whether the display needs to be updated
   * @type {boolean}
   */
  dirty = true;

  /**
   * Displayed score (for lerping)
   * @type {number}
   */
  displayedScore = 0;

  /**
   * Format string for score display
   * @type {string}
   */
  formatString = 'Score: {score}';

  /**
   * Create a new ScoreDisplay
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {ScoreDisplayConfig} [config={}] - Configuration options
   */
  constructor(scene, config = {}) {
    this.scene = scene;

    // Apply configuration
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.fontFamily = config.fontFamily ?? 'vcr';
    this.fontSize = Math.max(16, config.fontSize ?? 20);
    this.color = config.color ?? 0xffffff;
    this.showCombo = config.showCombo ?? true;
    this.showAccuracy = config.showAccuracy ?? true;
    this.showMisses = config.showMisses ?? false;
    this.align = config.align ?? 'right';

    // Create text object
    this.createText();
  }

  /**
   * Create the text object
   */
  createText() {
    if (!this.scene) {
      return;
    }

    // Create Phaser text
    this.text = this.scene.add?.text(this.x, this.y, '', {
      fontFamily: this.fontFamily,
      fontSize: `${this.fontSize}px`,
      color: this.colorToString(this.color),
      align: this.align
    });

    if (this.text) {
      this.text.setScrollFactor(0);
      this.text.setOrigin(this.align === 'right' ? 1 : this.align === 'center' ? 0.5 : 0, 0);
    }

    this.dirty = true;
  }

  /**
   * Convert color number to CSS string
   * @param {number} color - Color as number
   * @returns {string}
   */
  colorToString(color) {
    return '#' + color.toString(16).padStart(6, '0');
  }

  /**
   * Set the score
   * @param {number} score - New score value
   * @param {boolean} [immediate=false] - Whether to set immediately (no lerp)
   */
  setScore(score, immediate = false) {
    this.targetScore = score;
    if (immediate) {
      this.score = score;
      this.displayedScore = score;
    }
    this.dirty = true;
  }

  /**
   * Set the combo
   * @param {number} combo - New combo value
   */
  setCombo(combo) {
    this.combo = combo;
    this.dirty = true;
  }

  /**
   * Set the accuracy
   * @param {number} accuracy - Accuracy percentage (0-100)
   */
  setAccuracy(accuracy) {
    this.accuracy = Math.max(0, Math.min(100, accuracy));
    this.dirty = true;
  }

  /**
   * Set the miss count
   * @param {number} misses - Number of misses
   */
  setMisses(misses) {
    this.misses = misses;
    this.dirty = true;
  }

  /**
   * Update all stats at once
   * @param {{score?: number, combo?: number, accuracy?: number, misses?: number}} stats - Stats object
   */
  setStats(stats) {
    if (stats.score !== undefined) {
      this.targetScore = stats.score;
    }
    if (stats.combo !== undefined) {
      this.combo = stats.combo;
    }
    if (stats.accuracy !== undefined) {
      this.accuracy = Math.max(0, Math.min(100, stats.accuracy));
    }
    if (stats.misses !== undefined) {
      this.misses = stats.misses;
    }
    this.dirty = true;
  }

  /**
   * Set the position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {this}
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    if (this.text) {
      this.text.setPosition(x, y);
    }
    return this;
  }

  /**
   * Set the format string
   * @param {string} format - Format string with placeholders
   * @returns {this}
   */
  setFormat(format) {
    this.formatString = format;
    this.dirty = true;
    return this;
  }

  /**
   * Set visibility options
   * @param {{combo?: boolean, accuracy?: boolean, misses?: boolean}} options - Visibility options
   * @returns {this}
   */
  setVisibility(options) {
    if (options.combo !== undefined) {
      this.showCombo = options.combo;
    }
    if (options.accuracy !== undefined) {
      this.showAccuracy = options.accuracy;
    }
    if (options.misses !== undefined) {
      this.showMisses = options.misses;
    }
    this.dirty = true;
    return this;
  }

  /**
   * Update the display
   * @param {number} [delta=16.67] - Delta time in ms
   */
  update(delta = 16.67) {
    // Lerp score
    if (this.displayedScore !== this.targetScore) {
      const lerpFactor = 1 - Math.pow(1 - this.lerpSpeed, delta / 16.67);
      this.displayedScore = this.lerp(this.displayedScore, this.targetScore, lerpFactor);

      // Snap if close enough
      if (Math.abs(this.displayedScore - this.targetScore) < 1) {
        this.displayedScore = this.targetScore;
      }

      this.score = Math.round(this.displayedScore);
      this.dirty = true;
    }

    // Update text if dirty
    if (this.dirty) {
      this.updateText();
      this.dirty = false;
    }
  }

  /**
   * Linear interpolation
   * @param {number} a - Start value
   * @param {number} b - End value
   * @param {number} t - Interpolation factor
   * @returns {number}
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Update the text content
   */
  updateText() {
    if (!this.text) {
      return;
    }

    const content = this.buildText();
    this.text.setText(content);
  }

  /**
   * Build the text content string
   * @returns {string}
   */
  buildText() {
    const parts = [];

    // Score
    parts.push(`Score: ${this.formatNumber(this.score)}`);

    // Combo
    if (this.showCombo && this.combo > 0) {
      parts.push(`Combo: ${this.combo}`);
    }

    // Accuracy
    if (this.showAccuracy) {
      parts.push(`Accuracy: ${this.accuracy.toFixed(2)}%`);
    }

    // Misses
    if (this.showMisses) {
      parts.push(`Misses: ${this.misses}`);
    }

    return parts.join(' | ');
  }

  /**
   * Format a number with commas
   * @param {number} num - Number to format
   * @returns {string}
   */
  formatNumber(num) {
    return num.toLocaleString();
  }

  /**
   * Calculate accuracy from tallies
   * @param {import("../types.js").Tallies} tallies - Tally object
   * @returns {number} Accuracy percentage
   */
  static calculateAccuracy(tallies) {
    const totalHit = tallies.totalNotesHit ?? 0;
    const totalNotes = tallies.totalNotes ?? 0;

    if (totalNotes === 0) {
      return 0;
    }

    // Weight hits by judgement quality
    const sick = tallies.sick ?? 0;
    const good = tallies.good ?? 0;
    const bad = tallies.bad ?? 0;
    const shit = tallies.shit ?? 0;

    // Weighted accuracy: sick=100%, good=75%, bad=50%, shit=25%
    const weightedHits = sick * 1.0 + good * 0.75 + bad * 0.5 + shit * 0.25;
    const maxPossible = totalHit;

    if (maxPossible === 0) {
      return 0;
    }

    return (weightedHits / maxPossible) * 100;
  }

  /**
   * Set the depth/z-index
   * @param {number} depth - Depth value
   * @returns {this}
   */
  setDepth(depth) {
    if (this.text) {
      this.text.setDepth(depth);
    }
    return this;
  }

  /**
   * Set visibility
   * @param {boolean} visible - Whether visible
   * @returns {this}
   */
  setVisible(visible) {
    if (this.text) {
      this.text.setVisible(visible);
    }
    return this;
  }

  /**
   * Set alpha/opacity
   * @param {number} alpha - Alpha value (0-1)
   * @returns {this}
   */
  setAlpha(alpha) {
    if (this.text) {
      this.text.setAlpha(alpha);
    }
    return this;
  }

  /**
   * Get the text width
   * @returns {number}
   */
  getWidth() {
    return this.text?.width ?? 0;
  }

  /**
   * Get the text height
   * @returns {number}
   */
  getHeight() {
    return this.text?.height ?? 0;
  }

  /**
   * Destroy the score display
   */
  destroy() {
    if (this.text) {
      this.text.destroy();
      this.text = null;
    }

    this.scene = null;
  }
}

export default ScoreDisplay;

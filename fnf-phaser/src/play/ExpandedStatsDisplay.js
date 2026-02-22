/**
 * @fileoverview ExpandedStatsDisplay - Extended HUD with competitive stats
 * Extends ScoreDisplay with NPS meter, grade display, combo breaks, and judgement breakdown.
 *
 * Implements Requirements 7.1, 8.1, 9.1, 10.1
 */

import ScoreDisplay from './ScoreDisplay.js';
import NPSMeter from './NPSMeter.js';
import GradeDisplay from './GradeDisplay.js';

/**
 * @typedef {Object} ExpandedStatsConfig
 * @property {number} [x=0] - X position
 * @property {number} [y=0] - Y position
 * @property {string} [fontFamily='vcr'] - Font family
 * @property {number} [fontSize=20] - Font size
 * @property {number} [color=0xffffff] - Text color
 * @property {boolean} [showCombo=true] - Whether to show combo
 * @property {boolean} [showAccuracy=true] - Whether to show accuracy
 * @property {boolean} [showMisses=false] - Whether to show miss count
 * @property {string} [align='right'] - Text alignment
 * @property {boolean} [showNPS=true] - Whether to show NPS meter
 * @property {boolean} [showGrade=true] - Whether to show grade
 * @property {boolean} [showComboBreaks=true] - Whether to show combo breaks
 * @property {boolean} [showJudgements=false] - Whether to show judgement breakdown
 */

/**
 * @typedef {Object} VisibilityOptions
 * @property {boolean} showNPS - Show NPS meter
 * @property {boolean} showGrade - Show grade display
 * @property {boolean} showComboBreaks - Show combo break counter
 * @property {boolean} showJudgements - Show judgement breakdown
 */

/**
 * Extended stats display for competitive gameplay.
 * Extends ScoreDisplay with additional competitive features:
 * - NPS (Notes-Per-Second) meter with peak tracking
 * - Real-time grade display
 * - Combo break counter (separate from misses)
 * - Judgement breakdown (sick/good/bad/shit counts)
 */
class ExpandedStatsDisplay extends ScoreDisplay {
  /**
   * NPS meter instance
   * @type {NPSMeter | null}
   */
  npsMeter = null;

  /**
   * Grade display instance
   * @type {GradeDisplay | null}
   */
  gradeDisplay = null;

  /**
   * Number of combo breaks (distinct from misses)
   * @type {number}
   */
  comboBreaks = 0;

  /**
   * Judgement counts by type
   * @type {Object}
   */
  judgements = {
    sick: 0,
    good: 0,
    bad: 0,
    shit: 0
  };

  /**
   * Visibility options for expanded stats
   * @type {VisibilityOptions}
   */
  visibilityOptions = {
    showNPS: true,
    showGrade: true,
    showComboBreaks: true,
    showJudgements: false
  };

  /**
   * Create a new ExpandedStatsDisplay
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {ExpandedStatsConfig} [config={}] - Configuration options
   */
  constructor(scene, config = {}) {
    // Call parent constructor
    super(scene, config);

    // Initialize expanded stats components
    this.npsMeter = new NPSMeter();
    this.gradeDisplay = new GradeDisplay();

    // Apply expanded visibility options
    this.visibilityOptions = {
      showNPS: config.showNPS ?? true,
      showGrade: config.showGrade ?? true,
      showComboBreaks: config.showComboBreaks ?? true,
      showJudgements: config.showJudgements ?? false
    };

    // Reset judgement counts
    this.judgements = {
      sick: 0,
      good: 0,
      bad: 0,
      shit: 0
    };

    this.comboBreaks = 0;
  }

  /**
   * Record a note hit with judgement and timestamp.
   * Updates NPS meter, judgement counts, and grade display.
   *
   * @param {string} judgement - Judgement type ('sick', 'good', 'bad', 'shit')
   * @param {number} timestamp - Hit timestamp in ms
   */
  recordHit(judgement, timestamp) {
    // Record hit in NPS meter
    if (this.npsMeter) {
      this.npsMeter.recordHit(timestamp);
    }

    // Update judgement counts
    const normalizedJudgement = judgement.toLowerCase();
    if (this.judgements.hasOwnProperty(normalizedJudgement)) {
      this.judgements[normalizedJudgement]++;
    }

    // Update grade based on new accuracy
    this.updateGradeFromStats();

    this.dirty = true;
  }

  /**
   * Record a combo break.
   * Increments combo break counter (separate from misses).
   */
  recordComboBreak() {
    this.comboBreaks++;
    this.dirty = true;
  }

  /**
   * Update the display with delta time.
   * Updates NPS meter and parent display.
   *
   * @param {number} [delta=16.67] - Delta time in ms
   * @param {number} [currentTime] - Current song time in ms
   */
  update(delta = 16.67, currentTime) {
    // Update NPS meter if time provided
    if (this.npsMeter && currentTime !== undefined) {
      this.npsMeter.update(currentTime);
    }

    // Call parent update
    super.update(delta);
  }

  /**
   * Update grade display based on current stats.
   * Calculates accuracy from judgement counts and updates grade.
   */
  updateGradeFromStats() {
    if (!this.gradeDisplay) return;

    // Calculate accuracy from judgements
    const totalHits = this.getTotalHits();
    if (totalHits === 0) return;

    // Weighted accuracy calculation
    const weightedHits =
      this.judgements.sick * 1.0 +
      this.judgements.good * 0.75 +
      this.judgements.bad * 0.5 +
      this.judgements.shit * 0.25;

    const accuracy = (weightedHits / totalHits) * 100;

    // Update grade with accuracy and misses
    this.gradeDisplay.updateGrade(accuracy, this.misses);
  }

  /**
   * Get total number of hits across all judgements
   * @returns {number}
   */
  getTotalHits() {
    return (
      this.judgements.sick +
      this.judgements.good +
      this.judgements.bad +
      this.judgements.shit
    );
  }

  /**
   * Get current NPS value
   * @returns {number}
   */
  getCurrentNPS() {
    return this.npsMeter?.getCurrentNPS() ?? 0;
  }

  /**
   * Get peak NPS value
   * @returns {number}
   */
  getPeakNPS() {
    return this.npsMeter?.getPeakNPS() ?? 0;
  }

  /**
   * Get current grade
   * @returns {string}
   */
  getCurrentGrade() {
    return this.gradeDisplay?.getCurrentGrade() ?? 'N/A';
  }

  /**
   * Get combo break count
   * @returns {number}
   */
  getComboBreaks() {
    return this.comboBreaks;
  }

  /**
   * Get judgement counts
   * @returns {Object}
   */
  getJudgements() {
    return { ...this.judgements };
  }

  /**
   * Set expanded visibility options
   * @param {Partial<VisibilityOptions>} options - Visibility options
   * @returns {this}
   */
  setExpandedVisibility(options) {
    if (options.showNPS !== undefined) {
      this.visibilityOptions.showNPS = options.showNPS;
    }
    if (options.showGrade !== undefined) {
      this.visibilityOptions.showGrade = options.showGrade;
    }
    if (options.showComboBreaks !== undefined) {
      this.visibilityOptions.showComboBreaks = options.showComboBreaks;
    }
    if (options.showJudgements !== undefined) {
      this.visibilityOptions.showJudgements = options.showJudgements;
    }
    this.dirty = true;
    return this;
  }

  /**
   * Build the text content string.
   * Extends parent buildText with expanded stats.
   *
   * @returns {string}
   */
  buildText() {
    // Start with parent text
    const parts = [super.buildText()];

    // Add NPS
    if (this.visibilityOptions.showNPS && this.npsMeter) {
      const nps = this.npsMeter.getCurrentNPS();
      const peak = this.npsMeter.getPeakNPS();
      parts.push(`NPS: ${nps} (Peak: ${peak})`);
    }

    // Add Grade
    if (this.visibilityOptions.showGrade && this.gradeDisplay) {
      const grade = this.gradeDisplay.getCurrentGrade();
      parts.push(`Grade: ${grade}`);
    }

    // Add Combo Breaks
    if (this.visibilityOptions.showComboBreaks) {
      parts.push(`CB: ${this.comboBreaks}`);
    }

    // Add Judgement Breakdown
    if (this.visibilityOptions.showJudgements) {
      const j = this.judgements;
      parts.push(`S:${j.sick} G:${j.good} B:${j.bad} X:${j.shit}`);
    }

    return parts.filter(p => p).join(' | ');
  }

  /**
   * Reset all stats to initial state
   */
  resetStats() {
    // Reset parent stats
    this.score = 0;
    this.targetScore = 0;
    this.displayedScore = 0;
    this.combo = 0;
    this.accuracy = 0;
    this.misses = 0;

    // Reset expanded stats
    this.comboBreaks = 0;
    this.judgements = {
      sick: 0,
      good: 0,
      bad: 0,
      shit: 0
    };

    // Reset components
    if (this.npsMeter) {
      this.npsMeter.reset();
    }
    if (this.gradeDisplay) {
      this.gradeDisplay.reset();
    }

    this.dirty = true;
  }

  /**
   * Destroy the expanded stats display
   */
  destroy() {
    // Clean up components
    this.npsMeter = null;
    this.gradeDisplay = null;

    // Call parent destroy
    super.destroy();
  }
}

export default ExpandedStatsDisplay;

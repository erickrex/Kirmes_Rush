/**
 * @fileoverview GradeDisplay - Real-time grade calculation and display
 * Calculates and tracks player grade based on accuracy and misses.
 *
 * Implements Requirements 8.1, 8.2, 8.3, 8.5
 */

/**
 * @typedef {Object} GradeThreshold
 * @property {number} accuracy - Minimum accuracy percentage required
 * @property {number} maxMisses - Maximum misses allowed for this grade
 */

/**
 * Real-time grade calculation and display.
 * Calculates grades based on accuracy and miss count using
 * standard grade thresholds (S++, S+, S, A, B, C, D, F).
 */
class GradeDisplay {
  /**
   * Current calculated grade
   * @type {string}
   */
  currentGrade = 'N/A';

  /**
   * Previous grade (for change detection)
   * @type {string}
   */
  previousGrade = 'N/A';

  /**
   * Whether the grade changed on last update
   * @type {boolean}
   */
  gradeChanged = false;

  /**
   * Grade thresholds defining requirements for each grade.
   * Grades are checked in order from highest to lowest.
   *
   * - S++: Perfect score (100% accuracy, 0 misses)
   * - S+: Near-perfect (≥95% accuracy, 0 misses)
   * - S: Excellent (≥90% accuracy)
   * - A: Great (≥85% accuracy)
   * - B: Good (≥80% accuracy)
   * - C: Average (≥70% accuracy)
   * - D: Below average (≥60% accuracy)
   * - F: Failing (below 60% accuracy)
   *
   * @type {Object.<string, GradeThreshold>}
   */
  static GRADE_THRESHOLDS = {
    'S++': { accuracy: 100, maxMisses: 0 },
    'S+': { accuracy: 95, maxMisses: 0 },
    'S': { accuracy: 90, maxMisses: Infinity },
    'A': { accuracy: 85, maxMisses: Infinity },
    'B': { accuracy: 80, maxMisses: Infinity },
    'C': { accuracy: 70, maxMisses: Infinity },
    'D': { accuracy: 60, maxMisses: Infinity },
    'F': { accuracy: 0, maxMisses: Infinity }
  };

  /**
   * Ordered list of grades from highest to lowest
   * @type {string[]}
   */
  static GRADE_ORDER = ['S++', 'S+', 'S', 'A', 'B', 'C', 'D', 'F'];

  /**
   * Create a new GradeDisplay
   */
  constructor() {
    this.currentGrade = 'N/A';
    this.previousGrade = 'N/A';
    this.gradeChanged = false;
  }

  /**
   * Update grade based on current accuracy and miss count.
   * Checks thresholds from highest to lowest grade and assigns
   * the first grade whose requirements are met.
   *
   * @param {number} accuracy - Current accuracy percentage (0-100)
   * @param {number} misses - Current miss count
   */
  updateGrade(accuracy, misses) {
    this.previousGrade = this.currentGrade;

    // Find the appropriate grade based on thresholds
    const newGrade = this.calculateGrade(accuracy, misses);

    // Check if grade changed
    this.gradeChanged = this.currentGrade !== newGrade;
    this.currentGrade = newGrade;
  }

  /**
   * Calculate grade from accuracy and misses.
   * Internal method that determines grade without updating state.
   *
   * @param {number} accuracy - Accuracy percentage (0-100)
   * @param {number} misses - Miss count
   * @returns {string} Calculated grade
   */
  calculateGrade(accuracy, misses) {
    const thresholds = GradeDisplay.GRADE_THRESHOLDS;
    const gradeOrder = GradeDisplay.GRADE_ORDER;

    for (const grade of gradeOrder) {
      const threshold = thresholds[grade];

      // Check if accuracy meets threshold
      const meetsAccuracy = accuracy >= threshold.accuracy;

      // Check if misses are within limit
      const meetsMisses = misses <= threshold.maxMisses;

      if (meetsAccuracy && meetsMisses) {
        return grade;
      }
    }

    // Default to F if no grade matched (shouldn't happen with current thresholds)
    return 'F';
  }

  /**
   * Check if grade improved or dropped since last update.
   *
   * @returns {'up' | 'down' | 'same'} Direction of grade change
   */
  getGradeChange() {
    if (!this.gradeChanged) {
      return 'same';
    }

    const gradeOrder = GradeDisplay.GRADE_ORDER;
    const currentIndex = gradeOrder.indexOf(this.currentGrade);
    const previousIndex = gradeOrder.indexOf(this.previousGrade);

    // Handle N/A case (initial state)
    if (previousIndex === -1) {
      return 'same';
    }

    // Lower index = better grade
    if (currentIndex < previousIndex) {
      return 'up';
    } else if (currentIndex > previousIndex) {
      return 'down';
    }

    return 'same';
  }

  /**
   * Get the current grade
   * @returns {string}
   */
  getCurrentGrade() {
    return this.currentGrade;
  }

  /**
   * Get the previous grade
   * @returns {string}
   */
  getPreviousGrade() {
    return this.previousGrade;
  }

  /**
   * Check if grade changed on last update
   * @returns {boolean}
   */
  hasGradeChanged() {
    return this.gradeChanged;
  }

  /**
   * Get the grade index (0 = S++, 7 = F)
   * Useful for comparisons and animations.
   *
   * @param {string} [grade] - Grade to get index for (defaults to current)
   * @returns {number} Grade index, or -1 if invalid
   */
  getGradeIndex(grade) {
    const g = grade ?? this.currentGrade;
    return GradeDisplay.GRADE_ORDER.indexOf(g);
  }

  /**
   * Reset the grade display to initial state
   */
  reset() {
    this.currentGrade = 'N/A';
    this.previousGrade = 'N/A';
    this.gradeChanged = false;
  }
}

export default GradeDisplay;

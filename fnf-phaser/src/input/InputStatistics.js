/**
 * @fileoverview InputStatistics - Timing statistics tracking for rhythm game analysis
 * Tracks detailed input timing statistics including early/late ratios and per-judgement data.
 *
 * Part of the competitive features implementation.
 */

/**
 * @typedef {Object} TimingStats
 * @property {number} averageOffset - Average timing offset in ms (negative = early, positive = late)
 * @property {number} earlyCount - Number of early hits
 * @property {number} lateCount - Number of late hits
 * @property {number} perfectCount - Number of perfect (0ms) hits
 * @property {number[]} offsets - All timing offsets
 * @property {Object} byJudgement - Stats grouped by judgement
 */

/**
 * @typedef {Object} EarlyLateRatio
 * @property {number} early - Count of early hits (negative offset)
 * @property {number} late - Count of late hits (positive offset)
 * @property {number} perfect - Count of perfect hits (zero offset)
 */

/**
 * Tracks detailed input timing statistics for competitive analysis.
 * Records timing offsets by judgement and calculates early/late ratios.
 */
class InputStatistics {
  /**
   * All recorded timing offsets
   * @type {number[]}
   */
  offsets = [];

  /**
   * Timing offsets grouped by judgement type
   * @type {Object<string, number[]>}
   */
  byJudgement = {
    killer: [],
    sick: [],
    good: [],
    bad: [],
    shit: []
  };

  /**
   * Create a new InputStatistics tracker
   */
  constructor() {
    this.reset();
  }

  /**
   * Record a hit timing
   * @param {number} offset - Timing offset in ms (negative = early, positive = late)
   * @param {string} judgement - Judgement type (killer, sick, good, bad, shit)
   */
  recordHit(offset, judgement) {
    // Add to overall offsets
    this.offsets.push(offset);

    // Add to judgement-specific array
    const normalizedJudgement = judgement.toLowerCase();
    if (this.byJudgement[normalizedJudgement]) {
      this.byJudgement[normalizedJudgement].push(offset);
    }
  }

  /**
   * Get computed statistics
   * @returns {TimingStats}
   */
  getStats() {
    const earlyCount = this.offsets.filter((o) => o < 0).length;
    const lateCount = this.offsets.filter((o) => o > 0).length;
    const perfectCount = this.offsets.filter((o) => o === 0).length;

    // Calculate average offset
    let averageOffset = 0;
    if (this.offsets.length > 0) {
      const sum = this.offsets.reduce((acc, val) => acc + val, 0);
      averageOffset = sum / this.offsets.length;
    }

    // Calculate per-judgement stats
    /** @type {Record<string, {count: number, avgOffset: number}>} */
    const byJudgementStats = {};
    for (const [judgement, offsets] of Object.entries(this.byJudgement)) {
      if (offsets.length > 0) {
        const sum = offsets.reduce((acc, val) => acc + val, 0);
        byJudgementStats[judgement] = {
          count: offsets.length,
          avgOffset: sum / offsets.length
        };
      } else {
        byJudgementStats[judgement] = {
          count: 0,
          avgOffset: 0
        };
      }
    }

    return {
      averageOffset,
      earlyCount,
      lateCount,
      perfectCount,
      offsets: [...this.offsets],
      byJudgement: byJudgementStats
    };
  }

  /**
   * Get early/late ratio
   * @returns {EarlyLateRatio}
   */
  getEarlyLateRatio() {
    const early = this.offsets.filter((o) => o < 0).length;
    const late = this.offsets.filter((o) => o > 0).length;
    const perfect = this.offsets.filter((o) => o === 0).length;

    return { early, late, perfect };
  }

  /**
   * Get timing distribution histogram
   * @param {number} [bucketSize=10] - Size of each bucket in ms
   * @returns {Object<string, number>}
   */
  getDistribution(bucketSize = 10) {
    /** @type {Record<string, number>} */
    const distribution = {};

    for (const offset of this.offsets) {
      // Calculate bucket
      const bucketStart = Math.floor(offset / bucketSize) * bucketSize;
      const bucketEnd = bucketStart + bucketSize;
      const bucketKey = `${bucketStart}to${bucketEnd}`;

      distribution[bucketKey] = (distribution[bucketKey] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get total number of recorded hits
   * @returns {number}
   */
  get totalHits() {
    return this.offsets.length;
  }

  /**
   * Reset statistics
   */
  reset() {
    this.offsets = [];
    this.byJudgement = {
      killer: [],
      sick: [],
      good: [],
      bad: [],
      shit: []
    };
  }
}

export default InputStatistics;

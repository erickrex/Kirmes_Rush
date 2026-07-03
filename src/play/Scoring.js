/**
 * @fileoverview Scoring - Score calculation system for Rythm Foundation
 * A static class which holds functions related to scoring and judgement.
 *
 * Ported from source/rythm/play/scoring/Scoring.hx
 */

import * as Constants from '../core/Constants.js';

/**
 * @typedef {import('../types.js').Tallies} Tallies
 */

/**
 * Scoring system types.
 * @readonly
 * @enum {string}
 */
export const ScoringSystem = {
  /** Legacy scoring from Week 6 and older. Step function based on judgement. */
  LEGACY: 'LEGACY',
  /** Week 7 scoring with tighter windows. Step function based on judgement. */
  WEEK7: 'WEEK7',
  /** Points Based On Timing v1. Sigmoid function based on timing offset. */
  PBOT1: 'PBOT1'
};

/**
 * Rank values for song completion.
 * @readonly
 * @enum {string}
 */
export const ScoringRank = {
  PERFECT_GOLD: 'PERFECT_GOLD',
  PERFECT: 'PERFECT',
  EXCELLENT: 'EXCELLENT',
  GREAT: 'GREAT',
  GOOD: 'GOOD',
  SHIT: 'SHIT'
};

/**
 * Judgement types for note hits.
 * @readonly
 * @enum {string}
 */
export const Judgement = {
  KILLER: 'killer',
  SICK: 'sick',
  GOOD: 'good',
  BAD: 'bad',
  SHIT: 'shit',
  MISS: 'miss'
};

// ========================================
// SCORING STRATEGIES
// ========================================

/**
 * @typedef {Object} ScoringStrategy
 * @property {function(number): number} scoreNote - Score based on ms timing offset
 * @property {function(number): string} judgeNote - Judgement based on ms timing offset
 * @property {function(): number} getMissScore - Score penalty for a miss
 */

/** Legacy scoring strategy (Week 6 and older). */
const LegacyStrategy = {
  /** @param {number} msTiming @returns {number} */
  /** @param {number} msTiming @returns {number} */
  scoreNote(msTiming) {
    const absTiming = Math.abs(msTiming);

    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_SICK_THRESHOLD) {
      return Constants.LEGACY_SICK_SCORE;
    }
    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_GOOD_THRESHOLD) {
      return Constants.LEGACY_GOOD_SCORE;
    }
    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_BAD_THRESHOLD) {
      return Constants.LEGACY_BAD_SCORE;
    }
    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_SHIT_THRESHOLD) {
      return Constants.LEGACY_SHIT_SCORE;
    }

    return Constants.LEGACY_MISS_SCORE;
  },

  /** @param {number} msTiming @returns {string} */
  judgeNote(msTiming) {
    const absTiming = Math.abs(msTiming);

    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_SICK_THRESHOLD) {
      return Judgement.SICK;
    }
    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_GOOD_THRESHOLD) {
      return Judgement.GOOD;
    }
    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_BAD_THRESHOLD) {
      return Judgement.BAD;
    }
    if (absTiming < Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_SHIT_THRESHOLD) {
      return Judgement.SHIT;
    }

    return Judgement.MISS;
  },

  getMissScore() {
    return Constants.LEGACY_MISS_SCORE;
  }
};

/** Week 7 scoring strategy with tighter windows. */
const Week7Strategy = {
  /** @param {number} msTiming @returns {number} */
  scoreNote(msTiming) {
    const absTiming = Math.abs(msTiming);

    if (absTiming < Constants.WEEK7_HIT_WINDOW * Constants.WEEK7_SICK_THRESHOLD) {
      return Constants.WEEK7_SICK_SCORE;
    }
    if (absTiming < Constants.WEEK7_HIT_WINDOW * Constants.WEEK7_GOOD_THRESHOLD) {
      return Constants.WEEK7_GOOD_SCORE;
    }
    if (absTiming < Constants.WEEK7_HIT_WINDOW * Constants.WEEK7_BAD_THRESHOLD) {
      return Constants.WEEK7_BAD_SCORE;
    }
    if (absTiming < Constants.WEEK7_HIT_WINDOW) {
      return Constants.WEEK7_SHIT_SCORE;
    }

    return Constants.WEEK7_MISS_SCORE;
  },

  /** @param {number} msTiming @returns {string} */
  judgeNote(msTiming) {
    const absTiming = Math.abs(msTiming);

    if (absTiming < Constants.WEEK7_HIT_WINDOW * Constants.WEEK7_SICK_THRESHOLD) {
      return Judgement.SICK;
    }
    if (absTiming < Constants.WEEK7_HIT_WINDOW * Constants.WEEK7_GOOD_THRESHOLD) {
      return Judgement.GOOD;
    }
    if (absTiming < Constants.WEEK7_HIT_WINDOW * Constants.WEEK7_BAD_THRESHOLD) {
      return Judgement.BAD;
    }
    if (absTiming < Constants.WEEK7_HIT_WINDOW) {
      return Judgement.SHIT;
    }

    return Judgement.MISS;
  },

  getMissScore() {
    return Constants.WEEK7_MISS_SCORE;
  }
};

/** PBOT1 scoring strategy (Points Based On Timing v1). */
const PBOT1Strategy = {
  /** @param {number} msTiming @returns {number} */
  scoreNote(msTiming) {
    const absTiming = Math.abs(msTiming);

    // Miss threshold
    if (absTiming > Constants.PBOT1_MISS_THRESHOLD) {
      return Constants.PBOT1_MISS_SCORE;
    }

    // Perfect threshold - always max score
    if (absTiming < Constants.PBOT1_PERFECT_THRESHOLD) {
      return Constants.PBOT1_MAX_SCORE;
    }

    // Sigmoid scoring curve
    const factor =
      1.0 -
      1.0 /
        (1.0 +
          Math.exp(-Constants.PBOT1_SCORING_SLOPE * (absTiming - Constants.PBOT1_SCORING_OFFSET)));

    return Math.floor(Constants.PBOT1_MAX_SCORE * factor + Constants.PBOT1_MIN_SCORE);
  },

  /** @param {number} msTiming @returns {string} */
  judgeNote(msTiming) {
    const absTiming = Math.abs(msTiming);

    if (absTiming < Constants.PBOT1_KILLER_THRESHOLD) {
      return Judgement.KILLER;
    }
    if (absTiming < Constants.PBOT1_SICK_THRESHOLD) {
      return Judgement.SICK;
    }
    if (absTiming < Constants.PBOT1_GOOD_THRESHOLD) {
      return Judgement.GOOD;
    }
    if (absTiming < Constants.PBOT1_BAD_THRESHOLD) {
      return Judgement.BAD;
    }
    if (absTiming < Constants.PBOT1_SHIT_THRESHOLD) {
      return Judgement.SHIT;
    }

    return Judgement.MISS;
  },

  getMissScore() {
    return Constants.PBOT1_MISS_SCORE;
  }
};

/** Registry mapping ScoringSystem enum values to strategy objects. */
const strategies = {
  [ScoringSystem.LEGACY]: LegacyStrategy,
  [ScoringSystem.WEEK7]: Week7Strategy,
  [ScoringSystem.PBOT1]: PBOT1Strategy
};

/**
 * A static class which holds any functions related to scoring.
 */
class Scoring {
  /**
   * Determine the score a note receives under a given scoring system.
   * @param {number} msTiming - The difference between the note's time and when it was hit
   * @param {string} [scoringSystem='PBOT1'] - The scoring system to use
   * @returns {number} The score the note receives
   */
  static scoreNote(msTiming, scoringSystem = ScoringSystem.PBOT1) {
    const strategy = strategies[scoringSystem] || strategies[ScoringSystem.PBOT1];
    return strategy.scoreNote(msTiming);
  }

  /**
   * Determine the judgement a note receives under a given scoring system.
   * @param {number} msTiming - The difference between the note's time and when it was hit
   * @param {string} [scoringSystem='PBOT1'] - The scoring system to use
   * @returns {string} The judgement the note receives
   */
  static judgeNote(msTiming, scoringSystem = ScoringSystem.PBOT1) {
    const strategy = strategies[scoringSystem] || strategies[ScoringSystem.PBOT1];
    return strategy.judgeNote(msTiming);
  }

  /**
   * Get the miss score for a given scoring system.
   * @param {string} [scoringSystem='PBOT1'] - The scoring system to use
   * @returns {number} The miss score
   */
  static getMissScore(scoringSystem = ScoringSystem.PBOT1) {
    const strategy = strategies[scoringSystem] || strategies[ScoringSystem.PBOT1];
    return strategy.getMissScore();
  }

  /**
   * Calculate the rank based on score data.
   * @param {Tallies | null} tallies - The tally data from the song
   * @returns {string | null} The rank, or null if no valid data
   */
  static calculateRank(tallies) {
    if (!tallies || tallies.totalNotes === 0) {
      return null;
    }

    // Perfect Gold is a Sick Full Clear
    if (tallies.sick === tallies.totalNotes) {
      return ScoringRank.PERFECT_GOLD;
    }

    // Calculate completion amount
    const completion = this.tallyCompletion(tallies);

    if (completion >= Constants.RANK_PERFECT_THRESHOLD) {
      return ScoringRank.PERFECT;
    } else if (completion >= Constants.RANK_EXCELLENT_THRESHOLD) {
      return ScoringRank.EXCELLENT;
    } else if (completion >= Constants.RANK_GREAT_THRESHOLD) {
      return ScoringRank.GREAT;
    } else if (completion >= Constants.RANK_GOOD_THRESHOLD) {
      return ScoringRank.GOOD;
    } else {
      return ScoringRank.SHIT;
    }
  }

  /**
   * Calculate the completion percentage of a song.
   * Formula: (sick + good - missed) / totalNotes, clamped to [0, 1]
   * @param {Tallies | null} tallies - The tally data
   * @returns {number} Completion as a float between 0 and 1
   */
  static tallyCompletion(tallies) {
    if (!tallies || tallies.totalNotes === 0) {
      return 0;
    }

    const completion = (tallies.sick + tallies.good - tallies.missed) / tallies.totalNotes;
    return Math.max(0, Math.min(1, completion));
  }

  /**
   * Get the numeric value of a rank for comparison.
   * Higher values = better ranks.
   * @param {string | null} rank - The rank to evaluate
   * @returns {number} The numeric value (-1 if null/invalid)
   */
  static getRankValue(rank) {
    switch (rank) {
      case ScoringRank.PERFECT_GOLD:
        return 5;
      case ScoringRank.PERFECT:
        return 4;
      case ScoringRank.EXCELLENT:
        return 3;
      case ScoringRank.GREAT:
        return 2;
      case ScoringRank.GOOD:
        return 1;
      case ScoringRank.SHIT:
        return 0;
      default:
        return -1;
    }
  }

  /**
   * Compare two ranks.
   * @param {string | null} a - First rank
   * @param {string | null} b - Second rank
   * @returns {number} Negative if a < b, 0 if equal, positive if a > b
   */
  static compareRanks(a, b) {
    return this.getRankValue(a) - this.getRankValue(b);
  }

  /**
   * Check if a judgement breaks combo.
   * @param {string} judgement - The judgement to check
   * @returns {boolean} True if the judgement breaks combo
   */
  static doesJudgementBreakCombo(judgement) {
    switch (judgement) {
      case Judgement.KILLER:
        return Constants.JUDGEMENT_KILLER_COMBO_BREAK;
      case Judgement.SICK:
        return Constants.JUDGEMENT_SICK_COMBO_BREAK;
      case Judgement.GOOD:
        return Constants.JUDGEMENT_GOOD_COMBO_BREAK;
      case Judgement.BAD:
        return Constants.JUDGEMENT_BAD_COMBO_BREAK;
      case Judgement.SHIT:
        return Constants.JUDGEMENT_SHIT_COMBO_BREAK;
      case Judgement.MISS:
        return true;
      default:
        return false;
    }
  }

  /**
   * Get the health bonus/penalty for a judgement.
   * @param {string} judgement - The judgement
   * @returns {number} The health change amount
   */
  static getHealthBonus(judgement) {
    switch (judgement) {
      case Judgement.KILLER:
        return Constants.HEALTH_KILLER_BONUS;
      case Judgement.SICK:
        return Constants.HEALTH_SICK_BONUS;
      case Judgement.GOOD:
        return Constants.HEALTH_GOOD_BONUS;
      case Judgement.BAD:
        return Constants.HEALTH_BAD_BONUS;
      case Judgement.SHIT:
        return Constants.HEALTH_SHIT_BONUS;
      case Judgement.MISS:
        return Constants.HEALTH_MISS_PENALTY;
      default:
        return 0;
    }
  }

  // ========================================
  // TALLY UTILITIES
  // ========================================

  /**
   * Create a new empty tallies object.
   * @returns {Tallies} A fresh tallies object
   */
  static createTallies() {
    return {
      sick: 0,
      good: 0,
      bad: 0,
      shit: 0,
      missed: 0,
      combo: 0,
      maxCombo: 0,
      totalNotesHit: 0,
      totalNotes: 0,
      score: 0
    };
  }

  /**
   * Update tallies with a note hit.
   * @param {Tallies} tallies - The tallies to update
   * @param {string} judgement - The judgement received
   * @param {number} score - The score received
   * @returns {Tallies} The updated tallies
   */
  static updateTalliesOnHit(tallies, judgement, score) {
    // Update judgement count
    switch (judgement) {
      case Judgement.KILLER:
      case Judgement.SICK:
        tallies.sick++;
        break;
      case Judgement.GOOD:
        tallies.good++;
        break;
      case Judgement.BAD:
        tallies.bad++;
        break;
      case Judgement.SHIT:
        tallies.shit++;
        break;
    }

    // Update combo
    if (!this.doesJudgementBreakCombo(judgement)) {
      tallies.combo++;
      tallies.maxCombo = Math.max(tallies.maxCombo, tallies.combo);
    } else {
      tallies.combo = 0;
    }

    // Update totals
    tallies.totalNotesHit++;
    tallies.score = (tallies.score || 0) + score;

    return tallies;
  }

  /**
   * Update tallies with a note miss.
   * @param {Tallies} tallies - The tallies to update
   * @param {string} [scoringSystem='PBOT1'] - The scoring system to use
   * @returns {Tallies} The updated tallies
   */
  static updateTalliesOnMiss(tallies, scoringSystem = ScoringSystem.PBOT1) {
    tallies.missed++;
    tallies.combo = 0;
    tallies.score = (tallies.score || 0) + this.getMissScore(scoringSystem);

    return tallies;
  }
}

export default Scoring;

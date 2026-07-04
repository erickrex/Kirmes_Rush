/**
 * @fileoverview RhythmScoring - accuracy-first scoring for the rhythm minigame
 * framework. Unlike the FNF gameplay path (health + combo), a rhythm minigame
 * run is scored purely from the tally of per-category judgements and a resulting
 * accuracy value, which maps to a coarse Result_Band ("Superb" | "OK" |
 * "Try Again").
 *
 * The per-judgement timing categories (perfect/good/barely/miss/wrong) come from
 * the shared {@link Scoring} timing-window core used by the rest of the rhythm
 * framework; this module reuses that vocabulary and adds neutral accumulation
 * plus result bands. There is intentionally NO health meter or combo model.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (RhythmScoring section)
 * for the interface contract. Satisfies Requirements 10.1-10.5.
 */

/**
 * @typedef {import('../../types.js').JudgementCounts} JudgementCounts
 * @typedef {import('../../types.js').RhythmResultSummary} RhythmResultSummary
 * @typedef {import('../../types.js').ResultBand} ResultBand
 * @typedef {import('../../types.js').RhythmJudgement} RhythmJudgement
 * @typedef {import('../../types.js').MinigameScoringConfig} MinigameScoringConfig
 */

/**
 * Accuracy contribution of each judgement category. `perfect` is a full hit;
 * `good` and `barely` are partial credit; `miss` and `wrong` contribute nothing
 * but still count toward the total attempts (so they lower accuracy).
 * @type {Readonly<Record<RhythmJudgement, number>>}
 */
const ACCURACY_WEIGHTS = Object.freeze({
  perfect: 1.0,
  good: 0.65,
  barely: 0.3,
  miss: 0,
  wrong: 0
});

/**
 * Base point value awarded for a run at 100% accuracy per resolved judgement.
 * Score is derived from accuracy and the number of judgements rather than from a
 * health meter, keeping scoring accuracy-first (R10.4).
 * @type {number}
 */
const BASE_POINTS_PER_JUDGEMENT = 1000;

/** Default accuracy threshold (inclusive) for the "Superb" band. */
const DEFAULT_SUPERB_THRESHOLD = 0.9;

/** Default accuracy threshold (inclusive) for the "OK" band. */
const DEFAULT_OK_THRESHOLD = 0.6;

/**
 * Create a fresh, zeroed set of per-category judgement counts.
 * @returns {JudgementCounts} A new counts object with every category at 0.
 */
function createEmptyCounts() {
  return { perfect: 0, good: 0, barely: 0, miss: 0, wrong: 0 };
}

/**
 * Accuracy-first scoring accumulator for a single rhythm minigame run.
 *
 * Feed each {@link RhythmJudgement} produced by the CueJudger/CueScheduler into
 * {@link RhythmScoring#record}. At the end of a run read {@link RhythmScoring#accuracy},
 * {@link RhythmScoring#resultBand}, or {@link RhythmScoring#summary} to produce the
 * ResultState payload.
 */
class RhythmScoring {
  /**
   * @param {MinigameScoringConfig} [config={}] - Scoring configuration. Only the
   *   `bands` thresholds are used here; `windowMs` is consumed by the CueJudger.
   *   Missing thresholds fall back to the defaults (superb 0.9, ok 0.6).
   */
  constructor(config = {}) {
    const bands = config.bands;

    /**
     * Accuracy at or above which a run earns the "Superb" band.
     * @type {number}
     * @private
     */
    this._superbThreshold =
      typeof bands?.superb === 'number' ? bands.superb : DEFAULT_SUPERB_THRESHOLD;

    /**
     * Accuracy at or above which a run earns the "OK" band.
     * @type {number}
     * @private
     */
    this._okThreshold = typeof bands?.ok === 'number' ? bands.ok : DEFAULT_OK_THRESHOLD;

    /**
     * Running per-category judgement counts for this run.
     * @type {JudgementCounts}
     * @private
     */
    this._counts = createEmptyCounts();
  }

  /**
   * Record a single judgement, incrementing its per-category count (R10.1).
   * Unknown judgement categories are ignored so a caller cannot corrupt the tally.
   * @param {RhythmJudgement} judgement - The judged outcome to accumulate.
   * @returns {void}
   */
  record(judgement) {
    if (Object.prototype.hasOwnProperty.call(this._counts, judgement)) {
      this._counts[judgement] += 1;
    }
  }

  /**
   * The total number of judgements recorded across all categories.
   * @type {number}
   */
  get total() {
    const c = this._counts;
    return c.perfect + c.good + c.barely + c.miss + c.wrong;
  }

  /**
   * A shallow copy of the current per-category judgement counts.
   * @type {JudgementCounts}
   */
  get counts() {
    return { ...this._counts };
  }

  /**
   * Overall accuracy in the range [0, 1], computed as the weighted judgement
   * total divided by the number of judgements recorded (R10.2). A run with no
   * judgements has an accuracy of 0.
   * @type {number}
   */
  get accuracy() {
    const total = this.total;
    if (total === 0) {
      return 0;
    }

    const c = this._counts;
    const weighted =
      c.perfect * ACCURACY_WEIGHTS.perfect +
      c.good * ACCURACY_WEIGHTS.good +
      c.barely * ACCURACY_WEIGHTS.barely +
      c.miss * ACCURACY_WEIGHTS.miss +
      c.wrong * ACCURACY_WEIGHTS.wrong;

    return weighted / total;
  }

  /**
   * Score derived from accuracy and the number of judgements (R10.4). This is
   * intentionally not a health/combo model: it is simply the accuracy scaled by
   * the number of resolved judgements and a per-judgement base value.
   * @type {number}
   */
  get score() {
    return Math.round(this.accuracy * this.total * BASE_POINTS_PER_JUDGEMENT);
  }

  /**
   * The Result_Band derived from overall accuracy (R10.3). Thresholds are
   * inclusive: accuracy >= superb → "Superb", accuracy >= ok → "OK", otherwise
   * "Try Again".
   * @type {ResultBand}
   */
  get resultBand() {
    const accuracy = this.accuracy;
    if (accuracy >= this._superbThreshold) {
      return 'Superb';
    }
    if (accuracy >= this._okThreshold) {
      return 'OK';
    }
    return 'Try Again';
  }

  /**
   * Produce the end-of-run result summary containing the score, accuracy,
   * per-category counts, and Result_Band (R10.5).
   * @returns {RhythmResultSummary} The result summary payload for ResultState.
   */
  summary() {
    return {
      score: this.score,
      accuracy: this.accuracy,
      counts: this.counts,
      resultBand: this.resultBand
    };
  }
}

export default RhythmScoring;

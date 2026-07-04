/**
 * @fileoverview Unit tests for RhythmScoring, the accuracy-first scoring
 * accumulator for the rhythm minigame framework.
 *
 * Covers Requirements 10.1-10.5:
 * - per-category judgement counts increment on record (10.1)
 * - overall accuracy computed from counts (10.2)
 * - Result_Band derived from accuracy with configurable thresholds (10.3)
 * - score derived from accuracy and counts, not health/combo (10.4)
 * - summary shape: { score, accuracy, counts, resultBand } (10.5)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import RhythmScoring from '../src/rhythm/core/RhythmScoring.js';

describe('RhythmScoring', () => {
  /** @type {RhythmScoring} */
  let scoring;

  beforeEach(() => {
    scoring = new RhythmScoring();
  });

  describe('category counts (R10.1)', () => {
    it('starts with all categories at zero', () => {
      expect(scoring.counts).toEqual({
        perfect: 0,
        good: 0,
        barely: 0,
        miss: 0,
        wrong: 0
      });
      expect(scoring.total).toBe(0);
    });

    it('increments the count for each recorded judgement category', () => {
      scoring.record('perfect');
      scoring.record('perfect');
      scoring.record('good');
      scoring.record('barely');
      scoring.record('miss');
      scoring.record('wrong');

      expect(scoring.counts).toEqual({
        perfect: 2,
        good: 1,
        barely: 1,
        miss: 1,
        wrong: 1
      });
      expect(scoring.total).toBe(6);
    });

    it('ignores unknown judgement categories', () => {
      // @ts-expect-error - intentionally passing an invalid category
      scoring.record('bogus');
      expect(scoring.total).toBe(0);
      expect(scoring.counts).toEqual({
        perfect: 0,
        good: 0,
        barely: 0,
        miss: 0,
        wrong: 0
      });
    });

    it('returns a defensive copy of counts that cannot mutate internal state', () => {
      scoring.record('perfect');
      const snapshot = scoring.counts;
      snapshot.perfect = 999;
      expect(scoring.counts.perfect).toBe(1);
    });
  });

  describe('accuracy computation (R10.2)', () => {
    it('is 0 for a run with no judgements', () => {
      expect(scoring.accuracy).toBe(0);
    });

    it('is 1 when every judgement is perfect', () => {
      scoring.record('perfect');
      scoring.record('perfect');
      scoring.record('perfect');
      expect(scoring.accuracy).toBe(1);
    });

    it('is 0 when every judgement is a miss or wrong', () => {
      scoring.record('miss');
      scoring.record('wrong');
      expect(scoring.accuracy).toBe(0);
    });

    it('weights good and barely as partial credit', () => {
      // perfect(1.0) + good(0.65) + barely(0.3) + miss(0) over 4 attempts
      scoring.record('perfect');
      scoring.record('good');
      scoring.record('barely');
      scoring.record('miss');
      expect(scoring.accuracy).toBeCloseTo((1.0 + 0.65 + 0.3 + 0) / 4, 10);
    });

    it('lowers accuracy as misses and wrongs are added', () => {
      scoring.record('perfect');
      const before = scoring.accuracy;
      scoring.record('miss');
      expect(scoring.accuracy).toBeLessThan(before);
    });
  });

  describe('band thresholds (R10.3)', () => {
    it('returns "Superb" at or above the superb threshold', () => {
      // all perfect => accuracy 1.0 >= 0.9
      scoring.record('perfect');
      scoring.record('perfect');
      expect(scoring.resultBand).toBe('Superb');
    });

    it('returns "OK" between the ok and superb thresholds', () => {
      // 2 perfect + 2 good => (2 + 1.3) / 4 = 0.825, in [0.6, 0.9)
      scoring.record('perfect');
      scoring.record('perfect');
      scoring.record('good');
      scoring.record('good');
      expect(scoring.accuracy).toBeGreaterThanOrEqual(0.6);
      expect(scoring.accuracy).toBeLessThan(0.9);
      expect(scoring.resultBand).toBe('OK');
    });

    it('returns "Try Again" below the ok threshold', () => {
      // 1 perfect + 3 miss => 1 / 4 = 0.25 < 0.6
      scoring.record('perfect');
      scoring.record('miss');
      scoring.record('miss');
      scoring.record('miss');
      expect(scoring.resultBand).toBe('Try Again');
    });

    it('respects custom band thresholds from config', () => {
      const strict = new RhythmScoring({ bands: { superb: 0.99, ok: 0.8 } });
      // 3 perfect + 1 good => (3 + 0.65) / 4 = 0.9125
      strict.record('perfect');
      strict.record('perfect');
      strict.record('perfect');
      strict.record('good');
      // 0.9125 < 0.99 but >= 0.8 => OK under strict thresholds
      expect(strict.resultBand).toBe('OK');
    });

    it('treats thresholds as inclusive lower bounds', () => {
      const custom = new RhythmScoring({ bands: { superb: 0.65, ok: 0.3 } });
      // single good => accuracy exactly 0.65 => Superb (inclusive)
      custom.record('good');
      expect(custom.accuracy).toBeCloseTo(0.65, 10);
      expect(custom.resultBand).toBe('Superb');
    });
  });

  describe('score computation (R10.4)', () => {
    it('is 0 for a run with no judgements', () => {
      expect(scoring.score).toBe(0);
    });

    it('scales with accuracy and the number of judgements', () => {
      scoring.record('perfect');
      scoring.record('perfect');
      // accuracy 1.0 * 2 judgements * 1000 base = 2000
      expect(scoring.score).toBe(2000);
    });

    it('is lower for a less accurate run of the same length', () => {
      const good = new RhythmScoring();
      good.record('perfect');
      good.record('perfect');

      const worse = new RhythmScoring();
      worse.record('perfect');
      worse.record('miss');

      expect(worse.score).toBeLessThan(good.score);
    });

    it('returns an integer score', () => {
      scoring.record('good');
      scoring.record('barely');
      scoring.record('miss');
      expect(Number.isInteger(scoring.score)).toBe(true);
    });
  });

  describe('summary shape (R10.5)', () => {
    it('produces { score, accuracy, counts, resultBand }', () => {
      scoring.record('perfect');
      scoring.record('good');
      scoring.record('miss');

      const summary = scoring.summary();

      expect(Object.keys(summary).sort()).toEqual(
        ['accuracy', 'counts', 'resultBand', 'score'].sort()
      );
      expect(summary.score).toBe(scoring.score);
      expect(summary.accuracy).toBe(scoring.accuracy);
      expect(summary.counts).toEqual(scoring.counts);
      expect(summary.resultBand).toBe(scoring.resultBand);
    });

    it('summary counts are a snapshot decoupled from later records', () => {
      scoring.record('perfect');
      const summary = scoring.summary();
      scoring.record('miss');
      expect(summary.counts.perfect).toBe(1);
      expect(summary.counts.miss).toBe(0);
    });
  });
});

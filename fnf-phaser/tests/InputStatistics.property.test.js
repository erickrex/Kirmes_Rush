/**
 * @fileoverview Property-based tests for the InputStatistics class.
 * Tests input timing statistics tracking using fast-check.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import InputStatistics from '../src/input/InputStatistics.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Valid judgement types
const JUDGEMENT_TYPES = ['killer', 'sick', 'good', 'bad', 'shit'];

// Arbitraries for generating test data
const offsetArb = fc.integer({ min: -100, max: 100 });
const judgementArb = fc.constantFrom(...JUDGEMENT_TYPES);

// Generate a hit record with offset and judgement
const hitRecordArb = fc.record({
  offset: offsetArb,
  judgement: judgementArb
});

// Generate an array of hit records
const hitRecordsArb = fc.array(hitRecordArb, { minLength: 1, maxLength: 100 });

// Generate non-empty array of offsets
const nonEmptyOffsetsArb = fc.array(offsetArb, { minLength: 1, maxLength: 100 });

describe('InputStatistics Property Tests', () => {
  /**
   * Property 19: Input Statistics Offset Tracking
   * For any hit recorded with timing offset O and judgement J, the offset SHALL be
   * added to the offsets array and to the byJudgement[J] array.
   */
  describe('Property 19: Input Statistics Offset Tracking', () => {
    it('offset SHALL be added to offsets array', () => {
      fc.assert(
        fc.property(offsetArb, judgementArb, (offset, judgement) => {
          const stats = new InputStatistics();
          stats.recordHit(offset, judgement);
          expect(stats.offsets).toContain(offset);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('offset SHALL be added to byJudgement[J] array', () => {
      fc.assert(
        fc.property(offsetArb, judgementArb, (offset, judgement) => {
          const stats = new InputStatistics();
          stats.recordHit(offset, judgement);
          expect(stats.byJudgement[judgement]).toContain(offset);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple hits SHALL all be tracked in offsets array', () => {
      fc.assert(
        fc.property(hitRecordsArb, (hits) => {
          const stats = new InputStatistics();
          for (const hit of hits) {
            stats.recordHit(hit.offset, hit.judgement);
          }
          expect(stats.offsets.length).toBe(hits.length);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 20: Input Statistics Average Calculation
   * For any non-empty set of recorded offsets, getStats().averageOffset SHALL equal
   * the sum of all offsets divided by the count of offsets.
   */
  describe('Property 20: Input Statistics Average Calculation', () => {
    it('averageOffset SHALL equal sum / count for non-empty offsets', () => {
      fc.assert(
        fc.property(nonEmptyOffsetsArb, judgementArb, (offsets, judgement) => {
          const stats = new InputStatistics();
          for (const offset of offsets) {
            stats.recordHit(offset, judgement);
          }
          const result = stats.getStats();
          const sum = offsets.reduce((acc, val) => acc + val, 0);
          const expectedAverage = sum / offsets.length;
          expect(result.averageOffset).toBeCloseTo(expectedAverage, 10);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('averageOffset SHALL be zero for empty stats', () => {
      const stats = new InputStatistics();
      const result = stats.getStats();
      expect(result.averageOffset).toBe(0);
    });
  });

  /**
   * Property 21: Input Statistics Early/Late Ratio
   * For any set of recorded offsets, getEarlyLateRatio() SHALL return
   * { early: count of negative offsets, late: count of positive offsets, perfect: count of zero offsets }
   * where early + late + perfect equals total hits.
   */
  describe('Property 21: Input Statistics Early/Late Ratio', () => {
    it('early + late + perfect SHALL equal total hits', () => {
      fc.assert(
        fc.property(hitRecordsArb, (hits) => {
          const stats = new InputStatistics();
          for (const hit of hits) {
            stats.recordHit(hit.offset, hit.judgement);
          }
          const ratio = stats.getEarlyLateRatio();
          expect(ratio.early + ratio.late + ratio.perfect).toBe(hits.length);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('early SHALL equal count of negative offsets', () => {
      fc.assert(
        fc.property(hitRecordsArb, (hits) => {
          const stats = new InputStatistics();
          for (const hit of hits) {
            stats.recordHit(hit.offset, hit.judgement);
          }
          const ratio = stats.getEarlyLateRatio();
          const expectedEarly = hits.filter((h) => h.offset < 0).length;
          expect(ratio.early).toBe(expectedEarly);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('late SHALL equal count of positive offsets', () => {
      fc.assert(
        fc.property(hitRecordsArb, (hits) => {
          const stats = new InputStatistics();
          for (const hit of hits) {
            stats.recordHit(hit.offset, hit.judgement);
          }
          const ratio = stats.getEarlyLateRatio();
          const expectedLate = hits.filter((h) => h.offset > 0).length;
          expect(ratio.late).toBe(expectedLate);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('perfect SHALL equal count of zero offsets', () => {
      fc.assert(
        fc.property(hitRecordsArb, (hits) => {
          const stats = new InputStatistics();
          for (const hit of hits) {
            stats.recordHit(hit.offset, hit.judgement);
          }
          const ratio = stats.getEarlyLateRatio();
          const expectedPerfect = hits.filter((h) => h.offset === 0).length;
          expect(ratio.perfect).toBe(expectedPerfect);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

/**
 * @fileoverview Property-based tests for the NPSMeter class.
 * Tests notes-per-second tracking using fast-check.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import NPSMeter from '../src/play/NPSMeter.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Arbitraries for generating test data
const timestampArb = fc.integer({ min: 0, max: 100000 });
const startTimeArb = fc.integer({ min: 0, max: 50000 });
const durationArb = fc.integer({ min: 1, max: 50000 }); // Duration in ms (at least 1ms to avoid division by zero)

// Generate a sequence of hit timestamps
const hitSequenceArb = fc.array(timestampArb, { minLength: 0, maxLength: 50 });

// Generate a sorted sequence of hit timestamps (for realistic gameplay)
const sortedHitSequenceArb = fc.array(timestampArb, { minLength: 0, maxLength: 50 })
  .map(arr => [...arr].sort((a, b) => a - b));

// Generate hits within a specific time window
const hitsInWindowArb = (windowStart, windowEnd) =>
  fc.array(
    fc.integer({ min: windowStart, max: windowEnd }),
    { minLength: 0, maxLength: 30 }
  );

describe('NPSMeter Property Tests', () => {
  /**
   * Property 22: NPS Sliding Window Calculation
   * For any set of hits with timestamps, currentNPS SHALL equal the count of hits
   * within the last 1000ms window from the current time.
   */
  describe('Property 22: NPS Sliding Window Calculation', () => {
    it('currentNPS SHALL equal count of hits within last 1000ms window', () => {
      fc.assert(
        fc.property(
          startTimeArb,
          hitSequenceArb,
          fc.integer({ min: 0, max: 100000 }), // currentTime
          (startTime, hits, currentTime) => {
            const meter = new NPSMeter(startTime);

            // Record all hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            // Update at current time
            meter.update(currentTime);

            // Calculate expected NPS: count of hits where time > (currentTime - 1000)
            const windowStart = currentTime - 1000;
            const expectedNPS = hits.filter(time => time > windowStart).length;

            expect(meter.currentNPS).toBe(expectedNPS);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('hits exactly at window boundary SHALL be excluded', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 50000 }), // currentTime (at least 1000 to have valid window)
          fc.integer({ min: 1, max: 20 }), // number of hits at boundary
          fc.integer({ min: 1, max: 20 }), // number of hits inside window
          (currentTime, boundaryHitCount, insideHitCount) => {
            const meter = new NPSMeter(0);
            const windowStart = currentTime - 1000;

            // Add hits exactly at window boundary (should be excluded)
            for (let i = 0; i < boundaryHitCount; i++) {
              meter.recordHit(windowStart);
            }

            // Add hits inside window (should be included)
            for (let i = 0; i < insideHitCount; i++) {
              meter.recordHit(windowStart + 500); // 500ms inside window
            }

            meter.update(currentTime);

            // Only hits inside window should be counted
            expect(meter.currentNPS).toBe(insideHitCount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('sliding window SHALL move with current time', () => {
      fc.assert(
        fc.property(
          sortedHitSequenceArb,
          fc.integer({ min: 1000, max: 50000 }), // time1
          fc.integer({ min: 0, max: 5000 }), // time delta
          (hits, time1, timeDelta) => {
            const meter = new NPSMeter(0);
            const time2 = time1 + timeDelta;

            // Record all hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            // Update at time1
            meter.update(time1);
            const npsAtTime1 = meter.currentNPS;

            // Calculate expected NPS at time1
            const expectedNPS1 = hits.filter(t => t > time1 - 1000).length;
            expect(npsAtTime1).toBe(expectedNPS1);

            // Update at time2
            meter.update(time2);
            const npsAtTime2 = meter.currentNPS;

            // Calculate expected NPS at time2
            const expectedNPS2 = hits.filter(t => t > time2 - 1000).length;
            expect(npsAtTime2).toBe(expectedNPS2);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('empty window SHALL result in zero NPS', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          fc.integer({ min: 2000, max: 100000 }), // currentTime far enough from hits
          (hits, currentTime) => {
            const meter = new NPSMeter(0);

            // Record hits that will all be outside the window
            for (const hitTime of hits) {
              // Ensure all hits are before the window
              const adjustedHitTime = Math.min(hitTime, currentTime - 1001);
              meter.recordHit(adjustedHitTime);
            }

            meter.update(currentTime);

            // All hits should be outside window
            expect(meter.currentNPS).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 23: NPS Peak Tracking
   * For any sequence of NPS updates, peakNPS SHALL always be greater than or equal
   * to currentNPS and SHALL equal the maximum currentNPS ever observed.
   */
  describe('Property 23: NPS Peak Tracking', () => {
    it('peakNPS SHALL always be >= currentNPS', () => {
      fc.assert(
        fc.property(
          sortedHitSequenceArb,
          fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 20 }), // update times
          (hits, updateTimes) => {
            const meter = new NPSMeter(0);

            // Record all hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            // Update at each time and verify invariant
            for (const updateTime of updateTimes) {
              meter.update(updateTime);
              expect(meter.peakNPS).toBeGreaterThanOrEqual(meter.currentNPS);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('peakNPS SHALL equal maximum currentNPS ever observed', () => {
      fc.assert(
        fc.property(
          sortedHitSequenceArb,
          fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 20 }), // update times
          (hits, updateTimes) => {
            const meter = new NPSMeter(0);

            // Record all hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            // Track maximum NPS observed
            let maxNPSObserved = 0;

            // Update at each time and track max
            for (const updateTime of updateTimes) {
              meter.update(updateTime);
              maxNPSObserved = Math.max(maxNPSObserved, meter.currentNPS);
            }

            expect(meter.peakNPS).toBe(maxNPSObserved);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('peakNPS SHALL never decrease', () => {
      fc.assert(
        fc.property(
          sortedHitSequenceArb,
          fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 2, maxLength: 20 }), // update times
          (hits, updateTimes) => {
            const meter = new NPSMeter(0);

            // Record all hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            let previousPeak = 0;

            // Update at each time and verify peak never decreases
            for (const updateTime of updateTimes) {
              meter.update(updateTime);
              expect(meter.peakNPS).toBeGreaterThanOrEqual(previousPeak);
              previousPeak = meter.peakNPS;
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('peakNPS SHALL update when currentNPS exceeds it', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // first burst size
          fc.integer({ min: 1, max: 10 }), // second burst size (larger)
          (firstBurstSize, secondBurstSizeExtra) => {
            const meter = new NPSMeter(0);
            const secondBurstSize = firstBurstSize + secondBurstSizeExtra;

            // First burst of hits
            for (let i = 0; i < firstBurstSize; i++) {
              meter.recordHit(100 + i * 10);
            }
            meter.update(500);
            expect(meter.peakNPS).toBe(firstBurstSize);

            // Second burst (larger) after first expires
            for (let i = 0; i < secondBurstSize; i++) {
              meter.recordHit(2000 + i * 10);
            }
            meter.update(2500);
            expect(meter.peakNPS).toBe(secondBurstSize);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 24: NPS Update on Hit
   * For any hit recorded at time T, after calling recordHit(T) and update(T),
   * currentNPS SHALL include that hit in its count.
   */
  describe('Property 24: NPS Update on Hit', () => {
    it('hit recorded at time T SHALL be included after recordHit(T) and update(T)', () => {
      fc.assert(
        fc.property(
          startTimeArb,
          timestampArb,
          (startTime, hitTime) => {
            const meter = new NPSMeter(startTime);

            // Record hit and update at same time
            meter.recordHit(hitTime);
            meter.update(hitTime);

            // The hit should be included in currentNPS
            expect(meter.currentNPS).toBeGreaterThanOrEqual(1);
            expect(meter.recentHits).toContain(hitTime);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple hits at same time SHALL all be counted', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: 10 }), // number of hits at same time
          (hitTime, hitCount) => {
            const meter = new NPSMeter(0);

            // Record multiple hits at same timestamp
            for (let i = 0; i < hitCount; i++) {
              meter.recordHit(hitTime);
            }
            meter.update(hitTime);

            // All hits should be counted
            expect(meter.currentNPS).toBe(hitCount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('hit SHALL be included immediately after recording', () => {
      fc.assert(
        fc.property(
          sortedHitSequenceArb,
          fc.integer({ min: 0, max: 100000 }), // new hit time
          (existingHits, newHitTime) => {
            const meter = new NPSMeter(0);

            // Record existing hits
            for (const hitTime of existingHits) {
              meter.recordHit(hitTime);
            }

            // Update to establish baseline
            meter.update(newHitTime);
            const npsBefore = meter.currentNPS;

            // Record new hit and update
            meter.recordHit(newHitTime);
            meter.update(newHitTime);
            const npsAfter = meter.currentNPS;

            // NPS should increase by 1 (the new hit is always in window when update time equals hit time)
            expect(npsAfter).toBe(npsBefore + 1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('totalHits SHALL increment for each recordHit call', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          (hits) => {
            const meter = new NPSMeter(0);

            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            expect(meter.totalHits).toBe(hits.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 25: NPS Average Calculation
   * For any song with total hits H and duration D seconds, getAverageNPS()
   * SHALL equal H / D.
   */
  describe('Property 25: NPS Average Calculation', () => {
    it('getAverageNPS() SHALL equal totalHits / duration in seconds', () => {
      fc.assert(
        fc.property(
          startTimeArb,
          hitSequenceArb,
          durationArb,
          (startTime, hits, durationMs) => {
            const meter = new NPSMeter(startTime);
            const currentTime = startTime + durationMs;

            // Record all hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            const averageNPS = meter.getAverageNPS(currentTime);
            const durationSeconds = durationMs / 1000;
            const expectedAverage = hits.length / durationSeconds;

            expect(averageNPS).toBeCloseTo(expectedAverage, 10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getAverageNPS() SHALL return 0 for zero duration', () => {
      fc.assert(
        fc.property(
          startTimeArb,
          hitSequenceArb,
          (startTime, hits) => {
            const meter = new NPSMeter(startTime);

            // Record hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            // Query at start time (zero duration)
            const averageNPS = meter.getAverageNPS(startTime);
            expect(averageNPS).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getAverageNPS() SHALL return 0 for negative duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 50000 }), // startTime
          hitSequenceArb,
          fc.integer({ min: 1, max: 1000 }), // negative offset
          (startTime, hits, negativeOffset) => {
            const meter = new NPSMeter(startTime);

            // Record hits
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            // Query before start time (negative duration)
            const currentTime = startTime - negativeOffset;
            const averageNPS = meter.getAverageNPS(currentTime);
            expect(averageNPS).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getAverageNPS() SHALL be independent of hit distribution', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // hit count
          fc.integer({ min: 1000, max: 10000 }), // duration in ms
          (hitCount, durationMs) => {
            const meter1 = new NPSMeter(0);
            const meter2 = new NPSMeter(0);

            // Meter 1: hits evenly distributed
            for (let i = 0; i < hitCount; i++) {
              meter1.recordHit(i * (durationMs / hitCount));
            }

            // Meter 2: all hits at the beginning
            for (let i = 0; i < hitCount; i++) {
              meter2.recordHit(i);
            }

            const avg1 = meter1.getAverageNPS(durationMs);
            const avg2 = meter2.getAverageNPS(durationMs);

            // Both should have same average (same hit count, same duration)
            expect(avg1).toBeCloseTo(avg2, 10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getAverageNPS() SHALL scale linearly with hit count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // base hit count
          fc.integer({ min: 2, max: 5 }), // multiplier
          fc.integer({ min: 1000, max: 10000 }), // duration in ms
          (baseHitCount, multiplier, durationMs) => {
            const meter1 = new NPSMeter(0);
            const meter2 = new NPSMeter(0);

            // Meter 1: base hits
            for (let i = 0; i < baseHitCount; i++) {
              meter1.recordHit(i * 100);
            }

            // Meter 2: multiplied hits
            for (let i = 0; i < baseHitCount * multiplier; i++) {
              meter2.recordHit(i * 100);
            }

            const avg1 = meter1.getAverageNPS(durationMs);
            const avg2 = meter2.getAverageNPS(durationMs);

            // Average should scale linearly
            expect(avg2).toBeCloseTo(avg1 * multiplier, 10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getAverageNPS() SHALL scale inversely with duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // hit count
          fc.integer({ min: 1000, max: 5000 }), // base duration in ms
          fc.integer({ min: 2, max: 5 }), // duration multiplier
          (hitCount, baseDurationMs, durationMultiplier) => {
            const meter = new NPSMeter(0);

            // Record hits
            for (let i = 0; i < hitCount; i++) {
              meter.recordHit(i * 100);
            }

            const avgShort = meter.getAverageNPS(baseDurationMs);
            const avgLong = meter.getAverageNPS(baseDurationMs * durationMultiplier);

            // Average should scale inversely with duration
            expect(avgLong).toBeCloseTo(avgShort / durationMultiplier, 10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional invariant tests for NPSMeter
   */
  describe('NPSMeter Invariants', () => {
    it('totalHits SHALL always equal sum of all recorded hits', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 0, maxLength: 10 }), // update times
          (hits, updateTimes) => {
            const meter = new NPSMeter(0);

            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            // Updates should not affect totalHits
            for (const updateTime of updateTimes) {
              meter.update(updateTime);
            }

            expect(meter.totalHits).toBe(hits.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('reset SHALL clear all state', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          fc.integer({ min: 0, max: 100000 }), // update time
          fc.integer({ min: 0, max: 50000 }), // new start time
          (hits, updateTime, newStartTime) => {
            const meter = new NPSMeter(0);

            // Record hits and update
            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }
            meter.update(updateTime);

            // Reset
            meter.reset(newStartTime);

            // All state should be cleared
            expect(meter.recentHits).toEqual([]);
            expect(meter.currentNPS).toBe(0);
            expect(meter.peakNPS).toBe(0);
            expect(meter.totalHits).toBe(0);
            expect(meter.startTime).toBe(newStartTime);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('currentNPS SHALL never exceed totalHits', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          fc.integer({ min: 0, max: 100000 }), // update time
          (hits, updateTime) => {
            const meter = new NPSMeter(0);

            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }
            meter.update(updateTime);

            expect(meter.currentNPS).toBeLessThanOrEqual(meter.totalHits);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('peakNPS SHALL never exceed totalHits', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 10 }), // update times
          (hits, updateTimes) => {
            const meter = new NPSMeter(0);

            for (const hitTime of hits) {
              meter.recordHit(hitTime);
            }

            for (const updateTime of updateTimes) {
              meter.update(updateTime);
            }

            expect(meter.peakNPS).toBeLessThanOrEqual(meter.totalHits);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

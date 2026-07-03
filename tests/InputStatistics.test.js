/**
 * @fileoverview Unit tests for the InputStatistics class.
 * Tests input timing statistics tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import InputStatistics from '../src/input/InputStatistics.js';

describe('InputStatistics', () => {
  let stats;

  beforeEach(() => {
    stats = new InputStatistics();
  });

  describe('constructor', () => {
    it('should start with empty offsets array', () => {
      expect(stats.offsets).toEqual([]);
    });

    it('should start with empty byJudgement arrays', () => {
      expect(stats.byJudgement.killer).toEqual([]);
      expect(stats.byJudgement.sick).toEqual([]);
      expect(stats.byJudgement.good).toEqual([]);
      expect(stats.byJudgement.bad).toEqual([]);
      expect(stats.byJudgement.shit).toEqual([]);
    });

    it('should have zero total hits', () => {
      expect(stats.totalHits).toBe(0);
    });
  });

  describe('recordHit', () => {
    it('should add offset to offsets array', () => {
      stats.recordHit(-10, 'sick');
      expect(stats.offsets).toContain(-10);
    });

    it('should add offset to correct judgement array', () => {
      stats.recordHit(-5, 'sick');
      expect(stats.byJudgement.sick).toContain(-5);
    });

    it('should handle all judgement types', () => {
      stats.recordHit(-2, 'killer');
      stats.recordHit(-5, 'sick');
      stats.recordHit(-15, 'good');
      stats.recordHit(-30, 'bad');
      stats.recordHit(-50, 'shit');

      expect(stats.byJudgement.killer).toContain(-2);
      expect(stats.byJudgement.sick).toContain(-5);
      expect(stats.byJudgement.good).toContain(-15);
      expect(stats.byJudgement.bad).toContain(-30);
      expect(stats.byJudgement.shit).toContain(-50);
    });

    it('should handle case-insensitive judgement names', () => {
      stats.recordHit(-5, 'SICK');
      stats.recordHit(-10, 'Good');
      expect(stats.byJudgement.sick).toContain(-5);
      expect(stats.byJudgement.good).toContain(-10);
    });

    it('should increment total hits', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(-5, 'sick');
      stats.recordHit(5, 'good');
      expect(stats.totalHits).toBe(3);
    });

    it('should record early hits (negative offset)', () => {
      stats.recordHit(-25, 'good');
      expect(stats.offsets[0]).toBe(-25);
    });

    it('should record late hits (positive offset)', () => {
      stats.recordHit(15, 'good');
      expect(stats.offsets[0]).toBe(15);
    });

    it('should record perfect hits (zero offset)', () => {
      stats.recordHit(0, 'sick');
      expect(stats.offsets[0]).toBe(0);
    });

    it('should handle multiple hits for same judgement', () => {
      stats.recordHit(-5, 'sick');
      stats.recordHit(-3, 'sick');
      stats.recordHit(-8, 'sick');
      expect(stats.byJudgement.sick).toEqual([-5, -3, -8]);
    });
  });

  describe('getStats', () => {
    it('should return zero average for empty stats', () => {
      const result = stats.getStats();
      expect(result.averageOffset).toBe(0);
    });

    it('should calculate correct average offset', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(-20, 'good');
      stats.recordHit(10, 'good');
      // Average: (-10 + -20 + 10) / 3 = -20/3 ≈ -6.67
      const result = stats.getStats();
      expect(result.averageOffset).toBeCloseTo(-6.67, 1);
    });

    it('should count early hits correctly', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(-5, 'sick');
      stats.recordHit(5, 'good');
      const result = stats.getStats();
      expect(result.earlyCount).toBe(2);
    });

    it('should count late hits correctly', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(5, 'good');
      stats.recordHit(15, 'good');
      const result = stats.getStats();
      expect(result.lateCount).toBe(2);
    });

    it('should count perfect hits correctly', () => {
      stats.recordHit(0, 'sick');
      stats.recordHit(0, 'sick');
      stats.recordHit(-5, 'good');
      const result = stats.getStats();
      expect(result.perfectCount).toBe(2);
    });

    it('should return copy of offsets array', () => {
      stats.recordHit(-10, 'sick');
      const result = stats.getStats();
      result.offsets.push(999);
      expect(stats.offsets).not.toContain(999);
    });

    it('should calculate per-judgement stats', () => {
      stats.recordHit(-5, 'sick');
      stats.recordHit(-10, 'sick');
      stats.recordHit(-20, 'good');

      const result = stats.getStats();
      expect(result.byJudgement.sick.count).toBe(2);
      expect(result.byJudgement.sick.avgOffset).toBe(-7.5);
      expect(result.byJudgement.good.count).toBe(1);
      expect(result.byJudgement.good.avgOffset).toBe(-20);
    });

    it('should return zero avgOffset for empty judgement', () => {
      stats.recordHit(-5, 'sick');
      const result = stats.getStats();
      expect(result.byJudgement.good.count).toBe(0);
      expect(result.byJudgement.good.avgOffset).toBe(0);
    });
  });

  describe('getEarlyLateRatio', () => {
    it('should return zeros for empty stats', () => {
      const result = stats.getEarlyLateRatio();
      expect(result.early).toBe(0);
      expect(result.late).toBe(0);
      expect(result.perfect).toBe(0);
    });

    it('should count early hits (negative offset)', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(-5, 'sick');
      stats.recordHit(-1, 'sick');
      const result = stats.getEarlyLateRatio();
      expect(result.early).toBe(3);
    });

    it('should count late hits (positive offset)', () => {
      stats.recordHit(10, 'good');
      stats.recordHit(5, 'good');
      const result = stats.getEarlyLateRatio();
      expect(result.late).toBe(2);
    });

    it('should count perfect hits (zero offset)', () => {
      stats.recordHit(0, 'sick');
      stats.recordHit(0, 'sick');
      const result = stats.getEarlyLateRatio();
      expect(result.perfect).toBe(2);
    });

    it('should have early + late + perfect equal total hits', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(0, 'sick');
      stats.recordHit(5, 'good');
      stats.recordHit(-3, 'good');
      stats.recordHit(0, 'sick');

      const result = stats.getEarlyLateRatio();
      expect(result.early + result.late + result.perfect).toBe(stats.totalHits);
    });
  });

  describe('getDistribution', () => {
    it('should return empty object for no hits', () => {
      const result = stats.getDistribution();
      expect(Object.keys(result).length).toBe(0);
    });

    it('should bucket offsets correctly with default bucket size', () => {
      stats.recordHit(-5, 'sick');
      stats.recordHit(-15, 'good');
      stats.recordHit(5, 'good');

      const result = stats.getDistribution();
      expect(result['-10to0']).toBe(1);
      expect(result['-20to-10']).toBe(1);
      expect(result['0to10']).toBe(1);
    });

    it('should use custom bucket size', () => {
      stats.recordHit(-5, 'sick');
      stats.recordHit(-15, 'good');

      const result = stats.getDistribution(20);
      expect(result['-20to0']).toBe(2);
    });

    it('should count multiple hits in same bucket', () => {
      stats.recordHit(-5, 'sick');
      stats.recordHit(-8, 'sick');
      stats.recordHit(-3, 'sick');

      const result = stats.getDistribution();
      expect(result['-10to0']).toBe(3);
    });
  });

  describe('reset', () => {
    it('should clear offsets array', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(-5, 'good');
      stats.reset();
      expect(stats.offsets).toEqual([]);
    });

    it('should clear all byJudgement arrays', () => {
      stats.recordHit(-5, 'sick');
      stats.recordHit(-10, 'good');
      stats.recordHit(-20, 'bad');
      stats.reset();

      expect(stats.byJudgement.killer).toEqual([]);
      expect(stats.byJudgement.sick).toEqual([]);
      expect(stats.byJudgement.good).toEqual([]);
      expect(stats.byJudgement.bad).toEqual([]);
      expect(stats.byJudgement.shit).toEqual([]);
    });

    it('should reset total hits to zero', () => {
      stats.recordHit(-10, 'sick');
      stats.recordHit(-5, 'good');
      stats.reset();
      expect(stats.totalHits).toBe(0);
    });

    it('should allow recording new hits after reset', () => {
      stats.recordHit(-10, 'sick');
      stats.reset();
      stats.recordHit(-5, 'good');

      expect(stats.totalHits).toBe(1);
      expect(stats.offsets).toEqual([-5]);
      expect(stats.byJudgement.good).toEqual([-5]);
    });
  });

  describe('edge cases', () => {
    it('should handle very large offsets', () => {
      stats.recordHit(-1000, 'shit');
      stats.recordHit(1000, 'shit');

      const result = stats.getStats();
      expect(result.averageOffset).toBe(0);
    });

    it('should handle decimal offsets', () => {
      stats.recordHit(-5.5, 'sick');
      stats.recordHit(-4.5, 'sick');

      const result = stats.getStats();
      expect(result.averageOffset).toBe(-5);
    });

    it('should handle many hits', () => {
      for (let i = 0; i < 1000; i++) {
        stats.recordHit(i % 2 === 0 ? -5 : 5, 'sick');
      }

      expect(stats.totalHits).toBe(1000);
      const ratio = stats.getEarlyLateRatio();
      expect(ratio.early).toBe(500);
      expect(ratio.late).toBe(500);
    });

    it('should handle unknown judgement gracefully', () => {
      // Unknown judgement should still record offset but not add to byJudgement
      stats.recordHit(-10, 'unknown');
      expect(stats.offsets).toContain(-10);
      expect(stats.totalHits).toBe(1);
    });
  });
});

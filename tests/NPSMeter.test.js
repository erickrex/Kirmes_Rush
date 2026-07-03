/**
 * @fileoverview Unit tests for the NPSMeter class.
 * Tests notes-per-second tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import NPSMeter from '../src/play/NPSMeter.js';

describe('NPSMeter', () => {
  let meter;

  beforeEach(() => {
    meter = new NPSMeter(0);
  });

  describe('constructor', () => {
    it('should start with empty recentHits array', () => {
      expect(meter.recentHits).toEqual([]);
    });

    it('should start with zero currentNPS', () => {
      expect(meter.currentNPS).toBe(0);
    });

    it('should start with zero peakNPS', () => {
      expect(meter.peakNPS).toBe(0);
    });

    it('should start with zero totalHits', () => {
      expect(meter.totalHits).toBe(0);
    });

    it('should set startTime from constructor argument', () => {
      const meterWithStart = new NPSMeter(1000);
      expect(meterWithStart.startTime).toBe(1000);
    });

    it('should default startTime to 0', () => {
      const meterDefault = new NPSMeter();
      expect(meterDefault.startTime).toBe(0);
    });

    it('should have 1000ms window size', () => {
      expect(meter.windowMs).toBe(1000);
    });
  });

  describe('recordHit', () => {
    it('should add timestamp to recentHits array', () => {
      meter.recordHit(500);
      expect(meter.recentHits).toContain(500);
    });

    it('should increment totalHits', () => {
      meter.recordHit(500);
      meter.recordHit(600);
      meter.recordHit(700);
      expect(meter.totalHits).toBe(3);
    });

    it('should record multiple hits at same timestamp', () => {
      meter.recordHit(500);
      meter.recordHit(500);
      expect(meter.recentHits.length).toBe(2);
      expect(meter.totalHits).toBe(2);
    });

    it('should record hits in order', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);
      expect(meter.recentHits).toEqual([100, 200, 300]);
    });
  });

  describe('update - sliding window calculation (Requirement 7.1)', () => {
    it('should calculate NPS as count of hits within 1-second window', () => {
      // Add 5 hits within the last second
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);
      meter.recordHit(400);
      meter.recordHit(500);

      meter.update(600);
      expect(meter.currentNPS).toBe(5);
    });

    it('should remove hits outside the sliding window', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(1500);

      // At time 1600, hits at 100 and 200 are outside the 1-second window
      meter.update(1600);
      expect(meter.currentNPS).toBe(1);
      expect(meter.recentHits).toEqual([1500]);
    });

    it('should include hits exactly at window boundary', () => {
      meter.recordHit(500);
      meter.recordHit(1000);

      // At time 1500, hit at 500 is exactly at boundary (1500 - 1000 = 500)
      // Window is (currentTime - windowMs, currentTime] so 500 is excluded
      meter.update(1500);
      expect(meter.currentNPS).toBe(1);
    });

    it('should handle empty window', () => {
      meter.recordHit(100);

      // At time 2000, hit at 100 is outside the window
      meter.update(2000);
      expect(meter.currentNPS).toBe(0);
    });

    it('should handle rapid hits within window', () => {
      // Simulate 10 hits in 100ms
      for (let i = 0; i < 10; i++) {
        meter.recordHit(1000 + i * 10);
      }

      meter.update(1100);
      expect(meter.currentNPS).toBe(10);
    });
  });

  describe('peak NPS tracking (Requirement 7.2)', () => {
    it('should update peakNPS when currentNPS exceeds it', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);
      meter.update(400);

      expect(meter.peakNPS).toBe(3);
    });

    it('should not decrease peakNPS when currentNPS drops', () => {
      // First, get a high NPS
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);
      meter.recordHit(400);
      meter.recordHit(500);
      meter.update(600);
      expect(meter.peakNPS).toBe(5);

      // Now move forward so hits fall out of window
      meter.update(2000);
      expect(meter.currentNPS).toBe(0);
      expect(meter.peakNPS).toBe(5); // Peak should remain
    });

    it('should track peak across multiple update cycles', () => {
      // First burst: 3 hits
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);
      meter.update(400);
      expect(meter.peakNPS).toBe(3);

      // Second burst: 5 hits (new peak)
      meter.recordHit(2000);
      meter.recordHit(2100);
      meter.recordHit(2200);
      meter.recordHit(2300);
      meter.recordHit(2400);
      meter.update(2500);
      expect(meter.peakNPS).toBe(5);

      // Third burst: 2 hits (no new peak)
      meter.recordHit(4000);
      meter.recordHit(4100);
      meter.update(4200);
      expect(meter.peakNPS).toBe(5);
    });

    it('should always have peakNPS >= currentNPS', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.update(300);

      expect(meter.peakNPS).toBeGreaterThanOrEqual(meter.currentNPS);

      meter.update(2000);
      expect(meter.peakNPS).toBeGreaterThanOrEqual(meter.currentNPS);
    });
  });

  describe('real-time update on hit (Requirement 7.3)', () => {
    it('should include newly recorded hit in NPS after update', () => {
      meter.recordHit(100);
      meter.update(100);
      expect(meter.currentNPS).toBe(1);

      meter.recordHit(200);
      meter.update(200);
      expect(meter.currentNPS).toBe(2);
    });

    it('should reflect hit immediately after recordHit and update', () => {
      meter.update(0);
      expect(meter.currentNPS).toBe(0);

      meter.recordHit(500);
      meter.update(500);
      expect(meter.currentNPS).toBe(1);
    });
  });

  describe('getAverageNPS (Requirement 7.5)', () => {
    it('should return 0 for no hits', () => {
      expect(meter.getAverageNPS(1000)).toBe(0);
    });

    it('should return 0 for zero duration', () => {
      meter.recordHit(0);
      expect(meter.getAverageNPS(0)).toBe(0);
    });

    it('should calculate average as totalHits / duration in seconds', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);
      meter.recordHit(400);

      // 4 hits over 2 seconds = 2 NPS average
      const avg = meter.getAverageNPS(2000);
      expect(avg).toBe(2);
    });

    it('should handle fractional averages', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);

      // 3 hits over 2 seconds = 1.5 NPS average
      const avg = meter.getAverageNPS(2000);
      expect(avg).toBe(1.5);
    });

    it('should use startTime in calculation', () => {
      const meterWithStart = new NPSMeter(1000);
      meterWithStart.recordHit(1500);
      meterWithStart.recordHit(2000);

      // 2 hits over 1 second (2000 - 1000) = 2 NPS average
      const avg = meterWithStart.getAverageNPS(2000);
      expect(avg).toBe(2);
    });

    it('should return 0 for negative duration', () => {
      const meterWithStart = new NPSMeter(2000);
      meterWithStart.recordHit(1000);

      // Current time before start time
      const avg = meterWithStart.getAverageNPS(1000);
      expect(avg).toBe(0);
    });
  });

  describe('getCurrentNPS', () => {
    it('should return current NPS value', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.update(300);

      expect(meter.getCurrentNPS()).toBe(2);
    });
  });

  describe('getPeakNPS', () => {
    it('should return peak NPS value', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);
      meter.update(400);

      expect(meter.getPeakNPS()).toBe(3);
    });
  });

  describe('getTotalHits', () => {
    it('should return total hits count', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.recordHit(300);

      expect(meter.getTotalHits()).toBe(3);
    });
  });

  describe('reset', () => {
    it('should clear recentHits array', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.reset();

      expect(meter.recentHits).toEqual([]);
    });

    it('should reset currentNPS to 0', () => {
      meter.recordHit(100);
      meter.update(200);
      meter.reset();

      expect(meter.currentNPS).toBe(0);
    });

    it('should reset peakNPS to 0', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.update(300);
      meter.reset();

      expect(meter.peakNPS).toBe(0);
    });

    it('should reset totalHits to 0', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.reset();

      expect(meter.totalHits).toBe(0);
    });

    it('should optionally update startTime', () => {
      meter.reset(5000);
      expect(meter.startTime).toBe(5000);
    });

    it('should preserve startTime if not provided', () => {
      const meterWithStart = new NPSMeter(1000);
      meterWithStart.reset();
      expect(meterWithStart.startTime).toBe(1000);
    });

    it('should allow recording new hits after reset', () => {
      meter.recordHit(100);
      meter.recordHit(200);
      meter.reset();

      meter.recordHit(500);
      meter.update(600);

      expect(meter.totalHits).toBe(1);
      expect(meter.currentNPS).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very large timestamps', () => {
      const largeTime = 1000000000;
      meter.recordHit(largeTime);
      meter.recordHit(largeTime + 100);
      meter.update(largeTime + 200);

      expect(meter.currentNPS).toBe(2);
    });

    it('should handle many hits', () => {
      for (let i = 0; i < 100; i++) {
        meter.recordHit(i * 10);
      }

      expect(meter.totalHits).toBe(100);

      // At time 1000, only hits from 1-999 are in window (100 hits at 0-990)
      meter.update(1000);
      // Hits at 10, 20, ..., 990 are in window (time > 0)
      expect(meter.currentNPS).toBe(99);
    });

    it('should handle decimal timestamps', () => {
      meter.recordHit(100.5);
      meter.recordHit(200.7);
      meter.update(300.3);

      expect(meter.currentNPS).toBe(2);
    });

    it('should handle update called multiple times at same time', () => {
      meter.recordHit(100);
      meter.update(200);
      meter.update(200);
      meter.update(200);

      expect(meter.currentNPS).toBe(1);
    });

    it('should handle hits recorded after update time', () => {
      meter.recordHit(500);
      meter.update(400);

      // Hit at 500 is still in recentHits but outside window from 400's perspective
      // Actually, 500 > 400 - 1000 = -600, so it should be included
      expect(meter.currentNPS).toBe(1);
    });
  });
});

/**
 * @fileoverview Property-based tests for Input Delay Compensation.
 * Tests input delay compensation system using fast-check.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import SaveManager from '../src/data/SaveManager.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Constants for delay compensation range
const INPUT_DELAY_MIN = -50;
const INPUT_DELAY_MAX = 50;

// Arbitraries for generating test data
const validDelayArb = fc.integer({ min: INPUT_DELAY_MIN, max: INPUT_DELAY_MAX });
const timestampArb = fc.integer({ min: 0, max: 1000000 });
const anyDelayArb = fc.integer({ min: -1000, max: 1000 });
const belowMinDelayArb = fc.integer({ min: -1000, max: INPUT_DELAY_MIN - 1 });
const aboveMaxDelayArb = fc.integer({ min: INPUT_DELAY_MAX + 1, max: 1000 });

describe('Input Delay Compensation Property Tests', () => {
  let saveManager;

  beforeEach(() => {
    SaveManager.resetInstance();
    localStorageMock.clear();
    vi.clearAllMocks();
    saveManager = SaveManager.getInstance();
    saveManager.init();
  });

  afterEach(() => {
    SaveManager.resetInstance();
  });

  /**
   * Property 16: Input Delay Compensation Application
   * For any input timestamp T and configured delay offset D (where -50 ≤ D ≤ 50),
   * the adjusted timestamp used for hit detection SHALL equal T + D.
   */
  describe('Property 16: Input Delay Compensation Application', () => {
    it('adjusted timestamp SHALL equal T + D for valid delay values', () => {
      fc.assert(
        fc.property(
          timestampArb,
          validDelayArb,
          (timestamp, delay) => {
            saveManager.setInputDelayCompensation(delay);
            const adjusted = saveManager.applyDelayCompensation(timestamp);

            // The adjusted timestamp should equal T + D
            expect(adjusted).toBe(timestamp + delay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('delay compensation SHALL be additive to timestamp', () => {
      fc.assert(
        fc.property(
          timestampArb,
          validDelayArb,
          (timestamp, delay) => {
            saveManager.setInputDelayCompensation(delay);
            const adjusted = saveManager.applyDelayCompensation(timestamp);

            // Verify the relationship: adjusted - timestamp = delay
            expect(adjusted - timestamp).toBe(delay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('positive delay SHALL increase timestamp (for early hitters)', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: INPUT_DELAY_MAX }),
          (timestamp, positiveDelay) => {
            saveManager.setInputDelayCompensation(positiveDelay);
            const adjusted = saveManager.applyDelayCompensation(timestamp);

            // Positive delay should increase the timestamp
            expect(adjusted).toBeGreaterThan(timestamp);
            expect(adjusted).toBe(timestamp + positiveDelay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('negative delay SHALL decrease timestamp (for late hitters)', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: INPUT_DELAY_MIN, max: -1 }),
          (timestamp, negativeDelay) => {
            saveManager.setInputDelayCompensation(negativeDelay);
            const adjusted = saveManager.applyDelayCompensation(timestamp);

            // Negative delay should decrease the timestamp
            expect(adjusted).toBeLessThan(timestamp);
            expect(adjusted).toBe(timestamp + negativeDelay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('zero delay SHALL not modify timestamp', () => {
      fc.assert(
        fc.property(
          timestampArb,
          (timestamp) => {
            saveManager.setInputDelayCompensation(0);
            const adjusted = saveManager.applyDelayCompensation(timestamp);

            // Zero delay should not change the timestamp
            expect(adjusted).toBe(timestamp);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('delay compensation SHALL work correctly at boundary values', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.constantFrom(INPUT_DELAY_MIN, INPUT_DELAY_MAX),
          (timestamp, boundaryDelay) => {
            saveManager.setInputDelayCompensation(boundaryDelay);
            const adjusted = saveManager.applyDelayCompensation(timestamp);

            expect(adjusted).toBe(timestamp + boundaryDelay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple timestamps SHALL be adjusted consistently with same delay', () => {
      fc.assert(
        fc.property(
          fc.array(timestampArb, { minLength: 2, maxLength: 10 }),
          validDelayArb,
          (timestamps, delay) => {
            saveManager.setInputDelayCompensation(delay);

            // All timestamps should be adjusted by the same amount
            for (const timestamp of timestamps) {
              const adjusted = saveManager.applyDelayCompensation(timestamp);
              expect(adjusted).toBe(timestamp + delay);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 17: Input Delay Compensation Range
   * For any delay compensation value, the system SHALL clamp it to the range [-50, +50] milliseconds.
   */
  describe('Property 17: Input Delay Compensation Range', () => {
    it('values within range [-50, +50] SHALL be accepted as-is', () => {
      fc.assert(
        fc.property(
          validDelayArb,
          (delay) => {
            const result = saveManager.setInputDelayCompensation(delay);

            // Value should be accepted without modification
            expect(result).toBe(delay);
            expect(saveManager.getInputDelayCompensation()).toBe(delay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('values below -50 SHALL be clamped to -50', () => {
      fc.assert(
        fc.property(
          belowMinDelayArb,
          (belowMinDelay) => {
            const result = saveManager.setInputDelayCompensation(belowMinDelay);

            // Value should be clamped to -50
            expect(result).toBe(INPUT_DELAY_MIN);
            expect(saveManager.getInputDelayCompensation()).toBe(INPUT_DELAY_MIN);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('values above +50 SHALL be clamped to +50', () => {
      fc.assert(
        fc.property(
          aboveMaxDelayArb,
          (aboveMaxDelay) => {
            const result = saveManager.setInputDelayCompensation(aboveMaxDelay);

            // Value should be clamped to +50
            expect(result).toBe(INPUT_DELAY_MAX);
            expect(saveManager.getInputDelayCompensation()).toBe(INPUT_DELAY_MAX);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('any delay value SHALL result in a value within [-50, +50]', () => {
      fc.assert(
        fc.property(
          anyDelayArb,
          (anyDelay) => {
            saveManager.setInputDelayCompensation(anyDelay);
            const storedValue = saveManager.getInputDelayCompensation();

            // Stored value should always be within valid range
            expect(storedValue).toBeGreaterThanOrEqual(INPUT_DELAY_MIN);
            expect(storedValue).toBeLessThanOrEqual(INPUT_DELAY_MAX);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('clamping SHALL be idempotent', () => {
      fc.assert(
        fc.property(
          anyDelayArb,
          (anyDelay) => {
            // Set the value (which may be clamped)
            const firstResult = saveManager.setInputDelayCompensation(anyDelay);

            // Set the same value again
            const secondResult = saveManager.setInputDelayCompensation(firstResult);

            // The result should be the same (idempotent)
            expect(secondResult).toBe(firstResult);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('clamped values SHALL be used for delay compensation application', () => {
      fc.assert(
        fc.property(
          timestampArb,
          anyDelayArb,
          (timestamp, anyDelay) => {
            saveManager.setInputDelayCompensation(anyDelay);
            const storedDelay = saveManager.getInputDelayCompensation();
            const adjusted = saveManager.applyDelayCompensation(timestamp);

            // The adjusted timestamp should use the clamped value
            expect(adjusted).toBe(timestamp + storedDelay);

            // And the stored delay should be within range
            expect(storedDelay).toBeGreaterThanOrEqual(INPUT_DELAY_MIN);
            expect(storedDelay).toBeLessThanOrEqual(INPUT_DELAY_MAX);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('boundary values SHALL be accepted exactly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(INPUT_DELAY_MIN, INPUT_DELAY_MAX, 0),
          (boundaryValue) => {
            const result = saveManager.setInputDelayCompensation(boundaryValue);

            // Boundary values should be accepted exactly
            expect(result).toBe(boundaryValue);
            expect(saveManager.getInputDelayCompensation()).toBe(boundaryValue);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('clamping formula SHALL be max(-50, min(50, value))', () => {
      fc.assert(
        fc.property(
          anyDelayArb,
          (anyDelay) => {
            saveManager.setInputDelayCompensation(anyDelay);
            const storedValue = saveManager.getInputDelayCompensation();

            // Verify the clamping formula
            const expectedClamped = Math.max(INPUT_DELAY_MIN, Math.min(INPUT_DELAY_MAX, anyDelay));
            expect(storedValue).toBe(expectedClamped);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 18: Input Delay Compensation Persistence
   * For any input delay compensation value saved via SaveManager,
   * loading the saved value SHALL return the same value.
   */
  describe('Property 18: Input Delay Compensation Persistence', () => {
    it('saved delay compensation SHALL be retrievable after save', () => {
      fc.assert(
        fc.property(
          validDelayArb,
          (delay) => {
            saveManager.setInputDelayCompensation(delay);
            const retrieved = saveManager.getInputDelayCompensation();

            // Retrieved value should match what was set
            expect(retrieved).toBe(delay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('delay compensation SHALL persist across SaveManager reinitialization', () => {
      fc.assert(
        fc.property(
          validDelayArb,
          (delay) => {
            // Set the delay compensation
            saveManager.setInputDelayCompensation(delay);

            // Simulate a new session by resetting and reinitializing
            SaveManager.resetInstance();
            const newManager = SaveManager.getInstance();
            newManager.init();

            // The value should persist
            expect(newManager.getInputDelayCompensation()).toBe(delay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('clamped values SHALL persist correctly', () => {
      fc.assert(
        fc.property(
          anyDelayArb,
          (anyDelay) => {
            // Set a value that may be clamped
            const clampedValue = saveManager.setInputDelayCompensation(anyDelay);

            // Simulate a new session
            SaveManager.resetInstance();
            const newManager = SaveManager.getInstance();
            newManager.init();

            // The clamped value should persist
            expect(newManager.getInputDelayCompensation()).toBe(clampedValue);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple delay compensation changes SHALL persist the last value', () => {
      fc.assert(
        fc.property(
          fc.array(validDelayArb, { minLength: 2, maxLength: 10 }),
          (delays) => {
            // Set multiple values
            for (const delay of delays) {
              saveManager.setInputDelayCompensation(delay);
            }

            const lastDelay = delays[delays.length - 1];

            // Simulate a new session
            SaveManager.resetInstance();
            const newManager = SaveManager.getInstance();
            newManager.init();

            // Only the last value should persist
            expect(newManager.getInputDelayCompensation()).toBe(lastDelay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('delay compensation SHALL be part of options persistence', () => {
      fc.assert(
        fc.property(
          validDelayArb,
          (delay) => {
            saveManager.setInputDelayCompensation(delay);

            // Verify it's stored in options
            const options = saveManager.getAllOptions();
            expect(options.inputDelayCompensation).toBe(delay);

            // Simulate a new session
            SaveManager.resetInstance();
            const newManager = SaveManager.getInstance();
            newManager.init();

            // Verify it's still in options after reload
            const reloadedOptions = newManager.getAllOptions();
            expect(reloadedOptions.inputDelayCompensation).toBe(delay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('delay compensation SHALL reset to default (0) on resetOptions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: INPUT_DELAY_MAX }), // Non-zero values
          (nonZeroDelay) => {
            // Set a non-zero delay
            saveManager.setInputDelayCompensation(nonZeroDelay);
            expect(saveManager.getInputDelayCompensation()).toBe(nonZeroDelay);

            // Reset options
            saveManager.resetOptions();

            // Delay should be reset to default (0)
            expect(saveManager.getInputDelayCompensation()).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('delay compensation round-trip through export/import SHALL preserve value', () => {
      fc.assert(
        fc.property(
          validDelayArb,
          (delay) => {
            // Set the delay
            saveManager.setInputDelayCompensation(delay);

            // Export data
            const exported = saveManager.exportData();

            // Reset and import
            SaveManager.resetInstance();
            const newManager = SaveManager.getInstance();
            newManager.init();
            newManager.importData(exported);

            // Value should be preserved
            expect(newManager.getInputDelayCompensation()).toBe(delay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('delay compensation SHALL persist independently of other options', () => {
      fc.assert(
        fc.property(
          validDelayArb,
          fc.boolean(),
          (delay, downscroll) => {
            // Set delay compensation and another option
            saveManager.setInputDelayCompensation(delay);
            saveManager.setOption('downscroll', downscroll);

            // Simulate a new session
            SaveManager.resetInstance();
            const newManager = SaveManager.getInstance();
            newManager.init();

            // Both should persist independently
            expect(newManager.getInputDelayCompensation()).toBe(delay);
            expect(newManager.getOption('downscroll')).toBe(downscroll);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

/**
 * @fileoverview Tests for PerformanceMonitor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/layout/LayoutManager.js', () => ({
  LOW_FPS_THRESHOLD: 30,
  FPS_SAMPLE_WINDOW: 1000
}));

const { default: PerformanceMonitor } = await import('../src/core/PerformanceMonitor.js');

/**
 * Create a mock Phaser game with configurable FPS.
 * @param {number} fps - The actualFps value to return
 * @returns {Object}
 */
function createMockGame(fps = 60) {
  return {
    loop: { actualFps: fps }
  };
}

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor(createMockGame(60));
  });

  describe('constructor', () => {
    it('should store game reference', () => {
      const game = createMockGame();
      const pm = new PerformanceMonitor(game);
      expect(pm.game).toBe(game);
    });

    it('should default to not low performance', () => {
      expect(monitor.isLowPerformance()).toBe(false);
    });

    it('should use LayoutManager constants for threshold and window', () => {
      expect(monitor.threshold).toBe(30);
      expect(monitor.sampleWindow).toBe(1000);
    });
  });

  describe('update', () => {
    it('should not flag low performance when FPS is above threshold', () => {
      const game = createMockGame(60);
      monitor = new PerformanceMonitor(game);

      // Simulate 1 second of 60fps frames (each ~16.67ms)
      for (let i = 0; i < 60; i++) {
        monitor.update(16.67);
      }

      expect(monitor.isLowPerformance()).toBe(false);
    });

    it('should flag low performance when FPS is below threshold for full window', () => {
      const game = createMockGame(20);
      monitor = new PerformanceMonitor(game);

      // Simulate 1 second of 20fps frames (each 50ms)
      for (let i = 0; i < 20; i++) {
        monitor.update(50);
      }

      expect(monitor.isLowPerformance()).toBe(true);
    });

    it('should not flag low performance before a full sample window elapses', () => {
      const game = createMockGame(15);
      monitor = new PerformanceMonitor(game);

      // Only 500ms of updates — not a full window
      for (let i = 0; i < 10; i++) {
        monitor.update(50);
      }

      expect(monitor.isLowPerformance()).toBe(false);
    });

    it('should recover when FPS improves after a low window', () => {
      const game = createMockGame(20);
      monitor = new PerformanceMonitor(game);

      // First window: low FPS
      for (let i = 0; i < 20; i++) {
        monitor.update(50);
      }
      expect(monitor.isLowPerformance()).toBe(true);

      // Second window: high FPS
      game.loop.actualFps = 60;
      for (let i = 0; i < 60; i++) {
        monitor.update(16.67);
      }
      expect(monitor.isLowPerformance()).toBe(false);
    });

    it('should handle exactly-at-threshold FPS as not low', () => {
      const game = createMockGame(30);
      monitor = new PerformanceMonitor(game);

      // Simulate 1 second at exactly 30fps
      for (let i = 0; i < 30; i++) {
        monitor.update(33.33);
      }

      expect(monitor.isLowPerformance()).toBe(false);
    });
  });

  describe('shouldReduceEffects', () => {
    it('should be an alias for isLowPerformance', () => {
      expect(monitor.shouldReduceEffects()).toBe(monitor.isLowPerformance());

      // Force low performance
      const game = createMockGame(10);
      monitor = new PerformanceMonitor(game);
      for (let i = 0; i < 10; i++) {
        monitor.update(100);
      }

      expect(monitor.shouldReduceEffects()).toBe(true);
      expect(monitor.shouldReduceEffects()).toBe(monitor.isLowPerformance());
    });
  });

  describe('game.loop.actualFps unavailable', () => {
    it('should default to false when game is null', () => {
      monitor = new PerformanceMonitor(null);

      for (let i = 0; i < 100; i++) {
        monitor.update(16);
      }

      expect(monitor.isLowPerformance()).toBe(false);
    });

    it('should default to false when game.loop is undefined', () => {
      monitor = new PerformanceMonitor({});

      for (let i = 0; i < 100; i++) {
        monitor.update(16);
      }

      expect(monitor.isLowPerformance()).toBe(false);
    });

    it('should default to false when actualFps is NaN', () => {
      monitor = new PerformanceMonitor({ loop: { actualFps: NaN } });

      for (let i = 0; i < 100; i++) {
        monitor.update(16);
      }

      expect(monitor.isLowPerformance()).toBe(false);
    });

    it('should default to false when actualFps is Infinity', () => {
      monitor = new PerformanceMonitor({ loop: { actualFps: Infinity } });

      for (let i = 0; i < 100; i++) {
        monitor.update(16);
      }

      expect(monitor.isLowPerformance()).toBe(false);
    });
  });

  describe('rolling window behavior', () => {
    it('should evaluate each window independently', () => {
      const game = createMockGame(60);
      monitor = new PerformanceMonitor(game);

      // Window 1: good FPS
      for (let i = 0; i < 60; i++) {
        monitor.update(16.67);
      }
      expect(monitor.isLowPerformance()).toBe(false);

      // Window 2: bad FPS
      game.loop.actualFps = 15;
      for (let i = 0; i < 15; i++) {
        monitor.update(66.67);
      }
      expect(monitor.isLowPerformance()).toBe(true);

      // Window 3: good FPS again
      game.loop.actualFps = 60;
      for (let i = 0; i < 60; i++) {
        monitor.update(16.67);
      }
      expect(monitor.isLowPerformance()).toBe(false);
    });
  });
});

import fc from 'fast-check';

// Minimum iterations per property test
const NUM_RUNS = 100;

// ========================================
// PROPERTY-BASED TESTS
// ========================================

describe('PerformanceMonitor Property Tests', () => {
  // ========================================
  // Property 14: Performance monitor threshold
  // Tag: Feature: mobile-portrait-mode, Property 14: Performance monitor threshold
  // **Validates: Requirements 12.3**
  // ========================================
  describe('Property 14: Performance monitor threshold', () => {
    it('isLowPerformance SHALL return true when rolling avg FPS < 30 for a full window', () => {
      fc.assert(
        fc.property(
          // Generate a constant low FPS value between 1 and 29
          fc.integer({ min: 1, max: 29 }),
          (fps) => {
            const game = { loop: { actualFps: fps } };
            const monitor = new PerformanceMonitor(game);

            // Use enough frames so total elapsed >= 1000ms
            // Add one extra frame to ensure the window completes
            const frameCount = fps + 1;
            const delta = 1000 / fps;

            for (let i = 0; i < frameCount; i++) {
              monitor.update(delta);
            }

            expect(monitor.isLowPerformance()).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('isLowPerformance SHALL return false when rolling avg FPS >= 30 for a full window', () => {
      fc.assert(
        fc.property(
          // Generate a constant FPS value between 30 and 120
          fc.integer({ min: 30, max: 120 }),
          (fps) => {
            const game = { loop: { actualFps: fps } };
            const monitor = new PerformanceMonitor(game);

            const frameCount = fps;
            const delta = 1000 / fps;

            for (let i = 0; i < frameCount; i++) {
              monitor.update(delta);
            }

            expect(monitor.isLowPerformance()).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('isLowPerformance SHALL reflect the avg of varying FPS samples within a window', () => {
      fc.assert(
        fc.property(
          // Generate an array of FPS values (5-60 samples), each between 1 and 120
          fc.array(fc.integer({ min: 1, max: 120 }), { minLength: 5, maxLength: 60 }),
          (fpsSequence) => {
            const game = { loop: { actualFps: 60 } };
            const monitor = new PerformanceMonitor(game);

            const n = fpsSequence.length;
            // Feed n-1 samples with small deltas that won't complete the window
            const smallDelta = 900 / n; // total from these = (n-1) * 900/n < 900 < 1000

            let fpsSum = 0;
            for (let i = 0; i < n - 1; i++) {
              game.loop.actualFps = fpsSequence[i];
              fpsSum += fpsSequence[i];
              monitor.update(smallDelta);
            }

            // Feed the last sample with a delta that completes the window
            // Elapsed so far = (n-1) * smallDelta. Need remaining to reach 1000.
            const elapsedSoFar = (n - 1) * smallDelta;
            const finalDelta = 1000 - elapsedSoFar + 1; // +1 to ensure >= 1000
            game.loop.actualFps = fpsSequence[n - 1];
            fpsSum += fpsSequence[n - 1];
            monitor.update(finalDelta);

            const avg = fpsSum / n;

            if (avg < 30) {
              expect(monitor.isLowPerformance()).toBe(true);
            } else {
              expect(monitor.isLowPerformance()).toBe(false);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('isLowPerformance SHALL remain false before a full sample window elapses', () => {
      fc.assert(
        fc.property(
          // Generate low FPS (1-20) and a fraction of the window to fill (10%-90%)
          fc.integer({ min: 1, max: 20 }),
          fc.double({ min: 0.1, max: 0.9, noNaN: true }),
          (fps, fraction) => {
            const game = { loop: { actualFps: fps } };
            const monitor = new PerformanceMonitor(game);

            // Only fill a fraction of the 1000ms window
            const totalTime = 1000 * fraction;
            const frameCount = Math.max(1, Math.floor(fps * fraction));
            const delta = totalTime / frameCount;

            for (let i = 0; i < frameCount; i++) {
              monitor.update(delta);
            }

            // Window hasn't completed yet, so should still be false
            expect(monitor.isLowPerformance()).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

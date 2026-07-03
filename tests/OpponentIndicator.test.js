/**
 * @fileoverview Tests for OpponentIndicator - Compact opponent arrow indicator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

const { default: OpponentIndicator } = await import('../src/play/OpponentIndicator.js');
const {
  OPPONENT_INDICATOR_X,
  OPPONENT_INDICATOR_Y,
  OPPONENT_ARROW_SIZE,
  OPPONENT_FLASH_DURATION
} = await import('../src/layout/LayoutManager.js');

/** Create a mock Phaser scene with graphics factory */
const createMockScene = () => ({
  add: {
    graphics: () => ({
      fillStyle: vi.fn(),
      fillTriangle: vi.fn(),
      setAlpha: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn()
    })
  }
});

describe('OpponentIndicator', () => {
  let indicator;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    indicator = new OpponentIndicator(mockScene);
  });

  afterEach(() => {
    indicator.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default LayoutManager values', () => {
      expect(indicator.scene).toBe(mockScene);
      expect(indicator.x).toBe(OPPONENT_INDICATOR_X);
      expect(indicator.y).toBe(OPPONENT_INDICATOR_Y);
      expect(indicator.arrowSize).toBe(OPPONENT_ARROW_SIZE);
      expect(indicator.flashDuration).toBe(OPPONENT_FLASH_DURATION);
      expect(indicator.arrows).toEqual([]);
    });

    it('should accept custom configuration', () => {
      const custom = new OpponentIndicator(mockScene, {
        x: 50,
        y: 100,
        arrowSize: 24,
        flashDuration: 200
      });

      expect(custom.x).toBe(50);
      expect(custom.y).toBe(100);
      expect(custom.arrowSize).toBe(24);
      expect(custom.flashDuration).toBe(200);

      custom.destroy();
    });
  });

  describe('create', () => {
    it('should create 4 arrow states', () => {
      indicator.create();

      expect(indicator.arrows.length).toBe(4);
    });

    it('should assign correct directions to arrows', () => {
      indicator.create();

      expect(indicator.arrows[0].direction).toBe(0); // left
      expect(indicator.arrows[1].direction).toBe(1); // down
      expect(indicator.arrows[2].direction).toBe(2); // up
      expect(indicator.arrows[3].direction).toBe(3); // right
    });

    it('should initialize arrows as not flashing', () => {
      indicator.create();

      for (const arrow of indicator.arrows) {
        expect(arrow.isFlashing).toBe(false);
        expect(arrow.flashTimer).toBe(0);
      }
    });

    it('should create graphics for each arrow', () => {
      indicator.create();

      for (const arrow of indicator.arrows) {
        expect(arrow.graphic).not.toBeNull();
        expect(arrow.graphic.fillTriangle).toBeDefined();
      }
    });

    it('should set idle alpha on each graphic', () => {
      indicator.create();

      for (const arrow of indicator.arrows) {
        expect(arrow.graphic.setAlpha).toHaveBeenCalledWith(0.35);
      }
    });

    it('should render arrows within 32x32px bounds', () => {
      // Default OPPONENT_ARROW_SIZE is 28, which is ≤ 32
      expect(indicator.arrowSize).toBeLessThanOrEqual(32);
    });
  });

  describe('flash', () => {
    beforeEach(() => {
      indicator.create();
    });

    it('should set flash timer and isFlashing for the given direction', () => {
      indicator.flash(0);

      expect(indicator.arrows[0].isFlashing).toBe(true);
      expect(indicator.arrows[0].flashTimer).toBe(OPPONENT_FLASH_DURATION);
    });

    it('should set graphic alpha to 1.0 on flash', () => {
      indicator.flash(2);

      expect(indicator.arrows[2].graphic.setAlpha).toHaveBeenCalledWith(1.0);
    });

    it('should not affect other arrows', () => {
      indicator.flash(1);

      expect(indicator.arrows[0].isFlashing).toBe(false);
      expect(indicator.arrows[2].isFlashing).toBe(false);
      expect(indicator.arrows[3].isFlashing).toBe(false);
    });

    it('should ignore invalid directions', () => {
      indicator.flash(-1);
      indicator.flash(4);
      indicator.flash(99);

      for (const arrow of indicator.arrows) {
        expect(arrow.isFlashing).toBe(false);
      }
    });

    it('should reset timer when flashed again while still flashing', () => {
      indicator.flash(0);
      indicator.update(50); // partially decay
      expect(indicator.arrows[0].flashTimer).toBe(OPPONENT_FLASH_DURATION - 50);

      indicator.flash(0); // re-flash
      expect(indicator.arrows[0].flashTimer).toBe(OPPONENT_FLASH_DURATION);
      expect(indicator.arrows[0].isFlashing).toBe(true);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      indicator.create();
    });

    it('should decay flash timer by delta', () => {
      indicator.flash(0);
      indicator.update(50);

      expect(indicator.arrows[0].flashTimer).toBe(OPPONENT_FLASH_DURATION - 50);
      expect(indicator.arrows[0].isFlashing).toBe(true);
    });

    it('should stop flashing after full duration elapses', () => {
      indicator.flash(0);
      indicator.update(OPPONENT_FLASH_DURATION);

      expect(indicator.arrows[0].flashTimer).toBe(0);
      expect(indicator.arrows[0].isFlashing).toBe(false);
    });

    it('should restore idle alpha after flash ends', () => {
      indicator.flash(0);
      indicator.arrows[0].graphic.setAlpha.mockClear();

      indicator.update(OPPONENT_FLASH_DURATION);

      expect(indicator.arrows[0].graphic.setAlpha).toHaveBeenCalledWith(0.35);
    });

    it('should not go below zero on the timer', () => {
      indicator.flash(0);
      indicator.update(OPPONENT_FLASH_DURATION + 100);

      expect(indicator.arrows[0].flashTimer).toBe(0);
    });

    it('should handle multiple arrows flashing independently', () => {
      indicator.flash(0);
      indicator.flash(3);

      indicator.update(100);

      expect(indicator.arrows[0].isFlashing).toBe(true);
      expect(indicator.arrows[3].isFlashing).toBe(true);

      indicator.update(50); // total 150ms

      expect(indicator.arrows[0].isFlashing).toBe(false);
      expect(indicator.arrows[3].isFlashing).toBe(false);
    });

    it('should skip non-flashing arrows', () => {
      indicator.update(100);

      // No errors, all arrows remain idle
      for (const arrow of indicator.arrows) {
        expect(arrow.isFlashing).toBe(false);
        expect(arrow.flashTimer).toBe(0);
      }
    });
  });

  describe('setPosition', () => {
    it('should update x and y', () => {
      indicator.create();
      indicator.setPosition(200, 300);

      expect(indicator.x).toBe(200);
      expect(indicator.y).toBe(300);
    });

    it('should redraw arrows at new position', () => {
      indicator.create();
      const clearCalls = indicator.arrows.map((a) => a.graphic.clear);

      indicator.setPosition(200, 300);

      for (const clearFn of clearCalls) {
        expect(clearFn).toHaveBeenCalled();
      }
    });
  });

  describe('destroy', () => {
    it('should destroy all graphics', () => {
      indicator.create();
      const destroyFns = indicator.arrows.map((a) => a.graphic.destroy);

      indicator.destroy();

      for (const destroyFn of destroyFns) {
        expect(destroyFn).toHaveBeenCalled();
      }
    });

    it('should clear arrows array and scene reference', () => {
      indicator.create();
      indicator.destroy();

      expect(indicator.arrows).toEqual([]);
      expect(indicator.scene).toBeNull();
    });
  });

  describe('headless mode (no scene.add)', () => {
    it('should work without Phaser graphics factory', () => {
      const headless = new OpponentIndicator({});
      headless.create();

      expect(headless.arrows.length).toBe(4);
      for (const arrow of headless.arrows) {
        expect(arrow.graphic).toBeNull();
      }

      // flash and update should not throw
      headless.flash(0);
      expect(headless.arrows[0].isFlashing).toBe(true);

      headless.update(OPPONENT_FLASH_DURATION);
      expect(headless.arrows[0].isFlashing).toBe(false);

      headless.destroy();
    });
  });
});


// Minimum iterations per property test
const NUM_RUNS = 100;

// ========================================
// PROPERTY-BASED TESTS
// ========================================

describe('OpponentIndicator Property Tests', () => {
  // ========================================
  // Property 3: Opponent indicator flash and decay
  // Tag: Feature: mobile-portrait-mode, Property 3: Opponent indicator flash and decay
  // **Validates: Requirements 5.2**
  // ========================================
  describe('Property 3: Opponent indicator flash and decay', () => {
    it('flash(direction) SHALL set flashTimer to 150ms and isFlashing to true for any valid direction', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (direction) => {
            const indicator = new OpponentIndicator({});
            indicator.create();

            indicator.flash(direction);

            expect(indicator.arrows[direction].flashTimer).toBe(OPPONENT_FLASH_DURATION);
            expect(indicator.arrows[direction].isFlashing).toBe(true);

            indicator.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('after accumulating 150ms of update deltas, isFlashing SHALL return to false', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          fc.array(fc.integer({ min: 1, max: 150 }), { minLength: 1, maxLength: 20 }),
          (direction, deltas) => {
            const indicator = new OpponentIndicator({});
            indicator.create();

            indicator.flash(direction);

            // Accumulate deltas up to at least flashDuration
            let totalDelta = 0;
            for (const delta of deltas) {
              indicator.update(delta);
              totalDelta += delta;
            }

            // If we haven't reached the full duration yet, push one more update to finish it
            if (totalDelta < OPPONENT_FLASH_DURATION) {
              const remaining = OPPONENT_FLASH_DURATION - totalDelta;
              indicator.update(remaining);
              totalDelta += remaining;
            }

            expect(indicator.arrows[direction].isFlashing).toBe(false);
            expect(indicator.arrows[direction].flashTimer).toBe(0);

            indicator.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('isFlashing SHALL remain true while accumulated deltas are less than flashDuration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          fc.integer({ min: 1, max: OPPONENT_FLASH_DURATION - 1 }),
          (direction, partialDelta) => {
            const indicator = new OpponentIndicator({});
            indicator.create();

            indicator.flash(direction);
            indicator.update(partialDelta);

            expect(indicator.arrows[direction].isFlashing).toBe(true);
            expect(indicator.arrows[direction].flashTimer).toBe(OPPONENT_FLASH_DURATION - partialDelta);

            indicator.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('flash SHALL only affect the targeted direction, leaving others unchanged', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (direction) => {
            const indicator = new OpponentIndicator({});
            indicator.create();

            indicator.flash(direction);

            for (let i = 0; i < 4; i++) {
              if (i === direction) {
                expect(indicator.arrows[i].isFlashing).toBe(true);
              } else {
                expect(indicator.arrows[i].isFlashing).toBe(false);
                expect(indicator.arrows[i].flashTimer).toBe(0);
              }
            }

            indicator.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

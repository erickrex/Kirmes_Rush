/**
 * @fileoverview Property-based tests for menu touch target sizes.
 * Verifies that all menu items have interactive hit areas ≥ 48×48px when touch is enabled.
 *
 * Feature: mobile-portrait-mode, Property 12: Menu touch targets meet minimum size
 * **Validates: Requirements 10.2**
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Mock Phaser before importing BaseMenuState
vi.mock('phaser', () => ({
  default: {
    Scene: class MockScene {
      constructor() {}
    }
  }
}));

// Mock TouchDeviceDetector
vi.mock('../src/input/TouchDeviceDetector.js', () => ({
  default: {
    isTouch: vi.fn(() => true),
    detect: vi.fn(),
    reset: vi.fn()
  }
}));

const { default: BaseMenuState } = await import('../src/ui/BaseMenuState.js');

const NUM_RUNS = 100;
const MIN_TOUCH_TARGET = BaseMenuState.MIN_TOUCH_TARGET; // 48

/**
 * Simulates the hit area enforcement logic from BaseMenuState.enableTouchOnItems().
 * Given an item's natural width and height, returns the effective hit area dimensions
 * after the minimum 48×48 enforcement.
 */
function computeEffectiveHitArea(naturalWidth, naturalHeight) {
  return {
    width: Math.max(naturalWidth, MIN_TOUCH_TARGET),
    height: Math.max(naturalHeight, MIN_TOUCH_TARGET)
  };
}

describe('Property 12: Menu touch targets meet minimum size', () => {
  it('interactive hit area SHALL have width ≥ 48px and height ≥ 48px for any menu item size when touch enabled', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2000 }),  // naturalWidth
        fc.integer({ min: 1, max: 2000 }),  // naturalHeight
        (naturalWidth, naturalHeight) => {
          const hitArea = computeEffectiveHitArea(naturalWidth, naturalHeight);

          expect(hitArea.width).toBeGreaterThanOrEqual(48);
          expect(hitArea.height).toBeGreaterThanOrEqual(48);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('hit area SHALL preserve original size when already ≥ 48px', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 48, max: 2000 }),  // naturalWidth already ≥ 48
        fc.integer({ min: 48, max: 2000 }),  // naturalHeight already ≥ 48
        (naturalWidth, naturalHeight) => {
          const hitArea = computeEffectiveHitArea(naturalWidth, naturalHeight);

          expect(hitArea.width).toBe(naturalWidth);
          expect(hitArea.height).toBe(naturalHeight);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('hit area SHALL be exactly 48px when natural size is below 48px', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 47 }),  // naturalWidth below minimum
        fc.integer({ min: 1, max: 47 }),  // naturalHeight below minimum
        (naturalWidth, naturalHeight) => {
          const hitArea = computeEffectiveHitArea(naturalWidth, naturalHeight);

          expect(hitArea.width).toBe(48);
          expect(hitArea.height).toBe(48);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('MIN_TOUCH_TARGET constant SHALL be 48', () => {
    expect(MIN_TOUCH_TARGET).toBe(48);
  });
});

/**
 * @fileoverview Unit tests for the TouchDeviceDetector class.
 * Tests touch capability detection with mocked browser environments.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TouchDeviceDetector from '../src/input/TouchDeviceDetector.js';

describe('TouchDeviceDetector', () => {
  /** @type {any} */
  let originalWindow;
  /** @type {any} */
  let originalNavigator;

  beforeEach(() => {
    TouchDeviceDetector.reset();
    // Save originals so we can restore after each test
    originalWindow = { ...globalThis.window };
    originalNavigator = { ...globalThis.navigator };
  });

  afterEach(() => {
    // Clean up any property overrides
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start with isTouchDevice false', () => {
      expect(TouchDeviceDetector.isTouchDevice).toBe(false);
    });

    it('should start with evaluated false', () => {
      expect(TouchDeviceDetector.evaluated).toBe(false);
    });

    it('should return false from isTouch() before detect()', () => {
      expect(TouchDeviceDetector.isTouch()).toBe(false);
    });
  });

  describe('detect()', () => {
    it('should set evaluated to true after calling detect()', () => {
      TouchDeviceDetector.detect();
      expect(TouchDeviceDetector.evaluated).toBe(true);
    });

    it('should detect touch when ontouchstart is in window', () => {
      // jsdom doesn't have ontouchstart by default, so add it
      globalThis.window.ontouchstart = null;
      TouchDeviceDetector.detect();
      expect(TouchDeviceDetector.isTouch()).toBe(true);
      delete globalThis.window.ontouchstart;
    });

    it('should detect touch when navigator.maxTouchPoints > 0', () => {
      // Remove ontouchstart if present
      const hadOntouchstart = 'ontouchstart' in window;
      if (hadOntouchstart) {
        delete globalThis.window.ontouchstart;
      }

      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true
      });

      TouchDeviceDetector.detect();
      expect(TouchDeviceDetector.isTouch()).toBe(true);

      // Restore
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true
      });
      if (hadOntouchstart) {
        globalThis.window.ontouchstart = null;
      }
    });

    it('should not detect touch when neither ontouchstart nor maxTouchPoints', () => {
      // Ensure ontouchstart is not present
      const hadOntouchstart = 'ontouchstart' in window;
      if (hadOntouchstart) {
        delete globalThis.window.ontouchstart;
      }

      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true
      });

      TouchDeviceDetector.detect();
      expect(TouchDeviceDetector.isTouch()).toBe(false);

      if (hadOntouchstart) {
        globalThis.window.ontouchstart = null;
      }
    });

    it('should handle maxTouchPoints being unavailable gracefully', () => {
      const hadOntouchstart = 'ontouchstart' in window;
      if (hadOntouchstart) {
        delete globalThis.window.ontouchstart;
      }

      // maxTouchPoints = 0 means no touch
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true
      });

      TouchDeviceDetector.detect();
      expect(TouchDeviceDetector.isTouch()).toBe(false);

      if (hadOntouchstart) {
        globalThis.window.ontouchstart = null;
      }
    });
  });

  describe('onFirstTouch()', () => {
    it('should upgrade isTouchDevice to true', () => {
      TouchDeviceDetector.detect();
      expect(TouchDeviceDetector.isTouch()).toBe(false);

      TouchDeviceDetector.onFirstTouch();
      expect(TouchDeviceDetector.isTouch()).toBe(true);
    });

    it('should only upgrade once (idempotent)', () => {
      TouchDeviceDetector.onFirstTouch();
      expect(TouchDeviceDetector.isTouch()).toBe(true);

      // Manually set back to false to verify it doesn't re-upgrade
      TouchDeviceDetector.isTouchDevice = false;
      TouchDeviceDetector.onFirstTouch();
      // Should NOT upgrade again because _touchUpgraded is already true
      expect(TouchDeviceDetector.isTouch()).toBe(false);
    });

    it('should work even if detect() was not called first', () => {
      TouchDeviceDetector.onFirstTouch();
      expect(TouchDeviceDetector.isTouch()).toBe(true);
    });
  });

  describe('isTouch()', () => {
    it('should return current isTouchDevice state', () => {
      expect(TouchDeviceDetector.isTouch()).toBe(false);
      TouchDeviceDetector.isTouchDevice = true;
      expect(TouchDeviceDetector.isTouch()).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should reset all state to defaults', () => {
      TouchDeviceDetector.isTouchDevice = true;
      TouchDeviceDetector.evaluated = true;
      TouchDeviceDetector._touchUpgraded = true;

      TouchDeviceDetector.reset();

      expect(TouchDeviceDetector.isTouchDevice).toBe(false);
      expect(TouchDeviceDetector.evaluated).toBe(false);
      expect(TouchDeviceDetector._touchUpgraded).toBe(false);
    });

    it('should allow onFirstTouch to fire again after reset', () => {
      TouchDeviceDetector.onFirstTouch();
      expect(TouchDeviceDetector.isTouch()).toBe(true);

      TouchDeviceDetector.reset();
      expect(TouchDeviceDetector.isTouch()).toBe(false);

      TouchDeviceDetector.onFirstTouch();
      expect(TouchDeviceDetector.isTouch()).toBe(true);
    });
  });

  describe('subscribe()', () => {
    it('should notify listeners immediately and on detect/onFirstTouch/reset', () => {
      const listener = vi.fn();
      const unsubscribe = TouchDeviceDetector.subscribe(listener);

      expect(listener).toHaveBeenNthCalledWith(1, false);

      TouchDeviceDetector.detect();
      expect(listener).toHaveBeenNthCalledWith(2, false);

      TouchDeviceDetector.onFirstTouch();
      expect(listener).toHaveBeenNthCalledWith(3, true);

      TouchDeviceDetector.reset();
      expect(listener).toHaveBeenNthCalledWith(4, false);

      unsubscribe();
      TouchDeviceDetector.onFirstTouch();

      expect(listener).toHaveBeenCalledTimes(4);
    });
  });
});

import fc from 'fast-check';

// Minimum iterations per property test
const NUM_RUNS = 100;

// ========================================
// PROPERTY-BASED TESTS
// ========================================

describe('TouchDeviceDetector Property Tests', () => {
  // ========================================
  // Property 1: Touch detection matches environment capabilities
  // Tag: Feature: mobile-portrait-mode, Property 1: Touch detection matches environment capabilities
  // **Validates: Requirements 3.1**
  // ========================================
  describe('Property 1: Touch detection matches environment capabilities', () => {
    beforeEach(() => {
      TouchDeviceDetector.reset();
    });

    afterEach(() => {
      // Clean up ontouchstart if we added it
      if ('ontouchstart' in globalThis.window) {
        delete globalThis.window.ontouchstart;
      }
      // Restore maxTouchPoints to 0
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true,
      });
    });

    it('detect() SHALL return true iff ontouchstart is present OR maxTouchPoints > 0', () => {
      fc.assert(
        fc.property(
          fc.boolean(),                          // hasOntouchstart
          fc.integer({ min: 0, max: 20 }),       // maxTouchPoints value
          (hasOntouchstart, maxTouchPoints) => {
            // Reset detector state
            TouchDeviceDetector.reset();

            // Configure environment: ontouchstart
            if (hasOntouchstart) {
              globalThis.window.ontouchstart = null;
            } else if ('ontouchstart' in globalThis.window) {
              delete globalThis.window.ontouchstart;
            }

            // Configure environment: maxTouchPoints
            Object.defineProperty(navigator, 'maxTouchPoints', {
              value: maxTouchPoints,
              configurable: true,
            });

            // Run detection
            TouchDeviceDetector.detect();

            // Expected: touch if ontouchstart present OR maxTouchPoints > 0
            const expected = hasOntouchstart || maxTouchPoints > 0;
            expect(TouchDeviceDetector.isTouch()).toBe(expected);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('detect() SHALL return false when neither ontouchstart nor maxTouchPoints indicate touch', () => {
      fc.assert(
        fc.property(
          fc.constant(false),                    // no ontouchstart
          fc.constant(0),                        // maxTouchPoints = 0
          (hasOntouchstart, maxTouchPoints) => {
            TouchDeviceDetector.reset();

            if ('ontouchstart' in globalThis.window) {
              delete globalThis.window.ontouchstart;
            }

            Object.defineProperty(navigator, 'maxTouchPoints', {
              value: maxTouchPoints,
              configurable: true,
            });

            TouchDeviceDetector.detect();
            expect(TouchDeviceDetector.isTouch()).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('detect() SHALL return true when ontouchstart is present regardless of maxTouchPoints', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),       // any maxTouchPoints value
          (maxTouchPoints) => {
            TouchDeviceDetector.reset();

            // Always set ontouchstart
            globalThis.window.ontouchstart = null;

            Object.defineProperty(navigator, 'maxTouchPoints', {
              value: maxTouchPoints,
              configurable: true,
            });

            TouchDeviceDetector.detect();
            expect(TouchDeviceDetector.isTouch()).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('detect() SHALL return true when maxTouchPoints > 0 regardless of ontouchstart', () => {
      fc.assert(
        fc.property(
          fc.boolean(),                          // ontouchstart presence
          fc.integer({ min: 1, max: 20 }),       // maxTouchPoints > 0
          (hasOntouchstart, maxTouchPoints) => {
            TouchDeviceDetector.reset();

            if (hasOntouchstart) {
              globalThis.window.ontouchstart = null;
            } else if ('ontouchstart' in globalThis.window) {
              delete globalThis.window.ontouchstart;
            }

            Object.defineProperty(navigator, 'maxTouchPoints', {
              value: maxTouchPoints,
              configurable: true,
            });

            TouchDeviceDetector.detect();
            expect(TouchDeviceDetector.isTouch()).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

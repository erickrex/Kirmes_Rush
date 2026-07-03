/**
 * @fileoverview Unit tests for the LayoutManager portrait layout constants and helpers
 */

import { describe, it, expect } from 'vitest';
import {
  PORTRAIT_WIDTH,
  PORTRAIT_HEIGHT,
  ASPECT_RATIO,
  STRUMLINE_LANE_WIDTH,
  PLAYER_STRUMLINE_X,
  PLAYER_STRUMLINE_Y,
  TOUCH_ZONE_HEIGHT,
  TOUCH_ZONE_Y,
  TOUCH_ZONE_WIDTH,
  HEALTH_BAR_Y,
  HEALTH_BAR_WIDTH,
  HEALTH_BAR_X,
  SCORE_DISPLAY_Y,
  COMBO_POPUP_Y,
  OPPONENT_INDICATOR_X,
  OPPONENT_INDICATOR_Y,
  OPPONENT_ARROW_SIZE,
  OPPONENT_FLASH_DURATION,
  DEFAULT_PORTRAIT_ZOOM,
  PLAYER_CHAR_Y_RANGE,
  LOW_FPS_THRESHOLD,
  FPS_SAMPLE_WINDOW,
  computeStrumlineX,
} from '../src/layout/LayoutManager.js';

describe('LayoutManager', () => {
  describe('Canvas constants', () => {
    it('should define portrait dimensions as 720x1280', () => {
      expect(PORTRAIT_WIDTH).toBe(720);
      expect(PORTRAIT_HEIGHT).toBe(1280);
    });

    it('should define aspect ratio as 9/16', () => {
      expect(ASPECT_RATIO).toBeCloseTo(9 / 16);
      expect(ASPECT_RATIO).toBeCloseTo(PORTRAIT_WIDTH / PORTRAIT_HEIGHT);
    });
  });

  describe('Strumline constants', () => {
    it('should define lane width as 112', () => {
      expect(STRUMLINE_LANE_WIDTH).toBe(112);
    });

    it('should center 4 lanes within 720px canvas', () => {
      const totalLaneWidth = 4 * STRUMLINE_LANE_WIDTH;
      const expectedX = (PORTRAIT_WIDTH - totalLaneWidth) / 2;
      expect(PLAYER_STRUMLINE_X).toBe(expectedX);
      expect(PLAYER_STRUMLINE_X).toBe(136);
    });

    it('should position strumline Y at 900', () => {
      expect(PLAYER_STRUMLINE_Y).toBe(900);
    });
  });

  describe('Touch zone constants', () => {
    it('should define touch zone dimensions', () => {
      expect(TOUCH_ZONE_HEIGHT).toBe(160);
      expect(TOUCH_ZONE_Y).toBe(PORTRAIT_HEIGHT - TOUCH_ZONE_HEIGHT);
      expect(TOUCH_ZONE_WIDTH).toBe(PORTRAIT_WIDTH / 4);
    });
  });

  describe('HUD positioning constants', () => {
    it('should define health bar position and size', () => {
      expect(HEALTH_BAR_Y).toBe(80);
      expect(HEALTH_BAR_WIDTH).toBe(640);
      expect(HEALTH_BAR_X).toBe(40);
    });

    it('should define score and combo positions', () => {
      expect(SCORE_DISPLAY_Y).toBe(120);
      expect(COMBO_POPUP_Y).toBe(500);
    });

    it('should fit health bar within canvas width', () => {
      expect(HEALTH_BAR_X + HEALTH_BAR_WIDTH).toBeLessThanOrEqual(PORTRAIT_WIDTH);
    });
  });

  describe('Opponent indicator constants', () => {
    it('should define opponent indicator position and size', () => {
      expect(OPPONENT_INDICATOR_X).toBe(16);
      expect(OPPONENT_INDICATOR_Y).toBe(16);
      expect(OPPONENT_ARROW_SIZE).toBe(28);
      expect(OPPONENT_ARROW_SIZE).toBeLessThanOrEqual(32);
    });

    it('should define flash duration as 150ms', () => {
      expect(OPPONENT_FLASH_DURATION).toBe(150);
    });
  });

  describe('Camera constants', () => {
    it('should define default portrait zoom', () => {
      expect(DEFAULT_PORTRAIT_ZOOM).toBe(1.4);
    });

    it('should define player character Y range', () => {
      expect(PLAYER_CHAR_Y_RANGE).toEqual([300, 700]);
      expect(PLAYER_CHAR_Y_RANGE[0]).toBeLessThan(PLAYER_CHAR_Y_RANGE[1]);
    });
  });

  describe('Performance constants', () => {
    it('should define low FPS threshold and sample window', () => {
      expect(LOW_FPS_THRESHOLD).toBe(30);
      expect(FPS_SAMPLE_WINDOW).toBe(1000);
    });
  });

  describe('computeStrumlineX', () => {
    it('should center strumline for default 720px canvas', () => {
      expect(computeStrumlineX(720)).toBe(136);
    });

    it('should center strumline for arbitrary canvas widths', () => {
      // 4 lanes × 112 = 448, so (1000 - 448) / 2 = 276
      expect(computeStrumlineX(1000)).toBe(276);
    });

    it('should accept custom lane count and width', () => {
      // 3 lanes × 100 = 300, so (800 - 300) / 2 = 250
      expect(computeStrumlineX(800, 3, 100)).toBe(250);
    });

    it('should produce equal left and right padding', () => {
      const x = computeStrumlineX(720);
      const totalLaneWidth = 4 * STRUMLINE_LANE_WIDTH;
      const rightPadding = PORTRAIT_WIDTH - x - totalLaneWidth;
      expect(x).toBe(rightPadding);
    });
  });
});

import fc from 'fast-check';
import { STRUMLINE_LANE_WIDTH as LANE_WIDTH } from '../src/layout/LayoutManager.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// ========================================
// PROPERTY-BASED TESTS
// ========================================

describe('LayoutManager Property Tests', () => {
  // ========================================
  // Property 2: Player strumline is centered with equal padding
  // Tag: Feature: mobile-portrait-mode, Property 2: Player strumline is centered with equal padding
  // **Validates: Requirements 4.1, 4.4**
  // ========================================
  describe('Property 2: Player strumline is centered with equal padding', () => {
    it('strumline X SHALL equal (canvasWidth - strumlineWidth) / 2 for any canvas width', () => {
      const strumlineWidth = 4 * LANE_WIDTH; // 4 lanes × 112px = 448px

      fc.assert(
        fc.property(
          fc.integer({ min: strumlineWidth, max: 4000 }),
          (canvasWidth) => {
            const expectedX = (canvasWidth - strumlineWidth) / 2;
            const actualX = computeStrumlineX(canvasWidth);

            expect(actualX).toBe(expectedX);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('left and right padding SHALL be equal for any canvas width', () => {
      const laneCount = 4;
      const strumlineWidth = laneCount * LANE_WIDTH;

      fc.assert(
        fc.property(
          fc.integer({ min: strumlineWidth, max: 4000 }),
          (canvasWidth) => {
            const x = computeStrumlineX(canvasWidth);
            const leftPadding = x;
            const rightPadding = canvasWidth - x - strumlineWidth;

            expect(leftPadding).toBe(rightPadding);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('strumline X SHALL be non-negative when canvas width >= strumline width', () => {
      const strumlineWidth = 4 * LANE_WIDTH;

      fc.assert(
        fc.property(
          fc.integer({ min: strumlineWidth, max: 4000 }),
          (canvasWidth) => {
            const x = computeStrumlineX(canvasWidth);
            expect(x).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('centering SHALL hold for any lane count and lane width', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 4000 }), // canvasWidth
          fc.integer({ min: 1, max: 8 }),        // laneCount
          fc.integer({ min: 10, max: 200 }),     // laneWidth
          (canvasWidth, laneCount, laneWidth) => {
            const strumlineWidth = laneCount * laneWidth;
            // Only test when canvas is wide enough
            fc.pre(canvasWidth >= strumlineWidth);

            const x = computeStrumlineX(canvasWidth, laneCount, laneWidth);
            const expectedX = (canvasWidth - strumlineWidth) / 2;

            expect(x).toBe(expectedX);

            // Equal padding
            const leftPadding = x;
            const rightPadding = canvasWidth - x - strumlineWidth;
            expect(leftPadding).toBe(rightPadding);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

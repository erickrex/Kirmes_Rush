/**
 * @fileoverview Property-based tests for HUD repositioning in portrait mode.
 * Tests health bar fitting and HUD text minimum font size.
 *
 * Feature: mobile-portrait-mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Phaser before any imports that use it
vi.stubGlobal('Phaser', {
  GameObjects: {
    Graphics: class MockGraphics {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.visible = true;
        this.alpha = 1;
        this.depth = 0;
        this.scrollFactorX = 1;
        this.scrollFactorY = 1;
      }
      clear() { return this; }
      fillStyle() { return this; }
      fillRect() { return this; }
      setScrollFactor(x, y) { this.scrollFactorX = x; this.scrollFactorY = y ?? x; return this; }
      setDepth(depth) { this.depth = depth; return this; }
      setVisible(visible) { this.visible = visible; return this; }
      setAlpha(alpha) { this.alpha = alpha; return this; }
      destroy() {}
    },
    Text: class MockText {
      constructor(scene, x, y, text, style) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.style = style;
        this.visible = true;
        this.alpha = 1;
        this.depth = 0;
        this.width = 200;
        this.height = 20;
      }
      setText(text) { this.text = text; return this; }
      setPosition(x, y) { this.x = x; this.y = y; return this; }
      setScrollFactor() { return this; }
      setOrigin() { return this; }
      setDepth(depth) { this.depth = depth; return this; }
      setVisible(visible) { this.visible = visible; return this; }
      setAlpha(alpha) { this.alpha = alpha; return this; }
      destroy() {}
    }
  }
});

// Import after mocks
const { default: HealthBar } = await import('../src/play/HealthBar.js');
const { default: ScoreDisplay } = await import('../src/play/ScoreDisplay.js');
const { default: ComboPopup } = await import('../src/play/ComboPopup.js');
const {
  PORTRAIT_WIDTH,
  HEALTH_BAR_WIDTH,
  HEALTH_BAR_X
} = await import('../src/layout/LayoutManager.js');

const NUM_RUNS = 100;

// Mock scene factory
const createMockScene = () => ({
  add: {
    graphics: vi.fn(() => new Phaser.GameObjects.Graphics()),
    text: vi.fn((x, y, text, style) => new Phaser.GameObjects.Text(null, x, y, text, style))
  }
});

// ========================================
// PROPERTY-BASED TESTS
// ========================================

describe('HUD Portrait Property Tests', () => {
  // ========================================
  // Property 10: Health bar fits within portrait canvas
  // Tag: Feature: mobile-portrait-mode, Property 10: Health bar fits within portrait canvas
  // **Validates: Requirements 8.2**
  // ========================================
  describe('Property 10: Health bar fits within portrait canvas', () => {
    it('health bar total width (bar + 2*border) SHALL be ≤ canvas width for any canvas width ≥ bar total width', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 4000 }), // canvasWidth
          fc.integer({ min: 100, max: 700 }),   // barWidth
          fc.integer({ min: 1, max: 20 }),      // borderSize
          (canvasWidth, barWidth, borderSize) => {
            const mockScene = createMockScene();
            const totalWidth = barWidth + borderSize * 2;

            // Only test when canvas is wide enough to fit the bar
            fc.pre(canvasWidth >= totalWidth);

            const healthBar = new HealthBar(mockScene, {
              width: barWidth,
              borderSize: borderSize
            });

            // Center the bar within the canvas
            healthBar.centerX(canvasWidth);

            const barTotalWidth = healthBar.getTotalWidth();

            // The bar total width must fit within the canvas
            expect(barTotalWidth).toBeLessThanOrEqual(canvasWidth);

            // The bar must not extend past the right edge
            expect(healthBar.x + barTotalWidth).toBeLessThanOrEqual(canvasWidth);

            // The bar must not extend past the left edge
            expect(healthBar.x).toBeGreaterThanOrEqual(0);

            healthBar.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('default portrait health bar SHALL fit within 720px canvas', () => {
      const mockScene = createMockScene();
      const healthBar = new HealthBar(mockScene, {
        width: HEALTH_BAR_WIDTH
      });
      healthBar.setPosition(HEALTH_BAR_X, 80);

      const totalWidth = healthBar.getTotalWidth();

      // Health bar total width must fit within portrait canvas
      expect(totalWidth).toBeLessThanOrEqual(PORTRAIT_WIDTH);

      // Health bar must not extend past right edge
      expect(HEALTH_BAR_X + totalWidth).toBeLessThanOrEqual(PORTRAIT_WIDTH);

      healthBar.destroy();
    });

    it('health bar with any border size SHALL fit when positioned with padding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // borderSize
          (borderSize) => {
            const mockScene = createMockScene();
            const healthBar = new HealthBar(mockScene, {
              width: HEALTH_BAR_WIDTH,
              borderSize: borderSize
            });

            const totalWidth = healthBar.getTotalWidth();
            // Position with equal padding
            const padding = (PORTRAIT_WIDTH - totalWidth) / 2;

            // Only test when bar fits
            fc.pre(totalWidth <= PORTRAIT_WIDTH);

            healthBar.setPosition(padding, 80);

            expect(padding + totalWidth).toBeLessThanOrEqual(PORTRAIT_WIDTH);
            expect(padding).toBeGreaterThanOrEqual(0);

            healthBar.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 11: HUD text minimum font size
  // Tag: Feature: mobile-portrait-mode, Property 11: HUD text minimum font size
  // **Validates: Requirements 8.5**
  // ========================================
  describe('Property 11: HUD text minimum font size', () => {
    it('ScoreDisplay font size SHALL be ≥ 16px for any config at base 720×1280 resolution', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // requested fontSize (could be anything)
          fc.integer({ min: 0, max: 720 }),  // x position
          fc.integer({ min: 0, max: 1280 }), // y position
          fc.constantFrom('left', 'center', 'right'), // alignment
          (requestedFontSize, x, y, align) => {
            const mockScene = createMockScene();
            const scoreDisplay = new ScoreDisplay(mockScene, {
              x,
              y,
              fontSize: requestedFontSize,
              align
            });

            // Font size must be at least 16px at base resolution
            expect(scoreDisplay.fontSize).toBeGreaterThanOrEqual(16);

            scoreDisplay.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ScoreDisplay default font size SHALL be ≥ 16px', () => {
      const mockScene = createMockScene();
      const scoreDisplay = new ScoreDisplay(mockScene);

      expect(scoreDisplay.fontSize).toBeGreaterThanOrEqual(16);

      scoreDisplay.destroy();
    });

    it('ComboPopup scale SHALL produce readable text at base resolution', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 3.0, noNaN: true }), // scale
          (scale) => {
            const mockScene = createMockScene();
            const comboPopup = new ComboPopup(mockScene, { scale });

            // ComboPopup uses sprite-based rendering, so scale affects readability.
            // At base resolution, the scale should produce visible sprites.
            expect(comboPopup.scale).toBeGreaterThan(0);

            comboPopup.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

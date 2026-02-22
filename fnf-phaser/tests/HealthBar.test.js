/**
 * @fileoverview Tests for HealthBar - Visual health bar display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Phaser
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
      clear() {
        return this;
      }
      fillStyle() {
        return this;
      }
      fillRect() {
        return this;
      }
      setScrollFactor(x, y) {
        this.scrollFactorX = x;
        this.scrollFactorY = y ?? x;
        return this;
      }
      setDepth(depth) {
        this.depth = depth;
        return this;
      }
      setVisible(visible) {
        this.visible = visible;
        return this;
      }
      setAlpha(alpha) {
        this.alpha = alpha;
        return this;
      }
      destroy() {}
    }
  }
});

// Import after mocks
const { default: HealthBar } = await import('../src/play/HealthBar.js');
const Constants = await import('../src/core/Constants.js');

// Mock scene
const createMockScene = () => ({
  add: {
    graphics: vi.fn(() => new Phaser.GameObjects.Graphics())
  }
});

describe('HealthBar', () => {
  let healthBar;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    healthBar = new HealthBar(mockScene);
  });

  afterEach(() => {
    healthBar.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(healthBar.scene).toBe(mockScene);
      expect(healthBar.x).toBe(0);
      expect(healthBar.y).toBe(0);
      expect(healthBar.width).toBe(600);
      expect(healthBar.height).toBe(20);
      expect(healthBar.borderSize).toBe(4);
      expect(healthBar.value).toBe(Constants.HEALTH_STARTING);
    });

    it('should accept custom configuration', () => {
      const customBar = new HealthBar(mockScene, {
        x: 100,
        y: 200,
        width: 400,
        height: 30,
        borderSize: 6,
        playerColor: 0x00ff00,
        opponentColor: 0xff0000,
        backgroundColor: 0x333333
      });

      expect(customBar.x).toBe(100);
      expect(customBar.y).toBe(200);
      expect(customBar.width).toBe(400);
      expect(customBar.height).toBe(30);
      expect(customBar.borderSize).toBe(6);
      expect(customBar.playerColor).toBe(0x00ff00);
      expect(customBar.opponentColor).toBe(0xff0000);
      expect(customBar.backgroundColor).toBe(0x333333);

      customBar.destroy();
    });

    it('should use default colors from Constants', () => {
      expect(healthBar.playerColor).toBe(Constants.COLOR_HEALTH_BAR_GREEN);
      expect(healthBar.opponentColor).toBe(Constants.COLOR_HEALTH_BAR_RED);
    });

    it('should create graphics objects', () => {
      expect(healthBar.backgroundGraphics).not.toBeNull();
      expect(healthBar.barGraphics).not.toBeNull();
      expect(mockScene.add.graphics).toHaveBeenCalledTimes(2);
    });
  });

  describe('setHealth', () => {
    it('should set target value', () => {
      healthBar.setHealth(1.5);
      expect(healthBar.targetValue).toBe(1.5);
    });

    it('should clamp to min value', () => {
      healthBar.setHealth(-1);
      expect(healthBar.targetValue).toBe(Constants.HEALTH_MIN);
    });

    it('should clamp to max value', () => {
      healthBar.setHealth(5);
      expect(healthBar.targetValue).toBe(Constants.HEALTH_MAX);
    });

    it('should mark as dirty', () => {
      healthBar.dirty = false;
      healthBar.setHealth(1.5);
      expect(healthBar.dirty).toBe(true);
    });
  });

  describe('setHealthImmediate', () => {
    it('should set value immediately', () => {
      healthBar.setHealthImmediate(1.5);
      expect(healthBar.value).toBe(1.5);
      expect(healthBar.targetValue).toBe(1.5);
    });

    it('should clamp values', () => {
      healthBar.setHealthImmediate(-1);
      expect(healthBar.value).toBe(Constants.HEALTH_MIN);

      healthBar.setHealthImmediate(5);
      expect(healthBar.value).toBe(Constants.HEALTH_MAX);
    });
  });

  describe('setPosition', () => {
    it('should set x and y position', () => {
      healthBar.setPosition(100, 200);
      expect(healthBar.x).toBe(100);
      expect(healthBar.y).toBe(200);
    });

    it('should return this for chaining', () => {
      const result = healthBar.setPosition(100, 200);
      expect(result).toBe(healthBar);
    });

    it('should mark as dirty', () => {
      healthBar.dirty = false;
      healthBar.setPosition(100, 200);
      expect(healthBar.dirty).toBe(true);
    });
  });

  describe('centerX', () => {
    it('should center horizontally on screen', () => {
      healthBar.width = 600;
      healthBar.borderSize = 4;
      healthBar.centerX(1280);

      const totalWidth = 600 + 4 * 2; // 608
      const expectedX = (1280 - totalWidth) / 2; // 336
      expect(healthBar.x).toBe(expectedX);
    });

    it('should use default screen width', () => {
      healthBar.width = 600;
      healthBar.borderSize = 4;
      healthBar.centerX();

      const totalWidth = 600 + 4 * 2;
      const expectedX = (1280 - totalWidth) / 2;
      expect(healthBar.x).toBe(expectedX);
    });
  });

  describe('setColors', () => {
    it('should set player and opponent colors', () => {
      healthBar.setColors(0x00ff00, 0x0000ff);
      expect(healthBar.playerColor).toBe(0x00ff00);
      expect(healthBar.opponentColor).toBe(0x0000ff);
    });

    it('should return this for chaining', () => {
      const result = healthBar.setColors(0x00ff00, 0x0000ff);
      expect(result).toBe(healthBar);
    });
  });

  describe('setLerpSpeed', () => {
    it('should set lerp speed', () => {
      healthBar.setLerpSpeed(0.5);
      expect(healthBar.lerpSpeed).toBe(0.5);
    });

    it('should clamp to 0-1 range', () => {
      healthBar.setLerpSpeed(-0.5);
      expect(healthBar.lerpSpeed).toBe(0);

      healthBar.setLerpSpeed(1.5);
      expect(healthBar.lerpSpeed).toBe(1);
    });
  });

  describe('getPercent', () => {
    it('should return 0.5 at starting health', () => {
      healthBar.value = Constants.HEALTH_STARTING;
      expect(healthBar.getPercent()).toBe(0.5);
    });

    it('should return 0 at min health', () => {
      healthBar.value = Constants.HEALTH_MIN;
      expect(healthBar.getPercent()).toBe(0);
    });

    it('should return 1 at max health', () => {
      healthBar.value = Constants.HEALTH_MAX;
      expect(healthBar.getPercent()).toBe(1);
    });

    it('should return correct percentage for arbitrary values', () => {
      healthBar.value = 1.0; // 50% of max (2.0)
      expect(healthBar.getPercent()).toBe(0.5);

      healthBar.value = 0.5; // 25% of max
      expect(healthBar.getPercent()).toBe(0.25);
    });
  });

  describe('getCenterX', () => {
    it('should return center position based on health', () => {
      healthBar.x = 0;
      healthBar.borderSize = 4;
      healthBar.width = 600;

      // At 50% health, divider should be at center
      healthBar.value = 1.0; // 50%
      const centerX = healthBar.getCenterX();
      expect(centerX).toBe(4 + 300); // borderSize + half width
    });

    it('should return left edge at full health', () => {
      healthBar.x = 0;
      healthBar.borderSize = 4;
      healthBar.width = 600;
      healthBar.value = Constants.HEALTH_MAX;

      const centerX = healthBar.getCenterX();
      expect(centerX).toBe(4); // Just the border
    });

    it('should return right edge at zero health', () => {
      healthBar.x = 0;
      healthBar.borderSize = 4;
      healthBar.width = 600;
      healthBar.value = Constants.HEALTH_MIN;

      const centerX = healthBar.getCenterX();
      expect(centerX).toBe(4 + 600); // border + full width
    });
  });

  describe('getCenterY', () => {
    it('should return vertical center', () => {
      healthBar.y = 100;
      healthBar.height = 20;
      healthBar.borderSize = 4;

      const centerY = healthBar.getCenterY();
      expect(centerY).toBe(100 + (20 + 4 * 2) / 2); // 114
    });
  });

  describe('update', () => {
    it('should lerp value towards target', () => {
      healthBar.value = 1.0;
      healthBar.targetValue = 2.0;
      healthBar.lerpSpeed = 0.5;

      healthBar.update(16.67);

      expect(healthBar.value).toBeGreaterThan(1.0);
      expect(healthBar.value).toBeLessThan(2.0);
    });

    it('should snap when close to target', () => {
      healthBar.value = 1.999;
      healthBar.targetValue = 2.0;

      healthBar.update(16.67);

      expect(healthBar.value).toBe(2.0);
    });

    it('should not change value when at target', () => {
      healthBar.value = 1.5;
      healthBar.targetValue = 1.5;
      healthBar.dirty = false;

      healthBar.update(16.67);

      expect(healthBar.value).toBe(1.5);
    });

    it('should call draw when dirty', () => {
      healthBar.dirty = true;
      const drawSpy = vi.spyOn(healthBar, 'draw');

      healthBar.update(16.67);

      expect(drawSpy).toHaveBeenCalled();
      expect(healthBar.dirty).toBe(false);
    });
  });

  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(healthBar.lerp(0, 10, 0)).toBe(0);
      expect(healthBar.lerp(0, 10, 0.5)).toBe(5);
      expect(healthBar.lerp(0, 10, 1)).toBe(10);
    });

    it('should handle negative values', () => {
      expect(healthBar.lerp(-10, 10, 0.5)).toBe(0);
    });
  });

  describe('draw', () => {
    it('should call drawBackground and drawBar', () => {
      const bgSpy = vi.spyOn(healthBar, 'drawBackground');
      const barSpy = vi.spyOn(healthBar, 'drawBar');

      healthBar.draw();

      expect(bgSpy).toHaveBeenCalled();
      expect(barSpy).toHaveBeenCalled();
    });
  });

  describe('drawBackground', () => {
    it('should draw background rectangle', () => {
      const clearSpy = vi.spyOn(healthBar.backgroundGraphics, 'clear');
      const fillStyleSpy = vi.spyOn(healthBar.backgroundGraphics, 'fillStyle');
      const fillRectSpy = vi.spyOn(healthBar.backgroundGraphics, 'fillRect');

      healthBar.drawBackground();

      expect(clearSpy).toHaveBeenCalled();
      expect(fillStyleSpy).toHaveBeenCalledWith(healthBar.backgroundColor, 1);
      expect(fillRectSpy).toHaveBeenCalled();
    });

    it('should not draw if showBackground is false', () => {
      healthBar.showBackground = false;
      healthBar.backgroundGraphics = null;

      // Should not throw
      expect(() => healthBar.drawBackground()).not.toThrow();
    });
  });

  describe('drawBar', () => {
    it('should draw both player and opponent sections', () => {
      const clearSpy = vi.spyOn(healthBar.barGraphics, 'clear');
      const fillStyleSpy = vi.spyOn(healthBar.barGraphics, 'fillStyle');
      const fillRectSpy = vi.spyOn(healthBar.barGraphics, 'fillRect');

      healthBar.value = 1.0; // 50% health
      healthBar.drawBar();

      expect(clearSpy).toHaveBeenCalled();
      expect(fillStyleSpy).toHaveBeenCalledTimes(2); // Once for each color
      expect(fillRectSpy).toHaveBeenCalledTimes(2); // Once for each section
    });

    it('should draw only opponent section at zero health', () => {
      const fillRectSpy = vi.spyOn(healthBar.barGraphics, 'fillRect');

      healthBar.value = 0;
      healthBar.drawBar();

      // Only opponent (red) section should be drawn
      expect(fillRectSpy).toHaveBeenCalledTimes(1);
    });

    it('should draw only player section at full health', () => {
      const fillRectSpy = vi.spyOn(healthBar.barGraphics, 'fillRect');

      healthBar.value = Constants.HEALTH_MAX;
      healthBar.drawBar();

      // Only player (green) section should be drawn
      expect(fillRectSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('setDepth', () => {
    it('should set depth on graphics objects', () => {
      healthBar.setDepth(100);

      expect(healthBar.backgroundGraphics.depth).toBe(100);
      expect(healthBar.barGraphics.depth).toBe(101);
    });

    it('should return this for chaining', () => {
      const result = healthBar.setDepth(100);
      expect(result).toBe(healthBar);
    });
  });

  describe('setVisible', () => {
    it('should set visibility on graphics objects', () => {
      healthBar.setVisible(false);

      expect(healthBar.backgroundGraphics.visible).toBe(false);
      expect(healthBar.barGraphics.visible).toBe(false);
    });

    it('should return this for chaining', () => {
      const result = healthBar.setVisible(true);
      expect(result).toBe(healthBar);
    });
  });

  describe('setAlpha', () => {
    it('should set alpha on graphics objects', () => {
      healthBar.setAlpha(0.5);

      expect(healthBar.backgroundGraphics.alpha).toBe(0.5);
      expect(healthBar.barGraphics.alpha).toBe(0.5);
    });

    it('should return this for chaining', () => {
      const result = healthBar.setAlpha(0.5);
      expect(result).toBe(healthBar);
    });
  });

  describe('getTotalWidth', () => {
    it('should return width plus border', () => {
      healthBar.width = 600;
      healthBar.borderSize = 4;

      expect(healthBar.getTotalWidth()).toBe(608);
    });
  });

  describe('getTotalHeight', () => {
    it('should return height plus border', () => {
      healthBar.height = 20;
      healthBar.borderSize = 4;

      expect(healthBar.getTotalHeight()).toBe(28);
    });
  });

  describe('destroy', () => {
    it('should destroy graphics objects', () => {
      const bgDestroySpy = vi.spyOn(healthBar.backgroundGraphics, 'destroy');
      const barDestroySpy = vi.spyOn(healthBar.barGraphics, 'destroy');

      healthBar.destroy();

      expect(bgDestroySpy).toHaveBeenCalled();
      expect(barDestroySpy).toHaveBeenCalled();
      expect(healthBar.backgroundGraphics).toBeNull();
      expect(healthBar.barGraphics).toBeNull();
      expect(healthBar.scene).toBeNull();
    });
  });

  describe('no background mode', () => {
    it('should not create background graphics when showBackground is false', () => {
      const noBackgroundBar = new HealthBar(mockScene, { showBackground: false });

      expect(noBackgroundBar.backgroundGraphics).toBeNull();
      expect(noBackgroundBar.barGraphics).not.toBeNull();

      noBackgroundBar.destroy();
    });
  });
});

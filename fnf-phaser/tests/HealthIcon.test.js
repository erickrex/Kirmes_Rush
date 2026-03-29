/**
 * @fileoverview Tests for HealthIcon - Character health icon display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Setup Phaser mock BEFORE any imports that use it
vi.stubGlobal('Phaser', {
  GameObjects: {
    Sprite: class MockSprite {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.visible = true;
        this.alpha = 1;
        this.angle = 0;
        this.flipX = false;
        this.displayWidth = 150;
        this.displayHeight = 150;
        this.scrollFactorX = 1;
        this.scrollFactorY = 1;
        this.anims = { currentAnim: null };
        this._listeners = {};
      }
      on(event, fn) {
        this._listeners[event] = this._listeners[event] || [];
        this._listeners[event].push(fn);
        return this;
      }
      off(event, fn) {
        return this;
      }
      emit(event, ...args) {
        return this;
      }
      setOrigin() {
        return this;
      }
      setScale() {
        return this;
      }
      setPosition(x, y) {
        this.x = x;
        this.y = y;
        return this;
      }
      setVisible(v) {
        this.visible = v;
        return this;
      }
      setAlpha(a) {
        this.alpha = a;
        return this;
      }
      setScrollFactor(x, y) {
        this.scrollFactorX = x;
        this.scrollFactorY = y ?? x;
        return this;
      }
      setDisplaySize(w, h) {
        this.displayWidth = w;
        this.displayHeight = h;
        return this;
      }
      destroy() {}
    }
  },
  Math: {
    Clamp: (value, min, max) => Math.min(Math.max(value, min), max)
  }
});

// Import after mocks
const { default: HealthIcon, HealthIconState } = await import('../src/play/HealthIcon.js');
const Constants = await import('../src/core/Constants.js');

// Mock scene
const createMockScene = () => ({
  add: {
    existing: vi.fn()
  }
});

// Mock health bar
const createMockHealthBar = () => ({
  x: 100,
  y: 200,
  width: 600,
  height: 20,
  borderSize: 4,
  getPercent: vi.fn(() => 0.5),
  getTotalHeight: vi.fn(() => 28)
});

describe('HealthIcon', () => {
  let healthIcon;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    healthIcon = new HealthIcon(mockScene, 0, 0, 'bf', 0);
  });

  afterEach(() => {
    healthIcon.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const icon = new HealthIcon(mockScene);

      expect(icon.characterId).toBe(Constants.DEFAULT_HEALTH_ICON);
      expect(icon.playerId).toBe(0);
      expect(icon.autoUpdate).toBe(true);
      expect(icon.size).toEqual({ x: 1.0, y: 1.0 });
      expect(icon.iconOffset).toEqual({ x: 0, y: 0 });

      icon.destroy();
    });

    it('should accept custom character and player ID', () => {
      expect(healthIcon.characterId).toBe('bf');
      expect(healthIcon.playerId).toBe(0);
    });

    it('should set scroll factor to 0 for HUD', () => {
      expect(healthIcon.scrollFactorX).toBe(0);
      expect(healthIcon.scrollFactorY).toBe(0);
    });
  });

  describe('configure', () => {
    it('should configure from data object', () => {
      healthIcon.configure({
        id: 'dad',
        isPixel: true,
        scale: 1.5,
        offsets: [10, 20],
        flipX: true
      });

      expect(healthIcon.characterId).toBe('dad');
      expect(healthIcon.isPixel).toBe(true);
      expect(healthIcon.size).toEqual({ x: 1.5, y: 1.5 });
      expect(healthIcon.iconOffset).toEqual({ x: 10, y: 20 });
      expect(healthIcon.flipX).toBe(true);
    });

    it('should use defaults when data is null', () => {
      healthIcon.configure(null);

      expect(healthIcon.characterId).toBe(Constants.DEFAULT_HEALTH_ICON);
      expect(healthIcon.isPixel).toBe(false);
      expect(healthIcon.size).toEqual({ x: 1.0, y: 1.0 });
      expect(healthIcon.iconOffset).toEqual({ x: 0, y: 0 });
      expect(healthIcon.flipX).toBe(false);
    });

    it('should handle missing offsets', () => {
      healthIcon.configure({ id: 'test' });

      expect(healthIcon.iconOffset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('HealthIconState', () => {
    it('should have all required states', () => {
      expect(HealthIconState.IDLE).toBe('idle');
      expect(HealthIconState.WINNING).toBe('winning');
      expect(HealthIconState.LOSING).toBe('losing');
      expect(HealthIconState.TO_WINNING).toBe('toWinning');
      expect(HealthIconState.TO_LOSING).toBe('toLosing');
      expect(HealthIconState.FROM_WINNING).toBe('fromWinning');
      expect(HealthIconState.FROM_LOSING).toBe('fromLosing');
    });
  });

  describe('updateHealthIcon', () => {
    it('should stay idle at normal health', () => {
      healthIcon.currentState = HealthIconState.IDLE;
      healthIcon.updateHealthIcon(1.0); // 50% health

      expect(healthIcon.currentState).toBe(HealthIconState.IDLE);
    });

    it('should transition to losing at low health', () => {
      healthIcon.currentState = HealthIconState.IDLE;
      healthIcon.updateHealthIcon(0.2); // 10% health

      expect(healthIcon.currentState).toBe(HealthIconState.TO_LOSING);
    });

    it('should transition to winning at high health', () => {
      healthIcon.currentState = HealthIconState.IDLE;
      healthIcon.updateHealthIcon(1.8); // 90% health

      expect(healthIcon.currentState).toBe(HealthIconState.TO_WINNING);
    });

    it('should transition from winning to idle when health drops', () => {
      healthIcon.currentState = HealthIconState.WINNING;
      healthIcon.updateHealthIcon(1.0); // 50% health

      expect(healthIcon.currentState).toBe(HealthIconState.FROM_WINNING);
    });

    it('should transition from losing to idle when health rises', () => {
      healthIcon.currentState = HealthIconState.LOSING;
      healthIcon.updateHealthIcon(1.0); // 50% health

      expect(healthIcon.currentState).toBe(HealthIconState.FROM_LOSING);
    });
  });

  describe('playIconAnimation', () => {
    it('should set current state', () => {
      healthIcon.playIconAnimation(HealthIconState.WINNING);
      expect(healthIcon.currentState).toBe(HealthIconState.WINNING);
    });

    it('should handle legacy icons', () => {
      healthIcon.isLegacyStyle = true;
      healthIcon.playIconAnimation(HealthIconState.LOSING);
      expect(healthIcon.currentState).toBe(HealthIconState.LOSING);
    });
  });

  describe('isAnimationFinished', () => {
    it('should return true for legacy icons', () => {
      healthIcon.isLegacyStyle = true;
      expect(healthIcon.isAnimationFinished()).toBe(true);
    });

    it('should check animation state for animated icons', () => {
      healthIcon.isLegacyStyle = false;
      healthIcon.anims = { isPlaying: true };
      expect(healthIcon.isAnimationFinished()).toBe(false);

      healthIcon.anims = { isPlaying: false };
      expect(healthIcon.isAnimationFinished()).toBe(true);
    });
  });

  describe('onStepHit', () => {
    it('should bop on beat (every 4 steps)', () => {
      healthIcon.bopEvery = 4;
      healthIcon.isLegacyStyle = true;
      const bopSpy = vi.spyOn(healthIcon, 'bop');

      healthIcon.onStepHit(4);
      expect(bopSpy).toHaveBeenCalled();

      bopSpy.mockClear();
      healthIcon.onStepHit(5);
      expect(bopSpy).not.toHaveBeenCalled();
    });

    it('should not bop if bopEvery is 0', () => {
      healthIcon.bopEvery = 0;
      const bopSpy = vi.spyOn(healthIcon, 'bop');

      healthIcon.onStepHit(4);
      expect(bopSpy).not.toHaveBeenCalled();
    });

    it('should not bop non-legacy icons', () => {
      healthIcon.bopEvery = 4;
      healthIcon.isLegacyStyle = false;
      const bopSpy = vi.spyOn(healthIcon, 'bop');

      healthIcon.onStepHit(4);
      expect(bopSpy).not.toHaveBeenCalled();
    });
  });

  describe('bop', () => {
    it('should increase display size', () => {
      healthIcon.size = { x: 1.0, y: 1.0 };
      healthIcon.isPixel = false;
      healthIcon.displayWidth = 150;
      healthIcon.displayHeight = 150;

      healthIcon.bop();

      // Size should increase by BOP_SCALE (20%)
      const expectedSize = 150 * 1.2;
      expect(healthIcon.displayWidth).toBe(expectedSize);
      expect(healthIcon.displayHeight).toBe(expectedSize);
    });

    it('should apply angle twist if configured', () => {
      healthIcon.bopAngle = 15;
      healthIcon.playerId = 0;
      healthIcon.angle = 0;

      healthIcon.bop();

      expect(healthIcon.angle).toBe(15);
    });

    it('should twist opposite direction for opponent', () => {
      healthIcon.bopAngle = 15;
      healthIcon.playerId = 1;
      healthIcon.angle = 0;

      healthIcon.bop();

      expect(healthIcon.angle).toBe(-15);
    });
  });

  describe('lerpIconSize', () => {
    it('should lerp towards target size', () => {
      healthIcon.size = { x: 1.0, y: 1.0 };
      healthIcon.isPixel = false;
      healthIcon.displayWidth = 180; // Larger than target (150)

      healthIcon.lerpIconSize();

      expect(healthIcon.displayWidth).toBeLessThan(180);
      expect(healthIcon.displayWidth).toBeGreaterThan(150);
    });

    it('should snap to target when forced', () => {
      healthIcon.size = { x: 1.0, y: 1.0 };
      healthIcon.isPixel = false;
      healthIcon.displayWidth = 180;

      healthIcon.lerpIconSize(true);

      expect(healthIcon.displayWidth).toBe(150);
    });

    it('should use pixel size for pixel icons', () => {
      healthIcon.size = { x: 1.0, y: 1.0 };
      healthIcon.isPixel = true;

      healthIcon.lerpIconSize(true);

      expect(healthIcon.displayWidth).toBe(HealthIcon.PIXEL_ICON_SIZE);
    });
  });

  describe('smoothLerp', () => {
    it('should interpolate values', () => {
      const result = healthIcon.smoothLerp(0, 100, 0.5);
      expect(result).toBe(50);
    });

    it('should snap when close to target', () => {
      const result = healthIcon.smoothLerp(99.95, 100, 0.5);
      expect(result).toBe(100);
    });
  });

  describe('snapToTargetSize', () => {
    it('should call lerpIconSize with force', () => {
      const lerpSpy = vi.spyOn(healthIcon, 'lerpIconSize');

      healthIcon.snapToTargetSize();

      expect(lerpSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('update', () => {
    it('should lerp size back to normal', () => {
      healthIcon.bopEvery = 4;
      const lerpSpy = vi.spyOn(healthIcon, 'lerpIconSize');

      healthIcon.update(16.67);

      expect(lerpSpy).toHaveBeenCalled();
    });

    it('should lerp angle back to 0', () => {
      healthIcon.bopEvery = 4;
      healthIcon.angle = 15;

      healthIcon.update(16.67);

      expect(healthIcon.angle).toBeLessThan(15);
    });

    it('should auto-update health state when enabled', () => {
      healthIcon.autoUpdate = true;
      healthIcon.playerId = 0;
      const updateSpy = vi.spyOn(healthIcon, 'updateHealthIcon');

      healthIcon.update(16.67, 1.0);

      expect(updateSpy).toHaveBeenCalledWith(1.0);
    });

    it('should invert health for opponent', () => {
      healthIcon.autoUpdate = true;
      healthIcon.playerId = 1;
      const updateSpy = vi.spyOn(healthIcon, 'updateHealthIcon');

      healthIcon.update(16.67, 0.5);

      // Opponent health is inverted: 2.0 - 0.5 = 1.5
      expect(updateSpy).toHaveBeenCalledWith(1.5);
    });

    it('should not auto-update when disabled', () => {
      healthIcon.autoUpdate = false;
      const updateSpy = vi.spyOn(healthIcon, 'updateHealthIcon');

      healthIcon.update(16.67, 1.0);

      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('updatePosition', () => {
    it('should position player icon relative to health bar', () => {
      const mockHealthBar = createMockHealthBar();
      mockHealthBar.getPercent.mockReturnValue(0.5);

      healthIcon.playerId = 0;
      healthIcon.displayWidth = 150;
      healthIcon.displayHeight = 150;
      healthIcon.iconOffset = { x: 0, y: 0 };

      healthIcon.updatePosition(mockHealthBar);

      // At 50% health, divider is at center
      // Player icon should be at: barX + barWidth * (1 - 0.5) - POSITION_OFFSET
      // = 104 + 600 * 0.5 - 26 = 104 + 300 - 26 = 378
      expect(healthIcon.x).toBe(104 + 300 - 26);
    });

    it('should position opponent icon relative to health bar', () => {
      const mockHealthBar = createMockHealthBar();
      mockHealthBar.getPercent.mockReturnValue(0.5);

      healthIcon.playerId = 1;
      healthIcon.displayWidth = 150;
      healthIcon.displayHeight = 150;
      healthIcon.iconOffset = { x: 0, y: 0 };

      healthIcon.updatePosition(mockHealthBar);

      // Opponent icon should be at: barX + barWidth * (1 - 0.5) - width + POSITION_OFFSET
      // = 104 + 300 - 150 + 26 = 280
      expect(healthIcon.x).toBe(104 + 300 - 150 + 26);
    });

    it('should center vertically on health bar', () => {
      const mockHealthBar = createMockHealthBar();
      healthIcon.displayHeight = 150;

      healthIcon.updatePosition(mockHealthBar);

      // y = healthBar.y + totalHeight/2 - displayHeight/2
      // = 200 + 14 - 75 = 139
      expect(healthIcon.y).toBe(200 + 14 - 75);
    });

    it('should apply icon offset', () => {
      const mockHealthBar = createMockHealthBar();
      healthIcon.iconOffset = { x: 10, y: -5 };
      healthIcon.playerId = 0;

      const baseX = healthIcon.x;
      const baseY = healthIcon.y;

      healthIcon.updatePosition(mockHealthBar);

      // Offset should be applied
      expect(healthIcon.x).toBe(104 + 300 - 26 + 10);
      expect(healthIcon.y).toBe(200 + 14 - 75 - 5);
    });

    it('should handle null health bar', () => {
      expect(() => healthIcon.updatePosition(null)).not.toThrow();
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      healthIcon.currentState = HealthIconState.WINNING;
      expect(healthIcon.getState()).toBe(HealthIconState.WINNING);
    });
  });

  describe('setState', () => {
    it('should set state via playIconAnimation', () => {
      const playSpy = vi.spyOn(healthIcon, 'playIconAnimation');

      healthIcon.setState(HealthIconState.LOSING);

      expect(playSpy).toHaveBeenCalledWith(HealthIconState.LOSING);
    });
  });

  describe('static create', () => {
    it('should create and add icon to scene', () => {
      const icon = HealthIcon.create(mockScene, 100, 200, 'bf', 0);

      expect(icon).toBeInstanceOf(HealthIcon);
      expect(icon.characterId).toBe('bf');
      expect(icon.playerId).toBe(0);
      expect(mockScene.add.existing).toHaveBeenCalledWith(icon);

      icon.destroy();
    });
  });

  describe('thresholds', () => {
    it('should have correct winning threshold', () => {
      expect(HealthIcon.WINNING_THRESHOLD).toBe(0.8 * Constants.HEALTH_MAX);
    });

    it('should have correct losing threshold', () => {
      expect(HealthIcon.LOSING_THRESHOLD).toBe(0.2 * Constants.HEALTH_MAX);
    });
  });

  describe('constants', () => {
    it('should have correct icon sizes', () => {
      expect(HealthIcon.HEALTH_ICON_SIZE).toBe(150);
      expect(HealthIcon.PIXEL_ICON_SIZE).toBe(32);
    });

    it('should have correct bop scale', () => {
      expect(HealthIcon.BOP_SCALE).toBe(0.2);
    });

    it('should have correct position offset', () => {
      expect(HealthIcon.POSITION_OFFSET).toBe(26);
    });
  });
});

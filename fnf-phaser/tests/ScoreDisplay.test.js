/**
 * @fileoverview Tests for ScoreDisplay - Score and stats display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Phaser
vi.stubGlobal('Phaser', {
  GameObjects: {
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
        this.originX = 0;
        this.originY = 0;
      }
      setText(text) {
        this.text = text;
        return this;
      }
      setPosition(x, y) {
        this.x = x;
        this.y = y;
        return this;
      }
      setScrollFactor() {
        return this;
      }
      setOrigin(x, y) {
        this.originX = x;
        this.originY = y ?? x;
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
const { default: ScoreDisplay } = await import('../src/play/ScoreDisplay.js');

// Mock scene
const createMockScene = () => ({
  add: {
    text: vi.fn((x, y, text, style) => new Phaser.GameObjects.Text(null, x, y, text, style))
  }
});

describe('ScoreDisplay', () => {
  let scoreDisplay;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    scoreDisplay = new ScoreDisplay(mockScene);
  });

  afterEach(() => {
    scoreDisplay.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(scoreDisplay.scene).toBe(mockScene);
      expect(scoreDisplay.x).toBe(0);
      expect(scoreDisplay.y).toBe(0);
      expect(scoreDisplay.score).toBe(0);
      expect(scoreDisplay.combo).toBe(0);
      expect(scoreDisplay.accuracy).toBe(0);
      expect(scoreDisplay.misses).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customDisplay = new ScoreDisplay(mockScene, {
        x: 100,
        y: 200,
        fontSize: 24,
        color: 0xff0000,
        showCombo: false,
        showAccuracy: false,
        showMisses: true,
        align: 'left'
      });

      expect(customDisplay.x).toBe(100);
      expect(customDisplay.y).toBe(200);
      expect(customDisplay.fontSize).toBe(24);
      expect(customDisplay.color).toBe(0xff0000);
      expect(customDisplay.showCombo).toBe(false);
      expect(customDisplay.showAccuracy).toBe(false);
      expect(customDisplay.showMisses).toBe(true);
      expect(customDisplay.align).toBe('left');

      customDisplay.destroy();
    });

    it('should create text object', () => {
      expect(scoreDisplay.text).not.toBeNull();
      expect(mockScene.add.text).toHaveBeenCalled();
    });
  });

  describe('colorToString', () => {
    it('should convert color number to hex string', () => {
      expect(scoreDisplay.colorToString(0xffffff)).toBe('#ffffff');
      expect(scoreDisplay.colorToString(0xff0000)).toBe('#ff0000');
      expect(scoreDisplay.colorToString(0x00ff00)).toBe('#00ff00');
      expect(scoreDisplay.colorToString(0x0000ff)).toBe('#0000ff');
    });

    it('should pad with zeros', () => {
      expect(scoreDisplay.colorToString(0x000001)).toBe('#000001');
      expect(scoreDisplay.colorToString(0x0)).toBe('#000000');
    });
  });

  describe('setScore', () => {
    it('should set target score', () => {
      scoreDisplay.setScore(1000);
      expect(scoreDisplay.targetScore).toBe(1000);
    });

    it('should set score immediately when requested', () => {
      scoreDisplay.setScore(1000, true);
      expect(scoreDisplay.score).toBe(1000);
      expect(scoreDisplay.displayedScore).toBe(1000);
      expect(scoreDisplay.targetScore).toBe(1000);
    });

    it('should mark as dirty', () => {
      scoreDisplay.dirty = false;
      scoreDisplay.setScore(1000);
      expect(scoreDisplay.dirty).toBe(true);
    });
  });

  describe('setCombo', () => {
    it('should set combo', () => {
      scoreDisplay.setCombo(50);
      expect(scoreDisplay.combo).toBe(50);
    });

    it('should mark as dirty', () => {
      scoreDisplay.dirty = false;
      scoreDisplay.setCombo(50);
      expect(scoreDisplay.dirty).toBe(true);
    });
  });

  describe('setAccuracy', () => {
    it('should set accuracy', () => {
      scoreDisplay.setAccuracy(95.5);
      expect(scoreDisplay.accuracy).toBe(95.5);
    });

    it('should clamp to 0-100', () => {
      scoreDisplay.setAccuracy(-10);
      expect(scoreDisplay.accuracy).toBe(0);

      scoreDisplay.setAccuracy(150);
      expect(scoreDisplay.accuracy).toBe(100);
    });
  });

  describe('setMisses', () => {
    it('should set miss count', () => {
      scoreDisplay.setMisses(5);
      expect(scoreDisplay.misses).toBe(5);
    });
  });

  describe('setStats', () => {
    it('should set all stats at once', () => {
      scoreDisplay.setStats({
        score: 5000,
        combo: 25,
        accuracy: 90,
        misses: 3
      });

      expect(scoreDisplay.targetScore).toBe(5000);
      expect(scoreDisplay.combo).toBe(25);
      expect(scoreDisplay.accuracy).toBe(90);
      expect(scoreDisplay.misses).toBe(3);
    });

    it('should only set provided stats', () => {
      scoreDisplay.combo = 10;
      scoreDisplay.setStats({ score: 1000 });

      expect(scoreDisplay.targetScore).toBe(1000);
      expect(scoreDisplay.combo).toBe(10); // Unchanged
    });
  });

  describe('setPosition', () => {
    it('should set position', () => {
      scoreDisplay.setPosition(100, 200);

      expect(scoreDisplay.x).toBe(100);
      expect(scoreDisplay.y).toBe(200);
      expect(scoreDisplay.text.x).toBe(100);
      expect(scoreDisplay.text.y).toBe(200);
    });

    it('should return this for chaining', () => {
      const result = scoreDisplay.setPosition(100, 200);
      expect(result).toBe(scoreDisplay);
    });
  });

  describe('setFormat', () => {
    it('should set format string', () => {
      scoreDisplay.setFormat('Points: {score}');
      expect(scoreDisplay.formatString).toBe('Points: {score}');
    });

    it('should mark as dirty', () => {
      scoreDisplay.dirty = false;
      scoreDisplay.setFormat('test');
      expect(scoreDisplay.dirty).toBe(true);
    });
  });

  describe('setVisibility', () => {
    it('should set visibility options', () => {
      scoreDisplay.setVisibility({
        combo: false,
        accuracy: false,
        misses: true
      });

      expect(scoreDisplay.showCombo).toBe(false);
      expect(scoreDisplay.showAccuracy).toBe(false);
      expect(scoreDisplay.showMisses).toBe(true);
    });

    it('should only change provided options', () => {
      scoreDisplay.showCombo = true;
      scoreDisplay.setVisibility({ accuracy: false });

      expect(scoreDisplay.showCombo).toBe(true); // Unchanged
      expect(scoreDisplay.showAccuracy).toBe(false);
    });
  });

  describe('update', () => {
    it('should lerp score towards target', () => {
      scoreDisplay.displayedScore = 0;
      scoreDisplay.targetScore = 1000;

      scoreDisplay.update(16.67);

      expect(scoreDisplay.displayedScore).toBeGreaterThan(0);
      expect(scoreDisplay.displayedScore).toBeLessThan(1000);
    });

    it('should snap when close to target', () => {
      scoreDisplay.displayedScore = 999;
      scoreDisplay.targetScore = 1000;

      scoreDisplay.update(16.67);

      expect(scoreDisplay.displayedScore).toBe(1000);
    });

    it('should update text when dirty', () => {
      scoreDisplay.dirty = true;
      const updateSpy = vi.spyOn(scoreDisplay, 'updateText');

      scoreDisplay.update(16.67);

      expect(updateSpy).toHaveBeenCalled();
      expect(scoreDisplay.dirty).toBe(false);
    });
  });

  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(scoreDisplay.lerp(0, 100, 0)).toBe(0);
      expect(scoreDisplay.lerp(0, 100, 0.5)).toBe(50);
      expect(scoreDisplay.lerp(0, 100, 1)).toBe(100);
    });
  });

  describe('buildText', () => {
    it('should include score', () => {
      scoreDisplay.score = 5000;
      const text = scoreDisplay.buildText();

      expect(text).toContain('Score:');
      expect(text).toContain('5,000');
    });

    it('should include combo when enabled and > 0', () => {
      scoreDisplay.showCombo = true;
      scoreDisplay.combo = 25;
      const text = scoreDisplay.buildText();

      expect(text).toContain('Combo: 25');
    });

    it('should not include combo when 0', () => {
      scoreDisplay.showCombo = true;
      scoreDisplay.combo = 0;
      const text = scoreDisplay.buildText();

      expect(text).not.toContain('Combo');
    });

    it('should not include combo when disabled', () => {
      scoreDisplay.showCombo = false;
      scoreDisplay.combo = 25;
      const text = scoreDisplay.buildText();

      expect(text).not.toContain('Combo');
    });

    it('should include accuracy when enabled', () => {
      scoreDisplay.showAccuracy = true;
      scoreDisplay.accuracy = 95.55;
      const text = scoreDisplay.buildText();

      expect(text).toContain('Accuracy: 95.55%');
    });

    it('should not include accuracy when disabled', () => {
      scoreDisplay.showAccuracy = false;
      const text = scoreDisplay.buildText();

      expect(text).not.toContain('Accuracy');
    });

    it('should include misses when enabled', () => {
      scoreDisplay.showMisses = true;
      scoreDisplay.misses = 5;
      const text = scoreDisplay.buildText();

      expect(text).toContain('Misses: 5');
    });

    it('should not include misses when disabled', () => {
      scoreDisplay.showMisses = false;
      const text = scoreDisplay.buildText();

      expect(text).not.toContain('Misses');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(scoreDisplay.formatNumber(1000)).toBe('1,000');
      expect(scoreDisplay.formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle small numbers', () => {
      expect(scoreDisplay.formatNumber(0)).toBe('0');
      expect(scoreDisplay.formatNumber(999)).toBe('999');
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate weighted accuracy', () => {
      const tallies = {
        sick: 10,
        good: 0,
        bad: 0,
        shit: 0,
        totalNotesHit: 10,
        totalNotes: 10
      };

      const accuracy = ScoreDisplay.calculateAccuracy(tallies);
      expect(accuracy).toBe(100);
    });

    it('should weight judgements correctly', () => {
      const tallies = {
        sick: 5, // 5 * 1.0 = 5
        good: 5, // 5 * 0.75 = 3.75
        bad: 0,
        shit: 0,
        totalNotesHit: 10,
        totalNotes: 10
      };

      const accuracy = ScoreDisplay.calculateAccuracy(tallies);
      // (5 + 3.75) / 10 * 100 = 87.5%
      expect(accuracy).toBe(87.5);
    });

    it('should return 0 for no notes', () => {
      const tallies = {
        totalNotesHit: 0,
        totalNotes: 0
      };

      const accuracy = ScoreDisplay.calculateAccuracy(tallies);
      expect(accuracy).toBe(0);
    });

    it('should handle missing tally values', () => {
      const tallies = {};
      const accuracy = ScoreDisplay.calculateAccuracy(tallies);
      expect(accuracy).toBe(0);
    });
  });

  describe('setDepth', () => {
    it('should set depth on text', () => {
      scoreDisplay.setDepth(100);
      expect(scoreDisplay.text.depth).toBe(100);
    });

    it('should return this for chaining', () => {
      const result = scoreDisplay.setDepth(100);
      expect(result).toBe(scoreDisplay);
    });
  });

  describe('setVisible', () => {
    it('should set visibility on text', () => {
      scoreDisplay.setVisible(false);
      expect(scoreDisplay.text.visible).toBe(false);
    });
  });

  describe('setAlpha', () => {
    it('should set alpha on text', () => {
      scoreDisplay.setAlpha(0.5);
      expect(scoreDisplay.text.alpha).toBe(0.5);
    });
  });

  describe('getWidth/getHeight', () => {
    it('should return text dimensions', () => {
      expect(scoreDisplay.getWidth()).toBe(200);
      expect(scoreDisplay.getHeight()).toBe(20);
    });

    it('should return 0 if no text', () => {
      scoreDisplay.text = null;
      expect(scoreDisplay.getWidth()).toBe(0);
      expect(scoreDisplay.getHeight()).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should destroy text object', () => {
      const destroySpy = vi.spyOn(scoreDisplay.text, 'destroy');

      scoreDisplay.destroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(scoreDisplay.text).toBeNull();
      expect(scoreDisplay.scene).toBeNull();
    });
  });
});

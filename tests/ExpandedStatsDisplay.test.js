/**
 * @fileoverview Unit tests for the ExpandedStatsDisplay class.
 * Tests extended HUD with NPS, grade, combo breaks, and judgements.
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
const { default: ExpandedStatsDisplay } = await import('../src/play/ExpandedStatsDisplay.js');

// Mock scene
const createMockScene = () => ({
  add: {
    text: vi.fn((x, y, text, style) => new Phaser.GameObjects.Text(null, x, y, text, style))
  }
});

describe('ExpandedStatsDisplay', () => {
  let display;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    display = new ExpandedStatsDisplay(mockScene);
  });

  afterEach(() => {
    display.destroy();
  });

  describe('constructor', () => {
    it('should extend ScoreDisplay', () => {
      expect(display.scene).toBe(mockScene);
      expect(display.score).toBe(0);
      expect(display.combo).toBe(0);
    });

    it('should initialize NPSMeter', () => {
      expect(display.npsMeter).not.toBeNull();
      expect(display.npsMeter.currentNPS).toBe(0);
    });

    it('should initialize GradeDisplay', () => {
      expect(display.gradeDisplay).not.toBeNull();
      expect(display.gradeDisplay.currentGrade).toBe('N/A');
    });

    it('should initialize comboBreaks to 0', () => {
      expect(display.comboBreaks).toBe(0);
    });

    it('should initialize judgements with all counts at 0', () => {
      expect(display.judgements).toEqual({
        sick: 0,
        good: 0,
        bad: 0,
        shit: 0
      });
    });

    it('should initialize default visibility options', () => {
      expect(display.visibilityOptions).toEqual({
        showNPS: true,
        showGrade: true,
        showComboBreaks: true,
        showJudgements: false
      });
    });

    it('should accept custom visibility options', () => {
      const customDisplay = new ExpandedStatsDisplay(mockScene, {
        showNPS: false,
        showGrade: false,
        showComboBreaks: false,
        showJudgements: true
      });

      expect(customDisplay.visibilityOptions).toEqual({
        showNPS: false,
        showGrade: false,
        showComboBreaks: false,
        showJudgements: true
      });

      customDisplay.destroy();
    });

    it('should accept partial visibility options', () => {
      const customDisplay = new ExpandedStatsDisplay(mockScene, {
        showJudgements: true
      });

      expect(customDisplay.visibilityOptions.showNPS).toBe(true);
      expect(customDisplay.visibilityOptions.showJudgements).toBe(true);

      customDisplay.destroy();
    });
  });

  describe('recordHit - Judgement tracking (Requirement 10.1, 10.2)', () => {
    it('should increment sick count for sick judgement', () => {
      display.recordHit('sick', 1000);
      expect(display.judgements.sick).toBe(1);
    });

    it('should increment good count for good judgement', () => {
      display.recordHit('good', 1000);
      expect(display.judgements.good).toBe(1);
    });

    it('should increment bad count for bad judgement', () => {
      display.recordHit('bad', 1000);
      expect(display.judgements.bad).toBe(1);
    });

    it('should increment shit count for shit judgement', () => {
      display.recordHit('shit', 1000);
      expect(display.judgements.shit).toBe(1);
    });

    it('should handle case-insensitive judgement names', () => {
      display.recordHit('SICK', 1000);
      display.recordHit('Good', 1100);
      display.recordHit('BAD', 1200);
      display.recordHit('Shit', 1300);

      expect(display.judgements.sick).toBe(1);
      expect(display.judgements.good).toBe(1);
      expect(display.judgements.bad).toBe(1);
      expect(display.judgements.shit).toBe(1);
    });

    it('should track multiple hits of same judgement', () => {
      display.recordHit('sick', 1000);
      display.recordHit('sick', 1100);
      display.recordHit('sick', 1200);

      expect(display.judgements.sick).toBe(3);
    });

    it('should track hits across different judgements', () => {
      display.recordHit('sick', 1000);
      display.recordHit('good', 1100);
      display.recordHit('sick', 1200);
      display.recordHit('bad', 1300);
      display.recordHit('good', 1400);

      expect(display.judgements.sick).toBe(2);
      expect(display.judgements.good).toBe(2);
      expect(display.judgements.bad).toBe(1);
      expect(display.judgements.shit).toBe(0);
    });

    it('should record hit in NPS meter', () => {
      const recordHitSpy = vi.spyOn(display.npsMeter, 'recordHit');

      display.recordHit('sick', 1000);

      expect(recordHitSpy).toHaveBeenCalledWith(1000);
    });

    it('should mark display as dirty', () => {
      display.dirty = false;
      display.recordHit('sick', 1000);
      expect(display.dirty).toBe(true);
    });

    it('should not increment for invalid judgement', () => {
      display.recordHit('invalid', 1000);

      expect(display.judgements.sick).toBe(0);
      expect(display.judgements.good).toBe(0);
      expect(display.judgements.bad).toBe(0);
      expect(display.judgements.shit).toBe(0);
    });

    it('should update grade after recording hit', () => {
      const updateGradeSpy = vi.spyOn(display, 'updateGradeFromStats');

      display.recordHit('sick', 1000);

      expect(updateGradeSpy).toHaveBeenCalled();
    });
  });

  describe('recordComboBreak - Combo break counter (Requirement 9.1, 9.3)', () => {
    it('should increment comboBreaks counter', () => {
      display.recordComboBreak();
      expect(display.comboBreaks).toBe(1);
    });

    it('should track multiple combo breaks', () => {
      display.recordComboBreak();
      display.recordComboBreak();
      display.recordComboBreak();

      expect(display.comboBreaks).toBe(3);
    });

    it('should be independent from misses counter (Requirement 9.3)', () => {
      display.misses = 5;
      display.recordComboBreak();

      expect(display.comboBreaks).toBe(1);
      expect(display.misses).toBe(5); // Misses unchanged
    });

    it('should mark display as dirty', () => {
      display.dirty = false;
      display.recordComboBreak();
      expect(display.dirty).toBe(true);
    });

    it('should not affect judgement counts', () => {
      display.judgements = { sick: 5, good: 3, bad: 1, shit: 0 };
      display.recordComboBreak();

      expect(display.judgements).toEqual({ sick: 5, good: 3, bad: 1, shit: 0 });
    });
  });

  describe('update', () => {
    it('should update NPS meter with current time', () => {
      const updateSpy = vi.spyOn(display.npsMeter, 'update');

      display.update(16.67, 1000);

      expect(updateSpy).toHaveBeenCalledWith(1000);
    });

    it('should not update NPS meter if currentTime not provided', () => {
      const updateSpy = vi.spyOn(display.npsMeter, 'update');

      display.update(16.67);

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should call parent update', () => {
      display.dirty = true;
      display.update(16.67, 1000);

      expect(display.dirty).toBe(false);
    });
  });

  describe('updateGradeFromStats', () => {
    it('should update grade based on judgement counts', () => {
      // All sick hits = 100% accuracy
      display.judgements = { sick: 10, good: 0, bad: 0, shit: 0 };
      display.misses = 0;

      display.updateGradeFromStats();

      expect(display.gradeDisplay.currentGrade).toBe('S++');
    });

    it('should calculate weighted accuracy', () => {
      // 5 sick (1.0) + 5 good (0.75) = 5 + 3.75 = 8.75 / 10 = 87.5%
      display.judgements = { sick: 5, good: 5, bad: 0, shit: 0 };
      display.misses = 0;

      display.updateGradeFromStats();

      expect(display.gradeDisplay.currentGrade).toBe('A');
    });

    it('should not update if no hits', () => {
      display.judgements = { sick: 0, good: 0, bad: 0, shit: 0 };

      display.updateGradeFromStats();

      expect(display.gradeDisplay.currentGrade).toBe('N/A');
    });

    it('should consider misses in grade calculation', () => {
      display.judgements = { sick: 10, good: 0, bad: 0, shit: 0 };
      display.misses = 1;

      display.updateGradeFromStats();

      // 100% accuracy but 1 miss, so can't get S++ or S+
      expect(display.gradeDisplay.currentGrade).toBe('S');
    });
  });

  describe('getTotalHits', () => {
    it('should return sum of all judgement counts', () => {
      display.judgements = { sick: 5, good: 3, bad: 2, shit: 1 };

      expect(display.getTotalHits()).toBe(11);
    });

    it('should return 0 for no hits', () => {
      expect(display.getTotalHits()).toBe(0);
    });
  });

  describe('getCurrentNPS', () => {
    it('should return current NPS from meter', () => {
      display.npsMeter.currentNPS = 5;
      expect(display.getCurrentNPS()).toBe(5);
    });

    it('should return 0 if no NPS meter', () => {
      display.npsMeter = null;
      expect(display.getCurrentNPS()).toBe(0);
    });
  });

  describe('getPeakNPS', () => {
    it('should return peak NPS from meter', () => {
      display.npsMeter.peakNPS = 10;
      expect(display.getPeakNPS()).toBe(10);
    });

    it('should return 0 if no NPS meter', () => {
      display.npsMeter = null;
      expect(display.getPeakNPS()).toBe(0);
    });
  });

  describe('getCurrentGrade', () => {
    it('should return current grade from display', () => {
      display.gradeDisplay.currentGrade = 'A';
      expect(display.getCurrentGrade()).toBe('A');
    });

    it('should return N/A if no grade display', () => {
      display.gradeDisplay = null;
      expect(display.getCurrentGrade()).toBe('N/A');
    });
  });

  describe('getComboBreaks', () => {
    it('should return combo break count', () => {
      display.comboBreaks = 5;
      expect(display.getComboBreaks()).toBe(5);
    });
  });

  describe('getJudgements', () => {
    it('should return copy of judgements object', () => {
      display.judgements = { sick: 5, good: 3, bad: 2, shit: 1 };

      const result = display.getJudgements();

      expect(result).toEqual({ sick: 5, good: 3, bad: 2, shit: 1 });
      expect(result).not.toBe(display.judgements); // Should be a copy
    });
  });

  describe('setExpandedVisibility', () => {
    it('should update showNPS option', () => {
      display.setExpandedVisibility({ showNPS: false });
      expect(display.visibilityOptions.showNPS).toBe(false);
    });

    it('should update showGrade option', () => {
      display.setExpandedVisibility({ showGrade: false });
      expect(display.visibilityOptions.showGrade).toBe(false);
    });

    it('should update showComboBreaks option', () => {
      display.setExpandedVisibility({ showComboBreaks: false });
      expect(display.visibilityOptions.showComboBreaks).toBe(false);
    });

    it('should update showJudgements option', () => {
      display.setExpandedVisibility({ showJudgements: true });
      expect(display.visibilityOptions.showJudgements).toBe(true);
    });

    it('should only update provided options', () => {
      display.visibilityOptions = {
        showNPS: true,
        showGrade: true,
        showComboBreaks: true,
        showJudgements: false
      };

      display.setExpandedVisibility({ showNPS: false });

      expect(display.visibilityOptions.showNPS).toBe(false);
      expect(display.visibilityOptions.showGrade).toBe(true);
      expect(display.visibilityOptions.showComboBreaks).toBe(true);
      expect(display.visibilityOptions.showJudgements).toBe(false);
    });

    it('should mark display as dirty', () => {
      display.dirty = false;
      display.setExpandedVisibility({ showNPS: false });
      expect(display.dirty).toBe(true);
    });

    it('should return this for chaining', () => {
      const result = display.setExpandedVisibility({ showNPS: false });
      expect(result).toBe(display);
    });
  });

  describe('buildText', () => {
    it('should include parent text (score)', () => {
      display.score = 5000;
      const text = display.buildText();

      expect(text).toContain('Score:');
    });

    it('should include NPS when showNPS is true', () => {
      display.visibilityOptions.showNPS = true;
      display.npsMeter.currentNPS = 5;
      display.npsMeter.peakNPS = 8;

      const text = display.buildText();

      expect(text).toContain('NPS: 5');
      expect(text).toContain('Peak: 8');
    });

    it('should not include NPS when showNPS is false', () => {
      display.visibilityOptions.showNPS = false;

      const text = display.buildText();

      expect(text).not.toContain('NPS:');
    });

    it('should include Grade when showGrade is true', () => {
      display.visibilityOptions.showGrade = true;
      display.gradeDisplay.currentGrade = 'A';

      const text = display.buildText();

      expect(text).toContain('Grade: A');
    });

    it('should not include Grade when showGrade is false', () => {
      display.visibilityOptions.showGrade = false;

      const text = display.buildText();

      expect(text).not.toContain('Grade:');
    });

    it('should include combo breaks when showComboBreaks is true', () => {
      display.visibilityOptions.showComboBreaks = true;
      display.comboBreaks = 3;

      const text = display.buildText();

      expect(text).toContain('CB: 3');
    });

    it('should not include combo breaks when showComboBreaks is false', () => {
      display.visibilityOptions.showComboBreaks = false;

      const text = display.buildText();

      expect(text).not.toContain('CB:');
    });

    it('should include judgement breakdown when showJudgements is true', () => {
      display.visibilityOptions.showJudgements = true;
      display.judgements = { sick: 10, good: 5, bad: 2, shit: 1 };

      const text = display.buildText();

      expect(text).toContain('S:10');
      expect(text).toContain('G:5');
      expect(text).toContain('B:2');
      expect(text).toContain('X:1');
    });

    it('should not include judgement breakdown when showJudgements is false', () => {
      display.visibilityOptions.showJudgements = false;
      display.judgements = { sick: 10, good: 5, bad: 2, shit: 1 };

      const text = display.buildText();

      // Check for the specific judgement format (S:10 G:5 B:2 X:1)
      expect(text).not.toMatch(/S:\d+\s+G:\d+/);
      expect(text).not.toContain('X:1');
    });

    it('should separate sections with pipe character', () => {
      display.visibilityOptions.showNPS = true;
      display.visibilityOptions.showGrade = true;

      const text = display.buildText();

      expect(text).toContain(' | ');
    });
  });

  describe('resetStats', () => {
    it('should reset score to 0', () => {
      display.score = 5000;
      display.resetStats();
      expect(display.score).toBe(0);
    });

    it('should reset combo to 0', () => {
      display.combo = 50;
      display.resetStats();
      expect(display.combo).toBe(0);
    });

    it('should reset accuracy to 0', () => {
      display.accuracy = 95;
      display.resetStats();
      expect(display.accuracy).toBe(0);
    });

    it('should reset misses to 0', () => {
      display.misses = 5;
      display.resetStats();
      expect(display.misses).toBe(0);
    });

    it('should reset comboBreaks to 0', () => {
      display.comboBreaks = 3;
      display.resetStats();
      expect(display.comboBreaks).toBe(0);
    });

    it('should reset all judgement counts to 0', () => {
      display.judgements = { sick: 10, good: 5, bad: 2, shit: 1 };
      display.resetStats();
      expect(display.judgements).toEqual({ sick: 0, good: 0, bad: 0, shit: 0 });
    });

    it('should reset NPS meter', () => {
      const resetSpy = vi.spyOn(display.npsMeter, 'reset');
      display.resetStats();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('should reset grade display', () => {
      const resetSpy = vi.spyOn(display.gradeDisplay, 'reset');
      display.resetStats();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('should mark display as dirty', () => {
      display.dirty = false;
      display.resetStats();
      expect(display.dirty).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should set npsMeter to null', () => {
      display.destroy();
      expect(display.npsMeter).toBeNull();
    });

    it('should set gradeDisplay to null', () => {
      display.destroy();
      expect(display.gradeDisplay).toBeNull();
    });

    it('should call parent destroy', () => {
      display.destroy();
      expect(display.text).toBeNull();
      expect(display.scene).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should track a complete gameplay session', () => {
      // Simulate a gameplay session
      display.recordHit('sick', 1000);
      display.recordHit('sick', 1100);
      display.recordHit('good', 1200);
      display.recordHit('sick', 1300);
      display.recordComboBreak();
      display.recordHit('bad', 1500);
      display.recordHit('sick', 1600);
      display.recordHit('good', 1700);
      display.recordComboBreak();

      expect(display.judgements.sick).toBe(4);
      expect(display.judgements.good).toBe(2);
      expect(display.judgements.bad).toBe(1);
      expect(display.judgements.shit).toBe(0);
      expect(display.comboBreaks).toBe(2);
      expect(display.getTotalHits()).toBe(7);
    });

    it('should maintain combo breaks separate from misses throughout session', () => {
      display.misses = 0;

      // Combo break from bad hit (not a miss)
      display.recordHit('bad', 1000);
      display.recordComboBreak();

      expect(display.comboBreaks).toBe(1);
      expect(display.misses).toBe(0);

      // Actual miss
      display.misses = 1;
      display.recordComboBreak();

      expect(display.comboBreaks).toBe(2);
      expect(display.misses).toBe(1);
    });

    it('should update all stats correctly after multiple updates', () => {
      display.recordHit('sick', 100);
      display.recordHit('sick', 200);
      display.recordHit('sick', 300);
      display.update(16.67, 400);

      display.recordHit('good', 500);
      display.recordComboBreak();
      display.update(16.67, 600);

      expect(display.judgements.sick).toBe(3);
      expect(display.judgements.good).toBe(1);
      expect(display.comboBreaks).toBe(1);
      expect(display.npsMeter.totalHits).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid consecutive hits', () => {
      for (let i = 0; i < 100; i++) {
        display.recordHit('sick', i * 10);
      }

      expect(display.judgements.sick).toBe(100);
      expect(display.npsMeter.totalHits).toBe(100);
    });

    it('should handle rapid combo breaks', () => {
      for (let i = 0; i < 50; i++) {
        display.recordComboBreak();
      }

      expect(display.comboBreaks).toBe(50);
    });

    it('should handle mixed judgements in rapid succession', () => {
      const judgements = ['sick', 'good', 'bad', 'shit'];
      for (let i = 0; i < 100; i++) {
        display.recordHit(judgements[i % 4], i * 10);
      }

      expect(display.judgements.sick).toBe(25);
      expect(display.judgements.good).toBe(25);
      expect(display.judgements.bad).toBe(25);
      expect(display.judgements.shit).toBe(25);
    });

    it('should handle reset and continue', () => {
      display.recordHit('sick', 1000);
      display.recordComboBreak();
      display.resetStats();

      display.recordHit('good', 2000);
      display.recordComboBreak();

      expect(display.judgements.sick).toBe(0);
      expect(display.judgements.good).toBe(1);
      expect(display.comboBreaks).toBe(1);
    });
  });
});

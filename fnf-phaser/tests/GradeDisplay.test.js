/**
 * @fileoverview Unit tests for the GradeDisplay class.
 * Tests real-time grade calculation and display.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import GradeDisplay from '../src/play/GradeDisplay.js';

describe('GradeDisplay', () => {
  let gradeDisplay;

  beforeEach(() => {
    gradeDisplay = new GradeDisplay();
  });

  describe('constructor', () => {
    it('should start with N/A as current grade', () => {
      expect(gradeDisplay.currentGrade).toBe('N/A');
    });

    it('should start with N/A as previous grade', () => {
      expect(gradeDisplay.previousGrade).toBe('N/A');
    });

    it('should start with gradeChanged as false', () => {
      expect(gradeDisplay.gradeChanged).toBe(false);
    });
  });

  describe('GRADE_THRESHOLDS', () => {
    it('should define S++ threshold as 100% accuracy, 0 misses', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['S++'];
      expect(threshold.accuracy).toBe(100);
      expect(threshold.maxMisses).toBe(0);
    });

    it('should define S+ threshold as 95% accuracy, 0 misses', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['S+'];
      expect(threshold.accuracy).toBe(95);
      expect(threshold.maxMisses).toBe(0);
    });

    it('should define S threshold as 90% accuracy', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['S'];
      expect(threshold.accuracy).toBe(90);
    });

    it('should define A threshold as 85% accuracy', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['A'];
      expect(threshold.accuracy).toBe(85);
    });

    it('should define B threshold as 80% accuracy', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['B'];
      expect(threshold.accuracy).toBe(80);
    });

    it('should define C threshold as 70% accuracy', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['C'];
      expect(threshold.accuracy).toBe(70);
    });

    it('should define D threshold as 60% accuracy', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['D'];
      expect(threshold.accuracy).toBe(60);
    });

    it('should define F threshold as 0% accuracy', () => {
      const threshold = GradeDisplay.GRADE_THRESHOLDS['F'];
      expect(threshold.accuracy).toBe(0);
    });

    it('should have all 8 grades defined', () => {
      expect(Object.keys(GradeDisplay.GRADE_THRESHOLDS)).toHaveLength(8);
    });
  });

  describe('GRADE_ORDER', () => {
    it('should have grades ordered from highest to lowest', () => {
      expect(GradeDisplay.GRADE_ORDER).toEqual(['S++', 'S+', 'S', 'A', 'B', 'C', 'D', 'F']);
    });

    it('should have 8 grades', () => {
      expect(GradeDisplay.GRADE_ORDER).toHaveLength(8);
    });
  });

  describe('updateGrade - Grade calculation (Requirement 8.1, 8.2)', () => {
    it('should update grade when accuracy changes', () => {
      gradeDisplay.updateGrade(95, 0);
      expect(gradeDisplay.currentGrade).toBe('S+');

      gradeDisplay.updateGrade(85, 0);
      expect(gradeDisplay.currentGrade).toBe('A');
    });

    it('should update grade when miss count changes', () => {
      gradeDisplay.updateGrade(100, 0);
      expect(gradeDisplay.currentGrade).toBe('S++');

      gradeDisplay.updateGrade(100, 1);
      // With 1 miss, can't get S++ or S+ (maxMisses: 0)
      expect(gradeDisplay.currentGrade).toBe('S');
    });

    it('should set gradeChanged to true when grade changes', () => {
      gradeDisplay.updateGrade(95, 0);
      expect(gradeDisplay.gradeChanged).toBe(true);
    });

    it('should set gradeChanged to false when grade stays same', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(96, 0);
      expect(gradeDisplay.gradeChanged).toBe(false);
    });

    it('should update previousGrade before changing currentGrade', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(85, 0);
      expect(gradeDisplay.previousGrade).toBe('S+');
      expect(gradeDisplay.currentGrade).toBe('A');
    });
  });

  describe('calculateGrade - Grade threshold boundaries (Requirement 8.3)', () => {
    describe('S++ grade', () => {
      it('should return S++ for 100% accuracy and 0 misses', () => {
        expect(gradeDisplay.calculateGrade(100, 0)).toBe('S++');
      });

      it('should not return S++ for 99.9% accuracy', () => {
        expect(gradeDisplay.calculateGrade(99.9, 0)).not.toBe('S++');
      });

      it('should not return S++ for 100% accuracy with 1 miss', () => {
        expect(gradeDisplay.calculateGrade(100, 1)).not.toBe('S++');
      });
    });

    describe('S+ grade', () => {
      it('should return S+ for 95% accuracy and 0 misses', () => {
        expect(gradeDisplay.calculateGrade(95, 0)).toBe('S+');
      });

      it('should return S+ for 99% accuracy and 0 misses', () => {
        expect(gradeDisplay.calculateGrade(99, 0)).toBe('S+');
      });

      it('should not return S+ for 94.9% accuracy', () => {
        expect(gradeDisplay.calculateGrade(94.9, 0)).not.toBe('S+');
      });

      it('should not return S+ for 95% accuracy with 1 miss', () => {
        expect(gradeDisplay.calculateGrade(95, 1)).not.toBe('S+');
      });
    });

    describe('S grade', () => {
      it('should return S for 90% accuracy', () => {
        expect(gradeDisplay.calculateGrade(90, 0)).toBe('S');
      });

      it('should return S for 94% accuracy with misses', () => {
        expect(gradeDisplay.calculateGrade(94, 5)).toBe('S');
      });

      it('should not return S for 89.9% accuracy', () => {
        expect(gradeDisplay.calculateGrade(89.9, 0)).not.toBe('S');
      });
    });

    describe('A grade', () => {
      it('should return A for 85% accuracy', () => {
        expect(gradeDisplay.calculateGrade(85, 0)).toBe('A');
      });

      it('should return A for 89% accuracy', () => {
        expect(gradeDisplay.calculateGrade(89, 0)).toBe('A');
      });

      it('should not return A for 84.9% accuracy', () => {
        expect(gradeDisplay.calculateGrade(84.9, 0)).not.toBe('A');
      });
    });

    describe('B grade', () => {
      it('should return B for 80% accuracy', () => {
        expect(gradeDisplay.calculateGrade(80, 0)).toBe('B');
      });

      it('should return B for 84% accuracy', () => {
        expect(gradeDisplay.calculateGrade(84, 0)).toBe('B');
      });

      it('should not return B for 79.9% accuracy', () => {
        expect(gradeDisplay.calculateGrade(79.9, 0)).not.toBe('B');
      });
    });

    describe('C grade', () => {
      it('should return C for 70% accuracy', () => {
        expect(gradeDisplay.calculateGrade(70, 0)).toBe('C');
      });

      it('should return C for 79% accuracy', () => {
        expect(gradeDisplay.calculateGrade(79, 0)).toBe('C');
      });

      it('should not return C for 69.9% accuracy', () => {
        expect(gradeDisplay.calculateGrade(69.9, 0)).not.toBe('C');
      });
    });

    describe('D grade', () => {
      it('should return D for 60% accuracy', () => {
        expect(gradeDisplay.calculateGrade(60, 0)).toBe('D');
      });

      it('should return D for 69% accuracy', () => {
        expect(gradeDisplay.calculateGrade(69, 0)).toBe('D');
      });

      it('should not return D for 59.9% accuracy', () => {
        expect(gradeDisplay.calculateGrade(59.9, 0)).not.toBe('D');
      });
    });

    describe('F grade', () => {
      it('should return F for 0% accuracy', () => {
        expect(gradeDisplay.calculateGrade(0, 0)).toBe('F');
      });

      it('should return F for 59% accuracy', () => {
        expect(gradeDisplay.calculateGrade(59, 0)).toBe('F');
      });

      it('should return F for negative accuracy', () => {
        expect(gradeDisplay.calculateGrade(-10, 0)).toBe('F');
      });
    });
  });

  describe('getGradeChange - Grade change detection (Requirement 8.5)', () => {
    it('should return "same" when grade has not changed', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(96, 0);
      expect(gradeDisplay.getGradeChange()).toBe('same');
    });

    it('should return "up" when grade improves', () => {
      gradeDisplay.updateGrade(85, 0); // A
      gradeDisplay.updateGrade(95, 0); // S+
      expect(gradeDisplay.getGradeChange()).toBe('up');
    });

    it('should return "down" when grade drops', () => {
      gradeDisplay.updateGrade(95, 0); // S+
      gradeDisplay.updateGrade(85, 0); // A
      expect(gradeDisplay.getGradeChange()).toBe('down');
    });

    it('should return "same" for initial grade from N/A', () => {
      gradeDisplay.updateGrade(85, 0);
      expect(gradeDisplay.getGradeChange()).toBe('same');
    });

    it('should detect improvement from F to S++', () => {
      gradeDisplay.updateGrade(50, 0); // F
      gradeDisplay.updateGrade(100, 0); // S++
      expect(gradeDisplay.getGradeChange()).toBe('up');
    });

    it('should detect drop from S++ to F', () => {
      gradeDisplay.updateGrade(100, 0); // S++
      gradeDisplay.updateGrade(50, 0); // F
      expect(gradeDisplay.getGradeChange()).toBe('down');
    });

    it('should detect single grade improvement', () => {
      gradeDisplay.updateGrade(85, 0); // A
      gradeDisplay.updateGrade(90, 0); // S
      expect(gradeDisplay.getGradeChange()).toBe('up');
    });

    it('should detect single grade drop', () => {
      gradeDisplay.updateGrade(90, 0); // S
      gradeDisplay.updateGrade(85, 0); // A
      expect(gradeDisplay.getGradeChange()).toBe('down');
    });
  });

  describe('getCurrentGrade', () => {
    it('should return current grade', () => {
      gradeDisplay.updateGrade(85, 0);
      expect(gradeDisplay.getCurrentGrade()).toBe('A');
    });

    it('should return N/A before any updates', () => {
      expect(gradeDisplay.getCurrentGrade()).toBe('N/A');
    });
  });

  describe('getPreviousGrade', () => {
    it('should return previous grade', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(85, 0);
      expect(gradeDisplay.getPreviousGrade()).toBe('S+');
    });

    it('should return N/A before any updates', () => {
      expect(gradeDisplay.getPreviousGrade()).toBe('N/A');
    });
  });

  describe('hasGradeChanged', () => {
    it('should return true when grade changed', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(85, 0);
      expect(gradeDisplay.hasGradeChanged()).toBe(true);
    });

    it('should return false when grade stayed same', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(96, 0);
      expect(gradeDisplay.hasGradeChanged()).toBe(false);
    });

    it('should return false before any updates', () => {
      expect(gradeDisplay.hasGradeChanged()).toBe(false);
    });
  });

  describe('getGradeIndex', () => {
    it('should return 0 for S++', () => {
      expect(gradeDisplay.getGradeIndex('S++')).toBe(0);
    });

    it('should return 1 for S+', () => {
      expect(gradeDisplay.getGradeIndex('S+')).toBe(1);
    });

    it('should return 7 for F', () => {
      expect(gradeDisplay.getGradeIndex('F')).toBe(7);
    });

    it('should return -1 for invalid grade', () => {
      expect(gradeDisplay.getGradeIndex('X')).toBe(-1);
    });

    it('should return -1 for N/A', () => {
      expect(gradeDisplay.getGradeIndex('N/A')).toBe(-1);
    });

    it('should use current grade when no argument provided', () => {
      gradeDisplay.updateGrade(85, 0); // A
      expect(gradeDisplay.getGradeIndex()).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset currentGrade to N/A', () => {
      gradeDisplay.updateGrade(85, 0);
      gradeDisplay.reset();
      expect(gradeDisplay.currentGrade).toBe('N/A');
    });

    it('should reset previousGrade to N/A', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(85, 0);
      gradeDisplay.reset();
      expect(gradeDisplay.previousGrade).toBe('N/A');
    });

    it('should reset gradeChanged to false', () => {
      gradeDisplay.updateGrade(95, 0);
      gradeDisplay.updateGrade(85, 0);
      gradeDisplay.reset();
      expect(gradeDisplay.gradeChanged).toBe(false);
    });

    it('should allow new updates after reset', () => {
      gradeDisplay.updateGrade(85, 0);
      gradeDisplay.reset();
      gradeDisplay.updateGrade(95, 0);
      expect(gradeDisplay.currentGrade).toBe('S+');
    });
  });

  describe('edge cases', () => {
    it('should handle accuracy exactly at boundary', () => {
      expect(gradeDisplay.calculateGrade(95, 0)).toBe('S+');
      expect(gradeDisplay.calculateGrade(90, 0)).toBe('S');
      expect(gradeDisplay.calculateGrade(85, 0)).toBe('A');
      expect(gradeDisplay.calculateGrade(80, 0)).toBe('B');
      expect(gradeDisplay.calculateGrade(70, 0)).toBe('C');
      expect(gradeDisplay.calculateGrade(60, 0)).toBe('D');
    });

    it('should handle accuracy above 100%', () => {
      // Some games allow bonus accuracy
      expect(gradeDisplay.calculateGrade(105, 0)).toBe('S++');
    });

    it('should handle very high miss counts', () => {
      expect(gradeDisplay.calculateGrade(90, 1000)).toBe('S');
    });

    it('should handle decimal accuracy values', () => {
      expect(gradeDisplay.calculateGrade(94.99, 0)).toBe('S');
      expect(gradeDisplay.calculateGrade(95.01, 0)).toBe('S+');
    });

    it('should handle rapid grade changes', () => {
      gradeDisplay.updateGrade(100, 0); // S++
      gradeDisplay.updateGrade(50, 0);  // F
      gradeDisplay.updateGrade(100, 0); // S++
      gradeDisplay.updateGrade(50, 0);  // F

      expect(gradeDisplay.currentGrade).toBe('F');
      expect(gradeDisplay.previousGrade).toBe('S++');
      expect(gradeDisplay.getGradeChange()).toBe('down');
    });

    it('should handle same grade with different accuracy values', () => {
      gradeDisplay.updateGrade(91, 0); // S
      gradeDisplay.updateGrade(93, 0); // S
      expect(gradeDisplay.gradeChanged).toBe(false);
      expect(gradeDisplay.getGradeChange()).toBe('same');
    });

    it('should handle zero accuracy', () => {
      gradeDisplay.updateGrade(0, 0);
      expect(gradeDisplay.currentGrade).toBe('F');
    });

    it('should handle zero misses with various accuracies', () => {
      expect(gradeDisplay.calculateGrade(100, 0)).toBe('S++');
      expect(gradeDisplay.calculateGrade(95, 0)).toBe('S+');
      expect(gradeDisplay.calculateGrade(50, 0)).toBe('F');
    });
  });

  describe('determinism (Property 26)', () => {
    it('should produce same grade for same inputs', () => {
      const grade1 = gradeDisplay.calculateGrade(87.5, 3);
      const grade2 = gradeDisplay.calculateGrade(87.5, 3);
      expect(grade1).toBe(grade2);
    });

    it('should produce consistent grades across multiple instances', () => {
      const display1 = new GradeDisplay();
      const display2 = new GradeDisplay();

      display1.updateGrade(92, 2);
      display2.updateGrade(92, 2);

      expect(display1.currentGrade).toBe(display2.currentGrade);
    });
  });
});

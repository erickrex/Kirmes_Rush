/**
 * @fileoverview Property-based tests for the GradeDisplay class.
 * Tests real-time grade calculation and display using fast-check.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import GradeDisplay from '../src/play/GradeDisplay.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Grade order from best to worst (lower index = better grade)
const GRADE_ORDER = ['S++', 'S+', 'S', 'A', 'B', 'C', 'D', 'F'];

// Arbitraries for generating test data
const accuracyArb = fc.double({ min: 0, max: 100, noNaN: true });
const missCountArb = fc.integer({ min: 0, max: 1000 });

// Generate accuracy and miss count pairs
const gradeInputArb = fc.record({
  accuracy: accuracyArb,
  misses: missCountArb
});

// Generate a sequence of grade inputs for testing grade changes
const gradeInputSequenceArb = fc.array(gradeInputArb, { minLength: 2, maxLength: 20 });

// Generate accuracy values at specific grade boundaries
const boundaryAccuracyArb = fc.constantFrom(100, 95, 90, 85, 80, 70, 60, 0);

// Generate accuracy values just below boundaries
const belowBoundaryAccuracyArb = fc.constantFrom(99.99, 94.99, 89.99, 84.99, 79.99, 69.99, 59.99);

describe('GradeDisplay Property Tests', () => {
  /**
   * Property 26: Grade Calculation Determinism
   * For any accuracy percentage A and miss count M, updateGrade(A, M) SHALL produce
   * a deterministic grade based on the defined thresholds.
   */
  describe('Property 26: Grade Calculation Determinism', () => {
    it('same inputs SHALL always produce same grade', () => {
      fc.assert(
        fc.property(accuracyArb, missCountArb, (accuracy, misses) => {
          const display1 = new GradeDisplay();
          const display2 = new GradeDisplay();

          display1.updateGrade(accuracy, misses);
          display2.updateGrade(accuracy, misses);

          expect(display1.currentGrade).toBe(display2.currentGrade);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('calculateGrade SHALL be idempotent', () => {
      fc.assert(
        fc.property(accuracyArb, missCountArb, (accuracy, misses) => {
          const display = new GradeDisplay();

          const grade1 = display.calculateGrade(accuracy, misses);
          const grade2 = display.calculateGrade(accuracy, misses);
          const grade3 = display.calculateGrade(accuracy, misses);

          expect(grade1).toBe(grade2);
          expect(grade2).toBe(grade3);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('grade SHALL be one of the defined grades', () => {
      fc.assert(
        fc.property(accuracyArb, missCountArb, (accuracy, misses) => {
          const display = new GradeDisplay();
          display.updateGrade(accuracy, misses);

          expect(GRADE_ORDER).toContain(display.currentGrade);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple updates with same values SHALL produce same grade', () => {
      fc.assert(
        fc.property(accuracyArb, missCountArb, fc.integer({ min: 2, max: 10 }), (accuracy, misses, repeatCount) => {
          const display = new GradeDisplay();

          for (let i = 0; i < repeatCount; i++) {
            display.updateGrade(accuracy, misses);
          }

          // Final grade should match what we'd get from a fresh calculation
          const freshDisplay = new GradeDisplay();
          freshDisplay.updateGrade(accuracy, misses);

          expect(display.currentGrade).toBe(freshDisplay.currentGrade);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('order of previous updates SHALL NOT affect current grade calculation', () => {
      fc.assert(
        fc.property(
          gradeInputSequenceArb,
          accuracyArb,
          missCountArb,
          (previousInputs, finalAccuracy, finalMisses) => {
            const display1 = new GradeDisplay();
            const display2 = new GradeDisplay();

            // Display 1: Apply all previous inputs then final
            for (const input of previousInputs) {
              display1.updateGrade(input.accuracy, input.misses);
            }
            display1.updateGrade(finalAccuracy, finalMisses);

            // Display 2: Only apply final input
            display2.updateGrade(finalAccuracy, finalMisses);

            // Current grade should be the same regardless of history
            expect(display1.currentGrade).toBe(display2.currentGrade);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 27: Grade Threshold Boundaries
   * For any accuracy and miss values at grade boundaries, the grade SHALL be assigned
   * according to: S++ (100%, 0 misses), S+ (≥95%, 0 misses), S (≥90%), A (≥85%),
   * B (≥80%), C (≥70%), D (≥60%), F (otherwise).
   */
  describe('Property 27: Grade Threshold Boundaries', () => {
    it('S++ SHALL require exactly 100% accuracy and 0 misses', () => {
      fc.assert(
        fc.property(missCountArb, (misses) => {
          const display = new GradeDisplay();

          // 100% with 0 misses = S++
          display.updateGrade(100, 0);
          expect(display.currentGrade).toBe('S++');

          // 100% with any misses != S++
          if (misses > 0) {
            display.updateGrade(100, misses);
            expect(display.currentGrade).not.toBe('S++');
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('S+ SHALL require ≥95% accuracy and 0 misses (but not 100%)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 95, max: 99.99, noNaN: true }),
          missCountArb,
          (accuracy, misses) => {
            const display = new GradeDisplay();

            // ≥95% (but <100%) with 0 misses = S+
            display.updateGrade(accuracy, 0);
            expect(display.currentGrade).toBe('S+');

            // ≥95% with any misses != S+ (should be S or lower)
            if (misses > 0) {
              display.updateGrade(accuracy, misses);
              expect(display.currentGrade).not.toBe('S+');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('S SHALL require ≥90% accuracy (regardless of misses, unless S+ eligible)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 90, max: 94.99, noNaN: true }),
          missCountArb,
          (accuracy, misses) => {
            const display = new GradeDisplay();
            display.updateGrade(accuracy, misses);

            // 90-94.99% accuracy should be S (can't be S+ due to accuracy, can't be S++ due to accuracy)
            expect(display.currentGrade).toBe('S');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('A SHALL require ≥85% and <90% accuracy', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 85, max: 89.99, noNaN: true }),
          missCountArb,
          (accuracy, misses) => {
            const display = new GradeDisplay();
            display.updateGrade(accuracy, misses);

            expect(display.currentGrade).toBe('A');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('B SHALL require ≥80% and <85% accuracy', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 80, max: 84.99, noNaN: true }),
          missCountArb,
          (accuracy, misses) => {
            const display = new GradeDisplay();
            display.updateGrade(accuracy, misses);

            expect(display.currentGrade).toBe('B');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('C SHALL require ≥70% and <80% accuracy', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 70, max: 79.99, noNaN: true }),
          missCountArb,
          (accuracy, misses) => {
            const display = new GradeDisplay();
            display.updateGrade(accuracy, misses);

            expect(display.currentGrade).toBe('C');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('D SHALL require ≥60% and <70% accuracy', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 60, max: 69.99, noNaN: true }),
          missCountArb,
          (accuracy, misses) => {
            const display = new GradeDisplay();
            display.updateGrade(accuracy, misses);

            expect(display.currentGrade).toBe('D');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('F SHALL be assigned for <60% accuracy', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 59.99, noNaN: true }),
          missCountArb,
          (accuracy, misses) => {
            const display = new GradeDisplay();
            display.updateGrade(accuracy, misses);

            expect(display.currentGrade).toBe('F');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('grade boundaries SHALL be inclusive at lower bound', () => {
      fc.assert(
        fc.property(boundaryAccuracyArb, (boundaryAccuracy) => {
          const display = new GradeDisplay();

          // Test exact boundary values with 0 misses
          display.updateGrade(boundaryAccuracy, 0);

          // Map boundary to expected grade
          const expectedGrades = {
            100: 'S++',
            95: 'S+',
            90: 'S',
            85: 'A',
            80: 'B',
            70: 'C',
            60: 'D',
            0: 'F'
          };

          expect(display.currentGrade).toBe(expectedGrades[boundaryAccuracy]);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('values just below boundary SHALL get lower grade', () => {
      fc.assert(
        fc.property(belowBoundaryAccuracyArb, (accuracy) => {
          const display = new GradeDisplay();
          display.updateGrade(accuracy, 0);

          // Map below-boundary values to expected grades
          const expectedGrades = {
            99.99: 'S+', // Just below 100, but ≥95 with 0 misses
            94.99: 'S',  // Just below 95
            89.99: 'A',  // Just below 90
            84.99: 'B',  // Just below 85
            79.99: 'C',  // Just below 80
            69.99: 'D',  // Just below 70
            59.99: 'F'   // Just below 60
          };

          expect(display.currentGrade).toBe(expectedGrades[accuracy]);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('higher accuracy SHALL result in equal or better grade', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100, noNaN: true }),
          fc.double({ min: 0, max: 100, noNaN: true }),
          missCountArb,
          (accuracy1, accuracy2, misses) => {
            const display = new GradeDisplay();

            display.updateGrade(accuracy1, misses);
            const grade1Index = GRADE_ORDER.indexOf(display.currentGrade);

            display.updateGrade(accuracy2, misses);
            const grade2Index = GRADE_ORDER.indexOf(display.currentGrade);

            // Higher accuracy should result in lower or equal index (better or equal grade)
            // Exception: S++ and S+ require 0 misses, so this only holds when comparing
            // grades that don't have miss requirements
            if (accuracy1 > accuracy2) {
              // grade1 should be better or equal (lower index)
              // But we need to account for miss requirements for S++ and S+
              if (misses === 0) {
                expect(grade1Index).toBeLessThanOrEqual(grade2Index);
              } else {
                // With misses > 0, S++ and S+ are not achievable
                // So we compare only S and below
                const effectiveGrade1 = grade1Index <= 1 ? 2 : grade1Index; // S++ and S+ become S
                const effectiveGrade2 = grade2Index <= 1 ? 2 : grade2Index;
                expect(effectiveGrade1).toBeLessThanOrEqual(effectiveGrade2);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 28: Grade Change Detection
   * For any grade update, getGradeChange() SHALL return 'up' if new grade is better
   * than previous, 'down' if worse, and 'same' if unchanged.
   */
  describe('Property 28: Grade Change Detection', () => {
    it('getGradeChange() SHALL return "same" when grade unchanged', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100, noNaN: true }),
          fc.double({ min: 0, max: 100, noNaN: true }),
          missCountArb,
          missCountArb,
          (accuracy1, accuracy2, misses1, misses2) => {
            const display = new GradeDisplay();

            display.updateGrade(accuracy1, misses1);
            const firstGrade = display.currentGrade;

            display.updateGrade(accuracy2, misses2);
            const secondGrade = display.currentGrade;

            if (firstGrade === secondGrade) {
              expect(display.getGradeChange()).toBe('same');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getGradeChange() SHALL return "up" when grade improves', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7 }), // worse grade index (1-7, not S++)
          fc.integer({ min: 0, max: 6 }), // better grade index (0-6, not F)
          (worseIndex, betterOffset) => {
            // Ensure better grade has lower index
            const betterIndex = Math.max(0, worseIndex - betterOffset - 1);
            if (betterIndex >= worseIndex) return; // Skip if not actually better

            const display = new GradeDisplay();

            // Get accuracy values that produce these grades
            const worseGrade = GRADE_ORDER[worseIndex];
            const betterGrade = GRADE_ORDER[betterIndex];

            // Map grades to accuracy values
            const gradeToAccuracy = {
              'S++': 100,
              'S+': 97,
              'S': 92,
              'A': 87,
              'B': 82,
              'C': 75,
              'D': 65,
              'F': 50
            };

            // First update to worse grade
            display.updateGrade(gradeToAccuracy[worseGrade], worseIndex <= 1 ? 1 : 0);

            // Second update to better grade
            display.updateGrade(gradeToAccuracy[betterGrade], 0);

            if (display.currentGrade !== display.previousGrade) {
              const currentIndex = GRADE_ORDER.indexOf(display.currentGrade);
              const previousIndex = GRADE_ORDER.indexOf(display.previousGrade);

              if (currentIndex < previousIndex) {
                expect(display.getGradeChange()).toBe('up');
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getGradeChange() SHALL return "down" when grade drops', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 6 }), // better grade index (0-6, not F)
          fc.integer({ min: 1, max: 7 }), // worse grade index (1-7, not S++)
          (betterIndex, worseOffset) => {
            // Ensure worse grade has higher index
            const worseIndex = Math.min(7, betterIndex + worseOffset + 1);
            if (worseIndex <= betterIndex) return; // Skip if not actually worse

            const display = new GradeDisplay();

            // Map grades to accuracy values
            const gradeToAccuracy = {
              'S++': 100,
              'S+': 97,
              'S': 92,
              'A': 87,
              'B': 82,
              'C': 75,
              'D': 65,
              'F': 50
            };

            const betterGrade = GRADE_ORDER[betterIndex];
            const worseGrade = GRADE_ORDER[worseIndex];

            // First update to better grade
            display.updateGrade(gradeToAccuracy[betterGrade], 0);

            // Second update to worse grade
            display.updateGrade(gradeToAccuracy[worseGrade], worseIndex <= 1 ? 1 : 0);

            if (display.currentGrade !== display.previousGrade) {
              const currentIndex = GRADE_ORDER.indexOf(display.currentGrade);
              const previousIndex = GRADE_ORDER.indexOf(display.previousGrade);

              if (currentIndex > previousIndex) {
                expect(display.getGradeChange()).toBe('down');
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getGradeChange() SHALL return "same" for initial update from N/A', () => {
      fc.assert(
        fc.property(accuracyArb, missCountArb, (accuracy, misses) => {
          const display = new GradeDisplay();

          // First update from N/A state
          display.updateGrade(accuracy, misses);

          // Should return 'same' because previous was N/A (not in grade order)
          expect(display.getGradeChange()).toBe('same');
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('grade change direction SHALL be consistent with grade order', () => {
      fc.assert(
        fc.property(gradeInputSequenceArb, (inputs) => {
          const display = new GradeDisplay();

          for (const input of inputs) {
            const previousGrade = display.currentGrade;
            display.updateGrade(input.accuracy, input.misses);
            const currentGrade = display.currentGrade;

            const change = display.getGradeChange();
            const previousIndex = GRADE_ORDER.indexOf(previousGrade);
            const currentIndex = GRADE_ORDER.indexOf(currentGrade);

            if (previousIndex === -1) {
              // Previous was N/A
              expect(change).toBe('same');
            } else if (currentIndex < previousIndex) {
              expect(change).toBe('up');
            } else if (currentIndex > previousIndex) {
              expect(change).toBe('down');
            } else {
              expect(change).toBe('same');
            }
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('gradeChanged flag SHALL be true only when grade actually changed', () => {
      fc.assert(
        fc.property(gradeInputSequenceArb, (inputs) => {
          const display = new GradeDisplay();

          for (const input of inputs) {
            const previousGrade = display.currentGrade;
            display.updateGrade(input.accuracy, input.misses);
            const currentGrade = display.currentGrade;

            if (previousGrade !== currentGrade) {
              expect(display.gradeChanged).toBe(true);
            } else {
              expect(display.gradeChanged).toBe(false);
            }
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('previousGrade SHALL be updated before currentGrade changes', () => {
      fc.assert(
        fc.property(gradeInputSequenceArb, (inputs) => {
          const display = new GradeDisplay();

          let lastGrade = 'N/A';
          for (const input of inputs) {
            display.updateGrade(input.accuracy, input.misses);

            // previousGrade should be what currentGrade was before this update
            expect(display.previousGrade).toBe(lastGrade);

            lastGrade = display.currentGrade;
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional invariant tests for GradeDisplay
   */
  describe('GradeDisplay Invariants', () => {
    it('reset SHALL restore initial state', () => {
      fc.assert(
        fc.property(gradeInputSequenceArb, (inputs) => {
          const display = new GradeDisplay();

          // Apply some updates
          for (const input of inputs) {
            display.updateGrade(input.accuracy, input.misses);
          }

          // Reset
          display.reset();

          // Should be back to initial state
          expect(display.currentGrade).toBe('N/A');
          expect(display.previousGrade).toBe('N/A');
          expect(display.gradeChanged).toBe(false);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('getGradeIndex SHALL return valid index for all valid grades', () => {
      fc.assert(
        fc.property(accuracyArb, missCountArb, (accuracy, misses) => {
          const display = new GradeDisplay();
          display.updateGrade(accuracy, misses);

          const index = display.getGradeIndex();

          // Index should be valid (0-7 for grades S++ through F)
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThanOrEqual(7);

          // Index should correspond to correct grade
          expect(GRADE_ORDER[index]).toBe(display.currentGrade);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('getCurrentGrade SHALL return same value as currentGrade property', () => {
      fc.assert(
        fc.property(accuracyArb, missCountArb, (accuracy, misses) => {
          const display = new GradeDisplay();
          display.updateGrade(accuracy, misses);

          expect(display.getCurrentGrade()).toBe(display.currentGrade);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('getPreviousGrade SHALL return same value as previousGrade property', () => {
      fc.assert(
        fc.property(gradeInputSequenceArb, (inputs) => {
          const display = new GradeDisplay();

          for (const input of inputs) {
            display.updateGrade(input.accuracy, input.misses);
            expect(display.getPreviousGrade()).toBe(display.previousGrade);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('hasGradeChanged SHALL return same value as gradeChanged property', () => {
      fc.assert(
        fc.property(gradeInputSequenceArb, (inputs) => {
          const display = new GradeDisplay();

          for (const input of inputs) {
            display.updateGrade(input.accuracy, input.misses);
            expect(display.hasGradeChanged()).toBe(display.gradeChanged);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

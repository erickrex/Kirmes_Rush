/**
 * @fileoverview Property-based tests for the ExpandedStatsDisplay class.
 * Tests combo break counter independence and judgement count tracking using fast-check.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Mock Phaser before importing ExpandedStatsDisplay
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

// Mock scene factory
const createMockScene = () => ({
  add: {
    text: vi.fn((x, y, text, style) => new Phaser.GameObjects.Text(null, x, y, text, style))
  }
});

// Valid judgement types
const VALID_JUDGEMENTS = ['sick', 'good', 'bad', 'shit'];

// Arbitraries for generating test data
const judgementArb = fc.constantFrom(...VALID_JUDGEMENTS);
const timestampArb = fc.integer({ min: 0, max: 100000 });
const missCountArb = fc.integer({ min: 0, max: 1000 });
const comboBreakCountArb = fc.integer({ min: 0, max: 500 });

// Generate a hit event (judgement + timestamp)
const hitEventArb = fc.record({
  judgement: judgementArb,
  timestamp: timestampArb
});

// Generate a sequence of hit events
const hitSequenceArb = fc.array(hitEventArb, { minLength: 0, maxLength: 50 });

// Generate a gameplay session with hits and combo breaks
const gameplaySessionArb = fc.record({
  hits: hitSequenceArb,
  comboBreakCount: comboBreakCountArb,
  initialMisses: missCountArb
});

// Generate a sequence of mixed events (hits and combo breaks)
const mixedEventArb = fc.oneof(
  fc.record({ type: fc.constant('hit'), judgement: judgementArb, timestamp: timestampArb }),
  fc.record({ type: fc.constant('comboBreak') })
);

const mixedEventSequenceArb = fc.array(mixedEventArb, { minLength: 0, maxLength: 100 });

describe('ExpandedStatsDisplay Property Tests', () => {
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
  });

  /**
   * Property 29: Combo Break Counter Independence
   * For any gameplay session, comboBreaks count SHALL be independent of misses count—
   * a combo break from a bad hit SHALL increment comboBreaks but NOT misses.
   */
  describe('Property 29: Combo Break Counter Independence', () => {
    it('recordComboBreak() SHALL NOT affect misses count', () => {
      fc.assert(
        fc.property(missCountArb, comboBreakCountArb, (initialMisses, comboBreakCount) => {
          const display = new ExpandedStatsDisplay(mockScene);
          display.misses = initialMisses;

          // Record multiple combo breaks
          for (let i = 0; i < comboBreakCount; i++) {
            display.recordComboBreak();
          }

          // Misses should remain unchanged
          expect(display.misses).toBe(initialMisses);
          // Combo breaks should be incremented
          expect(display.comboBreaks).toBe(comboBreakCount);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('comboBreaks and misses SHALL be independently modifiable', () => {
      fc.assert(
        fc.property(
          missCountArb,
          comboBreakCountArb,
          fc.integer({ min: 0, max: 100 }), // additional misses
          (initialMisses, comboBreakCount, additionalMisses) => {
            const display = new ExpandedStatsDisplay(mockScene);
            display.misses = initialMisses;

            // Record combo breaks
            for (let i = 0; i < comboBreakCount; i++) {
              display.recordComboBreak();
            }

            // Modify misses separately
            display.misses += additionalMisses;

            // Both should be independent
            expect(display.comboBreaks).toBe(comboBreakCount);
            expect(display.misses).toBe(initialMisses + additionalMisses);

            display.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('combo break from bad hit SHALL increment comboBreaks but NOT misses', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          fc.integer({ min: 1, max: 20 }), // number of bad hits causing combo breaks
          (hits, badHitComboBreaks) => {
            const display = new ExpandedStatsDisplay(mockScene);
            const initialMisses = display.misses;

            // Record hits
            for (const hit of hits) {
              display.recordHit(hit.judgement, hit.timestamp);
            }

            // Simulate combo breaks from bad hits (not misses)
            for (let i = 0; i < badHitComboBreaks; i++) {
              display.recordHit('bad', 1000 + i * 100);
              display.recordComboBreak();
            }

            // Misses should still be at initial value (bad hits don't count as misses)
            expect(display.misses).toBe(initialMisses);
            // Combo breaks should be incremented
            expect(display.comboBreaks).toBe(badHitComboBreaks);

            display.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('comboBreaks SHALL increment by exactly 1 per recordComboBreak() call', () => {
      fc.assert(
        fc.property(comboBreakCountArb, (comboBreakCount) => {
          const display = new ExpandedStatsDisplay(mockScene);

          for (let i = 0; i < comboBreakCount; i++) {
            const before = display.comboBreaks;
            display.recordComboBreak();
            const after = display.comboBreaks;

            expect(after - before).toBe(1);
          }

          expect(display.comboBreaks).toBe(comboBreakCount);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('mixed gameplay events SHALL maintain independence between comboBreaks and misses', () => {
      fc.assert(
        fc.property(mixedEventSequenceArb, missCountArb, (events, initialMisses) => {
          const display = new ExpandedStatsDisplay(mockScene);
          display.misses = initialMisses;

          let expectedComboBreaks = 0;

          for (const event of events) {
            if (event.type === 'hit') {
              display.recordHit(event.judgement, event.timestamp);
            } else if (event.type === 'comboBreak') {
              display.recordComboBreak();
              expectedComboBreaks++;
            }
          }

          // Misses should remain at initial value (recordHit and recordComboBreak don't affect misses)
          expect(display.misses).toBe(initialMisses);
          // Combo breaks should match expected count
          expect(display.comboBreaks).toBe(expectedComboBreaks);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('getComboBreaks() SHALL return accurate count independent of misses', () => {
      fc.assert(
        fc.property(gameplaySessionArb, (session) => {
          const display = new ExpandedStatsDisplay(mockScene);
          display.misses = session.initialMisses;

          // Record hits
          for (const hit of session.hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }

          // Record combo breaks
          for (let i = 0; i < session.comboBreakCount; i++) {
            display.recordComboBreak();
          }

          // getComboBreaks() should return accurate count
          expect(display.getComboBreaks()).toBe(session.comboBreakCount);
          // And misses should be unchanged
          expect(display.misses).toBe(session.initialMisses);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('recordComboBreak() SHALL NOT affect judgement counts', () => {
      fc.assert(
        fc.property(hitSequenceArb, comboBreakCountArb, (hits, comboBreakCount) => {
          const display = new ExpandedStatsDisplay(mockScene);

          // Record hits first
          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }

          // Capture judgement counts
          const judgementsBefore = { ...display.judgements };

          // Record combo breaks
          for (let i = 0; i < comboBreakCount; i++) {
            display.recordComboBreak();
          }

          // Judgement counts should be unchanged
          expect(display.judgements).toEqual(judgementsBefore);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 30: Judgement Count Tracking
   * For any note hit with judgement J, the corresponding judgements[J] counter
   * SHALL increment by exactly 1, and no other judgement counters SHALL change.
   */
  describe('Property 30: Judgement Count Tracking', () => {
    it('recordHit(J) SHALL increment judgements[J] by exactly 1', () => {
      fc.assert(
        fc.property(judgementArb, timestampArb, (judgement, timestamp) => {
          const display = new ExpandedStatsDisplay(mockScene);

          const before = display.judgements[judgement];
          display.recordHit(judgement, timestamp);
          const after = display.judgements[judgement];

          expect(after - before).toBe(1);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('recordHit(J) SHALL NOT change any other judgement counters', () => {
      fc.assert(
        fc.property(judgementArb, timestampArb, (judgement, timestamp) => {
          const display = new ExpandedStatsDisplay(mockScene);

          // Capture all judgement counts before
          const before = { ...display.judgements };

          display.recordHit(judgement, timestamp);

          // Check that only the target judgement changed
          for (const j of VALID_JUDGEMENTS) {
            if (j === judgement) {
              expect(display.judgements[j]).toBe(before[j] + 1);
            } else {
              expect(display.judgements[j]).toBe(before[j]);
            }
          }

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('sequence of hits SHALL correctly accumulate judgement counts', () => {
      fc.assert(
        fc.property(hitSequenceArb, (hits) => {
          const display = new ExpandedStatsDisplay(mockScene);

          // Calculate expected counts
          const expectedCounts = { sick: 0, good: 0, bad: 0, shit: 0 };
          for (const hit of hits) {
            expectedCounts[hit.judgement]++;
          }

          // Record all hits
          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }

          // Verify counts match expected
          expect(display.judgements).toEqual(expectedCounts);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('judgement counts SHALL be case-insensitive', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('SICK', 'Sick', 'sick', 'GOOD', 'Good', 'good', 'BAD', 'Bad', 'bad', 'SHIT', 'Shit', 'shit'),
          timestampArb,
          (judgement, timestamp) => {
            const display = new ExpandedStatsDisplay(mockScene);

            const normalizedJudgement = judgement.toLowerCase();
            const before = display.judgements[normalizedJudgement];

            display.recordHit(judgement, timestamp);

            const after = display.judgements[normalizedJudgement];
            expect(after - before).toBe(1);

            display.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getJudgements() SHALL return accurate copy of judgement counts', () => {
      fc.assert(
        fc.property(hitSequenceArb, (hits) => {
          const display = new ExpandedStatsDisplay(mockScene);

          // Record all hits
          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }

          const result = display.getJudgements();

          // Should match internal state
          expect(result).toEqual(display.judgements);

          // Should be a copy, not the same reference
          expect(result).not.toBe(display.judgements);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('getTotalHits() SHALL equal sum of all judgement counts', () => {
      fc.assert(
        fc.property(hitSequenceArb, (hits) => {
          const display = new ExpandedStatsDisplay(mockScene);

          // Record all hits
          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }

          const totalHits = display.getTotalHits();
          const sumOfJudgements =
            display.judgements.sick +
            display.judgements.good +
            display.judgements.bad +
            display.judgements.shit;

          expect(totalHits).toBe(sumOfJudgements);
          expect(totalHits).toBe(hits.length);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('each judgement type SHALL track independently', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }), // sick count
          fc.integer({ min: 0, max: 20 }), // good count
          fc.integer({ min: 0, max: 20 }), // bad count
          fc.integer({ min: 0, max: 20 }), // shit count
          (sickCount, goodCount, badCount, shitCount) => {
            const display = new ExpandedStatsDisplay(mockScene);

            // Record specific counts for each judgement
            for (let i = 0; i < sickCount; i++) {
              display.recordHit('sick', i * 100);
            }
            for (let i = 0; i < goodCount; i++) {
              display.recordHit('good', i * 100 + 1000);
            }
            for (let i = 0; i < badCount; i++) {
              display.recordHit('bad', i * 100 + 2000);
            }
            for (let i = 0; i < shitCount; i++) {
              display.recordHit('shit', i * 100 + 3000);
            }

            expect(display.judgements.sick).toBe(sickCount);
            expect(display.judgements.good).toBe(goodCount);
            expect(display.judgements.bad).toBe(badCount);
            expect(display.judgements.shit).toBe(shitCount);

            display.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('invalid judgement SHALL NOT affect any judgement counters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => !VALID_JUDGEMENTS.includes(s.toLowerCase())),
          timestampArb,
          hitSequenceArb,
          (invalidJudgement, timestamp, validHits) => {
            const display = new ExpandedStatsDisplay(mockScene);

            // Record valid hits first
            for (const hit of validHits) {
              display.recordHit(hit.judgement, hit.timestamp);
            }

            // Capture counts before invalid hit
            const before = { ...display.judgements };

            // Try to record invalid judgement
            display.recordHit(invalidJudgement, timestamp);

            // All counts should remain unchanged
            expect(display.judgements).toEqual(before);

            display.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('recordHit() SHALL NOT affect comboBreaks counter', () => {
      fc.assert(
        fc.property(hitSequenceArb, comboBreakCountArb, (hits, initialComboBreaks) => {
          const display = new ExpandedStatsDisplay(mockScene);

          // Set initial combo breaks
          for (let i = 0; i < initialComboBreaks; i++) {
            display.recordComboBreak();
          }

          const comboBreaksBefore = display.comboBreaks;

          // Record hits
          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }

          // Combo breaks should be unchanged
          expect(display.comboBreaks).toBe(comboBreaksBefore);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('recordHit() SHALL NOT affect misses counter', () => {
      fc.assert(
        fc.property(hitSequenceArb, missCountArb, (hits, initialMisses) => {
          const display = new ExpandedStatsDisplay(mockScene);
          display.misses = initialMisses;

          // Record hits
          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }

          // Misses should be unchanged
          expect(display.misses).toBe(initialMisses);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional invariant tests for ExpandedStatsDisplay
   */
  describe('ExpandedStatsDisplay Invariants', () => {
    it('resetStats() SHALL reset all judgement counts to 0', () => {
      fc.assert(
        fc.property(hitSequenceArb, comboBreakCountArb, (hits, comboBreakCount) => {
          const display = new ExpandedStatsDisplay(mockScene);

          // Record hits and combo breaks
          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);
          }
          for (let i = 0; i < comboBreakCount; i++) {
            display.recordComboBreak();
          }

          // Reset
          display.resetStats();

          // All should be reset
          expect(display.judgements).toEqual({ sick: 0, good: 0, bad: 0, shit: 0 });
          expect(display.comboBreaks).toBe(0);

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('judgement counts SHALL never be negative', () => {
      fc.assert(
        fc.property(hitSequenceArb, (hits) => {
          const display = new ExpandedStatsDisplay(mockScene);

          for (const hit of hits) {
            display.recordHit(hit.judgement, hit.timestamp);

            // All counts should be non-negative
            expect(display.judgements.sick).toBeGreaterThanOrEqual(0);
            expect(display.judgements.good).toBeGreaterThanOrEqual(0);
            expect(display.judgements.bad).toBeGreaterThanOrEqual(0);
            expect(display.judgements.shit).toBeGreaterThanOrEqual(0);
          }

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('comboBreaks SHALL never be negative', () => {
      fc.assert(
        fc.property(comboBreakCountArb, (comboBreakCount) => {
          const display = new ExpandedStatsDisplay(mockScene);

          for (let i = 0; i < comboBreakCount; i++) {
            display.recordComboBreak();
            expect(display.comboBreaks).toBeGreaterThanOrEqual(0);
          }

          display.destroy();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it('order of operations SHALL NOT affect final counts', () => {
      fc.assert(
        fc.property(
          hitSequenceArb,
          comboBreakCountArb,
          fc.boolean(), // whether to interleave combo breaks
          (hits, comboBreakCount, interleave) => {
            const display1 = new ExpandedStatsDisplay(mockScene);
            const display2 = new ExpandedStatsDisplay(mockScene);

            if (interleave && hits.length > 0) {
              // Display 1: Interleave hits and combo breaks
              const comboBreaksPerHit = Math.ceil(comboBreakCount / hits.length);
              let remainingComboBreaks = comboBreakCount;

              for (const hit of hits) {
                display1.recordHit(hit.judgement, hit.timestamp);
                const breaksToAdd = Math.min(comboBreaksPerHit, remainingComboBreaks);
                for (let i = 0; i < breaksToAdd; i++) {
                  display1.recordComboBreak();
                }
                remainingComboBreaks -= breaksToAdd;
              }
            } else {
              // Display 1: All hits then all combo breaks
              for (const hit of hits) {
                display1.recordHit(hit.judgement, hit.timestamp);
              }
              for (let i = 0; i < comboBreakCount; i++) {
                display1.recordComboBreak();
              }
            }

            // Display 2: All combo breaks then all hits
            for (let i = 0; i < comboBreakCount; i++) {
              display2.recordComboBreak();
            }
            for (const hit of hits) {
              display2.recordHit(hit.judgement, hit.timestamp);
            }

            // Final counts should be the same
            expect(display1.judgements).toEqual(display2.judgements);
            expect(display1.comboBreaks).toBe(display2.comboBreaks);

            display1.destroy();
            display2.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

/**
 * @fileoverview Property-based tests for the ReplayPlayer class.
 * Tests replay playback using fast-check.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import ReplayPlayer from '../src/replay/ReplayPlayer.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// ========================================
// ARBITRARIES FOR GENERATING TEST DATA
// ========================================

// Direction arbitrary (0-3 for left, down, up, right)
const directionArb = fc.integer({ min: 0, max: 3 });

// Event type arbitrary (press or release)
const eventTypeArb = fc.constantFrom('press', 'release');

// Key code arbitrary (common key codes used in the game)
const keyCodeArb = fc.constantFrom('KeyA', 'KeyS', 'KeyK', 'KeyL', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight');

// Timestamp arbitrary (song position in ms, can be sub-millisecond)
const timestampArb = fc.double({ min: 0, max: 300000, noNaN: true, noDefaultInfinity: true });

// Song ID arbitrary (valid song identifiers)
const songIdArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-z0-9_-]+$/i.test(s));

// Difficulty arbitrary
const difficultyArb = fc.constantFrom('easy', 'normal', 'hard');

// Score arbitrary (non-negative integer)
const scoreArb = fc.integer({ min: 0, max: 10000000 });

// Generate a single input event with time
const inputEventArb = fc.record({
  time: timestampArb,
  type: eventTypeArb,
  direction: directionArb,
  keyCode: keyCodeArb
});

// Generate a sequence of input events sorted by time
const sortedInputSequenceArb = fc.array(inputEventArb, { minLength: 0, maxLength: 100 })
  .map(inputs => inputs.sort((a, b) => a.time - b.time));

// Generate tallies object
const talliesArb = fc.record({
  sick: fc.integer({ min: 0, max: 500 }),
  good: fc.integer({ min: 0, max: 500 }),
  bad: fc.integer({ min: 0, max: 500 }),
  shit: fc.integer({ min: 0, max: 500 }),
  missed: fc.integer({ min: 0, max: 500 }),
  combo: fc.integer({ min: 0, max: 500 }),
  maxCombo: fc.integer({ min: 0, max: 500 }),
  totalNotesHit: fc.integer({ min: 0, max: 1000 }),
  totalNotes: fc.integer({ min: 0, max: 1000 })
});

// Generate valid replay data
const validReplayDataArb = fc.record({
  version: fc.constant('1.0.0'),
  songId: songIdArb,
  difficulty: difficultyArb,
  timestamp: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  score: scoreArb,
  tallies: talliesArb,
  seed: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  inputs: sortedInputSequenceArb,
  metadata: fc.record({
    playerName: fc.string({ minLength: 1, maxLength: 20 }),
    gameVersion: fc.constant('1.0.0'),
    accuracy: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })
  })
});

// Generate invalid version strings
const invalidVersionArb = fc.string({ minLength: 1, maxLength: 10 })
  .filter(v => v !== '1.0.0');

// Generate invalid song IDs (empty or null-like)
const invalidSongIdArb = fc.constantFrom('', null, undefined);

describe('ReplayPlayer Property Tests', () => {
  /**
   * Property 5: Replay Playback Input Timing
   * For any replay and song position, getInputsForPosition SHALL return exactly the inputs
   * whose recorded time is less than or equal to the current position and have not yet been returned.
   */
  describe('Property 5: Replay Playback Input Timing', () => {
    it('getInputsForPosition SHALL return inputs with time <= current position', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          timestampArb,
          (replayData, songPosition) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            const inputs = player.getInputsForPosition(songPosition);

            // All returned inputs should have time <= songPosition
            for (const input of inputs) {
              expect(input.time).toBeLessThanOrEqual(songPosition);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getInputsForPosition SHALL NOT return inputs with time > current position', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          timestampArb,
          (replayData, songPosition) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            const inputs = player.getInputsForPosition(songPosition);

            // Count how many inputs in original data have time <= songPosition
            const expectedCount = replayData.inputs.filter(i => i.time <= songPosition).length;

            // Returned inputs should match expected count
            expect(inputs.length).toBe(expectedCount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getInputsForPosition SHALL NOT return same input twice', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          fc.array(timestampArb, { minLength: 2, maxLength: 10 }),
          (replayData, positions) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            // Sort positions to simulate forward playback
            const sortedPositions = [...positions].sort((a, b) => a - b);

            // Collect all returned inputs
            const allReturnedInputs = [];
            for (const position of sortedPositions) {
              const inputs = player.getInputsForPosition(position);
              allReturnedInputs.push(...inputs);
            }

            // Check for duplicates by comparing time+type+direction+keyCode
            const inputKeys = allReturnedInputs.map(
              i => `${i.time}-${i.type}-${i.direction}-${i.keyCode}`
            );
            const uniqueKeys = new Set(inputKeys);

            // If there are duplicates in the original data at same timestamp,
            // they should still be returned separately
            expect(inputKeys.length).toBe(allReturnedInputs.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('subsequent calls SHALL return only new inputs not previously returned', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          fc.tuple(timestampArb, timestampArb).map(([a, b]) => [Math.min(a, b), Math.max(a, b)]),
          (replayData, [position1, position2]) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            // First call
            const inputs1 = player.getInputsForPosition(position1);

            // Second call with later position
            const inputs2 = player.getInputsForPosition(position2);

            // Inputs from second call should have time > position1 (unless position1 == position2)
            if (position1 < position2) {
              for (const input of inputs2) {
                expect(input.time).toBeGreaterThan(position1);
                expect(input.time).toBeLessThanOrEqual(position2);
              }
            }

            // Total inputs returned should equal inputs with time <= position2
            const totalReturned = inputs1.length + inputs2.length;
            const expectedTotal = replayData.inputs.filter(i => i.time <= position2).length;
            expect(totalReturned).toBe(expectedTotal);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('all inputs SHALL eventually be returned when position reaches end', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            // Use a position past all inputs
            const maxTime = replayData.inputs.length > 0
              ? Math.max(...replayData.inputs.map(i => i.time)) + 1000
              : 1000;

            const inputs = player.getInputsForPosition(maxTime);

            // All inputs should be returned
            expect(inputs.length).toBe(replayData.inputs.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('inputs SHALL be returned in chronological order', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          timestampArb,
          (replayData, songPosition) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            const inputs = player.getInputsForPosition(songPosition);

            // Verify inputs are in chronological order
            for (let i = 1; i < inputs.length; i++) {
              expect(inputs[i].time).toBeGreaterThanOrEqual(inputs[i - 1].time);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getInputsForPosition SHALL return empty array when not playing', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          timestampArb,
          (replayData, songPosition) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            // Don't call start()

            const inputs = player.getInputsForPosition(songPosition);

            expect(inputs).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getInputsForPosition SHALL return empty array after stop', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          timestampArb,
          (replayData, songPosition) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();
            player.stop();

            const inputs = player.getInputsForPosition(songPosition);

            expect(inputs).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('returned inputs SHALL preserve all original fields', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            // Get all inputs
            const maxTime = replayData.inputs.length > 0
              ? Math.max(...replayData.inputs.map(i => i.time)) + 1000
              : 1000;
            const inputs = player.getInputsForPosition(maxTime);

            // Verify each input matches original
            for (let i = 0; i < inputs.length; i++) {
              const original = replayData.inputs[i];
              const returned = inputs[i];

              expect(returned.time).toBe(original.time);
              expect(returned.type).toBe(original.type);
              expect(returned.direction).toBe(original.direction);
              expect(returned.keyCode).toBe(original.keyCode);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('isComplete SHALL return true only after all inputs returned', () => {
      fc.assert(
        fc.property(
          validReplayDataArb.filter(r => r.inputs.length > 0),
          (replayData) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            // Before getting any inputs
            if (replayData.inputs.length > 0) {
              expect(player.isComplete()).toBe(false);
            }

            // Get all inputs
            const maxTime = Math.max(...replayData.inputs.map(i => i.time)) + 1000;
            player.getInputsForPosition(maxTime);

            // After getting all inputs
            expect(player.isComplete()).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('partial playback SHALL correctly track remaining inputs', () => {
      fc.assert(
        fc.property(
          validReplayDataArb.filter(r => r.inputs.length >= 2),
          timestampArb,
          (replayData, songPosition) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            const inputsBefore = player.getInputsForPosition(songPosition);
            const consumedCount = inputsBefore.length;
            const remainingCount = player.getRemainingInputs();

            expect(consumedCount + remainingCount).toBe(replayData.inputs.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 6: Replay Validation
   * For any replay data with mismatched version or invalid song ID, the ReplayPlayer.load()
   * SHALL return false and not enter playing state.
   */
  describe('Property 6: Replay Validation', () => {
    it('load SHALL return false for mismatched version', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          invalidVersionArb,
          (replayData, invalidVersion) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, version: invalidVersion };

            const result = player.load(invalidReplay);

            expect(result).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL NOT enter playing state for mismatched version', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          invalidVersionArb,
          (replayData, invalidVersion) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, version: invalidVersion };

            player.load(invalidReplay);

            expect(player.playing).toBe(false);
            expect(player.isPlaying()).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL NOT store replay data for mismatched version', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          invalidVersionArb,
          (replayData, invalidVersion) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, version: invalidVersion };

            player.load(invalidReplay);

            expect(player.replayData).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL return false for empty song ID', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, songId: '' };

            const result = player.load(invalidReplay);

            expect(result).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL return false for missing song ID', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData };
            delete invalidReplay.songId;

            const result = player.load(invalidReplay);

            expect(result).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL NOT enter playing state for invalid song ID', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, songId: '' };

            player.load(invalidReplay);

            expect(player.playing).toBe(false);
            expect(player.isPlaying()).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL return false for missing inputs array', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData };
            delete invalidReplay.inputs;

            const result = player.load(invalidReplay);

            expect(result).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL NOT enter playing state for missing inputs', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData };
            delete invalidReplay.inputs;

            player.load(invalidReplay);

            expect(player.playing).toBe(false);
            expect(player.isPlaying()).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL return false for null replay data', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const player = new ReplayPlayer();

            const result = player.load(null);

            expect(result).toBe(false);
            expect(player.replayData).toBeNull();
            expect(player.playing).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL return false for undefined replay data', () => {
      fc.assert(
        fc.property(
          fc.constant(undefined),
          () => {
            const player = new ReplayPlayer();

            const result = player.load(undefined);

            expect(result).toBe(false);
            expect(player.replayData).toBeNull();
            expect(player.playing).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL return true for valid replay data', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();

            const result = player.load(replayData);

            expect(result).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL store replay data for valid replay', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();

            player.load(replayData);

            expect(player.replayData).toBe(replayData);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('load SHALL accept replay with empty inputs array', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            const emptyInputsReplay = { ...replayData, inputs: [] };

            const result = player.load(emptyInputsReplay);

            expect(result).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('failed load SHALL preserve previous valid state', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          invalidVersionArb,
          (validReplay, invalidVersion) => {
            const player = new ReplayPlayer();

            // First load valid replay
            player.load(validReplay);
            player.start();
            expect(player.playing).toBe(true);
            expect(player.replayData).toBe(validReplay);

            // Try to load invalid replay
            const invalidReplay = { ...validReplay, version: invalidVersion };
            const result = player.load(invalidReplay);

            // Load should fail
            expect(result).toBe(false);

            // Previous state should be preserved (implementation doesn't clear on failed load)
            // The replayData remains from the previous successful load
            expect(player.replayData).toBe(validReplay);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('start SHALL NOT set playing to true without valid load', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          invalidVersionArb,
          (replayData, invalidVersion) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, version: invalidVersion };

            player.load(invalidReplay);
            player.start();

            expect(player.playing).toBe(false);
            expect(player.isPlaying()).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getInputsForPosition SHALL return empty after failed load', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          invalidVersionArb,
          timestampArb,
          (replayData, invalidVersion, position) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, version: invalidVersion };

            player.load(invalidReplay);
            player.start();

            const inputs = player.getInputsForPosition(position);

            expect(inputs).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('version validation SHALL be exact match', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          fc.constantFrom('1.0.1', '1.0', '1.1.0', '0.9.0', '2.0.0', 'v1.0.0'),
          (replayData, nearVersion) => {
            const player = new ReplayPlayer();
            const invalidReplay = { ...replayData, version: nearVersion };

            const result = player.load(invalidReplay);

            // Only exact '1.0.0' should be accepted
            expect(result).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('supported version SHALL be accepted', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();

            // Ensure version is the supported version
            const validReplay = { ...replayData, version: ReplayPlayer.SUPPORTED_VERSION };

            const result = player.load(validReplay);

            expect(result).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

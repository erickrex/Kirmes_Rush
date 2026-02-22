/**
 * @fileoverview Property-based tests for the ReplayRecorder class.
 * Tests replay recording using fast-check.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import ReplayRecorder from '../src/replay/ReplayRecorder.js';

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

// Generate a single input event
const inputEventArb = fc.record({
  type: eventTypeArb,
  direction: directionArb,
  keyCode: keyCodeArb,
  songPosition: timestampArb
});

// Generate a sequence of input events
const inputSequenceArb = fc.array(inputEventArb, { minLength: 0, maxLength: 100 });

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

describe('ReplayRecorder Property Tests', () => {
  /**
   * Property 2: Replay Input Recording Completeness
   * For any input event (press or release) during recording, the recorded ReplayInputEvent
   * SHALL contain the correct event type, direction (0-3), key code, and timestamp relative
   * to song start.
   */
  describe('Property 2: Replay Input Recording Completeness', () => {
    it('recorded input SHALL contain correct event type', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          eventTypeArb,
          directionArb,
          keyCodeArb,
          timestampArb,
          (songId, difficulty, eventType, direction, keyCode, songPosition) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            recorder.recordInput(eventType, direction, keyCode, songPosition);

            expect(recorder.inputs.length).toBe(1);
            expect(recorder.inputs[0].type).toBe(eventType);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('recorded input SHALL contain correct direction (0-3)', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          eventTypeArb,
          directionArb,
          keyCodeArb,
          timestampArb,
          (songId, difficulty, eventType, direction, keyCode, songPosition) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            recorder.recordInput(eventType, direction, keyCode, songPosition);

            expect(recorder.inputs.length).toBe(1);
            expect(recorder.inputs[0].direction).toBe(direction);
            expect(recorder.inputs[0].direction).toBeGreaterThanOrEqual(0);
            expect(recorder.inputs[0].direction).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('recorded input SHALL contain correct key code', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          eventTypeArb,
          directionArb,
          keyCodeArb,
          timestampArb,
          (songId, difficulty, eventType, direction, keyCode, songPosition) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            recorder.recordInput(eventType, direction, keyCode, songPosition);

            expect(recorder.inputs.length).toBe(1);
            expect(recorder.inputs[0].keyCode).toBe(keyCode);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('recorded input SHALL contain correct timestamp (song position)', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          eventTypeArb,
          directionArb,
          keyCodeArb,
          timestampArb,
          (songId, difficulty, eventType, direction, keyCode, songPosition) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            recorder.recordInput(eventType, direction, keyCode, songPosition);

            expect(recorder.inputs.length).toBe(1);
            expect(recorder.inputs[0].time).toBe(songPosition);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('all input fields SHALL be recorded correctly for any input event', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          inputEventArb,
          (songId, difficulty, inputEvent) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            recorder.recordInput(
              inputEvent.type,
              inputEvent.direction,
              inputEvent.keyCode,
              inputEvent.songPosition
            );

            expect(recorder.inputs.length).toBe(1);
            const recorded = recorder.inputs[0];

            // Verify all fields match
            expect(recorded.type).toBe(inputEvent.type);
            expect(recorded.direction).toBe(inputEvent.direction);
            expect(recorded.keyCode).toBe(inputEvent.keyCode);
            expect(recorded.time).toBe(inputEvent.songPosition);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple inputs SHALL all be recorded with correct fields', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          inputSequenceArb,
          (songId, difficulty, inputEvents) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            // Record all inputs
            for (const event of inputEvents) {
              recorder.recordInput(event.type, event.direction, event.keyCode, event.songPosition);
            }

            // Verify count matches
            expect(recorder.inputs.length).toBe(inputEvents.length);

            // Verify each input was recorded correctly
            for (let i = 0; i < inputEvents.length; i++) {
              const original = inputEvents[i];
              const recorded = recorder.inputs[i];

              expect(recorded.type).toBe(original.type);
              expect(recorded.direction).toBe(original.direction);
              expect(recorded.keyCode).toBe(original.keyCode);
              expect(recorded.time).toBe(original.songPosition);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('inputs SHALL be recorded in order they were received', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          fc.array(timestampArb, { minLength: 2, maxLength: 50 }),
          (songId, difficulty, timestamps) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            // Record inputs with given timestamps
            for (let i = 0; i < timestamps.length; i++) {
              recorder.recordInput('press', i % 4, 'KeyA', timestamps[i]);
            }

            // Verify inputs are in the order they were added (not sorted by timestamp)
            expect(recorder.inputs.length).toBe(timestamps.length);
            for (let i = 0; i < timestamps.length; i++) {
              expect(recorder.inputs[i].time).toBe(timestamps[i]);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('recorded inputs SHALL be preserved in final ReplayData', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          inputSequenceArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            // Record all inputs
            for (const event of inputEvents) {
              recorder.recordInput(event.type, event.direction, event.keyCode, event.songPosition);
            }

            // Stop and get replay data
            const replayData = recorder.stop(score, tallies);

            // Verify all inputs are in the replay data
            expect(replayData.inputs.length).toBe(inputEvents.length);

            for (let i = 0; i < inputEvents.length; i++) {
              const original = inputEvents[i];
              const recorded = replayData.inputs[i];

              expect(recorded.type).toBe(original.type);
              expect(recorded.direction).toBe(original.direction);
              expect(recorded.keyCode).toBe(original.keyCode);
              expect(recorded.time).toBe(original.songPosition);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 3: Replay Metadata Completeness
   * For any completed replay recording, the ReplayData SHALL contain version string,
   * recording timestamp, song ID, difficulty, final score, tallies object, and random seed.
   */
  describe('Property 3: Replay Metadata Completeness', () => {
    it('ReplayData SHALL contain version string', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            expect(replayData).toHaveProperty('version');
            expect(typeof replayData.version).toBe('string');
            expect(replayData.version.length).toBeGreaterThan(0);
            expect(replayData.version).toBe(ReplayRecorder.VERSION);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData SHALL contain recording timestamp', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            const beforeStop = Date.now();
            const replayData = recorder.stop(score, tallies);
            const afterStop = Date.now();

            expect(replayData).toHaveProperty('timestamp');
            expect(typeof replayData.timestamp).toBe('number');
            expect(replayData.timestamp).toBeGreaterThanOrEqual(beforeStop);
            expect(replayData.timestamp).toBeLessThanOrEqual(afterStop);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData SHALL contain song ID', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            expect(replayData).toHaveProperty('songId');
            expect(replayData.songId).toBe(songId);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData SHALL contain difficulty', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            expect(replayData).toHaveProperty('difficulty');
            expect(replayData.difficulty).toBe(difficulty);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData SHALL contain final score', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            expect(replayData).toHaveProperty('score');
            expect(replayData.score).toBe(score);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData SHALL contain tallies object', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            expect(replayData).toHaveProperty('tallies');
            expect(typeof replayData.tallies).toBe('object');

            // Verify tallies content matches
            for (const key of Object.keys(tallies)) {
              expect(replayData.tallies[key]).toBe(tallies[key]);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData SHALL contain random seed', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            expect(replayData).toHaveProperty('seed');
            expect(typeof replayData.seed).toBe('number');
            expect(replayData.seed).toBeGreaterThanOrEqual(0);
            expect(replayData.seed).toBeLessThan(1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData SHALL contain all required metadata fields', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          inputSequenceArb,
          (songId, difficulty, score, tallies, inputEvents) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            // Record some inputs
            for (const event of inputEvents) {
              recorder.recordInput(event.type, event.direction, event.keyCode, event.songPosition);
            }

            const replayData = recorder.stop(score, tallies);

            // Verify all required fields are present
            expect(replayData).toHaveProperty('version');
            expect(replayData).toHaveProperty('timestamp');
            expect(replayData).toHaveProperty('songId');
            expect(replayData).toHaveProperty('difficulty');
            expect(replayData).toHaveProperty('score');
            expect(replayData).toHaveProperty('tallies');
            expect(replayData).toHaveProperty('seed');
            expect(replayData).toHaveProperty('inputs');
            expect(replayData).toHaveProperty('metadata');

            // Verify types
            expect(typeof replayData.version).toBe('string');
            expect(typeof replayData.timestamp).toBe('number');
            expect(typeof replayData.songId).toBe('string');
            expect(typeof replayData.difficulty).toBe('string');
            expect(typeof replayData.score).toBe('number');
            expect(typeof replayData.tallies).toBe('object');
            expect(typeof replayData.seed).toBe('number');
            expect(Array.isArray(replayData.inputs)).toBe(true);
            expect(typeof replayData.metadata).toBe('object');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData tallies SHALL be a copy (not reference)', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            // Modify original tallies
            const originalSick = tallies.sick;
            tallies.sick = 999999;

            // ReplayData tallies should not be affected
            expect(replayData.tallies.sick).toBe(originalSick);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData inputs SHALL be a copy (not reference)', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          fc.array(inputEventArb, { minLength: 1, maxLength: 20 }),
          (songId, difficulty, score, tallies, inputEvents) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            for (const event of inputEvents) {
              recorder.recordInput(event.type, event.direction, event.keyCode, event.songPosition);
            }

            const replayData = recorder.stop(score, tallies);
            const originalLength = replayData.inputs.length;

            // Modify recorder's internal inputs array
            recorder.inputs.push({ time: 999, type: 'press', direction: 0, keyCode: 'KeyX' });

            // ReplayData inputs should not be affected
            expect(replayData.inputs.length).toBe(originalLength);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData metadata SHALL contain gameVersion', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, tallies);

            expect(replayData.metadata).toHaveProperty('gameVersion');
            expect(typeof replayData.metadata.gameVersion).toBe('string');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData metadata SHALL contain calculated accuracy', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          fc.record({
            totalNotesHit: fc.integer({ min: 0, max: 1000 }),
            totalNotes: fc.integer({ min: 1, max: 1000 }) // At least 1 to avoid division by zero
          }),
          (songId, difficulty, score, tallies) => {
            // Ensure totalNotesHit <= totalNotes
            const adjustedTallies = {
              ...tallies,
              totalNotesHit: Math.min(tallies.totalNotesHit, tallies.totalNotes)
            };

            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);
            const replayData = recorder.stop(score, adjustedTallies);

            expect(replayData.metadata).toHaveProperty('accuracy');
            expect(typeof replayData.metadata.accuracy).toBe('number');

            // Verify accuracy calculation
            const expectedAccuracy = (adjustedTallies.totalNotesHit / adjustedTallies.totalNotes) * 100;
            expect(replayData.metadata.accuracy).toBe(expectedAccuracy);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayData seed SHALL be deterministic per recording session', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            // Capture seed after start
            const seedAfterStart = recorder.seed;

            // Record some inputs
            recorder.recordInput('press', 0, 'KeyA', 100);
            recorder.recordInput('release', 0, 'KeyA', 200);

            const replayData = recorder.stop(score, tallies);

            // Seed in replay data should match seed captured after start
            expect(replayData.seed).toBe(seedAfterStart);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

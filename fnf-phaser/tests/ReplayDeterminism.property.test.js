/**
 * @fileoverview Property-based tests for Replay Playback Determinism.
 * Tests that replay recording and playback produces deterministic results.
 *
 * For any valid replay, playing it back through the ReplayPlayer produces inputs
 * at the exact timestamps they were recorded, and when processed by identical game logic,
 * produces the same final score.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import ReplayRecorder from '../src/replay/ReplayRecorder.js';
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

// Generate a single input event for recording
const inputEventArb = fc.record({
  type: eventTypeArb,
  direction: directionArb,
  keyCode: keyCodeArb,
  songPosition: timestampArb
});

// Generate a sequence of input events sorted by song position (realistic gameplay)
const sortedInputSequenceArb = fc.array(inputEventArb, { minLength: 1, maxLength: 100 })
  .map(inputs => inputs.sort((a, b) => a.songPosition - b.songPosition));

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

// Generate valid replay data directly
const validReplayDataArb = fc.record({
  version: fc.constant('1.0.0'),
  songId: songIdArb,
  difficulty: difficultyArb,
  timestamp: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  score: scoreArb,
  tallies: talliesArb,
  seed: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  inputs: fc.array(
    fc.record({
      time: timestampArb,
      type: eventTypeArb,
      direction: directionArb,
      keyCode: keyCodeArb
    }),
    { minLength: 1, maxLength: 100 }
  ).map(inputs => inputs.sort((a, b) => a.time - b.time)),
  metadata: fc.record({
    gameVersion: fc.constant('1.0.0'),
    accuracy: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })
  })
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Record inputs and create replay data
 * @param {string} songId
 * @param {string} difficulty
 * @param {Array} inputEvents
 * @param {number} score
 * @param {Object} tallies
 * @returns {Object} Replay data
 */
function createReplayFromInputs(songId, difficulty, inputEvents, score, tallies) {
  const recorder = new ReplayRecorder();
  recorder.start(songId, difficulty);

  for (const event of inputEvents) {
    recorder.recordInput(event.type, event.direction, event.keyCode, event.songPosition);
  }

  return recorder.stop(score, tallies);
}

/**
 * Play back a replay and collect all inputs
 * @param {Object} replayData
 * @returns {Array} All inputs from playback
 */
function playbackReplay(replayData) {
  const player = new ReplayPlayer();
  const loaded = player.load(replayData);

  if (!loaded) {
    return null;
  }

  player.start();

  // Get all inputs by using a position past all recorded inputs
  const maxTime = replayData.inputs.length > 0
    ? Math.max(...replayData.inputs.map(i => i.time)) + 1000
    : 1000;

  return player.getInputsForPosition(maxTime);
}

/**
 * Play back a replay incrementally and collect inputs at each position
 * @param {Object} replayData
 * @param {Array} positions - Song positions to query
 * @returns {Array} Array of input arrays for each position
 */
function playbackReplayIncremental(replayData, positions) {
  const player = new ReplayPlayer();
  const loaded = player.load(replayData);

  if (!loaded) {
    return null;
  }

  player.start();

  const results = [];
  for (const position of positions) {
    results.push(player.getInputsForPosition(position));
  }

  return results;
}

describe('Replay Determinism Property Tests', () => {
  /**
   * Property 4: Replay Playback Determinism
   * For any valid replay, playing it back through the ReplayPlayer SHALL produce inputs
   * at the exact timestamps they were recorded, and when processed by identical game logic,
   * SHALL produce the same final score.
   */
  describe('Property 4: Replay Playback Determinism', () => {
    // ========================================
    // TIMESTAMP PRESERVATION TESTS
    // ========================================

    it('recording inputs and playing them back SHALL produce inputs at exact same timestamps', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          sortedInputSequenceArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // Verify same number of inputs
            expect(playedBackInputs.length).toBe(inputEvents.length);

            // Verify each input has exact same timestamp
            for (let i = 0; i < inputEvents.length; i++) {
              expect(playedBackInputs[i].time).toBe(inputEvents[i].songPosition);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('input timestamps SHALL be preserved exactly through record/playback cycle', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            // Play back the replay
            const playedBackInputs = playbackReplay(replayData);

            // Verify each input timestamp matches exactly
            for (let i = 0; i < replayData.inputs.length; i++) {
              expect(playedBackInputs[i].time).toBe(replayData.inputs[i].time);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('sub-millisecond timestamps SHALL be preserved exactly', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          fc.array(
            fc.record({
              type: eventTypeArb,
              direction: directionArb,
              keyCode: keyCodeArb,
              // Use precise sub-millisecond timestamps
              songPosition: fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true })
            }),
            { minLength: 1, maxLength: 50 }
          ).map(inputs => inputs.sort((a, b) => a.songPosition - b.songPosition)),
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs with sub-millisecond precision
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // Verify sub-millisecond precision is preserved
            for (let i = 0; i < inputEvents.length; i++) {
              expect(playedBackInputs[i].time).toBe(inputEvents[i].songPosition);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    // ========================================
    // MULTIPLE PLAYBACK DETERMINISM TESTS
    // ========================================

    it('the same replay played multiple times SHALL produce identical input sequences', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          fc.integer({ min: 2, max: 5 }),
          (replayData, playbackCount) => {
            const playbackResults = [];

            // Play back the same replay multiple times
            for (let i = 0; i < playbackCount; i++) {
              const inputs = playbackReplay(replayData);
              playbackResults.push(inputs);
            }

            // All playbacks should produce identical results
            const firstPlayback = playbackResults[0];
            for (let i = 1; i < playbackResults.length; i++) {
              const currentPlayback = playbackResults[i];

              // Same number of inputs
              expect(currentPlayback.length).toBe(firstPlayback.length);

              // Each input should be identical
              for (let j = 0; j < firstPlayback.length; j++) {
                expect(currentPlayback[j].time).toBe(firstPlayback[j].time);
                expect(currentPlayback[j].type).toBe(firstPlayback[j].type);
                expect(currentPlayback[j].direction).toBe(firstPlayback[j].direction);
                expect(currentPlayback[j].keyCode).toBe(firstPlayback[j].keyCode);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple playbacks with same query positions SHALL return identical inputs', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          fc.array(timestampArb, { minLength: 1, maxLength: 20 })
            .map(positions => [...positions].sort((a, b) => a - b)),
          (replayData, queryPositions) => {
            // First playback
            const results1 = playbackReplayIncremental(replayData, queryPositions);

            // Second playback with same positions
            const results2 = playbackReplayIncremental(replayData, queryPositions);

            // Results should be identical
            expect(results1.length).toBe(results2.length);

            for (let i = 0; i < results1.length; i++) {
              expect(results1[i].length).toBe(results2[i].length);

              for (let j = 0; j < results1[i].length; j++) {
                expect(results1[i][j].time).toBe(results2[i][j].time);
                expect(results1[i][j].type).toBe(results2[i][j].type);
                expect(results1[i][j].direction).toBe(results2[i][j].direction);
                expect(results1[i][j].keyCode).toBe(results2[i][j].keyCode);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    // ========================================
    // INPUT FIELD PRESERVATION TESTS
    // ========================================

    it('all input fields SHALL be preserved exactly through record/playback cycle', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          sortedInputSequenceArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // Verify all fields match
            for (let i = 0; i < inputEvents.length; i++) {
              const original = inputEvents[i];
              const playedBack = playedBackInputs[i];

              expect(playedBack.time).toBe(original.songPosition);
              expect(playedBack.type).toBe(original.type);
              expect(playedBack.direction).toBe(original.direction);
              expect(playedBack.keyCode).toBe(original.keyCode);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('input event types (press/release) SHALL be preserved exactly', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const playedBackInputs = playbackReplay(replayData);

            for (let i = 0; i < replayData.inputs.length; i++) {
              expect(playedBackInputs[i].type).toBe(replayData.inputs[i].type);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('input directions (0-3) SHALL be preserved exactly', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const playedBackInputs = playbackReplay(replayData);

            for (let i = 0; i < replayData.inputs.length; i++) {
              expect(playedBackInputs[i].direction).toBe(replayData.inputs[i].direction);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('input key codes SHALL be preserved exactly', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const playedBackInputs = playbackReplay(replayData);

            for (let i = 0; i < replayData.inputs.length; i++) {
              expect(playedBackInputs[i].keyCode).toBe(replayData.inputs[i].keyCode);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    // ========================================
    // INPUT ORDER PRESERVATION TESTS
    // ========================================

    it('input order SHALL be preserved exactly through record/playback cycle', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          sortedInputSequenceArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // Verify order is preserved
            expect(playedBackInputs.length).toBe(inputEvents.length);

            for (let i = 0; i < inputEvents.length; i++) {
              // Each input at index i should match the original at index i
              expect(playedBackInputs[i].time).toBe(inputEvents[i].songPosition);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('inputs at same timestamp SHALL maintain their relative order', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          // Generate inputs with some at the same timestamp
          fc.array(
            fc.record({
              type: eventTypeArb,
              direction: directionArb,
              keyCode: keyCodeArb,
              // Use integer timestamps to increase chance of collisions
              songPosition: fc.integer({ min: 0, max: 100 }).map(n => n * 100)
            }),
            { minLength: 2, maxLength: 50 }
          ).map(inputs => inputs.sort((a, b) => a.songPosition - b.songPosition)),
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // Verify order is preserved even for same-timestamp inputs
            for (let i = 0; i < inputEvents.length; i++) {
              expect(playedBackInputs[i].time).toBe(inputEvents[i].songPosition);
              expect(playedBackInputs[i].type).toBe(inputEvents[i].type);
              expect(playedBackInputs[i].direction).toBe(inputEvents[i].direction);
              expect(playedBackInputs[i].keyCode).toBe(inputEvents[i].keyCode);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    // ========================================
    // INCREMENTAL PLAYBACK DETERMINISM TESTS
    // ========================================

    it('incremental playback SHALL return inputs at correct positions', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          fc.array(timestampArb, { minLength: 1, maxLength: 10 })
            .map(positions => [...positions].sort((a, b) => a - b)),
          (replayData, queryPositions) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            let totalInputsReturned = 0;

            for (const position of queryPositions) {
              const inputs = player.getInputsForPosition(position);

              // All returned inputs should have time <= position
              for (const input of inputs) {
                expect(input.time).toBeLessThanOrEqual(position);
              }

              totalInputsReturned += inputs.length;
            }

            // Total inputs returned should not exceed total inputs in replay
            expect(totalInputsReturned).toBeLessThanOrEqual(replayData.inputs.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('complete playback SHALL return all inputs exactly once', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const player = new ReplayPlayer();
            player.load(replayData);
            player.start();

            // Collect all inputs through incremental playback
            const allInputs = [];
            let lastPosition = 0;

            for (const input of replayData.inputs) {
              const inputs = player.getInputsForPosition(input.time);
              allInputs.push(...inputs);
              lastPosition = input.time;
            }

            // Get any remaining inputs
            const remaining = player.getInputsForPosition(lastPosition + 1000);
            allInputs.push(...remaining);

            // Should have exactly the same number of inputs
            expect(allInputs.length).toBe(replayData.inputs.length);

            // Each input should match
            for (let i = 0; i < replayData.inputs.length; i++) {
              expect(allInputs[i].time).toBe(replayData.inputs[i].time);
              expect(allInputs[i].type).toBe(replayData.inputs[i].type);
              expect(allInputs[i].direction).toBe(replayData.inputs[i].direction);
              expect(allInputs[i].keyCode).toBe(replayData.inputs[i].keyCode);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    // ========================================
    // SCORE DETERMINISM TESTS
    // ========================================

    it('replay metadata (score, tallies) SHALL be preserved for deterministic scoring', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          sortedInputSequenceArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Verify score is preserved
            expect(replayData.score).toBe(score);

            // Verify tallies are preserved
            for (const key of Object.keys(tallies)) {
              expect(replayData.tallies[key]).toBe(tallies[key]);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('replay seed SHALL be preserved for deterministic random behavior', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          sortedInputSequenceArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs
            const recorder = new ReplayRecorder();
            recorder.start(songId, difficulty);

            const seedAfterStart = recorder.seed;

            for (const event of inputEvents) {
              recorder.recordInput(event.type, event.direction, event.keyCode, event.songPosition);
            }

            const replayData = recorder.stop(score, tallies);

            // Seed should be preserved
            expect(replayData.seed).toBe(seedAfterStart);
            expect(typeof replayData.seed).toBe('number');
            expect(replayData.seed).toBeGreaterThanOrEqual(0);
            expect(replayData.seed).toBeLessThan(1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    // ========================================
    // EDGE CASE TESTS
    // ========================================

    it('empty input sequence SHALL be handled deterministically', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, score, tallies) => {
            // Record with no inputs
            const replayData = createReplayFromInputs(songId, difficulty, [], score, tallies);

            // Play back multiple times
            const playback1 = playbackReplay(replayData);
            const playback2 = playbackReplay(replayData);

            // Both should return empty arrays
            expect(playback1.length).toBe(0);
            expect(playback2.length).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('single input SHALL be handled deterministically', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          inputEventArb,
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvent, score, tallies) => {
            // Record single input
            const replayData = createReplayFromInputs(songId, difficulty, [inputEvent], score, tallies);

            // Play back multiple times
            const playback1 = playbackReplay(replayData);
            const playback2 = playbackReplay(replayData);

            // Both should return identical single input
            expect(playback1.length).toBe(1);
            expect(playback2.length).toBe(1);

            expect(playback1[0].time).toBe(playback2[0].time);
            expect(playback1[0].type).toBe(playback2[0].type);
            expect(playback1[0].direction).toBe(playback2[0].direction);
            expect(playback1[0].keyCode).toBe(playback2[0].keyCode);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('large input sequences SHALL be handled deterministically', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          fc.array(inputEventArb, { minLength: 50, maxLength: 100 })
            .map(inputs => inputs.sort((a, b) => a.songPosition - b.songPosition)),
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record large sequence
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // Verify all inputs match
            expect(playedBackInputs.length).toBe(inputEvents.length);

            for (let i = 0; i < inputEvents.length; i++) {
              expect(playedBackInputs[i].time).toBe(inputEvents[i].songPosition);
              expect(playedBackInputs[i].type).toBe(inputEvents[i].type);
              expect(playedBackInputs[i].direction).toBe(inputEvents[i].direction);
              expect(playedBackInputs[i].keyCode).toBe(inputEvents[i].keyCode);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('inputs at time zero SHALL be handled deterministically', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          fc.array(
            fc.record({
              type: eventTypeArb,
              direction: directionArb,
              keyCode: keyCodeArb,
              songPosition: fc.constant(0) // All at time 0
            }),
            { minLength: 1, maxLength: 10 }
          ),
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs at time 0
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // All inputs should be at time 0
            expect(playedBackInputs.length).toBe(inputEvents.length);
            for (const input of playedBackInputs) {
              expect(input.time).toBe(0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('inputs at maximum timestamp SHALL be handled deterministically', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          fc.array(
            fc.record({
              type: eventTypeArb,
              direction: directionArb,
              keyCode: keyCodeArb,
              songPosition: fc.constant(300000) // Max timestamp (5 minutes)
            }),
            { minLength: 1, maxLength: 10 }
          ),
          scoreArb,
          talliesArb,
          (songId, difficulty, inputEvents, score, tallies) => {
            // Record inputs at max time
            const replayData = createReplayFromInputs(songId, difficulty, inputEvents, score, tallies);

            // Play back
            const playedBackInputs = playbackReplay(replayData);

            // All inputs should be at max time
            expect(playedBackInputs.length).toBe(inputEvents.length);
            for (const input of playedBackInputs) {
              expect(input.time).toBe(300000);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

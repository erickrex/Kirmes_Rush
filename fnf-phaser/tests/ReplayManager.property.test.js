/**
 * @fileoverview Property-based tests for the ReplayManager class.
 * Tests replay storage and retrieval using fast-check.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import ReplayManager from '../src/replay/ReplayManager.js';

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

// Timestamp arbitrary (song position in ms)
const timestampArb = fc.double({ min: 0, max: 300000, noNaN: true, noDefaultInfinity: true });

// Song ID arbitrary (valid song identifiers)
const songIdArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-z0-9_-]+$/i.test(s));

// Difficulty arbitrary
const difficultyArb = fc.constantFrom('easy', 'normal', 'hard');

// Score arbitrary (non-negative integer)
const scoreArb = fc.integer({ min: 0, max: 10000000 });

// Accuracy arbitrary (0-100 percentage)
const accuracyArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

// Recording timestamp arbitrary (Date.now() style)
const recordingTimestampArb = fc.integer({ min: 1000000000000, max: 2000000000000 });

// Generate a single input event with time
const inputEventArb = fc.record({
  time: timestampArb,
  type: eventTypeArb,
  direction: directionArb,
  keyCode: keyCodeArb
});

// Generate a sequence of input events sorted by time
const sortedInputSequenceArb = fc.array(inputEventArb, { minLength: 0, maxLength: 50 })
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
  timestamp: recordingTimestampArb,
  score: scoreArb,
  tallies: talliesArb,
  seed: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  inputs: sortedInputSequenceArb,
  metadata: fc.record({
    playerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    gameVersion: fc.constant('1.0.0'),
    accuracy: accuracyArb
  })
});

// Generate multiple replay data with unique timestamps
const multipleReplayDataArb = (count) => {
  return fc.array(validReplayDataArb, { minLength: count, maxLength: count })
    .map(replays => {
      // Ensure unique timestamps
      const baseTimestamp = Date.now();
      return replays.map((replay, index) => ({
        ...replay,
        timestamp: baseTimestamp + index * 1000
      }));
    });
};

// ========================================
// MOCK LOCALSTORAGE
// ========================================

/**
 * Mock localStorage for testing
 */
function createMockLocalStorage() {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => Object.keys(store)[index] || null),
    _getStore: () => store
  };
}

describe('ReplayManager Property Tests', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Helper to create a fresh manager for each property test iteration
   */
  function createFreshManager() {
    // Clear the mock storage to ensure isolation
    mockStorage.clear();
    return new ReplayManager();
  }

  /**
   * Property 1: Replay Data Round-Trip
   * For any valid ReplayData object, serializing to JSON and then deserializing back
   * SHALL produce an equivalent ReplayData object with identical inputs, score, tallies, and metadata.
   */
  describe('Property 1: Replay Data Round-Trip', () => {
    it('serializing and deserializing SHALL produce equivalent ReplayData', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            // Save the replay (serializes to JSON)
            const id = manager.saveReplay(replayData);

            // Load the replay (deserializes from JSON)
            const loaded = manager.loadReplay(id);

            // Verify loaded data is equivalent to original
            expect(loaded).not.toBeNull();
            expect(loaded.version).toBe(replayData.version);
            expect(loaded.songId).toBe(replayData.songId);
            expect(loaded.difficulty).toBe(replayData.difficulty);
            expect(loaded.timestamp).toBe(replayData.timestamp);
            expect(loaded.score).toBe(replayData.score);
            expect(loaded.seed).toBe(replayData.seed);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('round-trip SHALL preserve all inputs exactly', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);
            const loaded = manager.loadReplay(id);

            expect(loaded).not.toBeNull();
            expect(loaded.inputs.length).toBe(replayData.inputs.length);

            // Verify each input matches
            for (let i = 0; i < replayData.inputs.length; i++) {
              const original = replayData.inputs[i];
              const loadedInput = loaded.inputs[i];

              expect(loadedInput.time).toBe(original.time);
              expect(loadedInput.type).toBe(original.type);
              expect(loadedInput.direction).toBe(original.direction);
              expect(loadedInput.keyCode).toBe(original.keyCode);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('round-trip SHALL preserve tallies exactly', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);
            const loaded = manager.loadReplay(id);

            expect(loaded).not.toBeNull();

            // Verify all tally fields match
            expect(loaded.tallies.sick).toBe(replayData.tallies.sick);
            expect(loaded.tallies.good).toBe(replayData.tallies.good);
            expect(loaded.tallies.bad).toBe(replayData.tallies.bad);
            expect(loaded.tallies.shit).toBe(replayData.tallies.shit);
            expect(loaded.tallies.missed).toBe(replayData.tallies.missed);
            expect(loaded.tallies.combo).toBe(replayData.tallies.combo);
            expect(loaded.tallies.maxCombo).toBe(replayData.tallies.maxCombo);
            expect(loaded.tallies.totalNotesHit).toBe(replayData.tallies.totalNotesHit);
            expect(loaded.tallies.totalNotes).toBe(replayData.tallies.totalNotes);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('round-trip SHALL preserve metadata exactly', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);
            const loaded = manager.loadReplay(id);

            expect(loaded).not.toBeNull();

            // Verify metadata fields match
            expect(loaded.metadata.playerName).toBe(replayData.metadata.playerName);
            expect(loaded.metadata.gameVersion).toBe(replayData.metadata.gameVersion);
            expect(loaded.metadata.accuracy).toBe(replayData.metadata.accuracy);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('round-trip SHALL preserve score exactly', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);
            const loaded = manager.loadReplay(id);

            expect(loaded).not.toBeNull();
            expect(loaded.score).toBe(replayData.score);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple round-trips SHALL produce identical data', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            // First round-trip
            const id1 = manager.saveReplay(replayData);
            const loaded1 = manager.loadReplay(id1);

            // Second round-trip using loaded data
            const id2 = manager.saveReplay(loaded1);
            const loaded2 = manager.loadReplay(id2);

            // Both loaded versions should be equivalent
            expect(loaded2.version).toBe(loaded1.version);
            expect(loaded2.songId).toBe(loaded1.songId);
            expect(loaded2.difficulty).toBe(loaded1.difficulty);
            expect(loaded2.timestamp).toBe(loaded1.timestamp);
            expect(loaded2.score).toBe(loaded1.score);
            expect(loaded2.inputs.length).toBe(loaded1.inputs.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('round-trip SHALL work for replays with empty inputs array', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const emptyInputsReplay = { ...replayData, inputs: [] };
            const id = manager.saveReplay(emptyInputsReplay);
            const loaded = manager.loadReplay(id);

            expect(loaded).not.toBeNull();
            expect(loaded.inputs).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('round-trip SHALL work for replays with large inputs array', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          fc.array(inputEventArb, { minLength: 100, maxLength: 200 }),
          (replayData, largeInputs) => {
            const manager = createFreshManager();
            const largeReplay = { ...replayData, inputs: largeInputs };
            const id = manager.saveReplay(largeReplay);
            const loaded = manager.loadReplay(id);

            expect(loaded).not.toBeNull();
            expect(loaded.inputs.length).toBe(largeInputs.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 7: Replay List Ordering
   * For any set of saved replays, getReplayList() SHALL return entries sorted by timestamp
   * in descending order (newest first).
   */
  describe('Property 7: Replay List Ordering', () => {
    it('getReplayList SHALL return entries sorted by timestamp descending', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 2, maxLength: 20 }),
          (replays) => {
            const manager = createFreshManager();
            // Ensure unique timestamps
            const uniqueReplays = replays.map((replay, index) => ({
              ...replay,
              timestamp: Date.now() + index * 1000 + Math.random() * 100
            }));

            // Save all replays
            for (const replay of uniqueReplays) {
              manager.saveReplay(replay);
            }

            // Get the list
            const list = manager.getReplayList();

            // Verify sorted by timestamp descending (newest first)
            for (let i = 1; i < list.length; i++) {
              expect(list[i - 1].timestamp).toBeGreaterThanOrEqual(list[i].timestamp);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('newest replay SHALL always be first in list', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 2, maxLength: 10 }),
          (replays) => {
            const manager = createFreshManager();
            // Create replays with known timestamps
            const baseTime = Date.now();
            const timedReplays = replays.map((replay, index) => ({
              ...replay,
              timestamp: baseTime + index * 1000
            }));

            // Save all replays
            for (const replay of timedReplays) {
              manager.saveReplay(replay);
            }

            // The last saved replay has the highest timestamp
            const newestTimestamp = timedReplays[timedReplays.length - 1].timestamp;

            const list = manager.getReplayList();
            expect(list[0].timestamp).toBe(newestTimestamp);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('oldest replay SHALL always be last in list', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 2, maxLength: 10 }),
          (replays) => {
            const manager = createFreshManager();
            // Create replays with known timestamps
            const baseTime = Date.now();
            const timedReplays = replays.map((replay, index) => ({
              ...replay,
              timestamp: baseTime + index * 1000
            }));

            // Save all replays
            for (const replay of timedReplays) {
              manager.saveReplay(replay);
            }

            // The first saved replay has the lowest timestamp
            const oldestTimestamp = timedReplays[0].timestamp;

            const list = manager.getReplayList();
            expect(list[list.length - 1].timestamp).toBe(oldestTimestamp);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ordering SHALL be maintained after adding new replays', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 2, maxLength: 5 }),
          validReplayDataArb,
          (initialReplays, newReplay) => {
            const manager = createFreshManager();
            // Save initial replays with older timestamps
            const baseTime = Date.now() - 100000;
            for (let i = 0; i < initialReplays.length; i++) {
              manager.saveReplay({
                ...initialReplays[i],
                timestamp: baseTime + i * 1000
              });
            }

            // Save new replay with newest timestamp
            const newestTimestamp = Date.now();
            manager.saveReplay({
              ...newReplay,
              timestamp: newestTimestamp
            });

            const list = manager.getReplayList();

            // New replay should be first
            expect(list[0].timestamp).toBe(newestTimestamp);

            // All entries should still be sorted
            for (let i = 1; i < list.length; i++) {
              expect(list[i - 1].timestamp).toBeGreaterThanOrEqual(list[i].timestamp);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ordering SHALL be maintained after deleting replays', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 3, maxLength: 10 }),
          (replays) => {
            const manager = createFreshManager();
            // Save replays with unique timestamps
            const ids = [];
            const baseTime = Date.now();
            for (let i = 0; i < replays.length; i++) {
              const id = manager.saveReplay({
                ...replays[i],
                timestamp: baseTime + i * 1000
              });
              ids.push(id);
            }

            // Delete a replay from the middle
            const middleIndex = Math.floor(ids.length / 2);
            manager.deleteReplay(ids[middleIndex]);

            const list = manager.getReplayList();

            // Remaining entries should still be sorted
            for (let i = 1; i < list.length; i++) {
              expect(list[i - 1].timestamp).toBeGreaterThanOrEqual(list[i].timestamp);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 8: Replay List Entry Completeness
   * For any replay in the list, the ReplayListEntry SHALL contain song name, difficulty,
   * score, accuracy, and timestamp.
   */
  describe('Property 8: Replay List Entry Completeness', () => {
    it('ReplayListEntry SHALL contain id', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();

            expect(list.length).toBe(1);
            expect(list[0]).toHaveProperty('id');
            expect(typeof list[0].id).toBe('string');
            expect(list[0].id.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayListEntry SHALL contain songId', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();

            expect(list[0]).toHaveProperty('songId');
            expect(list[0].songId).toBe(replayData.songId);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayListEntry SHALL contain songName', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();

            expect(list[0]).toHaveProperty('songName');
            expect(typeof list[0].songName).toBe('string');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayListEntry SHALL contain difficulty', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();

            expect(list[0]).toHaveProperty('difficulty');
            expect(list[0].difficulty).toBe(replayData.difficulty);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayListEntry SHALL contain score', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();

            expect(list[0]).toHaveProperty('score');
            expect(list[0].score).toBe(replayData.score);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayListEntry SHALL contain accuracy', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();

            expect(list[0]).toHaveProperty('accuracy');
            expect(list[0].accuracy).toBe(replayData.metadata.accuracy);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('ReplayListEntry SHALL contain timestamp', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();

            expect(list[0]).toHaveProperty('timestamp');
            expect(list[0].timestamp).toBe(replayData.timestamp);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('all ReplayListEntry fields SHALL be present for any replay', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            manager.saveReplay(replayData);
            const list = manager.getReplayList();
            const entry = list[0];

            // Verify all required fields are present
            expect(entry).toHaveProperty('id');
            expect(entry).toHaveProperty('songId');
            expect(entry).toHaveProperty('songName');
            expect(entry).toHaveProperty('difficulty');
            expect(entry).toHaveProperty('score');
            expect(entry).toHaveProperty('accuracy');
            expect(entry).toHaveProperty('timestamp');

            // Verify types
            expect(typeof entry.id).toBe('string');
            expect(typeof entry.songId).toBe('string');
            expect(typeof entry.songName).toBe('string');
            expect(typeof entry.difficulty).toBe('string');
            expect(typeof entry.score).toBe('number');
            expect(typeof entry.accuracy).toBe('number');
            expect(typeof entry.timestamp).toBe('number');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('all entries in list SHALL have complete fields', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 1, maxLength: 10 }),
          (replays) => {
            const manager = createFreshManager();
            // Save all replays with unique timestamps
            for (let i = 0; i < replays.length; i++) {
              manager.saveReplay({
                ...replays[i],
                timestamp: Date.now() + i * 1000
              });
            }

            const list = manager.getReplayList();

            // Every entry should have all required fields
            for (const entry of list) {
              expect(entry).toHaveProperty('id');
              expect(entry).toHaveProperty('songId');
              expect(entry).toHaveProperty('songName');
              expect(entry).toHaveProperty('difficulty');
              expect(entry).toHaveProperty('score');
              expect(entry).toHaveProperty('accuracy');
              expect(entry).toHaveProperty('timestamp');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 9: Replay Deletion
   * For any replay ID, after calling deleteReplay(id), the replay SHALL no longer appear
   * in getReplayList() and loadReplay(id) SHALL return null.
   */
  describe('Property 9: Replay Deletion', () => {
    it('deleted replay SHALL NOT appear in getReplayList', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);

            // Verify it exists in list
            let list = manager.getReplayList();
            expect(list.some(entry => entry.id === id)).toBe(true);

            // Delete the replay
            manager.deleteReplay(id);

            // Verify it no longer exists in list
            list = manager.getReplayList();
            expect(list.some(entry => entry.id === id)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('loadReplay SHALL return null for deleted replay', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);

            // Verify it can be loaded
            expect(manager.loadReplay(id)).not.toBeNull();

            // Delete the replay
            manager.deleteReplay(id);

            // Verify it can no longer be loaded
            expect(manager.loadReplay(id)).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('deleting one replay SHALL NOT affect other replays', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 3, maxLength: 10 }),
          (replays) => {
            const manager = createFreshManager();
            // Save all replays with unique timestamps
            const ids = [];
            for (let i = 0; i < replays.length; i++) {
              const id = manager.saveReplay({
                ...replays[i],
                timestamp: Date.now() + i * 1000
              });
              ids.push(id);
            }

            // Delete the middle replay
            const deleteIndex = Math.floor(ids.length / 2);
            const deletedId = ids[deleteIndex];
            manager.deleteReplay(deletedId);

            // Verify other replays still exist
            for (let i = 0; i < ids.length; i++) {
              if (i === deleteIndex) {
                expect(manager.loadReplay(ids[i])).toBeNull();
              } else {
                expect(manager.loadReplay(ids[i])).not.toBeNull();
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('deleted replay SHALL be removed from list count', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 2, maxLength: 10 }),
          (replays) => {
            const manager = createFreshManager();
            // Save all replays
            const ids = [];
            for (let i = 0; i < replays.length; i++) {
              const id = manager.saveReplay({
                ...replays[i],
                timestamp: Date.now() + i * 1000
              });
              ids.push(id);
            }

            const countBefore = manager.getReplayList().length;

            // Delete one replay
            manager.deleteReplay(ids[0]);

            const countAfter = manager.getReplayList().length;

            expect(countAfter).toBe(countBefore - 1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple deletions SHALL work correctly', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 5, maxLength: 15 }),
          (replays) => {
            const manager = createFreshManager();
            // Save all replays
            const ids = [];
            for (let i = 0; i < replays.length; i++) {
              const id = manager.saveReplay({
                ...replays[i],
                timestamp: Date.now() + i * 1000
              });
              ids.push(id);
            }

            // Delete every other replay
            const deletedIds = [];
            for (let i = 0; i < ids.length; i += 2) {
              manager.deleteReplay(ids[i]);
              deletedIds.push(ids[i]);
            }

            // Verify deleted replays are gone
            for (const deletedId of deletedIds) {
              expect(manager.loadReplay(deletedId)).toBeNull();
              expect(manager.getReplayList().some(e => e.id === deletedId)).toBe(false);
            }

            // Verify remaining replays still exist
            for (let i = 1; i < ids.length; i += 2) {
              expect(manager.loadReplay(ids[i])).not.toBeNull();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('deleteReplay SHALL return true for existing replay', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);
            const result = manager.deleteReplay(id);

            expect(result).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('deleteReplay SHALL return false for non-existent replay', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 30 }),
          (fakeId) => {
            const manager = createFreshManager();
            const result = manager.deleteReplay(fakeId);
            expect(result).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('deleteReplay SHALL return false for already deleted replay', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const id = manager.saveReplay(replayData);

            // First deletion should succeed
            expect(manager.deleteReplay(id)).toBe(true);

            // Second deletion should fail
            expect(manager.deleteReplay(id)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 10: Replay Filtering
   * For any song filter query, filterBySong(songId) SHALL return only replays where
   * the songId matches exactly.
   */
  describe('Property 10: Replay Filtering', () => {
    it('filterBySong SHALL return only replays with exact songId match', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 2, maxLength: 15 }),
          songIdArb,
          (replays, targetSongId) => {
            const manager = createFreshManager();
            // Save replays with various songIds, some matching target
            for (let i = 0; i < replays.length; i++) {
              // Alternate between target songId and original songId
              const songId = i % 2 === 0 ? targetSongId : replays[i].songId;
              manager.saveReplay({
                ...replays[i],
                songId,
                timestamp: Date.now() + i * 1000
              });
            }

            // Filter by target songId
            const filtered = manager.filterBySong(targetSongId);

            // All returned entries should have exact songId match
            for (const entry of filtered) {
              expect(entry.songId).toBe(targetSongId);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('filterBySong SHALL NOT return replays with different songId', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 2, maxLength: 10 }),
          songIdArb,
          songIdArb.filter(s => s.length > 0),
          (replays, songId1, songId2) => {
            const manager = createFreshManager();
            // Ensure songIds are different
            const differentSongId2 = songId1 === songId2 ? songId2 + '_different' : songId2;

            // Save replays with songId1
            for (let i = 0; i < replays.length; i++) {
              manager.saveReplay({
                ...replays[i],
                songId: songId1,
                timestamp: Date.now() + i * 1000
              });
            }

            // Filter by different songId
            const filtered = manager.filterBySong(differentSongId2);

            // Should return empty array
            expect(filtered).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('filterBySong SHALL return correct count of matching replays', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 3, maxLength: 15 }),
          songIdArb,
          (replays, targetSongId) => {
            const manager = createFreshManager();
            // Count how many we'll set to target songId
            let expectedCount = 0;

            // Save replays with various songIds
            for (let i = 0; i < replays.length; i++) {
              const useTarget = i % 3 === 0; // Every third replay uses target
              if (useTarget) expectedCount++;

              manager.saveReplay({
                ...replays[i],
                songId: useTarget ? targetSongId : replays[i].songId + '_other',
                timestamp: Date.now() + i * 1000
              });
            }

            const filtered = manager.filterBySong(targetSongId);
            expect(filtered.length).toBe(expectedCount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('filterBySong SHALL return empty array for non-existent songId', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 1, maxLength: 10 }),
          (replays) => {
            const manager = createFreshManager();
            // Save replays
            for (let i = 0; i < replays.length; i++) {
              manager.saveReplay({
                ...replays[i],
                timestamp: Date.now() + i * 1000
              });
            }

            // Filter by a songId that definitely doesn't exist
            const filtered = manager.filterBySong('definitely_nonexistent_song_id_12345');
            expect(filtered).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('filterBySong SHALL be case-sensitive', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const songId = 'TestSong';
            manager.saveReplay({
              ...replayData,
              songId
            });

            // Exact match should work
            expect(manager.filterBySong('TestSong').length).toBe(1);

            // Different case should not match
            expect(manager.filterBySong('testsong').length).toBe(0);
            expect(manager.filterBySong('TESTSONG').length).toBe(0);
            expect(manager.filterBySong('testSong').length).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('filterBySong SHALL NOT perform partial matching', () => {
      fc.assert(
        fc.property(
          validReplayDataArb,
          (replayData) => {
            const manager = createFreshManager();
            const songId = 'tutorial-song';
            manager.saveReplay({
              ...replayData,
              songId
            });

            // Exact match should work
            expect(manager.filterBySong('tutorial-song').length).toBe(1);

            // Partial matches should not work
            expect(manager.filterBySong('tutorial').length).toBe(0);
            expect(manager.filterBySong('song').length).toBe(0);
            expect(manager.filterBySong('tutorial-').length).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('filtered results SHALL maintain timestamp ordering', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 3, maxLength: 15 }),
          songIdArb,
          (replays, targetSongId) => {
            const manager = createFreshManager();
            // Save replays with target songId at various timestamps
            for (let i = 0; i < replays.length; i++) {
              manager.saveReplay({
                ...replays[i],
                songId: targetSongId,
                timestamp: Date.now() + i * 1000
              });
            }

            const filtered = manager.filterBySong(targetSongId);

            // Results should be sorted by timestamp descending
            for (let i = 1; i < filtered.length; i++) {
              expect(filtered[i - 1].timestamp).toBeGreaterThanOrEqual(filtered[i].timestamp);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('filterBySong SHALL return all replays when all match', () => {
      fc.assert(
        fc.property(
          fc.array(validReplayDataArb, { minLength: 1, maxLength: 10 }),
          songIdArb,
          (replays, targetSongId) => {
            const manager = createFreshManager();
            // Save all replays with same songId
            for (let i = 0; i < replays.length; i++) {
              manager.saveReplay({
                ...replays[i],
                songId: targetSongId,
                timestamp: Date.now() + i * 1000
              });
            }

            const filtered = manager.filterBySong(targetSongId);
            expect(filtered.length).toBe(replays.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

/**
 * @fileoverview Property-based tests for SaveManager Integration.
 * Tests integration of SaveManager with game features.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import SaveManager from '../src/data/SaveManager.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Mock localStorage for testing
const mockStorage = new Map();
const mockLocalStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, value) => mockStorage.set(key, value),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Arbitraries for generating test data
const inputDelayArb = fc.integer({ min: -50, max: 50 });
const inputBufferArb = fc.integer({ min: 0, max: 100 });
const timestampArb = fc.integer({ min: 0, max: 100000 });
const scoreArb = fc.integer({ min: 0, max: 10000000 });
const accuracyArb = fc.float({ min: 0, max: 100, noNaN: true });
const comboArb = fc.integer({ min: 0, max: 10000 });
const songIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s) && s.length > 0);
const difficultyArb = fc.constantFrom('easy', 'normal', 'hard');
const rankArb = fc.constantFrom('S++', 'S+', 'S', 'A', 'B', 'C', 'D', 'F');

// Generate a score entry
const scoreEntryArb = fc.record({
  score: scoreArb,
  rank: rankArb,
  accuracy: accuracyArb,
  maxCombo: comboArb
});

describe('SaveManager Integration Property Tests', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // Save original localStorage and replace with mock
    originalLocalStorage = global.localStorage;
    global.localStorage = mockLocalStorage;
    mockStorage.clear();

    // Reset SaveManager singleton
    SaveManager.resetInstance();
  });

  afterEach(() => {
    // Restore original localStorage
    global.localStorage = originalLocalStorage;
    mockStorage.clear();
    SaveManager.resetInstance();
  });

  /**
   * Property 43: SaveManager Integration
   * SaveManager SHALL correctly integrate with all competitive features:
   * - Input delay compensation
   * - Input buffer window
   * - HUD stats visibility options
   * - Score persistence
   */
  describe('Property 43: SaveManager Integration', () => {
    it('input delay compensation SHALL be clamped to [-50, +50]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 1000 }),
          (value) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            const result = saveManager.setInputDelayCompensation(value);

            // Verify clamping
            const expected = Math.max(-50, Math.min(50, value));
            expect(result).toBe(expected);
            expect(saveManager.getInputDelayCompensation()).toBe(expected);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('input buffer window SHALL be clamped to [0, 100]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 500 }),
          (value) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            const result = saveManager.setInputBufferWindow(value);

            // Verify clamping
            const expected = Math.max(0, Math.min(100, value));
            expect(result).toBe(expected);
            expect(saveManager.getInputBufferWindow()).toBe(expected);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('applyDelayCompensation SHALL correctly adjust timestamps', () => {
      fc.assert(
        fc.property(
          inputDelayArb,
          timestampArb,
          (compensation, timestamp) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            saveManager.setInputDelayCompensation(compensation);

            const adjusted = saveManager.applyDelayCompensation(timestamp);

            // Verify adjustment
            expect(adjusted).toBe(timestamp + compensation);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('HUD stats options SHALL persist correctly', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          (showNPS, showGrade, showComboBreaks, showJudgements) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set HUD options
            saveManager.setOptions({
              showNPS,
              showGrade,
              showComboBreaks,
              showJudgements
            });

            // Reload
            SaveManager.resetInstance();
            const reloadedManager = SaveManager.getInstance();
            reloadedManager.storageAvailable = true;
            reloadedManager.init();

            // Verify persistence
            expect(reloadedManager.getOption('showNPS')).toBe(showNPS);
            expect(reloadedManager.getOption('showGrade')).toBe(showGrade);
            expect(reloadedManager.getOption('showComboBreaks')).toBe(showComboBreaks);
            expect(reloadedManager.getOption('showJudgements')).toBe(showJudgements);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('high scores SHALL only update when score is higher', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreEntryArb,
          scoreEntryArb,
          (songId, difficulty, firstEntry, secondEntry) => {
            // Reset SaveManager for each test iteration
            SaveManager.resetInstance();
            mockStorage.clear();

            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set first score
            const firstResult = saveManager.setHighScore(songId, difficulty, firstEntry);
            expect(firstResult).toBe(true); // First score always saves

            // Set second score
            const secondResult = saveManager.setHighScore(songId, difficulty, secondEntry);

            // Get current high score
            const highScore = saveManager.getHighScore(songId, difficulty);

            // Verify correct score is stored
            if (secondEntry.score > firstEntry.score) {
              expect(secondResult).toBe(true);
              expect(highScore.score).toBe(secondEntry.score);
            } else {
              expect(secondResult).toBe(false);
              expect(highScore.score).toBe(firstEntry.score);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('scores SHALL persist across reloads', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreEntryArb,
          (songId, difficulty, entry) => {
            // Reset SaveManager for each test iteration
            SaveManager.resetInstance();
            mockStorage.clear();

            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set score
            saveManager.setHighScore(songId, difficulty, entry);

            // Reload
            SaveManager.resetInstance();
            const reloadedManager = SaveManager.getInstance();
            reloadedManager.storageAvailable = true;
            reloadedManager.init();

            // Verify persistence
            const loaded = reloadedManager.getHighScore(songId, difficulty);
            expect(loaded).not.toBeNull();
            expect(loaded.score).toBe(entry.score);
            expect(loaded.rank).toBe(entry.rank);
            expect(loaded.maxCombo).toBe(entry.maxCombo);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getAllOptions SHALL return complete options object', () => {
      fc.assert(
        fc.property(
          inputDelayArb,
          inputBufferArb,
          fc.boolean(),
          fc.boolean(),
          (delay, buffer, showNPS, showGrade) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            saveManager.setInputDelayCompensation(delay);
            saveManager.setInputBufferWindow(buffer);
            saveManager.setOption('showNPS', showNPS);
            saveManager.setOption('showGrade', showGrade);

            const allOptions = saveManager.getAllOptions();

            // Verify all competitive options are present
            expect(allOptions).toHaveProperty('inputDelayCompensation', delay);
            expect(allOptions).toHaveProperty('inputBufferWindow', buffer);
            expect(allOptions).toHaveProperty('showNPS', showNPS);
            expect(allOptions).toHaveProperty('showGrade', showGrade);
            expect(allOptions).toHaveProperty('showComboBreaks');
            expect(allOptions).toHaveProperty('showJudgements');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('clearAll SHALL reset all data', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreEntryArb,
          inputDelayArb,
          (songId, difficulty, entry, delay) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set some data
            saveManager.setHighScore(songId, difficulty, entry);
            saveManager.setInputDelayCompensation(delay);

            // Clear all
            saveManager.clearAll();

            // Verify data is cleared
            expect(saveManager.getHighScore(songId, difficulty)).toBeNull();
            expect(saveManager.getInputDelayCompensation()).toBe(0);
            expect(saveManager.getInputBufferWindow()).toBe(50);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('export/import SHALL preserve all data', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          scoreEntryArb,
          inputDelayArb,
          inputBufferArb,
          (songId, difficulty, entry, delay, buffer) => {
            // Reset SaveManager for each test iteration
            SaveManager.resetInstance();
            mockStorage.clear();

            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set data
            saveManager.setHighScore(songId, difficulty, entry);
            saveManager.setInputDelayCompensation(delay);
            saveManager.setInputBufferWindow(buffer);

            // Export
            const exported = saveManager.exportData();

            // Clear and import
            saveManager.clearAll();
            const importResult = saveManager.importData(exported);

            // Verify import succeeded
            expect(importResult).toBe(true);

            // Verify data restored
            const loadedScore = saveManager.getHighScore(songId, difficulty);
            expect(loadedScore).not.toBeNull();
            expect(loadedScore.score).toBe(entry.score);
            expect(saveManager.getInputDelayCompensation()).toBe(delay);
            expect(saveManager.getInputBufferWindow()).toBe(buffer);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getTotalScore SHALL sum all scores correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              songId: songIdArb,
              difficulty: difficultyArb,
              entry: scoreEntryArb
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (scoreData) => {
            // Reset SaveManager for each test iteration
            SaveManager.resetInstance();
            mockStorage.clear();

            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Track expected total (only highest scores per song/difficulty)
            const highestScores = new Map();

            for (const { songId, difficulty, entry } of scoreData) {
              const key = `${songId}:${difficulty}`;
              const existing = highestScores.get(key);

              if (!existing || entry.score > existing) {
                highestScores.set(key, entry.score);
              }

              saveManager.setHighScore(songId, difficulty, entry);
            }

            // Calculate expected total
            let expectedTotal = 0;
            for (const score of highestScores.values()) {
              expectedTotal += score;
            }

            // Verify total
            expect(saveManager.getTotalScore()).toBe(expectedTotal);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

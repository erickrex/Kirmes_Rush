/**
 * @fileoverview Unit tests for SaveManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import SaveManager, { StorageKeys } from '../src/data/SaveManager.js';

describe('SaveManager', () => {
  let saveManager;

  beforeEach(() => {
    SaveManager.resetInstance();
    localStorageMock.clear();
    vi.clearAllMocks();
    saveManager = SaveManager.getInstance();
  });

  afterEach(() => {
    SaveManager.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SaveManager.getInstance();
      const instance2 = SaveManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = SaveManager.getInstance();
      SaveManager.resetInstance();
      const instance2 = SaveManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      const result = saveManager.init();
      expect(result).toBe(true);
      expect(saveManager.loaded).toBe(true);
    });

    it('should not reinitialize if already loaded', () => {
      saveManager.init();
      const result = saveManager.init();
      expect(result).toBe(true);
    });

    it('should check storage availability', () => {
      expect(saveManager.storageAvailable).toBe(true);
    });
  });

  describe('Options', () => {
    beforeEach(() => {
      saveManager.init();
    });

    it('should have default options', () => {
      expect(saveManager.getOption('downscroll')).toBe(false);
      expect(saveManager.getOption('ghostTapping')).toBe(true);
      expect(saveManager.getOption('masterVolume')).toBe(100);
    });

    it('should set and get options', () => {
      saveManager.setOption('downscroll', true);
      expect(saveManager.getOption('downscroll')).toBe(true);
    });

    it('should set multiple options at once', () => {
      saveManager.setOptions({
        downscroll: true,
        scrollSpeed: 2.0
      });
      expect(saveManager.getOption('downscroll')).toBe(true);
      expect(saveManager.getOption('scrollSpeed')).toBe(2.0);
    });

    it('should save options to localStorage', () => {
      saveManager.setOption('downscroll', true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should reset options to defaults', () => {
      saveManager.setOption('downscroll', true);
      saveManager.resetOptions();
      expect(saveManager.getOption('downscroll')).toBe(false);
    });

    it('should get all options', () => {
      const options = saveManager.getAllOptions();
      expect(options).toHaveProperty('downscroll');
      expect(options).toHaveProperty('masterVolume');
    });

    it('should not auto-save when autoSave is false', () => {
      vi.clearAllMocks();
      saveManager.setOption('downscroll', true, false);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Scores', () => {
    beforeEach(() => {
      saveManager.init();
    });

    it('should return null for non-existent score', () => {
      const score = saveManager.getHighScore('test-song', 'normal');
      expect(score).toBeNull();
    });

    it('should set and get high score', () => {
      const scoreEntry = {
        score: 100000,
        rank: 'S',
        accuracy: 95.5,
        maxCombo: 200
      };

      const isNew = saveManager.setHighScore('test-song', 'normal', scoreEntry);
      expect(isNew).toBe(true);

      const retrieved = saveManager.getHighScore('test-song', 'normal');
      expect(retrieved.score).toBe(100000);
      expect(retrieved.rank).toBe('S');
    });

    it('should only save if score is higher', () => {
      saveManager.setHighScore('test-song', 'normal', { score: 100000 });
      const isNew = saveManager.setHighScore('test-song', 'normal', { score: 50000 });
      expect(isNew).toBe(false);

      const retrieved = saveManager.getHighScore('test-song', 'normal');
      expect(retrieved.score).toBe(100000);
    });

    it('should get all scores for a song', () => {
      saveManager.setHighScore('test-song', 'easy', { score: 50000 });
      saveManager.setHighScore('test-song', 'normal', { score: 100000 });
      saveManager.setHighScore('test-song', 'hard', { score: 150000 });

      const scores = saveManager.getSongScores('test-song');
      expect(scores.size).toBe(3);
      expect(scores.get('easy').score).toBe(50000);
    });

    it('should calculate total score', () => {
      saveManager.setHighScore('song1', 'normal', { score: 100000 });
      saveManager.setHighScore('song2', 'normal', { score: 200000 });

      const total = saveManager.getTotalScore();
      expect(total).toBe(300000);
    });

    it('should clear all scores', () => {
      saveManager.setHighScore('test-song', 'normal', { score: 100000 });
      saveManager.clearScores();

      const score = saveManager.getHighScore('test-song', 'normal');
      expect(score).toBeNull();
    });
  });

  describe('Progress', () => {
    beforeEach(() => {
      saveManager.init();
    });

    it('should have default unlocked weeks', () => {
      expect(saveManager.isWeekUnlocked('tutorial')).toBe(true);
      expect(saveManager.isWeekUnlocked('week1')).toBe(true);
      expect(saveManager.isWeekUnlocked('week2')).toBe(false);
    });

    it('should unlock weeks', () => {
      saveManager.unlockWeek('week2');
      expect(saveManager.isWeekUnlocked('week2')).toBe(true);
    });

    it('should not duplicate unlocked weeks', () => {
      saveManager.unlockWeek('week1');
      saveManager.unlockWeek('week1');
      expect(saveManager.progress.unlockedWeeks.filter(w => w === 'week1').length).toBe(1);
    });

    it('should track completed songs', () => {
      expect(saveManager.isSongCompleted('bopeebo')).toBe(false);

      saveManager.completeSong('bopeebo', 'normal');
      expect(saveManager.isSongCompleted('bopeebo', 'normal')).toBe(true);
      expect(saveManager.isSongCompleted('bopeebo')).toBe(true);
    });

    it('should track story progress', () => {
      saveManager.setStoryProgress('week1', { currentSong: 2, completed: false });

      const progress = saveManager.getStoryProgress('week1');
      expect(progress.currentSong).toBe(2);
      expect(progress.completed).toBe(false);
    });

    it('should return default story progress for unknown week', () => {
      const progress = saveManager.getStoryProgress('unknown-week');
      expect(progress.currentSong).toBe(0);
      expect(progress.completed).toBe(false);
    });

    it('should reset progress', () => {
      saveManager.unlockWeek('week5');
      saveManager.completeSong('test', 'hard');
      saveManager.resetProgress();

      expect(saveManager.isWeekUnlocked('week5')).toBe(false);
      expect(saveManager.isSongCompleted('test')).toBe(false);
      // Default weeks should still be unlocked
      expect(saveManager.isWeekUnlocked('tutorial')).toBe(true);
      expect(saveManager.isWeekUnlocked('week1')).toBe(true);
    });
  });

  describe('Import/Export', () => {
    beforeEach(() => {
      saveManager.init();
    });

    it('should export data as JSON', () => {
      saveManager.setOption('downscroll', true);
      saveManager.setHighScore('test', 'normal', { score: 100000 });

      const exported = saveManager.exportData();
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBeDefined();
      expect(parsed.options.downscroll).toBe(true);
      expect(parsed.scores['test:normal'].score).toBe(100000);
    });

    it('should import data from JSON', () => {
      const data = {
        options: { downscroll: true },
        scores: { 'imported:hard': { score: 999999 } },
        progress: { unlockedWeeks: ['week1', 'week2', 'week3'] }
      };

      const result = saveManager.importData(JSON.stringify(data));
      expect(result).toBe(true);
      expect(saveManager.getOption('downscroll')).toBe(true);
      expect(saveManager.getHighScore('imported', 'hard').score).toBe(999999);
      expect(saveManager.isWeekUnlocked('week3')).toBe(true);
    });

    it('should handle invalid import data', () => {
      const result = saveManager.importData('invalid json');
      expect(result).toBe(false);
    });
  });

  describe('Clear All', () => {
    it('should clear all save data', () => {
      saveManager.init();
      saveManager.setOption('downscroll', true);
      saveManager.setHighScore('test', 'normal', { score: 100000 });
      saveManager.unlockWeek('week5');

      saveManager.clearAll();

      expect(saveManager.getOption('downscroll')).toBe(false);
      expect(saveManager.getHighScore('test', 'normal')).toBeNull();
      expect(saveManager.isWeekUnlocked('week5')).toBe(false);
      // Default weeks should still be unlocked after clearAll (reset to defaults)
      expect(saveManager.isWeekUnlocked('tutorial')).toBe(true);
      expect(saveManager.isWeekUnlocked('week1')).toBe(true);
    });
  });

  describe('Storage Keys', () => {
    it('should have correct storage keys', () => {
      expect(StorageKeys.OPTIONS).toBe('fnf-options');
      expect(StorageKeys.SCORES).toBe('fnf-scores');
      expect(StorageKeys.PROGRESS).toBe('fnf-progress');
      expect(StorageKeys.VERSION).toBe('fnf-version');
    });
  });

  describe('Input Delay Compensation', () => {
    beforeEach(() => {
      saveManager.init();
    });

    it('should have default input delay compensation of 0', () => {
      expect(saveManager.getInputDelayCompensation()).toBe(0);
      expect(saveManager.getOption('inputDelayCompensation')).toBe(0);
    });

    it('should set and get input delay compensation', () => {
      saveManager.setInputDelayCompensation(25);
      expect(saveManager.getInputDelayCompensation()).toBe(25);
    });

    it('should clamp positive values to +50', () => {
      const result = saveManager.setInputDelayCompensation(100);
      expect(result).toBe(50);
      expect(saveManager.getInputDelayCompensation()).toBe(50);
    });

    it('should clamp negative values to -50', () => {
      const result = saveManager.setInputDelayCompensation(-100);
      expect(result).toBe(-50);
      expect(saveManager.getInputDelayCompensation()).toBe(-50);
    });

    it('should accept values at boundaries', () => {
      saveManager.setInputDelayCompensation(50);
      expect(saveManager.getInputDelayCompensation()).toBe(50);

      saveManager.setInputDelayCompensation(-50);
      expect(saveManager.getInputDelayCompensation()).toBe(-50);
    });

    it('should accept values within range', () => {
      saveManager.setInputDelayCompensation(25);
      expect(saveManager.getInputDelayCompensation()).toBe(25);

      saveManager.setInputDelayCompensation(-30);
      expect(saveManager.getInputDelayCompensation()).toBe(-30);
    });

    it('should save input delay compensation to localStorage', () => {
      vi.clearAllMocks();
      saveManager.setInputDelayCompensation(15);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should not auto-save when autoSave is false', () => {
      vi.clearAllMocks();
      saveManager.setInputDelayCompensation(15, false);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should apply delay compensation to timestamp (positive)', () => {
      saveManager.setInputDelayCompensation(25);
      const adjusted = saveManager.applyDelayCompensation(1000);
      expect(adjusted).toBe(1025);
    });

    it('should apply delay compensation to timestamp (negative)', () => {
      saveManager.setInputDelayCompensation(-25);
      const adjusted = saveManager.applyDelayCompensation(1000);
      expect(adjusted).toBe(975);
    });

    it('should apply zero delay compensation correctly', () => {
      saveManager.setInputDelayCompensation(0);
      const adjusted = saveManager.applyDelayCompensation(1000);
      expect(adjusted).toBe(1000);
    });

    it('should reset input delay compensation to default', () => {
      saveManager.setInputDelayCompensation(30);
      saveManager.resetOptions();
      expect(saveManager.getInputDelayCompensation()).toBe(0);
    });

    it('should persist input delay compensation across sessions', () => {
      saveManager.setInputDelayCompensation(35);

      // Simulate new session by resetting instance and reloading
      SaveManager.resetInstance();
      const newManager = SaveManager.getInstance();
      newManager.init();

      expect(newManager.getInputDelayCompensation()).toBe(35);
    });
  });
});

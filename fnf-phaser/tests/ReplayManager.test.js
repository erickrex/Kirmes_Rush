/**
 * @fileoverview Unit tests for the ReplayManager class.
 * Tests replay storage and retrieval functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReplayManager } from '../src/replay/ReplaySystem.js';

/**
 * Helper to create valid replay data for testing
 * @param {Object} overrides - Properties to override
 * @returns {Object} Valid replay data
 */
function createValidReplayData(overrides = {}) {
  return {
    version: '1.0.0',
    songId: 'tutorial',
    difficulty: 'normal',
    timestamp: Date.now(),
    score: 100000,
    tallies: {
      sick: 45,
      good: 10,
      bad: 2,
      shit: 0,
      missed: 3,
      combo: 0,
      maxCombo: 42,
      totalNotesHit: 57,
      totalNotes: 60
    },
    seed: 0.123456789,
    inputs: [
      { time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' },
      { time: 1050, type: 'release', direction: 0, keyCode: 'KeyA' }
    ],
    metadata: {
      playerName: 'Player',
      gameVersion: '1.0.0',
      accuracy: 95.0
    },
    ...overrides
  };
}

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

describe('ReplayManager', () => {
  let manager;
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockStorage);
    manager = new ReplayManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should initialize with empty replay index', () => {
      expect(manager.replayIndex).toEqual([]);
    });

    it('should have STORAGE_KEY static property', () => {
      expect(ReplayManager.STORAGE_KEY).toBe('fnf-replays');
    });

    it('should have INDEX_KEY static property', () => {
      expect(ReplayManager.INDEX_KEY).toBe('fnf-replay-idx');
    });

    it('should have MAX_REPLAYS static property set to 50', () => {
      expect(ReplayManager.MAX_REPLAYS).toBe(50);
    });

    it('should load existing index from localStorage on construction', () => {
      const existingIndex = [
        { id: 'replay_1', songId: 'tutorial', songName: 'tutorial', difficulty: 'normal', score: 100000, accuracy: 95, timestamp: 1000 }
      ];
      mockStorage.setItem(ReplayManager.INDEX_KEY, JSON.stringify(existingIndex));

      const newManager = new ReplayManager();
      expect(newManager.replayIndex).toEqual(existingIndex);
    });

    it('should handle corrupted index data gracefully', () => {
      mockStorage.setItem(ReplayManager.INDEX_KEY, 'invalid json{{{');

      const newManager = new ReplayManager();
      expect(newManager.replayIndex).toEqual([]);
    });
  });

  describe('saveReplay - Save replay with unique ID (Requirement 3.1, 3.2)', () => {
    it('should return a unique replay ID', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('replay_')).toBe(true);
    });

    it('should generate different IDs for different replays', () => {
      const replayData1 = createValidReplayData({ timestamp: Date.now() });
      const replayData2 = createValidReplayData({ timestamp: Date.now() + 1 });

      const id1 = manager.saveReplay(replayData1);
      const id2 = manager.saveReplay(replayData2);

      expect(id1).not.toBe(id2);
    });

    it('should add replay to index', () => {
      const replayData = createValidReplayData();
      manager.saveReplay(replayData);

      expect(manager.replayIndex.length).toBe(1);
    });

    it('should store replay data in localStorage', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      const storageKey = `${ReplayManager.STORAGE_KEY}_${id}`;
      expect(mockStorage.setItem).toHaveBeenCalledWith(storageKey, JSON.stringify(replayData));
    });

    it('should save index to localStorage', () => {
      const replayData = createValidReplayData();
      manager.saveReplay(replayData);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        ReplayManager.INDEX_KEY,
        expect.any(String)
      );
    });

    it('should create index entry with correct songId', () => {
      const replayData = createValidReplayData({ songId: 'test-song' });
      manager.saveReplay(replayData);

      expect(manager.replayIndex[0].songId).toBe('test-song');
    });

    it('should create index entry with correct difficulty', () => {
      const replayData = createValidReplayData({ difficulty: 'hard' });
      manager.saveReplay(replayData);

      expect(manager.replayIndex[0].difficulty).toBe('hard');
    });

    it('should create index entry with correct score', () => {
      const replayData = createValidReplayData({ score: 250000 });
      manager.saveReplay(replayData);

      expect(manager.replayIndex[0].score).toBe(250000);
    });

    it('should create index entry with accuracy from metadata', () => {
      const replayData = createValidReplayData();
      replayData.metadata.accuracy = 98.5;
      manager.saveReplay(replayData);

      expect(manager.replayIndex[0].accuracy).toBe(98.5);
    });

    it('should create index entry with timestamp', () => {
      const timestamp = Date.now();
      const replayData = createValidReplayData({ timestamp });
      manager.saveReplay(replayData);

      expect(manager.replayIndex[0].timestamp).toBe(timestamp);
    });

    it('should add new replays at the beginning of the index (newest first)', () => {
      const replayData1 = createValidReplayData({ songId: 'song1', timestamp: 1000 });
      const replayData2 = createValidReplayData({ songId: 'song2', timestamp: 2000 });

      manager.saveReplay(replayData1);
      manager.saveReplay(replayData2);

      expect(manager.replayIndex[0].songId).toBe('song2');
      expect(manager.replayIndex[1].songId).toBe('song1');
    });

    it('should handle missing accuracy in metadata', () => {
      const replayData = createValidReplayData();
      delete replayData.metadata.accuracy;
      manager.saveReplay(replayData);

      expect(manager.replayIndex[0].accuracy).toBe(0);
    });

    it('should handle missing metadata', () => {
      const replayData = createValidReplayData();
      delete replayData.metadata;
      manager.saveReplay(replayData);

      expect(manager.replayIndex[0].accuracy).toBe(0);
    });
  });

  describe('saveReplay - MAX_REPLAYS limit enforcement', () => {
    it('should enforce MAX_REPLAYS limit', () => {
      // Fill up to max
      for (let i = 0; i < ReplayManager.MAX_REPLAYS; i++) {
        const replayData = createValidReplayData({ timestamp: i });
        manager.saveReplay(replayData);
      }

      expect(manager.replayIndex.length).toBe(ReplayManager.MAX_REPLAYS);

      // Add one more
      const newReplay = createValidReplayData({ timestamp: 999999 });
      manager.saveReplay(newReplay);

      expect(manager.replayIndex.length).toBe(ReplayManager.MAX_REPLAYS);
    });

    it('should remove oldest replay when at capacity', () => {
      // Fill up to max
      for (let i = 0; i < ReplayManager.MAX_REPLAYS; i++) {
        const replayData = createValidReplayData({ songId: `song${i}`, timestamp: i });
        manager.saveReplay(replayData);
      }

      // The oldest (song0) should be at the end
      const oldestBefore = manager.replayIndex[manager.replayIndex.length - 1].songId;
      expect(oldestBefore).toBe('song0');

      // Add one more
      const newReplay = createValidReplayData({ songId: 'newSong', timestamp: 999999 });
      manager.saveReplay(newReplay);

      // song0 should be removed
      const songIds = manager.replayIndex.map((r) => r.songId);
      expect(songIds).not.toContain('song0');
      expect(songIds).toContain('newSong');
    });

    it('should delete oldest replay data from storage when removing', () => {
      // Fill up to max
      const ids = [];
      for (let i = 0; i < ReplayManager.MAX_REPLAYS; i++) {
        const replayData = createValidReplayData({ timestamp: i });
        ids.push(manager.saveReplay(replayData));
      }

      const oldestId = ids[0];

      // Add one more
      const newReplay = createValidReplayData({ timestamp: 999999 });
      manager.saveReplay(newReplay);

      // Oldest should be removed from storage
      expect(mockStorage.removeItem).toHaveBeenCalledWith(`${ReplayManager.STORAGE_KEY}_${oldestId}`);
    });
  });

  describe('loadReplay - Retrieve replay by ID', () => {
    it('should return replay data for valid ID', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      const loaded = manager.loadReplay(id);
      expect(loaded).toEqual(replayData);
    });

    it('should return null for non-existent ID', () => {
      const loaded = manager.loadReplay('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should return null for invalid ID format', () => {
      const loaded = manager.loadReplay('');
      expect(loaded).toBeNull();
    });

    it('should handle corrupted replay data gracefully', () => {
      const id = 'replay_corrupted';
      mockStorage.setItem(`${ReplayManager.STORAGE_KEY}_${id}`, 'invalid json{{{');

      const loaded = manager.loadReplay(id);
      expect(loaded).toBeNull();
    });

    it('should return correct replay when multiple exist', () => {
      const replayData1 = createValidReplayData({ songId: 'song1' });
      const replayData2 = createValidReplayData({ songId: 'song2' });
      const replayData3 = createValidReplayData({ songId: 'song3' });

      manager.saveReplay(replayData1);
      const id2 = manager.saveReplay(replayData2);
      manager.saveReplay(replayData3);

      const loaded = manager.loadReplay(id2);
      expect(loaded.songId).toBe('song2');
    });
  });

  describe('deleteReplay - Remove replay (Requirement 3.4)', () => {
    it('should return true when deletion succeeds', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      const result = manager.deleteReplay(id);
      expect(result).toBe(true);
    });

    it('should return false when replay does not exist', () => {
      const result = manager.deleteReplay('non-existent-id');
      expect(result).toBe(false);
    });

    it('should remove replay from index', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      expect(manager.replayIndex.length).toBe(1);

      manager.deleteReplay(id);
      expect(manager.replayIndex.length).toBe(0);
    });

    it('should remove replay data from localStorage', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      manager.deleteReplay(id);

      expect(mockStorage.removeItem).toHaveBeenCalledWith(`${ReplayManager.STORAGE_KEY}_${id}`);
    });

    it('should update index in localStorage after deletion', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      // Clear mock to track new calls
      mockStorage.setItem.mockClear();

      manager.deleteReplay(id);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        ReplayManager.INDEX_KEY,
        JSON.stringify([])
      );
    });

    it('should make replay unavailable via loadReplay after deletion', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      manager.deleteReplay(id);

      const loaded = manager.loadReplay(id);
      expect(loaded).toBeNull();
    });

    it('should not affect other replays when deleting one', () => {
      const replayData1 = createValidReplayData({ songId: 'song1' });
      const replayData2 = createValidReplayData({ songId: 'song2' });
      const replayData3 = createValidReplayData({ songId: 'song3' });

      const id1 = manager.saveReplay(replayData1);
      const id2 = manager.saveReplay(replayData2);
      const id3 = manager.saveReplay(replayData3);

      manager.deleteReplay(id2);

      expect(manager.loadReplay(id1)).not.toBeNull();
      expect(manager.loadReplay(id2)).toBeNull();
      expect(manager.loadReplay(id3)).not.toBeNull();
    });
  });

  describe('getReplayList - List all replays sorted by date (Requirement 3.1)', () => {
    it('should return empty array when no replays exist', () => {
      const list = manager.getReplayList();
      expect(list).toEqual([]);
    });

    it('should return all replays', () => {
      const replayData1 = createValidReplayData({ timestamp: 1000 });
      const replayData2 = createValidReplayData({ timestamp: 2000 });
      const replayData3 = createValidReplayData({ timestamp: 3000 });

      manager.saveReplay(replayData1);
      manager.saveReplay(replayData2);
      manager.saveReplay(replayData3);

      const list = manager.getReplayList();
      expect(list.length).toBe(3);
    });

    it('should return replays sorted by timestamp descending (newest first)', () => {
      const replayData1 = createValidReplayData({ songId: 'oldest', timestamp: 1000 });
      const replayData2 = createValidReplayData({ songId: 'middle', timestamp: 2000 });
      const replayData3 = createValidReplayData({ songId: 'newest', timestamp: 3000 });

      manager.saveReplay(replayData1);
      manager.saveReplay(replayData2);
      manager.saveReplay(replayData3);

      const list = manager.getReplayList();
      expect(list[0].songId).toBe('newest');
      expect(list[1].songId).toBe('middle');
      expect(list[2].songId).toBe('oldest');
    });

    it('should return a copy of the index (not the original)', () => {
      const replayData = createValidReplayData();
      manager.saveReplay(replayData);

      const list = manager.getReplayList();
      list.push({ id: 'fake', songId: 'fake' });

      expect(manager.replayIndex.length).toBe(1);
    });

    it('should include all required fields in list entries (Requirement 3.2)', () => {
      const replayData = createValidReplayData({
        songId: 'test-song',
        difficulty: 'hard',
        score: 150000,
        timestamp: 1234567890
      });
      replayData.metadata.accuracy = 97.5;
      manager.saveReplay(replayData);

      const list = manager.getReplayList();
      const entry = list[0];

      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('songId', 'test-song');
      expect(entry).toHaveProperty('songName');
      expect(entry).toHaveProperty('difficulty', 'hard');
      expect(entry).toHaveProperty('score', 150000);
      expect(entry).toHaveProperty('accuracy', 97.5);
      expect(entry).toHaveProperty('timestamp', 1234567890);
    });
  });

  describe('filterBySong - Filter replays by song (Requirement 3.5)', () => {
    beforeEach(() => {
      const replay1 = createValidReplayData({ songId: 'tutorial', timestamp: 1000 });
      const replay2 = createValidReplayData({ songId: 'bopeebo', timestamp: 2000 });
      const replay3 = createValidReplayData({ songId: 'tutorial', timestamp: 3000 });
      const replay4 = createValidReplayData({ songId: 'fresh', timestamp: 4000 });
      const replay5 = createValidReplayData({ songId: 'tutorial', timestamp: 5000 });

      manager.saveReplay(replay1);
      manager.saveReplay(replay2);
      manager.saveReplay(replay3);
      manager.saveReplay(replay4);
      manager.saveReplay(replay5);
    });

    it('should return only replays matching the songId', () => {
      const filtered = manager.filterBySong('tutorial');

      expect(filtered.length).toBe(3);
      filtered.forEach((entry) => {
        expect(entry.songId).toBe('tutorial');
      });
    });

    it('should return empty array when no replays match', () => {
      const filtered = manager.filterBySong('non-existent-song');
      expect(filtered).toEqual([]);
    });

    it('should return filtered results sorted by timestamp descending', () => {
      const filtered = manager.filterBySong('tutorial');

      expect(filtered[0].timestamp).toBe(5000);
      expect(filtered[1].timestamp).toBe(3000);
      expect(filtered[2].timestamp).toBe(1000);
    });

    it('should perform exact match on songId', () => {
      const filtered = manager.filterBySong('tutor'); // Partial match
      expect(filtered).toEqual([]);
    });

    it('should be case-sensitive', () => {
      const filtered = manager.filterBySong('Tutorial'); // Different case
      expect(filtered).toEqual([]);
    });

    it('should return single replay when only one matches', () => {
      const filtered = manager.filterBySong('fresh');
      expect(filtered.length).toBe(1);
      expect(filtered[0].songId).toBe('fresh');
    });
  });

  describe('getReplayCount', () => {
    it('should return 0 when no replays exist', () => {
      expect(manager.getReplayCount()).toBe(0);
    });

    it('should return correct count', () => {
      manager.saveReplay(createValidReplayData());
      manager.saveReplay(createValidReplayData());
      manager.saveReplay(createValidReplayData());

      expect(manager.getReplayCount()).toBe(3);
    });

    it('should update after deletion', () => {
      const id = manager.saveReplay(createValidReplayData());
      manager.saveReplay(createValidReplayData());

      expect(manager.getReplayCount()).toBe(2);

      manager.deleteReplay(id);
      expect(manager.getReplayCount()).toBe(1);
    });
  });

  describe('isAtCapacity', () => {
    it('should return false when below capacity', () => {
      manager.saveReplay(createValidReplayData());
      expect(manager.isAtCapacity()).toBe(false);
    });

    it('should return true when at capacity', () => {
      for (let i = 0; i < ReplayManager.MAX_REPLAYS; i++) {
        manager.saveReplay(createValidReplayData({ timestamp: i }));
      }

      expect(manager.isAtCapacity()).toBe(true);
    });

    it('should return false after deletion from capacity', () => {
      const ids = [];
      for (let i = 0; i < ReplayManager.MAX_REPLAYS; i++) {
        ids.push(manager.saveReplay(createValidReplayData({ timestamp: i })));
      }

      expect(manager.isAtCapacity()).toBe(true);

      manager.deleteReplay(ids[0]);
      expect(manager.isAtCapacity()).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should remove all replays from index', () => {
      manager.saveReplay(createValidReplayData());
      manager.saveReplay(createValidReplayData());
      manager.saveReplay(createValidReplayData());

      manager.clearAll();

      expect(manager.replayIndex).toEqual([]);
    });

    it('should remove all replay data from storage', () => {
      const id1 = manager.saveReplay(createValidReplayData());
      const id2 = manager.saveReplay(createValidReplayData());

      manager.clearAll();

      expect(mockStorage.removeItem).toHaveBeenCalledWith(`${ReplayManager.STORAGE_KEY}_${id1}`);
      expect(mockStorage.removeItem).toHaveBeenCalledWith(`${ReplayManager.STORAGE_KEY}_${id2}`);
    });

    it('should update index in storage', () => {
      manager.saveReplay(createValidReplayData());

      mockStorage.setItem.mockClear();
      manager.clearAll();

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        ReplayManager.INDEX_KEY,
        JSON.stringify([])
      );
    });

    it('should handle clearing empty manager', () => {
      expect(() => manager.clearAll()).not.toThrow();
      expect(manager.replayIndex).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle replay with very long songId', () => {
      const longSongId = 'a'.repeat(1000);
      const replayData = createValidReplayData({ songId: longSongId });
      const id = manager.saveReplay(replayData);

      const loaded = manager.loadReplay(id);
      expect(loaded.songId).toBe(longSongId);
    });

    it('should handle replay with special characters in songId', () => {
      const specialSongId = 'song-with_special.chars!@#$%';
      const replayData = createValidReplayData({ songId: specialSongId });
      const id = manager.saveReplay(replayData);

      const loaded = manager.loadReplay(id);
      expect(loaded.songId).toBe(specialSongId);
    });

    it('should handle replay with very large score', () => {
      const replayData = createValidReplayData({ score: Number.MAX_SAFE_INTEGER });
      const id = manager.saveReplay(replayData);

      const loaded = manager.loadReplay(id);
      expect(loaded.score).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle replay with zero score', () => {
      const replayData = createValidReplayData({ score: 0 });
      const id = manager.saveReplay(replayData);

      const loaded = manager.loadReplay(id);
      expect(loaded.score).toBe(0);
    });

    it('should handle replay with negative timestamp', () => {
      const replayData = createValidReplayData({ timestamp: -1000 });
      const id = manager.saveReplay(replayData);

      const list = manager.getReplayList();
      expect(list[0].timestamp).toBe(-1000);
    });

    it('should handle rapid save/delete operations', () => {
      const ids = [];
      for (let i = 0; i < 10; i++) {
        ids.push(manager.saveReplay(createValidReplayData({ timestamp: i })));
      }

      // Delete every other one
      for (let i = 0; i < ids.length; i += 2) {
        manager.deleteReplay(ids[i]);
      }

      expect(manager.getReplayCount()).toBe(5);
    });

    it('should handle concurrent-like operations', () => {
      // Simulate rapid operations
      const id1 = manager.saveReplay(createValidReplayData({ songId: 'song1' }));
      const id2 = manager.saveReplay(createValidReplayData({ songId: 'song2' }));
      manager.deleteReplay(id1);
      const id3 = manager.saveReplay(createValidReplayData({ songId: 'song3' }));
      manager.deleteReplay(id2);
      const id4 = manager.saveReplay(createValidReplayData({ songId: 'song4' }));

      expect(manager.getReplayCount()).toBe(2);
      expect(manager.loadReplay(id3)).not.toBeNull();
      expect(manager.loadReplay(id4)).not.toBeNull();
    });

    it('should handle empty inputs array in replay', () => {
      const replayData = createValidReplayData({ inputs: [] });
      const id = manager.saveReplay(replayData);

      const loaded = manager.loadReplay(id);
      expect(loaded.inputs).toEqual([]);
    });

    it('should handle very large inputs array', () => {
      const inputs = [];
      for (let i = 0; i < 10000; i++) {
        inputs.push({ time: i * 10, type: 'press', direction: i % 4, keyCode: 'KeyA' });
      }
      const replayData = createValidReplayData({ inputs });
      const id = manager.saveReplay(replayData);

      const loaded = manager.loadReplay(id);
      expect(loaded.inputs.length).toBe(10000);
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage.setItem throwing error', () => {
      const replayData = createValidReplayData();

      // Make setItem throw on replay data save (not index save)
      let callCount = 0;
      mockStorage.setItem.mockImplementation((key, value) => {
        callCount++;
        if (callCount > 1) {
          // First call is index, second is replay data
          throw new Error('Storage quota exceeded');
        }
      });

      expect(() => manager.saveReplay(replayData)).toThrow('Storage quota exceeded');
      // Index should be rolled back
      expect(manager.replayIndex.length).toBe(0);
    });

    it('should handle localStorage.getItem returning null', () => {
      mockStorage.getItem.mockReturnValue(null);

      const loaded = manager.loadReplay('some-id');
      expect(loaded).toBeNull();
    });

    it('should handle localStorage.removeItem throwing error', () => {
      const replayData = createValidReplayData();
      const id = manager.saveReplay(replayData);

      mockStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw, just log error
      expect(() => manager.deleteReplay(id)).not.toThrow();
    });
  });
});

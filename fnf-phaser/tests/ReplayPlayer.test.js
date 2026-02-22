/**
 * @fileoverview Unit tests for the ReplayPlayer class.
 * Tests replay playback functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import ReplayPlayer from '../src/replay/ReplayPlayer.js';

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
      { time: 1050, type: 'release', direction: 0, keyCode: 'KeyA' },
      { time: 2000, type: 'press', direction: 1, keyCode: 'KeyS' },
      { time: 2100, type: 'release', direction: 1, keyCode: 'KeyS' }
    ],
    metadata: {
      playerName: 'Player',
      gameVersion: '1.0.0',
      accuracy: 95.0
    },
    ...overrides
  };
}

describe('ReplayPlayer', () => {
  let player;

  beforeEach(() => {
    player = new ReplayPlayer();
  });

  describe('constructor', () => {
    it('should start with replayData set to null', () => {
      expect(player.replayData).toBeNull();
    });

    it('should start with inputIndex set to 0', () => {
      expect(player.inputIndex).toBe(0);
    });

    it('should start with playing set to false', () => {
      expect(player.playing).toBe(false);
    });

    it('should have SUPPORTED_VERSION static property', () => {
      expect(ReplayPlayer.SUPPORTED_VERSION).toBe('1.0.0');
    });
  });

  describe('load - Replay validation and loading (Requirement 2.1)', () => {
    it('should return true for valid replay data', () => {
      const replayData = createValidReplayData();
      const result = player.load(replayData);
      expect(result).toBe(true);
    });

    it('should store replay data when load succeeds', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      expect(player.replayData).toBe(replayData);
    });

    it('should reset inputIndex to 0 when loading', () => {
      const replayData = createValidReplayData();
      player.inputIndex = 5;
      player.load(replayData);
      expect(player.inputIndex).toBe(0);
    });

    it('should set playing to false when loading', () => {
      const replayData = createValidReplayData();
      player.playing = true;
      player.load(replayData);
      expect(player.playing).toBe(false);
    });

    it('should return false when replayData is null', () => {
      const result = player.load(null);
      expect(result).toBe(false);
    });

    it('should return false when replayData is undefined', () => {
      const result = player.load(undefined);
      expect(result).toBe(false);
    });

    it('should return false for unsupported version', () => {
      const replayData = createValidReplayData({ version: '2.0.0' });
      const result = player.load(replayData);
      expect(result).toBe(false);
    });

    it('should not store replay data when version is unsupported', () => {
      const replayData = createValidReplayData({ version: '2.0.0' });
      player.load(replayData);
      expect(player.replayData).toBeNull();
    });

    it('should return false when songId is missing', () => {
      const replayData = createValidReplayData();
      delete replayData.songId;
      const result = player.load(replayData);
      expect(result).toBe(false);
    });

    it('should return false when songId is empty', () => {
      const replayData = createValidReplayData({ songId: '' });
      const result = player.load(replayData);
      expect(result).toBe(false);
    });

    it('should return false when inputs array is missing', () => {
      const replayData = createValidReplayData();
      delete replayData.inputs;
      const result = player.load(replayData);
      expect(result).toBe(false);
    });

    it('should accept replay with empty inputs array', () => {
      const replayData = createValidReplayData({ inputs: [] });
      const result = player.load(replayData);
      expect(result).toBe(true);
    });

    it('should allow loading a new replay after previous load', () => {
      const replayData1 = createValidReplayData({ songId: 'song1' });
      const replayData2 = createValidReplayData({ songId: 'song2' });

      player.load(replayData1);
      player.load(replayData2);

      expect(player.replayData.songId).toBe('song2');
    });
  });

  describe('start - Begin playback (Requirement 2.2)', () => {
    it('should set playing to true when replay is loaded', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      expect(player.playing).toBe(true);
    });

    it('should reset inputIndex to 0 when starting', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.inputIndex = 3;
      player.start();
      expect(player.inputIndex).toBe(0);
    });

    it('should not set playing to true when no replay is loaded', () => {
      player.start();
      expect(player.playing).toBe(false);
    });

    it('should allow restarting playback', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.getInputsForPosition(5000); // Advance through some inputs
      player.start(); // Restart
      expect(player.inputIndex).toBe(0);
      expect(player.playing).toBe(true);
    });
  });

  describe('getInputsForPosition - Return inputs at song position (Requirement 2.2)', () => {
    beforeEach(() => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 1050, type: 'release', direction: 0, keyCode: 'KeyA' },
          { time: 2000, type: 'press', direction: 1, keyCode: 'KeyS' },
          { time: 2100, type: 'release', direction: 1, keyCode: 'KeyS' },
          { time: 3000, type: 'press', direction: 2, keyCode: 'KeyK' }
        ]
      });
      player.load(replayData);
      player.start();
    });

    it('should return empty array when not playing', () => {
      player.stop();
      const inputs = player.getInputsForPosition(5000);
      expect(inputs).toEqual([]);
    });

    it('should return empty array when no replay is loaded', () => {
      const newPlayer = new ReplayPlayer();
      const inputs = newPlayer.getInputsForPosition(5000);
      expect(inputs).toEqual([]);
    });

    it('should return empty array when position is before first input', () => {
      const inputs = player.getInputsForPosition(500);
      expect(inputs).toEqual([]);
    });

    it('should return inputs up to current position', () => {
      const inputs = player.getInputsForPosition(1000);
      expect(inputs.length).toBe(1);
      expect(inputs[0].time).toBe(1000);
    });

    it('should return multiple inputs when position covers multiple', () => {
      const inputs = player.getInputsForPosition(2000);
      expect(inputs.length).toBe(3);
      expect(inputs[0].time).toBe(1000);
      expect(inputs[1].time).toBe(1050);
      expect(inputs[2].time).toBe(2000);
    });

    it('should not return same input twice on subsequent calls', () => {
      const inputs1 = player.getInputsForPosition(1000);
      const inputs2 = player.getInputsForPosition(1000);

      expect(inputs1.length).toBe(1);
      expect(inputs2.length).toBe(0);
    });

    it('should return new inputs on subsequent calls with later position', () => {
      const inputs1 = player.getInputsForPosition(1000);
      const inputs2 = player.getInputsForPosition(2000);

      expect(inputs1.length).toBe(1);
      expect(inputs2.length).toBe(2); // 1050 and 2000
    });

    it('should return all remaining inputs when position is past all inputs', () => {
      const inputs = player.getInputsForPosition(10000);
      expect(inputs.length).toBe(5);
    });

    it('should return inputs with correct structure', () => {
      const inputs = player.getInputsForPosition(1000);
      expect(inputs[0]).toHaveProperty('time');
      expect(inputs[0]).toHaveProperty('type');
      expect(inputs[0]).toHaveProperty('direction');
      expect(inputs[0]).toHaveProperty('keyCode');
    });

    it('should handle exact timestamp matches', () => {
      const inputs = player.getInputsForPosition(1050);
      expect(inputs.length).toBe(2);
      expect(inputs[1].time).toBe(1050);
    });

    it('should handle position between inputs', () => {
      const inputs = player.getInputsForPosition(1500);
      expect(inputs.length).toBe(2); // 1000 and 1050
    });
  });

  describe('isComplete - Check if all inputs consumed (Requirement 2.4)', () => {
    it('should return true when no replay is loaded', () => {
      expect(player.isComplete()).toBe(true);
    });

    it('should return true when replay has empty inputs', () => {
      const replayData = createValidReplayData({ inputs: [] });
      player.load(replayData);
      player.start();
      expect(player.isComplete()).toBe(true);
    });

    it('should return false when inputs remain', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      expect(player.isComplete()).toBe(false);
    });

    it('should return false when some inputs consumed but not all', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.getInputsForPosition(1000);
      expect(player.isComplete()).toBe(false);
    });

    it('should return true when all inputs consumed', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.getInputsForPosition(10000); // Past all inputs
      expect(player.isComplete()).toBe(true);
    });

    it('should return correct status after restart', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.getInputsForPosition(10000);
      expect(player.isComplete()).toBe(true);

      player.start(); // Restart
      expect(player.isComplete()).toBe(false);
    });
  });

  describe('stop - End playback', () => {
    it('should set playing to false', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.stop();
      expect(player.playing).toBe(false);
    });

    it('should not affect inputIndex', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.getInputsForPosition(2000);
      const indexBeforeStop = player.inputIndex;
      player.stop();
      expect(player.inputIndex).toBe(indexBeforeStop);
    });

    it('should not affect replayData', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.stop();
      expect(player.replayData).toBe(replayData);
    });

    it('should prevent getInputsForPosition from returning inputs', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.stop();
      const inputs = player.getInputsForPosition(10000);
      expect(inputs).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should set replayData to null', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.reset();
      expect(player.replayData).toBeNull();
    });

    it('should set inputIndex to 0', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.getInputsForPosition(2000);
      player.reset();
      expect(player.inputIndex).toBe(0);
    });

    it('should set playing to false', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.reset();
      expect(player.playing).toBe(false);
    });
  });

  describe('isPlaying', () => {
    it('should return false when not playing', () => {
      expect(player.isPlaying()).toBe(false);
    });

    it('should return true when playing', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      expect(player.isPlaying()).toBe(true);
    });

    it('should return false after stop', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.stop();
      expect(player.isPlaying()).toBe(false);
    });
  });

  describe('getSongId', () => {
    it('should return null when no replay is loaded', () => {
      expect(player.getSongId()).toBeNull();
    });

    it('should return songId when replay is loaded', () => {
      const replayData = createValidReplayData({ songId: 'test-song' });
      player.load(replayData);
      expect(player.getSongId()).toBe('test-song');
    });
  });

  describe('getDifficulty', () => {
    it('should return null when no replay is loaded', () => {
      expect(player.getDifficulty()).toBeNull();
    });

    it('should return difficulty when replay is loaded', () => {
      const replayData = createValidReplayData({ difficulty: 'hard' });
      player.load(replayData);
      expect(player.getDifficulty()).toBe('hard');
    });
  });

  describe('getOriginalScore', () => {
    it('should return 0 when no replay is loaded', () => {
      expect(player.getOriginalScore()).toBe(0);
    });

    it('should return score when replay is loaded', () => {
      const replayData = createValidReplayData({ score: 250000 });
      player.load(replayData);
      expect(player.getOriginalScore()).toBe(250000);
    });
  });

  describe('getTotalInputs', () => {
    it('should return 0 when no replay is loaded', () => {
      expect(player.getTotalInputs()).toBe(0);
    });

    it('should return total input count when replay is loaded', () => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 1050, type: 'release', direction: 0, keyCode: 'KeyA' },
          { time: 2000, type: 'press', direction: 1, keyCode: 'KeyS' }
        ]
      });
      player.load(replayData);
      expect(player.getTotalInputs()).toBe(3);
    });
  });

  describe('getRemainingInputs', () => {
    it('should return 0 when no replay is loaded', () => {
      expect(player.getRemainingInputs()).toBe(0);
    });

    it('should return total inputs when playback not started', () => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 2000, type: 'press', direction: 1, keyCode: 'KeyS' },
          { time: 3000, type: 'press', direction: 2, keyCode: 'KeyK' }
        ]
      });
      player.load(replayData);
      expect(player.getRemainingInputs()).toBe(3);
    });

    it('should return remaining inputs during playback', () => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 2000, type: 'press', direction: 1, keyCode: 'KeyS' },
          { time: 3000, type: 'press', direction: 2, keyCode: 'KeyK' }
        ]
      });
      player.load(replayData);
      player.start();
      player.getInputsForPosition(1500);
      expect(player.getRemainingInputs()).toBe(2);
    });

    it('should return 0 when all inputs consumed', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.getInputsForPosition(10000);
      expect(player.getRemainingInputs()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle replay with single input', () => {
      const replayData = createValidReplayData({
        inputs: [{ time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' }]
      });
      player.load(replayData);
      player.start();

      const inputs = player.getInputsForPosition(1000);
      expect(inputs.length).toBe(1);
      expect(player.isComplete()).toBe(true);
    });

    it('should handle inputs with same timestamp', () => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 1000, type: 'press', direction: 1, keyCode: 'KeyS' },
          { time: 1000, type: 'press', direction: 2, keyCode: 'KeyK' }
        ]
      });
      player.load(replayData);
      player.start();

      const inputs = player.getInputsForPosition(1000);
      expect(inputs.length).toBe(3);
    });

    it('should handle very large timestamps', () => {
      const replayData = createValidReplayData({
        inputs: [{ time: 999999999, type: 'press', direction: 0, keyCode: 'KeyA' }]
      });
      player.load(replayData);
      player.start();

      const inputs1 = player.getInputsForPosition(500000000);
      expect(inputs1.length).toBe(0);

      const inputs2 = player.getInputsForPosition(999999999);
      expect(inputs2.length).toBe(1);
    });

    it('should handle sub-millisecond timestamps', () => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 1000.123, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 1000.456, type: 'press', direction: 1, keyCode: 'KeyS' }
        ]
      });
      player.load(replayData);
      player.start();

      const inputs1 = player.getInputsForPosition(1000.2);
      expect(inputs1.length).toBe(1);

      const inputs2 = player.getInputsForPosition(1000.5);
      expect(inputs2.length).toBe(1);
    });

    it('should handle loading after playback started', () => {
      const replayData1 = createValidReplayData({ songId: 'song1' });
      const replayData2 = createValidReplayData({ songId: 'song2' });

      player.load(replayData1);
      player.start();
      player.getInputsForPosition(2000);

      player.load(replayData2);
      expect(player.playing).toBe(false);
      expect(player.inputIndex).toBe(0);
      expect(player.getSongId()).toBe('song2');
    });

    it('should handle calling start multiple times', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.start();
      player.start();
      expect(player.playing).toBe(true);
      expect(player.inputIndex).toBe(0);
    });

    it('should handle calling stop multiple times', () => {
      const replayData = createValidReplayData();
      player.load(replayData);
      player.start();
      player.stop();
      player.stop();
      player.stop();
      expect(player.playing).toBe(false);
    });

    it('should handle calling getInputsForPosition with decreasing positions', () => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 1000, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 2000, type: 'press', direction: 1, keyCode: 'KeyS' },
          { time: 3000, type: 'press', direction: 2, keyCode: 'KeyK' }
        ]
      });
      player.load(replayData);
      player.start();

      const inputs1 = player.getInputsForPosition(2500);
      expect(inputs1.length).toBe(2);

      // Calling with earlier position should return empty (inputs already consumed)
      const inputs2 = player.getInputsForPosition(1500);
      expect(inputs2.length).toBe(0);
    });

    it('should handle replay with zero timestamp inputs', () => {
      const replayData = createValidReplayData({
        inputs: [
          { time: 0, type: 'press', direction: 0, keyCode: 'KeyA' },
          { time: 100, type: 'release', direction: 0, keyCode: 'KeyA' }
        ]
      });
      player.load(replayData);
      player.start();

      const inputs = player.getInputsForPosition(0);
      expect(inputs.length).toBe(1);
      expect(inputs[0].time).toBe(0);
    });
  });
});

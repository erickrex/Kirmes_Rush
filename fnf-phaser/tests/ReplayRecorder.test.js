/**
 * @fileoverview Unit tests for the ReplayRecorder class.
 * Tests replay recording functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import ReplayRecorder from '../src/replay/ReplayRecorder.js';

describe('ReplayRecorder', () => {
  let recorder;

  beforeEach(() => {
    recorder = new ReplayRecorder();
  });

  describe('constructor', () => {
    it('should start with recording set to false', () => {
      expect(recorder.recording).toBe(false);
    });

    it('should start with empty inputs array', () => {
      expect(recorder.inputs).toEqual([]);
    });

    it('should start with songStartTime of 0', () => {
      expect(recorder.songStartTime).toBe(0);
    });

    it('should start with empty songId', () => {
      expect(recorder.songId).toBe('');
    });

    it('should start with empty difficulty', () => {
      expect(recorder.difficulty).toBe('');
    });

    it('should start with seed of 0', () => {
      expect(recorder.seed).toBe(0);
    });

    it('should start with empty metadata', () => {
      expect(recorder.metadata).toEqual({});
    });

    it('should have VERSION static property', () => {
      expect(ReplayRecorder.VERSION).toBe('1.0.0');
    });
  });

  describe('start - Recording initialization (Requirement 1.1)', () => {
    it('should set recording to true when started', () => {
      recorder.start('tutorial', 'normal');
      expect(recorder.recording).toBe(true);
    });

    it('should store songId when started', () => {
      recorder.start('tutorial', 'normal');
      expect(recorder.songId).toBe('tutorial');
    });

    it('should store difficulty when started', () => {
      recorder.start('tutorial', 'hard');
      expect(recorder.difficulty).toBe('hard');
    });

    it('should generate a random seed for determinism', () => {
      recorder.start('tutorial', 'normal');
      expect(recorder.seed).toBeGreaterThanOrEqual(0);
      expect(recorder.seed).toBeLessThan(1);
    });

    it('should generate different seeds on different starts', () => {
      recorder.start('tutorial', 'normal');
      const seed1 = recorder.seed;

      recorder.start('tutorial', 'normal');
      const seed2 = recorder.seed;

      // Seeds should be different (with very high probability)
      // Note: There's a tiny chance they could be the same, but it's negligible
      expect(seed1).not.toBe(seed2);
    });

    it('should set songStartTime using performance.now()', () => {
      const mockNow = 12345.678;
      vi.spyOn(performance, 'now').mockReturnValue(mockNow);

      recorder.start('tutorial', 'normal');
      expect(recorder.songStartTime).toBe(mockNow);

      vi.restoreAllMocks();
    });

    it('should clear previous inputs when starting new recording', () => {
      recorder.start('song1', 'normal');
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.recordInput('release', 0, 'KeyA', 200);

      recorder.start('song2', 'hard');
      expect(recorder.inputs).toEqual([]);
    });

    it('should reset metadata when starting new recording', () => {
      recorder.metadata = { test: 'value' };
      recorder.start('tutorial', 'normal');
      expect(recorder.metadata).toEqual({});
    });
  });

  describe('recordInput - Input event recording (Requirement 1.2)', () => {
    beforeEach(() => {
      recorder.start('tutorial', 'normal');
    });

    it('should record press events', () => {
      recorder.recordInput('press', 0, 'KeyA', 1000);

      expect(recorder.inputs.length).toBe(1);
      expect(recorder.inputs[0].type).toBe('press');
    });

    it('should record release events', () => {
      recorder.recordInput('release', 0, 'KeyA', 1000);

      expect(recorder.inputs.length).toBe(1);
      expect(recorder.inputs[0].type).toBe('release');
    });

    it('should record direction (0-3)', () => {
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.recordInput('press', 1, 'KeyS', 200);
      recorder.recordInput('press', 2, 'KeyK', 300);
      recorder.recordInput('press', 3, 'KeyL', 400);

      expect(recorder.inputs[0].direction).toBe(0);
      expect(recorder.inputs[1].direction).toBe(1);
      expect(recorder.inputs[2].direction).toBe(2);
      expect(recorder.inputs[3].direction).toBe(3);
    });

    it('should record key code', () => {
      recorder.recordInput('press', 0, 'KeyA', 1000);
      expect(recorder.inputs[0].keyCode).toBe('KeyA');
    });

    it('should record timestamp (song position)', () => {
      recorder.recordInput('press', 0, 'KeyA', 1234.567);
      expect(recorder.inputs[0].time).toBe(1234.567);
    });

    it('should support sub-millisecond precision timestamps', () => {
      recorder.recordInput('press', 0, 'KeyA', 1000.123456);
      expect(recorder.inputs[0].time).toBe(1000.123456);
    });

    it('should record multiple inputs in order', () => {
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.recordInput('release', 0, 'KeyA', 200);
      recorder.recordInput('press', 1, 'KeyS', 300);

      expect(recorder.inputs.length).toBe(3);
      expect(recorder.inputs[0].time).toBe(100);
      expect(recorder.inputs[1].time).toBe(200);
      expect(recorder.inputs[2].time).toBe(300);
    });

    it('should not record inputs when not recording', () => {
      recorder.discard(); // Stop recording
      recorder.recordInput('press', 0, 'KeyA', 1000);

      expect(recorder.inputs.length).toBe(0);
    });

    it('should record complete input event structure', () => {
      recorder.recordInput('press', 2, 'KeyK', 5000.5);

      const input = recorder.inputs[0];
      expect(input).toEqual({
        time: 5000.5,
        type: 'press',
        direction: 2,
        keyCode: 'KeyK'
      });
    });
  });

  describe('stop - Finalize recording (Requirement 1.3, 1.4)', () => {
    beforeEach(() => {
      recorder.start('tutorial', 'normal');
    });

    it('should set recording to false', () => {
      recorder.stop(10000, {});
      expect(recorder.recording).toBe(false);
    });

    it('should return ReplayData with version', () => {
      const replayData = recorder.stop(10000, {});
      expect(replayData.version).toBe('1.0.0');
    });

    it('should return ReplayData with songId', () => {
      const replayData = recorder.stop(10000, {});
      expect(replayData.songId).toBe('tutorial');
    });

    it('should return ReplayData with difficulty', () => {
      const replayData = recorder.stop(10000, {});
      expect(replayData.difficulty).toBe('normal');
    });

    it('should return ReplayData with recording timestamp', () => {
      const beforeStop = Date.now();
      const replayData = recorder.stop(10000, {});
      const afterStop = Date.now();

      expect(replayData.timestamp).toBeGreaterThanOrEqual(beforeStop);
      expect(replayData.timestamp).toBeLessThanOrEqual(afterStop);
    });

    it('should return ReplayData with final score', () => {
      const replayData = recorder.stop(125000, {});
      expect(replayData.score).toBe(125000);
    });

    it('should return ReplayData with tallies', () => {
      const tallies = {
        sick: 45,
        good: 10,
        bad: 2,
        shit: 0,
        missed: 3,
        combo: 0,
        maxCombo: 42,
        totalNotesHit: 57,
        totalNotes: 60
      };

      const replayData = recorder.stop(100000, tallies);
      expect(replayData.tallies).toEqual(tallies);
    });

    it('should return ReplayData with copy of tallies (not reference)', () => {
      const tallies = { sick: 10, good: 5 };
      const replayData = recorder.stop(10000, tallies);

      tallies.sick = 999;
      expect(replayData.tallies.sick).toBe(10);
    });

    it('should return ReplayData with random seed', () => {
      const replayData = recorder.stop(10000, {});
      expect(replayData.seed).toBe(recorder.seed);
      expect(typeof replayData.seed).toBe('number');
    });

    it('should return ReplayData with recorded inputs', () => {
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.recordInput('release', 0, 'KeyA', 200);

      const replayData = recorder.stop(10000, {});
      expect(replayData.inputs.length).toBe(2);
      expect(replayData.inputs[0]).toEqual({
        time: 100,
        type: 'press',
        direction: 0,
        keyCode: 'KeyA'
      });
    });

    it('should return ReplayData with copy of inputs (not reference)', () => {
      recorder.recordInput('press', 0, 'KeyA', 100);
      const replayData = recorder.stop(10000, {});

      recorder.inputs.push({ time: 999, type: 'press', direction: 1, keyCode: 'KeyS' });
      expect(replayData.inputs.length).toBe(1);
    });

    it('should return ReplayData with metadata including gameVersion', () => {
      const replayData = recorder.stop(10000, {});
      expect(replayData.metadata.gameVersion).toBe('1.0.0');
    });

    it('should calculate accuracy in metadata', () => {
      const tallies = {
        totalNotesHit: 90,
        totalNotes: 100
      };

      const replayData = recorder.stop(10000, tallies);
      expect(replayData.metadata.accuracy).toBe(90);
    });

    it('should handle zero totalNotes for accuracy calculation', () => {
      const tallies = {
        totalNotesHit: 0,
        totalNotes: 0
      };

      const replayData = recorder.stop(10000, tallies);
      expect(replayData.metadata.accuracy).toBe(0);
    });

    it('should handle missing totalNotesHit for accuracy calculation', () => {
      const tallies = {};

      const replayData = recorder.stop(10000, tallies);
      expect(replayData.metadata.accuracy).toBe(0);
    });

    it('should return complete ReplayData structure', () => {
      recorder.recordInput('press', 0, 'KeyA', 100);

      const tallies = {
        sick: 45,
        good: 10,
        bad: 2,
        shit: 0,
        missed: 3,
        totalNotesHit: 57,
        totalNotes: 60
      };

      const replayData = recorder.stop(125000, tallies);

      expect(replayData).toHaveProperty('version');
      expect(replayData).toHaveProperty('songId');
      expect(replayData).toHaveProperty('difficulty');
      expect(replayData).toHaveProperty('timestamp');
      expect(replayData).toHaveProperty('score');
      expect(replayData).toHaveProperty('tallies');
      expect(replayData).toHaveProperty('seed');
      expect(replayData).toHaveProperty('inputs');
      expect(replayData).toHaveProperty('metadata');
    });
  });

  describe('discard - Cancel recording (Requirement 1.5)', () => {
    beforeEach(() => {
      recorder.start('tutorial', 'normal');
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.recordInput('release', 0, 'KeyA', 200);
    });

    it('should set recording to false', () => {
      recorder.discard();
      expect(recorder.recording).toBe(false);
    });

    it('should clear all recorded inputs', () => {
      recorder.discard();
      expect(recorder.inputs).toEqual([]);
    });

    it('should reset songId', () => {
      recorder.discard();
      expect(recorder.songId).toBe('');
    });

    it('should reset difficulty', () => {
      recorder.discard();
      expect(recorder.difficulty).toBe('');
    });

    it('should reset seed', () => {
      recorder.discard();
      expect(recorder.seed).toBe(0);
    });

    it('should reset songStartTime', () => {
      recorder.discard();
      expect(recorder.songStartTime).toBe(0);
    });

    it('should reset metadata', () => {
      recorder.metadata = { test: 'value' };
      recorder.discard();
      expect(recorder.metadata).toEqual({});
    });

    it('should allow starting new recording after discard', () => {
      recorder.discard();
      recorder.start('newSong', 'hard');

      expect(recorder.recording).toBe(true);
      expect(recorder.songId).toBe('newSong');
      expect(recorder.difficulty).toBe('hard');
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      recorder.start('tutorial', 'normal');
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.metadata = { test: 'value' };

      recorder.reset();

      expect(recorder.recording).toBe(false);
      expect(recorder.inputs).toEqual([]);
      expect(recorder.songStartTime).toBe(0);
      expect(recorder.songId).toBe('');
      expect(recorder.difficulty).toBe('');
      expect(recorder.seed).toBe(0);
      expect(recorder.metadata).toEqual({});
    });
  });

  describe('isRecording', () => {
    it('should return false when not recording', () => {
      expect(recorder.isRecording()).toBe(false);
    });

    it('should return true when recording', () => {
      recorder.start('tutorial', 'normal');
      expect(recorder.isRecording()).toBe(true);
    });

    it('should return false after stop', () => {
      recorder.start('tutorial', 'normal');
      recorder.stop(10000, {});
      expect(recorder.isRecording()).toBe(false);
    });

    it('should return false after discard', () => {
      recorder.start('tutorial', 'normal');
      recorder.discard();
      expect(recorder.isRecording()).toBe(false);
    });
  });

  describe('getInputCount', () => {
    it('should return 0 when no inputs recorded', () => {
      expect(recorder.getInputCount()).toBe(0);
    });

    it('should return correct count of recorded inputs', () => {
      recorder.start('tutorial', 'normal');
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.recordInput('release', 0, 'KeyA', 200);
      recorder.recordInput('press', 1, 'KeyS', 300);

      expect(recorder.getInputCount()).toBe(3);
    });

    it('should return 0 after discard', () => {
      recorder.start('tutorial', 'normal');
      recorder.recordInput('press', 0, 'KeyA', 100);
      recorder.discard();

      expect(recorder.getInputCount()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty song completion', () => {
      recorder.start('tutorial', 'normal');
      const replayData = recorder.stop(0, {});

      expect(replayData.inputs).toEqual([]);
      expect(replayData.score).toBe(0);
    });

    it('should handle very large number of inputs', () => {
      recorder.start('tutorial', 'normal');

      for (let i = 0; i < 1000; i++) {
        recorder.recordInput('press', i % 4, 'KeyA', i * 10);
        recorder.recordInput('release', i % 4, 'KeyA', i * 10 + 5);
      }

      expect(recorder.getInputCount()).toBe(2000);

      const replayData = recorder.stop(100000, {});
      expect(replayData.inputs.length).toBe(2000);
    });

    it('should handle negative timestamps', () => {
      recorder.start('tutorial', 'normal');
      recorder.recordInput('press', 0, 'KeyA', -100);

      expect(recorder.inputs[0].time).toBe(-100);
    });

    it('should handle very large timestamps', () => {
      recorder.start('tutorial', 'normal');
      recorder.recordInput('press', 0, 'KeyA', 999999999.999);

      expect(recorder.inputs[0].time).toBe(999999999.999);
    });

    it('should handle special characters in songId', () => {
      recorder.start('song-with-special_chars.v2', 'normal');
      const replayData = recorder.stop(10000, {});

      expect(replayData.songId).toBe('song-with-special_chars.v2');
    });

    it('should handle empty songId and difficulty', () => {
      recorder.start('', '');
      const replayData = recorder.stop(10000, {});

      expect(replayData.songId).toBe('');
      expect(replayData.difficulty).toBe('');
    });

    it('should handle multiple start/stop cycles', () => {
      // First recording
      recorder.start('song1', 'easy');
      recorder.recordInput('press', 0, 'KeyA', 100);
      const replay1 = recorder.stop(5000, { sick: 1 });

      // Second recording
      recorder.start('song2', 'hard');
      recorder.recordInput('press', 1, 'KeyS', 200);
      recorder.recordInput('press', 2, 'KeyK', 300);
      const replay2 = recorder.stop(10000, { sick: 2 });

      expect(replay1.songId).toBe('song1');
      expect(replay1.inputs.length).toBe(1);
      expect(replay2.songId).toBe('song2');
      expect(replay2.inputs.length).toBe(2);
    });

    it('should handle calling stop without start', () => {
      const replayData = recorder.stop(10000, {});

      expect(replayData.songId).toBe('');
      expect(replayData.inputs).toEqual([]);
    });

    it('should handle calling discard without start', () => {
      // Should not throw
      expect(() => recorder.discard()).not.toThrow();
    });

    it('should handle calling recordInput without start', () => {
      recorder.recordInput('press', 0, 'KeyA', 100);
      expect(recorder.inputs).toEqual([]);
    });
  });

  describe('determinism support', () => {
    it('should generate seed between 0 and 1', () => {
      recorder.start('tutorial', 'normal');
      expect(recorder.seed).toBeGreaterThanOrEqual(0);
      expect(recorder.seed).toBeLessThan(1);
    });

    it('should include seed in replay data for deterministic playback', () => {
      recorder.start('tutorial', 'normal');
      const replayData = recorder.stop(10000, {});

      expect(typeof replayData.seed).toBe('number');
      expect(replayData.seed).toBeGreaterThanOrEqual(0);
      expect(replayData.seed).toBeLessThan(1);
    });
  });
});

/**
 * @fileoverview Tests for VoicesGroup - Vocal track management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import VoicesGroup from '../src/audio/VoicesGroup.js';

// Mock Phaser sound
const createMockSound = () => ({
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  setVolume: vi.fn(),
  seek: 0,
  duration: 120
});

const createMockScene = () => ({
  sound: {
    add: vi.fn(() => createMockSound())
  }
});

describe('VoicesGroup', () => {
  let voices;
  let mockScene;

  beforeEach(() => {
    mockScene = createMockScene();
    voices = new VoicesGroup(mockScene);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(voices.scene).toBe(mockScene);
      expect(voices.playerVoice).toBeNull();
      expect(voices.opponentVoice).toBeNull();
      expect(voices.combinedVoices).toBeNull();
      expect(voices.isSplit).toBe(false);
      expect(voices.masterVolume).toBe(1.0);
      expect(voices.playerMuted).toBe(false);
      expect(voices.opponentMuted).toBe(false);
    });
  });

  describe('loadCombined', () => {
    it('should load combined voices track', () => {
      const result = voices.loadCombined('voices-combined');

      expect(mockScene.sound.add).toHaveBeenCalledWith('voices-combined', expect.any(Object));
      expect(voices.combinedVoices).not.toBeNull();
      expect(voices.isSplit).toBe(false);
      expect(result).toBe(voices.combinedVoices);
    });

    it('should return null if scene has no sound', () => {
      voices.scene = {};
      const result = voices.loadCombined('voices');
      expect(result).toBeNull();
    });
  });

  describe('loadSplit', () => {
    it('should load split voice tracks', () => {
      voices.loadSplit('voices-player', 'voices-opponent');

      expect(mockScene.sound.add).toHaveBeenCalledTimes(2);
      expect(voices.playerVoice).not.toBeNull();
      expect(voices.opponentVoice).not.toBeNull();
      expect(voices.isSplit).toBe(true);
    });

    it('should handle missing player voice', () => {
      voices.loadSplit(null, 'voices-opponent');

      expect(voices.playerVoice).toBeNull();
      expect(voices.opponentVoice).not.toBeNull();
      expect(voices.isSplit).toBe(true);
    });

    it('should handle missing opponent voice', () => {
      voices.loadSplit('voices-player', null);

      expect(voices.playerVoice).not.toBeNull();
      expect(voices.opponentVoice).toBeNull();
      expect(voices.isSplit).toBe(true);
    });
  });

  describe('isLoaded', () => {
    it('should return false when not loaded', () => {
      expect(voices.isLoaded()).toBe(false);
    });

    it('should return true when combined loaded', () => {
      voices.loadCombined('voices');
      expect(voices.isLoaded()).toBe(true);
    });

    it('should return true when split loaded', () => {
      voices.loadSplit('player', 'opponent');
      expect(voices.isLoaded()).toBe(true);
    });
  });

  describe('play', () => {
    it('should play combined voices', () => {
      voices.loadCombined('voices');
      voices.play();

      expect(voices.combinedVoices.play).toHaveBeenCalledWith({ seek: 0 });
      expect(voices.isPlaying).toBe(true);
    });

    it('should play split voices', () => {
      voices.loadSplit('player', 'opponent');
      voices.play(1000);

      expect(voices.playerVoice.play).toHaveBeenCalledWith({ seek: 1 });
      expect(voices.opponentVoice.play).toHaveBeenCalledWith({ seek: 1 });
    });

    it('should play from specific time', () => {
      voices.loadCombined('voices');
      voices.play(5000);

      expect(voices.combinedVoices.play).toHaveBeenCalledWith({ seek: 5 });
    });
  });

  describe('pause', () => {
    it('should pause combined voices', () => {
      voices.loadCombined('voices');
      voices.play();
      voices.pause();

      expect(voices.combinedVoices.pause).toHaveBeenCalled();
      expect(voices.isPaused).toBe(true);
      expect(voices.isPlaying).toBe(false);
    });

    it('should pause split voices', () => {
      voices.loadSplit('player', 'opponent');
      voices.play();
      voices.pause();

      expect(voices.playerVoice.pause).toHaveBeenCalled();
      expect(voices.opponentVoice.pause).toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('should resume combined voices', () => {
      voices.loadCombined('voices');
      voices.play();
      voices.pause();
      voices.resume();

      expect(voices.combinedVoices.resume).toHaveBeenCalled();
      expect(voices.isPaused).toBe(false);
      expect(voices.isPlaying).toBe(true);
    });

    it('should resume split voices', () => {
      voices.loadSplit('player', 'opponent');
      voices.play();
      voices.pause();
      voices.resume();

      expect(voices.playerVoice.resume).toHaveBeenCalled();
      expect(voices.opponentVoice.resume).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop combined voices', () => {
      voices.loadCombined('voices');
      voices.play();
      voices.stop();

      expect(voices.combinedVoices.stop).toHaveBeenCalled();
      expect(voices.isPlaying).toBe(false);
    });

    it('should stop split voices', () => {
      voices.loadSplit('player', 'opponent');
      voices.play();
      voices.stop();

      expect(voices.playerVoice.stop).toHaveBeenCalled();
      expect(voices.opponentVoice.stop).toHaveBeenCalled();
    });
  });

  describe('seek', () => {
    it('should seek combined voices', () => {
      voices.loadCombined('voices');
      voices.seek(5000);

      expect(voices.combinedVoices.seek).toBe(5);
    });

    it('should seek split voices', () => {
      voices.loadSplit('player', 'opponent');
      voices.seek(3000);

      expect(voices.playerVoice.seek).toBe(3);
      expect(voices.opponentVoice.seek).toBe(3);
    });

    it('should not seek to negative time', () => {
      voices.loadCombined('voices');
      voices.seek(-1000);

      expect(voices.combinedVoices.seek).toBe(0);
    });
  });

  describe('mute control', () => {
    beforeEach(() => {
      voices.loadSplit('player', 'opponent');
    });

    it('should mute player voice', () => {
      voices.mutePlayer();

      expect(voices.playerMuted).toBe(true);
      expect(voices.playerVoice.setVolume).toHaveBeenCalledWith(0);
    });

    it('should unmute player voice', () => {
      voices.mutePlayer();
      voices.unmutePlayer();

      expect(voices.playerMuted).toBe(false);
      expect(voices.playerVoice.setVolume).toHaveBeenLastCalledWith(1);
    });

    it('should mute opponent voice', () => {
      voices.muteOpponent();

      expect(voices.opponentMuted).toBe(true);
      expect(voices.opponentVoice.setVolume).toHaveBeenCalledWith(0);
    });

    it('should unmute opponent voice', () => {
      voices.muteOpponent();
      voices.unmuteOpponent();

      expect(voices.opponentMuted).toBe(false);
      expect(voices.opponentVoice.setVolume).toHaveBeenLastCalledWith(1);
    });

    it('should mute all voices', () => {
      voices.muteAll();

      expect(voices.allMuted).toBe(true);
      expect(voices.playerVoice.setVolume).toHaveBeenCalledWith(0);
      expect(voices.opponentVoice.setVolume).toHaveBeenCalledWith(0);
    });

    it('should unmute all voices', () => {
      voices.muteAll();
      voices.unmuteAll();

      expect(voices.allMuted).toBe(false);
    });
  });

  describe('volume control', () => {
    beforeEach(() => {
      voices.loadSplit('player', 'opponent');
    });

    it('should set master volume', () => {
      voices.setMasterVolume(0.5);

      expect(voices.masterVolume).toBe(0.5);
      expect(voices.playerVoice.setVolume).toHaveBeenCalledWith(0.5);
      expect(voices.opponentVoice.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should clamp master volume', () => {
      voices.setMasterVolume(1.5);
      expect(voices.masterVolume).toBe(1);

      voices.setMasterVolume(-0.5);
      expect(voices.masterVolume).toBe(0);
    });

    it('should set player volume', () => {
      voices.setPlayerVolume(0.8);

      expect(voices.playerVolume).toBe(0.8);
      expect(voices.playerVoice.setVolume).toHaveBeenCalledWith(0.8);
    });

    it('should set opponent volume', () => {
      voices.setOpponentVolume(0.6);

      expect(voices.opponentVolume).toBe(0.6);
      expect(voices.opponentVoice.setVolume).toHaveBeenCalledWith(0.6);
    });

    it('should combine master and individual volumes', () => {
      voices.setMasterVolume(0.5);
      voices.setPlayerVolume(0.8);

      expect(voices.playerVoice.setVolume).toHaveBeenLastCalledWith(0.4); // 0.5 * 0.8
    });

    it('should apply mute over volume', () => {
      voices.setPlayerVolume(0.8);
      voices.mutePlayer();

      expect(voices.playerVoice.setVolume).toHaveBeenLastCalledWith(0);
    });
  });

  describe('currentTime', () => {
    it('should return 0 when not loaded', () => {
      expect(voices.currentTime).toBe(0);
    });

    it('should return time from combined voices', () => {
      voices.loadCombined('voices');
      voices.combinedVoices.seek = 5.5;

      expect(voices.currentTime).toBe(5500);
    });

    it('should return time from player voice when split', () => {
      voices.loadSplit('player', 'opponent');
      voices.playerVoice.seek = 3.2;

      expect(voices.currentTime).toBe(3200);
    });
  });

  describe('duration', () => {
    it('should return 0 when not loaded', () => {
      expect(voices.duration).toBe(0);
    });

    it('should return duration from combined voices', () => {
      voices.loadCombined('voices');
      expect(voices.duration).toBe(120000);
    });

    it('should return duration from split voices', () => {
      voices.loadSplit('player', 'opponent');
      expect(voices.duration).toBe(120000);
    });
  });

  describe('destroy', () => {
    it('should clean up combined voices', () => {
      voices.loadCombined('voices');
      voices.destroy();

      expect(voices.combinedVoices).toBeNull();
      expect(voices.scene).toBeNull();
    });

    it('should clean up split voices', () => {
      voices.loadSplit('player', 'opponent');
      const playerVoice = voices.playerVoice;
      const opponentVoice = voices.opponentVoice;

      voices.destroy();

      expect(playerVoice.destroy).toHaveBeenCalled();
      expect(opponentVoice.destroy).toHaveBeenCalled();
      expect(voices.playerVoice).toBeNull();
      expect(voices.opponentVoice).toBeNull();
    });
  });
});

/**
 * @fileoverview Tests for AudioManager - Central audio control
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import AudioManager from '../src/audio/AudioManager.js';

// Mock Phaser sound
const createMockSound = () => ({
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  setVolume: vi.fn(),
  on: vi.fn(),
  seek: 0,
  duration: 120, // 2 minutes
  isPlaying: false
});

const createMockScene = () => ({
  sound: {
    add: vi.fn(() => createMockSound()),
    context: {}
  }
});

describe('AudioManager', () => {
  let manager;
  let mockScene;

  beforeEach(() => {
    mockScene = createMockScene();
    manager = new AudioManager(mockScene);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(manager.scene).toBe(mockScene);
      expect(manager.instrumental).toBeNull();
      expect(manager.voices).toBeNull();
      expect(manager.masterVolume).toBe(1.0);
      expect(manager.instrumentalVolume).toBe(1.0);
      expect(manager.muted).toBe(false);
      expect(manager.isPlaying).toBe(false);
      expect(manager.isPaused).toBe(false);
    });
  });

  describe('loadInstrumental', () => {
    it('should load instrumental track', () => {
      const result = manager.loadInstrumental('test-inst');

      expect(mockScene.sound.add).toHaveBeenCalledWith('test-inst', expect.any(Object));
      expect(manager.instrumental).not.toBeNull();
      expect(result).toBe(manager.instrumental);
    });

    it('should set song length from duration', () => {
      manager.loadInstrumental('test-inst');
      expect(manager.songLength).toBe(120000); // 120 seconds * 1000
    });

    it('should setup complete callback', () => {
      manager.loadInstrumental('test-inst');
      expect(manager.instrumental.on).toHaveBeenCalledWith('complete', expect.any(Function));
    });

    it('should return null if scene has no sound', () => {
      manager.scene = {};
      const result = manager.loadInstrumental('test-inst');
      expect(result).toBeNull();
    });
  });

  describe('setVoices', () => {
    it('should set voices group', () => {
      const mockVoices = { play: vi.fn() };
      manager.setVoices(mockVoices);
      expect(manager.voices).toBe(mockVoices);
    });
  });

  describe('isLoaded', () => {
    it('should return false when not loaded', () => {
      expect(manager.isLoaded()).toBe(false);
    });

    it('should return true when loaded', () => {
      manager.loadInstrumental('test-inst');
      expect(manager.isLoaded()).toBe(true);
    });
  });

  describe('play', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
    });

    it('should play instrumental from start', () => {
      manager.play();
      expect(manager.instrumental.play).toHaveBeenCalledWith({ seek: 0 });
      expect(manager.isPlaying).toBe(true);
      expect(manager.isPaused).toBe(false);
    });

    it('should play from specific time', () => {
      manager.play(5000);
      expect(manager.instrumental.play).toHaveBeenCalledWith({ seek: 5 });
    });

    it('should play voices if available', () => {
      const mockVoices = { play: vi.fn() };
      manager.setVoices(mockVoices);
      manager.play(1000);
      expect(mockVoices.play).toHaveBeenCalledWith(1000);
    });

    it('should do nothing if not loaded', () => {
      const emptyManager = new AudioManager(mockScene);
      emptyManager.play();
      expect(emptyManager.isPlaying).toBe(false);
    });
  });

  describe('pause', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
      manager.play();
    });

    it('should pause instrumental', () => {
      manager.pause();
      expect(manager.instrumental.pause).toHaveBeenCalled();
      expect(manager.isPaused).toBe(true);
      expect(manager.isPlaying).toBe(false);
    });

    it('should pause voices if available', () => {
      const mockVoices = { play: vi.fn(), pause: vi.fn() };
      manager.setVoices(mockVoices);
      manager.pause();
      expect(mockVoices.pause).toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
      manager.play();
      manager.pause();
    });

    it('should resume instrumental', () => {
      manager.resume();
      expect(manager.instrumental.resume).toHaveBeenCalled();
      expect(manager.isPaused).toBe(false);
      expect(manager.isPlaying).toBe(true);
    });

    it('should resume voices if available', () => {
      const mockVoices = { play: vi.fn(), pause: vi.fn(), resume: vi.fn() };
      manager.setVoices(mockVoices);
      manager.resume();
      expect(mockVoices.resume).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
      manager.play();
    });

    it('should stop instrumental', () => {
      manager.stop();
      expect(manager.instrumental.stop).toHaveBeenCalled();
      expect(manager.isPlaying).toBe(false);
      expect(manager.isPaused).toBe(false);
    });

    it('should stop voices if available', () => {
      const mockVoices = { play: vi.fn(), stop: vi.fn() };
      manager.setVoices(mockVoices);
      manager.stop();
      expect(mockVoices.stop).toHaveBeenCalled();
    });
  });

  describe('seek', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
    });

    it('should seek to specific time', () => {
      manager.seek(5000);
      expect(manager.instrumental.seek).toBe(5);
    });

    it('should not seek to negative time', () => {
      manager.seek(-1000);
      expect(manager.instrumental.seek).toBe(0);
    });

    it('should seek voices if available', () => {
      const mockVoices = { seek: vi.fn() };
      manager.setVoices(mockVoices);
      manager.seek(5000);
      expect(mockVoices.seek).toHaveBeenCalledWith(5000);
    });
  });

  describe('currentTime', () => {
    it('should return 0 when not loaded', () => {
      expect(manager.currentTime).toBe(0);
    });

    it('should return current time in milliseconds', () => {
      manager.loadInstrumental('test-inst');
      manager.instrumental.seek = 5.5;
      expect(manager.currentTime).toBe(5500);
    });
  });

  describe('resync', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
    });

    it('should return false if no voices', () => {
      expect(manager.resync()).toBe(false);
    });

    it('should resync voices if drift exceeds threshold', () => {
      const mockVoices = {
        currentTime: 0,
        seek: vi.fn()
      };
      manager.setVoices(mockVoices);
      manager.instrumental.seek = 5; // 5000ms

      const result = manager.resync();
      expect(result).toBe(true);
      expect(mockVoices.seek).toHaveBeenCalledWith(5000);
    });

    it('should not resync if drift is within threshold', () => {
      const mockVoices = {
        currentTime: 5000,
        seek: vi.fn()
      };
      manager.setVoices(mockVoices);
      manager.instrumental.seek = 5.01; // 5010ms, within 20ms threshold

      const result = manager.resync();
      expect(result).toBe(false);
      expect(mockVoices.seek).not.toHaveBeenCalled();
    });
  });

  describe('forceResync', () => {
    it('should force resync voices', () => {
      manager.loadInstrumental('test-inst');
      const mockVoices = { seek: vi.fn() };
      manager.setVoices(mockVoices);
      manager.instrumental.seek = 10;

      manager.forceResync();
      expect(mockVoices.seek).toHaveBeenCalledWith(10000);
    });
  });

  describe('volume control', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
    });

    it('should set master volume', () => {
      manager.setMasterVolume(0.5);
      expect(manager.masterVolume).toBe(0.5);
      expect(manager.instrumental.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should clamp master volume to 0-1', () => {
      manager.setMasterVolume(1.5);
      expect(manager.masterVolume).toBe(1);

      manager.setMasterVolume(-0.5);
      expect(manager.masterVolume).toBe(0);
    });

    it('should set instrumental volume', () => {
      manager.setInstrumentalVolume(0.8);
      expect(manager.instrumentalVolume).toBe(0.8);
      expect(manager.instrumental.setVolume).toHaveBeenCalledWith(0.8);
    });

    it('should apply master volume to voices', () => {
      const mockVoices = { setMasterVolume: vi.fn() };
      manager.setVoices(mockVoices);
      manager.setMasterVolume(0.7);
      expect(mockVoices.setMasterVolume).toHaveBeenCalledWith(0.7);
    });
  });

  describe('mute control', () => {
    beforeEach(() => {
      manager.loadInstrumental('test-inst');
    });

    it('should mute audio', () => {
      manager.mute();
      expect(manager.muted).toBe(true);
      expect(manager.instrumental.setVolume).toHaveBeenCalledWith(0);
    });

    it('should unmute audio', () => {
      manager.mute();
      manager.unmute();
      expect(manager.muted).toBe(false);
      expect(manager.instrumental.setVolume).toHaveBeenLastCalledWith(1);
    });

    it('should toggle mute', () => {
      expect(manager.toggleMute()).toBe(true);
      expect(manager.muted).toBe(true);

      expect(manager.toggleMute()).toBe(false);
      expect(manager.muted).toBe(false);
    });

    it('should mute voices when muted', () => {
      const mockVoices = { setMasterVolume: vi.fn() };
      manager.setVoices(mockVoices);
      manager.mute();
      expect(mockVoices.setMasterVolume).toHaveBeenCalledWith(0);
    });
  });

  describe('duration', () => {
    it('should return 0 when not loaded', () => {
      expect(manager.duration).toBe(0);
    });

    it('should return duration in milliseconds', () => {
      manager.loadInstrumental('test-inst');
      expect(manager.duration).toBe(120000);
    });
  });

  describe('progress', () => {
    it('should return 0 when not loaded', () => {
      expect(manager.progress).toBe(0);
    });

    it('should return progress as 0-1', () => {
      manager.loadInstrumental('test-inst');
      manager.instrumental.seek = 60; // 60 seconds = 50%
      expect(manager.progress).toBe(0.5);
    });
  });

  describe('hasEnded', () => {
    it('should return false when not loaded', () => {
      expect(manager.hasEnded).toBe(false);
    });

    it('should return true when near end', () => {
      manager.loadInstrumental('test-inst');
      manager.instrumental.seek = 119.95; // Near end
      expect(manager.hasEnded).toBe(true);
    });

    it('should return false when not near end', () => {
      manager.loadInstrumental('test-inst');
      manager.instrumental.seek = 60;
      expect(manager.hasEnded).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      manager.loadInstrumental('test-inst');
      const mockVoices = { destroy: vi.fn(), stop: vi.fn() };
      manager.setVoices(mockVoices);

      manager.destroy();

      expect(manager.instrumental).toBeNull();
      expect(manager.voices).toBeNull();
      expect(manager.scene).toBeNull();
      expect(mockVoices.destroy).toHaveBeenCalled();
    });
  });
});

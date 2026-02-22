/**
 * @fileoverview Unit tests for FreeplayState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };

  const mockContainer = {
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    getData: vi.fn((key) => ({ ...mockText })),
    add: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.scene = { key: config.key, start: vi.fn() };
          this.add = {
            text: vi.fn(() => ({ ...mockText })),
            sprite: vi.fn(() => ({ setDisplaySize: vi.fn().mockReturnThis(), setTint: vi.fn().mockReturnThis() })),
            graphics: vi.fn(() => ({
              fillStyle: vi.fn().mockReturnThis(),
              fillRect: vi.fn().mockReturnThis(),
              fillRoundedRect: vi.fn().mockReturnThis(),
              fillGradientStyle: vi.fn().mockReturnThis()
            })),
            container: vi.fn(() => ({ ...mockContainer }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn((event, cb) => cb())
            }
          };
          this.input = {
            keyboard: { on: vi.fn(), off: vi.fn() }
          };
          this.sound = {
            play: vi.fn()
          };
          this.cache = {
            audio: { exists: vi.fn(() => false) }
          };
          this.textures = {
            exists: vi.fn(() => false)
          };
          this.load = {
            setPath: vi.fn(),
            image: vi.fn(),
            audio: vi.fn()
          };
        }
      }
    }
  };
});

import FreeplayState from '../src/ui/FreeplayState.js';

describe('FreeplayState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new FreeplayState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('FreeplayState');
    });

    it('should have songs defined', () => {
      expect(scene.songs).toBeDefined();
      expect(scene.songs.length).toBeGreaterThan(0);
    });

    it('should initialize with selectedIndex at 0', () => {
      expect(scene.selectedIndex).toBe(0);
    });

    it('should initialize with no letter filter', () => {
      expect(scene.letterFilter).toBeNull();
    });
  });

  describe('Song Data', () => {
    it('should have required properties for each song', () => {
      scene.songs.forEach(song => {
        expect(song.id).toBeDefined();
        expect(song.name).toBeDefined();
        expect(song.artist).toBeDefined();
        expect(song.difficulties).toBeDefined();
      });
    });

    it('should have BPM for songs', () => {
      scene.songs.forEach(song => {
        expect(song.bpm).toBeDefined();
        expect(typeof song.bpm).toBe('number');
      });
    });
  });

  describe('Song Navigation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should navigate down through songs', () => {
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(1);
    });

    it('should wrap around when navigating down past last song', () => {
      scene.selectedIndex = scene.filteredSongs.length - 1;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(0);
    });

    it('should not navigate when transitioning', () => {
      scene.transitioning = true;
      const initialIndex = scene.selectedIndex;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(initialIndex);
    });
  });

  describe('Letter Filter', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should cycle through letter filter', () => {
      expect(scene.letterFilter).toBeNull();
      scene.onCycleFilter();
      expect(scene.letterFilter).toBe('A');
    });

    it('should filter songs by letter', () => {
      scene.letterFilter = 'T';
      scene.applyFilter();
      scene.filteredSongs.forEach(song => {
        expect(song.name.toUpperCase().startsWith('T')).toBe(true);
      });
    });

    it('should show all songs when filter is null', () => {
      scene.letterFilter = null;
      scene.applyFilter();
      expect(scene.filteredSongs.length).toBe(scene.songs.length);
    });
  });

  describe('Song Selection', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should set transitioning on select', () => {
      scene.onSelect();
      expect(scene.transitioning).toBe(true);
    });

    it('should not select when transitioning', () => {
      scene.transitioning = true;
      const spy = vi.spyOn(scene, 'startSong');
      scene.onSelect();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.create();
      scene.shutdown();
      expect(scene.capsules.length).toBe(0);
      expect(scene.filteredSongs.length).toBe(0);
    });
  });
});

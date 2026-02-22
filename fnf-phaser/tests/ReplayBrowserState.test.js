/**
 * @fileoverview Unit tests for ReplayBrowserState.
 * Tests the replay browser UI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
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
    _getStore: () => store
  };
}

// Mock Phaser
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };

  const mockGraphics = {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    fillGradientStyle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRoundedRect: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis()
  };

  const mockContainer = {
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
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
            graphics: vi.fn(() => ({ ...mockGraphics })),
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

// Mock ReplayManager
vi.mock('../src/replay/ReplaySystem.js', () => {
  class MockReplayManager {
    constructor() {
      this.replays = [];
    }

    getReplayList() {
      return [...this.replays].sort((a, b) => b.timestamp - a.timestamp);
    }

    filterBySong(songId) {
      return this.replays.filter(r => r.songId === songId).sort((a, b) => b.timestamp - a.timestamp);
    }

    deleteReplay(id) {
      const index = this.replays.findIndex(r => r.id === id);
      if (index !== -1) {
        this.replays.splice(index, 1);
        return true;
      }
      return false;
    }

    loadReplay(id) {
      return this.replays.find(r => r.id === id) || null;
    }

    // Test helper to add replays
    _addReplay(replay) {
      this.replays.push(replay);
    }
  }

  return {
    ReplayManager: MockReplayManager,
    ReplayRecorder: class MockReplayRecorder {},
    ReplayPlayer: class MockReplayPlayer {}
  };
});

import ReplayBrowserState from '../src/ui/ReplayBrowserState.js';

/**
 * Helper to create mock replay entry
 */
function createMockReplay(overrides = {}) {
  return {
    id: `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    songId: 'tutorial',
    songName: 'Tutorial',
    difficulty: 'normal',
    score: 100000,
    accuracy: 95.5,
    timestamp: Date.now(),
    ...overrides
  };
}

describe('ReplayBrowserState', () => {
  let scene;
  let mockStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockStorage);
    scene = new ReplayBrowserState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('ReplayBrowserState');
    });

    it('should initialize with selectedIndex at 0', () => {
      expect(scene.selectedIndex).toBe(0);
    });

    it('should initialize with no song filter', () => {
      expect(scene.songFilter).toBeNull();
    });

    it('should initialize with transitioning false', () => {
      expect(scene.transitioning).toBe(false);
    });

    it('should initialize with showingDeleteConfirm false', () => {
      expect(scene.showingDeleteConfirm).toBe(false);
    });

    it('should initialize with empty replay arrays', () => {
      expect(scene.allReplays).toEqual([]);
      expect(scene.filteredReplays).toEqual([]);
    });
  });

  describe('Replay Loading (Requirement 3.1)', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should initialize replay manager on create', () => {
      expect(scene.replayManager).not.toBeNull();
    });

    it('should load replays from manager', () => {
      // Add replays to mock manager
      scene.replayManager._addReplay(createMockReplay({ songId: 'song1' }));
      scene.replayManager._addReplay(createMockReplay({ songId: 'song2' }));

      scene.loadReplays();

      expect(scene.allReplays.length).toBe(2);
    });

    it('should extract available songs for filtering', () => {
      scene.replayManager._addReplay(createMockReplay({ songId: 'tutorial' }));
      scene.replayManager._addReplay(createMockReplay({ songId: 'bopeebo' }));
      scene.replayManager._addReplay(createMockReplay({ songId: 'tutorial' }));

      scene.loadReplays();

      expect(scene.availableSongs).toContain('ALL');
      expect(scene.availableSongs).toContain('tutorial');
      expect(scene.availableSongs).toContain('bopeebo');
    });
  });

  describe('Replay Display (Requirement 3.2)', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should have visible entries configured', () => {
      expect(scene.visibleEntries).toBeGreaterThan(0);
    });

    it('should create replay display containers', () => {
      expect(scene.replayDisplays.length).toBe(scene.visibleEntries);
    });

    it('should have info panel elements', () => {
      expect(scene.infoPanel.songText).not.toBeNull();
      expect(scene.infoPanel.difficultyText).not.toBeNull();
      expect(scene.infoPanel.scoreText).not.toBeNull();
      expect(scene.infoPanel.accuracyText).not.toBeNull();
      expect(scene.infoPanel.dateText).not.toBeNull();
    });
  });

  describe('Navigation (Requirement 3.3)', () => {
    beforeEach(() => {
      scene.create();
      scene.replayManager._addReplay(createMockReplay({ songId: 'song1', timestamp: 1000 }));
      scene.replayManager._addReplay(createMockReplay({ songId: 'song2', timestamp: 2000 }));
      scene.replayManager._addReplay(createMockReplay({ songId: 'song3', timestamp: 3000 }));
      scene.loadReplays();
    });

    it('should navigate down through replays', () => {
      expect(scene.selectedIndex).toBe(0);
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(1);
    });

    it('should navigate up through replays', () => {
      scene.selectedIndex = 1;
      scene.onNavigateUp();
      expect(scene.selectedIndex).toBe(0);
    });

    it('should wrap around when navigating down past last replay', () => {
      scene.selectedIndex = scene.filteredReplays.length - 1;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(0);
    });

    it('should wrap around when navigating up past first replay', () => {
      scene.selectedIndex = 0;
      scene.onNavigateUp();
      expect(scene.selectedIndex).toBe(scene.filteredReplays.length - 1);
    });

    it('should not navigate when transitioning', () => {
      scene.transitioning = true;
      const initialIndex = scene.selectedIndex;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(initialIndex);
    });

    it('should not navigate when showing delete confirmation', () => {
      scene.showingDeleteConfirm = true;
      const initialIndex = scene.selectedIndex;
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(initialIndex);
    });

    it('should not navigate when no replays exist', () => {
      scene.filteredReplays = [];
      scene.onNavigateDown();
      expect(scene.selectedIndex).toBe(0);
    });
  });

  describe('Replay Selection', () => {
    beforeEach(() => {
      scene.create();
      scene.replayManager._addReplay(createMockReplay({ songId: 'tutorial' }));
      scene.loadReplays();
    });

    it('should set transitioning on select', () => {
      scene.onSelect();
      expect(scene.transitioning).toBe(true);
    });

    it('should not select when transitioning', () => {
      scene.transitioning = true;
      const spy = vi.spyOn(scene, 'startReplayPlayback');
      scene.onSelect();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should not select when no replays exist', () => {
      scene.filteredReplays = [];
      const spy = vi.spyOn(scene, 'startReplayPlayback');
      scene.onSelect();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should confirm delete when showing delete confirmation', () => {
      scene.showingDeleteConfirm = true;
      const spy = vi.spyOn(scene, 'confirmDelete');
      scene.onSelect();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Delete with Confirmation (Requirement 3.4)', () => {
    beforeEach(() => {
      scene.create();
      scene.replayManager._addReplay(createMockReplay({ id: 'replay1', songId: 'tutorial' }));
      scene.replayManager._addReplay(createMockReplay({ id: 'replay2', songId: 'bopeebo' }));
      scene.loadReplays();
    });

    it('should show delete confirmation on delete key', () => {
      scene.onDelete();
      expect(scene.showingDeleteConfirm).toBe(true);
    });

    it('should not show delete confirmation when transitioning', () => {
      scene.transitioning = true;
      scene.onDelete();
      expect(scene.showingDeleteConfirm).toBe(false);
    });

    it('should not show delete confirmation when no replays', () => {
      scene.filteredReplays = [];
      scene.onDelete();
      expect(scene.showingDeleteConfirm).toBe(false);
    });

    it('should cancel delete on back when showing confirmation', () => {
      scene.showingDeleteConfirm = true;
      scene.onBack();
      expect(scene.showingDeleteConfirm).toBe(false);
    });

    it('should delete replay on confirm', () => {
      const initialCount = scene.filteredReplays.length;
      scene.showDeleteConfirmation();
      scene.confirmDelete();

      expect(scene.showingDeleteConfirm).toBe(false);
      expect(scene.filteredReplays.length).toBe(initialCount - 1);
    });

    it('should cancel delete properly', () => {
      scene.showDeleteConfirmation();
      scene.cancelDelete();

      expect(scene.showingDeleteConfirm).toBe(false);
    });

    it('should handle delete when no replay selected', () => {
      scene.filteredReplays = [];
      scene.showDeleteConfirmation();
      scene.confirmDelete();

      expect(scene.showingDeleteConfirm).toBe(false);
    });
  });

  describe('Song Filter (Requirement 3.5)', () => {
    beforeEach(() => {
      scene.create();
      scene.replayManager._addReplay(createMockReplay({ songId: 'tutorial', timestamp: 1000 }));
      scene.replayManager._addReplay(createMockReplay({ songId: 'bopeebo', timestamp: 2000 }));
      scene.replayManager._addReplay(createMockReplay({ songId: 'tutorial', timestamp: 3000 }));
      scene.loadReplays();
    });

    it('should show all replays when filter is null', () => {
      scene.songFilter = null;
      scene.applyFilter();
      expect(scene.filteredReplays.length).toBe(3);
    });

    it('should filter replays by song', () => {
      scene.songFilter = 'tutorial';
      scene.applyFilter();
      expect(scene.filteredReplays.length).toBe(2);
      scene.filteredReplays.forEach(r => {
        expect(r.songId).toBe('tutorial');
      });
    });

    it('should cycle filter right', () => {
      expect(scene.songFilterIndex).toBe(0);
      scene.onFilterRight();
      expect(scene.songFilterIndex).toBe(1);
    });

    it('should cycle filter left', () => {
      scene.songFilterIndex = 1;
      scene.onFilterLeft();
      expect(scene.songFilterIndex).toBe(0);
    });

    it('should wrap filter index when cycling right', () => {
      scene.songFilterIndex = scene.availableSongs.length - 1;
      scene.onFilterRight();
      expect(scene.songFilterIndex).toBe(0);
    });

    it('should wrap filter index when cycling left', () => {
      scene.songFilterIndex = 0;
      scene.onFilterLeft();
      expect(scene.songFilterIndex).toBe(scene.availableSongs.length - 1);
    });

    it('should not filter when transitioning', () => {
      scene.transitioning = true;
      const initialIndex = scene.songFilterIndex;
      scene.onFilterRight();
      expect(scene.songFilterIndex).toBe(initialIndex);
    });

    it('should not filter when showing delete confirmation', () => {
      scene.showingDeleteConfirm = true;
      const initialIndex = scene.songFilterIndex;
      scene.onFilterRight();
      expect(scene.songFilterIndex).toBe(initialIndex);
    });

    it('should clamp selected index when filter reduces list', () => {
      scene.selectedIndex = 2;
      scene.songFilter = 'bopeebo';
      scene.applyFilter();
      expect(scene.selectedIndex).toBeLessThanOrEqual(scene.filteredReplays.length - 1);
    });
  });

  describe('Empty State (Requirement 3.6)', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should have empty state text element', () => {
      expect(scene.emptyStateText).not.toBeNull();
    });

    it('should show empty state when no replays', () => {
      scene.filteredReplays = [];
      scene.updateDisplay();
      expect(scene.emptyStateText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should hide empty state when replays exist', () => {
      scene.replayManager._addReplay(createMockReplay());
      scene.loadReplays();
      scene.updateDisplay();
      expect(scene.emptyStateText.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Date Formatting', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should format date correctly', () => {
      // January 15, 2024 at 14:30
      const timestamp = new Date(2024, 0, 15, 14, 30).getTime();
      const formatted = scene.formatDate(timestamp);
      expect(formatted).toBe('01/15/2024 14:30');
    });

    it('should pad single digit months and days', () => {
      // March 5, 2024 at 09:05
      const timestamp = new Date(2024, 2, 5, 9, 5).getTime();
      const formatted = scene.formatDate(timestamp);
      expect(formatted).toBe('03/05/2024 09:05');
    });
  });

  describe('Back Navigation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should set transitioning on back', () => {
      scene.onBack();
      expect(scene.transitioning).toBe(true);
    });

    it('should cancel delete instead of going back when showing confirmation', () => {
      scene.showingDeleteConfirm = true;
      scene.onBack();
      expect(scene.showingDeleteConfirm).toBe(false);
      expect(scene.transitioning).toBe(false);
    });

    it('should not go back when already transitioning', () => {
      scene.transitioning = true;
      const startSpy = vi.spyOn(scene.scene, 'start');
      scene.onBack();
      // Should not trigger another transition
      expect(startSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.create();
      scene.replayManager._addReplay(createMockReplay());
      scene.loadReplays();

      scene.shutdown();

      expect(scene.replayDisplays.length).toBe(0);
      expect(scene.allReplays.length).toBe(0);
      expect(scene.filteredReplays.length).toBe(0);
      expect(scene.replayManager).toBeNull();
    });

    it('should remove keyboard listeners on shutdown', () => {
      scene.create();
      scene.shutdown();

      expect(scene.input.keyboard.off).toHaveBeenCalled();
    });
  });

  describe('Scroll Offset', () => {
    beforeEach(() => {
      scene.create();
      // Add more replays than visible entries
      for (let i = 0; i < 15; i++) {
        scene.replayManager._addReplay(createMockReplay({ songId: `song${i}`, timestamp: i * 1000 }));
      }
      scene.loadReplays();
    });

    it('should update scroll offset when navigating', () => {
      // Navigate to bottom
      for (let i = 0; i < 10; i++) {
        scene.onNavigateDown();
      }
      expect(scene.scrollOffset).toBeGreaterThan(0);
    });

    it('should keep selected item visible', () => {
      scene.selectedIndex = 10;
      scene.updateScrollOffset();

      const visibleStart = scene.scrollOffset;
      const visibleEnd = scene.scrollOffset + scene.visibleEntries;

      expect(scene.selectedIndex).toBeGreaterThanOrEqual(visibleStart);
      expect(scene.selectedIndex).toBeLessThan(visibleEnd);
    });
  });

  describe('Input Setup', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should register keyboard listeners', () => {
      expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown-UP', expect.any(Function), scene);
      expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown-DOWN', expect.any(Function), scene);
      expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown-LEFT', expect.any(Function), scene);
      expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown-RIGHT', expect.any(Function), scene);
      expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown-ENTER', expect.any(Function), scene);
      expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown-DELETE', expect.any(Function), scene);
      expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown-ESC', expect.any(Function), scene);
    });
  });

  describe('Sound Effects', () => {
    beforeEach(() => {
      scene.create();
      scene.cache.audio.exists = vi.fn(() => true);
    });

    it('should play scroll sound on navigation', () => {
      scene.replayManager._addReplay(createMockReplay());
      scene.loadReplays();
      scene.onNavigateDown();
      expect(scene.sound.play).toHaveBeenCalledWith('scroll-sound', { volume: 0.5 });
    });

    it('should play confirm sound on select', () => {
      scene.replayManager._addReplay(createMockReplay());
      scene.loadReplays();
      scene.onSelect();
      expect(scene.sound.play).toHaveBeenCalledWith('confirm-sound');
    });

    it('should play cancel sound on back', () => {
      scene.onBack();
      expect(scene.sound.play).toHaveBeenCalledWith('cancel-sound');
    });
  });

  describe('Replay Playback', () => {
    beforeEach(() => {
      scene.create();
      scene.replayManager._addReplay(createMockReplay({
        id: 'test-replay',
        songId: 'tutorial',
        difficulty: 'hard'
      }));
      scene.loadReplays();
    });

    it('should start replay playback with correct parameters', () => {
      const replay = scene.filteredReplays[0];
      scene.startReplayPlayback(replay);

      // Camera fade out triggers scene start
      expect(scene.cameras.main.fadeOut).toHaveBeenCalled();
      expect(scene.scene.start).toHaveBeenCalledWith('PlayState', {
        songId: replay.songId,
        difficulty: replay.difficulty,
        replayId: replay.id,
        isReplay: true
      });
    });
  });
});

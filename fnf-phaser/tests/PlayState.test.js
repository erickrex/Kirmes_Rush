/**
 * @fileoverview Tests for PlayState - Main gameplay scene
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Setup Phaser mock BEFORE any imports that use it
vi.stubGlobal('Phaser', {
  GameObjects: {
    Sprite: class MockSprite {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.visible = true;
        this.alpha = 1;
      }
      setOrigin() {
        return this;
      }
      setScale() {
        return this;
      }
      setPosition() {
        return this;
      }
      setVisible() {
        return this;
      }
      setAlpha() {
        return this;
      }
      destroy() {}
    },
    Graphics: class MockGraphics {
      constructor() {}
      clear() {
        return this;
      }
      fillStyle() {
        return this;
      }
      fillTriangle() {
        return this;
      }
      fillRect() {
        return this;
      }
      destroy() {}
    }
  },
  Events: {
    EventEmitter: class MockEventEmitter {
      constructor() {
        this.listeners = {};
      }
      on(event, fn) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(fn);
        return this;
      }
      off(event, fn) {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
        }
        return this;
      }
      emit(event, ...args) {
        if (this.listeners[event]) {
          this.listeners[event].forEach((fn) => fn(...args));
        }
        return this;
      }
      once(event, fn) {
        const wrapper = (...args) => {
          fn(...args);
          this.off(event, wrapper);
        };
        return this.on(event, wrapper);
      }
      removeAllListeners() {
        this.listeners = {};
        return this;
      }
    }
  },
  Math: {
    Clamp: (value, min, max) => Math.min(Math.max(value, min), max)
  }
});

// Mock Conductor
const mockConductor = {
  songPosition: 0,
  beatLengthMs: 500,
  stepLengthMs: 125,
  currentStep: 0,
  currentBeat: 0,
  mapTimeChanges: vi.fn(),
  update: vi.fn(),
  reset: vi.fn()
};

vi.mock('../src/core/Conductor.js', () => ({
  default: {
    instance: mockConductor
  }
}));

// Mock EventBus
vi.mock('../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  Events: {
    NOTE_HIT: 'noteHit',
    NOTE_MISS: 'noteMiss',
    OPPONENT_NOTE_HIT: 'opponentNoteHit',
    SONG_START: 'songStart',
    SONG_END: 'songEnd',
    COUNTDOWN_START: 'countdownStart',
    COUNTDOWN_STEP: 'countdownStep',
    PAUSE: 'pause',
    RESUME: 'resume',
    GAME_OVER: 'gameOver',
    REPLAY_START: 'replayStart',
    REPLAY_STOP: 'replayStop'
  }
}));

// Mock AnimationRegistrar
const mockRegisterCharacterAnimations = vi.fn();
const mockRegisterPropAnimations = vi.fn();
vi.mock('../src/graphics/AnimationRegistrar.js', () => ({
  registerCharacterAnimations: (...args) => mockRegisterCharacterAnimations(...args),
  registerPropAnimations: (...args) => mockRegisterPropAnimations(...args)
}));

// Now import after mocks are set up
const { default: PlayState } = await import('../src/play/PlayState.js');
const { default: Conductor } = await import('../src/core/Conductor.js');
const { default: EventBus, Events } = await import('../src/core/EventBus.js');
const Constants = await import('../src/core/Constants.js');

// Mock scene
const createMockScene = () => ({
  cameras: {
    main: { setScroll: vi.fn() },
    add: vi.fn(() => ({ setScroll: vi.fn() }))
  },
  scale: { width: 1280, height: 720 },
  time: {
    delayedCall: vi.fn((delay, callback) => {
      // Execute immediately for testing
      callback();
    })
  },
  textures: {
    exists: vi.fn(() => true)
  },
  anims: {
    exists: vi.fn(() => true)
  }
});

// Mock strumline
const createMockStrumline = () => ({
  setPosition: vi.fn().mockReturnThis(),
  applyNoteData: vi.fn(),
  update: vi.fn(),
  pressKey: vi.fn(),
  releaseKey: vi.fn(),
  playStatic: vi.fn(),
  playPress: vi.fn(),
  hitNote: vi.fn(),
  getClosestNote: vi.fn(() => null),
  notes: [],
  destroy: vi.fn()
});

describe('PlayState', () => {
  let playState;
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = createMockScene();
    playState = new PlayState(mockScene);
  });

  afterEach(() => {
    playState.destroy();
  });

  describe('constructor', () => {
    it('should initialize with scene', () => {
      expect(playState.scene).toBe(mockScene);
    });

    it('should get conductor instance', () => {
      expect(playState.conductor).toBeDefined();
    });

    it('should initialize with default values', () => {
      expect(playState.health).toBe(Constants.HEALTH_STARTING);
      expect(playState.score).toBe(0);
      expect(playState.combo).toBe(0);
      expect(playState.songStarted).toBe(false);
    });
  });

  describe('init', () => {
    it('should initialize with config', () => {
      const config = {
        song: { name: 'test' },
        difficulty: 'hard',
        startTimestamp: 1000
      };

      playState.init(config);

      expect(playState.songData).toEqual({ name: 'test' });
      expect(playState.difficulty).toBe('hard');
      expect(playState.startTimestamp).toBe(1000);
    });

    it('should use default difficulty', () => {
      playState.init({ song: {} });
      expect(playState.difficulty).toBe(Constants.DEFAULT_DIFFICULTY);
    });

    it('should map time changes from chart', () => {
      const config = {
        song: {},
        chart: {
          timeChanges: [{ timeStamp: 0, bpm: 120 }]
        }
      };

      playState.init(config);

      expect(Conductor.instance.mapTimeChanges).toHaveBeenCalledWith(config.chart.timeChanges);
    });

    it('should count total notes', () => {
      const config = {
        song: {},
        chart: {
          notes: {
            player: [{ time: 0 }, { time: 100 }, { time: 200 }]
          }
        }
      };

      playState.init(config);

      expect(playState.tallies.totalNotes).toBe(3);
    });

    it('should reset state', () => {
      playState.score = 1000;
      playState.combo = 50;

      playState.init({ song: {} });

      expect(playState.score).toBe(0);
      expect(playState.combo).toBe(0);
    });
  });

  describe('resetState', () => {
    it('should reset all gameplay values', () => {
      playState.health = 0.5;
      playState.score = 5000;
      playState.combo = 100;
      playState.maxCombo = 150;
      playState.songStarted = true;

      playState.resetState();

      expect(playState.health).toBe(Constants.HEALTH_STARTING);
      expect(playState.score).toBe(0);
      expect(playState.combo).toBe(0);
      expect(playState.maxCombo).toBe(0);
      expect(playState.songStarted).toBe(false);
    });

    it('should reset tallies', () => {
      playState.tallies.sick = 10;
      playState.tallies.missed = 5;

      playState.resetState();

      expect(playState.tallies.sick).toBe(0);
      expect(playState.tallies.missed).toBe(0);
    });

    it('should clear input queues', () => {
      playState.inputPressQueue = [{ direction: 0 }];
      playState.inputReleaseQueue = [{ direction: 1 }];

      playState.resetState();

      expect(playState.inputPressQueue).toEqual([]);
      expect(playState.inputReleaseQueue).toEqual([]);
    });
  });

  describe('setupCameras', () => {
    it('should setup game and HUD cameras', () => {
      playState.setupCameras();

      expect(playState.camGame).toBe(mockScene.cameras.main);
      expect(playState.camHUD).toBeDefined();
      expect(mockScene.cameras.add).toHaveBeenCalled();
    });
  });

  describe('generateNotes', () => {
    it('should apply note data to strumlines', () => {
      const playerStrumline = createMockStrumline();
      const opponentStrumline = createMockStrumline();

      playState.playerStrumline = playerStrumline;
      playState.opponentStrumline = opponentStrumline;
      playState.chart = {
        notes: {
          player: [{ time: 0, direction: 0 }],
          opponent: [{ time: 100, direction: 1 }]
        }
      };

      playState.generateNotes();

      expect(playerStrumline.applyNoteData).toHaveBeenCalledWith(playState.chart.notes.player);
      expect(opponentStrumline.applyNoteData).toHaveBeenCalledWith(playState.chart.notes.opponent);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      playState.playerStrumline = createMockStrumline();
      playState.opponentStrumline = createMockStrumline();
    });

    it('should update song position from audio', () => {
      playState.audioManager = { isPlaying: true, currentTime: 5000 };

      playState.update(0, 16);

      expect(playState.songPosition).toBe(5000);
    });

    it('should update conductor', () => {
      playState.songPosition = 1000;

      playState.update(0, 16);

      expect(Conductor.instance.update).toHaveBeenCalledWith(1000);
    });

    it('should update strumlines', () => {
      playState.songPosition = 1000;

      playState.update(0, 16);

      expect(playState.playerStrumline.update).toHaveBeenCalledWith(1000);
      expect(playState.opponentStrumline.update).toHaveBeenCalledWith(1000);
    });
  });

  describe('handleNoteInput', () => {
    beforeEach(() => {
      playState.playerStrumline = createMockStrumline();
    });

    it('should press key on strumline', () => {
      playState.handleNoteInput(0, 1000);

      expect(playState.playerStrumline.pressKey).toHaveBeenCalledWith(0);
    });

    it('should hit note if within hit window', () => {
      const mockNote = { strumTime: 1000, hasBeenHit: false };
      playState.playerStrumline.getClosestNote = vi.fn(() => mockNote);
      playState.songPosition = 1000;

      playState.handleNoteInput(0, 1000);

      expect(playState.playerStrumline.hitNote).toHaveBeenCalledWith(mockNote);
    });

    it('should ghost miss if no note', () => {
      playState.playerStrumline.getClosestNote = vi.fn(() => null);

      playState.handleNoteInput(0, 1000);

      expect(playState.playerStrumline.playPress).toHaveBeenCalledWith(0);
    });
  });

  describe('handleNoteRelease', () => {
    beforeEach(() => {
      playState.playerStrumline = createMockStrumline();
    });

    it('should release key on strumline', () => {
      playState.handleNoteRelease(0, 1000);

      expect(playState.playerStrumline.releaseKey).toHaveBeenCalledWith(0);
      expect(playState.playerStrumline.playStatic).toHaveBeenCalledWith(0);
    });
  });

  describe('hitNote', () => {
    beforeEach(() => {
      playState.playerStrumline = createMockStrumline();
    });

    it('should update score', () => {
      const note = { strumTime: 1000 };

      playState.hitNote(note, 0); // Perfect timing

      expect(playState.score).toBeGreaterThan(0);
    });

    it('should update combo', () => {
      const note = { strumTime: 1000 };

      playState.hitNote(note, 0);

      expect(playState.combo).toBe(1);
    });

    it('should update max combo', () => {
      const note = { strumTime: 1000 };

      playState.hitNote(note, 0);
      playState.hitNote(note, 0);
      playState.hitNote(note, 0);

      expect(playState.maxCombo).toBe(3);
    });

    it('should update tallies', () => {
      const note = { strumTime: 1000 };

      playState.hitNote(note, 0); // Perfect timing = killer judgement (counts as sick)

      expect(playState.tallies.sick).toBe(1);
      expect(playState.tallies.totalNotesHit).toBe(1);
    });

    it('should update health', () => {
      const note = { strumTime: 1000 };
      const initialHealth = playState.health;

      playState.hitNote(note, 0);

      expect(playState.health).toBeGreaterThan(initialHealth);
    });

    it('should emit NOTE_HIT event', () => {
      const note = { strumTime: 1000 };

      playState.hitNote(note, 0);

      expect(EventBus.emit).toHaveBeenCalledWith(Events.NOTE_HIT, expect.objectContaining({ note }));
    });

    it('should call onNoteHit callback', () => {
      const callback = vi.fn();
      playState.onNoteHit = callback;
      const note = { strumTime: 1000 };

      playState.hitNote(note, 0);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('missNote', () => {
    beforeEach(() => {
      playState.playerStrumline = createMockStrumline();
    });

    it('should mark note as missed', () => {
      const note = { strumTime: 1000 };

      playState.missNote(note);

      expect(note.hasMissed).toBe(true);
      expect(note.handledMiss).toBe(true);
    });

    it('should reset combo', () => {
      playState.combo = 50;

      playState.missNote({ strumTime: 1000 });

      expect(playState.combo).toBe(0);
    });

    it('should update tallies', () => {
      playState.missNote({ strumTime: 1000 });

      expect(playState.tallies.missed).toBe(1);
    });

    it('should reduce health', () => {
      const initialHealth = playState.health;

      playState.missNote({ strumTime: 1000 });

      expect(playState.health).toBeLessThan(initialHealth);
    });

    it('should mute player vocals', () => {
      const mockVoices = { mutePlayer: vi.fn() };
      playState.voices = mockVoices;

      playState.missNote({ strumTime: 1000 });

      expect(mockVoices.mutePlayer).toHaveBeenCalled();
    });

    it('should emit NOTE_MISS event', () => {
      const note = { strumTime: 1000 };

      playState.missNote(note);

      expect(EventBus.emit).toHaveBeenCalledWith(Events.NOTE_MISS, { note });
    });
  });

  describe('checkMissedNotes', () => {
    beforeEach(() => {
      playState.playerStrumline = createMockStrumline();
    });

    it('should miss notes past hit window', () => {
      const note = {
        strumTime: 0,
        alive: true,
        hasBeenHit: false,
        hasMissed: false
      };
      playState.playerStrumline.notes = [note];
      playState.songPosition = Constants.HIT_WINDOW_MS + 100;

      playState.checkMissedNotes();

      expect(note.hasMissed).toBe(true);
    });

    it('should not miss notes within hit window', () => {
      const note = {
        strumTime: 1000,
        alive: true,
        hasBeenHit: false,
        hasMissed: false
      };
      playState.playerStrumline.notes = [note];
      playState.songPosition = 1000;

      playState.checkMissedNotes();

      expect(note.hasMissed).toBeFalsy();
    });

    it('should not miss already hit notes', () => {
      const note = {
        strumTime: 0,
        alive: true,
        hasBeenHit: true,
        hasMissed: false
      };
      playState.playerStrumline.notes = [note];
      playState.songPosition = 1000;

      playState.checkMissedNotes();

      expect(note.hasMissed).toBe(false);
    });
  });

  describe('countdown', () => {
    it('should start countdown', () => {
      // Don't use immediate execution for this test
      mockScene.time.delayedCall = vi.fn();

      playState.startCountdown();

      // countdownActive should be true since we didn't execute the final step
      expect(playState.countdownActive).toBe(true);
      expect(EventBus.emit).toHaveBeenCalledWith(Events.COUNTDOWN_START);
    });

    it('should execute countdown steps', () => {
      const callback = vi.fn();
      playState.onCountdownStep = callback;

      // Use immediate execution
      mockScene.time.delayedCall = vi.fn((delay, cb) => cb());

      playState.startCountdown();

      // All steps should have been called due to immediate execution in mock
      expect(callback).toHaveBeenCalled();
    });

    it('should start song after countdown', () => {
      playState.audioManager = { play: vi.fn() };

      // Use immediate execution
      mockScene.time.delayedCall = vi.fn((delay, cb) => cb());

      playState.startCountdown();

      expect(playState.songStarted).toBe(true);
      expect(EventBus.emit).toHaveBeenCalledWith(Events.SONG_START);
    });
  });

  describe('startSong', () => {
    it('should start audio', () => {
      const mockAudio = { play: vi.fn() };
      playState.audioManager = mockAudio;
      playState.startTimestamp = 1000;

      playState.startSong();

      expect(mockAudio.play).toHaveBeenCalledWith(1000);
    });

    it('should set songStarted flag', () => {
      playState.startSong();

      expect(playState.songStarted).toBe(true);
    });

    it('should emit SONG_START event', () => {
      playState.startSong();

      expect(EventBus.emit).toHaveBeenCalledWith(Events.SONG_START);
    });
  });

  describe('endSong', () => {
    it('should stop audio', () => {
      const mockAudio = { stop: vi.fn() };
      playState.audioManager = mockAudio;

      playState.endSong();

      expect(mockAudio.stop).toHaveBeenCalled();
    });

    it('should set songStarted to false', () => {
      playState.songStarted = true;

      playState.endSong();

      expect(playState.songStarted).toBe(false);
    });

    it('should emit SONG_END event with results', () => {
      playState.score = 5000;
      playState.tallies.sick = 10;

      playState.endSong();

      expect(EventBus.emit).toHaveBeenCalledWith(
        Events.SONG_END,
        expect.objectContaining({
          score: 5000,
          tallies: expect.any(Object)
        })
      );
    });

    it('should call onSongEnd callback', () => {
      const callback = vi.fn();
      playState.onSongEnd = callback;

      playState.endSong();

      expect(callback).toHaveBeenCalled();
    });

    it('should include timingStats in SONG_END payload when InputStatistics exists', () => {
      // Enable competitive stats
      playState.levelSystem = null; // freeplay → enabled
      playState.init({ song: {} });

      // Record some hits
      playState.inputStatistics.recordHit(-5, 'sick');
      playState.inputStatistics.recordHit(3, 'good');

      playState.endSong();

      expect(EventBus.emit).toHaveBeenCalledWith(
        Events.SONG_END,
        expect.objectContaining({
          timingStats: expect.objectContaining({
            offsets: [-5, 3],
            averageOffset: expect.any(Number)
          })
        })
      );
    });

    it('should include timingStats as null in SONG_END payload when InputStatistics is null', () => {
      // Disable competitive stats
      playState.levelSystem = {
        isFeatureEnabled: (name) => false
      };
      playState.init({ song: {} });

      playState.endSong();

      expect(EventBus.emit).toHaveBeenCalledWith(
        Events.SONG_END,
        expect.objectContaining({
          timingStats: null
        })
      );
    });

    it('should pass timingStats to onSongEnd callback', () => {
      const callback = vi.fn();
      playState.levelSystem = null;
      playState.init({ song: {} });
      playState.onSongEnd = callback;

      playState.inputStatistics.recordHit(-2, 'sick');
      playState.endSong();

      // onSongEnd(score, tallies, rank, replayData, timingStats)
      // Verify the 5th argument (timingStats) contains the recorded offset
      const callArgs = callback.mock.calls[0];
      expect(callArgs).toHaveLength(5);
      expect(callArgs[4]).toEqual(expect.objectContaining({
        offsets: [-2]
      }));
    });
  });

  describe('pause/resume', () => {
    it('should pause audio', () => {
      const mockAudio = { pause: vi.fn() };
      playState.audioManager = mockAudio;

      playState.pause();

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(EventBus.emit).toHaveBeenCalledWith(Events.PAUSE);
    });

    it('should resume audio', () => {
      const mockAudio = { resume: vi.fn() };
      playState.audioManager = mockAudio;

      playState.resume();

      expect(mockAudio.resume).toHaveBeenCalled();
      expect(EventBus.emit).toHaveBeenCalledWith(Events.RESUME);
    });
  });

  describe('getHealthBonus', () => {
    it('should return correct bonus for each judgement', () => {
      expect(playState.getHealthBonus('killer')).toBe(Constants.HEALTH_KILLER_BONUS);
      expect(playState.getHealthBonus('sick')).toBe(Constants.HEALTH_SICK_BONUS);
      expect(playState.getHealthBonus('good')).toBe(Constants.HEALTH_GOOD_BONUS);
      expect(playState.getHealthBonus('bad')).toBe(Constants.HEALTH_BAD_BONUS);
      expect(playState.getHealthBonus('shit')).toBe(Constants.HEALTH_SHIT_BONUS);
    });

    it('should return 0 for unknown judgement', () => {
      expect(playState.getHealthBonus('unknown')).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      playState.playerStrumline = createMockStrumline();
      playState.opponentStrumline = createMockStrumline();

      playState.destroy();

      expect(playState.playerStrumline).toBeNull();
      expect(playState.opponentStrumline).toBeNull();
      expect(playState.scene).toBeNull();
    });

    it('should clean up characters', () => {
      const mockPlayer = { destroy: vi.fn() };
      const mockOpponent = { destroy: vi.fn() };
      const mockGirlfriend = { destroy: vi.fn() };

      playState.player = mockPlayer;
      playState.opponent = mockOpponent;
      playState.girlfriend = mockGirlfriend;

      playState.destroy();

      expect(mockPlayer.destroy).toHaveBeenCalled();
      expect(mockOpponent.destroy).toHaveBeenCalled();
      expect(mockGirlfriend.destroy).toHaveBeenCalled();
      expect(playState.player).toBeNull();
      expect(playState.opponent).toBeNull();
      expect(playState.girlfriend).toBeNull();
    });

    it('should clean up stage', () => {
      const mockStage = { destroy: vi.fn() };
      playState.stage = mockStage;

      playState.destroy();

      expect(mockStage.destroy).toHaveBeenCalled();
      expect(playState.stage).toBeNull();
    });

    it('should clean up camera', () => {
      const mockCamera = { destroy: vi.fn() };
      playState.funkinCamera = mockCamera;

      playState.destroy();

      expect(mockCamera.destroy).toHaveBeenCalled();
      expect(playState.funkinCamera).toBeNull();
    });
  });

  // ========================================
  // CHARACTER INTEGRATION TESTS (Task 4.3)
  // ========================================

  describe('character integration', () => {
    describe('getCharacter', () => {
      beforeEach(() => {
        playState.player = { id: 'bf', destroy: vi.fn() };
        playState.opponent = { id: 'dad', destroy: vi.fn() };
        playState.girlfriend = { id: 'gf', destroy: vi.fn() };
      });

      it('should return player for bf', () => {
        expect(playState.getCharacter('bf')).toBe(playState.player);
        expect(playState.getCharacter('player')).toBe(playState.player);
      });

      it('should return opponent for dad', () => {
        expect(playState.getCharacter('dad')).toBe(playState.opponent);
        expect(playState.getCharacter('opponent')).toBe(playState.opponent);
      });

      it('should return girlfriend for gf', () => {
        expect(playState.getCharacter('gf')).toBe(playState.girlfriend);
        expect(playState.getCharacter('girlfriend')).toBe(playState.girlfriend);
      });

      it('should return null for unknown type', () => {
        expect(playState.getCharacter('unknown')).toBeNull();
      });
    });

    describe('hitNote with character animation', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.player = { sing: vi.fn(), destroy: vi.fn() };
        playState.voices = { unmutePlayer: vi.fn() };
      });

      it('should trigger player sing animation', () => {
        const note = { strumTime: 1000, direction: 2 };

        playState.hitNote(note, 0);

        expect(playState.player.sing).toHaveBeenCalledWith(2);
      });

      it('should unmute player vocals', () => {
        const note = { strumTime: 1000, direction: 0 };

        playState.hitNote(note, 0);

        expect(playState.voices.unmutePlayer).toHaveBeenCalled();
      });
    });

    describe('missNote with character animation', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.player = { miss: vi.fn(), destroy: vi.fn() };
      });

      it('should trigger player miss animation', () => {
        const note = { strumTime: 1000, direction: 1 };

        playState.missNote(note);

        expect(playState.player.miss).toHaveBeenCalledWith(1);
      });
    });

    describe('opponent notes', () => {
      beforeEach(() => {
        playState.opponentStrumline = createMockStrumline();
        playState.opponent = { sing: vi.fn(), destroy: vi.fn() };
      });

      it('should auto-hit opponent notes', () => {
        const note = {
          strumTime: 100,
          direction: 0,
          alive: true,
          hasBeenHit: false
        };
        playState.opponentStrumline.notes = [note];
        playState.songPosition = 200;

        playState.processOpponentNotes();

        expect(note.hasBeenHit).toBe(true);
      });

      it('should trigger opponent sing animation', () => {
        const note = {
          strumTime: 100,
          direction: 2,
          alive: true,
          hasBeenHit: false
        };
        playState.opponentStrumline.notes = [note];
        playState.songPosition = 200;

        playState.processOpponentNotes();

        expect(playState.opponent.sing).toHaveBeenCalledWith(2);
      });

      it('should not re-hit already hit notes', () => {
        const note = {
          strumTime: 100,
          direction: 0,
          alive: true,
          hasBeenHit: true
        };
        playState.opponentStrumline.notes = [note];
        playState.songPosition = 200;

        playState.processOpponentNotes();

        expect(playState.opponent.sing).not.toHaveBeenCalled();
      });
    });
  });

  describe('camera focus', () => {
    beforeEach(() => {
      playState.player = {
        getCameraFocusPoint: vi.fn(() => ({ x: 800, y: 400 })),
        destroy: vi.fn()
      };
      playState.opponent = {
        getCameraFocusPoint: vi.fn(() => ({ x: 200, y: 300 })),
        destroy: vi.fn()
      };
      playState.girlfriend = {
        getCameraFocusPoint: vi.fn(() => ({ x: 500, y: 350 })),
        destroy: vi.fn()
      };
      playState.funkinCamera = {
        setFollowTarget: vi.fn(),
        destroy: vi.fn()
      };
    });

    it('should focus on opponent (target 0)', () => {
      playState.focusCamera(0);

      expect(playState.cameraFocusTarget).toBe(0);
      expect(playState.opponent.getCameraFocusPoint).toHaveBeenCalled();
      expect(playState.funkinCamera.setFollowTarget).toHaveBeenCalledWith(200, 300, false);
    });

    it('should focus on player (target 1)', () => {
      playState.focusCamera(1);

      expect(playState.cameraFocusTarget).toBe(1);
      expect(playState.player.getCameraFocusPoint).toHaveBeenCalled();
      expect(playState.funkinCamera.setFollowTarget).toHaveBeenCalledWith(800, 400, false);
    });

    it('should focus on girlfriend (target 2)', () => {
      playState.focusCamera(2);

      expect(playState.cameraFocusTarget).toBe(2);
      expect(playState.girlfriend.getCameraFocusPoint).toHaveBeenCalled();
      expect(playState.funkinCamera.setFollowTarget).toHaveBeenCalledWith(500, 350, false);
    });

    it('should snap instantly when requested', () => {
      playState.focusCamera(1, true);

      expect(playState.funkinCamera.setFollowTarget).toHaveBeenCalledWith(800, 400, true);
    });

    it('should apply stage camera offset', () => {
      playState.stage = {
        getCameraOffset: vi.fn(() => ({ x: 50, y: -25 })),
        destroy: vi.fn()
      };

      playState.focusCamera(1);

      expect(playState.funkinCamera.setFollowTarget).toHaveBeenCalledWith(850, 375, false);
    });
  });

  describe('beat/step sync', () => {
    beforeEach(() => {
      playState.player = { onBeatHit: vi.fn(), onStepHit: vi.fn(), destroy: vi.fn() };
      playState.opponent = { onBeatHit: vi.fn(), onStepHit: vi.fn(), destroy: vi.fn() };
      playState.girlfriend = { onBeatHit: vi.fn(), onStepHit: vi.fn(), destroy: vi.fn() };
      playState.stage = { onBeatHit: vi.fn(), onStepHit: vi.fn(), destroy: vi.fn() };
      playState.funkinCamera = { onBeatHit: vi.fn(), destroy: vi.fn() };
    });

    it('should call onBeatHit on all characters', () => {
      playState.onBeatHit(4);

      expect(playState.player.onBeatHit).toHaveBeenCalledWith(4);
      expect(playState.opponent.onBeatHit).toHaveBeenCalledWith(4);
      expect(playState.girlfriend.onBeatHit).toHaveBeenCalledWith(4);
    });

    it('should call onBeatHit on stage', () => {
      playState.onBeatHit(4);

      expect(playState.stage.onBeatHit).toHaveBeenCalledWith(4);
    });

    it('should call onBeatHit on camera', () => {
      playState.onBeatHit(4);

      expect(playState.funkinCamera.onBeatHit).toHaveBeenCalledWith(4);
    });

    it('should call onStepHit on all characters', () => {
      playState.onStepHit(16);

      expect(playState.player.onStepHit).toHaveBeenCalledWith(16);
      expect(playState.opponent.onStepHit).toHaveBeenCalledWith(16);
      expect(playState.girlfriend.onStepHit).toHaveBeenCalledWith(16);
    });

    it('should call onStepHit on stage', () => {
      playState.onStepHit(16);

      expect(playState.stage.onStepHit).toHaveBeenCalledWith(16);
    });
  });

  describe('camera events', () => {
    beforeEach(() => {
      playState.funkinCamera = {
        setZoom: vi.fn(),
        setFollowTarget: vi.fn(),
        destroy: vi.fn()
      };
      playState.player = { getCameraFocusPoint: vi.fn(() => ({ x: 0, y: 0 })), destroy: vi.fn() };
      playState.opponent = { getCameraFocusPoint: vi.fn(() => ({ x: 0, y: 0 })), destroy: vi.fn() };
    });

    it('should handle FocusCamera event', () => {
      playState.handleFocusCameraEvent({ char: 1 });

      expect(playState.cameraFocusTarget).toBe(1);
    });

    it('should handle ZoomCamera event', () => {
      playState.handleZoomCameraEvent({ zoom: 1.2, instant: false });

      expect(playState.funkinCamera.setZoom).toHaveBeenCalledWith(1.2, false);
    });

    it('should handle ZoomCamera event with instant', () => {
      playState.handleZoomCameraEvent({ zoom: 0.8, instant: true });

      expect(playState.funkinCamera.setZoom).toHaveBeenCalledWith(0.8, true);
    });
  });

  // ========================================
  // REPLAY RECORDING INTEGRATION TESTS (Task 13.1)
  // ========================================

  describe('replay recording integration', () => {
    describe('setReplayRecordingEnabled', () => {
      it('should enable replay recording', () => {
        playState.setReplayRecordingEnabled(true);

        expect(playState.replayRecordingEnabled).toBe(true);
        expect(playState.replayRecorder).not.toBeNull();
      });

      it('should disable replay recording', () => {
        playState.setReplayRecordingEnabled(true);
        playState.setReplayRecordingEnabled(false);

        expect(playState.replayRecordingEnabled).toBe(false);
      });

      it('should create ReplayRecorder instance when enabled', () => {
        playState.setReplayRecordingEnabled(true);

        expect(playState.replayRecorder).toBeDefined();
        expect(typeof playState.replayRecorder.start).toBe('function');
        expect(typeof playState.replayRecorder.recordInput).toBe('function');
        expect(typeof playState.replayRecorder.stop).toBe('function');
        expect(typeof playState.replayRecorder.discard).toBe('function');
      });

      it('should not create new ReplayRecorder if already exists', () => {
        playState.setReplayRecordingEnabled(true);
        const firstRecorder = playState.replayRecorder;
        playState.setReplayRecordingEnabled(true);

        expect(playState.replayRecorder).toBe(firstRecorder);
      });
    });

    describe('startSong with replay recording', () => {
      beforeEach(() => {
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'test-song', name: 'Test Song' };
        playState.difficulty = 'hard';
      });

      it('should start replay recording when enabled', () => {
        const startSpy = vi.spyOn(playState.replayRecorder, 'start');

        playState.startSong();

        expect(startSpy).toHaveBeenCalledWith('test-song', 'hard');
      });

      it('should use song name if id not available', () => {
        playState.songData = { name: 'Test Song' };
        const startSpy = vi.spyOn(playState.replayRecorder, 'start');

        playState.startSong();

        expect(startSpy).toHaveBeenCalledWith('Test Song', 'hard');
      });

      it('should not start recording when disabled', () => {
        playState.setReplayRecordingEnabled(false);
        playState.replayRecorder = { start: vi.fn(), isRecording: vi.fn(() => false) };

        playState.startSong();

        expect(playState.replayRecorder.start).not.toHaveBeenCalled();
      });
    });

    describe('handleNoteInput with replay recording', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'test-song' };
        playState.startSong();
        playState.songPosition = 1000;
      });

      it('should record press input when recording', () => {
        const recordSpy = vi.spyOn(playState.replayRecorder, 'recordInput');

        playState.handleNoteInput(2, 1000);

        expect(recordSpy).toHaveBeenCalledWith('press', 2, 'Key2', 1000);
      });

      it('should not record input when not recording', () => {
        playState.replayRecorder.discard();
        const recordSpy = vi.spyOn(playState.replayRecorder, 'recordInput');

        playState.handleNoteInput(0, 1000);

        expect(recordSpy).not.toHaveBeenCalled();
      });
    });

    describe('handleNoteRelease with replay recording', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'test-song' };
        playState.startSong();
        playState.songPosition = 1500;
      });

      it('should record release input when recording', () => {
        const recordSpy = vi.spyOn(playState.replayRecorder, 'recordInput');

        playState.handleNoteRelease(1, 1500);

        expect(recordSpy).toHaveBeenCalledWith('release', 1, 'Key1', 1500);
      });

      it('should not record input when not recording', () => {
        playState.replayRecorder.discard();
        const recordSpy = vi.spyOn(playState.replayRecorder, 'recordInput');

        playState.handleNoteRelease(0, 1500);

        expect(recordSpy).not.toHaveBeenCalled();
      });
    });

    describe('endSong with replay recording', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'test-song' };
        playState.startSong();
        playState.score = 5000;
        playState.tallies = {
          sick: 10,
          good: 5,
          bad: 2,
          shit: 0,
          missed: 1,
          combo: 0,
          maxCombo: 15,
          totalNotesHit: 17,
          totalNotes: 18
        };
      });

      it('should stop recording and return replay data', () => {
        const stopSpy = vi.spyOn(playState.replayRecorder, 'stop');

        playState.endSong();

        expect(stopSpy).toHaveBeenCalledWith(5000, playState.tallies);
      });

      it('should include replay data in SONG_END event', () => {
        playState.endSong();

        expect(EventBus.emit).toHaveBeenCalledWith(
          Events.SONG_END,
          expect.objectContaining({
            replayData: expect.any(Object)
          })
        );
      });

      it('should pass replay data to onSongEnd callback', () => {
        const callback = vi.fn();
        playState.onSongEnd = callback;

        playState.endSong();

        // onSongEnd now receives 5 args: score, tallies, rank, replayData, timingStats
        const callArgs = callback.mock.calls[0];
        expect(callArgs).toHaveLength(5);
        expect(callArgs[3]).toEqual(expect.any(Object)); // replayData
      });
    });

    describe('gameOver with replay recording', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'test-song' };
        playState.startSong();
      });

      it('should discard replay on game over', () => {
        const discardSpy = vi.spyOn(playState.replayRecorder, 'discard');

        playState.gameOver();

        expect(discardSpy).toHaveBeenCalled();
        expect(playState.replayRecorder.isRecording()).toBe(false);
      });
    });

    describe('exitSong with replay recording', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'test-song' };
        playState.audioManager = { play: vi.fn(), stop: vi.fn() };
        playState.startSong();
      });

      it('should discard replay on early exit', () => {
        const discardSpy = vi.spyOn(playState.replayRecorder, 'discard');

        playState.exitSong();

        expect(discardSpy).toHaveBeenCalled();
        expect(playState.replayRecorder.isRecording()).toBe(false);
      });

      it('should stop audio on early exit', () => {
        playState.exitSong();

        expect(playState.audioManager.stop).toHaveBeenCalled();
      });

      it('should set songStarted to false', () => {
        playState.exitSong();

        expect(playState.songStarted).toBe(false);
      });
    });

    describe('destroy with replay recording', () => {
      beforeEach(() => {
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'test-song' };
        playState.startSong();
      });

      it('should discard recording on destroy', () => {
        const discardSpy = vi.spyOn(playState.replayRecorder, 'discard');

        playState.destroy();

        expect(discardSpy).toHaveBeenCalled();
      });

      it('should clean up replay recorder', () => {
        playState.destroy();

        expect(playState.replayRecorder).toBeNull();
      });
    });

    describe('replay recording full flow', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.setReplayRecordingEnabled(true);
        playState.songData = { id: 'tutorial' };
        playState.difficulty = 'normal';
      });

      it('should record complete gameplay session', () => {
        // Start song
        playState.startSong();
        expect(playState.replayRecorder.isRecording()).toBe(true);

        // Simulate inputs
        playState.songPosition = 1000;
        playState.handleNoteInput(0, 1000);
        playState.songPosition = 1050;
        playState.handleNoteRelease(0, 1050);
        playState.songPosition = 2000;
        playState.handleNoteInput(2, 2000);
        playState.songPosition = 2100;
        playState.handleNoteRelease(2, 2100);

        // End song
        playState.score = 1000;
        playState.tallies.totalNotesHit = 2;
        playState.tallies.totalNotes = 2;
        playState.endSong();

        // Verify replay data was created
        expect(EventBus.emit).toHaveBeenCalledWith(
          Events.SONG_END,
          expect.objectContaining({
            replayData: expect.objectContaining({
              songId: 'tutorial',
              difficulty: 'normal',
              score: 1000,
              inputs: expect.arrayContaining([
                expect.objectContaining({ type: 'press', direction: 0, time: 1000 }),
                expect.objectContaining({ type: 'release', direction: 0, time: 1050 }),
                expect.objectContaining({ type: 'press', direction: 2, time: 2000 }),
                expect.objectContaining({ type: 'release', direction: 2, time: 2100 })
              ])
            })
          })
        );
      });
    });
  });

  // ========================================
  // REPLAY PLAYBACK INTEGRATION TESTS (Task 13.2)
  // ========================================

  describe('replay playback integration', () => {
    const createMockReplayData = () => ({
      version: '1.0.0',
      songId: 'tutorial',
      difficulty: 'normal',
      timestamp: Date.now(),
      score: 5000,
      tallies: {
        sick: 10,
        good: 5,
        bad: 2,
        shit: 0,
        missed: 1,
        combo: 0,
        maxCombo: 15,
        totalNotesHit: 17,
        totalNotes: 18
      },
      seed: 0.123456,
      inputs: [
        { time: 1000, type: 'press', direction: 0, keyCode: 'Key0' },
        { time: 1050, type: 'release', direction: 0, keyCode: 'Key0' },
        { time: 2000, type: 'press', direction: 2, keyCode: 'Key2' },
        { time: 2100, type: 'release', direction: 2, keyCode: 'Key2' }
      ],
      metadata: {}
    });

    describe('loadReplay', () => {
      it('should load valid replay data', () => {
        const replayData = createMockReplayData();

        const result = playState.loadReplay(replayData);

        expect(result).toBe(true);
        expect(playState.replayMode).toBe(true);
        expect(playState.replayPlayer).not.toBeNull();
      });

      it('should return false for null replay data', () => {
        const result = playState.loadReplay(null);

        expect(result).toBe(false);
        expect(playState.replayMode).toBe(false);
      });

      it('should return false for invalid replay data', () => {
        const invalidReplay = { version: '2.0.0', songId: 'test', inputs: [] };

        const result = playState.loadReplay(invalidReplay);

        expect(result).toBe(false);
        expect(playState.replayMode).toBe(false);
      });

      it('should disable replay recording when loading replay', () => {
        playState.setReplayRecordingEnabled(true);
        const replayData = createMockReplayData();

        playState.loadReplay(replayData);

        expect(playState.replayRecordingEnabled).toBe(false);
      });

      it('should create ReplayPlayer instance', () => {
        const replayData = createMockReplayData();

        playState.loadReplay(replayData);

        expect(playState.replayPlayer).toBeDefined();
        expect(typeof playState.replayPlayer.start).toBe('function');
        expect(typeof playState.replayPlayer.getInputsForPosition).toBe('function');
      });
    });

    describe('isReplayMode', () => {
      it('should return false by default', () => {
        expect(playState.isReplayMode()).toBe(false);
      });

      it('should return true after loading replay', () => {
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);

        expect(playState.isReplayMode()).toBe(true);
      });
    });

    describe('getReplayPlayer', () => {
      it('should return null by default', () => {
        expect(playState.getReplayPlayer()).toBeNull();
      });

      it('should return ReplayPlayer after loading replay', () => {
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);

        expect(playState.getReplayPlayer()).not.toBeNull();
      });
    });

    describe('startSong with replay mode', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);
      });

      it('should start replay playback when in replay mode', () => {
        playState.startSong();

        expect(playState.replayPlayer.isPlaying()).toBe(true);
      });

      it('should emit REPLAY_START event', () => {
        playState.startSong();

        expect(EventBus.emit).toHaveBeenCalledWith(
          Events.REPLAY_START,
          expect.objectContaining({
            songId: 'tutorial',
            difficulty: 'normal'
          })
        );
      });

      it('should not start replay recording when in replay mode', () => {
        playState.setReplayRecordingEnabled(true);
        playState.replayRecorder = { start: vi.fn(), isRecording: vi.fn(() => false) };

        playState.startSong();

        expect(playState.replayRecorder.start).not.toHaveBeenCalled();
      });
    });

    describe('processReplayInputs', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);
        playState.startSong();
      });

      it('should process replay inputs at correct song position', () => {
        playState.songPosition = 1000;

        playState.processReplayInputs();

        expect(playState.playerStrumline.pressKey).toHaveBeenCalledWith(0);
      });

      it('should process multiple inputs at same position', () => {
        playState.songPosition = 1050;

        playState.processReplayInputs();

        // Should have processed both the press at 1000 and release at 1050
        expect(playState.playerStrumline.pressKey).toHaveBeenCalled();
        expect(playState.playerStrumline.releaseKey).toHaveBeenCalled();
      });

      it('should not process inputs when not in replay mode', () => {
        playState.replayMode = false;
        playState.songPosition = 1000;

        playState.processReplayInputs();

        expect(playState.playerStrumline.pressKey).not.toHaveBeenCalled();
      });

      it('should not process inputs when replay player not playing', () => {
        playState.replayPlayer.stop();
        playState.songPosition = 1000;

        playState.processReplayInputs();

        expect(playState.playerStrumline.pressKey).not.toHaveBeenCalled();
      });
    });

    describe('update with replay mode', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.opponentStrumline = createMockStrumline();
        playState.audioManager = { play: vi.fn(), stop: vi.fn(), isPlaying: true, currentTime: 0 };
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);
        playState.startSong();
      });

      it('should process replay inputs instead of live inputs', () => {
        playState.songPosition = 1000;
        playState.audioManager.currentTime = 1000;

        // Add live input that should be ignored
        playState.inputPressQueue.push({ direction: 3, timestamp: 1000 });

        playState.update(0, 16);

        // Should have processed replay input (direction 0), not live input (direction 3)
        expect(playState.playerStrumline.pressKey).toHaveBeenCalledWith(0);
        // Live input should still be in queue (not processed)
        expect(playState.inputPressQueue.length).toBe(1);
      });
    });

    describe('endSong with replay mode', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.audioManager = { play: vi.fn(), stop: vi.fn() };
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);
        playState.startSong();
        vi.clearAllMocks(); // Clear mocks to check only endSong events
      });

      it('should stop replay playback', () => {
        playState.endSong();

        expect(playState.replayPlayer.isPlaying()).toBe(false);
      });

      it('should emit REPLAY_STOP event', () => {
        playState.endSong();

        expect(EventBus.emit).toHaveBeenCalledWith(Events.REPLAY_STOP);
      });

      it('should include isReplay flag in SONG_END event', () => {
        playState.endSong();

        expect(EventBus.emit).toHaveBeenCalledWith(
          Events.SONG_END,
          expect.objectContaining({
            isReplay: true
          })
        );
      });

      it('should reset replay mode', () => {
        playState.endSong();

        expect(playState.replayMode).toBe(false);
      });
    });

    describe('gameOver with replay mode', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.audioManager = { play: vi.fn(), stop: vi.fn() };
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);
        playState.startSong();
      });

      it('should stop replay playback on game over', () => {
        playState.gameOver();

        expect(playState.replayPlayer.isPlaying()).toBe(false);
        expect(playState.replayMode).toBe(false);
      });

      it('should emit REPLAY_STOP event on game over', () => {
        playState.gameOver();

        expect(EventBus.emit).toHaveBeenCalledWith(Events.REPLAY_STOP);
      });
    });

    describe('exitSong with replay mode', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.audioManager = { play: vi.fn(), stop: vi.fn() };
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);
        playState.startSong();
      });

      it('should stop replay playback on exit', () => {
        playState.exitSong();

        expect(playState.replayPlayer.isPlaying()).toBe(false);
        expect(playState.replayMode).toBe(false);
      });

      it('should emit REPLAY_STOP event on exit', () => {
        playState.exitSong();

        expect(EventBus.emit).toHaveBeenCalledWith(Events.REPLAY_STOP);
      });
    });

    describe('destroy with replay mode', () => {
      beforeEach(() => {
        const replayData = createMockReplayData();
        playState.loadReplay(replayData);
        playState.startSong();
      });

      it('should clean up replay player on destroy', () => {
        playState.destroy();

        expect(playState.replayPlayer).toBeNull();
        expect(playState.replayMode).toBe(false);
      });

      it('should stop replay playback before cleanup', () => {
        const stopSpy = vi.spyOn(playState.replayPlayer, 'stop');

        playState.destroy();

        expect(stopSpy).toHaveBeenCalled();
      });
    });

    describe('replay playback full flow', () => {
      beforeEach(() => {
        playState.playerStrumline = createMockStrumline();
        playState.opponentStrumline = createMockStrumline();
        playState.audioManager = { play: vi.fn(), stop: vi.fn(), isPlaying: true, currentTime: 0 };
      });

      it('should process all replay inputs', () => {
        // Create replay data with just 2 inputs
        const replayData = {
          version: '1.0.0',
          songId: 'test',
          difficulty: 'normal',
          timestamp: Date.now(),
          score: 1000,
          tallies: {},
          seed: 0.5,
          inputs: [
            { time: 100, type: 'press', direction: 0, keyCode: 'Key0' },
            { time: 200, type: 'release', direction: 0, keyCode: 'Key0' }
          ],
          metadata: {}
        };

        // Load and start replay
        playState.loadReplay(replayData);
        playState.startSong();

        // Process all inputs at once by setting position past all inputs
        playState.audioManager.currentTime = 300;
        playState.update(0, 16);

        // Both press and release should have been called
        expect(playState.playerStrumline.pressKey).toHaveBeenCalledWith(0);
        expect(playState.playerStrumline.releaseKey).toHaveBeenCalledWith(0);
      });

      it('should play back complete replay session', () => {
        // Create replay data
        const replayData = createMockReplayData();

        // Load replay
        const loadResult = playState.loadReplay(replayData);
        expect(loadResult).toBe(true);
        expect(playState.replayMode).toBe(true);

        // Start song
        playState.startSong();
        expect(playState.replayPlayer.isPlaying()).toBe(true);

        // Process all inputs at once
        playState.audioManager.currentTime = 3000;
        playState.update(0, 16);

        // End song
        playState.endSong();
        expect(playState.replayMode).toBe(false);
        expect(EventBus.emit).toHaveBeenCalledWith(Events.REPLAY_STOP);

        // Verify all inputs were processed
        expect(playState.playerStrumline.pressKey).toHaveBeenCalledTimes(2);
        expect(playState.playerStrumline.releaseKey).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ========================================
  // ASSET WIRING TESTS (Task 7.4)
  // ========================================

  describe('asset wiring', () => {
    describe('wireCharacterAssets', () => {
      let mockCharacterRegistry;

      beforeEach(() => {
        mockRegisterCharacterAnimations.mockClear();

        playState.player = {
          characterId: 'bf',
          characterData: { startingAnimation: 'idle' },
          setTexture: vi.fn(),
          playAnimation: vi.fn(),
          destroy: vi.fn()
        };
        playState.opponent = {
          characterId: 'dad',
          characterData: { startingAnimation: 'idle' },
          setTexture: vi.fn(),
          playAnimation: vi.fn(),
          destroy: vi.fn()
        };
        playState.girlfriend = {
          characterId: 'gf',
          characterData: { startingAnimation: 'danceLeft' },
          setTexture: vi.fn(),
          playAnimation: vi.fn(),
          destroy: vi.fn()
        };

        mockCharacterRegistry = {
          getCharacterAnimations: vi.fn((id) => [
            { name: 'idle', prefix: `${id} idle`, frameRate: 24, looped: false }
          ])
        };
      });

      it('should set texture on each character with correct key', () => {
        playState.wireCharacterAssets(mockCharacterRegistry);

        expect(playState.player.setTexture).toHaveBeenCalledWith('char-bf');
        expect(playState.opponent.setTexture).toHaveBeenCalledWith('char-dad');
        expect(playState.girlfriend.setTexture).toHaveBeenCalledWith('char-gf');
      });

      it('should register animations for each character', () => {
        playState.wireCharacterAssets(mockCharacterRegistry);

        expect(mockRegisterCharacterAnimations).toHaveBeenCalledTimes(3);
        expect(mockRegisterCharacterAnimations).toHaveBeenCalledWith(
          mockScene,
          'char-bf',
          expect.any(Array)
        );
        expect(mockRegisterCharacterAnimations).toHaveBeenCalledWith(
          mockScene,
          'char-dad',
          expect.any(Array)
        );
        expect(mockRegisterCharacterAnimations).toHaveBeenCalledWith(
          mockScene,
          'char-gf',
          expect.any(Array)
        );
      });

      it('should play starting animation on each character', () => {
        playState.wireCharacterAssets(mockCharacterRegistry);

        expect(playState.player.playAnimation).toHaveBeenCalledWith('idle');
        expect(playState.opponent.playAnimation).toHaveBeenCalledWith('idle');
        expect(playState.girlfriend.playAnimation).toHaveBeenCalledWith('danceLeft');
      });

      it('should default to idle when no startingAnimation', () => {
        playState.player.characterData = {};

        playState.wireCharacterAssets(mockCharacterRegistry);

        expect(playState.player.playAnimation).toHaveBeenCalledWith('idle');
      });

      it('should skip null characters', () => {
        playState.girlfriend = null;

        playState.wireCharacterAssets(mockCharacterRegistry);

        expect(mockRegisterCharacterAnimations).toHaveBeenCalledTimes(2);
      });
    });

    describe('wireStageAssets', () => {
      let mockStageRegistry;

      beforeEach(() => {
        mockRegisterPropAnimations.mockClear();

        const mockPropSprite = {
          setTexture: vi.fn(),
          playAnimation: vi.fn(),
          _propData: { name: 'stageback' }
        };
        const mockAnimatedPropSprite = {
          setTexture: vi.fn(),
          playAnimation: vi.fn(),
          _propData: { name: 'stagecurtains' }
        };

        playState.stage = {
          getProp: vi.fn((name) => {
            if (name === 'stageback') return mockPropSprite;
            if (name === 'stagecurtains') return mockAnimatedPropSprite;
            return null;
          }),
          destroy: vi.fn()
        };

        mockStageRegistry = {
          getStageProps: vi.fn(() => [
            { name: 'stageback', assetPath: 'stageback', animations: [] },
            {
              name: 'stagecurtains',
              assetPath: 'stagecurtains',
              animations: [{ name: 'idle', prefix: 'curtains', frameRate: 24, looped: true }],
              startingAnimation: 'idle'
            }
          ])
        };
      });

      it('should set texture on each prop', () => {
        playState.wireStageAssets('mainStage', mockStageRegistry);

        const backProp = playState.stage.getProp('stageback');
        const curtainProp = playState.stage.getProp('stagecurtains');

        expect(backProp.setTexture).toHaveBeenCalledWith('stage-mainStage-stageback');
        expect(curtainProp.setTexture).toHaveBeenCalledWith('stage-mainStage-stagecurtains');
      });

      it('should register animations for animated props', () => {
        playState.wireStageAssets('mainStage', mockStageRegistry);

        expect(mockRegisterPropAnimations).toHaveBeenCalledTimes(1);
        expect(mockRegisterPropAnimations).toHaveBeenCalledWith(
          mockScene,
          'stage-mainStage-stagecurtains',
          expect.any(Array)
        );
      });

      it('should play starting animation on animated props', () => {
        playState.wireStageAssets('mainStage', mockStageRegistry);

        const curtainProp = playState.stage.getProp('stagecurtains');
        expect(curtainProp.playAnimation).toHaveBeenCalledWith('idle');
      });

      it('should not register animations for static props', () => {
        mockStageRegistry.getStageProps.mockReturnValue([
          { name: 'stageback', assetPath: 'stageback', animations: [] }
        ]);

        playState.wireStageAssets('mainStage', mockStageRegistry);

        expect(mockRegisterPropAnimations).not.toHaveBeenCalled();
      });

      it('should skip props not found in stage', () => {
        mockStageRegistry.getStageProps.mockReturnValue([
          { name: 'missing', assetPath: 'missing', animations: [] }
        ]);

        playState.wireStageAssets('mainStage', mockStageRegistry);

        // Should not throw
        expect(mockRegisterPropAnimations).not.toHaveBeenCalled();
      });
    });

    describe('wireAudio', () => {
      beforeEach(() => {
        playState.audioManager = {
          loadInstrumental: vi.fn(),
          setVoices: vi.fn()
        };
        playState.voices = {
          loadSplit: vi.fn(),
          loadCombined: vi.fn()
        };
      });

      it('should load instrumental when present', () => {
        playState.wireAudio({
          instrumental: { key: 'song-bopeebo-instrumental' },
          vocals: {}
        });

        expect(playState.audioManager.loadInstrumental).toHaveBeenCalledWith('song-bopeebo-instrumental');
      });

      it('should load split vocals when player and opponent present', () => {
        playState.wireAudio({
          instrumental: { key: 'song-bopeebo-instrumental' },
          vocals: {
            player: { key: 'song-bopeebo-vocals-player' },
            opponent: { key: 'song-bopeebo-vocals-opponent' }
          }
        });

        expect(playState.voices.loadSplit).toHaveBeenCalledWith(
          'song-bopeebo-vocals-player',
          'song-bopeebo-vocals-opponent'
        );
      });

      it('should load combined vocals when present', () => {
        playState.wireAudio({
          instrumental: { key: 'song-tutorial-instrumental' },
          vocals: {
            combined: { key: 'song-tutorial-vocals' }
          }
        });

        expect(playState.voices.loadCombined).toHaveBeenCalledWith('song-tutorial-vocals');
      });

      it('should connect voices to audio manager', () => {
        playState.wireAudio({
          instrumental: { key: 'inst' },
          vocals: {}
        });

        expect(playState.audioManager.setVoices).toHaveBeenCalledWith(playState.voices);
      });

      it('should skip instrumental when not present', () => {
        playState.wireAudio({ vocals: {} });

        expect(playState.audioManager.loadInstrumental).not.toHaveBeenCalled();
      });

      it('should not load split vocals when only player present', () => {
        playState.wireAudio({
          vocals: {
            player: { key: 'player-key' }
          }
        });

        expect(playState.voices.loadSplit).not.toHaveBeenCalled();
      });
    });
  });
});

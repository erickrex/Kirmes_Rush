/**
 * @fileoverview Integration test for full Tutorial song playthrough
 * Tests the complete gameplay flow from countdown to song end
 *
 * Note: This is a logic-focused integration test that doesn't require
 * actual Phaser rendering. It tests the gameplay state machine and
 * note processing logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PlayState from '../../src/play/PlayState.js';
import Conductor from '../../src/core/Conductor.js';
import * as Constants from '../../src/core/Constants.js';

describe('Tutorial Song - Full Playthrough Integration Test', () => {
  let scene;
  let playState;
  let conductor;
  let audioManager;
  let voices;
  let preciseInput;

  // Mock chart data for Tutorial (simplified)
  const mockTutorialChart = {
    version: '2.0.0',
    songName: 'Tutorial',
    artist: 'Kawai Sprite',
    bpm: 100,
    scrollSpeed: 1.0,
    stage: 'stage',
    player: 'bf',
    opponent: 'gf',
    girlfriend: 'gf',
    timeChanges: [
      {
        timeStamp: 0,
        bpm: 100,
        beatTime: 0,
        timeSignatureNum: 4,
        timeSignatureDen: 4
      }
    ],
    notes: {
      player: [
        // First measure - simple pattern
        { time: 0, direction: 0, length: 0, kind: '' },
        { time: 600, direction: 1, length: 0, kind: '' },
        { time: 1200, direction: 2, length: 0, kind: '' },
        { time: 1800, direction: 3, length: 0, kind: '' },
        // Second measure - with hold note
        { time: 2400, direction: 0, length: 400, kind: '' },
        { time: 3000, direction: 2, length: 0, kind: '' },
        // Third measure
        { time: 3600, direction: 1, length: 0, kind: '' },
        { time: 4200, direction: 3, length: 0, kind: '' }
      ],
      opponent: [
        // Opponent notes (auto-hit)
        { time: 300, direction: 0, length: 0, kind: '' },
        { time: 900, direction: 1, length: 0, kind: '' },
        { time: 1500, direction: 2, length: 0, kind: '' },
        { time: 2100, direction: 3, length: 0, kind: '' }
      ]
    },
    events: []
  };

  beforeEach(() => {
    // Create minimal mock Phaser scene (no actual rendering)
    scene = {
      add: {
        existing: vi.fn((obj) => obj),
        sprite: vi.fn(() => createMockSprite()),
        container: vi.fn(() => createMockContainer()),
        graphics: vi.fn(() => createMockGraphics())
      },
      cameras: {
        main: createMockCamera(),
        add: vi.fn(() => createMockCamera())
      },
      time: {
        delayedCall: vi.fn((delay, callback) => {
          // Execute immediately for testing
          callback();
        })
      },
      scale: {
        width: 1280,
        height: 720
      },
      sound: {
        add: vi.fn(() => createMockSound())
      },
      textures: {
        exists: vi.fn(() => true),
        get: vi.fn(() => ({
          has: vi.fn(() => true),
          get: vi.fn(() => ({
            width: 100,
            height: 100
          }))
        }))
      },
      anims: {
        exists: vi.fn(() => true),
        create: vi.fn(),
        get: vi.fn(() => ({
          frames: []
        }))
      }
    };

    // Helper functions to create mock objects
    function createMockSprite() {
      return {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn()
      };
    }

    function createMockContainer() {
      return {
        add: vi.fn(),
        setScrollFactor: vi.fn().mockReturnThis(),
        destroy: vi.fn()
      };
    }

    function createMockGraphics() {
      return {
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        destroy: vi.fn()
      };
    }

    function createMockCamera() {
      return {
        zoom: 1.0,
        scrollX: 0,
        scrollY: 0,
        setZoom: vi.fn(),
        setScroll: vi.fn(),
        startFollow: vi.fn(),
        stopFollow: vi.fn()
      };
    }

    function createMockSound() {
      return {
        play: vi.fn(),
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        setVolume: vi.fn(),
        isPlaying: false,
        seek: 0
      };
    }

    // Create PlayState
    playState = new PlayState(scene);

    // Initialize with tutorial chart
    playState.init({
      song: { id: 'tutorial', name: 'Tutorial' },
      difficulty: 'normal',
      startTimestamp: 0,
      chart: mockTutorialChart
    });

    // Setup cameras
    playState.setupCameras();

    // Create strumlines
    playState.createStrumlines(null, 1.0);

    // Generate notes
    playState.generateNotes();

    // Create mock audio manager
    audioManager = {
      isPlaying: false,
      currentTime: 0,
      play: vi.fn(function () {
        this.isPlaying = true;
      }),
      stop: vi.fn(function () {
        this.isPlaying = false;
      }),
      pause: vi.fn(),
      resume: vi.fn()
    };

    playState.setAudioManager(audioManager);

    // Create mock voices
    voices = {
      mutePlayer: vi.fn(),
      unmutePlayer: vi.fn(),
      muteOpponent: vi.fn(),
      unmuteOpponent: vi.fn()
    };
    playState.setVoices(voices);

    // Create mock precise input
    preciseInput = {
      consumePresses: vi.fn(() => []),
      consumeReleases: vi.fn(() => [])
    };
    playState.setPreciseInput(preciseInput);

    // Get conductor instance
    conductor = Conductor.getInstance();
    conductor.reset();
  });

  afterEach(() => {
    if (playState) {
      playState.destroy();
    }
    conductor.reset();
  });

  describe('Full Playthrough Simulation', () => {
    it('should complete a full song playthrough with perfect hits', () => {
      // Track events
      const events = {
        countdownStart: false,
        countdownSteps: [],
        songStart: false,
        notesHit: [],
        notesMissed: [],
        songEnd: false
      };

      // Setup event listeners
      playState.onCountdownStep = (step, name) => {
        events.countdownSteps.push({ step, name });
      };

      playState.onNoteHit = (note, judgement, score, timing) => {
        events.notesHit.push({ note, judgement, score, timing });
      };

      playState.onNoteMiss = (note) => {
        events.notesMissed.push(note);
      };

      playState.onSongEnd = (score, tallies, rank) => {
        events.songEnd = true;
      };

      // Start countdown
      playState.startCountdown();

      // Verify countdown executed
      expect(events.countdownSteps.length).toBe(4); // 3, 2, 1, GO
      expect(playState.songStarted).toBe(true);
      expect(audioManager.play).toHaveBeenCalled();

      // Simulate perfect hits for all player notes
      const playerNotes = mockTutorialChart.notes.player;

      playerNotes.forEach((noteData, index) => {
        // Advance time to note
        audioManager.currentTime = noteData.time;
        playState.update(noteData.time, 16);

        // Simulate perfect input (0ms timing)
        const input = {
          direction: noteData.direction,
          timestamp: performance.now()
        };

        preciseInput.consumePresses = vi.fn(() => [input]);
        playState.processInputQueue();

        // Verify note was hit
        expect(events.notesHit.length).toBe(index + 1);
        expect(events.notesHit[index].judgement).toBe('sick');
      });

      // Verify all notes were hit
      expect(events.notesHit.length).toBe(playerNotes.length);
      expect(events.notesMissed.length).toBe(0);

      // Verify tallies
      expect(playState.tallies.sick).toBe(playerNotes.length);
      expect(playState.tallies.missed).toBe(0);
      expect(playState.tallies.totalNotesHit).toBe(playerNotes.length);

      // Verify health stayed positive
      expect(playState.health).toBeGreaterThan(Constants.HEALTH_MIN);

      // Advance to song end
      audioManager.currentTime = playState.songLength;
      playState.update(playState.songLength, 16);

      // Verify song ended
      expect(events.songEnd).toBe(true);
      expect(audioManager.stop).toHaveBeenCalled();
    });

    it('should handle mixed judgements during playthrough', () => {
      const events = {
        notesHit: []
      };

      playState.onNoteHit = (note, judgement, score, timing) => {
        events.notesHit.push({ note, judgement, score, timing });
      };

      // Start song
      playState.startCountdown();

      const playerNotes = mockTutorialChart.notes.player;

      // Hit notes with varying timing
      const timingOffsets = [0, 20, 50, 100, 0, 30, 10, 80]; // Mix of sick, good, bad

      playerNotes.forEach((noteData, index) => {
        const offset = timingOffsets[index] || 0;
        audioManager.currentTime = noteData.time + offset;
        playState.update(noteData.time + offset, 16);

        const input = {
          direction: noteData.direction,
          timestamp: performance.now()
        };

        preciseInput.consumePresses = vi.fn(() => [input]);
        playState.processInputQueue();
      });

      // Verify mixed judgements
      expect(events.notesHit.length).toBe(playerNotes.length);

      const judgements = events.notesHit.map((h) => h.judgement);
      expect(judgements).toContain('sick');
      expect(judgements).toContain('good');

      // Verify tallies reflect mixed performance
      expect(playState.tallies.sick).toBeGreaterThan(0);
      expect(playState.tallies.good).toBeGreaterThan(0);
    });

    it('should handle missed notes and combo breaks', () => {
      const events = {
        notesHit: [],
        notesMissed: []
      };

      playState.onNoteHit = (note, judgement, score, timing) => {
        events.notesHit.push({ note, judgement, score, timing });
      };

      playState.onNoteMiss = (note) => {
        events.notesMissed.push(note);
      };

      // Start song
      playState.startCountdown();

      const playerNotes = mockTutorialChart.notes.player;

      // Hit first note
      audioManager.currentTime = playerNotes[0].time;
      playState.update(playerNotes[0].time, 16);

      let input = {
        direction: playerNotes[0].direction,
        timestamp: performance.now()
      };
      preciseInput.consumePresses = vi.fn(() => [input]);
      playState.processInputQueue();

      expect(playState.combo).toBe(1);

      // Miss second note by advancing past it
      audioManager.currentTime = playerNotes[1].time + Constants.HIT_WINDOW_MS + 100;
      playState.update(playerNotes[1].time + Constants.HIT_WINDOW_MS + 100, 16);

      // Verify miss was detected
      expect(events.notesMissed.length).toBe(1);
      expect(playState.combo).toBe(0); // Combo broken
      expect(playState.tallies.missed).toBe(1);

      // Hit third note
      audioManager.currentTime = playerNotes[2].time;
      playState.update(playerNotes[2].time, 16);

      input = {
        direction: playerNotes[2].direction,
        timestamp: performance.now()
      };
      preciseInput.consumePresses = vi.fn(() => [input]);
      playState.processInputQueue();

      expect(playState.combo).toBe(1); // Combo restarted
    });

    it('should process opponent notes automatically', () => {
      // Start song
      playState.startCountdown();

      const opponentNotes = mockTutorialChart.notes.opponent;

      // Process each opponent note
      opponentNotes.forEach((noteData) => {
        audioManager.currentTime = noteData.time;
        playState.update(noteData.time, 16);

        // Verify opponent note was auto-hit
        const note = playState.opponentStrumline.notes.find(
          (n) => n.strumTime === noteData.time && n.direction === noteData.direction
        );

        if (note) {
          expect(note.hasBeenHit).toBe(true);
        }
      });
    });

    it('should maintain health throughout playthrough', () => {
      // Start song
      playState.startCountdown();

      const initialHealth = playState.health;
      expect(initialHealth).toBe(Constants.HEALTH_STARTING);

      const playerNotes = mockTutorialChart.notes.player;

      // Hit all notes perfectly
      playerNotes.forEach((noteData) => {
        audioManager.currentTime = noteData.time;
        playState.update(noteData.time, 16);

        const input = {
          direction: noteData.direction,
          timestamp: performance.now()
        };

        preciseInput.consumePresses = vi.fn(() => [input]);
        playState.processInputQueue();
      });

      // Health should have increased from perfect hits
      expect(playState.health).toBeGreaterThan(initialHealth);
      expect(playState.health).toBeLessThanOrEqual(Constants.HEALTH_MAX);
    });

    it('should calculate correct final score and rank', () => {
      let finalScore = 0;
      let finalRank = null;

      playState.onSongEnd = (score, tallies, rank) => {
        finalScore = score;
        finalRank = rank;
      };

      // Start song
      playState.startCountdown();

      const playerNotes = mockTutorialChart.notes.player;

      // Hit all notes perfectly
      playerNotes.forEach((noteData) => {
        audioManager.currentTime = noteData.time;
        playState.update(noteData.time, 16);

        const input = {
          direction: noteData.direction,
          timestamp: performance.now()
        };

        preciseInput.consumePresses = vi.fn(() => [input]);
        playState.processInputQueue();
      });

      // End song
      audioManager.currentTime = playState.songLength;
      playState.update(playState.songLength, 16);

      // Verify final score
      expect(finalScore).toBeGreaterThan(0);

      // Verify rank (should be PERFECT_GOLD for all sicks)
      expect(finalRank).toBe('PERFECT_GOLD');
    });

    it('should handle countdown timing correctly', () => {
      const countdownSteps = [];

      playState.onCountdownStep = (step, name) => {
        countdownSteps.push({ step, name, time: conductor.songPosition });
      };

      // Start countdown
      playState.startCountdown();

      // Verify countdown steps
      expect(countdownSteps.length).toBe(4);
      expect(countdownSteps[0].name).toBe('three');
      expect(countdownSteps[1].name).toBe('two');
      expect(countdownSteps[2].name).toBe('one');
      expect(countdownSteps[3].name).toBe('go');

      // Verify song started after countdown
      expect(playState.songStarted).toBe(true);
      expect(playState.countdownActive).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid input correctly', () => {
      playState.startCountdown();

      const playerNotes = mockTutorialChart.notes.player;
      const firstNote = playerNotes[0];

      audioManager.currentTime = firstNote.time;
      playState.update(firstNote.time, 16);

      // Simulate rapid multiple inputs
      const inputs = [
        { direction: firstNote.direction, timestamp: performance.now() },
        { direction: firstNote.direction, timestamp: performance.now() + 1 },
        { direction: firstNote.direction, timestamp: performance.now() + 2 }
      ];

      preciseInput.consumePresses = vi.fn(() => inputs);
      playState.processInputQueue();

      // Should only hit the note once
      expect(playState.tallies.totalNotesHit).toBe(1);
    });

    it('should handle wrong direction input', () => {
      playState.startCountdown();

      const playerNotes = mockTutorialChart.notes.player;
      const firstNote = playerNotes[0];

      audioManager.currentTime = firstNote.time;
      playState.update(firstNote.time, 16);

      // Press wrong direction
      const wrongDirection = (firstNote.direction + 1) % 4;
      const input = {
        direction: wrongDirection,
        timestamp: performance.now()
      };

      preciseInput.consumePresses = vi.fn(() => [input]);
      playState.processInputQueue();

      // Should not hit the note
      expect(playState.tallies.totalNotesHit).toBe(0);
    });

    it('should handle early input (before note appears)', () => {
      playState.startCountdown();

      const playerNotes = mockTutorialChart.notes.player;
      const firstNote = playerNotes[0];

      // Try to hit note way too early
      audioManager.currentTime = firstNote.time - 500;
      playState.update(firstNote.time - 500, 16);

      const input = {
        direction: firstNote.direction,
        timestamp: performance.now()
      };

      preciseInput.consumePresses = vi.fn(() => [input]);
      playState.processInputQueue();

      // Should not hit the note (too early)
      expect(playState.tallies.totalNotesHit).toBe(0);
    });
  });
});

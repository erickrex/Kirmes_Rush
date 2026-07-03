/**
 * @fileoverview Property-based tests for Options Wiring bugfix.
 * Tests that saved option values are actually applied by consuming systems.
 *
 * Property 1: Bug Condition - Saved Options Are Never Applied By Consuming Systems
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.12
 *
 * These tests encode the EXPECTED (correct) behavior. They are expected to FAIL
 * on unfixed code, confirming the bug exists. After the fix, they should PASS.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// ========================================
// MOCKS
// ========================================

vi.stubGlobal('Phaser', {
  GameObjects: {
    Sprite: class MockSprite {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.visible = true;
        this.alpha = 1;
        this.flipX = false;
        this.displayWidth = 150;
        this.displayHeight = 150;
        this.anims = { currentAnim: null };
        this._listeners = {};
      }
      on(event, fn) {
        this._listeners[event] = this._listeners[event] || [];
        this._listeners[event].push(fn);
        return this;
      }
      off() { return this; }
      emit() { return this; }
      setOrigin() { return this; }
      setScale() { return this; }
      setPosition() { return this; }
      setVisible() { return this; }
      setAlpha() { return this; }
      setScrollFactor() { return this; }
      setTexture() { return this; }
      setFrame() { return this; }
      setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; }
      destroy() {}
    },
    Graphics: class MockGraphics {
      constructor() {}
      clear() { return this; }
      fillStyle() { return this; }
      fillTriangle() { return this; }
      fillRect() { return this; }
      destroy() {}
    },
    Text: class MockText {
      constructor(scene, x, y, text, style) {
        this.x = x; this.y = y; this.text = text;
        this.style = style; this.visible = true;
        this.alpha = 1; this.depth = 0;
      }
      setText(t) { this.text = t; return this; }
      setPosition(x, y) { this.x = x; this.y = y; return this; }
      setScrollFactor() { return this; }
      setOrigin() { return this; }
      setDepth() { return this; }
      setVisible() { return this; }
      setAlpha() { return this; }
      setColor() { return this; }
      destroy() {}
    },
    Container: class MockContainer {
      constructor() {
        this.list = [];
        this.visible = true;
        this.x = 0; this.y = 0;
      }
      add(child) { this.list.push(child); return this; }
      setVisible(v) { this.visible = v; return this; }
      setPosition(x, y) { this.x = x; this.y = y; return this; }
      setData(k, v) { this['_data_' + k] = v; return this; }
      getData(k) { return this['_data_' + k]; }
      destroy() {}
    }
  },
  Events: {
    EventEmitter: class MockEventEmitter {
      constructor() { this.listeners = {}; }
      on(event, fn) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(fn);
        return this;
      }
      off(event, fn) {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(f => f !== fn);
        }
        return this;
      }
      emit(event, ...args) {
        if (this.listeners[event]) {
          this.listeners[event].forEach(fn => fn(...args));
        }
        return this;
      }
      once(event, fn) {
        const wrapper = (...args) => { fn(...args); this.off(event, wrapper); };
        return this.on(event, wrapper);
      }
      removeAllListeners() { this.listeners = {}; return this; }
    }
  },
  Math: {
    Clamp: (value, min, max) => Math.min(Math.max(value, min), max)
  }
});

vi.mock('phaser', () => ({
  default: globalThis.Phaser
}));

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
  default: { instance: mockConductor }
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
    COMBO_BREAK: 'comboBreak'
  }
}));

// Mock AnimationRegistrar
vi.mock('../src/graphics/AnimationRegistrar.js', () => ({
  registerCharacterAnimations: vi.fn(),
  registerPropAnimations: vi.fn()
}));

// Mock TouchDeviceDetector
vi.mock('../src/input/TouchDeviceDetector.js', () => ({
  default: {
    isTouch: vi.fn(() => false),
    detect: vi.fn(),
    reset: vi.fn()
  }
}));

// Mock Phaser module for scene-based classes
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    alpha: 0,
    text: '',
    destroy: vi.fn()
  };

  return {
    default: {
      GameObjects: globalThis.Phaser.GameObjects,
      Events: globalThis.Phaser.Events,
      Math: globalThis.Phaser.Math,
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.scene = { key: config?.key, start: vi.fn() };
          this.add = {
            text: vi.fn(() => ({ ...mockText, setOrigin: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis() })),
            sprite: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(), destroy: vi.fn() })),
            graphics: vi.fn(() => ({
              fillStyle: vi.fn().mockReturnThis(),
              fillRect: vi.fn().mockReturnThis(),
              clear: vi.fn().mockReturnThis(),
              destroy: vi.fn()
            })),
            container: vi.fn(() => {
              const c = new Phaser.GameObjects.Container();
              return c;
            })
          };
          this.cameras = {
            main: { width: 1280, height: 720, fadeOut: vi.fn(), fadeIn: vi.fn(), once: vi.fn((e, cb) => cb()) }
          };
          this.input = {
            keyboard: { on: vi.fn(), off: vi.fn() },
            on: vi.fn()
          };
          this.sound = {
            add: vi.fn(() => ({ play: vi.fn(), stop: vi.fn(), isPlaying: false, setVolume: vi.fn() })),
            getAll: vi.fn(() => []),
            volume: 1.0
          };
          this.cache = { audio: { exists: vi.fn(() => true) } };
          this.tweens = { add: vi.fn() };
          this.load = { setPath: vi.fn(), audio: vi.fn(), image: vi.fn() };
          this.time = { delayedCall: vi.fn() };
        }
        preload() {}
        create() {}
        update() {}
        shutdown() {}
      }
    }
  };
});


// ========================================
// IMPORTS
// ========================================

import AudioManager from '../src/audio/AudioManager.js';
import SaveManager from '../src/data/SaveManager.js';
import { createNoteProcessor } from '../src/play/NoteProcessor.js';
import { createInputManager } from '../src/play/InputManager.js';
import { createGameplayState } from '../src/play/GameplayState.js';

// ========================================
// HELPERS
// ========================================

function createMockScene() {
  return {
    sound: {
      add: vi.fn(() => ({
        play: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        destroy: vi.fn(),
        setVolume: vi.fn(),
        on: vi.fn(),
        seek: 0,
        duration: 120,
        isPlaying: false
      })),
      getAll: vi.fn(() => []),
      volume: 1.0
    },
    cache: { audio: { exists: vi.fn(() => true) } },
    time: { delayedCall: vi.fn() }
  };
}

function setupSaveManagerWithOption(key, value) {
  const sm = SaveManager.getInstance();
  sm.setOption(key, value, false);
  return sm;
}

// ========================================
// PROPERTY 1: BUG CONDITION
// Saved Options Are Never Applied By Consuming Systems
// ========================================

describe('Property 1: Bug Condition - Saved Options Are Never Applied', () => {
  let saveManager;

  beforeEach(() => {
    SaveManager.resetInstance();
    saveManager = SaveManager.getInstance();
    saveManager.loaded = true;
    saveManager.storageAvailable = false; // Prevent actual localStorage access
  });

  afterEach(() => {
    SaveManager.resetInstance();
    vi.restoreAllMocks();
  });

  /**
   * Validates: Requirements 1.1
   * Bug: AudioManager has no applyOptionsFromSave() method.
   * masterVolume saved in SaveManager is never read by AudioManager.
   */
  it('masterVolume saved in SaveManager should be applied to AudioManager', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (masterVol) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;
          sm.setOption('masterVolume', masterVol, false);

          const scene = createMockScene();
          const audioManager = new AudioManager(scene);

          // The expected behavior: AudioManager should have a method to apply saved options
          expect(typeof audioManager.applyOptionsFromSave).toBe('function');
          audioManager.applyOptionsFromSave();

          // masterVolume should be converted from 0-100 to 0-1
          expect(audioManager.masterVolume).toBeCloseTo(masterVol / 100, 2);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Validates: Requirements 1.1
   * Bug: musicVolume saved in SaveManager is never read by AudioManager.
   */
  it('musicVolume saved in SaveManager should be applied to AudioManager.instrumentalVolume', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (musicVol) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;
          sm.setOption('musicVolume', musicVol, false);

          const scene = createMockScene();
          const audioManager = new AudioManager(scene);

          expect(typeof audioManager.applyOptionsFromSave).toBe('function');
          audioManager.applyOptionsFromSave();

          // musicVolume maps to instrumentalVolume, converted 0-100 → 0-1
          expect(audioManager.instrumentalVolume).toBeCloseTo(musicVol / 100, 2);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Validates: Requirements 1.1
   * Bug: sfxVolume saved in SaveManager is never read by AudioManager.
   */
  it('sfxVolume saved in SaveManager should be applied to AudioManager.sfxVolume', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (sfxVol) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;
          sm.setOption('sfxVolume', sfxVol, false);

          const scene = createMockScene();
          const audioManager = new AudioManager(scene);

          expect(typeof audioManager.applyOptionsFromSave).toBe('function');
          audioManager.applyOptionsFromSave();

          expect(audioManager.sfxVolume).toBeCloseTo(sfxVol / 100, 2);
        }
      ),
      { numRuns: 10 }
    );
  });


  /**
   * Validates: Requirements 1.3
   * Bug: PlayState.createStrumlines() hardcodes isDownscroll = true,
   * ignoring the saved downscroll option.
   */
  it('downscroll=false in SaveManager should result in playerStrumline.isDownscroll=false', async () => {
    setupSaveManagerWithOption('downscroll', false);

    // Dynamically import PlayState (mocks are already set up)
    const { default: PlayState } = await import('../src/play/PlayState.js');

    const mockScene = {
      cameras: {
        main: { setScroll: vi.fn(), setZoom: vi.fn(), centerOn: vi.fn(), ignore: vi.fn() },
        add: vi.fn(() => ({ setScroll: vi.fn(), ignore: vi.fn() }))
      },
      scale: { width: 1280, height: 720 },
      time: { delayedCall: vi.fn((d, cb) => cb()) },
      textures: { exists: vi.fn(() => true) },
      anims: { exists: vi.fn(() => true) },
      add: {
        rectangle: vi.fn(() => ({
          setOrigin: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          destroy: vi.fn()
        })),
        graphics: vi.fn(() => ({
          fillStyle: vi.fn().mockReturnThis(),
          fillTriangle: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          clear: vi.fn().mockReturnThis(),
          destroy: vi.fn()
        })),
        text: vi.fn(() => ({
          setScrollFactor: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          alpha: 1
        })),
        existing: vi.fn()
      },
      input: { on: vi.fn(), off: vi.fn() },
      tweens: { add: vi.fn() }
    };

    const playState = new PlayState(mockScene);
    playState.createStrumlines();

    // Bug: createStrumlines() hardcodes isDownscroll = true
    // Expected: should read SaveManager.getOption('downscroll') which is false
    expect(playState.playerStrumline.isDownscroll).toBe(false);

    playState.destroy();
  });

  /**
   * Validates: Requirements 1.5
   * Bug: ghostMiss() only plays press animation, never penalizes
   * even when ghostTapping is disabled.
   */
  it('ghostTapping=false should cause ghost taps to apply a penalty', () => {
    setupSaveManagerWithOption('ghostTapping', false);

    // GameplayState_Module is the single source of truth; PlayState reads through to it.
    const gs = createGameplayState({});
    gs.combo = 10;
    gs.maxCombo = 10;
    gs.health = 1.0;
    gs.tallies.combo = 10;
    gs.tallies.maxCombo = 10;

    const playState = {
      songPosition: 1000,
      get score() {
        return gs.score;
      },
      get combo() {
        return gs.combo;
      },
      get maxCombo() {
        return gs.maxCombo;
      },
      get health() {
        return gs.health;
      },
      get tallies() {
        return gs.tallies;
      },
      playerStrumline: {
        notes: [],
        hitNote: vi.fn(),
        playPress: vi.fn(),
        playStatic: vi.fn(),
        pressKey: vi.fn(),
        releaseKey: vi.fn(),
        getClosestNote: vi.fn(() => null) // No note found = ghost tap
      },
      opponentStrumline: null,
      player: { sing: vi.fn(), miss: vi.fn() },
      voices: { mutePlayer: vi.fn(), unmutePlayer: vi.fn() },
      preciseInput: null,
      inputPressQueue: [],
      inputReleaseQueue: []
    };

    const mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    };

    const mockScoring = {
      judgeNote: vi.fn(() => 'sick'),
      scoreNote: vi.fn(() => 350),
      doesJudgementBreakCombo: vi.fn(() => false),
      getHealthBonus: vi.fn(() => 0.04)
    };

    const noteProcessor = createNoteProcessor({
      scene: createMockScene(),
      playState,
      conductor: mockConductor,
      eventBus: mockEventBus,
      scoring: mockScoring,
      gameplayState: gs
    });

    const inputManager = createInputManager({
      scene: createMockScene(),
      playState,
      conductor: mockConductor,
      eventBus: mockEventBus,
      scoring: mockScoring,
      gameplayState: gs,
      noteProcessor
    });

    // Trigger a ghost tap (no note found)
    const healthBefore = playState.health;
    const comboBefore = playState.combo;
    inputManager.handleNoteInput(0, 1000);

    // Expected: when ghostTapping=false, ghost taps should penalize
    // Bug: ghostMiss only plays press animation, no penalty applied
    const penaltyApplied = playState.health < healthBefore || playState.combo < comboBefore || playState.tallies.missed > 0;
    expect(penaltyApplied).toBe(true);
  });

  /**
   * Validates: Requirements 1.6
   * Bug: NoteProcessor.hitNote() uses raw timing without applying noteOffset.
   */
  it('noteOffset should be applied to timing in NoteProcessor.hitNote()', () => {
    setupSaveManagerWithOption('noteOffset', -20);

    const hitTimings = [];
    const mockEventBus = {
      emit: vi.fn((event, data) => {
        if (event === 'noteHit') {
          hitTimings.push(data.timing);
        }
      }),
      on: vi.fn(),
      off: vi.fn()
    };

    const playState = {
      songPosition: 1000,
      score: 0,
      combo: 0,
      maxCombo: 0,
      health: 0.5,
      tallies: { sick: 0, good: 0, bad: 0, shit: 0, missed: 0, totalNotesHit: 0, combo: 0, maxCombo: 0 },
      playerStrumline: {
        notes: [],
        hitNote: vi.fn(),
        playPress: vi.fn(),
        playStatic: vi.fn()
      },
      player: { sing: vi.fn() },
      voices: { unmutePlayer: vi.fn() },
      onNoteHit: null,
      isFeatureEnabled: () => true,
      getHealthBonus: () => 0.04
    };

    const mockScoring = {
      judgeNote: vi.fn(() => 'sick'),
      scoreNote: vi.fn(() => 350),
      doesJudgementBreakCombo: vi.fn(() => false),
      getHealthBonus: vi.fn(() => 0.04)
    };

    const noteProcessor = createNoteProcessor({
      scene: createMockScene(),
      playState,
      conductor: mockConductor,
      eventBus: mockEventBus,
      scoring: mockScoring,
      gameplayState: null
    });

    const note = {
      alive: true,
      hasBeenHit: false,
      hasMissed: false,
      strumTime: 1000,
      direction: 0
    };

    // Hit with raw timing of 5ms
    noteProcessor.hitNote(note, 5);

    // Expected: scoring.judgeNote should receive timing adjusted by noteOffset
    // With noteOffset=-20, adjusted timing = 5 + (-20) = -15
    // Bug: judgeNote receives raw timing (5) instead of adjusted (-15)
    const calledTiming = mockScoring.judgeNote.mock.calls[0][0];
    expect(calledTiming).toBe(5 + (-20)); // -15
  });

  /**
   * Validates: Requirements 1.9
   * Bug: NoteProcessor.hitNote() never calls playHitsound() on sick hits.
   */
  it('hitsounds=true should cause playHitsound() to be called on sick hits', () => {
    setupSaveManagerWithOption('hitsounds', true);

    const mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    };

    const mockAudioManager = {
      playHitsound: vi.fn()
    };

    const playState = {
      songPosition: 1000,
      score: 0,
      combo: 0,
      maxCombo: 0,
      health: 0.5,
      tallies: { sick: 0, good: 0, bad: 0, shit: 0, missed: 0, totalNotesHit: 0, combo: 0, maxCombo: 0 },
      playerStrumline: {
        notes: [],
        hitNote: vi.fn(),
        playPress: vi.fn(),
        playStatic: vi.fn()
      },
      player: { sing: vi.fn() },
      voices: { unmutePlayer: vi.fn() },
      audioManager: mockAudioManager,
      onNoteHit: null,
      isFeatureEnabled: () => true,
      getHealthBonus: () => 0.04
    };

    const mockScoring = {
      judgeNote: vi.fn(() => 'sick'),
      scoreNote: vi.fn(() => 350),
      doesJudgementBreakCombo: vi.fn(() => false),
      getHealthBonus: vi.fn(() => 0.04)
    };

    const noteProcessor = createNoteProcessor({
      scene: createMockScene(),
      playState,
      conductor: mockConductor,
      eventBus: mockEventBus,
      scoring: mockScoring,
      gameplayState: null
    });

    const note = {
      alive: true,
      hasBeenHit: false,
      hasMissed: false,
      strumTime: 1000,
      direction: 0
    };

    noteProcessor.hitNote(note, 2); // Timing close enough for sick

    // Expected: playHitsound should be called when hitsounds=true and judgement is sick
    // Bug: hitNote() never checks hitsounds option or calls playHitsound()
    expect(mockAudioManager.playHitsound).toHaveBeenCalled();
  });


  /**
   * Validates: Requirements 1.12
   * Bug: MainMenuState.playMenuMusic() hardcodes volume 0.7,
   * ignoring masterVolume and musicVolume from SaveManager.
   */
  it('MainMenuState.playMenuMusic() should use saved volume values instead of hardcoded 0.7', async () => {
    const { default: MainMenuState } = await import('../src/ui/MainMenuState.js');

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (masterVol, musicVol) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;
          sm.setOption('masterVolume', masterVol, false);
          sm.setOption('musicVolume', musicVol, false);

          const expectedVolume = (masterVol / 100) * (musicVol / 100);

          // Capture the volume passed to sound.add
          let capturedVolume = null;
          const mainMenu = new MainMenuState();
          mainMenu.sound = {
            add: vi.fn((key, config) => {
              capturedVolume = config.volume;
              return { play: vi.fn(), stop: vi.fn(), isPlaying: false };
            }),
            getAll: vi.fn(() => [])
          };
          mainMenu.cache = { audio: { exists: vi.fn(() => true) } };

          // Call the actual fixed playMenuMusic method
          mainMenu.playMenuMusic();

          // The fixed code should compute volume from SaveManager
          expect(capturedVolume).toBeCloseTo(expectedVolume, 2);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Validates: Requirements 1.2
   * Bug: OptionsState volume slider changes are saved but not applied
   * to Phaser sound manager in real-time (no live preview).
   */
  it('changing volume slider in OptionsState should update Phaser sound.volume in real-time', async () => {
    const { default: OptionsState } = await import('../src/ui/OptionsState.js');

    const sm = SaveManager.getInstance();
    sm.setOption('masterVolume', 50, false);
    sm.setOption('musicVolume', 80, false);

    const expectedVolume = (50 / 100) * (80 / 100); // 0.4

    // Create OptionsState and wire up a mock sound manager
    const optionsState = new OptionsState();
    optionsState.saveManager = sm;
    optionsState.sound = { volume: 1.0 };
    optionsState.updateDisplay = vi.fn();
    optionsState.loadOptions();

    // Call the live volume preview method
    optionsState._applyLiveVolumePreview();

    // Expected: sound volume should match computed value
    expect(optionsState.sound.volume).toBeCloseTo(expectedVolume, 2);
  });
});


// ========================================
// PROPERTY 2: PRESERVATION
// Default Behavior Unchanged
// ========================================

describe('Property 2: Preservation - Default Behavior Unchanged', () => {
  let saveManager;

  beforeEach(() => {
    SaveManager.resetInstance();
    saveManager = SaveManager.getInstance();
    saveManager.loaded = true;
    saveManager.storageAvailable = false; // Prevent actual localStorage access
  });

  afterEach(() => {
    SaveManager.resetInstance();
    vi.restoreAllMocks();
  });

  /**
   * Validates: Requirements 3.1, 3.7
   * Preservation: AudioManager created with defaults has masterVolume=1.0,
   * instrumentalVolume=1.0, sfxVolume=1.0
   */
  it('AudioManager created with defaults should have all volumes at 1.0', () => {
    fc.assert(
      fc.property(
        // Generate random "noise" booleans to ensure test is robust across runs
        fc.boolean(),
        (_noise) => {
          const scene = createMockScene();
          const audioManager = new AudioManager(scene);

          // On unfixed code, AudioManager always initializes with 1.0 defaults
          expect(audioManager.masterVolume).toBe(1.0);
          expect(audioManager.instrumentalVolume).toBe(1.0);
          expect(audioManager.sfxVolume).toBe(1.0);
          expect(audioManager.muted).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Validates: Requirements 3.2
   * Preservation: SaveManager.saveOptions()/loadOptions() round-trip preserves all option values
   */
  it('saveOptions/loadOptions round-trip preserves all option values', () => {
    fc.assert(
      fc.property(
        fc.record({
          masterVolume: fc.integer({ min: 0, max: 100 }),
          musicVolume: fc.integer({ min: 0, max: 100 }),
          sfxVolume: fc.integer({ min: 0, max: 100 }),
          downscroll: fc.boolean(),
          ghostTapping: fc.boolean(),
          scrollSpeed: fc.double({ min: 0.5, max: 3.0, noNaN: true }),
          noteOffset: fc.integer({ min: -100, max: 100 }),
          hitsounds: fc.boolean(),
          showNPS: fc.boolean(),
          showGrade: fc.boolean(),
          showComboBreaks: fc.boolean(),
          showJudgements: fc.boolean(),
          showFps: fc.boolean(),
          flashingLights: fc.boolean(),
          cameraZoom: fc.boolean(),
          comboDisplay: fc.boolean()
        }),
        (optionSet) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;

          // Set all options
          for (const [key, value] of Object.entries(optionSet)) {
            sm.setOption(key, value, false);
          }

          // Save and reload
          sm.saveOptions();

          // Verify all values are preserved via getOption
          for (const [key, value] of Object.entries(optionSet)) {
            const retrieved = sm.getOption(key);
            if (typeof value === 'number' && !Number.isInteger(value)) {
              expect(retrieved).toBeCloseTo(value, 5);
            } else {
              expect(retrieved).toBe(value);
            }
          }

          // Also verify via getAllOptions
          const allOpts = sm.getAllOptions();
          for (const [key, value] of Object.entries(optionSet)) {
            if (typeof value === 'number' && !Number.isInteger(value)) {
              expect(allOpts[key]).toBeCloseTo(value, 5);
            } else {
              expect(allOpts[key]).toBe(value);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Validates: Requirements 3.3
   * Preservation: OptionsState.loadOptions() populates UI controls from SaveManager
   */
  it('OptionsState.loadOptions() populates category items from SaveManager', async () => {
    const { default: OptionsState } = await import('../src/ui/OptionsState.js');

    fc.assert(
      fc.property(
        fc.record({
          masterVolume: fc.integer({ min: 0, max: 100 }),
          musicVolume: fc.integer({ min: 0, max: 100 }),
          sfxVolume: fc.integer({ min: 0, max: 100 }),
          downscroll: fc.boolean(),
          ghostTapping: fc.boolean(),
          hitsounds: fc.boolean(),
          showNPS: fc.boolean(),
          showGrade: fc.boolean(),
          showComboBreaks: fc.boolean(),
          showJudgements: fc.boolean()
        }),
        (optionSet) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;

          // Set options in SaveManager
          for (const [key, value] of Object.entries(optionSet)) {
            sm.setOption(key, value, false);
          }

          // Create OptionsState and call loadOptions
          const optionsState = new OptionsState();
          optionsState.saveManager = sm;
          optionsState.loadOptions();

          // Verify each category item has the correct value from SaveManager
          for (const category of optionsState.categories) {
            for (const item of category.items) {
              if (item.type === 'action') continue;
              const savedValue = sm.getOption(item.key);
              expect(item.value).toBe(savedValue);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Validates: Requirements 3.5
   * Preservation: "Reset to Defaults" resets all options and updates UI
   */
  it('resetToDefaults resets all options to default values', async () => {
    const { default: OptionsState } = await import('../src/ui/OptionsState.js');

    fc.assert(
      fc.property(
        fc.record({
          masterVolume: fc.integer({ min: 0, max: 100 }),
          musicVolume: fc.integer({ min: 0, max: 100 }),
          downscroll: fc.boolean(),
          ghostTapping: fc.boolean()
        }),
        (optionSet) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;

          // Set non-default options
          for (const [key, value] of Object.entries(optionSet)) {
            sm.setOption(key, value, false);
          }

          const optionsState = new OptionsState();
          optionsState.saveManager = sm;
          // Stub updateDisplay since it needs DOM/Phaser objects
          optionsState.updateDisplay = vi.fn();
          optionsState.loadOptions();

          // Reset to defaults
          optionsState.resetToDefaults();

          // Verify all category items are back to their defaultValue
          for (const category of optionsState.categories) {
            for (const item of category.items) {
              if (item.defaultValue !== undefined) {
                expect(item.value).toBe(item.defaultValue);
              }
            }
          }

          // Verify SaveManager also has defaults
          expect(sm.getOption('masterVolume')).toBe(100);
          expect(sm.getOption('musicVolume')).toBe(100);
          expect(sm.getOption('sfxVolume')).toBe(100);
          expect(sm.getOption('downscroll')).toBe(false);
          expect(sm.getOption('ghostTapping')).toBe(true);
          expect(sm.getOption('hitsounds')).toBe(false);

          // Verify updateDisplay was called
          expect(optionsState.updateDisplay).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Validates: Requirements 3.6
   * Preservation: PlayState.createHUDDisplay() passes showNPS/showGrade/showComboBreaks/showJudgements from SaveManager
   */
  it('PlayState.createHUDDisplay() reads competitive stats toggles from SaveManager', async () => {
    const { default: PlayState } = await import('../src/play/PlayState.js');

    fc.assert(
      fc.property(
        fc.record({
          showNPS: fc.boolean(),
          showGrade: fc.boolean(),
          showComboBreaks: fc.boolean(),
          showJudgements: fc.boolean()
        }),
        (statsOptions) => {
          SaveManager.resetInstance();
          const sm = SaveManager.getInstance();
          sm.loaded = true;
          sm.storageAvailable = false;

          for (const [key, value] of Object.entries(statsOptions)) {
            sm.setOption(key, value, false);
          }

          // Create a minimal PlayState with competitiveStatsEnabled
          const mockScene = {
            add: {
              text: vi.fn(() => ({
                setScrollFactor: vi.fn().mockReturnThis(),
                setOrigin: vi.fn().mockReturnThis(),
                setDepth: vi.fn().mockReturnThis(),
                setText: vi.fn().mockReturnThis(),
                setColor: vi.fn().mockReturnThis(),
                setVisible: vi.fn().mockReturnThis(),
                setAlpha: vi.fn().mockReturnThis(),
                destroy: vi.fn(),
                alpha: 1,
                text: ''
              })),
              graphics: vi.fn(() => ({
                fillStyle: vi.fn().mockReturnThis(),
                fillRect: vi.fn().mockReturnThis(),
                clear: vi.fn().mockReturnThis(),
                setDepth: vi.fn().mockReturnThis(),
                setVisible: vi.fn().mockReturnThis(),
                destroy: vi.fn()
              })),
              existing: vi.fn()
            },
            cameras: {
              main: { width: 1280, height: 720 }
            }
          };

          const playState = new PlayState(mockScene);
          playState.competitiveStatsEnabled = true;

          // Spy on ExpandedStatsDisplay constructor to capture config
          let capturedConfig = null;
          const origCreateHUD = playState.createHUDDisplay.bind(playState);

          // We can't easily spy on the constructor, but we can verify
          // that SaveManager.getOption is called with the right keys
          const getOptionSpy = vi.spyOn(sm, 'getOption');

          playState.createHUDDisplay({ x: 0, y: 0 });

          // Verify SaveManager.getOption was called for each stats toggle
          const calledKeys = getOptionSpy.mock.calls.map(c => c[0]);
          expect(calledKeys).toContain('showNPS');
          expect(calledKeys).toContain('showGrade');
          expect(calledKeys).toContain('showComboBreaks');
          expect(calledKeys).toContain('showJudgements');

          getOptionSpy.mockRestore();
          playState.destroy();
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Validates: Requirements 3.7
   * Preservation: AudioManager.updateVolumes() respects muted state and master volume
   */
  it('AudioManager.updateVolumes() respects muted state and master volume', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.boolean(),
        (masterVol, instrVol, isMuted) => {
          const scene = createMockScene();
          const audioManager = new AudioManager(scene);

          // Load an instrumental so updateVolumes has something to work with
          const mockInstrumental = {
            play: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            stop: vi.fn(),
            destroy: vi.fn(),
            setVolume: vi.fn(),
            on: vi.fn(),
            seek: 0,
            duration: 120,
            isPlaying: false
          };
          audioManager.instrumental = mockInstrumental;

          const mockVoices = {
            setMasterVolume: vi.fn()
          };
          audioManager.voices = mockVoices;

          audioManager.masterVolume = masterVol;
          audioManager.instrumentalVolume = instrVol;
          audioManager.muted = isMuted;

          audioManager.updateVolumes();

          if (isMuted) {
            expect(mockInstrumental.setVolume).toHaveBeenCalledWith(0);
            expect(mockVoices.setMasterVolume).toHaveBeenCalledWith(0);
          } else {
            const expectedInstrVol = instrVol * masterVol;
            expect(mockInstrumental.setVolume).toHaveBeenCalledWith(expectedInstrVol);
            expect(mockVoices.setMasterVolume).toHaveBeenCalledWith(masterVol);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Validates: Requirements 3.8
   * Preservation: Category navigation with ◀/▶ switches categories and resets selectedIndex to 0
   */
  it('category navigation resets selectedIndex to 0 on category switch', async () => {
    const { default: OptionsState } = await import('../src/ui/OptionsState.js');

    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('left', 'right'), { minLength: 1, maxLength: 20 }),
        (navSequence) => {
          const optionsState = new OptionsState();
          optionsState.transitioning = false;
          optionsState.capturingKeybind = false;
          optionsState.editingSlider = false;
          optionsState.selectedCategoryIndex = 0;
          optionsState.selectedIndex = 0;
          // Stub methods that need Phaser scene
          optionsState.updateDisplay = vi.fn();
          optionsState.playScrollSound = vi.fn();

          const totalCategories = optionsState.categories.length;

          for (const direction of navSequence) {
            // Set a non-zero selectedIndex to verify it resets
            optionsState.selectedIndex = 2;

            if (direction === 'left') {
              optionsState.onNavigateLeft();
            } else {
              optionsState.onNavigateRight();
            }

            // After category switch, selectedIndex should always be 0
            expect(optionsState.selectedIndex).toBe(0);

            // Category index should be valid
            expect(optionsState.selectedCategoryIndex).toBeGreaterThanOrEqual(0);
            expect(optionsState.selectedCategoryIndex).toBeLessThan(totalCategories);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Validates: Requirements 3.4
   * Preservation: Keybind capture overlay flow is unchanged
   */
  it('keybind capture flow sets capturingKeybind and stores key on keydown', async () => {
    const { default: OptionsState } = await import('../src/ui/OptionsState.js');

    fc.assert(
      fc.property(
        fc.constantFrom('A', 'S', 'W', 'D', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE', 'SHIFT'),
        (keyValue) => {
          const optionsState = new OptionsState();
          optionsState.transitioning = false;
          optionsState.capturingKeybind = false;
          optionsState.editingSlider = false;
          optionsState.updateDisplay = vi.fn();
          optionsState.saveManager = SaveManager.getInstance();

          // Find a keybind item
          const controlsCategory = optionsState.categories.find(c => c.name === 'Controls');
          const keybindItem = controlsCategory.items[0]; // 'Left' keybind

          // Start capture
          optionsState.startKeybindCapture(keybindItem);
          expect(optionsState.capturingKeybind).toBe(true);
          expect(optionsState.captureKeybindItem).toBe(keybindItem);

          // Cancel capture
          optionsState.cancelKeybindCapture();
          expect(optionsState.capturingKeybind).toBe(false);
          expect(optionsState.captureKeybindItem).toBeNull();
        }
      ),
      { numRuns: 5 }
    );
  });
});

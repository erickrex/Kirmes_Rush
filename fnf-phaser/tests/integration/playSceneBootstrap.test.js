/**
 * @fileoverview PlayScene bootstrap smoke tests for the shipped release flow.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const integrationState = vi.hoisted(() => ({
  playStates: [],
  saveManager: {
    loaded: true,
    getInputBufferWindow: vi.fn(() => 42),
    getOption: vi.fn(() => true),
    recordSongResult: vi.fn(() => true)
  }
}));

function createChainableObject(initial = {}) {
  return {
    x: initial.x ?? 0,
    y: initial.y ?? 0,
    alpha: 1,
    setOrigin: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };
}

vi.mock('phaser', () => ({
  default: {
    Scene: class MockScene {
      constructor(config) {
        this.config = config;
        this.scale = { width: 1280, height: 720 };
        this.cameras = {
          main: {
            width: 1280,
            height: 720
          }
        };
        this.add = {
          graphics: vi.fn(() => ({
            setDepth: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            fillGradientStyle: vi.fn().mockReturnThis(),
            fillRect: vi.fn().mockReturnThis(),
            fillStyle: vi.fn().mockReturnThis(),
            destroy: vi.fn()
          })),
          text: vi.fn((x, y) => createChainableObject({ x, y })),
          image: vi.fn((x, y) => createChainableObject({ x, y })),
          sprite: vi.fn((x, y) => createChainableObject({ x, y })),
          circle: vi.fn((x, y) => createChainableObject({ x, y }))
        };
        this.load = {
          on: vi.fn()
        };
        this.sound = {
          stopAll: vi.fn()
        };
        this.input = {
          keyboard: {
            on: vi.fn()
          }
        };
        this.scene = {
          start: vi.fn()
        };
        this.tweens = {
          add: vi.fn(({ onComplete }) => {
            if (typeof onComplete === 'function') {
              onComplete();
            }
          })
        };
        this.textures = {
          exists: vi.fn(() => false)
        };
      }
    }
  }
}));

vi.mock('../../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  Events: {
    SONG_END: 'songEnd',
    GAME_OVER: 'gameOver'
  }
}));

vi.mock('../../src/play/PlayState.js', () => ({
  default: class MockPlayState {
    constructor(scene) {
      this.scene = scene;
      this.health = 0.75;
      this.score = 0;
      this.combo = 0;
      this.tallies = { missed: 0, totalNotesHit: 8, totalNotes: 10, maxCombo: 0 };
      this.playerStrumline = { x: 600, y: 480, getXPos: vi.fn(() => 12) };
      this.opponentStrumline = { x: 120, y: 480, getXPos: vi.fn(() => 12) };
      this.scoreDisplay = {
        setStats: vi.fn(),
        destroy: vi.fn()
      };
      this.levelSystem = null;

      this.init = vi.fn();
      this.setAudioManager = vi.fn();
      this.setVoices = vi.fn();
      this.setPreciseInput = vi.fn();
      this.setLevelSystem = vi.fn((levelSystem) => {
        this.levelSystem = levelSystem;
      });
      this.setupCameras = vi.fn();
      this.wireAudio = vi.fn();
      this.setReplayRecordingEnabled = vi.fn();
      this.setInputBufferEnabled = vi.fn();
      this.createStage = vi.fn(() => this.levelSystem?.isFeatureEnabled('stage') === true);
      this.wireStageAssets = vi.fn();
      this.createCharacters = vi.fn();
      this.wireCharacterAssets = vi.fn();
      this.focusCamera = vi.fn();
      this.createStrumlines = vi.fn();
      this.createHUDDisplay = vi.fn(() => {
        this.scoreDisplay = {
          setStats: vi.fn(),
          destroy: vi.fn()
        };
      });
      this.generateNotes = vi.fn();
      this.startCountdown = vi.fn();
      this.destroy = vi.fn();

      integrationState.playStates.push(this);
    }
  }
}));

vi.mock('../../src/input/InputSystem.js', () => ({
  Controls: class MockControls {},
  PreciseInput: class MockPreciseInput {
    constructor() {}
    destroy() {}
  }
}));

vi.mock('../../src/audio/AudioManager.js', () => ({
  default: class MockAudioManager {
    constructor() {}
    setVoices() {}
  }
}));

vi.mock('../../src/audio/VoicesGroup.js', () => ({
  default: class MockVoicesGroup {
    constructor() {}
  }
}));

vi.mock('../../src/play/HealthBar.js', () => ({
  default: class MockHealthBar {
    constructor() {
      this.x = 0;
    }
    centerX() {}
    setPosition() {}
    setHealthImmediate() {}
    setHealth() {}
    update() {}
    destroy() {}
  }
}));

vi.mock('../../src/play/GeneratedGameplaySkin.js', () => ({
  default: class MockGeneratedGameplaySkin {
    constructor() {}
    createNoteStyle() {
      return {};
    }
    attachStrumline() {}
    update() {}
    destroy() {}
    findAtlasFrame() {
      return null;
    }
    static getLaneColor() {
      return '#ffffff';
    }
  }
}));

vi.mock('../../src/data/registries/CharacterRegistry.js', () => ({
  default: {
    getInstance() {
      return {
        loaded: true
      };
    }
  }
}));

vi.mock('../../src/data/registries/StageRegistry.js', () => ({
  default: {
    getInstance() {
      return {
        loaded: true
      };
    }
  }
}));

vi.mock('../../src/data/registries/NoteStyleRegistry.js', () => ({
  default: {
    getInstance() {
      return {
        loaded: true,
        getSplashData() {
          return [];
        }
      };
    }
  }
}));

vi.mock('../../src/data/SaveManager.js', () => ({
  default: {
    getInstance() {
      return integrationState.saveManager;
    }
  }
}));

import PlayScene from '../../src/scenes/PlayScene.js';

function createSession({ levelId, features, ui = {}, stage = null, characters = {}, difficulty = 'normal' }) {
  return {
    level: {
      id: levelId,
      features: {
        holdNotes: true,
        healthBar: false,
        characters: false,
        stage: false,
        cameraEffects: false,
        noteSplashes: false,
        comboPopups: false,
        expandedStats: false,
        replayRecording: false,
        inputBuffer: false,
        ...features
      },
      ui: {
        showScore: true,
        showCombo: true,
        showAccuracy: false,
        showMisses: false,
        ...ui
      }
    },
    difficulty,
    chart: {
      notes: {
        player: [],
        opponent: []
      },
      scrollSpeed: 1,
      timeChanges: []
    },
    songData: {
      id: 'integration-song',
      stage,
      characters,
      noteStyle: 'funkin'
    },
    audio: {
      instrumental: { key: 'song-integration-instrumental' },
      vocals: {}
    },
    assets: [],
    metadata: {
      playData: {
        stage: 'mainStage',
        characters: {
          player: 'bf',
          opponent: 'dad',
          girlfriend: 'gf'
        }
      }
    }
  };
}

describe('PlayScene release bootstrap', () => {
  beforeEach(() => {
    integrationState.playStates.length = 0;
    integrationState.saveManager.getInputBufferWindow.mockClear();
    integrationState.saveManager.getOption.mockClear();
    integrationState.saveManager.recordSongResult.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps stage and characters disabled for reduced-feature sessions', () => {
    const scene = new PlayScene();
    scene.init({
      session: createSession({
        levelId: 'level-1-basics',
        features: {
          holdNotes: false,
          healthBar: false,
          characters: false,
          stage: false
        }
      })
    });

    scene.create();

    const playState = integrationState.playStates.at(-1);
    expect(playState.createStage).not.toHaveBeenCalled();
    expect(playState.createCharacters).not.toHaveBeenCalled();
    expect(playState.wireStageAssets).not.toHaveBeenCalled();
    expect(playState.wireCharacterAssets).not.toHaveBeenCalled();
    expect(playState.setReplayRecordingEnabled).not.toHaveBeenCalled();
    expect(playState.setInputBufferEnabled).not.toHaveBeenCalled();
    expect(scene.healthBar).toBeNull();
  });

  it('bootstraps full presentation and persists results for the highest-feature session', () => {
    const scene = new PlayScene();
    scene.init({
      session: createSession({
        levelId: 'level-5-mastery',
        difficulty: 'hard',
        stage: 'tankmanBattlefield',
        characters: {
          player: 'bf-holding-gf',
          opponent: 'tankman',
          girlfriend: 'pico-speaker'
        },
        features: {
          healthBar: true,
          characters: true,
          stage: true,
          cameraEffects: true,
          replayRecording: true,
          inputBuffer: true,
          expandedStats: true
        },
        ui: {
          showAccuracy: true,
          showMisses: true
        }
      })
    });

    scene.create();

    const playState = integrationState.playStates.at(-1);
    expect(playState.createStage).toHaveBeenCalledWith('tankmanBattlefield', expect.any(Object));
    expect(playState.wireStageAssets).toHaveBeenCalledWith('tankmanBattlefield', expect.any(Object));
    expect(playState.createCharacters).toHaveBeenCalledWith({
      player: 'bf-holding-gf',
      opponent: 'tankman',
      girlfriend: 'pico-speaker'
    }, expect.any(Object));
    expect(playState.wireCharacterAssets).toHaveBeenCalledWith(expect.any(Object));
    expect(playState.focusCamera).toHaveBeenCalledWith(0, true);
    expect(playState.setReplayRecordingEnabled).toHaveBeenCalledWith(true);
    expect(playState.setInputBufferEnabled).toHaveBeenCalledWith(true, 42);
    expect(scene.healthBar).not.toBeNull();

    scene.handleSongEnd({
      score: 123456,
      rank: 'S',
      tallies: {
        maxCombo: 64
      }
    });

    expect(integrationState.saveManager.recordSongResult).toHaveBeenCalledWith({
      levelId: 'level-5-mastery',
      songId: 'integration-song',
      difficulty: 'hard',
      score: 123456,
      rank: 'S',
      accuracy: 80,
      maxCombo: 64
    });
    expect(scene.scene.start).toHaveBeenCalledWith(
      'ResultState',
      expect.objectContaining({
        accuracy: 80,
        newHighScore: true
      })
    );
  });
});

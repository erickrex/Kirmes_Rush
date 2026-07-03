/**
 * @fileoverview PlayState - Main gameplay scene orchestrator.
 * Delegates to focused modules: GameplayState, NoteProcessor,
 * InputManager, CameraController, and SongFlowController.
 */

import * as Constants from '../core/Constants.js';
import Conductor from '../core/Conductor.js';
import EventBus, { Events } from '../core/EventBus.js';
import Scoring from './Scoring.js';
import Strumline from './Strumline.js';
import Character from './Character.js';
import Stage from './Stage.js';
import SaveManager from '../data/SaveManager.js';
import InputStatistics from '../input/InputStatistics.js';
import ExpandedStatsDisplay from './ExpandedStatsDisplay.js';
import ScoreDisplay from './ScoreDisplay.js';
import OpponentIndicator from './OpponentIndicator.js';
import ComboPopup from './ComboPopup.js';
import NoteSplash from './NoteSplash.js';
import HealthIcon from './HealthIcon.js';
import { acquireHealthIconTexture } from './HealthIconTextures.js';
import {
  PLAYER_STRUMLINE_X,
  PLAYER_STRUMLINE_Y,
  COMBO_POPUP_X,
  COMBO_POPUP_Y
} from '../layout/LayoutManager.js';
import { ReplayRecorder, ReplayPlayer } from '../replay/ReplaySystem.js';
import { InputBuffer } from '../input/InputSystem.js';
import TouchDeviceDetector from '../input/TouchDeviceDetector.js';
import TouchInputController from '../input/TouchInputController.js';
import PerformanceMonitor from '../core/PerformanceMonitor.js';
import {
  registerCharacterAnimations,
  registerPropAnimations
} from '../graphics/AnimationRegistrar.js';
import { createGameplayState } from './GameplayState.js';
import { createNoteProcessor } from './NoteProcessor.js';
import { createInputManager } from './InputManager.js';
import { createCameraController } from './CameraController.js';
import { createSongFlowController } from './SongFlowController.js';

/**
 * @typedef {import('../types.js').SongMetadata} SongMetadata
 * @typedef {import('../types.js').ChartData} ChartData
 * @typedef {import('../types.js').Tallies} Tallies
 * @typedef {import('../types.js').NoteData} NoteData
 * @typedef {import('../types.js').Judgement} Judgement
 * @typedef {import('../types.js').ReplayData} ReplayData
 * @typedef {import('../graphics/RythmCamera.js').default} RythmCamera
 * @typedef {import('../audio/AudioManager.js').default} AudioManager
 * @typedef {import('../audio/VoicesGroup.js').default} VoicesGroup
 * @typedef {{ direction: number, timestamp: number, keyCode?: string }} QueuedInput
 * @typedef {{
 *   x?: number,
 *   y?: number,
 *   align?: string,
 *   showCombo?: boolean,
 *   showAccuracy?: boolean,
 *   showMisses?: boolean,
 *   showNPS?: boolean,
 *   showGrade?: boolean,
 *   showComboBreaks?: boolean,
 *   showJudgements?: boolean,
 *   splashTextureKey?: string | null,
 *   noteStyleId?: string | null,
 *   noteStyleRegistry?: { areSplashesEnabled?: (styleId: string | null) => boolean } | null,
 *   characterRegistry?: { getHealthIconData?: (charId: string) => Record<string, any> | null } | null,
 *   playerCharacterId?: string | null,
 *   opponentCharacterId?: string | null
 * }} HUDDisplayConfig
 */

/**
 * @typedef {Object} PlayStateCharacterConfig
 * @property {string} [player] - Player character ID
 * @property {string} [opponent] - Opponent character ID
 * @property {string} [girlfriend] - Girlfriend character ID
 */

/**
 * @typedef {Object} PlayStateInitConfig
 * @property {SongMetadata | null} [song] - Song metadata
 * @property {string} [difficulty] - Difficulty level
 * @property {number} [startTimestamp] - Start timestamp in ms
 * @property {ChartData | null} [chart] - Chart data
 */

/**
 * @typedef {Object} SessionAudio
 * @property {{ key: string }} [instrumental] - Instrumental audio reference
 * @property {{ player?: { key: string }, opponent?: { key: string }, combined?: { key: string } }} [vocals] - Vocal audio references
 */

/**
 * @typedef {Object} CameraEventData
 * @property {number} [char] - Character index
 * @property {number} [zoom] - Zoom level
 * @property {boolean} [instant] - Whether to apply instantly
 * @property {{ char?: number, zoom?: number, instant?: boolean }} [value] - Nested event value
 */

/**
 * @typedef {Object} LevelSystem
 * @property {(featureName: string) => boolean} isFeatureEnabled - Check if a feature is enabled
 */

/**
 * @typedef {Object} PreciseInputInstance
 * @property {() => QueuedInput[]} consumePresses - Consume press events
 * @property {() => QueuedInput[]} consumeReleases - Consume release events
 */

/**
 * @typedef {Object} GameplayStateModule
 * @property {number} health
 * @property {number} score
 * @property {number} combo
 * @property {number} maxCombo
 * @property {Tallies | null} tallies
 * @property {() => void} reset
 * @property {(delta: number) => void} updateHealth
 * @property {(points: number) => void} updateScore
 * @property {(judgement: string) => void} updateCombo
 * @property {(judgement: string, score: number) => void} updateTallies
 * @property {(judgement: string) => number} getHealthBonus
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} NoteProcessorModule
 * @property {() => void} checkMissedNotes
 * @property {() => void} processOpponentNotes
 * @property {(note: any, timing: number) => void} hitNote
 * @property {(direction: number) => void} ghostMiss
 * @property {(note: any) => void} opponentHitNote
 * @property {(note: any) => void} missNote
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} InputManagerModule
 * @property {() => void} processInputQueue
 * @property {(direction: number, timestamp: number, keyCode?: string) => void} handleNoteInput
 * @property {(direction: number, timestamp: number) => void} handleNoteRelease
 * @property {() => void} processBufferedInputs
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} CameraControllerModule
 * @property {Phaser.Cameras.Scene2D.Camera | null} camGame
 * @property {Phaser.Cameras.Scene2D.Camera | null} camHUD
 * @property {RythmCamera | null} rythmCamera
 * @property {number} cameraFocusTarget
 * @property {() => void} setupCameras
 * @property {(target: number, instant?: boolean) => void} focusCamera
 * @property {(target: number) => Character | null} getCameraFocusCharacter
 * @property {(eventData: any) => void} handleFocusCameraEvent
 * @property {(eventData: any) => void} handleZoomCameraEvent
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} SongFlowControllerModule
 * @property {() => void} startCountdown
 * @property {(step: number) => void} scheduleCountdownStep
 * @property {(step: number) => void} executeCountdownStep
 * @property {() => void} startSong
 * @property {() => void} endSong
 * @property {() => void} gameOver
 * @property {() => void} destroy
 */

/**
 * Main gameplay scene for Rythm Foundation.
 * Orchestrates focused modules for note processing, input, camera, scoring, and song flow.
 */
class PlayState {
  // Core references
  /** @type {(Phaser.Scene & { registerHudObject?: (obj: any) => any }) | null} */
  scene = null;
  /** @type {SongMetadata | null} */
  songData = null;
  /** @type {string} */
  difficulty = Constants.DEFAULT_DIFFICULTY;
  /** @type {number} */
  startTimestamp = 0;
  /** @type {ChartData | null} */
  chart = null;
  /** @type {Conductor | null} */
  conductor = null;

  // Gameplay state is owned by the GameplayState_Module (`_gameplayState`), the single
  // source of truth for health/score/combo/maxCombo/tallies. The accessors below preserve
  // the public read/write API used by the HUD, results flow, and tests while delegating
  // all storage to `_gameplayState` (see getters/setters near the end of the class).

  // Timing
  /** @type {number} */
  songPosition = 0;
  /** @type {number} */
  songLength = 0;
  /** @type {boolean} */
  songStarted = false;
  /** @type {boolean} */
  countdownActive = false;
  /** @type {number} */
  countdownStep = 0;

  // Strumlines
  /** @type {Strumline | null} */
  playerStrumline = null;
  /** @type {Strumline | null} */
  opponentStrumline = null;

  // Opponent indicator (portrait mode)
  /** @type {OpponentIndicator | null} */
  opponentIndicator = null;

  // Input
  /** @type {QueuedInput[]} */
  inputPressQueue = [];
  /** @type {QueuedInput[]} */
  inputReleaseQueue = [];
  /** @type {PreciseInputInstance | null} */
  preciseInput = null;
  /** @type {TouchInputController | null} */
  touchInputController = null;

  // Performance monitoring
  /** @type {PerformanceMonitor | null} */
  performanceMonitor = null;

  // Competitive stats
  /** @type {InputStatistics | null} */
  inputStatistics = null;
  /** @type {boolean} */
  competitiveStatsEnabled = false;
  /** @type {ScoreDisplay | ExpandedStatsDisplay | null} */
  scoreDisplay = null;

  // Combo popup (judgement + combo-number HUD feedback)
  /** @type {ComboPopup | null} */
  comboPopup = null;

  // Note splash (perfect-hit splash effect at the player receptors)
  /** @type {NoteSplash | null} */
  noteSplash = null;

  // Health icons (player + opponent), driven against the scene-owned HealthBar.
  /** @type {HealthIcon | null} */
  playerHealthIcon = null;
  /** @type {HealthIcon | null} */
  opponentHealthIcon = null;
  // The HealthBar is owned by the scene (PlayScene). PlayState only needs a
  // read reference so it can position the icons against the bar fill each frame.
  /** @type {Record<string, any> | null} */
  healthBar = null;

  // Replay
  /** @type {ReplayRecorder | null} */
  replayRecorder = null;
  /** @type {boolean} */
  replayRecordingEnabled = false;
  /** @type {ReplayPlayer | null} */
  replayPlayer = null;
  /** @type {boolean} */
  replayMode = false;
  /** @type {Phaser.GameObjects.Text | null} */
  replayIndicator = null;

  // Systems
  /** @type {LevelSystem | null} */
  levelSystem = null;
  /** @type {InputBuffer | null} */
  inputBuffer = null;
  /** @type {boolean} */
  inputBufferEnabled = false;
  /** @type {AudioManager | null} */
  audioManager = null;
  /** @type {VoicesGroup | null} */
  voices = null;

  // Visual options (read from SaveManager in PlayScene.create())
  /** @type {boolean} */
  flashingLights = true;
  /** @type {boolean} */
  cameraZoomEnabled = true;
  /** @type {boolean} */
  comboDisplayEnabled = true;

  // Cameras (synced from CameraController for backward compat)
  /** @type {Phaser.Cameras.Scene2D.Camera | null} */
  camGame = null;
  /** @type {Phaser.Cameras.Scene2D.Camera | null} */
  camHUD = null;
  /** @type {RythmCamera | null} */
  rythmCamera = null;
  /** @type {number} */
  cameraFocusTarget = 0;

  // Characters & Stage
  /** @type {Character | null} */
  player = null;
  /** @type {Character | null} */
  opponent = null;
  /** @type {Character | null} */
  girlfriend = null;
  /** @type {Stage | null} */
  stage = null;

  // Callbacks
  /** @type {((note: NoteData, judgement: Judgement) => void) | null} */
  onNoteHit = null;
  /** @type {(() => void) | null} */
  onNoteMiss = null;
  /** @type {((score: number, tallies: Tallies, rank: string, replayData: any, timingStats: any) => void) | null} */
  onSongEnd = null;
  /** @type {((step: number, name?: string) => void) | null} */
  onCountdownStep = null;

  // Modules (private)
  /** @type {GameplayStateModule | null} */
  _gameplayState = null;
  /** @type {NoteProcessorModule | null} */
  _noteProcessor = null;
  /** @type {InputManagerModule | null} */
  _inputManager = null;
  /** @type {CameraControllerModule | null} */
  _cameraController = null;
  /** @type {SongFlowControllerModule | null} */
  _songFlowController = null;

  /** @type {((data: { timing: number, judgement: string }) => void) | null} */
  _onNoteHitForStats = null;
  /** @type {(() => void) | null} */
  _onComboBreakForStats = null;
  /** @type {((data: { judgement: string, combo?: number }) => void) | null} */
  _onNoteHitForCombo = null;
  /** @type {((data: { judgement: string, direction?: number, receptor?: { x: number, y: number } | null }) => void) | null} */
  _onNoteHitForSplash = null;

  /**
   * @param {Phaser.Scene & { registerHudObject?: (obj: any) => any }} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.conductor = Conductor.instance;

    /** @type {any} */
    const context = {
      scene,
      playState: this,
      conductor: this.conductor,
      eventBus: EventBus,
      scoring: Scoring,
      gameplayState: null,
      noteProcessor: null
    };

    this._gameplayState = /** @type {GameplayStateModule} */ (createGameplayState(context));
    context.gameplayState = this._gameplayState;
    this._noteProcessor = /** @type {NoteProcessorModule} */ (createNoteProcessor(context));
    context.noteProcessor = this._noteProcessor;
    this._inputManager = /** @type {InputManagerModule} */ (createInputManager(context));
    this._cameraController = /** @type {CameraControllerModule} */ (
      createCameraController(context)
    );
    this._songFlowController = /** @type {SongFlowControllerModule} */ (
      createSongFlowController(context)
    );

    // Bind competitive stats event handlers
    this._onNoteHitForStats = (data) => {
      if (this.inputStatistics) {
        this.inputStatistics.recordHit(data.timing, data.judgement);
      }
      if (this.scoreDisplay instanceof ExpandedStatsDisplay) {
        this.scoreDisplay.recordHit(data.judgement, data.timing);
      }
    };
    this._onComboBreakForStats = () => {
      if (this.scoreDisplay instanceof ExpandedStatsDisplay) {
        this.scoreDisplay.recordComboBreak();
      }
    };
    // Drive the combo popup where note hits are handled. The NOTE_HIT payload
    // carries the authoritative judgement and current combo (from GameplayState),
    // so the popup always reflects the single-source-of-truth combo value.
    this._onNoteHitForCombo = (data) => {
      if (this.comboPopup && data?.judgement) {
        this.comboPopup.showJudgement(
          data.judgement,
          data.combo ?? 0,
          COMBO_POPUP_X,
          COMBO_POPUP_Y
        );
      }
    };
    EventBus.on(Events.NOTE_HIT, this._onNoteHitForStats);
    EventBus.on(Events.COMBO_BREAK, this._onComboBreakForStats);
    EventBus.on(Events.NOTE_HIT, this._onNoteHitForCombo);
    // Drive note splashes on perfect hits. The NOTE_HIT payload carries the hit
    // `direction` and the resolved player `receptor` position (added with the
    // single-owner refactor), so splashes spawn at the correct receptor without
    // PlayState having to recompute strumline geometry. Only `sick`/`killer`
    // judgements produce a splash; NoteSplash itself is a no-op when disabled.
    this._onNoteHitForSplash = (data) => {
      if (!this.noteSplash || !data) {
        return;
      }
      if (data.judgement !== 'sick' && data.judgement !== 'killer') {
        return;
      }
      if (data.receptor) {
        this.noteSplash.spawnAtReceptor(data.receptor, data.direction ?? 0);
      }
    };
    EventBus.on(Events.NOTE_HIT, this._onNoteHitForSplash);
  }

  // ---------------------------------------------------------------------------
  // Gameplay-state read-through accessors (single source of truth: _gameplayState)
  // ---------------------------------------------------------------------------

  /** @returns {number} */
  get health() {
    return this._gameplayState?.health ?? Constants.HEALTH_STARTING;
  }
  /** @param {number} value */
  set health(value) {
    if (this._gameplayState) {
      this._gameplayState.health = value;
    }
  }

  /** @returns {number} */
  get score() {
    return this._gameplayState?.score ?? 0;
  }
  /** @param {number} value */
  set score(value) {
    if (this._gameplayState) {
      this._gameplayState.score = value;
    }
  }

  /** @returns {number} */
  get combo() {
    return this._gameplayState?.combo ?? 0;
  }
  /** @param {number} value */
  set combo(value) {
    if (this._gameplayState) {
      this._gameplayState.combo = value;
    }
  }

  /** @returns {number} */
  get maxCombo() {
    return this._gameplayState?.maxCombo ?? 0;
  }
  /** @param {number} value */
  set maxCombo(value) {
    if (this._gameplayState) {
      this._gameplayState.maxCombo = value;
    }
  }

  /** @returns {Tallies} */
  get tallies() {
    return /** @type {Tallies} */ (this._gameplayState?.tallies ?? Scoring.createTallies());
  }
  /** @param {Tallies} value */
  set tallies(value) {
    if (this._gameplayState) {
      this._gameplayState.tallies = value;
    }
  }

  /**
   * @param {PlayStateInitConfig} config
   */
  init(config) {
    this.songData = config.song ?? null;
    this.difficulty = config.difficulty ?? Constants.DEFAULT_DIFFICULTY;
    this.startTimestamp = config.startTimestamp ?? 0;
    this.chart = config.chart ?? null;
    this.resetState();

    // Initialize competitive stats
    this.competitiveStatsEnabled = this.isCompetitiveStatsEnabled();
    if (this.competitiveStatsEnabled) {
      this.inputStatistics = new InputStatistics();
    }

    // Initialize performance monitor
    if (this.scene?.game) {
      this.performanceMonitor = new PerformanceMonitor(this.scene.game);
    }

    if (this.conductor && this.chart) {
      const chartAny = /** @type {any} */ (this.chart);
      if (chartAny.timeChanges) {
        this.conductor.mapTimeChanges(chartAny.timeChanges);
      }
    }
    if (this.chart?.notes) {
      const chartNotes = /** @type {any} */ (this.chart.notes);
      const allNotes = [...(chartNotes.player ?? []), ...(chartNotes.opponent ?? [])];
      if (allNotes.length > 0) {
        const lastNote = allNotes.reduce((/** @type {any} */ a, /** @type {any} */ b) =>
          a.time > b.time ? a : b
        );
        this.songLength = lastNote.time + (lastNote.length ?? 0) + 1000;
      }
    }
    if (this.chart?.notes) {
      const chartNotes = /** @type {any} */ (this.chart.notes);
      if (chartNotes.player) {
        this.tallies.totalNotes = chartNotes.player.length;
      }
    }
  }

  resetState() {
    if (this._gameplayState) {
      this._gameplayState.reset();
    }
    this.songPosition = 0;
    this.songStarted = false;
    this.countdownActive = false;
    this.countdownStep = 0;
    this.inputPressQueue = [];
    this.inputReleaseQueue = [];
    if (this.inputStatistics) {
      this.inputStatistics.reset();
    }
  }

  /**
   * @param {any} [noteStyle=null] - Note style configuration
   * @param {number} [scrollSpeed=1.0] - Scroll speed multiplier
   */
  createStrumlines(noteStyle = null, scrollSpeed = 1.0) {
    if (!this.scene) {
      return;
    }
    // Player strumline: centered horizontally, forced downscroll, portrait Y position
    this.playerStrumline = new Strumline(this.scene, true, noteStyle, scrollSpeed);
    this.playerStrumline.setPosition(PLAYER_STRUMLINE_X, PLAYER_STRUMLINE_Y);
    this.playerStrumline.isDownscroll = SaveManager.getInstance().getOption('downscroll') ?? false;

    // Opponent strumline: hidden, used for timing/scoring only
    this.opponentStrumline = new Strumline(this.scene, false, noteStyle, scrollSpeed);
    this.opponentStrumline.setPosition(Constants.STRUMLINE_X_OFFSET, Constants.STRUMLINE_Y_OFFSET);
    /** @type {any} */ (this.opponentStrumline).visible = false;
    this.opponentStrumline.renderNotes = false;

    // Opponent indicator widget replaces visible opponent strumline
    this.opponentIndicator = new OpponentIndicator(this.scene);
    this.opponentIndicator.create();

    // Touch input controller for mobile devices
    this.createTouchInputController();
  }

  /**
   * Create touch input controller if on a touch device.
   * Passes input queues so touch events feed into the same pipeline as keyboard.
   */
  createTouchInputController() {
    if (!this.scene) {
      return;
    }
    if (TouchDeviceDetector.isTouch()) {
      this.touchInputController = new TouchInputController(this.scene, {
        pressQueue: this.inputPressQueue,
        releaseQueue: this.inputReleaseQueue
      });
      this.touchInputController.create();
    }
  }

  setupCameras() {
    if (!this._cameraController) {
      return;
    }
    this._cameraController.setupCameras();
    this.camGame = this._cameraController.camGame;
    this.camHUD = this._cameraController.camHUD;
    this.rythmCamera = this._cameraController.rythmCamera;
  }

  /**
   * @param {string | null} stageId - Stage ID to load
   * @param {any} registry - Stage registry instance
   * @returns {boolean} Whether stage creation succeeded
   */
  createStage(stageId, registry) {
    if (!this.isFeatureEnabled('stage')) {
      return false;
    }
    if (!this.scene) {
      return false;
    }
    const chartAny = /** @type {any} */ (this.chart);
    const songAny = /** @type {any} */ (this.songData);
    const id = stageId || chartAny?.stage || songAny?.stage || Constants.DEFAULT_STAGE;
    this.stage = new Stage(this.scene, id);
    if (!this.stage.loadFromRegistry(registry)) {
      console.warn(`[PlayState] Failed to load stage: ${id}`);
      return false;
    }
    this.stage.create();
    if (this.rythmCamera) {
      this.rythmCamera.setDefaultZoom(this.stage.cameraZoom);
      this.rythmCamera.setZoom(this.stage.cameraZoom, true);
    }
    return true;
  }

  /**
   * @param {PlayStateCharacterConfig} config - Character ID overrides
   * @param {any} [registry] - Character registry instance
   */
  createCharacters(config, registry) {
    config = config || {};
    if (!this.isFeatureEnabled('characters')) {
      return;
    }
    const chartAny = /** @type {any} */ (this.chart);
    const songAny = /** @type {any} */ (this.songData);
    const playerChar = config.player || chartAny?.player || songAny?.player || 'bf';
    const opponentChar = config.opponent || chartAny?.opponent || songAny?.opponent || 'dad';
    const gfChar = config.girlfriend || chartAny?.girlfriend || songAny?.girlfriend || 'gf';
    this.girlfriend = this.createCharacter(gfChar, 'gf', false, registry);
    this.opponent = this.createCharacter(opponentChar, 'dad', false, registry);
    this.player = this.createCharacter(playerChar, 'bf', true, registry);
    this.positionCharacters();
  }

  /**
   * @param {string} characterId - Character ID to create
   * @param {string} _charType - Character type (bf, dad, gf)
   * @param {boolean} isPlayer - Whether this is the player character
   * @param {any} registry - Character registry instance
   * @returns {Character | null}
   */
  createCharacter(characterId, _charType, isPlayer, registry) {
    if (!this.scene) {
      return null;
    }
    const character = new Character(this.scene, 0, 0, characterId, isPlayer);
    if (!character.loadFromRegistry(registry)) {
      console.warn(`[PlayState] Failed to load character: ${characterId}`);
      return null;
    }
    this.scene.add?.existing(character);
    return character;
  }

  positionCharacters() {
    if (!this.stage) {
      return;
    }
    if (this.player) {
      this.stage.positionCharacter(this.player, 'bf');
    }
    if (this.opponent) {
      this.stage.positionCharacter(this.opponent, 'dad');
    }
    if (this.girlfriend) {
      this.stage.positionCharacter(this.girlfriend, 'gf');
    }
  }

  /**
   * Wire character textures and animations from loaded assets.
   * @param {any} characterRegistry - Character registry with getCharacterAnimations
   */
  wireCharacterAssets(characterRegistry) {
    const characters = [
      { ref: this.player, label: 'player' },
      { ref: this.opponent, label: 'opponent' },
      { ref: this.girlfriend, label: 'girlfriend' }
    ];
    for (const { ref } of characters) {
      if (!ref || !this.scene) {
        continue;
      }
      const id = ref.characterId;
      const textureKey = `char-${id}`;
      if (!this.scene.textures.exists(textureKey)) {
        continue;
      }
      ref.setTexture(textureKey);
      /** @type {any} */ (ref)._textureKey = textureKey;
      registerCharacterAnimations(
        this.scene,
        textureKey,
        characterRegistry.getCharacterAnimations(id)
      );
      const charData = /** @type {any} */ (ref.characterData);
      const startAnim = charData?.startingAnimation || 'idle';
      const namespacedKey = `${textureKey}-${startAnim}`;
      if (this.scene.anims.exists(namespacedKey)) {
        ref.play({ key: namespacedKey, repeat: -1 }, true);
      }
    }
  }

  /**
   * Wire stage prop textures and animations from loaded assets.
   * @param {string} stageId - Stage ID
   * @param {any} stageRegistry - Stage registry with getStageProps
   */
  wireStageAssets(stageId, stageRegistry) {
    const props = stageRegistry.getStageProps(stageId);
    for (const prop of props) {
      const sprite = this.stage?.getProp(prop.name);
      if (!sprite || !this.scene) {
        continue;
      }
      const textureKey = `stage-${stageId}-${prop.name}`;
      if (!this.scene.textures.exists(textureKey)) {
        console.warn(`[PlayState] Missing stage texture: ${textureKey}`);
        continue;
      }

      sprite.setTexture(textureKey);
      /** @type {any} */ (sprite)._textureKey = textureKey;
      if (prop.animations && prop.animations.length > 0) {
        registerPropAnimations(this.scene, textureKey, prop.animations);
        const startAnimKey = `${textureKey}-${prop.startingAnimation}`;
        if (prop.startingAnimation && this.scene.anims.exists(startAnimKey)) {
          sprite.playAnimation(prop.startingAnimation);
        }
      }
    }
  }

  /**
   * Wire audio tracks from session audio references.
   * @param {SessionAudio} sessionAudio - Audio session data
   */
  wireAudio(sessionAudio) {
    if (sessionAudio.instrumental && this.audioManager) {
      this.audioManager.loadInstrumental(sessionAudio.instrumental.key);
    }
    if (sessionAudio.vocals?.player && sessionAudio.vocals?.opponent && this.voices) {
      this.voices.loadSplit(sessionAudio.vocals.player.key, sessionAudio.vocals.opponent.key);
    }
    if (sessionAudio.vocals?.combined && this.voices) {
      this.voices.loadCombined(sessionAudio.vocals.combined.key);
    }
    if (this.audioManager && this.voices) {
      this.audioManager.setVoices(this.voices);
    }
  }

  /**
   * Get a character by type.
   * @param {string} charType - Character type (bf, player, dad, opponent, gf, girlfriend)
   * @returns {Character | null}
   */
  getCharacter(charType) {
    switch (charType) {
      case 'bf':
      case 'player':
        return this.player;
      case 'dad':
      case 'opponent':
        return this.opponent;
      case 'gf':
      case 'girlfriend':
        return this.girlfriend;
      default:
        return null;
    }
  }

  // Setters
  /** @param {AudioManager} audioManager */
  setAudioManager(audioManager) {
    this.audioManager = audioManager;
  }
  /** @param {VoicesGroup} voices */
  setVoices(voices) {
    this.voices = voices;
  }
  /** @param {PreciseInputInstance} preciseInput */
  setPreciseInput(preciseInput) {
    this.preciseInput = preciseInput;
  }
  /** @param {LevelSystem} levelSystem */
  setLevelSystem(levelSystem) {
    this.levelSystem = levelSystem;
  }

  /** @param {boolean} enabled */
  setReplayRecordingEnabled(enabled) {
    this.replayRecordingEnabled = enabled;
    if (enabled && !this.replayRecorder) {
      this.replayRecorder = new ReplayRecorder();
    }
  }

  /**
   * Check if a gameplay feature is enabled via the level system.
   * @param {string} featureName - Feature name to check
   * @returns {boolean}
   */
  isFeatureEnabled(featureName) {
    if (!this.levelSystem) {
      return true;
    }
    return this.levelSystem.isFeatureEnabled(featureName);
  }

  /**
   * Check if competitive stats are enabled.
   * @returns {boolean}
   */
  isCompetitiveStatsEnabled() {
    if (!this.levelSystem) {
      return true;
    }
    return this.levelSystem.isFeatureEnabled('expandedStats');
  }

  /**
   * @param {HUDDisplayConfig} [config={}]
   */
  createHUDDisplay(config = {}) {
    if (!this.scene) {
      return;
    }
    if (this.competitiveStatsEnabled) {
      const saveManager = SaveManager.getInstance();
      this.scoreDisplay = new ExpandedStatsDisplay(this.scene, {
        x: config.x,
        y: config.y,
        align: config.align,
        showCombo: config.showCombo,
        showAccuracy: config.showAccuracy,
        showMisses: config.showMisses,
        showNPS: saveManager.getOption('showNPS'),
        showGrade: saveManager.getOption('showGrade'),
        showComboBreaks: saveManager.getOption('showComboBreaks'),
        showJudgements: saveManager.getOption('showJudgements')
      });
    } else {
      this.scoreDisplay = new ScoreDisplay(this.scene, config);
    }

    // Combo popup — judgement text + combo numbers, registered on the HUD camera
    // so popups render fixed to the screen. Game objects are created lazily on the
    // first hit; the registerObject hook assigns each to the HUD layer as it appears.
    this.comboPopup = new ComboPopup(this.scene, {
      x: COMBO_POPUP_X,
      y: COMBO_POPUP_Y,
      showComboNumbers: this.comboDisplayEnabled,
      registerObject: (obj) => this.registerHudObject(obj)
    });
    // Respect the `comboDisplay` save option for combo numbers.
    this.comboPopup.setShowComboNumbers(this.comboDisplayEnabled);

    // Note splash — spawned at the player receptors on perfect (sick/killer)
    // hits, registered on the HUD camera so it renders fixed on the receptor
    // layer. Prefers a loaded note-style splash atlas; NoteSplash falls back to
    // a generated burst when that texture is present but unresolved.
    const splashTextureKey = config.splashTextureKey ?? null;
    this.noteSplash = new NoteSplash(this.scene, {
      splashTextureKey: splashTextureKey ?? undefined,
      registerObject: (obj) => this.registerHudObject(obj)
    });
    // Gate splashes off when the note style reports them disabled, or when no
    // splash asset is loaded for the active style (Requirement 3.4). A disabled
    // NoteSplash spawns no game objects.
    const noteStyleRegistry = config.noteStyleRegistry ?? null;
    const splashesAllowedByStyle =
      noteStyleRegistry && typeof noteStyleRegistry.areSplashesEnabled === 'function'
        ? noteStyleRegistry.areSplashesEnabled(config.noteStyleId ?? null)
        : true;
    const splashAssetAvailable = Boolean(
      splashTextureKey && this.scene.textures?.exists?.(splashTextureKey)
    );
    if (!splashesAllowedByStyle || !splashAssetAvailable) {
      this.noteSplash.setEnabled(false);
    }

    // Health icons — one for the player, one for the opponent. Both render fixed
    // to the screen on the HUD camera and react to the single-source-of-truth
    // health each frame. Created here in HUD setup; positioned against the
    // scene-owned HealthBar in the update loop once `setHealthBar` is wired.
    this.createHealthIcons(config);
  }

  /**
   * Create the player and opponent health icons from the active characters.
   * Always creates two visible icons (placeholder texture when no real icon
   * asset is loaded), registered on the HUD camera. No-ops in headless scenes.
   * @param {HUDDisplayConfig} [config={}]
   */
  createHealthIcons(config = {}) {
    if (!this.scene?.add) {
      return;
    }
    const registry = config.characterRegistry ?? null;
    const playerCharId =
      config.playerCharacterId ?? this.player?.characterId ?? Constants.DEFAULT_HEALTH_ICON;
    const opponentCharId =
      config.opponentCharacterId ?? this.opponent?.characterId ?? Constants.DEFAULT_HEALTH_ICON;

    this.playerHealthIcon = this.createHealthIcon(playerCharId, 0, registry);
    this.opponentHealthIcon = this.createHealthIcon(opponentCharId, 1, registry);
  }

  /**
   * Create a single health icon: configure it from the character registry,
   * assign a texture (real icon when present, else a generated placeholder),
   * add it to the scene display list, and register it on the HUD camera.
   * @param {string} characterId - Character ID for the icon
   * @param {number} playerId - 0 = player, 1 = opponent
   * @param {{ getHealthIconData?: (charId: string) => Record<string, any> | null } | null} registry
   * @returns {HealthIcon | null}
   */
  createHealthIcon(characterId, playerId, registry) {
    if (!this.scene) {
      return null;
    }
    const icon = new HealthIcon(this.scene, 0, 0, characterId, playerId);

    // Configure scale/offsets/flip/pixel from the registry (Requirement 4.2).
    const iconData =
      registry && typeof registry.getHealthIconData === 'function'
        ? registry.getHealthIconData(characterId)
        : null;
    if (iconData) {
      icon.configure(iconData);
    }

    // Guarantee a visible texture: real icon when loaded, else generated
    // placeholder (Requirement 4.3). Reads characterId/playerId off the icon.
    acquireHealthIconTexture(this.scene, icon, { playerId });

    // Snap to the configured target size so the icon is correctly sized before
    // the first bop/lerp frame.
    if (typeof icon.snapToTargetSize === 'function') {
      icon.snapToTargetSize();
    }

    this.scene.add?.existing?.(/** @type {any} */ (icon));
    this.registerHudObject(icon);
    return icon;
  }

  /**
   * Provide the scene-owned HealthBar so the icons can be positioned against
   * its fill each frame. Called by PlayScene after the bar is created.
   * @param {Record<string, any> | null} healthBar - HealthBar instance
   */
  setHealthBar(healthBar) {
    this.healthBar = healthBar ?? null;
  }

  /**
   * Register a Phaser game object on the HUD camera layer so it renders fixed to
   * the screen. Mirrors the scene's HUD registration when available, otherwise
   * falls back to pinning scroll factor and ignoring on the game camera.
   * @param {any} obj - The game object to register
   * @returns {any}
   */
  registerHudObject(obj) {
    if (!obj) {
      return obj;
    }
    if (typeof this.scene?.registerHudObject === 'function') {
      return this.scene.registerHudObject(obj);
    }
    if (typeof obj.setScrollFactor === 'function') {
      obj.setScrollFactor(0);
    }
    if (this.camGame && typeof this.camGame.ignore === 'function') {
      try {
        this.camGame.ignore(obj);
      } catch {
        // Ignore objects that cannot be assigned to a camera layer.
      }
    }
    return obj;
  }

  /**
   * @param {boolean} enabled - Whether input buffer is enabled
   * @param {number} [windowMs=50] - Buffer window in ms
   */
  setInputBufferEnabled(enabled, windowMs = 50) {
    this.inputBufferEnabled = enabled;
    if (enabled && !this.inputBuffer) {
      this.inputBuffer = new InputBuffer(windowMs);
    } else if (!enabled && this.inputBuffer) {
      this.inputBuffer.clear();
    }
  }

  // Replay playback
  /**
   * Load replay data for playback.
   * @param {ReplayData} replayData - Replay data to load
   * @returns {boolean} Whether loading succeeded
   */
  loadReplay(replayData) {
    if (!replayData) {
      console.error('[PlayState] No replay data provided');
      return false;
    }
    if (!this.replayPlayer) {
      this.replayPlayer = new ReplayPlayer();
    }
    if (!this.replayPlayer.load(replayData)) {
      console.error('[PlayState] Failed to load replay');
      return false;
    }
    this.replayMode = true;
    this.replayRecordingEnabled = false;
    return true;
  }

  startReplayPlayback() {
    if (!this.replayMode || !this.replayPlayer) {
      return;
    }
    this.replayPlayer.start();
    this.createReplayIndicator();
    EventBus.emit(Events.REPLAY_START, {
      songId: this.replayPlayer.getSongId(),
      difficulty: this.replayPlayer.getDifficulty()
    });
  }

  createReplayIndicator() {
    if (!this.scene?.add) {
      return;
    }
    this.replayIndicator = this.scene.add.text(10, 10, '▶ REPLAY', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ff6b6b',
      stroke: '#000000',
      strokeThickness: 4
    });
    if (typeof this.scene.registerHudObject === 'function') {
      this.scene.registerHudObject(this.replayIndicator);
    } else if (this.camHUD) {
      this.replayIndicator.setScrollFactor(0);
    }
    if (this.scene.tweens) {
      this.scene.tweens.add({
        targets: this.replayIndicator,
        alpha: { from: 1, to: 0.5 },
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    }
  }

  processReplayInputs() {
    if (!this.replayMode || !this.replayPlayer || !this.replayPlayer.isPlaying()) {
      return;
    }
    const inputs = this.replayPlayer.getInputsForPosition(this.songPosition);
    for (const input of inputs) {
      if (input.type === 'press') {
        this.handleNoteInput(input.direction, input.time);
      } else if (input.type === 'release') {
        this.handleNoteRelease(input.direction, input.time);
      }
    }
  }

  stopReplayPlayback() {
    if (this.replayPlayer) {
      this.replayPlayer.stop();
    }
    if (this.replayIndicator) {
      this.replayIndicator.destroy();
      this.replayIndicator = null;
    }
    if (this.replayMode) {
      EventBus.emit(Events.REPLAY_STOP);
    }
    this.replayMode = false;
  }

  /** @returns {boolean} */
  isReplayMode() {
    return this.replayMode;
  }
  /** @returns {ReplayPlayer | null} */
  getReplayPlayer() {
    return this.replayPlayer;
  }

  // Note generation
  generateNotes() {
    if (!this.chart?.notes) {
      return;
    }
    const chartNotes = /** @type {any} */ (this.chart.notes);
    if (chartNotes.player && this.playerStrumline) {
      this.playerStrumline.applyNoteData(chartNotes.player);
    }
    if (chartNotes.opponent && this.opponentStrumline) {
      this.opponentStrumline.applyNoteData(chartNotes.opponent);
    }
  }

  // Main update loop — delegates to modules
  /**
   * @param {number} _time - Current game time
   * @param {number} delta - Delta time in ms since last frame
   */
  update(_time, delta) {
    if (!this.conductor) {
      return;
    }
    const prevStep = this.conductor.currentStep;
    const prevBeat = this.conductor.currentBeat;

    if (this.audioManager?.isPlaying) {
      const audioTime = this.audioManager.currentTime;
      // Fallback: if audio reports isPlaying but currentTime isn't advancing
      // (e.g. suspended audio context on mobile), use delta-based timing
      if (audioTime > 0) {
        this.songPosition = audioTime;
      } else if (this.songStarted) {
        this.songPosition += delta;
      }
    } else if (this.countdownActive) {
      // During countdown, advance position by delta time toward song start
      this.songPosition += delta;
    } else if (this.songStarted) {
      // Fallback: audio failed to start or was suspended (common on mobile).
      // Keep advancing songPosition via delta so gameplay doesn't freeze.
      this.songPosition += delta;
    }
    this.conductor.update(this.songPosition);

    if (this.conductor.currentStep !== prevStep) {
      this.onStepHit(this.conductor.currentStep);
    }
    if (this.conductor.currentBeat !== prevBeat) {
      this.onBeatHit(this.conductor.currentBeat);
    }

    if (this.replayMode) {
      this.processReplayInputs();
    } else if (this._inputManager) {
      this._inputManager.processInputQueue();
    }

    if (this.playerStrumline) {
      this.playerStrumline.update(this.songPosition);
    }
    if (this.opponentStrumline) {
      this.opponentStrumline.update(this.songPosition);
    }

    if (this._noteProcessor) {
      this._noteProcessor.processOpponentNotes();
    }
    this.updateCharacters(delta);
    if (this.stage) {
      this.stage.update(delta);
    }
    if (this._cameraController?.rythmCamera) {
      this._cameraController.rythmCamera.update(delta);
    }
    if (this.scoreDisplay) {
      this.scoreDisplay.update(delta, this.songPosition);
    }
    if (this.comboPopup) {
      this.comboPopup.update(delta);
    }
    if (this.noteSplash) {
      this.noteSplash.update(delta);
    }
    if (this.playerHealthIcon) {
      this.playerHealthIcon.update(delta, this.health);
      if (this.healthBar) {
        this.playerHealthIcon.updatePosition(this.healthBar);
      }
    }
    if (this.opponentHealthIcon) {
      this.opponentHealthIcon.update(delta, this.health);
      if (this.healthBar) {
        this.opponentHealthIcon.updatePosition(this.healthBar);
      }
    }
    if (this.opponentIndicator) {
      this.opponentIndicator.update(delta);
    }
    if (this.touchInputController) {
      this.touchInputController.update();
    }
    if (this._noteProcessor) {
      this._noteProcessor.checkMissedNotes();
    }

    // Performance monitoring — disable effects when FPS is low
    if (this.performanceMonitor) {
      this.performanceMonitor.update(delta);
      const lowPerf = this.performanceMonitor.isLowPerformance();
      if (this.rythmCamera) {
        this.rythmCamera.setBeatZoomEnabled(!lowPerf);
      }
    }

    if (this.songStarted && this.songPosition >= this.songLength) {
      this.endSong();
    }
  }

  /**
   * @param {number} delta - Delta time in ms
   */
  updateCharacters(delta) {
    if (!this.conductor) {
      return;
    }
    const stepsPassed = delta / this.conductor.stepLengthMs;
    if (this.player) {
      this.player.update(delta, stepsPassed);
    }
    if (this.opponent) {
      this.opponent.update(delta, stepsPassed);
    }
    if (this.girlfriend) {
      this.girlfriend.update(delta, stepsPassed);
    }
  }

  // Beat/step sync
  /**
   * @param {number} step - Current step number
   */
  onStepHit(step) {
    if (this.stage) {
      this.stage.onStepHit(step);
    }
    if (this.player) {
      this.player.onStepHit(step);
    }
    if (this.opponent) {
      this.opponent.onStepHit(step);
    }
    if (this.girlfriend) {
      this.girlfriend.onStepHit(step);
    }
    // Health icons bop on their internal step cadence (one beat by default).
    if (this.playerHealthIcon) {
      this.playerHealthIcon.onStepHit(step);
    }
    if (this.opponentHealthIcon) {
      this.opponentHealthIcon.onStepHit(step);
    }
  }

  /**
   * @param {number} beat - Current beat number
   */
  onBeatHit(beat) {
    if (this.rythmCamera && this.isFeatureEnabled('cameraEffects')) {
      this.rythmCamera.onBeatHit(beat);
    }
    if (this.stage) {
      this.stage.onBeatHit(beat);
    }
    if (this.player) {
      this.player.onBeatHit(beat);
    }
    if (this.opponent) {
      this.opponent.onBeatHit(beat);
    }
    if (this.girlfriend) {
      this.girlfriend.onBeatHit(beat);
    }
    // Forward beat to health icons (default is a no-op; step-driven bop covers
    // the one-beat cadence, but this keeps beat-based icon overrides working).
    if (this.playerHealthIcon) {
      this.playerHealthIcon.onBeatHit(beat);
    }
    if (this.opponentHealthIcon) {
      this.opponentHealthIcon.onBeatHit(beat);
    }
  }

  // Input/note delegation to modules
  processInputQueue() {
    if (this._inputManager) {
      this._inputManager.processInputQueue();
    }
  }
  /**
   * @param {number} direction - Note direction (0-3)
   * @param {number} timestamp - Input timestamp
   * @param {string} [keyCode] - Key code that produced the input
   */
  handleNoteInput(direction, timestamp, keyCode) {
    if (this._inputManager) {
      this._inputManager.handleNoteInput(direction, timestamp, keyCode);
    }
  }
  /**
   * @param {number} direction - Note direction (0-3)
   * @param {number} timestamp - Input timestamp
   */
  handleNoteRelease(direction, timestamp) {
    if (this._inputManager) {
      this._inputManager.handleNoteRelease(direction, timestamp);
    }
  }
  /**
   * @param {any} note - Note sprite
   * @param {number} timing - Timing offset in ms
   */
  hitNote(note, timing) {
    if (this._noteProcessor) {
      this._noteProcessor.hitNote(note, timing);
    }
  }
  /**
   * @param {number} direction - Note direction (0-3)
   */
  ghostMiss(direction) {
    if (this._noteProcessor) {
      this._noteProcessor.ghostMiss(direction);
    }
  }
  processOpponentNotes() {
    if (this._noteProcessor) {
      this._noteProcessor.processOpponentNotes();
    }
  }
  /**
   * @param {any} note - Note sprite
   */
  opponentHitNote(note) {
    if (this._noteProcessor) {
      this._noteProcessor.opponentHitNote(note);
    }
  }
  checkMissedNotes() {
    if (this._noteProcessor) {
      this._noteProcessor.checkMissedNotes();
    }
  }
  /**
   * @param {any} note - Note sprite
   */
  missNote(note) {
    if (this._noteProcessor) {
      this._noteProcessor.missNote(note);
    }
  }

  /**
   * Get health bonus for a judgement.
   * @param {string} judgement - Judgement string
   * @returns {number}
   */
  getHealthBonus(judgement) {
    switch (judgement) {
      case 'killer':
        return Constants.HEALTH_KILLER_BONUS;
      case 'sick':
        return Constants.HEALTH_SICK_BONUS;
      case 'good':
        return Constants.HEALTH_GOOD_BONUS;
      case 'bad':
        return Constants.HEALTH_BAD_BONUS;
      case 'shit':
        return Constants.HEALTH_SHIT_BONUS;
      default:
        return 0;
    }
  }

  // Camera — kept on PlayState for backward compat with tests
  /**
   * @param {number} target - Camera target (0=opponent, 1=player, 2=gf)
   * @param {boolean} [instant=false] - Whether to snap instantly
   */
  focusCamera(target, instant = false) {
    this.cameraFocusTarget = target;
    const character = this.getCameraFocusCharacter(target);
    if (!character || !this.rythmCamera) {
      return;
    }
    const focusPoint = character.getCameraFocusPoint();
    if (this.stage) {
      const charType = target === 0 ? 'dad' : target === 1 ? 'bf' : 'gf';
      const stageOffset = this.stage.getCameraOffset(charType);
      focusPoint.x += stageOffset.x;
      focusPoint.y += stageOffset.y;
    }
    this.rythmCamera.setFollowTarget(focusPoint.x, focusPoint.y, instant);
  }

  /**
   * @param {number} target - Camera target index
   * @returns {Character | null}
   */
  getCameraFocusCharacter(target) {
    switch (target) {
      case 0:
        return this.opponent;
      case 1:
        return this.player;
      case 2:
        return this.girlfriend;
      default:
        return this.opponent;
    }
  }

  /**
   * @param {CameraEventData} eventData - Focus camera event payload
   */
  handleFocusCameraEvent(eventData) {
    if (!this.isFeatureEnabled('cameraEffects')) {
      return;
    }
    const charIndex = eventData?.char ?? eventData?.value?.char ?? 0;
    this.focusCamera(charIndex);
  }

  /**
   * @param {CameraEventData} eventData - Zoom camera event payload
   */
  handleZoomCameraEvent(eventData) {
    if (!this.isFeatureEnabled('cameraEffects')) {
      return;
    }
    if (!this.rythmCamera) {
      return;
    }
    const zoom = eventData?.zoom ?? eventData?.value?.zoom ?? 1.0;
    const instant = eventData?.instant ?? eventData?.value?.instant ?? false;
    this.rythmCamera.setZoom(zoom, instant);
  }

  // Song flow delegation
  startCountdown() {
    if (this._songFlowController) {
      this._songFlowController.startCountdown();
    }
  }
  /**
   * @param {number} step - Countdown step number
   */
  scheduleCountdownStep(step) {
    if (this._songFlowController) {
      this._songFlowController.scheduleCountdownStep(step);
    }
  }
  /**
   * @param {number} step - Countdown step number
   */
  executeCountdownStep(step) {
    if (this._songFlowController) {
      this._songFlowController.executeCountdownStep(step);
    }
  }
  startSong() {
    if (this._songFlowController) {
      this._songFlowController.startSong();
    }
  }
  endSong() {
    if (this._songFlowController) {
      this._songFlowController.endSong();
    }
  }
  gameOver() {
    if (this._songFlowController) {
      this._songFlowController.gameOver();
    }
  }

  // Pause/resume
  pause() {
    if (this.audioManager) {
      this.audioManager.pause();
    }
    EventBus.emit(Events.PAUSE);
  }

  resume() {
    if (this.audioManager) {
      this.audioManager.resume();
    }
    EventBus.emit(Events.RESUME);
  }

  exitSong() {
    this.songStarted = false;
    if (this.replayMode) {
      this.stopReplayPlayback();
    }
    if (this.replayRecorder && this.replayRecorder.isRecording()) {
      this.replayRecorder.discard();
    }
    if (this.audioManager) {
      this.audioManager.stop();
    }
  }

  // Cleanup — calls destroy() on each module
  destroy() {
    if (this._gameplayState) {
      this._gameplayState.destroy();
      this._gameplayState = null;
    }
    if (this._noteProcessor) {
      this._noteProcessor.destroy();
      this._noteProcessor = null;
    }
    if (this._inputManager) {
      this._inputManager.destroy();
      this._inputManager = null;
    }
    if (this._cameraController) {
      this._cameraController.destroy();
      this._cameraController = null;
    }
    if (this._songFlowController) {
      this._songFlowController.destroy();
      this._songFlowController = null;
    }

    if (this.playerStrumline) {
      this.playerStrumline.destroy();
      this.playerStrumline = null;
    }
    if (this.opponentStrumline) {
      this.opponentStrumline.destroy();
      this.opponentStrumline = null;
    }
    if (this.opponentIndicator) {
      this.opponentIndicator.destroy();
      this.opponentIndicator = null;
    }
    if (this.touchInputController) {
      this.touchInputController.destroy();
      this.touchInputController = null;
    }
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this.opponent) {
      this.opponent.destroy();
      this.opponent = null;
    }
    if (this.girlfriend) {
      this.girlfriend.destroy();
      this.girlfriend = null;
    }
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
    if (this.rythmCamera) {
      this.rythmCamera.destroy();
      this.rythmCamera = null;
    }

    this.scene = null;
    this.conductor = null;
    this.audioManager = null;
    this.voices = null;
    this.preciseInput = null;
    this.chart = null;
    this.songData = null;
    this.camGame = null;
    this.camHUD = null;
    this.performanceMonitor = null;

    if (this.replayRecorder) {
      if (this.replayRecorder.isRecording()) {
        this.replayRecorder.discard();
      }
      this.replayRecorder = null;
    }
    if (this.replayPlayer) {
      if (this.replayPlayer.isPlaying()) {
        this.replayPlayer.stop();
      }
      this.replayPlayer = null;
    }
    if (this.replayIndicator) {
      this.replayIndicator.destroy();
      this.replayIndicator = null;
    }
    if (this.inputBuffer) {
      this.inputBuffer.clear();
      this.inputBuffer = null;
    }
    this.levelSystem = null;
    this.replayMode = false;

    // Clean up competitive stats
    if (this._onNoteHitForStats) {
      EventBus.off(Events.NOTE_HIT, this._onNoteHitForStats);
    }
    if (this._onComboBreakForStats) {
      EventBus.off(Events.COMBO_BREAK, this._onComboBreakForStats);
    }
    if (this._onNoteHitForCombo) {
      EventBus.off(Events.NOTE_HIT, this._onNoteHitForCombo);
    }
    if (this._onNoteHitForSplash) {
      EventBus.off(Events.NOTE_HIT, this._onNoteHitForSplash);
    }
    this.inputStatistics = null;
    if (this.scoreDisplay) {
      this.scoreDisplay.destroy();
      this.scoreDisplay = null;
    }
    if (this.comboPopup) {
      this.comboPopup.destroy();
      this.comboPopup = null;
    }
    if (this.noteSplash) {
      this.noteSplash.destroy();
      this.noteSplash = null;
    }
    if (this.playerHealthIcon) {
      this.playerHealthIcon.destroy();
      this.playerHealthIcon = null;
    }
    if (this.opponentHealthIcon) {
      this.opponentHealthIcon.destroy();
      this.opponentHealthIcon = null;
    }
    this.healthBar = null;
  }
}

export default PlayState;

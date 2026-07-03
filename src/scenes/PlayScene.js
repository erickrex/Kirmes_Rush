/**
 * @fileoverview PlayScene - Phaser Scene wrapper for PlayState
 * Bridges PlayState (plain class) with Phaser's scene system.
 */

import Phaser from '../phaser.js';
import PlayState from '../play/PlayState.js';
import EventBus, { Events } from '../core/EventBus.js';
import LevelSystem from '../levels/LevelSystem.js';
import { createPreparedPlaySession } from '../levels/PreparedPlaySession.js';
import { Controls, PreciseInput } from '../input/InputSystem.js';
import AudioManager from '../audio/AudioManager.js';
import VoicesGroup from '../audio/VoicesGroup.js';
import HealthBar from '../play/HealthBar.js';
import GeneratedGameplaySkin from '../play/GeneratedGameplaySkin.js';
import CharacterRegistry from '../data/registries/CharacterRegistry.js';
import StageRegistry from '../data/registries/StageRegistry.js';
import NoteStyleRegistry from '../data/registries/NoteStyleRegistry.js';
import SaveManager from '../data/SaveManager.js';
import {
  HEALTH_BAR_Y,
  HEALTH_BAR_WIDTH,
  HEALTH_BAR_X,
  SCORE_DISPLAY_Y,
  COMBO_POPUP_Y,
  PORTRAIT_WIDTH
} from '../layout/LayoutManager.js';

/**
 * @typedef {import('../play/ScoreDisplay.js').default} ScoreDisplay
 * @typedef {import('../play/ExpandedStatsDisplay.js').default} ExpandedStatsDisplay
 * @typedef {import('../play/Strumline.js').default} Strumline
 */

/**
 * @typedef {{
 *   id?: string | null,
 *   features?: {
 *     healthBar?: boolean,
 *     comboPopups?: boolean,
 *     noteSplashes?: boolean,
 *     replayRecording?: boolean,
 *     inputBuffer?: boolean,
 *     cameraEffects?: boolean
 *   },
 *   ui?: {
 *     showCombo?: boolean,
 *     showAccuracy?: boolean,
 *     showMisses?: boolean
 *   }
 * }} SessionLevel
 *
 * @typedef {{
 *   noteStyle?: string | null,
 *   id?: string | null,
 *   stage?: string | null,
 *   characters?: Record<string, string> | null,
 *   returnScene?: string,
 *   returnSceneData?: object,
 *   difficulty?: string,
 * }} SessionSongData
 *
 * @typedef {{
 *   level?: SessionLevel | null,
 *   difficulty?: string,
 *   startTimestamp?: number,
 *   chart?: { scrollSpeed?: number } | null,
 *   songData?: SessionSongData | null,
 *   audio?: { instrumental?: { key: string }, vocals?: Record<string, any> } | null,
 *   metadata?: {
 *     playData?: {
 *       stage?: string | null,
 *       characters?: Record<string, string> | null
 *     }
 *   } | null,
 *   assets?: object[],
 * }} PreparedPlaySessionLike
 *
 * @typedef {{
 *   session?: PreparedPlaySessionLike,
 *   chart?: object | null,
 *   songData?: SessionSongData | null,
 *   song?: SessionSongData | null,
 *   difficulty?: string,
 *   replayId?: string,
 *   isReplay?: boolean,
 * }} PlaySceneInitData
 *
 * @typedef {{
 *   score: number,
 *   rank: string,
 *   tallies?: { maxCombo?: number },
 *   isReplay?: boolean,
 * }} SongEndData
 */

/**
 * PlayScene - Phaser.Scene that delegates to PlayState for gameplay logic.
 * @extends Phaser.Scene
 */
export default class PlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PlayState' });

    /** @type {PlayState | null} */
    this.playState = null;

    /** @type {PlaySceneInitData | null} */
    this.initData = null;

    /** @type {PreparedPlaySessionLike | null} */
    this.session = null;

    /** @type {LevelSystem | null} */
    this.levelSystem = null;

    /** @type {PreciseInput | null} */
    this.preciseInput = null;

    /** @type {AudioManager | null} */
    this.audioManager = null;

    /** @type {VoicesGroup | null} */
    this.voices = null;

    /** @type {GeneratedGameplaySkin | null} */
    this.gameplaySkin = null;

    /** @type {ScoreDisplay | ExpandedStatsDisplay | null} */
    this.scoreDisplay = null;

    /** @type {HealthBar | null} */
    this.healthBar = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.countdownText = null;

    /** @type {Phaser.GameObjects.Graphics | null} */
    this.backgroundGraphics = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.pauseButton = null;

    /** @type {InstanceType<typeof CharacterRegistry> | null} */
    this.characterRegistry = null;

    /** @type {InstanceType<typeof StageRegistry> | null} */
    this.stageRegistry = null;

    /** @type {InstanceType<typeof NoteStyleRegistry> | null} */
    this.noteStyleRegistry = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.fpsText = null;

    /** @type {{ target: HTMLCanvasElement, handler: EventListener } | null} */
    this.audioUnlockListener = null;
  }

  /**
   * @param {PlaySceneInitData} data - Scene data passed from scene.start()
   */
  init(data) {
    this.initData = data || {};
  }

  preload() {
    // Suppress individual load errors — PlayState handles missing assets gracefully
    this.load.on('loaderror', (/** @type {{ key: string }} */ file) => {
      console.warn(`[PlayScene] Asset not found: ${file.key}`);
    });
  }

  create() {
    // Stop any lingering menu music
    this.sound.stopAll();

    // Mobile browsers suspend the Web Audio context until a user gesture.
    // Register a one-time pointer listener that resumes it on the first tap
    // so audio is unlocked by the time the countdown finishes.
    this._unlockAudioOnTouch();

    this.playState = new PlayState(this);
    this.session = this.resolveSession(this.initData);

    this.createBackground();
    this.createCountdownText();
    this.setupLevelSystem();
    this.setupInput();
    this.setupAudio();
    this.setupRegistries();

    const session = /** @type {PreparedPlaySessionLike} */ (this.session);
    const config = /** @type {import('../play/PlayState.js').PlayStateInitConfig} */ ({
      song: session.songData || null,
      difficulty: session.difficulty || 'normal',
      startTimestamp: session.startTimestamp || 0,
      chart: session.chart || null
    });

    this.playState.init(config);

    // Read visual options from SaveManager and store on PlayState
    const saveManager = SaveManager.getInstance();
    this.playState.flashingLights = saveManager.getOption('flashingLights') ?? true;
    this.playState.cameraZoomEnabled = saveManager.getOption('cameraZoom') ?? true;
    this.playState.comboDisplayEnabled = saveManager.getOption('comboDisplay') ?? true;

    // Conditionally create FPS text display
    if (saveManager.getOption('showFps')) {
      this.fpsText = this.add.text(10, 10, 'FPS: 0', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#00ff00',
        stroke: '#000000',
        strokeThickness: 2
      });
      this.fpsText.setDepth(10000);
      this.fpsText.setScrollFactor(0);
    }

    if (this.audioManager) {
      this.playState.setAudioManager(this.audioManager);
    }
    if (this.voices) {
      this.playState.setVoices(this.voices);
    }
    if (this.preciseInput) {
      this.playState.setPreciseInput(this.preciseInput);
    }
    if (this.levelSystem) {
      this.playState.setLevelSystem(this.levelSystem);
    }

    this.playState.setupCameras();

    // Wire audio before presentation — must not be swallowed by the
    // try/catch below so the game always has audio even when stage or
    // character loading fails.
    if (!this.session?.audio?.instrumental) {
      console.warn('[PlayScene] session.audio missing instrumental:', this.session?.audio);
    }
    this.playState.wireAudio(this.session?.audio ?? {});

    try {
      this.bootstrapPresentation();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[PlayScene] bootstrapPresentation error (non-fatal):', message);
    }

    this.gameplaySkin = new GeneratedGameplaySkin(this, {
      noteStyleId: this.session?.songData?.noteStyle ?? undefined,
      noteStyleRegistry: this.noteStyleRegistry
    });
    const scrollSpeed =
      typeof this.session?.chart?.scrollSpeed === 'number' ? this.session.chart.scrollSpeed : 1.0;
    this.playState.createStrumlines(this.gameplaySkin.createNoteStyle(), scrollSpeed);
    if (this.playState.opponentStrumline) {
      this.gameplaySkin.attachStrumline(this.playState.opponentStrumline, { alpha: 0.65 });
    }
    if (this.playState.playerStrumline) {
      this.gameplaySkin.attachStrumline(this.playState.playerStrumline);
    }
    this.createHud();
    this.setupCameraLayers();
    this.registerGameplayFlow();
    this.playState.generateNotes();
    this.playState.startCountdown();

    // Wire shutdown into Phaser's scene lifecycle so cleanup is deterministic
    this.events?.on('shutdown', this.shutdown, this);
  }

  /**
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    if (this.playState) {
      this.playState.update(time, delta);
    }

    if (this.gameplaySkin) {
      this.gameplaySkin.update(delta);
    }

    this.updateHud(delta);

    if (this.fpsText) {
      this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    }
  }

  shutdown() {
    this.events?.off('shutdown', this.shutdown, this);
    if (typeof this.input.keyboard?.off === 'function') {
      this.input.keyboard.off('keydown-ESC', this._exitToLevelSelect, this);
    }
    EventBus.off(Events.SONG_END, this.handleSongEnd, this);
    EventBus.off(Events.GAME_OVER, this.handleGameOver, this);

    if (this.preciseInput) {
      this.preciseInput.destroy();
      this.preciseInput = null;
    }

    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }

    if (this.scoreDisplay) {
      this.scoreDisplay.destroy();
      this.scoreDisplay = null;
    }

    if (this.gameplaySkin) {
      this.gameplaySkin.destroy();
      this.gameplaySkin = null;
    }

    if (this.countdownText) {
      this.countdownText.destroy();
      this.countdownText = null;
    }

    if (this.backgroundGraphics) {
      this.backgroundGraphics.destroy();
      this.backgroundGraphics = null;
    }

    if (this.pauseButton) {
      this.pauseButton.destroy();
      this.pauseButton = null;
    }

    if (this.fpsText) {
      this.fpsText.destroy();
      this.fpsText = null;
    }

    if (this.playState) {
      this.playState.destroy();
      this.playState = null;
    }

    this._removeAudioUnlockListeners();

    if (this.audioManager) {
      this.audioManager.destroy();
      this.audioManager = null;
      this.voices = null;
    } else if (this.voices) {
      this.voices.destroy();
      this.voices = null;
    }

    this.levelSystem = null;
    this.session = null;
    this.initData = null;
  }

  /**
   * @param {PlaySceneInitData | null} data
   * @returns {PreparedPlaySessionLike}
   */
  resolveSession(data) {
    // Raw-id launch payloads are legacy compatibility scaffolding retained for
    // future mode work. The shipped 5-level flow always enters PlayState with a
    // fully prepared session from LevelSelect -> LoadingState.
    if (data?.session) {
      return createPreparedPlaySession(data.session);
    }

    if (data?.chart && data?.songData) {
      return createPreparedPlaySession(data);
    }

    return createPreparedPlaySession({
      level: null,
      difficulty: data?.difficulty || 'normal',
      chart: data?.chart || null,
      songData: data?.song || data?.songData || null,
      audio: null
    });
  }

  createBackground() {
    const { width, height } = this.cameras.main;
    this.backgroundGraphics = this.add.graphics();
    this.backgroundGraphics.setDepth(-10000);
    this.backgroundGraphics.setScrollFactor(0);
    this.backgroundGraphics.fillGradientStyle(0x08111f, 0x08111f, 0x15253d, 0x15253d, 1);
    this.backgroundGraphics.fillRect(0, 0, width, height);

    for (let direction = 0; direction < 4; direction++) {
      const playerX = 48 + 560 + direction * 112;
      const opponentX = 48 + direction * 112;

      this.backgroundGraphics.fillStyle(0xffffff, 0.05);
      this.backgroundGraphics.fillRect(playerX - 36, 0, 72, height);
      this.backgroundGraphics.fillRect(opponentX - 36, 0, 72, height);
    }
  }

  createCountdownText() {
    const { width, height } = this.cameras.main;
    this.countdownText = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'Arial Black',
        fontSize: '108px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8
      })
      .setOrigin(0.5, 0.5);
    this.countdownText.setAlpha(0);
  }

  setupLevelSystem() {
    this.levelSystem = new LevelSystem();

    const level = this.session?.level;
    if (level) {
      /** @type {any} */
      const levelConfig = level;
      this.levelSystem.levels = [levelConfig];
      this.levelSystem.loaded = true;
      if (level.id) {
        this.levelSystem.setCurrentLevel(level.id);
      }
    }
  }

  setupInput() {
    this.preciseInput = new PreciseInput(
      /** @type {any} */ (this),
      /** @type {any} */ (new Controls())
    );

    // ESC to pause / exit to level select
    this.input.keyboard?.on('keydown-ESC', this._exitToLevelSelect, this);

    // Pause button for mobile — top-right corner
    this.pauseButton = this.add.text(this.cameras.main.width - 36, 36, '⏸', {
      fontSize: '40px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    if (this.pauseButton.setOrigin) {
      this.pauseButton.setOrigin(0.5, 0.5);
    }
    if (this.pauseButton.setDepth) {
      this.pauseButton.setDepth(9000);
    }
    if (this.pauseButton.setScrollFactor) {
      this.pauseButton.setScrollFactor(0);
    }
    if (this.pauseButton.setInteractive) {
      this.pauseButton.setInteractive({ useHandCursor: true });
      this.pauseButton.on('pointerdown', () => {
        this._exitToLevelSelect();
      });
    }
  }

  /** @private */
  _exitToLevelSelect() {
    if (this.playState?.songStarted) {
      if (this.audioManager?.isPlaying) {
        this.audioManager.pause();
      }
      this.playState.songStarted = false;
    }
    this.sound.stopAll();
    const returnScene = this.session?.songData?.returnScene ?? 'LevelSelectState';
    const returnData = this.session?.songData?.returnSceneData ?? {};
    this.scene.start(returnScene, returnData);
  }

  setupAudio() {
    this.audioManager = new AudioManager(this);
    this.voices = new VoicesGroup(this);
    this.audioManager.setVoices(this.voices);
    this.audioManager.applyOptionsFromSave();
  }

  /**
   * Register a one-time pointer listener that unlocks the Web Audio context
   * on the first user gesture. Mobile browsers require this before any audio
   * can play. If audio is already playing when the gesture arrives, this is
   * a no-op.
   * @private
   */
  _unlockAudioOnTouch() {
    // Use a raw DOM listener on the game canvas — Phaser's input abstraction
    // can delay the callback enough that Android Chrome no longer considers
    // it a "user gesture", preventing ctx.resume() from working.
    const canvas = this.game?.canvas;
    if (!canvas) {
      return;
    }

    this._removeAudioUnlockListeners();

    const handler = () => {
      const ctx = /** @type {{ state: string, resume: () => Promise<void> } | undefined} */ (
        /** @type {any} */ (this.sound)?.context
      );
      if (ctx && ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            if (
              this.audioManager?.instrumental &&
              !this.audioManager.isPlaying &&
              this.playState?.songStarted
            ) {
              this.audioManager.play(this.playState.songPosition);
            }
            // Context is now running — safe to remove listeners
            this._removeAudioUnlockListeners();
          })
          .catch(() => {});
      } else if (ctx && ctx.state === 'running') {
        // Already running — remove listeners immediately
        this._removeAudioUnlockListeners();
      }
    };
    this.audioUnlockListener = { target: canvas, handler };
    // touchend is more reliable than touchstart for the "user gesture"
    // requirement on some mobile browsers (notably iOS Safari 17+).
    canvas.addEventListener('touchstart', handler, { passive: true });
    canvas.addEventListener('touchend', handler, { passive: true });
    canvas.addEventListener('mousedown', handler);
    canvas.addEventListener('click', handler);
  }

  /**
   * Remove any pending raw DOM listener used to unlock mobile Web Audio.
   * @private
   */
  _removeAudioUnlockListeners() {
    if (!this.audioUnlockListener) {
      return;
    }

    const { target, handler } = this.audioUnlockListener;
    target.removeEventListener('touchstart', handler);
    target.removeEventListener('touchend', handler);
    target.removeEventListener('mousedown', handler);
    target.removeEventListener('click', handler);
    this.audioUnlockListener = null;
  }

  setupRegistries() {
    this.characterRegistry = /** @type {InstanceType<typeof CharacterRegistry>} */ (
      CharacterRegistry.getInstance()
    );
    this.stageRegistry = /** @type {InstanceType<typeof StageRegistry>} */ (
      StageRegistry.getInstance()
    );
    this.noteStyleRegistry = /** @type {InstanceType<typeof NoteStyleRegistry>} */ (
      NoteStyleRegistry.getInstance()
    );

    // The note style registry should have been populated by the
    // LoadingState prepareCallback. If it's empty (e.g. the async load
    // hung or failed), load the JSON synchronously via fetch so the
    // atlas-based note arrows render instead of placeholder shapes.
    const noteStyleId = this.session?.songData?.noteStyle ?? 'rythm';
    if (
      this.noteStyleRegistry &&
      typeof this.noteStyleRegistry.hasEntry === 'function' &&
      !this.noteStyleRegistry.hasEntry(noteStyleId)
    ) {
      this._loadNoteStyleSync(noteStyleId);
    }
  }

  /**
   * Synchronous-ish fallback: fetch the note style JSON from the Phaser
   * JSON cache (populated by LoadingState) or from the scene's own cache,
   * then manually inject it into the registry.
   * @param {string} noteStyleId
   * @private
   */
  _loadNoteStyleSync(noteStyleId) {
    const reg = /** @type {any} */ (this.noteStyleRegistry);
    if (!reg) {
      return;
    }
    const jsonKey = `${reg.dataFilePath}/${noteStyleId}.json`;

    // Try the shared Phaser JSON cache first
    const cached = this.cache?.json?.get?.(jsonKey);
    if (cached && typeof reg.parseEntryDataRaw === 'function') {
      const cleaned = reg.parseEntryDataRaw(cached, jsonKey);
      if (cleaned && typeof reg.createEntry === 'function') {
        const entry = reg.createEntry(noteStyleId, cleaned);
        if (entry) {
          reg.entries.set(entry.id, entry);
          reg.loaded = true;
          return;
        }
      }
    }

    // Last resort: build a minimal hardcoded entry for the default "rythm"
    // style so frame-prefix lookups work even without the JSON.
    if (noteStyleId === 'rythm') {
      const fallbackData = {
        version: '1.1.0',
        name: "Rythm'",
        author: 'PhantomArcade',
        fallback: null,
        assets: {
          note: {
            assetPath: 'shared:notes',
            scale: 0.7,
            isPixel: false,
            offsets: [0, 0],
            alpha: 1,
            data: {
              left: { prefix: 'noteLeft' },
              down: { prefix: 'noteDown' },
              up: { prefix: 'noteUp' },
              right: { prefix: 'noteRight' }
            }
          },
          noteStrumline: {
            assetPath: 'shared:noteStrumline',
            scale: 0.7,
            isPixel: false,
            offsets: [0, 0],
            alpha: 1,
            data: {
              leftStatic: { prefix: 'staticLeft0' },
              leftPress: { prefix: 'pressLeft0' },
              leftConfirm: { prefix: 'confirmLeft0' },
              leftConfirmHold: { prefix: 'confirmLeft0' },
              downStatic: { prefix: 'staticDown0' },
              downPress: { prefix: 'pressDown0' },
              downConfirm: { prefix: 'confirmDown0' },
              downConfirmHold: { prefix: 'confirmDown0' },
              upStatic: { prefix: 'staticUp0' },
              upPress: { prefix: 'pressUp0' },
              upConfirm: { prefix: 'confirmUp0' },
              upConfirmHold: { prefix: 'confirmUp0' },
              rightStatic: { prefix: 'staticRight0' },
              rightPress: { prefix: 'pressRight0' },
              rightConfirm: { prefix: 'confirmRight0' },
              rightConfirmHold: { prefix: 'confirmRight0' }
            }
          }
        }
      };
      if (typeof reg.createEntry === 'function') {
        const entry = reg.createEntry(noteStyleId, fallbackData);
        if (entry) {
          reg.entries.set(entry.id, entry);
          reg.loaded = true;
        }
      }
    }
  }

  bootstrapPresentation() {
    if (!this.playState || !this.session) {
      return;
    }

    if (this.session.level?.features?.replayRecording === true) {
      this.playState.setReplayRecordingEnabled(true);
    }

    if (this.session.level?.features?.inputBuffer === true) {
      const saveManager = SaveManager.getInstance();
      const windowMs = saveManager.loaded ? saveManager.getInputBufferWindow() : 50;
      this.playState.setInputBufferEnabled(true, windowMs);
    }

    const hasPreparedStage =
      this.session.songData && Object.prototype.hasOwnProperty.call(this.session.songData, 'stage');
    const stageId = hasPreparedStage
      ? (this.session.songData?.stage ?? null)
      : (this.session.metadata?.playData?.stage ?? null);
    if (stageId && this.stageRegistry?.loaded) {
      const stageCreated = this.playState.createStage(stageId, this.stageRegistry);
      if (stageCreated) {
        this.playState.wireStageAssets(stageId, this.stageRegistry);
      }
    }

    const hasPreparedCharacters =
      this.session.songData &&
      Object.prototype.hasOwnProperty.call(this.session.songData, 'characters');
    const characterConfig = hasPreparedCharacters
      ? (this.session.songData?.characters ?? null)
      : (this.session.metadata?.playData?.characters ?? null);
    const hasVisibleCharacters =
      characterConfig &&
      Object.values(characterConfig).some(
        (characterId) => typeof characterId === 'string' && characterId.length > 0
      );
    if (hasVisibleCharacters && this.characterRegistry?.loaded) {
      this.playState.createCharacters(characterConfig, this.characterRegistry);
      this.playState.wireCharacterAssets(this.characterRegistry);
      if (this.session.level?.features?.cameraEffects === true) {
        this.playState.focusCamera(0, true);
      }
    }
  }

  createHud() {
    if (!this.playState) {
      return;
    }

    const level = this.session?.level;
    const ui = level?.ui || {};

    const noteStyleId = this.session?.songData?.noteStyle ?? null;
    const splashTextureKey = noteStyleId ? `notestyle-${noteStyleId}-noteSplash` : null;

    // Task 9.3: Position score display using LayoutManager constants, centered horizontally
    this.playState.createHUDDisplay(
      /** @type {any} */ ({
        x: PORTRAIT_WIDTH / 2,
        y: SCORE_DISPLAY_Y,
        align: 'center',
        fontSize: 20,
        showCombo: ui.showCombo ?? true,
        showAccuracy: ui.showAccuracy ?? false,
        showMisses: ui.showMisses ?? false,
        splashTextureKey,
        noteStyleId,
        noteStyleRegistry: this.noteStyleRegistry,
        characterRegistry: this.characterRegistry,
        playerCharacterId: this.playState.player?.characterId ?? null,
        opponentCharacterId: this.playState.opponent?.characterId ?? null
      })
    );
    this.scoreDisplay = this.playState.scoreDisplay;
    this.registerHudObject(this.scoreDisplay?.text ?? null);

    // Health bar — always shown so the player can track performance.
    // Individual level configs may set healthBar:false but the bar is
    // still useful as visual feedback even when health drain is disabled.
    this.healthBar = new HealthBar(this, {
      width: HEALTH_BAR_WIDTH,
      height: 18
    });
    this.healthBar.setPosition(HEALTH_BAR_X, HEALTH_BAR_Y);
    this.healthBar.setHealthImmediate(this.playState.health);
    this.registerHudObject(this.healthBar.backgroundGraphics);
    this.registerHudObject(this.healthBar.barGraphics);

    // Hand the bar to PlayState so the health icons position against its fill.
    this.playState.setHealthBar(this.healthBar);
  }

  setupCameraLayers() {
    if (!this.playState?.camHUD || !this.playState?.camGame) {
      return;
    }

    this.registerHudObject(this.backgroundGraphics);
    this.registerHudObject(this.countdownText);
    this.registerHudObject(this.pauseButton);
    if (this.scoreDisplay) {
      this.registerHudObject(/** @type {any} */ (this.scoreDisplay).text ?? null);
    }
    if (this.healthBar) {
      this.registerHudObject(this.healthBar.backgroundGraphics);
      this.registerHudObject(this.healthBar.barGraphics);
    }
    this.registerHudObject(this.playState.replayIndicator);

    if (this.gameplaySkin?.attachments) {
      this.gameplaySkin.attachments.forEach((/** @type {any} */ attachment) => {
        attachment.receptorSprites.forEach((/** @type {any} */ sprite) =>
          this.registerHudObject(sprite)
        );
        this.registerHudObject(attachment.holdGraphics);
      });
    }

    if (this.playState.opponentIndicator) {
      for (const arrow of this.playState.opponentIndicator.arrows) {
        this.registerHudObject(arrow.graphic);
      }
    }

    if (this.playState.touchInputController) {
      for (const zone of this.playState.touchInputController.zones) {
        this.registerHudObject(zone.rect);
        this.registerHudObject(zone.icon);
      }
    }

    if (this.playState.stage) {
      for (const prop of this.playState.stage.propSprites) {
        this.ignoreOnHudCamera(prop);
      }
    }
    this.ignoreOnHudCamera(this.playState.player);
    this.ignoreOnHudCamera(this.playState.opponent);
    this.ignoreOnHudCamera(this.playState.girlfriend);

    this._wireNoteSpawnCameraLayer(this.playState.playerStrumline);
    this._wireNoteSpawnCameraLayer(this.playState.opponentStrumline);
  }

  /**
   * Register a HUD object so it only renders on the HUD camera.
   * @param {any} obj
   * @returns {any}
   */
  registerHudObject(obj) {
    const camGame = this.playState?.camGame;
    if (!obj || !camGame) {
      return obj;
    }

    if (typeof obj.setScrollFactor === 'function') {
      obj.setScrollFactor(0);
    }

    try {
      camGame.ignore(obj);
    } catch {
      // Ignore non-Phaser objects that cannot be assigned to camera layers.
    }

    return obj;
  }

  /**
   * Register a note sprite and its sustain trail on the HUD layer.
   * @param {any} noteSprite
   * @returns {any}
   */
  registerHudNote(noteSprite) {
    this.registerHudObject(noteSprite);
    this.registerHudObject(noteSprite?.sustainTrail ?? null);
    return noteSprite;
  }

  /**
   * Register a world object so it does not render on the HUD camera.
   * @param {any} obj
   * @returns {any}
   */
  ignoreOnHudCamera(obj) {
    const camHUD = this.playState?.camHUD;
    if (!obj || !camHUD) {
      return obj;
    }

    try {
      camHUD.ignore(obj);
    } catch {
      // Ignore non-Phaser objects that cannot be assigned to camera layers.
    }

    return obj;
  }

  /**
   * Hook into a strumline's onNoteSpawn callback so every new note sprite
   * is assigned to the HUD layer as it appears.
   * @param {import('../play/Strumline.js').default | null} strumline
   * @private
   */
  _wireNoteSpawnCameraLayer(strumline) {
    if (!strumline) {
      return;
    }

    const prev = strumline.onNoteSpawn;
    strumline.onNoteSpawn = (/** @type {any} */ noteSprite) => {
      this.registerHudNote(noteSprite);
      if (prev) {
        prev(noteSprite);
      }
    };
  }

  registerGameplayFlow() {
    if (!this.playState) {
      return;
    }

    this.playState.onCountdownStep = (step) => {
      const labels = ['3', '2', '1', 'GO'];
      if (!this.countdownText || step > 3) {
        return;
      }

      this.countdownText.setText(labels[step]);
      this.countdownText.setAlpha(1);
      this.countdownText.setScale(1.2);
      this.tweens.add({
        targets: this.countdownText,
        alpha: 0,
        scale: 0.9,
        duration: 350,
        ease: 'Quad.easeOut'
      });
    };

    this.playState.onNoteHit = (note, judgement) => {
      if (this.playState) {
        this.spawnJudgementFeedback(judgement, this.playState.combo);
      }
      this.spawnNoteSplash(note, judgement);
    };

    this.playState.onNoteMiss = () => {
      this.spawnMissFeedback();
    };

    EventBus.on(Events.SONG_END, this.handleSongEnd, this);
    EventBus.on(Events.GAME_OVER, this.handleGameOver, this);
  }

  /**
   * @param {SongEndData} data
   */
  handleSongEnd(data) {
    const saveManager = SaveManager.getInstance();
    const accuracy = this.getAccuracy();
    const isReplayRun = data?.isReplay === true;
    let newHighScore = false;

    if (!isReplayRun && this.session?.songData?.id && saveManager.loaded) {
      newHighScore = saveManager.recordSongResult({
        levelId: this.session.level?.id ?? undefined,
        songId: this.session.songData.id,
        difficulty: this.session?.difficulty ?? 'normal',
        score: data.score,
        rank: data.rank,
        accuracy,
        maxCombo: data.tallies?.maxCombo ?? 0
      });
    }

    this.scene.start('ResultState', {
      ...data,
      accuracy,
      newHighScore,
      songData: this.session?.songData ?? null
    });
  }

  handleGameOver() {
    this.scene.start('GameOverState', {
      songData: {
        session: this.session,
        returnScene: this.session?.songData?.returnScene || 'LevelSelectState',
        returnSceneData: this.session?.songData?.returnSceneData || {
          selectedLevelId: this.session?.level?.id
        }
      },
      position: {
        x: this.scale.width / 2,
        y: this.scale.height / 2
      }
    });
  }

  /**
   * @param {number} delta
   */
  updateHud(delta) {
    if (!this.playState || !this.scoreDisplay) {
      return;
    }

    const accuracy = this.getAccuracy();

    this.scoreDisplay.setStats({
      score: this.playState.score,
      combo: this.playState.combo,
      accuracy,
      misses: this.playState.tallies.missed
    });

    if (this.healthBar) {
      this.healthBar.setHealth(this.playState.health);
      this.healthBar.update(delta);
    }
  }

  getAccuracy() {
    const totalNotes = this.playState?.tallies?.totalNotes || 0;
    const totalNotesHit = this.playState?.tallies?.totalNotesHit || 0;
    return totalNotes > 0 ? (totalNotesHit / totalNotes) * 100 : 0;
  }

  /**
   * @param {string} judgement
   * @param {number} combo
   */
  spawnJudgementFeedback(judgement, combo) {
    if (this.session?.level?.features?.comboPopups !== true) {
      return;
    }

    const normalizedJudgement = judgement === 'killer' ? 'sick' : judgement;
    const centerX = this.scale.width / 2;
    const baseY = COMBO_POPUP_Y;
    const judgementKey = `judgement${normalizedJudgement.charAt(0).toUpperCase()}${normalizedJudgement.slice(1)}`;

    const judgementObject = this.createPopupSprite(
      `notestyle-${this.session.songData?.noteStyle}-${judgementKey}`,
      centerX,
      baseY,
      normalizedJudgement.toUpperCase(),
      '#ffffff'
    );

    if (judgementObject) {
      this.animatePopup(judgementObject, 0.65);
    }

    const comboText = combo > 0 ? `${combo}` : null;
    if (!comboText) {
      return;
    }

    const digits = comboText.split('');
    const totalWidth = digits.length * 32;
    digits.forEach((digit, index) => {
      const comboObject = this.createPopupSprite(
        `notestyle-${this.session?.songData?.noteStyle}-comboNumber${digit}`,
        centerX - totalWidth / 2 + index * 32,
        baseY + 78,
        digit,
        GeneratedGameplaySkin.getLaneColor(index % 4)
      );

      if (comboObject) {
        this.animatePopup(comboObject, 0.45, 320);
      }
    });
  }

  spawnMissFeedback() {
    if (this.session?.level?.features?.comboPopups !== true) {
      return;
    }

    const missText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, 'MISS', {
        fontFamily: 'Arial Black',
        fontSize: '42px',
        color: '#ff6b6b',
        stroke: '#000000',
        strokeThickness: 6
      })
      .setOrigin(0.5, 0.5);
    this.registerHudObject(missText);

    this.animatePopup(missText, 1, 280);
  }

  /**
   * @param {{ direction: number } | null} note
   * @param {string} judgement
   */
  spawnNoteSplash(note, judgement) {
    if (this.session?.level?.features?.noteSplashes !== true) {
      return;
    }

    // Low-performance mode disables note splashes
    if (this.playState?.performanceMonitor?.isLowPerformance()) {
      return;
    }

    if (!note || (judgement !== 'killer' && judgement !== 'sick')) {
      return;
    }

    const splashTextureKey = `notestyle-${this.session?.songData?.noteStyle}-noteSplash`;
    const playerStrumline = this.playState?.playerStrumline;
    if (!playerStrumline) {
      return;
    }

    const receptorX = playerStrumline.x + playerStrumline.getXPos(note.direction);
    const receptorY = playerStrumline.y + 52;

    if (
      this.noteStyleRegistry &&
      this.session?.songData?.noteStyle &&
      this.textures.exists(splashTextureKey)
    ) {
      const splashData =
        /** @type {any} */ (this.noteStyleRegistry).getSplashData(
          this.session.songData.noteStyle,
          note.direction
        ) ?? [];
      const prefix = splashData[Math.floor(Math.random() * splashData.length)]?.prefix ?? null;
      const frame = this.gameplaySkin?.findAtlasFrame?.(splashTextureKey, prefix);

      if (frame) {
        const splash = this.add.sprite(receptorX, receptorY, splashTextureKey, frame);
        splash.setScale(0.9);
        splash.setDepth(80);
        this.registerHudObject(splash);
        this.tweens.add({
          targets: splash,
          alpha: 0,
          scale: 1.1,
          duration: 220,
          onComplete: () => splash.destroy()
        });
        return;
      }
    }

    const fallback = this.add.circle(receptorX, receptorY, 24, 0xffffff, 0.45);
    fallback.setDepth(80);
    this.registerHudObject(fallback);
    this.tweens.add({
      targets: fallback,
      alpha: 0,
      scale: 1.5,
      duration: 180,
      onComplete: () => fallback.destroy()
    });
  }

  /**
   * @param {string} textureKey
   * @param {number} x
   * @param {number} y
   * @param {string} fallbackText
   * @param {string} fallbackColor
   */
  createPopupSprite(textureKey, x, y, fallbackText, fallbackColor) {
    if (textureKey && this.textures.exists(textureKey)) {
      const image = this.add.image(x, y, textureKey);
      image.setDepth(120);
      return this.registerHudObject(image);
    }

    return this.registerHudObject(
      this.add
        .text(x, y, fallbackText, {
          fontFamily: 'Arial Black',
          fontSize: '36px',
          color: fallbackColor,
          stroke: '#000000',
          strokeThickness: 5
        })
        .setOrigin(0.5, 0.5)
        .setDepth(120)
    );
  }

  /**
   * @param {Phaser.GameObjects.GameObject & { y: number, setScale: (value: number) => any, destroy: () => void }} target
   * @param {number} [scale=1]
   * @param {number} [duration=400]
   */
  animatePopup(target, scale = 1, duration = 400) {
    target.setScale(scale);
    this.tweens.add({
      targets: target,
      y: target.y - 36,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => target.destroy()
    });
  }
}

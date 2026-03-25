/**
 * @fileoverview PlayScene - Phaser Scene wrapper for PlayState
 * Bridges PlayState (plain class) with Phaser's scene system.
 */

import Phaser from 'phaser';
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

/**
 * PlayScene - Phaser.Scene that delegates to PlayState for gameplay logic.
 * @extends Phaser.Scene
 */
export default class PlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PlayState' });

    /** @type {PlayState | null} */
    this.playState = null;

    /** @type {Object | null} */
    this.initData = null;

    /** @type {Object | null} */
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

    /** @type {CharacterRegistry | null} */
    this.characterRegistry = null;

    /** @type {StageRegistry | null} */
    this.stageRegistry = null;

    /** @type {NoteStyleRegistry | null} */
    this.noteStyleRegistry = null;
  }

  /**
   * @param {Object} data - Scene data passed from scene.start()
   */
  init(data) {
    this.initData = data || {};
  }

  preload() {
    // Suppress individual load errors — PlayState handles missing assets gracefully
    this.load.on('loaderror', (file) => {
      console.warn(`[PlayScene] Asset not found: ${file.key}`);
    });
  }

  create() {
    // Stop any lingering menu music
    this.sound.stopAll();

    this.playState = new PlayState(this);
    this.session = this.resolveSession(this.initData);

    this.createBackground();
    this.createCountdownText();
    this.setupLevelSystem();
    this.setupInput();
    this.setupAudio();
    this.setupRegistries();

    const config = {
      song: this.session.songData || null,
      difficulty: this.session.difficulty || 'normal',
      startTimestamp: this.session.startTimestamp || 0,
      chart: this.session.chart || null
    };

    this.playState.init(config);
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

    try {
      this.bootstrapPresentation();
    } catch (err) {
      console.warn('[PlayScene] bootstrapPresentation error (non-fatal):', err.message);
    }

    this.gameplaySkin = new GeneratedGameplaySkin(this, {
      noteStyleId: this.session.songData?.noteStyle ?? null,
      noteStyleRegistry: this.noteStyleRegistry
    });
    this.playState.createStrumlines(
      this.gameplaySkin.createNoteStyle(),
      typeof this.session.chart?.scrollSpeed === 'number' ? this.session.chart.scrollSpeed : 1.0
    );
    this.gameplaySkin.attachStrumline(this.playState.opponentStrumline, { alpha: 0.65 });
    this.gameplaySkin.attachStrumline(this.playState.playerStrumline);
    this.createHud();
    this.registerGameplayFlow();
    this.playState.generateNotes();
    this.playState.startCountdown();
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
  }

  shutdown() {
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

    if (this.playState) {
      this.playState.destroy();
      this.playState = null;
    }

    this.levelSystem = null;
    this.audioManager = null;
    this.voices = null;
    this.session = null;
    this.initData = null;
  }

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

    if (this.session.level) {
      this.levelSystem.levels = [this.session.level];
      this.levelSystem.loaded = true;
      this.levelSystem.setCurrentLevel(this.session.level.id);
    }
  }

  setupInput() {
    this.preciseInput = new PreciseInput(this, new Controls());

    // ESC to pause / exit to level select
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.playState?.songStarted) {
        // Pause audio
        if (this.audioManager?.isPlaying) {
          this.audioManager.pause();
        }
        this.playState.songStarted = false;
      }
      this.sound.stopAll();
      const returnScene = this.session?.songData?.returnScene ?? 'LevelSelectState';
      const returnData = this.session?.songData?.returnSceneData ?? {};
      this.scene.start(returnScene, returnData);
    });
  }

  setupAudio() {
    this.audioManager = new AudioManager(this);
    this.voices = new VoicesGroup(this);
    this.audioManager.setVoices(this.voices);
  }

  setupRegistries() {
    this.characterRegistry = CharacterRegistry.getInstance();
    this.stageRegistry = StageRegistry.getInstance();
    this.noteStyleRegistry = NoteStyleRegistry.getInstance();
  }

  bootstrapPresentation() {
    this.playState.wireAudio(this.session.audio ?? {});

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
      ? this.session.songData.stage
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
      ? this.session.songData.characters
      : this.session.metadata?.playData?.characters;
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
    const level = this.session.level;
    const ui = level?.ui || {};
    this.playState.createHUDDisplay({
      x: this.scale.width - 32,
      y: 24,
      align: 'right',
      showCombo: ui.showCombo ?? true,
      showAccuracy: ui.showAccuracy ?? false,
      showMisses: ui.showMisses ?? false
    });
    this.scoreDisplay = this.playState.scoreDisplay;

    if (level?.features?.healthBar !== false) {
      this.healthBar = new HealthBar(this, {
        width: 520,
        height: 18
      });
      this.healthBar.centerX(this.scale.width);
      this.healthBar.setPosition(this.healthBar.x, this.scale.height - 56);
      this.healthBar.setHealthImmediate(this.playState.health);
    }
  }

  registerGameplayFlow() {
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
      this.spawnJudgementFeedback(judgement, this.playState.combo);
      this.spawnNoteSplash(note, judgement);
    };

    this.playState.onNoteMiss = () => {
      this.spawnMissFeedback();
    };

    EventBus.on(Events.SONG_END, this.handleSongEnd, this);
    EventBus.on(Events.GAME_OVER, this.handleGameOver, this);
  }

  handleSongEnd(data) {
    const saveManager = SaveManager.getInstance();
    const accuracy = this.getAccuracy();
    const isReplayRun = data?.isReplay === true;
    let newHighScore = false;

    if (!isReplayRun && this.session.songData?.id && saveManager.loaded) {
      newHighScore = saveManager.recordSongResult({
        levelId: this.session.level?.id ?? null,
        songId: this.session.songData.id,
        difficulty: this.session.difficulty,
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
      songData: this.session.songData
    });
  }

  handleGameOver() {
    this.scene.start('GameOverState', {
      songData: {
        session: this.session,
        returnScene: this.session.songData?.returnScene || 'LevelSelectState',
        returnSceneData: this.session.songData?.returnSceneData || {
          selectedLevelId: this.session.level?.id
        }
      },
      position: {
        x: this.scale.width / 2,
        y: this.scale.height / 2
      }
    });
  }

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
    return totalNotes > 0 ? (this.playState.tallies.totalNotesHit / totalNotes) * 100 : 0;
  }

  spawnJudgementFeedback(judgement, combo) {
    if (this.session.level?.features?.comboPopups !== true) {
      return;
    }

    const normalizedJudgement = judgement === 'killer' ? 'sick' : judgement;
    const centerX = this.scale.width / 2;
    const baseY = this.scale.height / 2 - 40;
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
        `notestyle-${this.session.songData?.noteStyle}-comboNumber${digit}`,
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
    if (this.session.level?.features?.comboPopups !== true) {
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

    this.animatePopup(missText, 1, 280);
  }

  spawnNoteSplash(note, judgement) {
    if (this.session.level?.features?.noteSplashes !== true) {
      return;
    }

    if (!note || (judgement !== 'killer' && judgement !== 'sick')) {
      return;
    }

    const splashTextureKey = `notestyle-${this.session.songData?.noteStyle}-noteSplash`;
    const playerStrumline = this.playState.playerStrumline;
    if (!playerStrumline) {
      return;
    }

    const receptorX = playerStrumline.x + playerStrumline.getXPos(note.direction);
    const receptorY = playerStrumline.y + 52;

    if (
      this.noteStyleRegistry &&
      this.session.songData?.noteStyle &&
      this.textures.exists(splashTextureKey)
    ) {
      const splashData =
        this.noteStyleRegistry.getSplashData(this.session.songData.noteStyle, note.direction) ?? [];
      const prefix = splashData[Math.floor(Math.random() * splashData.length)]?.prefix ?? null;
      const frame = this.gameplaySkin?.findAtlasFrame?.(splashTextureKey, prefix);

      if (frame) {
        const splash = this.add.sprite(receptorX, receptorY, splashTextureKey, frame);
        splash.setScale(0.9);
        splash.setDepth(80);
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
    this.tweens.add({
      targets: fallback,
      alpha: 0,
      scale: 1.5,
      duration: 180,
      onComplete: () => fallback.destroy()
    });
  }

  createPopupSprite(textureKey, x, y, fallbackText, fallbackColor) {
    if (textureKey && this.textures.exists(textureKey)) {
      const image = this.add.image(x, y, textureKey);
      image.setDepth(120);
      return image;
    }

    return this.add
      .text(x, y, fallbackText, {
        fontFamily: 'Arial Black',
        fontSize: '36px',
        color: fallbackColor,
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5, 0.5)
      .setDepth(120);
  }

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

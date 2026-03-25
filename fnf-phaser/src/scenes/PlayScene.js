/**
 * @fileoverview PlayScene - Phaser Scene wrapper for PlayState
 * Bridges PlayState (plain class) with Phaser's scene system.
 */

import Phaser from 'phaser';
import PlayState from '../play/PlayState.js';
import EventBus, { Events } from '../core/EventBus.js';
import LevelSystem from '../levels/LevelSystem.js';
import { Controls, PreciseInput } from '../input/InputSystem.js';
import AudioManager from '../audio/AudioManager.js';
import VoicesGroup from '../audio/VoicesGroup.js';
import ScoreDisplay from '../play/ScoreDisplay.js';
import ExpandedStatsDisplay from '../play/ExpandedStatsDisplay.js';
import HealthBar from '../play/HealthBar.js';
import GeneratedGameplaySkin from '../play/GeneratedGameplaySkin.js';

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
    this.playState = new PlayState(this);
    this.session = this.resolveSession(this.initData);

    this.createBackground();
    this.createCountdownText();
    this.setupLevelSystem();
    this.setupInput();
    this.setupAudio();

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
    this.gameplaySkin = new GeneratedGameplaySkin(this);
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
    if (data?.session) {
      return data.session;
    }

    if (data?.chart && data?.songData) {
      return data;
    }

    return {
      level: null,
      difficulty: data?.difficulty || 'normal',
      chart: data?.chart || null,
      songData: data?.song || data?.songData || null,
      audio: null
    };
  }

  createBackground() {
    const { width, height } = this.cameras.main;
    this.backgroundGraphics = this.add.graphics();
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
    this.countdownText = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'Arial Black',
      fontSize: '108px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5, 0.5);
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
  }

  setupAudio() {
    this.audioManager = new AudioManager(this);
    this.voices = new VoicesGroup(this);

    if (this.session.audio?.instrumental?.key) {
      this.audioManager.loadInstrumental(this.session.audio.instrumental.key);
    }

    if (this.session.audio?.vocals?.combined?.key) {
      this.voices.loadCombined(this.session.audio.vocals.combined.key);
    } else if (this.session.audio?.vocals) {
      this.voices.loadSplit(
        this.session.audio.vocals.player?.key,
        this.session.audio.vocals.opponent?.key
      );
    }

    this.audioManager.setVoices(this.voices);
  }

  createHud() {
    const level = this.session.level;
    const ui = level?.ui || {};
    const useExpandedStats = level?.features?.expandedStats === true;

    this.scoreDisplay = useExpandedStats
      ? new ExpandedStatsDisplay(this, {
        x: this.scale.width - 32,
        y: 24,
        align: 'right',
        showCombo: ui.showCombo ?? true,
        showAccuracy: ui.showAccuracy ?? false,
        showMisses: ui.showMisses ?? false
      })
      : new ScoreDisplay(this, {
        x: this.scale.width - 32,
        y: 24,
        align: 'right',
        showCombo: ui.showCombo ?? true,
        showAccuracy: ui.showAccuracy ?? false,
        showMisses: ui.showMisses ?? false
      });

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
      if (this.scoreDisplay instanceof ExpandedStatsDisplay) {
        this.scoreDisplay.recordHit(judgement, this.playState.songPosition);
      }
    };

    this.playState.onNoteMiss = () => {
      if (this.scoreDisplay instanceof ExpandedStatsDisplay) {
        this.scoreDisplay.recordComboBreak();
      }
    };

    EventBus.on(Events.SONG_END, this.handleSongEnd, this);
    EventBus.on(Events.GAME_OVER, this.handleGameOver, this);
  }

  handleSongEnd(data) {
    this.scene.start('ResultState', {
      ...data,
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

    const totalNotes = this.playState.tallies.totalNotes || 0;
    const accuracy = totalNotes > 0
      ? (this.playState.tallies.totalNotesHit / totalNotes) * 100
      : 0;

    this.scoreDisplay.setStats({
      score: this.playState.score,
      combo: this.playState.combo,
      accuracy,
      misses: this.playState.tallies.missed
    });

    if (this.scoreDisplay instanceof ExpandedStatsDisplay) {
      this.scoreDisplay.update(delta, this.playState.songPosition);
    } else {
      this.scoreDisplay.update(delta);
    }

    if (this.healthBar) {
      this.healthBar.setHealth(this.playState.health);
      this.healthBar.update(delta);
    }
  }
}

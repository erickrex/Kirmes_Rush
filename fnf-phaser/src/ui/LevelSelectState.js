/**
 * @fileoverview Level Select - The only gameplay entrypoint for this build.
 */

import BaseMenuState from './BaseMenuState.js';
import SaveManager from '../data/SaveManager.js';
import CharacterRegistry from '../data/registries/CharacterRegistry.js';
import NoteStyleRegistry from '../data/registries/NoteStyleRegistry.js';
import StageRegistry from '../data/registries/StageRegistry.js';
import { buildPrepareCallback } from '../levels/AssetManifestBuilder.js';
import LevelSystem from '../levels/LevelSystem.js';

/**
 * LevelSelectState - Shows the 5 progressive levels and launches gameplay.
 * @extends BaseMenuState
 */
export default class LevelSelectState extends BaseMenuState {
  constructor() {
    super({ key: 'LevelSelectState' });

    this.levelSystem = new LevelSystem();
    this.levels = [];
    this.levelTexts = [];
    this.descriptionText = null;
    this.songText = null;
    this.difficultyText = null;
    this.bestScoreText = null;
    this.progressText = null;
    this.statusText = null;
    this.selectedLevelId = null;
    this.saveManager = SaveManager.getInstance();
  }

  init(data) {
    this.selectedLevelId = data?.selectedLevelId || null;
  }

  getItemCount() {
    return this.levels.length;
  }

  preload() {
    this.preloadMenuSounds();
  }

  create() {
    this.transitioning = false;
    this.selectedIndex = 0;
    this.saveManager.init();

    this.createBackground(null, 0x0f1724, 0x1b2436);
    this.createStaticUi();
    this.setupInput();
    this.fadeIn();

    void this.loadLevels();
  }

  createStaticUi() {
    const { width, height } = this.cameras.main;
    const infoX = 96;
    const pad = 36;

    // Info panel sits below the level list.
    // 5 levels starting at y=210 with 82px spacing → last level at ~538.
    const infoY = 640;
    const infoWrap = width - infoX * 2;

    // Back button (top-left)
    this.backButton = this.add.text(pad, 50, '← Back', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#94a3b8'
    });
    if (this.backButton.setOrigin) this.backButton.setOrigin(0, 0.5);
    if (this.backButton.setInteractive) {
      this.backButton.setInteractive({ useHandCursor: true });
      this.backButton.on('pointerdown', () => this.onBack());
    }

    this.add.text(infoX, 90, 'Levels', {
      fontFamily: 'Arial Black',
      fontSize: '54px',
      color: '#ffffff'
    });

    this.add.text(infoX, 148, 'Tap a level, then tap Play.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#8fa3bf'
    });

    this.statusText = this.add.text(infoX, height - 72, 'Loading levels...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#facc15'
    });

    // Play button — large, centered, below the info panel
    this.playButton = this.add.text(width / 2, height - 140, '▶  PLAY', {
      fontFamily: 'Arial Black',
      fontSize: '40px',
      color: '#000000',
      backgroundColor: '#facc15',
      padding: { x: 48, y: 16 }
    });
    if (this.playButton.setOrigin) this.playButton.setOrigin(0.5, 0.5);
    if (this.playButton.setInteractive) {
      this.playButton.setInteractive({ useHandCursor: true });
      this.playButton.on('pointerdown', () => this.onSelect());
    }

    this.songText = this.add.text(infoX, infoY, '', {
      fontFamily: 'Arial Black',
      fontSize: '26px',
      color: '#ffffff',
      wordWrap: { width: infoWrap }
    });

    this.difficultyText = this.add.text(infoX, infoY + 42, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#7dd3fc'
    });

    this.bestScoreText = this.add.text(infoX, infoY + 76, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#facc15',
      wordWrap: { width: infoWrap }
    });

    this.progressText = this.add.text(infoX, infoY + 106, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#86efac',
      wordWrap: { width: infoWrap }
    });

    this.descriptionText = this.add.text(infoX, infoY + 140, '', {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d1d5db',
      wordWrap: { width: infoWrap }
    });
  }

  async loadLevels() {
    const loaded = await this.levelSystem.loadManifests();

    if (!loaded) {
      if (this.statusText) {
        this.statusText.setText('Failed to load levels');
        this.statusText.setColor('#ef4444');
      }
      return;
    }

    this.levels = this.levelSystem.getAllLevels();

    if (this.selectedLevelId) {
      const initialIndex = this.levels.findIndex((level) => level.id === this.selectedLevelId);
      if (initialIndex >= 0) {
        this.selectedIndex = initialIndex;
      }
    }

    this.createLevelTexts();
    this.enableTouchOnLevelItems();
    this.updateSelection();

    if (this.statusText) {
      this.statusText.setText('Select a level and tap Play.');
      this.statusText.setColor('#94a3b8');
    }
  }

  createLevelTexts() {
    const startX = 96;
    const startY = 210;
    const spacing = 82;

    this.levelTexts.forEach((text) => text.destroy());
    this.levelTexts = [];

    this.levels.forEach((level, index) => {
      const text = this.add.text(startX, startY + index * spacing, level.name, {
        fontFamily: 'Arial Black',
        fontSize: '36px',
        color: '#ffffff'
      });
      this.levelTexts.push(text);
    });
  }

  updateSelection() {
    this.levelTexts.forEach((text, index) => {
      if (index === this.selectedIndex) {
        text.setColor('#facc15');
        text.setScale(1.05);
      } else {
        text.setColor('#ffffff');
        text.setScale(1);
      }
    });

    const level = this.levels[this.selectedIndex];
    if (!level) {
      return;
    }

    if (this.songText) {
      this.songText.setText(`Song: ${level.songId.toUpperCase()}`);
    }

    if (this.difficultyText) {
      this.difficultyText.setText(`Difficulty: ${level.difficulty.toUpperCase()}`);
    }

    const highScore = this.saveManager.getHighScore(level.songId, level.difficulty);
    const completed = this.saveManager.isLevelCompleted(level.id);

    if (this.bestScoreText) {
      if (highScore) {
        this.bestScoreText.setText(
          `Best: ${highScore.score.toLocaleString()} | ${highScore.rank} | ${highScore.accuracy.toFixed(2)}%`
        );
      } else {
        this.bestScoreText.setText('Best: No saved result yet');
      }
    }

    if (this.progressText) {
      this.progressText.setText(
        completed ? 'Status: Completed locally' : 'Status: Not cleared yet'
      );
      this.progressText.setColor(completed ? '#86efac' : '#fca5a5');
    }

    if (this.descriptionText) {
      this.descriptionText.setText(level.description || '');
    }
  }

  async executeSelection() {
    const level = this.levels[this.selectedIndex];
    if (!level) {
      this.transitioning = false;
      return;
    }

    // Resume the Web Audio context on this user gesture so it's unlocked
    // by the time PlayScene tries to play audio. Use the raw DOM event
    // (we're inside a pointerdown handler) to call resume() synchronously
    // within the gesture — Phaser's abstraction can delay it past the
    // browser's gesture window.
    try {
      const ctx = this.sound?.context;
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch { /* swallow */ }

    this.transitionToScene('LoadingState', {
      nextScene: 'PlayState',
      message: `Loading ${level.name}...`,
      minDuration: 300,
      prepareCallback: buildPrepareCallback(level, {
        characterRegistry: CharacterRegistry.getInstance(),
        stageRegistry: StageRegistry.getInstance(),
        noteStyleRegistry: NoteStyleRegistry.getInstance()
      })
    });
  }

  executeBack() {
    this.transitionToScene('MainMenuState');
  }

  /**
   * Make level text items tappable. Tapping selects (highlights) the level
   * and shows its info. The Play button is used to actually launch.
   */
  enableTouchOnLevelItems() {
    const minSize = 48;
    this.levelTexts.forEach((text, index) => {
      if (!text.setInteractive) return;
      text.setInteractive({ useHandCursor: true });
      if (text.input && text.input.hitArea) {
        text.input.hitArea.width = Math.max(text.input.hitArea.width, minSize);
        text.input.hitArea.height = Math.max(text.input.hitArea.height, minSize);
      }
      text.on('pointerdown', () => {
        if (this.transitioning) return;
        this.selectedIndex = index;
        this.updateSelection();
      });
    });
  }

  shutdown() {
    super.shutdown();
    this.levelTexts.forEach((text) => text.destroy());
    this.levelTexts = [];
    this.descriptionText = null;
    this.songText = null;
    this.difficultyText = null;
    this.bestScoreText = null;
    this.progressText = null;
    this.statusText = null;
    this.backButton = null;
    this.playButton = null;
  }
}

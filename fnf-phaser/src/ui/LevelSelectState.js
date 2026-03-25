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

    this.add.text(96, 72, 'Levels', {
      fontFamily: 'Arial Black',
      fontSize: '54px',
      color: '#ffffff'
    });

    this.add.text(96, 128, 'Five playable levels. Fixed difficulties. Full menu flow goes here.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#8fa3bf'
    });

    this.statusText = this.add.text(96, height - 72, 'Loading levels...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#facc15'
    });

    this.songText = this.add.text(width - 420, 180, '', {
      fontFamily: 'Arial Black',
      fontSize: '30px',
      color: '#ffffff',
      wordWrap: { width: 320 }
    });

    this.difficultyText = this.add.text(width - 420, 240, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#7dd3fc'
    });

    this.bestScoreText = this.add.text(width - 420, 285, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#facc15',
      wordWrap: { width: 320 }
    });

    this.progressText = this.add.text(width - 420, 325, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#86efac',
      wordWrap: { width: 320 }
    });

    this.descriptionText = this.add.text(width - 420, 370, '', {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d1d5db',
      wordWrap: { width: 320 }
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
    this.updateSelection();

    if (this.statusText) {
      this.statusText.setText('ENTER to play. ESC to return.');
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

  executeSelection() {
    const level = this.levels[this.selectedIndex];
    if (!level) {
      this.transitioning = false;
      return;
    }

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
  }
}

/**
 * @fileoverview Pause SubState - In-game pause menu overlay
 * Implements FR-6.6: Pause menu with Resume, Restart, Exit options
 */

import Phaser from 'phaser';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * Pause menu option
 * @typedef {Object} PauseOption
 * @property {string} name - Display name
 * @property {string} action - Action identifier
 */

/**
 * PauseSubState - Overlay pause menu during gameplay
 * @extends Phaser.Scene
 */
export default class PauseSubState extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseSubState' });

    /**
     * Menu options
     * @type {PauseOption[]}
     */
    this.options = [
      { name: 'Resume', action: 'resume' },
      { name: 'Restart Song', action: 'restart' },
      { name: 'Change Difficulty', action: 'difficulty' },
      { name: 'Exit to Menu', action: 'exit' }
    ];

    /**
     * Currently selected option index
     * @type {number}
     */
    this.selectedIndex = 0;

    /**
     * Option text objects
     * @type {Phaser.GameObjects.Text[]}
     */
    this.optionTexts = [];

    /**
     * Background overlay
     * @type {Phaser.GameObjects.Graphics | null}
     */
    this.overlay = null;

    /**
     * Parent scene key (PlayState)
     * @type {string | null}
     */
    this.parentSceneKey = null;

    /**
     * Song data passed from parent
     * @type {{songName?: string, difficulty?: string, [key: string]: any} | null}
     */
    this.songData = null;

    /**
     * Whether transitioning
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Difficulty selector visible
     * @type {boolean}
     */
    this.difficultyMode = false;

    /**
     * Available difficulties
     * @type {string[]}
     */
    this.difficulties = ['easy', 'normal', 'hard'];

    /**
     * Selected difficulty index
     * @type {number}
     */
    this.selectedDifficultyIndex = 1;

    /**
     * Difficulty container
     * @type {Phaser.GameObjects.Container | null}
     */
    this.difficultyContainer = null;

    /**
     * Difficulty text objects
     * @type {Phaser.GameObjects.Text[]}
     */
    this.difficultyTexts = [];
  }

  /**
   * Initialize with data from parent scene
   * @param {{parentScene?: string, songData?: {songName?: string, difficulty?: string, [key: string]: any}} | undefined} data - Initialization data
   */
  init(data) {
    this.parentSceneKey = data?.parentScene || 'PlayState';
    this.songData = data?.songData || null;
    this.selectedIndex = 0;
    this.transitioning = false;
    this.difficultyMode = false;

    // Set current difficulty
    if (this.songData?.difficulty) {
      const diffIndex = this.difficulties.indexOf(this.songData.difficulty);
      if (diffIndex >= 0) {
        this.selectedDifficultyIndex = diffIndex;
      }
    }
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    if (!this.cache.audio.exists('scroll-sound')) {
      this.load.audio('scroll-sound', 'assets/funkin.assets/preload/sounds/scrollMenu.mp3');
    }
  }

  /**
   * Create the pause menu
   */
  create() {
    const { width, height } = this.cameras.main;

    // Semi-transparent overlay
    this.overlay = this.add.graphics();
    this.overlay.fillStyle(0x000000, 0.6);
    this.overlay.fillRect(0, 0, width, height);

    // Pause title
    this.add
      .text(width / 2, 150, 'PAUSED', {
        fontFamily: 'Arial Black',
        fontSize: '64px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
      })
      .setOrigin(0.5, 0.5);

    // Song info (if available)
    if (this.songData?.songName) {
      this.add
        .text(width / 2, 220, this.songData.songName, {
          fontFamily: 'Arial',
          fontSize: '24px',
          color: '#888888'
        })
        .setOrigin(0.5, 0.5);
    }

    // Menu options
    this.createMenuOptions();

    // Difficulty selector (hidden initially)
    this.createDifficultySelector();

    // Setup input
    this.setupInput();

    // Update display
    this.updateDisplay();

    // Emit pause event
    EventBus.emit(Events.PAUSE);

    this.events?.on('shutdown', this.shutdown, this);
  }

  /**
   * Create menu option texts
   */
  createMenuOptions() {
    const { width, height } = this.cameras.main;
    const startY = height / 2 - 50;
    const spacing = 80;

    this.optionTexts = [];

    this.options.forEach((option, index) => {
      const text = this.add.text(width / 2, startY + index * spacing, option.name, {
        fontFamily: 'Arial',
        fontSize: '40px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      });
      text.setOrigin(0.5, 0.5);
      if (text.setInteractive) {
        text.setInteractive({ useHandCursor: true });
        text.on('pointerdown', () => {
          if (this.transitioning) {
            return;
          }
          this.selectedIndex = index;
          this.updateDisplay();
          this.onSelect();
        });
      }
      this.optionTexts.push(text);
    });
  }

  /**
   * Create difficulty selector
   */
  createDifficultySelector() {
    const { width, height } = this.cameras.main;

    this.difficultyContainer = this.add.container(width / 2, height / 2);
    this.difficultyContainer.setVisible(false);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRoundedRect(-200, -100, 400, 200, 15);
    this.difficultyContainer.add(bg);

    // Title
    const title = this.add
      .text(0, -70, 'Select Difficulty', {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#ffffff'
      })
      .setOrigin(0.5, 0.5);
    this.difficultyContainer.add(title);

    // Difficulty texts
    this.difficultyTexts = [];
    this.difficulties.forEach((diff, index) => {
      const text = this.add
        .text(0, -20 + index * 50, diff.toUpperCase(), {
          fontFamily: 'Arial',
          fontSize: '30px',
          color: '#ffffff'
        })
        .setOrigin(0.5, 0.5);
      if (text.setInteractive) {
        text.setInteractive({ useHandCursor: true });
        text.on('pointerdown', () => {
          if (this.transitioning) {
            return;
          }
          this.selectedDifficultyIndex = index;
          this.updateDisplay();
          this.confirmDifficulty();
        });
      }
      this.difficultyContainer?.add(text);
      this.difficultyTexts.push(text);
    });
  }

  /**
   * Setup input handlers
   */
  setupInput() {
    const kb = this.input.keyboard;
    if (!kb) {
      return;
    }
    // Navigation
    kb.on('keydown-UP', this.onNavigateUp, this);
    kb.on('keydown-DOWN', this.onNavigateDown, this);
    kb.on('keydown-W', this.onNavigateUp, this);
    kb.on('keydown-S', this.onNavigateDown, this);

    // Selection
    kb.on('keydown-ENTER', this.onSelect, this);
    kb.on('keydown-SPACE', this.onSelect, this);

    // Back/Resume
    kb.on('keydown-ESC', this.onBack, this);
    kb.on('keydown-P', this.onBack, this);
  }

  /**
   * Navigate up
   */
  onNavigateUp() {
    if (this.transitioning) {
      return;
    }

    if (this.difficultyMode) {
      this.selectedDifficultyIndex--;
      if (this.selectedDifficultyIndex < 0) {
        this.selectedDifficultyIndex = this.difficulties.length - 1;
      }
    } else {
      this.selectedIndex--;
      if (this.selectedIndex < 0) {
        this.selectedIndex = this.options.length - 1;
      }
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Navigate down
   */
  onNavigateDown() {
    if (this.transitioning) {
      return;
    }

    if (this.difficultyMode) {
      this.selectedDifficultyIndex++;
      if (this.selectedDifficultyIndex >= this.difficulties.length) {
        this.selectedDifficultyIndex = 0;
      }
    } else {
      this.selectedIndex++;
      if (this.selectedIndex >= this.options.length) {
        this.selectedIndex = 0;
      }
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Select current option
   */
  onSelect() {
    if (this.transitioning) {
      return;
    }

    if (this.difficultyMode) {
      this.confirmDifficulty();
      return;
    }

    const option = this.options[this.selectedIndex];
    this.executeAction(option.action);
  }

  /**
   * Go back / Resume
   */
  onBack() {
    if (this.transitioning) {
      return;
    }

    if (this.difficultyMode) {
      this.hideDifficultySelector();
      return;
    }

    this.executeAction('resume');
  }

  /**
   * Execute menu action
   * @param {string} action - Action to execute
   */
  executeAction(action) {
    switch (action) {
      case 'resume':
        this.resumeGame();
        break;

      case 'restart':
        this.restartSong();
        break;

      case 'difficulty':
        this.showDifficultySelector();
        break;

      case 'exit':
        this.exitToMenu();
        break;
    }
  }

  /**
   * Resume the game
   */
  resumeGame() {
    this.transitioning = true;

    // Emit resume event
    EventBus.emit(Events.RESUME);

    // Close this scene and resume parent
    this.scene.stop();
    if (this.parentSceneKey) {
      this.scene.resume(this.parentSceneKey);
    }
  }

  /**
   * Restart the current song
   */
  restartSong() {
    this.transitioning = true;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Stop pause scene
      this.scene.stop();

      // Restart play state with same data
      if (this.parentSceneKey) {
        this.scene.stop(this.parentSceneKey);
        this.scene.start(this.parentSceneKey, this.songData || undefined);
      }
    });
  }

  /**
   * Show difficulty selector
   */
  showDifficultySelector() {
    this.difficultyMode = true;
    this.difficultyContainer?.setVisible(true);

    // Hide main options
    this.optionTexts.forEach((text) => text.setVisible(false));

    this.updateDisplay();
  }

  /**
   * Hide difficulty selector
   */
  hideDifficultySelector() {
    this.difficultyMode = false;
    this.difficultyContainer?.setVisible(false);

    // Show main options
    this.optionTexts.forEach((text) => text.setVisible(true));

    this.updateDisplay();
  }

  /**
   * Confirm difficulty selection
   */
  confirmDifficulty() {
    const newDifficulty = this.difficulties[this.selectedDifficultyIndex];

    // If same difficulty, just hide selector
    if (newDifficulty === this.songData?.difficulty) {
      this.hideDifficultySelector();
      return;
    }

    // Restart with new difficulty
    this.transitioning = true;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      if (this.parentSceneKey) {
        this.scene.stop(this.parentSceneKey);
        this.scene.start(this.parentSceneKey, {
          ...this.songData,
          difficulty: newDifficulty
        });
      }
    });
  }

  /**
   * Exit to main menu
   */
  exitToMenu() {
    this.transitioning = true;

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Stop both scenes
      this.scene.stop();
      if (this.parentSceneKey) {
        this.scene.stop(this.parentSceneKey);
      }

      // Go to main menu
      this.scene.start('MainMenuState');
    });
  }

  /**
   * Update display
   */
  updateDisplay() {
    if (this.difficultyMode) {
      // Update difficulty selection
      this.difficultyTexts.forEach((text, index) => {
        if (index === this.selectedDifficultyIndex) {
          text.setColor('#ffff00');
          text.setScale(1.2);
        } else {
          text.setColor('#ffffff');
          text.setScale(1.0);
        }
      });
    } else {
      // Update main menu selection
      this.optionTexts.forEach((text, index) => {
        if (index === this.selectedIndex) {
          text.setColor('#ffff00');
          text.setScale(1.1);
        } else {
          text.setColor('#ffffff');
          text.setScale(1.0);
        }
      });
    }
  }

  /**
   * Play scroll sound
   */
  playScrollSound() {
    if (this.cache.audio.exists('scroll-sound')) {
      this.sound.play('scroll-sound', { volume: 0.5 });
    }
  }

  /**
   * Update loop
   * @param {number} time - Time
   * @param {number} _delta - Delta
   */
  update(time, _delta) {
    // Pulse selected option
    if (!this.transitioning) {
      const targetTexts = this.difficultyMode ? this.difficultyTexts : this.optionTexts;
      const targetIndex = this.difficultyMode ? this.selectedDifficultyIndex : this.selectedIndex;

      if (targetTexts && targetTexts[targetIndex]) {
        const pulse = 1.1 + Math.sin(time / 150) * 0.05;
        targetTexts[targetIndex].setScale(pulse);
      }
    }
  }

  /**
   * Cleanup
   */
  shutdown() {
    this.events?.off('shutdown', this.shutdown, this);
    const kb = this.input.keyboard;
    if (kb) {
      kb.off('keydown-UP', this.onNavigateUp, this);
      kb.off('keydown-DOWN', this.onNavigateDown, this);
      kb.off('keydown-W', this.onNavigateUp, this);
      kb.off('keydown-S', this.onNavigateDown, this);
      kb.off('keydown-ENTER', this.onSelect, this);
      kb.off('keydown-SPACE', this.onSelect, this);
      kb.off('keydown-ESC', this.onBack, this);
      kb.off('keydown-P', this.onBack, this);
    }

    this.optionTexts = [];
    this.difficultyTexts = [];
    this.overlay = null;
    this.songData = null;
    this.difficultyContainer = null;
  }
}

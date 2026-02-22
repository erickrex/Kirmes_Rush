/**
 * @fileoverview Story Menu State - Week/Level selection
 * Implements FR-6.3: Story mode week selection
 */

import Phaser from 'phaser';
import * as Constants from '../core/Constants.js';

/**
 * Week data structure
 * @typedef {Object} WeekData
 * @property {string} id - Week identifier
 * @property {string} name - Display name
 * @property {string[]} tracks - Song list
 * @property {string[]} difficulties - Available difficulties
 * @property {string} [character] - Character to display
 * @property {boolean} [locked] - Whether week is locked
 */

/**
 * StoryMenuState - Week selection for story mode
 * @extends Phaser.Scene
 */
export default class StoryMenuState extends Phaser.Scene {
  constructor() {
    super({ key: 'StoryMenuState' });

    /**
     * Available weeks
     * @type {WeekData[]}
     */
    this.weeks = [
      { id: 'tutorial', name: 'Tutorial', tracks: ['Tutorial'], difficulties: ['easy', 'normal', 'hard'] },
      { id: 'week1', name: 'Week 1', tracks: ['Bopeebo', 'Fresh', 'Dad Battle'], difficulties: ['easy', 'normal', 'hard'] },
      { id: 'week2', name: 'Week 2', tracks: ['Spookeez', 'South', 'Monster'], difficulties: ['easy', 'normal', 'hard'] },
      { id: 'week3', name: 'Week 3', tracks: ['Pico', 'Philly Nice', 'Blammed'], difficulties: ['easy', 'normal', 'hard'] },
      { id: 'week4', name: 'Week 4', tracks: ['Satin Panties', 'High', 'MILF'], difficulties: ['easy', 'normal', 'hard'] },
      { id: 'week5', name: 'Week 5', tracks: ['Cocoa', 'Eggnog', 'Winter Horrorland'], difficulties: ['easy', 'normal', 'hard'] },
      { id: 'week6', name: 'Week 6', tracks: ['Senpai', 'Roses', 'Thorns'], difficulties: ['easy', 'normal', 'hard'] },
      { id: 'week7', name: 'Week 7', tracks: ['Ugh', 'Guns', 'Stress'], difficulties: ['easy', 'normal', 'hard'] }
    ];

    /**
     * Currently selected week index
     * @type {number}
     */
    this.selectedWeekIndex = 0;

    /**
     * Currently selected difficulty index
     * @type {number}
     */
    this.selectedDifficultyIndex = 1; // Default to 'normal'

    /**
     * Week display texts
     * @type {Phaser.GameObjects.Text[]}
     */
    this.weekTexts = [];

    /**
     * Track list text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.trackListText = null;

    /**
     * Difficulty text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.difficultyText = null;

    /**
     * Week title text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.weekTitleText = null;

    /**
     * Whether transitioning
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Score text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.scoreText = null;
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    // Week banners/images would be loaded here
    this.load.image('story-bg', 'images/menu/menuBGMagenta.png');

    // UI sounds
    if (!this.cache.audio.exists('scroll-sound')) {
      this.load.audio('scroll-sound', 'audio/scrollMenu.mp3');
    }
    if (!this.cache.audio.exists('confirm-sound')) {
      this.load.audio('confirm-sound', 'audio/confirmMenu.mp3');
    }
    if (!this.cache.audio.exists('cancel-sound')) {
      this.load.audio('cancel-sound', 'audio/cancelMenu.mp3');
    }
  }

  /**
   * Create the menu
   */
  create() {
    this.transitioning = false;
    this.selectedWeekIndex = 0;
    this.selectedDifficultyIndex = 1;

    const { width, height } = this.cameras.main;

    // Background
    this.createBackground();

    // Title
    this.add.text(width / 2, 50, 'STORY MODE', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    // Week list
    this.createWeekList();

    // Track list panel
    this.createTrackListPanel();

    // Difficulty selector
    this.createDifficultySelector();

    // Score display
    this.createScoreDisplay();

    // Setup input
    this.setupInput();

    // Update display
    this.updateDisplay();

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /**
   * Create background
   */
  createBackground() {
    const { width, height } = this.cameras.main;

    if (this.textures.exists('story-bg')) {
      const bg = this.add.sprite(width / 2, height / 2, 'story-bg');
      bg.setDisplaySize(width, height);
    } else {
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0x2e1a2e, 0x2e1a2e, 0x3e1a3e, 0x3e1a3e, 1);
      graphics.fillRect(0, 0, width, height);
    }
  }

  /**
   * Create week list
   */
  createWeekList() {
    const startX = 100;
    const startY = 150;
    const spacing = 60;

    this.weekTexts = [];

    this.weeks.forEach((week, index) => {
      const text = this.add.text(startX, startY + index * spacing, week.name, {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
      });

      if (week.locked) {
        text.setColor('#666666');
      }

      this.weekTexts.push(text);
    });
  }

  /**
   * Create track list panel
   */
  createTrackListPanel() {
    const { width, height } = this.cameras.main;

    // Panel background
    const panelX = width - 300;
    const panelY = 150;

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRoundedRect(panelX - 20, panelY - 20, 280, 200, 10);

    // Track list label
    this.add.text(panelX, panelY, 'TRACKS:', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffff00'
    });

    // Track list text
    this.trackListText = this.add.text(panelX, panelY + 40, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      lineSpacing: 8
    });
  }

  /**
   * Create difficulty selector
   */
  createDifficultySelector() {
    const { width, height } = this.cameras.main;

    // Difficulty label
    this.add.text(width / 2, height - 120, 'DIFFICULTY:', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    // Difficulty text
    this.difficultyText = this.add.text(width / 2, height - 80, '', {
      fontFamily: 'Arial Black',
      fontSize: '36px',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5, 0.5);

    // Arrow indicators
    this.add.text(width / 2 - 150, height - 80, '<', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.add.text(width / 2 + 150, height - 80, '>', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
  }

  /**
   * Create score display
   */
  createScoreDisplay() {
    const { width } = this.cameras.main;

    this.scoreText = this.add.text(width - 20, 20, 'SCORE: 0', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(1, 0);
  }

  /**
   * Setup input
   */
  setupInput() {
    // Week navigation
    this.input.keyboard.on('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard.on('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard.on('keydown-W', this.onNavigateUp, this);
    this.input.keyboard.on('keydown-S', this.onNavigateDown, this);

    // Difficulty navigation
    this.input.keyboard.on('keydown-LEFT', this.onDifficultyLeft, this);
    this.input.keyboard.on('keydown-RIGHT', this.onDifficultyRight, this);
    this.input.keyboard.on('keydown-A', this.onDifficultyLeft, this);
    this.input.keyboard.on('keydown-D', this.onDifficultyRight, this);

    // Selection
    this.input.keyboard.on('keydown-ENTER', this.onSelect, this);
    this.input.keyboard.on('keydown-SPACE', this.onSelect, this);

    // Back
    this.input.keyboard.on('keydown-ESC', this.onBack, this);
    this.input.keyboard.on('keydown-BACKSPACE', this.onBack, this);
  }

  /**
   * Navigate up in week list
   */
  onNavigateUp() {
    if (this.transitioning) return;

    this.selectedWeekIndex--;
    if (this.selectedWeekIndex < 0) {
      this.selectedWeekIndex = this.weeks.length - 1;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Navigate down in week list
   */
  onNavigateDown() {
    if (this.transitioning) return;

    this.selectedWeekIndex++;
    if (this.selectedWeekIndex >= this.weeks.length) {
      this.selectedWeekIndex = 0;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Change difficulty left
   */
  onDifficultyLeft() {
    if (this.transitioning) return;

    const week = this.weeks[this.selectedWeekIndex];
    this.selectedDifficultyIndex--;
    if (this.selectedDifficultyIndex < 0) {
      this.selectedDifficultyIndex = week.difficulties.length - 1;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Change difficulty right
   */
  onDifficultyRight() {
    if (this.transitioning) return;

    const week = this.weeks[this.selectedWeekIndex];
    this.selectedDifficultyIndex++;
    if (this.selectedDifficultyIndex >= week.difficulties.length) {
      this.selectedDifficultyIndex = 0;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Select current week
   */
  onSelect() {
    if (this.transitioning) return;

    const week = this.weeks[this.selectedWeekIndex];

    if (week.locked) {
      // Play error sound
      return;
    }

    this.transitioning = true;
    this.playConfirmSound();

    // Start the week
    this.startWeek(week);
  }

  /**
   * Go back to main menu
   */
  onBack() {
    if (this.transitioning) return;

    this.transitioning = true;
    this.playCancelSound();

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MainMenuState');
    });
  }

  /**
   * Update display
   */
  updateDisplay() {
    const week = this.weeks[this.selectedWeekIndex];

    // Update week list highlighting
    this.weekTexts.forEach((text, index) => {
      if (index === this.selectedWeekIndex) {
        text.setColor('#ffff00');
        text.setScale(1.2);
      } else {
        text.setColor(this.weeks[index].locked ? '#666666' : '#ffffff');
        text.setScale(1.0);
      }
    });

    // Update track list
    if (this.trackListText) {
      this.trackListText.setText(week.tracks.join('\n'));
    }

    // Update difficulty
    if (this.difficultyText) {
      const difficulty = week.difficulties[this.selectedDifficultyIndex];
      this.difficultyText.setText(difficulty.toUpperCase());

      // Color based on difficulty
      const colors = {
        easy: '#00ff00',
        normal: '#ffff00',
        hard: '#ff0000',
        erect: '#ff00ff',
        nightmare: '#8800ff'
      };
      this.difficultyText.setColor(colors[difficulty] || '#ffffff');
    }

    // Update score (would load from save data)
    if (this.scoreText) {
      this.scoreText.setText('SCORE: 0');
    }
  }

  /**
   * Start the selected week
   * @param {WeekData} week - Week to start
   */
  startWeek(week) {
    const difficulty = week.difficulties[this.selectedDifficultyIndex];

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Would transition to PlayState with week data
      this.scene.start('PlayState', {
        weekId: week.id,
        tracks: week.tracks,
        difficulty: difficulty,
        currentTrack: 0
      });
    });
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
   * Play confirm sound
   */
  playConfirmSound() {
    if (this.cache.audio.exists('confirm-sound')) {
      this.sound.play('confirm-sound');
    }
  }

  /**
   * Play cancel sound
   */
  playCancelSound() {
    if (this.cache.audio.exists('cancel-sound')) {
      this.sound.play('cancel-sound');
    }
  }

  /**
   * Cleanup
   */
  shutdown() {
    this.input.keyboard.off('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard.off('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard.off('keydown-W', this.onNavigateUp, this);
    this.input.keyboard.off('keydown-S', this.onNavigateDown, this);
    this.input.keyboard.off('keydown-LEFT', this.onDifficultyLeft, this);
    this.input.keyboard.off('keydown-RIGHT', this.onDifficultyRight, this);
    this.input.keyboard.off('keydown-A', this.onDifficultyLeft, this);
    this.input.keyboard.off('keydown-D', this.onDifficultyRight, this);
    this.input.keyboard.off('keydown-ENTER', this.onSelect, this);
    this.input.keyboard.off('keydown-SPACE', this.onSelect, this);
    this.input.keyboard.off('keydown-ESC', this.onBack, this);
    this.input.keyboard.off('keydown-BACKSPACE', this.onBack, this);

    this.weekTexts = [];
    this.trackListText = null;
    this.difficultyText = null;
    this.scoreText = null;
  }
}

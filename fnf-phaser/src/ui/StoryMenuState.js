/**
 * @fileoverview Story Menu State - Week/Level selection
 * Implements FR-6.3: Story mode week selection
 */

import BaseMenuState from './BaseMenuState.js';
import * as Constants from '../core/Constants.js';

/**
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
 * @extends BaseMenuState
 */
export default class StoryMenuState extends BaseMenuState {
  constructor() {
    super({ key: 'StoryMenuState' });

    /** @type {WeekData[]} */
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

    /** @type {number} */
    this.selectedWeekIndex = 0;
    /** @type {number} */
    this.selectedDifficultyIndex = 1;
    /** @type {Phaser.GameObjects.Text[]} */
    this.weekTexts = [];
    /** @type {Phaser.GameObjects.Text | null} */
    this.trackListText = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.difficultyText = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.scoreText = null;
  }

  /** @override */
  getInputBindings() {
    return [
      { key: 'keydown-UP', handler: this.onNavigateUp },
      { key: 'keydown-DOWN', handler: this.onNavigateDown },
      { key: 'keydown-W', handler: this.onNavigateUp },
      { key: 'keydown-S', handler: this.onNavigateDown },
      { key: 'keydown-LEFT', handler: this.onDifficultyLeft },
      { key: 'keydown-RIGHT', handler: this.onDifficultyRight },
      { key: 'keydown-A', handler: this.onDifficultyLeft },
      { key: 'keydown-D', handler: this.onDifficultyRight },
      { key: 'keydown-ENTER', handler: this.onSelect },
      { key: 'keydown-SPACE', handler: this.onSelect },
      { key: 'keydown-ESC', handler: this.onBack },
      { key: 'keydown-BACKSPACE', handler: this.onBack }
    ];
  }

  preload() {
    this.load.setPath('assets/');
    this.load.image('story-bg', 'images/menu/menuBGMagenta.png');
    this.preloadMenuSounds();
  }

  create() {
    this.transitioning = false;
    this.selectedWeekIndex = 0;
    this.selectedDifficultyIndex = 1;

    const { width, height } = this.cameras.main;

    this.createBackground('story-bg', 0x2e1a2e, 0x3e1a3e);

    this.add.text(width / 2, 50, 'STORY MODE', {
      fontFamily: 'Arial Black', fontSize: '48px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    this.createWeekList();
    this.createTrackListPanel();
    this.createDifficultySelector();
    this.createScoreDisplay();
    this.setupInput();
    this.updateDisplay();
    this.fadeIn();
  }

  createWeekList() {
    this.weekTexts = [];
    this.weeks.forEach((week, index) => {
      const text = this.add.text(100, 150 + index * 60, week.name, {
        fontFamily: 'Arial', fontSize: '32px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2
      });
      if (week.locked) text.setColor('#666666');
      this.weekTexts.push(text);
    });
  }

  createTrackListPanel() {
    const { width } = this.cameras.main;
    const panelX = width - 300;

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRoundedRect(panelX - 20, 130, 280, 200, 10);

    this.add.text(panelX, 150, 'TRACKS:', {
      fontFamily: 'Arial', fontSize: '24px', color: '#ffff00'
    });

    this.trackListText = this.add.text(panelX, 190, '', {
      fontFamily: 'Arial', fontSize: '20px', color: '#ffffff', lineSpacing: 8
    });
  }

  createDifficultySelector() {
    const { width, height } = this.cameras.main;

    this.add.text(width / 2, height - 120, 'DIFFICULTY:', {
      fontFamily: 'Arial', fontSize: '24px', color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.difficultyText = this.add.text(width / 2, height - 80, '', {
      fontFamily: 'Arial Black', fontSize: '36px', color: '#00ff00',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 0.5);

    this.add.text(width / 2 - 150, height - 80, '<', {
      fontFamily: 'Arial', fontSize: '36px', color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.add.text(width / 2 + 150, height - 80, '>', {
      fontFamily: 'Arial', fontSize: '36px', color: '#ffffff'
    }).setOrigin(0.5, 0.5);
  }

  createScoreDisplay() {
    const { width } = this.cameras.main;
    this.scoreText = this.add.text(width - 20, 20, 'SCORE: 0', {
      fontFamily: 'Arial', fontSize: '24px', color: '#ffffff'
    }).setOrigin(1, 0);
  }

  onNavigateUp() {
    if (this.transitioning) return;
    this.selectedWeekIndex--;
    if (this.selectedWeekIndex < 0) this.selectedWeekIndex = this.weeks.length - 1;
    this.playScrollSound();
    this.updateDisplay();
  }

  onNavigateDown() {
    if (this.transitioning) return;
    this.selectedWeekIndex++;
    if (this.selectedWeekIndex >= this.weeks.length) this.selectedWeekIndex = 0;
    this.playScrollSound();
    this.updateDisplay();
  }

  onDifficultyLeft() {
    if (this.transitioning) return;
    const week = this.weeks[this.selectedWeekIndex];
    this.selectedDifficultyIndex--;
    if (this.selectedDifficultyIndex < 0) this.selectedDifficultyIndex = week.difficulties.length - 1;
    this.playScrollSound();
    this.updateDisplay();
  }

  onDifficultyRight() {
    if (this.transitioning) return;
    const week = this.weeks[this.selectedWeekIndex];
    this.selectedDifficultyIndex++;
    if (this.selectedDifficultyIndex >= week.difficulties.length) this.selectedDifficultyIndex = 0;
    this.playScrollSound();
    this.updateDisplay();
  }

  onSelect() {
    if (this.transitioning) return;
    const week = this.weeks[this.selectedWeekIndex];
    if (week.locked) return;

    this.transitioning = true;
    this.playConfirmSound();
    this.startWeek(week);
  }

  onBack() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.playCancelSound();
    this.transitionToScene('MainMenuState');
  }

  updateDisplay() {
    const week = this.weeks[this.selectedWeekIndex];

    this.weekTexts.forEach((text, index) => {
      if (index === this.selectedWeekIndex) {
        text.setColor('#ffff00');
        text.setScale(1.2);
      } else {
        text.setColor(this.weeks[index].locked ? '#666666' : '#ffffff');
        text.setScale(1.0);
      }
    });

    if (this.trackListText) this.trackListText.setText(week.tracks.join('\n'));

    if (this.difficultyText) {
      const difficulty = week.difficulties[this.selectedDifficultyIndex];
      this.difficultyText.setText(difficulty.toUpperCase());
      const colors = { easy: '#00ff00', normal: '#ffff00', hard: '#ff0000', erect: '#ff00ff', nightmare: '#8800ff' };
      this.difficultyText.setColor(colors[difficulty] || '#ffffff');
    }

    if (this.scoreText) this.scoreText.setText('SCORE: 0');
  }

  startWeek(week) {
    const difficulty = week.difficulties[this.selectedDifficultyIndex];
    this.transitionToScene('PlayState', {
      weekId: week.id, tracks: week.tracks, difficulty, currentTrack: 0
    });
  }

  shutdown() {
    super.shutdown();
    this.weekTexts = [];
    this.trackListText = null;
    this.difficultyText = null;
    this.scoreText = null;
  }
}

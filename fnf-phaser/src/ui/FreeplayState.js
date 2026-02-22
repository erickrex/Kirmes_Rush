/**
 * @fileoverview Freeplay State - Individual song selection
 * Implements FR-6.4: Freeplay song selection with capsules
 */

import BaseMenuState from './BaseMenuState.js';
import * as Constants from '../core/Constants.js';

/**
 * @typedef {Object} SongCapsule
 * @property {string} id - Song identifier
 * @property {string} name - Display name
 * @property {string} artist - Song artist
 * @property {string[]} difficulties - Available difficulties
 * @property {number} [bpm] - Song BPM
 * @property {string} [icon] - Character icon
 * @property {number} [highScore] - High score
 */

/**
 * FreeplayState - Song selection for freeplay mode
 * @extends BaseMenuState
 */
export default class FreeplayState extends BaseMenuState {
  constructor() {
    super({ key: 'FreeplayState' });

    /** @type {SongCapsule[]} */
    this.songs = [
      { id: 'tutorial', name: 'Tutorial', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 100 },
      { id: 'bopeebo', name: 'Bopeebo', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 100 },
      { id: 'fresh', name: 'Fresh', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 120 },
      { id: 'dad-battle', name: 'Dad Battle', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 180 },
      { id: 'spookeez', name: 'Spookeez', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 150 },
      { id: 'south', name: 'South', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 165 },
      { id: 'pico', name: 'Pico', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 150 },
      { id: 'philly-nice', name: 'Philly Nice', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 175 },
      { id: 'blammed', name: 'Blammed', artist: 'Kawai Sprite', difficulties: ['easy', 'normal', 'hard'], bpm: 165 }
    ];

    /** @type {number} */
    this.selectedIndex = 0;
    /** @type {number} */
    this.selectedDifficultyIndex = 1;
    /** @type {Phaser.GameObjects.Container[]} */
    this.capsules = [];
    /** @type {number} */
    this.scrollOffset = 0;
    /** @type {number} */
    this.targetScrollOffset = 0;
    /** @type {number} */
    this.visibleCapsules = 7;
    /** @type {Phaser.GameObjects.Container | null} */
    this.infoPanel = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.difficultyText = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.scoreText = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.bpmText = null;
    /** @type {string | null} */
    this.letterFilter = null;
    /** @type {SongCapsule[]} */
    this.filteredSongs = [];
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
      { key: 'keydown-BACKSPACE', handler: this.onBack },
      { key: 'keydown-TAB', handler: this.onCycleFilter }
    ];
  }

  preload() {
    this.load.setPath('assets/');
    this.load.image('freeplay-bg', 'images/menu/menuDesat.png');
    this.load.image('capsule', 'images/freeplay/capsule.png');
    this.preloadMenuSounds();
  }

  create() {
    this.transitioning = false;
    this.selectedIndex = 0;
    this.selectedDifficultyIndex = 1;
    this.letterFilter = null;
    this.filteredSongs = [...this.songs];

    const { width, height } = this.cameras.main;

    this.createBackground('freeplay-bg', 0x1a3a5c, 0x0a1a2c);

    this.add.text(width / 2, 40, 'FREEPLAY', {
      fontFamily: 'Arial Black', fontSize: '48px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    this.createCapsules();
    this.createInfoPanel();
    this.createDifficultySelector();
    this.createLetterFilter();
    this.setupInput();
    this.updateDisplay();
    this.fadeIn();
  }

  createCapsules() {
    this.capsules = [];
    for (let i = 0; i < this.visibleCapsules; i++) {
      const container = this.createCapsule(0, 120 + i * 80);
      this.capsules.push(container);
    }
  }

  createCapsule(x, y) {
    const { width } = this.cameras.main;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(50, 0, width - 400, 70, 10);
    container.add(bg);

    const nameText = this.add.text(70, 15, '', { fontFamily: 'Arial', fontSize: '28px', color: '#ffffff' });
    container.add(nameText);
    container.setData('nameText', nameText);

    const artistText = this.add.text(70, 45, '', { fontFamily: 'Arial', fontSize: '16px', color: '#aaaaaa' });
    container.add(artistText);
    container.setData('artistText', artistText);

    const scoreText = this.add.text(width - 420, 25, '', { fontFamily: 'Arial', fontSize: '20px', color: '#ffff00' });
    container.add(scoreText);
    container.setData('scoreText', scoreText);

    return container;
  }

  createInfoPanel() {
    const { width } = this.cameras.main;
    const panelX = width - 300;

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.8);
    graphics.fillRoundedRect(panelX - 20, 120, 300, 250, 10);

    this.add.text(panelX, 140, 'BPM:', { fontFamily: 'Arial', fontSize: '20px', color: '#888888' });
    this.bpmText = this.add.text(panelX + 60, 140, '0', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff' });

    this.add.text(panelX, 180, 'HIGH SCORE:', { fontFamily: 'Arial', fontSize: '20px', color: '#888888' });
    this.scoreText = this.add.text(panelX, 210, '0', { fontFamily: 'Arial Black', fontSize: '32px', color: '#ffff00' });
  }

  createDifficultySelector() {
    const { width, height } = this.cameras.main;

    this.add.text(width - 200, height - 100, 'DIFFICULTY:', {
      fontFamily: 'Arial', fontSize: '20px', color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.difficultyText = this.add.text(width - 200, height - 60, '', {
      fontFamily: 'Arial Black', fontSize: '28px', color: '#00ff00',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5, 0.5);

    this.add.text(width - 300, height - 60, '<', { fontFamily: 'Arial', fontSize: '28px', color: '#ffffff' }).setOrigin(0.5, 0.5);
    this.add.text(width - 100, height - 60, '>', { fontFamily: 'Arial', fontSize: '28px', color: '#ffffff' }).setOrigin(0.5, 0.5);
  }

  createLetterFilter() {
    this.letterFilterText = this.add.text(50, this.cameras.main.height - 50, 'Filter: ALL', {
      fontFamily: 'Arial', fontSize: '20px', color: '#ffffff'
    });
  }

  onNavigateUp() {
    if (this.transitioning || this.filteredSongs.length === 0) return;
    this.selectedIndex--;
    if (this.selectedIndex < 0) this.selectedIndex = this.filteredSongs.length - 1;
    this.playScrollSound();
    this.updateDisplay();
  }

  onNavigateDown() {
    if (this.transitioning || this.filteredSongs.length === 0) return;
    this.selectedIndex++;
    if (this.selectedIndex >= this.filteredSongs.length) this.selectedIndex = 0;
    this.playScrollSound();
    this.updateDisplay();
  }

  onDifficultyLeft() {
    if (this.transitioning || this.filteredSongs.length === 0) return;
    const song = this.filteredSongs[this.selectedIndex];
    this.selectedDifficultyIndex--;
    if (this.selectedDifficultyIndex < 0) this.selectedDifficultyIndex = song.difficulties.length - 1;
    this.playScrollSound();
    this.updateDisplay();
  }

  onDifficultyRight() {
    if (this.transitioning || this.filteredSongs.length === 0) return;
    const song = this.filteredSongs[this.selectedIndex];
    this.selectedDifficultyIndex++;
    if (this.selectedDifficultyIndex >= song.difficulties.length) this.selectedDifficultyIndex = 0;
    this.playScrollSound();
    this.updateDisplay();
  }

  onCycleFilter() {
    if (this.transitioning) return;
    const letters = [null, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    const currentIndex = letters.indexOf(this.letterFilter);
    this.letterFilter = letters[(currentIndex + 1) % letters.length];
    this.applyFilter();
    this.updateDisplay();
  }

  applyFilter() {
    if (this.letterFilter === null) {
      this.filteredSongs = [...this.songs];
    } else {
      this.filteredSongs = this.songs.filter(song => song.name.toUpperCase().startsWith(this.letterFilter));
    }
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredSongs.length - 1));
    if (this.letterFilterText) this.letterFilterText.setText(`Filter: ${this.letterFilter || 'ALL'}`);
  }

  onSelect() {
    if (this.transitioning || this.filteredSongs.length === 0) return;
    this.transitioning = true;
    this.playConfirmSound();
    const song = this.filteredSongs[this.selectedIndex];
    const difficulty = song.difficulties[this.selectedDifficultyIndex];
    this.startSong(song, difficulty);
  }

  onBack() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.playCancelSound();
    this.transitionToScene('MainMenuState');
  }

  updateDisplay() {
    const startIndex = Math.max(0, this.selectedIndex - Math.floor(this.visibleCapsules / 2));

    this.capsules.forEach((capsule, i) => {
      const songIndex = startIndex + i;
      const song = this.filteredSongs[songIndex];

      if (song) {
        capsule.setVisible(true);
        capsule.getData('nameText').setText(song.name);
        capsule.getData('artistText').setText(song.artist);
        capsule.getData('scoreText').setText(song.highScore ? `${song.highScore}` : '');
        capsule.setAlpha(songIndex === this.selectedIndex ? 1 : 0.7);
        capsule.setScale(songIndex === this.selectedIndex ? 1.05 : 1);
      } else {
        capsule.setVisible(false);
      }
    });

    if (this.filteredSongs.length > 0) {
      const song = this.filteredSongs[this.selectedIndex];
      if (this.bpmText) this.bpmText.setText(`${song.bpm || '?'}`);
      if (this.scoreText) this.scoreText.setText(`${song.highScore || 0}`);
      if (this.difficultyText) {
        const difficulty = song.difficulties[this.selectedDifficultyIndex];
        this.difficultyText.setText(difficulty.toUpperCase());
        const colors = { easy: '#00ff00', normal: '#ffff00', hard: '#ff0000' };
        this.difficultyText.setColor(colors[difficulty] || '#ffffff');
      }
    }
  }

  startSong(song, difficulty) {
    this.transitionToScene('PlayState', { songId: song.id, difficulty });
  }

  update(time, delta) {
    // Smooth scroll animation could be added here
  }

  shutdown() {
    super.shutdown();
    this.capsules = [];
    this.filteredSongs = [];
  }
}

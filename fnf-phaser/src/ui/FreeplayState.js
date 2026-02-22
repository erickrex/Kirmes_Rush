/**
 * @fileoverview Freeplay State - Individual song selection
 * Implements FR-6.4: Freeplay song selection with capsules
 */

import Phaser from 'phaser';
import * as Constants from '../core/Constants.js';

/**
 * Song capsule data
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
 * @extends Phaser.Scene
 */
export default class FreeplayState extends Phaser.Scene {
  constructor() {
    super({ key: 'FreeplayState' });

    /**
     * Available songs
     * @type {SongCapsule[]}
     */
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

    /**
     * Currently selected song index
     * @type {number}
     */
    this.selectedIndex = 0;

    /**
     * Currently selected difficulty index
     * @type {number}
     */
    this.selectedDifficultyIndex = 1;

    /**
     * Song capsule containers
     * @type {Phaser.GameObjects.Container[]}
     */
    this.capsules = [];

    /**
     * Scroll offset for song list
     * @type {number}
     */
    this.scrollOffset = 0;

    /**
     * Target scroll offset
     * @type {number}
     */
    this.targetScrollOffset = 0;

    /**
     * Visible capsule count
     * @type {number}
     */
    this.visibleCapsules = 7;

    /**
     * Song info panel
     * @type {Phaser.GameObjects.Container | null}
     */
    this.infoPanel = null;

    /**
     * Difficulty text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.difficultyText = null;

    /**
     * Score text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.scoreText = null;

    /**
     * BPM text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.bpmText = null;

    /**
     * Whether transitioning
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Letter filter (A-Z or null for all)
     * @type {string | null}
     */
    this.letterFilter = null;

    /**
     * Filtered songs list
     * @type {SongCapsule[]}
     */
    this.filteredSongs = [];
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    // Background
    this.load.image('freeplay-bg', 'images/menu/menuDesat.png');

    // Capsule graphics
    this.load.image('capsule', 'images/freeplay/capsule.png');

    // UI sounds
    if (!this.cache.audio.exists('scroll-sound')) {
      this.load.audio('scroll-sound', 'audio/scrollMenu.mp3');
    }
  }

  /**
   * Create the freeplay menu
   */
  create() {
    this.transitioning = false;
    this.selectedIndex = 0;
    this.selectedDifficultyIndex = 1;
    this.letterFilter = null;
    this.filteredSongs = [...this.songs];

    const { width, height } = this.cameras.main;

    // Background
    this.createBackground();

    // Title
    this.add.text(width / 2, 40, 'FREEPLAY', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    // Song capsules
    this.createCapsules();

    // Info panel
    this.createInfoPanel();

    // Difficulty selector
    this.createDifficultySelector();

    // Letter filter display
    this.createLetterFilter();

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

    if (this.textures.exists('freeplay-bg')) {
      const bg = this.add.sprite(width / 2, height / 2, 'freeplay-bg');
      bg.setDisplaySize(width, height);
      bg.setTint(0x4a86c7);
    } else {
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0x1a3a5c, 0x1a3a5c, 0x0a1a2c, 0x0a1a2c, 1);
      graphics.fillRect(0, 0, width, height);
    }
  }

  /**
   * Create song capsules
   */
  createCapsules() {
    const { width, height } = this.cameras.main;
    const capsuleHeight = 80;
    const startY = 120;

    this.capsules = [];

    for (let i = 0; i < this.visibleCapsules; i++) {
      const y = startY + i * capsuleHeight;
      const container = this.createCapsule(0, y);
      this.capsules.push(container);
    }
  }

  /**
   * Create a single capsule
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {Phaser.GameObjects.Container}
   */
  createCapsule(x, y) {
    const { width } = this.cameras.main;
    const container = this.add.container(x, y);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(50, 0, width - 400, 70, 10);
    container.add(bg);

    // Song name
    const nameText = this.add.text(70, 15, '', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffffff'
    });
    container.add(nameText);
    container.setData('nameText', nameText);

    // Artist
    const artistText = this.add.text(70, 45, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#aaaaaa'
    });
    container.add(artistText);
    container.setData('artistText', artistText);

    // Score
    const scoreText = this.add.text(width - 420, 25, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffff00'
    });
    container.add(scoreText);
    container.setData('scoreText', scoreText);

    return container;
  }

  /**
   * Create info panel
   */
  createInfoPanel() {
    const { width, height } = this.cameras.main;
    const panelX = width - 300;
    const panelY = 120;

    // Panel background
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.8);
    graphics.fillRoundedRect(panelX - 20, panelY, 300, 250, 10);

    // BPM
    this.add.text(panelX, panelY + 20, 'BPM:', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#888888'
    });

    this.bpmText = this.add.text(panelX + 60, panelY + 20, '0', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    });

    // High Score
    this.add.text(panelX, panelY + 60, 'HIGH SCORE:', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#888888'
    });

    this.scoreText = this.add.text(panelX, panelY + 90, '0', {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: '#ffff00'
    });
  }

  /**
   * Create difficulty selector
   */
  createDifficultySelector() {
    const { width, height } = this.cameras.main;

    this.add.text(width - 200, height - 100, 'DIFFICULTY:', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.difficultyText = this.add.text(width - 200, height - 60, '', {
      fontFamily: 'Arial Black',
      fontSize: '28px',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5, 0.5);

    // Arrows
    this.add.text(width - 300, height - 60, '<', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.add.text(width - 100, height - 60, '>', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
  }

  /**
   * Create letter filter display
   */
  createLetterFilter() {
    this.letterFilterText = this.add.text(50, this.cameras.main.height - 50, 'Filter: ALL', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    });
  }

  /**
   * Setup input
   */
  setupInput() {
    // Song navigation
    this.input.keyboard.on('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard.on('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard.on('keydown-W', this.onNavigateUp, this);
    this.input.keyboard.on('keydown-S', this.onNavigateDown, this);

    // Difficulty
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

    // Letter filter (Tab to cycle)
    this.input.keyboard.on('keydown-TAB', this.onCycleFilter, this);
  }

  /**
   * Navigate up
   */
  onNavigateUp() {
    if (this.transitioning || this.filteredSongs.length === 0) return;

    this.selectedIndex--;
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.filteredSongs.length - 1;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Navigate down
   */
  onNavigateDown() {
    if (this.transitioning || this.filteredSongs.length === 0) return;

    this.selectedIndex++;
    if (this.selectedIndex >= this.filteredSongs.length) {
      this.selectedIndex = 0;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Change difficulty left
   */
  onDifficultyLeft() {
    if (this.transitioning || this.filteredSongs.length === 0) return;

    const song = this.filteredSongs[this.selectedIndex];
    this.selectedDifficultyIndex--;
    if (this.selectedDifficultyIndex < 0) {
      this.selectedDifficultyIndex = song.difficulties.length - 1;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Change difficulty right
   */
  onDifficultyRight() {
    if (this.transitioning || this.filteredSongs.length === 0) return;

    const song = this.filteredSongs[this.selectedIndex];
    this.selectedDifficultyIndex++;
    if (this.selectedDifficultyIndex >= song.difficulties.length) {
      this.selectedDifficultyIndex = 0;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Cycle letter filter
   */
  onCycleFilter() {
    if (this.transitioning) return;

    const letters = [null, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    const currentIndex = letters.indexOf(this.letterFilter);
    const nextIndex = (currentIndex + 1) % letters.length;
    this.letterFilter = letters[nextIndex];

    this.applyFilter();
    this.updateDisplay();
  }

  /**
   * Apply letter filter
   */
  applyFilter() {
    if (this.letterFilter === null) {
      this.filteredSongs = [...this.songs];
    } else {
      this.filteredSongs = this.songs.filter(song =>
        song.name.toUpperCase().startsWith(this.letterFilter)
      );
    }

    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredSongs.length - 1));

    // Update filter text
    if (this.letterFilterText) {
      this.letterFilterText.setText(`Filter: ${this.letterFilter || 'ALL'}`);
    }
  }

  /**
   * Select current song
   */
  onSelect() {
    if (this.transitioning || this.filteredSongs.length === 0) return;

    this.transitioning = true;
    this.playConfirmSound();

    const song = this.filteredSongs[this.selectedIndex];
    const difficulty = song.difficulties[this.selectedDifficultyIndex];

    this.startSong(song, difficulty);
  }

  /**
   * Go back
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
    // Update capsules
    const startIndex = Math.max(0, this.selectedIndex - Math.floor(this.visibleCapsules / 2));

    this.capsules.forEach((capsule, i) => {
      const songIndex = startIndex + i;
      const song = this.filteredSongs[songIndex];

      if (song) {
        capsule.setVisible(true);
        capsule.getData('nameText').setText(song.name);
        capsule.getData('artistText').setText(song.artist);
        capsule.getData('scoreText').setText(song.highScore ? `${song.highScore}` : '');

        // Highlight selected
        if (songIndex === this.selectedIndex) {
          capsule.setAlpha(1);
          capsule.setScale(1.05);
        } else {
          capsule.setAlpha(0.7);
          capsule.setScale(1);
        }
      } else {
        capsule.setVisible(false);
      }
    });

    // Update info panel
    if (this.filteredSongs.length > 0) {
      const song = this.filteredSongs[this.selectedIndex];

      if (this.bpmText) {
        this.bpmText.setText(`${song.bpm || '?'}`);
      }

      if (this.scoreText) {
        this.scoreText.setText(`${song.highScore || 0}`);
      }

      // Update difficulty
      if (this.difficultyText) {
        const difficulty = song.difficulties[this.selectedDifficultyIndex];
        this.difficultyText.setText(difficulty.toUpperCase());

        const colors = {
          easy: '#00ff00',
          normal: '#ffff00',
          hard: '#ff0000'
        };
        this.difficultyText.setColor(colors[difficulty] || '#ffffff');
      }
    }
  }

  /**
   * Start selected song
   * @param {SongCapsule} song - Song to play
   * @param {string} difficulty - Difficulty
   */
  startSong(song, difficulty) {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('PlayState', {
        songId: song.id,
        difficulty: difficulty
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
   * Update loop
   * @param {number} time - Time
   * @param {number} delta - Delta
   */
  update(time, delta) {
    // Smooth scroll animation could be added here
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
    this.input.keyboard.off('keydown-TAB', this.onCycleFilter, this);

    this.capsules = [];
    this.filteredSongs = [];
  }
}

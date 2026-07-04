/**
 * @fileoverview Main Menu State - Primary navigation menu
 * Implements FR-6.2: Main menu with Levels and Options
 */

import BaseMenuState from './BaseMenuState.js';
import SaveManager from '../data/SaveManager.js';

/**
 * @typedef {Object} MenuItem
 * @property {string} name - Display name
 * @property {string} scene - Scene key to transition to
 * @property {Phaser.GameObjects.Text} [text] - Text object
 */

/**
 * MainMenuState - The game's main navigation menu
 * @extends BaseMenuState
 */
export default class MainMenuState extends BaseMenuState {
  constructor() {
    super({ key: 'MainMenuState' });

    // The current release intentionally exposes only Levels and Options. Story,
    // Freeplay, and Replay scenes stay in the codebase as future-mode scaffolding.
    /** @type {MenuItem[]} */
    this.menuItems = [
      { name: 'Levels', scene: 'LevelSelectState' },
      { name: 'Minigames', scene: 'MinigameSelectState' },
      { name: 'Options', scene: 'OptionsState' }
    ];

    /** @type {number} */
    this.selectedIndex = 0;

    /** @type {Phaser.GameObjects.Text[]} */
    this.menuTexts = [];

    /** @type {Phaser.Sound.BaseSound | null} */
    this.menuMusic = null;
  }

  // ========================================
  // BASEMENUSTATE OVERRIDES
  // ========================================

  /** @override */
  getItemCount() {
    return this.menuItems.length;
  }

  /** @override */
  updateSelection() {
    this.menuTexts.forEach((text, index) => {
      if (index === this.selectedIndex) {
        text.setColor('#ffff00');
        text.setScale(1.1);
      } else {
        text.setColor('#ffffff');
        text.setScale(1.0);
      }
    });
  }

  /** @override */
  executeSelection() {
    const selectedItem = this.menuItems[this.selectedIndex];
    this.tweens.add({
      targets: selectedItem.text,
      alpha: 0,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.transitionToScene(selectedItem.scene)
    });
  }

  /** @override */
  executeBack() {
    this.transitionToScene('TitleState');
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  preload() {
    this.load.image('menu-bg', 'assets/rythm-foundation.assets/preload/images/menuBG.png');
    if (!this.cache.audio.exists('menu-music')) {
      this.load.audio(
        'menu-music',
        'assets/rythm-foundation.assets/preload/music/freakyMenu/freakyMenu.mp3'
      );
    }
    this.preloadMenuSounds();
  }

  create() {
    this.transitioning = false;
    this.selectedIndex = 0;

    this.createBackground('menu-bg');
    this.createMenuItems();
    this.setupInput();
    this.playMenuMusic();
    this.fadeIn();
    this.updateSelection();

    // Enable touch on menu items
    this.enableTouchOnItems(this.menuTexts);
  }

  createMenuItems() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const startY = height / 2 - (this.menuItems.length - 1) * 40;

    this.menuTexts = [];

    this.menuItems.forEach((item, index) => {
      const y = startY + index * 80;
      const text = this.add
        .text(centerX, y, item.name, {
          fontFamily: 'Arial Black',
          fontSize: '48px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center'
        })
        .setOrigin(0.5, 0.5);

      item.text = text;
      this.menuTexts.push(text);
    });
  }

  playMenuMusic() {
    // Stop any lingering audio from a previous scene (e.g. title music that
    // wasn't cleaned up, or a duplicate menu-music instance left behind by a
    // scene transition that didn't call stopAll).
    this.sound.getAll('menu-music').forEach((s) => {
      if (s.isPlaying) {
        s.stop();
      }
    });
    this.sound.getAll('title-music').forEach((s) => {
      if (s.isPlaying) {
        s.stop();
      }
    });

    if (this.cache.audio.exists('menu-music')) {
      const masterVolume = SaveManager.getInstance().getOption('masterVolume');
      const musicVolume = SaveManager.getInstance().getOption('musicVolume');
      const combinedVolume = (masterVolume / 100) * (musicVolume / 100);
      this.menuMusic = this.sound.add('menu-music', { loop: true, volume: combinedVolume });
      this.menuMusic.play();
    }
  }

  /**
   * @param {number} time
   * @param {number} _delta
   */
  update(time, _delta) {
    if (!this.transitioning && this.menuTexts[this.selectedIndex]) {
      const pulse = 1.1 + Math.sin(time / 200) * 0.05;
      this.menuTexts[this.selectedIndex].setScale(pulse);
    }
  }

  shutdown() {
    super.shutdown();
    if (this.menuMusic && this.menuMusic.isPlaying) {
      this.menuMusic.stop();
    }
    this.menuTexts = [];
    this.menuMusic = null;
  }
}

/**
 * @fileoverview Main Menu State - Primary navigation menu
 * Implements FR-6.2: Main menu with Story, Freeplay, Options
 */

import Phaser from 'phaser';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * Menu item configuration
 * @typedef {Object} MenuItem
 * @property {string} name - Display name
 * @property {string} scene - Scene key to transition to
 * @property {Phaser.GameObjects.Text} [text] - Text object
 */

/**
 * MainMenuState - The game's main navigation menu
 * @extends Phaser.Scene
 */
export default class MainMenuState extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuState' });

    /**
     * Menu items configuration
     * @type {MenuItem[]}
     */
    this.menuItems = [
      { name: 'Story Mode', scene: 'StoryMenuState' },
      { name: 'Freeplay', scene: 'FreeplayState' },
      { name: 'Options', scene: 'OptionsState' }
    ];

    /**
     * Currently selected menu index
     * @type {number}
     */
    this.selectedIndex = 0;

    /**
     * Menu item text objects
     * @type {Phaser.GameObjects.Text[]}
     */
    this.menuTexts = [];

    /**
     * Background sprite
     * @type {Phaser.GameObjects.Sprite | null}
     */
    this.background = null;

    /**
     * Menu music
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.menuMusic = null;

    /**
     * Whether transition is in progress
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Scroll sound
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.scrollSound = null;

    /**
     * Confirm sound
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.confirmSound = null;

    /**
     * Cancel sound
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.cancelSound = null;
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    // Background
    this.load.image('menu-bg', 'images/menu/menuBG.png');

    // Menu music (may already be loaded from title)
    if (!this.cache.audio.exists('menu-music')) {
      this.load.audio('menu-music', 'audio/freakyMenu.mp3');
    }

    // UI sounds
    this.load.audio('scroll-sound', 'audio/scrollMenu.mp3');
    this.load.audio('confirm-sound', 'audio/confirmMenu.mp3');
    this.load.audio('cancel-sound', 'audio/cancelMenu.mp3');
  }

  /**
   * Create the menu
   */
  create() {
    // Reset state
    this.transitioning = false;
    this.selectedIndex = 0;

    // Set background
    this.createBackground();

    // Create menu items
    this.createMenuItems();

    // Setup input
    this.setupInput();

    // Play music
    this.playMenuMusic();

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Update selection visual
    this.updateSelection();
  }

  /**
   * Create background
   */
  createBackground() {
    const { width, height } = this.cameras.main;

    if (this.textures.exists('menu-bg')) {
      this.background = this.add.sprite(width / 2, height / 2, 'menu-bg');
      this.background.setDisplaySize(width, height);
    } else {
      // Fallback gradient background
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
      graphics.fillRect(0, 0, width, height);
    }
  }

  /**
   * Create menu item texts
   */
  createMenuItems() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const startY = height / 2 - ((this.menuItems.length - 1) * 40);

    this.menuTexts = [];

    this.menuItems.forEach((item, index) => {
      const y = startY + index * 80;

      const text = this.add.text(centerX, y, item.name, {
        fontFamily: 'Arial Black',
        fontSize: '48px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      });

      text.setOrigin(0.5, 0.5);
      item.text = text;
      this.menuTexts.push(text);
    });
  }

  /**
   * Setup input handlers
   */
  setupInput() {
    // Navigation
    this.input.keyboard.on('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard.on('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard.on('keydown-W', this.onNavigateUp, this);
    this.input.keyboard.on('keydown-S', this.onNavigateDown, this);

    // Selection
    this.input.keyboard.on('keydown-ENTER', this.onSelect, this);
    this.input.keyboard.on('keydown-SPACE', this.onSelect, this);

    // Back
    this.input.keyboard.on('keydown-ESC', this.onBack, this);
    this.input.keyboard.on('keydown-BACKSPACE', this.onBack, this);
  }

  /**
   * Navigate up
   */
  onNavigateUp() {
    if (this.transitioning) return;

    this.selectedIndex--;
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.menuItems.length - 1;
    }

    this.playScrollSound();
    this.updateSelection();
  }

  /**
   * Navigate down
   */
  onNavigateDown() {
    if (this.transitioning) return;

    this.selectedIndex++;
    if (this.selectedIndex >= this.menuItems.length) {
      this.selectedIndex = 0;
    }

    this.playScrollSound();
    this.updateSelection();
  }

  /**
   * Select current item
   */
  onSelect() {
    if (this.transitioning) return;

    this.transitioning = true;
    this.playConfirmSound();

    const selectedItem = this.menuItems[this.selectedIndex];

    // Flash selected item
    this.tweens.add({
      targets: selectedItem.text,
      alpha: 0,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.transitionToScene(selectedItem.scene);
      }
    });
  }

  /**
   * Go back to title
   */
  onBack() {
    if (this.transitioning) return;

    this.transitioning = true;
    this.playCancelSound();

    this.transitionToScene('TitleState');
  }

  /**
   * Update selection visual
   */
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

  /**
   * Transition to another scene
   * @param {string} sceneKey - Scene to transition to
   */
  transitionToScene(sceneKey) {
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey);
    });
  }

  /**
   * Play menu music
   */
  playMenuMusic() {
    // Check if music is already playing from title
    const existingMusic = this.sound.get('menu-music') || this.sound.get('title-music');

    if (existingMusic && existingMusic.isPlaying) {
      this.menuMusic = existingMusic;
      return;
    }

    if (this.cache.audio.exists('menu-music')) {
      this.menuMusic = this.sound.add('menu-music', {
        loop: true,
        volume: 0.7
      });
      this.menuMusic.play();
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
   * @param {number} time - Total time
   * @param {number} delta - Delta time
   */
  update(time, delta) {
    // Animate selected item
    if (!this.transitioning && this.menuTexts[this.selectedIndex]) {
      const text = this.menuTexts[this.selectedIndex];
      const pulse = 1.1 + Math.sin(time / 200) * 0.05;
      text.setScale(pulse);
    }
  }

  /**
   * Cleanup
   */
  shutdown() {
    // Remove input listeners
    this.input.keyboard.off('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard.off('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard.off('keydown-W', this.onNavigateUp, this);
    this.input.keyboard.off('keydown-S', this.onNavigateDown, this);
    this.input.keyboard.off('keydown-ENTER', this.onSelect, this);
    this.input.keyboard.off('keydown-SPACE', this.onSelect, this);
    this.input.keyboard.off('keydown-ESC', this.onBack, this);
    this.input.keyboard.off('keydown-BACKSPACE', this.onBack, this);

    // Clean up
    this.menuTexts = [];
    this.background = null;
  }
}

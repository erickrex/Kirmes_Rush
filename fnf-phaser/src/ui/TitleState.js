/**
 * @fileoverview Title State - The initial screen with "Press Enter" prompt
 * Implements FR-6.1: Title screen with attract mode
 */

import Phaser from 'phaser';
import * as Constants from '../core/Constants.js';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * TitleState - The game's title screen
 * @extends Phaser.Scene
 */
export default class TitleState extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleState' });

    /**
     * The title logo sprite
     * @type {Phaser.GameObjects.Sprite | null}
     */
    this.logo = null;

    /**
     * The "Press Enter" prompt text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.pressEnterText = null;

    /**
     * Timer for blinking animation
     * @type {number}
     */
    this.blinkTimer = 0;

    /**
     * Whether the prompt is currently visible (for blinking effect)
     * @type {boolean}
     */
    this.promptVisible = true;

    /**
     * Blink interval in milliseconds
     * @type {number}
     */
    this.blinkInterval = 500;

    /**
     * Title music sound object
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.titleMusic = null;

    /**
     * Attract mode timer
     * @type {Phaser.Time.TimerEvent | null}
     */
    this.attractTimer = null;

    /**
     * Whether attract mode is active
     * @type {boolean}
     */
    this.attractModeActive = false;

    /**
     * Whether transition is in progress
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Girlfriend dancer sprite (optional)
     * @type {Phaser.GameObjects.Sprite | null}
     */
    this.gfDance = null;

    /**
     * Logo bump tween
     * @type {Phaser.Tweens.Tween | null}
     */
    this.logoBumpTween = null;
  }

  /**
   * Preload assets for the title screen
   */
  preload() {
    // Load title screen assets
    this.load.setPath('assets/');

    // Logo
    this.load.image('title-logo', 'images/title/logo.png');

    // GF dance spritesheet (optional)
    this.load.spritesheet('gf-dance-title', 'images/title/gfDanceTitle.png', {
      frameWidth: 512,
      frameHeight: 512
    });

    // Title music
    this.load.audio('title-music', 'audio/freakyMenu.mp3');

    // Confirm sound
    this.load.audio('confirm-sound', 'audio/confirmMenu.mp3');
  }

  /**
   * Create the title screen elements
   */
  create() {
    // Set background color
    this.cameras.main.setBackgroundColor(0x000000);

    // Create title logo
    this.createLogo();

    // Create GF dancer (optional)
    this.createGfDancer();

    // Create "Press Enter" prompt
    this.createPressEnterPrompt();

    // Setup input handling
    this.setupInput();

    // Play title music
    this.playTitleMusic();

    // Start attract mode timer
    this.startAttractTimer();

    // Listen for beat events for logo bump
    EventBus.on(Events.BEAT_HIT, this.onBeatHit, this);
  }

  /**
   * Creates the title logo
   */
  createLogo() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Check if logo texture exists
    if (this.textures.exists('title-logo')) {
      this.logo = this.add.sprite(centerX, centerY - 100, 'title-logo');
      this.logo.setOrigin(0.5, 0.5);
      this.logo.setScale(0.8);
    } else {
      // Fallback: Create text-based logo
      this.logo = this.add.text(centerX, centerY - 100, "Friday Night Funkin'", {
        fontFamily: 'Arial Black',
        fontSize: '64px',
        color: '#31a2f2',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      });
      this.logo.setOrigin(0.5, 0.5);
    }
  }

  /**
   * Creates the GF dancer sprite
   */
  createGfDancer() {
    if (!this.textures.exists('gf-dance-title')) return;

    const centerX = this.cameras.main.width / 2;
    const bottomY = this.cameras.main.height;

    this.gfDance = this.add.sprite(centerX, bottomY - 200, 'gf-dance-title');
    this.gfDance.setOrigin(0.5, 1);

    // Create dance animation
    if (!this.anims.exists('gf-dance')) {
      this.anims.create({
        key: 'gf-dance',
        frames: this.anims.generateFrameNumbers('gf-dance-title', { start: 0, end: 1 }),
        frameRate: 12,
        repeat: -1
      });
    }

    this.gfDance.play('gf-dance');
  }

  /**
   * Creates the "Press Enter" prompt text
   */
  createPressEnterPrompt() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Create the prompt text
    this.pressEnterText = this.add.text(
      centerX,
      centerY + 200,
      'Press ENTER to start',
      {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center'
      }
    );

    // Center the text origin
    this.pressEnterText.setOrigin(0.5, 0.5);
  }

  /**
   * Setup keyboard input handling
   */
  setupInput() {
    // Listen for ENTER key
    this.input.keyboard.on('keydown-ENTER', this.onEnterPressed, this);

    // Also listen for SPACE as an alternative
    this.input.keyboard.on('keydown-SPACE', this.onEnterPressed, this);
  }

  /**
   * Play title music
   */
  playTitleMusic() {
    if (this.sound.get('title-music')) {
      this.titleMusic = this.sound.get('title-music');
    } else if (this.cache.audio.exists('title-music')) {
      this.titleMusic = this.sound.add('title-music', {
        loop: true,
        volume: 0.7
      });
    }

    if (this.titleMusic && !this.titleMusic.isPlaying) {
      this.titleMusic.play();
    }
  }

  /**
   * Stop title music
   */
  stopTitleMusic() {
    if (this.titleMusic && this.titleMusic.isPlaying) {
      this.titleMusic.stop();
    }
  }

  /**
   * Start the attract mode timer
   */
  startAttractTimer() {
    // Cancel existing timer
    if (this.attractTimer) {
      this.attractTimer.remove();
    }

    // Start new timer
    this.attractTimer = this.time.delayedCall(
      Constants.TITLE_ATTRACT_DELAY * 1000,
      this.enterAttractMode,
      [],
      this
    );
  }

  /**
   * Reset the attract mode timer (called on user input)
   */
  resetAttractTimer() {
    if (this.attractModeActive) {
      this.exitAttractMode();
    }
    this.startAttractTimer();
  }

  /**
   * Enter attract mode (demo/idle state)
   */
  enterAttractMode() {
    this.attractModeActive = true;

    // Fade out the prompt
    if (this.pressEnterText) {
      this.tweens.add({
        targets: this.pressEnterText,
        alpha: 0.3,
        duration: 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
    }

    // Could transition to a demo or credits screen
    // For now, just dim the screen slightly
    this.cameras.main.setAlpha(0.8);
  }

  /**
   * Exit attract mode
   */
  exitAttractMode() {
    this.attractModeActive = false;

    // Stop any attract mode tweens
    if (this.pressEnterText) {
      this.tweens.killTweensOf(this.pressEnterText);
      this.pressEnterText.setAlpha(1);
    }

    // Restore camera
    this.cameras.main.setAlpha(1);
  }

  /**
   * Handle ENTER key press
   */
  onEnterPressed() {
    if (this.transitioning) return;

    // Reset attract timer on any input
    this.resetAttractTimer();

    // Start transition
    this.transitioning = true;

    // Play confirm sound
    if (this.cache.audio.exists('confirm-sound')) {
      this.sound.play('confirm-sound');
    }

    // Flash effect
    this.cameras.main.flash(500, 255, 255, 255);

    // Stop blinking
    this.promptVisible = true;
    if (this.pressEnterText) {
      this.pressEnterText.setVisible(true);
    }

    // Transition to Main Menu
    this.time.delayedCall(1000, () => {
      this.transitionToMainMenu();
    });
  }

  /**
   * Transition to the main menu
   */
  transitionToMainMenu() {
    // Fade out
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Stop music
      this.stopTitleMusic();

      // Start main menu scene
      this.scene.start('MainMenuState');
    });
  }

  /**
   * Handle beat hit for logo bump
   * @param {Object} data - Beat data
   */
  onBeatHit(data) {
    if (!this.logo) return;

    // Bump the logo on beat
    if (this.logoBumpTween) {
      this.logoBumpTween.stop();
    }

    const baseScale = 0.8;
    this.logo.setScale(baseScale * 1.05);

    this.logoBumpTween = this.tweens.add({
      targets: this.logo,
      scaleX: baseScale,
      scaleY: baseScale,
      duration: 100,
      ease: 'Sine.easeOut'
    });
  }

  /**
   * Update loop - handles blinking animation
   * @param {number} time - Total elapsed time in milliseconds
   * @param {number} delta - Time elapsed since last frame in milliseconds
   */
  update(time, delta) {
    // Update blink timer
    this.blinkTimer += delta;

    // Toggle visibility when timer exceeds interval
    if (this.blinkTimer >= this.blinkInterval) {
      this.blinkTimer = 0;
      this.promptVisible = !this.promptVisible;

      if (this.pressEnterText && !this.transitioning && !this.attractModeActive) {
        this.pressEnterText.setVisible(this.promptVisible);
      }
    }
  }

  /**
   * Cleanup when scene is shut down
   */
  shutdown() {
    // Remove input listeners
    this.input.keyboard.off('keydown-ENTER', this.onEnterPressed, this);
    this.input.keyboard.off('keydown-SPACE', this.onEnterPressed, this);

    // Remove event listeners
    EventBus.off(Events.BEAT_HIT, this.onBeatHit, this);

    // Cancel attract timer
    if (this.attractTimer) {
      this.attractTimer.remove();
      this.attractTimer = null;
    }

    // Stop music
    this.stopTitleMusic();

    // Clean up references
    this.logo = null;
    this.pressEnterText = null;
    this.gfDance = null;
    this.titleMusic = null;
    this.logoBumpTween = null;
  }
}

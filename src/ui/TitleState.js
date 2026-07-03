/**
 * @fileoverview Title State - The initial screen with "Press Enter" prompt
 * Implements FR-6.1: Title screen with attract mode
 */

import Phaser from '../phaser.js';
import * as Constants from '../core/Constants.js';
import EventBus, { Events } from '../core/EventBus.js';
import Transitions, { TransitionType } from '../graphics/Transitions.js';

/**
 * TitleState - The game's title screen
 * @extends Phaser.Scene
 */
export default class TitleState extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleState' });

    /**
     * The title logo sprite
     * @type {Phaser.GameObjects.Sprite | Phaser.GameObjects.Text | null}
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

    /**
     * Shared scene-transition helper. Constructed lazily on first use
     * (see `getTransitions`) and destroyed in `shutdown`.
     * @type {Transitions | null}
     */
    this.transitions = null;
  }

  /**
   * Lazily construct and return this scene's {@link Transitions} instance,
   * routing scene changes through the shared fade contract instead of an
   * ad-hoc `cameras.main.fadeOut(...)` duplication.
   * @returns {Transitions}
   */
  getTransitions() {
    if (!this.transitions) {
      this.transitions = new Transitions(this);
    }
    return this.transitions;
  }

  /**
   * Preload assets for the title screen
   */
  preload() {
    // Logo (Sparrow XML atlas from shared assets)
    this.load.atlasXML(
      'title-logo',
      'assets/rythm-foundation.assets/preload/images/logoBumpin.png',
      'assets/rythm-foundation.assets/preload/images/logoBumpin.xml'
    );

    // GF dance (Sparrow XML atlas from shared assets)
    this.load.atlasXML(
      'gf-dance-title',
      'assets/rythm-foundation.assets/preload/images/gfDanceTitle.png',
      'assets/rythm-foundation.assets/preload/images/gfDanceTitle.xml'
    );

    // Title music
    this.load.audio('title-music', 'assets/rythm-foundation.assets/preload/music/freakyMenu/freakyMenu.mp3');

    // Confirm sound
    this.load.audio('confirm-sound', 'assets/rythm-foundation.assets/preload/sounds/confirmMenu.mp3');
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

    // Wire shutdown into Phaser's scene lifecycle
    this.events?.on('shutdown', this.shutdown, this);
  }

  /**
   * Creates the title logo
   */
  createLogo() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    if (this.textures.exists('title-logo')) {
      // Use the first frame from the Sparrow atlas
      const frames = this.textures.get('title-logo').getFrameNames();
      const firstFrame = frames.length > 0 ? frames[0] : undefined;
      this.logo = this.add.sprite(centerX, centerY - 100, 'title-logo', firstFrame);
      this.logo.setOrigin(0.5, 0.5);
      this.logo.setScale(0.5);
    } else {
      // Fallback: Create text-based logo
      this.logo = this.add.text(centerX, centerY - 100, "Rythm Foundation", {
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
    if (!this.textures.exists('gf-dance-title')) {
      return;
    }

    const centerX = this.cameras.main.width / 2;
    const bottomY = this.cameras.main.height;

    this.gfDance = this.add.sprite(centerX, bottomY - 200, 'gf-dance-title');
    this.gfDance.setOrigin(0.5, 1);
    this.gfDance.setScale(0.7);

    // Build frame list from the Sparrow atlas (gfDance0000..gfDance0029)
    const frames = this.textures.get('gf-dance-title').getFrameNames();
    const sortedFrames = frames.filter((name) => name.startsWith('gfDance')).sort();

    if (sortedFrames.length === 0) {
      return;
    }

    if (!this.anims.exists('gf-dance')) {
      this.anims.create({
        key: 'gf-dance',
        frames: sortedFrames.map((frame) => ({ key: 'gf-dance-title', frame })),
        frameRate: 24,
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
    this.pressEnterText = this.add.text(centerX, centerY + 200, 'Tap or Press Enter to start', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      align: 'center'
    });

    // Center the text origin
    this.pressEnterText.setOrigin(0.5, 0.5);

    // Add touch interactivity — ensure minimum 48×48 hit area
    this.pressEnterText.setInteractive({ useHandCursor: true });
    if (this.pressEnterText.input?.hitArea) {
      this.pressEnterText.input.hitArea.width = Math.max(
        this.pressEnterText.input.hitArea.width,
        48
      );
      this.pressEnterText.input.hitArea.height = Math.max(
        this.pressEnterText.input.hitArea.height,
        48
      );
    }
    this.pressEnterText.on('pointerdown', this.onEnterPressed, this);
  }

  /**
   * Setup keyboard input handling
   */
  setupInput() {
    if (!this.input.keyboard) {
      return;
    }

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
    if (this.transitioning) {
      return;
    }

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
  async transitionToMainMenu() {
    // Play the shared fade-out (visually equivalent to the previous
    // `cameras.main.fadeOut(500)`) and start the target scene only after it
    // completes, preserving the navigation target.
    await this.getTransitions().transitionOut({ type: TransitionType.FADE, duration: 500 });

    // If the scene was torn down mid-transition, `shutdown` destroyed and
    // cleared the Transitions instance; skip navigation in that case.
    if (!this.transitions) {
      return;
    }

    // Stop music
    this.stopTitleMusic();

    // Start main menu scene
    this.scene.start('MainMenuState');
  }

  /**
   * Handle beat hit for logo bump
   * @param {Object} _data - Beat data
   */
  onBeatHit(_data) {
    if (!this.logo) {
      return;
    }

    // Bump the logo on beat
    if (this.logoBumpTween) {
      this.logoBumpTween.stop();
    }

    const baseScale = 0.5;
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
   * @param {number} _time - Total elapsed time in milliseconds
   * @param {number} delta - Time elapsed since last frame in milliseconds
   */
  update(_time, delta) {
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
    this.events?.off('shutdown', this.shutdown, this);

    // Remove input listeners
    this.input.keyboard?.off('keydown-ENTER', this.onEnterPressed, this);
    this.input.keyboard?.off('keydown-SPACE', this.onEnterPressed, this);

    // Remove pointer listener on prompt text
    this.pressEnterText?.off('pointerdown', this.onEnterPressed, this);

    // Remove event listeners
    EventBus.off(Events.BEAT_HIT, this.onBeatHit, this);

    // Cancel attract timer
    if (this.attractTimer) {
      this.attractTimer.remove();
      this.attractTimer = null;
    }

    // Stop attract mode tweens and restore camera
    if (this.pressEnterText) {
      this.tweens.killTweensOf(this.pressEnterText);
    }
    if (this.logo) {
      this.tweens.killTweensOf(this.logo);
    }
    if (this.logoBumpTween) {
      this.logoBumpTween.stop();
    }
    this.attractModeActive = false;

    // Stop music
    this.stopTitleMusic();

    // Clean up references
    this.logo = null;
    this.pressEnterText = null;
    this.gfDance = null;
    this.titleMusic = null;
    this.logoBumpTween = null;

    // Tear down the shared Transitions instance. Destroying it cancels any
    // in-flight tween and removes its overlay without throwing, even
    // mid-transition.
    if (this.transitions) {
      this.transitions.destroy();
      this.transitions = null;
    }
  }
}

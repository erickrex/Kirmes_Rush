/**
 * @fileoverview Game Over State - Death screen with retry option
 * Implements FR-6.8: Game over animation and retry/exit handling
 */

import Phaser from 'phaser';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * GameOverState - Displayed when player loses
 * @extends Phaser.Scene
 */
export default class GameOverState extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverState' });

    /**
     * BF death sprite
     * @type {Phaser.GameObjects.Sprite | null}
     */
    this.bfDead = null;

    /**
     * Game over music
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.gameOverMusic = null;

    /**
     * Death sound effect
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.deathSound = null;

    /**
     * Confirm sound
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.confirmSound = null;

    /**
     * Song data from play state
     * @type {Object | null}
     */
    this.songData = null;

    /**
     * Whether player has confirmed retry
     * @type {boolean}
     */
    this.confirmed = false;

    /**
     * Whether transitioning
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Death animation phase
     * @type {'initial' | 'loop' | 'confirm'}
     */
    this.phase = 'initial';

    /**
     * Retry prompt text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.retryText = null;

    /**
     * Exit prompt text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.exitText = null;

    /**
     * Character position from play state
     * @type {{x: number, y: number}}
     */
    this.characterPosition = { x: 0, y: 0 };
  }

  /**
   * Initialize with data from play state
   * @param {Object} data - Initialization data
   */
  init(data) {
    this.songData = data?.songData || null;
    this.characterPosition = data?.position || { x: 640, y: 360 };
    this.confirmed = false;
    this.transitioning = false;
    this.phase = 'initial';
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    // BF death sprites
    this.load.spritesheet('bf-dead', 'images/characters/bf/bfDead.png', {
      frameWidth: 400,
      frameHeight: 400
    });

    // Game over music
    this.load.audio('game-over-music', 'audio/gameOver.mp3');
    this.load.audio('game-over-end', 'audio/gameOverEnd.mp3');

    // Death sound
    this.load.audio('death-sound', 'audio/fnf_loss_sfx.mp3');

    // Retry confirm sound
    this.load.audio('retry-confirm', 'audio/confirmMenu.mp3');
  }

  /**
   * Create the game over screen
   */
  create() {
    const { width, height } = this.cameras.main;

    // Dark background
    this.cameras.main.setBackgroundColor(0x000000);

    // Create BF death sprite
    this.createDeathSprite();

    // Play death sound
    this.playDeathSound();

    // Create UI prompts (hidden initially)
    this.createPrompts();

    // Setup input
    this.setupInput();

    // Start death animation sequence
    this.startDeathSequence();
  }

  /**
   * Create the death sprite
   */
  createDeathSprite() {
    const { width, height } = this.cameras.main;

    // Position at character's last position or center
    const x = this.characterPosition.x || width / 2;
    const y = this.characterPosition.y || height / 2;

    if (this.textures.exists('bf-dead')) {
      this.bfDead = this.add.sprite(x, y, 'bf-dead');
      this.bfDead.setOrigin(0.5, 0.5);

      // Create animations
      this.createDeathAnimations();
    } else {
      // Fallback: simple text
      this.bfDead = this.add.text(x, y, '💀', {
        fontSize: '128px'
      }).setOrigin(0.5, 0.5);
    }
  }

  /**
   * Create death animations
   */
  createDeathAnimations() {
    // Initial death animation
    if (!this.anims.exists('bf-death-initial')) {
      this.anims.create({
        key: 'bf-death-initial',
        frames: this.anims.generateFrameNumbers('bf-dead', { start: 0, end: 12 }),
        frameRate: 24,
        repeat: 0
      });
    }

    // Death loop animation
    if (!this.anims.exists('bf-death-loop')) {
      this.anims.create({
        key: 'bf-death-loop',
        frames: this.anims.generateFrameNumbers('bf-dead', { start: 12, end: 24 }),
        frameRate: 12,
        repeat: -1
      });
    }

    // Confirm/retry animation
    if (!this.anims.exists('bf-death-confirm')) {
      this.anims.create({
        key: 'bf-death-confirm',
        frames: this.anims.generateFrameNumbers('bf-dead', { start: 24, end: 36 }),
        frameRate: 24,
        repeat: 0
      });
    }
  }

  /**
   * Create UI prompts
   */
  createPrompts() {
    const { width, height } = this.cameras.main;

    // "GAME OVER" text
    this.gameOverText = this.add.text(width / 2, 100, 'GAME OVER', {
      fontFamily: 'Arial Black',
      fontSize: '72px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5, 0.5);
    this.gameOverText.setAlpha(0);

    // Retry prompt
    this.retryText = this.add.text(width / 2, height - 120, 'Press ENTER to Retry', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.retryText.setAlpha(0);

    // Exit prompt
    this.exitText = this.add.text(width / 2, height - 70, 'Press ESC to Exit', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#888888'
    }).setOrigin(0.5, 0.5);
    this.exitText.setAlpha(0);
  }

  /**
   * Setup input handlers
   */
  setupInput() {
    // Retry
    this.input.keyboard.on('keydown-ENTER', this.onRetry, this);
    this.input.keyboard.on('keydown-SPACE', this.onRetry, this);

    // Exit
    this.input.keyboard.on('keydown-ESC', this.onExit, this);
    this.input.keyboard.on('keydown-BACKSPACE', this.onExit, this);
  }

  /**
   * Play death sound effect
   */
  playDeathSound() {
    if (this.cache.audio.exists('death-sound')) {
      this.deathSound = this.sound.add('death-sound');
      this.deathSound.play();
    }
  }

  /**
   * Start the death animation sequence
   */
  startDeathSequence() {
    // Play initial death animation
    if (this.bfDead && this.bfDead.play) {
      this.bfDead.play('bf-death-initial');

      this.bfDead.once('animationcomplete', () => {
        this.onInitialAnimationComplete();
      });
    } else {
      // Fallback: skip to loop phase after delay
      this.time.delayedCall(1000, () => {
        this.onInitialAnimationComplete();
      });
    }
  }

  /**
   * Called when initial death animation completes
   */
  onInitialAnimationComplete() {
    this.phase = 'loop';

    // Start loop animation
    if (this.bfDead && this.bfDead.play) {
      this.bfDead.play('bf-death-loop');
    }

    // Start game over music
    this.playGameOverMusic();

    // Fade in UI
    this.fadeInUI();
  }

  /**
   * Play game over music
   */
  playGameOverMusic() {
    if (this.cache.audio.exists('game-over-music')) {
      this.gameOverMusic = this.sound.add('game-over-music', {
        loop: true,
        volume: 0.7
      });
      this.gameOverMusic.play();
    }
  }

  /**
   * Fade in UI elements
   */
  fadeInUI() {
    // Fade in game over text
    this.tweens.add({
      targets: this.gameOverText,
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeOut'
    });

    // Fade in prompts after delay
    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: [this.retryText, this.exitText],
        alpha: 1,
        duration: 500,
        ease: 'Sine.easeOut'
      });
    });
  }

  /**
   * Handle retry input
   */
  onRetry() {
    if (this.confirmed || this.transitioning || this.phase === 'initial') return;

    this.confirmed = true;
    this.phase = 'confirm';

    // Play confirm sound
    if (this.cache.audio.exists('retry-confirm')) {
      this.sound.play('retry-confirm');
    }

    // Stop game over music
    if (this.gameOverMusic) {
      this.gameOverMusic.stop();
    }

    // Play confirm animation
    if (this.bfDead && this.bfDead.play) {
      this.bfDead.play('bf-death-confirm');
    }

    // Play end music
    if (this.cache.audio.exists('game-over-end')) {
      const endMusic = this.sound.add('game-over-end');
      endMusic.play();
    }

    // Emit retry event
    EventBus.emit(Events.RETRY);

    // Transition to play state
    this.time.delayedCall(1500, () => {
      this.restartSong();
    });
  }

  /**
   * Handle exit input
   */
  onExit() {
    if (this.transitioning || this.phase === 'initial') return;

    this.transitioning = true;

    // Stop music
    if (this.gameOverMusic) {
      this.gameOverMusic.stop();
    }

    // Fade out and exit
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.songData?.returnScene || 'MainMenuState', this.songData?.returnSceneData);
    });
  }

  /**
   * Restart the song
   */
  restartSong() {
    this.transitioning = true;

    this.cameras.main.fadeOut(500, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('PlayState', this.songData);
    });
  }

  /**
   * Update loop
   * @param {number} time - Time
   * @param {number} delta - Delta
   */
  update(time, delta) {
    // Pulse retry text
    if (this.retryText && this.retryText.alpha > 0 && !this.confirmed) {
      const pulse = 1 + Math.sin(time / 200) * 0.1;
      this.retryText.setScale(pulse);
    }
  }

  /**
   * Cleanup
   */
  shutdown() {
    this.input.keyboard.off('keydown-ENTER', this.onRetry, this);
    this.input.keyboard.off('keydown-SPACE', this.onRetry, this);
    this.input.keyboard.off('keydown-ESC', this.onExit, this);
    this.input.keyboard.off('keydown-BACKSPACE', this.onExit, this);

    // Stop music
    if (this.gameOverMusic) {
      this.gameOverMusic.stop();
      this.gameOverMusic = null;
    }

    this.bfDead = null;
    this.retryText = null;
    this.exitText = null;
    this.songData = null;
  }
}

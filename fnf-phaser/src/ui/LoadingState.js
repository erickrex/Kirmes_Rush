/**
 * @fileoverview LoadingState - Loading screen between scenes
 * Implements FR-4.5: Loading screen with progress display
 */

import Phaser from 'phaser';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * Loading configuration
 * @typedef {Object} LoadingConfig
 * @property {string} nextScene - Scene to transition to after loading
 * @property {Object} [nextSceneData] - Data to pass to next scene
 * @property {string[]} [assets] - Assets to load
 * @property {Function} [loadCallback] - Custom loading callback
 * @property {string} [message] - Loading message to display
 * @property {number} [minDuration=500] - Minimum display time in ms
 */

/**
 * LoadingState - Displays loading progress between scenes
 * @extends Phaser.Scene
 */
export default class LoadingState extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingState' });

    /**
     * Next scene to transition to
     * @type {string}
     */
    this.nextScene = '';

    /**
     * Data to pass to next scene
     * @type {Object | null}
     */
    this.nextSceneData = null;

    /**
     * Custom loading callback
     * @type {Function | null}
     */
    this.loadCallback = null;

    /**
     * Loading message
     * @type {string}
     */
    this.message = 'Loading...';

    /**
     * Minimum display duration
     * @type {number}
     */
    this.minDuration = 500;

    /**
     * Start time for minimum duration tracking
     * @type {number}
     */
    this.startTime = 0;

    /**
     * Whether loading is complete
     * @type {boolean}
     */
    this.loadingComplete = false;

    /**
     * Progress bar graphics
     * @type {Phaser.GameObjects.Graphics | null}
     */
    this.progressBar = null;

    /**
     * Progress bar background
     * @type {Phaser.GameObjects.Graphics | null}
     */
    this.progressBg = null;

    /**
     * Loading text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.loadingText = null;

    /**
     * Percentage text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.percentText = null;

    /**
     * Asset text (current file)
     * @type {Phaser.GameObjects.Text | null}
     */
    this.assetText = null;

    /**
     * Spinner sprite
     * @type {Phaser.GameObjects.Sprite | null}
     */
    this.spinner = null;

    /**
     * Current progress (0-1)
     * @type {number}
     */
    this.progress = 0;

    /**
     * Whether an error occurred
     * @type {boolean}
     */
    this.hasError = false;

    /**
     * Error message
     * @type {string}
     */
    this.errorMessage = '';
  }

  /**
   * Initialize with loading configuration
   * @param {LoadingConfig} config - Loading configuration
   */
  init(config) {
    this.nextScene = config?.nextScene || '';
    this.nextSceneData = config?.nextSceneData || null;
    this.loadCallback = config?.loadCallback || null;
    this.message = config?.message || 'Loading...';
    this.minDuration = config?.minDuration ?? 500;
    this.assets = config?.assets || [];

    this.loadingComplete = false;
    this.hasError = false;
    this.errorMessage = '';
    this.progress = 0;
    this.startTime = 0;
  }

  /**
   * Preload - setup loading events
   */
  preload() {
    this.startTime = Date.now();

    // Create loading UI first
    this.createLoadingUI();

    // Setup loading events
    this.setupLoadingEvents();

    // Load assets if provided
    if (this.assets && this.assets.length > 0) {
      this.loadAssets();
    } else if (this.loadCallback) {
      // Use custom load callback
      this.loadCallback(this);
    } else {
      // No assets to load, mark as complete
      this.progress = 1;
      this.loadingComplete = true;
    }
  }

  /**
   * Create the loading UI
   */
  createLoadingUI() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background
    this.cameras.main.setBackgroundColor(0x000000);

    // Progress bar dimensions
    const barWidth = 400;
    const barHeight = 20;
    const barX = centerX - barWidth / 2;
    const barY = centerY + 50;

    // Progress bar background
    this.progressBg = this.add.graphics();
    this.progressBg.fillStyle(0x333333, 1);
    this.progressBg.fillRoundedRect(barX, barY, barWidth, barHeight, 5);

    // Progress bar fill
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add.text(centerX, centerY - 50, this.message, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff'
    });
    this.loadingText.setOrigin(0.5, 0.5);

    // Percentage text
    this.percentText = this.add.text(centerX, centerY + 60, '0%', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff'
    });
    this.percentText.setOrigin(0.5, 0);

    // Asset text
    this.assetText = this.add.text(centerX, centerY + 100, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#888888'
    });
    this.assetText.setOrigin(0.5, 0);

    // Create simple spinner animation
    this.createSpinner(centerX, centerY);
  }

  /**
   * Create a simple spinner
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  createSpinner(x, y) {
    // Create a simple rotating graphic as spinner
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0x31a2f2, 1);
    graphics.arc(0, 0, 30, 0, Math.PI * 1.5);
    graphics.strokePath();

    // Convert to texture
    graphics.generateTexture('spinner', 64, 64);
    graphics.destroy();

    // Create sprite from texture
    if (this.textures.exists('spinner')) {
      this.spinner = this.add.sprite(x, y - 120, 'spinner');
      this.spinner.setOrigin(0.5, 0.5);
    }
  }

  /**
   * Setup loading event listeners
   */
  setupLoadingEvents() {
    // Progress event
    this.load.on('progress', (value) => {
      this.progress = value;
      this.updateProgressBar(value);
    });

    // File progress event
    this.load.on('fileprogress', (file) => {
      if (this.assetText) {
        this.assetText.setText(`Loading: ${file.key}`);
      }
    });

    // Complete event
    this.load.on('complete', () => {
      this.onLoadComplete();
    });

    // Error event
    this.load.on('loaderror', (file) => {
      console.error(`[LoadingState] Failed to load: ${file.key}`);
      this.hasError = true;
      this.errorMessage = `Failed to load: ${file.key}`;
    });
  }

  /**
   * Load assets from the assets array
   */
  loadAssets() {
    this.load.setPath('assets/');

    this.assets.forEach(asset => {
      if (typeof asset === 'string') {
        // Simple string path - infer type from extension
        const ext = asset.split('.').pop().toLowerCase();
        const key = asset.replace(/\.[^/.]+$/, '').replace(/\//g, '-');

        switch (ext) {
          case 'png':
          case 'jpg':
          case 'jpeg':
          case 'gif':
            this.load.image(key, asset);
            break;
          case 'mp3':
          case 'ogg':
          case 'wav':
            this.load.audio(key, asset);
            break;
          case 'json':
            this.load.json(key, asset);
            break;
          case 'xml':
            this.load.xml(key, asset);
            break;
        }
      } else if (typeof asset === 'object') {
        // Object with type, key, and path
        const { type, key, path, ...options } = asset;
        switch (type) {
          case 'image':
            this.load.image(key, path);
            break;
          case 'audio':
            this.load.audio(key, path);
            break;
          case 'spritesheet':
            this.load.spritesheet(key, path, options);
            break;
          case 'atlas':
            this.load.atlas(key, path, options.atlasURL);
            break;
          case 'json':
            this.load.json(key, path);
            break;
          case 'xml':
            this.load.xml(key, path);
            break;
        }
      }
    });
  }

  /**
   * Update the progress bar
   * @param {number} value - Progress value (0-1)
   */
  updateProgressBar(value) {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const barWidth = 400;
    const barHeight = 20;
    const barX = centerX - barWidth / 2;
    const barY = centerY + 50;

    // Update progress bar
    if (this.progressBar) {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x31a2f2, 1);
      this.progressBar.fillRoundedRect(barX, barY, barWidth * value, barHeight, 5);
    }

    // Update percentage text
    if (this.percentText) {
      this.percentText.setText(`${Math.round(value * 100)}%`);
    }
  }

  /**
   * Called when loading is complete
   */
  onLoadComplete() {
    this.loadingComplete = true;
    this.progress = 1;
    this.updateProgressBar(1);

    if (this.assetText) {
      this.assetText.setText('');
    }

    // Emit loading complete event
    EventBus.emit(Events.LOADING_COMPLETE, {
      success: !this.hasError,
      nextScene: this.nextScene
    });
  }

  /**
   * Create method
   */
  create() {
    // If loading was already complete in preload (no assets), transition now
    if (this.loadingComplete) {
      this.checkTransition();
    }
  }

  /**
   * Update loop
   * @param {number} time - Total time
   * @param {number} delta - Delta time
   */
  update(time, delta) {
    // Rotate spinner
    if (this.spinner) {
      this.spinner.rotation += delta * 0.005;
    }

    // Check if we can transition
    if (this.loadingComplete) {
      this.checkTransition();
    }
  }

  /**
   * Check if we can transition to next scene
   */
  checkTransition() {
    // Check minimum duration
    const elapsed = Date.now() - this.startTime;
    if (elapsed < this.minDuration) {
      return;
    }

    // Check for errors
    if (this.hasError) {
      this.showError();
      return;
    }

    // Transition to next scene
    this.transitionToNextScene();
  }

  /**
   * Show error state
   */
  showError() {
    if (this.loadingText) {
      this.loadingText.setText('Loading Error');
      this.loadingText.setColor('#ff4444');
    }

    if (this.assetText) {
      this.assetText.setText(this.errorMessage);
      this.assetText.setColor('#ff4444');
    }

    // Hide spinner
    if (this.spinner) {
      this.spinner.setVisible(false);
    }

    // Add retry button
    const { width, height } = this.cameras.main;
    const retryText = this.add.text(width / 2, height / 2 + 150, 'Click to Retry', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 }
    });
    retryText.setOrigin(0.5, 0.5);
    retryText.setInteractive({ useHandCursor: true });

    retryText.on('pointerdown', () => {
      this.scene.restart();
    });
  }

  /**
   * Transition to the next scene
   */
  transitionToNextScene() {
    if (!this.nextScene) {
      console.warn('[LoadingState] No next scene specified');
      return;
    }

    // Fade out
    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.nextScene, this.nextSceneData);
    });
  }

  /**
   * Cleanup
   */
  shutdown() {
    // Remove load event listeners
    this.load.off('progress');
    this.load.off('fileprogress');
    this.load.off('complete');
    this.load.off('loaderror');

    // Clean up references
    this.progressBar = null;
    this.progressBg = null;
    this.loadingText = null;
    this.percentText = null;
    this.assetText = null;
    this.spinner = null;
    this.loadCallback = null;
    this.nextSceneData = null;
  }
}

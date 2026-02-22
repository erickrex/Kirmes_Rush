/**
 * @fileoverview BootScene - Initial loading scene for Friday Night Funkin'
 * Handles preloading of core assets and displays a progress bar.
 *
 * Ported from source/funkin/InitState.hx
 */

import Phaser from 'phaser';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * @typedef {Object} BootSceneConfig
 * @property {string} [nextScene='TitleScene'] - Scene to transition to after loading
 * @property {string[]} [additionalAssets=[]] - Additional assets to load
 */

/**
 * Boot scene that handles initial asset loading and displays progress.
 * This is the first scene loaded when the game starts.
 */
class BootScene extends Phaser.Scene {
  /**
   * The scene key for this scene.
   * @type {string}
   */
  static KEY = 'BootScene';

  /**
   * Progress bar graphics object.
   * @type {Phaser.GameObjects.Graphics | null}
   */
  progressBar = null;

  /**
   * Progress bar background graphics object.
   * @type {Phaser.GameObjects.Graphics | null}
   */
  progressBox = null;

  /**
   * Loading text display.
   * @type {Phaser.GameObjects.Text | null}
   */
  loadingText = null;

  /**
   * Percentage text display.
   * @type {Phaser.GameObjects.Text | null}
   */
  percentText = null;

  /**
   * Asset text display (shows current file being loaded).
   * @type {Phaser.GameObjects.Text | null}
   */
  assetText = null;

  /**
   * Scene to transition to after loading completes.
   * @type {string}
   */
  nextScene = 'TitleScene';

  /**
   * Whether an error occurred during loading.
   * @type {boolean}
   */
  hasError = false;

  /**
   * List of files that failed to load.
   * @type {string[]}
   */
  failedFiles = [];

  constructor() {
    super({ key: BootScene.KEY });
  }

  /**
   * Initialize the scene with configuration.
   * @param {BootSceneConfig} [data] - Scene initialization data
   */
  init(data) {
    if (data?.nextScene) {
      this.nextScene = data.nextScene;
    }
    this.hasError = false;
    this.failedFiles = [];
  }

  /**
   * Preload assets and setup loading UI.
   */
  preload() {
    this.createLoadingUI();
    this.setupLoadingEvents();
    this.loadCoreAssets();
  }

  /**
   * Create the loading UI elements.
   * @private
   */
  createLoadingUI() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Progress bar dimensions
    const barWidth = 400;
    const barHeight = 30;
    const barX = centerX - barWidth / 2;
    const barY = centerY;

    // Background box
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);

    // Progress bar (filled as loading progresses)
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add.text(centerX, centerY - 50, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    });
    this.loadingText.setOrigin(0.5);

    // Percentage text
    this.percentText = this.add.text(centerX, centerY + 5, '0%', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff'
    });
    this.percentText.setOrigin(0.5);

    // Asset text (current file being loaded)
    this.assetText = this.add.text(centerX, centerY + 60, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#cccccc'
    });
    this.assetText.setOrigin(0.5);
  }

  /**
   * Setup loading event listeners.
   * @private
   */
  setupLoadingEvents() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const barWidth = 400;
    const barHeight = 30;
    const barX = centerX - barWidth / 2;
    const barY = height / 2;

    // Progress event - update progress bar
    this.load.on('progress', (value) => {
      this.progressBar?.clear();
      this.progressBar?.fillStyle(0x31a2f2, 1);
      this.progressBar?.fillRect(barX, barY, barWidth * value, barHeight);

      const percent = Math.round(value * 100);
      this.percentText?.setText(`${percent}%`);
    });

    // File progress event - show current file
    this.load.on('fileprogress', (file) => {
      this.assetText?.setText(`Loading: ${file.key}`);
    });

    // File complete event
    this.load.on('filecomplete', (key) => {
      // eslint-disable-next-line no-console
      console.log(`[BootScene] Loaded: ${key}`);
    });

    // Load error event
    this.load.on('loaderror', (file) => {
      console.error(`[BootScene] Failed to load: ${file.key}`);
      this.hasError = true;
      this.failedFiles.push(file.key);
    });

    // Complete event - all files loaded
    this.load.on('complete', () => {
      this.onLoadComplete();
    });
  }

  /**
   * Load core game assets.
   * Override this method to customize which assets are loaded.
   * @protected
   */
  loadCoreAssets() {
    // Set base path for assets
    this.load.setPath('assets/');

    // Load core UI assets
    // These would be the essential assets needed before the game can start
    // For now, we'll just simulate loading with a placeholder

    // Example asset loading (uncomment when assets are available):
    // this.load.image('logo', 'images/logo.png');
    // this.load.image('loading-bar', 'images/loading-bar.png');
    // this.load.audio('menu-music', 'audio/freakyMenu.ogg');

    // Load fonts (if using bitmap fonts)
    // this.load.bitmapFont('vcr', 'fonts/vcr.png', 'fonts/vcr.xml');

    // If no assets to load, trigger complete manually
    if (this.load.totalToLoad === 0) {
      // Add a small delay to show the loading screen
      this.time.delayedCall(100, () => {
        this.onLoadComplete();
      });
    }
  }

  /**
   * Called when all assets have finished loading.
   * @private
   */
  onLoadComplete() {
    // eslint-disable-next-line no-console
    console.log('[BootScene] Loading complete');

    // Emit loading complete event
    EventBus.emit(Events.LOADING_COMPLETE, {
      success: !this.hasError,
      failedFiles: this.failedFiles
    });

    if (this.hasError && this.failedFiles.length > 0) {
      this.showErrorState();
      return;
    }

    // Clean up loading UI
    this.cleanupLoadingUI();

    // Transition to next scene
    this.transitionToNextScene();
  }

  /**
   * Show error state when loading fails.
   * @private
   */
  showErrorState() {
    this.loadingText?.setText('Loading Error');
    this.loadingText?.setColor('#ff4444');

    this.assetText?.setText(`Failed to load: ${this.failedFiles.join(', ')}`);
    this.assetText?.setColor('#ff4444');

    // Add retry button
    const retryText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 100,
      'Click to Retry',
      {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 20, y: 10 }
      }
    );
    retryText.setOrigin(0.5);
    retryText.setInteractive({ useHandCursor: true });

    retryText.on('pointerdown', () => {
      this.scene.restart();
    });
  }

  /**
   * Clean up loading UI elements.
   * @private
   */
  cleanupLoadingUI() {
    this.progressBar?.destroy();
    this.progressBox?.destroy();
    this.loadingText?.destroy();
    this.percentText?.destroy();
    this.assetText?.destroy();

    this.progressBar = null;
    this.progressBox = null;
    this.loadingText = null;
    this.percentText = null;
    this.assetText = null;
  }

  /**
   * Transition to the next scene.
   * @private
   */
  transitionToNextScene() {
    // Fade out and start next scene
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.nextScene);
    });
  }

  /**
   * Create method called after preload completes.
   */
  create() {
    // Scene creation logic (if needed)
    // Most work is done in preload and onLoadComplete
  }
}

export default BootScene;

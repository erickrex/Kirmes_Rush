/**
 * @fileoverview LoadingState - Loading screen between scenes
 * Implements FR-4.5: Loading screen with progress display
 */

import Phaser from 'phaser';
import EventBus, { Events } from '../core/EventBus.js';

/**
 * Given a single audio path (e.g. `foo/bar.ogg`), return an array containing
 * both the original and an alternate format so Phaser can pick whichever the
 * browser supports.  iOS Safari cannot play OGG; most desktop browsers prefer
 * OGG over MP3.  If the path is already an array it is returned as-is.
 * @param {string|string[]} audioPath
 * @returns {string[]}
 */
function audioPathsWithFallback(audioPath) {
  if (Array.isArray(audioPath)) {
    return audioPath;
  }
  if (typeof audioPath !== 'string') {
    return [audioPath];
  }
  const base = audioPath.replace(/\.[^/.]+$/, '');
  if (audioPath.endsWith('.ogg')) {
    return [audioPath, `${base}.mp3`];
  }
  if (audioPath.endsWith('.mp3')) {
    return [audioPath, `${base}.ogg`];
  }
  return [audioPath];
}

/**
 * Loading configuration
 * @typedef {Object} LoadingConfig
 * @property {string} nextScene - Scene to transition to after loading
 * @property {Object} [nextSceneData] - Data to pass to next scene
 * @property {string[]} [assets] - Assets to load
 * @property {Function} [loadCallback] - Custom loading callback
 * @property {Function} [prepareCallback] - Async preparation callback returning { assets, nextSceneData }
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
     * Async preparation callback
     * @type {Function | null}
     */
    this.prepareCallback = null;

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

    /**
     * Whether loading work has started
     * @type {boolean}
     */
    this.loadingStarted = false;

    /**
     * Whether the scene is currently waiting for the real gameplay asset load
     * to complete. Prepare-phase registry JSON loads reuse the same Phaser
     * loader and must not trigger the scene transition.
     * @type {boolean}
     */
    this.awaitingAssetLoadCompletion = false;

    /**
     * Whether we are still running the async prepare step
     * @type {boolean}
     */
    this.preparing = false;

    /**
     * Guards against repeated transitions
     * @type {boolean}
     */
    this.transitionStarted = false;

    /**
     * Bound load event handlers for deterministic cleanup.
     * @type {{
     *   progress: ((value: number) => void) | null,
     *   fileprogress: ((file: { key: string }) => void) | null,
     *   complete: (() => void) | null,
     *   loaderror: ((file: { key: string }) => void) | null
     * }}
     */
    this.loadEventHandlers = {
      progress: null,
      fileprogress: null,
      complete: null,
      loaderror: null
    };
  }

  /**
   * Initialize with loading configuration
   * @param {LoadingConfig} config - Loading configuration
   */
  init(config) {
    this.nextScene = config?.nextScene || '';
    this.nextSceneData = config?.nextSceneData || null;
    this.loadCallback = config?.loadCallback || null;
    this.prepareCallback = config?.prepareCallback || null;
    this.message = config?.message || 'Loading...';
    this.minDuration = config?.minDuration ?? 500;
    this.assets = config?.assets || [];

    this.loadingComplete = false;
    this.hasError = false;
    this.errorMessage = '';
    this.progress = 0;
    this.startTime = 0;
    this.loadingStarted = false;
    this.preparing = false;
    this.transitionStarted = false;
    this.awaitingAssetLoadCompletion = false;
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
    this.loadEventHandlers.progress = (value) => {
      this.progress = value;
      this.updateProgressBar(value);
    };
    this.load.on('progress', this.loadEventHandlers.progress);

    this.loadEventHandlers.fileprogress = (file) => {
      if (this.assetText) {
        this.assetText.setText(`Loading: ${file.key}`);
      }
    };
    this.load.on('fileprogress', this.loadEventHandlers.fileprogress);

    this.loadEventHandlers.complete = () => {
      if (!this.awaitingAssetLoadCompletion) {
        return;
      }
      this.onLoadComplete();
    };
    this.load.on('complete', this.loadEventHandlers.complete);

    this.loadEventHandlers.loaderror = (file) => {
      if (!this.awaitingAssetLoadCompletion) {
        return;
      }
      console.error(`[LoadingState] Failed to load: ${file.key}`);
      this.hasError = true;
      this.errorMessage = `Failed to load: ${file.key}`;
    };
    this.load.on('loaderror', this.loadEventHandlers.loaderror);
  }

  /**
   * Load assets from the assets array
   */
  loadAssets() {
    let queuedAssets = 0;

    this.assets.forEach((asset) => {
      if (typeof asset === 'string') {
        // Simple string path - infer type from extension
        const ext = asset.split('.').pop().toLowerCase();
        const key = asset.replace(/\.[^/.]+$/, '').replace(/\//g, '-');

        switch (ext) {
          case 'png':
          case 'jpg':
          case 'jpeg':
          case 'gif':
            if (!this.isAssetLoaded('image', key)) {
              this.load.image(key, asset);
              queuedAssets++;
            }
            break;
          case 'mp3':
          case 'ogg':
          case 'wav':
            if (!this.isAssetLoaded('audio', key)) {
              this.load.audio(key, audioPathsWithFallback(asset));
              queuedAssets++;
            }
            break;
          case 'json':
            if (!this.isAssetLoaded('json', key)) {
              this.load.json(key, asset);
              queuedAssets++;
            }
            break;
          case 'xml':
            if (!this.isAssetLoaded('xml', key)) {
              this.load.xml(key, asset);
              queuedAssets++;
            }
            break;
        }
      } else if (typeof asset === 'object') {
        // Object with type, key, and path
        const { type, key, path, ...options } = asset;
        if (this.isAssetLoaded(type, key)) {
          return;
        }

        switch (type) {
          case 'image':
            this.load.image(key, path);
            queuedAssets++;
            break;
          case 'audio':
            // Provide both OGG and MP3 so Phaser picks the format the
            // browser supports (iOS Safari doesn't play OGG).
            this.load.audio(key, audioPathsWithFallback(path));
            queuedAssets++;
            break;
          case 'spritesheet':
            this.load.spritesheet(key, path, options);
            queuedAssets++;
            break;
          case 'atlas':
            if (options.atlasURL && options.atlasURL.endsWith('.xml')) {
              this.load.atlasXML(key, path, options.atlasURL);
            } else {
              this.load.atlas(key, path, options.atlasURL);
            }
            queuedAssets++;
            break;
          case 'json':
            this.load.json(key, path);
            queuedAssets++;
            break;
          case 'xml':
            this.load.xml(key, path);
            queuedAssets++;
            break;
        }
      }
    });

    return queuedAssets;
  }

  /**
   * Check whether an asset is already cached.
   * @param {string} type
   * @param {string} key
   * @returns {boolean}
   */
  isAssetLoaded(type, key) {
    switch (type) {
      case 'image':
      case 'spritesheet':
      case 'atlas':
        return this.textures?.exists?.(key) ?? false;
      case 'audio':
        return this.cache?.audio?.exists?.(key) ?? false;
      case 'json':
        return this.cache?.json?.exists?.(key) ?? false;
      case 'xml':
        return this.cache?.xml?.exists?.(key) ?? false;
      default:
        return false;
    }
  }

  /**
   * Start the loading workflow.
   */
  beginLoading() {
    if (this.loadingStarted) {
      return;
    }

    this.loadingStarted = true;

    if (this.prepareCallback) {
      this.preparing = true;
      void this.prepareAssets();
      return;
    }

    this.queueAndStartLoading();
  }

  /**
   * Run the async preparation step before queueing loader assets.
   */
  async prepareAssets() {
    try {
      const prepared = await this.prepareCallback(this);

      if (prepared?.nextScene) {
        this.nextScene = prepared.nextScene;
      }
      if (prepared?.nextSceneData !== undefined) {
        this.nextSceneData = prepared.nextSceneData;
      }
      if (prepared?.assets) {
        this.assets = prepared.assets;
      }
      if (prepared?.loadCallback) {
        this.loadCallback = prepared.loadCallback;
      }

      this.preparing = false;
      this.queueAndStartLoading();
    } catch (error) {
      console.error('[LoadingState] Preparation failed:', error);
      this.preparing = false;
      this.hasError = true;
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to prepare loading state';
      this.onLoadComplete();
    }
  }

  /**
   * Queue assets and start Phaser's loader.
   */
  queueAndStartLoading() {
    let queuedAssets = 0;

    if (this.assets && this.assets.length > 0) {
      queuedAssets += this.loadAssets();
    } else if (this.loadCallback) {
      this.loadCallback(this);
      queuedAssets = this.load.totalToLoad ?? 0;
    }

    if (queuedAssets > 0 || (this.load.totalToLoad ?? 0) > 0) {
      // Reset any stale progress from prepare-phase loader activity before
      // starting the real gameplay asset load.
      this.loadingComplete = false;
      this.progress = 0;
      this.awaitingAssetLoadCompletion = true;
      this.updateProgressBar(0);
      this.load.start();
      return;
    }

    this.onLoadComplete();
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
    this.awaitingAssetLoadCompletion = false;
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
    this.beginLoading();
    this.events?.on('shutdown', this.shutdown, this);
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
    if (this.preparing || this.transitionStarted) {
      return;
    }

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

    this.transitionStarted = true;

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
    this.events?.off('shutdown', this.shutdown, this);

    if (this.loadEventHandlers.progress) {
      this.load.off('progress', this.loadEventHandlers.progress);
    }
    if (this.loadEventHandlers.fileprogress) {
      this.load.off('fileprogress', this.loadEventHandlers.fileprogress);
    }
    if (this.loadEventHandlers.complete) {
      this.load.off('complete', this.loadEventHandlers.complete);
    }
    if (this.loadEventHandlers.loaderror) {
      this.load.off('loaderror', this.loadEventHandlers.loaderror);
    }

    // Clean up references
    this.progressBar = null;
    this.progressBg = null;
    this.loadingText = null;
    this.percentText = null;
    this.assetText = null;
    this.spinner = null;
    this.loadCallback = null;
    this.prepareCallback = null;
    this.nextSceneData = null;
    this.loadEventHandlers = {
      progress: null,
      fileprogress: null,
      complete: null,
      loaderror: null
    };
  }
}

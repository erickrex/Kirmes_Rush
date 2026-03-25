/**
 * @fileoverview Unit tests for the BootScene
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser before importing BootScene
vi.mock('phaser', () => {
  const mockGraphics = {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };

  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.add = {
            graphics: vi.fn(() => ({ ...mockGraphics })),
            text: vi.fn(() => ({ ...mockText }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
              once: vi.fn()
            }
          };
          this.load = {
            on: vi.fn().mockReturnThis(),
            setPath: vi.fn().mockReturnThis(),
            image: vi.fn().mockReturnThis(),
            audio: vi.fn().mockReturnThis(),
            atlas: vi.fn().mockReturnThis(),
            totalToLoad: 0
          };
          this.time = {
            delayedCall: vi.fn()
          };
          this.scene = {
            start: vi.fn(),
            restart: vi.fn()
          };
        }
      },
      Events: {
        EventEmitter: class MockEventEmitter {
          constructor() {
            this.listeners = new Map();
          }
          on(event, callback, context) {
            if (!this.listeners.has(event)) {
              this.listeners.set(event, []);
            }
            this.listeners.get(event).push({ callback, context });
            return this;
          }
          emit(event, ...args) {
            const eventListeners = this.listeners.get(event) || [];
            eventListeners.forEach((listener) => {
              listener.callback.apply(listener.context, args);
            });
            return this;
          }
          removeAllListeners() {
            this.listeners.clear();
            return this;
          }
        }
      }
    }
  };
});

import BootScene from '../src/scenes/BootScene.js';

describe('BootScene', () => {
  let scene;

  beforeEach(() => {
    scene = new BootScene();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should have correct scene key', () => {
      expect(BootScene.KEY).toBe('BootScene');
    });

    it('should initialize with default values', () => {
      expect(scene.progressBar).toBeNull();
      expect(scene.progressBox).toBeNull();
      expect(scene.loadingText).toBeNull();
      expect(scene.percentText).toBeNull();
      expect(scene.assetText).toBeNull();
      expect(scene.nextScene).toBe('TitleScene');
      expect(scene.hasError).toBe(false);
      expect(scene.failedFiles).toEqual([]);
      expect(scene.noteStyleRegistry).toBeNull();
    });
  });

  describe('init', () => {
    it('should set nextScene from data', () => {
      scene.init({ nextScene: 'CustomScene' });
      expect(scene.nextScene).toBe('CustomScene');
    });

    it('should reset error state', () => {
      scene.hasError = true;
      scene.failedFiles = ['file1.png'];

      scene.init({});

      expect(scene.hasError).toBe(false);
      expect(scene.failedFiles).toEqual([]);
    });

    it('should handle undefined data', () => {
      scene.init(undefined);
      expect(scene.nextScene).toBe('TitleScene');
    });
  });

  describe('createLoadingUI', () => {
    it('should create all UI elements', () => {
      scene.createLoadingUI();

      expect(scene.add.graphics).toHaveBeenCalledTimes(2);
      expect(scene.add.text).toHaveBeenCalledTimes(3);
      expect(scene.progressBox).not.toBeNull();
      expect(scene.progressBar).not.toBeNull();
      expect(scene.loadingText).not.toBeNull();
      expect(scene.percentText).not.toBeNull();
      expect(scene.assetText).not.toBeNull();
    });
  });

  describe('setupLoadingEvents', () => {
    it('should register all loading event handlers', () => {
      scene.createLoadingUI();
      scene.setupLoadingEvents();

      expect(scene.load.on).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(scene.load.on).toHaveBeenCalledWith('fileprogress', expect.any(Function));
      expect(scene.load.on).toHaveBeenCalledWith('filecomplete', expect.any(Function));
      expect(scene.load.on).toHaveBeenCalledWith('loaderror', expect.any(Function));
      expect(scene.load.on).toHaveBeenCalledWith('complete', expect.any(Function));
    });
  });

  describe('loadCoreAssets', () => {
    it('should trigger delayed complete when no assets to load', () => {
      scene.load.totalToLoad = 0;
      scene.createLoadingUI();
      scene.setupLoadingEvents();
      scene.loadCoreAssets();

      expect(scene.time.delayedCall).toHaveBeenCalled();
    });

    it('should call this.load.atlas() for each note style entry when noteStyleRegistry is provided', () => {
      const mockRegistry = {
        getResolvedAsset: vi.fn((styleId, assetKey) => {
          const assets = {
            note: { resolvedPath: 'shared/images/noteSkins/NOTE_assets' },
            noteStrumline: { resolvedPath: 'shared/images/noteSkins/NOTE_strumline' },
            noteSplash: { resolvedPath: 'shared/images/noteSkins/noteSplashes' },
            holdNote: { resolvedPath: 'shared/images/noteSkins/holdNote' }
          };
          return assets[assetKey] || null;
        })
      };

      scene.init({ noteStyleRegistry: mockRegistry });
      scene.createLoadingUI();
      scene.setupLoadingEvents();
      scene.loadCoreAssets();

      expect(scene.load.atlas).toHaveBeenCalledTimes(4);
      expect(scene.load.atlas).toHaveBeenCalledWith(
        'notestyle-funkin-note',
        'assets/funkin.assets/shared/images/noteSkins/NOTE_assets.png',
        'assets/funkin.assets/shared/images/noteSkins/NOTE_assets.xml'
      );
      expect(scene.load.atlas).toHaveBeenCalledWith(
        'notestyle-funkin-noteStrumline',
        'assets/funkin.assets/shared/images/noteSkins/NOTE_strumline.png',
        'assets/funkin.assets/shared/images/noteSkins/NOTE_strumline.xml'
      );
      expect(scene.load.atlas).toHaveBeenCalledWith(
        'notestyle-funkin-noteSplash',
        'assets/funkin.assets/shared/images/noteSkins/noteSplashes.png',
        'assets/funkin.assets/shared/images/noteSkins/noteSplashes.xml'
      );
      expect(scene.load.atlas).toHaveBeenCalledWith(
        'notestyle-funkin-holdNote',
        'assets/funkin.assets/shared/images/noteSkins/holdNote.png',
        'assets/funkin.assets/shared/images/noteSkins/holdNote.xml'
      );
    });

    it('should handle missing noteStyleRegistry gracefully', () => {
      scene.load.totalToLoad = 0;
      scene.createLoadingUI();
      scene.setupLoadingEvents();
      scene.loadCoreAssets();

      expect(scene.load.atlas).not.toHaveBeenCalled();
      expect(scene.time.delayedCall).toHaveBeenCalled();
    });
  });

  describe('cleanupLoadingUI', () => {
    it('should destroy all UI elements', () => {
      scene.createLoadingUI();

      const progressBar = scene.progressBar;
      const progressBox = scene.progressBox;
      const loadingText = scene.loadingText;
      const percentText = scene.percentText;
      const assetText = scene.assetText;

      scene.cleanupLoadingUI();

      expect(progressBar.destroy).toHaveBeenCalled();
      expect(progressBox.destroy).toHaveBeenCalled();
      expect(loadingText.destroy).toHaveBeenCalled();
      expect(percentText.destroy).toHaveBeenCalled();
      expect(assetText.destroy).toHaveBeenCalled();

      expect(scene.progressBar).toBeNull();
      expect(scene.progressBox).toBeNull();
      expect(scene.loadingText).toBeNull();
      expect(scene.percentText).toBeNull();
      expect(scene.assetText).toBeNull();
    });
  });

  describe('transitionToNextScene', () => {
    it('should fade out camera', () => {
      scene.transitionToNextScene();

      expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(500, 0, 0, 0);
    });

    it('should register fade complete callback', () => {
      scene.transitionToNextScene();

      expect(scene.cameras.main.once).toHaveBeenCalledWith('camerafadeoutcomplete', expect.any(Function));
    });
  });

  describe('Error handling', () => {
    it('should track failed files', () => {
      scene.hasError = true;
      scene.failedFiles = ['asset1.png', 'asset2.ogg'];

      expect(scene.failedFiles).toHaveLength(2);
      expect(scene.failedFiles).toContain('asset1.png');
    });
  });
});

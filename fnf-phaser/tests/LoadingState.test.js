/**
 * @fileoverview Unit tests for LoadingState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => {
  const mockGraphics = {
    fillStyle: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    lineStyle: vi.fn().mockReturnThis(),
    arc: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    generateTexture: vi.fn().mockReturnThis()
  };

  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };

  const mockSprite = {
    setOrigin: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    rotation: 0,
    destroy: vi.fn()
  };

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.add = {
            graphics: vi.fn(() => ({ ...mockGraphics })),
            text: vi.fn(() => ({ ...mockText })),
            sprite: vi.fn(() => ({ ...mockSprite }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn(),
              setBackgroundColor: vi.fn()
            }
          };
          this.load = {
            on: vi.fn().mockReturnThis(),
            off: vi.fn().mockReturnThis(),
            setPath: vi.fn().mockReturnThis(),
            image: vi.fn().mockReturnThis(),
            audio: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            xml: vi.fn().mockReturnThis(),
            spritesheet: vi.fn().mockReturnThis(),
            atlas: vi.fn().mockReturnThis()
          };
          this.textures = {
            exists: vi.fn().mockReturnValue(true)
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
      Math: {
        Between: vi.fn((min, max) => Math.floor(Math.random() * (max - min + 1)) + min),
        FloatBetween: vi.fn((min, max) => Math.random() * (max - min) + min),
        DegToRad: vi.fn((deg) => deg * Math.PI / 180)
      },
      Utils: {
        Array: {
          GetRandom: vi.fn((arr) => arr[0])
        }
      }
    }
  };
});

// Mock EventBus
vi.mock('../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  Events: {
    LOADING_COMPLETE: 'loading-complete'
  }
}));

import LoadingState from '../src/ui/LoadingState.js';

describe('LoadingState', () => {
  let state;

  beforeEach(() => {
    state = new LoadingState();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should have correct scene key', () => {
      expect(state.config.key).toBe('LoadingState');
    });

    it('should initialize with default values', () => {
      expect(state.nextScene).toBe('');
      expect(state.nextSceneData).toBeNull();
      expect(state.loadCallback).toBeNull();
      expect(state.message).toBe('Loading...');
      expect(state.minDuration).toBe(500);
      expect(state.loadingComplete).toBe(false);
      expect(state.hasError).toBe(false);
      expect(state.progress).toBe(0);
    });
  });

  describe('init', () => {
    it('should set configuration from data', () => {
      state.init({
        nextScene: 'PlayState',
        nextSceneData: { songId: 'test' },
        message: 'Loading song...',
        minDuration: 1000
      });

      expect(state.nextScene).toBe('PlayState');
      expect(state.nextSceneData).toEqual({ songId: 'test' });
      expect(state.message).toBe('Loading song...');
      expect(state.minDuration).toBe(1000);
    });

    it('should handle undefined config', () => {
      state.init(undefined);
      expect(state.nextScene).toBe('');
      expect(state.message).toBe('Loading...');
    });

    it('should reset state on init', () => {
      state.loadingComplete = true;
      state.hasError = true;
      state.progress = 0.5;

      state.init({});

      expect(state.loadingComplete).toBe(false);
      expect(state.hasError).toBe(false);
      expect(state.progress).toBe(0);
    });

    it('should accept custom load callback', () => {
      const callback = vi.fn();
      state.init({ loadCallback: callback });
      expect(state.loadCallback).toBe(callback);
    });

    it('should accept assets array', () => {
      state.init({ assets: ['image.png', 'sound.mp3'] });
      expect(state.assets).toEqual(['image.png', 'sound.mp3']);
    });
  });

  describe('createLoadingUI', () => {
    it('should create all UI elements', () => {
      state.createLoadingUI();

      expect(state.cameras.main.setBackgroundColor).toHaveBeenCalledWith(0x000000);
      expect(state.add.graphics).toHaveBeenCalledTimes(3); // progressBg, progressBar, spinner
      expect(state.add.text).toHaveBeenCalledTimes(3); // loadingText, percentText, assetText
    });

    it('should create spinner if texture exists', () => {
      state.createLoadingUI();
      expect(state.textures.exists).toHaveBeenCalledWith('spinner');
      expect(state.add.sprite).toHaveBeenCalled();
    });
  });

  describe('setupLoadingEvents', () => {
    it('should register all loading event handlers', () => {
      state.setupLoadingEvents();

      expect(state.load.on).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(state.load.on).toHaveBeenCalledWith('fileprogress', expect.any(Function));
      expect(state.load.on).toHaveBeenCalledWith('complete', expect.any(Function));
      expect(state.load.on).toHaveBeenCalledWith('loaderror', expect.any(Function));
    });
  });

  describe('loadAssets', () => {
    beforeEach(() => {
      state.init({ assets: [] });
    });

    it('should set asset path', () => {
      state.assets = ['test.png'];
      state.loadAssets();
      expect(state.load.setPath).toHaveBeenCalledWith('assets/');
    });

    it('should load image files', () => {
      state.assets = ['images/test.png'];
      state.loadAssets();
      expect(state.load.image).toHaveBeenCalled();
    });

    it('should load audio files', () => {
      state.assets = ['audio/test.mp3'];
      state.loadAssets();
      expect(state.load.audio).toHaveBeenCalled();
    });

    it('should load json files', () => {
      state.assets = ['data/test.json'];
      state.loadAssets();
      expect(state.load.json).toHaveBeenCalled();
    });

    it('should load xml files', () => {
      state.assets = ['data/test.xml'];
      state.loadAssets();
      expect(state.load.xml).toHaveBeenCalled();
    });

    it('should handle object asset definitions', () => {
      state.assets = [
        { type: 'image', key: 'test-img', path: 'test.png' },
        { type: 'audio', key: 'test-audio', path: 'test.mp3' },
        { type: 'spritesheet', key: 'test-sheet', path: 'sheet.png', frameWidth: 32, frameHeight: 32 }
      ];
      state.loadAssets();

      expect(state.load.image).toHaveBeenCalled();
      expect(state.load.audio).toHaveBeenCalled();
      expect(state.load.spritesheet).toHaveBeenCalled();
    });
  });

  describe('updateProgressBar', () => {
    beforeEach(() => {
      state.createLoadingUI();
    });

    it('should update progress bar graphics', () => {
      state.updateProgressBar(0.5);
      expect(state.progressBar.clear).toHaveBeenCalled();
      expect(state.progressBar.fillStyle).toHaveBeenCalled();
      expect(state.progressBar.fillRoundedRect).toHaveBeenCalled();
    });

    it('should update percentage text', () => {
      state.updateProgressBar(0.75);
      expect(state.percentText.setText).toHaveBeenCalledWith('75%');
    });
  });

  describe('onLoadComplete', () => {
    beforeEach(() => {
      state.createLoadingUI();
    });

    it('should mark loading as complete', () => {
      state.onLoadComplete();
      expect(state.loadingComplete).toBe(true);
      expect(state.progress).toBe(1);
    });

    it('should clear asset text', () => {
      state.onLoadComplete();
      expect(state.assetText.setText).toHaveBeenCalledWith('');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      state.createLoadingUI();
    });

    it('should rotate spinner', () => {
      state.spinner = { rotation: 0 };
      state.update(0, 16);
      expect(state.spinner.rotation).toBeGreaterThan(0);
    });
  });

  describe('checkTransition', () => {
    beforeEach(() => {
      state.init({ nextScene: 'TestScene', minDuration: 0 });
      state.createLoadingUI();
      state.startTime = Date.now() - 1000; // Started 1 second ago
    });

    it('should not transition before minimum duration', () => {
      state.minDuration = 10000;
      state.startTime = Date.now();
      state.loadingComplete = true;

      state.checkTransition();
      expect(state.cameras.main.fadeOut).not.toHaveBeenCalled();
    });

    it('should show error if hasError is true', () => {
      state.hasError = true;
      state.errorMessage = 'Test error';
      state.loadingComplete = true;

      state.checkTransition();
      expect(state.loadingText.setText).toHaveBeenCalledWith('Loading Error');
    });
  });

  describe('transitionToNextScene', () => {
    it('should fade out camera', () => {
      state.init({ nextScene: 'TestScene' });
      state.transitionToNextScene();

      expect(state.cameras.main.fadeOut).toHaveBeenCalledWith(300, 0, 0, 0);
    });

    it('should register fade complete callback', () => {
      state.init({ nextScene: 'TestScene' });
      state.transitionToNextScene();

      expect(state.cameras.main.once).toHaveBeenCalledWith(
        'camerafadeoutcomplete',
        expect.any(Function)
      );
    });

    it('should warn if no next scene specified', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      state.init({ nextScene: '' });
      state.transitionToNextScene();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('showError', () => {
    beforeEach(() => {
      state.createLoadingUI();
      state.errorMessage = 'Failed to load asset';
    });

    it('should update loading text to show error', () => {
      state.showError();
      expect(state.loadingText.setText).toHaveBeenCalledWith('Loading Error');
      expect(state.loadingText.setColor).toHaveBeenCalledWith('#ff4444');
    });

    it('should show error message in asset text', () => {
      state.showError();
      expect(state.assetText.setText).toHaveBeenCalledWith('Failed to load asset');
    });

    it('should hide spinner', () => {
      state.showError();
      expect(state.spinner.setVisible).toHaveBeenCalledWith(false);
    });

    it('should add retry button', () => {
      state.showError();
      expect(state.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'Click to Retry',
        expect.any(Object)
      );
    });
  });

  describe('shutdown', () => {
    it('should remove load event listeners', () => {
      state.shutdown();

      expect(state.load.off).toHaveBeenCalledWith('progress');
      expect(state.load.off).toHaveBeenCalledWith('fileprogress');
      expect(state.load.off).toHaveBeenCalledWith('complete');
      expect(state.load.off).toHaveBeenCalledWith('loaderror');
    });

    it('should clean up references', () => {
      state.createLoadingUI();
      state.shutdown();

      expect(state.progressBar).toBeNull();
      expect(state.progressBg).toBeNull();
      expect(state.loadingText).toBeNull();
      expect(state.percentText).toBeNull();
      expect(state.assetText).toBeNull();
      expect(state.spinner).toBeNull();
    });
  });
});

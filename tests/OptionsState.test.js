/**
 * @fileoverview Unit tests for OptionsState
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SaveManager from '../src/data/SaveManager.js';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; })
};
global.localStorage = localStorageMock;

// Mock Phaser
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setInteractive: vi.fn(function() { this.input = { hitArea: { width: 200, height: 30 } }; return this; }),
    on: vi.fn().mockReturnThis(),
    input: null
  };

  const mockGraphics = {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillGradientStyle: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };

  const mockContainer = {
    setVisible: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    getData: vi.fn((key) => key === 'sliderFill' || key === 'sliderBg' ? { ...mockGraphics } : { ...mockText }),
    add: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setInteractive: vi.fn(function() { this.input = { hitArea: { width: 200, height: 50 } }; return this; }),
    on: vi.fn().mockReturnThis(),
    input: null
  };

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.scene = { key: config.key, start: vi.fn() };
          this.add = {
            text: vi.fn(() => ({ ...mockText })),
            graphics: vi.fn(() => ({ ...mockGraphics })),
            container: vi.fn(() => ({ ...mockContainer }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn((event, cb) => cb())
            }
          };
          this.input = {
            keyboard: { on: vi.fn(), off: vi.fn() }
          };
          this.sound = {
            play: vi.fn()
          };
          this.cache = {
            audio: { exists: vi.fn(() => false) }
          };
          this.load = {
            setPath: vi.fn(),
            audio: vi.fn()
          };
        }
      },
      Geom: {
        Rectangle: class MockRectangle {
          constructor(x, y, width, height) {
            this.x = x; this.y = y; this.width = width; this.height = height;
          }
          static Contains(rect, x, y) { return true; }
        }
      }
    }
  };
});

// Mock TouchDeviceDetector
vi.mock('../src/input/TouchDeviceDetector.js', () => ({
  default: {
    isTouch: vi.fn(() => false),
    detect: vi.fn(),
    reset: vi.fn()
  }
}));

import OptionsState from '../src/ui/OptionsState.js';

describe('OptionsState', () => {
  let scene;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    SaveManager.resetInstance();
    scene = new OptionsState();
  });

  describe('Scene Initialization', () => {
    it('should create the scene with correct key', () => {
      expect(scene.scene.key).toBe('OptionsState');
    });

    it('should have categories defined', () => {
      expect(scene.categories).toBeDefined();
      expect(scene.categories.length).toBeGreaterThan(0);
    });

    it('should have Gameplay, Audio, Visuals, Controls, Misc categories', () => {
      const names = scene.categories.map(cat => cat.name);
      expect(names).toContain('Gameplay');
      expect(names).toContain('Audio');
      expect(names).toContain('Visuals');
      expect(names).toContain('Controls');
      expect(names).toContain('Misc');
    });

    it('should initialize with selectedCategoryIndex at 0', () => {
      expect(scene.selectedCategoryIndex).toBe(0);
    });

    it('should initialize with capturingKeybind as false', () => {
      expect(scene.capturingKeybind).toBe(false);
    });
  });

  describe('Option Categories', () => {
    it('should have items in each category', () => {
      scene.categories.forEach(category => {
        expect(category.items).toBeDefined();
        expect(category.items.length).toBeGreaterThan(0);
      });
    });

    it('should have valid option types', () => {
      const validTypes = ['toggle', 'slider', 'keybind', 'action'];
      scene.categories.forEach(category => {
        category.items.forEach(item => {
          expect(validTypes).toContain(item.type);
        });
      });
    });
  });

  describe('Item Navigation', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should navigate down through items', () => {
      scene.onNavigateDown();
      expect(scene.selectedItemIndex).toBe(1);
    });

    it('should wrap around when navigating down past last item', () => {
      const category = scene.categories[scene.selectedCategoryIndex];
      scene.selectedItemIndex = category.items.length - 1;
      scene.onNavigateDown();
      expect(scene.selectedItemIndex).toBe(0);
    });

    it('should not navigate when capturing keybind', () => {
      scene.capturingKeybind = true;
      const initialIndex = scene.selectedItemIndex;
      scene.onNavigateDown();
      expect(scene.selectedItemIndex).toBe(initialIndex);
    });
  });

  describe('Toggle Options', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should toggle boolean options', () => {
      const category = scene.categories.find(c => c.items.some(i => i.type === 'toggle'));
      const toggleIndex = category.items.findIndex(i => i.type === 'toggle');

      scene.selectedCategoryIndex = scene.categories.indexOf(category);
      scene.selectedItemIndex = toggleIndex;

      const initialValue = category.items[toggleIndex].value;
      scene.onSelect();
      expect(category.items[toggleIndex].value).toBe(!initialValue);
    });
  });

  describe('Slider Options', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should increase slider value on right', () => {
      const category = scene.categories.find(c => c.items.some(i => i.type === 'slider'));
      const sliderIndex = category.items.findIndex(i => i.type === 'slider');
      const slider = category.items[sliderIndex];

      scene.selectedCategoryIndex = scene.categories.indexOf(category);
      scene.selectedItemIndex = sliderIndex;

      const initialValue = slider.value;
      // Enter slider edit mode first, then adjust
      scene.onSelect();
      expect(scene.editingSlider).toBe(true);
      scene.onNavigateRight();
      expect(slider.value).toBe(Math.min(slider.max, initialValue + slider.step));
    });
  });

  describe('Keybind Options', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should enter keybind capture mode on select', () => {
      const controlsIndex = scene.categories.findIndex(c => c.name === 'Controls');
      scene.selectedCategoryIndex = controlsIndex;
      scene.selectedItemIndex = 0;

      scene.onSelect();
      expect(scene.capturingKeybind).toBe(true);
    });

    it('should cancel keybind capture on ESC', () => {
      scene.capturingKeybind = true;
      scene.onBack();
      expect(scene.capturingKeybind).toBe(false);
    });
  });

  describe('Save/Load Options', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should save options to localStorage', () => {
      scene.saveOptions();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'rythm-options',
        expect.any(String)
      );
    });
  });

  describe('Reset to Defaults', () => {
    beforeEach(() => {
      scene.create();
    });

    it('should reset all options to default values', () => {
      scene.categories.forEach(category => {
        category.items.forEach(item => {
          if (item.type === 'toggle') {
            item.value = !item.defaultValue;
          }
        });
      });

      scene.resetToDefaults();

      scene.categories.forEach(category => {
        category.items.forEach(item => {
          if (item.defaultValue !== undefined) {
            expect(item.value).toBe(item.defaultValue);
          }
        });
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up on shutdown', () => {
      scene.create();
      scene.shutdown();
      expect(scene.categoryTabs.length).toBe(0);
      expect(scene.optionDisplays.length).toBe(0);
    });
  });
});

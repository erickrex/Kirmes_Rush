/**
 * @fileoverview Property-based tests for Options Persistence.
 * Tests options saving, loading, and reset functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import SaveManager from '../src/data/SaveManager.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Mock localStorage for testing
const mockStorage = new Map();
const mockLocalStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, value) => mockStorage.set(key, value),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Arbitraries for generating test data
const booleanArb = fc.boolean();
const volumeArb = fc.integer({ min: 0, max: 100 });
const scrollSpeedArb = fc.float({ min: 0.5, max: 3.0, noNaN: true });
const noteOffsetArb = fc.integer({ min: -100, max: 100 });
const inputDelayArb = fc.integer({ min: -50, max: 50 });
const inputBufferArb = fc.integer({ min: 0, max: 100 });
const keyArb = fc.constantFrom('A', 'S', 'D', 'W', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE', 'ENTER');

// Generate a complete options object
const optionsArb = fc.record({
  // Gameplay
  downscroll: booleanArb,
  ghostTapping: booleanArb,
  scrollSpeed: scrollSpeedArb,
  noteOffset: noteOffsetArb,

  // Competitive
  inputDelayCompensation: inputDelayArb,
  inputBufferWindow: inputBufferArb,

  // HUD Stats
  showNPS: booleanArb,
  showGrade: booleanArb,
  showComboBreaks: booleanArb,
  showJudgements: booleanArb,

  // Audio
  masterVolume: volumeArb,
  musicVolume: volumeArb,
  sfxVolume: volumeArb,
  hitsounds: booleanArb,

  // Visuals
  showFps: booleanArb,
  flashingLights: booleanArb,
  cameraZoom: booleanArb,
  comboDisplay: booleanArb,

  // Controls
  keyLeft: keyArb,
  keyDown: keyArb,
  keyUp: keyArb,
  keyRight: keyArb,
  keyLeftAlt: keyArb,
  keyDownAlt: keyArb,
  keyUpAlt: keyArb,
  keyRightAlt: keyArb
});

describe('Options Persistence Property Tests', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // Save original localStorage and replace with mock
    originalLocalStorage = global.localStorage;
    global.localStorage = mockLocalStorage;
    mockStorage.clear();

    // Reset SaveManager singleton
    SaveManager.resetInstance();
  });

  afterEach(() => {
    // Restore original localStorage
    global.localStorage = originalLocalStorage;
    mockStorage.clear();
    SaveManager.resetInstance();
  });

  /**
   * Property 44: Options Persistence
   * For any valid options configuration, saving and loading SHALL preserve all option values.
   */
  describe('Property 44: Options Persistence', () => {
    it('saved options SHALL be retrievable after reload', () => {
      fc.assert(
        fc.property(
          optionsArb,
          (options) => {
            // Create SaveManager and set options
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set all options
            saveManager.setOptions(options);

            // Reset instance to simulate reload
            SaveManager.resetInstance();

            // Create new instance and load
            const reloadedManager = SaveManager.getInstance();
            reloadedManager.storageAvailable = true;
            reloadedManager.init();

            // Verify all options are preserved
            for (const [key, value] of Object.entries(options)) {
              const loaded = reloadedManager.getOption(key);
              if (typeof value === 'number' && !Number.isInteger(value)) {
                // Float comparison with tolerance
                expect(loaded).toBeCloseTo(value, 5);
              } else {
                expect(loaded).toBe(value);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('individual option changes SHALL persist', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'downscroll', 'ghostTapping', 'showNPS', 'showGrade',
            'showComboBreaks', 'showJudgements', 'hitsounds', 'showFps',
            'flashingLights', 'cameraZoom', 'comboDisplay'
          ),
          booleanArb,
          (optionKey, value) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set single option
            saveManager.setOption(optionKey, value);

            // Reset and reload
            SaveManager.resetInstance();
            const reloadedManager = SaveManager.getInstance();
            reloadedManager.storageAvailable = true;
            reloadedManager.init();

            // Verify option persisted
            expect(reloadedManager.getOption(optionKey)).toBe(value);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('numeric options SHALL persist with correct values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('masterVolume', 'musicVolume', 'sfxVolume'),
          volumeArb,
          (optionKey, value) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            saveManager.setOption(optionKey, value);

            SaveManager.resetInstance();
            const reloadedManager = SaveManager.getInstance();
            reloadedManager.storageAvailable = true;
            reloadedManager.init();

            expect(reloadedManager.getOption(optionKey)).toBe(value);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('competitive options SHALL persist correctly', () => {
      fc.assert(
        fc.property(
          inputDelayArb,
          inputBufferArb,
          (delayCompensation, bufferWindow) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            saveManager.setInputDelayCompensation(delayCompensation);
            saveManager.setInputBufferWindow(bufferWindow);

            SaveManager.resetInstance();
            const reloadedManager = SaveManager.getInstance();
            reloadedManager.storageAvailable = true;
            reloadedManager.init();

            expect(reloadedManager.getInputDelayCompensation()).toBe(delayCompensation);
            expect(reloadedManager.getInputBufferWindow()).toBe(bufferWindow);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 45: Options Reset to Defaults
   * After resetOptions() is called, all options SHALL equal their default values.
   */
  describe('Property 45: Options Reset to Defaults', () => {
    it('resetOptions SHALL restore all options to defaults', () => {
      fc.assert(
        fc.property(
          optionsArb,
          (options) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set custom options
            saveManager.setOptions(options);

            // Reset to defaults
            saveManager.resetOptions();

            // Verify all options are at default values
            const allOptions = saveManager.getAllOptions();

            // Check specific defaults
            expect(allOptions.downscroll).toBe(false);
            expect(allOptions.ghostTapping).toBe(true);
            expect(allOptions.scrollSpeed).toBe(1.0);
            expect(allOptions.noteOffset).toBe(0);
            expect(allOptions.inputDelayCompensation).toBe(0);
            expect(allOptions.inputBufferWindow).toBe(50);
            expect(allOptions.showNPS).toBe(true);
            expect(allOptions.showGrade).toBe(true);
            expect(allOptions.showComboBreaks).toBe(true);
            expect(allOptions.showJudgements).toBe(false);
            expect(allOptions.masterVolume).toBe(100);
            expect(allOptions.musicVolume).toBe(100);
            expect(allOptions.sfxVolume).toBe(100);
            expect(allOptions.hitsounds).toBe(false);
            expect(allOptions.showFps).toBe(false);
            expect(allOptions.flashingLights).toBe(true);
            expect(allOptions.cameraZoom).toBe(true);
            expect(allOptions.comboDisplay).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('reset SHALL persist after reload', () => {
      fc.assert(
        fc.property(
          optionsArb,
          (options) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set custom options
            saveManager.setOptions(options);

            // Reset to defaults
            saveManager.resetOptions();

            // Reload
            SaveManager.resetInstance();
            const reloadedManager = SaveManager.getInstance();
            reloadedManager.storageAvailable = true;
            reloadedManager.init();

            // Verify defaults persisted
            expect(reloadedManager.getOption('downscroll')).toBe(false);
            expect(reloadedManager.getOption('inputDelayCompensation')).toBe(0);
            expect(reloadedManager.getOption('inputBufferWindow')).toBe(50);
            expect(reloadedManager.getOption('showNPS')).toBe(true);
            expect(reloadedManager.getOption('showGrade')).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('individual option reset SHALL work correctly', () => {
      fc.assert(
        fc.property(
          inputDelayArb.filter(v => v !== 0), // Non-default value
          inputBufferArb.filter(v => v !== 50), // Non-default value
          (delayCompensation, bufferWindow) => {
            const saveManager = SaveManager.getInstance();
            saveManager.storageAvailable = true;
            saveManager.init();

            // Set non-default values
            saveManager.setInputDelayCompensation(delayCompensation);
            saveManager.setInputBufferWindow(bufferWindow);

            // Verify non-default values are set
            expect(saveManager.getInputDelayCompensation()).toBe(delayCompensation);
            expect(saveManager.getInputBufferWindow()).toBe(bufferWindow);

            // Reset
            saveManager.resetOptions();

            // Verify defaults restored
            expect(saveManager.getInputDelayCompensation()).toBe(0);
            expect(saveManager.getInputBufferWindow()).toBe(50);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

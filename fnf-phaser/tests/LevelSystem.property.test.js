/**
 * @fileoverview Property-based tests for LevelSystem.
 * Tests level loading and feature toggle enforcement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Phaser's EventEmitter before importing LevelSystem
vi.mock('phaser', () => {
  class MockEventEmitter {
    constructor() {
      this.listeners = new Map();
    }

    emit(event, ...args) {
      const callbacks = this.listeners.get(event) || [];
      callbacks.forEach(({ callback, context }) => {
        callback.apply(context, args);
      });
    }

    on(event, callback, context) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push({ callback, context });
      return this;
    }

    once(event, callback, context) {
      return this.on(event, callback, context);
    }

    off(event, callback, context) {
      return this;
    }

    removeAllListeners(event) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
      return this;
    }

    listenerCount(event) {
      return (this.listeners.get(event) || []).length;
    }
  }

  return {
    default: {
      Events: {
        EventEmitter: MockEventEmitter
      }
    },
    Events: {
      EventEmitter: MockEventEmitter
    }
  };
});

import LevelSystem from '../src/levels/LevelSystem.js';
import LevelManifest from '../src/levels/LevelManifest.js';
import FeatureToggles from '../src/levels/FeatureToggles.js';

// ========================================
// Arbitraries for generating test data
// ========================================

/**
 * Generate a valid non-empty string
 */
const nonEmptyString = () =>
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/**
 * Generate a valid feature flags object with all required flags
 */
const validFeaturesArb = () =>
  fc.record({
    holdNotes: fc.boolean(),
    healthBar: fc.boolean(),
    characters: fc.boolean(),
    stage: fc.boolean(),
    cameraEffects: fc.boolean(),
    noteSplashes: fc.boolean(),
    comboPopups: fc.boolean(),
    expandedStats: fc.boolean(),
    replayRecording: fc.boolean(),
    inputBuffer: fc.boolean()
  });

/**
 * Generate a valid LevelConfig object
 */
const validLevelConfigArb = () =>
  fc.record({
    id: nonEmptyString(),
    name: nonEmptyString(),
    description: fc.option(fc.string(), { nil: undefined }),
    songId: nonEmptyString(),
    difficulty: fc.oneof(fc.constant('easy'), fc.constant('normal'), fc.constant('hard')),
    features: validFeaturesArb(),
    ui: fc.option(
      fc.record({
        showScore: fc.boolean(),
        showCombo: fc.boolean(),
        showAccuracy: fc.boolean(),
        showMisses: fc.boolean()
      }),
      { nil: undefined }
    )
  });

/**
 * Generate a unique level ID
 */
const levelIdArb = () =>
  fc.tuple(fc.string({ minLength: 3, maxLength: 20 }).filter((s) => s.trim().length > 0), fc.integer({ min: 1, max: 1000 })).map(
    ([base, num]) => `${base.replace(/[^a-zA-Z0-9]/g, '')}-${num}`
  );

describe('LevelSystem Property Tests', () => {
  let levelSystem;

  beforeEach(() => {
    levelSystem = new LevelSystem();
  });

  // ========================================
  // Property 36: Level Feature Toggle Enforcement
  // ========================================
  describe('Property 36: Level Feature Toggle Enforcement', () => {
    it('for any level with feature flags F, after loading that level, isFeatureEnabled(featureName) SHALL return true only for features where F[featureName] is true', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (levelConfig) => {
          // Manually add the level to the system
          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;

          // Set the current level
          const success = levelSystem.setCurrentLevel(levelConfig.id);
          expect(success).toBe(true);

          // Check each feature flag
          for (const featureName of FeatureToggles.FEATURE_NAMES) {
            const expected = levelConfig.features[featureName];
            const actual = levelSystem.isFeatureEnabled(featureName);

            expect(actual).toBe(expected);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('feature flags SHALL be enforced consistently across multiple level switches', () => {
      fc.assert(
        fc.property(
          fc.array(validLevelConfigArb(), { minLength: 2, maxLength: 5 }).map((configs) =>
            // Ensure unique IDs
            configs.map((c, i) => ({ ...c, id: `level-${i}-${c.id.substring(0, 10)}` }))
          ),
          (levelConfigs) => {
            // Add all levels to the system
            levelSystem.levels = levelConfigs;
            levelSystem.loaded = true;

            // Switch between levels and verify feature enforcement
            for (const config of levelConfigs) {
              levelSystem.setCurrentLevel(config.id);

              for (const featureName of FeatureToggles.FEATURE_NAMES) {
                expect(levelSystem.isFeatureEnabled(featureName)).toBe(config.features[featureName]);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clearing current level SHALL reset all feature flags to defaults', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (levelConfig) => {
          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;

          // Set and then clear the level
          levelSystem.setCurrentLevel(levelConfig.id);
          levelSystem.clearCurrentLevel();

          // All features should be at default (false)
          const defaults = FeatureToggles.getDefaultFeatures();
          for (const featureName of FeatureToggles.FEATURE_NAMES) {
            expect(levelSystem.isFeatureEnabled(featureName)).toBe(defaults[featureName]);
          }

          expect(levelSystem.getCurrentLevel()).toBeNull();

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('getFeatureFlags SHALL return all current feature states', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (levelConfig) => {
          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;
          levelSystem.setCurrentLevel(levelConfig.id);

          const flags = levelSystem.getFeatureFlags();

          // Should have all feature flags
          for (const featureName of FeatureToggles.FEATURE_NAMES) {
            expect(flags[featureName]).toBe(levelConfig.features[featureName]);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 37: Level Feature Flag Support
  // ========================================
  describe('Property 37: Level Feature Flag Support', () => {
    it('for any feature in the required set, the LevelSystem SHALL support toggling that feature', () => {
      const requiredFeatures = [
        'holdNotes',
        'healthBar',
        'characters',
        'stage',
        'cameraEffects',
        'noteSplashes',
        'comboPopups',
        'expandedStats',
        'replayRecording',
        'inputBuffer'
      ];

      fc.assert(
        fc.property(fc.constantFrom(...requiredFeatures), fc.boolean(), (featureName, enabled) => {
          // Create a level config with the specific feature state
          const features = FeatureToggles.getDefaultFeatures();
          features[featureName] = enabled;

          const levelConfig = {
            id: 'test-level',
            name: 'Test Level',
            songId: 'test-song',
            difficulty: 'normal',
            features: features
          };

          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;
          levelSystem.setCurrentLevel('test-level');

          // The feature should be queryable and return the correct state
          expect(levelSystem.isFeatureEnabled(featureName)).toBe(enabled);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('all 10 required features SHALL be recognized by FeatureToggles', () => {
      const requiredFeatures = [
        'holdNotes',
        'healthBar',
        'characters',
        'stage',
        'cameraEffects',
        'noteSplashes',
        'comboPopups',
        'expandedStats',
        'replayRecording',
        'inputBuffer'
      ];

      fc.assert(
        fc.property(fc.constantFrom(...requiredFeatures), (featureName) => {
          expect(FeatureToggles.isValidFeature(featureName)).toBe(true);
          expect(FeatureToggles.FEATURE_NAMES).toContain(featureName);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('feature toggles SHALL support any combination of enabled/disabled states', () => {
      fc.assert(
        fc.property(validFeaturesArb(), (features) => {
          const levelConfig = {
            id: 'combo-test',
            name: 'Combo Test',
            songId: 'test-song',
            difficulty: 'normal',
            features: features
          };

          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;
          levelSystem.setCurrentLevel('combo-test');

          // Count enabled features
          let enabledCount = 0;
          for (const featureName of FeatureToggles.FEATURE_NAMES) {
            if (levelSystem.isFeatureEnabled(featureName)) {
              enabledCount++;
            }
          }

          // Count should match the input
          const expectedCount = Object.values(features).filter((v) => v === true).length;
          expect(enabledCount).toBe(expectedCount);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('unknown feature names SHALL return false', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !FeatureToggles.FEATURE_NAMES.includes(s)),
          (unknownFeature) => {
            const levelConfig = LevelManifest.createDefault('test', 'Test', 'song');
            levelSystem.levels = [levelConfig];
            levelSystem.loaded = true;
            levelSystem.setCurrentLevel('test');

            // Unknown features should return false
            expect(levelSystem.isFeatureEnabled(unknownFeature)).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 38: Level Song Loading
  // ========================================
  describe('Property 38: Level Song Loading', () => {
    it('for any level with songId S, after loading that level, the level config SHALL contain songId equal to S', () => {
      fc.assert(
        fc.property(nonEmptyString(), nonEmptyString(), (levelId, songId) => {
          const levelConfig = {
            id: levelId,
            name: 'Test Level',
            songId: songId,
            difficulty: 'normal',
            features: FeatureToggles.getDefaultFeatures()
          };

          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;
          levelSystem.setCurrentLevel(levelId);

          const currentLevel = levelSystem.getCurrentLevel();

          expect(currentLevel).not.toBeNull();
          expect(currentLevel.songId).toBe(songId);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('songId SHALL be preserved exactly as specified in the level config', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('tutorial'),
            fc.constant('bopeebo'),
            fc.constant('fresh'),
            fc.constant('dadbattle'),
            nonEmptyString()
          ),
          (songId) => {
            const levelConfig = {
              id: 'song-test',
              name: 'Song Test',
              songId: songId,
              difficulty: 'normal',
              features: FeatureToggles.getDefaultFeatures()
            };

            levelSystem.levels = [levelConfig];
            levelSystem.loaded = true;
            levelSystem.setCurrentLevel('song-test');

            expect(levelSystem.getCurrentLevel().songId).toBe(songId);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each level SHALL maintain its own songId independently', () => {
      fc.assert(
        fc.property(
          fc.array(nonEmptyString(), { minLength: 2, maxLength: 5 }),
          (songIds) => {
            // Create levels with different songIds
            const levels = songIds.map((songId, i) => ({
              id: `level-${i}`,
              name: `Level ${i}`,
              songId: songId,
              difficulty: 'normal',
              features: FeatureToggles.getDefaultFeatures()
            }));

            levelSystem.levels = levels;
            levelSystem.loaded = true;

            // Verify each level has its correct songId
            for (let i = 0; i < levels.length; i++) {
              levelSystem.setCurrentLevel(`level-${i}`);
              expect(levelSystem.getCurrentLevel().songId).toBe(songIds[i]);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getLevel SHALL return level with correct songId', () => {
      fc.assert(
        fc.property(levelIdArb(), nonEmptyString(), (levelId, songId) => {
          const levelConfig = {
            id: levelId,
            name: 'Test',
            songId: songId,
            difficulty: 'normal',
            features: FeatureToggles.getDefaultFeatures()
          };

          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;

          const level = levelSystem.getLevel(levelId);

          expect(level).not.toBeNull();
          expect(level.songId).toBe(songId);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Additional Level System Tests
  // ========================================
  describe('Level System State Management', () => {
    it('setCurrentLevel SHALL return false for non-existent levels', () => {
      fc.assert(
        fc.property(nonEmptyString(), nonEmptyString(), (existingId, nonExistingId) => {
          // Ensure IDs are different
          const actualNonExisting = existingId === nonExistingId ? `${nonExistingId}-different` : nonExistingId;

          const levelConfig = {
            id: existingId,
            name: 'Test',
            songId: 'song',
            difficulty: 'normal',
            features: FeatureToggles.getDefaultFeatures()
          };

          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;

          // Setting existing level should succeed
          expect(levelSystem.setCurrentLevel(existingId)).toBe(true);

          // Setting non-existing level should fail
          expect(levelSystem.setCurrentLevel(actualNonExisting)).toBe(false);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('getAllLevels SHALL return all loaded levels', () => {
      fc.assert(
        fc.property(
          fc.array(validLevelConfigArb(), { minLength: 1, maxLength: 5 }).map((configs) =>
            configs.map((c, i) => ({ ...c, id: `level-${i}` }))
          ),
          (levelConfigs) => {
            levelSystem.levels = levelConfigs;
            levelSystem.loaded = true;

            const allLevels = levelSystem.getAllLevels();

            expect(allLevels.length).toBe(levelConfigs.length);

            for (let i = 0; i < levelConfigs.length; i++) {
              expect(allLevels[i].id).toBe(levelConfigs[i].id);
              expect(allLevels[i].songId).toBe(levelConfigs[i].songId);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getLevelByIndex SHALL return correct level', () => {
      fc.assert(
        fc.property(
          fc.array(validLevelConfigArb(), { minLength: 1, maxLength: 5 }).map((configs) =>
            configs.map((c, i) => ({ ...c, id: `level-${i}` }))
          ),
          (levelConfigs) => {
            levelSystem.levels = levelConfigs;
            levelSystem.loaded = true;

            for (let i = 0; i < levelConfigs.length; i++) {
              const level = levelSystem.getLevelByIndex(i);
              expect(level).not.toBeNull();
              expect(level.id).toBe(levelConfigs[i].id);
            }

            // Out of bounds should return null
            expect(levelSystem.getLevelByIndex(-1)).toBeNull();
            expect(levelSystem.getLevelByIndex(levelConfigs.length)).toBeNull();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getLevelCount SHALL return correct count', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
          const levels = [];
          for (let i = 0; i < count; i++) {
            levels.push({
              id: `level-${i}`,
              name: `Level ${i}`,
              songId: `song-${i}`,
              difficulty: 'normal',
              features: FeatureToggles.getDefaultFeatures()
            });
          }

          levelSystem.levels = levels;
          levelSystem.loaded = true;

          expect(levelSystem.getLevelCount()).toBe(count);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('reset SHALL clear all state', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (levelConfig) => {
          levelSystem.levels = [levelConfig];
          levelSystem.loaded = true;
          levelSystem.setCurrentLevel(levelConfig.id);

          // Reset
          levelSystem.reset();

          expect(levelSystem.levels).toHaveLength(0);
          expect(levelSystem.currentLevel).toBeNull();
          expect(levelSystem.loaded).toBe(false);
          expect(levelSystem.isLoaded()).toBe(false);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // FeatureToggles Direct Tests
  // ========================================
  describe('FeatureToggles Direct Operations', () => {
    it('enable/disable SHALL correctly toggle individual features', () => {
      fc.assert(
        fc.property(fc.constantFrom(...FeatureToggles.FEATURE_NAMES), fc.boolean(), (featureName, initialState) => {
          const toggles = new FeatureToggles();

          // Set initial state
          if (initialState) {
            toggles.enable(featureName);
          } else {
            toggles.disable(featureName);
          }

          expect(toggles.isEnabled(featureName)).toBe(initialState);

          // Toggle
          toggles.toggle(featureName);
          expect(toggles.isEnabled(featureName)).toBe(!initialState);

          // Toggle back
          toggles.toggle(featureName);
          expect(toggles.isEnabled(featureName)).toBe(initialState);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('enableAll/disableAll SHALL affect all features', () => {
      fc.assert(
        fc.property(fc.boolean(), (enableAll) => {
          const toggles = new FeatureToggles();

          if (enableAll) {
            toggles.enableAll();
            for (const name of FeatureToggles.FEATURE_NAMES) {
              expect(toggles.isEnabled(name)).toBe(true);
            }
            expect(toggles.getEnabledCount()).toBe(FeatureToggles.FEATURE_NAMES.length);
          } else {
            toggles.disableAll();
            for (const name of FeatureToggles.FEATURE_NAMES) {
              expect(toggles.isEnabled(name)).toBe(false);
            }
            expect(toggles.getEnabledCount()).toBe(0);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('getEnabled/getDisabled SHALL return correct feature lists', () => {
      fc.assert(
        fc.property(validFeaturesArb(), (features) => {
          const toggles = new FeatureToggles();
          toggles.setFeatures(features);

          const enabled = toggles.getEnabled();
          const disabled = toggles.getDisabled();

          // All features should be in one list or the other
          expect(enabled.length + disabled.length).toBe(FeatureToggles.FEATURE_NAMES.length);

          // Verify enabled list
          for (const name of enabled) {
            expect(features[name]).toBe(true);
          }

          // Verify disabled list
          for (const name of disabled) {
            expect(features[name]).toBe(false);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('equals SHALL correctly compare feature sets', () => {
      fc.assert(
        fc.property(validFeaturesArb(), validFeaturesArb(), (features1, features2) => {
          const toggles = new FeatureToggles();
          toggles.setFeatures(features1);

          // Check if features are equal
          const areEqual = FeatureToggles.FEATURE_NAMES.every((name) => features1[name] === features2[name]);

          expect(toggles.equals(features2)).toBe(areEqual);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('copyFrom SHALL duplicate feature state', () => {
      fc.assert(
        fc.property(validFeaturesArb(), (features) => {
          const source = new FeatureToggles();
          source.setFeatures(features);

          const target = new FeatureToggles();
          target.copyFrom(source);

          expect(target.equals(source.getAll())).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});

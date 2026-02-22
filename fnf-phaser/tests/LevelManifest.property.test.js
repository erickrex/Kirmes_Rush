/**
 * @fileoverview Property-based tests for LevelManifest.
 * Tests level manifest parsing and validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

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
 * Generate a valid difficulty string
 */
const difficultyArb = () => fc.oneof(fc.constant('easy'), fc.constant('normal'), fc.constant('hard'), nonEmptyString());

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
 * Generate a valid UI config object
 */
const validUIArb = () =>
  fc.record({
    showScore: fc.boolean(),
    showCombo: fc.boolean(),
    showAccuracy: fc.boolean(),
    showMisses: fc.boolean()
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
    difficulty: difficultyArb(),
    features: validFeaturesArb(),
    ui: fc.option(validUIArb(), { nil: undefined })
  });

/**
 * Generate an invalid manifest that will fail validation
 * Note: We need to create configs that will fail validation AFTER parsing
 * The parse function provides defaults for missing fields, so we need to
 * create configs with empty strings or invalid types
 */
const invalidManifestArb = () =>
  fc.oneof(
    // Empty string id (will fail validation)
    fc.record({
      id: fc.constant(''),
      name: nonEmptyString(),
      songId: nonEmptyString(),
      difficulty: difficultyArb(),
      features: validFeaturesArb()
    }),
    // Empty string name (will fail validation)
    fc.record({
      id: nonEmptyString(),
      name: fc.constant(''),
      songId: nonEmptyString(),
      difficulty: difficultyArb(),
      features: validFeaturesArb()
    }),
    // Empty string songId (will fail validation)
    fc.record({
      id: nonEmptyString(),
      name: nonEmptyString(),
      songId: fc.constant(''),
      difficulty: difficultyArb(),
      features: validFeaturesArb()
    }),
    // Empty string difficulty (will fail validation)
    fc.record({
      id: nonEmptyString(),
      name: nonEmptyString(),
      songId: nonEmptyString(),
      difficulty: fc.constant(''),
      features: validFeaturesArb()
    }),
    // Null config
    fc.constant(null),
    // Non-object config
    fc.constant('not an object'),
    // Features with missing required flags (after parse, will have defaults but we test validate directly)
    fc.record({
      id: nonEmptyString(),
      name: nonEmptyString(),
      songId: nonEmptyString(),
      difficulty: difficultyArb(),
      features: fc.record({
        holdNotes: fc.boolean()
        // Missing other required flags - will fail validation
      })
    })
  );

describe('LevelManifest Property Tests', () => {
  // ========================================
  // Property 39: Level Manifest Required Fields
  // ========================================
  describe('Property 39: Level Manifest Required Fields', () => {
    it('for any valid level manifest, it SHALL contain: id (string), name (string), songId (string), difficulty (string), and features (object with all feature flags)', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (config) => {
          // Parse the config (simulating loading from JSON)
          const parsed = LevelManifest.parse(config);

          // Verify all required fields exist and have correct types
          expect(parsed).not.toBeNull();
          expect(typeof parsed.id).toBe('string');
          expect(typeof parsed.name).toBe('string');
          expect(typeof parsed.songId).toBe('string');
          expect(typeof parsed.difficulty).toBe('string');
          expect(typeof parsed.features).toBe('object');
          expect(parsed.features).not.toBeNull();

          // Verify all feature flags exist and are booleans
          const requiredFlags = FeatureToggles.FEATURE_NAMES;
          for (const flag of requiredFlags) {
            expect(typeof parsed.features[flag]).toBe('boolean');
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('parsed manifest SHALL preserve original field values', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (config) => {
          const parsed = LevelManifest.parse(config);

          expect(parsed.id).toBe(String(config.id));
          expect(parsed.name).toBe(String(config.name));
          expect(parsed.songId).toBe(String(config.songId));
          expect(parsed.difficulty).toBe(String(config.difficulty));

          // Features should match
          for (const flag of FeatureToggles.FEATURE_NAMES) {
            expect(parsed.features[flag]).toBe(config.features[flag]);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('valid manifest SHALL pass validation', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (config) => {
          const parsed = LevelManifest.parse(config);
          const validation = LevelManifest.validate(parsed);

          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 40: Level Manifest Validation
  // ========================================
  describe('Property 40: Level Manifest Validation', () => {
    it('for any manifest missing required fields, LevelManifest.validate() SHALL return { valid: false, errors: [...] } with appropriate error messages', () => {
      fc.assert(
        fc.property(invalidManifestArb(), (invalidConfig) => {
          // Handle null/non-object cases - test validate directly
          if (invalidConfig === null || typeof invalidConfig !== 'object') {
            const validation = LevelManifest.validate(invalidConfig);
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            return true;
          }

          // For object configs with empty strings or missing feature flags,
          // validate directly (don't parse, as parse provides defaults)
          const validation = LevelManifest.validate(invalidConfig);

          // Should be invalid due to empty strings or missing feature flags
          expect(validation.valid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);

          // Errors should be descriptive strings
          for (const error of validation.errors) {
            expect(typeof error).toBe('string');
            expect(error.length).toBeGreaterThan(0);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('validation errors SHALL identify which field is missing or invalid', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('id'),
            fc.constant('name'),
            fc.constant('songId'),
            fc.constant('difficulty')
          ),
          (missingField) => {
            // Create a config with one empty field
            const config = {
              id: 'test-id',
              name: 'Test Name',
              songId: 'test-song',
              difficulty: 'normal',
              features: FeatureToggles.getDefaultFeatures()
            };

            // Set the specified field to empty string
            config[missingField] = '';

            const validation = LevelManifest.validate(config);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);

            // At least one error should mention the missing field
            // Error format is "Missing or invalid required field: fieldName"
            const hasRelevantError = validation.errors.some((error) =>
              error.includes(missingField)
            );
            expect(hasRelevantError).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validation SHALL fail when features object is null', () => {
      fc.assert(
        fc.property(nonEmptyString(), (id) => {
          const config = {
            id: id,
            name: 'Test Level',
            songId: 'test-song',
            difficulty: 'normal',
            features: null
          };

          const validation = LevelManifest.validate(config);

          expect(validation.valid).toBe(false);
          expect(validation.errors.some((e) => e.includes('features'))).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('validation SHALL detect missing feature flags', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...FeatureToggles.FEATURE_NAMES),
          nonEmptyString(),
          (missingFlag, id) => {
            // Create features with one flag missing
            const features = FeatureToggles.getDefaultFeatures();
            delete features[missingFlag];

            const config = {
              id: id,
              name: 'Test Level',
              songId: 'test-song',
              difficulty: 'normal',
              features: features
            };

            const validation = LevelManifest.validate(config);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);

            // Should mention the missing flag
            const hasRelevantError = validation.errors.some((error) => error.toLowerCase().includes(missingFlag.toLowerCase()));
            expect(hasRelevantError).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validation SHALL reject non-boolean feature flag values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...FeatureToggles.FEATURE_NAMES),
          fc.oneof(fc.constant('true'), fc.constant(1), fc.constant(null), fc.constant(undefined)),
          (flagName, invalidValue) => {
            const features = FeatureToggles.getDefaultFeatures();
            features[flagName] = invalidValue;

            const config = {
              id: 'test-id',
              name: 'Test Level',
              songId: 'test-song',
              difficulty: 'normal',
              features: features
            };

            const validation = LevelManifest.validate(config);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 41: Level Manifest Round-Trip
  // ========================================
  describe('Property 41: Level Manifest Round-Trip', () => {
    it('for any valid LevelConfig object, LevelManifest.parse(LevelManifest.serialize(config)) SHALL produce an equivalent LevelConfig', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (config) => {
          // Serialize the config
          const serialized = LevelManifest.serialize(config);

          // Parse it back
          const parsed = LevelManifest.parse(serialized);

          // Verify equivalence
          expect(parsed).not.toBeNull();
          expect(parsed.id).toBe(config.id);
          expect(parsed.name).toBe(config.name);
          expect(parsed.songId).toBe(config.songId);
          expect(parsed.difficulty).toBe(config.difficulty);

          // Features should match exactly
          for (const flag of FeatureToggles.FEATURE_NAMES) {
            expect(parsed.features[flag]).toBe(config.features[flag]);
          }

          // UI config should match if present
          if (config.ui) {
            expect(parsed.ui.showScore).toBe(config.ui.showScore);
            expect(parsed.ui.showCombo).toBe(config.ui.showCombo);
            expect(parsed.ui.showAccuracy).toBe(config.ui.showAccuracy);
            expect(parsed.ui.showMisses).toBe(config.ui.showMisses);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('round-trip SHALL preserve all feature flag states', () => {
      fc.assert(
        fc.property(validFeaturesArb(), nonEmptyString(), (features, id) => {
          const config = {
            id: id,
            name: 'Test Level',
            songId: 'test-song',
            difficulty: 'normal',
            features: features
          };

          const serialized = LevelManifest.serialize(config);
          const parsed = LevelManifest.parse(serialized);

          // Every feature flag should be preserved
          for (const flag of FeatureToggles.FEATURE_NAMES) {
            expect(parsed.features[flag]).toBe(features[flag]);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('round-trip SHALL preserve UI configuration', () => {
      fc.assert(
        fc.property(validUIArb(), nonEmptyString(), (ui, id) => {
          const config = {
            id: id,
            name: 'Test Level',
            songId: 'test-song',
            difficulty: 'normal',
            features: FeatureToggles.getDefaultFeatures(),
            ui: ui
          };

          const serialized = LevelManifest.serialize(config);
          const parsed = LevelManifest.parse(serialized);

          expect(parsed.ui.showScore).toBe(ui.showScore);
          expect(parsed.ui.showCombo).toBe(ui.showCombo);
          expect(parsed.ui.showAccuracy).toBe(ui.showAccuracy);
          expect(parsed.ui.showMisses).toBe(ui.showMisses);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('multiple round-trips SHALL produce identical results', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), fc.integer({ min: 2, max: 5 }), (config, iterations) => {
          let current = config;

          for (let i = 0; i < iterations; i++) {
            const serialized = LevelManifest.serialize(current);
            current = LevelManifest.parse(serialized);
          }

          // After multiple round-trips, should still match original
          expect(current.id).toBe(config.id);
          expect(current.name).toBe(config.name);
          expect(current.songId).toBe(config.songId);
          expect(current.difficulty).toBe(config.difficulty);

          for (const flag of FeatureToggles.FEATURE_NAMES) {
            expect(current.features[flag]).toBe(config.features[flag]);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('serialized manifest SHALL include version field', () => {
      fc.assert(
        fc.property(validLevelConfigArb(), (config) => {
          const serialized = LevelManifest.serialize(config);

          expect(serialized.version).toBe(LevelManifest.VERSION);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Additional Edge Case Tests
  // ========================================
  describe('Edge Cases', () => {
    it('parse SHALL handle missing optional fields gracefully', () => {
      fc.assert(
        fc.property(nonEmptyString(), nonEmptyString(), nonEmptyString(), (id, name, songId) => {
          const minimalConfig = {
            id: id,
            name: name,
            songId: songId,
            difficulty: 'normal',
            features: FeatureToggles.getDefaultFeatures()
            // No description, no ui
          };

          const parsed = LevelManifest.parse(minimalConfig);

          expect(parsed).not.toBeNull();
          expect(parsed.id).toBe(id);
          expect(parsed.description).toBeUndefined();
          expect(parsed.ui).toBeDefined(); // Should get defaults

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('parse SHALL provide default features when features object is missing', () => {
      fc.assert(
        fc.property(nonEmptyString(), (id) => {
          const configWithoutFeatures = {
            id: id,
            name: 'Test',
            songId: 'song',
            difficulty: 'normal'
            // No features
          };

          const parsed = LevelManifest.parse(configWithoutFeatures);

          expect(parsed).not.toBeNull();
          expect(parsed.features).toBeDefined();

          // Should have all feature flags with default values
          const defaults = FeatureToggles.getDefaultFeatures();
          for (const flag of FeatureToggles.FEATURE_NAMES) {
            expect(parsed.features[flag]).toBe(defaults[flag]);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('createDefault SHALL create valid configs', () => {
      fc.assert(
        fc.property(nonEmptyString(), nonEmptyString(), nonEmptyString(), (id, name, songId) => {
          const config = LevelManifest.createDefault(id, name, songId);

          const validation = LevelManifest.validate(config);

          expect(validation.valid).toBe(true);
          expect(config.id).toBe(id);
          expect(config.name).toBe(name);
          expect(config.songId).toBe(songId);
          expect(config.difficulty).toBe('normal');

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});

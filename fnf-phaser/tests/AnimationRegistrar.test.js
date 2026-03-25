/**
 * @fileoverview Property-based tests for AnimationRegistrar.
 * Uses fast-check to verify correctness properties from the design document.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { registerCharacterAnimations, registerPropAnimations } from '../src/graphics/AnimationRegistrar.js';

/**
 * Create a mock Phaser scene with anims.create() and anims.generateFrameNames().
 * - scene.anims.create(config) returns the config
 * - scene.anims.generateFrameNames(key, opts) returns [{ key, frame: opts.prefix }]
 */
function createMockScene() {
  return {
    anims: {
      create(config) {
        return config;
      },
      generateFrameNames(key, opts) {
        return [{ key, frame: opts.prefix }];
      }
    }
  };
}

// --- Shared generators ---

const animNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/);
const prefixArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/);
const textureKeyArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]{0,14}$/);

/** Character animation definition generator */
const characterAnimArb = fc.record({
  name: animNameArb,
  prefix: prefixArb,
  frameRate: fc.integer({ min: 1, max: 120 }),
  looped: fc.boolean(),
  flipX: fc.boolean(),
  flipY: fc.boolean(),
  frameIndices: fc.oneof(fc.constant(null), fc.array(fc.integer({ min: 0, max: 60 }), { minLength: 1, maxLength: 10 })),
  offsets: fc.tuple(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }))
});

/** Stage prop animation definition generator */
const propAnimArb = fc.record({
  name: animNameArb,
  prefix: prefixArb,
  frameRate: fc.integer({ min: 1, max: 120 }),
  looped: fc.boolean(),
  offsets: fc.tuple(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }))
});

describe('AnimationRegistrar — Property-Based Tests', () => {
  /**
   * Property 2: Animation registration completeness
   * **Validates: Requirements 2.2**
   *
   * For any character with N animation definitions, registerCharacterAnimations()
   * produces exactly N configs, each with correct key, frameRate, and repeat.
   */
  describe('Property 2: Animation registration completeness', () => {
    it('output config count equals input count, each config has correct key, frameRate, and repeat', () => {
      fc.assert(
        fc.property(
          textureKeyArb,
          fc.array(characterAnimArb, { minLength: 1, maxLength: 15 }),
          (textureKey, animations) => {
            // Ensure unique animation names
            const seen = new Set();
            const uniqueAnims = animations.filter((a) => {
              if (seen.has(a.name)) return false;
              seen.add(a.name);
              return true;
            });

            const scene = createMockScene();
            const results = registerCharacterAnimations(scene, textureKey, uniqueAnims);

            // Config count equals input count
            expect(results.length).toBe(uniqueAnims.length);

            // Each config has correct key, frameRate, and repeat
            for (let i = 0; i < uniqueAnims.length; i++) {
              const anim = uniqueAnims[i];
              const config = results[i];

              expect(config.key).toBe(anim.name);
              expect(config.frameRate).toBe(anim.frameRate);
              expect(config.repeat).toBe(anim.looped ? -1 : 0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prop animations: output config count equals input count with correct fields', () => {
      fc.assert(
        fc.property(
          textureKeyArb,
          fc.array(propAnimArb, { minLength: 1, maxLength: 15 }),
          (textureKey, animations) => {
            const seen = new Set();
            const uniqueAnims = animations.filter((a) => {
              if (seen.has(a.name)) return false;
              seen.add(a.name);
              return true;
            });

            const scene = createMockScene();
            const results = registerPropAnimations(scene, textureKey, uniqueAnims);

            expect(results.length).toBe(uniqueAnims.length);

            for (let i = 0; i < uniqueAnims.length; i++) {
              const anim = uniqueAnims[i];
              const config = results[i];

              expect(config.key).toBe(anim.name);
              expect(config.frameRate).toBe(anim.frameRate);
              expect(config.repeat).toBe(anim.looped ? -1 : 0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('registerPropAnimations returns empty array for null or empty animations', () => {
      const scene = createMockScene();
      expect(registerPropAnimations(scene, 'some-key', [])).toEqual([]);
      expect(registerPropAnimations(scene, 'some-key', null)).toEqual([]);
    });
  });
});

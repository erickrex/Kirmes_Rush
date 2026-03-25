/**
 * @fileoverview Property-based tests for AssetManifestBuilder.
 * Uses fast-check to verify correctness properties from the design document.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  buildCharacterEntries,
  buildStageEntries,
  buildManifest,
  deduplicateEntries
} from '../src/levels/AssetManifestBuilder.js';
import { resolveAssetPath } from '../src/utils/AssetPathResolver.js';

// --- Shared generators ---

/** Alphanumeric string IDs (1-20 chars) */
const idArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/);

/** Prop name (no special chars) */
const propNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,14}$/);

/** Simple asset path segment */
const pathSegmentArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,19}$/);

describe('AssetManifestBuilder — Property-Based Tests', () => {
  /**
   * Property 1: Character manifest completeness
   * **Validates: Requirements 2.1**
   *
   * For any set of character IDs, buildCharacterEntries() returns exactly one
   * atlas entry per unique character ID, with correct key and path patterns.
   */
  describe('Property 1: Character manifest completeness', () => {
    it('entry count equals unique character count, keys match char-{id}, paths end with .png', () => {
      fc.assert(
        fc.property(
          fc.array(idArb, { minLength: 0, maxLength: 10 }),
          (charIds) => {
            const uniqueIds = [...new Set(charIds)];

            // Mock registry: every ID is known, returns shared:<ID>
            const characterRegistry = {
              getAssetPath: (id) => `shared:CHARACTER_${id}`
            };

            const entries = buildCharacterEntries(charIds, characterRegistry);

            // Entry count equals unique character count
            expect(entries.length).toBe(uniqueIds.length);

            // Keys match char-{id}
            const expectedKeys = new Set(uniqueIds.map((id) => `char-${id}`));
            const actualKeys = new Set(entries.map((e) => e.key));
            expect(actualKeys).toEqual(expectedKeys);

            // Each path ends with the resolved assetPath + .png
            for (const entry of entries) {
              const id = entry.key.replace('char-', '');
              const resolved = resolveAssetPath(`shared:CHARACTER_${id}`);
              expect(entry.path).toContain(resolved);
              expect(entry.path).toMatch(/\.png$/);
              expect(entry.type).toBe('atlas');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Stage manifest correctness with type inference
   * **Validates: Requirements 3.1, 3.3**
   *
   * For any stage with props, buildStageEntries() returns entries whose type
   * is 'atlas' when animations exist and 'image' otherwise, with correct keys.
   */
  describe('Property 3: Stage manifest correctness with type inference', () => {
    it('entry types are atlas when animations exist, image otherwise, keys match stage-{stageId}-{propName}', () => {
      fc.assert(
        fc.property(
          idArb,
          fc.array(
            fc.record({
              name: propNameArb,
              assetPath: pathSegmentArb.map((seg) => `shared:${seg}`),
              animations: fc.oneof(
                fc.constant([]),
                fc.array(
                  fc.record({
                    name: idArb,
                    prefix: idArb,
                    frameRate: fc.integer({ min: 1, max: 60 }),
                    looped: fc.boolean()
                  }),
                  { minLength: 1, maxLength: 3 }
                )
              )
            }),
            { minLength: 1, maxLength: 8 }
          ),
          (stageId, props) => {
            // Ensure unique prop names
            const seenNames = new Set();
            const uniqueProps = props.filter((p) => {
              if (seenNames.has(p.name)) return false;
              seenNames.add(p.name);
              return true;
            });

            const stageRegistry = {
              getStageProps: (id) => (id === stageId ? uniqueProps : [])
            };

            const entries = buildStageEntries(stageId, stageRegistry);

            expect(entries.length).toBe(uniqueProps.length);

            for (let i = 0; i < uniqueProps.length; i++) {
              const prop = uniqueProps[i];
              const entry = entries.find((e) => e.key === `stage-${stageId}-${prop.name}`);
              expect(entry).toBeDefined();

              const hasAnimations = Array.isArray(prop.animations) && prop.animations.length > 0;
              if (hasAnimations) {
                expect(entry.type).toBe('atlas');
                expect(entry.atlasURL).toBeDefined();
              } else {
                expect(entry.type).toBe('image');
                expect(entry.atlasURL).toBeUndefined();
              }

              expect(entry.key).toBe(`stage-${stageId}-${prop.name}`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Full session manifest completeness
   * **Validates: Requirements 5.2**
   *
   * For any valid session, buildManifest() returns keys that are a superset
   * of all expected audio, character, stage, and note style keys.
   */
  describe('Property 4: Full session manifest completeness', () => {
    it('manifest keys are a superset of all expected audio, character, stage, and note style keys', () => {
      fc.assert(
        fc.property(
          fc.record({
            playerId: idArb,
            opponentId: idArb,
            stageId: idArb,
            noteStyleId: idArb,
            audioKey: idArb
          }),
          ({ playerId, opponentId, stageId, noteStyleId, audioKey }) => {
            // Build a session with audio assets, characters, stage, noteStyle
            const session = {
              assets: [{ type: 'audio', key: `song-${audioKey}-instrumental`, path: `audio/${audioKey}.ogg` }],
              songData: {
                characters: { player: playerId, opponent: opponentId },
                stage: stageId,
                noteStyle: noteStyleId
              }
            };

            const characterRegistry = {
              getAssetPath: (id) => `shared:CHARACTER_${id}`
            };

            const stageRegistry = {
              getStageProps: () => [
                { name: 'bg', assetPath: `shared:STAGE_BG`, animations: [] }
              ]
            };

            const noteStyleRegistry = {
              getResolvedAsset: (styleId, assetKey) => ({
                resolvedPath: `images/shared/notestyle_${styleId}_${assetKey}`
              })
            };

            const registries = { characterRegistry, stageRegistry, noteStyleRegistry };
            const manifest = buildManifest(session, registries);
            const manifestKeys = new Set(manifest.map((e) => e.key));

            // Audio key present
            expect(manifestKeys.has(`song-${audioKey}-instrumental`)).toBe(true);

            // Character keys present
            const uniqueCharIds = [...new Set([playerId, opponentId])];
            for (const cid of uniqueCharIds) {
              expect(manifestKeys.has(`char-${cid}`)).toBe(true);
            }

            // Stage key present
            expect(manifestKeys.has(`stage-${stageId}-bg`)).toBe(true);

            // Note style keys present
            for (const assetKey of ['note', 'noteStrumline', 'noteSplash', 'holdNote']) {
              expect(manifestKeys.has(`notestyle-${noteStyleId}-${assetKey}`)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Asset path prefixing correctness
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any registry-style path without the assets/funkin.assets/ prefix,
   * both path and atlasURL in produced entries start with assets/funkin.assets/.
   */
  describe('Property 5: Asset path prefixing correctness', () => {
    it('both path and atlasURL start with assets/funkin.assets/', () => {
      fc.assert(
        fc.property(
          fc.array(idArb, { minLength: 1, maxLength: 5 }),
          (charIds) => {
            const uniqueIds = [...new Set(charIds)];

            // Registry returns paths that do NOT start with assets/funkin.assets/
            const characterRegistry = {
              getAssetPath: (id) => `shared:${id}`
            };

            const entries = buildCharacterEntries(uniqueIds, characterRegistry);

            for (const entry of entries) {
              expect(entry.path.startsWith('assets/funkin.assets/')).toBe(true);
              if (entry.atlasURL) {
                expect(entry.atlasURL.startsWith('assets/funkin.assets/')).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Path prefix idempotence
   * **Validates: Requirements 6.3**
   *
   * For any path that already includes assets/funkin.assets/,
   * no double-prefixing occurs.
   */
  describe('Property 6: Path prefix idempotence', () => {
    it('no double-prefixing occurs for already-prefixed paths', () => {
      fc.assert(
        fc.property(
          fc.array(idArb, { minLength: 1, maxLength: 5 }),
          (charIds) => {
            const uniqueIds = [...new Set(charIds)];

            // Registry returns paths that ALREADY include the prefix
            const characterRegistry = {
              getAssetPath: (id) => `assets/funkin.assets/images/shared/${id}`
            };

            const entries = buildCharacterEntries(uniqueIds, characterRegistry);

            for (const entry of entries) {
              // Should NOT contain the prefix doubled
              expect(entry.path).not.toContain('assets/funkin.assets/assets/funkin.assets/');
              if (entry.atlasURL) {
                expect(entry.atlasURL).not.toContain('assets/funkin.assets/assets/funkin.assets/');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Cache-aware deduplication
   * **Validates: Requirements 7.1, 7.2**
   *
   * For any array of AssetEntry objects with duplicate keys,
   * deduplicateEntries() output has no duplicate keys, length equals
   * unique key count, and first occurrence is kept.
   */
  describe('Property 7: Cache-aware deduplication', () => {
    it('output has no duplicate keys, length equals unique key count, first occurrence kept', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: fc.constantFrom('atlas', 'image', 'audio'),
              key: fc.stringMatching(/^[a-z]{1,5}-[a-z0-9]{1,5}$/),
              path: pathSegmentArb.map((s) => `assets/funkin.assets/${s}.png`)
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (entries) => {
            const result = deduplicateEntries(entries);

            // No duplicate keys in output
            const resultKeys = result.map((e) => e.key);
            expect(new Set(resultKeys).size).toBe(resultKeys.length);

            // Length equals unique key count from input
            const uniqueInputKeys = new Set(entries.map((e) => e.key));
            expect(result.length).toBe(uniqueInputKeys.size);

            // First occurrence is kept
            for (const entry of result) {
              const firstInInput = entries.find((e) => e.key === entry.key);
              expect(entry).toBe(firstInInput);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

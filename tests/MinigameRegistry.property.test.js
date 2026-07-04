/**
 * @fileoverview Property-based tests for MinigameRegistry.
 *
 * Feature: rhythm-minigame-prototype
 *
 * Property 8: Schema validity — every committed Minigame_Definition JSON under
 * assets/data/rhythm/minigames/ satisfies the registry schema.
 * **Validates: Requirements 11.1**
 *
 * Also includes randomized invariants for validate(): a definition assembled
 * from valid parts always validates, and a definition missing a required part
 * always reports the corresponding field-level error.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import MinigameRegistry from '../src/rhythm/minigames/MinigameRegistry.js';

const NUM_RUNS = 100;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINIGAMES_DIR = path.resolve(__dirname, '../assets/data/rhythm/minigames');

/**
 * List committed Minigame_Definition JSON files, iterating over whatever exists
 * now (the authored definitions land in task 11). Returns [] when the directory
 * is absent so the property is vacuously satisfied until the files are added.
 * @returns {string[]} Absolute paths to *.json files under the minigames dir.
 */
function listMinigameJsonFiles() {
  if (!fs.existsSync(MINIGAMES_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MINIGAMES_DIR)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => path.join(MINIGAMES_DIR, name));
}

describe('Property 8: Schema validity (R11.1)', () => {
  const registry = new MinigameRegistry();
  const files = listMinigameJsonFiles();

  it('every present Minigame_Definition JSON satisfies the registry schema', () => {
    // Vacuously true when task 11 has not authored the definitions yet.
    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf-8');
      let parsed;
      expect(
        () => {
          parsed = JSON.parse(raw);
        },
        `expected ${path.basename(file)} to be valid JSON`
      ).not.toThrow();

      const { valid, errors } = registry.validate(parsed);
      expect(valid, `${path.basename(file)}: ${errors.join('; ')}`).toBe(true);
    }
  });
});

describe('Property: validate() invariants over randomized definitions (R11.1/R11.2)', () => {
  const registry = new MinigameRegistry();

  const gestureArb = fc.constantFrom('tap', 'hold', 'flick', 'release');
  const gesturesArb = fc.uniqueArray(gestureArb, { minLength: 1, maxLength: 4 });

  // A tempo source is either a positive bpm or a song reference with an id.
  const tempoArb = fc.oneof(
    fc.record({ bpm: fc.double({ min: 1, max: 400, noNaN: true }) }),
    fc.record({ song: fc.record({ id: fc.string({ minLength: 1, maxLength: 12 }) }) })
  );

  const validDefinitionArb = fc
    .record({
      id: fc.string({ minLength: 1, maxLength: 16 }),
      name: fc.string({ minLength: 1, maxLength: 24 }),
      tempo: tempoArb,
      gestures: gesturesArb,
      timeline: fc.array(fc.record({ beat: fc.nat() }), { maxLength: 8 })
    })
    .map(({ id, name, tempo, gestures, timeline }) => ({
      id,
      name,
      ...tempo,
      input: { allowedGestures: gestures },
      timeline
    }));

  it('accepts any definition assembled from valid parts', () => {
    fc.assert(
      fc.property(validDefinitionArb, (def) => {
        const { valid, errors } = registry.validate(def);
        expect(valid, errors.join('; ')).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('flags the matching field error when a required part is removed', () => {
    const removals = [
      { field: 'id', prefix: 'id:', drop: (d) => ({ ...d, id: '' }) },
      { field: 'name', prefix: 'name:', drop: (d) => ({ ...d, name: '' }) },
      {
        field: 'bpm|song',
        prefix: 'bpm|song:',
        drop: (d) => {
          const rest = { ...d };
          delete rest.bpm;
          delete rest.song;
          return rest;
        }
      },
      {
        field: 'input.allowedGestures',
        prefix: 'input.allowedGestures:',
        drop: (d) => ({ ...d, input: { allowedGestures: [] } })
      },
      {
        field: 'timeline',
        prefix: 'timeline:',
        drop: (d) => {
          const rest = { ...d };
          delete rest.timeline;
          return rest;
        }
      }
    ];

    fc.assert(
      fc.property(validDefinitionArb, fc.constantFrom(...removals), (def, removal) => {
        const broken = removal.drop(def);
        const { valid, errors } = registry.validate(broken);
        expect(valid).toBe(false);
        expect(
          errors.some((e) => e.startsWith(removal.prefix)),
          `expected a "${removal.prefix}" error, got: ${errors.join('; ')}`
        ).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

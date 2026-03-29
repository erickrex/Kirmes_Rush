/**
 * @fileoverview Property-based test: No bare Object parameter types in data layer.
 * Parses all data layer .js files, extracts @param annotations, and asserts
 * none use bare `Object` as the parameter type. Compound types like
 * `Object<string, number>` or `Record<string, any>` are allowed.
 *
 * Feature: whole-app-stabilization, Property 5: No bare Object parameter types in data layer
 * **Validates: Requirements 5.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..', '..');

/** Data layer files to check for bare Object params. */
const DATA_LAYER_FILES = [
  join(ROOT, 'src', 'data', 'parsers', 'ChartParser.js'),
  join(ROOT, 'src', 'data', 'parsers', 'SparrowParser.js'),
  join(ROOT, 'src', 'data', 'SaveManager.js'),
  join(ROOT, 'src', 'data', 'registries', 'CharacterRegistry.js'),
  join(ROOT, 'src', 'data', 'registries', 'NoteStyleRegistry.js'),
  join(ROOT, 'src', 'data', 'registries', 'StageRegistry.js'),
  join(ROOT, 'src', 'data', 'registries', 'SongRegistry.js'),
  join(ROOT, 'src', 'core', 'Registry.js'),
];

/**
 * Regex that matches bare `@param {Object}` — i.e. `Object` NOT followed by
 * `<` (which would make it a generic like `Object<string, number>`).
 * Also matches `@param {Object}` with optional `[]` for optional params.
 */
const BARE_OBJECT_PARAM = /@param\s+\{Object\}(?!\s*<)/g;

/**
 * Extract all bare `@param {Object}` occurrences from file content.
 * Returns an array of { line, text } for each match.
 * @param {string} content
 * @returns {{ line: number, text: string }[]}
 */
function findBareObjectParams(content) {
  const results = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (BARE_OBJECT_PARAM.test(lines[i])) {
      results.push({ line: i + 1, text: lines[i].trim() });
    }
    // Reset lastIndex since we reuse the regex with `g` flag
    BARE_OBJECT_PARAM.lastIndex = 0;
  }
  return results;
}

describe('Property 5: No bare Object parameter types in data layer', () => {
  it('no data layer file shall use bare @param {Object} — concrete typedefs required', () => {
    // Precondition: all data layer files exist
    for (const f of DATA_LAYER_FILES) {
      expect(() => readFileSync(f, 'utf-8')).not.toThrow();
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...DATA_LAYER_FILES),
        (filePath) => {
          const content = readFileSync(filePath, 'utf-8');
          const relPath = relative(ROOT, filePath);
          const bareParams = findBareObjectParams(content);

          if (bareParams.length > 0) {
            const details = bareParams
              .map((p) => `  line ${p.line}: ${p.text}`)
              .join('\n');
            throw new Error(
              `Bare @param {Object} found in ${relPath}:\n${details}\n` +
                `Use a concrete typedef (e.g. RawChartJSON, Record<string, any>) instead.`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * @fileoverview Property-based test: No duplicate cross-module typedefs.
 * Parses all .js files in src/, extracts @typedef names, and asserts that
 * no typedef name appears in both types.js and another file.
 *
 * Note: @import statements (e.g. `@import { NoteData } from '../types.js'`)
 * and @typedef import aliases (e.g. `@typedef {import('./types.js').X} X`)
 * are NOT new type definitions and are excluded from duplicate detection.
 *
 * Feature: whole-app-stabilization, Property 4: No duplicate cross-module typedefs
 * **Validates: Requirements 4.3, 4.4, 4.5, 4.6**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(import.meta.dirname, '..', '..', 'src');
const TYPES_FILE = join(SRC_DIR, 'types.js');

/** Regex to extract @typedef names: matches `@typedef {SomeType} Name` */
const TYPEDEF_REGEX = /@typedef\s+\{[^}]+\}\s+(\w+)/g;

/**
 * Recursively collect all .js file paths under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract all @typedef names from file content.
 * Excludes:
 * - @import statements (e.g. `@import { NoteData } from '../types.js'`)
 * - @typedef import aliases (e.g. `@typedef {import('../types.js').X} X`)
 *   which are type imports, not new type definitions.
 * @param {string} content
 * @returns {Set<string>}
 */
function extractTypedefNames(content) {
  const names = new Set();
  // Remove @import lines so they don't get matched as typedefs
  let cleaned = content.replace(/^\s*\*?\s*@import\s+.*/gm, '');
  // Remove @typedef {import(...)} aliases — these are type imports, not definitions
  cleaned = cleaned.replace(
    /^\s*\*?\s*@typedef\s+\{import\([^)]+\)\.[^}]+\}\s+\w+/gm,
    ''
  );
  let match;
  while ((match = TYPEDEF_REGEX.exec(cleaned)) !== null) {
    names.add(match[1]);
  }
  return names;
}

// Pre-compute the canonical typedef names from types.js
const typesJsContent = readFileSync(TYPES_FILE, 'utf-8');
const typesJsNames = extractTypedefNames(typesJsContent);

// Collect all non-types.js source files
const allJsFiles = collectJsFiles(SRC_DIR).filter(
  (f) => f !== TYPES_FILE
);

describe('Property 4: No duplicate cross-module typedefs', () => {
  it('no @typedef name defined in types.js shall also be defined in another src/ file', () => {
    // Precondition: types.js actually defines typedefs
    expect(typesJsNames.size).toBeGreaterThan(0);
    // Precondition: we have other source files to check
    expect(allJsFiles.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...allJsFiles),
        (filePath) => {
          const content = readFileSync(filePath, 'utf-8');
          const localNames = extractTypedefNames(content);
          const relPath = relative(SRC_DIR, filePath);

          for (const name of localNames) {
            if (typesJsNames.has(name)) {
              throw new Error(
                `Duplicate typedef "${name}" found in src/${relPath} — ` +
                `this name is already defined in src/types.js. ` +
                `Remove the local typedef and import from types.js instead.`
              );
            }
          }
        }
      ),
      { numRuns: Math.max(100, allJsFiles.length) }
    );
  });
});

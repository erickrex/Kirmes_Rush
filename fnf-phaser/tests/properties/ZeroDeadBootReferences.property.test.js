/**
 * @fileoverview Property-based test: Zero dead boot references.
 * Scans all .js files in src/ for occurrences of "BootScene" or "TitleScene"
 * used as scene keys and asserts zero matches.
 *
 * Feature: whole-app-stabilization, Property 1: Zero dead boot references
 * **Validates: Requirements 1.6, 8.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(import.meta.dirname, '..', '..', 'src');

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

/** Scene-key patterns that must not appear in source files. */
const DEAD_SCENE_KEY_PATTERN = /["']BootScene["']|["']TitleScene["']/;

const allJsFiles = collectJsFiles(SRC_DIR);

describe('Property 1: Zero dead boot references', () => {
  it('no .js file in src/ shall contain "BootScene" or "TitleScene" scene key string literals', () => {
    // Precondition: we actually found source files to scan
    expect(allJsFiles.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...allJsFiles),
        (filePath) => {
          const content = readFileSync(filePath, 'utf-8');
          const relPath = relative(SRC_DIR, filePath);
          const match = content.match(DEAD_SCENE_KEY_PATTERN);
          if (match) {
            throw new Error(
              `Dead boot reference found in src/${relPath}: ${match[0]}`
            );
          }
        }
      ),
      { numRuns: Math.max(100, allJsFiles.length) }
    );
  });
});

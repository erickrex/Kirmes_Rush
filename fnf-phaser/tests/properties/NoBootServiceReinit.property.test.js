/**
 * @fileoverview Property-based test: No boot service re-initialization in scenes.
 * For each gameplay/menu scene, reads the source code and verifies that the
 * create() method body does NOT contain calls to SaveManager.init(),
 * TouchDeviceDetector.detect(), or OrientationOverlay.init().
 *
 * These services must only be initialized once in main.js (App Bootstrap).
 *
 * Feature: whole-app-stabilization, Property 3: No boot service re-initialization in scenes
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, '..', '..', 'src');

/**
 * All gameplay/menu scene source files to check.
 * main.js is intentionally excluded — that's where boot services belong.
 */
const SCENE_FILES = [
  { name: 'TitleState', path: join(SRC_DIR, 'ui', 'TitleState.js') },
  { name: 'MainMenuState', path: join(SRC_DIR, 'ui', 'MainMenuState.js') },
  { name: 'LevelSelectState', path: join(SRC_DIR, 'ui', 'LevelSelectState.js') },
  { name: 'StoryMenuState', path: join(SRC_DIR, 'ui', 'StoryMenuState.js') },
  { name: 'FreeplayState', path: join(SRC_DIR, 'ui', 'FreeplayState.js') },
  { name: 'OptionsState', path: join(SRC_DIR, 'ui', 'OptionsState.js') },
  { name: 'PlayScene', path: join(SRC_DIR, 'scenes', 'PlayScene.js') },
  { name: 'PauseSubState', path: join(SRC_DIR, 'ui', 'PauseSubState.js') },
  { name: 'GameOverState', path: join(SRC_DIR, 'ui', 'GameOverState.js') },
  { name: 'ResultState', path: join(SRC_DIR, 'ui', 'ResultState.js') },
  { name: 'LoadingState', path: join(SRC_DIR, 'ui', 'LoadingState.js') },
  { name: 'ReplayBrowserState', path: join(SRC_DIR, 'ui', 'ReplayBrowserState.js') },
];

/**
 * Patterns that indicate boot service re-initialization.
 * Each entry has a regex to match against the create() method body
 * and a human-readable description.
 */
const BOOT_SERVICE_PATTERNS = [
  {
    pattern: /SaveManager\.getInstance\(\)\.init\s*\(/,
    description: 'SaveManager.getInstance().init()',
  },
  {
    pattern: /SaveManager\.init\s*\(/,
    description: 'SaveManager.init()',
  },
  {
    pattern: /saveManager\.init\s*\(/,
    description: 'saveManager.init()',
  },
  {
    pattern: /TouchDeviceDetector\.detect\s*\(/,
    description: 'TouchDeviceDetector.detect()',
  },
  {
    pattern: /OrientationOverlay\.init\s*\(/,
    description: 'OrientationOverlay.init()',
  },
];

/**
 * Extract the create() method body from source code.
 * @param {string} source
 * @returns {string|null}
 */
function extractCreateBody(source) {
  // Match `create(` with optional params, then `{`
  const startIdx = source.search(/\bcreate\s*\([^)]*\)\s*\{/);
  if (startIdx === -1) return null;

  const braceStart = source.indexOf('{', startIdx);
  let depth = 1;
  let i = braceStart + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(braceStart, i);
}

describe('Property 3: No boot service re-initialization in scenes', () => {
  it('no scene create() method shall call SaveManager.init, TouchDeviceDetector.detect, or OrientationOverlay.init', () => {
    // Precondition: we have all 12 scene files to check
    expect(SCENE_FILES.length).toBe(12);

    fc.assert(
      fc.property(
        fc.constantFrom(...SCENE_FILES),
        (sceneFile) => {
          const source = readFileSync(sceneFile.path, 'utf-8');
          const createBody = extractCreateBody(source);

          // If the scene has no create() method, it trivially passes
          if (!createBody) return;

          for (const { pattern, description } of BOOT_SERVICE_PATTERNS) {
            if (pattern.test(createBody)) {
              throw new Error(
                `${sceneFile.name}.create() contains boot service call: ${description}. ` +
                `Boot services must only be initialized in main.js (App Bootstrap).`
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

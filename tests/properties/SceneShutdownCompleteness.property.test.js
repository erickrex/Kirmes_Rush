/**
 * @fileoverview Property-based test: Scene shutdown completeness.
 * For each scene class, verifies that calling shutdown() removes all listener
 * registrations and nulls owned references — via static source analysis.
 *
 * Feature: whole-app-stabilization, Property 2: Scene shutdown completeness
 * **Validates: Requirements 2.1, 2.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { join, basename } from 'path';

const SRC_DIR = join(import.meta.dirname, '..', '..', 'src');

/**
 * All scene source files that must follow the shutdown lifecycle contract.
 * Paths are relative to the src/ directory.
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
 * Extract keyboard listener event names from .on('keydown-X', ...) calls.
 * Returns an array of event name strings like 'keydown-ENTER'.
 * @param {string} source
 * @returns {string[]}
 */
function extractKeyboardOnCalls(source) {
  const pattern = /\.on\(\s*'(keydown-[A-Z]+)'/g;
  const results = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Extract keyboard listener removals from .off('keydown-X', ...) calls.
 * @param {string} source
 * @returns {string[]}
 */
function extractKeyboardOffCalls(source) {
  const pattern = /\.off\(\s*'(keydown-[A-Z]+)'/g;
  const results = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Extract EventBus.on subscription event names.
 * @param {string} source
 * @returns {string[]}
 */
function extractEventBusOnCalls(source) {
  const pattern = /EventBus\.on\(\s*([A-Za-z_.]+)/g;
  const results = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Extract EventBus.off removal event names.
 * @param {string} source
 * @returns {string[]}
 */
function extractEventBusOffCalls(source) {
  const pattern = /EventBus\.off\(\s*([A-Za-z_.]+)/g;
  const results = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Check if source has a shutdown method.
 * Looks for `shutdown()` or `shutdown ()` method definition.
 * Also considers inherited shutdown from BaseMenuState.
 * @param {string} source
 * @param {boolean} extendsBaseMenu
 * @returns {boolean}
 */
function hasShutdownMethod(source, extendsBaseMenu) {
  // Direct shutdown method in the file
  if (/shutdown\s*\(\s*\)\s*\{/.test(source)) {
    return true;
  }
  // BaseMenuState subclasses inherit shutdown from the base class
  return extendsBaseMenu;
}

/**
 * Extract the shutdown method body from source code.
 * @param {string} source
 * @returns {string|null}
 */
function extractShutdownBody(source) {
  const startIdx = source.search(/shutdown\s*\(\s*\)\s*\{/);
  if (startIdx === -1) return null;

  // Find the opening brace
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

/**
 * Check if the shutdown body contains reference cleanup assignments.
 * Accepts both `= null` and `= []` as valid cleanup patterns.
 * @param {string} shutdownBody
 * @returns {boolean}
 */
function hasReferenceCleanup(shutdownBody) {
  return /=\s*null/.test(shutdownBody) || /=\s*\[\s*\]/.test(shutdownBody);
}

/**
 * Check if a scene extends BaseMenuState (which provides teardownInput in shutdown).
 * @param {string} source
 * @returns {boolean}
 */
function extendsBaseMenuState(source) {
  return /extends\s+BaseMenuState/.test(source);
}

/**
 * Check if the scene has any listener registrations that need cleanup.
 * @param {string} source
 * @returns {{ hasKeyboardListeners: boolean, hasEventBusListeners: boolean, hasTimers: boolean }}
 */
function detectRegistrations(source) {
  return {
    hasKeyboardListeners: /\.on\(\s*'keydown-/.test(source),
    hasEventBusListeners: /EventBus\.on\(/.test(source),
    hasTimers: /this\.time\.(addEvent|delayedCall)\(/.test(source),
  };
}

describe('Property 2: Scene shutdown completeness', () => {
  it('every scene with listener registrations must have a shutdown method with corresponding cleanup', () => {
    // Precondition: we have scene files to check
    expect(SCENE_FILES.length).toBe(12);

    fc.assert(
      fc.property(
        fc.constantFrom(...SCENE_FILES),
        (sceneFile) => {
          const source = readFileSync(sceneFile.path, 'utf-8');
          const isBaseMenu = extendsBaseMenuState(source);
          const registrations = detectRegistrations(source);
          const hasAnyRegistration =
            registrations.hasKeyboardListeners ||
            registrations.hasEventBusListeners ||
            registrations.hasTimers;

          // If the scene registers listeners/timers, it must have a shutdown method
          if (hasAnyRegistration) {
            const hasShutdown = hasShutdownMethod(source, isBaseMenu);
            if (!hasShutdown) {
              throw new Error(
                `${sceneFile.name} registers listeners/timers but has no shutdown() method`
              );
            }
          }

          // Check keyboard listener cleanup:
          // For BaseMenuState subclasses, the base class teardownInput() handles
          // the standard bindings via getInputBindings(), so we check the base class
          // pattern. For direct Phaser.Scene subclasses, each .on() needs a .off().
          if (registrations.hasKeyboardListeners) {
            if (isBaseMenu) {
              // BaseMenuState.shutdown() calls teardownInput() which iterates
              // getInputBindings() and calls .off() for each. The base class
              // handles this — we just verify the scene has shutdown (already checked).
            } else {
              // Direct scene: each keyboard .on() in the file needs a .off() in shutdown
              const onCalls = extractKeyboardOnCalls(source);
              const offCalls = extractKeyboardOffCalls(source);
              const offSet = new Set(offCalls);

              for (const eventName of onCalls) {
                if (!offSet.has(eventName)) {
                  throw new Error(
                    `${sceneFile.name} registers keyboard listener '${eventName}' but shutdown() does not call .off('${eventName}')`
                  );
                }
              }
            }
          }

          // Check EventBus subscription cleanup
          if (registrations.hasEventBusListeners) {
            const busOnCalls = extractEventBusOnCalls(source);
            const busOffCalls = extractEventBusOffCalls(source);
            const offSet = new Set(busOffCalls);

            for (const eventName of busOnCalls) {
              if (!offSet.has(eventName)) {
                throw new Error(
                  `${sceneFile.name} subscribes to EventBus event '${eventName}' but does not call EventBus.off('${eventName}')`
                );
              }
            }
          }

          // Check that shutdown nulls owned references (= null or = [] assignments)
          // Only for scenes that directly define shutdown (not just inherited)
          const shutdownBody = extractShutdownBody(source);
          if (shutdownBody) {
            if (!hasReferenceCleanup(shutdownBody)) {
              throw new Error(
                `${sceneFile.name} has a shutdown() method but does not clean up any owned references (no '= null' or '= []' assignments found)`
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

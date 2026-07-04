/**
 * @fileoverview Unit tests for the default Minigame_Controller registration.
 *
 * Covers Requirement 11:
 *  - R11.3 each committed Minigame_Definition id maps to its controller class;
 *  - R11.4 registration lives in a single manifest so the four prototype
 *    controllers register onto any MinigameRegistry without framework-core edits.
 *
 * The mapping is also checked against the authored definition JSON files so the
 * manifest ids can never silently drift from the definitions that ship.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import MinigameRegistry from '../src/rhythm/minigames/MinigameRegistry.js';
import createDefaultMinigameRegistry, {
  createDefaultMinigameRegistry as namedCreate,
  registerDefaultMinigames,
  MINIGAME_CONTROLLERS
} from '../src/rhythm/minigames/defaultMinigameRegistry.js';
import TapClapGame from '../src/rhythm/minigames/TapClapGame.js';
import FillBotGame from '../src/rhythm/minigames/FillBotGame.js';
import ReleaseGame from '../src/rhythm/minigames/ReleaseGame.js';
import FlickRallyGame from '../src/rhythm/minigames/FlickRallyGame.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINIGAMES_DIR = path.resolve(__dirname, '../assets/data/rhythm/minigames');

/**
 * The expected id -> controller class mapping for the four prototype minigames.
 * @type {Array<[string, Function]>}
 */
const EXPECTED = [
  ['tap-clap', TapClapGame],
  ['fill-bot', FillBotGame],
  ['release-cue', ReleaseGame],
  ['flick-rally', FlickRallyGame]
];

describe('defaultMinigameRegistry exports', () => {
  it('default export equals the named createDefaultMinigameRegistry export', () => {
    expect(namedCreate).toBe(createDefaultMinigameRegistry);
  });

  it('exposes registerDefaultMinigames as a function', () => {
    expect(typeof registerDefaultMinigames).toBe('function');
  });

  it('MINIGAME_CONTROLLERS is frozen so the manifest cannot mutate at runtime', () => {
    expect(Object.isFrozen(MINIGAME_CONTROLLERS)).toBe(true);
  });
});

describe('id -> controller class mapping (R11.3)', () => {
  it('createDefaultMinigameRegistry maps every id to its controller class', () => {
    const registry = createDefaultMinigameRegistry();
    for (const [id, controllerClass] of EXPECTED) {
      expect(registry.getControllerClass(id)).toBe(controllerClass);
    }
  });

  it('registers exactly the four prototype controllers', () => {
    expect(Object.keys(MINIGAME_CONTROLLERS).sort()).toEqual(EXPECTED.map(([id]) => id).sort());
    for (const [id, controllerClass] of EXPECTED) {
      expect(MINIGAME_CONTROLLERS[id]).toBe(controllerClass);
    }
  });

  it('returns undefined for an unregistered id', () => {
    const registry = createDefaultMinigameRegistry();
    expect(registry.getControllerClass('does-not-exist')).toBeUndefined();
  });
});

describe('registerDefaultMinigames (R11.4)', () => {
  it('populates a caller-provided registry without framework-core edits', () => {
    const registry = new MinigameRegistry();
    const returned = registerDefaultMinigames(registry);

    // Returns the same instance for chaining.
    expect(returned).toBe(registry);
    for (const [id, controllerClass] of EXPECTED) {
      expect(registry.getControllerClass(id)).toBe(controllerClass);
    }
  });

  it('throws when given something that is not a MinigameRegistry', () => {
    expect(() => registerDefaultMinigames(null)).toThrow(/expected a MinigameRegistry/);
    expect(() => registerDefaultMinigames({})).toThrow(/expected a MinigameRegistry/);
  });
});

describe('manifest ids match the committed definition JSON ids', () => {
  it('every manifest id has a matching definition whose id resolves to the class', () => {
    for (const [id, controllerClass] of EXPECTED) {
      const file = path.join(MINIGAMES_DIR, `${id}.json`);
      expect(fs.existsSync(file), `expected ${id}.json to exist`).toBe(true);

      const def = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(def.id, `${id}.json id field`).toBe(id);
      expect(MINIGAME_CONTROLLERS[def.id]).toBe(controllerClass);
    }
  });
});

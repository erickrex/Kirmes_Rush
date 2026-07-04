/**
 * @fileoverview Unit tests for MinigameRegistry and dispatchCueAction.
 *
 * Covers Requirement 11:
 *  - R11.1 schema validation of a Minigame_Definition;
 *  - R11.2 field-level errors for invalid definitions;
 *  - R11.3 id -> controller class mapping (register/getControllerClass);
 *  - loadDefinition fetch + validate + store (with injected fetchImpl);
 *  - R11.6 dispatchCueAction descriptive missing-method error + correct dispatch.
 */

import { describe, it, expect, vi } from 'vitest';
import MinigameRegistry, {
  MinigameRegistry as NamedRegistry,
  dispatchCueAction
} from '../src/rhythm/minigames/MinigameRegistry.js';

/**
 * Build a minimal valid Minigame_Definition. Callers override fields to make it
 * invalid in a single, targeted way.
 * @param {Object} [overrides] - Partial fields to merge over the valid base.
 * @returns {Object} A definition object.
 */
function makeValidDefinition(overrides = {}) {
  return {
    id: 'tap-clap',
    name: 'Tap Clap',
    bpm: 120,
    input: { allowedGestures: ['tap'] },
    timeline: [],
    ...overrides
  };
}

describe('MinigameRegistry exports', () => {
  it('default export equals the named export', () => {
    expect(NamedRegistry).toBe(MinigameRegistry);
  });

  it('exposes dispatchCueAction as a function', () => {
    expect(typeof dispatchCueAction).toBe('function');
  });
});

describe('MinigameRegistry.validate (R11.1 / R11.2)', () => {
  it('accepts a complete valid definition (bpm tempo source)', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a definition using a song reference instead of bpm', () => {
    const registry = new MinigameRegistry();
    const def = makeValidDefinition({ bpm: undefined, song: { id: 'song-1' } });
    const result = registry.validate(def);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns a single "definition:" error for a non-object', () => {
    const registry = new MinigameRegistry();
    for (const value of [null, undefined, 42, 'nope', true]) {
      const result = registry.validate(value);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['definition: expected an object']);
    }
  });

  it('reports an "id:" field error when id is missing/invalid', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ id: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('id:'))).toBe(true);
  });

  it('reports a "name:" field error when name is missing/invalid', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ name: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('name:'))).toBe(true);
  });

  it('reports a "bpm|song:" field error when neither tempo source is present', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ bpm: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('bpm|song:'))).toBe(true);
  });

  it('rejects a non-positive bpm with no song fallback', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ bpm: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('bpm|song:'))).toBe(true);
  });

  it('reports an "input:" error when input is missing', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ input: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('input:'))).toBe(true);
  });

  it('reports "input.allowedGestures:" when not an array', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ input: { allowedGestures: 'tap' } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('input.allowedGestures:'))).toBe(true);
  });

  it('reports "input.allowedGestures:" when empty', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ input: { allowedGestures: [] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('input.allowedGestures:'))).toBe(true);
  });

  it('reports "input.allowedGestures:" when an entry is not a non-empty string', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(
      makeValidDefinition({ input: { allowedGestures: ['tap', ''] } })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('input.allowedGestures:'))).toBe(true);
  });

  it('reports a "timeline:" field error when timeline is not an array', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate(makeValidDefinition({ timeline: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('timeline:'))).toBe(true);
  });

  it('accumulates all field errors for a fully-invalid definition', () => {
    const registry = new MinigameRegistry();
    const result = registry.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('id:'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('name:'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('bpm|song:'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('input:'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('timeline:'))).toBe(true);
  });
});

describe('MinigameRegistry id -> class mapping (R11.3)', () => {
  class TapClapController {}

  it('register/getControllerClass round-trips', () => {
    const registry = new MinigameRegistry();
    registry.register('tap-clap', TapClapController);
    expect(registry.getControllerClass('tap-clap')).toBe(TapClapController);
  });

  it('getControllerClass returns undefined for an unknown id', () => {
    const registry = new MinigameRegistry();
    expect(registry.getControllerClass('missing')).toBeUndefined();
  });

  it('throws when registering with an invalid id', () => {
    const registry = new MinigameRegistry();
    expect(() => registry.register('', TapClapController)).toThrow(/id must be a non-empty string/);
  });

  it('throws when registering a non-function controller', () => {
    const registry = new MinigameRegistry();
    expect(() => registry.register('tap-clap', {})).toThrow(/must be a class\/function/);
  });
});

describe('MinigameRegistry.loadDefinition (R11.1 / R11.2)', () => {
  it('validates and stores a valid definition via injected fetchImpl', async () => {
    const registry = new MinigameRegistry();
    const def = makeValidDefinition();
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe('assets/data/rhythm/minigames/tap-clap.json');
      return { ok: true, json: async () => def };
    });

    const loaded = await registry.loadDefinition('tap-clap', fetchImpl);
    expect(loaded).toEqual(def);
    expect(registry.getDefinition('tap-clap')).toEqual(def);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws a descriptive error when the definition is invalid', async () => {
    const registry = new MinigameRegistry();
    const badDef = makeValidDefinition({ name: '' });
    const fetchImpl = async () => ({ ok: true, json: async () => badDef });

    await expect(registry.loadDefinition('tap-clap', fetchImpl)).rejects.toThrow(
      /invalid definition "tap-clap".*name:/
    );
    expect(registry.getDefinition('tap-clap')).toBeUndefined();
  });

  it('throws a descriptive error when the fetch response is not ok', async () => {
    const registry = new MinigameRegistry();
    const fetchImpl = async () => ({ ok: false, status: 404 });

    await expect(registry.loadDefinition('tap-clap', fetchImpl)).rejects.toThrow(
      /failed to fetch .*tap-clap\.json.*status 404/
    );
  });

  it('throws when no fetch implementation is available', async () => {
    const registry = new MinigameRegistry();
    // Remove any ambient global fetch so the fallback path is exercised.
    const originalFetch = globalThis.fetch;

    globalThis.fetch = undefined;
    try {
      await expect(registry.loadDefinition('tap-clap', null)).rejects.toThrow(
        /no fetch implementation available/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when id is not a non-empty string', async () => {
    const registry = new MinigameRegistry();
    await expect(registry.loadDefinition('', async () => ({}))).rejects.toThrow(
      /id must be a non-empty string/
    );
  });
});

describe('dispatchCueAction (R11.6)', () => {
  it('dispatches to an existing method and returns its value', () => {
    const controller = {
      onPerfect(payload) {
        return `perfect:${payload?.cueId ?? ''}`;
      }
    };
    const result = dispatchCueAction(controller, 'onPerfect', { cueId: 'c1' });
    expect(result).toBe('perfect:c1');
  });

  it('invokes the method with the controller as `this`', () => {
    const controller = {
      value: 7,
      readValue() {
        return this.value;
      }
    };
    expect(dispatchCueAction(controller, 'readValue')).toBe(7);
  });

  it('throws naming the missing method and controller class', () => {
    class TapClapController {}
    const controller = new TapClapController();
    expect(() => dispatchCueAction(controller, 'onGhost')).toThrow(
      'dispatchCueAction: TapClapController has no method "onGhost"'
    );
  });

  it('includes the cue id from payload.cueId in the missing-method error', () => {
    const controller = {};
    expect(() => dispatchCueAction(controller, 'onGood', { cueId: 'cue-42' })).toThrow(
      /has no method "onGood" \(cue "cue-42"\)/
    );
  });

  it('includes the cue id from payload.id when cueId is absent', () => {
    const controller = {};
    expect(() => dispatchCueAction(controller, 'onGood', { id: 'cue-7' })).toThrow(
      /has no method "onGood" \(cue "cue-7"\)/
    );
  });

  it('throws when there is no controller to dispatch to', () => {
    expect(() => dispatchCueAction(null, 'onPerfect')).toThrow(
      /no controller to dispatch action "onPerfect"/
    );
  });
});

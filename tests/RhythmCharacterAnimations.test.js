/**
 * @fileoverview Unit tests for RhythmCharacterAnimations - the helper that
 * registers Phaser animations for the rhythm characters from the committed
 * Sparrow atlases (idle/cheer/hey), namespaced per atlas.
 *
 * Deterministic + headless: a stub scene provides `textures.get(...).getFrameNames`
 * and `anims.create`/`anims.exists`, so no real Phaser is required. Verifies
 * key namespacing, frame selection (including the digit-suffix filter that keeps
 * overlapping prefixes apart), idempotency, and graceful no-ops.
 */

import { describe, it, expect, vi } from 'vitest';
import registerRhythmCharacterAnims, {
  registerRhythmCharacterAnims as namedRegister,
  rhythmAnimKey,
  RHYTHM_POSES
} from '../src/rhythm/minigames/RhythmCharacterAnimations.js';

/**
 * Build a stub scene whose atlas exposes `frameNames` and that records created
 * animations in a map keyed by animation key.
 * @param {Record<string, string[]>} framesByAtlas - Frame names per atlas key.
 * @returns {Object} The stub scene plus a `created` Map of registered anims.
 */
function createMockScene(framesByAtlas) {
  const created = new Map();
  return {
    created,
    textures: {
      exists: vi.fn((key) => Object.prototype.hasOwnProperty.call(framesByAtlas, key)),
      get: vi.fn((key) => ({
        getFrameNames: () => framesByAtlas[key] ?? []
      }))
    },
    anims: {
      exists: vi.fn((key) => created.has(key)),
      create: vi.fn((config) => {
        created.set(config.key, config);
        return config;
      })
    }
  };
}

/** Zero-padded Sparrow frame names for a prefix, e.g. bfFrames('BF HEY!!', 3). */
function frames(prefix, count) {
  return Array.from({ length: count }, (_, i) => `${prefix}${String(i).padStart(4, '0')}`);
}

describe('rhythmAnimKey', () => {
  it('namespaces the key by atlas and pose', () => {
    expect(rhythmAnimKey('bf', 'idle')).toBe('rhythm-bf-idle');
    expect(rhythmAnimKey('gf', 'cheer')).toBe('rhythm-gf-cheer');
    expect(rhythmAnimKey('dad', 'hey')).toBe('rhythm-dad-hey');
  });
});

describe('registerRhythmCharacterAnims', () => {
  it('exposes the default and named exports as the same function', () => {
    expect(namedRegister).toBe(registerRhythmCharacterAnims);
  });

  it('offers exactly idle/cheer/hey poses', () => {
    expect([...RHYTHM_POSES]).toEqual(['idle', 'cheer', 'hey']);
  });

  it('registers idle/cheer/hey for bf from its committed frames', () => {
    const scene = createMockScene({
      bf: [...frames('BF idle dance', 10), ...frames('BF HEY!!', 5)]
    });

    const keys = registerRhythmCharacterAnims(scene, 'bf');

    expect(keys).toEqual(['rhythm-bf-idle', 'rhythm-bf-cheer', 'rhythm-bf-hey']);
    const idle = scene.created.get('rhythm-bf-idle');
    expect(idle.frames).toHaveLength(10);
    expect(idle.frames[0]).toEqual({ key: 'bf', frame: 'BF idle dance0000' });
    expect(idle.repeat).toBe(-1); // idle loops
    // cheer/hey both come from BF HEY!! frames for bf.
    expect(scene.created.get('rhythm-bf-cheer').frames).toHaveLength(5);
    expect(scene.created.get('rhythm-bf-hey').repeat).toBe(0); // hey is one-shot
  });

  it('does not let an overlapping prefix bleed into another animation', () => {
    // "GF Dancing Beat" must not swallow "GF Dancing Beat Hair blowing" frames.
    const scene = createMockScene({
      gf: [
        ...frames('GF Dancing Beat', 4),
        ...frames('GF Dancing Beat Hair blowing', 4),
        ...frames('GF Cheer', 6)
      ]
    });

    registerRhythmCharacterAnims(scene, 'gf');

    const idle = scene.created.get('rhythm-gf-idle');
    expect(idle.frames).toHaveLength(4);
    for (const f of idle.frames) {
      expect(f.frame.startsWith('GF Dancing Beat Hair')).toBe(false);
    }
    expect(scene.created.get('rhythm-gf-cheer').frames).toHaveLength(6);
  });

  it('maps dad cheer/hey to its sing frames', () => {
    const scene = createMockScene({
      dad: [...frames('idle', 4), ...frames('singUP', 4)]
    });

    registerRhythmCharacterAnims(scene, 'dad');

    expect(scene.created.get('rhythm-dad-idle').frames[0].frame).toBe('idle0000');
    expect(scene.created.get('rhythm-dad-cheer').frames[0].frame).toBe('singUP0000');
    expect(scene.created.get('rhythm-dad-hey').frames[0].frame).toBe('singUP0000');
  });

  it('skips a pose whose frames are absent', () => {
    const scene = createMockScene({ bf: frames('BF idle dance', 4) }); // no HEY frames
    const keys = registerRhythmCharacterAnims(scene, 'bf');
    expect(keys).toEqual(['rhythm-bf-idle']);
    expect(scene.created.has('rhythm-bf-cheer')).toBe(false);
  });

  it('is idempotent - a second call creates nothing new', () => {
    const scene = createMockScene({
      bf: [...frames('BF idle dance', 4), ...frames('BF HEY!!', 4)]
    });

    registerRhythmCharacterAnims(scene, 'bf');
    scene.anims.create.mockClear();
    const keys = registerRhythmCharacterAnims(scene, 'bf');

    expect(scene.anims.create).not.toHaveBeenCalled();
    expect(keys).toEqual(['rhythm-bf-idle', 'rhythm-bf-cheer', 'rhythm-bf-hey']);
  });

  it('returns empty for an unknown atlas', () => {
    const scene = createMockScene({ bf: frames('BF idle dance', 4) });
    expect(registerRhythmCharacterAnims(scene, 'unknown')).toEqual([]);
    expect(scene.anims.create).not.toHaveBeenCalled();
  });

  it('no-ops when the atlas texture is not loaded', () => {
    const scene = createMockScene({});
    expect(registerRhythmCharacterAnims(scene, 'bf')).toEqual([]);
  });

  it('no-ops on a headless scene without anims/textures managers', () => {
    expect(registerRhythmCharacterAnims({}, 'bf')).toEqual([]);
    expect(registerRhythmCharacterAnims({ anims: {}, textures: {} }, 'bf')).toEqual([]);
  });
});

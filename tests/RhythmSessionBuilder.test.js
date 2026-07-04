/**
 * @fileoverview Unit tests for RhythmSessionBuilder (task 14).
 *
 * Verifies the Phaser-free helpers that turn a validated Minigame_Definition +
 * controller class into the loader manifest and RhythmSession that
 * `LoadingState.prepareCallback` returns (R12.3, R12.4, R13.1).
 */

import { describe, it, expect } from 'vitest';
import {
  instrumentalKeyFor,
  instrumentalPathFor,
  toLoadingAssetEntry,
  buildAssetManifest,
  buildClockConfig,
  buildAudioRefs,
  buildRhythmSession,
  buildRhythmPrepareCallback
} from '../src/rhythm/data/RhythmSessionBuilder.js';
import RhythmSession from '../src/rhythm/core/RhythmSession.js';

/** A minimal but representative tap definition. */
function makeDefinition(overrides = {}) {
  return {
    version: '1.0.0',
    id: 'tap-clap',
    name: 'Tap Clap',
    movementType: 'tap',
    song: { id: 'tutorial' },
    bpm: 100,
    assets: [
      {
        type: 'atlas',
        key: 'bf',
        texture: 'assets/rythm-foundation.assets/shared/images/characters/BOYFRIEND.png',
        atlas: 'assets/rythm-foundation.assets/shared/images/characters/BOYFRIEND.xml'
      },
      {
        type: 'image',
        key: 'popup-sick',
        path: 'assets/rythm-foundation.assets/preload/images/ui/popup/rythm/sick.png'
      }
    ],
    input: { allowedGestures: ['tap'], flickDirections: [] },
    scoring: { windowMs: { perfect: 45, good: 90, barely: 140 }, bands: { superb: 0.9, ok: 0.6 } },
    timeline: [{ id: 'clap-1', type: 'expect', beat: 4, gesture: 'tap', targetBeat: 4 }],
    ...overrides
  };
}

class FakeController {}

describe('RhythmSessionBuilder', () => {
  describe('instrumental key/path resolution', () => {
    it('derives a stable instrumental cache key from the song id', () => {
      expect(instrumentalKeyFor('tutorial')).toBe('rhythm-inst-tutorial');
    });

    it('resolves the instrumental path under the shared asset root', () => {
      expect(instrumentalPathFor('tutorial')).toBe(
        'assets/rythm-foundation.assets/songs/tutorial/Inst.ogg'
      );
    });
  });

  describe('toLoadingAssetEntry', () => {
    it('maps an atlas descriptor to path + atlasURL', () => {
      const entry = toLoadingAssetEntry({
        type: 'atlas',
        key: 'bf',
        texture: 'a/bf.png',
        atlas: 'a/bf.xml'
      });
      expect(entry).toEqual({ type: 'atlas', key: 'bf', path: 'a/bf.png', atlasURL: 'a/bf.xml' });
    });

    it('maps an image descriptor to a path entry', () => {
      const entry = toLoadingAssetEntry({ type: 'image', key: 'popup', path: 'a/p.png' });
      expect(entry).toEqual({ type: 'image', key: 'popup', path: 'a/p.png' });
    });

    it('returns null for unmappable descriptors', () => {
      expect(toLoadingAssetEntry(null)).toBeNull();
      expect(toLoadingAssetEntry({ type: 'atlas', key: 'x' })).toBeNull();
      expect(toLoadingAssetEntry({ type: 'weird', key: 'x', path: 'p' })).toBeNull();
    });
  });

  describe('buildAssetManifest', () => {
    it('includes every definition asset plus the backing instrumental', () => {
      const manifest = buildAssetManifest(makeDefinition());
      const keys = manifest.map((e) => e.key);
      expect(keys).toContain('bf');
      expect(keys).toContain('popup-sick');
      expect(keys).toContain('rhythm-inst-tutorial');

      const inst = manifest.find((e) => e.key === 'rhythm-inst-tutorial');
      expect(inst).toEqual({
        type: 'audio',
        key: 'rhythm-inst-tutorial',
        path: 'assets/rythm-foundation.assets/songs/tutorial/Inst.ogg'
      });
    });

    it('does not duplicate the instrumental when the definition already declares it', () => {
      const def = makeDefinition({
        assets: [
          { type: 'audio', key: 'rhythm-inst-tutorial', path: 'custom/Inst.ogg' }
        ]
      });
      const manifest = buildAssetManifest(def);
      const instEntries = manifest.filter((e) => e.key === 'rhythm-inst-tutorial');
      expect(instEntries).toHaveLength(1);
      expect(instEntries[0].path).toBe('custom/Inst.ogg');
    });
  });

  describe('buildClockConfig / buildAudioRefs', () => {
    it('sources bpm from the definition and defaults offset to 0', () => {
      expect(buildClockConfig(makeDefinition())).toEqual({ bpm: 100, offsetMs: 0 });
    });

    it('falls back to a default bpm when none is declared', () => {
      expect(buildClockConfig(makeDefinition({ bpm: undefined })).bpm).toBe(120);
    });

    it('resolves audio refs from the song id', () => {
      expect(buildAudioRefs(makeDefinition())).toEqual({
        instrumentalKey: 'rhythm-inst-tutorial',
        instrumentalPath: 'assets/rythm-foundation.assets/songs/tutorial/Inst.ogg',
        songId: 'tutorial'
      });
    });
  });

  describe('buildRhythmSession', () => {
    it('assembles a RhythmSession with the resolved fields and controller class', () => {
      const def = makeDefinition();
      const session = buildRhythmSession(def, FakeController);

      expect(session).toBeInstanceOf(RhythmSession);
      expect(session.definition).toBe(def);
      expect(session.timeline).toBe(def.timeline);
      expect(session.clockConfig).toEqual({ bpm: 100, offsetMs: 0 });
      expect(session.audio.instrumentalKey).toBe('rhythm-inst-tutorial');
      expect(session.scoring).toBe(def.scoring);
      expect(session.controllerClass).toBe(FakeController);
      expect(session.id).toBe('tap-clap');
      expect(session.movementType).toBe('tap');
    });
  });

  describe('buildRhythmPrepareCallback', () => {
    it('returns assets + RhythmScene + session data for LoadingState', async () => {
      const def = makeDefinition();
      const prepared = await buildRhythmPrepareCallback(def, FakeController)();

      expect(prepared.nextScene).toBe('RhythmScene');
      expect(prepared.assets.map((a) => a.key)).toContain('rhythm-inst-tutorial');
      expect(prepared.nextSceneData.session).toBeInstanceOf(RhythmSession);
      expect(prepared.nextSceneData.session.controllerClass).toBe(FakeController);
    });
  });
});

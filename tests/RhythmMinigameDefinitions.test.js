/**
 * @fileoverview Unit tests for the committed Minigame_Definition JSON documents
 * (task 11 of the rhythm-minigame-prototype spec).
 *
 * Asserts, for each of the four movement-type definitions:
 *  - the file parses as JSON;
 *  - it passes MinigameRegistry.validate() (R11.1);
 *  - its `song.id` resolves to a real committed instrumental + metadata file on
 *    disk (R13.1/R13.2);
 *  - every referenced asset path (atlas texture/xml, image) exists on disk (R13).
 *
 * **Validates: Requirements 11.1, 13.1, 13.2, 13.4**
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MinigameRegistry from '../src/rhythm/minigames/MinigameRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MINIGAMES_DIR = path.resolve(REPO_ROOT, 'assets/data/rhythm/minigames');
const FOUNDATION_DIR = path.resolve(REPO_ROOT, 'assets/rythm-foundation.assets');

const DEFINITION_IDS = ['tap-clap', 'fill-bot', 'release-cue', 'flick-rally'];

/**
 * Read + parse a committed Minigame_Definition JSON by id.
 * @param {string} id - Minigame identifier / file base name.
 * @returns {{ raw: string, parsed: import('../src/types.js').MinigameDefinition }}
 */
function readDefinition(id) {
  const file = path.join(MINIGAMES_DIR, `${id}.json`);
  const raw = fs.readFileSync(file, 'utf-8');
  return { raw, parsed: JSON.parse(raw) };
}

/**
 * Resolve a committed song id to the on-disk instrumental audio candidates and
 * its metadata document, per the design's Song → asset mapping.
 * @param {string} songId - Backing song id from `def.song.id`.
 * @returns {{ oggPath: string, mp3Path: string, metadataPath: string }}
 */
function songPaths(songId) {
  return {
    oggPath: path.join(FOUNDATION_DIR, 'songs', songId, 'Inst.ogg'),
    mp3Path: path.join(FOUNDATION_DIR, 'songs', songId, 'Inst.mp3'),
    metadataPath: path.join(
      FOUNDATION_DIR,
      'preload/data/songs',
      songId,
      `${songId}-metadata.json`
    )
  };
}

const registry = new MinigameRegistry();

describe('Rhythm minigame definitions (task 11)', () => {
  it('authored exactly the four movement-type definitions', () => {
    const present = fs
      .readdirSync(MINIGAMES_DIR)
      .filter((n) => n.toLowerCase().endsWith('.json'))
      .map((n) => n.replace(/\.json$/i, ''))
      .sort();
    expect(present).toEqual([...DEFINITION_IDS].sort());
  });

  describe.each(DEFINITION_IDS)('%s.json', (id) => {
    it('parses as valid JSON', () => {
      expect(() => readDefinition(id)).not.toThrow();
    });

    it('has the expected id and passes MinigameRegistry.validate()', () => {
      const { parsed } = readDefinition(id);
      expect(parsed.id).toBe(id);
      const { valid, errors } = registry.validate(parsed);
      expect(valid, errors.join('; ')).toBe(true);
    });

    it('references a backing song that resolves to committed audio + metadata', () => {
      const { parsed } = readDefinition(id);
      expect(parsed.song, 'definition must carry a song reference').toBeTruthy();
      const songId = parsed.song.id;
      expect(typeof songId).toBe('string');

      const { oggPath, mp3Path, metadataPath } = songPaths(songId);
      // At least one committed instrumental encoding must exist.
      expect(
        fs.existsSync(oggPath) || fs.existsSync(mp3Path),
        `expected committed Inst.ogg/.mp3 for song "${songId}"`
      ).toBe(true);
      expect(
        fs.existsSync(metadataPath),
        `expected committed metadata for song "${songId}"`
      ).toBe(true);
    });

    it('declares a bpm consistent with the song metadata', () => {
      const { parsed } = readDefinition(id);
      const { metadataPath } = songPaths(parsed.song.id);
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      const metaBpm = metadata.timeChanges?.[0]?.bpm;
      expect(parsed.bpm).toBe(metaBpm);
    });

    it('references only asset files that exist on disk', () => {
      const { parsed } = readDefinition(id);
      const assets = parsed.assets ?? [];
      for (const asset of assets) {
        const candidatePaths = [asset.texture, asset.atlas, asset.path].filter(Boolean);
        expect(
          candidatePaths.length,
          `asset "${asset.key}" must declare a path`
        ).toBeGreaterThan(0);
        for (const rel of candidatePaths) {
          const abs = path.resolve(REPO_ROOT, rel);
          expect(fs.existsSync(abs), `missing asset file: ${rel}`).toBe(true);
        }
      }
    });
  });

  it('tap-clap restricts gestures to tap', () => {
    const { parsed } = readDefinition('tap-clap');
    expect(parsed.movementType).toBe('tap');
    expect(parsed.input.allowedGestures).toEqual(['tap']);
  });

  it('fill-bot allows hold+release and carries a targetSpanBeats hold expectation', () => {
    const { parsed } = readDefinition('fill-bot');
    expect(parsed.movementType).toBe('hold');
    expect(parsed.input.allowedGestures).toEqual(expect.arrayContaining(['hold', 'release']));
    const holdExpect = parsed.timeline.find(
      (e) => e.type === 'expect' && e.gesture === 'hold'
    );
    expect(holdExpect).toBeTruthy();
    expect(typeof holdExpect.targetSpanBeats).toBe('number');
  });

  it('release-cue allows hold+release and targets a release beat', () => {
    const { parsed } = readDefinition('release-cue');
    expect(parsed.movementType).toBe('release');
    expect(parsed.input.allowedGestures).toEqual(expect.arrayContaining(['hold', 'release']));
    const releaseExpect = parsed.timeline.find(
      (e) => e.type === 'expect' && e.gesture === 'release'
    );
    expect(releaseExpect).toBeTruthy();
    expect(typeof releaseExpect.targetBeat).toBe('number');
  });

  it('flick-rally restricts gestures to flick with a declared direction', () => {
    const { parsed } = readDefinition('flick-rally');
    expect(parsed.movementType).toBe('flick');
    expect(parsed.input.allowedGestures).toEqual(['flick']);
    expect(parsed.input.flickDirections.length).toBeGreaterThan(0);
    const flickExpect = parsed.timeline.find(
      (e) => e.type === 'expect' && e.gesture === 'flick'
    );
    expect(flickExpect).toBeTruthy();
    expect(flickExpect.direction).toBe('up');
  });
});

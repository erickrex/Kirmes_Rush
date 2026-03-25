/**
 * @fileoverview Release-path integration smoke tests for the 5-level build.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  Events: {
    LEVEL_LOADED: 'levelLoaded'
  }
}));

import LevelSystem from '../../src/levels/LevelSystem.js';
import LevelSessionBuilder from '../../src/levels/LevelSessionBuilder.js';
import { buildManifest } from '../../src/levels/AssetManifestBuilder.js';
import CharacterRegistry from '../../src/data/registries/CharacterRegistry.js';
import StageRegistry from '../../src/data/registries/StageRegistry.js';
import NoteStyleRegistry from '../../src/data/registries/NoteStyleRegistry.js';

function resolveWorkspaceFile(requestPath) {
  const relativePath = String(requestPath).replace(/^\.\//, '');
  const cwd = process.cwd();

  return relativePath.startsWith('data/')
    ? path.resolve(cwd, 'assets', relativePath)
    : path.resolve(cwd, '..', relativePath);
}

function createFileBackedFetch() {
  return async (requestPath) => {
    const filePath = resolveWorkspaceFile(requestPath);

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return {
        ok: true,
        status: 200,
        async json() {
          return JSON.parse(raw);
        }
      };
    } catch {
      return {
        ok: false,
        status: 404,
        async json() {
          throw new Error(`Missing fixture for ${requestPath}`);
        }
      };
    }
  };
}

async function primeRegistryEntries(registry, entryIds) {
  registry.clearEntries();

  for (const entryId of entryIds) {
    const filePath = resolveWorkspaceFile(`${registry.dataFilePath}/${entryId}.json`);
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const data = registry.parseEntryDataRaw(raw, `${entryId}.json`);
    expect(data).not.toBeNull();

    const entry = registry.createEntry(entryId, data);
    expect(entry).not.toBeNull();
    registry.entries.set(entry.id, entry);
  }

  registry.loaded = true;
}

describe('5-Level Release Data Flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createFileBackedFetch());
    CharacterRegistry.instance = null;
    StageRegistry.instance = null;
    NoteStyleRegistry.instance = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    CharacterRegistry.instance = null;
    StageRegistry.instance = null;
    NoteStyleRegistry.instance = null;
  });

  it('loads the five shipped level manifests from real app data', async () => {
    const levelSystem = new LevelSystem();
    const loaded = await levelSystem.loadManifests();

    expect(loaded).toBe(true);
    expect(levelSystem.getAllLevels().map((level) => level.id)).toEqual([
      'level-1-basics',
      'level-2-rhythm',
      'level-3-performance',
      'level-4-challenge',
      'level-5-mastery'
    ]);
  });

  it('builds prepared sessions and expands assets according to the release feature matrix', async () => {
    const builder = new LevelSessionBuilder({ fetchImpl: createFileBackedFetch() });
    const sessions = await Promise.all(LevelSystem.LEVEL_IDS.map((levelId) => builder.build(levelId)));

    const characterIds = [...new Set(
      sessions.flatMap((session) => ['player', 'opponent', 'girlfriend']
        .map((slot) => session.songData.characters?.[slot])
        .filter((characterId) => typeof characterId === 'string' && characterId.length > 0))
    )];
    const stageIds = [...new Set(
      sessions
        .map((session) => session.songData.stage)
        .filter((stageId) => typeof stageId === 'string' && stageId.length > 0)
    )];
    const noteStyleIds = [...new Set(
      sessions
        .map((session) => session.songData.noteStyle)
        .filter((noteStyleId) => typeof noteStyleId === 'string' && noteStyleId.length > 0)
    )];

    const characterRegistry = CharacterRegistry.getInstance();
    const stageRegistry = StageRegistry.getInstance();
    const noteStyleRegistry = NoteStyleRegistry.getInstance();

    await Promise.all([
      primeRegistryEntries(characterRegistry, characterIds),
      primeRegistryEntries(stageRegistry, stageIds),
      primeRegistryEntries(noteStyleRegistry, noteStyleIds)
    ]);

    const manifestsByLevel = new Map(
      sessions.map((session) => [
        session.level.id,
        buildManifest(session, { characterRegistry, stageRegistry, noteStyleRegistry })
      ])
    );

    for (const session of sessions) {
      expect(session).toEqual(expect.objectContaining({
        level: expect.any(Object),
        difficulty: expect.any(String),
        chart: expect.any(Object),
        songData: expect.any(Object),
        audio: expect.any(Object),
        assets: expect.any(Array),
        metadata: expect.any(Object)
      }));
      expect(session.assets.some((entry) => entry.type === 'audio')).toBe(true);
    }

    const level1 = sessions.find((session) => session.level.id === 'level-1-basics');
    const level2 = sessions.find((session) => session.level.id === 'level-2-rhythm');
    const level3 = sessions.find((session) => session.level.id === 'level-3-performance');
    const level5 = sessions.find((session) => session.level.id === 'level-5-mastery');

    expect(level1.songData.stage).toBeNull();
    expect(level1.songData.characters).toEqual({});
    expect(level1.chart.notes.player.every((note) => note.length === 0)).toBe(true);
    expect(manifestsByLevel.get(level1.level.id).some((entry) => entry.key.startsWith('char-'))).toBe(false);
    expect(manifestsByLevel.get(level1.level.id).some((entry) => entry.key.startsWith('stage-'))).toBe(false);

    expect(level2.songData.stage).toBeNull();
    expect(level2.songData.characters).toEqual({});
    expect(manifestsByLevel.get(level2.level.id).some((entry) => entry.key.startsWith('char-'))).toBe(false);
    expect(manifestsByLevel.get(level2.level.id).some((entry) => entry.key.startsWith('stage-'))).toBe(false);

    expect(level3.songData.stage).toBe('mainStage');
    expect(level3.songData.characters).toEqual({
      player: 'bf',
      opponent: 'dad',
      girlfriend: 'gf'
    });
    expect(manifestsByLevel.get(level3.level.id).some((entry) => entry.key.startsWith('char-bf'))).toBe(true);
    expect(manifestsByLevel.get(level3.level.id).some((entry) => entry.key.startsWith('stage-mainStage-'))).toBe(true);

    expect(level5.level.features.replayRecording).toBe(true);
    expect(level5.level.features.inputBuffer).toBe(true);
    expect(manifestsByLevel.get(level5.level.id).some((entry) => entry.key.startsWith('char-'))).toBe(true);
    expect(manifestsByLevel.get(level5.level.id).some((entry) => entry.key.startsWith('stage-tankmanBattlefield-'))).toBe(true);
    expect(manifestsByLevel.get(level5.level.id).some((entry) => entry.key === 'notestyle-funkin-note')).toBe(true);
  });
});

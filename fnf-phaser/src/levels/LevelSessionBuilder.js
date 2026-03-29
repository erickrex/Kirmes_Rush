/**
 * @fileoverview Builds a playable level session from a level manifest + song assets.
 */

import ChartParser from '../data/parsers/ChartParser.js';
import LevelContentResolver, { fetchJson } from './LevelContentResolver.js';
import { createPreparedPlaySession } from './PreparedPlaySession.js';
import LevelSystem, { LevelManifest } from './LevelSystem.js';

/**
 * @param {Record<string, any>} note
 * @param {Record<string, any>} [features={}]
 * @returns {import('../types.js').NoteData}
 */
function normalizeNote(note, features = {}) {
  /** @type {import('../types.js').NoteData} */
  const normalized = {
    time: note.time ?? 0,
    data: note.data ?? 0,
    direction: ChartParser.getNoteDirection(note),
    length: note.length ?? 0,
    kind: note.kind ?? undefined,
    params: Array.isArray(note.params) ? [...note.params] : []
  };

  if (features.holdNotes === false) {
    normalized.length = 0;
  }

  return normalized;
}

/**
 * @param {Record<string, any>} song
 * @returns {{audio: Record<string, any>, entries: Array<Record<string, any>>}}
 */
function buildAudioEntries(song) {
  /** @type {Array<Record<string, any>>} */
  const entries = [];
  /** @type {Record<string, any>} */
  const audio = {
    instrumental: null,
    vocals: {
      combined: null,
      player: null,
      opponent: null
    }
  };

  if (song?.assets?.instrumental) {
    audio.instrumental = {
      key: `song-${song.id}-instrumental`,
      path: song.assets.instrumental
    };
    entries.push({ type: 'audio', key: audio.instrumental.key, path: audio.instrumental.path });
  }

  const vocals = song?.assets?.vocals;
  if (typeof vocals === 'string') {
    audio.vocals.combined = {
      key: `song-${song.id}-vocals`,
      path: vocals
    };
    entries.push({ type: 'audio', key: audio.vocals.combined.key, path: vocals });
  } else if (vocals && typeof vocals === 'object') {
    if (vocals.player) {
      audio.vocals.player = {
        key: `song-${song.id}-vocals-player`,
        path: vocals.player
      };
      entries.push({ type: 'audio', key: audio.vocals.player.key, path: vocals.player });
    }

    if (vocals.opponent) {
      audio.vocals.opponent = {
        key: `song-${song.id}-vocals-opponent`,
        path: vocals.opponent
      };
      entries.push({ type: 'audio', key: audio.vocals.opponent.key, path: vocals.opponent });
    }
  }

  return { audio, entries };
}

/**
 * @param {Record<string, any>} song
 * @param {Record<string, any>} metadata
 * @param {Record<string, any>} [features={}]
 * @returns {Record<string, any>}
 */
function buildCharacterConfig(song, metadata, features = {}) {
  if (features.characters === false) {
    return {};
  }

  const merged = {
    ...(song?.characters ?? {}),
    ...(metadata?.playData?.characters ?? {})
  };

  const characters = {
    player: typeof merged.player === 'string' ? merged.player : null,
    opponent: typeof merged.opponent === 'string' ? merged.opponent : null,
    girlfriend: typeof merged.girlfriend === 'string' ? merged.girlfriend : null
  };

  return Object.fromEntries(
    Object.entries(characters).filter(
      ([, characterId]) => typeof characterId === 'string' && characterId.length > 0
    )
  );
}

/**
 * Builds normalized gameplay sessions for the five progressive levels.
 */
export default class LevelSessionBuilder {
  /**
   * @param {{fetchImpl?: typeof fetch, resolver?: LevelContentResolver}} [options]
   */
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.resolver = options.resolver ?? new LevelContentResolver({ fetchImpl: this.fetchImpl });
  }

  /**
   * @param {string | Record<string, any>} levelInput
   * @returns {Promise<Record<string, any>>}
   */
  async build(levelInput) {
    const level = /** @type {Record<string, any>} */ (
      typeof levelInput === 'string' ? await this.loadLevel(levelInput) : levelInput
    );

    if (!level) {
      throw new Error('Level session build failed: level not found');
    }

    await this.resolver.load();
    const song = this.resolver.resolveSong(level.songId);

    if (!song) {
      throw new Error(`No song manifest entry found for level songId "${level.songId}"`);
    }

    const [metadataJson, chartJson] = await Promise.all([
      fetchJson(song.assets.metadata, this.fetchImpl),
      fetchJson(song.assets.chart, this.fetchImpl)
    ]);

    const metadata = ChartParser.parseMetadata(metadataJson) ?? metadataJson;
    const chartData = ChartParser.parseChart(chartJson) ?? chartJson;
    const difficulty = level.difficulty || 'normal';
    const rawNotes = ChartParser.getNotesForDifficulty(chartData, difficulty);
    const normalizedNotes = rawNotes.map((note) => normalizeNote(note, level.features));
    const separatedNotes = ChartParser.separateNotes(normalizedNotes);
    const { audio, entries } = buildAudioEntries(song);

    const songName = metadata.songName ?? song.name ?? level.name;
    const characters = buildCharacterConfig(song, metadata, level.features);
    const stageId =
      level.features?.stage === false ? null : (metadata.playData?.stage ?? song.stage ?? null);

    return createPreparedPlaySession({
      level,
      difficulty,
      chart: {
        timeChanges: metadata.timeChanges ?? [],
        events: chartData.events ?? [],
        scrollSpeed: ChartParser.getScrollSpeed(chartData, difficulty),
        notes: {
          player: separatedNotes.player,
          opponent: separatedNotes.opponent
        }
      },
      audio,
      assets: entries,
      metadata,
      songData: {
        id: song.id,
        name: songName,
        songName,
        difficulty,
        artist: metadata.artist ?? song.artist ?? 'Unknown',
        stage: stageId,
        noteStyle: metadata.playData?.noteStyle ?? null,
        characters,
        returnScene: 'LevelSelectState',
        returnSceneData: { selectedLevelId: level.id },
        levelId: level.id,
        manifestId: song.manifestId ?? null
      }
    });
  }

  /**
   * @param {string} levelId
   * @returns {Promise<Record<string, any> | null>}
   */
  async loadLevel(levelId) {
    const rawLevel = await fetchJson(`${LevelSystem.MANIFEST_PATH}${levelId}.json`, this.fetchImpl);
    const level = /** @type {Record<string, any> | null} */ (LevelManifest.parse(rawLevel));
    const validation = LevelManifest.validate(/** @type {any} */ (level));

    if (!validation.valid) {
      throw new Error(`Invalid level manifest for ${levelId}: ${validation.errors.join(', ')}`);
    }

    return level;
  }
}

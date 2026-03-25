/**
 * @fileoverview Builds a playable level session from a level manifest + song assets.
 */

import ChartParser from '../data/parsers/ChartParser.js';
import LevelContentResolver, { fetchJson } from './LevelContentResolver.js';
import LevelSystem, { LevelManifest } from './LevelSystem.js';

function normalizeNote(note, features = {}) {
  const normalized = {
    time: note.time ?? 0,
    data: note.data ?? 0,
    direction: ChartParser.getNoteDirection(note),
    length: note.length ?? 0,
    kind: note.kind ?? null,
    params: Array.isArray(note.params) ? [...note.params] : []
  };

  if (features.holdNotes === false) {
    normalized.length = 0;
  }

  return normalized;
}

function buildAudioEntries(song) {
  const entries = [];
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
   * @param {string | Object} levelInput
   * @returns {Promise<Object>}
   */
  async build(levelInput) {
    const level = typeof levelInput === 'string'
      ? await this.loadLevel(levelInput)
      : levelInput;

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

    const songName = song.name ?? metadata.songName ?? level.name;
    const characters = song.characters ?? metadata.playData?.characters ?? {};

    return {
      level,
      song,
      metadata,
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
      songData: {
        id: song.id,
        name: songName,
        songName,
        difficulty,
        artist: song.artist ?? metadata.artist ?? 'Unknown',
        stage: song.stage ?? metadata.playData?.stage ?? null,
        noteStyle: metadata.playData?.noteStyle ?? null,
        characters,
        returnScene: 'LevelSelectState',
        returnSceneData: { selectedLevelId: level.id },
        levelId: level.id
      }
    };
  }

  /**
   * @param {string} levelId
   * @returns {Promise<Object>}
   */
  async loadLevel(levelId) {
    const rawLevel = await fetchJson(`${LevelSystem.MANIFEST_PATH}${levelId}.json`, this.fetchImpl);
    const level = LevelManifest.parse(rawLevel);
    const validation = LevelManifest.validate(level);

    if (!validation.valid) {
      throw new Error(`Invalid level manifest for ${levelId}: ${validation.errors.join(', ')}`);
    }

    return level;
  }
}

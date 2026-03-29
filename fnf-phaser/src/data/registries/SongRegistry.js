/**
 * @fileoverview SongRegistry - Config-driven registry for song metadata and chart data
 * Manages loading and caching of song information for Friday Night Funkin'.
 */

import { createRegistry } from '../../core/Registry.js';
import { getSharedRegistryPath } from '../../utils/GameDataPaths.js';

/** @import { SongTimeChange, RegistryEntryBase } from '../../types.js' */

const DEFAULT_VARIATION = 'default';
const SONG_METADATA_VERSION_RULE = '2.2.x';
const SONG_CHART_DATA_VERSION_RULE = '2.0.x';

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * Raw play data from song metadata JSON before cleaning.
 * @typedef {Object} RawSongPlayData
 * @property {string[]} [songVariations] - Available song variations
 * @property {string[]} [difficulties] - Available difficulties
 * @property {Record<string, number>} [ratings] - Difficulty ratings
 * @property {Record<string, any>} [characters] - Character assignments
 * @property {string} [stage] - Stage ID
 * @property {string} [noteStyle] - Note style ID
 * @property {string} [album] - Album ID
 * @property {number} [previewStart] - Preview start time in ms
 * @property {number} [previewEnd] - Preview end time in ms
 */

/**
 * Raw song metadata as read from JSON before cleaning/validation.
 * All properties are optional since validation checks for required fields.
 * @typedef {Object} RawSongMetadata
 * @property {string} [version] - Metadata format version
 * @property {string} [songName] - Display name of the song
 * @property {string} [artist] - Artist name
 * @property {string} [charter] - Charter name
 * @property {string} [timeFormat] - Time format (ms, ticks, float)
 * @property {Record<string, any>} [offsets] - Audio offsets
 * @property {Array<Record<string, any>>} [timeChanges] - BPM/time signature changes
 * @property {RawSongPlayData} [playData] - Gameplay data
 * @property {string} [generatedBy] - Tool that generated the metadata
 */

/**
 * Raw chart data as read from JSON before cleaning/validation.
 * @typedef {Object} RawSongChartData
 * @property {string} [version] - Chart format version
 * @property {Record<string, number>} [scrollSpeed] - Scroll speed per difficulty
 * @property {Array<Record<string, any>>} [events] - Raw event entries
 * @property {Record<string, any>} [notes] - Notes per difficulty
 */

/**
 * Cleaned play data after processing.
 * @typedef {Object} SongCleanedPlayData
 * @property {string[]} songVariations - Available song variations
 * @property {string[]} difficulties - Available difficulties
 * @property {Record<string, number>} ratings - Difficulty ratings
 * @property {{ player: string, girlfriend: string, opponent: string, instrumental: string, altInstrumentals: string[] }} characters - Character assignments
 * @property {string} stage - Stage ID
 * @property {string} noteStyle - Note style ID
 * @property {string | null} album - Album ID
 * @property {number} previewStart - Preview start time in ms
 * @property {number} previewEnd - Preview end time in ms
 */

/**
 * Cleaned/normalized song metadata after processing raw JSON.
 * @typedef {Object} SongCleanedMetadata
 * @property {string} version - Metadata format version
 * @property {string} songName - Display name
 * @property {string} artist - Artist name
 * @property {string | null} charter - Charter name
 * @property {string} timeFormat - Time format
 * @property {{ instrumental: number }} offsets - Audio offsets
 * @property {SongTimeChange[]} timeChanges - BPM/time signature changes
 * @property {SongCleanedPlayData} playData - Gameplay data
 * @property {string | null} generatedBy - Tool that generated the metadata
 * @property {string} variation - Variation ID
 */

/**
 * Cleaned/normalized chart data after processing raw JSON.
 * @typedef {Object} SongCleanedChartData
 * @property {string} version - Chart format version
 * @property {Record<string, number>} scrollSpeed - Scroll speed per difficulty
 * @property {Array<{ t: number, e: string, v: any }>} events - Cleaned events
 * @property {Record<string, any>} notes - Notes per difficulty
 * @property {string} variation - Variation ID
 */

/**
 * A song registry entry with ID, cleaned metadata, and derived fields.
 * @typedef {Object} SongEntry
 * @property {string} id - Song ID
 * @property {SongCleanedMetadata} metadata - Cleaned song metadata
 * @property {Map<string, SongCleanedChartData>} charts - Cached chart data by variation
 * @property {string[]} variations - Available variations
 * @property {string[]} difficulties - Available difficulties
 * @property {function(): void} destroy - Cleanup function
 */

/**
 * Song display info returned by getSongDisplayInfo.
 * @typedef {Object} SongDisplayInfo
 * @property {string} id - Song ID
 * @property {string} name - Display name
 * @property {string} artist - Artist name
 * @property {string | null} charter - Charter name
 * @property {string[]} difficulties - Available difficulties
 * @property {string[]} variations - Available variations
 * @property {string} stage - Stage ID
 * @property {string} noteStyle - Note style ID
 * @property {string | null} album - Album ID
 * @property {number} previewStart - Preview start time
 * @property {number} previewEnd - Preview end time
 * @property {number} bpm - Starting BPM
 */

// ========================================
// CLEANING HELPERS
// ========================================

/**
 * Clean raw play data into normalized form.
 * @param {RawSongPlayData} playData - Raw play data
 * @returns {SongCleanedPlayData}
 */
function cleanPlayData(playData) {
  return {
    songVariations: playData.songVariations || [],
    difficulties: playData.difficulties || ['easy', 'normal', 'hard'],
    ratings: playData.ratings || {},
    characters: {
      player: playData.characters?.player || 'bf',
      girlfriend: playData.characters?.girlfriend || 'gf',
      opponent: playData.characters?.opponent || 'dad',
      instrumental: playData.characters?.instrumental || '',
      altInstrumentals: playData.characters?.altInstrumentals || []
    },
    stage: playData.stage || 'mainStage',
    noteStyle: playData.noteStyle || 'funkin',
    album: playData.album || null,
    previewStart: playData.previewStart ?? 0,
    previewEnd: playData.previewEnd ?? 15000
  };
}

/**
 * Clean raw metadata into normalized form.
 * @param {RawSongMetadata} metadata - Raw metadata
 * @param {string} variation - Variation ID
 * @returns {SongCleanedMetadata}
 */
function cleanMetadata(metadata, variation) {
  return {
    version: metadata.version || '2.2.0',
    songName: metadata.songName || '',
    artist: metadata.artist || 'Unknown',
    charter: metadata.charter || null,
    timeFormat: metadata.timeFormat || 'ms',
    offsets: { instrumental: metadata.offsets?.instrumental ?? 0 },
    timeChanges: (metadata.timeChanges || []).map((/** @type {Record<string, any>} */ tc) => ({
      t: tc.t ?? 0,
      bpm: tc.bpm ?? 100,
      n: tc.n ?? 4,
      d: tc.d ?? 4,
      bt: tc.bt ?? [4, 4, 4, 4]
    })),
    playData: cleanPlayData(metadata.playData || /** @type {RawSongPlayData} */ ({})),
    generatedBy: metadata.generatedBy || null,
    variation
  };
}

// ========================================
// CONFIG-DRIVEN REGISTRY
// ========================================

const SongRegistry = createRegistry(
  {
    registryId: 'SONG',
    dataFilePath: getSharedRegistryPath('songs'),
    versionRule: SONG_METADATA_VERSION_RULE,
    entityName: 'Song',

    /**
     * @param {RawSongMetadata} data
     * @param {string} [fileName]
     * @returns {boolean}
     */
    validateData(data, fileName) {
      if (!data.songName) {
        console.error(`[${this.registryId}] Missing songName for: ${fileName}`);
        return false;
      }
      if (!data.timeChanges || !Array.isArray(data.timeChanges)) {
        console.error(`[${this.registryId}] Missing or invalid timeChanges for: ${fileName}`);
        return false;
      }
      if (!data.playData) {
        console.error(`[${this.registryId}] Missing playData for: ${fileName}`);
        return false;
      }
      if (!data.version) {
        console.warn(
          `[${this.registryId}] No version specified for: ${fileName}, assuming compatible`
        );
      }
      return true;
    },

    /**
     * @param {RawSongMetadata} data
     * @returns {SongCleanedMetadata}
     */
    cleanData(data) {
      return cleanMetadata(data, DEFAULT_VARIATION);
    },

    /**
     * @param {string} id
     * @param {SongCleanedMetadata} data
     * @returns {SongEntry}
     */
    createEntry(id, data) {
      return {
        id,
        metadata: data,
        charts: new Map(),
        variations: [DEFAULT_VARIATION, ...(data.playData.songVariations || [])],
        difficulties: data.playData.difficulties || ['easy', 'normal', 'hard'],
        destroy: () => {}
      };
    }
  },
  {
    methods: {
      /**
       * Parse song metadata from raw JSON data.
       * @param {RawSongMetadata} data - The parsed JSON object
       * @param {string} [fileName='raw'] - File name for error reporting
       * @param {string} [variation] - Variation ID
       * @returns {SongCleanedMetadata | null}
       */
      parseMetadataRaw(data, fileName = 'raw', variation = DEFAULT_VARIATION) {
        if (!data || typeof data !== 'object') {
          console.error(`[${this.registryId}] Invalid metadata data for: ${fileName}`);
          return null;
        }

        const version = data.version;
        if (!version) {
          console.warn(
            `[${this.registryId}] No version specified for: ${fileName}, assuming compatible`
          );
        } else if (!this.validateVersion(version)) {
          console.error(`[${this.registryId}] Incompatible version ${version} for: ${fileName}`);
          return null;
        }

        if (!data.songName) {
          console.error(`[${this.registryId}] Missing songName for: ${fileName}`);
          return null;
        }
        if (!data.timeChanges || !Array.isArray(data.timeChanges)) {
          console.error(`[${this.registryId}] Missing or invalid timeChanges for: ${fileName}`);
          return null;
        }
        if (!data.playData) {
          console.error(`[${this.registryId}] Missing playData for: ${fileName}`);
          return null;
        }

        return cleanMetadata(data, variation);
      },

      /**
       * Parse chart data from raw JSON data.
       * @param {RawSongChartData} data - The parsed JSON object
       * @param {string} [fileName='raw'] - File name for error reporting
       * @param {string} [variation] - Variation ID
       * @returns {SongCleanedChartData | null}
       */
      parseChartDataRaw(data, fileName = 'raw', variation = DEFAULT_VARIATION) {
        if (!data || typeof data !== 'object') {
          console.error(`[${this.registryId}] Invalid chart data for: ${fileName}`);
          return null;
        }

        const version = data.version;
        if (version && !this._validateChartVersion(version)) {
          console.error(
            `[${this.registryId}] Incompatible chart version ${version} for: ${fileName}`
          );
          return null;
        }

        if (!data.scrollSpeed || typeof data.scrollSpeed !== 'object') {
          console.warn(`[${this.registryId}] Missing scrollSpeed for: ${fileName}, using defaults`);
          data.scrollSpeed = { easy: 1.0, normal: 1.0, hard: 1.0 };
        }

        if (!data.notes || typeof data.notes !== 'object') {
          console.error(`[${this.registryId}] Missing notes for: ${fileName}`);
          return null;
        }

        return {
          version: data.version || '2.0.0',
          scrollSpeed: data.scrollSpeed,
          events: (data.events || []).map((/** @type {Record<string, any>} */ e) => ({
            t: e.t ?? 0,
            e: e.e || '',
            v: e.v
          })),
          notes: data.notes || {},
          variation
        };
      },

      /**
       * Validate a chart version string.
       * @param {string} version - Version string to validate
       * @returns {boolean}
       */
      _validateChartVersion(version) {
        if (!version) {
          return true;
        }
        const versionParts = version.split('.');
        const ruleParts = SONG_CHART_DATA_VERSION_RULE.split('.');
        if (versionParts.length < 2 || ruleParts.length < 2) {
          return false;
        }
        if (ruleParts[0] !== 'x' && ruleParts[0] !== versionParts[0]) {
          return false;
        }
        if (ruleParts[1] !== 'x' && ruleParts[1] !== versionParts[1]) {
          return false;
        }
        return true;
      },

      // ========================================
      // CHART CACHE
      // ========================================

      /**
       * Get cached chart data for a song and variation.
       * @param {string} songId - Song ID
       * @param {string} [variation] - Variation ID
       * @returns {SongCleanedChartData | null}
       */
      getChartData(songId, variation = DEFAULT_VARIATION) {
        const /** @type {Record<string, any>} */ self = /** @type {any} */ (this);
        if (!self._chartCache) {
          /** @type {Map<string, Map<string, SongCleanedChartData>>} */
          self._chartCache = new Map();
        }
        /** @type {Map<string, Map<string, SongCleanedChartData>>} */
        const cache = self._chartCache;
        const songCharts = cache.get(songId);
        return songCharts ? songCharts.get(variation) || null : null;
      },

      /**
       * Cache chart data for a song and variation.
       * @param {string} songId - Song ID
       * @param {string} variation - Variation ID
       * @param {SongCleanedChartData} chartData - Chart data to cache
       */
      cacheChartData(songId, variation, chartData) {
        const /** @type {Record<string, any>} */ self = /** @type {any} */ (this);
        if (!self._chartCache) {
          /** @type {Map<string, Map<string, SongCleanedChartData>>} */
          self._chartCache = new Map();
        }
        /** @type {Map<string, Map<string, SongCleanedChartData>>} */
        const cache = self._chartCache;
        if (!cache.has(songId)) {
          cache.set(songId, new Map());
        }
        /** @type {Map<string, SongCleanedChartData>} */
        const songCache = /** @type {Map<string, SongCleanedChartData>} */ (cache.get(songId));
        songCache.set(variation, chartData);
      },

      /**
       * Check if chart data is cached for a song and variation.
       * @param {string} songId - Song ID
       * @param {string} [variation] - Variation ID
       * @returns {boolean}
       */
      hasChartData(songId, variation = DEFAULT_VARIATION) {
        const /** @type {Record<string, any>} */ self = /** @type {any} */ (this);
        if (!self._chartCache) {
          return false;
        }
        /** @type {Map<string, Map<string, SongCleanedChartData>>} */
        const cache = self._chartCache;
        const songCharts = cache.get(songId);
        return songCharts ? songCharts.has(variation) : false;
      },

      /**
       * Clear cached chart data.
       * @param {string} [songId] - Song ID to clear (clears all if omitted)
       */
      clearChartCache(songId) {
        const /** @type {Record<string, any>} */ self = /** @type {any} */ (this);
        if (!self._chartCache) {
          return;
        }
        /** @type {Map<string, Map<string, SongCleanedChartData>>} */
        const cache = self._chartCache;
        if (songId) {
          cache.delete(songId);
        } else {
          cache.clear();
        }
      },

      // ========================================
      // SONG LISTING
      // ========================================

      /**
       * Get all songs that include a specific difficulty.
       * @param {string} difficulty - Difficulty to filter by
       * @returns {SongEntry[]}
       */
      getSongsByDifficulty(difficulty) {
        return this.getAllEntries().filter((/** @type {SongEntry} */ song) =>
          song.difficulties.includes(difficulty)
        );
      },

      /**
       * List all unique difficulties across all songs.
       * @returns {string[]}
       */
      listAllDifficulties() {
        /** @type {Set<string>} */
        const difficulties = new Set();
        for (const song of this.getAllEntries()) {
          for (const diff of /** @type {SongEntry} */ (song).difficulties) {
            difficulties.add(diff);
          }
        }
        return Array.from(difficulties);
      },

      /**
       * Get available variations for a song.
       * @param {string} songId - Song ID
       * @returns {string[]}
       */
      getSongVariations(songId) {
        const song = this.fetchEntry(songId);
        return song ? /** @type {SongEntry} */ (song).variations : [];
      },

      /**
       * Get available difficulties for a song.
       * @param {string} songId - Song ID
       * @returns {string[]}
       */
      getSongDifficulties(songId) {
        const song = this.fetchEntry(songId);
        return song ? /** @type {SongEntry} */ (song).difficulties : [];
      },

      // ========================================
      // PATHS
      // ========================================

      /**
       * Get the metadata file path for a song.
       * @param {string} songId - Song ID
       * @param {string} [variation] - Variation ID
       * @returns {string}
       */
      getMetadataPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `${this.dataFilePath}/${songId}/${songId}-metadata${suffix}.json`;
      },

      /**
       * Get the chart file path for a song.
       * @param {string} songId - Song ID
       * @param {string} [variation] - Variation ID
       * @returns {string}
       */
      getChartPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `${this.dataFilePath}/${songId}/${songId}-chart${suffix}.json`;
      },

      /**
       * Get the instrumental audio path for a song.
       * @param {string} songId - Song ID
       * @param {string} [variation] - Variation ID
       * @returns {string}
       */
      getInstrumentalPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `songs/${songId}/Inst${suffix}`;
      },

      /**
       * Get the voices audio path for a song.
       * @param {string} songId - Song ID
       * @param {string} [variation] - Variation ID
       * @returns {string}
       */
      getVoicesPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `songs/${songId}/Voices${suffix}`;
      },

      /**
       * Get display info for a song.
       * @param {string} songId - Song ID
       * @returns {SongDisplayInfo | null}
       */
      getSongDisplayInfo(songId) {
        const song = /** @type {SongEntry | null} */ (this.fetchEntry(songId));
        if (!song) {
          return null;
        }
        return {
          id: song.id,
          name: song.metadata.songName,
          artist: song.metadata.artist,
          charter: song.metadata.charter,
          difficulties: song.difficulties,
          variations: song.variations,
          stage: song.metadata.playData.stage,
          noteStyle: song.metadata.playData.noteStyle,
          album: song.metadata.playData.album,
          previewStart: song.metadata.playData.previewStart,
          previewEnd: song.metadata.playData.previewEnd,
          bpm: song.metadata.timeChanges[0]?.bpm || 100
        };
      },

      clearEntries() {
        // Call parent clearEntries
        const /** @type {Record<string, any>} */ self = /** @type {any} */ (this);
        /** @type {Map<string, RegistryEntryBase>} */
        const entries = self.entries;
        for (const entry of entries.values()) {
          if (entry && typeof entry.destroy === 'function') {
            entry.destroy();
          }
        }
        entries.clear();
        self.loaded = false;
        this.clearChartCache();
      },

      /** @returns {string} */
      toString() {
        const /** @type {Record<string, any>} */ self = /** @type {any} */ (this);
        const chartSize = self._chartCache
          ? /** @type {Map<string, any>} */ (self._chartCache).size
          : 0;
        return `SongRegistry(${this.countEntries()} songs, ${chartSize} cached charts)`;
      }
    }
  }
);

export default SongRegistry;

/**
 * @fileoverview SongRegistry - Config-driven registry for song metadata and chart data
 * Manages loading and caching of song information for Friday Night Funkin'.
 */

import { createRegistry } from '../../core/Registry.js';
import { getSharedRegistryPath } from '../../utils/GameDataPaths.js';

const DEFAULT_VARIATION = 'default';
const SONG_METADATA_VERSION_RULE = '2.2.x';
const SONG_CHART_DATA_VERSION_RULE = '2.0.x';

// ========================================
// CLEANING HELPERS
// ========================================

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

function cleanMetadata(metadata, variation) {
  return {
    version: metadata.version || '2.2.0',
    songName: metadata.songName,
    artist: metadata.artist || 'Unknown',
    charter: metadata.charter || null,
    timeFormat: metadata.timeFormat || 'ms',
    offsets: { instrumental: metadata.offsets?.instrumental ?? 0 },
    timeChanges: metadata.timeChanges.map((tc) => ({
      t: tc.t ?? 0,
      bpm: tc.bpm ?? 100,
      n: tc.n ?? 4,
      d: tc.d ?? 4,
      bt: tc.bt ?? [4, 4, 4, 4]
    })),
    playData: cleanPlayData(metadata.playData),
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

    cleanData(data) {
      return cleanMetadata(data, DEFAULT_VARIATION);
    },

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
       * @param {Object} data - The parsed JSON object
       * @param {string} [fileName='raw'] - File name for error reporting
       * @param {string} [variation] - Variation ID
       * @returns {Object | null}
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
       * @param {Object} data - The parsed JSON object
       * @param {string} [fileName='raw'] - File name for error reporting
       * @param {string} [variation] - Variation ID
       * @returns {Object | null}
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
          events: (data.events || []).map((e) => ({ t: e.t ?? 0, e: e.e || '', v: e.v })),
          notes: data.notes || {},
          variation
        };
      },

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

      getChartData(songId, variation = DEFAULT_VARIATION) {
        if (!this.chartCache) {
          this.chartCache = new Map();
        }
        const songCharts = this.chartCache.get(songId);
        return songCharts ? songCharts.get(variation) || null : null;
      },

      cacheChartData(songId, variation, chartData) {
        if (!this.chartCache) {
          this.chartCache = new Map();
        }
        if (!this.chartCache.has(songId)) {
          this.chartCache.set(songId, new Map());
        }
        this.chartCache.get(songId).set(variation, chartData);
      },

      hasChartData(songId, variation = DEFAULT_VARIATION) {
        if (!this.chartCache) {
          return false;
        }
        const songCharts = this.chartCache.get(songId);
        return songCharts ? songCharts.has(variation) : false;
      },

      clearChartCache(songId) {
        if (!this.chartCache) {
          return;
        }
        if (songId) {
          this.chartCache.delete(songId);
        } else {
          this.chartCache.clear();
        }
      },

      // ========================================
      // SONG LISTING
      // ========================================

      getSongsByDifficulty(difficulty) {
        return this.getAllEntries().filter((song) => song.difficulties.includes(difficulty));
      },

      listAllDifficulties() {
        const difficulties = new Set();
        for (const song of this.getAllEntries()) {
          for (const diff of song.difficulties) {
            difficulties.add(diff);
          }
        }
        return Array.from(difficulties);
      },

      getSongVariations(songId) {
        const song = this.fetchEntry(songId);
        return song ? song.variations : [];
      },

      getSongDifficulties(songId) {
        const song = this.fetchEntry(songId);
        return song ? song.difficulties : [];
      },

      // ========================================
      // PATHS
      // ========================================

      getMetadataPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `${this.dataFilePath}/${songId}/${songId}-metadata${suffix}.json`;
      },

      getChartPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `${this.dataFilePath}/${songId}/${songId}-chart${suffix}.json`;
      },

      getInstrumentalPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `songs/${songId}/Inst${suffix}`;
      },

      getVoicesPath(songId, variation = DEFAULT_VARIATION) {
        const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
        return `songs/${songId}/Voices${suffix}`;
      },

      getSongDisplayInfo(songId) {
        const song = this.fetchEntry(songId);
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
        const entries = this.entries;
        for (const entry of entries.values()) {
          if (entry && typeof entry.destroy === 'function') {
            entry.destroy();
          }
        }
        entries.clear();
        this.loaded = false;
        this.clearChartCache();
      },

      toString() {
        const chartSize = this.chartCache ? this.chartCache.size : 0;
        return `SongRegistry(${this.countEntries()} songs, ${chartSize} cached charts)`;
      }
    }
  }
);

export default SongRegistry;

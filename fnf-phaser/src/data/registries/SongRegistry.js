/**
 * @fileoverview SongRegistry - Registry for song metadata and chart data
 * Manages loading and caching of song information for Friday Night Funkin'.
 *
 * Ported from source/funkin/data/song/SongRegistry.hx
 */

import Registry from '../../core/Registry.js';

/**
 * @typedef {Object} TimeChange
 * @property {number} t - Timestamp in milliseconds
 * @property {number} bpm - Beats per minute
 * @property {number} [n=4] - Time signature numerator
 * @property {number} [d=4] - Time signature denominator
 * @property {number[]} [bt] - Beat tuplets
 */

/**
 * @typedef {Object} SongCharacterData
 * @property {string} player - Player character ID
 * @property {string} girlfriend - Girlfriend character ID
 * @property {string} opponent - Opponent character ID
 * @property {string} [instrumental] - Instrumental variation
 * @property {string[]} [altInstrumentals] - Alternative instrumental variations
 */

/**
 * @typedef {Object} SongPlayData
 * @property {string[]} songVariations - Available song variations
 * @property {string[]} difficulties - Available difficulties
 * @property {Object<string, number>} [ratings] - Difficulty ratings
 * @property {SongCharacterData} characters - Character assignments
 * @property {string} stage - Stage ID
 * @property {string} noteStyle - Note style ID
 * @property {string} [album] - Album ID for freeplay
 * @property {number} [previewStart] - Preview start time in ms
 * @property {number} [previewEnd] - Preview end time in ms
 */

/**
 * @typedef {Object} SongMetadata
 * @property {string} version - Data format version
 * @property {string} songName - Display name of the song
 * @property {string} artist - Song artist
 * @property {string} [charter] - Chart creator
 * @property {string} [timeFormat='ms'] - Time format (ms or steps)
 * @property {Object} [offsets] - Audio offsets
 * @property {number} [offsets.instrumental] - Instrumental offset
 * @property {TimeChange[]} timeChanges - BPM and time signature changes
 * @property {SongPlayData} playData - Gameplay-related data
 * @property {string} [generatedBy] - Tool that generated the data
 * @property {string} [variation] - Variation ID (set during parsing)
 */

/**
 * @typedef {Object} SongEventData
 * @property {number} t - Timestamp in milliseconds
 * @property {string} e - Event type
 * @property {*} v - Event value
 */

/**
 * @typedef {Object} SongNoteData
 * @property {number} t - Timestamp in milliseconds
 * @property {number} d - Direction (0-7, 0-3 opponent, 4-7 player)
 * @property {number} [l=0] - Length for hold notes
 * @property {string} [k] - Note kind
 */

/**
 * @typedef {Object} SongChartData
 * @property {string} version - Chart data version
 * @property {Object<string, number>} scrollSpeed - Scroll speed per difficulty
 * @property {SongEventData[]} events - Song events
 * @property {Object<string, SongNoteData[]>} notes - Notes per difficulty
 * @property {string} [variation] - Variation ID (set during parsing)
 */

/**
 * @typedef {Object} SongEntry
 * @property {string} id - Song ID
 * @property {SongMetadata} metadata - Song metadata
 * @property {Map<string, SongChartData>} charts - Chart data by variation
 * @property {string[]} variations - Available variations
 * @property {string[]} difficulties - Available difficulties
 */

// Default constants
const DEFAULT_VARIATION = 'default';
const SONG_METADATA_VERSION_RULE = '2.2.x';
const SONG_CHART_DATA_VERSION_RULE = '2.0.x';

/**
 * Registry for song data.
 * Handles loading song metadata and chart data from JSON files.
 */
class SongRegistry extends Registry {
  /**
   * Singleton instance
   * @type {SongRegistry | null}
   */
  static instance = null;

  /**
   * Get the singleton instance
   * @returns {SongRegistry}
   */
  static getInstance() {
    if (!SongRegistry.instance) {
      SongRegistry.instance = new SongRegistry();
    }
    return SongRegistry.instance;
  }

  /**
   * Create a new SongRegistry
   */
  constructor() {
    super('SONG', 'data/songs', SONG_METADATA_VERSION_RULE);

    /**
     * Cache of chart data by song ID and variation
     * @type {Map<string, Map<string, SongChartData>>}
     */
    this.chartCache = new Map();
  }


  // ========================================
  // PARSING METHODS
  // ========================================

  /**
   * Parse entry data from a pre-loaded JSON object.
   * @param {string} id - The song ID
   * @returns {SongMetadata | null}
   */
  parseEntryData(id) {
    // This method expects data to be pre-loaded
    // In practice, use parseEntryDataRaw with loaded JSON
    console.warn(`[${this.registryId}] parseEntryData called without data for: ${id}`);
    return null;
  }

  /**
   * Parse and validate raw JSON data for song metadata.
   * @param {Object} data - The parsed JSON object
   * @param {string} [fileName] - Optional file name for error reporting
   * @returns {SongMetadata | null}
   */
  parseEntryDataRaw(data, fileName) {
    return this.parseMetadataRaw(data, fileName);
  }

  /**
   * Parse song metadata from raw JSON data.
   * @param {Object} data - The parsed JSON object
   * @param {string} [fileName='raw'] - File name for error reporting
   * @param {string} [variation] - Variation ID
   * @returns {SongMetadata | null}
   */
  parseMetadataRaw(data, fileName = 'raw', variation = DEFAULT_VARIATION) {
    if (!data || typeof data !== 'object') {
      console.error(`[${this.registryId}] Invalid metadata data for: ${fileName}`);
      return null;
    }

    // Validate version
    const version = data.version;
    if (!version) {
      console.warn(`[${this.registryId}] No version specified for: ${fileName}, assuming compatible`);
    } else if (!this.validateVersion(version)) {
      console.error(`[${this.registryId}] Incompatible version ${version} for: ${fileName}`);
      return null;
    }

    // Validate required fields
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

    // Clean and return metadata
    return this.cleanMetadata(data, variation);
  }

  /**
   * Parse chart data from raw JSON data.
   * @param {Object} data - The parsed JSON object
   * @param {string} [fileName='raw'] - File name for error reporting
   * @param {string} [variation] - Variation ID
   * @returns {SongChartData | null}
   */
  parseChartDataRaw(data, fileName = 'raw', variation = DEFAULT_VARIATION) {
    if (!data || typeof data !== 'object') {
      console.error(`[${this.registryId}] Invalid chart data for: ${fileName}`);
      return null;
    }

    // Validate version
    const version = data.version;
    if (version && !this.validateChartVersion(version)) {
      console.error(`[${this.registryId}] Incompatible chart version ${version} for: ${fileName}`);
      return null;
    }

    // Validate required fields
    if (!data.scrollSpeed || typeof data.scrollSpeed !== 'object') {
      console.warn(`[${this.registryId}] Missing scrollSpeed for: ${fileName}, using defaults`);
      data.scrollSpeed = { easy: 1.0, normal: 1.0, hard: 1.0 };
    }

    if (!data.notes || typeof data.notes !== 'object') {
      console.error(`[${this.registryId}] Missing notes for: ${fileName}`);
      return null;
    }

    // Clean and return chart data
    return this.cleanChartData(data, variation);
  }

  /**
   * Validate chart data version.
   * @param {string} version - Version string
   * @returns {boolean}
   */
  validateChartVersion(version) {
    if (!version) return true;

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
  }

  /**
   * Clean and normalize metadata.
   * @param {Object} metadata - Raw metadata
   * @param {string} variation - Variation ID
   * @returns {SongMetadata}
   */
  cleanMetadata(metadata, variation) {
    // Set defaults for optional fields
    const cleaned = {
      version: metadata.version || '2.2.0',
      songName: metadata.songName,
      artist: metadata.artist || 'Unknown',
      charter: metadata.charter || null,
      timeFormat: metadata.timeFormat || 'ms',
      offsets: {
        instrumental: metadata.offsets?.instrumental ?? 0
      },
      timeChanges: metadata.timeChanges.map((tc) => ({
        t: tc.t ?? 0,
        bpm: tc.bpm ?? 100,
        n: tc.n ?? 4,
        d: tc.d ?? 4,
        bt: tc.bt ?? [4, 4, 4, 4]
      })),
      playData: this.cleanPlayData(metadata.playData),
      generatedBy: metadata.generatedBy || null,
      variation
    };

    return cleaned;
  }

  /**
   * Clean play data.
   * @param {Object} playData - Raw play data
   * @returns {SongPlayData}
   */
  cleanPlayData(playData) {
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
   * Clean chart data.
   * @param {Object} chartData - Raw chart data
   * @param {string} variation - Variation ID
   * @returns {SongChartData}
   */
  cleanChartData(chartData, variation) {
    return {
      version: chartData.version || '2.0.0',
      scrollSpeed: chartData.scrollSpeed,
      events: (chartData.events || []).map((e) => ({
        t: e.t ?? 0,
        e: e.e || '',
        v: e.v
      })),
      notes: chartData.notes || {},
      variation
    };
  }

  /**
   * Create a song entry from parsed metadata.
   * @param {string} id - Song ID
   * @param {SongMetadata} data - Parsed metadata
   * @returns {SongEntry | null}
   */
  createEntry(id, data) {
    if (!data) return null;

    return {
      id,
      metadata: data,
      charts: new Map(),
      variations: [DEFAULT_VARIATION, ...(data.playData.songVariations || [])],
      difficulties: data.playData.difficulties || ['easy', 'normal', 'hard'],
      destroy: () => {
        // Cleanup if needed
      }
    };
  }


  // ========================================
  // CHART DATA METHODS
  // ========================================

  /**
   * Get chart data for a song and variation.
   * @param {string} songId - Song ID
   * @param {string} [variation] - Variation ID
   * @returns {SongChartData | null}
   */
  getChartData(songId, variation = DEFAULT_VARIATION) {
    const songCharts = this.chartCache.get(songId);
    if (songCharts) {
      return songCharts.get(variation) || null;
    }
    return null;
  }

  /**
   * Cache chart data for a song.
   * @param {string} songId - Song ID
   * @param {string} variation - Variation ID
   * @param {SongChartData} chartData - Chart data to cache
   */
  cacheChartData(songId, variation, chartData) {
    if (!this.chartCache.has(songId)) {
      this.chartCache.set(songId, new Map());
    }
    this.chartCache.get(songId).set(variation, chartData);
  }

  /**
   * Check if chart data is cached.
   * @param {string} songId - Song ID
   * @param {string} [variation] - Variation ID
   * @returns {boolean}
   */
  hasChartData(songId, variation = DEFAULT_VARIATION) {
    const songCharts = this.chartCache.get(songId);
    return songCharts ? songCharts.has(variation) : false;
  }

  /**
   * Clear chart cache for a song or all songs.
   * @param {string} [songId] - Optional song ID to clear
   */
  clearChartCache(songId) {
    if (songId) {
      this.chartCache.delete(songId);
    } else {
      this.chartCache.clear();
    }
  }

  // ========================================
  // SONG LISTING METHODS
  // ========================================

  /**
   * Get all available song IDs.
   * @returns {string[]}
   */
  listSongIds() {
    return this.listEntryIds();
  }

  /**
   * Get songs filtered by difficulty.
   * @param {string} difficulty - Difficulty to filter by
   * @returns {SongEntry[]}
   */
  getSongsByDifficulty(difficulty) {
    return this.getAllEntries().filter((song) => song.difficulties.includes(difficulty));
  }

  /**
   * Get all difficulties available across all songs.
   * @returns {string[]}
   */
  listAllDifficulties() {
    const difficulties = new Set();
    for (const song of this.getAllEntries()) {
      for (const diff of song.difficulties) {
        difficulties.add(diff);
      }
    }
    return Array.from(difficulties);
  }

  /**
   * Get song variations.
   * @param {string} songId - Song ID
   * @returns {string[]}
   */
  getSongVariations(songId) {
    const song = this.fetchEntry(songId);
    return song ? song.variations : [];
  }

  /**
   * Get song difficulties.
   * @param {string} songId - Song ID
   * @returns {string[]}
   */
  getSongDifficulties(songId) {
    const song = this.fetchEntry(songId);
    return song ? song.difficulties : [];
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get the file path for song metadata.
   * @param {string} songId - Song ID
   * @param {string} [variation] - Variation ID
   * @returns {string}
   */
  getMetadataPath(songId, variation = DEFAULT_VARIATION) {
    const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
    return `${this.dataFilePath}/${songId}/${songId}-metadata${suffix}.json`;
  }

  /**
   * Get the file path for song chart data.
   * @param {string} songId - Song ID
   * @param {string} [variation] - Variation ID
   * @returns {string}
   */
  getChartPath(songId, variation = DEFAULT_VARIATION) {
    const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
    return `${this.dataFilePath}/${songId}/${songId}-chart${suffix}.json`;
  }

  /**
   * Get the instrumental audio path for a song.
   * @param {string} songId - Song ID
   * @param {string} [variation] - Variation ID
   * @returns {string}
   */
  getInstrumentalPath(songId, variation = DEFAULT_VARIATION) {
    const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
    return `songs/${songId}/Inst${suffix}`;
  }

  /**
   * Get the voices audio path for a song.
   * @param {string} songId - Song ID
   * @param {string} [variation] - Variation ID
   * @returns {string}
   */
  getVoicesPath(songId, variation = DEFAULT_VARIATION) {
    const suffix = variation === DEFAULT_VARIATION ? '' : `-${variation}`;
    return `songs/${songId}/Voices${suffix}`;
  }

  /**
   * Get song display info for menus.
   * @param {string} songId - Song ID
   * @returns {Object | null}
   */
  getSongDisplayInfo(songId) {
    const song = this.fetchEntry(songId);
    if (!song) return null;

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
  }

  /**
   * Clear all entries and chart cache.
   */
  clearEntries() {
    super.clearEntries();
    this.clearChartCache();
  }

  /**
   * Get string representation.
   * @returns {string}
   */
  toString() {
    return `SongRegistry(${this.countEntries()} songs, ${this.chartCache.size} cached charts)`;
  }
}

export default SongRegistry;

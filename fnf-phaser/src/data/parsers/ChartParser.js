/**
 * @fileoverview ChartParser - Parser for FNF chart JSON format
 * Parses chart and metadata files into usable game data structures.
 *
 * Ported from source/funkin/data/song/SongData.hx
 */

/**
 * @typedef {Object} SongTimeChange
 * @property {number} t - Timestamp in milliseconds
 * @property {number} bpm - Beats per minute
 * @property {number} [n=4] - Time signature numerator
 * @property {number} [d=4] - Time signature denominator
 * @property {number} [b] - Beat time (calculated)
 * @property {number[]} [bt=[4,4,4,4]] - Beat tuplets
 */

/**
 * @typedef {Object} SongCharacterData
 * @property {string} player - Player character ID
 * @property {string} [opponent] - Opponent character ID
 * @property {string} [girlfriend] - Girlfriend character ID
 * @property {string} [instrumental] - Instrumental variant
 * @property {string[]} [altInstrumentals] - Alternative instrumentals
 */

/**
 * @typedef {Object} SongPlayData
 * @property {string} stage - Stage ID
 * @property {string} noteStyle - Note style ID
 * @property {string[]} difficulties - Available difficulties
 * @property {SongCharacterData} characters - Character data
 * @property {Object<string, number>} [ratings] - Difficulty ratings
 * @property {string} [album] - Album ID for freeplay
 * @property {number} [previewStart=0] - Preview start time in ms
 * @property {number} [previewEnd=15000] - Preview end time in ms
 */

/**
 * @typedef {Object} SongMetadata
 * @property {string} version - Metadata version
 * @property {string} songName - Display name of the song
 * @property {string} artist - Artist name
 * @property {string} [charter] - Charter name
 * @property {string} [timeFormat='ms'] - Time format (ms, ticks, float)
 * @property {number} [divisions] - Divisions per beat
 * @property {boolean} [looped=false] - Whether the song loops
 * @property {SongPlayData} playData - Gameplay data
 * @property {SongTimeChange[]} timeChanges - BPM/time signature changes
 * @property {string} [generatedBy] - Tool that generated the chart
 */

/**
 * @typedef {Object} NoteData
 * @property {number} time - Note timestamp in milliseconds
 * @property {number} data - Note lane/direction (0-7 typically)
 * @property {number} [length=0] - Hold note length in milliseconds
 * @property {string} [kind] - Note kind (normal, mine, etc.)
 * @property {Array<{name: string, value: *}>} [params] - Additional parameters
 */

/**
 * @typedef {Object} EventData
 * @property {number} time - Event timestamp in milliseconds
 * @property {string} eventKind - Event type identifier
 * @property {*} [value] - Event-specific data
 */

/**
 * @typedef {Object} ChartData
 * @property {string} version - Chart version
 * @property {Object<string, number>} scrollSpeed - Scroll speed per difficulty
 * @property {EventData[]} events - Chart events
 * @property {Object<string, NoteData[]>} notes - Notes per difficulty
 * @property {string} [generatedBy] - Tool that generated the chart
 */

/**
 * @typedef {Object} ParsedChart
 * @property {SongMetadata} metadata - Song metadata
 * @property {ChartData} chart - Chart data
 * @property {string} variation - Variation ID
 */

// Chart format versions
const SUPPORTED_METADATA_VERSIONS = ['2.0.0', '2.1.0', '2.2.0', '2.2.1', '2.2.2', '2.2.3', '2.2.4'];
const SUPPORTED_CHART_VERSIONS = ['2.0.0', '2.0.1'];

// Direction constants
const DIRECTIONS = ['left', 'down', 'up', 'right'];
const STRUMLINE_SIZE = 4;

/**
 * Parser for FNF chart JSON format.
 * Handles both metadata and chart data files.
 */
class ChartParser {
  /**
   * Parse song metadata from JSON.
   * @param {Object} json - Raw JSON object
   * @param {string} [variation='default'] - Variation ID
   * @returns {SongMetadata | null} Parsed metadata or null if invalid
   */
  static parseMetadata(json, variation = 'default') {
    if (!json || typeof json !== 'object') {
      console.error('[ChartParser] Invalid metadata JSON');
      return null;
    }

    // Validate version
    const version = json.version;
    if (!ChartParser.isValidMetadataVersion(version)) {
      console.warn(`[ChartParser] Unknown metadata version: ${version}`);
    }

    // Parse time changes
    const timeChanges = ChartParser.parseTimeChanges(json.timeChanges);
    if (timeChanges.length === 0) {
      console.error('[ChartParser] No valid time changes found');
      return null;
    }

    // Parse play data
    const playData = ChartParser.parsePlayData(json.playData);
    if (!playData) {
      console.error('[ChartParser] Invalid play data');
      return null;
    }

    return {
      version: version || '2.0.0',
      songName: json.songName || 'Unknown',
      artist: json.artist || 'Unknown',
      charter: json.charter || null,
      timeFormat: json.timeFormat || 'ms',
      divisions: json.divisions || null,
      looped: json.looped || false,
      playData,
      timeChanges,
      generatedBy: json.generatedBy || 'Unknown',
      variation
    };
  }

  /**
   * Parse chart data from JSON.
   * @param {Object} json - Raw JSON object
   * @param {string} [variation='default'] - Variation ID
   * @returns {ChartData | null} Parsed chart data or null if invalid
   */
  static parseChart(json, variation = 'default') {
    if (!json || typeof json !== 'object') {
      console.error('[ChartParser] Invalid chart JSON');
      return null;
    }

    // Validate version
    const version = json.version;
    if (!ChartParser.isValidChartVersion(version)) {
      console.warn(`[ChartParser] Unknown chart version: ${version}`);
    }

    // Parse scroll speeds
    const scrollSpeed = ChartParser.parseScrollSpeed(json.scrollSpeed);

    // Parse events
    const events = ChartParser.parseEvents(json.events);

    // Parse notes for each difficulty
    const notes = ChartParser.parseNotes(json.notes);

    return {
      version: version || '2.0.0',
      scrollSpeed,
      events,
      notes,
      generatedBy: json.generatedBy || 'Unknown',
      variation
    };
  }

  /**
   * Parse time changes array.
   * @param {Array} timeChanges - Raw time changes array
   * @returns {SongTimeChange[]} Parsed time changes
   */
  static parseTimeChanges(timeChanges) {
    if (!Array.isArray(timeChanges)) {
      // Return default time change
      return [{ t: 0, bpm: 100, n: 4, d: 4, bt: [4, 4, 4, 4] }];
    }

    return timeChanges
      .map((tc) => {
        if (!tc || typeof tc !== 'object') {
          return null;
        }

        return {
          t: tc.t ?? 0,
          bpm: tc.bpm ?? 100,
          n: tc.n ?? 4,
          d: tc.d ?? 4,
          b: tc.b ?? null,
          bt: tc.bt ?? [4, 4, 4, 4]
        };
      })
      .filter((tc) => tc !== null)
      .sort((a, b) => a.t - b.t);
  }

  /**
   * Parse play data object.
   * @param {Object} playData - Raw play data
   * @returns {SongPlayData | null} Parsed play data or null if invalid
   */
  static parsePlayData(playData) {
    if (!playData || typeof playData !== 'object') {
      return null;
    }

    const characters = ChartParser.parseCharacterData(playData.characters);
    if (!characters) {
      return null;
    }

    return {
      stage: playData.stage || 'mainStage',
      noteStyle: playData.noteStyle || 'funkin',
      difficulties: Array.isArray(playData.difficulties) ? playData.difficulties : ['normal'],
      characters,
      ratings: playData.ratings || {},
      album: playData.album || null,
      previewStart: playData.previewStart ?? 0,
      previewEnd: playData.previewEnd ?? 15000
    };
  }

  /**
   * Parse character data object.
   * @param {Object} characters - Raw character data
   * @returns {SongCharacterData | null} Parsed character data or null if invalid
   */
  static parseCharacterData(characters) {
    if (!characters || typeof characters !== 'object') {
      return null;
    }

    return {
      player: characters.player || 'bf',
      opponent: characters.opponent || 'dad',
      girlfriend: characters.girlfriend || 'gf',
      instrumental: characters.instrumental || '',
      altInstrumentals: Array.isArray(characters.altInstrumentals)
        ? characters.altInstrumentals
        : []
    };
  }

  /**
   * Parse scroll speed map.
   * @param {Object} scrollSpeed - Raw scroll speed object
   * @returns {Object<string, number>} Parsed scroll speeds
   */
  static parseScrollSpeed(scrollSpeed) {
    if (!scrollSpeed || typeof scrollSpeed !== 'object') {
      return { default: 1.0 };
    }

    const result = {};
    for (const [key, value] of Object.entries(scrollSpeed)) {
      result[key] = typeof value === 'number' ? value : 1.0;
    }

    return result;
  }

  /**
   * Parse events array.
   * @param {Array} events - Raw events array
   * @returns {EventData[]} Parsed events
   */
  static parseEvents(events) {
    if (!Array.isArray(events)) {
      return [];
    }

    return events
      .map((event) => {
        if (!event || typeof event !== 'object') {
          return null;
        }

        return {
          time: event.t ?? 0,
          eventKind: event.e ?? 'Unknown',
          value: event.v ?? null,
          activated: false
        };
      })
      .filter((e) => e !== null)
      .sort((a, b) => a.time - b.time);
  }

  /**
   * Parse notes for all difficulties.
   * @param {Object} notes - Raw notes object (difficulty -> notes array)
   * @returns {Object<string, NoteData[]>} Parsed notes per difficulty
   */
  static parseNotes(notes) {
    if (!notes || typeof notes !== 'object') {
      return {};
    }

    const result = {};
    for (const [difficulty, noteArray] of Object.entries(notes)) {
      if (Array.isArray(noteArray)) {
        result[difficulty] = ChartParser.parseNoteArray(noteArray);
      }
    }

    return result;
  }

  /**
   * Parse a single difficulty's note array.
   * @param {Array} noteArray - Raw note array
   * @returns {NoteData[]} Parsed notes
   */
  static parseNoteArray(noteArray) {
    return noteArray
      .map((note) => {
        if (!note || typeof note !== 'object') {
          return null;
        }

        return {
          time: note.t ?? 0,
          data: note.d ?? 0,
          length: note.l ?? 0,
          kind: note.k || null,
          params: Array.isArray(note.p) ? note.p : []
        };
      })
      .filter((n) => n !== null)
      .sort((a, b) => a.time - b.time);
  }

  // ========================================
  // NOTE UTILITY METHODS
  // ========================================

  /**
   * Get the direction index for a note (0-3).
   * @param {NoteData} note - The note data
   * @param {number} [strumlineSize=4] - Size of each strumline
   * @returns {number} Direction index (0=left, 1=down, 2=up, 3=right)
   */
  static getNoteDirection(note, strumlineSize = STRUMLINE_SIZE) {
    return note.data % strumlineSize;
  }

  /**
   * Get the direction name for a note.
   * @param {NoteData} note - The note data
   * @param {number} [strumlineSize=4] - Size of each strumline
   * @returns {string} Direction name
   */
  static getNoteDirectionName(note, strumlineSize = STRUMLINE_SIZE) {
    const dir = ChartParser.getNoteDirection(note, strumlineSize);
    return DIRECTIONS[dir] || 'unknown';
  }

  /**
   * Get the strumline index for a note (0=player, 1=opponent, etc.).
   * @param {NoteData} note - The note data
   * @param {number} [strumlineSize=4] - Size of each strumline
   * @returns {number} Strumline index
   */
  static getNoteStrumline(note, strumlineSize = STRUMLINE_SIZE) {
    return Math.floor(note.data / strumlineSize);
  }

  /**
   * Check if a note is a player note (must hit).
   * @param {NoteData} note - The note data
   * @param {number} [strumlineSize=4] - Size of each strumline
   * @returns {boolean} True if player must hit this note
   */
  static isPlayerNote(note, strumlineSize = STRUMLINE_SIZE) {
    return ChartParser.getNoteStrumline(note, strumlineSize) === 0;
  }

  /**
   * Check if a note is a hold note.
   * @param {NoteData} note - The note data
   * @returns {boolean} True if this is a hold note
   */
  static isHoldNote(note) {
    return note.length > 0;
  }

  /**
   * Get notes for a specific difficulty.
   * @param {ChartData} chart - The chart data
   * @param {string} difficulty - Difficulty name
   * @returns {NoteData[]} Notes for the difficulty, or empty array
   */
  static getNotesForDifficulty(chart, difficulty) {
    return chart.notes[difficulty] || chart.notes['normal'] || [];
  }

  /**
   * Get scroll speed for a specific difficulty.
   * @param {ChartData} chart - The chart data
   * @param {string} difficulty - Difficulty name
   * @returns {number} Scroll speed
   */
  static getScrollSpeed(chart, difficulty) {
    return chart.scrollSpeed[difficulty] || chart.scrollSpeed['default'] || 1.0;
  }

  /**
   * Separate notes into player and opponent arrays.
   * @param {NoteData[]} notes - All notes
   * @param {number} [strumlineSize=4] - Size of each strumline
   * @returns {{player: NoteData[], opponent: NoteData[]}} Separated notes
   */
  static separateNotes(notes, strumlineSize = STRUMLINE_SIZE) {
    const player = [];
    const opponent = [];

    for (const note of notes) {
      if (ChartParser.isPlayerNote(note, strumlineSize)) {
        player.push(note);
      } else {
        opponent.push(note);
      }
    }

    return { player, opponent };
  }

  // ========================================
  // VERSION VALIDATION
  // ========================================

  /**
   * Check if a metadata version is supported.
   * @param {string} version - Version string
   * @returns {boolean} True if supported
   */
  static isValidMetadataVersion(version) {
    if (!version) {
      return false;
    }
    // Check major.minor match
    const majorMinor = version.split('.').slice(0, 2).join('.');
    return SUPPORTED_METADATA_VERSIONS.some((v) => v.startsWith(majorMinor));
  }

  /**
   * Check if a chart version is supported.
   * @param {string} version - Version string
   * @returns {boolean} True if supported
   */
  static isValidChartVersion(version) {
    if (!version) {
      return false;
    }
    const majorMinor = version.split('.').slice(0, 2).join('.');
    return SUPPORTED_CHART_VERSIONS.some((v) => v.startsWith(majorMinor));
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get statistics about a chart.
   * @param {ChartData} chart - The chart data
   * @param {string} difficulty - Difficulty to analyze
   * @returns {Object} Chart statistics
   */
  static getChartStats(chart, difficulty) {
    const notes = ChartParser.getNotesForDifficulty(chart, difficulty);
    const { player, opponent } = ChartParser.separateNotes(notes);

    const holdNotes = notes.filter((n) => ChartParser.isHoldNote(n));
    const totalHoldLength = holdNotes.reduce((sum, n) => sum + n.length, 0);

    return {
      totalNotes: notes.length,
      playerNotes: player.length,
      opponentNotes: opponent.length,
      holdNotes: holdNotes.length,
      totalHoldLength,
      events: chart.events.length,
      scrollSpeed: ChartParser.getScrollSpeed(chart, difficulty)
    };
  }
}

export default ChartParser;

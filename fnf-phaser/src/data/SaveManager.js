/**
 * @fileoverview SaveManager - Handles persistent game data storage
 * Implements FR-10.1, FR-10.2, FR-10.3: Save/load high scores, options, and progress
 */

import { ARROW_STORED_KEYS, codeToStoredKey } from '../input/KeybindStorage.js';

/**
 * Current save data version for migration handling
 * @type {string}
 */
const SAVE_VERSION = '1.1.0';

/**
 * Storage keys
 * @readonly
 * @enum {string}
 */
export const StorageKeys = {
  OPTIONS: 'fnf-options',
  SCORES: 'fnf-scores',
  PROGRESS: 'fnf-progress',
  VERSION: 'fnf-version',
  LEGACY_CONTROLS: 'fnf_controls'
};

/**
 * Minimum input delay compensation value in ms
 * @type {number}
 */
const INPUT_DELAY_MIN = -50;

/**
 * Maximum input delay compensation value in ms
 * @type {number}
 */
const INPUT_DELAY_MAX = 50;

/**
 * Default options configuration
 * @type {Object}
 */
const DEFAULT_OPTIONS = {
  // Gameplay
  downscroll: false,
  ghostTapping: true,
  scrollSpeed: 1.0,
  noteOffset: 0,

  // Competitive
  inputDelayCompensation: 0, // -50 to +50 ms
  inputBufferWindow: 50, // 0-100 ms

  // HUD Stats
  showNPS: true,
  showGrade: true,
  showComboBreaks: true,
  showJudgements: false,

  // Audio
  masterVolume: 100,
  musicVolume: 100,
  sfxVolume: 100,
  hitsounds: false,

  // Visuals
  showFps: false,
  flashingLights: true,
  cameraZoom: true,
  comboDisplay: true,

  // Controls
  keyLeft: 'A',
  keyDown: 'S',
  keyUp: 'W',
  keyRight: 'D',
  keyLeftAlt: 'LEFT',
  keyDownAlt: 'DOWN',
  keyUpAlt: 'UP',
  keyRightAlt: 'RIGHT'
};

/**
 * Default progress structure
 * @type {Object}
 */
const DEFAULT_PROGRESS = {
  unlockedWeeks: ['tutorial', 'week1'],
  completedSongs: [],
  completedLevels: [],
  storyProgress: {}
};

/**
 * Get a fresh copy of default progress
 * @returns {Object}
 */
function getDefaultProgress() {
  return {
    unlockedWeeks: [...DEFAULT_PROGRESS.unlockedWeeks],
    completedSongs: [...DEFAULT_PROGRESS.completedSongs],
    completedLevels: [...DEFAULT_PROGRESS.completedLevels],
    storyProgress: { ...DEFAULT_PROGRESS.storyProgress }
  };
}

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function chooseStoredKeys(codes, fallbackPrimary, fallbackAlternate) {
  const storedKeys = uniqueList(codes.map((code) => codeToStoredKey(code)));
  const primary =
    storedKeys.find((key) => !ARROW_STORED_KEYS.has(key)) ?? storedKeys[0] ?? fallbackPrimary;
  const alternate = storedKeys.find((key) => key !== primary) ?? fallbackAlternate;

  return { primary, alternate };
}

/**
 * Score entry structure
 * @typedef {Object} ScoreEntry
 * @property {number} score - The score value
 * @property {string} rank - The rank achieved
 * @property {number} accuracy - Accuracy percentage
 * @property {number} maxCombo - Maximum combo achieved
 * @property {number} timestamp - When the score was achieved
 */

/**
 * SaveManager - Singleton class for managing persistent game data
 */
class SaveManager {
  /**
   * Singleton instance
   * @type {SaveManager | null}
   * @private
   */
  static _instance = null;

  /**
   * Cached options
   * @type {Object}
   */
  options = { ...DEFAULT_OPTIONS };

  /**
   * Cached scores
   * @type {Map<string, ScoreEntry>}
   */
  scores = new Map();

  /**
   * Cached progress
   * @type {Object}
   */
  progress = getDefaultProgress();

  /**
   * Whether save data has been loaded
   * @type {boolean}
   */
  loaded = false;

  /**
   * Whether localStorage is available
   * @type {boolean}
   */
  storageAvailable = false;

  /**
   * Private constructor for singleton pattern
   */
  constructor() {
    if (SaveManager._instance) {
      return SaveManager._instance;
    }
    SaveManager._instance = this;
    this.checkStorageAvailability();
  }

  /**
   * Get the singleton instance
   * @returns {SaveManager}
   */
  static getInstance() {
    if (!SaveManager._instance) {
      SaveManager._instance = new SaveManager();
    }
    return SaveManager._instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance() {
    SaveManager._instance = null;
  }

  /**
   * Check if localStorage is available
   * @private
   */
  checkStorageAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      this.storageAvailable = true;
    } catch {
      this.storageAvailable = false;
      console.warn('[SaveManager] localStorage not available, using memory storage');
    }
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize and load all save data
   * @returns {boolean} Whether initialization was successful
   */
  init() {
    if (this.loaded) {
      return true;
    }

    try {
      this.checkStorageAvailability();

      // Check for version and migrate if needed
      this.checkVersion();

      // Load all data
      this.loadOptions();
      this.loadScores();
      this.loadProgress();
      this.migrateLegacyControls();

      this.loaded = true;
      return true;
    } catch (e) {
      console.error('[SaveManager] Failed to initialize:', e);
      return false;
    }
  }

  /**
   * Check save version and migrate if needed
   * @private
   */
  checkVersion() {
    const savedVersion = this.getItem(StorageKeys.VERSION);

    if (!savedVersion) {
      // First time, set version
      this.setItem(StorageKeys.VERSION, SAVE_VERSION);
      return;
    }

    if (savedVersion !== SAVE_VERSION) {
      this.migrate(savedVersion, SAVE_VERSION);
      this.setItem(StorageKeys.VERSION, SAVE_VERSION);
    }
  }

  /**
   * Migrate save data between versions
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @private
   */
  migrate(fromVersion, toVersion) {
    console.warn(`[SaveManager] Migrating from ${fromVersion} to ${toVersion}`);

    // Add migration logic here as versions change
    // Example:
    // if (fromVersion === '0.9.0' && toVersion === '1.0.0') {
    //   // Migrate 0.9.0 -> 1.0.0
    // }
  }

  // ========================================
  // OPTIONS
  // ========================================

  /**
   * Load options from storage
   */
  loadOptions() {
    try {
      const data = this.getItem(StorageKeys.OPTIONS);
      if (data) {
        const parsed = JSON.parse(data);
        // Merge with defaults to ensure all keys exist
        this.options = { ...DEFAULT_OPTIONS, ...parsed };
      } else {
        this.options = { ...DEFAULT_OPTIONS };
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to load options:', e);
      this.options = { ...DEFAULT_OPTIONS };
    }
  }

  migrateLegacyControls() {
    try {
      const raw = this.getItem(StorageKeys.LEGACY_CONTROLS);
      if (!raw) {
        return false;
      }

      const parsed = JSON.parse(raw);
      const noteKeybinds = parsed?.noteKeybinds;
      if (!noteKeybinds || typeof noteKeybinds !== 'object') {
        return false;
      }

      const left = chooseStoredKeys(
        noteKeybinds.left ?? [],
        this.options.keyLeft,
        this.options.keyLeftAlt
      );
      const down = chooseStoredKeys(
        noteKeybinds.down ?? [],
        this.options.keyDown,
        this.options.keyDownAlt
      );
      const up = chooseStoredKeys(noteKeybinds.up ?? [], this.options.keyUp, this.options.keyUpAlt);
      const right = chooseStoredKeys(
        noteKeybinds.right ?? [],
        this.options.keyRight,
        this.options.keyRightAlt
      );

      this.options = {
        ...this.options,
        keyLeft: left.primary,
        keyLeftAlt: left.alternate,
        keyDown: down.primary,
        keyDownAlt: down.alternate,
        keyUp: up.primary,
        keyUpAlt: up.alternate,
        keyRight: right.primary,
        keyRightAlt: right.alternate
      };
      this.saveOptions();
      return true;
    } catch (e) {
      console.warn('[SaveManager] Failed to migrate legacy controls:', e);
      return false;
    }
  }

  /**
   * Save options to storage
   */
  saveOptions() {
    try {
      this.setItem(StorageKeys.OPTIONS, JSON.stringify(this.options));
      return true;
    } catch (e) {
      console.error('[SaveManager] Failed to save options:', e);
      return false;
    }
  }

  /**
   * Get an option value
   * @param {string} key - Option key
   * @returns {*} Option value
   */
  getOption(key) {
    return this.options[key] ?? DEFAULT_OPTIONS[key];
  }

  /**
   * Set an option value
   * @param {string} key - Option key
   * @param {*} value - Option value
   * @param {boolean} [autoSave=true] - Whether to auto-save
   */
  setOption(key, value, autoSave = true) {
    this.options[key] = value;
    if (autoSave) {
      this.saveOptions();
    }
  }

  /**
   * Set multiple options at once
   * @param {Object} options - Options to set
   * @param {boolean} [autoSave=true] - Whether to auto-save
   */
  setOptions(options, autoSave = true) {
    Object.assign(this.options, options);
    if (autoSave) {
      this.saveOptions();
    }
  }

  /**
   * Reset options to defaults
   */
  resetOptions() {
    this.options = { ...DEFAULT_OPTIONS };
    this.saveOptions();
  }

  /**
   * Get all options
   * @returns {Object}
   */
  getAllOptions() {
    return { ...this.options };
  }

  // ========================================
  // INPUT DELAY COMPENSATION
  // ========================================

  /**
   * Get the input delay compensation value
   * @returns {number} Delay compensation in ms (-50 to +50)
   */
  getInputDelayCompensation() {
    return this.options.inputDelayCompensation ?? 0;
  }

  /**
   * Set the input delay compensation value with clamping
   * @param {number} value - Delay compensation in ms
   * @param {boolean} [autoSave=true] - Whether to auto-save
   * @returns {number} The clamped value that was set
   */
  setInputDelayCompensation(value, autoSave = true) {
    // Clamp to valid range [-50, +50]
    const clamped = Math.max(INPUT_DELAY_MIN, Math.min(INPUT_DELAY_MAX, value));
    this.options.inputDelayCompensation = clamped;
    if (autoSave) {
      this.saveOptions();
    }
    return clamped;
  }

  /**
   * Apply delay compensation to an input timestamp
   * Positive values mean inputs are treated as if they happened later (for players who hit early)
   * Negative values mean inputs are treated as if they happened earlier (for players who hit late)
   * @param {number} timestamp - Original input timestamp
   * @returns {number} Adjusted timestamp with delay compensation applied
   */
  applyDelayCompensation(timestamp) {
    const compensation = this.getInputDelayCompensation();
    return timestamp + compensation;
  }

  /**
   * Get the input buffer window value
   * @returns {number} Buffer window in ms (0-100)
   */
  getInputBufferWindow() {
    return this.options.inputBufferWindow ?? 50;
  }

  /**
   * Set the input buffer window value with clamping
   * @param {number} value - Buffer window in ms
   * @param {boolean} [autoSave=true] - Whether to auto-save
   * @returns {number} The clamped value that was set
   */
  setInputBufferWindow(value, autoSave = true) {
    // Clamp to valid range [0, 100]
    const clamped = Math.max(0, Math.min(100, value));
    this.options.inputBufferWindow = clamped;
    if (autoSave) {
      this.saveOptions();
    }
    return clamped;
  }

  // ========================================
  // SCORES
  // ========================================

  /**
   * Load scores from storage
   */
  loadScores() {
    try {
      const data = this.getItem(StorageKeys.SCORES);
      if (data) {
        const parsed = JSON.parse(data);
        this.scores = new Map(Object.entries(parsed));
      } else {
        this.scores = new Map();
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to load scores:', e);
      this.scores = new Map();
    }
  }

  /**
   * Save scores to storage
   */
  saveScores() {
    try {
      const obj = Object.fromEntries(this.scores);
      this.setItem(StorageKeys.SCORES, JSON.stringify(obj));
      return true;
    } catch (e) {
      console.error('[SaveManager] Failed to save scores:', e);
      return false;
    }
  }

  /**
   * Generate a score key
   * @param {string} songId - Song identifier
   * @param {string} difficulty - Difficulty level
   * @returns {string}
   * @private
   */
  getScoreKey(songId, difficulty) {
    return `${songId}:${difficulty}`;
  }

  /**
   * Get high score for a song
   * @param {string} songId - Song identifier
   * @param {string} difficulty - Difficulty level
   * @returns {ScoreEntry | null}
   */
  getHighScore(songId, difficulty) {
    const key = this.getScoreKey(songId, difficulty);
    return this.scores.get(key) || null;
  }

  /**
   * Set high score for a song (only if better)
   * @param {string} songId - Song identifier
   * @param {string} difficulty - Difficulty level
   * @param {ScoreEntry} scoreEntry - Score data
   * @returns {boolean} Whether the score was a new high score
   */
  setHighScore(songId, difficulty, scoreEntry) {
    const key = this.getScoreKey(songId, difficulty);
    const existing = this.scores.get(key);

    // Only save if it's a new high score
    if (!existing || scoreEntry.score > existing.score) {
      this.scores.set(key, {
        ...scoreEntry,
        timestamp: Date.now()
      });
      this.saveScores();
      return true;
    }

    return false;
  }

  /**
   * Get all scores for a song (all difficulties)
   * @param {string} songId - Song identifier
   * @returns {Map<string, ScoreEntry>}
   */
  getSongScores(songId) {
    const result = new Map();
    for (const [key, value] of this.scores) {
      if (key.startsWith(`${songId}:`)) {
        const difficulty = key.split(':')[1];
        result.set(difficulty, value);
      }
    }
    return result;
  }

  /**
   * Get total score across all songs
   * @returns {number}
   */
  getTotalScore() {
    let total = 0;
    for (const entry of this.scores.values()) {
      total += entry.score;
    }
    return total;
  }

  /**
   * Clear all scores
   */
  clearScores() {
    this.scores.clear();
    this.saveScores();
  }

  // ========================================
  // PROGRESS
  // ========================================

  /**
   * Load progress from storage
   */
  loadProgress() {
    try {
      const data = this.getItem(StorageKeys.PROGRESS);
      if (data) {
        const parsed = JSON.parse(data);
        this.progress = {
          ...getDefaultProgress(),
          ...parsed,
          unlockedWeeks: uniqueList(parsed.unlockedWeeks ?? DEFAULT_PROGRESS.unlockedWeeks),
          completedSongs: uniqueList(parsed.completedSongs),
          completedLevels: uniqueList(parsed.completedLevels),
          storyProgress: { ...DEFAULT_PROGRESS.storyProgress, ...(parsed.storyProgress ?? {}) }
        };
      } else {
        this.progress = getDefaultProgress();
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to load progress:', e);
      this.progress = getDefaultProgress();
    }
  }

  /**
   * Save progress to storage
   */
  saveProgress() {
    try {
      this.setItem(StorageKeys.PROGRESS, JSON.stringify(this.progress));
      return true;
    } catch (e) {
      console.error('[SaveManager] Failed to save progress:', e);
      return false;
    }
  }

  /**
   * Check if a week is unlocked
   * @param {string} weekId - Week identifier
   * @returns {boolean}
   */
  isWeekUnlocked(weekId) {
    return this.progress.unlockedWeeks.includes(weekId);
  }

  /**
   * Unlock a week
   * @param {string} weekId - Week identifier
   */
  unlockWeek(weekId) {
    if (!this.progress.unlockedWeeks.includes(weekId)) {
      this.progress.unlockedWeeks.push(weekId);
      this.saveProgress();
    }
  }

  /**
   * Check if a song has been completed
   * @param {string} songId - Song identifier
   * @param {string} [difficulty] - Optional difficulty
   * @returns {boolean}
   */
  isSongCompleted(songId, difficulty) {
    if (difficulty) {
      return this.progress.completedSongs.includes(`${songId}:${difficulty}`);
    }
    return this.progress.completedSongs.some((s) => s.startsWith(`${songId}:`));
  }

  /**
   * Mark a song as completed
   * @param {string} songId - Song identifier
   * @param {string} difficulty - Difficulty level
   */
  completeSong(songId, difficulty) {
    const key = `${songId}:${difficulty}`;
    if (!this.progress.completedSongs.includes(key)) {
      this.progress.completedSongs.push(key);
      this.saveProgress();
    }
  }

  isLevelCompleted(levelId) {
    return this.progress.completedLevels.includes(levelId);
  }

  completeLevel(levelId) {
    if (!levelId) {
      return;
    }

    if (!this.progress.completedLevels.includes(levelId)) {
      this.progress.completedLevels.push(levelId);
      this.saveProgress();
    }
  }

  recordSongResult(result) {
    const { levelId, songId, difficulty, score, rank, accuracy, maxCombo } = result;

    const newHighScore = this.setHighScore(songId, difficulty, {
      score,
      rank,
      accuracy,
      maxCombo
    });
    this.completeSong(songId, difficulty);
    this.completeLevel(levelId);
    return newHighScore;
  }

  /**
   * Get story mode progress for a week
   * @param {string} weekId - Week identifier
   * @returns {Object}
   */
  getStoryProgress(weekId) {
    return this.progress.storyProgress[weekId] || { currentSong: 0, completed: false };
  }

  /**
   * Set story mode progress for a week
   * @param {string} weekId - Week identifier
   * @param {Object} data - Progress data
   */
  setStoryProgress(weekId, data) {
    this.progress.storyProgress[weekId] = data;
    this.saveProgress();
  }

  /**
   * Reset all progress
   */
  resetProgress() {
    this.progress = getDefaultProgress();
    this.saveProgress();
  }

  // ========================================
  // STORAGE HELPERS
  // ========================================

  /**
   * Get item from storage
   * @param {string} key - Storage key
   * @returns {string | null}
   * @private
   */
  getItem(key) {
    if (!this.storageAvailable) {
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[SaveManager] Failed to get ${key}:`, e);
      return null;
    }
  }

  /**
   * Set item in storage
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @private
   */
  setItem(key, value) {
    if (!this.storageAvailable) {
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error(`[SaveManager] Failed to set ${key}:`, e);
    }
  }

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   * @private
   */
  removeItem(key) {
    if (!this.storageAvailable) {
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[SaveManager] Failed to remove ${key}:`, e);
    }
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Clear all save data
   */
  clearAll() {
    this.options = { ...DEFAULT_OPTIONS };
    this.scores = new Map();
    this.progress = getDefaultProgress();

    this.removeItem(StorageKeys.OPTIONS);
    this.removeItem(StorageKeys.SCORES);
    this.removeItem(StorageKeys.PROGRESS);
    this.removeItem(StorageKeys.VERSION);
    this.removeItem(StorageKeys.LEGACY_CONTROLS);
  }

  /**
   * Export all save data as JSON
   * @returns {string}
   */
  exportData() {
    return JSON.stringify(
      {
        version: SAVE_VERSION,
        options: this.options,
        scores: Object.fromEntries(this.scores),
        progress: this.progress
      },
      null,
      2
    );
  }

  /**
   * Import save data from JSON
   * @param {string} jsonData - JSON string to import
   * @returns {boolean} Whether import was successful
   */
  importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);

      if (data.options) {
        this.options = { ...DEFAULT_OPTIONS, ...data.options };
        this.saveOptions();
      }

      if (data.scores) {
        this.scores = new Map(Object.entries(data.scores));
        this.saveScores();
      }

      if (data.progress) {
        this.progress = {
          ...getDefaultProgress(),
          ...data.progress,
          unlockedWeeks: uniqueList(data.progress.unlockedWeeks ?? DEFAULT_PROGRESS.unlockedWeeks),
          completedSongs: uniqueList(data.progress.completedSongs),
          completedLevels: uniqueList(data.progress.completedLevels),
          storyProgress: {
            ...DEFAULT_PROGRESS.storyProgress,
            ...(data.progress.storyProgress ?? {})
          }
        };
        this.saveProgress();
      }

      return true;
    } catch (e) {
      console.error('[SaveManager] Failed to import data:', e);
      return false;
    }
  }
}

export default SaveManager;

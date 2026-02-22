/**
 * @fileoverview ReplayManager - Manages replay storage and retrieval
 * Handles saving, loading, listing, and deleting replays.
 *
 * Part of the competitive features implementation.
 */

/**
 * @typedef {import('./ReplayRecorder.js').ReplayData} ReplayData
 */

/**
 * @typedef {Object} ReplayListEntry
 * @property {string} id - Unique replay ID
 * @property {string} songId - Song identifier
 * @property {string} songName - Display name
 * @property {string} difficulty - Difficulty level
 * @property {number} score - Final score
 * @property {number} accuracy - Accuracy percentage
 * @property {number} timestamp - Recording timestamp
 */

/**
 * Manages replay storage and retrieval.
 * Uses localStorage for persistence with a maximum replay limit.
 */
class ReplayManager {
  /**
   * Storage key for replay data
   * @type {string}
   * @static
   */
  static STORAGE_KEY = 'fnf-replays';

  /**
   * Storage key for replay index
   * @type {string}
   * @static
   */
  static INDEX_KEY = 'fnf-replay-idx';

  /**
   * Maximum number of replays to store
   * @type {number}
   * @static
   */
  static MAX_REPLAYS = 50;

  /**
   * Replay index (metadata for quick listing)
   * @type {ReplayListEntry[]}
   */
  replayIndex = [];

  /**
   * Create a new ReplayManager
   */
  constructor() {
    this.loadIndex();
  }

  // ========================================
  // INDEX MANAGEMENT
  // ========================================

  /**
   * Load replay index from storage
   * @private
   */
  loadIndex() {
    try {
      const indexData = localStorage.getItem(ReplayManager.INDEX_KEY);
      if (indexData) {
        this.replayIndex = JSON.parse(indexData);
      } else {
        this.replayIndex = [];
      }
    } catch (error) {
      console.error('ReplayManager: Failed to load replay index', error);
      this.replayIndex = [];
    }
  }

  /**
   * Save replay index to storage
   * @private
   */
  saveIndex() {
    try {
      localStorage.setItem(ReplayManager.INDEX_KEY, JSON.stringify(this.replayIndex));
    } catch (error) {
      console.error('ReplayManager: Failed to save replay index', error);
    }
  }

  /**
   * Generate a unique replay ID
   * @returns {string}
   * @private
   */
  generateId() {
    return `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================
  // REPLAY OPERATIONS
  // ========================================

  /**
   * Save a replay
   * @param {ReplayData} replayData - Replay to save
   * @returns {string} Replay ID
   */
  saveReplay(replayData) {
    // Enforce max replays limit
    while (this.replayIndex.length >= ReplayManager.MAX_REPLAYS) {
      // Remove oldest replay
      const oldest = this.replayIndex.pop();
      if (oldest) {
        this.deleteReplayData(oldest.id);
      }
    }

    const id = this.generateId();

    // Create index entry
    /** @type {ReplayListEntry} */
    const entry = {
      id,
      songId: replayData.songId,
      songName: replayData.songId, // TODO: Look up display name from registry
      difficulty: replayData.difficulty,
      score: replayData.score,
      accuracy: replayData.metadata?.accuracy ?? 0,
      timestamp: replayData.timestamp
    };

    // Add to index (newest first)
    this.replayIndex.unshift(entry);
    this.saveIndex();

    // Save replay data
    try {
      const storageKey = `${ReplayManager.STORAGE_KEY}_${id}`;
      localStorage.setItem(storageKey, JSON.stringify(replayData));
    } catch (error) {
      console.error('ReplayManager: Failed to save replay data', error);
      // Remove from index if save failed
      this.replayIndex.shift();
      this.saveIndex();
      throw error;
    }

    return id;
  }

  /**
   * Load a replay by ID
   * @param {string} replayId - Replay ID
   * @returns {ReplayData | null}
   */
  loadReplay(replayId) {
    try {
      const storageKey = `${ReplayManager.STORAGE_KEY}_${replayId}`;
      const data = localStorage.getItem(storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('ReplayManager: Failed to load replay', error);
    }
    return null;
  }

  /**
   * Delete replay data from storage
   * @param {string} replayId - Replay ID
   * @private
   */
  deleteReplayData(replayId) {
    try {
      const storageKey = `${ReplayManager.STORAGE_KEY}_${replayId}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('ReplayManager: Failed to delete replay data', error);
    }
  }

  /**
   * Delete a replay
   * @param {string} replayId - Replay ID
   * @returns {boolean} Whether deletion was successful
   */
  deleteReplay(replayId) {
    const index = this.replayIndex.findIndex((entry) => entry.id === replayId);
    if (index === -1) {
      return false;
    }

    // Remove from index
    this.replayIndex.splice(index, 1);
    this.saveIndex();

    // Remove data
    this.deleteReplayData(replayId);

    return true;
  }

  /**
   * Get list of all replays
   * @returns {ReplayListEntry[]}
   */
  getReplayList() {
    // Return sorted by timestamp (newest first)
    return [...this.replayIndex].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Filter replays by song
   * @param {string} songId - Song to filter by
   * @returns {ReplayListEntry[]}
   */
  filterBySong(songId) {
    return this.getReplayList().filter((entry) => entry.songId === songId);
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Get the number of stored replays
   * @returns {number}
   */
  getReplayCount() {
    return this.replayIndex.length;
  }

  /**
   * Check if storage is at capacity
   * @returns {boolean}
   */
  isAtCapacity() {
    return this.replayIndex.length >= ReplayManager.MAX_REPLAYS;
  }

  /**
   * Clear all replays
   */
  clearAll() {
    // Delete all replay data
    for (const entry of this.replayIndex) {
      this.deleteReplayData(entry.id);
    }

    // Clear index
    this.replayIndex = [];
    this.saveIndex();
  }
}

export default ReplayManager;

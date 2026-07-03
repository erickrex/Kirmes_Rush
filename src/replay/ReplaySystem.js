/**
 * @fileoverview ReplaySystem - Unified replay recording, playback, and storage
 * Combines ReplayRecorder, ReplayPlayer, and ReplayManager into a single module.
 *
 * Part of the competitive features implementation.
 */

// ========================================
// TYPES
// ========================================

// Types are defined locally in this module

/**
 * @typedef {Object} ReplayInputEvent
 * @property {number} time - Time in ms from song start
 * @property {'press' | 'release'} type - Event type
 * @property {number} direction - Direction (0-3)
 * @property {string} keyCode - Key code used
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
 * @typedef {Object} ReplayDataFull
 * @property {string} version - Replay format version
 * @property {string} songId - Song identifier
 * @property {string} difficulty - Difficulty level
 * @property {number} timestamp - Recording timestamp
 * @property {number} score - Final score
 * @property {Record<string, any>} tallies - Final tallies
 * @property {number} seed - Random seed
 * @property {ReplayInputEvent[]} inputs - Recorded input frames
 * @property {Record<string, any>} metadata - Additional metadata
 */

// ========================================
// REPLAY RECORDER
// ========================================

/**
 * Records player inputs during gameplay with precise timestamps.
 */
export class ReplayRecorder {
  static VERSION = '1.0.0';

  recording = false;
  /** @type {ReplayInputEvent[]} */
  inputs = [];
  songStartTime = 0;
  songId = '';
  difficulty = '';
  seed = 0;
  /** @type {Record<string, any>} */
  metadata = {};

  constructor() {
    this.reset();
  }

  /**
   * @param {string} songId
   * @param {string} difficulty
   */
  start(songId, difficulty) {
    this.reset();
    this.recording = true;
    this.songId = songId;
    this.difficulty = difficulty;
    this.songStartTime = performance.now();
    this.seed = Math.random();
  }

  /**
   * @param {'press' | 'release'} type
   * @param {number} direction
   * @param {string} keyCode
   * @param {number} songPosition
   */
  recordInput(type, direction, keyCode, songPosition) {
    if (!this.recording) {
      return;
    }
    this.inputs.push({ time: songPosition, type, direction, keyCode });
  }

  /**
   * @param {number} score
   * @param {Record<string, any>} tallies
   * @returns {ReplayDataFull}
   */
  stop(score, tallies) {
    this.recording = false;
    return {
      version: ReplayRecorder.VERSION,
      songId: this.songId,
      difficulty: this.difficulty,
      timestamp: Date.now(),
      score,
      tallies: { ...tallies },
      seed: this.seed,
      inputs: [...this.inputs],
      metadata: {
        ...this.metadata,
        gameVersion: '1.0.0',
        accuracy:
          tallies.totalNotesHit && tallies.totalNotes
            ? (tallies.totalNotesHit / tallies.totalNotes) * 100
            : 0
      }
    };
  }

  discard() {
    this.reset();
  }

  reset() {
    this.recording = false;
    this.inputs = [];
    this.songStartTime = 0;
    this.songId = '';
    this.difficulty = '';
    this.seed = 0;
    this.metadata = {};
  }

  isRecording() {
    return this.recording;
  }
  getInputCount() {
    return this.inputs.length;
  }
}

// ========================================
// REPLAY PLAYER
// ========================================

/**
 * Plays back recorded inputs during replay mode.
 */
export class ReplayPlayer {
  static SUPPORTED_VERSION = '1.0.0';

  /** @type {ReplayDataFull | null} */
  replayData = null;
  inputIndex = 0;
  playing = false;

  constructor() {
    this.reset();
  }

  /**
   * @param {ReplayDataFull} replayData
   * @returns {boolean}
   */
  load(replayData) {
    if (!replayData) {
      console.error('ReplayPlayer: No replay data provided');
      return false;
    }
    if (replayData.version !== ReplayPlayer.SUPPORTED_VERSION) {
      console.error(`ReplayPlayer: Unsupported replay version ${replayData.version}`);
      return false;
    }
    if (!replayData.songId || !replayData.inputs) {
      console.error('ReplayPlayer: Invalid replay data - missing required fields');
      return false;
    }
    this.replayData = replayData;
    this.inputIndex = 0;
    this.playing = false;
    return true;
  }

  start() {
    if (!this.replayData) {
      console.error('ReplayPlayer: No replay loaded');
      return;
    }
    this.playing = true;
    this.inputIndex = 0;
  }

  /**
   * @param {number} songPosition
   * @returns {ReplayInputEvent[]}
   */
  getInputsForPosition(songPosition) {
    if (!this.playing || !this.replayData) {
      return [];
    }
    const inputs = [];
    const allInputs = this.replayData.inputs;
    while (this.inputIndex < allInputs.length && allInputs[this.inputIndex].time <= songPosition) {
      inputs.push(allInputs[this.inputIndex]);
      this.inputIndex++;
    }
    return inputs;
  }

  isComplete() {
    if (!this.replayData) {
      return true;
    }
    return this.inputIndex >= this.replayData.inputs.length;
  }

  stop() {
    this.playing = false;
  }

  reset() {
    this.replayData = null;
    this.inputIndex = 0;
    this.playing = false;
  }

  isPlaying() {
    return this.playing;
  }
  getSongId() {
    return this.replayData?.songId ?? null;
  }
  getDifficulty() {
    return this.replayData?.difficulty ?? null;
  }
  getOriginalScore() {
    return this.replayData?.score ?? 0;
  }
  getTotalInputs() {
    return this.replayData?.inputs.length ?? 0;
  }

  getRemainingInputs() {
    if (!this.replayData) {
      return 0;
    }
    return this.replayData.inputs.length - this.inputIndex;
  }
}

// ========================================
// REPLAY MANAGER
// ========================================

/**
 * Manages replay storage and retrieval using localStorage.
 */
export class ReplayManager {
  static STORAGE_KEY = 'rythm-replays';
  static INDEX_KEY = 'rythm-replay-idx';
  static MAX_REPLAYS = 50;

  /** @type {ReplayListEntry[]} */
  replayIndex = [];

  constructor() {
    this.loadIndex();
  }

  /** @private */
  loadIndex() {
    try {
      const indexData = localStorage.getItem(ReplayManager.INDEX_KEY);
      this.replayIndex = indexData ? JSON.parse(indexData) : [];
    } catch (error) {
      console.error('ReplayManager: Failed to load replay index', error);
      this.replayIndex = [];
    }
  }

  /** @private */
  saveIndex() {
    try {
      localStorage.setItem(ReplayManager.INDEX_KEY, JSON.stringify(this.replayIndex));
    } catch (error) {
      console.error('ReplayManager: Failed to save replay index', error);
    }
  }

  /** @private */
  generateId() {
    return `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * @param {ReplayDataFull} replayData
   * @returns {string}
   */
  saveReplay(replayData) {
    while (this.replayIndex.length >= ReplayManager.MAX_REPLAYS) {
      const oldest = this.replayIndex.pop();
      if (oldest) {
        this.deleteReplayData(oldest.id);
      }
    }

    const id = this.generateId();
    const entry = {
      id,
      songId: replayData.songId,
      songName: replayData.songId,
      difficulty: replayData.difficulty,
      score: replayData.score,
      accuracy: replayData.metadata?.accuracy ?? 0,
      timestamp: replayData.timestamp
    };

    this.replayIndex.unshift(entry);
    this.saveIndex();

    try {
      localStorage.setItem(`${ReplayManager.STORAGE_KEY}_${id}`, JSON.stringify(replayData));
    } catch (error) {
      console.error('ReplayManager: Failed to save replay data', error);
      this.replayIndex.shift();
      this.saveIndex();
      throw error;
    }

    return id;
  }

  /**
   * @param {string} replayId
   * @returns {ReplayDataFull | null}
   */
  loadReplay(replayId) {
    try {
      const data = localStorage.getItem(`${ReplayManager.STORAGE_KEY}_${replayId}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('ReplayManager: Failed to load replay', error);
    }
    return null;
  }

  /** @param {string} replayId @private */
  deleteReplayData(replayId) {
    try {
      localStorage.removeItem(`${ReplayManager.STORAGE_KEY}_${replayId}`);
    } catch (error) {
      console.error('ReplayManager: Failed to delete replay data', error);
    }
  }

  /**
   * @param {string} replayId
   * @returns {boolean}
   */
  deleteReplay(replayId) {
    const index = this.replayIndex.findIndex((entry) => entry.id === replayId);
    if (index === -1) {
      return false;
    }
    this.replayIndex.splice(index, 1);
    this.saveIndex();
    this.deleteReplayData(replayId);
    return true;
  }

  /** @returns {ReplayListEntry[]} */
  getReplayList() {
    return [...this.replayIndex].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * @param {string} songId
   * @returns {ReplayListEntry[]}
   */
  filterBySong(songId) {
    return this.getReplayList().filter((entry) => entry.songId === songId);
  }

  /** @returns {number} */
  getReplayCount() {
    return this.replayIndex.length;
  }
  /** @returns {boolean} */
  isAtCapacity() {
    return this.replayIndex.length >= ReplayManager.MAX_REPLAYS;
  }

  /** @returns {void} */
  clearAll() {
    for (const entry of this.replayIndex) {
      this.deleteReplayData(entry.id);
    }
    this.replayIndex = [];
    this.saveIndex();
  }
}

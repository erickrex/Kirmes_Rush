/**
 * @fileoverview ReplayRecorder - Records player inputs during gameplay
 * Captures all input events with precise timestamps for replay functionality.
 *
 * Part of the competitive features implementation.
 */

/**
 * @typedef {Object} ReplayInputEvent
 * @property {number} time - Time in ms from song start
 * @property {'press' | 'release'} type - Event type
 * @property {number} direction - Direction (0-3)
 * @property {string} keyCode - Key code used
 */

/**
 * @typedef {Object} ReplayData
 * @property {string} version - Replay format version
 * @property {string} songId - Song identifier
 * @property {string} difficulty - Difficulty level
 * @property {number} timestamp - Recording timestamp (Date.now())
 * @property {number} score - Final score
 * @property {Object} tallies - Final tallies
 * @property {number} seed - Random seed for determinism
 * @property {ReplayInputEvent[]} inputs - Recorded inputs
 * @property {Object} metadata - Additional metadata
 */

/**
 * Records player inputs during gameplay with precise timestamps.
 * Used to create replays that can be played back later.
 */
class ReplayRecorder {
  /**
   * Current replay format version
   * @type {string}
   * @static
   */
  static VERSION = '1.0.0';

  /**
   * Whether recording is active
   * @type {boolean}
   */
  recording = false;

  /**
   * Recorded input events
   * @type {ReplayInputEvent[]}
   */
  inputs = [];

  /**
   * Song start time for relative timestamps
   * @type {number}
   */
  songStartTime = 0;

  /**
   * Song identifier being recorded
   * @type {string}
   */
  songId = '';

  /**
   * Difficulty level being recorded
   * @type {string}
   */
  difficulty = '';

  /**
   * Random seed for deterministic playback
   * @type {number}
   */
  seed = 0;

  /**
   * Additional metadata
   * @type {Object}
   */
  metadata = {};

  /**
   * Create a new ReplayRecorder
   */
  constructor() {
    this.reset();
  }

  // ========================================
  // RECORDING CONTROL
  // ========================================

  /**
   * Start recording for a song
   * @param {string} songId - Song identifier
   * @param {string} difficulty - Difficulty level
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
   * Record an input event
   * @param {'press' | 'release'} type - Event type
   * @param {number} direction - Direction (0-3)
   * @param {string} keyCode - Key code
   * @param {number} songPosition - Current song position in ms
   */
  recordInput(type, direction, keyCode, songPosition) {
    if (!this.recording) return;

    this.inputs.push({
      time: songPosition,
      type,
      direction,
      keyCode
    });
  }

  /**
   * Stop recording and return replay data
   * @param {number} score - Final score
   * @param {Object} tallies - Final tallies
   * @returns {ReplayData}
   */
  stop(score, tallies) {
    this.recording = false;

    /** @type {ReplayData} */
    const replayData = {
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
        accuracy: tallies.totalNotesHit && tallies.totalNotes
          ? (tallies.totalNotesHit / tallies.totalNotes) * 100
          : 0
      }
    };

    return replayData;
  }

  /**
   * Discard current recording
   */
  discard() {
    this.reset();
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Reset recorder state
   */
  reset() {
    this.recording = false;
    this.inputs = [];
    this.songStartTime = 0;
    this.songId = '';
    this.difficulty = '';
    this.seed = 0;
    this.metadata = {};
  }

  /**
   * Check if currently recording
   * @returns {boolean}
   */
  isRecording() {
    return this.recording;
  }

  /**
   * Get the number of recorded inputs
   * @returns {number}
   */
  getInputCount() {
    return this.inputs.length;
  }
}

export default ReplayRecorder;

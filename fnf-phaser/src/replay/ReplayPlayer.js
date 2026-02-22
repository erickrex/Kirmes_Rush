/**
 * @fileoverview ReplayPlayer - Plays back recorded inputs during replay mode
 * Feeds recorded inputs to the gameplay system at their recorded timestamps.
 *
 * Part of the competitive features implementation.
 */

/**
 * @typedef {import('./ReplayRecorder.js').ReplayInputEvent} ReplayInputEvent
 * @typedef {import('./ReplayRecorder.js').ReplayData} ReplayData
 */

/**
 * Plays back recorded inputs during replay mode.
 * Validates replay data and feeds inputs at correct timestamps.
 */
class ReplayPlayer {
  /**
   * Supported replay format version
   * @type {string}
   * @static
   */
  static SUPPORTED_VERSION = '1.0.0';

  /**
   * Loaded replay data
   * @type {ReplayData | null}
   */
  replayData = null;

  /**
   * Current index in the inputs array
   * @type {number}
   */
  inputIndex = 0;

  /**
   * Whether playback is active
   * @type {boolean}
   */
  playing = false;

  /**
   * Create a new ReplayPlayer
   */
  constructor() {
    this.reset();
  }

  // ========================================
  // LOADING
  // ========================================

  /**
   * Load replay data
   * @param {ReplayData} replayData - Replay to load
   * @returns {boolean} Whether load was successful
   */
  load(replayData) {
    // Validate replay data
    if (!replayData) {
      console.error('ReplayPlayer: No replay data provided');
      return false;
    }

    // Check version compatibility
    if (replayData.version !== ReplayPlayer.SUPPORTED_VERSION) {
      console.error(`ReplayPlayer: Unsupported replay version ${replayData.version}`);
      return false;
    }

    // Validate required fields
    if (!replayData.songId || !replayData.inputs) {
      console.error('ReplayPlayer: Invalid replay data - missing required fields');
      return false;
    }

    this.replayData = replayData;
    this.inputIndex = 0;
    this.playing = false;

    return true;
  }

  // ========================================
  // PLAYBACK CONTROL
  // ========================================

  /**
   * Start playback
   */
  start() {
    if (!this.replayData) {
      console.error('ReplayPlayer: No replay loaded');
      return;
    }

    this.playing = true;
    this.inputIndex = 0;
  }

  /**
   * Get inputs that should fire at current song position
   * @param {number} songPosition - Current song position in ms
   * @returns {ReplayInputEvent[]} Inputs to process
   */
  getInputsForPosition(songPosition) {
    if (!this.playing || !this.replayData) {
      return [];
    }

    const inputs = [];
    const allInputs = this.replayData.inputs;

    // Collect all inputs up to current position
    while (
      this.inputIndex < allInputs.length &&
      allInputs[this.inputIndex].time <= songPosition
    ) {
      inputs.push(allInputs[this.inputIndex]);
      this.inputIndex++;
    }

    return inputs;
  }

  /**
   * Check if playback is complete
   * @returns {boolean}
   */
  isComplete() {
    if (!this.replayData) return true;
    return this.inputIndex >= this.replayData.inputs.length;
  }

  /**
   * Stop playback
   */
  stop() {
    this.playing = false;
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Reset player state
   */
  reset() {
    this.replayData = null;
    this.inputIndex = 0;
    this.playing = false;
  }

  /**
   * Check if currently playing
   * @returns {boolean}
   */
  isPlaying() {
    return this.playing;
  }

  /**
   * Get the loaded replay's song ID
   * @returns {string | null}
   */
  getSongId() {
    return this.replayData?.songId ?? null;
  }

  /**
   * Get the loaded replay's difficulty
   * @returns {string | null}
   */
  getDifficulty() {
    return this.replayData?.difficulty ?? null;
  }

  /**
   * Get the loaded replay's original score
   * @returns {number}
   */
  getOriginalScore() {
    return this.replayData?.score ?? 0;
  }

  /**
   * Get the total number of inputs in the replay
   * @returns {number}
   */
  getTotalInputs() {
    return this.replayData?.inputs.length ?? 0;
  }

  /**
   * Get the number of remaining inputs
   * @returns {number}
   */
  getRemainingInputs() {
    if (!this.replayData) return 0;
    return this.replayData.inputs.length - this.inputIndex;
  }
}

export default ReplayPlayer;

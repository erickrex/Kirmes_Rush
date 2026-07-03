/**
 * @fileoverview NPSMeter - Notes-Per-Second tracking for competitive HUD
 * Tracks and calculates notes hit per second using a sliding window.
 *
 * Implements Requirements 7.1, 7.2, 7.3, 7.5
 */

/**
 * Notes-Per-Second meter for tracking hit density.
 * Uses a 1-second sliding window to calculate current NPS
 * and tracks peak NPS achieved during the song.
 */
class NPSMeter {
  /**
   * Array of recent hit timestamps within the sliding window
   * @type {number[]}
   */
  recentHits = [];

  /**
   * Sliding window size in milliseconds (1 second)
   * @type {number}
   */
  windowMs = 1000;

  /**
   * Current notes-per-second value
   * @type {number}
   */
  currentNPS = 0;

  /**
   * Peak NPS achieved during the song
   * @type {number}
   */
  peakNPS = 0;

  /**
   * Total number of hits recorded
   * @type {number}
   */
  totalHits = 0;

  /**
   * Song start time for average calculation
   * @type {number}
   */
  startTime = 0;

  /**
   * Create a new NPSMeter
   * @param {number} [startTime=0] - Song start time in ms
   */
  constructor(startTime = 0) {
    this.startTime = startTime;
    this.reset();
  }

  /**
   * Record a note hit at the given timestamp.
   * Adds the timestamp to the recent hits array and increments total hits.
   *
   * @param {number} timestamp - Hit timestamp in ms
   */
  recordHit(timestamp) {
    this.recentHits.push(timestamp);
    this.totalHits++;
  }

  /**
   * Update NPS calculation based on current time.
   * Removes expired hits from the sliding window and calculates current NPS.
   * Updates peak NPS if current exceeds previous peak.
   *
   * @param {number} currentTime - Current time in ms
   */
  update(currentTime) {
    // Remove hits outside the sliding window
    const windowStart = currentTime - this.windowMs;
    this.recentHits = this.recentHits.filter((time) => time > windowStart);

    // Calculate current NPS (hits in the last second)
    this.currentNPS = this.recentHits.length;

    // Update peak if current exceeds it
    if (this.currentNPS > this.peakNPS) {
      this.peakNPS = this.currentNPS;
    }
  }

  /**
   * Get the average NPS for the entire song.
   * Calculated as total hits divided by song duration in seconds.
   *
   * @param {number} [currentTime] - Current time in ms (optional, uses last update time if not provided)
   * @returns {number} Average NPS for the song
   */
  getAverageNPS(currentTime) {
    const duration = currentTime !== undefined ? (currentTime - this.startTime) / 1000 : 0;

    if (duration <= 0) {
      return 0;
    }

    return this.totalHits / duration;
  }

  /**
   * Get current NPS value
   * @returns {number}
   */
  getCurrentNPS() {
    return this.currentNPS;
  }

  /**
   * Get peak NPS value
   * @returns {number}
   */
  getPeakNPS() {
    return this.peakNPS;
  }

  /**
   * Get total hits recorded
   * @returns {number}
   */
  getTotalHits() {
    return this.totalHits;
  }

  /**
   * Reset the meter to initial state.
   * Clears all recorded hits and resets counters.
   *
   * @param {number} [startTime] - New start time (optional)
   */
  reset(startTime) {
    this.recentHits = [];
    this.currentNPS = 0;
    this.peakNPS = 0;
    this.totalHits = 0;

    if (startTime !== undefined) {
      this.startTime = startTime;
    }
  }
}

export default NPSMeter;

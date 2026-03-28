/**
 * @fileoverview PerformanceMonitor - Tracks FPS and signals when to reduce visual effects.
 * Uses a rolling average over a configurable sample window to detect sustained low performance.
 *
 * @module core/PerformanceMonitor
 */

import { LOW_FPS_THRESHOLD, FPS_SAMPLE_WINDOW } from '../layout/LayoutManager.js';

/**
 * Monitors game performance by tracking a rolling FPS average.
 * When the average FPS drops below the threshold for a sustained period,
 * signals that non-essential visual effects should be disabled.
 */
class PerformanceMonitor {
  /**
   * Reference to the Phaser game instance
   * @type {Object|null}
   */
  game = null;

  /**
   * Rolling sum of FPS samples within the current window
   * @type {number}
   */
  _fpsSum = 0;

  /**
   * Number of FPS samples collected in the current window
   * @type {number}
   */
  _sampleCount = 0;

  /**
   * Elapsed time in the current sample window (ms)
   * @type {number}
   */
  _elapsed = 0;

  /**
   * Whether the last completed window showed low performance
   * @type {boolean}
   */
  _lowPerformance = false;

  /**
   * FPS threshold below which performance is considered low
   * @type {number}
   */
  threshold = LOW_FPS_THRESHOLD;

  /**
   * Sample window duration in ms
   * @type {number}
   */
  sampleWindow = FPS_SAMPLE_WINDOW;

  /**
   * Create a new PerformanceMonitor.
   * @param {Object} game - Phaser game instance (needs game.loop.actualFps)
   */
  constructor(game) {
    this.game = game;
  }

  /**
   * Update the monitor with the current frame delta.
   * Accumulates FPS samples and evaluates the rolling average
   * once the sample window elapses.
   *
   * @param {number} delta - Frame delta time in ms
   */
  update(delta) {
    const fps = this._getCurrentFps();
    if (fps === null) {
      return;
    }

    this._elapsed += delta;
    this._fpsSum += fps;
    this._sampleCount += 1;

    if (this._elapsed >= this.sampleWindow) {
      const avg = this._sampleCount > 0 ? this._fpsSum / this._sampleCount : 0;
      this._lowPerformance = avg < this.threshold;

      // Reset for next window
      this._fpsSum = 0;
      this._sampleCount = 0;
      this._elapsed = 0;
    }
  }

  /**
   * Returns true if the rolling average FPS is below the threshold
   * for a sustained period (one full sample window).
   *
   * @returns {boolean}
   */
  isLowPerformance() {
    return this._lowPerformance;
  }

  /**
   * Alias for isLowPerformance().
   * Returns true when visual effects should be reduced.
   *
   * @returns {boolean}
   */
  shouldReduceEffects() {
    return this.isLowPerformance();
  }

  /**
   * Get the current FPS from the game loop.
   * Returns null if unavailable (e.g. test environments).
   *
   * @returns {number|null}
   * @private
   */
  _getCurrentFps() {
    try {
      const fps = this.game?.loop?.actualFps;
      if (typeof fps === 'number' && isFinite(fps)) {
        return fps;
      }
    } catch {
      // Ignore errors in test environments
    }
    return null;
  }
}

export default PerformanceMonitor;

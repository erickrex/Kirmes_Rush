/**
 * @fileoverview Conductor - The timing system for Friday Night Funkin'
 * A core class which handles musical timing throughout the game,
 * both in gameplay and in menus.
 *
 * Ported from source/funkin/Conductor.hx
 */

import Phaser from 'phaser';
import * as Constants from './Constants.js';

/**
 * @typedef {import('../types.js').SongTimeChange} SongTimeChange
 */

/**
 * A core class which handles musical timing throughout the game,
 * both in gameplay and in menus.
 *
 * The Conductor is implemented as a singleton to ensure consistent timing
 * across all game systems. Use `Conductor.instance` to access the singleton.
 */
class Conductor {
  /**
   * The singleton instance of the Conductor.
   * @type {Conductor | null}
   * @private
   */
  static _instance = null;

  /**
   * Get the singleton instance of the Conductor.
   * If one doesn't exist, a new one will be created.
   * @returns {Conductor} The Conductor singleton instance
   */
  static get instance() {
    if (Conductor._instance === null) {
      Conductor._instance = new Conductor();
    }
    return Conductor._instance;
  }

  /**
   * Reset the Conductor, replacing the current instance with a fresh one.
   * Useful when transitioning between songs or resetting game state.
   */
  static reset() {
    if (Conductor._instance !== null) {
      Conductor._instance.destroy();
    }
    Conductor._instance = new Conductor();
  }

  /**
   * Create a new Conductor instance.
   * Note: Use `Conductor.instance` to get the singleton instead of calling this directly.
   */
  constructor() {
    // ========================================
    // TIME CHANGES
    // ========================================

    /**
     * The list of time changes in the song.
     * There should be at least one time change (at the beginning of the song) to define the BPM.
     * @type {SongTimeChange[]}
     */
    this.timeChanges = [];

    /**
     * The most recent time change for the current song position.
     * @type {SongTimeChange | null}
     */
    this.currentTimeChange = null;

    // ========================================
    // SONG POSITION
    // ========================================

    /**
     * The current position in the song in milliseconds.
     * Update this every frame based on the audio position using `update()`.
     * @type {number}
     */
    this.songPosition = 0;

    /**
     * The offset between frame time and music time.
     * Used in `getTimeWithDelta()` to get a more accurate music time when on higher framerates.
     * @type {number}
     * @private
     */
    this._songPositionDelta = 0;

    /**
     * Previous timestamp for delta calculation.
     * @type {number}
     * @private
     */
    this._prevTimestamp = 0;

    /**
     * Previous song position for delta calculation.
     * @type {number}
     * @private
     */
    this._prevTime = 0;

    // ========================================
    // BPM OVERRIDE
    // ========================================

    /**
     * The current value set by `forceBPM`.
     * If null, BPM is determined by time changes.
     * @type {number | null}
     * @private
     */
    this._bpmOverride = null;

    // ========================================
    // MUSICAL POSITION (INTEGER)
    // ========================================

    /**
     * Current position in the song, in measures.
     * @type {number}
     */
    this.currentMeasure = 0;

    /**
     * Current position in the song, in beats.
     * @type {number}
     */
    this.currentBeat = 0;

    /**
     * Current position in the song, in steps.
     * @type {number}
     */
    this.currentStep = 0;

    // ========================================
    // MUSICAL POSITION (FRACTIONAL)
    // ========================================

    /**
     * Current position in the song, in measures and fractions of a measure.
     * @type {number}
     */
    this.currentMeasureTime = 0;

    /**
     * Current position in the song, in beats and fractions of a beat.
     * @type {number}
     */
    this.currentBeatTime = 0;

    /**
     * Current position in the song, in steps and fractions of a step.
     * @type {number}
     */
    this.currentStepTime = 0;

    // ========================================
    // OFFSETS
    // ========================================

    /**
     * An offset tied to the current chart file to compensate for a delay in the instrumental.
     * @type {number}
     */
    this.instrumentalOffset = 0;

    /**
     * An offset tied to the file format of the audio file being played.
     * @type {number}
     */
    this.formatOffset = 0;

    /**
     * An offset set by the user to compensate for input lag.
     * @type {number}
     */
    this.globalOffset = 0;

    /**
     * An offset set by the user to compensate for audio/visual lag.
     * @type {number}
     */
    this.audioVisualOffset = 0;

    // ========================================
    // EVENT EMITTER
    // ========================================

    /**
     * Event emitter for timing events (beatHit, stepHit, measureHit).
     * @type {Phaser.Events.EventEmitter}
     */
    this.events = new Phaser.Events.EventEmitter();
  }

  // ========================================
  // COMPUTED PROPERTIES - BPM
  // ========================================

  /**
   * Beats per minute of the current song at the current time.
   * @returns {number}
   */
  get bpm() {
    if (this._bpmOverride !== null) {
      return this._bpmOverride;
    }

    if (this.currentTimeChange === null) {
      return Constants.DEFAULT_BPM;
    }

    return this.currentTimeChange.bpm;
  }

  /**
   * Beats per minute of the current song at the start time.
   * @returns {number}
   */
  get startingBPM() {
    if (this._bpmOverride !== null) {
      return this._bpmOverride;
    }

    const timeChange = this.timeChanges[0];
    if (timeChange === undefined) {
      return Constants.DEFAULT_BPM;
    }

    return timeChange.bpm;
  }

  // ========================================
  // COMPUTED PROPERTIES - TIMING
  // ========================================

  /**
   * Duration of a measure in milliseconds. Calculated based on bpm.
   * @returns {number}
   */
  get measureLengthMs() {
    return this.beatLengthMs * this.timeSignatureNumerator;
  }

  /**
   * Duration of a beat (quarter note) in milliseconds. Calculated based on bpm.
   * @returns {number}
   */
  get beatLengthMs() {
    return (Constants.SECS_PER_MIN / this.bpm) * Constants.MS_PER_SEC;
  }

  /**
   * Duration of a step (sixteenth note) in milliseconds. Calculated based on bpm.
   * @returns {number}
   */
  get stepLengthMs() {
    return this.beatLengthMs / Constants.STEPS_PER_BEAT;
  }

  // ========================================
  // COMPUTED PROPERTIES - TIME SIGNATURE
  // ========================================

  /**
   * The numerator for the current time signature (the `3` in `3/4`).
   * @returns {number}
   */
  get timeSignatureNumerator() {
    if (this.currentTimeChange === null) {
      return Constants.DEFAULT_TIME_SIGNATURE_NUM;
    }

    return this.currentTimeChange.timeSignatureNum ?? Constants.DEFAULT_TIME_SIGNATURE_NUM;
  }

  /**
   * The denominator for the current time signature (the `4` in `3/4`).
   * @returns {number}
   */
  get timeSignatureDenominator() {
    if (this.currentTimeChange === null) {
      return Constants.DEFAULT_TIME_SIGNATURE_DEN;
    }

    return this.currentTimeChange.timeSignatureDen ?? Constants.DEFAULT_TIME_SIGNATURE_DEN;
  }

  // ========================================
  // COMPUTED PROPERTIES - MEASURES
  // ========================================

  /**
   * The number of beats in a measure. May be fractional depending on the time signature.
   * @returns {number}
   */
  get beatsPerMeasure() {
    return this.stepsPerMeasure / Constants.STEPS_PER_BEAT;
  }

  /**
   * The number of steps in a measure.
   * @returns {number}
   */
  get stepsPerMeasure() {
    return Math.floor(
      (this.timeSignatureNumerator / this.timeSignatureDenominator) *
        Constants.STEPS_PER_BEAT *
        Constants.STEPS_PER_BEAT
    );
  }

  // ========================================
  // COMPUTED PROPERTIES - OFFSETS
  // ========================================

  /**
   * The combined offset from all sources.
   * @returns {number}
   */
  get combinedOffset() {
    return this.instrumentalOffset + this.formatOffset + this.globalOffset;
  }

  /**
   * The instrumental offset, in terms of steps.
   * @returns {number}
   */
  get instrumentalOffsetSteps() {
    const startingStepLengthMs =
      ((Constants.SECS_PER_MIN / this.startingBPM) * Constants.MS_PER_SEC) /
      this.timeSignatureNumerator;

    return this.instrumentalOffset / startingStepLengthMs;
  }

  // ========================================
  // PUBLIC METHODS
  // ========================================

  /**
   * Forcibly defines the current BPM of the song.
   * Useful for things like the chart editor that need to manipulate BPM in real time.
   *
   * Set to null to reset to the BPM defined by the timeChanges.
   *
   * WARNING: Avoid this for things like setting the BPM of the title screen music,
   * you should have a metadata file for it instead.
   *
   * @param {number | null} bpm - The BPM to force, or null to reset
   */
  forceBPM(bpm) {
    if (bpm !== null) {
      console.warn(`[CONDUCTOR] Forcing BPM to ${bpm}`);
    } else {
      console.warn('[CONDUCTOR] Resetting BPM to default');
    }

    this._bpmOverride = bpm;
  }

  /**
   * Apply the `SongTimeChange` data from the song metadata to this Conductor.
   * @param {SongTimeChange[]} songTimeChanges - The SongTimeChanges
   */
  mapTimeChanges(songTimeChanges) {
    this.timeChanges = [];

    // Sort in place just in case it's out of order
    const sortedChanges = [...songTimeChanges].sort((a, b) => a.timeStamp - b.timeStamp);

    for (const songTimeChange of sortedChanges) {
      // Clone to avoid mutating the original
      const timeChange = { ...songTimeChange };

      // Handle negative timestamps
      if (timeChange.timeStamp < 0) {
        timeChange.timeStamp = 0;
      }

      if (timeChange.timeStamp <= 0) {
        timeChange.beatTime = 0;
      } else {
        // Calculate the beat time of this timestamp
        timeChange.beatTime = 0;

        if (timeChange.timeStamp > 0 && this.timeChanges.length > 0) {
          const prevTimeChange = this.timeChanges[this.timeChanges.length - 1];
          const prevBeatTime = prevTimeChange.beatTime ?? 0;
          timeChange.beatTime = this._roundDecimal(
            prevBeatTime +
              ((timeChange.timeStamp - prevTimeChange.timeStamp) * prevTimeChange.bpm) /
                Constants.SECS_PER_MIN /
                Constants.MS_PER_SEC,
            4
          );
        }
      }

      this.timeChanges.push(timeChange);
    }

    if (this.timeChanges.length > 0) {
      console.warn(`[CONDUCTOR] Done mapping time changes: ${JSON.stringify(this.timeChanges)}`);
    }

    // Update currentStepTime
    this.update(this.songPosition, false);
  }

  /**
   * Update the conductor with the current song position.
   * BPM, current step, etc. will be re-calculated based on the song position.
   *
   * @param {number} [songPos] - The current position in the song in milliseconds.
   *        Leave blank to use the current songPosition.
   * @param {boolean} [applyOffsets=true] - If it should apply the instrumentalOffset + formatOffset + globalOffset
   */
  update(songPos, applyOffsets = true) {
    if (songPos === undefined) {
      songPos = this.songPosition;
    }

    // Take into account instrumental and file format song offsets
    songPos += applyOffsets ? this.combinedOffset : 0;

    const oldMeasure = this.currentMeasure;
    const oldBeat = this.currentBeat;
    const oldStep = this.currentStep;

    this.songPosition = songPos;

    // Find current time change
    this.currentTimeChange = this.timeChanges[0] ?? null;
    if (this.songPosition > 0) {
      for (let i = 0; i < this.timeChanges.length; i++) {
        if (this.songPosition >= this.timeChanges[i].timeStamp) {
          this.currentTimeChange = this.timeChanges[i];
        }

        if (this.songPosition < this.timeChanges[i].timeStamp) {
          break;
        }
      }
    }

    if (this.currentTimeChange === null && this._bpmOverride === null) {
      // No time changes and no BPM override - use default calculations
      this.currentStepTime = this._roundDecimal(songPos / this.stepLengthMs, 4);
      this.currentBeatTime = this.currentStepTime / Constants.STEPS_PER_BEAT;
      this.currentMeasureTime = this.currentStepTime / this.stepsPerMeasure;
      this.currentStep = Math.floor(this.currentStepTime);
      this.currentBeat = Math.floor(this.currentBeatTime);
      this.currentMeasure = Math.floor(this.currentMeasureTime);
    } else if (this.currentTimeChange !== null && this.songPosition > 0) {
      // Calculate based on current time change
      const currentBeatTime = this.currentTimeChange.beatTime ?? 0;
      this.currentStepTime = this._roundDecimal(
        currentBeatTime * Constants.STEPS_PER_BEAT +
          (this.songPosition - this.currentTimeChange.timeStamp) / this.stepLengthMs,
        6
      );
      this.currentBeatTime = this.currentStepTime / Constants.STEPS_PER_BEAT;
      this.currentMeasureTime = this.currentStepTime / this.stepsPerMeasure;
      this.currentStep = Math.floor(this.currentStepTime);
      this.currentBeat = Math.floor(this.currentBeatTime);
      this.currentMeasure = Math.floor(this.currentMeasureTime);
    } else {
      // Assume a constant BPM equal to the forced value
      this.currentStepTime = this._roundDecimal(songPos / this.stepLengthMs, 4);
      this.currentBeatTime = this.currentStepTime / Constants.STEPS_PER_BEAT;
      this.currentMeasureTime = this.currentStepTime / this.stepsPerMeasure;
      this.currentStep = Math.floor(this.currentStepTime);
      this.currentBeat = Math.floor(this.currentBeatTime);
      this.currentMeasure = Math.floor(this.currentMeasureTime);
    }

    // Fire events on changes
    if (this.currentStep !== oldStep) {
      this.events.emit('stepHit', this.currentStep);
    }

    if (this.currentBeat !== oldBeat) {
      this.events.emit('beatHit', this.currentBeat);
    }

    if (this.currentMeasure !== oldMeasure) {
      this.events.emit('measureHit', this.currentMeasure);
    }

    // Only update the timestamp if songPosition actually changed
    if (this._prevTime !== this.songPosition) {
      this._songPositionDelta = 0;
      this._prevTime = this.songPosition;
      this._prevTimestamp = performance.now();
    }
  }

  /**
   * Returns a more accurate music time for higher framerates.
   * @returns {number}
   */
  getTimeWithDelta() {
    return this.songPosition + this._songPositionDelta;
  }

  /**
   * Given a time in milliseconds, return a time in steps.
   * @param {number} ms - The time in milliseconds
   * @returns {number} The time in steps
   */
  getTimeInSteps(ms) {
    if (this.timeChanges.length === 0) {
      // Assume a constant BPM equal to the forced value
      return Math.floor(ms / this.stepLengthMs);
    }

    let resultStep = 0;
    let lastTimeChange = this.timeChanges[0];

    for (const timeChange of this.timeChanges) {
      if (ms >= timeChange.timeStamp) {
        lastTimeChange = timeChange;
        const beatTime = lastTimeChange.beatTime ?? 0;
        resultStep = beatTime * Constants.STEPS_PER_BEAT;
      } else {
        break;
      }
    }

    const lastStepLengthMs =
      ((Constants.SECS_PER_MIN / lastTimeChange.bpm) * Constants.MS_PER_SEC) /
      this.timeSignatureNumerator;
    const resultFractionalStep = (ms - lastTimeChange.timeStamp) / lastStepLengthMs;
    resultStep += resultFractionalStep;

    return resultStep;
  }

  /**
   * Given a time in steps and fractional steps, return a time in milliseconds.
   * @param {number} stepTime - The time in steps
   * @returns {number} The time in milliseconds
   */
  getStepTimeInMs(stepTime) {
    if (this.timeChanges.length === 0) {
      // Assume a constant BPM equal to the forced value
      return stepTime * this.stepLengthMs;
    }

    let resultMs = 0;
    let lastTimeChange = this.timeChanges[0];

    for (const timeChange of this.timeChanges) {
      const tcBeatTime = timeChange.beatTime ?? 0;
      if (stepTime >= tcBeatTime * Constants.STEPS_PER_BEAT) {
        lastTimeChange = timeChange;
        resultMs = lastTimeChange.timeStamp;
      } else {
        break;
      }
    }

    const lastStepLengthMs =
      ((Constants.SECS_PER_MIN / lastTimeChange.bpm) * Constants.MS_PER_SEC) /
      this.timeSignatureNumerator;
    const lastBeatTime = lastTimeChange.beatTime ?? 0;
    resultMs += (stepTime - lastBeatTime * Constants.STEPS_PER_BEAT) * lastStepLengthMs;

    return resultMs;
  }

  /**
   * Given a time in beats and fractional beats, return a time in milliseconds.
   * @param {number} beatTime - The time in beats
   * @returns {number} The time in milliseconds
   */
  getBeatTimeInMs(beatTime) {
    if (this.timeChanges.length === 0) {
      // Assume a constant BPM equal to the forced value
      return beatTime * this.stepLengthMs * Constants.STEPS_PER_BEAT;
    }

    let resultMs = 0;
    let lastTimeChange = this.timeChanges[0];

    for (const timeChange of this.timeChanges) {
      const tcBeatTime = timeChange.beatTime ?? 0;
      if (beatTime >= tcBeatTime) {
        lastTimeChange = timeChange;
        resultMs = lastTimeChange.timeStamp;
      } else {
        break;
      }
    }

    const lastStepLengthMs =
      ((Constants.SECS_PER_MIN / lastTimeChange.bpm) * Constants.MS_PER_SEC) /
      this.timeSignatureNumerator;
    const lastBeatTime = lastTimeChange.beatTime ?? 0;
    resultMs += (beatTime - lastBeatTime) * lastStepLengthMs * Constants.STEPS_PER_BEAT;

    return resultMs;
  }

  /**
   * Clean up resources when the Conductor is no longer needed.
   */
  destroy() {
    this.events.removeAllListeners();
    this.timeChanges = [];
    this.currentTimeChange = null;
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Round a number to a specified number of decimal places.
   * @param {number} value - The value to round
   * @param {number} decimals - The number of decimal places
   * @returns {number} The rounded value
   * @private
   */
  _roundDecimal(value, decimals) {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }
}

export default Conductor;

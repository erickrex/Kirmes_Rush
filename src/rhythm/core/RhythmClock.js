/**
 * @fileoverview RhythmClock - the single neutral timing source for the rhythm
 * minigame framework. It wraps the existing {@link Conductor} singleton and
 * exposes beat <-> millisecond conversion plus an injectable Song_Position, so
 * every minigame shares consistent timing and the conversions stay unit
 * testable without live audio.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (RhythmClock section)
 * for the interface contract. Satisfies Requirements 5.1-5.5 and 17.3.
 */

import Conductor from '../../core/Conductor.js';
import * as Constants from '../../core/Constants.js';

/**
 * @typedef {import('../../types.js').SongTimeChange} SongTimeChange
 */

/**
 * Per-run configuration for {@link RhythmClock#start}.
 * @typedef {Object} RhythmClockConfig
 * @property {number} bpm - Constant BPM used when no `timeChanges` are supplied.
 * @property {number} [offsetMs=0] - Instrumental offset in milliseconds applied to the Conductor.
 * @property {SongTimeChange[]} [timeChanges] - Optional tempo map; when present it takes precedence over `bpm`.
 */

/**
 * Timing wrapper over the {@link Conductor} singleton.
 *
 * The clock never integrates its own time base: each frame the RhythmScene
 * feeds it `AudioManager.currentTime`, which it forwards to the Conductor and
 * stores as the latest injected Song_Position (R5.3, R17.3).
 */
class RhythmClock {
  /**
   * @param {{ conductor?: Conductor }} [deps] - Optional injected Conductor (defaults to the singleton).
   */
  constructor(deps = {}) {
    /**
     * The Conductor instance this clock drives. Injectable for testing.
     * @type {Conductor}
     * @private
     */
    this._conductor = deps.conductor ?? Conductor.instance;

    /**
     * The latest Song_Position (ms) injected via {@link RhythmClock#update}.
     * @type {number}
     * @private
     */
    this._songPositionMs = 0;
  }

  /**
   * Initialize timing for a run from the Minigame_Definition's BPM/offset.
   *
   * When `timeChanges` are present they are mapped onto the Conductor so beat
   * <-> ms conversion honors tempo changes (R5.4); otherwise a constant BPM is
   * forced (R5.1).
   *
   * @param {RhythmClockConfig} cfg - The run timing configuration.
   */
  start(cfg) {
    const conductor = this._conductor;

    conductor.instrumentalOffset = cfg.offsetMs ?? 0;

    if (cfg.timeChanges && cfg.timeChanges.length > 0) {
      // Tempo map drives conversion; clear any forced BPM override.
      conductor.forceBPM(null);
      conductor.mapTimeChanges(cfg.timeChanges);
    } else {
      // Constant BPM: clear any prior tempo map, then force the BPM.
      conductor.mapTimeChanges([]);
      conductor.forceBPM(cfg.bpm);
    }

    this._songPositionMs = 0;
    conductor.update(0, false);
  }

  /**
   * Update the clock with the current Song_Position derived from
   * `AudioManager.currentTime`. Stores the raw injected value and forwards it
   * to the Conductor rather than integrating an independent clock (R5.3).
   *
   * @param {number} songPositionMs - The current Song_Position in milliseconds.
   */
  update(songPositionMs) {
    this._songPositionMs = songPositionMs;
    this._conductor.update(songPositionMs);
  }

  /**
   * Convert a beat value to a millisecond Song_Position (R5.2), honoring any
   * mapped `timeChanges` (R5.4). Consistent with the Conductor for the same
   * beat and BPM (R5.5).
   *
   * @param {number} beat - The beat value to convert.
   * @returns {number} The Song_Position in milliseconds.
   */
  beatToMs(beat) {
    return this._conductor.getBeatTimeInMs(beat);
  }

  /**
   * Convert a millisecond Song_Position to a (fractional) beat value (R5.2).
   *
   * With a tempo map the Conductor's `getTimeInSteps` yields fractional steps,
   * so beats are steps / STEPS_PER_BEAT. For a constant forced BPM the
   * Conductor floors steps to integers, so the beat is derived directly from
   * the beat length to preserve the beat<->ms round-trip (R5.5, R17.5).
   *
   * @param {number} ms - The Song_Position in milliseconds.
   * @returns {number} The beat value.
   */
  msToBeat(ms) {
    const conductor = this._conductor;
    if (conductor.timeChanges.length > 0) {
      return conductor.getTimeInSteps(ms) / Constants.STEPS_PER_BEAT;
    }
    return ms / conductor.beatLengthMs;
  }

  /**
   * The latest Song_Position (ms) injected via {@link RhythmClock#update}.
   * Injectable for deterministic testing without live audio (R17.3).
   * @returns {number}
   */
  get songPositionMs() {
    return this._songPositionMs;
  }

  /**
   * The current position in the song expressed in fractional beats, as
   * computed by the Conductor on the last update.
   * @returns {number}
   */
  get songBeat() {
    return this._conductor.currentBeatTime;
  }

  /**
   * Release the wrapped Conductor's resources at teardown.
   */
  destroy() {
    this._conductor.destroy();
  }
}

export default RhythmClock;

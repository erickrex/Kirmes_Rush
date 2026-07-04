/**
 * @fileoverview RhythmSession - the per-run value object that carries everything
 * a single minigame run needs, resolved once by `LoadingState.prepareCallback`
 * (task 14) and handed to RhythmScene via `scene.start('RhythmScene', { session })`.
 *
 * It holds the loaded {@link MinigameDefinition}, the timeline inputs to bake
 * into a CueTimeline, the RhythmClock configuration (BPM/offset/timeChanges
 * resolved from the backing song metadata, R13.2), the resolved song audio
 * keys/paths, the scoring configuration, and the resolved Minigame_Controller
 * class reference (R11.3).
 *
 * It is a plain immutable value object: no framework objects are instantiated
 * here. RhythmScene reads these fields to construct the RhythmClock, CueTimeline,
 * CueScheduler, CueJudger, RhythmScoring, and the controller.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (RhythmSession section).
 * Satisfies Requirements 11 (data-driven) and 12 (runtime flow).
 */

/**
 * @typedef {import('../../types.js').MinigameDefinition} MinigameDefinition
 * @typedef {import('../../types.js').TimelineEntry} TimelineEntry
 * @typedef {import('../../types.js').SongTimeChange} SongTimeChange
 * @typedef {import('../../types.js').MinigameScoringConfig} MinigameScoringConfig
 */

/**
 * RhythmClock configuration resolved from a minigame definition + song metadata.
 * @typedef {Object} RhythmClockConfig
 * @property {number} bpm - Starting BPM (definition override or song metadata).
 * @property {number} [offsetMs] - Song start offset in milliseconds.
 * @property {SongTimeChange[]} [timeChanges] - BPM/time-signature changes for the run.
 */

/**
 * Resolved audio references for the backing song of a run.
 * @typedef {Object} RhythmSessionAudio
 * @property {string} instrumentalKey - Phaser cache key for the instrumental track.
 * @property {string} [instrumentalPath] - Resolved file path for the instrumental track.
 * @property {string} [songId] - Backing song id the audio resolves from.
 */

/**
 * The resolved configuration used to build a {@link RhythmSession}.
 * @typedef {Object} RhythmSessionConfig
 * @property {MinigameDefinition} definition - The loaded, validated minigame definition.
 * @property {TimelineEntry[]} timeline - Timeline entries to bake into a CueTimeline.
 * @property {RhythmClockConfig} clockConfig - RhythmClock configuration for the run.
 * @property {RhythmSessionAudio} audio - Resolved song audio keys/paths.
 * @property {MinigameScoringConfig} [scoring] - Scoring windows and result bands.
 * @property {Function} controllerClass - The resolved Minigame_Controller class.
 */

/**
 * Per-run value object holding the fully resolved inputs for one minigame run.
 * Fields are assigned once in the constructor and are intended to be read-only.
 */
class RhythmSession {
  /**
   * @param {RhythmSessionConfig} config - The resolved run configuration.
   */
  constructor({ definition, timeline, clockConfig, audio, scoring, controllerClass }) {
    /**
     * The loaded, validated minigame definition.
     * @type {MinigameDefinition}
     */
    this.definition = definition;

    /**
     * Timeline entries (cue/expect) to bake into a CueTimeline via RhythmClock.
     * @type {TimelineEntry[]}
     */
    this.timeline = timeline ?? definition?.timeline ?? [];

    /**
     * RhythmClock configuration (BPM/offset/timeChanges) resolved from the
     * definition + backing song metadata (R13.2).
     * @type {RhythmClockConfig}
     */
    this.clockConfig = clockConfig;

    /**
     * Resolved backing-song audio keys/paths.
     * @type {RhythmSessionAudio}
     */
    this.audio = audio;

    /**
     * Scoring windows and result bands for the run. Falls back to the
     * definition's own scoring block when not explicitly provided.
     * @type {MinigameScoringConfig|undefined}
     */
    this.scoring = scoring ?? definition?.scoring;

    /**
     * The resolved Minigame_Controller class (R11.3). RhythmScene instantiates
     * it as `new controllerClass(scene, session)`.
     * @type {Function}
     */
    this.controllerClass = controllerClass;
  }

  /**
   * The minigame id this session runs, sourced from its definition.
   * @returns {string|undefined} The minigame id.
   */
  get id() {
    return this.definition?.id;
  }

  /**
   * The primary movement type this session runs, sourced from its definition.
   * @returns {('tap' | 'hold' | 'release' | 'flick')|undefined} The movement type.
   */
  get movementType() {
    return this.definition?.movementType;
  }
}

export default RhythmSession;
export { RhythmSession };

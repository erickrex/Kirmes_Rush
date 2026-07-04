/**
 * @fileoverview RhythmInputManager - reconciles the two independent time bases of
 * the Rhythm_Framework and buffers normalized {@link Gesture}s for the CueJudger.
 *
 * Two clocks exist (design.md "The two-clock reconciliation"):
 *   - Input_Time    - `performance.now()` captured at a pointer event.
 *   - Song_Position - milliseconds from `AudioManager.currentTime`, fed in each frame.
 *
 * ## Single mapping, single location (R8.3, Property 5)
 * {@link RhythmInputManager#mapInputTimeToSongPosition} is the ONE place in the
 * framework that converts an Input_Time into a Song_Position. Every other component
 * (the recognizer, the judger, the scene) works in a single clock; only this method
 * crosses between them. Each frame the scene calls {@link RhythmInputManager#syncClock}
 * to establish the per-frame anchor (`latestSongPosition` + `latestFrameInputTime`),
 * and the mapping extrapolates from that anchor:
 *
 * ```
 * songPositionForInput(inputTime) =
 *   latestSongPosition + (inputTime - latestFrameInputTime) + inputDelayOffset
 * ```
 *
 * ## Input_Delay_Offset (R8.2)
 * `inputDelayOffset` is the user's input-delay calibration value read from
 * {@link SaveManager}. We use `SaveManager.getInputDelayCompensation()`, which returns
 * the `inputDelayCompensation` option (clamped to -50..+50 ms). That option is the
 * dedicated input-delay calibration slider - distinct from note/audio-visual offsets -
 * so it is the correct value to add when mapping Input_Time to Song_Position. It is read
 * live on every mapping so recalibration mid-run takes effect immediately.
 *
 * ## Judged on gesture-start (R7.1, R8.4)
 * {@link RhythmInputManager#onGesture} maps using `gesture.startTime` (the pointerdown
 * instant), never the confirmation time, and buffers the original Input_Time alongside
 * the mapped Song_Position. {@link RhythmInputManager#consume} hands the buffer to the
 * CueJudger and clears it.
 *
 * Satisfies Requirements 8.1, 8.2, 8.3, 8.4.
 */

/**
 * @typedef {import('../../types.js').Gesture} Gesture
 * @typedef {import('../../types.js').BufferedGesture} BufferedGesture
 * @typedef {import('../../data/SaveManager.js').default} SaveManager
 * @typedef {import('./TouchGestureRecognizer.js').default} TouchGestureRecognizer
 */

/**
 * Buffers normalized gestures, applies the single Input_Time -> Song_Position mapping
 * with the SaveManager input-delay offset, and delivers them to the CueJudger.
 */
class RhythmInputManager {
  /**
   * @param {{
   *   recognizer?: TouchGestureRecognizer,
   *   saveManager: SaveManager,
   *   buffer?: BufferedGesture[]
   * }} cfg
   *   - `recognizer`: the gesture source. When provided, {@link RhythmInputManager#onGesture}
   *     is wired as its `onGesture` callback so emitted gestures are buffered automatically.
   *   - `saveManager`: supplies the Input_Delay_Offset via `getInputDelayCompensation()`.
   *   - `buffer`: optional pre-existing buffer array to accumulate into (defaults to a new array).
   */
  constructor(cfg) {
    const { recognizer, saveManager, buffer } = cfg ?? {};

    /** @type {?TouchGestureRecognizer} @private */
    this._recognizer = recognizer ?? null;

    /** @type {SaveManager} @private */
    this._saveManager = saveManager;

    /**
     * Buffered gestures awaiting delivery to the CueJudger. Each entry preserves the
     * original Input_Time and the mapped Song_Position (R8.4).
     * @type {BufferedGesture[]}
     * @private
     */
    this._buffer = Array.isArray(buffer) ? buffer : [];

    /**
     * Song_Position (ms) captured at the last {@link RhythmInputManager#syncClock}.
     * @type {number}
     * @private
     */
    this._latestSongPosition = 0;

    /**
     * Input_Time (`performance.now()` ms) sampled at the last {@link RhythmInputManager#syncClock}.
     * @type {number}
     * @private
     */
    this._latestFrameInputTime = 0;

    // Bind onGesture so it can be used directly as a callback reference (and wire it
    // to the recognizer when one is supplied).
    this.onGesture = this.onGesture.bind(this);
    if (this._recognizer && typeof this._recognizer === 'object') {
      /** @type {*} */ (this._recognizer)._onGesture = this.onGesture;
    }
  }

  /**
   * Store the per-frame anchor used by {@link RhythmInputManager#mapInputTimeToSongPosition}.
   * The scene calls this every frame with the current `AudioManager.currentTime` Song_Position
   * and the `performance.now()` value sampled at that same frame (R8.1).
   * @param {number} songPositionMs - Current Song_Position from AudioManager.currentTime.
   * @param {number} frameInputTime - `performance.now()` sampled at this frame.
   */
  syncClock(songPositionMs, frameInputTime) {
    this._latestSongPosition = songPositionMs;
    this._latestFrameInputTime = frameInputTime;
  }

  /**
   * THE single Input_Time -> Song_Position mapping for the whole framework (R8.3,
   * Property 5). Extrapolates from the last frame anchor and adds the user's
   * Input_Delay_Offset from SaveManager (R8.2).
   * @param {number} inputTime - An Input_Time (`performance.now()` ms), e.g. `gesture.startTime`.
   * @returns {number} The corresponding Song_Position in milliseconds.
   */
  mapInputTimeToSongPosition(inputTime) {
    const inputDelayOffset = this._getInputDelayOffset();
    return this._latestSongPosition + (inputTime - this._latestFrameInputTime) + inputDelayOffset;
  }

  /**
   * Buffer a gesture, preserving its original Input_Time alongside the mapped
   * Song_Position (R8.4). The gesture is judged on its gesture-start timestamp
   * (`gesture.startTime`), never on the confirmation time (R7.1).
   * @param {Gesture} gesture - The normalized gesture to buffer.
   */
  onGesture(gesture) {
    if (!gesture) {
      return;
    }
    const inputTime = gesture.startTime;
    const songPositionMs = this.mapInputTimeToSongPosition(inputTime);
    this._buffer.push({ gesture, inputTime, songPositionMs });
  }

  /**
   * Return the buffered mapped gestures and clear the buffer, for delivery to the
   * CueJudger. Returns a fresh array each call so callers can safely iterate.
   * @returns {BufferedGesture[]} The buffered gestures collected since the last consume.
   */
  consume() {
    const drained = this._buffer;
    this._buffer = [];
    return drained;
  }

  /**
   * Read the Input_Delay_Offset from SaveManager, tolerating an absent/partial stub.
   * @returns {number} Input-delay calibration in milliseconds (0 when unavailable).
   * @private
   */
  _getInputDelayOffset() {
    const sm = this._saveManager;
    if (sm && typeof sm.getInputDelayCompensation === 'function') {
      return sm.getInputDelayCompensation();
    }
    return 0;
  }
}

export default RhythmInputManager;

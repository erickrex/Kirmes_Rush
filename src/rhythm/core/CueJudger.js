/**
 * @fileoverview CueJudger - compares a player Gesture against the currently
 * active Expectations and produces a {@link JudgementResult}. It is the single
 * authority that turns "the player did X at song-position Y" into one of
 * `perfect` / `good` / `barely` / `miss` / `wrong`.
 *
 * The judger is deliberately clock-free: it never reads `AudioManager` or
 * `performance.now()`. The caller (RhythmInputManager/RhythmScene) performs the
 * one and only Input_Time -> Song_Position mapping and hands the result in as
 * `mappedSongPositionMs`. That mapped value is derived from `gesture.startTime`
 * (the `pointerdown` moment), never the confirmation/`pointerup` time, so
 * recognition latency stays out of the score (R7.2, Property 4).
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (CueJudger section).
 * Satisfies Requirements 1.3, 1.5, 3.3, 3.4, 4.3, 4.4, 7.2, 7.3, 7.4, 7.5.
 *
 * Timing categories are derived from each Expectation's own {@link TimingWindow}
 * (`perfect`/`good`/`barely` tolerances baked onto the Expectation by
 * CueTimeline). The shared {@link import('../../play/Scoring.js').default}
 * timing core (`Scoring.judgeNote`) is intentionally NOT delegated to here: it
 * uses fixed, global window constants and the FNF judgement vocabulary
 * (`sick`/`good`/`bad`/`shit`), neither of which matches the per-Expectation,
 * Rhythm-Heaven-style windows this framework judges against. Classification is
 * therefore done locally against `expectation.windowMs`, mirroring that core's
 * ascending-threshold structure.
 */

/**
 * @typedef {import('../../types.js').Gesture} Gesture
 * @typedef {import('../../types.js').Expectation} Expectation
 * @typedef {import('../../types.js').TimingWindow} TimingWindow
 * @typedef {import('../../types.js').RhythmJudgement} RhythmJudgement
 * @typedef {import('../../types.js').JudgementResult} JudgementResult
 * @typedef {import('./CueScheduler.js').default} CueScheduler
 * @typedef {import('./RhythmScoring.js').default} RhythmScoring
 */

/**
 * Maps a recognized Gesture type to the Expectation `gesture` value(s) it may
 * resolve. Only the confirming gestures resolve an Expectation:
 * - `tap` resolves a `tap` Expectation.
 * - `flick` resolves a `flick` Expectation.
 * - `release` resolves a `release` Expectation and also the `hold`
 *   (hold-for-duration) Expectation, because the release is the moment the
 *   completed hold span is known (R2.5).
 * The continuous `holdStart` / `holdTick` gestures resolve nothing here: they
 * drive the controller's live visual state (R2.4) and are routed to the
 * controller, not judged for score. They therefore map to no Expectation.
 * @type {Readonly<Record<Gesture['type'], Array<Expectation['gesture']>>>}
 */
const RESOLVING_MATCH = Object.freeze({
  tap: ['tap'],
  flick: ['flick'],
  release: ['release', 'hold'],
  holdStart: [],
  holdTick: []
});

/**
 * Classify an absolute timing (or duration) offset into a timing Judgement by
 * walking the Expectation's ascending tolerances. An offset within `perfect`
 * is `perfect`, else within `good` is `good`, else within `barely` is `barely`,
 * otherwise `miss`. Bounds are inclusive (R7.4).
 * @param {number} offsetMs - Signed offset (negative = early, positive = late).
 * @param {TimingWindow} windowMs - The Expectation's timing tolerances.
 * @returns {RhythmJudgement} The timing category.
 */
function classifyTiming(offsetMs, windowMs) {
  const abs = Math.abs(offsetMs);
  if (abs <= windowMs.perfect) {
    return 'perfect';
  }
  if (abs <= windowMs.good) {
    return 'good';
  }
  if (abs <= windowMs.barely) {
    return 'barely';
  }
  return 'miss';
}

/**
 * Judges player Gestures against the active Expectations tracked by a
 * {@link CueScheduler}, recording resolving outcomes with a {@link RhythmScoring}.
 */
class CueJudger {
  /**
   * @param {{ scheduler: CueScheduler, scoring: RhythmScoring }} deps
   *   - `scheduler`: supplies `activeExpectations` and receives `resolve`.
   *   - `scoring`: receives `record` for every resolving Judgement.
   */
  constructor({ scheduler, scoring }) {
    /** @type {CueScheduler} @private */
    this._scheduler = scheduler;

    /** @type {RhythmScoring} @private */
    this._scoring = scoring;

    /**
     * Ids of single-input Expectations this judger has already resolved. Used
     * to reject duplicate Gestures without producing a second Judgement (R7.5).
     * The scheduler also drops resolved single-input Expectations from its
     * active set, so this is a defensive second line that keeps the guarantee
     * even within a single consume batch.
     * @type {Set<string>}
     * @private
     */
    this._resolvedIds = new Set();
  }

  /**
   * Judge a Gesture against the currently active Expectations.
   *
   * The `mappedSongPositionMs` is the caller-provided Song_Position derived from
   * `gesture.startTime` (Property 4); this method never re-derives time. On a
   * resolving outcome it notifies the scheduler (`resolve`) and records the
   * Judgement (`record`); non-resolving outcomes (stray/wrong-type input, an
   * early release, a duplicate) do neither, leaving the Expectation's lifecycle
   * to a later matching Gesture or the scheduler's window-close miss.
   *
   * @param {Gesture} gesture - The recognized gesture to judge.
   * @param {number} mappedSongPositionMs - Song_Position (ms) for `gesture.startTime`.
   * @returns {JudgementResult} The outcome of the judgement.
   */
  judge(gesture, mappedSongPositionMs) {
    const active = Array.from(this._scheduler.activeExpectations);
    const resolvable = RESOLVING_MATCH[gesture.type] ?? [];

    /** @type {Expectation[]} */
    const candidates = resolvable.length
      ? active.filter((expectation) => resolvable.includes(expectation.gesture))
      : [];

    // No Expectation of a type this Gesture can resolve. Either an Expectation
    // of a different type is active (wrong type, R1.5) or nothing is expected
    // right now (stray input). Both are `wrong` but resolve nothing and are not
    // recorded, so they never corrupt the per-Expectation tally.
    if (candidates.length === 0) {
      return this._nonResolving('wrong', null, 0, gesture);
    }

    // Match the nearest Expectation by target Song_Position so overlapping
    // Expectations of the same type are disambiguated deterministically.
    const expectation = CueJudger._nearest(candidates, mappedSongPositionMs);

    // Duplicate rejection: a single-input Expectation already resolved by this
    // judger accepts no further Gestures (R7.5).
    if (this._resolvedIds.has(expectation.id) && !expectation.allowMultiple) {
      return this._nonResolving('wrong', expectation.id, 0, gesture);
    }

    // A release that arrives before its window even opens is too early: `wrong`,
    // and non-resolving so the Expectation can still be matched in-window or be
    // marked `miss` on close (R3.4 / R3.5).
    if (gesture.type === 'release' && mappedSongPositionMs < expectation.windowOpenMs) {
      const earlyOffset = mappedSongPositionMs - expectation.targetMs;
      return this._nonResolving('wrong', expectation.id, earlyOffset, gesture);
    }

    // Flick direction mismatch: the Gesture matched the flick Expectation but
    // went the wrong way. This is a genuine (resolving) attempt at the
    // Expectation, judged `wrong` (R4.3).
    if (
      expectation.gesture === 'flick' &&
      expectation.direction !== null &&
      gesture.direction !== expectation.direction
    ) {
      const offset = mappedSongPositionMs - expectation.targetMs;
      return this._resolve(expectation, 'wrong', offset, gesture);
    }

    // Timing-based Judgement. A hold-for-duration Expectation is judged on how
    // closely the completed hold span matched the target span (R2.5); every
    // other Expectation is judged on the offset of the judged Song_Position
    // from the target beat (R1.3, R3.3, R4.4, R7.4).
    const offsetMs =
      expectation.gesture === 'hold'
        ? gesture.durationMs - (expectation.targetSpanMs ?? 0)
        : mappedSongPositionMs - expectation.targetMs;

    const judgement = classifyTiming(offsetMs, expectation.windowMs);
    return this._resolve(expectation, judgement, offsetMs, gesture);
  }

  /**
   * Resolve `expectation` with `judgement`: notify the scheduler, record the
   * outcome, remember single-input resolutions, and build the result.
   * @param {Expectation} expectation - The matched Expectation.
   * @param {RhythmJudgement} judgement - The resolving Judgement.
   * @param {number} timingOffsetMs - The offset that produced the Judgement.
   * @param {Gesture} gesture - The judged Gesture.
   * @returns {JudgementResult}
   * @private
   */
  _resolve(expectation, judgement, timingOffsetMs, gesture) {
    this._scheduler.resolve(expectation.id, judgement);
    this._scoring.record(judgement);
    if (!expectation.allowMultiple) {
      this._resolvedIds.add(expectation.id);
    }
    return {
      judgement,
      expectationId: expectation.id,
      timingOffsetMs,
      gesture,
      resolved: true
    };
  }

  /**
   * Build a non-resolving result: no scheduler resolve, no scoring record.
   * @param {RhythmJudgement} judgement - The (non-recorded) Judgement to report.
   * @param {string | null} expectationId - The associated Expectation id, or null.
   * @param {number} timingOffsetMs - The offset to report (0 when not meaningful).
   * @param {Gesture} gesture - The judged Gesture.
   * @returns {JudgementResult}
   * @private
   */
  _nonResolving(judgement, expectationId, timingOffsetMs, gesture) {
    return {
      judgement,
      expectationId,
      timingOffsetMs,
      gesture,
      resolved: false
    };
  }

  /**
   * Pick the Expectation whose target Song_Position is closest to the judged
   * position. Ties keep the earliest (the array is in target order).
   * @param {Expectation[]} candidates - Non-empty list of type-matched Expectations.
   * @param {number} mappedSongPositionMs - The judged Song_Position.
   * @returns {Expectation}
   * @private
   */
  static _nearest(candidates, mappedSongPositionMs) {
    let best = candidates[0];
    let bestDistance = Math.abs(mappedSongPositionMs - best.targetMs);
    for (let i = 1; i < candidates.length; i += 1) {
      const distance = Math.abs(mappedSongPositionMs - candidates[i].targetMs);
      if (distance < bestDistance) {
        best = candidates[i];
        bestDistance = distance;
      }
    }
    return best;
  }
}

export default CueJudger;

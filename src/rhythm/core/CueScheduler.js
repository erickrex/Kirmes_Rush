/**
 * @fileoverview CueScheduler - fires timeline events at the correct
 * Song_Position, opens and closes Expectation input windows, and marks
 * unresolved Expectations as missed. It never integrates its own clock: the
 * RhythmScene injects `AudioManager.currentTime` each frame via
 * {@link CueScheduler#update}, so the scheduler stays pinned to the audio clock
 * and remains deterministically testable (R9.4, R17.4).
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (CueScheduler section)
 * for the interface contract. Satisfies Requirements 6.2-6.5 and 9.1-9.4.
 *
 * Firing is surfaced through an optional {@link EventBusLike} emitter using the
 * {@link CueSchedulerEvents} names, mirroring the design sequence diagram
 * (`SCH->>MG: onCue(cue)`, `SCH-->>JU: openExpectation(exp)`). Consumers that
 * prefer polling can also read {@link CueScheduler#activeExpectations}.
 */

/**
 * @typedef {import('../../types.js').ResolvedCue} ResolvedCue
 * @typedef {import('../../types.js').Expectation} Expectation
 * @typedef {import('../../types.js').RhythmJudgement} RhythmJudgement
 * @typedef {import('./CueTimeline.js').default} CueTimeline
 */

/**
 * The minimal emitter contract the scheduler needs. `EventBus` (and any Phaser
 * `EventEmitter`) satisfies it.
 * @typedef {{ emit: (event: string, ...args: any[]) => void }} EventBusLike
 */

/**
 * Event names the scheduler emits on its bus.
 * @readonly
 * @enum {string}
 */
export const CueSchedulerEvents = {
  /** A presentation cue became due. Payload: {@link ResolvedCue}. */
  CUE: 'rhythm:cue',
  /** An Expectation's input window opened. Payload: {@link Expectation}. */
  EXPECTATION_OPEN: 'rhythm:expectationOpen',
  /** An unresolved Expectation's window closed. Payload: `{ expectation, judgement: 'miss' }`. */
  EXPECTATION_MISS: 'rhythm:expectationMiss'
};

/**
 * Per-Expectation scheduling state tracked across frames so each transition
 * (open, resolve, miss) happens exactly once.
 * @typedef {Object} ExpectationState
 * @property {Expectation} expectation - The resolved Expectation.
 * @property {boolean} opened - Whether the input window has been opened.
 * @property {boolean} closed - Whether the input window has closed (missed or resolved past close).
 * @property {boolean} resolved - Whether a Judgement resolved this Expectation.
 * @property {boolean} missed - Whether the Expectation was marked `miss`.
 * @property {RhythmJudgement} [lastJudgement] - The last Judgement recorded via {@link CueScheduler#resolve}.
 */

/**
 * Drives a {@link CueTimeline} against an injected Song_Position, emitting cues
 * once and managing Expectation input windows.
 */
class CueScheduler {
  /**
   * @param {CueTimeline} timeline - The ordered, resolved timeline for the run.
   * @param {EventBusLike} [bus] - Optional emitter used to surface fires; when
   *   omitted the scheduler still tracks state (readable via getters).
   */
  constructor(timeline, bus) {
    /** @type {CueTimeline} @private */
    this._timeline = timeline;

    /** @type {EventBusLike | undefined} @private */
    this._bus = bus;

    /**
     * Cursor into the (sorted) cue list marking the next cue to consider.
     * Everything before it has already fired exactly once (R6.2).
     * @type {number}
     * @private
     */
    this._cueCursor = 0;

    /**
     * Per-Expectation state keyed by array index, in timeline (target) order.
     * @type {ExpectationState[]}
     * @private
     */
    this._expectationStates = timeline.expectations.map((expectation) => ({
      expectation,
      opened: false,
      closed: false,
      resolved: false,
      missed: false
    }));

    /**
     * Fast lookup from Expectation id to its state, for {@link CueScheduler#resolve}.
     * @type {Map<string, ExpectationState>}
     * @private
     */
    this._stateById = new Map();
    for (const state of this._expectationStates) {
      this._stateById.set(state.expectation.id, state);
    }

    /**
     * The latest injected Song_Position (ms). Kept pinned to the value passed
     * to {@link CueScheduler#update} (R9.4).
     * @type {number}
     * @private
     */
    this._songPositionMs = 0;

    /** @type {boolean} @private */
    this._paused = false;
  }

  /**
   * Advance the scheduler to `songPositionMs`, firing any now-due presentation
   * cues exactly once, opening Expectation windows that have reached their
   * open time, and marking unresolved Expectations `miss` exactly once once
   * their window-close time has passed (R6.2-R6.4).
   *
   * While paused this is a no-op beyond doing nothing: no cues fire and no
   * windows open or close (R9.1). Song_Position always comes from the injected
   * value, never an internal clock (R9.4, R17.4).
   *
   * @param {number} songPositionMs - The current Song_Position, from `AudioManager.currentTime`.
   */
  update(songPositionMs) {
    if (this._paused) {
      // R9.1: emit no cues and open/close no windows while paused. State is
      // preserved so resume continues without re-firing (R9.2).
      return;
    }

    this._songPositionMs = songPositionMs;

    this._fireDueCues(songPositionMs);
    this._advanceExpectationWindows(songPositionMs);
  }

  /**
   * Fire every cue whose target time has been reached, in non-decreasing
   * Song_Position order, each exactly once (R6.2). The cursor guarantees a cue
   * never fires before an earlier one and never fires twice.
   * @param {number} songPositionMs - The current Song_Position.
   * @private
   */
  _fireDueCues(songPositionMs) {
    const cues = this._timeline.cues;
    while (this._cueCursor < cues.length && cues[this._cueCursor].atMs <= songPositionMs) {
      const cue = cues[this._cueCursor];
      this._cueCursor += 1;
      this._emit(CueSchedulerEvents.CUE, cue);
    }
  }

  /**
   * Open Expectation windows that have reached their open time and close
   * unresolved ones whose window-close time has passed, marking them `miss`
   * exactly once (R6.3, R6.4).
   * @param {number} songPositionMs - The current Song_Position.
   * @private
   */
  _advanceExpectationWindows(songPositionMs) {
    for (const state of this._expectationStates) {
      const { expectation } = state;

      // Open the window once the open time is reached, but only for a still
      // pending Expectation (a pre-emptively resolved one is never opened).
      if (
        !state.opened &&
        !state.closed &&
        !state.resolved &&
        songPositionMs >= expectation.windowOpenMs
      ) {
        state.opened = true;
        this._emit(CueSchedulerEvents.EXPECTATION_OPEN, expectation);
      }

      // Close the window once its close time is passed. An unresolved
      // Expectation is marked `miss` exactly once (R6.4).
      if (!state.closed && !state.resolved && songPositionMs > expectation.windowCloseMs) {
        state.closed = true;
        state.missed = true;
        this._emit(CueSchedulerEvents.EXPECTATION_MISS, {
          expectation,
          judgement: /** @type {RhythmJudgement} */ ('miss')
        });
      }
    }
  }

  /**
   * Mark an Expectation resolved so a later window close does not mark it
   * `miss`. Scheduler-side bookkeeping invoked when the CueJudger accepts a
   * Gesture for the Expectation. No-op if the id is unknown or the Expectation
   * has already been missed.
   *
   * @param {string} expectationId - The id of the Expectation that was judged.
   * @param {RhythmJudgement} judgement - The Judgement produced (recorded for reference).
   */
  resolve(expectationId, judgement) {
    const state = this._stateById.get(expectationId);
    if (!state || state.missed) {
      return;
    }

    state.resolved = true;
    // An Expectation that does not allow multiple inputs is done accepting
    // gestures; treat its window as closed so it drops out of the active set.
    if (!state.expectation.allowMultiple) {
      state.closed = true;
    }
    /** @type {RhythmJudgement} @private */
    state.lastJudgement = judgement;
  }

  /**
   * Pause scheduling. While paused, {@link CueScheduler#update} emits no cues
   * and opens no windows (R9.1).
   */
  pause() {
    this._paused = true;
  }

  /**
   * Resume scheduling. The next {@link CueScheduler#update} continues from the
   * current injected Song_Position without re-firing already-emitted cues
   * (R9.2); pinning to `AudioManager.currentTime` means `resync`/`forceResync`
   * corrections are respected automatically (R9.3).
   */
  resume() {
    this._paused = false;
  }

  /**
   * The set of currently-open, unresolved Expectations (R6.5). These are the
   * Expectations the CueJudger may match a Gesture against right now.
   * @returns {Set<Expectation>}
   */
  get activeExpectations() {
    /** @type {Set<Expectation>} */
    const active = new Set();
    for (const state of this._expectationStates) {
      if (state.opened && !state.closed && !state.resolved && !state.missed) {
        active.add(state.expectation);
      }
    }
    return active;
  }

  /**
   * The latest Song_Position (ms) injected via {@link CueScheduler#update}.
   * Pinned to the audio clock, never integrated internally (R9.4).
   * @returns {number}
   */
  get songPositionMs() {
    return this._songPositionMs;
  }

  /**
   * Whether scheduling is currently paused.
   * @returns {boolean}
   */
  get paused() {
    return this._paused;
  }

  /**
   * Emit an event on the bus when one was supplied.
   * @param {string} event - The {@link CueSchedulerEvents} name.
   * @param {*} payload - The event payload.
   * @private
   */
  _emit(event, payload) {
    this._bus?.emit(event, payload);
  }
}

export default CueScheduler;

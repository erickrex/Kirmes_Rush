/**
 * @fileoverview CueTimeline - an immutable, ordered view of a
 * Minigame_Definition's timeline. Beats are baked to Song_Position
 * milliseconds at build time via {@link RhythmClock}, so the Cue_Scheduler can
 * work purely in Song_Position and never re-derive beats at runtime.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (CueTimeline section)
 * for the interface contract. Satisfies Requirement 6.1 (entries ordered by
 * their target Song_Position) and produces the {@link ResolvedCue} and
 * {@link Expectation} shapes declared in `src/types.js`.
 */

/**
 * @typedef {import('../../types.js').TimelineEntry} TimelineEntry
 * @typedef {import('../../types.js').ResolvedCue} ResolvedCue
 * @typedef {import('../../types.js').Expectation} Expectation
 * @typedef {import('../../types.js').TimingWindow} TimingWindow
 * @typedef {import('./RhythmClock.js').default} RhythmClock
 */

/**
 * Build the Judgement-category dispatch map from a TimelineEntry's `on*`
 * action fields, including only the categories the entry actually provides.
 * @param {TimelineEntry} entry - The source expect entry.
 * @returns {Object<string, string>} Judgement category -> controller method name.
 */
function resolveActions(entry) {
  /** @type {Object<string, string>} */
  const actions = {};
  if (typeof entry.onPerfect === 'string' && entry.onPerfect.length > 0) {
    actions.perfect = entry.onPerfect;
  }
  if (typeof entry.onGood === 'string' && entry.onGood.length > 0) {
    actions.good = entry.onGood;
  }
  if (typeof entry.onBarely === 'string' && entry.onBarely.length > 0) {
    actions.barely = entry.onBarely;
  }
  if (typeof entry.onMiss === 'string' && entry.onMiss.length > 0) {
    actions.miss = entry.onMiss;
  }
  return actions;
}

/**
 * A zero-width fallback timing window, used when an expect entry omits its
 * `windowMs`. Keeps window bounds well defined (open === close === target).
 * @type {TimingWindow}
 */
const ZERO_WINDOW = { perfect: 0, good: 0, barely: 0 };

/**
 * Immutable, ordered view of a definition's timeline.
 */
class CueTimeline {
  /**
   * @param {ResolvedCue[]} cues - Presentation cues ordered by `atMs`.
   * @param {Expectation[]} expectations - Expectations ordered by `targetMs`.
   * @private
   */
  constructor(cues, expectations) {
    /** @type {ResolvedCue[]} @private */
    this._cues = cues;
    /** @type {Expectation[]} @private */
    this._expectations = expectations;
  }

  /**
   * Build a CueTimeline from raw definition entries, baking every beat to a
   * Song_Position (ms) via the supplied clock and ordering entries by their
   * resolved target Song_Position (R6.1).
   *
   * @param {TimelineEntry[]} entries - Raw cue/expect entries from a definition.
   * @param {RhythmClock} clock - Clock used to convert beats to milliseconds.
   * @returns {CueTimeline} The immutable, ordered timeline.
   */
  static build(entries, clock) {
    /** @type {ResolvedCue[]} */
    const cues = [];
    /** @type {Expectation[]} */
    const expectations = [];

    for (const entry of entries ?? []) {
      if (entry.type === 'expect') {
        expectations.push(CueTimeline._resolveExpectation(entry, clock));
      } else if (entry.type === 'cue') {
        cues.push(CueTimeline._resolveCue(entry, clock));
      }
    }

    // Order by resolved target Song_Position so downstream consumers see a
    // non-decreasing timeline (R6.1). A stable numeric sort preserves the
    // authored order for entries that resolve to the same millisecond.
    cues.sort((a, b) => a.atMs - b.atMs);
    expectations.sort((a, b) => a.targetMs - b.targetMs);

    return new CueTimeline(cues, expectations);
  }

  /**
   * Resolve a presentation cue entry to a {@link ResolvedCue}.
   * @param {TimelineEntry} entry - A `type: "cue"` entry.
   * @param {RhythmClock} clock - Clock for beat->ms conversion.
   * @returns {ResolvedCue}
   * @private
   */
  static _resolveCue(entry, clock) {
    return {
      id: entry.id,
      action: entry.action ?? '',
      atMs: clock.beatToMs(entry.beat)
    };
  }

  /**
   * Resolve an expect entry to an {@link Expectation}, baking the target beat
   * to ms and deriving the input window bounds from the timing window's widest
   * (`barely`) tolerance.
   * @param {TimelineEntry} entry - A `type: "expect"` entry.
   * @param {RhythmClock} clock - Clock for beat->ms conversion.
   * @returns {Expectation}
   * @private
   */
  static _resolveExpectation(entry, clock) {
    const targetBeat = entry.targetBeat ?? entry.beat;
    const targetMs = clock.beatToMs(targetBeat);
    const windowMs = entry.windowMs ?? ZERO_WINDOW;

    // The input window spans the widest tolerance (`barely`) either side of the
    // target: it opens `barely` ms early and closes `barely` ms late.
    const windowOpenMs = targetMs - windowMs.barely;
    const windowCloseMs = targetMs + windowMs.barely;

    /** @type {Expectation} */
    const expectation = {
      id: entry.id,
      gesture: entry.gesture ?? 'tap',
      direction: entry.direction ?? null,
      targetMs,
      windowOpenMs,
      windowCloseMs,
      windowMs,
      allowMultiple: entry.allowMultiple ?? false,
      actions: resolveActions(entry)
    };

    // Hold expectations carry a target span; convert the span in beats to ms
    // relative to the target so tempo changes across the span are honored.
    if (typeof entry.targetSpanBeats === 'number') {
      expectation.targetSpanMs = clock.beatToMs(targetBeat + entry.targetSpanBeats) - targetMs;
    }

    return expectation;
  }

  /**
   * Presentation cues, ordered by their firing Song_Position.
   * @returns {ResolvedCue[]}
   */
  get cues() {
    return this._cues;
  }

  /**
   * Expectations with resolved window open/close bounds, ordered by target
   * Song_Position.
   * @returns {Expectation[]}
   */
  get expectations() {
    return this._expectations;
  }
}

export default CueTimeline;

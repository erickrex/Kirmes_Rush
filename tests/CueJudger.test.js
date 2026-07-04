/**
 * @fileoverview Unit tests for CueJudger, the single authority that turns a
 * player Gesture (at a caller-supplied Song_Position derived from
 * `gesture.startTime`) into one of perfect/good/barely/miss/wrong.
 *
 * Covers Requirements 1.3, 1.5, 3.3, 3.4, 4.3, 4.4, 7.2, 7.3, 7.4, 7.5:
 * - windows: perfect/good/barely/miss classification against expectation.windowMs
 * - wrong type: a gesture whose type resolves no active expectation -> `wrong`
 * - wrong direction: a flick whose direction mismatches the expectation -> `wrong`
 * - release-before-window: a release before its window opens -> `wrong`
 * - duplicate rejection: a resolved single-input expectation rejects further
 *   gestures without a second judgement (R7.5), both end-to-end (via the real
 *   scheduler dropping the expectation) and via the judger's own guard
 *   (fake scheduler that keeps the expectation active)
 * - judged on gesture-start: the judgement derives solely from the supplied
 *   mapped Song_Position, never the confirmation/timestamp fields (R7.2)
 *
 * The companion property suite (Properties 2 and 4) lives in
 * `CueJudger.property.test.js`.
 *
 * Timelines are built through the real RhythmClock + CueTimeline and driven by
 * the real CueScheduler + RhythmScoring so window bounds and resolution
 * bookkeeping match production exactly. Conductor imports Phaser for its
 * EventEmitter; mock it so the harness stays headless, mirroring
 * CueScheduler.test.js.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Events: {
      EventEmitter: class MockEventEmitter {
        constructor() {
          this.listeners = new Map();
        }
        on(event, callback) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event).push(callback);
          return this;
        }
        emit(event, ...args) {
          const callbacks = this.listeners.get(event) || [];
          callbacks.forEach((cb) => cb(...args));
          return this;
        }
        removeAllListeners() {
          this.listeners.clear();
          return this;
        }
      }
    }
  }
}));

import Conductor from '../src/core/Conductor.js';
import RhythmClock from '../src/rhythm/core/RhythmClock.js';
import CueTimeline from '../src/rhythm/core/CueTimeline.js';
import CueScheduler, { CueSchedulerEvents } from '../src/rhythm/core/CueScheduler.js';
import RhythmScoring from '../src/rhythm/core/RhythmScoring.js';
import CueJudger from '../src/rhythm/core/CueJudger.js';

/** Timing window; at 120 BPM a beat is 500ms so beat 4 = 2000ms, window [1860, 2140]. */
const WINDOW = { perfect: 45, good: 90, barely: 140 };

/**
 * Build a Gesture with sensible defaults, overriding only the fields a test
 * cares about. The confirmation-derived fields (timestamp, position, distance,
 * velocity, durationMs) default to neutral values.
 * @param {Partial<import('../src/types.js').Gesture>} [overrides]
 * @returns {import('../src/types.js').Gesture}
 */
function makeGesture(overrides = {}) {
  return {
    type: 'tap',
    startTime: 0,
    timestamp: 0,
    position: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    durationMs: 0,
    distancePx: 0,
    velocityPxPerMs: 0,
    direction: null,
    ...overrides
  };
}

/**
 * A bus that records every scheduler emit, with helpers to query by event name.
 */
function createRecordingBus() {
  /** @type {Array<{event:string,payload:any}>} */
  const events = [];
  return {
    events,
    emit(event, payload) {
      events.push({ event, payload });
    },
    misses() {
      return events.filter((e) => e.event === CueSchedulerEvents.EXPECTATION_MISS).map((e) => e.payload);
    }
  };
}

/**
 * Assemble the real judging pipeline over a resolved timeline.
 * @param {any[]} entries - Raw cue/expect entries.
 * @returns {{ clock: RhythmClock, timeline: CueTimeline, scheduler: CueScheduler,
 *   scoring: RhythmScoring, judger: CueJudger, bus: ReturnType<typeof createRecordingBus> }}
 */
function makeSetup(entries) {
  Conductor.reset();
  const clock = new RhythmClock({ conductor: Conductor.instance });
  clock.start({ bpm: 120 });
  const timeline = CueTimeline.build(entries, clock);
  const bus = createRecordingBus();
  const scheduler = new CueScheduler(timeline, bus);
  const scoring = new RhythmScoring();
  const judger = new CueJudger({ scheduler, scoring });
  return { clock, timeline, scheduler, scoring, judger, bus };
}

describe('CueJudger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('timing windows against expectation.windowMs (R1.3, R7.4)', () => {
    /**
     * Judge a single tap against a beat-4 tap expectation at the given mapped
     * Song_Position, with the window open. Fresh pipeline per call so single-input
     * resolution never leaks between assertions.
     * @param {number} mappedSongPositionMs
     * @returns {import('../src/types.js').JudgementResult}
     */
    function judgeTapAt(mappedSongPositionMs) {
      const { scheduler, judger } = makeSetup([
        { id: 'tap-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);
      scheduler.update(2000); // open the window (target 2000ms)
      return judger.judge(makeGesture({ type: 'tap', startTime: 111 }), mappedSongPositionMs);
    }

    it('classifies an on-target offset as perfect', () => {
      const result = judgeTapAt(2000); // offset 0
      expect(result.judgement).toBe('perfect');
      expect(result.timingOffsetMs).toBe(0);
      expect(result.resolved).toBe(true);
      expect(result.expectationId).toBe('tap-1');
    });

    it('classifies an offset inside the good tolerance as good', () => {
      const result = judgeTapAt(2070); // offset +70 (>45, <=90)
      expect(result.judgement).toBe('good');
      expect(result.timingOffsetMs).toBe(70);
      expect(result.resolved).toBe(true);
    });

    it('classifies an offset inside the barely tolerance as barely', () => {
      const result = judgeTapAt(1880); // offset -120 (>90, <=140)
      expect(result.judgement).toBe('barely');
      expect(result.timingOffsetMs).toBe(-120);
      expect(result.resolved).toBe(true);
    });

    it('classifies an offset beyond the widest tolerance as miss (still resolving)', () => {
      const result = judgeTapAt(2200); // offset +200 (>140)
      expect(result.judgement).toBe('miss');
      expect(result.timingOffsetMs).toBe(200);
      expect(result.resolved).toBe(true);
    });

    it('treats window bounds as inclusive', () => {
      expect(judgeTapAt(2045).judgement).toBe('perfect'); // abs 45 == perfect bound
      expect(judgeTapAt(2090).judgement).toBe('good'); // abs 90 == good bound
      expect(judgeTapAt(2140).judgement).toBe('barely'); // abs 140 == barely bound
    });

    it('records exactly one judgement in scoring per resolving judge', () => {
      const { scheduler, scoring, judger } = makeSetup([
        { id: 'tap-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);
      scheduler.update(2000);
      judger.judge(makeGesture({ type: 'tap' }), 2000);
      expect(scoring.total).toBe(1);
      expect(scoring.counts.perfect).toBe(1);
    });
  });

  describe('wrong type (R1.5)', () => {
    it('returns wrong (non-resolving, no matched expectation) for a gesture type no active expectation resolves', () => {
      const { scheduler, scoring, judger } = makeSetup([
        { id: 'tap-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);
      scheduler.update(2000); // tap expectation active

      const result = judger.judge(makeGesture({ type: 'flick', direction: 'up' }), 2000);

      expect(result.judgement).toBe('wrong');
      expect(result.resolved).toBe(false);
      expect(result.expectationId).toBeNull();
      // The tap expectation is untouched and still active for a real tap.
      expect(scheduler.activeExpectations.size).toBe(1);
      expect(scoring.total).toBe(0);
    });

    it('returns wrong for a stray gesture when nothing is expected', () => {
      const { judger } = makeSetup([
        { id: 'tap-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);
      // No scheduler.update -> no window open -> no active expectations.
      const result = judger.judge(makeGesture({ type: 'tap' }), 2000);
      expect(result.judgement).toBe('wrong');
      expect(result.resolved).toBe(false);
      expect(result.expectationId).toBeNull();
    });
  });

  describe('flick direction (R4.3, R4.4)', () => {
    it('returns wrong (resolving) when the flick direction mismatches the required direction', () => {
      const { scheduler, scoring, judger } = makeSetup([
        {
          id: 'flick-1',
          type: 'expect',
          beat: 4,
          gesture: 'flick',
          direction: 'up',
          windowMs: WINDOW
        }
      ]);
      scheduler.update(2000);

      const result = judger.judge(
        makeGesture({ type: 'flick', direction: 'down' }),
        2000
      );

      expect(result.judgement).toBe('wrong');
      expect(result.resolved).toBe(true); // a genuine, resolving attempt
      expect(result.expectationId).toBe('flick-1');
      // Resolving drops it from the active set (single-input).
      expect(scheduler.activeExpectations.size).toBe(0);
      // wrong is recorded in scoring like any resolving outcome.
      expect(scoring.counts.wrong).toBe(1);
    });

    it('judges on timing when the flick direction matches', () => {
      const { scheduler, judger } = makeSetup([
        {
          id: 'flick-1',
          type: 'expect',
          beat: 4,
          gesture: 'flick',
          direction: 'up',
          windowMs: WINDOW
        }
      ]);
      scheduler.update(2000);

      const result = judger.judge(makeGesture({ type: 'flick', direction: 'up' }), 2000);
      expect(result.judgement).toBe('perfect');
      expect(result.resolved).toBe(true);
    });
  });

  describe('release before window (R3.4)', () => {
    it('returns wrong (non-resolving) for a release that arrives before its window opens', () => {
      const { scheduler, scoring, judger } = makeSetup([
        { id: 'rel-1', type: 'expect', beat: 4, gesture: 'release', windowMs: WINDOW }
        // target 2000ms, window opens 1860ms
      ]);
      // Advance far enough to open the window at the scheduler level so the
      // expectation is active, then judge with a mapped position that is still
      // before windowOpenMs.
      scheduler.update(2000);
      const result = judger.judge(makeGesture({ type: 'release' }), 1800); // < 1860

      expect(result.judgement).toBe('wrong');
      expect(result.resolved).toBe(false);
      expect(result.expectationId).toBe('rel-1');
      // Non-resolving: still active for an in-window release later.
      expect(scheduler.activeExpectations.size).toBe(1);
      expect(scoring.total).toBe(0);
    });
  });

  describe('duplicate rejection (R7.5)', () => {
    it('rejects a second gesture end-to-end: the resolved single-input expectation drops out', () => {
      const { scheduler, scoring, judger } = makeSetup([
        { id: 'tap-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);
      scheduler.update(2000);

      const first = judger.judge(makeGesture({ type: 'tap' }), 2000);
      expect(first.resolved).toBe(true);
      expect(first.judgement).toBe('perfect');
      expect(scheduler.activeExpectations.size).toBe(0);

      // A second tap finds no active expectation -> wrong, non-resolving, no
      // duplicate judgement recorded.
      const second = judger.judge(makeGesture({ type: 'tap' }), 2000);
      expect(second.resolved).toBe(false);
      expect(second.judgement).toBe('wrong');
      expect(scoring.total).toBe(1); // still exactly one recorded judgement
    });

    it('rejects a duplicate via the judger guard even if the scheduler keeps the expectation active', () => {
      // Lightweight fake scheduler that never drops the expectation from its
      // active set, isolating the judger's own _resolvedIds duplicate guard.
      /** @type {import('../src/types.js').Expectation} */
      const expectation = {
        id: 'tap-1',
        gesture: 'tap',
        direction: null,
        targetMs: 2000,
        windowOpenMs: 1860,
        windowCloseMs: 2140,
        windowMs: WINDOW,
        allowMultiple: false,
        actions: {}
      };
      const resolves = [];
      const fakeScheduler = {
        activeExpectations: new Set([expectation]),
        resolve(id, judgement) {
          resolves.push({ id, judgement });
        }
      };
      const scoring = new RhythmScoring();
      const judger = new CueJudger({ scheduler: fakeScheduler, scoring });

      const first = judger.judge(makeGesture({ type: 'tap' }), 2000);
      expect(first.resolved).toBe(true);
      expect(first.judgement).toBe('perfect');

      // Same expectation still active, but already resolved by this judger.
      const second = judger.judge(makeGesture({ type: 'tap' }), 2000);
      expect(second.resolved).toBe(false);
      expect(second.judgement).toBe('wrong');
      expect(second.expectationId).toBe('tap-1');

      // Only the first judgement resolved and was recorded.
      expect(resolves).toHaveLength(1);
      expect(scoring.total).toBe(1);
    });

    it('allows repeated resolution when the expectation permits multiple inputs', () => {
      /** @type {import('../src/types.js').Expectation} */
      const expectation = {
        id: 'tap-multi',
        gesture: 'tap',
        direction: null,
        targetMs: 2000,
        windowOpenMs: 1860,
        windowCloseMs: 2140,
        windowMs: WINDOW,
        allowMultiple: true,
        actions: {}
      };
      const fakeScheduler = {
        activeExpectations: new Set([expectation]),
        resolve() {}
      };
      const scoring = new RhythmScoring();
      const judger = new CueJudger({ scheduler: fakeScheduler, scoring });

      expect(judger.judge(makeGesture({ type: 'tap' }), 2000).resolved).toBe(true);
      // allowMultiple -> the second gesture still resolves rather than being rejected.
      expect(judger.judge(makeGesture({ type: 'tap' }), 2000).resolved).toBe(true);
      expect(scoring.total).toBe(2);
    });
  });

  describe('judged on gesture-start, not confirmation time (R7.2)', () => {
    it('produces the same judgement for two gestures sharing a mapped Song_Position but differing in confirmation fields', () => {
      /** Build a fresh setup, open the window, judge one gesture. */
      function judgeOnce(gesture) {
        const { scheduler, judger } = makeSetup([
          { id: 'tap-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
        ]);
        scheduler.update(2000);
        return judger.judge(gesture, 2070); // same mapped Song_Position for both
      }

      // Same startTime (the judged moment); wildly different confirmation data.
      const early = makeGesture({
        type: 'tap',
        startTime: 500,
        timestamp: 510,
        durationMs: 10,
        position: { x: 0, y: 0 },
        distancePx: 0
      });
      const late = makeGesture({
        type: 'tap',
        startTime: 500,
        timestamp: 999999,
        durationMs: 480,
        position: { x: 300, y: 400 },
        distancePx: 500
      });

      const a = judgeOnce(early);
      const b = judgeOnce(late);

      expect(a.judgement).toBe(b.judgement);
      expect(a.timingOffsetMs).toBe(b.timingOffsetMs);
      expect(a.judgement).toBe('good'); // offset +70
    });
  });
});

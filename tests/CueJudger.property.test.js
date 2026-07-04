/**
 * @fileoverview Property-based tests for CueJudger (fast-check).
 *
 * Property 2 (Exactly-once resolution): every Expectation resolves to exactly
 *   one outcome (perfect/good/barely/miss/wrong) across a run - never zero,
 *   never twice. This combines the scheduler's miss-on-close with the judger's
 *   gesture resolution: an Expectation is either resolved by a matched Gesture
 *   or marked `miss` when its window closes, and never both.
 *   **Validates: Requirements 6.4, 7.5**
 *
 * Property 4 (Judge on gesture-start): the Song_Position used for a Judgement
 *   derives solely from the caller-supplied mapped Song_Position (which the
 *   framework derives from `gesture.startTime`), independent of the
 *   pointerup/confirmation time. Varying the confirmation fields (timestamp,
 *   duration, position, distance, velocity) while holding the mapped
 *   Song_Position constant never changes the Judgement.
 *   **Validates: Requirements 7.2**
 *
 * Timelines are built through the real RhythmClock + CueTimeline and driven by
 * the real CueScheduler + RhythmScoring so resolution bookkeeping matches
 * production. Conductor imports Phaser for its EventEmitter; mock it so the
 * harness stays headless, mirroring the sibling suites.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

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

/** Timing window used when baking Expectations (barely=140ms => window width 280ms). */
const WINDOW = { perfect: 45, good: 90, barely: 140 };

/** Frame step (ms) small enough (< window width) that every open window is observed. */
const FRAME_STEP_MS = 50;

/**
 * Build a Gesture with neutral defaults.
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

/** A bus that records scheduler emits so we can count misses per Expectation. */
function createRecordingBus() {
  /** @type {Array<{event:string,payload:any}>} */
  const events = [];
  return {
    events,
    emit(event, payload) {
      events.push({ event, payload });
    },
    misses() {
      return events
        .filter((e) => e.event === CueSchedulerEvents.EXPECTATION_MISS)
        .map((e) => e.payload);
    }
  };
}

/** Fresh 120 BPM clock over a reset Conductor for isolated, deterministic baking. */
function freshClock() {
  Conductor.reset();
  const clock = new RhythmClock({ conductor: Conductor.instance });
  clock.start({ bpm: 120 });
  return clock;
}

describe('CueJudger properties', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 2: Exactly-once resolution.
   *
   * A run of well-separated tap Expectations is simulated frame by frame. For a
   * randomly chosen subset ("attempted"), a perfectly-timed tap is fed on the
   * first frame the window is open; the rest are left to be missed on close.
   * At the end, every Expectation must have exactly one outcome - resolved by
   * the judger XOR missed by the scheduler - never zero, never twice.
   *
   * **Validates: Requirements 6.4, 7.5**
   */
  it('resolves every Expectation to exactly one outcome across a run (Property 2)', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 15 }), (attempts) => {
        const clock = freshClock();

        // Well-separated expectations: beat (i+1)*2 => 1000ms apart. With a
        // 280ms window there is no overlap, so nearest-match is unambiguous.
        const entries = attempts.map((_, i) => ({
          id: `exp-${i}`,
          type: 'expect',
          beat: (i + 1) * 2,
          gesture: 'tap',
          windowMs: WINDOW
        }));

        const timeline = CueTimeline.build(entries, clock);
        const bus = createRecordingBus();
        const scheduler = new CueScheduler(timeline, bus);
        const scoring = new RhythmScoring();
        const judger = new CueJudger({ scheduler, scoring });

        const targetById = new Map(timeline.expectations.map((e) => [e.id, e.targetMs]));
        const attemptById = new Map(entries.map((e, i) => [e.id, attempts[i]]));

        /** Judger resolutions per Expectation id. */
        const resolvedCounts = new Map();
        /** Ids we have already fed a gesture for (feed each attempt once). */
        const fed = new Set();

        const lastClose = timeline.expectations.reduce((m, e) => Math.max(m, e.windowCloseMs), 0);
        const endPos = lastClose + 1000;

        for (let pos = 0; pos <= endPos; pos += FRAME_STEP_MS) {
          scheduler.update(pos);

          // Feed a perfect tap for each active, attempted, not-yet-fed expectation.
          for (const expectation of scheduler.activeExpectations) {
            if (attemptById.get(expectation.id) && !fed.has(expectation.id)) {
              fed.add(expectation.id);
              const result = judger.judge(
                makeGesture({ type: 'tap', startTime: pos }),
                targetById.get(expectation.id) // perfectly on target
              );
              if (result.resolved) {
                resolvedCounts.set(
                  expectation.id,
                  (resolvedCounts.get(expectation.id) ?? 0) + 1
                );
              }
            }
          }
        }

        // Miss counts per Expectation id from the scheduler.
        const missCounts = new Map();
        for (const miss of bus.misses()) {
          const id = miss.payload ? miss.payload.id : miss.expectation.id;
          missCounts.set(id, (missCounts.get(id) ?? 0) + 1);
        }

        // Exactly one outcome per Expectation - never zero, never twice.
        for (const expectation of timeline.expectations) {
          const resolved = resolvedCounts.get(expectation.id) ?? 0;
          const missed = missCounts.get(expectation.id) ?? 0;
          expect(resolved).toBeLessThanOrEqual(1);
          expect(missed).toBeLessThanOrEqual(1);
          expect(resolved + missed).toBe(1);

          // The outcome matches whether the expectation was attempted.
          if (attemptById.get(expectation.id)) {
            expect(resolved).toBe(1);
            expect(missed).toBe(0);
          } else {
            expect(resolved).toBe(0);
            expect(missed).toBe(1);
          }
        }

        // No Expectation remains active once the run has fully elapsed.
        expect(scheduler.activeExpectations.size).toBe(0);
        // Judger recorded exactly one judgement per attempted expectation.
        const attemptedCount = attempts.filter(Boolean).length;
        expect(scoring.total).toBe(attemptedCount);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 4: Judge on gesture-start.
   *
   * For an arbitrary mapped Song_Position (the value the framework derives from
   * `gesture.startTime`) and arbitrary confirmation fields, the Judgement is
   * invariant to the confirmation fields: two gestures that share the mapped
   * Song_Position but differ in timestamp/duration/position/distance/velocity
   * always produce the same judgement and timing offset.
   *
   * **Validates: Requirements 7.2**
   */
  it('judgement depends only on the mapped Song_Position, never confirmation fields (Property 4)', () => {
    /** Confirmation-only fields that must not influence the judgement. */
    const confirmationArb = fc.record({
      timestamp: fc.integer({ min: 0, max: 600000 }),
      durationMs: fc.integer({ min: 0, max: 5000 }),
      distancePx: fc.integer({ min: 0, max: 2000 }),
      velocityPxPerMs: fc.float({ min: 0, max: 10, noNaN: true }),
      px: fc.integer({ min: -500, max: 500 }),
      py: fc.integer({ min: -500, max: 500 })
    });

    /** Build a fresh pipeline, open the beat-4 tap window, judge one gesture. */
    function judgeOnce(gesture, mappedSongPositionMs) {
      const clock = freshClock();
      const timeline = CueTimeline.build(
        [{ id: 'tap-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }],
        clock
      );
      const scheduler = new CueScheduler(timeline);
      const scoring = new RhythmScoring();
      const judger = new CueJudger({ scheduler, scoring });
      scheduler.update(2000); // open the window (target 2000ms)
      return judger.judge(gesture, mappedSongPositionMs);
    }

    fc.assert(
      fc.property(
        // Mapped Song_Position spanning perfect/good/barely/miss around 2000ms.
        fc.integer({ min: 1600, max: 2400 }),
        fc.integer({ min: 0, max: 600000 }), // shared startTime (the judged moment)
        confirmationArb,
        confirmationArb,
        (mappedSongPositionMs, startTime, confA, confB) => {
          const gestureA = makeGesture({
            type: 'tap',
            startTime,
            timestamp: confA.timestamp,
            durationMs: confA.durationMs,
            distancePx: confA.distancePx,
            velocityPxPerMs: confA.velocityPxPerMs,
            position: { x: confA.px, y: confA.py }
          });
          const gestureB = makeGesture({
            type: 'tap',
            startTime,
            timestamp: confB.timestamp,
            durationMs: confB.durationMs,
            distancePx: confB.distancePx,
            velocityPxPerMs: confB.velocityPxPerMs,
            position: { x: confB.px, y: confB.py }
          });

          const a = judgeOnce(gestureA, mappedSongPositionMs);
          const b = judgeOnce(gestureB, mappedSongPositionMs);

          // Judgement and timing offset are identical: confirmation data is inert.
          expect(a.judgement).toBe(b.judgement);
          expect(a.timingOffsetMs).toBe(b.timingOffsetMs);
          // And the offset derives from the mapped Song_Position, not confirmation.
          expect(a.timingOffsetMs).toBe(mappedSongPositionMs - 2000);
        }
      ),
      { numRuns: 300 }
    );
  });
});

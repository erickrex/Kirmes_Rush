/**
 * @fileoverview Unit tests for CueScheduler, which fires timeline events at the
 * correct Song_Position, opens/closes Expectation input windows, and marks
 * unresolved Expectations as missed - all driven by an injected Song_Position
 * (never an internal clock).
 *
 * Covers Requirements 6.1-6.5 and 9.1-9.4 (deterministic, injected position):
 * - fire-once: each presentation cue fires exactly once (R6.2)
 * - miss-once: an unresolved Expectation is marked `miss` exactly once when its
 *   window closes (R6.4)
 * - ordering: cues fire in non-decreasing Song_Position order (R6.1)
 * - pause/resume: no emits while paused, no re-fire of emitted cues on resume
 *   (R9.1, R9.2)
 * - position pinning: songPositionMs mirrors the last injected value (R9.4)
 * - exactly-once resolution (scheduler side): resolving an Expectation prevents
 *   a later miss (R6.4 / Property 2 partial)
 *
 * The companion property suite lives in `CueScheduler.property.test.js`.
 *
 * Timelines are built through the real RhythmClock + CueTimeline so window
 * bounds are resolved exactly as production does. Conductor imports Phaser for
 * its EventEmitter; mock it so the harness stays headless, mirroring
 * CueTimeline.test.js / RhythmClock.test.js.
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

/** Default timing window; at 120 BPM a beat is 500ms so windows are easy to assert. */
const WINDOW = { perfect: 45, good: 90, barely: 140 };

/**
 * A bus that records every emit, with helpers to query by event name.
 * @returns {{ events: Array<{event:string,payload:any}>, emit: Function,
 *   cues: () => any[], opens: () => any[], misses: () => any[] }}
 */
function createRecordingBus() {
  /** @type {Array<{event:string,payload:any}>} */
  const events = [];
  return {
    events,
    emit(event, payload) {
      events.push({ event, payload });
    },
    cues() {
      return events.filter((e) => e.event === CueSchedulerEvents.CUE).map((e) => e.payload);
    },
    opens() {
      return events
        .filter((e) => e.event === CueSchedulerEvents.EXPECTATION_OPEN)
        .map((e) => e.payload);
    },
    misses() {
      return events
        .filter((e) => e.event === CueSchedulerEvents.EXPECTATION_MISS)
        .map((e) => e.payload);
    }
  };
}

describe('CueScheduler', () => {
  let clock;

  beforeEach(() => {
    Conductor.reset();
    clock = new RhythmClock({ conductor: Conductor.instance });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 120 BPM -> one beat = 500ms.
    clock.start({ bpm: 120 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Build a scheduler over a timeline resolved from the given raw entries.
   * @param {any[]} entries
   * @returns {{ scheduler: CueScheduler, bus: ReturnType<typeof createRecordingBus>, timeline: CueTimeline }}
   */
  function makeScheduler(entries) {
    const timeline = CueTimeline.build(entries, clock);
    const bus = createRecordingBus();
    const scheduler = new CueScheduler(timeline, bus);
    return { scheduler, bus, timeline };
  }

  describe('fire-once (R6.2)', () => {
    it('fires a presentation cue exactly once, and never before its target time', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'cue-1', type: 'cue', beat: 4, action: 'leaderClap' } // 2000ms
      ]);

      scheduler.update(1999);
      expect(bus.cues()).toHaveLength(0);

      scheduler.update(2000);
      expect(bus.cues()).toHaveLength(1);
      expect(bus.cues()[0].id).toBe('cue-1');

      // Repeated updates past the target must not re-fire.
      scheduler.update(2500);
      scheduler.update(3000);
      expect(bus.cues()).toHaveLength(1);
    });

    it('fires every distinct cue exactly once across a full sweep', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'a', type: 'cue', beat: 1, action: 'a' }, // 500ms
        { id: 'b', type: 'cue', beat: 2, action: 'b' }, // 1000ms
        { id: 'c', type: 'cue', beat: 4, action: 'c' } // 2000ms
      ]);

      for (let pos = 0; pos <= 3000; pos += 100) {
        scheduler.update(pos);
      }

      const ids = bus.cues().map((c) => c.id);
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('miss-once (R6.4)', () => {
    it('marks an unresolved Expectation miss exactly once when its window closes', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
        // target 2000ms, window [1860, 2140]
      ]);

      scheduler.update(2000); // inside window -> open, not missed yet
      expect(bus.misses()).toHaveLength(0);
      expect(scheduler.activeExpectations.size).toBe(1);

      scheduler.update(2141); // strictly past close -> miss once
      expect(bus.misses()).toHaveLength(1);
      expect(bus.misses()[0].expectation.id).toBe('exp-1');
      expect(bus.misses()[0].judgement).toBe('miss');

      // No duplicate miss on later frames.
      scheduler.update(2500);
      scheduler.update(5000);
      expect(bus.misses()).toHaveLength(1);
      expect(scheduler.activeExpectations.size).toBe(0);
    });

    it('opens an Expectation window exactly once at its open time (R6.3)', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);

      scheduler.update(1859); // just before open (1860)
      expect(bus.opens()).toHaveLength(0);

      scheduler.update(1860); // open time reached
      scheduler.update(1900); // still open - must not re-open
      expect(bus.opens()).toHaveLength(1);
      expect(bus.opens()[0].id).toBe('exp-1');
    });
  });

  describe('ordering (R6.1)', () => {
    it('fires cues in non-decreasing Song_Position order regardless of authored order', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'late', type: 'cue', beat: 8, action: 'a' }, // 4000ms
        { id: 'early', type: 'cue', beat: 2, action: 'b' }, // 1000ms
        { id: 'mid', type: 'cue', beat: 4, action: 'c' } // 2000ms
      ]);

      for (let pos = 0; pos <= 5000; pos += 250) {
        scheduler.update(pos);
      }

      const fired = bus.cues();
      expect(fired.map((c) => c.id)).toEqual(['early', 'mid', 'late']);
      for (let i = 1; i < fired.length; i += 1) {
        expect(fired[i].atMs).toBeGreaterThanOrEqual(fired[i - 1].atMs);
      }
    });
  });

  describe('pause / resume (R9.1, R9.2)', () => {
    it('emits nothing while paused and does not re-fire already-emitted cues on resume', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'c1', type: 'cue', beat: 2, action: 'a' }, // 1000ms
        { id: 'c2', type: 'cue', beat: 6, action: 'b' } // 3000ms
      ]);

      scheduler.update(1000); // c1 fires
      expect(bus.cues().map((c) => c.id)).toEqual(['c1']);

      scheduler.pause();
      // While paused, no cue may fire even though c2's time is reached.
      scheduler.update(1500);
      scheduler.update(3000);
      scheduler.update(3500);
      expect(bus.cues().map((c) => c.id)).toEqual(['c1']);

      scheduler.resume();
      scheduler.update(3500); // c2 now fires; c1 must NOT re-fire
      expect(bus.cues().map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('opens no Expectation windows while paused', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);

      scheduler.pause();
      scheduler.update(2000); // inside window, but paused
      expect(bus.opens()).toHaveLength(0);
      expect(scheduler.activeExpectations.size).toBe(0);

      scheduler.resume();
      scheduler.update(2000);
      expect(bus.opens()).toHaveLength(1);
      expect(scheduler.activeExpectations.size).toBe(1);
    });
  });

  describe('position pinning (R9.4)', () => {
    it('mirrors the last injected Song_Position', () => {
      const { scheduler } = makeScheduler([]);
      expect(scheduler.songPositionMs).toBe(0);

      scheduler.update(1234);
      expect(scheduler.songPositionMs).toBe(1234);

      scheduler.update(5678);
      expect(scheduler.songPositionMs).toBe(5678);
    });

    it('never advances the position on its own between updates', () => {
      const { scheduler } = makeScheduler([]);
      scheduler.update(4200);
      // Reading the getter repeatedly (no update) must not integrate a clock.
      expect(scheduler.songPositionMs).toBe(4200);
      expect(scheduler.songPositionMs).toBe(4200);
      expect(scheduler.songPositionMs).toBe(4200);
    });
  });

  describe('exactly-once resolution, scheduler side (R6.4 / Property 2 partial)', () => {
    it('does not mark a resolved Expectation as miss when its window later closes', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);

      scheduler.update(2000); // open
      expect(scheduler.activeExpectations.size).toBe(1);

      scheduler.resolve('exp-1', 'perfect');
      // Resolved single-input Expectation drops out of the active set immediately.
      expect(scheduler.activeExpectations.size).toBe(0);

      scheduler.update(2500); // past close - must NOT emit a miss
      scheduler.update(5000);
      expect(bus.misses()).toHaveLength(0);
    });

    it('ignores resolve for an already-missed Expectation (no state flip)', () => {
      const { scheduler, bus } = makeScheduler([
        { id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);

      scheduler.update(2000);
      scheduler.update(2141); // miss
      expect(bus.misses()).toHaveLength(1);

      // A late resolve for a missed Expectation is a no-op and cannot revive it.
      scheduler.resolve('exp-1', 'perfect');
      expect(scheduler.activeExpectations.size).toBe(0);
      expect(bus.misses()).toHaveLength(1);
    });

    it('ignores resolve for an unknown Expectation id', () => {
      const { scheduler } = makeScheduler([
        { id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }
      ]);
      expect(() => scheduler.resolve('does-not-exist', 'perfect')).not.toThrow();
    });
  });

  describe('operation without a bus', () => {
    it('tracks state via getters when no emitter is supplied', () => {
      const timeline = CueTimeline.build(
        [{ id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }],
        clock
      );
      const scheduler = new CueScheduler(timeline); // no bus

      scheduler.update(2000);
      expect(scheduler.activeExpectations.size).toBe(1);
      scheduler.update(2141);
      expect(scheduler.activeExpectations.size).toBe(0);
    });
  });
});

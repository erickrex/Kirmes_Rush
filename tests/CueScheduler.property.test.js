/**
 * @fileoverview Property-based tests for CueScheduler (fast-check), driven by an
 * injected Song_Position so scheduling and miss detection are deterministic.
 *
 * Implements the design's Correctness Properties for the scheduler:
 *
 * Property 1 (Monotonic scheduling): for any timeline, CueScheduler fires
 *   presentation cues in non-decreasing Song_Position order, and never before
 *   an earlier cue.
 *   **Validates: Requirements 6.1**
 *
 * Property 2 (partial - Exactly-once resolution, scheduler side): when no
 *   Expectation is resolved, every Expectation is marked `miss` exactly once
 *   as its window closes - never zero, never twice.
 *   **Validates: Requirements 6.4, 7.5**
 *
 * Property 6 (Position pinning): the scheduler's Song_Position always equals
 *   the last value injected via `update`; it never integrates an independent
 *   clock.
 *   **Validates: Requirements 9.4**
 *
 * Timelines are built through the real RhythmClock + CueTimeline. Conductor
 * imports Phaser for its EventEmitter; mock it so the harness stays headless,
 * mirroring the sibling scheduler/timeline suites.
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

/** Fixed timing window used when baking Expectations. */
const WINDOW = { perfect: 45, good: 90, barely: 140 };

/**
 * Build a fresh RhythmClock at 120 BPM over a reset Conductor singleton, so
 * every fast-check iteration bakes beats deterministically and in isolation.
 * @returns {RhythmClock}
 */
function freshClock() {
  Conductor.reset();
  const clock = new RhythmClock({ conductor: Conductor.instance });
  clock.start({ bpm: 120 });
  return clock;
}

/**
 * A recording bus that captures every emit alongside the Song_Position that was
 * current when it fired (read via the supplied getter). This lets Property 1
 * assert both fire order and "never before its target".
 * @param {() => number} positionGetter
 */
function createRecordingBus(positionGetter) {
  /** @type {Array<{event:string,payload:any,at:number}>} */
  const events = [];
  return {
    events,
    emit(event, payload) {
      events.push({ event, payload, at: positionGetter() });
    },
    cues() {
      return events.filter((e) => e.event === CueSchedulerEvents.CUE);
    },
    misses() {
      return events.filter((e) => e.event === CueSchedulerEvents.EXPECTATION_MISS);
    },
    opens() {
      return events.filter((e) => e.event === CueSchedulerEvents.EXPECTATION_OPEN);
    }
  };
}

/** Arbitrary beat value (0..96), integer to keep baked ms exact. */
const beatArb = fc.integer({ min: 0, max: 96 });

describe('CueScheduler properties', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 1: Monotonic scheduling.
   * **Validates: Requirements 6.1**
   */
  it('fires cues in non-decreasing Song_Position order, never before their target (Property 1)', () => {
    fc.assert(
      fc.property(
        fc.array(beatArb, { minLength: 0, maxLength: 25 }),
        fc.array(fc.integer({ min: 1, max: 900 }), { minLength: 0, maxLength: 80 }),
        (beats, frameDeltas) => {
          const clock = freshClock();
          const entries = beats.map((beat, i) => ({
            id: `cue-${i}`,
            type: 'cue',
            beat,
            action: 'a'
          }));
          const timeline = CueTimeline.build(entries, clock);

          let position = 0;
          const bus = createRecordingBus(() => position);
          const scheduler = new CueScheduler(timeline, bus);

          // Feed a monotonically increasing sequence of frame positions.
          for (const delta of frameDeltas) {
            position += delta;
            scheduler.update(position);
          }
          // Final flush guarantees every cue has had a chance to fire.
          const maxAtMs = timeline.cues.reduce((m, c) => Math.max(m, c.atMs), 0);
          position = maxAtMs + 1000;
          scheduler.update(position);

          const fired = bus.cues();

          // Every cue fired exactly once.
          expect(fired).toHaveLength(timeline.cues.length);

          for (let i = 0; i < fired.length; i += 1) {
            // Never fired before its target Song_Position.
            expect(fired[i].at).toBeGreaterThanOrEqual(fired[i].payload.atMs);
            // Non-decreasing fire order by target position.
            if (i > 0) {
              expect(fired[i].payload.atMs).toBeGreaterThanOrEqual(fired[i - 1].payload.atMs);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2 (partial): every unresolved Expectation is marked miss exactly
   * once as its window closes - never zero, never twice.
   * **Validates: Requirements 6.4, 7.5**
   */
  it('marks each unresolved Expectation miss exactly once (Property 2 partial)', () => {
    fc.assert(
      fc.property(
        fc.array(beatArb, { minLength: 0, maxLength: 25 }),
        fc.array(fc.integer({ min: 1, max: 900 }), { minLength: 0, maxLength: 80 }),
        (beats, frameDeltas) => {
          const clock = freshClock();
          const entries = beats.map((beat, i) => ({
            id: `exp-${i}`,
            type: 'expect',
            beat,
            gesture: 'tap',
            windowMs: WINDOW
          }));
          const timeline = CueTimeline.build(entries, clock);

          let position = 0;
          const bus = createRecordingBus(() => position);
          const scheduler = new CueScheduler(timeline, bus);

          for (const delta of frameDeltas) {
            position += delta;
            scheduler.update(position);
          }
          // Flush strictly past the latest window close so all windows close.
          const maxCloseMs = timeline.expectations.reduce(
            (m, e) => Math.max(m, e.windowCloseMs),
            0
          );
          position = maxCloseMs + 1000;
          scheduler.update(position);

          // Count misses and opens per Expectation id.
          const missCounts = new Map();
          for (const m of bus.misses()) {
            const id = m.payload.expectation.id;
            missCounts.set(id, (missCounts.get(id) ?? 0) + 1);
            expect(m.payload.judgement).toBe('miss');
          }
          const openCounts = new Map();
          for (const o of bus.opens()) {
            const id = o.payload.id;
            openCounts.set(id, (openCounts.get(id) ?? 0) + 1);
          }

          // Exactly one miss per Expectation - never zero, never twice.
          expect(bus.misses()).toHaveLength(timeline.expectations.length);
          for (const exp of timeline.expectations) {
            expect(missCounts.get(exp.id)).toBe(1);
            // And exactly one open per Expectation (windows open once).
            expect(openCounts.get(exp.id)).toBe(1);
          }

          // No Expectation remains active once all windows have closed.
          expect(scheduler.activeExpectations.size).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 6: Position pinning. The scheduler's Song_Position always equals
   * the last injected value and is never integrated internally.
   * **Validates: Requirements 9.4**
   */
  it('always reports the last injected Song_Position, never an integrated clock (Property 6)', () => {
    fc.assert(
      fc.property(
        fc.array(beatArb, { minLength: 0, maxLength: 10 }),
        fc.array(fc.integer({ min: 0, max: 600000 }), { minLength: 1, maxLength: 60 }),
        (beats, positions) => {
          const clock = freshClock();
          const entries = beats.map((beat, i) => ({
            id: `cue-${i}`,
            type: 'cue',
            beat,
            action: 'a'
          }));
          const timeline = CueTimeline.build(entries, clock);
          const scheduler = new CueScheduler(timeline);

          // Before any update the pinned position is the initial 0.
          expect(scheduler.songPositionMs).toBe(0);

          for (const pos of positions) {
            scheduler.update(pos);
            // After every update the getter equals exactly the injected value.
            expect(scheduler.songPositionMs).toBe(pos);
            // Re-reading without an update must not advance it (no internal clock).
            expect(scheduler.songPositionMs).toBe(pos);
          }

          // The final pinned value equals the last injected position.
          expect(scheduler.songPositionMs).toBe(positions[positions.length - 1]);
        }
      ),
      { numRuns: 200 }
    );
  });
});

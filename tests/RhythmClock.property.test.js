/**
 * @fileoverview Property-based tests for RhythmClock beat<->ms conversion.
 *
 * Feature: rhythm-minigame-prototype, Property 3: Beat<->ms round-trip.
 * For all beats `b`, `msToBeat(beatToMs(b)) ≈ b` within a defined tolerance.
 *
 * **Validates: Requirements 5.5, 17.5**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// Conductor imports Phaser (via the phaser.js adapter) for its EventEmitter.
// Mock it so the harness stays headless, mirroring Conductor.test.js.
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

const NUM_RUNS = 300;

/**
 * The round-trip tolerance in beats. Conversion is analytically exact for a
 * constant BPM, so only floating-point error accumulates; 1e-6 beats is a
 * comfortably tight bound across the tested BPM and beat ranges.
 * @type {number}
 */
const TOLERANCE_BEATS = 1e-6;

describe('Property 3: RhythmClock beat<->ms round-trip', () => {
  let clock;

  beforeEach(() => {
    Conductor.reset();
    clock = new RhythmClock({ conductor: Conductor.instance });
    // forceBPM logs via console.warn on every run; silence it.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('msToBeat(beatToMs(b)) ≈ b for all beats at a fixed BPM (R5.5, R17.5)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 30, max: 400, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 2000, noNaN: true, noDefaultInfinity: true }),
        (bpm, beat) => {
          clock.start({ bpm });
          const roundTrip = clock.msToBeat(clock.beatToMs(beat));
          expect(Math.abs(roundTrip - beat)).toBeLessThanOrEqual(TOLERANCE_BEATS);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('round-trip holds across a multi-segment tempo map (R5.4, R5.5)', () => {
    // A fixed clean tempo map whose beat times are exact integers, so no
    // rounding error is introduced by the Conductor's tempo-map baking.
    const timeChanges = [
      { timeStamp: 0, bpm: 120 }, // beat 0
      { timeStamp: 2000, bpm: 60 }, // beat 4
      { timeStamp: 6000, bpm: 240 } // beat 8
    ];

    fc.assert(
      fc.property(fc.double({ min: 0, max: 64, noNaN: true, noDefaultInfinity: true }), (beat) => {
        clock.start({ bpm: 120, timeChanges });
        const roundTrip = clock.msToBeat(clock.beatToMs(beat));
        expect(Math.abs(roundTrip - beat)).toBeLessThanOrEqual(1e-4);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

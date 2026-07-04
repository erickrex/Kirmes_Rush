/**
 * @fileoverview Unit tests for RhythmClock, the neutral timing source that
 * wraps the Conductor singleton for the rhythm minigame framework.
 *
 * Covers Requirements 5.1-5.5 and 17.3:
 * - beat <-> ms conversion for a fixed BPM (5.2)
 * - timeChanges conversion honoring a tempo map (5.4)
 * - consistency with the Conductor for the same beat and BPM (5.5)
 * - injected Song_Position without live audio (5.3, 17.3)
 *
 * The beat<->ms round-trip property (Property 3, Requirements 5.5/17.5) lives
 * in the companion `RhythmClock.property.test.js`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

describe('RhythmClock', () => {
  let conductor;
  let clock;

  beforeEach(() => {
    // Reset the Conductor singleton so each test starts from a clean tempo map.
    Conductor.reset();
    conductor = Conductor.instance;
    clock = new RhythmClock({ conductor });
    // forceBPM / mapTimeChanges log via console.warn; silence for clean output.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start (R5.1)', () => {
    it('forces a constant BPM when no timeChanges are supplied', () => {
      clock.start({ bpm: 120 });
      expect(conductor.bpm).toBe(120);
      expect(conductor.timeChanges.length).toBe(0);
    });

    it('applies an instrumental offset from the config', () => {
      clock.start({ bpm: 120, offsetMs: 42 });
      expect(conductor.instrumentalOffset).toBe(42);
    });

    it('maps a tempo map when timeChanges are supplied (R5.4)', () => {
      clock.start({
        bpm: 120,
        timeChanges: [
          { timeStamp: 0, bpm: 120 },
          { timeStamp: 2000, bpm: 60 }
        ]
      });
      expect(conductor.timeChanges.length).toBe(2);
    });
  });

  describe('beatToMs / msToBeat for a fixed BPM (R5.2)', () => {
    beforeEach(() => {
      clock.start({ bpm: 120 });
    });

    it('converts beats to milliseconds at 120 BPM (beat = 500ms)', () => {
      expect(clock.beatToMs(0)).toBe(0);
      expect(clock.beatToMs(1)).toBe(500);
      expect(clock.beatToMs(2)).toBe(1000);
      expect(clock.beatToMs(0.5)).toBe(250);
    });

    it('converts milliseconds to beats at 120 BPM', () => {
      expect(clock.msToBeat(0)).toBe(0);
      expect(clock.msToBeat(500)).toBe(1);
      expect(clock.msToBeat(1000)).toBe(2);
      expect(clock.msToBeat(250)).toBe(0.5);
    });

    it('round-trips a beat through ms and back (example)', () => {
      for (const beat of [0, 1, 2.5, 7, 13.75]) {
        expect(clock.msToBeat(clock.beatToMs(beat))).toBeCloseTo(beat, 10);
      }
    });
  });

  describe('timeChanges conversion (R5.4)', () => {
    beforeEach(() => {
      // Segment 1: 120 BPM (beat = 500ms) until beat 4 at 2000ms.
      // Segment 2: 60 BPM (beat = 1000ms) thereafter.
      clock.start({
        bpm: 120,
        timeChanges: [
          { timeStamp: 0, bpm: 120 },
          { timeStamp: 2000, bpm: 60 }
        ]
      });
    });

    it('converts beats within the first tempo segment', () => {
      expect(clock.beatToMs(2)).toBe(1000);
      expect(clock.msToBeat(1000)).toBeCloseTo(2, 6);
    });

    it('converts beats within the second tempo segment', () => {
      // Beat 4 sits on the tempo change at 2000ms; beat 6 is two 60-BPM beats later.
      expect(clock.beatToMs(4)).toBe(2000);
      expect(clock.beatToMs(6)).toBe(4000);
      expect(clock.msToBeat(4000)).toBeCloseTo(6, 6);
    });

    it('round-trips beats across both tempo segments', () => {
      for (const beat of [0, 1.5, 3.25, 4, 5.5, 8]) {
        expect(clock.msToBeat(clock.beatToMs(beat))).toBeCloseTo(beat, 6);
      }
    });
  });

  describe('consistency with the Conductor for the same beat and BPM (R5.5)', () => {
    it('beatToMs matches Conductor.getBeatTimeInMs for a fixed BPM', () => {
      clock.start({ bpm: 140 });
      for (const beat of [0, 1, 3, 8.5, 20]) {
        expect(clock.beatToMs(beat)).toBe(conductor.getBeatTimeInMs(beat));
      }
    });

    it('produces the same beat length the Conductor reports', () => {
      clock.start({ bpm: 100 });
      // At 100 BPM a beat is 600ms; one beat converted then back is 600ms.
      expect(clock.beatToMs(1)).toBe(conductor.beatLengthMs);
    });
  });

  describe('injected Song_Position without live audio (R5.3, R17.3)', () => {
    beforeEach(() => {
      clock.start({ bpm: 120 });
    });

    it('stores the injected Song_Position from update()', () => {
      clock.update(1234);
      expect(clock.songPositionMs).toBe(1234);
      clock.update(5678);
      expect(clock.songPositionMs).toBe(5678);
    });

    it('forwards the injected position to the Conductor rather than integrating its own clock', () => {
      clock.update(1000);
      // 1000ms at 120 BPM is 2 beats.
      expect(conductor.songPosition).toBe(1000);
      expect(clock.songBeat).toBeCloseTo(2, 4);
    });

    it('starts at Song_Position 0', () => {
      expect(clock.songPositionMs).toBe(0);
    });
  });

  describe('destroy', () => {
    it('tears down the wrapped Conductor', () => {
      clock.start({ bpm: 120, timeChanges: [{ timeStamp: 0, bpm: 120 }] });
      clock.destroy();
      expect(conductor.timeChanges.length).toBe(0);
      expect(conductor.currentTimeChange).toBeNull();
    });
  });
});

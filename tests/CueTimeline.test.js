/**
 * @fileoverview Unit tests for CueTimeline, the immutable ordered view of a
 * Minigame_Definition timeline that bakes beats to Song_Position milliseconds.
 *
 * Covers Requirement 6.1 and the CueTimeline design contract:
 * - entries ordered by their resolved target Song_Position
 * - input window bounds derived from the timing window's `barely` tolerance
 * - cue vs expect split into the ResolvedCue / Expectation shapes
 * - action fields mapped into a judgement-category dispatch map
 *
 * Conductor imports Phaser for its EventEmitter; mock it so the harness stays
 * headless, mirroring Conductor.test.js / RhythmClock.test.js.
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

/** A default timing window used across the fixtures. */
const WINDOW = { perfect: 45, good: 90, barely: 140 };

describe('CueTimeline', () => {
  let clock;

  beforeEach(() => {
    Conductor.reset();
    clock = new RhythmClock({ conductor: Conductor.instance });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 120 BPM -> one beat = 500ms; keeps the arithmetic easy to assert.
    clock.start({ bpm: 120 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cue vs expect split', () => {
    it('routes cue entries to cues and expect entries to expectations', () => {
      const timeline = CueTimeline.build(
        [
          { id: 'cue-1', type: 'cue', beat: 4, action: 'leaderClap' },
          {
            id: 'exp-1',
            type: 'expect',
            beat: 5,
            gesture: 'tap',
            targetBeat: 5,
            windowMs: WINDOW
          }
        ],
        clock
      );

      expect(timeline.cues).toHaveLength(1);
      expect(timeline.expectations).toHaveLength(1);
      expect(timeline.cues[0].id).toBe('cue-1');
      expect(timeline.expectations[0].id).toBe('exp-1');
    });

    it('produces the ResolvedCue shape with the baked firing position', () => {
      const timeline = CueTimeline.build(
        [{ id: 'cue-1', type: 'cue', beat: 4, action: 'leaderClap' }],
        clock
      );

      expect(timeline.cues[0]).toEqual({
        id: 'cue-1',
        action: 'leaderClap',
        atMs: 2000 // beat 4 at 120 BPM
      });
    });

    it('ignores entries whose type is neither cue nor expect', () => {
      const timeline = CueTimeline.build(
        [{ id: 'weird', type: 'other', beat: 1 }],
        clock
      );
      expect(timeline.cues).toHaveLength(0);
      expect(timeline.expectations).toHaveLength(0);
    });

    it('tolerates null/undefined entries', () => {
      const timeline = CueTimeline.build(undefined, clock);
      expect(timeline.cues).toEqual([]);
      expect(timeline.expectations).toEqual([]);
    });
  });

  describe('ordering by resolved ms (R6.1)', () => {
    it('sorts cues by their firing Song_Position regardless of authored order', () => {
      const timeline = CueTimeline.build(
        [
          { id: 'late', type: 'cue', beat: 8, action: 'a' },
          { id: 'early', type: 'cue', beat: 2, action: 'b' },
          { id: 'mid', type: 'cue', beat: 4, action: 'c' }
        ],
        clock
      );

      expect(timeline.cues.map((c) => c.id)).toEqual(['early', 'mid', 'late']);
      const positions = timeline.cues.map((c) => c.atMs);
      for (let i = 1; i < positions.length; i += 1) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it('sorts expectations by their target Song_Position regardless of authored order', () => {
      const timeline = CueTimeline.build(
        [
          { id: 'e-late', type: 'expect', beat: 6, gesture: 'tap', windowMs: WINDOW },
          { id: 'e-early', type: 'expect', beat: 1, gesture: 'tap', windowMs: WINDOW },
          { id: 'e-mid', type: 'expect', beat: 3, gesture: 'tap', windowMs: WINDOW }
        ],
        clock
      );

      expect(timeline.expectations.map((e) => e.id)).toEqual(['e-early', 'e-mid', 'e-late']);
      const targets = timeline.expectations.map((e) => e.targetMs);
      for (let i = 1; i < targets.length; i += 1) {
        expect(targets[i]).toBeGreaterThanOrEqual(targets[i - 1]);
      }
    });
  });

  describe('window bounds derived from windowMs', () => {
    it('opens/closes the window at the barely tolerance either side of the target', () => {
      const timeline = CueTimeline.build(
        [{ id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }],
        clock
      );

      const exp = timeline.expectations[0];
      expect(exp.targetMs).toBe(2000); // beat 4 at 120 BPM
      expect(exp.windowOpenMs).toBe(2000 - WINDOW.barely);
      expect(exp.windowCloseMs).toBe(2000 + WINDOW.barely);
      expect(exp.windowMs).toEqual(WINDOW);
    });

    it('resolves targetMs from targetBeat when it differs from beat', () => {
      const timeline = CueTimeline.build(
        [{ id: 'exp-1', type: 'expect', beat: 2, targetBeat: 6, gesture: 'tap', windowMs: WINDOW }],
        clock
      );
      // targetBeat 6 at 120 BPM = 3000ms, overriding beat 2.
      expect(timeline.expectations[0].targetMs).toBe(3000);
    });

    it('falls back to a zero-width window when windowMs is omitted', () => {
      const timeline = CueTimeline.build(
        [{ id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap' }],
        clock
      );
      const exp = timeline.expectations[0];
      expect(exp.windowOpenMs).toBe(2000);
      expect(exp.windowCloseMs).toBe(2000);
      expect(exp.windowMs).toEqual({ perfect: 0, good: 0, barely: 0 });
    });
  });

  describe('expectation shape', () => {
    it('maps on* action fields into a judgement-category dispatch map', () => {
      const timeline = CueTimeline.build(
        [
          {
            id: 'exp-1',
            type: 'expect',
            beat: 4,
            gesture: 'tap',
            windowMs: WINDOW,
            onPerfect: 'clapPerfect',
            onGood: 'clapGood',
            onBarely: 'clapBarely',
            onMiss: 'clapMiss'
          }
        ],
        clock
      );

      expect(timeline.expectations[0].actions).toEqual({
        perfect: 'clapPerfect',
        good: 'clapGood',
        barely: 'clapBarely',
        miss: 'clapMiss'
      });
    });

    it('omits action entries that are not provided', () => {
      const timeline = CueTimeline.build(
        [
          {
            id: 'exp-1',
            type: 'expect',
            beat: 4,
            gesture: 'tap',
            windowMs: WINDOW,
            onPerfect: 'clapPerfect'
          }
        ],
        clock
      );

      expect(timeline.expectations[0].actions).toEqual({ perfect: 'clapPerfect' });
    });

    it('defaults direction to null and allowMultiple to false', () => {
      const timeline = CueTimeline.build(
        [{ id: 'exp-1', type: 'expect', beat: 4, gesture: 'tap', windowMs: WINDOW }],
        clock
      );
      const exp = timeline.expectations[0];
      expect(exp.direction).toBeNull();
      expect(exp.allowMultiple).toBe(false);
      expect(exp.targetSpanMs).toBeUndefined();
    });

    it('carries direction and allowMultiple when provided', () => {
      const timeline = CueTimeline.build(
        [
          {
            id: 'flick-1',
            type: 'expect',
            beat: 4,
            gesture: 'flick',
            direction: 'up',
            allowMultiple: true,
            windowMs: WINDOW
          }
        ],
        clock
      );
      const exp = timeline.expectations[0];
      expect(exp.direction).toBe('up');
      expect(exp.allowMultiple).toBe(true);
    });

    it('resolves a hold target span in beats to milliseconds relative to the target', () => {
      const timeline = CueTimeline.build(
        [
          {
            id: 'hold-1',
            type: 'expect',
            beat: 4,
            gesture: 'hold',
            targetSpanBeats: 2,
            windowMs: WINDOW
          }
        ],
        clock
      );
      // 2 beats at 120 BPM = 1000ms span.
      expect(timeline.expectations[0].targetSpanMs).toBe(1000);
    });
  });
});

/**
 * @fileoverview Unit tests for {@link TouchGestureRecognizer}.
 *
 * Exercises the recognizer with synthetic pointer-event-like objects and an
 * injected clock (R17.1) so gesture classification can be validated without any
 * real pointer physics. Covers tap, hold start/tick (polled model), release,
 * flick + direction, and asserts that the judged moment (`startTime`) is the
 * pointerdown instant regardless of when pointerup happens (R7.1 / R15.*).
 *
 * Feature: rhythm-minigame-prototype
 * **Validates: Requirements 15.5, 16.1, 17.1, 17.2**
 */

import { describe, it, expect } from 'vitest';
import TouchGestureRecognizer from '../src/rhythm/input/TouchGestureRecognizer.js';

/**
 * Build a recognizer wired to a mutable clock and a captured-gesture array.
 * @param {Partial<import('../src/types.js').GestureThresholds>} [thresholds]
 */
function makeRecognizer(thresholds) {
  const clock = { value: 0 };
  const gestures = [];
  const recognizer = new TouchGestureRecognizer({
    canvas: makeFakeCanvas(),
    now: () => clock.value,
    thresholds,
    onGesture: (g) => gestures.push(g)
  });
  return { recognizer, gestures, clock };
}

/**
 * Minimal fake canvas that satisfies the attach/detach guards and records
 * listener registrations so teardown can be inspected.
 */
function makeFakeCanvas() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    listenerCount() {
      let n = 0;
      for (const set of listeners.values()) {
        n += set.size;
      }
      return n;
    }
  };
}

describe('TouchGestureRecognizer - tap (R15.1)', () => {
  it('emits exactly one tap for a short, still down->up under thresholds', () => {
    const { recognizer, gestures, clock } = makeRecognizer();

    clock.value = 1000;
    recognizer._onDown({ pointerId: 1, clientX: 100, clientY: 100 });

    clock.value = 1050; // 50ms < maxTapDurationMs(200), no movement
    recognizer._onUp({ pointerId: 1, clientX: 100, clientY: 100 });

    expect(gestures).toHaveLength(1);
    expect(gestures[0].type).toBe('tap');
  });

  it('reports startTime as the injected now() captured at pointerdown', () => {
    const { recognizer, gestures, clock } = makeRecognizer();

    clock.value = 4242;
    recognizer._onDown({ pointerId: 1, clientX: 10, clientY: 10 });

    clock.value = 4300; // pointerup at a different time
    recognizer._onUp({ pointerId: 1, clientX: 12, clientY: 11 });

    expect(gestures).toHaveLength(1);
    expect(gestures[0].type).toBe('tap');
    // The judged moment is the pointerdown instant, NOT the pointerup time.
    expect(gestures[0].startTime).toBe(4242);
    expect(gestures[0].timestamp).toBe(4300);
  });
});

describe('TouchGestureRecognizer - hold start/tick via poll (R2.2/R2.3)', () => {
  it('emits holdStart exactly once at startTime + holdThresholdMs', () => {
    const { recognizer, gestures, clock } = makeRecognizer();

    clock.value = 1000;
    recognizer._onDown({ pointerId: 1, clientX: 5, clientY: 5 });

    // Just past the hold threshold (250ms), before any tick interval elapses.
    recognizer.poll(1275);
    recognizer.poll(1280); // polling again must not re-emit holdStart

    const holdStarts = gestures.filter((g) => g.type === 'holdStart');
    expect(holdStarts).toHaveLength(1);
    // holdStart carries the moment the threshold was crossed and elapsed = 250.
    expect(holdStarts[0].startTime).toBe(1000);
    expect(holdStarts[0].timestamp).toBe(1250);
    expect(holdStarts[0].durationMs).toBe(250);
  });

  it('emits catch-up holdTicks carrying increasing elapsed durationMs', () => {
    const { recognizer, gestures, clock } = makeRecognizer();

    clock.value = 1000;
    recognizer._onDown({ pointerId: 1, clientX: 5, clientY: 5 });

    // Advance well past several tick intervals (holdThreshold 250, interval 50).
    recognizer.poll(1420);

    const ticks = gestures.filter((g) => g.type === 'holdTick');
    // Ticks are due at t=1300,1350,1400 -> elapsed 300,350,400.
    expect(ticks.map((g) => g.durationMs)).toEqual([300, 350, 400]);
    // All ticks share the original gesture-start.
    for (const tick of ticks) {
      expect(tick.startTime).toBe(1000);
    }
  });
});

describe('TouchGestureRecognizer - release after hold (R3.2)', () => {
  it('emits release carrying the total hold durationMs on pointerup', () => {
    const { recognizer, gestures, clock } = makeRecognizer();

    clock.value = 1000;
    recognizer._onDown({ pointerId: 1, clientX: 5, clientY: 5 });

    recognizer.poll(1300); // holdStart + first tick

    clock.value = 1500; // pointerup 500ms after gesture-start
    recognizer._onUp({ pointerId: 1, clientX: 5, clientY: 5 });

    const releases = gestures.filter((g) => g.type === 'release');
    expect(releases).toHaveLength(1);
    expect(releases[0].durationMs).toBe(500);
    expect(releases[0].startTime).toBe(1000);
    // A held interaction must NOT also produce a tap.
    expect(gestures.some((g) => g.type === 'tap')).toBe(false);
  });
});

describe('TouchGestureRecognizer - flick + direction (R15.3/R15.4/R4.2)', () => {
  const cases = [
    { name: 'right', dx: 60, dy: 0, expected: 'right' },
    { name: 'left', dx: -60, dy: 0, expected: 'left' },
    { name: 'down', dx: 0, dy: 60, expected: 'down' },
    { name: 'up', dx: 0, dy: -60, expected: 'up' }
  ];

  for (const { name, dx, dy, expected } of cases) {
    it(`classifies a fast, long ${name} movement as flick with direction "${expected}"`, () => {
      const { recognizer, gestures, clock } = makeRecognizer();

      clock.value = 2000;
      recognizer._onDown({ pointerId: 1, clientX: 200, clientY: 200 });

      clock.value = 2010; // 10ms -> velocity 6px/ms > 0.5, distance 60 > 40
      recognizer._onUp({ pointerId: 1, clientX: 200 + dx, clientY: 200 + dy });

      expect(gestures).toHaveLength(1);
      expect(gestures[0].type).toBe('flick');
      expect(gestures[0].direction).toBe(expected);
      expect(gestures[0].startTime).toBe(2000);
    });
  }
});

describe('TouchGestureRecognizer - synthetic-sequence equivalence (R17.2)', () => {
  it('produces identical gestures from the same synthetic sequence', () => {
    /** Drive a scripted sequence against a fresh recognizer and return gestures. */
    const run = () => {
      const { recognizer, gestures, clock } = makeRecognizer();
      clock.value = 500;
      recognizer._onDown({ pointerId: 7, clientX: 50, clientY: 50 });
      clock.value = 540;
      recognizer._onMove({ pointerId: 7, clientX: 52, clientY: 51 });
      recognizer.poll(800); // cross hold threshold + ticks
      clock.value = 900;
      recognizer._onUp({ pointerId: 7, clientX: 52, clientY: 51 });
      return gestures;
    };

    const first = run();
    const second = run();
    expect(second).toEqual(first);
    // Sanity: the sequence actually produced a hold lifecycle.
    expect(first.map((g) => g.type)).toContain('holdStart');
    expect(first.map((g) => g.type)).toContain('release');
  });
});

describe('TouchGestureRecognizer - listener conservation (R16.1)', () => {
  it('registers pointer listeners on attach and removes them on detach', () => {
    const canvas = makeFakeCanvas();
    const recognizer = new TouchGestureRecognizer({
      canvas,
      now: () => 0,
      onGesture: () => {}
    });

    expect(canvas.listenerCount()).toBe(0);
    recognizer.attach();
    expect(canvas.listenerCount()).toBe(3);
    recognizer.detach();
    expect(canvas.listenerCount()).toBe(0);
  });

  it('is idempotent: repeated attach does not double-register', () => {
    const canvas = makeFakeCanvas();
    const recognizer = new TouchGestureRecognizer({
      canvas,
      now: () => 0,
      onGesture: () => {}
    });

    recognizer.attach();
    recognizer.attach();
    expect(canvas.listenerCount()).toBe(3);
    recognizer.detach();
    expect(canvas.listenerCount()).toBe(0);
  });
});

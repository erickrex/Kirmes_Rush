/**
 * @fileoverview Property-based tests for {@link TouchGestureRecognizer}.
 *
 * Feature: rhythm-minigame-prototype
 * - Property 7: Listener conservation — after `detach()` zero pointer listeners
 *   registered by the recognizer remain. **Validates: Requirements 16.1**
 * - Property 9: No spurious gestures — a pointer interaction satisfying none of
 *   the tap/hold/flick thresholds emits no Gesture. **Validates: Requirements 15.5**
 *
 * Tests use synthetic pointer-event-like objects with an injected clock (R17.1)
 * and a fake canvas that records add/removeEventListener calls; no real DOM or
 * pointer physics is involved.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import TouchGestureRecognizer from '../src/rhythm/input/TouchGestureRecognizer.js';

const NUM_RUNS = 200;

// Default thresholds mirrored from TouchGestureRecognizer (DEFAULT_THRESHOLDS).
const T = {
  maxTapDurationMs: 200,
  maxTapMovePx: 16,
  holdThresholdMs: 250,
  holdTickIntervalMs: 50,
  flickDistancePx: 40,
  flickVelocityPxPerMs: 0.5
};

/**
 * Fake canvas recording every listener registration so we can assert exactly
 * how many remain after a sequence of attach/detach operations.
 */
function createFakeCanvas() {
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

describe('Property 7: Listener conservation after detach (R16.1)', () => {
  it('SHALL leave zero registered pointer listeners after a final detach()', () => {
    // A sequence of attach/detach operations of arbitrary length/order, always
    // finished with a detach(). The recognizer must remove exactly what it added.
    const opArb = fc.constantFrom('attach', 'detach');

    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 12 }), (ops) => {
        const canvas = createFakeCanvas();
        const recognizer = new TouchGestureRecognizer({
          canvas,
          now: () => 0,
          onGesture: () => {}
        });

        for (const op of ops) {
          if (op === 'attach') {
            recognizer.attach();
          } else {
            recognizer.detach();
          }
        }
        recognizer.detach(); // final teardown

        expect(canvas.listenerCount()).toBe(0);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('SHALL never exceed the 3 listeners it registers (no double-registration)', () => {
    const opArb = fc.constantFrom('attach', 'detach');

    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 12 }), (ops) => {
        const canvas = createFakeCanvas();
        const recognizer = new TouchGestureRecognizer({
          canvas,
          now: () => 0,
          onGesture: () => {}
        });

        for (const op of ops) {
          if (op === 'attach') {
            recognizer.attach();
          } else {
            recognizer.detach();
          }
          expect(canvas.listenerCount()).toBeLessThanOrEqual(3);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

describe('Property 9: No spurious gestures (R15.5)', () => {
  it('SHALL emit no Gesture for an interaction satisfying none of tap/hold/flick', () => {
    fc.assert(
      fc.property(
        fc.record({
          startX: fc.integer({ min: 0, max: 1000 }),
          startY: fc.integer({ min: 0, max: 1000 }),
          dx: fc.integer({ min: -500, max: 500 }),
          dy: fc.integer({ min: -500, max: 500 }),
          downTime: fc.integer({ min: 0, max: 100000 }),
          durationMs: fc.integer({ min: 1, max: 5000 })
        }),
        ({ startX, startY, dx, dy, downTime, durationMs }) => {
          const distancePx = Math.sqrt(dx * dx + dy * dy);
          const velocityPxPerMs = distancePx / durationMs;

          const isTap = durationMs < T.maxTapDurationMs && distancePx < T.maxTapMovePx;
          const isFlick =
            distancePx > T.flickDistancePx && velocityPxPerMs > T.flickVelocityPxPerMs;

          // We drive only down -> up with no poll() and no move, so a hold can
          // never start. Restrict to interactions that are also neither tap nor
          // flick: those satisfy none of the thresholds (R15.5).
          fc.pre(!isTap && !isFlick);

          const gestures = [];
          let clock = downTime;
          const recognizer = new TouchGestureRecognizer({
            canvas: createFakeCanvas(),
            now: () => clock,
            onGesture: (g) => gestures.push(g)
          });

          recognizer._onDown({ pointerId: 1, clientX: startX, clientY: startY });
          clock = downTime + durationMs;
          recognizer._onUp({ pointerId: 1, clientX: startX + dx, clientY: startY + dy });

          expect(gestures).toHaveLength(0);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

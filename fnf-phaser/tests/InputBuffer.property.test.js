/**
 * @fileoverview Property-based tests for the InputBuffer class.
 * Tests input buffering system using fast-check.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import InputBuffer from '../src/input/InputBuffer.js';

// Minimum iterations per property test
const NUM_RUNS = 100;

// Arbitraries for generating test data
const directionArb = fc.integer({ min: 0, max: 3 });
const timestampArb = fc.integer({ min: 0, max: 100000 });
const songPositionArb = fc.integer({ min: 0, max: 100000 });
const keyCodeArb = fc.constantFrom('KeyA', 'KeyS', 'KeyK', 'KeyL');
const bufferWindowArb = fc.integer({ min: 0, max: 100 });

// Generate a valid buffered input
const bufferedInputArb = fc.record({
  direction: directionArb,
  timestamp: timestampArb,
  keyCode: keyCodeArb,
  songPosition: songPositionArb
});

// Generate a sequence of inputs for the same direction
const inputSequenceArb = (direction) =>
  fc.array(
    fc.record({
      timestamp: timestampArb,
      keyCode: keyCodeArb,
      songPosition: songPositionArb
    }),
    { minLength: 1, maxLength: 20 }
  ).map(inputs => inputs.map(input => ({ ...input, direction })));

describe('InputBuffer Property Tests', () => {
  /**
   * Property 11: Input Buffer Window
   * For any input added at song position P with buffer window W, the input SHALL be
   * retrievable for any song position in range [P, P+W] and SHALL NOT be retrievable after P+W.
   */
  describe('Property 11: Input Buffer Window', () => {
    it('input SHALL be retrievable within buffer window [P, P+W]', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          fc.integer({ min: 0, max: 100 }), // offset within window
          (bufferWindow, direction, timestamp, keyCode, songPosition, offsetWithinWindow) => {
            // Ensure offset doesn't exceed buffer window
            const actualOffset = Math.min(offsetWithinWindow, bufferWindow);
            const buffer = new InputBuffer(bufferWindow);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Query at position within the window [P, P+W]
            const queryPosition = songPosition + actualOffset;
            const result = buffer.getBufferedInput(direction, queryPosition);

            // Input should be retrievable within the window
            expect(result).not.toBeNull();
            expect(result.direction).toBe(direction);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('input SHALL NOT be retrievable after P+W', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          fc.integer({ min: 1, max: 1000 }), // offset beyond window
          (bufferWindow, direction, timestamp, keyCode, songPosition, offsetBeyondWindow) => {
            const buffer = new InputBuffer(bufferWindow);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Query at position beyond the window (P + W + offset)
            const queryPosition = songPosition + bufferWindow + offsetBeyondWindow;
            const result = buffer.getBufferedInput(direction, queryPosition);

            // Input should NOT be retrievable after the window
            expect(result).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('input SHALL be retrievable at exact expiration boundary P+W', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          (bufferWindow, direction, timestamp, keyCode, songPosition) => {
            const buffer = new InputBuffer(bufferWindow);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Query at exact expiration time (P + W)
            const queryPosition = songPosition + bufferWindow;
            const result = buffer.getBufferedInput(direction, queryPosition);

            // Input should be retrievable at exact boundary
            expect(result).not.toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 12: Input Buffer Direction Matching
   * For any buffered input with direction D, getBufferedInput(D, position) SHALL return
   * that input if it hasn't expired, and getBufferedInput(otherDirection, position) where
   * otherDirection ≠ D SHALL NOT return it.
   */
  describe('Property 12: Input Buffer Direction Matching', () => {
    it('getBufferedInput(D, position) SHALL return input with direction D', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          (bufferWindow, direction, timestamp, keyCode, songPosition) => {
            const buffer = new InputBuffer(bufferWindow);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Query with matching direction within window
            const queryPosition = songPosition + Math.floor(bufferWindow / 2);
            const result = buffer.getBufferedInput(direction, queryPosition);

            expect(result).not.toBeNull();
            expect(result.direction).toBe(direction);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('getBufferedInput(otherDirection, position) SHALL NOT return input with direction D', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          (bufferWindow, direction, timestamp, keyCode, songPosition) => {
            const buffer = new InputBuffer(bufferWindow);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Query with different direction
            const otherDirection = (direction + 1) % 4;
            const queryPosition = songPosition + Math.floor(bufferWindow / 2);
            const result = buffer.getBufferedInput(otherDirection, queryPosition);

            // Should NOT return input for different direction
            expect(result).toBeNull();

            // Original input should still be in buffer
            expect(buffer.size).toBe(1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple directions should be independent', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          fc.array(bufferedInputArb, { minLength: 2, maxLength: 8 }),
          (bufferWindow, inputs) => {
            const buffer = new InputBuffer(bufferWindow);

            // Add all inputs
            for (const input of inputs) {
              buffer.addInput(input.direction, input.timestamp, input.keyCode, input.songPosition);
            }

            // For each unique direction, querying should only return inputs of that direction
            const directions = [...new Set(inputs.map(i => i.direction))];

            for (const dir of directions) {
              // Find first non-expired input for this direction
              const dirInputs = inputs.filter(i => i.direction === dir);
              if (dirInputs.length > 0) {
                const firstInput = dirInputs[0];
                const queryPos = firstInput.songPosition + Math.floor(bufferWindow / 2);
                const result = buffer.getBufferedInput(dir, queryPos);

                if (result !== null) {
                  expect(result.direction).toBe(dir);
                }
              }
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 13: Input Buffer Timestamp Preservation
   * For any buffered input returned by getBufferedInput(), the timestamp field SHALL
   * equal the original timestamp passed to addInput().
   */
  describe('Property 13: Input Buffer Timestamp Preservation', () => {
    it('returned input timestamp SHALL equal original timestamp', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          (bufferWindow, direction, timestamp, keyCode, songPosition) => {
            const buffer = new InputBuffer(bufferWindow);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Query within window
            const queryPosition = songPosition + Math.floor(bufferWindow / 2);
            const result = buffer.getBufferedInput(direction, queryPosition);

            expect(result).not.toBeNull();
            expect(result.timestamp).toBe(timestamp);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('timestamp preservation for multiple inputs', () => {
      fc.assert(
        fc.property(
          bufferWindowArb,
          directionArb,
          fc.array(
            fc.record({
              timestamp: timestampArb,
              keyCode: keyCodeArb
            }),
            { minLength: 1, maxLength: 10 }
          ),
          songPositionArb,
          (bufferWindow, direction, inputData, baseSongPosition) => {
            const buffer = new InputBuffer(bufferWindow);

            // Add inputs with incrementing song positions to avoid expiration
            const addedInputs = inputData.map((data, index) => {
              const songPos = baseSongPosition + index;
              buffer.addInput(direction, data.timestamp, data.keyCode, songPos);
              return { ...data, songPosition: songPos };
            });

            // Retrieve inputs and verify timestamps
            for (const added of addedInputs) {
              const queryPos = added.songPosition + Math.floor(bufferWindow / 2);
              const result = buffer.getBufferedInput(direction, queryPos);

              if (result !== null) {
                expect(result.timestamp).toBe(added.timestamp);
              }
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 14: Input Buffer FIFO Order
   * For any sequence of inputs added to the buffer for the same direction,
   * getBufferedInput() SHALL return them in the order they were added (first-in-first-out).
   */
  describe('Property 14: Input Buffer FIFO Order', () => {
    it('inputs SHALL be returned in FIFO order', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 100 }), // Use larger buffer window to avoid expiration
          directionArb,
          fc.array(timestampArb, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 10000 }),
          (bufferWindow, direction, timestamps, baseSongPosition) => {
            const buffer = new InputBuffer(bufferWindow);

            // Add inputs with incrementing song positions
            const addedTimestamps = [];
            for (let i = 0; i < timestamps.length; i++) {
              const songPos = baseSongPosition + i;
              buffer.addInput(direction, timestamps[i], 'KeyA', songPos);
              addedTimestamps.push(timestamps[i]);
            }

            // Retrieve all inputs and verify FIFO order
            const retrievedTimestamps = [];
            for (let i = 0; i < timestamps.length; i++) {
              // Query at a position where all inputs are still valid
              const queryPos = baseSongPosition + i + Math.floor(bufferWindow / 2);
              const result = buffer.getBufferedInput(direction, queryPos);

              if (result !== null) {
                retrievedTimestamps.push(result.timestamp);
              }
            }

            // Verify FIFO order - retrieved timestamps should match added order
            expect(retrievedTimestamps).toEqual(addedTimestamps.slice(0, retrievedTimestamps.length));
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('FIFO order maintained even with interleaved directions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 100 }),
          fc.array(
            fc.record({
              direction: directionArb,
              timestamp: timestampArb
            }),
            { minLength: 3, maxLength: 15 }
          ),
          fc.integer({ min: 0, max: 10000 }),
          (bufferWindow, inputs, baseSongPosition) => {
            const buffer = new InputBuffer(bufferWindow);

            // Track inputs by direction in order added
            const inputsByDirection = { 0: [], 1: [], 2: [], 3: [] };

            // Add all inputs
            for (let i = 0; i < inputs.length; i++) {
              const { direction, timestamp } = inputs[i];
              const songPos = baseSongPosition + i;
              buffer.addInput(direction, timestamp, 'KeyA', songPos);
              inputsByDirection[direction].push({ timestamp, songPos });
            }

            // For each direction, verify FIFO order
            for (let dir = 0; dir < 4; dir++) {
              const dirInputs = inputsByDirection[dir];
              const retrievedTimestamps = [];

              for (const input of dirInputs) {
                const queryPos = input.songPos + Math.floor(bufferWindow / 2);
                const result = buffer.getBufferedInput(dir, queryPos);

                if (result !== null) {
                  retrievedTimestamps.push(result.timestamp);
                }
              }

              // Verify FIFO order for this direction
              const expectedTimestamps = dirInputs.slice(0, retrievedTimestamps.length).map(i => i.timestamp);
              expect(retrievedTimestamps).toEqual(expectedTimestamps);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property 15: Input Buffer Configuration Range
   * For any buffer window value W in range [0, 100], the InputBuffer SHALL accept and
   * use that window size. Values outside this range SHALL be clamped to the nearest valid value.
   */
  describe('Property 15: Input Buffer Configuration Range', () => {
    it('buffer window in range [0, 100] SHALL be accepted as-is', () => {
      fc.assert(
        fc.property(
          bufferWindowArb, // Already constrained to [0, 100]
          (bufferWindow) => {
            const buffer = new InputBuffer(bufferWindow);
            expect(buffer.bufferWindowMs).toBe(bufferWindow);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('buffer window below 0 SHALL be clamped to 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: -1 }),
          (negativeWindow) => {
            const buffer = new InputBuffer(negativeWindow);
            expect(buffer.bufferWindowMs).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('buffer window above 100 SHALL be clamped to 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 101, max: 10000 }),
          (largeWindow) => {
            const buffer = new InputBuffer(largeWindow);
            expect(buffer.bufferWindowMs).toBe(100);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('setBufferWindow SHALL clamp values to [0, 100]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 10000 }),
          (windowValue) => {
            const buffer = new InputBuffer();
            buffer.setBufferWindow(windowValue);

            const expected = Math.max(0, Math.min(100, windowValue));
            expect(buffer.bufferWindowMs).toBe(expected);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('clamped buffer window SHALL be used for expiration calculation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 101, max: 500 }), // Values that will be clamped to 100
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          (largeWindow, direction, timestamp, keyCode, songPosition) => {
            const buffer = new InputBuffer(largeWindow);

            // Window should be clamped to 100
            expect(buffer.bufferWindowMs).toBe(100);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Input should expire at songPosition + 100 (clamped value)
            // Should be retrievable at songPosition + 100
            const resultAtBoundary = buffer.getBufferedInput(direction, songPosition + 100);
            expect(resultAtBoundary).not.toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('zero buffer window SHALL work correctly', () => {
      fc.assert(
        fc.property(
          directionArb,
          timestampArb,
          keyCodeArb,
          songPositionArb,
          (direction, timestamp, keyCode, songPosition) => {
            const buffer = new InputBuffer(0);

            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // With 0ms window, input expires at exactly songPosition
            // Should be retrievable at songPosition
            const resultAtExact = buffer.getBufferedInput(direction, songPosition);
            expect(resultAtExact).not.toBeNull();

            // Add another input to test expiration
            buffer.addInput(direction, timestamp, keyCode, songPosition);

            // Should NOT be retrievable after songPosition
            const resultAfter = buffer.getBufferedInput(direction, songPosition + 1);
            expect(resultAfter).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

/**
 * @fileoverview Property-based tests for EventBus Integration.
 * Tests event emission and handling for game feature events.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Phaser's EventEmitter before importing EventBus
vi.mock('phaser', () => {
  class MockEventEmitter {
    constructor() {
      this.listeners = new Map();
    }

    emit(event, ...args) {
      const callbacks = this.listeners.get(event) || [];
      callbacks.forEach(({ callback, context, once }) => {
        callback.apply(context, args);
        if (once) {
          this.off(event, callback, context);
        }
      });
    }

    on(event, callback, context) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push({ callback, context, once: false });
      return this;
    }

    once(event, callback, context) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push({ callback, context, once: true });
      return this;
    }

    off(event, callback, context) {
      if (!this.listeners.has(event)) return this;
      const callbacks = this.listeners.get(event);
      const index = callbacks.findIndex(
        (c) => c.callback === callback && c.context === context
      );
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
      return this;
    }

    removeAllListeners(event) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
      return this;
    }

    listenerCount(event) {
      return (this.listeners.get(event) || []).length;
    }
  }

  return {
    default: {
      Events: {
        EventEmitter: MockEventEmitter
      }
    },
    Events: {
      EventEmitter: MockEventEmitter
    }
  };
});

// Import EventBus after mocking Phaser
const { default: EventBus, Events } = await import('../src/core/EventBus.js');

// Minimum iterations per property test
const NUM_RUNS = 100;

// Arbitraries for generating test data
const songIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s) && s.length > 0);
const difficultyArb = fc.constantFrom('easy', 'normal', 'hard');
const levelIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s) && s.length > 0);
const comboArb = fc.integer({ min: 0, max: 10000 });

// Generate feature flags
const featureFlagsArb = fc.record({
  holdNotes: fc.boolean(),
  healthBar: fc.boolean(),
  characters: fc.boolean(),
  stage: fc.boolean(),
  cameraEffects: fc.boolean(),
  noteSplashes: fc.boolean(),
  comboPopups: fc.boolean(),
  expandedStats: fc.boolean(),
  replayRecording: fc.boolean(),
  inputBuffer: fc.boolean()
});

describe('EventBus Integration Property Tests', () => {
  beforeEach(() => {
    // Reset EventBus before each test
    EventBus.reset();
  });

  afterEach(() => {
    // Clean up after each test
    EventBus.reset();
  });

  /**
   * Property 42: EventBus Integration
   * All new event types (REPLAY_START, REPLAY_STOP, COMBO_BREAK, LEVEL_LOADED)
   * SHALL be emittable and receivable through the EventBus.
   */
  describe('Property 42: EventBus Integration', () => {
    it('REPLAY_START event SHALL be emittable and receivable', () => {
      fc.assert(
        fc.property(
          songIdArb,
          difficultyArb,
          (songId, difficulty) => {
            let receivedPayload = null;

            // Register listener
            EventBus.on(Events.REPLAY_START, (payload) => {
              receivedPayload = payload;
            });

            // Emit event
            EventBus.emit(Events.REPLAY_START, { songId, difficulty });

            // Verify payload received
            expect(receivedPayload).not.toBeNull();
            expect(receivedPayload.songId).toBe(songId);
            expect(receivedPayload.difficulty).toBe(difficulty);

            // Clean up
            EventBus.removeAllListeners(Events.REPLAY_START);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('REPLAY_STOP event SHALL be emittable and receivable', () => {
      fc.assert(
        fc.property(
          fc.constant(null), // REPLAY_STOP has no payload
          () => {
            let eventReceived = false;

            // Register listener
            EventBus.on(Events.REPLAY_STOP, () => {
              eventReceived = true;
            });

            // Emit event
            EventBus.emit(Events.REPLAY_STOP);

            // Verify event received
            expect(eventReceived).toBe(true);

            // Clean up
            EventBus.removeAllListeners(Events.REPLAY_STOP);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('COMBO_BREAK event SHALL be emittable and receivable', () => {
      fc.assert(
        fc.property(
          comboArb,
          (combo) => {
            let receivedPayload = null;

            // Register listener
            EventBus.on(Events.COMBO_BREAK, (payload) => {
              receivedPayload = payload;
            });

            // Emit event
            EventBus.emit(Events.COMBO_BREAK, { combo });

            // Verify payload received
            expect(receivedPayload).not.toBeNull();
            expect(receivedPayload.combo).toBe(combo);

            // Clean up
            EventBus.removeAllListeners(Events.COMBO_BREAK);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('LEVEL_LOADED event SHALL be emittable and receivable', () => {
      fc.assert(
        fc.property(
          levelIdArb,
          featureFlagsArb,
          (levelId, features) => {
            let receivedPayload = null;

            // Register listener
            EventBus.on(Events.LEVEL_LOADED, (payload) => {
              receivedPayload = payload;
            });

            // Emit event
            EventBus.emit(Events.LEVEL_LOADED, { levelId, features });

            // Verify payload received
            expect(receivedPayload).not.toBeNull();
            expect(receivedPayload.levelId).toBe(levelId);
            expect(receivedPayload.features).toEqual(features);

            // Clean up
            EventBus.removeAllListeners(Events.LEVEL_LOADED);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('multiple listeners SHALL all receive events', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          songIdArb,
          difficultyArb,
          (listenerCount, songId, difficulty) => {
            const receivedPayloads = [];

            // Register multiple listeners
            for (let i = 0; i < listenerCount; i++) {
              EventBus.on(Events.REPLAY_START, (payload) => {
                receivedPayloads.push(payload);
              });
            }

            // Emit event
            EventBus.emit(Events.REPLAY_START, { songId, difficulty });

            // Verify all listeners received the event
            expect(receivedPayloads.length).toBe(listenerCount);
            for (const payload of receivedPayloads) {
              expect(payload.songId).toBe(songId);
              expect(payload.difficulty).toBe(difficulty);
            }

            // Clean up
            EventBus.removeAllListeners(Events.REPLAY_START);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('once() listener SHALL only receive event once', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          comboArb,
          (emitCount, combo) => {
            let receiveCount = 0;

            // Register once listener
            EventBus.once(Events.COMBO_BREAK, () => {
              receiveCount++;
            });

            // Emit event multiple times
            for (let i = 0; i < emitCount; i++) {
              EventBus.emit(Events.COMBO_BREAK, { combo });
            }

            // Verify listener only received once
            expect(receiveCount).toBe(1);

            // Clean up
            EventBus.removeAllListeners(Events.COMBO_BREAK);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('off() SHALL remove specific listener', () => {
      fc.assert(
        fc.property(
          levelIdArb,
          featureFlagsArb,
          (levelId, features) => {
            let receiveCount = 0;

            const listener = () => {
              receiveCount++;
            };

            // Register listener
            EventBus.on(Events.LEVEL_LOADED, listener);

            // Emit first event
            EventBus.emit(Events.LEVEL_LOADED, { levelId, features });
            expect(receiveCount).toBe(1);

            // Remove listener
            EventBus.off(Events.LEVEL_LOADED, listener);

            // Emit second event
            EventBus.emit(Events.LEVEL_LOADED, { levelId, features });

            // Verify listener was removed
            expect(receiveCount).toBe(1);

            // Clean up
            EventBus.removeAllListeners(Events.LEVEL_LOADED);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('event types SHALL be defined correctly', () => {
      // Verify all new event types exist
      expect(Events.REPLAY_START).toBe('replayStart');
      expect(Events.REPLAY_STOP).toBe('replayStop');
      expect(Events.COMBO_BREAK).toBe('comboBreak');
      expect(Events.LEVEL_LOADED).toBe('levelLoaded');
    });

    it('listenerCount SHALL return correct count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (count) => {
            // Register listeners
            for (let i = 0; i < count; i++) {
              EventBus.on(Events.LEVEL_LOADED, () => {});
            }

            // Verify count
            expect(EventBus.listenerCount(Events.LEVEL_LOADED)).toBe(count);

            // Clean up
            EventBus.removeAllListeners(Events.LEVEL_LOADED);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('reset SHALL remove all listeners', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (count) => {
            // Register listeners for multiple events
            for (let i = 0; i < count; i++) {
              EventBus.on(Events.REPLAY_START, () => {});
              EventBus.on(Events.REPLAY_STOP, () => {});
              EventBus.on(Events.COMBO_BREAK, () => {});
              EventBus.on(Events.LEVEL_LOADED, () => {});
            }

            // Verify listeners exist
            expect(EventBus.listenerCount(Events.REPLAY_START)).toBe(count);
            expect(EventBus.listenerCount(Events.LEVEL_LOADED)).toBe(count);

            // Reset
            EventBus.reset();

            // Verify all listeners removed
            expect(EventBus.listenerCount(Events.REPLAY_START)).toBe(0);
            expect(EventBus.listenerCount(Events.REPLAY_STOP)).toBe(0);
            expect(EventBus.listenerCount(Events.COMBO_BREAK)).toBe(0);
            expect(EventBus.listenerCount(Events.LEVEL_LOADED)).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

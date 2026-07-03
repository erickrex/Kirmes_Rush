/**
 * @fileoverview Unit tests for the EventBus system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser's EventEmitter before importing EventBus
vi.mock('phaser', () => ({
  default: {
    Events: {
      EventEmitter: class MockEventEmitter {
        constructor() {
          this.listeners = new Map();
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
        emit(event, ...args) {
          const eventListeners = this.listeners.get(event) || [];
          const toRemove = [];
          eventListeners.forEach((listener, index) => {
            listener.callback.apply(listener.context, args);
            if (listener.once) {
              toRemove.push(index);
            }
          });
          // Remove once listeners
          for (let i = toRemove.length - 1; i >= 0; i--) {
            eventListeners.splice(toRemove[i], 1);
          }
          return this;
        }
        off(event, callback, context) {
          if (!this.listeners.has(event)) return this;
          const eventListeners = this.listeners.get(event);
          const index = eventListeners.findIndex(
            (l) => l.callback === callback && (!context || l.context === context)
          );
          if (index !== -1) {
            eventListeners.splice(index, 1);
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
    }
  }
}));

import EventBus, { EVENTS } from '../src/core/EventBus.js';

describe('EventBus', () => {
  beforeEach(() => {
    EventBus.reset();
  });

  describe('Event Constants', () => {
    it('should have timing events defined', () => {
      expect(EVENTS.BEAT_HIT).toBe('beatHit');
      expect(EVENTS.STEP_HIT).toBe('stepHit');
      expect(EVENTS.MEASURE_HIT).toBe('measureHit');
    });

    it('should have gameplay events defined', () => {
      expect(EVENTS.NOTE_HIT).toBe('noteHit');
      expect(EVENTS.NOTE_MISS).toBe('noteMiss');
      expect(EVENTS.COMBO_BREAK).toBe('comboBreak');
      expect(EVENTS.HEALTH_CHANGE).toBe('healthChange');
    });

    it('should have song state events defined', () => {
      expect(EVENTS.SONG_START).toBe('songStart');
      expect(EVENTS.SONG_END).toBe('songEnd');
      expect(EVENTS.COUNTDOWN_START).toBe('countdownStart');
      expect(EVENTS.COUNTDOWN_END).toBe('countdownEnd');
    });

    it('should have UI events defined', () => {
      expect(EVENTS.PAUSE).toBe('pause');
      expect(EVENTS.RESUME).toBe('resume');
      expect(EVENTS.GAME_OVER).toBe('gameOver');
    });
  });

  describe('emit/on', () => {
    it('should emit events to listeners', () => {
      const callback = vi.fn();
      EventBus.on(EVENTS.BEAT_HIT, callback);
      EventBus.emit(EVENTS.BEAT_HIT, { beat: 1 });
      expect(callback).toHaveBeenCalledWith({ beat: 1 });
    });

    it('should support multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      EventBus.on(EVENTS.NOTE_HIT, callback1);
      EventBus.on(EVENTS.NOTE_HIT, callback2);
      EventBus.emit(EVENTS.NOTE_HIT, { score: 500 });
      expect(callback1).toHaveBeenCalledWith({ score: 500 });
      expect(callback2).toHaveBeenCalledWith({ score: 500 });
    });

    it('should pass multiple arguments', () => {
      const callback = vi.fn();
      EventBus.on('testEvent', callback);
      EventBus.emit('testEvent', 'arg1', 'arg2', 'arg3');
      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });

  describe('once', () => {
    it('should only fire once', () => {
      const callback = vi.fn();
      EventBus.once(EVENTS.SONG_START, callback);
      EventBus.emit(EVENTS.SONG_START);
      EventBus.emit(EVENTS.SONG_START);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('should remove a specific listener', () => {
      const callback = vi.fn();
      EventBus.on(EVENTS.PAUSE, callback);
      EventBus.off(EVENTS.PAUSE, callback);
      EventBus.emit(EVENTS.PAUSE);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      EventBus.on(EVENTS.NOTE_HIT, callback1);
      EventBus.on(EVENTS.NOTE_MISS, callback2);
      EventBus.removeAllListeners(EVENTS.NOTE_HIT);
      EventBus.emit(EVENTS.NOTE_HIT);
      EventBus.emit(EVENTS.NOTE_MISS);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should remove all listeners', () => {
      const callback = vi.fn();
      EventBus.on(EVENTS.BEAT_HIT, callback);
      EventBus.reset();
      EventBus.emit(EVENTS.BEAT_HIT);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return the number of listeners', () => {
      expect(EventBus.listenerCount(EVENTS.BEAT_HIT)).toBe(0);
      EventBus.on(EVENTS.BEAT_HIT, () => {});
      expect(EventBus.listenerCount(EVENTS.BEAT_HIT)).toBe(1);
      EventBus.on(EVENTS.BEAT_HIT, () => {});
      expect(EventBus.listenerCount(EVENTS.BEAT_HIT)).toBe(2);
    });
  });

  describe('emitter getter', () => {
    it('should return the underlying emitter', () => {
      expect(EventBus.emitter).toBeDefined();
    });
  });
});

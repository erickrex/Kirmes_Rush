/**
 * @fileoverview Tests for PreciseInput - Timestamped input queue
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

// Mock performance.now
vi.stubGlobal('performance', {
  now: vi.fn(() => 1000)
});

// Mock document and window for DOM events
const eventListeners = {
  keydown: [],
  keyup: [],
  blur: []
};

vi.stubGlobal('document', {
  addEventListener: vi.fn((event, handler) => {
    eventListeners[event] = eventListeners[event] || [];
    eventListeners[event].push(handler);
  }),
  removeEventListener: vi.fn((event, handler) => {
    eventListeners[event] = (eventListeners[event] || []).filter((h) => h !== handler);
  }),
  dispatchEvent: vi.fn((event) => {
    const handlers = eventListeners[event.type] || [];
    handlers.forEach((h) => h(event));
  })
});

vi.stubGlobal('window', {
  addEventListener: vi.fn((event, handler) => {
    eventListeners[event] = eventListeners[event] || [];
    eventListeners[event].push(handler);
  }),
  removeEventListener: vi.fn((event, handler) => {
    eventListeners[event] = (eventListeners[event] || []).filter((h) => h !== handler);
  }),
  dispatchEvent: vi.fn((event) => {
    const handlers = eventListeners[event.type] || [];
    handlers.forEach((h) => h(event));
  })
});

// Mock KeyboardEvent
class MockKeyboardEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.code = options.code || '';
    this.repeat = options.repeat || false;
  }
}
vi.stubGlobal('KeyboardEvent', MockKeyboardEvent);

// Mock Event
class MockEvent {
  constructor(type) {
    this.type = type;
  }
}
vi.stubGlobal('Event', MockEvent);

import { PreciseInput, Controls } from '../src/input/InputSystem.js';

describe('PreciseInput', () => {
  let input;
  let mockControls;

  beforeEach(() => {
    // Clear event listeners
    eventListeners.keydown = [];
    eventListeners.keyup = [];
    eventListeners.blur = [];

    mockControls = new Controls();
    input = new PreciseInput(null, mockControls);
  });

  afterEach(() => {
    if (input) {
      input.destroy();
    }
  });

  describe('constructor', () => {
    it('should initialize with empty queues', () => {
      expect(input.pressQueue).toEqual([]);
      expect(input.releaseQueue).toEqual([]);
    });

    it('should initialize with no held keys', () => {
      expect(input.heldKeys.size).toBe(0);
      expect(input.heldDirections).toEqual([false, false, false, false]);
    });

    it('should be enabled by default', () => {
      expect(input.enabled).toBe(true);
    });

    it('should create default controls if not provided', () => {
      const inputWithDefaults = new PreciseInput();
      expect(inputWithDefaults.controls).toBeInstanceOf(Controls);
      inputWithDefaults.destroy();
    });
  });

  describe('keydown handling', () => {
    it('should add press event to queue on keydown', () => {
      const event = new MockKeyboardEvent('keydown', { code: 'ArrowLeft' });
      document.dispatchEvent(event);

      expect(input.pressQueue.length).toBe(1);
      expect(input.pressQueue[0].direction).toBe(0); // LEFT
      expect(input.pressQueue[0].keyCode).toBe('ArrowLeft');
    });

    it('should mark direction as held', () => {
      const event = new MockKeyboardEvent('keydown', { code: 'ArrowLeft' });
      document.dispatchEvent(event);

      expect(input.heldDirections[0]).toBe(true);
      expect(input.heldKeys.has('ArrowLeft')).toBe(true);
    });

    it('should ignore repeated keydown events', () => {
      const event1 = new MockKeyboardEvent('keydown', { code: 'ArrowLeft' });
      document.dispatchEvent(event1);

      // Simulate repeat
      const event2 = new MockKeyboardEvent('keydown', { code: 'ArrowLeft', repeat: true });
      document.dispatchEvent(event2);

      expect(input.pressQueue.length).toBe(1);
    });

    it('should ignore non-note keys', () => {
      const event = new MockKeyboardEvent('keydown', { code: 'KeyZ' });
      document.dispatchEvent(event);

      expect(input.pressQueue.length).toBe(0);
    });

    it('should not add events when disabled', () => {
      input.disable();
      const event = new MockKeyboardEvent('keydown', { code: 'ArrowLeft' });
      document.dispatchEvent(event);

      expect(input.pressQueue.length).toBe(0);
    });

    it('should handle multiple directions', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowDown' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowUp' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowRight' }));

      expect(input.pressQueue.length).toBe(4);
      expect(input.heldDirections).toEqual([true, true, true, true]);
    });
  });

  describe('keyup handling', () => {
    it('should add release event to queue on keyup', () => {
      // First press the key
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      input.consumePresses(); // Clear press queue

      // Then release
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));

      expect(input.releaseQueue.length).toBe(1);
      expect(input.releaseQueue[0].direction).toBe(0);
    });

    it('should mark direction as released', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));

      expect(input.heldDirections[0]).toBe(false);
      expect(input.heldKeys.has('ArrowLeft')).toBe(false);
    });

    it('should keep direction held if another key for same direction is held', () => {
      // Press both keys for left
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'KeyA' }));

      // Release one
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));

      // Direction should still be held
      expect(input.heldDirections[0]).toBe(true);
    });
  });

  describe('consumePresses', () => {
    it('should return all press events', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowDown' }));

      const presses = input.consumePresses();
      expect(presses.length).toBe(2);
    });

    it('should clear the press queue', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      input.consumePresses();

      expect(input.pressQueue.length).toBe(0);
    });

    it('should return empty array if no presses', () => {
      const presses = input.consumePresses();
      expect(presses).toEqual([]);
    });
  });

  describe('consumeReleases', () => {
    it('should return all release events', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));

      const releases = input.consumeReleases();
      expect(releases.length).toBe(1);
    });

    it('should clear the release queue', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));
      input.consumeReleases();

      expect(input.releaseQueue.length).toBe(0);
    });
  });

  describe('clearQueues', () => {
    it('should clear both queues', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));

      input.clearQueues();

      expect(input.pressQueue.length).toBe(0);
      expect(input.releaseQueue.length).toBe(0);
    });
  });

  describe('pendingPresses/pendingReleases', () => {
    it('should return count of pending presses', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowDown' }));

      expect(input.pendingPresses).toBe(2);
    });

    it('should return count of pending releases', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));

      expect(input.pendingReleases).toBe(1);
    });
  });

  describe('isHeld', () => {
    it('should return true for held direction', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      expect(input.isHeld(0)).toBe(true);
    });

    it('should return false for not held direction', () => {
      expect(input.isHeld(0)).toBe(false);
    });

    it('should return false for invalid direction', () => {
      expect(input.isHeld(99)).toBe(false);
    });
  });

  describe('isAnyHeld', () => {
    it('should return true if any direction is held', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      expect(input.isAnyHeld()).toBe(true);
    });

    it('should return false if no direction is held', () => {
      expect(input.isAnyHeld()).toBe(false);
    });
  });

  describe('getHeldDirections', () => {
    it('should return array of held directions', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowUp' }));

      const held = input.getHeldDirections();
      expect(held).toContain(0);
      expect(held).toContain(2);
      expect(held.length).toBe(2);
    });

    it('should return empty array if nothing held', () => {
      expect(input.getHeldDirections()).toEqual([]);
    });
  });

  describe('releaseAllKeys', () => {
    it('should release all held keys', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowDown' }));

      input.releaseAllKeys();

      expect(input.heldDirections).toEqual([false, false, false, false]);
      expect(input.heldKeys.size).toBe(0);
    });

    it('should add release events for held directions', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowDown' }));
      input.consumeReleases(); // Clear any existing

      input.releaseAllKeys();

      expect(input.releaseQueue.length).toBe(2);
    });
  });

  describe('enable/disable', () => {
    it('should enable input', () => {
      input.disable();
      input.enable();
      expect(input.enabled).toBe(true);
    });

    it('should disable input and clear queues', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));
      input.disable();

      expect(input.enabled).toBe(false);
      expect(input.pressQueue.length).toBe(0);
    });

    it('should set enabled state', () => {
      input.setEnabled(false);
      expect(input.enabled).toBe(false);

      input.setEnabled(true);
      expect(input.enabled).toBe(true);
    });
  });

  describe('blur handling', () => {
    it('should release all keys on window blur', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));

      window.dispatchEvent(new MockEvent('blur'));

      expect(input.heldDirections[0]).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clean up state', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));

      input.destroy();

      expect(input.pressQueue.length).toBe(0);
      expect(input.releaseQueue.length).toBe(0);
      expect(input.heldKeys.size).toBe(0);
      expect(input.scene).toBeNull();
      expect(input.controls).toBeNull();
    });

    it('should remove event listeners', () => {
      input.destroy();

      expect(document.removeEventListener).toHaveBeenCalled();
      expect(window.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('timestamp accuracy', () => {
    it('should include timestamp in press events', () => {
      performance.now = vi.fn(() => 12345.678);

      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));

      expect(input.pressQueue[0].timestamp).toBe(12345.678);
    });

    it('should include timestamp in release events', () => {
      document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));

      performance.now = vi.fn(() => 12400.0);
      document.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'ArrowLeft' }));

      expect(input.releaseQueue[0].timestamp).toBe(12400.0);
    });
  });

  describe('input buffer integration', () => {
    describe('enableBuffer', () => {
      it('should create InputBuffer when enabled', () => {
        input.enableBuffer();
        expect(input.inputBuffer).not.toBeNull();
        expect(input.bufferEnabled).toBe(true);
      });

      it('should use default buffer window of 50ms', () => {
        input.enableBuffer();
        expect(input.inputBuffer.bufferWindowMs).toBe(50);
      });

      it('should use custom buffer window when provided', () => {
        input.enableBuffer(75);
        expect(input.inputBuffer.bufferWindowMs).toBe(75);
      });

      it('should update buffer window if already enabled', () => {
        input.enableBuffer(50);
        input.enableBuffer(80);
        expect(input.inputBuffer.bufferWindowMs).toBe(80);
      });
    });

    describe('disableBuffer', () => {
      it('should disable buffer integration', () => {
        input.enableBuffer();
        input.disableBuffer();
        expect(input.bufferEnabled).toBe(false);
      });

      it('should clear buffer when disabled', () => {
        input.enableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);
        input.disableBuffer();
        expect(input.inputBuffer.size).toBe(0);
      });

      it('should not throw if buffer was never enabled', () => {
        expect(() => input.disableBuffer()).not.toThrow();
      });
    });

    describe('isBufferEnabled', () => {
      it('should return false by default', () => {
        expect(input.isBufferEnabled()).toBe(false);
      });

      it('should return true when buffer is enabled', () => {
        input.enableBuffer();
        expect(input.isBufferEnabled()).toBe(true);
      });

      it('should return false after buffer is disabled', () => {
        input.enableBuffer();
        input.disableBuffer();
        expect(input.isBufferEnabled()).toBe(false);
      });
    });

    describe('setBufferWindow', () => {
      it('should update buffer window when buffer exists', () => {
        input.enableBuffer(50);
        input.setBufferWindow(100);
        expect(input.inputBuffer.bufferWindowMs).toBe(100);
      });

      it('should not throw if buffer does not exist', () => {
        expect(() => input.setBufferWindow(100)).not.toThrow();
      });
    });

    describe('getBufferWindow', () => {
      it('should return 0 if buffer not enabled', () => {
        expect(input.getBufferWindow()).toBe(0);
      });

      it('should return buffer window when enabled', () => {
        input.enableBuffer(75);
        expect(input.getBufferWindow()).toBe(75);
      });
    });

    describe('bufferInput', () => {
      it('should add input to buffer when enabled', () => {
        input.enableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);
        expect(input.inputBuffer.size).toBe(1);
      });

      it('should not add input when buffer disabled', () => {
        input.enableBuffer();
        input.disableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);
        expect(input.inputBuffer.size).toBe(0);
      });

      it('should not throw if buffer never enabled', () => {
        expect(() => input.bufferInput(0, 1000, 'ArrowLeft', 1000)).not.toThrow();
      });
    });

    describe('getBufferedInput', () => {
      it('should return buffered input when available', () => {
        input.enableBuffer(50);
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);

        const buffered = input.getBufferedInput(0, 1025);
        expect(buffered).not.toBeNull();
        expect(buffered.direction).toBe(0);
        expect(buffered.timestamp).toBe(1000);
        expect(buffered.keyCode).toBe('ArrowLeft');
      });

      it('should return null when no matching input', () => {
        input.enableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);

        const buffered = input.getBufferedInput(1, 1025); // Different direction
        expect(buffered).toBeNull();
      });

      it('should return null when buffer disabled', () => {
        input.enableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);
        input.disableBuffer();

        const buffered = input.getBufferedInput(0, 1025);
        expect(buffered).toBeNull();
      });

      it('should return null if buffer never enabled', () => {
        const buffered = input.getBufferedInput(0, 1000);
        expect(buffered).toBeNull();
      });

      it('should return null for expired inputs', () => {
        input.enableBuffer(50);
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);

        const buffered = input.getBufferedInput(0, 1100); // Past expiration
        expect(buffered).toBeNull();
      });

      it('should remove input from buffer after retrieval', () => {
        input.enableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);

        input.getBufferedInput(0, 1025);
        expect(input.inputBuffer.size).toBe(0);
      });
    });

    describe('clearExpiredBufferedInputs', () => {
      it('should clear expired inputs', () => {
        input.enableBuffer(50);
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);
        input.bufferInput(1, 1100, 'ArrowDown', 1100);

        input.clearExpiredBufferedInputs(1075); // First input expired

        expect(input.inputBuffer.size).toBe(1);
      });

      it('should not throw if buffer not enabled', () => {
        expect(() => input.clearExpiredBufferedInputs(1000)).not.toThrow();
      });
    });

    describe('clearBuffer', () => {
      it('should clear all buffered inputs', () => {
        input.enableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);
        input.bufferInput(1, 1100, 'ArrowDown', 1100);

        input.clearBuffer();
        expect(input.inputBuffer.size).toBe(0);
      });

      it('should not throw if buffer not enabled', () => {
        expect(() => input.clearBuffer()).not.toThrow();
      });
    });

    describe('getInputBuffer', () => {
      it('should return null if buffer not enabled', () => {
        expect(input.getInputBuffer()).toBeNull();
      });

      it('should return InputBuffer instance when enabled', () => {
        input.enableBuffer();
        const buffer = input.getInputBuffer();
        expect(buffer).not.toBeNull();
        expect(buffer).toBe(input.inputBuffer);
      });
    });

    describe('destroy with buffer', () => {
      it('should clean up buffer on destroy', () => {
        input.enableBuffer();
        input.bufferInput(0, 1000, 'ArrowLeft', 1000);

        input.destroy();

        expect(input.inputBuffer).toBeNull();
        expect(input.bufferEnabled).toBe(false);
      });
    });

    describe('backward compatibility', () => {
      it('should work normally without buffer enabled', () => {
        // Simulate normal gameplay without buffer
        document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));

        const presses = input.consumePresses();
        expect(presses.length).toBe(1);
        expect(presses[0].direction).toBe(0);

        // Buffer methods should not interfere
        expect(input.isBufferEnabled()).toBe(false);
        expect(input.getBufferedInput(0, 1000)).toBeNull();
      });

      it('should maintain existing functionality when buffer is enabled', () => {
        input.enableBuffer();

        // Normal input handling should still work
        document.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowLeft' }));

        expect(input.pressQueue.length).toBe(1);
        expect(input.heldDirections[0]).toBe(true);

        const presses = input.consumePresses();
        expect(presses.length).toBe(1);
      });
    });
  });
});

/**
 * @fileoverview Unit tests for the InputBuffer class.
 * Tests input buffering system for rhythm game accuracy.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputBuffer } from '../src/input/InputSystem.js';

describe('InputBuffer', () => {
  let buffer;

  beforeEach(() => {
    buffer = new InputBuffer();
  });

  describe('constructor', () => {
    it('should create buffer with default 50ms window', () => {
      expect(buffer.bufferWindowMs).toBe(50);
    });

    it('should accept custom buffer window', () => {
      const customBuffer = new InputBuffer(75);
      expect(customBuffer.bufferWindowMs).toBe(75);
    });

    it('should clamp buffer window to minimum 0ms', () => {
      const clampedBuffer = new InputBuffer(-10);
      expect(clampedBuffer.bufferWindowMs).toBe(0);
    });

    it('should clamp buffer window to maximum 100ms', () => {
      const clampedBuffer = new InputBuffer(150);
      expect(clampedBuffer.bufferWindowMs).toBe(100);
    });

    it('should start with empty buffer', () => {
      expect(buffer.size).toBe(0);
      expect(buffer.buffer).toEqual([]);
    });
  });

  describe('addInput', () => {
    it('should add input to buffer', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      expect(buffer.size).toBe(1);
    });

    it('should store correct direction', () => {
      buffer.addInput(2, 1000, 'KeyK', 1000);
      expect(buffer.buffer[0].direction).toBe(2);
    });

    it('should store original timestamp', () => {
      buffer.addInput(0, 1234, 'KeyA', 1000);
      expect(buffer.buffer[0].timestamp).toBe(1234);
    });

    it('should store keyCode', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      expect(buffer.buffer[0].keyCode).toBe('KeyA');
    });

    it('should calculate correct expiration time', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      expect(buffer.buffer[0].expiresAt).toBe(1050); // 1000 + 50ms default
    });

    it('should add multiple inputs', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      buffer.addInput(1, 1010, 'KeyS', 1010);
      buffer.addInput(2, 1020, 'KeyK', 1020);
      expect(buffer.size).toBe(3);
    });
  });

  describe('getBufferedInput', () => {
    it('should return null when buffer is empty', () => {
      const result = buffer.getBufferedInput(0, 1000);
      expect(result).toBeNull();
    });

    it('should return matching input by direction', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      const result = buffer.getBufferedInput(0, 1025);
      expect(result).not.toBeNull();
      expect(result.direction).toBe(0);
    });

    it('should not return input with different direction', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      const result = buffer.getBufferedInput(1, 1025);
      expect(result).toBeNull();
    });

    it('should remove returned input from buffer', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      expect(buffer.size).toBe(1);
      buffer.getBufferedInput(0, 1025);
      expect(buffer.size).toBe(0);
    });

    it('should not return expired input', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      // Input expires at 1050, check at 1060
      const result = buffer.getBufferedInput(0, 1060);
      expect(result).toBeNull();
    });

    it('should return input at exact expiration time', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      // Input expires at 1050, check at exactly 1050
      const result = buffer.getBufferedInput(0, 1050);
      expect(result).not.toBeNull();
    });

    it('should preserve original timestamp in returned input', () => {
      buffer.addInput(0, 1234, 'KeyA', 1000);
      const result = buffer.getBufferedInput(0, 1025);
      expect(result.timestamp).toBe(1234);
    });

    it('should return inputs in FIFO order', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      buffer.addInput(0, 1010, 'KeyA', 1010);
      buffer.addInput(0, 1020, 'KeyA', 1020);

      const first = buffer.getBufferedInput(0, 1025);
      expect(first.timestamp).toBe(1000);

      const second = buffer.getBufferedInput(0, 1035);
      expect(second.timestamp).toBe(1010);

      const third = buffer.getBufferedInput(0, 1045);
      expect(third.timestamp).toBe(1020);
    });

    it('should skip expired inputs and return first valid match', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000); // expires at 1050
      buffer.addInput(0, 1010, 'KeyA', 1010); // expires at 1060
      buffer.addInput(0, 1020, 'KeyA', 1020); // expires at 1070

      // At position 1055, first input is expired
      const result = buffer.getBufferedInput(0, 1055);
      expect(result.timestamp).toBe(1010);
    });
  });

  describe('clearExpired', () => {
    it('should remove expired inputs', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000); // expires at 1050
      buffer.addInput(1, 1010, 'KeyS', 1010); // expires at 1060
      buffer.addInput(2, 1020, 'KeyK', 1020); // expires at 1070

      buffer.clearExpired(1055);
      expect(buffer.size).toBe(2);
    });

    it('should keep non-expired inputs', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000); // expires at 1050
      buffer.addInput(1, 1010, 'KeyS', 1010); // expires at 1060

      buffer.clearExpired(1055);
      expect(buffer.buffer[0].direction).toBe(1);
    });

    it('should keep input at exact expiration time', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000); // expires at 1050
      buffer.clearExpired(1050);
      expect(buffer.size).toBe(1);
    });

    it('should remove all inputs when all expired', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      buffer.addInput(1, 1010, 'KeyS', 1010);
      buffer.clearExpired(2000);
      expect(buffer.size).toBe(0);
    });

    it('should do nothing on empty buffer', () => {
      buffer.clearExpired(1000);
      expect(buffer.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all inputs', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      buffer.addInput(1, 1010, 'KeyS', 1010);
      buffer.addInput(2, 1020, 'KeyK', 1020);

      buffer.clear();
      expect(buffer.size).toBe(0);
    });

    it('should work on empty buffer', () => {
      buffer.clear();
      expect(buffer.size).toBe(0);
    });
  });

  describe('setBufferWindow', () => {
    it('should update buffer window', () => {
      buffer.setBufferWindow(75);
      expect(buffer.bufferWindowMs).toBe(75);
    });

    it('should clamp to minimum 0ms', () => {
      buffer.setBufferWindow(-50);
      expect(buffer.bufferWindowMs).toBe(0);
    });

    it('should clamp to maximum 100ms', () => {
      buffer.setBufferWindow(200);
      expect(buffer.bufferWindowMs).toBe(100);
    });

    it('should affect new inputs', () => {
      buffer.setBufferWindow(100);
      buffer.addInput(0, 1000, 'KeyA', 1000);
      expect(buffer.buffer[0].expiresAt).toBe(1100);
    });
  });

  describe('size getter', () => {
    it('should return 0 for empty buffer', () => {
      expect(buffer.size).toBe(0);
    });

    it('should return correct count', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      buffer.addInput(1, 1010, 'KeyS', 1010);
      expect(buffer.size).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero buffer window', () => {
      const zeroBuffer = new InputBuffer(0);
      zeroBuffer.addInput(0, 1000, 'KeyA', 1000);
      // With 0ms window, input expires immediately at songPosition
      const result = zeroBuffer.getBufferedInput(0, 1000);
      expect(result).not.toBeNull();
    });

    it('should handle maximum buffer window', () => {
      const maxBuffer = new InputBuffer(100);
      maxBuffer.addInput(0, 1000, 'KeyA', 1000);
      // Input should be valid for 100ms
      const result = maxBuffer.getBufferedInput(0, 1099);
      expect(result).not.toBeNull();
    });

    it('should handle all four directions', () => {
      buffer.addInput(0, 1000, 'KeyA', 1000);
      buffer.addInput(1, 1000, 'KeyS', 1000);
      buffer.addInput(2, 1000, 'KeyK', 1000);
      buffer.addInput(3, 1000, 'KeyL', 1000);

      expect(buffer.getBufferedInput(0, 1025).direction).toBe(0);
      expect(buffer.getBufferedInput(1, 1025).direction).toBe(1);
      expect(buffer.getBufferedInput(2, 1025).direction).toBe(2);
      expect(buffer.getBufferedInput(3, 1025).direction).toBe(3);
    });

    it('should handle rapid inputs for same direction', () => {
      // Simulate rapid key presses
      for (let i = 0; i < 10; i++) {
        buffer.addInput(0, 1000 + i, 'KeyA', 1000 + i);
      }
      expect(buffer.size).toBe(10);

      // Should return in FIFO order
      for (let i = 0; i < 10; i++) {
        const result = buffer.getBufferedInput(0, 1025 + i);
        expect(result.timestamp).toBe(1000 + i);
      }
    });
  });
});

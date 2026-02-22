/**
 * @fileoverview InputBuffer - Input buffering system for rhythm game accuracy
 * Buffers inputs for a configurable window to allow slightly early presses to hit notes.
 *
 * Part of the competitive features implementation.
 */

/**
 * @typedef {Object} BufferedInput
 * @property {number} direction - Direction (0-3)
 * @property {number} timestamp - Original input timestamp
 * @property {number} expiresAt - When this buffer expires (song position)
 * @property {string} keyCode - Key code
 */

/**
 * Input buffer that holds inputs for a configurable window.
 * Allows slightly early inputs to still register as hits when notes enter the hit window.
 */
class InputBuffer {
  /**
   * Buffer window in milliseconds
   * @type {number}
   */
  bufferWindowMs = 50;

  /**
   * Buffered inputs awaiting matching notes
   * @type {BufferedInput[]}
   */
  buffer = [];

  /**
   * Create input buffer with configurable window
   * @param {number} [bufferWindowMs=50] - Buffer window in ms (0-100, clamped)
   */
  constructor(bufferWindowMs = 50) {
    // Clamp to valid range [0, 100]
    this.bufferWindowMs = Math.max(0, Math.min(100, bufferWindowMs));
  }

  /**
   * Add an input to the buffer
   * @param {number} direction - Direction (0-3)
   * @param {number} timestamp - Input timestamp
   * @param {string} keyCode - Key code
   * @param {number} songPosition - Current song position in ms
   */
  addInput(direction, timestamp, keyCode, songPosition) {
    const bufferedInput = {
      direction,
      timestamp,
      keyCode,
      expiresAt: songPosition + this.bufferWindowMs
    };
    this.buffer.push(bufferedInput);
  }

  /**
   * Check for buffered input matching a note direction
   * Returns and removes the first matching input (FIFO order)
   * @param {number} direction - Note direction to match
   * @param {number} songPosition - Current song position in ms
   * @returns {BufferedInput | null} Matching input or null if none found
   */
  getBufferedInput(direction, songPosition) {
    // Find first non-expired input matching the direction
    for (let i = 0; i < this.buffer.length; i++) {
      const input = this.buffer[i];

      // Skip expired inputs
      if (input.expiresAt < songPosition) {
        continue;
      }

      // Check direction match
      if (input.direction === direction) {
        // Remove and return this input (FIFO)
        this.buffer.splice(i, 1);
        return input;
      }
    }

    return null;
  }

  /**
   * Remove expired inputs from the buffer
   * @param {number} songPosition - Current song position in ms
   */
  clearExpired(songPosition) {
    this.buffer = this.buffer.filter((input) => input.expiresAt >= songPosition);
  }

  /**
   * Clear all buffered inputs
   */
  clear() {
    this.buffer = [];
  }

  /**
   * Get the current buffer size
   * @returns {number}
   */
  get size() {
    return this.buffer.length;
  }

  /**
   * Set the buffer window (clamped to valid range)
   * @param {number} windowMs - New buffer window in ms
   */
  setBufferWindow(windowMs) {
    this.bufferWindowMs = Math.max(0, Math.min(100, windowMs));
  }
}

export default InputBuffer;

/**
 * @fileoverview EventBus - Global event dispatcher for Friday Night Funkin'
 * A singleton event bus for game-wide communication using Phaser's EventEmitter.
 *
 * Provides a centralized way for different game systems to communicate
 * without tight coupling.
 */

import Phaser from '../phaser.js';

/**
 * Event type constants for type-safe event handling.
 * @readonly
 * @enum {string}
 */
export const Events = {
  // ========================================
  // TIMING EVENTS
  // ========================================

  /** Fired when a beat is hit. Payload: { beat: number } */
  BEAT_HIT: 'beatHit',

  /** Fired when a step is hit. Payload: { step: number } */
  STEP_HIT: 'stepHit',

  /** Fired when a measure is hit. Payload: { measure: number } */
  MEASURE_HIT: 'measureHit',

  // ========================================
  // GAMEPLAY EVENTS
  // ========================================

  /** Fired when a note is hit. Payload: { note, judgement, score, timing } */
  NOTE_HIT: 'noteHit',

  /** Fired when opponent hits a note. Payload: { note } */
  OPPONENT_NOTE_HIT: 'opponentNoteHit',

  /** Fired when a note is missed. Payload: { note } */
  NOTE_MISS: 'noteMiss',

  /** Fired when combo is broken. Payload: { combo: number } */
  COMBO_BREAK: 'comboBreak',

  /** Fired when health changes. Payload: { health, delta, source } */
  HEALTH_CHANGE: 'healthChange',

  /** Fired when score changes. Payload: { score, delta } */
  SCORE_CHANGE: 'scoreChange',

  // ========================================
  // SONG STATE EVENTS
  // ========================================

  /** Fired when a song starts playing. Payload: { songId, difficulty } */
  SONG_START: 'songStart',

  /** Fired when a song ends. Payload: { songId, tallies, rank } */
  SONG_END: 'songEnd',

  /** Fired when countdown begins. Payload: { count: number } */
  COUNTDOWN_START: 'countdownStart',

  /** Fired on each countdown step. Payload: { step: number, name: string } */
  COUNTDOWN_STEP: 'countdownStep',

  /** Fired on each countdown tick. Payload: { count: number } */
  COUNTDOWN_TICK: 'countdownTick',

  /** Fired when countdown ends and song begins. Payload: none */
  COUNTDOWN_END: 'countdownEnd',

  // ========================================
  // UI EVENTS
  // ========================================

  /** Fired when game is paused. Payload: none */
  PAUSE: 'pause',

  /** Fired when game is resumed. Payload: none */
  RESUME: 'resume',

  /** Fired when game over state is triggered. Payload: none */
  GAME_OVER: 'gameOver',

  /** Fired when player retries after game over. Payload: none */
  RETRY: 'retry',

  // ========================================
  // CAMERA EVENTS
  // ========================================

  /** Fired to focus camera on a character. Payload: { target: string } */
  FOCUS_CAMERA: 'focusCamera',

  /** Fired to zoom camera. Payload: { zoom: number, duration: number } */
  ZOOM_CAMERA: 'zoomCamera',

  /** Fired to flash camera. Payload: { color: number, duration: number } */
  FLASH_CAMERA: 'flashCamera',

  // ========================================
  // LOADING EVENTS
  // ========================================

  /** Fired when loading completes. Payload: { success: boolean, failedFiles: string[] } */
  LOADING_COMPLETE: 'loadingComplete',

  /** Fired when loading progress updates. Payload: { progress: number } */
  LOADING_PROGRESS: 'loadingProgress',

  // ========================================
  // REPLAY EVENTS
  // ========================================

  /** Fired when replay playback starts. Payload: { songId, difficulty } */
  REPLAY_START: 'replayStart',

  /** Fired when replay playback stops. Payload: none */
  REPLAY_STOP: 'replayStop',

  // ========================================
  // LEVEL EVENTS
  // ========================================

  /** Fired when a level is loaded. Payload: { levelId, features } */
  LEVEL_LOADED: 'levelLoaded'
};

/**
 * Global event bus singleton for game-wide communication.
 * Uses Phaser's EventEmitter under the hood.
 */
class EventBus {
  /**
   * The underlying Phaser EventEmitter instance.
   * @type {Phaser.Events.EventEmitter}
   * @private
   */
  static _emitter = new Phaser.Events.EventEmitter();

  /**
   * Emit an event with optional arguments.
   * @param {string} event - The event name (use EVENTS constants)
   * @param {...*} args - Arguments to pass to listeners
   */
  static emit(event, ...args) {
    this._emitter.emit(event, ...args);
  }

  /**
   * Register a listener for an event.
   * @param {string} event - The event name (use EVENTS constants)
   * @param {Function} callback - The callback function
   * @param {*} [context] - The context to bind the callback to
   * @returns {Phaser.Events.EventEmitter} The emitter for chaining
   */
  static on(event, callback, context) {
    return this._emitter.on(event, callback, context);
  }

  /**
   * Register a one-time listener for an event.
   * @param {string} event - The event name (use EVENTS constants)
   * @param {Function} callback - The callback function
   * @param {*} [context] - The context to bind the callback to
   * @returns {Phaser.Events.EventEmitter} The emitter for chaining
   */
  static once(event, callback, context) {
    return this._emitter.once(event, callback, context);
  }

  /**
   * Remove a listener for an event.
   * @param {string} event - The event name (use EVENTS constants)
   * @param {Function} [callback] - The callback function to remove
   * @param {*} [context] - The context the callback was bound to
   * @returns {Phaser.Events.EventEmitter} The emitter for chaining
   */
  static off(event, callback, context) {
    return this._emitter.off(event, callback, context);
  }

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   * @param {string} [event] - The event name to clear listeners for
   * @returns {Phaser.Events.EventEmitter} The emitter for chaining
   */
  static removeAllListeners(event) {
    return this._emitter.removeAllListeners(event);
  }

  /**
   * Get the number of listeners for an event.
   * @param {string} event - The event name
   * @returns {number} The number of listeners
   */
  static listenerCount(event) {
    return this._emitter.listenerCount(event);
  }

  /**
   * Get the underlying Phaser EventEmitter instance.
   * Useful for advanced use cases.
   * @returns {Phaser.Events.EventEmitter}
   */
  static get emitter() {
    return this._emitter;
  }

  /**
   * Reset the event bus by removing all listeners.
   * Useful when transitioning between major game states.
   */
  static reset() {
    this._emitter.removeAllListeners();
  }
}

export default EventBus;

// Also export as EVENTS for backwards compatibility
export { Events as EVENTS };

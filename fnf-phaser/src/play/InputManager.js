/**
 * @fileoverview InputManager - Handles input queue processing, note input,
 * and note release handling during gameplay.
 * Extracted from PlayState to provide a focused module for input management.
 *
 * Delegates note hit/miss to NoteProcessor via context.
 *
 * @module InputManager
 */

import * as Constants from '../core/Constants.js';
import SaveManager from '../data/SaveManager.js';

/**
 * @typedef {Object} InputManagerPlayState
 * @property {number} songPosition - Current song position in ms
 * @property {boolean} [replayMode] - Whether replay playback is active
 * @property {{ consumePresses: () => Array<{ direction: number, timestamp: number, keyCode?: string }>, consumeReleases: () => Array<{ direction: number, timestamp: number }> } | null} [preciseInput] - PreciseInput instance
 * @property {Array<{ direction: number, timestamp: number, keyCode?: string }>} inputPressQueue - Queued press inputs
 * @property {Array<{ direction: number, timestamp: number, keyCode?: string }>} inputReleaseQueue - Queued release inputs
 * @property {{ pressKey: (dir: number) => void, releaseKey: (dir: number) => void, playStatic: (dir: number) => void, getClosestNote: (dir: number, songPos: number) => any } | null} playerStrumline - Player strumline
 * @property {{ addInput: (direction: number, timestamp: number, keyCode: string, songPosition: number) => void, getBufferedInput: (direction: number, songPosition: number) => { direction: number, timestamp: number, keyCode: string, expiresAt: number } | null, clearExpired: (songPosition: number) => void, bufferWindowMs?: number } | null} [inputBuffer] - Early input buffer
 * @property {boolean} [inputBufferEnabled] - Whether input buffering is enabled
 * @property {{ start: (songId: string, difficulty: string) => void, stop: (score: number, tallies: any) => any, isRecording: () => boolean, recordInput: (type: string, direction: number, keyCode: string, songPosition: number) => void, discard: () => void } | null} [replayRecorder] - Replay recorder
 */

/**
 * @typedef {Object} InputManagerNoteProcessor
 * @property {(note: any, timing: number) => void} hitNote - Hit a note
 * @property {(direction: number, applyPenalty?: boolean) => void} ghostMiss - Ghost miss
 */

/**
 * @typedef {Object} InputManagerContext
 * @property {Phaser.Scene} scene - Phaser scene reference
 * @property {InputManagerPlayState} playState - PlayState instance (for strumlines, input queues, etc.)
 * @property {Object} conductor - Conductor instance
 * @property {Object} eventBus - EventBus static class
 * @property {Object} scoring - Scoring static class
 * @property {Object} gameplayState - GameplayState module instance
 * @property {InputManagerNoteProcessor} noteProcessor - NoteProcessor module instance
 */

/**
 * Create an InputManager module that handles input queue processing and note input.
 * @param {InputManagerContext} context - Shared context object
 * @returns {{ processInputQueue: () => void, handleNoteInput: (direction: number, timestamp: number, keyCode?: string) => void, handleNoteRelease: (direction: number, timestamp: number) => void, processBufferedInputs: () => void, destroy: () => void }} InputManager module instance
 */
export function createInputManager(context) {
  let destroyed = false;

  /**
   * Convert the input event timestamp into the corresponding song position.
   * Live keyboard/touch timestamps use performance.now(); replay timestamps are
   * already recorded in song-position milliseconds.
   * @param {number} timestamp
   * @returns {number}
   */
  function resolveInputSongPosition(timestamp) {
    const { playState } = context;
    const currentSongPosition = playState.songPosition;

    if (!Number.isFinite(timestamp)) {
      return currentSongPosition;
    }

    if (playState.replayMode) {
      return timestamp;
    }

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : NaN;
    const inputAge = now - timestamp;

    // Ignore synthetic test values or stale/future timestamps that do not come
    // from the current performance.now() clock.
    if (!Number.isFinite(inputAge) || inputAge < 0 || inputAge > 1000) {
      return currentSongPosition;
    }

    return Math.max(0, currentSongPosition - inputAge);
  }

  /**
   * Apply the saved input delay compensation to a song-position value.
   * @param {number} songPosition
   * @returns {number}
   */
  function applyInputDelayCompensation(songPosition) {
    const saveManager = SaveManager.getInstance();
    if (!saveManager || !saveManager.loaded) {
      return songPosition;
    }

    return songPosition + saveManager.getInputDelayCompensation();
  }

  /**
   * @param {any} note
   * @param {number} effectiveSongPosition
   * @returns {number}
   */
  function getTiming(note, effectiveSongPosition) {
    return note.strumTime - effectiveSongPosition;
  }

  /**
   * @param {number} direction
   * @param {number} inputSongPosition
   * @returns {boolean}
   */
  function shouldBufferEarlyInput(direction, inputSongPosition) {
    const { playState } = context;
    if (!playState.inputBufferEnabled || !playState.inputBuffer || !playState.playerStrumline) {
      return false;
    }

    const note = playState.playerStrumline.getClosestNote(direction, inputSongPosition);
    if (!note) {
      return false;
    }

    const earlyBy = note.strumTime - inputSongPosition;
    const bufferWindow = playState.inputBuffer.bufferWindowMs ?? 0;
    return earlyBy > Constants.HIT_WINDOW_MS && earlyBy <= Constants.HIT_WINDOW_MS + bufferWindow;
  }

  const manager = {
    /**
     * Process queued inputs from PreciseInput.
     * Consumes press and release queues, delegating each to handleNoteInput/handleNoteRelease.
     */
    processInputQueue() {
      const { playState } = context;

      // Get inputs from PreciseInput if available
      if (playState.preciseInput) {
        const presses = playState.preciseInput.consumePresses();
        const releases = playState.preciseInput.consumeReleases();

        playState.inputPressQueue.push(...presses);
        playState.inputReleaseQueue.push(...releases);
      }

      // Process presses
      while (playState.inputPressQueue.length > 0) {
        const input = playState.inputPressQueue.shift();
        if (input) {
          manager.handleNoteInput(input.direction, input.timestamp, input.keyCode);
        }
      }

      // Process releases
      while (playState.inputReleaseQueue.length > 0) {
        const input = playState.inputReleaseQueue.shift();
        if (input) {
          manager.handleNoteRelease(input.direction, input.timestamp);
        }
      }

      manager.processBufferedInputs();
    },

    /**
     * Handle a note press input for a given direction.
     * Finds the closest note in the hit window and delegates hit/miss to NoteProcessor.
     * @param {number} direction - The direction of the input
     * @param {number} timestamp - The timestamp of the input
     * @param {string} [keyCode] - Key code that produced the input
     */
    handleNoteInput(direction, timestamp, keyCode = `Key${direction}`) {
      const { playState, noteProcessor } = context;
      if (!playState.playerStrumline) {
        return;
      }

      // Record input for replay if recording
      if (playState.replayRecorder && playState.replayRecorder.isRecording()) {
        playState.replayRecorder.recordInput('press', direction, keyCode, playState.songPosition);
      }

      // Mark key as held
      playState.playerStrumline.pressKey(direction);

      const inputSongPosition = resolveInputSongPosition(timestamp);
      const effectiveSongPosition = applyInputDelayCompensation(inputSongPosition);

      // Find closest note in hit window
      const note = playState.playerStrumline.getClosestNote(direction, effectiveSongPosition);

      if (note) {
        // Calculate timing using adjusted song position
        const timing = getTiming(note, effectiveSongPosition);
        const absTiming = Math.abs(timing);

        if (absTiming <= Constants.HIT_WINDOW_MS) {
          noteProcessor.hitNote(note, timing);
          return;
        }
      }

      if (shouldBufferEarlyInput(direction, effectiveSongPosition)) {
        playState.inputBuffer?.addInput(direction, timestamp, keyCode, effectiveSongPosition);
        return;
      }

      // Ghost tap (no note to hit)
      const ghostTapping = SaveManager.getInstance().getOption('ghostTapping');
      if (ghostTapping === false) {
        // Ghost tapping disabled — apply miss penalty
        noteProcessor.ghostMiss(direction, true);
      } else {
        // Ghost tapping enabled (default) — press animation only
        noteProcessor.ghostMiss(direction);
      }
    },

    /**
     * Handle a note release input for a given direction.
     * @param {number} direction - The direction of the input
     * @param {number} _timestamp - The timestamp of the input
     */
    handleNoteRelease(direction, _timestamp) {
      const { playState } = context;
      if (!playState.playerStrumline) {
        return;
      }

      // Record input for replay if recording
      if (playState.replayRecorder && playState.replayRecorder.isRecording()) {
        playState.replayRecorder.recordInput(
          'release',
          direction,
          `Key${direction}`,
          playState.songPosition
        );
      }

      // Mark key as released
      playState.playerStrumline.releaseKey(direction);
      playState.playerStrumline.playStatic(direction);
    },

    /**
     * Consume buffered early inputs once their target note enters the hit window.
     */
    processBufferedInputs() {
      const { playState, noteProcessor } = context;
      if (
        playState.replayMode ||
        !playState.inputBufferEnabled ||
        !playState.inputBuffer ||
        !playState.playerStrumline
      ) {
        return;
      }

      playState.inputBuffer.clearExpired(playState.songPosition);

      for (let direction = 0; direction < 4; direction++) {
        const note = playState.playerStrumline.getClosestNote(direction, playState.songPosition);
        if (!note) {
          continue;
        }

        const timing = getTiming(note, playState.songPosition);
        if (Math.abs(timing) > Constants.HIT_WINDOW_MS) {
          continue;
        }

        const buffered = playState.inputBuffer.getBufferedInput(direction, playState.songPosition);
        if (buffered) {
          noteProcessor.hitNote(note, timing);
        }
      }
    },

    /**
     * Clean up resources. Idempotent — subsequent calls are no-ops.
     */
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
    }
  };

  return manager;
}

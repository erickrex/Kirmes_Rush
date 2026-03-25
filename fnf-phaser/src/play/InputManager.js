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
 * @typedef {Object} InputManagerContext
 * @property {Phaser.Scene} scene - Phaser scene reference
 * @property {Object} playState - PlayState instance (for strumlines, input queues, etc.)
 * @property {Object} conductor - Conductor instance
 * @property {Object} eventBus - EventBus static class
 * @property {Object} scoring - Scoring static class
 * @property {Object} gameplayState - GameplayState module instance
 * @property {Object} noteProcessor - NoteProcessor module instance
 */

/**
 * Create an InputManager module that handles input queue processing and note input.
 * @param {InputManagerContext} context - Shared context object
 * @returns {Object} InputManager module instance
 */
export function createInputManager(context) {
  let destroyed = false;

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
        manager.handleNoteInput(input.direction, input.timestamp);
      }

      // Process releases
      while (playState.inputReleaseQueue.length > 0) {
        const input = playState.inputReleaseQueue.shift();
        manager.handleNoteRelease(input.direction, input.timestamp);
      }
    },

    /**
     * Handle a note press input for a given direction.
     * Finds the closest note in the hit window and delegates hit/miss to NoteProcessor.
     * @param {number} direction - The direction of the input
     * @param {number} timestamp - The timestamp of the input
     */
    handleNoteInput(direction, timestamp) {
      const { playState, noteProcessor } = context;
      if (!playState.playerStrumline) {
        return;
      }

      // Record input for replay if recording
      if (playState.replayRecorder && playState.replayRecorder.isRecording()) {
        playState.replayRecorder.recordInput(
          'press',
          direction,
          `Key${direction}`,
          playState.songPosition
        );
      }

      // Mark key as held
      playState.playerStrumline.pressKey(direction);

      // Find closest note in hit window
      const note = playState.playerStrumline.getClosestNote(direction, playState.songPosition);

      if (note) {
        // Apply input delay compensation to the effective song position
        let effectiveSongPosition = playState.songPosition;
        const saveManager = SaveManager.getInstance();
        if (saveManager && saveManager.loaded) {
          const compensation = saveManager.getInputDelayCompensation();
          effectiveSongPosition = playState.songPosition + compensation;
        }

        // Calculate timing using adjusted song position
        const timing = note.strumTime - effectiveSongPosition;
        const absTiming = Math.abs(timing);

        if (absTiming <= Constants.HIT_WINDOW_MS) {
          noteProcessor.hitNote(note, timing);
          return;
        }
      }

      // Ghost tap (no note to hit)
      noteProcessor.ghostMiss(direction);
    },

    /**
     * Handle a note release input for a given direction.
     * @param {number} direction - The direction of the input
     * @param {number} timestamp - The timestamp of the input
     */
    handleNoteRelease(direction, timestamp) {
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

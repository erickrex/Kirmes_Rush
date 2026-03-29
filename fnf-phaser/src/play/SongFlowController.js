/**
 * @fileoverview SongFlowController - Manages countdown sequencing, song start/end, and game-over.
 * Extracted from PlayState to provide a focused module for song flow control.
 *
 * Uses EventBus for decoupled communication with other modules.
 *
 * @module SongFlowController
 */

import { Events } from '../core/EventBus.js';
import Scoring from './Scoring.js';
import SaveManager from '../data/SaveManager.js';
import { InputBuffer } from '../input/InputSystem.js';

/**
 * @typedef {import('../types.js').Tallies} SFCTallies
 */

/**
 * @typedef {Object} SongFlowPlayState
 * @property {boolean} countdownActive - Whether countdown is active
 * @property {number} countdownStep - Current countdown step
 * @property {boolean} songStarted - Whether the song has started
 * @property {boolean} replayMode - Whether in replay mode
 * @property {boolean} replayRecordingEnabled - Whether replay recording is enabled
 * @property {boolean} inputBufferEnabled - Whether input buffer is enabled
 * @property {number} score - Current score
 * @property {SFCTallies} tallies - Score tallies
 * @property {string} difficulty - Current difficulty
 * @property {number} startTimestamp - Start timestamp
 * @property {{ id?: string, name?: string } | null} [songData] - Song data
 * @property {{ start: (songId: string, difficulty: string) => void, stop: (score: number, tallies: SFCTallies) => any, isRecording: () => boolean, discard: () => void } | null} [replayRecorder] - Replay recorder
 * @property {{ play: (startTimestamp: number) => void, stop: () => void } | null} [audioManager] - Audio manager
 * @property {{ setBufferWindow: (window: number) => void } | null} [inputBuffer] - Input buffer
 * @property {{ getStats: () => any } | null} [inputStatistics] - Input statistics
 * @property {(featureName: string) => boolean} [isFeatureEnabled] - Feature flag check
 * @property {() => void} [startReplayPlayback] - Start replay playback
 * @property {() => void} [stopReplayPlayback] - Stop replay playback
 * @property {((step: number, name: string) => void) | null} [onCountdownStep] - Countdown step callback
 * @property {((score: number, tallies: SFCTallies, rank: string | null, replayData: any, timingStats: any) => void) | null} [onSongEnd] - Song end callback
 */

/**
 * @typedef {Object} SongFlowConductor
 * @property {number} songPosition - Current song position in ms
 * @property {number} currentStep - Current step
 * @property {number} currentBeat - Current beat
 * @property {number} currentMeasure - Current measure
 * @property {number} currentStepTime - Current step time
 * @property {number} currentBeatTime - Current beat time
 * @property {number} currentMeasureTime - Current measure time
 * @property {number} beatLengthMs - Beat length in ms
 */

/**
 * @typedef {Object} SongFlowEventBus
 * @property {(event: string, ...args: any[]) => void} emit - Emit an event
 */

/**
 * @typedef {Object} SongFlowControllerContext
 * @property {Phaser.Scene} scene - Phaser scene reference
 * @property {SongFlowPlayState} playState - PlayState instance (for strumlines, characters, callbacks, replay, etc.)
 * @property {SongFlowConductor} conductor - Conductor instance
 * @property {SongFlowEventBus} eventBus - EventBus static class
 * @property {Object} scoring - Scoring static class
 * @property {Object} gameplayState - GameplayState module instance
 */

/**
 * Create a SongFlowController module that manages countdown, song start/end, and game-over.
 * @param {SongFlowControllerContext} context - Shared context object
 * @returns {{ startCountdown: () => void, scheduleCountdownStep: (step: number) => void, executeCountdownStep: (step: number) => void, startSong: () => void, endSong: () => void, gameOver: () => void, destroy: () => void }} SongFlowController module instance
 */
export function createSongFlowController(context) {
  const { eventBus } = context;
  let destroyed = false;

  const controller = {
    /**
     * Start the countdown sequence.
     * Resets the conductor and schedules all countdown steps.
     */
    startCountdown() {
      const { playState, conductor } = context;
      playState.countdownActive = true;
      playState.countdownStep = 0;

      // Reset conductor state for countdown
      conductor.songPosition = 0;
      conductor.currentStep = 0;
      conductor.currentBeat = 0;
      conductor.currentMeasure = 0;
      conductor.currentStepTime = 0;
      conductor.currentBeatTime = 0;
      conductor.currentMeasureTime = 0;
      conductor.songPosition = -conductor.beatLengthMs * 4;

      // Emit countdown start
      eventBus.emit(Events.COUNTDOWN_START);

      // Schedule countdown steps
      controller.scheduleCountdownStep(0); // 3
      controller.scheduleCountdownStep(1); // 2
      controller.scheduleCountdownStep(2); // 1
      controller.scheduleCountdownStep(3); // GO
      controller.scheduleCountdownStep(4); // Start song
    },

    /**
     * Schedule a countdown step with a delayed call.
     * @param {number} step - Step number (0-4)
     */
    scheduleCountdownStep(step) {
      const { conductor, scene } = context;
      const delay = conductor.beatLengthMs * step;

      if (scene?.time) {
        scene.time.delayedCall(delay, () => {
          controller.executeCountdownStep(step);
        });
      }
    },

    /**
     * Execute a countdown step. Steps 0-3 are visual/audio countdown,
     * step 4 triggers song start.
     * @param {number} step - Step number (0-4)
     */
    executeCountdownStep(step) {
      const { playState } = context;
      playState.countdownStep = step;

      if (step < 4) {
        // Countdown steps 0-3 (3, 2, 1, GO)
        const countdownNames = ['three', 'two', 'one', 'go'];
        const name = countdownNames[step];

        // Callback for visual/audio
        if (playState.onCountdownStep) {
          playState.onCountdownStep(step, name);
        }

        // Emit event
        eventBus.emit(Events.COUNTDOWN_STEP, { step, name });
      } else {
        // Step 4 - Start the song
        playState.countdownActive = false;
        controller.startSong();
      }
    },

    /**
     * Start the song. Sets up replay, input buffer, and audio playback.
     */
    startSong() {
      const { playState, conductor } = context;
      playState.songStarted = true;
      conductor.songPosition = 0;

      // Start replay playback if in replay mode
      if (playState.replayMode && playState.startReplayPlayback) {
        playState.startReplayPlayback();
      }
      // Start replay recording if enabled (not in replay mode) and feature is enabled
      else if (
        playState.replayRecordingEnabled &&
        playState.replayRecorder &&
        playState.isFeatureEnabled &&
        playState.isFeatureEnabled('replayRecording')
      ) {
        const songId = /** @type {string} */ (
          playState.songData?.id || playState.songData?.name || 'unknown'
        );
        playState.replayRecorder.start(songId, playState.difficulty);
      }

      // Initialize input buffer if enabled and feature is enabled
      if (
        playState.inputBufferEnabled &&
        playState.isFeatureEnabled &&
        playState.isFeatureEnabled('inputBuffer')
      ) {
        const saveManager = SaveManager.getInstance();
        const bufferWindow = saveManager?.loaded
          ? (saveManager.getOption('inputBufferWindow') ?? 50)
          : 50;
        if (!playState.inputBuffer) {
          playState.inputBuffer = new InputBuffer(bufferWindow);
        } else {
          playState.inputBuffer.setBufferWindow(bufferWindow);
        }
      }

      // Start audio
      if (playState.audioManager) {
        playState.audioManager.play(playState.startTimestamp);
      }

      // Emit event
      eventBus.emit(Events.SONG_START);
    },

    /**
     * End the song. Stops audio, captures replay data, calculates rank, and emits SONG_END.
     */
    endSong() {
      const { playState } = context;
      playState.songStarted = false;

      // Capture replay mode state before stopping
      const wasReplayMode = playState.replayMode;

      // Stop audio
      if (playState.audioManager) {
        playState.audioManager.stop();
      }

      // Stop replay playback if in replay mode
      if (playState.replayMode && playState.stopReplayPlayback) {
        playState.stopReplayPlayback();
      }

      // Stop replay recording and get replay data
      let replayData = null;
      if (playState.replayRecorder && playState.replayRecorder.isRecording()) {
        replayData = playState.replayRecorder.stop(playState.score, playState.tallies);
      }

      // Calculate final rank
      const rank = Scoring.calculateRank(playState.tallies);

      // Get timing stats from InputStatistics if available
      const timingStats = playState.inputStatistics?.getStats() ?? null;

      // Emit event
      eventBus.emit(Events.SONG_END, {
        score: playState.score,
        tallies: playState.tallies,
        rank,
        replayData,
        isReplay: wasReplayMode,
        timingStats
      });

      // Callback
      if (playState.onSongEnd) {
        playState.onSongEnd(playState.score, playState.tallies, rank, replayData, timingStats);
      }
    },

    /**
     * Trigger game over. Stops replay/audio and emits GAME_OVER event.
     */
    gameOver() {
      const { playState } = context;
      playState.songStarted = false;

      // Stop replay playback if in replay mode
      if (playState.replayMode && playState.stopReplayPlayback) {
        playState.stopReplayPlayback();
      }

      // Discard replay recording on early exit
      if (playState.replayRecorder && playState.replayRecorder.isRecording()) {
        playState.replayRecorder.discard();
      }

      // Stop audio
      if (playState.audioManager) {
        playState.audioManager.stop();
      }

      // Emit event
      eventBus.emit(Events.GAME_OVER, {
        score: playState.score,
        tallies: playState.tallies
      });
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

  return controller;
}

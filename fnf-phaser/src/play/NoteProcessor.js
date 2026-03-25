/**
 * @fileoverview NoteProcessor - Handles note hit detection, miss checking,
 * opponent note processing, and ghost miss handling.
 * Extracted from PlayState to provide a focused module for note processing.
 *
 * Communicates with GameplayState via EventBus for score/health/combo updates.
 *
 * @module NoteProcessor
 */

import * as Constants from '../core/Constants.js';
import { Events } from '../core/EventBus.js';

/**
 * @typedef {Object} NoteProcessorContext
 * @property {Phaser.Scene} scene - Phaser scene reference
 * @property {Object} playState - PlayState instance (for strumlines, characters, etc.)
 * @property {Object} conductor - Conductor instance
 * @property {Object} eventBus - EventBus static class
 * @property {Object} scoring - Scoring static class
 * @property {Object} gameplayState - GameplayState module instance
 */

/**
 * Create a NoteProcessor module that handles note hit/miss logic.
 * @param {NoteProcessorContext} context - Shared context object
 * @returns {Object} NoteProcessor module instance
 */
export function createNoteProcessor(context) {
  const { eventBus, scoring } = context;
  let destroyed = false;

  /**
   * Handle a note hit event from EventBus.
   * Updates GameplayState score, combo, tallies, and health.
   * @param {Object} data - Event data with judgement, score
   */
  function onNoteHitEvent(data) {
    const gs = context.gameplayState;
    if (!gs) {
      return;
    }

    gs.updateScore(data.score);
    gs.updateCombo(data.judgement);
    gs.updateTallies(data.judgement, data.score);
    const healthBonus = gs.getHealthBonus(data.judgement);
    gs.updateHealth(healthBonus);
  }

  /**
   * Handle a note miss event from EventBus.
   * Updates GameplayState combo, tallies, and health.
   */
  function onNoteMissEvent() {
    const gs = context.gameplayState;
    if (!gs) {
      return;
    }

    gs.combo = 0;
    gs.tallies.missed++;
    gs.updateHealth(Constants.HEALTH_MISS_PENALTY);
  }

  // Register EventBus listeners for GameplayState communication
  eventBus.on(Events.NOTE_HIT, onNoteHitEvent);
  eventBus.on(Events.NOTE_MISS, onNoteMissEvent);

  const processor = {
    /**
     * Check for missed notes past the hit window.
     * Iterates player strumline notes and calls missNote for any that are overdue.
     */
    checkMissedNotes() {
      const { playState } = context;
      if (!playState.playerStrumline) {
        return;
      }

      const missThreshold = playState.songPosition - Constants.HIT_WINDOW_MS;

      for (const note of playState.playerStrumline.notes) {
        if (!note || !note.alive) {
          continue;
        }
        if (note.hasBeenHit || note.hasMissed) {
          continue;
        }

        if (note.strumTime < missThreshold) {
          processor.missNote(note);
        }
      }
    },

    /**
     * Process opponent notes (auto-hit).
     * Called during update to handle opponent strumline.
     */
    processOpponentNotes() {
      const { playState } = context;
      if (!playState.opponentStrumline) {
        return;
      }

      for (const note of playState.opponentStrumline.notes) {
        if (!note || !note.alive) {
          continue;
        }
        if (note.hasBeenHit) {
          continue;
        }

        if (note.strumTime <= playState.songPosition) {
          processor.opponentHitNote(note);
        }
      }
    },

    /**
     * Hit a note with the given timing.
     * @param {Object} note - The note sprite
     * @param {number} timing - Timing offset in ms
     */
    hitNote(note, timing) {
      const { playState } = context;
      const judgement = scoring.judgeNote(timing);
      const noteScore = scoring.scoreNote(timing);
      const healthEnabled = playState.isFeatureEnabled
        ? playState.isFeatureEnabled('healthBar')
        : true;

      // Update gameplay state via PlayState (preserving existing behavior)
      playState.score += noteScore;

      const breaksCombo = scoring.doesJudgementBreakCombo(judgement);
      if (breaksCombo) {
        playState.combo = 0;
      } else {
        playState.combo++;
        playState.maxCombo = Math.max(playState.maxCombo, playState.combo);
      }

      // Update tallies
      const tallyKey = judgement === 'killer' ? 'sick' : judgement;
      if (playState.tallies[tallyKey] !== undefined) {
        playState.tallies[tallyKey]++;
      }
      playState.tallies.totalNotesHit++;
      playState.tallies.combo = playState.combo;
      playState.tallies.maxCombo = playState.maxCombo;

      // Update health
      if (healthEnabled) {
        const healthBonus = playState.getHealthBonus
          ? playState.getHealthBonus(judgement)
          : scoring.getHealthBonus(judgement);
        playState.health = Math.max(
          Constants.HEALTH_MIN,
          Math.min(Constants.HEALTH_MAX, playState.health + healthBonus)
        );
      }

      // Hit the note on strumline
      playState.playerStrumline.hitNote(note);

      // Trigger player sing animation
      if (playState.player) {
        playState.player.sing(note.direction);
      }

      // Unmute player vocals on hit
      if (playState.voices) {
        playState.voices.unmutePlayer();
      }

      // Emit event
      eventBus.emit(Events.NOTE_HIT, {
        note,
        judgement,
        score: noteScore,
        timing,
        combo: playState.combo
      });

      // Callback
      if (playState.onNoteHit) {
        playState.onNoteHit(note, judgement, noteScore, timing);
      }
    },

    /**
     * Miss a note.
     * @param {Object} note - The note sprite
     */
    missNote(note) {
      const { playState } = context;
      const healthEnabled = playState.isFeatureEnabled
        ? playState.isFeatureEnabled('healthBar')
        : true;

      // Mark as missed
      note.hasMissed = true;
      note.handledMiss = true;

      // Reset combo
      playState.combo = 0;

      // Update tallies
      playState.tallies.missed++;

      // Update health
      if (healthEnabled) {
        playState.health = Math.max(
          Constants.HEALTH_MIN,
          playState.health + Constants.HEALTH_MISS_PENALTY
        );
      }

      // Trigger player miss animation
      if (playState.player) {
        playState.player.miss(note.direction);
      }

      // Mute player vocals
      if (playState.voices) {
        playState.voices.mutePlayer();
      }

      // Emit event
      eventBus.emit(Events.NOTE_MISS, { note });

      // Callback
      if (playState.onNoteMiss) {
        playState.onNoteMiss(note);
      }

      // Check for game over
      if (healthEnabled && playState.health <= Constants.HEALTH_MIN) {
        playState.gameOver();
      }
    },

    /**
     * Ghost miss (pressed key with no note).
     * @param {number} direction - Direction
     */
    ghostMiss(direction) {
      const { playState } = context;
      // Only play press animation
      playState.playerStrumline?.playPress(direction);
    },

    /**
     * Opponent hits a note.
     * @param {Object} note - The note sprite
     */
    opponentHitNote(note) {
      const { playState, scene } = context;

      // Mark as hit
      note.hasBeenHit = true;

      // Trigger opponent sing animation
      if (playState.opponent) {
        playState.opponent.sing(note.direction);
      }

      // Hit the note on strumline (visual feedback)
      playState.opponentStrumline.hitNote(note);

      // Reset receptor back to static after a brief flash
      if (scene?.time) {
        scene.time.delayedCall(150, () => {
          if (playState.opponentStrumline) {
            playState.opponentStrumline.playStatic(note.direction);
          }
        });
      }

      // Emit event
      eventBus.emit(Events.OPPONENT_NOTE_HIT, { note });
    },

    /**
     * Clean up EventBus listeners. Idempotent — subsequent calls are no-ops.
     */
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;

      eventBus.off(Events.NOTE_HIT, onNoteHitEvent);
      eventBus.off(Events.NOTE_MISS, onNoteMissEvent);
    }
  };

  return processor;
}

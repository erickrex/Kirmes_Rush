/**
 * @fileoverview NoteProcessor - Handles note hit detection, miss checking,
 * opponent note processing, and ghost miss handling.
 * Extracted from PlayState to provide a focused module for note processing.
 *
 * Updates gameplay state synchronously and exclusively through the GameplayState_Module
 * (the single source of truth for score/combo/tallies/health).
 *
 * @module NoteProcessor
 */

import * as Constants from '../core/Constants.js';
import { Events } from '../core/EventBus.js';
import SaveManager from '../data/SaveManager.js';

/**
 * @typedef {import('../types.js').Tallies} Tallies
 */

/**
 * @typedef {Object} NoteProcessorPlayState
 * @property {number} songPosition - Current song position in ms
 * @property {number} score - Current score
 * @property {number} combo - Current combo
 * @property {number} maxCombo - Maximum combo achieved
 * @property {number} health - Current health
 * @property {Tallies} tallies - Score tallies
 * @property {{ notes: Array<any>, hitNote: (note: any) => void, playPress: (dir: number) => void, playStatic: (dir: number) => void } | null} playerStrumline - Player strumline
 * @property {{ notes: Array<any>, hitNote: (note: any) => void, playStatic: (dir: number) => void } | null} opponentStrumline - Opponent strumline
 * @property {{ flash: (dir: number) => void } | null} [opponentIndicator] - Opponent indicator
 * @property {{ sing: (dir: number) => void, miss: (dir: number) => void } | null} [player] - Player character
 * @property {{ sing: (dir: number) => void } | null} [opponent] - Opponent character
 * @property {{ mutePlayer: () => void, unmutePlayer: () => void } | null} [voices] - Voices group
 * @property {{ playHitsound: () => void } | null} [audioManager] - Audio manager
 * @property {((note: any, judgement: string, score: number, timing: number) => void) | null} [onNoteHit] - Note hit callback
 * @property {((note: any) => void) | null} [onNoteMiss] - Note miss callback
 * @property {((featureName: string) => boolean) | undefined} [isFeatureEnabled] - Feature flag check
 * @property {((judgement: string) => number) | undefined} [getHealthBonus] - Health bonus getter
 * @property {() => void} [gameOver] - Game over trigger
 */

/**
 * @typedef {Object} NoteProcessorScoring
 * @property {(timing: number) => string} judgeNote - Judge a note hit
 * @property {(timing: number) => number} scoreNote - Score a note hit
 * @property {(judgement: string) => boolean} doesJudgementBreakCombo - Check if judgement breaks combo
 * @property {(judgement: string) => number} getHealthBonus - Get health bonus for judgement
 */

/**
 * @typedef {Object} NoteProcessorEventBus
 * @property {(event: string, ...args: any[]) => void} emit - Emit an event
 * @property {(event: string, callback: Function, context?: any) => any} on - Register listener
 * @property {(event: string, callback: Function, context?: any) => any} off - Remove listener
 */

/**
 * @typedef {Object} NoteProcessorGameplayState
 * @property {number} health - Current health
 * @property {number} combo - Current combo
 * @property {Tallies} tallies - Score tallies
 * @property {(points: number) => void} updateScore - Update score
 * @property {(judgement: string) => void} updateCombo - Update combo
 * @property {(judgement: string, score: number) => void} updateTallies - Update tallies
 * @property {(delta: number) => void} updateHealth - Update health
 * @property {(judgement: string) => number} getHealthBonus - Get health bonus
 */

/**
 * @typedef {Object} NoteProcessorContext
 * @property {Phaser.Scene} scene - Phaser scene reference
 * @property {NoteProcessorPlayState} playState - PlayState instance (for strumlines, characters, etc.)
 * @property {Object} conductor - Conductor instance
 * @property {NoteProcessorEventBus} eventBus - EventBus static class
 * @property {NoteProcessorScoring} scoring - Scoring static class
 * @property {NoteProcessorGameplayState | null} gameplayState - GameplayState module instance
 */

/**
 * @typedef {Object} NoteProcessorNote
 * @property {boolean} alive - Whether the note is active
 * @property {boolean} hasBeenHit - Whether the note has been hit
 * @property {boolean} hasMissed - Whether the note has been missed
 * @property {boolean} [handledMiss] - Whether the miss has been handled
 * @property {number} strumTime - Time the note should be hit
 * @property {number} direction - Note direction (0-3)
 */

/**
 * Create a NoteProcessor module that handles note hit/miss logic.
 * @param {NoteProcessorContext} context - Shared context object
 * @returns {{ checkMissedNotes: () => void, processOpponentNotes: () => void, hitNote: (note: NoteProcessorNote, timing: number) => void, missNote: (note: NoteProcessorNote) => void, ghostMiss: (direction: number) => void, opponentHitNote: (note: NoteProcessorNote) => void, destroy: () => void }} NoteProcessor module instance
 */
export function createNoteProcessor(context) {
  const { eventBus, scoring } = context;
  let destroyed = false;

  /**
   * Resolve the absolute screen position of a player receptor for a direction.
   * Used to position visual feedback (e.g. note splashes) at the hit receptor.
   * @param {number} direction - Note direction (0-3)
   * @returns {{ x: number, y: number } | null} The receptor position, or null if unavailable
   */
  function resolveReceptor(direction) {
    const strum = /** @type {any} */ (context.playState.playerStrumline);
    if (!strum || typeof strum.getByDirection !== 'function') {
      return null;
    }
    const receptor = strum.getByDirection(direction);
    if (!receptor) {
      return null;
    }
    return {
      x: (strum.x ?? 0) + (receptor.x ?? 0),
      y: (strum.y ?? 0) + (receptor.y ?? 0)
    };
  }

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
     * @param {NoteProcessorNote} note - The note sprite
     * @param {number} timing - Timing offset in ms
     */
    hitNote(note, timing) {
      const { playState } = context;
      const gs = context.gameplayState;
      const noteOffset = SaveManager.getInstance().getOption('noteOffset') ?? 0;
      const adjustedTiming = timing + noteOffset;
      const judgement = scoring.judgeNote(adjustedTiming);
      const noteScore = scoring.scoreNote(adjustedTiming);
      const healthEnabled = playState.isFeatureEnabled
        ? playState.isFeatureEnabled('healthBar')
        : true;

      // Update gameplay state exclusively through the single owner (GameplayState_Module).
      // updateCombo applies the canonical combo-break decision (Scoring.doesJudgementBreakCombo)
      // and must run before updateTallies, which snapshots the current combo/maxCombo.
      if (gs) {
        gs.updateScore(noteScore);
        gs.updateCombo(judgement);
        gs.updateTallies(judgement, noteScore);
        if (healthEnabled) {
          const healthBonus = playState.getHealthBonus
            ? playState.getHealthBonus(judgement)
            : gs.getHealthBonus(judgement);
          gs.updateHealth(healthBonus);
        }
      }

      const combo = gs ? gs.combo : 0;

      // Play hitsound on sick/killer judgement when hitsounds enabled
      const hitsoundsEnabled = SaveManager.getInstance().getOption('hitsounds');
      if (hitsoundsEnabled && (judgement === 'sick' || judgement === 'killer')) {
        playState.audioManager?.playHitsound();
      }

      // Hit the note on strumline
      if (playState.playerStrumline) {
        playState.playerStrumline.hitNote(note);
      }

      // Trigger player sing animation
      if (playState.player) {
        playState.player.sing(note.direction);
      }

      // Unmute player vocals on hit
      if (playState.voices) {
        playState.voices.unmutePlayer();
      }

      // Emit event (payload carries direction + receptor for visual feedback)
      eventBus.emit(Events.NOTE_HIT, {
        note,
        judgement,
        score: noteScore,
        timing,
        combo,
        direction: note.direction,
        receptor: resolveReceptor(note.direction)
      });

      // Callback
      if (playState.onNoteHit) {
        playState.onNoteHit(note, judgement, noteScore, timing);
      }
    },

    /**
     * Miss a note.
     * @param {NoteProcessorNote} note - The note sprite
     */
    missNote(note) {
      const { playState } = context;
      const gs = context.gameplayState;
      const healthEnabled = playState.isFeatureEnabled
        ? playState.isFeatureEnabled('healthBar')
        : true;

      // Mark as missed
      note.hasMissed = true;
      note.handledMiss = true;

      // Update gameplay state exclusively through the single owner (GameplayState_Module).
      // updateCombo('miss') applies the canonical combo-break decision.
      if (gs) {
        gs.updateCombo('miss');
        gs.tallies.missed++;
        if (healthEnabled) {
          gs.updateHealth(Constants.HEALTH_MISS_PENALTY);
        }
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

      // Check for game over (read health from the single owner)
      const health = gs ? gs.health : playState.health;
      if (healthEnabled && health <= Constants.HEALTH_MIN && playState.gameOver) {
        playState.gameOver();
      }
    },

    /**
     * Ghost miss (pressed key with no note).
     * @param {number} direction - Direction
     * @param {boolean} [applyPenalty=false] - Whether to apply a miss penalty (when ghostTapping is disabled)
     */
    ghostMiss(direction, applyPenalty = false) {
      const { playState } = context;
      const gs = context.gameplayState;
      // Play press animation
      playState.playerStrumline?.playPress(direction);

      if (applyPenalty) {
        const healthEnabled = playState.isFeatureEnabled
          ? playState.isFeatureEnabled('healthBar')
          : true;

        // Update gameplay state exclusively through the single owner (GameplayState_Module).
        if (gs) {
          gs.updateCombo('miss');
          gs.tallies.missed++;
          if (healthEnabled) {
            gs.updateHealth(Constants.HEALTH_MISS_PENALTY);
          }
        }

        // Trigger player miss animation
        if (playState.player) {
          playState.player.miss(direction);
        }

        // Mute player vocals
        if (playState.voices) {
          playState.voices.mutePlayer();
        }

        // Emit miss event
        eventBus.emit(Events.NOTE_MISS, { note: null, direction, isGhostTap: true });

        // Check for game over (read health from the single owner)
        const health = gs ? gs.health : playState.health;
        if (healthEnabled && health <= Constants.HEALTH_MIN && playState.gameOver) {
          playState.gameOver();
        }
      }
    },

    /**
     * Opponent hits a note.
     * @param {NoteProcessorNote} note - The note sprite
     */
    opponentHitNote(note) {
      const { playState, scene } = context;

      // Mark as hit
      note.hasBeenHit = true;

      // Trigger opponent sing animation
      if (playState.opponent) {
        playState.opponent.sing(note.direction);
      }

      // Flash the opponent indicator instead of updating visible strumline
      if (playState.opponentIndicator) {
        playState.opponentIndicator.flash(note.direction);
      }

      // Hit the note on strumline (timing/scoring only, strumline is hidden)
      if (playState.opponentStrumline) {
        playState.opponentStrumline.hitNote(note);
      }

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
     * Clean up resources. Idempotent — subsequent calls are no-ops.
     * GameplayState is now updated synchronously inside hitNote/missNote, so the
     * processor no longer registers EventBus listeners that require teardown.
     */
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
    }
  };

  return processor;
}

/**
 * @fileoverview GameplayState - Manages health, score, combo, and tallies during gameplay.
 * Extracted from PlayState to provide a focused module for gameplay state tracking.
 *
 * @module GameplayState
 */

import * as Constants from '../core/Constants.js';
import Scoring from './Scoring.js';

/**
 * @typedef {Object} GameplayStateContext
 * @property {Phaser.Scene} scene - Phaser scene reference
 * @property {Object} playState - PlayState instance
 * @property {Object} conductor - Conductor instance
 * @property {Object} eventBus - EventBus static class
 * @property {Object} scoring - Scoring static class
 */

/**
 * Create a GameplayState module that tracks health, score, combo, and tallies.
 * @param {GameplayStateContext} context - Shared context object
 * @returns {Object} GameplayState module instance
 */
export function createGameplayState(context) {
  let destroyed = false;

  const state = {
    /** Current health (0 to HEALTH_MAX) */
    health: Constants.HEALTH_STARTING,

    /** Current score */
    score: 0,

    /** Current combo */
    combo: 0,

    /** Maximum combo achieved */
    maxCombo: 0,

    /** Score tallies */
    tallies: Scoring.createTallies(),

    /**
     * Reset all gameplay state to initial values.
     */
    reset() {
      state.health = Constants.HEALTH_STARTING;
      state.score = 0;
      state.combo = 0;
      state.maxCombo = 0;
      state.tallies = Scoring.createTallies();
    },

    /**
     * Update health by a delta, clamped to [HEALTH_MIN, HEALTH_MAX].
     * @param {number} delta - Health change amount
     */
    updateHealth(delta) {
      state.health = Math.max(
        Constants.HEALTH_MIN,
        Math.min(Constants.HEALTH_MAX, state.health + delta)
      );
    },

    /**
     * Update score by adding points.
     * @param {number} points - Points to add
     */
    updateScore(points) {
      state.score += points;
    },

    /**
     * Update combo based on a judgement.
     * Resets combo if the judgement breaks it, otherwise increments.
     * @param {string} judgement - The judgement string (e.g. 'sick', 'good', 'bad', 'shit')
     */
    updateCombo(judgement) {
      const breaksCombo = Scoring.doesJudgementBreakCombo(judgement);
      if (breaksCombo) {
        state.combo = 0;
      } else {
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
      }
    },

    /**
     * Update tallies after a note hit.
     * @param {string} judgement - The judgement string
     * @param {number} score - The score earned for this note
     */
    updateTallies(judgement, score) {
      // Map killer to sick for tally purposes
      const tallyKey = judgement === 'killer' ? 'sick' : judgement;
      if (state.tallies[tallyKey] !== undefined) {
        state.tallies[tallyKey]++;
      }
      state.tallies.totalNotesHit++;
      state.tallies.combo = state.combo;
      state.tallies.maxCombo = state.maxCombo;
      state.tallies.score += score;
    },

    /**
     * Get the health bonus for a given judgement.
     * Delegates to Scoring.getHealthBonus.
     * @param {string} judgement - The judgement string
     * @returns {number} The health change amount
     */
    getHealthBonus(judgement) {
      return Scoring.getHealthBonus(judgement);
    },

    /**
     * Clean up resources. Idempotent — subsequent calls are no-ops.
     */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Reset state to free references
      state.tallies = null;
    }
  };

  return state;
}

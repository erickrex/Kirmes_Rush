/**
 * @fileoverview Unit tests for the GameplayState module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGameplayState } from '../src/play/GameplayState.js';
import * as Constants from '../src/core/Constants.js';
import Scoring from '../src/play/Scoring.js';

describe('GameplayState', () => {
  let gs;
  let context;

  beforeEach(() => {
    context = {
      scene: {},
      playState: {},
      conductor: {},
      eventBus: {},
      scoring: Scoring
    };
    gs = createGameplayState(context);
  });

  describe('initial state', () => {
    it('should start with default health', () => {
      expect(gs.health).toBe(Constants.HEALTH_STARTING);
    });

    it('should start with zero score', () => {
      expect(gs.score).toBe(0);
    });

    it('should start with zero combo', () => {
      expect(gs.combo).toBe(0);
      expect(gs.maxCombo).toBe(0);
    });

    it('should start with empty tallies', () => {
      expect(gs.tallies.sick).toBe(0);
      expect(gs.tallies.good).toBe(0);
      expect(gs.tallies.bad).toBe(0);
      expect(gs.tallies.shit).toBe(0);
      expect(gs.tallies.missed).toBe(0);
      expect(gs.tallies.totalNotesHit).toBe(0);
    });
  });

  describe('updateHealth', () => {
    it('should add positive delta', () => {
      gs.updateHealth(0.5);
      expect(gs.health).toBe(Constants.HEALTH_STARTING + 0.5);
    });

    it('should subtract negative delta', () => {
      gs.updateHealth(-0.3);
      expect(gs.health).toBeCloseTo(Constants.HEALTH_STARTING - 0.3);
    });

    it('should clamp to HEALTH_MAX', () => {
      gs.updateHealth(100);
      expect(gs.health).toBe(Constants.HEALTH_MAX);
    });

    it('should clamp to HEALTH_MIN', () => {
      gs.updateHealth(-100);
      expect(gs.health).toBe(Constants.HEALTH_MIN);
    });
  });

  describe('updateScore', () => {
    it('should add points', () => {
      gs.updateScore(350);
      expect(gs.score).toBe(350);
    });

    it('should accumulate points', () => {
      gs.updateScore(100);
      gs.updateScore(200);
      expect(gs.score).toBe(300);
    });
  });

  describe('updateCombo', () => {
    it('should increment combo for non-breaking judgements', () => {
      gs.updateCombo('sick');
      expect(gs.combo).toBe(1);
      gs.updateCombo('good');
      expect(gs.combo).toBe(2);
    });

    it('should track maxCombo', () => {
      gs.updateCombo('sick');
      gs.updateCombo('sick');
      gs.updateCombo('sick');
      expect(gs.maxCombo).toBe(3);
    });

    it('should reset combo for breaking judgements', () => {
      gs.updateCombo('sick');
      gs.updateCombo('sick');
      gs.updateCombo('shit');
      expect(gs.combo).toBe(0);
      // maxCombo should be preserved
      expect(gs.maxCombo).toBe(2);
    });
  });

  describe('updateTallies', () => {
    it('should increment the correct tally key', () => {
      gs.updateCombo('sick');
      gs.updateTallies('sick', 350);
      expect(gs.tallies.sick).toBe(1);
      expect(gs.tallies.totalNotesHit).toBe(1);
    });

    it('should map killer to sick', () => {
      gs.updateCombo('killer');
      gs.updateTallies('killer', 500);
      expect(gs.tallies.sick).toBe(1);
    });

    it('should sync combo and maxCombo into tallies', () => {
      gs.updateCombo('sick');
      gs.updateCombo('sick');
      gs.updateTallies('sick', 350);
      expect(gs.tallies.combo).toBe(2);
      expect(gs.tallies.maxCombo).toBe(2);
    });

    it('should accumulate score in tallies', () => {
      gs.updateCombo('sick');
      gs.updateTallies('sick', 350);
      gs.updateCombo('good');
      gs.updateTallies('good', 200);
      expect(gs.tallies.score).toBe(550);
    });
  });

  describe('getHealthBonus', () => {
    it('should return killer bonus', () => {
      expect(gs.getHealthBonus('killer')).toBe(Constants.HEALTH_KILLER_BONUS);
    });

    it('should return sick bonus', () => {
      expect(gs.getHealthBonus('sick')).toBe(Constants.HEALTH_SICK_BONUS);
    });

    it('should return 0 for unknown judgement', () => {
      expect(gs.getHealthBonus('unknown')).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      gs.updateScore(500);
      gs.updateHealth(0.5);
      gs.updateCombo('sick');
      gs.updateTallies('sick', 350);

      gs.reset();

      expect(gs.health).toBe(Constants.HEALTH_STARTING);
      expect(gs.score).toBe(0);
      expect(gs.combo).toBe(0);
      expect(gs.maxCombo).toBe(0);
      expect(gs.tallies.sick).toBe(0);
      expect(gs.tallies.totalNotesHit).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should nullify tallies on destroy', () => {
      gs.destroy();
      expect(gs.tallies).toBeNull();
    });

    it('should be idempotent', () => {
      gs.destroy();
      gs.destroy(); // should not throw
      expect(gs.tallies).toBeNull();
    });
  });
});

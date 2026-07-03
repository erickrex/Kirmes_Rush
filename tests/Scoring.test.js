/**
 * @fileoverview Unit tests for the Scoring system
 */

import { describe, it, expect } from 'vitest';
import Scoring, { ScoringSystem, ScoringRank, Judgement } from '../src/play/Scoring.js';
import * as Constants from '../src/core/Constants.js';

describe('Scoring', () => {
  describe('PBOT1 Scoring', () => {
    describe('scoreNote', () => {
      it('should return max score for perfect timing', () => {
        expect(Scoring.scoreNote(0)).toBe(Constants.PBOT1_MAX_SCORE);
        expect(Scoring.scoreNote(4)).toBe(Constants.PBOT1_MAX_SCORE);
        expect(Scoring.scoreNote(-4)).toBe(Constants.PBOT1_MAX_SCORE);
      });

      it('should return miss score for timing beyond threshold', () => {
        expect(Scoring.scoreNote(161)).toBe(Constants.PBOT1_MISS_SCORE);
        expect(Scoring.scoreNote(-161)).toBe(Constants.PBOT1_MISS_SCORE);
        expect(Scoring.scoreNote(200)).toBe(Constants.PBOT1_MISS_SCORE);
      });

      it('should return intermediate scores for timing in between', () => {
        const score45 = Scoring.scoreNote(45);
        const score90 = Scoring.scoreNote(90);
        const score135 = Scoring.scoreNote(135);

        // Scores should decrease as timing gets worse
        expect(score45).toBeLessThan(Constants.PBOT1_MAX_SCORE);
        expect(score90).toBeLessThan(score45);
        expect(score135).toBeLessThan(score90);

        // All should be positive (not miss)
        expect(score45).toBeGreaterThan(0);
        expect(score90).toBeGreaterThan(0);
        expect(score135).toBeGreaterThan(0);
      });

      it('should treat early and late hits the same', () => {
        expect(Scoring.scoreNote(50)).toBe(Scoring.scoreNote(-50));
        expect(Scoring.scoreNote(100)).toBe(Scoring.scoreNote(-100));
      });
    });

    describe('judgeNote', () => {
      it('should return killer for very precise hits', () => {
        expect(Scoring.judgeNote(0)).toBe(Judgement.KILLER);
        expect(Scoring.judgeNote(10)).toBe(Judgement.KILLER);
        expect(Scoring.judgeNote(-10)).toBe(Judgement.KILLER);
      });

      it('should return sick for good hits', () => {
        expect(Scoring.judgeNote(20)).toBe(Judgement.SICK);
        expect(Scoring.judgeNote(44)).toBe(Judgement.SICK);
      });

      it('should return good for decent hits', () => {
        expect(Scoring.judgeNote(50)).toBe(Judgement.GOOD);
        expect(Scoring.judgeNote(89)).toBe(Judgement.GOOD);
      });

      it('should return bad for poor hits', () => {
        expect(Scoring.judgeNote(100)).toBe(Judgement.BAD);
        expect(Scoring.judgeNote(134)).toBe(Judgement.BAD);
      });

      it('should return shit for very poor hits', () => {
        expect(Scoring.judgeNote(140)).toBe(Judgement.SHIT);
        expect(Scoring.judgeNote(159)).toBe(Judgement.SHIT);
      });

      it('should return miss for timing beyond threshold', () => {
        expect(Scoring.judgeNote(161)).toBe(Judgement.MISS);
        expect(Scoring.judgeNote(-161)).toBe(Judgement.MISS);
      });
    });
  });

  describe('Legacy Scoring', () => {
    const system = ScoringSystem.LEGACY;

    it('should return sick score for timing within sick threshold', () => {
      const threshold = Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_SICK_THRESHOLD;
      expect(Scoring.scoreNote(threshold - 1, system)).toBe(Constants.LEGACY_SICK_SCORE);
    });

    it('should return good score for timing within good threshold', () => {
      const sickThreshold = Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_SICK_THRESHOLD;
      const goodThreshold = Constants.LEGACY_HIT_WINDOW * Constants.LEGACY_GOOD_THRESHOLD;
      expect(Scoring.scoreNote(sickThreshold + 1, system)).toBe(Constants.LEGACY_GOOD_SCORE);
      expect(Scoring.scoreNote(goodThreshold - 1, system)).toBe(Constants.LEGACY_GOOD_SCORE);
    });

    it('should return miss score for timing beyond hit window', () => {
      expect(Scoring.scoreNote(Constants.LEGACY_HIT_WINDOW + 1, system)).toBe(Constants.LEGACY_MISS_SCORE);
    });

    it('should judge notes correctly', () => {
      expect(Scoring.judgeNote(10, system)).toBe(Judgement.SICK);
      expect(Scoring.judgeNote(50, system)).toBe(Judgement.GOOD);
      expect(Scoring.judgeNote(200, system)).toBe(Judgement.MISS);
    });
  });

  describe('Week7 Scoring', () => {
    const system = ScoringSystem.WEEK7;

    it('should return sick score for timing within sick threshold', () => {
      const threshold = Constants.WEEK7_HIT_WINDOW * Constants.WEEK7_SICK_THRESHOLD;
      expect(Scoring.scoreNote(threshold - 1, system)).toBe(Constants.WEEK7_SICK_SCORE);
    });

    it('should return miss score for timing beyond hit window', () => {
      expect(Scoring.scoreNote(Constants.WEEK7_HIT_WINDOW + 1, system)).toBe(Constants.WEEK7_MISS_SCORE);
    });
  });

  describe('getMissScore', () => {
    it('should return correct miss score for each system', () => {
      expect(Scoring.getMissScore(ScoringSystem.PBOT1)).toBe(Constants.PBOT1_MISS_SCORE);
      expect(Scoring.getMissScore(ScoringSystem.LEGACY)).toBe(Constants.LEGACY_MISS_SCORE);
      expect(Scoring.getMissScore(ScoringSystem.WEEK7)).toBe(Constants.WEEK7_MISS_SCORE);
    });
  });


  describe('calculateRank', () => {
    it('should return null for empty tallies', () => {
      expect(Scoring.calculateRank(null)).toBeNull();
      expect(Scoring.calculateRank({ totalNotes: 0 })).toBeNull();
    });

    it('should return PERFECT_GOLD for all sicks', () => {
      const tallies = {
        sick: 100,
        good: 0,
        bad: 0,
        shit: 0,
        missed: 0,
        totalNotes: 100
      };
      expect(Scoring.calculateRank(tallies)).toBe(ScoringRank.PERFECT_GOLD);
    });

    it('should return PERFECT for 100% completion without all sicks', () => {
      const tallies = {
        sick: 90,
        good: 10,
        bad: 0,
        shit: 0,
        missed: 0,
        totalNotes: 100
      };
      expect(Scoring.calculateRank(tallies)).toBe(ScoringRank.PERFECT);
    });

    it('should return EXCELLENT for 90%+ completion', () => {
      const tallies = {
        sick: 80,
        good: 15,
        bad: 0,
        shit: 0,
        missed: 5,
        totalNotes: 100
      };
      expect(Scoring.calculateRank(tallies)).toBe(ScoringRank.EXCELLENT);
    });

    it('should return GREAT for 80%+ completion', () => {
      const tallies = {
        sick: 70,
        good: 20,
        bad: 0,
        shit: 0,
        missed: 10,
        totalNotes: 100
      };
      expect(Scoring.calculateRank(tallies)).toBe(ScoringRank.GREAT);
    });

    it('should return GOOD for 60%+ completion', () => {
      const tallies = {
        sick: 50,
        good: 30,
        bad: 0,
        shit: 0,
        missed: 20,
        totalNotes: 100
      };
      expect(Scoring.calculateRank(tallies)).toBe(ScoringRank.GOOD);
    });

    it('should return SHIT for below 60% completion', () => {
      const tallies = {
        sick: 20,
        good: 20,
        bad: 10,
        shit: 10,
        missed: 40,
        totalNotes: 100
      };
      expect(Scoring.calculateRank(tallies)).toBe(ScoringRank.SHIT);
    });
  });

  describe('tallyCompletion', () => {
    it('should return 0 for null tallies', () => {
      expect(Scoring.tallyCompletion(null)).toBe(0);
    });

    it('should return 0 for zero total notes', () => {
      expect(Scoring.tallyCompletion({ totalNotes: 0 })).toBe(0);
    });

    it('should calculate completion correctly', () => {
      const tallies = {
        sick: 50,
        good: 30,
        missed: 20,
        totalNotes: 100
      };
      // (50 + 30 - 20) / 100 = 0.6
      expect(Scoring.tallyCompletion(tallies)).toBe(0.6);
    });

    it('should clamp completion to [0, 1]', () => {
      const highTallies = {
        sick: 100,
        good: 50,
        missed: 0,
        totalNotes: 100
      };
      expect(Scoring.tallyCompletion(highTallies)).toBe(1);

      const lowTallies = {
        sick: 0,
        good: 0,
        missed: 100,
        totalNotes: 100
      };
      expect(Scoring.tallyCompletion(lowTallies)).toBe(0);
    });
  });

  describe('getRankValue', () => {
    it('should return correct values for each rank', () => {
      expect(Scoring.getRankValue(ScoringRank.PERFECT_GOLD)).toBe(5);
      expect(Scoring.getRankValue(ScoringRank.PERFECT)).toBe(4);
      expect(Scoring.getRankValue(ScoringRank.EXCELLENT)).toBe(3);
      expect(Scoring.getRankValue(ScoringRank.GREAT)).toBe(2);
      expect(Scoring.getRankValue(ScoringRank.GOOD)).toBe(1);
      expect(Scoring.getRankValue(ScoringRank.SHIT)).toBe(0);
    });

    it('should return -1 for null or invalid rank', () => {
      expect(Scoring.getRankValue(null)).toBe(-1);
      expect(Scoring.getRankValue('invalid')).toBe(-1);
    });
  });

  describe('compareRanks', () => {
    it('should compare ranks correctly', () => {
      expect(Scoring.compareRanks(ScoringRank.PERFECT_GOLD, ScoringRank.PERFECT)).toBeGreaterThan(0);
      expect(Scoring.compareRanks(ScoringRank.SHIT, ScoringRank.GOOD)).toBeLessThan(0);
      expect(Scoring.compareRanks(ScoringRank.GREAT, ScoringRank.GREAT)).toBe(0);
    });
  });

  describe('doesJudgementBreakCombo', () => {
    it('should not break combo for killer/sick/good', () => {
      expect(Scoring.doesJudgementBreakCombo(Judgement.KILLER)).toBe(false);
      expect(Scoring.doesJudgementBreakCombo(Judgement.SICK)).toBe(false);
      expect(Scoring.doesJudgementBreakCombo(Judgement.GOOD)).toBe(false);
    });

    it('should break combo for bad/shit/miss', () => {
      expect(Scoring.doesJudgementBreakCombo(Judgement.BAD)).toBe(true);
      expect(Scoring.doesJudgementBreakCombo(Judgement.SHIT)).toBe(true);
      expect(Scoring.doesJudgementBreakCombo(Judgement.MISS)).toBe(true);
    });
  });

  describe('getHealthBonus', () => {
    it('should return positive health for good judgements', () => {
      expect(Scoring.getHealthBonus(Judgement.KILLER)).toBeGreaterThan(0);
      expect(Scoring.getHealthBonus(Judgement.SICK)).toBeGreaterThan(0);
      expect(Scoring.getHealthBonus(Judgement.GOOD)).toBeGreaterThan(0);
    });

    it('should return zero or negative health for bad judgements', () => {
      expect(Scoring.getHealthBonus(Judgement.BAD)).toBe(0);
      expect(Scoring.getHealthBonus(Judgement.SHIT)).toBeLessThan(0);
      expect(Scoring.getHealthBonus(Judgement.MISS)).toBeLessThan(0);
    });
  });

  describe('Tally Utilities', () => {
    describe('createTallies', () => {
      it('should create empty tallies object', () => {
        const tallies = Scoring.createTallies();
        expect(tallies.sick).toBe(0);
        expect(tallies.good).toBe(0);
        expect(tallies.bad).toBe(0);
        expect(tallies.shit).toBe(0);
        expect(tallies.missed).toBe(0);
        expect(tallies.combo).toBe(0);
        expect(tallies.maxCombo).toBe(0);
        expect(tallies.totalNotesHit).toBe(0);
        expect(tallies.totalNotes).toBe(0);
        expect(tallies.score).toBe(0);
      });
    });

    describe('updateTalliesOnHit', () => {
      it('should update sick count and combo', () => {
        const tallies = Scoring.createTallies();
        Scoring.updateTalliesOnHit(tallies, Judgement.SICK, 500);
        expect(tallies.sick).toBe(1);
        expect(tallies.combo).toBe(1);
        expect(tallies.maxCombo).toBe(1);
        expect(tallies.totalNotesHit).toBe(1);
        expect(tallies.score).toBe(500);
      });

      it('should break combo on bad judgement', () => {
        const tallies = Scoring.createTallies();
        tallies.combo = 10;
        tallies.maxCombo = 10;
        Scoring.updateTalliesOnHit(tallies, Judgement.BAD, 50);
        expect(tallies.bad).toBe(1);
        expect(tallies.combo).toBe(0);
        expect(tallies.maxCombo).toBe(10); // Max combo preserved
      });

      it('should track max combo correctly', () => {
        const tallies = Scoring.createTallies();
        Scoring.updateTalliesOnHit(tallies, Judgement.SICK, 500);
        Scoring.updateTalliesOnHit(tallies, Judgement.SICK, 500);
        Scoring.updateTalliesOnHit(tallies, Judgement.SICK, 500);
        expect(tallies.combo).toBe(3);
        expect(tallies.maxCombo).toBe(3);

        Scoring.updateTalliesOnHit(tallies, Judgement.BAD, 50);
        expect(tallies.combo).toBe(0);
        expect(tallies.maxCombo).toBe(3);
      });
    });

    describe('updateTalliesOnMiss', () => {
      it('should update missed count and reset combo', () => {
        const tallies = Scoring.createTallies();
        tallies.combo = 5;
        Scoring.updateTalliesOnMiss(tallies);
        expect(tallies.missed).toBe(1);
        expect(tallies.combo).toBe(0);
        expect(tallies.score).toBe(Constants.PBOT1_MISS_SCORE);
      });
    });
  });
});

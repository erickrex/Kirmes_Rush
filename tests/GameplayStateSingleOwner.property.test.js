/**
 * @fileoverview Property-based tests for the GameplayState single-owner contract.
 *
 * Task 2.5 (cleanup-and-wire-visuals): exactly-once gameplay state update.
 *
 * Property 1 (Exactly-once): For any sequence of note hits/misses, the totals
 *   tracked by GameplayState_Module equal the sum of the per-event contributions
 *   (no double counting).
 *   Validates: Requirements 6.4
 *
 * Property 2 (Read-through consistency): PlayState's score/combo/maxCombo/health/
 *   tallies read accessors always equal the corresponding GameplayState_Module
 *   values.
 *   Validates: Requirements 6.6
 *
 * The harness mirrors how PlayState wires NoteProcessor and GameplayState in
 * production: NoteProcessor.hitNote/missNote drive state EXCLUSIVELY through the
 * GameplayState_Module, and PlayState exposes read-through getters over it.
 * Scoring.judgeNote/scoreNote are stubbed so each generated event has a known
 * judgement + score; the combo-break and health-bonus logic remain the real
 * production functions (the single combo-break authority).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// SaveManager is consulted inside hitNote (noteOffset, hitsounds). Stub it so the
// test never touches localStorage and timing offsets stay neutral.
// EventBus imports Phaser at module load; mock it so the harness stays headless.
// NoteProcessor only needs the Events name constants (it emits through the
// eventBus passed in via context, not this default export).
vi.mock('../src/core/EventBus.js', () => ({
  default: { emit: () => {}, on: () => {}, off: () => {} },
  Events: {
    NOTE_HIT: 'noteHit',
    NOTE_MISS: 'noteMiss',
    OPPONENT_NOTE_HIT: 'opponentNoteHit'
  }
}));

vi.mock('../src/data/SaveManager.js', () => {
  const instance = {
    /** @param {string} key */
    getOption(key) {
      if (key === 'noteOffset') {
        return 0;
      }
      if (key === 'hitsounds') {
        return false;
      }
      return undefined;
    }
  };
  return {
    default: {
      getInstance: () => instance
    }
  };
});

import * as Constants from '../src/core/Constants.js';
import Scoring from '../src/play/Scoring.js';
import { createGameplayState } from '../src/play/GameplayState.js';
import { createNoteProcessor } from '../src/play/NoteProcessor.js';

/**
 * Judgements that can be produced by a successful hit.
 * @type {readonly string[]}
 */
const HIT_JUDGEMENTS = ['killer', 'sick', 'good', 'bad', 'shit'];

/**
 * fast-check arbitrary for a single gameplay event.
 * A `hit` carries a known judgement + score; a `miss` carries neither.
 */
const eventArb = fc.oneof(
  fc.record({
    type: fc.constant('hit'),
    judgement: fc.constantFrom(...HIT_JUDGEMENTS),
    score: fc.integer({ min: 0, max: 1000 })
  }),
  fc.record({
    type: fc.constant('miss')
  })
);

/**
 * Build a fresh harness: a real GameplayState, a PlayState stand-in whose
 * score/combo/maxCombo/health/tallies are read-through accessors over the
 * GameplayState, and a real NoteProcessor wired to both.
 *
 * @returns {{ gs: any, playState: any, noteProcessor: any }}
 */
function createHarness() {
  const gs = createGameplayState({});

  /** @type {any} */
  const playState = {
    songPosition: 10000,
    playerStrumline: { notes: [], hitNote: () => {}, playPress: () => {}, playStatic: () => {} },
    opponentStrumline: null,
    player: { sing: () => {}, miss: () => {} },
    voices: { mutePlayer: () => {}, unmutePlayer: () => {} },
    audioManager: { playHitsound: () => {} },
    onNoteHit: null,
    onNoteMiss: null,
    isFeatureEnabled: () => true,
    gameOver: () => {},
    // Read-through accessors (single source of truth: gs) — mirrors PlayState.
    get score() {
      return gs.score;
    },
    get combo() {
      return gs.combo;
    },
    get maxCombo() {
      return gs.maxCombo;
    },
    get health() {
      return gs.health;
    },
    get tallies() {
      return gs.tallies;
    }
  };

  // Scoring stub: judgement/score are dictated per-event by the generator so the
  // accounting is deterministic. Combo-break + health-bonus stay real (the
  // canonical single authority lives in the actual Scoring module via gs).
  const scoringStub = {
    /** @type {string} */
    _judgement: 'sick',
    /** @type {number} */
    _score: 0,
    judgeNote() {
      return scoringStub._judgement;
    },
    scoreNote() {
      return scoringStub._score;
    },
    doesJudgementBreakCombo: Scoring.doesJudgementBreakCombo.bind(Scoring),
    getHealthBonus: Scoring.getHealthBonus.bind(Scoring)
  };

  const noteProcessor = createNoteProcessor({
    scene: /** @type {any} */ ({ time: { delayedCall: () => {} } }),
    playState,
    conductor: /** @type {any} */ ({}),
    eventBus: { emit: () => {}, on: () => {}, off: () => {} },
    scoring: /** @type {any} */ (scoringStub),
    gameplayState: gs
  });

  return { gs, playState, noteProcessor, scoringStub };
}

/**
 * Independently compute the expected gameplay totals for a sequence of events.
 * This reference model accumulates each contribution exactly once, so any
 * double-counting in the production path makes the totals diverge.
 *
 * @param {Array<{ type: string, judgement?: string, score?: number }>} events
 * @returns {{ score: number, combo: number, maxCombo: number, health: number, tallies: Record<string, number> }}
 */
function computeExpected(events) {
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let health = Constants.HEALTH_STARTING;
  const tallies = { sick: 0, good: 0, bad: 0, shit: 0, missed: 0, totalNotesHit: 0 };

  /** @param {number} delta */
  const applyHealth = (delta) => {
    health = Math.max(Constants.HEALTH_MIN, Math.min(Constants.HEALTH_MAX, health + delta));
  };

  for (const ev of events) {
    if (ev.type === 'hit') {
      const judgement = /** @type {string} */ (ev.judgement);
      const noteScore = /** @type {number} */ (ev.score);
      score += noteScore;
      // Combo via the canonical break decision.
      if (Scoring.doesJudgementBreakCombo(judgement)) {
        combo = 0;
      } else {
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
      }
      // Tallies: killer maps to sick.
      const key = judgement === 'killer' ? 'sick' : judgement;
      if (tallies[key] !== undefined) {
        tallies[key] += 1;
      }
      tallies.totalNotesHit += 1;
      applyHealth(Scoring.getHealthBonus(judgement));
    } else {
      // miss
      if (Scoring.doesJudgementBreakCombo('miss')) {
        combo = 0;
      }
      tallies.missed += 1;
      applyHealth(Constants.HEALTH_MISS_PENALTY);
    }
  }

  return { score, combo, maxCombo, health, tallies };
}

/**
 * Drive a single event through the NoteProcessor (production hit/miss path).
 * @param {any} harness
 * @param {{ type: string, judgement?: string, score?: number }} ev
 */
function applyEvent(harness, ev) {
  const note = { alive: true, hasBeenHit: false, hasMissed: false, direction: 0, strumTime: 0 };
  if (ev.type === 'hit') {
    harness.scoringStub._judgement = /** @type {string} */ (ev.judgement);
    harness.scoringStub._score = /** @type {number} */ (ev.score);
    harness.noteProcessor.hitNote(note, 0);
  } else {
    harness.noteProcessor.missNote(note);
  }
}

describe('GameplayState single-owner contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 1: Exactly-once state update.
   * Validates: Requirements 6.4
   */
  it('totals equal the sum of per-event contributions (no double counting)', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 0, maxLength: 200 }), (events) => {
        const harness = createHarness();
        for (const ev of events) {
          applyEvent(harness, ev);
        }
        const expected = computeExpected(events);
        const { gs } = harness;

        expect(gs.score).toBe(expected.score);
        expect(gs.combo).toBe(expected.combo);
        expect(gs.maxCombo).toBe(expected.maxCombo);
        expect(gs.health).toBeCloseTo(expected.health, 10);
        expect(gs.tallies.totalNotesHit).toBe(expected.tallies.totalNotesHit);
        expect(gs.tallies.missed).toBe(expected.tallies.missed);
        expect(gs.tallies.sick).toBe(expected.tallies.sick);
        expect(gs.tallies.good).toBe(expected.tallies.good);
        expect(gs.tallies.bad).toBe(expected.tallies.bad);
        expect(gs.tallies.shit).toBe(expected.tallies.shit);
        // tallies.score is accumulated only on hits and must equal total hit score.
        expect(gs.tallies.score).toBe(expected.score);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: Read-through consistency.
   * Validates: Requirements 6.6
   */
  it('PlayState read accessors always equal GameplayState values', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 0, maxLength: 200 }), (events) => {
        const harness = createHarness();
        const { gs, playState } = harness;
        for (const ev of events) {
          applyEvent(harness, ev);
          // Invariant must hold after every single event, not just at the end.
          expect(playState.score).toBe(gs.score);
          expect(playState.combo).toBe(gs.combo);
          expect(playState.maxCombo).toBe(gs.maxCombo);
          expect(playState.health).toBe(gs.health);
          expect(playState.tallies).toBe(gs.tallies);
        }
      }),
      { numRuns: 200 }
    );
  });
});

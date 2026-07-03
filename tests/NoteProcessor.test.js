/**
 * @fileoverview Unit tests for the NoteProcessor module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser's EventEmitter before importing EventBus
vi.mock('phaser', () => ({
  default: {
    Events: {
      EventEmitter: class MockEventEmitter {
        constructor() {
          this.listeners = new Map();
        }
        on(event, callback, context) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event).push({ callback, context, once: false });
          return this;
        }
        once(event, callback, context) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event).push({ callback, context, once: true });
          return this;
        }
        emit(event, ...args) {
          const eventListeners = this.listeners.get(event) || [];
          const toRemove = [];
          eventListeners.forEach((listener, index) => {
            listener.callback.apply(listener.context, args);
            if (listener.once) {
              toRemove.push(index);
            }
          });
          for (let i = toRemove.length - 1; i >= 0; i--) {
            eventListeners.splice(toRemove[i], 1);
          }
          return this;
        }
        off(event, callback, context) {
          if (!this.listeners.has(event)) return this;
          const eventListeners = this.listeners.get(event);
          const index = eventListeners.findIndex(
            (l) => l.callback === callback && (!context || l.context === context)
          );
          if (index !== -1) {
            eventListeners.splice(index, 1);
          }
          return this;
        }
        removeAllListeners(event) {
          if (event) {
            this.listeners.delete(event);
          } else {
            this.listeners.clear();
          }
          return this;
        }
        listenerCount(event) {
          return (this.listeners.get(event) || []).length;
        }
      }
    }
  }
}));

import { createNoteProcessor } from '../src/play/NoteProcessor.js';
import { createGameplayState } from '../src/play/GameplayState.js';
import * as Constants from '../src/core/Constants.js';
import EventBus, { Events } from '../src/core/EventBus.js';
import Scoring from '../src/play/Scoring.js';

describe('NoteProcessor', () => {
  let np;
  let context;
  let playState;
  let gs;

  beforeEach(() => {
    EventBus.reset();

    // GameplayState_Module is the single source of truth for score/combo/health/tallies.
    gs = createGameplayState({});
    gs.tallies.totalNotes = 10;

    playState = {
      songPosition: 1000,
      // Read-through accessors mirror PlayState's single-owner contract over GameplayState.
      get health() {
        return gs.health;
      },
      set health(value) {
        gs.health = value;
      },
      get score() {
        return gs.score;
      },
      get combo() {
        return gs.combo;
      },
      set combo(value) {
        gs.combo = value;
      },
      get maxCombo() {
        return gs.maxCombo;
      },
      set maxCombo(value) {
        gs.maxCombo = value;
      },
      get tallies() {
        return gs.tallies;
      },
      set tallies(value) {
        gs.tallies = value;
      },
      playerStrumline: {
        notes: [],
        hitNote: vi.fn(),
        playPress: vi.fn()
      },
      opponentStrumline: {
        notes: [],
        hitNote: vi.fn()
      },
      player: { sing: vi.fn(), miss: vi.fn() },
      opponent: { sing: vi.fn() },
      voices: { unmutePlayer: vi.fn(), mutePlayer: vi.fn() },
      onNoteHit: null,
      onNoteMiss: null,
      gameOver: vi.fn(),
      getHealthBonus: (judgement) => Scoring.getHealthBonus(judgement),
      isFeatureEnabled: vi.fn(() => true)
    };

    context = {
      scene: {},
      playState,
      conductor: {},
      eventBus: EventBus,
      scoring: Scoring,
      gameplayState: gs
    };

    np = createNoteProcessor(context);
  });

  describe('checkMissedNotes', () => {
    it('should mark notes past the hit window as missed', () => {
      const note = {
        alive: true, hasBeenHit: false, hasMissed: false,
        handledMiss: false, strumTime: 500, direction: 0
      };
      playState.playerStrumline.notes = [note];
      // songPosition=1000, missThreshold=1000-160=840, note.strumTime=500 < 840
      np.checkMissedNotes();
      expect(note.hasMissed).toBe(true);
      expect(note.handledMiss).toBe(true);
    });

    it('should not miss notes within the hit window', () => {
      const note = {
        alive: true, hasBeenHit: false, hasMissed: false,
        handledMiss: false, strumTime: 900, direction: 0
      };
      playState.playerStrumline.notes = [note];
      // missThreshold=840, note.strumTime=900 >= 840
      np.checkMissedNotes();
      expect(note.hasMissed).toBe(false);
    });

    it('should skip already hit notes', () => {
      const note = {
        alive: true, hasBeenHit: true, hasMissed: false,
        handledMiss: false, strumTime: 500, direction: 0
      };
      playState.playerStrumline.notes = [note];
      np.checkMissedNotes();
      expect(note.hasMissed).toBe(false);
    });

    it('should skip already missed notes', () => {
      const note = {
        alive: true, hasBeenHit: false, hasMissed: true,
        handledMiss: false, strumTime: 500, direction: 0
      };
      playState.playerStrumline.notes = [note];
      np.checkMissedNotes();
      // handledMiss should remain false since it was already missed
      expect(note.handledMiss).toBe(false);
    });

    it('should be a no-op when playerStrumline is null', () => {
      playState.playerStrumline = null;
      expect(() => np.checkMissedNotes()).not.toThrow();
    });
  });

  describe('processOpponentNotes', () => {
    it('should auto-hit opponent notes at or past songPosition', () => {
      const note = {
        alive: true, hasBeenHit: false, strumTime: 900, direction: 1
      };
      playState.opponentStrumline.notes = [note];
      np.processOpponentNotes();
      expect(note.hasBeenHit).toBe(true);
      expect(playState.opponent.sing).toHaveBeenCalledWith(1);
      expect(playState.opponentStrumline.hitNote).toHaveBeenCalledWith(note);
    });

    it('should not hit future opponent notes', () => {
      const note = {
        alive: true, hasBeenHit: false, strumTime: 1500, direction: 0
      };
      playState.opponentStrumline.notes = [note];
      np.processOpponentNotes();
      expect(note.hasBeenHit).toBe(false);
    });

    it('should be a no-op when opponentStrumline is null', () => {
      playState.opponentStrumline = null;
      expect(() => np.processOpponentNotes()).not.toThrow();
    });
  });

  describe('hitNote', () => {
    it('should update score, combo, tallies, and health', () => {
      const note = { direction: 0 };
      np.hitNote(note, 5); // 5ms timing = killer/sick

      expect(playState.score).toBeGreaterThan(0);
      expect(playState.combo).toBe(1);
      expect(playState.tallies.totalNotesHit).toBe(1);
      expect(playState.playerStrumline.hitNote).toHaveBeenCalledWith(note);
      expect(playState.player.sing).toHaveBeenCalledWith(0);
      expect(playState.voices.unmutePlayer).toHaveBeenCalled();
    });

    it('should reset combo on combo-breaking judgement', () => {
      playState.combo = 5;
      playState.maxCombo = 5;
      const note = { direction: 0 };
      // 150ms timing = bad/shit which breaks combo
      np.hitNote(note, 150);
      expect(playState.combo).toBe(0);
    });

    it('should emit NOTE_HIT event with extended payload', () => {
      const handler = vi.fn();
      EventBus.on(Events.NOTE_HIT, handler);
      const note = { direction: 0 };
      np.hitNote(note, 10);
      expect(handler).toHaveBeenCalled();
      const callData = handler.mock.calls[0][0];
      expect(callData.note).toBe(note);
      expect(callData.judgement).toBeDefined();
      expect(callData.score).toBeDefined();
      expect(callData.direction).toBe(0);
      expect(callData).toHaveProperty('receptor');
      EventBus.off(Events.NOTE_HIT, handler);
    });

    it('should call onNoteHit callback if set', () => {
      const callback = vi.fn();
      playState.onNoteHit = callback;
      const note = { direction: 2 };
      np.hitNote(note, 10);
      expect(callback).toHaveBeenCalled();
    });

    it('should not modify health when the health bar feature is disabled', () => {
      playState.isFeatureEnabled.mockImplementation((feature) => feature !== 'healthBar');
      const startingHealth = playState.health;

      np.hitNote({ direction: 0 }, 5);

      expect(playState.health).toBe(startingHealth);
    });
  });

  describe('missNote', () => {
    it('should mark note as missed and update state', () => {
      const note = { direction: 1, hasMissed: false, handledMiss: false };
      playState.combo = 5;
      np.missNote(note);

      expect(note.hasMissed).toBe(true);
      expect(note.handledMiss).toBe(true);
      expect(playState.combo).toBe(0);
      expect(playState.tallies.missed).toBe(1);
      expect(playState.health).toBeLessThan(Constants.HEALTH_STARTING);
      expect(playState.player.miss).toHaveBeenCalledWith(1);
      expect(playState.voices.mutePlayer).toHaveBeenCalled();
    });

    it('should emit NOTE_MISS event', () => {
      const handler = vi.fn();
      EventBus.on(Events.NOTE_MISS, handler);
      const note = { direction: 0, hasMissed: false, handledMiss: false };
      np.missNote(note);
      expect(handler).toHaveBeenCalled();
      EventBus.off(Events.NOTE_MISS, handler);
    });

    it('should trigger gameOver when health reaches minimum', () => {
      // Set health so that after applying the miss penalty it clamps to HEALTH_MIN
      // HEALTH_MISS_PENALTY is negative, so we need health small enough that
      // health + penalty <= HEALTH_MIN (0)
      playState.health = 0.01;
      const note = { direction: 0, hasMissed: false, handledMiss: false };
      np.missNote(note);
      expect(playState.gameOver).toHaveBeenCalled();
    });

    it('should call onNoteMiss callback if set', () => {
      const callback = vi.fn();
      playState.onNoteMiss = callback;
      const note = { direction: 0, hasMissed: false, handledMiss: false };
      np.missNote(note);
      expect(callback).toHaveBeenCalledWith(note);
    });

    it('should not reduce health or game over when the health bar feature is disabled', () => {
      playState.isFeatureEnabled.mockImplementation((feature) => feature !== 'healthBar');
      playState.health = 0.01;
      const note = { direction: 0, hasMissed: false, handledMiss: false };

      np.missNote(note);

      expect(playState.health).toBe(0.01);
      expect(playState.gameOver).not.toHaveBeenCalled();
    });
  });

  describe('ghostMiss', () => {
    it('should play press animation on playerStrumline', () => {
      np.ghostMiss(2);
      expect(playState.playerStrumline.playPress).toHaveBeenCalledWith(2);
    });

    it('should not throw when playerStrumline is null', () => {
      playState.playerStrumline = null;
      expect(() => np.ghostMiss(0)).not.toThrow();
    });
  });

  describe('opponentHitNote', () => {
    it('should mark note as hit and trigger opponent animation', () => {
      const note = { hasBeenHit: false, direction: 3 };
      np.opponentHitNote(note);
      expect(note.hasBeenHit).toBe(true);
      expect(playState.opponent.sing).toHaveBeenCalledWith(3);
      expect(playState.opponentStrumline.hitNote).toHaveBeenCalledWith(note);
    });

    it('should emit OPPONENT_NOTE_HIT event', () => {
      const handler = vi.fn();
      EventBus.on(Events.OPPONENT_NOTE_HIT, handler);
      const note = { hasBeenHit: false, direction: 0 };
      np.opponentHitNote(note);
      expect(handler).toHaveBeenCalledWith({ note });
      EventBus.off(Events.OPPONENT_NOTE_HIT, handler);
    });
  });

  describe('destroy', () => {
    it('should not register NOTE_HIT/NOTE_MISS listeners (state is updated synchronously)', () => {
      // The processor updates GameplayState directly in hitNote/missNote, so it does
      // not register EventBus listeners that would need teardown.
      expect(EventBus.listenerCount(Events.NOTE_HIT)).toBe(0);
      expect(EventBus.listenerCount(Events.NOTE_MISS)).toBe(0);
      expect(() => np.destroy()).not.toThrow();
    });

    it('should be idempotent', () => {
      expect(() => {
        np.destroy();
        np.destroy(); // second call should be a no-op
      }).not.toThrow();
    });
  });

  describe('single source of truth (GameplayState)', () => {
    it('should update gameplay state exactly once per hit (no double counting)', () => {
      const note = { direction: 0 };
      np.hitNote(note, 5); // sick/killer

      // Score reflects a single application of the note score.
      expect(gs.score).toBe(Scoring.scoreNote(5));
      expect(gs.combo).toBe(1);
      expect(gs.tallies.totalNotesHit).toBe(1);
      // PlayState read accessors equal the GameplayState values.
      expect(playState.score).toBe(gs.score);
      expect(playState.combo).toBe(gs.combo);
      expect(playState.tallies).toBe(gs.tallies);
    });

    it('should update gameplay state exactly once per miss (no double counting)', () => {
      gs.combo = 5;
      const note = { direction: 0, hasMissed: false, handledMiss: false };
      np.missNote(note);

      expect(gs.combo).toBe(0);
      expect(gs.tallies.missed).toBe(1);
      expect(playState.health).toBe(gs.health);
    });
  });
});

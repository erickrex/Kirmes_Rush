/**
 * @fileoverview Property-based tests for Competitive Stats Integration.
 * Tests feature-flag gating, data flow, combo breaks, and visibility options.
 *
 * Feature: competitive-stats-integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// ========================================
// MOCKS
// ========================================

// Mock Phaser before any imports that use it
vi.stubGlobal('Phaser', {
  GameObjects: {
    Sprite: class MockSprite {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.visible = true;
        this.alpha = 1;
      }
      setOrigin() { return this; }
      setScale() { return this; }
      setPosition() { return this; }
      setVisible() { return this; }
      setAlpha() { return this; }
      destroy() {}
    },
    Graphics: class MockGraphics {
      constructor() {}
      clear() { return this; }
      fillStyle() { return this; }
      fillTriangle() { return this; }
      fillRect() { return this; }
      destroy() {}
    },
    Text: class MockText {
      constructor(scene, x, y, text, style) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.style = style;
        this.visible = true;
        this.alpha = 1;
        this.depth = 0;
        this.width = 200;
        this.height = 20;
      }
      setText(text) { this.text = text; return this; }
      setPosition(x, y) { this.x = x; this.y = y; return this; }
      setScrollFactor() { return this; }
      setOrigin() { return this; }
      setDepth() { return this; }
      setVisible() { return this; }
      setAlpha() { return this; }
      destroy() {}
    }
  },
  Events: {
    EventEmitter: class MockEventEmitter {
      constructor() { this.listeners = {}; }
      on(event, fn) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(fn);
        return this;
      }
      off(event, fn) {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(f => f !== fn);
        }
        return this;
      }
      emit(event, ...args) {
        if (this.listeners[event]) {
          this.listeners[event].forEach(fn => fn(...args));
        }
        return this;
      }
      once(event, fn) {
        const wrapper = (...args) => { fn(...args); this.off(event, wrapper); };
        return this.on(event, wrapper);
      }
      removeAllListeners() { this.listeners = {}; return this; }
      listenerCount(event) { return (this.listeners[event] || []).length; }
    }
  },
  Math: {
    Clamp: (value, min, max) => Math.min(Math.max(value, min), max)
  }
});

// Mock Conductor
const mockConductor = {
  songPosition: 0,
  beatLengthMs: 500,
  stepLengthMs: 125,
  currentStep: 0,
  currentBeat: 0,
  mapTimeChanges: vi.fn(),
  update: vi.fn(),
  reset: vi.fn()
};

vi.mock('../src/core/Conductor.js', () => ({
  default: { instance: mockConductor }
}));

// Mock EventBus
vi.mock('../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  Events: {
    NOTE_HIT: 'noteHit',
    NOTE_MISS: 'noteMiss',
    OPPONENT_NOTE_HIT: 'opponentNoteHit',
    SONG_START: 'songStart',
    SONG_END: 'songEnd',
    COUNTDOWN_START: 'countdownStart',
    COUNTDOWN_STEP: 'countdownStep',
    PAUSE: 'pause',
    RESUME: 'resume',
    GAME_OVER: 'gameOver',
    REPLAY_START: 'replayStart',
    REPLAY_STOP: 'replayStop',
    COMBO_BREAK: 'comboBreak',
    LEVEL_LOADED: 'levelLoaded'
  }
}));

// Mock AnimationRegistrar
vi.mock('../src/graphics/AnimationRegistrar.js', () => ({
  registerCharacterAnimations: vi.fn(),
  registerPropAnimations: vi.fn()
}));

// Mock Phaser module for ResultState
vi.mock('phaser', () => {
  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    alpha: 0,
    text: '',
    destroy: vi.fn()
  };

  const mockSprite = {
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    y: 0,
    destroy: vi.fn()
  };

  return {
    default: {
      Scene: class MockScene {
        constructor(config) {
          this.config = config;
          this.scene = { key: config.key, start: vi.fn() };
          this._createdTexts = [];
          this.add = {
            text: vi.fn((x, y, text, style) => {
              const t = { ...mockText, x, y, text, style };
              t.setOrigin = vi.fn().mockReturnValue(t);
              t.setText = vi.fn((val) => { t.text = val; return t; });
              t.setAlpha = vi.fn((val) => { t.alpha = val; return t; });
              this._createdTexts.push(t);
              return t;
            }),
            sprite: vi.fn(() => ({ ...mockSprite })),
            graphics: vi.fn(() => ({
              fillStyle: vi.fn().mockReturnThis(),
              fillRect: vi.fn().mockReturnThis(),
              fillGradientStyle: vi.fn().mockReturnThis()
            }))
          };
          this.cameras = {
            main: {
              width: 1280,
              height: 720,
              fadeOut: vi.fn(),
              fadeIn: vi.fn(),
              once: vi.fn((event, cb) => cb())
            }
          };
          this.input = {
            keyboard: { on: vi.fn(), off: vi.fn() }
          };
          this.sound = {
            add: vi.fn(() => ({
              play: vi.fn(),
              stop: vi.fn(),
              isPlaying: false
            }))
          };
          this.cache = {
            audio: { exists: vi.fn(() => false) }
          };
          this.textures = {
            exists: vi.fn(() => false)
          };
          this.time = {
            delayedCall: vi.fn((delay, cb) => { cb(); return { remove: vi.fn() }; })
          };
          this.tweens = {
            add: vi.fn(() => ({ stop: vi.fn() })),
            addCounter: vi.fn((config) => {
              if (config.onComplete) config.onComplete();
              return { stop: vi.fn() };
            }),
            killAll: vi.fn()
          };
          this.load = {
            setPath: vi.fn(),
            image: vi.fn(),
            audio: vi.fn()
          };
        }
      }
    }
  };
});

// Mock Scoring
vi.mock('../src/play/Scoring.js', () => ({
  default: {
    calculateRank: vi.fn(() => 'GREAT'),
    createTallies: vi.fn(() => ({
      sick: 0,
      good: 0,
      bad: 0,
      shit: 0,
      missed: 0,
      combo: 0,
      maxCombo: 0,
      totalNotesHit: 0,
      totalNotes: 0,
      score: 0
    })),
    doesJudgementBreakCombo: vi.fn((judgement) => judgement === 'shit'),
    getHealthBonus: vi.fn(() => 0),
    scoreNote: vi.fn(() => 350),
    judgeNote: vi.fn(() => 'sick'),
    updateTalliesOnHit: vi.fn(),
    updateTalliesOnMiss: vi.fn()
  }
}));

// Import after mocks
const { default: PlayState } = await import('../src/play/PlayState.js');
const { default: EventBus, Events } = await import('../src/core/EventBus.js');
const { default: ExpandedStatsDisplay } = await import('../src/play/ExpandedStatsDisplay.js');
const { default: ScoreDisplay } = await import('../src/play/ScoreDisplay.js');
const { default: InputStatistics } = await import('../src/input/InputStatistics.js');
const { default: SaveManager } = await import('../src/data/SaveManager.js');
const { default: ResultState } = await import('../src/ui/ResultState.js');

// Minimum iterations per property test
const NUM_RUNS = 100;

// Mock scene factory
const createMockScene = () => ({
  cameras: {
    main: { setScroll: vi.fn() },
    add: vi.fn(() => ({ setScroll: vi.fn() }))
  },
  scale: { width: 1280, height: 720 },
  time: { delayedCall: vi.fn((delay, cb) => cb()) },
  add: {
    text: vi.fn((x, y, text, style) => new Phaser.GameObjects.Text(null, x, y, text, style))
  }
});

// ========================================
// ARBITRARIES
// ========================================

const judgementArb = fc.constantFrom('killer', 'sick', 'good', 'bad', 'shit');
const timingArb = fc.double({ min: -160, max: 160, noNaN: true });
const noteHitArb = fc.record({
  timing: timingArb,
  judgement: judgementArb
});
const noteHitArrayArb = fc.array(noteHitArb, { minLength: 1, maxLength: 50 });

// TimingStats arbitrary for Property 5
const timingStatsArb = fc.record({
  offsets: fc.array(timingArb, { minLength: 1, maxLength: 50 }),
  judgements: fc.array(
    fc.record({
      judgement: judgementArb,
      offset: timingArb
    }),
    { minLength: 1, maxLength: 50 }
  )
}).map(({ offsets, judgements }) => {
  // Build a realistic TimingStats from generated data
  const allOffsets = offsets;
  const earlyCount = allOffsets.filter(o => o < 0).length;
  const lateCount = allOffsets.filter(o => o > 0).length;
  const perfectCount = allOffsets.filter(o => o === 0).length;
  const sum = allOffsets.reduce((a, b) => a + b, 0);
  const averageOffset = allOffsets.length > 0 ? sum / allOffsets.length : 0;

  // Build byJudgement from judgements array
  const byJudgement = {};
  for (const { judgement, offset } of judgements) {
    if (!byJudgement[judgement]) {
      byJudgement[judgement] = { count: 0, totalOffset: 0 };
    }
    byJudgement[judgement].count++;
    byJudgement[judgement].totalOffset += offset;
  }
  // Convert to final format
  const byJudgementFinal = {};
  for (const [j, data] of Object.entries(byJudgement)) {
    byJudgementFinal[j] = {
      count: data.count,
      avgOffset: data.count > 0 ? data.totalOffset / data.count : 0
    };
  }

  return {
    averageOffset,
    earlyCount,
    lateCount,
    perfectCount,
    offsets: allOffsets,
    byJudgement: byJudgementFinal
  };
});


// ========================================
// PROPERTY TESTS
// ========================================

describe('Competitive Stats Integration Property Tests', () => {
  let mockScene;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockScene = createMockScene();
    SaveManager.resetInstance();
  });

  afterEach(() => {
    SaveManager.resetInstance();
    vi.restoreAllMocks();
  });

  // ========================================
  // Property 1: Feature-flag-gated HUD selection
  // Tag: Feature: competitive-stats-integration, Property 1: Feature-flag-gated HUD selection
  // **Validates: Requirements 2.1, 2.2, 4.1, 4.2, 4.3**
  // ========================================
  describe('Property 1: Feature-flag-gated HUD selection', () => {
    it('HUD type and InputStatistics presence SHALL match the truth table for any feature flag combination', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // expandedStats flag value
          fc.boolean(), // hasLevelSystem
          (expandedStats, hasLevelSystem) => {
            const playState = new PlayState(mockScene);

            // Set up LevelSystem based on generated values
            if (hasLevelSystem) {
              playState.levelSystem = {
                isFeatureEnabled: (name) => {
                  if (name === 'expandedStats') return expandedStats;
                  return false;
                }
              };
            } else {
              playState.levelSystem = null;
            }

            // Initialize PlayState (triggers competitive stats check)
            playState.init({ song: {} });

            // Create HUD display
            playState.createHUDDisplay();

            if (!hasLevelSystem) {
              // No LevelSystem → defaults to enabled
              expect(playState.competitiveStatsEnabled).toBe(true);
              expect(playState.inputStatistics).toBeInstanceOf(InputStatistics);
              expect(playState.scoreDisplay).toBeInstanceOf(ExpandedStatsDisplay);
            } else if (expandedStats) {
              // LevelSystem present, flag enabled
              expect(playState.competitiveStatsEnabled).toBe(true);
              expect(playState.inputStatistics).toBeInstanceOf(InputStatistics);
              expect(playState.scoreDisplay).toBeInstanceOf(ExpandedStatsDisplay);
            } else {
              // LevelSystem present, flag disabled
              expect(playState.competitiveStatsEnabled).toBe(false);
              expect(playState.inputStatistics).toBeNull();
              expect(playState.scoreDisplay).toBeInstanceOf(ScoreDisplay);
              // Ensure it's NOT an ExpandedStatsDisplay (which extends ScoreDisplay)
              expect(playState.scoreDisplay).not.toBeInstanceOf(ExpandedStatsDisplay);
            }

            // Clean up
            playState.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 2: NOTE_HIT data flows to both InputStatistics and ExpandedStatsDisplay
  // Tag: Feature: competitive-stats-integration, Property 2: NOTE_HIT data flows to both targets
  // **Validates: Requirements 1.2, 2.3**
  // ========================================
  describe('Property 2: NOTE_HIT data flows to both targets', () => {
    it('InputStatistics offsets SHALL contain all timings and ExpandedStatsDisplay judgement counts SHALL match', () => {
      fc.assert(
        fc.property(
          noteHitArrayArb,
          (noteHits) => {
            const playState = new PlayState(mockScene);
            playState.levelSystem = null; // freeplay → competitive enabled
            playState.init({ song: {} });
            playState.createHUDDisplay();

            // Capture the event handlers that PlayState registered
            const onNoteHitHandler = playState._onNoteHitForStats;
            expect(onNoteHitHandler).toBeDefined();

            // Simulate NOTE_HIT events
            for (const hit of noteHits) {
              onNoteHitHandler({
                timing: hit.timing,
                judgement: hit.judgement
              });
            }

            // Verify InputStatistics received all timings
            const stats = playState.inputStatistics.getStats();
            expect(stats.offsets.length).toBe(noteHits.length);
            for (let i = 0; i < noteHits.length; i++) {
              expect(stats.offsets[i]).toBe(noteHits[i].timing);
            }

            // Verify ExpandedStatsDisplay judgement counts match
            // Note: ExpandedStatsDisplay only tracks sick/good/bad/shit (not killer)
            const expectedJudgements = { sick: 0, good: 0, bad: 0, shit: 0 };
            for (const hit of noteHits) {
              const j = hit.judgement.toLowerCase();
              if (expectedJudgements.hasOwnProperty(j)) {
                expectedJudgements[j]++;
              }
            }

            const actualJudgements = playState.scoreDisplay.getJudgements();
            expect(actualJudgements.sick).toBe(expectedJudgements.sick);
            expect(actualJudgements.good).toBe(expectedJudgements.good);
            expect(actualJudgements.bad).toBe(expectedJudgements.bad);
            expect(actualJudgements.shit).toBe(expectedJudgements.shit);

            // Clean up
            playState.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 3: Combo break counter increments on COMBO_BREAK
  // Tag: Feature: competitive-stats-integration, Property 3: Combo break counter increments
  // **Validates: Requirements 2.4**
  // ========================================
  describe('Property 3: Combo break counter increments', () => {
    it('after N COMBO_BREAK events, getComboBreaks() SHALL equal N', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (n) => {
            const playState = new PlayState(mockScene);
            playState.levelSystem = null; // freeplay → competitive enabled
            playState.init({ song: {} });
            playState.createHUDDisplay();

            // Capture the combo break handler
            const onComboBreakHandler = playState._onComboBreakForStats;
            expect(onComboBreakHandler).toBeDefined();

            // Emit N COMBO_BREAK events
            for (let i = 0; i < n; i++) {
              onComboBreakHandler();
            }

            // Verify combo break count
            expect(playState.scoreDisplay.getComboBreaks()).toBe(n);

            // Clean up
            playState.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 4: ExpandedStatsDisplay visibility reflects SaveManager options
  // Tag: Feature: competitive-stats-integration, Property 4: Visibility reflects SaveManager
  // **Validates: Requirements 2.6, 4.4**
  // ========================================
  describe('Property 4: Visibility reflects SaveManager', () => {
    it('ExpandedStatsDisplay visibilityOptions SHALL match SaveManager option values', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // showNPS
          fc.boolean(), // showGrade
          fc.boolean(), // showComboBreaks
          fc.boolean(), // showJudgements
          (showNPS, showGrade, showComboBreaks, showJudgements) => {
            // Configure SaveManager with generated values
            const saveManager = SaveManager.getInstance();
            saveManager.setOption('showNPS', showNPS, false);
            saveManager.setOption('showGrade', showGrade, false);
            saveManager.setOption('showComboBreaks', showComboBreaks, false);
            saveManager.setOption('showJudgements', showJudgements, false);

            const playState = new PlayState(mockScene);
            playState.levelSystem = null; // freeplay → competitive enabled
            playState.init({ song: {} });
            playState.createHUDDisplay();

            // Verify ExpandedStatsDisplay visibility matches SaveManager
            expect(playState.scoreDisplay).toBeInstanceOf(ExpandedStatsDisplay);
            const visibility = playState.scoreDisplay.visibilityOptions;
            expect(visibility.showNPS).toBe(showNPS);
            expect(visibility.showGrade).toBe(showGrade);
            expect(visibility.showComboBreaks).toBe(showComboBreaks);
            expect(visibility.showJudgements).toBe(showJudgements);

            // Clean up
            playState.destroy();
            SaveManager.resetInstance();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 5: ResultState timing analysis display completeness
  // Tag: Feature: competitive-stats-integration, Property 5: ResultState timing analysis completeness
  // **Validates: Requirements 3.2, 3.3, 3.4**
  // ========================================
  describe('Property 5: ResultState timing analysis completeness', () => {
    it('rendered text SHALL contain average offset with correct early/late label, ratio counts, and per-judgement averages', () => {
      fc.assert(
        fc.property(
          timingStatsArb,
          (timingStats) => {
            const resultState = new ResultState();

            // Initialize with timing stats
            resultState.init({
              score: 1000,
              tallies: { sick: 10, good: 5, bad: 2, shit: 1, missed: 0, combo: 0, maxCombo: 18, totalNotesHit: 18, totalNotes: 18 },
              timingStats
            });

            // Create the scene (triggers createTimingAnalysis)
            resultState.create();

            // Gather all created text content
            const allTexts = resultState._createdTexts.map(t => t.text);
            const allTextJoined = allTexts.join('\n');

            // 1. Verify average offset with correct early/late label
            const avgMs = timingStats.averageOffset;
            const expectedLabel = avgMs < 0 ? 'Early' : avgMs > 0 ? 'Late' : '';
            const expectedAvgStr = `${Math.abs(avgMs).toFixed(1)}ms`;

            expect(allTextJoined).toContain(expectedAvgStr);
            if (expectedLabel) {
              expect(allTextJoined).toContain(expectedLabel);
            }

            // 2. Verify early/late/perfect counts
            expect(allTextJoined).toContain(`Early: ${timingStats.earlyCount}`);
            expect(allTextJoined).toContain(`Late: ${timingStats.lateCount}`);
            expect(allTextJoined).toContain(`Perfect: ${timingStats.perfectCount}`);

            // 3. Verify per-judgement averages for judgements with hits
            for (const [judgement, data] of Object.entries(timingStats.byJudgement)) {
              if (data.count > 0) {
                const jAvgStr = `${Math.abs(data.avgOffset).toFixed(1)}ms`;
                expect(allTextJoined).toContain(judgement);
                expect(allTextJoined).toContain(jAvgStr);
                expect(allTextJoined).toContain(`${data.count} hits`);
              }
            }

            // Clean up
            resultState.shutdown();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

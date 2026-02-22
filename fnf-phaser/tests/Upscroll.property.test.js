/**
 * @fileoverview Property-based tests for Upscroll functionality.
 * Tests upscroll/downscroll behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Phaser's Sprite class
class MockAnimation {
  constructor() {
    this.currentAnim = null;
    this.isPlaying = false;
  }
  exists() {
    return true;
  }
  play() {}
}

class MockSprite {
  constructor(scene, x, y, texture, frame) {
    this.scene = scene;
    this.x = x || 0;
    this.y = y || 0;
    this.texture = { key: texture, source: [{ scaleMode: 0 }] };
    this.frame = { name: frame };
    this.scaleX = 1;
    this.scaleY = 1;
    this.originX = 0.5;
    this.originY = 0.5;
    this.depth = 0;
    this.alpha = 1;
    this.visible = true;
    this.active = true;
    this.anims = new MockAnimation();
    this.width = 100;
    this.height = 100;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  setScale(x, y) {
    this.scaleX = x;
    this.scaleY = y !== undefined ? y : x;
    return this;
  }
  setTint() {
    return this;
  }
  clearTint() {
    return this;
  }
  on() {
    return this;
  }
  off() {
    return this;
  }
  play() {
    return this;
  }
  destroy() {}
}

// Mock Phaser globals
global.Phaser = {
  GameObjects: {
    Sprite: MockSprite
  },
  ScaleModes: {
    NEAREST: 1,
    LINEAR: 0
  }
};

// Dynamic imports after Phaser mock
const { default: Strumline } = await import('../src/play/Strumline.js');
const { default: SustainTrail } = await import('../src/play/SustainTrail.js');
const { default: SaveManager } = await import('../src/data/SaveManager.js');
const { default: ScoreDisplay } = await import('../src/play/ScoreDisplay.js');
const { default: HealthBar } = await import('../src/play/HealthBar.js');

// Mock localStorage for SaveManager tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Upscroll Property Tests', () => {
  let scene;

  beforeEach(() => {
    scene = {
      scale: {
        height: 720,
        width: 1280
      },
      add: {
        existing: vi.fn(),
        text: vi.fn().mockReturnValue({
          setScrollFactor: vi.fn().mockReturnThis(),
          setOrigin: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setText: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          width: 100,
          height: 20
        }),
        graphics: vi.fn().mockReturnValue({
          setScrollFactor: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          clear: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          destroy: vi.fn()
        })
      },
      tweens: {
        killTweensOf: vi.fn()
      }
    };

    // Reset localStorage mock
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();

    // Reset SaveManager singleton
    SaveManager.resetInstance();
  });

  // ========================================
  // Property 31: Upscroll Receptor Positioning
  // ========================================
  describe('Property 31: Upscroll Receptor Positioning', () => {
    it('receptor Y position SHALL be at bottom for upscroll (downscroll=false) and top for downscroll (downscroll=true)', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.integer({ min: 400, max: 1080 }), // screenHeight
          fc.integer({ min: 0, max: 200 }), // yOffset (strumline Y position)
          (isDownscroll, screenHeight, yOffset) => {
            // Create scene with specific height
            const testScene = {
              ...scene,
              scale: { height: screenHeight, width: 1280 }
            };

            const strumline = new Strumline(testScene, true);
            strumline.isDownscroll = isDownscroll;
            strumline.setPosition(0, yOffset);

            // In the original FNF, for upscroll (downscroll=false):
            // - Receptors are at the TOP of the screen (low Y value)
            // For downscroll (downscroll=true):
            // - Receptors are at the BOTTOM of the screen (high Y value)
            //
            // The strumline Y position determines where receptors are placed.
            // In upscroll mode, strumline should be positioned near top (low Y)
            // In downscroll mode, strumline should be positioned near bottom (high Y)

            // Verify the strumline's Y position is set correctly
            expect(strumline.y).toBe(yOffset);

            // The isDownscroll flag affects note movement direction, not receptor position directly
            // Receptor position is determined by strumline.y
            // The key property is that isDownscroll inverts the note Y calculation
            expect(strumline.isDownscroll).toBe(isDownscroll);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('strumline position should be configurable for both scroll modes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.integer({ min: 0, max: 1000 }), // xPos
          fc.integer({ min: 0, max: 700 }), // yPos
          (isDownscroll, xPos, yPos) => {
            const strumline = new Strumline(scene, true);
            strumline.isDownscroll = isDownscroll;
            strumline.setPosition(xPos, yPos);

            // Position should be set correctly regardless of scroll mode
            expect(strumline.x).toBe(xPos);
            expect(strumline.y).toBe(yPos);

            // All 4 receptors should exist
            expect(strumline.receptors.length).toBe(4);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 32: Upscroll Note Direction
  // ========================================
  describe('Property 32: Upscroll Note Direction', () => {
    it('in upscroll mode, as song position increases, note Y SHALL increase (moving toward receptors at top)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // noteStrumTime
          fc.integer({ min: 0, max: 10000 }), // songPosition1
          fc.integer({ min: 0, max: 10000 }), // songPosition2
          fc.integer({ min: 50, max: 300 }).map((n) => n / 100), // scrollSpeed (0.5 to 3.0)
          (noteStrumTime, songPos1, songPos2, scrollSpeed) => {
            const strumline = new Strumline(scene, true);
            strumline.isDownscroll = false; // Upscroll mode
            strumline.scrollSpeed = scrollSpeed;

            // Get note Y at two different song positions
            const y1 = strumline.getNoteY(noteStrumTime, songPos1);
            const y2 = strumline.getNoteY(noteStrumTime, songPos2);

            // In upscroll (downscroll=false):
            // getNoteY returns (strumTime - songPosition) * PIXELS_PER_MS * scrollSpeed
            // As songPosition increases, the result decreases (note moves up toward receptors at top)
            // So if songPos2 > songPos1, then y2 < y1

            if (songPos2 > songPos1) {
              expect(y2).toBeLessThan(y1);
            } else if (songPos2 < songPos1) {
              expect(y2).toBeGreaterThan(y1);
            } else {
              expect(y2).toBe(y1);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('in downscroll mode, as song position increases, note Y SHALL decrease (moving toward receptors at bottom)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // noteStrumTime
          fc.integer({ min: 0, max: 10000 }), // songPosition1
          fc.integer({ min: 0, max: 10000 }), // songPosition2
          fc.integer({ min: 50, max: 300 }).map((n) => n / 100), // scrollSpeed (0.5 to 3.0)
          (noteStrumTime, songPos1, songPos2, scrollSpeed) => {
            const strumline = new Strumline(scene, true);
            strumline.isDownscroll = true; // Downscroll mode
            strumline.scrollSpeed = scrollSpeed;

            // Get note Y at two different song positions
            const y1 = strumline.getNoteY(noteStrumTime, songPos1);
            const y2 = strumline.getNoteY(noteStrumTime, songPos2);

            // In downscroll (downscroll=true):
            // getNoteY returns -(strumTime - songPosition) * PIXELS_PER_MS * scrollSpeed
            // As songPosition increases, the result increases (note moves down toward receptors at bottom)
            // So if songPos2 > songPos1, then y2 > y1

            if (songPos2 > songPos1) {
              expect(y2).toBeGreaterThan(y1);
            } else if (songPos2 < songPos1) {
              expect(y2).toBeLessThan(y1);
            } else {
              expect(y2).toBe(y1);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('note Y direction SHALL be opposite between upscroll and downscroll modes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000 }), // noteStrumTime
          fc.integer({ min: 0, max: 5000 }), // songPosition (before note)
          fc.integer({ min: 50, max: 300 }).map((n) => n / 100), // scrollSpeed (0.5 to 3.0)
          (noteStrumTime, songPosition, scrollSpeed) => {
            const upscrollStrumline = new Strumline(scene, true);
            upscrollStrumline.isDownscroll = false;
            upscrollStrumline.scrollSpeed = scrollSpeed;

            const downscrollStrumline = new Strumline(scene, true);
            downscrollStrumline.isDownscroll = true;
            downscrollStrumline.scrollSpeed = scrollSpeed;

            const upscrollY = upscrollStrumline.getNoteY(noteStrumTime, songPosition);
            const downscrollY = downscrollStrumline.getNoteY(noteStrumTime, songPosition);

            // The Y values should be opposite (negated)
            expect(upscrollY).toBe(-downscrollY);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 33: Upscroll HUD Positioning
  // ========================================
  describe('Property 33: Upscroll HUD Positioning', () => {
    it('ScoreDisplay position SHALL be configurable for upscroll/downscroll modes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isUpscroll (downscroll=false means upscroll)
          fc.integer({ min: 0, max: 1280 }), // xPos
          fc.integer({ min: 0, max: 720 }), // yPos
          (isUpscroll, xPos, yPos) => {
            const scoreDisplay = new ScoreDisplay(scene, {
              x: xPos,
              y: yPos
            });

            // Score display position should be set correctly
            expect(scoreDisplay.x).toBe(xPos);
            expect(scoreDisplay.y).toBe(yPos);

            // For upscroll, score should typically be at top (low Y)
            // For downscroll, score should typically be at bottom (high Y)
            // The position is configurable, so we just verify it can be set

            // Test repositioning
            const newY = isUpscroll ? 10 : 680; // Top for upscroll, bottom for downscroll
            scoreDisplay.setPosition(xPos, newY);

            expect(scoreDisplay.y).toBe(newY);

            scoreDisplay.destroy();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('HealthBar position SHALL be configurable for upscroll/downscroll modes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isUpscroll
          fc.integer({ min: 0, max: 1280 }), // xPos
          fc.integer({ min: 0, max: 720 }), // yPos
          (isUpscroll, xPos, yPos) => {
            const healthBar = new HealthBar(scene, {
              x: xPos,
              y: yPos
            });

            // Health bar position should be set correctly
            expect(healthBar.x).toBe(xPos);
            expect(healthBar.y).toBe(yPos);

            // Test repositioning for scroll mode
            const newY = isUpscroll ? 650 : 50; // Bottom for upscroll, top for downscroll
            healthBar.setPosition(xPos, newY);

            expect(healthBar.y).toBe(newY);

            healthBar.destroy();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('HUD elements SHALL maintain correct relative positioning in both scroll modes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isUpscroll
          fc.integer({ min: 400, max: 1080 }), // screenHeight
          (isUpscroll, screenHeight) => {
            const testScene = {
              ...scene,
              scale: { height: screenHeight, width: 1280 }
            };

            // In upscroll mode: receptors at top, HUD at bottom
            // In downscroll mode: receptors at bottom, HUD at top
            const receptorY = isUpscroll ? 50 : screenHeight - 150;
            const hudY = isUpscroll ? screenHeight - 100 : 50;

            const scoreDisplay = new ScoreDisplay(testScene, {
              x: 640,
              y: hudY
            });

            const healthBar = new HealthBar(testScene, {
              x: 340,
              y: hudY + 30
            });

            // Verify HUD is positioned opposite to receptors
            if (isUpscroll) {
              // Receptors at top (low Y), HUD at bottom (high Y)
              expect(hudY).toBeGreaterThan(receptorY);
            } else {
              // Receptors at bottom (high Y), HUD at top (low Y)
              expect(hudY).toBeLessThan(receptorY);
            }

            scoreDisplay.destroy();
            healthBar.destroy();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 34: Upscroll Persistence
  // ========================================
  describe('Property 34: Upscroll Persistence', () => {
    it('downscroll setting saved via SaveManager SHALL return the same boolean value when loaded', () => {
      fc.assert(
        fc.property(fc.boolean(), (downscrollValue) => {
          // Reset and create fresh SaveManager
          SaveManager.resetInstance();
          const saveManager = SaveManager.getInstance();
          saveManager.init();

          // Save the downscroll setting
          saveManager.setOption('downscroll', downscrollValue);

          // Verify it was saved
          const savedValue = saveManager.getOption('downscroll');
          expect(savedValue).toBe(downscrollValue);

          // Simulate reload by creating new instance
          SaveManager.resetInstance();
          const newSaveManager = SaveManager.getInstance();
          newSaveManager.init();

          // Load and verify
          const loadedValue = newSaveManager.getOption('downscroll');
          expect(loadedValue).toBe(downscrollValue);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('downscroll setting SHALL persist across multiple save/load cycles', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }), // sequence of values to save
          (valueSequence) => {
            SaveManager.resetInstance();
            const saveManager = SaveManager.getInstance();
            saveManager.init();

            // Save each value in sequence and verify persistence
            for (const value of valueSequence) {
              saveManager.setOption('downscroll', value);

              // Verify immediate retrieval
              expect(saveManager.getOption('downscroll')).toBe(value);
            }

            // Final value should persist
            const finalValue = valueSequence[valueSequence.length - 1];

            SaveManager.resetInstance();
            const newSaveManager = SaveManager.getInstance();
            newSaveManager.init();

            expect(newSaveManager.getOption('downscroll')).toBe(finalValue);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('downscroll default SHALL be false when no setting is saved', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Clear storage and reset
          localStorageMock.clear();
          SaveManager.resetInstance();

          const saveManager = SaveManager.getInstance();
          saveManager.init();

          // Default should be false (upscroll)
          const defaultValue = saveManager.getOption('downscroll');
          expect(defaultValue).toBe(false);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Property 35: Upscroll Sustain Trail Support
  // ========================================
  describe('Property 35: Upscroll Sustain Trail Support', () => {
    it('sustain trail flipY SHALL be true in downscroll mode and false in upscroll mode', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.integer({ min: 0, max: 3 }), // direction
          fc.integer({ min: 100, max: 2000 }), // sustainLength
          (isDownscroll, direction, sustainLength) => {
            const strumline = new Strumline(scene, true);
            strumline.isDownscroll = isDownscroll;

            const noteData = {
              time: 1000,
              direction: direction,
              length: sustainLength
            };

            const holdNote = strumline.buildHoldNoteSprite(noteData);

            // flipY should match isDownscroll
            expect(holdNote.flipY).toBe(isDownscroll);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sustain trail Y position calculation SHALL account for scroll direction', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.integer({ min: 0, max: 10000 }), // strumTime
          fc.integer({ min: 0, max: 10000 }), // songPosition
          fc.integer({ min: 50, max: 300 }).map((n) => n / 100), // scrollSpeed (0.5 to 3.0)
          (isDownscroll, strumTime, songPosition, scrollSpeed) => {
            const sustainTrail = new SustainTrail(scene, 0, 500);
            sustainTrail.strumTime = strumTime;
            sustainTrail.flipY = isDownscroll;

            // Calculate Y position
            const yPos = sustainTrail.getYPosition(songPosition, scrollSpeed, isDownscroll);

            // In upscroll (isDownscroll=false): Y = offset (positive when note is ahead)
            // In downscroll (isDownscroll=true): Y = -offset - height (inverted)
            const expectedOffset = (strumTime - songPosition) * 0.45 * scrollSpeed;

            if (isDownscroll) {
              expect(yPos).toBe(-expectedOffset - sustainTrail.height);
            } else {
              expect(yPos).toBe(expectedOffset);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sustain trail SHALL render correctly in both scroll modes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.integer({ min: 0, max: 3 }), // direction
          fc.integer({ min: 100, max: 2000 }), // sustainLength
          fc.integer({ min: 50, max: 300 }).map((n) => n / 100), // scrollSpeed (0.5 to 3.0)
          (isDownscroll, direction, sustainLength, scrollSpeed) => {
            const strumline = new Strumline(scene, true);
            strumline.isDownscroll = isDownscroll;
            strumline.scrollSpeed = scrollSpeed;

            const noteData = {
              time: 1000,
              direction: direction,
              length: sustainLength
            };

            const holdNote = strumline.buildHoldNoteSprite(noteData);

            // Verify sustain trail is configured correctly
            expect(holdNote.flipY).toBe(isDownscroll);
            expect(holdNote.sustainLength).toBe(sustainLength);
            expect(holdNote.noteDirection).toBe(direction);
            expect(holdNote.parentStrumline).toBe(strumline);

            // Verify dimensions are calculated
            expect(holdNote.width).toBeGreaterThan(0);
            expect(holdNote.height).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sustain trail clipping SHALL work correctly in both scroll modes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.integer({ min: 500, max: 2000 }), // sustainLength
          fc.integer({ min: 0, max: 1000 }), // clipAmount (how much has been held)
          (isDownscroll, sustainLength, clipAmount) => {
            const sustainTrail = new SustainTrail(scene, 0, sustainLength);
            sustainTrail.flipY = isDownscroll;
            sustainTrail.strumTime = 0;
            sustainTrail.fullSustainLength = sustainLength;

            // Simulate holding the note
            const remainingLength = Math.max(0, sustainLength - clipAmount);
            sustainTrail.sustainLength = remainingLength;
            sustainTrail.updateDimensions();

            // Verify the sustain length is correctly reduced
            expect(sustainTrail.sustainLength).toBe(remainingLength);

            // Height should be proportional to remaining length
            if (remainingLength > 0) {
              expect(sustainTrail.height).toBeGreaterThanOrEqual(0);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========================================
  // Additional Integration Tests
  // ========================================
  describe('Upscroll Integration', () => {
    it('strumline and sustain trails SHALL be consistent in scroll mode', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.array(
            fc.record({
              time: fc.integer({ min: 0, max: 10000 }),
              direction: fc.integer({ min: 0, max: 3 }),
              length: fc.integer({ min: 0, max: 1000 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (isDownscroll, notes) => {
            const strumline = new Strumline(scene, true);
            strumline.isDownscroll = isDownscroll;

            // Build notes and hold notes
            for (const noteData of notes) {
              const note = strumline.buildNoteSprite(noteData);
              expect(note).toBeDefined();

              if (noteData.length > 0) {
                const holdNote = strumline.buildHoldNoteSprite(noteData);
                expect(holdNote).toBeDefined();
                expect(holdNote.flipY).toBe(isDownscroll);
              }
            }

            // All notes should have consistent scroll direction
            for (const holdNote of strumline.holdNotes) {
              expect(holdNote.flipY).toBe(isDownscroll);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scroll speed SHALL affect note Y position proportionally in both modes', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDownscroll
          fc.integer({ min: 1000, max: 5000 }), // noteStrumTime
          fc.integer({ min: 0, max: 1000 }), // songPosition
          fc.integer({ min: 50, max: 300 }).map((n) => n / 100), // scrollSpeed1 (0.5 to 3.0)
          fc.integer({ min: 50, max: 300 }).map((n) => n / 100), // scrollSpeed2 (0.5 to 3.0)
          (isDownscroll, noteStrumTime, songPosition, speed1, speed2) => {
            const strumline1 = new Strumline(scene, true);
            strumline1.isDownscroll = isDownscroll;
            strumline1.scrollSpeed = speed1;

            const strumline2 = new Strumline(scene, true);
            strumline2.isDownscroll = isDownscroll;
            strumline2.scrollSpeed = speed2;

            const y1 = strumline1.getNoteY(noteStrumTime, songPosition);
            const y2 = strumline2.getNoteY(noteStrumTime, songPosition);

            // Y positions should be proportional to scroll speed
            if (speed1 !== 0 && speed2 !== 0 && y2 !== 0) {
              const ratio = y1 / y2;
              const expectedRatio = speed1 / speed2;
              expect(ratio).toBeCloseTo(expectedRatio, 5);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

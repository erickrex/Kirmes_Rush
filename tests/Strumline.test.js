/**
 * @fileoverview Unit tests for Strumline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser's Sprite class - MUST be set up before importing
class MockAnimation {
  constructor() {
    this.currentAnim = null;
    this.isPlaying = false;
    this.animationManager = {
      exists: vi.fn().mockReturnValue(true),
      get: vi.fn().mockReturnValue(null)
    };
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
    this._eventListeners = new Map();
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

  on(event, callback, context) {
    this._eventListeners.set(event, { callback, context });
    return this;
  }

  off() {
    return this;
  }

  play(config) {
    if (typeof config === 'object') {
      this.anims.currentAnim = { key: config.key };
    }
    this.anims.isPlaying = true;
    return this;
  }

  destroy() {}
}

// Mock Phaser globals - MUST be set up before importing
global.Phaser = {
  GameObjects: {
    Sprite: MockSprite
  },
  ScaleModes: {
    NEAREST: 1,
    LINEAR: 0
  }
};

vi.mock('phaser', () => ({
  default: globalThis.Phaser
}));

// Dynamic import AFTER Phaser mock is set up
const { default: Strumline } = await import('../src/play/Strumline.js');

describe('Strumline', () => {
  let scene;
  let strumline;

  beforeEach(() => {
    scene = {
      scale: {
        height: 720
      },
      add: {
        existing: vi.fn()
      },
      tweens: {
        killTweensOf: vi.fn()
      }
    };
    strumline = new Strumline(scene, true);
  });

  describe('Constructor', () => {
    it('should initialize with isPlayer flag', () => {
      expect(strumline.isPlayer).toBe(true);

      const opponentStrumline = new Strumline(scene, false);
      expect(opponentStrumline.isPlayer).toBe(false);
    });

    it('should initialize with default scroll speed', () => {
      expect(strumline.scrollSpeed).toBe(1.0);
    });

    it('should initialize with custom scroll speed', () => {
      const fastStrumline = new Strumline(scene, true, null, 2.0);
      expect(fastStrumline.scrollSpeed).toBe(2.0);
    });

    it('should create 4 receptors', () => {
      expect(strumline.receptors).toHaveLength(4);
    });

    it('should initialize held keys to false', () => {
      expect(strumline.heldKeys).toEqual([false, false, false, false]);
    });

    it('should initialize empty note arrays', () => {
      expect(strumline.notes).toEqual([]);
      expect(strumline.holdNotes).toEqual([]);
      expect(strumline.noteData).toEqual([]);
    });
  });

  describe('Static Constants', () => {
    it('should have DIRECTIONS', () => {
      expect(Strumline.DIRECTIONS).toEqual([0, 1, 2, 3]);
    });

    it('should have STRUMLINE_SIZE', () => {
      expect(Strumline.STRUMLINE_SIZE).toBe(104);
    });

    it('should have NOTE_SPACING', () => {
      expect(Strumline.NOTE_SPACING).toBe(112);
    });

    it('should have KEY_COUNT', () => {
      expect(Strumline.KEY_COUNT).toBe(4);
    });
  });

  describe('Position', () => {
    it('should set position', () => {
      strumline.setPosition(100, 50);

      expect(strumline.x).toBe(100);
      expect(strumline.y).toBe(50);
    });

    it('should return this for chaining', () => {
      const result = strumline.setPosition(0, 0);
      expect(result).toBe(strumline);
    });

    it('should calculate X position for each direction', () => {
      expect(strumline.getXPos(0)).toBe(0);
      expect(strumline.getXPos(1)).toBe(112);
      expect(strumline.getXPos(2)).toBe(224);
      expect(strumline.getXPos(3)).toBe(336);
    });

    it('should calculate width', () => {
      expect(strumline.width).toBe(448); // 4 * 112
    });
  });

  describe('Scroll Speed', () => {
    it('should set scroll speed', () => {
      strumline.setScrollSpeed(1.5);
      expect(strumline.scrollSpeed).toBe(1.5);
    });

    it('should return this for chaining', () => {
      const result = strumline.setScrollSpeed(1.0);
      expect(result).toBe(strumline);
    });

    it('should reset scroll speed', () => {
      strumline.scrollSpeed = 2.0;
      strumline.resetScrollSpeed(1.0);
      expect(strumline.scrollSpeed).toBe(1.0);
    });
  });

  describe('Note Data', () => {
    it('should apply note data', () => {
      const data = [
        { time: 1000, direction: 0 },
        { time: 500, direction: 1 },
        { time: 2000, direction: 2 }
      ];

      strumline.applyNoteData(data);

      expect(strumline.noteData).toHaveLength(3);
      expect(strumline.nextNoteIndex).toBe(0);
      // Should be sorted by time
      expect(strumline.noteData[0].time).toBe(500);
      expect(strumline.noteData[1].time).toBe(1000);
      expect(strumline.noteData[2].time).toBe(2000);
    });

    it('should add single note data', () => {
      strumline.applyNoteData([{ time: 1000, direction: 0 }]);
      strumline.addNoteData({ time: 500, direction: 1 });

      expect(strumline.noteData).toHaveLength(2);
      expect(strumline.noteData[0].time).toBe(500);
    });

    it('should not add null note data', () => {
      strumline.applyNoteData([]);
      strumline.addNoteData(null);

      expect(strumline.noteData).toHaveLength(0);
    });
  });

  describe('Key Input', () => {
    it('should press key', () => {
      strumline.pressKey(0);
      expect(strumline.heldKeys[0]).toBe(true);
    });

    it('should release key', () => {
      strumline.pressKey(0);
      strumline.releaseKey(0);
      expect(strumline.heldKeys[0]).toBe(false);
    });

    it('should check if key is held', () => {
      expect(strumline.isKeyHeld(0)).toBe(false);
      strumline.pressKey(0);
      expect(strumline.isKeyHeld(0)).toBe(true);
    });

    it('should return false for invalid direction', () => {
      expect(strumline.isKeyHeld(99)).toBe(false);
    });
  });

  describe('Receptor Controls', () => {
    it('should get receptor by direction', () => {
      const receptor = strumline.getByDirection(2);
      expect(receptor.direction).toBe(2);
    });

    it('should play static animation', () => {
      strumline.playStatic(0);
      expect(strumline.receptors[0].state).toBe('static');
    });

    it('should play press animation', () => {
      strumline.playPress(1);
      expect(strumline.receptors[1].state).toBe('press');
    });

    it('should play confirm animation', () => {
      strumline.playConfirm(2);
      expect(strumline.receptors[2].state).toBe('confirm');
    });

    it('should play hold confirm animation', () => {
      strumline.holdConfirm(3);
      expect(strumline.receptors[3].state).toBe('confirm');
    });

    it('should check if receptor is in confirm state', () => {
      expect(strumline.isConfirm(0)).toBe(false);
      strumline.playConfirm(0);
      expect(strumline.isConfirm(0)).toBe(true);
    });

    it('should get receptor state', () => {
      expect(strumline.getReceptorState(0)).toBe('static');
      strumline.playPress(0);
      expect(strumline.getReceptorState(0)).toBe('press');
    });
  });

  describe('Note Building', () => {
    it('should build note sprite', () => {
      const noteData = { time: 1000, direction: 2, length: 0 };
      const note = strumline.buildNoteSprite(noteData);

      expect(note).toBeDefined();
      expect(note.noteData).toBe(noteData);
      expect(note.strumline).toBe(strumline);
      expect(strumline.notes).toContain(note);
    });

    it('should recycle existing note sprites', () => {
      const noteData1 = { time: 1000, direction: 0, length: 0 };
      const noteData2 = { time: 2000, direction: 1, length: 0 };

      const note1 = strumline.buildNoteSprite(noteData1);
      note1.kill();

      const note2 = strumline.buildNoteSprite(noteData2);

      // Should reuse the same note
      expect(note2).toBe(note1);
      expect(strumline.notes).toHaveLength(1);
    });

    it('should build hold note sprite', () => {
      const noteData = { time: 1000, direction: 1, length: 500 };
      const holdNote = strumline.buildHoldNoteSprite(noteData);

      expect(holdNote).toBeDefined();
      expect(holdNote.noteData).toBe(noteData);
      expect(holdNote.parentStrumline).toBe(strumline);
      expect(strumline.holdNotes).toContain(holdNote);
    });

    it('should recycle existing hold note sprites', () => {
      const noteData1 = { time: 1000, direction: 0, length: 500 };
      const noteData2 = { time: 2000, direction: 1, length: 750 };

      const hold1 = strumline.buildHoldNoteSprite(noteData1);
      hold1.kill();

      const hold2 = strumline.buildHoldNoteSprite(noteData2);

      expect(hold2).toBe(hold1);
      expect(strumline.holdNotes).toHaveLength(1);
    });
  });

  describe('Note Queries', () => {
    beforeEach(() => {
      // Create some test notes
      const note1 = strumline.buildNoteSprite({ time: 1000, direction: 0, length: 0 });
      note1.mayHit = true;
      note1.alive = true;

      const note2 = strumline.buildNoteSprite({ time: 2000, direction: 1, length: 0 });
      note2.mayHit = false;
      note2.alive = true;

      const note3 = strumline.buildNoteSprite({ time: 3000, direction: 0, length: 0 });
      note3.hasBeenHit = true;
      note3.alive = true;
    });

    it('should get notes that may be hit', () => {
      const mayHit = strumline.getNotesMayHit();
      expect(mayHit).toHaveLength(1);
      expect(mayHit[0].strumTime).toBe(1000);
    });

    it('should get notes on screen', () => {
      const onScreen = strumline.getNotesOnScreen();
      expect(onScreen).toHaveLength(2); // note1 and note2 (note3 was hit)
    });

    it('should get closest note in direction', () => {
      // Need to ensure notes are alive and not hit
      strumline.notes[0].alive = true;
      strumline.notes[0].hasBeenHit = false;
      strumline.notes[0].hasMissed = false;

      const closest = strumline.getClosestNote(0, 1500);
      expect(closest).not.toBeNull();
      expect(closest.strumTime).toBe(1000);
    });

    it('should return null if no notes in direction', () => {
      const closest = strumline.getClosestNote(3, 1000);
      expect(closest).toBeNull();
    });

    it('should get note sprite by data', () => {
      const noteData = strumline.noteData[0];
      // Note: noteData is empty in this test, so we need to use the note's data
      const note = strumline.notes[0];
      const found = strumline.getNoteSprite(note.noteData);
      expect(found).toBe(note);
    });

    it('should return null for non-existent note data', () => {
      const found = strumline.getNoteSprite({ time: 9999, direction: 0 });
      expect(found).toBeNull();
    });
  });

  describe('Note Actions', () => {
    it('should hit note and remove it', () => {
      const note = strumline.buildNoteSprite({ time: 1000, direction: 0, length: 0 });

      strumline.hitNote(note, true);

      expect(note.hasBeenHit).toBe(true);
      expect(note.visible).toBe(false);
      expect(strumline.receptors[0].state).toBe('confirm');
    });

    it('should hit note without removing it', () => {
      const note = strumline.buildNoteSprite({ time: 1000, direction: 0, length: 0 });

      strumline.hitNote(note, false);

      expect(note.hasBeenHit).toBe(true);
      expect(note.alpha).toBe(0.5);
    });

    it('should hit note with hold note', () => {
      const noteData = { time: 1000, direction: 0, length: 500 };
      const note = strumline.buildNoteSprite(noteData);
      const holdNote = strumline.buildHoldNoteSprite(noteData);
      note.sustainTrail = holdNote;

      strumline.hitNote(note, true);

      expect(holdNote.hitNote).toBe(true);
      expect(holdNote.missedNote).toBe(false);
    });

    it('should kill note', () => {
      const note = strumline.buildNoteSprite({ time: 1000, direction: 0, length: 0 });
      note.alive = true;

      strumline.killNote(note);

      expect(note.visible).toBe(false);
      // Note: kill() sets alive to false via the NoteSprite.kill() method
    });

    it('should kill note with hold note', () => {
      const noteData = { time: 1000, direction: 0, length: 500 };
      const note = strumline.buildNoteSprite(noteData);
      const holdNote = strumline.buildHoldNoteSprite(noteData);
      note.sustainTrail = holdNote;

      strumline.killNote(note);

      expect(holdNote.missedNote).toBe(true);
      expect(holdNote.visible).toBe(false);
    });
  });

  describe('Position Calculations', () => {
    it('should calculate note Y for upscroll', () => {
      strumline.isDownscroll = false;
      strumline.scrollSpeed = 1.0;

      // (1000 - 500) * 0.45 * 1.0 = 225
      const y = strumline.getNoteY(1000, 500);
      expect(y).toBe(225);
    });

    it('should calculate note Y for downscroll', () => {
      strumline.isDownscroll = true;
      strumline.scrollSpeed = 1.0;

      // For downscroll, Y is negated
      const y = strumline.getNoteY(1000, 500);
      expect(y).toBe(-225);
    });

    it('should calculate render distance', () => {
      strumline.scrollSpeed = 1.0;
      const distance = strumline.getRenderDistanceMs();

      // 720 / 0.45 / 1.0 = 1600
      expect(distance).toBe(1600);
    });

    it('should use lower scroll speed for render distance', () => {
      strumline.scrollSpeed = 0.5;
      const distance = strumline.getRenderDistanceMs();

      // 720 / 0.45 / 0.5 = 3200
      expect(distance).toBe(3200);
    });

    it('should not divide by scroll speed > 1 for render distance', () => {
      strumline.scrollSpeed = 2.0;
      const distance = strumline.getRenderDistanceMs();

      // 720 / 0.45 / 1.0 = 1600 (uses 1.0, not 2.0)
      expect(distance).toBe(1600);
    });
  });

  describe('Cleanup', () => {
    it('should clean all notes', () => {
      strumline.buildNoteSprite({ time: 1000, direction: 0, length: 0 });
      strumline.buildNoteSprite({ time: 2000, direction: 1, length: 0 });
      strumline.buildHoldNoteSprite({ time: 3000, direction: 2, length: 500 });

      strumline.clean();

      // Notes should be killed but still in array
      expect(strumline.notes.every((n) => !n.alive)).toBe(true);
      expect(strumline.holdNotes.every((h) => !h.alive)).toBe(true);
      expect(strumline.heldKeys).toEqual([false, false, false, false]);
    });

    it('should handle skipped notes', () => {
      strumline.applyNoteData([
        { time: 1000, direction: 0 },
        { time: 2000, direction: 1 }
      ]);
      strumline.nextNoteIndex = 1;

      strumline.handleSkippedNotes();

      expect(strumline.nextNoteIndex).toBe(0);
    });

    it('should destroy strumline', () => {
      strumline.buildNoteSprite({ time: 1000, direction: 0, length: 0 });
      strumline.buildHoldNoteSprite({ time: 2000, direction: 1, length: 500 });

      strumline.destroy();

      expect(strumline.notes).toEqual([]);
      expect(strumline.holdNotes).toEqual([]);
      expect(strumline.receptors).toEqual([]);
      expect(strumline.noteData).toEqual([]);
      expect(strumline.scene).toBeNull();
    });
  });

  describe('Beat Hit', () => {
    it('should sort notes on beat hit', () => {
      const note1 = strumline.buildNoteSprite({ time: 2000, direction: 0, length: 0 });
      note1.alive = true;
      const note2 = strumline.buildNoteSprite({ time: 1000, direction: 1, length: 0 });
      note2.alive = true;

      strumline.onBeatHit(1);

      // After sorting, note2 (time 1000) should come before note1 (time 2000)
      expect(strumline.notes[0].strumTime).toBe(1000);
      expect(strumline.notes[1].strumTime).toBe(2000);
    });
  });

  describe('Hold Notes', () => {
    it('should get hold notes hit or missed', () => {
      const hold1 = strumline.buildHoldNoteSprite({ time: 1000, direction: 0, length: 500 });
      hold1.hitNote = true;

      const hold2 = strumline.buildHoldNoteSprite({ time: 2000, direction: 1, length: 500 });
      hold2.missedNote = true;

      const hold3 = strumline.buildHoldNoteSprite({ time: 3000, direction: 2, length: 500 });
      // Neither hit nor missed

      const result = strumline.getHoldNotesHitOrMissed();
      expect(result).toHaveLength(2);
    });

    it('should get hold note sprite by data', () => {
      const noteData = { time: 1000, direction: 0, length: 500 };
      const holdNote = strumline.buildHoldNoteSprite(noteData);

      const found = strumline.getHoldNoteSprite(noteData);
      expect(found).toBe(holdNote);
    });

    it('should return null for note data without length', () => {
      const noteData = { time: 1000, direction: 0, length: 0 };
      const found = strumline.getHoldNoteSprite(noteData);
      expect(found).toBeNull();
    });
  });

  describe('Downscroll', () => {
    it('should support downscroll mode', () => {
      strumline.isDownscroll = true;
      expect(strumline.isDownscroll).toBe(true);
    });

    it('should set flipY on hold notes in downscroll', () => {
      strumline.isDownscroll = true;
      const holdNote = strumline.buildHoldNoteSprite({ time: 1000, direction: 0, length: 500 });

      expect(holdNote.flipY).toBe(true);
    });
  });
});

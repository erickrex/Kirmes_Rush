/**
 * @fileoverview Unit tests for SustainTrail
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SustainTrail from '../src/play/SustainTrail.js';

describe('SustainTrail', () => {
  let scene;
  let trail;

  beforeEach(() => {
    scene = {
      add: {
        graphics: vi.fn().mockReturnValue({
          fillStyle: vi.fn(),
          fillRect: vi.fn(),
          destroy: vi.fn()
        })
      }
    };
    trail = new SustainTrail(scene, 0, 1000);
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(trail.noteDirection).toBe(0);
      expect(trail.sustainLength).toBe(1000);
      expect(trail.fullSustainLength).toBe(1000);
    });

    it('should initialize with specified direction', () => {
      const rightTrail = new SustainTrail(scene, 3, 500);
      expect(rightTrail.noteDirection).toBe(3);
      expect(rightTrail.sustainLength).toBe(500);
    });

    it('should initialize vertex arrays', () => {
      expect(trail.vertices).toHaveLength(16);
      expect(trail.uvtData).toHaveLength(16);
    });

    it('should initialize state flags', () => {
      expect(trail.hitNote).toBe(false);
      expect(trail.missedNote).toBe(false);
      expect(trail.handledMiss).toBe(false);
      expect(trail.visible).toBe(true);
      expect(trail.active).toBe(true);
      expect(trail.alive).toBe(true);
    });

    it('should initialize position to zero', () => {
      expect(trail.x).toBe(0);
      expect(trail.y).toBe(0);
    });
  });

  describe('Static Methods', () => {
    it('should calculate sustain height', () => {
      // PIXELS_PER_MS = 0.45
      // 1000ms * 0.45 * 1.0 scrollSpeed = 450
      const height = SustainTrail.sustainHeight(1000, 1.0);
      expect(height).toBe(450);
    });

    it('should calculate sustain height with scroll speed', () => {
      // 1000ms * 0.45 * 2.0 scrollSpeed = 900
      const height = SustainTrail.sustainHeight(1000, 2.0);
      expect(height).toBe(900);
    });

    it('should get direction name', () => {
      expect(SustainTrail.getDirectionName(0)).toBe('left');
      expect(SustainTrail.getDirectionName(1)).toBe('down');
      expect(SustainTrail.getDirectionName(2)).toBe('up');
      expect(SustainTrail.getDirectionName(3)).toBe('right');
    });

    it('should return default for invalid direction', () => {
      expect(SustainTrail.getDirectionName(99)).toBe('left');
    });
  });

  describe('Setup', () => {
    it('should setup with note data', () => {
      const noteData = {
        time: 2000,
        direction: 2,
        length: 750
      };

      trail.setup(noteData);

      expect(trail.noteData).toBe(noteData);
      expect(trail.strumTime).toBe(2000);
      expect(trail.noteDirection).toBe(2);
      expect(trail.sustainLength).toBe(750);
      expect(trail.fullSustainLength).toBe(750);
    });

    it('should return this for chaining', () => {
      const result = trail.setup({ time: 0, direction: 0, length: 100 });
      expect(result).toBe(trail);
    });

    it('should setup with note style', () => {
      const mockNoteStyle = {
        getHoldNoteAssetPath: vi.fn().mockReturnValue('hold-notes'),
        isHoldNotePixel: vi.fn().mockReturnValue(false),
        fetchHoldNoteScale: vi.fn().mockReturnValue(1.5),
        getHoldNoteOffsets: vi.fn().mockReturnValue([10, 20])
      };

      trail.setupHoldNoteGraphic(mockNoteStyle);

      expect(trail.textureKey).toBe('hold-notes');
      expect(trail.isPixel).toBe(false);
      expect(trail.zoom).toBe(1.5);
      expect(trail.noteStyleOffsets).toEqual([10, 20]);
    });

    it('should set pixel style values', () => {
      const mockNoteStyle = {
        isHoldNotePixel: vi.fn().mockReturnValue(true)
      };

      trail.setupHoldNoteGraphic(mockNoteStyle);

      expect(trail.isPixel).toBe(true);
      expect(trail.endOffset).toBe(1);
      expect(trail.bottomClip).toBe(1);
    });

    it('should set non-pixel style values', () => {
      const mockNoteStyle = {
        isHoldNotePixel: vi.fn().mockReturnValue(false)
      };

      trail.setupHoldNoteGraphic(mockNoteStyle);

      expect(trail.isPixel).toBe(false);
      expect(trail.endOffset).toBe(0.5);
      expect(trail.bottomClip).toBe(0.9);
    });
  });

  describe('Dimensions', () => {
    it('should update dimensions based on sustain length', () => {
      trail.sustainLength = 2000;
      trail.updateDimensions();

      // Height = 2000 * 0.45 * 1.0 = 900
      expect(trail.graphicHeight).toBe(900);
      expect(trail.height).toBe(900);
    });

    it('should update dimensions with scroll speed from strumline', () => {
      trail.parentStrumline = { scrollSpeed: 2.0 };
      trail.sustainLength = 1000;
      trail.updateDimensions();

      // Height = 1000 * 0.45 * 2.0 = 900
      expect(trail.graphicHeight).toBe(900);
    });

    it('should set sustain length and update dimensions', () => {
      trail.setSustainLength(500);

      expect(trail.sustainLength).toBe(500);
      // Height = 500 * 0.45 * 1.0 = 225
      expect(trail.graphicHeight).toBe(225);
    });

    it('should clamp negative sustain length to zero', () => {
      trail.setSustainLength(-100);

      expect(trail.sustainLength).toBe(0);
    });

    it('should not update if length unchanged', () => {
      trail.sustainLength = 1000;
      const originalHeight = trail.graphicHeight;

      trail.setSustainLength(1000);

      expect(trail.graphicHeight).toBe(originalHeight);
    });
  });

  describe('Clipping', () => {
    it('should hide trail when clip height is zero', () => {
      trail.strumTime = 0;
      trail.sustainLength = 0;
      trail.updateClipping(1000);

      expect(trail.visible).toBe(false);
    });

    it('should show trail when clip height is positive', () => {
      trail.strumTime = 0;
      trail.sustainLength = 1000;
      trail.graphicHeight = 450;
      trail.updateClipping(0);

      expect(trail.visible).toBe(true);
    });

    it('should not update clipping with custom vertex data', () => {
      trail.customVertexData = true;
      trail.visible = true;

      trail.updateClipping(0);

      // Should not change visibility
      expect(trail.visible).toBe(true);
    });

    it('should update UV data based on direction', () => {
      trail.noteDirection = 2; // up
      trail.sustainLength = 1000;
      trail.graphicHeight = 450;
      trail.updateClipping(0);

      // UV left should be (1/4) * 2 = 0.5
      expect(trail.uvtData[0]).toBe(0.5);
    });
  });

  describe('Update', () => {
    it('should not update when not alive', () => {
      trail.alive = false;
      trail.sustainLength = 1000;

      trail.update(500);

      // Should not change
      expect(trail.sustainLength).toBe(1000);
    });

    it('should not update when not active', () => {
      trail.active = false;
      trail.sustainLength = 1000;

      trail.update(500);

      expect(trail.sustainLength).toBe(1000);
    });

    it('should update sustain length when hit and not missed', () => {
      trail.strumTime = 0;
      trail.fullSustainLength = 1000;
      trail.sustainLength = 1000;
      trail.hitNote = true;
      trail.missedNote = false;

      trail.update(500);

      expect(trail.sustainLength).toBe(500);
    });

    it('should not go below zero sustain length', () => {
      trail.strumTime = 0;
      trail.fullSustainLength = 1000;
      trail.sustainLength = 1000;
      trail.hitNote = true;
      trail.missedNote = false;

      trail.update(2000);

      expect(trail.sustainLength).toBe(0);
    });

    it('should not update sustain length when missed', () => {
      trail.strumTime = 0;
      trail.fullSustainLength = 1000;
      trail.sustainLength = 500;
      trail.hitNote = true;
      trail.missedNote = true;

      trail.update(750);

      // Should not change because missedNote is true
      expect(trail.sustainLength).toBe(500);
    });
  });

  describe('State Management', () => {
    it('should mark as hit', () => {
      trail.hit();

      expect(trail.hitNote).toBe(true);
      expect(trail.missedNote).toBe(false);
    });

    it('should mark as missed', () => {
      trail.miss();

      expect(trail.missedNote).toBe(true);
      expect(trail.alpha).toBe(0.3);
    });

    it('should return this from hit', () => {
      const result = trail.hit();
      expect(result).toBe(trail);
    });

    it('should return this from miss', () => {
      const result = trail.miss();
      expect(result).toBe(trail);
    });
  });

  describe('Pooling Support', () => {
    it('should revive trail for reuse', () => {
      // Set various states
      trail.alive = false;
      trail.active = false;
      trail.visible = false;
      trail.alpha = 0.5;
      trail.strumTime = 1000;
      trail.noteDirection = 2;
      trail.sustainLength = 500;
      trail.fullSustainLength = 500;
      trail.hitNote = true;
      trail.missedNote = true;
      trail.handledMiss = true;
      trail.yOffset = 100;
      trail.noteData = { time: 0 };
      trail.cover = {};

      trail.revive();

      expect(trail.alive).toBe(true);
      expect(trail.active).toBe(true);
      expect(trail.visible).toBe(true);
      expect(trail.alpha).toBe(1.0);
      expect(trail.strumTime).toBe(0);
      expect(trail.noteDirection).toBe(0);
      expect(trail.sustainLength).toBe(0);
      expect(trail.fullSustainLength).toBe(0);
      expect(trail.hitNote).toBe(false);
      expect(trail.missedNote).toBe(false);
      expect(trail.handledMiss).toBe(false);
      expect(trail.yOffset).toBe(0);
      expect(trail.noteData).toBeNull();
      expect(trail.cover).toBeNull();
    });

    it('should kill trail', () => {
      trail.alive = true;
      trail.active = true;
      trail.visible = true;
      trail.strumTime = 1000;
      trail.hitNote = true;

      trail.kill();

      expect(trail.alive).toBe(false);
      expect(trail.active).toBe(false);
      expect(trail.visible).toBe(false);
      expect(trail.strumTime).toBe(0);
      expect(trail.hitNote).toBe(false);
    });

    it('should return this from revive', () => {
      const result = trail.revive();
      expect(result).toBe(trail);
    });

    it('should return this from kill', () => {
      const result = trail.kill();
      expect(result).toBe(trail);
    });
  });

  describe('Rendering', () => {
    it('should calculate Y position for upscroll', () => {
      trail.strumTime = 1000;
      trail.height = 450;

      // (1000 - 500) * 0.45 * 1.0 = 225
      const y = trail.getYPosition(500, 1.0, false);
      expect(y).toBe(225);
    });

    it('should calculate Y position for downscroll', () => {
      trail.strumTime = 1000;
      trail.height = 450;

      // For downscroll: -offset - height
      // offset = (1000 - 500) * 0.45 * 1.0 = 225
      // y = -225 - 450 = -675
      const y = trail.getYPosition(500, 1.0, true);
      expect(y).toBe(-675);
    });

    it('should get direction color', () => {
      trail.noteDirection = 0;
      expect(trail.getDirectionColor()).toBe(0xc24b99); // purple

      trail.noteDirection = 1;
      expect(trail.getDirectionColor()).toBe(0x00ffff); // cyan

      trail.noteDirection = 2;
      expect(trail.getDirectionColor()).toBe(0x12fa05); // green

      trail.noteDirection = 3;
      expect(trail.getDirectionColor()).toBe(0xf9393f); // red
    });

    it('should not draw when not visible', () => {
      const mockGraphics = {
        fillStyle: vi.fn(),
        fillRect: vi.fn()
      };

      trail.visible = false;
      trail.draw(mockGraphics);

      expect(mockGraphics.fillStyle).not.toHaveBeenCalled();
    });

    it('should not draw when alpha is zero', () => {
      const mockGraphics = {
        fillStyle: vi.fn(),
        fillRect: vi.fn()
      };

      trail.alpha = 0;
      trail.draw(mockGraphics);

      expect(mockGraphics.fillStyle).not.toHaveBeenCalled();
    });

    it('should draw when visible', () => {
      const mockGraphics = {
        fillStyle: vi.fn(),
        fillRect: vi.fn()
      };

      trail.visible = true;
      trail.alpha = 1.0;
      trail.x = 100;
      trail.y = 200;
      trail.width = 50;
      trail.height = 300;

      trail.draw(mockGraphics);

      expect(mockGraphics.fillStyle).toHaveBeenCalled();
      expect(mockGraphics.fillRect).toHaveBeenCalledWith(100, 200, 50, 300);
    });

    it('should apply offset when drawing', () => {
      const mockGraphics = {
        fillStyle: vi.fn(),
        fillRect: vi.fn()
      };

      trail.visible = true;
      trail.alpha = 1.0;
      trail.x = 100;
      trail.y = 200;
      trail.width = 50;
      trail.height = 300;

      trail.draw(mockGraphics, 10, 20);

      expect(mockGraphics.fillRect).toHaveBeenCalledWith(110, 220, 50, 300);
    });
  });

  describe('Cleanup', () => {
    it('should clear references on destroy', () => {
      trail.noteData = { time: 0 };
      trail.parentStrumline = {};
      trail.cover = {};

      trail.destroy();

      expect(trail.vertices).toEqual([]);
      expect(trail.indices).toEqual([]);
      expect(trail.uvtData).toEqual([]);
      expect(trail.noteData).toBeNull();
      expect(trail.parentStrumline).toBeNull();
      expect(trail.cover).toBeNull();
      expect(trail.scene).toBeNull();
    });
  });

  describe('FlipY (Downscroll)', () => {
    it('should support flipY property', () => {
      trail.flipY = true;
      expect(trail.flipY).toBe(true);

      trail.flipY = false;
      expect(trail.flipY).toBe(false);
    });
  });
});

/**
 * @fileoverview Unit tests for NoteSprite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser's Sprite class - MUST be set up before importing
class MockAnimation {
  constructor() {
    this.currentAnim = null;
    this.isPlaying = false;
    this.animationManager = {
      exists: vi.fn().mockReturnValue(false),
      get: vi.fn().mockReturnValue(null)
    };
  }

  exists() {
    return false;
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
    this.angle = 0;
    this.flipX = false;
    this.flipY = false;
    this.visible = true;
    this.active = true;
    this.anims = new MockAnimation();
    this._eventListeners = new Map();
    this._tint = null;
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

  setOrigin(x, y) {
    this.originX = x;
    this.originY = y !== undefined ? y : x;
    return this;
  }

  setDepth(depth) {
    this.depth = depth;
    return this;
  }

  setAlpha(alpha) {
    this.alpha = alpha;
    return this;
  }

  setAngle(angle) {
    this.angle = angle;
    return this;
  }

  setFlip(x, y) {
    this.flipX = x;
    this.flipY = y;
    return this;
  }

  setTexture(key) {
    this.texture = { key, source: [{ scaleMode: 0 }] };
    return this;
  }

  setTint(tint) {
    this._tint = tint;
    return this;
  }

  clearTint() {
    this._tint = null;
    return this;
  }

  on(event, callback, context) {
    this._eventListeners.set(event, { callback, context });
    return this;
  }

  off(event, callback, context) {
    this._eventListeners.delete(event);
    return this;
  }

  emit(event, ...args) {
    const listener = this._eventListeners.get(event);
    if (listener) {
      listener.callback.apply(listener.context, args);
    }
  }

  play(config, ignoreIfPlaying) {
    if (typeof config === 'object') {
      this.anims.currentAnim = { key: config.key };
    }
    this.anims.isPlaying = true;
    return this;
  }

  destroy() {}
}

// Mock Phaser globals - MUST be set up before importing NoteSprite
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
const { default: NoteSprite } = await import('../src/play/NoteSprite.js');

describe('NoteSprite', () => {
  let scene;
  let note;

  beforeEach(() => {
    scene = {
      add: {
        existing: vi.fn()
      },
      tweens: {
        killTweensOf: vi.fn()
      }
    };
    note = new NoteSprite(scene, 0);
  });

  describe('Constructor', () => {
    it('should initialize with default direction', () => {
      expect(note.direction).toBe(0);
    });

    it('should initialize with specified direction', () => {
      const rightNote = new NoteSprite(scene, 3);
      expect(rightNote.direction).toBe(3);
    });

    it('should initialize off-screen', () => {
      expect(note.y).toBe(-9999);
    });

    it('should initialize with default state', () => {
      expect(note.hasBeenHit).toBe(false);
      expect(note.hasMissed).toBe(false);
      expect(note.tooEarly).toBe(false);
      expect(note.mayHit).toBe(false);
      expect(note.handledMiss).toBe(false);
      expect(note.scoreable).toBe(true);
    });
  });

  describe('Static Constants', () => {
    it('should have direction colors', () => {
      expect(NoteSprite.DIRECTION_COLORS).toEqual(['purple', 'blue', 'green', 'red']);
    });

    it('should have direction names', () => {
      expect(NoteSprite.DIRECTION_NAMES).toEqual(['left', 'down', 'up', 'right']);
    });

    it('should get color name for direction', () => {
      expect(NoteSprite.getColorName(0)).toBe('purple');
      expect(NoteSprite.getColorName(1)).toBe('blue');
      expect(NoteSprite.getColorName(2)).toBe('green');
      expect(NoteSprite.getColorName(3)).toBe('red');
    });

    it('should get direction name', () => {
      expect(NoteSprite.getDirectionName(0)).toBe('left');
      expect(NoteSprite.getDirectionName(1)).toBe('down');
      expect(NoteSprite.getDirectionName(2)).toBe('up');
      expect(NoteSprite.getDirectionName(3)).toBe('right');
    });

    it('should return default for invalid direction', () => {
      expect(NoteSprite.getColorName(99)).toBe('purple');
      expect(NoteSprite.getDirectionName(99)).toBe('left');
    });
  });

  describe('Note Data', () => {
    const testNoteData = {
      time: 1000,
      direction: 2,
      length: 500,
      kind: 'normal',
      params: [{ name: 'test', value: 42 }]
    };

    beforeEach(() => {
      note.setup(testNoteData);
    });

    it('should setup with note data', () => {
      expect(note.noteData).toBe(testNoteData);
      expect(note.direction).toBe(2);
    });

    it('should get strum time', () => {
      expect(note.strumTime).toBe(1000);
    });

    it('should set strum time', () => {
      note.strumTime = 2000;
      expect(note.strumTime).toBe(2000);
    });

    it('should get length', () => {
      expect(note.length).toBe(500);
    });

    it('should set length', () => {
      note.length = 750;
      expect(note.length).toBe(750);
    });

    it('should get kind', () => {
      expect(note.kind).toBe('normal');
    });

    it('should set kind', () => {
      note.kind = 'mine';
      expect(note.kind).toBe('mine');
    });

    it('should get params', () => {
      expect(note.params).toEqual([{ name: 'test', value: 42 }]);
    });

    it('should set params', () => {
      note.params = [{ name: 'new', value: 100 }];
      expect(note.params).toEqual([{ name: 'new', value: 100 }]);
    });

    it('should detect hold note', () => {
      expect(note.isHoldNote).toBe(true);
    });

    it('should detect non-hold note', () => {
      note.setup({ time: 1000, direction: 0, length: 0 });
      expect(note.isHoldNote).toBe(false);
    });
  });

  describe('Default Values Without Note Data', () => {
    it('should return 0 for strumTime without data', () => {
      expect(note.strumTime).toBe(0);
    });

    it('should return 0 for length without data', () => {
      expect(note.length).toBe(0);
    });

    it('should return null for kind without data', () => {
      expect(note.kind).toBeNull();
    });

    it('should return empty array for params without data', () => {
      expect(note.params).toEqual([]);
    });

    it('should return false for isHoldNote without data', () => {
      expect(note.isHoldNote).toBe(false);
    });
  });

  describe('Direction Properties', () => {
    it('should get color name for current direction', () => {
      note.setup({ time: 0, direction: 1 });
      expect(note.colorName).toBe('blue');
    });

    it('should get direction name for current direction', () => {
      note.setup({ time: 0, direction: 3 });
      expect(note.directionName).toBe('right');
    });
  });

  describe('Parameters', () => {
    beforeEach(() => {
      note.setup({
        time: 1000,
        direction: 0,
        params: [
          { name: 'speed', value: 1.5 },
          { name: 'color', value: 'red' }
        ]
      });
    });

    it('should get parameter by name', () => {
      expect(note.getParam('speed')).toBe(1.5);
      expect(note.getParam('color')).toBe('red');
    });

    it('should return null for non-existent parameter', () => {
      expect(note.getParam('nonexistent')).toBeNull();
    });

    it('should set existing parameter', () => {
      note.setParam('speed', 2.0);
      expect(note.getParam('speed')).toBe(2.0);
    });

    it('should add new parameter', () => {
      note.setParam('newParam', 'value');
      expect(note.getParam('newParam')).toBe('value');
    });

    it('should initialize params array if needed', () => {
      note.setup({ time: 0, direction: 0 });
      note.setParam('test', 123);
      expect(note.getParam('test')).toBe(123);
    });
  });

  describe('Hit/Miss Handling', () => {
    it('should mark note as hit', () => {
      note.hit();

      expect(note.hasBeenHit).toBe(true);
      expect(note.visible).toBe(false);
      expect(note.active).toBe(false);
    });

    it('should mark note as missed', () => {
      note.miss();

      expect(note.hasMissed).toBe(true);
    });

    it('should desaturate on miss', () => {
      note.miss();

      expect(note.hsvValues.saturation).toBe(0.2);
    });
  });

  describe('Visual Effects', () => {
    it('should desaturate note', () => {
      note.desaturate();

      expect(note.hsvValues.saturation).toBe(0.2);
      expect(note._tint).toBe(0x888888);
    });

    it('should set hue', () => {
      note.setHue(0.5);

      expect(note.hsvValues.hue).toBe(0.5);
    });

    it('should clear HSV effects', () => {
      note.desaturate();
      note.clearHSV();

      expect(note.hsvValues).toEqual({ hue: 1.0, saturation: 1.0, value: 1.0 });
      expect(note._tint).toBeNull();
    });
  });

  describe('Pooling Support', () => {
    it('should revive note for reuse', () => {
      // Set various states
      note.hasBeenHit = true;
      note.hasMissed = true;
      note.tooEarly = true;
      note.mayHit = true;
      note.handledMiss = true;
      note.visible = false;
      note.alpha = 0.5;
      note.scoreable = false;
      note.lowPriority = true;
      note.yOffset = 100;
      note.desaturate();

      note.revive();

      expect(note.visible).toBe(true);
      expect(note.alpha).toBe(1.0);
      expect(note.hasBeenHit).toBe(false);
      expect(note.hasMissed).toBe(false);
      expect(note.tooEarly).toBe(false);
      expect(note.mayHit).toBe(false);
      expect(note.handledMiss).toBe(false);
      expect(note.scoreable).toBe(true);
      expect(note.lowPriority).toBe(false);
      expect(note.yOffset).toBe(0);
      expect(note.sustainTrail).toBeNull();
      expect(note.hsvValues).toEqual({ hue: 1.0, saturation: 1.0, value: 1.0 });
    });

    it('should kill note', () => {
      note.visible = true;
      note.active = true;

      note.kill();

      expect(note.visible).toBe(false);
      expect(note.active).toBe(false);
    });
  });

  describe('Animation', () => {
    beforeEach(() => {
      note.anims.exists = vi.fn().mockReturnValue(true);
      note.anims.animationManager.exists = vi.fn().mockReturnValue(true);
    });

    it('should play note animation for direction', () => {
      note.playNoteAnimation(0);
      expect(note.anims.currentAnim.key).toBe('purpleScroll');
    });

    it('should play correct animation for each direction', () => {
      note.playNoteAnimation(1);
      expect(note.anims.currentAnim.key).toBe('blueScroll');

      note.playNoteAnimation(2);
      expect(note.anims.currentAnim.key).toBe('greenScroll');

      note.playNoteAnimation(3);
      expect(note.anims.currentAnim.key).toBe('redScroll');
    });

    it('should play confirm animation', () => {
      note._direction = 2;
      note.playConfirmAnimation();
      expect(note.anims.currentAnim.key).toBe('greenConfirm');
    });
  });

  describe('Note Style Setup', () => {
    it('should call buildNoteSprite on note style', () => {
      const mockNoteStyle = {
        buildNoteSprite: vi.fn()
      };

      note.setupNoteGraphic(mockNoteStyle);

      expect(mockNoteStyle.buildNoteSprite).toHaveBeenCalledWith(note);
    });

    it('should handle null note style', () => {
      expect(() => note.setupNoteGraphic(null)).not.toThrow();
    });

    it('should setup with note style via setup method', () => {
      const mockNoteStyle = {
        buildNoteSprite: vi.fn()
      };

      note.setup({ time: 1000, direction: 0 }, mockNoteStyle);

      expect(mockNoteStyle.buildNoteSprite).toHaveBeenCalledWith(note);
    });
  });

  describe('Cleanup', () => {
    it('should clear references on destroy', () => {
      note.noteData = { time: 1000, direction: 0 };
      note.sustainTrail = {};
      note.strumline = {};

      note.destroy();

      expect(note.noteData).toBeNull();
      expect(note.sustainTrail).toBeNull();
      expect(note.strumline).toBeNull();
    });
  });

  describe('Chaining', () => {
    it('should return this from setup', () => {
      const result = note.setup({ time: 1000, direction: 0 });
      expect(result).toBe(note);
    });

    it('should return this from hit', () => {
      const result = note.hit();
      expect(result).toBe(note);
    });

    it('should return this from miss', () => {
      const result = note.miss();
      expect(result).toBe(note);
    });

    it('should return this from setParam', () => {
      note.setup({ time: 0, direction: 0 });
      const result = note.setParam('test', 1);
      expect(result).toBe(note);
    });

    it('should return this from revive', () => {
      const result = note.revive();
      expect(result).toBe(note);
    });

    it('should return this from kill', () => {
      const result = note.kill();
      expect(result).toBe(note);
    });
  });
});

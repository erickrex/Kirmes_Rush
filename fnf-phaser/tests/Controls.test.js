/**
 * @fileoverview Tests for Controls - Keybind management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Controls, NoteDirection } from '../src/input/InputSystem.js';
import SaveManager from '../src/data/SaveManager.js';

describe('Controls', () => {
  let controls;

  beforeEach(() => {
    // Clear localStorage before each test
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    });

    SaveManager.resetInstance();
    controls = new Controls();
  });

  describe('NoteDirection enum', () => {
    it('should have correct direction values', () => {
      expect(NoteDirection.LEFT).toBe(0);
      expect(NoteDirection.DOWN).toBe(1);
      expect(NoteDirection.UP).toBe(2);
      expect(NoteDirection.RIGHT).toBe(3);
    });
  });

  describe('constructor', () => {
    it('should initialize with default keybinds', () => {
      expect(controls.noteKeybinds).toBeDefined();
      expect(controls.uiKeybinds).toBeDefined();
    });

    it('should have default note keybinds for all directions', () => {
      expect(controls.noteKeybinds.left).toContain('ArrowLeft');
      expect(controls.noteKeybinds.down).toContain('ArrowDown');
      expect(controls.noteKeybinds.up).toContain('ArrowUp');
      expect(controls.noteKeybinds.right).toContain('ArrowRight');
    });

    it('should have default UI keybinds', () => {
      expect(controls.uiKeybinds.accept).toContain('Enter');
      expect(controls.uiKeybinds.back).toContain('Escape');
      expect(controls.uiKeybinds.pause).toContain('Escape');
    });
  });

  describe('getNoteKeybinds', () => {
    it('should return keybinds for LEFT direction', () => {
      const keys = controls.getNoteKeybinds(NoteDirection.LEFT);
      expect(keys).toContain('ArrowLeft');
      expect(keys).toContain('KeyA');
    });

    it('should return keybinds for DOWN direction', () => {
      const keys = controls.getNoteKeybinds(NoteDirection.DOWN);
      expect(keys).toContain('ArrowDown');
      expect(keys).toContain('KeyS');
    });

    it('should return keybinds for UP direction', () => {
      const keys = controls.getNoteKeybinds(NoteDirection.UP);
      expect(keys).toContain('ArrowUp');
      expect(keys).toContain('KeyW');
    });

    it('should return keybinds for RIGHT direction', () => {
      const keys = controls.getNoteKeybinds(NoteDirection.RIGHT);
      expect(keys).toContain('ArrowRight');
      expect(keys).toContain('KeyD');
    });

    it('should return empty array for invalid direction', () => {
      const keys = controls.getNoteKeybinds(99);
      expect(keys).toEqual([]);
    });
  });

  describe('setNoteKeybinds', () => {
    it('should update keybinds for a direction', () => {
      controls.setNoteKeybinds(NoteDirection.LEFT, ['KeyZ', 'KeyX']);
      const keys = controls.getNoteKeybinds(NoteDirection.LEFT);
      expect(keys).toEqual(['KeyZ', 'KeyX']);
    });

    it('should not modify original array', () => {
      const original = ['KeyZ', 'KeyX'];
      controls.setNoteKeybinds(NoteDirection.LEFT, original);
      original.push('KeyC');
      expect(controls.getNoteKeybinds(NoteDirection.LEFT)).not.toContain('KeyC');
    });
  });

  describe('getUIKeybinds', () => {
    it('should return keybinds for accept action', () => {
      const keys = controls.getUIKeybinds('accept');
      expect(keys).toContain('Enter');
      expect(keys).toContain('Space');
    });

    it('should return keybinds for back action', () => {
      const keys = controls.getUIKeybinds('back');
      expect(keys).toContain('Escape');
      expect(keys).toContain('Backspace');
    });

    it('should return empty array for unknown action', () => {
      const keys = controls.getUIKeybinds('unknown');
      expect(keys).toEqual([]);
    });
  });

  describe('setUIKeybinds', () => {
    it('should update keybinds for a UI action', () => {
      controls.setUIKeybinds('accept', ['KeyZ']);
      const keys = controls.getUIKeybinds('accept');
      expect(keys).toEqual(['KeyZ']);
    });
  });

  describe('isNoteKey', () => {
    it('should return true for valid note key', () => {
      expect(controls.isNoteKey('ArrowLeft', NoteDirection.LEFT)).toBe(true);
      expect(controls.isNoteKey('KeyA', NoteDirection.LEFT)).toBe(true);
    });

    it('should return false for invalid note key', () => {
      expect(controls.isNoteKey('ArrowLeft', NoteDirection.RIGHT)).toBe(false);
      expect(controls.isNoteKey('KeyZ', NoteDirection.LEFT)).toBe(false);
    });
  });

  describe('isUIKey', () => {
    it('should return true for valid UI key', () => {
      expect(controls.isUIKey('Enter', 'accept')).toBe(true);
      expect(controls.isUIKey('Escape', 'back')).toBe(true);
    });

    it('should return false for invalid UI key', () => {
      expect(controls.isUIKey('KeyZ', 'accept')).toBe(false);
    });
  });

  describe('getDirectionForKey', () => {
    it('should return correct direction for arrow keys', () => {
      expect(controls.getDirectionForKey('ArrowLeft')).toBe(NoteDirection.LEFT);
      expect(controls.getDirectionForKey('ArrowDown')).toBe(NoteDirection.DOWN);
      expect(controls.getDirectionForKey('ArrowUp')).toBe(NoteDirection.UP);
      expect(controls.getDirectionForKey('ArrowRight')).toBe(NoteDirection.RIGHT);
    });

    it('should return correct direction for letter keys', () => {
      expect(controls.getDirectionForKey('KeyA')).toBe(NoteDirection.LEFT);
      expect(controls.getDirectionForKey('KeyS')).toBe(NoteDirection.DOWN);
      expect(controls.getDirectionForKey('KeyW')).toBe(NoteDirection.UP);
      expect(controls.getDirectionForKey('KeyD')).toBe(NoteDirection.RIGHT);
    });

    it('should return -1 for unknown key', () => {
      expect(controls.getDirectionForKey('KeyZ')).toBe(-1);
      expect(controls.getDirectionForKey('Space')).toBe(-1);
    });
  });

  describe('getUIActionForKey', () => {
    it('should return correct action for key', () => {
      // Returns first matching action in iteration order
      const enterAction = controls.getUIActionForKey('Enter');
      expect(['up', 'accept', 'pause']).toContain(enterAction);

      const escapeAction = controls.getUIActionForKey('Escape');
      expect(['back', 'pause']).toContain(escapeAction);
    });

    it('should return null for unknown key', () => {
      expect(controls.getUIActionForKey('KeyZ')).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should save keybinds to localStorage', () => {
      controls.saveToStorage();
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'fnf-options',
        expect.any(String)
      );
    });

    it('should load keybinds from localStorage', () => {
      const savedData = JSON.stringify({
        keyLeft: 'Z',
        keyLeftAlt: 'LEFT'
      });
      localStorage.getItem = vi.fn(() => savedData);
      SaveManager.resetInstance();

      const newControls = new Controls();
      expect(newControls.noteKeybinds.left).toContain('KeyZ');
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.getItem = vi.fn(() => 'invalid json');
      const newControls = new Controls();
      // Should fall back to defaults
      expect(newControls.noteKeybinds.left).toContain('ArrowLeft');
    });
  });

  describe('resetToDefaults', () => {
    it('should reset note keybinds to defaults', () => {
      controls.setNoteKeybinds(NoteDirection.LEFT, ['KeyZ']);
      controls.resetToDefaults();
      expect(controls.getNoteKeybinds(NoteDirection.LEFT)).toContain('ArrowLeft');
    });

    it('should reset UI keybinds to defaults', () => {
      controls.setUIKeybinds('accept', ['KeyZ']);
      controls.resetToDefaults();
      expect(controls.getUIKeybinds('accept')).toContain('Enter');
    });

    it('should save after reset', () => {
      controls.resetToDefaults();
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('static methods', () => {
    it('should return default note keybinds', () => {
      const defaults = Controls.getDefaultNoteKeybinds();
      expect(defaults.left).toContain('ArrowLeft');
      expect(defaults.down).toContain('ArrowDown');
    });

    it('should return default UI keybinds', () => {
      const defaults = Controls.getDefaultUIKeybinds();
      expect(defaults.accept).toContain('Enter');
      expect(defaults.back).toContain('Escape');
    });

    it('should return direction name', () => {
      expect(Controls.getDirectionName(0)).toBe('left');
      expect(Controls.getDirectionName(1)).toBe('down');
      expect(Controls.getDirectionName(2)).toBe('up');
      expect(Controls.getDirectionName(3)).toBe('right');
    });

    it('should return default for invalid direction', () => {
      expect(Controls.getDirectionName(99)).toBe('left');
    });
  });
});

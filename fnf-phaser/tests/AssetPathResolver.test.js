/**
 * @fileoverview Unit tests for the shared AssetPathResolver utility
 */

import { describe, it, expect } from 'vitest';
import { resolveAssetPath } from '../src/utils/AssetPathResolver.js';

describe('AssetPathResolver', () => {
  describe('null/empty input', () => {
    it('returns null for null input', () => {
      expect(resolveAssetPath(null)).toBe(null);
    });

    it('returns null for empty string', () => {
      expect(resolveAssetPath('')).toBe(null);
    });

    it('returns null for undefined', () => {
      expect(resolveAssetPath(undefined)).toBe(null);
    });
  });

  describe('shared: prefix', () => {
    it('resolves shared:notes to images/shared/notes', () => {
      expect(resolveAssetPath('shared:notes')).toBe('images/shared/notes');
    });

    it('resolves shared:path/to/asset to images/shared/path/to/asset', () => {
      expect(resolveAssetPath('shared:path/to/asset')).toBe('images/shared/path/to/asset');
    });
  });

  describe('default: prefix', () => {
    it('resolves default:hud to images/preload/hud', () => {
      expect(resolveAssetPath('default:hud')).toBe('images/preload/hud');
    });

    it('resolves default:path/to/asset to images/preload/path/to/asset', () => {
      expect(resolveAssetPath('default:path/to/asset')).toBe('images/preload/path/to/asset');
    });
  });

  describe('custom prefix', () => {
    it('resolves week1:stage to images/week1/stage', () => {
      expect(resolveAssetPath('week1:stage')).toBe('images/week1/stage');
    });

    it('resolves custom:deep/path to images/custom/deep/path', () => {
      expect(resolveAssetPath('custom:deep/path')).toBe('images/custom/deep/path');
    });
  });

  describe('bare path (no colon)', () => {
    it('resolves bare path to images/<path>', () => {
      expect(resolveAssetPath('myAsset')).toBe('images/myAsset');
    });

    it('resolves bare path with slashes', () => {
      expect(resolveAssetPath('some/nested/path')).toBe('images/some/nested/path');
    });
  });

  describe('multiple colons - splits only on first', () => {
    it('resolves prefix:path:extra to images/prefix/path:extra', () => {
      expect(resolveAssetPath('prefix:path:extra')).toBe('images/prefix/path:extra');
    });

    it('resolves a:b:c:d to images/a/b:c:d', () => {
      expect(resolveAssetPath('a:b:c:d')).toBe('images/a/b:c:d');
    });
  });

  describe('matches NoteStyleRegistry behavior', () => {
    it('resolves shared:notes same as NoteStyleRegistry', () => {
      expect(resolveAssetPath('shared:notes')).toBe('images/shared/notes');
    });

    it('resolves shared:noteStrumline same as NoteStyleRegistry', () => {
      expect(resolveAssetPath('shared:noteStrumline')).toBe('images/shared/noteStrumline');
    });

    it('resolves shared:noteSplashes same as NoteStyleRegistry', () => {
      expect(resolveAssetPath('shared:noteSplashes')).toBe('images/shared/noteSplashes');
    });
  });
});

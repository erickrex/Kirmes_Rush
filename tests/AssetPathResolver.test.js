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
    it('resolves shared:notes to shared/images/notes', () => {
      expect(resolveAssetPath('shared:notes')).toBe('shared/images/notes');
    });

    it('resolves shared:path/to/asset to shared/images/path/to/asset', () => {
      expect(resolveAssetPath('shared:path/to/asset')).toBe('shared/images/path/to/asset');
    });
  });

  describe('default: prefix', () => {
    it('resolves default:hud to preload/images/hud', () => {
      expect(resolveAssetPath('default:hud')).toBe('preload/images/hud');
    });

    it('resolves default:path/to/asset to preload/images/path/to/asset', () => {
      expect(resolveAssetPath('default:path/to/asset')).toBe('preload/images/path/to/asset');
    });
  });

  describe('custom prefix', () => {
    it('resolves week1:stage to week1/images/stage', () => {
      expect(resolveAssetPath('week1:stage')).toBe('week1/images/stage');
    });

    it('resolves custom:deep/path to custom/images/deep/path', () => {
      expect(resolveAssetPath('custom:deep/path')).toBe('custom/images/deep/path');
    });
  });

  describe('bare path (no colon)', () => {
    it('resolves bare path to shared/images/<path>', () => {
      expect(resolveAssetPath('myAsset')).toBe('shared/images/myAsset');
    });

    it('resolves bare path with slashes', () => {
      expect(resolveAssetPath('some/nested/path')).toBe('shared/images/some/nested/path');
    });
  });

  describe('multiple colons - splits only on first', () => {
    it('resolves prefix:path:extra to prefix/images/path:extra', () => {
      expect(resolveAssetPath('prefix:path:extra')).toBe('prefix/images/path:extra');
    });

    it('resolves a:b:c:d to a/images/b:c:d', () => {
      expect(resolveAssetPath('a:b:c:d')).toBe('a/images/b:c:d');
    });
  });

  describe('matches NoteStyleRegistry behavior', () => {
    it('resolves shared:notes for note atlas', () => {
      expect(resolveAssetPath('shared:notes')).toBe('shared/images/notes');
    });

    it('resolves shared:noteStrumline for strumline atlas', () => {
      expect(resolveAssetPath('shared:noteStrumline')).toBe('shared/images/noteStrumline');
    });

    it('resolves shared:noteSplashes for splash atlas', () => {
      expect(resolveAssetPath('shared:noteSplashes')).toBe('shared/images/noteSplashes');
    });
  });
});

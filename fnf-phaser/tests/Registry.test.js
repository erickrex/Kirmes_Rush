/**
 * @fileoverview Unit tests for the Registry base class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Registry from '../src/core/Registry.js';

/**
 * Test implementation of Registry for testing purposes
 */
class TestRegistry extends Registry {
  constructor() {
    super('testRegistry', 'data/test');
    this.mockData = new Map();
  }

  // Set mock data for testing
  setMockData(id, data) {
    this.mockData.set(id, data);
  }

  parseEntryData(id) {
    return this.mockData.get(id) ?? null;
  }

  parseEntryDataRaw(data, fileName) {
    // Simple validation - just return the data if it has required fields
    if (data && typeof data === 'object') {
      return data;
    }
    return null;
  }

  createEntry(id, data) {
    return {
      id: data.id ?? id,
      name: data.name ?? 'Unknown',
      ...data,
      destroy: vi.fn()
    };
  }
}

describe('Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new TestRegistry();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(registry.registryId).toBe('testRegistry');
      expect(registry.dataFilePath).toBe('data/test');
      expect(registry.versionRule).toBe('1.0.x');
      expect(registry.loaded).toBe(false);
      expect(registry.entries.size).toBe(0);
    });

    it('should accept custom version rule', () => {
      const customRegistry = new (class extends Registry {
        constructor() {
          super('custom', 'data/custom', '2.0.x');
        }
        parseEntryData() {
          return null;
        }
        parseEntryDataRaw() {
          return null;
        }
        createEntry() {
          return null;
        }
      })();

      expect(customRegistry.versionRule).toBe('2.0.x');
    });
  });

  describe('loadEntries', () => {
    it('should load entries from provided IDs', () => {
      registry.setMockData('entry1', { id: 'entry1', name: 'Entry One' });
      registry.setMockData('entry2', { id: 'entry2', name: 'Entry Two' });

      registry.loadEntries(['entry1', 'entry2']);

      expect(registry.loaded).toBe(true);
      expect(registry.countEntries()).toBe(2);
      expect(registry.hasEntry('entry1')).toBe(true);
      expect(registry.hasEntry('entry2')).toBe(true);
    });

    it('should skip entries that fail to parse', () => {
      registry.setMockData('valid', { id: 'valid', name: 'Valid Entry' });
      // 'invalid' has no mock data, so parseEntryData returns null

      registry.loadEntries(['valid', 'invalid']);

      expect(registry.countEntries()).toBe(1);
      expect(registry.hasEntry('valid')).toBe(true);
      expect(registry.hasEntry('invalid')).toBe(false);
    });

    it('should clear existing entries before loading', () => {
      registry.setMockData('first', { id: 'first', name: 'First' });
      registry.loadEntries(['first']);
      expect(registry.countEntries()).toBe(1);

      registry.setMockData('second', { id: 'second', name: 'Second' });
      registry.loadEntries(['second']);

      expect(registry.countEntries()).toBe(1);
      expect(registry.hasEntry('first')).toBe(false);
      expect(registry.hasEntry('second')).toBe(true);
    });
  });

  describe('fetchEntry', () => {
    beforeEach(() => {
      registry.setMockData('test', { id: 'test', name: 'Test Entry', value: 42 });
      registry.loadEntries(['test']);
    });

    it('should return entry by ID', () => {
      const entry = registry.fetchEntry('test');
      expect(entry).not.toBeNull();
      expect(entry.id).toBe('test');
      expect(entry.name).toBe('Test Entry');
      expect(entry.value).toBe(42);
    });

    it('should return null for non-existent entry', () => {
      const entry = registry.fetchEntry('nonexistent');
      expect(entry).toBeNull();
    });
  });

  describe('hasEntry', () => {
    beforeEach(() => {
      registry.setMockData('exists', { id: 'exists', name: 'Exists' });
      registry.loadEntries(['exists']);
    });

    it('should return true for existing entry', () => {
      expect(registry.hasEntry('exists')).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      expect(registry.hasEntry('missing')).toBe(false);
    });
  });

  describe('listEntryIds', () => {
    it('should return empty array when no entries', () => {
      expect(registry.listEntryIds()).toEqual([]);
    });

    it('should return all entry IDs', () => {
      registry.setMockData('a', { id: 'a', name: 'A' });
      registry.setMockData('b', { id: 'b', name: 'B' });
      registry.setMockData('c', { id: 'c', name: 'C' });
      registry.loadEntries(['a', 'b', 'c']);

      const ids = registry.listEntryIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('a');
      expect(ids).toContain('b');
      expect(ids).toContain('c');
    });
  });

  describe('countEntries', () => {
    it('should return 0 when empty', () => {
      expect(registry.countEntries()).toBe(0);
    });

    it('should return correct count', () => {
      registry.setMockData('one', { id: 'one', name: 'One' });
      registry.setMockData('two', { id: 'two', name: 'Two' });
      registry.loadEntries(['one', 'two']);

      expect(registry.countEntries()).toBe(2);
    });
  });

  describe('getAllEntries', () => {
    it('should return empty array when no entries', () => {
      expect(registry.getAllEntries()).toEqual([]);
    });

    it('should return all entries as array', () => {
      registry.setMockData('x', { id: 'x', name: 'X' });
      registry.setMockData('y', { id: 'y', name: 'Y' });
      registry.loadEntries(['x', 'y']);

      const entries = registry.getAllEntries();
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.id)).toContain('x');
      expect(entries.map((e) => e.id)).toContain('y');
    });
  });

  describe('clearEntries', () => {
    it('should remove all entries', () => {
      registry.setMockData('item', { id: 'item', name: 'Item' });
      registry.loadEntries(['item']);
      expect(registry.countEntries()).toBe(1);

      registry.clearEntries();

      expect(registry.countEntries()).toBe(0);
      expect(registry.loaded).toBe(false);
    });

    it('should call destroy on entries that have it', () => {
      registry.setMockData('destroyable', { id: 'destroyable', name: 'Destroyable' });
      registry.loadEntries(['destroyable']);

      const entry = registry.fetchEntry('destroyable');
      registry.clearEntries();

      expect(entry.destroy).toHaveBeenCalled();
    });
  });

  describe('validateVersion', () => {
    it('should return true for matching major.minor versions', () => {
      registry.versionRule = '1.0.x';
      expect(registry.validateVersion('1.0.0')).toBe(true);
      expect(registry.validateVersion('1.0.5')).toBe(true);
      expect(registry.validateVersion('1.0.99')).toBe(true);
    });

    it('should return false for non-matching major version', () => {
      registry.versionRule = '1.0.x';
      expect(registry.validateVersion('2.0.0')).toBe(false);
      expect(registry.validateVersion('0.0.0')).toBe(false);
    });

    it('should return false for non-matching minor version', () => {
      registry.versionRule = '1.0.x';
      expect(registry.validateVersion('1.1.0')).toBe(false);
      expect(registry.validateVersion('1.2.0')).toBe(false);
    });

    it('should return true for null/undefined version', () => {
      expect(registry.validateVersion(null)).toBe(true);
      expect(registry.validateVersion(undefined)).toBe(true);
    });

    it('should handle wildcard in major version', () => {
      registry.versionRule = 'x.0.x';
      expect(registry.validateVersion('1.0.0')).toBe(true);
      expect(registry.validateVersion('2.0.0')).toBe(true);
      expect(registry.validateVersion('99.0.0')).toBe(true);
    });
  });

  describe('fetchEntryVersion', () => {
    it('should extract version from data object', () => {
      const data = { version: '1.2.3', name: 'Test' };
      expect(registry.fetchEntryVersion(data)).toBe('1.2.3');
    });

    it('should return null if no version field', () => {
      const data = { name: 'Test' };
      expect(registry.fetchEntryVersion(data)).toBeNull();
    });

    it('should return null for null data', () => {
      expect(registry.fetchEntryVersion(null)).toBeNull();
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      expect(registry.toString()).toBe('Registry(testRegistry, 0 entries)');

      registry.setMockData('item', { id: 'item', name: 'Item' });
      registry.loadEntries(['item']);

      expect(registry.toString()).toBe('Registry(testRegistry, 1 entries)');
    });
  });

  describe('Abstract method enforcement', () => {
    it('should throw when parseEntryData is not implemented', () => {
      const baseRegistry = new Registry('base', 'data/base');
      expect(() => baseRegistry.parseEntryData('test')).toThrow(
        '[base] parseEntryData() must be implemented by subclass'
      );
    });

    it('should throw when parseEntryDataRaw is not implemented', () => {
      const baseRegistry = new Registry('base', 'data/base');
      expect(() => baseRegistry.parseEntryDataRaw({}, 'test.json')).toThrow(
        '[base] parseEntryDataRaw() must be implemented by subclass'
      );
    });

    it('should throw when createEntry is not implemented', () => {
      const baseRegistry = new Registry('base', 'data/base');
      expect(() => baseRegistry.createEntry('test', {})).toThrow(
        '[base] createEntry() must be implemented by subclass'
      );
    });
  });
});

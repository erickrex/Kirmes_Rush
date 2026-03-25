/**
 * @fileoverview Unit tests for the Registry base class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Registry, { createRegistry } from '../src/core/Registry.js';

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

describe('createRegistry - entityName method generation', () => {
  function makeRegistry(config, options = {}) {
    const Reg = createRegistry({
      registryId: 'TEST',
      dataFilePath: 'data/test',
      cleanData: (data) => data,
      createEntry: (id, data) => ({ id, name: data.name || 'Unknown', data, destroy: () => {} }),
      ...config
    }, options);
    return Reg.getInstance();
  }

  describe('generated method existence', () => {
    it('should generate all six methods when entityName is provided', () => {
      const reg = makeRegistry({ entityName: 'Widget' });
      expect(typeof reg.getWidgetData).toBe('function');
      expect(typeof reg.getWidgetName).toBe('function');
      expect(typeof reg.listWidgetIds).toBe('function');
      expect(typeof reg.getWidgetPath).toBe('function');
      expect(typeof reg.getWidgetDisplayInfo).toBe('function');
      expect(typeof reg.toString).toBe('function');
    });

    it('should not generate methods when entityName is missing from config', () => {
      const reg = makeRegistry({});
      expect(reg.getWidgetData).toBeUndefined();
    });
  });

  describe('generated accessor correctness', () => {
    let reg;
    beforeEach(() => {
      reg = makeRegistry({ entityName: 'Item' });
      // Manually load an entry
      reg.entries.set('alpha', { id: 'alpha', name: 'Alpha Thing', data: { name: 'Alpha Thing', color: 'red' }, destroy: () => {} });
    });

    it('getItemData should return entry data for existing id', () => {
      expect(reg.getItemData('alpha')).toEqual({ name: 'Alpha Thing', color: 'red' });
    });

    it('getItemData should return null for missing id', () => {
      expect(reg.getItemData('missing')).toBeNull();
    });

    it('getItemName should return entry name for existing id', () => {
      expect(reg.getItemName('alpha')).toBe('Alpha Thing');
    });

    it('getItemName should return the id itself for missing id', () => {
      expect(reg.getItemName('missing')).toBe('missing');
    });
  });

  describe('listIds and getPath', () => {
    let reg;
    beforeEach(() => {
      reg = makeRegistry({ entityName: 'Thing' });
      reg.entries.set('a', { id: 'a', name: 'A', data: {}, destroy: () => {} });
      reg.entries.set('b', { id: 'b', name: 'B', data: {}, destroy: () => {} });
    });

    it('listThingIds should return all entry ids', () => {
      const ids = reg.listThingIds();
      expect(ids).toContain('a');
      expect(ids).toContain('b');
      expect(ids).toHaveLength(2);
    });

    it('getThingPath should return correct path', () => {
      expect(reg.getThingPath('a')).toBe('data/test/a.json');
    });
  });

  describe('toString', () => {
    it('should return formatted string with entityName', () => {
      const reg = makeRegistry({ entityName: 'Style' });
      expect(reg.toString()).toBe('TESTRegistry(0 Styles)');
    });

    it('should reflect entry count', () => {
      const reg = makeRegistry({ entityName: 'Style' });
      reg.entries.set('x', { id: 'x', name: 'X', data: {}, destroy: () => {} });
      expect(reg.toString()).toBe('TESTRegistry(1 Styles)');
    });
  });

  describe('custom method override', () => {
    it('should use custom method instead of generated one', () => {
      const reg = makeRegistry(
        { entityName: 'Item' },
        { methods: { getItemData: function () { return 'custom'; } } }
      );
      expect(reg.getItemData('anything')).toBe('custom');
    });

    it('should use custom toString instead of generated one', () => {
      const reg = makeRegistry(
        { entityName: 'Item' },
        { methods: { toString: function () { return 'MyCustomString'; } } }
      );
      expect(reg.toString()).toBe('MyCustomString');
    });

    it('should keep generated methods that are not overridden', () => {
      const reg = makeRegistry(
        { entityName: 'Item' },
        { methods: { getItemData: function () { return 'custom'; } } }
      );
      // getItemName should still be the generated version
      reg.entries.set('z', { id: 'z', name: 'Zed', data: {}, destroy: () => {} });
      expect(reg.getItemName('z')).toBe('Zed');
    });
  });

  describe('displayInfoFields', () => {
    let reg;
    beforeEach(() => {
      reg = makeRegistry({
        entityName: 'Style',
        displayInfoFields: ['name', 'author', 'missing_field']
      });
      reg.entries.set('s1', {
        id: 's1',
        name: 'Cool Style',
        data: { name: 'Cool Style', author: 'Dev' },
        destroy: () => {}
      });
    });

    it('should return id plus specified fields that exist', () => {
      const info = reg.getStyleDisplayInfo('s1');
      expect(info).toEqual({ id: 's1', name: 'Cool Style', author: 'Dev' });
    });

    it('should omit fields that do not exist on the entry', () => {
      const info = reg.getStyleDisplayInfo('s1');
      expect(info).not.toHaveProperty('missing_field');
    });

    it('should return null for non-existent entry', () => {
      expect(reg.getStyleDisplayInfo('nope')).toBeNull();
    });

    it('should return only id when displayInfoFields is empty', () => {
      const reg2 = makeRegistry({ entityName: 'Foo', displayInfoFields: [] });
      reg2.entries.set('f1', { id: 'f1', name: 'F', data: {}, destroy: () => {} });
      expect(reg2.getFooDisplayInfo('f1')).toEqual({ id: 'f1' });
    });

    it('should default to empty displayInfoFields when not provided', () => {
      const reg2 = makeRegistry({ entityName: 'Bar' });
      reg2.entries.set('b1', { id: 'b1', name: 'B', data: { color: 'red' }, destroy: () => {} });
      expect(reg2.getBarDisplayInfo('b1')).toEqual({ id: 'b1' });
    });
  });

  describe('invalid entityName', () => {
    it('should log warning and skip generation for empty string', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const reg = makeRegistry({ entityName: '' });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('entityName must be a non-empty string')
      );
      // No generated methods
      expect(reg.getDataData).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('should log warning and skip generation for non-string entityName', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const reg = makeRegistry({ entityName: 123 });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('entityName must be a non-empty string')
      );
      warnSpy.mockRestore();
    });
  });
});

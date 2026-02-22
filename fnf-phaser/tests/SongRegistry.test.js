/**
 * @fileoverview Unit tests for the SongRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SongRegistry from '../src/data/registries/SongRegistry.js';

// Sample song metadata based on actual FNF format
const sampleMetadata = {
  version: '2.2.4',
  songName: 'Bopeebo',
  artist: 'Kawai Sprite',
  charter: 'ninjamuffin99 + MtH',
  timeFormat: 'ms',
  offsets: { instrumental: 0 },
  timeChanges: [{ t: 0, bpm: 100, n: 4, d: 4, bt: [4, 4, 4, 4] }],
  playData: {
    songVariations: ['erect', 'pico'],
    difficulties: ['easy', 'normal', 'hard'],
    ratings: { easy: 1, normal: 1, hard: 2 },
    characters: {
      player: 'bf',
      girlfriend: 'gf',
      opponent: 'dad',
      instrumental: '',
      altInstrumentals: ['pico']
    },
    stage: 'mainStage',
    noteStyle: 'funkin',
    album: 'volume1',
    previewStart: 0,
    previewEnd: 15000
  },
  generatedBy: 'Test'
};

// Sample chart data
const sampleChartData = {
  version: '2.0.0',
  scrollSpeed: { easy: 1.2, normal: 1.3, hard: 1.6 },
  events: [
    { t: 0, e: 'FocusCamera', v: 1 },
    { t: 2400, e: 'FocusCamera', v: 0 }
  ],
  notes: {
    easy: [
      { t: 600, d: 0, l: 0 },
      { t: 1200, d: 2, l: 0 }
    ],
    normal: [
      { t: 600, d: 0, l: 0 },
      { t: 900, d: 1, l: 0 },
      { t: 1200, d: 2, l: 0 }
    ],
    hard: [
      { t: 600, d: 0, l: 0 },
      { t: 750, d: 1, l: 0 },
      { t: 900, d: 2, l: 0 },
      { t: 1050, d: 3, l: 0 },
      { t: 1200, d: 0, l: 300 }
    ]
  }
};

// Minimal valid metadata
const minimalMetadata = {
  version: '2.2.0',
  songName: 'Test Song',
  timeChanges: [{ t: 0, bpm: 120 }],
  playData: {
    difficulties: ['normal'],
    characters: { player: 'bf', opponent: 'dad' },
    stage: 'mainStage'
  }
};

describe('SongRegistry', () => {
  let registry;

  beforeEach(() => {
    // Create fresh instance for each test
    SongRegistry.instance = null;
    registry = SongRegistry.getInstance();
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = SongRegistry.getInstance();
      const instance2 = SongRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should have correct registry ID', () => {
      expect(registry.registryId).toBe('SONG');
    });

    it('should have correct data path', () => {
      expect(registry.dataFilePath).toBe('data/songs');
    });
  });

  describe('parseMetadataRaw', () => {
    it('should parse valid metadata', () => {
      const result = registry.parseMetadataRaw(sampleMetadata, 'test.json');

      expect(result).not.toBeNull();
      expect(result.songName).toBe('Bopeebo');
      expect(result.artist).toBe('Kawai Sprite');
      expect(result.variation).toBe('default');
    });

    it('should parse minimal metadata', () => {
      const result = registry.parseMetadataRaw(minimalMetadata, 'minimal.json');

      expect(result).not.toBeNull();
      expect(result.songName).toBe('Test Song');
      expect(result.artist).toBe('Unknown');
    });

    it('should return null for invalid data', () => {
      expect(registry.parseMetadataRaw(null, 'null.json')).toBeNull();
      expect(registry.parseMetadataRaw('string', 'string.json')).toBeNull();
      expect(registry.parseMetadataRaw(123, 'number.json')).toBeNull();
    });

    it('should return null for missing songName', () => {
      const invalid = { ...minimalMetadata, songName: undefined };
      expect(registry.parseMetadataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should return null for missing timeChanges', () => {
      const invalid = { ...minimalMetadata, timeChanges: undefined };
      expect(registry.parseMetadataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should return null for missing playData', () => {
      const invalid = { ...minimalMetadata, playData: undefined };
      expect(registry.parseMetadataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should set variation from parameter', () => {
      const result = registry.parseMetadataRaw(sampleMetadata, 'test.json', 'erect');
      expect(result.variation).toBe('erect');
    });
  });

  describe('parseChartDataRaw', () => {
    it('should parse valid chart data', () => {
      const result = registry.parseChartDataRaw(sampleChartData, 'chart.json');

      expect(result).not.toBeNull();
      expect(result.scrollSpeed.normal).toBe(1.3);
      expect(result.events).toHaveLength(2);
      expect(Object.keys(result.notes)).toHaveLength(3);
    });

    it('should return null for invalid data', () => {
      expect(registry.parseChartDataRaw(null, 'null.json')).toBeNull();
    });

    it('should return null for missing notes', () => {
      const invalid = { ...sampleChartData, notes: undefined };
      expect(registry.parseChartDataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should provide default scrollSpeed if missing', () => {
      const noScroll = { ...sampleChartData, scrollSpeed: undefined };
      const result = registry.parseChartDataRaw(noScroll, 'test.json');

      expect(result).not.toBeNull();
      expect(result.scrollSpeed.normal).toBe(1.0);
    });

    it('should set variation from parameter', () => {
      const result = registry.parseChartDataRaw(sampleChartData, 'chart.json', 'pico');
      expect(result.variation).toBe('pico');
    });
  });

  describe('createEntry', () => {
    it('should create entry from metadata', () => {
      const metadata = registry.parseMetadataRaw(sampleMetadata, 'test.json');
      const entry = registry.createEntry('bopeebo', metadata);

      expect(entry).not.toBeNull();
      expect(entry.id).toBe('bopeebo');
      expect(entry.metadata.songName).toBe('Bopeebo');
      expect(entry.variations).toContain('default');
      expect(entry.variations).toContain('erect');
      expect(entry.difficulties).toContain('normal');
    });

    it('should return null for null data', () => {
      expect(registry.createEntry('test', null)).toBeNull();
    });
  });

  describe('loadEntries', () => {
    it('should load entries with mock data', () => {
      // Create a test subclass that provides mock data
      class TestSongRegistry extends SongRegistry {
        constructor() {
          super();
          this.mockData = new Map();
        }
        setMockData(id, data) {
          this.mockData.set(id, data);
        }
        parseEntryData(id) {
          const raw = this.mockData.get(id);
          return raw ? this.parseMetadataRaw(raw, `${id}.json`) : null;
        }
      }

      const testRegistry = new TestSongRegistry();
      testRegistry.setMockData('bopeebo', sampleMetadata);
      testRegistry.setMockData('fresh', { ...sampleMetadata, songName: 'Fresh' });

      testRegistry.loadEntries(['bopeebo', 'fresh']);

      expect(testRegistry.loaded).toBe(true);
      expect(testRegistry.countEntries()).toBe(2);
      expect(testRegistry.hasEntry('bopeebo')).toBe(true);
      expect(testRegistry.hasEntry('fresh')).toBe(true);
    });
  });


  describe('Chart Cache', () => {
    it('should cache chart data', () => {
      const chartData = registry.parseChartDataRaw(sampleChartData, 'chart.json');
      registry.cacheChartData('bopeebo', 'default', chartData);

      expect(registry.hasChartData('bopeebo', 'default')).toBe(true);
      expect(registry.getChartData('bopeebo', 'default')).toBe(chartData);
    });

    it('should return null for uncached chart', () => {
      expect(registry.getChartData('nonexistent', 'default')).toBeNull();
      expect(registry.hasChartData('nonexistent', 'default')).toBe(false);
    });

    it('should cache multiple variations', () => {
      const defaultChart = registry.parseChartDataRaw(sampleChartData, 'chart.json', 'default');
      const erectChart = registry.parseChartDataRaw(
        { ...sampleChartData, scrollSpeed: { easy: 1.5, normal: 1.6, hard: 1.9 } },
        'chart-erect.json',
        'erect'
      );

      registry.cacheChartData('bopeebo', 'default', defaultChart);
      registry.cacheChartData('bopeebo', 'erect', erectChart);

      expect(registry.getChartData('bopeebo', 'default').scrollSpeed.normal).toBe(1.3);
      expect(registry.getChartData('bopeebo', 'erect').scrollSpeed.normal).toBe(1.6);
    });

    it('should clear chart cache for specific song', () => {
      const chartData = registry.parseChartDataRaw(sampleChartData, 'chart.json');
      registry.cacheChartData('bopeebo', 'default', chartData);
      registry.cacheChartData('fresh', 'default', chartData);

      registry.clearChartCache('bopeebo');

      expect(registry.hasChartData('bopeebo', 'default')).toBe(false);
      expect(registry.hasChartData('fresh', 'default')).toBe(true);
    });

    it('should clear all chart cache', () => {
      const chartData = registry.parseChartDataRaw(sampleChartData, 'chart.json');
      registry.cacheChartData('bopeebo', 'default', chartData);
      registry.cacheChartData('fresh', 'default', chartData);

      registry.clearChartCache();

      expect(registry.hasChartData('bopeebo', 'default')).toBe(false);
      expect(registry.hasChartData('fresh', 'default')).toBe(false);
    });
  });

  describe('Path Methods', () => {
    it('should generate correct metadata path', () => {
      expect(registry.getMetadataPath('bopeebo')).toBe('data/songs/bopeebo/bopeebo-metadata.json');
      expect(registry.getMetadataPath('bopeebo', 'default')).toBe(
        'data/songs/bopeebo/bopeebo-metadata.json'
      );
      expect(registry.getMetadataPath('bopeebo', 'erect')).toBe(
        'data/songs/bopeebo/bopeebo-metadata-erect.json'
      );
    });

    it('should generate correct chart path', () => {
      expect(registry.getChartPath('bopeebo')).toBe('data/songs/bopeebo/bopeebo-chart.json');
      expect(registry.getChartPath('bopeebo', 'pico')).toBe(
        'data/songs/bopeebo/bopeebo-chart-pico.json'
      );
    });

    it('should generate correct instrumental path', () => {
      expect(registry.getInstrumentalPath('bopeebo')).toBe('songs/bopeebo/Inst');
      expect(registry.getInstrumentalPath('bopeebo', 'erect')).toBe('songs/bopeebo/Inst-erect');
    });

    it('should generate correct voices path', () => {
      expect(registry.getVoicesPath('bopeebo')).toBe('songs/bopeebo/Voices');
      expect(registry.getVoicesPath('bopeebo', 'pico')).toBe('songs/bopeebo/Voices-pico');
    });
  });

  describe('Song Display Info', () => {
    beforeEach(() => {
      // Setup test data
      class TestSongRegistry extends SongRegistry {
        constructor() {
          super();
          this.mockData = new Map();
        }
        setMockData(id, data) {
          this.mockData.set(id, data);
        }
        parseEntryData(id) {
          const raw = this.mockData.get(id);
          return raw ? this.parseMetadataRaw(raw, `${id}.json`) : null;
        }
      }

      SongRegistry.instance = null;
      registry = new TestSongRegistry();
      registry.setMockData('bopeebo', sampleMetadata);
      registry.loadEntries(['bopeebo']);
    });

    it('should return display info for existing song', () => {
      const info = registry.getSongDisplayInfo('bopeebo');

      expect(info).not.toBeNull();
      expect(info.id).toBe('bopeebo');
      expect(info.name).toBe('Bopeebo');
      expect(info.artist).toBe('Kawai Sprite');
      expect(info.bpm).toBe(100);
      expect(info.stage).toBe('mainStage');
    });

    it('should return null for non-existent song', () => {
      expect(registry.getSongDisplayInfo('nonexistent')).toBeNull();
    });
  });

  describe('Listing Methods', () => {
    beforeEach(() => {
      class TestSongRegistry extends SongRegistry {
        constructor() {
          super();
          this.mockData = new Map();
        }
        setMockData(id, data) {
          this.mockData.set(id, data);
        }
        parseEntryData(id) {
          const raw = this.mockData.get(id);
          return raw ? this.parseMetadataRaw(raw, `${id}.json`) : null;
        }
      }

      SongRegistry.instance = null;
      registry = new TestSongRegistry();
      registry.setMockData('bopeebo', sampleMetadata);
      registry.setMockData('fresh', {
        ...sampleMetadata,
        songName: 'Fresh',
        playData: { ...sampleMetadata.playData, difficulties: ['normal', 'hard'] }
      });
      registry.loadEntries(['bopeebo', 'fresh']);
    });

    it('should list all song IDs', () => {
      const ids = registry.listSongIds();
      expect(ids).toContain('bopeebo');
      expect(ids).toContain('fresh');
    });

    it('should list all difficulties', () => {
      const diffs = registry.listAllDifficulties();
      expect(diffs).toContain('easy');
      expect(diffs).toContain('normal');
      expect(diffs).toContain('hard');
    });

    it('should get songs by difficulty', () => {
      const easySongs = registry.getSongsByDifficulty('easy');
      expect(easySongs).toHaveLength(1);
      expect(easySongs[0].id).toBe('bopeebo');

      const normalSongs = registry.getSongsByDifficulty('normal');
      expect(normalSongs).toHaveLength(2);
    });

    it('should get song variations', () => {
      const variations = registry.getSongVariations('bopeebo');
      expect(variations).toContain('default');
      expect(variations).toContain('erect');
      expect(variations).toContain('pico');
    });

    it('should get song difficulties', () => {
      const diffs = registry.getSongDifficulties('bopeebo');
      expect(diffs).toContain('easy');
      expect(diffs).toContain('normal');
      expect(diffs).toContain('hard');
    });
  });

  describe('Version Validation', () => {
    it('should accept valid metadata versions', () => {
      const v220 = { ...sampleMetadata, version: '2.2.0' };
      const v224 = { ...sampleMetadata, version: '2.2.4' };
      const v229 = { ...sampleMetadata, version: '2.2.9' };

      expect(registry.parseMetadataRaw(v220, 'test.json')).not.toBeNull();
      expect(registry.parseMetadataRaw(v224, 'test.json')).not.toBeNull();
      expect(registry.parseMetadataRaw(v229, 'test.json')).not.toBeNull();
    });

    it('should reject incompatible metadata versions', () => {
      const v100 = { ...sampleMetadata, version: '1.0.0' };
      const v300 = { ...sampleMetadata, version: '3.0.0' };

      expect(registry.parseMetadataRaw(v100, 'test.json')).toBeNull();
      expect(registry.parseMetadataRaw(v300, 'test.json')).toBeNull();
    });

    it('should accept valid chart versions', () => {
      const v200 = { ...sampleChartData, version: '2.0.0' };
      const v205 = { ...sampleChartData, version: '2.0.5' };

      expect(registry.parseChartDataRaw(v200, 'test.json')).not.toBeNull();
      expect(registry.parseChartDataRaw(v205, 'test.json')).not.toBeNull();
    });

    it('should reject incompatible chart versions', () => {
      const v100 = { ...sampleChartData, version: '1.0.0' };
      const v300 = { ...sampleChartData, version: '3.0.0' };

      expect(registry.parseChartDataRaw(v100, 'test.json')).toBeNull();
      expect(registry.parseChartDataRaw(v300, 'test.json')).toBeNull();
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      expect(registry.toString()).toContain('SongRegistry');
      expect(registry.toString()).toContain('0 songs');
    });
  });
});

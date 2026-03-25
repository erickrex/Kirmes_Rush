/**
 * @fileoverview Unit tests for the NoteStyleRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import NoteStyleRegistry from '../src/data/registries/NoteStyleRegistry.js';
import { getSharedRegistryPath } from '../src/utils/GameDataPaths.js';

// Sample note style data based on actual FNF format (funkin.json)
const sampleFunkinStyle = {
  version: '1.1.0',
  name: "Funkin'",
  author: 'PhantomArcade',
  fallback: null,
  assets: {
    note: {
      assetPath: 'shared:notes',
      scale: 0.7,
      data: {
        left: { prefix: 'noteLeft' },
        down: { prefix: 'noteDown' },
        up: { prefix: 'noteUp' },
        right: { prefix: 'noteRight' }
      }
    },
    noteStrumline: {
      assetPath: 'shared:noteStrumline',
      scale: 0.7,
      offsets: [0, 0],
      data: {
        leftStatic: { prefix: 'staticLeft0' },
        leftPress: { prefix: 'pressLeft0' },
        leftConfirm: { prefix: 'confirmLeft0' },
        downStatic: { prefix: 'staticDown0' },
        downPress: { prefix: 'pressDown0' },
        downConfirm: { prefix: 'confirmDown0' },
        upStatic: { prefix: 'staticUp0' },
        upPress: { prefix: 'pressUp0' },
        upConfirm: { prefix: 'confirmUp0' },
        rightStatic: { prefix: 'staticRight0' },
        rightPress: { prefix: 'pressRight0' },
        rightConfirm: { prefix: 'confirmRight0' }
      }
    },
    noteSplash: {
      assetPath: 'shared:noteSplashes',
      alpha: 0.8,
      offsets: [25, -5],
      data: {
        enabled: true,
        leftSplashes: [{ prefix: 'note impact 1 purple0' }],
        downSplashes: [{ prefix: 'note impact 1 blue0' }],
        upSplashes: [{ prefix: 'note impact 1 green0' }],
        rightSplashes: [{ prefix: 'note impact 1 red0' }]
      }
    },
    judgementSick: {
      assetPath: 'default:ui/popup/funkin/sick',
      scale: 0.65,
      isPixel: false
    },
    judgementGood: {
      assetPath: 'default:ui/popup/funkin/good',
      scale: 0.65
    },
    comboNumber0: {
      assetPath: 'default:ui/popup/funkin/num0',
      scale: 0.45
    },
    countdownTwo: {
      assetPath: 'shared:ui/countdown/funkin/ready',
      scale: 1.0,
      data: {
        audioPath: 'shared:gameplay/countdown/funkin/introTWO'
      }
    }
  }
};

// Pixel note style with fallback
const samplePixelStyle = {
  version: '1.1.0',
  name: 'Pixel',
  author: 'Moawling',
  fallback: 'funkin',
  assets: {
    note: {
      assetPath: 'week6:weeb/pixelUI/arrows-pixels',
      scale: 6.0,
      isPixel: true,
      data: {
        left: { prefix: 'noteLeft' },
        down: { prefix: 'noteDown' },
        up: { prefix: 'noteUp' },
        right: { prefix: 'noteRight' }
      }
    },
    noteStrumline: {
      assetPath: 'week6:weeb/pixelUI/arrows-pixels',
      scale: 6.0,
      offsets: [28, 32],
      isPixel: true,
      data: {
        leftStatic: { prefix: 'staticLeft0' },
        leftPress: { prefix: 'pressedLeft0' },
        leftConfirm: { prefix: 'confirmLeft0' }
      }
    },
    noteSplash: {
      assetPath: 'week6:pixelNoteSplash',
      scale: 4.0,
      isPixel: true,
      data: {
        enabled: true,
        leftSplashes: [{ prefix: 'purple1' }]
      }
    }
  }
};

// Minimal valid style
const minimalStyle = {
  version: '1.1.0',
  name: 'Minimal',
  assets: {
    note: {
      assetPath: 'notes'
    }
  }
};

describe('NoteStyleRegistry', () => {
  let registry;

  beforeEach(() => {
    NoteStyleRegistry.instance = null;
    registry = NoteStyleRegistry.getInstance();
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = NoteStyleRegistry.getInstance();
      const instance2 = NoteStyleRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should have correct registry ID', () => {
      expect(registry.registryId).toBe('NOTESTYLE');
    });

    it('should have correct data path', () => {
      expect(registry.dataFilePath).toBe(getSharedRegistryPath('notestyles'));
    });
  });

  describe('Static Constants', () => {
    it('should expose ASSET_KEYS', () => {
      expect(NoteStyleRegistry.ASSET_KEYS.NOTE).toBe('note');
      expect(NoteStyleRegistry.ASSET_KEYS.STRUMLINE).toBe('noteStrumline');
      expect(NoteStyleRegistry.ASSET_KEYS.SPLASH).toBe('noteSplash');
    });

    it('should expose DIRECTIONS', () => {
      expect(NoteStyleRegistry.DIRECTIONS).toEqual(['left', 'down', 'up', 'right']);
    });
  });

  describe('parseEntryDataRaw', () => {
    it('should parse valid note style data', () => {
      const result = registry.parseEntryDataRaw(sampleFunkinStyle, 'funkin.json');

      expect(result).not.toBeNull();
      expect(result.name).toBe("Funkin'");
      expect(result.author).toBe('PhantomArcade');
      expect(result.fallback).toBeNull();
    });

    it('should parse pixel style with fallback', () => {
      const result = registry.parseEntryDataRaw(samplePixelStyle, 'pixel.json');

      expect(result).not.toBeNull();
      expect(result.name).toBe('Pixel');
      expect(result.fallback).toBe('funkin');
    });

    it('should parse minimal style', () => {
      const result = registry.parseEntryDataRaw(minimalStyle, 'minimal.json');

      expect(result).not.toBeNull();
      expect(result.name).toBe('Minimal');
    });

    it('should return null for invalid data', () => {
      expect(registry.parseEntryDataRaw(null, 'null.json')).toBeNull();
      expect(registry.parseEntryDataRaw('string', 'string.json')).toBeNull();
    });

    it('should return null for missing assets', () => {
      const invalid = { version: '1.1.0', name: 'Invalid' };
      expect(registry.parseEntryDataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should return null for invalid assets format', () => {
      const invalid = { version: '1.1.0', name: 'Invalid', assets: 'not an object' };
      expect(registry.parseEntryDataRaw(invalid, 'invalid.json')).toBeNull();
    });
  });

  describe('cleanAssetData', () => {
    it('should set default asset values', () => {
      const result = registry.parseEntryDataRaw(minimalStyle, 'test.json');
      const noteAsset = result.assets.note;

      expect(noteAsset.scale).toBe(1);
      expect(noteAsset.isPixel).toBe(false);
      expect(noteAsset.offsets).toEqual([0, 0]);
      expect(noteAsset.alpha).toBe(1);
    });

    it('should preserve provided values', () => {
      const result = registry.parseEntryDataRaw(sampleFunkinStyle, 'funkin.json');
      const noteAsset = result.assets.note;

      expect(noteAsset.scale).toBe(0.7);
    });
  });

  describe('createEntry', () => {
    it('should create entry from style data', () => {
      const data = registry.parseEntryDataRaw(sampleFunkinStyle, 'funkin.json');
      const entry = registry.createEntry('funkin', data);

      expect(entry).not.toBeNull();
      expect(entry.id).toBe('funkin');
      expect(entry.name).toBe("Funkin'");
      expect(entry.fallback).toBeNull();
      expect(entry.assetKeys).toContain('note');
      expect(entry.assetKeys).toContain('noteStrumline');
    });

    it('should return null for null data', () => {
      expect(registry.createEntry('test', null)).toBeNull();
    });
  });


  describe('Style Access Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestNoteStyleRegistry extends NoteStyleRegistry {
        constructor() {
          super();
          this.mockData = new Map();
        }
        setMockData(id, data) {
          this.mockData.set(id, data);
        }
        parseEntryData(id) {
          const raw = this.mockData.get(id);
          return raw ? this.parseEntryDataRaw(raw, `${id}.json`) : null;
        }
      }

      NoteStyleRegistry.instance = null;
      testRegistry = new TestNoteStyleRegistry();
      testRegistry.setMockData('funkin', sampleFunkinStyle);
      testRegistry.setMockData('pixel', samplePixelStyle);
      testRegistry.loadEntries(['funkin', 'pixel']);
    });

    it('should get style data', () => {
      const data = testRegistry.getStyleData('funkin');
      expect(data).not.toBeNull();
      expect(data.name).toBe("Funkin'");
    });

    it('should return null for non-existent style', () => {
      expect(testRegistry.getStyleData('nonexistent')).toBeNull();
    });

    it('should get style name', () => {
      expect(testRegistry.getStyleName('funkin')).toBe("Funkin'");
      expect(testRegistry.getStyleName('nonexistent')).toBe('nonexistent');
    });

    it('should get fallback', () => {
      expect(testRegistry.getFallback('funkin')).toBeNull();
      expect(testRegistry.getFallback('pixel')).toBe('funkin');
    });

    it('should get asset', () => {
      const noteAsset = testRegistry.getAsset('funkin', 'note');
      expect(noteAsset).not.toBeNull();
      expect(noteAsset.assetPath).toBe('shared:notes');
    });

    it('should return null for non-existent asset', () => {
      expect(testRegistry.getAsset('funkin', 'nonexistent')).toBeNull();
    });

    it('should fall back to fallback style for missing assets', () => {
      // pixel style doesn't have judgementSick, but funkin does
      const judgement = testRegistry.getAsset('pixel', 'judgementSick');
      expect(judgement).not.toBeNull();
      expect(judgement.assetPath).toBe('default:ui/popup/funkin/sick');
    });

    it('should check if style has asset', () => {
      expect(testRegistry.hasAsset('funkin', 'note')).toBe(true);
      expect(testRegistry.hasAsset('funkin', 'nonexistent')).toBe(false);
    });
  });

  describe('Note Data Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestNoteStyleRegistry extends NoteStyleRegistry {
        constructor() {
          super();
          this.mockData = new Map();
        }
        setMockData(id, data) {
          this.mockData.set(id, data);
        }
        parseEntryData(id) {
          const raw = this.mockData.get(id);
          return raw ? this.parseEntryDataRaw(raw, `${id}.json`) : null;
        }
      }

      NoteStyleRegistry.instance = null;
      testRegistry = new TestNoteStyleRegistry();
      testRegistry.setMockData('funkin', sampleFunkinStyle);
      testRegistry.loadEntries(['funkin']);
    });

    it('should get note data for direction', () => {
      const leftNote = testRegistry.getNoteData('funkin', 0);
      expect(leftNote).not.toBeNull();
      expect(leftNote.prefix).toBe('noteLeft');

      const rightNote = testRegistry.getNoteData('funkin', 3);
      expect(rightNote.prefix).toBe('noteRight');
    });

    it('should get strumline data for direction and state', () => {
      const leftStatic = testRegistry.getStrumlineData('funkin', 0, 'Static');
      expect(leftStatic).not.toBeNull();
      expect(leftStatic.prefix).toBe('staticLeft0');

      const downPress = testRegistry.getStrumlineData('funkin', 1, 'Press');
      expect(downPress.prefix).toBe('pressDown0');
    });

    it('should get splash data for direction', () => {
      const leftSplashes = testRegistry.getSplashData('funkin', 0);
      expect(leftSplashes).not.toBeNull();
      expect(leftSplashes).toHaveLength(1);
      expect(leftSplashes[0].prefix).toBe('note impact 1 purple0');
    });

    it('should check if splashes are enabled', () => {
      expect(testRegistry.areSplashesEnabled('funkin')).toBe(true);
    });

    it('should get judgement asset', () => {
      const sickAsset = testRegistry.getJudgementAsset('funkin', 'sick');
      expect(sickAsset).not.toBeNull();
      expect(sickAsset.scale).toBe(0.65);
    });

    it('should get combo number asset', () => {
      const num0Asset = testRegistry.getComboNumberAsset('funkin', 0);
      expect(num0Asset).not.toBeNull();
      expect(num0Asset.scale).toBe(0.45);
    });

    it('should get countdown asset', () => {
      const twoAsset = testRegistry.getCountdownAsset('funkin', 'Two');
      expect(twoAsset).not.toBeNull();
      expect(twoAsset.data.audioPath).toBe('shared:gameplay/countdown/funkin/introTWO');
    });
  });

  describe('Path Resolution', () => {
    it('should resolve shared: prefix', () => {
      const resolved = registry.resolveAssetPath('shared:notes');
      expect(resolved).toBe('shared/images/notes');
    });

    it('should resolve default: prefix', () => {
      const resolved = registry.resolveAssetPath('default:ui/popup/funkin/sick');
      expect(resolved).toBe('preload/images/ui/popup/funkin/sick');
    });

    it('should resolve week prefix', () => {
      const resolved = registry.resolveAssetPath('week6:weeb/pixelUI/arrows-pixels');
      expect(resolved).toBe('week6/images/weeb/pixelUI/arrows-pixels');
    });

    it('should handle paths without prefix', () => {
      const resolved = registry.resolveAssetPath('notes');
      expect(resolved).toBe('shared/images/notes');
    });

    it('should return null for null path', () => {
      expect(registry.resolveAssetPath(null)).toBeNull();
    });
  });

  describe('Listing Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestNoteStyleRegistry extends NoteStyleRegistry {
        constructor() {
          super();
          this.mockData = new Map();
        }
        setMockData(id, data) {
          this.mockData.set(id, data);
        }
        parseEntryData(id) {
          const raw = this.mockData.get(id);
          return raw ? this.parseEntryDataRaw(raw, `${id}.json`) : null;
        }
      }

      NoteStyleRegistry.instance = null;
      testRegistry = new TestNoteStyleRegistry();
      testRegistry.setMockData('funkin', sampleFunkinStyle);
      testRegistry.setMockData('pixel', samplePixelStyle);
      testRegistry.loadEntries(['funkin', 'pixel']);
    });

    it('should list all style IDs', () => {
      const ids = testRegistry.listStyleIds();
      expect(ids).toContain('funkin');
      expect(ids).toContain('pixel');
    });

    it('should get pixel styles', () => {
      const pixelStyles = testRegistry.getPixelStyles();
      expect(pixelStyles).toHaveLength(1);
      expect(pixelStyles[0].id).toBe('pixel');
    });

    it('should get style display info', () => {
      const info = testRegistry.getStyleDisplayInfo('funkin');

      expect(info).not.toBeNull();
      expect(info.id).toBe('funkin');
      expect(info.name).toBe("Funkin'");
      expect(info.author).toBe('PhantomArcade');
      expect(info.isPixel).toBe(false);
      expect(info.hasSplashes).toBe(true);
    });

    it('should detect pixel style in display info', () => {
      const info = testRegistry.getStyleDisplayInfo('pixel');
      expect(info.isPixel).toBe(true);
    });
  });

  describe('Asset Path Collection', () => {
    let testRegistry;

    beforeEach(() => {
      class TestNoteStyleRegistry extends NoteStyleRegistry {
        constructor() {
          super();
          this.mockData = new Map();
        }
        setMockData(id, data) {
          this.mockData.set(id, data);
        }
        parseEntryData(id) {
          const raw = this.mockData.get(id);
          return raw ? this.parseEntryDataRaw(raw, `${id}.json`) : null;
        }
      }

      NoteStyleRegistry.instance = null;
      testRegistry = new TestNoteStyleRegistry();
      testRegistry.setMockData('funkin', sampleFunkinStyle);
      testRegistry.setMockData('pixel', samplePixelStyle);
      testRegistry.loadEntries(['funkin', 'pixel']);
    });

    it('should get all asset paths for a style', () => {
      const paths = testRegistry.getAllAssetPaths('funkin');
      expect(paths).toContain('shared/images/notes');
      expect(paths).toContain('shared/images/noteStrumline');
      expect(paths).toContain('shared/images/noteSplashes');
    });

    it('should include fallback paths', () => {
      const paths = testRegistry.getAllAssetPaths('pixel');
      // Should include pixel's own paths
      expect(paths).toContain('week6/images/weeb/pixelUI/arrows-pixels');
      // Should also include funkin's paths via fallback
      expect(paths).toContain('preload/images/ui/popup/funkin/sick');
    });
  });

  describe('Version Validation', () => {
    it('should accept valid versions', () => {
      const v110 = { ...minimalStyle, version: '1.1.0' };
      const v115 = { ...minimalStyle, version: '1.1.5' };

      expect(registry.parseEntryDataRaw(v110, 'test.json')).not.toBeNull();
      expect(registry.parseEntryDataRaw(v115, 'test.json')).not.toBeNull();
    });

    it('should reject incompatible versions', () => {
      const v100 = { ...minimalStyle, version: '1.0.0' };
      const v200 = { ...minimalStyle, version: '2.0.0' };

      expect(registry.parseEntryDataRaw(v100, 'test.json')).toBeNull();
      expect(registry.parseEntryDataRaw(v200, 'test.json')).toBeNull();
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      expect(registry.toString()).toContain('NoteStyleRegistry');
      expect(registry.toString()).toContain('0 styles');
    });
  });
});

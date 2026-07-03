/**
 * @fileoverview Unit tests for the StageRegistry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StageRegistry from '../src/data/registries/StageRegistry.js';
import { getSharedRegistryPath } from '../src/utils/GameDataPaths.js';

// Sample stage data based on actual Rythm Foundation format (mainStage.json)
const sampleMainStage = {
  version: '1.0.0',
  name: 'Main Stage',
  directory: 'week1',
  cameraZoom: 1.1,
  props: [
    {
      name: 'stageBack',
      assetPath: 'stageback',
      animType: 'sparrow',
      position: [-600, -200],
      scale: [1, 1],
      scroll: [0.9, 0.9],
      zIndex: 10,
      isPixel: false,
      danceEvery: 0,
      animations: []
    },
    {
      name: 'stageFront',
      assetPath: 'stagefront',
      animType: 'sparrow',
      position: [-650, 600],
      scale: [1.1, 1.1],
      scroll: [0.9, 0.9],
      zIndex: 20,
      isPixel: false,
      danceEvery: 0,
      animations: []
    },
    {
      name: 'stageCurtains',
      assetPath: 'stagecurtains',
      animType: 'sparrow',
      position: [-500, -300],
      scale: [0.9, 0.9],
      scroll: [1.3, 1.3],
      zIndex: 30,
      isPixel: false,
      danceEvery: 0,
      animations: []
    }
  ],
  characters: {
    bf: {
      position: [989.5, 885],
      zIndex: 300,
      cameraOffsets: [-100, -100]
    },
    dad: {
      position: [335, 885],
      zIndex: 200,
      cameraOffsets: [150, -100]
    },
    gf: {
      position: [751.5, 787],
      zIndex: 100,
      cameraOffsets: [0, 0]
    }
  }
};

// Stage with animated props
const animatedStage = {
  version: '1.0.0',
  name: 'Animated Stage',
  directory: 'week2',
  cameraZoom: 1.0,
  props: [
    {
      name: 'dancingProp',
      assetPath: 'dancer',
      animType: 'sparrow',
      position: [0, 0],
      scale: [1, 1],
      scroll: [1, 1],
      zIndex: 50,
      danceEvery: 2,
      animations: [
        { name: 'dance', prefix: 'dance_anim', frameRate: 24, looped: true }
      ],
      startingAnimation: 'dance'
    }
  ],
  characters: {
    bf: { position: [800, 600], zIndex: 300 },
    dad: { position: [200, 600], zIndex: 200 },
    gf: { position: [500, 400], zIndex: 100 }
  }
};

// Minimal valid stage data
const minimalStage = {
  version: '1.0.0',
  name: 'Minimal Stage'
};

describe('StageRegistry', () => {
  let registry;

  beforeEach(() => {
    StageRegistry.instance = null;
    registry = StageRegistry.getInstance();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = StageRegistry.getInstance();
      const instance2 = StageRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should have correct registry ID', () => {
      expect(registry.registryId).toBe('STAGE');
    });

    it('should have correct data path', () => {
      expect(registry.dataFilePath).toBe(getSharedRegistryPath('stages'));
    });
  });

  describe('parseEntryDataRaw', () => {
    it('should parse valid stage data', () => {
      const result = registry.parseEntryDataRaw(sampleMainStage, 'mainStage.json');

      expect(result).not.toBeNull();
      expect(result.name).toBe('Main Stage');
      expect(result.directory).toBe('week1');
      expect(result.cameraZoom).toBe(1.1);
      expect(result.props).toHaveLength(3);
    });

    it('should parse minimal stage data', () => {
      const result = registry.parseEntryDataRaw(minimalStage, 'minimal.json');

      expect(result).not.toBeNull();
      expect(result.name).toBe('Minimal Stage');
      expect(result.props).toHaveLength(0);
      expect(result.cameraZoom).toBe(1.0);
    });

    it('should return null for invalid data', () => {
      expect(registry.parseEntryDataRaw(null, 'null.json')).toBeNull();
      expect(registry.parseEntryDataRaw('string', 'string.json')).toBeNull();
      expect(registry.parseEntryDataRaw(123, 'number.json')).toBeNull();
    });

    it('should return null for invalid props format', () => {
      const invalid = { ...minimalStage, props: 'not an array' };
      expect(registry.parseEntryDataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should parse animated stage data', () => {
      const result = registry.parseEntryDataRaw(animatedStage, 'animated.json');

      expect(result).not.toBeNull();
      expect(result.props[0].danceEvery).toBe(2);
      expect(result.props[0].animations).toHaveLength(1);
      expect(result.props[0].startingAnimation).toBe('dance');
    });
  });

  describe('cleanStageData', () => {
    it('should set default values for missing fields', () => {
      const result = registry.parseEntryDataRaw(minimalStage, 'test.json');

      expect(result.cameraZoom).toBe(1.0);
      expect(result.directory).toBeNull();
      expect(result.props).toEqual([]);
    });

    it('should provide default character positions', () => {
      const result = registry.parseEntryDataRaw(minimalStage, 'test.json');

      expect(result.characters.bf).toBeDefined();
      expect(result.characters.dad).toBeDefined();
      expect(result.characters.gf).toBeDefined();
      expect(result.characters.bf.position).toEqual([0, 0]);
    });
  });

  describe('cleanPropData', () => {
    it('should set default prop values', () => {
      const stageWithMinimalProp = {
        ...minimalStage,
        props: [{ name: 'test', assetPath: 'test' }]
      };
      const result = registry.parseEntryDataRaw(stageWithMinimalProp, 'test.json');
      const prop = result.props[0];

      expect(prop.animType).toBe('sparrow');
      expect(prop.position).toEqual([0, 0]);
      expect(prop.scale).toEqual([1, 1]);
      expect(prop.scroll).toEqual([1, 1]);
      expect(prop.zIndex).toBe(0);
      expect(prop.isPixel).toBe(false);
      expect(prop.danceEvery).toBe(0);
      expect(prop.alpha).toBe(1);
    });
  });

  describe('createEntry', () => {
    it('should create entry from stage data', () => {
      const data = registry.parseEntryDataRaw(sampleMainStage, 'mainStage.json');
      const entry = registry.createEntry('mainStage', data);

      expect(entry).not.toBeNull();
      expect(entry.id).toBe('mainStage');
      expect(entry.name).toBe('Main Stage');
      expect(entry.propNames).toContain('stageBack');
      expect(entry.propNames).toContain('stageFront');
      expect(entry.propNames).toContain('stageCurtains');
    });

    it('should return null for null data', () => {
      expect(registry.createEntry('test', null)).toBeNull();
    });
  });


  describe('Stage Access Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestStageRegistry extends StageRegistry {
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

      StageRegistry.instance = null;
      testRegistry = new TestStageRegistry();
      testRegistry.setMockData('mainStage', sampleMainStage);
      testRegistry.setMockData('animated', animatedStage);
      testRegistry.loadEntries(['mainStage', 'animated']);
    });

    it('should get stage data', () => {
      const data = testRegistry.getStageData('mainStage');
      expect(data).not.toBeNull();
      expect(data.name).toBe('Main Stage');
    });

    it('should return null for non-existent stage', () => {
      expect(testRegistry.getStageData('nonexistent')).toBeNull();
    });

    it('should get stage name', () => {
      expect(testRegistry.getStageName('mainStage')).toBe('Main Stage');
      expect(testRegistry.getStageName('nonexistent')).toBe('nonexistent');
    });

    it('should get stage props', () => {
      const props = testRegistry.getStageProps('mainStage');
      expect(props).toHaveLength(3);
    });

    it('should get props sorted by z-index', () => {
      const props = testRegistry.getPropsSortedByZIndex('mainStage');
      expect(props[0].name).toBe('stageBack'); // zIndex 10
      expect(props[1].name).toBe('stageFront'); // zIndex 20
      expect(props[2].name).toBe('stageCurtains'); // zIndex 30
    });

    it('should get specific prop', () => {
      const prop = testRegistry.getProp('mainStage', 'stageFront');
      expect(prop).not.toBeNull();
      expect(prop.assetPath).toBe('stagefront');
    });

    it('should return null for non-existent prop', () => {
      expect(testRegistry.getProp('mainStage', 'nonexistent')).toBeNull();
    });

    it('should get character positions', () => {
      const positions = testRegistry.getCharacterPositions('mainStage');
      expect(positions).not.toBeNull();
      expect(positions.bf.position).toEqual([989.5, 885]);
      expect(positions.dad.position).toEqual([335, 885]);
      expect(positions.gf.position).toEqual([751.5, 787]);
    });

    it('should get specific character position', () => {
      const bfPos = testRegistry.getCharacterPosition('mainStage', 'bf');
      expect(bfPos).not.toBeNull();
      expect(bfPos.position).toEqual([989.5, 885]);
      expect(bfPos.zIndex).toBe(300);
      expect(bfPos.cameraOffsets).toEqual([-100, -100]);
    });

    it('should get camera zoom', () => {
      expect(testRegistry.getCameraZoom('mainStage')).toBe(1.1);
      expect(testRegistry.getCameraZoom('animated')).toBe(1.0);
    });

    it('should get directory', () => {
      expect(testRegistry.getDirectory('mainStage')).toBe('week1');
      expect(testRegistry.getDirectory('animated')).toBe('week2');
    });
  });

  describe('Listing Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestStageRegistry extends StageRegistry {
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

      StageRegistry.instance = null;
      testRegistry = new TestStageRegistry();
      testRegistry.setMockData('mainStage', sampleMainStage);
      testRegistry.setMockData('animated', animatedStage);
      testRegistry.loadEntries(['mainStage', 'animated']);
    });

    it('should list all stage IDs', () => {
      const ids = testRegistry.listStageIds();
      expect(ids).toContain('mainStage');
      expect(ids).toContain('animated');
    });

    it('should get stages by directory', () => {
      const week1Stages = testRegistry.getStagesByDirectory('week1');
      expect(week1Stages).toHaveLength(1);
      expect(week1Stages[0].id).toBe('mainStage');

      const week2Stages = testRegistry.getStagesByDirectory('week2');
      expect(week2Stages).toHaveLength(1);
      expect(week2Stages[0].id).toBe('animated');
    });

    it('should get stage display info', () => {
      const info = testRegistry.getStageDisplayInfo('mainStage');

      expect(info).not.toBeNull();
      expect(info.id).toBe('mainStage');
      expect(info.name).toBe('Main Stage');
      expect(info.directory).toBe('week1');
      expect(info.cameraZoom).toBe(1.1);
      expect(info.propCount).toBe(3);
      expect(info.hasAnimatedProps).toBe(false);
    });

    it('should detect animated props in display info', () => {
      const info = testRegistry.getStageDisplayInfo('animated');
      expect(info.hasAnimatedProps).toBe(true);
    });
  });

  describe('Path Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestStageRegistry extends StageRegistry {
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

      StageRegistry.instance = null;
      testRegistry = new TestStageRegistry();
      testRegistry.setMockData('mainStage', sampleMainStage);
      testRegistry.loadEntries(['mainStage']);
    });

    it('should get stage path', () => {
      expect(testRegistry.getStagePath('mainStage')).toBe(`${getSharedRegistryPath('stages')}/mainStage.json`);
    });

    it('should get prop asset path with directory', () => {
      const path = testRegistry.getPropAssetPath('mainStage', 'stageBack');
      expect(path).toBe('images/week1/stageback');
    });

    it('should return null for non-existent prop asset path', () => {
      expect(testRegistry.getPropAssetPath('mainStage', 'nonexistent')).toBeNull();
    });

    it('should get all asset paths', () => {
      const paths = testRegistry.getAllAssetPaths('mainStage');
      expect(paths).toContain('images/week1/stageback');
      expect(paths).toContain('images/week1/stagefront');
      expect(paths).toContain('images/week1/stagecurtains');
    });
  });

  describe('Version Validation', () => {
    it('should accept valid versions', () => {
      const v100 = { ...minimalStage, version: '1.0.0' };
      const v105 = { ...minimalStage, version: '1.0.5' };

      expect(registry.parseEntryDataRaw(v100, 'test.json')).not.toBeNull();
      expect(registry.parseEntryDataRaw(v105, 'test.json')).not.toBeNull();
    });

    it('should reject incompatible versions', () => {
      const v200 = { ...minimalStage, version: '2.0.0' };
      const v110 = { ...minimalStage, version: '1.1.0' };

      expect(registry.parseEntryDataRaw(v200, 'test.json')).toBeNull();
      expect(registry.parseEntryDataRaw(v110, 'test.json')).toBeNull();
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      expect(registry.toString()).toContain('StageRegistry');
      expect(registry.toString()).toContain('0 stages');
    });
  });
});

/**
 * @fileoverview Unit tests for the CharacterRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CharacterRegistry from '../src/data/registries/CharacterRegistry.js';

// Sample character data based on actual FNF format (bf.json)
const sampleBfData = {
  version: '1.0.0',
  name: 'Boyfriend',
  renderType: 'multisparrow',
  assetPath: 'characters/BOYFRIEND',
  flipX: true,
  singTime: 8.0,
  animations: [
    { name: 'idle', prefix: 'BF idle dance', offsets: [-5, 0] },
    { name: 'singLEFT', prefix: 'BF NOTE LEFT0', offsets: [12, -6] },
    { name: 'singDOWN', prefix: 'BF NOTE DOWN0', offsets: [-10, -50] },
    { name: 'singUP', prefix: 'BF NOTE UP0', offsets: [-29, 27] },
    { name: 'singRIGHT', prefix: 'BF NOTE RIGHT0', offsets: [-38, -7] },
    { name: 'singLEFTmiss', prefix: 'BF NOTE LEFT MISS', offsets: [12, 24] },
    { name: 'singDOWNmiss', prefix: 'BF NOTE DOWN MISS', offsets: [-11, -19] },
    { name: 'singUPmiss', prefix: 'BF NOTE UP MISS', offsets: [-29, 27] },
    { name: 'singRIGHTmiss', prefix: 'BF NOTE RIGHT MISS', offsets: [-30, 21] },
    { name: 'hey', prefix: 'BF HEY!!', offsets: [7, 4] },
    { name: 'firstDeath', prefix: 'BF dies', offsets: [-37, 11] },
    { name: 'deathLoop', prefix: 'BF Dead Loop', looped: true, offsets: [-37, 5] },
    { name: 'deathConfirm', prefix: 'BF Dead confirm', offsets: [-37, 69] }
  ]
};

// Sample opponent character data (dad.json)
const sampleDadData = {
  version: '1.0.0',
  name: 'Daddy Dearest',
  assetPath: 'characters/daddyDearest',
  singTime: 8.0,
  animations: [
    { name: 'idle', prefix: 'idle', offsets: [0, 0] },
    { name: 'singLEFT', prefix: 'singLEFT', offsets: [-10, 10] },
    { name: 'singDOWN', prefix: 'singDOWN', offsets: [0, -30] },
    { name: 'singUP', prefix: 'singUP', offsets: [-6, 50] },
    { name: 'singRIGHT', prefix: 'singRIGHT', offsets: [0, 27] }
  ]
};

// Minimal valid character data
const minimalCharData = {
  version: '1.0.0',
  assetPath: 'characters/test',
  animations: [{ name: 'idle', prefix: 'idle' }]
};

// Pixel character data
const pixelCharData = {
  version: '1.0.0',
  name: 'Senpai',
  renderType: 'sparrow',
  assetPath: 'characters/senpai',
  isPixel: true,
  scale: 6,
  animations: [
    { name: 'idle', prefix: 'Senpai Idle', offsets: [0, 0] },
    { name: 'singLEFT', prefix: 'SENPAI LEFT NOTE', offsets: [0, 0] },
    { name: 'singDOWN', prefix: 'SENPAI DOWN NOTE', offsets: [0, 0] },
    { name: 'singUP', prefix: 'SENPAI UP NOTE', offsets: [0, 0] },
    { name: 'singRIGHT', prefix: 'SENPAI RIGHT NOTE', offsets: [0, 0] }
  ],
  healthIcon: {
    id: 'senpai',
    isPixel: true,
    scale: 1
  }
};

describe('CharacterRegistry', () => {
  let registry;

  beforeEach(() => {
    // Create fresh instance for each test
    CharacterRegistry.instance = null;
    registry = CharacterRegistry.getInstance();
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = CharacterRegistry.getInstance();
      const instance2 = CharacterRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should have correct registry ID', () => {
      expect(registry.registryId).toBe('CHARACTER');
    });

    it('should have correct data path', () => {
      expect(registry.dataFilePath).toBe('data/characters');
    });
  });

  describe('Static Constants', () => {
    it('should expose RenderType constants', () => {
      expect(CharacterRegistry.RenderType.SPARROW).toBe('sparrow');
      expect(CharacterRegistry.RenderType.PACKER).toBe('packer');
      expect(CharacterRegistry.RenderType.MULTI_SPARROW).toBe('multisparrow');
      expect(CharacterRegistry.RenderType.ANIMATE_ATLAS).toBe('animateatlas');
      expect(CharacterRegistry.RenderType.CUSTOM).toBe('custom');
    });

    it('should expose default values', () => {
      expect(CharacterRegistry.DEFAULTS.SING_TIME).toBe(8.0);
      expect(CharacterRegistry.DEFAULTS.DANCE_EVERY).toBe(1.0);
      expect(CharacterRegistry.DEFAULTS.FRAME_RATE).toBe(24);
      expect(CharacterRegistry.DEFAULTS.SCALE).toBe(1);
    });
  });

  describe('parseEntryDataRaw', () => {
    it('should parse valid character data', () => {
      const result = registry.parseEntryDataRaw(sampleBfData, 'bf.json');

      expect(result).not.toBeNull();
      expect(result.name).toBe('Boyfriend');
      expect(result.renderType).toBe('multisparrow');
      expect(result.assetPath).toBe('characters/BOYFRIEND');
      expect(result.flipX).toBe(true);
    });

    it('should parse minimal character data', () => {
      const result = registry.parseEntryDataRaw(minimalCharData, 'minimal.json');

      expect(result).not.toBeNull();
      expect(result.name).toBe('Untitled Character');
      expect(result.renderType).toBe('sparrow');
      expect(result.scale).toBe(1);
    });

    it('should return null for invalid data', () => {
      expect(registry.parseEntryDataRaw(null, 'null.json')).toBeNull();
      expect(registry.parseEntryDataRaw('string', 'string.json')).toBeNull();
      expect(registry.parseEntryDataRaw(123, 'number.json')).toBeNull();
    });

    it('should return null for missing assetPath', () => {
      const invalid = { ...minimalCharData, assetPath: undefined };
      expect(registry.parseEntryDataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should return null for missing animations', () => {
      const invalid = { ...minimalCharData, animations: undefined };
      expect(registry.parseEntryDataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should return null for empty animations', () => {
      const invalid = { ...minimalCharData, animations: [] };
      expect(registry.parseEntryDataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should return null for animation without name', () => {
      const invalid = {
        ...minimalCharData,
        animations: [{ prefix: 'test' }]
      };
      expect(registry.parseEntryDataRaw(invalid, 'invalid.json')).toBeNull();
    });

    it('should parse pixel character data', () => {
      const result = registry.parseEntryDataRaw(pixelCharData, 'senpai.json');

      expect(result).not.toBeNull();
      expect(result.isPixel).toBe(true);
      expect(result.scale).toBe(6);
      expect(result.healthIcon.isPixel).toBe(true);
    });
  });

  describe('cleanCharacterData', () => {
    it('should set default values for missing fields', () => {
      const result = registry.parseEntryDataRaw(minimalCharData, 'test.json');

      expect(result.scale).toBe(1);
      expect(result.isPixel).toBe(false);
      expect(result.danceEvery).toBe(1);
      expect(result.singTime).toBe(8);
      expect(result.startingAnimation).toBe('idle');
      expect(result.flipX).toBe(false);
      expect(result.offsets).toEqual([0, 0]);
      expect(result.cameraOffsets).toEqual([0, 0]);
    });

    it('should preserve provided values', () => {
      const result = registry.parseEntryDataRaw(sampleBfData, 'bf.json');

      expect(result.singTime).toBe(8.0);
      expect(result.flipX).toBe(true);
    });
  });

  describe('cleanAnimationData', () => {
    it('should set default animation values', () => {
      const result = registry.parseEntryDataRaw(minimalCharData, 'test.json');
      const anim = result.animations[0];

      expect(anim.name).toBe('idle');
      expect(anim.prefix).toBe('idle');
      expect(anim.offsets).toEqual([0, 0]);
      expect(anim.frameRate).toBe(24);
      expect(anim.looped).toBe(false);
      expect(anim.flipX).toBe(false);
      expect(anim.flipY).toBe(false);
    });

    it('should preserve animation values', () => {
      const result = registry.parseEntryDataRaw(sampleBfData, 'bf.json');
      const deathLoop = result.animations.find((a) => a.name === 'deathLoop');

      expect(deathLoop.looped).toBe(true);
      expect(deathLoop.offsets).toEqual([-37, 5]);
    });
  });

  describe('cleanHealthIconData', () => {
    it('should set default health icon values', () => {
      const result = registry.parseEntryDataRaw(minimalCharData, 'test.json');

      expect(result.healthIcon.id).toBeNull();
      expect(result.healthIcon.scale).toBe(1);
      expect(result.healthIcon.flipX).toBe(false);
      expect(result.healthIcon.isPixel).toBe(false);
      expect(result.healthIcon.offsets).toEqual([0, 25]);
    });

    it('should inherit isPixel from character', () => {
      const result = registry.parseEntryDataRaw(pixelCharData, 'senpai.json');
      expect(result.healthIcon.isPixel).toBe(true);
    });
  });

  describe('createEntry', () => {
    it('should create entry from character data', () => {
      const data = registry.parseEntryDataRaw(sampleBfData, 'bf.json');
      const entry = registry.createEntry('bf', data);

      expect(entry).not.toBeNull();
      expect(entry.id).toBe('bf');
      expect(entry.name).toBe('Boyfriend');
      expect(entry.renderType).toBe('multisparrow');
      expect(entry.animationNames).toContain('idle');
      expect(entry.animationNames).toContain('singLEFT');
      expect(entry.animationNames).toContain('singLEFTmiss');
    });

    it('should return null for null data', () => {
      expect(registry.createEntry('test', null)).toBeNull();
    });
  });


  describe('loadEntries', () => {
    it('should load entries with mock data', () => {
      class TestCharacterRegistry extends CharacterRegistry {
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

      const testRegistry = new TestCharacterRegistry();
      testRegistry.setMockData('bf', sampleBfData);
      testRegistry.setMockData('dad', sampleDadData);

      testRegistry.loadEntries(['bf', 'dad']);

      expect(testRegistry.loaded).toBe(true);
      expect(testRegistry.countEntries()).toBe(2);
      expect(testRegistry.hasEntry('bf')).toBe(true);
      expect(testRegistry.hasEntry('dad')).toBe(true);
    });
  });

  describe('Character Access Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestCharacterRegistry extends CharacterRegistry {
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

      CharacterRegistry.instance = null;
      testRegistry = new TestCharacterRegistry();
      testRegistry.setMockData('bf', sampleBfData);
      testRegistry.setMockData('dad', sampleDadData);
      testRegistry.setMockData('senpai', pixelCharData);
      testRegistry.loadEntries(['bf', 'dad', 'senpai']);
    });

    it('should get character data', () => {
      const data = testRegistry.getCharacterData('bf');
      expect(data).not.toBeNull();
      expect(data.name).toBe('Boyfriend');
    });

    it('should return null for non-existent character', () => {
      expect(testRegistry.getCharacterData('nonexistent')).toBeNull();
    });

    it('should get character name', () => {
      expect(testRegistry.getCharacterName('bf')).toBe('Boyfriend');
      expect(testRegistry.getCharacterName('dad')).toBe('Daddy Dearest');
      expect(testRegistry.getCharacterName('nonexistent')).toBe('nonexistent');
    });

    it('should get character render type', () => {
      expect(testRegistry.getCharacterRenderType('bf')).toBe('multisparrow');
      expect(testRegistry.getCharacterRenderType('senpai')).toBe('sparrow');
    });

    it('should get character animations', () => {
      const anims = testRegistry.getCharacterAnimations('bf');
      expect(anims.length).toBeGreaterThan(0);
      expect(anims.some((a) => a.name === 'idle')).toBe(true);
    });

    it('should get specific animation', () => {
      const anim = testRegistry.getAnimation('bf', 'singLEFT');
      expect(anim).not.toBeNull();
      expect(anim.prefix).toBe('BF NOTE LEFT0');
    });

    it('should return null for non-existent animation', () => {
      expect(testRegistry.getAnimation('bf', 'nonexistent')).toBeNull();
    });

    it('should check if character has animation', () => {
      expect(testRegistry.hasAnimation('bf', 'idle')).toBe(true);
      expect(testRegistry.hasAnimation('bf', 'singLEFTmiss')).toBe(true);
      expect(testRegistry.hasAnimation('bf', 'nonexistent')).toBe(false);
      expect(testRegistry.hasAnimation('dad', 'singLEFTmiss')).toBe(false);
    });

    it('should get asset path', () => {
      expect(testRegistry.getAssetPath('bf')).toBe('characters/BOYFRIEND');
      expect(testRegistry.getAssetPath('nonexistent')).toBeNull();
    });

    it('should get health icon data', () => {
      const iconData = testRegistry.getHealthIconData('bf');
      expect(iconData).not.toBeNull();
      expect(iconData.id).toBe('bf'); // Defaults to character ID

      const senpaiIcon = testRegistry.getHealthIconData('senpai');
      expect(senpaiIcon.id).toBe('senpai');
      expect(senpaiIcon.isPixel).toBe(true);
    });
  });

  describe('Listing Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestCharacterRegistry extends CharacterRegistry {
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

      CharacterRegistry.instance = null;
      testRegistry = new TestCharacterRegistry();
      testRegistry.setMockData('bf', sampleBfData);
      testRegistry.setMockData('dad', sampleDadData);
      testRegistry.setMockData('senpai', pixelCharData);
      testRegistry.loadEntries(['bf', 'dad', 'senpai']);
    });

    it('should list all character IDs', () => {
      const ids = testRegistry.listCharacterIds();
      expect(ids).toContain('bf');
      expect(ids).toContain('dad');
      expect(ids).toContain('senpai');
    });

    it('should get characters by render type', () => {
      const sparrowChars = testRegistry.getCharactersByRenderType('sparrow');
      expect(sparrowChars).toHaveLength(2); // dad and senpai (dad defaults to sparrow)

      const multiSparrowChars = testRegistry.getCharactersByRenderType('multisparrow');
      expect(multiSparrowChars).toHaveLength(1);
      expect(multiSparrowChars[0].id).toBe('bf');
    });

    it('should get playable characters', () => {
      const playable = testRegistry.getPlayableCharacters();
      expect(playable).toHaveLength(1);
      expect(playable[0].id).toBe('bf');
    });

    it('should get character display info', () => {
      const info = testRegistry.getCharacterDisplayInfo('bf');

      expect(info).not.toBeNull();
      expect(info.id).toBe('bf');
      expect(info.name).toBe('Boyfriend');
      expect(info.renderType).toBe('multisparrow');
      expect(info.hasDeathAnimation).toBe(true);
      expect(info.animationCount).toBeGreaterThan(0);
    });

    it('should return null for non-existent character display info', () => {
      expect(testRegistry.getCharacterDisplayInfo('nonexistent')).toBeNull();
    });
  });

  describe('Path Methods', () => {
    let testRegistry;

    beforeEach(() => {
      class TestCharacterRegistry extends CharacterRegistry {
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

      CharacterRegistry.instance = null;
      testRegistry = new TestCharacterRegistry();
      testRegistry.setMockData('bf', sampleBfData);
      testRegistry.loadEntries(['bf']);
    });

    it('should get character path', () => {
      expect(testRegistry.getCharacterPath('bf')).toBe('data/characters/bf.json');
    });

    it('should get sprite asset path', () => {
      expect(testRegistry.getSpriteAssetPath('bf')).toBe('images/characters/BOYFRIEND');
      expect(testRegistry.getSpriteAssetPath('nonexistent')).toBeNull();
    });

    it('should get XML asset path for sparrow characters', () => {
      // bf is multisparrow, so it should return XML path
      expect(testRegistry.getXmlAssetPath('bf')).toBe('images/characters/BOYFRIEND.xml');
    });
  });

  describe('Static Helper Methods', () => {
    it('should get sing animation name', () => {
      expect(CharacterRegistry.getSingAnimationName(0)).toBe('singLEFT');
      expect(CharacterRegistry.getSingAnimationName(1)).toBe('singDOWN');
      expect(CharacterRegistry.getSingAnimationName(2)).toBe('singUP');
      expect(CharacterRegistry.getSingAnimationName(3)).toBe('singRIGHT');
    });

    it('should get miss animation name', () => {
      expect(CharacterRegistry.getSingAnimationName(0, true)).toBe('singLEFTmiss');
      expect(CharacterRegistry.getSingAnimationName(1, true)).toBe('singDOWNmiss');
      expect(CharacterRegistry.getSingAnimationName(2, true)).toBe('singUPmiss');
      expect(CharacterRegistry.getSingAnimationName(3, true)).toBe('singRIGHTmiss');
    });

    it('should get hold animation name', () => {
      expect(CharacterRegistry.getHoldAnimationName(0)).toBe('singLEFT-hold');
      expect(CharacterRegistry.getHoldAnimationName(1)).toBe('singDOWN-hold');
      expect(CharacterRegistry.getHoldAnimationName(2)).toBe('singUP-hold');
      expect(CharacterRegistry.getHoldAnimationName(3)).toBe('singRIGHT-hold');
    });
  });

  describe('Version Validation', () => {
    it('should accept valid versions', () => {
      const v100 = { ...minimalCharData, version: '1.0.0' };
      const v101 = { ...minimalCharData, version: '1.0.1' };
      const v109 = { ...minimalCharData, version: '1.0.9' };

      expect(registry.parseEntryDataRaw(v100, 'test.json')).not.toBeNull();
      expect(registry.parseEntryDataRaw(v101, 'test.json')).not.toBeNull();
      expect(registry.parseEntryDataRaw(v109, 'test.json')).not.toBeNull();
    });

    it('should reject incompatible versions', () => {
      const v200 = { ...minimalCharData, version: '2.0.0' };
      const v110 = { ...minimalCharData, version: '1.1.0' };

      expect(registry.parseEntryDataRaw(v200, 'test.json')).toBeNull();
      expect(registry.parseEntryDataRaw(v110, 'test.json')).toBeNull();
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      expect(registry.toString()).toContain('CharacterRegistry');
      expect(registry.toString()).toContain('0 characters');
    });
  });
});

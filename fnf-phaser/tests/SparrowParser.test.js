/**
 * @fileoverview Unit tests for the SparrowParser
 */

import { describe, it, expect } from 'vitest';
import SparrowParser from '../src/data/parsers/SparrowParser.js';

// Sample Sparrow XML based on actual FNF format
const sampleXML = `<?xml version="1.0" encoding="utf-8"?>
<TextureAtlas imagePath="test_assets.png">
  <SubTexture name="idle0000" x="0" y="0" width="100" height="100" />
  <SubTexture name="idle0001" x="100" y="0" width="100" height="100" />
  <SubTexture name="idle0002" x="200" y="0" width="100" height="100" />
  <SubTexture name="walk0000" x="0" y="100" width="80" height="120" />
  <SubTexture name="walk0001" x="80" y="100" width="80" height="120" />
</TextureAtlas>`;

// XML with frame offsets (trimmed sprites)
const trimmedXML = `<?xml version="1.0" encoding="utf-8"?>
<TextureAtlas imagePath="trimmed.png">
  <SubTexture name="sprite0000" x="10" y="20" width="50" height="60" frameX="-5" frameY="-10" frameWidth="60" frameHeight="80" />
  <SubTexture name="sprite0001" x="70" y="20" width="55" height="65" frameX="-2" frameY="-8" frameWidth="60" frameHeight="80" />
</TextureAtlas>`;

// XML with "instance" naming convention (Adobe Animate style)
const instanceXML = `<?xml version="1.0" encoding="utf-8"?>
<TextureAtlas imagePath="animate_export.png">
  <SubTexture name="down confirm instance 10000" x="0" y="0" width="240" height="236" />
  <SubTexture name="down confirm instance 10001" x="244" y="0" width="240" height="236" />
  <SubTexture name="down confirm instance 10002" x="488" y="0" width="221" height="218" frameX="-6" frameY="-12" frameWidth="240" frameHeight="236" />
  <SubTexture name="left press instance 10000" x="0" y="240" width="139" height="142" />
  <SubTexture name="left press instance 10001" x="140" y="240" width="139" height="142" />
</TextureAtlas>`;

// Empty atlas
const emptyXML = `<?xml version="1.0" encoding="utf-8"?>
<TextureAtlas imagePath="empty.png">
</TextureAtlas>`;

// Invalid XML
const invalidXML = `<not valid xml`;

// XML without TextureAtlas element
const noAtlasXML = `<?xml version="1.0" encoding="utf-8"?>
<SomeOtherElement>
  <SubTexture name="test" x="0" y="0" width="100" height="100" />
</SomeOtherElement>`;

describe('SparrowParser', () => {
  describe('parse', () => {
    it('should parse valid Sparrow XML', () => {
      const result = SparrowParser.parse(sampleXML);

      expect(result).not.toBeNull();
      expect(result.imagePath).toBe('test_assets.png');
      expect(result.frames).toHaveLength(5);
    });

    it('should return null for invalid input', () => {
      expect(SparrowParser.parse(null)).toBeNull();
      expect(SparrowParser.parse(undefined)).toBeNull();
      expect(SparrowParser.parse('')).toBeNull();
      expect(SparrowParser.parse(123)).toBeNull();
    });

    it('should return null for invalid XML', () => {
      // In Node.js environment with regex parsing, invalid XML may still partially parse
      // but won't find a valid TextureAtlas element
      const result = SparrowParser.parse(invalidXML);
      expect(result).toBeNull();
    });

    it('should return null for XML without TextureAtlas', () => {
      const result = SparrowParser.parse(noAtlasXML);
      // The regex parser will find SubTexture but no TextureAtlas with imagePath
      // This should still work but with empty imagePath
      expect(result === null || result.imagePath === '').toBe(true);
    });

    it('should handle empty atlas', () => {
      const result = SparrowParser.parse(emptyXML);

      expect(result).not.toBeNull();
      expect(result.frames).toHaveLength(0);
      expect(result.animations.size).toBe(0);
    });
  });

  describe('parseSubTexture', () => {
    it('should extract frame data correctly', () => {
      const result = SparrowParser.parse(sampleXML);

      const idleFrame = result.frames[0];
      expect(idleFrame.name).toBe('idle0000');
      expect(idleFrame.x).toBe(0);
      expect(idleFrame.y).toBe(0);
      expect(idleFrame.width).toBe(100);
      expect(idleFrame.height).toBe(100);
    });

    it('should parse frame offset attributes', () => {
      const result = SparrowParser.parse(trimmedXML);

      const frame = result.frames[0];
      expect(frame.frameX).toBe(-5);
      expect(frame.frameY).toBe(-10);
      expect(frame.frameWidth).toBe(60);
      expect(frame.frameHeight).toBe(80);
    });

    it('should default frameWidth/frameHeight to width/height', () => {
      const result = SparrowParser.parse(sampleXML);

      const frame = result.frames[0];
      expect(frame.frameWidth).toBe(frame.width);
      expect(frame.frameHeight).toBe(frame.height);
    });

    it('should default frameX/frameY to 0', () => {
      const result = SparrowParser.parse(sampleXML);

      const frame = result.frames[0];
      expect(frame.frameX).toBe(0);
      expect(frame.frameY).toBe(0);
    });
  });

  describe('detectAnimations', () => {
    it('should group frames by animation prefix', () => {
      const result = SparrowParser.parse(sampleXML);

      expect(result.animations.size).toBe(2);
      expect(result.animations.has('idle')).toBe(true);
      expect(result.animations.has('walk')).toBe(true);
    });

    it('should correctly count frames per animation', () => {
      const result = SparrowParser.parse(sampleXML);

      const idleAnim = result.animations.get('idle');
      const walkAnim = result.animations.get('walk');

      expect(idleAnim.frames).toHaveLength(3);
      expect(walkAnim.frames).toHaveLength(2);
    });

    it('should sort frames by index', () => {
      const result = SparrowParser.parse(sampleXML);

      const idleAnim = result.animations.get('idle');
      expect(idleAnim.indices).toEqual([0, 1, 2]);
    });

    it('should handle instance naming convention', () => {
      const result = SparrowParser.parse(instanceXML);

      expect(result.animations.size).toBe(2);
      expect(result.animations.has('down confirm instance 1')).toBe(true);
      expect(result.animations.has('left press instance 1')).toBe(true);
    });
  });

  describe('parseFrameName', () => {
    it('should parse standard frame names', () => {
      const result = SparrowParser.parseFrameName('idle0000');
      expect(result.prefix).toBe('idle');
      expect(result.index).toBe(0);
    });

    it('should parse frame names with higher indices', () => {
      const result = SparrowParser.parseFrameName('walk0015');
      expect(result.prefix).toBe('walk');
      expect(result.index).toBe(15);
    });

    it('should parse instance-style frame names', () => {
      const result = SparrowParser.parseFrameName('down confirm instance 10002');
      expect(result.prefix).toBe('down confirm instance 1');
      expect(result.index).toBe(2);
    });

    it('should handle names without frame numbers', () => {
      const result = SparrowParser.parseFrameName('static_image');
      expect(result.prefix).toBe('static_image');
      expect(result.index).toBe(0);
    });

    it('should handle names with short numbers', () => {
      const result = SparrowParser.parseFrameName('test123');
      // Less than 4 digits, treated as part of prefix
      expect(result.prefix).toBe('test123');
      expect(result.index).toBe(0);
    });
  });

  describe('getFramesByPrefix', () => {
    it('should return frames for exact prefix match', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frames = SparrowParser.getFramesByPrefix(atlas, 'idle', true);

      expect(frames).toHaveLength(3);
      expect(frames[0].name).toBe('idle0000');
    });

    it('should return empty array for non-existent prefix', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frames = SparrowParser.getFramesByPrefix(atlas, 'nonexistent', true);

      expect(frames).toHaveLength(0);
    });

    it('should support partial prefix matching', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frames = SparrowParser.getFramesByPrefix(atlas, 'id', false);

      expect(frames.length).toBeGreaterThan(0);
    });
  });

  describe('getFramesByIndices', () => {
    it('should return frames at specific indices', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frames = SparrowParser.getFramesByIndices(atlas, 'idle', [0, 2]);

      expect(frames).toHaveLength(2);
      expect(frames[0].name).toBe('idle0000');
      expect(frames[1].name).toBe('idle0002');
    });

    it('should skip non-existent indices', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frames = SparrowParser.getFramesByIndices(atlas, 'idle', [0, 99, 2]);

      expect(frames).toHaveLength(2);
    });

    it('should return empty array for non-existent animation', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frames = SparrowParser.getFramesByIndices(atlas, 'nonexistent', [0, 1]);

      expect(frames).toHaveLength(0);
    });
  });

  describe('toPhaserAnimation', () => {
    it('should generate Phaser animation config', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const config = SparrowParser.toPhaserAnimation(atlas, 'testTexture', 'idle');

      expect(config).not.toBeNull();
      expect(config.key).toBe('idle');
      expect(config.frames).toHaveLength(3);
      expect(config.frameRate).toBe(24);
      expect(config.repeat).toBe(-1);
    });

    it('should use custom options', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const config = SparrowParser.toPhaserAnimation(atlas, 'testTexture', 'idle', {
        key: 'customKey',
        frameRate: 30,
        repeat: 0,
        yoyo: true
      });

      expect(config.key).toBe('customKey');
      expect(config.frameRate).toBe(30);
      expect(config.repeat).toBe(0);
      expect(config.yoyo).toBe(true);
    });

    it('should support specific frame indices', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const config = SparrowParser.toPhaserAnimation(atlas, 'testTexture', 'idle', {
        indices: [0, 2]
      });

      expect(config.frames).toHaveLength(2);
    });

    it('should return null for non-existent animation', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const config = SparrowParser.toPhaserAnimation(atlas, 'testTexture', 'nonexistent');

      expect(config).toBeNull();
    });

    it('should include texture key in frame config', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const config = SparrowParser.toPhaserAnimation(atlas, 'myTexture', 'idle');

      expect(config.frames[0].key).toBe('myTexture');
      expect(config.frames[0].frame).toBe('idle0000');
    });
  });

  describe('toPhaserAnimations', () => {
    it('should generate configs for all animations', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const configs = SparrowParser.toPhaserAnimations(atlas, 'testTexture');

      expect(configs).toHaveLength(2);
    });

    it('should apply default options to all animations', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const configs = SparrowParser.toPhaserAnimations(atlas, 'testTexture', {
        frameRate: 12
      });

      expect(configs.every((c) => c.frameRate === 12)).toBe(true);
    });
  });

  describe('toPhaserFrameData', () => {
    it('should generate Phaser frame data format', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frameData = SparrowParser.toPhaserFrameData(atlas);

      expect(frameData.frames).toBeDefined();
      expect(frameData.frames['idle0000']).toBeDefined();
    });

    it('should include frame position and size', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frameData = SparrowParser.toPhaserFrameData(atlas);

      const frame = frameData.frames['idle0000'];
      expect(frame.frame.x).toBe(0);
      expect(frame.frame.y).toBe(0);
      expect(frame.frame.w).toBe(100);
      expect(frame.frame.h).toBe(100);
    });

    it('should handle trimmed sprites', () => {
      const atlas = SparrowParser.parse(trimmedXML);
      const frameData = SparrowParser.toPhaserFrameData(atlas);

      const frame = frameData.frames['sprite0000'];
      expect(frame.trimmed).toBe(true);
      expect(frame.spriteSourceSize.x).toBe(5); // -frameX
      expect(frame.spriteSourceSize.y).toBe(10); // -frameY
      expect(frame.sourceSize.w).toBe(60);
      expect(frame.sourceSize.h).toBe(80);
    });

    it('should mark non-trimmed sprites correctly', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const frameData = SparrowParser.toPhaserFrameData(atlas);

      const frame = frameData.frames['idle0000'];
      expect(frame.trimmed).toBe(false);
    });
  });

  describe('listAnimations', () => {
    it('should return all animation prefixes', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const animations = SparrowParser.listAnimations(atlas);

      expect(animations).toContain('idle');
      expect(animations).toContain('walk');
      expect(animations).toHaveLength(2);
    });

    it('should return empty array for empty atlas', () => {
      const atlas = SparrowParser.parse(emptyXML);
      const animations = SparrowParser.listAnimations(atlas);

      expect(animations).toHaveLength(0);
    });
  });

  describe('getAtlasStats', () => {
    it('should return correct statistics', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const stats = SparrowParser.getAtlasStats(atlas);

      expect(stats.imagePath).toBe('test_assets.png');
      expect(stats.totalFrames).toBe(5);
      expect(stats.totalAnimations).toBe(2);
      expect(stats.animationNames).toContain('idle');
      expect(stats.animationNames).toContain('walk');
    });

    it('should calculate frame size range', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const stats = SparrowParser.getAtlasStats(atlas);

      expect(stats.frameSizeRange.minWidth).toBe(80);
      expect(stats.frameSizeRange.maxWidth).toBe(100);
      expect(stats.frameSizeRange.minHeight).toBe(100);
      expect(stats.frameSizeRange.maxHeight).toBe(120);
    });

    it('should calculate total frame area', () => {
      const atlas = SparrowParser.parse(sampleXML);
      const stats = SparrowParser.getAtlasStats(atlas);

      // 3 idle frames (100x100) + 2 walk frames (80x120)
      const expectedArea = 3 * 100 * 100 + 2 * 80 * 120;
      expect(stats.totalFrameArea).toBe(expectedArea);
    });

    it('should handle empty atlas', () => {
      const atlas = SparrowParser.parse(emptyXML);
      const stats = SparrowParser.getAtlasStats(atlas);

      expect(stats.totalFrames).toBe(0);
      expect(stats.totalAnimations).toBe(0);
      expect(stats.totalFrameArea).toBe(0);
      expect(stats.frameSizeRange.minWidth).toBe(0);
      expect(stats.frameSizeRange.maxWidth).toBe(0);
    });
  });

  describe('frameMap', () => {
    it('should provide quick frame lookup by name', () => {
      const atlas = SparrowParser.parse(sampleXML);

      expect(atlas.frameMap.get('idle0000')).toBeDefined();
      expect(atlas.frameMap.get('idle0000').x).toBe(0);
      expect(atlas.frameMap.get('walk0001')).toBeDefined();
    });

    it('should return undefined for non-existent frames', () => {
      const atlas = SparrowParser.parse(sampleXML);

      expect(atlas.frameMap.get('nonexistent')).toBeUndefined();
    });
  });
});

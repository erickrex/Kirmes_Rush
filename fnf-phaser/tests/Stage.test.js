/**
 * @fileoverview Tests for Stage class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Phaser's Sprite class - MUST be set up before importing Stage
class MockAnimation {
  constructor() {
    this.currentAnim = null;
    this.isPlaying = false;
    this.animationManager = {
      exists: vi.fn().mockReturnValue(false),
      get: vi.fn().mockReturnValue(null)
    };
  }

  exists(key) {
    return false;
  }

  play() {}
}

class MockSprite {
  constructor(scene, x, y, texture, frame) {
    this.scene = scene;
    this.x = x || 0;
    this.y = y || 0;
    this.texture = { key: texture, source: [{ scaleMode: 0 }] };
    this.frame = { name: frame };
    this.scaleX = 1;
    this.scaleY = 1;
    this.width = 100;
    this.height = 100;
    this.originX = 0.5;
    this.originY = 0.5;
    this.depth = 0;
    this.alpha = 1;
    this.angle = 0;
    this.flipX = false;
    this.flipY = false;
    this.visible = true;
    this.scrollFactorX = 1;
    this.scrollFactorY = 1;
    this.anims = new MockAnimation();
    this._eventListeners = new Map();
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  setScale(x, y) {
    this.scaleX = x;
    this.scaleY = y !== undefined ? y : x;
    return this;
  }

  setOrigin(x, y) {
    this.originX = x;
    this.originY = y !== undefined ? y : x;
    return this;
  }

  setDepth(depth) {
    this.depth = depth;
    return this;
  }

  setAlpha(alpha) {
    this.alpha = alpha;
    return this;
  }

  setAngle(angle) {
    this.angle = angle;
    return this;
  }

  setFlip(x, y) {
    this.flipX = x;
    this.flipY = y;
    return this;
  }

  setFlipX(x) {
    this.flipX = x;
    return this;
  }

  setFlipY(y) {
    this.flipY = y;
    return this;
  }

  setTexture(key) {
    this.texture = { key, source: [{ scaleMode: 0 }] };
    return this;
  }

  setVisible(v) {
    this.visible = v;
    return this;
  }

  setScrollFactor(x, y) {
    this.scrollFactorX = x;
    this.scrollFactorY = y !== undefined ? y : x;
    return this;
  }

  on(event, callback, context) {
    this._eventListeners.set(event, { callback, context });
    return this;
  }

  off(event, callback, context) {
    this._eventListeners.delete(event);
    return this;
  }

  emit(event, ...args) {
    const listener = this._eventListeners.get(event);
    if (listener) {
      listener.callback.apply(listener.context, args);
    }
  }

  play(config, ignoreIfPlaying) {
    if (typeof config === 'object') {
      this.anims.currentAnim = { key: config.key };
    }
    this.anims.isPlaying = true;
    return this;
  }

  destroy(fromScene) {}
}

// Mock Phaser globals - MUST be set up before importing Stage
global.Phaser = {
  GameObjects: {
    Sprite: MockSprite
  },
  ScaleModes: {
    NEAREST: 1,
    LINEAR: 0
  }
};

// Dynamic import AFTER Phaser mock is set up
const { default: Stage } = await import('../src/play/Stage.js');
const { default: StageRegistry } = await import('../src/data/registries/StageRegistry.js');

describe('Stage', () => {
  let mockScene;
  let mockRegistry;

  const mockStageData = {
    version: '1.0.0',
    name: 'Main Stage',
    directory: 'week1',
    cameraZoom: 0.9,
    props: [
      {
        name: 'bg',
        assetPath: 'stageback',
        position: [-600, -200],
        scale: [1.1, 1.1],
        scroll: [0.9, 0.9],
        zIndex: -100
      },
      {
        name: 'stageFront',
        assetPath: 'stagefront',
        position: [-650, 600],
        scale: [1.1, 1.1],
        scroll: [0.9, 0.9],
        zIndex: -50
      },
      {
        name: 'stageCurtains',
        assetPath: 'stagecurtains',
        position: [-500, -300],
        scale: [0.9, 0.9],
        scroll: [1.3, 1.3],
        zIndex: 100,
        alpha: 0.8
      },
      {
        name: 'dancingGirl',
        assetPath: 'dancer',
        position: [0, 0],
        zIndex: 0,
        danceEvery: 2,
        isPixel: true
      }
    ],
    characters: {
      bf: {
        position: [770, 450],
        zIndex: 10,
        cameraOffsets: [0, -100]
      },
      dad: {
        position: [100, 100],
        zIndex: 5,
        cameraOffsets: [150, -100]
      },
      gf: {
        position: [400, 130],
        zIndex: 0,
        cameraOffsets: [0, 0],
        scale: 0.95
      }
    }
  };

  beforeEach(() => {
    mockScene = {
      add: {
        existing: vi.fn(),
        graphics: vi.fn().mockReturnValue({
          fillStyle: vi.fn(),
          fillRect: vi.fn(),
          generateTexture: vi.fn(),
          destroy: vi.fn()
        })
      },
      textures: {
        exists: vi.fn().mockReturnValue(false)
      },
      tweens: {
        killTweensOf: vi.fn()
      }
    };

    // Create mock registry
    mockRegistry = {
      getStageData: vi.fn().mockReturnValue(mockStageData),
      hasEntry: vi.fn().mockReturnValue(true)
    };

    // Reset singleton
    StageRegistry.instance = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a stage with default values', () => {
      const stage = new Stage(mockScene);

      expect(stage.stageId).toBe('mainStage');
      expect(stage.scene).toBe(mockScene);
      expect(stage.cameraZoom).toBe(1.0);
      expect(stage.isCreated).toBe(false);
    });

    it('should create a stage with custom ID', () => {
      const stage = new Stage(mockScene, 'spookyStage');

      expect(stage.stageId).toBe('spookyStage');
    });
  });

  describe('loadFromRegistry', () => {
    it('should load stage data from registry', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const result = stage.loadFromRegistry(mockRegistry);

      expect(result).toBe(true);
      expect(stage.stageData).toBe(mockStageData);
      expect(mockRegistry.getStageData).toHaveBeenCalledWith('mainStage');
    });

    it('should return false if stage not found', () => {
      mockRegistry.getStageData.mockReturnValue(null);
      const stage = new Stage(mockScene, 'nonexistent');
      const result = stage.loadFromRegistry(mockRegistry);

      expect(result).toBe(false);
      expect(stage.stageData).toBeNull();
    });
  });

  describe('applyStageData', () => {
    it('should apply camera zoom', () => {
      const stage = new Stage(mockScene);
      stage.applyStageData(mockStageData);

      expect(stage.cameraZoom).toBe(0.9);
    });

    it('should apply character positions', () => {
      const stage = new Stage(mockScene);
      stage.applyStageData(mockStageData);

      expect(stage.characterPositions.bf.x).toBe(770);
      expect(stage.characterPositions.bf.y).toBe(450);
      expect(stage.characterPositions.bf.zIndex).toBe(10);
    });

    it('should apply camera offsets', () => {
      const stage = new Stage(mockScene);
      stage.applyStageData(mockStageData);

      expect(stage.characterPositions.bf.cameraOffsets).toEqual([0, -100]);
      expect(stage.characterPositions.dad.cameraOffsets).toEqual([150, -100]);
    });

    it('should apply character scale override', () => {
      const stage = new Stage(mockScene);
      stage.applyStageData(mockStageData);

      expect(stage.characterPositions.gf.scale).toBe(0.95);
    });
  });

  describe('create', () => {
    it('should create props from stage data', () => {
      const stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();

      expect(stage.isCreated).toBe(true);
      expect(stage.props.size).toBe(4);
      expect(stage.propSprites.length).toBe(4);
    });

    it('should not create if no stage data', () => {
      const stage = new Stage(mockScene);
      stage.create();

      expect(stage.isCreated).toBe(false);
      expect(stage.props.size).toBe(0);
    });

    it('should add props to scene', () => {
      const stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();

      expect(mockScene.add.existing).toHaveBeenCalledTimes(4);
    });
  });

  describe('createProp', () => {
    it('should create prop with correct position', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const prop = stage.createProp(mockStageData.props[0]);

      expect(prop.x).toBe(-600);
      expect(prop.y).toBe(-200);
    });

    it('should apply scale to prop', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const prop = stage.createProp(mockStageData.props[0]);

      expect(prop.scaleX).toBe(1.1);
      expect(prop.scaleY).toBe(1.1);
    });

    it('should apply scroll factor to prop', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const prop = stage.createProp(mockStageData.props[0]);

      expect(prop.scrollFactorX).toBe(0.9);
      expect(prop.scrollFactorY).toBe(0.9);
    });

    it('should apply z-index to prop', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const prop = stage.createProp(mockStageData.props[0]);

      expect(prop.depth).toBe(-100);
    });

    it('should apply alpha to prop', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const prop = stage.createProp(mockStageData.props[2]);

      expect(prop.alpha).toBe(0.8);
    });

    it('should apply pixel art setting', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const prop = stage.createProp(mockStageData.props[3]);

      expect(prop.isPixel).toBe(true);
    });

    it('should apply dance every setting', () => {
      const stage = new Stage(mockScene, 'mainStage');
      const prop = stage.createProp(mockStageData.props[3]);

      expect(prop.danceEvery).toBe(2);
    });

    it('should return null if no scene', () => {
      const stage = new Stage(null);
      const prop = stage.createProp(mockStageData.props[0]);

      expect(prop).toBeNull();
    });
  });

  describe('prop access', () => {
    let stage;

    beforeEach(() => {
      stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();
    });

    it('should get prop by name', () => {
      const prop = stage.getProp('bg');

      expect(prop).not.toBeNull();
      expect(prop.x).toBe(-600);
    });

    it('should return null for non-existent prop', () => {
      const prop = stage.getProp('nonexistent');

      expect(prop).toBeNull();
    });

    it('should check if prop exists', () => {
      expect(stage.hasProp('bg')).toBe(true);
      expect(stage.hasProp('nonexistent')).toBe(false);
    });

    it('should get all props', () => {
      const props = stage.getAllProps();

      expect(props.length).toBe(4);
    });

    it('should get props by z-index range', () => {
      const props = stage.getPropsByZIndex(-100, 0);

      expect(props.length).toBe(3); // bg, stageFront, dancingGirl
    });

    it('should get background props', () => {
      const props = stage.getBackgroundProps();

      expect(props.length).toBe(2); // bg, stageFront (negative z-index)
    });

    it('should get foreground props', () => {
      const props = stage.getForegroundProps();

      expect(props.length).toBe(1); // stageCurtains (positive z-index)
    });
  });

  describe('character positioning', () => {
    let stage;

    beforeEach(() => {
      stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
    });

    it('should get character position', () => {
      const pos = stage.getCharacterPosition('bf');

      expect(pos.x).toBe(770);
      expect(pos.y).toBe(450);
      expect(pos.zIndex).toBe(10);
    });

    it('should return default position for unknown character', () => {
      const pos = stage.getCharacterPosition('unknown');

      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('should position character on stage', () => {
      const mockChar = {
        x: 0,
        y: 0,
        setPosition: vi.fn(),
        setZIndex: vi.fn(),
        setScale: vi.fn()
      };

      stage.positionCharacter(mockChar, 'bf');

      expect(mockChar.setPosition).toHaveBeenCalledWith(770, 450);
      expect(mockChar.setZIndex).toHaveBeenCalledWith(10);
    });

    it('should apply scale override when positioning', () => {
      const mockChar = {
        x: 0,
        y: 0,
        setPosition: vi.fn(),
        setZIndex: vi.fn(),
        setScale: vi.fn()
      };

      stage.positionCharacter(mockChar, 'gf');

      expect(mockChar.setScale).toHaveBeenCalledWith(0.95);
    });

    it('should get camera offset for character', () => {
      const offset = stage.getCameraOffset('bf');

      expect(offset.x).toBe(0);
      expect(offset.y).toBe(-100);
    });
  });

  describe('update', () => {
    it('should update all props', () => {
      const stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();

      // Add mock update to props
      for (const prop of stage.propSprites) {
        prop.update = vi.fn();
      }

      stage.update(16);

      for (const prop of stage.propSprites) {
        expect(prop.update).toHaveBeenCalledWith(16);
      }
    });
  });

  describe('onBeatHit', () => {
    it('should trigger dance on dancing props', () => {
      const stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();

      // Get the dancing prop
      const dancingProp = stage.getProp('dancingGirl');
      dancingProp.dance = vi.fn();

      // Beat 2 should trigger dance (danceEvery = 2)
      stage.onBeatHit(2);

      expect(dancingProp.dance).toHaveBeenCalled();
    });

    it('should not trigger dance on non-dancing props', () => {
      const stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();

      const bgProp = stage.getProp('bg');
      bgProp.dance = vi.fn();

      stage.onBeatHit(2);

      expect(bgProp.dance).not.toHaveBeenCalled();
    });
  });

  describe('onStepHit', () => {
    it('should call onStepHit on props that have it', () => {
      const stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();

      for (const prop of stage.propSprites) {
        prop.onStepHit = vi.fn();
      }

      stage.onStepHit(4);

      for (const prop of stage.propSprites) {
        expect(prop.onStepHit).toHaveBeenCalledWith(4);
      }
    });
  });

  describe('visibility', () => {
    let stage;

    beforeEach(() => {
      stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();
    });

    it('should set visibility of all props', () => {
      stage.setVisible(false);

      for (const prop of stage.propSprites) {
        expect(prop.visible).toBe(false);
      }
    });

    it('should set visibility of specific prop', () => {
      stage.setPropVisible('bg', false);

      expect(stage.getProp('bg').visible).toBe(false);
      expect(stage.getProp('stageFront').visible).toBe(true);
    });
  });

  describe('utility methods', () => {
    let stage;

    beforeEach(() => {
      stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
    });

    it('should get display name', () => {
      expect(stage.getDisplayName()).toBe('Main Stage');
    });

    it('should return stage ID if no data', () => {
      const emptyStage = new Stage(mockScene, 'test');
      expect(emptyStage.getDisplayName()).toBe('test');
    });

    it('should get directory', () => {
      expect(stage.getDirectory()).toBe('week1');
    });

    it('should get asset paths', () => {
      const paths = stage.getAssetPaths();

      expect(paths).toContain('images/week1/stageback');
      expect(paths).toContain('images/week1/stagefront');
      expect(paths).toContain('images/week1/stagecurtains');
      expect(paths).toContain('images/week1/dancer');
    });
  });

  describe('static create', () => {
    it('should create and initialize stage', () => {
      const stage = Stage.create(mockScene, 'mainStage');

      // Will be null because registry returns null by default
      expect(stage).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should clean up all props', () => {
      const stage = new Stage(mockScene, 'mainStage');
      stage.loadFromRegistry(mockRegistry);
      stage.create();

      const destroySpies = stage.propSprites.map((prop) => {
        prop.destroy = vi.fn();
        return prop.destroy;
      });

      stage.destroy();

      for (const spy of destroySpies) {
        expect(spy).toHaveBeenCalled();
      }

      expect(stage.props.size).toBe(0);
      expect(stage.propSprites.length).toBe(0);
      expect(stage.stageData).toBeNull();
      expect(stage.scene).toBeNull();
      expect(stage.isCreated).toBe(false);
    });
  });
});

/**
 * @fileoverview Stage - Background and props for gameplay
 * Handles stage loading, prop creation, and character positioning.
 *
 * Ported from source/funkin/play/stage/Stage.hx
 */

import FunkinSprite from '../graphics/FunkinSprite.js';
import StageRegistry from '../data/registries/StageRegistry.js';

/**
 * @typedef {Object} StageConfig
 * @property {string} stageId - Stage ID from registry
 * @property {Phaser.Scene} scene - The Phaser scene
 */

/**
 * Stage background and props for Friday Night Funkin' gameplay.
 * Handles:
 * - Loading stage data from registry
 * - Creating background props with parallax
 * - Character positioning
 * - Camera zoom settings
 */
class Stage {
  /**
   * The Phaser scene
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * Stage ID
   * @type {string}
   */
  stageId = '';

  /**
   * Stage data from registry
   * @type {Object | null}
   */
  stageData = null;

  /**
   * Map of prop sprites by name
   * @type {Map<string, FunkinSprite>}
   */
  props = new Map();

  /**
   * Array of all prop sprites (for iteration)
   * @type {FunkinSprite[]}
   */
  propSprites = [];

  /**
   * Default camera zoom for this stage
   * @type {number}
   */
  cameraZoom = 1.0;

  /**
   * Character positions
   * @type {Object}
   */
  characterPositions = {
    bf: { x: 0, y: 0, zIndex: 0 },
    dad: { x: 0, y: 0, zIndex: 0 },
    gf: { x: 0, y: 0, zIndex: 0 }
  };

  /**
   * Whether the stage has been created
   * @type {boolean}
   */
  isCreated = false;

  /**
   * Create a new Stage
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {string} [stageId='mainStage'] - Stage ID
   */
  constructor(scene, stageId = 'mainStage') {
    this.scene = scene;
    this.stageId = stageId;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Load stage data from registry
   * @param {StageRegistry} [registry] - Optional registry instance
   * @returns {boolean} Whether loading succeeded
   */
  loadFromRegistry(registry) {
    const reg = registry || StageRegistry.getInstance();
    const data = reg.getStageData(this.stageId);

    if (!data) {
      console.error(`[Stage] Stage not found: ${this.stageId}`);
      return false;
    }

    this.stageData = data;
    this.applyStageData(data);
    return true;
  }

  /**
   * Apply stage data
   * @param {Object} data - Stage data
   */
  applyStageData(data) {
    this.cameraZoom = data.cameraZoom || 1.0;

    // Store character positions
    if (data.characters) {
      for (const charType of ['bf', 'dad', 'gf']) {
        if (data.characters[charType]) {
          const pos = data.characters[charType];
          this.characterPositions[charType] = {
            x: pos.position?.[0] || 0,
            y: pos.position?.[1] || 0,
            zIndex: pos.zIndex || 0,
            cameraOffsets: pos.cameraOffsets || [0, 0],
            scale: pos.scale || 1
          };
        }
      }
    }
  }

  /**
   * Create all stage props
   */
  create() {
    if (!this.stageData) {
      console.warn('[Stage] No stage data loaded');
      return;
    }

    // Sort props by z-index for proper layering
    const sortedProps = [...this.stageData.props].sort((a, b) => a.zIndex - b.zIndex);

    for (const propData of sortedProps) {
      const prop = this.createProp(propData);
      if (prop) {
        this.props.set(propData.name, prop);
        this.propSprites.push(prop);
      }
    }

    this.isCreated = true;
  }

  /**
   * Create a single prop sprite
   * @param {Object} propData - Prop data from stage definition
   * @returns {FunkinSprite | null}
   */
  createProp(propData) {
    if (!this.scene) return null;

    const x = propData.position?.[0] || 0;
    const y = propData.position?.[1] || 0;

    const prop = new FunkinSprite(this.scene, x, y);

    // Apply scale
    if (propData.scale) {
      prop.setScale(propData.scale[0] || 1, propData.scale[1] || 1);
    }

    // Apply scroll factor (parallax)
    if (propData.scroll && prop.setScrollFactor) {
      prop.setScrollFactor(propData.scroll[0] || 1, propData.scroll[1] || 1);
    }

    // Apply z-index
    prop.setZIndex(propData.zIndex || 0);

    // Apply alpha
    if (propData.alpha !== undefined) {
      prop.setAlpha(propData.alpha);
    }

    // Apply pixel art setting
    if (propData.isPixel) {
      prop.setPixelArt(true);
    }

    // Apply dance every setting
    prop.danceEvery = propData.danceEvery || 0;

    // Store prop data for later use
    prop._propData = propData;

    // Add to scene
    this.scene.add.existing(prop);

    return prop;
  }

  // ========================================
  // PROP ACCESS
  // ========================================

  /**
   * Get a prop by name
   * @param {string} name - Prop name
   * @returns {FunkinSprite | null}
   */
  getProp(name) {
    return this.props.get(name) || null;
  }

  /**
   * Check if stage has a prop
   * @param {string} name - Prop name
   * @returns {boolean}
   */
  hasProp(name) {
    return this.props.has(name);
  }

  /**
   * Get all props
   * @returns {FunkinSprite[]}
   */
  getAllProps() {
    return [...this.propSprites];
  }

  /**
   * Get props by z-index range
   * @param {number} minZ - Minimum z-index (inclusive)
   * @param {number} maxZ - Maximum z-index (inclusive)
   * @returns {FunkinSprite[]}
   */
  getPropsByZIndex(minZ, maxZ) {
    return this.propSprites.filter((prop) => {
      const z = prop.getZIndex();
      return z >= minZ && z <= maxZ;
    });
  }

  /**
   * Get props behind characters (negative z-index)
   * @returns {FunkinSprite[]}
   */
  getBackgroundProps() {
    return this.propSprites.filter((prop) => prop.getZIndex() < 0);
  }

  /**
   * Get props in front of characters (positive z-index)
   * @returns {FunkinSprite[]}
   */
  getForegroundProps() {
    return this.propSprites.filter((prop) => prop.getZIndex() > 0);
  }

  // ========================================
  // CHARACTER POSITIONING
  // ========================================

  /**
   * Get character position
   * @param {string} charType - Character type ('bf', 'dad', 'gf')
   * @returns {{x: number, y: number, zIndex: number, cameraOffsets: number[], scale: number}}
   */
  getCharacterPosition(charType) {
    return (
      this.characterPositions[charType] || {
        x: 0,
        y: 0,
        zIndex: 0,
        cameraOffsets: [0, 0],
        scale: 1
      }
    );
  }

  /**
   * Position a character on the stage
   * @param {Object} character - Character sprite
   * @param {string} charType - Character type ('bf', 'dad', 'gf')
   */
  positionCharacter(character, charType) {
    const pos = this.getCharacterPosition(charType);

    if (character.setPosition) {
      character.setPosition(pos.x, pos.y);
    } else {
      character.x = pos.x;
      character.y = pos.y;
    }

    if (character.setZIndex) {
      character.setZIndex(pos.zIndex);
    } else if (character.setDepth) {
      character.setDepth(pos.zIndex);
    }

    // Apply scale override if specified
    if (pos.scale !== 1 && character.setScale) {
      character.setScale(pos.scale);
    }
  }

  /**
   * Get camera offset for a character
   * @param {string} charType - Character type
   * @returns {{x: number, y: number}}
   */
  getCameraOffset(charType) {
    const pos = this.getCharacterPosition(charType);
    return {
      x: pos.cameraOffsets?.[0] || 0,
      y: pos.cameraOffsets?.[1] || 0
    };
  }

  // ========================================
  // UPDATE
  // ========================================

  /**
   * Update stage props
   * @param {number} elapsed - Elapsed time in ms
   */
  update(elapsed) {
    // Update animated props if needed
    for (const prop of this.propSprites) {
      if (prop.update) {
        prop.update(elapsed);
      }
    }
  }

  /**
   * Called on beat hit - update dancing props
   * @param {number} beat - Current beat
   */
  onBeatHit(beat) {
    for (const prop of this.propSprites) {
      if (prop.danceEvery > 0 && beat % prop.danceEvery === 0) {
        if (prop.dance) {
          prop.dance();
        }
      }
    }
  }

  /**
   * Called on step hit
   * @param {number} step - Current step
   */
  onStepHit(step) {
    for (const prop of this.propSprites) {
      if (prop.onStepHit) {
        prop.onStepHit(step);
      }
    }
  }

  // ========================================
  // VISIBILITY
  // ========================================

  /**
   * Set visibility of all props
   * @param {boolean} visible - Whether props should be visible
   */
  setVisible(visible) {
    for (const prop of this.propSprites) {
      if (prop.setVisible) {
        prop.setVisible(visible);
      }
    }
  }

  /**
   * Set visibility of a specific prop
   * @param {string} name - Prop name
   * @param {boolean} visible - Whether prop should be visible
   */
  setPropVisible(name, visible) {
    const prop = this.getProp(name);
    if (prop && prop.setVisible) {
      prop.setVisible(visible);
    }
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Get stage display name
   * @returns {string}
   */
  getDisplayName() {
    return this.stageData?.name || this.stageId;
  }

  /**
   * Get the asset directory for this stage
   * @returns {string | null}
   */
  getDirectory() {
    return this.stageData?.directory || null;
  }

  /**
   * Get all asset paths needed for this stage
   * @returns {string[]}
   */
  getAssetPaths() {
    if (!this.stageData) return [];

    const paths = [];
    const directory = this.stageData.directory;

    for (const prop of this.stageData.props) {
      if (prop.assetPath) {
        const path = directory ? `images/${directory}/${prop.assetPath}` : `images/${prop.assetPath}`;
        paths.push(path);
      }
    }

    return paths;
  }

  // ========================================
  // STATIC FACTORY
  // ========================================

  /**
   * Create a stage from registry data
   * @param {Phaser.Scene} scene - The scene
   * @param {string} stageId - Stage ID
   * @returns {Stage | null}
   */
  static create(scene, stageId) {
    const stage = new Stage(scene, stageId);

    if (!stage.loadFromRegistry()) {
      return null;
    }

    stage.create();
    return stage;
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the stage and all props
   */
  destroy() {
    for (const prop of this.propSprites) {
      if (prop.destroy) {
        prop.destroy();
      }
    }

    this.props.clear();
    this.propSprites = [];
    this.stageData = null;
    this.scene = null;
    this.isCreated = false;
  }
}

export default Stage;

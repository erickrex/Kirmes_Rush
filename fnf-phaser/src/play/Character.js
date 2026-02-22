/**
 * @fileoverview Character - Animated character for gameplay
 * Handles character animations, singing, and beat-synced idle animations.
 *
 * Ported from source/funkin/play/character/BaseCharacter.hx
 */

import FunkinSprite from '../graphics/FunkinSprite.js';
import CharacterRegistry from '../data/registries/CharacterRegistry.js';
import * as Constants from '../core/Constants.js';

/**
 * @typedef {Object} CharacterConfig
 * @property {string} characterId - Character ID from registry
 * @property {boolean} [isPlayer=false] - Whether this is the player character
 * @property {number} [x=0] - Initial X position
 * @property {number} [y=0] - Initial Y position
 */

/**
 * Animated character for Friday Night Funkin' gameplay.
 * Handles:
 * - Loading character data from registry
 * - Animation setup and playback
 * - Sing animations with hold support
 * - Beat-synced idle/dance animations
 * - Miss animations for player characters
 */
class Character extends FunkinSprite {
  /**
   * Character ID
   * @type {string}
   */
  characterId = '';

  /**
   * Character data from registry
   * @type {Object | null}
   */
  characterData = null;

  /**
   * Whether this is the player character
   * @type {boolean}
   */
  isPlayer = false;

  /**
   * Whether the character is currently singing
   * @type {boolean}
   */
  isSinging = false;

  /**
   * Current sing direction (0-3)
   * @type {number}
   */
  singDirection = -1;

  /**
   * Time remaining on sing animation (in steps)
   * @type {number}
   */
  singTimer = 0;

  /**
   * Whether the character is holding a note
   * @type {boolean}
   */
  isHolding = false;

  /**
   * Steps to hold sing animation before returning to idle
   * @type {number}
   */
  singTime = Constants.DEFAULT_SING_TIME || 8;

  /**
   * Whether the character has special animations (GF-style)
   * @type {boolean}
   */
  hasSpecialAnims = false;

  /**
   * Whether the character is stunned (missed note)
   * @type {boolean}
   */
  isStunned = false;

  /**
   * Stun timer in steps
   * @type {number}
   */
  stunTimer = 0;

  /**
   * Camera offset for this character
   * @type {{x: number, y: number}}
   */
  cameraOffset = { x: 0, y: 0 };

  /**
   * Health icon ID for this character
   * @type {string}
   */
  healthIconId = '';

  /**
   * Create a new Character
   * @param {Phaser.Scene} scene - The scene
   * @param {number} [x=0] - X position
   * @param {number} [y=0] - Y position
   * @param {string} [characterId='bf'] - Character ID
   * @param {boolean} [isPlayer=false] - Whether this is the player
   */
  constructor(scene, x = 0, y = 0, characterId = 'bf', isPlayer = false) {
    super(scene, x, y);

    this.characterId = characterId;
    this.isPlayer = isPlayer;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Load character data from registry
   * @param {CharacterRegistry} [registry] - Optional registry instance
   * @returns {boolean} Whether loading succeeded
   */
  loadFromRegistry(registry) {
    const reg = registry || CharacterRegistry.getInstance();
    const data = reg.getCharacterData(this.characterId);

    if (!data) {
      console.error(`[Character] Character not found: ${this.characterId}`);
      return false;
    }

    this.characterData = data;
    this.applyCharacterData(data);
    return true;
  }

  /**
   * Apply character data to this sprite
   * @param {Object} data - Character data
   */
  applyCharacterData(data) {
    // Set basic properties
    this.setScale(data.scale || 1);
    this.isPixel = data.isPixel || false;
    this.danceEvery = data.danceEvery || 1;
    this.singTime = data.singTime || 8;

    // Set offsets
    if (data.offsets) {
      this.setGlobalOffsets(data.offsets[0] || 0, data.offsets[1] || 0);
    }

    // Set camera offset
    if (data.cameraOffsets) {
      this.cameraOffset = {
        x: data.cameraOffsets[0] || 0,
        y: data.cameraOffsets[1] || 0
      };
    }

    // Set health icon
    if (data.healthIcon) {
      this.healthIconId = data.healthIcon.id || this.characterId;
    } else {
      this.healthIconId = this.characterId;
    }

    // Flip for player if needed
    if (this.isPlayer && data.flipX !== undefined) {
      this.setFlipX(!data.flipX);
    } else if (data.flipX) {
      this.setFlipX(data.flipX);
    }

    // Setup animations
    this.setupAnimations(data.animations);

    // Check for special animations
    this.hasSpecialAnims = this.hasAnimation('danceLeft') || this.hasAnimation('danceRight');

    // Play starting animation
    const startAnim = data.startingAnimation || 'idle';
    if (this.hasAnimation(startAnim)) {
      this.playAnimation(startAnim);
    }
  }

  /**
   * Setup animations from character data
   * @param {Array} animations - Animation data array
   */
  setupAnimations(animations) {
    if (!animations || !Array.isArray(animations)) return;

    for (const anim of animations) {
      // Store animation offsets
      if (anim.offsets) {
        this.setAnimationOffsetsArray(anim.name, anim.offsets);
      }

      // Note: Actual Phaser animation creation would happen during asset loading
      // This stores the metadata for when animations are created
      this._storeAnimationData(anim);
    }
  }

  /**
   * Store animation data for later use
   * @param {Object} anim - Animation data
   * @private
   */
  _storeAnimationData(anim) {
    if (!this._animationData) {
      this._animationData = new Map();
    }
    this._animationData.set(anim.name, anim);
  }

  /**
   * Get stored animation data
   * @param {string} name - Animation name
   * @returns {Object | null}
   */
  getAnimationData(name) {
    return this._animationData?.get(name) || null;
  }

  // ========================================
  // SING ANIMATIONS
  // ========================================

  /**
   * Play sing animation for a direction
   * @param {number} direction - Direction (0=left, 1=down, 2=up, 3=right)
   * @param {boolean} [miss=false] - Whether this is a miss animation
   */
  sing(direction, miss = false) {
    const animName = CharacterRegistry.getSingAnimationName(direction, miss);

    // Check if animation exists
    if (!this.hasAnimation(animName)) {
      // Try without miss suffix
      if (miss) {
        this.sing(direction, false);
        return;
      }
      console.warn(`[Character] Sing animation not found: ${animName}`);
      return;
    }

    this.playAnimation(animName, true);
    this.isSinging = true;
    this.singDirection = direction;
    this.singTimer = this.singTime;

    if (miss) {
      this.isStunned = true;
      this.stunTimer = this.singTime;
    }
  }

  /**
   * Play hold animation for current sing direction
   */
  holdNote() {
    if (this.singDirection < 0) return;

    const holdAnimName = CharacterRegistry.getHoldAnimationName(this.singDirection);

    // Check if hold animation exists
    if (this.hasAnimation(holdAnimName)) {
      this.playAnimation(holdAnimName);
    }

    this.isHolding = true;
    this.singTimer = this.singTime; // Reset timer while holding
  }

  /**
   * Release hold note
   */
  releaseNote() {
    this.isHolding = false;
  }

  /**
   * Play miss animation for a direction
   * @param {number} direction - Direction (0-3)
   */
  miss(direction) {
    this.sing(direction, true);
  }

  // ========================================
  // DANCE/IDLE ANIMATIONS
  // ========================================

  /**
   * Play dance/idle animation
   * @param {boolean} [forceRestart=false] - Force restart animation
   */
  dance(forceRestart = false) {
    // Don't dance while singing or stunned
    if (this.isSinging || this.isStunned) return;

    super.dance(forceRestart);
  }

  /**
   * Force return to idle animation
   */
  returnToIdle() {
    this.isSinging = false;
    this.isHolding = false;
    this.singDirection = -1;
    this.singTimer = 0;
    this.dance(true);
  }

  // ========================================
  // UPDATE
  // ========================================

  /**
   * Update character state
   * @param {number} elapsed - Elapsed time in ms
   * @param {number} [stepsPassed=0] - Steps passed since last update
   */
  update(elapsed, stepsPassed = 0) {
    // Update sing timer
    if (this.isSinging && !this.isHolding) {
      this.singTimer -= stepsPassed;

      if (this.singTimer <= 0) {
        this.isSinging = false;
        this.singDirection = -1;
        this.dance();
      }
    }

    // Update stun timer
    if (this.isStunned) {
      this.stunTimer -= stepsPassed;

      if (this.stunTimer <= 0) {
        this.isStunned = false;
      }
    }
  }

  /**
   * Called on step hit
   * @param {number} step - Current step
   */
  onStepHit(step) {
    // Only dance if not singing
    if (!this.isSinging && !this.isStunned) {
      super.onStepHit(step);
    }
  }

  /**
   * Called on beat hit
   * @param {number} beat - Current beat
   */
  onBeatHit(beat) {
    // Dance on beat if configured
    if (this.danceEvery > 0 && beat % this.danceEvery === 0) {
      if (!this.isSinging && !this.isStunned) {
        this.dance();
      }
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get camera focus point for this character
   * @returns {{x: number, y: number}}
   */
  getCameraFocusPoint() {
    const midX = this.x + (this.width * this.scaleX) / 2;
    const midY = this.y + (this.height * this.scaleY) / 2;

    return {
      x: midX + this.cameraOffset.x,
      y: midY + this.cameraOffset.y
    };
  }

  /**
   * Check if character can play a specific animation
   * @param {string} animName - Animation name
   * @returns {boolean}
   */
  canPlayAnimation(animName) {
    if (!this.canPlayOtherAnims) return false;
    return this.hasAnimation(animName);
  }

  /**
   * Get the character's display name
   * @returns {string}
   */
  getDisplayName() {
    return this.characterData?.name || this.characterId;
  }

  /**
   * Check if this character has miss animations
   * @returns {boolean}
   */
  hasMissAnimations() {
    return (
      this.hasAnimation('singLEFTmiss') ||
      this.hasAnimation('singDOWNmiss') ||
      this.hasAnimation('singUPmiss') ||
      this.hasAnimation('singRIGHTmiss')
    );
  }

  /**
   * Check if this character has death animations
   * @returns {boolean}
   */
  hasDeathAnimations() {
    return this.hasAnimation('firstDeath');
  }

  // ========================================
  // STATIC FACTORY METHODS
  // ========================================

  /**
   * Create a character from registry data
   * @param {Phaser.Scene} scene - The scene
   * @param {string} characterId - Character ID
   * @param {boolean} [isPlayer=false] - Whether this is the player
   * @param {number} [x=0] - X position
   * @param {number} [y=0] - Y position
   * @returns {Character | null}
   */
  static create(scene, characterId, isPlayer = false, x = 0, y = 0) {
    const character = new Character(scene, x, y, characterId, isPlayer);

    if (!character.loadFromRegistry()) {
      return null;
    }

    scene.add.existing(character);
    return character;
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the character
   * @param {boolean} [fromScene] - Whether being destroyed from scene
   */
  destroy(fromScene) {
    this._animationData?.clear();
    this.characterData = null;
    super.destroy(fromScene);
  }
}

// Default sing time in steps
Character.DEFAULT_SING_TIME = 8;

export default Character;

/**
 * @fileoverview FunkinSprite - Extended Phaser Sprite with FNF-specific functionality
 * Provides animation helpers, offset handling, and z-index support.
 *
 * Ported from source/funkin/graphics/FunkinSprite.hx and source/funkin/play/stage/Bopper.hx
 */

/* global Phaser */

/**
 * @typedef {Object} AnimationOffsets
 * @property {number} x - X offset
 * @property {number} y - Y offset
 */

/**
 * @typedef {Object} FunkinSpriteConfig
 * @property {number} [x=0] - Initial X position
 * @property {number} [y=0] - Initial Y position
 * @property {string} [texture] - Texture key to load
 * @property {string} [frame] - Initial frame name
 * @property {number} [depth=0] - Z-index/depth for rendering order
 * @property {boolean} [isPixel=false] - Whether to use pixel rendering (no antialiasing)
 * @property {number} [danceEvery=0] - Beats between dance animations (0 = no dancing)
 */

/**
 * Extended Phaser Sprite with FNF-specific functionality.
 * Features:
 * - Animation offset handling per animation
 * - Global position offsets
 * - Z-index/depth support
 * - Dance/idle animation system
 * - Pixel art rendering support
 */
class FunkinSprite extends Phaser.GameObjects.Sprite {
  /**
   * Animation offsets map - stores x,y offsets per animation name
   * @type {Map<string, AnimationOffsets>}
   */
  animationOffsets = new Map();

  /**
   * Global position offsets applied to all animations
   * @type {{x: number, y: number}}
   */
  globalOffsets = { x: 0, y: 0 };

  /**
   * Current animation offsets being applied
   * @type {{x: number, y: number}}
   * @private
   */
  _currentAnimOffsets = { x: 0, y: 0 };

  /**
   * Whether this sprite uses pixel art rendering (no antialiasing)
   * @type {boolean}
   */
  isPixel = false;

  /**
   * Beats between dance animations (0 = no dancing)
   * @type {number}
   */
  danceEvery = 0;

  /**
   * Whether to alternate between danceLeft and danceRight
   * @type {boolean | null}
   */
  shouldAlternate = null;

  /**
   * Suffix to add to idle/dance animations
   * @type {string}
   */
  idleSuffix = '';

  /**
   * Whether this sprite should bop on beat
   * @type {boolean}
   */
  shouldBop = true;

  /**
   * Whether other animations can interrupt the current one
   * @type {boolean}
   */
  canPlayOtherAnims = true;

  /**
   * Animation prefixes that can always play, even when canPlayOtherAnims is false
   * @type {string[]}
   */
  ignoreExclusionPref = [];

  /**
   * Tracks dance alternation state
   * @type {boolean}
   * @private
   */
  _hasDanced = false;

  /**
   * Original position before any offsets
   * @type {{x: number, y: number}}
   */
  originalPosition = { x: 0, y: 0 };

  /**
   * Create a new FunkinSprite
   * @param {Phaser.Scene} scene - The scene this sprite belongs to
   * @param {number} [x=0] - Initial X position
   * @param {number} [y=0] - Initial Y position
   * @param {string} [texture] - Texture key
   * @param {string | number} [frame] - Initial frame
   */
  constructor(scene, x = 0, y = 0, texture, frame) {
    super(scene, x, y, texture, frame);

    this.originalPosition = { x, y };

    // Setup animation complete callback
    this.on('animationcomplete', this._onAnimationComplete, this);
  }

  // ========================================
  // STATIC FACTORY METHODS
  // ========================================

  /**
   * Create a new FunkinSprite with a static texture.
   * @param {Phaser.Scene} scene - The scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} key - Texture key
   * @returns {FunkinSprite}
   */
  static create(scene, x = 0, y = 0, key) {
    const sprite = new FunkinSprite(scene, x, y, key);
    scene.add.existing(sprite);
    return sprite;
  }

  /**
   * Create a new FunkinSprite configured for pixel art.
   * @param {Phaser.Scene} scene - The scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} key - Texture key
   * @param {number} [scale=6] - Pixel art scale
   * @returns {FunkinSprite}
   */
  static createPixel(scene, x = 0, y = 0, key, scale = 6) {
    const sprite = new FunkinSprite(scene, x, y, key);
    sprite.setPixelArt(true, scale);
    scene.add.existing(sprite);
    return sprite;
  }

  // ========================================
  // PIXEL ART SUPPORT
  // ========================================

  /**
   * Configure sprite for pixel art rendering.
   * @param {boolean} isPixel - Whether to use pixel rendering
   * @param {number} [scale] - Optional scale to apply
   * @returns {this}
   */
  setPixelArt(isPixel, scale) {
    this.isPixel = isPixel;

    if (isPixel) {
      // Disable texture filtering for crisp pixels
      if (this.texture && this.texture.source && this.texture.source[0]) {
        this.texture.source[0].scaleMode = Phaser.ScaleModes.NEAREST;
      }
    }

    if (scale !== undefined) {
      this.setScale(scale);
    }

    return this;
  }

  // ========================================
  // ANIMATION OFFSET HANDLING
  // ========================================

  /**
   * Set animation offsets for a specific animation.
   * @param {string} animName - Animation name
   * @param {number} xOffset - X offset
   * @param {number} yOffset - Y offset
   * @returns {this}
   */
  setAnimationOffsets(animName, xOffset, yOffset) {
    this.animationOffsets.set(animName, { x: xOffset, y: yOffset });
    return this;
  }

  /**
   * Set animation offsets from an array [x, y].
   * @param {string} animName - Animation name
   * @param {number[]} offsets - [x, y] offset array
   * @returns {this}
   */
  setAnimationOffsetsArray(animName, offsets) {
    if (offsets && offsets.length >= 2) {
      this.setAnimationOffsets(animName, offsets[0], offsets[1]);
    }
    return this;
  }

  /**
   * Get animation offsets for a specific animation.
   * @param {string} animName - Animation name
   * @returns {AnimationOffsets}
   */
  getAnimationOffsets(animName) {
    return this.animationOffsets.get(animName) || { x: 0, y: 0 };
  }

  /**
   * Set global offsets applied to all animations.
   * @param {number} x - X offset
   * @param {number} y - Y offset
   * @returns {this}
   */
  setGlobalOffsets(x, y) {
    this.globalOffsets = { x, y };
    return this;
  }

  /**
   * Apply animation offsets for the current animation.
   * @param {string} animName - Animation name
   * @private
   */
  _applyAnimationOffsets(animName) {
    const offsets = this.getAnimationOffsets(animName);
    this._currentAnimOffsets = { x: offsets.x, y: offsets.y };
  }

  /**
   * Get the effective X position including offsets.
   * @returns {number}
   */
  getEffectiveX() {
    return this.x - (this._currentAnimOffsets.x - this.globalOffsets.x) * this.scaleX;
  }

  /**
   * Get the effective Y position including offsets.
   * @returns {number}
   */
  getEffectiveY() {
    return this.y - (this._currentAnimOffsets.y - this.globalOffsets.y) * this.scaleY;
  }

  // ========================================
  // ANIMATION PLAYBACK
  // ========================================

  /**
   * Play an animation with offset support.
   * @param {string} animName - Animation name to play
   * @param {boolean} [restart=false] - Whether to restart if already playing
   * @param {boolean} [ignoreOther=false] - Whether to block other animations until complete
   * @returns {this}
   */
  playAnimation(animName, restart = false, ignoreOther = false) {
    // Check if we can play this animation
    if (!this.canPlayOtherAnims) {
      const currentAnim = this.getCurrentAnimation();
      const resolvedAnimKey = this._resolveAnimationKey(animName);
      if ((currentAnim === animName || currentAnim === resolvedAnimKey) && restart) {
        // Allow restart of same animation
      } else if (this.ignoreExclusionPref.length > 0) {
        // Check if this animation is in the exclusion list
        const canPlay = this.ignoreExclusionPref.some((prefix) => animName.startsWith(prefix));
        if (!canPlay) {
          return this;
        }
      } else {
        return this;
      }
    }

    // Correct animation name if needed
    const correctedName = this._correctAnimationName(animName);
    if (!correctedName) {
      return this;
    }

    const animationKey = this._resolveAnimationKey(correctedName);
    if (!animationKey) {
      console.warn(`[FunkinSprite] Animation not found: ${correctedName}`);
      return this;
    }

    if (!this.anims || !this.anims.animationManager.exists(animationKey)) {
      if (this.anims.exists(animationKey)) {
        this.play({ key: animationKey, repeat: -1 }, !restart);
      } else {
        console.warn(`[FunkinSprite] Animation not found: ${animationKey}`);
        return this;
      }
    } else {
      this.play({ key: animationKey }, !restart);
    }

    if (ignoreOther) {
      this.canPlayOtherAnims = false;
    }

    this._applyAnimationOffsets(correctedName);
    return this;
  }

  /**
   * Correct animation name by stripping suffixes if animation doesn't exist.
   * @param {string} name - Animation name
   * @param {string} [fallback='idle'] - Fallback animation
   * @returns {string | null}
   * @private
   */
  _correctAnimationName(name, fallback = 'idle') {
    if (this.hasAnimation(name)) {
      return name;
    }

    // Try stripping suffix
    const lastDash = name.lastIndexOf('-');
    if (lastDash !== -1) {
      const stripped = name.substring(0, lastDash);
      console.warn(`[FunkinSprite] Animation "${name}" not found, trying "${stripped}"`);
      return this._correctAnimationName(stripped, fallback);
    }

    // Try fallback
    if (fallback && fallback !== name) {
      console.warn(`[FunkinSprite] Animation "${name}" not found, falling back to "${fallback}"`);
      return this._correctAnimationName(fallback, null);
    }

    console.error(`[FunkinSprite] Animation "${name}" not found!`);
    return null;
  }

  /**
   * Check if an animation exists.
   * @param {string} animName - Animation name
   * @returns {boolean}
   */
  hasAnimation(animName) {
    if (!this.anims) {
      return false;
    }

    return this._resolveAnimationKey(animName) !== null;
  }

  /**
   * Resolve an animation name to the concrete Phaser animation key.
   * Prefers texture-scoped registrations when `_textureKey` is present.
   * @param {string} animName
   * @returns {string | null}
   * @private
   */
  _resolveAnimationKey(animName) {
    if (!this.anims) {
      return null;
    }

    if (this._textureKey) {
      const namespacedKey = `${this._textureKey}-${animName}`;
      const hasNamespacedAnimation =
        this.scene?.anims?.exists?.(namespacedKey) ||
        this.anims.exists(namespacedKey) ||
        this.anims.animationManager?.exists(namespacedKey);
      if (hasNamespacedAnimation) {
        return namespacedKey;
      }
    }

    if (this.anims.exists(animName) || this.anims.animationManager?.exists(animName)) {
      return animName;
    }

    return null;
  }

  /**
   * Get the name of the currently playing animation.
   * @returns {string}
   */
  getCurrentAnimation() {
    if (!this.anims || !this.anims.currentAnim) {
      return '';
    }
    return this.anims.currentAnim.key;
  }

  /**
   * Check if the current animation has finished.
   * @returns {boolean}
   */
  isAnimationFinished() {
    if (!this.anims) {
      return true;
    }
    return !this.anims.isPlaying;
  }

  /**
   * Check if an animation is dynamic (has multiple frames).
   * @param {string} animName - Animation name
   * @returns {boolean}
   */
  isAnimationDynamic(animName) {
    if (!this.anims) {
      return false;
    }

    const anim = this.anims.animationManager?.get(animName);
    if (!anim) {
      return false;
    }

    return anim.frames.length > 1;
  }

  /**
   * Animation complete callback.
   * @param {Phaser.Animations.Animation} _animation - The animation that completed
   * @private
   */
  _onAnimationComplete(_animation) {
    if (!this.canPlayOtherAnims) {
      this.canPlayOtherAnims = true;
    }
  }

  // ========================================
  // DANCE/IDLE ANIMATION SYSTEM
  // ========================================

  /**
   * Update shouldAlternate based on available animations.
   * @private
   */
  _updateShouldAlternate() {
    this.shouldAlternate = this.hasAnimation('danceLeft');
  }

  /**
   * Play the dance/idle animation.
   * @param {boolean} [forceRestart=false] - Whether to force restart the animation
   */
  dance(forceRestart = false) {
    if (this.shouldAlternate === null) {
      this._updateShouldAlternate();
    }

    if (this.shouldAlternate) {
      if (this._hasDanced) {
        this.playAnimation(`danceRight${this.idleSuffix}`, forceRestart);
      } else {
        this.playAnimation(`danceLeft${this.idleSuffix}`, forceRestart);
      }
      this._hasDanced = !this._hasDanced;
    } else {
      this.playAnimation(`idle${this.idleSuffix}`, forceRestart);
    }
  }

  /**
   * Called on step hit - handles dance timing.
   * @param {number} step - Current step number
   * @param {number} [stepsPerBeat=4] - Steps per beat
   */
  onStepHit(step, stepsPerBeat = 4) {
    if (this.danceEvery > 0 && step % (this.danceEvery * stepsPerBeat) === 0) {
      this.dance(this.shouldBop);
    }
  }

  /**
   * Called on beat hit.
   * @param {number} _beat - Current beat number
   */
  onBeatHit(_beat) {
    // Override in subclasses if needed
  }

  // ========================================
  // POSITION UTILITIES
  // ========================================

  /**
   * Reset to original position.
   */
  resetPosition() {
    this.x = this.originalPosition.x;
    this.y = this.originalPosition.y;
  }

  /**
   * Set position and update original position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {this}
   */
  setPositionWithOrigin(x, y) {
    this.setPosition(x, y);
    this.originalPosition = { x, y };
    return this;
  }

  // ========================================
  // Z-INDEX / DEPTH SUPPORT
  // ========================================

  /**
   * Set the z-index/depth for rendering order.
   * @param {number} zIndex - Z-index value (higher = in front)
   * @returns {this}
   */
  setZIndex(zIndex) {
    this.setDepth(zIndex);
    return this;
  }

  /**
   * Get the current z-index/depth.
   * @returns {number}
   */
  getZIndex() {
    return this.depth;
  }

  // ========================================
  // TEXTURE LOADING HELPERS
  // ========================================

  /**
   * Load a static texture.
   * @param {string} key - Texture key
   * @returns {this}
   */
  loadTexture(key) {
    this.setTexture(key);
    return this;
  }

  /**
   * Create a solid color sprite.
   * More memory efficient than makeGraphic for large solid colors.
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {number} [color=0xffffff] - Color value
   * @returns {this}
   */
  makeSolidColor(width, height, color = 0xffffff) {
    // Create a small graphic and scale it up
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, 2, 2);

    const key = `solid_${color.toString(16)}`;
    if (!this.scene.textures.exists(key)) {
      graphics.generateTexture(key, 2, 2);
    }
    graphics.destroy();

    this.setTexture(key);
    this.setScale(width / 2, height / 2);
    this.setOrigin(0, 0);

    return this;
  }

  // ========================================
  // CLONE SUPPORT
  // ========================================

  /**
   * Create a clone of this sprite.
   * @returns {FunkinSprite}
   */
  clone() {
    const cloned = new FunkinSprite(this.scene, this.x, this.y, this.texture.key, this.frame.name);

    cloned.setScale(this.scaleX, this.scaleY);
    cloned.setOrigin(this.originX, this.originY);
    cloned.setDepth(this.depth);
    cloned.setAlpha(this.alpha);
    cloned.setAngle(this.angle);
    cloned.setFlip(this.flipX, this.flipY);

    // Copy FunkinSprite-specific properties
    cloned.isPixel = this.isPixel;
    cloned.danceEvery = this.danceEvery;
    cloned.shouldAlternate = this.shouldAlternate;
    cloned.idleSuffix = this.idleSuffix;
    cloned.shouldBop = this.shouldBop;
    cloned.globalOffsets = { ...this.globalOffsets };

    // Copy animation offsets
    for (const [name, offsets] of this.animationOffsets) {
      cloned.animationOffsets.set(name, { ...offsets });
    }

    return cloned;
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the sprite and clean up resources.
   * @param {boolean} [fromScene] - Whether being destroyed from scene
   */
  destroy(fromScene) {
    this.animationOffsets.clear();
    this.off('animationcomplete', this._onAnimationComplete, this);

    // Stop any tweens on this sprite
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
    }

    super.destroy(fromScene);
  }
}

export default FunkinSprite;

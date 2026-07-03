/**
 * @fileoverview ComboPopup - Judgement and combo number display
 * Shows judgement sprites (SICK, GOOD, etc.) and combo numbers.
 *
 * Ported from source/funkin/play/components/PopUpScore.hx
 */

/**
 * Judgement types
 * @enum {string}
 */
export const JudgementType = {
  KILLER: 'killer',
  SICK: 'sick',
  GOOD: 'good',
  BAD: 'bad',
  SHIT: 'shit'
};

/**
 * @typedef {Object} ComboPopupConfig
 * @property {number} [x=0] - X position
 * @property {number} [y=0] - Y position
 * @property {number} [scale=0.7] - Sprite scale
 * @property {number} [fadeTime=200] - Fade out time in ms
 * @property {number} [riseSpeed=0.5] - Rise speed
 * @property {number} [gravity=0.02] - Gravity for falling
 * @property {boolean} [showComboNumbers=true] - Whether to show combo numbers
 * @property {string} [comboNumberTexturePrefix] - Texture-key prefix for loaded combo-number assets
 * @property {((gameObject: any) => void) | null} [registerObject] - Optional hook invoked with each
 *   newly created Phaser game object so the owner can assign it to a camera layer (e.g. the HUD camera)
 */

/**
 * @typedef {Object} PopupSprite
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} alpha - Alpha transparency
 * @property {number} velocityY - Vertical velocity
 * @property {number} lifetime - Current lifetime
 * @property {number} maxLifetime - Maximum lifetime
 * @property {string} [judgement] - Judgement type
 * @property {boolean} visible - Whether visible
 * @property {number} scale - Scale
 * @property {string | number} [digit] - Digit character
 * @property {Phaser.GameObjects.Sprite | Phaser.GameObjects.Text | null} [gameObject] - Phaser game object
 */

/**
 * Popup display for judgements and combo numbers.
 */
class ComboPopup {
  /**
   * The Phaser scene
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * X position
   * @type {number}
   */
  x = 0;

  /**
   * Y position
   * @type {number}
   */
  y = 0;

  /**
   * Sprite scale
   * @type {number}
   */
  scale = 0.7;

  /**
   * Fade out time in ms
   * @type {number}
   */
  fadeTime = 200;

  /**
   * Rise speed
   * @type {number}
   */
  riseSpeed = 0.5;

  /**
   * Gravity for falling
   * @type {number}
   */
  gravity = 0.02;

  /**
   * Whether to show combo numbers
   * @type {boolean}
   */
  showComboNumbers = true;

  /**
   * Active judgement sprites
   * @type {Array<PopupSprite>}
   */
  activeJudgements = [];

  /**
   * Active combo number sprites
   * @type {Array<PopupSprite>}
   */
  activeNumbers = [];

  /**
   * Judgement sprite pool
   * @type {Array<PopupSprite>}
   */
  judgementPool = [];

  /**
   * Number sprite pool
   * @type {Array<PopupSprite>}
   */
  numberPool = [];

  /**
   * Maximum active popups
   * @type {number}
   */
  maxActive = 10;

  /**
   * Spacing between combo digits
   * @type {number}
   */
  digitSpacing = 40;

  /**
   * Offset for combo numbers from judgement
   * @type {{x: number, y: number}}
   */
  comboOffset = { x: 0, y: 100 };

  /**
   * Depth assigned to popup game objects so they render above HUD background.
   * @type {number}
   */
  depth = 100;

  /**
   * Texture-key prefix used to look up loaded note-style combo-number assets.
   * When a texture named `${prefix}-${digit}` exists in the scene it is used
   * instead of a Phaser Text label.
   * @type {string}
   */
  comboNumberTexturePrefix = 'combo-num';

  /**
   * Optional hook invoked with each newly created Phaser game object. Lets the
   * owner (e.g. PlayState) register popups on the HUD camera so they render
   * fixed to the screen. Null in headless mode.
   * @type {((gameObject: any) => void) | null}
   */
  registerObject = null;

  /**
   * Create a new ComboPopup manager
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {ComboPopupConfig} [config={}] - Configuration options
   */
  constructor(scene, config = {}) {
    this.scene = scene;

    // Apply configuration
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.scale = config.scale ?? 0.7;
    this.fadeTime = config.fadeTime ?? 200;
    this.riseSpeed = config.riseSpeed ?? 0.5;
    this.gravity = config.gravity ?? 0.02;
    this.showComboNumbers = config.showComboNumbers ?? true;
    if (config.comboNumberTexturePrefix) {
      this.comboNumberTexturePrefix = config.comboNumberTexturePrefix;
    }
    this.registerObject = config.registerObject ?? null;
  }

  /**
   * Lazily create the real Phaser game object backing a popup record.
   *
   * Judgement records render as a colored Phaser Text label; combo-number
   * records use a loaded note-style combo-number texture when available,
   * otherwise a Phaser Text digit. All creation is guarded behind
   * `this.scene?.add` so headless environments (and teardown races) never throw.
   *
   * @param {PopupSprite} record - The popup record to back with a game object
   * @returns {Phaser.GameObjects.Sprite | Phaser.GameObjects.Text | null}
   */
  ensureGameObject(record) {
    if (!record) {
      return null;
    }
    if (record.gameObject) {
      this.refreshGameObjectContent(record);
      return record.gameObject;
    }
    if (!this.scene?.add) {
      return null;
    }

    /** @type {any} */
    let gameObject = null;

    if (record.judgement !== undefined) {
      const name = ComboPopup.getJudgementName(record.judgement);
      const color = ComboPopup.getJudgementColor(record.judgement);
      gameObject = this.scene.add.text(record.x, record.y, name, {
        fontFamily: 'VCR, Arial, sans-serif',
        fontSize: '48px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        align: 'center'
      });
    } else if (record.digit !== undefined) {
      const textureKey = `${this.comboNumberTexturePrefix}-${record.digit}`;
      if (this.scene.textures?.exists?.(textureKey) && this.scene.add.image) {
        gameObject = this.scene.add.image(record.x, record.y, textureKey);
      } else {
        gameObject = this.scene.add.text(record.x, record.y, String(record.digit), {
          fontFamily: 'VCR, Arial, sans-serif',
          fontSize: '64px',
          color: '#ffffff',
          align: 'center'
        });
      }
    }

    if (!gameObject) {
      return null;
    }

    if (typeof gameObject.setOrigin === 'function') {
      gameObject.setOrigin(0.5, 0.5);
    }
    if (typeof gameObject.setDepth === 'function') {
      gameObject.setDepth(this.depth);
    }

    record.gameObject = gameObject;
    if (typeof this.registerObject === 'function') {
      this.registerObject(gameObject);
    }
    this.syncGameObject(record);
    return gameObject;
  }

  /**
   * Refresh the textual content/color of a reused game object so a recycled
   * record does not display stale judgement text or digits. Only applies to
   * Phaser Text objects; image-backed combo numbers are reused as-is (their
   * digit identity is fixed by the spawned value, so callers spawn fresh
   * records per digit).
   * @param {PopupSprite} record - The popup record being reused
   */
  refreshGameObjectContent(record) {
    /** @type {any} */
    const gameObject = record?.gameObject;
    if (!gameObject || typeof gameObject.setText !== 'function') {
      return;
    }
    if (record.judgement !== undefined) {
      gameObject.setText(ComboPopup.getJudgementName(record.judgement));
      if (typeof gameObject.setColor === 'function') {
        const color = ComboPopup.getJudgementColor(record.judgement);
        gameObject.setColor(`#${color.toString(16).padStart(6, '0')}`);
      }
    } else if (record.digit !== undefined) {
      gameObject.setText(String(record.digit));
    }
  }

  /**
   * Apply the tracked render state (`x`, `y`, `alpha`, `scale`, `visible`) of a
   * popup record onto its backing game object. No-op when there is no game
   * object (headless mode).
   *
   * @param {PopupSprite} record - The popup record to sync
   */
  syncGameObject(record) {
    const gameObject = record?.gameObject;
    if (!gameObject) {
      return;
    }
    if (typeof gameObject.setPosition === 'function') {
      gameObject.setPosition(record.x, record.y);
    }
    if (typeof gameObject.setAlpha === 'function') {
      gameObject.setAlpha(record.alpha);
    }
    if (typeof gameObject.setScale === 'function') {
      gameObject.setScale(record.scale);
    }
    if (typeof gameObject.setVisible === 'function') {
      gameObject.setVisible(record.visible);
    }
  }

  /**
   * Destroy the backing game object of a record (if any) and clear the link.
   * @param {PopupSprite} record - The popup record whose game object to destroy
   */
  destroyGameObject(record) {
    if (!record) {
      return;
    }
    if (record.gameObject && typeof record.gameObject.destroy === 'function') {
      record.gameObject.destroy();
    }
    record.gameObject = null;
  }

  /**
   * Show a judgement popup
   * @param {string} judgement - Judgement type (sick, good, bad, shit)
   * @param {number} [combo=0] - Current combo count
   * @param {number} [x] - X position (defaults to this.x)
   * @param {number} [y] - Y position (defaults to this.y)
   */
  showJudgement(judgement, combo = 0, x, y) {
    const posX = x ?? this.x;
    const posY = y ?? this.y;

    // Create judgement sprite
    const judgementSprite = this.createJudgementSprite(judgement, posX, posY);
    if (judgementSprite) {
      this.activeJudgements.push(judgementSprite);
    }

    // Create combo numbers if enabled and combo > 0
    if (this.showComboNumbers && combo > 0) {
      this.showComboNumber(combo, posX + this.comboOffset.x, posY + this.comboOffset.y);
    }

    // Clean up old popups if too many
    this.cleanupOldPopups();
  }

  /**
   * Create a judgement sprite
   * @param {string} judgement - Judgement type
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {PopupSprite | null}
   */
  createJudgementSprite(judgement, x, y) {
    // Get from pool or create new
    /** @type {PopupSprite | undefined} */
    let sprite = this.judgementPool.pop();

    if (!sprite) {
      sprite = this.createSprite();
    }

    if (!sprite) {
      return null;
    }

    // Configure sprite
    sprite.x = x;
    sprite.y = y;
    sprite.alpha = 1;
    sprite.velocityY = -this.riseSpeed * 10;
    sprite.lifetime = 0;
    sprite.maxLifetime = this.fadeTime + 300;
    sprite.judgement = judgement;
    sprite.visible = true;
    sprite.scale = this.scale;

    // Attach/refresh the real game object (no-op in headless mode)
    this.ensureGameObject(sprite);

    return sprite;
  }

  /**
   * Show combo number sprites
   * @param {number} combo - Combo count
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  showComboNumber(combo, x, y) {
    const digits = combo.toString().split('');
    const totalWidth = digits.length * this.digitSpacing;
    const startX = x - totalWidth / 2;

    digits.forEach((digit, index) => {
      const digitX = startX + index * this.digitSpacing;
      const numberSprite = this.createNumberSprite(parseInt(digit), digitX, y);
      if (numberSprite) {
        this.activeNumbers.push(numberSprite);
      }
    });
  }

  /**
   * Create a number sprite
   * @param {number} digit - Digit (0-9)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {PopupSprite | null}
   */
  createNumberSprite(digit, x, y) {
    // Get from pool or create new
    /** @type {PopupSprite | undefined} */
    let sprite = this.numberPool.pop();

    if (!sprite) {
      sprite = this.createSprite();
    }

    if (!sprite) {
      return null;
    }

    // Configure sprite
    sprite.x = x;
    sprite.y = y;
    sprite.alpha = 1;
    sprite.velocityY = -this.riseSpeed * 8;
    sprite.lifetime = 0;
    sprite.maxLifetime = this.fadeTime + 200;
    sprite.digit = digit;
    sprite.visible = true;
    sprite.scale = this.scale;

    // Attach/refresh the real game object (no-op in headless mode)
    this.ensureGameObject(sprite);

    return sprite;
  }

  /**
   * Create a basic sprite object
   * @returns {PopupSprite}
   */
  createSprite() {
    return {
      x: 0,
      y: 0,
      alpha: 1,
      velocityY: 0,
      lifetime: 0,
      maxLifetime: 500,
      visible: true,
      scale: 1,
      judgement: undefined,
      digit: undefined
    };
  }

  /**
   * Update all active popups
   * @param {number} delta - Delta time in ms
   */
  update(delta) {
    // Update judgement sprites
    this.updateSprites(this.activeJudgements, this.judgementPool, delta);

    // Update number sprites
    this.updateSprites(this.activeNumbers, this.numberPool, delta);
  }

  /**
   * Update a list of sprites
   * @param {Array<PopupSprite>} active - Active sprites
   * @param {Array<PopupSprite>} pool - Pool to return to
   * @param {number} delta - Delta time
   */
  updateSprites(active, pool, delta) {
    for (let i = active.length - 1; i >= 0; i--) {
      const sprite = active[i];

      // Update lifetime
      sprite.lifetime += delta;

      // Apply velocity and gravity
      sprite.y += sprite.velocityY;
      sprite.velocityY += this.gravity * delta;

      // Fade out near end of lifetime
      const fadeStart = sprite.maxLifetime - this.fadeTime;
      if (sprite.lifetime > fadeStart) {
        const fadeProgress = (sprite.lifetime - fadeStart) / this.fadeTime;
        sprite.alpha = 1 - fadeProgress;
      }

      // Remove if lifetime exceeded
      if (sprite.lifetime >= sprite.maxLifetime) {
        sprite.visible = false;
        this.syncGameObject(sprite);
        active.splice(i, 1);
        pool.push(sprite);
      } else {
        this.syncGameObject(sprite);
      }
    }
  }

  /**
   * Clean up old popups if too many active
   */
  cleanupOldPopups() {
    while (this.activeJudgements.length > this.maxActive) {
      const sprite = this.activeJudgements.shift();
      if (sprite) {
        sprite.visible = false;
        this.syncGameObject(sprite);
        this.judgementPool.push(sprite);
      }
    }

    while (this.activeNumbers.length > this.maxActive * 4) {
      const sprite = this.activeNumbers.shift();
      if (sprite) {
        sprite.visible = false;
        this.syncGameObject(sprite);
        this.numberPool.push(sprite);
      }
    }
  }

  /**
   * Set the position for popups
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {this}
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Set the scale for popups
   * @param {number} scale - Scale value
   * @returns {this}
   */
  setScale(scale) {
    this.scale = scale;
    return this;
  }

  /**
   * Set whether to show combo numbers
   * @param {boolean} show - Whether to show
   * @returns {this}
   */
  setShowComboNumbers(show) {
    this.showComboNumbers = show;
    return this;
  }

  /**
   * Get the number of active judgement sprites
   * @returns {number}
   */
  getActiveJudgementCount() {
    return this.activeJudgements.length;
  }

  /**
   * Get the number of active number sprites
   * @returns {number}
   */
  getActiveNumberCount() {
    return this.activeNumbers.length;
  }

  /**
   * Get all active sprites for rendering
   * @returns {Array<PopupSprite>}
   */
  getActiveSprites() {
    return [...this.activeJudgements, ...this.activeNumbers];
  }

  /**
   * Clear all active popups
   */
  clear() {
    // Return all active to pools
    while (this.activeJudgements.length > 0) {
      const sprite = this.activeJudgements.pop();
      if (sprite) {
        sprite.visible = false;
        this.syncGameObject(sprite);
        this.judgementPool.push(sprite);
      }
    }

    while (this.activeNumbers.length > 0) {
      const sprite = this.activeNumbers.pop();
      if (sprite) {
        sprite.visible = false;
        this.syncGameObject(sprite);
        this.numberPool.push(sprite);
      }
    }
  }

  /**
   * Get judgement color
   * @param {string} judgement - Judgement type
   * @returns {number}
   */
  static getJudgementColor(judgement) {
    switch (judgement) {
      case JudgementType.KILLER:
        return 0xffffff; // White/rainbow
      case JudgementType.SICK:
        return 0x00ffff; // Cyan
      case JudgementType.GOOD:
        return 0x00ff00; // Green
      case JudgementType.BAD:
        return 0xffff00; // Yellow
      case JudgementType.SHIT:
        return 0xff0000; // Red
      default:
        return 0xffffff;
    }
  }

  /**
   * Get judgement display name
   * @param {string} judgement - Judgement type
   * @returns {string}
   */
  static getJudgementName(judgement) {
    switch (judgement) {
      case JudgementType.KILLER:
        return 'KILLER';
      case JudgementType.SICK:
        return 'SICK!!';
      case JudgementType.GOOD:
        return 'GOOD!';
      case JudgementType.BAD:
        return 'BAD';
      case JudgementType.SHIT:
        return 'SHIT';
      default:
        return judgement.toUpperCase();
    }
  }

  /**
   * Destroy the combo popup manager
   */
  destroy() {
    // Destroy every backing game object across active and pooled records.
    for (const record of [
      ...this.activeJudgements,
      ...this.activeNumbers,
      ...this.judgementPool,
      ...this.numberPool
    ]) {
      this.destroyGameObject(record);
    }

    this.clear();
    this.judgementPool = [];
    this.numberPool = [];
    this.scene = null;
  }
}

export default ComboPopup;

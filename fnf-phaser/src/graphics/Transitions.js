/**
 * @fileoverview Transitions - Scene transition effects
 * Implements FR-6.2: Fade and sticker transitions
 */

import Phaser from 'phaser';

/**
 * Transition types
 * @readonly
 * @enum {string}
 */
export const TransitionType = {
  FADE: 'fade',
  FADE_WHITE: 'fadeWhite',
  SLIDE_LEFT: 'slideLeft',
  SLIDE_RIGHT: 'slideRight',
  SLIDE_UP: 'slideUp',
  SLIDE_DOWN: 'slideDown',
  ZOOM_IN: 'zoomIn',
  ZOOM_OUT: 'zoomOut',
  STICKER: 'sticker',
  PIXELATE: 'pixelate',
  WIPE: 'wipe'
};

/**
 * Transition configuration
 * @typedef {Object} TransitionConfig
 * @property {string} [type='fade'] - Transition type
 * @property {number} [duration=500] - Duration in ms
 * @property {Function} [ease='Sine.easeInOut'] - Easing function
 * @property {number} [color=0x000000] - Color for fade transitions
 * @property {string} [direction='out'] - Direction ('in' or 'out')
 * @property {Function} [onComplete] - Callback when complete
 */

/**
 * Transitions - Utility class for scene transitions
 */
class Transitions {
  /**
   * The Phaser scene
   * @type {Phaser.Scene}
   */
  scene = null;

  /**
   * Transition overlay graphics
   * @type {Phaser.GameObjects.Graphics | null}
   */
  overlay = null;

  /**
   * Whether a transition is in progress
   * @type {boolean}
   */
  transitioning = false;

  /**
   * Current transition tween
   * @type {Phaser.Tweens.Tween | null}
   */
  currentTween = null;

  /**
   * Sticker sprites for sticker transition
   * @type {Phaser.GameObjects.Sprite[]}
   */
  stickers = [];

  /**
   * Create a new Transitions instance
   * @param {Phaser.Scene} scene - The Phaser scene
   */
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Play a transition out (before leaving scene)
   * @param {TransitionConfig} [config] - Transition configuration
   * @returns {Promise<void>}
   */
  async transitionOut(config = {}) {
    const type = config.type || TransitionType.FADE;
    const duration = config.duration ?? 500;

    return new Promise((resolve) => {
      config.onComplete = resolve;
      config.direction = 'out';

      switch (type) {
        case TransitionType.FADE:
          this.fadeTransition(config);
          break;
        case TransitionType.FADE_WHITE:
          this.fadeTransition({ ...config, color: 0xffffff });
          break;
        case TransitionType.SLIDE_LEFT:
        case TransitionType.SLIDE_RIGHT:
        case TransitionType.SLIDE_UP:
        case TransitionType.SLIDE_DOWN:
          this.slideTransition(config);
          break;
        case TransitionType.ZOOM_IN:
        case TransitionType.ZOOM_OUT:
          this.zoomTransition(config);
          break;
        case TransitionType.STICKER:
          this.stickerTransition(config);
          break;
        case TransitionType.PIXELATE:
          this.pixelateTransition(config);
          break;
        case TransitionType.WIPE:
          this.wipeTransition(config);
          break;
        default:
          this.fadeTransition(config);
      }
    });
  }

  /**
   * Play a transition in (when entering scene)
   * @param {TransitionConfig} [config] - Transition configuration
   * @returns {Promise<void>}
   */
  async transitionIn(config = {}) {
    const type = config.type || TransitionType.FADE;

    return new Promise((resolve) => {
      config.onComplete = resolve;
      config.direction = 'in';

      switch (type) {
        case TransitionType.FADE:
          this.fadeTransition(config);
          break;
        case TransitionType.FADE_WHITE:
          this.fadeTransition({ ...config, color: 0xffffff });
          break;
        case TransitionType.SLIDE_LEFT:
        case TransitionType.SLIDE_RIGHT:
        case TransitionType.SLIDE_UP:
        case TransitionType.SLIDE_DOWN:
          this.slideTransition(config);
          break;
        case TransitionType.ZOOM_IN:
        case TransitionType.ZOOM_OUT:
          this.zoomTransition(config);
          break;
        case TransitionType.STICKER:
          this.stickerTransitionIn(config);
          break;
        default:
          this.fadeTransition(config);
      }
    });
  }

  // ========================================
  // FADE TRANSITION
  // ========================================

  /**
   * Perform a fade transition
   * @param {TransitionConfig} config - Configuration
   */
  fadeTransition(config) {
    const duration = config.duration ?? 500;
    const color = config.color ?? 0x000000;
    const direction = config.direction || 'out';

    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    if (direction === 'out') {
      this.scene.cameras.main.fadeOut(duration, r, g, b);
      this.scene.cameras.main.once('camerafadeoutcomplete', () => {
        if (config.onComplete) {
          config.onComplete();
        }
      });
    } else {
      this.scene.cameras.main.fadeIn(duration, r, g, b);
      this.scene.cameras.main.once('camerafadeincomplete', () => {
        if (config.onComplete) {
          config.onComplete();
        }
      });
    }
  }

  // ========================================
  // SLIDE TRANSITION
  // ========================================

  /**
   * Perform a slide transition
   * @param {TransitionConfig} config - Configuration
   */
  slideTransition(config) {
    const { width, height } = this.scene.cameras.main;
    const duration = config.duration ?? 500;
    const type = config.type || TransitionType.SLIDE_LEFT;
    const direction = config.direction || 'out';
    const ease = config.ease || 'Sine.easeInOut';

    // Create overlay
    this.createOverlay(config.color ?? 0x000000);

    let startX = 0,
      startY = 0,
      endX = 0,
      endY = 0;

    // Calculate positions based on type and direction
    if (direction === 'out') {
      switch (type) {
        case TransitionType.SLIDE_LEFT:
          startX = width;
          endX = 0;
          break;
        case TransitionType.SLIDE_RIGHT:
          startX = -width;
          endX = 0;
          break;
        case TransitionType.SLIDE_UP:
          startY = height;
          endY = 0;
          break;
        case TransitionType.SLIDE_DOWN:
          startY = -height;
          endY = 0;
          break;
      }
    } else {
      switch (type) {
        case TransitionType.SLIDE_LEFT:
          startX = 0;
          endX = -width;
          break;
        case TransitionType.SLIDE_RIGHT:
          startX = 0;
          endX = width;
          break;
        case TransitionType.SLIDE_UP:
          startY = 0;
          endY = -height;
          break;
        case TransitionType.SLIDE_DOWN:
          startY = 0;
          endY = height;
          break;
      }
    }

    this.overlay.setPosition(startX, startY);

    this.currentTween = this.scene.tweens.add({
      targets: this.overlay,
      x: endX,
      y: endY,
      duration,
      ease,
      onComplete: () => {
        if (direction === 'in') {
          this.destroyOverlay();
        }
        if (config.onComplete) {
          config.onComplete();
        }
      }
    });
  }

  // ========================================
  // ZOOM TRANSITION
  // ========================================

  /**
   * Perform a zoom transition
   * @param {TransitionConfig} config - Configuration
   */
  zoomTransition(config) {
    const duration = config.duration ?? 500;
    const type = config.type || TransitionType.ZOOM_IN;
    const direction = config.direction || 'out';
    const ease = config.ease || 'Sine.easeInOut';

    const camera = this.scene.cameras.main;
    const startZoom = camera.zoom;
    let endZoom;

    if (direction === 'out') {
      endZoom = type === TransitionType.ZOOM_IN ? 5 : 0.1;
    } else {
      camera.setZoom(type === TransitionType.ZOOM_IN ? 5 : 0.1);
      endZoom = startZoom;
    }

    // Also fade
    if (direction === 'out') {
      camera.fadeOut(duration, 0, 0, 0);
    } else {
      camera.fadeIn(duration, 0, 0, 0);
    }

    this.currentTween = this.scene.tweens.add({
      targets: camera,
      zoom: endZoom,
      duration,
      ease,
      onComplete: () => {
        if (direction === 'in') {
          camera.setZoom(1);
        }
        if (config.onComplete) {
          config.onComplete();
        }
      }
    });
  }

  // ========================================
  // STICKER TRANSITION
  // ========================================

  /**
   * Perform a sticker transition (out)
   * @param {TransitionConfig} config - Configuration
   */
  stickerTransition(config) {
    const { width, height } = this.scene.cameras.main;
    const duration = config.duration ?? 1000;
    const stickerCount = 20;

    this.stickers = [];

    // Create stickers that fly in from edges
    for (let i = 0; i < stickerCount; i++) {
      const delay = (i / stickerCount) * (duration * 0.7);
      const targetX = Phaser.Math.Between(0, width);
      const targetY = Phaser.Math.Between(0, height);

      // Start from random edge
      const edge = Phaser.Math.Between(0, 3);
      let startX, startY;

      switch (edge) {
        case 0: // Top
          startX = targetX;
          startY = -100;
          break;
        case 1: // Right
          startX = width + 100;
          startY = targetY;
          break;
        case 2: // Bottom
          startX = targetX;
          startY = height + 100;
          break;
        case 3: // Left
          startX = -100;
          startY = targetY;
          break;
      }

      // Create sticker graphic
      const sticker = this.createStickerGraphic(startX, startY);
      this.stickers.push(sticker);

      // Animate sticker
      this.scene.tweens.add({
        targets: sticker,
        x: targetX,
        y: targetY,
        rotation: Phaser.Math.DegToRad(Phaser.Math.Between(-30, 30)),
        scale: Phaser.Math.FloatBetween(0.8, 1.5),
        duration: 300,
        delay,
        ease: 'Back.easeOut'
      });
    }

    // Complete after all stickers are placed
    this.scene.time.delayedCall(duration, () => {
      if (config.onComplete) {
        config.onComplete();
      }
    });
  }

  /**
   * Perform a sticker transition (in - remove stickers)
   * @param {TransitionConfig} config - Configuration
   */
  stickerTransitionIn(config) {
    const { width, height } = this.scene.cameras.main;
    const duration = config.duration ?? 800;

    // Animate stickers flying away
    this.stickers.forEach((sticker, i) => {
      const delay = (i / this.stickers.length) * (duration * 0.5);
      const edge = Phaser.Math.Between(0, 3);
      let targetX, targetY;

      switch (edge) {
        case 0:
          targetX = sticker.x;
          targetY = -100;
          break;
        case 1:
          targetX = width + 100;
          targetY = sticker.y;
          break;
        case 2:
          targetX = sticker.x;
          targetY = height + 100;
          break;
        case 3:
          targetX = -100;
          targetY = sticker.y;
          break;
      }

      this.scene.tweens.add({
        targets: sticker,
        x: targetX,
        y: targetY,
        rotation: sticker.rotation + Phaser.Math.DegToRad(180),
        duration: 300,
        delay,
        ease: 'Back.easeIn',
        onComplete: () => {
          sticker.destroy();
        }
      });
    });

    this.scene.time.delayedCall(duration, () => {
      this.stickers = [];
      if (config.onComplete) {
        config.onComplete();
      }
    });
  }

  /**
   * Create a sticker graphic
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {Phaser.GameObjects.Graphics}
   */
  createStickerGraphic(x, y) {
    const graphics = this.scene.add.graphics();
    graphics.setPosition(x, y);

    // Random sticker shape and color
    const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da];
    const color = Phaser.Utils.Array.GetRandom(colors);

    graphics.fillStyle(color, 1);
    graphics.lineStyle(3, 0xffffff, 1);

    // Random shape
    const shape = Phaser.Math.Between(0, 2);
    const size = Phaser.Math.Between(40, 80);

    switch (shape) {
      case 0: // Circle
        graphics.fillCircle(0, 0, size / 2);
        graphics.strokeCircle(0, 0, size / 2);
        break;
      case 1: // Star
        this.drawStar(graphics, 0, 0, 5, size / 2, size / 4);
        break;
      case 2: // Heart
        this.drawHeart(graphics, 0, 0, size);
        break;
    }

    graphics.setDepth(1000);
    return graphics;
  }

  /**
   * Draw a star shape
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} points - Number of points
   * @param {number} outerRadius - Outer radius
   * @param {number} innerRadius - Inner radius
   */
  drawStar(graphics, cx, cy, points, outerRadius, innerRadius) {
    const step = Math.PI / points;
    const path = [];

    for (let i = 0; i < 2 * points; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * step - Math.PI / 2;
      path.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      });
    }

    graphics.fillPoints(path, true);
    graphics.strokePoints(path, true);
  }

  /**
   * Draw a heart shape
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} size - Size
   */
  drawHeart(graphics, cx, cy, size) {
    const scale = size / 30;
    graphics.beginPath();
    graphics.moveTo(cx, cy + 10 * scale);

    graphics.bezierCurveTo(
      cx,
      cy - 5 * scale,
      cx - 15 * scale,
      cy - 5 * scale,
      cx - 15 * scale,
      cy + 5 * scale
    );
    graphics.bezierCurveTo(
      cx - 15 * scale,
      cy + 15 * scale,
      cx,
      cy + 20 * scale,
      cx,
      cy + 25 * scale
    );
    graphics.bezierCurveTo(
      cx,
      cy + 20 * scale,
      cx + 15 * scale,
      cy + 15 * scale,
      cx + 15 * scale,
      cy + 5 * scale
    );
    graphics.bezierCurveTo(
      cx + 15 * scale,
      cy - 5 * scale,
      cx,
      cy - 5 * scale,
      cx,
      cy + 10 * scale
    );

    graphics.fillPath();
    graphics.strokePath();
  }

  // ========================================
  // WIPE TRANSITION
  // ========================================

  /**
   * Perform a wipe transition
   * @param {TransitionConfig} config - Configuration
   */
  wipeTransition(config) {
    const { width, height } = this.scene.cameras.main;
    const duration = config.duration ?? 500;
    const direction = config.direction || 'out';
    const color = config.color ?? 0x000000;

    // Create wipe overlay
    this.createOverlay(color);

    if (direction === 'out') {
      // Wipe from left to right
      this.overlay.setScale(0, 1);
      this.overlay.setOrigin(0, 0);

      this.currentTween = this.scene.tweens.add({
        targets: this.overlay,
        scaleX: 1,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (config.onComplete) {
            config.onComplete();
          }
        }
      });
    } else {
      // Wipe from right to left (reveal)
      this.overlay.setScale(1, 1);
      this.overlay.setOrigin(1, 0);
      this.overlay.setPosition(width, 0);

      this.currentTween = this.scene.tweens.add({
        targets: this.overlay,
        scaleX: 0,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.destroyOverlay();
          if (config.onComplete) {
            config.onComplete();
          }
        }
      });
    }
  }

  // ========================================
  // PIXELATE TRANSITION
  // ========================================

  /**
   * Perform a pixelate transition (requires shader support)
   * @param {TransitionConfig} config - Configuration
   */
  pixelateTransition(config) {
    // Fallback to fade if shaders not available
    this.fadeTransition(config);
  }

  // ========================================
  // HELPERS
  // ========================================

  /**
   * Create the transition overlay
   * @param {number} color - Fill color
   */
  createOverlay(color = 0x000000) {
    if (this.overlay) {
      this.overlay.destroy();
    }

    const { width, height } = this.scene.cameras.main;

    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(color, 1);
    this.overlay.fillRect(0, 0, width, height);
    this.overlay.setDepth(999);
  }

  /**
   * Destroy the transition overlay
   */
  destroyOverlay() {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
  }

  /**
   * Cancel any active transition
   */
  cancel() {
    if (this.currentTween) {
      this.currentTween.stop();
      this.currentTween = null;
    }

    this.destroyOverlay();

    this.stickers.forEach((s) => s.destroy());
    this.stickers = [];

    this.transitioning = false;
  }

  /**
   * Destroy the transitions instance
   */
  destroy() {
    this.cancel();
    this.scene = null;
  }
}

export default Transitions;

/**
 * @fileoverview FunkinCamera - Camera utilities for gameplay
 * Handles camera follow, zoom, and beat-synced effects.
 *
 * Ported from source/funkin/graphics/FunkinCamera.hx
 */

import * as Constants from '../core/Constants.js';
import { DEFAULT_PORTRAIT_ZOOM } from '../layout/LayoutManager.js';

/**
 * @typedef {Object} CameraTarget
 * @property {number} x - Target X position
 * @property {number} y - Target Y position
 */

/**
 * Camera controller for Friday Night Funkin' gameplay.
 * Handles:
 * - Smooth camera following
 * - Beat-synced zoom effects
 * - Camera focus on characters
 * - Zoom events from chart
 */
class FunkinCamera {
  /**
   * The Phaser camera
   * @type {Phaser.Cameras.Scene2D.Camera | null}
   */
  camera = null;

  /**
   * The Phaser scene
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * Current follow target
   * @type {CameraTarget | null}
   */
  followTarget = null;

  /**
   * Camera follow lerp rate (0-1)
   * @type {number}
   */
  followRate = Constants.DEFAULT_CAMERA_FOLLOW_RATE;

  /**
   * Default zoom level (portrait framing)
   * @type {number}
   */
  defaultZoom = DEFAULT_PORTRAIT_ZOOM;

  /**
   * Current zoom level
   * @type {number}
   */
  currentZoom = DEFAULT_PORTRAIT_ZOOM;

  /**
   * Target zoom level for lerping
   * @type {number}
   */
  targetZoom = DEFAULT_PORTRAIT_ZOOM;

  /**
   * Zoom lerp rate
   * @type {number}
   */
  zoomLerpRate = 0.05;

  /**
   * Beat zoom intensity
   * @type {number}
   */
  bopIntensity = Constants.DEFAULT_BOP_INTENSITY;

  /**
   * Beats between zoom bops
   * @type {number}
   */
  bopRate = Constants.DEFAULT_ZOOM_RATE;

  /**
   * Beat offset for zoom bops
   * @type {number}
   */
  bopOffset = Constants.DEFAULT_ZOOM_OFFSET;

  /**
   * Whether beat zoom is enabled
   * @type {boolean}
   */
  bopEnabled = true;

  /**
   * Whether camera is currently following
   * @type {boolean}
   */
  isFollowing = false;

  /**
   * Camera bounds
   * @type {{x: number, y: number, width: number, height: number} | null}
   */
  bounds = null;

  /**
   * Create a new FunkinCamera
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {Phaser.Cameras.Scene2D.Camera} [camera] - Optional camera (defaults to main)
   */
  constructor(scene, camera = undefined) {
    this.scene = scene;
    this.camera = camera || scene?.cameras?.main || null;

    if (this.camera) {
      this.defaultZoom = this.camera.zoom || DEFAULT_PORTRAIT_ZOOM;
      this.currentZoom = this.defaultZoom;
      this.targetZoom = this.defaultZoom;
    }
  }

  // ========================================
  // FOLLOW SYSTEM
  // ========================================

  /**
   * Set the camera follow target
   * @param {number} x - Target X position
   * @param {number} y - Target Y position
   * @param {boolean} [instant=false] - Whether to snap immediately
   */
  setFollowTarget(x, y, instant = false) {
    this.followTarget = { x, y };
    this.isFollowing = true;

    if (instant && this.camera) {
      this.camera.centerOn(x, y);
    }
  }

  /**
   * Follow a game object
   * @param {Record<string, any>} target - Object with x, y properties
   * @param {boolean} [instant=false] - Whether to snap immediately
   */
  followObject(target, instant = false) {
    if (!target) {
      return;
    }

    const x = target.x + (target.width || 0) / 2;
    const y = target.y + (target.height || 0) / 2;

    this.setFollowTarget(x, y, instant);
  }

  /**
   * Stop following
   */
  stopFollowing() {
    this.isFollowing = false;
    this.followTarget = null;
  }

  /**
   * Set the follow lerp rate
   * @param {number} rate - Lerp rate (0-1)
   */
  setFollowRate(rate) {
    this.followRate = Math.max(0, Math.min(1, rate));
  }

  // ========================================
  // ZOOM SYSTEM
  // ========================================

  /**
   * Set the default zoom level
   * @param {number} zoom - Zoom level
   */
  setDefaultZoom(zoom) {
    this.defaultZoom = zoom;
    this.targetZoom = zoom;
  }

  /**
   * Set the current zoom level
   * @param {number} zoom - Zoom level
   * @param {boolean} [instant=false] - Whether to apply immediately
   */
  setZoom(zoom, instant = false) {
    this.targetZoom = zoom;

    if (instant && this.camera) {
      this.currentZoom = zoom;
      this.camera.setZoom(zoom);
    }
  }

  /**
   * Reset zoom to default
   * @param {boolean} [instant=false] - Whether to apply immediately
   */
  resetZoom(instant = false) {
    this.setZoom(this.defaultZoom, instant);
  }

  /**
   * Apply a zoom bump (for beat effects)
   * @param {number} [intensity] - Zoom intensity multiplier
   */
  bumpZoom(intensity = undefined) {
    const bumpIntensity = intensity ?? this.bopIntensity;
    this.currentZoom = this.defaultZoom * bumpIntensity;

    if (this.camera) {
      this.camera.setZoom(this.currentZoom);
    }
  }

  // ========================================
  // BEAT SYNC
  // ========================================

  /**
   * Configure beat zoom settings
   * @param {number} [intensity] - Zoom intensity
   * @param {number} [rate] - Beats between bops
   * @param {number} [offset] - Beat offset
   */
  configureBeatZoom(intensity, rate, offset) {
    if (intensity !== undefined) {
      this.bopIntensity = intensity;
    }
    if (rate !== undefined) {
      this.bopRate = rate;
    }
    if (offset !== undefined) {
      this.bopOffset = offset;
    }
  }

  /**
   * Enable or disable beat zoom
   * @param {boolean} enabled - Whether beat zoom is enabled
   */
  setBeatZoomEnabled(enabled) {
    this.bopEnabled = enabled;
  }

  /**
   * Called on beat hit
   * @param {number} beat - Current beat number
   */
  onBeatHit(beat) {
    if (!this.bopEnabled) {
      return;
    }

    // Check if this beat should trigger a bop
    const adjustedBeat = beat - this.bopOffset;
    if (adjustedBeat >= 0 && adjustedBeat % this.bopRate === 0) {
      this.bumpZoom();
    }
  }

  // ========================================
  // UPDATE
  // ========================================

  /**
   * Update camera position and zoom
   * @param {number} _delta - Delta time in ms
   */
  update(_delta) {
    if (!this.camera) {
      return;
    }

    // Update follow position
    if (this.isFollowing && this.followTarget) {
      const currentX = this.camera.scrollX + this.camera.width / 2;
      const currentY = this.camera.scrollY + this.camera.height / 2;

      const newX = this.lerp(currentX, this.followTarget.x, this.followRate);
      const newY = this.lerp(currentY, this.followTarget.y, this.followRate);

      this.camera.centerOn(newX, newY);
    }

    // Update zoom
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.001) {
      this.currentZoom = this.lerp(this.currentZoom, this.targetZoom, this.zoomLerpRate);
      this.camera.setZoom(this.currentZoom);
    }
  }

  /**
   * Linear interpolation helper
   * @param {number} start - Start value
   * @param {number} end - End value
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number}
   */
  lerp(start, end, t) {
    return start + (end - start) * t;
  }

  // ========================================
  // CAMERA EFFECTS
  // ========================================

  /**
   * Shake the camera
   * @param {number} [duration=100] - Duration in ms
   * @param {number} [intensity=0.01] - Shake intensity
   */
  shake(duration = 100, intensity = 0.01) {
    if (this.camera?.shake) {
      this.camera.shake(duration, intensity);
    }
  }

  /**
   * Flash the camera
   * @param {number} [duration=250] - Duration in ms
   * @param {number} [color=0xffffff] - Flash color
   */
  flash(duration = 250, color = 0xffffff) {
    if (this.camera?.flash) {
      // Convert hex to RGB
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      this.camera.flash(duration, r, g, b);
    }
  }

  /**
   * Fade the camera
   * @param {number} [duration=500] - Duration in ms
   * @param {number} [color=0x000000] - Fade color
   * @param {boolean} [fadeIn=false] - Whether to fade in (vs fade out)
   * @param {Function} [callback] - Callback when complete
   */
  fade(duration = 500, color = 0x000000, fadeIn = false, callback = undefined) {
    if (!this.camera) {
      return;
    }

    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    if (fadeIn && this.camera.fadeIn) {
      this.camera.fadeIn(duration, r, g, b, callback);
    } else if (this.camera.fadeOut) {
      this.camera.fadeOut(duration, r, g, b, callback);
    }
  }

  // ========================================
  // BOUNDS
  // ========================================

  /**
   * Set camera bounds
   * @param {number} x - Left bound
   * @param {number} y - Top bound
   * @param {number} width - Bounds width
   * @param {number} height - Bounds height
   */
  setBounds(x, y, width, height) {
    this.bounds = { x, y, width, height };

    if (this.camera?.setBounds) {
      this.camera.setBounds(x, y, width, height);
    }
  }

  /**
   * Remove camera bounds
   */
  removeBounds() {
    this.bounds = null;

    if (this.camera?.removeBounds) {
      this.camera.removeBounds();
    }
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Get the camera's center position
   * @returns {{x: number, y: number}}
   */
  getCenter() {
    if (!this.camera) {
      return { x: 0, y: 0 };
    }

    return {
      x: this.camera.scrollX + this.camera.width / 2,
      y: this.camera.scrollY + this.camera.height / 2
    };
  }

  /**
   * Get the camera's viewport bounds
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getViewport() {
    if (!this.camera) {
      return { x: 0, y: 0, width: 1280, height: 720 };
    }

    return {
      x: this.camera.scrollX,
      y: this.camera.scrollY,
      width: this.camera.width,
      height: this.camera.height
    };
  }

  /**
   * Check if a point is visible in the camera
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} [margin=0] - Extra margin
   * @returns {boolean}
   */
  isPointVisible(x, y, margin = 0) {
    const viewport = this.getViewport();

    return (
      x >= viewport.x - margin &&
      x <= viewport.x + viewport.width + margin &&
      y >= viewport.y - margin &&
      y <= viewport.y + viewport.height + margin
    );
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the camera controller
   */
  destroy() {
    this.camera = null;
    this.scene = null;
    this.followTarget = null;
    this.bounds = null;
  }
}

export default FunkinCamera;

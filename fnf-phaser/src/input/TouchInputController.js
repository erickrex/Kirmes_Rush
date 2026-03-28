/**
 * @fileoverview TouchInputController - Renders four touch zones at the bottom
 * of the portrait canvas and translates touch/pointer events into the PlayState
 * input queue.
 *
 * Each zone is a `Phaser.GameObjects.Rectangle` with an arrow icon overlay.
 * Multi-touch is handled via Phaser's pointer system (pointers 1-4 enabled).
 *
 * The controller pushes `{ direction, timestamp }` objects into the same
 * `inputPressQueue` / `inputReleaseQueue` arrays that PreciseInput uses,
 * so existing note hit detection in PlayState works unchanged.
 */

import { TOUCH_ZONE_Y, TOUCH_ZONE_HEIGHT, TOUCH_ZONE_WIDTH } from '../layout/LayoutManager.js';
import { COLOR_NOTES } from '../core/Constants.js';

/**
 * Arrow rotation angles in radians for each direction.
 * @type {number[]}
 */
const DIRECTION_ANGLES = [
  Math.PI, // left
  Math.PI / 2, // down
  -Math.PI / 2, // up
  0 // right
];

/**
 * Idle alpha for unpressed zones.
 * @type {number}
 */
const IDLE_ALPHA = 0.4;

/**
 * Pressed alpha for active zones.
 * @type {number}
 */
const PRESSED_ALPHA = 0.8;

/**
 * @typedef {Object} TouchZone
 * @property {number} direction   - 0=left, 1=down, 2=up, 3=right
 * @property {number} x           - Zone left edge X
 * @property {number} y           - Zone top edge Y
 * @property {number} width       - Zone width
 * @property {number} height      - Zone height
 * @property {boolean} pressed    - Current press state
 * @property {number|null} pointerId - Active pointer tracking for multi-touch
 * @property {Object|null} rect   - Phaser.GameObjects.Rectangle (null in headless)
 * @property {Object|null} icon   - Phaser.GameObjects.Graphics arrow overlay (null in headless)
 */

/**
 * @typedef {Object} InputQueue
 * @property {Array<{direction: number, timestamp: number}>} pressQueue
 * @property {Array<{direction: number, timestamp: number}>} releaseQueue
 */

/**
 * Touch input controller for portrait mode.
 * Creates four directional touch zones at the bottom of the canvas.
 */
class TouchInputController {
  /**
   * The Phaser scene.
   * @type {Object|null}
   */
  scene = null;

  /**
   * Reference to the input queue object (must have pressQueue and releaseQueue arrays).
   * @type {InputQueue|null}
   */
  inputQueue = null;

  /**
   * The four touch zone states.
   * @type {TouchZone[]}
   */
  zones = [];

  /**
   * Whether the controller is currently visible.
   * @type {boolean}
   */
  visible = false;

  /**
   * Bound pointer event handlers for cleanup.
   * @type {Object|null}
   * @private
   */
  _boundHandlers = null;

  /**
   * @param {Object} scene - The Phaser scene
   * @param {InputQueue} inputQueue - Object with pressQueue and releaseQueue arrays
   */
  constructor(scene, inputQueue) {
    this.scene = scene;
    this.inputQueue = inputQueue;
    this.zones = [];
    this.visible = false;
    this._boundHandlers = null;
  }

  /**
   * Create the four touch zone rectangles with arrow icon overlays.
   * Zones are ordered left/down/up/right across the bottom of the canvas.
   */
  create() {
    const zoneWidth = TOUCH_ZONE_WIDTH;
    const zoneHeight = TOUCH_ZONE_HEIGHT;
    const zoneY = TOUCH_ZONE_Y;

    for (let i = 0; i < 4; i++) {
      const zoneX = i * zoneWidth;
      const color = COLOR_NOTES[i] ?? 0xffffff;

      let rect = null;
      let icon = null;

      // Create Phaser game objects if scene supports it
      if (this.scene && this.scene.add) {
        if (typeof this.scene.add.rectangle === 'function') {
          // Phaser rectangles are positioned by center
          const centerX = zoneX + zoneWidth / 2;
          const centerY = zoneY + zoneHeight / 2;
          rect = this.scene.add.rectangle(
            centerX,
            centerY,
            zoneWidth,
            zoneHeight,
            color,
            IDLE_ALPHA
          );
          rect.setOrigin(0.5, 0.5);
          if (typeof rect.setInteractive === 'function') {
            rect.setInteractive();
          }
          if (typeof rect.setDepth === 'function') {
            rect.setDepth(1000);
          }
        }

        if (typeof this.scene.add.graphics === 'function') {
          icon = this.scene.add.graphics();
          this._drawArrowIcon(icon, zoneX + zoneWidth / 2, zoneY + zoneHeight / 2, i);
          if (typeof icon.setDepth === 'function') {
            icon.setDepth(1001);
          }
        }
      }

      this.zones.push({
        direction: i,
        x: zoneX,
        y: zoneY,
        width: zoneWidth,
        height: zoneHeight,
        pressed: false,
        pointerId: null,
        rect,
        icon
      });
    }

    // Register pointer events on the scene input
    this._setupPointerEvents();
    this.visible = true;
  }

  /**
   * Draw an arrow icon on a Graphics object.
   * @param {Object} graphics - Phaser.GameObjects.Graphics
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} direction - Direction index (0-3)
   * @private
   */
  _drawArrowIcon(graphics, cx, cy, direction) {
    const size = 32;
    const half = size / 2;
    const angle = DIRECTION_ANGLES[direction];

    // Triangle pointing right by default, then rotated
    const points = [
      { x: half, y: 0 },
      { x: -half, y: -half },
      { x: -half, y: half }
    ];

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotated = points.map((p) => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos
    }));

    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillTriangle(
      rotated[0].x,
      rotated[0].y,
      rotated[1].x,
      rotated[1].y,
      rotated[2].x,
      rotated[2].y
    );
  }

  /**
   * Set up Phaser pointer event listeners for multi-touch.
   * @private
   */
  _setupPointerEvents() {
    if (!this.scene || !this.scene.input) {
      return;
    }

    this._boundHandlers = {
      down: this.onPointerDown.bind(this),
      up: this.onPointerUp.bind(this),
      move: this.onPointerMove.bind(this)
    };

    this.scene.input.on('pointerdown', this._boundHandlers.down);
    this.scene.input.on('pointerup', this._boundHandlers.up);
    this.scene.input.on('pointermove', this._boundHandlers.move);
  }

  /**
   * Map a pointer X position to a zone index.
   * Returns -1 if the pointer is outside all zones.
   *
   * @param {number} x - Pointer X coordinate
   * @param {number} y - Pointer Y coordinate
   * @returns {number} Zone index (0-3) or -1
   */
  _getZoneAtPosition(x, y) {
    for (let i = 0; i < this.zones.length; i++) {
      const zone = this.zones[i];
      if (x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Handle pointer down events. Maps pointer position to a zone and pushes
   * a press event to the input queue.
   *
   * @param {Object} pointer - Phaser pointer object with x, y, id properties
   */
  onPointerDown(pointer) {
    if (!this.visible || !this.inputQueue) {
      return;
    }

    const zoneIndex = this._getZoneAtPosition(pointer.x, pointer.y);
    if (zoneIndex === -1) {
      return;
    }

    const zone = this.zones[zoneIndex];

    // If this zone is already pressed by another pointer, ignore
    if (zone.pressed) {
      return;
    }

    zone.pressed = true;
    zone.pointerId = pointer.id ?? pointer.pointerId ?? null;

    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.inputQueue.pressQueue.push({
      direction: zone.direction,
      timestamp
    });
  }

  /**
   * Handle pointer up events. Pushes a release event for the zone
   * associated with this pointer.
   *
   * @param {Object} pointer - Phaser pointer object with x, y, id properties
   */
  onPointerUp(pointer) {
    if (!this.visible || !this.inputQueue) {
      return;
    }

    const pointerId = pointer.id ?? pointer.pointerId ?? null;

    // Find the zone held by this pointer
    for (const zone of this.zones) {
      if (zone.pressed && zone.pointerId === pointerId) {
        zone.pressed = false;
        zone.pointerId = null;

        const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.inputQueue.releaseQueue.push({
          direction: zone.direction,
          timestamp
        });
      }
    }
  }

  /**
   * Handle pointer move events for drag between zones.
   * If a pointer drags from one zone to another, release the old zone
   * and press the new one.
   *
   * @param {Object} pointer - Phaser pointer object with x, y, id, isDown properties
   */
  onPointerMove(pointer) {
    if (!this.visible || !this.inputQueue) {
      return;
    }
    if (!pointer.isDown) {
      return;
    }

    const pointerId = pointer.id ?? pointer.pointerId ?? null;
    const newZoneIndex = this._getZoneAtPosition(pointer.x, pointer.y);

    // Find the zone currently held by this pointer
    let currentZoneIndex = -1;
    for (let i = 0; i < this.zones.length; i++) {
      if (this.zones[i].pressed && this.zones[i].pointerId === pointerId) {
        currentZoneIndex = i;
        break;
      }
    }

    // If pointer moved to a different zone (or out of all zones)
    if (currentZoneIndex !== -1 && currentZoneIndex !== newZoneIndex) {
      // Release old zone
      const oldZone = this.zones[currentZoneIndex];
      oldZone.pressed = false;
      oldZone.pointerId = null;

      const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.inputQueue.releaseQueue.push({
        direction: oldZone.direction,
        timestamp
      });

      // Press new zone if valid and not already pressed
      if (newZoneIndex !== -1) {
        const newZone = this.zones[newZoneIndex];
        if (!newZone.pressed) {
          newZone.pressed = true;
          newZone.pointerId = pointerId;

          this.inputQueue.pressQueue.push({
            direction: newZone.direction,
            timestamp
          });
        }
      }
    }

    // If pointer was not on any zone but now is on one
    if (currentZoneIndex === -1 && newZoneIndex !== -1) {
      const newZone = this.zones[newZoneIndex];
      if (!newZone.pressed) {
        newZone.pressed = true;
        newZone.pointerId = pointerId;

        const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.inputQueue.pressQueue.push({
          direction: newZone.direction,
          timestamp
        });
      }
    }
  }

  /**
   * Show the touch zones (make visible and interactive).
   */
  show() {
    this.visible = true;
    for (const zone of this.zones) {
      if (zone.rect && typeof zone.rect.setVisible === 'function') {
        zone.rect.setVisible(true);
      }
      if (zone.icon && typeof zone.icon.setVisible === 'function') {
        zone.icon.setVisible(true);
      }
    }
  }

  /**
   * Hide the touch zones (make invisible and non-interactive).
   */
  hide() {
    this.visible = false;
    // Release any pressed zones
    for (const zone of this.zones) {
      if (zone.pressed) {
        zone.pressed = false;
        zone.pointerId = null;
      }
      if (zone.rect && typeof zone.rect.setVisible === 'function') {
        zone.rect.setVisible(false);
      }
      if (zone.icon && typeof zone.icon.setVisible === 'function') {
        zone.icon.setVisible(false);
      }
    }
  }

  /**
   * Update visual feedback for pressed/released zones.
   * Changes opacity on press and restores on release.
   */
  update() {
    for (const zone of this.zones) {
      if (!zone.rect) {
        continue;
      }

      const targetAlpha = zone.pressed ? PRESSED_ALPHA : IDLE_ALPHA;
      if (typeof zone.rect.setAlpha === 'function') {
        zone.rect.setAlpha(targetAlpha);
      }
    }
  }

  /**
   * Destroy all game objects and clean up event listeners.
   */
  destroy() {
    // Remove pointer event listeners
    if (this.scene && this.scene.input && this._boundHandlers) {
      this.scene.input.off('pointerdown', this._boundHandlers.down);
      this.scene.input.off('pointerup', this._boundHandlers.up);
      this.scene.input.off('pointermove', this._boundHandlers.move);
    }

    // Destroy game objects
    for (const zone of this.zones) {
      if (zone.rect && typeof zone.rect.destroy === 'function') {
        zone.rect.destroy();
      }
      if (zone.icon && typeof zone.icon.destroy === 'function') {
        zone.icon.destroy();
      }
      zone.rect = null;
      zone.icon = null;
    }

    this.zones = [];
    this._boundHandlers = null;
    this.scene = null;
    this.inputQueue = null;
    this.visible = false;
  }
}

export default TouchInputController;

/**
 * @fileoverview Portrait layout constants and coordinate helpers for the mobile portrait mode.
 * Pure-data module — no class instantiation needed.
 *
 * Base resolution: 720×1280 (9:16 aspect ratio).
 * All values are in logical pixels at the base resolution.
 */

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

/** @type {number} Base portrait canvas width */
export const PORTRAIT_WIDTH = 720;

/** @type {number} Base portrait canvas height */
export const PORTRAIT_HEIGHT = 1280;

/** @type {number} Portrait aspect ratio (width / height) */
export const ASPECT_RATIO = 9 / 16;

// ---------------------------------------------------------------------------
// Strumline
// ---------------------------------------------------------------------------

/** @type {number} Width of a single strumline lane (matches Strumline NOTE_SPACING) */
export const STRUMLINE_LANE_WIDTH = 112;

/**
 * X position of the player strumline.
 * Centers 4 lanes (4 × 112 = 448 px) within the 720 px canvas:
 * (720 − 448) / 2 = 136
 * @type {number}
 */
export const PLAYER_STRUMLINE_X = 136;

/** @type {number} Y position of the player strumline receptor row */
export const PLAYER_STRUMLINE_Y = 900;

// ---------------------------------------------------------------------------
// Touch zones
// ---------------------------------------------------------------------------

/** @type {number} Height of the bottom touch input area */
export const TOUCH_ZONE_HEIGHT = 160;

/** @type {number} Y position of the touch zone (bottom of canvas minus zone height) */
export const TOUCH_ZONE_Y = 1120;

/** @type {number} Width of each individual touch zone (canvas width / 4) */
export const TOUCH_ZONE_WIDTH = 180;

// ---------------------------------------------------------------------------
// HUD positioning
// ---------------------------------------------------------------------------

/** @type {number} Y position of the health bar (near top of canvas) */
export const HEALTH_BAR_Y = 80;

/** @type {number} Width of the health bar */
export const HEALTH_BAR_WIDTH = 640;

/** @type {number} X position (left edge) of the health bar */
export const HEALTH_BAR_X = 40;

/** @type {number} Y position of the score display (below health bar) */
export const SCORE_DISPLAY_Y = 120;

/** @type {number} X position of the combo popup (centered horizontally on the canvas) */
export const COMBO_POPUP_X = PORTRAIT_WIDTH / 2;

/** @type {number} Y position of the combo popup (between HUD and strumline) */
export const COMBO_POPUP_Y = 500;

// ---------------------------------------------------------------------------
// Opponent indicator
// ---------------------------------------------------------------------------

/** @type {number} X position of the opponent indicator */
export const OPPONENT_INDICATOR_X = 16;

/** @type {number} Y position of the opponent indicator */
export const OPPONENT_INDICATOR_Y = 16;

/** @type {number} Size of each opponent arrow icon (px) */
export const OPPONENT_ARROW_SIZE = 28;

/** @type {number} Duration of the opponent arrow flash highlight (ms) */
export const OPPONENT_FLASH_DURATION = 150;

// ---------------------------------------------------------------------------
// Camera / Stage
// ---------------------------------------------------------------------------

/** @type {number} Default camera zoom for portrait framing */
export const DEFAULT_PORTRAIT_ZOOM = 1.4;

/** @type {[number, number]} Visible Y range for the player character between HUD and strumline */
export const PLAYER_CHAR_Y_RANGE = [300, 700];

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

/** @type {number} FPS threshold below which effects are reduced */
export const LOW_FPS_THRESHOLD = 30;

/** @type {number} Rolling sample window for FPS averaging (ms) */
export const FPS_SAMPLE_WINDOW = 1000;

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Compute the strumline X position that centers a given number of lanes
 * within a given canvas width.
 *
 * @param {number} canvasWidth  - Width of the canvas in logical pixels
 * @param {number} laneCount    - Number of lanes (default 4)
 * @param {number} laneWidth    - Width of each lane (default STRUMLINE_LANE_WIDTH)
 * @returns {number} The X offset that centers the strumline
 */
export function computeStrumlineX(canvasWidth, laneCount = 4, laneWidth = STRUMLINE_LANE_WIDTH) {
  const totalWidth = laneCount * laneWidth;
  return (canvasWidth - totalWidth) / 2;
}

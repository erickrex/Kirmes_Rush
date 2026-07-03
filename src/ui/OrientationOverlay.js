/**
 * @fileoverview OrientationOverlay - DOM-based orientation prompt that persists across Phaser scenes.
 * Shown when a touch device is in landscape orientation.
 * Uses plain DOM elements so it is independent of any single Phaser scene lifecycle.
 *
 * Usage:
 *   OrientationOverlay.init()   — call once at boot
 *   OrientationOverlay.destroy() — call on game teardown (optional)
 */

/**
 * App-level orientation overlay using DOM elements.
 * Survives Phaser scene transitions because it lives in the DOM, not in a scene.
 */
import TouchDeviceDetector from '../input/TouchDeviceDetector.js';

class OrientationOverlay {
  /** @type {HTMLDivElement | null} */
  static _container = null;

  /** @type {boolean} */
  static _visible = false;

  /** @type {(() => void) | null} */
  static _resizeHandler = null;

  /** @type {(() => void) | null} */
  static _orientationHandler = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  static _dismissTimer = null;

  /** @type {(() => void) | null} */
  static _unsubscribeTouchState = null;

  /**
   * Initialize the overlay. Safe to call multiple times — only creates once.
   */
  static init() {
    if (OrientationOverlay._container) {
      OrientationOverlay._check();
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    const el = document.createElement('div');
    el.id = 'orientation-overlay';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      background: 'rgba(0,0,0,0.92)',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
      gap: '16px'
    });
    el.innerHTML =
      '<div style="font-size:64px">📱↻</div>' +
      '<div style="font-size:22px;max-width:280px">Please rotate your device<br>to portrait mode</div>';

    document.body.appendChild(el);
    OrientationOverlay._container = el;

    OrientationOverlay._resizeHandler = () => OrientationOverlay._check();
    OrientationOverlay._orientationHandler = () => OrientationOverlay._check();
    OrientationOverlay._unsubscribeTouchState = TouchDeviceDetector.subscribe(() =>
      OrientationOverlay._check()
    );

    window.addEventListener('resize', OrientationOverlay._resizeHandler);
    if (OrientationOverlay._hasOrientationAPI()) {
      screen.orientation.addEventListener('change', OrientationOverlay._orientationHandler);
    }

    OrientationOverlay._check();
  }

  /** @private */
  static _check() {
    const shouldShow = TouchDeviceDetector.isTouch() && OrientationOverlay._isLandscape();
    if (shouldShow && !OrientationOverlay._visible) {
      OrientationOverlay._show();
    } else if (!shouldShow && OrientationOverlay._visible) {
      OrientationOverlay._dismiss();
    } else if (!shouldShow) {
      OrientationOverlay._hideImmediately();
    }
  }

  /** @private */
  static _show() {
    if (OrientationOverlay._dismissTimer !== null) {
      clearTimeout(OrientationOverlay._dismissTimer);
      OrientationOverlay._dismissTimer = null;
    }
    OrientationOverlay._visible = true;
    if (OrientationOverlay._container) {
      OrientationOverlay._container.style.display = 'flex';
    }
  }

  /** @private */
  static _dismiss() {
    if (OrientationOverlay._dismissTimer !== null) {
      return;
    }
    OrientationOverlay._dismissTimer = setTimeout(() => {
      OrientationOverlay._hideImmediately();
      OrientationOverlay._dismissTimer = null;
    }, 500);
  }

  /** @private */
  static _isLandscape() {
    if (OrientationOverlay._hasOrientationAPI()) {
      return screen.orientation.type.startsWith('landscape');
    }
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return false;
  }

  /** @private */
  static _hasOrientationAPI() {
    return (
      typeof screen !== 'undefined' &&
      screen.orientation !== null &&
      typeof screen.orientation.type === 'string'
    );
  }

  /**
   * Remove the overlay and all listeners. Call on game teardown.
   */
  static destroy() {
    if (OrientationOverlay._dismissTimer !== null) {
      clearTimeout(OrientationOverlay._dismissTimer);
      OrientationOverlay._dismissTimer = null;
    }
    if (typeof window !== 'undefined' && OrientationOverlay._resizeHandler) {
      window.removeEventListener('resize', OrientationOverlay._resizeHandler);
    }
    if (OrientationOverlay._hasOrientationAPI() && OrientationOverlay._orientationHandler) {
      screen.orientation.removeEventListener('change', OrientationOverlay._orientationHandler);
    }
    if (OrientationOverlay._container && OrientationOverlay._container.parentNode) {
      OrientationOverlay._container.parentNode.removeChild(OrientationOverlay._container);
    }
    if (OrientationOverlay._unsubscribeTouchState) {
      OrientationOverlay._unsubscribeTouchState();
      OrientationOverlay._unsubscribeTouchState = null;
    }
    OrientationOverlay._container = null;
    OrientationOverlay._visible = false;
    OrientationOverlay._resizeHandler = null;
    OrientationOverlay._orientationHandler = null;
  }

  /**
   * Hide the overlay immediately without animation delay.
   * @private
   */
  static _hideImmediately() {
    OrientationOverlay._visible = false;
    if (OrientationOverlay._container) {
      OrientationOverlay._container.style.display = 'none';
    }
  }
}

export default OrientationOverlay;

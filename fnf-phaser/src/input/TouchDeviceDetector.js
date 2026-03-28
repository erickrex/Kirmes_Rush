/**
 * @fileoverview TouchDeviceDetector - Detects touch capability for the current device.
 * Singleton evaluated once at boot and re-evaluated on first touch/pointer event.
 *
 * Used solely to determine whether to show or hide touch controls.
 */

/**
 * Detects whether the current device supports touch input.
 * Call `detect()` once at boot (e.g. in BootScene.create()), then query
 * with `isTouch()` wherever touch-dependent behaviour is needed.
 *
 * Hybrid devices (laptops with touchscreens) are handled by `onFirstTouch()`,
 * which upgrades the detection result when a real touch/pointer event arrives.
 */
class TouchDeviceDetector {
  /**
   * Current touch capability state.
   * @type {boolean}
   */
  static isTouchDevice = false;

  /**
   * Whether `detect()` has been called at least once.
   * @type {boolean}
   */
  static evaluated = false;

  /**
   * Whether `onFirstTouch()` has already fired and upgraded the state.
   * @type {boolean}
   */
  static _touchUpgraded = false;

  /**
   * Subscribers notified whenever touch capability changes.
   * @type {Set<(isTouchDevice: boolean) => void>}
   */
  static _subscribers = new Set();

  /**
   * Perform initial touch capability detection using browser APIs.
   *
   * Checks (in order):
   * 1. `'ontouchstart' in window`
   * 2. `navigator.maxTouchPoints > 0` (with fallback if unavailable)
   *
   * Also registers a one-time listener so that hybrid devices are
   * correctly detected on the first real touch event via `onFirstTouch()`.
   */
  static detect() {
    TouchDeviceDetector.evaluated = true;

    const hasOntouchstart = typeof window !== 'undefined' && 'ontouchstart' in window;

    let hasTouchPoints = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.maxTouchPoints !== undefined) {
        hasTouchPoints = navigator.maxTouchPoints > 0;
      }
    } catch {
      // navigator.maxTouchPoints unavailable — ignore
    }

    TouchDeviceDetector.isTouchDevice = hasOntouchstart || hasTouchPoints;
    TouchDeviceDetector._notifySubscribers();

    // Register one-time listener for hybrid device upgrade
    if (!TouchDeviceDetector.isTouchDevice && typeof window !== 'undefined') {
      window.addEventListener('touchstart', TouchDeviceDetector.onFirstTouch, {
        once: true
      });
      window.addEventListener('pointerdown', TouchDeviceDetector._onFirstPointerDown, {
        once: true
      });
    }
  }

  /**
   * Upgrade `isTouchDevice` to `true` on the first real touch or pointer event.
   * Intended to be wired as a one-time event listener so that hybrid devices
   * (e.g. laptops with touchscreens) are detected even when the initial
   * heuristic returns `false`.
   */
  static onFirstTouch() {
    if (TouchDeviceDetector._touchUpgraded) {
      return;
    }
    TouchDeviceDetector._touchUpgraded = true;
    TouchDeviceDetector.isTouchDevice = true;
    TouchDeviceDetector._notifySubscribers();

    // Clean up the other listener since we only need one to fire
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', TouchDeviceDetector._onFirstPointerDown);
    }
  }

  /**
   * Pointer-event variant of `onFirstTouch()`. Upgrades only for touch/pen
   * pointer types, ignoring mouse clicks.
   * @param {PointerEvent} event
   */
  static _onFirstPointerDown(event) {
    if (event && (event.pointerType === 'touch' || event.pointerType === 'pen')) {
      TouchDeviceDetector.onFirstTouch();
    }
  }

  /**
   * Subscribe to touch-state changes.
   * Listener is called immediately with the current state and again whenever it changes.
   *
   * @param {(isTouchDevice: boolean) => void} listener
   * @returns {() => void}
   */
  static subscribe(listener) {
    TouchDeviceDetector._subscribers.add(listener);
    listener(TouchDeviceDetector.isTouchDevice);

    return () => {
      TouchDeviceDetector._subscribers.delete(listener);
    };
  }

  /**
   * Returns the current touch capability state.
   * @returns {boolean} `true` if the device supports touch input.
   */
  static isTouch() {
    return TouchDeviceDetector.isTouchDevice;
  }

  /**
   * Reset internal state. Useful for testing.
   */
  static reset() {
    TouchDeviceDetector.isTouchDevice = false;
    TouchDeviceDetector.evaluated = false;
    TouchDeviceDetector._touchUpgraded = false;

    // Clean up any pending browser listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('touchstart', TouchDeviceDetector.onFirstTouch);
      window.removeEventListener('pointerdown', TouchDeviceDetector._onFirstPointerDown);
    }

    TouchDeviceDetector._notifySubscribers();
  }

  /**
   * Notify all touch-state subscribers.
   * @private
   */
  static _notifySubscribers() {
    for (const listener of TouchDeviceDetector._subscribers) {
      listener(TouchDeviceDetector.isTouchDevice);
    }
  }
}

export default TouchDeviceDetector;

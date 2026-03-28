/**
 * @fileoverview Unit tests for the DOM-based OrientationOverlay.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrientationOverlay from '../src/ui/OrientationOverlay.js';
import TouchDeviceDetector from '../src/input/TouchDeviceDetector.js';

/**
 * Replace the current screen.orientation object with a controlled test double.
 * @param {string} type
 */
function mockOrientation(type) {
  Object.defineProperty(globalThis.screen, 'orientation', {
    configurable: true,
    value: {
      type,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

describe('OrientationOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TouchDeviceDetector.reset();
    mockOrientation('landscape-primary');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 720,
    });
  });

  afterEach(() => {
    OrientationOverlay.destroy();
    TouchDeviceDetector.reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('initializes once and stays hidden until touch is detected', () => {
    OrientationOverlay.init();

    const overlay = document.getElementById('orientation-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe('none');

    TouchDeviceDetector.onFirstTouch();

    expect(overlay?.style.display).toBe('flex');
  });

  it('remains hidden in portrait even after a hybrid first-touch upgrade', () => {
    mockOrientation('portrait-primary');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1280,
    });

    OrientationOverlay.init();
    TouchDeviceDetector.onFirstTouch();

    const overlay = document.getElementById('orientation-overlay');
    expect(overlay?.style.display).toBe('none');
  });

  it('dismisses after returning to portrait and cleans up DOM/listeners on destroy', () => {
    OrientationOverlay.init();
    TouchDeviceDetector.onFirstTouch();

    const overlay = document.getElementById('orientation-overlay');
    expect(overlay?.style.display).toBe('flex');

    globalThis.screen.orientation.type = 'portrait-primary';
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1280,
    });

    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(500);

    expect(overlay?.style.display).toBe('none');

    const removeOrientationListener = globalThis.screen.orientation.removeEventListener;
    OrientationOverlay.destroy();

    expect(removeOrientationListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(document.getElementById('orientation-overlay')).toBeNull();
  });
});

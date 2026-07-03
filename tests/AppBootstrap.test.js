/**
 * @fileoverview Unit tests for the App Bootstrap sequence in main.js
 * Validates: Requirements 6.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Phaser mock ──────────────────────────────────────────────────────────────
// main.js creates a Phaser.Game at module scope, so we must mock Phaser before
// the dynamic import. The mock captures the config passed to the constructor
// and exposes a fake `events` emitter so we can simulate the DESTROY event.

let capturedConfig = null;
let gameEventsOnce = vi.fn();

vi.mock('phaser', () => {
  const DESTROY = 'destroy';

  class MockGame {
    constructor(cfg) {
      capturedConfig = cfg;
      this.events = { once: gameEventsOnce };
    }
  }

  return {
    default: {
      AUTO: 'AUTO',
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
      Core: { Events: { DESTROY } },
      Game: MockGame
    }
  };
});

// ── Service mocks ────────────────────────────────────────────────────────────
const mockInit = vi.fn();
vi.mock('../src/data/SaveManager.js', () => ({
  default: { getInstance: () => ({ init: mockInit }) }
}));

const mockDetect = vi.fn();
vi.mock('../src/input/TouchDeviceDetector.js', () => ({
  default: { detect: mockDetect }
}));

const mockOverlayInit = vi.fn();
const mockOverlayDestroy = vi.fn();
vi.mock('../src/ui/OrientationOverlay.js', () => ({
  default: { init: mockOverlayInit, destroy: mockOverlayDestroy }
}));

// ── Scene stubs (prevent real scene code from executing) ─────────────────────
vi.mock('../src/ui/TitleState.js', () => ({ default: class TitleState {} }));
vi.mock('../src/ui/MainMenuState.js', () => ({ default: class MainMenuState {} }));
vi.mock('../src/ui/StoryMenuState.js', () => ({ default: class StoryMenuState {} }));
vi.mock('../src/ui/FreeplayState.js', () => ({ default: class FreeplayState {} }));
vi.mock('../src/ui/LevelSelectState.js', () => ({ default: class LevelSelectState {} }));
vi.mock('../src/ui/OptionsState.js', () => ({ default: class OptionsState {} }));
vi.mock('../src/scenes/PlayScene.js', () => ({ default: class PlayScene {} }));
vi.mock('../src/ui/PauseSubState.js', () => ({ default: class PauseSubState {} }));
vi.mock('../src/ui/GameOverState.js', () => ({ default: class GameOverState {} }));
vi.mock('../src/ui/ResultState.js', () => ({ default: class ResultState {} }));
vi.mock('../src/ui/LoadingState.js', () => ({ default: class LoadingState {} }));
vi.mock('../src/ui/ReplayBrowserState.js', () => ({ default: class ReplayBrowserState {} }));

describe('AppBootstrap (main.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedConfig = null;
    gameEventsOnce = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper: dynamically import main.js so the module-level side effects
   * re-execute with fresh mocks each time.
   */
  async function bootstrap() {
    // resetModules ensures the module-scope code in main.js runs again
    vi.resetModules();

    // Re-apply mocks after resetModules (vi.mock hoisting keeps them)
    const mod = await import('../src/main.js');
    return mod;
  }

  it('should call SaveManager.init exactly once during bootstrap', async () => {
    await bootstrap();
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('should call TouchDeviceDetector.detect exactly once during bootstrap', async () => {
    await bootstrap();
    expect(mockDetect).toHaveBeenCalledTimes(1);
  });

  it('should call OrientationOverlay.init exactly once during bootstrap', async () => {
    await bootstrap();
    expect(mockOverlayInit).toHaveBeenCalledTimes(1);
  });

  it('should call OrientationOverlay.destroy on game DESTROY event', async () => {
    await bootstrap();

    // gameEventsOnce should have been called with the DESTROY event
    expect(gameEventsOnce).toHaveBeenCalledWith('destroy', expect.any(Function));

    // Extract and invoke the DESTROY callback
    const destroyCall = gameEventsOnce.mock.calls.find((call) => call[0] === 'destroy');
    expect(destroyCall).toBeDefined();

    const destroyCallback = destroyCall[1];
    destroyCallback();

    expect(mockOverlayDestroy).toHaveBeenCalledTimes(1);
  });

  it('should not include BootScene in the scene list', async () => {
    await bootstrap();
    expect(capturedConfig).not.toBeNull();

    const sceneNames = capturedConfig.scene.map((S) => S.name);
    expect(sceneNames).not.toContain('BootScene');
  });

  it('should have TitleState as the first scene', async () => {
    await bootstrap();
    expect(capturedConfig).not.toBeNull();
    expect(capturedConfig.scene[0].name).toBe('TitleState');
  });
});

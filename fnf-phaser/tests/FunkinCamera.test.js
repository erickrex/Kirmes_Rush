/**
 * @fileoverview Tests for FunkinCamera class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Phaser camera
class MockCamera {
  constructor() {
    this.scrollX = 0;
    this.scrollY = 0;
    this.width = 1280;
    this.height = 720;
    this.zoom = 1.0;
  }

  centerOn(x, y) {
    this.scrollX = x - this.width / 2;
    this.scrollY = y - this.height / 2;
  }

  setZoom(zoom) {
    this.zoom = zoom;
    return this;
  }

  shake(duration, intensity) {
    this._shakeParams = { duration, intensity };
  }

  flash(duration, r, g, b) {
    this._flashParams = { duration, r, g, b };
  }

  fadeIn(duration, r, g, b, callback) {
    this._fadeInParams = { duration, r, g, b };
    if (callback) callback();
  }

  fadeOut(duration, r, g, b, callback) {
    this._fadeOutParams = { duration, r, g, b };
    if (callback) callback();
  }

  setBounds(x, y, width, height) {
    this._bounds = { x, y, width, height };
  }

  removeBounds() {
    this._bounds = null;
  }
}

// Import after setting up mocks
const { default: FunkinCamera } = await import('../src/graphics/FunkinCamera.js');

describe('FunkinCamera', () => {
  let mockScene;
  let mockCamera;

  beforeEach(() => {
    mockCamera = new MockCamera();
    mockScene = {
      cameras: {
        main: mockCamera
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create with scene and default camera', () => {
      const cam = new FunkinCamera(mockScene);

      expect(cam.scene).toBe(mockScene);
      expect(cam.camera).toBe(mockCamera);
    });

    it('should create with custom camera', () => {
      const customCamera = new MockCamera();
      const cam = new FunkinCamera(mockScene, customCamera);

      expect(cam.camera).toBe(customCamera);
    });

    it('should initialize zoom from camera', () => {
      mockCamera.zoom = 0.9;
      const cam = new FunkinCamera(mockScene);

      expect(cam.defaultZoom).toBe(0.9);
      expect(cam.currentZoom).toBe(0.9);
      expect(cam.targetZoom).toBe(0.9);
    });

    it('should handle null scene', () => {
      const cam = new FunkinCamera(null);

      expect(cam.scene).toBeNull();
      expect(cam.camera).toBeNull();
    });
  });

  describe('follow system', () => {
    it('should set follow target', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setFollowTarget(500, 300);

      expect(cam.followTarget).toEqual({ x: 500, y: 300 });
      expect(cam.isFollowing).toBe(true);
    });

    it('should snap to target instantly', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setFollowTarget(500, 300, true);

      expect(mockCamera.scrollX).toBe(500 - 640);
      expect(mockCamera.scrollY).toBe(300 - 360);
    });

    it('should follow object', () => {
      const cam = new FunkinCamera(mockScene);
      const target = { x: 100, y: 200, width: 50, height: 50 };

      cam.followObject(target);

      expect(cam.followTarget.x).toBe(125); // 100 + 50/2
      expect(cam.followTarget.y).toBe(225); // 200 + 50/2
    });

    it('should stop following', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setFollowTarget(500, 300);
      cam.stopFollowing();

      expect(cam.isFollowing).toBe(false);
      expect(cam.followTarget).toBeNull();
    });

    it('should set follow rate', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setFollowRate(0.1);

      expect(cam.followRate).toBe(0.1);
    });

    it('should clamp follow rate', () => {
      const cam = new FunkinCamera(mockScene);

      cam.setFollowRate(-0.5);
      expect(cam.followRate).toBe(0);

      cam.setFollowRate(1.5);
      expect(cam.followRate).toBe(1);
    });
  });

  describe('zoom system', () => {
    it('should set default zoom', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(0.8);

      expect(cam.defaultZoom).toBe(0.8);
      expect(cam.targetZoom).toBe(0.8);
    });

    it('should set zoom with lerp', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setZoom(1.5);

      expect(cam.targetZoom).toBe(1.5);
      expect(cam.currentZoom).toBe(1.0); // Not changed yet
    });

    it('should set zoom instantly', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setZoom(1.5, true);

      expect(cam.targetZoom).toBe(1.5);
      expect(cam.currentZoom).toBe(1.5);
      expect(mockCamera.zoom).toBe(1.5);
    });

    it('should reset zoom to default', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(0.9);
      cam.setZoom(1.5, true);
      cam.resetZoom(true);

      expect(cam.currentZoom).toBe(0.9);
      expect(mockCamera.zoom).toBe(0.9);
    });

    it('should bump zoom', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(1.0);
      cam.bopIntensity = 1.02;
      cam.bumpZoom();

      expect(cam.currentZoom).toBe(1.02);
      expect(mockCamera.zoom).toBe(1.02);
    });

    it('should bump zoom with custom intensity', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(1.0);
      cam.bumpZoom(1.05);

      expect(cam.currentZoom).toBe(1.05);
    });
  });

  describe('beat sync', () => {
    it('should configure beat zoom', () => {
      const cam = new FunkinCamera(mockScene);
      cam.configureBeatZoom(1.03, 2, 1);

      expect(cam.bopIntensity).toBe(1.03);
      expect(cam.bopRate).toBe(2);
      expect(cam.bopOffset).toBe(1);
    });

    it('should enable/disable beat zoom', () => {
      const cam = new FunkinCamera(mockScene);

      cam.setBeatZoomEnabled(false);
      expect(cam.bopEnabled).toBe(false);

      cam.setBeatZoomEnabled(true);
      expect(cam.bopEnabled).toBe(true);
    });

    it('should trigger bop on beat', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(1.0);
      cam.bopRate = 4;
      cam.bopOffset = 0;
      cam.bopIntensity = 1.02;

      cam.onBeatHit(4);

      expect(cam.currentZoom).toBe(1.02);
    });

    it('should not trigger bop on off-beat', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(1.0);
      cam.bopRate = 4;
      cam.bopOffset = 0;

      cam.onBeatHit(3);

      expect(cam.currentZoom).toBe(1.0);
    });

    it('should respect beat offset', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(1.0);
      cam.bopRate = 4;
      cam.bopOffset = 2;
      cam.bopIntensity = 1.02;

      cam.onBeatHit(2); // 2 - 2 = 0, 0 % 4 = 0, should bop
      expect(cam.currentZoom).toBe(1.02);
    });

    it('should not bop when disabled', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setDefaultZoom(1.0);
      cam.bopRate = 4;
      cam.bopEnabled = false;

      cam.onBeatHit(4);

      expect(cam.currentZoom).toBe(1.0);
    });
  });

  describe('update', () => {
    it('should lerp camera position', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setFollowTarget(1000, 500);
      cam.followRate = 0.5;

      // Camera starts at center (640, 360) when scrollX/Y = 0
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      cam.update(16);

      // Current center is (640, 360), target is (1000, 500)
      // After lerp with 0.5: newX = 640 + (1000 - 640) * 0.5 = 820
      // scrollX = newX - width/2 = 820 - 640 = 180
      expect(mockCamera.scrollX).toBeCloseTo(180, 0);
    });

    it('should lerp zoom', () => {
      const cam = new FunkinCamera(mockScene);
      cam.currentZoom = 1.0;
      cam.targetZoom = 1.1;
      cam.zoomLerpRate = 0.5;

      cam.update(16);

      expect(cam.currentZoom).toBeCloseTo(1.05, 2);
    });

    it('should not update without camera', () => {
      const cam = new FunkinCamera(null);
      expect(() => cam.update(16)).not.toThrow();
    });
  });

  describe('camera effects', () => {
    it('should shake camera', () => {
      const cam = new FunkinCamera(mockScene);
      cam.shake(200, 0.02);

      expect(mockCamera._shakeParams).toEqual({ duration: 200, intensity: 0.02 });
    });

    it('should flash camera', () => {
      const cam = new FunkinCamera(mockScene);
      cam.flash(300, 0xff0000);

      expect(mockCamera._flashParams).toEqual({ duration: 300, r: 255, g: 0, b: 0 });
    });

    it('should fade out camera', () => {
      const cam = new FunkinCamera(mockScene);
      cam.fade(500, 0x000000, false);

      expect(mockCamera._fadeOutParams).toEqual({ duration: 500, r: 0, g: 0, b: 0 });
    });

    it('should fade in camera', () => {
      const cam = new FunkinCamera(mockScene);
      cam.fade(500, 0xffffff, true);

      expect(mockCamera._fadeInParams).toEqual({ duration: 500, r: 255, g: 255, b: 255 });
    });

    it('should call fade callback', () => {
      const cam = new FunkinCamera(mockScene);
      const callback = vi.fn();
      cam.fade(500, 0x000000, false, callback);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('bounds', () => {
    it('should set camera bounds', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setBounds(0, 0, 2000, 1500);

      expect(cam.bounds).toEqual({ x: 0, y: 0, width: 2000, height: 1500 });
      expect(mockCamera._bounds).toEqual({ x: 0, y: 0, width: 2000, height: 1500 });
    });

    it('should remove camera bounds', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setBounds(0, 0, 2000, 1500);
      cam.removeBounds();

      expect(cam.bounds).toBeNull();
      expect(mockCamera._bounds).toBeNull();
    });
  });

  describe('utility methods', () => {
    it('should get camera center', () => {
      const cam = new FunkinCamera(mockScene);
      mockCamera.scrollX = 100;
      mockCamera.scrollY = 50;

      const center = cam.getCenter();

      expect(center.x).toBe(740); // 100 + 1280/2
      expect(center.y).toBe(410); // 50 + 720/2
    });

    it('should get viewport', () => {
      const cam = new FunkinCamera(mockScene);
      mockCamera.scrollX = 100;
      mockCamera.scrollY = 50;

      const viewport = cam.getViewport();

      expect(viewport).toEqual({ x: 100, y: 50, width: 1280, height: 720 });
    });

    it('should check point visibility', () => {
      const cam = new FunkinCamera(mockScene);
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      expect(cam.isPointVisible(640, 360)).toBe(true);
      expect(cam.isPointVisible(-100, 360)).toBe(false);
      expect(cam.isPointVisible(1500, 360)).toBe(false);
    });

    it('should check point visibility with margin', () => {
      const cam = new FunkinCamera(mockScene);
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      expect(cam.isPointVisible(-50, 360, 100)).toBe(true);
      expect(cam.isPointVisible(-150, 360, 100)).toBe(false);
    });
  });

  describe('lerp helper', () => {
    it('should interpolate values', () => {
      const cam = new FunkinCamera(mockScene);

      expect(cam.lerp(0, 100, 0)).toBe(0);
      expect(cam.lerp(0, 100, 0.5)).toBe(50);
      expect(cam.lerp(0, 100, 1)).toBe(100);
    });
  });

  describe('destroy', () => {
    it('should clean up references', () => {
      const cam = new FunkinCamera(mockScene);
      cam.setFollowTarget(100, 100);
      cam.setBounds(0, 0, 1000, 1000);

      cam.destroy();

      expect(cam.camera).toBeNull();
      expect(cam.scene).toBeNull();
      expect(cam.followTarget).toBeNull();
      expect(cam.bounds).toBeNull();
    });
  });
});

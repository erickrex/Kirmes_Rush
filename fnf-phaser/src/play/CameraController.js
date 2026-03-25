/**
 * @fileoverview CameraController - Handles camera focus, zoom, and camera event handling.
 * Extracted from PlayState to provide a focused module for camera management.
 *
 * Registers EventBus listeners for FOCUS_CAMERA and ZOOM_CAMERA events.
 *
 * @module CameraController
 */

import FunkinCamera from '../graphics/FunkinCamera.js';
import { Events } from '../core/EventBus.js';

/**
 * @typedef {Object} CameraControllerContext
 * @property {Phaser.Scene} scene - Phaser scene reference
 * @property {Object} playState - PlayState instance (for characters, stage, feature flags)
 * @property {Object} conductor - Conductor instance
 * @property {Object} eventBus - EventBus static class
 * @property {Object} scoring - Scoring static class
 * @property {Object} gameplayState - GameplayState module instance
 */

/**
 * Create a CameraController module that manages camera focus and zoom.
 * @param {CameraControllerContext} context - Shared context object
 * @returns {Object} CameraController module instance
 */
export function createCameraController(context) {
  const { eventBus } = context;
  let destroyed = false;

  const controller = {
    /** @type {Phaser.Cameras.Scene2D.Camera|null} */
    camGame: null,

    /** @type {Phaser.Cameras.Scene2D.Camera|null} */
    camHUD: null,

    /** @type {FunkinCamera|null} */
    funkinCamera: null,

    /** @type {number} Current camera focus target (0=opponent, 1=player, 2=gf) */
    cameraFocusTarget: 0,

    /**
     * Set up game and HUD cameras, and create FunkinCamera if camera effects are enabled.
     */
    setupCameras() {
      const { scene, playState } = context;
      if (!scene?.cameras) {
        return;
      }

      controller.camGame = scene.cameras.main;

      // Create HUD camera
      controller.camHUD = scene.cameras.add(
        0,
        0,
        scene.scale?.width ?? 1280,
        scene.scale?.height ?? 720
      );
      controller.camHUD.setScroll(0, 0);

      // Create FunkinCamera controller only if camera effects are enabled
      const featureEnabled = playState.isFeatureEnabled
        ? playState.isFeatureEnabled('cameraEffects')
        : true;

      if (featureEnabled) {
        controller.funkinCamera = new FunkinCamera(scene, controller.camGame);
      }
    },

    /**
     * Focus the camera on a target character.
     * @param {number} target - Character index (0=opponent, 1=player, 2=gf)
     * @param {boolean} [instant=false] - Whether to snap instantly
     */
    focusCamera(target, instant = false) {
      controller.cameraFocusTarget = target;

      const character = controller.getCameraFocusCharacter(target);
      if (!character || !controller.funkinCamera) {
        return;
      }

      const focusPoint = character.getCameraFocusPoint();

      // Apply stage camera offset
      const { playState } = context;
      if (playState.stage) {
        const charType = target === 0 ? 'dad' : target === 1 ? 'bf' : 'gf';
        const stageOffset = playState.stage.getCameraOffset(charType);
        focusPoint.x += stageOffset.x;
        focusPoint.y += stageOffset.y;
      }

      controller.funkinCamera.setFollowTarget(focusPoint.x, focusPoint.y, instant);
    },

    /**
     * Get the character object for a given camera target index.
     * @param {number} target - Character index (0=opponent, 1=player, 2=gf)
     * @returns {Object|null} The character, or null
     */
    getCameraFocusCharacter(target) {
      const { playState } = context;
      switch (target) {
        case 0:
          return playState.opponent;
        case 1:
          return playState.player;
        case 2:
          return playState.girlfriend;
        default:
          return playState.opponent;
      }
    },

    /**
     * Handle a FOCUS_CAMERA event from EventBus.
     * @param {Object} eventData - Event payload with char index
     */
    handleFocusCameraEvent(eventData) {
      const charIndex = eventData?.char ?? eventData?.value?.char ?? 0;
      controller.focusCamera(charIndex);
    },

    /**
     * Handle a ZOOM_CAMERA event from EventBus.
     * @param {Object} eventData - Event payload with zoom and instant
     */
    handleZoomCameraEvent(eventData) {
      if (!controller.funkinCamera) {
        return;
      }

      const zoom = eventData?.zoom ?? eventData?.value?.zoom ?? 1.0;
      const instant = eventData?.instant ?? eventData?.value?.instant ?? false;

      controller.funkinCamera.setZoom(zoom, instant);
    },

    /**
     * Clean up EventBus listeners and camera resources.
     * Idempotent — subsequent calls are no-ops.
     */
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;

      eventBus.off(Events.FOCUS_CAMERA, controller.handleFocusCameraEvent);
      eventBus.off(Events.ZOOM_CAMERA, controller.handleZoomCameraEvent);

      if (controller.funkinCamera) {
        controller.funkinCamera.destroy();
        controller.funkinCamera = null;
      }

      controller.camGame = null;
      controller.camHUD = null;
    }
  };

  // Register EventBus listeners for camera events
  eventBus.on(Events.FOCUS_CAMERA, controller.handleFocusCameraEvent);
  eventBus.on(Events.ZOOM_CAMERA, controller.handleZoomCameraEvent);

  return controller;
}

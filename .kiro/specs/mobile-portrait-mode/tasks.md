# Implementation Plan: Mobile Portrait Mode

## Overview

Convert the Friday Night Funkin' Phaser.js game from 1280x720 landscape to a universal 720x1280 portrait (9:16) layout. Implementation follows dependency order: foundation modules first (LayoutManager, TouchDeviceDetector), then game config changes, then dependent components (OpponentIndicator, TouchInputController, PlayState, HUD, Stage/Camera, menus, OrientationPrompt, PerformanceMonitor). All code is plain JavaScript with JSDoc, tested with Vitest and fast-check.

## Tasks

- [x] 1. Create LayoutManager foundation module
  - [x] 1.1 Create `fnf-phaser/src/layout/LayoutManager.js` with portrait layout constants and coordinate helpers
    - Export `PORTRAIT_WIDTH = 720`, `PORTRAIT_HEIGHT = 1280`, `ASPECT_RATIO = 9/16`
    - Export strumline positioning: `PLAYER_STRUMLINE_X`, `PLAYER_STRUMLINE_Y`, `TOUCH_ZONE_HEIGHT`, `TOUCH_ZONE_Y`
    - Export HUD positioning: `HEALTH_BAR_Y`, `HEALTH_BAR_WIDTH`, `HEALTH_BAR_X`, `SCORE_DISPLAY_Y`, `COMBO_POPUP_Y`
    - Export opponent indicator: `OPPONENT_INDICATOR_X`, `OPPONENT_INDICATOR_Y`, `OPPONENT_ARROW_SIZE`, `OPPONENT_FLASH_DURATION`
    - Export camera: `DEFAULT_PORTRAIT_ZOOM`, `PLAYER_CHAR_Y_RANGE`
    - Export touch zone: `TOUCH_ZONE_WIDTH`
    - Export performance: `LOW_FPS_THRESHOLD`, `FPS_SAMPLE_WINDOW`
    - _Requirements: 1.1, 1.4, 4.1, 4.3, 4.4, 5.1, 5.3, 6.5, 8.1, 8.2, 8.3, 8.4_

  - [x] 1.2 Write property test for strumline centering
    - **Property 2: Player strumline is centered with equal padding**
    - Generate random canvas widths, verify strumline X = `(canvasWidth - strumlineWidth) / 2`
    - **Validates: Requirements 4.1, 4.4**

- [x] 2. Create TouchDeviceDetector module
  - [x] 2.1 Create `fnf-phaser/src/input/TouchDeviceDetector.js` with static detection methods
    - Implement `detect()` using `ontouchstart in window` and `navigator.maxTouchPoints > 0`
    - Implement `onFirstTouch()` to upgrade `isTouchDevice` on first touch/pointer event
    - Implement `isTouch()` to return current state
    - Handle fallback when `navigator.maxTouchPoints` is unavailable
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Write property test for touch detection
    - **Property 1: Touch detection matches environment capabilities**
    - Generate random environment configs (ontouchstart presence, maxTouchPoints values), verify detection result
    - **Validates: Requirements 3.1**

- [x] 3. Update game config for portrait canvas
  - [x] 3.1 Update `fnf-phaser/src/main.js` Phaser config
    - Change `width: 1280, height: 720` to `width: 720, height: 1280`
    - Keep `Phaser.Scale.FIT` with `CENTER_BOTH` (letterboxing works automatically)
    - Add `input: { activePointers: 4 }` for multi-touch support
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 6.4_

  - [x] 3.2 Update `fnf-phaser/index.html` for mobile viewport
    - Add `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`
    - Verify existing `background-color: #000000` and `overflow: hidden` provide letterboxing
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create OpponentIndicator widget
  - [x] 5.1 Create `fnf-phaser/src/play/OpponentIndicator.js`
    - Implement constructor accepting scene and config (position, arrow size from LayoutManager)
    - Implement `create()` to build 4 arrow icon graphics in top-left corner, each ≤ 32x32px
    - Implement `flash(direction)` to highlight arrow for 150ms
    - Implement `update(delta)` to fade arrows back to idle state
    - Implement `setPosition(x, y)` and `destroy()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.2 Write property test for opponent indicator flash/decay
    - **Property 3: Opponent indicator flash and decay**
    - Generate random directions (0-3), verify flash sets timer to 150ms and isFlashing to true, then after 150ms of updates isFlashing returns to false
    - **Validates: Requirements 5.2**

- [x] 6. Create TouchInputController
  - [x] 6.1 Create `fnf-phaser/src/input/TouchInputController.js`
    - Implement constructor accepting scene and inputQueue references
    - Implement `create()` to build 4 `Phaser.GameObjects.Rectangle` zones with arrow icon overlays at bottom of portrait canvas
    - Zones sized to `PORTRAIT_WIDTH / 4` wide × `TOUCH_ZONE_HEIGHT` tall, ordered left/down/up/right
    - Implement `onPointerDown(pointer)` mapping pointer.x to zone, pushing `{ direction, timestamp }` to inputPressQueue
    - Implement `onPointerUp(pointer)` pushing release event to inputReleaseQueue
    - Implement `onPointerMove(pointer)` for drag between zones
    - Implement `show()` / `hide()` for visibility toggle
    - Implement `update()` for visual feedback (opacity/tint change on press)
    - Enable multi-touch via Phaser pointer system (pointers 1-4)
    - Implement `destroy()` for cleanup
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 6.2 Write property test for touch zone arrangement
    - **Property 4: Touch zone arrangement and direction mapping**
    - Verify zone at index i has direction === i and x === i * zoneWidth, ensuring correct left-to-right ordering
    - **Validates: Requirements 6.1**

  - [x] 6.3 Write property test for touch press events
    - **Property 5: Touch press produces correct input event**
    - Generate random pointer positions within zone bounds, verify pointerDown produces exactly one press event with matching direction and timestamp within 16ms
    - **Validates: Requirements 6.2**

  - [x] 6.4 Write property test for touch release events
    - **Property 6: Touch release produces correct input event**
    - Generate random active zones, verify pointerUp produces exactly one release event with matching direction and timestamp within 16ms
    - **Validates: Requirements 6.3**

  - [x] 6.5 Write property test for touch zone dimensions
    - **Property 7: Touch zone dimensions fill canvas width**
    - Generate random canvas widths, verify each zone width = canvasWidth / 4, height ≥ 120px, sum of widths = canvasWidth
    - **Validates: Requirements 6.5**

  - [x] 6.6 Write property test for touch zone visual feedback
    - **Property 8: Touch zone visual feedback on press**
    - Generate random press/release sequences, verify alpha/tint changes on press and returns to idle on release
    - **Validates: Requirements 6.7**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Modify PlayState for portrait layout
  - [x] 8.1 Update `fnf-phaser/src/play/PlayState.js` strumline setup for portrait
    - Modify `createStrumlines()` to create only one visible player strumline, centered horizontally using `LayoutManager.PLAYER_STRUMLINE_X`
    - Force downscroll orientation on player strumline
    - Set receptor Y position using `LayoutManager.PLAYER_STRUMLINE_Y`
    - Create opponent strumline hidden (`visible = false`) for timing/scoring only
    - Wire `opponentHitNote` to call `OpponentIndicator.flash(direction)` instead of updating visible opponent strumline
    - _Requirements: 4.1, 4.2, 4.3, 5.4_

  - [x] 8.2 Integrate TouchInputController into PlayState
    - Create `TouchInputController` if `TouchDeviceDetector.isTouch()` returns true
    - Pass `inputPressQueue` and `inputReleaseQueue` references to controller
    - Call `touchInputController.update()` in PlayState update loop
    - Hide controller on non-touch devices
    - _Requirements: 6.1, 6.8, 7.1, 7.2_

  - [x] 8.3 Integrate PerformanceMonitor into PlayState
    - Create `PerformanceMonitor` in PlayState init
    - Check `isLowPerformance()` each frame
    - When low performance detected, disable camera zoom bops and note splashes
    - _Requirements: 12.1, 12.3_

  - [x] 8.4 Write property test for simultaneous touch and keyboard inputs
    - **Property 9: Simultaneous touch and keyboard inputs coexist**
    - Generate mixed touch + keyboard input sequences in same frame, verify all events appear in input queue without drops or duplicates
    - **Validates: Requirements 7.3**

- [x] 9. Reposition HUD elements for portrait
  - [x] 9.1 Update HealthBar positioning in PlayState
    - Position health bar at `LayoutManager.HEALTH_BAR_Y` (near top), centered horizontally
    - Set width to `LayoutManager.HEALTH_BAR_WIDTH` (640px) to fit within 720px canvas with padding
    - _Requirements: 8.1, 8.2_

  - [x] 9.2 Write property test for health bar fitting
    - **Property 10: Health bar fits within portrait canvas**
    - Generate random canvas widths, verify health bar total width (bar + border + padding) ≤ canvas width
    - **Validates: Requirements 8.2**

  - [x] 9.3 Update ScoreDisplay positioning
    - Position at `LayoutManager.SCORE_DISPLAY_Y`, centered horizontally
    - Ensure font size ≥ 16px at base 720×1280 resolution
    - _Requirements: 8.3, 8.5_

  - [x] 9.4 Update ComboPopup positioning
    - Position at `LayoutManager.COMBO_POPUP_Y` (between health bar and strumline receptors)
    - _Requirements: 8.4_

  - [x] 9.5 Write property test for HUD text minimum font size
    - **Property 11: HUD text minimum font size**
    - Generate random HUD text element configs, verify font size ≥ 16px at base resolution
    - **Validates: Requirements 8.5**

- [x] 10. Adapt Stage and Characters for portrait framing
  - [x] 10.1 Update `fnf-phaser/src/play/Stage.js` for portrait layout
    - Adjust `applyStageData()` to scale background props to cover 720×1280
    - Center player character in visible stage area between HUD and strumline
    - Shift opponent character to side or partially off-screen
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 10.2 Update `fnf-phaser/src/graphics/FunkinCamera.js` for portrait zoom
    - Set `defaultZoom` using `LayoutManager.DEFAULT_PORTRAIT_ZOOM` (1.4) to frame characters for taller, narrower canvas
    - Existing follow/lerp logic works unchanged
    - _Requirements: 9.4_

- [x] 11. Adapt menu states for portrait and touch
  - [x] 11.1 Update `fnf-phaser/src/ui/TitleState.js` for portrait dimensions
    - Adjust logo, GF dancer, and "Press Enter" prompt positions for 720×1280 canvas
    - Add touch interactivity: make prompt tappable via `setInteractive()` and `on('pointerdown', ...)`
    - _Requirements: 10.1, 10.2_

  - [x] 11.2 Update `fnf-phaser/src/ui/BaseMenuState.js` for touch support
    - Ensure `createBackground()` uses `this.cameras.main` dimensions (already does)
    - Add touch interactivity helper for menu items with minimum 48×48px touch targets
    - _Requirements: 10.2, 10.3_

  - [x] 11.3 Update remaining menu states (MainMenuState, FreeplayState, OptionsState, StoryMenuState) for portrait
    - Reposition menu elements vertically for narrower 720px width
    - Add `setInteractive()` and `on('pointerdown', ...)` to menu items when touch detected
    - Ensure keyboard navigation still works on non-touch devices
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 11.4 Write property test for menu touch target sizes
    - **Property 12: Menu touch targets meet minimum size**
    - Generate random menu item sizes, verify interactive hit area has width ≥ 48px and height ≥ 48px when touch enabled
    - **Validates: Requirements 10.2**

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Create OrientationPrompt overlay
  - [x] 13.1 Create `fnf-phaser/src/ui/OrientationPrompt.js`
    - Implement constructor accepting scene
    - Implement `create()` to build full-screen overlay with rotate icon and instructional text
    - Implement `checkOrientation()` using `screen.orientation` API with fallback to `window.innerWidth > window.innerHeight`
    - Listen to `window resize` and `screen.orientation change` events
    - Implement `show()` / `dismiss()` with dismiss within 500ms of portrait detection
    - Skip prompt if orientation API unavailable and window dimensions can't be read
    - Implement `destroy()` for cleanup
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 13.2 Integrate OrientationPrompt into BootScene
    - Call `TouchDeviceDetector.detect()` in `BootScene.create()`
    - Create `OrientationPrompt` if touch device detected
    - _Requirements: 3.1, 11.1_

  - [x] 13.3 Write property test for orientation prompt visibility
    - **Property 13: Orientation prompt shown in landscape on touch devices**
    - Generate random viewport dimensions and touch states, verify prompt visible when touch=true and width > height
    - **Validates: Requirements 11.1**

- [x] 14. Create PerformanceMonitor module
  - [x] 14.1 Create `fnf-phaser/src/core/PerformanceMonitor.js`
    - Implement constructor accepting Phaser game reference
    - Implement `update(delta)` tracking rolling FPS average over 1000ms sample window
    - Implement `isLowPerformance()` returning true if avg FPS < 30 for sustained period
    - Implement `shouldReduceEffects()` (alias for isLowPerformance)
    - Default to `false` if `game.loop.actualFps` unavailable (test environments)
    - _Requirements: 12.1, 12.3_

  - [x] 14.2 Write property test for performance monitor threshold
    - **Property 14: Performance monitor threshold**
    - Generate random FPS sequences, verify isLowPerformance returns true when rolling avg < 30 and false when ≥ 30
    - **Validates: Requirements 12.3**

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check integrated with Vitest, minimum 100 iterations per property
- Checkpoints ensure incremental validation between major implementation phases
- All modules use plain JavaScript with JSDoc type annotations
- The design uses portrait as the sole layout — no dual-layout toggling
- Downscroll is always forced to true in portrait mode regardless of saved settings

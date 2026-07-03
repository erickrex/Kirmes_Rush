# Implementation Plan: Whole-App Stabilization

## Overview

This plan resolves the fnf-phaser maintenance debt in strict dependency order: startup canonicalization → lifecycle cleanup → lint fixes → shared type layer → typecheck resolution (registry → data → gameplay → UI) → test/docs/CI alignment. All changes maintain exact feature parity. The JS+JSDoc toolchain is preserved.

## Tasks

- [x] 1. Canonicalize startup and delete BootScene
  - [x] 1.1 Restructure `src/main.js` to own all boot responsibilities
    - Add `TouchDeviceDetector.detect()` and `OrientationOverlay.init()` calls before `new Phaser.Game()`
    - Remove `BootScene` from the scene list and its import
    - Ensure `SaveManager.getInstance().init()`, `TouchDeviceDetector.detect()`, `OrientationOverlay.init()` execute in that order before game creation
    - Keep `OrientationOverlay.destroy()` on `Phaser.Core.Events.DESTROY`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Delete BootScene source and test files
    - Delete `src/scenes/BootScene.js`
    - Delete `tests/BootScene.test.js`
    - _Requirements: 1.5, 6.1_

  - [x] 1.3 Remove all dead boot references from the codebase
    - Search for and remove any `"BootScene"` or `"TitleScene"` scene key string literals in source files
    - Remove comments describing BootScene as the first scene or referencing a boot-first startup contract
    - Remove any imports of BootScene in files other than main.js (already handled)
    - _Requirements: 1.6, 1.7_

  - [x] 1.4 Write property test: Zero dead boot references (Property 1)
    - **Property 1: Zero dead boot references**
    - Scan all `.js` files in `src/` for occurrences of `"BootScene"` or `"TitleScene"` used as scene keys; assert zero matches
    - **Validates: Requirements 1.6, 8.4**

- [x] 2. Checkpoint — Verify startup canonicalization
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Enforce consistent scene lifecycle ownership
  - [x] 3.1 Remove redundant boot service calls from scenes
    - Remove `SaveManager.getInstance().init()` from `LevelSelectState.create()` and `OptionsState.create()`
    - Remove `TouchDeviceDetector.detect()` from `PlayScene.create()`
    - Remove any other scene-local calls to `SaveManager.init()`, `TouchDeviceDetector.detect()`, or `OrientationOverlay.init()` outside of `main.js`
    - _Requirements: 2.4_

  - [x] 3.2 Audit and add shutdown handlers to scenes missing them
    - Audit `GameOverState`, `ResultState`, `StoryMenuState`, `FreeplayState`, `ReplayBrowserState` for shutdown completeness
    - Add or fix `shutdown()` methods that unregister all keyboard listeners, EventBus subscriptions, timers, tweens, and null owned Phaser game object references
    - Ensure each shutdown handler calls `this.events?.off('shutdown', this.shutdown, this)`
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify TitleState attract timer cleanup in shutdown
    - Confirm `TitleState.shutdown()` cancels the attract timer and stops attract mode tweens
    - Fix if any cleanup is missing
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Write property test: Scene shutdown completeness (Property 2)
    - **Property 2: Scene shutdown completeness**
    - For each scene class, verify that calling `shutdown()` removes all listener registrations and nulls owned references
    - **Validates: Requirements 2.1, 2.2**

  - [x] 3.5 Write property test: No boot service re-initialization in scenes (Property 3)
    - **Property 3: No boot service re-initialization in scenes**
    - For each gameplay/menu scene, spy on `SaveManager.init`, `TouchDeviceDetector.detect`, `OrientationOverlay.init`; call `create()`; assert zero calls
    - **Validates: Requirements 2.4**

- [x] 4. Checkpoint — Verify lifecycle cleanup
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fix all lint errors and warnings
  - [x] 5.1 Run auto-fix and manually resolve remaining lint issues
    - Run `npm run lint:fix` to auto-fix prettier formatting issues
    - Manually fix remaining `curly` violations (add braces to single-line if/else) in: `AudioManager.js`, `PlayScene.js`, `BaseMenuState.js`, `LevelSelectState.js`, `OptionsState.js`, `PauseSubState.js`
    - Remove or prefix unused variables with `_`
    - Verify `npm run lint` reports zero errors and zero warnings
    - Do NOT weaken, disable, or add exemptions to any ESLint/Prettier rule
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Checkpoint — Verify lint baseline
  - Ensure `npm run lint` exits with zero errors and zero warnings. Ask the user if questions arise.

- [x] 7. Expand shared type layer (`src/types.js`)
  - [x] 7.1 Add raw chart/metadata JSON typedefs to `src/types.js`
    - Add `RawChartNote`, `RawChartJSON`, `RawMetadataJSON` typedefs
    - Add `ParsedSongMetadata` with the richer ChartParser structure
    - Update canonical `NoteData` to be the single definition (direction-based, with optional `strumlineIndex`)
    - Update canonical `ChartData` to use per-difficulty `scrollSpeed` (`Object<string, number>`)
    - Update canonical `SongMetadata` to include `playData` and `timeChanges` from ChartParser's structure
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [x] 7.2 Add scene payload and registry typedefs to `src/types.js`
    - Add `PlayScenePayload`, `LoadingStatePayload`, `ResultStatePayload` typedefs
    - Add complete `RegistryConfig` typedef with `entityName` and `displayInfoFields`
    - Add `RegistryEntryBase` typedef with `id` and optional `destroy`
    - Add `ReplayData`, `ReplayFrame` typedefs
    - Add `PreparedPlaySession` typedef
    - Add `AudioBoundaryInterfaces` typedefs for Phaser sound manager variants
    - _Requirements: 4.1, 4.2_

  - [x] 7.3 Remove conflicting local typedefs from other modules
    - Remove duplicate `NoteData` typedef from `NoteSprite.js` and `ChartParser.js`; replace with import from `types.js`
    - Remove duplicate `SongMetadata` typedef from `ChartParser.js`; replace with import from `types.js`
    - Remove duplicate `ChartData` typedef from `ChartParser.js`; replace with import from `types.js`
    - Remove duplicate `RegistryConfig` typedef from `Registry.js`; replace with import from `types.js`
    - Remove duplicate `LoadingConfig` typedef from `LoadingState.js`; replace with import from `types.js`
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [x] 7.4 Write property test: No duplicate cross-module typedefs (Property 4)
    - **Property 4: No duplicate cross-module typedefs**
    - Parse all `.js` files in `src/`, extract `@typedef` names; assert no name appears in both `types.js` and another file
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6**

- [x] 8. Checkpoint — Verify shared type layer
  - Ensure all tests pass and `npm run typecheck` error count has decreased. Ask the user if questions arise.

- [x] 9. Resolve typecheck debt — Layer 1: Registry foundation (~33 errors)
  - [x] 9.1 Fix `Registry.js` generic type annotations
    - Add `@template {RegistryEntryBase} T` constraint so `entry.id` and `entry.destroy` resolve
    - Add explicit `@returns` annotations on `fetchEntry`, `getAllEntries`, `listEntryIds`
    - Type the `file` parameter in the `loaderror` callback
    - Add null guards for `entry` access in iteration methods
    - _Requirements: 5.4_

  - [x] 9.2 Fix `createRegistry` factory type annotations
    - Type `getInstance()` return as the concrete `ConfigRegistry` class
    - Add `@type` annotations on dynamically generated helper methods (`get${entityName}Data`, etc.)
    - Fix implicit `any` from dynamic prototype indexing with explicit `Record<string, any>` or `@this` annotations
    - Complete `RegistryConfig` typedef with `entityName` and `displayInfoFields` fields
    - _Requirements: 5.4_

  - [x] 9.3 Write property test: No bare Object params in data layer (Property 5)
    - **Property 5: No bare Object parameter types in data layer**
    - Parse all data layer `.js` files, extract `@param` annotations, assert none use bare `Object` type
    - **Validates: Requirements 5.5**

- [x] 10. Resolve typecheck debt — Layer 2: Data layer (~350 errors)
  - [x] 10.1 Fix ChartParser type annotations (~40 errors)
    - Replace bare `Object` params with `RawChartJSON`, `RawMetadataJSON` from shared types
    - Add `@returns` annotations with concrete return types
    - Fix `variation` property not existing on `ChartData`/`SongMetadata` — add to typedef or use separate return type
    - Fix `Generic type 'Array<T>' requires 1 type argument(s)` — use `Array<Object>` or concrete type
    - Fix implicit `any` from `Object.entries` on untyped objects — use `Record<string, T>` typedefs
    - _Requirements: 5.5_

  - [x] 10.2 Fix SparrowParser type annotations (~10 errors)
    - Replace bare `Object` params with concrete typedefs for raw XML/JSON atlas data
    - Add `@returns` annotations
    - _Requirements: 5.5_

  - [x] 10.3 Fix SaveManager type annotations (~15 errors)
    - Add concrete typedefs for options shape, progress shape, score entry
    - Fix any implicit `any` from dynamic key access
    - _Requirements: 5.5_

  - [x] 10.4 Fix CharacterRegistry type annotations (~245 errors)
    - Add concrete `CharacterEntry` and `CharacterCleanedData` typedefs
    - Replace bare `Object` params in `cleanData`, `createEntry`, `validateData`
    - Type all dynamically generated helper methods
    - _Requirements: 5.4, 5.5_

  - [x] 10.5 Fix NoteStyleRegistry type annotations (~20 errors)
    - Add concrete `NoteStyleEntry` and `NoteStyleCleanedData` typedefs
    - Replace bare `Object` params
    - _Requirements: 5.4, 5.5_

  - [x] 10.6 Fix StageRegistry and SongRegistry type annotations (~20 errors)
    - Add concrete entry and cleaned data typedefs for each
    - Replace bare `Object` params
    - _Requirements: 5.4, 5.5_

- [x] 11. Checkpoint — Verify data layer typecheck
  - Ensure all tests pass and registry + data layer modules are type-clean. Ask the user if questions arise.

- [x] 12. Resolve typecheck debt — Layer 3: Gameplay (~460 errors)
  - [x] 12.1 Fix PlayState type annotations (~167 errors)
    - Add concrete types for scene context, config params, callback signatures
    - Fix nullable access patterns with null guards or `@type {X | null}` annotations
    - Add Phaser boundary casts only at call sites (e.g., `/** @type {Phaser.Sound.WebAudioSound} */`)
    - _Requirements: 5.6, 5.8_

  - [x] 12.2 Fix PlayScene type annotations (~110 errors)
    - Type session, registry, and HUD object references
    - Fix nullable chains in `bootstrapPresentation`, `setupCameraLayers`, `registerGameplayFlow`
    - Add concrete types for `resolveSession` return and `handleSongEnd` data param
    - _Requirements: 5.6, 5.8_

  - [x] 12.3 Fix NoteProcessor and SongFlowController type annotations (~156 errors)
    - Add concrete types for note processing callbacks, timing windows, and flow state
    - Fix implicit `any` from array/object iteration
    - _Requirements: 5.6_

  - [x] 12.4 Fix Strumline type annotations (~29 errors)
    - Type note pool, receptor sprites, and hold graphics
    - Fix nullable access on note data properties
    - _Requirements: 5.6_

  - [x] 12.5 Fix AudioManager and VoicesGroup type annotations
    - Add Phaser boundary casts for `sound.context`, `sound.add` return types
    - Fix `seek` property access patterns (Phaser's `seek` is a getter/setter)
    - Type `onComplete` callback signature
    - _Requirements: 5.6, 5.8_

  - [x] 12.6 Fix input system type annotations (PreciseInput, Controls, TouchInputController)
    - Type key mapping objects, event handler signatures, and zone configurations
    - Fix implicit `any` from keyboard event handlers
    - _Requirements: 5.6_

- [x] 13. Checkpoint — Verify gameplay typecheck
  - Ensure all tests pass and gameplay modules are type-clean. Ask the user if questions arise.

- [x] 14. Resolve typecheck debt — Layer 4: UI scenes (~200 errors)
  - [x] 14.1 Fix ReplayBrowserState type annotations (~46 errors)
    - Type replay data structures, list item models, and scene payload
    - Fix nullable access patterns
    - _Requirements: 5.7_

  - [x] 14.2 Fix PauseSubState type annotations (~38 errors)
    - Type menu items, callback signatures, and parent scene reference
    - _Requirements: 5.7_

  - [x] 14.3 Fix OptionsState type annotations (~29 errors)
    - Type option item models, value accessors, and save integration
    - _Requirements: 5.7_

  - [x] 14.4 Fix ResultState type annotations (~17 errors)
    - Type result payload, tally display, and rank calculation
    - _Requirements: 5.7_

  - [x] 14.5 Fix remaining UI scene type annotations (MainMenuState, LevelSelectState, StoryMenuState, FreeplayState, GameOverState, TitleState)
    - Type scene payloads, menu models, and nullable lifecycles
    - Fix any remaining typecheck errors across all UI modules
    - _Requirements: 5.7_

  - [x] 14.6 Fix remaining typecheck errors in utility and graphics modules
    - Fix any remaining errors in `FunkinSprite`, `FunkinCamera`, `Transitions`, `Conductor`, `EventBus`, `Constants`, `LayoutManager`, etc.
    - Ensure `npm run typecheck` reports zero diagnostics
    - _Requirements: 5.1_

- [x] 15. Checkpoint — Verify zero typecheck diagnostics
  - Ensure `npm run typecheck` reports exactly zero errors. Ask the user if questions arise.

- [x] 16. Align tests, docs, and CI
  - [x] 16.1 Create `tests/AppBootstrap.test.js`
    - Test that `SaveManager.init` is called exactly once during bootstrap
    - Test that `TouchDeviceDetector.detect` is called exactly once
    - Test that `OrientationOverlay.init` is called exactly once
    - Test that `OrientationOverlay.destroy` is called on game DESTROY event
    - Test that BootScene is not in the scene list
    - Test that TitleState is the first scene
    - _Requirements: 6.2_

  - [x] 16.2 Suppress expected console noise in tests
    - Add `vi.spyOn(console, 'warn')` and `vi.spyOn(console, 'error')` in tests that exercise error paths
    - Restore via `vi.restoreAllMocks()` in `afterEach`
    - _Requirements: 6.6_

  - [x] 16.3 Create CI workflow file `.github/workflows/fnf-phaser-ci.yml`
    - Configure trigger on push/PR affecting `fnf-phaser/**`
    - Run in `fnf-phaser` working directory with Node 20
    - Execute: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run build`
    - Fail workflow on any step failure (no `continue-on-error`)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 16.4 Create `fnf-phaser/docs/ARCHITECTURE.md`
    - Document startup flow (App_Bootstrap → TitleState)
    - Document loader ownership contract (LoadingState)
    - Document scene lifecycle rules (shutdown contract)
    - Document shared type layer policy (`src/types.js`)
    - Document Hidden_Mode policy
    - Document verification commands (`npm run test`, `lint`, `typecheck`, `build`)
    - Contain zero references to BootScene as an active component
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 16.5 Update fnf-phaser README to reference ARCHITECTURE.md
    - Add link to `docs/ARCHITECTURE.md`
    - Update verification status description
    - _Requirements: 8.3_

- [x] 17. Final checkpoint — Full verification
  - Run `npm run test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`, and `npm run build` from the fnf-phaser directory
  - Ensure all five commands pass with zero failures, zero errors, and zero warnings
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.1, 5.1, 6.4, 6.5, 9.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each workstream
- Property tests validate universal correctness properties from the design document
- The typecheck resolution (tasks 9–14) is the largest workstream and is broken into sub-tasks per module group following the dependency order specified in the design
- Lint fixes (task 5) come before type work since formatting changes can cause merge conflicts
- Feature parity is maintained throughout — no gameplay, scoring, or input behavior changes (Requirement 9)

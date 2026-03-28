# Implementation Plan: Codebase Simplification

## Overview

Incremental refactoring of the fnf-phaser codebase across six areas: Registry Factory enhancement, shared Asset Path Resolver, BaseMenuState navigation absorption, PlayState decomposition, Scoring strategy pattern, and Conductor singleton cleanup. Each step builds on the previous, ending with integration wiring. All code is plain JavaScript with JSDoc, tested with Vitest and fast-check.

## Tasks

- [x] 1. Create shared Asset Path Resolver utility
  - [x] 1.1 Create `fnf-phaser/src/utils/AssetPathResolver.js` with the `resolveAssetPath(assetPath)` function
    - Handle `shared:`, `default:`, custom `<prefix>:`, and bare path formats
    - Return `null` for null/empty input
    - Split only on first colon for paths with multiple colons
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 1.2 Write property test for Asset Path Resolver
    - **Property 5: Asset path resolution**
    - Generate random prefix/path string pairs, verify resolution follows prefix rules
    - Verify null/empty returns null
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x] 1.3 Update NoteStyleRegistry, StageRegistry, and CharacterRegistry to import and delegate to the shared `resolveAssetPath`
    - Remove local `resolveAssetPath` function from each registry file
    - Import from `../../utils/AssetPathResolver.js`
    - Ensure all internal usages (e.g., `getAllAssetPaths`, `_collectNestedPaths`) use the imported version
    - _Requirements: 2.6_

- [x] 2. Enhance Registry Factory with common method generation
  - [x] 2.1 Extend `createRegistry()` in `fnf-phaser/src/core/Registry.js` to accept `entityName` and `displayInfoFields` config options
    - When `entityName` is present, generate `get<EntityName>Data(id)`, `get<EntityName>Name(id)`, `list<EntityName>Ids()`, `get<EntityName>Path(id)`, `get<EntityName>DisplayInfo(id)`, and `toString()` on the prototype
    - Custom methods in `options.methods` with the same name override generated ones
    - If `entityName` is not a non-empty string, log warning and skip generation
    - If `displayInfoFields` references missing fields, omit them from display info
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property test for generated method existence
    - **Property 1: Generated method existence**
    - Generate random valid entityName strings, verify all six methods exist as functions on the prototype
    - **Validates: Requirements 1.1, 1.6**

  - [ ]* 2.3 Write property test for generated accessor correctness
    - **Property 2: Generated accessor correctness**
    - Generate random entry data, verify `get<EntityName>Data(id)` returns `fetchEntry(id)?.data ?? null` and `get<EntityName>Name(id)` returns `fetchEntry(id)?.name ?? id`
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.4 Write property test for custom method override
    - **Property 3: Custom method override**
    - Create registries with custom methods matching generated names, verify custom implementation is used
    - **Validates: Requirements 1.4**

  - [ ]* 2.5 Write property test for DisplayInfo field selection
    - **Property 4: DisplayInfo field selection**
    - Generate random `displayInfoFields` arrays, verify returned object contains exactly `id` plus specified fields
    - **Validates: Requirements 1.5**

  - [x] 2.6 Update concrete registries (NoteStyleRegistry, StageRegistry, CharacterRegistry, SongRegistry) to use `entityName` config
    - Add `entityName` to each registry's `createRegistry()` config
    - Remove hand-written methods that are now auto-generated (e.g., `getStyleData`, `getStyleName`, `listStyleIds`, `getStylePath`, `toString` in NoteStyleRegistry)
    - Keep custom methods that have specialized logic (e.g., `getAsset` with fallback chain)
    - _Requirements: 1.1, 1.4, 7.1, 7.4_

  - [ ]* 2.7 Write property test for generated method behavioral equivalence
    - **Property 11: Generated method behavioral equivalence**
    - For each registry, generate random entry data, load it, compare generated method output against known hand-written behavior
    - **Validates: Requirements 7.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add list-based navigation to BaseMenuState
  - [x] 4.1 Add navigation properties and methods to `fnf-phaser/src/ui/BaseMenuState.js`
    - Add `selectedIndex = 0` property
    - Add `getItemCount()` returning 0 (subclasses override)
    - Add `updateSelection()`, `executeSelection()`, `executeBack()` as no-op overridable methods
    - Add `onNavigateUp()` and `onNavigateDown()` with transition guard, wrapping, scroll sound, and `updateSelection()` call
    - Add `onSelect()` with transition guard, confirm sound, and `executeSelection()` call
    - Add `onBack()` with transition guard, cancel sound, and `executeBack()` call
    - Update `getInputBindings()` to return default UP/W/DOWN/S/ENTER/SPACE/ESC/BACKSPACE bindings
    - Guard against `getItemCount() === 0` in navigation methods
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 4.2 Write property test for navigation index wrapping
    - **Property 6: Navigation index wrapping**
    - Generate random item counts ≥ 1 and starting indices, verify `(selectedIndex - 1 + itemCount) % itemCount` for up and `(selectedIndex + 1) % itemCount` for down
    - **Validates: Requirements 3.1, 3.7, 3.8**

  - [ ]* 4.3 Write property test for transition guard idempotence
    - **Property 7: Transition guard idempotence**
    - Verify that when `transitioning` is true, `onSelect()`/`onBack()` are no-ops; when false, they set `transitioning` to true and invoke execute methods exactly once
    - **Validates: Requirements 3.5, 3.6**

  - [x] 4.4 Refactor menu states to use BaseMenuState navigation
    - Update MainMenuState, FreeplayState, StoryMenuState, OptionsState to override `getItemCount()`, `updateSelection()`, `executeSelection()`, `executeBack()`
    - Remove duplicated navigation logic (index wrapping, transition guards, sound calls) from each menu state
    - Use `super.getInputBindings()` and append extra bindings where needed
    - _Requirements: 3.4, 7.1_

- [x] 5. Implement Scoring strategy pattern
  - [x] 5.1 Refactor `fnf-phaser/src/play/Scoring.js` to use strategy objects
    - Extract `_scoreNoteLegacy`/`_judgeNoteLegacy` into `LegacyStrategy` object
    - Extract `_scoreNoteWeek7`/`_judgeNoteWeek7` into `Week7Strategy` object
    - Extract `_scoreNotePBOT1`/`_judgeNotePBOT1` into `PBOT1Strategy` object
    - Each strategy has `scoreNote(msTiming)`, `judgeNote(msTiming)`, `getMissScore()` methods
    - Create `strategies` registry mapping `ScoringSystem` enum values to strategy objects
    - Replace switch statements in `scoreNote`, `judgeNote`, `getMissScore` with strategy lookup and delegation
    - Fall back to PBOT1 for unrecognized scoring system values
    - Keep all other public static methods unchanged (`calculateRank`, `createTallies`, `updateTalliesOnHit`, `updateTalliesOnMiss`, `doesJudgementBreakCombo`, `getHealthBonus`, `compareRanks`, `getRankValue`, `tallyCompletion`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 5.2 Write property test for scoring strategy dispatch equivalence
    - **Property 9: Scoring strategy dispatch equivalence**
    - Generate random msTiming values, verify `Scoring.scoreNote`/`judgeNote`/`getMissScore` match direct strategy calls for all valid ScoringSystem values
    - **Validates: Requirements 5.3, 5.4, 5.5**

  - [ ]* 5.3 Write property test for unknown scoring system fallback
    - **Property 10: Unknown scoring system fallback**
    - Generate random invalid scoring system strings, verify results match PBOT1 strategy
    - **Validates: Requirements 5.6**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Decompose PlayState into focused modules
  - [x] 7.1 Create `fnf-phaser/src/play/GameplayState.js` module
    - Export `createGameplayState(context)` factory function
    - Move health, score, combo, tallies state and update methods from PlayState
    - Include `destroy()` for cleanup
    - _Requirements: 4.3_

  - [x] 7.2 Create `fnf-phaser/src/play/NoteProcessor.js` module
    - Export `createNoteProcessor(context)` factory function
    - Move `checkMissedNotes`, `processOpponentNotes`, `hitNote`, `missNote`, `ghostMiss`, `opponentHitNote` from PlayState
    - Use EventBus for communication with GameplayState (score/health/combo updates)
    - Include `destroy()` for EventBus listener cleanup
    - _Requirements: 4.1, 4.6_

  - [x] 7.3 Create `fnf-phaser/src/play/InputManager.js` module
    - Export `createInputManager(context)` factory function
    - Move `processInputQueue`, `handleNoteInput`, `handleNoteRelease` from PlayState
    - Delegate note hit/miss to NoteProcessor via context
    - Include `destroy()` for cleanup
    - _Requirements: 4.2, 4.6_

  - [x] 7.4 Create `fnf-phaser/src/play/CameraController.js` module
    - Export `createCameraController(context)` factory function
    - Move `setupCameras`, `focusCamera`, `getCameraFocusCharacter`, `handleFocusCameraEvent`, `handleZoomCameraEvent` from PlayState
    - Register/unregister EventBus listeners for camera events
    - Include `destroy()` for cleanup
    - _Requirements: 4.4, 4.6_

  - [x] 7.5 Create `fnf-phaser/src/play/SongFlowController.js` module
    - Export `createSongFlowController(context)` factory function
    - Move `startCountdown`, `scheduleCountdownStep`, `executeCountdownStep`, `startSong`, `endSong`, `gameOver` from PlayState
    - Include `destroy()` for cleanup
    - _Requirements: 4.5, 4.6_

  - [x] 7.6 Refactor PlayState to orchestrate modules
    - Import and create all five modules in PlayState constructor/init
    - Build shared `context` object with scene, playState, conductor, eventBus, scoring, gameplayState references
    - Update `update()` loop to delegate to `inputManager.processInputQueue()`, `noteProcessor.processOpponentNotes()`, `noteProcessor.checkMissedNotes()`
    - Delegate camera updates to CameraController
    - Keep PlayState as the single orchestrator under 400 lines
    - Preserve all existing public methods by delegating to modules
    - Update `destroy()` to call `destroy()` on each module
    - _Requirements: 4.7, 4.8, 7.1, 7.3_

  - [ ]* 7.7 Write property test for module destroy cleanup
    - **Property 8: Module destroy cleanup**
    - Register EventBus listeners across modules, call PlayState destroy, verify all module-registered listeners are removed
    - **Validates: Requirements 4.8**

- [x] 8. Conductor singleton cleanup
  - [x] 8.1 Remove `getInstance()` from `fnf-phaser/src/core/Conductor.js`
    - Delete the `static getInstance()` method
    - _Requirements: 6.1, 6.2_

  - [x] 8.2 Update all callers of `Conductor.getInstance()` to use `Conductor.instance`
    - Update `fnf-phaser/src/play/PlayState.js` constructor
    - Update any other files referencing `Conductor.getInstance()`
    - Update test files that reference `Conductor.getInstance()` (e.g., `PlayState.test.js`)
    - _Requirements: 6.3, 6.4, 7.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check integrated with Vitest, minimum 100 iterations per property
- Checkpoints ensure incremental validation between major refactoring phases
- All modules use plain JavaScript with JSDoc type annotations

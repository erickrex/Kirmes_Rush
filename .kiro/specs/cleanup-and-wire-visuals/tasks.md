# Implementation Plan: Cleanup and Wire-In Visual Features

## Task Dependency Graph

Tasks are grouped into sequential waves. Tasks within a wave may run in parallel; each wave depends on the prior wave completing.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "1.2", "1.3"],
      "dependsOn": [],
      "description": "Delete dead code and confirm a clean baseline."
    },
    {
      "wave": 2,
      "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"],
      "dependsOn": [1],
      "description": "Consolidate gameplay state into a single owner; extend NOTE_HIT payload."
    },
    {
      "wave": 3,
      "tasks": ["3.1", "3.2", "3.3", "4.1", "4.2", "4.3", "5.1", "5.2", "5.3"],
      "dependsOn": [2],
      "description": "Wire in combo popup, note splashes, and health icons (mutually independent)."
    },
    {
      "wave": 4,
      "tasks": ["6"],
      "dependsOn": [3],
      "description": "Checkpoint: verify HUD features render and gates pass."
    },
    {
      "wave": 5,
      "tasks": ["7.1", "7.2", "7.3", "7.4"],
      "dependsOn": [4],
      "description": "Centralize and wire in scene transitions."
    },
    {
      "wave": 6,
      "tasks": ["8.1", "8.2"],
      "dependsOn": [1],
      "description": "Remove dead exports and chunk the Phaser bundle (only needs wave 1; sequenced here for checkpoint grouping)."
    },
    {
      "wave": 7,
      "tasks": ["9.1"],
      "dependsOn": [2, 3, 5, 6],
      "description": "Update documentation to match the implemented changes."
    },
    {
      "wave": 8,
      "tasks": ["10"],
      "dependsOn": [5, 6, 7],
      "description": "Final checkpoint across all Verification_Gates."
    }
  ]
}
```

Notes:
- Phase 1 must complete first (smallest blast radius, unblocks clean graph).
- Phase 2 precedes 3/4/5 so combo/score values are authoritative before they are rendered, and so the extended `NOTE_HIT` payload (direction/receptor) exists for the visual features.
- Tasks 3, 4, 5 are mutually independent and may be implemented in parallel after Phase 2.
- Wave 6 (exports + chunking) depends only on Wave 1 and may be done at any point afterward; it is grouped late only for checkpoint convenience.
- Wave 7 (docs) should run after the implementing phases it documents.

## Overview

Incremental plan across three workstreams: delete dead code, wire in the four orphaned visual features so they render, and consolidate gameplay state plus minor maintenance fixes. Each phase ends in a checkpoint that runs all Verification_Gates (`lint`, `typecheck`, `test`, `test:integration`, `build`). Tasks marked `*` are optional (extra tests). All code is plain JavaScript with JSDoc, tested with Vitest/fast-check.

## Tasks

- [x] 1. Remove confirmed dead code
  - [x] 1.1 Delete the orphan levels barrel and empty util folder
    - Delete `fnf-phaser/src/levels/index.js`
    - Delete the empty `fnf-phaser/src/util/` directory (keep `src/utils/`)
    - Grep for any `from '.../levels/index'` or `from '.../levels'` barrel imports and repoint to `LevelSystem.js` directly (expected: none)
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 1.2 Delete superseded SongRegistry and SparrowParser with their tests
    - Delete `fnf-phaser/src/data/registries/SongRegistry.js` and `fnf-phaser/tests/SongRegistry.test.js`
    - Delete `fnf-phaser/src/data/parsers/SparrowParser.js` and `fnf-phaser/tests/SparrowParser.test.js`
    - Grep for any remaining imports of either module in src and tests and remove them
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 1.3 Checkpoint - run all Verification_Gates
    - Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run build`
    - Resolve any dangling references before proceeding
    - _Requirements: 1.6_

- [x] 2. Consolidate gameplay state into a single owner (do before visual wiring so combo values are authoritative)
  - [x] 2.1 Make GameplayState_Module authoritative in PlayState
    - In `fnf-phaser/src/play/PlayState.js`, replace the standalone `score`/`combo`/`maxCombo`/`health`/`tallies` fields with read accessors (getters) over `_gameplayState`
    - Redirect any external writes to those fields to the corresponding GameplayState methods
    - _Requirements: 6.1, 6.3_

  - [x] 2.2 Route NoteProcessor mutations exclusively through GameplayState
    - In `fnf-phaser/src/play/NoteProcessor.js`, remove direct mutations in `hitNote`/`missNote` (`playState.score += ...`, `playState.combo`, tally increments, inline health clamp, inline combo-break)
    - Call `gameplayState.updateScore/updateCombo/updateTallies/updateHealth` instead
    - Ensure state is updated exactly once per hit/miss (remove the duplicate `onNoteHitEvent`/`onNoteMissEvent` re-application, or strip them to display-only/no-op)
    - Extend the `Events.NOTE_HIT` payload with `direction` and the hit `receptor` (`{x,y}` or null)
    - _Requirements: 6.2, 6.4, 6.5_

  - [x] 2.3 Remove duplicate combo-break logic
    - Confirm `GameplayState.updateCombo` is the only place that calls `Scoring.doesJudgementBreakCombo`
    - Remove any other inline combo-break branches in the play modules
    - _Requirements: 6.5_

  - [x] 2.4 Update tests for single-owner contract
    - Update `fnf-phaser/tests/PlayState.test.js` and `fnf-phaser/tests/NoteProcessor.test.js` only where they assert on the removed parallel fields; keep behavioral assertions (final score/combo/tallies/rank) intact
    - _Requirements: 6.7_

  - [x] 2.5 Property test: exactly-once gameplay state update
    - Generate random hit/miss judgement sequences; assert PlayState read accessors equal GameplayState values and totals are not double-counted
    - **Validates: Requirements 6.4, 6.6**

  - [x] 2.6 Checkpoint - run all Verification_Gates
    - Confirm scoring/combo/health behavior unchanged (existing Scoring/PlayState behavioral tests green)
    - _Requirements: 6.6, 6.7_

- [x] 3. Wire in the Combo Popup
  - [x] 3.1 Add rendering backing to ComboPopup
    - In `fnf-phaser/src/play/ComboPopup.js`, add lazy `ensureGameObject(record)` and `syncGameObject(record)` that create/update real Phaser objects (Phaser `Text` for judgement/combo labels, or loaded note-style combo-number assets when available)
    - Sync `x/y/alpha/scale/visible` in `update(delta)`; hide game objects when records return to the pool
    - Guard all game-object calls behind `this.scene?.add`
    - Destroy all active + pooled game objects in `destroy()`
    - _Requirements: 2.3, 2.4, 2.7_

  - [x] 3.2 Create and drive ComboPopup from PlayState
    - In `fnf-phaser/src/play/PlayState.js`, create a ComboPopup in HUD setup, register on `camHUD`
    - In `onNoteHit`, call `showJudgement(judgement, combo, COMBO_POPUP_x, COMBO_POPUP_Y)`; respect the `comboDisplay` save option for combo numbers via `setShowComboNumbers`
    - Call `comboPopup.update(delta)` in the update loop and `comboPopup.destroy()` on shutdown
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [x] 3.3 Test ComboPopup rendering + teardown
    - With a scene exposing `add`, assert game objects are created on `showJudgement` and destroyed on `destroy`; with no scene, assert headless data path still works
    - **Validates: Requirements 2.3, 2.4, 2.7**

- [x] 4. Wire in Note Splashes
  - [x] 4.1 Add rendering backing to NoteSplash
    - In `fnf-phaser/src/play/NoteSplash.js`, acquire a splash texture (loaded note-style splash asset, else generated burst via Generated_Texture_Pattern)
    - Add lazy game-object creation + sync of `x/y/alpha/scale/rotation/visible` in `update(delta)`
    - Guard on `this.scene?.add`; destroy all game objects in `destroy()`
    - _Requirements: 3.3, 3.6_

  - [x] 4.2 Create and drive NoteSplash from PlayState
    - Create NoteSplash in HUD/strumline setup; register on the receptor layer / `camHUD`
    - In `onNoteHit`, when judgement is `sick` or `killer`, call `spawnAtReceptor(playerReceptor, direction)` using the receptor from the NOTE_HIT payload
    - Disable via `setEnabled(false)` when `areSplashesEnabled(styleId)` is false or no splash asset exists
    - Call `noteSplash.update(delta)` in the update loop and `noteSplash.destroy()` on shutdown
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 4.3 Test NoteSplash gating + teardown
    - Assert spawn occurs only on sick/killer, no spawn when disabled, and game objects destroyed on `destroy`
    - **Validates: Requirements 3.2, 3.4, 3.6**

- [x] 5. Wire in Health Icons
  - [x] 5.1 Texture acquisition helper for HealthIcon
    - Add a small helper that assigns a real icon texture when present in `scene.textures`, else generates a color-coded placeholder via Generated_Texture_Pattern
    - _Requirements: 4.3_

  - [x] 5.2 Create and drive two HealthIcons from PlayState
    - Create player and opponent `HealthIcon` instances; register on `camHUD`
    - Configure each from `CharacterRegistry.getHealthIconData(charId)`
    - Call `updateHealthIcon(health)` and `updatePosition(healthBar)` each frame; call `bop()` on beat
    - Destroy both icons on shutdown
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6_

  - [x] 5.3 Test HealthIcon wiring
    - Assert two icons created, configured from registry, position/state update with health, destroyed on shutdown
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.6**

- [x] 6. Checkpoint - run all Verification_Gates
  - Confirm gameplay HUD features render without throwing in tests and the build passes
  - _Requirements: 2.6, 3.5, 4.6_

- [x] 7. Wire in Scene Transitions
  - [x] 7.1 Centralize Transitions in BaseMenuState
    - In `fnf-phaser/src/ui/BaseMenuState.js`, construct a `Transitions` instance, optionally play `transitionIn` on entry
    - Rewrite `transitionToScene(sceneKey, data)` to play `transitionOut` (default fade, 500ms equivalent) then `scene.start(sceneKey, data)`
    - Destroy the Transitions instance in `shutdown`; cancel in-flight transitions safely
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 7.2 Migrate non-BaseMenuState transition duplication
    - Update scenes that replicate `cameras.main.fadeOut(...)` (e.g., `ReplayBrowserState`, `GameOverState`, `ResultState`, `TitleState`) to the shared fade contract via a Transitions instance, preserving target scene + data
    - _Requirements: 5.1, 5.5_

  - [x] 7.3 Update transition-related tests
    - Update tests asserting directly on `cameras.main.fadeOut` to assert on navigation outcome (target scene + payload) where the mechanism changed; keep navigation contracts intact
    - _Requirements: 5.5_

  - [x] 7.4 Test transition teardown safety
    - Assert that triggering shutdown mid-transition cancels tweens/overlay without throwing
    - **Validates: Requirements 5.4, 5.6**

- [x] 8. Remove dead exports and chunk the bundle
  - [x] 8.1 Remove dead exports in the levels layer
    - Remove or de-export `MANIFEST_BASE_PATH` in `fnf-phaser/src/levels/LevelContentResolver.js` if it has no external importer
    - For `AssetManifestBuilder` granular builders referenced only by tests: either keep export+test or make internal and re-cover via `buildManifest`/`buildPrepareCallback`; keep `buildManifest`/`buildPrepareCallback` exported
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.2 Add Phaser manualChunks to Vite config
    - In `fnf-phaser/vite.config.js`, add `build.rollupOptions.output.manualChunks` isolating `node_modules/phaser` into a `phaser` chunk
    - Verify `npm run build` no longer warns on the application chunk size
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 9. Update documentation
  - [x] 9.1 Align ARCHITECTURE.md with the implemented changes
    - Document HUD visual features (combo popups, note splashes, health icons), Transitions-backed scene transitions, and the GameplayState single-owner contract
    - Remove references to any deleted module
    - _Requirements: 9.1, 9.2_

- [x] 10. Final checkpoint - run all Verification_Gates
  - Run `lint`, `typecheck`, `test`, `test:integration`, `build`; all green
  - Confirm no orphaned visual feature remains unwired and no dangling imports exist
  - _Requirements: 1.6, 2.6, 6.7, 7.4, 8.2_

## Notes

- Tasks marked `*` are optional extra tests and can be skipped for a faster MVP.
- Phase order is deliberate: delete first (smallest blast radius), then consolidate state (so combo values are correct before they are displayed), then render features, then transitions, then maintenance.
- The headless→rendered conversion for ComboPopup/NoteSplash preserves their pooling data model and only attaches/syncs Phaser game objects, keeping existing unit tests valid.
- Default transition stays a 500ms fade so observable navigation behavior is preserved.

# Tasks: Fix Broken Wiring in fnf-phaser

## Task 1: Add Conductor.getInstance() static method [REQ-3, D-3]
- [x] Add `static getInstance()` method to `Conductor` class in `fnf-phaser/src/core/Conductor.js` that returns `Conductor.instance`
- [x] Verify existing tests still pass

## Task 2: Fix PlayState Conductor call [REQ-3, D-3]
- [x] PlayState calls `Conductor.getInstance()` — now works because Task 1 added the method
- [x] No other broken method calls in PlayState

## Task 3: Create PlayScene wrapper [REQ-2, D-2]
- [x] Create `fnf-phaser/src/scenes/PlayScene.js` extending `Phaser.Scene` with key `'PlayState'`
- [x] Implement `init(data)` to store scene data
- [x] Implement `create()` to instantiate PlayState and wire up gameplay
- [x] Implement `update(time, delta)` to delegate to PlayState
- [x] Implement `shutdown()` to clean up PlayState

## Task 4: Fix ResultState missing Scoring import [REQ-4, D-4]
- [x] Verified: `ResultState` already imports `Scoring` from `'../play/Scoring.js'` — no fix needed

## Task 5: Register all scenes in main.js [REQ-1, D-1]
- [x] Import all scene classes into `fnf-phaser/src/main.js`
- [x] Add all scenes to the Phaser game config `scene` array (TitleState first)
- [x] Added audio and render config from the deleted Game.js

## Task 6: Delete orphaned Game.js [REQ-5, D-5]
- [x] Delete `fnf-phaser/src/Game.js`

## Task 7: Audit and fix asset fallbacks [REQ-6, D-6]
- [x] Audited all scene `preload()` methods — all reference assets that don't exist yet
- [x] Verified: TitleState, MainMenuState, FreeplayState, StoryMenuState all check `this.textures.exists()` before using textures
- [x] Verified: All scenes check `this.cache.audio.exists()` before playing audio
- [x] PlayScene has `loaderror` handler to suppress missing asset warnings
- [x] Phaser loader does not crash on missing assets — it fires loaderror and continues

## Task 8: Run tests to verify no regressions
- [x] Run `npm run test:unit` — all 2393 tests pass across 64 test files
- [x] No test failures from the changes

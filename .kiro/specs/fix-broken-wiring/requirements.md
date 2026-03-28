# Requirements: Fix Broken Wiring in fnf-phaser

## Context
The fnf-phaser codebase is a Friday Night Funkin' port to Phaser 3 / JavaScript. Individual modules are well-built and tested, but the integration layer has several critical bugs that prevent the game from running. This spec addresses all identified issues.

## Requirements

### REQ-1: Scene Registration
All Phaser scenes must be registered with the game instance so that `scene.start('SceneName')` calls work.

**Acceptance Criteria:**
- All scene classes (TitleState, MainMenuState, FreeplayState, StoryMenuState, OptionsState, GameOverState, ResultState, PauseSubState, LoadingState, ReplayBrowserState, BootScene) are registered in the Phaser game config in `main.js`
- Scene transitions between all states work without errors

### REQ-2: PlayState Must Be a Phaser Scene
PlayState is currently a plain class, not a `Phaser.Scene`. Other scenes call `this.scene.start('PlayState', ...)` which requires it to be a registered Phaser scene.

**Acceptance Criteria:**
- Create a `PlayScene` wrapper that extends `Phaser.Scene` and delegates to `PlayState`
- `PlayScene` is registered in the game config
- `FreeplayState`, `StoryMenuState`, `GameOverState` transitions to `'PlayState'` work correctly

### REQ-3: Fix Conductor.getInstance() Call
`PlayState` constructor calls `Conductor.getInstance()` but the Conductor class only exposes a `static get instance()` getter, not a `getInstance()` method.

**Acceptance Criteria:**
- Add a static `getInstance()` method to Conductor that returns `Conductor.instance`, OR
- Change the call in PlayState to use `Conductor.instance`
- No runtime errors when PlayState is instantiated

### REQ-4: Fix Missing Scoring Import in ResultState
`ResultState.init()` references `Scoring.calculateRank()` but does not import `Scoring`.

**Acceptance Criteria:**
- `ResultState` imports `Scoring` from `'../play/Scoring.js'`
- `Scoring.calculateRank(tallies)` call works at runtime

### REQ-5: Remove Orphaned Game.js
`Game.js` exports `createGameConfig` and `initGame` but nothing imports it. `main.js` duplicates the config inline.

**Acceptance Criteria:**
- `Game.js` is deleted
- `main.js` is the single source of truth for game config

### REQ-6: Graceful Asset Fallbacks
All `assets/` subdirectories only contain `.gitkeep` files. Scenes that preload assets will trigger load errors for missing files.

**Acceptance Criteria:**
- Scenes that reference assets handle missing textures/audio gracefully (fallback graphics, no crashes)
- BootScene properly handles the case where no assets exist
- The game can start and navigate through TitleState → MainMenuState without asset-related crashes

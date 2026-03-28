# Design: Fix Broken Wiring in fnf-phaser

## Overview
This design addresses the integration issues preventing the fnf-phaser game from running. The fixes are minimal and surgical — we're wiring up what already exists, not rewriting anything.

## Design Decisions

### D-1: Scene Registration in main.js (REQ-1)
Import all scene classes into `main.js` and pass them in the `scene` array of the Phaser config. Phaser auto-starts the first scene in the array.

**Approach:** Import all scenes, list them in config. TitleState stays first.

### D-2: PlayScene Wrapper (REQ-2)
Create `fnf-phaser/src/scenes/PlayScene.js` — a thin `Phaser.Scene` that:
- Extends `Phaser.Scene` with key `'PlayState'` (to match existing `scene.start('PlayState', ...)` calls)
- In `init(data)`, creates a `PlayState` instance passing `this` as the scene
- In `create()`, calls `playState.init(data)`, `createStrumlines()`, `setupCameras()`, `generateNotes()`, `startCountdown()`
- In `update(time, delta)`, delegates to `playState.update(time, delta)`
- In `shutdown()`, calls `playState.destroy()`

This preserves the existing PlayState logic and tests while making it work as a Phaser scene.

### D-3: Conductor.getInstance() (REQ-3)
Add a static `getInstance()` method to Conductor that returns `Conductor.instance`. This is the least disruptive fix — it doesn't break any existing code or tests that use `Conductor.instance`.

### D-4: ResultState Scoring Import (REQ-4)
Add `import Scoring from '../play/Scoring.js';` to ResultState.

### D-5: Delete Game.js (REQ-5)
Delete the orphaned file. No imports reference it.

### D-6: Asset Fallbacks (REQ-6)
The scenes already have some fallback logic (TitleState creates text when logo texture is missing, MainMenuState creates gradient when bg is missing). We need to:
- Wrap all `preload()` asset loads in try/catch or use Phaser's `load.on('loaderror')` to suppress missing asset errors
- Ensure all scenes that reference textures check `this.textures.exists()` before using them
- Ensure all scenes that reference audio check `this.cache.audio.exists()` before playing

Most scenes already do this. We'll audit and fix the ones that don't.

## Files to Modify
- `fnf-phaser/src/main.js` — register all scenes
- `fnf-phaser/src/core/Conductor.js` — add `getInstance()` static method
- `fnf-phaser/src/ui/ResultState.js` — add Scoring import
- `fnf-phaser/src/play/PlayState.js` — fix `Conductor.getInstance()` call

## Files to Create
- `fnf-phaser/src/scenes/PlayScene.js` — Phaser.Scene wrapper for PlayState

## Files to Delete
- `fnf-phaser/src/Game.js` — orphaned, unused

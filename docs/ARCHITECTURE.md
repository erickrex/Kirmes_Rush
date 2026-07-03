# Architecture

## Startup Flow

The application boots via `src/main.js` (App Bootstrap). Before any Phaser scene starts, three global services are initialized in order:

1. `SaveManager.getInstance().init()` — loads persisted options, scores, and progress from localStorage.
2. `TouchDeviceDetector.detect()` — detects touch capability for the current device.
3. `OrientationOverlay.init()` — creates the DOM-based orientation prompt overlay.

After initialization, `new Phaser.Game(config)` is created with `TitleState` as the first scene. An `OrientationOverlay.destroy()` handler is registered on the Phaser `DESTROY` event.

There is no BootScene. All boot responsibilities live in `main.js`.

## Scene Lifecycle

Every scene follows a consistent lifecycle contract:

- `create()` sets up the scene's game objects, input listeners, EventBus subscriptions, and timers.
- `shutdown()` tears down everything registered in `create()`: removes keyboard listeners, EventBus subscriptions, cancels timers/tweens, and nulls owned Phaser game object references.
- Each shutdown handler calls `this.events?.off('shutdown', this.shutdown, this)`.

Scenes must not re-initialize boot services (`SaveManager.init`, `TouchDeviceDetector.detect`, `OrientationOverlay.init`). These run once in `main.js`.

## Loader Ownership

`LoadingState` is the only scene that provides asset-loading progress UI and loader event management. Other scenes delegate to it via `scene.start('LoadingState', config)` with a `prepareCallback` that resolves assets and next-scene data.

## Gameplay HUD Visual Features

`PlayState` (`src/play/PlayState.js`) drives a set of HUD overlays that render fixed to the screen on the HUD camera (`camHUD`, the `scrollFactor`-0 layer owned by the camera controller). All of them are created in `createHUDDisplay(config)`, updated each frame from the `update(delta)` loop, and destroyed on `shutdown`/`destroy`.

- **ComboPopup** (`src/play/ComboPopup.js`) — shows judgement text and combo numbers when notes are hit. `createHUDDisplay` constructs it, registers its game objects on `camHUD` via the `registerObject` hook, and applies the `comboDisplay` save option through `setShowComboNumbers`. It is driven by the `NOTE_HIT` event handler, which calls `showJudgement(judgement, combo, x, y)` with the single-source-of-truth combo value. Game objects are created lazily on first hit and pooled; `update(delta)` syncs their `x/y/alpha/scale/visible` state and recycled records are hidden rather than re-created. `destroy()` tears down all active and pooled game objects.

- **NoteSplash** (`src/play/NoteSplash.js`) — spawns a splash effect at the player receptors on perfect (`sick`/`killer`) hits. `createHUDDisplay` constructs it and registers it on `camHUD`. It prefers a loaded note-style splash atlas and falls back to a generated burst texture. The `NOTE_HIT` handler calls `spawnAtReceptor(receptor, direction)` using the receptor carried in the event payload. Splashes are gated off via `setEnabled(false)` when the note style reports them disabled (`areSplashesEnabled`) or no splash asset is available, in which case it spawns no game objects. `update(delta)` syncs `x/y/alpha/scale/rotation/visible`; `destroy()` releases all game objects.

- **HealthIcon** (`src/play/HealthIcon.js`) — two instances (player and opponent) created by `createHealthIcons`/`createHealthIcon` and registered on `camHUD`. Each is configured from `CharacterRegistry.getHealthIconData(charId)` (scale/offsets/flip/pixel) and given a guaranteed-visible texture via `acquireHealthIconTexture` (`src/play/HealthIconTextures.js`): a real loaded icon when present, otherwise a generated color-coded placeholder. Each frame the update loop calls `update(delta, health)` and `updatePosition(healthBar)` against the scene-owned `HealthBar`, and the icons bop on the step/beat cadence via `onStepHit`/`onBeatHit`. Both icons are destroyed on shutdown.

## Scene Transitions

Scene-to-scene navigation routes through a single `Transitions` helper (`src/graphics/Transitions.js`) rather than ad-hoc `cameras.main.fadeOut(...)` calls.

`BaseMenuState` (`src/ui/BaseMenuState.js`) owns the shared mechanism: it lazily constructs a `Transitions` instance via `getTransitions()`, exposes `fadeIn()` for entry, and implements `transitionToScene(sceneKey, data)` as `await transitions.transitionOut({ type: FADE, duration: 500 })` followed by `scene.start(sceneKey, data)`. The default fade is visually equivalent to the previous 500ms camera fade, so navigation behavior is preserved. The transition is interruption-safe: if the scene shuts down mid-transition, `shutdown()` destroys and clears the `Transitions` instance (cancelling in-flight tweens and removing the overlay without throwing), and the pending navigation is skipped.

Scenes that do not extend `BaseMenuState` — `TitleState`, `ResultState`, `GameOverState`, and `ReplayBrowserState` — use a local `Transitions` instance through the same `getTransitions()`/`transitionToScene` contract, preserving the target scene and data payload.

## Gameplay State Ownership

`GameplayState` (`src/play/GameplayState.js`, created by `createGameplayState(context)`) is the single source of truth for gameplay bookkeeping: `health`, `score`, `combo`, `maxCombo`, and `tallies`.

- `PlayState` does not store these values independently. It exposes them as read-through accessors (getters/setters) that delegate to `_gameplayState`, preserving the public API used by the HUD, results flow, and tests.
- `NoteProcessor` (`src/play/NoteProcessor.js`) routes all state mutations exclusively through `GameplayState` methods (`updateScore`, `updateCombo`, `updateTallies`, `updateHealth`). It performs no direct mutation of parallel `playState.score/combo/maxCombo/tallies/health` fields, so each hit/miss updates state exactly once.
- The combo-break decision lives in exactly one place: `Scoring.doesJudgementBreakCombo` (`src/play/Scoring.js`), consumed only by `GameplayState.updateCombo`. There is no duplicate inline combo-break logic in the play modules.

## Shared Type Layer

`src/types.js` is the single canonical location for all cross-module JSDoc typedefs. No other source file should define a `@typedef` with the same name as one in `types.js`. Modules import shared types via `/** @import { TypeName } from '../types.js' */`.

## Hidden Mode Policy

Hidden-mode scenes (StoryMenuState, FreeplayState, ReplayBrowserState) exist in the codebase and are reachable at runtime but are not part of the primary shipped user flow. They follow the same lifecycle and type annotation rules as shipped-path scenes.

## Verification Commands

```bash
npm run test            # Unit tests (vitest)
npm run test:integration # Integration tests
npm run lint            # ESLint (zero errors, zero warnings)
npm run typecheck       # TypeScript --noEmit (zero diagnostics)
npm run build           # Production build (vite)
```

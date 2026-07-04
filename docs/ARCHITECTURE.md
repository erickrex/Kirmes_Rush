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

## Rhythm Framework (`src/rhythm/`)

The `src/rhythm/` module is a self-contained, data-driven framework for running one rhythm minigame per scene. It is separate from the `src/play/` gameplay path documented above: `src/play/` runs the scrolling-note gameplay (`PlayState`/`NoteProcessor`), while `src/rhythm/` runs discrete, cue-based minigames (tap, hold, release, flick). Both are registered as scenes in `src/main.js`.

### Composition Root

`RhythmScene` (`src/rhythm/scene/RhythmScene.js`) is the composition root and the only Phaser scene in the framework. It receives a per-run `RhythmSession` via `scene.start('RhythmScene', { session })`, then in `create()` instantiates and wires every framework component:

- `RhythmClock` (`src/rhythm/core/RhythmClock.js`) — converts beats to Song_Position (ms) using the session's BPM/offset/timeChanges.
- `CueTimeline` (`src/rhythm/core/CueTimeline.js`) — bakes the session's timeline entries into resolved cues and Expectations against the clock.
- `CueScheduler` (`src/rhythm/core/CueScheduler.js`) — fires presentation cues and opens/closes judgement windows, emitting on a per-run `Phaser.Events.EventEmitter` (not the global EventBus) so subscriptions are isolated and removable on teardown.
- `CueJudger` (`src/rhythm/core/CueJudger.js`) — judges buffered gestures against open windows and records resolving judgements into scoring.
- `RhythmScoring` (`src/rhythm/core/RhythmScoring.js`) — accumulates counts/accuracy and produces the end-of-run summary.
- `TouchGestureRecognizer` (`src/rhythm/input/TouchGestureRecognizer.js`) + `RhythmInputManager` (`src/rhythm/input/RhythmInputManager.js`) — capture canvas pointer gestures and anchor each to a Song_Position.
- The resolved Minigame controller (see below).

### Per-frame Loop

Each frame, `update()` derives Song_Position from `AudioManager.currentTime` (never an integrated clock, so pause/resume and resync are respected), then: `clock.update()` → `inputManager.syncClock()` → `recognizer.poll()` → `scheduler.update()` → judge each buffered gesture → `controller.update()` → run-end detection. On run end (audio complete or all timeline events consumed), it starts `ResultState` with the `RhythmScoring` summary.

### Data-driven Minigames

`RhythmSession` (`src/rhythm/core/RhythmSession.js`) is an immutable per-run value object resolved once by `LoadingState`'s `prepareCallback`. It carries the validated `MinigameDefinition`, timeline, clock config, resolved audio keys, scoring config, and the controller class. It instantiates no framework objects itself.

`MinigameRegistry` (`src/rhythm/minigames/MinigameRegistry.js`) maps a definition `id` to its controller class and validates definition JSON (`assets/data/rhythm/minigames/*.json`) before use, rejecting invalid definitions with field-level errors. `defaultMinigameRegistry.js` provides the populated registry. `dispatchCueAction` resolves a cue/judgement `action` string to a controller method and throws a descriptive error naming the missing method rather than failing silently.

`RhythmMinigame` (`src/rhythm/minigames/RhythmMinigame.js`) is the base controller class. Concrete controllers (`TapClapGame`, `FillBotGame`, `ReleaseGame`, `FlickRallyGame`) subclass it and declare only presentation and gesture meaning — the framework owns all timing and judgement. Controllers track every game object they create via `own()` so `destroy()` releases them on scene shutdown, mirroring the `create()`/`shutdown()` ownership contract used elsewhere.

`MinigameSelectState` (`src/rhythm/ui/MinigameSelectState.js`) is the selection UI that routes into a run.

### Teardown and Mobile Canvas

`RhythmScene.shutdown()` is idempotent and registered on Phaser's `shutdown` event. It detaches the recognizer (zero remaining pointer listeners), removes the per-run emitter subscriptions, cancels timers/tweens, restores the canvas `touch-action` captured on `create()`, removes the raw DOM audio-unlock listeners, destroys the controller and clock, stops/destroys audio, and nulls every owned reference. The scene sets the canvas `touch-action: none` for the run and reuses `AudioManager` unlock handling to resume a suspended Web Audio context on the first user gesture. It runs in the portrait 720x1280 canvas configured in `src/main.js`.

## Shared Type Layer

`src/types.js` is the single canonical location for all cross-module JSDoc typedefs. No other source file should define a `@typedef` with the same name as one in `types.js`. Modules import shared types via `/** @import { TypeName } from '../types.js' */`.

## Hidden Mode Policy

Hidden-mode scenes (StoryMenuState, FreeplayState, ReplayBrowserState) exist in the codebase and are reachable at runtime but are not part of the primary shipped user flow. They follow the same lifecycle and type annotation rules as shipped-path scenes.

## Verification Commands

This project uses `pnpm` (not `npm`; see `AGENTS.md`).

```bash
pnpm test               # Unit tests (vitest)
pnpm run test:integration # Integration tests
pnpm run lint           # ESLint (zero errors, zero warnings)
pnpm run typecheck      # TypeScript --noEmit (zero diagnostics)
pnpm build              # Production build (vite)
```

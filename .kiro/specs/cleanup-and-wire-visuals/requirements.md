# Requirements Document

## Introduction

This specification covers a focused cleanup-and-completion pass on the `fnf-phaser` codebase. The current build is green (lint, typecheck, unit tests, integration tests, build all pass), but a review surfaced three classes of problems: (1) tested-but-unwired "orphan" code, (2) an incomplete PlayState extraction that left two parallel gameplay-state bookkeeping systems running, and (3) minor maintenance debt (a duplicate empty `util/` folder, dead exports, and an unchunked Phaser bundle).

The goal is to remove the genuinely dead code, finish wiring the four orphaned visual features into the live gameplay/scene flow so they actually render, and collapse the duplicated gameplay state into a single source of truth. All existing verification gates must remain green at the end.

## Glossary

- **Runtime_Graph**: The set of modules transitively imported starting from `src/main.js`. A module is "wired" only if it is reachable from this graph at runtime (test-only imports do not count).
- **Orphan_Module**: A source module that is unit-tested but never imported by the Runtime_Graph.
- **PlayState**: The gameplay scene-state class in `src/play/PlayState.js` that orchestrates gameplay submodules.
- **GameplayState_Module**: The module created by `createGameplayState(context)` in `src/play/GameplayState.js` that owns health/score/combo/tallies state and update methods.
- **NoteProcessor_Module**: The module created by `createNoteProcessor(context)` in `src/play/NoteProcessor.js` that handles note hit/miss/opponent logic.
- **HUD_Camera**: The `camHUD` camera created by `CameraController`, on which fixed UI overlays render with `scrollFactor` 0.
- **ComboPopup**: `src/play/ComboPopup.js` — a pooled manager that tracks judgement/combo-number popup state but currently creates no Phaser game objects.
- **NoteSplash**: `src/play/NoteSplash.js` — a pooled manager that tracks splash effect state but currently creates no Phaser game objects.
- **HealthIcon**: `src/play/HealthIcon.js` — a `FunkinSprite` subclass for character icons on the health bar; its texture-loading methods are currently stubs.
- **Transitions**: `src/graphics/Transitions.js` — a render-capable scene transition helper (fade/slide/zoom/etc.) currently not used by any scene.
- **Generated_Texture_Pattern**: The existing approach in `src/play/GeneratedGameplaySkin.js` of generating placeholder textures via `scene.add.graphics().generateTexture()` when real atlas assets are not available.
- **Verification_Gates**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, and `npm run build`.

## Requirements

### Requirement 1: Remove Confirmed Dead Code

**User Story:** As a developer, I want genuinely unused modules and folders removed, so that the codebase only contains code that is reachable or intentionally retained.

#### Acceptance Criteria

1. THE codebase SHALL delete `src/levels/index.js` (an orphan barrel re-exporting `LevelSystem`, with zero importers in src and tests).
2. THE codebase SHALL delete the empty `src/util/` directory (containing only `.gitkeep`), retaining the populated `src/utils/` directory.
3. THE codebase SHALL delete `src/data/registries/SongRegistry.js` and its test `tests/SongRegistry.test.js`, because song/chart loading is handled by the levels pipeline (`LevelSessionBuilder` + `ChartParser` + `LevelContentResolver`) and `SongRegistry` has zero runtime importers.
4. THE codebase SHALL delete `src/data/parsers/SparrowParser.js` and its test `tests/SparrowParser.test.js`, because it has zero runtime importers and is superseded by the active asset/atlas path.
5. WHEN a module is deleted, THE codebase SHALL remove every remaining import or reference to it so that no dangling import exists.
6. WHEN dead-code removal is complete, ALL Verification_Gates SHALL pass.

### Requirement 2: Wire In the Combo Popup

**User Story:** As a player, I want to see judgement text and combo numbers pop up when I hit notes, so that gameplay feedback is visible.

#### Acceptance Criteria

1. THE PlayState SHALL create a ComboPopup instance during gameplay setup and register it on the HUD_Camera so popups render fixed to the screen.
2. WHEN a note is hit and a judgement is produced, THE PlayState SHALL call `ComboPopup.showJudgement(judgement, combo, x, y)` with the current combo value.
3. THE ComboPopup SHALL create real Phaser game objects for active judgement and combo-number sprites (using loaded note-style assets where available, otherwise Generated_Texture_Pattern or Phaser Text), and SHALL apply the tracked `x`, `y`, `alpha`, `scale`, and `visible` state to those game objects every `update(delta)`.
4. WHEN a popup's lifetime expires, THE ComboPopup SHALL hide/recycle its game object so no leaked game objects accumulate.
5. WHEN the `comboDisplay` save option is disabled, THE PlayState SHALL NOT show combo numbers (judgement display still governed by existing HUD config).
6. THE PlayState SHALL call `ComboPopup.update(delta)` from its update loop and `ComboPopup.destroy()` on shutdown.
7. WHEN ComboPopup is destroyed, THE ComboPopup SHALL destroy all pooled and active Phaser game objects.

### Requirement 3: Wire In Note Splashes

**User Story:** As a player, I want a splash effect on perfect (sick/killer) note hits, so that high-accuracy hits feel rewarding.

#### Acceptance Criteria

1. THE PlayState SHALL create a NoteSplash instance during gameplay setup and register it on the HUD_Camera (or the same layer as the player strumline receptors).
2. WHEN a note is hit with a `sick` or `killer` judgement, THE PlayState SHALL call `NoteSplash.spawnAtReceptor(receptor, direction)` at the matching player receptor position.
3. THE NoteSplash SHALL create real Phaser game objects for active splashes (using loaded note-style splash assets where available, otherwise Generated_Texture_Pattern), and SHALL apply tracked `x`, `y`, `alpha`, `scale`, `rotation`, and `visible` state every `update(delta)`.
4. WHEN the note style reports splashes disabled (`areSplashesEnabled` is false) OR no splash asset is available, THE NoteSplash SHALL be disabled via `setEnabled(false)` and spawn no game objects.
5. THE PlayState SHALL call `NoteSplash.update(delta)` from its update loop and `NoteSplash.destroy()` on shutdown.
6. WHEN NoteSplash is destroyed, THE NoteSplash SHALL destroy all pooled and active Phaser game objects.

### Requirement 4: Wire In Health Icons

**User Story:** As a player, I want character icons on the health bar that react to my health, so that I can see who is winning at a glance.

#### Acceptance Criteria

1. THE PlayState (or HealthBar owner) SHALL create two HealthIcon instances — one for the player and one for the opponent — and register them on the HUD_Camera.
2. THE HealthIcon SHALL be configured from `CharacterRegistry.getHealthIconData(charId)` for the active player and opponent characters.
3. WHEN a real icon texture is loaded for a character, THE HealthIcon SHALL display it; otherwise THE HealthIcon SHALL display a Generated_Texture_Pattern placeholder so an icon is always visible.
4. WHEN health changes, THE HealthIcon SHALL update its state (winning/idle/losing) and position relative to the health bar fill via `updateHealthIcon(health)` / `updatePosition(healthBar)`.
5. WHEN a beat occurs, THE HealthIcon SHALL bop (scale pulse) and lerp back to its target size.
6. THE PlayState SHALL update both HealthIcons each frame and destroy them on shutdown.

### Requirement 5: Wire In Scene Transitions

**User Story:** As a player, I want consistent animated transitions between scenes, so that screen changes feel polished.

#### Acceptance Criteria

1. THE menu transition path SHALL route through a single shared mechanism backed by Transitions, replacing ad-hoc `cameras.main.fadeOut(...)` duplication in `BaseMenuState.transitionToScene`.
2. WHEN a scene begins, THE transitioning-in scene SHALL play a Transitions "in" animation (e.g., `transitionIn`) before handing control to the player.
3. WHEN `BaseMenuState.transitionToScene(sceneKey, data)` is called, THE BaseMenuState SHALL play a Transitions "out" animation and start the target scene only after the animation completes.
4. THE Transitions instance owned by a scene SHALL be destroyed on that scene's `shutdown`, removing any overlay/tween it created.
5. THE existing transition behavior contract SHALL be preserved: every current `transitionToScene` caller still navigates to the same target scene with the same data payload.
6. IF a transition is interrupted by scene shutdown, THEN THE Transitions instance SHALL cancel in-flight tweens and destroy its overlay without throwing.

### Requirement 6: Single Source of Truth for Gameplay State

**User Story:** As a developer, I want one authoritative gameplay-state owner, so that score/combo/health are not tracked in two places that can silently diverge.

#### Acceptance Criteria

1. THE GameplayState_Module SHALL be the single owner of `health`, `score`, `combo`, `maxCombo`, and `tallies` during gameplay.
2. THE NoteProcessor_Module SHALL update gameplay state exclusively through GameplayState_Module methods (`updateScore`, `updateCombo`, `updateTallies`, `updateHealth`) and SHALL NOT directly mutate parallel `playState.score`/`combo`/`maxCombo`/`tallies`/`health` fields.
3. WHERE PlayState exposes `score`, `combo`, `maxCombo`, `health`, and `tallies` for HUD/result consumption, THOSE values SHALL be backed by (read from) the GameplayState_Module rather than maintained as an independent copy.
4. WHEN a note is hit or missed, THE gameplay state SHALL be updated exactly once (no double counting) for score, combo, tallies, and health.
5. THE combo-break decision SHALL be defined in exactly one place (`Scoring.doesJudgementBreakCombo`) and consumed by GameplayState_Module; duplicate inline combo-break logic SHALL be removed.
6. THE externally observable scoring/combo/health behavior of a played song SHALL remain unchanged (same final score, rank, accuracy, and tallies for the same inputs).
7. WHEN this change is complete, ALL Verification_Gates SHALL pass, including `tests/PlayState.test.js`, `tests/Scoring.test.js`, and `tests/NoteProcessor.test.js` (updated only as needed to reflect the single-owner contract).

### Requirement 7: Remove Dead Exports

**User Story:** As a developer, I want exported symbols that nothing imports to be removed or made internal, so that the public surface reflects real usage.

#### Acceptance Criteria

1. THE `MANIFEST_BASE_PATH` export in `src/levels/LevelContentResolver.js` SHALL be removed or made non-exported if it has no importer outside its own module.
2. WHERE the granular builder exports in `src/levels/AssetManifestBuilder.js` (`buildCharacterEntries`, `buildStageEntries`, `buildNoteStyleEntries`, `deduplicateEntries`) are referenced only by tests, THEY SHALL be retained as exports only if their tests are retained; otherwise THEY SHALL be made internal (non-exported) and the corresponding tests updated to cover behavior through the public `buildManifest`/`buildPrepareCallback` surface.
3. THE `buildManifest` and `buildPrepareCallback` exports SHALL be retained (consumed by `LevelSelectState` and integration tests).
4. WHEN dead-export cleanup is complete, `npm run lint` SHALL report zero unused-variable/import warnings and ALL Verification_Gates SHALL pass.

### Requirement 8: Bundle Chunking

**User Story:** As a developer, I want the Phaser engine split into its own chunk, so that the production build no longer emits an oversized-chunk warning and app code can cache separately from the engine.

#### Acceptance Criteria

1. THE Vite build configuration SHALL define `build.rollupOptions.output.manualChunks` so that the `phaser` dependency is emitted as a separate chunk from application code.
2. WHEN `npm run build` runs, THE build SHALL complete successfully and SHALL NOT emit the "Some chunks are larger than 1500 kB" warning for the application chunk (the engine chunk may remain large but is isolated).
3. THE runtime behavior of the built app SHALL remain unchanged (the app boots to TitleState as before).

### Requirement 9: Documentation Alignment

**User Story:** As a developer, I want the architecture docs to reflect the wired-in features and single-owner state model, so that the docs match the implementation.

#### Acceptance Criteria

1. THE `fnf-phaser/docs/ARCHITECTURE.md` SHALL be updated to describe the HUD visual feature set (combo popups, note splashes, health icons), the Transitions-backed scene transition mechanism, and the GameplayState_Module single-owner contract.
2. THE documentation SHALL NOT reference any module deleted under Requirement 1.

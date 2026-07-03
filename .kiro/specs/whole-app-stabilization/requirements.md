# Requirements Document

## Introduction

The fnf-phaser application currently compiles and runs but carries significant maintenance debt: 1,584 typecheck errors across ~55 files, 38 lint errors, conflicting typedef families, dead startup code, inconsistent scene lifecycles, zero CI coverage, and empty documentation. This stabilization effort brings the entire app — including hidden modes — to a fully green baseline under the existing strict JS/JSDoc setup without adding new features or altering gameplay behavior.

## Glossary

- **App_Bootstrap**: The one-time initialization sequence in `src/main.js` that runs before any Phaser scene starts, responsible for initializing global services.
- **BootScene**: The dead startup scene (`src/scenes/BootScene.js`) that duplicates LoadingState functionality and has no active callers in the shipped runtime path.
- **TitleState**: The canonical first scene displayed when the game launches (`src/ui/TitleState.js`).
- **LoadingState**: The canonical loading/progress screen scene (`src/ui/LoadingState.js`) used for asset loading between scene transitions.
- **PlayScene**: The gameplay orchestration scene (`src/scenes/PlayScene.js`) that manages the active play session.
- **Scene_Lifecycle**: The Phaser scene lifecycle consisting of `init`, `preload`, `create`, `update`, and `shutdown` hooks.
- **Shared_Type_Layer**: The canonical shared typedef module at `src/types.js` that defines cross-module JSDoc type contracts.
- **Typecheck_Baseline**: The state where `npm run typecheck` (tsc --noEmit) reports zero diagnostics.
- **Lint_Baseline**: The state where `npm run lint` reports zero errors and zero warnings.
- **CI_Pipeline**: A GitHub Actions workflow that runs unit tests, integration tests, lint, typecheck, and build on every change affecting fnf-phaser.
- **Registry**: The base data registry class (`src/core/Registry.js`) and its config-driven factory `createRegistry` that provide typed entry loading and caching.
- **Hidden_Mode**: A scene that exists in the codebase and is reachable at runtime but is not part of the primary shipped user flow (e.g., StoryMenuState, FreeplayState, ReplayBrowserState).
- **SaveManager**: The singleton service (`src/data/SaveManager.js`) responsible for persisting and loading user save data.
- **TouchDeviceDetector**: The utility (`src/input/TouchDeviceDetector.js`) that detects touch capability on the current device.
- **OrientationOverlay**: The UI overlay (`src/ui/OrientationOverlay.js`) that prompts users to rotate their device to the correct orientation.

## Requirements

### Requirement 1: Canonicalize Startup and Remove Dead Boot Path

**User Story:** As a developer, I want a single unambiguous startup path so that there is no confusion about which scene initializes the game and no dead code to maintain.

#### Acceptance Criteria

1. THE App_Bootstrap SHALL initialize SaveManager, TouchDeviceDetector, and OrientationOverlay exactly once before any Phaser scene starts.
2. THE App_Bootstrap SHALL register an OrientationOverlay destroy handler on the Phaser game DESTROY event.
3. WHEN the game starts, THE TitleState SHALL be the first scene displayed to the user.
4. THE Phaser game configuration SHALL NOT include BootScene in the scene list.
5. THE BootScene source file and its dedicated test file SHALL be deleted from the repository.
6. THE codebase SHALL contain zero references to the string literal "TitleScene" or "BootScene" as a scene key.
7. THE codebase SHALL contain zero comments describing BootScene as the first scene or referencing a boot-first startup contract.

### Requirement 2: Enforce Consistent Scene Lifecycle Ownership

**User Story:** As a developer, I want every scene to follow the same lifecycle contract so that resources are deterministically cleaned up and no listeners or timers leak between scene transitions.

#### Acceptance Criteria

1. THE Scene_Lifecycle of every scene that registers input listeners, timers, loader listeners, EventBus subscriptions, or window listeners SHALL include a shutdown handler that removes all such registrations.
2. WHEN a scene's shutdown handler executes, THE scene SHALL release all references to Phaser game objects, timers, tweens, and external subscriptions it owns.
3. THE LoadingState SHALL be the only scene that provides asset-loading progress UI and loader event management.
4. WHEN a gameplay or menu scene is created, THE scene SHALL NOT re-initialize SaveManager, TouchDeviceDetector, or OrientationOverlay.
5. WHILE a Hidden_Mode scene is active, THE Hidden_Mode scene SHALL follow the same lifecycle ownership rules as shipped-path scenes.

### Requirement 3: Achieve Zero-Warning Lint Baseline

**User Story:** As a developer, I want the lint baseline to be fully clean so that new lint regressions are immediately visible and the codebase style is consistent.

#### Acceptance Criteria

1. WHEN `npm run lint` is executed from the fnf-phaser directory, THE Lint_Baseline SHALL report zero errors and zero warnings.
2. THE lint fixes SHALL NOT weaken, disable, or add exemptions to any existing ESLint or Prettier rule.
3. THE lint fixes SHALL address all curly-brace violations, formatting drift, and unused variable warnings present in the current codebase.
4. THE lint fixes SHALL preserve the semantic behavior of all affected code.

### Requirement 4: Establish Canonical Shared Type Layer

**User Story:** As a developer, I want one authoritative source for cross-module type definitions so that typedef drift and conflicting type assumptions stop causing typecheck errors.

#### Acceptance Criteria

1. THE Shared_Type_Layer (`src/types.js`) SHALL be the single canonical location for all cross-module JSDoc typedefs.
2. THE Shared_Type_Layer SHALL define typedefs for: scene transition payloads, loading configuration and result shapes, replay data structures, Registry entry shapes, raw chart and metadata JSON structures, asset descriptor shapes, and audio boundary interfaces.
3. WHEN a typedef in the Shared_Type_Layer conflicts with a local typedef in another module, THE local typedef SHALL be removed and replaced with an import of the shared typedef.
4. THE Shared_Type_Layer SHALL resolve the conflicting NoteData definitions currently present in `src/types.js`, `src/play/NoteSprite.js`, and `src/data/parsers/ChartParser.js` into a single canonical definition.
5. THE Shared_Type_Layer SHALL resolve the conflicting SongMetadata definitions currently present in `src/types.js` and `src/data/parsers/ChartParser.js` into a single canonical definition.
6. THE Shared_Type_Layer SHALL resolve the conflicting ChartData definitions currently present in `src/types.js` and `src/data/parsers/ChartParser.js` into a single canonical definition.

### Requirement 5: Resolve Typecheck Debt to Zero Diagnostics

**User Story:** As a developer, I want zero typecheck errors so that the type system provides reliable safety guarantees and new type regressions are caught immediately.

#### Acceptance Criteria

1. WHEN `npm run typecheck` is executed from the fnf-phaser directory, THE Typecheck_Baseline SHALL report zero TypeScript diagnostics.
2. THE typecheck fixes SHALL NOT change the `checkJs`, `strict`, `noImplicitAny`, or `strictNullChecks` compiler options.
3. THE typecheck fixes SHALL NOT add files to the `exclude` list in `tsconfig.typecheck.json` or `jsconfig.json`.
4. THE Registry class and `createRegistry` factory SHALL have complete JSDoc type annotations for `RegistryConfig` (including `entityName` and `displayInfoFields`), generic type parameters, `getInstance()` return types, and all dynamically generated helper methods.
5. THE data layer modules (ChartParser, SparrowParser, SaveManager, and all registry implementations) SHALL use concrete JSDoc typedefs for raw input and output shapes instead of bare `Object` parameter types.
6. THE gameplay orchestration modules (PlayState, PlayScene, NoteProcessor, SongFlowController, Strumline, AudioManager, VoicesGroup, InputSystem, TouchInputController) SHALL have concrete JSDoc type annotations for scene context interfaces, method parameters, and return types.
7. THE UI and Hidden_Mode scene modules SHALL have concrete JSDoc type annotations for scene payloads, menu item models, replay data, and nullable object lifecycles.
8. IF a narrow JSDoc cast is needed at a third-party boundary (such as Phaser sound manager variants), THEN THE cast SHALL be scoped to the boundary call site and SHALL NOT propagate `any` into application code.

### Requirement 6: Align Tests with Implemented Architecture

**User Story:** As a developer, I want the test suite to verify the actual startup and lifecycle contracts so that regressions in the real architecture are caught, not regressions in deleted code.

#### Acceptance Criteria

1. WHEN BootScene is deleted, THE BootScene test file SHALL also be deleted.
2. THE test suite SHALL include tests that verify: App_Bootstrap initializes SaveManager, TouchDeviceDetector, and OrientationOverlay exactly once; OrientationOverlay is destroyed on game teardown; and no scene depends on BootScene at runtime.
3. THE test suite SHALL include tests that verify LoadingState's success path, prepareCallback failure path, asset deduplication, retry behavior, minimum-duration transition guard, and next-scene handoff.
4. WHEN `npm run test` is executed from the fnf-phaser directory, THE test suite SHALL pass with zero failures.
5. WHEN `npm run test:integration` is executed from the fnf-phaser directory, THE integration test suite SHALL pass with zero failures.
6. THE test suite SHALL suppress expected error-path console output (via spy or stub) so that successful test runs produce clean, readable output.

### Requirement 7: Establish CI Pipeline

**User Story:** As a developer, I want automated CI checks on every change so that regressions in tests, lint, types, or build are caught before merge.

#### Acceptance Criteria

1. THE CI_Pipeline SHALL be defined as a GitHub Actions workflow file in the repository.
2. WHEN a change affecting fnf-phaser is pushed or a pull request is opened, THE CI_Pipeline SHALL execute: `npm run test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`, and `npm run build`.
3. IF any CI_Pipeline step fails, THEN THE CI_Pipeline SHALL report the failure and block the workflow from succeeding.
4. THE CI_Pipeline SHALL run in the `fnf-phaser` working directory.

### Requirement 8: Provide Accurate Architecture Documentation

**User Story:** As a developer, I want documentation that matches the implemented architecture so that onboarding and maintenance decisions are based on accurate information.

#### Acceptance Criteria

1. THE repository SHALL contain an architecture document at `fnf-phaser/docs/ARCHITECTURE.md`.
2. THE architecture document SHALL describe: the startup flow (App_Bootstrap → TitleState), the loader ownership contract (LoadingState), the scene lifecycle rules, the shared type layer policy, the Hidden_Mode policy, and the verification commands.
3. THE fnf-phaser README SHALL be updated to reference the architecture document and accurately describe the project's verification status.
4. THE documentation SHALL contain zero references to BootScene as an active component.

### Requirement 9: Maintain Feature Parity and Preserve All Existing Functionality

**User Story:** As a developer, I want the stabilization effort to maintain exact feature parity with the current codebase so that no shipped or hidden-mode behavior changes for end users, and modules reserved for future work remain untouched.

#### Acceptance Criteria

1. THE stabilization effort SHALL NOT add new gameplay features or alter scoring, progression, or input behavior.
2. THE stabilization effort SHALL preserve all currently shipped scenes and all Hidden_Mode scenes.
3. WHEN `npm run build` is executed from the fnf-phaser directory, THE build SHALL succeed without errors.
4. THE stabilization effort SHALL NOT change the tracked `fnf-phaser/dist` policy or build output structure.
5. THE stabilization effort SHALL NOT modify, delete, or refactor modules that are commented out, stubbed, or explicitly marked as reserved for future use.
6. THE stabilization effort SHALL maintain exact feature parity with the current codebase — every runtime code path that exists today (excluding the deleted BootScene) SHALL continue to exist and behave identically after stabilization.

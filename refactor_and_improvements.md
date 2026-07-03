# fnf-phaser Whole-App Stabilization Plan

## Summary
- Goal: bring the entire `fnf-phaser` app, including hidden modes, to a fully green baseline under the current strict JS/JSDoc setup.
- Chosen direction: keep the current Title-first startup model, preserve hidden modes, and remove dead boot-path scaffolding instead of reviving it.
- End state: `npm test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`, and `npm run build` all pass from a clean checkout; runtime/docs/test architecture all match each other.

## Implementation Changes
1. Canonicalize startup and delete the dead boot path.
- Make `TitleState` the only startup scene and remove `BootScene` from the runtime scene list.
- Delete `BootScene` and its dedicated tests because its loading UI/workflow is already duplicated by `LoadingState` and it has no active callers.
- Move one-time boot responsibilities into app bootstrap: `SaveManager.init()`, `TouchDeviceDetector.detect()`, and `OrientationOverlay.init()` happen once when the game starts; `OrientationOverlay.destroy()` stays on game teardown.
- Remove all `TitleScene` strings, "BootScene is first scene" comments, and any gameplay-side fallback logic that only exists because the boot contract is currently ambiguous.

2. Make lifecycle ownership explicit and consistent across all scenes.
- Keep `LoadingState` as the only loading screen / loader scene and treat it as the canonical asset-loading contract for both shipped and hidden flows.
- Ensure every scene that owns input listeners, timers, loader listeners, EventBus subscriptions, or window listeners registers `shutdown` exactly once and fully tears down its resources there.
- Remove scene-local boot responsibilities from gameplay scenes once bootstrap owns them, especially redundant touch/orientation initialization.
- Preserve hidden modes (`StoryMenuState`, `FreeplayState`, `ReplayBrowserState`, `PauseSubState`, etc.) but bring them onto the same lifecycle rules as the shipped path.

3. Clean the current lint baseline and make it stay clean.
- Fix all existing ESLint/Prettier issues, including curly-brace violations, formatting drift, and unused vars in active modules.
- Treat zero warnings as the target, not just zero errors, so the green baseline is actually maintainable.
- Keep formatter behavior unchanged; do not weaken rules or carve out exemptions for problem files.
- Normalize nearby touched code while fixing lint so later type-cleanup work does not reintroduce style churn.

4. Establish one canonical shared type layer and stop type drift.
- Expand the existing `src/types.js` into the canonical shared typedef module instead of creating a second parallel type system.
- Move shared payload and data-shape typedefs there: scene transition payloads, loading config/result shapes, replay data, registry entry shapes, raw chart/metadata JSON, asset descriptors, and audio boundary interfaces.
- Remove duplicated local typedefs when they overlap with shared shapes and are causing drift or conflicting assumptions.
- Keep `checkJs`, `strict`, `noImplicitAny`, `strictNullChecks`, and the current include set unchanged; do not solve the problem by excluding files or loosening compiler options.

5. Resolve typecheck debt in the order that unlocks the most files.
- Fix the registry foundation first: declare `RegistryConfig` completely, type `entityName`/`displayInfoFields`, annotate `getInstance()`, and replace untyped prototype mutation with explicitly declared helper surfaces while preserving runtime method names.
- Fix the data layer next: `ChartParser`, `SparrowParser`, `SaveManager`, and all registries get concrete raw-input/output typedefs so downstream code stops inheriting `Object`, implicit `any`, and nullable ambiguity.
- Fix gameplay orchestration after the data layer: `PlayState`, `PlayScene`, `NoteProcessor`, `SongFlowController`, `Strumline`, audio modules, and input modules get concrete scene/context interfaces and Phaser-boundary casts only where upstream Phaser typings are incomplete.
- Fix UI and hidden-mode scenes last: annotate scene payloads, arrays, menu item models, replay data, and nullable object lifecycles until every scene is type-clean.
- Allow narrow local JSDoc casts only at third-party boundaries such as Phaser sound manager variants; do not spread `any` through application code.

6. Align tests, docs, and CI with the real architecture.
- Replace the removed `BootScene` unit coverage with `LoadingState` and bootstrap-focused tests that verify the actual startup contract.
- Add or update tests for: single-run bootstrap init, persistent orientation overlay behavior, loading prepare/error/retry flow, deterministic scene shutdown cleanup, HUD camera registration, and hidden-mode regressions.
- Silence expected error-path console noise in tests by spying/stubbing console methods where failures are intentional; successful runs should be readable.
- Add a GitHub Actions workflow for `fnf-phaser` that runs unit tests, integration tests, lint, typecheck, and build on changes affecting the app.
- Add `fnf-phaser/docs/ARCHITECTURE.md` and update the root README so startup flow, loader ownership, hidden-mode policy, and verification status are accurate and no linked docs are missing.

## Public Interfaces / Contracts
- Startup contract: `TitleState` is the canonical entry scene; `LoadingState` is the canonical loader scene.
- Shared boot services initialize once at app bootstrap and are not re-owned by individual gameplay/menu scenes.
- `src/types.js` becomes the canonical shared typedef surface for cross-module contracts.
- Registry helper names remain behaviorally the same, but their config and return types become explicitly declared.
- Scene payloads for loading, pause, result, replay, and level selection become explicit typed contracts instead of anonymous object shapes.

## Test Plan
- Green gates from a clean checkout: `npm test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Startup tests: verify bootstrap initializes save/touch/orientation once, destroys overlay on teardown, and never depends on `BootScene`.
- Loader tests: verify `LoadingState` success path, `prepareCallback` failure path, asset deduping, retry behavior, min-duration transition guard, and next-scene handoff.
- Gameplay tests: verify HUD-only objects and note spawns stay on the HUD camera, replay/touch overlays are layered correctly, and scene shutdown removes listeners/timers deterministically.
- Hidden-mode tests: keep existing behavior for replay browser, pause, freeplay, story, options, and result scenes while bringing them to lint/typecheck cleanliness.
- Acceptance criteria: zero lint errors, zero lint warnings, zero TypeScript diagnostics, no `TitleScene` references, no runtime `BootScene` path, and docs that match the implemented architecture.

## Assumptions and Defaults
- Preserve all currently shipped and hidden modes; this plan does not prune feature surface.
- Do not add new gameplay features or alter scoring/progression behavior beyond fixing initialization, lifecycle, and maintenance issues.
- Leave the tracked `fnf-phaser/dist` policy unchanged in this effort; build output is a verification gate, not a repo-policy migration.
- Execute as staged PRs in this order: startup/docs contract, lifecycle cleanup, lint cleanup, shared type foundation, subsystem type cleanup, CI/test-noise cleanup.

# Integration Tests

This directory now contains automated smoke coverage for the shipped 5-level release path.

## What Runs in `npm run test:integration`

- `releaseDataFlow.test.js`
  Confirms the five level manifests load from the real app data, builds real prepared sessions, and verifies asset expansion matches the intended feature gates.
- `playSceneBootstrap.test.js`
  Exercises the active `PlayScene` bootstrap flow with mocked Phaser dependencies so the suite can verify stage/character wiring, replay/input-buffer enablement, health-bar creation, and result persistence behavior.

## Scope

These tests are intentionally focused on the current release contract:

- `Title -> Main Menu -> Levels -> Loading -> Play -> Result/Game Over -> Levels`
- five shipped levels only
- hidden legacy mode modules remain preserved, but they are not treated as release-path integration targets

## Gaps

This suite does not replace a manual browser playthrough. It does not validate:

- real rendering output
- live audio sync
- device/browser-specific performance

For those, use the manual testing guides in `docs/`.

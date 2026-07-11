# Rythm Foundation

A mobile-first browser rhythm game built with [Phaser 4](https://phaser.io/) and [Vite](https://vitejs.dev/). The project began as a Friday Night Funkin-style lane rhythm game and is being converted into a reusable framework for Rhythm Heaven-style cue-and-response minigames. See [`framework_conversion.md`](framework_conversion.md) for the full migration plan.

## Status

The current runtime is the lane-rhythm gameplay (notes, strumlines, characters, health, combo). The neutral rhythm framework described in the conversion plan is being built alongside it. Until that work lands, the shipped route remains the lane game.

## Requirements

- Node.js 18+ (ES modules, Vite 6)
- npm

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on [http://localhost:3000](http://localhost:3000) and opens automatically. The entry point is `index.html`, which loads `src/main.js`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build (port 4173) |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:integration` | Run integration tests |
| `npm run test:all` | Run unit + integration tests |
| `npm run lint` | Lint `src/` with ESLint |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format `src/` with Prettier |
| `npm run typecheck` | Type-check with `tsc --noEmit` (JSDoc-based) |

## Project Structure

```
src/
  main.js          App bootstrap: SaveManager, TouchDeviceDetector, OrientationOverlay, Phaser.Game
  phaser.js        Phaser import shim
  types.js         Canonical cross-module JSDoc typedefs
  core/            Conductor (timing), EventBus, Registry, Constants, PerformanceMonitor
  audio/           AudioManager, VoicesGroup
  input/           InputSystem, TouchInputController, TouchDeviceDetector, keybinds
  play/            Gameplay: PlayState, NoteProcessor, Scoring, Strumline, HUD, characters
  scenes/          PlayScene
  ui/              Menu and flow scenes (Title, MainMenu, LevelSelect, Options, Loading, Result, Pause, GameOver, etc.)
  levels/          Level/session builders and asset manifest resolution
  graphics/        Camera, sprite, and transition helpers
  replay/          ReplaySystem
  data/            SaveManager, parsers, registries
  utils/           Asset path helpers
assets/
  data/            Level definitions and asset manifests
  images/ music/ sounds/ songs/ fonts/
tests/             Unit, integration, and property tests (Vitest, fast-check)
docs/              ARCHITECTURE.md and the Phaser 4 cutover notes
tools/             Legacy song-conversion tooling
```

## Architecture Notes

A few conventions worth knowing before contributing (full details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):

- **Boot once.** `SaveManager.init()`, `TouchDeviceDetector.detect()`, and `OrientationOverlay.init()` run only in `main.js`. Scenes never re-initialize them.
- **Lifecycle contract.** Every scene tears down in `shutdown()` everything it set up in `create()` (listeners, EventBus subscriptions, timers, tweens, owned game objects).
- **Single source of truth.** `GameplayState` owns `health`, `score`, `combo`, `maxCombo`, and `tallies`. `PlayState` exposes them as read-through accessors and `NoteProcessor` mutates only through `GameplayState`.
- **Shared types.** All cross-module JSDoc typedefs live in `src/types.js`; modules import them via `/** @import { TypeName } from '../types.js' */`.
- **Transitions.** Scene navigation routes through the `Transitions` helper rather than ad-hoc camera fades.

## Testing

Tests run on Vitest with a jsdom environment, and property-based tests use `fast-check`.

```bash
npm run test:all
```

Verification for a clean change: `npm run lint`, `npm run typecheck`, `npm run test:all`, and `npm run build` should all pass with zero errors.

## Build & Distribution

`pnpm build` outputs to `dist/`, isolating the Phaser engine into its own cached chunk.

## License

Apache-2.0

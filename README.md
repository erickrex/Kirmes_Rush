<div align='center'><img src="docs/readme_images/FNF_logo.png" width="800">

<h2>Friday Night Funkin' - Phaser JS Edition</h2>

A Phaser 3 rebuild of Friday Night Funkin' focused on a stable 5-level browser release.

Portrait-first (720×1280, 9:16) layout designed for mobile and desktop. On mobile, touch controls appear at the bottom of the screen. On desktop, the portrait canvas is centered with black letterboxing and keyboard input works as usual.

</div>

## Quick Start

If you already have the repo:

```bash
cd fnf-phaser
npm install
npm run dev
```

Then open `http://localhost:3000`.

If you need to clone it first:

```bash
git clone --recursive https://github.com/FunkinCrew/Funkin.git
cd Funkin/fnf-phaser
npm install
npm run dev
```

## Current Release Scope

The current shipped game flow is:

`Title -> Main Menu -> Levels -> Loading -> Play -> Result/Game Over -> Levels`

This release intentionally exposes only:

- `Levels`
- `Options`

The playable progression is a curated 5-level path:

1. `Level 1: Basics`
2. `Level 2: Rhythm`
3. `Level 3: Performance`
4. `Level 4: Challenge`
5. `Level 5: Mastery`

## What Is Included

- Universal portrait (720×1280) layout — single layout for all platforms, no landscape mode
- Touch controls with four directional zones for mobile play
- Automatic touch device detection with orientation prompt for landscape visitors
- Performance monitor that reduces visual effects on lower-end devices
- Five playable levels backed by real song charts and shared Funkin asset data
- Progressive feature unlocks across those five levels
- Local persistence through `SaveManager` for options, controls, scores, and progress
- Result-screen high score updates and level completion tracking
- Automated unit and integration smoke coverage for the shipped release path

## What Is Preserved But Hidden

Legacy mode modules such as Story Menu, Freeplay, and Replay Browser are still present in the codebase, but they are intentionally not exposed in the current menu. They are retained as scaffolding for future mode work rather than treated as dead code.

## Build

```bash
cd fnf-phaser
npm run build
```

The production output is written to `fnf-phaser/dist/`.

## Verification

```bash
cd fnf-phaser
npm test
npm run test:integration
npm run lint
npm run build
```

Current status:

- `npm test` passes
- `npm run test:integration` passes
- `npm run lint` passes (zero errors, zero warnings)
- `npm run build` passes
- `npm run typecheck` passes (zero diagnostics)

## Project Structure

```
fnf-phaser/
├── src/
│   ├── audio/
│   ├── core/           # Conductor, EventBus, PerformanceMonitor
│   ├── data/
│   ├── graphics/
│   ├── input/          # TouchDeviceDetector, TouchInputController
│   ├── layout/         # LayoutManager (portrait constants)
│   ├── levels/
│   ├── play/           # PlayState, OpponentIndicator, Strumline, HUD
│   ├── scenes/
│   └── ui/             # Menus, overlays, and UI scenes
├── assets/data/          # App-owned 5-level manifests and manifest indexes
├── tests/                # Unit tests
├── tests/integration/    # Release-path smoke tests
└── dist/                 # Production build output
```

Shared Funkin content remains sourced from `assets/funkin.assets/` at the repository root and is bridged into the Phaser app during development and build.

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)

<!-- The following docs are planned but not yet written:
- Browser Testing
- Audio Sync Testing
- Performance Optimization
-->

## Tech Stack

- [Phaser 3.90.0](https://phaser.io/)
- [Vite](https://vitejs.dev/)
- [Vitest](https://vitest.dev/)
- JavaScript (ES modules)

## Credits

Full credits can be found in-game and in the upstream Funkin asset data.

### Original Game

- [ninjamuffin99](https://twitter.com/ninja_muffin99) - Lead Programmer
- [PhantomArcade3K](https://twitter.com/phantomarcade3k) - Artist and Animator
- [Kawaisprite](https://twitter.com/kawaisprite) - Musician
- [Evilsk8r](https://twitter.com/evilsk8r) - Art

## License

See [LICENSE.md](LICENSE.md).

<div align='center'><img src="docs/readme_images/FNF_logo.png" width="800">

<h2>Friday Night Funkin' - Phaser JS Edition</h2>

A web-based rhythm game rebuilt in Phaser 3.90.0, originally created for [Ludum Dare 47](https://ldjam.com/events/ludum-dare/47).

This game was made with love to Newgrounds and its community. Extra love to Tom Fulp.

</div>

## About This Version

This is a complete JavaScript rewrite of Friday Night Funkin' using [Phaser 3](https://phaser.io/). The original game was built in HaxeFlixel - this version maintains feature parity while targeting modern web browsers.

### Features
- 🎮 Full gameplay with all original songs (Tutorial through Weekend 1)
- 🎵 Precise audio synchronization (±5ms accuracy)
- ⌨️ Low-latency input handling (<16ms)
- 💾 Local save system for high scores and preferences
- 🌐 Runs in any modern browser (Chrome, Firefox, Safari, Edge)

## Quick Start

### Play Online
- [Newgrounds](https://www.newgrounds.com/portal/view/770371) (Original HaxeFlixel version)

### Run Locally

```bash
# Clone the repository
git clone --recursive https://github.com/FunkinCrew/Funkin.git
cd Funkin/fnf-phaser

# Install dependencies
npm install

# Start development server
npm run dev
```

Then open `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
```

The built files will be in `fnf-phaser/dist/`.

## Project Structure

```
fnf-phaser/
├── src/
│   ├── core/       # Conductor, EventBus, Registry
│   ├── play/       # PlayState, Strumline, Scoring
│   ├── ui/         # Menu states, HUD components
│   ├── audio/      # AudioManager, VoicesGroup
│   ├── graphics/   # FunkinSprite, Transitions
│   ├── input/      # Controls, PreciseInput
│   └── data/       # Parsers, Registries
├── assets/         # Game assets (linked from funkin.assets)
├── tests/          # Unit and integration tests
└── docs/           # Documentation
```

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and patterns
- [Browser Testing](fnf-phaser/docs/BROWSER_TESTING.md) - Cross-browser compatibility
- [Audio Sync Testing](fnf-phaser/docs/AUDIO_SYNC_TESTING.md) - Timing accuracy verification
- [Performance Optimization](fnf-phaser/docs/PERFORMANCE_OPTIMIZATION.md) - Performance strategies

## Running Tests

```bash
cd fnf-phaser
# Unit tests (default; stable in CI)
npm test

# Integration tests (requires browser/canvas-capable environment)
npm run test:integration
```

Use `npm run test:all` to run both.

## Tech Stack

- **Framework**: [Phaser 3.90.0](https://phaser.io/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Language**: JavaScript (ES6+)

## Credits and Special Thanks

Full credits can be found in-game, or in the `credits.json` file which is located [here](https://github.com/FunkinCrew/funkin.assets/blob/main/exclude/data/credits.json).

### Original Game
- [ninjamuffin99](https://twitter.com/ninja_muffin99) - Lead Programmer
- [PhantomArcade3K](https://twitter.com/phantomarcade3k) - Artist and Animator
- [Kawaisprite](https://twitter.com/kawaisprite) - Musician
- [Evilsk8r](https://twitter.com/evilsk8r) - Art

### Special Thanks
- [Tom Fulp](https://twitter.com/tomfulp) - For Newgrounds
- The entire Funkin' Crew team
- Our contributors on GitHub

## License

See [LICENSE.md](LICENSE.md) for details.

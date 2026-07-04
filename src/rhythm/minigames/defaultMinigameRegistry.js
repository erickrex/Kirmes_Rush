/**
 * @fileoverview Default Minigame_Controller registration for the Rhythm_Framework.
 *
 * This module is the single manifest that maps each committed
 * Minigame_Definition `id` to its concrete Minigame_Controller class and wires
 * them into a {@link MinigameRegistry} (R11.3). Keeping the id -> class manifest
 * here — rather than inline in framework-core files (RhythmScene, LoadingState,
 * MinigameSelectState) — means adding a new minigame is one JSON definition, one
 * controller class, and one line in {@link MINIGAME_CONTROLLERS}, with no edits
 * to the framework core (R11.4).
 *
 * The ids MUST match the `id` fields of the definitions under
 * `assets/data/rhythm/minigames/`:
 *  - `tap-clap`    -> {@link TapClapGame}    (assets/data/rhythm/minigames/tap-clap.json)
 *  - `fill-bot`    -> {@link FillBotGame}    (assets/data/rhythm/minigames/fill-bot.json)
 *  - `release-cue` -> {@link ReleaseGame}    (assets/data/rhythm/minigames/release-cue.json)
 *  - `flick-rally` -> {@link FlickRallyGame} (assets/data/rhythm/minigames/flick-rally.json)
 */

import MinigameRegistry from './MinigameRegistry.js';
import TapClapGame from './TapClapGame.js';
import FillBotGame from './FillBotGame.js';
import ReleaseGame from './ReleaseGame.js';
import FlickRallyGame from './FlickRallyGame.js';

/**
 * The canonical Minigame_Definition id -> Minigame_Controller class manifest.
 * Add a new entry here (alongside its JSON definition + controller class) to
 * ship a new minigame without touching framework-core files (R11.4).
 * @type {Readonly<Record<string, Function>>}
 */
const MINIGAME_CONTROLLERS = Object.freeze({
  'tap-clap': TapClapGame,
  'fill-bot': FillBotGame,
  'release-cue': ReleaseGame,
  'flick-rally': FlickRallyGame
});

/**
 * Register every controller in {@link MINIGAME_CONTROLLERS} onto an existing
 * registry so each definition id maps to its controller class (R11.3).
 * @param {MinigameRegistry} registry - The registry to populate.
 * @returns {MinigameRegistry} The same registry, for chaining.
 * @throws {Error} When `registry` is not a MinigameRegistry-like object.
 */
function registerDefaultMinigames(registry) {
  if (!registry || typeof registry.register !== 'function') {
    throw new Error(
      'registerDefaultMinigames: expected a MinigameRegistry with a register(id, class) method'
    );
  }
  for (const [id, controllerClass] of Object.entries(MINIGAME_CONTROLLERS)) {
    registry.register(id, controllerClass);
  }
  return registry;
}

/**
 * Build a fresh {@link MinigameRegistry} with all four prototype controllers
 * registered (R11.3). Framework-core callers use this instead of hand-wiring
 * controllers, so adding a minigame never edits the core (R11.4).
 * @returns {MinigameRegistry} A new registry with the default controllers.
 */
function createDefaultMinigameRegistry() {
  return registerDefaultMinigames(new MinigameRegistry());
}

export default createDefaultMinigameRegistry;
export { createDefaultMinigameRegistry, registerDefaultMinigames, MINIGAME_CONTROLLERS };

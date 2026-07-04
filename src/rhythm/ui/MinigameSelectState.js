/**
 * @fileoverview MinigameSelectState - the menu scene that lists the four
 * data-driven rhythm minigames and launches the selected one (task 14, R12).
 *
 * Flow (R12.1 -> R12.4):
 *  - on `create` it loads the committed Minigame_Definitions and lists them
 *    (R12.1);
 *  - on select it transitions to `LoadingState` through the shared Transitions
 *    helper (R12.2), handing it a `prepareCallback` that builds the
 *    RhythmSession and asset manifest for the chosen minigame (R12.3), with
 *    `nextScene: 'RhythmScene'` so LoadingState starts RhythmScene with the
 *    built session once assets finish loading (R12.4).
 *
 * The id -> controller manifest lives in `defaultMinigameRegistry` and the
 * session/manifest assembly lives in `RhythmSessionBuilder`, so adding a
 * minigame never edits this scene (R11.4).
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (MinigameSelectState
 * section). Extends {@link BaseMenuState} for shared input, sounds, background,
 * and transition handling.
 */

import BaseMenuState from '../../ui/BaseMenuState.js';
import createDefaultMinigameRegistry from '../minigames/defaultMinigameRegistry.js';
import { buildRhythmPrepareCallback } from '../data/RhythmSessionBuilder.js';

/**
 * @typedef {import('../../types.js').MinigameDefinition} MinigameDefinition
 */

/**
 * The committed Minigame_Definition ids, one per movement type, in list order.
 * These match the JSON files under `assets/data/rhythm/minigames/` and the
 * controller manifest in `defaultMinigameRegistry`.
 * @type {readonly string[]}
 */
export const MINIGAME_IDS = Object.freeze(['tap-clap', 'fill-bot', 'release-cue', 'flick-rally']);

/**
 * Menu scene listing the four rhythm minigames.
 * @extends BaseMenuState
 */
export default class MinigameSelectState extends BaseMenuState {
  constructor() {
    super({ key: 'MinigameSelectState' });

    /**
     * Registry mapping definition ids to controller classes (R11.3). Held as an
     * instance field so tests can substitute a stub before `create`.
     * @type {import('../minigames/MinigameRegistry.js').default}
     */
    this.minigameRegistry = createDefaultMinigameRegistry();

    /**
     * The minigame ids this scene offers, in list order.
     * @type {string[]}
     */
    this.minigameIds = [...MINIGAME_IDS];

    /**
     * Injectable fetch implementation forwarded to `registry.loadDefinition`;
     * defaults to the global `fetch` when null.
     * @type {typeof fetch | null}
     */
    this.fetchImpl = null;

    /**
     * The loaded, validated definitions backing the list (R12.1).
     * @type {MinigameDefinition[]}
     */
    this.definitions = [];

    /** @type {Phaser.GameObjects.Text[]} */
    this.minigameTexts = [];

    /** @type {Phaser.GameObjects.Text | null} */
    this.statusText = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.infoText = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.backButton = null;

    /**
     * The in-flight definition load started by {@link MinigameSelectState#create};
     * exposed so callers/tests can await the populated list.
     * @type {Promise<void> | null}
     */
    this.loadingPromise = null;
  }

  /** @override */
  getItemCount() {
    return this.definitions.length;
  }

  /** Preload shared menu sounds. */
  preload() {
    this.preloadMenuSounds();
  }

  create() {
    this.transitioning = false;
    this.selectedIndex = 0;

    this.createBackground(undefined, 0x120a1f, 0x241033);
    this.createStaticUi();
    this.setupInput();
    this.fadeIn();

    this.loadingPromise = this.loadDefinitions();
  }

  /**
   * Render the static chrome: title, hint, back button, status line, and the
   * per-minigame info panel.
   */
  createStaticUi() {
    const { width, height } = this.cameras.main;
    const infoX = 96;
    const pad = 36;

    this.backButton = this.add.text(pad, 50, '\u2190 Back', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#c4b5fd'
    });
    this.backButton.setOrigin?.(0, 0.5);
    if (this.backButton.setInteractive) {
      this.backButton.setInteractive({ useHandCursor: true });
      this.backButton.on('pointerdown', () => this.onBack());
    }

    this.add.text(infoX, 100, 'Minigames', {
      fontFamily: 'Arial Black',
      fontSize: '54px',
      color: '#ffffff'
    });

    this.add.text(infoX, 160, 'Pick a movement type to play.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#a78bca'
    });

    this.statusText = this.add.text(infoX, height - 72, 'Loading minigames...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#facc15'
    });

    this.infoText = this.add.text(infoX, height - 220, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e9d5ff',
      wordWrap: { width: width - infoX * 2 }
    });
  }

  /**
   * Load and validate every offered definition, then render the list (R12.1).
   * Definitions that fail to load are skipped so the menu still lists the rest.
   * @returns {Promise<void>}
   */
  async loadDefinitions() {
    const loaded = [];
    for (const id of this.minigameIds) {
      try {
        const def = await this.minigameRegistry.loadDefinition(id, this.fetchImpl ?? undefined);
        loaded.push(def);
      } catch (error) {
        console.warn(
          `[MinigameSelectState] Failed to load minigame "${id}": ` +
            `${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.definitions = loaded;
    this.createMinigameTexts();
    this.enableTouchOnItems(this.minigameTexts);
    this.updateSelection();

    if (this.statusText) {
      if (this.definitions.length > 0) {
        this.statusText.setText('Select a minigame to play.');
        this.statusText.setColor('#a78bca');
      } else {
        this.statusText.setText('Failed to load minigames');
        this.statusText.setColor('#ef4444');
      }
    }
  }

  /**
   * Create one list entry per loaded definition (R12.1).
   */
  createMinigameTexts() {
    const startX = 96;
    const startY = 240;
    const spacing = 88;

    this.minigameTexts.forEach((text) => text.destroy());
    this.minigameTexts = [];

    this.definitions.forEach((def, index) => {
      const text = this.add.text(startX, startY + index * spacing, def.name, {
        fontFamily: 'Arial Black',
        fontSize: '38px',
        color: '#ffffff'
      });
      this.minigameTexts.push(text);
    });
  }

  /** @override */
  updateSelection() {
    this.minigameTexts.forEach((text, index) => {
      if (index === this.selectedIndex) {
        text.setColor('#facc15');
        text.setScale?.(1.05);
      } else {
        text.setColor('#ffffff');
        text.setScale?.(1);
      }
    });

    const def = this.definitions[this.selectedIndex];
    if (def && this.infoText) {
      const movement = def.movementType ? def.movementType.toUpperCase() : 'UNKNOWN';
      const songId = def.song?.id ?? 'unknown';
      this.infoText.setText(`Movement: ${movement}\nSong: ${songId}`);
    }
  }

  /**
   * Launch the selected minigame: transition to LoadingState via the Transitions
   * helper (R12.2), passing a prepareCallback that builds the RhythmSession +
   * asset manifest (R12.3) and `nextScene: 'RhythmScene'` (R12.4).
   * @override
   */
  executeSelection() {
    const def = this.definitions[this.selectedIndex];
    if (!def) {
      this.transitioning = false;
      return;
    }

    // Resume a suspended Web Audio context on this user gesture so audio is
    // unlocked by the time RhythmScene starts playback (mirrors LevelSelectState).
    try {
      const mgr = /** @type {any} */ (this.sound);
      const ctx = mgr?.context;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {
      /* swallow */
    }

    const controllerClass = this.minigameRegistry.getControllerClass(def.id);
    if (typeof controllerClass !== 'function') {
      console.warn(`[MinigameSelectState] No controller registered for "${def.id}"`);
      this.transitioning = false;
      return;
    }

    this.transitionToScene('LoadingState', {
      nextScene: 'RhythmScene',
      message: `Loading ${def.name}...`,
      minDuration: 300,
      minigameId: def.id,
      prepareCallback: buildRhythmPrepareCallback(def, /** @type {Function} */ (controllerClass))
    });
  }

  /** @override */
  executeBack() {
    this.transitionToScene('MainMenuState');
  }

  /** @override */
  shutdown() {
    super.shutdown();
    this.minigameTexts.forEach((text) => text.destroy());
    this.minigameTexts = [];
    this.statusText = null;
    this.infoText = null;
    this.backButton = null;
  }
}

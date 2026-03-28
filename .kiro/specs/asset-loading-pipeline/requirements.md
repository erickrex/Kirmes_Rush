# Requirements Document

## Introduction

This feature connects the existing asset files (sprites, audio, stage backgrounds) in the `funkin.assets` submodule to the Phaser.js rendering and audio engine. Currently, the game's BootScene, LoadingState, and PlayState have the structural scaffolding for asset loading but all actual `this.load.*()` calls are commented out or missing. The result is that levels launch with no visuals and no audio. This spec covers four integration gaps: BootScene core asset preloading, Sparrow atlas loading for characters/notes/stages, audio loading via Phaser's loader, and the LoadingState bridge that consumes `LevelSessionBuilder.build()` output to preload per-song assets before gameplay begins.

## Glossary

- **Boot_Scene**: The initial Phaser scene (`BootScene.js`) responsible for preloading core assets shared across all game states before transitioning to the title screen.
- **Loading_State**: The intermediate Phaser scene (`LoadingState.js`) that preloads per-song assets (audio, character atlases, stage graphics) between menu selection and gameplay.
- **Play_State**: The main gameplay Phaser scene (`PlayState.js`) that orchestrates strumlines, characters, stage, audio, and scoring.
- **Level_Session_Builder**: The class (`LevelSessionBuilder.js`) that resolves a level manifest into a normalized session object containing chart data, audio keys/paths, and an `assets` array.
- **Asset_Entry**: An object `{ type, key, path }` in the `assets` array produced by Level_Session_Builder, describing a single loadable resource.
- **Sparrow_Atlas**: A PNG spritesheet paired with an XML file in Sparrow/Starling format, used for character sprites, note skins, and animated stage props.
- **Texture_Cache**: Phaser's internal texture manager (`this.textures`) that stores loaded images and atlas frames for use by sprites.
- **Audio_Cache**: Phaser's internal audio cache (`this.cache.audio`) that stores decoded audio buffers for playback.
- **Audio_Manager**: The class (`AudioManager.js`) that manages instrumental and voice track playback with sync support.
- **Voices_Group**: The class (`VoicesGroup.js`) that manages split player/opponent vocal tracks with independent mute control.
- **Character_Registry**: The config-driven registry (`CharacterRegistry.js`) that stores character definitions including `assetPath` for sprite atlas resolution.
- **Stage_Registry**: The config-driven registry (`StageRegistry.js`) that stores stage definitions including prop `assetPath` values.
- **Note_Style_Registry**: The config-driven registry (`NoteStyleRegistry.js`) that stores note skin definitions including asset paths for note, strumline, splash, and hold sprites.
- **Funkin_Asset_Bridge**: The Vite middleware plugin that serves files from the `assets/funkin.assets` submodule at the `/assets/funkin.assets/` URL path during development.
- **Sparrow_Parser**: The class (`SparrowParser.js`) that parses Sparrow XML into frame data and can generate Phaser animation configs.

## Requirements

### Requirement 1: BootScene Core Asset Preloading

**User Story:** As a player, I want the game to preload shared UI and gameplay assets at startup, so that menus and gameplay scenes have the textures they need without per-scene loading delays.

#### Acceptance Criteria

1. WHEN Boot_Scene enters its preload phase, THE Boot_Scene SHALL call `this.load.atlas()` for the default note skin Sparrow_Atlas (PNG + XML) using the path resolved from Note_Style_Registry.
2. WHEN Boot_Scene enters its preload phase, THE Boot_Scene SHALL call `this.load.atlas()` for the default strumline receptor Sparrow_Atlas using the path resolved from Note_Style_Registry.
3. WHEN Boot_Scene enters its preload phase, THE Boot_Scene SHALL call `this.load.atlas()` for the note splash Sparrow_Atlas using the path resolved from Note_Style_Registry.
4. WHEN all core assets finish loading without errors, THE Boot_Scene SHALL transition to the next scene.
5. IF one or more core asset files fail to load, THEN THE Boot_Scene SHALL display the failed file keys in the error state UI and offer a retry option.
6. WHEN Boot_Scene loads a Sparrow_Atlas, THE Boot_Scene SHALL use the Sparrow_Parser to convert the XML into Phaser-compatible frame data and add it to the Texture_Cache.

### Requirement 2: Character Sprite Atlas Loading

**User Story:** As a player, I want character sprites to appear on screen during gameplay, so that I can see the player, opponent, and girlfriend characters animate.

#### Acceptance Criteria

1. WHEN Loading_State receives a session with character IDs, THE Loading_State SHALL resolve each character's `assetPath` from Character_Registry and queue `this.load.atlas()` for the character's PNG and XML files under `assets/funkin.assets/shared/images/`.
2. WHEN a character Sparrow_Atlas finishes loading, THE Loading_State SHALL use Sparrow_Parser to register Phaser animations for each animation prefix defined in the character's registry data.
3. WHEN Play_State creates a Character, THE Character SHALL set its texture to the loaded atlas key so that `playAnimation()` renders the correct frames from Texture_Cache.
4. IF a character's atlas file fails to load, THEN THE Loading_State SHALL log a warning and allow gameplay to proceed without that character's visuals.

### Requirement 3: Stage Background Asset Loading

**User Story:** As a player, I want stage backgrounds and props to render during gameplay, so that each song has its visual setting.

#### Acceptance Criteria

1. WHEN Loading_State receives a session with a stage ID, THE Loading_State SHALL resolve each stage prop's `assetPath` from Stage_Registry and queue `this.load.image()` or `this.load.atlas()` for each prop asset under `assets/funkin.assets/shared/images/`.
2. WHEN Play_State creates a Stage, THE Stage SHALL set each prop sprite's texture to the corresponding loaded key from Texture_Cache.
3. WHEN a stage prop has animations defined in Stage_Registry, THE Loading_State SHALL load the prop as a Sparrow_Atlas and register its Phaser animations.
4. IF a stage prop asset fails to load, THEN THE Loading_State SHALL log a warning and allow gameplay to proceed without that prop's visuals.

### Requirement 4: Audio Asset Loading

**User Story:** As a player, I want to hear the instrumental track and character vocals during gameplay, so that the rhythm game has music to play along with.

#### Acceptance Criteria

1. WHEN Loading_State receives a session containing audio Asset_Entry objects, THE Loading_State SHALL call `this.load.audio()` for each audio entry using the entry's `key` and `path`.
2. WHEN audio loading completes, THE Play_State SHALL call `Audio_Manager.loadInstrumental()` with the instrumental audio key so that the instrumental track is ready for playback.
3. WHEN the session includes split vocal tracks (player and opponent), THE Play_State SHALL call `Voices_Group.loadSplit()` with the player vocal key and opponent vocal key.
4. WHEN the session includes a combined vocal track, THE Play_State SHALL call `Voices_Group.loadCombined()` with the combined vocal key.
5. IF an audio file fails to load, THEN THE Loading_State SHALL log a warning and allow gameplay to proceed without that audio track.

### Requirement 5: LoadingState Session Integration

**User Story:** As a player, I want the game to automatically preload all assets for a selected song before gameplay starts, so that there are no missing textures or silent audio during play.

#### Acceptance Criteria

1. WHEN a level is selected for play, THE Loading_State SHALL receive a `prepareCallback` that calls `Level_Session_Builder.build()` to produce the session object.
2. WHEN the session object is produced, THE Loading_State SHALL populate its `assets` array with all Asset_Entry objects from the session (audio entries, character atlas entries, stage prop entries, note style entries).
3. WHEN the `assets` array is populated, THE Loading_State SHALL pass the session's chart and songData as `nextSceneData` to Play_State.
4. THE Loading_State SHALL display a progress bar that reflects the fraction of queued assets that have finished loading.
5. WHEN all assets finish loading and the minimum display duration has elapsed, THE Loading_State SHALL transition to Play_State with the session data.
6. IF Level_Session_Builder.build() throws an error, THEN THE Loading_State SHALL display the error message and offer a retry or return-to-menu option.

### Requirement 6: Asset Path Resolution

**User Story:** As a developer, I want asset paths to resolve correctly in both development (Vite dev server) and production (built output), so that the loading pipeline works in all environments.

#### Acceptance Criteria

1. THE Loading_State SHALL prefix Sparrow_Atlas image paths with the Funkin_Asset_Bridge base URL (`assets/funkin.assets/`) when the asset originates from the funkin.assets submodule.
2. THE Loading_State SHALL prefix Sparrow_Atlas XML paths with the same Funkin_Asset_Bridge base URL as the corresponding image.
3. WHEN an Asset_Entry path already includes the `assets/funkin.assets/` prefix, THE Loading_State SHALL use the path as-is without double-prefixing.
4. THE Boot_Scene SHALL use the same path resolution logic as Loading_State for core asset loading.

### Requirement 7: Asset Deduplication

**User Story:** As a developer, I want the loading pipeline to skip assets that are already in the cache, so that re-entering a song or sharing assets between levels does not cause redundant network requests.

#### Acceptance Criteria

1. WHEN Loading_State queues an image or atlas asset, THE Loading_State SHALL check `this.textures.exists(key)` and skip the load call if the texture is already cached.
2. WHEN Loading_State queues an audio asset, THE Loading_State SHALL check `this.cache.audio.exists(key)` and skip the load call if the audio is already cached.
3. WHEN all assets are already cached, THE Loading_State SHALL proceed directly to the transition without starting Phaser's loader.

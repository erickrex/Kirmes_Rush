# Implementation Plan: Asset Loading Pipeline

## Overview

Implement the three-layer asset loading pipeline that connects `funkin.assets` files to Phaser's loader, texture cache, and audio cache. Tasks proceed bottom-up: pure-function modules first (AssetManifestBuilder, AnimationRegistrar), then Phaser integration (BootScene, LoadingState), then runtime wiring (PlayState). Each layer is tested before the next begins.

## Tasks

- [x] 1. Create AssetManifestBuilder module
  - [x] 1.1 Implement `buildCharacterEntries()` function
    - Accept an array of character IDs and a CharacterRegistry instance
    - For each character ID, resolve `assetPath` via the registry, apply `resolveAssetPath()`, prefix with `assets/funkin.assets/`
    - Return `{ type: 'atlas', key: 'char-{id}', path: '...png', atlasURL: '...xml' }` per unique character
    - Skip characters not found in the registry (log warning, return empty for that ID)
    - _Requirements: 2.1, 6.1, 6.2_

  - [x] 1.2 Implement `buildStageEntries()` function
    - Accept a stage ID and a StageRegistry instance
    - For each prop with a non-empty `assetPath`, resolve path and prefix with `assets/funkin.assets/`
    - If prop has a non-empty `animations` array, set `type: 'atlas'` with `atlasURL`; otherwise `type: 'image'`
    - Key pattern: `stage-{stageId}-{propName}`
    - _Requirements: 3.1, 3.3, 6.1, 6.2_

  - [x] 1.3 Implement `buildNoteStyleEntries()` function
    - Accept a note style ID and a NoteStyleRegistry instance
    - Resolve asset paths for `note`, `noteStrumline`, `noteSplash`, and `holdNote` asset keys
    - Follow the fallback chain if the style has a `fallback` property
    - Key pattern: `notestyle-{styleId}-{assetKey}`
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

  - [x] 1.4 Implement `deduplicateEntries()` function
    - Accept an array of AssetEntry objects
    - Return a new array with duplicate keys removed, keeping the first occurrence
    - _Requirements: 7.1, 7.2_

  - [x] 1.5 Implement `buildManifest()` orchestrator function
    - Accept a session object (from LevelSessionBuilder) and a registries object `{ characterRegistry, stageRegistry, noteStyleRegistry }`
    - Extract character IDs from `session.songData.characters`, stage ID from `session.songData.stage`, note style from `session.songData.noteStyle`
    - Merge session's existing audio `assets` with character, stage, and note style entries
    - Deduplicate the merged array and return it
    - Handle paths already prefixed with `assets/funkin.assets/` without double-prefixing
    - _Requirements: 5.2, 6.3, 7.1_

  - [x] 1.6 Write property test: Character manifest completeness (Property 1)
    - **Property 1: Character manifest completeness**
    - Generate random sets of character IDs with mock registry data; verify entry count equals unique character count, keys match `char-{id}`, paths end with resolved assetPath + `.png`
    - **Validates: Requirements 2.1**

  - [x] 1.7 Write property test: Stage manifest correctness with type inference (Property 3)
    - **Property 3: Stage manifest correctness with type inference**
    - Generate random stage prop arrays with varying animation presence; verify entry types are `'atlas'` when animations exist, `'image'` otherwise, and keys match `stage-{stageId}-{propName}`
    - **Validates: Requirements 3.1, 3.3**

  - [x] 1.8 Write property test: Full session manifest completeness (Property 4)
    - **Property 4: Full session manifest completeness**
    - Generate random session objects with mock registries; verify manifest keys are a superset of all expected audio, character, stage, and note style keys
    - **Validates: Requirements 5.2**

  - [x] 1.9 Write property test: Asset path prefixing correctness (Property 5)
    - **Property 5: Asset path prefixing correctness**
    - Generate random registry-style paths without the `assets/funkin.assets/` prefix; verify both `path` and `atlasURL` in produced entries start with `assets/funkin.assets/`
    - **Validates: Requirements 6.1, 6.2**

  - [x] 1.10 Write property test: Path prefix idempotence (Property 6)
    - **Property 6: Path prefix idempotence**
    - Generate random paths that already include `assets/funkin.assets/`; verify no double-prefixing occurs
    - **Validates: Requirements 6.3**

  - [x] 1.11 Write property test: Cache-aware deduplication (Property 7)
    - **Property 7: Cache-aware deduplication**
    - Generate random entry arrays with duplicate keys and random cache key sets; verify filtered output length and absence of cached keys
    - **Validates: Requirements 7.1, 7.2**

- [x] 2. Create AnimationRegistrar module
  - [x] 2.1 Implement `registerCharacterAnimations()` function
    - Accept a Phaser scene, a texture key, and an animation data array from CharacterRegistry
    - For each animation definition, call `scene.anims.create()` with key, frames (using texture key + prefix matching), frameRate, and repeat (looped → -1, else 0)
    - Handle `frameIndices` when specified in animation data
    - _Requirements: 2.2, 2.3_

  - [x] 2.2 Implement `registerPropAnimations()` function
    - Accept a Phaser scene, a texture key, and an animation data array from StagePropData
    - Same pattern as character animations but using stage prop animation fields (`name`, `prefix`, `frameRate`, `looped`)
    - No-op when animations array is empty
    - _Requirements: 3.3_

  - [x] 2.3 Write property test: Animation registration completeness (Property 2)
    - **Property 2: Animation registration completeness**
    - Generate random animation definition arrays; verify output config count equals input count and each config has correct `key`, `frameRate`, and `repeat` values
    - **Validates: Requirements 2.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update BootScene.loadCoreAssets()
  - [x] 4.1 Implement core note style atlas loading in BootScene
    - Import `buildNoteStyleEntries` from AssetManifestBuilder
    - In `loadCoreAssets()`, resolve the default note style ID (`'funkin'`) and call `buildNoteStyleEntries()`
    - For each returned entry, call `this.load.atlas(key, path, atlasURL)` for atlas types or `this.load.image(key, path)` for image types
    - Set the base path appropriately before loading
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.4_

  - [x] 4.2 Write unit tests for BootScene.loadCoreAssets()
    - Verify that `this.load.atlas()` is called with expected keys and paths for note, strumline, and splash atlases
    - Verify error handling when NoteStyleRegistry has no default style
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 5. Extend LoadingState for atlas support and session integration
  - [x] 5.1 Add atlas type support to LoadingState.loadAssets()
    - In the `loadAssets()` method's object-type branch, add a case for `type: 'atlas'`
    - Call `this.load.atlas(key, path, options.atlasURL)` for atlas entries
    - Check `this.textures.exists(key)` before loading (already handled by `isAssetLoaded` for atlas type)
    - _Requirements: 2.1, 3.1, 7.1_

  - [x] 5.2 Integrate AssetManifestBuilder into the prepareCallback flow
    - Create a `buildPrepareCallback(levelInput, registries)` helper function (can live in a new file or in AssetManifestBuilder)
    - The callback calls `LevelSessionBuilder.build(levelInput)`, then `AssetManifestBuilder.buildManifest(session, registries)`
    - Returns `{ assets: mergedEntries, nextSceneData: { chart, songData, audio, ... }, nextScene: 'PlayState' }`
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 5.3 Write unit tests for LoadingState atlas loading and prepareCallback
    - Verify atlas entries are queued via `this.load.atlas()`
    - Verify prepareCallback produces correct nextSceneData shape
    - Verify already-cached assets are skipped
    - _Requirements: 5.2, 5.4, 7.1, 7.3_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire loaded assets in PlayState
  - [x] 7.1 Wire character textures and animations in PlayState
    - After `createCharacters()`, for each character (player, opponent, girlfriend):
      - Call `character.setTexture('char-{characterId}')` to apply the loaded atlas
      - Call `registerCharacterAnimations(scene, 'char-{characterId}', characterRegistry.getCharacterAnimations(characterId))`
      - Call `character.playAnimation(startingAnimation)` to set initial state
    - _Requirements: 2.3_

  - [x] 7.2 Wire stage prop textures in PlayState
    - After `createStage()`, for each prop in the stage:
      - Set the prop's texture to `stage-{stageId}-{propName}`
      - If the prop has animations, call `registerPropAnimations()` and play the starting animation
    - _Requirements: 3.2_

  - [x] 7.3 Wire audio to AudioManager and VoicesGroup in PlayState
    - In PlayState's init or a new `wireAudio(sessionAudio)` method:
      - Call `audioManager.loadInstrumental(audio.instrumental.key)` if instrumental exists
      - If `audio.vocals.player` and `audio.vocals.opponent` exist, call `voices.loadSplit(playerKey, opponentKey)`
      - If `audio.vocals.combined` exists, call `voices.loadCombined(combinedKey)`
      - Call `audioManager.setVoices(voices)` to connect them
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.4 Write unit tests for PlayState asset wiring
    - Verify `setTexture()` is called on characters with correct keys
    - Verify `registerCharacterAnimations()` is called for each character
    - Verify `loadInstrumental()` and `loadSplit()`/`loadCombined()` are called with correct keys
    - _Requirements: 2.3, 3.2, 4.2, 4.3, 4.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases
- AssetManifestBuilder is a pure-function module with no Phaser dependency, making it fully testable without mocks
- AnimationRegistrar only needs a mock `scene.anims.create()` for testing

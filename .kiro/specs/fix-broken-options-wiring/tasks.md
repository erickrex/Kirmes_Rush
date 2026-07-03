# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Saved Options Are Never Applied By Consuming Systems
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate saved option values are ignored by consuming systems
  - **Scoped PBT Approach**: For each option-to-system pair, set a non-default value in SaveManager and verify the consuming system reads it
  - Test file: `fnf-phaser/tests/OptionsWiring.property.test.js`
  - Test cases to include:
    - Set masterVolume=50 in SaveManager → create AudioManager → call applyOptionsFromSave() → assert masterVolume is 0.5 (will fail: method doesn't exist)
    - Set musicVolume=80 in SaveManager → create AudioManager → call applyOptionsFromSave() → assert instrumentalVolume is 0.8 (will fail)
    - Set sfxVolume=60 in SaveManager → create AudioManager → call applyOptionsFromSave() → assert sfxVolume is 0.6 (will fail)
    - Set downscroll=false in SaveManager → call PlayState.createStrumlines() → assert playerStrumline.isDownscroll is false (will fail: hardcoded true)
    - Set ghostTapping=false in SaveManager → trigger ghost miss in InputManager → assert penalty is applied (will fail: ghostMiss only plays press animation)
    - Set noteOffset=-20 in SaveManager → call NoteProcessor.hitNote() → assert timing includes offset (will fail: raw timing used)
    - Set hitsounds=true in SaveManager → call NoteProcessor.hitNote() with sick judgement → assert playHitsound called (will fail: never called)
    - Set masterVolume=50, musicVolume=80 in SaveManager → call MainMenuState.playMenuMusic() → assert volume is 0.4 (will fail: hardcoded 0.7)
    - Change volume slider in OptionsState → assert Phaser sound.volume changes (will fail: no live preview)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "AudioManager.masterVolume remains 1.0", "playerStrumline.isDownscroll always true")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.12_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Default Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `fnf-phaser/tests/OptionsWiring.property.test.js` (same file, separate describe block)
  - Observe behavior on UNFIXED code for default option values:
    - Observe: AudioManager created with defaults → masterVolume=1.0, instrumentalVolume=1.0, sfxVolume=1.0
    - Observe: SaveManager.saveOptions()/loadOptions() round-trip preserves all option values
    - Observe: OptionsState.loadOptions() populates UI controls from SaveManager
    - Observe: OptionsState "Reset to Defaults" resets all options and updates UI
    - Observe: PlayState.createHUDDisplay() passes showNPS/showGrade/showComboBreaks/showJudgements from SaveManager
    - Observe: AudioManager.updateVolumes() respects muted state and master volume
    - Observe: Category navigation with ◀/▶ switches categories and resets selectedIndex to 0
  - Write property-based tests capturing observed behavior:
    - For random option value combinations where all values equal defaults, verify AudioManager volumes are 1.0
    - For random option sets, verify saveOptions/loadOptions round-trip preserves values
    - For random category navigation sequences, verify selectedIndex resets to 0
    - Verify keybind capture overlay flow is unchanged
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_


- [x] 3. Implement AudioManager.applyOptionsFromSave()

  - [x] 3.1 Add `applyOptionsFromSave()` method to AudioManager
    - Read masterVolume, musicVolume, sfxVolume from `SaveManager.getInstance().getOption()`
    - Convert 0-100 scale to 0-1 scale: `this.masterVolume = masterVolume / 100`
    - Set `this.instrumentalVolume = musicVolume / 100`
    - Set `this.sfxVolume = sfxVolume / 100`
    - Call `this.updateVolumes()` to apply to instrumental and voices
    - File: `fnf-phaser/src/audio/AudioManager.js`
    - _Bug_Condition: isBugCondition(input) where AudioManager never reads saved volume options_
    - _Expected_Behavior: AudioManager.masterVolume = SaveManager.getOption('masterVolume') / 100_
    - _Preservation: Default values (100/100/100) produce masterVolume=1.0, instrumentalVolume=1.0, sfxVolume=1.0 — same as unfixed code_
    - _Requirements: 2.1, 3.1, 3.7_

- [x] 4. Wire PlayScene.setupAudio() to apply saved volume options

  - [x] 4.1 Call `this.audioManager.applyOptionsFromSave()` after creating AudioManager in `setupAudio()`
    - File: `fnf-phaser/src/scenes/PlayScene.js`, method `setupAudio()`
    - After `this.audioManager = new AudioManager(this)` and `this.audioManager.setVoices(this.voices)`, add `this.audioManager.applyOptionsFromSave()`
    - _Bug_Condition: setupAudio() creates AudioManager with default volumes (1.0) and never reads saved options_
    - _Expected_Behavior: After setupAudio(), AudioManager volumes match saved preferences_
    - _Preservation: With default options (all 100), volumes remain 1.0_
    - _Requirements: 2.1, 3.1_

- [x] 5. Wire PlayState.createStrumlines() to read downscroll option

  - [x] 5.1 Replace hardcoded `this.playerStrumline.isDownscroll = true` with SaveManager read
    - Read `SaveManager.getInstance().getOption('downscroll')` and apply to `this.playerStrumline.isDownscroll`
    - File: `fnf-phaser/src/play/PlayState.js`, method `createStrumlines()`
    - Replace: `this.playerStrumline.isDownscroll = true;`
    - With: `this.playerStrumline.isDownscroll = SaveManager.getInstance().getOption('downscroll') ?? false;`
    - _Bug_Condition: createStrumlines() hardcodes isDownscroll = true, ignoring saved option_
    - _Expected_Behavior: playerStrumline.isDownscroll matches SaveManager.getOption('downscroll')_
    - _Preservation: Default downscroll is false; note this changes behavior from hardcoded true to default false_
    - _Requirements: 2.3_

- [x] 6. Wire PlayScene to read visual options from SaveManager

  - [x] 6.1 Read flashingLights, cameraZoom, comboDisplay, showFps from SaveManager in PlayScene.create()
    - After `this.playState.init(config)`, read visual options from SaveManager
    - Store on PlayState or pass to relevant systems:
      - `flashingLights` → store as `this.playState.flashingLights` for camera flash effects
      - `cameraZoom` → store as `this.playState.cameraZoomEnabled` for beat zoom
      - `comboDisplay` → store as `this.playState.comboDisplayEnabled` for combo popup visibility
      - `showFps` → conditionally create FPS text display
    - File: `fnf-phaser/src/scenes/PlayScene.js`, method `create()`
    - _Bug_Condition: PlayScene.create() never reads visual options from SaveManager_
    - _Expected_Behavior: Visual options from SaveManager are applied to gameplay systems_
    - _Preservation: Default values (flashingLights=true, cameraZoom=true, comboDisplay=true, showFps=false) produce same behavior as unfixed code_
    - _Requirements: 2.7, 2.8, 3.1_

- [x] 7. Wire NoteProcessor to apply noteOffset and hitsounds

  - [x] 7.1 Apply noteOffset in NoteProcessor.hitNote()
    - Read `noteOffset` from `SaveManager.getInstance().getOption('noteOffset')`
    - Add offset to timing calculation: `const adjustedTiming = timing + noteOffset`
    - Use `adjustedTiming` for judgement and scoring instead of raw `timing`
    - File: `fnf-phaser/src/play/NoteProcessor.js`, method `hitNote()`
    - _Bug_Condition: hitNote() uses raw timing without applying noteOffset_
    - _Expected_Behavior: timing is adjusted by noteOffset before judging_
    - _Requirements: 2.6_

  - [x] 7.2 Play hitsound on sick/killer judgement when hitsounds enabled
    - After computing judgement in `hitNote()`, check `SaveManager.getInstance().getOption('hitsounds')`
    - If hitsounds enabled and judgement is 'sick' or 'killer', call `context.playState.audioManager?.playHitsound()` (or access AudioManager through context)
    - File: `fnf-phaser/src/play/NoteProcessor.js`, method `hitNote()`
    - _Bug_Condition: hitNote() never checks hitsounds option or calls playHitsound()_
    - _Expected_Behavior: playHitsound() called on sick/killer hits when hitsounds=true_
    - _Preservation: Default hitsounds=false means no hitsounds played — same as unfixed code_
    - _Requirements: 2.9_

- [x] 8. Wire InputManager to read ghostTapping option

  - [x] 8.1 Read ghostTapping option in handleNoteInput() ghost tap branch
    - In the ghost tap branch (no note found), read `SaveManager.getInstance().getOption('ghostTapping')`
    - If ghostTapping is disabled (false), apply a miss penalty via `noteProcessor.missNote()` or a ghost penalty instead of just `noteProcessor.ghostMiss(direction)`
    - If ghostTapping is enabled (true, default), keep current behavior: `noteProcessor.ghostMiss(direction)` (press animation only)
    - File: `fnf-phaser/src/play/InputManager.js`, method `handleNoteInput()`
    - _Bug_Condition: handleNoteInput() always calls ghostMiss() regardless of ghostTapping setting_
    - _Expected_Behavior: When ghostTapping=false, ghost taps apply a penalty; when true, only press animation_
    - _Preservation: Default ghostTapping=true means no penalty on ghost taps — same as unfixed code_
    - _Requirements: 2.5_

- [x] 9. Wire MainMenuState menu music volume from SaveManager

  - [x] 9.1 Read masterVolume and musicVolume in playMenuMusic()
    - Read `masterVolume` and `musicVolume` from `SaveManager.getInstance()`
    - Compute combined volume: `(masterVolume / 100) * (musicVolume / 100)`
    - Replace hardcoded `{ loop: true, volume: 0.7 }` with `{ loop: true, volume: combinedVolume }`
    - File: `fnf-phaser/src/ui/MainMenuState.js`, method `playMenuMusic()`
    - _Bug_Condition: playMenuMusic() hardcodes volume 0.7, ignoring saved volume options_
    - _Expected_Behavior: Menu music volume = (masterVolume/100) × (musicVolume/100)_
    - _Preservation: Default masterVolume=100, musicVolume=100 → volume=1.0 (slightly louder than old 0.7, but matches user's intended full volume)_
    - _Requirements: 2.12_

- [x] 10. Wire OptionsState live volume preview

  - [x] 10.1 Apply volume changes to Phaser sound manager in real-time
    - When a volume slider (masterVolume, musicVolume, sfxVolume) value changes in `onNavigateLeft()`, `onNavigateRight()`, or `_applySliderPointer()`, immediately apply to `this.sound.volume`
    - Compute effective volume: `(masterVolume / 100) * (musicVolume / 100)` and set `this.sound.volume = effectiveVolume`
    - Add a helper method `_applyLiveVolumePreview()` that reads current slider values and applies to sound manager
    - Call this helper after any volume slider change
    - File: `fnf-phaser/src/ui/OptionsState.js`
    - _Bug_Condition: Volume slider changes are saved but not applied to Phaser sound manager in real-time_
    - _Expected_Behavior: Changing volume sliders immediately affects audible volume_
    - _Requirements: 2.2_

- [x] 11. Add OptionsState description/hint text for all options

  - [x] 11.1 Add description text element to createOptionDisplay()
    - Add a third text element (description/hint) below the option name in each option display container
    - Style: smaller font (20px), muted color (#94a3b8), wrapping enabled
    - File: `fnf-phaser/src/ui/OptionsState.js`, method `createOptionDisplay()`
    - _Requirements: 2.11_

  - [x] 11.2 Define description map and wire to updateDisplay()
    - Create a `OPTION_DESCRIPTIONS` map with descriptions for all options:
      - downscroll: "Notes scroll from top to bottom instead of bottom to top"
      - ghostTapping: "Allow pressing keys when no notes are present without penalty"
      - scrollSpeed: "Speed multiplier for note scrolling (0.5x - 3.0x)"
      - noteOffset: "Adjust note timing offset in milliseconds (-100 to +100)"
      - inputBufferWindow: "Input buffer window in milliseconds for late inputs"
      - inputDelayCompensation: "Compensate for input delay in milliseconds"
      - showNPS: "Show notes per second meter during gameplay"
      - showGrade: "Show letter grade during gameplay"
      - showComboBreaks: "Show combo break counter during gameplay"
      - showJudgements: "Show judgement counters (Sick, Good, Bad, etc.)"
      - masterVolume: "Overall game volume"
      - musicVolume: "Volume for music and instrumentals"
      - sfxVolume: "Volume for sound effects and hitsounds"
      - hitsounds: "Play a sound on perfectly timed note hits"
      - showFps: "Show frames per second counter"
      - flashingLights: "Enable flashing light effects during gameplay"
      - cameraZoom: "Enable camera zoom effects on beat"
      - comboDisplay: "Show combo popup on note hits"
    - In `updateDisplay()`, set the description text for each visible option from the map
    - File: `fnf-phaser/src/ui/OptionsState.js`
    - _Requirements: 2.11_

- [x] 12. Fix verification — confirm bug condition exploration test now passes

  - [x] 12.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Saved Options Are Applied By Consuming Systems
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.9, 2.12_

  - [x] 12.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Default Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 13. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx vitest --run fnf-phaser/tests/OptionsWiring.property.test.js`
  - Run existing test suites to verify no regressions:
    - `npx vitest --run fnf-phaser/tests/AudioManager.test.js`
    - `npx vitest --run fnf-phaser/tests/PlayState.test.js`
    - `npx vitest --run fnf-phaser/tests/OptionsState.test.js`
    - `npx vitest --run fnf-phaser/tests/MainMenuState.test.js`
  - Ensure all tests pass, ask the user if questions arise.

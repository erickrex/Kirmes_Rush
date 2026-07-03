# Fix Broken Options Wiring — Bugfix Design

## Overview

The OptionsState UI persists user preferences (volume, gameplay, visual settings) to SaveManager, but no consuming system reads those values back. Audio volumes are hardcoded, downscroll is forced to `true`, ghost tapping / hitsounds / noteOffset are ignored, and visual toggles (flashingLights, cameraZoom, comboDisplay, showFps) have no effect. Additionally, OptionsState provides no live preview of volume changes and no description text for options. This fix wires every saved option to its consuming system at the appropriate lifecycle point, adds live volume preview, and adds description hints to the UI.

## Glossary

- **Bug_Condition (C)**: Any option value saved via SaveManager that is never read by its consuming system, causing the option to have no effect on game behavior.
- **Property (P)**: Each saved option value is read and applied by the correct system at the correct time, producing observable behavior matching the user's preference.
- **Preservation**: Existing default behavior (when no options have been changed), save/load persistence, keybind capture, reset-to-defaults, and ExpandedStatsDisplay wiring must remain unchanged.
- **SaveManager**: Singleton that persists options to localStorage; stores values as `GameOptions` with defaults defined in `DEFAULT_OPTIONS`.
- **AudioManager**: Per-scene audio controller with `masterVolume`, `instrumentalVolume`, `sfxVolume` properties and `updateVolumes()` method.
- **PlayScene**: Phaser Scene that creates PlayState, AudioManager, VoicesGroup, strumlines, and HUD; the main entry point for gameplay.
- **PlayState**: Plain class orchestrating gameplay modules (NoteProcessor, InputManager, CameraController, SongFlowController).
- **OptionsState**: Settings menu scene that reads/writes options via SaveManager but currently has no live preview or description text.

## Bug Details

### Bug Condition

The bug manifests when a user changes any option in OptionsState and then enters gameplay (or stays in menus for volume). The saved values exist in SaveManager but are never consumed by AudioManager, PlayScene, PlayState, NoteProcessor, InputManager, MainMenuState, or OptionsState itself.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { optionKey: string, savedValue: any, consumingSystem: string }
  OUTPUT: boolean

  RETURN SaveManager.getOption(input.optionKey) !== DEFAULT_OPTIONS[input.optionKey]
         AND consumingSystem does NOT read SaveManager.getOption(input.optionKey)
         AND observed behavior equals default behavior regardless of saved value
END FUNCTION
```

### Examples

- User sets masterVolume to 50 in OptionsState → AudioManager.masterVolume stays 1.0 (default), gameplay audio is full volume.
- User enables downscroll=false → PlayState.createStrumlines() hardcodes `isDownscroll = true`, notes always scroll down.
- User sets scrollSpeed to 2.0 → PlayScene only uses `session.chart.scrollSpeed`, user preference ignored.
- User disables ghostTapping → InputManager.ghostMiss() always just plays press animation, never penalizes.
- User sets noteOffset to -20 → NoteProcessor.hitNote() uses raw timing, offset never applied.
- User enables hitsounds → NoteProcessor never calls AudioManager.playHitsound() on sick hits.
- User sets musicVolume to 30 → MainMenuState.playMenuMusic() hardcodes volume 0.7.
- User changes volume slider in OptionsState → no audible change until leaving and re-entering a scene.
- User views "Downscroll" option → no description text explaining what it does.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Default option values (when user has never changed settings) must produce identical behavior to current code.
- `SaveManager.saveOptions()` / `setOptions()` persistence flow must continue to work.
- `OptionsState.loadOptions()` must continue to populate UI controls from SaveManager.
- Keybind capture overlay flow must remain unchanged.
- "Reset to Defaults" must continue to reset all options and update UI.
- `PlayState.createHUDDisplay()` must continue to pass showNPS/showGrade/showComboBreaks/showJudgements from SaveManager.
- `AudioManager.updateVolumes()` must continue to respect muted state and master volume for instrumental and voices.
- Category navigation with ◀/▶ must continue to switch categories and reset selectedIndex to 0.

**Scope:**
All inputs that do NOT involve reading saved option values at system initialization time should be completely unaffected. This includes:
- Note hit/miss scoring logic (Scoring.judgeNote, Scoring.scoreNote)
- Chart parsing and note data generation
- Camera controller focus/zoom mechanics
- Replay recording/playback
- Touch input controller
- Level system feature flags

## Hypothesized Root Cause

Based on code analysis, the root causes are clear disconnections between SaveManager storage and consuming systems:

1. **AudioManager has no `applyOptionsFromSave()` method**: `setupAudio()` in PlayScene creates AudioManager with default volumes (1.0) and never reads masterVolume/musicVolume/sfxVolume from SaveManager.

2. **PlayState.createStrumlines() hardcodes downscroll**: Line `this.playerStrumline.isDownscroll = true` ignores the saved `downscroll` option. Similarly, scrollSpeed is only taken from the chart, not from SaveManager.

3. **InputManager/NoteProcessor ignore ghostTapping and hitsounds**: `ghostMiss()` only plays a press animation and never checks if ghost tapping is disabled (which should penalize). `hitNote()` never checks the hitsounds option to play AudioManager.playHitsound().

4. **NoteProcessor ignores noteOffset**: `hitNote()` calculates timing as `note.strumTime - effectiveSongPosition` without applying the user's noteOffset preference.

5. **MainMenuState hardcodes menu music volume**: `playMenuMusic()` uses `{ volume: 0.7 }` instead of reading masterVolume × musicVolume from SaveManager.

6. **PlayScene ignores visual options**: `create()` never reads flashingLights, cameraZoom, comboDisplay, or showFps from SaveManager to configure the corresponding systems.

7. **OptionsState lacks live preview**: Volume slider changes are saved but not applied to the Phaser sound manager in real-time.

8. **OptionsState lacks description text**: The `createOptionDisplay()` method creates name and value text but no description/hint text element.

## Correctness Properties

Property 1: Bug Condition - Saved Options Are Applied

_For any_ option value saved in SaveManager where the value differs from the default, the consuming system SHALL read and apply that value at its initialization point, producing observable behavior that matches the saved preference (e.g., masterVolume=50 → AudioManager.masterVolume=0.5, downscroll=false → playerStrumline.isDownscroll=false).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.11, 2.12**

Property 2: Preservation - Default Behavior Unchanged

_For any_ option value that equals the default in SaveManager (user has never changed it), the consuming system SHALL produce the same behavior as the current unfixed code, preserving all existing default gameplay, audio, and visual behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `fnf-phaser/src/audio/AudioManager.js`

**Method**: New `applyOptionsFromSave()`

**Specific Changes**:
1. **Add `applyOptionsFromSave()` method**: Reads masterVolume, musicVolume, sfxVolume from SaveManager, converts 0-100 → 0-1, and sets `this.masterVolume`, `this.instrumentalVolume`, `this.sfxVolume`, then calls `updateVolumes()`.

---

**File**: `fnf-phaser/src/scenes/PlayScene.js`

**Method**: `setupAudio()`, `create()`

**Specific Changes**:
2. **Wire volume options in `setupAudio()`**: After creating AudioManager, call `this.audioManager.applyOptionsFromSave()` so gameplay audio respects saved volumes.
3. **Read visual options in `create()`**: After creating PlayState, read `flashingLights`, `cameraZoom`, `comboDisplay`, `showFps` from SaveManager and store them on PlayState or pass to relevant systems.
4. **Pass scrollSpeed override**: When calling `playState.createStrumlines()`, read `scrollSpeed` from SaveManager and use it as a multiplier on the chart's scroll speed if the user has set a custom value.

---

**File**: `fnf-phaser/src/play/PlayState.js`

**Method**: `createStrumlines()`

**Specific Changes**:
5. **Read downscroll option**: Replace `this.playerStrumline.isDownscroll = true` with reading `SaveManager.getInstance().getOption('downscroll')` and applying it.

---

**File**: `fnf-phaser/src/play/NoteProcessor.js`

**Method**: `hitNote()`, `ghostMiss()`

**Specific Changes**:
6. **Apply noteOffset in `hitNote()`**: Read `noteOffset` from SaveManager and add it to the timing calculation.
7. **Play hitsound on sick hits**: After a successful hit with 'sick' or 'killer' judgement, check `hitsounds` option from SaveManager and call `audioManager.playHitsound()` if enabled.

---

**File**: `fnf-phaser/src/play/InputManager.js`

**Method**: `handleNoteInput()`

**Specific Changes**:
8. **Read ghostTapping option**: In the ghost tap branch (no note found), read `ghostTapping` from SaveManager. If ghostTapping is disabled, call `noteProcessor.ghostMiss(direction)` with a penalty instead of just playing the press animation.

---

**File**: `fnf-phaser/src/ui/MainMenuState.js`

**Method**: `playMenuMusic()`

**Specific Changes**:
9. **Read volume options for menu music**: Read masterVolume and musicVolume from SaveManager, compute combined volume as `(masterVolume/100) * (musicVolume/100)`, and use that instead of hardcoded 0.7.

---

**File**: `fnf-phaser/src/ui/OptionsState.js`

**Methods**: `onSelect()` / `onNavigateLeft()` / `onNavigateRight()`, `createOptionDisplay()`, `updateDisplay()`

**Specific Changes**:
10. **Add live volume preview**: When a volume slider (masterVolume, musicVolume, sfxVolume) value changes, immediately apply it to `this.sound.volume` (Phaser's global sound manager) so the user hears the change in real-time.
11. **Add description text to option displays**: Add a description text element to each option display container. Define a description map for all options and show the appropriate hint below the option name.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that set non-default option values in SaveManager, then instantiate the consuming systems and assert that the option values are applied. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **AudioManager Volume Test**: Set masterVolume=50 in SaveManager, create AudioManager, call setupAudio() → assert masterVolume is 0.5 (will fail on unfixed code)
2. **Downscroll Test**: Set downscroll=false in SaveManager, call createStrumlines() → assert isDownscroll is false (will fail on unfixed code — currently hardcoded true)
3. **Ghost Tapping Test**: Set ghostTapping=false, trigger ghost miss → assert penalty is applied (will fail on unfixed code)
4. **Menu Music Volume Test**: Set masterVolume=50, musicVolume=80, play menu music → assert volume is 0.4 (will fail on unfixed code — hardcoded 0.7)
5. **Live Preview Test**: Change volume slider in OptionsState → assert Phaser sound manager volume changes (will fail on unfixed code)

**Expected Counterexamples**:
- AudioManager.masterVolume remains 1.0 regardless of saved value
- playerStrumline.isDownscroll is always true
- Ghost taps never penalize regardless of ghostTapping setting
- Menu music volume is always 0.7

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL option WHERE isBugCondition(option) DO
  result := initializeSystem_fixed(option)
  ASSERT systemReadsOption(result, option.savedValue)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (default values), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL option WHERE NOT isBugCondition(option) DO
  ASSERT initializeSystem_original(option) = initializeSystem_fixed(option)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of default vs non-default option values
- It catches edge cases like boundary values (volume=0, volume=100, scrollSpeed=0.5)
- It provides strong guarantees that default behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for default option values, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Default Volume Preservation**: Verify that with default options (masterVolume=100, musicVolume=100, sfxVolume=100), AudioManager volumes are 1.0 — same as unfixed code.
2. **Default Downscroll Preservation**: Verify that with default downscroll=false, the strumline behavior matches current hardcoded true only if we accept the default change. (Note: the default is `false` but current code hardcodes `true` — the fix changes behavior to match the default.)
3. **Save/Load Preservation**: Verify that saveOptions/loadOptions round-trip is unchanged.
4. **Keybind Capture Preservation**: Verify keybind capture overlay flow is unchanged.

### Unit Tests

- Test AudioManager.applyOptionsFromSave() reads and applies all three volume options
- Test PlayState.createStrumlines() reads downscroll from SaveManager
- Test NoteProcessor.hitNote() applies noteOffset
- Test NoteProcessor.hitNote() plays hitsound on sick judgement when enabled
- Test InputManager.handleNoteInput() penalizes ghost taps when ghostTapping is disabled
- Test MainMenuState.playMenuMusic() uses saved volume values
- Test OptionsState live preview applies volume to sound manager
- Test OptionsState displays description text for each option

### Property-Based Tests

- Generate random option value combinations (volumes 0-100, booleans, scrollSpeed 0.5-3.0) and verify each consuming system reads and applies the correct value
- Generate random default-value option sets and verify behavior matches unfixed code
- Generate random sequences of option changes in OptionsState and verify persistence round-trip

### Integration Tests

- Test full flow: change volume in OptionsState → enter gameplay → verify AudioManager has correct volumes
- Test full flow: change downscroll in OptionsState → enter gameplay → verify strumline direction
- Test full flow: change ghostTapping → enter gameplay → trigger ghost tap → verify penalty behavior

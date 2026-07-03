# Bugfix Requirements Document

## Introduction

The OptionsState UI allows users to change gameplay, audio, and visual settings which are persisted to SaveManager via `saveOptions()`. However, no consuming system (AudioManager, PlayScene, PlayState, Strumline, MainMenuState, etc.) reads these saved values back at the appropriate time. As a result, changing any option has zero effect on actual game behavior. Additionally, the OptionsState UI lacks description text for each option, leaving users unaware of what each setting controls.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user changes masterVolume, musicVolume, or sfxVolume in OptionsState THEN the system saves the values to SaveManager but AudioManager, VoicesGroup, and the Phaser sound manager never read them, so audio playback volume is unaffected during gameplay and in menus.

1.2 WHEN the user changes volume sliders in OptionsState THEN the system does not apply the new volume levels in real-time (live preview), so the user cannot hear the effect of their changes while still in the Options menu.

1.3 WHEN the user changes downscroll in OptionsState THEN the system saves the value to SaveManager but PlayState.createStrumlines() hardcodes `isDownscroll = true` and never reads the saved option, so the downscroll toggle has no effect.

1.4 WHEN the user changes scrollSpeed in OptionsState THEN the system saves the value to SaveManager but PlayScene uses only the chart's scrollSpeed from the session and never reads the saved option as an override, so the scroll speed preference has no effect.

1.5 WHEN the user changes ghostTapping in OptionsState THEN the system saves the value to SaveManager but the input handling in PlayState/InputManager never reads it, so ghost tapping behavior is unaffected.

1.6 WHEN the user changes noteOffset in OptionsState THEN the system saves the value to SaveManager but note timing calculations in PlayState never apply the offset, so the note offset preference has no effect.

1.7 WHEN the user changes showFps in OptionsState THEN the system saves the value to SaveManager but no system reads it to show or hide an FPS counter, so the toggle has no effect.

1.8 WHEN the user changes flashingLights, cameraZoom, or comboDisplay in OptionsState THEN the system saves the values to SaveManager but PlayScene and PlayState never read them, so these visual preferences have no effect.

1.9 WHEN the user changes hitsounds in OptionsState THEN the system saves the value to SaveManager but the note hit handler in PlayState/NoteProcessor never checks it, so hitsounds are never played (or always played regardless of the setting).

1.10 WHEN the user changes showNPS, showGrade, showComboBreaks, or showJudgements in OptionsState THEN the system saves the values to SaveManager but ExpandedStatsDisplay only reads them at HUD creation time via PlayState.createHUDDisplay(), and the values are not refreshed if changed between sessions.

1.11 WHEN the user views any option in OptionsState THEN the system displays only the option name and value with no description/hint text explaining what the option does.

1.12 WHEN MainMenuState plays menu music THEN the system uses a hardcoded volume of 0.7 and never reads the masterVolume or musicVolume options from SaveManager.

### Expected Behavior (Correct)

2.1 WHEN PlayScene.setupAudio() initializes AudioManager THEN the system SHALL read masterVolume, musicVolume, and sfxVolume from SaveManager and apply them to AudioManager.masterVolume, AudioManager.instrumentalVolume, and AudioManager.sfxVolume respectively (converting from 0-100 to 0-1 scale).

2.2 WHEN the user changes volume sliders in OptionsState THEN the system SHALL immediately apply the new volume to the Phaser sound manager so the user hears the change in real-time as a live preview.

2.3 WHEN PlayState.createStrumlines() initializes strumlines THEN the system SHALL read the downscroll option from SaveManager and set `playerStrumline.isDownscroll` accordingly instead of hardcoding it to true.

2.4 WHEN PlayScene creates strumlines THEN the system SHALL read scrollSpeed from SaveManager and use it as a multiplier (or override) for the chart's scroll speed when the user has set a custom value.

2.5 WHEN the input system processes ghost taps (key presses with no matching note) THEN the system SHALL read the ghostTapping option from SaveManager and only penalize ghost taps when ghostTapping is disabled.

2.6 WHEN PlayState processes note hit timing THEN the system SHALL read noteOffset from SaveManager and apply it as an offset to note timing calculations.

2.7 WHEN the game initializes or when the showFps option changes THEN the system SHALL show or hide an FPS counter display based on the saved showFps option.

2.8 WHEN PlayScene initializes gameplay THEN the system SHALL read flashingLights, cameraZoom, and comboDisplay from SaveManager and configure the corresponding systems (flashing effects, camera zoom on beat, combo popup visibility) accordingly.

2.9 WHEN a note is hit with a "sick" judgement during gameplay THEN the system SHALL read the hitsounds option from SaveManager and play the hitsound audio only when hitsounds is enabled.

2.10 WHEN PlayState.createHUDDisplay() creates the expanded stats display THEN the system SHALL read showNPS, showGrade, showComboBreaks, and showJudgements from SaveManager to configure which stats are visible (this already partially works but should be verified as consistent).

2.11 WHEN the user views any option in OptionsState THEN the system SHALL display a description/hint line below the option name explaining what the option controls.

2.12 WHEN MainMenuState plays menu music THEN the system SHALL read masterVolume and musicVolume from SaveManager and apply the combined volume to the menu music playback.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user has never changed any options (default state) THEN the system SHALL CONTINUE TO use the default values defined in SaveManager's DEFAULT_OPTIONS for all gameplay, audio, and visual behavior.

3.2 WHEN OptionsState saves options via saveOptions() THEN the system SHALL CONTINUE TO persist all option values to localStorage through SaveManager.setOptions().

3.3 WHEN OptionsState loads via create() THEN the system SHALL CONTINUE TO read saved option values from SaveManager and populate the UI controls with the correct current values.

3.4 WHEN the user changes keybind options in OptionsState THEN the system SHALL CONTINUE TO capture and save keybinds through the existing keybind capture overlay flow.

3.5 WHEN the user selects "Reset to Defaults" in OptionsState THEN the system SHALL CONTINUE TO reset all options to DEFAULT_OPTIONS and update the UI.

3.6 WHEN PlayState creates the ExpandedStatsDisplay THEN the system SHALL CONTINUE TO pass the competitive stats toggle values (showNPS, showGrade, showComboBreaks, showJudgements) from SaveManager to the display constructor.

3.7 WHEN AudioManager.updateVolumes() is called THEN the system SHALL CONTINUE TO apply the muted state and master volume to the instrumental and voices tracks.

3.8 WHEN the user navigates between option categories with ◀/▶ THEN the system SHALL CONTINUE TO switch categories and reset the selected index to 0.

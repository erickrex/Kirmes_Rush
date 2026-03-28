# Requirements Document

## Introduction

This feature integrates four existing, fully-tested competitive stats modules (InputStatistics, ExpandedStatsDisplay, NPSMeter, GradeDisplay) into the live Friday Night Funkin' game loop. The modules are currently implemented and tested in isolation but not wired into PlayState or ResultState. The work is purely integration: hooking up data flow in PlayState, respecting the existing `expandedStats` feature toggle in LevelSystem, and passing timing data to the results screen.

## Already Implemented (No Work Needed)

The following are already present in the codebase and do NOT require changes:

- **OptionsState HUD Stats toggles**: OptionsState already has a "HUD Stats" category with individual toggles for NPS Meter (`showNPS`), Grade Display (`showGrade`), Combo Breaks (`showComboBreaks`), and Judgements (`showJudgements`). It also has a "Competitive" category with Input Buffer and Input Delay sliders.
- **OptionsState save/load**: The existing `loadOptions()` and `saveOptions()` methods already handle all option keys including the HUD Stats toggles.
- **LevelSystem expandedStats feature flag**: The `expandedStats` flag already exists in FeatureToggles.
- **Module APIs**: InputStatistics, ExpandedStatsDisplay, NPSMeter, and GradeDisplay are fully implemented with stable public APIs and passing tests.

## Glossary

- **PlayState**: The main gameplay orchestrator that manages note processing, input, scoring, and song flow during a song.
- **NoteProcessor**: The module within PlayState that handles note hit detection, miss checking, and emits `NOTE_HIT` / `NOTE_MISS` events via EventBus.
- **InputStatistics**: A standalone module that records per-hit timing offsets grouped by judgement and computes averages, early/late ratios, and distribution histograms.
- **ExpandedStatsDisplay**: A ScoreDisplay subclass that adds real-time NPS, grade, combo breaks, and judgement breakdown to the gameplay HUD.
- **NPSMeter**: A notes-per-second tracker using a 1-second sliding window, embedded inside ExpandedStatsDisplay.
- **GradeDisplay**: A real-time letter grade calculator (S++ through F) based on weighted accuracy and miss count, embedded inside ExpandedStatsDisplay.
- **ScoreDisplay**: The existing basic HUD element showing score, combo, and accuracy during gameplay.
- **ResultState**: The post-song results screen that displays final score, rank, and tally breakdown.
- **OptionsState**: The settings menu where players configure gameplay, audio, visual, and control preferences.
- **LevelSystem**: The progressive level loading system that manages feature flags including `expandedStats`.
- **FeatureToggles**: The feature flag manager within LevelSystem that gates optional features on/off.
- **SaveManager**: The singleton persistence layer that stores user options (including HUD stat visibility preferences) to localStorage.
- **EventBus**: The global event dispatcher used for decoupled communication between game systems.
- **SongFlowController**: The module that manages countdown, song start/end, and transitions to ResultState.
- **GameplayState**: The module tracking health, score, combo, and tallies during a song.

## Requirements

### Requirement 1: Wire InputStatistics into PlayState Note Hit Handler

**User Story:** As a competitive player, I want my timing data recorded during gameplay, so that I can review my timing tendencies after a song.

#### Acceptance Criteria

1. WHEN PlayState is initialized, THE PlayState SHALL create an InputStatistics instance and store it as a property.
2. WHEN a NOTE_HIT event is emitted by NoteProcessor, THE PlayState SHALL call `InputStatistics.recordHit(timing, judgement)` with the timing offset and judgement from the event payload.
3. WHEN a song ends, THE SongFlowController SHALL include the InputStatistics data (via `getStats()`) in the SONG_END event payload and in the data passed to ResultState.
4. WHEN PlayState is destroyed, THE PlayState SHALL set the InputStatistics reference to null.
5. WHEN PlayState is reset (via `resetState()`), THE PlayState SHALL call `InputStatistics.reset()` to clear accumulated data.

### Requirement 2: Integrate ExpandedStatsDisplay into Gameplay HUD

**User Story:** As a competitive player, I want to see real-time NPS, grade, combo breaks, and judgement counts during gameplay, so that I can monitor my performance live.

#### Acceptance Criteria

1. WHILE the `expandedStats` feature flag is enabled in LevelSystem, THE PlayState SHALL instantiate ExpandedStatsDisplay instead of ScoreDisplay for the gameplay HUD.
2. WHILE the `expandedStats` feature flag is disabled in LevelSystem, THE PlayState SHALL instantiate the standard ScoreDisplay for the gameplay HUD.
3. WHEN a NOTE_HIT event is emitted, THE ExpandedStatsDisplay SHALL receive the judgement and timestamp via its `recordHit(judgement, timestamp)` method.
4. WHEN a COMBO_BREAK event is emitted, THE ExpandedStatsDisplay SHALL increment its combo break counter via `recordComboBreak()`.
5. WHEN the HUD display is updated each frame, THE ExpandedStatsDisplay SHALL receive the current song time via its `update(delta, currentTime)` method.
6. THE ExpandedStatsDisplay SHALL read initial visibility settings (showNPS, showGrade, showComboBreaks, showJudgements) from SaveManager options at creation time.

### Requirement 3: Pass Timing Data to ResultState

**User Story:** As a competitive player, I want to see a timing analysis on the results screen after completing a song, so that I can understand my early/late tendencies.

#### Acceptance Criteria

1. WHEN ResultState is initialized with data containing `timingStats`, THE ResultState SHALL store the timing stats for display.
2. WHEN timing stats are available, THE ResultState SHALL display the average timing offset (in milliseconds, labeled early or late).
3. WHEN timing stats are available, THE ResultState SHALL display the early/late/perfect hit ratio.
4. WHEN timing stats are available, THE ResultState SHALL display per-judgement average offsets (sick, good, bad, shit).
5. IF timing stats are not provided (e.g., feature was disabled), THEN THE ResultState SHALL display the results screen without the timing analysis section.

### Requirement 4: Respect LevelSystem Feature Toggle and HUD Stats Options

**User Story:** As a game designer, I want competitive stats to be gated behind the `expandedStats` feature flag and the existing HUD Stats user options, so that progressive levels can introduce stats features gradually and players retain control.

#### Acceptance Criteria

1. WHEN the `expandedStats` feature flag is enabled in LevelSystem, THE PlayState SHALL use ExpandedStatsDisplay and record InputStatistics.
2. WHEN the `expandedStats` feature flag is disabled, THE PlayState SHALL use the standard ScoreDisplay and skip InputStatistics recording.
3. WHEN no LevelSystem is set on PlayState (freeplay mode), THE PlayState SHALL treat the `expandedStats` feature as enabled.
4. THE ExpandedStatsDisplay SHALL read initial visibility settings (showNPS, showGrade, showComboBreaks, showJudgements) from SaveManager options at creation time. (These options already exist in OptionsState's "HUD Stats" category.)

### ~~Requirement 5: Add Competitive Stats Toggle in OptionsState~~ (ALREADY IMPLEMENTED)

OptionsState already has a "HUD Stats" category with individual toggles for NPS Meter, Grade Display, Combo Breaks, and Judgements. No additional toggle is needed.

### ~~Requirement 6: Preserve Existing Module Tests~~ (ALREADY SATISFIED)

The four modules (InputStatistics, ExpandedStatsDisplay, NPSMeter, GradeDisplay) are not being modified — their public APIs remain identical. Existing tests will continue to pass without changes.

### Requirement 5: Add HUD Stats Visibility Keys to SaveManager Defaults

**User Story:** As a developer, I want the HUD Stats visibility options to have default values in SaveManager, so that new players get a consistent default experience.

#### Acceptance Criteria

1. THE SaveManager SHALL include `showNPS` (default: `true`), `showGrade` (default: `true`), `showComboBreaks` (default: `true`), and `showJudgements` (default: `false`) in its DEFAULT_OPTIONS.
2. WHEN SaveManager loads options that do not contain these keys, THE SaveManager SHALL default them to the values above.

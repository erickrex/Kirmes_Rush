# Implementation Plan: Competitive Stats Integration

## Overview

Wire four existing, fully-tested modules (InputStatistics, ExpandedStatsDisplay, NPSMeter, GradeDisplay) into the live game loop. No new modules are created. The work modifies PlayState, SongFlowController, ResultState, and SaveManager. Gated by the existing `expandedStats` feature flag in LevelSystem.

## Tasks

- [x] 1. Add HUD Stats visibility defaults to SaveManager
  - [x] 1.1 Add `showNPS: true`, `showGrade: true`, `showComboBreaks: true`, `showJudgements: false` to DEFAULT_OPTIONS in `fnf-phaser/src/data/SaveManager.js`
    - These keys already exist in DEFAULT_OPTIONS — verify they are present and correct; if not, add them
    - Existing merge logic in `loadOptions()` ensures old saves get defaults automatically
    - _Requirements: 5.1, 5.2_

  - [x] 1.2 Write unit tests for SaveManager HUD Stats defaults
    - Verify `getOption('showNPS')` returns `true` by default
    - Verify `getOption('showGrade')` returns `true` by default
    - Verify `getOption('showComboBreaks')` returns `true` by default
    - Verify `getOption('showJudgements')` returns `false` by default
    - Verify old saves without these keys get defaults after `loadOptions()`
    - _Requirements: 5.1, 5.2_

- [x] 2. Wire InputStatistics and ExpandedStatsDisplay into PlayState
  - [x] 2.1 Add InputStatistics import and properties to PlayState
    - Import `InputStatistics` from `'../input/InputStatistics.js'`
    - Import `ExpandedStatsDisplay` from `'./ExpandedStatsDisplay.js'`
    - Import `SaveManager` (already imported)
    - Add properties: `inputStatistics = null`, `competitiveStatsEnabled = false`, `scoreDisplay = null`
    - _Requirements: 1.1, 2.1_

  - [x] 2.2 Add `isCompetitiveStatsEnabled()` method to PlayState
    - Returns `true` if `this.levelSystem` is null (freeplay mode) or `this.levelSystem.isFeatureEnabled('expandedStats')` is true
    - Returns `false` otherwise
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.3 Add `createHUDDisplay()` method to PlayState
    - If `competitiveStatsEnabled` is true: create `ExpandedStatsDisplay` with SaveManager visibility options (`showNPS`, `showGrade`, `showComboBreaks`, `showJudgements`) and store as `this.scoreDisplay`
    - If false: create standard `ScoreDisplay` and store as `this.scoreDisplay`
    - _Requirements: 2.1, 2.2, 2.6, 4.4_

  - [x] 2.4 Modify PlayState `init()` to initialize competitive stats
    - Call `isCompetitiveStatsEnabled()` and cache result in `this.competitiveStatsEnabled`
    - If enabled: create `new InputStatistics()` and store as `this.inputStatistics`
    - _Requirements: 1.1, 4.1_

  - [x] 2.5 Wire NOTE_HIT events to InputStatistics and ExpandedStatsDisplay
    - In the existing note hit flow (after `hitNote` in NoteProcessor emits NOTE_HIT), add a listener or hook in PlayState that calls:
      - `this.inputStatistics.recordHit(timing, judgement)` if `inputStatistics` is not null
      - `this.scoreDisplay.recordHit(judgement, timestamp)` if `scoreDisplay` is an ExpandedStatsDisplay
    - _Requirements: 1.2, 2.3_

  - [x] 2.6 Wire COMBO_BREAK events to ExpandedStatsDisplay
    - Listen for `Events.COMBO_BREAK` on EventBus
    - Call `this.scoreDisplay.recordComboBreak()` if `scoreDisplay` is an ExpandedStatsDisplay
    - _Requirements: 2.4_

  - [x] 2.7 Pass currentTime to ExpandedStatsDisplay in PlayState `update()`
    - In the `update()` method, call `this.scoreDisplay.update(delta, this.songPosition)` if scoreDisplay exists
    - _Requirements: 2.5_

  - [x] 2.8 Modify PlayState `resetState()` to reset InputStatistics
    - Call `this.inputStatistics.reset()` if `inputStatistics` is not null
    - _Requirements: 1.5_

  - [x] 2.9 Modify PlayState `destroy()` to clean up competitive stats
    - Set `this.inputStatistics = null`
    - Destroy `this.scoreDisplay` if it exists, then set to null
    - _Requirements: 1.4_

  - [x] 2.10 Write property test: Feature-flag-gated HUD selection (Property 1)
    - **Property 1: Feature-flag-gated HUD selection**
    - Generate random boolean for `expandedStats` and random boolean for `hasLevelSystem`
    - Assert HUD type and InputStatistics presence match the truth table from design
    - **Validates: Requirements 2.1, 2.2, 4.1, 4.2, 4.3**

  - [x] 2.11 Write property test: NOTE_HIT data flows to both targets (Property 2)
    - **Property 2: NOTE_HIT data flows to both InputStatistics and ExpandedStatsDisplay**
    - Generate random arrays of `{timing, judgement}` pairs
    - Assert InputStatistics offsets contain all timings and ExpandedStatsDisplay judgement counts match
    - **Validates: Requirements 1.2, 2.3**

  - [x] 2.12 Write property test: Combo break counter increments (Property 3)
    - **Property 3: Combo break counter increments on COMBO_BREAK**
    - Generate random integer N (1–100)
    - Assert after N COMBO_BREAK events, `getComboBreaks() === N`
    - **Validates: Requirements 2.4**

  - [x] 2.13 Write property test: Visibility reflects SaveManager (Property 4)
    - **Property 4: ExpandedStatsDisplay visibility reflects SaveManager options**
    - Generate random booleans for `showNPS`, `showGrade`, `showComboBreaks`, `showJudgements`
    - Assert ExpandedStatsDisplay visibilityOptions match the generated values
    - **Validates: Requirements 2.6, 4.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Pass timing data through SongFlowController to ResultState
  - [x] 4.1 Modify SongFlowController `endSong()` to include timingStats
    - After existing `endSong()` logic, get `timingStats` from `playState.inputStatistics?.getStats() ?? null`
    - Include `timingStats` in the `Events.SONG_END` payload object
    - Include `timingStats` in the `onSongEnd` callback arguments
    - _Requirements: 1.3_

  - [x] 4.2 Modify ResultState `init()` to store timingStats
    - Store `data.timingStats` (or null) as `this.timingStats`
    - _Requirements: 3.1_

  - [x] 4.3 Add `createTimingAnalysis()` method to ResultState
    - Only called if `this.timingStats` is not null and has offsets
    - Display average offset with "Early" or "Late" label (negative = Early, positive = Late)
    - Display early/late/perfect hit counts
    - Display per-judgement average offsets for judgements with recorded hits
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 4.4 Call `createTimingAnalysis()` in ResultState `create()`
    - After existing `createTalliesDisplay()`, conditionally call `createTimingAnalysis()`
    - If `timingStats` is null, skip entirely — results screen renders normally without timing section
    - _Requirements: 3.5_

  - [x] 4.5 Clean up timingStats in ResultState `shutdown()`
    - Set `this.timingStats = null`
    - _Requirements: 3.1_

  - [x] 4.6 Write property test: ResultState timing analysis completeness (Property 5)
    - **Property 5: ResultState timing analysis display completeness**
    - Generate random TimingStats with random offsets and judgement distributions
    - Assert rendered text contains average offset with correct early/late label, ratio counts, and per-judgement averages
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [x] 4.7 Write unit tests for SongFlowController and ResultState integration
    - Verify `endSong()` includes `timingStats` in SONG_END payload
    - Verify ResultState `init()` stores timingStats
    - Verify ResultState renders without timing section when timingStats is null
    - _Requirements: 1.3, 3.1, 3.5_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The four modules (InputStatistics, ExpandedStatsDisplay, NPSMeter, GradeDisplay) are already complete — no modifications needed
- SaveManager already has the HUD Stats keys in DEFAULT_OPTIONS — task 1.1 is a verification step
- OptionsState already has the HUD Stats toggles — no work needed there
- Property tests use `fast-check` and reference design document properties
- Each task references specific requirements for traceability
